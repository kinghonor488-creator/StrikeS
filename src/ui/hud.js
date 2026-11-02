// In-match HUD: clean, readable tactical layout with small comic accents.
import * as THREE from 'three';
import { TEAMS } from '../game/character.js';
import { WEAPONS } from '../game/weapons.js';
import { RULES } from '../game/match.js';

const h = (tag, cls, html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const ICON = {
  hp: '<svg viewBox="0 0 24 24"><path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" fill="currentColor"/></svg>',
  armor: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V5z" fill="currentColor"/></svg>',
  helmet: '<svg viewBox="0 0 24 24"><path d="M3 15c0-5 4-9 9-9s9 4 9 9v2H3z" fill="currentColor"/></svg>',
  head: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>',
  bomb: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="10" rx="2" fill="currentColor"/><rect x="9" y="5" width="6" height="4" fill="currentColor"/></svg>',
  kit: '<svg viewBox="0 0 24 24"><path d="M4 7h16v12H4zM9 3h6v4H9z" fill="currentColor"/></svg>',
};

export class HUD {
  constructor(game, root) {
    this.game = game;
    this.root = h('div', 'hud');
    root.appendChild(this.root);
    const r = this.root;

    this.top = h('div', 'hud-top', `
      <div class="ts t"><b class="num">0</b><div class="pips"></div></div>
      <div class="clock"><div class="round-lbl"></div><div class="timer">1:55</div></div>
      <div class="ts ct"><div class="pips"></div><b class="num">0</b></div>`);
    r.appendChild(this.top);

    this.mini = h('canvas', 'radar');
    this.mini.width = this.mini.height = 240;
    r.appendChild(this.mini);
    this.radarLbl = h('div', 'radar-lbl');
    r.appendChild(this.radarLbl);
    this.money = h('div', 'money', '$800');
    r.appendChild(this.money);

    this.vitals = h('div', 'vitals', `
      <div class="hp"><i>${ICON.hp}</i><b>100</b><span class="bar"><span></span></span></div>
      <div class="ar"><i>${ICON.armor}</i><b>0</b><em class="helm">${ICON.helmet}</em><em class="kit">${ICON.kit}</em></div>`);
    r.appendChild(this.vitals);

    this.ammo = h('div', 'ammo', `<div class="wname"></div><div class="count"><b class="mag">12</b><span class="res">/ 24</span></div>`);
    r.appendChild(this.ammo);

    this.inkBox = h('div', 'ink', `<div class="ink-head"><span>墨水</span><b>40</b></div><div class="ink-bar"><span></span></div><div class="ink-tools"></div>`);
    r.appendChild(this.inkBox);

    this.cross = h('div', 'crosshair', '<i class="l"></i><i class="r"></i><i class="u"></i><i class="d"></i><i class="dot"></i>');
    r.appendChild(this.cross);
    this.hitm = h('div', 'hitmarker', '<i></i><i></i><i></i><i></i>');
    r.appendChild(this.hitm);
    this.killConf = h('div', 'killconf');
    r.appendChild(this.killConf);
    this.killConfT = 0;
    this.scope = h('div', 'scope', '<div class="lens"></div><div class="reticle"></div>');
    r.prepend(this.scope); // under every other HUD element, like CS2

    this.feed = h('div', 'killfeed');
    r.appendChild(this.feed);
    this.banner = h('div', 'banner');
    r.appendChild(this.banner);
    this.hint = h('div', 'hint');
    r.appendChild(this.hint);
    this.progress = h('div', 'progress', '<div class="plabel"></div><div class="pbar"><div class="pfill"></div></div>');
    r.appendChild(this.progress);
    this.dmgArrows = h('div', 'dmg-arrows');
    r.appendChild(this.dmgArrows);
    this.deathCap = h('div', 'death-caption');
    r.appendChild(this.deathCap);
    this.carrier = h('div', 'carrier', `${ICON.bomb}<span>你携带着墨爆罐</span>`);
    r.appendChild(this.carrier);
    this.spec = h('div', 'spectating');
    r.appendChild(this.spec);
    this.board = h('div', 'scoreboard');
    r.appendChild(this.board);

    this.hitT = 0;
    this.bannerT = 0;
    this.feedItems = [];
  }

  show(v) { this.root.style.display = v ? '' : 'none'; }

  addKill({ killer, victim, weapon, head, killerTeam, victimTeam }) {
    const el = h('div', 'feed-item');
    const kc = TEAMS[killerTeam]?.color || '#aaa';
    const vc = TEAMS[victimTeam]?.color || '#aaa';
    const wtag = weapon === 'bomb' ? `<span class="w">${ICON.bomb}</span>` : `<span class="w">${WEAPONS[weapon]?.en || weapon}</span>`;
    el.innerHTML = `${killer ? `<b style="color:${kc}">${killer}</b>` : ''}${wtag}${head ? `<span class="hs">${ICON.head}</span>` : ''}<b style="color:${vc}">${victim}</b>`;
    const me = this.game.player?.name;
    if (killer === me) el.classList.add('mine');
    if (victim === me) el.classList.add('me-dead');
    this.feed.prepend(el);
    this.feedItems.push({ el, t: this.game.time });
    while (this.feed.children.length > 6) this.feed.lastChild.remove();
  }

  hitMarker(head, kill) {
    this.hitT = kill ? 0.32 : 0.16;
    this.hitm.className = 'hitmarker';
    void this.hitm.offsetWidth; // restart the pop animation on every hit
    this.hitm.className = 'hitmarker on' + (head ? ' head' : '') + (kill ? ' kill' : '');
  }

  /** One mark per kill this round under the crosshair (gold for headshots). */
  killConfirm(kills) {
    this.killConf.innerHTML = kills.map((hs, i) => `<b class="${hs ? 'hs' : ''} ${i === kills.length - 1 ? 'new' : ''}">${hs ? '◎' : '✕'}</b>`).join('');
    this.killConf.classList.add('on');
    this.killConfT = 1.8;
  }

  showBanner(title, sub = '', color = '#f2b134', dur = 3) {
    this.banner.innerHTML = `<div class="b-title" style="--bc:${color}">${title}</div>${sub ? `<div class="b-sub">${sub}</div>` : ''}`;
    this.banner.classList.remove('on');
    void this.banner.offsetWidth;
    this.banner.classList.add('on');
    this.bannerT = dur;
  }

  damageFrom(dirAngle) {
    const a = h('div', 'dmg-arrow');
    a.style.setProperty('--a', `${dirAngle}rad`);
    this.dmgArrows.appendChild(a);
    setTimeout(() => a.remove(), 1100);
  }

  setDeathCaption(text) {
    this.deathCap.innerHTML = text;
    this.deathCap.classList.toggle('on', !!text);
  }

  update(dt) {
    const g = this.game, p = g.viewTarget || g.player, m = g.match;
    if (!p) return;
    const me = g.player;

    // clock + score
    const tl = Math.max(0, m.timeLeft());
    const timer = this.top.querySelector('.timer');
    timer.textContent = `${Math.floor(tl / 60)}:${String(Math.floor(tl % 60)).padStart(2, '0')}`;
    timer.classList.toggle('bomb', m.bomb.state === 'planted');
    timer.classList.toggle('low', m.phase === 'live' && m.bomb.state !== 'planted' && tl < 10);
    const lbl = this.top.querySelector('.round-lbl');
    lbl.innerHTML = m.bomb.state === 'planted' ? `${ICON.bomb} 墨爆罐 · ${m.bomb.site}` : m.phase === 'freeze' ? `第 ${m.round} 回合 · 购买时间` : `第 ${m.round} 回合`;
    const tBox = this.top.querySelector('.ts.t'), ctBox = this.top.querySelector('.ts.ct');
    tBox.querySelector('.num').textContent = m.score.T;
    ctBox.querySelector('.num').textContent = m.score.CT;
    const pips = (team) => m.team(team).map((c) => `<i class="${c.alive ? 'on' : ''}" style="--tc:${TEAMS[team].color}"></i>`).join('');
    tBox.querySelector('.pips').innerHTML = pips('T');
    ctBox.querySelector('.pips').innerHTML = pips('CT');

    // vitals
    const hp = Math.max(0, Math.ceil(p.hp));
    this.vitals.querySelector('.hp b').textContent = hp;
    this.vitals.querySelector('.hp .bar span').style.width = `${hp}%`;
    this.vitals.classList.toggle('low', hp <= 25 && p.alive);
    this.vitals.querySelector('.ar b').textContent = Math.ceil(p.armor);
    this.vitals.querySelector('.helm').style.display = p.helmet && p.armor > 0 ? '' : 'none';
    this.vitals.querySelector('.kit').style.display = p.kit ? '' : 'none';
    this.money.textContent = `$${me.money}`;
    this.money.style.display = p === me ? '' : 'none';

    // ammo
    const w = p.weapon;
    if (w) {
      const isGun = !!w.def.mag;
      this.ammo.querySelector('.wname').textContent = `${w.def.name} · ${w.def.en}`;
      this.ammo.querySelector('.count').style.visibility = isGun ? 'visible' : 'hidden';
      this.ammo.querySelector('.mag').textContent = w.ammo;
      this.ammo.querySelector('.res').textContent = `/ ${w.reserve}`;
      this.ammo.classList.toggle('low', isGun && w.ammo <= Math.ceil(w.def.mag * 0.2));
      this.ammo.classList.toggle('reloading', !!w.reloading);
    }

    // ink
    this.inkBox.querySelector('.ink-head b').textContent = Math.floor(p.ink);
    this.inkBox.querySelector('.ink-bar span').style.width = `${Math.min(100, p.ink)}%`;
    this.inkBox.querySelector('.ink-tools').innerHTML = g.ink ? g.ink.toolsHTML(p) : '';
    this.inkBox.classList.toggle('active', p.def?.cat === 'ink');

    // crosshair: classic four lines whose gap follows the real inaccuracy
    const s = g.settings;
    const spread = p.inaccuracy();
    const fovRad = THREE.MathUtils.degToRad(g.camera.fov);
    const px = Math.tan(spread) / Math.tan(fovRad / 2) * (window.innerHeight / 2);
    const gap = s.crosshair === 'static' ? 4 : Math.min(70, 3 + px);
    this.cross.style.setProperty('--gap', `${gap}px`);
    this.cross.style.setProperty('--cc', s.crossColor || '#5dff7a');
    const scopeStyle = p.scoped ? (p.def?.scope?.style || 'sniper') : null;
    const showCross = p.alive && !g.menuOpen && !scopeStyle && p.def?.cat !== 'sniper';
    this.cross.style.display = showCross ? '' : 'none';
    this.scope.className = `scope ${scopeStyle && p.alive ? 'on ' + scopeStyle : ''}`;

    if (this.hitT > 0) { this.hitT -= dt; if (this.hitT <= 0) this.hitm.className = 'hitmarker'; }
    if (this.killConfT > 0) { this.killConfT -= dt; if (this.killConfT <= 0) this.killConf.classList.remove('on'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('on'); }
    for (const it of this.feedItems) if (g.time - it.t > 7) it.el.classList.add('old');

    // plant / defuse progress
    const act = p.action;
    if (act) {
      const k = Math.min(1, (g.time - act.t0) / act.dur);
      this.progress.classList.add('on');
      this.progress.querySelector('.plabel').textContent = act.type === 'plant' ? '正在安放墨爆罐' : (p.kit ? '正在拆除（修正液）' : '正在拆除');
      this.progress.querySelector('.pfill').style.width = `${k * 100}%`;
    } else this.progress.classList.remove('on');

    let hint = '';
    if (p === me && p.alive && (m.phase === 'live' || m.phase === 'freeze')) {
      if (m.canBuy(p) && !g.menuOpen) hint = '<kbd>B</kbd> 打开商店';
      if (m.phase === 'live' && p.hasBomb && m.siteAt(p.pos)) hint = '按住 <kbd>E</kbd> 安放墨爆罐';
      if (m.phase === 'live' && p.team === 'CT' && m.bomb.state === 'planted' && p.pos.distanceTo(m.bomb.pos) < 1.8) hint = '按住 <kbd>E</kbd> 拆除墨爆罐';
    }
    this.hint.innerHTML = hint;
    this.hint.classList.toggle('on', !!hint);
    this.carrier.style.display = p === me && p.hasBomb && p.alive ? '' : 'none';
    this.spec.style.display = p !== me && !g.deathCam ? '' : 'none';
    if (p !== me) this.spec.innerHTML = `观战中 · <b style="color:${TEAMS[p.team].color}">${p.name}</b> <small>左键切换</small>`;

    this.drawRadar(p);
    this.radarLbl.textContent = this.zoneName(p);
    if (g.input.key('Tab')) this.renderBoard(); else this.board.classList.remove('on');
  }

  zoneName(p) {
    for (const [x1, z1, x2, z2, label] of this.game.map.walk) {
      if (p.pos.x >= x1 && p.pos.x <= x2 && p.pos.z >= z1 && p.pos.z <= z2) return label;
    }
    return '';
  }

  drawRadar(p) {
    const g = this.game, map = g.map, c = this.mini, ctx = c.getContext('2d');
    const S = c.width;
    const zoom = 2.4; // px per metre, centred on the viewer and rotated with them
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(14,18,24,0.78)'; ctx.fillRect(0, 0, S, S);
    ctx.translate(S / 2, S / 2);
    ctx.rotate(p.yaw);
    ctx.scale(zoom, zoom);
    ctx.translate(-p.pos.x, -p.pos.z);
    ctx.fillStyle = 'rgba(205,214,222,0.30)';
    for (const [x1, z1, x2, z2] of map.walk) ctx.fillRect(x1, z1, x2 - x1, z2 - z1);
    for (const [id, s] of Object.entries(map.sites)) {
      ctx.fillStyle = 'rgba(232,85,63,0.22)';
      ctx.fillRect(s.x1, s.z1, s.x2 - s.x1, s.z2 - s.z1);
      ctx.save();
      ctx.translate((s.x1 + s.x2) / 2, (s.z1 + s.z2) / 2);
      ctx.rotate(-p.yaw);
      ctx.fillStyle = '#ffd36b'; ctx.font = '900 9px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(id, 0, 0);
      ctx.restore();
    }
    const b = g.match.bomb;
    if ((b.state === 'dropped' || b.state === 'planted') && (p.team === 'T' || b.state === 'planted')) {
      ctx.fillStyle = b.state === 'planted' && Math.sin(g.time * 10) > 0 ? '#ff4040' : '#ffb347';
      ctx.fillRect(b.pos.x - 1, b.pos.z - 0.7, 2, 1.4);
    }
    for (const ch of g.chars) {
      const ally = ch.team === p.team;
      const spotted = !ally && ch.alive && g.time - (ch.spottedAt || -99) < 1.5;
      if (!ally && !spotted) continue;
      ctx.save();
      ctx.translate(ch.pos.x, ch.pos.z);
      if (!ch.alive) {
        ctx.strokeStyle = 'rgba(200,200,200,0.6)'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(-1, -1); ctx.lineTo(1, 1); ctx.moveTo(1, -1); ctx.lineTo(-1, 1); ctx.stroke();
      } else {
        ctx.rotate(-ch.yaw);
        ctx.fillStyle = ch === p ? '#ffffff' : ally ? TEAMS[ch.team].color : '#ff3b3b';
        ctx.beginPath(); ctx.arc(0, 0, 1.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-0.7, -1.0); ctx.lineTo(0, -2.4); ctx.lineTo(0.7, -1.0); ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }

  renderBoard() {
    const g = this.game, m = g.match;
    const row = (c) => `<tr class="${c === g.player ? 'me' : ''} ${c.alive ? '' : 'dead'}"><td>${c.name}${c.hasBomb ? ' <span class="tag">墨爆罐</span>' : ''}</td><td>${c.slots[1] ? WEAPONS[c.slots[1].id].en : ''}</td><td>${c.stats.kills}</td><td>${c.stats.assists}</td><td>${c.stats.deaths}</td><td>${c.stats.dmg}</td><td>$${c.money}</td></tr>`;
    const sec = (t) => `<div class="sb-team" style="--tc:${TEAMS[t].color}"><h3><b>${m.score[t]}</b> ${TEAMS[t].name} <small>${TEAMS[t].en}</small></h3>
      <table><tr><th>玩家</th><th>主武器</th><th>K</th><th>A</th><th>D</th><th>伤害</th><th>金钱</th></tr>${m.team(t).sort((a, b) => b.stats.kills - a.stats.kills).map(row).join('')}</table></div>`;
    this.board.innerHTML = `<div class="sb-title">墨水街 · 第 ${m.round} 回合 · 先赢 ${RULES.winRounds} 局</div>${sec('CT')}${sec('T')}`;
    this.board.classList.add('on');
  }
}
