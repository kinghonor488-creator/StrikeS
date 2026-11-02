// Title "cover", match setup, pause, settings, controls and the end-of-match comic.
import { TEAMS } from '../game/character.js';

const SETTINGS = [
  { key: 'sens', name: '鼠标灵敏度', min: 0.2, max: 3, step: 0.05 },
  { key: 'fov', name: '视野 FOV', min: 60, max: 95, step: 1 },
  { key: 'volume', name: '音量', min: 0, max: 1, step: 0.05 },
];
const SELECTS = [
  { key: 'quality', name: '画质', options: [['low', '低'], ['medium', '中'], ['high', '高'], ['ultra', '极高']] },
  { key: 'crosshair', name: '准星', options: [['dynamic', '动态'], ['static', '静态']] },
  { key: 'crossColor', name: '准星颜色', options: [['#5dff7a', '绿'], ['#ffffff', '白'], ['#ffe14d', '黄'], ['#4de1ff', '青'], ['#ff5cf0', '粉']] },
];
const TOGGLES = [
  { key: 'comicFx', name: '漫画拟声字' },
  { key: 'panelCuts', name: '击杀漫画分格' },
];

export class Menu {
  constructor(game, root, { armory, buyMenu }) {
    this.game = game;
    this.armory = armory;
    this.buyMenu = buyMenu;
    this.el = document.createElement('div');
    this.el.className = 'menu-root';
    root.appendChild(this.el);
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('mouseover', (e) => { if (e.target.closest('button')) this.game.audio.uiHover(); });
    this.side = 'T';
    this.difficulty = game.settings.difficulty;
    this.screen = null;
    armory.onClose = () => this.show(this.back || 'title');
    this.show('title');
  }

  show(name) {
    this.screen = name;
    this.el.className = `menu-root on scr-${name}`;
    const g = this.game;
    g.hud.show(name === null && g.running);
    if (name === null) { this.el.className = 'menu-root'; this.el.innerHTML = ''; return; }
    this.el.innerHTML = this[`render_${name}`]();
  }

  hide() { this.show(null); }

  // --- screens ------------------------------------------------------------------
  render_title() {
    return `
      <div class="cover">
        <div class="cover-top"><span>No.1</span><span>墨水街特刊</span><span>¥0.00</span></div>
        <h1 class="logo"><b class="l1">STRIKE</b><b class="l2">-S!</b></h1>
        <div class="cover-sub">墨水爆破 · 5V5 战术射击</div>
        <div class="cover-mascot">${mascotSVG()}</div>
        <nav class="cover-menu">
          <button class="big" data-go="setup">开始对战 ▸</button>
          <button data-go="armory">军械库 · 画贴纸</button>
          <button data-go="settings">设置</button>
          <button data-go="help">操作说明</button>
        </nav>
        <div class="cover-blurb"><b>本期看点!</b> 用墨水在地上画出掩体 · 把手绘贴纸印在枪上 · 每一局都会变成一页漫画</div>
      </div>`;
  }

  render_setup() {
    const sideBtn = (id, label, sub) => `<button class="side-card ${this.side === id ? 'on' : ''}" data-side="${id}" style="--tc:${id === 'R' ? '#ffd23f' : TEAMS[id].color}">
      <b>${label}</b><small>${sub}</small></button>`;
    const diff = (id, label) => `<button class="${this.difficulty === id ? 'on' : ''}" data-diff="${id}">${label}</button>`;
    return `
      <div class="sheet">
        <h2>选择你的阵营</h2>
        <div class="sides">
          ${sideBtn('T', '涂鸦帮', '进攻方 · 把墨爆罐安放在 A 或 B 点')}
          ${sideBtn('CT', '橡皮擦', '防守方 · 守住包点，拆掉墨爆罐')}
          ${sideBtn('R', '随机', '交给命运')}
        </div>
        <h3>机器人难度</h3>
        <div class="diffs">${diff('easy', '简单')}${diff('normal', '普通')}${diff('hard', '困难')}</div>
        <p class="note">地图：墨水街 · 5V5 · 先赢 7 回合 · 第 6 回合后换边</p>
        <div class="row">
          <button data-go="title">◂ 返回</button>
          <button class="big" data-act="start">开打！</button>
        </div>
      </div>`;
  }

