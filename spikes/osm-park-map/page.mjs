// Page wiring for the park map spike: pick a data file, build the model,
// mount the map, and render the coaster key and data notes.

import { buildPark, normName } from './model.mjs';
import { ParkMap, TRACK_COLORS } from './map.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SYNTH_ID = 'synthetic-test-park';

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

const fmtLen = m => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');

function heightText(c) {
  if (!c.tracks.length) return 'no track mapped (shown as a sign)';
  const h = Math.round(c.maxHeight);
  if (c.heightSource === 'OSM tag') return `peak ${h} m (OSM height tag)`;
  if (c.heightSource === 'override') return `peak ${h} m (curated override)`;
  return `peak ~${h} m (estimated)`;
}

async function main() {
  const cfg = await getJSON('parks.json');
  const options = [{ id: SYNTH_ID, label: 'Test Park (synthetic fixture)', available: true }, ...cfg.parks];
  await Promise.all(options.slice(1).map(async o => {
    try { o.available = (await fetch(`data/${o.id}.json`, { method: 'HEAD' })).ok; } catch { o.available = false; }
  }));
  const sel = $('#parkSelect');
  sel.innerHTML = options.map(o => `<option value="${esc(o.id)}"${o.available ? '' : ' disabled'}>${esc(o.label)}${o.available ? '' : ' (not fetched yet)'}</option>`).join('');
  const want = new URLSearchParams(location.search).get('park');
  const current = options.find(o => o.id === want && o.available) || options[0];
  sel.value = current.id;
  sel.addEventListener('change', () => { location.search = '?park=' + encodeURIComponent(sel.value); });

  const osm = await getJSON(`data/${current.id}.json`);
  let overrides = {};
  try { overrides = await getJSON(`data/${current.id}.overrides.json`); } catch { /* optional */ }
  const park = buildPark(osm, { overrides });
  const synthetic = park.synthetic;

  // Link OSM coasters to Loop Troupe's database by name, so a coaster keeps its
  // site color (TRACK_COLORS by its index in the park) and coverage is visible.
  const dbPark = !synthetic && typeof COASTER_DB !== 'undefined' && current.dbParkId
    ? COASTER_DB.parks.find(p => p.id === current.dbParkId) : null;
  const dbIndex = new Map(dbPark ? dbPark.coasters.map((c, i) => [normName(c.name), i]) : []);
  const colors = park.coasters.map((c, i) => {
    const k = dbIndex.get(normName(c.name));
    return TRACK_COLORS[(k != null ? k : i) % TRACK_COLORS.length];
  });

  // labels: synthetic data is called out everywhere it appears
  const title = synthetic ? 'Test Park (synthetic fixture)' : park.name || current.label;
  $('#mapTitle').textContent = title;
  $('#mapMeta').textContent = synthetic ? 'SYNTHETIC TEST DATA' : 'OpenStreetMap data';
  $('#synthBanner').hidden = !synthetic;
  $('#mapRibbon').hidden = !synthetic;
  document.title = `${title} · Park map spike · Loop Troupe`;
  $('#mapAttrib').innerHTML = synthetic
    ? 'Synthetic data, not from OSM'
    : 'Map data © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
  const map$ = $('#map');
  map$.setAttribute('aria-label', `Isometric map of ${title} with ${park.coasters.length} coasters. ${synthetic ? 'Synthetic test data, not a real park.' : ''}`);

  const status = $('#mapStatus');
  const idleText = 'Hover or tap a coaster to see its name. Click it to zoom in.';
  status.textContent = idleText;

  const map = new ParkMap(map$, park, {
    colors,
    reducedMotion: reduced,
    onSelect: c => {
      for (const b of document.querySelectorAll('.key-btn')) b.setAttribute('aria-pressed', String(c && +b.dataset.id === c.index + 1));
      if (!c) { status.textContent = idleText; return; }
      const db = dbPark ? (dbIndex.has(normName(c.name)) ? ' · in Loop Troupe' : ' · not matched in Loop Troupe') : '';
      status.innerHTML = `<b>${esc(c.name)}</b>: ${esc(heightText(c))}` +
        (c.tracks.length ? ` · ${fmtLen(c.length)} of track${c.wooden ? ' · wooden' : ''}` : '') +
        ` · name from ${esc(c.nameSource)}${db}`;
    },
    onView: m => {
      $('#zoomIn').disabled = !m.canZoom(1);
      $('#zoomOut').disabled = !m.canZoom(-1);
      const comp = $('.map-compass');
      comp.className = 'map-compass r' + m.view.rot;
    },
  });

  window.parkMap = map; // handy for manual testing in the console

  $('#zoomIn').addEventListener('click', () => map.zoomBy(1));
  $('#zoomOut').addEventListener('click', () => map.zoomBy(-1));
  $('#fitBtn').addEventListener('click', () => map.fit());
  $('#rotateBtn').addEventListener('click', () => map.rotate());
  const trains = $('#trainsBtn');
  const syncTrains = () => { trains.classList.toggle('on', map.trainsOn); trains.setAttribute('aria-pressed', String(map.trainsOn)); };
  if (reduced) {
    trains.disabled = true;
    trains.lastChild.textContent = 'Trains parked';
    trains.title = 'Animation is off because your system asks for reduced motion';
    trains.setAttribute('aria-pressed', 'false');
  } else {
    syncTrains();
    trains.addEventListener('click', () => { map.setTrains(!map.trainsOn); syncTrains(); });
  }

  // coaster key: the accessible way in, and the phone-friendly one
  $('#coasterCount').textContent = `${park.coasters.length} ${park.coasters.length === 1 ? 'coaster' : 'coasters'}`;
  $('#coasterList').innerHTML = park.coasters.map((c, i) => {
    const meta = [heightText(c)];
    if (c.tracks.length) meta.push(fmtLen(c.length));
    if (dbPark) meta.push(dbIndex.has(normName(c.name)) ? '<span class="db-yes">in Loop Troupe</span>' : '<span class="db-no">not in Loop Troupe</span>');
    return `<li><button type="button" class="key-btn" data-id="${i + 1}" aria-pressed="false">
      <span class="swatch" style="--c:${colors[i]}" aria-hidden="true"></span>
      <span class="kname">${esc(c.name)}</span>
      <span class="kmeta">${meta.map(m => (m.startsWith('<span') ? m : esc(m))).join(' · ')}</span>
    </button></li>`;
  }).join('') || '<li>No coasters in this data.</li>';
  for (const b of document.querySelectorAll('.key-btn')) {
    const id = +b.dataset.id;
    b.addEventListener('mouseenter', () => map.setHover(id));
    b.addEventListener('mouseleave', () => map.setHover(0));
    b.addEventListener('focus', () => map.setHover(id));
    b.addEventListener('blur', () => map.setHover(0));
    b.addEventListener('click', () => {
      map.setHover(0);
      map.select(id, { zoom: true });
      const r = map$.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) map$.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  // data notes
  const n = park.counts;
  const missingDb = dbPark ? dbPark.coasters.filter(c => !park.coasters.some(o => normName(o.name) === normName(c.name))) : [];
  $('#dataNotes').innerHTML = `
    ${synthetic
      ? '<p><b>Synthetic fixture.</b> This file (<code>data/synthetic-test-park.json</code>) is generated by <code>make-synthetic.mjs</code> in the exact shape of an Overpass <code>out geom</code> response so the renderer can be built while OpenStreetMap is unreachable. Every name and coordinate is invented.</p>'
      : `<p>Fetched ${esc((osm.loopTroupe && osm.loopTroupe.fetchedAt) || 'at an unknown time')} from the Overpass API. Map data © OpenStreetMap contributors, ODbL.</p>`}
    <table>
      <tr><th>Elements</th><td>${n.elements}</td><th>Track ways</th><td>${n.trackWays}</td></tr>
      <tr><th>Coaster features</th><td>${n.coasterFeatures} (${n.namedCoasterFeatures} named)</td><th>Buildings</th><td>${n.buildings}</td></tr>
      <tr><th>Paths</th><td>${n.paths}</td><th>Trees</th><td>${n.trees}</td></tr>
    </table>
    <p>Heights are not in most OSM data. Where a track or its attraction has a <code>height</code> tag it sets the peak; otherwise the peak is estimated from the track's length and footprint, and a generic lift, drop and hills profile is laid along the circuit from the station. The shape is decorative: it is not the ride's real profile.</p>
    ${dbPark ? `<p>Loop Troupe lists ${dbPark.coasters.length} coasters here; ${dbPark.coasters.length - missingDb.length} match a coaster on this map.${missingDb.length ? ' Not on the map: ' + missingDb.map(c => esc(c.name)).join(', ') + '.' : ''}</p>` : ''}
    ${park.warnings.length ? `<ul>${park.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
}

main().catch(err => {
  $('#mapTitle').textContent = 'Map failed to load';
  $('#mapStatus').textContent = String(err.message || err);
  console.error(err);
});
