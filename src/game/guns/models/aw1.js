// aw1: Accuracy International AW-style bolt-action sniper rifle. See kit.js for the authoring conventions.
// Real-world: ~118 cm overall, 66-69 cm fluted barrel with a muzzle brake, olive thumbhole stock,
// large 50 mm riflescope, detachable box magazine ahead of the trigger guard.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GM, CM, slab, tube, lathe, rbox, box, sphere, screw } from '../kit.js';

const B = 6.0; // bore height
const rb1 = (lx, ly, tz, r = 0.15) => new RoundedBoxGeometry(tz * CM, ly * CM, lx * CM, 1, Math.min(r, lx / 2 - 0.01, ly / 2 - 0.01, tz / 2 - 0.01) * CM);

export default (b) => {
  const green = GM.paint('#56653b', 0.6);
  const blued = GM.blued;
  const steel = GM.park;

  // ---------------- thumbhole stock (one olive shell) ----------------
  b.add(slab(
    'M 41.0 3.4 Q 41.0 4.4 40.0 4.4 L -7.0 4.4 Q -10.0 4.6 -12.6 6.8 Q -13.6 7.6 -15.0 7.6 L -29.8 7.8 Q -31.0 7.8 -31.0 6.6 ' +
    'L -31.0 -9.4 Q -31.0 -10.6 -29.6 -10.6 L -25.6 -10.4 L -6.6 -10.6 Q -4.6 -11.0 -4.0 -11.8 Q -3.0 -12.6 -1.4 -12.4 L 0.2 -11.8 ' +
    'Q 1.2 -11.2 1.0 -10.0 L 1.4 -6.8 Q 2.0 -6.0 1.6 -5.0 L 2.6 -2.6 Q 3.0 -1.4 4.0 -1.2 L 16.4 -1.2 L 17.6 -0.6 L 39.4 -0.4 Q 41.0 -0.2 41.0 1.0 Z ' +
    'M -3.6 0.6 Q -2.8 -2.6 -3.4 -6.0 Q -3.8 -7.6 -5.6 -7.6 L -14.4 -6.6 Q -16.4 -6.2 -16.2 -4.0 L -15.0 1.0 Q -14.2 3.2 -11.6 3.0 L -6.0 2.6 Q -4.2 2.4 -3.6 0.6 Z',
    5.0, 0.9), green, 0, 0, 0, 0, { sticker: true });
  // grip finger grooves / stippled panel
  for (let i = 0; i < 3; i++) b.add(rb1(0.5, 0.8, 5.04, 0.2), GM.dark, 1.8 - i * 0.25, -6.8 - i * 1.6, 0, 0.2);
  // fore-end: flat side recess + bedding screws + sling stud
  for (const s of [-1, 1]) b.add(slab('M 14 3.4 L 38.4 3.4 Q 39.4 3.4 39.4 2.4 L 39.4 1.0 L 14 0.4 Z', 0.3, 0.12), green, 0, 0, s * 2.45);
  for (const [x, yy] of [[-6.0, 2.4], [11.6, 1.8], [20.0, 2.0]]) screw(b, x, yy, 2.52, steel, 0.35);
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14).rotateY(Math.PI / 2), steel, -22.0, -11.2);
  // adjustable cheek piece with its two posts
  b.add(slab('M -14.6 8.0 L -28.8 8.2 L -28.8 9.6 Q -28.8 10.4 -28.0 10.4 L -16.4 10.2 Q -14.6 10.0 -14.6 8.8 Z', 4.4, 0.6), green);
  for (const x of [-17.0, -26.4]) b.add(tube(0.4, 1.0, 0.4, 10).rotateX(Math.PI / 2), steel, x, 7.4 + 0.5);
  // butt: spacers + rubber pad, rear monopod spike (retracted)
  b.add(rbox(0.6, 17.4, 4.8, 0.2), GM.dark, -31.3, -1.4);
  b.add(slab('M -31.6 7.8 L -33.2 7.8 Q -33.6 7.6 -33.6 7.0 L -33.6 -9.8 Q -33.4 -10.6 -32.8 -10.6 L -31.6 -10.6 Z', 5.0, 0.45), GM.rubber);
  b.add(rbox(1.6, 2.4, 1.6, 0.4), steel, -27.6, -11.6);
  b.add(tube(0.35, 2.6, 0.2, 10).rotateX(Math.PI / 2), steel, -27.6, -12.8 + 1.3);

  // ---------------- trigger guard, trigger, magazine ----------------
  b.add(slab('M 3.4 -1.0 L 10.0 -1.0 L 10.0 -2.0 Q 9.8 -5.2 7.4 -5.4 L 4.6 -5.4 Q 3.2 -5.2 3.0 -4.0 Z M 4.2 -1.6 L 9.0 -1.6 Q 8.8 -4.4 7.2 -4.5 L 5.0 -4.5 Q 4.0 -4.3 4.2 -3.6 Z', 1.4, 0.3), steel);
  b.add(slab('M 5.4 -1.2 L 6.4 -1.2 Q 6.4 -2.8 5.6 -3.8 L 5.2 -3.6 Q 5.8 -2.6 5.4 -1.2 Z', 0.6, 0.1), GM.bright);
  b.add(rb1(1.0, 1.4, 0.9, 0.2), steel, 10.4, -1.8);   // mag release paddle
  b.group('mag', 13.4, -1.0);
  b.add(slab('M 10.8 -0.6 L 16.4 -0.6 L 16.4 -5.6 Q 16.4 -6.4 15.6 -6.4 L 11.6 -6.4 Q 10.8 -6.4 10.8 -5.6 Z', 3.0, 0.3), steel, 0, 0, 0, 0, { group: 'mag' });
  b.add(rbox(4.6, 0.3, 0.3, 0.1), GM.dark, 13.6, -3.6, 1.52, 0, { group: 'mag' });

  // ---------------- action: receiver, rail, bolt ----------------
  b.add(lathe([[0, 0], [1.6, 0], [2.0, 0.4], [2.0, 19.4], [1.8, 20.0], [0, 20.0]], 24), blued, -8.0, B);
  b.add(rbox(20, 2.2, 3.6, 0.4), blued, 2.0, B - 1.6, 0, 0, { sticker: true });
  b.add(rbox(19, 0.9, 2.2, 0.2), blued, 1.6, B + 2.0);                  // scope base
  for (let i = 0; i < 17; i++) b.add(box(0.5, 0.4, 2.2), blued, -7.2 + i * 1.1, B + 2.65);
  b.add(rb1(7.6, 1.6, 0.3, 0.3), GM.dark, 2.4, B + 0.4, 2.0);             // ejection port (right)
  b.add(rb1(1.2, 0.8, 0.8, 0.3), steel, -9.2, B + 1.6, -1.4);             // safety lever (left rear)
  b.add(rb1(1.2, 0.6, 0.8, 0.2), steel, -6.0, B - 0.6, -2.1);             // bolt release
  // bolt group (pivot on the bore axis): bolt body in the port, rear shroud, handle + knob
  const bx = -4.0;
  b.group('bolt', bx, B);
  b.add(tube(1.1, 7.4, 1.1, 16), GM.bright, -0.8, B, 0.95, 0, { group: 'bolt' });
  for (let i = 0; i < 3; i++) b.add(box(5.8, 0.2, 0.2), GM.dark, 2.4, B + 0.5 - i * 0.5, 2.0, 0, { group: 'bolt' });
  b.add(lathe([[0, 0], [1.2, 0], [1.6, 0.6], [1.6, 3.4], [1.5, 3.8], [0, 3.8]], 18), blued, -11.6, B, 0, 0, { group: 'bolt' });
  b.add(box(1.6, 0.4, 0.4), GM.dark, -10.0, B + 1.65, 0, 0, { group: 'bolt' });   // cocking indicator
  b.add(rb1(1.2, 1.0, 4.4, 0.4), blued, bx - 1.8, B - 0.4, 2.6, 0, { group: 'bolt', roll: 0.35 });
  b.add(sphere(1.0), GM.polymer, bx - 1.8, B - 1.2, 5.0, 0, { group: 'bolt' });

  // ---------------- fluted barrel + muzzle brake ----------------
  b.add(lathe([[1.75, 0], [1.75, 2.4], [1.5, 2.8], [1.5, 30.0], [1.15, 64.0], [1.15, 66.0]], 22), blued, 12.0, B);
  for (let i = 0; i < 6; i++) b.add(box(24, 0.22, 3.03), GM.dark, 29.0, B, 0, 0, { roll: (i / 6) * Math.PI });
  const fx = 78.0;
  b.add(lathe([[1.0, 0], [1.75, 0], [1.85, 0.4], [1.85, 6.4], [1.6, 6.9], [0.6, 6.9]], 22), steel, fx, B);
  for (let i = 0; i < 3; i++) b.add(rb1(1.0, 1.9, 3.9, 0.25), GM.dark, fx + 1.8 + i * 1.6, B);
  b.add(rb1(5.6, 0.5, 2.4, 0.15), GM.dark, fx + 3.4, B + 1.75);              // top vent
  b.add(lathe([[1.8, 0], [2.05, 0.15], [2.05, 0.75], [1.8, 0.9]], 22), GM.dark, fx, B); // lock ring

  // ---------------- riflescope (sight line y = sy) ----------------
  const sy = 12.4;
  b.add(lathe([[1.6, 0], [2.2, 0], [2.3, 0.4], [2.3, 4.0], [1.6, 6.4], [1.55, 6.4], [1.55, 15.0], [1.95, 16.0], [3.0, 21.6], [3.1, 25.4], [2.9, 25.8], [2.6, 25.8]], 28), steel, -12.0, sy);
  for (const [x, r] of [[-11.2, 2.33], [-10.0, 2.33], [12.4, 3.12]]) b.add(lathe([[r, 0], [r, 0.25]], 28), GM.dark, x, sy);
  b.add(tube(2.65, 0.25, 2.65, 28), GM.glass, 13.6, sy);
  b.add(tube(1.65, 0.2, 1.65, 22), GM.glass, -12.05, sy);
  b.add(rbox(5.4, 3.2, 3.4, 0.9), steel, 0.8, sy);                          // turret saddle
  b.add(lathe([[0, 0], [1.3, 0], [1.3, 1.6], [1.15, 1.8], [0, 1.8]], 18), steel, 0.8, sy + 1.4, 0, Math.PI / 2);   // elevation
  b.add(lathe([[0, 0], [1.2, 0], [1.2, 1.5], [1.05, 1.7], [0, 1.7]], 18), steel, 0.8, sy, 1.5, 0, { yaw: -Math.PI / 2 }); // windage
  b.add(lathe([[0, 0], [1.0, 0], [1.0, 1.3], [0, 1.3]], 16), steel, 0.8, sy, -1.5, 0, { yaw: Math.PI / 2 });        // parallax
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(box(0.15, 1.4, 0.15), GM.dark, 0.8 + Math.cos(a) * 1.32, sy + 2.3, Math.sin(a) * 1.32);
  }
  // rings + clamps on the base
  for (const x of [-4.4, 7.2]) {
    b.add(lathe([[1.55, 0], [2.1, 0], [2.2, 0.3], [2.2, 1.7], [2.1, 2.0], [1.55, 2.0]], 22), steel, x - 1.0, sy);
    b.add(rbox(2.0, sy - B - 4.0, 2.4, 0.3), steel, x, (sy + B + 2.8) / 2 - 0.4);
    b.add(rb1(1.6, 1.2, 1.0, 0.3), steel, x, B + 2.8, 1.7);
  }

  // ---------------- folding bipod (legs forward, under the fore-end) ----------------
  b.add(rbox(4.0, 1.6, 3.2, 0.5), steel, 36.0, -1.0);
  for (const s of [-1, 1]) {
    b.add(tube(0.45, 16, 0.4, 12), steel, 37.0, -1.8, s * 1.2, 0, { yaw: -s * 0.03 });
    b.add(tube(0.32, 6, 0.32, 10), GM.bright, 52.6, -1.8, s * 1.7);
    b.add(rb1(1.6, 1.0, 1.0, 0.4), GM.rubber, 58.4, -1.8, s * 1.75);
  }

  b.anchor('grip', -1.2, -4.0);
  b.anchor('support', 27, 0.0);
  b.anchor('muzzle', fx + 6.9, B);
  b.anchor('eject', 2.4, B + 0.6, 2.2);
  b.anchor('butt', -33.6, 0);
  b.anchor('sight', -12.0, sy);
};
