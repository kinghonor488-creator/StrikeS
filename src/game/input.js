// Keyboard/mouse state with pointer lock. Edge-triggered keys via `pressed`.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { left: false, right: false, leftPressed: false, rightPressed: false };
    this.lookDX = 0; this.lookDY = 0;
    this.accDX = 0; this.accDY = 0;
    this.wheel = 0;
    this.sensitivity = 1.0;
    this.locked = false;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (['Tab', 'Space'].includes(e.code) || (e.ctrlKey && e.code === 'KeyW')) e.preventDefault();
      this.down.add(e.code);
      this.pressed.add(e.code);
    });
    addEventListener('keyup', (e) => { this.down.delete(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // ignore absurd spikes some browsers emit on lock
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.accDX += e.movementX; this.accDY += e.movementY;
    });
    addEventListener('wheel', (e) => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange?.(this.locked);
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      p?.catch?.(() => this.canvas.requestPointerLock());
    } catch { this.canvas.requestPointerLock(); }
  }
  unlock() { if (this.locked) document.exitPointerLock(); }

  /** Call once per frame before reading. */
  poll() {
    this.lookDX = this.accDX; this.lookDY = this.accDY;
    this.accDX = 0; this.accDY = 0;
  }
  /** Call once per frame after the game consumed input. */
  endFrame() {
    this.pressed.clear();
    this.mouse.leftPressed = this.mouse.rightPressed = false;
    this.wheel = 0;
  }
  key(code) { return this.enabled && this.down.has(code); }
  hit(code) { return this.enabled && this.pressed.has(code); }
}
