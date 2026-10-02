#!/usr/bin/env node
// Ride stats build: writes js/stats.json from Wikidata (CC0) and English Wikipedia
// ride infoboxes (CC BY-SA 4.0), keyed by Loop Troupe coaster IDs.
// Contract: docs/tech_spec.md "Ride stats file contract (v1)", with the deviations
// in sources/stats/CONTRACT-NOTES.md. Owner: coaster_data_curator.
// Node 18+ (22.21+ behind a proxy), built-ins only. Run by hand, never from CI.
//
//   node scripts/stats/build.mjs --offline           rebuild from sources/stats/raw/ (no network;
//                                                     byte-identical output for the same inputs)
//   node scripts/stats/build.mjs --fetch             fetch Wikidata and Wikipedia into raw/, then build
//   node scripts/stats/build.mjs --fetch-wikipedia   fetch Wikipedia only, then build
//   node scripts/stats/build.mjs --relink [--offline] propose links again from raw/ (rewrites
//                                                     sources/stats/links.json, keeping "manual"
//                                                     entries, and ambiguous.json), then build
//
// Behind an HTTPS proxy, add NODE_USE_ENV_PROXY=1 to fetch.
//
// Inputs (committed): js/data.js, js/guides/cedar-point.js, sources/stats/links.json,
//   sources/stats/overrides.json. Raw API responses: sources/stats/raw/ (gitignored).
// Outputs: js/stats.json (published); sources/stats/review.json, coverage.md (review notes);
//   with --relink also sources/stats/links.json and ambiguous.json.
//
// Rules:
// - Links come only from sources/stats/links.json. The matcher (--relink) proposes them:
//   Wikidata by name plus park/city/state evidence; Wikipedia through the item's
//   sitelink, or an infobox whose location names the park exactly and whose name equals
//   the coaster's, unique on both sides. Everything else goes to ambiguous.json.
// - Never guess. Values that don't parse cleanly are left out and listed in review.json.
// - Where Wikidata and Wikipedia disagree beyond rounding, neither ships unless
//   overrides.json records a choice (with its basis) or a rule.
// - An infobox that also lists a previous name js/data.js keeps as a separate credit
//   (Top Thrill Dragster in "Top Thrill 2") gives its figures only to the ride it is
//   named for, minus any value footnoted or qualified as the earlier ride's.
// - No other sources. RCDB is never contacted; an infobox's rcdb_number is ignored.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  fetchWikidata, matchWikidata, loadDb, loadCedarPointOperating, norm, compact, nameKeys,
  parkKeys, STATE_NAMES, ROOT, RAW_DIR, RAW_FILE as WD_RAW_FILE,
} from './wikidata.mjs';
import {
  extractInfoboxes, readInfobox, splitParams, clean, delink, placeNames, previousNames,
  setReferenceDate, overlaps, inRange, decimals, r3, FT, MPH,
} from './infobox.mjs';

