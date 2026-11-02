// Third-person humanoid: realistic proportions, team outfits with a comic streak
// (graffiti-splattered hoodies vs. eraser-pink tactical gear), procedural locomotion,
// two-bone IK arms that hold any gun by its own grip/foregrip, and a knockdown fall.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// --- materials --------------------------------------------------------------------
const texCache = new Map();
function fabricTex(base, { splatter = 0, stripes = null, seed = 1 } = {}) {
  const key = `${base}|${splatter}|${stripes}|${seed}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 128);
  const img = g.getImageData(0, 0, 128, 128);
  let s = seed * 9301;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 18 + (((i / 4) % 128) % 2 ? 4 : -4);
    img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  if (stripes) { g.fillStyle = stripes; g.fillRect(0, 54, 128, 10); }
  for (let k = 0; k < splatter; k++) {
    g.fillStyle = ['#f2b134', '#2ec4ff', '#ffffff', '#1b1626', '#5fd068'][k % 5];
    const x = rnd() * 128, y = rnd() * 128, r = 2 + rnd() * 7;
    g.globalAlpha = 0.85;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    for (let d = 0; d < 5; d++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * r * 4, y + (rnd() - 0.5) * r * 4, rnd() * 1.6 + 0.4, 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.set(key, t);
  return t;
}
const matCache = new Map();
function mat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
const cloth = (color, opts = {}) => mat(`cloth${color}${JSON.stringify(opts)}`, () =>
  new THREE.MeshStandardMaterial({ map: fabricTex(color, opts), roughness: 0.9, metalness: 0 }));
const solid = (color, rough = 0.6, metal = 0) => mat(`s${color}${rough}${metal}`, () =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));

export const LOOKS = {
  T: {
    top: () => cloth('#b5392f', { splatter: 9, seed: 3 }), sleeve: () => cloth('#b5392f', { splatter: 4, seed: 5 }),
    pants: () => cloth('#33405e', { splatter: 3, seed: 7 }), shoes: () => solid('#e9e6df', 0.7),
    soles: () => solid('#c23b2f', 0.8), gloves: () => solid('#4a4038', 0.72), hat: () => cloth('#e2a61f', { seed: 11 }),
    mask: () => cloth('#1d1b2a', { splatter: 2, seed: 13 }), lens: () => new THREE.MeshStandardMaterial({ color: '#ff8a2a', roughness: 0.08, metalness: 0.4, envMapIntensity: 2 }),
    accent: () => solid('#f2b134', 0.6),
  },
  CT: {
    top: () => cloth('#2d3c58', { seed: 21 }), sleeve: () => cloth('#2d3c58', { seed: 23 }),
    pants: () => cloth('#283349', { seed: 25 }), shoes: () => solid('#1a1a1d', 0.75),
    soles: () => solid('#111', 0.9), gloves: () => solid('#e9e6e0', 0.75), hat: () => solid('#d78b98', 0.55),
    mask: () => cloth('#22242c', { seed: 27 }), lens: () => new THREE.MeshStandardMaterial({ color: '#2a5f8a', roughness: 0.05, metalness: 0.5, envMapIntensity: 2 }),
    accent: () => solid('#d78b98', 0.55), vest: () => cloth('#cf8f99', { seed: 29 }), band: () => solid('#3d63c9', 0.5),
  },
};

const UPPER = 0.29, FORE = 0.27;
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), tmp3 = new THREE.Vector3(-0.02, -0.12, -0.18);
const Z = new THREE.Vector3(0, 0, 1);

function limb(r, len, m) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 10).rotateX(Math.PI / 2).translate(0, 0, len / 2);
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

/** Elbow position for a two-bone chain, bent toward `pole`. Mutates and returns target if unreachable. */
function solveElbow(shoulder, hand, a, b, pole, out) {
  const d = tmp.subVectors(hand, shoulder);
  let len = d.length();
  const max = a + b - 0.002;
  if (len > max) { d.multiplyScalar(max / len); hand.copy(shoulder).add(d); len = max; }
  len = Math.max(len, Math.abs(a - b) + 0.002);
  const x = (a * a - b * b + len * len) / (2 * len);
  const h = Math.sqrt(Math.max(0, a * a - x * x));
  d.normalize();
  const p = tmp2.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
  return out.copy(shoulder).addScaledVector(d, x).addScaledVector(p, h);
}

export class HumanRig {
  constructor(ch) {
    this.ch = ch;
    const L = LOOKS[ch.team];
    const add = (parent, geo, m, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const root = new THREE.Group();
    root.name = 'char:' + ch.name;
    this.root = root;

    // ---- legs
    const hips = new THREE.Group(); hips.position.y = 0.94; root.add(hips);
    this.hips = hips;
    add(hips, new RoundedBoxGeometry(0.33, 0.19, 0.21, 2, 0.07), L.pants(), 0, 0.02, 0);
    this.legs = [];
    for (const s of [-1, 1]) {
      const thigh = new THREE.Group(); thigh.position.set(s * 0.1, -0.03, 0); hips.add(thigh);
      const tm = limb(0.078, 0.45, L.pants());
      tm.rotation.set(Math.PI / 2, 0, 0); // capsule points down (-y)
      thigh.add(tm);
      const shin = new THREE.Group(); shin.position.y = -0.44; thigh.add(shin);
      const sm = limb(0.064, 0.43, L.pants()); sm.rotation.set(Math.PI / 2, 0, 0); shin.add(sm);
      if (ch.team === 'CT') add(shin, new RoundedBoxGeometry(0.12, 0.12, 0.06, 2, 0.03), solid('#1c1f27', 0.7), 0, -0.02, -0.06);
      const foot = new THREE.Group(); foot.position.y = -0.42; shin.add(foot);
      add(foot, new RoundedBoxGeometry(0.115, 0.1, 0.28, 2, 0.04), L.shoes(), 0, -0.03, -0.06);
      add(foot, new RoundedBoxGeometry(0.12, 0.03, 0.29, 1, 0.01), L.soles(), 0, -0.08, -0.06);
      this.legs.push({ thigh, shin, foot, side: s });
    }

    // ---- torso
    const spine = new THREE.Group(); spine.position.y = 0.06; hips.add(spine);
    this.spine = spine;
    add(spine, new RoundedBoxGeometry(0.3, 0.26, 0.2, 2, 0.08), L.top(), 0, 0.12, 0);
    const chest = new THREE.Group(); chest.position.y = 0.24; spine.add(chest);
    this.chest = chest;
    add(chest, new RoundedBoxGeometry(0.42, 0.32, 0.24, 3, 0.1), L.top(), 0, 0.14, 0);
    if (ch.team === 'T') {
      // hood bunched behind the neck + kangaroo pocket + spray cans in a backpack
      add(chest, new RoundedBoxGeometry(0.3, 0.12, 0.14, 2, 0.05), L.top(), 0, 0.31, 0.1);
      add(spine, new RoundedBoxGeometry(0.24, 0.1, 0.03, 2, 0.02), cloth('#9c2f27', { seed: 31 }), 0, 0.1, -0.11);
      const pack = add(chest, new RoundedBoxGeometry(0.3, 0.34, 0.12, 2, 0.05), solid('#2a2a2e', 0.85), 0, 0.12, 0.18);
      for (let i = 0; i < 2; i++) {
        const can = add(pack, new THREE.CylinderGeometry(0.035, 0.035, 0.18, 12), solid(['#f2b134', '#2ec4ff'][i], 0.35, 0.6), (i - 0.5) * 0.12, 0.18, 0.02);
        add(can, new THREE.CylinderGeometry(0.02, 0.03, 0.03, 10), solid('#ffffff', 0.4), 0, 0.1, 0);
      }
    } else {
      // plate carrier with pouches, eraser-pink panels
      add(chest, new RoundedBoxGeometry(0.44, 0.3, 0.29, 2, 0.06), L.vest(), 0, 0.12, 0);
      for (let i = 0; i < 3; i++) add(chest, new RoundedBoxGeometry(0.1, 0.12, 0.06, 2, 0.02), solid('#2a2f3a', 0.8), (i - 1) * 0.12, 0.02, -0.16);
      add(chest, new THREE.BoxGeometry(0.45, 0.04, 0.3), L.band(), 0, 0.22, 0);
      add(spine, new THREE.BoxGeometry(0.33, 0.05, 0.22), solid('#15171c', 0.8), 0, 0.0, 0);
    }
    this.shoulders = [new THREE.Object3D(), new THREE.Object3D()];
    this.shoulders[0].position.set(0.21, 0.25, 0.0);
    this.shoulders[1].position.set(-0.21, 0.25, 0.0);
    for (const sh of this.shoulders) {
      chest.add(sh);
      add(sh, new THREE.SphereGeometry(0.075, 12, 10), L.sleeve());
    }

    // ---- head
    const head = new THREE.Group(); head.position.y = 0.34; chest.add(head);
    this.head = head;
    add(head, new THREE.CylinderGeometry(0.055, 0.06, 0.1, 12), L.mask(), 0, 0.02, 0);
    const skull = add(head, new THREE.SphereGeometry(0.115, 22, 16), L.mask(), 0, 0.13, 0);
    skull.scale.set(0.95, 1.1, 1.05);
    if (ch.team === 'T') {
      add(head, new THREE.SphereGeometry(0.125, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), L.hat(), 0, 0.16, 0.005).scale.set(0.98, 1.05, 1.06);
      add(head, new THREE.CylinderGeometry(0.124, 0.126, 0.05, 18), cloth('#c88e14', { seed: 33 }), 0, 0.165, 0.005);
      add(head, new THREE.SphereGeometry(0.035, 10, 8), solid('#fff3d6', 0.9), 0, 0.3, 0);
      // ski goggles
      add(head, new RoundedBoxGeometry(0.2, 0.065, 0.06, 2, 0.025), solid('#1a1a1a', 0.5), 0, 0.12, -0.095);
      add(head, new RoundedBoxGeometry(0.18, 0.05, 0.02, 2, 0.02), L.lens(), 0, 0.12, -0.125);
      // ink-splattered bandana over the mouth
      add(head, new THREE.CylinderGeometry(0.118, 0.13, 0.09, 16, 1, true), cloth('#2a6fb0', { splatter: 5, seed: 35 }), 0, 0.055, 0).material.side = THREE.DoubleSide;
      const marker = add(head, new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8), solid('#f4f1ea', 0.5), 0.12, 0.14, 0.03);
      marker.rotation.x = 1.1;
    } else {
      // eraser helmet: rounded pink block with a blue paper sleeve, and a clear visor
      add(head, new RoundedBoxGeometry(0.27, 0.14, 0.29, 3, 0.06), L.hat(), 0, 0.22, 0.005);
      add(head, new THREE.BoxGeometry(0.275, 0.05, 0.295), L.band(), 0, 0.185, 0.005);
      add(head, new RoundedBoxGeometry(0.21, 0.07, 0.05, 2, 0.02), solid('#15171c', 0.5), 0, 0.12, -0.1);
      add(head, new RoundedBoxGeometry(0.2, 0.055, 0.02, 2, 0.02), L.lens(), 0, 0.12, -0.127);
      add(head, new RoundedBoxGeometry(0.03, 0.05, 0.05, 1, 0.01), solid('#2b2f39', 0.6), 0.13, 0.1, 0);
    }

    // ---- gun + arms
    const aim = new THREE.Group(); root.add(aim);
    this.aim = aim;
    const gunHolder = new THREE.Group(); aim.add(gunHolder);
    this.gunHolder = gunHolder;
    this.arms = [0, 1].map((i) => {
      const up = limb(0.062, UPPER, L.sleeve());
      const fore = limb(0.052, FORE, L.sleeve());
      const hand = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.1, 2, 0.02), L.gloves());
      hand.castShadow = true;
      root.add(up, fore, hand);
      return { up, fore, hand, side: i === 0 ? 1 : -1, elbow: new THREE.Vector3(), shoulder: new THREE.Vector3(), target: new THREE.Vector3() };
    });

    this.bomb = add(chest, new RoundedBoxGeometry(0.26, 0.3, 0.14, 2, 0.04), solid('#c9302c', 0.5), 0, 0.1, 0.24);
    this.bomb.visible = false;
    root.traverse((o) => { o.userData.charId = ch.id; });

    this.animPhase = 0;
    this.fallDir = 1;
    this.gun = null;
  }

  setGun(model) {
    if (this.dropped && this.dropped.obj !== model) { this.dropped.obj.removeFromParent(); this.dropped = null; }
    while (this.gunHolder.children.length) this.gunHolder.remove(this.gunHolder.children[0]);
    this.gun = model;
    if (!model) return;
    this.gunHolder.add(model);
    const long = !!model.userData.support && this.ch.def?.cat !== 'pistol';
    this.long = long;
    // long guns: stock in the shoulder pocket; pistols: arms out front
    if (long) this.gunHolder.position.set(0.17, -0.05, -model.userData.butt + 0.05);
    else if (this.ch.def?.cat === 'knife' || this.ch.def?.cat === 'ink') this.gunHolder.position.set(0.2, -0.22, -0.3);
    else this.gunHolder.position.set(0.05, -0.08, -0.44);
    this.restPos = this.gunHolder.position.clone();
  }

  update(dt, t) {
    const ch = this.ch;
    const { root, hips, spine, chest, head, aim } = this;
    root.position.copy(ch.pos);
    if (ch.stepSmooth) root.position.y += ch.stepSmooth;
    this.bomb.visible = ch.hasBomb;
    root.rotation.set(0, ch.yaw, 0);

    if (!ch.alive) { this.updateDead(t); return; }
    root.visible = true;
    hips.rotation.set(0, 0, 0);

    // locomotion: swing legs in the direction of travel relative to the body
    const sy = Math.sin(ch.yaw), cy = Math.cos(ch.yaw);
    const fwdV = -sy * ch.vel.x - cy * ch.vel.z;
    const rightV = cy * ch.vel.x - sy * ch.vel.z;
    const sp = Math.hypot(fwdV, rightV);
    this.animPhase += dt * sp * (ch.crouching ? 2.6 : 1.75);
    const amp = Math.min(1, sp / 4.5) * (ch.crouching ? 0.45 : 0.75);
    const c = ch.crouch;
    const dirF = sp > 0.1 ? fwdV / sp : 1, dirR = sp > 0.1 ? rightV / sp : 0;
    for (const leg of this.legs) {
      const ph = this.animPhase + (leg.side > 0 ? 0 : Math.PI);
      const swing = Math.sin(ph) * amp;
      const lift = Math.max(0, Math.cos(ph)) * amp;
      leg.thigh.rotation.x = -swing * dirF - c * 1.15 - lift * 0.35;
      leg.thigh.rotation.z = swing * dirR * 0.5 * leg.side * leg.side;
      leg.shin.rotation.x = c * 2.1 + lift * 0.9;
      leg.foot.rotation.x = -c * 0.95 - lift * 0.3;
    }
    const bob = Math.abs(Math.sin(this.animPhase)) * Math.min(1, sp / 5) * 0.03;
    hips.position.y = 0.94 - c * 0.43 + bob;
    spine.rotation.x = -c * 0.3;
    const lean = THREE.MathUtils.clamp(-rightV * 0.02, -0.12, 0.12);
    spine.rotation.z -= this.hitRoll || 0; // keep the hit jolt out of the smoothed lean
    spine.rotation.z += (lean - spine.rotation.z) * Math.min(1, dt * 8);

    // aim: chest + head follow the pitch, the gun pivots around the shoulders
    chest.rotation.x = ch.pitch * 0.3 + c * 0.15;
    head.rotation.x = ch.pitch * 0.45 - c * 0.05;
    const recoilPitch = THREE.MathUtils.degToRad(ch.punch.y) * 0.4;
    aim.position.set(0, hips.position.y + 0.06 + 0.24 + 0.26, 0.02);
    aim.rotation.set(ch.pitch + recoilPitch, 0, 0);

    // hit reaction: the torso jerks away from the bullet, the head snaps on headshots,
    // a leg hit buckles the knee, and the gun is knocked off aim for a moment
    this.hitRoll = 0;
    const hr = ch.hitReact;
    const age = hr ? ch.game.time - hr.t : 1;
    if (age < 0.7) {
      const hk = hr.mag * Math.exp(-age * 7.5) * Math.min(1, 0.35 + age / 0.025);
      const lx = cy * hr.dir.x - sy * hr.dir.z, lz = sy * hr.dir.x + cy * hr.dir.z; // +z: toward the back
      const head = hr.zone === 'head', legHit = hr.zone === 'leg';
      spine.rotation.x += lz * hk * (legHit ? 0.08 : 0.32);
      this.hitRoll = -lx * hk * 0.28;
      spine.rotation.z += this.hitRoll;
      if (head) this.head.rotation.x += lz * hk * 0.9 + 0.2 * hk;
      if (head) this.head.rotation.z = -lx * hk * 0.6;
      if (legHit) {
        hips.position.y -= hk * 0.07;
        const leg = this.legs[hr.side > 0 ? 0 : 1];
        leg.shin.rotation.x += hk * 0.7; leg.thigh.rotation.x -= hk * 0.35;
      }
      aim.rotation.x += hk * 0.22;
      aim.rotation.z += lx * hk * 0.15;
    } else if (this.head.rotation.z) this.head.rotation.z = 0;
    // reload: tip the gun and drop the support hand to the mag well
    const w = ch.weapon;
    const reloading = w?.reloading ? 1 : 0;
    this.reloadBlend = (this.reloadBlend || 0) + (reloading - (this.reloadBlend || 0)) * Math.min(1, dt * 10);
    aim.rotation.x -= this.reloadBlend * 0.35;
    aim.rotation.z = this.reloadBlend * 0.25;
    const kick = Math.max(0, 0.08 - (ch.game.time - ch.lastShotTime)) * (ch.def?.recoil?.kick || 0.5);
    if (this.restPos) this.gunHolder.position.z = this.restPos.z + kick * 0.6;

    this.solveArms();
  }

  solveArms() {
    const root = this.root;
    root.updateMatrixWorld(true);
    const gun = this.gun;
    for (const arm of this.arms) {
      const sh = this.shoulders[arm.side > 0 ? 0 : 1];
      sh.getWorldPosition(arm.shoulder);
      root.worldToLocal(arm.shoulder);
      if (gun) {
        if (arm.side > 0) arm.target.set(0, 0, 0);
        else if (gun.userData.support && this.long) arm.target.copy(gun.userData.support);
        else arm.target.set(-0.045, -0.02, 0.03); // second hand cups the grip
        if (arm.side < 0 && this.reloadBlend > 0.05) arm.target.lerp(tmp3, this.reloadBlend);
        gun.localToWorld(arm.target);
        root.worldToLocal(arm.target);
      } else {
        arm.target.set(arm.side * 0.25, 0.85, -0.05);
      }
      const pole = tmp2.set(arm.side * 0.8, -1, 0.15);
      solveElbow(arm.shoulder, arm.target, UPPER, FORE, pole, arm.elbow);
      orient(arm.up, arm.shoulder, arm.elbow);
      orient(arm.fore, arm.elbow, arm.target);
      arm.hand.position.copy(arm.target);
      arm.hand.quaternion.copy(arm.fore.quaternion);
    }
  }

  /** Death: a jolt from the bullet, a short slide, then one of a few falls; the gun drops for real. */
  updateDead(t) {
    const ch = this.ch;
    if (!this.dead) this.beginDeath();
    const d = this.dead;
    const dt = Math.min(0.05, Math.max(0, t - d.lastT));
    d.lastT = t;
    const age = t - ch.deathTime;

    // knockback slide (visual only; the body stays where it died for gameplay)
    d.vel.multiplyScalar(Math.exp(-dt * 6));
    d.off.addScaledVector(d.vel, dt);
    this.root.position.add(d.off);
    const turn = THREE.MathUtils.smoothstep(age, 0.05, 0.6);
    this.root.rotation.y = ch.yaw + d.twist * turn;

    const k = Math.min(1, age / d.dur);
    const fall = k * k * (1.6 - 0.6 * k); // accelerating, like gravity
    const settle = age > d.dur ? Math.exp(-(age - d.dur) * 9) * Math.sin((age - d.dur) * 28) * 0.06 : 0; // little bounce
    const jolt = Math.exp(-age * 14) * Math.min(1, age / 0.02); // the bullet's shove
    const dir = this.fallDir; // +1 forward, -1 backward

    if (d.variant === 'crumple') {
      // knees give out first, then the body folds forward
      const knees = Math.min(1, age / 0.3);
      for (const leg of this.legs) {
        leg.thigh.rotation.x = -1.35 * knees * (1 - fall * 0.5);
        leg.shin.rotation.x = 2.2 * knees * (1 - fall * 0.65);
        leg.foot.rotation.x = -0.4 * knees;
      }
      this.hips.position.y = 0.94 - knees * 0.5 - fall * 0.3 + settle;
      this.hips.rotation.x = fall * 1.5 + settle;
      this.hips.rotation.z = 0;
      this.spine.rotation.x = 0.3 * knees - jolt * 0.4;
    } else {
      const sideways = d.variant === 'twist' ? Math.sign(d.twist) : 0;
      for (const leg of this.legs) {
        leg.thigh.rotation.x = -0.5 * Math.min(1, age / 0.25) * (1 - fall * 0.7);
        leg.shin.rotation.x = 0.9 * Math.min(1, age / 0.25) * (1 - fall * 0.8);
        leg.foot.rotation.x = -0.25;
      }
      this.hips.position.y = 0.94 - fall * 0.8 + settle;
      this.hips.rotation.x = dir * fall * 1.5 * (sideways ? 0.4 : 1) + settle;
      this.hips.rotation.z = sideways * fall * 1.25;
      this.spine.rotation.x = -dir * jolt * 0.5 + dir * fall * 0.12;
    }
    this.spine.rotation.z = 0;
    this.chest.rotation.x = 0;
    this.head.rotation.x = (d.head ? -0.9 * jolt : 0) + dir * fall * 0.3;
    this.head.rotation.z = d.headTilt * fall;

    // arms go limp and flop outwards as the body lands
    this.root.updateMatrixWorld(true);
    for (const arm of this.arms) {
      const sh = this.shoulders[arm.side > 0 ? 0 : 1];
      sh.getWorldPosition(arm.shoulder); this.root.worldToLocal(arm.shoulder);
      const flop = arm.side * (0.3 + fall * 0.25 + d.armSpread);
      arm.target.copy(arm.shoulder).add(tmp.set(flop, -0.35 + fall * 0.3 + jolt * 0.25, dir * 0.35 * fall));
      solveElbow(arm.shoulder, arm.target, UPPER, FORE, tmp2.set(arm.side, 0, -dir), arm.elbow);
      orient(arm.up, arm.shoulder, arm.elbow);
      orient(arm.fore, arm.elbow, arm.target);
      arm.hand.position.copy(arm.target);
    }
    this.updateDroppedGun(dt);
  }

  beginDeath() {
    const ch = this.ch;
    const imp = ch.deathImpulse || new THREE.Vector3();
    const r = Math.random();
    const variant = ch.deathHead && r < 0.6 ? 'back' : r < 0.4 ? 'crumple' : r < 0.7 ? 'twist' : 'back';
    this.dead = {
      variant, lastT: ch.deathTime, head: !!ch.deathHead,
      vel: imp.clone().setY(0), off: new THREE.Vector3(),
      twist: variant === 'twist' ? (Math.random() < 0.5 ? -1 : 1) * (0.8 + Math.random() * 0.7) : (Math.random() - 0.5) * 0.5,
      dur: variant === 'crumple' ? 0.85 : 0.62,
      headTilt: (Math.random() - 0.5) * 0.8, armSpread: Math.random() * 0.25,
    };
    // the gun leaves the hands and falls with its own momentum
    const gun = this.gun;
    if (gun && gun.parent && ch.game?.scene) {
      this.gunLocal = { p: gun.position.clone(), q: gun.quaternion.clone() };
      this.root.updateMatrixWorld(true);
      ch.game.scene.attach(gun);
      this.dropped = {
        obj: gun, floor: ch.pos.y + 0.035, landed: false,
        vel: imp.clone().multiplyScalar(0.6).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.6, (Math.random() - 0.5) * 1.2)),
        spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8),
        rest: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), 'YXZ')),
      };
    }
  }

  updateDroppedGun(dt) {
    const g = this.dropped;
    if (!g || dt <= 0) return;
    const o = g.obj;
    if (!g.landed) {
      g.vel.y -= 14 * dt; // a touch heavier than real gravity reads better at game scale
      o.position.addScaledVector(g.vel, dt);
      o.rotation.x += g.spin.x * dt; o.rotation.y += g.spin.y * dt; o.rotation.z += g.spin.z * dt;
      if (o.position.y <= g.floor) {
        o.position.y = g.floor;
        if (Math.abs(g.vel.y) < 1.2) g.landed = true;
        g.vel.set(g.vel.x * 0.4, -g.vel.y * 0.25, g.vel.z * 0.4);
        g.spin.multiplyScalar(0.35);
        this.ch.game.audio?.impact?.(o.position, 'metal');
      }
    } else {
      // settle flat on its side
      o.quaternion.slerp(g.rest, Math.min(1, dt * 10));
      o.position.y += (g.floor + 0.01 - o.position.y) * Math.min(1, dt * 10);
    }
  }

  revive() {
    if (this.dropped) {
      const g = this.dropped.obj;
      g.removeFromParent();
      if (g === this.gun) {
        this.gunHolder.add(g);
        g.position.copy(this.gunLocal.p); g.quaternion.copy(this.gunLocal.q);
      }
      this.dropped = null;
    }
    this.dead = null;
    this.ch.deathImpulse = null; this.ch.deathHead = false;
    this.gunHolder.visible = true;
    this.hips.rotation.set(0, 0, 0);
    this.head.rotation.z = 0;
  }
}

function orient(mesh, a, b) {
  mesh.position.copy(a);
  const d = tmp.subVectors(b, a).normalize();
  mesh.quaternion.setFromUnitVectors(Z, d);
}
