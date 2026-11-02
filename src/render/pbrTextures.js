// Procedural PBR texture sets (albedo / normal / roughness) painted on canvases at load time.
// Stylized-realistic: believable materials, warm sunny palette, clean readable detail.
// All patterns wrap (lattice noise on a torus, modular layouts) so every set tiles seamlessly.
import * as THREE from 'three';

const cache = new Map();
const TAU = Math.PI * 2;

// ---------- RNG & math ----------

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;
const range = (rnd, a, b) => a + (b - a) * rnd();
function smooth(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function hexRgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const mixRgb = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const mulRgb = (a, f) => [a[0] * f, a[1] * f, a[2] * f];

// ---------- tileable noise ----------

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

// Per-axis lattice lookup tables (cell index, fraction, faded fraction) with wrap.
function axis(len, period) {
  const i0 = new Int32Array(len);
  const i1 = new Int32Array(len);
  const t = new Float32Array(len);
  const f = new Float32Array(len);
  for (let p = 0; p < len; p++) {
    const c = ((p + 0.5) * period) / len;
    const i = Math.floor(c);
    i0[p] = i % period;
    i1[p] = (i + 1) % period;
    t[p] = c - i;
    f[p] = fade(c - i);
  }
  return { i0, i1, t, f };
}

// One octave of periodic gradient noise (fx * fy cells across the tile), accumulated into out.
function perlinOctave(out, W, H, fx, fy, rnd, amp) {
  const n = fx * fy;
  const gx = new Float32Array(n);
  const gy = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = rnd() * TAU;
    gx[k] = Math.cos(a);
    gy[k] = Math.sin(a);
  }
  const ax = axis(W, fx);
  const ay = axis(H, fy);
  for (let y = 0; y < H; y++) {
    const j0 = ay.i0[y] * fx;
    const j1 = ay.i1[y] * fx;
    const ty = ay.t[y];
    const ty1 = ty - 1;
    const v = ay.f[y];
    let o = y * W;
    for (let x = 0; x < W; x++, o++) {
      const i0 = ax.i0[x];
      const i1 = ax.i1[x];
      const tx = ax.t[x];
      const tx1 = tx - 1;
      const n00 = gx[j0 + i0] * tx + gy[j0 + i0] * ty;
      const n10 = gx[j0 + i1] * tx1 + gy[j0 + i1] * ty;
      const n01 = gx[j1 + i0] * tx + gy[j1 + i0] * ty1;
      const n11 = gx[j1 + i1] * tx1 + gy[j1 + i1] * ty1;
      const u = ax.f[x];
      const a = n00 + (n10 - n00) * u;
      out[o] += amp * (a + (n01 + (n11 - n01) * u - a) * v);
    }
  }
}

function normalize(a) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < a.length; i++) {
    const v = a[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const s = hi > lo ? 1 / (hi - lo) : 0;
  for (let i = 0; i < a.length; i++) a[i] = (a[i] - lo) * s;
  return a;
}

/** Tileable fBm in 0..1. fx/fy = base cells across the tile; octaves stop near pixel size. */
function fbm(W, H, rnd, fx, fy = fx, oct = 4, gain = 0.5) {
  const out = new Float32Array(W * H);
  let cx = Math.max(1, Math.min(Math.round(fx), W >> 1));
  let cy = Math.max(1, Math.min(Math.round(fy), H >> 1));
  let amp = 1;
  for (let o = 0; o < oct; o++) {
    perlinOctave(out, W, H, cx, cy, rnd, amp);
    amp *= gain;
    cx *= 2;
    cy *= 2;
    if (cx > W >> 1 || cy > H >> 1) break;
  }
  return normalize(out);
}

function white(N, rnd) {
  const a = new Float32Array(N);
  for (let i = 0; i < N; i++) a[i] = rnd();
  return a;
}

// Separable box blur with wrap-around.
function blur(src, W, H, r) {
  r = Math.max(1, Math.round(r));
  const tmp = new Float32Array(W * H);
  const out = new Float32Array(W * H);
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let s = 0;
    for (let k = -r; k <= r; k++) s += src[row + mod(k, W)];
    for (let x = 0; x < W; x++) {
      tmp[row + x] = s * inv;
      s += src[row + ((x + r + 1) % W)] - src[row + mod(x - r, W)];
    }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += tmp[mod(k, H) * W + x];
    for (let y = 0; y < H; y++) {
      out[y * W + x] = s * inv;
      s += tmp[((y + r + 1) % H) * W + x] - tmp[mod(y - r, H) * W + x];
    }
  }
  return out;
}

// Bilinear lookup with wrap (for warps and rotated grain).
function sample(F, W, H, x, y) {
  x -= 0.5;
  y -= 0.5;
  const xf = Math.floor(x);
  const yf = Math.floor(y);
  const tx = x - xf;
  const ty = y - yf;
  const x0 = mod(xf, W);
  const x1 = (x0 + 1) % W;
  const r0 = mod(yf, H);
  const y0 = r0 * W;
  const y1 = ((r0 + 1) % H) * W;
  const a = F[y0 + x0];
  const b = F[y0 + x1];
  const c = F[y1 + x0];
  const d = F[y1 + x1];
  return a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty;
}

// Max-deposit of a soft dot into a mask (wrapping), used to rasterise cracks and scratches.
function dab(m, W, H, x, y, v, rad = 0.75) {
  const x0 = Math.floor(x - rad - 0.5);
  const x1 = Math.floor(x + rad + 0.5);
  const y0 = Math.floor(y - rad - 0.5);
  const y1 = Math.floor(y + rad + 0.5);
  for (let py = y0; py <= y1; py++) {
    const row = mod(py, H) * W;
    const dy = py + 0.5 - y;
    for (let px = x0; px <= x1; px++) {
      const dx = px + 0.5 - x;
      const w = v * clamp01(rad + 0.5 - Math.sqrt(dx * dx + dy * dy));
      const i = row + mod(px, W);
      if (w > m[i]) m[i] = w;
    }
  }
}

// Random-walk crack with occasional branches.
function crack(m, W, H, rnd, x, y, len, ang, opt = {}) {
  const { wiggle = 0.45, val = 1, branch = 0.012, rad = 0.6, step = 0.8 } = opt;
  let a = ang;
  for (let s = 0; s < len; s++) {
    a += (rnd() - 0.5) * wiggle;
    x += Math.cos(a) * step;
    y += Math.sin(a) * step;
    const taper = 1 - (s / len) * 0.7;
    dab(m, W, H, x, y, val * taper, rad * (0.6 + 0.4 * taper));
    if (branch && rnd() < branch) {
      const side = rnd() < 0.5 ? -1 : 1;
      crack(m, W, H, rnd, x, y, (len - s) * 0.5, a + side * range(rnd, 0.5, 1.1), {
        wiggle, val: val * 0.8, branch: 0, rad: rad * 0.8, step,
      });
    }
  }
}

// ---------- layers & output ----------

function makeLayers(W, H) {
  const N = W * H;
  return {
    W, H, N,
    r: new Float32Array(N), g: new Float32Array(N), b: new Float32Array(N),
    h: new Float32Array(N), ro: new Float32Array(N),
  };
}

function cloneLayers(L) {
  return {
    W: L.W, H: L.H, N: L.N,
    r: L.r.slice(), g: L.g.slice(), b: L.b.slice(), h: L.h.slice(), ro: L.ro.slice(),
  };
}

function newCanvas(W, H) {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: false });
  return [cv, ctx, ctx.createImageData(W, H)];
}

