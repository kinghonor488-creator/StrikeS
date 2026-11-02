// f25: FAMAS F1 bullpup. See kit.js for the authoring conventions (side view, centimetres).
// Real-world: 75.7 cm overall, 48.8 cm barrel, long carry handle with the sights inside it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GM, CM, slab, tube, lathe, rbox, box, sphere, screw } from '../kit.js';

const B = 4.0; // bore height
const rb1 = (lx, ly, tz, r = 0.15) => new RoundedBoxGeometry(tz * CM, ly * CM, lx * CM, 1, Math.min(r, lx / 2 - 0.01, ly / 2 - 0.01, tz / 2 - 0.01) * CM);

export default (b, accent) => {
  const poly = GM.polymer;
  const steel = GM.park;

  // ---------------- main body: butt + receiver + handguard in one polymer shell ----------------
  // scalloped finger grooves along the bottom of the handguard
  let scallop = '';
  for (let i = 0; i < 5; i++) {
    const x = 23.4 - i * 3.4;
    scallop += ` L ${x} ${0.6 + i * 0.05} Q ${x - 1.0} ${-0.2 + i * 0.05} ${x - 2.0} ${0.6 + i * 0.05}`;
  }
  b.add(slab(`M -30.6 7.4 L -15.5 7.4 L -14.0 7.0 L 22.0 7.0 Q 25.2 6.8 26.4 5.4 L 26.6 2.4 Q 26.4 1.0 24.6 0.8 ${scallop} L 6.8 0.8 L 5.6 0.2 L -6.4 -0.2 L -8.2 -1.0 L -17.4 -1.4 Q -22 -2.4 -25 -3.6 L -29.6 -4.4 Q -30.6 -4.3 -30.7 -3.2 Z`, 4.6, 0.7), poly, 0, 0, 0, 0, { sticker: true });
  // raised receiver rib + cheek piece
  b.add(slab('M -14 6.4 L 22 6.4 L 22 7.3 L -14 7.3 Z', 5.0, 0.4), poly);
  b.add(slab('M -30.0 7.2 L -16.2 7.2 Q -15.2 7.6 -15.8 8.4 L -28.6 9.0 Q -30.0 9.0 -30.0 8.0 Z', 4.4, 0.6), poly, 0, 0, 0, 0, { sticker: true });
  // side panel lines and recesses on the butt
  for (const s of [-1, 1]) {
    b.add(slab('M -28.6 5.6 L -18.4 5.6 L -18.4 1.2 L -26.6 -1.6 L -28.6 -1.8 Z', 0.3, 0.12), poly, 0, 0, s * 2.35);
    b.add(rb1(4.2, 0.9, 0.3, 0.3), GM.dark, -6.4, 5.2, s * 2.3);
  }
  // rubber butt pad
  b.add(slab('M -30.6 7.6 L -31.8 7.6 Q -32.2 7.3 -32.2 6.8 L -32.2 -3.8 Q -32.0 -4.6 -31.4 -4.6 L -30.6 -4.4 Z', 4.8, 0.35), GM.rubber);
  for (let i = 0; i < 7; i++) b.add(box(0.12, 0.25, 4.85), GM.dark, -31.6, -3.2 + i * 1.5);
  // ejection port (right) with the shell deflector bump, mirrored cover on the left
  b.add(rb1(5.6, 1.8, 0.4, 0.3), GM.dark, -18.2, B + 0.6, 2.2);
  b.add(rb1(6.4, 2.6, 0.5, 0.4), poly, -18.2, B + 0.6, -2.35);
  b.add(rb1(2.0, 2.2, 0.8, 0.4), poly, -14.6, B + 0.7, 2.5);
  // pins
  for (const [x, yy] of [[-24.5, 1.0], [-9.2, 2.2], [-3.2, 4.8], [7.6, 3.4], [21.6, 3.0]]) screw(b, x, yy, 2.32, steel, 0.3);
  // sling swivels
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14).rotateY(Math.PI / 2), steel, -27.6, -4.6);
  b.add(new THREE.TorusGeometry(0.7 * CM, 0.16 * CM, 6, 14), steel, 24.6, 3.0, -2.6, 0, { yaw: Math.PI / 2 });

  // ---------------- carry handle with the sights inside ----------------
  b.add(slab('M -16.2 6.8 L 23.4 6.8 L 21.0 12.8 Q 20.0 14.2 18.0 14.2 L -13.0 14.2 Q -15.0 14.2 -15.6 12.6 Z M -10.8 7.4 L 17.8 7.4 Q 18.8 7.6 18.4 8.8 L 17.4 11.8 Q 17.0 12.6 16.0 12.6 L -9.4 12.6 Q -10.8 12.4 -10.8 11.0 Z', 2.4, 0.4), poly);
  b.add(rbox(31, 0.5, 2.0, 0.2), GM.dark, 3.2, 14.15); // top groove
  // rear sight drum (under the rear of the handle) + front sight post with ears
  b.add(new THREE.CylinderGeometry(0.9 * CM, 0.9 * CM, 2.0 * CM, 14).rotateZ(Math.PI / 2), steel, -9.6, 11.6);
  b.add(new THREE.TorusGeometry(0.35 * CM, 0.12 * CM, 6, 12), steel, -8.7, 11.6);
  b.add(box(0.4, 1.4, 0.4), steel, 16.8, 11.4);
  for (const s of [-1, 1]) b.add(rb1(1.2, 1.6, 0.3, 0.1), steel, 17.0, 11.6, s * 0.75);
  // cocking lever running along the top of the receiver, inside the handle window
  b.add(rbox(20, 0.7, 1.0, 0.25), steel, 2, 7.6);
  b.add(slab('M 9.6 7.2 L 11.6 7.2 L 11.8 8.6 Q 12.2 10.2 11.0 10.4 L 10.4 10.2 Q 11.0 9.4 10.4 8.6 Z', 1.0, 0.2), steel);
  b.add(rbox(1.6, 1.2, 1.6, 0.4), steel, -8.6, 8.0);

  // ---------------- grip, full-hand guard, trigger ----------------
  b.add(slab('M -2.8 0.4 L 2.8 0.4 L 2.6 -1.4 Q 1.6 -3.0 1.8 -4.0 Q 2.2 -4.8 1.4 -5.6 L 0.0 -10.0 Q -0.4 -10.8 -1.4 -10.8 L -3.4 -10.6 Q -4.2 -10.3 -4.0 -9.4 L -3.2 -4.0 Q -3.0 -1.6 -2.8 0.4 Z', 3.0, 0.8), poly);
  b.add(slab('M 5.0 0.6 L 7.0 0.6 Q 7.2 -6.6 1.6 -10.5 L 0.2 -10.8 L 0.4 -9.6 Q 5.4 -6.4 5.0 0.6 Z', 1.6, 0.35), poly);
  b.add(slab('M 3.0 0.2 L 4.0 0.2 Q 4.0 -1.6 3.0 -2.8 L 2.6 -2.6 Q 3.2 -1.4 3.0 0.2 Z', 0.6, 0.1), steel);
  b.add(rb1(1.6, 0.5, 0.9, 0.2), steel, 4.2, -0.4, 0, 0, { yaw: 0 }); // selector under the guard

  // ---------------- magazine (25-rd, behind the grip) ----------------
  b.add(rbox(7.2, 1.8, 3.4, 0.5), poly, -12.6, -1.4); // mag well collar
  b.add(rb1(1.2, 0.8, 0.6, 0.2), steel, -8.4, -1.6, 0); // mag catch
  b.group('mag', -12.6, -1.0);
  const magM = GM.paint('#5d5f5c', 0.5);
  b.add(slab('M -15.6 -0.6 L -9.6 -0.6 L -9.7 -6 Q -9.6 -10 -9.2 -12.6 Q -9.2 -13.3 -9.9 -13.4 L -15.0 -13.6 Q -15.8 -13.5 -15.7 -12.7 Q -15.9 -9 -15.6 -6 Z', 2.3, 0.25), magM, 0, 0, 0, 0, { group: 'mag' });
  b.add(slab('M -14.7 -3.0 L -10.6 -3.0 Q -10.5 -8 -10.1 -11.8 L -14.6 -12.0 Q -14.9 -8 -14.7 -3.0 Z', 2.5, 0.2), magM, 0, 0, 0, 0, { group: 'mag' });
  b.add(rbox(6.6, 0.7, 2.6, 0.3), poly, -12.4, -13.6, 0, 0.04, { group: 'mag' });

  // ---------------- barrel, grenade sleeve, flash hider ----------------
  b.add(lathe([[1.3, 0], [1.3, 0.6], [1.0, 0.8], [0.8, 1.0], [0.8, 13.4]], 18), GM.blued, 26.2, B);
  // rifle-grenade launcher sleeve with flash hider rings
  const fx = 39.0;
  b.add(lathe([[0.8, 0], [1.1, 0], [1.1, 0.4], [1.1, 5.4], [0.95, 5.7], [0.5, 5.7]], 20), steel, fx, B);
  for (let i = 0; i < 5; i++) b.add(lathe([[1.12, 0], [1.18, 0.1], [1.18, 0.35], [1.12, 0.45]], 20), GM.dark, fx + 0.9 + i * 0.85, B);
  for (const a of [0.5, -0.5, 1.57]) b.add(box(1.4, 0.3, 2.3), GM.dark, fx + 4.6, B, 0, 0, { roll: a });
  // bipod legs folded along the handguard sides
  for (const s of [-1, 1]) {
    b.add(tube(0.35, 15, 0.35, 10), steel, 8.6, 1.6, s * 2.6);
    b.add(rb1(1.2, 1.2, 0.8, 0.3), steel, 24.4, 1.6, s * 2.5);
    b.add(rb1(1.6, 0.8, 0.9, 0.3), GM.rubber, 8.4, 1.6, s * 2.6);
  }

  // team colour: thin band on the butt pad edge
  if (accent) b.add(box(0.25, 10.6, 4.82), GM.paint(accent, 0.7), -30.7, 1.6);

  b.anchor('grip', -0.6, -3.4);
  b.anchor('support', 15, 0.4);
  b.anchor('muzzle', fx + 5.7, B);
  b.anchor('eject', -18.2, B + 0.6, 2.5);
  b.anchor('butt', -32.2, 0);
  b.anchor('sight', -9.6, 11.6);
};
