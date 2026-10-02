// Wikitext parsing for the ride stats build: finds the roller-coaster infoboxes in
// an English Wikipedia article and reads their figures. Used by scripts/stats/build.mjs.
// Node 18+, built-ins only.
//
// Never guesses: a value that does not parse cleanly (several figures, "approx.",
// a template it does not know, a unit that contradicts the parameter name) is
// returned as an issue with its raw text, and no value.

// The templates and their redirects (Template:Infobox Roller coaster, Template:Infobox rollercoaster).
export const BOX_NAME = /^infobox[ _]+roller[ _]?coaster$/i;
export const DUAL_BOX_NAME = /^infobox[ _]+dual[ _]+roller[ _]?coaster$/i;

// Dates after this one are rejected ("never in the future"). The build sets it to the
// retrieval date of the raw data, so a rebuild gives the same output on any day.
let refDate = '9999-12-31';
export function setReferenceDate(d) { refDate = d; }

// ---------------------------------------------------------------------------
// Wikitext: infobox extraction and parameter splitting
// ---------------------------------------------------------------------------

export const stripComments = (s) => s.replace(/<!--[\s\S]*?(-->|$)/g, '');

// Every roller-coaster infobox in the text, as { template, text, params }:
// 'single' for {{Infobox roller coaster}} (and its redirects), 'dual' for
// {{Infobox dual roller coaster}} (racing and dueling coasters, figures per track).
export function extractInfoboxes(content) {
  const text = stripComments(content);
  const out = [];
  let i = 0;
  while ((i = text.indexOf('{{', i)) !== -1) {
    const nameMatch = /^\{\{\s*([^|{}]+?)\s*(\||\}\})/.exec(text.slice(i, i + 200));
    const end = matchBraces(text, i);
    const name = nameMatch ? nameMatch[1].replace(/_/g, ' ') : '';
    const template = BOX_NAME.test(name) ? 'single' : DUAL_BOX_NAME.test(name) ? 'dual' : null;
    if (template && end !== -1) {
      const body = text.slice(i, end);
      out.push({ template, text: body, params: splitParams(body) });
      i = end;
    } else i += 2;
  }
  return out;
}

// Index just past the "}}" that closes the template opening at i, or -1.
function matchBraces(s, i) {
  let depth = 0;
  for (let k = i; k < s.length - 1; k++) {
    if (s[k] === '{' && s[k + 1] === '{') { depth++; k++; } else if (s[k] === '}' && s[k + 1] === '}') {
      depth--; k++;
      if (depth === 0) return k + 1;
    }
  }
  return -1;
}

// Split a template's body at top-level pipes. <ref>…</ref> blocks are treated as
// opaque, because citation text can hold unbalanced pipes.
export function splitParams(body) {
  const refs = [];
  const masked = body.slice(2, -2)
    .replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, (m) => `\u0000${refs.push(m) - 1}\u0000`);
  const parts = [];
  let depthT = 0;
  let depthL = 0;
  let cur = '';
  for (let k = 0; k < masked.length; k++) {
    const two = masked.slice(k, k + 2);
    if (two === '{{') { depthT++; cur += two; k++; continue; }
    if (two === '}}') { depthT--; cur += two; k++; continue; }
    if (two === '[[') { depthL++; cur += two; k++; continue; }
    if (two === ']]') { depthL--; cur += two; k++; continue; }
    if (masked[k] === '|' && depthT === 0 && depthL === 0) { parts.push(cur); cur = ''; continue; }
    cur += masked[k];
  }
  parts.push(cur);
  const unmask = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, n) => refs[Number(n)]);
  const params = {};
  for (const p of parts.slice(1)) {
    const eq = p.indexOf('=');
    if (eq === -1) continue;
    const key = p.slice(0, eq).trim();
    const value = unmask(p.slice(eq + 1)).trim();
    if (key) params[key] = value;
  }
  return params;
}

// ---------------------------------------------------------------------------
// Value cleaning and parsing. Each parser returns { ok: true, ... } or { ok: false, reason }.
// ---------------------------------------------------------------------------

