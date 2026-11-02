// s1: USP-S (HK USP Tactical .45 with a can). See kit.js for the authoring conventions (side view, centimetres).
// Grey phosphated slide with rounded HK nose, polymer frame with stippled grip, exposed hammer,
// control lever, tall suppressor sights and a long slim suppressor.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

const f = (n) => n.toFixed(3);

export default (b) => {
  const frame = GM.polymer, slideMat = GM.paint('#4a4c4b', 0.45), blk = GM.dark;
  const BORE = 3.85;
  const SB = 1.95, ST = 5.0, SR = -3.2, SF = 15.0;
  const SW = 2.7;
  const PR = 3.6, PF = 8.0;

  // ---------------------------------------------------------------- slide
  b.group('slide', 6, BORE);
  const g = { group: 'slide' };
  b.add(slab(`M ${SR} ${SB} L ${PR} ${SB} L ${PR} ${ST} L ${SR + 0.35} ${ST} Q ${SR} ${ST} ${SR} ${ST - 0.35} Z`, SW, 0.42), slideMat, 0, 0, 0, 0, { group: 'slide', sticker: true });
  b.add(slab(`M ${PF} ${SB} L ${SF - 1.3} ${SB} Q ${SF - 0.5} ${SB + 0.1} ${SF - 0.1} ${SB + 1.0} L ${SF} ${ST - 0.7} Q ${SF} ${ST} ${SF - 0.7} ${ST} L ${PF} ${ST} Z`, SW, 0.42), slideMat, 0, 0, 0, 0, g);
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} ${ST} L ${PR - 0.3} ${ST} Z`, 1.6, 0.2), slideMat, 0, 0, -SW / 2 + 0.8, 0, g);
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} 3.4 L ${PR - 0.3} 3.4 Z`, 1.1, 0.15), slideMat, 0, 0, SW / 2 - 0.55, 0, g);
  // rear serrations (raised ribs, slightly slanted like the USP)
  for (let i = 0; i < 9; i++) {
    b.add(rbox(0.2, ST - SB - 0.9, 0.12, 0.05), slideMat, SR + 0.6 + i * 0.34, (SB + ST) / 2 - 0.1, SW / 2 + 0.01, -0.06, { group: 'slide', mirror: true });
  }
  // engraved line along the slide (the flat panel border)
  b.add(box(PF - PR + 6.2, 0.06, 0.04), GM.dark, (SR + SF) / 2 + 1.5, ST - 0.85, -SW / 2 + 0.01, 0, g);
  // extractor
  b.add(rbox(2.2, 0.42, 0.16, 0.07), GM.steel, PR - 1.0, 4.1, SW / 2 - 0.02, 0, g);
  // tall suppressor sights: rear block with notch and dots, front post with dot
  b.add(rbox(1.5, 0.5, 2.1, 0.12), GM.dark, SR + 1.1, ST + 0.22, 0, 0, g);
  b.add(rbox(1.2, 0.75, 0.62, 0.12), GM.dark, SR + 1.1, ST + 0.7, 0.72, 0, { group: 'slide', mirror: true });
  b.add(new THREE.CylinderGeometry(0.09 * CM, 0.09 * CM, 0.05 * CM, 10).rotateX(Math.PI / 2), GM.paint('#e9e7dc', 0.4), SR + 0.49, ST + 0.8, 0.72, 0, { group: 'slide', mirror: true });
  b.add(rbox(1.0, 1.0, 0.5, 0.12), GM.dark, SF - 1.3, ST + 0.45, 0, 0, g);
  b.add(new THREE.CylinderGeometry(0.1 * CM, 0.1 * CM, 0.05 * CM, 10).rotateX(Math.PI / 2), GM.paint('#e9e7dc', 0.4), SF - 1.81, ST + 0.75, 0, 0, g);

  // ---------------------------------------------------------------- barrel + suppressor (static)
  b.add(rbox(PF - PR + 0.2, 1.3, 1.2, 0.15), GM.steel, (PR + PF) / 2, 4.2, 0.6);
  b.add(tube(0.72, 1.9, 0.72, 20), GM.steel, SF - 0.4, BORE);
  for (let i = 0; i < 5; i++) b.add(lathe([[0.72, 0], [0.78, 0.1], [0.72, 0.2]], 20), GM.steel, SF + 0.2 + i * 0.22, BORE);
  // recoil spring guide behind the nose
  b.add(tube(0.38, 0.12, 0.38, 14), GM.dark, SF - 0.15, 2.6);
  const X = SF + 1.4, R = 1.7, LEN = 18.2;
  b.add(lathe([[0.75, 0], [1.2, 0], [1.25, 0.35], [R - 0.05, 0.6], [R, 1.1], [R, LEN - 1.0], [R - 0.12, LEN - 0.45], [R - 0.4, LEN - 0.05], [0.42, LEN], [0.42, LEN - 0.6]], 32), slideMat, X, BORE);
  b.add(tube(0.43, 0.6, 0.43, 14), GM.dark, X + LEN - 0.62, BORE);
  // seams between the can sections and a row of shallow port dimples
  for (const s of [1.4, 7.4, 13.0]) b.add(lathe([[R + 0.02, 0], [R + 0.03, 0.08], [R + 0.02, 0.16]], 32), GM.dark, X + s, BORE);
  for (let i = 0; i < 4; i++) for (const a of [-0.5, 0.5]) {
    b.add(new THREE.CylinderGeometry(0.14 * CM, 0.14 * CM, 0.04 * CM, 10), GM.dark, X + 3.2 + i * 2.6, BORE + R * Math.cos(a), R * Math.sin(a), 0, { roll: -a });
  }
  // collar knurl at the rear
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    b.add(box(0.5, 0.1, 0.1), slideMat, X + 0.75, BORE + (R - 0.02) * Math.cos(a), (R - 0.02) * Math.sin(a), 0, { roll: -a });
  }

  // ---------------------------------------------------------------- frame
  b.add(slab(`M -3.75 1.6 Q -4.0 1.97 -3.4 1.97 L 14.0 1.97 L 14.6 1.5 Q 14.9 1.0 14.4 0.65 L 9.9 0.65 L 9.5 0.95 L 3.4 0.95 L 3.0 -0.5 L -2.4 -0.5 Q -2.7 0.8 -3.75 1.6 Z`, 2.55, 0.3), frame);
  // integrated rail grooves on the dust cover
  b.add(box(4.4, 0.18, 0.06), GM.dark, 12.1, 1.1, 1.26, 0, { mirror: true });
  b.add(box(0.5, 0.3, 2.6), GM.dark, 11.0, 0.66);
  // trigger guard, squared with a forward finger hook
  b.add(slab(`M 3.1 0.95 L 9.7 0.95 L 9.9 -0.5 Q 10.0 -1.7 9.6 -2.05 L 9.85 -2.25 L 9.6 -2.45 Q 9.3 -2.25 8.7 -2.25 L 3.9 -2.25 Q 3.0 -2.1 2.7 -1.4 Z
              M 3.9 0.65 L 8.85 0.65 L 9.0 -0.6 Q 9.05 -1.6 8.2 -1.6 L 4.15 -1.6 Q 3.65 -1.5 3.7 -0.95 Z`, 1.2, 0.25), frame);
  // grip: curved backstrap, slight front-strap swell, flared mag well
  const front = (y) => 3.1 + 0.32 * (y + 1.8);
  const back = (y) => -2.65 + 0.32 * y;
  let pts = `M 3.5 1.3 L 3.35 -1.4 L ${f(front(-1.8))} -1.8`;
  for (let i = 1; i <= 16; i++) {
    const y = -1.8 - i * (6.0 / 16);
    pts += ` L ${f(front(y) + 0.18 * Math.sin((i / 16) * Math.PI))} ${f(y)}`;
  }
  pts += ` Q ${f(front(-7.9) + 0.05)} -7.95 ${f(front(-7.9) - 0.3)} -8.0 L ${f(back(-7.9) + 0.2)} -8.0 Q ${f(back(-7.9) - 0.25)} -7.95 ${f(back(-7.9) - 0.15)} -7.5`;
  pts += ` Q ${f(back(-4) - 0.5)} -4.0 -2.75 -0.3 Q -2.55 0.9 -3.4 1.3 Z`;
  b.add(slab(pts, 3.0, 0.55), frame, 0, 0, 0, 0, { sticker: true });
  // stippled panels on the grip sides
  const nub = box(0.16, 0.16, 0.12);
  for (let r = 0; r < 14; r++) {
    const y = -1.9 - r * 0.38;
    for (let x = back(y) + 0.95 + (r % 2) * 0.19; x < front(y) - 0.85; x += 0.38) b.add(nub, frame, x, y, 1.44, 0, { mirror: true });
  }
  // controls: control lever (safety/decocker) at the rear left, slide release, ambi mag-release paddle, pins
  b.add(slab('M -2.3 1.75 L -0.9 1.75 Q -0.6 1.7 -0.7 1.2 L -1.4 0.4 Q -1.9 0.1 -2.4 0.6 Z', 0.3, 0.1), GM.steel, 0, 0, -1.4);
  b.add(new THREE.CylinderGeometry(0.4 * CM, 0.4 * CM, 0.35 * CM, 14).rotateZ(Math.PI / 2), GM.steel, -1.75, 1.35, -1.42);
  b.add(rbox(3.0, 0.32, 0.16, 0.08), GM.steel, 3.4, 1.5, -1.32);
  b.add(rbox(0.75, 0.62, 0.3, 0.12), GM.steel, 2.3, 1.4, -1.38);
  b.add(slab('M 3.1 -1.6 L 4.0 -1.6 L 4.2 -2.4 L 3.5 -2.5 Z', 2.0, 0.12), blk);
  screw(b, 4.8, 0.45, 1.29, GM.steel, 0.16);
  screw(b, 7.4, 1.25, 1.29, GM.steel, 0.16);
  screw(b, -1.2, 0.7, 1.29, GM.steel, 0.14);
  // exposed hammer
  b.add(slab('M -3.0 2.6 L -3.55 3.0 Q -4.05 3.7 -3.9 4.35 L -3.4 4.55 L -3.05 4.0 Z', 0.9, 0.12), GM.steel);
  for (let i = 0; i < 3; i++) b.add(box(0.06, 0.06, 0.92), GM.dark, -3.85 + i * 0.12, 3.8 + i * 0.22);
  // trigger
  b.add(slab('M 5.5 0.95 L 6.4 0.95 Q 6.45 -0.4 5.9 -1.25 L 5.3 -1.15 Q 5.8 -0.2 5.5 0.95 Z', 0.75, 0.15), GM.steel);

  // ---------------------------------------------------------------- magazine
  const magC = (y) => 0.35 + 0.32 * y;
  b.group('mag', magC(0.8), 0.8);
  const mg = { group: 'mag' };
  b.add(slab(`M ${f(magC(1.2) - 1.6)} 1.2 L ${f(magC(1.2) + 1.6)} 1.2 L ${f(magC(-8.0) + 1.6)} -8.0 L ${f(magC(-8.0) - 1.6)} -8.0 Z`, 2.3, 0.15), GM.steel, 0, 0, 0, 0, mg);
  b.add(rbox(0.9, 0.55, 1.3, 0.25), GM.brass, magC(1.25) + 0.6, 1.25, 0, -0.32, mg);
  const fb = front(-7.9), bb = back(-7.9);
  b.add(slab(`M ${f(fb - 0.1)} -7.95 L ${f(bb - 0.05)} -7.95 Q ${f(bb - 0.4)} -8.2 ${f(bb - 0.3)} -8.6 Q ${f(bb - 0.1)} -8.95 ${f(bb + 0.4)} -8.95 L ${f(fb - 0.5)} -8.95 Q ${f(fb + 0.05)} -8.9 ${f(fb + 0.1)} -8.4 Z`, 3.05, 0.35), frame, 0, 0, 0, 0, mg);

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', -0.3, -3.4);
  b.anchor('eject', (PR + PF) / 2, ST - 0.4, 1.4);
  b.anchor('sight', SR + 1.1, ST + 1.07);
  b.anchor('muzzle', X + LEN, BORE);
};
