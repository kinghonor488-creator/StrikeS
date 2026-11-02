// m4: M4 carbine (CT rifle). See kit.js for the authoring conventions (side view, centimetres).
// Layout: upper/lower parting line at y = 0, bore (and buffer tube) axis at y = B.
// Real-world: ~84 cm overall (stock part-extended), 14.5" barrel, grip-to-muzzle ~52 cm.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {
  GM, CM, slab, tube, lathe, rbox, box, sphere, screw, trigger,
} from '../kit.js';

/** Cheap rounded box (1 segment per edge, ~100 tris) for small repeated parts. */
const rb1 = (lx, ly, tz, r = 0.15) => new RoundedBoxGeometry(tz * CM, ly * CM, lx * CM, 1, Math.min(r, lx / 2 - 0.01, ly / 2 - 0.01, tz / 2 - 0.01) * CM);

const B = 2.4;

/** Picatinny rail around the bore: roll 0 = top, PI/2 = left, -PI/2 = right, PI = bottom. off = rail top above the bore. */
function pic(b, x0, x1, roll, off, mat, cy = B) {
  const len = x1 - x0;
  const at = (h) => [-(h * Math.sin(roll)), cy + h * Math.cos(roll)];
  const [zb, yb] = at(off - 0.6);
  b.add(rbox(len, 0.8, 2.1, 0.12), mat, x0 + len / 2, yb, zb, 0, { roll });
  const n = Math.floor(len / 1.0);
  const tooth = box(0.52, 0.42, 2.1);
  const [zt, yt] = at(off - 0.21);
  for (let i = 0; i < n; i++) b.add(tooth, mat, x0 + 0.5 + i * (len / n), yt, zt, 0, { roll });
}