function rgbCanvas(L, floor = 0.2) {
  const { W, H, N, r, g, b } = L;
  const [cv, ctx, img] = newCanvas(W, H);
  const d = img.data;
  for (let i = 0, o = 0; i < N; i++, o += 4) {
    let R = r[i];
    let G = g[i];
    let B = b[i];
    // keep albedo inside a physically plausible band (~0.03..0.87 linear)
    const l = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    if (l < floor) {
      const k = floor - l;
      R += k;
      G += k;
      B += k;
    }
    d[o] = (R > 0.94 ? 0.94 : R) * 255;
    d[o + 1] = (G > 0.94 ? 0.94 : G) * 255;
    d[o + 2] = (B > 0.94 ? 0.94 : B) * 255;
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function greyCanvas(a, W, H, lo = 0.04) {
  const [cv, ctx, img] = newCanvas(W, H);
  const d = img.data;
  for (let i = 0, o = 0; i < a.length; i++, o += 4) {
    const v = (a[i] < lo ? lo : a[i] > 1 ? 1 : a[i]) * 255;
    d[o] = v;
    d[o + 1] = v;
    d[o + 2] = v;
    d[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

// Sobel normals from a float height field, wrap-around sampling, OpenGL (+Y up) encoding.
function normalCanvas(hf, W, H, strength) {
  const [cv, ctx, img] = newCanvas(W, H);
  const d = img.data;
  const k = (strength * W) / 1024; // Sobel sums are 8x the per-pixel slope
  for (let y = 0; y < H; y++) {
    const ym = ((y - 1 + H) % H) * W;
    const y0 = y * W;
    const yp = ((y + 1) % H) * W;
    for (let x = 0; x < W; x++) {
      const xm = (x - 1 + W) % W;
      const xp = (x + 1) % W;
      const tl = hf[ym + xm];
      const tr = hf[ym + xp];
      const bl = hf[yp + xm];
      const br = hf[yp + xp];
      const dx = tr + 2 * hf[y0 + xp] + br - (tl + 2 * hf[y0 + xm] + bl);
      const dy = bl + 2 * hf[yp + x] + br - (tl + 2 * hf[ym + x] + tr);
      const nx = -dx * k;
      const ny = dy * k; // canvas y runs down, texture v runs up
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + 1);
      const o = (y0 + x) * 4;
      d[o] = (nx * inv * 0.5 + 0.5) * 255;
      d[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      d[o + 2] = (inv * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** Utility: build a normal map canvas from a height canvas (red channel = height). */
export function heightToNormal(heightCanvas, strength = 2) {
  const W = heightCanvas.width;
  const H = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, W, H).data;
  const hf = new Float32Array(W * H);
  for (let i = 0; i < hf.length; i++) hf[i] = src[i * 4] / 255;
  return normalCanvas(hf, W, H, strength);
}

function makeTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

// Generators work on float layers; the height field goes straight to the Sobel pass
// (same code path as heightToNormal) to avoid 8-bit terracing on smooth slopes.
function finish(L, strength, tile, extra = {}) {
  return {
    map: makeTex(rgbCanvas(L), true),
    normalMap: makeTex(normalCanvas(L.h, L.W, L.H, strength), false),
    roughnessMap: makeTex(greyCanvas(L.ro, L.W, L.H), false),
    tile,
    ...extra,
  };
}

// Grime: darkens cavities (height below its local average) and soft random patches.
function grime(L, rnd, amt, cavity = 0.6, tint = [0.62, 0.56, 0.5]) {
  if (amt <= 0) return;
  const { W, H, N, r, g, b, h, ro } = L;
  const n = fbm(W, H, rnd, 3, 3, 5, 0.55);
  const hb = blur(h, W, H, Math.max(2, W / 96));
  for (let i = 0; i < N; i++) {
    const cav = clamp01((hb[i] - h[i]) * 5);
    const t = clamp01(amt * (0.55 * smooth(0.42, 0.85, n[i]) + cavity * cav));
    r[i] *= lerp(1, tint[0], t);
    g[i] *= lerp(1, tint[1], t);
    b[i] *= lerp(1, tint[2], t);
    ro[i] = Math.min(1, ro[i] + t * 0.08);
  }
}

// Rows of rectangular units. cuts[r] = ascending x positions (px, 0..W) where units start.
// Returns per pixel: unit id, distance to vertical/horizontal unit edge, local x/y.
function rowUnits(W, H, cuts) {
  const rows = cuts.length;
  const rowH = H / rows;
  const N = W * H;
  const id = new Int32Array(N);
  const ex = new Float32Array(N);
  const ey = new Float32Array(N);
  const lx = new Float32Array(N);
  const ly = new Float32Array(N);
  const colId = [];
  const colDx = [];
  const colLx = [];
  let base = 0;
  for (let r = 0; r < rows; r++) {
    const c = cuts[r];
    const m = c.length;
    const ids = new Int32Array(W);
    const dxs = new Float32Array(W);
    const lxs = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const xc = x + 0.5;
      let k = -1;
      for (let q = 0; q < m; q++) if (c[q] <= xc) k = q;
      let left;
      let right;
      if (k < 0) {
        k = m - 1;
        left = c[m - 1] - W;
        right = c[0];
      } else {
        left = c[k];
        right = k + 1 < m ? c[k + 1] : c[0] + W;
      }
      ids[x] = base + k;
      dxs[x] = Math.min(xc - left, right - xc);
      lxs[x] = xc - left;
    }
    colId.push(ids);
    colDx.push(dxs);
    colLx.push(lxs);
    base += m;
  }
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    const r = Math.min(rows - 1, Math.floor(yc / rowH));
    const top = r * rowH;
    const dy = Math.min(yc - top, top + rowH - yc);
    const ids = colId[r];
    const dxs = colDx[r];
    const lxs = colLx[r];
    for (let x = 0, i = y * W; x < W; x++, i++) {
      id[i] = ids[x];
      ex[i] = dxs[x];
      ey[i] = dy;
      lx[i] = lxs[x];
      ly[i] = yc - top;
    }
  }
  return { id, ex, ey, lx, ly, count: base, rowH };
}

// Jittered-grid Voronoi (optionally row-staggered) with exact distance to the cell border.
function voronoi(W, H, nx, ny, rnd, jitter, stagger, warpX, warpY, warpAmt) {
  const cw = W / nx;
  const ch = H / ny;
  const px = new Float32Array(nx * ny);
  const py = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      px[k] = (i + 0.5 + (j & 1) * stagger + (rnd() - 0.5) * jitter) * cw;
      py[k] = (j + 0.5 + (rnd() - 0.5) * jitter) * ch;
    }
  }
  const N = W * H;
  const id = new Int32Array(N);
  const edge = new Float32Array(N);
  const cen = new Float32Array(N);
  const nb = new Float32Array(18);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const wx = x + 0.5 + (warpX ? (warpX[i] - 0.5) * warpAmt : 0);
      const wy = y + 0.5 + (warpY ? (warpY[i] - 0.5) * warpAmt : 0);
      const cj = Math.floor(wy / ch);
      let best = Infinity;
      let bx = 0;
      let by = 0;
      let bk = 0;
      let n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        const jj = cj + dj;
        const wj = mod(jj, ny);
        const ci = Math.floor(wx / cw - (wj & 1) * stagger);
        for (let di = -1; di <= 1; di++) {
          const ii = ci + di;
          const wi = mod(ii, nx);
          const k = wj * nx + wi;
          const X = px[k] + (ii - wi) * cw;
          const Y = py[k] + (jj - wj) * ch;
          nb[n++] = X;
          nb[n++] = Y;
          const d = (X - wx) * (X - wx) + (Y - wy) * (Y - wy);
          if (d < best) {
            best = d;
            bx = X;
            by = Y;
            bk = k;
          }
        }
      }
      let e = Infinity;
      for (let q = 0; q < 18; q += 2) {
        const ox = nb[q] - bx;
        const oy = nb[q + 1] - by;
        const l2 = ox * ox + oy * oy;
        if (l2 < 1e-6) continue;
        const l = Math.sqrt(l2);
        const dist = ((wx - (bx + nb[q]) * 0.5) * ox + (wy - (by + nb[q + 1]) * 0.5) * oy) / l;
        if (-dist < e) e = -dist;
      }
      id[i] = bk;
      edge[i] = e;
      cen[i] = Math.sqrt(best);
    }
  }
  return { id, edge, cen, count: nx * ny, cw, ch };
}

// ---------- material generators ----------
// Each fills L (sRGB albedo, height ~0..1, roughness) for a tile of tw x th metres
// and returns the normal-map strength it was tuned for.

function genBrick(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const cols = Math.max(2, Math.round(tw / 0.24));
  const rows = Math.max(2, Math.round(th / 0.15) * 2);
  const bw = W / cols;
  const ppm = W / tw;
  const cuts = [];
  for (let y = 0; y < rows; y++) {
    const off = (y & 1) * bw * 0.5;
    const c = [];
    for (let i = 0; i < cols; i++) c.push(off + (i + (i ? (rnd() - 0.5) * 0.06 : 0)) * bw);
    cuts.push(c);
  }
  const U = rowUnits(W, H, cuts);
  const joint = Math.max(0.8, 0.0055 * ppm);
  const bevel = Math.max(1, 0.006 * ppm);
  const base = hexRgb(o.color || '#a9573a');
  const variants = [
    mixRgb(base, [0.3, 0.19, 0.17], 0.5),
    mixRgb(base, [0.86, 0.52, 0.33], 0.35),
    mixRgb(base, [0.8, 0.66, 0.54], 0.3),
    base,
  ];
  const unit = [];
  for (let k = 0; k < U.count; k++) {
    const t = rnd();
    const v = variants[t < 0.12 ? 0 : t < 0.42 ? 1 : t < 0.52 ? 2 : 3];
    unit.push(mulRgb(mixRgb(base, v, range(rnd, 0.5, 1)), range(rnd, 0.88, 1.1)));
  }
  const mortar = hexRgb('#bdb3a2');
  const edgeN = fbm(W, H, rnd, cols * 4, rows * 2, 3, 0.6);
  const mott = fbm(W, H, rnd, cols * 2, rows, 4, 0.55);
  const grain = white(N, rnd);
  for (let i = 0; i < N; i++) {
    const d = Math.min(U.ex[i], U.ey[i]) - joint + (edgeN[i] - 0.5) * 2.4;
    const cover = clamp01(d + 0.5);
    const c = unit[U.id[i]];
    const m = mott[i] - 0.5;
    const s = grain[i] - 0.5;
    const pit = s > 0.488 ? 1 : 0;
    const shade = 1 + m * 0.24 + s * 0.07 - pit * 0.3;
    const ms = 0.93 + s * 0.12 + m * 0.08;
    r[i] = lerp(mortar[0] * ms, c[0] * shade, cover);
    g[i] = lerp(mortar[1] * ms, c[1] * shade, cover);
    b[i] = lerp(mortar[2] * ms, c[2] * shade, cover);
    const hb = 0.56 + 0.22 * smooth(0, bevel, d) + m * 0.1 + s * 0.02 - pit * 0.1;
    h[i] = lerp(0.2 + s * 0.04, hb, cover);
    ro[i] = lerp(0.95, 0.84 - m * 0.12, cover);
  }
  grime(L, rnd, 0.35 + (o.dirt || 0) * 0.65, 0.45);
  return 3;
}

function genPlaster(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const base = hexRgb(o.color || '#e8d5b0');
  const warm = [base[0] * 1.02, base[1] * 0.96, base[2] * 0.88];
  const fx = Math.max(2, Math.round(tw * 1.2));
  const fy = Math.max(2, Math.round(th * 1.2));
  const patch = fbm(W, H, rnd, fx, fy, 5, 0.6);
  const hue = fbm(W, H, rnd, fx, fy, 3, 0.5);
  const wx = fbm(W, H, rnd, fx * 2, fy * 2, 2, 0.5);
  const wy = fbm(W, H, rnd, fx * 2, fy * 2, 2, 0.5);
  const tro = fbm(W, H, rnd, fx * 4, fy * 4, 3, 0.5);
  const fine = fbm(W, H, rnd, fx * 28, fy * 28, 3, 0.55);
  const cr = new Float32Array(N);
  const nCracks = Math.round(range(rnd, 0.6, 1.6) * tw * th * 0.4);
  for (let k = 0; k < nCracks; k++) {
    crack(cr, W, H, rnd, rnd() * W, rnd() * H, range(rnd, 0.1, 0.25) * W, rnd() * TAU, {
      wiggle: 0.5, rad: 0.45, branch: 0.01,
    });
  }
  const warpA = W * 0.08;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const t = sample(tro, W, H, x + 0.5 + (wx[i] - 0.5) * warpA, y + 0.5 + (wy[i] - 0.5) * warpA);
      const ridge = 1 - Math.abs(2 * t - 1);
      const p = patch[i] - 0.5;
      const f = fine[i] - 0.5;
      const c = smooth(0.35, 0.75, hue[i]);
      const shade = (1 + p * 0.12 + f * 0.07 + (ridge - 0.5) * 0.03) * (1 - cr[i] * 0.3);
      r[i] = lerp(base[0], warm[0], c) * shade;
      g[i] = lerp(base[1], warm[1], c) * shade;
      b[i] = lerp(base[2], warm[2], c) * shade;
      h[i] = 0.5 + (t - 0.5) * 0.1 + ridge * 0.03 + f * 0.05 - cr[i] * 0.06;
      ro[i] = 0.86 + f * 0.1 - ridge * 0.06 + cr[i] * 0.05;
    }
  }
  grime(L, rnd, 0.12 + (o.dirt || 0) * 0.6, 0.3);
  return 2;
}