const SRC = path.join(ROOT, 'sources', 'stats');
const OUT_FILE = path.join(ROOT, 'js', 'stats.json');
const LINKS_FILE = path.join(SRC, 'links.json');
const OVERRIDES_FILE = path.join(SRC, 'overrides.json');
const WP_RAW_FILE = path.join(RAW_DIR, 'wikipedia-raw.json');
const API = 'https://en.wikipedia.org/w/api.php';
const USER_AGENT = 'LoopTroupe-data/1.0 (https://github.com/glockstock/LoopTroupe)';
const TEMPLATES = ['Template:Infobox roller coaster', 'Template:Infobox dual roller coaster'];
const BATCH = 50; // MediaWiki's limit for titles per request
const PAUSE_MS = 3000; // between requests; requests are sent one at a time
const LICENSE = {
  license: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  notice: 'Loop Troupe ride stats, compiled from Wikipedia (© Wikipedia contributors, CC BY-SA 4.0) and Wikidata (CC0 1.0); values selected, unit-converted, and normalized by Loop Troupe. This file is available under CC BY-SA 4.0.',
};
const FORMAT_NOTE = 'Contract v1 with one approved deviation (2026-10-02): to stay under the size budget, refs omit "lang" and "retrieved"; read them from refDefaults[src], unless a ref sets its own. Effective ref = { ...refDefaults[src], ...refs[src] }. See sources/stats/CONTRACT-NOTES.md.';
const FIELDS = ['height', 'drop', 'length', 'speed', 'inversions', 'gforce', 'duration', 'manufacturer', 'designer', 'model', 'material', 'type', 'opened', 'closed'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const rel = (f) => path.relative(ROOT, f);

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

async function embeddedIn(template) {
  const titles = [];
  let cont = {};
  for (;;) {
    const j = await api({ action: 'query', list: 'embeddedin', eititle: template, einamespace: '0', eilimit: '500', ...cont });
    titles.push(...j.query.embeddedin.map((p) => p.title));
    if (!j.continue) break;
    cont = { eicontinue: j.continue.eicontinue, continue: j.continue.continue };
    await sleep(PAUSE_MS);
  }
  return titles;
}

// Section 0 holds the infobox, so only the lead is fetched (rvsection=0).
async function fetchWikipedia(wdRaw, db) {
  const sitelinks = [...new Set(wdRaw.labels.map((l) => l.article).filter(Boolean))];
  const linked = existsSync(LINKS_FILE) ? Object.values(readJson(LINKS_FILE).links).map((l) => l.wp).filter(Boolean) : [];
  const transclusions = [];
  for (const t of TEMPLATES) {
    const list = await embeddedIn(t);
    console.log(`articles using ${t}: ${list.length}`);
    transclusions.push(...list);
    await sleep(PAUSE_MS);
  }
  const titles = [...new Set([...sitelinks, ...linked, ...transclusions])].sort();
  const pages = {};
  const redirects = {};
  const missing = [];
  for (let i = 0; i < titles.length; i += BATCH) {
    const j = await api({
      action: 'query', prop: 'revisions', rvprop: 'ids|timestamp|content', rvslots: 'main',
      rvsection: '0', redirects: '1', titles: titles.slice(i, i + BATCH).join('|'),
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
  // Keep only the infobox wikitext (not the article) of pages that are a Wikidata US
  // sitelink, a linked article, or whose infobox names one of our parks or a US state.
  const wanted = new Set([...sitelinks, ...linked].map((t) => resolveTitle(t, redirects)));
  const localParkKeys = new Set(db.parks.flatMap((p) => parkKeys(p.name)));
  const kept = {};
  let dropped = 0;
  for (const title of Object.keys(pages).sort()) {
    const p = pages[title];
    const boxes = extractInfoboxes(p.content);
    const usable = wanted.has(title) || boxes.some((b) => placeNames(b.params).some((n) => parkKeys(n).some((k) => localParkKeys.has(k))
      || /\b(united states|u\.s\.|usa)\b/i.test(n) || Object.values(STATE_NAMES).some((s) => n.includes(s))));
    if (!usable) { dropped++; continue; }
    kept[title] = { pageid: p.pageid, revid: p.revid, timestamp: p.timestamp, infoboxes: boxes.map((b) => ({ template: b.template, text: b.text })) };
  }
  const raw = {
    source: 'English Wikipedia (https://en.wikipedia.org), CC BY-SA 4.0; © Wikipedia contributors',
    endpoint: API, userAgent: USER_AGENT, retrieved: new Date().toISOString(), templates: TEMPLATES,
    request: 'action=query&prop=revisions&rvprop=ids|timestamp|content&rvslots=main&rvsection=0&redirects=1, 50 titles per request, maxlag=5',
    note: `Requested ${titles.length} titles. Stored the infobox wikitext of ${Object.keys(kept).length} pages; ${dropped} pages outside the US or without a usable infobox were not stored.`,
    redirects, missing: missing.sort(), pages: kept,
  };
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(WP_RAW_FILE, JSON.stringify(raw, null, 1) + '\n');
  console.log(`wrote ${rel(WP_RAW_FILE)} (${Object.keys(kept).length} pages)`);
  return raw;
}

function resolveTitle(t, redirects) {
  let cur = t;
  for (let i = 0; i < 5 && redirects[cur]; i++) cur = redirects[cur];
  return cur;
}

// Pages and their parsed infoboxes. Accepts the spike's raw format (infoboxes as strings).
function loadPages(wpRaw) {
  const pages = new Map();
  for (const title of Object.keys(wpRaw.pages).sort()) {
    const p = wpRaw.pages[title];
    const boxes = p.infoboxes.map((b, index) => {
      const { template, text } = typeof b === 'string' ? { template: 'single', text: b } : b;
      const params = splitParams(text);
      const name = delink(clean(params.name || '').text) || title.replace(/\s*\([^)]*\)\s*$/, '');
      const tracks = template === 'dual' ? [1, 2].map((n) => delink(clean(params[`name${n}`] || '').text)) : [];
      return { index, template, params, name, tracks, places: placeNames(params), previous: previousNames(params) };
    });
    pages.set(title, { title, revid: p.revid, timestamp: p.timestamp, boxes });
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function parkCores(name) {
  const cores = new Set([compact(name), compact(String(name).split(/\s+(?:&|and|at)\s+/i)[0])]);
  const m = /^\S+['’]s\s+(.+)$/.exec(String(name));
  if (m) cores.add(compact(m[1]));
  return [...cores].filter((c) => c.length >= 8);
}

// Park evidence from an infobox: 'exact', 'loose', or null.
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

// How a coaster's name meets an infobox: 'name', 'track' (one track of a dual
// coaster that js/data.js lists as its own credit), 'previous', 'partial', or null.
function nameMatch(box, page, c) {
  const local = new Set(nameKeys(c.name));
  const titleBase = page.title.replace(/\s*\([^)]*\)\s*$/, '');
  if (box.template === 'dual' && trackOf(box, c)) return 'track';
  if ([box.name, titleBase].some((n) => nameKeys(n).some((k) => local.has(k)))) return 'name';
  if (box.previous.some((n) => nameKeys(n).some((k) => local.has(k)))) return 'previous';
  const [x, y] = [compact(box.name), compact(c.name)];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 6 && (long.startsWith(short) || long.endsWith(short))) return 'partial';
  return null;
}

// "Batman & Robin: The Chiller (Robin)" is track "Robin" of the dual infobox "Batman & Robin: The Chiller".
function trackOf(box, c) {
  const m = /^(.*)\(([^)]+)\)\s*$/.exec(c.name);
  if (!m || !nameKeys(m[1]).some((k) => nameKeys(box.name).includes(k))) return null;
  const i = box.tracks.findIndex((t) => t && compact(t) === compact(m[2]));
  return i === -1 ? null : i + 1;
}

// ---------------------------------------------------------------------------
// Relink: propose sources/stats/links.json and ambiguous.json from the raw data.
// ---------------------------------------------------------------------------

function relink(M, pages, wpRaw, previousLinks) {
  const db = M.db;
  const pageFor = (t) => (t ? pages.get(resolveTitle(t, wpRaw.redirects)) : null);
  const coastersAt = new Map(db.parks.map((p) => [p, M.coasters.filter((c) => c.park === p)]));
  const earlierRides = (box, c) => coastersAt.get(c.park).filter((o) => o !== c
    && box.previous.some((n) => nameKeys(n).some((k) => nameKeys(o.name).includes(k)))
    && !nameKeys(box.name).some((k) => nameKeys(o.name).includes(k))).map((o) => o.id);
  const ambiguous = [...M.ambiguous];
  const flagWp = (entry) => ambiguous.push({ source: 'wikipedia', ...entry });
  const boxSummary = (page, box) => ({ article: page.title, revid: page.revid, infoboxName: box.name, infoboxLocation: box.places[0] || null, previousNames: box.previous });
  const boxKey = (page, box) => `${page.title}#${box.index}`;
  const wp = new Map(); // coasterId -> { page, box, via, note, earlier, track }
  const usedBoxes = new Set();

  // Stage 1: through the Wikidata item's English sitelink.
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
          ? `The infobox describes ${successor.name} (${successor.id}); this coaster is only a previous name in it, so its figures are not used here.`
          : 'This coaster matches only a previous name in the infobox (a rename or a rebuild). Decide whether the current figures describe this credit.' });
      usedBoxes.add(boxKey(page, box));
      continue;
    }
    if (!how) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, qid: w.qid, ...boxSummary(page, box), reason: 'The infobox name does not match this coaster.' });
      continue;
    }
    if (box.template === 'dual' && how !== 'track') usedBoxes.add(boxKey(page, box));
    if (box.template !== 'dual') usedBoxes.add(boxKey(page, box));
    wp.set(id, { page, box, via: 'wikidata-sitelink', note: how === 'partial' ? `Partial name match: infobox "${box.name}", local "${c.name}".` : null,
      earlier: earlierRides(box, c), track: how === 'track' ? trackOf(box, c) : null });
  }

  // Stage 2: every other infobox, by exact park and exact name (or track), unique on both sides.
  const proposals = new Map();
  const boxProposals = new Map();
  for (const page of pages.values()) {
    for (const box of page.boxes) {
      if (usedBoxes.has(boxKey(page, box))) continue;
      for (const park of db.parks) {
        const ev = boxParkEvidence(box, park);
        if (!ev) continue;
        for (const c of coastersAt.get(park)) {
          const how = nameMatch(box, page, c);
          if (!how) continue;
          if (ev === 'exact' && (how === 'name' || how === 'track')) {
            if (!proposals.has(c.id)) proposals.set(c.id, []);
            proposals.get(c.id).push({ page, box, track: how === 'track' ? trackOf(box, c) : null });
            const k = `${boxKey(page, box)}#${how === 'track' ? trackOf(box, c) : 0}`;
            if (!boxProposals.has(k)) boxProposals.set(k, []);
            boxProposals.get(k).push(c);
          } else if (!wp.has(c.id)) {
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
  for (const id of [...proposals.keys()].sort()) {
    const list = proposals.get(id);
    const c = M.coasterById.get(id);
    if (wp.has(id)) continue;
    const link = M.links[id];
    if (link && pageFor(M.wdByQid.get(link.qid).article)) continue; // stage 1 decided this coaster's article
    if (list.length > 1) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, reason: 'Several Wikipedia infoboxes match this coaster.', candidates: list.map(({ page, box }) => boxSummary(page, box)) });
      continue;
    }
    const { page, box, track } = list[0];
    const rivals = boxProposals.get(`${boxKey(page, box)}#${track || 0}`);
    if (rivals.length > 1) {
      flagWp({ coasterId: id, name: c.name, park: c.park.name, ...boxSummary(page, box), reason: `This infobox matches several local coasters (${rivals.map((r) => r.id).join(', ')}).` });
      continue;
    }
    const wdAmbiguous = ambiguous.some((a) => a.source === 'wikidata' && (a.coasterId === id || a.candidates?.some((x) => x.coasterId === id)));
    wp.set(id, { page, box, via: 'infobox-match', note: wdAmbiguous ? 'Wikidata was ambiguous for this coaster; the infobox name and park match it exactly.' : null, earlier: earlierRides(box, c), track });
  }

  // links.json: Wikidata and Wikipedia links per coaster. Entries marked "manual" are kept as they are.
  const links = {};
  const ids = new Set([...Object.keys(M.links), ...wp.keys()]);
  const manual = Object.entries(previousLinks || {}).filter(([, l]) => l.manual);
  for (const [id] of manual) ids.add(id);
  for (const id of [...ids].sort()) {
    const prev = previousLinks?.[id];
    if (prev?.manual) { links[id] = prev; continue; }
    const l = M.links[id];
    const p = wp.get(id);
    links[id] = {
      ...(l ? { wd: l.qid, wdConfidence: l.confidence, wdEvidence: `${l.evidence.nameVia} + ${l.evidence.locationVia}` } : {}),
      ...(p ? { wp: p.page.title, wpVia: p.via, ...(p.page.boxes.length > 1 ? { wpBox: p.box.index } : {}), ...(p.track ? { wpTrack: p.track } : {}) } : {}),
      ...(p?.earlier.length ? { earlierRide: p.earlier } : {}),
      ...(l?.notes || p?.note ? { note: [...(l?.notes || []), ...(p?.note ? [p.note] : [])].join(' ') } : {}),
    };
  }
  return { links, ambiguous };
}

// ---------------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------------

const WD_UNITS = { Q11573: ['m', 1], Q3710: ['ft', FT], Q180154: ['km/h', 1], Q211256: ['mph', MPH], Q11574: ['s', 1], Q7727: ['min', 60] };

function wikidataValues(M, w, refDate) {
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
    // Duration: pub only when Wikidata states seconds (a value in minutes has no allowed pub unit).
    if (u[0] === 'min' || u[0] === 's') val = { v: Math.round(n * u[1]), ...(u[0] === 's' && Number.isInteger(n) ? { pub: [n, 's'] } : {}) };
    else val = { v: r3(n * u[1]), pub: [n, u[0]], lo: (n - 0.5 * 10 ** -dec) * u[1], hi: (n + 0.5 * 10 ** -dec) * u[1] };
    if (!inRange(field, val.v)) { issues.push({ field, raw, reason: `outside the plausible range for ${field}` }); continue; }
    values[field] = { ...val, raw };
  }
  if (stats.manufacturer?.length === 1) values.manufacturer = { v: stats.manufacturer[0], raw: stats.manufacturer[0] };
  else if (stats.manufacturer?.length > 1) issues.push({ field: 'manufacturer', raw: stats.manufacturer.join('; '), reason: 'several values' });
  if (stats.designer?.length === 1) values.designer = { v: stats.designer[0], raw: stats.designer[0] };
  else if (stats.designer?.length > 1) issues.push({ field: 'designer', raw: stats.designer.join('; '), reason: 'several values' });
  // No model from Wikidata: its P144 ("based on") names the theme or franchise, not the coaster model.
  const classes = stats.type || [];
  const mats = new Set();
  for (const m of [...(stats.material || []), ...classes]) {
    if (/hybrid/i.test(m)) mats.add('hybrid');
    else if (/\bsteel\b/i.test(m)) mats.add('steel');
    else if (/\bwood(en)?\b/i.test(m)) mats.add('wood');
  }
  const matRaw = [...(stats.material || []), ...classes].join('; ');
  if (mats.size === 1) values.material = { v: [...mats][0], raw: matRaw };
  else if (mats.size > 1) issues.push({ field: 'material', raw: [...mats].join('; '), reason: 'Wikidata gives several materials' });
  const types = classes.filter((c) => !/^(steel|wooden|wood|hybrid) roller coaster$|^roller coaster$/i.test(c));
  if (types.length) values.type = { v: types, raw: types.join('; ') };
  for (const field of ['opened', 'closed']) {
    const p = picks[field];
    if (!p) continue;
    const raw = `${p.st.time} precision ${p.st.precision} (${p.pid})`;
    if (p.conflict) { issues.push({ field, raw: p.all.map((v) => v.time.slice(0, 10)).join('; '), reason: 'Wikidata holds conflicting values' }); continue; }
    if (stats[field] > refDate.slice(0, stats[field].length)) { issues.push({ field, raw, reason: 'date is after the data was retrieved' }); continue; }
    values[field] = { v: stats[field], raw };
  }
  return { values, issues, materialsStated: [...mats].sort(), materialRaw: matRaw };
}

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
const prefer = (field, a, b) => ((field === 'opened' || field === 'closed') ? (b.v.length > a.v.length ? 'wp' : 'wd') : (PREFER_WP.has(field) ? 'wp' : 'wd'));

