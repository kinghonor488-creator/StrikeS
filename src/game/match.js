// Round flow, economy and the ink bomb.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeWeaponState, DEFAULT_PISTOL } from './weapons.js';

export const RULES = {
  freeze: 6,
  roundTime: 115,
  buyWindow: 20,           // seconds into the round buying stays open
  bombTime: 40,
  plantTime: 3.2,
  defuseTime: 7,
  defuseKitTime: 3.6,
  postRound: 5.5,
  winRounds: 7,
  halftime: 6,             // swap sides after this many rounds
  startMoney: 800,
  maxMoney: 16000,
  winReward: { elim: 3250, bomb: 3500, defuse: 3500, time: 3250 },
  lossBase: 1400, lossStep: 500, lossMax: 3400,
  plantReward: 300,
  explosionRadius: 17,
  startInk: 40,
};

export class Bomb {
  constructor(game) {
    this.game = game;
    this.state = 'carried';    // carried | dropped | planted | defused | exploded
    this.carrier = null;
    this.pos = new THREE.Vector3();
    this.site = null;
    this.plantedAt = 0;
    this.defuser = null;
    this.nextBeep = 0;
    this.mesh = this.buildMesh();
    this.mesh.visible = false;
    game.scene.add(this.mesh);
  }

  buildMesh() {
    // "Ink bomb": a pressurised ink canister strapped to a timer pack
    const g = new THREE.Group();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    const canMat = std({ color: '#2a2440', metalness: 0.6, roughness: 0.35 });
    const strap = std({ color: '#1b1b1d', roughness: 0.9 });
    const pack = std({ color: '#3b3f45', roughness: 0.6, metalness: 0.2 });
    for (const x of [-0.11, 0.11]) {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.42, 20).rotateZ(Math.PI / 2), canMat);
      can.position.set(0, 0.11, x * 1.0);
      can.castShadow = true;
      g.add(can);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.05, 16).rotateZ(Math.PI / 2), std({ color: '#c9302c', roughness: 0.4 }));
      cap.position.set(0.235, 0.11, x);
      g.add(cap);
    }
    for (const x of [-0.12, 0.12]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.24, 0.48), strap);
      s.position.set(x, 0.11, 0);
      g.add(s);
    }
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.08, 0.16, 2, 0.015), pack);
    box.position.set(0, 0.25, 0);
    box.castShadow = true;
    g.add(box);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.035), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 0.5) }));
    screen.rotation.x = -Math.PI / 2;
    screen.position.set(0.02, 0.292, -0.02);
    g.add(screen);
    for (let i = 0; i < 6; i++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.018), std({ color: '#d9d4c7', roughness: 0.5 }));
      key.position.set(-0.06 + (i % 3) * 0.025, 0.293, 0.035 + Math.floor(i / 3) * 0.025);
      g.add(key);
    }
    const wire = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 6, 20, Math.PI), std({ color: '#d02a2a', roughness: 0.5 }));
    wire.position.set(-0.05, 0.22, 0); wire.rotation.y = Math.PI / 2;
    g.add(wire);
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.4, 0.3) }));
    this.led.position.set(0.08, 0.3, 0.05);
    g.add(this.led);
    return g;
  }

  reset() {
    this.state = 'carried'; this.carrier = null; this.site = null; this.defuser = null;
    this.mesh.visible = false;
  }

  drop(pos) {
    this.state = 'dropped';
    if (this.carrier) this.carrier.hasBomb = false;
    this.carrier = null;
    this.pos.set(pos.x, 0, pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, Math.random() * 6, 0.4);
    this.mesh.visible = true;
  }

  pickup(ch) {
    this.state = 'carried';
    this.carrier = ch;
    ch.hasBomb = true;
    this.mesh.visible = false;
  }

  plant(ch, site) {
    this.state = 'planted';
    this.site = site;
    ch.hasBomb = false;
    this.carrier = null;
    this.pos.set(ch.pos.x, ch.pos.y, ch.pos.z);
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, ch.yaw, 0);
    this.mesh.visible = true;
    this.plantedAt = this.game.time;
    this.nextBeep = this.game.time;
  }

  get remaining() { return this.state === 'planted' ? Math.max(0, RULES.bombTime - (this.game.time - this.plantedAt)) : 0; }

  update() {
    if (this.state === 'dropped') this.mesh.rotation.y += 0.01;
    if (this.state !== 'planted') { this.led.visible = false; return; }
    const t = this.game.time;
    const rem = this.remaining;
    const urgency = 1 - rem / RULES.bombTime;
    this.led.visible = t - this.nextBeep > -0.08;
    if (t >= this.nextBeep) {
      this.game.audio?.bombBeep(this.pos, urgency);
      this.nextBeep = t + (rem > 10 ? 1.0 : rem > 5 ? 0.5 : rem > 2 ? 0.25 : 0.12);
      this.led.visible = true;
    }
    void urgency;
  }
}