const FOOTNOTE_TPL = /^(efn(-[a-z]+)?|refn|notetag|ref label|note label)$/i;
const DROP_TPL = /^(sfn|sfnp|sfnm|r|rp|cn|citation needed|fact|dubious|clarify|when|update needed|better source needed|verification needed|failed verification|according to whom|by whom|vague|unreliable source\?|self-published inline|nbsp|-)$/i;

// Remove refs and inline maintenance templates; report what was there.
export function clean(raw) {
  let s = stripComments(raw);
  const refs = [];
  s = s.replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, (m) => { refs.push(m); return ' '; });
  let footnote = false;
  // Remove top-level templates whose name is a footnote or maintenance tag.
  let out = '';
  for (let i = 0; i < s.length;) {
    if (s.startsWith('{{', i)) {
      const end = matchBraces(s, i);
      const name = (/^\{\{\s*([^|{}]+?)\s*(\||\}\})/.exec(s.slice(i, i + 120)) || [])[1] || '';
      if (end !== -1 && FOOTNOTE_TPL.test(name)) { footnote = true; i = end; continue; }
      if (end !== -1 && DROP_TPL.test(name)) { out += name === 'nbsp' ? ' ' : ''; i = end; continue; }
      if (end !== -1) { out += s.slice(i, end); i = end; continue; }
    }
    out += s[i++];
  }
  const text = out.replace(/&nbsp;|&#160;/g, ' ').replace(/&ndash;|&#8211;/g, '–').replace(/&mdash;|&#8212;/g, '—')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  return { text, refs, footnote };
}

// Short raw form for reviewers: comments removed, citation bodies collapsed.
export const rawForm = (raw) => stripComments(raw)
  .replace(/<ref\b([^>]*)\/>/gi, '<ref$1/>')
  .replace(/<ref\b([^>]*)>[\s\S]*?<\/ref\s*>/gi, '<ref$1>…</ref>')
  .replace(/\s+/g, ' ').trim();

export const delink = (s) => s
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '')
  .replace(/\{\{\s*nowrap\s*\|([^{}|]*)\}\}/gi, '$1')
  .trim();

export const decimals = (s) => (String(s).split('.')[1] || '').length;
const UNIT_ALIASES = {
  ft: 'ft', feet: 'ft', foot: 'ft', m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm',
  mph: 'mph', 'mi/h': 'mph', 'km/h': 'km/h', kph: 'km/h', kmh: 'km/h', 'km/hr': 'km/h',
};
const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/;
const toNum = (s) => Number(String(s).replace(/,/g, ''));

