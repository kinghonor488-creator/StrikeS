// A combatant (player or bot): Source-style movement, CS2-style weapon handling
// (spray patterns, movement/air/landing inaccuracy, recoil recovery), hitboxes.
import * as THREE from 'three';
import { moveBody, fits } from '../world/world.js';
import { WEAPONS, makeWeaponState, buildGunModel, DEFAULT_PISTOL } from './weapons.js';
import { HumanRig } from './rig.js';

// Genre-standard movement converted to metres (1 unit = 1 inch).
export const MOVE = {
  run: 6.35,                // knife speed; guns override with their own `speed`
  walkMul: 0.52, crouchMul: 0.34,
  accel: 5.5, airAccel: 12, airCap: 0.76, friction: 5.2, stopSpeed: 2.03,
  gravity: 20.32, jump: 7.67,
  radius: 0.41, height: 1.83, crouchHeight: 1.37,
  eye: 1.63, crouchEye: 1.17,
};

export const TEAMS = {
  T: { name: '涂鸦帮', en: 'DOODLERS', color: '#e8553f', dark: '#a8342a', accent: '#f2b134' },
  CT: { name: '橡皮擦', en: 'ERASERS', color: '#4a8fd8', dark: '#2d5c99', accent: '#e79aa6' },
};

const D2R = Math.PI / 180;
let nextId = 1;

export class Character {
  constructor(game, { name, team, isBot = true }) {
    this.id = nextId++;
    this.game = game;
    this.name = name;
    this.team = team;
    this.isBot = isBot;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = true;
    this.crouch = 0;          // 0..1 smoothed
    this.crouching = false;
    this.walking = false;

    this.hp = 100; this.armor = 0; this.helmet = false; this.kit = false;
    this.alive = true;
    this.money = 800;
    this.ink = 40;
    this.hasBomb = false;
    this.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, dmg: 0 };
    this.damageBy = new Map();

    this.slots = { 1: null, 2: makeWeaponState(DEFAULT_PISTOL[team]), 3: makeWeaponState('knife'), 4: makeWeaponState('inkpen') };
    this.slot = 2;
    // recoil state (degrees): x = right, y = up. Bullets follow `punch`, the view shows part of it.
    this.punch = new THREE.Vector2();
    this.recoilIndex = 0;
    this.fireInacc = 0;
    this.landInacc = 0;
    this.scopeLevel = 0;
    this.flinch = 0;
    this.stepPhase = 0;
    this.deathTime = 0;
    this.lastHurt = -10;
    this.lastShotTime = -10;
    this.action = null;       // { type: 'plant'|'defuse', t0, dur }