export class Match {
  constructor(game) {
    this.game = game;
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.phase = 'idle';  // idle | freeze | live | post | over
    this.phaseEnd = 0;
    this.roundStart = 0;
    this.bomb = new Bomb(game);
    this.history = [];    // per-round summary for the comic recap
    this.winner = null;
  }

  get chars() { return this.game.chars; }
  team(t) { return this.chars.filter((c) => c.team === t); }
  alive(t) { return this.chars.filter((c) => c.team === t && c.alive); }

  timeLeft() {
    const t = this.game.time;
    if (this.phase === 'freeze') return this.phaseEnd - t;
    if (this.phase === 'live') return this.bomb.state === 'planted' ? this.bomb.remaining : Math.max(0, this.phaseEnd - t);
    if (this.phase === 'post') return this.phaseEnd - t;
    return 0;
  }

  canBuy(ch) {
    if (!ch.alive) return false;
    const t = this.game.time;
    const inTime = this.phase === 'freeze' || (this.phase === 'live' && t - this.roundStart < RULES.buyWindow);
    if (!inTime) return false;
    const spawn = this.game.map.spawns[ch.team];
    let near = false;
    for (const [x, z] of spawn) if (Math.hypot(ch.pos.x - x, ch.pos.z - z) < 14) { near = true; break; }
    return near;
  }

  start() {
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.history = [];
    this.winner = null;
    for (const c of this.chars) {
      c.money = RULES.startMoney;
      c.stats = { kills: 0, deaths: 0, assists: 0, hs: 0, dmg: 0 };
    }
    this.startRound(true);
  }

  startRound(fresh = false) {
    const g = this.game;
    this.round++;
    this.phase = 'freeze';
    this.phaseEnd = g.time + RULES.freeze;
    this.roundEvents = [];
    this.bomb.reset();
    g.onRoundReset?.();

    for (const team of ['T', 'CT']) {
      const spawns = [...g.map.spawns[team]].sort(() => Math.random() - 0.5);
      this.team(team).forEach((c, i) => {
        const [x, z] = spawns[i % spawns.length];
        const survived = c.alive && !fresh;
        c.pos.set(x + (Math.random() - 0.5) * 0.6, 0, z + (Math.random() - 0.5) * 0.6);
        c.vel.set(0, 0, 0);
        // face the team's way out of spawn
        const ex = 0, ez = team === 'T' ? 18 : -18;
        c.yaw = Math.atan2(-(ex - c.pos.x), -(ez - c.pos.z));
        c.pitch = 0;
        c.alive = true;
        c.hp = 100;
        c.action = null;
        c.scopeLevel = 0;
        c.hasBomb = false;
        c.punch.set(0, 0);
        c.recoilIndex = 0; c.airPenalty = 0;
        c.damageBy.clear();
        c.roundKills = 0;
        c.roundKillMarks = [];
        c.crouching = false; c.crouch = 0;
        if (!survived) {
          c.slots = { 1: null, 2: makeWeaponState(DEFAULT_PISTOL[team]), 3: makeWeaponState('knife'), 4: makeWeaponState('inkpen') };
          c.armor = 0; c.helmet = false; c.kit = false;
        } else {
          // refill ammo for kept guns
          for (const s of [1, 2]) {
            const w = c.slots[s];
            if (w) { w.ammo = w.def.mag; w.reserve = w.def.reserve; w.reloading = false; w.reloadEnd = 0; w.boltEnd = 0; }
          }
        }
        c.slot = c.slots[1] ? 1 : 2;
        c.ink = Math.max(c.ink ?? 0, RULES.startInk);
        if (fresh) c.ink = RULES.startInk;
        c.refreshHeldModel();
      });
    }
    // hand the bomb to a random attacker (prefer bots so the human can choose to grab it)
    const ts = this.team('T');
    if (ts.length) {
      const carrier = ts[Math.floor(Math.random() * ts.length)];
      this.bomb.pickup(carrier);
    }
    g.onRoundStart?.(this.round);
  }

