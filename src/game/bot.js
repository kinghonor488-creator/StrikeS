// Bot brains + per-round team plans.
import * as THREE from 'three';
import { WEAPONS } from './weapons.js';
import { MOVE } from './character.js';
import { RULES } from './match.js';

const TAU = Math.PI * 2;
const wrap = (a) => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const DIFFICULTY = {
  easy: { react: [0.45, 0.75], turn: 4.5, err: 0.09, head: 0.15, spray: 0.4, strafe: 0.3 },
  normal: { react: [0.28, 0.5], turn: 7, err: 0.055, head: 0.3, spray: 0.65, strafe: 0.6 },
  hard: { react: [0.18, 0.32], turn: 10, err: 0.03, head: 0.5, spray: 0.85, strafe: 0.85 },
};

export class BotBrain {
  constructor(game, ch, difficulty = 'normal') {
    this.game = game;
    this.ch = ch;
    this.skill = { ...DIFFICULTY[difficulty] };
    // per-bot personality jitter
    this.skill.react = this.skill.react.map((v) => v * rand(0.85, 1.2));
    this.aggression = rand(0.3, 0.9);
    this.reset();
  }

  reset() {
    this.path = null; this.pathIdx = 0; this.goal = null; this.repathAt = 0;
    this.target = null; this.reactUntil = 0;
    this.lastSeen = null; this.lastSeenTime = -99;
    this.aimErr = new THREE.Vector2();
    this.lookYaw = this.ch.yaw; this.lookPitch = 0;
    this.strafeDir = 1; this.strafeUntil = 0;
    this.burstLeft = 0; this.burstPauseUntil = 0;
    this.nextPerceive = 0;
    this.stuckT = 0; this.lastPos = this.ch.pos.clone();
    this.waitUntil = 0;
    this.task = null;     // { type, ... } from team plan
    this.noise = null;    // { pos, time }
    this.holdSpot = null;
    this.bought = false;
  }

  // --- buying ---------------------------------------------------------------
  buy(match) {
    if (this.bought) return;
    this.bought = true;
    const c = this.ch;
    const g = this.game;
    const T = c.team === 'T';
    const pistolRound = match.round === 1 || match.round === RULES.halftime + 1;
    const mates = match.team(c.team);
    const teamMoney = mates.reduce((s, x) => s + x.money, 0) / Math.max(1, mates.length);
    const awper = mates.filter((m) => m.brain).sort((a, b) => a.id - b.id)[0] === c;
    if (pistolRound) {
      const r = Math.random();
      if (r < 0.45) g.buy(c, 'vest');
      else if (r < 0.7) g.buy(c, T ? 't9' : 'f7');
      else if (r < 0.85) g.buy(c, 'p25');
      else g.buy(c, 'd50');
      return;
    }
    const fullBuy = teamMoney >= 3800;
    const force = !fullBuy && (teamMoney >= 2200 || match.lossStreak[c.team] >= 3);
    if (!c.slots[1]) {
      if (fullBuy && c.money >= 5900 && (awper || Math.random() < 0.12)) g.buy(c, 'aw1');
      else if (fullBuy && c.money >= 4100) {
        const r = Math.random();
        g.buy(c, T ? (r < 0.8 ? 'k47' : 'sg5') : (r < 0.8 ? 'm4' : 'a3'));
      } else if (c.money >= 2700 && (fullBuy || force)) g.buy(c, T ? 'g35' : 'f25');
      else if (force && c.money >= 1800) {
        const r = Math.random();
        g.buy(c, r < 0.25 ? 's08' : r < 0.45 ? 'mp7' : r < 0.6 ? 'n7' : T ? 'm10' : 'mp9');
      }
    }
    if (c.slots[1] || fullBuy || force) {
      if (c.money >= 1000 && !(c.armor >= 100 && c.helmet)) g.buy(c, 'vesthelm');
      else if (c.money >= 650 && c.armor < 100) g.buy(c, 'vest');
    }
    if (!T && !c.kit && c.money >= 400 && c.slots[1] && Math.random() < 0.7) g.buy(c, 'kit');
    if (!c.slots[1] && c.money >= 700 && Math.random() < 0.4) g.buy(c, Math.random() < 0.5 ? 'd50' : 'p25');
    if (c.money >= 300 && c.ink < 70 && Math.random() < 0.5) g.buy(c, 'ink');
  }

