#!/usr/bin/env node
// Fetch one park's map data from the Overpass API and save it as
// data/<park-id>.json, in Overpass's own `out geom` JSON shape.
// Node built-ins only (global fetch). Data is © OpenStreetMap contributors, ODbL.
//
//   node spikes/osm-park-map/fetch.mjs --probe            # one tiny query: is Overpass reachable?
//   node spikes/osm-park-map/fetch.mjs --print cedar-point  # print the exact queries, no network
//   node spikes/osm-park-map/fetch.mjs cedar-point          # fetch one park from parks.json
//   node spikes/osm-park-map/fetch.mjs --all                # fetch every park in parks.json
//
// Behind an HTTPS proxy, Node's built-in fetch needs NODE_USE_ENV_PROXY=1 (Node >= 22.21).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'LoopTroupe-osm-park-map-spike/0.1 (static coaster tracker; low-volume, one park at a time)';
const BUFFER_M = 120; // grab features slightly outside the park outline (tracks often overhang it)

// ---------- queries ----------

// Step 1: find the park outline by name near a known point.
export function parkQuery(p) {
  const [lat, lon] = p.near;
  return `[out:json][timeout:60];
nwr["tourism"="theme_park"]["name"~"${p.nameRegex}",i](around:${p.radius || 4000},${lat},${lon});
out geom;`;
}

// Step 2: everything the renderer draws, inside the outline's bounding box
// (plus a buffer). Geometry is clipped to the same box so a huge lake or
// forest relation that touches the park does not dump its whole outline.
export function featureQuery([s, w, n, e]) {
  const bb = [s, w, n, e].map(v => v.toFixed(6)).join(',');
  return `[out:json][timeout:180][maxsize:268435456][bbox:${bb}];
(
  nwr["roller_coaster"];
  nwr["attraction"];
  way["highway"~"^(footway|path|pedestrian|steps|living_street|service|cycleway|track)$"];
  nwr["building"];
  nwr["natural"~"^(water|wood|scrub|beach|sand|tree_row)$"];
  nwr["water"];
  node["natural"="tree"];
  nwr["landuse"~"^(forest|grass|meadow|village_green|recreation_ground|flowerbed|basin|reservoir)$"];
  nwr["leisure"~"^(garden|park|swimming_pool|water_park)$"];
  nwr["amenity"="parking"];
  way["railway"~"^(rail|narrow_gauge|miniature|monorail|light_rail)$"];
);
out geom(${bb});`;
}

// ---------- helpers ----------

