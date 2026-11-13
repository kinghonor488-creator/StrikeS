// Weapon roster + CS2-style handling data. All designs and names are original;
// roles and numbers follow the genre's conventions so the gunplay feels familiar.
//
// Units: speeds m/s, spreads radians (cone half-angle), recoil degrees of bullet
// deviation (x = right, y = up), times seconds, ranges metres.
//
// spread:  stand / crouch      first-shot cone while still
//          move                extra cone at full run speed (34% → 95% speed, eased by `moveExp`)
//          moveExp             easing exponent of the move cone (default 0.75; <1 = rises early)
//          air                 extra cone while airborne (full value at take-off / fast falls)
//          land                cap of the leftover air cone right after a hard landing
//          fire                spray cone scale; grows with the recoil index, max ≈ 3.5 × fire
//          recover             time constant of the recoil index (and the punch, fire cone with it)
//          scoped              cone while scoped (snipers / scoped rifles)
//          pellet              shotgun pellet cone
// recoil:  pattern             control points [shotIndex, x°, y°], sampled at a fractional index
//          variance            per-shot random jitter of the target point (°)
//          approach            max movement of the bullet point per shot (°); derived if omitted
//          kick                first-person kick strength
import { buildGunModel as buildModel } from './guns/models.js';

const W = {};
const def = (id, d) => { W[id] = { id, ...d }; };

// ---------------------------------------------------------------- pistols
def('g18', {
  name: '小喇叭', en: 'G-18', slot: 2, cat: 'pistol', team: 'T', price: 200, killReward: 300,
  dmg: 30, armorPen: 0.47, rangeMod: 0.85, rpm: 400, auto: false, mag: 20, reserve: 120,
  reload: 2.2, draw: 0.6, speed: 6.1, penetrate: 0.25,
  spread: { stand: 0.0056, crouch: 0.0042, move: 0.032, air: 0.24, land: 0.04, fire: 0.017, recover: 0.32 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.65], [2, 0.1, 1.3], [4, 0.2, 2.4], [6, -0.1, 3.3], [8, -0.4, 4.0], [12, 0.2, 4.8], [19, 0, 5.4]], variance: 0.2, kick: 0.8 },
  sound: { kind: 'pistol', pitch: 1.12, body: 0.8 }, tracer: 0, casing: 'pistol',
});
def('s1', {
  name: '消音笔', en: 'S-1 SILENT', slot: 2, cat: 'pistol', team: 'CT', price: 200, killReward: 300,
  dmg: 35, armorPen: 0.505, rangeMod: 0.99, rpm: 352, auto: false, mag: 12, reserve: 24,
  reload: 2.2, draw: 0.6, speed: 6.1, penetrate: 0.25,
  spread: { stand: 0.0036, crouch: 0.0028, move: 0.03, air: 0.24, land: 0.04, fire: 0.021, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.9], [2, 0.05, 1.8], [4, 0.1, 3.2], [6, -0.1, 4.2], [11, 0, 5.2]], variance: 0.18, kick: 0.7 },
  sound: { kind: 'pistol_suppressed', pitch: 1, body: 0.7, suppressed: true }, tracer: 0, casing: 'pistol', suppressed: true,
});
def('p25', {
  name: '铅笔头', en: 'P-25', slot: 2, cat: 'pistol', team: 'any', price: 300, killReward: 300,
  dmg: 38, armorPen: 0.64, rangeMod: 0.85, rpm: 400, auto: false, mag: 13, reserve: 26,
  reload: 2.2, draw: 0.6, speed: 6.1, penetrate: 0.3,
  spread: { stand: 0.0055, crouch: 0.0045, move: 0.034, air: 0.25, land: 0.045, fire: 0.028, recover: 0.33 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 1.1], [2, 0.1, 2.1], [4, 0.2, 3.6], [6, 0, 4.6], [12, 0, 5.5]], variance: 0.22, kick: 0.9 },
  sound: { kind: 'pistol', pitch: 1.0, body: 0.95 }, tracer: 0, casing: 'pistol',
});
def('t9', {
  name: '连发器', en: 'T-9', slot: 2, cat: 'pistol', team: 'T', price: 500, killReward: 300,
  dmg: 33, armorPen: 0.906, rangeMod: 0.83, rpm: 500, auto: false, mag: 18, reserve: 90,
  reload: 2.5, draw: 0.6, speed: 6.1, penetrate: 0.35,
  spread: { stand: 0.007, crouch: 0.006, move: 0.022, air: 0.22, land: 0.035, fire: 0.022, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.8], [3, 0.2, 2.2], [5, 0.4, 3.3], [8, 0, 4.3], [12, -0.5, 5.0], [17, 0, 5.5]], variance: 0.25, kick: 0.85 },
  sound: { kind: 'pistol', pitch: 0.95, body: 0.9 }, tracer: 0, casing: 'pistol',
});
def('f7', {
  name: '五七', en: 'F-7', slot: 2, cat: 'pistol', team: 'CT', price: 500, killReward: 300,
  dmg: 32, armorPen: 0.911, rangeMod: 0.81, rpm: 400, auto: false, mag: 20, reserve: 100,
  reload: 2.2, draw: 0.6, speed: 6.1, penetrate: 0.35,
  spread: { stand: 0.0055, crouch: 0.0045, move: 0.027, air: 0.23, land: 0.04, fire: 0.022, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.85], [3, 0.15, 2.3], [5, 0.3, 3.4], [8, 0.1, 4.4], [12, -0.3, 5.1], [19, 0, 5.6]], variance: 0.2, kick: 0.8 },
  sound: { kind: 'pistol', pitch: 1.08, body: 0.85 }, tracer: 0, casing: 'pistol',
});
def('d50', {
  name: '大炮仗', en: 'D-50', slot: 2, cat: 'pistol', team: 'any', price: 700, killReward: 300,
  dmg: 53, armorPen: 0.932, rangeMod: 0.81, rpm: 267, auto: false, mag: 7, reserve: 35,
  reload: 2.2, draw: 0.7, speed: 5.84, penetrate: 0.45,
  spread: { stand: 0.006, crouch: 0.0045, move: 0.075, air: 0.32, land: 0.07, fire: 0.065, recover: 0.55 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 3.2], [2, 0.3, 5.6], [3, 0.4, 7.0], [6, 0.4, 8.0]], variance: 0.3, kick: 1.6 },
  sound: { kind: 'pistol_heavy', pitch: 1, body: 1.3 }, tracer: 0, casing: 'pistol',
});

