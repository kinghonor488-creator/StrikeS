// The comic streak inside a realistic street: spray-painted murals, comic posters,
// stencilled bombsite letters and shop signs — all painted on canvases at load.
import * as THREE from 'three';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft aerosol dot spray along a path, with overspray and drips. */
function sprayStroke(g, pts, width, color, rnd, drips = true) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = color; g.lineWidth = width;
  g.globalAlpha = 0.92;
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();
  // overspray fuzz
  g.globalAlpha = 0.08;
  g.lineWidth = width * 1.8;
  g.stroke();
  g.globalAlpha = 1;
  if (drips) {
    for (let i = 0; i < pts.length; i += 3) {
      if (rnd() > 0.35) continue;
      const [x, y] = pts[i];
      const len = 10 + rnd() * 50;
      const grd = g.createLinearGradient(x, y, x, y + len);
      grd.addColorStop(0, color); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd;
      g.fillRect(x - 2, y, 4, len);
      g.beginPath(); g.arc(x, y + len * 0.85, 3, 0, Math.PI * 2); g.fillStyle = color; g.globalAlpha = 0.7; g.fill(); g.globalAlpha = 1;
    }
  }
  g.restore();
}

function bubbleText(g, text, x, y, size, fill, outline, shadow, rnd) {
  g.save();
  g.font = `900 ${size}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.24; g.strokeStyle = shadow;
  g.strokeText(text, x + size * 0.08, y + size * 0.08);
  g.lineWidth = size * 0.16; g.strokeStyle = outline;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
  // highlight dashes
  g.fillStyle = 'rgba(255,255,255,0.65)';
  for (let i = 0; i < text.length; i++) {
    g.fillRect(x - size * text.length * 0.27 + i * size * 0.55 + rnd() * 8, y - size * 0.32, size * 0.12, size * 0.05);
  }
  g.restore();
}

/** Graffiti piece (wide). kind: 0 = "INK!" wildstyle, 1 = 墨仔 mascot, 2 = "涂鸦帮" crew tag, 3 = throw-ups. */
export function mural(kind, seed = 1) {
  const rnd = rng(seed);
  const [c, g] = canvas(1024, 512);
  g.clearRect(0, 0, 1024, 512);
  const pal = [['#ffd23f', '#e8553f', '#1b1626'], ['#2ec4ff', '#ffffff', '#1b1626'], ['#5fd068', '#2b2b6b', '#111'], ['#ff8fb8', '#ffffff', '#2a1a3a']][seed % 4];
  // background blob (spray fill)
  g.save();
  g.globalAlpha = 0.9;
  g.fillStyle = kind === 1 ? '#3a8bd9' : pal[0];
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rx = 440 + rnd() * 50, ry = 190 + rnd() * 40;
    g.lineTo(512 + Math.cos(a) * rx, 256 + Math.sin(a) * ry);
  }
  g.fill();
  g.restore();
  for (let k = 0; k < 40; k++) {
    g.fillStyle = [pal[1], '#ffffff', pal[0]][k % 3];
    g.globalAlpha = 0.5;
    g.beginPath(); g.arc(rnd() * 1024, rnd() * 512, 2 + rnd() * 6, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
  if (kind === 0) {
    bubbleText(g, 'INK!', 512, 270, 300, pal[1], '#1b1626', '#1b1626', rnd);
    sprayStroke(g, [[150, 420], [300, 400], [520, 440], [760, 410], [880, 430]], 16, '#ffffff', rnd);
  } else if (kind === 1) {
    // the ink-drop mascot giving a thumbs up
    g.save();
    g.translate(360, 270);
    g.fillStyle = '#2f2766';
    g.beginPath();
    g.moveTo(0, -190);
    g.bezierCurveTo(60, -80, 170, -10, 150, 80);
    g.bezierCurveTo(130, 170, 60, 190, 0, 190);
    g.bezierCurveTo(-60, 190, -130, 170, -150, 80);
    g.bezierCurveTo(-170, -10, -60, -80, 0, -190);
    g.fill();
    g.lineWidth = 12; g.strokeStyle = '#1b1626'; g.stroke();
    g.fillStyle = '#fff';
    g.beginPath(); g.ellipse(-50, 40, 28, 36, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(50, 40, 28, 36, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#1b1626';
    g.beginPath(); g.arc(-44, 48, 14, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(44, 48, 14, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 100, 36, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.beginPath(); g.ellipse(-70, -40, 14, 34, -0.5, 0, Math.PI * 2); g.fill();
    g.restore();
    bubbleText(g, 'STAY INKY', 720, 210, 120, '#ffd23f', '#1b1626', '#1b1626', rnd);
    bubbleText(g, '墨水街', 720, 350, 110, '#ffffff', '#1b1626', '#e8553f', rnd);
  } else if (kind === 2) {
    g.save();
    g.font = '900 230px "ZCOOL KuaiLe", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 34; g.strokeStyle = '#1b1626'; g.strokeText('涂鸦帮', 520, 270);
    g.lineWidth = 16; g.strokeStyle = '#ffffff'; g.strokeText('涂鸦帮', 512, 262);
    g.fillStyle = pal[1]; g.fillText('涂鸦帮', 512, 262);
    g.restore();
    sprayStroke(g, [[120, 120], [200, 90], [260, 130]], 12, '#e8553f', rnd);
    sprayStroke(g, [[800, 430], [870, 400], [930, 440]], 12, '#2ec4ff', rnd);
  } else {
    for (let i = 0; i < 3; i++) {
      bubbleText(g, ['POW', 'ZAP', 'WOW'][i], 200 + i * 310, 260 + (i % 2 ? -40 : 40), 170, ['#ffd23f', '#ff8fb8', '#5fd068'][i], '#1b1626', '#1b1626', rnd);
    }
  }
  return tex(c);
}

/** Comic-book style paper poster (tall). */
export function poster(seed = 1) {
  const rnd = rng(seed);
  const [c, g] = canvas(256, 384);
  const bg = ['#f6e7c1', '#fbe3e6', '#e3f1f7', '#eef2d8'][seed % 4];
  g.fillStyle = bg; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#1b1626'; g.fillRect(0, 0, 256, 6); g.fillRect(0, 378, 256, 6);
  const titles = [['SUPER', 'ERASER'], ['THE', 'INK GANG'], ['POP!', 'COLA'], ['MEGA', 'MARKER']];
  const [a, b] = titles[seed % 4];
  g.textAlign = 'center';
  g.font = '900 34px Bangers, Impact'; g.fillStyle = '#e8553f'; g.fillText(a, 128, 52);
  g.font = '900 52px Bangers, Impact'; g.fillStyle = '#1b1626'; g.fillText(b, 128, 104);
  // a burst with a figure silhouette
  g.save(); g.translate(128, 230);
  g.fillStyle = ['#ffd23f', '#2ec4ff', '#ff8fb8', '#5fd068'][seed % 4];
  g.beginPath();
  for (let i = 0; i < 24; i++) { const r = i % 2 ? 60 : 105; const an = (i / 24) * Math.PI * 2; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
  g.fill();
  g.fillStyle = '#1b1626';
  g.beginPath(); g.arc(0, -30, 22, 0, Math.PI * 2); g.fill();
  g.fillRect(-26, -6, 52, 70);
  g.restore();
  g.font = '700 18px "ZCOOL KuaiLe", sans-serif'; g.fillStyle = '#1b1626';
  g.fillText(['本周五 墨水街首映', '一抹就干净！', '冰爽气泡 嘭！', '粗到不讲道理'][seed % 4], 128, 360);
  // weathering
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(80,60,40,${rnd() * 0.06})`; g.fillRect(rnd() * 256, rnd() * 384, 2 + rnd() * 6, 2 + rnd() * 6); }
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 150 + rnd() * 60, 256, 3);
  return tex(c);
}