export default (b, accent) => {
  const alu = GM.alu;           // hard-anodised receivers
  const poly = GM.polymer;
  const steel = GM.park;        // phosphated steel parts

  // ---------------- upper receiver (flat-top) ----------------
  b.add(slab('M 0 0 L 18.3 0 L 18.3 3.6 Q 18.3 4.3 17.6 4.3 L 0.5 4.3 Q 0 4.3 0 3.8 Z', 2.6, 0.3), alu, 0, 0, 0, 0, { sticker: true });
  // ejection port (dark recess) + closed dust cover, right side
  b.add(box(6.2, 1.9, 0.2), GM.dark, 11.6, 2.1, 1.24);
  b.add(slab('M 8.6 1.2 L 14.6 1.2 L 14.6 3.0 L 8.6 3.0 Z', 0.16, 0.04), steel, 0, 0, 1.34);
  b.add(rbox(0.5, 0.4, 0.3, 0.1), steel, 14.0, 1.4, 1.42);
  // brass deflector bump behind the port
  b.add(slab('M 6.6 1.2 L 8.4 1.4 L 8.4 4.1 L 7.0 4.1 Q 6.4 3.0 6.6 1.2 Z', 0.9, 0.2), alu, 0, 0, 1.45);
  // forward assist housing + button (right side, behind the port)
  b.add(slab('M 1.4 1.4 Q 1.4 3.8 3.0 3.8 L 6.6 3.6 L 6.6 2.0 Q 4.0 1.0 1.4 1.4 Z', 0.9, 0.3), alu, 0, 0, 1.45);
  b.add(lathe([[0, 0], [0.72, 0], [0.8, 0.2], [0.8, 1.5], [0.62, 1.7], [0, 1.7]], 16), alu, 0.6, 2.6, 1.9, 0, { yaw: 0.25 });
  b.add(tube(0.82, 0.25, 0.82, 16), GM.dark, 0.35, 2.6, 1.85, 0, { yaw: 0.25 });
  // top rail, full length of the upper
  pic(b, 0.3, 18.2, 0, 2.85, alu);
  // charging handle (T handle with latch on the left)
  b.add(rbox(2.6, 0.9, 1.8, 0.2), alu, -0.6, 4.0);
  b.add(rbox(1.0, 0.8, 4.4, 0.3), alu, -1.6, 4.0);
  b.add(rbox(1.4, 0.5, 0.8, 0.15), alu, -1.2, 4.05, -2.3);

  // ---------------- lower receiver ----------------
  b.add(slab('M -1.0 3.4 L 0.1 3.4 L 0.1 0 L 19.7 0 L 19.7 -0.6 Q 19.4 -1.6 18.6 -1.6 L 18.6 -6.2 L 11.6 -6.2 L 11.6 -2.6 L 3.4 -2.6 L 2.0 -1.6 Q 0.0 -1.2 -1.0 0.6 Z', 2.4, 0.3), alu, 0, 0, 0, 0, { sticker: true });
  // flared magwell
  b.add(slab('M 11.3 -1.2 L 18.9 -1.2 L 18.9 -6.4 Q 19.1 -7.0 19.4 -7.2 L 11.0 -7.2 Q 11.3 -6.9 11.3 -6.4 Z', 2.9, 0.35), alu);
  // receiver extension boss
  b.add(lathe([[1.75, 0], [2.0, 0.2], [2.0, 1.0], [1.75, 1.2]], 20), alu, -1.2, B);
  // mag release fence + button (right), bolt catch (left), selector (left)
  b.add(slab('M 10.0 -0.6 Q 11.6 -0.5 11.6 -2.0 L 11.6 -2.6 L 10.6 -2.6 Q 10.0 -1.8 10.0 -0.6 Z', 2.8, 0.2), alu);
  b.add(new THREE.CylinderGeometry(0.42 * CM, 0.42 * CM, 0.4 * CM, 12).rotateZ(Math.PI / 2), steel, 10.7, -1.4, 1.55);
  b.add(slab('M 10.4 -0.4 L 12.8 -0.4 L 12.8 -1.0 L 11.6 -2.0 L 10.4 -1.6 Z', 0.3, 0.06), steel, 0, 0, -1.35);
  b.add(rbox(1.1, 0.5, 0.4, 0.12), steel, 13.0, -0.7, -1.38);
  b.add(new THREE.CylinderGeometry(0.55 * CM, 0.55 * CM, 0.3 * CM, 14).rotateZ(Math.PI / 2), steel, 2.6, -0.9, -1.35);
  b.add(rbox(2.2, 0.5, 0.3, 0.2), steel, 3.4, -0.9, -1.45, -0.25);
  // pins: front pivot, rear takedown, trigger + hammer
  screw(b, 19.0, -0.7, 1.22, steel, 0.32);
  screw(b, 0.4, -0.4, 1.22, steel, 0.32);
  screw(b, 6.6, -1.4, 1.22, steel, 0.22);
  screw(b, 4.6, -0.6, 1.22, steel, 0.22);
  // trigger guard + trigger
  trigger(b, 4.6, -2.5, 6.6, alu, steel);
  // A2 pistol grip with finger swell (about 23 deg rake)
  b.add(slab('M 0.6 -0.9 L 5.2 -0.9 L 5.0 -2.4 Q 4.0 -4.4 3.6 -5.6 Q 3.9 -6.6 3.2 -7.4 L 1.3 -11.8 Q 0.9 -12.6 0.0 -12.6 L -2.0 -12.4 Q -2.8 -12.1 -2.6 -11.2 L -0.6 -5.0 Q -0.2 -2.4 0.6 -0.9 Z', 3.1, 0.8), poly);
  // ---------------- magazine (30-rd STANAG, curved) ----------------
  b.group('mag', 15, 0);
  const magM = GM.paint('#3e403e', 0.5);
  const magOutline = 'M 11.9 -0.4 L 18.3 -0.4 L 18.3 -6.5 Q 18.6 -12.4 20.4 -17.8 L 14.3 -19.2 Q 12.8 -13 11.9 -6.5 Z';
  b.add(slab(magOutline, 2.3, 0.25), magM, 0, 0, 0, 0, { group: 'mag' });
  // pressed side ribs
  b.add(slab('M 12.9 -7.5 L 17.3 -7.5 Q 17.6 -12.4 19.0 -16.8 L 15.0 -17.7 Q 13.7 -13 12.9 -7.5 Z', 2.5, 0.2), magM, 0, 0, 0, 0, { group: 'mag' });
  b.add(slab('M 13.7 -8.5 L 16.5 -8.5 Q 16.7 -12.4 18.0 -16.2 L 15.6 -16.8 Q 14.4 -13 13.7 -8.5 Z', 2.62, 0.2), magM, 0, 0, 0, 0, { group: 'mag' });
  // floor plate
  b.add(rbox(6.9, 0.8, 2.7, 0.3), poly, 17.35, -18.9, 0, 0.225, { group: 'mag' });

  // ---------------- buffer tube + collapsible stock ----------------
  b.add(tube(1.5, 17.4, 1.5, 24), alu, -18.6, B);
  b.add(lathe([[1.55, 0], [2.05, 0], [2.05, 0.9], [1.55, 0.9]], 16), steel, -2.2, B);   // castle nut
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    b.add(box(0.5, 0.4, 0.5), GM.dark, -1.75, B + Math.cos(a) * 1.95, Math.sin(a) * 1.95, 0, { roll: -a });
  }
  b.add(slab('M -2.5 -0.2 L -1.3 -0.2 L -1.3 4.8 L -2.5 4.8 Z', 3.2, 0.2), steel); // end plate / sling mount
  b.add(rbox(1.2, 0.6, 1.6, 0.2), alu, -6, B - 1.55); // index rail under the tube
  for (let i = 0; i < 6; i++) b.add(box(0.3, 0.3, 1.0), GM.dark, -15.2 + i * 1.6, B - 1.6);
  // stock body (with the open triangle between the tube and the lower leg)
  b.add(slab('M -16.4 4.4 L -27.8 5.0 Q -28.6 5.0 -28.6 4.2 L -28.6 -8.6 Q -28.4 -9.3 -27.6 -9.3 L -26.2 -9.3 Q -25.4 -9.0 -24.8 -8.0 L -19.6 -1.6 Q -17.2 0.1 -16.4 0.4 Z M -20.0 -0.1 L -25.9 -0.2 L -25.9 -6.4 Z', 4.0, 0.5), poly, 4, 0, 0, 0, { sticker: true });
  // storage tubes on the cheek (SOPMOD-style)
  for (const s of [-1, 1]) {
    b.add(lathe([[0, 0], [1.05, 0], [1.25, 0.4], [1.25, 9.2], [1.05, 9.8], [0, 9.8]], 16), poly, -24.4, 3.3, s * 2.0);
    b.add(tube(1.1, 0.25, 1.1, 16), poly, -24.65, 3.3, s * 2.0);
  }
  // adjustment lever + release
  b.add(slab('M -18.6 0.6 L -21.8 0.6 Q -22.6 0.2 -22.2 -0.4 L -18.8 -0.2 Z', 1.4, 0.2), poly, 4);
  // sling slot loop at the rear-bottom
  b.add(new THREE.TorusGeometry(0.6 * CM, 0.15 * CM, 6, 12).rotateY(Math.PI / 2), steel, -22.6, -8.0);
  // rubber butt pad
  b.add(slab('M -28.6 5.1 L -29.8 5.1 Q -30.2 4.9 -30.2 4.4 L -30.2 -8.8 Q -30.1 -9.5 -29.6 -9.5 L -28.6 -9.4 Z', 4.4, 0.35), GM.rubber, 4);
  for (let i = 0; i < 8; i++) b.add(box(0.12, 0.25, 4.45), GM.dark, -25.6, -7.8 + i * 1.6);

  // ---------------- barrel nut / delta ring + quad-rail handguard ----------------
  b.add(lathe([[1.5, 0], [2.3, 0], [2.7, 0.4], [2.7, 1.5], [2.3, 1.9], [1.5, 1.9]], 24), steel, 18.3, B);
  const hx0 = 20.2, hx1 = 37.8, hl = hx1 - hx0;
  b.add(rbox(hl, 4.4, 4.4, 0.8), alu, hx0 + hl / 2, B);
  // vent holes along the rail channels (dark recesses on the corners)
  for (let i = 0; i < 7; i++) {
    for (const s of [-1, 1]) {
      b.add(box(1.1, 0.55, 0.6), GM.dark, hx0 + 1.6 + i * 2.35, B + 1.75, s * 1.75, 0, { roll: s * Math.PI / 4 });
      b.add(box(1.1, 0.55, 0.6), GM.dark, hx0 + 1.6 + i * 2.35, B - 1.75, s * 1.75, 0, { roll: -s * Math.PI / 4 });
    }
  }
  pic(b, hx0 + 0.2, hx1 - 0.2, 0, 2.85, alu);
  pic(b, hx0 + 0.2, hx1 - 0.2, Math.PI, 2.85, alu);
  pic(b, hx0 + 0.2, hx1 - 0.2, Math.PI / 2, 2.85, alu);
  pic(b, hx0 + 0.2, hx1 - 0.2, -Math.PI / 2, 2.85, alu);
  // ribbed rail covers on both sides (rear two thirds)
  for (const s of [-1, 1]) {
    b.add(rbox(12.4, 3.0, 0.7, 0.3), poly, hx0 + 6.6, B, s * 2.95);
    for (let i = 0; i < 11; i++) b.add(rb1(0.45, 2.7, 0.3, 0.12), poly, hx0 + 1.2 + i * 1.08, B, s * 3.35);
  }
  // end cap at the front sight
  b.add(rbox(0.8, 5.6, 5.6, 0.5), alu, hx1 + 0.1, B);

  // ---------------- barrel, front sight base, flash hider ----------------
  b.add(lathe([[1.0, 0], [1.0, 24.6], [0.78, 24.9], [0.78, 33.6]], 18), GM.blued, 18.3, B);
  // A2 front sight base / gas block
  b.add(rbox(3.4, 3.2, 2.5, 0.5), steel, 39.8, B);
  b.add(slab('M 38.2 3.6 L 41.5 3.6 L 41.2 4.6 L 40.9 7.6 L 39.4 7.6 Q 38.8 5.2 38.2 3.6 Z', 1.7, 0.2), steel);
  for (const s of [-1, 1]) b.add(slab('M 39.0 7.0 L 40.9 7.0 L 40.9 9.6 Q 40.4 9.9 39.9 9.6 Q 39.4 8.2 39.0 7.0 Z', 0.35, 0.08), steel, 0, 0, s * 0.85);
  b.add(rbox(1.6, 0.6, 2.0, 0.2), steel, 40.0, 7.3);
  b.add(box(0.35, 2.0, 0.35), steel, 40.1, 8.3);           // post
  b.add(rbox(1.8, 1.2, 1.0, 0.25), steel, 40.4, B - 2.0);  // bayonet lug
  b.add(new THREE.TorusGeometry(0.75 * CM, 0.16 * CM, 6, 14).rotateY(Math.PI / 2), steel, 39.2, B - 2.9); // sling swivel
  screw(b, 39.2, B + 0.5, 1.28, steel, 0.25); // taper pins
  screw(b, 40.6, B + 0.5, 1.28, steel, 0.25);
  // A2 birdcage flash hider (closed bottom)
  const fx = 51.3;
  b.add(lathe([[0.7, 0], [1.05, 0], [1.05, 0.7], [0.98, 0.8], [0.98, 4.8], [0.85, 5.1], [0.55, 5.1]], 20), steel, fx, B);
  for (const a of [0.0, 0.9, -0.9, 1.6]) {
    b.add(box(2.8, 0.3, 2.1), GM.dark, fx + 3.0, B + Math.sin(a) * 0.0, 0, 0, { roll: a });
  }
  b.add(rbox(3.6, 0.8, 2.1, 0.3), steel, fx + 2.9, B - 0.55); // fills the bottom slots (A2 closed bottom)
  b.add(tube(0.42, 0.2, 0.42, 14), GM.dark, fx + 5.0, B);

  // ---------------- flip-up rear sight on the top rail ----------------
  b.add(rbox(3.6, 1.0, 2.4, 0.25), steel, 2.6, 5.6);
  b.add(slab('M 0.9 5.9 L 4.3 5.9 L 4.3 6.9 L 3.5 7.5 L 3.5 9.9 Q 3.5 10.2 3.2 10.2 L 2.0 10.2 Q 1.7 10.2 1.7 9.9 L 1.7 7.5 L 0.9 6.9 Z', 2.0, 0.25), steel);
  b.add(new THREE.TorusGeometry(0.42 * CM, 0.14 * CM, 8, 16), steel, 1.6, 9.0);
  b.add(new THREE.CylinderGeometry(0.75 * CM, 0.75 * CM, 0.5 * CM, 16).rotateZ(Math.PI / 2), steel, 2.0, 7.0, 1.0);
  b.add(new THREE.CylinderGeometry(0.5 * CM, 0.5 * CM, 0.4 * CM, 12).rotateZ(Math.PI / 2), steel, 3.4, 6.2, -1.2);

  // team colour: tiny dot on the selector "SAFE" marking
  b.add(sphere(0.18), GM.paint(accent || '#d9d9d9', 0.6), 1.6, -1.5, -1.25);

  b.anchor('grip', 3.0, -3.6);
  b.anchor('support', 29, -0.6);
  b.anchor('muzzle', fx + 5.1, B);
  b.anchor('eject', 11.6, 2.1, 1.4);
  b.anchor('butt', -26.2, 0);
  b.anchor('sight', 2.6, 9.0);
};
