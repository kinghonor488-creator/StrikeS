// g35: see kit.js for the authoring conventions (side view, centimetres).
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

// g35 (Galil ACE 23 as in CS2's "Galil AR"): AK-pattern receiver with top rail, round ribbed polymer
// handguard, tall Galil front sight, side-folding M4-style stock. Real: ~96 cm overall, 46 cm barrel.
export default (b) => {
  const y = 5;
  const RW = 3.6;
  const fur = GM.polymer;

  // ---------------------------------------------------------------- receiver + top cover + rail
  b.add(rslab('M 0 6.0 L 0 1.3 Q 0 0.8 0.6 0.8 L 13.2 0.8 L 13.2 0.45 L 20.8 0.45 L 21.2 0.8 L 27.8 1.2 L 27.8 6.6 L 0.5 6.6 Q 0 6.6 0 6.0 Z', RW, 0.3, 2),
    GM.park, 0, 0, 0, 0, { sticker: true });
  b.add(rbox(27.4, 0.45, RW + 0.25, 0.15), GM.park, 13.9, 6.35);
  b.add(prism('M -1.9 6.4 L 1.9 6.4 L 1.9 7.2 Q 1.85 7.9 1.1 7.95 L -1.1 7.95 Q -1.85 7.9 -1.9 7.2 Z', 27.2, 0.25), GM.park, 0.4, 0);
  rail(b, 1.2, 27.2, 8.75, GM.alu);
  // folding rear aperture sight on the rail
  b.add(rbox(2.2, 0.9, 2.3, 0.2), GM.alu, 3.2, 9.15);
  b.add(rslab('M 2.5 9.4 L 3.9 9.4 L 3.7 11.1 L 2.7 11.1 Z', 1.6, 0.2, 1), GM.alu);
  b.add(new THREE.TorusGeometry(0.42 * CM, 0.14 * CM, 6, 14), GM.dark, 3.2, 10.45, 0, 0, { yaw: 0 });
  for (const s of [-1, 1]) b.add(rbox(1.6, 1.8, 0.35, 0.1), GM.alu, 3.2, 10.0, s * 1.05);
  // ejection port, AK-type right-side selector, left-side charging handle
  b.add(box(6.2, 0.9, 0.12), GM.dark, 18.2, 5.85, RW / 2 + 0.02);
  b.add(rslab('M 0.8 6.35 L 13.5 6.35 L 14.3 5.1 L 13.4 4.8 L 12.8 5.55 L 2.6 5.5 Q 0.8 5.4 0.8 6.35 Z', 0.3, 0.08, 1), GM.steel, 0, 0, RW / 2 + 0.16);
  rivet(b, 1.6, 5.9, RW / 2 + 0.32, 0.38);
  b.add(rbox(1.2, 0.8, 1.4, 0.2), GM.steel, 23.4, 6.6, -2.3);
  b.add(rbox(0.9, 1.6, 0.9, 0.35), GM.steel, 23.4, 7.4, -3.0, 0, { roll: 0.5 });
  b.add(rbox(1.6, 0.6, 0.5, 0.15), GM.steel, 6.6, 4.0, -RW / 2 - 0.15, 0.4); // ambi thumb selector
  for (const [rx, ry] of [[1.3, 2.3], [1.3, 4.1], [6.2, 3.0], [9.4, 3.0], [24.8, 2.4], [26.2, 4.2], [26.6, 2.4]]) rivet(b, rx, ry, RW / 2, 0.3);
  b.add(rslab('M 27.6 1.6 L 30.4 1.6 L 30.4 7.9 L 27.6 7.9 Z', RW + 0.3, 0.35, 2), GM.park); // front trunnion block
  trigger(b, 9.0, 0.85, 4.3, GM.park, GM.steel);
  b.add(rslab('M 13.2 0.8 L 14.2 0.8 L 13.8 -1.5 Q 13.6 -1.9 13.1 -1.8 L 12.8 -1.5 Z', 1.6, 0.15, 1), GM.steel);

  // ---------------------------------------------------------------- AR-style pistol grip
  b.add(rslab('M 4.0 0.9 L 8.3 0.9 Q 8.4 0.0 7.9 -0.8 Q 7.5 -1.6 7.7 -2.4 Q 7.9 -3.2 7.4 -3.9 L 5.5 -9.3 Q 5.1 -10.2 4.0 -10.2 L 1.8 -10.2 Q 0.9 -10.0 1.0 -9.0 L 1.6 -7.0 Q 2.0 -5.0 2.8 -2.0 Q 3.2 -0.6 4.0 0.9 Z', 3.0, 0.8, 3), fur);
  for (let i = 0; i < 6; i++) b.add(box(0.25, 4.6, 0.2), fur, 2.6 + i * 0.6, -5.0, 1.5, -18 * D, { mirror: true }); // stipple ribs

  // ---------------------------------------------------------------- side-folding hinge, buffer tube, stock
  b.add(rslab('M -2.8 1.6 L 0.2 1.6 L 0.2 7.2 L -2.8 7.2 Z', 3.8, 0.4, 2), GM.park);
  b.add(new THREE.CylinderGeometry(0.55 * CM, 0.55 * CM, 6.4 * CM, 12), GM.steel, -2.4, 4.4, 1.9);
  b.add(tube(1.5, 18.0, 1.5, 20), GM.alu, -20.6, 5.0);
  for (let i = 0; i < 6; i++) b.add(box(0.5, 0.45, 1.2), GM.dark, -9.8 - i * 1.6, 3.35);
  b.add(rslab('M -9.4 7.0 L -23.6 7.7 Q -24.6 7.7 -24.8 6.7 L -25.2 -3.4 Q -25.2 -4.3 -24.4 -4.3 L -22.6 -4.1 L -18.6 0.9 L -10.6 2.7 Q -9.4 2.9 -9.4 3.8 Z M -19.6 2.6 L -22.9 -1.8 L -22.9 4.6 Q -22.9 5.3 -22.2 5.3 L -19.6 5.0 Z', 3.7, 0.7, 3),
    fur, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M -24.9 7.6 L -26.4 7.6 Q -26.7 7.4 -26.7 6.8 L -26.9 -3.9 Q -26.8 -4.7 -26.0 -4.7 L -25.2 -4.5 Z', 4.1, 0.45, 2), GM.rubber);
  b.add(rbox(3.0, 1.0, 1.0, 0.3), fur, -12.4, 2.7, 0, -0.15); // adjustment latch
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.15 * CM, 6, 14), GM.steel, -21.0, -3.6, 0, 0, { yaw: Math.PI / 2 });

  // ---------------------------------------------------------------- magazine (35-rd, gently curved, ribbed)
  b.group('mag', 17.0, 0.8);
  curvedMag(b, [93.5, 6.0], 80, 73, 3, 19.5, GM.park, GM.park, 2.8);

  // ---------------------------------------------------------------- handguard, rail, barrel, sights
  b.add(lathe([[0, 0], [2.95, 0], [3.05, 0.5], [3.05, 2.4], [2.75, 3.0], [2.75, 20.6], [2.95, 21.2], [2.95, 22.4], [0, 22.4]], 28), fur, 30.2, y, 0, 0, { sticker: true });
  rail(b, 31.0, 51.6, 8.95, GM.alu);
  for (const a of [-58, -32, 32, 58, 140, 165, -140, -165]) { // lengthwise ribs around the tube
    const r = 2.82;
    b.add(rbox(16.4, 0.42, 0.42, 0.15), fur, 42.0, y + Math.cos(a * D) * r, Math.sin(a * D) * r);
  }
  for (const xx of [34.2, 47.6]) for (const s of [-1, 1]) b.add(box(1.0, 1.6, 0.35), GM.dark, xx, y, s * 2.72); // QD / vent slots
  b.add(lathe([[0, 0], [1.15, 0], [1.15, 4], [1.0, 5], [0.95, 22], [0.82, 34], [0.82, 36.6], [0, 36.6]], 20), GM.blued, 28.0, y);
  // gas block / tall Galil front sight
  b.add(rslab('M 52.6 2.7 L 57.9 2.7 L 57.9 6.3 L 57.0 8.3 L 53.6 8.3 L 52.6 7.5 Z', 2.7, 0.45, 2), GM.park);
  b.add(rslab('M 54.0 7.8 L 56.9 7.8 L 56.3 10.8 Q 55.9 11.6 55.4 11.6 Q 54.7 11.4 54.6 10.8 Z', 0.35, 0.08, 1), GM.park, 0, 0, 1.05, 0, { mirror: true });
  b.add(rbox(0.45, 2.9, 0.45, 0.1), GM.steel, 55.5, 9.1);
  b.add(rbox(2.6, 0.7, 2.4, 0.2), GM.park, 55.3, 8.1);
  b.add(tube(0.7, 2.0, 0.7, 12), GM.steel, 52.4, 7.4); // gas tube stub into the handguard
  b.add(rbox(1.4, 1.2, 1.2, 0.2), GM.park, 56.6, 2.3); // bayonet lug
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.15 * CM, 6, 14), GM.steel, 54.2, 2.0, -1.3, 0, { yaw: Math.PI / 2 });
  const mz = muzzle(b, 64.2, y, 'flash', 0.95, GM.park);
  b.add(tube(0.42, 0.1, 0.42, 12), GM.dark, 64.2 + mz - 0.05, y);

  b.anchor('grip', 4.8, -3.6);
  b.anchor('support', 42, 2.6);
  b.anchor('muzzle', 64.2 + mz, y);
  b.anchor('eject', 18.2, 5.9, 2.0);
  b.anchor('butt', -26.9, 0);
  b.anchor('sight', 3.2, 10.45);
};
