// Hand-drawn sticker library + per-weapon placements, projected onto guns as decals.
import * as THREE from 'three';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { PALETTE } from '../render/palette.js';

const KEY = 'strikes.stickers.v1';
const MAX_STICKERS = 20;

export const STICKER_STYLES = [
  { id: 'raw', name: '原色', desc: '照你画的样子贴上去' },
  { id: 'dots', name: '网点印', desc: '三色网点印刷，像漫画杂志' },
  { id: 'ink', name: '墨拓', desc: '单色墨水拓印，带纸纹' },
];

function canvas(n = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = n;
  return [c, c.getContext('2d')];
}

// --- default sticker pack (drawn in code, same tools a player has) ----------
function burstPath(g, cx, cy, rOut, rIn, n) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut * (0.85 + ((i * 53) % 7) / 30);
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
}

function defaultStickers() {
  const out = [];
  const ink = PALETTE.ink;
  // POW!
  {
    const [c, g] = canvas();
    burstPath(g, 128, 128, 118, 62, 12);
    g.fillStyle = PALETTE.red; g.fill(); g.lineWidth = 10; g.strokeStyle = ink; g.stroke();
    burstPath(g, 128, 128, 88, 50, 12);
    g.fillStyle = PALETTE.yellow; g.fill();
    g.font = '900 78px Bangers, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = ink; g.strokeText('POW!', 128, 134);
    g.fillStyle = '#ffffff'; g.fillText('POW!', 128, 134);
    out.push(c.toDataURL());
  }
  // ink-drop mascot 「墨仔」
  {
    const [c, g] = canvas();
    g.beginPath();
    g.moveTo(128, 20);
    g.bezierCurveTo(150, 70, 215, 120, 205, 170);
    g.bezierCurveTo(198, 225, 150, 240, 128, 240);
    g.bezierCurveTo(106, 240, 58, 225, 51, 170);
    g.bezierCurveTo(41, 120, 106, 70, 128, 20);
    g.fillStyle = '#2f2766'; g.fill(); g.lineWidth = 10; g.strokeStyle = ink; g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(100, 160, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(156, 160, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
    g.beginPath(); g.arc(104, 166, 10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(152, 166, 10, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.arc(128, 196, 18, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.beginPath(); g.ellipse(88, 110, 10, 20, -0.5, 0, Math.PI * 2); g.fill();
    out.push(c.toDataURL());
  }
  // smiley
  {
    const [c, g] = canvas();
    g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2);
    g.fillStyle = PALETTE.yellow; g.fill(); g.lineWidth = 10; g.strokeStyle = ink; g.stroke();
    g.fillStyle = ink;
    g.beginPath(); g.ellipse(92, 100, 14, 26, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(164, 100, 14, 26, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = 12; g.lineCap = 'round';
    g.beginPath(); g.arc(128, 132, 62, 0.25, Math.PI - 0.25); g.stroke();
    out.push(c.toDataURL());
  }
  // heart
  {
    const [c, g] = canvas();
    g.beginPath();
    g.moveTo(128, 222);
    g.bezierCurveTo(20, 150, 30, 40, 100, 50);
    g.bezierCurveTo(118, 54, 126, 66, 128, 80);
    g.bezierCurveTo(130, 66, 138, 54, 156, 50);
    g.bezierCurveTo(226, 40, 236, 150, 128, 222);
    g.fillStyle = PALETTE.red; g.fill(); g.lineWidth = 10; g.strokeStyle = ink; g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(84, 92, 12, 22, -0.6, 0, Math.PI * 2); g.fill();
    out.push(c.toDataURL());
  }
  // lightning
  {
    const [c, g] = canvas();
    g.beginPath();
    g.moveTo(150, 14); g.lineTo(60, 140); g.lineTo(118, 140); g.lineTo(96, 242); g.lineTo(200, 104); g.lineTo(138, 104); g.lineTo(176, 14);
    g.closePath();
    g.fillStyle = PALETTE.cyan; g.fill(); g.lineWidth = 10; g.lineJoin = 'round'; g.strokeStyle = ink; g.stroke();
    out.push(c.toDataURL());
  }
  // 漫 seal stamp
  {
    const [c, g] = canvas();
    g.fillStyle = PALETTE.red;
    g.fillRect(28, 28, 200, 200);
    g.strokeStyle = PALETTE.paper; g.lineWidth = 8; g.strokeRect(44, 44, 168, 168);
    g.font = '900 140px "ZCOOL KuaiLe", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = PALETTE.paper; g.fillText('漫', 128, 136);
    out.push(c.toDataURL());
  }
  return out;
}

// --- print-style filters ------------------------------------------------------
function stylize(img, style) {
  const [c, g] = canvas(256);
  g.drawImage(img, 0, 0, 256, 256);
  if (style === 'raw') return c;
  const d = g.getImageData(0, 0, 256, 256);
  const px = d.data;
  if (style === 'dots') {
    // posterize to a 4-colour print palette, then knock the colour into halftone dots
    const pal = [[255, 79, 94], [255, 210, 63], [46, 196, 255], [27, 22, 38], [255, 246, 220]];
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      if (px[i + 3] < 30) continue;
      let best = 0, bd = Infinity;
      for (let k = 0; k < pal.length; k++) {
        const dr = px[i] - pal[k][0], dg = px[i + 1] - pal[k][1], db = px[i + 2] - pal[k][2];
        const dd = dr * dr + dg * dg + db * db;
        if (dd < bd) { bd = dd; best = k; }
      }
      const [r, gg, b] = pal[best];
      const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      // rotated dot grid
      const u = (x * 0.7071 - y * 0.7071) / 7, v = (x * 0.7071 + y * 0.7071) / 7;
      const fx = u - Math.floor(u) - 0.5, fy = v - Math.floor(v) - 0.5;
      const dist = Math.hypot(fx, fy);
      const inDot = dist < 0.25 + (1 - lum) * 0.35 || best === 3;
      out[i] = inDot ? r : 255; out[i + 1] = inDot ? gg : 246; out[i + 2] = inDot ? b : 220;
      out[i + 3] = px[i + 3];
    }
    d.data.set(out);
  } else if (style === 'ink') {
    // single ink colour, threshold with grain, slightly broken edges like a rubbing
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      if (px[i + 3] < 30) continue;
      const lum = (px[i] * 0.3 + px[i + 1] * 0.59 + px[i + 2] * 0.11) / 255;
      const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const grain = n - Math.floor(n);
      const on = lum < 0.82 && grain > 0.12;
      px[i] = 27; px[i + 1] = 22; px[i + 2] = 38;
      px[i + 3] = on ? px[i + 3] * (0.75 + grain * 0.25) : 0;
    }
  }
  g.putImageData(d, 0, 0);
  return c;
}

export class StickerStore {
  constructor() {
    let data = null;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { data = null; }
    this.data = data || { library: [], placements: {}, spray: null, nextId: 1 };
    if (!this.data.library.length) {
      for (const url of defaultStickers()) this.data.library.push({ id: this.data.nextId++, url, builtin: true });
      this.save();
    }
    this.images = new Map();
    this.textures = new Map();
    for (const s of this.data.library) this.image(s.id);
  }

  save() {
    try { localStorage.setItem(KEY, JSON.stringify(this.data)); return true; }
    catch { return false; }
  }

  list() { return this.data.library; }
  get(id) { return this.data.library.find((s) => s.id === id); }

  add(url) {
    const lib = this.data.library;
    if (lib.filter((s) => !s.builtin).length >= MAX_STICKERS) {
      const oldest = lib.find((s) => !s.builtin);
      this.remove(oldest.id);
    }
    const s = { id: this.data.nextId++, url };
    lib.push(s);
    this.image(s.id);
    if (!this.save()) { lib.pop(); return null; }
    return s.id;
  }

  remove(id) {
    this.data.library = this.data.library.filter((s) => s.id !== id);
    for (const k of Object.keys(this.data.placements)) this.data.placements[k] = this.data.placements[k].filter((p) => p.sid !== id);
    if (this.data.spray === id) this.data.spray = null;
    this.save();
  }

  image(id) {
    if (this.images.has(id)) return this.images.get(id);
    const s = this.get(id);
    if (!s) return null;
    const img = new Image();
    img.src = s.url;
    img.onload = () => {
      // refresh any texture variants made before the image decoded
      for (const [k, t] of this.textures) if (k.startsWith(id + ':')) this.paintTexture(t, img, k.split(':')[1]);
    };
    this.images.set(id, img);
    return img;
  }

  paintTexture(tex, img, style) {
    if (!img.complete || !img.naturalWidth) return;
    tex.image = stylize(img, style);
    tex.needsUpdate = true;
  }

  texture(id, style = 'raw') {
    const key = `${id}:${style}`;
    if (this.textures.has(key)) return this.textures.get(key);
    const img = this.image(id);
    if (!img) return null;
    const tex = new THREE.Texture(canvas(4)[0]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    this.paintTexture(tex, img, style);
    this.textures.set(key, tex);
    return tex;
  }

  sprayTexture() {
    const id = this.data.spray ?? this.data.library[0]?.id;
    return id != null ? this.texture(id, 'raw') : null;
  }

  setSpray(id) { this.data.spray = id; this.save(); }

  placements(weaponId) { return this.data.placements[weaponId] || []; }

  place(weaponId, pl) {
    const list = (this.data.placements[weaponId] ||= []);
    if (list.length >= 5) list.shift();
    list.push(pl);
    this.save();
  }

  unplace(weaponId, idx) {
    this.placements(weaponId).splice(idx, 1);
    this.save();
  }

  /**
   * Project this weapon's stickers onto a freshly built gun model.
   * Placements are stored in model-local space: { sid, part, pos[3], nrm[3], size, rot, style }.
   */
  apply(model, weaponId, list = this.placements(weaponId)) {
    for (const c of [...model.children]) if (c.userData.isDecal) { model.remove(c); c.geometry.dispose(); }
    if (!list.length) return;
    model.updateMatrixWorld(true);
    const inv = model.matrixWorld.clone().invert();
    const helper = new THREE.Object3D();
    for (const pl of list) {
      const part = model.userData.stickerParts?.[pl.part];
      const tex = this.texture(pl.sid, pl.style || 'raw');
      if (!part || !tex) continue;
      const pos = new THREE.Vector3(...pl.pos).applyMatrix4(model.matrixWorld);
      const nrm = new THREE.Vector3(...pl.nrm).transformDirection(model.matrixWorld);
      helper.position.copy(pos);
      helper.lookAt(pos.clone().add(nrm));
      helper.rotateZ(pl.rot || 0);
      const s = pl.size * model.getWorldScale(new THREE.Vector3()).x;
      const geo = new DecalGeometry(part, pos, helper.rotation, new THREE.Vector3(s, s, 0.05));
      if (!geo.attributes.position || geo.attributes.position.count === 0) continue;
      geo.applyMatrix4(inv);
      // printed vinyl: slightly glossy, sits on top of the finish
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, roughness: 0.42, metalness: 0.05, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      });
      const m = new THREE.Mesh(geo, mat);
      m.userData.isDecal = true;
      m.renderOrder = 2;
      model.add(m);
    }
  }
}
