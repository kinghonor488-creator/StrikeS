// p25: see kit.js for the authoring conventions (side view, centimetres).
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';
import { pistol } from './_shared.js';

export default (b) => pistol(b, { len: 15.6, slideH: 3.0, slideMat: GM.blued, frameW: 2.9 });
