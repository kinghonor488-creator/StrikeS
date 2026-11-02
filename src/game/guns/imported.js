// Scanned / artist-made guns loaded from glTF (public/models/guns, CC0 from Poly Haven).
// Each one is converted into the same shape GunBuilder.build() returns: forward is -Z,
// the firing grip sits at the origin, and movable parts (slide, bolt, mag) are groups
// whose position the viewmodel animates in gun space.
//
// Source files face +X with +Y up, so a source point (x, y, z) maps to game (z, y, -x).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const BASE = `${import.meta.env.BASE_URL}models/guns/`;

/**
 * Per-gun setup, in source (glTF) metres. Anchors follow GunBuilder: grip = firing hand,
 * support = off hand, butt = shoulder end. Parts list the source nodes that move together
 * and the pivot they move around.
 */
const IMPORTED = {
  p25: {
    file: 'service_pistol/service_pistol_2k.gltf',
    hide: ['service_pistol_pistol_b', 'service_pistol_slide_b', 'service_pistol_hammer_b', 'service_pistol_trigger_b',
      'service_pistol_magazine_empty', 'service_pistol_bullet'],
    sticker: ['service_pistol_pistol_a', 'service_pistol_slide_a'],
    parts: {
      slide: { nodes: ['service_pistol_slide_a'], pivot: [0.035, 0.062, 0] },
      // the loaded magazine is modelled beside the gun; seat it in the grip, tilted with it
      mag: { nodes: ['service_pistol_magazine_loaded'], pivot: [-0.013, 0.001, 0], place: { pos: [-0.013, 0.001, 0], rotZ: -0.42 } },
    },
    anchors: { grip: [-0.004, 0.012, 0], muzzle: [0.176, 0.062, 0], eject: [0.06, 0.074, 0.012], sight: [0.0, 0.08, 0] },
  },
  s08: {
    file: 'bolt_action_rifle_7_62/bolt_action_rifle_7_62_2k.gltf',
    hide: ['bolt_action_rifle_7_62_bullet_54mm'],
    sticker: ['bolt_action_rifle_7_62'],
    parts: {
      bolt: { nodes: ['bolt_action_rifle_7_62_bolt_a', 'bolt_action_rifle_7_62_bolt_b'], pivot: [-0.237, 0.051, 0] },
    },
    anchors: {
      grip: [-0.335, -0.004, 0], support: [0.05, 0.012, 0], muzzle: [0.598, 0.042, 0],
      eject: [-0.2, 0.062, 0.012], sight: [-0.21, 0.072, 0], butt: [-0.635, 0, 0],
    },
  },
};

const toGame = (v) => new THREE.Vector3(v[2] || 0, v[1], -v[0]);
const SRC_TO_GAME = new THREE.Matrix4().makeRotationY(Math.PI / 2); // (x, y, z) → (z, y, -x)

const protos = new Map();
export const importedIds = () => Object.keys(IMPORTED);
export const importedProto = (id) => protos.get(id) || null;

/** Load every imported gun once; resolves even if a file is missing (that gun keeps its code model). */
export function preloadImportedGuns() {
  const loader = new GLTFLoader();
  return Promise.all(Object.entries(IMPORTED).map(([id, cfg]) => new Promise((resolve) => {
    loader.load(BASE + cfg.file, (gltf) => {
      try { protos.set(id, convert(id, cfg, gltf.scene)); } catch (e) { console.warn('gun import failed', id, e); }
      resolve();
    }, undefined, (e) => { console.warn('gun model missing', id, e?.message || e); resolve(); });
  })));
}

function convert(id, cfg, src) {
  src.updateMatrixWorld(true);
  const gun = new THREE.Group();
  gun.name = 'gun:' + id;
  const body = new THREE.Group();
  gun.add(body);
  const grip = toGame(cfg.anchors.grip);
  body.position.copy(grip).negate();

  const partOf = new Map();
  const groups = {};
  for (const [name, p] of Object.entries(cfg.parts || {})) {
    const g = new THREE.Group();
    g.name = name;
    const pivot = toGame(p.pivot);
    g.position.copy(pivot);
    g.userData.pivot = pivot.clone();
    g.userData.rest = pivot.clone();
    g.userData.place = p.place;
    body.add(g);
    groups[name] = g;
    for (const n of p.nodes) partOf.set(n, name);
  }

  const meshes = [];
  src.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const o of meshes) {
    const top = topNamed(o, src);
    if (cfg.hide?.includes(top.name)) continue;
    const m = new THREE.Mesh(o.geometry, o.material);
    m.name = o.name;
    const mat = SRC_TO_GAME.clone().multiply(o.matrixWorld);
    const partName = partOf.get(top?.name);
    if (partName && groups[partName].userData.place) {
      // re-seat a part that the source models off to the side
      const pl = groups[partName].userData.place;
      const local = new THREE.Matrix4().makeTranslation(...pl.pos).multiply(new THREE.Matrix4().makeRotationZ(pl.rotZ || 0));
      const nodeW = top.matrixWorld.clone();
      const rel = nodeW.clone().invert().multiply(o.matrixWorld); // mesh inside its node
      mat.copy(SRC_TO_GAME).multiply(local).multiply(rel);
    }
    m.applyMatrix4(mat);
    m.castShadow = true;
    m.receiveShadow = true;
    if (cfg.sticker?.includes(top?.name)) m.userData.sticker = true;
    if (partName) { m.position.sub(groups[partName].userData.pivot); groups[partName].add(m); }
    else body.add(m);
  }
  // keep the source's own PBR, just make sure it reacts to the scene environment like our materials
  body.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const mt of ms) { if (mt.envMapIntensity !== undefined) mt.envMapIntensity = 1; }
  });

  const local = (name) => cfg.anchors[name] ? toGame(cfg.anchors[name]).sub(grip) : null;
  const muzzle = new THREE.Object3D(); muzzle.name = 'muzzle';
  muzzle.position.copy(local('muzzle'));
  gun.add(muzzle);
  const eject = new THREE.Object3D(); eject.name = 'eject';
  eject.position.copy(local('eject') || new THREE.Vector3(0.02, 0.05, -0.1));
  gun.add(eject);
  const stickerParts = [];
  gun.traverse((o) => { if (o.userData.sticker) stickerParts.push(o); });
  gun.userData = {
    muzzle, eject,
    support: local('support'),
    sight: local('sight'),
    butt: cfg.anchors.butt ? toGame(cfg.anchors.butt).z - grip.z : 0.1,
    stickerParts,
    parts: groups,
    imported: true,
  };
  return gun;
}

/** The direct child of the source root that contains `o` (the named node from the file). */
function topNamed(o, root) {
  let n = o;
  while (n.parent && n.parent !== root) n = n.parent;
  return n;
}
