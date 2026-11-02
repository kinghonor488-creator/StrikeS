// mp7: H&K MP7A1 (4.6 mm). See kit.js for the authoring conventions (side view, centimetres).
// Sculpted polymer receiver with full top rail, flip-up front/rear sights, short side rails on the
// nose, folding vertical foregrip, slotted flash hider, rear T charging handle, retracted
// telescoping stock (side rods + tall butt plate), ribbed grip with the magazine inside.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b) => {
  const y = 4.4; // bore line
  const P = GM.polymer;

  // --- receiver -------------------------------------------------------------------------
  b.add(slab('M -4.0 3.0 L 21 3.0 L 26.4 3.3 Q 27.2 3.5 27.2 4.3 L 27.2 5.6 L 25.4 7.2 L -3.0 7.2 Q -4.0 7.2 -4.0 6.2 Z', 4.2, 0.55), P, 0, 0, 0, 0, { sticker: true });
  b.add(slab('M -3.6 3.2 L 20.2 3.2 L 20.2 1.0 Q 19.4 0.2 17.8 0.2 L 9.8 0.2 Q 8.8 0.2 8.6 -0.4 L 3.2 -0.4 Q 0.4 -0.3 -1.2 1.0 L -3.6 1.4 Z', 4.0, 0.5), P);
  b.add(slab('M 20 3.3 L 26.6 3.5 L 26.4 1.4 Q 25.6 0.4 24.4 0.4 L 20 0.4 Z', 3.6, 0.5), P);
  rail(b, -1.4, 25.0, 7.95, P, 2.2);
  // moulded side detail: raised panel, seam, pins
  for (const s of [-1, 1]) {
    b.add(slab('M 1.0 6.4 L 14.6 6.4 L 15.6 5.0 L 15.6 3.8 L 1.0 3.8 Z', 0.16, 0.06), P, 0, 0, s * 2.12);
    b.add(box(22, 0.1, 0.06), GM.dark, 8.2, 3.1, s * 2.11);
  }
  for (const [px, py] of [[-2.2, 2.2], [2.2, 2.4], [17.6, 2.0], [24.6, 2.2]]) screw(b, px, py, 2.05, GM.steel, 0.25);
  // ejection port + bolt (right)
  b.add(box(4.4, 1.5, 0.08), GM.dark, 11.0, 5.3, 2.13);
  b.add(box(3.8, 0.9, 0.06), GM.steel, 11.2, 5.3, 2.16);
  // ambi selector + mag/bolt release
  for (const s of [-1, 1]) {
    b.add(new THREE.CylinderGeometry(0.5 * CM, 0.5 * CM, 0.3 * CM, 12).rotateZ(Math.PI / 2), GM.steel, 4.2, 2.2, s * 2.15);
    b.add(rbox(2.2, 0.5, 0.3, 0.12), GM.steel, 5.0, 2.0, s * 2.3, -0.2);
  }
  b.add(rbox(1.0, 1.0, 4.6, 0.25), GM.steel, 15.0, 1.8);
  // short side rails on the nose
  for (const s of [-1, 1]) {
    b.add(rbox(7.0, 1.6, 0.5, 0.12), P, 21.6, y, s * 2.1);
    for (let i = 0; i < 7; i++) b.add(box(0.5, 1.7, 0.4), P, 18.6 + i, y, s * 2.45);
  }
  // rear T charging handle
  b.add(rbox(1.0, 0.8, 5.4, 0.3), P, -3.4, 6.7);
  b.add(rbox(1.4, 0.6, 1.4, 0.2), GM.steel, -3.0, 6.7);
  // flip-up sights (raised): rear aperture, front post with hood
  b.add(rbox(2.0, 0.9, 2.2, 0.2), P, -0.6, 8.4);
  b.add(slab('M -1.2 8.6 L 0 8.6 L -0.1 10.6 L -1.1 10.6 Z M -0.85 10.25 L -0.35 10.25 L -0.35 9.75 L -0.85 9.75 Z', 1.4, 0.15), GM.steel);
  b.add(rbox(2.0, 0.9, 2.2, 0.2), P, 23.8, 8.4);
  b.add(slab('M 23.2 8.6 L 24.4 8.6 L 24.3 10.8 L 23.3 10.8 Z M 23.45 10.5 L 24.15 10.5 L 24.15 9.4 L 23.45 9.4 Z', 1.6, 0.15), GM.steel);
  b.add(box(0.3, 1.0, 0.3), GM.steel, 23.8, 9.9);

  // --- grip + trigger guard ---------------------------------------------------------------
  b.add(slab('M 3.2 0 L 9.4 0 L 8.7 -10.2 Q 8.5 -10.9 7.7 -10.9 L 3.6 -10.9 Q 2.6 -10.8 2.6 -9.8 Z', 3.6, 0.6), P);
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) b.add(rbox(0.4, 6.2, 0.2, 0.08), P, 4.0 + i * 0.85, -6.0, s * 1.86, 0.06);
  b.add(slab('M 8.6 0.2 L 14.6 0.2 Q 14.6 -1.0 13.8 -2.0 Q 12.6 -3.6 10.2 -3.7 L 8.4 -3.6 Z M 9.2 -0.4 L 13.4 -0.4 Q 12.8 -2.6 10.4 -3.0 L 9.0 -2.9 Z', 1.3, 0.3), P);
  b.add(slab('M 10.4 0.2 L 11.3 0.2 Q 11.3 -1.2 10.6 -2.2 L 10.2 -2.0 Q 10.7 -1.0 10.4 0.2 Z', 0.6, 0.1), GM.steel);

  // --- folding foregrip ---------------------------------------------------------------------
  b.add(new THREE.CylinderGeometry(0.4 * CM, 0.4 * CM, 3.2 * CM, 10).rotateZ(Math.PI / 2), GM.steel, 21.4, 0.6);
  b.add(slab('M 21.0 0.6 L 24.8 0.6 L 24.4 -8.6 Q 24.2 -9.3 23.4 -9.3 L 21.8 -9.3 Q 21.0 -9.3 21.0 -8.6 Z', 3.0, 0.6), P);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.add(box(0.3, 6.0, 0.1), GM.dark, 21.9 + i * 0.9, -4.8, s * 1.5);

  // --- barrel + slotted flash hider ---------------------------------------------------------
  b.add(tube(0.65, 4.4, 0.65, 16), GM.steel, 27.0, y);
  b.add(lathe([[0, 0], [0.9, 0], [0.95, 0.4], [0.95, 3.9], [0.85, 4.1], [0.5, 4.1], [0.5, 3.6], [0, 3.6]], 18), GM.steel, 31.3, y);
  for (let k = 0; k < 3; k++) b.add(box(2.4, 0.3, 2.2), GM.dark, 33.6, y, 0, 0, { roll: k * Math.PI / 3 });

  // --- retracted telescoping stock ------------------------------------------------------------
  for (const s of [-1, 1]) {
    b.add(tube(0.38, 16.4, 0.38, 10), GM.park, -4.6, 3.6, s * 2.22);
    b.add(sphere(0.42), GM.park, 11.8, 3.6, s * 2.22);
  }
  b.add(slab('M -6.4 -2.8 L -4.4 -2.8 L -4.2 6.4 Q -4.4 7.2 -5.2 7.2 L -6.0 7.0 Q -6.5 6.6 -6.5 5.8 Z', 4.8, 0.6), P);
  b.add(slab('M -6.7 -2.4 L -6.2 -2.4 L -6.3 5.6 L -6.8 5.6 Z', 4.4, 0.2), GM.rubber);
  b.add(rbox(1.0, 1.4, 1.4, 0.3), GM.steel, -4.4, -1.8); // stock release

  // --- magazine ---------------------------------------------------------------------------------
  b.group('mag', 5.8, -10.9);
  b.add(slab('M 3.6 -6 L 7.8 -6 L 7.9 -18.2 L 3.7 -18.2 Z', 2.4, 0.25), P, 0, 0, 0, 0, { group: 'mag' });
  for (const s of [-1, 1]) b.add(box(0.5, 5.6, 0.06), GM.dark, 4.6, -14.6, s * 1.22, 0, { group: 'mag' });
  b.add(rbox(5.0, 0.9, 3.0, 0.3), P, 5.8, -18.5, 0, 0, { group: 'mag' });

  b.anchor('grip', 6.0, -3.2); b.anchor('support', 22.8, -4.2); b.anchor('muzzle', 35.4, y);
  b.anchor('eject', 11.0, 5.8, 2.2); b.anchor('butt', -6.8, 0); b.anchor('sight', -0.6, 10.3);
};
