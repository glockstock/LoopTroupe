#!/usr/bin/env node
// Validate park guide content against the guide schema (v1) and js/data.js.
// Usage: node scripts/check-guides.mjs        (Node 18+, no dependencies)
// Exits 1 on any error; warnings are printed but do not fail.
// Contract: docs/tech_spec.md, "Park guides".

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATUSES = ['draft', 'needs-check', 'verified'];
const RECOMMENDED_SECTIONS = ['at-a-glance', 'when-to-go', 'getting-in', 'must-rides',
  'ride-plans', 'ride-notes', 'food', 'videos', 'freshness'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const HTTPS = /^https:\/\/[^\s"'<>]+$/;
const KINDS = ['fact', 'take', 'estimate'];
const VOLATILITY = ['stable', 'seasonal', 'volatile'];
const CLAIM_KEYS = ['id', 'text', 'kind', 'volatility', 'status', 'lastVerified', 'verifiedBy', 'basis', 'sources'];
const ITEM_KEYS = {
  p: ['type', 'tone'],
  list: [],
  facts: ['label'],
  picks: ['name', 'location', 'bestFor'],
  rides: ['coasterId', 'label'],
  plan: ['coasterId', 'time'],
  videos: ['title', 'creator', 'creatorUrl', 'videoId', 'url', 'coasterId'],
};
const BLOCK_KEYS = {
  p: null, // a p block is itself a claim
  list: ['type', 'title', 'ordered', 'items'],
  facts: ['type', 'title', 'items'],
  picks: ['type', 'title', 'kind', 'items'],
  rides: ['type', 'title', 'ranked', 'items'],
  plan: ['type', 'id', 'title', 'steps'],
  videos: ['type', 'title', 'items'],
  credits: ['type', 'show'],
};
const today = new Date().toISOString().slice(0, 10);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

// ---------- load data.js, the manifest, and guide files in one sandbox ----------

const sandbox = vm.createContext({});
vm.runInContext('var window = this;', sandbox);
function runFile(rel) {
  const file = path.join(ROOT, rel);
  vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: rel });
}

runFile('js/data.js');
const DB = vm.runInContext('COASTER_DB', sandbox);
const parkById = new Map(DB.parks.map(p => [p.id, p]));
const coasterPark = new Map();
for (const p of DB.parks) for (const c of p.coasters) coasterPark.set(c.id, p.id);

if (!existsSync(path.join(ROOT, 'js/guides/index.js'))) {
  console.error('js/guides/index.js (guide manifest) is missing.');
  process.exit(1);
}
runFile('js/guides/index.js');
const INDEX = sandbox.GUIDE_INDEX;
if (!INDEX || typeof INDEX !== 'object') {
  console.error('js/guides/index.js must define window.GUIDE_INDEX.');
  process.exit(1);
}

// Guide files on disk that the manifest does not list.
const listed = new Set(Object.values(INDEX).map(e => e && e.src));
for (const f of readdirSync(path.join(ROOT, 'js/guides'))) {
  const rel = `js/guides/${f}`;
  if (f.endsWith('.js') && f !== 'index.js' && !listed.has(rel)) warn(rel, 'not listed in js/guides/index.js');
}

// ---------- helpers ----------

function isDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function checkPlainData(value, where) {
  const t = typeof value;
  if (value === null || t === 'string' || t === 'boolean') return;
  if (t === 'number') { if (!Number.isFinite(value)) err(where, 'non-finite number'); return; }
  if (Array.isArray(value)) { value.forEach((v, i) => checkPlainData(v, `${where}[${i}]`)); return; }
  if (t === 'object') { for (const [k, v] of Object.entries(value)) checkPlainData(v, `${where}.${k}`); return; }
  err(where, `only plain data is allowed (found ${t})`);
}

function checkKeys(obj, allowed, where) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) warn(where, `unknown field "${k}" (typo?)`);
}

