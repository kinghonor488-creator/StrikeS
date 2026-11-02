// Turns MAP data into a believable sunny street block: PBR ground zones, storeyed
// facades with trims and street furniture, props, murals — plus collision and nav.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { texSet, facadeBay } from '../render/pbrTextures.js';
import { LAYER_FX } from '../render/renderer.js';
import { World, Box } from './world.js';
import { NavGrid } from './nav.js';
import { mural, poster, siteStencil, arrowSign, shopSign } from './streetArt.js';

const BLOCK = 2;     // building footprint grid (m)
const STOREY = 3;    // storey height (m)
const BAY = 2.4;     // nominal window bay width (m)

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- materials
const matCache = new Map();
function surface(kind, opts = {}, extra = {}) {
  const key = kind + JSON.stringify(opts) + JSON.stringify(extra);
  if (matCache.has(key)) return matCache.get(key);
  const set = texSet(kind, opts);
  const mat = new THREE.MeshStandardMaterial({
    map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
    roughness: 1, metalness: extra.metalness ?? 0, color: extra.tint ?? 0xffffff,
  });
  const out = { mat, tile: set.tile };
  matCache.set(key, out);
  return out;
}
function facadeMat(opts) {
  const key = 'facade' + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const set = facadeBay(opts);
  const out = { mat: new THREE.MeshStandardMaterial({ map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap, roughness: 1 }), tile: set.tile };
  matCache.set(key, out);
  return out;
}
const plain = (color, rough = 0.7, metal = 0) => {
  const key = `plain${color}${rough}${metal}`;
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
  return matCache.get(key);
};
function stripes(a, b) {
  const key = `stripes${a}${b}`;
  if (matCache.has(key)) return matCache.get(key);
  const c = document.createElement('canvas');
  c.width = 128; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? a : b; g.fillRect(i * 16, 0, 16, 8); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
  matCache.set(key, m);
  return m;
}

// building looks: a facade for the upper storeys and a shopfront ground floor
const STYLES = [
  { wall: 'plaster', wallColor: '#e9d8b8', upper: 'tall', ground: 'shop', shutters: '#3f7a5a', trim: '#f2eadb' },
  { wall: 'plaster', wallColor: '#d9a07a', upper: 'square', ground: 'door', shutters: null, trim: '#efe3cf' },
  { wall: 'brick', wallColor: '#a4573f', upper: 'tall', ground: 'shop', shutters: null, trim: '#e6dccb' },
  { wall: 'stucco', wallColor: '#e7c46a', upper: 'tall', ground: 'door', shutters: '#2f5f8a', trim: '#f4ecdc' },
  { wall: 'plaster', wallColor: '#a9c4d6', upper: 'square', ground: 'shop', shutters: '#f1ede4', trim: '#f6f1e6' },
  { wall: 'stucco', wallColor: '#e3a493', upper: 'tall', ground: 'tall', shutters: '#5a3a2a', trim: '#f2e6d6' },
];

// ---------------------------------------------------------------- geometry helpers
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Quad centred at c with in-plane axes u (width) and v (height); normal = u × v. UV spans su × sv repeats. */
function quad(c, u, v, w, h, su, sv, u0 = 0, v0 = 0) {
  const hu = u.clone().multiplyScalar(w / 2), hv = v.clone().multiplyScalar(h / 2);
  const p = [
    c.clone().sub(hu).sub(hv), c.clone().add(hu).sub(hv), c.clone().add(hu).add(hv),
    c.clone().sub(hu).sub(hv), c.clone().add(hu).add(hv), c.clone().sub(hu).add(hv),
  ];
  const uvs = [[u0, v0], [u0 + su, v0], [u0 + su, v0 + sv], [u0, v0], [u0 + su, v0 + sv], [u0, v0 + sv]];
  const n = new THREE.Vector3().crossVectors(u, v).normalize();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((q) => [q.x, q.y, q.z]), 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(p.flatMap(() => [n.x, n.y, n.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs.flat(), 2));
  return g;
}

/** Box (non-indexed) with UVs tiled at tile=[tw, th] metres, positioned at (x, y, z) centre. */
function tiledBox(w, h, d, x, y, z, tile = [1, 1], rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / tile[0], uv.getY(i) * dims[f][1] / tile[1]);
  }
  const ng = g.toNonIndexed();
  if (rotY) ng.rotateY(rotY);
  ng.translate(x, y, z);
  return ng;
}

