// m249: see kit.js for the authoring conventions (side view, centimetres).
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

// m249 (FN Minimi / M249 SAW): stamped box receiver with side ribs, feed cover with rail and rear sight,
// fixed polymer stock, under-barrel gas cylinder and lower handguard, ribbed heat shield, carry handle,
// folded bipod, tall front post, 200-round box under the receiver. Real: 104 cm overall, 46.5 cm barrel.
export default (b) => {
  const y = 6;
  const RW = 5.4;

  // ---------------------------------------------------------------- receiver
  b.add(rslab('M 0 8.9 L 0 1.6 Q 0 0.8 0.8 0.8 L 31.2 0.8 Q 32.0 0.8 32.0 1.6 L 32.0 8.9 Z', RW, 0.35, 2), GM.park, 0, 0, 0, 0, { sticker: true });
  for (const ry of [2.2, 3.6, 7.6]) b.add(rbox(29.0, 0.45, RW + 0.3, 0.15), GM.park, 16.0, ry); // stamped ribs
  for (let i = 0; i < 7; i++) for (const ry of [1.4, 8.3]) b.add(new THREE.CylinderGeometry(0.28 * CM, 0.28 * CM, (RW + 0.25) * CM, 8).rotateZ(Math.PI / 2), GM.steel, 2.5 + i * 4.5, ry);
  // charging handle slot + handle (right), belt feed tray and STANAG well (left)
  b.add(box(18.0, 0.5, 0.12), GM.dark, 20.0, 5.6, RW / 2 + 0.17);
  b.add(rbox(1.4, 1.1, 1.6, 0.25), GM.steel, 25.0, 5.6, RW / 2 + 0.9);
  b.add(rbox(0.9, 2.6, 0.9, 0.35), GM.steel, 25.0, 6.4, RW / 2 + 1.6, 0, { roll: -0.3 });
  b.add(rslab('M 14.4 7.4 L 21.8 7.4 L 21.8 9.6 L 14.4 9.6 Z', 2.4, 0.3, 2), GM.park, 0, 0, -RW / 2 - 1.0);
  b.add(rslab('M 22.0 3.2 L 28.0 3.2 L 28.0 0.6 L 22.0 0.6 Z', 2.2, 0.3, 2), GM.park, 0, 0, -RW / 2 - 0.6); // magazine well (STANAG)
  // ejection port cover (underside, right)
  b.add(box(7.0, 0.8, 0.12), GM.dark, 18.0, 1.6, RW / 2 + 0.03);
  // feed cover with rail and rear sight
  b.add(prism('M -2.4 8.7 L 2.4 8.7 L 2.4 9.8 Q 2.3 10.6 1.5 10.7 L -1.5 10.7 Q -2.3 10.6 -2.4 9.8 Z', 25.0, 0.3), GM.park, 3.0, 0);
  rail(b, 9.0, 27.0, 11.4, GM.alu);
  b.add(rbox(3.6, 1.2, 3.0, 0.3), GM.park, 5.0, 11.2); // rear sight base
  b.add(rslab('M 4.2 11.4 L 5.8 11.4 L 5.6 13.2 L 4.4 13.2 Z', 2.2, 0.2, 1), GM.steel);
  b.add(box(0.5, 0.7, 0.4), GM.dark, 5.0, 12.8);
  b.add(rbox(1.6, 1.4, 1.6, 0.3), GM.steel, 3.2, 10.4, 0); // cover latch
  b.add(rslab('M 28.0 8.6 L 32.4 8.6 L 32.4 10.8 L 28.0 10.6 Z', RW - 0.4, 0.3, 2), GM.park); // front of cover / barrel lock

  // ---------------------------------------------------------------- grip, guard, stock
  b.add(rslab('M 5.4 0.9 L 10.2 0.9 Q 10.3 0.0 9.8 -0.8 Q 9.4 -1.6 9.6 -2.4 Q 9.8 -3.2 9.3 -3.9 L 7.4 -9.4 Q 7.0 -10.3 5.9 -10.3 L 3.6 -10.3 Q 2.7 -10.1 2.8 -9.1 L 3.4 -7.0 Q 3.8 -5.0 4.4 -2.0 Q 4.8 -0.6 5.4 0.9 Z', 3.2, 0.85, 3), GM.polymer);
  for (let i = 0; i < 6; i++) b.add(box(0.25, 4.6, 0.2), GM.polymer, 4.4 + i * 0.6, -5.0, 1.6, -18 * D, { mirror: true });
  b.add(rslab('M 7.0 0.9 L 15.4 0.9 L 15.4 -0.4 Q 15.0 -3.4 12.6 -3.4 L 8.6 -3.4 Q 7.6 -3.2 7.6 -2.0 Z M 10.2 0.4 L 14.6 0.4 L 14.4 -0.6 Q 14.0 -2.6 12.4 -2.6 L 10.4 -2.6 Z', 1.4, 0.2, 2), GM.park);
  b.add(rslab('M 11.0 0.9 L 12.0 0.9 Q 11.9 -0.5 11.2 -1.6 L 10.7 -1.4 Q 11.2 -0.3 11.0 0.9 Z', 0.6, 0.1, 1), GM.steel);
  b.add(rbox(1.6, 0.8, 0.6, 0.2), GM.steel, 6.0, 0.4, 1.7, 0.3); // cross-bolt safety
  b.add(rslab('M 0.4 8.6 L -21.0 8.6 Q -24.6 8.6 -25.8 7.4 L -26.6 6.4 L -26.6 -3.4 Q -26.4 -4.4 -25.4 -4.4 L -23.0 -4.0 L -12.0 -0.6 L -2.0 1.4 L 0.4 1.6 Z M -4.0 6.6 L -22.0 6.6 Q -23.8 6.4 -23.8 4.8 L -23.8 -1.6 L -12.4 1.2 L -4.0 3.0 Z', 3.8, 0.8, 3),
    GM.polymer, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M -26.4 8.8 L -28.0 8.8 Q -28.3 8.6 -28.3 8.0 L -28.3 -4.0 Q -28.2 -4.8 -27.4 -4.8 L -26.4 -4.6 Z', 4.4, 0.5, 2), GM.rubber);
  b.add(rslab('M -26.0 8.6 L -27.6 8.6 L -27.4 12.4 Q -27.2 13.0 -26.6 12.8 L -26.0 12.2 Z', 1.6, 0.3, 2), GM.steel); // shoulder rest (folded)
  b.add(rbox(2.0, 6.0, 4.0, 0.4), GM.steel, -0.4, 5.0); // stock latch block
  b.add(new THREE.TorusGeometry(0.8 * CM, 0.17 * CM, 6, 14), GM.steel, -14.0, 9.2, 0, 0, { yaw: Math.PI / 2 });

  // ---------------------------------------------------------------- ammo box (mag group) + belt
  b.group('mag', 22.6, 0.8);
  b.add(rslab('M 15.6 0.6 L 29.8 0.6 L 30.0 -11.4 Q 30.0 -12.4 29.0 -12.4 L 16.4 -12.4 Q 15.4 -12.4 15.4 -11.4 Z', 8.4, 0.8, 3), GM.olive, 0, 0, -0.6, 0, { group: 'mag' });
  b.add(rbox(14.8, 0.5, 8.7, 0.2), GM.olive, 22.7, -1.2, -0.6, 0, { group: 'mag' }); // lid seam
  b.add(rbox(1.6, 2.2, 0.6, 0.25), GM.steel, 22.7, -3.0, 3.75, 0, { group: 'mag' }); // latch
  b.add(rbox(9.6, 5.0, 0.3, 0.6), GM.olive, 22.7, -7.2, 3.66, 0, { group: 'mag' }); // stamped panels
  b.add(rbox(9.6, 5.0, 0.3, 0.6), GM.olive, 22.7, -7.2, -4.86, 0, { group: 'mag' });
  b.add(rbox(2.0, 1.4, 6.0, 0.3), GM.steel, 22.7, 1.0, -1.6, 0, { group: 'mag' }); // mount to the receiver
  // belt rising from the box into the left feed tray: rounds point forward, links behind them
  const round = lathe([[0, 0], [0.48, 0], [0.48, 0.2], [0.45, 2.7], [0.3, 3.4], [0.28, 4.0], [0.18, 4.6], [0, 4.7]], 10);
  for (let i = 0; i < 6; i++) {
    const by = 1.2 + i * 1.08;
    b.add(round, GM.brass, 15.2, by, -RW / 2 - 1.0 - (i < 2 ? 0.6 - i * 0.3 : 0), 0, { group: 'mag' });
    b.add(box(1.6, 0.9, 1.2), GM.dark, 16.3, by, -RW / 2 - 0.9, 0, { group: 'mag' });
  }

  // ---------------------------------------------------------------- barrel group
  b.add(lathe([[0, 0], [1.4, 0], [1.4, 3.0], [1.15, 3.6], [1.05, 20], [0.95, 39.4], [0, 39.4]], 22), GM.blued, 32.0, y);
  b.add(tube(0.95, 27.0, 0.95, 18), GM.park, 32.0, 2.9); // gas cylinder
  b.add(rslab('M 32.0 5.2 L 46.0 5.2 L 46.0 1.6 Q 45.8 0.9 44.8 0.9 L 33.0 0.8 Q 32.0 0.8 32.0 1.8 Z', 6.0, 1.2, 3), GM.polymer, 0, 0, 0, 0, { sticker: false }); // lower handguard
  for (let i = 0; i < 5; i++) b.add(box(1.6, 0.4, 6.1), GM.dark, 34.0 + i * 2.4, 2.8);
  // ribbed heat shield over the barrel
  b.add(prism('M -1.9 6.3 L 1.9 6.3 L 1.9 7.0 Q 1.8 7.9 0 8.0 Q -1.8 7.9 -1.9 7.0 Z', 18.0, 0.15), GM.steel, 33.4, 0);
  for (let i = 0; i < 8; i++) b.add(box(0.6, 0.25, 3.9), GM.dark, 35.0 + i * 2.0, 7.95);
  // carry handle (on the barrel)
  b.add(rbox(3.0, 2.4, 2.4, 0.4), GM.park, 36.0, 8.2);
  b.add(rslab('M 34.4 9.2 L 36.6 9.2 L 38.2 12.6 L 46.6 12.6 L 47.4 11.4 L 45.4 11.4 L 44.6 11.8 L 39.0 11.8 L 37.6 9.2 Z', 1.6, 0.3, 2), GM.polymer);
  b.add(rbox(8.4, 1.4, 1.8, 0.5), GM.polymer, 42.6, 12.1);
  // gas block + regulator, bipod (folded back under the gas cylinder)
  b.add(rslab('M 57.0 1.4 L 61.0 1.4 L 61.0 7.4 L 60.0 7.6 L 57.0 7.6 Z', 3.2, 0.45, 2), GM.park);
  b.add(rbox(1.0, 1.4, 4.0, 0.3), GM.steel, 61.4, 2.9); // regulator lever
  b.add(rbox(2.6, 1.6, 4.0, 0.4), GM.park, 55.2, 2.6); // bipod yoke
  for (const s of [-1, 1]) {
    b.add(rbox(15.0, 0.9, 0.9, 0.3), GM.steel, 47.0, 2.2, s * 1.7, 0.02);
    b.add(rbox(6.0, 1.1, 1.1, 0.3), GM.steel, 41.0, 2.1, s * 1.7, 0.02);
    b.add(rbox(1.4, 0.7, 1.4, 0.2), GM.rubber, 38.4, 2.0, s * 1.7);
  }
  // tall front post
  b.add(rbox(1.8, 1.8, 2.4, 0.4), GM.park, 66.0, 7.0);
  b.add(rslab('M 65.4 7.6 L 66.6 7.6 L 66.4 12.2 L 65.6 12.2 Z', 0.6, 0.12, 1), GM.steel);
  for (const s of [-1, 1]) b.add(rslab('M 65.0 7.6 L 67.0 7.6 L 66.8 11.4 Q 66.4 12.0 66.0 11.6 L 65.2 8.6 Z', 0.3, 0.06, 1), GM.park, 0, 0, s * 0.95);
  const mz = muzzle(b, 71.4, y, 'flash', 1.0, GM.park);
  b.add(tube(0.45, 0.1, 0.45, 12), GM.dark, 71.4 + mz - 0.05, y);

  b.anchor('grip', 6.4, -3.6);
  b.anchor('support', 40, 1.4);
  b.anchor('muzzle', 71.4 + mz, y);
  b.anchor('eject', 18.0, 1.8, RW / 2 + 0.2);
  b.anchor('butt', -28.3, 0);
  b.anchor('sight', 5.0, 13.0);
};
