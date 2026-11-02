// 军械库 · 贴纸工坊: draw a sticker, then click on the 3D gun to print it there.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PreviewRenderer } from '../render/renderer.js';
import { buildGunModel, WEAPONS } from '../game/weapons.js';
import { STICKER_STYLES } from '../game/stickers.js';
import { PALETTE } from '../render/palette.js';

const GUNS = ['k47', 'm4', 'g35', 'f25', 'sg5', 'a3', 'aw1', 's08', 'm10', 'mp9', 'mp7', 'p90', 'n7', 'x14', 'm249', 'g18', 's1', 'p25', 't9', 'f7', 'd50', 'knife'];
const COLORS = ['#1b1626', '#ffffff', '#ff4f5e', '#ffd23f', '#2ec4ff', '#3a5bd9', '#ff8fb8', '#5fd068', '#ff9a3c', '#9b6bff', '#8a4a2b', '#fbe7b5'];
const TOOLS = [
  { id: 'pen', name: '钢笔' },
  { id: 'brush', name: '毛笔' },
  { id: 'eraser', name: '橡皮' },
  { id: 'fill', name: '油漆桶' },
  { id: 'text', name: '字' },
];
const PAD = 256;

export class Armory {
  constructor(game, root) {
    this.game = game;
    this.store = game.stickers;
    this.el = document.createElement('div');
    this.el.className = 'armory';
    root.appendChild(this.el);
    this.gun = 'k47';
    this.tool = 'pen';
    this.color = '#1b1626';
    this.size = 8;
    this.sel = this.store.list()[0]?.id ?? null;
    this.place = { size: 0.11, rot: 0, style: 'raw' };
    this.undo = [];
    this.build();
  }

  build() {
    this.el.innerHTML = `
      <div class="arm-head">
        <div class="arm-title">军械库<small>贴纸工坊 · STICKER LAB</small></div>
        <div class="arm-guns">${GUNS.map((id) => `<button data-gun="${id}" title="${WEAPONS[id].en}">${WEAPONS[id].name}</button>`).join('')}</div>
        <button class="arm-close" data-close>完成 ✓</button>
      </div>
      <div class="arm-body">
        <section class="arm-pad">
          <h3>① 画一张贴纸</h3>
          <div class="pad-wrap"><canvas class="pad" width="${PAD}" height="${PAD}"></canvas></div>
          <div class="pad-tools">${TOOLS.map((t) => `<button data-tool="${t.id}">${t.name}</button>`).join('')}
            <button data-act="undo">撤销</button><button data-act="clear">清空</button></div>
          <div class="pad-colors">${COLORS.map((c) => `<i data-color="${c}" style="--c:${c}"></i>`).join('')}<input type="color" value="#ff4f5e" title="自定义颜色"></div>
          <label class="pad-size">笔刷 <input type="range" min="2" max="40" value="${this.size}"></label>
          <label class="pad-text">文字 <input type="text" maxlength="8" value="POW!"></label>
          <div class="pad-actions">
            <button data-act="outline" title="给图案加上白边和墨线，像真正的贴纸">贴纸化描边</button>
            <button class="primary" data-act="save">保存为贴纸 ⤓</button>
          </div>
        </section>
        <section class="arm-view">
          <h3>② 点击枪身印上去 <small>拖动旋转 · 滚轮缩放</small></h3>
          <canvas class="gun-view"></canvas>
          <div class="place-opts">
            <label>大小 <input type="range" data-p="size" min="0.04" max="0.26" step="0.01" value="${this.place.size}"></label>
            <label>角度 <input type="range" data-p="rot" min="-180" max="180" step="5" value="0"></label>
            <div class="styles">${STICKER_STYLES.map((s) => `<button data-style="${s.id}" title="${s.desc}">${s.name}</button>`).join('')}</div>
          </div>
          <div class="placed"></div>
        </section>
        <section class="arm-lib">
          <h3>贴纸库</h3>
          <div class="lib-grid"></div>
          <div class="lib-actions">
            <button data-act="edit">编辑选中</button>
            <button data-act="spray">设为喷漆 (T)</button>
            <button data-act="delete">删除</button>
          </div>
          <p class="lib-tip">喷漆：对局中按 <kbd>T</kbd> 把选中的贴纸喷在墙上。</p>
        </section>
      </div>`;

    this.pad = this.el.querySelector('.pad');
    this.pctx = this.pad.getContext('2d', { willReadFrequently: true });
    this.view = this.el.querySelector('.gun-view');

    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.querySelector('.pad-size input').addEventListener('input', (e) => { this.size = +e.target.value; });
    this.el.querySelector('.pad-colors input').addEventListener('input', (e) => { this.color = e.target.value; this.refreshTools(); });
    this.el.querySelectorAll('[data-p]').forEach((inp) => inp.addEventListener('input', (e) => {
      this.place[e.target.dataset.p] = +e.target.value;
      this.updateGhost();
    }));
    this.bindPad();
    this.bindView();
  }

