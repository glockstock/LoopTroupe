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

  const pxStar = on => `<svg class="px-star${on ? ' on' : ''}" viewBox="0 0 9 9" shape-rendering="crispEdges" aria-hidden="true"><use href="#px-star"/></svg>`;

  function stars(n) {
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

  function coasterSprite(spec) {
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
    for (let k = 0; k < 3; k++) {
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
    prims.sort((a, b) => a.d - b.d);
    return prims.map(p => p.s).join('');
  }

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
    document.querySelectorAll('.nav a').forEach(a => {
      const on = a.dataset.route === (page === 'park' ? 'parks' : page);
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
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
              <div class="cname">${esc(c.name)}</div>
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

  function renderPark(id) {
    const park = parkById.get(id);
    if (!park) {
      view.innerHTML = `<div class="empty-state window">${spriteArt('looper', false)}<p>Park not found. <a href="#/parks">Back to parks</a></p></div>`;
      return;
    }
    const { ridden, total } = parkStats(park);
    const pct = total ? ridden / total : 0;

    view.innerHTML = `
      <a class="back-link" href="#/parks">← All parks</a>
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
    parkRedraw = () => renderPark(id);
  }

  let parkRedraw = null;

  const CHECK_SVG = `<svg viewBox="0 0 11 10" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="${
    [[0, 4], [1, 5], [2, 6], [3, 5], [4, 4], [5, 3], [6, 2], [7, 1], [8, 0]].map(([x, y]) => `M${x + 1} ${y + 1}h2v3h-2z`).join('')}"/></svg>`;

  function coasterRow(id, { showPark = false } = {}) {
    const c = coasterById.get(id);
    const r = rides[id];
    const name = esc(c.name);
    return `<div class="coaster-row${r ? ' ridden' : ''}" data-id="${id}" style="--tc:${colorOf.get(id)}">
      <button class="ride-toggle" type="button" aria-pressed="${!!r}" title="${r ? 'Ridden — click to edit or remove' : 'Mark as ridden'}" aria-label="${r ? `${name}: ridden, edit` : `Mark ${name} as ridden`}">
        ${CHECK_SVG}
      </button>
      <div class="coaster-info">
        <div class="cname">${name}</div>
        <div class="csub">
          ${showPark ? `<a href="#/park/${c.park.id}">${esc(c.park.name)}</a><span>${c.park.state}</span>` : ''}
          ${r?.date ? `<span>Ridden ${fmtDate(r.date)}</span>` : ''}
          ${r && (r.count || 1) > 1 ? `<span>×${r.count} rides</span>` : ''}
        </div>
        ${r?.rating ? stars(r.rating) : ''}
        ${r?.review ? `<div class="review-snippet">“${esc(r.review)}”</div>` : ''}
      </div>
      <button class="icon-btn row-log" type="button" aria-label="${r ? `Edit ${name}` : `Log a ride on ${name}`}">${r ? 'Edit' : 'Log ride'}</button>
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
            <div class="cname">${esc(e.c.name)}</div>
            <div class="csub">
              <a href="#/park/${e.c.park.id}">${esc(e.c.park.name)}</a><span>${e.c.park.state}</span>${e.r.date ? `<span>${fmtDate(e.r.date)}</span>` : ''}${(e.r.count || 1) > 1 ? `<span>×${e.r.count} rides</span>` : ''}
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