  update(dt) {
    const g = this.game, t = g.time;
    this.bomb.update();
    if (this.phase === 'freeze' && t >= this.phaseEnd) {
      this.phase = 'live';
      this.roundStart = t;
      this.phaseEnd = t + RULES.roundTime;
      g.onLive?.();
    } else if (this.phase === 'live') {
      this.updateActions(dt);
      this.checkWin();
    } else if (this.phase === 'post' && t >= this.phaseEnd) {
      if (this.winner) { this.phase = 'over'; g.onMatchEnd?.(this.winner); return; }
      if (this.round === RULES.halftime) this.swapSides();
      this.startRound();
    }
    // bomb pickup by walking over it
    if (this.bomb.state === 'dropped' && this.phase !== 'post') {
      for (const c of this.alive('T')) {
        if (Math.hypot(c.pos.x - this.bomb.pos.x, c.pos.z - this.bomb.pos.z) < 1.0) {
          this.bomb.pickup(c);
          g.onBombPickup?.(c);
          break;
        }
      }
    }
  }

  siteAt(pos) {
    for (const [id, s] of Object.entries(this.game.map.sites)) {
      if (pos.x > s.x1 && pos.x < s.x2 && pos.z > s.z1 && pos.z < s.z2) return id;
    }
    return null;
  }

  /** Start/continue a plant or defuse for `ch`. Call every frame while held. */
  use(ch, holding) {
    if (this.phase !== 'live' || !ch.alive) return;
    const t = this.game.time;
    if (!holding) {
      if (ch.action) this.cancelAction(ch);
      return;
    }
    if (ch.action) return;
    if (ch.team === 'T' && ch.hasBomb && ch.onGround) {
      const site = this.siteAt(ch.pos);
      if (site) {
        ch.action = { type: 'plant', t0: t, dur: RULES.plantTime, site };
        ch.vel.set(0, ch.vel.y, 0);
        this.game.audio?.plantStart(ch.pos);
        this.game.onActionStart?.(ch);
      }
    } else if (ch.team === 'CT' && this.bomb.state === 'planted' && !this.bomb.defuser) {
      if (ch.pos.distanceTo(this.bomb.pos) < 1.8) {
        ch.action = { type: 'defuse', t0: t, dur: ch.kit ? RULES.defuseKitTime : RULES.defuseTime };
        this.bomb.defuser = ch;
        this.game.audio?.defuseStart(this.bomb.pos);
        this.game.onActionStart?.(ch);
      }
    }
  }

  cancelAction(ch) {
    if (ch.action?.type === 'defuse' && this.bomb.defuser === ch) this.bomb.defuser = null;
    ch.action = null;
  }

  updateActions() {
    const t = this.game.time;
    for (const c of this.chars) {
      if (!c.action) continue;
      if (!c.alive) { this.cancelAction(c); continue; }
      if (t - c.action.t0 >= c.action.dur) {
        const a = c.action;
        c.action = null;
        if (a.type === 'plant') {
          this.bomb.plant(c, a.site);
          c.money = Math.min(RULES.maxMoney, c.money + RULES.plantReward);
          this.roundEvents.push({ type: 'plant', who: c.name, team: c.team, site: a.site, t });
          this.game.audio?.plantDone(this.bomb.pos);
          this.game.onPlant?.(c, a.site);
        } else if (a.type === 'defuse') {
          this.bomb.state = 'defused';
          this.bomb.defuser = null;
          this.roundEvents.push({ type: 'defuse', who: c.name, team: c.team, t });
          this.game.audio?.defused(this.bomb.pos);
          this.game.onDefuse?.(c);
          this.endRound('CT', 'defuse', c);
        }
      }
    }
  }

