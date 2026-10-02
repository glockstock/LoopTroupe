#!/usr/bin/env node
// Generates data/synthetic-test-park.json: a SYNTHETIC fixture shaped exactly
// like an Overpass `out geom` JSON response, for developing the renderer while
// OpenStreetMap is unreachable.
//
// Everything here is fictional: the park ("Test Park"), every name, and the
// coordinates (a few hundred meters from 0°N 0°E, "Null Island", in the open
// ocean). Element ids are negative, the OSM convention for objects that do not
// exist in the database. This is NOT OpenStreetMap data and must never be shown
// as a real park.
//
//   node spikes/osm-park-map/make-synthetic.mjs

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const LAT0 = 0.0005, LON0 = 0.0005;
const M_LAT = 110574, M_LON = 111320;

let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

let nodeId = -1000, wayId = -2000, relId = -3000;
const elements = [];
const ll = ([x, y]) => ({ lat: +(LAT0 + y / M_LAT).toFixed(7), lon: +(LON0 + x / M_LON).toFixed(7) });

function bounds(geom) {
  const lats = geom.map(g => g.lat), lons = geom.map(g => g.lon);
  return { minlat: Math.min(...lats), minlon: Math.min(...lons), maxlat: Math.max(...lats), maxlon: Math.max(...lons) };
}

function node([x, y], tags) {
  const el = { type: 'node', id: nodeId--, ...ll([x, y]) };
  if (tags) el.tags = tags;
  elements.push(el);
  return el;
}

// A way with its own node ids. `closed` repeats the first node id at the end.
// `ids` lets several ways share endpoint nodes (a coaster split into segments).
function way(pts, tags, { closed = false, ids = null } = {}) {
  const nodeIds = ids || pts.map(() => nodeId--);
  const geometry = pts.map(ll);
  if (closed) { nodeIds.push(nodeIds[0]); geometry.push(geometry[0]); }
  const el = { type: 'way', id: wayId--, bounds: bounds(geometry), nodes: nodeIds, geometry, tags };
  elements.push(el);
  return el;
}

function multipolygon(outer, inners, tags) {
  const mk = pts => { const g = pts.map(ll); g.push(g[0]); return g; };
  const members = [{ type: 'way', ref: wayId--, role: 'outer', geometry: mk(outer) }]
    .concat(inners.map(r => ({ type: 'way', ref: wayId--, role: 'inner', geometry: mk(r) })));
  const el = { type: 'relation', id: relId--, bounds: bounds(members[0].geometry), members, tags: { type: 'multipolygon', ...tags } };
  elements.push(el);
  return el;
}

const rect = (cx, cy, w, h, deg = 0) => {
  const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y]) => [+(cx + x * c - y * s).toFixed(2), +(cy + x * s + y * c).toFixed(2)]);
};
const ring = (cx, cy, rx, ry, n, wob = 0, rot = 0) => Array.from({ length: n }, (_, i) => {
  const t = i / n * Math.PI * 2, r = 1 + wob * Math.sin(3 * t + 1);
  const x = rx * r * Math.cos(t), y = ry * r * Math.sin(t), a = rot * Math.PI / 180;
  return [cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)];
});

// ---------- the park outline (tourism=theme_park) ----------
const outline = [[0, 0], [560, 0], [640, 90], [640, 470], [420, 540], [120, 520], [0, 400]];
way(outline, { tourism: 'theme_park', name: 'Test Park', note: 'SYNTHETIC FIXTURE: fictional park' }, { closed: true });

// ---------- ground ----------
way([[20, 12], [210, 12], [210, 85], [20, 85]], { amenity: 'parking', parking: 'surface' }, { closed: true });
way([[300, -90], [480, -90], [480, -20], [300, -20]], { amenity: 'parking', note: 'outside the outline: renderer should not draw it' }, { closed: true });
way([[20, 405], [70, 405], [150, 500], [118, 512]], { natural: 'wood' }, { closed: true });
way([[330, 20], [400, 20], [400, 60], [330, 60]], { leisure: 'garden', name: 'Fixture Gardens' }, { closed: true });
multipolygon(ring(330, 290, 72, 58, 20, .08), [ring(348, 298, 14, 10, 8)], { natural: 'water', water: 'lake', name: 'Mock Lake' });

