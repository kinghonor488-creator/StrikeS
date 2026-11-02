// StrikeS audio v2: every sound is synthesized with the Web Audio API (no files).
// Direction: CS2-like realism (weighty, crisp, directional) with a light comic charm
// kept for UI and the ink abilities.
//
// Frequent sounds (shots, impacts, footsteps, casings, whizzes...) are baked once into
// AudioBuffers by the small JS DSP kit below and replayed through cheap voices; rare or
// continuous sounds (stingers, beeps, marker loop, tinnitus) use live oscillator graphs.
//
// Mix:  gun + world voices -> mix -> muffle LP (tinnitus) -> master <- ui bus, ear ring
//       master -> bus compressor -> limiter -> volume -> speakers
//       world voices also feed a short "street" convolver and a long rolling-echo convolver.

const MAX_VOICES = 40;
const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const vary = (amt) => 1 + (Math.random() * 2 - 1) * amt;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isPos = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const nowMs = () => (globalThis.performance?.now ? globalThis.performance.now() : Date.now());

// ---------------------------------------------------------------------------
// Offline DSP kit: renders layers into Float32Arrays that become AudioBuffers.

function noiseArr(n, color) {
  const a = new Float32Array(n);
  if (color === 'p') {
    // Paul Kellet's economy pink filter.
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      a[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    }
  } else if (color === 'b') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      a[i] = last * 3.5;
    }
  } else {
    for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
  }
  return a;
}

// Cutoff breakpoints [[fraction 0..1, hz], ...], interpolated exponentially.
function freqAt(pts, x) {
  if (typeof pts === 'number') return pts;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, f1] = pts[i];
    if (x <= x1) {
      const [x0, f0] = pts[i - 1];
      return f0 * Math.pow(f1 / f0, (x - x0) / Math.max(1e-9, x1 - x0));
    }
  }
  return pts[pts.length - 1][1];
}

// In-place RBJ biquad: lp | hp | bp (0 dB peak) | pk (peaking, db). A breakpoint list
// for `freq` sweeps the cutoff (coefficients recomputed every 32 samples).
function biquad(a, sr, type, freq, q = 0.707, db = 0) {
  const ny = sr * 0.49, A = Math.pow(10, (db || 0) / 40);
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  const coef = (f) => {
    const w = (TAU * clamp(f, 10, ny)) / sr;
    const cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let c0, c1, c2, d0, d1, d2;
    if (type === 'hp') { c0 = (1 + cs) / 2; c1 = -(1 + cs); c2 = c0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    else if (type === 'bp') { c0 = al; c1 = 0; c2 = -al; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    else if (type === 'pk') { c0 = 1 + al * A; c1 = -2 * cs; c2 = 1 - al * A; d0 = 1 + al / A; d1 = -2 * cs; d2 = 1 - al / A; }
    else { c0 = (1 - cs) / 2; c1 = 1 - cs; c2 = c0; d0 = 1 + al; d1 = -2 * cs; d2 = 1 - al; }
    b0 = c0 / d0; b1 = c1 / d0; b2 = c2 / d0; a1 = d1 / d0; a2 = d2 / d0;
  };
  const sweep = typeof freq !== 'number';
  const n = a.length;
  coef(sweep ? freqAt(freq, 0) : freq);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) {
    if (sweep && (i & 31) === 0) coef(freqAt(freq, i / n));
    const x = a[i];
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    a[i] = y;
  }
  return a;
}

function peakOf(a) {
  let p = 0;
  for (let i = 0; i < a.length; i++) {
    const v = a[i] < 0 ? -a[i] : a[i];
    if (v > p) p = v;
  }
  return p;
}

// Random amplitude flutter in 1.5-4 ms blocks: scrape, gravel and paper texture.
function grainify(a, sr, depth) {
  const sm = Math.exp(-1 / (0.0007 * sr));
  let cur = 1, tgt = 1, next = 0;
  for (let i = 0; i < a.length; i++) {
    if (i >= next) {
      tgt = 1 - depth * Math.random();
      next = i + Math.round(rand(0.0015, 0.004) * sr);
    }
    cur = tgt + (cur - tgt) * sm;
    a[i] *= cur;
  }
}

class Bake {
  constructor(sr, seconds, channels = 1) {
    this.sr = sr;
    this.len = Math.max(16, Math.ceil(seconds * sr));
    this.ch = Array.from({ length: channels }, () => new Float32Array(this.len));
    this.d = this.ch[0];
  }

  _span(o) {
    const len = o.len ?? ((o.a ?? 0.001) + (o.h || 0) + (o.d ?? 0.05) * 6.9);
    const i0 = Math.floor(Math.max(0, o.at || 0) * this.sr);
    return [i0, Math.min(Math.ceil(len * this.sr), this.len - i0)];
  }

  // Linear attack `a`, hold `h`, exponential decay (time constant `d`), 3 ms end fade.
  _mix(src, i0, o) {
    const sr = this.sr, out = this.ch[o.ch || 0], n = src.length;
    const na = Math.max(1, Math.round((o.a ?? 0.001) * sr));
    const nh = Math.round((o.h || 0) * sr);
    const k = Math.exp(-1 / Math.max(1, (o.d ?? 0.05) * sr));
    const nf = Math.min(n, Math.round(0.003 * sr));
    const g = o.g ?? 1;
    let e = 1;
    for (let i = 0; i < n; i++) {
      let env;
      if (i < na) env = i / na;
      else if (i < na + nh) env = 1;
      else { env = e; e *= k; }
      if (i > n - nf) env *= (n - i) / nf;
      out[i0 + i] += src[i] * env * g;
    }
  }

  // Filtered noise, peak-normalised before the envelope so `g` is roughly its peak.
  // o: { at, a, h, d, len, g, c: 'w'|'p'|'b', f: [[type, hz|pts, q, db]], grain, ch }
  noise(o) {
    const [i0, n] = this._span(o);
    if (n <= 8) return this;
    const s = noiseArr(n, o.c);
    if (o.f) for (const [type, f, q, db] of o.f) biquad(s, this.sr, type, f, q, db);
    if (o.grain) grainify(s, this.sr, o.grain);
    const p = peakOf(s);
    if (p > 0) for (let i = 0; i < n; i++) s[i] /= p;
    if (o.drive) {
      // Saturating the texture lowers its crest factor: a denser, louder bang at the same peak.
      const k = o.drive, dn = Math.tanh(k);
      for (let i = 0; i < n; i++) s[i] = Math.tanh(s[i] * k) / dn;
    }
    this._mix(s, i0, o);
    return this;
  }

  // Oscillator with exponential pitch glide f0 -> f1 (time constant gl), optional tanh drive.
  tone(o) {
    const [i0, n] = this._span(o);
    if (n <= 8) return this;
    const sr = this.sr, s = new Float32Array(n);
    const f1 = o.f1 ?? o.f0;
    const kg = Math.exp(-1 / Math.max(1, (o.gl || 0.01) * sr));
    const drive = o.drive || 0, dn = drive ? Math.tanh(drive) : 1;
    let ph = 0, df = o.f0 - f1;
    for (let i = 0; i < n; i++) {
      let x;
      if (o.w === 'tri') x = 1 - 4 * Math.abs(ph - 0.5);
      else if (o.w === 'saw') x = 2 * ph - 1;
      else if (o.w === 'sq') x = ph < 0.5 ? 1 : -1;
      else x = Math.sin(TAU * ph);
      s[i] = drive ? Math.tanh(x * drive) / dn : x;
      ph += (f1 + df) / sr;
      ph -= Math.floor(ph);
      df *= kg;
    }
    this._mix(s, i0, o);
    return this;
  }

  // Decaying partials (metal, brass, glass, wood). o: { at, m: [[hz, tau, amp]], g, a, ch }
  modes(o) {
    const sr = this.sr, out = this.ch[o.ch || 0];
    const i0 = Math.floor(Math.max(0, o.at || 0) * sr);
    const na = Math.max(1, Math.round((o.a ?? 0.0002) * sr));
    const g = o.g ?? 1;
    for (const [hz, tau, amp] of o.m) {
      if (!(hz > 20 && hz < sr * 0.45)) continue;
      const n = Math.min(Math.ceil(tau * 6.9 * sr), this.len - i0);
      const w = (TAU * hz) / sr, cs = Math.cos(w), sn = Math.sin(w);
      const r = Math.exp(-1 / Math.max(1, tau * sr));
      const a = amp * g;
      let re = 1, im = 0;
      for (let i = 0; i < n; i++) {
        out[i0 + i] += im * a * (i < na ? i / na : 1);
        const nr = (re * cs - im * sn) * r;
        im = (re * sn + im * cs) * r;
        re = nr;
      }
    }
    return this;
  }

  // Blast pressure wave (Friedlander): sharp rise, decay through a negative phase.
  pulse(o) {
    const sr = this.sr, out = this.ch[o.ch || 0], T = o.T, b = o.b ?? 1.8, g = o.g ?? 1;
    const i0 = Math.floor((o.at || 0) * sr);
    const n = Math.min(Math.ceil(T * 6 * sr), this.len - i0);
    for (let i = 0; i < n; i++) {
      const x = i / sr / T;
      out[i0 + i] += g * (1 - x) * Math.exp(-b * x) * Math.min(1, i / 2);
    }
    return this;
  }

  // Supersonic N-wave: +g ramps to -g over `dur`.
  nwave(o) {
    const sr = this.sr, out = this.ch[o.ch || 0];
    const i0 = Math.floor((o.at || 0) * sr), n = Math.max(3, Math.round(o.dur * sr));
    for (let i = 0; i < n && i0 + i < this.len; i++) out[i0 + i] += (o.g ?? 1) * (1 - (2 * i) / (n - 1));
    return this;
  }

  // Amplitude wobble (tumbling ricochet), from time `at` on.
  am(rate, depth, at = 0) {
    const sr = this.sr, i0 = Math.floor(at * sr);
    for (const c of this.ch) {
      for (let i = i0; i < this.len; i++) c[i] *= 1 - depth * (0.5 + 0.5 * Math.sin((TAU * rate * (i - i0)) / sr));
    }
    return this;
  }

  filter(type, f, q = 0.707, db = 0) {
    for (const c of this.ch) biquad(c, this.sr, type, f, q, db);
    return this;
  }

  peak() {
    let p = 0;
    for (const c of this.ch) p = Math.max(p, peakOf(c));
    return p;
  }

  scale(k) {
    for (const c of this.ch) for (let i = 0; i < c.length; i++) c[i] *= k;
    return this;
  }

  norm(target) {
    const p = this.peak();
    return p > 0 ? this.scale(target / p) : this;
  }

  // Only ever turn down: keeps the designed relative loudness of parts.
  cap(target) {
    const p = this.peak();
    return p > target ? this.scale(target / p) : this;
  }

  // Normalise then tanh soft-clip: denser, punchier body.
  sat(k) {
    if (!k) return this;
    this.norm(1);
    const dn = Math.tanh(k);
    for (const c of this.ch) for (let i = 0; i < c.length; i++) c[i] = Math.tanh(c[i] * k) / dn;
    return this;
  }
}

// Mechanical micro-sounds shared by actions, reload parts, casings and gadgets.
const METAL = [[1, 1, 1], [1.47, 0.72, 0.6], [2.09, 0.52, 0.45], [2.76, 0.4, 0.3], [3.62, 0.3, 0.2]];
const click = (b, at, f, tau, g, q = 1.3) =>
  b.noise({ at, a: 0.0001, d: tau, g, f: [['bp', f, q], ['hp', f * 0.4, 0.7]] });
const ring = (b, at, f, tau, g, set = METAL) =>
  b.modes({ at, g: g * 0.6, m: set.map(([r, t, a]) => [f * r * vary(0.015), tau * t * 0.65, a]) });
const thud = (b, at, f, tau, g) => b.tone({ at, f0: f * 1.7, f1: f, gl: 0.005, a: 0.0006, d: tau, g, drive: 1.6 });
const scrape = (b, at, f0, f1, len, g) =>
  b.noise({ at, a: len * 0.4, d: len * 0.22, len: len * 1.3, g, grain: 0.55, f: [['bp', [[0, f0], [1, f1]], 2.2]] });
function grit(b, at, len, count, g, lo = 1500, hi = 5200) {
  for (let i = 0; i < count; i++) {
    const u = Math.pow(Math.random(), 1.5);
    b.noise({ at: at + u * len, a: 0.0001, d: rand(0.0004, 0.0013), g: g * rand(0.25, 1) * (1 - u * 0.6), f: [['bp', rand(lo, hi), 1.4]] });
  }
}

// ---------------------------------------------------------------------------
// Reverb impulses.

// Short street reflection: discrete early slaps off nearby walls + a darkening diffuse tail.
function streetIR(ctx) {
  const sr = ctx.sampleRate, T = 1.3, len = Math.floor(sr * T);
  const buf = ctx.createBuffer(2, len, sr);
  const taps = [[0.0055, 0.75], [0.0092, 0.55], [0.0137, 0.5], [0.0171, 0.42], [0.0234, 0.36], [0.0312, 0.3], [0.0418, 0.24], [0.0563, 0.18], [0.0745, 0.13]];
  const shape = [0.5, 1, 0.7, 0.4, 0.2, 0.08];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    for (let i = Math.floor(0.008 * sr); i < len; i++) {
      const t = i / sr;
      y += (Math.random() * 2 - 1 - y) * (0.75 - 0.6 * (t / T));
      d[i] = y * 0.42 * Math.exp((-6.9 * t) / 0.85) * Math.min(1, (t - 0.008) / 0.012);
    }
    for (const [t0, g] of taps) {
      const i0 = Math.floor((t0 + (c ? 0.0013 * rand(0.5, 1.5) : 0)) * sr);
      const sign = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < shape.length && i0 + k < len; k++) d[i0 + k] += sign * g * shape[k] * rand(0.7, 1);
    }
  }
  return buf;
}

