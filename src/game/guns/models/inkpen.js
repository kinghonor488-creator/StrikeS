// inkpen: see kit.js for the authoring conventions (side view, centimetres).
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

export default (b, accent) => {
  // a fat felt marker — the ink tool
  const ink = accent || '#2f2766';
  b.add(lathe([[0, 0], [1.25, 0], [1.4, 0.6], [1.4, 13.5], [1.2, 14.2], [0, 14.2]], 24), GM.paint('#f2efe6', 0.45), -4, 0, 0, 0, { sticker: true });
  b.add(lathe([[1.42, 0], [1.42, 4.6]], 24), GM.paint(ink, 0.5), 2, 0);
  b.add(lathe([[0, 0], [1.2, 0], [1.0, 1.4], [0.55, 2.4], [0.45, 3.0], [0, 3.0]], 20), GM.paint('#d8d4c8', 0.5), 10.2, 0);
  b.add(rbox(1.6, 0.9, 0.9, 0.3), GM.paint(ink, 0.35), 14.0, 0);
  b.add(lathe([[0, 0], [1.45, 0], [1.45, 3.6], [1.3, 4.0], [0, 4.0]], 24), GM.paint(ink, 0.5), -8, 0);
  b.add(rbox(4.0, 0.5, 0.4, 0.15), GM.paint(ink, 0.5), -6, 1.6);
  b.anchor('grip', 0, 0); b.anchor('muzzle', 14.8, 0); b.anchor('eject', 0, 0); b.anchor('butt', -8, 0); b.anchor('sight', 0, 1.5);
};