function genStucco(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const base = hexRgb(o.color || '#e0c39a');
  const fx = Math.max(2, Math.round(tw * 2));
  const fy = Math.max(2, Math.round(th * 2));
  const blobs = fbm(W, H, rnd, fx * 6, fy * 6, 4, 0.5);
  const patch = fbm(W, H, rnd, Math.max(2, fx >> 1), Math.max(2, fy >> 1), 5, 0.6);
  const sand = blur(white(N, rnd), W, H, 1);
  for (let i = 0; i < N; i++) {
    const k = smooth(0.5, 0.6, blobs[i]);
    const s = (sand[i] - 0.5) * 3;
    const p = patch[i] - 0.5;
    const shade = (0.92 + 0.1 * k + s * 0.05) * (1 + p * 0.14);
    r[i] = base[0] * shade;
    g[i] = base[1] * shade;
    b[i] = base[2] * shade;
    h[i] = 0.36 + 0.26 * k + (blobs[i] - 0.5) * 0.18 + s * 0.05;
    ro[i] = 0.92 - k * 0.05 + s * 0.04;
  }
  grime(L, rnd, 0.15 + (o.dirt || 0) * 0.6, 0.5);
  return 2.6;
}

function genConcrete(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const base = hexRgb(o.color || '#b2ada3');
  const ppm = W / tw;
  const pw = W / Math.max(1, Math.round(tw / 1.2));
  const ph = H / Math.max(1, Math.round(th / 1.2));
  const seam = Math.max(0.7, 0.003 * ppm);
  const holeR = Math.max(1.6, 0.014 * ppm);
  const tone = [];
  for (let k = 0; k < 64; k++) tone.push(range(rnd, 0.93, 1.06));
  const patch = fbm(W, H, rnd, 3, 3, 5, 0.6);
  const streak = fbm(W, H, rnd, Math.round(tw * 10), 2, 4, 0.55);
  const fine = fbm(W, H, rnd, Math.round(tw * 22), Math.round(th * 22), 3, 0.55);
  const pores = new Float32Array(N);
  const nPores = Math.round(tw * th * 140);
  for (let k = 0; k < nPores; k++) {
    dab(pores, W, H, rnd() * W, rnd() * H, range(rnd, 0.6, 1), range(rnd, 0.4, 1.4) * (W / 512));
  }
  for (let y = 0, i = 0; y < H; y++) {
    const pyy = y + 0.5;
    const row = Math.floor(pyy / ph);
    const ly = pyy - row * ph;
    const hy = (ly < ph / 2 ? 0.25 : 0.75) * ph;
    const dSeamY = Math.min(ly, ph - ly);
    for (let x = 0; x < W; x++, i++) {
      const pxx = x + 0.5;
      const col = Math.floor(pxx / pw);
      const lx = pxx - col * pw;
      const hx = (lx < pw / 2 ? 0.25 : 0.75) * pw;
      const dSeam = Math.min(lx, pw - lx, dSeamY);
      const sm = 1 - smooth(seam, seam + 1.2, dSeam);
      const dh = Math.hypot(lx - hx, ly - hy);
      const hole = 1 - smooth(holeR - 0.8, holeR + 0.6, dh);
      const ring = smooth(holeR, holeR + 1, dh) * (1 - smooth(holeR + 1.5, holeR + 3, dh));
      const below = ly > hy && Math.abs(lx - hx) < holeR * 2 ? (1 - smooth(0, ph * 0.3, ly - hy)) * 0.5 : 0;
      const p = patch[i] - 0.5;
      const f = fine[i] - 0.5;
      const st = smooth(0.58, 0.8, streak[i]) * 0.6 + below * (1 - Math.abs(lx - hx) / (holeR * 2));
      const t = tone[(row * 8 + col) & 63];
      const shade = t * (1 + p * 0.16 + f * 0.08 + ring * 0.05) * (1 - st * 0.16) *
        (1 - pores[i] * 0.35) * (1 - hole * 0.5) * (1 - sm * 0.2);
      r[i] = base[0] * shade;
      g[i] = base[1] * shade;
      b[i] = base[2] * shade * 0.985;
      h[i] = 0.55 + f * 0.05 + p * 0.03 - sm * 0.12 - pores[i] * 0.2 - hole * 0.32;
      ro[i] = 0.88 + f * 0.08 + pores[i] * 0.08 - st * 0.04;
    }
  }
  grime(L, rnd, 0.2 + (o.dirt || 0) * 0.6, 0.4);
  return 2.5;
}

function genAsphalt(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const base = hexRgb(o.color || '#58554f');
  const ppm = W / tw;
  const tone = fbm(W, H, rnd, Math.max(2, Math.round(tw)), Math.max(2, Math.round(th)), 5, 0.6);
  const mid = fbm(W, H, rnd, Math.round(tw * 8), Math.round(th * 8), 3, 0.5);
  const grain = white(N, rnd);
  const bump = blur(grain, W, H, 1);
  const patch = new Float32Array(N);
  const seal = new Float32Array(N);
  const nPatch = 1 + Math.floor(rnd() * 2);
  for (let k = 0; k < nPatch; k++) {
    const pw = range(rnd, 0.8, 1.8) * ppm;
    const ph = range(rnd, 0.6, 1.2) * ppm;
    const px = Math.floor(rnd() * W);
    const py = Math.floor(rnd() * H);
    const sw = range(rnd, 0.012, 0.022) * ppm;
    for (let yy = -sw - 1; yy < ph + sw + 1; yy++) {
      for (let xx = -sw - 1; xx < pw + sw + 1; xx++) {
        const d = Math.min(xx + 0.5, pw - xx - 0.5, yy + 0.5, ph - yy - 0.5);
        const i = mod(Math.floor(py + yy), H) * W + mod(Math.floor(px + xx), W);
        if (d > 0) patch[i] = Math.max(patch[i], clamp01(d));
        const s = 1 - Math.abs(d) / sw;
        if (s > seal[i]) seal[i] = s;
      }
    }
  }
  const cr = new Float32Array(N);
  const nCr = Math.round(tw * th * 0.15) + 1;
  for (let k = 0; k < nCr; k++) {
    crack(cr, W, H, rnd, rnd() * W, rnd() * H, range(rnd, 0.6, 1.5) * ppm, rnd() * TAU, {
      wiggle: 0.6, rad: 0.55 * (W / 512), branch: 0.02,
    });
  }
  crack(seal, W, H, rnd, rnd() * W, rnd() * H, range(rnd, 1, 2.2) * ppm, rnd() * TAU, {
    wiggle: 0.25, rad: 0.014 * ppm, val: 0.9, branch: 0.004,
  });
  const oil = new Float32Array(N);
  dab(oil, W, H, rnd() * W, rnd() * H, 1, range(rnd, 0.2, 0.35) * ppm);
  const oilS = blur(oil, W, H, 0.08 * ppm);
  for (let i = 0; i < N; i++) {
    const gr = grain[i];
    const pm = patch[i];
    const light = gr > 0.92 ? ((gr - 0.92) / 0.08) * (1 - pm * 0.7) : 0;
    const dark = gr < 0.06 ? 1 : 0;
    const t = tone[i] - 0.5;
    const m = mid[i] - 0.5;
    const sl = smooth(0.15, 0.6, seal[i]);
    const ol = oilS[i] * (0.6 + mid[i] * 0.6);
    let shade = (1 + t * 0.2 + m * 0.1 + light * 0.5 - dark * 0.14) * (1 - pm * 0.06) * (1 - cr[i] * 0.3);
    shade = lerp(shade, 0.84, sl) * (1 - ol * 0.12);
    const warmth = light * 0.04;
    r[i] = base[0] * shade * (1 + warmth);
    g[i] = base[1] * shade;
    b[i] = base[2] * shade * (1 - warmth);
    h[i] = 0.5 + (bump[i] - 0.5) * 0.5 + light * 0.06 + pm * 0.03 + sl * 0.05 - cr[i] * 0.3 + m * 0.03;
    ro[i] = lerp(lerp(0.92 + m * 0.06 - light * 0.1, 0.84, pm) + cr[i] * 0.05, 0.5, sl) - ol * 0.3;
  }
  grime(L, rnd, (o.dirt || 0) * 0.6, 0.3);
  return 2.2;
}

