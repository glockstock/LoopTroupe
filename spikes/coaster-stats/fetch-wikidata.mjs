#!/usr/bin/env node
// Spike: fetch open (CC0) roller coaster data from Wikidata and match items to
// Loop Troupe coaster IDs in js/data.js. Node 18+ (22.21+ behind a proxy), built-ins only.
//
//   node spikes/coaster-stats/fetch-wikidata.mjs     fetch from Wikidata into raw/wikidata-raw.json
//   node spikes/coaster-stats/fetch-wikipedia.mjs    then fetch Wikipedia and build every output
//
// Behind an HTTPS proxy, run with NODE_USE_ENV_PROXY=1 (Node's fetch ignores
// HTTPS_PROXY otherwise).
//
// This file is also a module: fetch-wikipedia.mjs imports matchWikidata() and the
// name/park helpers, so the Wikidata match and the Wikipedia merge run as one build.
// Reads js/data.js and js/guides/cedar-point.js only; never invents IDs.
// Source policy: Wikidata (CC0). RCDB IDs (P2751) found on Wikidata are used as
// a matching aid and nothing else; nothing is fetched from RCDB.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const OUT = (f) => path.join(HERE, f);
// Raw API responses are not committed (stats contract: raw/ is gitignored).
export const RAW_DIR = OUT('raw');
export const RAW_FILE = path.join(RAW_DIR, 'wikidata-raw.json');
const ENDPOINT = 'https://query.wikidata.org/sparql';
const USER_AGENT = 'LoopTroupe-data/0.1 (https://github.com/glockstock/LoopTroupe)';
// WDQS asks clients to stay well under its limits; during incidents it has
// throttled to 1 request per minute, so wait 65 s between the four queries.
const PAUSE_MS = 65_000;

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

// 1. The item set: instances of roller coaster (Q204832) or any subclass, in the
// United States (P17 = Q30), plus coasters with no country whose park (P361 part
// of / P276 location) is in the US. P31/P279* is fast here (about 1 s) because
// the subclass tree is small; the slow pattern to avoid is a transitive P131*.
const Q_ITEMS = `
SELECT DISTINCT ?item WHERE {
  { ?item wdt:P31/wdt:P279* wd:Q204832 ; wdt:P17 wd:Q30 . }
  UNION
  { ?item wdt:P31/wdt:P279* wd:Q204832 ; (wdt:P361|wdt:P276) ?park .
    ?park wdt:P17 wd:Q30 .
    FILTER NOT EXISTS { ?item wdt:P17 ?anyCountry } }
}`;

// 2. Item-valued and string claims (best rank only, via wdt:), one row per value,
// with labels of the values. Labels everywhere are English, falling back to
// "mul" (Wikidata's language-neutral label, which many items now carry instead). P31 classes double as the coaster model/type.
const CLAIM_PROPS = {
  P31: 'instance of', P361: 'part of', P276: 'location',
  P131: 'located in the administrative territorial entity', P176: 'manufacturer',
  P287: 'designed by', P186: 'made from material', P144: 'based on',
  P2751: 'Roller Coaster Database ID', P5817: 'state of use',
  P1398: 'structure replaces', P167: 'structure replaced by',
  P1365: 'replaces', P1366: 'replaced by', P17: 'country',
};
const qClaims = (values) => `
SELECT ?item ?pid ?val ?valLabel WHERE {
  VALUES ?item { ${values} }
  VALUES (?p ?pid) { ${Object.keys(CLAIM_PROPS).map((p) => `(wdt:${p} "${p}")`).join(' ')} }
  ?item ?p ?val .
  OPTIONAL { ?val rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?val rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  BIND(COALESCE(?en, ?mul) AS ?valLabel)
}`;

// 3. Quantities (with units) and dates (with precision), all non-deprecated
// statements with their rank, so the build can prefer preferred-rank values.
// Wikidata has no property for number of inversions or for G-force.
const VALUE_PROPS = {
  P2048: 'height', P2052: 'speed', P2043: 'length', P2047: 'duration',
  P1619: 'date of official opening', P580: 'start time', P571: 'inception',
  P3999: 'date of official closure', P582: 'end time', P576: 'dissolved, abolished or demolished',
};
const qValues = (values) => `
SELECT ?item ?pid ?rank ?amount ?unit ?unitLabel ?time ?precision WHERE {
  VALUES ?item { ${values} }
  VALUES (?p ?psv ?pid) { ${Object.keys(VALUE_PROPS).map((p) => `(p:${p} psv:${p} "${p}")`).join(' ')} }
  ?item ?p ?st . ?st ?psv ?v ; wikibase:rank ?rank .
  FILTER(?rank != wikibase:DeprecatedRank)
  OPTIONAL { ?v wikibase:quantityAmount ?amount ; wikibase:quantityUnit ?unit .
             OPTIONAL { ?unit rdfs:label ?unitLabel FILTER(LANG(?unitLabel) = "en") } }
  OPTIONAL { ?v wikibase:timeValue ?time ; wikibase:timePrecision ?precision . }
}`;

