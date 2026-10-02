// Overpass `out geom` JSON -> a park model in local meters.
// Shared by the browser renderer (map.mjs) and Node scripts (coverage.mjs).
// No DOM, no dependencies.
//
// Coordinates: x = meters east, y = meters north of the park's center.
// Heights: meters above flat ground (terrain elevation is ignored).

const M_LAT = 110574, M_LON_EQ = 111320;

// ---------- small geometry helpers ----------

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function polylineLength(pts, closed = false) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) L += dist(pts[pts.length - 1], pts[0]);
  return L;
}

export function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const pointInPoly = (p, poly) => pointInRing(p, poly.outer) && !poly.inners.some(r => pointInRing(p, r));

// Closest point on a polyline: returns { d, s } (distance, arc length at that point).
export function nearestOnPath(p, pts, closed = false) {
  let best = { d: Infinity, s: 0 }, acc = 0;
  const n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
    const d = Math.hypot(a[0] + dx * t - p[0], a[1] + dy * t - p[1]);
    const len = Math.sqrt(len2);
    if (d < best.d) best = { d, s: acc + t * len };
    acc += len;
  }
  return best;
}

export function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}

function ringArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return a / 2;
}

// "62", "62 m", "62m", "205 ft", "205'", "~60 m" -> meters (or null)
export function parseLength(v) {
  if (v == null) return null;
  const m = String(v).trim().match(/^~?\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|meters?|metres?|ft|feet|foot|')?$/i);
  if (!m) return null;
  const n = parseFloat(m[1].replace(',', '.'));
  const unit = (m[2] || 'm').toLowerCase();
  return /^(ft|feet|foot|')$/.test(unit) ? n * 0.3048 : n;
}

// ---------- name matching (shared with coverage.mjs) ----------

export function normName(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/['’`.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').replace(/^the /, '').replace(/ (roller )?coaster$/, '').trim();
}

// ---------- the model ----------

const PATH_WIDTH = { footway: 3, path: 2, pedestrian: 6, steps: 2.5, living_street: 5, service: 5, cycleway: 2.5, track: 3 };
const HEIGHT_KEYS = ['height', 'roller_coaster:height'];
const isWood = t => /^wood/.test(t.material || '') || /^wood/.test(t['roller_coaster:material'] || '') || /wood/.test(t['roller_coaster:type'] || '');

export function buildPark(osm, { overrides = {}, links = [] } = {}) {
  const els = osm.elements || [];
  const meta = osm.loopTroupe || {};
  const warnings = [];

  // ---- park outline: prefer the element fetch.mjs recorded, else the largest theme park ----
  const parks = els.filter(e => e.tags && e.tags.tourism === 'theme_park' && (e.geometry || e.members));
  const area = e => e.bounds ? (e.bounds.maxlat - e.bounds.minlat) * (e.bounds.maxlon - e.bounds.minlon) : 0;
  const parkEl = parks.find(e => `${e.type}/${e.id}` === meta.parkElement) || parks.sort((a, b) => area(b) - area(a))[0];

  // ---- local projection (equirectangular around the park center) ----
  let lat0 = 0, lon0 = 0;
  const bb = parkEl && parkEl.bounds;
  if (bb) { lat0 = (bb.minlat + bb.maxlat) / 2; lon0 = (bb.minlon + bb.maxlon) / 2; }
  else if (els.length) {
    const g = els.flatMap(e => e.geometry || (e.lat != null ? [e] : [])).filter(Boolean);
    lat0 = g.reduce((s, p) => s + p.lat, 0) / g.length; lon0 = g.reduce((s, p) => s + p.lon, 0) / g.length;
  }
  const kLon = M_LON_EQ * Math.cos(lat0 * Math.PI / 180);
  const xy = g => [(g.lon - lon0) * kLon, (g.lat - lat0) * M_LAT];

  // geometry arrays may contain nulls when Overpass clips to a bbox: split into runs
  const runs = geom => {
    const out = [[]];
    for (const g of geom || []) { if (g && g.lat != null) out[out.length - 1].push(xy(g)); else if (out[out.length - 1].length) out.push([]); }
    return out.filter(r => r.length);
  };

  // join member ways end to end into closed rings
  function assembleRings(lines) {
    const rings = [], open = lines.map(l => l.slice());
    const same = (a, b) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
    while (open.length) {
      let cur = open.shift();
      let grew = true;
      while (!same(cur[0], cur[cur.length - 1]) && grew) {
        grew = false;
        for (let i = 0; i < open.length; i++) {
          const l = open[i], end = cur[cur.length - 1];
          if (same(end, l[0])) cur = cur.concat(l.slice(1));
          else if (same(end, l[l.length - 1])) cur = cur.concat(l.slice(0, -1).reverse());
          else continue;
          open.splice(i, 1); grew = true; break;
        }
      }
      if (cur.length > 3 && same(cur[0], cur[cur.length - 1])) rings.push(cur.slice(0, -1));
    }
    return rings;
  }

  function polygonsOf(e) {
    if (e.type === 'way') {
      const r = runs(e.geometry);
      if (r.length !== 1) return [];
      const pts = r[0];
      if (pts.length < 4 || dist(pts[0], pts[pts.length - 1]) > 0.05) return [];
      return [{ outer: pts.slice(0, -1), inners: [] }];
    }
    if (e.type === 'relation' && e.members) {
      const lines = role => e.members.filter(m => m.type === 'way' && (m.role || 'outer') === role).flatMap(m => runs(m.geometry));
      const outers = assembleRings(lines('outer')), inners = assembleRings(lines('inner'));
      if (!outers.length) warnings.push(`relation ${e.id} (${e.tags.name || Object.keys(e.tags).join(',')}) has no closed outer ring in the clipped data; skipped`);
      return outers.map(o => ({ outer: o, inners: inners.filter(r => pointInRing(r[0], o)) }));
    }
    return [];
  }

  const pointOf = e => {
    if (e.type === 'node') return xy(e);
    const polys = polygonsOf(e);
    if (polys.length) return centroid(polys[0].outer);
    const r = runs(e.geometry);
    return r.length ? centroid(r[0]) : null;
  };

  const park = {
    id: meta.parkId || 'park',
    label: meta.label || (parkEl && parkEl.tags.name) || 'Park',
    name: parkEl ? parkEl.tags.name : null,
    synthetic: !!meta.synthetic,
    attribution: meta.synthetic ? null : '© OpenStreetMap contributors',
    outline: parkEl ? polygonsOf(parkEl) : [],
    buildings: [], water: [], woods: [], greens: [], sand: [], parking: [], plazas: [],
    paths: [], roads: [], rails: [], trees: [], attractions: [], coasters: [], aux: [], gate: null,
    warnings, counts: {},
  };
  if (!parkEl) warnings.push('no tourism=theme_park outline in the data');

  const inPark = p => !park.outline.length || park.outline.some(poly => pointInRing(p, poly.outer));

  // ---- the drawn region: the outline's bounds plus a margin of surroundings,
  // never beyond the area that was fetched ----
  const trackPts = els.filter(e => e.tags && e.tags.roller_coaster === 'track').flatMap(e => runs(e.geometry).flat());
  const basePts = park.outline.length ? park.outline.flatMap(p => p.outer) : trackPts;
  const margin = meta.synthetic ? 30 : 220;
  let region = basePts.length
    ? [Math.min(...basePts.map(p => p[0])) - margin, Math.min(...basePts.map(p => p[1])) - margin, Math.max(...basePts.map(p => p[0])) + margin, Math.max(...basePts.map(p => p[1])) + margin]
    : [-300, -300, 300, 300];
  if (meta.bbox) {
    const [a, b] = [xy({ lat: meta.bbox[0], lon: meta.bbox[1] }), xy({ lat: meta.bbox[2], lon: meta.bbox[3] })];
    region = [Math.max(region[0], a[0]), Math.max(region[1], a[1]), Math.min(region[2], b[0]), Math.min(region[3], b[1])];
  }
  park.region = region;
  const inRegion = p => p[0] >= region[0] && p[0] <= region[2] && p[1] >= region[1] && p[1] <= region[3];
  const anyIn = pts => pts.some(inRegion);

  const tracks = [], coasterFeatures = [], stations = [], shoreChains = [];
  const ROAD_WIDTH = { motorway: 14, trunk: 12, primary: 10, secondary: 9, tertiary: 8, unclassified: 7, residential: 7 };

  for (const e of els) {
    const t = e.tags || {};
    if (e === parkEl) continue;
    if (t.roller_coaster === 'track' && e.type === 'way') { tracks.push(e); continue; }
    if (t.roller_coaster === 'station') { stations.push({ el: e, pt: pointOf(e), polys: polygonsOf(e) }); }
    if (t.attraction === 'roller_coaster') {
      coasterFeatures.push({ el: e, name: t.name || null, pt: pointOf(e), polys: polygonsOf(e), tags: t, used: false });
    } else if (t.attraction && t.attraction !== 'no') {
      const pt = pointOf(e);
      if (pt && inRegion(pt)) park.attractions.push({ kind: t.attraction, name: t.name || null, pt, id: `${e.type}/${e.id}` });
    }
    if (t.building && t.building !== 'no') {
      for (const poly of polygonsOf(e)) {
        const c = centroid(poly.outer);
        if (!inRegion(c)) continue;
        const h = parseLength(t.height) || (t['building:levels'] ? parseFloat(t['building:levels']) * 3.5 : null);
        park.buildings.push({ poly, height: h || (t.building === 'kiosk' || t.building === 'toilets' ? 3.5 : 6), heightTagged: !!h, kind: t.building, name: t.name || null, attraction: t.attraction || null, inPark: inPark(c) });
      }
    }
    const isWaterTag = t.natural === 'water' || t.water || t.leisure === 'swimming_pool' || t.landuse === 'basin' || t.landuse === 'reservoir';
    if (isWaterTag) {
      const polys = polygonsOf(e).filter(p => anyIn(p.outer) || pointInRing([(region[0] + region[2]) / 2, (region[1] + region[3]) / 2], p.outer));
      if (polys.length) park.water.push(...polys);
      else if (e.type === 'relation') {
        // a big lake whose outline is mostly outside the fetched area: keep its shoreline
        for (const m of e.members) if (m.type === 'way' && m.geometry) shoreChains.push(...runs(m.geometry).filter(anyIn));
      }
    }
    if (t.natural === 'coastline') shoreChains.push(...runs(e.geometry).filter(anyIn));
    if (t.natural === 'wood' || t.natural === 'scrub' || t.landuse === 'forest') park.woods.push(...polygonsOf(e).filter(p => anyIn(p.outer)));
    if (/^(grass|meadow|village_green|recreation_ground|flowerbed)$/.test(t.landuse || '') || /^(garden|park)$/.test(t.leisure || '')) park.greens.push(...polygonsOf(e).filter(p => anyIn(p.outer)));
    if (t.natural === 'beach' || t.natural === 'sand') park.sand.push(...polygonsOf(e).filter(p => anyIn(p.outer)));
    if (t.amenity === 'parking') park.parking.push(...polygonsOf(e).filter(p => anyIn(p.outer)));
    if (t.highway && PATH_WIDTH[t.highway] !== undefined) {
      if (t.area === 'yes') park.plazas.push(...polygonsOf(e).filter(p => anyIn(p.outer)));
      else for (const r of runs(e.geometry)) if (anyIn(r)) park.paths.push({ pts: r, width: parseLength(t.width) || PATH_WIDTH[t.highway], kind: t.highway, bridge: t.bridge === 'yes' });
    }
    if (t.highway && ROAD_WIDTH[t.highway]) for (const r of runs(e.geometry)) if (anyIn(r)) park.roads.push({ pts: r, width: ROAD_WIDTH[t.highway], kind: t.highway, bridge: t.bridge === 'yes' });
    if (t.railway) for (const r of runs(e.geometry)) if (anyIn(r)) park.rails.push({ pts: r, kind: t.railway });
    if (t.natural === 'tree' && e.type === 'node') { const p = xy(e); if (inRegion(p)) park.trees.push(p); }
    if (t.natural === 'tree_row') for (const r of runs(e.geometry)) {
      const L = polylineLength(r);
      for (let s = 4; s < L; s += 9) { const p = pointAt(r, s); if (inRegion(p)) park.trees.push(p); }
    }
  }

  // ---- open water from shorelines that do not close inside the region ----
  if (shoreChains.length) {
    const seeds = [
      ...park.outline.flatMap(p => p.outer.filter((_, i) => i % 3 === 0)),
      ...park.buildings.filter(b => Math.abs(ringArea(b.poly.outer)) > 40).map(b => centroid(b.poly.outer)),
      ...park.roads.flatMap(r => r.pts.filter(inRegion)),
      ...park.parking.map(p => centroid(p.outer)),
    ];
    park.waterGrid = buildWaterGrid(region, shoreChains, seeds);
  }

  // ---- coasters: chain track ways that share nodes into circuits ----
  const comps = componentsOf(tracks, xy);
  const groups = new Map();
  let unnamed = 0;
  for (const comp of comps) {
    let { pts, closed, keys } = mainPath(comp);
    if (pts.length < 2) continue;
    const L = polylineLength(pts, closed);
    const t = comp.tags;

    // direction of travel from oneway tags, weighted by length
    let fwd = 0, rev = 0;
    const order = new Map(keys.map((k, i) => [k, i])), n = keys.length;
    comp.ways.forEach((nodes, wi) => {
      const ow = t[wi].oneway;
      if (!ow || ow === 'no') return;
      const sign = ow === '-1' ? -1 : 1;
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i];
        if (!a || !b || !order.has(a.key) || !order.has(b.key)) continue;
        const d = order.get(b.key) - order.get(a.key), len = dist(a.p, b.p);
        const ahead = d === 1 || (closed && d === 1 - n), back = d === -1 || (closed && d === n - 1);
        if (ahead) { if (sign > 0) fwd += len; else rev += len; }
        else if (back) { if (sign > 0) rev += len; else fwd += len; }
      }
    });
    if (rev > fwd) pts = closed ? [pts[0], ...pts.slice(1).reverse()] : pts.slice().reverse();
    const directionSource = fwd + rev > 0 ? 'oneway tags' : 'guess (OSM node order)';

    let name = null, nameSource = null, feature = null;
    const trackNames = t.filter(x => x.name).map(x => x.name);
    if (trackNames.length) { name = mode(trackNames); nameSource = 'track way name'; }
    // a named attraction=roller_coaster area containing most of the track
    const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 24)) === 0);
    const areaHit = coasterFeatures.filter(f => f.polys.length)
      .map(f => ({ f, k: sample.filter(p => f.polys.some(poly => pointInPoly(p, poly))).length / sample.length }))
      .filter(h => h.k >= 0.5 && (!name || !h.f.name || normName(h.f.name) === normName(name))).sort((a, b) => b.k - a.k)[0];
    if (areaHit) { feature = areaHit.f; if (!name && feature.name) { name = feature.name; nameSource = 'attraction area around the track'; } }
    if (!feature) {
      const near = coasterFeatures.filter(f => f.pt && !f.used)
        .map(f => ({ f, d: nearestOnPath(f.pt, pts, closed).d })).filter(h => h.d <= 75).sort((a, b) => a.d - b.d)[0];
      if (near && (!name || normName(near.f.name) === normName(name))) {
        feature = near.f;
        if (!name && feature.name) { name = feature.name; nameSource = `named attraction=roller_coaster feature ${Math.round(near.d)} m away`; }
      }
    }
    if (!feature && name) feature = coasterFeatures.find(f => f.name && normName(f.name) === normName(name)) || null;
    if (feature) feature.used = true;

    // short unnamed open pieces are transfer or storage spurs, not coasters
    if (!name && !closed && L < 150) { park.aux.push({ pts, closed, length: L, coaster: null }); continue; }
    if (!name) { name = `Unnamed coaster ${++unnamed}`; nameSource = 'none'; }

    const tagH = Math.max(0, ...t.flatMap(x => HEIGHT_KEYS.map(k => parseLength(x[k]) || 0)),
      ...(feature ? HEIGHT_KEYS.map(k => parseLength(feature.tags[k]) || 0) : [0]));
    const station = stations.map(st => st.pt && { st, ...nearestOnPath(st.pt, pts, closed) })
      .filter(h => h && h.d <= 40).sort((a, b) => a.d - b.d)[0];

    const key = nameSource === 'none' ? 'unnamed:' + unnamed : normName(name);
    if (!groups.has(key)) {
      groups.set(key, {
        name, osmNames: [name], nameSource, feature: feature ? `${feature.el.type}/${feature.el.id}` : null,
        wooden: t.some(isWood) || (feature ? isWood(feature.tags) : false), tracks: [], osmWays: [], aux: [],
      });
    }
    const g = groups.get(key);
    g.osmWays.push(...comp.ids);
    g.tracks.push({ pts, closed, length: L, tagHeight: tagH || null, stationS: station ? station.s : null, stationPt: station ? station.st.pt : null, directionSource });
  }

  for (const f of coasterFeatures) {
    if (f.used || !f.name || !f.pt) continue;
    if (groups.has(normName(f.name))) continue;
    groups.set(normName(f.name), { name: f.name, osmNames: [f.name], nameSource: 'attraction feature only', feature: `${f.el.type}/${f.el.id}`, wooden: isWood(f.tags), tracks: [], osmWays: [], aux: [], trackless: true, pt: f.pt });
  }

  // curator links (data/<park>.links.json): OSM coaster -> Loop Troupe coaster id,
  // matched by OSM name, any of its track way ids, or its attraction feature.
  // Groups sharing an id merge (a racing coaster mapped as two named tracks);
  // entries marked notCoaster drop mis-tagged features (flume channels and the like).
  const linkFor = g => (links || []).find(l =>
    (l.osmName && g.nameSource !== 'none' && normName(l.osmName) === normName(g.name)) ||
    (l.osmWays && l.osmWays.some(w => g.osmWays.includes(w))) ||
    (l.feature && l.feature === g.feature));
  const merged = new Map();
  park.dropped = [];
  for (const g of groups.values()) {
    const l = linkFor(g);
    if (l && l.notCoaster) { park.dropped.push({ name: g.name, osmWays: g.osmWays, reason: l.note || 'not a coaster' }); continue; }
    g.coasterId = l ? l.coasterId || null : null;
    g.link = l || null;
    const key = g.coasterId || 'osm:' + normName(g.name) + ':' + g.nameSource;
    if (!merged.has(key)) { merged.set(key, g); continue; }
    const m = merged.get(key);
    m.tracks.push(...g.tracks); m.osmWays.push(...g.osmWays); m.osmNames.push(...g.osmNames);
    if (m.nameSource === 'none' && g.nameSource !== 'none') { m.name = g.name; m.nameSource = g.nameSource; }
    if (m.trackless && !g.trackless) { m.trackless = false; delete m.pt; }
  }

  park.coasters = [...merged.values()].map((c, i) => {
    const o = (c.coasterId && overrides[c.coasterId]) || overrides[c.name] || {};
    c.index = i;
    c.override = Object.keys(o).length ? o : null;
    if (o.wooden != null) c.wooden = o.wooden;
    // with a full circuit present, open pieces of the same coaster are spurs: draw them flat
    if (c.tracks.some(tr => tr.closed)) {
      for (const tr of c.tracks.filter(x => !x.closed)) park.aux.push({ pts: tr.pts, closed: false, length: tr.length, coaster: c });
      c.tracks = c.tracks.filter(tr => tr.closed);
    }
    c.tracks = c.tracks.map(tr => profileTrack(tr, o));
    c.maxHeight = Math.max(0, ...c.tracks.map(tr => tr.H));
    c.heightSource = c.tracks.length ? (c.tracks.some(tr => tr.heightSource === 'override') ? 'override' : c.tracks.every(tr => tr.heightSource === 'OSM tag') ? 'OSM tag' : 'estimated') : null;
    c.length = c.tracks.reduce((s, tr) => s + tr.length, 0);
    return c;
  });

  park.gate = findGate(park);
  park.counts = {
    elements: els.length, trackWays: tracks.length, coasterFeatures: coasterFeatures.length,
    namedCoasterFeatures: coasterFeatures.filter(f => f.name).length, buildings: park.buildings.length,
    paths: park.paths.length, trees: park.trees.length, water: park.water.length, parking: park.parking.length,
    roads: park.roads.length, shoreChains: shoreChains.length,
  };
  // world bounds of the outline (or of everything drawable)
  const all = park.outline.length ? park.outline.flatMap(p => p.outer) : park.coasters.flatMap(c => c.tracks.flatMap(t => t.pts));
  park.bounds = all.length ? [Math.min(...all.map(p => p[0])), Math.min(...all.map(p => p[1])), Math.max(...all.map(p => p[0])), Math.max(...all.map(p => p[1]))] : [-100, -100, 100, 100];
  return park;
}

