// Ink drawing as gameplay: what you draw in the world becomes cover, smoke or a marker.
//   墨墙 wall  — stroke along the ground, raises a bullet-stopping ink wall
//   墨云 cloud — circle an area, an ink cloud blocks vision inside it
//   涂鸦 mark  — scribble on any surface, teammates see it through walls
import * as THREE from 'three';
import { Box } from '../world/world.js';
import { LAYER_FX } from '../render/renderer.js';
import { MOVE } from './character.js';

/** Wet ink: deep colour under a glossy clear coat. */
function wetInk(color) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color('#7a6bd0') });
}

export const INK_TOOLS = [
  { id: 'wall', name: '墨墙', en: 'INK WALL', range: 13, maxLen: 9, desc: '沿地面画一笔，立起挡子弹的墨墙' },
  { id: 'cloud', name: '墨云', en: 'INK CLOUD', range: 30, desc: '圈出一块区域，升起遮挡视线的墨云' },
  { id: 'mark', name: '涂鸦', en: 'DOODLE', range: 24, desc: '在任何表面上涂鸦，队友可以透视看到' },
];

const WALL = { step: 0.55, half: 0.36, height: 2.3, life: 15, hp: 260 };
const CLOUD = { life: 12, minR: 1.8, maxR: 4.2, tapR: 2.6 };

export function wallCost(len) { return Math.round(Math.min(45, Math.max(12, len * 4.5))); }
export function cloudCost(r) { return Math.round(18 + r * 5.5); }
const MARK_COST = 5;

const tmpV = new THREE.Vector3();

export class InkSystem {
  constructor(game) {
    this.game = game;
    this.toolIdx = 0;
    this.drawing = false;
    this.stroke = [];
    this.walls = [];
    this.clouds = [];
    this.marks = [];
    this.balls = [];
    this.preview = new THREE.Group();
    game.scene.add(this.preview);
    this.dotGeo = new THREE.SphereGeometry(0.09, 8, 6);
    this.dotMat = new THREE.MeshBasicMaterial({ color: '#2a2357' });
    this.badMat = new THREE.MeshBasicMaterial({ color: '#ff4f5e' });
    this.inkMat = wetInk('#241d4f');
    this.inkMatTeam = { T: wetInk('#3d1c4f'), CT: wetInk('#1c2552') };
    this.pillarGeo = new THREE.CylinderGeometry(0.42, 0.5, 1, 16).translate(0, 0.5, 0);
    this.capGeo = new THREE.SphereGeometry(0.44, 16, 12);
    this.previewCost = 0;
    this.spray = null;

    // full-screen "inside the ink" overlay
    this.blind = document.createElement('div');
    this.blind.className = 'ink-blind';
    game.uiRoot.appendChild(this.blind);
  }

  get tool() { return INK_TOOLS[this.toolIdx]; }

  toolsHTML(p) {
    const holding = p.def?.cat === 'ink';
    const cost = this.drawing ? `<div class="ink-cost ${this.previewCost > p.ink ? 'bad' : ''}">需要 ${this.previewCost}</div>` : '';
    const hint = holding ? '<div class="ink-keys">左键按住画 · 右键/G 换工具</div>' : '<div class="ink-keys"><kbd>4</kbd> 拿出墨水笔</div>';
    return INK_TOOLS.map((t, i) => `<span class="ink-tool ${i === this.toolIdx ? 'on' : ''}">${t.name}</span>`).join('') + hint + cost;
  }

  cycleTool() {
    if (this.drawing) return;
    this.toolIdx = (this.toolIdx + 1) % INK_TOOLS.length;
    this.game.audio.uiClick();
  }

  clear() {
    for (const w of [...this.walls]) this.removeWall(w, true);
    for (const c of this.clouds) for (const p of c.puffs) p.dead = true;
    for (const m of this.marks) { this.game.scene.remove(m.group); m.el?.remove(); }
    for (const b of this.balls) this.game.scene.remove(b.mesh);
    this.clouds = []; this.marks = []; this.balls = [];
    this.cancelStroke();
    this.cloudsCast = false;
  }

  // --- player drawing -------------------------------------------------------
  handlePlayer(p, inp) {
    const g = this.game;
    if (inp.hit('KeyG')) this.cycleTool();
    if (inp.hit('KeyT')) this.sprayTag(p);
    const live = g.match.phase === 'live';
    const holding = p.def?.cat === 'ink' && g.time >= p.weapon.drawEnd;
    if (holding && inp.mouse.left && p.alive && live) {
      if (!this.drawing) this.beginStroke(p);
      this.sampleStroke(p);
    } else if (this.drawing) {
      this.commitStroke(p);
    }
  }

