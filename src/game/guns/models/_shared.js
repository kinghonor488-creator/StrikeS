// Helpers shared by several gun models.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export function boltGroup(b, x, y, big = 1) {
  b.group('bolt', x, y);
  b.add(lathe([[0, 0], [1.3 * big, 0], [1.4 * big, 0.6], [1.4 * big, 3.4], [0.8, 3.8], [0, 3.8]], 18), GM.blued, x - 4.2, y, 0, 0, { group: 'bolt' });
  b.add(rbox(1.0, 0.9, 3.8 * big, 0.35), GM.blued, x, y - 0.4, 1.9 * big, -0.2, { group: 'bolt' });
  b.add(sphere(0.85 * big), GM.blued, x - 0.4, y - 1.1, 3.9 * big, 0, { group: 'bolt' });
}

export function pistol(b, o) {
  const { len = 18, slideH = 3.2, frame = GM.polymer, slideMat = GM.park, gripMat = frame, y = 3.6 } = o;
  const top = 2.0 + slideH;
  b.group('slide', len / 2, y);
  b.add(slab(`M -1.2 2.0 L ${len} 2.0 L ${len + 0.2} ${top - 0.4} Q ${len} ${top} ${len - 0.6} ${top} L -0.8 ${top} Q -1.2 ${top - 0.2} -1.2 ${top - 0.6} Z`, o.slideW || 2.6, 0.28), slideMat, 0, 0, 0, 0, { group: 'slide' });
  for (let i = 0; i < 6; i++) b.add(box(0.25, slideH * 0.8, (o.slideW || 2.6) + 0.04), GM.dark, 0.4 + i * 0.55, 2 + slideH * 0.5, 0, 0, { group: 'slide' });
  b.add(box(4.2, 1.2, 0.2), GM.dark, len * 0.52, top - 1.0, (o.slideW || 2.6) / 2 + 0.02, 0, { group: 'slide' });
  b.add(rbox(1.0, 0.7, 2.0, 0.15), GM.dark, 0.3, top + 0.3, 0, 0, { group: 'slide' });
  b.add(rbox(0.8, 0.7, 0.5, 0.15), GM.dark, len - 1.2, top + 0.3, 0, 0, { group: 'slide' });
  b.add(sphere(0.12), GM.paint('#e8f8d8', 0.4), len - 1.2, top + 0.65, 0, 0, { group: 'slide' });
  // frame + grip (slanted), dust cover under the slide
  b.add(slab(`M -0.6 2.1 L ${len - 0.6} 2.1 L ${len - 0.6} 0.6 L 9.6 0.4 L 9 -0.4 L 5.8 -0.6 L 4.8 -1.0 L 3.6 -11 Q 3.4 -11.8 2.4 -11.8 L -2.4 -11.8 Q -3.4 -11.6 -3.2 -10.4 L -1.8 -1 Q -1.4 0.4 -0.6 2.1 Z`, o.frameW || 2.8, 0.5), frame, 0, 0, 0, 0, { sticker: true });
  if (gripMat !== frame) b.add(slab('M -1.4 -1.4 L 3.8 -1.4 L 3.0 -10.6 L -2.4 -10.6 Z', (o.frameW || 2.8) + 0.4, 0.4), gripMat);
  trigger(b, 6.6, 0.6, 4.4, frame, GM.steel);
  b.group('mag', 0, -11.8);
  b.add(slab('M -2.4 -10.8 L 2.6 -10.8 L 2.8 -12.4 L -2.6 -12.4 Z', 2.6, 0.2), o.magBase || GM.polymer, 0, 0, 0, 0, { group: 'mag' });
  b.add(slab('M -1.8 -1.2 L 2.4 -1.2 L 3.0 -10.8 L -2.0 -10.8 Z', 2.0, 0.1), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  b.add(tube(0.55, 0.5), GM.dark, len - 0.2, y);
  b.anchor('grip', 0.4, -4.4); b.anchor('eject', len * 0.52, top - 0.8, 1.4); b.anchor('butt', -3.4, 0);
  b.anchor('sight', 0.3, top + 0.7); b.anchor('muzzle', len + 0.3, y);
}
