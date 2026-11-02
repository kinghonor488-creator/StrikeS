// g18: Glock 18 (Gen4 frame). See kit.js for the authoring conventions (side view, centimetres).
// Coyote-tan polymer frame with RTF grip texture and finger grooves, dark Tenifer slide.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

const f = (n) => n.toFixed(3);

export default (b) => {
  const frame = GM.tan, slideMat = GM.park, blk = GM.polymer;
  const BORE = 3.7;
  const SB = 1.9, ST = 4.8, SR = -2.9, SF = 15.6; // slide bottom/top/rear/front
  const SW = 2.55;                               // slide width
  const PR = 3.8, PF = 7.6;                       // ejection port (right side)

  // ---------------------------------------------------------------- slide
  b.group('slide', 6, BORE);
  const g = { group: 'slide' };
  // rear block (sticker surface), front block, and the two port walls
  b.add(slab(`M ${SR} ${SB} L ${PR} ${SB} L ${PR} ${ST} L ${SR + 0.3} ${ST} Q ${SR} ${ST} ${SR} ${ST - 0.3} Z`, SW, 0.3), slideMat, 0, 0, 0, 0, { group: 'slide', sticker: true });
  b.add(slab(`M ${PF} ${SB} L ${SF - 0.7} ${SB} L ${SF} ${SB + 0.8} L ${SF} ${ST - 0.4} Q ${SF} ${ST} ${SF - 0.4} ${ST} L ${PF} ${ST} Z`, SW, 0.3), slideMat, 0, 0, 0, 0, g);
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} ${ST} L ${PR - 0.3} ${ST} Z`, 1.45, 0.12), slideMat, 0, 0, -SW / 2 + 0.725, 0, g);
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} 3.3 L ${PR - 0.3} 3.3 Z`, 1.1, 0.12), slideMat, 0, 0, SW / 2 - 0.55, 0, g);
  // rear serrations: raised ribs leave grooves between them
  for (let i = 0; i < 9; i++) {
    const x = SR + 0.55 + i * 0.36;
    b.add(rbox(0.2, ST - SB - 0.5, 0.12, 0.05), slideMat, x, (SB + ST) / 2 - 0.05, SW / 2 + 0.02, 0, { group: 'slide', mirror: true });
  }
  // slide cover plate
  b.add(rbox(0.16, 2.3, 1.7, 0.08), blk, SR - 0.04, (SB + ST) / 2 - 0.05, 0, 0, g);
  // extractor (right side, behind the port)
  b.add(rbox(2.4, 0.45, 0.16, 0.07), GM.steel, PR - 1.0, 3.9, SW / 2 + 0.04, 0, g);
  // G18 fire selector (left rear of slide)
  b.add(rbox(0.9, 0.55, 0.22, 0.1), GM.dark, SR + 1.1, 3.6, -SW / 2 - 0.08, 0, g);
  b.add(rbox(0.35, 0.9, 0.22, 0.1), GM.dark, SR + 0.8, 3.3, -SW / 2 - 0.12, 0.2, g);
  // rear sight: U-notch on a dovetail block, white outline
  b.add(rbox(1.1, 0.32, 2.0, 0.08), GM.dark, SR + 1.0, ST + 0.15, 0, 0, g);
  b.add(rbox(1.0, 0.55, 0.62, 0.1), GM.dark, SR + 1.0, ST + 0.4, 0.68, 0, { group: 'slide', mirror: true });
  b.add(box(0.05, 0.36, 0.08), GM.paint('#e8e6dc', 0.5), SR + 0.47, ST + 0.45, 0.42, 0, { group: 'slide', mirror: true });
  b.add(box(0.05, 0.06, 0.76), GM.paint('#e8e6dc', 0.5), SR + 0.47, ST + 0.29, 0, 0, g);
  // front sight post with white dot
  b.add(rbox(0.8, 0.55, 0.42, 0.1), GM.dark, SF - 0.9, ST + 0.27, 0, 0, g);
  b.add(new THREE.CylinderGeometry(0.11 * CM, 0.11 * CM, 0.06 * CM, 10).rotateX(Math.PI / 2), GM.paint('#f2f0e6', 0.4), SF - 1.32, ST + 0.38, 0, 0, g);

  // ---------------------------------------------------------------- barrel (static)
  // chamber hood seen through the port, muzzle crown and recoil spring guide at the nose
  b.add(rbox(PF - PR + 0.2, 1.3, 1.15, 0.12), GM.steel, (PR + PF) / 2, 4.05, 0.62);
  b.add(lathe([[0.42, 0], [0.68, 0], [0.68, 0.7], [0.6, 0.78], [0.42, 0.78]], 20), GM.steel, SF - 0.7, BORE);
  b.add(tube(0.42, 0.8, 0.42, 14), GM.dark, SF - 0.75, BORE);
  b.add(tube(0.42, 0.1, 0.42, 14), GM.dark, SF - 0.1, 2.55);
  b.add(tube(0.2, 0.15, 0.2, 10), GM.steel, SF - 0.12, 2.55);

  // ---------------------------------------------------------------- frame
  // upper frame / dust cover with the small beavertail tang
  b.add(slab(`M -3.5 1.45 Q -3.6 1.85 -3.1 1.88 L 14.4 1.88 L 14.6 1.6 L 14.6 0.6 L 9.6 0.6 L 9.2 0.9 L 3.2 0.9 L 2.8 -0.6 L -2.2 -0.6 Q -2.5 0.6 -3.5 1.45 Z`, 2.4, 0.3), frame);
  // accessory rail (one cross slot) under the dust cover
  b.add(slab('M 9.0 0.7 L 14.4 0.7 L 14.4 0.0 Q 14.4 -0.08 14.2 -0.08 L 9.2 -0.08 Q 9.0 -0.08 9.0 0.1 Z', 2.3, 0.15), frame);
  b.add(box(5.0, 0.16, 0.06), GM.dark, 11.7, 0.32, 1.15, 0, { mirror: true });
  b.add(box(0.5, 0.3, 2.34), GM.dark, 11.6, 0.0);
  // trigger guard: squared front, opening cut out
  b.add(slab(`M 3.0 0.9 L 9.5 0.9 L 9.7 -0.6 Q 9.75 -2.15 8.3 -2.15 L 3.7 -2.15 Q 2.9 -2.0 2.6 -1.4 Z
              M 3.75 0.62 L 8.7 0.62 L 8.85 -0.6 Q 8.9 -1.5 8.0 -1.5 L 4.0 -1.5 Q 3.5 -1.4 3.55 -0.9 Z`, 1.15, 0.22), frame);
  // grip: rearward slant (22 deg), Gen4 finger grooves on the front strap, palm swell at the back
  const front = (y) => 3.0 + 0.3 * (y + 2);
  const back = (y) => -2.55 + 0.3 * y;
  let pts = `M 3.4 1.3 L 3.25 -1.6 L ${f(front(-2.0))} -2.0`;
  for (let i = 1; i <= 24; i++) {
    const y = -2.0 - i * (5.6 / 24);
    const off = 0.3 * Math.sin((i / 24) * Math.PI * 3) * (i < 24 ? 1 : 0);
    pts += ` L ${f(front(y) + Math.max(off, -0.05) - 0.05)} ${f(y)}`;
  }
  pts += ` Q ${f(front(-8.0) + 0.1)} -8.0 ${f(front(-8.0) - 0.3)} -8.05 L -4.55 -8.05 Q -5.0 -8.0 -4.95 -7.45`;
  pts += ` Q -3.65 -4.0 -2.6 -0.3 Q -2.45 0.9 -3.3 1.3 Z`;
  b.add(slab(pts, 3.0, 0.5), frame, 0, 0, 0, 0, { sticker: true });
  // RTF texture on the grip sides (small raised squares following the slant)
  const nub = box(0.18, 0.18, 0.14);
  for (let r = 0; r < 15; r++) {
    const y = -1.9 - r * 0.38;
    const x0 = back(y) + 0.75;
    const x1 = front(y) - 0.85;
    for (let x = x0 + (r % 2) * 0.19; x < x1; x += 0.38) b.add(nub, frame, x, y, 1.47, 0, { mirror: true, roll: 0 });
  }
  // thumb-rest recess line + mag release (both sides), slide stop, takedown lever, pins
  b.add(rbox(0.9, 0.75, 0.32, 0.12), blk, 2.65, -1.0, 1.42, 0, { mirror: true });
  b.add(rbox(2.6, 0.32, 0.16, 0.08), GM.steel, 3.2, 1.35, -1.24);
  b.add(rbox(0.7, 0.6, 0.3, 0.12), GM.steel, 2.1, 1.25, -1.3);
  b.add(rbox(0.45, 0.75, 0.18, 0.08), GM.steel, 6.0, 1.3, 1.25, 0, { mirror: true });
  for (let i = 0; i < 3; i++) b.add(box(0.06, 0.6, 0.06), GM.dark, 5.85 + i * 0.14, 1.3, 1.36, 0, { mirror: true });
  screw(b, 4.6, 0.45, 1.22, GM.steel, 0.16);
  screw(b, 7.1, 1.15, 1.22, GM.steel, 0.16);
  screw(b, -0.8, 0.8, 1.22, GM.steel, 0.14);
  // trigger with safety blade
  b.add(slab('M 5.5 0.9 L 6.35 0.9 Q 6.35 -0.4 5.85 -1.15 L 5.3 -1.05 Q 5.75 -0.2 5.5 0.9 Z', 0.75, 0.15), blk);
  b.add(slab('M 5.35 0.2 L 5.7 0.2 Q 5.75 -0.45 5.45 -0.85 L 5.25 -0.8 Q 5.5 -0.3 5.35 0.2 Z', 0.85, 0.06), GM.dark);

  // ---------------------------------------------------------------- magazine
  // steel-lined polymer mag inside the grip, extended base plate below
  const magC = (y) => 0.55 + 0.3 * y;
  b.group('mag', magC(0.8), 0.8);
  const mg = { group: 'mag' };
  b.add(slab(`M ${f(magC(1.2) - 1.55)} 1.2 L ${f(magC(1.2) + 1.6)} 1.2 L ${f(magC(-8.0) + 1.6)} -8.0 L ${f(magC(-8.0) - 1.55)} -8.0 Z`, 2.2, 0.15), GM.dark, 0, 0, 0, 0, mg);
  b.add(rbox(0.9, 0.5, 1.2, 0.2), GM.brass, magC(1.25) + 0.6, 1.25, 0, -0.35, mg);
  b.add(slab('M 1.15 -7.95 L -4.75 -7.95 Q -5.05 -8.2 -5.05 -8.6 L -4.95 -8.95 Q -4.8 -9.2 -4.4 -9.2 L 0.7 -9.2 Q 1.15 -9.15 1.2 -8.7 Z', 2.95, 0.3), blk, 0, 0, 0, 0, mg);
  b.add(rbox(2.2, 0.3, 3.0, 0.1), GM.dark, -1.9, -9.1, 0, 0, mg);

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', -0.1, -3.4);
  b.anchor('eject', (PR + PF) / 2, ST - 0.4, 1.3);
  b.anchor('sight', SR + 1.0, ST + 0.68);
  b.anchor('muzzle', SF + 0.1, BORE);
};
