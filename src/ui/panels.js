// Comic-panel kill cuts (freeze-frame split into panels) and the end-of-match comic page.
import * as THREE from 'three';
import { TEAMS } from '../game/character.js';
import { WEAPONS } from '../game/weapons.js';
import { MAP } from '../world/mapData.js';

const CUT_WORDS = {
  head: ['KRAK!', 'BONK!', 'HEADSHOT!'],
  knife: ['SHNK!', 'SLASH!'],
  multi: ['WHAM-BAM!', 'TRIPLE!', 'RAMPAGE!'],
  last: ['THE END!', 'FIN!', 'K.O.!'],
  snipe: ['PEW!', 'ZING!'],
  kill: ['KAPOW!', 'SPLAT!'],
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const v3 = new THREE.Vector3();

export class PanelDirector {
  constructor(game, root) {
    this.game = game;
    this.layer = document.createElement('div');
    this.layer.className = 'panel-cut';
    root.appendChild(this.layer);
    this.reset();
  }

  reset() {
    this.highlights = [];
    this.pending = null;
    this.cut = null;
    this.lastCut = -99;
    this.layer.innerHTML = '';
  }

  // --- triggers ---------------------------------------------------------------
  onKill(attacker, victim, def, head) {
    const g = this.game, p = g.player;
    if (!attacker || attacker !== p) {
      if (victim === p && attacker) {
        this.request({ kind: 'death', attacker, victim, def, head, tags: [], cut: false });
      }
      return;
    }
    const tags = [];
    if (head) tags.push('head');
    if (def.cat === 'knife') tags.push('knife');
    if ((attacker.roundKills || 0) >= 3) tags.push('multi');
    if (g.match.alive(victim.team).length === 0) tags.push('last');
    if (def.cat === 'sniper') tags.push('snipe');
    const cut = g.settings.panelCuts && tags.length > 0 && g.time - this.lastCut > 4;
    this.request({ kind: 'kill', attacker, victim, def, head, tags, cut });
  }

  onRoundEnd(win, reason, mvp) {
    const why = { elim: '全员击倒', bomb: '墨爆罐引爆', defuse: '墨爆罐被拆除', time: '时间耗尽' }[reason];
    this.request({ kind: 'round', win, reason, mvp, caption: `第 ${this.game.match.round} 回合 · ${TEAMS[win].name}胜（${why}）`, cut: false });
  }

  request(r) {
    // one capture per frame; kills win over round summaries
    if (this.pending && this.pending.kind === 'kill' && r.kind !== 'kill') return;
    this.pending = r;
  }

  /** Called right after the frame is presented, so the canvas still holds it. */
  afterRender() {
    const r = this.pending;
    if (!r) return;
    this.pending = null;
    const g = this.game;
    const snap = g.cr.snapshot(720);
    const url = snap.toDataURL('image/jpeg', 0.82);
    let focus = { x: 0.5, y: 0.5 };
    if (r.victim) {
      v3.copy(r.victim.pos); v3.y += 1.3;
      v3.project(g.camera);
      if (v3.z < 1) focus = { x: THREE.MathUtils.clamp(v3.x * 0.5 + 0.5, 0.1, 0.9), y: THREE.MathUtils.clamp(-v3.y * 0.5 + 0.5, 0.1, 0.9) };
    }
    const word = r.kind === 'kill' ? pick(CUT_WORDS[r.tags[0]] || CUT_WORDS.kill) : r.kind === 'death' ? 'OUCH!' : r.win === g.player.team ? 'YEAH!' : 'DRAT!';
    const wname = r.def ? (WEAPONS[r.def.id]?.name || r.def.name || '') : '';
    let caption = r.caption;
    if (r.kind === 'kill') {
      const how = r.tags.includes('knife') ? '一刀放倒了' : r.head ? '爆头击倒了' : '击倒了';
      const extra = r.tags.includes('last') ? '——最后一人！' : r.tags.includes('multi') ? `——本回合第 ${r.attacker.roundKills} 杀！` : '';
      caption = `你用${wname}${how}${r.victim.name}${extra}`;
    } else if (r.kind === 'death') {
      caption = `${r.attacker.name}用${wname}把你画上了句号`;
    }
    const hl = {
      url, focus, word, caption, kind: r.kind, tags: r.tags || [], round: g.match.round, aspect: snap.width / snap.height,
      team: r.attacker?.team || r.win, score: { ...g.match.score },
      weight: r.kind === 'kill' ? 2 + (r.tags?.length || 0) * 2 : r.kind === 'round' ? 1.5 : 1,
    };
    this.highlights.push(hl);
    if (this.highlights.length > 40) {
      // keep the best ones
      this.highlights.sort((a, b) => b.weight - a.weight);
      this.highlights.length = 30;
      this.highlights.sort((a, b) => a.round - b.round);
    }
    if (r.cut) this.playCut(hl);
  }

  playCut(hl) {
    const g = this.game;
    this.lastCut = g.time;
    g.audio.panelCut?.();
    const tc = TEAMS[g.player.team].color;
    // a compact comic strip beside the kill feed — the match keeps running
    this.layer.innerHTML = `
      <div class="pc-wrap" style="--tc:${tc}">
        <div class="pc-panel pc-a" style="background-image:url(${hl.url})"></div>
        <div class="pc-panel pc-b" style="background-image:url(${hl.url})">
          <div class="pc-speed"></div><div class="pc-word"><span>${hl.word}</span></div>
        </div>
        <div class="pc-panel pc-c"><div class="pc-cap">${hl.caption}</div></div>
      </div>`;
    const zoomPanel = this.layer.querySelector('.pc-b');
    const w = zoomPanel.offsetWidth, h = zoomPanel.offsetHeight;
    const iw = Math.max(w, h * hl.aspect) * 2.4, ih = iw / hl.aspect;
    const bx = THREE.MathUtils.clamp(w / 2 - hl.focus.x * iw, w - iw, 0);
    const by = THREE.MathUtils.clamp(h / 2 - hl.focus.y * ih, h - ih, 0);
    zoomPanel.style.backgroundSize = `${iw}px ${ih}px`;
    zoomPanel.style.backgroundPosition = `${bx}px ${by}px`;
    this.cut = { t: 0, dur: 1.9 };
  }

  update(realDt) {
    if (!this.cut) return;
    this.cut.t += realDt;
    const t = this.cut.t;
    if (t > this.cut.dur - 0.25 && !this.cut.out) {
      this.cut.out = true;
      this.layer.querySelector('.pc-wrap')?.classList.add('out');
    }
    if (t > this.cut.dur) {
      this.cut = null;
      this.layer.innerHTML = '';
    }
  }

  // --- the comic page ------------------------------------------------------
  pickHighlights(n = 7) {
    const hs = [...this.highlights];
    const chosen = [...hs].sort((a, b) => b.weight - a.weight).slice(0, n);
    // always keep the final round panel if we have one
    const last = [...hs].reverse().find((h) => h.kind === 'round');
    if (last && !chosen.includes(last)) { chosen.pop(); chosen.push(last); }
    return chosen.sort((a, b) => a.round - b.round || (a.kind === 'round') - (b.kind === 'round'));
  }

  async buildPage() {
    const g = this.game, m = g.match;
    const W = 1240, H = 1754;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const ink = '#1b1626';
    x.fillStyle = '#fff6dc'; x.fillRect(0, 0, W, H);
    // halftone paper
    x.fillStyle = 'rgba(255,180,90,0.10)';
    for (let yy = 0; yy < H; yy += 12) for (let xx = (yy / 12) % 2 ? 6 : 0; xx < W; xx += 12) { x.beginPath(); x.arc(xx, yy, 2.2, 0, 6.28); x.fill(); }

    // masthead
    x.fillStyle = '#ffd23f'; x.fillRect(30, 30, W - 60, 210);
    x.lineWidth = 10; x.strokeStyle = ink; x.strokeRect(30, 30, W - 60, 210);
    x.save();
    x.font = '900 150px Bangers, Impact, sans-serif'; x.textBaseline = 'alphabetic';
    x.lineWidth = 16; x.strokeStyle = ink; x.strokeText('STRIKE-S!', 60, 190);
    x.fillStyle = '#ff4f5e'; x.fillText('STRIKE-S!', 60, 190);
    x.restore();
    x.font = '700 30px "ZCOOL KuaiLe", sans-serif'; x.fillStyle = ink;
    x.fillText(`${MAP.name} · 实况战报`, 660, 92);
    const d = new Date();
    x.font = '700 22px "ZCOOL KuaiLe", sans-serif';
    x.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, 660, 130);
    x.fillText(`全 ${m.round} 回合 · 完结篇`, 660, 162);
    // score badge
    const myTeam = g.player.team;
    burst(x, 1100, 150, 86, 58, 14, m.winner === myTeam ? '#2ec4ff' : '#ff4f5e');
    x.font = '900 50px Bangers, Impact'; x.textAlign = 'center'; x.fillStyle = '#ffffff';
    x.lineWidth = 7; x.strokeStyle = ink;
    const sc = `${m.score[myTeam]}:${m.score[myTeam === 'T' ? 'CT' : 'T']}`;
    x.strokeText(sc, 1100, 168); x.fillText(sc, 1100, 168);
    x.textAlign = 'left';

    // panels
    const hs = this.pickHighlights(7);
    const imgs = await Promise.all(hs.map((h) => loadImg(h.url)));
    const rows = layoutRows(hs.length);
    const top = 270, bottom = H - 230, gutter = 18;
    const rowH = (bottom - top - gutter * (rows.length - 1)) / rows.length;
    let k = 0;
    rows.forEach((widths, ri) => {
      let cx = 30;
      const y = top + ri * (rowH + gutter);
      const total = W - 60 - gutter * (widths.length - 1);
      widths.forEach((wf) => {
        const w = total * wf;
        const h = hs[k], img = imgs[k];
        k++;
        drawPanel(x, img, h, cx, y, w, rowH, ri % 2 ? 0.006 : -0.006);
        cx += w + gutter;
      });
    });

    // footer: stats strip
    const p = g.player;
    x.fillStyle = '#ffffff'; x.fillRect(30, H - 200, W - 60, 170);
    x.lineWidth = 10; x.strokeStyle = ink; x.strokeRect(30, H - 200, W - 60, 170);
    x.fillStyle = ink; x.font = '700 34px "ZCOOL KuaiLe", sans-serif';
    x.fillText(`本期主角：${p.name}（${TEAMS[p.team].name}）`, 60, H - 150);
    x.font = '700 28px "ZCOOL KuaiLe", sans-serif';
    x.fillText(`击倒 ${p.stats.kills} · 阵亡 ${p.stats.deaths} · 助攻 ${p.stats.assists} · 爆头 ${p.stats.hs} · 伤害 ${p.stats.dmg}`, 60, H - 105);
    const best = [...g.chars].sort((a, b) => b.stats.kills - a.stats.kills)[0];
    x.fillText(`全场最佳：${best.name}（${best.stats.kills} 杀）`, 60, H - 62);
    x.font = '900 40px Bangers, Impact'; x.fillStyle = '#ff4f5e'; x.textAlign = 'right';
    x.fillText('TO BE CONTINUED…', W - 60, H - 62);
    x.textAlign = 'left';
    return c;
  }
}