  // --- perception -----------------------------------------------------------
  canSee(other) {
    const g = this.game;
    const eye = this.ch.eyePos();
    const to = other.eyePos();
    const d = eye.distanceTo(to);
    if (d > 85) return false;
    const fwd = this.ch.forward();
    const dir = to.clone().sub(eye).normalize();
    const fovCos = this.target === other ? -0.2 : Math.cos(THREE.MathUtils.degToRad(62));
    if (fwd.dot(dir) < fovCos && d > 3) return false;
    // check head, then chest
    if (g.lineOfSight(eye, to)) return true;
    const chest = other.pos.clone(); chest.y += 1.1 - other.crouch * 0.35;
    return g.lineOfSight(eye, chest);
  }

  perceive() {
    const g = this.game, c = this.ch;
    let best = null, bestD = Infinity;
    for (const o of g.chars) {
      if (!o.alive || o.team === c.team) continue;
      const d = o.pos.distanceTo(c.pos);
      if (d < bestD && this.canSee(o)) { best = o; bestD = d; }
    }
    const t = g.time;
    if (best) {
      if (best !== this.target) {
        const fresh = t - this.lastSeenTime > 1.2 || !this.target;
        this.reactUntil = t + (fresh ? rand(...this.skill.react) : rand(0.08, 0.16));
        const e = this.skill.err * (1 + bestD / 30);
        this.aimErr.set(rand(-e, e) * 2.2, rand(-e, e));
        this.burstLeft = 0;
        g.onBotSpot?.(this.ch, best);
      }
      this.target = best;
      this.lastSeen = best.pos.clone();
      this.lastSeenTime = t;
    } else {
      this.target = null;
    }
  }

  hear(pos, loudness = 1) {
    const d = pos.distanceTo(this.ch.pos);
    if (d > 32 * loudness) return;
    if (this.target) return;
    this.noise = { pos: pos.clone(), time: this.game.time };
  }

  onDamaged(attacker) {
    if (attacker && !this.target) {
      this.noise = { pos: attacker.pos.clone(), time: this.game.time };
      this.lastSeen = attacker.pos.clone();
      this.lastSeenTime = this.game.time - 0.5;
    }
    this.aimErr.multiplyScalar(1.6).addScalar(0.01);
  }

  // --- navigation -----------------------------------------------------------
  goTo(x, z, force = false) {
    const t = this.game.time;
    if (!force && this.goal && Math.hypot(this.goal[0] - x, this.goal[1] - z) < 0.8 && this.path) return;
    this.goal = [x, z];
    this.path = this.game.nav.findPath(this.ch.pos.x, this.ch.pos.z, x, z);
    this.pathIdx = 0;
    this.repathAt = t + 4;
  }

  atGoal(r = 1.2) {
    return this.goal && Math.hypot(this.goal[0] - this.ch.pos.x, this.goal[1] - this.ch.pos.z) < r;
  }

  steer() {
    // returns desired world move direction (unit) or null
    if (!this.path || this.pathIdx >= this.path.length) return null;
    const c = this.ch;
    let [wx, wz] = this.path[this.pathIdx];
    let dx = wx - c.pos.x, dz = wz - c.pos.z;
    let d = Math.hypot(dx, dz);
    while (d < 0.7 && this.pathIdx < this.path.length - 1) {
      this.pathIdx++;
      [wx, wz] = this.path[this.pathIdx];
      dx = wx - c.pos.x; dz = wz - c.pos.z; d = Math.hypot(dx, dz);
    }
    if (d < 0.5 && this.pathIdx >= this.path.length - 1) { this.path = null; return null; }
    return [dx / d, dz / d];
  }

