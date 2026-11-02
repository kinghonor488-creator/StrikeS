// s08: see kit.js for the authoring conventions (side view, centimetres).
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';
import { boltGroup } from './_shared.js';

export default (b) => {
  const y = 5.8;
  const stock = GM.paint('#4f5a43', 0.62);
  b.add(slab('M 46 3.8 Q 47.6 3.8 47.8 2.8 L 47.6 1.4 L 14 0.4 L 10.4 -1.2 L 8.6 -9.4 Q 7.8 -10.6 6.4 -10.4 L 3.0 -9.6 Q 2.0 -8.8 2.2 -7.2 L 2.4 -1.6 L -4 -3.4 L -22 -6.4 Q -24.6 -6.8 -25 -4.6 L -25 3.4 Q -24.6 5.0 -22.8 5.0 L -4 4.4 L 12 4.6 Z', 4.0, 0.75), stock, 0, 0, 0, 0, { sticker: true });
  b.add(slab('M -25 4.6 L -26.2 4.6 L -26.2 -5.8 L -25 -6.0 Z', 4.2, 0.3), GM.rubber);
  b.add(tube(1.6, 20, 1.6, 22), GM.blued, 2, y);
  boltGroup(b, 6, y);
  trigger(b, 4, 0.4, 5, GM.blued);
  b.group('mag', 16.6, 0.4);
  b.add(slab('M 13.4 0.6 L 19.8 0.6 L 19.6 -4.6 L 13.6 -4.6 Z', 2.4, 0.3), GM.polymer, 0, 0, 0, 0, { group: 'mag' });
  b.add(tube(1.1, 46, 0.75), GM.blued, 22, y);
  const mz = muzzle(b, 68, y, 'brake', 0.75);
  scope(b, 0, 30, 10.6, 1.4, 2.3);
  swivel(b, -18, -5.6); swivel(b, 40, 1.0);
  b.anchor('grip', 5.4, -3.6); b.anchor('support', 34, 2.4); b.anchor('muzzle', 68 + mz, y);
  b.anchor('eject', 12, 6.6, 1.8); b.anchor('butt', -26.2, 0); b.anchor('sight', 0, 10.6);
};
