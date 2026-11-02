// t9: Intratec TEC-9 (9 mm). See kit.js for the authoring conventions (side view, centimetres).
// Stamped-steel upper with a top cocking knob, perforated barrel shroud with a threaded tip,
// polymer lower with a strongly raked stippled grip, mag well ahead of the trigger guard
// and a long straight 32-round magazine.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b) => {
  const y = 4.2; // bore line
  const S = GM.park;

  // --- upper receiver (stamped steel, rounded top) ---------------------------------------
  b.add(slab('M -1.6 2.0 L 15.8 2.0 L 15.8 5.8 Q 15.8 6.4 15.2 6.4 L -0.8 6.4 Q -1.6 6.4 -1.6 5.6 Z', 3.2, 0.5), S, 0, 0, 0, 0, { sticker: true });
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) b.add(box(0.12, 2.2, 0.06), GM.dark, 13.2 + i * 0.6, 4.8, s * 1.61, 0.45);
  // ejection port (right) + bolt
  b.add(box(4.0, 1.4, 0.08), GM.dark, 9.4, 4.8, 1.61);
  b.add(box(3.4, 0.9, 0.06), GM.steel, 9.6, 4.8, 1.64);
  // cocking knob riding in a slot on the top-left
  b.add(box(8.0, 0.08, 0.4), GM.dark, 9.0, 6.42, -0.7);
  b.add(new THREE.CylinderGeometry(0.32 * CM, 0.38 * CM, 1.4 * CM, 12), GM.steel, 12.0, 7.0, -0.7, 0, { roll: 0.25 });
  b.add(sphere(0.6), GM.steel, 12.0, 7.8, -0.9);
  // rear sight block, end cap
  b.add(rbox(1.6, 0.8, 1.8, 0.2), GM.steel, 0.4, 6.75);
  b.add(box(0.4, 0.3, 0.3), GM.dark, 0.4, 7.05);
  b.add(rbox(0.6, 4.2, 3.0, 0.2), S, -1.7, 4.2);

  // --- perforated barrel shroud, threaded tip --------------------------------------------
  b.add(lathe([[0, 0], [1.75, 0], [1.75, 0.6], [1.5, 0.8], [1.5, 12.2], [1.65, 12.4], [1.65, 12.9], [0.9, 13.1], [0, 13.1]], 24), S, 15.6, y);
  const R = 1.5;
  const hole = new THREE.CylinderGeometry(0.5 * CM, 0.5 * CM, 0.06 * CM, 14);
  for (let i = 0; i < 5; i++) {
    for (const [deg, off] of [[90, 0], [35, 1], [-30, 0], [-145, 1], [145, 0], [-90, 1]]) {
      const phi = THREE.MathUtils.degToRad(deg - 90); // 0 = top
      b.add(hole, GM.dark, 17.4 + i * 2.1 + off * 1.05, y + R * Math.cos(phi), -R * Math.sin(phi), 0, { roll: phi });
    }
  }
  b.add(tube(0.55, 0.06, 0.55, 12), GM.dark, 28.66, y); // bore
  b.add(lathe([[0, 0], [0.75, 0], [0.75, 1.0], [0.6, 1.1], [0, 1.1]], 16), GM.steel, 28.6, y);
  for (let i = 0; i < 3; i++) b.add(lathe([[0.78, 0], [0.78, 0.15]], 16), GM.dark, 28.8 + i * 0.3, y);
  b.add(tube(0.3, 0.05, 0.3, 10), GM.dark, 29.72, y);
  b.add(slab('M 27.2 5.6 L 28.2 5.6 L 28.0 6.5 L 27.5 6.5 Z', 0.4, 0.08), GM.steel); // front sight

  // --- polymer lower, raked grip, trigger --------------------------------------------------
  const P = GM.polymer;
  b.add(slab('M -1.4 2.2 L 15.4 2.2 L 15.4 0.6 Q 15.2 0.0 14.4 0.0 L 4.8 0.0 Q 4.4 0.0 4.2 -0.4 L 1.0 -10.0 Q 0.7 -10.8 -0.2 -10.8 L -3.6 -10.8 Q -4.6 -10.6 -4.4 -9.6 L -1.8 0.2 Q -2.4 1.0 -2.6 1.6 Q -2.2 2.2 -1.4 2.2 Z', 3.0, 0.5), P);
  for (const s of [-1, 1]) b.add(slab('M -1.0 -1.2 L 2.8 -1.2 L 0.2 -9.0 L -3.2 -9.0 Z', 0.3, 0.1), GM.rubber, 0, 0, s * 1.55);
  b.add(rbox(4.8, 0.7, 3.2, 0.3), P, -1.9, -10.9); // pommel lip
  // mag well housing ahead of the trigger
  b.add(slab('M 9.8 0.4 L 15.0 0.4 L 15.0 -5.0 Q 15.0 -5.6 14.4 -5.6 L 10.4 -5.6 Q 9.8 -5.6 9.8 -5.0 Z', 3.4, 0.45), P);
  b.add(rbox(0.8, 1.0, 3.6, 0.2), GM.steel, 9.4, -0.8); // mag release
  // thin guard from the grip to the mag well, trigger blade
  b.add(slab('M 4.0 -0.4 L 9.9 -0.4 L 9.9 -3.0 L 9.6 -3.6 L 3.4 -3.6 L 3.2 -2.9 L 9.0 -2.9 L 9.0 -1.0 L 4.2 -1.0 Z', 0.9, 0.15), P);
  b.add(slab('M 6.2 0.0 L 7.0 0.0 Q 7.0 -1.2 6.4 -2.2 L 6.0 -2.0 Q 6.5 -1.0 6.2 0.0 Z', 0.55, 0.1), GM.steel);
  b.add(rbox(1.6, 0.5, 0.25, 0.1), GM.steel, 3.4, 1.2, -1.6); // safety
  for (const [px, py] of [[-0.6, 1.2], [8.0, 1.2], [13.8, 1.2]]) screw(b, px, py, 1.55, GM.steel, 0.25);

  // --- long 32-round magazine ---------------------------------------------------------------
  b.group('mag', 12.4, 0.4);
  b.add(slab('M 10.4 -2 L 14.4 -2 L 14.4 -21.6 L 10.4 -21.6 Z', 2.4, 0.25), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  for (const s of [-1, 1]) b.add(box(0.5, 13.0, 0.06), GM.dark, 11.2, -13.6, s * 1.21, 0, { group: 'mag' });
  b.add(rbox(4.6, 0.7, 2.9, 0.25), GM.steel, 12.4, -21.85, 0, 0, { group: 'mag' });

  b.anchor('grip', 0.6, -3.8); b.anchor('support', 12.4, -4.6); b.anchor('eject', 9.4, 5.0, 1.65);
  b.anchor('butt', -2.6, 0); b.anchor('sight', 0.4, 7.2); b.anchor('muzzle', 29.8, y);
};