  // --- main tick ------------------------------------------------------------
  think(dt) {
    const g = this.game, c = this.ch, t = g.time, m = g.match;
    const intent = { fwd: 0, right: 0, jump: false, crouch: false, walk: false, yaw: c.yaw, pitch: c.pitch, fire: false, use: false };
    if (!c.alive) return intent;

    if (m.phase === 'freeze') {
      this.buy(m);
      return intent;
    }
    if (m.phase !== 'live' && m.phase !== 'post') return intent;

    if (t >= this.nextPerceive) {
      this.nextPerceive = t + 0.09;
      this.perceive();
    }

    let moveDir = null;
    let lookAt = null;
    let wantWalk = false;
    const w = c.weapon;

    // weapon housekeeping
    if (c.slot !== 1 && c.slots[1] && !c.action) c.switchTo(1);
    if (c.slot === 3 && c.slots[2]) c.switchTo(2);
    if (w && w.def.mag && w.ammo === 0 && !w.reloadEnd) {
      if (w.reserve > 0) c.startReload();
      else if (c.slot === 1 && c.slots[2]) c.switchTo(2);
    }

    if (this.target && this.target.alive) {
      // --- combat
      const tgt = this.target;
      const aimPoint = tgt.eyePos();
      const headChance = this.skill.head;
      if (!this.aimHead) this.aimHead = Math.random() < headChance ? 1 : -1;
      if (this.aimHead < 0) aimPoint.y -= 0.42 + tgt.crouch * 0.1;
      lookAt = aimPoint;
      const dist = tgt.pos.distanceTo(c.pos);
      // move: strafe, or close in with knife/shotgun
      if (t > this.strafeUntil) {
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        this.strafeUntil = t + rand(0.35, 0.9);
        this.crouchSpray = Math.random() < 0.25 && dist > 12;
      }
      const toT = new THREE.Vector3().subVectors(tgt.pos, c.pos).setY(0).normalize();
      const side = new THREE.Vector3(-toT.z, 0, toT.x).multiplyScalar(this.strafeDir);
      const shooting = t > this.reactUntil;
      const cat = w?.def.cat;
      // rifles/snipers stop to shoot (counter-strafe); smgs and shotguns run and gun
      const counterStrafe = shooting && Math.random() < this.skill.spray && cat !== 'smg' && !w?.def.pellets;
      if (cat === 'knife' || (w?.def.pellets && dist > 9)) moveDir = [toT.x, toT.z];
      else if (!counterStrafe || this.burstPauseUntil > t) moveDir = Math.random() < this.skill.strafe ? [side.x, side.z] : null;
      this.wantCrouch = shooting && this.crouchSpray && cat === 'rifle';
      if (w?.def.scope && !c.scoped && dist > (cat === 'sniper' ? 7 : 20) && !w.boltEnd) c.scopeLevel = 1;
    } else if (this.lastSeen && t - this.lastSeenTime < 3.5) {
      // --- recently lost contact: peek where they were (aggressive) or hold the angle
      lookAt = this.lastSeen.clone().setY(1.5);
      if (this.aggression > 0.55 && !this.taskLocked()) {
        this.goTo(this.lastSeen.x, this.lastSeen.z);
        moveDir = this.steer();
        wantWalk = true;
      }
      this.aimHead = 0;
    } else {
      this.aimHead = 0;
      this.target = null;
      if (c.scoped && Math.random() < 0.02) c.scopeLevel = 0;
      // --- objective / task
      const r = this.runTask(dt);
      moveDir = r.moveDir; lookAt = r.lookAt; wantWalk = r.walk;
      if (r.use) intent.use = true;
      if (this.noise && t - this.noise.time < 2.5 && !r.busy) lookAt = this.noise.pos.clone().setY(1.5);
    }

    // --- look smoothing
    const eye = c.eyePos();
    let desiredYaw = this.lookYaw, desiredPitch = 0;
    if (lookAt) {
      const d = lookAt.clone().sub(eye);
      desiredYaw = Math.atan2(-d.x, -d.z);
      desiredPitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    } else if (moveDir) {
      desiredYaw = Math.atan2(-moveDir[0], -moveDir[1]);
    }
    if (this.target) {
      // tracking error decays while the bot keeps eyes on the target
      this.aimErr.multiplyScalar(Math.exp(-dt * (1.8 + this.skill.turn * 0.25)));
      desiredYaw += this.aimErr.x;
      desiredPitch += this.aimErr.y;
      // compensate recoil (imperfectly)
      // bullets follow view + punch, so pull against the spray (imperfectly)
      desiredPitch -= THREE.MathUtils.degToRad(c.punch.y) * this.skill.spray;
      desiredYaw += THREE.MathUtils.degToRad(c.punch.x) * this.skill.spray * 0.85;
    }
    const turn = this.target ? this.skill.turn : 5;
    const dy = wrap(desiredYaw - this.lookYaw);
    this.lookYaw = wrap(this.lookYaw + dy * Math.min(1, dt * turn));
    this.lookPitch += (desiredPitch - this.lookPitch) * Math.min(1, dt * turn);
    intent.yaw = this.lookYaw;
    intent.pitch = THREE.MathUtils.clamp(this.lookPitch, -1.4, 1.4);

    // --- fire decision
    if (this.target && t > this.reactUntil && w) {
      const err = Math.abs(wrap(desiredYaw - this.lookYaw)) + Math.abs(desiredPitch - this.lookPitch);
      const dist = this.target.pos.distanceTo(c.pos);
      const tol = 0.04 + 1.2 / Math.max(dist, 1) * 0.12;
      if (err < tol || dist < 3) {
        if (w.def.cat === 'knife') intent.fire = dist < 2;
        else if (w.def.cat === 'ink') { if (c.slots[1]) c.switchTo(1); else c.switchTo(2); }
        else if (w.def.auto) {
          if (t > this.burstPauseUntil) {
            if (this.burstLeft <= 0) this.burstLeft = dist > 25 ? 3 : dist > 12 ? 6 : 12;
            intent.fire = true;
          }
        } else intent.fire = true;
      }
    }

    // --- movement → local intent
    if (moveDir) {
      const sy = Math.sin(intent.yaw), cy = Math.cos(intent.yaw);
      const fx = -sy, fz = -cy, rx = cy, rz = -sy;
      intent.fwd = moveDir[0] * fx + moveDir[1] * fz;
      intent.right = moveDir[0] * rx + moveDir[1] * rz;
    }
    intent.walk = wantWalk;
    intent.crouch = !!this.wantCrouch && !!this.target;

    // stuck handling
    if (moveDir && c.onGround) {
      const moved = c.pos.distanceTo(this.lastPos);
      if (moved < 0.6 * dt * MOVE.run * 0.2) this.stuckT += dt; else this.stuckT = Math.max(0, this.stuckT - dt);
      if (this.stuckT > 0.6) { intent.jump = true; }
      if (this.stuckT > 1.4 && this.goal) { this.goTo(this.goal[0], this.goal[1], true); this.stuckT = 0; }
    }
    this.lastPos.copy(c.pos);
    return intent;
  }