// ---------- paths ----------
way([[240, 20], [320, 20], [320, 90], [240, 90]], { highway: 'pedestrian', area: 'yes', name: 'Entry Plaza' }, { closed: true });
way([[280, -40], [280, 20]], { highway: 'footway' });
const loop = ring(330, 290, 150, 125, 28, .03);
way(loop, { highway: 'footway', name: 'Midway Loop' }, { closed: true });
way([[280, 90], [300, 130], loop[21]], { highway: 'footway' });
way([[150, 60], [240, 55]], { highway: 'footway' });
way([loop[14], [130, 300], [100, 240]], { highway: 'footway' });
way([loop[10], [230, 410], [200, 470]], { highway: 'footway' });
way([loop[3], [470, 360], [500, 380]], { highway: 'footway' });
way([loop[6], [380, 450], [420, 470]], { highway: 'footway' });
way([loop[0], [500, 270], [510, 200]], { highway: 'footway' });
way([loop[23], [420, 160], [440, 150]], { highway: 'footway' });
way([[100, 240], [110, 180]], { highway: 'path' });
way([[15, 60], [15, 390], [125, 505], [300, 520]], { railway: 'narrow_gauge', name: 'Fixture Line' });

// ---------- roller coasters ----------
// 1. Big steel circuit. Track unnamed; named by an attraction=roller_coaster area with a height tag.
const flyer = ring(540, 300, 62, 150, 48, .06, 6);
way(flyer, { roller_coaster: 'track' }, { closed: true });
way(rect(540, 300, 160, 330, 6), { attraction: 'roller_coaster', name: 'Fixture Flyer', height: '62 m' }, { closed: true });
way([flyer[30], flyer[33]], { roller_coaster: 'station' });

// 2. Wooden figure-eight split into three ways that share endpoint nodes; name on the track, no height.
const fig8 = Array.from({ length: 60 }, (_, i) => {
  const t = i / 60 * Math.PI * 2;
  return [160 + 105 * Math.sin(t), 410 + 120 * Math.sin(t) * Math.cos(t)];
});
const fig8ids = fig8.map(() => nodeId--);
const plungeTags = { roller_coaster: 'track', name: 'Placeholder Plunge', material: 'wood' };
way(fig8.slice(0, 21), plungeTags, { ids: fig8ids.slice(0, 21) });
way(fig8.slice(20, 41), plungeTags, { ids: fig8ids.slice(20, 41) });
way([...fig8.slice(40), fig8[0]], plungeTags, { ids: [...fig8ids.slice(40), fig8ids[0]] });
node([160 + 105 * Math.sin(Math.PI * 2 * 3 / 60), 410 + 120 * Math.sin(Math.PI * 2 * 3 / 60) * Math.cos(Math.PI * 2 * 3 / 60)], { roller_coaster: 'station' });

// 3. Switchback "mouse" circuit. Track unnamed; an attraction node nearby carries the name.
const mouse = [];
for (let r = 0; r < 5; r++) {
  const y = 168 + r * 12;
  mouse.push(...(r % 2 ? [[145, y], [55, y]] : [[50, y], [145, y]]));
}
mouse.push([152, 232], [40, 232], [40, 160]);
way(mouse, { roller_coaster: 'track' }, { closed: true });
node([92, 150], { attraction: 'roller_coaster', name: 'Mock Mouse' });

// 4. Family coaster with a height tag in feet.
way(ring(425, 112, 48, 26, 26, .12), { roller_coaster: 'track', name: 'Null Island Express', height: '40 ft' }, { closed: true });

