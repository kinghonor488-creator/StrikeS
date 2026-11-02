// f7: FN Five-seveN. See kit.js for the authoring conventions (side view, centimetres).
// Long polymer-covered slide with a raised rear section, long dust cover with a slotted rail,
// big rounded trigger guard, upright thick grip for the long 5.7 mm magazine, ambi safety.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

const f = (n) => n.toFixed(3);

export default (b) => {
  const frame = GM.polymer, slideMat = GM.paint('#34373b', 0.55), blk = GM.dark;
  const BORE = 3.45;
  const SB = 1.9, STF = 4.55, STR = 4.95, SR = -3.4, SF = 16.6, STEP = 5.2;
  const SW = 2.6;
  const PR = 4.2, PF = 7.9;

  // ---------------------------------------------------------------- slide
  b.group('slide', 6, BORE);
  const g = { group: 'slide' };
  // rear section (taller, with serrations) - sticker surface
  b.add(slab(`M ${SR} ${SB} L ${PR} ${SB} L ${PR} ${STF} L ${PR - 0.4} ${STR} L ${SR + 0.35} ${STR} Q ${SR} ${STR} ${SR} ${STR - 0.35} Z`, SW, 0.3), slideMat, 0, 0, 0, 0, { group: 'slide', sticker: true });
  // the raised rear deck continues over the port as a narrower left wall
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} ${STF} L ${PR - 0.3} ${STF} Z`, 1.4, 0.15), slideMat, 0, 0, -SW / 2 + 0.7, 0, g);
  b.add(slab(`M ${PR - 0.3} ${SB} L ${PF + 0.3} ${SB} L ${PF + 0.3} 3.2 L ${PR - 0.3} 3.2 Z`, 1.1, 0.12), slideMat, 0, 0, SW / 2 - 0.55, 0, g);
  // long front section
  b.add(slab(`M ${PF} ${SB} L ${SF - 0.5} ${SB} L ${SF} ${SB + 0.5} L ${SF} ${STF - 0.35} Q ${SF} ${STF} ${SF - 0.35} ${STF} L ${PF} ${STF} Z`, SW, 0.3), slideMat, 0, 0, 0, 0, g);
  // rear serrations
  for (let i = 0; i < 8; i++) b.add(rbox(0.2, STR - SB - 0.7, 0.12, 0.05), slideMat, SR + 0.55 + i * 0.34, (SB + STR) / 2, SW / 2 + 0.01, 0, { group: 'slide', mirror: true });
  // extractor
  b.add(rbox(2.0, 0.4, 0.16, 0.07), GM.steel, PR - 0.9, 3.7, SW / 2 + 0.03, 0, g);
  // rear sight (adjustable block) and front sight post
  b.add(rbox(1.6, 0.45, 2.0, 0.12), GM.dark, SR + 1.3, STR + 0.2, 0, 0, g);
  b.add(rbox(1.2, 0.5, 0.6, 0.1), GM.dark, SR + 1.2, STR + 0.55, 0.68, 0, { group: 'slide', mirror: true });
  b.add(new THREE.CylinderGeometry(0.12 * CM, 0.12 * CM, 0.2 * CM, 8).rotateZ(Math.PI / 2), GM.steel, SR + 1.6, STR + 0.2, 1.05, 0, g);
  b.add(rbox(0.9, 0.55, 0.42, 0.1), GM.dark, SF - 1.0, STF + 0.27, 0, 0, g);
  b.add(new THREE.CylinderGeometry(0.1 * CM, 0.1 * CM, 0.05 * CM, 10).rotateX(Math.PI / 2), GM.paint('#e9e7dc', 0.4), SF - 1.46, STF + 0.38, 0, 0, g);

  // ---------------------------------------------------------------- barrel (static)
  b.add(rbox(PF - PR + 0.2, 1.2, 1.15, 0.12), GM.steel, (PR + PF) / 2, 3.85, 0.62);
  b.add(lathe([[0.36, 0], [0.6, 0], [0.6, 0.55], [0.52, 0.62], [0.36, 0.62]], 20), GM.steel, SF - 0.55, BORE);
  b.add(tube(0.36, 0.6, 0.36, 12), GM.dark, SF - 0.6, BORE);
  // recoil spring guide (bright tip under the muzzle)
  b.add(tube(0.42, 0.2, 0.42, 14), GM.dark, SF - 0.2, 2.45);
  b.add(tube(0.3, 0.3, 0.3, 12), GM.bright, SF - 0.15, 2.45);

  // ---------------------------------------------------------------- frame
  b.add(slab(`M -3.6 1.55 Q -3.9 1.88 -3.3 1.88 L 15.6 1.88 L 15.9 1.6 L 15.9 0.5 L 10.6 0.5 L 10.2 0.9 L 3.4 0.9 L 3.0 -0.5 L -2.2 -0.5 Q -2.5 0.7 -3.6 1.55 Z`, 2.45, 0.3), frame);
  // accessory rail with three cross slots, rail grooves on the sides
  b.add(slab('M 10.2 0.6 L 15.9 0.6 L 15.9 -0.05 Q 15.9 -0.15 15.7 -0.15 L 10.4 -0.15 Q 10.2 -0.15 10.2 0.05 Z', 2.3, 0.15), frame);
  b.add(box(5.4, 0.16, 0.06), GM.dark, 13.1, 0.3, 1.15, 0, { mirror: true });
  for (let i = 0; i < 3; i++) b.add(box(0.45, 0.32, 2.34), GM.dark, 11.6 + i * 1.55, -0.1);
  // big rounded trigger guard
  b.add(slab(`M 3.1 0.9 L 10.3 0.9 L 10.4 -0.6 Q 10.4 -2.6 8.5 -2.6 L 4.0 -2.6 Q 3.0 -2.4 2.75 -1.5 Z
              M 3.95 0.6 L 9.5 0.6 L 9.55 -0.7 Q 9.5 -1.95 8.3 -1.95 L 4.3 -1.95 Q 3.75 -1.85 3.8 -1.2 Z`, 1.2, 0.25), frame);
  // thick, upright grip
  const front = (y) => 3.25 + 0.22 * (y + 2.0);
  const back = (y) => -2.4 + 0.22 * y;
  let pts = `M 3.5 1.3 L 3.35 -1.6 L ${f(front(-2.0))} -2.0`;
  for (let i = 1; i <= 16; i++) {
    const y = -2.0 - i * (5.8 / 16);
    pts += ` L ${f(front(y) + 0.15 * Math.sin((i / 16) * Math.PI))} ${f(y)}`;
  }
  pts += ` Q ${f(front(-7.8) + 0.05)} -7.85 ${f(front(-7.8) - 0.3)} -7.9 L ${f(back(-7.8) + 0.3)} -7.9 Q ${f(back(-7.8) - 0.15)} -7.85 ${f(back(-7.8) - 0.1)} -7.4`;
  pts += ` Q ${f(back(-4.5) - 0.45)} -4.5 -2.5 -0.3 Q -2.4 0.9 -3.3 1.3 Z`;
  b.add(slab(pts, 3.1, 0.55), frame, 0, 0, 0, 0, { sticker: true });
  // stippled grip panels with a smooth border
  const nub = box(0.17, 0.17, 0.12);
  for (let r = 0; r < 15; r++) {
    const y = -2.2 - r * 0.38;
    for (let x = back(y) + 0.95 + (r % 2) * 0.19; x < front(y) - 0.9; x += 0.38) b.add(nub, frame, x, y, 1.49, 0, { mirror: true });
  }
  // ambidextrous manual safety above the trigger, slide stop (left), mag release, pins
  b.add(rbox(1.6, 0.42, 0.22, 0.1), GM.steel, 3.9, 1.25, 1.27, 0.15, { mirror: true });
  b.add(rbox(0.5, 0.65, 0.3, 0.12), GM.steel, 4.5, 1.15, 1.32, 0, { mirror: true });
  b.add(rbox(3.2, 0.32, 0.16, 0.08), GM.steel, 1.3, 1.4, -1.28);
  b.add(rbox(0.7, 0.55, 0.3, 0.12), GM.steel, 0.1, 1.35, -1.34);
  b.add(rbox(0.85, 0.75, 0.32, 0.12), blk, 2.9, -1.1, 1.5, 0, { mirror: true });
  screw(b, 6.0, 1.3, 1.25, GM.steel, 0.16);
  screw(b, 7.6, 0.5, 1.25, GM.steel, 0.16);
  screw(b, -1.4, 0.7, 1.25, GM.steel, 0.14);
  // trigger
  b.add(slab('M 6.0 0.9 L 6.9 0.9 Q 6.95 -0.5 6.35 -1.45 L 5.75 -1.35 Q 6.3 -0.3 6.0 0.9 Z', 0.75, 0.15), GM.steel);

  // ---------------------------------------------------------------- magazine
  const magC = (y) => 0.55 + 0.22 * y;
  b.group('mag', magC(0.8), 0.8);
  const mg = { group: 'mag' };
  b.add(slab(`M ${f(magC(1.2) - 1.9)} 1.2 L ${f(magC(1.2) + 1.9)} 1.2 L ${f(magC(-7.8) + 1.9)} -7.9 L ${f(magC(-7.8) - 1.9)} -7.9 Z`, 2.0, 0.15), blk, 0, 0, 0, 0, mg);
  b.add(rbox(1.4, 0.4, 0.8, 0.15), GM.brass, magC(1.25) + 0.5, 1.25, 0, -0.2, mg);
  const fb = front(-7.8), bb = back(-7.8);
  b.add(slab(`M ${f(fb - 0.15)} -7.85 L ${f(bb + 0.05)} -7.85 Q ${f(bb - 0.25)} -8.1 ${f(bb - 0.15)} -8.4 Q ${f(bb)} -8.6 ${f(bb + 0.4)} -8.6 L ${f(fb - 0.4)} -8.6 Q ${f(fb)} -8.55 ${f(fb)} -8.2 Z`, 3.0, 0.3), frame, 0, 0, 0, 0, mg);

  // ---------------------------------------------------------------- anchors
  b.anchor('grip', 0.0, -3.4);
  b.anchor('eject', (PR + PF) / 2, STF - 0.4, 1.3);
  b.anchor('sight', SR + 1.2, STR + 0.8);
  b.anchor('muzzle', SF + 0.1, BORE);
};
