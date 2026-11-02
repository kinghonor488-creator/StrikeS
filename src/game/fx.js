// World effects, all instanced: billboard particles (smoke, dust, embers, ink mist),
// velocity-stretched sparks, debris chunks, brass casings, lit decals, travelling
// tracers, pooled muzzle-flash lights and a layered explosion.
import * as THREE from 'three';
import { LAYER_FX } from '../render/renderer.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpV3 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- textures
function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const smokeTex = () => canvasTex(128, (g, n) => {
  for (let i = 0; i < 18; i++) {
    const x = n / 2 + (Math.random() - 0.5) * n * 0.35, y = n / 2 + (Math.random() - 0.5) * n * 0.35;
    const r = n * (0.18 + Math.random() * 0.2);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.32)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, n, n);
  }
});
const softTex = () => canvasTex(64, (g, n) => {
  const grd = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, n, n);
});
const fireTex = () => canvasTex(128, (g, n) => {
  for (let i = 0; i < 10; i++) {
    const x = n / 2 + (Math.random() - 0.5) * n * 0.3, y = n / 2 + (Math.random() - 0.5) * n * 0.3;
    const r = n * (0.15 + Math.random() * 0.22);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,240,200,0.9)');
    grd.addColorStop(0.5, 'rgba(255,140,40,0.5)');
    grd.addColorStop(1, 'rgba(120,30,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, n, n);
  }
});

/** Decal atlas 4x2: concrete holes, metal dent, wood hole, ink splats, scorch, spatter. Albedo + normal. */
function decalAtlas() {
  const N = 128, W = N * 4, H = N * 2;
  const col = document.createElement('canvas'); col.width = W; col.height = H;
  const hgt = document.createElement('canvas'); hgt.width = W; hgt.height = H;
  const g = col.getContext('2d'), h = hgt.getContext('2d');
  h.fillStyle = 'rgb(128,128,128)'; h.fillRect(0, 0, W, H);
  const cell = (i, j, fn) => { g.save(); h.save(); g.translate(i * N + N / 2, j * N + N / 2); h.translate(i * N + N / 2, j * N + N / 2); fn(); g.restore(); h.restore(); };
  const hole = (dark, rim) => () => {
    // cracked crater with a dark core, filling most of the cell so decal size = visible size
    for (let k = 0; k < 9; k++) {
      const a = Math.random() * Math.PI * 2, l = 30 + Math.random() * 30;
      g.strokeStyle = 'rgba(40,36,32,0.6)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l * 0.5 + (Math.random() - 0.5) * 8, Math.sin(a) * l * 0.5); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
    }
    let grd = g.createRadialGradient(0, 0, 4, 0, 0, 46);
    grd.addColorStop(0, rim); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 46, 0, Math.PI * 2); g.fill();
    g.fillStyle = dark; g.beginPath(); g.arc(0, 0, 13, 0, Math.PI * 2); g.fill();
    grd = h.createRadialGradient(0, 0, 0, 0, 0, 40);
    grd.addColorStop(0, 'rgb(10,10,10)'); grd.addColorStop(0.35, 'rgb(150,150,150)'); grd.addColorStop(1, 'rgb(128,128,128)');
    h.fillStyle = grd; h.beginPath(); h.arc(0, 0, 40, 0, Math.PI * 2); h.fill();
  };
  cell(0, 0, hole('rgba(18,16,14,1)', 'rgba(80,72,64,0.7)'));
  cell(1, 0, hole('rgba(25,22,20,1)', 'rgba(110,100,90,0.6)'));
  cell(2, 0, () => { // metal dent: bright scuffed ring
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 40);
    grd.addColorStop(0, 'rgba(50,50,54,1)'); grd.addColorStop(0.35, 'rgba(210,210,215,0.95)'); grd.addColorStop(1, 'rgba(160,160,165,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
    const hg = h.createRadialGradient(0, 0, 0, 0, 0, 40);
    hg.addColorStop(0, 'rgb(50,50,50)'); hg.addColorStop(1, 'rgb(128,128,128)');
    h.fillStyle = hg; h.beginPath(); h.arc(0, 0, 40, 0, Math.PI * 2); h.fill();
  });
  cell(3, 0, () => { // wood: splintered dark hole
    for (let k = 0; k < 12; k++) { g.fillStyle = 'rgba(205,165,115,0.85)'; g.save(); g.rotate((Math.random() - 0.5) * 0.7); g.fillRect(-3, -44 + Math.random() * 10, 6, 36 + Math.random() * 40); g.restore(); }
    g.fillStyle = 'rgba(30,18,10,1)'; g.beginPath(); g.ellipse(0, 0, 11, 16, 0, 0, Math.PI * 2); g.fill();
  });
  const splat = (color) => () => {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI * 2, r = 22 + Math.random() * 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.fill();
    for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 26; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 2 + Math.random() * 5, 0, Math.PI * 2); g.fill(); }
    h.fillStyle = 'rgb(150,150,150)';
    h.beginPath(); h.arc(0, 0, 26, 0, Math.PI * 2); h.fill();
  };
  cell(0, 1, splat('rgba(36,30,72,0.92)'));
  cell(1, 1, splat('rgba(120,26,30,0.85)'));
  cell(2, 1, () => { // scorch
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, 62);
    grd.addColorStop(0, 'rgba(10,8,8,0.95)'); grd.addColorStop(0.6, 'rgba(30,26,24,0.6)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(-64, -64, 128, 128);
  });
  cell(3, 1, () => { // fine spatter
    for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, d = Math.random() * 50; g.fillStyle = `rgba(90,20,24,${0.4 + Math.random() * 0.5})`; g.beginPath(); g.arc(Math.cos(a) * d, Math.sin(a) * d, 1 + Math.random() * 3.5, 0, Math.PI * 2); g.fill(); }
  });
  // height → normal
  const hd = h.getImageData(0, 0, W, H).data;
  const nimg = h.createImageData(W, H);
  const at = (x, y) => hd[((Math.min(H - 1, Math.max(0, y)) * W) + Math.min(W - 1, Math.max(0, x))) * 4] / 255;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 3, dy = (at(x, y + 1) - at(x, y - 1)) * 3;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * W + x) * 4;
    nimg.data[i] = (-dx / l * 0.5 + 0.5) * 255; nimg.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; nimg.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; nimg.data[i + 3] = 255;
  }
  h.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(col); map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(hgt);
  return { map, normalMap };
}
export const DECAL = { concrete: [0, 0], concrete2: [1, 0], metal: [2, 0], wood: [3, 0], ink: [0, 1], blood: [1, 1], scorch: [2, 1], spatter: [3, 1] };