// ---------------------------------------------------------------------------
// Build js/stats.json from links, raw data, and overrides
// ---------------------------------------------------------------------------

function build(M, pages, wpRaw, linksFile, overrides) {
  const wdDate = M.retrieved;
  const wpDate = wpRaw.retrieved.slice(0, 10);
  const refDate = [wdDate, wpDate].sort().at(-1);
  const pageFor = (t) => (t ? pages.get(resolveTitle(t, wpRaw.redirects)) : null);
  const links = linksFile.links;
  const stats = {};
  const conflicts = [];
  const unparsed = [];
  const resolved = [];
  const linkProblems = [];
  const extras = {};
  const before = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const after = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const fromWp = Object.fromEntries(FIELDS.map((f) => [f, 0]));
  const rulesFor = new Map();
  for (const rule of overrides.rules || []) for (const id of rule.coasters) {
    if (!rulesFor.has(id)) rulesFor.set(id, []);
    rulesFor.get(id).push(rule);
  }
  const wpBoxes = new Map();

  for (const id of Object.keys(links).sort()) {
    const link = links[id];
    const c = M.coasterById.get(id);
    if (!c) { linkProblems.push({ coasterId: id, problem: 'not a coaster ID in js/data.js' }); continue; }
    const w = link.wd ? M.wdByQid.get(link.wd) : null;
    if (link.wd && !w) linkProblems.push({ coasterId: id, problem: `Wikidata item ${link.wd} is not in the raw data` });
    const wdv = w ? wikidataValues(M, w, refDate) : { values: {}, issues: [], materialsStated: [] };
    const page = link.wp ? pageFor(link.wp) : null;
    if (link.wp && !page) linkProblems.push({ coasterId: id, problem: `Wikipedia article "${link.wp}" is not in the raw data` });
    let box = null;
    if (page) {
      box = page.boxes[link.wpBox || 0];
      if (!box) linkProblems.push({ coasterId: id, problem: `"${link.wp}" has no infobox ${link.wpBox || 0}` });
      else if (page.boxes.length > 1 && link.wpBox == null) { linkProblems.push({ coasterId: id, problem: `"${link.wp}" has several infoboxes; links.json must name one (wpBox)` }); box = null; }
      else if (box.places.length && !boxParkEvidence(box, c.park)) { linkProblems.push({ coasterId: id, problem: `the infobox location (${box.places[0]}) no longer names ${c.park.name}` }); box = null; }
    }
    if (box) wpBoxes.set(id, { page, box });
    const wpv = box ? readInfobox(box.params, { template: box.template, track: link.wpTrack || null, qualifyEarlierRide: Boolean(link.earlierRide?.length) }) : { values: {}, issues: [], extra: {} };
    for (const i of wdv.issues) unparsed.push({ coasterId: id, source: 'wd', qid: w.qid, ...i });
    for (const i of wpv.issues) unparsed.push({ coasterId: id, source: 'wp', article: page.title, revid: page.revid, ...i });
    if (box && Object.keys(wpv.extra).length) extras[id] = { article: page.title, revid: page.revid, ...wpv.extra };

    const entry = { refs: {} };
    const rules = rulesFor.get(id) || [];
    for (const f of FIELDS) {
      const a = wdv.values[f];
      const b = wpv.values[f];
      if (a) before[f]++;
      let chosen = null;
      const rule = rules.find((r) => r.field === f);
      const choice = overrides.choices?.[id]?.[f];
      if (rule) {
        // A rule picks one source's stated value. The source must state it.
        const stated = rule.src === 'wd' ? (f === 'material' ? wdv.materialsStated.includes(rule.value) : a?.v === rule.value) : b?.v === rule.value;
        if (!stated) {
          // Rather than ship a value the rule says is wrong, hold the field back.
          if (rule.whenUnstated === 'withhold') { if (a || b) resolved.push({ coasterId: id, name: c.name, field: f, by: `rule ${rule.id} (withheld: no source states "${rule.value}")`, value: null, wd: f === 'material' ? (wdv.materialRaw || null) : a?.v, wp: b?.v }); }
          else linkProblems.push({ coasterId: id, problem: `rule "${rule.id}" wants ${f} "${rule.value}" from ${rule.src}, which does not state it` });
          continue;
        }
        chosen = [rule.src, rule.src === 'wd' && f === 'material' ? { v: rule.value } : (rule.src === 'wd' ? a : b)];
        if ((a && a.v !== rule.value) || (b && b.v !== rule.value) || (f === 'material' && wdv.materialsStated.length > 1)) {
          resolved.push({ coasterId: id, name: c.name, field: f, by: `rule ${rule.id}`, value: rule.value, wd: f === 'material' ? wdv.materialRaw : a?.v, wp: b?.v });
        }
      } else if (a && b) {
        if (choice) {
          const pick = choice.src === 'wp' ? b : a;
          chosen = [choice.src, pick];
          resolved.push({ coasterId: id, name: c.name, field: f, by: `choice (${choice.basis})`, value: pick.pub || pick.v, wd: a.pub || a.v, wp: b.pub || b.v });
        } else if (!agree(f, a, b)) {
          conflicts.push({ coasterId: id, name: c.name, field: f,
            wd: { qid: w.qid, v: a.v, pub: a.pub, raw: a.raw },
            wp: { article: page.title, revid: page.revid, param: b.param, v: b.v, pub: b.pub, raw: b.raw, cite: b.cite },
            hint: link.wdEvidence && !link.wdEvidence.startsWith('label') ? `The Wikidata link came through ${link.wdEvidence.split(' + ')[0]} ("${w.label}"); the infobox is named "${box.name}". Prefer the source that describes this ride.` : undefined });
          continue;
        } else chosen = prefer(f, a, b) === 'wp' ? ['wp', b] : ['wd', a];
      } else if (choice) {
        linkProblems.push({ coasterId: id, problem: `overrides.json chooses ${choice.src} for ${f}, but only one source states it` });
        chosen = a ? ['wd', a] : b ? ['wp', b] : null;
      } else if (a) chosen = ['wd', a];
      else if (b) chosen = ['wp', b];
      if (!chosen) continue;
      const [src, val] = chosen;
      const out = { v: val.v };
      if (val.pub) out.pub = val.pub;
      out.src = src;
      if (src === 'wp' && val.cite) out.cite = val.cite;
      entry[f] = out;
    }
    // closed before opened: hold both back.
    if (entry.opened && entry.closed && entry.closed.v < entry.opened.v.slice(0, entry.closed.v.length)) {
      unparsed.push({ coasterId: id, source: `${entry.opened.src}/${entry.closed.src}`, field: 'closed', raw: `opened ${entry.opened.v}, closed ${entry.closed.v}`, reason: 'closed before opened; both left out' });
      delete entry.opened;
      delete entry.closed;
    }
    for (const f of FIELDS) if (entry[f]) { after[f]++; if (entry[f].src === 'wp' && !wdv.values[f]) fromWp[f]++; }
    const used = new Set(FIELDS.filter((f) => entry[f]).map((f) => entry[f].src));
    if (used.has('wd')) entry.refs.wd = { qid: w.qid };
    if (used.has('wp')) entry.refs.wp = { title: page.title, revid: page.revid };
    if (used.size) stats[id] = entry;
  }

  const file = {
    schema: 1,
    ...LICENSE,
    attribution: 'Wikipedia values: credit "Wikipedia contributors", link the article at refs.wp.revid, name CC BY-SA 4.0, and note "Units converted by Loop Troupe". Wikidata values: credit "Wikidata (CC0)".',
    format: FORMAT_NOTE,
    generated: refDate,
    refDefaults: { wd: { retrieved: wdDate }, wp: { lang: 'en', retrieved: wpDate } },
  };
  // One coaster per line: small, and diffs stay readable.
  const text = `{\n${Object.entries(file).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n')}\n "coasters": {\n${Object.entries(stats).map(([id, e]) => `  ${JSON.stringify(id)}: ${JSON.stringify(e)}`).join(',\n')}\n }\n}\n`;
  return { text, stats, conflicts, unparsed, resolved, linkProblems, extras, before, after, fromWp, wpBoxes, refDate, wdDate, wpDate };
}