  render_settings() {
    const s = this.game.settings;
    const rows = SETTINGS.map((d) => `<label class="set-row"><span>${d.name}</span>
      <input type="range" data-set="${d.key}" min="${d.min}" max="${d.max}" step="${d.step}" value="${s[d.key]}"><em>${s[d.key]}</em></label>`).join('');
    const selects = SELECTS.map((d) => `<label class="set-row"><span>${d.name}</span>
      <select data-set="${d.key}">${d.options.map(([v, n]) => `<option value="${v}" ${s[d.key] === v ? 'selected' : ''}>${n}</option>`).join('')}</select><em></em></label>`).join('');
    const toggles = TOGGLES.map((d) => `<label class="set-row"><span>${d.name}</span><input type="checkbox" data-set="${d.key}" ${s[d.key] ? 'checked' : ''}><em></em></label>`).join('');
    return `
      <div class="sheet">
        <h2>设置</h2>
        ${rows}${selects}${toggles}
        <div class="row"><button data-go="${this.back || 'title'}">返回</button></div>
      </div>`;
  }

  render_help() {
    const k = (keys, what) => `<tr><td>${keys.map((x) => `<kbd>${x}</kbd>`).join(' ')}</td><td>${what}</td></tr>`;
    return `
      <div class="sheet help">
        <h2>操作说明</h2>
        <table>
          ${k(['W', 'A', 'S', 'D'], '移动（反向键急停：松开前进同时按后退，停稳再开枪更准）')}
          ${k(['Shift'], '静步：不发出脚步声')}${k(['Ctrl', 'C'], '蹲下：更稳，更准')}${k(['空格'], '跳跃（空中开枪极不准）')}
          ${k(['左键'], '开火 / 刀轻击')}${k(['右键'], '开镜（狙击枪两档）/ 刀重击')}${k(['R'], '换弹')}
          ${k(['1', '2', '3', '4'], '主武器 / 手枪 / 刀 / 墨水笔')}${k(['Q', '滚轮'], '快速切换')}${k(['F'], '检视武器（看看你的贴纸）')}
          ${k(['B'], '商店（出生点附近，开局 20 秒内）')}${k(['E'], '按住：安放 / 拆除墨爆罐')}${k(['Tab'], '记分板')}
          ${k(['T'], '喷漆（喷你在军械库选中的贴纸）')}
        </table>
        <div class="ink-help">
          <div><b>射击</b> 每把枪都有固定弹道：连射时准星会往上跳，向下拉鼠标压枪。跑动、跳跃时精度大幅下降，停稳或蹲下第一发最准。</div>
          <div><b>墨水笔（按 4）</b> 左键按住在场景里画，右键或 G 切换工具。</div>
          <div><b>墨墙</b> 沿地面划一道线，竖起挡子弹的墙，线越长越费墨，步枪可以打穿。</div>
          <div><b>墨云</b> 在地上画个圈，圈多大墨云就多大，挡住视线。点一下也能放一朵小的。</div>
          <div><b>涂鸦</b> 在墙上随手画个记号，队友隔着墙也能看到。</div>
          <div>墨水来源：每回合 40 · 击杀 +25 · 助攻 +10 · 商店购买</div>
        </div>
        <div class="row"><button data-go="${this.back || 'title'}">返回</button></div>
      </div>`;
  }

  render_pause() {
    const m = this.game.match;
    return `
      <div class="sheet pause">
        <h2>暂停</h2>
        <p class="note">第 ${m.round} 回合 · 涂鸦帮 ${m.score.T} : ${m.score.CT} 橡皮擦</p>
        <button class="big" data-act="resume">继续游戏</button>
        <button data-go="settings" data-back="pause">设置</button>
        <button data-go="armory" data-back="pause">军械库</button>
        <button data-go="help" data-back="pause">操作说明</button>
        <button data-act="quit">退出到标题</button>
      </div>`;
  }

  render_end() {
    const g = this.game, m = g.match;
    const win = m.winner === g.player.team;
    return `
      <div class="end">
        <div class="end-head">
          <h2 class="${win ? 'win' : 'lose'}">${win ? '胜利！' : '惜败…'}</h2>
          <div class="end-score">${TEAMS.T.name} ${m.score.T} : ${m.score.CT} ${TEAMS.CT.name}</div>
        </div>
        <div class="end-page"><div class="loading">正在排版本期漫画…</div></div>
        <div class="row">
          <button data-act="save-comic">保存漫画</button>
          <button class="big" data-act="again">再来一局</button>
          <button data-act="quit">回到标题</button>
        </div>
      </div>`;
  }

