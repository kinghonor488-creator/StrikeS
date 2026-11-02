// Bakes side-profile renders of every gun into data-URL icons (once, then cached).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PreviewRenderer } from '../render/renderer.js';
import { buildGunModel } from '../game/weapons.js';

let cache = null;

export function gunIcons(ids) {
  if (cache) return cache;
  cache = {};
  const W = 480, H = 200;
  const canvas = document.createElement('canvas');
  let pr;
  try {
    pr = new PreviewRenderer(canvas, { getSize: () => [W, H], alpha: true });
  } catch {
    return cache; // no spare WebGL context: cards simply show no icon
  }
  pr.renderer.setPixelRatio(1);
  pr.renderer.setSize(W, H, false);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(pr.renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  // studio light: warm key from above, cool rim from behind so dark guns read on dark cards
  const key = new THREE.DirectionalLight(0xfff2e0, 3.2);
  key.position.set(3, 4, 1.5);
  const rim = new THREE.DirectionalLight(0xbcd4ff, 2.4);
  rim.position.set(-2, 2, -3);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.7));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  cam.position.set(5, 0, 0);
  cam.lookAt(0, 0, 0);

  for (const id of ids) {
    const model = buildGunModel(id);
    const box = new THREE.Box3().setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(c);
    scene.add(model);
    const halfW = Math.max(size.z / 2, (size.y / 2) * (W / H)) * 1.08;
    cam.left = -halfW; cam.right = halfW;
    cam.top = halfW * (H / W); cam.bottom = -halfW * (H / W);
    cam.updateProjectionMatrix();
    pr.render(scene, cam);
    cache[id] = trimmed(canvas);
    scene.remove(model);
  }
  pmrem.dispose();
  pr.renderer.dispose();
  pr.renderer.forceContextLoss();
  return cache;
}

/** Crops transparent padding so every gun fills its card the same way. */
function trimmed(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return src.toDataURL('image/png');
  const pad = 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}
