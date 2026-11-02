// p90: FN P90 (TR, railed top). See kit.js for the authoring conventions (side view, centimetres).
// Bullpup: one-piece polymer shell with the trigger opening, grip column and rear thumbhole,
// front hand stop, smoked translucent top magazine with the rounds visible, rail bridge with
// flip-up sights, side cocking handles, slotted flash hider.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b) => {
  const y = 3.6; // bore line
  const body = GM.paint('#2b2e2a', 0.6);

  // --- shell: outline + trigger opening + thumbhole -----------------------------------------
  b.add(slab(`M -18.6 5.0 Q -18.6 6.2 -17.4 6.2 L 23.6 6.2 Q 25.2 6.0 25.2 4.6 L 25.2 1.4 Q 25.0 0.0 23.6 -0.2 L 22.6 -0.4
    L 22.6 -5.0 Q 22.6 -5.8 21.8 -5.8 Q 21.0 -5.8 21.0 -5.0 L 21.0 -1.4 Q 20.9 -1.0 20.4 -1.0 Q 19.9 -1.0 19.9 -1.6
    L 19.9 -7.6 Q 19.8 -9.8 17.4 -9.8 L 3.0 -9.8 Q -1.0 -9.8 -3.0 -8.0 Q -5.0 -6.4 -9.0 -6.2 L -17.4 -6.0 Q -18.6 -5.9 -18.6 -4.6 Z
    M 14.8 -1.0 L 17.0 -1.0 Q 18.3 -1.0 18.3 -2.4 L 18.3 -6.8 Q 18.3 -8.2 16.9 -8.2 L 14.8 -8.2 Q 13.4 -8.2 13.4 -6.8 L 13.4 -2.4 Q 13.4 -1.0 14.8 -1.0 Z
    M 2.6 -1.6 L 8.6 -1.6 Q 10.2 -1.6 10.2 -3.2 L 10.2 -6.6 Q 10.2 -8.2 8.6 -8.2 L 3.0 -8.2 Q 0 -8.2 0 -5.0 Q 0 -1.6 2.6 -1.6 Z`, 5.6, 0.95), body, 0, 0, 0, 0, { sticker: true });
  // parting line between the upper receiver and the lower shell, a few moulded pins
  for (const s of [-1, 1]) {
    b.add(box(30, 0.1, 0.06), GM.dark, -2.6, 0.6, s * 2.81);
    b.add(box(6.6, 0.1, 0.06), GM.dark, -15.0, -2.0, s * 2.81);
  }
  for (const [px, py] of [[-14.4, 2.6], [-6.0, 2.6], [12.0, 0.2], [22.0, 1.8]]) screw(b, px, py, 2.75, GM.dark, 0.3);
  // rubber butt pad, sling points
  b.add(slab('M -19.1 -5.4 L -18.3 -5.4 L -18.3 5.2 L -19.1 5.2 Z', 5.2, 0.25), GM.rubber);
  swivel(b, -16.4, -6.5); swivel(b, 21.8, 6.6);
  // down-ejection chute behind the grip
  b.add(rbox(3.6, 0.12, 2.2, 0.05), GM.dark, 1.6, -10.56);

  // --- trigger, selector disc ----------------------------------------------------------------
  b.add(slab('M 14.2 -1.0 L 15.0 -1.0 Q 15.0 -2.4 14.4 -3.4 L 14.0 -3.2 Q 14.4 -2.3 14.2 -1.0 Z', 0.6, 0.1), GM.steel);
  b.add(new THREE.CylinderGeometry(1.0 * CM, 1.0 * CM, 0.35 * CM, 18), GM.dark, 15.9, -8.05);
  b.add(rbox(0.5, 0.3, 1.4, 0.1), GM.steel, 15.9, -7.8);

  // --- side cocking handles + slots -------------------------------------------------------------
  for (const s of [-1, 1]) {
    b.add(box(13.0, 0.5, 0.06), GM.dark, 15.0, 4.4, s * 2.81);
    b.add(new THREE.CylinderGeometry(0.45 * CM, 0.45 * CM, 0.8 * CM, 12).rotateZ(Math.PI / 2), GM.steel, 21.0, 4.4, s * 3.1);
    b.add(new THREE.CylinderGeometry(0.75 * CM, 0.7 * CM, 0.9 * CM, 16).rotateZ(Math.PI / 2), GM.polymer, 21.0, 4.4, s * 3.8);
  }

  // --- rail bridge over the magazine, flip-up sights ---------------------------------------
  b.add(slab('M 17.6 5.8 L 23.2 5.8 Q 23.0 8.0 22.6 10.6 L 17.6 10.6 Z', 4.4, 0.45), body);
  b.add(rbox(4.6, 1.6, 0.2, 0.08), GM.glass, 20.2, 8.4, 2.2); // optic window
  b.add(rbox(4.6, 1.6, 0.2, 0.08), GM.glass, 20.2, 8.4, -2.2);
  for (const s of [-1, 1]) b.add(rbox(2.2, 4.8, 0.45, 0.15), body, 4.5, 8.3, s * 2.78);
  rail(b, 3.4, 22.6, 11.4, GM.alu, 2.2);
  b.add(rbox(19.2, 0.5, 6.0, 0.2), GM.alu, 13.0, 10.45); // rail base spans the bracket
  // rear aperture
  b.add(rbox(2.2, 0.8, 2.2, 0.2), GM.alu, 5.0, 11.8);
  b.add(slab('M 4.4 12.0 L 5.6 12.0 L 5.5 13.8 L 4.5 13.8 Z M 4.75 13.45 L 5.25 13.45 L 5.25 12.95 L 4.75 12.95 Z', 1.4, 0.15), GM.steel);
  b.add(rbox(1.4, 1.4, 0.35, 0.1), GM.alu, 5.0, 12.6, 1.0, 0, { mirror: true });
  // front post with ears
  b.add(rbox(2.0, 0.8, 2.2, 0.2), GM.alu, 21.2, 11.8);
  b.add(box(0.35, 1.6, 0.35), GM.steel, 21.2, 12.8);
  b.add(rbox(1.2, 1.9, 0.35, 0.1), GM.alu, 21.2, 12.9, 0.95, 0, { mirror: true });

  // --- barrel + flash hider ---------------------------------------------------------------------
  b.add(tube(0.7, 2.2, 0.7, 16), GM.steel, 25.0, y);
  b.add(lathe([[0, 0], [0.95, 0], [1.0, 0.3], [1.0, 4.0], [0.9, 4.2], [0.5, 4.2], [0.5, 3.6], [0, 3.6]], 18), GM.steel, 27.2, y);
  for (let k = 0; k < 3; k++) b.add(box(2.2, 0.28, 2.1), GM.dark, 29.6, y, 0, 0, { roll: k * Math.PI / 3 });

  // --- top magazine: smoked shell, rounds inside, metal feed lips & rear latch ------------
  b.group('mag', 2, 7.7);
  b.add(slab('M -12.6 6.2 L 17.4 6.2 L 17.4 8.4 Q 17.4 9.2 16.6 9.2 L -11.8 9.2 Q -12.6 9.2 -12.6 8.4 Z', 5.0, 0.35), GM.translucent('#3c4148'), 0, 0, 0, 0, { group: 'mag' });
  b.add(rbox(27.6, 1.0, 3.4, 0.4), GM.brass, 2.6, 7.6, 0, 0, { group: 'mag' });
  for (const s of [-1, 1]) b.add(rbox(29.0, 0.35, 0.3, 0.1), GM.dark, 2.4, 9.05, s * 2.25, 0, { group: 'mag' });
  b.add(rbox(1.6, 2.8, 5.1, 0.3), GM.steel, 16.6, 7.6, 0, 0, { group: 'mag' });
  b.add(slab('M -13.6 6.4 L -12.4 6.4 L -12.4 9.4 L -13.0 9.4 Q -13.8 9.2 -13.6 8.2 Z M -13.2 8.6 L -12.8 8.6 L -12.8 7.2 L -13.2 7.2 Z', 2.4, 0.15), GM.bright, 0, 0, 0, 0, { group: 'mag' });

  b.anchor('grip', 11.8, -4.6); b.anchor('support', 19.6, -1.2); b.anchor('muzzle', 31.4, y);
  b.anchor('eject', 1.6, -10.8, 0.4); b.anchor('butt', -19.1, 0); b.anchor('sight', 5.0, 13.6);
};