  // --- actions --------------------------------------------------------------------
  onClick(e) {
    const g = this.game;
    const t = e.target;
    const go = t.closest('[data-go]');
    if (go) {
      g.audio.unlock();
      g.audio.uiClick();
      const dest = go.dataset.go;
      // sub-screens return to wherever they were opened from (title or pause)
      if (go.dataset.back) this.back = go.dataset.back;
      else if (this.screen === 'title') this.back = 'title';
      if (dest === 'armory') { this.show(null); this.armory.open(); return; }
      this.show(dest);
      return;
    }
    const side = t.closest('[data-side]');
    if (side) { this.side = side.dataset.side; g.audio.uiClick(); this.show('setup'); return; }
    const diff = t.closest('[data-diff]');
    if (diff) { this.difficulty = diff.dataset.diff; g.settings.difficulty = this.difficulty; g.applySettings(); g.audio.uiClick(); this.show('setup'); return; }
    const act = t.closest('[data-act]')?.dataset.act;
    if (!act) return;
    g.audio.unlock();
    g.audio.uiClick();
    if (act === 'start' || act === 'again') {
      const side = this.side === 'R' ? (Math.random() < 0.5 ? 'T' : 'CT') : this.side;
      this.hide();
      g.newMatch({ side, difficulty: this.difficulty });
      g.hud.show(true);
      g.input.lock();
    } else if (act === 'resume') {
      this.hide();
      g.input.lock();
    } else if (act === 'quit') {
      g.running = false;
      g.match.phase = 'idle';
      this.back = 'title';
      this.show('title');
    } else if (act === 'save-comic') {
      if (!this.comicURL) return;
      const a = document.createElement('a');
      a.href = this.comicURL;
      a.download = `strikes-comic-${Date.now()}.png`;
      a.click();
    }
  }

  onInput(e) {
    const key = e.target.dataset.set;
    if (!key) return;
    const g = this.game;
    const el = e.target;
    g.settings[key] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
    const em = el.parentElement.querySelector('em');
    if (em && el.type === 'range') em.textContent = el.value;
    g.applySettings();
  }

  /** Pointer lock changed: show the pause sheet when the player escapes mid-match. */
  onLock(locked) {
    const g = this.game;
    if (locked) { if (this.screen) this.hide(); return; }
    if (g.running && !g.menuOpen && !g.suspended && g.match.phase !== 'over' && !this.screen) {
      this.back = 'pause';
      this.show('pause');
    }
  }

  async showMatchEnd() {
    const g = this.game;
    g.input.unlock();
    this.back = 'title';
    this.show('end');
    try {
      const page = await g.panels.buildPage();
      this.comicURL = page.toDataURL('image/png');
      const holder = this.el.querySelector('.end-page');
      if (holder) holder.innerHTML = `<img src="${this.comicURL}" alt="本局漫画">`;
    } catch (err) {
      console.error(err);
      const holder = this.el.querySelector('.end-page');
      if (holder) holder.innerHTML = '<div class="loading">漫画排版失败了…</div>';
    }
  }
}

function mascotSVG() {
  // 墨仔, the ink-drop mascot
  return `<svg viewBox="0 0 120 140" width="150" height="175">
    <path d="M60 6 C72 34 108 58 104 92 C100 122 76 132 60 132 C44 132 20 122 16 92 C12 58 48 34 60 6Z" fill="#2f2766" stroke="#1b1626" stroke-width="5"/>
    <ellipse cx="44" cy="84" rx="11" ry="14" fill="#fff"/><ellipse cx="78" cy="84" rx="11" ry="14" fill="#fff"/>
    <circle cx="47" cy="88" r="6" fill="#1b1626"/><circle cx="75" cy="88" r="6" fill="#1b1626"/>
    <path d="M48 106 Q61 118 74 106" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse cx="38" cy="56" rx="5" ry="11" fill="rgba(255,255,255,0.7)" transform="rotate(-25 38 56)"/>
  </svg>`;
}
