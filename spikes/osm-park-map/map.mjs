// Isometric pixel park map: park model (model.mjs) -> whole-pixel 2:1 iso art
// on a canvas, drawn by our own rasterizer (raster.mjs) and shown at an
// integer scale with image-rendering: pixelated.
//
// Projection follows js/app.js: one "sub-unit" moves 2px across and 1px down.
// Here a sub-unit is M meters, where M is the zoom level (meters per sub-unit).
// Ground vertices are snapped to the sub-unit lattice, so every edge stair-steps
// cleanly and panning moves in whole lattice steps.
//
// Occlusion: standing things are drawn in painter's order AND depth-tested per
// pixel (raster.mjs z-buffer). Depth is u + v of the surface point under the
// pixel, which in this projection is exactly the distance toward the viewer, so
// trains and track hide correctly behind buildings and each other.

import { centroid, dist } from './model.mjs';
import { PixelBuffer, rgb, shadeHex, S } from './raster.mjs';

export const TRACK_COLORS = ['#d1342c', '#3868c8', '#e8862c', '#8848c0', '#f2b71f', '#18a49c', '#d8489c', '#2e9e3e'];
export const GHOST = { tc: '#a39d90', tcd: '#7f7a6e', sup: '#cfc8b8' };
export const PX = 2;                  // CSS px per art pixel (the site's sprites are shown at 2x)
const LADDER = [32, 22, 16, 11, 8, 5.5, 4, 2.8, 2, 1.4, 1, 0.7, 0.5]; // meters per sub-unit
const VERT = 2.6;                     // art px per sub-unit of height (about 1.2x true dimetric)
const SLAB = 10;                      // ground slab depth in art px
const TIME_SCALE = 1.5;               // trains run a little faster than life
const TICK_MS = 100;                  // 10 steps a second: stepped, sprite-like motion
const SUP = 1000;                     // support pixels carry coaster id + SUP: pickable, not outlined
const PIN_M = 8;                      // numbered pins replace detail at this zoom and coarser

const UV = [(x, y) => [x, -y], (x, y) => [-y, -x], (x, y) => [-x, y], (x, y) => [y, x]];
const XY = [(u, v) => [u, -v], (u, v) => [-v, -u], (u, v) => [-u, v], (u, v) => [v, u]];

const hex = {
  dirtLit: '#8b5a2b', dirtShade: '#6d4220', lipLit: '#2f7a2a', lipShade: '#256522', seaLit: '#2a6aa8', seaShade: '#1f5590',
  grassA: '#58ac46', grassB: '#4c9d3c', outA: '#6ca456', outB: '#679e51', greenA: '#66b950', greenB: '#5cb04a', woodA: '#3f8f3a', woodB: '#3a8535',
  sand: '#e8d49a', asphalt: '#77736b', asphaltB: '#6f6b63', stall: '#d8d2c2', road: '#8a877f', roadEdge: '#6c6961', roadLine: '#f2d24a',
  water: '#3d8fd6', waterEdge: '#2a6aa8', shimmer: '#9fd4f7', path: '#d9c08a', pathEdge: '#b39a62', fence: '#7a5530',
  tie: '#6b4226', rail: '#a39d90', wallLit: '#f4ead0', wallShade: '#cdbb90', window: '#3b2f1c',
  supFoot: '#7f7a6e', woodSupA: '#c8a26a', woodSupB: '#8a6a3c', chain: '#3b2f1c',
  car: '#fffdf4', carInk: '#3b2f1c', hl: '#f2b71f', ink: '#2b2112',
};
const C = Object.fromEntries(Object.entries(hex).map(([k, v]) => [k, rgb(v)]));
const SKY = Array.from({ length: 8 }, (_, i) => {
  const a = [0x5a, 0xae, 0xe8], b = [0xd4, 0xee, 0xfc];
  return rgb('#' + a.map((v, k) => Math.round(v + (b[k] - v) * i / 7).toString(16).padStart(2, '0')).join(''));
});
const ROOFS = ['#b07a4a', '#9c7552', '#a65e46', '#8f8a7a'];
const ROOF_BY_KIND = { retail: '#c0563c', hotel: '#6f6aa8', toilets: '#5f86b8', warehouse: '#8f8a7a', kiosk: '#c0563c', house: '#a65e46', apartments: '#6f6aa8' };