// ---------------------------------------------------------------------------
// Review notes: sources/stats/review.json and coverage.md
// ---------------------------------------------------------------------------

function writeReview(M, R, linksFile, ambiguousCount) {
  writeFileSync(path.join(SRC, 'review.json'), JSON.stringify({
    note: 'Not shipped. Generated by scripts/stats/build.mjs. conflicts: Wikidata and Wikipedia disagree beyond rounding, so neither value is in js/stats.json until overrides.json records a choice. resolved: conflicts settled by an overrides.json rule or choice. unparsed: values left out because they did not parse cleanly or failed a check. linkProblems: links.json entries the build could not use. extraFields: infobox values outside the contract (max vertical angle, status).',
    generated: R.refDate,
    conflicts: R.conflicts, resolved: R.resolved, linkProblems: R.linkProblems, unparsed: R.unparsed, extraFields: R.extras,
  }, null, 1) + '\n');

  const total = M.coasters.length;
  const pct = (n, d = total) => `${((100 * n) / d).toFixed(1)}%`;
  const ids = Object.keys(R.stats);
  const count = (pred) => ids.filter((id) => pred(R.stats[id])).length;
  const LABELS = { height: 'Height', drop: 'Drop', length: 'Length', speed: 'Speed', inversions: 'Inversions', gforce: 'G-force', duration: 'Ride duration', manufacturer: 'Manufacturer', designer: 'Designer', model: 'Model', material: 'Material', type: 'Type', opened: 'Opening date', closed: 'Closing date' };
  const links = linksFile.links;
  const nWd = Object.values(links).filter((l) => l.wd).length;
  const nWp = Object.values(links).filter((l) => l.wp).length;
  const bySrc = (src) => FIELDS.reduce((n, f) => n + count((e) => e[f]?.src === src), 0);
  const cites = {};
  for (const e of Object.values(R.stats)) for (const f of FIELDS) if (e[f]?.cite) cites[e[f].cite] = (cites[e[f].cite] || 0) + 1;
  const fmtQ = (e, f) => (e?.[f] ? `${e[f].pub ? `${e[f].pub[0]} ${e[f].pub[1]}` : e[f].v} (${e[f].src})` : '–');
  const fmtVal = (x) => (x == null ? '–' : Array.isArray(x) ? (typeof x[1] === 'string' && x.length === 2 && typeof x[0] === 'number' ? `${x[0]} ${x[1]}` : x.join(', ')) : x);
  const cp = loadCedarPointOperating();
  const conflictCount = (f) => R.conflicts.filter((x) => x.field === f).length;
  const gRows = ids.filter((id) => R.stats[id].gforce);
  const unparsedBy = {};
  for (const u of R.unparsed) { const k = `${u.source}|${u.field}|${u.reason}`; unparsedBy[k] = (unparsedBy[k] || 0) + 1; }
  const sizeKb = (Buffer.byteLength(R.text) / 1024).toFixed(1);

  const md = `# Ride stats coverage

Generated by \`scripts/stats/build.mjs\` from Wikidata data retrieved ${R.wdDate} (CC0) and English Wikipedia infoboxes retrieved ${R.wpDate} (CC BY-SA 4.0, © Wikipedia contributors). Don't edit by hand. Not shipped.

## Summary

- Coasters in \`js/data.js\`: **${total}**. Linked (\`links.json\`): ${nWd} to Wikidata, ${nWp} to a Wikipedia infobox.
- Coasters in \`js/stats.json\`: **${ids.length}** (${pct(ids.length)}). Values: ${bySrc('wp')} from Wikipedia, ${bySrc('wd')} from Wikidata. File size ${sizeKb} KB.
- Conflicts withheld: **${R.conflicts.length}**. Resolved by overrides: ${R.resolved.length}. Values left out (did not parse or failed a check): ${R.unparsed.length}. Link problems: ${R.linkProblems.length}. Ambiguous matches for review (\`ambiguous.json\`): ${ambiguousCount}.
- \`cite\` on Wikipedia values: ${Object.entries(cites).sort().map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}. Values with no inline reference in the infobox have no \`cite\`.

## Field coverage

"Wikidata only" is what Wikidata alone would give. Conflicts are withheld from both columns.

| Field | Wikidata only | Shipped | % of ${total} | Added by Wikipedia | Conflicts withheld |
| --- | ---: | ---: | ---: | ---: | ---: |
${FIELDS.map((f) => `| ${LABELS[f]} | ${R.before[f]} | ${R.after[f]} | ${pct(R.after[f])} | ${R.fromWp[f]} | ${conflictCount(f)} |`).join('\n')}
| Any of height, speed, length | | ${count((e) => e.height || e.speed || e.length)} | ${pct(count((e) => e.height || e.speed || e.length))} | | |
| All three | | ${count((e) => e.height && e.speed && e.length)} | ${pct(count((e) => e.height && e.speed && e.length))} | | |

## Cedar Point (${cp.length} operating coasters)

| Coaster | Height | Speed | Length | Inversions | G-force | Manufacturer | Material |
| --- | --- | --- | --- | --- | --- | --- | --- |
${cp.map((id) => { const e = R.stats[id]; return `| ${M.coasterById.get(id)?.name || id} | ${fmtQ(e, 'height')} | ${fmtQ(e, 'speed')} | ${fmtQ(e, 'length')} | ${fmtQ(e, 'inversions')} | ${fmtQ(e, 'gforce')} | ${e?.manufacturer ? `${e.manufacturer.v} (${e.manufacturer.src})` : '–'} | ${fmtQ(e, 'material')} |`; }).join('\n')}

## Resolved by overrides

| Coaster | Field | Shipped | Wikidata | Wikipedia | By |
| --- | --- | --- | --- | --- | --- |
${R.resolved.map((x) => `| ${x.name} (\`${x.coasterId}\`) | ${LABELS[x.field]} | ${fmtVal(x.value)} | ${fmtVal(x.wd)} | ${fmtVal(x.wp)} | ${x.by} |`).join('\n') || '| – | – | – | – | – | – |'}