// ---------------------------------------------------------------- SMGs
def('m10', {
  name: '订书机', en: 'M-10', slot: 1, cat: 'smg', team: 'T', price: 1050, killReward: 600,
  dmg: 29, armorPen: 0.575, rangeMod: 0.8, rpm: 800, auto: true, mag: 30, reserve: 100,
  reload: 2.6, draw: 0.75, speed: 6.1, penetrate: 0.3,
  spread: { stand: 0.011, crouch: 0.0085, move: 0.034, air: 0.2, land: 0.04, fire: 0.0055, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0.1, 0.35], [3, 0.4, 1.4], [5, 0.8, 2.5], [7, 1.0, 3.4], [9, 0.8, 4.1], [11, 0.2, 4.6], [13, -0.6, 4.9], [15, -1.3, 5.1], [17, -1.6, 5.25], [19, -1.2, 5.35], [21, -0.3, 5.45], [23, 0.7, 5.5], [25, 1.4, 5.55], [27, 1.3, 5.6], [29, 0.6, 5.65]], variance: 0.16, kick: 0.55 },
  sound: { kind: 'smg', pitch: 1.12, body: 0.75 }, tracer: 3, casing: 'pistol',
});
def('mp9', {
  name: '打孔机', en: 'MP-9', slot: 1, cat: 'smg', team: 'CT', price: 1250, killReward: 600,
  dmg: 26, armorPen: 0.6, rangeMod: 0.87, rpm: 857, auto: true, mag: 30, reserve: 120,
  reload: 2.1, draw: 0.75, speed: 6.1, penetrate: 0.3,
  spread: { stand: 0.0092, crouch: 0.007, move: 0.03, air: 0.2, land: 0.04, fire: 0.005, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.3], [3, 0.1, 1.2], [5, 0.3, 2.2], [7, 0.6, 3.0], [9, 0.9, 3.6], [11, 1.0, 4.0], [13, 0.6, 4.3], [15, -0.1, 4.5], [17, -0.8, 4.6], [19, -1.1, 4.7], [21, -0.8, 4.8], [23, 0, 4.85], [25, 0.8, 4.9], [27, 1.1, 4.95], [29, 0.7, 5.0]], variance: 0.15, kick: 0.5 },
  sound: { kind: 'smg', pitch: 1.18, body: 0.7 }, tracer: 3, casing: 'pistol',
});
def('mp7', {
  name: '橡皮筋', en: 'MP-7', slot: 1, cat: 'smg', team: 'any', price: 1500, killReward: 600,
  dmg: 29, armorPen: 0.625, rangeMod: 0.85, rpm: 750, auto: true, mag: 30, reserve: 120,
  reload: 3.1, draw: 0.8, speed: 5.59, penetrate: 0.35,
  spread: { stand: 0.0078, crouch: 0.006, move: 0.03, air: 0.2, land: 0.04, fire: 0.0048, recover: 0.3 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.28], [3, 0.05, 1.0], [5, 0.1, 1.8], [7, 0.05, 2.5], [9, -0.2, 3.0], [11, -0.6, 3.3], [13, -0.9, 3.5], [15, -0.8, 3.65], [17, -0.3, 3.75], [19, 0.4, 3.85], [21, 0.9, 3.9], [23, 0.9, 3.95], [25, 0.4, 4.0], [27, -0.2, 4.05], [29, -0.6, 4.1]], variance: 0.12, kick: 0.5 },
  sound: { kind: 'smg', pitch: 1.0, body: 0.85 }, tracer: 3, casing: 'pistol',
});
def('p90', {
  name: '卷笔机', en: 'P-90', slot: 1, cat: 'smg', team: 'any', price: 2350, killReward: 300,
  dmg: 26, armorPen: 0.69, rangeMod: 0.86, rpm: 857, auto: true, mag: 50, reserve: 100,
  reload: 3.3, draw: 0.85, speed: 5.84, penetrate: 0.35,
  spread: { stand: 0.0098, crouch: 0.0078, move: 0.03, air: 0.2, land: 0.04, fire: 0.004, recover: 0.35 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.25], [4, 0.1, 1.2], [8, 0.2, 2.3], [12, -0.2, 3.1], [16, -0.9, 3.6], [20, -1.5, 3.9], [24, -1.6, 4.1], [28, -1.0, 4.25], [32, 0, 4.35], [36, 1.0, 4.45], [40, 1.5, 4.55], [44, 1.2, 4.6], [49, 0.4, 4.7]], variance: 0.12, kick: 0.45 },
  sound: { kind: 'smg', pitch: 1.05, body: 0.8 }, tracer: 3, casing: 'pistol',
});