  beginStroke() {
    this.drawing = true;
    this.stroke = [];
    this.strokeLen = 0;
    this.game.audio.inkScribbleStart();
  }

  cancelStroke() {
    if (this.drawing) this.game.audio.inkScribbleStop();
    this.drawing = false;
    this.stroke = [];
    while (this.preview.children.length) this.preview.remove(this.preview.children[0]);
  }

  aimHit(p, range) {
    const g = this.game;
    const eye = g.camera.position.clone();
    const dir = new THREE.Vector3();
    g.camera.getWorldDirection(dir);
    return g.world.raycast(eye, dir, range, (b) => b.blocksBullets);
  }

  sampleStroke(p) {
    const t = this.tool;
    const hit = this.aimHit(p, t.range);
    if (!hit) return;
    const ground = hit.normal.y > 0.7;
    if (t.id === 'wall' && !ground) return;
    let pt = hit.point;
    if (t.id === 'cloud' && !ground) {
      // aimed at a wall: drop the cloud onto the ground just in front of it
      pt = hit.point.clone().addScaledVector(hit.normal, 0.8);
      pt.y = 0;
    }
    const last = this.stroke[this.stroke.length - 1];
    const minStep = t.id === 'mark' ? 0.12 : 0.3;
    if (last && last.p.distanceTo(pt) < minStep) return;
    if (t.id === 'wall') {
      if (last) {
        const seg = last.p.distanceTo(pt);
        if (this.strokeLen + seg > t.maxLen) return;
        this.strokeLen += seg;
      }
    }
    this.stroke.push({ p: pt.clone(), n: hit.normal.clone() });
    const dot = new THREE.Mesh(this.dotGeo, this.dotMat);
    dot.position.copy(pt).addScaledVector(hit.normal, 0.05);
    dot.scale.setScalar(t.id === 'mark' ? 0.6 : 1);
    dot.layers.set(LAYER_FX);
    this.preview.add(dot);
    this.previewCost = this.strokeCost();
    for (const d of this.preview.children) d.material = this.previewCost > p.ink ? this.badMat : this.dotMat;
  }

  strokeCost() {
    const t = this.tool;
    if (t.id === 'wall') return wallCost(Math.max(1, this.strokeLen));
    if (t.id === 'cloud') return cloudCost(this.cloudRadius());
    return MARK_COST;
  }

  cloudRadius() {
    if (this.stroke.length < 4) return CLOUD.tapR;
    const c = new THREE.Vector3();
    for (const s of this.stroke) c.add(s.p);
    c.divideScalar(this.stroke.length);
    let r = 0;
    for (const s of this.stroke) r += Math.hypot(s.p.x - c.x, s.p.z - c.z);
    r /= this.stroke.length;
    return THREE.MathUtils.clamp(r, CLOUD.minR, CLOUD.maxR);
  }

  commitStroke(p) {
    const g = this.game;
    const t = this.tool;
    const pts = this.stroke.map((s) => s.p);
    const normals = this.stroke.map((s) => s.n);
    const cost = this.strokeCost();
    const r = t.id === 'cloud' ? this.cloudRadius() : 0;
    this.cancelStroke();
    if (!pts.length) return;
    if (cost > p.ink) {
      g.sfx.pop('墨水不够!', { x: 0.5, y: 0.6 }, { style: 'plain', size: 30, color: '#ff4f5e', life: 0.9, rot: 0 });
      g.audio.deny();
      return;
    }
    let ok = false;
    if (t.id === 'wall') ok = pts.length >= 2 && this.makeWall(pts, p);
    else if (t.id === 'cloud') {
      const c = new THREE.Vector3();
      for (const q of pts) c.add(q);
      c.divideScalar(pts.length);
      if (pts.length < 4) c.copy(pts[pts.length - 1]);
      ok = this.makeCloud(c, r, p.team);
    } else ok = this.makeMark(pts, normals, p);
    if (ok) p.ink -= cost;
    else g.audio.deny();
  }