// A quantity in a unit-specific parameter (height_ft, speed_km/h, ...).
export function parseQuantity(text, unit) {
  if (!text) return { ok: false, reason: 'empty' };
  let m = NUMBER.exec(text.replace(/^(\d+)\.$/, '$1')); // "70." is 70
  if (m) return { ok: true, n: toNum(m[0]), unit, dec: decimals(m[0].replace(/,/g, '')) };
  m = /^(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*([a-z/]+)\.?$/i.exec(text);
  if (m) {
    const u = UNIT_ALIASES[m[2].toLowerCase()];
    if (u === unit) return { ok: true, n: toNum(m[1]), unit, dec: decimals(m[1].replace(/,/g, '')) };
    return { ok: false, reason: `unit "${m[2]}" contradicts the ${unit} parameter` };
  }
  m = /^\{\{\s*(?:convert|cvt)\s*\|\s*([\d.,]+)\s*\|\s*([^|{}]+?)\s*(?:\|[^{}]*)?\}\}$/i.exec(text);
  if (m && NUMBER.test(m[1])) {
    const u = UNIT_ALIASES[m[2].toLowerCase()];
    if (u === unit) return { ok: true, n: toNum(m[1]), unit, dec: decimals(m[1].replace(/,/g, '')) };
    return { ok: false, reason: `convert unit "${m[2]}" contradicts the ${unit} parameter` };
  }
  return { ok: false, reason: 'not a single plain figure' };
}

function parseInversions(text) {
  if (/^\d+$/.test(text)) return { ok: true, n: Number(text) };
  if (/^(none|zero|no)$/i.test(text)) return { ok: true, n: 0 };
  return { ok: false, reason: 'not a whole number' };
}

export function parseGforce(text) {
  let m = /^(\d+(?:\.\d+)?)\s*(?:g|gs|g's|gees|g-force)?$/i.exec(text);
  if (!m) m = /^\{\{\s*val\s*\|\s*(\d+(?:\.\d+)?)\s*(?:\|\s*(?:u|ul)\s*=\s*(?:g|g0|gn|\[\[g-force\|g\]\])\s*)?\}\}$/i.exec(text);
  if (m) return { ok: true, n: Number(m[1]) };
  return { ok: false, reason: 'not a single figure in g (a range, negative and positive values, or a note)' };
}

function parseAngle(text) {
  const m = /^(\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)?$/i.exec(text);
  return m ? { ok: true, n: Number(m[1]) } : { ok: false, reason: 'not a single angle' };
}

export function parseDuration(text) {
  const t = text.toLowerCase().replace(/\b(min|sec)\./g, '$1').replace(/\.$/, '');
  let m = /^(\d{1,2}):([0-5]\d)(?:\s*(?:min|mins|minutes))?$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]) * 60 + Number(m[2]) };
  m = /^(\d+)\s*(?:seconds?|secs?|s)$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]), inSeconds: true };
  m = /^(\d+(?:\.5)?)\s*(?:minutes?|mins?)$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]) * 60 };
  m = /^(\d+)\s*(?:minutes?|mins?),?\s*(?:and\s*)?(\d+)\s*(?:seconds?|secs?|s)$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]) * 60 + Number(m[2]) };
  m = /^\{\{\s*duration\s*((?:\|[^{}]*)*)\}\}$/i.exec(text);
  if (m) {
    const args = m[1].split('|').slice(1).map((x) => x.trim());
    const named = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => a.split('=').map((x) => x.trim())));
    const pos = args.filter((a) => !a.includes('='));
    const [h, mi, se] = pos.length ? [pos[0], pos[1], pos[2]] : [named.h, named.m, named.s];
    if ([h, mi, se].every((x) => x === undefined || x === '' || /^\d+$/.test(x))) {
      return { ok: true, s: (Number(h) || 0) * 3600 + (Number(mi) || 0) * 60 + (Number(se) || 0) };
    }
  }
  return { ok: false, reason: 'not a single duration' };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const pad = (n) => String(n).padStart(2, '0');
function dateString(y, mo, d) {
  if (!/^\d{4}$/.test(String(y))) return null;
  if (mo == null || mo === '') return String(y);
  if (!(mo >= 1 && mo <= 12)) return null;
  if (d == null || d === '') return `${y}-${pad(mo)}`;
  if (!(d >= 1 && d <= 31)) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}
export function parseDate(text) {
  if (!text) return { ok: false, reason: 'empty' };
  let v = null;
  let m = /^\{\{\s*(start date and age|start date|end date and age|end date|start|end|dts|date)\s*((?:\|[^{}]*)*)\}\}$/i.exec(text);
  if (m) {
    const pos = m[2].split('|').slice(1).map((x) => x.trim()).filter((a) => a && !a.includes('='));
    if (pos.length <= 3 && pos.every((x) => /^\d+$/.test(x))) v = dateString(pos[0], pos[1] && Number(pos[1]), pos[2] && Number(pos[2]));
    else if (pos.length === 1 && !/^\d+$/.test(pos[0])) { const inner = parseDate(pos[0]); if (inner.ok) v = inner.v; } // {{Start date and age|May 30, 1946}}
  } else if ((m = /^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i.exec(text)) && MONTHS.includes(m[1].toLowerCase())) {
    v = dateString(m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, Number(m[2]));
  } else if ((m = /^(\d{1,2})\s+([a-z]+),?\s+(\d{4})$/i.exec(text)) && MONTHS.includes(m[2].toLowerCase())) {
    v = dateString(m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, Number(m[1]));
  } else if ((m = /^([a-z]+),?\s+(\d{4})$/i.exec(text)) && MONTHS.includes(m[1].toLowerCase())) {
    v = dateString(m[2], MONTHS.indexOf(m[1].toLowerCase()) + 1);
  } else if (/^\d{4}$/.test(text)) v = text;
  else if (/^\d{4}-\d{2}-\d{2}$/.test(text)) v = text;
  if (!v) return { ok: false, reason: 'not a single date' };
  if (v > refDate.slice(0, v.length)) return { ok: false, reason: 'date is after the data was retrieved' };
  return { ok: true, v };
}

