#!/usr/bin/env node
// Fetch one park's map data from the Overpass API and save it as
// data/<park-id>.json, in Overpass's own `out geom` JSON shape.
// Node built-ins only (global fetch). Data is © OpenStreetMap contributors, ODbL.
//
//   node spikes/osm-park-map/fetch.mjs --probe            # one tiny query: is Overpass reachable?
//   node spikes/osm-park-map/fetch.mjs --print cedar-point  # print the exact queries, no network
//   node spikes/osm-park-map/fetch.mjs cedar-point          # fetch one park from parks.json
//   node spikes/osm-park-map/fetch.mjs --all                # fetch every park in parks.json
//   node spikes/osm-park-map/fetch.mjs --source osm-api cedar-point
//        # main OSM API instead of Overpass: ONE /map.json request for the park's
//        # bbox in parks.json, converted to the same Overpass `out geom` shape
//
// Behind an HTTPS proxy, Node's built-in fetch needs NODE_USE_ENV_PROXY=1 (Node >= 22.21).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'LoopTroupe-park-map-spike/0.2 (+https://github.com/glockstock/looptroupe; build-time only, one request per park)';
const OSM_API = 'https://api.openstreetmap.org/api/0.6/map.json';
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
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$"];
  way["natural"="coastline"];
);
out geom(${bb});`;
}

// The same selection as featureQuery, as a tag predicate, for sources that
// return everything in an area (the main OSM API's /map call).
const RE = {
  path: /^(footway|path|pedestrian|steps|living_street|service|cycleway|track)$/,
  road: /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$/,
  natural: /^(water|wood|scrub|beach|sand|tree_row|coastline)$/,
  landuse: /^(forest|grass|meadow|village_green|recreation_ground|flowerbed|basin|reservoir)$/,
  leisure: /^(garden|park|swimming_pool|water_park)$/,
  railway: /^(rail|narrow_gauge|miniature|monorail|light_rail)$/,
};
export function wanted(el) {
  const t = el.tags;
  if (!t) return false;
  if (t.tourism === 'theme_park' || t.roller_coaster || t.attraction || t.building || t.water) return true;
  if (el.type === 'node') return t.natural === 'tree';
  if (el.type === 'way' && t.highway && (RE.path.test(t.highway) || RE.road.test(t.highway))) return true;
  if (el.type === 'way' && t.railway && RE.railway.test(t.railway)) return true;
  if (t.natural === 'coastline') return el.type === 'way';
  return RE.natural.test(t.natural || '') || RE.landuse.test(t.landuse || '') || RE.leisure.test(t.leisure || '') || t.amenity === 'parking';
}

// /api/0.6/map.json -> Overpass `out geom` shape. Way geometry is resolved from
// the response's nodes (the map call returns every node of every way it lists);
// relation members outside the bbox are absent and keep no geometry. Editing
// metadata (user, uid, changeset, timestamp, version) is dropped: the renderer
// does not need it and it identifies individual mappers.
export function fromOsmApi(api) {
  const nodes = new Map(), ways = new Map();
  for (const el of api.elements) {
    if (el.type === 'node') nodes.set(el.id, el);
    else if (el.type === 'way') ways.set(el.id, el);
  }
  const geomOf = ids => ids.map(id => { const n = nodes.get(id); return n ? { lat: n.lat, lon: n.lon } : null; });
  const boundsOf = geom => {
    const g = geom.filter(Boolean);
    if (!g.length) return undefined;
    return { minlat: Math.min(...g.map(p => p.lat)), minlon: Math.min(...g.map(p => p.lon)), maxlat: Math.max(...g.map(p => p.lat)), maxlon: Math.max(...g.map(p => p.lon)) };
  };
  const out = [];
  let partial = 0;
  for (const el of api.elements) {
    if (!wanted(el)) continue;
    if (el.type === 'node') out.push({ type: 'node', id: el.id, lat: el.lat, lon: el.lon, tags: el.tags });
    else if (el.type === 'way') {
      const geometry = geomOf(el.nodes);
      out.push({ type: 'way', id: el.id, bounds: boundsOf(geometry), nodes: el.nodes, geometry, tags: el.tags });
    } else if (el.type === 'relation') {
      const members = el.members.map(m => {
        if (m.type === 'way' && ways.has(m.ref)) return { type: 'way', ref: m.ref, role: m.role, geometry: geomOf(ways.get(m.ref).nodes) };
        if (m.type === 'node' && nodes.has(m.ref)) { const n = nodes.get(m.ref); return { type: 'node', ref: m.ref, role: m.role, lat: n.lat, lon: n.lon }; }
        if (m.type === 'way') partial++;
        return { type: m.type, ref: m.ref, role: m.role };
      });
      out.push({ type: 'relation', id: el.id, bounds: boundsOf(members.flatMap(m => m.geometry || (m.lat != null ? [m] : []))), members, tags: el.tags });
    }
  }
  return { elements: out, partialMembers: partial, rawCounts: { nodes: nodes.size, ways: ways.size, relations: api.elements.length - nodes.size - ways.size } };
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

async function fetchParkOsmApi(p) {
  console.log(`\n${p.label} (${p.id}) via the main OSM API`);
  if (!p.bbox) { console.log('  no bbox in parks.json; skipped'); return 'skip'; }
  const [s, w, n, e] = p.bbox;
  if ((n - s) * (e - w) > 0.05) { console.log('  bbox larger than this spike allows (0.05 sq deg); skipped'); return 'skip'; }
  const url = `${OSM_API}?bbox=${w},${s},${e},${n}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(120000) });
  if (res.status === 429 || res.status === 509) {
    console.log(`  OSM API answered ${res.status} (rate limit / bandwidth). Stopping all requests.`);
    return 'stop';
  }
  if (!res.ok) { console.log(`  OSM API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`); return 'error'; }
  const api = await res.json();
  const conv = fromOsmApi(api);
  const outlines = conv.elements.filter(el => el.tags.tourism === 'theme_park' && new RegExp(p.nameRegex, 'i').test(el.tags.name || '') && el.bounds);
  outlines.sort((a, b) => (b.bounds.maxlat - b.bounds.minlat) * (b.bounds.maxlon - b.bounds.minlon) - (a.bounds.maxlat - a.bounds.minlat) * (a.bounds.maxlon - a.bounds.minlon));
  const park = outlines[0];
  const notes = [];
  if (!park) notes.push(`no tourism=theme_park named /${p.nameRegex}/ in the bbox`);
  else {
    const b = park.bounds, edge = 20 / 110574;
    if (b.minlat - s < edge || b.minlon - w < edge || n - b.maxlat < edge || e - b.maxlon < edge) notes.push('park outline reaches the bbox edge: the fetch may be clipped');
    if (park.type === 'relation' && park.members.some(m => m.type === 'way' && !m.geometry)) notes.push('park outline relation has members outside the bbox');
  }
  const out = {
    version: 0.6,
    generator: api.generator,
    osm3s: { timestamp_osm_base: new Date().toISOString(), copyright: api.copyright || 'OpenStreetMap and contributors', license: api.license },
    loopTroupe: {
      synthetic: false,
      source: 'osm-api',
      parkId: p.id,
      label: p.label,
      dbParkId: p.dbParkId,
      parkElement: park ? `${park.type}/${park.id}` : null,
      bbox: p.bbox,
      parkBbox: park ? bufferedBounds(park.bounds, BUFFER_M) : null,
      fetchedAt: new Date().toISOString(),
      endpoint: url,
      rawCounts: conv.rawCounts,
      notes,
      attribution: '© OpenStreetMap contributors. Data available under the Open Database License (ODbL): https://www.openstreetmap.org/copyright',
    },
    elements: conv.elements,
  };
  await mkdir(join(HERE, 'data'), { recursive: true });
  const file = join(HERE, 'data', `${p.id}.json`);
  await writeFile(file, JSON.stringify(out));
  const tracks = conv.elements.filter(el => el.tags.roller_coaster === 'track').length;
  console.log(`  raw ${conv.rawCounts.nodes} nodes / ${conv.rawCounts.ways} ways; kept ${conv.elements.length} elements (tracks ${tracks}); outline ${out.loopTroupe.parkElement || 'none'}`);
  for (const note of notes) console.log('  note: ' + note);
  console.log(`  saved ${file}`);
  return 'ok';
}

async function main() {
  const args = process.argv.slice(2);
  const flag = name => args.includes(name);
  const ei = args.indexOf('--endpoint');
  const endpoint = ei >= 0 ? args[ei + 1] : DEFAULT_ENDPOINT;
  const ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--endpoint' && args[i - 1] !== '--source');
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

  const si = args.indexOf('--source');
  if (si >= 0 && args[si + 1] === 'osm-api') {
    // OSM API usage policy: identify ourselves, one request per park, spaced out, no retry loops.
    for (const [i, p] of chosen.entries()) {
      if (i) await new Promise(r => setTimeout(r, 6000));
      let r;
      try { r = await fetchParkOsmApi(p); } catch (err) { console.error(`  failed: ${err.cause ? err.cause.message || err.cause.code : err.message}`); r = 'error'; }
      if (r === 'stop') { process.exitCode = 3; return; }
      if (r === 'error') process.exitCode = 1;
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