/** Collects static geometry per material and merges it into a few draw calls. */
class Batch {
  constructor() { this.buckets = new Map(); }
  add(mat, geo) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
  }
  flush(parent, { cast = true, receive = true } = {}) {
    for (const [mat, geos] of this.buckets) {
      // keep each merged mesh reasonably sized so frustum culling still helps
      for (let i = 0; i < geos.length; i += 400) {
        const merged = mergeGeometries(geos.slice(i, i + 400), false);
        merged.computeBoundingSphere();
        const m = new THREE.Mesh(merged, mat);
        m.castShadow = cast; m.receiveShadow = receive;
        parent.add(m);
      }
    }
    this.buckets.clear();
  }
}

// ---------------------------------------------------------------- build
export function buildMap(map, scene) {
  const rnd = mulberry(1337);
  const world = new World(map.bounds);
  const group = new THREE.Group();
  group.name = 'map';
  scene.add(group);
  const { minX, maxX, minZ, maxZ } = map.bounds;
  const W = maxX - minX, D = maxZ - minZ;
  const batch = new Batch();

  const inWalk = (x, z) => map.walk.some(([x1, z1, x2, z2]) => x > x1 && x < x2 && z > z1 && z < z2);

  // ---- ground zones (1 m cells → greedy quads per material)
  const zoneOf = (label) => {
    if (/点$/.test(label)) return 'site';
    if (/出生点|广场|连廊/.test(label)) return 'plaza';
    if (/巷|小道/.test(label)) return 'cobble';
    return 'street';
  };
  const ZONE_MAT = {
    street: surface('asphalt', { size: 512 }),
    plaza: surface('pavers', { size: 512 }),
    cobble: surface('cobble', { size: 512 }),
    site: surface('concrete', { size: 512 }),
  };
  const PRIORITY = { site: 4, plaza: 3, cobble: 2, street: 1 };
  const cells = new Array(W * D).fill(null);
  for (const [x1, z1, x2, z2, label] of map.walk) {
    const zone = zoneOf(label);
    for (let z = z1; z < z2; z++) for (let x = x1; x < x2; x++) {
      const i = (z - minZ) * W + (x - minX);
      if (!cells[i] || PRIORITY[zone] > PRIORITY[cells[i]]) cells[i] = zone;
    }
  }
  const used = new Uint8Array(W * D);
  for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = z * W + x;
    const zone = cells[i];
    if (!zone || used[i]) continue;
    let w = 1;
    while (x + w < W && cells[i + w] === zone && !used[i + w]) w++;
    let d = 1;
    grow: while (z + d < D) {
      for (let k = 0; k < w; k++) if (cells[(z + d) * W + x + k] !== zone || used[(z + d) * W + x + k]) break grow;
      d++;
    }
    for (let a = 0; a < d; a++) for (let k = 0; k < w; k++) used[(z + a) * W + x + k] = 1;
    const { mat, tile } = ZONE_MAT[zone];
    const x0 = minX + x, z0 = minZ + z;
    // world-anchored UVs so neighbouring quads line up
    batch.add(mat, quad(V(x0 + w / 2, 0, z0 + d / 2), V(1, 0, 0), V(0, 0, -1), w, d, w / tile[0], d / tile[1], x0 / tile[0], -(z0 + d) / tile[1]));
  }
  // apron under everything (seen past the buildings' feet)
  const asphalt = ZONE_MAT.street;
  batch.add(asphalt.mat, quad(V(0, -0.03, 0), V(1, 0, 0), V(0, 0, -1), 700, 700, 700 / asphalt.tile[0], 700 / asphalt.tile[1]));

  // ---- buildings: greedy-mesh solid 2 m cells into footprints
  const gw = W / BLOCK, gd = D / BLOCK;
  const solid = new Uint8Array(gw * gd);
  for (let iz = 0; iz < gd; iz++) for (let ix = 0; ix < gw; ix++) {
    solid[iz * gw + ix] = inWalk(minX + (ix + 0.5) * BLOCK, minZ + (iz + 0.5) * BLOCK) ? 0 : 1;
  }
  const taken = new Uint8Array(gw * gd);
  const rects = [];
  for (let iz = 0; iz < gd; iz++) for (let ix = 0; ix < gw; ix++) {
    const i = iz * gw + ix;
    if (!solid[i] || taken[i]) continue;
    let w = 1;
    while (ix + w < gw && w < 5 && solid[iz * gw + ix + w] && !taken[iz * gw + ix + w]) w++;
    let d = 1;
    grow: while (iz + d < gd && d < 5) {
      for (let k = 0; k < w; k++) if (!solid[(iz + d) * gw + ix + k] || taken[(iz + d) * gw + ix + k]) break grow;
      d++;
    }
    for (let a = 0; a < d; a++) for (let k = 0; k < w; k++) taken[(iz + a) * gw + ix + k] = 1;
    rects.push([minX + ix * BLOCK, minZ + iz * BLOCK, w * BLOCK, d * BLOCK]);
  }

  const roof = surface('roofTar', { size: 256 });
  const styleMats = STYLES.map((s, k) => ({
    s,
    // same wall seed/dirt for both storeys so the generator reuses one wall texture
    upper: facadeMat({ wall: s.wall, wallColor: s.wallColor, windowType: s.upper, shutters: s.shutters, dirt: 0.45, seed: 10 + k }),
    ground: facadeMat({ wall: s.wall, wallColor: s.wallColor, windowType: s.ground, shutters: null, dirt: 0.45, seed: 10 + k }),
    trim: surface('plaster', { color: s.trim, size: 256 }),
  }));
  const plinth = surface('concrete', { size: 256, dirt: 0.6 });
  const metalGrey = surface('metalPainted', { color: '#9aa3a8', size: 256 }, { metalness: 0.3 });
  const streetFaces = [];

  for (const [x, z, w, d] of rects) {
    const edge = x <= minX + 0.1 || z <= minZ + 0.1 || x + w >= maxX - 0.1 || z + d >= maxZ - 0.1;
    const storeys = edge ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3);
    const h = storeys * STOREY;
    const st = styleMats[Math.floor(rnd() * styleMats.length)];
    const cx = x + w / 2, cz = z + d / 2;
    world.add(new Box(x, 0, z, x + w, h + 0.6, z + d, 'building'));

    // four facades: ground floor (shops/doors) + upper storeys, whole bays per face
    const faces = [
      { n: V(1, 0, 0), u: V(0, 0, -1), len: d, c: V(x + w, 0, cz) },
      { n: V(-1, 0, 0), u: V(0, 0, 1), len: d, c: V(x, 0, cz) },
      { n: V(0, 0, 1), u: V(1, 0, 0), len: w, c: V(cx, 0, z + d) },
      { n: V(0, 0, -1), u: V(-1, 0, 0), len: w, c: V(cx, 0, z) },
    ];
    for (const f of faces) {
      const bays = Math.max(1, Math.round(f.len / BAY));
      batch.add(st.ground.mat, quad(f.c.clone().setY(STOREY / 2), f.u, V(0, 1, 0), f.len, STOREY, bays, 1));
      if (storeys > 1) batch.add(st.upper.mat, quad(f.c.clone().setY(STOREY + (h - STOREY) / 2), f.u, V(0, 1, 0), f.len, h - STOREY, bays, storeys - 1));
      // is this face looking onto the street?
      const probe = f.c.clone().addScaledVector(f.n, 1.2);
      if (inWalk(probe.x, probe.z)) streetFaces.push({ ...f, bays, h, storeys, style: st, building: [x, z, w, d] });
    }
    // roof + trims (merged): cornice, floor band, plinth, parapet
    batch.add(roof.mat, quad(V(cx, h, cz), V(1, 0, 0), V(0, 0, -1), w, d, w / roof.tile[0], d / roof.tile[1]));
    const T = st.trim;
    batch.add(T.mat, tiledBox(w + 0.36, 0.34, d + 0.36, cx, h + 0.17, cz, T.tile));
    batch.add(T.mat, tiledBox(w + 0.12, 0.18, d + 0.12, cx, STOREY + 0.09, cz, T.tile));
    batch.add(plinth.mat, tiledBox(w + 0.08, 0.45, d + 0.08, cx, 0.225, cz, plinth.tile));
    for (const [pw, pd, ox, oz] of [[w, 0.22, 0, -d / 2 + 0.11], [w, 0.22, 0, d / 2 - 0.11], [0.22, d, -w / 2 + 0.11, 0], [0.22, d, w / 2 - 0.11, 0]]) {
      batch.add(T.mat, tiledBox(pw, 0.55, pd, cx + ox, h + 0.6, cz + oz, T.tile));
    }
    // rooftop clutter
    if (w >= 4 && d >= 4 && rnd() < 0.55) addRooftop(batch, cx + (rnd() - 0.5) * (w - 3), h, cz + (rnd() - 0.5) * (d - 3), rnd, metalGrey);
  }

  // ---- street-facing details
  const decor = new THREE.Group();
  group.add(decor);
  const pipeMat = plain('#6d6f70', 0.5, 0.6);
  const awningColors = [['#c0392b', '#f4eee2'], ['#2f6f9f', '#f4eee2'], ['#3f7a5a', '#f1e7d0'], ['#d48a26', '#fff3dc']];
  const shopNames = ['墨水街杂货铺', '橡皮擦清洁公司', '马克笔文具店', '嘭嘭汽水', '漫画书屋', '卷笔刀理发', '涂鸦咖啡', '修正带裁缝'];
  let murals = 0, posters = 0, signs = 0;
  streetFaces.sort(() => rnd() - 0.5);
  for (const f of streetFaces) {
    const bayW = f.len / f.bays;
    const right = f.u, nrm = f.n;
    const at = (along, y, out) => f.c.clone().addScaledVector(right, along).setY(y).addScaledVector(nrm, out);
    // drainpipe at one end
    if (rnd() < 0.5) {
      const p = at((rnd() < 0.5 ? -1 : 1) * (f.len / 2 - 0.15), f.h / 2, 0.1);
      batch.add(pipeMat, new THREE.CylinderGeometry(0.06, 0.06, f.h, 8).translate(p.x, p.y, p.z));
    }
    for (let b = 0; b < f.bays; b++) {
      const along = -f.len / 2 + (b + 0.5) * bayW;
      // awnings over shopfronts
      if (f.style.s.ground !== 'tall' && rnd() < 0.45) {
        const [ca, cb] = awningColors[Math.floor(rnd() * awningColors.length)];
        const aw = new THREE.Mesh(new THREE.PlaneGeometry(bayW * 0.82, 1.1), stripes(ca, cb));
        aw.position.copy(at(along, 2.72, 0.5));
        aw.lookAt(aw.position.clone().add(nrm).add(V(0, 1.6, 0)));
        aw.castShadow = true;
        decor.add(aw);
      }
      // AC units and balconies on upper storeys
      for (let s = 1; s < f.storeys; s++) {
        const y = s * STOREY;
        const r = rnd();
        if (r < 0.12) {
          batch.add(metalGrey.mat, tiledBox(0.75, 0.5, 0.42, 0, 0, 0, [0.75, 0.5], 0).applyMatrix4(placeOn(at(along + bayW * 0.25, y + 0.6, 0.21), nrm)));
        } else if (r < 0.22 && f.style.s.upper === 'tall') {
          const slab = tiledBox(bayW * 0.7, 0.12, 0.7, 0, 0, 0, [1, 1]).applyMatrix4(placeOn(at(along, y + 0.06, 0.35), nrm));
          batch.add(f.style.trim.mat, slab);
          for (let k = 0; k <= 6; k++) {
            const off = -bayW * 0.33 + (bayW * 0.66 * k) / 6;
            batch.add(pipeMat, new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6).applyMatrix4(placeOn(at(along + off, y + 0.57, 0.66), nrm)));
          }
          batch.add(pipeMat, tiledBox(bayW * 0.7, 0.04, 0.04, 0, 0, 0).applyMatrix4(placeOn(at(along, y + 1.02, 0.66), nrm)));
        }
      }
    }
    // shop sign band over the ground floor
    if (signs < 9 && f.style.s.ground === 'shop' && f.len >= 4) {
      const sign = new THREE.Mesh(new THREE.BoxGeometry(Math.min(f.len - 0.6, 4.6), 0.55, 0.08), [
        plain('#2b2b2b'), plain('#2b2b2b'), plain('#2b2b2b'), plain('#2b2b2b'),
        new THREE.MeshStandardMaterial({ map: shopSign(shopNames[signs % shopNames.length], ['#2b3a55', '#5a2a2a', '#264d3b', '#4a3b6b'][signs % 4]), roughness: 0.6 }),
        plain('#2b2b2b'),
      ]);
      sign.position.copy(at(0, 3.35, 0.06));
      sign.lookAt(sign.position.clone().add(nrm));
      sign.castShadow = true;
      decor.add(sign);
      signs++;
    }
    // murals (the comic streak) and posters at street level
    if (murals < 7 && f.len >= 7 && rnd() < 0.6) {
      const mw = Math.min(f.len - 1.2, 6.5);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw / 2), new THREE.MeshStandardMaterial({
        map: mural(murals % 4, murals + 3), transparent: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2,
      }));
      m.position.copy(at((rnd() - 0.5) * (f.len - mw - 0.4), 0.5 + mw / 4, 0.03));
      m.lookAt(m.position.clone().add(nrm));
      m.receiveShadow = true;
      decor.add(m);
      murals++;
    } else if (posters < 16 && rnd() < 0.5) {
      for (let k = 0; k < 1 + Math.floor(rnd() * 3); k++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.93), new THREE.MeshStandardMaterial({ map: poster(posters + k), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
        p.position.copy(at((rnd() - 0.5) * (f.len - 1) + k * 0.7, 1.55 + (rnd() - 0.5) * 0.2, 0.03));
        p.lookAt(p.position.clone().add(nrm));
        p.rotateZ((rnd() - 0.5) * 0.08);
        p.receiveShadow = true;
        decor.add(p);
      }
      posters++;
    }
  }

  // ---- props (with collision)
  const propBoxes = [];
  for (const [cx, cz, w, d, h, kind] of map.props) {
    const b = new Box(cx - w / 2, 0, cz - d / 2, cx + w / 2, h, cz + d / 2, 'prop');
    b.surface = kind === 'crate' || kind === 'kiosk' ? 'wood' : kind === 'barrel' || kind === 'car' || kind === 'dumpster' ? 'metal' : 'concrete';
    world.add(b);
    propBoxes.push(b);
    addProp(batch, decor, kind, cx, cz, w, d, h, rnd);
  }

  // ---- ground paint: bombsite stencils, route arrows
  for (const [id, s] of Object.entries(map.sites)) {
    const size = Math.min(s.x2 - s.x1, s.z2 - s.z1) * 0.55;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: siteStencil(id, s.color), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((s.x1 + s.x2) / 2, 0.012, (s.z1 + s.z2) / 2);
    m.receiveShadow = true;
    m.layers.set(LAYER_FX);
    decor.add(m);
  }
  const wallArrow = (letter, dir, x, y, z, rotY, color) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshStandardMaterial({ map: arrowSign(letter, dir, color), transparent: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    decor.add(m);
  };
  // (dir: +1 points to the viewer's right when facing the wall)
  wallArrow('A', -1, -20, 1.9, 28.02, 0, '#e8553f');            // T street → west to A long
  wallArrow('B', -1, 13.98, 1.9, 36, -Math.PI / 2, '#3a8bd9');  // T spawn → north to B alley
  wallArrow('A', 1, -11.98, 1.9, -2, Math.PI / 2, '#e8553f');   // mid plaza → A short (north)
  wallArrow('B', -1, 11.98, 1.9, -2, -Math.PI / 2, '#3a8bd9');  // mid plaza → B connector (north)
  wallArrow('A', -1, -6, 1.9, -37.98, 0, '#e8553f');            // CT spawn → west
  wallArrow('B', 1, 6, 1.9, -37.98, 0, '#3a8bd9');              // CT spawn → east

  batch.flush(group);
  const nav = new NavGrid(map, propBoxes);
  return { world, nav, group };
}

