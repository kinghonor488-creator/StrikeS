// Gun modelling kit. Guns are authored in a side view, in centimetres:
//   +x toward the muzzle, +y up, z = sideways (+z = the gun's right side).
// World convention of the finished model: forward is -Z, origin at the firing grip.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CM = 0.01;

// --- materials ------------------------------------------------------------------
// Every gun material shares one surface shader patch ("finish"):
//  * object-space triplanar grunge: tone and roughness variation, fine scratches
//  * curvature-driven edge wear: bevels and small radii (|dN|/|dP| from screen derivatives)
//    show the bare material underneath, like handled steel or rubbed-through paint
// so even simple extruded shapes read as worn, real objects.

/** Tileable 3-channel noise: R = broad grunge, G = fine speckle, B = scratches. */
function grungeTexture() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const img = g.createImageData(N, N);
  const rnd = mulberry(7);
  const lattice = (cells) => { const a = []; for (let i = 0; i < cells * cells; i++) a.push(rnd()); return a; };
  const octave = (cells) => {
    const L = lattice(cells);
    return (x, y) => { // periodic smooth value noise
      const fx = x / N * cells, fy = y / N * cells;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const at = (i, j) => L[((j % cells + cells) % cells) * cells + ((i % cells + cells) % cells)];
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const o = [octave(4), octave(8), octave(16), octave(32), octave(64), octave(128)];
  const scratch = new Float32Array(N * N);
  for (let k = 0; k < 90; k++) { // thin straight scratches, wrapped
    let x = rnd() * N, y = rnd() * N;
    const a = rnd() * Math.PI, len = 8 + rnd() * 60, v = 0.3 + rnd() * 0.7;
    for (let t = 0; t < len; t += 0.5) {
      const px = ((Math.round(x + Math.cos(a) * t) % N) + N) % N, py = ((Math.round(y + Math.sin(a) * t) % N) + N) % N;
      scratch[py * N + px] = Math.max(scratch[py * N + px], v * (1 - t / len * 0.5));
    }
  }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const broad = o[0](x, y) * 0.45 + o[1](x, y) * 0.3 + o[2](x, y) * 0.25;
    const fine = o[3](x, y) * 0.3 + o[4](x, y) * 0.35 + o[5](x, y) * 0.35;
    const i = (y * N + x) * 4;
    img.data[i] = broad * 255; img.data[i + 1] = fine * 255; img.data[i + 2] = scratch[y * N + x] * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = 4;
  return t;
}
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

let grunge = null;
/**
 * Apply the shared finish to a material.
 * wear: 0..1 edge wear strength; wearColor/wearRough/wearMetal: the bare surface underneath;
 * grime: tone/roughness variation; scale: grunge tiles per metre.
 */
function finish(mat, { wear = 0.6, wearColor = '#8b8f95', wearRough = 0.3, wearMetal = null, grime = 0.5, scratches = 0.5, scale = 20 } = {}) {
  grunge ||= grungeTexture();
  const u = {
    uGrunge: { value: grunge }, uScale: { value: scale }, uWear: { value: wear }, uGrime: { value: grime }, uScratch: { value: scratches },
    uWearColor: { value: new THREE.Color(wearColor) }, uWearRough: { value: wearRough }, uWearMetal: { value: wearMetal ?? mat.metalness ?? 0 },
  };
  mat.userData.finish = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nvarying vec3 vObjNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;\nvObjNrm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vObjPos; varying vec3 vObjNrm;
uniform sampler2D uGrunge; uniform float uScale, uWear, uGrime, uScratch, uWearRough, uWearMetal; uniform vec3 uWearColor;
vec4 triGrunge(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z + 1e-5);
  return texture2D(uGrunge, p.yz) * w.x + texture2D(uGrunge, p.xz) * w.y + texture2D(uGrunge, p.xy) * w.z;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec4 gG = triGrunge(vObjPos * uScale, normalize(vObjNrm));
vec4 gF = triGrunge(vObjPos * uScale * 5.0, normalize(vObjNrm));
// curvature: how fast the normal turns per metre of surface
vec3 gN = normalize(vNormal);
float gCurv = length(fwidth(gN)) / max(length(fwidth(vViewPosition)), 1e-6);
float gEdge = smoothstep(160.0, 600.0, gCurv) * (1.0 - 0.6 * smoothstep(2000.0, 6000.0, gCurv)); // tiny teeth/pins stay mostly coated
gEdge *= smoothstep(0.25, 0.65, gG.r * 0.6 + gF.g * 0.6); // wear comes off in patches, not a clean line
gEdge = clamp(gEdge * uWear * 1.25, 0.0, 1.0);
float gScr = smoothstep(0.35, 0.9, gF.b) * uScratch;
diffuseColor.rgb *= 1.0 + (gG.r - 0.5) * 0.24 * uGrime + (gF.g - 0.5) * 0.22 * uGrime;
diffuseColor.rgb = mix(diffuseColor.rgb, uWearColor, max(gEdge, gScr * 0.55));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor * (1.0 + (gG.r - 0.5) * 0.45 * uGrime + (gF.g - 0.5) * 0.35 * uGrime), 0.04, 1.0);
roughnessFactor = mix(roughnessFactor, uWearRough, max(gEdge, gScr * 0.7));`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
metalnessFactor = mix(metalnessFactor, uWearMetal, gEdge);`);
  };
  mat.customProgramCacheKey = () => 'gunfinish';
  return mat;
}