// Lakes whose outline is mostly outside the fetched area arrive as open
// shoreline chains. Rasterize them onto a grid as barriers, flood-fill the
// remaining cells into connected faces, and call a face water when it borders
// a shoreline and holds (almost) no land evidence (buildings, roads, the park).
// Cells the shoreline crosses are resolved per point by which side of the
// nearest shoreline segment they fall on.
function buildWaterGrid(region, chains, seeds, cell = 4) {
  const [x0, y0, x1, y1] = region;
  const nx = Math.ceil((x1 - x0) / cell), ny = Math.ceil((y1 - y0) / cell);
  const cls = new Uint8Array(nx * ny); // 0 land, 1 water, 2 shore
  const segs = [], segCells = new Map();
  const cellOf = (x, y) => {
    const i = Math.floor((x - x0) / cell), j = Math.floor((y - y0) / cell);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
  };
  for (const ch of chains) for (let k = 1; k < ch.length; k++) {
    const a = ch[k - 1], b = ch[k], L = dist(a, b), si = segs.length;
    segs.push([a[0], a[1], b[0], b[1]]);
    const steps = Math.max(1, Math.ceil(L / (cell / 3)));
    for (let s = 0; s <= steps; s++) {
      const c = cellOf(a[0] + (b[0] - a[0]) * s / steps, a[1] + (b[1] - a[1]) * s / steps);
      if (c < 0) continue;
      cls[c] = 2;
      if (!segCells.has(c)) segCells.set(c, []);
      const list = segCells.get(c);
      if (list[list.length - 1] !== si) list.push(si);
    }
  }
  // connected faces of non-shore cells
  const comp = new Int32Array(nx * ny).fill(-1);
  const touchesShore = [], seedCount = [];
  let nc = 0;
  for (let c0 = 0; c0 < nx * ny; c0++) {
    if (cls[c0] === 2 || comp[c0] >= 0) continue;
    const id = nc++;
    touchesShore.push(false); seedCount.push(0);
    const stack = [c0];
    comp[c0] = id;
    while (stack.length) {
      const c = stack.pop(), i = c % nx, j = (c - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        const q = jj * nx + ii;
        if (cls[q] === 2) { touchesShore[id] = true; continue; }
        if (comp[q] < 0) { comp[q] = id; stack.push(q); }
      }
    }
  }
  for (const p of seeds) { const c = cellOf(p[0], p[1]); if (c >= 0 && comp[c] >= 0) seedCount[comp[c]]++; }
  const isWaterComp = touchesShore.map((t, i) => t && seedCount[i] < 3);
  for (let c = 0; c < nx * ny; c++) if (comp[c] >= 0) cls[c] = isWaterComp[comp[c]] ? 1 : 0;
  // which side of each shoreline segment is water (+1 left, -1 right, 0 unknown)
  const side = segs.map(([ax, ay, bx, by]) => {
    const L = Math.hypot(bx - ax, by - ay) || 1, nxv = -(by - ay) / L, nyv = (bx - ax) / L;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    for (const k of [1.6, 2.6, 3.6]) {
      const l = cellOf(mx + nxv * cell * k, my + nyv * cell * k), r = cellOf(mx - nxv * cell * k, my - nyv * cell * k);
      if (l >= 0 && cls[l] !== 2) return cls[l] === 1 ? 1 : -1;
      if (r >= 0 && cls[r] !== 2) return cls[r] === 1 ? -1 : 1;
    }
    return 0;
  });
  const isWater = (x, y) => {
    const c = cellOf(x, y);
    if (c < 0) return false;
    if (cls[c] !== 2) return cls[c] === 1;
    let best = -1, bd = Infinity;
    for (const si of segCells.get(c)) {
      const [ax, ay, bx, by] = segs[si], dx = bx - ax, dy = by - ay;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
      const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
      if (d < bd) { bd = d; best = si; }
    }
    const [ax, ay, bx, by] = segs[best];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    return side[best] !== 0 && Math.sign(cross) === side[best];
  };
  return { isWater, segs, cells: nx * ny, waterCells: cls.reduce((s, v) => s + (v === 1), 0) };
}

