// d50: Desert Eagle Mark XIX (.50 AE). See kit.js for the authoring conventions (side view, centimetres).
// Polished stainless: big fixed fluted barrel with a top rail, short slide at the rear with the
// ambidextrous safety, exposed hammer, long frame with an under-barrel rail, checkered grip panels.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

const f = (n) => n.toFixed(3);

export default (b) => {
  const st = GM.bright, dk = GM.dark, panel = GM.park;
  const BORE = 4.0;
  const SB = 2.3, ST = 6.2, SR = -2.9, SF = 8.4; // slide
  const BX = 8.2, MZ = 24.2, BT = 6.0;            // barrel block
  const FL0 = 10.0, FL1 = 20.6;                   // side flute

  // ---------------------------------------------------------------- slide (rear section only)
  b.group('slide', 3, BORE);
  const g = { group: 'slide' };
  b.add(slab(`M ${SR} ${SB} L ${SF} ${SB} L ${SF} ${ST - 0.3} Q ${SF} ${ST} ${SF - 0.3} ${ST} L ${SR + 0.5} ${ST} Q ${SR} ${ST} ${SR} ${ST - 0.6} Z`, 3.0, 0.4), st, 0, 0, 0, 0, { group: 'slide', sticker: true });
  // slanted rear serrations
  for (let i = 0; i < 10; i++) b.add(rbox(0.22, 2.4, 0.12, 0.05), st, SR + 1.0 + i * 0.38, 3.6, 1.51, -0.12, { group: 'slide', mirror: true });
  // ejection port on the right
  b.add(rbox(3.4, 1.3, 0.2, 0.12), dk, 3.6, 5.0, 1.45, 0, g);
  b.add(rbox(1.6, 0.4, 0.16, 0.06), GM.steel, 1.2, 5.25, 1.52, 0, g);
  // ambidextrous safety levers (round thumb pieces at the slide rear)
  for (const s of [1, -1]) {
    b.add(new THREE.CylinderGeometry(0.75 * CM, 0.8 * CM, 0.35 * CM, 18).rotateZ(Math.PI / 2), st, SR + 1.0, 5.2, s * 1.65, 0, g);
    b.add(rbox(1.4, 0.5, 0.3, 0.12), st, SR + 1.6, 5.55, s * 1.66, -0.3, g);
    b.add(new THREE.CylinderGeometry(0.4 * CM, 0.4 * CM, 0.1 * CM, 12).rotateZ(Math.PI / 2), dk, SR + 1.0, 5.2, s * 1.84, 0, g);
  }
  // rear sight
  b.add(rbox(1.3, 0.55, 2.2, 0.12), dk, SR + 2.6, ST + 0.25, 0, 0, g);
  b.add(rbox(1.2, 0.4, 0.75, 0.1), dk, SR + 2.6, ST + 0.65, 0.72, 0, { group: 'slide', mirror: true });

  // ---------------------------------------------------------------- barrel (fixed)
  b.add(slab(`M ${BX} ${SB + 0.05} L ${FL0 + 0.2} ${SB + 0.05} L ${FL0 + 0.2} ${BT} L ${BX} ${BT} Z`, 2.8, 0.2), st);
  b.add(slab(`M ${FL1 - 0.2} ${SB + 0.05} L ${MZ - 0.6} ${SB + 0.05} Q ${MZ} ${SB + 0.15} ${MZ} ${SB + 0.9} L ${MZ} ${BT - 0.3} Q ${MZ} ${BT} ${MZ - 0.3} ${BT} L ${FL1 - 0.2} ${BT} Z`, 2.8, 0.3), st, 0, 0, 0, 0, { sticker: true });
  b.add(slab(`M ${FL0} ${SB + 0.05} L ${FL1} ${SB + 0.05} L ${FL1} 4.45 L ${FL0} 4.45 Z`, 2.8, 0.15), st);
  b.add(slab(`M ${FL0} 5.35 L ${FL1} 5.35 L ${FL1} ${BT} L ${FL0} ${BT} Z`, 2.8, 0.15), st);
  b.add(slab(`M ${FL0} 4.3 L ${FL1} 4.3 L ${FL1} 5.5 L ${FL0} 5.5 Z`, 2.1, 0.1), GM.paint('#7d8187', 0.32));
  // muzzle face: crown and big bore
  b.add(tube(0.68, 0.3, 0.68, 20), dk, MZ - 0.25, BORE);
  b.add(lathe([[0.68, 0], [0.9, 0], [0.9, 0.08], [0.68, 0.08]], 20), GM.steel, MZ - 0.02, BORE);
  // top rail with cross slots, front sight post at the muzzle end
  b.add(rbox(MZ - BX - 1.4, 0.5, 1.7, 0.12), st, (BX + MZ - 1.0) / 2, BT + 0.2);
  for (let x = BX + 1.2; x < MZ - 1.8; x += 1.0) b.add(box(0.45, 0.22, 1.74), dk, x, BT + 0.38);
  b.add(rbox(0.9, 0.75, 0.5, 0.12), dk, MZ - 0.9, BT + 0.75);
  b.add(new THREE.CylinderGeometry(0.1 * CM, 0.1 * CM, 0.05 * CM, 10).rotateX(Math.PI / 2), GM.paint('#e9e7dc', 0.4), MZ - 1.36, BT + 0.9, 0);

  // ---------------------------------------------------------------- frame
  b.add(slab(`M -3.4 1.9 Q -3.7 2.3 -3.1 2.32 L 18.6 2.32 L 18.6 1.5 Q 18.6 1.0 18.1 1.0 L 11.4 1.0 L 10.9 1.3 L 3.8 1.3 L 3.3 -0.4 L -2.5 -0.4 Q -2.8 1.0 -3.4 1.9 Z`, 3.0, 0.35), st);
  // under-barrel rail
  b.add(rbox(7.0, 0.5, 2.1, 0.12), st, 14.8, 0.8);
  for (let x = 11.9; x < 18.2; x += 0.9) b.add(box(0.4, 0.24, 2.14), dk, x, 0.66);
  // trigger guard (rounded front, small finger hook)
  b.add(slab(`M 3.6 1.3 L 11.0 1.3 L 11.1 -0.4 Q 11.1 -2.3 9.4 -2.45 L 9.4 -2.75 L 8.8 -2.75 L 8.6 -2.5 L 4.4 -2.5 Q 3.4 -2.3 3.1 -1.4 Z
              M 4.35 1.0 L 10.2 1.0 L 10.25 -0.5 Q 10.2 -1.85 9.0 -1.85 L 4.7 -1.85 Q 4.15 -1.75 4.2 -1.1 Z`, 1.3, 0.28), st);
  // grip frame
  const front = (y) => 3.6 + 0.24 * (y + 2.0);
  const back = (y) => -2.75 + 0.24 * y;
  let pts = `M 3.9 1.6 L 3.75 -1.4 L ${f(front(-2.0))} -2.0`;
  for (let i = 1; i <= 12; i++) { const y = -2.0 - i * (6.0 / 12); pts += ` L ${f(front(y) + 0.12 * Math.sin((i / 12) * Math.PI))} ${f(y)}`; }
  pts += ` L ${f(front(-8.0) - 0.2)} -8.05 L ${f(back(-8.0) + 0.2)} -8.05 Q ${f(back(-8.0) - 0.15)} -8.0 ${f(back(-8.0) - 0.05)} -7.5`;
  pts += ` Q ${f(back(-4.0) - 0.35)} -4.0 -2.85 -0.3 Q -2.75 1.1 -3.6 1.6 Z`;
  b.add(slab(pts, 2.9, 0.4), st);
  // checkered grip panels with a round medallion
  const pn = `M ${f(front(-1.6) - 0.6)} -1.6 L ${f(front(-7.6) - 0.6)} -7.6 L ${f(back(-7.6) + 0.5)} -7.6 L ${f(back(-1.0) + 0.6)} -1.0 Q ${f(back(-0.4) + 1.2)} -0.4 ${f(front(-1.6) - 0.9)} -1.0 Z`;
  b.add(slab(pn, 3.5, 0.3), panel);
  const nub = box(0.2, 0.2, 0.12);
  for (let r = 0; r < 15; r++) {
    const y = -1.7 - r * 0.38;
    for (let x = back(y) + 0.75 + (r % 2) * 0.19; x < front(y) - 0.75; x += 0.38) b.add(nub, panel, x, y, 1.72, 0, { mirror: true, roll: 0 });
  }
  for (const s of [1, -1]) b.add(new THREE.CylinderGeometry(0.55 * CM, 0.55 * CM, 0.14 * CM, 18).rotateZ(Math.PI / 2), st, front(-3.0) - 2.3, -3.0, s * 1.78);
  // slide stop (left), mag release button, takedown lever, pins
  b.add(rbox(3.4, 0.36, 0.18, 0.08), st, 3.2, 1.7, -1.6);
  b.add(rbox(0.9, 0.7, 0.32, 0.12), st, 4.6, 1.75, -1.65);
  b.add(rbox(0.9, 0.85, 0.36, 0.14), dk, 3.2, -1.0, -1.55);
  b.add(rbox(0.7, 0.9, 0.3, 0.12), st, 12.8, 1.7, -1.6);
  screw(b, 6.3, 0.6, 1.5, GM.steel, 0.18);
  screw(b, -1.5, 1.2, 1.5, GM.steel, 0.16);
  // exposed hammer
  b.add(slab('M -2.6 2.6 L -3.3 3.0 Q -4.05 3.7 -3.95 4.6 L -3.35 4.75 Q -3.1 4.0 -2.7 3.6 Z', 1.1, 0.15), GM.steel);
  for (let i = 0; i < 4; i++) b.add(box(0.07, 0.07, 1.12), dk, -3.95 + i * 0.13, 4.0 + i * 0.18);
  // trigger
  b.add(slab('M 6.4 1.3 L 7.4 1.3 Q 7.5 -0.3 6.8 -1.5 L 6.15 -1.4 Q 6.75 -0.2 6.4 1.3 Z', 0.8, 0.15), GM.steel);

  // ---------------------------------------------------------------- magazine
  const magC = (y) => 0.5 + 0.24 * y;
  b.group('mag', magC(1.0), 1.0);
  const mg = { group: 'mag' };
  b.add(slab(`M ${f(magC(1.4) - 1.8)} 1.4 L ${f(magC(1.4) + 1.8)} 1.4 L ${f(magC(-8.0) + 1.8)} -8.0 L ${f(magC(-8.0) - 1.8)} -8.0 Z`, 2.3, 0.12), GM.steel, 0, 0, 0, 0, mg);
  b.add(rbox(1.4, 0.8, 1.4, 0.3), GM.brass, magC(1.5) + 0.4, 1.5, 0, -0.25, mg);
  const fb = front(-8.0), bb = back(-8.0);
  b.add(slab(`M ${f(fb - 0.25)} -7.95 L ${f(bb + 0.1)} -7.95 L ${f(bb - 0.05)} -8.65 L ${f(fb - 0.05)} -8.65 Z`, 3.0, 0.25), st, 0, 0, 0, 0, mg);
  b.add(box(fb - bb - 0.8, 0.12, 3.02), dk, (fb + bb) / 2, -8.3, 0, 0, mg);

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', 0.0, -3.6);
  b.anchor('eject', 3.6, 5.2, 1.6);
  b.anchor('sight', SR + 2.6, ST + 0.85);
  b.anchor('muzzle', MZ + 0.1, BORE);
};