/** Stencilled bombsite letter with spray drips. */
export function siteStencil(letter, color) {
  const rnd = rng(letter.charCodeAt(0));
  const [c, g] = canvas(512, 512);
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = color; g.lineWidth = 18; g.globalAlpha = 0.85;
  g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.stroke();
  g.font = '900 360px "Arial Black", Impact, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(letter, 256, 280);
  g.globalAlpha = 1;
  // stencil bridges + overspray speckle
  g.fillStyle = 'rgba(0,0,0,0)';
  g.globalCompositeOperation = 'destination-out';
  g.fillRect(250, 120, 12, 60); g.fillRect(250, 380, 12, 60);
  g.globalCompositeOperation = 'source-over';
  for (let i = 0; i < 600; i++) {
    const a = rnd() * Math.PI * 2, r = 120 + rnd() * 150;
    g.fillStyle = color; g.globalAlpha = rnd() * 0.25;
    g.fillRect(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 2, 2);
  }
  g.globalAlpha = 1;
  return tex(c);
}

/** Painted arrow with a site letter, for walls near the routes. */
export function arrowSign(letter, dir = 1, color = '#e8553f') {
  const [c, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = color;
  g.globalAlpha = 0.9;
  g.save();
  if (dir < 0) { g.translate(512, 0); g.scale(-1, 1); }
  g.beginPath();
  g.moveTo(60, 100); g.lineTo(330, 100); g.lineTo(330, 50); g.lineTo(460, 128); g.lineTo(330, 206); g.lineTo(330, 156); g.lineTo(60, 156);
  g.closePath(); g.fill();
  g.restore();
  g.fillStyle = '#ffffff';
  g.font = '900 120px "Arial Black", Impact';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(letter, dir > 0 ? 190 : 322, 132);
  return tex(c);
}

/** Shop sign board. */
export function shopSign(text, bg = '#2b3a55', fg = '#fff3d6') {
  const [c, g] = canvas(1024, 192);
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 192);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 8; g.strokeRect(10, 10, 1004, 172);
  g.font = '700 108px "ZCOOL KuaiLe", "Noto Sans SC", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillText(text, 518, 104);
  g.fillStyle = fg; g.fillText(text, 512, 98);
  return tex(c);
}
