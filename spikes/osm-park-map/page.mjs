// Page wiring for the park map spike: pick a data file, build the model,
// mount the map, and render the coaster key and data notes.

import { buildPark, normName } from './model.mjs';
import { ParkMap, TRACK_COLORS, styleFor } from './map.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SYNTH_ID = 'synthetic-test-park';
const STORE_KEY = 'coaster-credits.v1'; // the site's ride log; read here, never written

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function loadRides() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    return (data && typeof data.rides === 'object' && data.rides) || {};
  } catch { return {}; }
}

const fmtLen = m => (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');

function heightText(c) {
  if (!c.tracks.length) return 'no track mapped (shown as a sign)';
  const h = Math.round(c.maxHeight);
  if (c.heightSource === 'OSM tag') return `peak ${h} m (OSM height tag)`;
  if (c.heightSource === 'override') return /^UNCONFIRMED/.test((c.override && c.override.source) || '') ? `peak ~${h} m (unconfirmed figure)` : `peak ${h} m (curated figure)`;
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

  const optional = async url => { try { return await getJSON(url); } catch { return null; } };
  const [osm, overrides, linkDoc] = await Promise.all([
    getJSON(`data/${current.id}.json`), optional(`data/${current.id}.overrides.json`), optional(`data/${current.id}.links.json`)]);
  const park = buildPark(osm, { overrides: overrides || {}, links: linkDoc ? linkDoc.links : [] });
  const synthetic = park.synthetic;

  // Link to Loop Troupe: the curated links file first, an exact name match as a fallback.
  const dbPark = !synthetic && typeof COASTER_DB !== 'undefined' && current.dbParkId
    ? COASTER_DB.parks.find(p => p.id === current.dbParkId) : null;
  const dbList = dbPark ? dbPark.coasters : [];
  const dbIndexById = new Map(dbList.map((c, i) => [c.id, i]));
  const dbByName = new Map(dbList.map(c => [normName(c.name), c]));
  const rides = loadRides();
  const info = park.coasters.map((c, i) => {
    const db = c.coasterId ? dbList[dbIndexById.get(c.coasterId)] : (!linkDoc ? dbByName.get(normName(c.name)) : null);
    const k = db ? dbIndexById.get(db.id) : null;
    return {
      db: db || null,
      name: db ? db.name : c.name,
      color: TRACK_COLORS[(k != null ? k : i) % TRACK_COLORS.length], // the site's color for this coaster
      ride: db ? rides[db.id] || null : null,
      inferred: !!(c.link && c.link.confidence === 'inferred'),
    };
  });
  const anyRidden = info.some(x => x.ride);
  let mode = dbPark && anyRidden ? 'credits' : 'all';
  const styles = () => info.map(x => styleFor(x.color, mode === 'all' || !!x.ride));
  const rideText = x => (!x.db ? 'not in Loop Troupe' : x.ride ? 'ridden' : 'not ridden yet');

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
    styles: styles(),
    labelOf: c => { const x = info[c.index]; return dbPark ? `${x.name} · ${rideText(x)}` : x.name; },
    reducedMotion: reduced,
    onSelect: c => {
      for (const b of document.querySelectorAll('.key-btn')) b.setAttribute('aria-pressed', String(!!c && +b.dataset.id === c.index + 1));
      if (!c) { status.textContent = idleText; return; }
      const x = info[c.index];
      const ride = x.ride ? ` (first logged ${esc(x.ride.date || 'without a date')}${x.ride.count > 1 ? `, ${x.ride.count} rides` : ''})` : '';
      const osmName = c.osmNames && c.osmNames.join(' + ') !== x.name ? ` · OSM: ${esc(c.osmNames.join(' + '))}` : '';
      status.innerHTML = `<b>${esc(x.name)}</b>${dbPark ? `: ${esc(rideText(x))}${ride}` : ''}` +
        ` · ${esc(heightText(c))}` + (c.tracks.length ? ` · ${fmtLen(c.length)} of track${c.wooden ? ' · wooden' : ''}` : '') +
        `${osmName}${x.inferred ? ' · link inferred, needs a check' : ''}`;
    },
    onView: m => {
      $('#zoomIn').disabled = !m.canZoom(1);
      $('#zoomOut').disabled = !m.canZoom(-1);
      $('.map-compass').className = 'map-compass r' + m.view.rot;
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
  const colorsBtn = $('#colorsBtn');
  if (!dbPark) colorsBtn.hidden = true;
  const syncColors = () => { colorsBtn.classList.toggle('on', mode === 'credits'); colorsBtn.setAttribute('aria-pressed', String(mode === 'credits')); };
  syncColors();
  colorsBtn.addEventListener('click', () => {
    mode = mode === 'credits' ? 'all' : 'credits';
    syncColors();
    map.setStyles(styles());
    renderKey();
  });

  // coaster key: the accessible way in, and the phone-friendly one
  const ridden = info.filter(x => x.ride).length, linked = info.filter(x => x.db).length;
  $('#coasterCount').textContent = dbPark ? `${ridden} of ${linked} ridden` : `${park.coasters.length} ${park.coasters.length === 1 ? 'coaster' : 'coasters'}`;
  function renderKey() {
    const st = styles();
    $('#coasterList').innerHTML = park.coasters.map((c, i) => {
      const x = info[i];
      const meta = [];
      if (dbPark) meta.push(`<span class="${x.ride ? 'db-yes' : x.db ? '' : 'db-no'}">${esc(rideText(x))}</span>`);
      meta.push(esc(heightText(c)));
      if (x.inferred) meta.push('link inferred');
      return `<li><button type="button" class="key-btn${st[i].colored ? '' : ' ghost'}" data-id="${i + 1}" aria-pressed="false">
        <span class="key-num" style="--c:${st[i].tc}" aria-hidden="true">${i + 1}</span>
        <span class="kname">${esc(x.name)}</span>
        <span class="kmeta">${meta.join(' · ')}</span>
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
  }
  renderKey();

  // data notes
  const n = park.counts;
  const onMap = new Set(info.filter(x => x.db).map(x => x.db.id));
  const missingDb = dbList.filter(c => !onMap.has(c.id));
  const L = osm.loopTroupe || {};
  $('#dataNotes').innerHTML = `
    ${synthetic
      ? '<p><b>Synthetic fixture.</b> This file (<code>data/synthetic-test-park.json</code>) is generated by <code>make-synthetic.mjs</code> in the exact shape of an Overpass <code>out geom</code> response so the renderer can be built while OpenStreetMap is unreachable. Every name and coordinate is invented.</p>'
      : `<p>Fetched ${esc(L.fetchedAt || 'at an unknown time')} from ${L.source === 'osm-api' ? 'the OpenStreetMap API (one request)' : 'the Overpass API'}. Map data © OpenStreetMap contributors, available under the ODbL.</p>`}
    <table>
      <tr><th>Elements kept</th><td>${n.elements}</td><th>Track ways</th><td>${n.trackWays}</td></tr>
      <tr><th>Coaster features</th><td>${n.coasterFeatures} (${n.namedCoasterFeatures} named)</td><th>Buildings</th><td>${n.buildings}</td></tr>
      <tr><th>Paths</th><td>${n.paths}</td><th>Trees</th><td>${n.trees}</td></tr>
    </table>
    <p>Track colors follow Loop Troupe: a coaster is in color once you have logged it and gray until then, read from this browser's ride log${dbPark ? '' : ' (not used for this data)'}. "My credits" off shows every coaster in its color.</p>
    <p>Heights are not in most OSM data. A <code>height</code> tag or a curated figure sets the peak; otherwise it is estimated from the track's length and footprint, and a generic lift, drop and hills profile is laid along the circuit from the station, in the direction of the OSM <code>oneway</code> tags where present. The shape is decorative: it is not the ride's real profile.</p>
    ${dbPark ? `<p>Loop Troupe lists ${dbList.length} coasters here (including retired ones); ${dbList.length - missingDb.length} are on this map.${missingDb.length ? ' Not on the map: ' + missingDb.map(c => esc(c.name)).join(', ') + '.' : ''}</p>` : ''}
    ${park.dropped && park.dropped.length ? `<p>Left off the map (OSM tags them as coaster track, the curator's links file says otherwise): ${park.dropped.map(d => esc(d.name)).join(', ')}.</p>` : ''}
    ${park.warnings.length ? `<ul>${park.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}`;
}

main().catch(err => {
  $('#mapTitle').textContent = 'Map failed to load';
  $('#mapStatus').textContent = String(err.message || err);
  console.error(err);
});
