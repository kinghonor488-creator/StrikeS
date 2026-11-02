// k47 (AKM): see kit.js for the authoring conventions (side view, centimetres).
// Layout (x): stock -23.6..0, stamped receiver 0..25, rear sight block 24.4..31.2,
// handguards 26..45, gas block 45.8..49.2, front sight 58.4..62.4, slant brake 62.4..66.4.
// Real AKM: 88 cm overall, 41.5 cm barrel. This model: ~90 cm.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GM, CM, pathShape, tube, lathe, rbox, box, trigger } from '../kit.js';

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

/** Cylinder along the bore with a slanted front face (AKM brake). */
function slantTube(r, len, slant) {
  const g = new THREE.CylinderGeometry(r * CM, r * CM, len * CM, 22, 1);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -len * CM / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getZ(i) < -len * CM * 0.99) p.setZ(i, p.getZ(i) + (p.getX(i) + r * CM) * slant);
  g.computeVertexNormals();
  return g;
}

const pts = (a) => a.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`);

export default (b) => {
  const y = 5; // bore axis
  const RW = 3.4; // receiver width

  // ---------------------------------------------------------------- receiver
  b.add(rslab('M -0.3 5.9 L -0.3 1.6 Q -0.2 1.1 0.6 1.0 L 13.0 1.0 L 13.0 0.7 L 20.6 0.7 L 21.0 1.1 L 25.0 1.4 L 25.0 6.4 L 0.3 6.4 Q -0.3 6.4 -0.3 5.9 Z', RW, 0.3, 2),
    GM.park, 0, 0, 0, 0, { sticker: true });
  // stamped side rails (the lips the dust cover sits on)
  b.add(rbox(24.6, 0.5, RW + 0.25, 0.15), GM.park, 12.5, 6.15);
  // ribbed dust cover: rounded top, rear button for the recoil spring guide
  const coverSec = 'M -1.78 6.3 L 1.78 6.3 L 1.78 7.2 Q 1.72 8.05 0.85 8.15 L -0.85 8.15 Q -1.72 8.05 -1.78 7.2 Z';
  b.add(prism(coverSec, 24.2, 0.25), GM.park, 0.4, 0);
  const ribSec = 'M -1.86 6.9 L 1.86 6.9 L 1.86 7.25 Q 1.8 8.25 0.88 8.32 L -0.88 8.32 Q -1.8 8.25 -1.86 7.25 Z';
  for (const rx of [3.0, 4.2, 5.4, 18.6, 19.8, 21.0]) b.add(prism(ribSec, 0.55, 0.12), GM.park, rx, 0);
  b.add(tube(0.42, 0.7, 0.42, 12), GM.steel, -0.3, 7.15);
  b.add(rbox(0.6, 0.9, 1.1, 0.2), GM.steel, 0.1, 7.15);
  // ejection slot on the right side of the cover, charging handle on the bolt carrier
  b.add(box(6.4, 0.55, 0.12), GM.dark, 16.2, 6.62, 1.8);
  b.add(rbox(1.2, 0.7, 1.4, 0.2), GM.steel, 20.4, 6.5, 2.2);
  b.add(new THREE.SphereGeometry(0.65 * CM, 14, 10).scale(1.15, 0.85, 1), GM.steel, 20.4, 6.5, 3.15);
  // safety / selector lever (right side): pivot at the rear, long blade, finger tab at the front
  b.add(rslab('M 0.7 6.35 L 17.4 6.35 L 18.3 5.0 L 17.3 4.7 L 16.6 5.5 L 2.6 5.45 Q 0.7 5.3 0.7 6.35 Z', 0.3, 0.08, 1), GM.steel, 0, 0, RW / 2 + 0.16);
  rivet(b, 1.5, 5.85, RW / 2 + 0.32, 0.38);
  // rivets & pins: rear trunnion, fire-control pins, front trunnion
  for (const [rx, ry] of [[1.2, 2.3], [1.2, 4.0], [5.6, 3.4], [8.4, 3.4], [11.3, 3.4], [22.3, 2.3], [23.4, 3.9], [24.2, 2.3], [14.5, 1.7], [19.2, 1.7]]) rivet(b, rx, ry, RW / 2, 0.3);
  // magazine-well dimple
  b.add(new THREE.SphereGeometry(1 * CM, 14, 8).scale(0.12, 0.55, 1.3), GM.park, 17.0, 3.6, RW / 2 - 0.05, 0, { mirror: true });
  // trigger guard, mag catch paddle
  trigger(b, 7.6, 1.05, 5.2, GM.park, GM.steel);
  b.add(rslab('M 13.0 1.0 L 14.0 1.0 L 13.6 -1.4 Q 13.4 -1.8 12.9 -1.7 L 12.6 -1.4 Z', 1.4, 0.15, 1), GM.steel);

  // ---------------------------------------------------------------- stock (walnut) + buttplate
  const stockTaper = (x) => 0.86 + Math.min(1, Math.max(0, -x / 22)) * 0.2;
  b.add(rslab('M 0.2 6.1 L -21.9 3.6 Q -22.7 3.5 -22.7 2.6 L -22.9 -8.6 Q -22.8 -9.3 -22.0 -9.3 L -18.0 -7.7 L -6.0 -1.4 Q -2.0 0.7 0.2 1.0 Z', 3.6, 0.9, 3, stockTaper),
    GM.wood, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M -22.55 3.75 L -23.3 3.75 Q -23.6 3.6 -23.6 3.0 L -23.6 -9.0 Q -23.5 -9.6 -22.8 -9.6 L -22.45 -9.45 L -22.65 3.0 Z', 3.95, 0.3, 2), GM.steel);
  b.add(rbox(5.5, 0.45, 1.4, 0.15), GM.park, -2.4, 5.95, 0, 0.11); // receiver tang over the wrist
  rivet(b, -2.6, 4.4, 1.62, 0.28);
  b.add(new THREE.TorusGeometry(0.75 * CM, 0.16 * CM, 6, 14), GM.steel, -17.5, -6.4, -1.95, 0, { yaw: Math.PI / 2 });
  b.add(rbox(1.6, 0.9, 0.3, 0.1), GM.steel, -17.5, -6.2, -1.85);

  // ---------------------------------------------------------------- bakelite pistol grip
  b.add(rslab('M 3.0 1.1 L 7.6 1.1 Q 7.4 0.0 6.9 -0.6 L 4.4 -9.2 Q 4.0 -10.1 3.0 -10.1 L 0.6 -10.1 Q -0.3 -9.9 -0.1 -9.0 L 2.2 -1.6 Q 2.6 -0.4 3.0 1.1 Z', 2.9, 0.8, 3), GM.bakelite);
  for (let i = 0; i < 5; i++) {
    const t = i / 4; // vertical grip ribs along the grip axis
    b.add(box(0.3, 5.6, 0.24), GM.bakelite, 2.3 + t * 2.7, -4.6, 1.5, -17 * D, { mirror: true });
  }

  // ---------------------------------------------------------------- magazine (curved, ribbed steel)
  b.group('mag', 17.0, 1.0);
  const C = [60, 6.2], Rr = 46.6, Rf = 40.1;
  const P = (R, a) => [C[0] - R * Math.cos(a * D), C[1] - R * Math.sin(a * D)];
  const arc = (R, a0, a1, n = 12) => Array.from({ length: n + 1 }, (_, i) => P(R, a0 + (a1 - a0) * i / n));
  const band = (R0, R1, a0, a1, n = 12) => `M ${pts(arc(R0, a0, a1, n)).join(' L ')} L ${pts(arc(R1, a1, a0, n)).join(' L ')} Z`;
  b.add(rslab(band(Rr, Rf, 4, 33.6, 16), 2.9, 0.35, 2), GM.park, 0, 0, 0, 0, { group: 'mag' });
  // lengthwise stamped ribs following the curve
  for (const k of [1.55, 3.25, 4.95]) b.add(rslab(band(Rr - k + 0.28, Rr - k - 0.28, 9, 30.5, 12), 3.2, 0.12, 1), GM.park, 0, 0, 0, 0, { group: 'mag' });
  // floor plate (slightly proud), front & rear locking lugs
  b.add(rslab(band(Rr + 0.25, Rf - 0.3, 32.6, 34.6, 2), 3.3, 0.3, 2), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  b.add(rslab(band(Rf + 0.05, Rf - 0.55, 4, 7, 2), 2.0, 0.15, 1), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  b.add(rslab(band(Rr + 0.6, Rr - 0.05, 5.5, 8.5, 2), 1.6, 0.15, 1), GM.steel, 0, 0, 0, 0, { group: 'mag' });

  // ---------------------------------------------------------------- rear sight block & leaf
  b.add(rslab('M 24.4 3.6 L 31.2 3.6 L 31.2 7.7 Q 31.0 8.7 29.9 8.75 L 25.4 8.75 L 24.4 8.2 Z', 3.0, 0.45, 2), GM.steel);
  b.add(rslab('M 25.0 8.6 L 30.4 8.6 L 30.4 9.05 L 26.0 9.35 L 25.0 9.55 Z', 1.7, 0.1, 1), GM.steel);
  b.add(rbox(0.5, 0.75, 1.7, 0.08), GM.steel, 25.2, 9.6);
  b.add(rbox(1.0, 0.5, 2.1, 0.12), GM.steel, 27.6, 9.35);
  b.add(rbox(0.35, 0.5, 0.6, 0.08), GM.steel, 27.6, 9.55, 1.15);
  // upper-handguard retaining lever (right side)
  b.add(rbox(1.4, 0.7, 0.4, 0.12), GM.steel, 31.0, 7.9, 1.6, 0.25);

  // ---------------------------------------------------------------- barrel, gas system
  b.add(lathe([[0, 0], [1.2, 0], [1.2, 7], [1.02, 8], [0.98, 20], [0.86, 34], [0.86, 38.2], [0, 38.2]], 20), GM.blued, 25, y);
  b.add(tube(0.95, 4.2, 0.95, 18), GM.steel, 42.4, 8.0); // exposed gas-tube front with vents
  for (const vx of [43.0, 43.9, 44.8]) b.add(new THREE.CylinderGeometry(0.22 * CM, 0.22 * CM, 2.0 * CM, 8).rotateZ(Math.PI / 2), GM.dark, vx, 8.0);
  // gas block: barrel collar + slanted gas port up to the tube
  b.add(rbox(3.4, 2.9, 2.9, 0.5), GM.steel, 47.5, y);
  b.add(rslab('M 45.8 5.6 L 49.2 5.6 L 49.2 6.6 L 48.3 9.0 Q 48.0 9.15 47.4 9.1 L 45.8 9.1 Z', 2.3, 0.35, 2), GM.steel);
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.15 * CM, 6, 14), GM.steel, 47.5, 2.9, -1.5, 0, { yaw: Math.PI / 2 });
  b.add(rbox(1.2, 0.8, 0.4, 0.1), GM.steel, 47.5, 3.6, -1.35);

  // ---------------------------------------------------------------- handguards (walnut)
  b.add(rslab('M 25.0 6.4 L 26.6 6.4 L 26.6 1.4 L 25.0 1.4 Z', 4.2, 0.3, 2), GM.steel); // rear retainer
  const hgTaper = (x) => 0.9 + 0.1 * Math.sin(Math.min(1, Math.max(0, (x - 26.6) / 17)) * Math.PI);
  b.add(rslab('M 26.6 6.7 L 43.6 6.7 L 43.6 1.6 L 42.8 1.25 Q 42.2 1.75 40.6 1.7 L 30.2 1.35 Q 28.0 1.3 26.6 2.0 Z', 4.7, 1.25, 3, hgTaper),
    GM.wood, 0, 0, 0, 0, { sticker: true });
  b.add(rslab('M 43.5 7.1 L 45.4 7.1 L 45.4 1.9 Q 45.2 1.5 44.6 1.5 L 43.5 1.5 Z', 4.1, 0.4, 2), GM.steel); // front ferrule
  const upSec = 'M -1.5 6.75 L 1.5 6.75 L 1.58 7.9 Q 1.52 9.35 0 9.55 Q -1.52 9.35 -1.58 7.9 Z';
  b.add(prism(upSec, 11.6, 0.45), GM.wood, 31.0, 0);

  // ---------------------------------------------------------------- front sight, cleaning rod, brake
  b.add(rslab('M 58.4 2.3 L 62.4 2.3 L 62.4 6.3 L 61.9 6.7 L 59.4 6.7 L 58.4 6.1 Z', 2.8, 0.4, 2), GM.steel);
  b.add(rslab('M 59.9 6.4 L 61.9 6.4 L 61.6 9.6 Q 61.3 10.4 60.6 10.4 Q 59.9 10.2 59.95 9.4 Z', 0.35, 0.08, 1), GM.steel, 0, 0, 1.0, 0, { mirror: true });
  b.add(rbox(0.9, 0.6, 2.3, 0.15), GM.steel, 60.9, 6.8);
  b.add(rbox(0.4, 2.8, 0.45, 0.08), GM.steel, 60.9, 8.2);
  b.add(rbox(0.9, 1.0, 1.1, 0.15), GM.steel, 61.0, 2.0); // bayonet lug
  b.add(tube(0.3, 17.6, 0.3, 10), GM.steel, 44.4, 2.85); // cleaning rod
  b.add(rbox(0.8, 1.0, 0.8, 0.2), GM.steel, 62.4, 2.85);
  b.add(slantTube(1.12, 4.0, 0.9), GM.steel, 62.4, y);
  b.add(tube(0.45, 0.1, 0.45, 12), GM.dark, 66.05, y);
  b.add(rbox(1.6, 0.4, 0.5, 0.1), GM.steel, 62.2, 6.1, 0.5); // brake detent pin

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', 4.4, -3.5);
  b.anchor('support', 36, 3.6);
  b.anchor('muzzle', 66.4, y);
  b.anchor('eject', 16.5, 6.6, 2.0);
  b.anchor('butt', -23.6, 0);
  b.anchor('sight', 25.2, 9.95);
};
