// mp9: B&T MP9 (9 mm). See kit.js for the authoring conventions (side view, centimetres).
// Polymer upper with a full-length integral rail, rear T charging handle, ribbed pistol grip
// holding the magazine, enclosed trigger guard, folding vertical foregrip, threaded muzzle cap,
// and the side-folding skeleton stock shown extended.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

/** Bent rod/tube through side-view points [x, y, z?] (cm). */
function wire(b, pts, r, mat, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => new THREE.Vector3(z * CM, y * CM, -x * CM)), false, 'centripetal');
  b.add(new THREE.TubeGeometry(curve, opts.seg || 24, r * CM, opts.radial || 8, false), mat, 0, 0, 0, 0, opts);
}

export default (b) => {
  const y = 4.4; // bore line
  const P = GM.polymer;

  // --- upper receiver + integral top rail ------------------------------------------------
  b.add(slab('M -0.8 1.8 L 22.6 1.8 L 23.4 2.6 L 23.4 6.0 L 22.0 7.4 L -0.4 7.4 Q -0.8 7.4 -0.8 7.0 Z', 4.0, 0.45), P, 0, 0, 0, 0, { sticker: true });
  rail(b, 0.2, 21.8, 8.3, P, 2.2);
  // moulded side panels / grooves
  for (const s of [-1, 1]) {
    b.add(box(15, 0.12, 0.06), GM.dark, 10.6, 6.6, s * 2.01);
    b.add(box(9, 0.12, 0.06), GM.dark, 15.6, 3.0, s * 2.01);
    b.add(box(4, 0.12, 0.06), GM.dark, 4.0, 3.0, s * 2.01);
    b.add(slab('M 1.0 6.1 L 7.6 6.1 L 7.6 3.8 L 1.0 3.8 Z', 0.16, 0.06), P, 0, 0, s * 2.04);
  }
  b.add(rbox(1.4, 0.8, 0.4, 0.15), GM.steel, 14.2, 3.6, -2.15); // safety / bolt catch (left)
  // ejection port (right) with the bolt behind it
  b.add(box(5.0, 1.6, 0.08), GM.dark, 12.6, 5.4, 2.02);
  b.add(box(4.4, 1.0, 0.06), GM.steel, 12.8, 5.4, 2.05);
  // flip-up sights on the rail ends
  b.add(rbox(1.4, 1.2, 2.0, 0.2), P, 1.0, 8.9);
  b.add(rbox(0.5, 1.0, 1.2, 0.1), P, 0.9, 9.6);
  b.add(box(0.52, 0.3, 0.3), GM.dark, 0.9, 9.85);
  b.add(rbox(1.2, 1.0, 1.8, 0.2), P, 21.2, 8.8);
  b.add(box(0.35, 0.9, 0.3), GM.steel, 21.2, 9.6);
  // rear T charging handle
  b.add(rbox(1.0, 0.8, 5.0, 0.3), P, -1.2, 6.6);
  b.add(rbox(1.6, 0.6, 1.2, 0.2), GM.steel, -0.8, 6.6);

  // --- lower frame, pistol grip, trigger --------------------------------------------------
  b.add(slab('M 0.4 2.0 L 21.4 2.0 L 21.4 0.6 Q 21.2 -0.2 20.4 -0.2 L 11 -0.2 L 9.6 0.4 L 2.0 0.4 Q 0.4 0.6 0.4 2.0 Z', 4.4, 0.5), P);
  b.add(slab('M 2.4 0.6 L 8.8 0.6 L 8.1 -10.0 Q 7.9 -10.8 7.1 -10.8 L 2.7 -10.8 Q 1.7 -10.6 1.7 -9.6 L 1.9 -1.2 Z', 3.8, 0.6), P);
  for (let i = 0; i < 7; i++) {
    const yy = -3.2 - i * 0.95, fx = 8.8 - (0.6 - yy) * 0.068, rx = 1.85 + (0.6 - yy) * -0.01;
    b.add(rbox(fx - rx - 0.6, 0.4, 4.0, 0.18), P, (fx + rx) / 2, yy);
  }
  b.add(rbox(0.8, 0.9, 1.0, 0.2), GM.steel, 1.6, -9.6); // heel mag release
  b.add(slab('M 8.4 0.4 L 14.6 0.4 Q 14.8 -0.6 14.0 -1.8 Q 12.6 -3.8 9.8 -3.9 L 8.2 -3.7 Z M 9.0 -0.2 L 13.4 -0.2 Q 12.9 -2.5 10.2 -3.1 L 8.9 -3.0 Z', 1.4, 0.3), P);
  b.add(slab('M 10.2 0.4 L 11.1 0.4 Q 11.1 -1.0 10.4 -2.1 L 10.0 -1.9 Q 10.5 -0.9 10.2 0.4 Z', 0.6, 0.1), GM.steel);

  // --- folding vertical foregrip ----------------------------------------------------------
  b.add(rbox(4.6, 1.0, 2.6, 0.3), P, 18.8, -0.4);
  b.add(new THREE.CylinderGeometry(0.35 * CM, 0.35 * CM, 3.0 * CM, 10).rotateZ(Math.PI / 2), GM.steel, 17.2, -0.4);
  b.add(slab('M 16.6 -0.6 L 20.6 -0.6 L 20.9 -8.6 Q 20.8 -9.4 20.0 -9.4 L 17.4 -9.4 Q 16.5 -9.4 16.5 -8.6 Z', 3.4, 0.7), P);
  for (let i = 0; i < 6; i++) b.add(rbox(4.0, 0.35, 3.6, 0.15), P, 18.7, -3.4 - i * 0.95);

  // --- barrel + threaded muzzle cap, front sling hook ------------------------------------
  b.add(tube(0.75, 2.2, 0.75, 16), GM.steel, 23.2, y);
  b.add(lathe([[0, 0], [0.95, 0], [1.05, 0.15], [1.05, 2.4], [0.95, 2.6], [0.45, 2.6], [0.45, 2.3], [0, 2.3]], 20), GM.steel, 25.2, y);
  for (let i = 0; i < 3; i++) b.add(lathe([[1.07, 0], [1.07, 0.2]], 20), GM.dark, 25.6 + i * 0.5, y);
  b.add(slab('M 21.6 1.9 L 23.0 1.9 L 23.2 0.2 Q 23.0 -0.8 22.2 -0.8 L 21.8 -0.6 L 22.2 0.2 L 21.6 0.6 Z', 1.0, 0.15), GM.steel);

  // --- skeleton stock (extended) ------------------------------------------------------------
  b.add(rbox(1.6, 3.6, 3.4, 0.4), P, -1.4, 4.6);
  b.add(new THREE.CylinderGeometry(0.5 * CM, 0.5 * CM, 3.6 * CM, 12), GM.steel, -1.9, 4.6, 1.2);
  wire(b, [[-1.8, 6.0], [-6, 5.6], [-14, 4.8], [-20.5, 4.0], [-22.4, 3.6]], 0.6, GM.park, { radial: 10 });
  wire(b, [[-1.8, 3.4], [-5, 3.2], [-9, 3.4], [-13, 4.6]], 0.35, GM.park);
  b.add(slab('M -24.2 -3.4 L -22.6 -3.4 L -21.6 6.4 Q -21.8 7.2 -22.6 7.2 L -23.2 7.2 Z', 3.6, 0.6), P);
  b.add(slab('M -24.4 -3.0 L -23.8 -3.0 L -22.9 6.8 L -23.4 6.8 Z', 3.2, 0.2), GM.rubber);

  // --- magazine (in the grip) ---------------------------------------------------------------
  b.group('mag', 5.0, -10.8);
  b.add(slab('M 3.0 -6 L 6.9 -6 L 7.0 -18.4 L 3.2 -18.4 Z', 2.5, 0.25), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  for (const s of [-1, 1]) b.add(box(0.6, 5.4, 0.06), GM.dark, 4.0, -14.8, s * 1.26, 0, { group: 'mag' });
  b.add(rbox(4.6, 0.8, 3.0, 0.3), P, 5.1, -18.7, 0, 0, { group: 'mag' });

  b.anchor('grip', 5.4, -3.4); b.anchor('support', 18.7, -4.6); b.anchor('muzzle', 27.8, y);
  b.anchor('eject', 12.6, 5.8, 2.1); b.anchor('butt', -24.4, 0); b.anchor('sight', 0.9, 9.9);
};