// ---------- sprites (front-facing, anchored at their ground point) ----------
// tree/pine/stall/gate are the same pixel art as js/app.js.
const SPR = {
  tree: S([-1, -5, 2, 5, '#6b4226'], [-3, -16, 6, 2, '#3f9a3c'], [-5, -14, 10, 3, '#37903a'], [-6, -11, 12, 4, '#2f8233'],
    [-5, -7, 10, 2, '#286f2b'], [-3, -14, 3, 2, '#5cb84f'], [-5, -11, 2, 2, '#4aa64a']),
  pine: S([-1, -3, 2, 3, '#6b4226'], [-1, -18, 2, 2, '#2f8a3e'], [-2, -16, 4, 2, '#2c7a3a'], [-3, -14, 6, 2, '#236a31'],
    [-4, -12, 8, 2, '#2c7a3a'], [-5, -10, 10, 3, '#236a31'], [-6, -7, 12, 4, '#1d5a29'], [-2, -14, 2, 2, '#3f9a4c'], [-4, -10, 2, 2, '#3f9a4c']),
  treeS: S([0, -2, 1, 2, '#6b4226'], [-1, -8, 3, 1, '#4aa64a'], [-2, -7, 5, 3, '#2f8233'], [-1, -4, 3, 1, '#286f2b'], [-1, -7, 1, 1, '#5cb84f']),
  treeXS: S([-1, -3, 3, 2, '#2f8233'], [-1, -3, 1, 1, '#4aa64a'], [0, -1, 1, 1, '#286f2b']),
  stall: S([-6, -8, 12, 8, '#f4ead0'], [-6, -1, 12, 1, '#8a7a58'], [-4, -6, 8, 3, '#3b2f1c'], [-3, -5, 2, 1, '#f2b71f'],
    [-7, -13, 14, 1, '#8f1f19'], [-7, -12, 2, 4, '#d1342c'], [-5, -12, 2, 4, '#fff6e0'], [-3, -12, 2, 4, '#d1342c'],
    [-1, -12, 2, 4, '#fff6e0'], [1, -12, 2, 4, '#d1342c'], [3, -12, 2, 4, '#fff6e0'], [5, -12, 2, 4, '#d1342c']),
  gate: S([-14, -18, 4, 18, '#f4ead0'], [-11, -18, 1, 18, '#b5a377'], [10, -18, 4, 18, '#f4ead0'], [13, -18, 1, 18, '#b5a377'],
    [-16, -25, 32, 7, '#d1342c'], [-16, -19, 32, 1, '#8f1f19'], [-16, -25, 32, 1, '#ef8f86'],
    [-12, -23, 2, 2, '#f2b71f'], [-6, -23, 2, 2, '#f2b71f'], [0, -23, 2, 2, '#f2b71f'], [6, -23, 2, 2, '#f2b71f'],
    [-13, -31, 1, 6, '#3b2f1c'], [-12, -31, 4, 3, '#f2b71f'], [12, -31, 1, 6, '#3b2f1c'], [13, -31, 4, 3, '#3868c8']),
  gateS: S([-7, -9, 2, 9, '#f4ead0'], [5, -9, 2, 9, '#f4ead0'], [-8, -12, 16, 3, '#d1342c'], [-8, -10, 16, 1, '#8f1f19'],
    [-5, -11, 1, 1, '#f2b71f'], [-1, -11, 1, 1, '#f2b71f'], [3, -11, 1, 1, '#f2b71f']),
  dropTower: S([-1, -38, 3, 37, '#a39d90'], [-1, -38, 1, 37, '#cfc8b8'], [-2, -40, 5, 2, '#d1342c'], [-3, -24, 7, 3, '#f2b71f'],
    [-3, -22, 7, 1, '#8a5a00'], [-4, -1, 9, 1, '#7f7a6e']),
  sign: S([0, -10, 1, 10, '#4e3519'], [-6, -17, 13, 8, '#2b2112'], [-5, -16, 11, 6, '#7a5530'], [-4, -12, 1, 1, '#ffd866'],
    [-3, -13, 1, 1, '#ffd866'], [-2, -14, 2, 1, '#ffd866'], [0, -13, 1, 1, '#ffd866'], [1, -12, 1, 1, '#ffd866'],
    [2, -13, 1, 1, '#ffd866'], [3, -14, 1, 1, '#ffd866']),
};
SPR.carousel = (() => {
  const r = [[-1, -15, 2, 1, '#f2b71f']];
  for (const [w, y] of [[2, -14], [6, -13], [10, -12], [14, -11]]) for (let x = -w / 2, k = 0; x < w / 2; x += 2, k++) r.push([x, y, 2, 1, k % 2 ? '#fff6e0' : '#d1342c']);
  r.push([-7, -10, 14, 1, '#8f1f19']);
  for (const x of [-6, -3, 1, 4]) r.push([x, -9, 1, 6, '#f4ead0']);
  r.push([-4, -6, 2, 2, '#e8862c'], [2, -6, 2, 2, '#3868c8'], [-1, -5, 2, 2, '#f2b71f'], [-7, -3, 14, 1, '#d9c08a'], [-7, -2, 14, 2, '#b39a62']);
  return S(...r);
})();
SPR.bigWheel = (() => {
  const r = [], cy = -15, R = 11;
  for (let y = cy; y < 0; y++) { const o = Math.round((y - cy) / -cy * 6); r.push([-o, y, 1, 1, '#7f7a6e'], [o, y, 1, 1, '#7f7a6e']); }
  for (let k = 0; k < 8; k++) { const t = k / 8 * Math.PI * 2; for (let d = 2; d < R; d++) r.push([Math.round(Math.cos(t) * d), Math.round(cy + Math.sin(t) * d), 1, 1, '#b5a377']); }
  for (let a = 0; a < 72; a++) { const t = a / 72 * Math.PI * 2; r.push([Math.round(Math.cos(t) * R), Math.round(cy + Math.sin(t) * R), 1, 1, '#f4ead0']); }
  for (let k = 0; k < 8; k++) { const t = (k + .5) / 8 * Math.PI * 2; r.push([Math.round(Math.cos(t) * R) - 1, Math.round(cy + Math.sin(t) * R), 2, 2, TRACK_COLORS[k]]); }
  r.push([-1, cy - 1, 2, 2, '#d1342c'], [-7, -1, 15, 1, '#7f7a6e']);
  return S(...r);
})();
const GUEST_SHIRTS = ['#d1342c', '#3868c8', '#f2b71f', '#8848c0', '#18a49c', '#e8862c', '#fbf3dc'].map(rgb);