function genPavers(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const rows = Math.max(1, Math.round(th / 0.4));
  const across = Math.max(2, Math.round(tw / 0.2));
  const uw = W / across;
  const cuts = [];
  for (let y = 0; y < rows; y++) {
    let rem = across;
    let acc = Math.floor(rnd() * across);
    const c = [];
    while (rem > 0) {
      const ok = [2, 3, 4].filter((n) => n === rem || rem - n >= 2);
      const n = ok.length ? ok[Math.floor(rnd() * ok.length)] : rem;
      c.push((acc % across) * uw);
      acc += n;
      rem -= n;
    }
    cuts.push(c.sort((a, bb) => a - bb));
  }
  const U = rowUnits(W, H, cuts);
  const ppm = W / tw;
  const joint = Math.max(0.9, 0.0045 * ppm);
  const bevel = Math.max(1.2, 0.008 * ppm);
  const base = hexRgb(o.color || '#c4b8a2');
  const warm = mixRgb(base, [0.82, 0.7, 0.52], 0.45);
  const cool = mixRgb(base, [0.64, 0.64, 0.63], 0.45);
  const unit = [];
  for (let k = 0; k < U.count; k++) {
    const t = rnd();
    const c = t < 0.3 ? warm : t < 0.55 ? cool : base;
    unit.push(mulRgb(mixRgb(base, c, rnd()), range(rnd, 0.88, 1.07)));
  }
  const grout = hexRgb('#8e8476');
  const chipN = fbm(W, H, rnd, Math.round(tw * 24), Math.round(th * 24), 3, 0.5);
  const surf = fbm(W, H, rnd, Math.round(tw * 10), Math.round(th * 10), 4, 0.55);
  const patch = fbm(W, H, rnd, 3, 3, 5, 0.6);
  const sand = white(N, rnd);
  const gum = new Float32Array(N);
  const nGum = Math.round(tw * th * 5);
  for (let k = 0; k < nGum; k++) dab(gum, W, H, rnd() * W, rnd() * H, range(rnd, 0.5, 0.9), range(rnd, 1, 2.4) * (W / 512));
  for (let i = 0; i < N; i++) {
    const e = Math.min(U.ex[i], U.ey[i]) - joint;
    const chip = smooth(0.62, 0.72, chipN[i]) * (1 - smooth(1.5, 5, e));
    const et = e - chip * 5;
    const solid = clamp01(e + 0.5);
    const top = clamp01(et + 0.5);
    const c = unit[U.id[i]];
    const s = surf[i] - 0.5;
    const p = patch[i] - 0.5;
    const shade = (1 + s * 0.12 + p * 0.12 + (sand[i] - 0.5) * 0.05) * lerp(0.86, 1, top) * (1 - gum[i] * 0.3);
    const gs = 0.92 + (sand[i] - 0.5) * 0.25;
    r[i] = lerp(grout[0] * gs, c[0] * shade, solid);
    g[i] = lerp(grout[1] * gs, c[1] * shade, solid);
    b[i] = lerp(grout[2] * gs, c[2] * shade, solid);
    const hs = lerp(0.42, 0.62 + 0.16 * smooth(0, bevel, et) + s * 0.05, top) + gum[i] * 0.04;
    h[i] = lerp(0.24 + (sand[i] - 0.5) * 0.04, hs, solid);
    ro[i] = lerp(0.95, 0.78 + s * 0.12 - gum[i] * 0.2, solid);
  }
  grime(L, rnd, 0.25 + (o.dirt || 0) * 0.6, 0.6);
  return 2.6;
}

function genCobble(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const nx = Math.max(2, Math.round(tw / 0.12));
  const ny = Math.max(2, Math.round(th / 0.24) * 2);
  const ppm = W / tw;
  const wx = fbm(W, H, rnd, nx, ny, 3, 0.5);
  const wy = fbm(W, H, rnd, nx, ny, 3, 0.5);
  const V = voronoi(W, H, nx, ny, rnd, 0.35, 0.5, wx, wy, 0.3 * (W / nx));
  const gap = Math.max(1.4, 0.008 * ppm);
  const rad = 0.62 * Math.min(V.cw, V.ch);
  const R = 0.36 * Math.min(V.cw, V.ch);
  const pal = ['#9a948a', '#b0a491', '#8a857d', '#a89580', '#bdb09b'].map(hexRgb);
  const tint = o.color ? hexRgb(o.color) : null;
  const stone = [];
  for (let k = 0; k < V.count; k++) {
    let c = mixRgb(pal[Math.floor(rnd() * pal.length)], pal[Math.floor(rnd() * pal.length)], rnd());
    if (tint) c = mixRgb(c, tint, 0.5);
    stone.push(mulRgb(c, range(rnd, 0.86, 1.1)));
  }
  const grout = hexRgb('#8a7e6c');
  const surf = fbm(W, H, rnd, nx * 3, ny * 3, 4, 0.55);
  const sand = white(N, rnd);
  for (let i = 0; i < N; i++) {
    const sf = surf[i] - 0.5;
    const e = Math.min(V.edge[i], rad - V.cen[i]) - gap + sf * 2;
    const cover = clamp01(e + 0.5);
    const s = clamp01(e / R);
    const dome = 1 - (1 - s) * (1 - s);
    const c = stone[V.id[i]];
    const shade = (0.8 + 0.22 * dome) * (1 + sf * 0.2);
    const gs = 0.9 + (sand[i] - 0.5) * 0.3;
    r[i] = lerp(grout[0] * gs, c[0] * shade, cover);
    g[i] = lerp(grout[1] * gs, c[1] * shade, cover);
    b[i] = lerp(grout[2] * gs, c[2] * shade, cover);
    h[i] = lerp(0.12 + sand[i] * 0.05, 0.3 + 0.55 * dome + sf * 0.08, cover);
    ro[i] = lerp(0.95, lerp(0.8, 0.5, dome * dome) + sf * 0.12, cover);
  }
  grime(L, rnd, 0.25 + (o.dirt || 0) * 0.6, 0.5);
  return 3.2;
}

function genTiles(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const n = Math.max(1, Math.round(tw / 0.3));
  const m = Math.max(1, Math.round(th / 0.3));
  const cuts = [];
  for (let y = 0; y < m; y++) cuts.push(Array.from({ length: n }, (_, i) => (i * W) / n));
  const U = rowUnits(W, H, cuts);
  const ppm = W / tw;
  const joint = Math.max(0.9, 0.0035 * ppm);
  const bevel = Math.max(1.5, 0.008 * ppm);
  const tw2 = W / n;
  const th2 = H / m;
  const base = hexRgb(o.color || '#b9653f');
  const orange = [0.8, 0.5, 0.31];
  const brown = [0.58, 0.28, 0.2];
  const unit = [];
  const flash = [];
  for (let k = 0; k < U.count; k++) {
    const t = rnd();
    const c = mixRgb(base, t < 0.5 ? orange : brown, range(rnd, 0, 0.45));
    unit.push(mulRgb(c, range(rnd, 0.88, 1.08)));
    flash.push(rnd() < 0.3 ? [rnd() < 0.5 ? 0 : 1, rnd() < 0.5 ? 0 : 1, range(rnd, 0.15, 0.3)] : null);
  }
  const grout = hexRgb('#b7aa94');
  const mott = fbm(W, H, rnd, n * 3, m * 3, 4, 0.55);
  const edgeN = fbm(W, H, rnd, n * 8, m * 8, 2, 0.5);
  const grain = white(N, rnd);
  for (let i = 0; i < N; i++) {
    const e = Math.min(U.ex[i], U.ey[i]) - joint + (edgeN[i] - 0.5) * 1.2;
    const cover = clamp01(e + 0.5);
    const k = U.id[i];
    const c = unit[k];
    const mt = mott[i] - 0.5;
    const s = grain[i] - 0.5;
    let shade = 1 + mt * 0.16 + s * 0.05;
    const f = flash[k];
    if (f) {
      const dx = U.lx[i] / tw2 - f[0];
      const dy = U.ly[i] / th2 - f[1];
      shade *= 1 - f[2] * (1 - smooth(0, 0.85, Math.sqrt(dx * dx + dy * dy)));
    }
    const gs = 0.95 + s * 0.12;
    r[i] = lerp(grout[0] * gs, c[0] * shade, cover);
    g[i] = lerp(grout[1] * gs, c[1] * shade, cover);
    b[i] = lerp(grout[2] * gs, c[2] * shade, cover);
    h[i] = lerp(0.25 + s * 0.04, 0.6 + 0.2 * smooth(0, bevel, e) + mt * 0.05 + s * 0.01, cover);
    ro[i] = lerp(0.92, 0.64 + mt * 0.14 + s * 0.04, cover);
  }
  grime(L, rnd, 0.2 + (o.dirt || 0) * 0.6, 0.6);
  return 2.6;
}

// Shared wood grain: long streaky fBm; its contour lines read as growth rings.
function woodFields(W, H, rnd) {
  return {
    grain: fbm(W, H, rnd, 2, 20, 3, 0.35),
    fibre: fbm(W, H, rnd, 4, 160, 2, 0.6),
    weather: fbm(W, H, rnd, 4, 4, 4, 0.55),
  };
}

function ringOf(v) {
  const t = v * 9;
  return smooth(0.72, 0.98, t - Math.floor(t));
}

