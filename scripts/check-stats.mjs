#!/usr/bin/env node
// Validate js/stats.json against the ride stats file contract and js/data.js.
// Usage: node scripts/check-stats.mjs        (Node 18+, no dependencies)
// Exits 1 on any error; warnings are printed but do not fail.
// Contract: docs/tech_spec.md, "Ride stats file contract (v1)", with the approved
// deviation in sources/stats/CONTRACT-NOTES.md (refs read "lang" and "retrieved"
// from refDefaults). Standalone on purpose: maps are checked by scripts/check-data.mjs.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'js', 'stats.json');
const KB = 1024;
const BUDGET = { raw: 256 * KB, gzip: 64 * KB, warnRaw: 200 * KB };
const LICENSE = 'CC-BY-SA-4.0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
const TOP_KEYS = ['schema', 'license', 'licenseUrl', 'notice', 'attribution', 'format', 'generated', 'refDefaults', 'coasters'];
const FIELDS = ['height', 'drop', 'length', 'speed', 'inversions', 'gforce', 'duration', 'manufacturer', 'designer', 'model', 'material', 'type', 'opened', 'closed'];
const UNITS = { height: ['m', 'ft'], drop: ['m', 'ft'], length: ['m', 'ft'], speed: ['km/h', 'mph'], duration: ['s'] };
const TO_METRIC = { m: 1, ft: 0.3048, 'km/h': 1, mph: 1.609344, s: 1 };
const RANGES = { height: [1, 200], drop: [1, 200], length: [20, 3000], speed: [5, 250], duration: [10, 600], gforce: [0.5, 6.5], inversions: [0, 14] };
const STRINGS = ['manufacturer', 'designer', 'model'];
const MATERIALS = ['steel', 'wood', 'hybrid'];
const CITES = ['rcdb', 'park', 'manufacturer', 'news', 'other', 'none'];
const DATE = /^\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;
const DAY = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const today = new Date().toISOString().slice(0, 10);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------- load js/data.js in a sandbox, as check-guides.mjs does ----------

const sandbox = vm.createContext({});
vm.runInContext('var window = this;', sandbox);
vm.runInContext(readFileSync(path.join(ROOT, 'js/data.js'), 'utf8'), sandbox, { filename: 'js/data.js' });
const DB = vm.runInContext('COASTER_DB', sandbox);
const coasterIds = new Set(DB.parks.flatMap((p) => p.coasters.map((c) => c.id)));

if (!existsSync(FILE)) {
  console.log('No js/stats.json; nothing to check.');
  process.exit(0);
}
const buf = readFileSync(FILE);
const gz = zlib.gzipSync(buf, { level: 9 }).length;
let S;
try { S = JSON.parse(buf.toString('utf8')); } catch (e) { console.error(`js/stats.json: not valid JSON (${e.message})`); process.exit(1); }

// ---------- file ----------

const F = 'js/stats.json';
if (buf.length > BUDGET.raw) err(F, `${(buf.length / KB).toFixed(1)} KB is over the ${BUDGET.raw / KB} KB budget (shard by park: js/stats/<park-id>.json)`);
else if (buf.length > BUDGET.warnRaw) warn(F, `${(buf.length / KB).toFixed(1)} KB is over the ${BUDGET.warnRaw / KB} KB warning line`);
if (gz > BUDGET.gzip) err(F, `${(gz / KB).toFixed(1)} KB gzipped is over the ${BUDGET.gzip / KB} KB budget`);
if (S.schema !== 1) err(F, `schema must be 1 (got ${JSON.stringify(S.schema)})`);
if (S.license !== LICENSE) err(F, `license must be "${LICENSE}"`);
if (S.licenseUrl !== LICENSE_URL) err(F, `licenseUrl must be "${LICENSE_URL}"`);
if (typeof S.notice !== 'string' || !S.notice.trim()) err(F, 'no license notice');
else {
  for (const must of ['Wikipedia', 'CC BY-SA 4.0', 'Wikidata', 'CC0']) if (!S.notice.includes(must)) err(F, `notice must mention "${must}"`);
}
for (const k of Object.keys(S)) if (!TOP_KEYS.includes(k)) warn(F, `unknown top-level key "${k}"`);
if (!DAY.test(S.generated || '')) err(F, 'generated must be YYYY-MM-DD');
else if (S.generated > today) err(F, `generated ${S.generated} is in the future`);
const defaults = S.refDefaults || {};
if (S.refDefaults !== undefined && (typeof S.refDefaults !== 'object' || Array.isArray(S.refDefaults))) err(F, 'refDefaults must be an object');
if (!S.coasters || typeof S.coasters !== 'object' || Array.isArray(S.coasters)) { err(F, 'coasters must be an object'); finish(); }