  afterShot() {
    const w = this.ch.weapon;
    if (w?.def.auto) {
      this.burstLeft--;
      if (this.burstLeft <= 0) this.burstPauseUntil = this.game.time + rand(0.15, 0.4) / this.skill.spray;
    }
  }

  taskLocked() {
    return this.task && (this.task.type === 'plant' || this.task.type === 'defuse');
  }

  /** Objective behaviour. Returns { moveDir, lookAt, walk, use, busy }. */
  runTask() {
    const g = this.game, c = this.ch, m = g.match, t = g.time, bomb = m.bomb;
    const out = { moveDir: null, lookAt: null, walk: false, use: false, busy: false };
    const task = this.task || { type: 'roam' };

    // universal reactions to the bomb
    if (c.team === 'T') {
      if (bomb.state === 'dropped' && this.isNearestT(bomb.pos)) {
        this.goTo(bomb.pos.x, bomb.pos.z);
        out.moveDir = this.steer();
        return out;
      }
      if (c.hasBomb && (task.type !== 'plant')) this.task = { type: 'plant', site: g.teamPlan.T?.site || 'A' };
      if (bomb.state === 'planted') {
        // guard the bomb
        if (!this.holdSpot || this.holdSpot.site !== bomb.site) {
          const spots = g.map.spots[bomb.site + '_hold'];
          const s = pick(spots);
          const [x, z] = g.nav.randomWalkableNear(s[0], s[1], 2);
          this.holdSpot = { x, z, site: bomb.site };
        }
        this.goTo(this.holdSpot.x, this.holdSpot.z);
        out.moveDir = this.steer();
        out.walk = !!out.moveDir && Math.random() < 0.3;
        if (!out.moveDir) out.lookAt = this.watchPoint(bomb.site, 'T');
        return out;
      }
    } else {
      if (bomb.state === 'planted') {
        const d = Math.hypot(c.pos.x - bomb.pos.x, c.pos.z - bomb.pos.z);
        const iAmDefuser = this.isNearestCT(bomb.pos);
        if (iAmDefuser && (d < 1.4)) {
          out.use = true; out.busy = true;
          out.lookAt = bomb.pos.clone().setY(0.4);
          return out;
        }
        if (iAmDefuser || d > 12) {
          this.goTo(bomb.pos.x, bomb.pos.z);
          out.moveDir = this.steer();
          return out;
        }
        out.lookAt = this.watchPoint(bomb.site, 'CT');
        return out;
      }
    }

    switch (task.type) {
      case 'plant': {
        const site = g.map.sites[task.site];
        if (!task.spot) {
          task.spot = [site.x1 + (site.x2 - site.x1) * rand(0.3, 0.7), site.z1 + (site.z2 - site.z1) * rand(0.3, 0.7)];
          const [x, z] = g.nav.randomWalkableNear(task.spot[0], task.spot[1], 2);
          task.spot = [x, z];
        }
        // wait for the team to start the execute
        if (g.teamPlan.T && t < g.teamPlan.T.executeAt) {
          this.goTo(...g.teamPlan.T.staging);
          out.moveDir = this.steer();
          return out;
        }
        if (m.siteAt(c.pos) === task.site && Math.hypot(c.pos.x - task.spot[0], c.pos.z - task.spot[1]) < 2.5) {
          out.use = true; out.busy = true;
          return out;
        }
        this.goTo(task.spot[0], task.spot[1]);
        out.moveDir = this.steer();
        return out;
      }
      case 'execute': {
        const plan = g.teamPlan.T;
        if (t < plan.executeAt) {
          if (!this.stagingSpot) this.stagingSpot = g.nav.randomWalkableNear(plan.staging[0], plan.staging[1], 2.5);
          this.goTo(...this.stagingSpot);
          out.moveDir = this.steer();
          out.walk = !!out.moveDir && Math.hypot(c.pos.x - plan.staging[0], c.pos.z - plan.staging[1]) < 10;
          if (!out.moveDir) out.lookAt = new THREE.Vector3(plan.entry[0], 1.6, plan.entry[1]);
          return out;
        }
        if (!this.clearSpot) {
          const s = pick(g.map.spots[plan.site + '_hold']);
          this.clearSpot = g.nav.randomWalkableNear(s[0], s[1], 2);
        }
        this.goTo(...this.clearSpot);
        out.moveDir = this.steer();
        if (!out.moveDir) out.lookAt = this.watchPoint(plan.site, 'T');
        return out;
      }
      case 'lurk': {
        if (!this.lurkSpot) this.lurkSpot = g.nav.randomWalkableNear(...pick(g.map.spots.mid), 3);
        this.goTo(...this.lurkSpot);
        out.moveDir = this.steer();
        out.walk = true;
        if (!out.moveDir) {
          out.lookAt = new THREE.Vector3(0, 1.6, -28);
          if (g.teamPlan.T && t > g.teamPlan.T.executeAt + 6) { this.task = { type: 'execute' }; }
        }
        return out;
      }
      case 'hold': {
        if (!this.holdSpot || this.holdSpot.key !== task.key) {
          const [x, z] = g.nav.randomWalkableNear(task.spot[0], task.spot[1], 1.5);
          this.holdSpot = { x, z, key: task.key };
        }
        this.goTo(this.holdSpot.x, this.holdSpot.z);
        out.moveDir = this.steer();
        if (!out.moveDir) {
          out.lookAt = new THREE.Vector3(task.watch[0], 1.6, task.watch[1]);
          // drift the view a little so holders don't look frozen
          out.lookAt.x += Math.sin(t * 0.7 + this.ch.id) * 2;
        }
        return out;
      }
      case 'rotate': {
        this.goTo(...task.spot);
        out.moveDir = this.steer();
        if (!out.moveDir) this.task = { type: 'hold', key: 'rot' + task.site, spot: task.spot, watch: task.watch };
        return out;
      }
      default: {
        if (!this.path || this.atGoal()) {
          const [x, z] = g.nav.randomWalkableNear(0, 0, 30);
          this.goTo(x, z);
        }
        out.moveDir = this.steer();
        return out;
      }
    }
  }