function genWoodPlanks(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const rows = Math.max(2, Math.round(th / 0.15));
  const joists = Math.max(1, Math.round(tw / 0.6));
  const jw = W / joists;
  const cuts = [];
  for (let y = 0; y < rows; y++) {
    const c = [];
    for (let j = 0; j < joists; j++) if (rnd() < 0.45) c.push(j * jw);
    if (!c.length) c.push(Math.floor(rnd() * joists) * jw);
    cuts.push(c);
  }
  const U = rowUnits(W, H, cuts);
  const ppx = W / tw;
  const ppy = H / th;
  const gapX = Math.max(0.7, 0.0025 * ppx);
  const gapY = Math.max(0.7, 0.0022 * ppy);
  const base = hexRgb(o.color || '#b07a45');
  const grey = [0.64, 0.61, 0.56];
  const plank = [];
  for (let k = 0; k < U.count; k++) {
    const c = mixRgb(base, rnd() < 0.5 ? [0.56, 0.34, 0.22] : [0.72, 0.55, 0.33], range(rnd, 0, 0.35));
    plank.push({
      c: mulRgb(c, range(rnd, 0.86, 1.1)),
      ox: Math.floor(rnd() * W),
      oy: Math.floor(rnd() * H),
      knot: rnd() < 0.3 ? [rnd(), range(rnd, 0.3, 0.7), range(rnd, 0.01, 0.018) * ppy] : null,
    });
  }
  const F = woodFields(W, H, rnd);
  const nails = new Float32Array(N);
  const rh = H / rows;
  for (let y = 0; y < rows; y++) {
    for (let j = 0; j < joists; j++) {
      const isCut = cuts[y].includes(j * jw);
      for (const side of isCut ? [-1, 1] : [0]) {
        const x = j * jw + side * 0.03 * ppx + (side ? 0 : 0.5);
        for (const f of [0.28, 0.72]) dab(nails, W, H, x, (y + f) * rh, 1, Math.max(0.9, 0.004 * ppy));
      }
    }
  }
  const halo = blur(nails, W, H, 2);
  const weatherAmt = 0.25 + (o.dirt || 0) * 0.35;
  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const P = plank[U.id[i]];
      const gi = mod(y + P.oy, H) * W + mod(x + P.ox, W);
      let v = F.grain[gi];
      let knot = 0;
      if (P.knot) {
        const dx = U.lx[i] - P.knot[0] * jw;
        const dy = U.ly[i] - P.knot[1] * rh;
        const d2 = (dx * dx) / 2.5 + dy * dy;
        const kr = P.knot[2];
        v += 0.25 * Math.exp(-d2 / (kr * kr * 6));
        knot = 1 - smooth(kr * 0.6, kr, Math.sqrt(d2));
      }
      const late = ringOf(v);
      const fib = F.fibre[gi] - 0.5;
      const ex = U.ex[i] - gapX;
      const ey = U.ey[i] - gapY;
      const e = Math.min(ex, ey);
      const cover = clamp01(e + 0.5);
      const edge = smooth(0, 2.2, e);
      const wthr = clamp01(weatherAmt + (F.weather[i] - 0.5) * 0.8) * 0.6;
      const c = P.c;
      const shade = (1 - late * 0.34 + fib * 0.16) * (1 - knot * 0.35) * (0.9 + 0.1 * edge) * (1 - nails[i] * 0.5);
      const rust = halo[i] * 0.4;
      const cr = lerp(c[0], grey[0], wthr) * shade;
      const cg = lerp(c[1], grey[1], wthr) * shade;
      const cb = lerp(c[2], grey[2], wthr) * shade;
      r[i] = lerp(0.24, lerp(cr, 0.45, rust), cover);
      g[i] = lerp(0.17, lerp(cg, 0.27, rust), cover);
      b[i] = lerp(0.12, lerp(cb, 0.17, rust), cover);
      const cup = 1 - Math.pow((2 * U.ly[i]) / rh - 1, 2);
      h[i] = lerp(0.15, 0.55 + 0.15 * edge + cup * 0.05 + late * 0.06 * (0.5 + wthr) + fib * 0.04 - knot * 0.05 + nails[i] * 0.04, cover);
      ro[i] = lerp(0.95, 0.74 + late * 0.08 + wthr * 0.12 - nails[i] * 0.3, cover);
    }
  }
  grime(L, rnd, 0.15 + (o.dirt || 0) * 0.6, 0.5);
  return 2.4;
}

// One crate face per tile: darker frame boards around the edge, a diagonal brace, plank infill.
function genWoodCrate(L, rnd, o, tw) {
  const { W, H, r, g, b, h, ro } = L;
  const ppm = W / tw;
  const fx = Math.round(0.12 * W);
  const fy = Math.round(0.12 * H);
  const planks = 4;
  const ph = (H - 2 * fy) / planks;
  const gap = Math.max(0.6, 0.0018 * ppm);
  const base = hexRgb(o.color || '#bb8d57');
  const frameC = mulRgb(mixRgb(base, [0.42, 0.26, 0.15], 0.3), 0.78);
  const boards = [];
  for (let k = 0; k < 5 + planks; k++) {
    boards.push({
      c: mulRgb(k < 5 ? frameC : mixRgb(base, [0.74, 0.56, 0.36], rnd() * 0.3), range(rnd, 0.9, 1.08)),
      ox: Math.floor(rnd() * W),
      oy: Math.floor(rnd() * H),
    });
  }
  const F = woodFields(W, H, rnd);
  const x0 = fx;
  const y0 = H - fy;
  const ldx = W - 2 * fx;
  const ldy = 2 * fy - H;
  const len = Math.hypot(ldx, ldy);
  const nx = -ldy / len;
  const ny = ldx / len;
  const bw = fx * 0.85;
  const nails = new Float32Array(W * H);
  const nr = Math.max(1, 0.005 * ppm);
  const nail = (x, y) => dab(nails, W, H, x, y, 1, nr);
  for (let k = 0; k < planks; k++) {
    const y = fy + (k + 0.5) * ph;
    nail(fx * 0.5, y);
    nail(W - fx * 0.5, y);
  }
  for (const x of [fx * 0.5, W * 0.5, W - fx * 0.5]) {
    nail(x, fy * 0.5);
    nail(x, H - fy * 0.5);
  }
  for (const t of [0.1, 0.9]) nail(x0 + ldx * t, y0 + ldy * t);
  for (let y = 0, i = 0; y < H; y++) {
    const yc = y + 0.5;
    for (let x = 0; x < W; x++, i++) {
      const xc = x + 0.5;
      let id;
      let e;
      let orient = 0;
      let raised = 1;
      if (yc < fy || yc > H - fy) {
        id = yc < fy ? 0 : 1;
        e = Math.min(xc, W - xc, yc < fy ? Math.min(yc, fy - yc) : Math.min(yc - (H - fy), H - yc));
      } else if (xc < fx || xc > W - fx) {
        id = xc < fx ? 2 : 3;
        orient = 1;
        e = Math.min(yc - fy, H - fy - yc, xc < fx ? Math.min(xc, fx - xc) : Math.min(xc - (W - fx), W - xc));
      } else {
        const dl = Math.abs((xc - x0) * nx + (yc - y0) * ny);
        const ein = Math.min(xc - fx, W - fx - xc, yc - fy, H - fy - yc);
        if (dl < bw / 2) {
          id = 4;
          orient = 2;
          e = Math.min(bw / 2 - dl, ein);
        } else {
          const k = Math.min(planks - 1, Math.floor((yc - fy) / ph));
          id = 5 + k;
          raised = 0;
          e = Math.min(yc - fy - k * ph, (k + 1) * ph - (yc - fy), ein);
        }
      }
      const B = boards[id];
      let v;
      let fib;
      if (orient === 0) {
        const gi = mod(y + B.oy, H) * W + mod(x + B.ox, W);
        v = F.grain[gi];
        fib = F.fibre[gi];
      } else if (orient === 1) {
        const gi = mod(x + B.ox, H) * W + mod(y + B.oy, W);
        v = F.grain[gi];
        fib = F.fibre[gi];
      } else {
        const u = (xc - yc) * Math.SQRT1_2 + B.ox;
        const w = (xc + yc) * Math.SQRT1_2 + B.oy;
        v = sample(F.grain, W, H, u, w);
        fib = sample(F.fibre, W, H, u, w);
      }
      const late = ringOf(v);
      const fb = fib - 0.5;
      const ee = e - gap;
      const cover = clamp01(ee + 0.5);
      const edge = smooth(0, 2.5, ee);
      const wear = raised ? (1 - smooth(0, 3.5, ee)) * 0.16 : 0;
      const shade = (1 - late * 0.26 + fb * 0.14 + wear) * (1 - nails[i] * 0.55);
      const c = B.c;
      r[i] = lerp(0.22, c[0] * shade, cover);
      g[i] = lerp(0.16, c[1] * shade, cover);
      b[i] = lerp(0.11, c[2] * shade, cover);
      const top = raised ? 0.72 : 0.38;
      h[i] = lerp(0.1, top - 0.2 + 0.2 * edge + late * 0.04 + fb * 0.03 + nails[i] * 0.03, cover);
      ro[i] = lerp(0.95, 0.72 + late * 0.1 + fb * 0.06 - nails[i] * 0.3, cover);
    }
  }
  grime(L, rnd, 0.3 + (o.dirt || 0) * 0.6, 0.7);
  return 2.6;
}