// ---------- coasters ----------

const coverage = Object.fromEntries(FIELDS.map((f) => [f, { wd: 0, wp: 0 }]));
const cites = {};
let wpNoCite = 0;
const checkDate = (where, d) => {
  if (typeof d !== 'string' || !DATE.test(d)) { err(where, `"${d}" is not YYYY, YYYY-MM, or YYYY-MM-DD`); return false; }
  if (d > today.slice(0, d.length)) { err(where, `${d} is in the future`); return false; }
  return true;
};
const empty = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length);

for (const [id, entry] of Object.entries(S.coasters)) {
  const at = `${F} ${id}`;
  if (!coasterIds.has(id)) err(at, 'not a coaster ID in js/data.js');
  if (!entry || typeof entry !== 'object') { err(at, 'entry must be an object'); continue; }
  const refs = entry.refs || {};
  const eff = {};
  for (const src of Object.keys(refs)) {
    if (src !== 'wd' && src !== 'wp') { err(at, `unknown ref "${src}"`); continue; }
    const r = { ...(defaults[src] || {}), ...refs[src] };
    eff[src] = r;
    if (src === 'wd') {
      if (!/^Q\d+$/.test(r.qid || '')) err(at, 'refs.wd.qid must be Q followed by digits');
    } else {
      if (r.lang !== 'en') err(at, 'refs.wp.lang must be "en"');
      if (typeof r.title !== 'string' || !r.title.trim()) err(at, 'refs.wp.title is missing');
      if (!Number.isInteger(r.revid) || r.revid <= 0) err(at, 'refs.wp.revid must be a positive integer');
    }
    if (!DAY.test(r.retrieved || '')) err(at, `refs.${src}.retrieved must be YYYY-MM-DD`);
    else if (r.retrieved > today) err(at, `refs.${src}.retrieved is in the future`);
  }
  const fields = Object.keys(entry).filter((k) => k !== 'refs');
  if (!fields.length) err(at, 'entry has no values (a coaster with no data has no entry)');
  const usedSrc = new Set();
  for (const f of fields) {
    const x = entry[f];
    const where = `${at} ${f}`;
    if (!FIELDS.includes(f)) { err(where, 'unknown field'); continue; }
    if (!x || typeof x !== 'object' || Array.isArray(x)) { err(where, 'must be { v, src, … }'); continue; }
    for (const k of Object.keys(x)) if (!['v', 'pub', 'src', 'cite'].includes(k)) err(where, `unknown key "${k}"`);
    if (!x.src) err(where, 'no src');
    else if (!eff[x.src]) err(where, `src "${x.src}" has no ref in refs`);
    else { usedSrc.add(x.src); coverage[f][x.src]++; }
    if (empty(x.v)) { err(where, 'null or empty value'); continue; }
    if (x.cite !== undefined) {
      if (x.src !== 'wp') err(where, 'cite is only for Wikipedia values');
      if (!CITES.includes(x.cite)) err(where, `cite "${x.cite}" is not one of ${CITES.join(', ')}`);
      cites[x.cite] = (cites[x.cite] || 0) + 1;
    } else if (x.src === 'wp') wpNoCite++;

    if (f in UNITS || f === 'gforce') {
      if (typeof x.v !== 'number' || !Number.isFinite(x.v)) { err(where, 'v must be a number'); continue; }
      if (Math.round(x.v * 1000) / 1000 !== x.v) err(where, 'v must be rounded to 3 decimals');
    }
    // pub is required for lengths and speeds; for duration only when the source states seconds
    // ("2:30" has no pub; see sources/stats/CONTRACT-NOTES.md).
    if (f in UNITS && (x.pub !== undefined || f !== 'duration')) {
      if (!Array.isArray(x.pub) || x.pub.length !== 2 || typeof x.pub[0] !== 'number') err(where, 'pub must be [number, unit]');
      else if (!UNITS[f].includes(x.pub[1])) err(where, `pub unit "${x.pub[1]}" is not one of ${UNITS[f].join(', ')}`);
      else {
        const m = x.pub[0] * TO_METRIC[x.pub[1]];
        if (Math.abs(m - x.v) > 0.005 * Math.abs(x.v)) err(where, `pub ${x.pub.join(' ')} disagrees with v ${x.v} by more than 0.5%`);
      }
    } else if (x.pub !== undefined) err(where, 'pub is only for height, drop, length, speed, and duration');
    if (f === 'inversions' && !Number.isInteger(x.v)) err(where, 'must be a whole number');
    if (RANGES[f] && typeof x.v === 'number' && (x.v < RANGES[f][0] || x.v > RANGES[f][1])) err(where, `${x.v} is outside the plausible range ${RANGES[f].join('–')} (a unit mix-up?)`);
    if (STRINGS.includes(f) && (typeof x.v !== 'string' || !x.v.trim())) err(where, 'must be a non-empty string');
    if (f === 'material' && !MATERIALS.includes(x.v)) err(where, `must be one of ${MATERIALS.join(', ')}`);
    if (f === 'type' && (!Array.isArray(x.v) || !x.v.every((t) => typeof t === 'string' && t.trim()))) err(where, 'must be an array of non-empty strings');
    if (f === 'opened' || f === 'closed') checkDate(where, x.v);
  }
  if (entry.opened && entry.closed && typeof entry.opened.v === 'string' && typeof entry.closed.v === 'string') {
    const n = Math.min(entry.opened.v.length, entry.closed.v.length);
    if (entry.closed.v.slice(0, n) < entry.opened.v.slice(0, n)) err(at, `closed ${entry.closed.v} is before opened ${entry.opened.v}`);
  }
  for (const src of Object.keys(refs)) if (!usedSrc.has(src)) warn(at, `refs.${src} is not used by any field`);
}

// ---------- summary ----------

const ids = Object.keys(S.coasters);
console.log(`Stats checked against js/data.js (${coasterIds.size} coaster IDs):`);
console.log(`  js/stats.json: ${ids.length} coasters (${((100 * ids.length) / coasterIds.size).toFixed(1)}%), ${(buf.length / KB).toFixed(1)} KB, ${(gz / KB).toFixed(1)} KB gzipped`);
console.log(`  per field (wikipedia / wikidata): ${FIELDS.map((f) => `${f} ${coverage[f].wp}/${coverage[f].wd}`).join(', ')}`);
console.log(`  cite: ${Object.entries(cites).sort().map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; ${wpNoCite} Wikipedia values without cite`);
if (wpNoCite) warn(F, `${wpNoCite} Wikipedia values have no cite (their infobox value has no inline reference)`);
finish();

function finish() {
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings.slice(0, 50)) console.log(`  warn  ${w}`);
    if (warnings.length > 50) console.log(`  … and ${warnings.length - 50} more`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  error ${e}`);
    process.exit(1);
  }
  console.log('\nOK: no errors.');
  process.exit(0);
}