// ---------------------------------------------------------------- heavy
def('n7', {
  name: '喷墨枪', en: 'N-7 PUMP', slot: 1, cat: 'heavy', team: 'any', price: 1050, killReward: 900,
  dmg: 26, pellets: 9, armorPen: 0.5, rangeMod: 0.7, rpm: 68, auto: false, mag: 8, reserve: 32,
  reload: 0.5, reloadType: 'shell', reloadStart: 0.4, draw: 0.85, speed: 5.59, penetrate: 0.2,
  spread: { stand: 0.006, crouch: 0.006, move: 0.04, air: 0.12, land: 0.04, fire: 0, recover: 0.4, pellet: 0.046 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 2.6], [7, 0, 4.5]], variance: 0.4, kick: 1.5 },
  sound: { kind: 'shotgun', pitch: 1, body: 1.1 }, tracer: 0, casing: 'shell', pumpAction: true,
});
def('x14', {
  name: '连喷', en: 'X-14 AUTO', slot: 1, cat: 'heavy', team: 'any', price: 2000, killReward: 900,
  dmg: 20, pellets: 6, armorPen: 0.8, rangeMod: 0.7, rpm: 171, auto: false, mag: 7, reserve: 32,
  reload: 0.55, reloadType: 'shell', reloadStart: 0.45, draw: 0.85, speed: 5.46, penetrate: 0.2,
  spread: { stand: 0.007, crouch: 0.007, move: 0.05, air: 0.12, land: 0.05, fire: 0, recover: 0.4, pellet: 0.05 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 2.2], [3, 0.2, 4.0], [6, 0, 5.2]], variance: 0.4, kick: 1.3 },
  sound: { kind: 'shotgun_auto', pitch: 1.05, body: 1 }, tracer: 0, casing: 'shell',
});
def('m249', {
  name: '墨水泵', en: 'M-249', slot: 1, cat: 'heavy', team: 'any', price: 5200, killReward: 300,
  dmg: 32, armorPen: 0.8, rangeMod: 0.97, rpm: 750, auto: true, mag: 100, reserve: 200,
  reload: 5.7, reloadType: 'box', draw: 1.1, speed: 4.95, penetrate: 0.8,
  spread: { stand: 0.012, crouch: 0.008, move: 0.12, air: 0.3, land: 0.06, fire: 0.0035, recover: 0.5 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.5], [3, 0.2, 1.9], [5, 0.3, 3.3], [7, 0.2, 4.4], [9, -0.1, 5.2], [11, -0.6, 5.7], [14, -1.5, 6.1], [18, -2.2, 6.3], [22, -1.6, 6.4], [26, -0.2, 6.5], [30, 1.2, 6.55], [35, 2.0, 6.6], [40, 1.4, 6.65], [45, 0, 6.7], [50, -1.4, 6.75], [60, -1.0, 6.8], [70, 0.8, 6.85], [80, 1.4, 6.9], [99, -0.5, 7.0]], variance: 0.18, kick: 0.6 },
  sound: { kind: 'lmg', pitch: 1, body: 1.1 }, tracer: 2, casing: 'rifle',
});

