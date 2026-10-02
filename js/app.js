/* Loop Troupe — single-page app.
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

  // Ride entries come from localStorage and imported backup files, so treat
  // them as untrusted: coerce every field to its expected type before use.
  function normalizeRide(r) {
    if (!r || typeof r !== 'object') return null;
    const date = typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : '';
    const rating = Math.min(5, Math.max(0, Math.round(Number(r.rating)) || 0));
    const count = Math.max(1, Math.round(Number(r.count)) || 1);
    const review = typeof r.review === 'string' ? r.review : '';
    const loggedAt = Number.isFinite(Number(r.loggedAt)) ? Number(r.loggedAt) : 0;
    return { date, rating, review, count, loggedAt };
  }

  function normalizeRides(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    for (const [id, r] of Object.entries(obj)) {
      const n = normalizeRide(r);
      if (n) out[id] = n;
    }
    return out;
  }

  function loadRides() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      return normalizeRides(data && data.rides);
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
    if (!y || !m || !d) return esc(iso);
    return new Date(y, m - 1, d).toLocaleDateString(undefined,
      { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const pxStar = on => `<svg class="px-star${on ? ' on' : ''}" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true"><use href="#px-star"/></svg>`;

  function stars(n) {
    n = Math.min(5, Math.max(0, Math.round(Number(n)) || 0));
    if (!n) return '';
    let out = '';
    for (let i = 1; i <= 5; i++) out += pxStar(i <= n);
    return `<span class="row-stars" role="img" aria-label="Rated ${n} out of 5" title="${n}/5">${out}</span>`;
  }

  function toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    $('#toastRail').appendChild(el);
    setTimeout(() => el.remove(), 3100);
  }

  function updateNavCount() { $('#navCount').textContent = creditCount(); }

  function meter(pct) {
    return `<div class="meter${pct >= 1 ? ' full' : ''}" aria-hidden="true"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>`;
  }

  function parkStats(park) {
    const ridden = park.coasters.filter(c => rides[c.id]).length;
    return { ridden, total: park.coasters.length };
  }

  // ---------- isometric pixel scenes ----------
  // Everything is drawn from whole-pixel rects/polygons with crispEdges.
  // Iso grid: one tile = 32x16px; a "sub-unit" (1/8 tile) moves 2px across, 1px down.

  const TRACK_COLORS = ['#d1342c', '#3868c8', '#e8862c', '#8848c0', '#f2b71f',
    '#18a49c', '#d8489c', '#2e9e3e'];
  const GHOST = { tc: '#a39d90', tcd: '#7f7a6e', sup: '#cfc8b8' };

  // A coaster keeps one track color everywhere (diorama, rows, cards).
  const colorOf = new Map();
  for (const park of PARKS) {
    park.coasters.forEach((c, i) => colorOf.set(c.id, TRACK_COLORS[i % TRACK_COLORS.length]));
  }

  function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function rng(seed) {
    let a = hashStr(String(seed));
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v =>
      Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)));
    return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
  }

  // Decorative silhouette per coaster. Chosen from the name and a stable hash,
  // purely for variety: it does not claim anything about the real ride.
  const SHAPES = ['woodie', 'looper', 'hyper', 'launch', 'junior', 'mouse'];
  function shapeOf(id) {
    const c = coasterById.get(id);
    const n = c ? c.name.toLowerCase() : '';
    if (/mouse|zoomerang/.test(n)) return 'mouse';
    if (/kid|junior|\bjr\b|little|woodstock|family|mini|wagon|tot|lil/.test(n)) return 'junior';
    return ['woodie', 'looper', 'hyper', 'launch', 'looper', 'woodie'][hashStr(id) % 6];
  }

  function rideStyle(id, ridden, color) {
    if (!ridden) return `--tc:${GHOST.tc};--tcd:${GHOST.tcd};--sup:${GHOST.sup};--car:transparent;--card:transparent`;
    const tc = color || colorOf.get(id) || TRACK_COLORS[0];
    return `--tc:${tc};--tcd:${shade(tc, .62)};--sup:#fbf3dc;--car:#fffdf4;--card:#3b2f1c`;
  }

  // ---- coaster sprite generator: walks a track circuit over a 2x2-tile plot ----
  const F = 16; // plot edge in sub-units
  const R = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

  function walk(wps) {
    const pts = [];
    for (let i = 0; i < wps.length - 1; i++) {
      const [u0, v0] = wps[i], [u1, v1] = wps[i + 1];
      const n = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0));
      for (let k = 0; k < n; k++) pts.push([u0 + (u1 - u0) * k / n, v0 + (v1 - v0) * k / n]);
    }
    return pts;
  }
  const ringPath = a => walk([[a, a], [F - a, a], [F - a, F - a], [a, F - a], [a, a]]);

  function profileAt(kf, t) {
    for (let i = 0; i < kf.length - 1; i++) {
      const [t0, h0] = kf[i], [t1, h1] = kf[i + 1];
      if (t >= t0 && t <= t1) return Math.round(h0 + (h1 - h0) * ((t - t0) / (t1 - t0 || 1)));
    }
    return kf[kf.length - 1][1];
  }

  const SHAPE_SPECS = {
    woodie: { path: ringPath(2), wood: true, every: 1, train: 2,
      kf: [[0, 3], [.2, 30], [.27, 4], [.38, 21], [.46, 5], [.56, 16], [.64, 5], [.74, 12], [.82, 4], [.92, 7], [1, 3]] },
    looper: { path: ringPath(2), every: 3, train: 4, loop: .62,
      kf: [[0, 3], [.2, 27], [.28, 4], [.38, 14], [.46, 5], [.56, 5], [.68, 5], [.78, 11], [.88, 4], [1, 3]] },
    hyper: { path: ringPath(1), every: 2, train: 3,
      kf: [[0, 3], [.22, 44], [.29, 4], [.42, 30], [.5, 5], [.62, 20], [.7, 5], [.8, 12], [.88, 4], [1, 3]] },
    launch: { path: ringPath(2), every: 2, train: 1,
      kf: [[0, 3], [.15, 3], [.2, 46], [.26, 46], [.31, 4], [.5, 14], [.6, 5], [.75, 10], [.85, 3], [1, 3]] },
    junior: { path: ringPath(4), every: 2, train: 1,
      kf: [[0, 3], [.25, 13], [.35, 3], [.55, 9], [.65, 3], [.8, 6], [1, 3]] },
    mouse: { path: walk([[2, 3], [14, 3], [14, 6], [3, 6], [3, 9], [14, 9], [14, 12], [3, 12], [3, 14], [2, 14], [2, 3]]),
      every: 3, train: 2, kf: [[0, 3], [.1, 17], [.62, 13], [.72, 6], [.86, 3], [1, 3]] },
  };

  // Depth-tagged primitives ({ d, s }), unsorted. `train: false` leaves out the
  // parked train, for the ride page, which animates its own.
  function spritePrims(spec, { train = true } = {}) {
    const prims = [];
    const { path, kf } = spec;
    const N = path.length;
    const hs = path.map((_, i) => profileAt(kf, i / N));
    const scr = (u, v, h) => [(u - v) * 2, (u + v) - h];
    // station roof straddling the start of the circuit
    const [su, sv] = path[1];
    const roof = [[su, sv - 2], [su + 6, sv - 2], [su + 6, sv + 2], [su, sv + 2]];
    const rp = (dy) => roof.map(([u, v]) => scr(u, v, 10 - dy).join(',')).join(' ');
    for (let i = 0; i < N; i++) {
      const [u, v] = path[i];
      const h = hs[i], hn = hs[(i + 1) % N];
      const [x, y] = scr(u, v, h);
      const gy = u + v;
      const d = u + v;
      if (h > 3 && i % spec.every === 0) {
        prims.push({ d: d - .2, s: R(x, y + 2, 1, gy - y - 2, spec.wood && i % 2 ? 'var(--tcd)' : 'var(--sup)') });
        if (spec.wood) prims.push({ d: d - .2, s: R(x - 1, gy - Math.floor(h / 2), 2, 1, 'var(--sup)') });
      }
      const dh = hn - h;
      if (Math.abs(dh) > 1) prims.push({ d, s: R(x - 1, y - Math.max(dh, 0) - 1, 2, Math.abs(dh) + 2, 'var(--tc)') });
      prims.push({ d, s: R(x - 1, y - 1, 2, 2, 'var(--tc)') + R(x - 1, y + 1, 2, 1, 'var(--tcd)') });
    }
    // train: three cars just past the lift
    const t0 = Math.round(N * .08) + spec.train;
    for (let k = 0; train && k < 3; k++) {
      const [u, v] = path[(t0 + k * 3) % N];
      const [x, y] = scr(u, v, hs[(t0 + k * 3) % N]);
      prims.push({ d: u + v + .3, s: R(x - 2, y - 4, 4, 3, 'var(--car)') + R(x - 2, y - 2, 4, 1, 'var(--card)') });
    }
    if (spec.loop) {
      const i0 = Math.round(N * spec.loop);
      const [u0, v0] = path[i0];
      const [pu, pv] = path[(i0 + 1) % N];
      const du = pu - u0, dv = pv - v0;
      for (let a = 0; a < 28; a++) {
        const th = a / 28 * Math.PI * 2;
        const s = 3.5 * Math.sin(th), z = hs[i0] + Math.round(10 * (1 - Math.cos(th)));
        const u = u0 + du * s, v = v0 + dv * s;
        const [x, y] = [Math.round((u - v) * 2), Math.round(u + v) - z];
        prims.push({ d: u + v + .1, s: R(x - 1, y - 1, 2, 2, 'var(--tc)') });
      }
    }
    prims.push({ d: su + sv + 3, s: `<polygon points="${rp(-2)}" fill="var(--tcd)"/><polygon points="${rp(0)}" fill="var(--tc)"/>` +
      R(...scr(su, sv + 2, 0).map((n, j) => j ? n - 8 : n), 1, 8, 'var(--sup)') +
      R(...scr(su + 6, sv + 2, 0).map((n, j) => j ? n - 8 : n), 1, 8, 'var(--sup)') });
    return prims;
  }

  const coasterSprite = spec => spritePrims(spec).sort((a, b) => a.d - b.d).map(p => p.s).join('');

  // Scenery is front-facing pixel art anchored at its ground point (0,0).
  const SCENERY = {
    tree: R(-1, -5, 2, 5, '#6b4226') + R(-3, -16, 6, 2, '#3f9a3c') + R(-5, -14, 10, 3, '#37903a') +
      R(-6, -11, 12, 4, '#2f8233') + R(-5, -7, 10, 2, '#286f2b') + R(-3, -14, 3, 2, '#5cb84f') + R(-5, -11, 2, 2, '#4aa64a'),
    pine: R(-1, -3, 2, 3, '#6b4226') + R(-1, -18, 2, 2, '#2f8a3e') + R(-2, -16, 4, 2, '#2c7a3a') + R(-3, -14, 6, 2, '#236a31') +
      R(-4, -12, 8, 2, '#2c7a3a') + R(-5, -10, 10, 3, '#236a31') + R(-6, -7, 12, 4, '#1d5a29') + R(-2, -14, 2, 2, '#3f9a4c') + R(-4, -10, 2, 2, '#3f9a4c'),
    bush: R(-4, -4, 8, 4, '#3d9440') + R(-3, -6, 6, 2, '#4aa64a') + R(-2, -5, 1, 1, '#f25c7a') + R(1, -3, 1, 1, '#f2d24a') + R(-4, -1, 8, 1, '#2f7a33'),
    stall: R(-6, -8, 12, 8, '#f4ead0') + R(-6, -1, 12, 1, '#8a7a58') + R(-4, -6, 8, 3, '#3b2f1c') + R(-3, -5, 2, 1, '#f2b71f') +
      R(-7, -13, 14, 1, '#8f1f19') + R(-7, -12, 2, 4, '#d1342c') + R(-5, -12, 2, 4, '#fff6e0') + R(-3, -12, 2, 4, '#d1342c') +
      R(-1, -12, 2, 4, '#fff6e0') + R(1, -12, 2, 4, '#d1342c') + R(3, -12, 2, 4, '#fff6e0') + R(5, -12, 2, 4, '#d1342c'),
    flowers: R(-6, -2, 12, 2, '#2f7a33') + R(-5, -3, 1, 1, '#f25c7a') + R(-2, -3, 1, 1, '#f2d24a') + R(1, -3, 1, 1, '#ffffff') +
      R(4, -3, 1, 1, '#f25c7a') + R(-4, -4, 1, 1, '#8848c0') + R(3, -4, 1, 1, '#f2d24a'),
    balloon: R(0, -14, 1, 14, '#f4ead0') + R(-2, -20, 5, 6, '#d1342c') + R(-1, -21, 3, 1, '#d1342c') + R(-1, -19, 1, 2, '#f29a92'),
    gate: R(-14, -18, 4, 18, '#f4ead0') + R(-11, -18, 1, 18, '#b5a377') + R(10, -18, 4, 18, '#f4ead0') + R(13, -18, 1, 18, '#b5a377') +
      R(-16, -25, 32, 7, '#d1342c') + R(-16, -19, 32, 1, '#8f1f19') + R(-16, -25, 32, 1, '#ef8f86') +
      R(-12, -23, 2, 2, '#f2b71f') + R(-6, -23, 2, 2, '#f2b71f') + R(0, -23, 2, 2, '#f2b71f') + R(6, -23, 2, 2, '#f2b71f') +
      R(-13, -31, 1, 6, '#3b2f1c') + R(-12, -31, 4, 3, '#f2b71f') + R(12, -31, 1, 6, '#3b2f1c') + R(13, -31, 4, 3, '#3868c8'),
  };

  const PIXEL_STAR = R(4, 0, 1, 2, 'currentColor') + R(3, 2, 3, 1, 'currentColor') + R(0, 3, 9, 1, 'currentColor') +
    R(1, 4, 7, 1, 'currentColor') + R(2, 5, 5, 1, 'currentColor') + R(2, 6, 2, 1, 'currentColor') + R(5, 6, 2, 1, 'currentColor') +
    R(1, 7, 2, 1, 'currentColor') + R(6, 7, 2, 1, 'currentColor') + R(1, 8, 1, 1, 'currentColor') + R(7, 8, 1, 1, 'currentColor');

  // Small UI icons on a 12x12 grid (currentColor + fixed accents).
  const ICONS = {
    coaster: R(0, 10, 12, 2, '#4c9a3a') + R(3, 6, 1, 4, '#8a7550') + R(5, 3, 2, 7, '#8a7550') + R(8, 6, 1, 4, '#8a7550') +
      R(0, 9, 1, 1, 'currentColor') + R(1, 8, 1, 1, 'currentColor') + R(2, 6, 1, 2, 'currentColor') + R(3, 4, 1, 2, 'currentColor') +
      R(4, 3, 1, 1, 'currentColor') + R(5, 2, 2, 1, 'currentColor') + R(7, 3, 1, 1, 'currentColor') + R(8, 4, 1, 2, 'currentColor') +
      R(9, 6, 1, 2, 'currentColor') + R(10, 8, 1, 1, 'currentColor') + R(11, 9, 1, 1, 'currentColor') + R(5, 1, 2, 1, '#f2b71f'),
    gate: R(0, 11, 12, 1, '#4c9a3a') + R(1, 4, 2, 7, '#7a5530') + R(9, 4, 2, 7, '#7a5530') + R(0, 1, 12, 3, 'currentColor') +
      R(2, 2, 1, 1, '#f2b71f') + R(5, 2, 2, 1, '#f2b71f') + R(9, 2, 1, 1, '#f2b71f') + R(5, 8, 2, 3, '#d9c08a'),
    flag: R(0, 11, 12, 1, '#4c9a3a') + R(2, 0, 1, 11, '#3b2f1c') + R(3, 1, 7, 2, 'currentColor') + R(3, 3, 5, 2, 'currentColor') +
      R(3, 5, 7, 1, 'currentColor') + R(1, 10, 3, 1, '#3b2f1c'),
    star: `<g transform="translate(1.5 1.5)">${PIXEL_STAR}</g>`,
    // folded park map with a dotted route (park guides)
    map: R(0, 1, 4, 10, '#f4ead0') + R(4, 0, 4, 10, '#e3d5b0') + R(8, 1, 4, 10, '#f4ead0') +
      R(4, 0, 1, 10, '#b39a62') + R(8, 1, 1, 10, '#b39a62') + R(0, 11, 4, 1, '#8a7550') + R(4, 10, 4, 1, '#8a7550') +
      R(8, 11, 4, 1, '#8a7550') + R(1, 3, 2, 2, '#5cad47') + R(5, 6, 2, 2, '#5cad47') + R(9, 7, 2, 3, '#5cad47') +
      R(1, 9, 1, 1, 'currentColor') + R(2, 8, 1, 1, 'currentColor') + R(3, 7, 1, 1, 'currentColor') + R(5, 5, 1, 1, 'currentColor') +
      R(6, 4, 1, 1, 'currentColor') + R(8, 4, 1, 1, 'currentColor') + R(9, 2, 2, 2, 'currentColor') + R(9, 4, 1, 1, '#3b2f1c'),
    // ice-cream cone (food picks)
    food: R(4, 0, 4, 1, 'currentColor') + R(3, 1, 6, 1, 'currentColor') + R(2, 2, 8, 3, 'currentColor') + R(3, 2, 2, 1, '#fff6e0') +
      R(2, 5, 8, 1, '#a8742c') + R(3, 6, 6, 1, '#d9a050') + R(4, 7, 4, 2, '#d9a050') + R(5, 9, 2, 2, '#d9a050') +
      R(4, 7, 1, 1, '#a8742c') + R(6, 8, 1, 1, '#a8742c') + R(5, 10, 1, 1, '#a8742c'),
  };

  const SPRITE_SRC = Object.fromEntries(SHAPES.map(sh => [sh, coasterSprite(SHAPE_SPECS[sh])]));

  const sprites = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprites.setAttribute('width', '0');
  sprites.setAttribute('height', '0');
  sprites.setAttribute('aria-hidden', 'true');
  sprites.style.position = 'absolute';
  sprites.innerHTML = `<defs>
    ${SHAPES.map(sh => `<g id="spr-${sh}">${SPRITE_SRC[sh]}</g>`).join('')}
    ${Object.entries(SCENERY).map(([k, v]) => `<g id="spr-${k}">${v}</g>`).join('')}
    <symbol id="px-star" viewBox="0 0 9 9">${PIXEL_STAR}</symbol>
    ${Object.entries(ICONS).map(([k, v]) => `<symbol id="ico-${k}" viewBox="0 0 12 12">${v}</symbol>`).join('')}
  </defs>`;
  document.body.appendChild(sprites);

  const icon = (name, cls = 'px-icon') =>
    `<svg class="${cls}" viewBox="0 0 12 12" shape-rendering="crispEdges" aria-hidden="true"><use href="#ico-${name}"/></svg>`;

  let sceneSeq = 0;

  // A whole park as an isometric diorama: one 2x2 plot per coaster, footpaths,
  // a tree line, scenery in spare plots, an entrance gate and a few guests.
  // items: [{ id, name, ridden }]
  function isoScene(items, { cap = 24, seed = 'park', label = 'Isometric park map' } = {}) {
    const shown = items.slice(0, cap);
    const extra = items.length - shown.length;
    const n = Math.max(shown.length, 1);
    const cols = Math.max(2, Math.ceil(Math.sqrt(n)));
    const rows = Math.max(2, Math.ceil(n / cols));
    const PLOT = 2, GAP = 1, M = 1, DEPTH = 12;
    const gw = 2 * M + cols * PLOT + (cols - 1) * GAP;
    const gh = 2 * M + rows * PLOT + (rows - 1) * GAP;
    const pad = 8, top = 52;
    const ox = pad + gh * 16, oy = top;
    const P = (c, r) => [ox + (c - r) * 16, oy + (c + r) * 8];
    const w = (gw + gh) * 16 + pad * 2;
    const h = oy + (gw + gh) * 8 + DEPTH + pad;
    const pid = 'grass-chk-' + (sceneSeq++);
    const rand = rng(seed);
    const pts = cs => cs.map(([c, r]) => P(c, r).join(',')).join(' ');
    const down = (cs, dy) => cs.map(([c, r]) => { const [x, y] = P(c, r); return `${x},${y + dy}`; }).join(' ');

    const leftFace = [[0, gh], [gw, gh]];
    const rightFace = [[gw, gh], [gw, 0]];
    const face = (e, dy) => `${pts(e)} ${down([...e].reverse(), dy)}`;
    let ground = `
      <polygon points="${face(leftFace, DEPTH)}" fill="#8b5a2b"/>
      <polygon points="${face(rightFace, DEPTH)}" fill="#6d4220"/>
      <polygon points="${face(leftFace, 3)}" fill="#2f7a2a"/>
      <polygon points="${face(rightFace, 3)}" fill="#256522"/>
      <polygon points="${pts([[0, 0], [gw, 0], [gw, gh], [0, gh]])}" fill="url(#${pid})"/>`;

    // footpath area, then grass plots on top of it
    const a = M - .5, b = gw - M + .5, bb = gh - M + .5;
    ground += `<polygon points="${pts([[a, a], [b, a], [b, bb], [a, bb]])}" fill="#d9c08a" stroke="#b39a62" stroke-width="1"/>`;
    const gateR = rows > 1 ? M + PLOT + GAP / 2 : gh / 2;
    ground += `<polygon points="${pts([[b, gateR - .5], [gw, gateR - .5], [gw, gateR + .5], [b, gateR + .5]])}" fill="#d9c08a"/>`;

    const objs = [];
    const plots = [];
    for (let i = 0; i < cols * rows; i++) {
      const ci = i % cols, ri = Math.floor(i / cols);
      const c0 = M + ci * (PLOT + GAP), r0 = M + ri * (PLOT + GAP);
      plots.push([c0, r0]);
      ground += `<polygon points="${pts([[c0, r0], [c0 + PLOT, r0], [c0 + PLOT, r0 + PLOT], [c0, r0 + PLOT]])}" fill="url(#${pid})" stroke="#3c7a2e" stroke-width="1"/>`;
      const [x, y] = P(c0, r0);
      const d = c0 + r0 + PLOT;
      if (i < shown.length) {
        const it = shown[i];
        objs.push({ d, s: `<g><title>${esc(it.name || '')}${it.ridden ? ' (ridden)' : ''}</title><use href="#spr-${it.shape || shapeOf(it.id)}" x="${x}" y="${y}" style="${rideStyle(it.id, it.ridden, it.color)}"/></g>` });
      } else {
        // scenery for spare plots
        const kind = Math.floor(rand() * 4);
        const at = (dc, dr, spr) => { const [sx, sy] = P(c0 + dc, r0 + dr); objs.push({ d: c0 + r0 + dc + dr, s: `<use href="#spr-${spr}" x="${sx}" y="${sy}"/>` }); };
        if (kind === 0) {
          const [cx, cy] = P(c0 + 1, r0 + 1);
          ground += `<polygon points="${cx},${cy - 9} ${cx + 18},${cy} ${cx},${cy + 9} ${cx - 18},${cy}" fill="#3d8fd6" stroke="#2a6aa8"/>` +
            `<rect x="${cx - 6}" y="${cy - 2}" width="6" height="1" fill="#9fd4f7"/><rect x="${cx + 2}" y="${cy + 2}" width="4" height="1" fill="#9fd4f7"/>`;
          at(.5, .25, 'tree'); at(1.75, 1.5, 'bush');
        } else if (kind === 1) { at(.5, .5, 'tree'); at(1.5, .5, 'pine'); at(1, 1.25, 'tree'); at(.5, 1.5, 'bush'); at(1.5, 1.6, 'tree'); }
        else if (kind === 2) { at(1, .9, 'stall'); at(.4, .4, 'tree'); at(1.6, 1.6, 'balloon'); at(.5, 1.6, 'flowers'); }
        else { at(.6, .6, 'flowers'); at(1.4, .6, 'flowers'); at(1, 1.2, 'flowers'); at(1.5, 1.6, 'bush'); at(.4, 1.5, 'tree'); }
      }
    }

    // tree line along the back edges, low hedges along the front
    for (let t = .5; t < gw; t += 1) {
      const [x, y] = P(t, .4);
      objs.push({ d: t, s: `<use href="#spr-${rand() < .4 ? 'pine' : 'tree'}" x="${x}" y="${y}"/>` });
    }
    for (let t = 1.5; t < gh; t += 1) {
      const [x, y] = P(.4, t);
      objs.push({ d: t, s: `<use href="#spr-${rand() < .4 ? 'pine' : 'tree'}" x="${x}" y="${y}"/>` });
    }
    for (let t = 1; t < gw; t += 2) {
      const [x, y] = P(t, gh - .3);
      objs.push({ d: t + gh, s: `<use href="#spr-bush" x="${x}" y="${y}"/>` });
    }
    const [gx, gy] = P(gw - .35, gateR);
    objs.push({ d: gw + gateR + 1, s: `<use href="#spr-gate" x="${gx}" y="${gy}"/>` });

    // guests on the paths
    const shirts = ['#d1342c', '#3868c8', '#f2b71f', '#8848c0', '#18a49c', '#e8862c', '#fbf3dc'];
    const onPlot = (c, r) => plots.some(([c0, r0]) => c > c0 - .2 && c < c0 + PLOT + .2 && r > r0 - .2 && r < r0 + PLOT + .2);
    let guests = Math.min(40, 6 + shown.length * 2), tries = 0;
    while (guests > 0 && tries++ < 400) {
      const c = Math.round((a + rand() * (b - a)) * 4) / 4, r = Math.round((a + rand() * (bb - a)) * 4) / 4;
      if (onPlot(c, r)) continue;
      const [x, y] = P(c, r);
      const shirt = shirts[Math.floor(rand() * shirts.length)];
      objs.push({ d: c + r, s: R(x, y - 6, 2, 2, '#f0c49a') + R(x, y - 4, 2, 3, shirt) + R(x, y - 1, 2, 1, '#3b2f1c') });
      guests--;
    }

    objs.sort((p, q) => p.d - q.d);

    return `<svg class="iso-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" shape-rendering="crispEdges"
      style="--w:${w}px" role="img" aria-label="${esc(label)}">
      <defs>
        <pattern id="${pid}" patternUnits="userSpaceOnUse" width="2" height="2"
          patternTransform="matrix(16,8,-16,8,${ox},${oy})">
          <rect width="2" height="2" fill="#58ac46"/>
          <rect width="1" height="1" fill="#4c9d3c"/>
          <rect x="1" y="1" width="1" height="1" fill="#4c9d3c"/>
        </pattern>
      </defs>
      ${ground}
      ${objs.map(o => o.s).join('')}
      ${extra > 0 ? `<g class="iso-extra-sign"><rect x="${w - 92}" y="${h - 30}" width="84" height="22" fill="#fbf3dc" stroke="#3b2f1c" stroke-width="2"/><text x="${w - 50}" y="${h - 14}" text-anchor="middle" class="iso-extra">+${extra} more</text></g>` : ''}
    </svg>`;
  }

  function parkScene(park) {
    const { ridden, total } = parkStats(park);
    return isoScene(park.coasters.map(c => ({ id: c.id, name: c.name, ridden: !!rides[c.id] })),
      { seed: park.id, label: `Park map of ${park.name}: ${ridden} of ${total} coasters ridden, shown in color` });
  }

  // One coaster on a floating grass island, as a cached blob-URL image.
  // Lists with hundreds of cards use these instead of live <use> clones,
  // so the browser rasterizes each (shape, color) combination only once.
  const islandCache = new Map();
  function islandSrc(shape, ridden, color) {
    const vars = Object.fromEntries(rideStyle('', ridden, color).split(';').map(kv => kv.split(':')));
    const key = shape + '|' + vars['--tc'];
    if (!islandCache.has(key)) {
      const body = SPRITE_SRC[shape].replace(/var\((--[a-z]+)\)/g, (_, v) => vars[v]);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-36 -50 72 86" width="72" height="86" shape-rendering="crispEdges">` +
        `<polygon points="0,0 32,16 32,22 0,38 -32,22 -32,16" fill="#7a4c26"/>` +
        `<polygon points="0,0 32,16 0,32 -32,16" fill="#58ac46" stroke="#3c7a2e"/>${body}</svg>`;
      islandCache.set(key, URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
    }
    return islandCache.get(key);
  }

  // Park-card art: up to three coasters, ridden first, standing on the hills.
  function miniScene(park) {
    const list = [...park.coasters].sort((x, y) => (rides[y.id] ? 1 : 0) - (rides[x.id] ? 1 : 0)).slice(0, 3);
    const imgs = list.map(c => `<img src="${islandSrc(shapeOf(c.id), !!rides[c.id], colorOf.get(c.id))}" width="72" height="86" alt="">`).join('');
    return `<div class="mini-scene" aria-hidden="true">${list.length < 3 ? '<span class="mini-tree"></span>' : ''}${imgs}${list.length < 3 ? '<span class="mini-tree pine"></span>' : ''}</div>`;
  }

  function spriteArt(shape, ridden, color) {
    return `<img class="sprite-art" src="${islandSrc(shape, ridden, color)}" width="144" height="172" alt="">`;
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
    // a park guide is a park sub-page, so it highlights Parks
    const navPage = page === 'park' || page === 'guide' ? 'parks' : page === 'coaster' ? 'coasters' : page;
    document.querySelectorAll('.nav a').forEach(a => {
      const on = a.dataset.route === navPage;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    // Jumping between sections of the guide already on screen scrolls only, so
    // an open video keeps playing.
    if (page === 'guide' && guideCtx && guideCtx.id === parts[1] &&
      guideCtx.preview === params.has('preview') && document.body.contains(guideCtx.root)) {
      goToSection(parts[2]);
      updateNavCount();
      return;
    }
    teardownGuide();
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (page === 'home') renderHome();
    else if (page === 'parks') renderParks(params);
    else if (page === 'park' && parts[1]) renderPark(parts[1], params);
    else if (page === 'guide' && parts[1]) renderGuide(parts[1], parts[2], params);
    else if (page === 'coaster') renderCoaster(parts[1] || '');
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
      caption = `<a href="#/park/${topPark.id}">${esc(topPark.name)}</a> <span>${st.ridden}/${st.total} conquered</span>`;
    } else {
      const sample = ['hyper', 'woodie', 'junior', 'looper', 'launch', 'mouse', 'woodie', 'looper'];
      scene = isoScene(sample.map((shape, i) => ({
        id: 'sample-' + i, shape, color: TRACK_COLORS[i], ridden: i !== 2 && i !== 5, name: 'Sample coaster',
      })), { seed: 'loop-troupe', label: 'Sample park map: ridden coasters appear in color, unridden ones in gray' });
      caption = 'Your park map fills in as you ride';
    }

    view.innerHTML = `
      <section class="hero sky">
        <span class="cloud" aria-hidden="true"></span>
        <span class="cloud c2" aria-hidden="true"></span>
        <span class="cloud c3" aria-hidden="true"></span>
        <div class="hero-copy">
          <p class="kicker">Coaster credit tracker</p>
          <h1>Count <span class="grad-text">every</span> coaster.</h1>
          <p class="lede">Your coaster credits, all in one place. Browse every roller coaster
          in every park in America, check off the ones you've conquered, and rate every ride.</p>
          <div class="cta-row">
            <a class="btn btn-primary" href="#/parks">Browse parks</a>
            <a class="btn" href="#/coasters">All ${total.toLocaleString()} coasters</a>
          </div>
        </div>
        <figure class="hero-scene iso-scene">
          ${scene}
          <figcaption class="scene-caption">${caption}</figcaption>
        </figure>
      </section>

      <div class="stat-band">
        <div class="stat-card s-red">${icon('coaster')}<div><div class="num">${count}</div><div class="label">coaster credit${count === 1 ? '' : 's'}</div></div></div>
        <div class="stat-card s-blue">${icon('gate')}<div><div class="num">${parksVisited}</div><div class="label">of ${PARKS.length} parks visited</div></div></div>
        <div class="stat-card s-green">${icon('flag')}<div><div class="num">${statesRidden}</div><div class="label">states conquered</div></div></div>
        <div class="stat-card s-gold">${icon('star')}<div><div class="num">${avg}</div><div class="label">average rating</div></div></div>
      </div>

      <section class="window section">
        <div class="window-bar"><h2>Lifetime progress</h2><span class="bar-meta">${(pct * 100).toFixed(1)}%</span></div>
        <div class="window-body">
          <div class="progress-bar" role="progressbar" aria-label="Lifetime progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${count}"><i style="width:${(pct * 100).toFixed(2)}%"></i></div>
          <div class="progress-meta">
            <span><b>${count.toLocaleString()}</b> of ${total.toLocaleString()} American coasters</span>
          </div>
        </div>
      </section>

      ${recent.length ? `
      <section class="window section">
        <div class="window-bar"><h2>Recently logged</h2><a class="bar-link" href="#/credits">All credits →</a></div>
        <div class="coaster-list in-window">${recent.map(([id, r]) => {
          const c = coasterById.get(id);
          if (!c) return '';
          return `<div class="coaster-row ridden static" style="--tc:${colorOf.get(id)}">
            <div class="coaster-info">
              <div class="cname">${rideLink(id, esc(c.name))}</div>
              <div class="csub"><a href="#/park/${c.park.id}">${esc(c.park.name)}</a><span>${fmtDate(r.date)}</span></div>
              ${r.rating ? stars(r.rating) : ''}
              ${r.review ? `<div class="review-snippet">“${esc(r.review)}”</div>` : ''}
            </div>
          </div>`;
        }).join('')}</div>
      </section>` : ''}

      <section class="window section">
        <div class="window-bar"><h2>State passport</h2><span class="bar-meta">${statesRidden} / ${new Set(PARKS.map(p => p.state)).size} stamped</span></div>
        <div class="window-body">${passportGrid()}</div>
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
        return `<a class="passport-cell${pct >= 1 ? ' done' : s.ridden ? ' some' : ''}" href="#/parks?state=${st}" title="${esc(STATE_NAMES[st] || st)}" aria-label="${esc(STATE_NAMES[st] || st)}: ${s.ridden} of ${s.total} ridden">
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
      <div class="page-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <div class="head-art">${spriteArt('woodie', true, TRACK_COLORS[0])}${spriteArt('looper', true, TRACK_COLORS[1])}</div>
        <h1>Parks</h1>
        <p class="lede">${PARKS.length} American parks, ${COASTERS.length.toLocaleString()} coasters. Pick a park and start checking them off.</p>
      </div>
      <div class="toolbar window">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="parkSearch" type="search" placeholder="Search parks or cities…" aria-label="Search parks or cities" value="${esc(parksUI.q)}">
        </div>
        <select class="control" id="stateFilter" aria-label="Filter by state">
          <option value="">All states</option>
          ${states.map(s => `<option value="${s}"${s === parksUI.state ? ' selected' : ''}>${esc(STATE_NAMES[s] || s)}</option>`).join('')}
        </select>
        <select class="control" id="parkSort" aria-label="Sort parks">
          <option value="name"${parksUI.sort === 'name' ? ' selected' : ''}>A → Z</option>
          <option value="count"${parksUI.sort === 'count' ? ' selected' : ''}>Most coasters</option>
          <option value="progress"${parksUI.sort === 'progress' ? ' selected' : ''}>My progress</option>
        </select>
        <button class="control-btn${parksUI.defunct ? ' on' : ''}" id="defunctToggle" type="button" aria-pressed="${parksUI.defunct}"><span class="tick" aria-hidden="true"></span>Include defunct</button>
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
        const cls = `park-card${p.defunct ? ' defunct' : ''}${pct >= 1 ? ' complete' : ridden ? ' visited' : ''}`;
        return `<a class="${cls}" href="#/park/${p.id}">
          <div class="park-card-art">${miniScene(p)}${pct >= 1 ? '<span class="ribbon">Complete!</span>' : ''}</div>
          <div class="park-card-body">
            <h3>${esc(p.name)}</h3>
            <div class="loc"><span class="state-tag">${p.state}</span>${esc(p.city)}${p.defunct ? ' <span class="badge badge-defunct">Defunct</span>' : ''}</div>
          </div>
          <div class="park-card-foot">
            <div class="count"><span><b>${ridden}</b> / ${total} coaster${total === 1 ? '' : 's'} ridden</span><span>${Math.round(pct * 100)}%</span></div>
            ${meter(pct)}
          </div>
        </a>`;
      }).join('') || `<div class="empty-state window" style="grid-column:1/-1">${spriteArt('mouse', false)}<p>No parks match that search.</p></div>`;
    };

    $('#parkSearch').addEventListener('input', e => { parksUI.q = e.target.value; draw(); });
    $('#stateFilter').addEventListener('change', e => { parksUI.state = e.target.value; draw(); });
    $('#parkSort').addEventListener('change', e => { parksUI.sort = e.target.value; draw(); });
    $('#defunctToggle').addEventListener('click', e => {
      parksUI.defunct = !parksUI.defunct;
      e.currentTarget.classList.toggle('on', parksUI.defunct);
      e.currentTarget.setAttribute('aria-pressed', parksUI.defunct);
      draw();
    });
    draw();
  }

  // ---------- park detail ----------

  function renderPark(id, params = new URLSearchParams()) {
    const park = parkById.get(id);
    if (!park) {
      view.innerHTML = `<div class="empty-state window">${spriteArt('looper', false)}<p>Park not found. <a href="#/parks">Back to parks</a></p></div>`;
      return;
    }
    const { ridden, total } = parkStats(park);
    const pct = total ? ridden / total : 0;

    // Park guide card: shown once the guide is published, or in ?preview.
    const gEntry = guideEntry(park.id);
    const gLive = !!gEntry && gEntry.published === true;
    const gPv = params.has('preview') ? '?preview' : '';
    const guideCard = gEntry && (gLive || gPv) ? `
      <a class="guide-card window" href="#/guide/${park.id}${gPv}">
        <span class="guide-card-art">${icon('map')}</span>
        <span class="guide-card-copy">
          <span class="guide-card-kicker">Park guide${gLive ? '' : ' <span class="badge badge-draft">Draft preview</span>'}</span>
          <strong class="guide-card-title">The troupe's ${esc(park.name)} guide</strong>
          <span class="guide-card-desc">When to go, which gate, the order we ride, and the credits you still need.</span>
        </span>
        <span class="btn btn-primary guide-card-cta" aria-hidden="true">Open the guide</span>
      </a>` : '';

    view.innerHTML = `
      <a class="back-link" href="#/parks">← All parks</a>
      ${guideCard}
      <section class="park-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <span class="cloud c2" aria-hidden="true"></span>
        <div class="park-hero">
          <div>
            <h1>${esc(park.name)}</h1>
            <div class="meta">
              <span class="state-tag">${park.state}</span>
              <span>${esc(park.city)}, ${esc(STATE_NAMES[park.state] || park.state)}</span>
              ${park.defunct ? '<span class="badge badge-defunct">Defunct</span>' : ''}
            </div>
          </div>
          <div class="park-frac" aria-label="${ridden} of ${total} ridden">${ridden}<span>/${total}</span></div>
        </div>
        <div class="iso-scene park-scene">${parkScene(park)}</div>
        <div class="scene-legend" aria-hidden="true">
          <span><i class="key key-ridden"></i>Ridden</span>
          <span><i class="key key-waiting"></i>Still waiting for you</span>
        </div>
      </section>
      <div class="window park-progress">
        <div class="window-body">
          <div class="progress-bar" role="progressbar" aria-label="Park progress" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${ridden}"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
          <div class="progress-meta"><span><b>${ridden}</b> of ${total} ridden</span><span>${Math.round(pct * 100)}%</span></div>
        </div>
      </div>
      <div class="coaster-list window-list" id="coasterList"></div>
    `;

    $('#coasterList').innerHTML = park.coasters.map(c => coasterRow(c.id)).join('');
    bindRows();
    parkRedraw = () => renderPark(id, params);
  }

  let parkRedraw = null;

  // A coaster name that opens its ride page. `label` is already escaped. In rows
  // the link's hit area stretches over the whole name-and-meta column (CSS).
  const rideLink = (id, label, cls = 'ride-link') => `<a class="${cls}" href="#/coaster/${id}">${label}</a>`;

  const CHECK_SVG = `<svg viewBox="0 0 11 10" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${
    [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2], [7, 1], [8, 0]].map(([x, y]) => `M${x + 1} ${y + 1}h2v3h-2z`).join('')}"/></svg>`;

  // `sub` is extra markup (already escaped) shown first in the meta line, used by
  // park guides for rank and "New credit" badges. The name links to the ride
  // page (`link: false` on the ride page itself); `detail: false` leaves out the
  // date, count, stars and review, which the ride page shows in full.
  function coasterRow(id, { showPark = false, sub = '', link = true, detail = true } = {}) {
    const c = coasterById.get(id);
    const r = detail ? rides[id] : null;
    const ridden = !!rides[id];
    const name = esc(c.name);
    return `<div class="coaster-row${ridden ? ' ridden' : ''}" data-id="${id}" style="--tc:${colorOf.get(id)}">
      <button class="ride-toggle" type="button" aria-pressed="${ridden}" title="${ridden ? 'Ridden — click to edit or remove' : 'Mark as ridden'}" aria-label="${ridden ? `${name}: ridden, edit` : `Mark ${name} as ridden`}">
        ${CHECK_SVG}
      </button>
      <div class="coaster-info">
        <div class="cname">${link ? rideLink(id, name) : name}</div>
        <div class="csub">
          ${sub}
          ${showPark ? `<a href="#/park/${c.park.id}">${esc(c.park.name)}</a><span>${c.park.state}</span>` : ''}
          ${r?.date ? `<span>Ridden ${fmtDate(r.date)}</span>` : ''}
          ${r && (r.count || 1) > 1 ? `<span>×${Number(r.count) | 0} rides</span>` : ''}
        </div>
        ${r?.rating ? stars(r.rating) : ''}
        ${r?.review ? `<div class="review-snippet">“${esc(r.review)}”</div>` : ''}
      </div>
      <button class="icon-btn row-log" type="button" aria-label="${ridden ? `Edit ${name}` : `Log a ride on ${name}`}">${ridden ? 'Edit' : 'Log ride'}</button>
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
      <div class="page-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <div class="head-art">${spriteArt('hyper', true, TRACK_COLORS[3])}</div>
        <h1>Every coaster in America</h1>
        <p class="lede">All ${COASTERS.length.toLocaleString()} of them, A to Z. Search by coaster, park, or state.</p>
      </div>
      <div class="toolbar window">
        <div class="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="coasterSearch" type="search" placeholder="Search coasters, parks, states…" aria-label="Search coasters, parks, or states" value="${esc(coastersUI.q)}">
        </div>
        <select class="control" id="riddenFilter" aria-label="Show">
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
        ${letters.length > 3 ? `<nav class="alpha-rail" aria-label="Jump to letter">${letters.map(l => `<a href="#letter-${esc(l)}" onclick="document.getElementById('letter-${esc(l)}').scrollIntoView();return false;">${esc(l)}</a>`).join('')}</nav>` : ''}
        ${letters.map(l => `
          <h2 class="alpha-head" id="letter-${esc(l)}">${esc(l)}</h2>
          <div class="coaster-list window-list">${groups.get(l).map(c => coasterRow(c.id, { showPark: true })).join('')}</div>
        `).join('')}
      ` : `<div class="empty-state window">${spriteArt('junior', false)}<p>No coasters match.</p></div>`;
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
      <div class="page-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <div class="head-art">${spriteArt('launch', true, TRACK_COLORS[4])}</div>
        <h1>My credits</h1>
        <p class="lede">${entries.length ? `${entries.length} coaster${entries.length === 1 ? '' : 's'} conquered. Every ride, every review — stored right here in your browser.` : 'Your riding résumé starts here.'}</p>
      </div>
      <div class="toolbar window">
        <button class="btn btn-small" id="exportBtn" type="button">⬇ Export backup</button>
        <button class="btn btn-small" id="importBtn" type="button">⬆ Import backup</button>
        <input type="file" id="importFile" accept="application/json" class="hidden">
        ${entries.length ? '<span class="spacer"></span><button class="btn btn-danger btn-small" id="clearBtn" type="button">Clear all</button>' : ''}
      </div>
      ${entries.length ? `<div class="coaster-list window-list">${entries.map((e, i) => `
        <div class="credit-entry" data-id="${e.id}" style="--tc:${colorOf.get(e.id)}">
          <div class="credit-num">#${entries.length - i}</div>
          <div class="credit-body">
            <div class="cname">${rideLink(e.id, esc(e.c.name))}</div>
            <div class="csub">
              <a href="#/park/${e.c.park.id}">${esc(e.c.park.name)}</a><span>${e.c.park.state}</span>${e.r.date ? `<span>${fmtDate(e.r.date)}</span>` : ''}${(e.r.count || 1) > 1 ? `<span>×${Number(e.r.count) | 0} rides</span>` : ''}
            </div>
            ${e.r.rating ? stars(e.r.rating) : ''}
            ${e.r.review ? `<div class="review-snippet long">“${esc(e.r.review)}”</div>` : ''}
          </div>
          <div class="credit-actions">
            <button class="icon-btn edit-btn" type="button" aria-label="Edit ${esc(e.c.name)}">Edit</button>
            <button class="icon-btn del-btn" type="button" aria-label="Remove ${esc(e.c.name)}">Remove</button>
          </div>
        </div>`).join('')}</div>`
      : `<div class="empty-state window">
          ${spriteArt('hyper', false)}
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
          const n = normalizeRide(r);
          if (n && coasterById.has(id)) { rides[id] = n; added++; }
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

  // ---------- ride pages ----------
  // Contract: docs/tech_spec.md, "Ride pages (C1a)" and "Ride stats file contract
  // (v1)". #/coaster/<coaster-id> shows a header, the rider's own log (the same
  // coasterRow()/bindRows()/log dialog as everywhere, so the ride-log format is
  // unchanged), a pixel view, the stats panel and, once picks exist, videos.

  let coasterRedraw = null;

  function renderCoaster(id) {
    coasterRedraw = null;
    const c = coasterById.get(id);
    if (!c) { rideNotFound(id); return; }
    const park = c.park;
    const pic = rideView(c);

    view.innerHTML = `
      <a class="back-link" href="#/park/${park.id}">← ${esc(park.name)}</a>
      <section class="ride-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <span class="cloud c2" aria-hidden="true"></span>
        <p class="kicker">Roller coaster</p>
        <h1>${esc(c.name)}</h1>
        <p class="meta">
          <span class="state-tag">${park.state}</span>
          <a href="#/park/${park.id}">${esc(park.name)}</a>
          <span>${esc(park.city)}, ${esc(STATE_NAMES[park.state] || park.state)}</span>
          ${park.defunct ? '<span class="badge badge-defunct">Defunct park</span>' : ''}
        </p>
      </section>
      <section class="window ride-you" aria-labelledby="rideYouTitle">
        <div class="window-bar"><h2 id="rideYouTitle">Your ride</h2></div>
        <div id="rideYou">${rideYouHtml(id)}</div>
      </section>
      <div class="ride-grid">
        ${pic.html}
        <section class="window ride-stats" aria-labelledby="rideStatsTitle">
          <div class="window-bar"><h2 id="rideStatsTitle">Ride stats</h2></div>
          <div class="window-body" id="rideStats"><p class="ride-stats-msg" role="status">Loading ride stats…</p></div>
        </section>
      </div>
      ${rideVideosHtml(c)}
    `;

    const you = $('#rideYou');
    const bind = () => {
      bindRows();
      const w = you.querySelector('.ride-write');
      if (w) w.addEventListener('click', () => openLogModal(id));
    };
    bind();
    pic.mount(view.querySelector('.ride-view'));
    fillRideStats(id);

    // After a log change, redraw only "Your ride" and recolor the picture, so the
    // train keeps running and keyboard focus stays on the same control.
    coasterRedraw = () => {
      if (!you.isConnected) { route(); return; }
      const a = document.activeElement;
      const cls = a && you.contains(a) ? ['ride-toggle', 'row-log', 'ride-write'].find(k => a.classList.contains(k)) : null;
      you.innerHTML = rideYouHtml(id);
      bind();
      pic.refresh();
      const el = cls && (you.querySelector(`.${cls}`) || you.querySelector('.row-log'));
      if (el) el.focus({ preventScroll: true });
    };
  }

  function rideNotFound(id) {
    // Never guess a coaster: only point at the park the ID names, if it is one.
    const park = parkById.get(String(id).split('--')[0]);
    view.innerHTML = `<div class="empty-state window ride-missing">
      ${spriteArt('looper', false)}
      <h1 class="ride-missing-title">Ride not found</h1>
      <p>We couldn't find that coaster. The link may be mistyped or out of date.</p>
      ${park
        ? `<a class="btn btn-primary" href="#/park/${park.id}">Go to ${esc(park.name)}</a><a href="#/coasters">Or browse every coaster</a>`
        : '<a class="btn btn-primary" href="#/coasters">Browse every coaster</a>'}
    </div>`;
  }

  // "Your ride": the standard row (toggle + Log/Edit), then the log in full.
  function rideYouHtml(id) {
    const r = rides[id];
    const row = `<div class="coaster-list">${coasterRow(id, {
      link: false, detail: false, sub: `<span>${r ? 'In your credits' : 'Not ridden yet'}</span>`,
    })}</div>`;
    if (!r) {
      return `${row}<div class="ride-log"><p class="ride-hint">Ridden it? Tick the box to add the credit, or use <b>Log ride</b> to add the date, your rating and a review.</p></div>`;
    }
    const rating = Math.min(5, Math.max(0, Math.round(Number(r.rating) || 0)));
    const count = Math.max(1, Math.round(Number(r.count) || 1));
    return `${row}<div class="ride-log">
      <dl class="ride-facts">
        <div class="ride-fact"><dt>First ridden</dt><dd>${r.date ? esc(fmtDate(r.date)) : 'Not recorded'}</dd></div>
        <div class="ride-fact"><dt>Times ridden</dt><dd>${count.toLocaleString()}</dd></div>
        <div class="ride-fact"><dt>Your rating</dt><dd>${rating ? stars(rating) : 'Not rated'}</dd></div>
      </dl>
      ${r.review
        ? `<div class="ride-review" style="--tc:${colorOf.get(id)}"><h3 class="ride-label">Your review</h3><p>${esc(r.review)}</p></div>`
        : '<p class="ride-review-empty"><span>No review yet.</span><button class="btn btn-small ride-write" type="button">Write a review</button></p>'}
    </div>`;
  }

  // The ride page's picture: the one seam for what draws it. Today it is always
  // the procedural sprite, enlarged. Later (tech spec decision 10) a coaster on a
  // published park map gets a map vignette here instead, falling back to the
  // sprite. Whatever it returns: { html, mount(figure), refresh() }; the html
  // reserves its final size so nothing shifts while it loads.
  function rideView(c) {
    return spriteView(c);
  }

  // Sprite view: the diorama silhouette on its own island, drawn at a whole-number
  // scale (CSS --px), with a train that steps round the circuit: slow up the
  // lift, faster the lower it gets, a pause in the station.
  const RV_BOX = [-48, -44, 96, 92];
  const RV_ISLAND =
    '<polygon points="-44,16 0,38 0,46 -44,24" fill="#8b5a2b"/><polygon points="0,38 44,16 44,24 0,46" fill="#6d4220"/>' +
    '<polygon points="-44,16 0,38 0,40 -44,18" fill="#2f7a2a"/><polygon points="0,38 44,16 44,18 0,40" fill="#256522"/>' +
    '<polygon points="0,-6 44,16 0,38 -44,16" fill="#58ac46"/>' +
    '<polygon points="0,-3 38,16 0,35 -38,16" fill="#d9c08a" stroke="#b39a62" stroke-width="1"/>' +
    '<polygon points="0,0 32,16 0,32 -32,16" fill="#4c9d3c" stroke="#3c7a2e" stroke-width="1"/>' +
    '<use href="#spr-tree" x="-40" y="17"/><use href="#spr-pine" x="40" y="16"/>' +
    R(-36, 11, 2, 2, '#f0c49a') + R(-36, 13, 2, 3, '#3868c8') + R(-36, 16, 2, 1, '#3b2f1c');
  const RV_FRONT = '<use href="#spr-bush" x="-18" y="33"/><use href="#spr-flowers" x="20" y="32"/>' +
    R(33, 13, 2, 2, '#f0c49a') + R(33, 15, 2, 3, '#f2b71f') + R(33, 18, 2, 1, '#3b2f1c');

  function spriteView(c) {
    const shape = shapeOf(c.id);
    const spec = SHAPE_SPECS[shape];
    const prims = spritePrims(spec, { train: false }).sort((a, b) => a.d - b.d);
    const depths = prims.map(p => p.d);
    const N = spec.path.length;
    const hs = spec.path.map((_, i) => profileAt(spec.kf, i / N));
    const at = i => { const [u, v] = spec.path[i]; return [(u - v) * 2, (u + v) - hs[i], u + v + .3]; };
    // Where dioramas park the train (head car), and the top of the lift.
    const rest = Math.round(N * .08) + spec.train + 6;
    let liftTop = 0;
    for (let i = 0; i < N / 2; i++) if (hs[i] > hs[liftTop]) liftTop = i;
    const hTop = hs[liftTop];
    const chain = shape !== 'launch';

    const ridden = () => !!rides[c.id];
    const style = () => rideStyle(c.id, ridden()) + (ridden() ? '' : ';--car:#ece6d6;--card:#7f7a6e');
    const label = () => `Pixel illustration of ${c.name}, ${ridden() ? 'in color because you have ridden it' : 'in gray until you ride it'}`;
    const caption = () => `Illustration, not the real track. ${ridden() ? 'In color: it\'s one of your credits.' : 'Gray until you ride it.'}`;
    const [bx, by, bw, bh] = RV_BOX;

    const html = `<figure class="window ride-view">
        <div class="window-bar"><h2>Pixel view</h2></div>
        <div class="ride-stage sky">
          <span class="cloud" aria-hidden="true"></span>
          <svg class="ride-sprite" viewBox="${bx} ${by} ${bw} ${bh}" shape-rendering="crispEdges" role="img" aria-label="${esc(label())}" style="${style()}">
            ${RV_ISLAND}<g class="rv-track">${prims.map(p => `<g>${p.s}</g>`).join('')}</g>${RV_FRONT}
          </svg>
        </div>
        <figcaption class="ride-caption">${caption()}</figcaption>
      </figure>`;

    let svg = null;
    let cap = null;
    function mount(figure) {
      svg = figure.querySelector('.ride-sprite');
      cap = figure.querySelector('.ride-caption');
      const track = svg.querySelector('.rv-track');
      const pieces = [...track.children];
      const cars = [0, 1, 2].map(() => {
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'rv-car');
        g.innerHTML = R(-2, -4, 4, 3, 'var(--car)') + R(-2, -2, 4, 1, 'var(--card)');
        return g;
      });
      let pos = rest;
      let wait = 0;
      const place = () => cars.forEach((g, k) => {
        const i = ((Math.floor(pos) - k * 3) % N + N) % N;
        const [x, y, d] = at(i);
        g.setAttribute('transform', `translate(${x} ${y})`);
        // painter's order: just before the first track piece nearer the viewer
        let lo = 0, hi = depths.length;
        while (lo < hi) { const m = (lo + hi) >> 1; if (depths[m] <= d) lo = m + 1; else hi = m; }
        track.insertBefore(g, pieces[lo] || null);
      });
      const step = () => {
        if (wait > 0) { wait--; return; }
        const i = Math.floor(pos) % N;
        pos += chain && i < liftTop ? 1 / 3 : .5 + .2 * Math.sqrt(Math.max(0, hTop - hs[i]));
        if (pos >= N) { pos -= N; wait = 12; }
      };

      // 10 steps a second; parked under reduced motion, paused while the tab is
      // hidden or the picture is off screen, and stopped for good once the page
      // has moved on (the timer checks, so the router needs no teardown hook).
      const reduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
      let timer = null;
      let onScreen = true;
      let io = null;
      const halt = () => { clearInterval(timer); timer = null; };
      const sync = () => {
        if (!svg.isConnected) {
          halt();
          document.removeEventListener('visibilitychange', sync);
          if (reduce && reduce.removeEventListener) reduce.removeEventListener('change', sync);
          if (io) io.disconnect();
          return;
        }
        const still = !!(reduce && reduce.matches);
        const run = !still && !document.hidden && onScreen;
        if (still) { pos = rest; wait = 0; place(); }
        if (run && !timer) timer = setInterval(() => { if (!svg.isConnected) { sync(); return; } step(); place(); }, 100);
        else if (!run && timer) halt();
      };
      document.addEventListener('visibilitychange', sync);
      if (reduce && reduce.addEventListener) reduce.addEventListener('change', sync);
      if ('IntersectionObserver' in window) {
        io = new IntersectionObserver(es => { onScreen = es[es.length - 1].isIntersecting; sync(); });
        io.observe(svg);
      }
      place();
      sync();
    }

    function refresh() {
      if (!svg) return;
      svg.setAttribute('style', style());
      svg.setAttribute('aria-label', label());
      cap.textContent = caption();
    }

    return { html, mount, refresh };
  }

  // ---- ride stats: js/stats.json (CC BY-SA 4.0), lazy-loaded once ----
  // Every string from the file is escaped. Links are built only from a QID
  // (^Q\d+$), a URL-encoded title and an integer revision ID; nothing else in
  // the file ever becomes a URL. A value whose source is not a complete
  // Wikipedia or Wikidata reference is treated as missing.

  const STATS_SRC = 'js/stats.json';
  let statsLoad = null;
  function loadStats() {
    if (!statsLoad) {
      statsLoad = fetch(STATS_SRC)
        .then(res => {
          if (res.status === 404) return null; // not published yet: say so, no retry
          if (!res.ok) throw new Error(`stats ${res.status}`);
          return res.json();
        })
        .then(d => (d && d.schema === 1 && d.coasters && typeof d.coasters === 'object' ? d : null))
        .catch(err => { statsLoad = null; throw err; }); // a network failure can be retried
    }
    return statsLoad;
  }

  function fillRideStats(id) {
    const box = $('#rideStats');
    loadStats().then(data => {
      if (box.isConnected) box.innerHTML = rideStatsHtml(data, id);
    }, () => {
      if (!box.isConnected) return;
      box.innerHTML = '<p class="ride-stats-msg">Couldn\'t load ride stats. Check your signal and try again.</p><button class="btn btn-small" type="button" id="statsRetry">Retry</button>';
      $('#statsRetry').addEventListener('click', () => {
        box.innerHTML = '<p class="ride-stats-msg" role="status">Loading ride stats…</p>';
        fillRideStats(id);
      });
    });
  }

  const STAT_ROWS = [
    { k: 'height', label: 'Height', core: true, fmt: 'len' },
    { k: 'drop', label: 'Drop', fmt: 'len' },
    { k: 'speed', label: 'Top speed', core: true, fmt: 'speed' },
    { k: 'length', label: 'Track length', core: true, fmt: 'len' },
    { k: 'inversions', label: 'Inversions', core: true, fmt: 'int' },
    { k: 'gforce', label: 'G-force', core: true, fmt: 'g' },
    { k: 'duration', label: 'Ride time', fmt: 'dur' },
    // names and dates: full-width rows under the number tiles
    { k: 'material', label: 'Wood or steel', core: true, fmt: 'material', row: true },
    { k: 'type', label: 'Type', fmt: 'list', row: true },
    { k: 'manufacturer', label: 'Manufacturer', core: true, fmt: 'str', row: true },
    { k: 'designer', label: 'Designer', fmt: 'str', row: true },
    { k: 'model', label: 'Model', fmt: 'str', row: true },
    { k: 'opened', label: 'Opened', core: true, fmt: 'date', row: true },
  ];
  // `closed` is deliberately not shown: open data lags closures (T-4, Q-029).
  const SOURCE_NAMES = { wp: 'Wikipedia', wd: 'Wikidata' };
  const MATERIALS = { steel: 'Steel', wood: 'Wood', hybrid: 'Hybrid (wood and steel)' };
  const STAT_DATE_RE = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

  const isNum = n => typeof n === 'number' && Number.isFinite(n);
  const fig = (n, digits = 0) => n.toLocaleString('en-US', { maximumFractionDigits: digits });
  const refOk = (src, ref) => !!ref && typeof ref === 'object' && (src === 'wp'
    ? ref.lang === 'en' && typeof ref.title === 'string' && ref.title.trim() !== '' && Number.isInteger(ref.revid) && ref.revid > 0
    : src === 'wd' && typeof ref.qid === 'string' && /^Q\d+$/.test(ref.qid));

  // Imperial first. The unit the source published shows its figure verbatim;
  // the other unit is converted from the stored metric value.
  function statValue(fmt, f) {
    const v = f.v;
    const pub = Array.isArray(f.pub) && isNum(f.pub[0]) ? f.pub : null;
    const pubIn = unit => (pub && pub[1] === unit ? fig(pub[0], 3) : null);
    switch (fmt) {
      case 'len':
        return isNum(v) ? { main: `${pubIn('ft') || fig(v / 0.3048)} ft`, alt: `${pubIn('m') || fig(v, 1)} m` } : null;
      case 'speed':
        return isNum(v) ? { main: `${pubIn('mph') || fig(v / 1.609344)} mph`, alt: `${pubIn('km/h') || fig(v)} km/h` } : null;
      case 'dur': {
        if (!isNum(v)) return null;
        const s = Math.round(pub && pub[1] === 's' ? pub[0] : v);
        return { main: s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}` };
      }
      case 'g': return isNum(v) ? { main: `${fig(v, 2)} g` } : null;
      case 'int': return Number.isInteger(v) && v >= 0 ? { main: String(v) } : null;
      case 'material': return Object.prototype.hasOwnProperty.call(MATERIALS, v) ? { main: MATERIALS[v] } : null;
      case 'list': {
        const a = (Array.isArray(v) ? v : [v]).filter(s => typeof s === 'string' && s.trim());
        return a.length ? { main: esc(a.join(', ')) } : null;
      }
      case 'str': return typeof v === 'string' && v.trim() ? { main: esc(v) } : null;
      case 'date': {
        const m = typeof v === 'string' ? STAT_DATE_RE.exec(v) : null;
        if (!m) return null;
        if (m[3]) return { main: esc(fmtDate(v)) };
        if (m[2]) return { main: esc(new Date(Number(m[1]), Number(m[2]) - 1, 1).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })) };
        return { main: m[1] };
      }
      default: return null;
    }
  }

  function rideStatsHtml(data, id) {
    if (!data) return '<p class="ride-stats-msg">Ride stats aren\'t available yet.</p>';
    const e = Object.prototype.hasOwnProperty.call(data.coasters, id) ? data.coasters[id] : null;
    const own = e && e.refs && typeof e.refs === 'object' ? e.refs : {};
    // `lang` and `retrieved` are hoisted to the top of the file; a coaster's ref
    // carries its own only where it differs (per-coaster value, else file default).
    const refs = {};
    for (const k of Object.keys(SOURCE_NAMES)) {
      const r = own[k];
      if (r && typeof r === 'object') {
        refs[k] = { lang: data.lang, retrieved: data.retrieved, ...r };
      }
    }
    const used = new Set();
    const rows = STAT_ROWS.map(row => {
      const f = e && e[row.k] && typeof e[row.k] === 'object' ? e[row.k] : null;
      const src = f && Object.prototype.hasOwnProperty.call(SOURCE_NAMES, f.src) && refOk(f.src, refs[f.src]) ? f.src : null;
      const val = src ? statValue(row.fmt, f) : null;
      if (val) used.add(src);
      return { row, val, src };
    }).filter(({ row, val }) => val || row.core);

    if (!used.size) {
      return '<p class="ride-stats-msg">No stats for this ride yet. We only show figures from open data (Wikipedia and Wikidata), and it doesn\'t cover this one yet.</p>';
    }

    const tiles = rows.map(({ row, val, src }) => (val
      ? `<div class="ride-stat${row.row ? ' is-row' : ''}"><dt>${row.label}</dt><dd class="rs-val"><b>${val.main}</b>${val.alt ? ` <span>${val.alt}</span>` : ''}</dd><dd class="rs-src"><span class="visually-hidden">Source: </span>${SOURCE_NAMES[src]}</dd></div>`
      : `<div class="ride-stat is-missing${row.row ? ' is-row' : ''}"><dt>${row.label}</dt><dd class="rs-val">Not in open data</dd></div>`)).join('');

    // Credit line: title, authors, source revision, license and our changes.
    const ext = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    const wp = used.has('wp') ? refs.wp : null;
    const wd = used.has('wd') ? refs.wd : null;
    let credit = '';
    if (wp) {
      credit += `Stats from the Wikipedia article ${ext(`https://en.wikipedia.org/w/index.php?title=${encodeURIComponent(wp.title)}&amp;oldid=${wp.revid}`, `“${esc(wp.title)}”`)} by Wikipedia contributors, licensed ${ext('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0')}`;
    }
    if (wd) credit += `${wp ? ', and from ' : 'Stats from '}${ext(`https://www.wikidata.org/wiki/${wd.qid}`, 'Wikidata')} (CC0)`;
    credit += '. Units converted by Loop Troupe.';
    const checked = [wp, wd].filter(Boolean).map(r => r.retrieved).filter(d => typeof d === 'string' && DATE_RE.test(d)).sort()[0];
    if (checked) credit += ` Checked ${esc(fmtDate(checked))}.`;

    return `<dl class="ride-stat-grid">${tiles}</dl><p class="ride-credit">${credit}</p>`;
  }

  // Video picks (spec C1a requirement 6) wait on a home and a format (Q-038,
  // T-6). Until a coaster has picks there is no video box at all.
  function rideVideosHtml() {
    return '';
  }

  // ---------- park guides ----------
  // Contract: docs/tech_spec.md, "Park guides". Content is plain data in
  // js/guides/<park-id>.js, lazy-loaded on #/guide/<park-id>[/<section-id>][?preview].
  // Guide text is untrusted data: everything is escaped, then only **bold** and
  // [label](https://…) become markup. Riders log from the guide with the same
  // coasterRow()/bindRows() as everywhere else; the ride-log format is unchanged.

  const guideIndex = () => window.GUIDE_INDEX || {};
  const guideEntry = id => (Object.prototype.hasOwnProperty.call(guideIndex(), id) ? guideIndex()[id] : null);
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const YT_RE = /^[A-Za-z0-9_-]{11}$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const CLAIM_STATUSES = ['draft', 'needs-check', 'verified'];
  const httpsUrl = u => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);
  const txt = v => (v == null ? '' : esc(v));
  const inline = v => txt(v)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  const asList = v => (Array.isArray(v) ? v : []);
  const isClaim = c => !!c && typeof c === 'object' && typeof c.text === 'string';
  const dateText = d => (typeof d === 'string' && DATE_RE.test(d) ? esc(fmtDate(d)) : '');
  const topbarH = () => $('.topbar').offsetHeight;
  const setTopbarVar = () => document.documentElement.style.setProperty('--topbar-h', `${topbarH()}px`);

  const PX = (w, h, body, cls = '') => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${body}</svg>`;
  const CLOSE_SVG = PX(8, 8, [0, 1, 2, 3, 4, 5].map(k => R(k + 1, k + 1, 1, 1, 'currentColor') + R(6 - k, k + 1, 1, 1, 'currentColor')).join(''));
  const MENU_SVG = PX(12, 12, R(1, 2, 10, 2, 'currentColor') + R(1, 5, 10, 2, 'currentColor') + R(1, 8, 10, 2, 'currentColor'));
  const CARET_SVG = PX(8, 8, R(2, 0, 1, 8, 'currentColor') + R(3, 1, 1, 6, 'currentColor') + R(4, 2, 1, 4, 'currentColor') + R(5, 3, 1, 2, 'currentColor'), 'g-caret');
  const PLAY_SVG = PX(8, 8, R(1, 0, 2, 8, 'currentColor') + R(3, 1, 1, 6, 'currentColor') + R(4, 2, 1, 4, 'currentColor') + R(5, 3, 2, 2, 'currentColor'));

  const guideLoads = new Map();
  function loadGuide(id) {
    if (!guideLoads.has(id)) {
      guideLoads.set(id, new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = guideEntry(id).src;
        s.onload = () => resolve();
        s.onerror = () => { s.remove(); guideLoads.delete(id); reject(new Error('guide failed to load')); };
        document.head.appendChild(s);
      }));
    }
    return guideLoads.get(id);
  }

  let guideCtx = null;     // the guide on screen: { id, preview, root, observer }
  let guideRedraw = null;

  function teardownGuide() {
    if (guideCtx && guideCtx.observer) guideCtx.observer.disconnect();
    guideCtx = null;
    guideRedraw = null;
  }

  window.addEventListener('resize', () => { if (guideCtx) setTopbarVar(); });

  function onGuideRoute(id, preview) {
    const { parts, params } = parseHash();
    return parts[0] === 'guide' && parts[1] === id && params.has('preview') === preview;
  }

  // Jumps are instant: on a long guide a smooth scroll takes a second or more,
  // and nothing should slow a rider down.
  function scrollToEl(el) {
    const top = el.getBoundingClientRect().top + window.scrollY - topbarH() - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
  }

  // Scroll a section under the sticky top bar and put focus on its heading.
  function goToSection(sectionId) {
    const el = sectionId ? document.getElementById(`g-${sectionId}`) : null;
    if (!el || !guideCtx || !guideCtx.root.contains(el)) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    scrollToEl(el);
    const h = el.querySelector('.g-sec-title');
    if (h) h.focus({ preventScroll: true });
  }

  function guideMessage(art, html) {
    view.innerHTML = `<div class="empty-state window">${spriteArt(art, false)}${html}</div>`;
  }

  function renderGuide(id, sectionId, params) {
    const preview = params.has('preview');
    const park = parkById.get(id);
    const entry = guideEntry(id);
    if (!park || !entry || typeof entry.src !== 'string') {
      guideMessage('mouse', `<p>Guide not found.</p>${park
        ? `<a class="btn" href="#/park/${park.id}">Go to ${esc(park.name)}</a>`
        : '<a class="btn" href="#/parks">Browse parks</a>'}`);
      return;
    }
    if (entry.published !== true && !preview) {
      // Not out yet: say so without downloading the draft.
      view.innerHTML = `
        <a class="back-link" href="#/park/${park.id}">← ${esc(park.name)}</a>
        <div class="empty-state window g-soon">
          ${spriteArt('launch', false)}
          <p class="kicker">Park guide</p>
          <h2>Our ${esc(park.name)} guide isn't out yet</h2>
          <p>The troupe is still checking every detail. Your ${esc(park.name)} credits are on the park page.</p>
          <a class="btn btn-primary" href="#/park/${park.id}">Go to ${esc(park.name)}</a>
        </div>`;
      return;
    }
    view.innerHTML = `<div class="empty-state window" role="status">${spriteArt('looper', false)}<p>Loading the ${esc(park.name)} guide…</p></div>`;
    const failed = () => {
      guideMessage('hyper', '<p>Couldn\'t load the guide. Check your signal and try again.</p><button class="btn btn-primary" type="button" id="guideRetry">Retry</button>');
      $('#guideRetry').addEventListener('click', () => {
        const now = parseHash();
        renderGuide(id, now.parts[2], now.params);
      });
    };
    loadGuide(id).then(() => {
      if (!onGuideRoute(id, preview)) return; // the rider has moved on
      const g = window.GUIDES && window.GUIDES[id];
      if (!g || typeof g !== 'object' || g.schema !== 1) { failed(); return; }
      drawGuide(g, park, preview, sectionId);
    }, () => { if (onGuideRoute(id, preview)) failed(); });
  }

  function drawGuide(g, park, preview, sectionId) {
    const id = park.id;
    const pv = preview ? '?preview' : '';
    const secHref = sid => `#/guide/${id}/${sid}${pv}`;

    // Effective status: a verified claim checked before `staleBefore` is needs-check.
    const eff = c => {
      const st = CLAIM_STATUSES.includes(c.status) ? c.status : 'draft';
      if (st === 'verified' && typeof g.staleBefore === 'string' &&
        !(typeof c.lastVerified === 'string' && c.lastVerified >= g.staleBefore)) return 'needs-check';
      return st;
    };
    // Drafts never render outside preview (the validator also blocks publishing them).
    const shown = c => isClaim(c) && (preview || eff(c) !== 'draft');
    const items = list => asList(list).filter(shown);

    // Coaster references count only when they are this park's coasters.
    const parkCoaster = cid => {
      const c = typeof cid === 'string' ? coasterById.get(cid) : null;
      return c && c.park.id === id ? c : null;
    };
    const credits = isClaim(g.credits) ? g.credits : null;
    const creditsOn = !!credits && shown(credits) && Array.isArray(credits.operating);
    const opIds = creditsOn ? [...new Set(credits.operating)].filter(parkCoaster) : [];

    const sections = asList(g.sections).filter(s => s && typeof s === 'object')
      .map((s, i) => ({ s, sid: SLUG_RE.test(s.id) ? s.id : `section-${i + 1}` }));

    const blockClaims = b => {
      if (!b || typeof b !== 'object') return [];
      if (b.type === 'p') return [b];
      if (b.type === 'plan') return asList(b.steps);
      if (b.type === 'credits') return credits ? [credits] : [];
      return asList(b.items);
    };
    const sectionClaims = s => [s.answer, ...asList(s.blocks).flatMap(blockClaims)].filter(isClaim);
    const lastVerifiedOf = s => sectionClaims(s).filter(c => shown(c) && eff(c) === 'verified' &&
      typeof c.lastVerified === 'string' && DATE_RE.test(c.lastVerified)).map(c => c.lastVerified).sort()[0] || null;

    const allClaims = new Set(sections.flatMap(({ s }) => sectionClaims(s)));
    if (credits) allClaims.add(credits);
    const checkedCount = [...allClaims].filter(c => eff(c) === 'verified').length;

    // Credit-dependent fragments are re-rendered in place after a ride is logged,
    // so the page never jumps and an open video keeps playing.
    const dynR = [];
    const dyn = (render, tag = 'div') => `<${tag} class="g-dyn" data-gdyn="${dynR.push(render) - 1}">${render()}</${tag}>`;

    // Status labels are words, never color alone.
    const badges = (c, { est = true } = {}) => {
      const st = eff(c);
      let b = '';
      if (st === 'draft') b += '<span class="badge badge-draft">Draft</span>';
      if (st === 'needs-check') b += '<span class="badge badge-unconfirmed">Unconfirmed</span>';
      if (est && c.kind === 'estimate') b += '<span class="badge badge-estimate">Estimate</span>';
      return b ? ` <span class="g-badges">${b}</span>` : '';
    };
    const UNCONFIRMED_NOTE = 'We haven\'t tried this yet: check before you go.';
    const claimText = (c, { est = true, note = true } = {}) => {
      const body = inline(c.text) + badges(c, { est });
      return eff(c) === 'needs-check'
        ? `<span class="g-unconf">${body}${note ? ` <span class="g-unconf-note">${UNCONFIRMED_NOTE}</span>` : ''}</span>`
        : body;
    };
    const newBadge = cid => (rides[cid] ? '' : '<span class="badge badge-new">New credit</span>');
    const creditTag = cid => (rides[cid]
      ? `<span class="badge badge-ridden">${CHECK_SVG}Ridden</span>`
      : '<span class="badge badge-new">New credit</span>');
    const subTitle = t => (t ? `<h3 class="g-sub">${txt(t)}</h3>` : '');

    // Where the checklist and the first plan live, for shortcuts.
    let checklistSec = null;
    let planSec = null;
    for (const { s, sid } of sections) {
      for (const b of asList(s.blocks)) {
        if (b && b.type === 'credits' && b.show === 'checklist' && !checklistSec && opIds.length) checklistSec = sid;
        if (b && b.type === 'plan' && !planSec && items(b.steps).length) planSec = sid;
      }
    }

    // ---- blocks ----

    function pBlock(b) {
      if (!shown(b)) return '';
      if (b.tone === 'tip' || b.tone === 'warning') {
        return `<div class="g-block g-callout g-${b.tone}"><span class="g-callout-label">${b.tone === 'tip' ? 'Tip' : 'Heads up'}</span><p>${claimText(b)}</p></div>`;
      }
      return `<div class="g-block"><p class="g-p">${claimText(b)}</p></div>`;
    }

    function listBlock(b) {
      const its = items(b.items);
      if (!its.length) return '';
      const tag = b.ordered ? 'ol' : 'ul';
      return `<div class="g-block">${subTitle(b.title)}<${tag} class="g-list${b.ordered ? ' g-ol' : ''}" role="list">${its.map(c => `<li>${claimText(c)}</li>`).join('')}</${tag}></div>`;
    }

    function factsBlock(b) {
      const its = items(b.items);
      if (!its.length) return '';
      return `<div class="g-block">${subTitle(b.title)}<dl class="g-facts">${its.map(c => `<div class="g-fact"><dt>${txt(c.label)}</dt><dd>${claimText(c)}</dd></div>`).join('')}</dl></div>`;
    }

    function picksBlock(b) {
      const its = items(b.items);
      if (!its.length) return '';
      const ico = b.kind === 'gate' ? 'gate' : b.kind === 'food' ? 'food' : 'flag';
      return `<div class="g-block">${subTitle(b.title)}<ul class="g-picks" role="list">${its.map(c => `
        <li class="g-pick g-pick-${ico}">${icon(ico)}<div class="g-pick-body">
          <h4 class="g-pick-name">${txt(c.name)}</h4>
          ${c.location || c.bestFor ? `<p class="g-pick-meta">${c.location ? `<span>${txt(c.location)}</span>` : ''}${c.bestFor ? `<span><b>Best for</b> ${txt(c.bestFor)}</span>` : ''}</p>` : ''}
          <p>${claimText(c)}</p>
        </div></li>`).join('')}</ul></div>`;
    }

    // Must-ride tiers and ride-by-ride notes: items grouped by coaster, each
    // group headed by the standard coaster row (toggle + log button).
    function ridesBlock(b) {
      const groups = new Map();
      for (const c of items(b.items)) {
        const cid = c.coasterId;
        if (!parkCoaster(cid)) continue;
        if (!groups.has(cid)) groups.set(cid, []);
        groups.get(cid).push(c);
      }
      if (!groups.size) return '';
      const tag = b.ranked ? 'ol' : 'ul';
      const lis = [...groups].map(([cid, cs], i) => {
        const rank = b.ranked ? `<span class="g-rank">#${i + 1}</span>` : '';
        const notes = cs.map(c => (c.label
          ? `<div class="g-note"><span class="g-note-label">${txt(c.label)}</span><p>${claimText(c)}</p></div>`
          : `<p class="g-note">${claimText(c)}</p>`)).join('');
        return `<li class="g-ride">${dyn(() => coasterRow(cid, { sub: rank + newBadge(cid) }))}<div class="g-ride-notes">${notes}</div></li>`;
      }).join('');
      return `<div class="g-block">${subTitle(b.title)}<${tag} class="g-rides window-list" role="list">${lis}</${tag}></div>`;
    }

    let planCount = 0;
    let firstPlanAnchor = null;
    function planBlock(b) {
      const steps = items(b.steps);
      if (!steps.length) return '';
      const n = planCount++;
      const anchor = `g-plan-${typeof b.id === 'string' && SLUG_RE.test(b.id) ? b.id : n + 1}`;
      if (!firstPlanAnchor) firstPlanAnchor = anchor;
      return `<details class="g-block g-plan" id="${anchor}"${n === 0 ? ' open' : ''}>
        <summary class="g-plan-head">${CARET_SVG}<span class="g-plan-title">${txt(b.title) || 'Ride plan'}</span><span class="g-plan-count">${steps.length} step${steps.length === 1 ? '' : 's'}</span></summary>
        <ol class="g-steps" role="list">${steps.map((st, i) => stepHtml(st, i)).join('')}</ol>
      </details>`;
    }

    function stepHtml(st, i) {
      const c = parkCoaster(st.coasterId);
      const est = st.kind === 'estimate' && st.time;
      const head = st.time || c ? `<div class="g-step-head">
          ${c ? `<a class="g-step-ride" href="#/coaster/${c.id}" style="--tc:${colorOf.get(c.id)}">${esc(c.name)}</a>${dyn(() => creditTag(c.id), 'span')}` : ''}
          ${st.time ? `<span class="g-time">${txt(st.time)}</span>${est ? '<span class="badge badge-estimate">Estimate</span>' : ''}` : ''}
        </div>` : '';
      return `<li class="g-step${c ? ' is-ride' : ' is-note'}">
        <span class="g-step-num" aria-hidden="true">${i + 1}</span>
        <div class="g-step-body">${head}<p>${claimText(st, { est: !est })}</p></div>
      </li>`;
    }

    function videoCard(v) {
      const vid = typeof v.videoId === 'string' && YT_RE.test(v.videoId) ? v.videoId : null;
      const url = httpsUrl(v.url);
      const cUrl = httpsUrl(v.creatorUrl);
      const c = parkCoaster(v.coasterId);
      const title = txt(v.title) || 'Video pick';
      const creator = v.creator ? (cUrl
        ? `<a href="${esc(cUrl)}" target="_blank" rel="noopener noreferrer">${txt(v.creator)}</a>`
        : txt(v.creator)) : '';
      let host = '';
      if (url) { try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { host = ''; } }
      const player = vid
        ? `<div class="g-screen" data-vid="${vid}" data-title="${title}">
            <button class="btn g-play" type="button">${PLAY_SVG}Play video<span class="visually-hidden">: ${title}</span></button>
            <span class="g-screen-note">Loads from YouTube when you tap play</span>
          </div>`
        : url
          ? `<div class="g-screen is-link"><a class="btn g-watch" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Watch${host ? ` on ${esc(host)}` : ''}<span class="visually-hidden">: ${title} (opens in a new tab)</span></a></div>`
          : '<div class="g-screen is-empty"><span class="g-screen-note">Video link coming soon</span></div>';
      return `<li class="g-video">
        ${player}
        <div class="g-video-body">
          <h4 class="g-video-title">${title}</h4>
          ${creator || c ? `<p class="g-video-by">${creator ? `<span>by ${creator}</span>` : ''}${c ? `<span>${esc(c.name)}</span>` : ''}</p>` : ''}
          <p>${claimText(v)}</p>
        </div>
      </li>`;
    }

    function videosBlock(b) {
      const its = items(b.items);
      if (!its.length) return '';
      return `<div class="g-block">${subTitle(b.title)}<ul class="g-videos" role="list">${its.map(videoCard).join('')}</ul></div>`;
    }

    // "Your <park> credits": counts operating coasters only.
    const summaryHtml = () => {
      const need = opIds.filter(cid => !rides[cid]);
      const done = opIds.length - need.length;
      const line = done === 0
        ? `None of the ${opIds.length} operating coasters here are in your log yet.`
        : need.length === 0
          ? `You've ridden all ${opIds.length} operating coasters here.`
          : `You've ridden ${done} of ${opIds.length} operating coasters here.`;
      return `<div class="g-credits">
        <div class="g-credits-top">
          <p class="park-frac" aria-hidden="true">${done}<span>/${opIds.length}</span></p>
          <div class="g-credits-copy">
            <h3 class="g-sub">Your ${esc(park.name)} credits</h3>
            <p>${line}</p>
            ${meter(done / opIds.length)}
          </div>
        </div>
        ${need.length ? `<p class="g-todo-label">${done ? 'Still to ride' : 'Operating this season'} (${need.length})</p>
          <ul class="g-todo" role="list">${need.map(cid => `<li>${esc(coasterById.get(cid).name)}</li>`).join('')}</ul>` : ''}
        ${checklistSec ? `<p class="g-credits-cta">${done === 0 ? '<span>Ridden some already? Tick them off.</span>' : ''}<a class="btn btn-small" href="${secHref(checklistSec)}" data-gtarget="g-checklist">Open your checklist</a></p>` : ''}
      </div>`;
    };

    let checklistDrawn = false;
    function creditsBlock(b) {
      if (!creditsOn || !opIds.length) return '';
      if (b.show === 'summary') return `<div class="g-block">${dyn(summaryHtml)}</div>`;
      if (b.show !== 'checklist' || checklistDrawn) return '';
      checklistDrawn = true;
      const legacy = park.coasters.filter(c => !opIds.includes(c.id));
      return `<div class="g-block g-checklist" id="g-checklist">
        <h3 class="g-sub" tabindex="-1">Your credit checklist</h3>
        ${dyn(() => {
          const done = opIds.filter(cid => rides[cid]).length;
          return `<div class="progress-meta g-check-meta"><span><b>${done}</b> of ${opIds.length} operating coasters ridden</span><span>${Math.round(done / opIds.length * 100)}%</span></div>${meter(done / opIds.length)}`;
        })}
        ${dyn(() => `<div class="coaster-list window-list">${opIds.map(cid => coasterRow(cid)).join('')}</div>`)}
        ${legacy.length ? dyn(() => `<p class="g-legacy"><b>Legacy credits</b>, no longer operating and not counted above: ${legacy.map(c => `${rideLink(c.id, esc(c.name), 'g-legacy-link')}${rides[c.id] ? ' (ridden)' : ''}`).join(', ')}.</p>`) : ''}
        <p class="g-fine">${claimText(credits)}</p>
      </div>`;
    }

    function renderBlock(b) {
      if (!b || typeof b !== 'object') return '';
      switch (b.type) {
        case 'p': return pBlock(b);
        case 'list': return listBlock(b);
        case 'facts': return factsBlock(b);
        case 'picks': return picksBlock(b);
        case 'rides': return ridesBlock(b);
        case 'plan': return planBlock(b);
        case 'videos': return videosBlock(b);
        case 'credits': return creditsBlock(b);
        default: return '';
      }
    }

    // Sign-off table and changelog, appended to the freshness section.
    function freshnessExtras() {
      const rows = sections.map(({ s, sid }) => {
        const signed = s.status === 'verified' && dateText(s.lastVerified);
        const lv = lastVerifiedOf(s);
        return `<li>
          <a href="${secHref(sid)}" data-gsec="${sid}">${txt(s.title)}</a>
          <span>${signed ? `Signed off ${signed}${s.verifiedBy ? ` by ${txt(s.verifiedBy)}` : ''}` : 'Not signed off yet'}</span>
          <span>${lv ? `Last verified ${dateText(lv)}` : 'Not verified yet'}</span>
        </li>`;
      }).join('');
      const log = asList(g.changelog).filter(e => e && typeof e === 'object' && typeof e.text === 'string');
      return `<div class="g-block"><h3 class="g-sub">Section sign-off</h3><ul class="g-signoff window-list" role="list">${rows}</ul></div>
        ${log.length ? `<div class="g-block"><h3 class="g-sub">Changelog</h3><ol class="g-changelog" role="list">${log.map(e => `
          <li>${dateText(e.date) ? `<time datetime="${esc(e.date)}">${dateText(e.date)}</time>` : ''}<span>${txt(e.text)}</span></li>`).join('')}</ol></div>` : ''}`;
    }

    function sectionHtml({ s, sid }, idx) {
      const claims = sectionClaims(s).filter(shown);
      const checked = claims.filter(c => eff(c) === 'verified').length;
      const lv = lastVerifiedOf(s);
      const ans = shown(s.answer) ? s.answer : null;
      const ansUnconfirmed = !!ans && eff(ans) === 'needs-check';
      const body = asList(s.blocks).map(renderBlock).join('') + (s.id === 'freshness' ? freshnessExtras() : '');
      return `<section class="window g-section" id="g-${sid}" aria-labelledby="gh-${sid}">
        <div class="window-bar">
          <h2 class="g-sec-title" id="gh-${sid}" tabindex="-1"><span class="g-sec-num" aria-hidden="true">${idx + 1}</span><span>${txt(s.title)}</span></h2>
          ${preview && s.status !== 'verified' ? '<span class="badge badge-draft">Draft</span>' : ''}
        </div>
        <p class="g-sec-meta">${icon('flag')}<span>${lv ? `Last verified ${dateText(lv)}` : 'Not verified yet'}</span>${preview ? `<span class="g-checked">${checked} of ${claims.length} checked</span>` : ''}</p>
        <div class="g-sec-body g-read">
          ${ansUnconfirmed ? `<p class="g-notice"><span class="badge badge-unconfirmed">Unconfirmed</span> ${UNCONFIRMED_NOTE}</p>` : ''}
          ${ans ? `<p class="g-answer">${claimText(ans, { note: !ansUnconfirmed })}</p>` : ''}
          ${body}
        </div>
      </section>`;
    }

    const sectionsHtml = sections.map(sectionHtml).join('');

    const heroFrac = () => {
      const done = opIds.filter(cid => rides[cid]).length;
      return `<p class="g-frac"><b class="g-frac-num">${done}<span>/${opIds.length}</span></b><span class="g-frac-label">operating coasters ridden</span></p>`;
    };
    const heroScene = () => isoScene(opIds.map(cid => ({ id: cid, name: coasterById.get(cid).name, ridden: !!rides[cid] })), {
      seed: id,
      label: `Map of ${park.name}'s operating coasters: ${opIds.filter(cid => rides[cid]).length} of ${opIds.length} ridden, shown in color`,
    });
    const dockCount = () => {
      const need = opIds.filter(cid => !rides[cid]).length;
      return `${CHECK_SVG}<span><span class="visually-hidden">Checklist: </span>${need ? `<b>${need}</b><span class="g-dock-more"> to ride</span>` : 'All ridden'}</span>`;
    };

    view.innerHTML = `<div class="guide" data-guide="${id}">
      <a class="back-link" href="#/park/${id}${pv}">← ${esc(park.name)} park page</a>
      ${preview ? `<div class="g-preview" role="note" aria-label="Draft preview">
        <span class="badge badge-draft">Draft preview</span>
        <p><b>Not yet verified by the team.</b> ${checkedCount} of ${allClaims.size} details checked.</p>
        ${meter(allClaims.size ? checkedCount / allClaims.size : 0)}
      </div>` : ''}
      <section class="guide-head sky">
        <span class="cloud" aria-hidden="true"></span>
        <span class="cloud c2" aria-hidden="true"></span>
        <div class="guide-head-main">
          <p class="kicker">Park guide${g.season ? ` · ${txt(g.season)} season` : ''}</p>
          <h1>${txt(g.title) || esc(park.name)}</h1>
          <div class="meta"><span class="state-tag">${park.state}</span><span>${esc(park.city)}, ${esc(STATE_NAMES[park.state] || park.state)}</span></div>
          ${opIds.length ? dyn(heroFrac) : ''}
          ${firstPlanAnchor || checklistSec ? `<div class="cta-row guide-quick">
            ${firstPlanAnchor ? `<a class="btn btn-primary" href="${secHref(planSec)}" data-gtarget="${firstPlanAnchor}">Ride plan</a>` : ''}
            ${checklistSec ? `<a class="btn" href="${secHref(checklistSec)}" data-gtarget="g-checklist">Credit checklist</a>` : ''}
          </div>` : ''}
        </div>
        ${opIds.length ? `<div class="iso-scene guide-scene">${dyn(heroScene)}</div>` : ''}
      </section>
      <div class="g-layout">
        <nav class="g-index window" id="gIndex" aria-label="Guide sections">
          <div class="window-bar"><h2>In this guide</h2><button class="bar-close g-index-close" type="button" aria-label="Close sections">${CLOSE_SVG}</button></div>
          <ol class="g-index-list" role="list">${sections.map(({ s, sid }, i) => `<li><a href="${secHref(sid)}" data-gsec="${sid}"><span class="g-sec-num" aria-hidden="true">${i + 1}</span><span>${txt(s.title)}</span></a></li>`).join('')}</ol>
        </nav>
        <div class="g-sections">${sectionsHtml || '<div class="empty-state window"><p>Nothing in this guide yet.</p></div>'}</div>
      </div>
      <div class="g-dock">
        <button class="g-dock-btn" type="button" aria-expanded="false" aria-controls="gIndex">
          <span class="g-dock-ico">${MENU_SVG}</span>
          <span class="g-dock-text"><small id="gDockPos">Sections</small><b id="gDockCur">Jump to a section</b></span>
        </button>
        ${checklistSec ? `<a class="g-dock-check" href="${secHref(checklistSec)}" data-gtarget="g-checklist">${dyn(dockCount, 'span')}</a>` : ''}
      </div>
      <div class="g-scrim"></div>
    </div>`;

    const root = view.querySelector('.guide');
    const idx = root.querySelector('.g-index');
    const dockBtn = root.querySelector('.g-dock-btn');
    const scrim = root.querySelector('.g-scrim');
    bindRows();
    setTopbarVar();

    // Section menu: a sticky index on wide screens, a bottom sheet on phones.
    const setSheet = open => {
      idx.classList.toggle('open', open);
      scrim.classList.toggle('open', open);
      dockBtn.setAttribute('aria-expanded', String(open));
      if (open) (idx.querySelector('a[aria-current]') || idx.querySelector('a')).focus();
    };
    dockBtn.addEventListener('click', () => setSheet(!idx.classList.contains('open')));
    scrim.addEventListener('click', () => setSheet(false));
    root.querySelector('.g-index-close').addEventListener('click', () => { setSheet(false); dockBtn.focus(); });
    root.addEventListener('keydown', e => {
      if (e.key === 'Escape' && idx.classList.contains('open')) { setSheet(false); dockBtn.focus(); }
    });

    root.addEventListener('click', e => {
      const play = e.target.closest('.g-play');
      if (play) {
        // Tap-to-load: nothing is requested from YouTube until now.
        const screen = play.closest('.g-screen');
        const vid = screen.dataset.vid;
        if (!YT_RE.test(vid || '')) return;
        const f = document.createElement('iframe');
        f.src = `https://www.youtube-nocookie.com/embed/${vid}?autoplay=1`;
        f.title = screen.dataset.title || 'Video';
        f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen';
        f.allowFullscreen = true;
        f.referrerPolicy = 'strict-origin-when-cross-origin';
        screen.replaceChildren(f);
        screen.classList.add('is-playing');
        f.focus();
        return;
      }
      const jump = e.target.closest('a[data-gtarget]');
      if (jump) {
        const t = document.getElementById(jump.dataset.gtarget);
        if (!t) return;
        e.preventDefault();
        setSheet(false);
        if (t.tagName === 'DETAILS') t.open = true;
        scrollToEl(t);
        const f = t.tagName === 'DETAILS' ? t.querySelector('summary') : t.querySelector('[tabindex="-1"]');
        if (f) f.focus({ preventScroll: true });
        return;
      }
      const sec = e.target.closest('a[data-gsec]');
      if (sec) {
        setSheet(false);
        // Same hash again (no hashchange): scroll ourselves.
        if (sec.getAttribute('href') === location.hash) { e.preventDefault(); goToSection(sec.dataset.gsec); }
      }
    });

    // Track the section being read, for the index highlight and the dock label.
    const secEls = [...root.querySelectorAll('.g-section')];
    const links = [...idx.querySelectorAll('a[data-gsec]')];
    const setCurrent = el => {
      const i = secEls.indexOf(el);
      if (i < 0) return;
      links.forEach((a, j) => { if (j === i) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
      $('#gDockPos').textContent = `Section ${i + 1} of ${secEls.length}`;
      $('#gDockCur').textContent = links[i] ? links[i].textContent.replace(/^\d+/, '').trim() : '';
    };
    if (secEls.length) setCurrent(secEls[0]);
    let observer = null;
    if ('IntersectionObserver' in window && secEls.length) {
      const visible = new Set();
      observer = new IntersectionObserver(entries => {
        entries.forEach(en => (en.isIntersecting ? visible.add(en.target) : visible.delete(en.target)));
        const cur = secEls.find(el => visible.has(el));
        if (cur) setCurrent(cur);
      }, { rootMargin: `-${topbarH() + 8}px 0px -55% 0px` });
      secEls.forEach(el => observer.observe(el));
    }

    guideCtx = { id, preview, root, observer };
    guideRedraw = () => {
      if (!document.body.contains(root)) { teardownGuide(); route(); return; }
      const keep = captureGuideFocus(root);
      root.querySelectorAll('[data-gdyn]').forEach(el => { el.innerHTML = dynR[Number(el.dataset.gdyn)](); });
      bindRows();
      restoreGuideFocus(root, keep);
    };

    if (sectionId) goToSection(sectionId);
  }

  // Keep keyboard focus on the same control when a fragment is redrawn.
  function captureGuideFocus(root) {
    const a = document.activeElement;
    const slot = a && a !== document.body && a.closest ? a.closest('[data-gdyn]') : null;
    if (!slot || !root.contains(slot)) return null;
    const row = a.closest('.coaster-row');
    return {
      k: slot.dataset.gdyn,
      row: row ? row.dataset.id : null,
      cls: ['ride-toggle', 'row-log'].find(c => a.classList.contains(c)) || null,
      i: [...slot.querySelectorAll('a[href], button')].indexOf(a),
    };
  }

  function restoreGuideFocus(root, f) {
    if (!f) return;
    const slot = root.querySelector(`[data-gdyn="${f.k}"]`);
    if (!slot) return;
    let el = f.row && f.cls ? slot.querySelector(`.coaster-row[data-id="${CSS.escape(f.row)}"] .${f.cls}`) : null;
    if (!el && f.i >= 0) el = slot.querySelectorAll('a[href], button')[f.i];
    if (el) el.focus({ preventScroll: true });
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
    else if (page === 'guide' && guideRedraw) guideRedraw();
    else if (page === 'coaster' && coasterRedraw) coasterRedraw();
    else route();
  }

  const backdrop = $('#modalBackdrop');
  const modal = $('#modal');

  function openLogModal(id) {
    const c = coasterById.get(id);
    const existing = rides[id];
    let rating = existing?.rating || 0;

    modal.innerHTML = `
      <div class="window-bar modal-bar">
        <h2 id="modalTitle">${esc(c.name)}</h2>
        <button class="bar-close" type="button" id="closeModal" aria-label="Close">${'<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + [0, 1, 2, 3, 4, 5].map(k => R(k + 1, k + 1, 1, 1, 'currentColor') + R(6 - k, k + 1, 1, 1, 'currentColor')).join('') + '</svg>'}</button>
      </div>
      <div class="modal-body">
        <p class="sub"><span class="swatch" style="background:${colorOf.get(id)}"></span>${esc(c.park.name)} · ${esc(c.park.city)}, ${c.park.state}</p>
        <div class="field">
          <span class="field-label" id="ratingLabel">Your rating</span>
          <div class="star-input" id="starInput" role="group" aria-labelledby="ratingLabel">
            ${[1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" class="${i <= rating ? 'on' : ''}" aria-pressed="${i <= rating}" aria-label="${i} star${i > 1 ? 's' : ''}">${pxStar(true)}</button>`).join('')}
          </div>
        </div>
        <div class="field-row">
          <div class="field">
            <label for="rideDate">First ridden</label>
            <input type="date" id="rideDate" value="${existing?.date || todayISO()}" max="${todayISO()}">
          </div>
          <div class="field">
            <label for="rideCount">Times ridden</label>
            <input type="number" id="rideCount" min="1" max="9999" inputmode="numeric" value="${existing?.count || 1}">
          </div>
        </div>
        <div class="field">
          <label for="rideReview">Ride review</label>
          <textarea id="rideReview" placeholder="Airtime? Roughness? That one moment in the back row…">${esc(existing?.review || '')}</textarea>
        </div>
        <div class="modal-actions">
          ${existing ? '<button class="btn btn-danger btn-small" id="removeRide" type="button">Remove credit</button>' : ''}
          <span class="spacer"></span>
          <button class="btn btn-small" id="cancelModal" type="button">Cancel</button>
          <button class="btn btn-primary btn-small" id="saveRide" type="button">${existing ? 'Save changes' : 'Log credit'}</button>
        </div>
      </div>
    `;
    lastFocus = document.activeElement;
    backdrop.hidden = false;
    modal.focus();

    $('#starInput').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const v = Number(b.dataset.v);
        rating = rating === v ? 0 : v;
        $('#starInput').querySelectorAll('button').forEach(x => {
          const on = Number(x.dataset.v) <= rating;
          x.classList.toggle('on', on);
          x.setAttribute('aria-pressed', on);
        });
      });
    });

    $('#closeModal').addEventListener('click', closeModal);
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

  let lastFocus = null;

  function closeModal() {
    backdrop.hidden = true;
    modal.innerHTML = '';
    // Return focus to the control that opened the dialog, if it still exists.
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    lastFocus = null;
  }

  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
  document.addEventListener('keydown', e => {
    if (backdrop.hidden) return;
    if (e.key === 'Escape') closeModal();
    else if (e.key === 'Tab') {
      // keep keyboard focus inside the dialog
      const f = [...modal.querySelectorAll('button, input, textarea, [href]')].filter(el => !el.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === modal)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------- boot ----------

  route();
})();
