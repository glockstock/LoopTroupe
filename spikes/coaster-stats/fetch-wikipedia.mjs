#!/usr/bin/env node
// Spike: English Wikipedia roller-coaster infobox stats (CC BY-SA 4.0), merged with
// the Wikidata match (CC0) into one stats file keyed by Loop Troupe coaster IDs, in
// the shape of CONTRACT.md (ride stats file contract v1). Node 18+ (22.21+ behind a
// proxy), built-ins only.
//
//   node spikes/coaster-stats/fetch-wikidata.mjs             1. fetch Wikidata into raw/
//   node spikes/coaster-stats/fetch-wikipedia.mjs            2. fetch Wikipedia into raw/, then build
//   node spikes/coaster-stats/fetch-wikipedia.mjs --offline  rebuild from raw/ without fetching
//
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1.
//
// Inputs:  js/data.js, js/guides/cedar-point.js, raw/wikidata-raw.json, raw/wikipedia-raw.json,
//          overrides.json (your choices where the sources disagree).
// Outputs: stats.json (contract shape), links.json, ambiguous.json, review.json, coverage.md.
// Raw API responses stay in raw/, which is gitignored.
//
// Rules this build follows:
// - Never guess. A value that does not parse cleanly (several figures, "approx.",
//   a template it does not know, a unit that contradicts the parameter name) is
//   left out and listed in review.json with its raw text.
// - Where Wikidata and Wikipedia disagree beyond rounding, neither value ships;
//   both go to review.json and coverage.md until overrides.json records a choice.
// - An article whose infobox also lists a previous name that js/data.js keeps as a
//   separate credit (Top Thrill Dragster under "Top Thrill 2") gives its figures
//   only to the ride the infobox is named for, and drops any value footnoted or
//   qualified as belonging to the earlier ride.
// - No other sources. RCDB is never contacted; an infobox's rcdb_number is ignored.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchWikidata, loadDb, loadCedarPointOperating, norm, compact, nameKeys, parkKeys,
  STATE_NAMES, RAW_DIR, RAW_FILE as WD_RAW_FILE,
} from './fetch-wikidata.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = (f) => path.join(HERE, f);
const WP_RAW_FILE = path.join(RAW_DIR, 'wikipedia-raw.json');
const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'LoopTroupe-data/0.2 (https://github.com/glockstock/LoopTroupe)';
const TEMPLATE = 'Template:Infobox roller coaster';
// The template and its redirects (Template:Infobox Roller coaster, Template:Infobox rollercoaster).
const BOX_NAME = /^infobox[ _]+roller[ _]?coaster$/i;
const BATCH = 50; // MediaWiki's limit for titles per request
const PAUSE_MS = 3000; // between requests; requests are sent one at a time
const LICENSE_NOTICE = 'Loop Troupe ride stats, compiled from Wikipedia (© Wikipedia contributors, CC BY-SA 4.0) and Wikidata (CC0 1.0); values selected, unit-converted, and normalized by Loop Troupe. This file is available under CC BY-SA 4.0.';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Fetch (MediaWiki Action API)
// ---------------------------------------------------------------------------

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', formatversion: '2', maxlag: '5', ...params })}`;
  for (let attempt = 1; attempt <= 10; attempt++) {
    let res;
    let text;
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } });
      text = await res.text();
    } catch (err) {
      console.log(`network error: ${err.cause?.code || err.message}; retrying in 30 s`);
      await sleep(30_000);
      continue;
    }
    const retryAfter = Math.max(5, Number(res.headers.get('retry-after')) || 0) * 1000;
    if (res.ok) {
      const json = JSON.parse(text);
      if (json.error?.code === 'maxlag') { console.log(`maxlag; waiting ${retryAfter / 1000} s`); await sleep(retryAfter); continue; }
      if (json.error) throw new Error(`API error ${json.error.code}: ${json.error.info}`);
      return json;
    }
    console.log(`HTTP ${res.status} (attempt ${attempt}); waiting ${Math.max(30_000, retryAfter) / 1000} s`);
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    await sleep(Math.max(30_000, retryAfter));
  }
  throw new Error('gave up after retries');
}

async function embeddedIn() {
  const titles = [];
  let cont = {};
  for (;;) {
    const j = await api({ action: 'query', list: 'embeddedin', eititle: TEMPLATE, einamespace: '0', eilimit: '500', ...cont });
    titles.push(...j.query.embeddedin.map((p) => p.title));
    if (!j.continue) break;
    cont = { eicontinue: j.continue.eicontinue, continue: j.continue.continue };
    await sleep(PAUSE_MS);
  }
  return titles;
}

// Section 0 holds the infobox, so only the lead is fetched (rvsection=0).
async function fetchLeads(titles) {
  const pages = {};
  const redirects = {};
  const missing = [];
  for (let i = 0; i < titles.length; i += BATCH) {
    const batch = titles.slice(i, i + BATCH);
    const j = await api({
      action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main',
      rvsection: '0', redirects: '1', titles: batch.join('|'),
    });
    for (const n of j.query.normalized || []) if (n.from !== n.to) redirects[n.from] = n.to;
    for (const r of j.query.redirects || []) redirects[r.from] = r.to;
    for (const p of j.query.pages) {
      if (p.missing || p.invalid || !p.revisions) { missing.push(p.title); continue; }
      const rev = p.revisions[0];
      pages[p.title] = { pageid: p.pageid, revid: rev.revid, timestamp: rev.timestamp, content: rev.slots.main.content };
    }
    console.log(`  pages ${Math.min(i + BATCH, titles.length)}/${titles.length}`);
    if (i + BATCH < titles.length) await sleep(PAUSE_MS);
  }
  return { pages, redirects, missing };
}