function checkInline(text, where) {
  for (const m of text.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)) {
    if (!m[1].trim()) err(where, `link with empty label: ${m[0]}`);
    if (!HTTPS.test(m[2])) err(where, `links must be https:// URLs: ${m[0]}`);
  }
  if (/<\/?[a-z!]/i.test(text)) warn(where, 'looks like HTML; it will be shown as literal text');
  if ((text.match(/\*\*/g) || []).length % 2) warn(where, 'unbalanced ** (bold) markers');
}

function checkCoasterId(id, g, where, { mustOperate = false } = {}) {
  if (typeof id !== 'string' || !id) { err(where, 'coasterId must be a non-empty string'); return; }
  if (!coasterPark.has(id)) { err(where, `unknown coaster ID "${id}" (not in js/data.js)`); return; }
  if (coasterPark.get(id) !== g.parkId) err(where, `coaster "${id}" belongs to park "${coasterPark.get(id)}", not "${g.parkId}"`);
  if (mustOperate && g.operatingSet && !g.operatingSet.has(id)) warn(where, `"${id}" is not in credits.operating`);
}

// A claim is any object with id/text/status. Returns its effective status
// (a verified claim checked before guide.staleBefore counts as needs-check).
function checkClaim(c, where, extraKeys, g, stats) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) { err(where, 'must be an object'); return 'draft'; }
  checkKeys(c, [...CLAIM_KEYS, ...extraKeys], where);
  stats.claims++;

  if (typeof c.id !== 'string' || !SLUG.test(c.id)) err(where, 'id must be a lowercase-hyphen slug');
  else if (claimIds.has(c.id)) err(where, `duplicate claim id "${c.id}" (also at ${claimIds.get(c.id)})`);
  else claimIds.set(c.id, where);

  const status = STATUSES.includes(c.status) ? c.status : null;
  if (!status) err(where, `status must be one of ${STATUSES.join(' | ')} (got ${JSON.stringify(c.status)})`);
  const isDraft = status === 'draft';

  if (typeof c.text !== 'string' || !c.text.trim()) err(where, 'text is required');
  else checkInline(c.text, where);

  if (c.kind !== undefined && !KINDS.includes(c.kind)) err(where, `kind must be one of ${KINDS.join(' | ')}`);
  if (c.volatility !== undefined && !VOLATILITY.includes(c.volatility)) err(where, `volatility must be one of ${VOLATILITY.join(' | ')}`);
  if (!isDraft && c.kind === undefined) err(where, 'kind is required once a claim is past draft');
  if (!isDraft && c.volatility === undefined) err(where, 'volatility is required once a claim is past draft');

  if (c.lastVerified !== null && c.lastVerified !== undefined) {
    if (!isDate(c.lastVerified)) err(where, `lastVerified must be YYYY-MM-DD or null (got ${JSON.stringify(c.lastVerified)})`);
    else if (c.lastVerified > today) err(where, `lastVerified ${c.lastVerified} is in the future`);
  } else if (!('lastVerified' in c)) {
    warn(where, 'lastVerified missing; use null until verified');
  }
  if (status === 'verified') {
    if (!isDate(c.lastVerified)) err(where, 'verified claims need a lastVerified date');
    if (typeof c.verifiedBy !== 'string' || !c.verifiedBy.trim()) err(where, 'verified claims need verifiedBy (the team member)');
    if (typeof c.basis !== 'string' || !c.basis.trim()) err(where, 'verified claims need a basis (team note, visit, or official URL)');
  }
  if (c.sources !== undefined && !(Array.isArray(c.sources) && c.sources.every(x => typeof x === 'string'))) {
    err(where, 'sources must be an array of strings');
  }

  const placeholder = Object.values(c).some(v => typeof v === 'string' && v.includes('PLACEHOLDER'));
  if (placeholder) {
    stats.placeholders++;
    if (status && !isDraft) err(where, `placeholder text cannot be marked ${status}`);
  }

  let effective = status || 'draft';
  if (effective === 'verified' && g.staleBefore && isDate(c.lastVerified) && c.lastVerified < g.staleBefore) {
    effective = 'needs-check';
    stats.stale++;
  }
  stats[effective]++;
  return effective;
}