// ---------------------------------------------------------------- rifles
def('g35', {
  name: '涂刷', en: 'G-35', slot: 1, cat: 'rifle', team: 'T', price: 1800, killReward: 300,
  dmg: 30, armorPen: 0.775, rangeMod: 0.98, rpm: 666, auto: true, mag: 35, reserve: 90,
  reload: 3.0, draw: 0.95, speed: 5.46, penetrate: 0.8,
  spread: { stand: 0.0046, crouch: 0.0035, move: 0.12, air: 0.3, land: 0.06, fire: 0.0062, recover: 0.36 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.4], [3, 0.15, 1.8], [5, 0.3, 3.1], [7, 0.2, 4.2], [9, -0.2, 4.9], [11, -1.0, 5.3], [13, -1.8, 5.5], [15, -1.5, 5.7], [17, -0.4, 5.8], [19, 0.9, 5.9], [21, 1.8, 6.0], [23, 1.6, 6.1], [25, 0.6, 6.2], [27, -0.6, 6.25], [29, -1.4, 6.3], [31, -1.0, 6.35], [34, 0.2, 6.4]], variance: 0.14, kick: 0.65 },
  sound: { kind: 'rifle', pitch: 0.98, body: 1.0 }, tracer: 3, casing: 'rifle',
});
def('f25', {
  name: '三角尺', en: 'F-25', slot: 1, cat: 'rifle', team: 'CT', price: 2050, killReward: 300,
  dmg: 30, armorPen: 0.7, rangeMod: 0.96, rpm: 666, auto: true, mag: 25, reserve: 90,
  reload: 3.3, draw: 0.95, speed: 5.59, penetrate: 0.8,
  spread: { stand: 0.0042, crouch: 0.0031, move: 0.115, air: 0.3, land: 0.06, fire: 0.006, recover: 0.35 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.4], [3, -0.1, 1.7], [5, -0.15, 2.9], [7, -0.05, 3.9], [9, 0.3, 4.5], [11, 1.0, 4.9], [13, 1.6, 5.1], [15, 1.4, 5.25], [17, 0.5, 5.35], [19, -0.6, 5.45], [21, -1.3, 5.5], [24, -0.8, 5.6]], variance: 0.13, kick: 0.6 },
  sound: { kind: 'rifle', pitch: 1.06, body: 0.9 }, tracer: 3, casing: 'rifle',
});
def('k47', {
  name: '雷鸣', en: 'K-47', slot: 1, cat: 'rifle', team: 'T', price: 2700, killReward: 300,
  dmg: 36, armorPen: 0.775, rangeMod: 0.98, rpm: 600, auto: true, mag: 30, reserve: 90,
  reload: 2.45, draw: 1.0, speed: 5.46, penetrate: 0.9,
  spread: { stand: 0.0048, crouch: 0.0036, move: 0.13, air: 0.32, land: 0.07, fire: 0.0075, recover: 0.38 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.45], [2, 0.08, 1.25], [3, 0.12, 2.2], [4, 0.15, 3.15], [5, 0.1, 4.0], [6, 0.05, 4.75], [7, 0, 5.35], [8, -0.15, 5.85], [9, -0.4, 6.2], [10, -0.9, 6.45], [11, -1.6, 6.6], [12, -2.3, 6.7], [13, -2.8, 6.8], [14, -3.0, 6.85], [15, -2.6, 6.95], [16, -1.8, 7.0], [17, -0.8, 7.0], [18, 0.4, 7.05], [19, 1.5, 7.1], [20, 2.4, 7.15], [21, 2.9, 7.25], [22, 2.9, 7.3], [23, 2.4, 7.35], [24, 1.6, 7.4], [25, 0.8, 7.45], [26, 0.2, 7.5], [27, -0.4, 7.55], [28, -1.0, 7.55], [29, -1.4, 7.6]], variance: 0.12, kick: 0.75 },
  sound: { kind: 'rifle_heavy', pitch: 1, body: 1.15 }, tracer: 3, casing: 'rifle',
});
def('m4', {
  name: '直尺', en: 'M-4', slot: 1, cat: 'rifle', team: 'CT', price: 3100, killReward: 300,
  dmg: 33, armorPen: 0.7, rangeMod: 0.97, rpm: 666, auto: true, mag: 30, reserve: 90,
  reload: 3.0, draw: 1.0, speed: 5.72, penetrate: 0.85,
  spread: { stand: 0.0038, crouch: 0.0029, move: 0.12, air: 0.3, land: 0.06, fire: 0.0064, recover: 0.35 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.4], [2, 0.05, 1.0], [3, 0.1, 1.8], [4, 0.15, 2.6], [5, 0.25, 3.3], [6, 0.35, 3.9], [7, 0.4, 4.4], [8, 0.3, 4.8], [9, 0.15, 5.1], [10, -0.1, 5.35], [12, -0.8, 5.6], [14, -1.6, 5.75], [16, -1.9, 5.85], [18, -1.3, 5.9], [20, -0.2, 6.0], [22, 1.0, 6.05], [24, 1.7, 6.1], [26, 1.6, 6.15], [29, 0.8, 6.2]], variance: 0.1, kick: 0.6 },
  sound: { kind: 'rifle', pitch: 1.02, body: 1.0 }, tracer: 3, casing: 'rifle',
});
def('sg5', {
  name: '放大镜', en: 'SG-5', slot: 1, cat: 'rifle', team: 'T', price: 3000, killReward: 300,
  dmg: 30, armorPen: 1.0, rangeMod: 0.98, rpm: 545, auto: true, mag: 30, reserve: 90,
  reload: 2.8, draw: 1.0, speed: 5.33, scopedSpeed: 3.8, penetrate: 1.0,
  spread: { stand: 0.0042, crouch: 0.0032, scoped: 0.0013, move: 0.12, air: 0.3, land: 0.06, fire: 0.0058, recover: 0.36 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.4], [3, -0.2, 1.7], [5, -0.4, 2.9], [7, -0.3, 3.9], [9, 0.1, 4.6], [11, 0.8, 5.0], [13, 1.5, 5.3], [15, 1.9, 5.5], [17, 1.4, 5.65], [19, 0.4, 5.8], [21, -0.6, 5.9], [23, -1.2, 6.0], [26, -0.9, 6.1], [29, -0.2, 6.2]], variance: 0.12, kick: 0.6 },
  scope: { levels: [34], scopedRecoil: 0.65, style: 'dot' },
  sound: { kind: 'rifle', pitch: 0.94, body: 1.05 }, tracer: 3, casing: 'rifle',
});
def('a3', {
  name: '望远镜', en: 'A-3', slot: 1, cat: 'rifle', team: 'CT', price: 3300, killReward: 300,
  dmg: 28, armorPen: 0.9, rangeMod: 0.98, rpm: 600, auto: true, mag: 30, reserve: 90,
  reload: 3.8, draw: 1.0, speed: 5.59, scopedSpeed: 3.8, penetrate: 0.95,
  spread: { stand: 0.0041, crouch: 0.0031, scoped: 0.0012, move: 0.12, air: 0.3, land: 0.06, fire: 0.0056, recover: 0.36 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 0.38], [3, 0.2, 1.6], [5, 0.35, 2.8], [7, 0.3, 3.8], [9, -0.1, 4.4], [11, -0.8, 4.8], [13, -1.4, 5.0], [15, -1.5, 5.2], [17, -0.8, 5.35], [19, 0.3, 5.45], [21, 1.2, 5.55], [23, 1.6, 5.6], [26, 1.0, 5.7], [29, 0.2, 5.8]], variance: 0.11, kick: 0.55 },
  scope: { levels: [34], scopedRecoil: 0.65, style: 'dot' },
  sound: { kind: 'rifle', pitch: 1.1, body: 0.95 }, tracer: 3, casing: 'rifle',
});