async function overpass(endpoint, query, attempt = 1) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
    body: 'data=' + encodeURIComponent(query),
    signal: AbortSignal.timeout(240000),
  });
  if ((res.status === 429 || res.status === 504) && attempt < 4) {
    const wait = 15000 * attempt;
    console.warn(`  Overpass answered ${res.status}; waiting ${wait / 1000}s (attempt ${attempt})`);
    await new Promise(r => setTimeout(r, wait));
    return overpass(endpoint, query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

const areaOf = el => {
  const b = el.bounds;
  return b ? (b.maxlat - b.minlat) * (b.maxlon - b.minlon) : 0;
};

function bufferedBounds(b, meters) {
  const dLat = meters / 110574;
  const dLon = meters / (111320 * Math.cos(((b.minlat + b.maxlat) / 2) * Math.PI / 180));
  return [b.minlat - dLat, b.minlon - dLon, b.maxlat + dLat, b.maxlon + dLon];
}

async function loadParks() {
  return JSON.parse(await readFile(join(HERE, 'parks.json'), 'utf8')).parks;
}

// ---------- commands ----------

async function probe(endpoint) {
  const q = '[out:json][timeout:10];node(1);out ids;';
  try {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(q), signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    console.log(`reachable: ${endpoint} (osm base ${json.osm3s && json.osm3s.timestamp_osm_base})`);
    return true;
  } catch (err) {
    console.log(`NOT reachable: ${endpoint}\n  ${err.cause ? err.cause.message || err.cause.code : err.message}`);
    return false;
  }
}

async function fetchPark(p, endpoint) {
  console.log(`\n${p.label} (${p.id})`);
  const found = await overpass(endpoint, parkQuery(p));
  const outlines = found.elements.filter(el => el.bounds).sort((a, b) => areaOf(b) - areaOf(a));
  if (!outlines.length) {
    console.log(`  no tourism=theme_park named /${p.nameRegex}/i within ${p.radius || 4000} m of ${p.near}; nothing saved`);
    return null;
  }
  const park = outlines[0];
  if (outlines.length > 1) console.log(`  ${outlines.length} outlines matched; using the largest: ${park.type}/${park.id} "${park.tags.name}"`);
  const bbox = bufferedBounds(park.bounds, BUFFER_M);
  const fq = featureQuery(bbox);
  const feats = await overpass(endpoint, fq);
  const seen = new Set(feats.elements.map(el => el.type + el.id));
  const elements = seen.has(park.type + park.id) ? feats.elements : [park, ...feats.elements];
  const out = {
    version: feats.version,
    generator: feats.generator,
    osm3s: feats.osm3s,
    loopTroupe: {
      synthetic: false,
      parkId: p.id,
      label: p.label,
      dbParkId: p.dbParkId,
      parkElement: `${park.type}/${park.id}`,
      bbox,
      fetchedAt: new Date().toISOString(),
      endpoint,
      queries: [parkQuery(p), fq],
      attribution: '© OpenStreetMap contributors. Data available under the Open Database License (ODbL): https://www.openstreetmap.org/copyright',
    },
    elements,
  };
  await mkdir(join(HERE, 'data'), { recursive: true });
  const file = join(HERE, 'data', `${p.id}.json`);
  await writeFile(file, JSON.stringify(out));
  const n = k => elements.filter(el => el.tags && el.tags[k] !== undefined).length;
  console.log(`  saved ${file}: ${elements.length} elements (tracks ${elements.filter(el => el.tags && el.tags.roller_coaster === 'track').length}, attractions ${n('attraction')}, buildings ${n('building')})`);
  return file;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);
  const ei = args.indexOf('--endpoint');
  const endpoint = ei >= 0 ? args[ei + 1] : DEFAULT_ENDPOINT;
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--endpoint');
  const parks = await loadParks();

  if (flag('--probe')) { process.exitCode = (await probe(endpoint)) ? 0 : 2; return; }

  const chosen = flag('--all') ? parks : parks.filter(p => ids.includes(p.id));
  const unknown = ids.filter(id => !parks.some(p => p.id === id));
  if (unknown.length) console.warn(`unknown park id(s): ${unknown.join(', ')} (see parks.json)`);
  if (!chosen.length) {
    console.log('usage: fetch.mjs [--probe] [--print] [--all] [--endpoint URL] <park-id ...>');
    console.log('parks: ' + parks.map(p => p.id).join(', '));
    return;
  }

  if (flag('--print')) {
    for (const p of chosen) {
      console.log(`# ${p.label}: step 1, find the park outline\n${parkQuery(p)}\n`);
      console.log(`# ${p.label}: step 2, features in the outline's bbox + ${BUFFER_M} m (bbox shown is a placeholder)\n${featureQuery([p.near[0] - .01, p.near[1] - .01, p.near[0] + .01, p.near[1] + .01])}\n`);
    }
    return;
  }

  for (const [i, p] of chosen.entries()) {
    if (i) await new Promise(r => setTimeout(r, 5000)); // be gentle with a shared public server
    try { await fetchPark(p, endpoint); } catch (err) {
      console.error(`  failed: ${err.cause ? err.cause.message || err.cause.code : err.message}`);
      process.exitCode = 1;
    }
  }
}

main();