function hash(n) { n = Math.imul(n ^ (n >>> 15), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return (n ^ (n >>> 16)) >>> 0; }
const hash2 = (a, b) => hash((a * 73856093) ^ (b * 19349663));

function signedArea(r) {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return -a / 2; // positive = counter-clockwise (x east, y north)
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// A coaster's look: its site color when it counts as ridden (or in "all colors"
// mode), the gray ghost otherwise, exactly like the site's dioramas.
export function styleFor(color, colored) {
  if (!colored) return { tc: GHOST.tc, tcd: GHOST.tcd, sup: GHOST.sup, train: false, colored: false };
  return { tc: color, tcd: shadeHex(color, 0.62), sup: '#fbf3dc', train: true, colored: true };
}

export class ParkMap {
  constructor(frame, park, { styles = [], numbers = [], labelOf = c => c.name, reducedMotion = false, onSelect = () => {}, onView = () => {} } = {}) {
    this.frame = frame;
    this.park = park;
    this.labelOf = labelOf;
    this.numbers = park.coasters.map((c, i) => numbers[i] || i + 1);
    this.reduced = reducedMotion;
    this.onSelect = onSelect;
    this.onView = onView;
    this.hover = 0;
    this.selected = 0;
    this.trainsOn = !reducedMotion;
    this.view = { M: 4, cx: 0, cy: 0, rot: 0 };
    this.setStyles(styles, false);

    this.base = document.createElement('canvas');
    this.over = document.createElement('canvas');
    this.base.className = 'map-base';
    this.over.className = 'map-over';
    this.base.setAttribute('aria-hidden', 'true');
    this.over.setAttribute('aria-hidden', 'true');
    this.pins = document.createElement('div');
    this.pins.className = 'map-pins';
    this.pins.setAttribute('aria-hidden', 'true');
    frame.prepend(this.base, this.over, this.pins);
    this.tip = frame.querySelector('.map-tip');

    this.prepare();
    this.bind();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(frame);
    this.resize();
    if (!this.reduced) this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  setStyles(styles, redraw = true) {
    this.styles = this.park.coasters.map((c, i) => styles[i] || styleFor(TRACK_COLORS[i % TRACK_COLORS.length], true));
    if (redraw) this.render();
  }

  // ---------- precomputation ----------

  prepare() {
    const park = this.park;
    // trees scattered through wood polygons on a jittered 10 m grid
    this.woodTrees = [];
    for (const poly of park.woods) {
      const xs = poly.outer.map(p => p[0]), ys = poly.outer.map(p => p[1]);
      for (let x = Math.min(...xs); x < Math.max(...xs); x += 10) for (let y = Math.min(...ys); y < Math.max(...ys); y += 10) {
        const h = hash2(Math.round(x), Math.round(y));
        const p = [x + (h % 7) - 3, y + ((h >> 4) % 7) - 3];
        if (pointInRing(p, poly.outer)) this.woodTrees.push({ p, h });
      }
    }
    this.trees = park.trees.map(p => ({ p, h: hash2(Math.round(p[0] * 10), Math.round(p[1] * 10)) })).concat(this.woodTrees);
    this.inPark = p => !park.outline.length || park.outline.some(poly => pointInRing(p, poly.outer));
    // guests along footpaths inside the park
    this.guests = [];
    park.paths.forEach((path, pi) => {
      if (!/footway|pedestrian|path/.test(path.kind)) return;
      for (let i = 1; i < path.pts.length; i++) {
        const a = path.pts[i - 1], b = path.pts[i], L = dist(a, b);
        for (let s = 6; s < L; s += 14) {
          const h = hash2(pi * 1000 + i, Math.round(s));
          if (h % 3 === 0) continue;
          const t = s / L, off = ((h % 5) - 2) * 0.5;
          const p = [a[0] + (b[0] - a[0]) * t + off, a[1] + (b[1] - a[1]) * t - off];
          if (this.inPark(p)) this.guests.push({ p, shirt: GUEST_SHIRTS[h % GUEST_SHIRTS.length] });
        }
      }
    });
    // stations: a block at the middle of each track's station section
    this.stations = [];
    park.coasters.forEach(c => c.tracks.forEach(tr => {
      const st = tr.sections.station || [0, 20];
      const i = Math.min(tr.pts.length - 3, Math.max(2, Math.round((st[0] + st[1]) / 2 / tr.ds)));
      const a = tr.pts[i - 2], b = tr.pts[i + 2], m = tr.pts[i];
      const L = dist(a, b) || 1, ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      const xs = tr.pts.map(p => p[0]), ys = tr.pts.map(p => p[1]);
      const span = Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      const hl = Math.max(5, Math.min(13, span * 0.05)), hw = Math.max(3, Math.min(5, span * 0.02));
      const ring = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([s, n]) => [m[0] + ux * s - uy * n, m[1] + uy * s + ux * n]);
      this.stations.push({ coaster: c, ring, center: m });
    }));
    // trains: one per track, staggered start
    this.trains = [];
    park.coasters.forEach(c => c.tracks.forEach((tr, k) => {
      const st = tr.sections.station || [0, 10];
      this.trains.push({ c, tr, s: tr.closed && !this.reduced ? (hash(c.index * 31 + k) % 1000) / 1000 * tr.length : st[1] * 0.6, dwell: 0, stopped: true });
    }));
    this.maxH = Math.max(10, ...park.coasters.map(c => c.maxHeight || 0));
    // the peak of each coaster (for pins and labels)
    this.peaks = park.coasters.map(c => {
      if (!c.tracks.length) return c.pt ? { p: c.pt, h: 6 } : null;
      let best = null;
      for (const tr of c.tracks) tr.h.forEach((h, i) => { if (!best || h > best.h) best = { p: tr.pts[i], h }; });
      return best;
    });
  }

  // ---------- view ----------

  resize() {
    const W = Math.max(40, Math.floor(this.frame.clientWidth / PX)), H = Math.max(40, Math.floor(this.frame.clientHeight / PX));
    if (W === this.W && H === this.H) return;
    const first = !this.W;
    this.W = W; this.H = H;
    for (const cv of [this.base, this.over]) {
      cv.width = W; cv.height = H;
      cv.style.width = W * PX + 'px'; cv.style.height = H * PX + 'px';
    }
    this.buf = new PixelBuffer(W, H);
    this.buf.mask = new Uint8Array(W * H);
    this.obuf = new PixelBuffer(W, H);
    if (first) {
      // open on the rotation that shows the park largest
      let best = null;
      for (let rot = 0; rot < 4; rot++) {
        this.view.rot = rot;
        const t = this.fitTarget();
        if (!best || t.M < best.M - 1e-9) best = { ...t, rot };
      }
      this.view = best;
    }
    this.render();
  }

  proj(view = this.view) {
    const { M, rot, cx, cy } = view;
    const uv = UV[rot];
    const [cu, cv] = uv(cx, cy);
    const cU = Math.round(cu / M), cV = Math.round(cv / M);
    const W2 = this.W >> 1, H2 = this.H >> 1, k = VERT / M;
    return {
      M, uv, cU, cV, W2, H2, rot,
      p: (x, y, h = 0) => { const q = uv(x, y); const U = Math.round(q[0] / M) - cU, V = Math.round(q[1] / M) - cV; return [W2 + (U - V) * 2, H2 + U + V - Math.round(h * k)]; },
      d: (x, y) => { const q = uv(x, y); return q[0] + q[1]; },
      z: (x, y) => { const q = uv(x, y); return (q[0] + q[1]) / M; },
      hpx: h => Math.round(h * k),
      g: (sx, sy) => { const a = (sx - W2) / 2, b = sy - H2; return [(a + b) / 2 + cU, (b - a) / 2 + cV]; },
      world: (sx, sy) => { const a = (sx - W2) / 2, b = sy - H2; return XY[rot](((a + b) / 2 + cU) * M, ((b - a) / 2 + cV) * M); },
    };
  }

  // the most detailed ladder step that fits a set of world points (+ their height)
  fitPoints(pts, maxH, fill) {
    const uv = UV[this.view.rot];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of pts) {
      const [u, v] = uv(p[0], p[1]);
      xmin = Math.min(xmin, u - v); xmax = Math.max(xmax, u - v);
      ymin = Math.min(ymin, u + v); ymax = Math.max(ymax, u + v);
    }
    const wide = Math.max(8, xmax - xmin), tall = Math.max(8, ymax - ymin);
    let M = LADDER[0];
    for (const m of LADDER) if (wide * 2 / m <= this.W * fill && (tall + maxH * VERT) / m + SLAB <= this.H * fill) M = m;
    // center the footprint, then nudge it down by half the tallest structure
    const a = (xmin + xmax) / 2, b = (ymin + ymax) / 2 - maxH * VERT / 2 + SLAB * M / 2;
    const [cx, cy] = XY[this.view.rot]((a + b) / 2, (b - a) / 2);
    return { M, cx, cy };
  }

  // default view: frame the coasters (outlines often include parking and campgrounds)
  fitTarget() {
    const rides = this.park.coasters.flatMap(c => (c.tracks.length ? c.tracks.flatMap(t => t.pts.filter((_, i) => i % 4 === 0)) : c.pt ? [c.pt] : []));
    const pts = rides.length ? rides : this.park.outline.flatMap(p => p.outer);
    return { ...this.fitPoints(pts.length ? pts : [[0, 0]], this.maxH, 0.96), rot: this.view.rot };
  }

  coasterTarget(id) {
    const c = this.park.coasters[id - 1];
    if (!c) return null;
    const pts = c.tracks.length ? c.tracks.flatMap(t => t.pts) : [c.pt];
    return this.fitPoints(pts, c.maxHeight || 10, 0.8);
  }

  animateTo(target) {
    clearInterval(this.anim);
    const from = { ...this.view };
    if (this.reduced) { Object.assign(this.view, target); this.render(); return; }
    let i = 0;
    const steps = 5;
    this.anim = setInterval(() => {
      i++;
      const f = i / steps;
      this.view.M = i === steps ? target.M : Math.exp(Math.log(from.M) + (Math.log(target.M) - Math.log(from.M)) * f);
      this.view.cx = from.cx + (target.cx - from.cx) * f;
      this.view.cy = from.cy + (target.cy - from.cy) * f;
      this.render();
      if (i === steps) clearInterval(this.anim);
    }, 70);
  }

  fit() { this.animateTo(this.fitTarget()); }

  zoomBy(dir, at) {
    const { M } = this.view;
    let idx = LADDER.reduce((best, m, i) => (Math.abs(Math.log(m / M)) < Math.abs(Math.log(LADDER[best] / M)) ? i : best), 0);
    idx = Math.max(0, Math.min(LADDER.length - 1, idx + dir));
    const M2 = LADDER[idx];
    if (M2 === M) return;
    // keep the ground point under the cursor (or the center) fixed
    const P = this.proj();
    const sx = at ? at[0] : P.W2, sy = at ? at[1] : P.H2;
    const [U, V] = P.g(sx, sy);
    const u = U * M, v = V * M;
    const a = (sx - P.W2) / 2, b = sy - P.H2;
    const [cx, cy] = XY[this.view.rot](u - (a + b) / 2 * M2, v - (b - a) / 2 * M2);
    Object.assign(this.view, { M: M2, cx, cy });
    this.render();
  }

  panBy(dxArt, dyArt, from = this.view) {
    const M = this.view.M, a = dxArt / 2, b = dyArt;
    const dU = (a + b) / 2, dV = (b - a) / 2;
    const [cu, cv] = UV[this.view.rot](from.cx, from.cy);
    const [cx, cy] = XY[this.view.rot](cu - dU * M, cv - dV * M);
    this.view.cx = cx; this.view.cy = cy;
  }

  rotate() {
    this.view.rot = (this.view.rot + 1) % 4;
    this.render();
  }

  canZoom(dir) {
    const i = LADDER.indexOf(this.view.M);
    return i < 0 || (dir > 0 ? i < LADDER.length - 1 : i > 0);
  }

  // ---------- drawing ----------

  render() {
    const t0 = performance.now();
    const P = this.proj(), B = this.buf, M = P.M, W = this.W, H = this.H, park = this.park;
    B.clear(0);
    B.mask.fill(0);
    for (let k = 0; k < 8; k++) B.rect(0, Math.floor(H * k / 8), W, Math.ceil(H / 8) + 1, SKY[k]);
    const ringS = r => r.map(p => P.p(p[0], p[1]));
    const checker = (a, b) => (x, y) => { const [U, V] = P.g(x, y); return ((Math.floor(U / 8) + Math.floor(V / 8)) & 1) ? b : a; };
    const wg = park.waterGrid;
    const waterAt = wg ? (x, y) => { const w = P.world(x, y); return wg.isWater(w[0], w[1]); } : () => false;
    const waterPx = (x, y) => {
      const [U, V] = P.g(x, y), ui = Math.floor(U), vi = Math.floor(V);
      return hash2(ui, vi) % 37 === 0 || hash2(ui - 1, vi + 1) % 37 === 0 ? C.shimmer : C.water;
    };

    // ---- ground slab: the drawn region (park plus surroundings) ----
    const [rx0, ry0, rx1, ry1] = park.region;
    const corners = [[rx0, ry0], [rx1, ry0], [rx1, ry1], [rx0, ry1]];
    const top = ringS(corners);
    for (let i = 0; i < 4; i++) {
      const a = top[i], b = top[(i + 1) % 4], wa = corners[i], wb = corners[(i + 1) % 4];
      if (pointInRing([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 1.5], top)) continue; // back edge
      const lit = (b[0] - a[0]) * (b[1] - a[1]) > 0;
      // the slab's side is lake-blue where water reaches the edge
      const sideFn = deep => (x) => {
        const t = b[0] === a[0] ? 0 : Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
        const wet = wg && wg.isWater(wa[0] + (wb[0] - wa[0]) * t, wa[1] + (wb[1] - wa[1]) * t);
        return wet ? (lit ? C.seaLit : C.seaShade) : deep ? (lit ? C.dirtLit : C.dirtShade) : (lit ? C.lipLit : C.lipShade);
      };
      B.fillPoly([[a, b, [b[0], b[1] + SLAB], [a[0], a[1] + SLAB]]], sideFn(true));
      B.fillPoly([[a, b, [b[0], b[1] + 3], [a[0], a[1] + 3]]], sideFn(false));
    }
    const outsideA = park.outline.length ? C.outA : C.grassA, outsideB = park.outline.length ? C.outB : C.grassB;
    B.fillPoly([top], (x, y) => {
      if (waterAt(x, y)) return waterPx(x, y);
      const [U, V] = P.g(x, y);
      return (hash2(Math.floor(U), Math.floor(V)) & 15) === 0 ? outsideB : outsideA;
    }, { setMask: true });
    // the park itself on bright checkered grass
    const parkGrass = checker(C.grassA, C.grassB);
    for (const poly of park.outline) B.fillPoly([ringS(poly.outer), ...poly.inners.map(ringS)], (x, y) => (waterAt(x, y) ? waterPx(x, y) : parkGrass(x, y)), { useMask: true });

    // ---- flat ground features, clipped to the slab ----
    const fillG = (polys, color) => { for (const poly of polys) B.fillPoly([ringS(poly.outer), ...poly.inners.map(ringS)], color, { useMask: true }); };
    fillG(park.greens, checker(C.greenA, C.greenB));
    fillG(park.woods, checker(C.woodA, C.woodB));
    fillG(park.sand, C.sand);
    const stallEvery = Math.max(0, Math.round(2.6 / M));
    fillG(park.parking, (x, y) => {
      const [U, V] = P.g(x, y), ui = Math.floor(U), vi = Math.floor(V);
      if (stallEvery >= 2 && ui % stallEvery === 0 && ((vi % 12) + 12) % 12 > 1) return C.stall;
      return (hash2(ui, vi) & 7) === 0 ? C.asphaltB : C.asphalt;
    });
    fillG(park.water, waterPx);
    for (const poly of park.water) for (const r of [poly.outer, ...poly.inners]) {
      const s = ringS(r);
      for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; B.line(a[0], a[1], b[0], b[1], C.waterEdge, { useMask: true }); }
    }
    if (wg) for (const [ax, ay, bx, by] of wg.segs) {
      const a = P.p(ax, ay), b = P.p(bx, by);
      if ((a[0] < -50 && b[0] < -50) || (a[0] > W + 50 && b[0] > W + 50) || (a[1] < -50 && b[1] < -50) || (a[1] > H + 50 && b[1] > H + 50)) continue;
      B.line(a[0], a[1], b[0], b[1], C.waterEdge, { useMask: true });
    }
    fillG(park.plazas, C.path);
    for (const poly of park.plazas) {
      const s = ringS(poly.outer);
      for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; B.line(a[0], a[1], b[0], b[1], C.pathEdge, { useMask: true }); }
    }
    const segQuad = (a, b, w) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L * w / 2, uy = dy / L * w / 2;
      return [[a[0] - ux - uy, a[1] - uy + ux], [b[0] + ux - uy, b[1] + uy + ux], [b[0] + ux + uy, b[1] + uy - ux], [a[0] - ux + uy, a[1] - uy - ux]].map(p => P.p(p[0], p[1]));
    };
    const near = q => q[0] > -60 && q[0] < W + 60 && q[1] > -60 && q[1] < H + 60;
    const strokes = (lines, extra, color) => {
      for (const ln of lines) {
        const w = Math.max(ln.width, M * 1.1) + extra;
        for (let i = 1; i < ln.pts.length; i++) {
          const a = ln.pts[i - 1], b = ln.pts[i];
          if (!near(P.p(a[0], a[1])) && !near(P.p(b[0], b[1])) && dist(a, b) < 300) continue;
          B.fillPoly([segQuad(a, b, w)], color, { useMask: true });
        }
      }
    };
    if (M <= 5.5) strokes(park.roads, M * 1.2, C.roadEdge);
    strokes(park.roads, 0, C.road);
    if (M <= 2) for (const r of park.roads) {
      const s = r.pts.map(p => P.p(p[0], p[1]));
      for (let i = 1; i < s.length; i++) B.walk(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], (x, y, k) => { if (k % 6 < 3 && x >= 0 && y >= 0 && x < W && y < H && B.mask[y * W + x]) B.pset(x, y, C.roadLine); });
    }
    // footpaths: true width when zoomed in; 1 px lines at overview so they don't pave the park
    if (M <= 2.8) {
      strokes(park.paths, M * 1.2, C.pathEdge);
      strokes(park.paths, 0, C.path);
    } else {
      for (const ln of park.paths) {
        const s = ln.pts.map(p => P.p(p[0], p[1]));
        for (let i = 1; i < s.length; i++) if (near(s[i - 1]) || near(s[i])) B.line(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], C.path, { useMask: true });
      }
    }
    for (const rail of park.rails) {
      const s = rail.pts.map(p => P.p(p[0], p[1]));
      for (let i = 1; i < s.length; i++) {
        if (M <= 2) B.line(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], C.tie, { useMask: true, bw: 3, ox: -1 });
        B.line(s[i - 1][0], s[i - 1][1], s[i][0], s[i][1], C.rail, { useMask: true });
      }
    }
    // the park fence along the outline
    for (const poly of park.outline) {
      const s = ringS(poly.outer);
      for (let i = 0; i < s.length; i++) { const a = s[i], b = s[(i + 1) % s.length]; B.line(a[0], a[1], b[0], b[1], C.fence, { useMask: true }); }
    }
    // track footprints as a hard shadow on the ground
    for (const c of park.coasters) for (const tr of c.tracks) {
      const g = tr.pts.map(p => P.p(p[0], p[1]));
      if (tr.closed) g.push(g[0]);
      for (let i = 1; i < g.length; i++) {
        if (g[i][0] === g[i - 1][0] && g[i][1] === g[i - 1][1]) continue;
        B.walk(g[i - 1][0], g[i - 1][1], g[i][0], g[i][1], (x, y, k) => { if (k) B.darken(x, y, 1, 1, 0.8); });
      }
    }

    // ---- standing objects: painter's order by depth, plus the z-buffer ----
    const objs = [];
    const onScreen = (s, m = 60) => s[0] > -m && s[0] < W + m && s[1] > -m && s[1] < H + m * 3;
    const flat = z => () => z;

    const stationRoofNear = (pt) => {
      for (const st of this.stations) if (dist(st.center, pt) < 16) return this.styles[st.coaster.index].tc;
      return null;
    };
    park.buildings.forEach((b, bi) => {
      const c = centroid(b.poly.outer);
      if (!onScreen(P.p(c[0], c[1]), 300)) return;
      const roof = stationRoofNear(c) || (b.attraction ? '#8848c0' : ROOF_BY_KIND[b.kind] || ROOFS[hash(bi + 1) % ROOFS.length]);
      objs.push({ d: P.d(c[0], c[1]), f: () => this.block(P, b.poly.outer, b.height, roof, 0) });
    });
    for (const st of this.stations) {
      if (!onScreen(P.p(st.center[0], st.center[1]), 100)) continue;
      const id = st.coaster.index + 1;
      objs.push({ d: P.d(st.center[0], st.center[1]) + 1.5, f: () => this.block(P, st.ring, 7, this.styles[st.coaster.index].tc, id) });
    }

    const bw = M <= 1.4 ? 3 : 2;
    // flat spur and storage track
    for (const ax of park.aux) {
      const st = ax.coaster ? this.styles[ax.coaster.index] : styleFor(GHOST.tc, false);
      const id = ax.coaster ? ax.coaster.index + 1 : 0, tc = rgb(st.tc), td = rgb(st.tcd);
      const s = ax.pts.map(p => ({ s: P.p(p[0], p[1], 1.2), z: P.z(p[0], p[1]), d: P.d(p[0], p[1]) }));
      for (let k = 0; k + 1 < s.length; k++) {
        const a = s[k], b = s[k + 1];
        if (!onScreen(a.s) && !onScreen(b.s)) continue;
        objs.push({ d: (a.d + b.d) / 2, zf: flat((a.z + b.z) / 2), f: () => {
          B.line(a.s[0], a.s[1], b.s[0], b.s[1], td, { id, bw, bh: 1, ox: -1, oy: 1 });
          B.line(a.s[0], a.s[1], b.s[0], b.s[1], tc, { id, bw, bh: 1, ox: -1, oy: 0 });
        } });
      }
    }
    for (const c of park.coasters) {
      const id = c.index + 1, st = this.styles[c.index];
      const tc = rgb(st.tc), td = rgb(st.tcd), sup = rgb(st.sup);
      if (!c.tracks.length && c.pt) {
        const s = P.p(c.pt[0], c.pt[1]);
        if (onScreen(s)) objs.push({ d: P.d(c.pt[0], c.pt[1]), zf: flat(P.z(c.pt[0], c.pt[1])), f: () => B.sprite(SPR.sign, s[0], s[1], id) });
        continue;
      }
      for (const tr of c.tracks) {
        const stride = Math.max(1, Math.round(M / tr.ds * 0.6));
        const idx = [];
        for (let i = 0; i < tr.pts.length; i += stride) idx.push(i);
        if (tr.closed) idx.push(0);
        const pt = idx.map(i => {
          const [x, y] = tr.pts[i];
          return { x, y, h: tr.h[i], s: P.p(x, y, tr.h[i]), g: P.p(x, y, 0), d: P.d(x, y), z: P.z(x, y), at: i * tr.ds };
        });
        const lift = tr.sections.lift || tr.sections.launch;
        const supStep = Math.max(1, Math.round((c.wooden ? Math.max(4, M * 2) : Math.max(10, M * 3)) / (tr.ds * stride)));
        for (let k = 0; k + 1 < pt.length; k++) {
          const a = pt[k], b = pt[k + 1];
          if (!onScreen(a.s) && !onScreen(b.s)) continue;
          const onLift = lift && a.at >= lift[0] && a.at < lift[1] && !tr.sections.launch;
          const za = a.z, zb = b.z, xa = a.s[0], xb = b.s[0];
          const zf = xa === xb ? flat(Math.max(za, zb)) : x => za + (zb - za) * Math.max(0, Math.min(1, (x - xa) / (xb - xa)));
          objs.push({ d: (a.d + b.d) / 2, zf, f: () => {
            B.line(a.s[0], a.s[1], b.s[0], b.s[1], td, { id, bw, bh: 1, ox: -1, oy: 1 });
            B.line(a.s[0], a.s[1], b.s[0], b.s[1], tc, { id, bw, bh: 2, ox: -1, oy: -1 });
            if (onLift && M <= 2) B.walk(a.s[0], a.s[1], b.s[0], b.s[1], (x, y, n) => { if (n % 2) B.pset(x, y, C.chain, id); });
          } });
          if (k % supStep === 0 && a.h > 3.2) {
            const nb = pt[Math.min(pt.length - 1, k + supStep)];
            objs.push({ d: a.d - 0.05, zf: flat(a.z - 0.05), f: () => this.support(P, a, nb, c.wooden, k / supStep, id + SUP, sup, st.colored) });
          }
        }
      }
    }

    const treeSpr = M >= 5.5 ? [SPR.treeXS, SPR.treeXS] : M >= 2.8 ? [SPR.treeS, SPR.treeS] : [SPR.tree, SPR.pine];
    const thin = M >= 16 ? 4 : M >= 11 ? 3 : M >= 8 ? 2 : 1;
    for (const t of this.trees) {
      if (thin > 1 && t.h % thin) continue;
      const s = P.p(t.p[0], t.p[1]);
      if (!onScreen(s, 20) || s[0] < 0 || s[1] < 0 || s[0] >= W || s[1] >= H || !B.mask[s[1] * W + s[0]]) continue;
      objs.push({ d: P.d(t.p[0], t.p[1]), zf: flat(P.z(t.p[0], t.p[1])), f: () => B.sprite(treeSpr[t.h % 3 === 0 ? 1 : 0], s[0], s[1]) });
    }
    // fixed-size sprites only where they are not larger than life
    if (M < PIN_M) for (const a of park.attractions) {
      const spr = a.kind === 'carousel' ? SPR.carousel : a.kind === 'big_wheel' ? SPR.bigWheel : a.kind === 'drop_tower' ? SPR.dropTower : null;
      if (!spr && (M >= 4 || park.buildings.some(b => b.attraction && b.name === a.name))) continue;
      if (spr === SPR.carousel && M >= 4) continue;
      const s = P.p(a.pt[0], a.pt[1]);
      if (onScreen(s)) objs.push({ d: P.d(a.pt[0], a.pt[1]), zf: flat(P.z(a.pt[0], a.pt[1])), f: () => B.sprite(spr || SPR.stall, s[0], s[1]) });
    }
    if (park.gate && M < PIN_M) {
      const s = P.p(park.gate[0], park.gate[1]), spr = M >= 4 ? SPR.gateS : SPR.gate;
      if (onScreen(s)) objs.push({ d: P.d(park.gate[0], park.gate[1]) + 2, zf: flat(P.z(park.gate[0], park.gate[1]) + 1), f: () => B.sprite(spr, s[0], s[1]) });
    }
    if (M <= 1.4) for (const g of this.guests) {
      const s = P.p(g.p[0], g.p[1]);
      if (!onScreen(s, 10) || s[0] < 0 || s[1] < 0 || s[0] >= W || s[1] >= H || !B.mask[s[1] * W + s[0]]) continue;
      objs.push({ d: P.d(g.p[0], g.p[1]), zf: flat(P.z(g.p[0], g.p[1])), f: () => { B.rect(s[0], s[1] - 6, 2, 2, rgb('#f0c49a')); B.rect(s[0], s[1] - 4, 2, 3, g.shirt); B.rect(s[0], s[1] - 1, 2, 1, C.ink); } });
    }

    objs.sort((a, b) => a.d - b.d);
    for (const o of objs) { B.zf = o.zf || null; o.f(); }
    B.zf = null;

    this.base.getContext('2d').putImageData(B.img, 0, 0);
    this.renderMs = performance.now() - t0;
    this.outline = null;
    this.drawOverlay();
    this.placePins(P);
    this.onView(this);
  }

  // an extruded footprint: visible walls (lit left, shaded right), then the roof,
  // each pixel depth-tested with its true iso depth
  block(P, ring, h, roofHex, id) {
    const B = this.buf, M = P.M;
    const ccw = signedArea(ring) > 0;
    const walls = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      let nx = b[1] - a[1], ny = -(b[0] - a[0]);
      if (!ccw) { nx = -nx; ny = -ny; }
      const [nu, nv] = P.uv(nx, ny);
      if (nu + nv <= 0) continue;
      walls.push({ a, b, lit: nv > nu, d: P.d((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) });
    }
    walls.sort((p, q) => p.d - q.d);
    const hpx = P.hpx(h);
    for (const w of walls) {
      const g0 = P.p(w.a[0], w.a[1]), g1 = P.p(w.b[0], w.b[1]), r0 = P.p(w.a[0], w.a[1], h), r1 = P.p(w.b[0], w.b[1], h);
      const za = P.z(w.a[0], w.a[1]), zb = P.z(w.b[0], w.b[1]);
      B.zf = g0[0] === g1[0] ? () => Math.max(za, zb) : x => za + (zb - za) * Math.max(0, Math.min(1, (x - g0[0]) / (g1[0] - g0[0])));
      B.fillPoly([[g0, g1, r1, r0]], w.lit ? C.wallLit : C.wallShade, { id });
      if (M <= 2 && hpx >= 7) {
        for (const f of hpx >= 16 ? [0.35, 0.7] : [0.55]) {
          const dy = Math.round(hpx * f);
          B.walk(g0[0], g0[1] - dy, g1[0], g1[1] - dy, (x, y, k) => { if (k % 3 === 1) B.pset(x, y, C.window, id); });
        }
      }
    }
    // a roof pixel at screen row y lies on the plane at height h: depth = y - H2 + cU + cV + hpx
    const zoff = P.H2 - P.cU - P.cV - hpx;
    B.zf = (x, y) => y - zoff;
    const roof = ring.map(p => P.p(p[0], p[1], h));
    B.fillPoly([roof], rgb(roofHex), { id });
    const edge = rgb(shadeHex(roofHex, 0.7));
    for (let i = 0; i < roof.length; i++) { const a = roof[i], b = roof[(i + 1) % roof.length]; B.line(a[0], a[1], b[0], b[1], edge, { id }); }
  }

  support(P, a, nb, wooden, k, id, supColor, colored) {
    const B = this.buf, M = P.M, sw = M <= 1.4 ? 2 : 1;
    const top = a.s[1] + 2, bottom = a.g[1];
    if (bottom <= top) return;
    if (!wooden) {
      B.rect(a.s[0], top, sw, bottom - top, supColor, id);
      B.rect(a.s[0] - 1, bottom - 1, sw + 2, 1, C.supFoot, id);
      return;
    }
    const wa = colored ? C.woodSupA : supColor, wb = colored ? C.woodSupB : rgb(GHOST.tcd);
    B.rect(a.s[0], top, sw, bottom - top, k % 2 ? wb : wa, id);
    // lattice ledgers between this bent and the next
    if (nb && nb !== a) {
      const step = 5 * M / VERT, hmax = Math.min(a.h, nb.h) - 1;
      const za = a.z, zb = nb.z, xa = a.s[0], xb = nb.s[0];
      B.zf = xa === xb ? () => za : x => za + (zb - za) * Math.max(0, Math.min(1, (x - xa) / (xb - xa)));
      for (let h = step; h < hmax; h += step) {
        const p = P.p(a.x, a.y, h), q = P.p(nb.x, nb.y, h);
        B.line(p[0], p[1], q[0], q[1], wb, { id });
      }
    }
  }

  // numbered pins at overview zooms, where the coasters are only a few pixels
  placePins(P) {
    const show = P.M >= PIN_M;
    this.pins.hidden = !show;
    if (!show) return;
    if (!this.pinEls) {
      this.pinEls = this.park.coasters.map((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.className = 'map-pin';
        b.textContent = this.numbers[i];
        b.addEventListener('pointerdown', e => e.stopPropagation());
        b.addEventListener('click', e => { e.stopPropagation(); this.select(i + 1, { zoom: true }); });
        this.pins.append(b);
        return b;
      });
    }
    const placed = [];
    const order = this.park.coasters.map((c, i) => i).filter(i => this.peaks[i])
      .map(i => { const pk = this.peaks[i]; const s = P.p(pk.p[0], pk.p[1], pk.h); return { i, x: s[0] * PX, y: s[1] * PX }; })
      .sort((a, b) => a.y - b.y);
    for (const el of this.pinEls) el.hidden = true;
    for (const o of order) {
      const el = this.pinEls[o.i], st = this.styles[o.i];
      el.style.setProperty('--c', st.colored ? st.tc : GHOST.tc);
      const w = 26, h = 22;
      let y = o.y - h - 4, ok = false;
      for (let tries = 0; tries < 4 && !ok; tries++) {
        ok = !placed.some(p => Math.abs(p.x - o.x) < w && Math.abs(p.y - y) < h);
        if (!ok) y -= h;
      }
      if (!ok || o.x < 0 || o.x > this.W * PX || y < 0 || y > this.H * PX) continue;
      placed.push({ x: o.x, y });
      el.hidden = false;
      el.style.transform = `translate(${Math.round(o.x - w / 2)}px, ${Math.round(y)}px)`;
    }
  }

  // ---------- overlay: highlight outline and trains ----------

  computeOutline(id) {
    const ids = this.buf.ids, W = this.W, H = this.H;
    const mark = new Uint8Array(W * H), r1 = [], r2 = [];
    let top = null;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (ids[i] === id) { if (!top) top = [x, y]; continue; }
      if ((x > 0 && ids[i - 1] === id) || (x < W - 1 && ids[i + 1] === id) || (y > 0 && ids[i - W] === id) || (y < H - 1 && ids[i + W] === id)) { r1.push(i); mark[i] = 1; }
    }
    for (const i of r1) for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j >= 0 && j < W * H && !mark[j] && ids[j] !== id) { mark[j] = 2; r2.push(j); }
    }
    return { id, r1, r2, top };
  }

  drawOverlay() {
    const O = this.obuf;
    O.clear(0);
    const id = this.hover || this.selected;
    if (id) {
      if (!this.outline || this.outline.id !== id) this.outline = this.computeOutline(id);
      for (const i of this.outline.r2) O.px[i] = C.ink;
      for (const i of this.outline.r1) O.px[i] = C.hl;
    }
    if (this.trainsOn || this.reduced) this.drawTrains(O);
    this.over.getContext('2d').putImageData(O.img, 0, 0);
    this.placeTip(id);
  }

  // cars are depth-tested against the base image, so buildings, station roofs
  // and track in front of them hide them
  drawTrains(O) {
    const P = this.proj(), M = P.M, Z = this.buf.z, W = this.W, H = this.H;
    if (M >= PIN_M) return;
    const cars = [];
    for (const t of this.trains) {
      if (!this.styles[t.c.index].train) continue;
      const { tr } = t, n = tr.length < 300 ? 3 : 4, gap = Math.max(3.2, M * 2.6);
      for (let k = 0; k < n; k++) {
        let s = t.s - k * gap;
        if (tr.closed) s = (s % tr.length + tr.length) % tr.length; else s = Math.max(0, s);
        const i = Math.min(tr.pts.length - 1, Math.floor(s / tr.ds));
        const [x, y] = tr.pts[i];
        cars.push({ s: P.p(x, y, tr.h[i]), d: P.d(x, y), z: P.z(x, y), tc: rgb(this.styles[t.c.index].tc) });
      }
    }
    cars.sort((a, b) => a.d - b.d);
    const put = (x, y, w, h, c, z) => {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = yy * W + xx;
        if (Z[i] > z + 1.5) continue;
        O.px[i] = c;
      }
    };
    for (const c of cars) {
      const [x, y] = c.s;
      if (M >= 2.8) { put(x - 1, y - 3, 3, 2, C.car, c.z); put(x - 1, y - 1, 3, 1, C.carInk, c.z); }
      else { put(x - 2, y - 4, 4, 3, C.car, c.z); put(x - 1, y - 4, 2, 1, c.tc, c.z); put(x - 2, y - 1, 4, 1, C.carInk, c.z); }
    }
  }

  tick() {
    if (document.hidden || !this.trainsOn) return;
    const dt = TICK_MS / 1000;
    for (const t of this.trains) {
      const { tr } = t, sec = tr.sections, st = sec.station || [0, 10];
      if (t.dwell > 0) { t.dwell -= dt; continue; }
      const i = Math.min(tr.pts.length - 1, Math.floor(t.s / tr.ds));
      let v;
      if (t.s < st[1]) v = 3;
      else if (sec.lift && t.s < sec.lift[1]) v = 4.5;
      else if (sec.launch && t.s < sec.launch[1]) v = 6 + 34 * (t.s - sec.launch[0]) / (sec.launch[1] - sec.launch[0]);
      else if (sec.brake && t.s >= sec.brake[0]) v = 5;
      else v = Math.max(5, Math.sqrt(2 * 9.81 * Math.max(0, tr.H + (sec.launch ? 8 : 0) - tr.h[i])));
      t.s += v * dt * TIME_SCALE;
      if (!t.stopped && t.s >= st[1] * 0.6 && t.s < st[1]) { t.stopped = true; t.dwell = 2; }
      if (t.s >= tr.length) { t.s = tr.closed ? t.s - tr.length : 0; t.stopped = false; if (!tr.closed) t.dwell = 1.5; }
    }
    this.drawOverlay();
  }

  placeTip(id) {
    if (!this.tip) return;
    const c = id && this.park.coasters[id - 1];
    const top = this.outline && this.outline.id === id ? this.outline.top : null;
    if (!c || !top) { this.tip.hidden = true; return; }
    this.tip.textContent = this.labelOf(c);
    this.tip.hidden = false;
    const fw = this.frame.clientWidth, tw = this.tip.offsetWidth;
    const x = Math.max(tw / 2 + 4, Math.min(fw - tw / 2 - 4, top[0] * PX));
    const y = Math.max(this.tip.offsetHeight + 6, top[1] * PX - 10);
    this.tip.style.transform = `translate(${Math.round(x - tw / 2)}px, ${Math.round(y - this.tip.offsetHeight)}px)`;
  }

  // ---------- interaction ----------

  pick(cssX, cssY, r) {
    const x = Math.floor(cssX / PX), y = Math.floor(cssY / PX), ids = this.buf.ids;
    let best = 0, bd = Infinity;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const X = x + dx, Y = y + dy;
      if (X < 0 || Y < 0 || X >= this.W || Y >= this.H) continue;
      const id = ids[Y * this.W + X], d = dx * dx + dy * dy;
      if (id && d < bd) { bd = d; best = id > SUP ? id - SUP : id; }
    }
    return best;
  }

  setHover(id) {
    if (id === this.hover) return;
    this.hover = id;
    this.frame.style.cursor = id ? 'pointer' : '';
    this.drawOverlay();
  }

  select(id, { zoom = false } = {}) {
    this.selected = id;
    this.drawOverlay();
    this.onSelect(id ? this.park.coasters[id - 1] : null);
    if (id && zoom) { const t = this.coasterTarget(id); if (t) this.animateTo(t); }
  }

  setTrains(on) {
    this.trainsOn = on;
    this.drawOverlay();
  }

  bind() {
    const f = this.frame;
    let drag = null, raf = 0, pinch = null;
    const local = e => { const r = f.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const touches = new Map();
    const spread = () => { const [a, b] = [...touches.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const mid = () => { const [a, b] = [...touches.values()]; return [Math.floor((a[0] + b[0]) / 2 / PX), Math.floor((a[1] + b[1]) / 2 / PX)]; };
    // two-finger pinch steps through the zoom ladder (one step per ~40% spread change)
    f.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') touches.set(e.pointerId, local(e)); if (touches.size === 2) { pinch = spread(); drag = null; } }, true);
    f.addEventListener('pointermove', e => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, local(e));
      if (touches.size === 2 && pinch) {
        const r = spread() / pinch;
        if (r > 1.4 || r < 0.7) { this.zoomBy(r > 1 ? 1 : -1, mid()); pinch = spread(); }
        e.stopImmediatePropagation();
      }
    }, true);
    const lift = e => { touches.delete(e.pointerId); if (touches.size < 2) pinch = null; };
    f.addEventListener('pointerup', lift, true);
    f.addEventListener('pointercancel', lift, true);
    f.addEventListener('pointerdown', e => {
      if (e.button !== 0 || pinch) return;
      const [x, y] = local(e);
      drag = { x, y, view: { ...this.view }, moved: false, type: e.pointerType };
      f.setPointerCapture(e.pointerId);
    });
    f.addEventListener('pointermove', e => {
      const [x, y] = local(e);
      if (drag) {
        if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 5) { drag.moved = true; f.classList.add('dragging'); }
        if (drag.moved) {
          this.panBy((x - drag.x) / PX, (y - drag.y) / PX, drag.view);
          if (!raf) raf = requestAnimationFrame(() => { raf = 0; this.render(); });
        }
        return;
      }
      if (e.pointerType === 'mouse') this.setHover(this.pick(x, y, 3));
    });
    const end = e => {
      if (!drag) return;
      const [x, y] = local(e);
      if (!drag.moved && e.type === 'pointerup') {
        const id = this.pick(x, y, drag.type === 'mouse' ? 3 : 8);
        this.select(id, { zoom: !!id });
      }
      f.classList.remove('dragging');
      drag = null;
    };
    f.addEventListener('pointerup', end);
    f.addEventListener('pointercancel', end);
    f.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !drag) this.setHover(0); });
    f.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = local(e);
      this.zoomBy(e.deltaY < 0 ? 1 : -1, [Math.floor(x / PX), Math.floor(y / PX)]);
    }, { passive: false });
    f.addEventListener('keydown', e => {
      const step = 24;
      const keys = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
      if (keys[e.key]) { this.panBy(...keys[e.key]); this.render(); }
      else if (e.key === '+' || e.key === '=') this.zoomBy(1);
      else if (e.key === '-' || e.key === '_') this.zoomBy(-1);
      else if (e.key === '0') this.fit();
      else if (e.key === 'r' || e.key === 'R') this.rotate();
      else if (e.key === 'Escape') this.select(0);
      else return;
      e.preventDefault();
    });
  }
}
