/* Coaster Credits — single-page app.
   Data: js/data.js (COASTER_DB). Ride log lives in localStorage. */

(() => {
  'use strict';

  // ---------- data prep ----------

  const PARKS = COASTER_DB.parks;
  const parkById = new Map(PARKS.map(p => [p.id, p]));
  const COASTERS = [];
  for (const park of PARKS) {
    for (const c of park.coasters) COASTERS.push({ id: c.id, name: c.name, park });
  }
  const coasterById = new Map(COASTERS.map(c => [c.id, c]));
  const STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
    MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
    NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
    RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
    TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
    WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.',
  };

  // ---------- ride store ----------

  const STORE_KEY = 'coaster-credits.v1';

  function loadRides() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return (data && typeof data.rides === 'object' && data.rides) || {};
    } catch { return {}; }
  }

  let rides = loadRides();

  function saveRides() {
    localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, rides }));
    updateNavCount();
  }

  const creditCount = () => Object.keys(rides).length;

  // ---------- tiny helpers ----------

  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g,
    ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function fmtDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return new Date(y, m - 1, d).toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function stars(n, { small = false } = {}) {
    if (!n) return '';
    let out = '';
    for (let i = 1; i <= 5; i++) out += i <= n ? '★' : '<span class="off">★</span>';
    return `<span class="row-stars"${small ? ' style="font-size:.85rem"' : ''} title="${n}/5">${out}</span>`;
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('#toastRail').appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  function updateNavCount() { $('#navCount').textContent = creditCount(); }

  function meter(pct, label) {
    return `<div class="meter${pct >= 1 ? ' full' : ''}">
      <i style="width:${(pct * 100).toFixed(1)}%"></i><b>${label}</b>
    </div>`;
  }

  function parkStats(park) {
    const ridden = park.coasters.filter(c => rides[c.id]).length;
    return { ridden, total: park.coasters.length };
  }

  // ---------- isometric pixel scenes ----------

  const TRACK_COLORS = ['#d1342c', '#3868c8', '#e8862c', '#8848c0', '#f2b71f',
    '#18a49c', '#d8489c', '#2e9e3e'];

  // Pixel sprites stamped into scenes via <use>. Track/support colors are fed
  // through CSS custom properties so one sprite serves every coaster.
  const sprites = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprites.setAttribute('width', '0');
  sprites.setAttribute('height', '0');
  sprites.style.position = 'absolute';
  sprites.innerHTML = `<defs>
    <g id="spr-coaster">
      <rect x="1" y="16" width="2" height="6" fill="var(--sup,#f4ead0)"/>
      <rect x="6" y="10" width="2" height="12" fill="var(--sup,#f4ead0)"/>
      <rect x="11" y="6" width="2" height="16" fill="var(--sup,#f4ead0)"/>
      <rect x="16" y="10" width="2" height="12" fill="var(--sup,#f4ead0)"/>
      <rect x="21" y="16" width="2" height="6" fill="var(--sup,#f4ead0)"/>
      <rect x="-1" y="13" width="6" height="3" fill="var(--tc,#b9b2a4)"/>
      <rect x="4" y="7" width="6" height="3" fill="var(--tc,#b9b2a4)"/>
      <rect x="9" y="3" width="6" height="3" fill="var(--tc,#b9b2a4)"/>
      <rect x="14" y="7" width="6" height="3" fill="var(--tc,#b9b2a4)"/>
      <rect x="19" y="13" width="6" height="3" fill="var(--tc,#b9b2a4)"/>
    </g>
    <g id="spr-tree">
      <rect x="5" y="14" width="2" height="4" fill="#7a4a28"/>
      <rect x="2" y="11" width="8" height="3" fill="#2e8a30"/>
      <rect x="3" y="8" width="6" height="3" fill="#37983a"/>
      <rect x="4" y="5" width="4" height="3" fill="#41a844"/>
    </g>
  </defs>`;
  document.body.appendChild(sprites);

  let sceneSeq = 0;

  // Draw an isometric grass tile with one pixel coaster per item.
  // Ridden coasters get their track color; unridden stay gray skeletons.
  function isoScene(items, cap = 24) {
    const shown = items.slice(0, cap);
    const extra = items.length - shown.length;
    const n = Math.max(shown.length, 1);
    const cols = Math.ceil(Math.sqrt(n));
    const rows = Math.ceil(n / cols);
    const gw = cols * 2 + 2, gh = rows * 2 + 2;
    const pad = 10;
    const ox = pad + gh * 16, oy = pad;
    const P = (c, r) => [ox + (c - r) * 16, oy + (c + r) * 8];
    const w = (gw + gh) * 16 + pad * 2;
    const h = (gw + gh) * 8 + pad * 2 + 10;
    const pid = 'grass-chk-' + (sceneSeq++);
    const corners = [P(0, 0), P(gw, 0), P(gw, gh), P(0, gh)];
    const poly = corners.map(p => p.join(',')).join(' ');
    const base = corners.map(([x, y]) => `${x},${y + 9}`).join(' ');

    let uses = '';
    const cells = cols * rows;
    for (let i = 0; i < cells; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      const [x, y] = P(2 + c * 2, 2 + r * 2);
      if (i < shown.length) {
        const it = shown[i];
        const tc = it.ridden ? it.color : '#b9b2a4';
        const sup = it.ridden ? '#f4ead0' : '#d3ccbd';
        uses += `<use href="#spr-coaster" x="${x - 12}" y="${y - 19}" style="--tc:${tc};--sup:${sup}"/>`;
      } else if (i < shown.length + 8) {
        uses += `<use href="#spr-tree" x="${x - 6}" y="${y - 15}"/>`;
      }
    }

    return `<svg class="iso-svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"
      style="max-width:${Math.round(w * 1.35)}px" role="img" aria-label="Isometric park map">
      <defs>
        <pattern id="${pid}" patternUnits="userSpaceOnUse" width="2" height="2"
          patternTransform="matrix(16,8,-16,8,${ox},${oy})">
          <rect width="2" height="2" fill="#54a844"/>
          <rect width="1" height="1" fill="#4a9c3c"/>
          <rect x="1" y="1" width="1" height="1" fill="#4a9c3c"/>
        </pattern>
      </defs>
      <polygon points="${base}" fill="#7a5230"/>
      <polygon points="${poly}" fill="url(#${pid})"/>
      <polygon points="${poly}" fill="none" stroke="#3c7a2e" stroke-width="1"/>
      ${uses}
      ${extra > 0 ? `<text x="${w - 8}" y="${h - 6}" text-anchor="end" class="iso-extra">+${extra} more</text>` : ''}
    </svg>`;
  }

  function parkScene(park) {
    return isoScene(park.coasters.map((c, i) => ({
      ridden: !!rides[c.id],
      color: TRACK_COLORS[i % TRACK_COLORS.length],
    })));
  }

  // ---------- router ----------

  const view = $('#view');

  function parseHash() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [path, query = ''] = hash.split('?');
    const parts = path.split('/').filter(Boolean);
    return { parts, params: new URLSearchParams(query) };
  }

  function route() {
    const { parts, params } = parseHash();
    const page = parts[0] || 'home';
    document.querySelectorAll('.nav a').forEach(a =>
      a.classList.toggle('active', a.dataset.route === (page === 'park' ? 'parks' : page)));
    window.scrollTo(0, 0);
    if (page === 'home') renderHome();
    else if (page === 'parks') renderParks(params);
    else if (page === 'park' && parts[1]) renderPark(parts[1]);
    else if (page === 'coasters') renderCoasters(params);
    else if (page === 'credits') renderCredits();
    else renderHome();
    updateNavCount();
  }

  window.addEventListener('hashchange', route);

  // ---------- home ----------

  function renderHome() {
    const total = COASTERS.length;
    const count = creditCount();
    const parksVisited = PARKS.filter(p => p.coasters.some(c => rides[c.id])).length;
    const statesRidden = new Set(
      Object.keys(rides).map(id => coasterById.get(id)?.park.state).filter(Boolean)).size;
    const rated = Object.values(rides).filter(r => r.rating);
    const avg = rated.length
      ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : '—';
    const pct = count / total;

    const recent = Object.entries(rides)
      .sort((a, b) => (b[1].loggedAt || 0) - (a[1].loggedAt || 0))
      .slice(0, 5);

    // Showcase scene: the user's most-ridden park, or a sample layout pre-credits.
    let scene, caption;
    const topPark = PARKS.reduce((best, p) =>
      parkStats(p).ridden > (best ? parkStats(best).ridden : 0) ? p : best, null);
    if (topPark && parkStats(topPark).ridden > 0) {
      const st = parkStats(topPark);
      scene = parkScene(topPark);
      caption = `${topPark.name} — ${st.ridden}/${st.total} conquered`;
    } else {
      scene = isoScene(TRACK_COLORS.map((color, i) => ({ ridden: i !== 2 && i !== 5, color })));
      caption = 'Your park map fills in as you ride';
    }

    view.innerHTML = `
      <section class="hero">
        <span class="cloud" aria-hidden="true"></span>
        <span class="cloud c2" aria-hidden="true"></span>
        <h1>Count <span class="grad-text">every</span> coaster.</h1>
        <p class="lede">Your coaster credits, all in one place. Browse every roller coaster
        in every park in America, check off the ones you've conquered, and rate every ride.</p>
        <div class="cta-row">
          <a class="btn btn-primary" href="#/parks">Browse parks</a>
          <a class="btn btn-ghost" href="#/coasters">All ${total.toLocaleString()} coasters</a>
        </div>
        <div class="scene-caption">${esc(caption)}</div>
        <div class="hero-scene iso-scene">${scene}</div>
      </section>

      <div class="stat-band">
        <div class="stat-card"><div class="num">${count}</div><div class="label">coaster credit${count === 1 ? '' : 's'}</div></div>
        <div class="stat-card"><div class="num">${parksVisited}</div><div class="label">of ${PARKS.length} parks visited</div></div>
        <div class="stat-card"><div class="num">${statesRidden}</div><div class="label">states conquered</div></div>
        <div class="stat-card"><div class="num">${avg}</div><div class="label">average rating</div></div>
      </div>

      <section class="section panel">
        <h2>Lifetime progress</h2>
        <div class="progress-wrap">
          <div class="progress-bar"><i style="width:${(pct * 100).toFixed(2)}%"></i></div>
          <div class="progress-meta">
            <span>${count.toLocaleString()} of ${total.toLocaleString()} American coasters</span>
            <span>${(pct * 100).toFixed(1)}%</span>
          </div>
        </div>
      </section>

      ${recent.length ? `
      <section class="section">
        <div class="section-head"><h2>Recently logged</h2><a class="more" href="#/credits">All credits →</a></div>
        <div class="coaster-list">${recent.map(([id, r]) => {
          const c = coasterById.get(id);
          if (!c) return '';
          return `<div class="coaster-row ridden">
            <div class="coaster-info">
              <div class="cname">${esc(c.name)}</div>
              <div class="csub"><a href="#/park/${c.park.id}">${esc(c.park.name)}</a> · ${fmtDate(r.date)}</div>
              ${r.review ? `<div class="review-snippet">“${esc(r.review)}”</div>` : ''}
            </div>
            ${stars(r.rating)}
          </div>`;
        }).join('')}</div>
      </section>` : ''}

      <section class="section">
        <div class="section-head"><h2>State passport</h2><span class="more">${statesRidden} / ${new Set(PARKS.map(p => p.state)).size} stamped</span></div>
        ${passportGrid()}
      </section>
    `;
  }

  function passportGrid() {
    const byState = new Map();
    for (const p of PARKS) {
      const s = byState.get(p.state) || { total: 0, ridden: 0 };
      const st = parkStats(p);
      s.total += st.total;
      s.ridden += st.ridden;
      byState.set(p.state, s);
    }
    const cells = [...byState.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([st, s]) => {
        const pct = s.ridden / s.total;
        return `<a class="passport-cell${pct >= 1 ? ' done' : ''}" href="#/parks?state=${st}" title="${esc(STATE_NAMES[st] || st)}">
          <span class="st">${st}</span>
          <span class="frac">${s.ridden}/${s.total}</span>
          <span class="fill" style="width:${(pct * 100).toFixed(1)}%"></span>
        </a>`;
      }).join('');
    return `<div class="passport-grid">${cells}</div>`;
  }

  // ---------- parks ----------

  const parksUI = { q: '', state: '', sort: 'name', defunct: false };

  function renderParks(params) {
    if (params.has('state')) parksUI.state = params.get('state');
    const states = [...new Set(PARKS.map(p => p.state))].sort();

    view.innerHTML = `
      <div class="page-head">
        <h1>Parks</h1>
        <p class="lede">${PARKS.length} American parks, ${COASTERS.length.toLocaleString()} coasters. Pick a park and start checking them off.</p>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="parkSearch" type="search" placeholder="Search parks or cities…" value="${esc(parksUI.q)}">
        </div>
        <select class="control" id="stateFilter">
          <option value="">All states</option>
          ${states.map(s => `<option value="${s}"${s === parksUI.state ? ' selected' : ''}>${esc(STATE_NAMES[s] || s)}</option>`).join('')}
        </select>
        <select class="control" id="parkSort">
          <option value="name"${parksUI.sort === 'name' ? ' selected' : ''}>A → Z</option>
          <option value="count"${parksUI.sort === 'count' ? ' selected' : ''}>Most coasters</option>
          <option value="progress"${parksUI.sort === 'progress' ? ' selected' : ''}>My progress</option>
        </select>
        <button class="control-btn${parksUI.defunct ? ' on' : ''}" id="defunctToggle" type="button">Include defunct</button>
      </div>
      <div class="result-count" id="parkCount"></div>
      <div class="card-grid" id="parkGrid"></div>
    `;

    const grid = $('#parkGrid');

    const draw = () => {
      const q = parksUI.q.trim().toLowerCase();
      let list = PARKS.filter(p =>
        (parksUI.defunct || !p.defunct) &&
        (!parksUI.state || p.state === parksUI.state) &&
        (!q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)));
      list = [...list].sort((a, b) => {
        if (parksUI.sort === 'count') return b.coasters.length - a.coasters.length || a.name.localeCompare(b.name);
        if (parksUI.sort === 'progress') {
          const pa = parkStats(a), pb = parkStats(b);
          return (pb.ridden / pb.total) - (pa.ridden / pa.total) || pb.ridden - pa.ridden || a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });
      $('#parkCount').textContent = `${list.length} park${list.length === 1 ? '' : 's'}`;
      grid.innerHTML = list.map(p => {
        const { ridden, total } = parkStats(p);
        const pct = total ? ridden / total : 0;
        return `<a class="park-card" href="#/park/${p.id}">
          <div>
            <h3>${esc(p.name)}</h3>
            <div class="loc">${esc(p.city)}, ${p.state}${p.defunct ? ' <span class="badge badge-defunct">Defunct</span>' : ''}</div>
          </div>
          <div class="park-card-foot">
            <span class="count"><b>${ridden}</b> / ${total} coaster${total === 1 ? '' : 's'}</span>
            ${meter(pct, pct >= 1 ? 'Complete!' : `${Math.round(pct * 100)}%`)}
          </div>
        </a>`;
      }).join('') || `<div class="empty-state" style="grid-column:1/-1"><div class="big">🎡</div>No parks match that search.</div>`;
    };

    $('#parkSearch').addEventListener('input', e => { parksUI.q = e.target.value; draw(); });
    $('#stateFilter').addEventListener('change', e => { parksUI.state = e.target.value; draw(); });
    $('#parkSort').addEventListener('change', e => { parksUI.sort = e.target.value; draw(); });
    $('#defunctToggle').addEventListener('click', e => {
      parksUI.defunct = !parksUI.defunct;
      e.target.classList.toggle('on', parksUI.defunct);
      draw();
    });
    draw();
  }

  // ---------- park detail ----------

  function renderPark(id) {
    const park = parkById.get(id);
    if (!park) { view.innerHTML = `<div class="empty-state"><div class="big">🤔</div>Park not found. <a href="#/parks">Back to parks</a></div>`; return; }
    const { ridden, total } = parkStats(park);
    const pct = total ? ridden / total : 0;

    view.innerHTML = `
      <a class="back-link" href="#/parks">← All parks</a>
      <div class="park-hero">
        <div>
          <h1>${esc(park.name)}</h1>
          <div class="meta">
            <span>${esc(park.city)}, ${esc(STATE_NAMES[park.state] || park.state)}</span>
            ${park.defunct ? '<span class="badge badge-defunct">Defunct</span>' : ''}
          </div>
        </div>
        <div class="park-frac">${ridden}<span>/${total}</span></div>
      </div>
      <div class="panel panel-sky iso-scene park-panel">
        ${parkScene(park)}
        <div class="scene-hint">Colored track = ridden · gray = still waiting for you</div>
        <div class="progress-wrap" style="padding-bottom:10px">
          <div class="progress-bar"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
          <div class="progress-meta" style="color:#2b4a63"><span>${ridden} of ${total} ridden</span><span>${Math.round(pct * 100)}%</span></div>
        </div>
      </div>
      <div class="coaster-list" id="coasterList"></div>
    `;

    $('#coasterList').innerHTML = park.coasters.map(c => coasterRow(c.id)).join('');
    bindRows();
    parkRedraw = () => renderPark(id);
  }

  let parkRedraw = null;

  function coasterRow(id, { showPark = false } = {}) {
    const c = coasterById.get(id);
    const r = rides[id];
    return `<div class="coaster-row${r ? ' ridden' : ''}" data-id="${id}">
      <button class="ride-toggle" type="button" title="${r ? 'Ridden — click to edit or remove' : 'Mark as ridden'}" aria-label="${r ? 'Ridden' : 'Mark as ridden'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 10 18.5 20 6"/></svg>
      </button>
      <div class="coaster-info">
        <div class="cname">${esc(c.name)}</div>
        <div class="csub">
          ${showPark ? `<a href="#/park/${c.park.id}">${esc(c.park.name)}</a> · ${c.park.state}` : ''}
          ${r?.date ? `<span>Ridden ${fmtDate(r.date)}</span>` : ''}
          ${r && (r.count || 1) > 1 ? `<span>×${r.count} rides</span>` : ''}
        </div>
        ${r?.review ? `<div class="review-snippet">“${esc(r.review)}”</div>` : ''}
      </div>
      ${r?.rating ? stars(r.rating) : ''}
      <button class="icon-btn row-log" type="button">${r ? 'Edit' : 'Log ride'}</button>
    </div>`;
  }

  function bindRows() {
    document.querySelectorAll('.coaster-row').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('.ride-toggle').addEventListener('click', () => {
        if (rides[id]) openLogModal(id);
        else quickLog(id);
      });
      row.querySelector('.row-log').addEventListener('click', () => openLogModal(id));
    });
  }

  // ---------- all coasters ----------

  const coastersUI = { q: '', filter: 'all' };

  function renderCoasters(params) {
    view.innerHTML = `
      <div class="page-head">
        <h1>Every coaster in America</h1>
        <p class="lede">All ${COASTERS.length.toLocaleString()} of them, A to Z. Search by coaster, park, or state.</p>
      </div>
      <div class="toolbar">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="coasterSearch" type="search" placeholder="Search coasters, parks, states…" value="${esc(coastersUI.q)}">
        </div>
        <select class="control" id="riddenFilter">
          <option value="all"${coastersUI.filter === 'all' ? ' selected' : ''}>All coasters</option>
          <option value="ridden"${coastersUI.filter === 'ridden' ? ' selected' : ''}>My credits</option>
          <option value="unridden"${coastersUI.filter === 'unridden' ? ' selected' : ''}>Still to ride</option>
        </select>
      </div>
      <div class="result-count" id="coasterCount"></div>
      <div id="coasterIndex"></div>
    `;

    const draw = () => {
      const q = coastersUI.q.trim().toLowerCase();
      const list = COASTERS.filter(c => {
        if (coastersUI.filter === 'ridden' && !rides[c.id]) return false;
        if (coastersUI.filter === 'unridden' && rides[c.id]) return false;
        if (!q) return true;
        return c.name.toLowerCase().includes(q) ||
          c.park.name.toLowerCase().includes(q) ||
          c.park.state.toLowerCase() === q ||
          (STATE_NAMES[c.park.state] || '').toLowerCase().includes(q);
      }).sort((a, b) => a.name.localeCompare(b.name) || a.park.name.localeCompare(b.park.name));

      $('#coasterCount').textContent = `${list.length.toLocaleString()} coaster${list.length === 1 ? '' : 's'}`;

      const groups = new Map();
      for (const c of list) {
        const letter = /^[a-z]/i.test(c.name) ? c.name[0].toUpperCase() : '#';
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(c);
      }
      const letters = [...groups.keys()];
      $('#coasterIndex').innerHTML = list.length ? `
        ${letters.length > 3 ? `<div class="alpha-rail">${letters.map(l => `<a href="#letter-${esc(l)}" onclick="document.getElementById('letter-${esc(l)}').scrollIntoView();return false;">${esc(l)}</a>`).join('')}</div>` : ''}
        ${letters.map(l => `
          <div class="alpha-head" id="letter-${esc(l)}">${esc(l)}</div>
          <div class="coaster-list">${groups.get(l).map(c => coasterRow(c.id, { showPark: true })).join('')}</div>
        `).join('')}
      ` : `<div class="empty-state"><div class="big">🎢</div>No coasters match.</div>`;
      bindRows();
    };

    coastersRedraw = draw;
    $('#coasterSearch').addEventListener('input', e => { coastersUI.q = e.target.value; draw(); });
    $('#riddenFilter').addEventListener('change', e => { coastersUI.filter = e.target.value; draw(); });
    draw();
  }

  let coastersRedraw = null;

  // ---------- credits ----------

  function renderCredits() {
    const entries = Object.entries(rides)
      .map(([id, r]) => ({ id, r, c: coasterById.get(id) }))
      .filter(e => e.c)
      .sort((a, b) => (b.r.date || '').localeCompare(a.r.date || '') || (b.r.loggedAt || 0) - (a.r.loggedAt || 0));

    view.innerHTML = `
      <div class="page-head">
        <h1>My credits</h1>
        <p class="lede">${entries.length ? `${entries.length} coaster${entries.length === 1 ? '' : 's'} conquered. Every ride, every review — stored right here in your browser.` : 'Your riding résumé starts here.'}</p>
      </div>
      <div class="toolbar">
        <button class="btn btn-ghost btn-small" id="exportBtn" type="button">⬇ Export backup</button>
        <button class="btn btn-ghost btn-small" id="importBtn" type="button">⬆ Import backup</button>
        <input type="file" id="importFile" accept="application/json" class="hidden">
        ${entries.length ? '<span class="spacer" style="flex:1"></span><button class="btn btn-danger btn-small" id="clearBtn" type="button">Clear all</button>' : ''}
      </div>
      ${entries.length ? `<div class="coaster-list">${entries.map((e, i) => `
        <div class="credit-entry" data-id="${e.id}">
          <div class="credit-num">#${entries.length - i}</div>
          <div class="credit-body">
            <div class="cname">${esc(e.c.name)}</div>
            <div class="csub" style="color:var(--muted);font-size:.86rem">
              <a href="#/park/${e.c.park.id}" style="color:inherit">${esc(e.c.park.name)}</a>
              · ${e.c.park.state}${e.r.date ? ` · ${fmtDate(e.r.date)}` : ''}${(e.r.count || 1) > 1 ? ` · ×${e.r.count} rides` : ''}
            </div>
            ${e.r.rating ? `<div style="margin-top:4px">${stars(e.r.rating, { small: true })}</div>` : ''}
            ${e.r.review ? `<div class="review-snippet" style="-webkit-line-clamp:4">“${esc(e.r.review)}”</div>` : ''}
          </div>
          <div class="credit-actions">
            <button class="icon-btn edit-btn" type="button">Edit</button>
            <button class="icon-btn del-btn" type="button">Remove</button>
          </div>
        </div>`).join('')}</div>`
      : `<div class="empty-state">
          <div class="big">🎢</div>
          <p>No credits yet — the lift hill awaits.</p>
          <a class="btn btn-primary" href="#/parks">Find your first park</a>
        </div>`}
    `;

    $('#exportBtn').addEventListener('click', exportBackup);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', importBackup);
    const clearBtn = $('#clearBtn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (confirm('Delete ALL your credits and reviews? This cannot be undone.')) {
        rides = {};
        saveRides();
        renderCredits();
        toast('All credits cleared');
      }
    });
    document.querySelectorAll('.credit-entry').forEach(el => {
      const id = el.dataset.id;
      el.querySelector('.edit-btn').addEventListener('click', () => openLogModal(id));
      el.querySelector('.del-btn').addEventListener('click', () => {
        const c = coasterById.get(id);
        if (confirm(`Remove your credit for ${c.name}?`)) {
          delete rides[id];
          saveRides();
          renderCredits();
          toast('Credit removed');
        }
      });
    });
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ version: 1, exported: new Date().toISOString(), rides }, null, 2)],
      { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coaster-credits-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded');
  }

  function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || typeof data.rides !== 'object') throw new Error('bad format');
        let added = 0;
        for (const [id, r] of Object.entries(data.rides)) {
          if (coasterById.has(id)) { rides[id] = r; added++; }
        }
        saveRides();
        renderCredits();
        toast(`Imported ${added} credit${added === 1 ? '' : 's'}`);
      } catch {
        toast('Could not read that backup file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ---------- logging ----------

  function quickLog(id) {
    rides[id] = { date: todayISO(), rating: 0, review: '', count: 1, loggedAt: Date.now() };
    saveRides();
    const n = creditCount();
    toast(n % 25 === 0 ? `🎉 Milestone — credit #${n}!` : `🎢 Credit #${n} logged`);
    redrawCurrent();
  }

  function redrawCurrent() {
    const { parts } = parseHash();
    const page = parts[0] || 'home';
    if (page === 'park' && parkRedraw) parkRedraw();
    else if (page === 'coasters' && coastersRedraw) coastersRedraw();
    else route();
  }

  const backdrop = $('#modalBackdrop');
  const modal = $('#modal');

  function openLogModal(id) {
    const c = coasterById.get(id);
    const existing = rides[id];
    let rating = existing?.rating || 0;

    modal.innerHTML = `
      <h2>${esc(c.name)}</h2>
      <p class="sub">${esc(c.park.name)} · ${esc(c.park.city)}, ${c.park.state}</p>
      <div class="field">
        <label>Your rating</label>
        <div class="star-input" id="starInput">
          ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= rating ? 'on' : ''}" aria-label="${i} star${i > 1 ? 's' : ''}">★</button>`).join('')}
        </div>
      </div>
      <div class="field">
        <label for="rideDate">First ridden</label>
        <input type="date" id="rideDate" value="${existing?.date || todayISO()}" max="${todayISO()}">
      </div>
      <div class="field">
        <label for="rideCount">Times ridden</label>
        <input type="number" id="rideCount" min="1" max="9999" value="${existing?.count || 1}">
      </div>
      <div class="field">
        <label for="rideReview">Ride review</label>
        <textarea id="rideReview" placeholder="Airtime? Roughness? That one moment in the back row…">${esc(existing?.review || '')}</textarea>
      </div>
      <div class="modal-actions">
        ${existing ? '<button class="btn btn-danger btn-small" id="removeRide" type="button">Remove credit</button>' : ''}
        <span class="spacer"></span>
        <button class="btn btn-ghost btn-small" id="cancelModal" type="button">Cancel</button>
        <button class="btn btn-primary btn-small" id="saveRide" type="button">${existing ? 'Save changes' : 'Log credit'}</button>
      </div>
    `;
    backdrop.hidden = false;

    $('#starInput').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const v = Number(b.dataset.v);
        rating = rating === v ? 0 : v;
        $('#starInput').querySelectorAll('button').forEach(x =>
          x.classList.toggle('on', Number(x.dataset.v) <= rating));
      });
    });

    $('#cancelModal').addEventListener('click', closeModal);
    $('#saveRide').addEventListener('click', () => {
      const wasNew = !rides[id];
      rides[id] = {
        date: $('#rideDate').value || todayISO(),
        rating,
        review: $('#rideReview').value.trim(),
        count: Math.max(1, Number($('#rideCount').value) || 1),
        loggedAt: existing?.loggedAt || Date.now(),
      };
      saveRides();
      closeModal();
      if (wasNew) {
        const n = creditCount();
        toast(n % 25 === 0 ? `🎉 Milestone — credit #${n}!` : `🎢 Credit #${n} logged`);
      } else toast('Saved');
      redrawCurrent();
    });
    const rm = $('#removeRide');
    if (rm) rm.addEventListener('click', () => {
      if (confirm(`Remove your credit for ${c.name}?`)) {
        delete rides[id];
        saveRides();
        closeModal();
        toast('Credit removed');
        redrawCurrent();
      }
    });
  }

  function closeModal() { backdrop.hidden = true; modal.innerHTML = ''; }

  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !backdrop.hidden) closeModal(); });

  // ---------- boot ----------

  route();
})();