// 4. Label, aliases (English or "mul"), and English Wikipedia article title (matching aids).
const qLabels = (values) => `
SELECT ?item ?label ?alias ?article WHERE {
  VALUES ?item { ${values} }
  OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") }
  OPTIONAL { ?item rdfs:label ?mul FILTER(LANG(?mul) = "mul") }
  BIND(COALESCE(?en, ?mul) AS ?label)
  OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias) IN ("en", "mul")) }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
}`;

// 5. Location context: English description, the US state (ISO 3166-2 code via
// P300) reached from the item's P131/P276/P361 chain, and English aliases of the
// item's park (P361/P276), which carry former park names. The transitive P131*
// is only fast when evaluated from the ~635 known items upward; left to the
// optimizer it starts from the US states and times out, so the optimizer is off
// and the patterns run in the order written.
const qContext = (values) => `
SELECT ?item ?kind ?v WHERE {
  hint:Query hint:optimizer "None" .
  VALUES ?item { ${values} }
  { ?item schema:description ?v FILTER(LANG(?v) = "en") BIND("description" AS ?kind) }
  UNION
  { ?item (wdt:P131|wdt:P276|wdt:P361)/wdt:P131* ?state .
    ?state wdt:P31 wd:Q35657 ; wdt:P300 ?v . BIND("state" AS ?kind) }
  UNION
  { ?item (wdt:P361|wdt:P276) ?park . ?park skos:altLabel ?v FILTER(LANG(?v) IN ("en", "mul")) BIND("parkAlias" AS ?kind) }
}`;

async function sparql(query, label) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const started = Date.now();
    let res;
    let text;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/sparql-results+json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'query=' + encodeURIComponent(query),
      });
      text = await res.text();
    } catch (err) {
      // WDQS ends the stream when a query hits its 60 s limit; the proxy may reset too.
      console.log(`[${label}] network error after ${Date.now() - started} ms: ${err.cause?.code || err.message}`);
      await sleep(PAUSE_MS);
      continue;
    }
    console.log(`[${label}] HTTP ${res.status} in ${Date.now() - started} ms (attempt ${attempt})`);
    if (res.ok) return JSON.parse(text).results.bindings;
    const wait = Math.max(PAUSE_MS, (Number(res.headers.get('retry-after')) || 0) * 1000);
    console.log(`[${label}] ${text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 200)}`);
    if (res.status !== 429 && res.status < 500) throw new Error(`${label}: HTTP ${res.status}`);
    await sleep(wait);
  }
  throw new Error(`${label}: gave up after retries`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qid = (uri) => uri.slice(uri.lastIndexOf('/') + 1);
const lit = (b, k) => (b[k] ? b[k].value : null);

async function fetchAll() {
  const items = (await sparql(Q_ITEMS, 'items')).map((b) => qid(b.item.value));
  console.log(`items: ${items.length}`);
  const values = items.map((q) => `wd:${q}`).join(' ');
  await sleep(PAUSE_MS);
  const claims = (await sparql(qClaims(values), 'claims')).map((b) => ({
    item: qid(b.item.value), pid: b.pid.value,
    value: b.val.type === 'uri' && b.val.value.startsWith('http://www.wikidata.org/entity/Q') ? qid(b.val.value) : b.val.value,
    label: lit(b, 'valLabel'),
  }));
  await sleep(PAUSE_MS);
  const vals = (await sparql(qValues(values), 'values')).map((b) => ({
    item: qid(b.item.value), pid: b.pid.value, rank: lit(b, 'rank').split('#').pop(),
    amount: lit(b, 'amount'), unit: b.unit ? qid(b.unit.value) : null, unitLabel: lit(b, 'unitLabel'),
    time: lit(b, 'time'), precision: lit(b, 'precision') && Number(lit(b, 'precision')),
  }));
  await sleep(PAUSE_MS);
  const labels = (await sparql(qLabels(values), 'labels')).map((b) => ({
    item: qid(b.item.value), label: lit(b, 'label'), alias: lit(b, 'alias'),
    article: b.article ? decodeURIComponent(qid(b.article.value)).replace(/_/g, ' ') : null,
  }));
  await sleep(PAUSE_MS);
  const context = (await sparql(qContext(values), 'context')).map((b) => ({
    item: qid(b.item.value), kind: b.kind.value, value: b.v.value,
  }));
  const raw = {
    source: 'Wikidata (https://www.wikidata.org), CC0 1.0',
    endpoint: ENDPOINT,
    retrieved: new Date().toISOString(),
    queries: { items: Q_ITEMS, claims: qClaims('…'), values: qValues('…'), labels: qLabels('…'), context: qContext('…') },
    items, claims, values: vals, labels, context,
  };
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW_FILE, JSON.stringify(raw, null, 1) + '\n');
  console.log(`wrote ${path.relative(ROOT, RAW_FILE)}`);
  return raw;
}

