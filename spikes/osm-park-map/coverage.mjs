#!/usr/bin/env node
// Coverage report: how well does a fetched park's OSM data cover the coasters
// Loop Troupe lists for it (js/data.js)?
//
//   node spikes/osm-park-map/coverage.mjs cedar-point        # one park (data/cedar-point.json)
//   node spikes/osm-park-map/coverage.mjs --all              # every fetched park in parks.json
//   node spikes/osm-park-map/coverage.mjs synthetic-test-park --db data/synthetic-test-park.db.json
//
// For each park it counts: coasters in js/data.js, named attraction=roller_coaster
// features, roller_coaster=track ways, and coasters assembled from track; then
// matches names (exact after normalization, or fuzzy, which is flagged for review).

import { readFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPark, normName } from './model.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return d[a.length][b.length];
}

function match(dbName, osmNames) {
  const n = normName(dbName);
  const exact = osmNames.find(o => normName(o) === n);
  if (exact) return { name: exact, kind: 'exact' };
  const fuzzy = osmNames.find(o => {
    const m = normName(o);
    return (m.length >= 5 && n.length >= 5 && (m.includes(n) || n.includes(m))) || lev(m, n) <= 2;
  });
  return fuzzy ? { name: fuzzy, kind: 'fuzzy' } : null;
}

async function loadDb() {
  const src = await readFile(join(REPO, 'js', 'data.js'), 'utf8');
  return new Function(src + '\nreturn COASTER_DB;')();
}

async function report(id, { dbFile, dbParkId, json }) {
  const osm = JSON.parse(await readFile(join(HERE, 'data', `${id}.json`), 'utf8'));
  const park = buildPark(osm);
  let dbNames = [], dbLabel = 'none';
  if (dbFile) {
    const db = JSON.parse(await readFile(join(HERE, dbFile.replace(/^spikes\/osm-park-map\//, '')), 'utf8'));
    dbNames = db.coasters; dbLabel = `${dbFile} (${db.note || 'fixture'})`;
  } else if (dbParkId) {
    const db = await loadDb();
    const p = db.parks.find(x => x.id === dbParkId);
    if (p) { dbNames = p.coasters.map(c => c.name); dbLabel = `js/data.js park "${p.id}"`; }
  }

  const withTrack = park.coasters.filter(c => c.tracks.length);
  const osmNames = park.coasters.filter(c => c.nameSource !== 'none').map(c => c.name);
  const rows = dbNames.map(n => {
    const m = match(n, osmNames);
    const c = m && park.coasters.find(x => x.name === m.name);
    return { db: n, osm: m ? m.name : null, kind: m ? m.kind : 'missing', track: c ? c.tracks.length > 0 : false, nameSource: c ? c.nameSource : null };
  });
  const matched = new Set(rows.filter(r => r.osm).map(r => r.osm));
  const osmOnly = park.coasters.filter(c => !matched.has(c.name));

  const out = {
    park: id, synthetic: park.synthetic, db: dbLabel,
    counts: {
      dbCoasters: dbNames.length,
      namedAttractionRollerCoaster: park.counts.namedCoasterFeatures,
      attractionRollerCoaster: park.counts.coasterFeatures,
      trackWays: park.counts.trackWays,
      coastersWithTrack: withTrack.length,
      namedCoastersWithTrack: withTrack.filter(c => c.nameSource !== 'none').length,
      heightTagged: withTrack.filter(c => c.heightSource === 'OSM tag').length,
      dbMatchedExact: rows.filter(r => r.kind === 'exact').length,
      dbMatchedFuzzy: rows.filter(r => r.kind === 'fuzzy').length,
      dbMatchedWithTrack: rows.filter(r => r.track).length,
      dbMissing: rows.filter(r => r.kind === 'missing').length,
    },
    rows,
    osmOnly: osmOnly.map(c => ({ name: c.name, track: c.tracks.length > 0, nameSource: c.nameSource })),
    warnings: park.warnings,
  };
  if (json) { console.log(JSON.stringify(out, null, 1)); return out; }

  const k = out.counts;
  console.log(`\n## ${id}${park.synthetic ? ' (SYNTHETIC FIXTURE, not a real park)' : ''}`);
  console.log(`DB: ${dbLabel}`);
  console.log(`DB coasters ${k.dbCoasters} | attraction=roller_coaster ${k.attractionRollerCoaster} (${k.namedAttractionRollerCoaster} named) | roller_coaster=track ways ${k.trackWays} -> ${k.coastersWithTrack} coasters with track (${k.namedCoastersWithTrack} named, ${k.heightTagged} with a height tag)`);
  if (dbNames.length) {
    console.log(`DB matches: ${k.dbMatchedExact} exact, ${k.dbMatchedFuzzy} fuzzy (review), ${k.dbMissing} missing; ${k.dbMatchedWithTrack} of ${k.dbCoasters} have drawable track`);
    console.log('\n| Loop Troupe coaster | OSM name | match | track geometry | OSM name from |\n| --- | --- | --- | --- | --- |');
    for (const r of rows) console.log(`| ${r.db} | ${r.osm || '—'} | ${r.kind} | ${r.track ? 'yes' : 'no'} | ${r.nameSource || '—'} |`);
  }
  if (osmOnly.length) {
    console.log(`\nIn OSM but not matched to the DB (${osmOnly.length}):`);
    for (const c of out.osmOnly) console.log(`- ${c.name} (${c.track ? 'track' : 'no track'}; name from ${c.nameSource})`);
  }
  for (const w of park.warnings) console.log(`warning: ${w}`);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const json = args.includes('--json');
  const ids = args.filter((a, i) => !a.startsWith('--') && !['--db', '--db-park'].includes(args[i - 1]));
  const parks = JSON.parse(await readFile(join(HERE, 'parks.json'), 'utf8')).parks;
  const targets = args.includes('--all') ? parks.map(p => p.id) : ids;
  if (!targets.length) { console.log('usage: coverage.mjs <park-id> [--db fixture.json | --db-park js-data-id] [--json] | --all'); return; }
  for (const id of targets) {
    const cfg = parks.find(p => p.id === id) || {};
    try { await access(join(HERE, 'data', `${id}.json`)); } catch {
      console.log(`\n## ${id}: data/${id}.json not fetched yet (run fetch.mjs ${id})`);
      continue;
    }
    await report(id, { dbFile: opt('--db'), dbParkId: opt('--db-park') || cfg.dbParkId, json });
  }
}

main();