async function fetchAll(wdRaw, db) {
  const sitelinks = [...new Set(wdRaw.labels.map((l) => l.article).filter(Boolean))];
  console.log(`Wikidata sitelinks (US items): ${sitelinks.length}`);
  const transclusions = await embeddedIn();
  console.log(`articles using ${TEMPLATE}: ${transclusions.length}`);
  await sleep(PAUSE_MS);
  const titles = [...new Set([...sitelinks, ...transclusions])].sort();
  const { pages, redirects, missing } = await fetchLeads(titles);
  // Keep only what the build can use: the infobox wikitext (not the article) of pages
  // that are a Wikidata US sitelink or whose infobox names one of our parks.
  const sitelinkFinal = new Set(sitelinks.map((t) => resolveTitle(t, redirects)));
  const localParkKeys = new Set(db.parks.flatMap((p) => parkKeys(p.name)));
  const kept = {};
  let dropped = 0;
  for (const [title, p] of Object.entries(pages)) {
    const boxes = extractInfoboxes(p.content);
    const usable = sitelinkFinal.has(title)
      || boxes.some((b) => placeNames(b.params).some((n) => parkKeys(n).some((k) => localParkKeys.has(k)))
        || placeNames(b.params).some((n) => /\b(united states|u\.s\.|usa)\b/i.test(n) || Object.values(STATE_NAMES).some((s) => n.includes(s))));
    if (!usable) { dropped++; continue; }
    kept[title] = { pageid: p.pageid, revid: p.revid, timestamp: p.timestamp, infoboxes: boxes.map((b) => b.text) };
  }
  const raw = {
    source: 'English Wikipedia (https://en.wikipedia.org), CC BY-SA 4.0; © Wikipedia contributors',
    endpoint: API,
    userAgent: USER_AGENT,
    retrieved: new Date().toISOString(),
    template: TEMPLATE,
    request: 'action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&rvsection=0&redirects=1, 50 titles per request',
    note: `Requested ${titles.length} titles (Wikidata sitelinks plus every article transcluding the template). Stored: the infobox wikitext of ${Object.keys(kept).length} pages; ${dropped} pages outside the US or without a usable infobox were not stored.`,
    redirects, missing, pages: kept,
  };
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(WP_RAW_FILE, JSON.stringify(raw, null, 1) + '\n');
  console.log(`wrote ${path.relative(process.cwd(), WP_RAW_FILE)} (${Object.keys(kept).length} pages)`);
  return raw;
}

function resolveTitle(t, redirects) {
  let cur = t;
  for (let i = 0; i < 5 && redirects[cur]; i++) cur = redirects[cur];
  return cur;
}

// ---------------------------------------------------------------------------
// Wikitext: infobox extraction and parameter splitting
// ---------------------------------------------------------------------------

const stripComments = (s) => s.replace(/<!--[\s\S]*?(-->|$)/g, '');