function burst(x, cx, cy, rOut, rIn, n, fill) {
  x.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? rIn : rOut;
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  x.closePath();
  x.fillStyle = fill; x.fill();
  x.lineWidth = 8; x.strokeStyle = '#1b1626'; x.stroke();
}

function loadImg(url) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
}

/** Fractional panel widths per row for n panels. */
function layoutRows(n) {
  switch (n) {
    case 0: return [];
    case 1: return [[1]];
    case 2: return [[1], [1]];
    case 3: return [[0.6, 0.4], [1]];
    case 4: return [[0.6, 0.4], [0.4, 0.6]];
    case 5: return [[0.6, 0.4], [0.34, 0.33, 0.33]];
    case 6: return [[0.6, 0.4], [0.5, 0.5], [0.42, 0.58]];
    default: return [[0.6, 0.4], [0.34, 0.33, 0.33], [0.42, 0.58]];
  }
}

function drawPanel(x, img, h, px, py, w, hgt, tilt) {
  const ink = '#1b1626';
  x.save();
  x.translate(px + w / 2, py + hgt / 2);
  x.rotate(tilt);
  x.translate(-w / 2, -hgt / 2);
  x.beginPath(); x.rect(0, 0, w, hgt); x.save(); x.clip();
  if (img) {
    // cover-fit, nudged toward the focus point for kills
    const zoom = h.kind === 'kill' ? 1.35 : 1.0;
    const s = Math.max(w / img.width, hgt / img.height) * zoom;
    const iw = img.width * s, ih = img.height * s;
    const fx = h.focus?.x ?? 0.5, fy = h.focus?.y ?? 0.5;
    const ox = THREE.MathUtils.clamp(w / 2 - fx * iw, w - iw, 0);
    const oy = THREE.MathUtils.clamp(hgt / 2 - fy * ih, hgt - ih, 0);
    x.drawImage(img, ox, oy, iw, ih);
    if (h.kind === 'kill') {
      // speed lines around the focus
      x.strokeStyle = 'rgba(27,22,38,0.55)'; x.lineWidth = 3;
      const cx = ox + fx * iw, cy = oy + fy * ih;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2 + Math.random() * 0.05;
        const r0 = Math.min(w, hgt) * (0.32 + Math.random() * 0.12), r1 = Math.max(w, hgt);
        x.beginPath(); x.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); x.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); x.stroke();
      }
    }
  } else {
    x.fillStyle = '#2b3a7a'; x.fillRect(0, 0, w, hgt);
  }
  x.restore();
  x.lineWidth = 10; x.strokeStyle = ink; x.strokeRect(0, 0, w, hgt);
  // caption box
  x.font = '700 24px "ZCOOL KuaiLe", sans-serif';
  const text = h.caption || '';
  const tw = Math.min(w - 40, x.measureText(text).width + 30);
  x.fillStyle = '#ffd23f'; x.fillRect(12, 12, tw, 44);
  x.lineWidth = 5; x.strokeRect(12, 12, tw, 44);
  x.fillStyle = ink; x.textBaseline = 'middle';
  x.fillText(text, 27, 35, tw - 30);
  // onomatopoeia
  if (h.word) {
    const size = Math.min(110, Math.max(54, w / 6));
    x.font = `900 ${size}px Bangers, Impact, sans-serif`;
    x.textAlign = 'right'; x.textBaseline = 'alphabetic';
    x.lineWidth = size / 6; x.strokeStyle = ink;
    x.save();
    x.translate(w - 24, hgt - 28);
    x.rotate(-0.12);
    x.strokeText(h.word, 0, 0);
    x.fillStyle = h.kind === 'death' ? '#ff4f5e' : '#ffd23f';
    x.fillText(h.word, 0, 0);
    x.restore();
    x.textAlign = 'left';
  }
  x.restore();
}