// Long outdoor tail: sparse echoes off distant facades (darker each time) over a rolling bed.
function echoIR(ctx) {
  const sr = ctx.sampleRate, T = 3.2, len = Math.floor(sr * T);
  const buf = ctx.createBuffer(2, len, sr);
  const echoes = [[0.095, 0.6], [0.16, 0.45], [0.245, 0.4], [0.36, 0.3], [0.5, 0.24], [0.69, 0.17], [0.93, 0.12], [1.25, 0.08], [1.65, 0.05]];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0, z = 0;
    for (let i = Math.floor(0.07 * sr); i < len; i++) {
      const t = i / sr;
      y += (Math.random() * 2 - 1 - y) * (0.22 - 0.17 * (t / T));
      z += (y - z) * 0.3;
      d[i] = z * 0.5 * Math.exp((-6.9 * t) / 2.6) * Math.min(1, (t - 0.07) / 0.25);
    }
    echoes.forEach(([t0, g], k) => {
      const start = Math.floor(t0 * (c ? rand(1.08, 1.18) : rand(0.95, 1.02)) * sr);
      const n = Math.floor((0.012 + k * 0.006) * sr);
      const lp = 0.55 / (1 + k * 0.45);
      let s = 0;
      for (let i = 0; i < n && start + i < len; i++) {
        s += (Math.random() * 2 - 1 - s) * lp;
        d[start + i] += s * g * 2.2 * Math.exp((-4 * i) / n);
      }
    });
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Gunshots. Each kind bakes 3 variants of three stems: `main` (transient crack, blast,
// low-mid chunk, short rumble), `low` (driven thump + air push, scaled by `body` at
// playback) and `mech` (the action cycling, heard only by the shooter).
// pitch is applied as playbackRate, so lower = bigger and slightly longer.
//
// pulse [T s, g] blast wave · nw [dur s, g] supersonic N-wave · crack [hp Hz, tau, g]
// snap [Hz, tau, g] presence of the report · sizzle [hp Hz, tau, g] · blast [lp start, lp end,
// character Hz, tau, g] the main bang · chunk [Hz, tau, g] low-mid body · rumble [lp Hz, tau, g]
// thump [f0, f1, glide, tau, g, drive] · air [lp Hz, tau, g] · sat: main-stem saturation
// len [main s, low s] · lvl: playback level · verb/echo: reverb sends (distance adds more)
// z: size of the mechanical parts (1 = rifle) · pellets: extra micro-cracks (shotguns)
const GUNS = {
  pistol: {
    lvl: 0.86, len: [0.45, 0.2], sat: 1.4, verb: 0.2, echo: 0.05, mech: 'pistol', z: 1.25,
    pulse: [0.0012, 0.3], crack: [1900, 0.0035, 0.8], snap: [2600, 0.008, 0.55], blast: [8000, 1000, 1300, 0.03, 0.95],
    chunk: [360, 0.025, 0.3], rumble: [700, 0.11, 0.16], thump: [210, 78, 0.008, 0.022, 0.35, 2], air: [200, 0.03, 0.12],
  },
  pistol_heavy: {
    lvl: 0.92, len: [0.85, 0.4], sat: 1.8, verb: 0.24, echo: 0.14, mech: 'pistol_heavy', z: 1.12,
    pulse: [0.0022, 0.45], crack: [1500, 0.006, 0.85], snap: [2200, 0.012, 0.6], blast: [6800, 650, 800, 0.06, 1],
    chunk: [240, 0.05, 0.45], rumble: [600, 0.25, 0.24], thump: [150, 55, 0.014, 0.05, 0.55, 2.6], air: [170, 0.06, 0.2],
  },
  smg: {
    lvl: 0.86, len: [0.4, 0.15], sat: 1.3, verb: 0.15, echo: 0.04, mech: 'smg', z: 1.12,
    pulse: [0.001, 0.25], crack: [2300, 0.003, 0.8], snap: [3000, 0.007, 0.55], blast: [9000, 1200, 1600, 0.03, 0.95],
    chunk: [420, 0.02, 0.25], rumble: [700, 0.09, 0.13], thump: [230, 90, 0.006, 0.016, 0.28, 1.8], air: [220, 0.025, 0.1],
  },
  rifle: {
    lvl: 0.95, len: [0.6, 0.25], sat: 1.5, verb: 0.2, echo: 0.08, mech: 'rifle', z: 1,
    pulse: [0.0014, 0.35], nw: [0.00045, 0.3], crack: [2000, 0.004, 0.85], snap: [2800, 0.009, 0.6],
    blast: [9000, 950, 1100, 0.038, 1], chunk: [300, 0.032, 0.35], rumble: [650, 0.15, 0.2],
    thump: [190, 68, 0.009, 0.028, 0.4, 2.2], air: [190, 0.035, 0.14],
  },
  rifle_heavy: {
    lvl: 0.92, len: [0.7, 0.3], sat: 1.8, verb: 0.22, echo: 0.1, mech: 'rifle_heavy', z: 0.92,
    pulse: [0.0019, 0.42], nw: [0.0006, 0.26], crack: [1700, 0.005, 0.8], snap: [2300, 0.011, 0.55],
    blast: [7500, 750, 700, 0.048, 1], chunk: [230, 0.045, 0.5], rumble: [600, 0.19, 0.24],
    thump: [165, 58, 0.012, 0.038, 0.5, 2.5], air: [170, 0.045, 0.18],
  },
  lmg: {
    lvl: 0.95, len: [0.7, 0.3], sat: 1.7, verb: 0.22, echo: 0.1, mech: 'lmg', z: 0.82,
    pulse: [0.0018, 0.4], nw: [0.0005, 0.26], crack: [1800, 0.0045, 0.8], snap: [2500, 0.01, 0.55],
    blast: [8000, 820, 760, 0.044, 1], chunk: [250, 0.042, 0.45], rumble: [620, 0.18, 0.22],
    thump: [175, 62, 0.011, 0.034, 0.46, 2.4], air: [180, 0.04, 0.16],
  },
  shotgun: {
    lvl: 0.92, len: [0.95, 0.45], sat: 2, verb: 0.26, echo: 0.16, mech: null, z: 0.88, pellets: 6,
    pulse: [0.0026, 0.5], crack: [1300, 0.007, 0.8], snap: [2000, 0.014, 0.5], blast: [6000, 520, 560, 0.075, 1],
    chunk: [190, 0.07, 0.55], rumble: [550, 0.28, 0.28], thump: [140, 48, 0.016, 0.06, 0.6, 2.8], air: [160, 0.07, 0.22],
  },
  shotgun_auto: {
    lvl: 0.88, len: [0.85, 0.4], sat: 1.9, verb: 0.24, echo: 0.14, mech: 'shotgun_auto', z: 0.9, pellets: 6,
    pulse: [0.0024, 0.48], crack: [1400, 0.0065, 0.8], snap: [2100, 0.012, 0.5], blast: [6400, 560, 600, 0.062, 1],
    chunk: [200, 0.06, 0.5], rumble: [560, 0.24, 0.26], thump: [145, 50, 0.015, 0.052, 0.56, 2.6], air: [165, 0.06, 0.2],
  },
  sniper: {
    lvl: 1, len: [1.6, 0.6], sat: 1.9, verb: 0.3, echo: 0.36, mech: null, z: 0.95,
    pulse: [0.0028, 0.5], nw: [0.0008, 0.45], crack: [2300, 0.008, 0.9], snap: [2600, 0.016, 0.6], sizzle: [5200, 0.016, 0.3],
    blast: [8000, 520, 500, 0.11, 1], chunk: [200, 0.09, 0.5], rumble: [520, 0.5, 0.3],
    thump: [130, 44, 0.018, 0.08, 0.62, 2.8], air: [150, 0.09, 0.22],
  },
  sniper_light: {
    lvl: 0.95, len: [1, 0.25], sat: 1.5, verb: 0.24, echo: 0.22, mech: null, z: 1.05,
    pulse: [0.0016, 0.38], nw: [0.0005, 0.4], crack: [2500, 0.005, 0.85], snap: [3000, 0.01, 0.6], sizzle: [5600, 0.009, 0.22],
    blast: [9000, 900, 950, 0.045, 0.95], chunk: [280, 0.035, 0.32], rumble: [620, 0.24, 0.2],
    thump: [185, 64, 0.01, 0.032, 0.42, 2.1], air: [190, 0.04, 0.14],
  },
};
const GUN_ALIAS = {
  heavy: 'pistol_heavy', deagle: 'pistol_heavy', usp: 'pistol_suppressed', mp: 'smg', ak: 'rifle_heavy',
  m4: 'rifle', autoshotgun: 'shotgun_auto', awp: 'sniper', scout: 'sniper_light', knife: 'pistol',
};

// Action cycling heard by the shooter: unlock "chk", then the return-to-battery clack.
const MECH = {
  pistol(b) {
    click(b, 0.004, 3700, 0.0014, 0.5); ring(b, 0.004, 3000, 0.012, 0.16);
    click(b, 0.033, 2700, 0.002, 0.7); ring(b, 0.033, 2350, 0.018, 0.24); thud(b, 0.033, 430, 0.008, 0.22);
  },
  pistol_heavy(b) {
    click(b, 0.005, 3000, 0.0018, 0.5); ring(b, 0.005, 2400, 0.016, 0.2);
    click(b, 0.042, 2100, 0.0026, 0.75); ring(b, 0.042, 1800, 0.024, 0.28); thud(b, 0.042, 330, 0.012, 0.32);
  },
  smg(b) {
    click(b, 0.003, 4300, 0.001, 0.45);
    click(b, 0.022, 3400, 0.0015, 0.6); ring(b, 0.022, 3100, 0.01, 0.15); thud(b, 0.022, 520, 0.006, 0.15);
  },
  rifle(b) {
    click(b, 0.006, 3300, 0.0015, 0.5); ring(b, 0.006, 2700, 0.014, 0.16);
    b.modes({ at: 0.01, g: 0.05, m: [[1150, 0.05, 1], [2380, 0.035, 0.5]] }); // buffer-spring "sproing"
    click(b, 0.046, 2450, 0.002, 0.65); ring(b, 0.046, 2150, 0.02, 0.22); thud(b, 0.046, 360, 0.01, 0.26);
  },
  rifle_heavy(b) {
    click(b, 0.007, 2700, 0.002, 0.55); ring(b, 0.007, 2200, 0.016, 0.18);
    click(b, 0.054, 1900, 0.003, 0.75); ring(b, 0.054, 1650, 0.026, 0.26); thud(b, 0.054, 290, 0.014, 0.36);
  },
  lmg(b) {
    MECH.rifle_heavy(b);
    for (let i = 0; i < 4; i++) click(b, 0.018 + i * 0.016 + rand(0, 0.004), rand(3800, 5600), 0.0008, rand(0.15, 0.3), 2);
  },
  shotgun_auto(b) {
    click(b, 0.008, 2300, 0.002, 0.5);
    click(b, 0.05, 1800, 0.003, 0.75); ring(b, 0.05, 1500, 0.026, 0.25); thud(b, 0.05, 260, 0.014, 0.38);
  },
};

function bakeShot(sr, g, sup) {
  const j = vary(0.05); // per-variant character
  const m = new Bake(sr, sup ? 0.24 : g.len[0]);
  const lo = new Bake(sr, sup ? 0.12 : g.len[1]);
  if (sup) {
    // Suppressed "thwip": short band-limited puff + baffle hiss + soft low pop.
    const z = Math.min(1.15, g.z);
    m.noise({ c: 'p', a: 0.0006, d: 0.012 * j, g: 0.9, drive: 1.8, f: [['bp', [[0, 2600 * z * j], [1, 950 * z]], 0.8]] });
    m.noise({ a: 0.0003, d: 0.005, g: 0.32, f: [['hp', 5400 * j, 0.7]] });
    m.noise({ c: 'p', a: 0.0015, d: 0.026 * j, g: 0.42, f: [['lp', 720 * z, 0.8]] });
    m.noise({ c: 'p', a: 0.004, d: 0.05, g: 0.12, f: [['lp', 520, 0.7], ['hp', 100, 0.7]] });
    m.sat(1.3);
    lo.tone({ f0: 230 * z, f1: 95 * z, gl: 0.007, a: 0.0008, d: 0.016, g: 0.38, drive: 1.5 });
  } else {
    if (g.pulse) m.pulse({ T: g.pulse[0] * j, g: g.pulse[1] });
    if (g.nw) m.nwave({ dur: g.nw[0], g: g.nw[1] });
    m.noise({ a: 0.0002, d: g.crack[1] * 1.4 * j, g: g.crack[2], drive: 2, f: [['hp', g.crack[0] * j, 0.7], ['pk', 4800 * j, 0.8, 5]] });
    m.noise({ a: 0.0003, d: g.snap[1] * 1.3 * j, g: g.snap[2], drive: 2, f: [['bp', g.snap[0] * 1.15 * j, 0.8]] });
    const z = g.sizzle || [5200, g.crack[1] * 2.2, 0.18]; // air / supersonic sizzle
    m.noise({ a: 0.0004, d: z[1], g: z[2], f: [['hp', z[0], 0.7]] });
    const b = g.blast;
    m.noise({ c: 'p', a: 0.0006, d: b[3] * j, g: b[4], drive: 2.5, f: [['lp', [[0, b[0]], [0.12, b[0] * 0.75], [0.4, b[1] * 1.8], [1, b[1]]], 0.7], ['pk', b[2] * j, 0.9, 6]] });
    m.noise({ c: 'p', a: 0.001, d: g.chunk[1] * j, g: g.chunk[2], drive: 1.5, f: [['bp', g.chunk[0] * j, 1.1]] });
    m.noise({ c: 'p', a: 0.006, d: g.rumble[1] * j, g: g.rumble[2], f: [['lp', g.rumble[0], 0.7], ['hp', 110, 0.7]] });
    for (let i = 0; i < (g.pellets || 0); i++) {
      m.noise({ at: rand(0.0005, 0.007), a: 0.0001, d: rand(0.0008, 0.002), g: rand(0.18, 0.36), f: [['bp', rand(1400, 4800), 1.2]] });
    }
    m.filter('pk', 3800, 0.8, 4).filter('pk', 7500, 0.9, 4); // presence + air: crisp, readable report
    m.sat(g.sat);
    const t = g.thump;
    lo.tone({ f0: t[0] * j, f1: t[1] * j, gl: t[2], a: 0.0008, d: t[3], g: t[4], drive: t[5] });
    lo.noise({ c: 'p', a: 0.002, d: g.air[1], g: g.air[2], f: [['lp', g.air[0], 0.7], ['hp', 45, 0.7]] });
  }
  m.filter('hp', 40, 0.7);
  lo.filter('hp', 38, 0.7);
  // Joint normalisation: main + the heaviest body (1.4x low) peaks at 0.86.
  let pk = 1.4 * lo.peak();
  for (let i = 0; i < m.len; i++) {
    const v = Math.abs(m.d[i] + (i < lo.len ? 1.4 * lo.d[i] : 0));
    if (v > pk) pk = v;
  }
  const k = pk > 0 ? 0.86 / pk : 1;
  m.scale(k);
  lo.scale(k);
  let mech = null;
  if (g.mech || sup) {
    mech = new Bake(sr, 0.16);
    (MECH[g.mech] || (g.z >= 1.05 ? MECH.pistol : MECH.rifle))(mech);
    mech.norm(sup ? 0.3 : 0.14);
  }
  return { m, lo, mech };
}

// Reload timelines (fractions of the reload duration `d`).
const RELOAD = {
  pistol: { d: 2.2, s: [[0.08, 'magOut'], [0.5, 'magIn'], [0.72, 'slideRelease']] },
  pistol_heavy: { d: 2.2, s: [[0.08, 'magOut'], [0.5, 'magIn'], [0.66, 'slideBack'], [0.74, 'slideRelease']] },
  smg: { d: 2.3, s: [[0.1, 'magOut'], [0.5, 'magIn'], [0.72, 'chargingHandle']] },
  rifle: { d: 2.5, s: [[0.12, 'magOut'], [0.5, 'magIn'], [0.72, 'slideRelease']] },
  rifle_heavy: { d: 2.5, s: [[0.12, 'magOut'], [0.52, 'magIn'], [0.72, 'chargingHandle']] },
  lmg: { d: 4.5, s: [[0.06, 'boxOpen'], [0.18, 'magOut'], [0.42, 'magIn'], [0.56, 'beltIn'], [0.72, 'boxClose'], [0.86, 'chargingHandle']] },
  shotgun: { d: 2.6, s: [[0.12, 'shellIn'], [0.34, 'shellIn'], [0.56, 'shellIn'], [0.8, 'pump']] },
  shotgun_auto: { d: 2.6, s: [[0.12, 'shellIn'], [0.34, 'shellIn'], [0.56, 'shellIn'], [0.8, 'chargingHandle']] },
  sniper: { d: 3.4, s: [[0.1, 'magOut'], [0.42, 'magIn'], [0.62, 'boltUp'], [0.67, 'boltBack'], [0.75, 'boltForward'], [0.8, 'boltDown']] },
  sniper_light: { d: 3.0, s: [[0.1, 'magOut'], [0.45, 'magIn'], [0.64, 'boltUp'], [0.69, 'boltBack'], [0.77, 'boltForward'], [0.82, 'boltDown']] },
};

// Reload / handling one-shots. z: size factor (pistol > 1 small & bright, lmg < 1 big & heavy).
const PARTS = {
  magOut(b, z) {
    click(b, 0, 4200 * z, 0.0014, 0.35); ring(b, 0, 3600 * z, 0.01, 0.06);
    scrape(b, 0.025, 1600 * z, 2500 * z, 0.07, 0.25);
    click(b, 0.1, 1700 * z, 0.004, 0.45); thud(b, 0.1, 250 * z, 0.012, 0.3);
  },
  magIn(b, z) {
    scrape(b, 0, 2300 * z, 1600 * z, 0.05, 0.22);
    click(b, 0.055, 2500 * z, 0.003, 0.85); ring(b, 0.055, 1950 * z, 0.04, 0.3); thud(b, 0.055, 200 * z, 0.016, 0.55);
  },
  slideBack(b, z) {
    click(b, 0, 3300 * z, 0.0015, 0.3); scrape(b, 0.008, 2600 * z, 3900 * z, 0.06, 0.3);
    click(b, 0.07, 2900 * z, 0.002, 0.45); ring(b, 0.07, 2500 * z, 0.02, 0.15);
  },
  slideRelease(b, z) {
    click(b, 0, 3800 * z, 0.001, 0.22);
    click(b, 0.02, 2650 * z, 0.0025, 0.9); ring(b, 0.02, 2300 * z, 0.05, 0.32); thud(b, 0.02, 300 * z, 0.012, 0.4);
  },
  boltUp(b, z) {
    click(b, 0, 1850 * z, 0.003, 0.55); ring(b, 0, 1400 * z, 0.035, 0.22); thud(b, 0, 240 * z, 0.01, 0.3);
  },
  boltBack(b, z) {
    scrape(b, 0, 1700 * z, 3100 * z, 0.1, 0.32);
    click(b, 0.1, 2200 * z, 0.0025, 0.5); ring(b, 0.1, 2000 * z, 0.03, 0.18);
  },
  boltForward(b, z) {
    scrape(b, 0, 3000 * z, 1800 * z, 0.09, 0.3);
    click(b, 0.085, 1900 * z, 0.003, 0.6); thud(b, 0.085, 220 * z, 0.012, 0.35);
  },
  boltDown(b, z) {
    click(b, 0, 1600 * z, 0.0035, 0.75); ring(b, 0, 1300 * z, 0.045, 0.28); thud(b, 0, 200 * z, 0.014, 0.45);
  },
  pump(b, z) {
    scrape(b, 0, 1100 * z, 1900 * z, 0.08, 0.35);
    click(b, 0.08, 1500 * z, 0.004, 0.7); thud(b, 0.08, 180 * z, 0.016, 0.5); ring(b, 0.08, 1100 * z, 0.03, 0.18);
    scrape(b, 0.19, 1900 * z, 1200 * z, 0.06, 0.3);
    click(b, 0.26, 1700 * z, 0.0035, 0.8); thud(b, 0.26, 200 * z, 0.016, 0.55); ring(b, 0.26, 1250 * z, 0.035, 0.2);
  },
  shellIn(b, z) {
    click(b, 0, 2900 * z, 0.0018, 0.35);
    thud(b, 0.022, 330 * z, 0.01, 0.45); click(b, 0.022, 1250 * z, 0.005, 0.4);
    b.modes({ at: 0.03, g: 0.08, m: [[900 * z, 0.025, 1], [1900 * z, 0.018, 0.5]] });
  },
  chargingHandle(b, z) {
    scrape(b, 0, 2000 * z, 3200 * z, 0.07, 0.3); click(b, 0.07, 2400 * z, 0.002, 0.45);
    click(b, 0.16, 2250 * z, 0.003, 0.9); ring(b, 0.16, 1900 * z, 0.06, 0.32); thud(b, 0.16, 230 * z, 0.014, 0.45);
    b.modes({ at: 0.165, g: 0.1, m: [[760 * z, 0.07, 1], [1610 * z, 0.05, 0.6], [2420 * z, 0.035, 0.4]] });
  },
  boxOpen(b, z) {
    click(b, 0, 1300 * z, 0.004, 0.5); thud(b, 0, 160 * z, 0.016, 0.45); ring(b, 0, 900 * z, 0.08, 0.2);
    scrape(b, 0.05, 900 * z, 1400 * z, 0.08, 0.14);
  },
  boxClose(b, z) {
    click(b, 0, 1200 * z, 0.005, 0.9); thud(b, 0, 140 * z, 0.025, 0.7); ring(b, 0, 850 * z, 0.12, 0.32);
    for (let i = 0; i < 3; i++) click(b, rand(0.025, 0.08), rand(3000, 5000) * z, 0.0008, 0.15, 2);
  },
  beltIn(b, z) {
    for (let i = 0; i < 14; i++) {
      const t = Math.pow(Math.random(), 0.8) * 0.18;
      click(b, t, rand(3000, 6000) * z, rand(0.0006, 0.0015), rand(0.1, 0.3), 2);
      if (Math.random() < 0.4) b.modes({ at: t, g: 0.04, m: [[rand(4000, 7000) * z, 0.015, 1]] });
    }
    thud(b, 0.19, 260 * z, 0.01, 0.25);
  },
};
const PART_ALIAS = { magazineOut: 'magOut', magazineIn: 'magIn', slide: 'slideRelease', bolt: 'boltForward', shell: 'shellIn', charge: 'chargingHandle' };

function bakePart(sr, part, z) {
  const b = new Bake(sr, 0.5);
  PARTS[part](b, z);
  return b.cap(0.85);
}

// Weapon deploy: cloth, a short parts rattle, then the "ready" click.
function bakeDraw(sr, z) {
  const b = new Bake(sr, 0.45);
  b.noise({ c: 'p', a: 0.05, d: 0.05, len: 0.2, g: 0.35, f: [['bp', [[0, 700], [1, 1800]], 0.8]], grain: 0.5 });
  for (let i = 0; i < 3; i++) click(b, 0.04 + i * rand(0.025, 0.04), rand(2500, 4500) * z, 0.001, rand(0.12, 0.22), 2);
  click(b, 0.2, 2600 * z, 0.002, 0.55); ring(b, 0.2, 2200 * z, 0.025, 0.18); thud(b, 0.2, 300 * z, 0.01, 0.25);
  return b.cap(0.8);
}

// ---------------------------------------------------------------------------
// World recipes.

const SURFACES = ['concrete', 'brick', 'plaster', 'metal', 'wood', 'ground', 'glass', 'ink', 'flesh', 'helmet'];
const SURF_ALIAS = {
  wall: 'concrete', stone: 'concrete', tile: 'concrete', dirt: 'ground', sand: 'ground', grass: 'ground', mud: 'ground',
  body: 'flesh', player: 'flesh', armor: 'flesh', steel: 'metal', iron: 'metal', crate: 'wood', paper: 'plaster',
};
const IMPACT_LVL = { concrete: 0.72, brick: 0.72, plaster: 0.62, metal: 0.07, wood: 0.4, ground: 0.62, glass: 0.11, ink: 0.13, flesh: 0.84, helmet: 0.07 };
// Footsteps per surface (metal is deliberately the noisiest, as in CS).
const STEP_LVL = { concrete: 1, metal: 0.45, wood: 0.8, dirt: 0.62 };

function bakeImpact(sr, s) {
  if (s === 'helmet') return bakeDink(sr, 0.85);
  if (s === 'ink') return bakeSplat(sr, 0.4);
  const b = new Bake(sr, s === 'glass' || s === 'metal' ? 0.6 : 0.4);
  const f = vary(0.08);
  switch (s) {
    case 'metal':
      b.noise({ a: 0.0001, d: 0.002, g: 0.7, f: [['hp', 2500 * f, 0.7]] });
      b.modes({ g: 0.45, m: [[1180 * f, 0.1, 1], [2630 * f, 0.07, 0.8], [4120 * f, 0.05, 0.6], [5870 * f, 0.035, 0.45], [7900 * f, 0.02, 0.3]] });
      thud(b, 0, 300 * f, 0.01, 0.3);
      break;
    case 'wood':
      b.noise({ c: 'p', a: 0.0003, d: 0.01, g: 0.85, f: [['bp', 750 * f, 1]] });
      b.modes({ g: 0.32, m: [[430 * f, 0.035, 1], [980 * f, 0.025, 0.7], [1650 * f, 0.016, 0.45]] });
      b.noise({ a: 0.0002, d: 0.003, g: 0.35, f: [['hp', 3000, 0.7]] });
      grit(b, 0.004, 0.06, 10, 0.25, 2500, 6500); // splinters
      break;
    case 'ground':
      b.noise({ c: 'p', a: 0.0008, d: 0.022, g: 0.85, f: [['lp', [[0, 1600 * f], [1, 300]], 0.8]] });
      b.tone({ f0: 150, f1: 70, gl: 0.01, a: 0.001, d: 0.02, g: 0.3 });
      grit(b, 0.003, 0.11, 22, 0.35, 1800, 6000); // dirt and gravel spray
      b.noise({ at: 0.01, a: 0.01, d: 0.04, g: 0.18, f: [['hp', 2600, 0.7]], grain: 0.6 });
      break;
    case 'glass':
      b.noise({ a: 0.0001, d: 0.004, g: 0.75, f: [['hp', 3000 * f, 0.7]] });
      b.modes({ g: 0.25, m: [[3900 * f, 0.06, 1], [6100 * f, 0.045, 0.7], [8700 * f, 0.03, 0.5]] });
      for (let i = 0; i < 14; i++) { // falling shards
        const t = 0.01 + Math.pow(Math.random(), 1.4) * 0.38;
        const hz = rand(2800, 9000);
        b.modes({ at: t, g: rand(0.05, 0.16) * (1 - t * 1.5), m: [[hz, rand(0.015, 0.04), 1], [hz * rand(1.4, 1.7), 0.02, 0.5]] });
      }
      b.noise({ at: 0.004, a: 0.004, d: 0.05, g: 0.15, f: [['hp', 5000, 0.7]], grain: 0.7 });
      break;
    case 'flesh':
      b.tone({ f0: 150 * f, f1: 70, gl: 0.012, a: 0.001, d: 0.025, g: 0.45, drive: 2 });
      b.noise({ c: 'p', a: 0.0006, d: 0.02, g: 0.85, drive: 1.5, f: [['lp', [[0, 2200 * f], [1, 500]], 0.9]] });
      b.noise({ a: 0.0002, d: 0.004, g: 0.35, f: [['bp', 2600 * f, 1.2]] }); // fabric / kevlar
      break;
    case 'plaster':
      b.noise({ c: 'p', a: 0.0006, d: 0.018, g: 0.75, f: [['lp', 1800 * f, 0.7]] });
      b.noise({ a: 0.0002, d: 0.003, g: 0.45, f: [['hp', 2600 * f, 0.7]] });
      b.noise({ at: 0.006, a: 0.008, d: 0.05, g: 0.2, f: [['bp', 1400, 0.8]], grain: 0.7 }); // powder puff
      grit(b, 0.01, 0.12, 10, 0.18, 1200, 3500);
      break;
    case 'brick':
      b.noise({ a: 0.0001, d: 0.0035, g: 0.8, f: [['bp', 1700 * f, 0.8]] });
      b.noise({ c: 'p', a: 0.0005, d: 0.014, g: 0.55, f: [['bp', 650 * f, 1]] });
      thud(b, 0, 200 * f, 0.012, 0.3);
      grit(b, 0.006, 0.14, 18, 0.32, 1200, 4200);
      break;
    default: // concrete
      b.noise({ a: 0.0001, d: 0.0028, g: 0.85, f: [['hp', 2100 * f, 0.7], ['pk', 4200, 1, 4]] });
      b.noise({ c: 'p', a: 0.0004, d: 0.01, g: 0.45, f: [['bp', 1100 * f, 0.9]] });
      thud(b, 0, 210 * f, 0.009, 0.28);
      grit(b, 0.004, 0.12, 16, 0.3, 1800, 6000);
  }
  return b.norm(0.8);
}

// Ricochet: narrow noise band + faint whine gliding down (Doppler), wobbling as it tumbles.
function bakeRicochet(sr) {
  const b = new Bake(sr, 0.5);
  const f0 = rand(3800, 5200), f1 = f0 * rand(0.35, 0.5), len = rand(0.25, 0.4);
  b.noise({ at: 0.01, a: 0.006, d: len * 0.35, len, g: 0.8, f: [['bp', [[0, f0], [1, f1]], 14]] });
  b.tone({ at: 0.01, f0, f1, gl: len * 0.5, a: 0.006, d: len * 0.3, len, g: 0.12 });
  b.am(rand(35, 70), 0.35, 0.01);
  return b.norm(0.55);
}

// Helmet "dink": bright click + strongly ringing shell. k > 1 = heard from inside (own helmet).
function bakeDink(sr, k) {
  const b = new Bake(sr, 0.4 + k * 0.3);
  const f = vary(0.03);
  b.noise({ a: 0.0001, d: 0.0012, g: 0.8, f: [['hp', 3800, 0.7]] });
  b.modes({ g: 0.55, m: [[3150 * f, 0.11 * k, 1], [4790 * f, 0.075 * k, 0.72], [6940 * f, 0.05 * k, 0.5], [9330 * f, 0.03 * k, 0.32], [2150 * f, 0.06 * k, 0.35]] });
  b.tone({ f0: 720 * f, f1: 330, gl: 0.004, a: 0.0003, d: 0.008, g: 0.35 });
  if (k > 1) {
    thud(b, 0, 210, 0.03, 0.55); // the knock through your skull
    b.modes({ g: 0.18, m: [[1180 * f, 0.22, 1], [1730 * f, 0.15, 0.6]] });
  }
  return b.norm(0.85);
}

// Headshot without helmet: short wet crunch.
function bakeCrunch(sr) {
  const b = new Bake(sr, 0.22);
  grit(b, 0, 0.035, 26, 0.9, 1200, 4200);
  b.noise({ c: 'p', a: 0.0005, d: 0.022, g: 0.6, drive: 1.5, f: [['lp', [[0, 1800], [1, 350]], 1.2]] });
  b.tone({ f0: 300, f1: 120, gl: 0.01, a: 0.002, d: 0.025, g: 0.25 });
  thud(b, 0, 120, 0.02, 0.3);
  return b.norm(0.8);
}

// Own body hit: chest thump + kevlar slap.
function bakeHurt(sr) {
  const b = new Bake(sr, 0.3);
  b.tone({ f0: 160 * vary(0.06), f1: 72, gl: 0.012, a: 0.001, d: 0.035, g: 0.55, drive: 2.5 });
  b.noise({ c: 'p', a: 0.0008, d: 0.03, g: 0.75, drive: 1.5, f: [['lp', [[0, 1400], [1, 350]], 0.9]] });
  b.noise({ a: 0.0002, d: 0.006, g: 0.45, f: [['bp', 1800, 1]] }); // kevlar slap
  return b.norm(0.85);
}

// Supersonic crack (N-wave) followed by a short Doppler whizz.
function bakeWhiz(sr) {
  const b = new Bake(sr, 0.28);
  const f0 = rand(2800, 3800), f1 = f0 * rand(0.32, 0.45), len = rand(0.12, 0.18);
  b.nwave({ dur: rand(0.0003, 0.0005), g: 0.7 });
  b.noise({ a: 0.0001, d: 0.0018, g: 0.5, f: [['hp', 3000, 0.7]] });
  b.noise({ at: 0.001, a: len * 0.25, d: len * 0.22, len, g: 0.5, f: [['bp', [[0, f0], [0.3, f0 * 0.85], [1, f1]], 3]] });
  b.tone({ at: 0.001, f0: f0 * 0.75, f1: f1 * 0.8, gl: len * 0.4, a: len * 0.25, d: len * 0.2, len, g: 0.06 });
  return b.filter('hp', 300, 0.7).norm(0.75);
}

// Spent cases: brass rings (pistol short and bright, rifle longer), shotgun hull dull.
const CASE = {
  pistol: { m: [[4700, 0.07, 1], [7350, 0.045, 0.6], [9800, 0.032, 0.45], [12600, 0.022, 0.3]], hp: 6000, g: 0.5, extra: 0.65 },
  rifle: { m: [[3300, 0.14, 1], [5350, 0.09, 0.65], [7900, 0.06, 0.45], [10400, 0.04, 0.3]], hp: 5000, g: 0.55, extra: 0.65 },
  shell: { m: [[780, 0.022, 1], [1500, 0.015, 0.6], [2350, 0.01, 0.4]], hp: 2400, g: 0.7, extra: 0.3, dull: true },
};
function bakeCasing(sr, type) {
  const c = CASE[type] || CASE.pistol;
  const b = new Bake(sr, 0.7);
  const n = 2 + (Math.random() < c.extra ? 1 : 0);
  let t = 0, amp = 1;
  for (let i = 0; i < n; i++) {
    const j = vary(0.04);
    if (c.dull) {
      b.noise({ at: t, a: 0.0002, d: 0.004, g: 0.6 * amp, f: [['lp', c.hp, 0.8]] });
      thud(b, t, 260 * j, 0.01, 0.35 * amp);
    } else {
      b.noise({ at: t, a: 0.0001, d: 0.0012, g: 0.35 * amp, f: [['hp', c.hp, 0.7]] });
    }
    b.modes({ at: t, g: c.g * amp, m: c.m.map(([hz, tau, a]) => [hz * j * vary(0.02), tau * (0.7 + 0.3 * amp), a]) });
    t += rand(0.08, 0.15) * (1 - i * 0.3);
    amp *= rand(0.4, 0.6);
  }
  return b.norm(0.7);
}

// Footsteps: heel strike, then a softer toe/roll 50-75 ms later.
function bakeStep(sr, surf) {
  const b = new Bake(sr, surf === 'metal' ? 0.45 : 0.3);
  const f = vary(0.06), toe = rand(0.05, 0.075), tg = rand(0.45, 0.65);
  if (surf === 'metal') {
    b.noise({ a: 0.0003, d: 0.004, g: 0.8, f: [['bp', 2600 * f, 0.9]] });
    b.modes({ g: 0.32, m: [[430 * f, 0.09, 1], [1130 * f, 0.07, 0.8], [2270 * f, 0.05, 0.6], [3650 * f, 0.035, 0.45], [5200 * f, 0.02, 0.3]] });
    b.tone({ f0: 160, f1: 85, gl: 0.01, a: 0.001, d: 0.02, g: 0.35, drive: 1.5 });
    b.noise({ at: toe, a: 0.0003, d: 0.003, g: 0.5 * tg, f: [['bp', 3000 * f, 1]] });
    b.modes({ at: toe, g: 0.18 * tg, m: [[470 * f, 0.06, 1], [1240 * f, 0.05, 0.8], [2500 * f, 0.035, 0.5]] });
  } else if (surf === 'wood') {
    b.noise({ c: 'p', a: 0.0005, d: 0.012, g: 0.85, f: [['bp', 900 * f, 1.1]] });
    b.modes({ g: 0.3, m: [[190 * f, 0.05, 1], [370 * f, 0.035, 0.7], [720 * f, 0.022, 0.5], [1350 * f, 0.012, 0.3]] });
    b.noise({ a: 0.0003, d: 0.003, g: 0.25, f: [['hp', 3500, 0.7]] });
    b.noise({ c: 'p', at: toe, a: 0.0005, d: 0.01, g: 0.55 * tg, f: [['bp', 1100 * f, 1.2]] });
    b.modes({ at: toe, g: 0.15 * tg, m: [[210 * f, 0.04, 1], [400 * f, 0.03, 0.6]] });
  } else if (surf === 'dirt') {
    b.noise({ c: 'p', a: 0.002, d: 0.018, g: 0.7, f: [['lp', 1100 * f, 0.8]] });
    b.tone({ f0: 120, f1: 70, gl: 0.01, a: 0.002, d: 0.02, g: 0.3 });
    grit(b, 0.002, 0.05, 26, 0.5);
    grit(b, toe, 0.07, 22, 0.42 * tg);
    b.noise({ at: toe, a: 0.008, d: 0.025, g: 0.25 * tg, f: [['bp', 2600, 0.9]] });
  } else {
    b.noise({ a: 0.0003, d: 0.007, g: 0.85, f: [['bp', 1500 * f, 0.8], ['pk', 3200, 1, 4]] });
    b.noise({ a: 0.0002, d: 0.0025, g: 0.35, f: [['hp', 4200 * f, 0.7]] });
    b.tone({ f0: 140, f1: 70, gl: 0.008, a: 0.001, d: 0.018, g: 0.32, drive: 1.4 });
    b.noise({ at: toe, a: 0.0004, d: 0.006, g: 0.55 * tg, f: [['bp', 1900 * f, 0.9]] });
    b.noise({ at: toe + 0.004, a: 0.006, d: 0.02, g: 0.16 * tg, f: [['bp', 2800, 1.1]], grain: 0.6 });
  }
  if (Math.random() < 0.5) click(b, rand(0.01, 0.04), rand(4000, 6000), 0.0008, 0.06, 2); // gear jingle
  return b.norm(0.7);
}

// Grenade-scale blast: pressure wave, crack, boom, sub drop, then debris raining down.
function bakeBlast(sr) {
  const b = new Bake(sr, 2.6);
  b.pulse({ T: 0.012, g: 0.9, b: 1.6 });
  b.noise({ a: 0.0002, d: 0.009, g: 0.8, f: [['hp', 900, 0.7]] });
  b.noise({ c: 'p', a: 0.002, d: 0.24, g: 0.95, drive: 2, f: [['lp', [[0, 5200], [0.15, 1400], [1, 160]], 0.8]] });
  b.noise({ c: 'p', a: 0.01, d: 0.35, g: 0.5, drive: 1.5, f: [['bp', 700, 0.7]] }); // roar
  b.tone({ f0: 80, f1: 30, gl: 0.12, a: 0.003, d: 0.32, g: 0.6, drive: 2.5 });
  b.noise({ c: 'b', a: 0.03, d: 0.6, g: 0.4, f: [['lp', 300, 0.7]] });
  for (let i = 0; i < 70; i++) {
    const u = Math.pow(Math.random(), 1.3), t = 0.12 + u * 2.0;
    b.noise({ at: t, a: 0.0002, d: rand(0.001, 0.005), g: rand(0.05, 0.22) * (1 - u * 0.7), f: [['bp', rand(1200, 5200), 1.3]] });
  }
  for (let i = 0; i < 9; i++) {
    const t = rand(0.18, 1.3);
    thud(b, t, rand(140, 320), rand(0.01, 0.025), rand(0.12, 0.3) * (1.4 - t * 0.6));
    click(b, t, rand(900, 2200), 0.004, rand(0.1, 0.22));
  }
  b.sat(2);
  return b.filter('hp', 25, 0.7).norm(0.9);
}

// Map-wide stereo rumble that rolls on after the blast.
function bakeRumble(sr) {
  const b = new Bake(sr, 4.5, 2);
  for (let c = 0; c < 2; c++) {
    b.noise({ ch: c, c: 'b', a: 0.07, d: 0.85, g: 0.9, f: [['lp', [[0, 260], [1, 70]], 0.9]] });
    b.noise({ ch: c, c: 'p', at: 0.05, a: 0.1, d: 0.5, g: 0.25, f: [['bp', 420, 0.8]], grain: 0.4 });
    b.tone({ ch: c, f0: 44, f1: 30, gl: 0.6, a: 0.06, d: 0.7, g: 0.4 });
  }
  return b.filter('hp', 22, 0.7).norm(0.85);
}

// Knife: blade swish (rising then falling band) and a stab.
function bakeSwish(sr) {
  const b = new Bake(sr, 0.3);
  const f = vary(0.1);
  b.noise({ c: 'p', a: 0.07, d: 0.035, len: 0.2, g: 0.9, f: [['bp', [[0, 650 * f], [0.45, 2600 * f], [1, 1200 * f]], 1.5]] });
  b.noise({ a: 0.08, d: 0.02, len: 0.16, g: 0.12, f: [['bp', [[0, 2600 * f], [0.5, 4200 * f], [1, 3000 * f]], 9]] });
  return b.norm(0.7);
}
function bakeStab(sr) {
  const b = new Bake(sr, 0.3);
  b.noise({ a: 0.0002, d: 0.005, g: 0.55, f: [['bp', 3200, 1.4]] });
  thud(b, 0.004, 62, 0.035, 0.75);
  b.noise({ c: 'p', at: 0.003, a: 0.001, d: 0.03, g: 0.7, f: [['lp', [[0, 1400], [1, 300]], 1]] });
  b.noise({ at: 0.03, a: 0.01, d: 0.03, g: 0.12, f: [['bp', 2200, 1.5]], grain: 0.6 });
  return b.norm(0.8);
}
function bakeBladeTink(sr) {
  const b = new Bake(sr, 0.3);
  click(b, 0, 4200, 0.001, 0.6);
  b.modes({ g: 0.35, m: [[3800 * vary(0.04), 0.07, 1], [6100, 0.05, 0.6], [8400, 0.03, 0.4]] });
  return b.norm(0.7);
}

// Thick wet ink: low splut, viscous blorp and a few droplets.
function bakeSplat(sr, size) {
  const b = new Bake(sr, 0.7);
  b.noise({ c: 'p', a: 0.002, d: 0.06 + size * 0.06, g: 0.85, f: [['lp', [[0, 3200], [1, 260]], 2.2]] });
  b.tone({ f0: 380 * vary(0.1), f1: 105, gl: 0.04, a: 0.002, d: 0.05 + size * 0.04, g: 0.55, drive: 1.3 });
  b.noise({ c: 'b', a: 0.004, d: 0.08, g: 0.3, f: [['lp', 380, 1]] });
  const drops = 2 + Math.round(size * 4);
  for (let i = 0; i < drops; i++) {
    const hz = rand(700, 1600);
    b.tone({ at: rand(0.05, 0.22 + size * 0.2), f0: hz, f1: hz * 1.7, gl: 0.012, a: 0.001, d: 0.012, g: rand(0.08, 0.18) });
  }
  return b.norm(0.8);
}

// Ink wall giving way: thick paper tearing, low thud, pieces flopping down.
function bakeRip(sr) {
  const b = new Bake(sr, 0.6);
  b.noise({ a: 0.02, h: 0.18, d: 0.08, g: 0.75, f: [['bp', [[0, 1600], [1, 3800]], 0.9]], grain: 0.9 });
  b.noise({ c: 'p', a: 0.03, h: 0.15, d: 0.06, g: 0.35, f: [['bp', [[0, 500], [1, 900]], 1]], grain: 0.8 });
  thud(b, 0, 85, 0.03, 0.4);
  b.noise({ c: 'p', at: 0.3, a: 0.002, d: 0.03, g: 0.4, f: [['lp', 1500, 0.8]] });
  return b.norm(0.75);
}

// Landing: boots + body weight, gear rattle growing with the drop height (s 0..1).
function bakeLand(sr, s) {
  const b = new Bake(sr, 0.4);
  thud(b, 0, 85 - 20 * s, 0.03 + s * 0.05, 0.7);
  b.noise({ c: 'p', a: 0.001, d: 0.02 + s * 0.03, g: 0.7, f: [['lp', 1400 + s * 600, 0.8]] });
  click(b, 0.002, 1500, 0.006, 0.4);
  const n = 2 + Math.round(s * 3);
  for (let i = 0; i < n; i++) click(b, rand(0.02, 0.09), rand(2500, 5000), 0.0012, rand(0.08, 0.2) * (0.5 + s), 2);
  return b.cap(0.85);
}

// Named one-shot recipes: [variants, (sr) => Bake].
const SFX = {
  whiz: [4, bakeWhiz],
  ric: [3, bakeRicochet],
  dink: [3, (sr) => bakeDink(sr, 1)],
  ownDink: [2, (sr) => bakeDink(sr, 1.45)],
  crunch: [3, bakeCrunch],
  hurt: [3, bakeHurt],
  blast: [2, bakeBlast],
  rumble: [1, (sr) => bakeRumble(Math.round(sr / 4))], // content < 500 Hz: bake at sr/4
  swish: [3, bakeSwish],
  stab: [3, bakeStab],
  tink: [2, bakeBladeTink],
  splat: [3, (sr) => bakeSplat(sr, 1)],
  rip: [2, bakeRip],
  dry: [2, (sr) => { const b = new Bake(sr, 0.15); click(b, 0, 3200, 0.004, 0.8); ring(b, 0, 2600, 0.03, 0.5); click(b, 0.012, 2200, 0.004, 0.6); thud(b, 0.012, 600, 0.006, 0.3); return b.norm(0.8); }],
  scopeIn: [1, (sr) => {
    const b = new Bake(sr, 0.25);
    click(b, 0, 3600, 0.0015, 0.4);
    b.noise({ at: 0.01, c: 'p', a: 0.04, d: 0.03, len: 0.12, g: 0.25, f: [['bp', [[0, 1100], [1, 2400]], 1.2]] });
    click(b, 0.1, 4200, 0.001, 0.3);
    return b.cap(0.6);
  }],
  scopeOut: [1, (sr) => {
    const b = new Bake(sr, 0.2);
    click(b, 0, 3000, 0.0015, 0.35);
    b.noise({ at: 0.005, c: 'p', a: 0.02, d: 0.03, len: 0.09, g: 0.22, f: [['bp', [[0, 2200], [1, 1000]], 1.2]] });
    return b.cap(0.6);
  }],
  jump: [3, (sr) => {
    const b = new Bake(sr, 0.3);
    b.noise({ c: 'p', a: 0.03, d: 0.05, len: 0.2, g: 0.5, f: [['bp', [[0, 600], [1, 1500]], 0.9]], grain: 0.5 });
    click(b, 0, 1600, 0.004, 0.35); thud(b, 0, 90, 0.02, 0.35);
    for (let i = 0; i < 2; i++) click(b, rand(0.02, 0.08), rand(3000, 5000), 0.001, 0.12, 2);
    return b.cap(0.8);
  }],
  key: [3, (sr) => { const b = new Bake(sr, 0.06); click(b, 0, 2600, 0.0012, 0.5); thud(b, 0, 700, 0.004, 0.3); click(b, 0.012, 3200, 0.0008, 0.25); return b.cap(0.7); }],
  snip: [2, (sr) => { const b = new Bake(sr, 0.15); click(b, 0, 4500, 0.0008, 0.5); ring(b, 0, 3800, 0.015, 0.12); click(b, 0.018, 3800, 0.001, 0.35); return b.cap(0.7); }],
  rustle: [2, (sr) => { const b = new Bake(sr, 0.5); b.noise({ c: 'p', a: 0.08, d: 0.1, len: 0.45, g: 0.5, f: [['bp', [[0, 800], [0.5, 1600], [1, 1000]], 0.8]], grain: 0.7 }); return b.cap(0.5); }],
  uiClick: [2, (sr) => { const b = new Bake(sr, 0.08); click(b, 0, 3000, 0.0012, 0.6, 1); b.tone({ f0: 1650, a: 0.0008, d: 0.018, g: 0.35 }); thud(b, 0, 500, 0.004, 0.2); return b.cap(0.7); }],
  uiHover: [2, (sr) => { const b = new Bake(sr, 0.06); b.noise({ a: 0.0001, d: 0.001, g: 0.4, f: [['hp', 5500, 0.7]] }); b.tone({ f0: 2400, a: 0.0008, d: 0.012, g: 0.3 }); return b.cap(0.5); }],
  buy: [2, (sr) => {
    const b = new Bake(sr, 0.45);
    b.noise({ c: 'p', a: 0.02, d: 0.04, len: 0.12, g: 0.3, f: [['bp', 1200, 0.8]], grain: 0.5 });
    click(b, 0.03, 2200, 0.003, 0.7); ring(b, 0.03, 1900, 0.03, 0.22); thud(b, 0.03, 260, 0.012, 0.3);
    b.tone({ at: 0.1, f0: 1320, a: 0.002, d: 0.035, g: 0.16 });
    b.tone({ at: 0.16, f0: 1980, a: 0.002, d: 0.06, g: 0.14 });
    return b.cap(0.75);
  }],
  deny: [1, (sr) => {
    const b = new Bake(sr, 0.3);
    b.tone({ f0: 250, f1: 230, w: 'tri', a: 0.002, h: 0.03, d: 0.035, g: 0.5 });
    b.tone({ at: 0.11, f0: 205, f1: 190, w: 'tri', a: 0.002, h: 0.04, d: 0.045, g: 0.5 });
    return b.filter('lp', 1500, 0.7).cap(0.6);
  }],
  tick: [2, (sr) => { const b = new Bake(sr, 0.12); click(b, 0, 3400, 0.0012, 0.55); b.tone({ f0: 2700, a: 0.0005, d: 0.022, g: 0.3 }); return b.cap(0.6); }],
  tickHead: [2, (sr) => {
    const b = new Bake(sr, 0.12);
    click(b, 0, 3600, 0.001, 0.5); b.tone({ f0: 2900, a: 0.0005, d: 0.02, g: 0.2 }); b.tone({ f0: 4100, a: 0.0005, d: 0.03, g: 0.14 });
    click(b, 0.03, 4300, 0.0008, 0.3);
    return b.cap(0.65);
  }],
  kill: [2, (sr) => {
    const b = new Bake(sr, 0.35);
    thud(b, 0, 120, 0.035, 0.5); click(b, 0, 2400, 0.0015, 0.45);
    b.tone({ at: 0.012, f0: 1320, a: 0.003, d: 0.09, g: 0.18 });
    b.tone({ at: 0.012, f0: 1980, a: 0.003, d: 0.07, g: 0.12 });
    return b.cap(0.7);
  }],
  spray: [2, (sr) => {
    const b = new Bake(sr, 0.85);
    for (const t of [0, 0.07]) { click(b, t, 3000, 0.001, 0.4); b.modes({ at: t, g: 0.15, m: [[2600 * vary(0.05), 0.02, 1], [4100, 0.015, 0.6]] }); }
    b.noise({ at: 0.12, a: 0.03, h: 0.42, d: 0.05, g: 0.55, f: [['hp', 3500, 0.7]] });
    b.noise({ at: 0.12, a: 0.02, h: 0.42, d: 0.04, g: 0.3, f: [['bp', 7500, 1.5]] });
    return b.cap(0.7);
  }],
  panel: [1, (sr) => {
    const b = new Bake(sr, 0.8);
    b.noise({ c: 'p', a: 0.32, d: 0.04, len: 0.38, g: 0.6, f: [['bp', [[0, 300], [1, 4200]], 1.3]] });
    b.noise({ at: 0.36, c: 'p', a: 0.001, d: 0.04, g: 0.8, f: [['lp', [[0, 4000], [1, 700]], 0.8]] });
    thud(b, 0.36, 60, 0.05, 0.6);
    b.noise({ at: 0.36, a: 0.0002, d: 0.008, g: 0.25, f: [['hp', 5000, 0.7]] });
    return b.cap(0.8);
  }],
};

// Karplus-Strong pluck for the understated round stingers.
function bakePluck(sr, f) {
  const b = new Bake(sr, 1.2);
  const N = Math.max(2, Math.round(sr / f - 0.5));
  const line = new Float32Array(N);
  let s = 0;
  for (let i = 0; i < N; i++) { s += (Math.random() * 2 - 1 - s) * 0.5; line[i] = s; }
  let idx = 0;
  for (let i = 0; i < b.len; i++) {
    const a = line[idx], nx = line[(idx + 1) % N];
    b.d[i] = a * Math.min(1, i / (0.002 * sr), (b.len - i) / (0.5 * sr));
    line[idx] = 0.5 * (a + nx) * 0.996;
    idx = (idx + 1) % N;
  }
  return b.filter('lp', Math.min(5000, f * 5), 0.7).filter('hp', 80, 0.7).norm(0.8);
}

// ---------------------------------------------------------------------------

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.volume = 0.8;
    this.voices = [];
    this.bank = new Map();
    this.rate = {};
    this.listener = { pos: { x: 0, y: 0, z: 0 }, fwd: { x: 0, y: 0, z: -1 }, up: { x: 0, y: 1, z: 0 } };
    this.scribble = null;
    this.ring = null;
    this.muf = null;
    this.reloadV = null;
    this.lastKind = 'rifle';
  }

  // ---------- setup ----------

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return;
    let ctx;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    const gain = (v, to) => {
      const g = ctx.createGain();
      g.gain.value = v;
      if (to) g.connect(to);
      return g;
    };

    // master -> gentle glue compressor -> limiter -> volume -> speakers
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -2.5;
    lim.knee.value = 0;
    lim.ratio.value = 20;
    lim.attack.value = 0.001;
    lim.release.value = 0.09;
    this.vol = gain(this.volume);
    this.master = gain(1);
    this.master.connect(comp).connect(lim).connect(this.vol).connect(ctx.destination);

    // gun + world + reverbs -> mix -> muffle (tinnitus) -> master; ui and the ear ring skip it.
    this.muffle = ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.Q.value = 0.6;
    this.muffle.frequency.value = ctx.sampleRate / 2;
    this.mix = gain(1);
    this.mix.connect(this.muffle).connect(this.master);
    this.bus = { gun: gain(1, this.mix), world: gain(0.85, this.mix), ui: gain(0.5, this.master) };

    // Shared space: short street reflections + long rolling echo (fed by per-voice sends).
    this.verb = ctx.createConvolver();
    this.verb.buffer = streetIR(ctx);
    this.verb.connect(gain(0.5, this.mix));
    this.echo = ctx.createConvolver();
    this.echo.buffer = echoIR(ctx);
    this.echo.connect(gain(0.45, this.mix));

    const live = (c) => {
      const n = 2 * ctx.sampleRate;
      const b = ctx.createBuffer(1, n, ctx.sampleRate);
      b.getChannelData(0).set(noiseArr(n, c));
      return b;
    };
    this.noise = { white: live('w'), pink: live('p'), brown: live('b') };

    this.ctx = ctx;
    this._applyListener();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this._warmup();
  }

  setVolume(master) {
    this.volume = clamp(Number(master) || 0, 0, 1);
    if (this.ctx) this.vol.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  setListener(pos, forward, up = { x: 0, y: 1, z: 0 }) {
    if (isPos(pos)) this.listener.pos = { x: pos.x, y: pos.y, z: pos.z };
    if (isPos(forward)) this.listener.fwd = { x: forward.x, y: forward.y, z: forward.z };
    if (isPos(up)) this.listener.up = { x: up.x, y: up.y, z: up.z };
    if (this.ctx) this._applyListener();
  }

  // ---------- internals: listener, voices, playback ----------

  _applyListener() {
    const L = this.ctx.listener;
    const { pos: p, fwd: f, up: u } = this.listener;
    if (Math.abs(f.x) + Math.abs(f.y) + Math.abs(f.z) < 1e-6) return;
    if (L.positionX) {
      L.positionX.value = p.x;
      L.positionY.value = p.y;
      L.positionZ.value = p.z;
      L.forwardX.value = f.x;
      L.forwardY.value = f.y;
      L.forwardZ.value = f.z;
      L.upX.value = u.x;
      L.upY.value = u.y;
      L.upZ.value = u.z;
    } else {
      L.setPosition(p.x, p.y, p.z);
      L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
    }
  }

  // One-shot voice: out -> [distance lowpass] -> [HRTF panner] -> bus, plus reverb/echo sends.
  // o: gain, dur, bus (gun|world|ui), ref/roll/max (distance curve, m), prio, send/echo (+far/farEcho
  //    added with distance), muffle (m per e-fold of the air-absorption lowpass; 0 = off), mmin, hrtf
  _voice(pos, local, o = {}) {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'closed') return null;
    const now = ctx.currentTime;
    this._prune(now);
    const {
      gain = 1, dur = 1, bus = 'world', ref = 4, roll = 1, max = 120, prio = 1,
      send = 0, echo = 0, far = 0, farEcho = 0, muffle = 0, mmin = 600, hrtf = true,
    } = o;
    const positional = !local && isPos(pos);
    const d = positional ? dist(pos, this.listener.pos) : 0;
    if (positional && d >= max) return null;
    const att = positional ? ref / (ref + roll * Math.max(0, d - ref)) : 1;
    const f0 = max * 0.7;
    const fade = positional && d > f0 ? Math.pow(1 - (d - f0) / (max - f0), 2) : 1;
    const loud = gain * att * fade * prio;
    if (loud < 2e-4 || !this._room(now, loud)) return null;

    const nodes = [];
    const out = ctx.createGain();
    out.gain.value = gain * fade;
    let tap = out;
    if (positional) {
      if (muffle > 0) {
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.5;
        lp.frequency.value = clamp(18000 * Math.exp(-d / muffle), mmin, 18000);
        tap = tap.connect(lp);
        nodes.push(lp);
      }
      const p = ctx.createPanner();
      p.panningModel = hrtf && d < 60 ? 'HRTF' : 'equalpower';
      p.distanceModel = 'inverse';
      p.refDistance = ref;
      p.rolloffFactor = roll;
      p.maxDistance = Math.max(max, ref + 1);
      if (p.positionX) {
        p.positionX.value = pos.x;
        p.positionY.value = pos.y;
        p.positionZ.value = pos.z;
      } else {
        p.setPosition(pos.x, pos.y, pos.z);
      }
      tap.connect(p).connect(this.bus[bus] || this.bus.world);
      nodes.push(p);
    } else {
      out.connect(this.bus[bus] || this.bus.world);
    }
    // Reverb falls off slower than the direct sound (a distance cue); far sounds get extra tail.
    const farness = positional ? clamp((d - 12) / 70, 0, 1) : 0;
    const ra = Math.sqrt(att) * fade;
    const sv = (send + far * farness) * ra;
    const ev = (echo + farEcho * farness) * ra;
    if (sv > 0.002) {
      const s = ctx.createGain();
      s.gain.value = sv / Math.max(0.05, fade);
      tap.connect(s).connect(this.verb);
      nodes.push(s);
    }
    if (ev > 0.002) {
      const s = ctx.createGain();
      s.gain.value = ev / Math.max(0.05, fade);
      tap.connect(s).connect(this.echo);
      nodes.push(s);
    }
    const v = { t: now + 0.004, born: now, end: now + dur, out, nodes, srcs: [], loud, d };
    this.voices.push(v);
    return v;
  }

  // Voice cap: steal the voice that is quietest right now (loudness x remaining life),
  // or drop the new one if it would be quieter still.
  _room(now, loud) {
    if (this.voices.length < MAX_VOICES) return true;
    let qi = -1, qs = Infinity;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      const s = v.loud * Math.max(0.02, 1 - (now - v.born) / Math.max(0.05, v.end - v.born));
      if (s < qs) { qs = s; qi = i; }
    }
    if (qi < 0 || qs > loud) return false;
    this._kill(this.voices[qi], now);
    this.voices.splice(qi, 1);
    return true;
  }

  _prune(now) {
    if (!this.voices.length) return;
    this.voices = this.voices.filter((v) => {
      if (now < v.end + 0.05) return true;
      this._disconnect(v);
      return false;
    });
  }

  _disconnect(v) {
    try { v.out.disconnect(); } catch { /* already gone */ }
    for (const n of v.nodes) {
      try { n.disconnect(); } catch { /* already gone */ }
    }
  }

  _kill(v, now) {
    try {
      v.out.gain.cancelScheduledValues(now);
      v.out.gain.setValueAtTime(v.out.gain.value, now);
      v.out.gain.linearRampToValueAtTime(0, now + 0.02);
    } catch { /* ignore */ }
    for (const s of v.srcs) {
      try { s.stop(now + 0.03); } catch { /* already stopped */ }
    }
    setTimeout(() => this._disconnect(v), 80);
  }

  _track(v, src, stopAt) {
    src.stop(stopAt);
    v.srcs.push(src);
    v.end = Math.max(v.end, stopAt);
  }

  // Plays a baked buffer inside a voice.
  _play(v, buf, { at = 0, gain = 1, rate = 1 } = {}) {
    if (!v || !buf) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    if (gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(g).connect(v.out);
      v.nodes.push(g);
    } else {
      src.connect(v.out);
    }
    const t = v.t + Math.max(0, at);
    src.start(t);
    v.srcs.push(src);
    v.end = Math.max(v.end, t + buf.duration / rate + 0.02);
    return src;
  }

  // Live helpers for rare/tonal sounds.
  _env(param, t, peak, attack, decay, hold = 0) {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + attack);
    if (hold > 0) param.setValueAtTime(peak, t + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  }

  _noise(v, { type = 'white', at = 0, dur = 0.1, gain = 1, attack = 0.002, hold = 0, filter = 'bandpass', freq = 1000, to, q = 1 }) {
    const ctx = this.ctx;
    const t = v.t + at;
    const total = attack + hold + dur;
    const src = ctx.createBufferSource();
    src.buffer = this.noise[type];
    src.loop = true;
    let node = src;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      if (to) f.frequency.exponentialRampToValueAtTime(to, t + total);
      node = node.connect(f);
    }
    const g = ctx.createGain();
    this._env(g.gain, t, gain, attack, dur, hold);
    node.connect(g).connect(v.out);
    src.start(t, Math.random() * 1.8);
    this._track(v, src, t + total + 0.02);
  }

  _tone(v, { type = 'sine', freq, to, at = 0, dur = 0.1, gain = 1, attack = 0.002, hold = 0, glide }) {
    const ctx = this.ctx;
    const t = v.t + at;
    const total = attack + hold + dur;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + (glide || total));
    const g = ctx.createGain();
    this._env(g.gain, t, gain, attack, dur, hold);
    osc.connect(g).connect(v.out);
    osc.start(t);
    this._track(v, osc, t + total + 0.02);
  }

  // Clean electronic beep: softened square (piezo-like) with click-free edges.
  _beep(v, { freq, at = 0, len = 0.08, gain = 0.3, wave = 'square', cutoff = 4200 }) {
    const ctx = this.ctx;
    const t = v.t + at;
    const osc = ctx.createOscillator();
    osc.type = wave;
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.003);
    g.gain.setValueAtTime(gain, t + Math.max(0.004, len - 0.012));
    g.gain.linearRampToValueAtTime(0, t + len);
    osc.connect(lp).connect(g).connect(v.out);
    osc.start(t);
    this._track(v, osc, t + len + 0.02);
  }

  // Soft detuned-saw pad for the match stinger.
  _pad(v, freqs, at, dur, gain, cutoff) {
    const ctx = this.ctx;
    const t = v.t + at;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(cutoff * 0.4, t);
    lp.frequency.linearRampToValueAtTime(cutoff, t + dur * 0.3);
    const g = ctx.createGain();
    this._env(g.gain, t, gain / Math.sqrt(freqs.length * 2), dur * 0.15, dur * 0.85);
    lp.connect(g).connect(v.out);
    v.nodes.push(lp, g);
    for (const f of freqs) {
      for (const det of [-7, 7]) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = det;
        osc.connect(lp);
        osc.start(t);
        this._track(v, osc, t + dur + 0.05);
      }
    }
  }

  // ---------- internals: baked sound bank ----------

  _buf(b) {
    const buf = this.ctx.createBuffer(b.ch.length, b.len, b.sr);
    for (let c = 0; c < b.ch.length; c++) buf.getChannelData(c).set(b.ch[c]);
    return buf;
  }

  // Up to n variants per key; at most one new variant is baked per call.
  _bank(key, n, make) {
    let e = this.bank.get(key);
    if (!e) this.bank.set(key, (e = []));
    if (e.length < n) e.push(make());
    return e[(Math.random() * e.length) | 0];
  }

  _gun(kind, sup) {
    return this._bank(`gun:${kind}${sup ? ':s' : ''}`, 3, () => {
      const s = bakeShot(this.ctx.sampleRate, GUNS[kind], sup);
      return { main: this._buf(s.m), low: this._buf(s.lo), mech: s.mech ? this._buf(s.mech) : null };
    });
  }
  _stepBuf(s) { return this._bank('step:' + s, 5, () => this._buf(bakeStep(this.ctx.sampleRate, s))); }
  _impactBuf(s) { return this._bank('imp:' + s, 3, () => this._buf(bakeImpact(this.ctx.sampleRate, s))); }
  _casingBuf(t) { return this._bank('case:' + t, 3, () => this._buf(bakeCasing(this.ctx.sampleRate, t))); }
  _sfx(name) {
    const [n, fn] = SFX[name];
    return this._bank('sfx:' + name, n, () => this._buf(fn(this.ctx.sampleRate)));
  }
  _part(kind, part) {
    const z = GUNS[kind]?.z ?? 1;
    return this._bank(`part:${part}:${z}`, 2, () => this._buf(bakePart(this.ctx.sampleRate, part, z)));
  }
  _drawBuf(kind) {
    const z = GUNS[kind]?.z ?? 1;
    return this._bank('draw:' + z, 2, () => this._buf(bakeDraw(this.ctx.sampleRate, z)));
  }
  _pluck(f) { return this._bank('pluck:' + Math.round(f), 1, () => this._buf(bakePluck(this.ctx.sampleRate, f))); }

  // Bake the common sounds in small time slices so the first shots never stall a frame.
  _warmup() {
    const jobs = [];
    const add = (fn, n) => { for (let i = 0; i < n; i++) jobs.push(fn); };
    for (const k of Object.keys(GUNS)) add(() => this._gun(k, false), 3);
    for (const s of ['concrete', 'metal', 'wood', 'dirt']) add(() => this._stepBuf(s), 5);
    for (const s of SURFACES) add(() => this._impactBuf(s), 3);
    for (const t of Object.keys(CASE)) add(() => this._casingBuf(t), 3);
    for (const n of ['whiz', 'ric', 'dink', 'crunch', 'hurt', 'tick', 'tickHead', 'kill', 'swish', 'stab', 'dry', 'uiClick', 'uiHover', 'blast', 'rumble', 'ownDink']) {
      add(() => this._sfx(n), SFX[n][0]);
    }
    add(() => this._gun('pistol', true), 3);
    add(() => this._gun('rifle', true), 3);
    const step = () => {
      if (!this.ctx) return;
      const t0 = nowMs();
      while (jobs.length && nowMs() - t0 < 5) {
        try { jobs.shift()(); } catch { /* keep warming the rest */ }
      }
      if (jobs.length) setTimeout(step, 20);
    };
    setTimeout(step, 30);
  }

  // ---------- internals: misc ----------

  // `sound` is a kind string or { kind, pitch, body, suppressed }.
  _profile(sound) {
    let kind = 'rifle', pitch = 1, body = 1, suppressed = false;
    if (typeof sound === 'string') kind = sound;
    else if (sound && typeof sound === 'object') {
      if (typeof sound.kind === 'string') kind = sound.kind;
      if (Number.isFinite(sound.pitch) && sound.pitch > 0) pitch = sound.pitch;
      if (Number.isFinite(sound.body)) body = sound.body;
      suppressed = !!sound.suppressed;
    }
    kind = GUN_ALIAS[kind] || kind;
    if (kind === 'pistol_suppressed') { kind = 'pistol'; suppressed = true; }
    if (!GUNS[kind]) kind = 'rifle';
    return { kind, pitch: clamp(pitch, 0.5, 2), body: clamp(body, 0.4, 1.4), suppressed };
  }

  _rl(key, win, n) {
    const t = this.ctx.currentTime;
    const r = this.rate[key] || (this.rate[key] = { t: -1, c: 0 });
    if (t - r.t > win) { r.t = t; r.c = 0; }
    return ++r.c <= n;
  }

  _cancelReload() {
    const v = this.reloadV;
    this.reloadV = null;
    if (!v) return;
    const i = this.voices.indexOf(v);
    if (i < 0) return;
    this._kill(v, this.ctx.currentTime);
    this.voices.splice(i, 1);
  }

  // ---------- weapons ----------

  // sound: kind string (old) or { kind, pitch = 1, body = 1, suppressed = false }.
  shot(sound, pos, local) {
    const p = this._profile(sound);
    const g = GUNS[p.kind];
    const sup = p.suppressed;
    const set = this._gun(p.kind, sup);
    const rate = p.pitch * vary(0.022);
    if (local) this.lastKind = p.kind;
    const v = this._voice(pos, local, {
      bus: 'gun',
      gain: g.lvl * (sup ? 0.85 : 1) * rand(0.92, 1),
      dur: set.main.duration / rate,
      ref: sup ? 1.6 : 3, roll: sup ? 1.7 : 0.8, max: sup ? 45 : 220, prio: 1.6,
      send: sup ? 0.06 : g.verb, echo: sup ? 0 : g.echo,
      far: sup ? 0.04 : 0.25, farEcho: sup ? 0 : 0.55,
      muffle: sup ? 22 : 30, mmin: 450,
    });
    if (!v) return;
    this._play(v, set.main, { rate });
    // Far away the thump survives better than the crack: a dull pop plus echo.
    this._play(v, set.low, { rate, gain: p.body * (v.d > 60 ? 0.75 : 1) });
    if (local && set.mech) this._play(v, set.mech, { rate: rate * vary(0.02), at: rand(0, 0.002) });
  }

  dryFire() {
    const v = this._voice(null, true, { gain: 0.25, dur: 0.2 });
    if (v) this._play(v, this._sfx('dry'), { rate: vary(0.03) });
  }

  // Whole reload as one call (old API). `duration` (s) optionally stretches the timeline.
  reload(kind, duration) {
    const k = this._profile(kind).kind;
    const plan = RELOAD[k] || RELOAD.rifle;
    const D = Number.isFinite(duration) && duration > 0.4 ? duration : plan.d;
    this._cancelReload();
    const v = this._voice(null, true, { gain: 0.13, dur: D + 0.6, send: 0.05, prio: 2 });
    if (!v) return;
    for (const [frac, part] of plan.s) this._play(v, this._part(k, part), { at: frac * D, rate: vary(0.02) });
    this.reloadV = v;
  }

  // Single mechanical one-shot, timed by the first-person animation.
  reloadPart(kind, part) {
    const name = PARTS[part] ? part : PART_ALIAS[part];
    if (!name) return;
    const k = this._profile(kind).kind;
    const v = this._voice(null, true, { gain: 0.13, dur: 0.55, send: 0.05, prio: 2 });
    if (v) this._play(v, this._part(k, name), { rate: vary(0.025) });
  }

  draw(kind) {
    const k = this._profile(kind ?? this.lastKind).kind;
    this.lastKind = k;
    this._cancelReload();
    const v = this._voice(null, true, { gain: 0.14, dur: 0.5, send: 0.04 });
    if (v) this._play(v, this._drawBuf(k), { rate: vary(0.03) });
  }

  switchWeapon() {
    this.draw(this.lastKind);
  }

  scope(on) {
    const v = this._voice(null, true, { gain: 0.2, dur: 0.3 });
    if (v) this._play(v, this._sfx(on ? 'scopeIn' : 'scopeOut'));
  }

  knifeSwing(pos, local) {
    const v = this._voice(pos, local, { gain: local ? 0.065 : 0.075, dur: 0.35, ref: 2, roll: 1.4, max: 25, muffle: 40 });
    if (v) this._play(v, this._sfx('swish'), { rate: vary(0.06) });
  }

  // surface (optional): omitted / 'flesh' = stab into a body, anything else = blade on a surface.
  knifeHit(pos, surface) {
    const s = surface ? SURF_ALIAS[surface] || surface : 'flesh';
    const v = this._voice(pos, false, { gain: 1, dur: 0.4, ref: 2.5, roll: 1.2, max: 35, muffle: 40, send: 0.04 });
    if (!v) return;
    if (s === 'flesh') {
      this._play(v, this._sfx('stab'), { rate: vary(0.05) });
    } else {
      this._play(v, this._sfx('tink'), { gain: 0.15, rate: vary(0.05) });
      this._play(v, this._impactBuf(SURFACES.includes(s) ? s : 'concrete'), { gain: 0.5, rate: vary(0.05) });
    }
  }

  // ---------- impacts / feedback ----------

  impact(pos, surface) {
    let s = SURF_ALIAS[surface] || surface;
    if (!SURFACES.includes(s)) s = 'concrete';
    if (!this._rl('imp', 0.03, 4)) return;
    const body = s === 'flesh' || s === 'helmet';
    const v = this._voice(pos, false, {
      gain: IMPACT_LVL[s] * rand(0.85, 1), dur: 0.5, ref: 2.5, roll: 1.1, max: 60,
      muffle: 40, mmin: 900, send: 0.06, far: 0.08, prio: body ? 1.4 : 1.1,
    });
    if (!v) return;
    this._play(v, this._impactBuf(s), { rate: vary(0.05) });
    if ((s === 'metal' && Math.random() < 0.35) || ((s === 'concrete' || s === 'brick') && Math.random() < 0.05)) {
      this._play(v, this._sfx('ric'), { at: rand(0.004, 0.02), gain: 0.1 / IMPACT_LVL[s], rate: vary(0.08) });
    }
  }

  // Played at the victim, loud enough to read from across the map.
  headshotHit(pos, helmet) {
    const v = this._voice(pos, false, {
      gain: helmet ? 0.13 : 1, dur: 0.8, ref: 10, roll: 0.6, max: 90, prio: 2.5, muffle: 120, mmin: 3000, send: 0.05,
    });
    if (v) this._play(v, this._sfx(helmet ? 'dink' : 'crunch'), { rate: vary(0.03) });
  }

  bulletWhiz(pos) {
    if (!this._rl('whiz', 0.05, 2)) return;
    const v = this._voice(pos, false, { gain: 0.23, dur: 0.3, ref: 1.5, roll: 1.5, max: 25, prio: 1.8 });
    if (v) this._play(v, this._sfx('whiz'), { rate: vary(0.08) });
  }

  casing(pos, type = 'pistol') {
    const t = CASE[type] ? type : type === 'shotgun' ? 'shell' : 'pistol';
    if (!this._rl('case', 0.03, 3)) return;
    const v = this._voice(pos, false, { gain: 0.015 * rand(0.8, 1), dur: 0.75, ref: 1.5, roll: 1.3, max: 20, hrtf: false, prio: 0.7 });
    if (v) this._play(v, this._casingBuf(t), { rate: vary(0.04), at: rand(0, 0.01) });
  }

  hitMarker(headshot) {
    const v = this._voice(null, true, { gain: headshot ? 0.48 : 0.32, dur: 0.15, prio: 2 });
    if (v) this._play(v, this._sfx(headshot ? 'tickHead' : 'tick'), { rate: vary(0.02) });
  }

  hurt() {
    const v = this._voice(null, true, { gain: 0.79, dur: 0.35, prio: 2 });
    if (v) this._play(v, this._sfx('hurt'));
  }

  // Own helmet takes a round: loud dink inside your head.
  helmetHit() {
    const v = this._voice(null, true, { gain: 0.18, dur: 1.2, prio: 3, send: 0.05 });
    if (v) this._play(v, this._sfx('ownDink'), { rate: vary(0.02) });
  }

  kill() {
    const v = this._voice(null, true, { gain: 0.36, dur: 0.4, send: 0.04, prio: 2 });
    if (v) this._play(v, this._sfx('kill'));
  }

  // ---------- movement ----------

  // surface: 'concrete' | 'metal' | 'wood' | 'dirt'. Readable and directional out to ~25 m.
  footstep(pos, local, surface = 'concrete') {
    let s = surface;
    if (s !== 'concrete' && s !== 'metal' && s !== 'wood' && s !== 'dirt') {
      s = s === 'ground' || s === 'sand' || s === 'grass' || s === 'mud' ? 'dirt' : s === 'steel' || s === 'grate' ? 'metal' : 'concrete';
    }
    const v = this._voice(pos, local, {
      gain: (local ? 0.22 : 0.54) * STEP_LVL[s] * rand(0.85, 1), dur: 0.5, ref: 2.5, roll: 0.55, max: 42,
      muffle: 60, mmin: 2200, send: 0.03, far: 0.04, prio: 1.5,
    });
    if (v) this._play(v, this._stepBuf(s), { rate: vary(0.04) });
  }

  jump(pos, local) {
    const v = this._voice(pos, local, { gain: local ? 0.115 : 0.18, dur: 0.35, ref: 2.5, roll: 0.8, max: 30, muffle: 50 });
    if (v) this._play(v, this._sfx('jump'), { rate: vary(0.05) });
  }

  land(pos, local, strength = 0.5) {
    const s = clamp(Number(strength) || 0, 0, 1);
    const k = s < 0.34 ? 0 : s < 0.67 ? 1 : 2;
    const buf = this._bank('land:' + k, 2, () => this._buf(bakeLand(this.ctx.sampleRate, k / 2)));
    const v = this._voice(pos, local, {
      gain: (local ? 0.29 : 0.45) * (0.6 + s * 0.6), dur: 0.45, ref: 2.5, roll: 0.7, max: 40,
      muffle: 55, mmin: 1800, send: 0.04, prio: 1.4,
    });
    if (v) this._play(v, buf, { rate: vary(0.04) });
  }

  // ---------- bomb ----------

  bombBeep(pos, urgency = 0) {
    const u = clamp(Number(urgency) || 0, 0, 1);
    const v = this._voice(pos, false, { gain: 0.5 + u * 0.15, dur: 0.2, ref: 7, roll: 0.9, max: 70, prio: 3, send: 0.06, muffle: 90, mmin: 1500 });
    if (v) this._beep(v, { freq: 2050 * (1 + u * 0.06), len: 0.1 - u * 0.04, gain: 0.04 });
  }

  plantStart(pos) {
    const v = this._voice(pos, false, { gain: 0.16, dur: 2, ref: 5, roll: 1, max: 45, prio: 2, send: 0.04, muffle: 60, mmin: 1500 });
    if (!v) return;
    this._play(v, this._sfx('rustle'), { gain: 0.6 });
    // Code entry: key clicks with quiet dual-tone confirmations.
    const keys = [[697, 1209], [697, 1336], [770, 1477], [852, 1209], [941, 1336], [770, 1209], [852, 1477]];
    for (let i = 0; i < 7; i++) {
      const at = 0.3 + i * 0.19 + rand(-0.02, 0.02);
      this._play(v, this._sfx('key'), { at, gain: 0.7 });
      const [lo, hi] = pick(keys);
      this._beep(v, { freq: lo, at: at + 0.006, len: 0.07, gain: 0.035, wave: 'sine' });
      this._beep(v, { freq: hi, at: at + 0.006, len: 0.07, gain: 0.035, wave: 'sine' });
    }
  }

  plantDone(pos) {
    const v = this._voice(pos, false, { gain: 0.16, dur: 0.8, ref: 7, roll: 0.9, max: 60, prio: 3, send: 0.06, muffle: 80, mmin: 1500 });
    if (!v) return;
    this._play(v, this._part('rifle_heavy', 'boltDown'), { gain: 0.8 });
    this._beep(v, { freq: 1900, at: 0.14, len: 0.06, gain: 0.12 });
    this._beep(v, { freq: 2450, at: 0.22, len: 0.12, gain: 0.12 });
  }

  defuseStart(pos) {
    const v = this._voice(pos, false, { gain: 0.16, dur: 1.2, ref: 5, roll: 1, max: 45, prio: 2.5, send: 0.04, muffle: 60, mmin: 1500 });
    if (!v) return;
    this._play(v, this._part('pistol', 'boltUp'), { gain: 0.7 }); // kit clasp
    this._play(v, this._sfx('rustle'), { at: 0.05, gain: 0.5 });
    this._beep(v, { freq: 950, at: 0.12, len: 0.05, gain: 0.1, wave: 'sine' });
    this._play(v, this._sfx('snip'), { at: 0.4 });
    this._play(v, this._sfx('key'), { at: 0.62, gain: 0.6 });
    this._play(v, this._sfx('snip'), { at: 0.85, gain: 0.8 });
  }

  defused(pos) {
    const v = this._voice(pos, false, { gain: 0.16, dur: 1.4, ref: 9, roll: 0.8, max: 80, prio: 3, send: 0.08, muffle: 90, mmin: 1500 });
    if (!v) return;
    // Electronics power down, the relay drops, then a quiet confirmation.
    this._tone(v, { type: 'triangle', freq: 1800, to: 260, dur: 0.42, gain: 0.25, attack: 0.004, glide: 0.42 });
    this._play(v, this._part('rifle', 'boltDown'), { at: 0.46, gain: 0.6 });
    this._beep(v, { freq: 1320, at: 0.7, len: 0.08, gain: 0.1, wave: 'sine' });
    this._beep(v, { freq: 1760, at: 0.8, len: 0.16, gain: 0.1, wave: 'sine' });
  }

  // Does not trigger tinnitus by itself: call tinnitus(strength) for nearby blasts.
  explosion(pos) {
    const v = this._voice(pos, false, {
      gain: 0.6, dur: 3, ref: 30, roll: 1, max: 400, prio: 5, send: 0.4, echo: 0.6, farEcho: 0.3, muffle: 80, mmin: 600,
    });
    if (v) this._play(v, this._sfx('blast'), { rate: vary(0.03) });
    const d = isPos(pos) ? dist(pos, this.listener.pos) : 0;
    const r = this._voice(null, true, { gain: 0.5 * (0.35 + 0.65 * clamp(1 - d / 140, 0, 1)), dur: 4.6, prio: 5, echo: 0.1 });
    if (r) this._play(r, this._sfx('rumble'));
  }

  // ---------- rounds / UI ----------

  roundStart() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.14, dur: 1.6, send: 0.1 });
    if (!v) return;
    this._noise(v, { type: 'pink', filter: 'bandpass', freq: 300, to: 2200, q: 0.9, attack: 0.24, dur: 0.06, gain: 0.22 });
    this._tone(v, { freq: 110, to: 55, at: 0.26, dur: 0.14, gain: 0.35 });
    this._play(v, this._sfx('uiClick'), { at: 0.26, gain: 0.8 });
    this._play(v, this._pluck(587.33), { at: 0.26, gain: 0.5 });
    this._play(v, this._pluck(880), { at: 0.38, gain: 0.45 });
  }

  roundEnd(win) {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.14, dur: 2, send: 0.14 });
    if (!v) return;
    if (win) {
      [523.25, 659.25, 783.99].forEach((f, i) => this._play(v, this._pluck(f), { at: i * 0.09, gain: 0.5 }));
      this._play(v, this._pluck(1046.5), { at: 0.27, gain: 0.42 });
      this._tone(v, { freq: 2093, at: 0.27, dur: 0.5, gain: 0.05, attack: 0.004 });
    } else {
      this._play(v, this._pluck(329.63), { gain: 0.55 });
      this._play(v, this._pluck(261.63), { at: 0.22, gain: 0.55 });
      this._tone(v, { freq: 92, to: 60, at: 0.22, dur: 0.3, gain: 0.3 });
    }
  }

  matchEnd(win) {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.14, dur: 3.6, send: 0.2 });
    if (!v) return;
    if (win) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this._play(v, this._pluck(f), { at: i * 0.1, gain: 0.45 }));
      this._pad(v, [261.63, 329.63, 392, 523.25], 0.45, 2.6, 0.28, 2400);
    } else {
      [440, 349.23, 293.66].forEach((f, i) => this._play(v, this._pluck(f), { at: i * 0.24, gain: 0.5 }));
      this._pad(v, [146.83, 174.61, 220], 0.6, 2.6, 0.3, 1100);
      this._tone(v, { freq: 80, to: 45, at: 0.6, dur: 0.6, gain: 0.3 });
    }
  }

  uiClick() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.4, dur: 0.1 });
    if (v) this._play(v, this._sfx('uiClick'), { rate: vary(0.02) });
  }

  uiHover() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.35, dur: 0.06, prio: 0.5 });
    if (v) this._play(v, this._sfx('uiHover'), { rate: vary(0.03) });
  }

  buy() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.2, dur: 0.5 });
    if (v) this._play(v, this._sfx('buy'));
  }

  deny() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.16, dur: 0.3 });
    if (v) this._play(v, this._sfx('deny'));
  }

  // ---------- ink system ----------

  inkScribbleStart() {
    if (this.scribble) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Felt marker on paper: a noise band that wobbles with the stroke direction, chopped
    // into strokes, plus a faint felt-tip squeak.
    const src = ctx.createBufferSource();
    src.buffer = this.noise.white;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 1.6;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const sq = ctx.createBiquadFilter();
    sq.type = 'bandpass';
    sq.frequency.value = 1900;
    sq.Q.value = 14;
    const sqg = ctx.createGain();
    sqg.gain.value = 0.8;
    const lfoF = ctx.createOscillator();
    lfoF.frequency.value = 4.3;
    const lfoFGain = ctx.createGain();
    lfoFGain.gain.value = 900;
    const lfoSq = ctx.createGain();
    lfoSq.gain.value = 260;
    lfoF.connect(lfoFGain).connect(bp.frequency);
    lfoF.connect(lfoSq).connect(sq.frequency);
    const lfoA = ctx.createOscillator();
    lfoA.type = 'triangle';
    lfoA.frequency.value = 7.3;
    const lfoAGain = ctx.createGain();
    lfoAGain.gain.value = 0.4;
    const am = ctx.createGain();
    am.gain.value = 0.55;
    lfoA.connect(lfoAGain).connect(am.gain);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.05, t + 0.04);
    src.connect(bp).connect(hp).connect(am);
    src.connect(sq).connect(sqg).connect(am);
    am.connect(out).connect(this.bus.world);
    src.start(t, Math.random());
    lfoF.start(t);
    lfoA.start(t);
    this.scribble = { out, nodes: [src, lfoF, lfoA] };
  }

  inkScribbleStop() {
    const s = this.scribble;
    if (!s) return;
    this.scribble = null;
    const t = this.ctx.currentTime;
    s.out.gain.cancelScheduledValues(t);
    s.out.gain.setTargetAtTime(0, t, 0.03);
    for (const n of s.nodes) {
      try { n.stop(t + 0.2); } catch { /* already stopped */ }
    }
    setTimeout(() => s.out.disconnect(), 400);
  }

  inkSplat(pos) {
    const v = this._voice(pos, false, { gain: 0.17, dur: 0.75, ref: 3, roll: 1, max: 50, muffle: 40, send: 0.08 });
    if (v) this._play(v, this._sfx('splat'), { rate: vary(0.06) });
  }

  inkWallBreak(pos) {
    const v = this._voice(pos, false, { gain: 0.09, dur: 0.65, ref: 3, roll: 1, max: 50, muffle: 40, send: 0.06 });
    if (v) this._play(v, this._sfx('rip'), { rate: vary(0.05) });
  }

  spray(pos, local) {
    const v = this._voice(pos, local, { gain: local ? 0.12 : 0.14, dur: 0.9, ref: 2.5, roll: 1.1, max: 30, muffle: 40 });
    if (v) this._play(v, this._sfx('spray'), { rate: vary(0.03) });
  }

  panelCut() {
    const v = this._voice(null, true, { bus: 'ui', gain: 0.55, dur: 0.85, send: 0.15 });
    if (v) this._play(v, this._sfx('panel'));
  }

  // ---------- tinnitus ----------

  // After a nearby blast: high ring fading over ~strength*3 s while the rest of the mix is
  // muffled by a master lowpass that sweeps back open. Repeated calls re-trigger cleanly.
  tinnitus(strength = 1) {
    const s = clamp(Number(strength) || 0, 0, 1);
    if (s < 0.03) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const ny = ctx.sampleRate / 2;
    const dur = Math.max(0.6, s * 3);
    const cur = this._mufAt(t);
    const low = Math.min(cur, 3000 * Math.pow(0.1, s));
    const t1 = t + 0.04, t2 = t1 + 0.25 * s, t3 = t2 + dur;
    const f = this.muffle.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(cur, t);
    f.exponentialRampToValueAtTime(low, t1);
    f.setValueAtTime(low, t2);
    f.exponentialRampToValueAtTime(ny, t3);
    this.muf = { t0: t, t1, t2, t3, cur, low, ny };
    const mg = this.mix.gain;
    mg.cancelScheduledValues(t);
    mg.setTargetAtTime(1 - 0.4 * s, t, 0.012);
    mg.setTargetAtTime(1, t2, dur / 3);

    // The ring sits outside the muffle ("inside your head"): two close sines that beat slowly.
    this._ringStop(t);
    const fr = rand(3700, 4300);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.021 * s, t + 0.06);
    g.gain.setValueAtTime(0.021 * s, t2);
    g.gain.exponentialRampToValueAtTime(0.0001, t3 + 0.3);
    const fade = ctx.createGain();
    g.connect(fade).connect(this.master);
    const oscs = [[fr, 1], [fr * 1.0017, 0.35]].map(([hz, a]) => {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(hz, t);
      o.frequency.linearRampToValueAtTime(hz * 0.985, t3 + 0.3);
      const og = ctx.createGain();
      og.gain.value = a;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t3 + 0.35);
      return o;
    });
    this.ring = { fade, oscs, end: t3 + 0.35 };
    setTimeout(() => {
      if (this.ring?.fade === fade) this.ring = null;
      try { fade.disconnect(); } catch { /* already gone */ }
    }, (t3 + 0.5 - t) * 1000);
  }

  _ringStop(t) {
    const r = this.ring;
    this.ring = null;
    if (!r || t >= r.end) return;
    r.fade.gain.setValueAtTime(1, t);
    r.fade.gain.linearRampToValueAtTime(0, t + 0.05);
    for (const o of r.oscs) {
      try { o.stop(t + 0.08); } catch { /* already stopped */ }
    }
  }

  // Current muffle cutoff, evaluated from the schedule we set (portable across browsers).
  _mufAt(t) {
    const m = this.muf;
    if (!m || t >= m.t3) return this.ctx.sampleRate / 2;
    if (t <= m.t0) return m.cur;
    if (t < m.t1) return m.cur * Math.pow(m.low / m.cur, (t - m.t0) / (m.t1 - m.t0));
    if (t < m.t2) return m.low;
    return m.low * Math.pow(m.ny / m.low, (t - m.t2) / (m.t3 - m.t2));
  }
}

// Make every public method a safe no-op before unlock() and never throw.
for (const name of Object.getOwnPropertyNames(GameAudio.prototype)) {
  if (name === 'constructor' || name.startsWith('_')) continue;
  const fn = GameAudio.prototype[name];
  if (typeof fn !== 'function') continue;
  const alwaysRun = name === 'unlock' || name === 'setVolume' || name === 'setListener';
  GameAudio.prototype[name] = function (...args) {
    if (!alwaysRun && !this.ctx) return undefined;
    try {
      return fn.apply(this, args);
    } catch (err) {
      if (globalThis.console) console.warn(`[GameAudio] ${name} failed:`, err);
      return undefined;
    }
  };
}
