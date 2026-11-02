// Static + dynamic axis-aligned collision world with a 2D broadphase grid.
import * as THREE from 'three';

const CELL = 4;

export class Box {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, kind = 'solid') {
    this.min = new THREE.Vector3(minX, minY, minZ);
    this.max = new THREE.Vector3(maxX, maxY, maxZ);
    this.kind = kind;     // 'building' | 'prop' | 'ground' | 'ink' ...
    this.blocksBullets = true;
    this.blocksMove = true;
    this.owner = null;    // optional gameplay object (ink wall)
    this.surface = kind === 'ink' ? 'ink' : 'concrete'; // impact effects + sounds
    this.id = 0;
  }
}

export class World {
  constructor(bounds) {
    this.bounds = bounds;
    this.boxes = [];
    this.grid = new Map();
    this.nextId = 1;
    this._stamp = 0;
    this._seen = new Map();
  }

  key(ix, iz) { return ix * 100003 + iz; }

  cellsOf(b, fn) {
    const x0 = Math.floor(b.min.x / CELL), x1 = Math.floor(b.max.x / CELL);
    const z0 = Math.floor(b.min.z / CELL), z1 = Math.floor(b.max.z / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) fn(this.key(ix, iz));
  }

  add(box) {
    box.id = this.nextId++;
    this.boxes.push(box);
    this.cellsOf(box, (k) => {
      let arr = this.grid.get(k);
      if (!arr) this.grid.set(k, (arr = []));
      arr.push(box);
    });
    return box;
  }

  remove(box) {
    const i = this.boxes.indexOf(box);
    if (i >= 0) this.boxes.splice(i, 1);
    this.cellsOf(box, (k) => {
      const arr = this.grid.get(k);
      if (!arr) return;
      const j = arr.indexOf(box);
      if (j >= 0) arr.splice(j, 1);
    });
  }

  /** Boxes overlapping an XZ rectangle (deduplicated). */
  query(minX, minZ, maxX, maxZ, out = []) {
    out.length = 0;
    const stamp = ++this._stamp;
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const arr = this.grid.get(this.key(ix, iz));
      if (!arr) continue;
      for (const b of arr) {
        if (this._seen.get(b.id) === stamp) continue;
        this._seen.set(b.id, stamp);
        out.push(b);
      }
    }
    return out;
  }

  /**
   * Ray vs boxes (+ ground plane y=0). Walks the broadphase grid with a DDA
   * so long rifle traces stay cheap.
   * Returns { dist, point, normal, box } or null.
   */
  raycast(origin, dir, maxDist, filter = null) {
    let best = maxDist, bestBox = null, bestAxis = -1, bestSign = 0;
    const stamp = ++this._stamp;

    // ground
    if (dir.y < -1e-6) {
      const t = -origin.y / dir.y;
      if (t > 0 && t < best) { best = t; bestBox = 'ground'; bestAxis = 1; bestSign = 1; }
    }

    const test = (b) => {
      if (this._seen.get(b.id) === stamp) return;
      this._seen.set(b.id, stamp);
      if (filter && !filter(b)) return;
      let tmin = 0, tmax = best, axis = -1, sign = 0;
      for (let a = 0; a < 3; a++) {
        const o = a === 0 ? origin.x : a === 1 ? origin.y : origin.z;
        const d = a === 0 ? dir.x : a === 1 ? dir.y : dir.z;
        const mn = a === 0 ? b.min.x : a === 1 ? b.min.y : b.min.z;
        const mx = a === 0 ? b.max.x : a === 1 ? b.max.y : b.max.z;
        if (Math.abs(d) < 1e-9) {
          if (o < mn || o > mx) return;
        } else {
          let t1 = (mn - o) / d, t2 = (mx - o) / d, s = -1;
          if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
          if (t1 > tmin) { tmin = t1; axis = a; sign = s; }
          if (t2 < tmax) tmax = t2;
          if (tmin > tmax) return;
        }
      }
      if (axis >= 0 && tmin < best) { best = tmin; bestBox = b; bestAxis = axis; bestSign = sign; }
    };

    // DDA over XZ cells
    let ix = Math.floor(origin.x / CELL), iz = Math.floor(origin.z / CELL);
    const stepX = dir.x > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
    const tDX = Math.abs(dir.x) > 1e-9 ? Math.abs(CELL / dir.x) : Infinity;
    const tDZ = Math.abs(dir.z) > 1e-9 ? Math.abs(CELL / dir.z) : Infinity;
    let tMX = Math.abs(dir.x) > 1e-9 ? ((dir.x > 0 ? (ix + 1) * CELL - origin.x : origin.x - ix * CELL) / Math.abs(dir.x)) : Infinity;
    let tMZ = Math.abs(dir.z) > 1e-9 ? ((dir.z > 0 ? (iz + 1) * CELL - origin.z : origin.z - iz * CELL) / Math.abs(dir.z)) : Infinity;
    let t = 0;
    for (let guard = 0; guard < 400 && t <= best; guard++) {
      const arr = this.grid.get(this.key(ix, iz));
      if (arr) for (const b of arr) test(b);
      if (tMX < tMZ) { t = tMX; tMX += tDX; ix += stepX; } else { t = tMZ; tMZ += tDZ; iz += stepZ; }
    }

    if (!bestBox) return null;
    const point = origin.clone().addScaledVector(dir, best);
    const normal = new THREE.Vector3();
    if (bestAxis === 0) normal.x = bestSign; else if (bestAxis === 1) normal.y = bestSign; else normal.z = bestSign;
    if (bestBox === 'ground') normal.set(0, 1, 0);
    return { dist: best, point, normal, box: bestBox === 'ground' ? null : bestBox };
  }

  /** True if nothing blocks the segment a→b. */
  visible(a, b, filter = null) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    if (len < 1e-4) return true;
    d.divideScalar(len);
    const hit = this.raycast(a, d, len, filter);
    return !hit;
  }
}