// manufacturer, designer, model: one plain name.
export function parseText(text) {
  if (!text) return { ok: false, reason: 'empty' };
  if (/<br\s*\/?>|\{\{\s*(ubl|unbulleted list|plainlist|plain list|flatlist|hlist|bulleted list)\b|\n\s*\*/i.test(text)) return { ok: false, reason: 'several values' };
  const t = delink(text);
  if (/\{\{|\}\}|<|\[\[/.test(t)) return { ok: false, reason: 'contains markup the parser does not handle' };
  if (!t || /^(unknown|n\/a|none|tba|tbd|\?|-|–)$/i.test(t)) return { ok: false, reason: 'no value' };
  return { ok: true, v: t };
}

// The ride's place names from the infobox: link targets and texts, plain text, locationarticle.
export function placeNames(params) {
  const names = [];
  for (const key of ['location', 'locationarticle']) {
    const raw = params[key];
    if (!raw) continue;
    const s = clean(raw).text;
    for (const m of s.matchAll(/\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g)) { names.push(m[1].trim()); if (m[2]) names.push(m[2].trim()); }
    const plain = delink(s);
    names.push(plain, ...plain.split(/\s*(?:,|<br\s*\/?>|\bor\b)\s*/i));
  }
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))];
}

export function previousNames(params) {
  if (!params.previousnames) return [];
  const t = delink(clean(params.previousnames).text.replace(/<br\s*\/?>/gi, ',').replace(/\{\{\s*nowrap\s*\|([^{}]*)\}\}/gi, '$1'));
  return t.split(/\s*[,;]\s*/).map((x) => x.replace(/\([^)]*\)/g, '').replace(/''/g, '').trim()).filter((x) => x.length > 1);
}

