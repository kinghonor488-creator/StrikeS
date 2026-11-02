// sg5: see kit.js for the authoring conventions (side view, centimetres).
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GM, CM, pathShape, tube, lathe, rbox, box, trigger, rail, muzzle, scope, screw } from '../kit.js';

const D = Math.PI / 180;

/** Side-view slab with soft multi-segment bevels and creased normals. Path = true outline. */
function rslab(d, thick, bevel = 0.4, segs = 3, taper = null) {
  const b = Math.min(bevel, thick * 0.45);
  const depth = Math.max(0.02, thick - 2 * b);
  const geo = new THREE.ExtrudeGeometry(pathShape(d), {
    depth, bevelEnabled: true, bevelThickness: b, bevelSize: b * 0.85, bevelOffset: -b * 0.85, bevelSegments: segs, curveSegments: 8,
  });
  geo.translate(0, 0, -depth / 2);
  geo.rotateY(Math.PI / 2);
  geo.scale(CM, CM, CM);
  if (taper) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * taper(-p.getZ(i) / CM, p.getY(i) / CM));
  }
  return toCreasedNormals(geo, 0.7);
}

/** Cross-section (z sideways, y up; cm) extruded along the bore for len cm, starting at the placed x. */
function prism(d, len, bevel = 0.2) {
  const geo = new THREE.ExtrudeGeometry(pathShape(d), {
    depth: Math.max(0.02, len - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelOffset: -bevel * 0.8, bevelSegments: 2, curveSegments: 8,
  });
  geo.translate(0, 0, bevel);
  geo.rotateY(Math.PI);
  geo.scale(CM, CM, CM);
  return toCreasedNormals(geo, 0.7);
}

/** Domed rivet / pin head on both sides of a part of half-width hw. */
function rivet(b, x, y, hw, r = 0.32, mat = GM.steel) {
  const g = new THREE.SphereGeometry(r * CM, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2).scale(0.45, 1, 1);
  b.add(g, mat, x, y, hw);
  b.add(g.clone().rotateY(Math.PI), mat, x, y, -hw);
}

const pts = (a) => a.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`);

/** Ribbed curved magazine from arcs around centre C (rear radius Rr, front radius Rf), angles in degrees. */
function curvedMag(b, C, Rr, Rf, a0, a1, mat, ribMat = mat, thick = 2.8) {
  const P = (R, a) => [C[0] - R * Math.cos(a * D), C[1] - R * Math.sin(a * D)];
  const arc = (R, s, e, n) => Array.from({ length: n + 1 }, (_, i) => P(R, s + (e - s) * i / n));
  const band = (R0, R1, s, e, n = 12) => `M ${pts(arc(R0, s, e, n)).join(' L ')} L ${pts(arc(R1, e, s, n)).join(' L ')} Z`;
  const span = a1 - a0, w = Rr - Rf;
  b.add(rslab(band(Rr, Rf, a0, a1, 14), thick, 0.35, 2), mat, 0, 0, 0, 0, { group: 'mag' });
  for (const k of [0.25, 0.5, 0.75]) b.add(rslab(band(Rr - w * k + 0.28, Rr - w * k - 0.28, a0 + span * 0.18, a1 - span * 0.08, 10), thick + 0.3, 0.12, 1), ribMat, 0, 0, 0, 0, { group: 'mag' });
  b.add(rslab(band(Rr + 0.3, Rf - 0.35, a1 - span * 0.06, a1 + span * 0.02, 2), thick + 0.45, 0.3, 2), mat, 0, 0, 0, 0, { group: 'mag' });
}

// sg5 (SIG SG 55x as in CS2's "SG 553"): stamped steel upper with rail and 4x prism optic, polymer lower with
// integrated guard, long vented handguard, ring-hooded front sight, smoke-polymer curved mag, AR-type stock.
// Real SG 551: 83 cm overall; this model ~86 cm.
export default (b) => {
  const y = 5;
  const fur = GM.polymer;

  // ---------------------------------------------------------------- upper receiver (steel) + rail + optic
  b.add(rslab('M 0 4.0 L 24.4 4.0 L 24.4 7.6 Q 24.3 8.1 23.8 8.1 L 0.6 8.1 Q 0 8.1 0 7.5 Z', 3.5, 0.35, 2), GM.park, 0, 0, 0, 0, { sticker: true });
  for (const s of [-1, 1]) b.add(rbox(22.6, 0.22, 0.12, 0.05), GM.dark, 12.4, 6.9, s * 1.76); // stamped groove
  rail(b, 0.6, 24.0, 9.0, GM.alu);
  // ejection port + reciprocating cocking handle (right), cocking slot
  b.add(box(6.0, 1.3, 0.12), GM.dark, 15.2, 5.8, 1.77);
  b.add(box(5.0, 0.35, 0.12), GM.dark, 21.4, 6.6, 1.77);
  b.add(rbox(1.1, 0.7, 1.6, 0.2), GM.steel, 22.6, 6.6, 2.3);
  b.add(lathe([[0, 0], [0.55, 0], [0.62, 0.4], [0.62, 1.0], [0.45, 1.3], [0, 1.3]], 14), GM.steel, 22.6, 6.6, 3.0, 0, { yaw: -Math.PI / 2 });
  // 4x prism optic with forward bell, turrets, and a small reflex on top
  const sy = 12.5, sx0 = 7.0, slen = 14.5;
  b.add(rslab(`M ${sx0 + 1.2} 9.0 L ${sx0 + slen - 2} 9.0 L ${sx0 + slen - 3} ${sy - 1.2} L ${sx0 + 2.2} ${sy - 1.2} Z`, 2.4, 0.4, 2), GM.alu); // body/mount
  b.add(lathe([[0, 0], [1.75, 0], [1.75, 1.6], [1.5, 2.4], [1.5, slen - 5.5], [2.2, slen - 3.2], [2.3, slen - 0.6], [2.1, slen], [0, slen]], 26), GM.alu, sx0, sy);
  b.add(tube(1.95, 0.25, 1.95, 24), GM.glass, sx0 + slen - 0.2, sy);
  b.add(tube(1.45, 0.25, 1.45, 24), GM.glass, sx0 - 0.05, sy);
  b.add(rbox(4.6, 2.2, 3.0, 0.5), GM.alu, sx0 + 6.8, sy + 0.4); // prism housing
  b.add(new THREE.CylinderGeometry(0.85 * CM, 0.9 * CM, 1.4 * CM, 16), GM.alu, sx0 + 6.8, sy + 2.0);
  b.add(new THREE.CylinderGeometry(0.85 * CM, 0.9 * CM, 1.4 * CM, 16).rotateX(Math.PI / 2), GM.alu, sx0 + 6.8, sy + 0.2, 2.0);
  b.add(rbox(3.0, 1.3, 2.0, 0.3), GM.alu, sx0 + 3.6, sy + 2.2); // reflex sight on top
  b.add(rbox(0.2, 1.0, 1.4, 0.05), GM.glass, sx0 + 4.4, sy + 2.9);
  for (const xx of [sx0 + 3, sx0 + slen - 4.5]) b.add(rbox(1.4, 0.7, 2.6, 0.2), GM.steel, xx, 9.25); // cross bolts
  b.add(rbox(1.4, 0.8, 0.5, 0.15), GM.steel, sx0 + slen - 4.5, 9.4, -1.6);

  // ---------------------------------------------------------------- polymer lower, integrated guard, grip
  b.add(rslab('M 0 4.1 L 24.4 4.1 L 24.4 2.6 Q 24.2 1.6 23.0 1.4 L 17.9 0.7 L 17.9 0.1 L 10.9 0.1 L 10.9 0.8 L 6.8 0.8 L 6.8 1.9 L 0.6 1.9 Q 0 2.0 0 2.8 Z', 3.8, 0.4, 2), fur, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M 5.4 1.2 L 11.4 1.2 L 11.0 -1.6 Q 10.2 -3.2 8.4 -3.2 L 6.8 -3.2 Q 6.2 -3.2 6.0 -2.4 Z M 6.6 0.5 L 10.4 0.5 L 10.1 -1.4 Q 9.6 -2.4 8.4 -2.4 L 7.2 -2.4 Q 6.8 -2.4 6.7 -1.8 Z', 1.4, 0.3, 2), fur);
  b.add(rslab('M 7.6 0.8 L 8.6 0.8 Q 8.5 -0.6 7.8 -1.7 L 7.3 -1.5 Q 7.8 -0.4 7.6 0.8 Z', 0.6, 0.1, 1), GM.steel);
  b.add(rslab('M 1.6 2.0 L 6.4 2.0 Q 6.6 0.6 6.2 -0.6 L 4.8 -9.0 Q 4.4 -10.1 3.2 -10.1 L 1.0 -10.1 Q -0.1 -9.9 0.0 -8.8 L 0.4 -6.6 Q 0.4 -4.0 0.0 -2.4 Q -0.2 -0.6 1.6 2.0 Z', 3.2, 0.9, 3), fur);
  for (let i = 0; i < 6; i++) b.add(box(0.22, 4.4, 0.2), fur, 1.4 + i * 0.6, -5.0, 1.6, -14 * D, { mirror: true });
  b.add(rbox(1.8, 0.6, 0.5, 0.15), GM.steel, 4.0, 3.2, 2.05, 0.3, { mirror: true }); // ambi selector
  b.add(rbox(1.0, 1.2, 0.5, 0.15), GM.steel, 10.4, 0.2, 0, 0); // mag release
  for (const [px_, py_] of [[2.0, 3.2], [9.8, 3.0], [22.4, 3.0]]) for (const s of [-1, 1]) b.add(new THREE.CylinderGeometry(0.3 * CM, 0.3 * CM, 0.2 * CM, 10).rotateZ(Math.PI / 2), GM.steel, px_, py_, s * 1.95);

  // ---------------------------------------------------------------- magazine (smoked polymer, clip studs)
  b.group('mag', 14.4, 0.6);
  curvedMag(b, [86.1, 5.0], 75, 68.6, 3, 19, GM.polymer, GM.polymer, 2.7);
  for (const s of [-1, 1]) b.add(rbox(1.2, 1.4, 0.6, 0.25), GM.polymer, 14.6, -3.0, s * 1.55, 0.1, { group: 'mag' });

  // ---------------------------------------------------------------- stock: hinge, buffer tube, AR-type butt
  b.add(rslab('M -2.2 2.2 L 0.2 2.2 L 0.2 8.0 L -2.2 8.0 Z', 3.6, 0.4, 2), GM.park);
  b.add(new THREE.CylinderGeometry(0.5 * CM, 0.5 * CM, 5.6 * CM, 12), GM.steel, -1.9, 5.0, 1.8);
  b.add(tube(1.5, 12.0, 1.5, 20), GM.alu, -14.0, 5.6);
  for (let i = 0; i < 5; i++) b.add(box(0.5, 0.45, 1.2), GM.dark, -3.4 - i * 1.6, 3.95);
  b.add(rslab('M -3.0 7.4 L -16.6 8.0 Q -17.6 8.0 -17.8 7.0 L -18.2 -2.6 Q -18.2 -3.5 -17.4 -3.5 L -15.6 -3.3 L -11.6 1.6 L -4.2 3.3 Q -3.0 3.5 -3.0 4.4 Z M -12.6 3.2 L -15.9 -1.0 L -15.9 5.0 Q -15.9 5.6 -15.2 5.6 L -12.6 5.4 Z', 3.7, 0.7, 3),
    fur, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M -17.9 7.9 L -19.4 7.9 Q -19.7 7.7 -19.7 7.1 L -19.9 -3.1 Q -19.8 -3.9 -19.0 -3.9 L -18.2 -3.7 Z', 4.1, 0.45, 2), GM.rubber);
  b.add(rbox(3.0, 1.0, 1.0, 0.3), fur, -6.0, 3.3, 0, -0.15);

  // ---------------------------------------------------------------- vented handguard, barrel, front sight
  b.add(rslab('M 24.2 8.3 L 47.6 8.3 Q 48.2 8.2 48.2 7.6 L 48.2 2.6 Q 48.1 1.8 47.2 1.7 L 25.6 1.4 Q 24.2 1.4 24.2 2.4 Z', 4.6, 0.6, 3), fur);
  rail(b, 24.6, 47.6, 9.0, GM.alu);
  for (let r = 0; r < 2; r++) for (let i = 0; i < 9; i++) b.add(box(1.5, 0.75, 0.3), GM.dark, 27.0 + i * 2.35, 4.0 + r * 2.1, 2.22, 0, { mirror: true }); // vent slots
  b.add(lathe([[0, 0], [1.1, 0], [1.1, 3], [0.92, 4], [0.86, 20], [0.8, 38.4], [0, 38.4]], 20), GM.blued, 24.0, y);
  b.add(rslab('M 48.4 2.9 L 51.4 2.9 L 51.4 7.4 L 50.8 8.0 L 48.4 8.0 Z', 2.6, 0.4, 2), GM.park); // gas block / sight base
  b.add(new THREE.TorusGeometry(1.15 * CM, 0.28 * CM, 8, 20), GM.park, 49.8, 9.4); // ring hood
  b.add(rbox(0.45, 2.6, 0.45, 0.1), GM.steel, 49.8, 8.9);
  b.add(rbox(1.6, 0.9, 1.4, 0.2), GM.park, 50.6, 2.4); // bayonet lug
  b.add(tube(0.55, 2.2, 0.5, 10), GM.steel, 51.4, 7.0); // gas regulator
  const mz = muzzle(b, 62.2, y, 'flash', 0.9, GM.park);
  b.add(tube(0.4, 0.1, 0.4, 12), GM.dark, 62.2 + mz - 0.05, y);

  b.anchor('grip', 3.4, -3.6);
  b.anchor('support', 37, 2.6);
  b.anchor('muzzle', 62.2 + mz, y);
  b.anchor('eject', 15.2, 5.8, 1.9);
  b.anchor('butt', -19.9, 0);
  b.anchor('sight', sx0, sy);
};