function woodTexture() {
  // walnut: wavy growth rings with pores, darker figure streaks, two-tone heart/sap
  const W = 1024, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = mulberry(11);
  const grd = g.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#5a2e16'); grd.addColorStop(0.45, '#68381c'); grd.addColorStop(0.7, '#522812'); grd.addColorStop(1, '#5f3218');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 230; i++) {
    const y = rnd() * H, amp = 2 + rnd() * 7, f = 0.004 + rnd() * 0.01, ph = rnd() * 6;
    const dark = rnd() < 0.7;
    g.strokeStyle = dark ? `rgba(${38 + rnd() * 20},${16 + rnd() * 10},6,${0.12 + rnd() * 0.3})` : `rgba(160,98,52,${0.06 + rnd() * 0.12})`;
    g.lineWidth = 0.5 + rnd() * (dark ? 2.6 : 1.4);
    g.beginPath();
    for (let x = -10; x <= W + 10; x += 8) {
      const yy = y + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.3 + ph * 2) * amp * 0.25;
      if (x < 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  for (let i = 0; i < 2600; i++) { // pores
    g.fillStyle = `rgba(30,12,4,${0.15 + rnd() * 0.25})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 0.6 + rnd() * 0.6);
  }
  for (let k = 0; k < 4; k++) { // knots / cathedral figure
    const x = rnd() * W, y = rnd() * H;
    for (let r = 2; r < 30; r += 2.5) {
      g.strokeStyle = `rgba(40,18,6,${0.25 - r * 0.006})`; g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(x, y, r * 3.2, r * 0.8, 0, 0, Math.PI * 2); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 40, 1 / 10); // extruded UVs are in cm: one grain tile per ~40 cm
  t.anisotropy = 8;
  return t;
}

const std = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);
let woodMap = null;
const matCache = new Map();

/** Shared PBR materials for guns (all carry the worn-finish shader). */
export const GM = {
  // phosphate / blued steel: dark grey-blue, bare steel shows through on edges
  get steel() { return cached('steel', () => finish(std({ color: '#2a2c30', metalness: 0.82, roughness: 0.42 }), { wear: 0.7, wearColor: '#9a9ea4', wearRough: 0.28, wearMetal: 1, grime: 0.6 })); },
  get blued() { return cached('blued', () => finish(std({ color: '#1d2027', metalness: 0.9, roughness: 0.3 }), { wear: 0.6, wearColor: '#a3a7ad', wearRough: 0.22, wearMetal: 1, grime: 0.45 })); },
  get park() { return cached('park', () => finish(std({ color: '#36383b', metalness: 0.62, roughness: 0.62 }), { wear: 0.75, wearColor: '#8f9399', wearRough: 0.3, wearMetal: 1, grime: 0.7, scratches: 0.7 })); },
  // hard-anodised aluminium: matte, wears to bright silver
  get alu() { return cached('alu', () => finish(std({ color: '#2c2e32', metalness: 0.55, roughness: 0.55 }), { wear: 0.7, wearColor: '#b7bbc1', wearRough: 0.25, wearMetal: 1, grime: 0.5 })); },
  get bright() { return cached('bright', () => finish(std({ color: '#b9bec7', metalness: 1.0, roughness: 0.24 }), { wear: 0.2, wearColor: '#e1e4e8', wearRough: 0.12, grime: 0.5, scratches: 0.8 })); },
  // glass-filled polymer: slightly stippled, wears to a greyer, smoother shine
  get polymer() { return cached('polymer', () => finish(std({ color: '#222326', metalness: 0.0, roughness: 0.7 }), { wear: 0.55, wearColor: '#4d4f54', wearRough: 0.42, wearMetal: 0, grime: 0.55, scale: 22 })); },
  get rubber() { return cached('rubber', () => finish(std({ color: '#161618', metalness: 0.0, roughness: 0.92 }), { wear: 0.2, wearColor: '#2a2a2d', wearRough: 0.8, wearMetal: 0, grime: 0.4 })); },
  get tan() { return cached('tan', () => finish(std({ color: '#9c8562', metalness: 0.0, roughness: 0.66 }), { wear: 0.5, wearColor: '#c7b28c', wearRough: 0.45, wearMetal: 0, grime: 0.6 })); },
  get olive() { return cached('olive', () => finish(std({ color: '#4f5638', metalness: 0.0, roughness: 0.64 }), { wear: 0.5, wearColor: '#7d8460', wearRough: 0.45, wearMetal: 0, grime: 0.6 })); },
  get brass() { return cached('brass', () => finish(std({ color: '#c9a04a', metalness: 1.0, roughness: 0.32 }), { wear: 0.2, wearColor: '#e8c878', wearRough: 0.2, grime: 0.5 })); },
  get dark() { return cached('dark', () => finish(std({ color: '#0e0f11', metalness: 0.25, roughness: 0.78 }), { wear: 0.2, wearColor: '#3a3c40', wearRough: 0.5, grime: 0.4 })); },
  get glass() { return cached('glass', () => std({ color: '#1a3346', metalness: 0.3, roughness: 0.04, envMapIntensity: 2.2 })); },
  // Soviet-style bakelite: glossy red-brown resin
  get bakelite() { return cached('bakelite', () => finish(phys({ color: '#5b2618', metalness: 0.0, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }), { wear: 0.5, wearColor: '#8a4430', wearRough: 0.25, wearMetal: 0, grime: 0.5 })); },
  get wood() {
    return cached('wood', () => {
      woodMap ||= woodTexture();
      // oiled walnut under a worn varnish
      return finish(phys({ color: '#ffffff', map: woodMap, metalness: 0.0, roughness: 0.55, clearcoat: 0.55, clearcoatRoughness: 0.35 }),
        { wear: 0.55, wearColor: '#a8693a', wearRough: 0.6, wearMetal: 0, grime: 0.5, scratches: 0.4 });
    });
  },
  paint(color, rough = 0.5) {
    return cached(`paint${color}${rough}`, () => {
      const base = new THREE.Color(color);
      const bare = base.clone().lerp(new THREE.Color('#a0a4aa'), 0.6); // paint rubbed through to metal
      return finish(std({ color, metalness: 0.1, roughness: rough }), { wear: 0.6, wearColor: '#' + bare.getHexString(), wearRough: 0.3, wearMetal: 0.8, grime: 0.55 });
    });
  },
  translucent(color) { return cached(`tr${color}`, () => std({ color, metalness: 0, roughness: 0.25, transparent: true, opacity: 0.75 })); },
};
function cached(k, make) { if (!matCache.has(k)) matCache.set(k, make()); return matCache.get(k); }

// --- shapes ------------------------------------------------------------------------
/**
 * Parse an SVG-like path in centimetres ("M x y L x y Q cx cy x y C c1x c1y c2x c2y x y Z").
 * The first closed subpath is the outline; following ones are cut out as holes.
 */
export function pathShape(d) {
  const tok = d.trim().split(/[\s,]+/);
  const subs = [];
  let cur = null, i = 0;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === 'M') { cur = new THREE.Path(); cur.moveTo(num(), num()); subs.push(cur); }
    else if (c === 'L') cur.lineTo(num(), num());
    else if (c === 'Q') cur.quadraticCurveTo(num(), num(), num(), num());
    else if (c === 'C') cur.bezierCurveTo(num(), num(), num(), num(), num(), num());
    else if (c === 'Z') cur.closePath();
    else throw new Error('bad path token ' + c);
  }
  const shape = new THREE.Shape(subs[0].getPoints(12));
  for (let k = 1; k < subs.length; k++) shape.holes.push(new THREE.Path(subs[k].getPoints(12)));
  return shape;
}

/** Extrude a side-view outline sideways (thickness in cm), bevelled, centred on the gun's mid-plane. */
export function slab(d, thick, bevel = 0.2) {
  const b = Math.min(bevel, thick * 0.3);
  const depth = Math.max(0.02, thick - 2 * b);
  const geo = new THREE.ExtrudeGeometry(pathShape(d), {
    depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 2, curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2); // shape x → -z (forward), extrusion → x (sideways)
  geo.scale(CM, CM, CM);
  return geo;
}

/** Cylinder along the bore axis starting at x, length len (cm). rFront is the muzzle-side radius. */
export function tube(r, len, rFront = r, seg = 20) {
  const g = new THREE.CylinderGeometry(rFront * CM, r * CM, len * CM, seg);
  g.rotateX(-Math.PI / 2); // +y (front) → -z
  g.translate(0, 0, -len * CM / 2);
  return g;
}

/** Turned part from [radius, x] pairs (x along the bore, starting at 0). */
export function lathe(pts, seg = 24) {
  const g = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r * CM, x * CM)), seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Rounded box: lx along the bore, ly up, tz sideways (cm). */
export function rbox(lx, ly, tz, r = 0.25) {
  const rr = Math.min(r, lx / 2 - 0.01, ly / 2 - 0.01, tz / 2 - 0.01);
  return new RoundedBoxGeometry(tz * CM, ly * CM, lx * CM, 2, Math.max(0.0001, rr) * CM);
}

export const box = (lx, ly, tz) => new THREE.BoxGeometry(tz * CM, ly * CM, lx * CM);
export const sphere = (r) => new THREE.SphereGeometry(r * CM, 14, 10);

// --- builder ------------------------------------------------------------------------
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler();

export class GunBuilder {
  constructor(id) {
    this.id = id;
    this.statics = new Map();  // material → geometries
    this.groups = {};          // movable sub-assemblies
    this.stickers = [];        // separate meshes that accept stickers
    this.anchors = {};
  }

  /** Movable group (mag, slide, bolt, pump …) pivoting at (x, y, z) cm. */
  group(name, x = 0, y = 0, z = 0) {
    const g = new THREE.Group();
    g.name = name;
    g.userData.pivot = new THREE.Vector3(z * CM, y * CM, -x * CM);
    g.position.copy(g.userData.pivot);
    g.userData.rest = g.position.clone();
    this.groups[name] = g;
    return g;
  }

  /**
   * Place a geometry. x/y/z in cm (side view), pitch = rotation in the side view (rad, CCW),
   * opts: { yaw, roll, group, sticker, mirror (also place at -z) }.
   */
  add(geo, mat, x = 0, y = 0, z = 0, pitch = 0, opts = {}) {
    const place = (zz) => {
      tmpE.set(pitch, opts.yaw || 0, opts.roll || 0, 'XYZ');
      tmpQ.setFromEuler(tmpE);
      tmpM.compose(new THREE.Vector3(zz * CM, y * CM, -x * CM), tmpQ, new THREE.Vector3(1, 1, 1));
      if (opts.group || opts.sticker) {
        const m = new THREE.Mesh(geo, mat);
        m.applyMatrix4(tmpM);
        if (opts.group) {
          const g = this.groups[opts.group];
          m.position.sub(g.userData.pivot);
          g.add(m);
        } else this.stickers.push(m);
        if (opts.sticker) m.userData.sticker = true;
        return m;
      }
      const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(tmpM);
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!this.statics.has(mat)) this.statics.set(mat, []);
      this.statics.get(mat).push(g);
      return null;
    };
    const m = place(z);
    if (opts.mirror) place(-z);
    return m;
  }

  anchor(name, x, y, z = 0) { this.anchors[name] = new THREE.Vector3(z * CM, y * CM, -x * CM); }

  /** Merge static parts per material and move the firing grip to the origin. */
  build() {
    const gun = new THREE.Group();
    gun.name = 'gun:' + this.id;
    const body = new THREE.Group();
    gun.add(body);
    for (const [mat, geos] of this.statics) {
      const merged = mergeGeometries(geos.map((g) => {
        for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
        return g;
      }), false);
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      body.add(m);
    }
    for (const m of this.stickers) { m.castShadow = true; body.add(m); }
    for (const g of Object.values(this.groups)) {
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      body.add(g);
    }
    const grip = this.anchors.grip || new THREE.Vector3();
    body.position.copy(grip).negate();
    const local = (name) => this.anchors[name] ? this.anchors[name].clone().sub(grip) : null;

    const muzzle = new THREE.Object3D();
    muzzle.position.copy(local('muzzle') || new THREE.Vector3(0, 0, -0.3));
    gun.add(muzzle);
    const eject = new THREE.Object3D();
    eject.position.copy(local('eject') || new THREE.Vector3(0.02, 0.05, -0.1));
    gun.add(eject);

    gun.userData = {
      muzzle, eject,
      support: local('support'),
      sight: local('sight'),
      butt: this.anchors.butt ? this.anchors.butt.z - grip.z : 0.1, // metres behind the grip
      stickerParts: this.stickers,
      parts: this.groups,
    };
    return gun;
  }
}

// --- common details ------------------------------------------------------------------------
/** Picatinny rail from x0 to x1 (cm) with its top at y. */
export function rail(b, x0, x1, y, mat = GM.alu, width = 2.1) {
  const len = x1 - x0;
  b.add(rbox(len, 0.7, width, 0.15), mat, x0 + len / 2, y - 0.75);
  const n = Math.floor(len / 1.0);
  const tooth = box(0.5, 0.4, width - 0.2);
  for (let i = 0; i < n; i++) b.add(tooth, mat, x0 + 0.5 + i * (len / n), y - 0.2);
}

export function screw(b, x, y, side = 2, mat = GM.bright, r = 0.28) {
  const g = new THREE.CylinderGeometry(r * CM, r * CM, 0.2 * CM, 10).rotateZ(Math.PI / 2);
  b.add(g, mat, x, y, side);
  b.add(g, mat, x, y, -side);
}

export function trigger(b, x, y, guardLen = 7, mat = GM.steel, triggerMat = GM.steel) {
  // guard: a ring under the receiver
  b.add(slab(`M ${x - 1} ${y} L ${x + guardLen} ${y} L ${x + guardLen} ${y - 0.6} Q ${x + guardLen - 0.6} ${y - 3.6} ${x + guardLen - 3} ${y - 3.6} L ${x + 1} ${y - 3.6} Q ${x - 1.2} ${y - 3.2} ${x - 1} ${y - 1}  Z
              M ${x - 0.1} ${y - 0.4} L ${x + guardLen - 0.8} ${y - 0.4} Q ${x + guardLen - 1.2} ${y - 2.8} ${x + guardLen - 3.2} ${y - 2.8} L ${x + 1.2} ${y - 2.8} Q ${x - 0.2} ${y - 2.5} ${x - 0.1} ${y - 1.1} Z`, 1.0, 0.12), mat);
  b.add(slab(`M ${x + 2.6} ${y} L ${x + 3.5} ${y} Q ${x + 3.4} ${y - 1.4} ${x + 2.6} ${y - 2.4} L ${x + 2.2} ${y - 2.2} Q ${x + 2.8} ${y - 1.2} ${x + 2.6} ${y} Z`, 0.6, 0.1), triggerMat);
}

/** Classic front sight post with protective ears. */
export function frontSight(b, x, y, h = 2.4, mat = GM.steel) {
  b.add(rbox(1.6, h, 2.2, 0.2), mat, x, y + h / 2);
  b.add(box(0.5, h * 0.9, 0.4), mat, x, y + h * 0.9);
  b.add(rbox(1.4, h * 0.8, 0.35, 0.1), mat, x, y + h, 1.0, 0, { mirror: true });
}

export function rearSight(b, x, y, mat = GM.steel) {
  b.add(rbox(2.2, 1.3, 2.4, 0.25), mat, x, y + 0.65);
  b.add(rbox(1.2, 1.2, 0.6, 0.15), mat, x, y + 1.5, 0.75, 0, { mirror: true });
}

/** Telescopic sight: tube + bells + turrets + lenses, centred on the bore line at height y. */
export function scope(b, x0, len, y, r = 1.55, bell = 2.4, mat = GM.blued) {
  b.add(lathe([[0, 0], [r * 1.25, 0], [r * 1.25, 1.2], [r, 2.6], [r, len - 6], [bell * 0.82, len - 3.6], [bell, len - 1.2], [bell, len], [0, len]], 28), mat, x0, y);
  b.add(tube(bell * 0.9, 0.3, bell * 0.9, 28), GM.glass, x0 + len - 0.25, y);
  b.add(tube(r * 1.15, 0.3, r * 1.15, 24), GM.glass, x0 - 0.05, y);
  // turrets
  const turret = new THREE.CylinderGeometry(0.9 * CM, 0.95 * CM, 1.6 * CM, 16);
  b.add(turret, mat, x0 + len * 0.45, y + r + 0.6);
  b.add(turret.clone().rotateX(Math.PI / 2).rotateY(Math.PI / 2), mat, x0 + len * 0.45, y, r + 0.6);
  // rings
  for (const xx of [x0 + 3.5, x0 + len - 7.5]) {
    b.add(rbox(1.4, r * 2 + 1.2, r * 2 + 0.9, 0.3), GM.steel, xx, y - 0.2);
    b.add(rbox(1.4, 1.8, 2.0, 0.2), GM.steel, xx, y - r - 1.2);
  }
}

/** Muzzle device from x (cm) on the bore at height y. style: 'brake' | 'flash' | 'cone' | 'suppressor'. */
export function muzzle(b, x, y, style = 'flash', r = 1.0, mat = GM.steel) {
  if (style === 'suppressor') {
    b.add(lathe([[0, 0], [r * 1.6, 0], [r * 1.8, 0.8], [r * 1.8, 16], [r * 1.5, 17], [0.5, 17]], 24), mat, x, y);
    for (let i = 0; i < 3; i++) b.add(lathe([[r * 1.82, 0], [r * 1.82, 0.4]], 24), GM.dark, x + 3 + i * 5, y);
    return 17;
  }
  if (style === 'brake') {
    b.add(lathe([[0, 0], [r * 1.25, 0], [r * 1.3, 0.5], [r * 1.3, 5.5], [r * 1.1, 6], [0.4, 6]], 20), mat, x, y);
    for (let i = 0; i < 3; i++) b.add(box(0.6, 0.9, r * 2.7), GM.dark, x + 1.6 + i * 1.4, y);
    return 6;
  }
  if (style === 'cone') {
    b.add(lathe([[0, 0], [r * 1.05, 0], [r * 1.45, 4], [r * 1.2, 4.3], [0.4, 4.3]], 20), mat, x, y);
    return 4.3;
  }
  // birdcage flash hider
  b.add(lathe([[0, 0], [r * 1.15, 0], [r * 1.15, 4.4], [r * 0.9, 4.6], [0.4, 4.6]], 20), mat, x, y);
  for (let i = 0; i < 3; i++) b.add(box(2.6, 0.35, r * 2.4), GM.dark, x + 2.6, y + (i - 1) * r * 0.7);
  return 4.6;
}

export function swivel(b, x, y, mat = GM.steel) {
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14), mat, x, y);
}