  checkWin() {
    if (this.phase !== 'live') return;
    const t = this.game.time;
    const aliveT = this.alive('T').length, aliveCT = this.alive('CT').length;
    if (this.bomb.state === 'planted') {
      if (this.bomb.remaining <= 0) {
        this.bomb.state = 'exploded';
        this.bomb.mesh.visible = false;
        this.game.onExplode?.(this.bomb.pos.clone());
        // blast damage
        for (const c of this.chars) {
          if (!c.alive) continue;
          const d = c.pos.distanceTo(this.bomb.pos);
          if (d < RULES.explosionRadius * 1.6) {
            const dmg = 500 * Math.exp(-(d * d) / (2 * (RULES.explosionRadius / 2.4) ** 2));
            if (dmg > 1) this.game.applyDamage(c, null, dmg, 'body', { id: 'bomb', name: '墨爆罐', armorPen: 0.6 });
          }
        }
        this.endRound('T', 'bomb');
        return;
      }
      if (aliveCT === 0) { this.endRound('T', 'elim'); return; }
    } else {
      if (aliveT === 0 && aliveCT > 0) { this.endRound('CT', 'elim'); return; }
      if (aliveCT === 0 && aliveT > 0) { this.endRound('T', 'elim'); return; }
      if (t >= this.phaseEnd) { this.endRound('CT', 'time'); return; }
    }
  }

  endRound(winTeam, reason, hero = null) {
    if (this.phase !== 'live') return;
    const g = this.game;
    this.phase = 'post';
    this.phaseEnd = g.time + RULES.postRound;
    this.score[winTeam]++;
    const lose = winTeam === 'T' ? 'CT' : 'T';
    this.lossStreak[winTeam] = 0;
    this.lossStreak[lose] = Math.min(this.lossStreak[lose] + 1, 5);
    const reward = RULES.winReward[reason] ?? 3250;
    const lossBonus = Math.min(RULES.lossMax, RULES.lossBase + RULES.lossStep * (this.lossStreak[lose] - 1));
    for (const c of this.chars) {
      let add = c.team === winTeam ? reward : lossBonus;
      // attackers who survive a lost time-out get nothing (genre convention)
      if (c.team === 'T' && winTeam === 'CT' && reason === 'time' && c.alive) add = 0;
      c.money = Math.min(RULES.maxMoney, c.money + add);
      if (c.action) this.cancelAction(c);
    }
    // MVP = most kills this round on the winning side, or the hero
    let mvp = hero;
    if (!mvp) {
      mvp = this.team(winTeam).sort((a, b) => (b.roundKills || 0) - (a.roundKills || 0))[0] || null;
    }
    this.history.push({
      round: this.round, winner: winTeam, reason, mvp: mvp?.name, mvpTeam: mvp?.team,
      events: this.roundEvents, score: { ...this.score },
    });
    if (this.score[winTeam] >= RULES.winRounds) this.winner = winTeam;
    g.onRoundEnd?.(winTeam, reason, mvp);
  }

  swapSides() {
    for (const c of this.chars) {
      c.team = c.team === 'T' ? 'CT' : 'T';
      c.money = RULES.startMoney;
      c.alive = false; // forces a fresh loadout
      c.slots = { 1: null, 2: makeWeaponState(DEFAULT_PISTOL[c.team]), 3: makeWeaponState('knife'), 4: makeWeaponState('inkpen') };
      c.armor = 0; c.helmet = false; c.kit = false;
      this.game.rebuildRig?.(c);
    }
    const s = this.score;
    this.score = { T: s.CT, CT: s.T };
    this.lossStreak = { T: 0, CT: 0 };
    this.game.onHalftime?.();
  }
}
