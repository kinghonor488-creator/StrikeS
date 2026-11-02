// Onomatopoeia ("BANG!", "POW!") and caption pops, anchored in world or screen space.
import * as THREE from 'three';

const v = new THREE.Vector3();

export class ComicText {
  constructor(root, game) {
    this.game = game;
    this.layer = document.createElement('div');
    this.layer.className = 'sfx-layer';
    root.appendChild(this.layer);
    this.items = [];
  }

  /**
   * text: string, at: THREE.Vector3 (world) or {x,y} in 0..1 screen space.
   * opts: { color, stroke, size(px), life(s), style: 'burst'|'plain'|'shout', rot(deg), drift }
   */
  pop(text, at, opts = {}) {
    const el = document.createElement('div');
    el.className = `sfx sfx-${opts.style || 'plain'}`;
    el.style.setProperty('--c', opts.color || '#ffd23f');
    el.style.setProperty('--s', opts.stroke || '#1b1626');
    el.style.setProperty('--size', `${opts.size || 42}px`);
    el.style.setProperty('--rot', `${opts.rot ?? (Math.random() * 24 - 12)}deg`);
    if (opts.bg) el.style.setProperty('--bg', opts.bg);
    el.innerHTML = `<span>${text}</span>`;
    this.layer.appendChild(el);
    const life = opts.life ?? 0.75;
    this.items.push({ el, at: at.isVector3 ? at.clone() : at, world: !!at.isVector3, t: 0, life, drift: opts.drift ?? 0.6 });
    if (this.items.length > 24) this.kill(0);
    return el;
  }

  kill(i) {
    const it = this.items[i];
    it.el.remove();
    this.items.splice(i, 1);
  }

  update(dt, camera, w, h) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      if (it.t >= it.life) { this.kill(i); continue; }
      let x, y;
      if (it.world) {
        v.copy(it.at);
        v.y += it.t * it.drift;
        v.project(camera);
        if (v.z > 1) { it.el.style.display = 'none'; continue; }
        it.el.style.display = '';
        x = (v.x * 0.5 + 0.5) * w;
        y = (-v.y * 0.5 + 0.5) * h;
      } else {
        x = it.at.x * w;
        y = it.at.y * h - it.t * it.drift * 40;
      }
      const k = it.t / it.life;
      const scale = k < 0.12 ? 0.3 + (k / 0.12) * 0.9 : k < 0.2 ? 1.2 - ((k - 0.12) / 0.08) * 0.2 : 1;
      const op = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
      it.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(var(--rot)) scale(${scale})`;
      it.el.style.opacity = op;
    }
  }

  clear() { while (this.items.length) this.kill(0); }
}