// ---------------------------------------------------------------- snipers
def('s08', {
  name: '鸟笔', en: 'S-08', slot: 1, cat: 'sniper', team: 'any', price: 1700, killReward: 300,
  dmg: 88, armorPen: 0.85, rangeMod: 0.98, rpm: 48, auto: false, mag: 10, reserve: 90,
  reload: 3.7, draw: 1.0, speed: 5.84, scopedSpeed: 5.84, penetrate: 1.0, bolt: 1.0,
  spread: { stand: 0.06, crouch: 0.05, scoped: 0.0014, move: 0.1, air: 0.08, land: 0.04, fire: 0, recover: 0.5 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 3.0], [9, 0, 4.5]], variance: 0.3, kick: 1.3 },
  scope: { levels: [30.6, 11.4], style: 'sniper' }, jumpAccurate: true,
  sound: { kind: 'sniper_light', pitch: 1, body: 0.9 }, tracer: 1, casing: 'rifle',
});
def('aw1', {
  name: '长腿狙', en: 'AW-1', slot: 1, cat: 'sniper', team: 'any', price: 4750, killReward: 100,
  dmg: 115, armorPen: 0.975, rangeMod: 0.99, rpm: 41, auto: false, mag: 5, reserve: 30,
  reload: 3.6, draw: 1.25, speed: 5.08, scopedSpeed: 2.54, penetrate: 1.4, bolt: 1.25,
  spread: { stand: 0.09, crouch: 0.07, scoped: 0.0009, move: 0.2, air: 0.3, land: 0.08, fire: 0, recover: 0.5 },
  recoil: { pattern: [[0, 0, 0], [1, 0, 4.5], [4, 0, 6]], variance: 0.3, kick: 1.8 },
  scope: { levels: [30.6, 7.6], style: 'sniper' },
  sound: { kind: 'sniper', pitch: 1, body: 1.25 }, tracer: 1, casing: 'rifle',
});