function mode(arr) {
  const c = new Map();
  for (const a of arr) c.set(a, (c.get(a) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export function pointAt(pts, s, closed = false) {
  const n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n], len = dist(a, b);
    if (s <= len || i === segs - 1) { const t = len ? Math.min(1, s / len) : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    s -= len;
  }
  return pts[0];
}

// Track ways -> connected components (shared node ids; coordinates as a fallback).
function componentsOf(tracks, xy) {
  const parent = tracks.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const owner = new Map();
  const keyed = tracks.map(w => {
    const g = w.geometry || [];
    const useIds = w.nodes && w.nodes.length === g.length;
    return g.map((p, k) => (p && p.lat != null ? { key: useIds ? 'n' + w.nodes[k] : p.lat.toFixed(7) + ',' + p.lon.toFixed(7), p: xy(p) } : null));
  });
  keyed.forEach((nodes, i) => nodes.forEach(n => {
    if (!n) return;
    if (owner.has(n.key)) parent[find(i)] = find(owner.get(n.key)); else owner.set(n.key, i);
  }));
  const comps = new Map();
  tracks.forEach((w, i) => {
    const r = find(i);
    if (!comps.has(r)) comps.set(r, { ways: [], tags: [], ids: [] });
    const c = comps.get(r);
    c.ways.push(keyed[i]); c.tags.push(w.tags || {}); c.ids.push(`way/${w.id}`);
  });
  return [...comps.values()];
}

// The ridden circuit of a component: prune spurs (transfer/storage tracks),
// then walk the remaining loop; if nothing loops, take the longest path.
function mainPath(comp) {
  const pos = new Map(), adj = new Map();
  const link = (a, b) => {
    if (a.key === b.key) return;
    pos.set(a.key, a.p); pos.set(b.key, b.p);
    if (!adj.has(a.key)) adj.set(a.key, new Set());
    if (!adj.has(b.key)) adj.set(b.key, new Set());
    adj.get(a.key).add(b.key); adj.get(b.key).add(a.key);
  };
  for (const nodes of comp.ways) for (let i = 1; i < nodes.length; i++) if (nodes[i - 1] && nodes[i]) link(nodes[i - 1], nodes[i]);
  if (!adj.size) return { pts: [], keys: [], closed: false };

  const core = new Map([...adj].map(([k, s]) => [k, new Set(s)]));
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [k, s] of core) if (s.size <= 1) { for (const o of s) core.get(o) && core.get(o).delete(k); core.delete(k); pruned = true; }
  }

  const turn = (a, b, c) => {
    const [ax, ay] = pos.get(a), [bx, by] = pos.get(b), [cx, cy] = pos.get(c);
    const u = [bx - ax, by - ay], v = [cx - bx, cy - by];
    return (u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(...u) * Math.hypot(...v)) || 1);
  };

  if (core.size >= 3) {
    // walk the loop, preferring the straightest continuation at any junction
    const start = [...core.keys()][0];
    const seq = [start];
    let prev = null, cur = start;
    const used = new Set();
    for (let guard = 0; guard < core.size * 2; guard++) {
      const opts = [...core.get(cur)].filter(n => n !== prev && !used.has(cur + '>' + n));
      if (!opts.length) break;
      const next = prev ? opts.sort((a, b) => turn(prev, cur, b) - turn(prev, cur, a))[0] : opts[0];
      used.add(cur + '>' + next); used.add(next + '>' + cur);
      if (next === start) return { pts: seq.map(k => pos.get(k)), keys: seq, closed: true };
      seq.push(next); prev = cur; cur = next;
    }
    return { pts: seq.map(k => pos.get(k)), keys: seq, closed: false };
  }

  // tree: longest path by two sweeps
  const far = from => {
    const d = new Map([[from, 0]]), back = new Map(), q = [from];
    while (q.length) {
      const k = q.shift();
      for (const n of adj.get(k)) if (!d.has(n)) { d.set(n, d.get(k) + dist(pos.get(k), pos.get(n))); back.set(n, k); q.push(n); }
    }
    const end = [...d.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { end, back };
  };
  const a = far([...adj.keys()][0]).end;
  const { end: b, back } = far(a);
  const seq = [b];
  while (seq[seq.length - 1] !== a) seq.push(back.get(seq[seq.length - 1]));
  seq.reverse();
  return { pts: seq.map(k => pos.get(k)), keys: seq, closed: false };
}