// --- character vs world movement -----------------------------------------

const tmp = [];

/**
 * Move a vertical capsule-ish AABB (feet at pos, radius r, height h)
 * by delta, resolving collisions per-axis with step-up.
 * Returns flags { onGround, hitWall }.
 */
export function moveBody(world, pos, vel, delta, r, h, stepUp = 0.5, wasOnGround = false) {
  const res = { onGround: false, hitWall: false, landedSpeed: 0, stepped: 0 };
  const boxes = world.query(pos.x - r - 2, pos.z - r - 2, pos.x + r + 2, pos.z + r + 2, tmp);

  const overlaps = (b, x, y, z) =>
    b.blocksMove &&
    x + r > b.min.x && x - r < b.max.x &&
    z + r > b.min.z && z - r < b.max.z &&
    y + h > b.min.y && y < b.max.y;

  // horizontal X then Z, each with step-up
  for (const axis of ['x', 'z']) {
    const d = delta[axis];
    if (d === 0) continue;
    const nx = axis === 'x' ? pos.x + d : pos.x;
    const nz = axis === 'z' ? pos.z + d : pos.z;
    let blocked = null;
    for (const b of boxes) if (overlaps(b, nx, pos.y, nz)) { blocked = b; break; }
    if (!blocked) { pos[axis] += d; continue; }

    // try stepping up onto it
    if (wasOnGround && blocked.max.y - pos.y <= stepUp) {
      const ny = blocked.max.y + 0.001;
      let ok = true;
      for (const b of boxes) if (overlaps(b, nx, ny, nz)) { ok = false; break; }
      if (ok) { res.stepped = ny - pos.y; pos.y = ny; pos[axis] += d; continue; }
    }
    // slide flush against the face
    if (d > 0) pos[axis] = (axis === 'x' ? blocked.min.x : blocked.min.z) - r - 0.0005;
    else pos[axis] = (axis === 'x' ? blocked.max.x : blocked.max.z) + r + 0.0005;
    // if still overlapping (corner case), revert
    let still = false;
    for (const b of boxes) if (overlaps(b, pos.x, pos.y, pos.z)) { still = true; break; }
    if (still) pos[axis] -= d > 0 ? 0.001 : -0.001;
    vel[axis] = 0;
    res.hitWall = true;
  }

  // vertical
  const dy = delta.y;
  let ny = pos.y + dy;
  if (dy <= 0) {
    let floor = 0;
    for (const b of boxes) {
      if (!b.blocksMove) continue;
      if (pos.x + r > b.min.x && pos.x - r < b.max.x && pos.z + r > b.min.z && pos.z - r < b.max.z) {
        if (b.max.y <= pos.y + 0.001 && b.max.y > floor) floor = b.max.y;
      }
    }
    if (ny <= floor) {
      res.landedSpeed = -vel.y;
      ny = floor; vel.y = 0; res.onGround = true;
    }
  } else {
    for (const b of boxes) {
      if (overlaps(b, pos.x, ny, pos.z) && b.min.y >= pos.y + h - 0.01) {
        ny = b.min.y - h - 0.001; vel.y = 0; break;
      }
    }
  }
  pos.y = ny;
  return res;
}

/** Whether a body of height h fits at pos (used for un-crouching). */
export function fits(world, pos, r, h) {
  const boxes = world.query(pos.x - r - 1, pos.z - r - 1, pos.x + r + 1, pos.z + r + 1, tmp);
  for (const b of boxes) {
    if (!b.blocksMove) continue;
    if (pos.x + r > b.min.x && pos.x - r < b.max.x && pos.z + r > b.min.z && pos.z - r < b.max.z &&
        pos.y + h > b.min.y && pos.y + 0.01 < b.max.y) return false;
  }
  return true;
}