// ---------------------------------------------------------------- billboard pool
const BB_VERT = /* glsl */`
attribute vec3 iPos; attribute vec4 iColor; attribute vec2 iSizeRot; attribute vec3 iVel;
uniform float uStretch;
varying vec2 vUv; varying vec4 vColor;
void main() {
  vUv = uv; vColor = iColor;
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vec2 p = position.xy * iSizeRot.x;
  if (uStretch > 0.0) {
    vec3 v = (modelViewMatrix * vec4(iVel, 0.0)).xyz;
    vec2 d = normalize(v.xy + 1e-5);
    float len = 1.0 + length(v) * uStretch;
    p = vec2(position.x * iSizeRot.x * 0.25, position.y * iSizeRot.x * len);
    p = vec2(d.y * p.x + d.x * p.y, -d.x * p.x + d.y * p.y);
  } else {
    float c = cos(iSizeRot.y), s = sin(iSizeRot.y);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
}`;
const BB_FRAG = /* glsl */`
uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
void main() {
  vec4 t = texture2D(map, vUv);
  gl_FragColor = vec4(vColor.rgb * t.rgb, t.a * vColor.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class BillboardPool {
  constructor(scene, map, max, { additive = false, stretch = 0 } = {}) {
    this.max = max;
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = new THREE.PlaneGeometry(1, 1).index;
    const base = new THREE.PlaneGeometry(1, 1);
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.col = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.sr = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.vel = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.pos); geo.setAttribute('iColor', this.col);
    geo.setAttribute('iSizeRot', this.sr); geo.setAttribute('iVel', this.vel);
    geo.instanceCount = 0;
    const mat = new THREE.ShaderMaterial({
      vertexShader: BB_VERT, fragmentShader: BB_FRAG,
      uniforms: { map: { value: map }, uStretch: { value: stretch } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.layers.set(LAYER_FX);
    this.mesh.renderOrder = additive ? 6 : 5;
    scene.add(this.mesh);
    this.items = [];
  }

  /** p: { pos, vel, life, size, grow, rot, spin, color:[r,g,b], alpha, fadeIn, drag, gravity, buoy, floor } */
  spawn(p) {
    if (this.items.length >= this.max) this.items.shift();
    p.t = 0;
    p.vel ||= new THREE.Vector3();
    this.items.push(p);
    return p;
  }

  update(dt) {
    const it = this.items;
    let n = 0;
    for (let i = it.length - 1; i >= 0; i--) {
      const p = it[i];
      p.t += dt;
      if (p.t >= p.life || p.dead) { it.splice(i, 1); continue; }
      const k = p.t / p.life;
      p.vel.multiplyScalar(Math.exp(-(p.drag ?? 0) * dt));
      p.vel.y += ((p.buoy ?? 0) - (p.gravity ?? 0)) * dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.floor !== undefined && p.pos.y < p.floor) { p.pos.y = p.floor; p.vel.y *= -0.3; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      p.rot = (p.rot ?? 0) + (p.spin ?? 0) * dt;
    }
    for (const p of it) {
      const k = p.t / p.life;
      const size = p.size * (1 + (p.grow ?? 0) * k);
      const fade = (p.fadeIn ? Math.min(1, p.t / p.fadeIn) : 1) * (1 - Math.pow(k, p.fadePow ?? 1.6));
      const c = p.color, a = (p.alpha ?? 1) * fade;
      this.pos.setXYZ(n, p.pos.x, p.pos.y, p.pos.z);
      this.col.setXYZW(n, c[0], c[1], c[2], a);
      this.sr.setXY(n, size, p.rot ?? 0);
      this.vel.setXYZ(n, p.vel.x, p.vel.y, p.vel.z);
      n++;
    }
    this.mesh.geometry.instanceCount = n;
    this.pos.needsUpdate = this.col.needsUpdate = this.sr.needsUpdate = this.vel.needsUpdate = true;
  }

  clear() { this.items.length = 0; }
}

// ---------------------------------------------------------------- the FX hub
export class FX {
  constructor(scene) {
    this.scene = scene;
    this.smoke = new BillboardPool(scene, smokeTex(), 700);
    this.soft = new BillboardPool(scene, softTex(), 500);
    this.glow = new BillboardPool(scene, softTex(), 300, { additive: true });
    this.fire = new BillboardPool(scene, fireTex(), 120, { additive: true });
    this.sparks = new BillboardPool(scene, softTex(), 400, { additive: true, stretch: 0.045 });

    // decals: one instanced mesh, lit, atlas-mapped
    const atlas = decalAtlas();
    const dMat = new THREE.MeshStandardMaterial({
      map: atlas.map, normalMap: atlas.normalMap, transparent: true, depthWrite: false, roughness: 0.85,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    dMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 iCell;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = (uv + iCell) * vec2(0.25, 0.5);\n#endif\n#ifdef USE_NORMALMAP\nvNormalMapUv = (uv + iCell) * vec2(0.25, 0.5);\n#endif');
    };
    const dGeo = new THREE.PlaneGeometry(1, 1);
    this.decalCells = new THREE.InstancedBufferAttribute(new Float32Array(600 * 2), 2);
    dGeo.setAttribute('iCell', this.decalCells);
    this.decals = new THREE.InstancedMesh(dGeo, dMat, 600);
    this.decals.count = 0;
    this.decals.frustumCulled = false;
    this.decals.layers.set(LAYER_FX);
    this.decals.receiveShadow = true;
    scene.add(this.decals);
    this.decalNext = 0;

    // debris + casings: physical little meshes
    this.debris = this.makeBodies(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }), 160, true);
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a04a', metalness: 1, roughness: 0.3 });
    this.casings = {
      pistol: this.makeBodies(new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 8).rotateX(Math.PI / 2), brass, 60),
      rifle: this.makeBodies(new THREE.CylinderGeometry(0.005, 0.0058, 0.039, 8).rotateX(Math.PI / 2), brass, 60),
      shell: this.makeBodies(new THREE.CylinderGeometry(0.0095, 0.0095, 0.06, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b02a22', roughness: 0.45 }), 24),
    };

    // tracers
    const tGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0);
    const tMat = new THREE.MeshBasicMaterial({ map: softTex(), color: new THREE.Color(5, 3.8, 2.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tracerMesh = new THREE.InstancedMesh(tGeo, tMat, 64);
    this.tracerMesh.count = 0;
    this.tracerMesh.frustumCulled = false;
    this.tracerMesh.layers.set(LAYER_FX);
    scene.add(this.tracerMesh);
    this.tracers = [];

    // two always-present point lights so the shader never recompiles mid-fight
    this.lights = [0, 1].map(() => {
      const l = new THREE.PointLight(0xffb066, 0, 9, 2);
      scene.add(l);
      return { l, t: 0, life: 0.05, peak: 0 };
    });
    this.lightIdx = 0;
    this.camera = null;
  }

  makeBodies(geo, mat, max, colored = false) {
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.count = 0;
    m.castShadow = false;
    m.frustumCulled = false;
    m.layers.set(LAYER_FX);
    if (colored) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3).fill(1), 3);
    this.scene.add(m);
    return { mesh: m, items: [], max };
  }

  // ---- spawners --------------------------------------------------------------------
  flashLight(pos, intensity = 6, color = 0xffb066, life = 0.05, range = 9) {
    const L = this.lights[this.lightIdx++ % this.lights.length];
    L.l.position.copy(pos);
    L.l.color.set(color);
    L.l.distance = range;
    L.peak = intensity; L.t = 0; L.life = life;
  }

  decal(point, normal, kind = 'concrete', size = 0.12, rot = Math.random() * Math.PI * 2) {
    const i = this.decalNext++ % 600;
    const cell = DECAL[kind] || DECAL.concrete;
    tmpV.copy(point).addScaledVector(normal, 0.004);
    tmpQ.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    tmpQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), rot));
    tmpM.compose(tmpV, tmpQ, tmpS.set(size, size, size));
    this.decals.setMatrixAt(i, tmpM);
    this.decalCells.setXY(i, cell[0], 1 - cell[1]);
    this.decals.count = Math.min(600, Math.max(this.decals.count, i + 1));
    this.decals.instanceMatrix.needsUpdate = true;
    this.decalCells.needsUpdate = true;
  }

  clearDecals() {
    this.decals.count = 0;
    this.decalNext = 0;
    for (const p of [this.smoke, this.soft, this.glow, this.fire, this.sparks]) p.clear();
    for (const b of [this.debris, ...Object.values(this.casings)]) { b.items.length = 0; b.mesh.count = 0; }
    this.tracers.length = 0;
  }

  /** Bullet hitting the world. surface: concrete | brick | plaster | metal | wood | ground | ink. */
  impact(point, normal, surface = 'concrete', dirIn = null) {
    const n = normal;
    const kind = surface === 'metal' ? 'metal' : surface === 'wood' ? 'wood' : surface === 'ink' ? 'ink' : Math.random() < 0.5 ? 'concrete' : 'concrete2';
    this.decal(point, n, kind, surface === 'ink' ? 0.28 : surface === 'metal' ? 0.07 : 0.1 + Math.random() * 0.04);
    const refl = tmpV2.copy(dirIn || n).reflect(n).normalize();
    const dustCol = surface === 'wood' ? [0.62, 0.48, 0.32] : surface === 'ink' ? [0.18, 0.15, 0.36] : surface === 'ground' ? [0.55, 0.5, 0.42] : [0.72, 0.68, 0.62];
    // dust puff along the normal
    for (let i = 0; i < 3; i++) {
      this.smoke.spawn({
        pos: point.clone().addScaledVector(n, 0.05), vel: n.clone().multiplyScalar(0.6 + Math.random() * 1.2).add(rnd(0.4)),
        life: 0.7 + Math.random() * 0.6, size: 0.12, grow: 3.5, rot: Math.random() * 6, spin: (Math.random() - 0.5),
        color: dustCol, alpha: 0.55, drag: 2.5, gravity: 0.3, fadePow: 1.2,
      });
    }
    // chips
    const chips = surface === 'ink' ? 0 : 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < chips; i++) this.spawnBody(this.debris, point.clone().addScaledVector(n, 0.02),
      n.clone().multiplyScalar(1.5 + Math.random() * 2.5).add(rnd(1.6)), 1.2, 0.4 + Math.random() * 0.6, surface === 'wood' ? 0x9a6a3a : 0x8a8478);
    // sparks off hard surfaces
    if (surface === 'metal' || (surface !== 'wood' && surface !== 'ink' && Math.random() < 0.35)) {
      const count = surface === 'metal' ? 8 : 3;
      for (let i = 0; i < count; i++) this.sparks.spawn({
        pos: point.clone(), vel: refl.clone().multiplyScalar(4 + Math.random() * 7).add(rnd(3)),
        life: 0.12 + Math.random() * 0.2, size: 0.02, color: [4, 2.6, 1.2], alpha: 1, gravity: 9, drag: 1,
      });
    }
    if (surface === 'ink') {
      for (let i = 0; i < 6; i++) this.soft.spawn({
        pos: point.clone(), vel: n.clone().multiplyScalar(1 + Math.random() * 2).add(rnd(1.5)),
        life: 0.5, size: 0.05, color: [0.15, 0.12, 0.35], alpha: 0.95, gravity: 9.8, floor: 0.01,
      });
    }
  }

  /** A player getting hit: ink-dark mist, droplets, wall spatter behind. */
  bodyHit(point, dir, head = false, helmet = false, world = null) {
    if (helmet) {
      for (let i = 0; i < 10; i++) this.sparks.spawn({
        pos: point.clone(), vel: dir.clone().multiplyScalar(-2).add(rnd(5)), life: 0.15 + Math.random() * 0.15,
        size: 0.018, color: [4, 3, 1.6], alpha: 1, gravity: 8,
      });
    }
    // a quick dense puff at the wound, a mist blown out along the bullet, droplets that fall
    const s = head ? 1.5 : 1;
    this.soft.spawn({ pos: point.clone(), life: 0.12, size: 0.22 * s, grow: 1.5, color: [0.55, 0.05, 0.06], alpha: 1, rot: Math.random() * 6 });
    for (let i = 0; i < (head ? 9 : 5); i++) this.smoke.spawn({
      pos: point.clone(), vel: dir.clone().multiplyScalar(1.8 + Math.random() * 2.6).add(rnd(0.9)),
      life: 0.3 + Math.random() * 0.3, size: 0.12 * s, grow: 3.5, rot: Math.random() * 6, color: [0.42, 0.04, 0.06], alpha: 0.9, drag: 4.5, fadePow: 1.3,
    });
    for (let i = 0; i < 2; i++) this.smoke.spawn({ // back-spatter toward the shooter
      pos: point.clone(), vel: dir.clone().multiplyScalar(-0.8 - Math.random()).add(rnd(0.5)),
      life: 0.25, size: 0.08 * s, grow: 3, color: [0.4, 0.04, 0.06], alpha: 0.7, drag: 5,
    });
    for (let i = 0; i < (head ? 16 : 8); i++) this.soft.spawn({
      pos: point.clone(), vel: dir.clone().multiplyScalar(2 + Math.random() * 3.5).add(rnd(1.6)),
      life: 0.7, size: 0.03, color: [0.38, 0.03, 0.05], alpha: 1, gravity: 9.8, floor: 0.01,
    });
    if (world) {
      const hit = world.raycast(point, dir, 2.5, (b) => b.blocksBullets);
      if (hit) this.decal(hit.point, hit.normal, Math.random() < 0.5 ? 'blood' : 'spatter', 0.35 + Math.random() * 0.3);
    }
  }

  tracer(from, to) {
    const len = from.distanceTo(to);
    if (len < 2) return;
    if (this.tracers.length >= 64) this.tracers.shift();
    this.tracers.push({ from: from.clone(), dir: to.clone().sub(from).normalize(), len, d: 0 });
  }

  /** Third-person muzzle flash + light. */
  muzzle(pos, dir, def) {
    if (def.suppressed) return;
    const big = def.cat === 'sniper' || def.cat === 'heavy' ? 1.4 : def.cat === 'pistol' ? 0.75 : 1;
    this.glow.spawn({ pos: pos.clone(), life: 0.05, size: 0.35 * big, color: [5, 3.4, 1.6], alpha: 1, rot: Math.random() * 6 });
    this.fire.spawn({ pos: pos.clone().addScaledVector(dir, 0.08), life: 0.05, size: 0.22 * big, color: [4, 2.6, 1.2], alpha: 1, rot: Math.random() * 6 });
    this.smoke.spawn({ pos: pos.clone(), vel: dir.clone().multiplyScalar(0.8).add(rnd(0.2)), life: 0.9, size: 0.08, grow: 4, color: [0.8, 0.78, 0.74], alpha: 0.18 * big, drag: 2, buoy: 0.4 });
    this.flashLight(pos, 5 * big, 0xffb066, 0.05, 7);
  }

  /** First-person: a curl of gas off the muzzle that lingers and thickens in long sprays. */
  muzzleSmoke(pos, dir, def, heat = 0) {
    const big = def.cat === 'sniper' || def.pellets ? 1.6 : def.cat === 'pistol' ? 0.7 : 1;
    const n = big > 1 ? 3 : 1;
    for (let i = 0; i < n; i++) this.smoke.spawn({
      pos: pos.clone().addScaledVector(dir, 0.05 + Math.random() * 0.1),
      vel: dir.clone().multiplyScalar(0.6 + Math.random() * 0.8).add(rnd(0.25)).setY(0.25 + Math.random() * 0.3),
      life: 0.7 + Math.random() * 0.6 + heat * 0.8, size: 0.05 * big, grow: 5, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2,
      color: [0.82, 0.8, 0.77], alpha: (0.1 + heat * 0.12) * big, drag: 2.4, buoy: 0.5, fadeIn: 0.04,
    });
  }

  casing(pos, vel, type = 'rifle', onLand = null) {
    const pool = this.casings[type] || this.casings.rifle;
    this.spawnBody(pool, pos, vel, 3.5, 0, null, onLand);
  }

  spawnBody(pool, pos, vel, life, scale = 1, color = null, onLand = null) {
    if (pool.items.length >= pool.max) pool.items.shift();
    pool.items.push({
      pos: pos.clone(), vel: vel.clone(), life, t: 0, scale: scale || 1, color,
      rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      spin: new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30),
      onLand, landed: false,
    });
  }

  explosion(pos) {
    const p = pos.clone();
    this.flashLight(p.clone().add(new THREE.Vector3(0, 2, 0)), 220, 0xffa040, 0.6, 45);
    for (let i = 0; i < 26; i++) this.fire.spawn({
      pos: p.clone().add(rnd(1.2)).setY(0.6 + Math.random() * 2), vel: rnd(7).setY(2 + Math.random() * 6),
      life: 0.5 + Math.random() * 0.5, size: 2.2 + Math.random() * 2.2, grow: 1.6, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 2,
      color: [6, 3.2, 1.2], alpha: 1, drag: 3,
    });
    for (let i = 0; i < 60; i++) this.smoke.spawn({
      pos: p.clone().add(rnd(2.5)).setY(0.5 + Math.random() * 3), vel: rnd(5).setY(2 + Math.random() * 5),
      life: 4 + Math.random() * 4, size: 2.5 + Math.random() * 2.5, grow: 2.2, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.5,
      color: [0.16, 0.14, 0.16], alpha: 0.85, drag: 0.9, buoy: 0.5, fadeIn: 0.15, fadePow: 2,
    });
    for (let i = 0; i < 70; i++) this.sparks.spawn({
      pos: p.clone().setY(0.8), vel: rnd(20).setY(4 + Math.random() * 14), life: 0.5 + Math.random() * 0.8,
      size: 0.05, color: [5, 2.8, 1.0], alpha: 1, gravity: 12, drag: 0.6,
    });
    for (let i = 0; i < 40; i++) this.spawnBody(this.debris, p.clone().setY(0.4), rnd(12).setY(5 + Math.random() * 9), 3, 1 + Math.random() * 2.5, 0x4a4440);
    this.decal(new THREE.Vector3(p.x, 0.012, p.z), UP, 'scorch', 7);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 9;
      this.decal(new THREE.Vector3(p.x + Math.cos(a) * r, 0.013, p.z + Math.sin(a) * r), UP, 'ink', 1.2 + Math.random() * 2.2);
    }
  }

  // ---- per frame -------------------------------------------------------------------
  update(dt, camera) {
    for (const p of [this.smoke, this.soft, this.glow, this.fire, this.sparks]) p.update(dt);

    for (const L of this.lights) {
      L.t += dt;
      L.l.intensity = L.t < L.life ? L.peak * (1 - L.t / L.life) : 0;
    }

    // physical bodies
    for (const pool of [this.debris, ...Object.values(this.casings)]) {
      const items = pool.items;
      for (let i = items.length - 1; i >= 0; i--) {
        const b = items[i];
        b.t += dt;
        if (b.t > b.life) { items.splice(i, 1); continue; }
        if (!b.resting) {
          b.vel.y -= 14 * dt;
          b.pos.addScaledVector(b.vel, dt);
          b.rot.x += b.spin.x * dt; b.rot.y += b.spin.y * dt; b.rot.z += b.spin.z * dt;
          if (b.pos.y < 0.006) {
            b.pos.y = 0.006;
            if (!b.landed) { b.landed = true; b.onLand?.(b.pos); }
            if (Math.abs(b.vel.y) < 0.8) { b.resting = true; b.rot.x = Math.PI / 2 * Math.round(b.rot.x / (Math.PI / 2)); }
            b.vel.y *= -0.35; b.vel.x *= 0.5; b.vel.z *= 0.5; b.spin.multiplyScalar(0.5);
          }
        }
      }
      const m = pool.mesh;
      items.forEach((b, i) => {
        const shrink = b.t > b.life - 0.4 ? Math.max(0.01, (b.life - b.t) / 0.4) : 1;
        tmpQ.setFromEuler(b.rot);
        tmpM.compose(b.pos, tmpQ, tmpS.setScalar(b.scale * shrink));
        m.setMatrixAt(i, tmpM);
        if (m.instanceColor && b.color != null) m.setColorAt(i, tmpCol.set(b.color));
      });
      m.count = items.length;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // tracers fly at ~380 m/s as short glowing streaks
    const tm = this.tracerMesh;
    let n = 0;
    const camPos = camera?.position;
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.d += 380 * dt;
      if (tr.d - 1.6 > tr.len) { this.tracers.splice(i, 1); continue; }
    }
    for (const tr of this.tracers) {
      const head = Math.min(tr.d, tr.len), tail = Math.max(0, tr.d - 1.6);
      if (head - tail < 0.05) continue;
      const a = tmpV.copy(tr.from).addScaledVector(tr.dir, tail);
      const toCam = camPos ? tmpV2.subVectors(camPos, a).normalize() : UP;
      const side = tmpV3.crossVectors(tr.dir, toCam).normalize();
      const nrm = new THREE.Vector3().crossVectors(tr.dir, side);
      tmpM.makeBasis(tr.dir.clone().multiplyScalar(head - tail), side.multiplyScalar(0.025), nrm);
      tmpM.setPosition(a);
      tm.setMatrixAt(n++, tmpM);
    }
    tm.count = n;
    tm.instanceMatrix.needsUpdate = true;
  }
}

const tmpCol = new THREE.Color();
function rnd(s) { return new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