## Conflicts withheld

| Coaster | Field | Wikidata | Wikipedia | Note |
| --- | --- | --- | --- | --- |
${R.conflicts.map((x) => `| ${x.name} (\`${x.coasterId}\`) | ${LABELS[x.field]} | ${fmtVal(x.wd.pub || x.wd.v)} ([${x.wd.qid}](https://www.wikidata.org/wiki/${x.wd.qid})) | ${fmtVal(x.wp.pub || x.wp.v)} ([${x.wp.article}](https://en.wikipedia.org/w/index.php?oldid=${x.wp.revid}), \`${x.wp.param}\`) | ${x.hint || ''} |`).join('\n') || '| – | – | – | – | – |'}

## G-force (${gRows.length} coasters, all from Wikipedia)

${gRows.map((id) => `${M.coasterById.get(id).name} ${R.stats[id].gforce.v}`).join(' · ')}

## Values left out

| Source | Field | Reason | Count |
| --- | --- | --- | ---: |
${Object.entries(unparsedBy).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => { const [s, f, r] = k.split('|'); return `| ${s} | ${LABELS[f] || f} | ${r} | ${n} |`; }).join('\n')}

## Link problems

${R.linkProblems.map((p) => `- \`${p.coasterId}\`: ${p.problem}`).join('\n') || '- None.'}

