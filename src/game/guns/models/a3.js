// a3: Steyr AUG A3-style bullpup with a rail-mounted optic. See kit.js for the authoring conventions.
// Real-world: ~79 cm overall, 50.8 cm barrel; olive polymer stock with the full-hand trigger guard,
// black receiver with a top rail, folding vertical foregrip on the barrel.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GM, CM, slab, tube, lathe, rbox, box, sphere, screw } from '../kit.js';

const B = 4.0; // bore height
const rb1 = (lx, ly, tz, r = 0.15) => new RoundedBoxGeometry(tz * CM, ly * CM, lx * CM, 1, Math.min(r, lx / 2 - 0.01, ly / 2 - 0.01, tz / 2 - 0.01) * CM);

function topRail(b, x0, x1, y, mat) {
  const len = x1 - x0;
  b.add(rbox(len, 0.8, 2.1, 0.12), mat, x0 + len / 2, y - 0.6);
  const n = Math.floor(len / 1.0);
  const tooth = box(0.52, 0.42, 2.1);
  for (let i = 0; i < n; i++) b.add(tooth, mat, x0 + 0.5 + i * (len / n), y - 0.21);
}

export default (b) => {
  const shell = GM.olive;
  const alu = GM.alu;
  const steel = GM.park;

  // ---------------- olive stock shell ----------------
  b.add(slab('M -33.0 6.4 L -16.2 6.4 L -15.6 5.4 L 10.2 5.4 Q 11.2 5.2 11.4 4.2 L 11.4 1.8 Q 11.2 0.6 9.6 0.4 L -3.0 0.2 L -6.2 0.0 L -8.6 -1.0 L -16.4 -1.2 Q -18.0 -1.6 -19.4 -4.6 Q -21.0 -6.6 -24.0 -7.0 L -31.4 -7.2 Q -33.0 -7.0 -33.2 -5.6 L -33.2 5.0 Q -33.2 6.4 -32.0 6.4 Z', 5.6, 0.9), shell, 0, 0, 0, 0, { sticker: true });
  // raised panel line along the side, ejection port cover bulges (both sides: AUG is convertible)
  for (const s of [-1, 1]) {
    b.add(slab('M -31.6 5.0 L -17.4 5.0 L -17.0 1.2 Q -18.4 -2.6 -21 -4.6 L -31.0 -5.4 Q -31.8 -5.2 -31.8 -4.4 Z', 0.3, 0.12), shell, 0, 0, s * 2.85);
    b.add(rb1(7.0, 2.4, 0.8, 0.4), shell, -21.6, B + 0.8, s * 2.8);
  }
  b.add(rb1(5.6, 1.4, 0.3, 0.3), GM.dark, -21.6, B + 0.8, 3.25); // open port, right side
  // butt plate with sling slot
  b.add(slab('M -33.0 6.4 L -34.2 6.2 Q -34.5 5.8 -34.5 5.2 L -34.5 -6.2 Q -34.3 -7.2 -33.4 -7.2 L -33.0 -7.2 Z', 5.4, 0.4), GM.polymer);
  b.add(rb1(0.6, 2.4, 1.2, 0.3), GM.dark, -34.3, -2.0);
  // take-down / bolt-release buttons
  b.add(new THREE.CylinderGeometry(0.55 * CM, 0.55 * CM, 6.0 * CM, 14).rotateZ(Math.PI / 2), GM.polymer, -14.4, 2.2);
  b.add(new THREE.CylinderGeometry(0.45 * CM, 0.45 * CM, 6.0 * CM, 12).rotateZ(Math.PI / 2), GM.dark, -1.6, 3.4); // cross-bolt safety
  for (const [x, yy] of [[-27.6, 3.0], [-5.6, 3.8], [8.2, 3.0]]) screw(b, x, yy, 2.85, steel, 0.3);
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14).rotateY(Math.PI / 2), steel, -28.0, -7.6);

  // ---------------- pistol grip + full-hand trigger guard (moulded with the stock) ----------------
  b.add(slab('M -3.6 0.4 L 1.4 0.4 L 1.1 -1.8 Q 0.4 -4.4 0.8 -6.0 L 0.0 -9.8 Q -0.4 -10.6 -1.4 -10.6 L -3.8 -10.4 Q -4.7 -10.0 -4.5 -9.0 L -4.0 -4.0 Q -3.8 -1.6 -3.6 0.4 Z', 3.2, 0.8), shell);
  b.add(slab('M 0.4 0.4 L 9.8 0.4 Q 10.4 -2.4 9.2 -5.4 Q 7.0 -10.6 0.6 -11.0 L -1.4 -10.8 L -0.8 -9.0 L 0.8 -9.0 Q 5.8 -8.8 7.4 -5.0 Q 8.2 -2.8 7.8 -0.6 L 0.6 -0.6 Z', 2.8, 0.6), shell);
  b.add(slab('M 2.6 0.0 L 3.6 0.0 Q 3.6 -1.8 2.6 -3.0 L 2.2 -2.8 Q 2.8 -1.6 2.6 0.0 Z', 0.8, 0.12), steel);

  // ---------------- black receiver with the top rail and cocking handle ----------------
  b.add(slab('M -16.0 5.2 L 13.6 5.2 Q 14.6 5.4 14.6 6.4 L 14.6 7.8 Q 14.4 8.6 13.4 8.6 L -15.2 8.6 Q -16.0 8.4 -16.0 7.6 Z', 4.2, 0.4), alu, 0, 0, 0, 0, { sticker: true });
  topRail(b, -14.6, 13.6, 9.4, alu);
  b.add(rbox(18, 0.7, 0.3, 0.15), GM.dark, 2.0, 6.6, -2.12);                  // cocking slot, left
  b.add(rb1(1.4, 1.1, 1.8, 0.4), steel, -2.6, 6.6, -2.8);                      // cocking knob
  b.add(new THREE.CylinderGeometry(0.4 * CM, 0.4 * CM, 2.2 * CM, 10).rotateZ(Math.PI / 2), steel, 12.0, 7.0); // barrel lock pin

  // ---------------- barrel group: housing, gas cylinder, folding foregrip ----------------
  b.add(lathe([[0, 0], [2.1, 0], [2.3, 0.4], [2.3, 5.6], [2.0, 6.4], [1.3, 7.0], [1.3, 7.2]], 22), steel, 11.0, B);
  b.add(tube(0.7, 6.0, 0.7, 14), steel, 12.0, B + 2.2);                       // gas cylinder
  b.add(lathe([[1.2, 0], [1.2, 6.0], [1.05, 6.4], [1.05, 21.0]], 18), GM.blued, 18.0, B);
  for (let i = 0; i < 6; i++) b.add(box(5.0, 0.18, 2.16), GM.dark, 24.0 + 2.6, B, 0, 0, { roll: (i / 6) * Math.PI }); // fluting
  // muzzle brake / flash hider with ports
  const fx = 39.0;
  b.add(lathe([[0.9, 0], [1.35, 0], [1.4, 0.3], [1.4, 5.4], [1.2, 5.8], [0.55, 5.8]], 22), steel, fx, B);
  for (let i = 0; i < 3; i++) b.add(rb1(0.8, 0.9, 2.9, 0.2), GM.dark, fx + 1.6 + i * 1.4, B + 0.25);
  b.add(rb1(4.6, 0.3, 2.9, 0.1), GM.dark, fx + 3.0, B + 1.3);
  // foregrip clamp + folding vertical grip
  b.add(rbox(3.4, 1.6, 3.4, 0.5), steel, 15.8, B - 2.6);
  b.add(slab('M 14.2 1.6 L 17.4 1.6 L 17.2 -1.0 Q 16.6 -5.0 17.0 -8.4 Q 16.8 -9.4 15.8 -9.4 L 14.4 -9.2 Q 13.6 -9.0 13.8 -8.0 Q 14.4 -4.0 14.2 1.6 Z', 3.2, 0.8), shell);
  for (let i = 0; i < 4; i++) b.add(box(0.15, 0.4, 3.26), GM.dark, 14.0 + i * 0.05, -2.4 - i * 1.6);

  // ---------------- optic on the rail (sight line at y = 12.6) ----------------
  const sy = 12.6;
  b.add(rbox(6.0, 1.6, 3.0, 0.4), steel, -1.0, 10.0);                         // mount
  b.add(rbox(9.4, 3.6, 3.4, 0.9), steel, -1.0, sy);                           // body
  b.add(lathe([[1.4, 0], [1.6, 0], [1.6, 2.2], [1.25, 2.6], [0, 2.6]], 20), steel, -8.4, sy);   // eyepiece
  b.add(lathe([[0, 0], [1.6, 0], [2.0, 1.0], [2.0, 4.0], [1.8, 4.2]], 22), steel, 3.4, sy);     // objective + sunshade
  b.add(tube(1.7, 0.2, 1.7, 22), GM.glass, 7.3, sy);
  b.add(tube(1.25, 0.2, 1.25, 18), GM.glass, -8.45, sy);
  b.add(new THREE.CylinderGeometry(0.85 * CM, 0.9 * CM, 1.2 * CM, 14), steel, 0.0, sy + 2.2);   // elevation turret
  b.add(new THREE.CylinderGeometry(0.85 * CM, 0.9 * CM, 1.2 * CM, 14).rotateX(Math.PI / 2).rotateY(Math.PI / 2), steel, 0.0, sy, 2.1);
  b.add(rbox(3.2, 1.4, 2.2, 0.3), steel, -2.2, sy + 2.4);                     // mini red dot on top
  b.add(tube(0.55, 0.15, 0.55, 12), GM.glass, -0.7, sy + 2.6);

  // ---------------- magazine (tan waffle polymer, behind the grip) ----------------
  b.group('mag', -12.8, -1.0);
  const tan = GM.tan;
  b.add(slab('M -16.0 -0.6 L -9.6 -0.6 L -9.8 -6.0 Q -9.4 -11.0 -8.2 -15.4 L -14.2 -16.6 Q -15.6 -11.0 -16.0 -6.0 Z', 2.4, 0.3), tan, 0, 0, 0, 0, { group: 'mag' });
  const sq = box(1.25, 1.25, 0.35);
  for (let r = 0; r < 7; r++) {
    const t = r / 6;
    const cx = -12.8 + 1.6 * t * t, cy = -3.2 - 11.4 * t, w = 4.8 - 0.2 * t;
    for (let c = 0; c < 3; c++) {
      for (const s of [-1, 1]) b.add(sq, tan, cx + (c - 1) * w / 3, cy, s * 1.3, 0.12 * t, { group: 'mag' });
    }
  }
  b.add(rbox(6.8, 1.0, 2.8, 0.35), tan, -11.0, -16.2, 0, 0.2, { group: 'mag' });

  b.anchor('grip', -1.4, -3.4);
  b.anchor('support', 15.8, -3.4);
  b.anchor('muzzle', fx + 5.8, B);
  b.anchor('eject', -21.6, B + 0.8, 3.3);
  b.anchor('butt', -34.5, 0);
  b.anchor('sight', -8.4, sy);
};
