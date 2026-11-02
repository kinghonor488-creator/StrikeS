// The arsenal. Side-view authoring in centimetres (see kit.js). Each model declares
// anchors: grip (firing hand), support (off hand), muzzle, eject, butt, sight,
// and movable groups: mag, slide, bolt, pump.
import * as THREE from 'three';
import { importedProto } from './imported.js';
import { GunBuilder } from './kit.js';
import k47 from './models/k47.js';
import m4 from './models/m4.js';
import g35 from './models/g35.js';
import f25 from './models/f25.js';
import sg5 from './models/sg5.js';
import a3 from './models/a3.js';
import s08 from './models/s08.js';
import aw1 from './models/aw1.js';
import m249 from './models/m249.js';
import n7 from './models/n7.js';
import x14 from './models/x14.js';
import m10 from './models/m10.js';
import mp9 from './models/mp9.js';
import mp7 from './models/mp7.js';
import p90 from './models/p90.js';
import g18 from './models/g18.js';
import p25 from './models/p25.js';
import f7 from './models/f7.js';
import s1 from './models/s1.js';
import d50 from './models/d50.js';
import t9 from './models/t9.js';
import knife from './models/knife.js';
import inkpen from './models/inkpen.js';

// One file per gun in ./models (each default-exports (builder, accent) => void).
const M = { k47, m4, g35, f25, sg5, a3, s08, aw1, m249, n7, x14, m10, mp9, mp7, p90, g18, p25, f7, s1, d50, t9, knife, inkpen };

// ---------------------------------------------------------------------- public
const protos = new Map();

function cloneGun(proto) {
  const ud = proto.userData;
  proto.userData = {};
  const c = proto.clone(true);
  proto.userData = ud;
  const find = (name) => c.getObjectByName(name);
  const data = {
    muzzle: find('muzzle'), eject: find('eject'),
    support: ud.support ? ud.support.clone() : null,
    sight: ud.sight ? ud.sight.clone() : null,
    butt: ud.butt, stickerParts: [], parts: {},
  };
  c.traverse((o) => { if (o.userData.sticker) data.stickerParts.push(o); });
  for (const name of Object.keys(ud.parts)) {
    const p = find(name);
    if (!p) continue;
    const r = p.userData.rest;
    p.userData.rest = new THREE.Vector3(r.x, r.y, r.z);
    data.parts[name] = p;
  }
  c.userData = data;
  return c;
}

/** Build (or clone a cached) gun model. Forward is -Z, origin at the firing grip. */
export function buildGunModel(id, accent) {
  const scanned = importedProto(id);
  if (scanned) return cloneGun(scanned);
  const key = `${id}|${accent || ''}`;
  if (!protos.has(key)) {
    const b = new GunBuilder(id);
    (M[id] || M.p25)(b, accent);
    const proto = b.build();
    proto.userData.muzzle.name = 'muzzle';
    proto.userData.eject.name = 'eject';
    protos.set(key, proto);
  }
  return cloneGun(protos.get(key));
}

export const MODEL_IDS = Object.keys(M);