    this.buildRig();
  }

  get weapon() { return this.slots[this.slot]; }
  get def() { return this.weapon?.def; }
  get scoped() { return this.scopeLevel > 0; }
  set scoped(v) { if (!v) this.scopeLevel = 0; }
  get height() { return MOVE.height - (MOVE.height - MOVE.crouchHeight) * this.crouch; }
  get eyeHeight() { return MOVE.eye - (MOVE.eye - MOVE.crouchEye) * this.crouch; }
  eyePos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z); }
  forward(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }
  speed2D() { return Math.hypot(this.vel.x, this.vel.z); }

  weaponSpeed() {
    const d = this.def;
    if (!d) return MOVE.run;
    if (this.scoped && d.scopedSpeed) return d.scopedSpeed;
    return d.speed || MOVE.run;
  }

  maxSpeed() {
    let s = this.weaponSpeed();
    if (this.crouching) s *= MOVE.crouchMul;
    else if (this.walking) s *= MOVE.walkMul;
    if (this.action) s = 0;
    return s;
  }

  // --- movement -----------------------------------------------------------
  /** intent: { fwd, right, jump, crouch, walk, yaw, pitch } */
  simulateMovement(dt, intent) {
    if (!this.alive) return;
    this.yaw = intent.yaw; this.pitch = intent.pitch;

    if (intent.crouch) this.crouching = true;
    else if (this.crouching && fits(this.game.world, this.pos, MOVE.radius, MOVE.height)) this.crouching = false;
    // ducking takes ~0.2 s like the genre expects
    this.crouch += ((this.crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 9);
    this.walking = !!intent.walk;

    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    let wx = -sy * intent.fwd + cy * intent.right;
    let wz = -cy * intent.fwd - sy * intent.right;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) { wx /= wl; wz /= wl; }
    const wishSpeed = wl > 1e-4 ? this.maxSpeed() : 0;

    if (this.onGround) {
      const sp = this.speed2D();
      if (sp > 0) {
        const control = Math.max(sp, MOVE.stopSpeed);
        const drop = control * MOVE.friction * dt;
        const ns = Math.max(0, sp - drop) / sp;
        this.vel.x *= ns; this.vel.z *= ns;
      }
      this.accelerate(wx, wz, wishSpeed, MOVE.accel, dt);
      // never exceed the current cap (e.g. after scoping in or starting to walk)
      const cap = this.maxSpeed();
      const sp2 = this.speed2D();
      if (sp2 > cap && wishSpeed > 0) { const k = Math.max(cap, sp2 - 30 * dt) / sp2; this.vel.x *= k; this.vel.z *= k; }
      if (intent.jump && !this.action) {
        this.vel.y = MOVE.jump;
        this.onGround = false;
        this.game.onJump?.(this);
      }
    } else {
      this.airAccelerate(wx, wz, wishSpeed, dt);
    }

    this.vel.y -= MOVE.gravity * dt;
    const delta = new THREE.Vector3(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);
    const res = moveBody(this.game.world, this.pos, this.vel, delta, MOVE.radius, this.height, 0.55, this.onGround);
    const wasAir = !this.onGround;
    this.onGround = res.onGround;
    if (wasAir && res.onGround) {
      if (res.landedSpeed > 3) {
        this.landInacc = this.def?.spread?.land ?? 0.05;
        if (res.landedSpeed > 9) { this.vel.x *= 0.6; this.vel.z *= 0.6; }
        this.game.onLand?.(this, res.landedSpeed);
      }
    }
    if (res.stepped) this.stepSmooth = (this.stepSmooth || 0) - res.stepped;

    const b = this.game.map.bounds;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX + 0.5, b.maxX - 0.5);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ + 0.5, b.maxZ - 0.5);

    // footsteps only when running (walking and crouching are silent)
    const sp = this.speed2D();
    if (this.onGround && sp > 0.5) {
      this.stepPhase += sp * dt;
      if (this.stepPhase > 1.9) {
        this.stepPhase = 0;
        if (sp > this.weaponSpeed() * 0.56 && !this.crouching) this.game.onFootstep?.(this);
      }
    }
  }

  accelerate(wx, wz, wishSpeed, accel, dt) {
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = wishSpeed - cur;
    if (add <= 0) return;
    const a = Math.min(accel * dt * wishSpeed, add);
    this.vel.x += a * wx; this.vel.z += a * wz;
  }

  airAccelerate(wx, wz, wishSpeed, dt) {
    const capped = Math.min(wishSpeed, MOVE.airCap);
    const cur = this.vel.x * wx + this.vel.z * wz;
    const add = capped - cur;
    if (add <= 0) return;
    const a = Math.min(MOVE.airAccel * wishSpeed * dt, add);
    this.vel.x += a * wx; this.vel.z += a * wz;
  }

  // --- weapons --------------------------------------------------------------
  /** Current inaccuracy cone (radians). Running guns are wildly inaccurate, like the genre. */
  inaccuracy() {
    const def = this.def;
    if (!def?.spread) return 0;
    const s = def.spread;
    const vmax = def.speed || MOVE.run;
    const sp = this.speed2D();
    const moveFrac = THREE.MathUtils.clamp((sp - vmax * 0.34) / (vmax * 0.95 - vmax * 0.34), 0, 1);
    let base = (this.crouching && this.onGround) ? s.crouch : s.stand;
    if (this.scoped && s.scoped != null) base = s.scoped;
    let v = base + s.move * moveFrac + this.fireInacc + this.landInacc;
    if (!this.onGround) v += def.jumpAccurate && Math.abs(this.vel.y) < 1.4 ? s.air * 0.12 : s.air;
    return v;
  }

  switchTo(slot) {
    if (!this.slots[slot] || slot === this.slot || !this.alive) return false;
    const prev = this.weapon;
    if (prev) { prev.reloading = false; prev.reloadEnd = 0; }
    this.slot = slot;
    this.scopeLevel = 0;
    const w = this.weapon;
    w.drawEnd = this.game.time + (w.def.draw ?? 0.5);
    this.fireInacc = 0;
    this.recoilIndex = 0;
    this.action = null;
    this.game.onSwitch?.(this);
    return true;
  }

  giveWeapon(id) {
    const st = makeWeaponState(id);
    const slot = st.def.slot;
    this.slots[slot] = st;
    this.slot = slot;
    this.scopeLevel = 0;
    st.drawEnd = this.game.time + Math.min(0.5, st.def.draw ?? 0.5);
    this.refreshHeldModel();
    return st;
  }

  startReload() {
    const w = this.weapon;
    if (!w || !w.def.mag || w.reloading || w.ammo >= w.def.mag || w.reserve <= 0 || w.boltEnd > this.game.time) return false;
    const t = this.game.time;
    w.reloading = true;
    w.reloadStart = t;
    w.reloadEmpty = w.ammo === 0;
    if (w.def.reloadType === 'shell') {
      w.shellTimer = t + (w.def.reloadStart ?? 0.4) + w.def.reload;
      w.reloadEnd = 0;
    } else {
      w.reloadEnd = t + w.def.reload;
    }
    this.scopeLevel = 0;
    this.game.onReload?.(this);
    return true;
  }

  cancelReload() {
    const w = this.weapon;
    if (w) { w.reloading = false; w.reloadEnd = 0; }
  }

  toggleScope() {
    const def = this.def;
    if (!def?.scope || this.weapon.reloading || this.weapon.boltEnd > this.game.time) return;
    this.scopeLevel = (this.scopeLevel + 1) % (def.scope.levels.length + 1);
    this.game.onScope?.(this);
  }

  updateWeapon(dt) {
    const w = this.weapon;
    if (!w) return;
    const def = w.def, t = this.game.time;
    if (w.reloading) {
      if (def.reloadType === 'shell') {
        if (t >= w.shellTimer) {
          w.ammo++; w.reserve--;
          this.game.onShellLoaded?.(this);
          if (w.ammo >= def.mag || w.reserve <= 0) w.reloading = false;
          else w.shellTimer += def.reload;
        }
      } else if (t >= w.reloadEnd) {
        const take = Math.min(def.mag - w.ammo, w.reserve);
        w.ammo += take; w.reserve -= take;
        w.reloading = false; w.reloadEnd = 0;
      }
    }
    if (w.boltEnd && t >= w.boltEnd) {
      w.boltEnd = 0;
      if (this.resumeScope && def.scope) this.scopeLevel = this.resumeScope;
      this.resumeScope = 0;
    }
    // recovery once the trigger is released
    const r = def.recoil, s = def.spread;
    if (r && t - this.lastShotTime > (def.cycle || 0.1) + 0.03) {
      const k = Math.exp(-r.decay * dt);
      this.punch.multiplyScalar(k);
      const len = this.punch.length();
      if (len > 0) this.punch.multiplyScalar(Math.max(0, len - 2.5 * dt) / len);
      const tau = (s?.recover ?? 0.35) * 0.45;
      this.recoilIndex *= Math.exp(-dt / tau);
      if (this.recoilIndex < 0.05) this.recoilIndex = 0;
      this.fireInacc *= Math.exp(-dt / tau);
    }
    this.landInacc *= Math.exp(-dt * 5);
    this.flinch *= Math.exp(-dt * 9);
  }

  canFire() {
    const w = this.weapon;
    if (!this.alive || !w || this.action) return false;
    const t = this.game.time;
    if (t < w.nextFire || t < w.drawEnd || w.boltEnd > t) return false;
    if (w.reloading && (w.def.reloadType !== 'shell' || w.ammo === 0)) return false;
    return true;
  }

  /** Pull the trigger once. Returns true if a shot went off. */
  fire() {
    if (!this.canFire()) return false;
    const w = this.weapon, def = w.def, t = this.game.time;
    if (def.cat === 'ink') return false;
    if (def.cat === 'knife') {
      w.nextFire = t + def.cycle;
      this.lastShotTime = t;
      this.game.knifeAttack(this, false);
      return true;
    }
    if (w.ammo <= 0) {
      w.nextFire = t + 0.22;
      this.game.onDryFire?.(this);
      if (w.reserve > 0) this.startReload();
      return false;
    }
    if (w.reloading) w.reloading = false; // shell reload interrupted by firing
    w.ammo--;
    w.nextFire = t + def.cycle;
    w.shotsFired++;
    this.lastShotTime = t;

    const origin = this.eyePos();
    const inacc = this.inaccuracy();
    const pellets = def.pellets || 1;
    const tracer = def.tracer > 0 && (w.shotsFired % def.tracer === 0 || pellets > 1);
    for (let i = 0; i < pellets; i++) {
      this.game.fireBullet(this, origin, this.shotDirection(inacc, def), def, i === 0, tracer && i === 0);
    }

    // spray pattern: punch follows the table, step by step
    const r = def.recoil;
    const idx = Math.min(Math.floor(this.recoilIndex), r.table.length - 2);
    const a = r.table[idx], b = r.table[idx + 1];
    const mul = this.scoped && def.scope?.scopedRecoil ? def.scope.scopedRecoil : 1;
    this.punch.x += ((b[0] - a[0]) + (Math.random() - 0.5) * 2 * r.variance) * mul;
    this.punch.y += ((b[1] - a[1]) + (Math.random() - 0.5) * r.variance) * mul;
    this.recoilIndex += 1;
    // spray noise stays modest so the learnable pattern dominates
    this.fireInacc = Math.min(this.fireInacc + (def.spread.fire || 0), (def.spread.fire || 0) * 3.5 + 0.004);
    if (def.bolt) {
      w.boltEnd = t + def.bolt;
      this.resumeScope = this.scopeLevel;
      this.scopeLevel = 0;
    }
    this.game.onShot?.(this);
    if (w.ammo === 0 && w.reserve > 0 && this.isBot) this.startReload();
    return true;
  }

  /** View direction + full recoil punch, then a centre-weighted random cone. */
  shotDirection(inacc, def) {
    const yaw = this.yaw - this.punch.x * D2R;
    const pitch = this.pitch + this.punch.y * D2R;
    const cp = Math.cos(pitch);
    const dir = new THREE.Vector3(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    let r;
    if (def.pellets) r = Math.sqrt(Math.random()) * def.spread.pellet + Math.random() * inacc;
    else r = Math.random() * inacc;
    if (r > 0) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const up2 = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir.addScaledVector(right, Math.cos(a) * r).addScaledVector(up2, Math.sin(a) * r).normalize();
    }
    return dir;
  }

  // --- hits -------------------------------------------------------------------
  /** Ray vs head sphere / chest / stomach / legs. Returns { dist, zone } or null. */
  rayHit(origin, dir, maxDist) {
    if (!this.alive) return null;
    const p = this.pos;
    const headY = p.y + this.eyeHeight + 0.07;
    let best = null;
    const oc = new THREE.Vector3(origin.x - p.x, origin.y - headY, origin.z - p.z);
    const rH = 0.135;
    const bq = oc.dot(dir), cq = oc.lengthSq() - rH * rH;
    const disc = bq * bq - cq;
    if (disc >= 0) {
      const t = -bq - Math.sqrt(disc);
      if (t > 0 && t < maxDist) best = { dist: t, zone: 'head' };
    }
    const legTop = p.y + (0.85 - this.crouch * 0.38);
    const top = headY - 0.17;
    const mid = legTop + (top - legTop) * 0.42;
    const zones = [
      ['chest', p.x - 0.24, mid, p.z - 0.16, p.x + 0.24, top, p.z + 0.16],
      ['stomach', p.x - 0.2, legTop, p.z - 0.15, p.x + 0.2, mid, p.z + 0.15],
      ['leg', p.x - 0.2, p.y, p.z - 0.16, p.x + 0.2, legTop, p.z + 0.16],
    ];
    for (const [zone, x0, y0, z0, x1, y1, z1] of zones) {
      const t = rayBox(origin, dir, x0, y0, z0, x1, y1, z1);
      if (t !== null && t < maxDist && (!best || t < best.dist)) best = { dist: t, zone };
    }
    return best;
  }

  // --- visuals ------------------------------------------------------------------
  buildRig() {
    this.rig = new HumanRig(this);
    this.mesh = this.rig.root;
    this.refreshHeldModel();
  }

  refreshHeldModel() {
    if (!this.rig) return;
    const w = this.weapon;
    const model = w ? buildGunModel(w.id, TEAMS[this.team].accent) : null;
    if (model) model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.rig.setGun(model);
    this.heldModel = model;
    if (model) this.game.onHeldModel?.(this, model);
  }

  updateRig(dt) {
    if (this.stepSmooth) this.stepSmooth *= Math.exp(-14 * dt);
    this.rig.update(dt, this.game.time);
  }
}

export function rayBox(o, d, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity;
  const mins = [x0, y0, z0], maxs = [x1, y1, z1], os = [o.x, o.y, o.z], ds = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(ds[a]) < 1e-9) { if (os[a] < mins[a] || os[a] > maxs[a]) return null; continue; }
    let t1 = (mins[a] - os[a]) / ds[a], t2 = (maxs[a] - os[a]) / ds[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  if (tmax < 0) return null;
  return tmin > 0 ? tmin : null;
}

export { WEAPONS };
