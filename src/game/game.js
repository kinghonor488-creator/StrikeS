// The hub: owns the scene, characters, rules and every subsystem; runs the frame.
import * as THREE from 'three';
import { GameRenderer, LAYER_FX } from '../render/renderer.js';
import { createSky, bakeEnvironment, SKY } from '../render/sky.js';
import { MAP } from '../world/mapData.js';
import { buildMap } from '../world/buildMap.js';
import { FX } from './fx.js';
import { ViewModel } from './viewmodel.js';
import { Input } from './input.js';
import { Character, TEAMS } from './character.js';
import { Match, RULES } from './match.js';
import { BotBrain, planRound, callRotate } from './bot.js';
import { WEAPONS, GEAR, availableTo } from './weapons.js';
import { InkSystem } from './ink.js';
import { StickerStore } from './stickers.js';
import { HUD } from '../ui/hud.js';
import { ComicText } from '../ui/comicText.js';
import { PanelDirector } from '../ui/panels.js';
import { GameAudio } from '../audio/audio.js';

export const LAYER_SELF = 3; // own body: casts shadows, hidden from own camera

const BOT_NAMES = {
  T: ['马克笔', '蜡笔头', '喷漆罐', '炭条', '荧光笔', '圆珠笔'],
  CT: ['橡皮', '修正带', '涂改液', '白板擦', '卷笔刀', '三角尺'],
};
const KILL_WORDS = ['KAPOW!', 'K.O.!', 'ZONK!', 'SPLAT!'];
const HEAD_WORDS = ['KRAK!', 'BONK!', 'DINK!'];
const ZONE_MULT = { head: 4, chest: 1, stomach: 1.25, leg: 0.75 };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function setLayer(obj, layer) { obj.traverse((o) => o.layers.set(layer)); }

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.time = 0;
    this.timeScale = 1;
    this.settings = Object.assign({
      sens: 1.0, volume: 0.8, fov: 74, quality: 'high', difficulty: 'normal',
      panelCuts: true, comicFx: true, crosshair: 'dynamic', crossColor: '#5dff7a',
    }, JSON.parse(localStorage.getItem('strikes.settings') || '{}'));

    this.cr = new GameRenderer(canvas, { quality: this.settings.quality });
    this.qualityName = this.settings.quality;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, innerWidth / innerHeight, 0.05, 600);
    this.camera.rotation.order = 'YXZ';
    this.camera.layers.enable(LAYER_FX); // sky, particles and decals (excluded from AO only)
    this.scene.add(createSky());
    this.scene.environment = bakeEnvironment(this.cr.renderer);
    this.scene.environmentIntensity = 0.75;
    this.scene.fog = new THREE.Fog(SKY.fog, 90, 420);

    // warm afternoon sun + sky/ground bounce
    this.scene.add(new THREE.HemisphereLight(0xcfe2ff, 0x8a7560, 0.55));
    const sun = new THREE.DirectionalLight(0xffefd6, 2.9);
    sun.position.copy(SKY.sunDir).multiplyScalar(110);
    sun.castShadow = true;
    const sc = sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 10; sc.far = 260;
    sun.shadow.mapSize.set(this.cr.quality.shadow, this.cr.quality.shadow);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2;
    sc.layers.enable(LAYER_SELF);
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.cr.onQuality = (q) => {
      sun.shadow.mapSize.set(q.shadow, q.shadow);
      sun.shadow.map?.dispose(); sun.shadow.map = null;
    };

    this.map = MAP;
    const { world, nav } = buildMap(MAP, this.scene);
    this.world = world;
    this.nav = nav;

    this.input = new Input(canvas);
    this.audio = new GameAudio();
    this.stickers = new StickerStore();
    this.fx = new FX(this.scene);
    this.vm = new ViewModel(this);
    this.vm.scene.environment = this.scene.environment;
    this.hud = new HUD(this, uiRoot);
    this.sfx = new ComicText(uiRoot, this);
    this.ink = new InkSystem(this);
    this.panels = new PanelDirector(this, uiRoot);

    this.chars = [];
    this.player = null;
    this.viewTarget = null;
    this.match = new Match(this);
    this.teamPlan = {};
    this.menuOpen = false;
    this.running = false;
    this.shake = 0;
    this.camKick = { pitch: [0, 0], roll: [0, 0], fov: 0 }; // per-shot view jolt, visual only
    this.deathCam = null;
    this.camDip = 0;
    this.lastRotateCall = { A: -99, B: -99 };
    this.applySettings();
  }

  applySettings() {
    const s = this.settings;
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.input.sensitivity = s.sens;
    this.audio.setVolume(s.volume);
    if (this.cr.quality !== undefined && this.qualityName !== s.quality) {
      this.qualityName = s.quality;
      this.cr.setQuality(s.quality);
    }
    localStorage.setItem('strikes.settings', JSON.stringify(s));
  }

  // --- setup --------------------------------------------------------------
  newMatch({ side = 'T', difficulty = this.settings.difficulty, playerName = '你' } = {}) {
    for (const c of this.chars) this.scene.remove(c.mesh);
    this.chars = [];
    this.fx.clearDecals();
    this.ink.clear();
    this.panels.reset();
    const mk = (opts) => { const c = new Character(this, opts); this.chars.push(c); this.scene.add(c.mesh); return c; };
    this.player = mk({ name: playerName, team: side, isBot: false });
    for (const team of ['T', 'CT']) {
      const n = team === side ? 4 : 5;
      for (let i = 0; i < n; i++) {
        const c = mk({ name: BOT_NAMES[team][i], team, isBot: true });
        c.brain = new BotBrain(this, c, difficulty);
      }
    }
    this.setViewTarget(this.player);
    this.vm.setTeam(this.player.team);
    this.match.start();
    this.running = true;
  }

  rebuildRig(c) {
    this.scene.remove(c.mesh);
    c.buildRig();
    this.scene.add(c.mesh);
    if (c === this.viewTarget) setLayer(c.mesh, LAYER_SELF);
    if (c === this.player) this.vm.setTeam(c.team);
  }

  setViewTarget(c) {
    if (this.viewTarget && this.viewTarget !== c) setLayer(this.viewTarget.mesh, 0);
    this.viewTarget = c;
    if (c) {
      setLayer(c.mesh, LAYER_SELF);
      this.vm.setTeam(c.team);
      this.vm.setWeapon(c.weapon?.id, true);
    }
  }

  // --- combat -------------------------------------------------------------
  lineOfSight(a, b) {
    return this.world.visible(a, b, (box) => box.blocksBullets) && !this.ink.blocksVision(a, b);
  }

  muzzleWorld(ch) {
    if (ch === this.viewTarget && !this.deathCam) {
      const f = new THREE.Vector3(), r = new THREE.Vector3(), u = new THREE.Vector3();
      this.camera.matrixWorld.extractBasis(r, u, f);
      return this.camera.position.clone().addScaledVector(f, -0.65).addScaledVector(r, 0.12).addScaledVector(u, -0.1);
    }
    const m = ch.heldModel?.userData.muzzle;
    if (m) return m.getWorldPosition(new THREE.Vector3());
    return ch.eyePos();
  }

  /**
   * Hitscan with penetration through thin cover. Damage falls off with range
   * (rangeMod per 12.7 m) and with every surface punched through.
   */
  fireBullet(shooter, origin, dir, def, first, tracer) {
    let maxD = Math.min(260, (def.pellets ? 60 : 240));
    let o = origin.clone();
    let travelled = 0, power = 1;
    const hitChars = new Set();
    let end = null;
    for (let layer = 0; layer < 3 && power > 0.05; layer++) {
      const wh = this.world.raycast(o, dir, maxD - travelled, (b) => b.blocksBullets);
      const wd = wh ? wh.dist : maxD - travelled;
      let best = null;
      for (const c of this.chars) {
        if (c === shooter || !c.alive || c.team === shooter.team || hitChars.has(c)) continue;
        const hit = c.rayHit(o, dir, wd);
        if (hit && (!best || hit.dist < best.dist)) best = { c, ...hit };
      }
      if (best) {
        const dist = travelled + best.dist;
        const point = o.clone().addScaledVector(dir, best.dist);
        const dmg = def.dmg * Math.pow(def.rangeMod, dist / 12.7) * (ZONE_MULT[best.zone] ?? 1) * power;
        const helmetHit = best.zone === 'head' && best.c.helmet;
        this.fx.bodyHit(point, dir, best.zone === 'head', helmetHit, this.world);
        this.audio.impact?.(point, helmetHit ? 'helmet' : 'flesh');
        if (best.zone === 'head') this.audio.headshotHit?.(point, helmetHit);
        this.applyDamage(best.c, shooter, dmg, best.zone, def, dir, point);
        hitChars.add(best.c);
        end = point;
        // bullets keep going through bodies with reduced power (not shotgun pellets)
        if (def.pellets) break;
        power *= 0.6;
        o = point.addScaledVector(dir, 0.3);
        travelled = dist + 0.3;
        continue;
      }
      if (!wh) { end = o.clone().addScaledVector(dir, wd); break; }
      const surface = wh.box?.surface || (wh.box ? 'concrete' : 'ground');
      if (first || def.pellets) this.fx.impact(wh.point, wh.normal, surface, dir);
      if (first) this.audio.impact?.(wh.point, surface);
      if (wh.box?.owner) this.ink.damageWall(wh.box.owner, def.dmg * power);
      end = wh.point;
      // penetration: measure the thickness along the ray
      const box = wh.box;
      const pen = def.penetrate || 0;
      if (!box || pen <= 0) break;
      const exit = rayExit(wh.point, dir, box);
      const thick = exit ? exit.distanceTo(wh.point) : 99;
      const resist = box.kind === 'ink' ? 0.5 : box.kind === 'prop' ? 1.0 : 3.0;
      const cost = thick * resist / pen;
      if (cost >= 1) break;
      power *= (1 - cost) * 0.85;
      this.fx.impact(exit, dir.clone(), surface, dir);
      o = exit.clone().addScaledVector(dir, 0.01);
      travelled += wh.dist + thick;
    }
    if (tracer && end) this.fx.tracer(this.muzzleWorld(shooter), end);
    if (first) {
      // near-miss crack for the listener
      const vt = this.viewTarget;
      if (vt && vt !== shooter && vt.alive && end) {
        const eye = vt.eyePos();
        const toEye = eye.clone().sub(origin);
        const along = toEye.dot(dir);
        if (along > 2 && along < origin.distanceTo(end) + 1) {
          const closest = origin.clone().addScaledVector(dir, along);
          if (closest.distanceTo(eye) < 1.6) {
            this.audio.bulletWhiz?.(closest);
            if (vt === this.player) this.shake = Math.min(0.35, this.shake + 0.08);
          }
        }
      }
      for (const c of this.chars) if (c.brain && c.alive && c.team !== shooter.team) c.brain.hear(shooter.pos, def.suppressed ? 0.45 : 1.3);
    }
  }

  knifeAttack(ch, heavy) {
    const def = WEAPONS.knife;
    const eye = ch.eyePos();
    const fwd = ch.forward();
    let best = null;
    for (const c of this.chars) {
      if (c === ch || !c.alive || c.team === ch.team) continue;
      const to = c.pos.clone().setY(c.pos.y + 1.1).sub(eye);
      const d = to.length();
      if (d > def.range + 0.4) continue;
      if (to.normalize().dot(fwd) < 0.6) continue;
      if (!this.lineOfSight(eye, c.eyePos())) continue;
      if (!best || d < best.d) best = { c, d };
    }
    if (ch === this.viewTarget) this.vm.slash(heavy);
    this.audio.knifeSwing(ch.pos, ch === this.player);
    if (!best) {
      const wh = this.world.raycast(eye, fwd, def.range, (b) => b.blocksBullets);
      if (wh) { this.fx.impact(wh.point, wh.normal, wh.box?.surface || 'concrete', fwd); this.audio.knifeHit(wh.point, wh.box?.surface || 'concrete'); }
      return;
    }
    const victimFwd = best.c.forward().setY(0).normalize();
    const backstab = victimFwd.dot(fwd.clone().setY(0).normalize()) > 0.5;
    const dmg = backstab ? (heavy ? 180 : 90) : heavy ? def.heavyDamage : def.dmg;
    this.audio.knifeHit(best.c.pos);
    const p = best.c.eyePos().add(new THREE.Vector3(0, -0.4, 0));
    this.fx.bodyHit(p, fwd, false, false, this.world);
    this.applyDamage(best.c, ch, dmg, 'chest', def, fwd, p);
  }

  applyDamage(victim, attacker, dmg, zone, def, dir = null, point = null) {
    if (!victim.alive) return;
    let hpDmg = dmg;
    const armored = zone === 'head' ? victim.helmet && victim.armor > 0 : zone !== 'leg' && victim.armor > 0;
    if (armored && def.armorPen != null) {
      hpDmg = dmg * def.armorPen;
      const armorDmg = (dmg - hpDmg) * 0.5;
      if (armorDmg > victim.armor) { hpDmg += (armorDmg - victim.armor) * 2; victim.armor = 0; }
      else victim.armor -= armorDmg;
    }
    hpDmg = Math.max(1, Math.round(hpDmg));
    victim.hp -= hpDmg;
    victim.lastHurt = this.time;
    victim.flinch += Math.min(3, hpDmg / 15);
    if (dir) {
      // visual hit reaction for the body rig (stacks a little on quick follow-ups)
      const prev = victim.hitReact && this.time - victim.hitReact.t < 0.25 ? victim.hitReact.mag * 0.5 : 0;
      victim.hitReact = {
        dir: dir.clone().setY(0).normalize(), zone, t: this.time,
        mag: Math.min(1.6, 0.45 + hpDmg / 40 + prev), side: Math.random() < 0.5 ? 1 : -1,
      };
    }
    // tagging: getting shot slows you down, harder for rifles/snipers
    const tag = def.cat === 'sniper' || def.cat === 'rifle' ? 0.35 : 0.55;
    victim.vel.x *= tag; victim.vel.z *= tag;
    if (attacker) {
      attacker.stats.dmg += hpDmg;
      victim.damageBy.set(attacker.id, (victim.damageBy.get(attacker.id) || 0) + hpDmg);
    }
    victim.brain?.onDamaged(attacker);
    const dead = victim.hp <= 0;
    if (dead && victim.rig && dir) {
      // fall away from the shot
      const f = victim.forward().setY(0).normalize();
      victim.rig.fallDir = f.dot(dir) > 0 ? -1 : 1;
      // momentum for the death slide: heavier for snipers, shotguns and headshots
      const shove = (def.cat === 'sniper' || def.pellets ? 2.4 : def.cat === 'pistol' ? 1.1 : 1.5) * (zone === 'head' ? 1.25 : 1);
      victim.deathImpulse = dir.clone().setY(0).normalize().multiplyScalar(shove);
      victim.deathHead = zone === 'head';
    }

    if (victim === this.player) {
      this.audio.hurt();
      if (zone === 'head' && victim.helmet) this.audio.helmetHit?.();
      this.cr.fx.damage = Math.min(1, this.cr.fx.damage + hpDmg / 55);
      if (attacker) {
        const to = attacker.pos.clone().sub(victim.pos);
        const ang = Math.atan2(to.x, -to.z) + victim.yaw;
        this.hud.damageFrom(-ang);
      }
      // aim punch when hit (as in the genre)
      victim.punch.y += Math.min(2.5, hpDmg / 20);
      this.shake = Math.min(0.6, this.shake + hpDmg / 90);
    }
    if (attacker === this.player && def.id !== 'bomb') {
      this.hud.hitMarker(zone === 'head', dead);
      this.audio.hitMarker(zone === 'head');
      if (dead && point && this.settings.comicFx) {
        this.sfx.pop(zone === 'head' ? pick(HEAD_WORDS) : pick(KILL_WORDS), point, {
          style: 'burst', color: '#ffd23f', bg: zone === 'head' ? '#e8553f' : '#2b2f3a', size: zone === 'head' ? 42 : 34, life: 0.8,
        });
      }
    }
    if (dead) this.kill(victim, attacker, def, zone === 'head');
  }

  kill(victim, attacker, def, head) {
    victim.alive = false;
    victim.hp = 0;
    victim.deathTime = this.time;
    victim.stats.deaths++;
    victim.scopeLevel = 0;
    if (victim.action) this.match.cancelAction(victim);
    if (victim.hasBomb) {
      this.match.bomb.drop(victim.pos);
      this.onBombDrop?.(victim);
    }
    if (attacker && attacker !== victim) {
      attacker.stats.kills++;
      attacker.roundKills = (attacker.roundKills || 0) + 1;
      if (head) attacker.stats.hs++;
      attacker.money = Math.min(RULES.maxMoney, attacker.money + (def.killReward ?? 300));
      attacker.ink = Math.min(100, attacker.ink + 25);
    }
    for (const [id, d] of victim.damageBy) {
      const a = this.chars.find((c) => c.id === id);
      if (a && a !== attacker && a.team !== victim.team && d >= 40) { a.stats.assists++; a.ink = Math.min(100, a.ink + 10); }
    }
    this.hud.addKill({
      killer: attacker?.name, victim: victim.name, weapon: def.id, head,
      killerTeam: attacker?.team, victimTeam: victim.team,
    });
    this.match.roundEvents?.push({ type: 'kill', killer: attacker?.name, killerTeam: attacker?.team, victim: victim.name, victimTeam: victim.team, weapon: def.id, head, t: this.time });
    if (attacker === this.player) {
      this.audio.kill();
      (attacker.roundKillMarks ||= []).push(!!head);
      this.hud.killConfirm(attacker.roundKillMarks);
    }
    this.panels.onKill(attacker, victim, def, head);
    if (victim === this.player) this.startDeathCam(attacker);
    if (victim === this.viewTarget && victim !== this.player) this.spectateNext();
  }

  // --- economy ------------------------------------------------------------
  buy(ch, id) {
    if (!this.match.canBuy(ch) || !availableTo(id, ch.team)) return false;
    const w = WEAPONS[id], gear = GEAR[id];
    const price = w ? w.price : gear?.price;
    if (price == null) return false;
    let cost = price;
    if (gear) {
      if (id === 'vest') { if (ch.armor >= 100) return false; }
      else if (id === 'vesthelm') {
        if (ch.armor >= 100 && ch.helmet) return false;
        if (ch.armor >= 100) cost = 350; // helmet only
      } else if (id === 'kit') { if (ch.kit) return false; }
      else if (id === 'ink') { if (ch.ink >= 100) return false; }
      if (ch.money < cost) return false;
      if (id === 'vest') ch.armor = 100;
      else if (id === 'vesthelm') { ch.armor = 100; ch.helmet = true; }
      else if (id === 'kit') ch.kit = true;
      else if (id === 'ink') ch.ink = Math.min(100, ch.ink + 40);
    } else {
      if (ch.money < cost || ch.slots[w.slot]?.id === id) return false;
      ch.giveWeapon(id);
      if (ch === this.viewTarget) this.vm.setWeapon(id, true);
    }
    ch.money -= cost;
    if (ch === this.player) this.audio.buy();
    return true;
  }

  // --- player -------------------------------------------------------------
  playerIntent(dt) {
    const p = this.player, inp = this.input;
    const intent = { fwd: 0, right: 0, jump: false, crouch: false, walk: false, yaw: p.yaw, pitch: p.pitch, fire: false, use: false };
    if (!p.alive) return intent;
    const active = inp.locked && !this.menuOpen;
    if (!active) return intent;
    const zoom = p.scoped ? this.camera.fov / this.settings.fov : 1;
    const k = 0.0022 * this.input.sensitivity * zoom;
    p.yaw -= inp.lookDX * k;
    p.pitch = THREE.MathUtils.clamp(p.pitch - inp.lookDY * k, -1.53, 1.53);
    intent.yaw = p.yaw; intent.pitch = p.pitch;
    intent.fwd = (inp.key('KeyW') ? 1 : 0) - (inp.key('KeyS') ? 1 : 0);
    intent.right = (inp.key('KeyD') ? 1 : 0) - (inp.key('KeyA') ? 1 : 0);
    intent.jump = inp.hit('Space');
    intent.crouch = inp.key('ControlLeft') || inp.key('KeyC');
    intent.walk = inp.key('ShiftLeft');
    intent.use = inp.key('KeyE');
    const def = p.def;
    if (def?.cat === 'knife') {
      if (inp.mouse.left) intent.fire = true;
      if (inp.mouse.rightPressed && p.canFire()) {
        p.weapon.nextFire = this.time + 1.0;
        this.knifeAttack(p, true);
      }
    } else if (def?.cat === 'ink') {
      if (inp.mouse.rightPressed) this.ink.cycleTool();
    } else {
      intent.fire = def?.auto ? inp.mouse.left : inp.mouse.leftPressed;
      if (inp.mouse.rightPressed && def?.scope) p.toggleScope();
    }
    if (inp.hit('KeyR')) p.startReload();
    if (inp.hit('KeyF')) this.vm.inspect();
    for (const [code, slot] of [['Digit1', 1], ['Digit2', 2], ['Digit3', 3], ['Digit4', 4]]) if (inp.hit(code)) this.playerSwitch(slot);
    if (inp.hit('KeyQ')) this.playerSwitch(this.lastSlot || 3);
    if (inp.wheel) {
      const order = [1, 2, 3, 4].filter((s) => p.slots[s]);
      const i = order.indexOf(p.slot);
      this.playerSwitch(order[(i + (inp.wheel > 0 ? 1 : -1) + order.length) % order.length]);
    }
    this.ink.handlePlayer(p, inp, dt);
    return intent;
  }

  playerSwitch(slot) {
    const p = this.player;
    const prev = p.slot;
    if (p.switchTo(slot)) this.lastSlot = prev;
  }

  // --- spectating ---------------------------------------------------------
  startDeathCam(killer) {
    const p = this.player;
    this.deathCam = { t0: this.time, killer, from: p.eyePos() };
    this.hud.setDeathCaption(killer && killer !== p
      ? `<span class="dc-k" style="color:${TEAMS[killer.team].color}">${killer.name}</span> 击倒了你<small>${killer.weapon?.def.name || ''} ${killer.weapon?.def.en || ''} · 剩余 ${Math.max(0, Math.ceil(killer.hp))} HP</small>`
      : '你被炸倒了');
    this.vm.visible = false;
  }

  spectateNext() {
    const alive = this.chars.filter((c) => c.alive && c.team === this.player.team);
    const pool = alive.length ? alive : this.chars.filter((c) => c.alive);
    if (!pool.length) return;
    const i = pool.indexOf(this.viewTarget);
    this.setViewTarget(pool[(i + 1) % pool.length]);
    this.vm.visible = true;
  }

  // --- events -------------------------------------------------------------
  onShot(ch) {
    const def = ch.def;
    const local = ch === this.viewTarget && !this.deathCam;
    if (local) this.vm.kick(def);
    const mpos = this.muzzleWorld(ch);
    if (!local) {
      const dir = ch.forward();
      this.fx.muzzle(mpos, dir, def);
    } else if (!def.suppressed) {
      // muzzle light washes over the surroundings (and the arms via the viewmodel light)
      const big = def.cat === 'sniper' || def.pellets ? 1.8 : def.cat === 'pistol' ? 0.8 : 1;
      this.fx.flashLight(mpos, 9 * big, 0xffa858, 0.055, 9 + 4 * big);
      const f = new THREE.Vector3(); this.camera.getWorldDirection(f);
      ch.heat = Math.min(1, (ch.heat || 0) * Math.exp(-(this.time - (ch.lastHeatT || 0)) * 1.5) + 0.12);
      ch.lastHeatT = this.time;
      this.fx.muzzleSmoke(mpos, f, def, ch.heat);
    }
    this.audio.shot(def.sound || def.cat, local ? ch.pos : mpos, ch === this.player);
    ch.brain?.afterShot();
    if (def.casing && !def.bolt && !def.pumpAction) this.onCasing(ch, local);
    if (local) {
      // a short, sharp jolt of the whole view on top of the recoil pattern
      const ck = this.camKick;
      const heavyShot = def.cat === 'sniper' || def.pellets;
      ck.pitch[1] += heavyShot ? 0.55 : def.cat === 'pistol' ? 0.16 : def.cat === 'smg' ? 0.08 : 0.12;
      ck.roll[1] += (Math.random() - 0.5) * (heavyShot ? 0.5 : 0.14);
      if (heavyShot) ck.fov = Math.min(4, ck.fov + 2.2);
      if (heavyShot) this.shake = Math.min(0.4, this.shake + 0.18);
    }
  }

  /** Spit a spent case out of the ejection port (first- or third-person). */
  onCasing(ch, local) {
    if (!ch) return;
    const def = ch.def;
    if (!def?.casing) return;
    let pos, vel;
    if (local && ch === this.viewTarget) {
      const e = this.vm.ejectWorld(this.camera);
      if (!e) return;
      pos = e.pos; vel = e.vel.add(ch.vel);
    } else {
      const eject = ch.heldModel?.userData.eject;
      if (!eject || ch.pos.distanceTo(this.camera.position) > 30) return;
      pos = eject.getWorldPosition(new THREE.Vector3());
      const right = new THREE.Vector3(Math.cos(ch.yaw), 0, -Math.sin(ch.yaw));
      vel = right.multiplyScalar(2 + Math.random()).add(new THREE.Vector3(0, 1.5 + Math.random(), 0)).add(ch.vel);
    }
    this.fx.casing(pos, vel, def.casing, (p) => this.audio.casing?.(p, def.casing));
  }

  onFootstep(ch) {
    this.audio.footstep(ch.pos, ch === this.player, 'concrete');
    for (const c of this.chars) if (c.brain && c.alive && c.team !== ch.team) c.brain.hear(ch.pos, 0.75);
  }
  onJump(ch) { this.audio.jump(ch.pos, ch === this.player); }
  onLand(ch, v) {
    this.audio.land(ch.pos, ch === this.player, Math.min(1, v / 12));
    if (ch === this.viewTarget) { this.vm.landed(v); this.camDip = Math.min(0.1, v * 0.008); }
  }
  onReload(ch) {
    if (ch !== this.player) this.audio.reload?.(ch.def.sound?.kind);
  }
  onShellLoaded(ch) {
    if (ch === this.viewTarget) this.audio.reloadPart?.('shotgun', 'shellIn');
    if (ch === this.viewTarget && !ch.weapon.reloading && ch.def.pumpAction) this.vm.s.pump = 1;
  }
  onScope(ch) { if (ch === this.player) this.audio.scope(ch.scoped); }
  onDryFire(ch) { if (ch === this.player) this.audio.dryFire(); }
  onSwitch(ch) {
    ch.refreshHeldModel();
    if (ch === this.viewTarget) this.vm.setWeapon(ch.weapon.id);
    if (ch === this.player) (this.audio.draw ? this.audio.draw(ch.def.sound?.kind || 'rifle') : this.audio.switchWeapon());
  }
  onHeldModel(ch, model) {
    if (ch === this.player) this.stickers.apply(model, ch.weapon.id);
    // a rebuilt gun (and the arms holding it) must stay hidden from its owner's own camera
    if (ch === this.viewTarget) setLayer(ch.mesh, LAYER_SELF);
  }
  onBotSpot(bot, enemy) {
    enemy.spottedAt = this.time;
    if (bot.team === 'CT') {
      for (const [id, s] of Object.entries(this.map.sites)) {
        const cx = (s.x1 + s.x2) / 2, cz = (s.z1 + s.z2) / 2;
        if (Math.hypot(enemy.pos.x - cx, enemy.pos.z - cz) < 22 && this.time - this.lastRotateCall[id] > 12) {
          this.lastRotateCall[id] = this.time;
          callRotate(this, id);
        }
      }
    }
    this.ink.botReact?.(bot, enemy);
  }
  onActionStart() {}

  onRoundReset() {
    this.ink.clear();
    this.fx.clearDecals();
    this.sfx.clear();
    this.deathCam = null;
    this.hud.setDeathCaption('');
    this.cr.fx.desat = 0;
    this.vm.visible = true;
    for (const c of this.chars) { c.brain?.reset(); c.rig?.revive(); }
  }
  onRoundStart(n) {
    if (this.viewTarget !== this.player) this.setViewTarget(this.player);
    this.vm.setWeapon(this.player.weapon?.id, true);
    planRound(this);
    const half = n === RULES.halftime + 1 ? ' · 换边' : '';
    this.hud.showBanner(`第 ${n} 回合${half}`, `${TEAMS[this.player.team].name} · ${this.player.team === 'T' ? '安放墨爆罐' : '守住 A / B 包点'}`, TEAMS[this.player.team].color, 2.6);
    this.audio.roundStart();
  }
  onLive() {
    if (this.settings.comicFx) this.sfx.pop('GO!', { x: 0.5, y: 0.34 }, { style: 'burst', size: 64, color: '#ffd23f', bg: '#e8553f', rot: -6, life: 0.8, drift: 0 });
  }
  onPlant(c, site) {
    this.hud.showBanner('墨爆罐已安放', `${site} 点 · ${RULES.bombTime} 秒后爆炸`, '#e8553f', 2.2);
    callRotate(this, site);
    for (const ct of this.match.alive('CT')) if (ct.brain) ct.brain.task = { type: 'retake', site };
  }
  onDefuse() {
    if (this.settings.comicFx) this.sfx.pop('SNIP!', this.match.bomb.pos.clone().setY(1.0), { style: 'burst', size: 48, color: '#2ec4ff', bg: '#ffffff', life: 1.0 });
  }
  onBombDrop() {}
  onBombPickup(c) { if (c === this.player) this.hud.showBanner('捡到了墨爆罐', '去 A 或 B 点按住 E 安放', '#e8553f', 1.8); }
  onExplode(pos) {
    this.fx.explosion(pos);
    this.audio.explosion(pos);
    const d = this.camera.position.distanceTo(pos);
    this.cr.fx.flash = Math.max(0, 1 - d / 60);
    this.shake = Math.max(this.shake, 1.4 * Math.max(0, 1 - d / 50));
    if (d < 30) this.audio.tinnitus?.(Math.max(0.2, 1 - d / 30));
    if (this.settings.comicFx) this.sfx.pop('KA-BOOM!', pos.clone().setY(5), { style: 'burst', size: 80, color: '#ffd23f', bg: '#e8553f', life: 1.4, drift: 1.2 });
  }
  onRoundEnd(win, reason, mvp) {
    const why = { elim: '全员击倒', bomb: '墨爆罐引爆', defuse: '墨爆罐被拆除', time: '时间耗尽' }[reason];
    const mine = win === this.player.team;
    this.hud.showBanner(`${TEAMS[win].name} 胜`, `${why}${mvp ? ` · MVP ${mvp.name}` : ''}`, TEAMS[win].color, 4);
    this.audio.roundEnd(mine);
    this.panels.onRoundEnd(win, reason, mvp);
  }
  onHalftime() {
    this.hud.showBanner('半场换边', '涂鸦帮和橡皮擦交换阵营', '#f2b134', 3);
  }
  onMatchEnd(winner) {
    const mine = winner === this.player.team;
    this.audio.matchEnd(mine);
    this.hud.showBanner(mine ? '你赢下了比赛' : '惜败', `${this.match.score.T} : ${this.match.score.CT}`, TEAMS[winner].color, 6);
    setTimeout(() => this.onMatchOver?.(winner), 2500);
  }

  // --- frame --------------------------------------------------------------
  update(realDt) {
    const inp = this.input;
    inp.poll();
    const paused = !this.running || (!inp.locked && !this.menuOpen);
    const dt = paused ? 0 : Math.min(realDt, 0.05) * this.timeScale;

    if (!paused) {
      this.time += dt;
      const m = this.match;
      const frozen = m.phase === 'freeze';
      for (const c of this.chars) {
        const intent = c === this.player ? this.playerIntent(dt) : c.brain ? c.brain.think(dt) : null;
        if (!intent) continue;
        if (frozen) { intent.fwd = intent.right = 0; intent.jump = false; intent.fire = false; }
        if (m.phase === 'over') intent.fire = false;
        c.simulateMovement(dt, intent);
        c.updateWeapon(dt);
        if (intent.fire && !frozen) c.fire();
        m.use(c, intent.use);
      }
      if (inp.hit('KeyB') && this.player.alive) this.onBuyKey?.();
      if (this.deathCam && inp.mouse.leftPressed && this.time - this.deathCam.t0 > 1.2) this.deathCam.done = true;
      if (!this.player.alive && !this.deathCam && inp.mouse.leftPressed) this.spectateNext();
      m.update(dt);
      this.ink.update(dt);
    }
    for (const c of this.chars) c.updateRig(dt);
    this.panels.update(realDt);
    this.updateCamera(realDt, dt);
    this.fx.update(dt, this.camera);

    const aspect = this.cr.width / this.cr.height;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const vt = this.viewTarget || this.player;
    if (vt) this.vm.update(dt, vt, vt === this.player ? inp : { lookDX: 0, lookDY: 0 }, aspect);
    this.hud.update(realDt);
    this.sfx.update(realDt, this.camera, this.cr.width, this.cr.height);

    const f = new THREE.Vector3();
    this.camera.getWorldDirection(f);
    this.audio.setListener(this.camera.position, f);

    const fx = this.cr.fx;
    fx.damage *= Math.exp(-realDt * 2.2);
    fx.flash *= Math.exp(-realDt * 4);
    fx.lowHp = vt?.alive && vt.hp <= 25 ? 1 : 0;

    const hideVM = !this.running || (this.deathCam && !this.deathCam.done);
    this.cr.render(this.scene, this.camera, hideVM ? null : this.vm.scene, this.vm.camera, this.time);
    this.panels.afterRender();
    inp.endFrame();
  }

  /** Title-screen fly-through along the streets. */
  attract(t) {
    if (!this.attractPath) {
      const pts = [[0, 32], [-26, 31], [-40, 20], [-40, 0], [-36, -18], [-28, -30], [-14, -33], [0, -31], [16, -33], [32, -26], [38, -10], [40, 2], [32, 4], [30, 18], [24, 31], [10, 32]];
      this.attractPath = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 3.0, z)), true, 'centripetal');
    }
    const cam = this.camera;
    const u = (t * 0.007) % 1;
    const p = this.attractPath.getPointAt(u);
    const ahead = this.attractPath.getPointAt((u + 0.025) % 1);
    cam.position.copy(p);
    cam.position.y += Math.sin(t * 0.7) * 0.35;
    ahead.y = 2.6;
    cam.lookAt(ahead);
    cam.fov = this.settings.fov;
  }

  updateCamera(realDt) {
    if (!this.running) return;
    const cam = this.camera;
    const p = this.player;
    if (this.deathCam) {
      const dc = this.deathCam;
      const k = Math.min(1, (this.time - dc.t0) / 1.4);
      const e = 1 - Math.pow(1 - k, 3);
      const target = dc.killer && dc.killer !== p ? dc.killer.eyePos() : dc.from.clone().add(new THREE.Vector3(0, -1, -1));
      const back = dc.from.clone().sub(target).setY(0).normalize();
      cam.position.copy(dc.from).addScaledVector(back, e * 2.0).add(new THREE.Vector3(0, e * 1.4, 0));
      cam.lookAt(target);
      this.cr.fx.desat += (0.85 - this.cr.fx.desat) * Math.min(1, realDt * 4);
      if (this.time - dc.t0 > 3.2 || dc.done) {
        this.deathCam = null;
        this.hud.setDeathCaption('');
        this.cr.fx.desat = 0;
        this.spectateNext();
      }
      return;
    }
    const vt = this.viewTarget || p;
    if (!vt) return;
    vt.eyePos(cam.position);
    this.camDip *= Math.exp(-realDt * 9);
    cam.position.y -= this.camDip;
    if (vt.stepSmooth) cam.position.y += vt.stepSmooth;
    // the view shows ~45% of the recoil punch; bullets follow all of it
    const view = 0.45;
    const punchX = THREE.MathUtils.degToRad(vt.punch.y) * view + vt.flinch * 0.008;
    const punchY = -THREE.MathUtils.degToRad(vt.punch.x) * view;
    this.shake *= Math.exp(-realDt * 6);
    // smooth (not per-frame random) shake: two detuned sines per axis
    const sh = this.shake * 0.02, tt = this.time * 31;
    const ck = this.camKick;
    for (const sp of [ck.pitch, ck.roll]) {
      sp[1] += (-900 * sp[0] - 2 * 30 * 0.7 * sp[1]) * realDt;
      sp[0] += sp[1] * realDt;
    }
    ck.fov *= Math.exp(-realDt * 11);
    cam.rotation.set(
      vt.pitch + punchX + ck.pitch[0] + Math.sin(tt) * Math.sin(tt * 0.61 + 1) * sh,
      vt.yaw + punchY + Math.sin(tt * 1.13 + 2) * Math.sin(tt * 0.53) * sh,
      ck.roll[0] + Math.sin(tt * 0.87 + 4) * sh * 0.5);
    const levels = vt.def?.scope?.levels;
    const targetFov = vt.scoped && levels ? levels[vt.scopeLevel - 1] : this.settings.fov;
    this.baseFov = this.baseFov ?? cam.fov;
    this.baseFov += (targetFov - this.baseFov) * Math.min(1, realDt * 20);
    cam.fov = this.baseFov + ck.fov * (vt.scoped ? 0.3 : 1);
    if (!vt.alive) this.cr.fx.desat = 0;
  }
}

/** Where a ray that entered `box` at `p` leaves it. */
function rayExit(p, dir, box) {
  let tmax = Infinity;
  for (const a of ['x', 'y', 'z']) {
    const d = dir[a];
    if (Math.abs(d) < 1e-9) continue;
    const t = ((d > 0 ? box.max[a] : box.min[a]) - p[a]) / d;
    if (t < tmax) tmax = t;
  }
  return Number.isFinite(tmax) ? p.clone().addScaledVector(dir, tmax) : null;
}

export { LAYER_FX };