// ---------------------------------------------------------------------------
// Local data (read-only)
// ---------------------------------------------------------------------------

export function loadDb() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(path.join(ROOT, 'js/data.js'), 'utf8') + '\n;this.__DB = COASTER_DB;', ctx);
  return ctx.__DB;
}

export function loadCedarPointOperating() {
  const file = path.join(ROOT, 'js/guides/cedar-point.js');
  if (!existsSync(file)) return [];
  const ctx = { window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(file, 'utf8'), ctx);
  return ctx.window.GUIDES?.['cedar-point']?.credits?.operating || [];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

// Lowercase, strip accents and apostrophes, '&' -> 'and', drop a leading "the",
// collapse punctuation to spaces.
export function norm(s) {
  return String(s || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[‘’'`´]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}
export const compact = (s) => norm(s).replace(/ /g, '');

// Name keys for a coaster name: full form, plus the form without a trailing
// "(…)" disambiguator (Wikipedia/Wikidata style, e.g. "Wildcat (Cedar Point)")
// and without a trailing "roller coaster".
export function nameKeys(s) {
  if (!s) return [];
  const keys = new Set();
  const base = String(s).replace(/\s*\([^)]*\)\s*$/, '');
  for (const v of [s, base]) {
    const c = compact(v);
    if (c) keys.add(c);
    const noRc = compact(norm(v).replace(/ (roller )?coaster$/, ''));
    if (noRc && noRc !== c && noRc.length >= 4) keys.add(noRc);
  }
  return [...keys];
}

// Park keys: the name, and the name without generic words, so "Kennywood Park"
// and "Kennywood" or "Hersheypark" and "Hershey Park" meet.
export const PARK_NOISE = /\b(amusement|theme|water|park|parks|resort|and|at|the|of)\b/g;
export function parkKeys(s) {
  if (!s) return [];
  const n = norm(s);
  const keys = new Set([n.replace(/ /g, '')]);
  const stripped = n.replace(PARK_NOISE, ' ').replace(/\s+/g, '').trim();
  if (stripped.length >= 4) keys.add(stripped);
  return [...keys];
}

// ---------------------------------------------------------------------------
// Units and dates
// ---------------------------------------------------------------------------

const LENGTH_UNITS = { Q11573: 1, Q3710: 0.3048, Q828224: 1000, Q174728: 0.01, Q482798: 0.9144, Q253276: 1609.344 };
const SPEED_UNITS = { Q180154: 1, Q211256: 1.609344, Q182429: 3.6, Q128822: 1.852 };
const TIME_UNITS = { Q11574: 1, Q7727: 60 };
const IMPERIAL_LENGTH = new Set(['Q3710', 'Q482798', 'Q253276']);
export const STATE_NAMES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia' };
// Local parks that straddle a state line; Wikidata may place their rides in either state.
const BORDER_PARKS = { carowinds: ['NC', 'SC'] };
export const parkStates = (park) => BORDER_PARKS[park.id] || [park.state];
const round = (x, d = 0) => Math.round(x * 10 ** d) / 10 ** d;

function lengthValue(v) {
  const f = LENGTH_UNITS[v.unit];
  if (f == null) return null;
  const amount = Number(v.amount);
  if (v.unit === 'Q3710') return { m: round(amount * 0.3048, 1), ft: round(amount, 1) };
  const m = amount * f;
  return { m: IMPERIAL_LENGTH.has(v.unit) ? round(m, 1) : round(m, 2), ft: round(m / 0.3048, 0) };
}
function speedValue(v) {
  const f = SPEED_UNITS[v.unit];
  if (f == null) return null;
  const amount = Number(v.amount);
  if (v.unit === 'Q211256') return { kmh: round(amount * 1.609344, 1), mph: round(amount, 1) };
  const kmh = amount * f;
  return { kmh: round(kmh, 1), mph: round(kmh / 1.609344, 1) };
}
function durationValue(v) {
  const f = TIME_UNITS[v.unit];
  return f == null ? null : { s: round(Number(v.amount) * f, 0) };
}
// Wikidata time precision: 9 = year, 10 = month, 11 = day.
function dateValue(v) {
  if (!v.time) return null;
  const m = /^(-?\d{4})-(\d{2})-(\d{2})/.exec(v.time);
  if (!m) return null;
  if (v.precision >= 11) return `${m[1]}-${m[2]}-${m[3]}`;
  if (v.precision === 10) return `${m[1]}-${m[2]}`;
  if (v.precision === 9) return m[1];
  return null;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function groupBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

export function matchWikidata(raw, db = loadDb()) {
  const retrieved = raw.retrieved.slice(0, 10);
  const issueSet = new Set(); // Wikidata data-quality notes
  const issues = { push: (m) => issueSet.add(m) };

  // --- local index ---------------------------------------------------------
  const coasters = [];
  for (const p of db.parks) for (const c of p.coasters) coasters.push({ ...c, park: p });
  const coasterById = new Map(coasters.map((c) => [c.id, c]));
  const byNameKey = new Map();
  for (const c of coasters) {
    for (const k of nameKeys(c.name)) {
      if (!byNameKey.has(k)) byNameKey.set(k, []);
      byNameKey.get(k).push(c);
    }
  }

  // --- Wikidata records ----------------------------------------------------
  const claimsBy = groupBy(raw.claims, 'item');
  const valuesBy = groupBy(raw.values, 'item');
  const labelsBy = groupBy(raw.labels, 'item');
  const contextBy = groupBy(raw.context || [], 'item');
  const wd = raw.items.map((q) => {
    const claims = claimsBy.get(q) || [];
    const vals = valuesBy.get(q) || [];
    const labs = labelsBy.get(q) || [];
    const ctx = contextBy.get(q) || [];
    const ofKind = (k) => [...new Set(ctx.filter((x) => x.kind === k).map((x) => x.value))];
    const ofP = (pid) => claims.filter((c) => c.pid === pid);
    return {
      qid: q,
      label: labs.find((l) => l.label)?.label || null,
      aliases: [...new Set(labs.map((l) => l.alias).filter(Boolean))],
      article: labs.find((l) => l.article)?.article || null,
      parks: [...ofP('P361'), ...ofP('P276')].map((c) => ({ qid: c.value, label: c.label })),
      admin: ofP('P131').map((c) => c.label).filter(Boolean),
      classes: ofP('P31').map((c) => ({ qid: c.value, label: c.label })),
      manufacturer: [...new Set(ofP('P176').map((c) => c.label).filter(Boolean))],
      designer: [...new Set(ofP('P287').map((c) => c.label).filter(Boolean))],
      material: [...new Set(ofP('P186').map((c) => c.label).filter(Boolean))],
      basedOn: [...new Set(ofP('P144').map((c) => c.label).filter(Boolean))],
      status: ofP('P5817').map((c) => c.label).filter(Boolean)[0] || null,
      rcdb: [...new Set(ofP('P2751').map((c) => c.value))],
      description: ofKind('description')[0] || null,
      states: ofKind('state').map((v) => v.replace(/^US-/, '')),
      parkAliases: ofKind('parkAlias'),
      vals,
    };
  });

  const unlabeled = wd.filter((w) => !w.label);
  if (unlabeled.length) issues.push(`${unlabeled.length} items have no English or "mul" label (${unlabeled.map((w) => w.qid).join(', ')}); they can only match through an article title or alias.`);

  // Duplicate RCDB IDs across Wikidata items (matching aid only).
  const rcdbSeen = new Map();
  for (const w of wd) for (const r of w.rcdb) {
    if (!rcdbSeen.has(r)) rcdbSeen.set(r, []);
    rcdbSeen.get(r).push(w.qid);
  }
  for (const [r, qs] of rcdbSeen) if (qs.length > 1) issues.push(`Wikidata items ${qs.join(', ')} share one RCDB ID (${r}); possible duplicate items.`);

  // --- per-item stats -------------------------------------------------------
  // Choose one value per field. Preferred-rank statements win. Values that agree
  // within 2% (the same figure stored in two units) are not a conflict; the
  // imperial one is kept because US parks publish imperial figures. Real
  // disagreements are reported and the first value (in a stable order) is kept.
  const IMPERIAL = new Set(['Q3710', 'Q211256']);
  const canon = (o) => (typeof o === 'string' ? o : o.m ?? o.kmh ?? o.s);
  function pick(w, pids, conv, field, order = 'asc') {
    for (const pid of pids) {
      const rows = w.vals.filter((v) => v.pid === pid);
      if (!rows.length) continue;
      const preferred = rows.filter((v) => String(v.rank).endsWith('PreferredRank'));
      const pool = preferred.length ? preferred : rows;
      if (preferred.length && preferred.length < rows.length) {
        const p0 = conv(preferred[0]);
        const off = rows.filter((v) => !preferred.includes(v)).map((v) => ({ v, out: conv(v) }))
          .filter((x) => x.out && p0 && typeof canon(p0) === 'number' && Math.abs(canon(x.out) - canon(p0)) > 0.02 * canon(p0));
        if (off.length) issues.push(`${w.qid} (${w.label}): preferred ${field} ${preferred[0].amount} ${preferred[0].unitLabel || ''} kept; a normal-rank value disagrees (${off.map((x) => `${x.v.amount} ${x.v.unitLabel || ''}`.trim()).join('; ')}).`);
      }
      const converted = [];
      for (const v of pool) {
        const out = conv(v);
        if (out) converted.push({ out, v });
        else if (v.amount != null) issues.push(`${w.qid} (${w.label}): ${field} ${v.amount} has unit "${v.unitLabel || v.unit}" that cannot be converted; skipped.`);
      }
      if (!converted.length) continue;
      converted.sort((x, y) => (canon(x.out) < canon(y.out) ? -1 : canon(x.out) > canon(y.out) ? 1 : 0) * (order === 'desc' ? -1 : 1));
      const first = converted[0];
      const agrees = (c) => (typeof canon(c.out) === 'string' ? canon(c.out) === canon(first.out)
        : Math.abs(canon(c.out) - canon(first.out)) <= 0.02 * Math.abs(canon(first.out)));
      if (!converted.every(agrees)) {
        issues.push(`${w.qid} (${w.label}): conflicting ${field} values (${converted.map((c) => `${c.v.amount ?? c.v.time.slice(0, 10)} ${c.v.unitLabel || ''}`.trim()).join('; ')}); kept ${order === 'desc' ? 'the latest/largest' : 'the earliest/smallest'}.`);
        return { value: first.out, pid, conflict: true, st: first.v, all: converted.map((c) => c.v) };
      }
      const imperial = converted.find((c) => IMPERIAL.has(c.v.unit));
      return { value: (imperial || first).out, pid, st: (imperial || first).v };
    }
    return null;
  }
  const statsCache = new Map();
  const picksCache = new Map(); // qid -> { field: pick result } (the chosen statement, for provenance)
  function statsFor(w) {
    if (!statsCache.has(w.qid)) statsCache.set(w.qid, computeStats(w));
    return statsCache.get(w.qid);
  }
  function picksFor(w) {
    statsFor(w);
    return picksCache.get(w.qid);
  }
  function computeStats(w) {
    const s = {};
    const picks = {};
    picksCache.set(w.qid, picks);
    const h = pick(w, ['P2048'], lengthValue, 'height');
    if (h) { s.height = h.value; picks.height = h; }
    const sp = pick(w, ['P2052'], speedValue, 'speed');
    if (sp) { s.speed = sp.value; picks.speed = sp; }
    const l = pick(w, ['P2043'], lengthValue, 'length');
    if (l) { s.length = l.value; picks.length = l; }
    const d = pick(w, ['P2047'], durationValue, 'duration');
    if (d) { s.duration = d.value; picks.duration = d; }
    s.inversions = null; // no Wikidata property exists for this
    if (w.manufacturer.length) s.manufacturer = w.manufacturer;
    if (w.designer.length) s.designer = w.designer;
    const types = w.classes.filter((c) => c.qid !== 'Q204832').map((c) => c.label).filter(Boolean);
    if (types.length) s.type = types;
    if (w.material.length) s.material = w.material;
    if (w.basedOn.length) s.model = w.basedOn;
    const o = pick(w, ['P1619', 'P580', 'P571'], dateValue, 'opening date');
    if (o) { s.opened = o.value; picks.opened = o; }
    const c = pick(w, ['P3999', 'P582', 'P576'], dateValue, 'closing date', 'desc');
    if (c) { s.closed = c.value; picks.closed = c; }
    if (w.status) s.status = w.status;
    return s;
  }

  // --- matching -------------------------------------------------------------
  // Name evidence: the Wikidata label or the en-Wikipedia title ("label"), or an
  // English alias such as a former name ("alias").
  // Location evidence for a local candidate, strongest first:
  //   park     the item's park (P361/P276, their aliases, a P131 that is a park, or
  //            the article title's "(…)" disambiguator) or its description names the local park;
  //   city     a P131 label equals the local park's city;
  //   state    the item's US state (via P131/P276/P361) equals the local park's state;
  //   conflict the item is in another state, or its park is a different local park.
  const parksByKey = new Map();
  for (const p of db.parks) for (const k of parkKeys(p.name)) {
    if (!parksByKey.has(k)) parksByKey.set(k, new Set());
    parksByKey.get(k).add(p);
  }
  function wdPlaceNames(w) {
    const names = [...w.parks.map((p) => p.label), ...w.parkAliases, ...w.admin];
    const m = /\(([^)]+)\)\s*$/.exec(w.article || '');
    if (m) names.push(m[1]);
    return names.filter(Boolean);
  }
  // Distinctive cores of a local park name, for substring tests: the whole name,
  // the part before "&"/"and"/"at" ("Holiday World"), and the name without a
  // possessive brand ("Magic Kingdom" from "Disney's Magic Kingdom"). Short cores
  // are skipped so generic words never match.
  function parkCores(name) {
    const cores = new Set([compact(name)]);
    const first = String(name).split(/\s+(?:&|and|at)\s+/i)[0];
    cores.add(compact(first));
    const m = /^\S+['\u2019]s\s+(.+)$/.exec(String(name));
    if (m) cores.add(compact(m[1]));
    return [...cores].filter((c) => c.length >= 10);
  }
  const contains = (a, b) => a.length >= 8 && b.length >= 8 && (a.includes(b) || b.includes(a));
  function locationEvidence(w, park) {
    const local = new Set(parkKeys(park.name));
    const names = wdPlaceNames(w);
    // 1. Exact park name (or alias) on Wikidata.
    if (names.some((n) => parkKeys(n).some((k) => local.has(k)))) return 'park';
    // 2. The description names the local park.
    const desc = compact(w.description);
    const cores = parkCores(park.name);
    if (desc && cores.some((c) => desc.includes(c))) return 'park';
    // 3. Wrong state.
    const stateOk = parkStates(park).some((st) => w.states.includes(st));
    if (w.states.length && !stateOk) return 'conflict';
    // 4. A Wikidata park name contains, or is contained in, the local park name
    //    (e.g. "Six Flags Darien Lake" / "Darien Lake"), within the right state.
    if (names.some((n) => cores.concat(compact(park.name)).some((c) => contains(compact(n), c)))) return 'park';
    // 5. City: a P131 label, or "City, State" in the description.
    if (w.admin.some((a) => norm(a) === norm(park.city))) return 'city';
    if (desc && desc.includes(compact(`${park.city} ${STATE_NAMES[park.state] || park.state}`))) return 'city';
    // 6. The Wikidata park is a different local park.
    const otherLocal = names.some((n) => parkKeys(n).some((k) => [...(parksByKey.get(k) || [])].some((p) => p !== park)));
    if (otherLocal) return 'conflict';
    if (stateOk) return 'state';
    return null;
  }

  const proposals = []; // { w, c, nameVia, parkVia }
  for (const w of wd) {
    const byLabel = new Set(nameKeys(w.label));
    const byArticle = new Set(nameKeys(w.article).filter((k) => !byLabel.has(k)));
    const weak = new Set(w.aliases.flatMap(nameKeys).filter((k) => !byLabel.has(k) && !byArticle.has(k)));
    const seen = new Set();
    for (const [keys, via] of [[byLabel, 'label'], [byArticle, 'article'], [weak, 'alias']]) {
      for (const k of keys) for (const c of byNameKey.get(k) || []) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        proposals.push({ w, c, nameVia: via, parkVia: locationEvidence(w, c.park) });
      }
    }
  }

  // Partial names, only inside a park that the item names exactly: a sponsor
  // prefix or subtitle ("Pepsi Orange Streak" / "Orange Streak", "Powder Keg: A
  // Blast into the Wilderness" / "Powder Keg"). The shorter name needs 8+ characters.
  const matched = new Set(proposals.map((p) => p.w));
  const partialName = (a, b) => {
    const [x, y] = [compact(a), compact(b)];
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    if (short.length >= 8 && (long.startsWith(short) || long.endsWith(short))) return true;
    const head = (n) => compact(String(n).split(/\s*[:\u2013\u2014]\s+|\s+-\s+/)[0]);
    return head(a).length >= 4 && head(a) === head(b);
  };
  for (const w of wd) {
    if (matched.has(w)) continue;
    const names = [w.label, w.article && w.article.replace(/\s*\([^)]*\)\s*$/, ''), ...w.aliases].filter(Boolean);
    if (!names.length) continue;
    for (const park of db.parks) {
      if (locationEvidence(w, park) !== 'park') continue;
      for (const c of park.coasters) {
        if (names.some((n) => partialName(n, c.name))) proposals.push({ w, c: coasterById.get(c.id), nameVia: 'partial', parkVia: 'park' });
      }
    }
  }

  const links = {};
  const ambiguous = [];
  const linkedQids = new Set();
  const ambiguousQids = new Set();
  const propsByQid = groupBy(proposals, 'w');
  const wdSummary = (w) => ({ qid: w.qid, wikidataLabel: w.label, wikidataDescription: w.description, wikidataPlaces: wdPlaceNames(w), wikidataStates: w.states });
  const candSummary = (p) => ({ coasterId: p.c.id, name: p.c.name, park: p.c.park.name, city: p.c.park.city, state: p.c.park.state, nameVia: p.nameVia, locationVia: p.parkVia });
  const flag = (w, reason, cands) => {
    ambiguousQids.add(w.qid);
    ambiguous.push({ source: 'wikidata', ...wdSummary(w), reason, candidates: cands.map(candSummary) });
  };

  // Per Wikidata item: drop conflicting candidates, then accept only a unique one.
  const accepted = [];
  for (const w of wd) {
    const props = (propsByQid.get(w) || []).filter((p) => p.parkVia !== 'conflict');
    if (!props.length) continue; // no candidate, or all contradicted by location: unmatched
    const strong = props.filter((p) => p.parkVia === 'park' || p.parkVia === 'city');
    if (strong.length) {
      const labelMatches = strong.filter((p) => p.nameVia === 'label');
      if (strong.length === 1 && strong[0].nameVia === 'article') {
        // The en-Wikipedia article was renamed but the Wikidata label was not (or the
        // reverse): the item may describe an earlier ride (e.g. Top Thrill Dragster
        // under the "Top Thrill 2" article). A person decides.
        flag(w, `Only the English Wikipedia title ("${w.article}") matches; the Wikidata label is "${w.label}". Rename, rebuild, or relocation: confirm the item describes this ride.`, strong);
      } else if (strong.length === 1) accepted.push({ ...strong[0], others: [] });
      else if (labelMatches.length === 1) accepted.push({ ...labelMatches[0], others: strong.filter((p) => p !== labelMatches[0]) });
      else flag(w, 'Several local coasters at the same park match this item equally well.', strong);
      continue;
    }
    const byState = props.filter((p) => p.parkVia === 'state');
    if (byState.length === 1 && !w.parks.length && byState[0].nameVia === 'label') {
      accepted.push({ ...byState[0], others: [] });
    } else if (byState.length) {
      flag(w, w.parks.length
        ? 'Name and state match, but the Wikidata park does not match the local park name (renamed park, a different park, or a relocation).'
        : 'Name and state match more than one local coaster, or only through an alias or article title.', byState);
    } else {
      flag(w, 'Name matches, but Wikidata gives no park, city, or state to confirm it.', props);
    }
  }

  // Per local coaster: more than one Wikidata item wanting the same ID is ambiguous.
  const byCoaster = groupBy(accepted, 'c');
  for (const [c, list] of byCoaster) {
    if (list.length > 1) {
      for (const a of list) ambiguousQids.add(a.w.qid);
      ambiguous.push({
        source: 'wikidata', coasterId: c.id, name: c.name, park: c.park.name,
        reason: 'Several Wikidata items match this coaster (duplicates, or rebuilt/relocated rides with separate items).',
        candidates: list.map((a) => ({ qid: a.w.qid, wikidataLabel: a.w.label, rcdbId: a.w.rcdb[0] || null, opened: statsFor(a.w).opened || null, closed: statsFor(a.w).closed || null })),
      });
      continue;
    }
    const a = list[0];
    let confidence = a.nameVia === 'label' && a.parkVia === 'park' ? 'high' : 'medium';
    const notes = [];
    if (a.parkVia === 'state') notes.push(`Location confirmed only to the state (${c.park.state}); Wikidata gives no park. The name is unique among local coasters in that state.`);
    if (a.nameVia === 'alias') notes.push(`Name matched a Wikidata alias (former or alternate name); the Wikidata label is "${a.w.label}".`);
    if (a.nameVia === 'partial') notes.push(`Partial name match (sponsor prefix or subtitle): Wikidata "${a.w.label}", local "${c.name}".`);
    if (a.nameVia === 'article') notes.push(`Name matched the English Wikipedia title "${a.w.article}"; the Wikidata label is "${a.w.label}" (a rename?).`);
    if (a.parkVia === 'city') notes.push(`Park matched by city (${c.park.city}), not by park name.`);
    if (a.others.length) {
      // One item, several local IDs: a rename, rebuild, or relocation that
      // js/data.js keeps as separate credits (e.g. Top Thrill Dragster and Top Thrill 2).
      // Its figures may describe either ride, so nothing is linked.
      const st = statsFor(a.w);
      flag(a.w, `One Wikidata item (opened ${st.opened || '?'}, closed ${st.closed || '–'}) matches several local coasters that js/data.js keeps as separate credits (rename, rebuild, or relocation). Decide which ride its figures describe.`, [a, ...a.others]);
      continue;
    }
    linkedQids.add(a.w.qid);
    links[c.id] = {
      qid: a.w.qid, confidence,
      evidence: {
        wikidataLabel: a.w.label, nameVia: a.nameVia, locationVia: a.parkVia,
        wikidataPark: a.w.parks.map((p) => p.label).filter(Boolean),
        ...(a.w.rcdb.length ? { rcdbId: a.w.rcdb } : {}),
      },
      ...(notes.length ? { notes } : {}),
    };
  }

  // --- results ---------------------------------------------------------------
  // Files are written by fetch-wikipedia.mjs, which merges these results with Wikipedia.
  const wdByQid = new Map(wd.map((w) => [w.qid, w]));
  const sortedLinks = Object.fromEntries(Object.keys(links).sort().map((k) => [k, links[k]]));
  const unmatched = wd.filter((w) => !linkedQids.has(w.qid) && !ambiguousQids.has(w.qid));
  const isClosed = (w) => {
    const s = statsFor(w);
    return Boolean(s.closed) || /closed|demolish|defunct|relocat|removed|destroy|abandon/i.test(s.status || '');
  };
  const closedMissing = unmatched.filter(isClosed);
  const openMissing = unmatched.filter((w) => !isClosed(w));
  const row = (w) => {
    const s = statsFor(w);
    return `| [${w.qid}](https://www.wikidata.org/wiki/${w.qid}) | ${w.label || '(no English label)'} | ${w.parks.map((p) => p.label || p.qid).join('; ') || (w.admin.join('; ') || '–')} | ${s.opened || '–'} | ${s.closed || s.status || '–'} |`;
  };
  const byLabel = (a, b) => String(a.label).localeCompare(String(b.label));
  const conf = { high: 0, medium: 0 };
  for (const l of Object.values(links)) conf[l.confidence]++;

  // Markdown sections for coverage.md that only concern Wikidata.
  const unmatchedMd = `## On Wikidata but not matched: closed or removed (report only, not added)

Wikidata marks these closed (closing date or state of use). Some may be in \`js/data.js\` under another name or park; check before adding anything.

| Wikidata | Name | Park / place | Opened | Closed / state |
| --- | --- | --- | --- | --- |
${closedMissing.sort(byLabel).map(row).join('\n')}

## On Wikidata but not matched: not marked closed

Candidates for missing coasters, name variants, or parks that \`js/data.js\` does not list. Wikidata often lacks closing data, so many of these are also defunct. Review only. (Some were added to \`js/data.js\` on 2026-10-02 and now match; this table lists only those still unmatched.)

| Wikidata | Name | Park / place | Opened | Closed / state |
| --- | --- | --- | --- | --- |
${openMissing.sort(byLabel).map(row).join('\n')}

## Wikidata data-quality notes

${issueSet.size ? [...issueSet].map((i) => `- ${i}`).join('\n') : '- None found.'}
`;

  return {
    db, coasters, coasterById, wd, wdByQid, retrieved,
    links: sortedLinks, ambiguous, ambiguousQids, linkedQids, conf,
    statsFor, picksFor, unmatched, closedMissing, openMissing,
    issues: [...issueSet], unmatchedMd, locationEvidence, wdPlaceNames,
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await fetchAll();
  console.log('Next: node spikes/coaster-stats/fetch-wikipedia.mjs (fetches Wikipedia and builds every output).');
}