${M.unmatchedMd}`;
  writeFileSync(path.join(SRC, 'coverage.md'), md);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = new Set(process.argv.slice(2));
const known = ['--offline', '--fetch', '--fetch-wikipedia', '--relink'];
if (!args.size || [...args].some((a) => !known.includes(a)) || (args.has('--offline') && (args.has('--fetch') || args.has('--fetch-wikipedia')))) {
  console.log('Usage: node scripts/stats/build.mjs --offline | --fetch | --fetch-wikipedia  [--relink]');
  process.exit(args.size ? 1 : 0);
}
const db = loadDb();
let wdRaw = existsSync(WD_RAW_FILE) ? readJson(WD_RAW_FILE) : null;
if (args.has('--fetch')) wdRaw = await fetchWikidata();
if (!wdRaw) throw new Error(`missing ${rel(WD_RAW_FILE)}; run with --fetch`);
let wpRaw = existsSync(WP_RAW_FILE) ? readJson(WP_RAW_FILE) : null;
if (args.has('--fetch') || args.has('--fetch-wikipedia')) wpRaw = await fetchWikipedia(wdRaw, db);
if (!wpRaw) throw new Error(`missing ${rel(WP_RAW_FILE)}; run with --fetch-wikipedia`);

const refDate = [wdRaw.retrieved.slice(0, 10), wpRaw.retrieved.slice(0, 10)].sort().at(-1);
setReferenceDate(refDate);
const M = matchWikidata(wdRaw, db);
const pages = loadPages(wpRaw);
const overrides = existsSync(OVERRIDES_FILE) ? readJson(OVERRIDES_FILE) : { rules: [], choices: {} };
let linksFile = existsSync(LINKS_FILE) ? readJson(LINKS_FILE) : null;
let ambiguousCount = existsSync(path.join(SRC, 'ambiguous.json')) ? readJson(path.join(SRC, 'ambiguous.json')).count : 0;
if (args.has('--relink') || !linksFile) {
  const { links, ambiguous } = relink(M, pages, wpRaw, linksFile?.links);
  linksFile = {
    note: 'Committed build input: coaster ID -> Wikidata QID (wd) and English Wikipedia article (wp). Proposed by `build.mjs --relink` and reviewed by coaster_data_curator. wpBox picks the infobox when an article has several; wpTrack picks one track of a dual-track infobox; earlierRide lists credits the article also covers (their figures are never used). Set "manual": true on an entry to keep it as written when relinking.',
    method: 'Wikidata: name (label, Wikipedia title, or alias) plus park, city, or state evidence. Wikipedia: the item\'s English sitelink, using the infobox at this park; or an infobox whose location names this park exactly and whose name or title equals the coaster\'s name (or one track\'s), unique on both sides. Everything else is in ambiguous.json.',
    links,
  };
  writeFileSync(LINKS_FILE, JSON.stringify(linksFile, null, 1) + '\n');
  writeFileSync(path.join(SRC, 'ambiguous.json'), JSON.stringify({ note: 'Matches the build would not make on its own. A person decides; confirmed ones go into links.json as "manual".', count: ambiguous.length, items: ambiguous }, null, 1) + '\n');
  ambiguousCount = ambiguous.length;
  console.log(`wrote ${rel(LINKS_FILE)} (${Object.keys(links).length} coasters) and ambiguous.json (${ambiguous.length})`);
}
const R = build(M, pages, wpRaw, linksFile, overrides);
writeFileSync(OUT_FILE, R.text);
writeReview(M, R, linksFile, ambiguousCount);
console.log(`wrote ${rel(OUT_FILE)}: ${Object.keys(R.stats).length} coasters, ${(Buffer.byteLength(R.text) / 1024).toFixed(1)} KB; conflicts ${R.conflicts.length}, resolved ${R.resolved.length}, left out ${R.unparsed.length}, link problems ${R.linkProblems.length}`);