/** Matrix that places a unit-oriented object on a wall facing `normal`. */
function placeOn(pos, normal) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), normal);
  return m.compose(pos, q, V(1, 1, 1));
}

function addRooftop(batch, x, y, z, rnd, metal) {
  const r = rnd();
  if (r < 0.45) {
    // water tank on a frame
    const wood = surface('woodPlanks', { color: '#8a5a36', size: 256 });
    batch.add(wood.mat, new THREE.CylinderGeometry(1.05, 1.1, 2.1, 18, 1).translate(x, y + 2.75, z));
    batch.add(plain('#4a3a30', 0.8), new THREE.ConeGeometry(1.2, 0.7, 18).translate(x, y + 4.15, z));
    for (const [dx, dz] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
      batch.add(plain('#2e2e30', 0.6, 0.5), new THREE.BoxGeometry(0.12, 1.7, 0.12).translate(x + dx, y + 0.85, z + dz));
    }
  } else if (r < 0.8) {
    // AC unit with fan grille
    batch.add(metal.mat, tiledBox(1.6, 1.0, 1.2, x, y + 0.5, z, [1.6, 1.0]));
    batch.add(plain('#2a2c2e', 0.5, 0.6), new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20).translate(x, y + 1.02, z));
  } else {
    // antenna
    batch.add(plain('#3a3a3a', 0.5, 0.8), new THREE.CylinderGeometry(0.03, 0.03, 3.2, 6).translate(x, y + 1.6, z));
    for (let i = 0; i < 4; i++) batch.add(plain('#3a3a3a', 0.5, 0.8), new THREE.BoxGeometry(1.2 - i * 0.2, 0.03, 0.03).translate(x, y + 2.2 + i * 0.3, z));
  }
}

