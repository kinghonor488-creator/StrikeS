// First-person weapon: IK arms + gloved hands, and every handling animation
// (kick, slide blowback, bolt, pump, mag & shell reloads, draw, inspect, knife, ink pen).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { buildGunModel } from './weapons.js';
import { TEAMS } from './character.js';
import { LOOKS } from './rig.js';

// Grip position in view space. Guns sit right of and below the eye, canted a little so
// the left side of the receiver faces the camera; stocks fall off the right edge.
const POSE = {
  pistol: { pos: [0.1, -0.13, -0.33], rot: [0.02, 0.0, -0.06] },
  smg: { pos: [0.135, -0.15, -0.3], rot: [0.03, -0.02, -0.12] },
  rifle: { pos: [0.145, -0.155, -0.315], rot: [0.03, -0.03, -0.14] },
  heavy: { pos: [0.15, -0.16, -0.32], rot: [0.03, -0.03, -0.13] },
  sniper: { pos: [0.145, -0.165, -0.3], rot: [0.03, -0.03, -0.12] },
  knife: { pos: [0.15, -0.17, -0.33], rot: [0.25, 0.25, 0.35] },
  ink: { pos: [0.13, -0.16, -0.31], rot: [0.55, 0.15, 0.25] },
};
// virtual shoulders sit forward of the eye so the off hand can reach a rifle's handguard
const SHOULDER = [new THREE.Vector3(0.22, -0.3, -0.02), new THREE.Vector3(-0.24, -0.36, -0.22)]; // left arm angles in from below so the support hand shows
const UPPER = 0.33, FORE = 0.33;

const ease = (t) => t * t * (3 - 2 * t);
const seg = (k, a, b) => ease(THREE.MathUtils.clamp((k - a) / (b - a), 0, 1));
// per-shot recoil impulses (m/s and rad/s into ~20 rad/s springs → peaks of a few cm / degrees)
const KICK = {
  pistol: { back: 0.55, up: 0.18, pitch: 1.9, yaw: 0.35, roll: 0.9 },
  smg: { back: 0.42, up: 0.1, pitch: 0.9, yaw: 0.3, roll: 0.55 },
  rifle: { back: 0.62, up: 0.14, pitch: 1.25, yaw: 0.35, roll: 0.75 },
  heavy: { back: 0.7, up: 0.16, pitch: 1.3, yaw: 0.4, roll: 0.8 },
  shotgun: { back: 1.25, up: 0.3, pitch: 3.2, yaw: 0.6, roll: 1.5 },
  sniper: { back: 1.4, up: 0.32, pitch: 3.6, yaw: 0.5, roll: 1.6 },
};
const SPRING_K = 430, SPRING_C = 2 * Math.sqrt(SPRING_K) * 0.62; // a little bounce on the way back
function stepSprings(rs, dt) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (const key in rs) {
    const sp = rs[key];
    for (let i = 0; i < n; i++) {
      sp[1] += (-SPRING_K * sp[0] - SPRING_C * sp[1]) * h;
      sp[0] += sp[1] * h;
    }
  }
}
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpQ3 = new THREE.Quaternion();
// support hand in gun space: palm against the near side of the handguard (tilted up),
// fingers rising over the top, thumb toward the muzzle
const SUPPORT_BASIS = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.55).multiply(
  new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(
    new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, -1, 0))));
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

function flashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.18, 'rgba(255,230,150,0.95)');
  grd.addColorStop(0.45, 'rgba(255,150,40,0.55)');
  grd.addColorStop(1, 'rgba(255,90,0,0)');
  g.fillStyle = grd;
  // petals
  g.translate(64, 64);
  for (let i = 0; i < 6; i++) {
    g.rotate(Math.PI / 3);
    g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(20, -3, 62, 0); g.quadraticCurveTo(20, 3, 0, 6); g.fill();
  }
  g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class ViewModel {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(54, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x5a4a3a, 0.9));
    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
    this.sun.position.set(-0.5, 1, 0.6);
    this.scene.add(this.sun);
    this.flashLight = new THREE.PointLight(0xffb060, 0, 0.7, 2);
    this.scene.add(this.camera);
    this.root = new THREE.Group();
    this.camera.add(this.root);
    this.pivot = new THREE.Group();   // whole-weapon animation
    this.root.add(this.pivot);
    this.flashLight.position.set(-0.05, 0.02, -0.55);
    this.pivot.add(this.flashLight);

    const tex = flashTexture();
    const fm = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(4, 3.2, 2.2), side: THREE.DoubleSide, toneMapped: true });
    this.flash = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.11), fm);
    const side1 = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.24), fm); side1.rotation.y = Math.PI / 2; side1.position.z = -0.08; side1.rotation.z = Math.PI / 2;
    const side2 = side1.clone(); side2.rotation.x = Math.PI / 2;
    this.flash.add(front, side1, side2);
    this.flash.visible = false;

    this.s = {
      swayX: 0, swayY: 0, bob: 0, kick: 0, kickRot: 0, kickRoll: 0, land: 0, airY: 0, tilt: 0,
      draw: 0, inspect: -1, slash: 0, heavy: 0, flashT: 0, slide: 0, pump: 0, reloadK: -1,
      cues: new Set(),
    };
    // recoil springs (value, velocity): each shot is a velocity impulse, the spring snaps it home
    this.rs = { back: [0, 0], up: [0, 0], pitch: [0, 0], yaw: [0, 0], roll: [0, 0] };
    this.weaponId = null;
    this.visible = true;
    this.arms = null;
    this.team = 'T';
  }

  setTeam(team) {
    if (team === this.team && this.arms) return;
    this.team = team;
    this.buildArms();
    if (this.weaponId) this.setWeapon(this.weaponId, true);
  }

  // ---- arms ----------------------------------------------------------------
  buildArms() {
    if (this.arms) for (const a of this.arms) { this.root.remove(a.up, a.fore, a.hand); }
    const L = LOOKS[this.team];
    const sleeve = L.sleeve(), glove = L.gloves(), cuff = L.accent();
    const limb = (r1, r2, len, m) => {
      const g = new THREE.CylinderGeometry(r2, r1, len, 14).rotateX(Math.PI / 2).translate(0, 0, len / 2);
      return new THREE.Mesh(g, m);
    };
    this.arms = [0, 1].map((i) => {
      const side = i === 0 ? 1 : -1;
      const up = limb(0.055, 0.05, UPPER, sleeve);
      const fore = limb(0.05, 0.036, FORE, sleeve); // tapers to the wrist so it reads as an arm
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.041, 0.035, 14).rotateX(Math.PI / 2), cuff);
      band.position.z = FORE - 0.03;
      fore.add(band);
      const hand = this.makeHand(side, glove);
      this.root.add(up, fore, hand);
      return { side, up, fore, hand, elbow: new THREE.Vector3(), target: new THREE.Vector3(), q: new THREE.Quaternion() };
    });
  }

  makeHand(side, m) {
    const h = new THREE.Group();
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.03, 0.085, 2, 0.012), m);
    palm.position.z = 0.0;
    h.add(palm);
    h.userData.fingers = [];
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Group();
      f.position.set((i - 1.5) * 0.018 * side, 0, -0.045);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085, 0.026, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.017), m);
      f.add(a);
      const tip = new THREE.Group(); tip.position.z = -0.034; f.add(tip);
      tip.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.018, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.013), m));
      f.userData.tip = tip;
      h.add(f);
      h.userData.fingers.push(f);
    }
    const thumb = new THREE.Group();
    thumb.position.set(0.035 * side, 0.004, -0.01);
    thumb.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -0.02), m));
    thumb.rotation.set(0.2, side * 0.7, 0);
    h.add(thumb);
    h.userData.thumb = thumb;
    return h;
  }

  /** Curl fingers: 0 = open hand, 1 = tight fist around a grip. */
  curl(hand, k) {
    for (const f of hand.userData.fingers) { f.rotation.x = -1.1 * k; f.userData.tip.rotation.x = -1.3 * k; }
    hand.userData.thumb.rotation.x = 0.2 - 0.6 * k;
  }

  // ---- weapon ----------------------------------------------------------------
  setWeapon(id, force = false) {
    if (id === this.weaponId && !force) return;
    if (!this.arms) this.buildArms();
    this.weaponId = id;
    while (this.pivot.children.length > 1) this.pivot.remove(this.pivot.children[1]);
    if (!id) { this.model = null; return; }
    const def = this.game.player ? this.game.viewTarget?.def : null;
    const model = buildGunModel(id, TEAMS[this.team].accent);
    this.game.stickers?.apply(model, id);
    model.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
    this.pivot.add(model);
    this.model = model;
    this.cat = (def && def.id === id ? def.cat : null) || guessCat(id);
    this.pose = POSE[this.cat] || POSE.rifle;
    model.userData.muzzle.add(this.flash);
    this.flash.position.set(0, 0, -0.02);
    this.s.draw = 1;
    this.s.inspect = -1;
    this.s.reloadK = -1;
    this.s.slide = 0;
  }

  // ---- events from the game ---------------------------------------------------
  kick(def) {
    const s = this.s, rs = this.rs;
    const K = def.pellets ? KICK.shotgun : KICK[def.cat] || KICK.rifle;
    const side = Math.random() - 0.5;
    rs.back[1] += K.back * (0.9 + Math.random() * 0.2);
    rs.up[1] += K.up;
    rs.pitch[1] += K.pitch * (0.85 + Math.random() * 0.3);
    rs.yaw[1] += K.yaw * side * 2;
    rs.roll[1] += K.roll * (side * 2 + (Math.random() - 0.5));
    s.inspect = -1;
    if (def.cat === 'pistol') s.slide = 1;
    if (def.pumpAction) s.pump = 1;
    if (!def.suppressed) {
      s.flashT = 0.045;
      this.flash.rotation.z = Math.random() * Math.PI;
      this.flash.scale.setScalar(def.cat === 'pistol' ? 0.8 : def.cat === 'sniper' || def.cat === 'heavy' ? 1.35 : 1.0 + Math.random() * 0.2);
    }
  }
  slash(heavy = false) { if (heavy) this.s.heavy = 1; else this.s.slash = 1; }
  landed(v) { this.s.land = Math.min(1, v / 10); }
  inspect() { if (this.s.reloadK < 0 && this.s.draw <= 0) this.s.inspect = 0; }

  /** Eject position + velocity in world space for the shell casing. */
  ejectWorld(worldCam) {
    if (!this.model) return null;
    const p = this.model.userData.eject.getWorldPosition(tmpA);
    this.camera.worldToLocal(p);
    const world = worldCam.localToWorld(p.clone());
    const vel = new THREE.Vector3(1.6 + Math.random(), 1.1 + Math.random() * 0.8, 0.4).applyQuaternion(worldCam.quaternion);
    return { pos: world, vel };
  }

  // ---- per frame -----------------------------------------------------------------
  update(dt, ch, input, aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const s = this.s;
    const w = ch.weapon;
    this.root.visible = this.visible && ch.alive && !ch.scoped;
    if (!w || !this.arms) return;
    if (w.id !== this.weaponId) this.setWeapon(w.id);
    if (!this.model) return;
    const def = w.def, t = this.game.time, cat = this.cat;
    const parts = this.model.userData.parts;

    // mouse sway lags behind the view; strafing rolls the gun
    s.swayX += (-input.lookDX * 0.00045 - s.swayX) * Math.min(1, dt * 9);
    s.swayY += (input.lookDY * 0.00045 - s.swayY) * Math.min(1, dt * 9);
    s.swayX = THREE.MathUtils.clamp(s.swayX, -0.025, 0.025);
    s.swayY = THREE.MathUtils.clamp(s.swayY, -0.025, 0.025);
    const sy = Math.sin(ch.yaw), cy = Math.cos(ch.yaw);
    const rightV = cy * ch.vel.x - sy * ch.vel.z;
    s.tilt += (THREE.MathUtils.clamp(-rightV * 0.012, -0.06, 0.06) - s.tilt) * Math.min(1, dt * 7);
    s.airY += (THREE.MathUtils.clamp(-ch.vel.y * 0.004, -0.03, 0.03) - s.airY) * Math.min(1, dt * 8);

    const sp = ch.onGround ? ch.speed2D() : 0;
    s.bob += dt * sp * 1.55;
    const amp = Math.min(1, sp / 5.5);
    const bobX = Math.cos(s.bob) * 0.009 * amp;
    const bobY = -Math.abs(Math.sin(s.bob)) * 0.011 * amp;
    const breathe = Math.sin(t * 1.4) * 0.0015;

    // springs
    stepSprings(this.rs, dt);
    s.land *= Math.exp(-dt * 7);
    s.draw = Math.max(0, s.draw - dt / Math.max(0.25, (def.draw ?? 0.6) * 0.75));
    s.slash = Math.max(0, s.slash - dt * 3.2);
    s.heavy = Math.max(0, s.heavy - dt * 1.6);
    s.flashT -= dt;
    this.flash.visible = s.flashT > 0;
    this.flashLight.intensity = s.flashT > 0 ? 0.9 : 0;
    if (s.inspect >= 0) { s.inspect += dt / 2.6; if (s.inspect >= 1 || w.reloading) s.inspect = -1; }

    // base pose
    const P = this.pose;
    const drawE = s.draw * s.draw;
    this.root.position.set(s.swayX + bobX, s.swayY + bobY + breathe - s.land * 0.035 + s.airY - drawE * 0.2, 0);
    this.root.rotation.set(s.swayY * 1.5 - drawE * 0.9, s.swayX * 1.5, s.swayX * 2 + s.tilt);
    let px = P.pos[0], py = P.pos[1], pz = P.pos[2];
    let rx = P.rot[0], ryy = P.rot[1], rz = P.rot[2];
    py -= ch.crouch * 0.012;
    const rs = this.rs;
    pz += rs.back[0]; py += rs.up[0];
    rx += rs.pitch[0]; ryy += rs.yaw[0]; rz += rs.roll[0];
    // follow a little of the spray so the gun visibly climbs
    rx += THREE.MathUtils.degToRad(ch.punch.y) * 0.25;
    ryy -= THREE.MathUtils.degToRad(ch.punch.x) * 0.25;

    let support = this.model.userData.support ? this.model.userData.support.clone() : null;
    let gripHand = new THREE.Vector3(0, 0, 0);
    let supportCurl = 0.95, gripCurl = 0.85;

    // ---- reloads
    const mag = parts.mag, slide = parts.slide, bolt = parts.bolt, pump = parts.pump;
    if (mag) { mag.position.copy(mag.userData.rest); mag.rotation.set(0, 0, 0); mag.visible = true; }
    if (slide) slide.position.copy(slide.userData.rest);
    if (bolt) { bolt.position.copy(bolt.userData.rest); bolt.rotation.set(0, 0, 0); }
    if (pump) pump.position.copy(pump.userData.rest);

    if (w.reloading && def.reloadType !== 'shell') {
      const k = THREE.MathUtils.clamp((t - w.reloadStart) / def.reload, 0, 1);
      this.cue(k, 0.2, 'magOut', def);
      this.cue(k, 0.6, 'magIn', def);
      if (w.reloadEmpty) this.cue(k, 0.8, cat === 'pistol' ? 'slideRelease' : 'chargingHandle', def);
      const tiltIn = seg(k, 0.0, 0.12) * (1 - seg(k, 0.85, 1));
      rz += tiltIn * (cat === 'pistol' ? 0.35 : 0.45);
      rx += tiltIn * 0.18;
      py += tiltIn * 0.02;
      if (mag) {
        const out = seg(k, 0.16, 0.3), back = seg(k, 0.48, 0.62);
        const drop = out * (1 - back);
        mag.position.y -= drop * 0.28;
        mag.position.z += drop * 0.05;
        mag.rotation.x = drop * 0.4;
        mag.visible = !(k > 0.3 && k < 0.48);
      }
      if (support || cat === 'pistol') {
        const magPos = mag ? mag.position.clone().add(new THREE.Vector3(-0.03, -0.06, 0)) : new THREE.Vector3(-0.03, -0.12, 0);
        const toMag = seg(k, 0.1, 0.18) * (1 - seg(k, 0.66, 0.74));
        const base = support || new THREE.Vector3(-0.04, -0.02, 0.02);
        support = base.clone().lerp(magPos, toMag);
        if (k > 0.3 && k < 0.48) support.y -= 0.2 * Math.sin(seg(k, 0.3, 0.48) * Math.PI);
        if (w.reloadEmpty) {
          const rack = seg(k, 0.72, 0.78) * (1 - seg(k, 0.84, 0.9));
          const handle = cat === 'pistol' ? new THREE.Vector3(-0.02, 0.05, 0.02) : new THREE.Vector3(-0.025, 0.07, 0.08);
          support.lerp(handle, rack);
          if (slide && cat === 'pistol') slide.position.z += rack * 0.03;
        }
        supportCurl = 0.55;
      }
    } else if (w.reloading && def.reloadType === 'shell') {
      const since = t - w.reloadStart;
      const startK = seg(since, 0, def.reloadStart ?? 0.4);
      rz -= startK * 0.5; rx += startK * 0.12;
      const per = def.reload;
      const ph = ((since - (def.reloadStart ?? 0.4)) % per + per) % per / per;
      const loading = since > (def.reloadStart ?? 0.4) ? 1 : 0;
      const portPos = new THREE.Vector3(0, -0.02, -0.12);
      const pushIn = loading * (ph < 0.6 ? seg(ph, 0, 0.6) : 1 - seg(ph, 0.6, 1));
      support = (support || new THREE.Vector3()).clone().lerp(portPos.clone().add(new THREE.Vector3(-0.01, -0.06 * (1 - pushIn), 0.03)), startK);
      supportCurl = 0.5;
    }
    // pistol slide blowback / lock back on empty
    if (slide) {
      s.slide = Math.max(0, s.slide - dt * 22);
      const locked = w.ammo === 0 && !w.reloading ? 1 : 0;
      slide.position.z += Math.max(s.slide, locked) * 0.028;
    }
    // pump: rack after each shot (and after a shell reload completes)
    if (pump) {
      if (s.pump > 0) s.pump = Math.max(0, s.pump - dt / Math.max(0.3, def.cycle * 0.7));
      const pk = s.pump > 0 ? Math.sin((1 - s.pump) * Math.PI) : 0;
      if (s.pump > 0) this.cue(1 - s.pump, 0.3, 'pump', def);
      if (s.pump === 0) s.cues.delete('pump');
      pump.position.z += pk * 0.075;
      if (support) support.z += pk * 0.075;
    }
    // bolt action
    if (bolt && w.boltEnd > t) {
      const k = 1 - (w.boltEnd - t) / def.bolt;
      this.cue(k, 0.18, 'boltUp', def); this.cue(k, 0.32, 'boltBack', def);
      this.cue(k, 0.5, 'boltForward', def); this.cue(k, 0.64, 'boltDown', def);
      const up = seg(k, 0.12, 0.22) * (1 - seg(k, 0.58, 0.68));
      const back = seg(k, 0.24, 0.36) * (1 - seg(k, 0.44, 0.56));
      bolt.rotation.z = -up * 1.1;
      bolt.position.z += back * 0.085;
      const handOnBolt = seg(k, 0.05, 0.14) * (1 - seg(k, 0.7, 0.85));
      gripHand = gripHand.lerp(bolt.position.clone().add(new THREE.Vector3(0.05, -0.012, 0.0)), handOnBolt);
      gripCurl = 0.85 - handOnBolt * 0.45;
      rz += handOnBolt * 0.1;
    } else if (bolt) {
      for (const c of ['boltUp', 'boltBack', 'boltForward', 'boltDown']) s.cues.delete(c);
    }
    if (!w.reloading) for (const c of ['magOut', 'magIn', 'slideRelease', 'chargingHandle']) s.cues.delete(c);

    // inspect: roll the gun to show off the stickers
    if (s.inspect >= 0) {
      const k = s.inspect;
      const a = seg(k, 0, 0.2) * (1 - seg(k, 0.85, 1));
      const flip = seg(k, 0.35, 0.6);
      ryy += a * (0.9 - flip * 1.6);
      rz += a * (0.5 - flip * 0.2);
      rx += a * 0.15;
      px -= a * 0.06; py += a * 0.04; pz -= a * 0.02;
    }
    // knife
    if (cat === 'knife') {
      const e = Math.sin(s.slash * Math.PI);
      rx -= e * 0.5; ryy += e * 1.1; rz += e * 0.5;
      px -= e * 0.15; pz -= e * 0.06;
      const hv = Math.sin(s.heavy * Math.PI);
      pz -= hv * 0.16; rx -= hv * 0.6; py += hv * 0.05;
    }
    // ink pen: press and scribble while drawing
    if (cat === 'ink' && this.game.ink?.drawing) {
      pz -= 0.03; px += Math.sin(t * 40) * 0.004; py += Math.cos(t * 33) * 0.004;
    }

    this.pivot.position.set(px, py, pz);
    this.pivot.rotation.set(rx, ryy, rz);

    // ---- arms (IK in root space)
    this.pivot.updateMatrixWorld(true);
    this.root.updateMatrixWorld(true);
    const R = this.arms[0], Lh = this.arms[1];
    const toRoot = (v) => this.root.worldToLocal(this.model.localToWorld(v.clone()));
    R.target.copy(toRoot(gripHand.add(new THREE.Vector3(0.0, -0.035, 0.02))));
    const twoHanded = cat !== 'knife' && cat !== 'ink';
    if (support && twoHanded) Lh.target.copy(toRoot(support.add(new THREE.Vector3(-0.038, -0.03, 0))));
    else if (twoHanded) Lh.target.copy(toRoot(new THREE.Vector3(-0.045, -0.04, 0.03)));
    else Lh.target.set(-0.3, -0.45, -0.1); // off-screen
    this.solveArm(R, SHOULDER[0], new THREE.Vector3(0.6, -1, 0.3));
    this.solveArm(Lh, SHOULDER[1], new THREE.Vector3(-0.7, -1, 0.2));
    if (twoHanded && cat !== 'pistol') {
      tmpQ.copy(this.root.getWorldQuaternion(tmpQ2).invert()).multiply(this.model.getWorldQuaternion(tmpQ3));
      Lh.hand.quaternion.copy(tmpQ).multiply(SUPPORT_BASIS);
    }
    this.curl(R.hand, gripCurl);
    this.curl(Lh.hand, supportCurl);
    Lh.hand.visible = Lh.fore.visible = Lh.up.visible = twoHanded || s.inspect >= 0;
  }

  solveArm(arm, shoulder, pole) {
    const hand = arm.target;
    const d = tmpA.subVectors(hand, shoulder);
    let len = d.length();
    const max = UPPER + FORE - 0.002;
    if (len > max) { d.multiplyScalar(max / len); hand.copy(shoulder).add(d); len = max; }
    const x = (UPPER * UPPER - FORE * FORE + len * len) / (2 * len);
    const h = Math.sqrt(Math.max(0, UPPER * UPPER - x * x));
    d.normalize();
    const p = tmpB.copy(pole).addScaledVector(d, -pole.dot(d)).normalize();
    arm.elbow.copy(shoulder).addScaledVector(d, x).addScaledVector(p, h);
    arm.up.position.copy(shoulder);
    arm.up.quaternion.setFromUnitVectors(Z, tmpC.subVectors(arm.elbow, shoulder).normalize());
    arm.fore.position.copy(arm.elbow);
    arm.fore.quaternion.setFromUnitVectors(Z, tmpC.subVectors(hand, arm.elbow).normalize());
    // hand continues the forearm, rolled so the palm faces the grip
    arm.hand.position.copy(hand);
    arm.hand.quaternion.copy(arm.fore.quaternion);
    arm.hand.rotateZ(arm.side * -1.2);
    arm.hand.rotateY(Math.PI);
  }

  /** Fire a one-shot sound cue when the animation passes `at`. */
  cue(k, at, part, def) {
    if (k >= at && !this.s.cues.has(part)) {
      this.s.cues.add(part);
      this.game.audio?.reloadPart?.(def.sound?.kind || 'rifle', part);
      if (part === 'boltBack' || part === 'pump') this.game.onCasing?.(this.game.viewTarget, true);
    }
  }
}

function guessCat(id) {
  if (['g18', 's1', 'p25', 't9', 'f7', 'd50'].includes(id)) return 'pistol';
  if (['m10', 'mp9', 'mp7', 'p90'].includes(id)) return 'smg';
  if (['n7', 'x14', 'm249'].includes(id)) return 'heavy';
  if (['s08', 'aw1'].includes(id)) return 'sniper';
  if (id === 'knife') return 'knife';
  if (id === 'inkpen') return 'ink';
  return 'rifle';
}