  // --- open/close ------------------------------------------------------------
  open() {
    this.el.classList.add('on');
    this.game.suspended = true;
    if (!this.cr) this.initView();
    this.setGun(this.gun);
    this.refreshLib();
    this.refreshTools();
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.renderView();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  close() {
    this.running = false;
    this.el.classList.remove('on');
    this.game.suspended = false;
    const vt = this.game.viewTarget;
    if (vt?.weapon) this.game.vm.setWeapon(vt.weapon.id, true);
    if (this.game.player?.alive) this.game.player.refreshHeldModel();
    this.onClose?.();
  }

  onClick(e) {
    const t = e.target;
    const g = this.game;
    if (t.closest('[data-close]')) { g.audio.uiClick(); this.close(); return; }
    const gun = t.closest('[data-gun]');
    if (gun) { this.setGun(gun.dataset.gun); g.audio.uiClick(); return; }
    const tool = t.closest('[data-tool]');
    if (tool) { this.tool = tool.dataset.tool; this.refreshTools(); g.audio.uiClick(); return; }
    const col = t.closest('[data-color]');
    if (col) { this.color = col.dataset.color; if (this.tool === 'eraser') this.tool = 'pen'; this.refreshTools(); return; }
    const st = t.closest('[data-style]');
    if (st) { this.place.style = st.dataset.style; this.refreshTools(); g.audio.uiClick(); return; }
    const sticker = t.closest('[data-sid]');
    if (sticker) { this.sel = +sticker.dataset.sid; this.refreshLib(); this.updateGhost(); g.audio.uiClick(); return; }
    const rm = t.closest('[data-unplace]');
    if (rm) { this.store.unplace(this.gun, +rm.dataset.unplace); this.applyStickers(); g.audio.uiClick(); return; }
    const act = t.closest('[data-act]')?.dataset.act;
    if (act) this.action(act);
  }

  action(act) {
    const g = this.game;
    g.audio.uiClick();
    if (act === 'undo') { const d = this.undo.pop(); if (d) this.pctx.putImageData(d, 0, 0); }
    else if (act === 'clear') { this.pushUndo(); this.pctx.clearRect(0, 0, PAD, PAD); }
    else if (act === 'outline') { this.pushUndo(); this.stickerize(); }
    else if (act === 'save') {
      if (this.isPadEmpty()) { g.audio.deny(); return; }
      const id = this.store.add(this.pad.toDataURL('image/png'));
      if (id == null) { g.audio.deny(); alert('存储空间不足，删掉几张旧贴纸再试试。'); return; }
      this.sel = id;
      this.refreshLib();
      this.updateGhost();
      g.audio.buy();
    } else if (act === 'edit') {
      const s = this.store.get(this.sel);
      if (!s) return;
      const img = this.store.image(s.id);
      this.pushUndo();
      this.pctx.clearRect(0, 0, PAD, PAD);
      this.pctx.drawImage(img, 0, 0, PAD, PAD);
    } else if (act === 'spray') {
      if (this.sel != null) { this.store.setSpray(this.sel); this.refreshLib(); }
    } else if (act === 'delete') {
      const s = this.store.get(this.sel);
      if (!s || s.builtin) { g.audio.deny(); return; }
      this.store.remove(s.id);
      this.sel = this.store.list()[0]?.id ?? null;
      this.refreshLib();
      this.applyStickers();
    }
  }

  refreshTools() {
    this.el.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === this.tool));
    this.el.querySelectorAll('[data-color]').forEach((b) => b.classList.toggle('on', b.dataset.color === this.color));
    this.el.querySelectorAll('[data-style]').forEach((b) => b.classList.toggle('on', b.dataset.style === this.place.style));
    this.el.querySelectorAll('[data-gun]').forEach((b) => b.classList.toggle('on', b.dataset.gun === this.gun));
  }

  refreshLib() {
    const spray = this.store.data.spray ?? this.store.list()[0]?.id;
    this.el.querySelector('.lib-grid').innerHTML = this.store.list().map((s) =>
      `<div class="lib-item ${s.id === this.sel ? 'on' : ''}" data-sid="${s.id}" style="background-image:url(${s.url})">${s.id === spray ? '<b class="spray-tag">喷漆</b>' : ''}</div>`).join('');
    const placed = this.store.placements(this.gun);
    this.el.querySelector('.placed').innerHTML = placed.length
      ? placed.map((p, i) => `<div class="placed-item" style="background-image:url(${this.store.get(p.sid)?.url || ''})"><button data-unplace="${i}">✕</button></div>`).join('')
      : '<p class="empty">这把枪还没有贴纸，选一张贴纸，点枪身就能印上去。</p>';
  }

  // --- drawing pad -------------------------------------------------------------
  pushUndo() {
    this.undo.push(this.pctx.getImageData(0, 0, PAD, PAD));
    if (this.undo.length > 25) this.undo.shift();
  }

  isPadEmpty() {
    const d = this.pctx.getImageData(0, 0, PAD, PAD).data;
    for (let i = 3; i < d.length; i += 16) if (d[i] > 10) return false;
    return true;
  }

  bindPad() {
    const pad = this.pad, ctx = this.pctx;
    let drawing = false, last = null, lastW = 0;
    const pos = (e) => {
      const r = pad.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width * PAD, (e.clientY - r.top) / r.height * PAD];
    };
    pad.addEventListener('pointerdown', (e) => {
      pad.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pushUndo();
      if (this.tool === 'fill') { floodFill(ctx, Math.floor(p[0]), Math.floor(p[1]), this.color); return; }
      if (this.tool === 'text') {
        const txt = this.el.querySelector('.pad-text input').value || 'POW!';
        const size = Math.max(18, this.size * 3);
        ctx.font = `900 ${size}px Bangers, "ZCOOL KuaiLe", Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = size / 7; ctx.strokeStyle = PALETTE.ink; ctx.lineJoin = 'round';
        ctx.strokeText(txt, p[0], p[1]);
        ctx.fillStyle = this.color === PALETTE.ink ? PALETTE.yellow : this.color;
        ctx.fillText(txt, p[0], p[1]);
        return;
      }
      drawing = true; last = p; lastW = this.size * 0.5;
      this.dab(p, p, this.size, this.size);
    });
    pad.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pos(e);
      const d = Math.hypot(p[0] - last[0], p[1] - last[1]);
      // brush gets thinner the faster you move, like a real brush pen
      let w = this.size;
      if (this.tool === 'brush') w = THREE.MathUtils.clamp(this.size * 1.6 / (1 + d * 0.08), this.size * 0.35, this.size * 1.6);
      w = lastW + (w - lastW) * 0.4;
      this.dab(last, p, lastW, w);
      last = p; lastW = w;
    });
    const end = () => { drawing = false; };
    pad.addEventListener('pointerup', end);
    pad.addEventListener('pointercancel', end);
  }

  dab(a, b, w0, w1) {
    const ctx = this.pctx;
    ctx.save();
    ctx.globalCompositeOperation = this.tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = ctx.fillStyle = this.color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const steps = Math.max(1, Math.ceil(d / 1.5));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w = w0 + (w1 - w0) * t;
      ctx.beginPath();
      ctx.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.max(0.6, w / 2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** White die-cut border + ink outline around whatever is drawn. */
  stickerize() {
    const src = document.createElement('canvas');
    src.width = src.height = PAD;
    src.getContext('2d').drawImage(this.pad, 0, 0);
    const tint = (color) => {
      const c = document.createElement('canvas');
      c.width = c.height = PAD;
      const x = c.getContext('2d');
      x.drawImage(src, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color; x.fillRect(0, 0, PAD, PAD);
      return c;
    };
    const inkC = tint(PALETTE.ink), whiteC = tint('#ffffff');
    const ctx = this.pctx;
    ctx.clearRect(0, 0, PAD, PAD);
    // shrink a touch so the border fits
    ctx.save();
    ctx.translate(PAD / 2, PAD / 2); ctx.scale(0.86, 0.86); ctx.translate(-PAD / 2, -PAD / 2);
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      ctx.drawImage(inkC, Math.cos(ang) * 13, Math.sin(ang) * 13);
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      ctx.drawImage(whiteC, Math.cos(ang) * 8, Math.sin(ang) * 8);
    }
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }

  // --- 3D preview ---------------------------------------------------------------
  initView() {
    const view = this.view;
    this.cr = new PreviewRenderer(view, { getSize: () => [Math.max(200, view.clientWidth), Math.max(200, view.clientHeight)] });
    this.cr.renderer.setClearColor('#e9e2cf');
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.cr.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    // key light rides with the camera so the face you are stamping on is always lit
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(0.6, 1.2, 1);
    key.target.position.set(0, 0, -1);
    this.cam.add(key, key.target);
    this.scene.add(this.cam);
    this.turn = new THREE.Group();
    this.scene.add(this.turn);
    this.orbit = { yaw: -Math.PI / 2 + 0.25, pitch: 0.12, dist: 2.4 };
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32), new THREE.MeshBasicMaterial({ color: '#e8553f', transparent: true, opacity: 0.9, depthTest: false }));
    this.ghost.renderOrder = 5;
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    this.ray = new THREE.Raycaster();
  }

  setGun(id) {
    this.gun = id;
    if (this.turn) {
      while (this.turn.children.length) this.turn.remove(this.turn.children[0]);
      const model = buildGunModel(id);
      // centre the model on the turntable
      const box = new THREE.Box3().setFromObject(model);
      const c = box.getCenter(new THREE.Vector3());
      model.position.sub(c);
      const holder = new THREE.Group();
      holder.add(model);
      const len = box.getSize(new THREE.Vector3()).length();
      holder.scale.setScalar(1.6 / len);
      this.turn.add(holder);
      this.model = model;
      this.holder = holder;
      this.applyStickers();
    }
    this.refreshTools();
    this.refreshLib();
  }

  applyStickers() {
    if (this.model) this.store.apply(this.model, this.gun);
    this.refreshLib();
  }

  bindView() {
    const view = this.view;
    let down = null, moved = 0;
    view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); down = [e.clientX, e.clientY]; moved = 0; });
    view.addEventListener('pointermove', (e) => {
      this.mouse = [e.clientX, e.clientY];
      if (!down) { this.updateGhost(); return; }
      const dx = e.clientX - down[0], dy = e.clientY - down[1];
      moved += Math.abs(dx) + Math.abs(dy);
      this.orbit.yaw -= dx * 0.01;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + dy * 0.01, -1.2, 1.2);
      down = [e.clientX, e.clientY];
      this.ghost.visible = false;
    });
    view.addEventListener('pointerup', (e) => {
      if (down && moved < 6) this.stamp(e.clientX, e.clientY);
      down = null;
    });
    view.addEventListener('pointerleave', () => { this.ghost.visible = false; });
    view.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (e.deltaY > 0 ? 1.08 : 0.92), 0.8, 5);
    }, { passive: false });
  }

  pickPart(cx, cy) {
    if (!this.model) return null;
    const r = this.view.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.cam);
    const parts = this.model.userData.stickerParts;
    // first solid surface under the cursor; only sticker-able panels accept a print
    const hit = this.ray.intersectObject(this.model, true).find((h) => !h.object.userData.isDecal);
    if (!hit || !parts.includes(hit.object)) return null;
    const nrmW = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    return { hit, nrmW, part: parts.indexOf(hit.object) };
  }

  updateGhost() {
    if (!this.mouse || !this.ghost) return;
    const p = this.pickPart(...this.mouse);
    if (!p || this.sel == null) { this.ghost.visible = false; this.view.style.cursor = 'grab'; return; }
    this.view.style.cursor = 'crosshair';
    this.ghost.visible = true;
    this.ghost.position.copy(p.hit.point).addScaledVector(p.nrmW, 0.002);
    this.ghost.lookAt(p.hit.point.clone().add(p.nrmW));
    const s = this.place.size * this.holder.scale.x;
    this.ghost.scale.setScalar(s);
  }

  stamp(cx, cy) {
    if (this.sel == null) return;
    const p = this.pickPart(cx, cy);
    if (!p) return;
    this.model.updateMatrixWorld(true);
    const inv = this.model.matrixWorld.clone().invert();
    const posL = p.hit.point.clone().applyMatrix4(inv);
    const nrmL = p.nrmW.clone().transformDirection(inv);
    this.store.place(this.gun, {
      sid: this.sel, part: p.part,
      pos: posL.toArray().map((v) => +v.toFixed(4)), nrm: nrmL.toArray().map((v) => +v.toFixed(4)),
      size: this.place.size, rot: THREE.MathUtils.degToRad(this.place.rot), style: this.place.style,
    });
    this.applyStickers();
    this.game.audio.spray(null, true);
  }

  renderView() {
    const o = this.orbit;
    this.cam.position.set(Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, Math.sin(o.pitch) * o.dist, Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
    this.cam.lookAt(0, 0, 0);
    const [w, h] = this.cr.getSize();
    if (w !== this.cr.width || h !== this.cr.height) this.cr.resize();
    this.cam.aspect = w / h;
    this.cam.updateProjectionMatrix();
    this.cr.render(this.scene, this.cam);
  }
}

/** Scanline flood fill with a small colour tolerance. */
function floodFill(ctx, x, y, color) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  const i0 = (y * W + x) * 4;
  const target = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
  // let the browser parse the CSS colour into sRGB bytes
  const tmp = document.createElement('canvas').getContext('2d');
  tmp.fillStyle = color; tmp.fillRect(0, 0, 1, 1);
  const fill = [...tmp.getImageData(0, 0, 1, 1).data.slice(0, 3), 255];
  const same = (i) => Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) + Math.abs(d[i + 3] - target[3]) < 60;
  if (same(i0) && target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === 255) return;
  const stack = [[x, y]];
  const seen = new Uint8Array(W * H);
  while (stack.length) {
    const [sx, sy] = stack.pop();
    let lx = sx;
    while (lx > 0 && !seen[sy * W + lx - 1] && same((sy * W + lx - 1) * 4)) lx--;
    let rx = sx;
    while (rx < W - 1 && !seen[sy * W + rx + 1] && same((sy * W + rx + 1) * 4)) rx++;
    for (let xx = lx; xx <= rx; xx++) {
      const i = sy * W + xx;
      seen[i] = 1;
      d.set(fill, i * 4);
      for (const ny of [sy - 1, sy + 1]) {
        if (ny < 0 || ny >= H) continue;
        const j = ny * W + xx;
        if (!seen[j] && same(j * 4)) stack.push([xx, ny]);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}