// 5. Twisted circuit with layer=1 and no height.
const twist = Array.from({ length: 54 }, (_, i) => {
  const t = i / 54 * Math.PI * 2, r = 44 + 16 * Math.cos(3 * t);
  return [480 + r * Math.cos(t), 445 + r * Math.sin(t) * .8];
});
way(twist, { roller_coaster: 'track', name: 'Testbed Twister', layer: '1' }, { closed: true });

// 6. A small track with no name anywhere.
way(ring(245, 215, 22, 13, 16), { roller_coaster: 'track' }, { closed: true });

// 7. An open (shuttle-style) track: no circuit.
way([[360, 40], [420, 36], [480, 38], [530, 44], [575, 52]], { roller_coaster: 'track', name: 'Proto Launcher', height: '45 m' });

// 8. A coaster mapped only as a point, no track geometry.
node([150, 290], { attraction: 'roller_coaster', name: 'Demo Dragon' });

// ---------- other attractions ----------
node([292, 132], { attraction: 'carousel', name: 'Sample Carousel' });
node([402, 228], { attraction: 'big_wheel', name: 'Stub Wheel' });
node([218, 300], { attraction: 'drop_tower', name: 'Example Drop' });
way(rect(205, 140, 36, 24, -12), { building: 'yes', attraction: 'dark_ride', name: 'Fake Manor', height: '11' }, { closed: true });

// ---------- buildings ----------
const B = (cx, cy, w, h, deg, tags) => way(rect(cx, cy, w, h, deg), tags, { closed: true });
B(226, 40, 18, 34, 0, { building: 'yes', name: 'Entry Hall West', height: '8' });
B(334, 40, 18, 34, 0, { building: 'yes', name: 'Entry Hall East', height: '8' });
B(300, 505, 90, 22, -14, { building: 'hotel', 'building:levels': '5', name: 'Sample Lodge' });
B(470, 300, 14, 26, 6, { building: 'yes' }); // Fixture Flyer station house
B(250, 160, 24, 14, 20, { building: 'retail', name: 'Snack Stand' });
B(410, 190, 20, 14, -30, { building: 'retail' });
B(180, 330, 22, 16, 35, { building: 'retail' });
B(440, 395, 26, 16, 0, { building: 'yes' });
B(370, 165, 10, 8, 0, { building: 'toilets' });
B(120, 270, 30, 18, 70, { building: 'yes', height: '6' });
B(560, 120, 30, 20, 0, { building: 'warehouse', height: '9' });
B(95, 120, 28, 20, 0, { building: 'yes' });
B(520, 470, 24, 14, -20, { building: 'retail' });
// an L-shaped building
way([[600, 200], [625, 200], [625, 250], [612, 250], [612, 215], [600, 215]], { building: 'yes', height: '7' }, { closed: true });

// ---------- trees ----------
for (let i = 0; i < 70; i++) {
  const p = loop[Math.floor(rand() * loop.length)];
  const a = rand() * Math.PI * 2, d = 8 + rand() * 14;
  node([p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d], { natural: 'tree' });
}
way([[30, 100], [230, 100]], { natural: 'tree_row' });

const out = {
  version: 0.6,
  generator: 'SYNTHETIC FIXTURE (make-synthetic.mjs). Not OpenStreetMap data.',
  osm3s: {
    timestamp_osm_base: 'synthetic',
    copyright: 'Synthetic test data for the Loop Troupe park-map spike. Fictional park, names and coordinates (near 0,0). Not from OpenStreetMap.',
  },
  loopTroupe: {
    synthetic: true,
    parkId: 'synthetic-test-park',
    label: 'Test Park (synthetic fixture)',
    note: 'Every element here is invented. Ids are negative. Never present this as a real park.',
  },
  elements,
};

await writeFile(join(HERE, 'data', 'synthetic-test-park.json'), JSON.stringify(out, null, 1));
console.log(`wrote data/synthetic-test-park.json: ${elements.length} elements`);