  watchPoint(site, team) {
    const s = this.game.map.spots;
    const entries = site === 'A' ? [s.A_entry_long, s.A_entry_short] : [s.B_entry_alley, s.B_entry_conn];
    const e = entries[(this.ch.id + Math.floor(this.game.time / 6)) % entries.length];
    return new THREE.Vector3(e[0], 1.6, e[1]);
  }

  isNearestT(pos) {
    let best = null, bd = Infinity;
    for (const c of this.game.match.alive('T')) {
      const d = c.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = c; }
    }
    return best === this.ch;
  }

  isNearestCT(pos) {
    let best = null, bd = Infinity;
    for (const c of this.game.match.alive('CT')) {
      const d = c.pos.distanceTo(pos);
      if (d < bd) { bd = d; best = c; }
    }
    return best === this.ch;
  }
}

/** Decide both teams' round strategy and hand out tasks. */
export function planRound(game) {
  const m = game.match, s = game.map.spots;
  const site = Math.random() < 0.5 ? 'A' : 'B';
  const route = site === 'A'
    ? (Math.random() < 0.6 ? { staging: [-40, 6], entry: s.A_entry_long } : { staging: [-6, -2], entry: s.A_entry_short })
    : (Math.random() < 0.6 ? { staging: [36, 4], entry: s.B_entry_alley } : { staging: [6, -2], entry: s.B_entry_conn });
  game.teamPlan = {
    T: { site, staging: route.staging, entry: route.entry, executeAt: game.time + RULES.freeze + rand(14, 30) },
  };

  const ts = m.team('T');
  const lurker = ts.length > 3 ? ts[Math.floor(Math.random() * ts.length)] : null;
  for (const c of ts) {
    if (!c.brain) continue;
    c.brain.reset();
    if (c.hasBomb) c.brain.task = { type: 'plant', site };
    else if (c === lurker) c.brain.task = { type: 'lurk' };
    else c.brain.task = { type: 'execute' };
  }

  // CT: 2 A, 2 B, 1 mid (shuffled), watching the obvious entries
  const cts = m.team('CT').filter((c) => c.brain);
  const roles = [
    { key: 'A1', spot: s.CT_A_guard[0], watch: s.A_entry_short },
    { key: 'A2', spot: s.CT_A_guard[1], watch: s.A_entry_long },
    { key: 'B1', spot: s.CT_B_guard[0], watch: s.B_entry_conn },
    { key: 'B2', spot: s.CT_B_guard[1], watch: s.B_entry_alley },
    { key: 'M', spot: s.mid_guard[Math.floor(Math.random() * 2)], watch: [0, 6] },
  ].sort(() => Math.random() - 0.5);
  cts.forEach((c, i) => {
    c.brain.reset();
    const r = roles[i % roles.length];
    c.brain.task = { type: 'hold', ...r };
  });
}

/** When a site is under attack, pull some defenders over. */
export function callRotate(game, site) {
  const m = game.match, s = game.map.spots;
  const guard = site === 'A' ? s.CT_A_guard : s.CT_B_guard;
  const watch = site === 'A' ? s.A_entry_long : s.B_entry_alley;
  let n = 0;
  for (const c of m.alive('CT')) {
    if (!c.brain || c.brain.target) continue;
    const key = c.brain.task?.key || '';
    if (key.startsWith(site)) continue;
    if (n++ >= 2) break;
    c.brain.task = { type: 'rotate', site, spot: pick(guard), watch };
  }
}

export { WEAPONS };
