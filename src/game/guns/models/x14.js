// x14: Benelli M4 / XM1014 semi-auto shotgun. See kit.js for the authoring conventions (side view, centimetres).
// Anodised alloy receiver with a top rail and ghost-ring sights, ribbed polymer fore-end,
// long magazine tube with cap and barrel band, separate pistol grip, skeletal telescoping stock.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b) => {
  const poly = GM.polymer, dk = GM.dark, alu = GM.alu;
  const y = 5.6, MY = 3.0, RX = 24, MZ = 71;

  // ---------------------------------------------------------------- receiver
  b.add(slab(`M 0.4 1.8 L ${RX} 1.8 L ${RX} 7.2 Q ${RX} 7.8 ${RX - 0.6} 7.8 L 1.0 7.8 Q 0 7.8 0 6.8 L 0 2.6 Q 0 1.8 0.4 1.8 Z`, 4.0, 0.45), alu, 0, 0, 0, 0, { sticker: true });
  // milled side panel recess lines, receiver pins
  b.add(box(RX - 4, 0.08, 0.06), dk, RX / 2 + 1, 3.2, 2.02, 0, { mirror: true });
  screw(b, 4.2, 2.6, 2.02, GM.steel, 0.3);
  screw(b, 20.6, 2.6, 2.02, GM.steel, 0.3);
  // ejection port with the bolt and the charging handle
  b.add(rbox(8.0, 2.2, 0.3, 0.2), dk, 14.0, 5.7, 1.95);
  b.add(rbox(4.6, 1.6, 0.3, 0.2), GM.bright, 13.0, 5.7, 2.0);
  b.add(new THREE.CylinderGeometry(0.5 * CM, 0.42 * CM, 1.8 * CM, 14).rotateZ(Math.PI / 2), GM.bright, 12.6, 5.6, 2.9);
  b.add(sphere(0.62), GM.bright, 12.6, 5.6, 3.7);
  // bolt release (left) and the loading port below
  b.add(rbox(1.6, 0.7, 0.3, 0.2), GM.steel, 17.6, 3.0, -2.06);
  b.add(rbox(10.0, 0.3, 2.8, 0.12), dk, 16.4, 1.75);
  // top rail with ghost-ring rear sight
  rail(b, 1.0, 22.5, 8.75, alu, 2.1);
  b.add(rbox(2.6, 0.9, 2.6, 0.25), dk, 2.6, 9.2);
  b.add(rbox(1.6, 1.4, 0.5, 0.15), dk, 2.4, 10.0, 1.0, 0, { mirror: true });
  b.add(new THREE.TorusGeometry(0.42 * CM, 0.14 * CM, 6, 14), dk, 2.4, 10.2);
  b.add(new THREE.CylinderGeometry(0.3 * CM, 0.3 * CM, 0.4 * CM, 10).rotateZ(Math.PI / 2), GM.steel, 2.6, 9.2, 1.45);

  // ---------------------------------------------------------------- trigger group + pistol grip
  b.add(slab(`M 2.6 1.9 L 11.6 1.9 L 11.6 1.2 Q 11.3 -1.6 9.2 -1.8 L 4.0 -1.8 Q 2.4 -1.6 2.4 0.2 Z
              M 3.4 1.3 L 10.7 1.3 Q 10.4 -1.0 8.9 -1.15 L 4.2 -1.15 Q 3.3 -1.0 3.4 0.2 Z`, 1.6, 0.25), alu);
  b.add(slab('M 6.2 1.9 L 7.1 1.9 Q 7.1 0.3 6.5 -0.8 L 5.9 -0.6 Q 6.5 0.5 6.2 1.9 Z', 0.7, 0.12), GM.steel);
  b.add(new THREE.CylinderGeometry(0.32 * CM, 0.32 * CM, 4.4 * CM, 12).rotateZ(Math.PI / 2), GM.steel, 10.2, 1.5);
  // pistol grip: finger grooves on the front, rounded back, raked rearward
  b.add(slab(`M 2.60 1.9 L 2.36 -0.2 Q 2.70 -0.9 1.90 -1.8 Q 1.37 -2.4 1.70 -3.2 Q 1.92 -4.0 1.04 -4.8 Q 0.51 -5.4 0.74 -6.2
              Q 0.63 -7.6 -0.27 -8.5 Q -0.76 -8.9 -1.64 -8.8 L -3.55 -8.4 Q -4.20 -8.2 -4.03 -7.4 L -2.34 -2.0 Q -1.90 0.2 -3.00 1.6 L -2.60 1.9 Z`, 3.2, 0.6), poly);
  for (let i = 0; i < 8; i++) b.add(box(0.12, 0.12, 3.24), dk, 1.4 - i * 0.02 * i + 0.22 * (-2.6 - i * 0.7), -2.6 - i * 0.7, 0, 0);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 4; c++) b.add(box(0.2, 0.2, 0.1), poly, -1.1 + c * 0.6 + (r % 2) * 0.3 - r * 0.03 + 0.22 * (-2.0 - r * 0.6), -2.0 - r * 0.6, 1.6, 0, { mirror: true });

  // ---------------------------------------------------------------- stock (telescoping skeleton)
  b.add(tube(1.45, 15, 1.45, 20), alu, -15, 5.0);
  b.add(lathe([[1.7, 0], [1.7, 1.0], [1.45, 1.2]], 20), alu, -0.9, 5.0, 0, Math.PI);
  b.add(slab(`M -10.8 7.6 L -28.6 8.4 Q -29.6 8.4 -29.6 7.4 L -29.6 -3.8 Q -29.4 -5.0 -28.2 -4.8 L -24 -3.2 L -12.6 2.0 Q -10.6 3.0 -10.6 4.6 Z
              M -13.6 5.9 L -26.9 6.6 L -26.9 -1.7 L -23.6 -1.1 L -13.6 3.5 Z`, 3.6, 0.5), poly, 0, 0, 0, 0, { sticker: true });
  // cheek strut ribs and the lock lever under the tube
  for (let i = 0; i < 5; i++) b.add(box(0.25, 0.15, 3.62), dk, -15 - i * 2.5, 7.55 + i * 0.11);
  b.add(rbox(2.4, 0.8, 1.4, 0.25), dk, -12.4, 3.3);
  // buttpad
  b.add(slab('M -29.4 8.5 L -31.0 8.5 Q -31.3 8.4 -31.3 7.9 L -31.3 -4.4 Q -31.2 -5.2 -30.6 -5.2 L -29.4 -4.9 Z', 3.8, 0.4), GM.rubber);
  for (let i = 0; i < 5; i++) b.add(box(0.12, 0.25, 3.82), dk, -30.7, 6.6 - i * 2.4);
  swivel(b, -27.8, -3.8, GM.steel);

  // ---------------------------------------------------------------- barrel, magazine tube, fore-end
  b.add(lathe([[1.5, 0], [1.5, 1.0], [1.18, 1.6], [1.18, MZ - RX - 1.5], [1.25, MZ - RX - 0.5], [1.15, MZ - RX], [0.95, MZ - RX]], 24), GM.blued, RX, y);
  b.add(tube(0.95, 0.6, 0.95, 18), dk, MZ - 0.55, y);
  b.add(tube(1.12, 42, 1.12, 22), GM.blued, RX, MY);
  // magazine cap (knurled) holding the barrel band
  b.add(lathe([[1.15, 0], [1.4, 0.2], [1.4, 2.8], [1.2, 3.3], [0.5, 3.6], [0, 3.6]], 22), GM.steel, 66.0, MY);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.add(box(2.2, 0.2, 0.2), GM.steel, 67.4, MY + 1.4 * Math.cos(a), 1.4 * Math.sin(a), 0, { roll: -a }); }
  b.add(slab(`M 64.4 ${MY} L 66.0 ${MY} L 66.0 ${y + 0.3} L 64.4 ${y + 0.3} Z`, 1.6, 0.25), GM.steel);
  // fore-end: wraps the barrel + tube, finger grooves along the sides
  b.add(slab(`M ${RX} 1.2 L 42.0 1.2 Q 44.6 1.4 44.6 3.0 L 44.6 5.0 Q 44.4 6.6 43.0 6.6 L ${RX + 3.5} 6.8 L ${RX} 7.4 Z`, 4.6, 0.8), poly);
  for (let i = 0; i < 10; i++) b.add(rbox(0.5, 2.6, 0.2, 0.08), dk, 29.0 + i * 1.1, 3.5, 2.25, 0, { mirror: true });
  // barrel band with the sling loop ahead of the fore-end
  b.add(slab(`M 45.2 ${MY - 1.3} L 46.6 ${MY - 1.3} L 46.6 ${y + 1.3} L 45.2 ${y + 1.3} Z`, 3.0, 0.4), GM.steel);
  b.add(new THREE.TorusGeometry(0.9 * CM, 0.17 * CM, 6, 16).rotateY(Math.PI / 2), GM.bright, 45.9, MY - 2.2, 1.0);
  // ghost-ring front sight with ears
  b.add(rbox(2.4, 0.7, 1.5, 0.2), GM.blued, MZ - 2.4, y + 1.4);
  b.add(rbox(0.5, 1.3, 0.3, 0.1), GM.blued, MZ - 2.4, y + 2.3);
  b.add(rbox(1.9, 1.5, 0.3, 0.12), GM.blued, MZ - 2.4, y + 2.35, 0.6, 0, { mirror: true });
  b.add(sphere(0.16), GM.paint('#e9e7dc', 0.4), MZ - 2.4, y + 3.0);

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', -0.4, -2.8);
  b.anchor('support', 36, 2.2);
  b.anchor('muzzle', MZ, y);
  b.anchor('eject', 14, 6.0, 2.2);
  b.anchor('butt', -31.3, 0);
  b.anchor('sight', 2.4, 10.2);
};