// ---------- per-guide checks ----------

const summaries = [];
const claimIds = new Map(); // claim id -> where, per guide

for (const [key, entry] of Object.entries(INDEX)) {
  const where0 = `GUIDE_INDEX['${key}']`;
  if (!entry || typeof entry.src !== 'string') { err(where0, 'needs a src path'); continue; }
  checkKeys(entry, ['src', 'published'], where0);
  if (typeof entry.published !== 'boolean') err(where0, 'published must be true or false');
  if (!parkById.has(key)) err(where0, `"${key}" is not a park ID in js/data.js`);
  if (!existsSync(path.join(ROOT, entry.src))) { err(where0, `file not found: ${entry.src}`); continue; }

  try { runFile(entry.src); } catch (e) {
    const at = String(e.stack || '').split('\n')[0]; // "js/guides/x.js:12" for syntax errors
    err(entry.src, `failed to load: ${e.name}: ${e.message}${at.startsWith(entry.src) ? ` (at ${at})` : ''}`);
    continue;
  }
  const g = sandbox.GUIDES && sandbox.GUIDES[key];
  if (!g) { err(entry.src, `must register window.GUIDES['${key}']`); continue; }

  const W = key;
  const stats = { claims: 0, draft: 0, 'needs-check': 0, verified: 0, placeholders: 0, stale: 0 };
  claimIds.clear();
  checkPlainData(g, W);
  checkKeys(g, ['schema', 'parkId', 'title', 'season', 'staleBefore', 'credits', 'sections', 'changelog'], W);
  if (g.staleBefore !== undefined && g.staleBefore !== null && !isDate(g.staleBefore)) err(W, 'staleBefore must be YYYY-MM-DD or null');
  if (g.schema !== 1) err(W, `schema must be 1 (got ${JSON.stringify(g.schema)})`);
  if (g.parkId !== key) err(W, `parkId "${g.parkId}" must equal the manifest key "${key}"`);
  if (typeof g.title !== 'string' || !g.title.trim()) err(W, 'title is required');
  if (!Number.isInteger(g.season)) err(W, 'season must be a year, e.g. 2027');

  // credits.operating
  const cw = `${W} › credits`;
  if (!g.credits || !Array.isArray(g.credits.operating)) {
    err(cw, 'credits.operating must be an array of coaster IDs');
    g.operatingSet = null;
  } else {
    if (checkClaim(g.credits, cw, ['operating'], g, stats) === 'draft' && entry.published) {
      err(cw, 'published guides need a confirmed operating list');
    }
    const seen = new Set();
    g.credits.operating.forEach((id, i) => {
      checkCoasterId(id, g, `${cw}.operating[${i}]`);
      if (seen.has(id)) err(`${cw}.operating[${i}]`, `duplicate "${id}"`);
      seen.add(id);
    });
    g.operatingSet = seen;
    const park = parkById.get(key);
    if (park) {
      const notListed = park.coasters.map(c => c.id).filter(id => !seen.has(id));
      if (notListed.length) summaries.push(`  ${key}: ${notListed.length} coaster(s) in js/data.js treated as not operating: ${notListed.join(', ')}`);
    }
  }

  // sections
  if (!Array.isArray(g.sections) || !g.sections.length) { err(W, 'sections must be a non-empty array'); continue; }
  const sectionIds = new Set();
  const planIds = new Set();
  const creditsShows = [];
  const rideNoteIds = new Set();
  const allDraftWhere = [];

  g.sections.forEach((s, si) => {
    const SW = `${W} › sections[${si}]${s && s.id ? ` (${s.id})` : ''}`;
    if (!s || typeof s !== 'object') { err(SW, 'must be an object'); return; }
    checkKeys(s, ['id', 'title', 'status', 'lastVerified', 'verifiedBy', 'answer', 'blocks'], SW);
    if (typeof s.id !== 'string' || !SLUG.test(s.id)) err(SW, 'id must be a lowercase-hyphen slug');
    else if (sectionIds.has(s.id)) err(SW, `duplicate section id "${s.id}"`);
    else sectionIds.add(s.id);
    if (typeof s.title !== 'string' || !s.title.trim()) err(SW, 'title is required');
    if (!STATUSES.includes(s.status)) err(SW, `status must be one of ${STATUSES.join(' | ')}`);
    if (s.lastVerified !== null && !isDate(s.lastVerified)) err(SW, 'lastVerified must be YYYY-MM-DD or null');
    if (s.status === 'verified' && !isDate(s.lastVerified)) err(SW, 'a signed-off (verified) section needs a lastVerified date');
    if (s.status === 'verified' && (typeof s.verifiedBy !== 'string' || !s.verifiedBy.trim())) err(SW, 'a signed-off (verified) section needs verifiedBy');
    if (!Array.isArray(s.blocks)) { err(SW, 'blocks must be an array'); return; }

    const sectionStatuses = [];
    const claim = (c, where, extra) => {
      const st = checkClaim(c, where, extra, g, stats);
      sectionStatuses.push(st);
      if (st === 'draft') allDraftWhere.push(where);
    };

    if (!s.answer) err(SW, 'answer (the one-line answer claim) is required');
    else {
      claim(s.answer, `${SW} › answer`, []);
      const words = typeof s.answer.text === 'string' ? s.answer.text.trim().split(/\s+/).length : 0;
      if (words > 25) warn(`${SW} › answer`, `answer line is ${words} words; the brief asks for 25 or fewer`);
    }

    s.blocks.forEach((b, bi) => {
      const BW = `${SW} › blocks[${bi}]${b && b.type ? ` ${b.type}` : ''}`;
      if (!b || typeof b !== 'object' || !(b.type in BLOCK_KEYS)) {
        err(BW, `unknown block type ${JSON.stringify(b && b.type)}; use one of ${Object.keys(BLOCK_KEYS).join(', ')}`);
        return;
      }
      if (b.type === 'p') {
        claim(b, BW, ITEM_KEYS.p);
        if (b.tone !== undefined && !['tip', 'warning'].includes(b.tone)) err(BW, 'tone must be "tip" or "warning"');
        return;
      }
      checkKeys(b, BLOCK_KEYS[b.type], BW);
      if (b.type === 'credits') {
        if (!['summary', 'checklist'].includes(b.show)) err(BW, 'show must be "summary" or "checklist"');
        else creditsShows.push(b.show);
        return;
      }

      const listKey = b.type === 'plan' ? 'steps' : 'items';
      const list = b[listKey];
      if (!Array.isArray(list) || !list.length) { err(BW, `${listKey} must be a non-empty array`); return; }

      if (b.type === 'plan') {
        if (typeof b.id !== 'string' || !SLUG.test(b.id)) err(BW, 'plan id must be a lowercase-hyphen slug');
        else if (planIds.has(b.id)) err(BW, `duplicate plan id "${b.id}"`);
        else planIds.add(b.id);
        if (typeof b.title !== 'string' || !b.title.trim()) err(BW, 'plan title is required');
      }
      if (b.type === 'picks' && !['gate', 'food', 'other'].includes(b.kind)) err(BW, 'picks kind must be "gate", "food", or "other"');

      list.forEach((it, ii) => {
        const IW = `${BW} › ${listKey}[${ii}]`;
        claim(it, IW, ITEM_KEYS[b.type]);
        if (!it || typeof it !== 'object') return;
        const isDraft = it.status === 'draft';
        const incomplete = (msg) => (isDraft ? warn : err)(IW, msg + (isDraft ? ' (allowed while draft)' : ''));

        if (b.type === 'facts' && (typeof it.label !== 'string' || !it.label.trim())) err(IW, 'label is required');
        if (b.type === 'picks' && (typeof it.name !== 'string' || !it.name.trim())) err(IW, 'name is required');
        if (b.type === 'rides') {
          checkCoasterId(it.coasterId, g, IW, { mustOperate: true });
          if (s.id === 'ride-notes') rideNoteIds.add(it.coasterId);
        }
        if (b.type === 'plan' && it.coasterId !== undefined) checkCoasterId(it.coasterId, g, IW, { mustOperate: true });
        if (b.type === 'videos') {
          if (it.coasterId !== undefined && it.coasterId !== null) checkCoasterId(it.coasterId, g, IW);
          const hasId = it.videoId !== undefined && it.videoId !== null;
          const hasUrl = it.url !== undefined && it.url !== null;
          if (hasId && !YT_ID.test(it.videoId)) err(IW, `videoId must be an 11-character YouTube ID (got ${JSON.stringify(it.videoId)})`);
          if (hasUrl && !HTTPS.test(it.url)) err(IW, 'url must be an https:// URL');
          if (hasId && hasUrl) err(IW, 'give videoId or url, not both');
          if (!hasId && !hasUrl) incomplete('needs a videoId (YouTube) or url');
          if (typeof it.title !== 'string' || !it.title.trim()) incomplete('needs a title');
          if (typeof it.creator !== 'string' || !it.creator.trim()) incomplete('needs creator credit');
          if (it.creatorUrl !== undefined && it.creatorUrl !== null && !HTTPS.test(it.creatorUrl)) err(IW, 'creatorUrl must be an https:// URL');
        }
      });
    });

    if (s.status === 'verified' && sectionStatuses.includes('draft')) {
      err(SW, 'signed off (verified) but still contains draft claims');
    }
  });

  for (const id of RECOMMENDED_SECTIONS) if (!sectionIds.has(id)) warn(W, `recommended section "${id}" is missing`);
  for (const show of ['summary', 'checklist']) {
    const n = creditsShows.filter(x => x === show).length;
    if (n === 0) warn(W, `no { type: 'credits', show: '${show}' } block`);
    if (n > 1) err(W, `only one { type: 'credits', show: '${show}' } block is allowed`);
  }
  if (sectionIds.has('ride-notes') && g.operatingSet) {
    const missing = [...g.operatingSet].filter(id => !rideNoteIds.has(id));
    if (missing.length) summaries.push(`  ${key}: ${missing.length} operating coaster(s) without ride notes yet: ${missing.join(', ')}`);
  }

  // changelog
  if (!Array.isArray(g.changelog)) err(W, 'changelog must be an array (may be empty)');
  else {
    g.changelog.forEach((c, i) => {
      const LW = `${W} › changelog[${i}]`;
      checkKeys(c || {}, ['date', 'text'], LW);
      if (!c || !isDate(c.date)) err(LW, 'date must be YYYY-MM-DD');
      if (!c || typeof c.text !== 'string' || !c.text.trim()) err(LW, 'text is required');
      if (i > 0 && c && g.changelog[i - 1] && c.date > g.changelog[i - 1].date) warn(LW, 'changelog should be newest first');
    });
  }

  // The publish guard: no draft claims live, and every section signed off.
  // Needs-check claims may go live; the renderer labels them "Unconfirmed".
  if (entry.published && stats.draft > 0) {
    err(where0, `published: true, but ${stats.draft} claim(s) are still draft (first: ${allDraftWhere[0]})`);
  }
  if (entry.published && g.sections.some(s => s.status !== 'verified')) {
    err(where0, 'published: true, but not every section is signed off (status verified)');
  }

  const pct = stats.claims ? Math.round((stats.verified / stats.claims) * 100) : 0;
  summaries.unshift(`  ${key}: ${entry.published ? 'PUBLISHED' : 'unpublished (draft preview)'} · ${g.sections.length} sections · ` +
    `${stats.claims} claims: ${stats.verified} verified (${pct}%), ${stats['needs-check']} needs-check` +
    `${stats.stale ? ` (${stats.stale} stale)` : ''}, ${stats.draft} draft · ` +
    `${stats.placeholders} placeholder(s)`);
}

// ---------- report ----------

console.log(`Guides checked against js/data.js (${coasterPark.size} coaster IDs):`);
for (const line of summaries) console.log(line);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  x ${e}`);
  process.exit(1);
}
console.log('\nOK: no errors.');