  // --- walls ---------------------------------------------------------------
  /** Raise an ink wall along a ground polyline. Returns false if nothing fit. */
  makeWall(pts, owner) {
    const g = this.game;
    // resample evenly
    const samples = [];
    let carry = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      let d = carry;
      while (d <= len) {
        samples.push(a.clone().lerp(b, len > 0 ? d / len : 0));
        d += WALL.step;
      }
      carry = d - len;
    }
    if (samples.length < 2) samples.push(pts[pts.length - 1].clone());
    const wall = { pillars: [], hp: WALL.hp, t0: g.time, life: WALL.life, team: owner.team, dying: false };
    const mat = this.inkMatTeam[owner.team] || this.inkMat;
    samples.forEach((s, i) => {
      // never trap a body inside a pillar
      for (const c of g.chars) {
        if (!c.alive) continue;
        if (Math.hypot(c.pos.x - s.x, c.pos.z - s.z) < WALL.half + MOVE.radius + 0.05 && c.pos.y < s.y + WALL.height) return;
      }
      const box = new Box(s.x - WALL.half, s.y, s.z - WALL.half, s.x + WALL.half, s.y + WALL.height, s.z + WALL.half, 'ink');
      box.owner = wall;
      g.world.add(box);
      g.nav.setDynamicRect(box.min.x, box.min.z, box.max.x, box.max.z, true);
      const grp = new THREE.Group();
      const hgt = WALL.height * (0.9 + Math.random() * 0.15);
      const pillar = new THREE.Mesh(this.pillarGeo, mat);
      pillar.scale.set(1, hgt, 1);
      const cap = new THREE.Mesh(this.capGeo, mat);
      cap.position.y = hgt;
      cap.scale.set(1, 0.6 + Math.random() * 0.5, 1);
      grp.add(pillar, cap);
      for (let k = 0; k < 2; k++) {
        const drip = new THREE.Mesh(this.capGeo, mat);
        drip.scale.setScalar(0.25 + Math.random() * 0.2);
        const a = Math.random() * Math.PI * 2;
        drip.position.set(Math.cos(a) * 0.55, 0.05, Math.sin(a) * 0.55);
        grp.add(drip);
      }
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      grp.position.copy(s);
      grp.scale.set(1, 0.01, 1);
      grp.userData.delay = i * 0.025;
      g.scene.add(grp);
      wall.pillars.push({ grp, box });
    });
    if (!wall.pillars.length) return false;
    this.walls.push(wall);
    const mid = samples[Math.floor(samples.length / 2)];
    g.audio.inkSplat(mid);
    return true;
  }

  damageWall(wall, dmg) {
    if (wall.dying) return;
    wall.hp -= dmg;
    wall.wobble = 1;
    if (wall.hp <= 0) {
      const p = wall.pillars[Math.floor(wall.pillars.length / 2)]?.grp.position;
      if (p) {
        this.game.audio.inkWallBreak(p);
      }
      this.removeWall(wall);
    }
  }

  removeWall(wall, instant = false) {
    if (wall.dying && !instant) return;
    wall.dying = true;
    for (const pl of wall.pillars) {
      if (pl.box) {
        this.game.world.remove(pl.box);
        this.game.nav.setDynamicRect(pl.box.min.x, pl.box.min.z, pl.box.max.x, pl.box.max.z, false);
        pl.box = null;
      }
    }
    if (instant) {
      for (const pl of wall.pillars) this.game.scene.remove(pl.grp);
      this.walls.splice(this.walls.indexOf(wall), 1);
    } else {
      wall.dieT = this.game.time;
    }
  }

  // --- clouds ---------------------------------------------------------------
  makeCloud(center, r, team) {
    const g = this.game;
    const fx = g.fx;
    const life = CLOUD.life;
    const puffs = [];
    const n = Math.round(26 + r * 12);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * r * 0.85;
      const h = Math.random() * r * 1.1;
      const lift = (h / (r * 1.1)) * (0.6 + Math.random() * 0.4);
      const target = new THREE.Vector3(center.x + Math.cos(a) * rr, center.y + 0.4 + h, center.z + Math.sin(a) * rr);
      const p = fx.soft.spawn({ // smooth falloff: dense core without visible puff rims
        pos: new THREE.Vector3(center.x, center.y + 0.5, center.z),
        vel: target.clone().sub(center).multiplyScalar(2.6), drag: 3.2,
        life: life + Math.random() * 1.5, size: r * (0.75 + Math.random() * 0.45), grow: 0.25,
        rot: Math.random() * 6, spin: (Math.random() - 0.5) * 0.15,
        // dense indigo ink: darker underneath, sun-catching on top; alpha > 1 keeps the core opaque
        color: [0.07 + lift * 0.1, 0.06 + lift * 0.08, 0.15 + lift * 0.14], alpha: 2.2, fadeIn: 0.35, fadePow: 6,
      });
      puffs.push(p);
    }
    this.clouds.push({ puffs, center: new THREE.Vector3(center.x, center.y + r * 0.55, center.z), r, t0: g.time, life, team, grow: 0 });
    g.audio.inkSplat(center);
    return true;
  }

  /** Thrown ink ball (bots) that bursts into a cloud on arrival. */
  throwCloud(from, to, r, team) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), this.inkMat);
    mesh.position.copy(from);
    this.game.scene.add(mesh);
    const dist = from.distanceTo(to);
    this.balls.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur: Math.max(0.4, dist / 22), r, team });
  }

  blocksVision(a, b) {
    for (const c of this.clouds) {
      if (c.grow < 0.5) continue;
      const rr = c.r * 0.92 * Math.min(1, c.grow);
      // segment–sphere distance
      const ab = tmpV.subVectors(b, a);
      const len2 = ab.lengthSq();
      let t = len2 > 0 ? ((c.center.x - a.x) * ab.x + (c.center.y - a.y) * ab.y + (c.center.z - a.z) * ab.z) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + ab.x * t - c.center.x, py = a.y + ab.y * t - c.center.y, pz = a.z + ab.z * t - c.center.z;
      if (px * px + py * py * 0.6 + pz * pz < rr * rr) return true;
    }
    return false;
  }

  // --- marks ----------------------------------------------------------------
  makeMark(pts, normals, owner) {
    const g = this.game;
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: owner.team === 'T' ? '#ff5a4f' : '#2ec4ff' });
    const geo = new THREE.SphereGeometry(0.06, 6, 4);
    for (let i = 0; i < pts.length; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(pts[i]).addScaledVector(normals[i], 0.02);
      m.scale.set(1, 1, 0.3);
      m.lookAt(pts[i].clone().add(normals[i]));
      m.layers.set(LAYER_FX);
      group.add(m);
      if (i > 0) {
        // fill gaps so the scribble reads as a line
        const a = pts[i - 1], b = pts[i];
        const steps = Math.floor(a.distanceTo(b) / 0.05);
        for (let k = 1; k < steps; k++) {
          const f = new THREE.Mesh(geo, mat);
          f.position.copy(a).lerp(b, k / steps).addScaledVector(normals[i], 0.02);
          f.scale.set(1, 1, 0.3);
          f.layers.set(LAYER_FX);
          group.add(f);
        }
      }
    }
    g.scene.add(group);
    const c = new THREE.Vector3();
    for (const p of pts) c.add(p);
    c.divideScalar(pts.length);
    // teammates see a marker through walls
    const el = document.createElement('div');
    el.className = 'ink-mark';
    el.innerHTML = `<b>!</b><small>${owner.name}</small>`;
    el.style.setProperty('--tc', owner.team === 'T' ? '#ff5a4f' : '#2ec4ff');
    g.uiRoot.appendChild(el);
    this.marks.push({ group, el, pos: c.clone().add(new THREE.Vector3(0, 0.4, 0)), team: owner.team, t0: g.time, life: 14 });
    g.audio.uiClick();
    return true;
  }

  sprayTag(p) {
    const g = this.game;
    if (!p.alive || g.time - (this.lastSpray || -9) < 2) return;
    const hit = this.aimHit(p, 5);
    if (!hit) return;
    const tex = g.stickers.sprayTexture();
    if (!tex) return;
    this.lastSpray = g.time;
    if (this.spray) { g.scene.remove(this.spray); this.spray.material.dispose(); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({
      map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    }));
    m.position.copy(hit.point).addScaledVector(hit.normal, 0.015);
    m.lookAt(hit.point.clone().add(hit.normal));
    if (Math.abs(hit.normal.y) > 0.7) m.rotateZ(-p.yaw);
    m.layers.set(LAYER_FX);
    g.scene.add(m);
    this.spray = m;
    g.audio.spray(hit.point, true);
  }

  // --- bots ------------------------------------------------------------------
  botReact(bot, enemy) {
    const g = this.game;
    const b = bot.brain;
    if (!b || bot.ink < 30 || g.time - (b.lastInk || -99) < 9 || g.match.phase !== 'live') return;
    const d = bot.pos.distanceTo(enemy.pos);
    if (bot.team !== 'CT' || d < 9 || d > 30 || Math.random() > 0.3) return;
    // wall across the line of fire, a few metres in front of the bot
    const dir = enemy.pos.clone().sub(bot.pos).setY(0).normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    const c = bot.pos.clone().addScaledVector(dir, 3.2).setY(0);
    const a = c.clone().addScaledVector(side, -2.1), e = c.clone().addScaledVector(side, 2.1);
    const [ax, az] = g.nav.toCell(a.x, a.z), [ex, ez] = g.nav.toCell(e.x, e.z), [cx, cz] = g.nav.toCell(c.x, c.z);
    if (!g.nav.isWalk(cx, cz) || (!g.nav.isWalk(ax, az) && !g.nav.isWalk(ex, ez))) return;
    if (this.makeWall([a, c, e], bot)) {
      bot.ink -= wallCost(4.2);
      b.lastInk = g.time;
    }
  }

  botTeamUse() {
    const g = this.game, plan = g.teamPlan?.T;
    if (!plan || this.cloudsCast || g.time < plan.executeAt - 1.5 || g.match.phase !== 'live') return;
    this.cloudsCast = true;
    const s = g.map.spots;
    const targets = plan.site === 'A' ? [s.CT_A_guard[0], s.CT_A_guard[1]] : [s.CT_B_guard[0], s.CT_B_guard[1]];
    const throwers = g.match.alive('T').filter((c) => c.brain && c.ink >= 35)
      .sort((a, b) => Math.hypot(a.pos.x - plan.staging[0], a.pos.z - plan.staging[1]) - Math.hypot(b.pos.x - plan.staging[0], b.pos.z - plan.staging[1]));
    targets.forEach((tp, i) => {
      const c = throwers[i];
      if (!c || Math.random() < 0.25) return;
      const r = 3.2;
      c.ink -= cloudCost(r);
      const from = c.eyePos();
      this.throwCloud(from, new THREE.Vector3(tp[0], 0, tp[1]), r, 'T');
    });
  }

  // --- tick -------------------------------------------------------------------
  update(dt) {
    const g = this.game, t = g.time;
    this.botTeamUse();

    for (let i = this.walls.length - 1; i >= 0; i--) {
      const w = this.walls[i];
      const age = t - w.t0;
      w.wobble = (w.wobble || 0) * Math.exp(-dt * 8);
      if (!w.dying && age > w.life) this.removeWall(w);
      for (const pl of w.pillars) {
        const a = age - pl.grp.userData.delay;
        let sy = 1;
        if (a < 0.35) {
          const k = Math.max(0, a / 0.35);
          sy = k < 0.7 ? (k / 0.7) * 1.18 : 1.18 - ((k - 0.7) / 0.3) * 0.18; // overshoot
        }
        if (w.dying) sy *= Math.max(0, 1 - (t - w.dieT) / 0.4);
        const sx = 1 + (1 - Math.min(1, sy)) * 0.3 + Math.sin(t * 40 + pl.grp.position.x) * 0.05 * w.wobble;
        pl.grp.scale.set(sx, Math.max(0.01, sy), sx);
      }
      if (w.dying && t - w.dieT > 0.45) {
        for (const pl of w.pillars) g.scene.remove(pl.grp);
        this.walls.splice(i, 1);
      }
    }

    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      const age = t - c.t0;
      c.grow = Math.min(1, age / 0.7);
      if (age > c.life) this.clouds.splice(i, 1);
    }

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      b.t += dt / b.dur;
      const k = Math.min(1, b.t);
      b.mesh.position.lerpVectors(b.from, b.to, k);
      b.mesh.position.y += Math.sin(k * Math.PI) * Math.min(6, b.from.distanceTo(b.to) * 0.25);
      if (k >= 1) {
        g.scene.remove(b.mesh);
        this.balls.splice(i, 1);
        this.makeCloud(b.to, b.r, b.team);
      }
    }

    const cam = g.camera, W = g.cr.width, H = g.cr.height;
    const vt = g.viewTarget || g.player;
    for (let i = this.marks.length - 1; i >= 0; i--) {
      const m = this.marks[i];
      if (t - m.t0 > m.life) { g.scene.remove(m.group); m.el.remove(); this.marks.splice(i, 1); continue; }
      const show = vt && vt.team === m.team;
      tmpV.copy(m.pos).project(cam);
      if (!show || tmpV.z > 1) { m.el.style.display = 'none'; continue; }
      m.el.style.display = '';
      const x = THREE.MathUtils.clamp((tmpV.x * 0.5 + 0.5) * W, 20, W - 20);
      const y = THREE.MathUtils.clamp((-tmpV.y * 0.5 + 0.5) * H, 20, H - 20);
      m.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      m.el.style.opacity = t - m.t0 > m.life - 1 ? m.life - (t - m.t0) : 1;
    }

    // inside a cloud? blot out the screen
    let inside = 0;
    for (const c of this.clouds) {
      const d = cam.position.distanceTo(c.center) / (c.r * Math.max(0.01, c.grow));
      inside = Math.max(inside, THREE.MathUtils.clamp((1.05 - d) / 0.35, 0, 1));
    }
    this.blind.style.opacity = inside.toFixed(3);
  }
}
