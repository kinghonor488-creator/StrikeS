import { preloadImportedGuns } from './game/guns/imported.js';
import { Game } from './game/game.js';
import { Menu } from './ui/menu.js';
import { BuyMenu } from './ui/buyMenu.js';
import { Armory } from './ui/armory.js';

async function boot() {
  // canvas textures (ground letters, signs, stickers) need the comic fonts first
  const fonts = Promise.all([
    document.fonts.load('900 40px Bangers'),
    document.fonts.load('400 40px "ZCOOL KuaiLe"', '墨水'),
  ]).catch(() => {});
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 3000))]);
  // realistic gun models (glTF); a slow or missing file just leaves that gun on its code model
  await Promise.race([preloadImportedGuns(), new Promise((r) => setTimeout(r, 15000))]);

  const canvas = document.getElementById('game');
  const ui = document.getElementById('ui');
  const game = new Game(canvas, ui);
  const buyMenu = new BuyMenu(game, ui);
  const armory = new Armory(game, ui);
  const menu = new Menu(game, ui, { armory, buyMenu });

  game.onBuyKey = () => buyMenu.toggle();
  buyMenu.onRelockFailed = () => menu.onLock(false);
  game.onMatchOver = () => menu.showMatchEnd();
  game.input.onLockChange = (locked) => {
    if (!locked && buyMenu.isOpen) return;
    menu.onLock(locked);
  };
  // clicking the canvas mid-match resumes
  canvas.addEventListener('click', () => {
    game.audio.unlock();
    if (game.running && !game.menuOpen && !game.input.locked && !menu.screen) game.input.lock();
  });
  addEventListener('pointerdown', () => game.audio.unlock(), { once: true });

  document.getElementById('boot').remove();
  window.__game = game; // handy for debugging in the console
  window.__ui = { menu, buyMenu, armory };

  // ?debug[&side=T|CT][&diff=easy|normal|hard] jumps straight into a match without pointer lock
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) {
    menu.hide();
    game.newMatch({ side: params.get('side') || 'T', difficulty: params.get('diff') || 'normal' });
    game.hud.show(true);
    game.input.locked = true;
  }

  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!game.suspended) {
      if (!game.running) game.attract(now / 1000);
      game.update(dt);
      buyMenu.update();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

boot();