// ---------- height heuristic ----------
//
// OSM maps track in plan view only. When a track (or its attraction feature)
// has a height tag we use it as the peak; otherwise we estimate the peak from
// track length and footprint (see estimateHeight, clamped to 6..60 m), then lay a generic
// profile along the circuit starting at the station:
//   station (flat) -> chain lift to the peak -> first drop -> hills that
//   taper from ~72% to ~30% of the drop -> brake run back into the station.
// Open tracks (usually a circuit with a gap in the mapping) get the same
// profile; overrides.profile = "launch" gives a launch profile instead: flat
// launch, one top hat, run-out. Direction of travel is the order of the OSM nodes, which is
// arbitrary; overrides.reverse flips it.

// Peak estimate from the geometric mean of track length and footprint span
// (bounding-box diagonal): long AND spread-out circuits are tall, long but
// compact ones (mice, kiddie ovals, twisters) are not.
export function estimateHeight(L, span, closed) {
  const raw = closed ? 0.055 * Math.sqrt(L * span) : 0.2 * L;
  return Math.round(Math.max(6, Math.min(60, raw)));
}

function spanOf(pts) {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function profileTrack(tr, o) {
  let { pts, closed, length: L } = tr;
  const heightSource = o.height ? 'override' : tr.tagHeight ? 'OSM tag' : 'estimated';
  const launch = o.profile === 'launch';
  const H = o.height || tr.tagHeight || estimateHeight(L, spanOf(pts), !launch);
  // rotate a closed circuit so arc length 0 is the station
  let s0 = o.stationAt != null ? o.stationAt * L : tr.stationS;
  if (closed && s0 != null) {
    // start the station a few meters before the station point
    s0 = (s0 - Math.min(20, L * 0.03) + L) % L;
  }
  const step = 2; // resample every 2 m
  const N = Math.max(8, Math.round(L / step));
  const base = closed ? (s0 || 0) : 0;
  let samples = Array.from({ length: N }, (_, i) => pointAt(pts, closed ? (base + i * L / N) % L : i * L / (N - 1), closed));
  if (o.reverse) samples = closed ? [samples[0], ...samples.slice(1).reverse()] : samples.reverse();
  if (!closed && s0 != null && s0 > L / 2 && !o.reverse) samples.reverse(); // station at the far end: ride from there
  const prof = launch ? launchProfile(L, H) : circuitProfile(L, H);
  const hs = samples.map((_, i) => prof.h(i * L / N));
  return { pts: samples, closed, length: L, H, heightSource, h: hs, ds: L / N, sections: prof.sections, stationPt: tr.stationPt, directionSource: o.reverse ? 'override' : tr.directionSource };
}

function circuitProfile(L, H) {
  const plat = 2.5;
  const st = Math.min(40, L * 0.07);
  const lift = Math.min(H * 1.8, L * 0.26);
  const crest = Math.min(8, H * 0.15);
  const drop = Math.min(H * 1.1, L * 0.14);
  const brake = Math.min(Math.max(25, L * 0.08), L * 0.15);
  const valley = Math.max(1.5, H * 0.08);
  const a = st + lift + crest + drop, b = L - brake;
  const R = Math.max(0, b - a);
  const k = Math.max(1, Math.round(R / Math.max(25, H * 2.4)));
  const sections = { station: [0, st], lift: [st, st + lift], brake: [b, L] };
  const h = s => {
    if (s < st) return plat;
    if (s < st + lift) return plat + (H - plat) * ((s - st) / lift);
    if (s < st + lift + crest) return H;
    if (s < a) { const t = (s - st - lift - crest) / drop; return H - (H - valley) * (1 - Math.cos(Math.PI * t)) / 2; }
    if (s < b) {
      const w = R / k, i = Math.min(k - 1, Math.floor((s - a) / w)), t = (s - a - i * w) / w;
      const amp = (H - valley) * (0.72 - 0.42 * i / Math.max(1, k - 1));
      return valley + amp * Math.pow(Math.sin(Math.PI * t), 2);
    }
    const t = (s - b) / brake;
    return valley + (plat + 0.5 - valley) * Math.min(1, t * 2);
  };
  return { h, sections };
}

function launchProfile(L, H) {
  // launch track, a near-vertical top hat, run-out
  const plat = 2.5, st = Math.min(30, L * 0.1);
  const rise = Math.max(6, H * 0.15); // nearly vertical, like a real top hat
  const up = L * 0.45, top = up + rise, crest = top + Math.max(3, L * 0.01), down = crest + rise;
  const sections = { station: [0, st], launch: [st, up], brake: [down + (L - down) * 0.5, L] };
  const h = s => {
    if (s < up) return plat;
    if (s < top) return plat + (H - plat) * Math.sin(Math.PI / 2 * (s - up) / (top - up));
    if (s < crest) return H;
    if (s < down) return H - (H - 3) * (1 - Math.cos(Math.PI * (s - crest) / (down - crest))) / 2;
    return 3 + 4 * Math.sin(Math.PI * (s - down) / (L - down)) ** 2;
  };
  return { h, sections, launch: true };
}

// Entrance: where a footpath crosses the park outline, nearest the biggest parking lot.
function findGate(park) {
  if (!park.outline.length) return null;
  const ring = park.outline[0].outer;
  const hits = [];
  for (const p of park.paths) for (let i = 1; i < p.pts.length; i++) {
    for (let j = 0; j < ring.length; j++) {
      const q = segX(p.pts[i - 1], p.pts[i], ring[j], ring[(j + 1) % ring.length]);
      if (q) hits.push(q);
    }
  }
  if (!hits.length) return null;
  const lot = park.parking.slice().sort((a, b) => Math.abs(ringArea(b.outer)) - Math.abs(ringArea(a.outer)))[0];
  const target = lot ? centroid(lot.outer) : centroid(ring);
  return hits.sort((a, b) => dist(a, target) - dist(b, target))[0];
}

function segX(a, b, c, d) {
  const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]];
  const den = r[0] * s[1] - r[1] * s[0];
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den;
  const u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [a[0] + r[0] * t, a[1] + r[1] * t] : null;
}