function genMetalPainted(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const ppm = W / tw;
  const paint = hexRgb(o.color || '#4f7f8a');
  const faded = mixRgb(paint, [0.82, 0.82, 0.78], 0.3);
  const primer = hexRgb('#b3b0a8');
  const metal = hexRgb('#a2a6ab');
  const band = 0.014 * ppm;
  const rivR = Math.max(1.4, 0.0055 * ppm);
  const rivStep = W / Math.max(2, Math.round(tw / 0.1));
  const chipN = fbm(W, H, rnd, Math.round(tw * 6), Math.round(th * 6), 6, 0.62);
  const fade = fbm(W, H, rnd, 3, 3, 4, 0.55);
  const peel = fbm(W, H, rnd, Math.round(tw * 36), Math.round(th * 36), 2, 0.5);
  const streak = fbm(W, H, rnd, Math.round(tw * 14), 2, 4, 0.5);
  const scr = new Float32Array(N);
  const nScr = Math.round(tw * th * 22);
  for (let k = 0; k < nScr; k++) {
    crack(scr, W, H, rnd, rnd() * W, rnd() * H, range(rnd, 0.03, 0.18) * ppm, rnd() * TAU, {
      wiggle: 0.08, rad: 0.4 * (W / 512), val: range(rnd, 0.5, 1), branch: 0,
    });
  }
  const dirt = o.dirt || 0;
  for (let y = 0, i = 0; y < H; y++) {
    const yc = y + 0.5;
    const dsy = Math.min(yc, H - yc);
    for (let x = 0; x < W; x++, i++) {
      const xc = x + 0.5;
      const dsx = Math.min(xc, W - xc);
      const ds = Math.min(dsx, dsy);
      const lap = 1 - smooth(band - 0.8, band + 0.8, ds);
      const groove = 1 - smooth(0.3, 1.3, ds);
      const dr = Math.min(
        Math.hypot(dsx - band * 0.5, mod(yc, rivStep) - rivStep / 2),
        Math.hypot(dsy - band * 0.5, mod(xc, rivStep) - rivStep / 2),
      );
      const riv = 1 - smooth(rivR - 0.7, rivR + 0.5, dr);
      const dome = riv * Math.sqrt(clamp01(1 - (dr * dr) / (rivR * rivR)));
      const edgeF = Math.exp(-ds / (0.04 * ppm)) * 0.8 + Math.exp(-dr / (rivR * 2.2)) * 0.4;
      const c = chipN[i] + edgeF * 0.2 + dirt * 0.04;
      const bare = Math.max(smooth(0.8, 0.815, c), scr[i] * 0.9);
      const prim = smooth(0.775, 0.79, c) * (1 - bare);
      const fd = smooth(0.45, 0.85, fade[i]) * 0.35;
      const pe = peel[i] - 0.5;
      const st = smooth(0.62, 0.85, streak[i]) * (0.05 + dirt * 0.12);
      const ps = (1 + pe * 0.05) * (1 - st);
      let cr = lerp(paint[0], faded[0], fd) * ps;
      let cg = lerp(paint[1], faded[1], fd) * ps;
      let cb = lerp(paint[2], faded[2], fd) * ps;
      cr = lerp(cr, primer[0], prim);
      cg = lerp(cg, primer[1], prim);
      cb = lerp(cb, primer[2], prim);
      const ms = 0.92 + pe * 0.25;
      r[i] = lerp(cr, metal[0] * ms, bare);
      g[i] = lerp(cg, metal[1] * ms, bare);
      b[i] = lerp(cb, metal[2] * ms, bare);
      h[i] = 0.5 + lap * 0.1 - groove * 0.12 + dome * 0.22 + pe * 0.015 + (1 - bare) * 0.05 + prim * 0.02;
      ro[i] = lerp(lerp(0.46 + fd * 0.18 + pe * 0.04, 0.68, prim), 0.3 + pe * 0.12, bare) + st * 0.2;
    }
  }
  grime(L, rnd, 0.15 + dirt * 0.6, 0.5);
  return 2.2;
}

function genMetalRusty(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const dark = hexRgb('#6c3a23');
  const mid = hexRgb('#9b532d');
  const light = hexRgb('#c27c46');
  const brown = hexRgb('#4e3729');
  const paint = hexRgb(o.color || '#6c7f82');
  const n1 = fbm(W, H, rnd, Math.round(tw * 3), Math.round(th * 3), 6, 0.6);
  const n2 = fbm(W, H, rnd, Math.round(tw * 12), Math.round(th * 12), 4, 0.55);
  const n3 = fbm(W, H, rnd, Math.round(tw * 4), Math.round(th * 4), 5, 0.6);
  const streak = fbm(W, H, rnd, Math.round(tw * 16), 2, 4, 0.5);
  const grain = white(N, rnd);
  for (let i = 0; i < N; i++) {
    const a = smooth(0.3, 0.72, n1[i]);
    const f = smooth(0.58, 0.78, n2[i]) * 0.75;
    const s = smooth(0.55, 0.85, streak[i]) * 0.5;
    const gr = grain[i];
    const pit = gr > 0.975 ? 1 : 0;
    const pr = smooth(0.74, 0.76, n3[i] + (n2[i] - 0.5) * 0.3);
    const k = (1 + (gr - 0.5) * 0.12) * (1 - pit * 0.35);
    let cr = lerp(lerp(lerp(dark[0], mid[0], a), light[0], f), brown[0], s) * k;
    let cg = lerp(lerp(lerp(dark[1], mid[1], a), light[1], f), brown[1], s) * k;
    let cb = lerp(lerp(lerp(dark[2], mid[2], a), light[2], f), brown[2], s) * k;
    const ps = 0.85 + n2[i] * 0.25;
    cr = lerp(cr, paint[0] * ps, pr);
    cg = lerp(cg, paint[1] * ps, pr);
    cb = lerp(cb, paint[2] * ps, pr);
    r[i] = cr;
    g[i] = cg;
    b[i] = cb;
    const flake = Math.floor(n2[i] * 5) / 5;
    h[i] = 0.42 + flake * 0.1 + n2[i] * 0.06 + (gr - 0.5) * 0.05 - pit * 0.14 + pr * 0.1;
    ro[i] = lerp(0.86 + (gr - 0.5) * 0.12 - f * 0.05, 0.6, pr);
  }
  grime(L, rnd, 0.1 + (o.dirt || 0) * 0.6, 0.4);
  return 2.4;
}

function genCorrugated(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const ppm = W / tw;
  const ridges = Math.max(2, Math.round(tw / 0.076));
  const painted = !!o.color;
  const col = hexRgb(o.color || '#a3a8a8');
  const zinc = hexRgb('#9ea2a3');
  const rust = hexRgb('#8b5232');
  const mott = fbm(W, H, rnd, Math.round(tw * 4), Math.round(th * 4), 5, 0.55);
  const streak = fbm(W, H, rnd, ridges * 2, 2, 4, 0.55);
  const wear = fbm(W, H, rnd, Math.round(tw * 10), Math.round(th * 10), 4, 0.55);
  const fine = white(N, rnd);
  const screwY = 0.1 * H;
  const screwR = Math.max(1.5, 0.007 * ppm);
  const period = W / ridges;
  const dirt = o.dirt || 0;
  for (let y = 0, i = 0; y < H; y++) {
    const yc = y + 0.5;
    const below = yc - screwY;
    for (let x = 0; x < W; x++, i++) {
      const xc = x + 0.5;
      const ph = (xc / period) % 1;
      const prof = 0.5 + 0.5 * Math.cos(ph * TAU);
      const crest = smooth(0.7, 1, prof);
      const valley = 1 - smooth(0, 0.35, prof);
      // screws sit in every second valley
      const sx = (Math.floor(xc / (period * 2)) + 0.75) * period * 2;
      const dsc = Math.hypot(xc - sx, yc - screwY);
      const screw = 1 - smooth(screwR - 0.6, screwR + 0.6, dsc);
      const run = below > 0 && Math.abs(xc - sx) < screwR * 1.6 ? (1 - smooth(0, 0.3 * ppm, below)) * 0.6 : 0;
      const m = mott[i] - 0.5;
      const st = smooth(0.6, 0.85, streak[i]) * (0.35 + valley * 0.45) * (0.6 + dirt * 0.6);
      const rs = Math.max(st, run, screw * 0.4);
      let cr;
      let cg;
      let cb;
      let rough;
      if (painted) {
        const bare = smooth(0.8, 0.84, wear[i] + crest * 0.1);
        const s = 1 + m * 0.1 + (fine[i] - 0.5) * 0.03;
        cr = lerp(col[0] * s, zinc[0], bare);
        cg = lerp(col[1] * s, zinc[1], bare);
        cb = lerp(col[2] * s, zinc[2], bare);
        rough = lerp(0.5 + m * 0.1, 0.42, bare);
      } else {
        const white2 = smooth(0.68, 0.8, wear[i]) * 0.6;
        const s = 1 + m * 0.18 + (fine[i] - 0.5) * 0.06;
        cr = lerp(col[0] * s, 0.78, white2);
        cg = lerp(col[1] * s, 0.78, white2);
        cb = lerp(col[2] * s, 0.75, white2);
        rough = 0.38 + m * 0.25 + white2 * 0.4;
      }
      const sk = 1 - screw * 0.45;
      r[i] = lerp(cr, rust[0], rs) * sk;
      g[i] = lerp(cg, rust[1], rs) * sk;
      b[i] = lerp(cb, rust[2], rs) * sk;
      h[i] = prof * 0.85 + m * 0.03 + screw * 0.12;
      ro[i] = lerp(rough, 0.85, rs);
    }
  }
  grime(L, rnd, 0.1 + dirt * 0.5, 0.3);
  return 3;
}

function genRoofTar(L, rnd, o, tw, th) {
  const { W, H, N, r, g, b, h, ro } = L;
  const ppm = W / tw;
  const base = hexRgb(o.color || '#57534e');
  const sh = H / Math.max(1, Math.round(th / 1));
  const lapW = 0.06 * ppm;
  const gran = white(N, rnd);
  const tone = fbm(W, H, rnd, 3, 3, 5, 0.6);
  const mid = fbm(W, H, rnd, Math.round(tw * 6), Math.round(th * 6), 3, 0.5);
  const stain = fbm(W, H, rnd, 2, 2, 4, 0.5);
  const patch = new Float32Array(N);
  const bead = new Float32Array(N);
  const nP = 2 + Math.floor(rnd() * 3);
  for (let k = 0; k < nP; k++) {
    const pw = range(rnd, 0.4, 1.2) * ppm;
    const ph = range(rnd, 0.3, 0.9) * ppm;
    const px = Math.floor(rnd() * W);
    const py = Math.floor(rnd() * H);
    const bw = 0.018 * ppm;
    for (let yy = -bw - 1; yy < ph + bw + 1; yy++) {
      for (let xx = -bw - 1; xx < pw + bw + 1; xx++) {
        const d = Math.min(xx + 0.5, pw - xx - 0.5, yy + 0.5, ph - yy - 0.5);
        const i = mod(Math.floor(py + yy), H) * W + mod(Math.floor(px + xx), W);
        if (d > 0) patch[i] = 1;
        const s = 1 - Math.abs(d) / bw;
        if (s > bead[i]) bead[i] = s;
      }
    }
  }
  for (let y = 0, i = 0; y < H; y++) {
    const ly = (y + 0.5) % sh;
    const lap = ly < lapW ? 1 : 0;
    const lapEdge = 1 - smooth(0, 2.5 * (W / 512), Math.abs(ly - lapW));
    for (let x = 0; x < W; x++, i++) {
      const gr = gran[i];
      const sp = gr > 0.9 ? (gr - 0.9) * 3 : gr < 0.08 ? -0.12 : 0;
      const t = tone[i] - 0.5;
      const m = mid[i] - 0.5;
      const sv = stain[i];
      const ring = (1 - smooth(0, 0.025, Math.abs(sv - 0.62))) * 0.12 + smooth(0.62, 0.7, sv) * 0.07;
      const pm = patch[i];
      const bd = Math.max(smooth(0.2, 0.7, bead[i]), lapEdge * 0.8);
      let shade = (1 + t * 0.18 + m * 0.07 + sp + ring) * (1 - pm * 0.06);
      shade = lerp(shade, 0.78, bd);
      r[i] = base[0] * shade;
      g[i] = base[1] * shade;
      b[i] = base[2] * shade * 0.98;
      h[i] = 0.5 + (gr - 0.5) * 0.12 + lap * 0.05 + bd * 0.05 + pm * 0.05 + m * 0.03;
      ro[i] = lerp(0.9 + (gr - 0.5) * 0.08 - pm * 0.06 - ring * 0.2, 0.45, bd);
    }
  }
  grime(L, rnd, 0.1 + (o.dirt || 0) * 0.5, 0.3);
  return 2;
}

