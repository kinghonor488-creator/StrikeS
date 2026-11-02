// The shop: team-filtered loadout grid with real handling stats and baked gun renders.
import { WEAPONS, GEAR, BUY_LIST, availableTo } from '../game/weapons.js';
import { RULES } from '../game/match.js';
import { gunIcons } from './gunIcons.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function statBars(w) {
  const dmg = clamp01((w.dmg * (w.pellets || 1)) / 150);
  const rate = clamp01(w.rpm / 900);
  const acc = clamp01(1 - ((w.spread.scoped ?? w.spread.stand) - 0.003) / 0.06);
  const mob = clamp01((w.speed - 4.6) / (6.35 - 4.6));
  const bar = (label, v) => `<div class="stat"><label>${label}</label><i style="--v:${v.toFixed(2)}"></i></div>`;
  return `<div class="stats">${bar('伤害', dmg) + bar('射速', rate) + bar('精准', acc) + bar('机动', mob)}</div>`;
}

export class BuyMenu {
  constructor(game, root) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'buy-menu';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const card = e.target.closest('[data-buy]');
      if (card) this.purchase(card.dataset.buy);
      if (e.target.closest('[data-close]')) this.close();
    });
    this.el.addEventListener('mouseover', (e) => {
      const card = e.target.closest('[data-buy]');
      if (card && card !== this.hovered) { this.hovered = card; this.game.audio.uiHover(); this.showDetail(card.dataset.buy); }
    });
    addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Escape') { e.preventDefault(); this.close(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && this.order[n - 1]) this.purchase(this.order[n - 1]);
    });
    this.order = [];
  }

  get isOpen() { return this.el.classList.contains('on'); }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  open() {
    const g = this.game, p = g.player;
    if (!g.match.canBuy(p)) {
      g.audio.deny();
      g.sfx.pop('现在不能购买', { x: 0.5, y: 0.62 }, { size: 22, color: '#ff6b5a', life: 1, rot: 0, style: 'plain' });
      return;
    }
    g.menuOpen = true;
    g.input.unlock();
    this.render();
    this.el.classList.add('on');
    g.audio.uiClick();
  }

  close(relock = true) {
    if (!this.isOpen) return;
    this.el.classList.remove('on');
    this.game.menuOpen = false;
    if (!relock) return;
    this.game.input.lock();
    // Esc is not a user gesture, so the re-lock can fail: fall back to the pause sheet
    setTimeout(() => {
      const g = this.game;
      if (g.running && !g.input.locked && !g.menuOpen) this.onRelockFailed?.();
    }, 300);
  }

  purchase(id) {
    const g = this.game;
    if (g.buy(g.player, id)) this.render();
    else g.audio.deny();
  }

  update() {
    if (this.isOpen && !this.game.match.canBuy(this.game.player)) this.close();
  }

  render() {
    const g = this.game, p = g.player;
    const icons = gunIcons(Object.keys(WEAPONS).filter((id) => WEAPONS[id].mag));
    this.order = [];
    const cols = BUY_LIST.map((cat) => {
      const cards = cat.items.filter((id) => availableTo(id, p.team)).map((id) => {
        this.order.push(id);
        const key = this.order.length;
        const w = WEAPONS[id], gear = GEAR[id];
        const item = w || gear;
        let price = item.price;
        if (id === 'vesthelm' && p.armor >= 100 && !p.helmet) price = 350;
        const owned = w ? p.slots[w.slot]?.id === id
          : id === 'vest' ? p.armor >= 100 : id === 'vesthelm' ? p.armor >= 100 && p.helmet : id === 'kit' ? p.kit : id === 'ink' ? p.ink >= 100 : false;
        const afford = p.money >= price;
        const body = w
          ? (icons[id] ? `<img class="bc-icon" src="${icons[id]}" alt="">` : '')
          : `<div class="gear-desc">${{ vest: '胸腹伤害大幅降低', vesthelm: '再加头盔，挡住大部分爆头伤害', kit: '拆除时间 7 秒 → 3.6 秒', ink: '墨水 +40，画墨墙和墨云用' }[id]}</div>`;
        return `<div class="buy-card ${owned ? 'owned' : ''} ${afford ? '' : 'poor'}" data-buy="${id}">
          <div class="bc-top"><span class="bc-key">${key <= 9 ? key : ''}</span><span class="bc-name">${item.name}</span><span class="bc-en">${item.en}</span></div>
          ${body}
          <div class="bc-price">${owned ? '已装备' : `$${price}`}</div>
        </div>`;
      }).join('');
      return cards ? `<div class="buy-col"><h3>${cat.cat}</h3>${cards}</div>` : '';
    }).join('');
    const left = Math.max(0, Math.ceil(RULES.buyWindow - (g.time - g.match.roundStart)));
    this.el.innerHTML = `
      <div class="buy-page">
        <div class="buy-head">
          <div class="buy-title">墨水街军火铺<small>${p.team === 'T' ? '涂鸦帮供货' : '橡皮擦配给'} · 出生点附近可购买${g.match.phase === 'live' ? ` · 剩余 ${left} 秒` : ''}</small></div>
          <div class="buy-money">$${p.money}</div>
          <button class="buy-close" data-close>✕</button>
        </div>
        <div class="buy-cols">${cols}</div>
        <div class="buy-detail"></div>
        <div class="buy-foot">点击或数字键购买 · <kbd>B</kbd> / <kbd>Esc</kbd> 关闭</div>
      </div>`;
    this.hovered = null;
    this.showDetail(p.slots[1]?.id || p.slots[2]?.id);
  }

  /** Bottom strip with the hovered gun's handling numbers (CS2-style detail panel). */
  showDetail(id) {
    const box = this.el.querySelector('.buy-detail');
    const w = WEAPONS[id];
    if (!box) return;
    if (!w || !w.mag) { box.innerHTML = `<span class="bd-name">${(GEAR[id] || {}).name || ''}</span>`; return; }
    const pen = w.armorPen != null ? `${Math.round(w.armorPen * 100)}%` : '—';
    box.innerHTML = `<span class="bd-name">${w.name} <small>${w.en}</small></span>${statBars(w)}
      <span class="bd-nums"><b>${w.dmg}${w.pellets ? '×' + w.pellets : ''}</b>伤害 <b>${w.rpm}</b>RPM <b>${w.mag}/${w.reserve ?? ''}</b>弹匣 <b>${pen}</b>穿甲 <b>$${w.killReward ?? 300}</b>击杀奖励</span>`;
  }
}