// ---------------------------------------------------------------- melee + utility
def('knife', {
  name: '裁纸刀', en: 'BOX CUTTER', slot: 3, cat: 'knife', team: 'any', price: 0, killReward: 1500,
  dmg: 34, heavyDamage: 65, rpm: 120, range: 2.0, draw: 0.5, speed: 6.35,
});
def('inkpen', {
  name: '墨水笔', en: 'INK MARKER', slot: 4, cat: 'ink', team: 'any', price: 0, killReward: 0,
  draw: 0.4, speed: 6.35,
});

// ---------------------------------------------------------------- derived data
function buildPattern(points, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let a = points[0], b = points[points.length - 1];
    for (let k = 0; k < points.length - 1; k++) {
      if (i >= points[k][0] && i <= points[k + 1][0]) { a = points[k]; b = points[k + 1]; break; }
    }
    const t = b[0] === a[0] ? 0 : (Math.min(i, b[0]) - a[0]) / (b[0] - a[0]);
    out.push([a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  }
  return out;
}

for (const w of Object.values(W)) {
  if (w.recoil) {
    const r = w.recoil;
    r.table = buildPattern(r.pattern, Math.max(w.mag || 1, 2) + 1);
    // the bullet point chases the pattern but may only move this far per shot: big
    // corners and jitter get smoothed instead of jumping (a bit above the largest step)
    if (r.approach == null) {
      let maxStep = 0;
      for (let i = 1; i < r.table.length; i++) {
        maxStep = Math.max(maxStep, Math.hypot(r.table[i][0] - r.table[i - 1][0], r.table[i][1] - r.table[i - 1][1]));
      }
      r.approach = maxStep * 1.25 + r.variance;
    }
  }
  w.cycle = w.rpm ? 60 / w.rpm : 0.5;
  if (!w.reloadType && w.mag) w.reloadType = 'mag';
}

export const WEAPONS = W;

/** Pattern offset (°) at a fractional shot index, linearly between table rows. */
export function samplePattern(table, f) {
  const last = table.length - 1;
  if (f <= 0) return table[0];
  if (f >= last) return table[last];
  const i = Math.floor(f), t = f - i, a = table[i], b = table[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export const BUY_LIST = [
  { cat: '手枪', key: 'pistol', items: ['g18', 's1', 'p25', 't9', 'f7', 'd50'] },
  { cat: '冲锋枪', key: 'smg', items: ['m10', 'mp9', 'mp7', 'p90'] },
  { cat: '重型', key: 'heavy', items: ['n7', 'x14', 'm249'] },
  { cat: '步枪', key: 'rifle', items: ['g35', 'f25', 'k47', 'm4', 'sg5', 'a3'] },
  { cat: '狙击', key: 'sniper', items: ['s08', 'aw1'] },
  { cat: '装备', key: 'gear', items: ['vest', 'vesthelm', 'kit', 'ink'] },
];

export const GEAR = {
  vest: { id: 'vest', name: '防弹背心', en: 'KEVLAR VEST', price: 650 },
  vesthelm: { id: 'vesthelm', name: '背心+头盔', en: 'VEST + HELMET', price: 1000 },
  kit: { id: 'kit', name: '修正液拆弹器', en: 'WHITE-OUT KIT', price: 400, team: 'CT' },
  ink: { id: 'ink', name: '墨水补充', en: 'INK REFILL', price: 300 },
};

export const DEFAULT_PISTOL = { T: 'g18', CT: 's1' };

export function availableTo(id, team) {
  const w = WEAPONS[id] || GEAR[id];
  return !!w && (!w.team || w.team === 'any' || w.team === team);
}

export function buildGunModel(id, accent) { return buildModel(id, accent); }

export function makeWeaponState(id) {
  const def = WEAPONS[id];
  return {
    id, def,
    ammo: def.mag ?? 0,
    reserve: def.reserve ?? 0,
    nextFire: 0,
    reloadEnd: 0,
    reloadStart: 0,
    shellTimer: 0,      // shotgun shell-by-shell reload
    drawEnd: 0,
    boltEnd: 0,         // bolt-action cycling
    shotsFired: 0,      // for tracer cadence
    lastShot: -10,
  };
}
