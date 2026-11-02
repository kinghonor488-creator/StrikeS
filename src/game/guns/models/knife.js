// knife: see kit.js for the authoring conventions (side view, centimetres).
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b, accent) => {
  // heavy-duty box cutter: aluminium body with grip ridges, snap-off blade
  b.add(slab('M -2 0 L 11 0 L 12.4 1.0 L 12.4 2.6 L -2 2.8 Q -3.2 2.6 -3.2 1.4 Q -3.2 0 -2 0 Z', 2.2, 0.35), GM.paint(accent || '#e8b923', 0.45), 0, 0, 0, 0, { sticker: true });
  for (let i = 0; i < 6; i++) b.add(rbox(0.5, 0.25, 2.3, 0.1), GM.rubber, -1 + i * 1.6, 0.05);
  b.add(rbox(1.6, 0.6, 1.0, 0.2), GM.dark, 6, 3.0);
  b.add(slab('M 12.4 0.9 L 22 0.9 L 24.2 2.5 L 12.4 2.5 Z', 0.25, 0.04), GM.bright);
  for (let i = 0; i < 5; i++) b.add(box(0.1, 1.6, 0.27), GM.park, 14 + i * 2, 1.7, 0, -0.5);
  b.anchor('grip', 3, 1.2); b.anchor('muzzle', 24, 1.7); b.anchor('eject', 3, 1.2); b.anchor('butt', -3.2, 0); b.anchor('sight', 3, 3);
};