// Every {{Infobox roller coaster ...}} in the text, as { text, params }.
function extractInfoboxes(content) {
  const text = stripComments(content);
  const out = [];
  let i = 0;
  while ((i = text.indexOf('{{', i)) !== -1) {
    const nameMatch = /^\{\{\s*([^|{}]+?)\s*(\||\}\})/.exec(text.slice(i, i + 200));
    const end = matchBraces(text, i);
    if (nameMatch && BOX_NAME.test(nameMatch[1].replace(/_/g, ' ')) && end !== -1) {
      const body = text.slice(i, end);
      out.push({ text: body, params: splitParams(body) });
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
function splitParams(body) {
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
function clean(raw) {
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
const rawForm = (raw) => stripComments(raw)
  .replace(/<ref\b([^>]*)\/>/gi, '<ref$1/>')
  .replace(/<ref\b([^>]*)>[\s\S]*?<\/ref\s*>/gi, '<ref$1>…</ref>')
  .replace(/\s+/g, ' ').trim();

const delink = (s) => s
  .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
  .replace(/'''?/g, '')
  .replace(/\{\{\s*nowrap\s*\|([^{}|]*)\}\}/gi, '$1')
  .trim();

const decimals = (s) => (String(s).split('.')[1] || '').length;
const UNIT_ALIASES = {
  ft: 'ft', feet: 'ft', foot: 'ft', m: 'm', metre: 'm', metres: 'm', meter: 'm', meters: 'm',
  mph: 'mph', 'mi/h': 'mph', 'km/h': 'km/h', kph: 'km/h', kmh: 'km/h', 'km/hr': 'km/h',
};
const NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?$/;
const toNum = (s) => Number(String(s).replace(/,/g, ''));

// A quantity in a unit-specific parameter (height_ft, speed_km/h, ...).
function parseQuantity(text, unit) {
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

function parseGforce(text) {
  let m = /^(\d+(?:\.\d+)?)\s*(?:g|gs|g's|gees|g-force)?$/i.exec(text);
  if (!m) m = /^\{\{\s*val\s*\|\s*(\d+(?:\.\d+)?)\s*(?:\|\s*(?:u|ul)\s*=\s*(?:g|g0|gn|\[\[g-force\|g\]\])\s*)?\}\}$/i.exec(text);
  if (m) return { ok: true, n: Number(m[1]) };
  return { ok: false, reason: 'not a single figure in g (a range, negative and positive values, or a note)' };
}

function parseAngle(text) {
  const m = /^(\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)?$/i.exec(text);
  return m ? { ok: true, n: Number(m[1]) } : { ok: false, reason: 'not a single angle' };
}

function parseDuration(text) {
  const t = text.toLowerCase().replace(/\b(min|sec)\./g, '$1').replace(/\.$/, '');
  let m = /^(\d{1,2}):([0-5]\d)(?:\s*(?:min|mins|minutes))?$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]) * 60 + Number(m[2]) };
  m = /^(\d+)\s*(?:seconds?|secs?|s)$/.exec(t);
  if (m) return { ok: true, s: Number(m[1]) };
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
function parseDate(text) {
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
  if (v > today.slice(0, v.length)) return { ok: false, reason: 'date is in the future' };
  return { ok: true, v };
}

// manufacturer, designer, model: one plain name.
function parseText(text) {
  if (!text) return { ok: false, reason: 'empty' };
  if (/<br\s*\/?>|\{\{\s*(ubl|unbulleted list|plainlist|plain list|flatlist|hlist|bulleted list)\b|\n\s*\*/i.test(text)) return { ok: false, reason: 'several values' };
  const t = delink(text);
  if (/\{\{|\}\}|<|\[\[/.test(t)) return { ok: false, reason: 'contains markup the parser does not handle' };
  if (!t || /^(unknown|n\/a|none|tba|tbd|\?|-|–)$/i.test(t)) return { ok: false, reason: 'no value' };
  return { ok: true, v: t };
}

// The ride's place names from the infobox: link targets and texts, plain text, locationarticle.
function placeNames(params) {
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

function previousNames(params) {
  if (!params.previousnames) return [];
  const t = delink(clean(params.previousnames).text.replace(/<br\s*\/?>/gi, ',').replace(/\{\{\s*nowrap\s*\|([^{}]*)\}\}/gi, '$1'));
  return t.split(/\s*[,;]\s*/).map((x) => x.replace(/\([^)]*\)/g, '').replace(/''/g, '').trim()).filter((x) => x.length > 1);
}

// What a value's inline citation points at (contract rule 6), or undefined if unknown.
const OPERATOR_HOSTS = /sixflags|cedarfair|cedarpoint|kingsisland|kingsdominion|carowinds|canadaswonderland|knotts|worldsoffun|valleyfair|michigansadventure|dorneypark|californiasgreatamerica|buschgardens|seaworld|disney|universal|dollywood|hersheypark|kennywood|holidayworld|knoebels|silverdollarcity|lagoonpark|legoland|herschend|palaceentertainment|parquesreunidos|kentuckykingdom|lostislandthemepark|nickelodeonuniverse|americandream/;
const MAKER_HOSTS = /intamin|bolliger|vekoma|gerstlauer|mack-?rides|rockymtn|rockymountain|s-s\.com|s-sworldwide|premier-?rides|zamperla|gravitygroup|gci|greatcoasters|chancerides|skylineattractions|larson|zierer|maurer|schwarzkopf|arrow|morgan|b-and-m/;
// No inline <ref> does not mean uncited: the article body may cite the figure, so
// `cite` is left out rather than set to 'none'.
function citeKind(refs) {
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

const FT = 0.3048;
const MPH = 1.609344;
const r3 = (x) => Math.round(x * 1000) / 1000;
const RANGES = { height: [1, 200], drop: [1, 200], length: [20, 3000], speed: [5, 250], duration: [10, 600], gforce: [0.5, 6.5], inversions: [0, 14] };
const inRange = (f, v) => !RANGES[f] || (v >= RANGES[f][0] && v <= RANGES[f][1]);

// Parse one infobox. Returns { values: {field: {v, pub?, raw, param, cite?, prec?}}, issues: [...], extra: {angle, status} }.
function readInfobox(params, { qualifyEarlierRide = false } = {}) {
  const values = {};
  const issues = [];
  const extra = {};
  const take = (field, param, parsed, raw, build) => {
    if (!parsed.ok) { if (parsed.reason !== 'empty') issues.push({ field, param, raw: rawForm(raw), reason: parsed.reason }); return; }
    values[field] = { ...build(parsed), raw: rawForm(raw), param };
  };
  const earlierRideGuard = (field, param, raw, c) => {
    if (!qualifyEarlierRide) return false;
    if (c.footnote || /\(\s*(as|originally|formerly|until|before)\b/i.test(c.text) || /<br\s*\/?>/i.test(c.text)) {
      issues.push({ field, param, raw: rawForm(raw), reason: 'the article also covers an earlier ride, and this value is footnoted or qualified; it may describe the earlier ride' });
      return true;
    }
    return false;
  };

  // Quantities: metric and imperial parameters. Both present: they must agree.
  const QTY = { height: ['height_ft', 'height_m'], drop: ['drop_ft', 'drop_m'], length: ['length_ft', 'length_m'], speed: ['speed_mph', 'speed_km/h'] };
  for (const [field, [impP, metP]] of Object.entries(QTY)) {
    const found = [];
    for (const param of [impP, metP]) {
      const raw = params[param];
      if (raw == null || !raw.trim()) continue;
      const c = clean(raw);
      if (!c.text) continue;
      if (earlierRideGuard(field, param, raw, c)) continue;
      const unit = param.endsWith('_ft') ? 'ft' : param.endsWith('_m') ? 'm' : param.endsWith('_mph') ? 'mph' : 'km/h';
      const q = parseQuantity(c.text, unit);
      if (!q.ok) { issues.push({ field, param, raw: rawForm(raw), reason: q.reason }); continue; }
      const f = unit === 'ft' ? FT : unit === 'mph' ? MPH : 1;
      found.push({ v: r3(q.n * f), pub: [q.n, unit], lo: (q.n - 0.5 * 10 ** -q.dec) * f, hi: (q.n + 0.5 * 10 ** -q.dec) * f, raw: rawForm(raw), param, cite: citeKind(c.refs) });
    }
    if (!found.length) continue;
    if (found.length === 2 && !overlaps(found[0], found[1])) {
      issues.push({ field, param: `${impP} / ${metP}`, raw: `${found[0].raw} / ${found[1].raw}`, reason: 'the imperial and metric parameters disagree' });
      continue;
    }
    const pick = found[0]; // imperial first: US parks publish imperial figures
    if (!inRange(field, pick.v)) { issues.push({ field, param: pick.param, raw: pick.raw, reason: `outside the plausible range for ${field}` }); continue; }
    values[field] = pick;
  }

  const simple = [
    ['inversions', 'inversions', parseInversions, (p) => ({ v: p.n })],
    ['gforce', 'gforce', parseGforce, (p) => ({ v: p.n })],
    ['duration', 'duration', parseDuration, (p) => ({ v: p.s, pub: [p.s, 's'] })],
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
    if (earlierRideGuard(field, param, raw, c)) continue;
    const parsed = parse(c.text);
    if (parsed.ok && 'n' in parsed && !inRange(field, parsed.n)) { issues.push({ field, param, raw: rawForm(raw), reason: `outside the plausible range for ${field}` }); continue; }
    if (parsed.ok && field === 'duration' && !inRange(field, parsed.s)) { issues.push({ field, param, raw: rawForm(raw), reason: 'outside the plausible range for duration' }); continue; }
    take(field, param, parsed, raw, (p) => ({ ...build(p), cite: ['manufacturer', 'designer', 'model'].includes(field) ? undefined : citeKind(c.refs) }));
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

  // Not in the contract (rule 3: ask before adding a field); kept in review.json.
  if (params.angle && clean(params.angle).text) {
    const a = parseAngle(clean(params.angle).text);
    extra.angle = a.ok ? { v: a.n, raw: rawForm(params.angle) } : { v: null, raw: rawForm(params.angle), reason: a.reason };
  }
  const status = delink(clean(params.status || params.Status || '').text);
  if (status) extra.status = status;
  return { values, issues, extra };
}

const overlaps = (a, b) => {
  const slack = 0.005 * Math.max(Math.abs(a.v), Math.abs(b.v));
  return a.lo - slack <= b.hi && b.lo - slack <= a.hi;
};

// ---------------------------------------------------------------------------
// Wikidata -> contract values
// ---------------------------------------------------------------------------

const WD_UNITS = { Q11573: ['m', 1], Q3710: ['ft', FT], Q180154: ['km/h', 1], Q211256: ['mph', MPH], Q11574: ['s', 1], Q7727: ['min', 60] };

function wikidataValues(M, w) {
  const values = {};
  const issues = [];
  const picks = M.picksFor(w);
  const stats = M.statsFor(w);
  for (const field of ['height', 'length', 'speed', 'duration']) {
    const p = picks[field];
    if (!p) continue;
    const st = p.st;
    const raw = `${st.amount} ${st.unitLabel || st.unit} (${p.pid}, ${String(st.rank).replace(/Rank$/, '').toLowerCase()} rank)`;
    if (p.conflict) { issues.push({ field, raw: p.all.map((v) => `${v.amount} ${v.unitLabel || ''}`.trim()).join('; '), reason: 'Wikidata holds conflicting values' }); continue; }
    const u = WD_UNITS[st.unit];
    if (!u) { issues.push({ field, raw, reason: 'unit outside m, ft, km/h, mph, s, min' }); continue; }
    const n = Number(st.amount);
    const dec = decimals(st.amount.replace(/^[+-]/, ''));
    let val;
    if (u[0] === 'min' || u[0] === 's') val = { v: Math.round(n * u[1]), pub: [Math.round(n * u[1]), 's'] };
    else val = { v: r3(n * u[1]), pub: [n, u[0]], lo: (n - 0.5 * 10 ** -dec) * u[1], hi: (n + 0.5 * 10 ** -dec) * u[1] };
    if (!inRange(field, val.v)) { issues.push({ field, raw, reason: `outside the plausible range for ${field}` }); continue; }
    values[field] = { ...val, raw };
  }
  if (stats.manufacturer?.length === 1) values.manufacturer = { v: stats.manufacturer[0], raw: stats.manufacturer[0] };
  else if (stats.manufacturer?.length > 1) issues.push({ field: 'manufacturer', raw: stats.manufacturer.join('; '), reason: 'several values' });
  if (stats.designer?.length === 1) values.designer = { v: stats.designer[0], raw: stats.designer[0] };
  else if (stats.designer?.length > 1) issues.push({ field: 'designer', raw: stats.designer.join('; '), reason: 'several values' });
  // No model from Wikidata: its P144 ("based on") names the theme or franchise
  // ("Batman", "The Muppets"), not the coaster model.
  // material from P186 or the P31 class; type from the other P31 classes.
  const classes = stats.type || [];
  const mats = new Set();
  for (const m of [...(stats.material || []), ...classes]) {
    if (/hybrid/i.test(m)) mats.add('hybrid');
    else if (/\bsteel\b/i.test(m)) mats.add('steel');
    else if (/\bwood(en)?\b/i.test(m)) mats.add('wood');
  }
  if (mats.size === 1) values.material = { v: [...mats][0], raw: [...(stats.material || []), ...classes].join('; ') };
  else if (mats.size > 1) issues.push({ field: 'material', raw: [...mats].join('; '), reason: 'Wikidata gives several materials' });
  const types = classes.filter((c) => !/^(steel|wooden|wood|hybrid) roller coaster$|^roller coaster$/i.test(c));
  if (types.length) values.type = { v: types, raw: types.join('; ') };
  for (const field of ['opened', 'closed']) {
    const p = picks[field];
    if (!p) continue;
    const raw = `${p.st.time} precision ${p.st.precision} (${p.pid})`;
    if (p.conflict) { issues.push({ field, raw: p.all.map((v) => v.time.slice(0, 10)).join('; '), reason: 'Wikidata holds conflicting values' }); continue; }
    if (stats[field] > today.slice(0, stats[field].length)) { issues.push({ field, raw, reason: 'date is in the future' }); continue; }
    values[field] = { v: stats[field], raw };
  }
  return { values, issues };
}

// ---------------------------------------------------------------------------
// Agreement between sources
// ---------------------------------------------------------------------------

const ORG_NOISE = /\b(inc|llc|ltd|gmbh|ag|bv|b v|corp|corporation|co|company|est|int|international|amusement|amusements|rides|ride|manufacturing|technologies|worldwide|group|and|the|of)\b/g;
const orgCore = (s) => norm(s).replace(ORG_NOISE, ' ').replace(/\s+/g, ' ').trim();

function agree(field, a, b) {
  if (['height', 'drop', 'length', 'speed'].includes(field)) return overlaps(a, b);
  if (field === 'duration' || field === 'inversions') return a.v === b.v;
  if (field === 'opened' || field === 'closed') {
    const n = Math.min(a.v.length, b.v.length);
    return a.v.slice(0, n) === b.v.slice(0, n);
  }
  if (field === 'material') return a.v === b.v;
  if (['manufacturer', 'designer', 'model'].includes(field)) {
    const [x, y] = [orgCore(a.v), orgCore(b.v)];
    if (!x || !y) return true;
    return x === y || x.split(' ')[0] === y.split(' ')[0] || compact(x).includes(compact(y)) || compact(y).includes(compact(x));
  }
  return true; // type: different vocabularies (Wikidata classes vs infobox type2/type3), never a conflict
}

// Which source supplies the value when both have it and agree.
const PREFER_WP = new Set(['height', 'drop', 'length', 'speed', 'duration', 'inversions', 'gforce', 'manufacturer', 'designer', 'model', 'type', 'material']);
function prefer(field, wdV, wpV) {
  if (field === 'opened' || field === 'closed') return wpV.v.length > wdV.v.length ? 'wp' : 'wd';
  return PREFER_WP.has(field) ? 'wp' : 'wd';
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build(wdRaw, wpRaw) {
  const db = loadDb();
  const M = matchWikidata(wdRaw, db);
  const wpRetrieved = wpRaw.retrieved.slice(0, 10);
  const overrides = existsSync(OUT('overrides.json')) ? JSON.parse(readFileSync(OUT('overrides.json'), 'utf8')) : { choices: {} };

  // --- Wikipedia pages and infoboxes -------------------------------------------
  const pages = new Map();
  for (const [title, p] of Object.entries(wpRaw.pages)) {
    const boxes = p.infoboxes.map((text, index) => {
      const params = splitParams(text);
      const boxName = delink(clean(params.name || '').text) || title.replace(/\s*\([^)]*\)\s*$/, '');
      return { index, params, name: boxName, places: placeNames(params), previous: previousNames(params) };
    });
    pages.set(title, { title, ...p, boxes });
  }
  const pageFor = (t) => (t ? pages.get(resolveTitle(t, wpRaw.redirects)) : null);
  const coastersAt = new Map(db.parks.map((p) => [p, M.coasters.filter((c) => c.park === p)]));

  // Park evidence from an infobox: 'exact' (a place name equals the park name or a
  // park key), 'loose' (one contains the other's distinctive core), or null.
  const parkCores = (name) => {
    const cores = new Set([compact(name), compact(String(name).split(/\s+(?:&|and|at)\s+/i)[0])]);
    const m = /^\S+['’]s\s+(.+)$/.exec(String(name));
    if (m) cores.add(compact(m[1]));
    return [...cores].filter((c) => c.length >= 8);
  };
  function boxParkEvidence(box, park) {
    const local = new Set(parkKeys(park.name));
    if (box.places.some((n) => parkKeys(n.replace(/\s*\([^)]*\)\s*$/, '')).some((k) => local.has(k)))) {
      // A disambiguator naming another state ("Adventureland (New York)") rules the park out.
      const states = box.places.flatMap((n) => Object.entries(STATE_NAMES).filter(([, s]) => new RegExp(`\\b${s}\\b`).test(n)).map(([code]) => code));
      if (states.length && !states.includes(park.state)) return null;
      return 'exact';
    }
    const cores = parkCores(park.name);
    if (box.places.some((n) => cores.some((c) => compact(n).length >= 8 && (compact(n).includes(c) || c.includes(compact(n)))))) return 'loose';
    // The park's name without generic words starts the other ("Waldameer Park" / "Waldameer & Water World").
    const stripped = (n) => parkKeys(n).at(-1);
    const mine = stripped(park.name);
    if (mine && mine.length >= 6 && box.places.some((n) => { const o = stripped(n); return o && o.length >= 6 && (o.startsWith(mine) || mine.startsWith(o)); })) return 'loose';
    return null;
  }
  const nameMatch = (box, page, c) => {
    const local = new Set(nameKeys(c.name));
    const titleBase = page.title.replace(/\s*\([^)]*\)\s*$/, '');
    if ([box.name, titleBase].some((n) => nameKeys(n).some((k) => local.has(k)))) return 'name';
    if (box.previous.some((n) => nameKeys(n).some((k) => local.has(k)))) return 'previous';
    const [x, y] = [compact(box.name), compact(c.name)];
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    if (short.length >= 6 && (long.startsWith(short) || long.endsWith(short))) return 'partial';
    return null;
  };
  // Another local coaster at the same park that the infobox lists as a previous name.
  const earlierRides = (box, c) => coastersAt.get(c.park).filter((o) => o !== c
    && box.previous.some((n) => nameKeys(n).some((k) => nameKeys(o.name).includes(k)))
    && !nameKeys(box.name).some((k) => nameKeys(o.name).includes(k)));

  const wpLinks = new Map(); // coasterId -> { page, box, via, note, earlier }
  const ambiguous = [...M.ambiguous];
  const usedBoxes = new Set();
  const boxKey = (page, box) => `${page.title}#${box.index}`;
  const flagWp = (entry) => ambiguous.push({ source: 'wikipedia', ...entry });
  const boxSummary = (page, box) => ({ article: page.title, revid: page.revid, infoboxName: box.name, infoboxLocation: box.places[0] || null, previousNames: box.previous });

  // Stage 1: coasters linked to Wikidata, through the item's English Wikipedia sitelink.
  for (const [id, link] of Object.entries(M.links)) {
    const c = M.coasterById.get(id);
    const w = M.wdByQid.get(link.qid);
    const page = pageFor(w.article);
    if (!page || !page.boxes.length) continue;
    const atPark = page.boxes.filter((b) => boxParkEvidence(b, c.park));
    let box = null;
    if (atPark.length === 1) box = atPark[0];
    else if (page.boxes.length === 1 && !page.boxes[0].places.length) box = page.boxes[0];
    if (!box) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, qid: w.qid, ...boxSummary(page, page.boxes[0]),
        reason: atPark.length ? 'The article has several infoboxes at this park.' : `The infobox location (${page.boxes.map((b) => b.places[0] || '–').join('; ')}) does not name this park.` });
      continue;
    }
    const how = nameMatch(box, page, c) || (nameKeys(w.label).some((k) => nameKeys(box.name).includes(k)) ? 'name' : null);
    if (how === 'previous') {
      const successor = coastersAt.get(c.park).find((o) => o !== c && nameMatch(box, page, o) === 'name');
      flagWp({ coasterId: id, name: c.name, park: c.park.name, qid: w.qid, ...boxSummary(page, box),
        reason: successor
          ? `The article's infobox describes ${successor.name} (${successor.id}); this coaster is only a previous name in it, so its figures are not used here.`
          : 'This coaster matches only a previous name in the infobox (a rename or a rebuild). Decide whether the current figures describe this credit.' });
      usedBoxes.add(boxKey(page, box));
      continue;
    }
    if (!how) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, qid: w.qid, ...boxSummary(page, box), reason: 'The infobox name does not match this coaster.' });
      continue;
    }
    usedBoxes.add(boxKey(page, box));
    wpLinks.set(id, { page, box, via: 'wikidata-sitelink', note: how === 'partial' ? `Partial name match: infobox "${box.name}", local "${c.name}".` : null, earlier: earlierRides(box, c) });
  }

  // Stage 2: every other infobox, matched by its exact park and exact name. Only
  // unique, exact matches are accepted; near misses go to ambiguous.json.
  const proposals = new Map(); // coasterId -> [{page, box}]
  const boxProposals = new Map(); // boxKey -> [coaster]
  for (const page of pages.values()) {
    for (const box of page.boxes) {
      if (usedBoxes.has(boxKey(page, box))) continue;
      for (const park of db.parks) {
        const ev = boxParkEvidence(box, park);
        if (!ev) continue;
        for (const c of coastersAt.get(park)) {
          const how = nameMatch(box, page, c);
          if (!how) continue;
          if (ev === 'exact' && how === 'name') {
            if (!proposals.has(c.id)) proposals.set(c.id, []);
            proposals.get(c.id).push({ page, box });
            if (!boxProposals.has(boxKey(page, box))) boxProposals.set(boxKey(page, box), []);
            boxProposals.get(boxKey(page, box)).push(c);
          } else if (!wpLinks.has(c.id)) {
            const successor = how === 'previous' && coastersAt.get(park).find((o) => o !== c && nameMatch(box, page, o) === 'name');
            flagWp({ coasterId: c.id, name: c.name, park: park.name, ...boxSummary(page, box),
              reason: how === 'previous'
                ? (successor
                  ? `Only a previous name in the infobox of ${successor.name} (${successor.id}), which js/data.js keeps as a separate credit; its figures are not used for this coaster.`
                  : 'Matches only a previous name in the infobox (a rename, rebuild, or relocation). A person decides whether the figures describe this credit.')
                : how === 'partial' ? 'Name matches only in part (sponsor prefix, subtitle, or a different ride with a similar name).'
                  : `The infobox location ("${box.places[0]}") only loosely matches the park name "${park.name}".` });
          }
        }
      }
    }
  }
  for (const [id, list] of proposals) {
    const c = M.coasterById.get(id);
    if (wpLinks.has(id)) continue;
    const link = M.links[id];
    const linkedArticle = link && pageFor(M.wdByQid.get(link.qid).article);
    if (linkedArticle) continue; // stage 1 already decided this coaster's article (or flagged it)
    if (list.length > 1) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, reason: 'Several Wikipedia infoboxes match this coaster.', candidates: list.map(({ page, box }) => boxSummary(page, box)) });
      continue;
    }
    const { page, box } = list[0];
    const rivals = boxProposals.get(boxKey(page, box));
    if (rivals.length > 1) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, ...boxSummary(page, box), reason: `This infobox matches several local coasters (${rivals.map((r) => r.id).join(', ')}).` });
      continue;
    }
    const wdAmbiguous = ambiguous.some((a) => a.source === 'wikidata' && (a.coasterId === id || a.candidates?.some((x) => x.coasterId === id)));
    wpLinks.set(id, { page, box, via: 'infobox-match', note: wdAmbiguous ? 'Wikidata was ambiguous for this coaster; the Wikipedia infobox name and park match it exactly.' : null, earlier: earlierRides(box, c) });
  }

  // --- merge ------------------------------------------------------------------------
  const FIELDS = ['height', 'drop', 'length', 'speed', 'inversions', 'gforce', 'duration', 'manufacturer', 'designer', 'model', 'material', 'type', 'opened', 'closed'];
  const stats = {};
  const conflicts = [];
  const unparsed = [];
  const extras = {};
  const before = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const after = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const fromWp = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const ids = [...new Set([...Object.keys(M.links), ...wpLinks.keys()])].sort();
  const linkOut = {};
  for (const id of ids) {
    const c = M.coasterById.get(id);
    const wdLink = M.links[id];
    const w = wdLink && M.wdByQid.get(wdLink.qid);
    const wdv = w ? wikidataValues(M, w) : { values: {}, issues: [] };
    const wpl = wpLinks.get(id);
    const wpv = wpl ? readInfobox(wpl.box.params, { qualifyEarlierRide: wpl.earlier.length > 0 }) : { values: {}, issues: [], extra: {} };
    for (const i of wdv.issues) unparsed.push({ coasterId: id, source: 'wd', qid: w.qid, ...i });
    for (const i of wpv.issues) unparsed.push({ coasterId: id, source: 'wp', article: wpl.page.title, revid: wpl.page.revid, ...i });
    if (wpl && Object.keys(wpv.extra).length) extras[id] = { article: wpl.page.title, revid: wpl.page.revid, ...wpv.extra };

    const entry = { refs: {} };
    for (const f of FIELDS) {
      const a = wdv.values[f];
      const b = wpv.values[f];
      if (a) before[f]++;
      let chosen = null;
      if (a && b) {
        const choice = overrides.choices?.[id]?.[f]?.src;
        if (!agree(f, a, b) && !choice) {
          conflicts.push({ coasterId: id, name: c.name, field: f,
            wd: { qid: w.qid, v: a.v, pub: a.pub, raw: a.raw },
            wp: { article: wpl.page.title, revid: wpl.page.revid, param: b.param, v: b.v, pub: b.pub, raw: b.raw, cite: b.cite },
            hint: wdLink.evidence.nameVia !== 'label' ? `The Wikidata link came through ${wdLink.evidence.nameVia} ("${w.label}"); the infobox is named "${wpl.box.name}". Prefer the source that describes this ride.` : undefined });
          continue;
        }
        chosen = choice ? (choice === 'wp' ? ['wp', b] : ['wd', a]) : (prefer(f, a, b) === 'wp' ? ['wp', b] : ['wd', a]);
      } else if (a) chosen = ['wd', a];
      else if (b) chosen = ['wp', b];
      if (!chosen) continue;
      const [src, val] = chosen;
      const out = { v: val.v };
      if (val.pub) out.pub = val.pub;
      out.src = src;
      if (src === 'wp' && val.cite) out.cite = val.cite;
      entry[f] = out;
      after[f]++;
      if (src === 'wp' && !a) fromWp[f]++;
    }
    const used = new Set(FIELDS.filter((f) => entry[f]).map((f) => entry[f].src));
    if (used.has('wd')) entry.refs.wd = { qid: w.qid, retrieved: M.retrieved };
    if (used.has('wp')) entry.refs.wp = { lang: 'en', title: wpl.page.title, revid: wpl.page.revid, retrieved: wpRetrieved };
    if (used.size) stats[id] = entry;

    linkOut[id] = {
      ...(wdLink ? { qid: wdLink.qid, confidence: wdLink.confidence, evidence: wdLink.evidence, ...(wdLink.notes ? { notes: wdLink.notes } : {}) } : {}),
      ...(wpl ? { wikipedia: {
        title: wpl.page.title, revid: wpl.page.revid, via: wpl.via, infoboxName: wpl.box.name,
        infoboxLocation: wpl.box.places[0] || null,
        ...(wpl.via === 'infobox-match' ? { confidence: 'high' } : {}),
        ...(wpl.note ? { note: wpl.note } : {}),
        ...(wpl.earlier.length ? { alsoCovers: wpl.earlier.map((o) => o.id), alsoCoversNote: 'The article also covers an earlier ride that js/data.js keeps as a separate credit. Its figures go only to this coaster, and footnoted or qualified values are dropped.' } : {}),
      } } : {}),
    };
  }

  // --- write outputs -----------------------------------------------------------------
  const statsFile = {
    schema: 1,
    license: 'CC-BY-SA-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    notice: LICENSE_NOTICE,
    generated: today,
    coasters: stats,
  };
  // One coaster per line: small, and diffs stay readable.
  const statsText = `{\n${Object.entries(statsFile).filter(([k]) => k !== 'coasters').map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n "coasters": {\n${Object.entries(stats).map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e)}`).join(',\n')}\n }\n}\n`;
  writeFileSync(OUT('stats.json'), statsText);
  writeFileSync(OUT('links.json'), JSON.stringify({
    retrieved: { wikidata: M.retrieved, wikipedia: wpRetrieved },
    method: 'Wikidata: name (label, en-Wikipedia title, or alias) plus location evidence; see README. Wikipedia: the Wikidata item\'s English sitelink, using the infobox at this park; or, for coasters without one, an infobox whose location names this park exactly and whose name (or article title) equals this coaster\'s name, unique on both sides. Everything else is in ambiguous.json.',
    links: linkOut,
  }, null, 1) + '\n');
  writeFileSync(OUT('ambiguous.json'), JSON.stringify({
    retrieved: { wikidata: M.retrieved, wikipedia: wpRetrieved },
    count: ambiguous.length,
    bySource: { wikidata: ambiguous.filter((a) => a.source === 'wikidata').length, wikipedia: ambiguous.filter((a) => a.source === 'wikipedia').length },
    items: ambiguous,
  }, null, 1) + '\n');
  writeFileSync(OUT('review.json'), JSON.stringify({
    note: 'Not shipped. conflicts: Wikidata and Wikipedia disagree beyond rounding, so neither value is in stats.json until overrides.json records a choice. unparsed: values left out because they did not parse cleanly or failed a check. extraFields: infobox values outside the contract (max vertical angle, status), kept for a decision on adding fields.',
    conflicts, unparsed, extraFields: extras,
  }, null, 1) + '\n');

  // --- coverage.md ---------------------------------------------------------------------
  const total = M.coasters.length;
  const pct = (n, d = total) => `${((100 * n) / d).toFixed(1)}%`;
  const statIds = Object.keys(stats);
  const count = (pred) => statIds.filter((id) => pred(stats[id])).length;
  const wdOnlyAny = ids.filter((id) => M.links[id] && ['height', 'speed', 'length'].some((f) => wikidataValues(M, M.wdByQid.get(M.links[id].qid)).values[f])).length;
  const wdOnlyAll = ids.filter((id) => M.links[id] && ['height', 'speed', 'length'].every((f) => wikidataValues(M, M.wdByQid.get(M.links[id].qid)).values[f])).length;
  const anyHSL = count((e) => ['height', 'speed', 'length'].some((f) => e[f]));
  const allHSL = count((e) => ['height', 'speed', 'length'].every((f) => e[f]));
  const conflictCount = (f) => conflicts.filter((x) => x.field === f).length;
  const LABELS = { height: 'Height', drop: 'Drop', length: 'Length', speed: 'Speed', inversions: 'Inversions', gforce: 'G-force', duration: 'Ride duration', manufacturer: 'Manufacturer', designer: 'Designer', model: 'Model', material: 'Material', type: 'Type', opened: 'Opening date', closed: 'Closing date' };
  const wpVia = { sitelink: [...wpLinks.values()].filter((l) => l.via === 'wikidata-sitelink').length, match: [...wpLinks.values()].filter((l) => l.via === 'infobox-match').length };
  const wpOnly = [...wpLinks.keys()].filter((id) => !M.links[id]);
  const gforceRows = statIds.filter((id) => stats[id].gforce);

  const cp = loadCedarPointOperating();
  const fmtQ = (e, f) => (e?.[f] ? `${e[f].pub ? `${e[f].pub[0]} ${e[f].pub[1]}` : e[f].v} (${e[f].src})` : '–');
  const cpRows = cp.map((id) => {
    const c = M.coasterById.get(id);
    const e = stats[id];
    const l = linkOut[id];
    const srcs = [l?.qid ? `[${l.qid}](https://www.wikidata.org/wiki/${l.qid})` : null, l?.wikipedia ? `[${l.wikipedia.title}](https://en.wikipedia.org/w/index.php?oldid=${l.wikipedia.revid})` : null].filter(Boolean).join('<br>') || 'none';
    const conf = conflicts.filter((x) => x.coasterId === id).map((x) => x.field);
    return `| ${c ? c.name : id} | ${srcs} | ${fmtQ(e, 'height')} | ${fmtQ(e, 'speed')} | ${fmtQ(e, 'length')} | ${fmtQ(e, 'inversions')} | ${fmtQ(e, 'gforce')} | ${e?.manufacturer ? `${e.manufacturer.v} (${e.manufacturer.src})` : '–'} | ${conf.length ? `conflict: ${conf.join(', ')}` : ''} |`;
  });
  const cpHas = (f) => cp.filter((id) => stats[id]?.[f]).length;
  const fmtVal = (x) => (x.pub ? `${x.pub[0]} ${x.pub[1]}` : Array.isArray(x.v) ? x.v.join(', ') : x.v);
  const conflictRows = conflicts.map((x) => `| ${x.name} (\`${x.coasterId}\`) | ${LABELS[x.field]} | ${fmtVal(x.wd)} ([${x.wd.qid}](https://www.wikidata.org/wiki/${x.wd.qid})) | ${fmtVal(x.wp)} ([${x.wp.article}](https://en.wikipedia.org/w/index.php?oldid=${x.wp.revid}), \`${x.wp.param}\`) |${x.hint ? ` ${x.hint}` : ''} |`);
  const unparsedBy = {};
  for (const u of unparsed) unparsedBy[`${u.source}|${u.field}|${u.reason}`] = (unparsedBy[`${u.source}|${u.field}|${u.reason}`] || 0) + 1;
  const wpAmb = ambiguous.filter((a) => a.source === 'wikipedia');
  const sizeKb = (Buffer.byteLength(statsText) / 1024).toFixed(1);

  const md = `# Coaster stats coverage (Wikidata + Wikipedia spike)

Generated by \`fetch-wikipedia.mjs\` on ${today}, from Wikidata data retrieved ${M.retrieved} (CC0) and English Wikipedia infoboxes retrieved ${wpRetrieved} (CC BY-SA 4.0, © Wikipedia contributors). Don't edit by hand.

## Summary

- Local coasters in \`js/data.js\`: **${total}** in ${db.parks.length} parks.
- Linked to Wikidata: **${Object.keys(M.links).length}** (${M.conf.high} high confidence, ${M.conf.medium} medium).
- Linked to a Wikipedia infobox: **${wpLinks.size}**: ${wpVia.sitelink} through the Wikidata item's sitelink, and ${wpVia.match} matched by the infobox's park and name (${wpOnly.length} of those have no Wikidata link).
- Coasters in \`stats.json\` (at least one value): **${statIds.length}** (${pct(statIds.length)}). File size ${sizeKb} KB (contract budget 256 KB).
- Conflicts between Wikidata and Wikipedia, left out of \`stats.json\`: **${conflicts.length}** values on ${new Set(conflicts.map((x) => x.coasterId)).size} coasters (listed below and in \`review.json\`).
- Values left out because they did not parse cleanly or failed a check: **${unparsed.length}** (\`review.json\`).
- Ambiguous, for human review: **${ambiguous.length}** (\`ambiguous.json\`: ${ambiguous.length - wpAmb.length} from Wikidata, ${wpAmb.length} from Wikipedia).

## Field coverage, before and after Wikipedia

Counts are over all ${total} local coasters. "Before" is Wikidata alone (the first spike, rerun on today's \`js/data.js\` with the contract's checks). "After" is \`stats.json\`. Conflicting values are in neither column.

| Field | Before (Wikidata) | After (merged) | % of all ${total} | Added by Wikipedia | Conflicts left out |
| --- | ---: | ---: | ---: | ---: | ---: |
${FIELDS.map((f) => `| ${LABELS[f]} | ${before[f]} | ${after[f]} | ${pct(after[f])} | ${fromWp[f]} | ${conflictCount(f)} |`).join('\n')}
| Any of height, speed, length | ${wdOnlyAny} | ${anyHSL} | ${pct(anyHSL)} | | |
| All three of height, speed, length | ${wdOnlyAll} | ${allHSL} | ${pct(allHSL)} | | |

"Before" counts a Wikidata value even where it later conflicts with Wikipedia, so a field can show fewer coasters after than before.

## G-force

Wikidata has no G-force property, so every G-force value comes from the infobox \`gforce\` parameter. **${gforceRows.length}** coasters have one (${pct(gforceRows.length)} of all). ${unparsed.filter((u) => u.field === 'gforce').length} more infobox values were left out because they were not a single figure in g (ranges, separate positive and negative values, or notes).

${gforceRows.length ? `| Coaster | G-force | Article | Cited to |\n| --- | ---: | --- | --- |\n${gforceRows.map((id) => `| ${M.coasterById.get(id).name} (\`${id}\`) | ${stats[id].gforce.v} | [${stats[id].refs.wp.title}](https://en.wikipedia.org/w/index.php?oldid=${stats[id].refs.wp.revid}) | ${stats[id].gforce.cite || 'unknown (named reference)'} |`).join('\n')}` : ''}

## Cedar Point (${cp.length} operating coasters)

From \`js/guides/cedar-point.js\` \`credits.operating\`. With values: height ${cpHas('height')}, speed ${cpHas('speed')}, length ${cpHas('length')}, inversions ${cpHas('inversions')}, G-force ${cpHas('gforce')}, manufacturer ${cpHas('manufacturer')} of ${cp.length}. Figures are shown as published, with the source (\`wd\` Wikidata, \`wp\` Wikipedia).

| Coaster | Sources | Height | Speed | Length | Inversions | G-force | Manufacturer | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${cpRows.join('\n')}

## Conflicts between Wikidata and Wikipedia

Each pair disagrees beyond rounding (the published figure's last digit, plus 0.5%). Neither value is in \`stats.json\`. To ship one, check the primary source either cites and record the choice in \`overrides.json\`.

| Coaster | Field | Wikidata | Wikipedia | Note |
| --- | --- | --- | --- | --- |
${conflictRows.join('\n') || '| – | – | – | – | – |'}

## Matched through Wikipedia only (no Wikidata link)

These ${wpOnly.length} coasters were matched by an infobox whose location names the park exactly and whose name equals the coaster's name, with no other candidate on either side.

${wpOnly.map((id) => `- \`${id}\`: [${wpLinks.get(id).page.title}](https://en.wikipedia.org/w/index.php?oldid=${wpLinks.get(id).page.revid})${wpLinks.get(id).note ? ` (${wpLinks.get(id).note})` : ''}`).join('\n') || '- None.'}

## Values left out (did not parse or failed a check)

| Source | Field | Reason | Count |
| --- | --- | --- | ---: |
${Object.entries(unparsedBy).sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [s, f, r] = k.split('|'); return `| ${s} | ${LABELS[f] || f} | ${r} | ${n} |`; }).join('\n')}

${M.unmatchedMd}`;
  writeFileSync(OUT('coverage.md'), md);

  console.log(`wikidata links ${Object.keys(M.links).length}, wikipedia links ${wpLinks.size} (${wpVia.sitelink} sitelink, ${wpVia.match} infobox match, ${wpOnly.length} wikipedia-only)`);
  console.log(`stats.json: ${statIds.length} coasters, ${sizeKb} KB; conflicts ${conflicts.length}; unparsed ${unparsed.length}; ambiguous ${ambiguous.length} (${wpAmb.length} wikipedia)`);
  for (const f of FIELDS) console.log(`  ${LABELS[f].padEnd(14)} before ${String(before[f]).padStart(4)}  after ${String(after[f]).padStart(4)}`);
}

// ---------------------------------------------------------------------------

export { extractInfoboxes, readInfobox, splitParams, clean, placeNames, previousNames, parseDate, parseDuration, parseQuantity, parseGforce, citeKind };

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const offline = process.argv.includes('--offline');
  if (!existsSync(WD_RAW_FILE)) throw new Error(`missing ${WD_RAW_FILE}; run fetch-wikidata.mjs first`);
  const wdRaw = JSON.parse(readFileSync(WD_RAW_FILE, 'utf8'));
  const wpRaw = offline ? JSON.parse(readFileSync(WP_RAW_FILE, 'utf8')) : await fetchAll(wdRaw, loadDb());
  build(wdRaw, wpRaw);
}
