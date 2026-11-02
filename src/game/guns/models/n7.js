// n7: Benelli Nova pump shotgun. See kit.js for the authoring conventions (side view, centimetres).
// One-piece polymer receiver + stock with a ribbed pistol grip, ribbed fore-end around the
// magazine tube, slim barrel with a ghost-ring front sight, magazine cap with barrel clamp.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b) => {
  const poly = GM.polymer, dk = GM.dark;
  const y = 5.4;            // bore
  const MY = 2.55;          // magazine tube axis
  const RX = 23.0, MZ = 70; // receiver front, muzzle

  // ---------------------------------------------------------------- receiver + stock (one moulding)
  b.add(slab(`M 1.5 1.6 L ${RX} 1.6 L ${RX} 7.0 Q ${RX} 7.6 ${RX - 0.8} 7.6 L 4.5 7.6 Q 1.5 7.7 0.0 7.2 L 0 3.0 Z`, 4.1, 0.55), poly, 0, 0, 0, 0, { sticker: true });
  // stock: comb sweeps down from the receiver, pistol grip, butt
  b.add(slab(`M 0.6 7.2 Q -2.0 6.8 -5.0 6.0 L -29.6 4.4 Q -30.6 4.4 -30.6 3.4 L -30.6 -7.4 Q -30.6 -8.4 -29.6 -8.3
              L -12.5 -0.2 Q -9.8 1.0 -8.4 0.1 Q -7.3 -0.9 -6.9 -3.0 L -6.1 -6.9 Q -5.7 -8.1 -4.5 -8.0 L -3.5 -7.7
              Q -2.7 -7.3 -2.8 -6.5 L 0.3 -1.6 Q 1.0 0.6 2.0 1.7 L 1.0 3.0 Z`, 3.7, 0.7), poly, 0, 0, 0, 0, { sticker: true });
  // grip ribs (raised bands across the pistol grip, along its axis)
  const ga = Math.atan2(-8.0, -4.3); // grip axis direction (down & back)
  for (let i = 0; i < 10; i++) {
    const t = 1.3 + i * 0.68;
    const cx = -1.6 + Math.cos(ga) * t, cy = 0.2 + Math.sin(ga) * t;
    b.add(rbox(3.9, 0.3, 3.85, 0.12), poly, cx, cy, 0, ga + Math.PI / 2);
  }
  // buttpad
  b.add(slab('M -30.4 4.5 L -32.0 4.6 Q -32.3 4.5 -32.3 4.0 L -32.3 -7.9 Q -32.2 -8.6 -31.6 -8.6 L -30.4 -8.4 Z', 3.9, 0.4), GM.rubber);
  for (let i = 0; i < 6; i++) b.add(box(0.12, 0.25, 3.92), dk, -31.6, 3.0 - i * 2.0);
  swivel(b, -25, -5.4, GM.steel);
  // ejection port with the bolt visible, loading port under the receiver
  b.add(rbox(7.0, 2.1, 0.3, 0.2), dk, 12.5, 5.6, 1.95);
  b.add(rbox(4.0, 1.5, 0.3, 0.2), GM.steel, 11.6, 5.6, 2.0);
  b.add(rbox(1.2, 0.5, 0.25, 0.1), GM.bright, 13.0, 5.2, 2.08);
  b.add(rbox(9.0, 0.3, 2.8, 0.12), dk, 15.0, 1.55);
  // receiver side panels (moulded recess lines)
  b.add(box(RX - 6.5, 0.08, 0.06), dk, (RX + 4.5) / 2, 3.1, 2.04, 0, { mirror: true });
  b.add(box(10, 0.08, 0.06), dk, 9.5, 7.0, -2.04);
  // ghost-ring rear sight on the receiver top rear
  b.add(rbox(3.0, 0.6, 2.4, 0.2), dk, 3.2, 7.85);
  b.add(rbox(1.6, 1.1, 0.5, 0.15), dk, 2.8, 8.5, 0.9, 0, { mirror: true });
  b.add(new THREE.TorusGeometry(0.42 * CM, 0.13 * CM, 6, 14), dk, 2.8, 8.65);
  // trigger guard (moulded), trigger, cross-bolt safety, shell stop button
  b.add(slab(`M 1.8 1.7 L 10.5 1.7 L 10.5 1.0 Q 10.2 -1.6 8.4 -1.9 L 3.6 -1.9 Q 1.6 -1.6 1.6 0.4 Z
              M 2.6 1.1 L 9.6 1.1 Q 9.2 -1.05 7.9 -1.25 L 3.8 -1.25 Q 2.5 -1.0 2.6 0.3 Z`, 1.3, 0.25), poly);
  b.add(slab('M 5.4 1.7 L 6.3 1.7 Q 6.3 0.2 5.7 -0.8 L 5.1 -0.6 Q 5.7 0.4 5.4 1.7 Z', 0.7, 0.12), GM.steel);
  b.add(new THREE.CylinderGeometry(0.32 * CM, 0.32 * CM, 4.3 * CM, 12).rotateZ(Math.PI / 2), GM.steel, 9.4, 1.4);
  b.add(rbox(0.8, 0.5, 0.3, 0.12), GM.steel, 11.8, 1.2, -1.9);
  screw(b, 3.4, 4.2, 2.06, GM.steel, 0.3);
  screw(b, 19.5, 4.2, 2.06, GM.steel, 0.3);

  // ---------------------------------------------------------------- barrel, magazine tube, cap
  b.add(lathe([[1.55, 0], [1.55, 1.2], [1.25, 1.8], [1.25, MZ - RX - 2.0], [1.3, MZ - RX - 0.6], [1.2, MZ - RX], [0.95, MZ - RX]], 24), GM.blued, RX, y);
  b.add(tube(0.95, 0.6, 0.95, 18), dk, MZ - 0.55, y);
  b.add(tube(1.18, 40, 1.18, 22), GM.blued, RX, MY);
  // magazine cap with the barrel clamp and a sling stud
  b.add(lathe([[1.25, 0], [1.5, 0.2], [1.5, 2.6], [1.3, 3.2], [0.6, 3.5], [0, 3.5]], 22), poly, 61.2, MY);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; b.add(box(2.0, 0.25, 0.25), poly, 62.6, MY + 1.5 * Math.cos(a), 1.5 * Math.sin(a), 0, { roll: -a }); }
  b.add(slab(`M 59.6 ${MY} L 61.4 ${MY} L 61.4 ${y + 0.4} L 59.6 ${y + 0.4} Z`, 1.6, 0.25), GM.steel);
  b.add(new THREE.TorusGeometry(0.75 * CM, 0.17 * CM, 6, 14).rotateY(Math.PI / 2), GM.steel, 64.9, MY);
  // ghost-ring front sight with protective ears
  b.add(rbox(2.2, 0.7, 1.4, 0.2), GM.blued, MZ - 2.2, y + 1.45);
  b.add(rbox(0.5, 1.2, 0.3, 0.1), GM.blued, MZ - 2.2, y + 2.3, 0, 0);
  b.add(rbox(1.8, 1.4, 0.3, 0.12), GM.blued, MZ - 2.2, y + 2.35, 0.55, 0, { mirror: true });
  b.add(sphere(0.16), GM.paint('#e9e7dc', 0.4), MZ - 2.2, y + 2.95);

  // ---------------------------------------------------------------- pump (fore-end)
  b.group('pump', 39, MY);
  const pg = { group: 'pump' };
  const P0 = 27.5, P1 = 50.5;
  b.add(rbox(P1 - P0, 4.4, 4.5, 1.6), poly, (P0 + P1) / 2, MY + 0.4, 0, 0, pg);
  for (let x = P0 + 1.6; x < P1 - 3.0; x += 0.9) b.add(rbox(0.45, 4.75, 4.85, 0.22), poly, x, MY + 0.4, 0, 0, pg);
  // front lip of the fore-end
  b.add(rbox(1.4, 4.9, 4.9, 1.0), poly, P1 - 1.2, MY + 0.45, 0, 0, pg);
  // action bars running back into the receiver
  b.add(box(P0 - RX + 2.0, 0.5, 0.25), GM.steel, (RX + P0) / 2 - 0.5, MY + 0.9, 1.25, 0, { group: 'pump', mirror: true });

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', -2.2, -2.6);
  b.anchor('support', 39, MY - 0.4);
  b.anchor('muzzle', MZ, y);
  b.anchor('eject', 12.5, 5.8, 2.1);
  b.anchor('butt', -32.3, 0);
  b.anchor('sight', 2.8, 8.65);
};
