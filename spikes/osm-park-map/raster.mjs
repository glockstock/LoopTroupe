// A tiny software rasterizer for pixel art: every fill lands on whole pixels
// with hard edges (no canvas anti-aliasing). Writes RGBA into an ImageData
// buffer plus a parallel id buffer used for hit-testing (hover/tap a coaster).

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  // little-endian Uint32 view of RGBA bytes = 0xAABBGGRR
  return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0;
}

export function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(f < 1 ? v * f : v + (255 - v) * (f - 1)));
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
}

export class PixelBuffer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.img = new ImageData(w, h);
    this.px = new Uint32Array(this.img.data.buffer);
    this.ids = new Uint16Array(w * h);
    this.mask = null; // optional Uint8Array: ground fills only draw where mask is set
  }

  clear(c = 0) { this.px.fill(c); this.ids.fill(0); }

  pset(x, y, c, id = 0) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.px[i] = c;
    if (id) this.ids[i] = id;
  }

  rect(x, y, w, h, c, id = 0) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    // fully off-screen: also stops TypedArray.fill from reading a negative end as "from the end"
    if (x1 <= x0 || y1 <= y0) return;
    for (let yy = y0; yy < y1; yy++) {
      const row = yy * this.w;
      this.px.fill(c, row + x0, row + x1);
      if (id) this.ids.fill(id, row + x0, row + x1);
    }
  }

  // darken whatever is already there (hard-edged shadows)
  darken(x, y, w, h, f = 0.8) {
    const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(this.w, x + w), y1 = Math.min(this.h, y + h);
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
      const i = yy * this.w + xx, v = this.px[i];
      if (!this.mask || this.mask[i]) this.px[i] = (v & 0xff000000) | (((v >> 16 & 255) * f) << 16) | (((v >> 8 & 255) * f) << 8) | ((v & 255) * f);
    }
  }

  // Scanline fill (even-odd) sampled at pixel centers. `rings` are arrays of
  // [x, y] screen points. `color` is a Uint32 or (x, y) => Uint32.
  // `useMask` restricts to the ground mask; `setMask` writes it.
  fillPoly(rings, color, { id = 0, useMask = false, setMask = false } = {}) {
    let minY = Infinity, maxY = -Infinity;
    const edges = [];
    for (const r of rings) {
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const a = r[j], b = r[i];
        if (a[1] === b[1]) continue;
        edges.push(a[1] < b[1] ? [a[0], a[1], b[0], b[1]] : [b[0], b[1], a[0], a[1]]);
        minY = Math.min(minY, a[1], b[1]); maxY = Math.max(maxY, a[1], b[1]);
      }
    }
    if (!edges.length) return;
    const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(this.h - 1, Math.floor(maxY - 0.5));
    const fn = typeof color === 'function';
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (const e of edges) if (yc >= e[1] && yc < e[3]) xs.push(e[0] + (yc - e[1]) * (e[2] - e[0]) / (e[3] - e[1]));
      xs.sort((p, q) => p - q);
      const row = y * this.w;
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(this.w - 1, Math.ceil(xs[k + 1] - 0.5) - 1);
        for (let x = xa; x <= xb; x++) {
          const i = row + x;
          if (useMask && this.mask && !this.mask[i]) continue;
          this.px[i] = fn ? color(x, y) : color;
          if (id) this.ids[i] = id;
          if (setMask && this.mask) this.mask[i] = 1;
        }
      }
    }
  }

  // Bresenham line with a w x h brush whose top-left is offset by (ox, oy).
  line(x0, y0, x1, y1, c, { id = 0, bw = 1, bh = 1, ox = 0, oy = 0, useMask = false } = {}) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 20000; guard++) {
      if (useMask && this.mask) {
        for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
          const X = x0 + ox + xx, Y = y0 + oy + yy;
          if (X >= 0 && Y >= 0 && X < this.w && Y < this.h && this.mask[Y * this.w + X]) this.pset(X, Y, c, id);
        }
      } else this.rect(x0 + ox, y0 + oy, bw, bh, c, id);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // visit every pixel of a Bresenham line
  walk(x0, y0, x1, y1, fn) {
    let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, k = 0;
    for (let guard = 0; guard < 20000; guard++) {
      fn(x0, y0, k++);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // sprite: array of [x, y, w, h, Uint32] relative to the anchor
  sprite(spr, x, y, id = 0) {
    for (const r of spr) this.rect(x + r[0], y + r[1], r[2], r[3], r[4], id);
  }
}

// Sprite definition helper: rects with hex colors -> rects with Uint32 colors.
export const S = (...rects) => rects.map(([x, y, w, h, c]) => [x, y, w, h, rgb(c)]);
