// m10: MAC-10 (Ingram M10, .45). See kit.js for the authoring conventions (side view, centimetres).
// Stamped-steel box receiver (upper shell over a lower), cocking knob on top, threaded barrel stub,
// collapsed wire stock (side rods + folded strut), bent-rod trigger guard, mag through the grip,
// front hand strap.
import * as THREE from 'three';
import {
  GunBuilder, GM, CM, slab, tube, lathe, rbox, box, sphere,
  rail, screw, trigger, frontSight, rearSight, scope, muzzle, swivel,
} from '../kit.js';

/** Bent steel rod through side-view points [x, y, z?] (cm). */
function wire(b, pts, r, mat, opts = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([x, y, z = 0]) => new THREE.Vector3(z * CM, y * CM, -x * CM)), false, 'centripetal');
  b.add(new THREE.TubeGeometry(curve, opts.seg || 28, r * CM, 8, false), mat, 0, 0, 0, 0, opts);
}

export default (b) => {
  const y = 4.6; // bore line
  const S = GM.park;

  // --- receiver: upper U-shell (rounded top edges) over the lower receiver ---------------
  b.add(slab('M 0 3.6 L 22.4 3.6 L 22.4 7.0 Q 22.4 7.6 21.8 7.6 L 0.6 7.6 Q 0 7.6 0 7.0 Z', 5.0, 0.6), S, 0, 0, 0, 0, { sticker: true });
  b.add(slab('M 0.3 0.4 L 20.0 0.4 Q 20.8 0.5 21.0 1.4 L 21.0 3.7 L 0.3 3.7 Z', 4.7, 0.35), S);
  b.add(box(21.4, 0.1, 5.0), GM.dark, 11, 3.64); // upper/lower seam
  // stamped grooves along both sides of the upper
  for (const s of [-1, 1]) {
    b.add(box(15, 0.14, 0.06), GM.dark, 10.6, 6.55, s * 2.47);
    b.add(box(8, 0.14, 0.06), GM.dark, 14.4, 5.95, s * 2.47);
  }
  // ejection port (right side) with the bolt face behind it
  b.add(box(5.2, 1.6, 0.08), GM.dark, 11.8, 5.5, 2.47);
  b.add(box(4.6, 1.1, 0.06), GM.steel, 12.0, 5.5, 2.5);
  // cocking-knob slot + knob (front of the top)
  b.add(box(9.5, 0.1, 0.55), GM.dark, 13.4, 7.62);
  b.add(new THREE.CylinderGeometry(0.5 * CM, 0.55 * CM, 1.0 * CM, 14), GM.steel, 17.6, 8.1);
  b.add(new THREE.CylinderGeometry(0.75 * CM, 0.75 * CM, 0.8 * CM, 16), GM.steel, 17.6, 8.9);
  for (let i = 0; i < 8; i++) b.add(box(0.12, 0.7, 1.6), GM.dark, 17.6, 8.9, 0, 0, { yaw: i * Math.PI / 8 });
  b.add(box(0.4, 0.3, 1.6), GM.dark, 17.6, 9.2); // sighting notch
  // front sight: post between two protective ears
  b.add(rbox(1.6, 0.5, 2.4, 0.15), GM.steel, 21.3, 7.85);
  b.add(rbox(1.2, 1.4, 0.4, 0.12), GM.steel, 21.3, 8.6, 0.85, 0, { mirror: true });
  b.add(box(0.4, 1.1, 0.35), GM.steel, 21.3, 8.4);
  // rear peep sight with ears
  b.add(rbox(1.8, 0.5, 3.0, 0.15), GM.steel, 1.4, 7.85);
  b.add(rbox(1.4, 1.6, 0.4, 0.12), GM.steel, 1.4, 8.6, 1.15, 0, { mirror: true });
  b.add(rbox(0.3, 1.2, 1.6, 0.1), GM.steel, 1.6, 8.6);
  b.add(box(0.34, 0.3, 0.3), GM.dark, 1.6, 8.75);
  // rear end cap
  b.add(rbox(0.9, 7.0, 5.2, 0.35), S, -0.25, 4.0);
  // rivets / pins on the lower
  for (const [px, py] of [[2.2, 2.0], [12.4, 2.6], [15.6, 2.0], [19.4, 2.0]]) screw(b, px, py, 2.36, GM.steel, 0.3);

  // --- barrel: hex nut, threaded stub ----------------------------------------------------
  b.add(lathe([[0, 0], [1.3, 0], [1.3, 1.0], [0, 1.0]], 6), GM.steel, 22.3, y, 0, 0, { roll: Math.PI / 6 });
  b.add(tube(0.78, 1.6, 0.78, 16), GM.steel, 23.3, y);
  const th = [[0, 0]];
  for (let i = 0; i <= 12; i++) th.push([i % 2 ? 0.7 : 0.8, i * 0.25]);
  th.push([0.62, 3.1], [0.3, 3.1], [0.3, 2.4]);
  b.add(lathe(th, 16), GM.steel, 24.8, y);
  b.add(tube(0.3, 0.1, 0.3, 10), GM.dark, 27.85, y);

  // --- grip / mag well, heel mag catch -----------------------------------------------------
  b.add(slab('M 4.8 0.6 L 10.4 0.6 L 10.1 -10.3 Q 10.0 -11 9.3 -11 L 5.5 -11 Q 4.8 -11 4.9 -10.3 Z', 4.2, 0.6), S);
  for (const s of [-1, 1]) b.add(slab('M 5.4 -3.4 L 9.6 -3.4 L 9.4 -9.4 L 5.6 -9.4 Z', 0.2, 0.06), GM.dark, 0, 0, s * 2.12);
  b.add(rbox(1.0, 1.6, 2.4, 0.25), GM.steel, 4.5, -10.0);

  // --- trigger: bent-rod guard, curved blade, selector, bolt-lock -------------------------
  wire(b, [[10.2, -2.6], [12.1, -2.75], [14.2, -2.5], [15.2, -1.6], [15.6, -0.3], [15.6, 0.5]], 0.3, GM.steel);
  b.add(slab('M 11.6 0.4 L 12.5 0.4 Q 12.5 -1.0 11.8 -2.0 L 11.4 -1.8 Q 11.9 -0.9 11.6 0.4 Z', 0.6, 0.1), GM.steel);
  b.add(new THREE.CylinderGeometry(0.45 * CM, 0.45 * CM, 0.3 * CM, 12).rotateZ(Math.PI / 2), GM.steel, 13.4, 2.4, -2.45);
  b.add(rbox(2.0, 0.5, 0.25, 0.1), GM.steel, 14.2, 2.1, -2.6, -0.4);
  b.add(rbox(1.2, 0.6, 1.2, 0.2), GM.steel, 16.8, 0.2);

  // --- collapsed wire stock: side rods, butt bar, folded strut over the rear -------------
  for (const s of [-1, 1]) {
    b.add(tube(0.33, 21.8, 0.33, 10), GM.steel, -2.2, 2.0, s * 2.62);
    b.add(sphere(0.42), GM.steel, 19.6, 2.0, s * 2.62);
    wire(b, [[-2.4, 6.0, s * 2.62], [-2.3, 7.8, s * 2.62], [-1.6, 8.5, s * 2.62], [2.0, 8.6, s * 2.62], [5.2, 8.2, s * 2.62], [6.4, 7.0, s * 2.62]], 0.3, GM.steel);
  }
  b.add(rbox(1.0, 7.6, 6.2, 0.45), GM.steel, -2.5, 3.6);
  b.add(rbox(1.2, 1.6, 5.0, 0.4), GM.rubber, -2.6, 0.2);

  // --- magazine ---------------------------------------------------------------------------
  b.group('mag', 7.4, -11);
  b.add(slab('M 5.5 -6 L 9.3 -6 L 9.3 -19.0 L 5.5 -19.0 Z', 2.9, 0.25), GM.steel, 0, 0, 0, 0, { group: 'mag' });
  for (const s of [-1, 1]) b.add(box(0.5, 6.5, 0.1), GM.dark, 6.3, -15.4, s * 1.46, 0, { group: 'mag' });
  b.add(rbox(4.6, 0.7, 3.4, 0.25), GM.steel, 7.4, -19.25, 0, 0, { group: 'mag' });

  // --- front hand strap (left side) ---------------------------------------------------------
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14), GM.steel, 20.0, 1.1, -2.7, 0, { yaw: Math.PI / 2 });
  b.add(rbox(1.2, 0.9, 0.3, 0.1), GM.bright, 20.0, 0.0, -2.95);
  b.add(slab('M 18.9 -0.4 L 21.1 -0.4 L 21.3 -10.2 Q 21.3 -10.8 20.7 -10.8 L 19.5 -10.8 Q 18.9 -10.8 18.9 -10.2 Z', 0.28, 0.06), GM.olive, 0, 0, -2.95);
  b.add(rbox(2.6, 0.5, 0.45, 0.1), GM.bright, 20.1, -2.0, -2.95);

  b.anchor('grip', 7.2, -4.2); b.anchor('support', 21.6, -0.8); b.anchor('muzzle', 27.9, y);
  b.anchor('eject', 11.8, 6.0, 2.5); b.anchor('butt', -3.0, 0); b.anchor('sight', 1.6, 9.0);
};