// What a value's inline citation points at (contract rule 6), or undefined if unknown.
const OPERATOR_HOSTS = /sixflags|cedarfair|cedarpoint|kingsisland|kingsdominion|carowinds|canadaswonderland|knotts|worldsoffun|valleyfair|michigansadventure|dorneypark|californiasgreatamerica|buschgardens|seaworld|disney|universal|dollywood|hersheypark|kennywood|holidayworld|knoebels|silverdollarcity|lagoonpark|legoland|herschend|palaceentertainment|parquesreunidos|kentuckykingdom|lostislandthemepark|nickelodeonuniverse|americandream/;
const MAKER_HOSTS = /intamin|bolliger|vekoma|gerstlauer|mack-?rides|rockymtn|rockymountain|s-s\.com|s-sworldwide|premier-?rides|zamperla|gravitygroup|gci|greatcoasters|chancerides|skylineattractions|larson|zierer|maurer|schwarzkopf|arrow|morgan|b-and-m/;
// No inline <ref> does not mean uncited: the article body may cite the figure, so
// `cite` is left out rather than set to 'none'.
export function citeKind(refs) {
  if (!refs.length) return undefined;
  const kinds = new Set();
  for (const r of refs) {
    if (/^<ref\b[^>]*\/>$/i.test(r)) return undefined; // a named reference defined elsewhere in the article
    const hosts = [...r.matchAll(/https?:\/\/([^/\s|\]]+)/gi)].map((m) => m[1].toLowerCase().replace(/^www\./, ''));
    if (/cite rcdb|rcdb\.com/i.test(r)) kinds.add('rcdb');
    else if (hosts.some((h) => OPERATOR_HOSTS.test(h))) kinds.add('park');
    else if (hosts.some((h) => MAKER_HOSTS.test(h))) kinds.add('manufacturer');
    else if (/\{\{\s*cite (news|magazine)|newspaper\s*=/i.test(r)) kinds.add('news');
    else kinds.add('other');
  }
  for (const k of ['park', 'manufacturer', 'news', 'rcdb', 'other']) if (kinds.has(k)) return k;
  return undefined;
}

// ---------------------------------------------------------------------------
// Infobox -> contract values
// ---------------------------------------------------------------------------

export const FT = 0.3048;
export const MPH = 1.609344;
export const r3 = (x) => Math.round(x * 1000) / 1000;
export const RANGES = { height: [1, 200], drop: [1, 200], length: [20, 3000], speed: [5, 250], duration: [10, 600], gforce: [0.5, 6.5], inversions: [0, 14] };
export const inRange = (f, v) => !RANGES[f] || (v >= RANGES[f][0] && v <= RANGES[f][1]);

// Parse one infobox. Returns { values: {field: {v, pub?, raw, param, cite?}}, issues: [...], extra: {angle, status} }.
// For a dual-track infobox, `track` (1 or 2) reads one track; without it, a per-track
// figure is used only when both tracks state it and agree.
export function readInfobox(params, { template = 'single', track = null, qualifyEarlierRide = false } = {}) {
  const values = {};
  const issues = [];
  const extra = {};
  const ctx = { issues, qualifyEarlierRide };

  if (template === 'single') Object.assign(values, readTrack(params, (base, unit) => (unit ? `${base}_${unit}` : base), ctx));
  else if (track) Object.assign(values, readTrack(params, (base, unit) => (unit ? `${base}${track}_${unit}` : `${base}${track}`), ctx));
  else {
    const t1 = readTrack(params, (base, unit) => (unit ? `${base}1_${unit}` : `${base}1`), ctx);
    const t2 = readTrack(params, (base, unit) => (unit ? `${base}2_${unit}` : `${base}2`), ctx);
    for (const f of new Set([...Object.keys(t1), ...Object.keys(t2)])) {
      const [a, b] = [t1[f], t2[f]];
      if (a && b && (a.lo != null ? overlaps(a, b) : a.v === b.v)) values[f] = { ...a, raw: `${a.raw} / ${b.raw}`, param: `${a.param} / ${b.param}` };
      else issues.push({ field: f, param: [a?.param, b?.param].filter(Boolean).join(' / '), raw: [a?.raw, b?.raw].filter(Boolean).join(' / '),
        reason: a && b ? 'the two tracks differ, and js/data.js lists the ride as one credit' : 'only one track states it' });
    }
  }

  const simple = [
    ['manufacturer', 'manufacturer', parseText, (p) => ({ v: p.v })],
    ['designer', 'designer', parseText, (p) => ({ v: p.v })],
    ['model', 'model', parseText, (p) => ({ v: p.v })],
    ['opened', 'opened', parseDate, (p) => ({ v: p.v })],
    ['closed', 'closed', parseDate, (p) => ({ v: p.v })],
  ];
  for (const [field, param, parse, build] of simple) {
    const raw = params[param];
    if (raw == null) continue;
    const c = clean(raw);
    if (!c.text) continue;
    if (earlierRideGuard(ctx, field, param, raw, c)) continue;
    const parsed = parse(c.text);
    if (!parsed.ok) { if (parsed.reason !== 'empty') issues.push({ field, param, raw: rawForm(raw), reason: parsed.reason }); continue; }
    values[field] = { ...build(parsed), raw: rawForm(raw), param, cite: ['opened', 'closed'].includes(field) ? citeKind(c.refs) : undefined };
  }

  // material (type = Steel / Wood) and type (type2, type3).
  if (params.type && clean(params.type).text) {
    const t = delink(clean(params.type).text).toLowerCase();
    const mat = { steel: 'steel', wood: 'wood', wooden: 'wood', hybrid: 'hybrid' }[t];
    if (mat) values.material = { v: mat, raw: rawForm(params.type), param: 'type' };
    else issues.push({ field: 'material', param: 'type', raw: rawForm(params.type), reason: 'not Steel or Wood' });
  }
  const types = [];
  for (const p of ['type2', 'type3']) {
    if (!params[p] || !clean(params[p]).text) continue;
    const parsed = parseText(clean(params[p]).text);
    if (parsed.ok) types.push(parsed.v);
    else issues.push({ field: 'type', param: p, raw: rawForm(params[p]), reason: parsed.reason });
  }
  if (types.length) values.type = { v: types, raw: types.join(' / '), param: 'type2/type3' };

  // Not in the contract (ask before adding a field); kept in sources/stats/review.json.
  const angleParam = template === 'single' ? 'angle' : `angle${track || 1}`;
  if (params[angleParam] && clean(params[angleParam]).text) {
    const a = parseAngle(clean(params[angleParam]).text);
    extra.angle = a.ok ? { v: a.n, raw: rawForm(params[angleParam]) } : { raw: rawForm(params[angleParam]), reason: a.reason };
  }
  const status = delink(clean(params.status || params.Status || '').text);
  if (status) extra.status = status;
  return { values, issues, extra };
}

function earlierRideGuard(ctx, field, param, raw, c) {
  if (!ctx.qualifyEarlierRide) return false;
  if (c.footnote || /\(\s*(as|originally|formerly|until|before)\b/i.test(c.text) || /<br\s*\/?>/i.test(c.text)) {
    ctx.issues.push({ field, param, raw: rawForm(raw), reason: 'the article also covers an earlier ride, and this value is footnoted or qualified; it may describe the earlier ride' });
    return true;
  }
  return false;
}

// Figures that a dual-track infobox gives per track: height, drop, length, speed,
// inversions, G-force, duration. `name(base, unit)` builds the parameter name.
function readTrack(params, name, ctx) {
  const values = {};
  const { issues } = ctx;
  const QTY = { height: ['ft', 'm'], drop: ['ft', 'm'], length: ['ft', 'm'], speed: ['mph', 'km/h'] };
  for (const [field, units] of Object.entries(QTY)) {
    const found = [];
    for (const unit of units) {
      const param = name(field, unit);
      const raw = params[param];
      if (raw == null || !raw.trim()) continue;
      const c = clean(raw);
      if (!c.text) continue;
      if (earlierRideGuard(ctx, field, param, raw, c)) continue;
      const q = parseQuantity(c.text, unit);
      if (!q.ok) { issues.push({ field, param, raw: rawForm(raw), reason: q.reason }); continue; }
      const f = unit === 'ft' ? FT : unit === 'mph' ? MPH : 1;
      found.push({ v: r3(q.n * f), pub: [q.n, unit], lo: (q.n - 0.5 * 10 ** -q.dec) * f, hi: (q.n + 0.5 * 10 ** -q.dec) * f, raw: rawForm(raw), param, cite: citeKind(c.refs) });
    }
    if (!found.length) continue;
    if (found.length === 2 && !overlaps(found[0], found[1])) {
      issues.push({ field, param: `${found[0].param} / ${found[1].param}`, raw: `${found[0].raw} / ${found[1].raw}`, reason: 'the imperial and metric parameters disagree' });
      continue;
    }
    const pick = found[0]; // imperial first: US parks publish imperial figures
    if (!inRange(field, pick.v)) { issues.push({ field, param: pick.param, raw: pick.raw, reason: `outside the plausible range for ${field}` }); continue; }
    values[field] = pick;
  }
  const simple = [
    ['inversions', parseInversions, (p) => ({ v: p.n })],
    ['gforce', parseGforce, (p) => ({ v: p.n })],
    // pub only when the article states seconds; "2:30" is not published as [150, "s"].
    ['duration', parseDuration, (p) => ({ v: p.s, ...(p.inSeconds ? { pub: [p.s, 's'] } : {}) })],
  ];
  for (const [field, parse, build] of simple) {
    const param = name(field);
    const raw = params[param];
    if (raw == null) continue;
    const c = clean(raw);
    if (!c.text) continue;
    if (earlierRideGuard(ctx, field, param, raw, c)) continue;
    const parsed = parse(c.text);
    if (!parsed.ok) { if (parsed.reason !== 'empty') issues.push({ field, param, raw: rawForm(raw), reason: parsed.reason }); continue; }
    const n = field === 'duration' ? parsed.s : parsed.n;
    if (!inRange(field, n)) { issues.push({ field, param, raw: rawForm(raw), reason: `outside the plausible range for ${field}` }); continue; }
    values[field] = { ...build(parsed), raw: rawForm(raw), param, cite: citeKind(c.refs) };
  }
  return values;
}

export const overlaps = (a, b) => {
  const slack = 0.005 * Math.max(Math.abs(a.v), Math.abs(b.v));
  return a.lo - slack <= b.hi && b.lo - slack <= a.hi;
};
