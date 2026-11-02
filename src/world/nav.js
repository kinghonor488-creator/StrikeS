// 1 m navigation grid with A* and string-pulling for bots.
export class NavGrid {
  constructor(map, propBoxes, res = 1) {
    const { minX, maxX, minZ, maxZ } = map.bounds;
    this.res = res;
    this.minX = minX; this.minZ = minZ;
    this.w = Math.round((maxX - minX) / res);
    this.h = Math.round((maxZ - minZ) / res);
    this.walk = new Uint8Array(this.w * this.h);
    this.cost = new Float32Array(this.w * this.h);
    this.dynamic = new Uint8Array(this.w * this.h); // ink walls etc.

    for (let iz = 0; iz < this.h; iz++) for (let ix = 0; ix < this.w; ix++) {
      const x = minX + (ix + 0.5) * res, z = minZ + (iz + 0.5) * res;
      // walkable when the body footprint fits inside the union of walk rects
      let ok = this._insideUnionInset(map, x, z, 0.45);
      if (ok) for (const b of propBoxes) {
        if (x > b.min.x - 0.5 && x < b.max.x + 0.5 && z > b.min.z - 0.5 && z < b.max.z + 0.5) { ok = false; break; }
      }
      this.walk[iz * this.w + ix] = ok ? 1 : 0;
    }
    // soft cost near obstacles so paths keep off walls
    for (let iz = 0; iz < this.h; iz++) for (let ix = 0; ix < this.w; ix++) {
      const i = iz * this.w + ix;
      if (!this.walk[i]) continue;
      let near = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.isWalk(ix + dx, iz + dz)) near++;
      }
      this.cost[i] = near ? 0.6 : 0;
    }
  }

  _insideUnionInset(map, x, z, m) {
    // point is walkable if every probe offset by m is inside some walk rect
    const probes = [[m, 0], [-m, 0], [0, m], [0, -m], [m, m], [-m, m], [m, -m], [-m, -m]];
    for (const [dx, dz] of probes) {
      const px = x + dx, pz = z + dz;
      let inside = false;
      for (const [x1, z1, x2, z2] of map.walk) if (px >= x1 && px <= x2 && pz >= z1 && pz <= z2) { inside = true; break; }
      if (!inside) return false;
    }
    return true;
  }

  isWalk(ix, iz) {
    if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) return false;
    const i = iz * this.w + ix;
    return this.walk[i] === 1 && this.dynamic[i] === 0;
  }
  toCell(x, z) { return [Math.floor((x - this.minX) / this.res), Math.floor((z - this.minZ) / this.res)]; }
  toWorld(ix, iz) { return [this.minX + (ix + 0.5) * this.res, this.minZ + (iz + 0.5) * this.res]; }

  nearestWalkable(ix, iz) {
    if (this.isWalk(ix, iz)) return [ix, iz];
    for (let r = 1; r < 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      if (this.isWalk(ix + dx, iz + dz)) return [ix + dx, iz + dz];
    }
    return null;
  }

  setDynamicRect(minX, minZ, maxX, maxZ, v) {
    const [x0, z0] = this.toCell(minX - 0.4, minZ - 0.4);
    const [x1, z1] = this.toCell(maxX + 0.4, maxZ + 0.4);
    for (let iz = Math.max(0, z0); iz <= Math.min(this.h - 1, z1); iz++)
      for (let ix = Math.max(0, x0); ix <= Math.min(this.w - 1, x1); ix++) {
        const i = iz * this.w + ix;
        this.dynamic[i] = Math.max(0, this.dynamic[i] + (v ? 1 : -1));
      }
  }

  /** A* from world (ax,az) to (bx,bz). Returns array of [x,z] waypoints or null. */
  findPath(ax, az, bx, bz) {
    let s = this.nearestWalkable(...this.toCell(ax, az));
    let g = this.nearestWalkable(...this.toCell(bx, bz));
    if (!s || !g) return null;
    const W = this.w, N = W * this.h;
    const start = s[1] * W + s[0], goal = g[1] * W + g[0];
    if (start === goal) return [[bx, bz]];
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    gScore[start] = 0;
    const hf = (i) => {
      const x = i % W, z = (i / W) | 0;
      const dx = Math.abs(x - g[0]), dz = Math.abs(z - g[1]);
      return (dx + dz) + (Math.SQRT2 - 2) * Math.min(dx, dz);
    };
    heap.push(start, hf(start));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
    let found = false, iter = 0;
    while (heap.size && iter++ < 20000) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, c] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.isWalk(nx, nz)) continue;
        if (dx && dz && (!this.isWalk(cx + dx, cz) || !this.isWalk(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = gScore[cur] + c + this.cost[ni];
        if (ng < gScore[ni]) {
          gScore[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + hf(ni));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    // string-pull: keep a waypoint only when the straight line breaks
    const pts = cells.map((i) => this.toWorld(i % W, (i / W) | 0));
    const out = [];
    let anchor = 0;
    for (let i = 2; i < pts.length; i++) {
      if (!this.lineWalkable(pts[anchor], pts[i])) { out.push(pts[i - 1]); anchor = i - 1; }
    }
    out.push([bx, bz]);
    return out;
  }

  lineWalkable(a, b) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const steps = Math.ceil(len / (this.res * 0.4));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [ix, iz] = this.toCell(a[0] + dx * t, a[1] + dz * t);
      if (!this.isWalk(ix, iz)) return false;
      // keep a little clearance either side of the line
      const px = -dz / (len || 1) * 0.45, pz = dx / (len || 1) * 0.45;
      const [lx, lz] = this.toCell(a[0] + dx * t + px, a[1] + dz * t + pz);
      const [rx, rz] = this.toCell(a[0] + dx * t - px, a[1] + dz * t - pz);
      if (!this.isWalk(lx, lz) || !this.isWalk(rx, rz)) return false;
    }
    return true;
  }

  randomWalkableNear(x, z, radius, rnd = Math.random) {
    for (let k = 0; k < 30; k++) {
      const a = rnd() * Math.PI * 2, r = rnd() * radius;
      const [ix, iz] = this.toCell(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (this.isWalk(ix, iz)) return this.toWorld(ix, iz);
    }
    return [x, z];
  }
}

class MinHeap {
  constructor() { this.items = []; this.prio = []; }
  get size() { return this.items.length; }
  push(item, p) {
    const a = this.items, q = this.prio;
    a.push(item); q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (q[par] <= q[i]) break;
      [a[par], a[i]] = [a[i], a[par]]; [q[par], q[i]] = [q[i], q[par]];
      i = par;
    }
  }
  pop() {
    const a = this.items, q = this.prio;
    const top = a[0];
    const lastI = a.pop(), lastP = q.pop();
    if (a.length) {
      a[0] = lastI; q[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; [q[m], q[i]] = [q[i], q[m]];
        i = m;
      }
    }
    return top;
  }
}