// ---------- public API ----------

const KINDS = {
  brick: [genBrick, 1.2, 1.2],
  plaster: [genPlaster, 2, 2],
  stucco: [genStucco, 1.5, 1.5],
  concrete: [genConcrete, 2.4, 2.4],
  asphalt: [genAsphalt, 4, 4],
  pavers: [genPavers, 1.6, 1.6],
  cobble: [genCobble, 1.2, 1.2],
  woodPlanks: [genWoodPlanks, 2.4, 1.2],
  woodCrate: [genWoodCrate, 1.2, 1.2],
  metalPainted: [genMetalPainted, 1.5, 1.5],
  metalRusty: [genMetalRusty, 1.5, 1.5],
  corrugated: [genCorrugated, 1.2, 1.2],
  roofTar: [genRoofTar, 4, 4],
  tiles: [genTiles, 1.2, 1.2],
};

const seedOf = (seed, salt) => (hashStr(salt) ^ Math.imul((seed ?? 1) | 0, 0x9e3779b1)) >>> 0;
const sizeOf = (s) => Math.max(64, Math.min(2048, Math.round(s || 512)));

/**
 * Seamless tiling PBR set, cached by kind + options.
 * Returns { map, normalMap, roughnessMap, tile: [widthMetres, heightMetres] }.
 * Textures are shared: clone() before changing repeat/offset. Use material.roughness = 1.
 */
export function texSet(kind, opts = {}) {
  const key = kind + JSON.stringify(opts);
  let set = cache.get(key);
  if (set) return set;
  const def = KINDS[kind];
  if (!def) throw new Error(`texSet: unknown kind '${kind}'`);
  const [gen, tw, th] = def;
  const size = sizeOf(opts.size);
  const scale = opts.scale > 0 ? opts.scale : 1;
  const L = makeLayers(size, size);
  const strength = gen(L, mulberry32(seedOf(opts.seed, kind)), opts, tw, th);
  set = finish(L, strength, [tw * scale, th * scale]);
  cache.set(key, set);
  return set;
}

// ---------- facade painting ----------

// Bevelled box over the layers; hgt is the face height, bevel (px) the edge ramp.
function box(L, x0, y0, x1, y1, col, rough, hgt, bevel, noise, nAmt = 0.06) {
  const { W, H, r, g, b, h, ro } = L;
  const xa = Math.max(0, Math.floor(x0));
  const xb = Math.min(W, Math.ceil(x1));
  const ya = Math.max(0, Math.floor(y0));
  const yb = Math.min(H, Math.ceil(y1));
  for (let y = ya; y < yb; y++) {
    const yc = y + 0.5;
    const dy = Math.min(yc - y0, y1 - yc);
    for (let x = xa; x < xb; x++) {
      const xc = x + 0.5;
      const d = Math.min(xc - x0, x1 - xc, dy);
      const a = clamp01(d + 0.5);
      if (a <= 0) continue;
      const i = y * W + x;
      const k = 1 + (noise ? (noise[i] - 0.5) * nAmt : 0);
      r[i] = lerp(r[i], col[0] * k, a);
      g[i] = lerp(g[i], col[1] * k, a);
      b[i] = lerp(b[i], col[2] * k, a);
      h[i] = lerp(h[i], hgt, a * smooth(0, bevel, d));
      ro[i] = lerp(ro[i], rough, a);
    }
  }
}

// Glass pane: dark blue-grey with a sky-reflection gradient and two diagonal glints
// (or a warm interior glow when lit). win = whole window rect so panes share the gradient.
function glass(L, x0, y0, x1, y1, win, lit, gl, hgt, E) {
  const { W, H, r, g, b, h, ro } = L;
  const [wx0, wy0, wx1, wy1] = win;
  const ww = wx1 - wx0;
  const wh = wy1 - wy0;
  const top = lit ? [0.96, 0.8, 0.52] : [0.5, 0.6, 0.7];
  const bot = lit ? [0.8, 0.5, 0.27] : [0.25, 0.3, 0.35];
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) {
    const yc = y + 0.5;
    const dy = Math.min(yc - y0, y1 - yc);
    const v = clamp01((yc - wy0) / wh);
    const t = Math.pow(v, 0.7);
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) {
      const xc = x + 0.5;
      const a = clamp01(Math.min(xc - x0, x1 - xc, dy) + 0.5);
      if (a <= 0) continue;
      const i = y * W + x;
      const u = (xc - wx0) / ww;
      let cr = lerp(top[0], bot[0], t);
      let cg = lerp(top[1], bot[1], t);
      let cb = lerp(top[2], bot[2], t);
      if (lit) {
        const k = 1 - 0.45 * Math.min(1, Math.hypot(u - 0.5, (v - 0.35) * 0.8) * 1.5);
        cr *= k;
        cg *= k;
        cb *= k;
        E.r[i] = cr * a;
        E.g[i] = cg * a;
        E.b[i] = cb * a;
      } else {
        const dg = (xc - wx0 + (yc - wy0)) / (ww + wh);
        const s = (1 - smooth(0, gl[1], Math.abs(dg - gl[0]))) * 0.5 + (1 - smooth(0, gl[3], Math.abs(dg - gl[2]))) * 0.35;
        cr += s * 0.3;
        cg += s * 0.33;
        cb += s * 0.35;
      }
      r[i] = lerp(r[i], cr, a);
      g[i] = lerp(g[i], cg, a);
      b[i] = lerp(b[i], cb, a);
      h[i] = lerp(h[i], hgt, a);
      ro[i] = lerp(ro[i], lit ? 0.1 : 0.06, a);
    }
  }
}

// Louvred shutter: stiles/rails plus angled slats (lit tops, shadowed gaps).
function shutter(L, x0, y0, x1, y1, col, base, ppm, noise) {
  const { W, H, r, g, b, h, ro } = L;
  const st = Math.max(2, 0.045 * ppm);
  box(L, x0, y0, x1, y1, col, 0.55, base + 0.16, 1.5, noise, 0.1);
  const pitch = Math.max(4, 0.05 * ppm);
  const midY = (y0 + y1) / 2;
  for (const [ya, yb] of [[y0 + st, midY - st * 0.5], [midY + st * 0.5, y1 - st]]) {
    const xa = x0 + st;
    const xb = x1 - st;
    for (let y = Math.max(0, Math.floor(ya)); y < Math.min(H, Math.ceil(yb)); y++) {
      const yc = y + 0.5;
      const t = ((yc - ya) / pitch) % 1;
      const gap = smooth(0.8, 0.97, t);
      const k = (0.84 + 0.26 * t) * (1 - gap * 0.55);
      const dy = Math.min(yc - ya, yb - yc);
      for (let x = Math.max(0, Math.floor(xa)); x < Math.min(W, Math.ceil(xb)); x++) {
        const a = clamp01(Math.min(x + 0.5 - xa, xb - x - 0.5, dy) + 0.5);
        if (a <= 0) continue;
        const i = y * W + x;
        const n = 1 + (noise[i] - 0.5) * 0.1;
        r[i] = lerp(r[i], col[0] * k * n, a);
        g[i] = lerp(g[i], col[1] * k * n, a);
        b[i] = lerp(b[i], col[2] * k * n, a);
        h[i] = lerp(h[i], base + 0.03 + 0.13 * t * (1 - gap), a);
        ro[i] = lerp(ro[i], 0.55, a);
      }
    }
  }
}

const WALL_DEFAULT = { brick: '#a9573a', plaster: '#e8d5b0', stucco: '#e0c39a' };
const WALL_GEN = { brick: genBrick, plaster: genPlaster, stucco: genStucco };
const DOOR_COLORS = ['#3d5e4b', '#6b2f2b', '#2f4a62', '#7a5233', '#466b6c'];
const SIGN_COLORS = ['#2f5d50', '#7a2f2f', '#2c4a6b', '#a8782a', '#5a3d5c'];

/**
 * One facade bay: a storey (3 m) x one window bay (2.4 m), tiling both ways. tile = [2.4, 3].
 * When lit, the set also carries an emissiveMap (warm glow behind the glass).
 */