const carPaint = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.08 });

function addProp(batch, decor, kind, cx, cz, w, d, h, rnd) {
  if (kind === 'crate') {
    const crate = surface('woodCrate', { size: 512 });
    const n = h > 1.5 ? 2 : 1;
    const ch = h / n;
    for (let k = 0; k < n; k++) {
      const s = k ? 0.94 : 1;
      batch.add(crate.mat, tiledBox(w * s, ch, d * s, cx, ch / 2 + k * ch, cz, [w * s, ch], k ? 0.1 : 0));
    }
  } else if (kind === 'barrel') {
    const color = ['#2f5f8a', '#a23b2c', '#3f6b3a'][Math.floor(rnd() * 3)];
    const drum = surface('metalPainted', { color, size: 256 }, { metalness: 0.4 });
    const g = new THREE.CylinderGeometry(w / 2, w / 2, h, 22, 1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 1.2);
    batch.add(drum.mat, g.translate(cx, h / 2, cz));
    for (const y of [h * 0.33, h * 0.66]) batch.add(drum.mat, new THREE.TorusGeometry(w / 2 + 0.01, 0.018, 6, 24).rotateX(Math.PI / 2).translate(cx, y, cz));
    batch.add(plain('#2b2b2b', 0.5, 0.6), new THREE.CylinderGeometry(w / 2 - 0.02, w / 2 - 0.02, 0.02, 22).translate(cx, h + 0.005, cz));
  } else if (kind === 'car') {
    const long = d > w;
    const g = new THREE.Group();
    const L = long ? d : w, Wd = long ? w : d;
    const paint = carPaint(['#c23b30', '#e8e2d4', '#2f5f8a', '#d8a12a'][Math.floor(rnd() * 4)]);
    const body = new THREE.Mesh(new RoundedBoxGeometry(Wd, h * 0.5, L, 4, 0.18), paint);
    body.position.y = 0.32 + h * 0.25;
    const cabin = new THREE.Mesh(new RoundedBoxGeometry(Wd * 0.86, h * 0.36, L * 0.52, 4, 0.16), paint);
    cabin.position.set(0, 0.32 + h * 0.5 + h * 0.16, -L * 0.04);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: '#1b2a36', roughness: 0.05, metalness: 0.2, clearcoat: 1 });
    const win = new THREE.Mesh(new RoundedBoxGeometry(Wd * 0.88, h * 0.26, L * 0.48, 2, 0.08), glassMat);
    win.position.copy(cabin.position).add(V(0, 0.01, 0));
    g.add(body, cabin, win);
    const tire = plain('#151515', 0.9);
    const rim = plain('#b9bec5', 0.3, 1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.24, 20).rotateZ(Math.PI / 2), tire);
      t.position.set(sx * (Wd / 2 - 0.08), 0.34, sz * (L / 2 - 0.75));
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.26, 16).rotateZ(Math.PI / 2), rim);
      r.position.copy(t.position);
      g.add(t, r);
    }
    for (const sx of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.04), new THREE.MeshStandardMaterial({ color: '#fff6dc', emissive: '#fff1c0', emissiveIntensity: 0.3 }));
      head.position.set(sx * (Wd / 2 - 0.3), 0.32 + h * 0.3, -L / 2 - 0.01);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.04), new THREE.MeshStandardMaterial({ color: '#b3261e', emissive: '#7a0f0a', emissiveIntensity: 0.4 }));
      tail.position.set(sx * (Wd / 2 - 0.3), 0.32 + h * 0.32, L / 2 + 0.01);
      g.add(head, tail);
    }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(cx, 0, cz);
    if (!long) g.rotation.y = Math.PI / 2;
    decor.add(g);
  } else if (kind === 'dumpster') {
    const green = surface('metalPainted', { color: '#2f6b45', size: 256 }, { metalness: 0.35 });
    batch.add(green.mat, tiledBox(w, h * 0.86, d, cx, h * 0.43 + 0.08, cz, [1.2, 1]));
    batch.add(plain('#1d3a28', 0.6, 0.3), new THREE.BoxGeometry(w + 0.08, 0.08, d + 0.08).rotateX(0.04).translate(cx, h * 0.92, cz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) batch.add(plain('#151515', 0.9), new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateZ(Math.PI / 2).translate(cx + sx * (w / 2 - 0.15), 0.08, cz + sz * (d / 2 - 0.2)));
  } else if (kind === 'kiosk') {
    const wood = surface('woodPlanks', { color: '#7b4b2c', size: 256 });
    batch.add(wood.mat, tiledBox(w, h * 0.78, d, cx, h * 0.39, cz, [2, 2]));
    batch.add(plain('#2f3a44', 0.5, 0.4), new THREE.BoxGeometry(w + 0.1, 0.1, d + 0.1).translate(cx, h * 0.79, cz));
    const aw = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.6, d + 1.6), stripes('#c0392b', '#f4eee2'));
    aw.rotation.x = -Math.PI / 2 + 0.12;
    aw.position.set(cx, h * 0.98, cz);
    aw.castShadow = true;
    decor.add(aw);
    for (let i = 0; i < 6; i++) {
      const mag = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6), new THREE.MeshStandardMaterial({ map: poster(i + 20), roughness: 0.8 }));
      mag.position.set(cx - w / 2 + 0.5 + i * ((w - 1) / 5), h * 0.48, cz + d / 2 + 0.01);
      mag.rotation.x = -0.15;
      decor.add(mag);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 0.5), new THREE.MeshStandardMaterial({ map: shopSign('POP! 报刊亭', '#c0392b', '#fff3d6'), roughness: 0.6 }));
    sign.position.set(cx, h * 0.88, cz + d / 2 + 0.06);
    decor.add(sign);
  }
}