export function facadeBay(opts = {}) {
  const key = 'facade' + JSON.stringify(opts);
  let set = cache.get(key);
  if (set) return set;
  const o = {
    wall: 'plaster', wallColor: null, frameColor: '#f3efe6', windowType: 'tall',
    shutters: null, lit: false, dirt: 0.3, seed: 1, ...opts,
  };
  const wallKind = WALL_GEN[o.wall] ? o.wall : 'plaster';
  const wallHex = o.wallColor || WALL_DEFAULT[wallKind];
  const W = sizeOf(o.size);
  const H = Math.round(W * 1.25);
  // the wall itself is shared by every bay variant with the same wall/colour/seed/dirt
  const wkey = `wall|${wallKind}|${wallHex}|${o.seed}|${o.dirt}|${W}`;
  let wall = cache.get(wkey);
  if (!wall) {
    wall = makeLayers(W, H);
    const gen = WALL_GEN[wallKind];
    wall.strength = gen(wall, mulberry32(seedOf(o.seed, wkey)), { color: wallHex, dirt: o.dirt * 0.5 }, 2.4, 3);
    let s = 0;
    for (let i = 0; i < wall.N; i++) s += wall.h[i];
    wall.mean = s / wall.N;
    cache.set(wkey, wall);
  }
  const L = cloneLayers(wall);
  const rnd = mulberry32(seedOf(o.seed, key));
  const ppm = W / 2.4;
  const X = (m) => m * ppm;
  const Y = (m) => H - m * ppm;
  const m0 = wall.mean;
  const frame = hexRgb(o.frameColor || '#f3efe6');
  const wallRGB = hexRgb(wallHex);
  const stone = mixRgb(frame, [0.8, 0.75, 0.66], 0.3);
  const surround = mulRgb(mixRgb(frame, wallRGB, 0.12), 0.97);
  const reveal = mulRgb(mixRgb(wallRGB, [0.5, 0.48, 0.46], 0.3), 0.6);
  const band = wallKind === 'brick' ? stone : mulRgb(mixRgb(wallRGB, stone, 0.35), 0.95);
  const noise = fbm(W, H, rnd, 8, 10, 4, 0.5);
  const E = o.lit ? { W, H, N: L.N, r: new Float32Array(L.N), g: new Float32Array(L.N), b: new Float32Array(L.N) } : null;
  const g0 = range(rnd, 0.18, 0.36);
  const gl = [g0, range(rnd, 0.03, 0.05), g0 + range(rnd, 0.14, 0.24), range(rnd, 0.015, 0.03)];
  const sills = [];
  const cx = W / 2;
  const sb = X(0.1);
  const ri = X(0.05);
  const bar = X(0.035);

  // floor-line / cornice band
  box(L, -4, Y(0.2), W + 4, Y(0.16), band, 0.8, m0 + 0.08, 1.5, noise);
  box(L, -4, Y(0.16), W + 4, H + 4, mulRgb(band, 0.97), 0.82, m0 + 0.16, 2, noise);

  const windowSet = (x0, y0, x1, y1, leaves, panes) => {
    if (o.shutters) {
      const sc = hexRgb(o.shutters);
      const sw = (x1 - x0) / 2 + X(0.02);
      shutter(L, x0 - sb - X(0.03) - sw, y0, x0 - sb - X(0.03), y1, sc, m0, ppm, noise);
      shutter(L, x1 + sb + X(0.03), y0, x1 + sb + X(0.03) + sw, y1, sc, m0, ppm, noise);
    }
    box(L, x0 - sb, y0 - sb, x1 + sb, y1 + 1, surround, 0.7, m0 + 0.14, 2, noise, 0.05);
    box(L, x0, y0, x1, y1, reveal, 0.9, m0 - 0.3, 1, noise, 0.15);
    box(L, x0 + ri, y0 + ri, x1 - ri, y1, frame, 0.45, m0 - 0.12, 1.2, noise, 0.04);
    const fb = X(0.05);
    const win = [x0 + ri + fb, y0 + ri + fb, x1 - ri - fb, y1 - fb * 1.3];
    const lw = (win[2] - win[0] - bar * (leaves - 1)) / leaves;
    const pw = (win[3] - win[1] - bar * (panes - 1)) / panes;
    for (let c = 0; c < leaves; c++) {
      for (let p = 0; p < panes; p++) {
        const px = win[0] + c * (lw + bar);
        const py = win[1] + p * (pw + bar);
        glass(L, px, py, px + lw, py + pw, win, o.lit, gl, m0 - 0.2, E);
      }
    }
    box(L, x0 - sb - X(0.05), y1, x1 + sb + X(0.05), y1 + X(0.07), stone, 0.75, m0 + 0.3, 1.5, noise);
    box(L, x0 - sb - X(0.04), y0 - sb - X(0.1), x1 + sb + X(0.04), y0 - sb + 1, stone, 0.75, m0 + 0.26, 1.5, noise);
    sills.push([x0 - sb - X(0.05), x1 + sb + X(0.05), y1 + X(0.07)]);
  };

  const type = o.windowType;
  if (type === 'tall') {
    windowSet(cx - X(0.5), Y(2.45), cx + X(0.5), Y(0.6), 2, 3);
  } else if (type === 'square') {
    windowSet(cx - X(0.5), Y(2.15), cx + X(0.5), Y(1.0), 2, 2);
  } else if (type === 'shop') {
    const sc = hexRgb(SIGN_COLORS[Math.floor(rnd() * SIGN_COLORS.length)]);
    const sf = mulRgb(sc, 0.75);
    box(L, X(0.04), Y(2.9), X(2.36), Y(2.42), mulRgb(sc, 0.9), 0.5, m0 + 0.2, 2, noise);
    box(L, X(0.12), Y(2.83), X(2.28), Y(2.49), sc, 0.45, m0 + 0.25, 1.5, noise, 0.05);
    box(L, X(0.04), Y(2.42), X(0.2), Y(0.16), stone, 0.75, m0 + 0.16, 2, noise);
    box(L, X(2.2), Y(2.42), X(2.36), Y(0.16), stone, 0.75, m0 + 0.16, 2, noise);
    box(L, X(0.2), Y(2.42), X(2.2), Y(0.16), sf, 0.5, m0 - 0.08, 1.5, noise);
    box(L, X(0.27), Y(0.46), X(2.13), Y(0.22), mulRgb(sc, 0.85), 0.55, m0 - 0.03, 2, noise);
    const win = [X(0.27), Y(2.35), X(2.13), Y(0.52)];
    const mb = X(0.025);
    glass(L, win[0], win[1], cx - mb, Y(2.06), win, o.lit, gl, m0 - 0.2, E);
    glass(L, cx + mb, win[1], win[2], Y(2.06), win, o.lit, gl, m0 - 0.2, E);
    glass(L, win[0], Y(2.0), cx - mb, win[3], win, o.lit, gl, m0 - 0.2, E);
    glass(L, cx + mb, Y(2.0), win[2], win[3], win, o.lit, gl, m0 - 0.2, E);
  } else if (type === 'door') {
    const dc = hexRgb(o.shutters || DOOR_COLORS[Math.floor(rnd() * DOOR_COLORS.length)]);
    const x0 = cx - X(0.55);
    const x1 = cx + X(0.55);
    const y0 = Y(2.4);
    box(L, x0 - sb, y0 - sb, x1 + sb, H + 4, surround, 0.7, m0 + 0.14, 2, noise, 0.05);
    box(L, x0, y0, x1, H + 4, reveal, 0.9, m0 - 0.3, 1, noise, 0.15);
    box(L, x0 + ri, y0 + ri, x1 - ri, Y(2.05), frame, 0.45, m0 - 0.12, 1.2, noise, 0.04);
    const tw = [x0 + ri + X(0.04), y0 + ri + X(0.04), x1 - ri - X(0.04), Y(2.05) - X(0.04)];
    glass(L, tw[0], tw[1], tw[2], tw[3], tw, o.lit, gl, m0 - 0.2, E);
    const lx0 = x0 + ri;
    const lx1 = x1 - ri;
    box(L, lx0, Y(2.05), lx1, H + 4, dc, 0.5, m0 - 0.1, 1.2, noise, 0.08);
    const mg = X(0.1);
    const pw = (lx1 - lx0 - mg * 3) / 2;
    const ph = (Y(0) - Y(2.05) - mg * 4) / 3;
    for (let c = 0; c < 2; c++) {
      for (let p = 0; p < 3; p++) {
        const px = lx0 + mg + c * (pw + mg);
        const py = Y(2.05) + mg + p * (ph + mg);
        box(L, px, py, px + pw, py + ph, mulRgb(dc, 0.88), 0.5, m0 - 0.16, 1.2, noise, 0.08);
        box(L, px + X(0.035), py + X(0.035), px + pw - X(0.035), py + ph - X(0.035), dc, 0.5, m0 - 0.11, 3, noise, 0.08);
      }
    }
    box(L, lx1 - X(0.13), Y(1.06), lx1 - X(0.07), Y(0.98), [0.72, 0.58, 0.3], 0.3, m0 + 0.05, 1, null);
    box(L, x0 - X(0.06), Y(0.06), x1 + X(0.06), H + 4, mulRgb(stone, 0.92), 0.8, m0 + 0.08, 1.5, noise);
  }

  // rain/dirt streaks running down from sills
  if (o.dirt > 0 && sills.length) {
    const sn = fbm(W, H, rnd, 48, 2, 3, 0.5);
    for (const [sx0, sx1, sy] of sills) {
      const len = X(0.9);
      for (let y = Math.ceil(sy); y < Math.min(H, sy + len); y++) {
        const f = 1 - (y - sy) / len;
        for (let x = Math.max(0, Math.floor(sx0)); x < Math.min(W, Math.ceil(sx1)); x++) {
          const i = y * W + x;
          const k = Math.min(1, o.dirt) * 0.24 * f * smooth(0.4, 0.75, sn[i]);
          L.r[i] *= 1 - k;
          L.g[i] *= 1 - k * 1.05;
          L.b[i] *= 1 - k * 1.1;
        }
      }
    }
  }

  const extra = E ? { emissiveMap: makeTex(rgbCanvas(E, 0), true) } : {};
  set = finish(L, wall.strength, [2.4, 3], extra);
  cache.set(key, set);
  return set;
}
