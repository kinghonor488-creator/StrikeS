// Realistic frame pipeline (stylized-realism, CS2-like readability):
//   world (MSAA, ACES, soft shadows) → GTAO (half res) → first-person viewmodel
//   → bloom (only HDR highlights: muzzle flashes, explosions, sun) → tone map
//   → final grade (vignette, damage, flash, death desaturation, grain)
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';

export const LAYER_WORLD = 0;
export const LAYER_FX = 2; // particles, decals, sky: drawn, but never occlude AO

export const QUALITY = {
  low: { pixelRatio: 1, samples: 0, ao: false, bloom: true, shadow: 2048 },
  medium: { pixelRatio: 1.25, samples: 4, ao: true, bloom: true, shadow: 2048 },
  high: { pixelRatio: 1.5, samples: 4, ao: true, bloom: true, shadow: 4096 },
  ultra: { pixelRatio: 2, samples: 4, ao: true, bloom: true, shadow: 4096 },
};

/** Draws the first-person scene over the world (own depth, no AO). */
class ViewmodelPass extends Pass {
  constructor() {
    super();
    this.needsSwap = false;
    this.scene = null;
    this.camera = null;
  }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.scene) return;
    const auto = renderer.autoClear;
    renderer.autoClear = false; // draw over the world, keep its colour
    renderer.setRenderTarget(readBuffer);
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.autoClear = auto;
  }
}

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uDamage: { value: 0 },
    uFlash: { value: 0 },
    uDesat: { value: 0 },
    uLowHp: { value: 0 },
    uVignette: { value: 0.22 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uTime, uDamage, uFlash, uDesat, uLowHp, uVignette;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      vec2 c = uv - 0.5;
      float r = length(c * vec2(uRes.x / uRes.y, 1.0));
      // a touch of chromatic split when hurt
      float ca = uDamage * 0.004 * r;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;

      // death cam: desaturated, contrasty, slightly warm paper tone
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 mono = mix(vec3(l), vec3(l * 1.05, l, l * 0.92), 0.6);
      mono = (mono - 0.5) * 1.15 + 0.5;
      col = mix(col, mono, uDesat);

      // damage: red bleeding in from the edges (no dots)
      float edge = smoothstep(0.35, 0.95, r);
      float pulse = 0.6 + 0.4 * sin(uTime * 7.0);
      float hurt = clamp(uDamage + uLowHp * pulse * 0.45, 0.0, 1.0);
      col = mix(col, col * vec3(1.0, 0.35, 0.32) + vec3(0.22, 0.0, 0.0), edge * hurt * 0.85);

      // vignette + fine grain
      col *= 1.0 - smoothstep(0.45, 1.25, r) * uVignette * 2.0;
      col += (hash(uv * uRes + fract(uTime * 13.0)) - 0.5) * 0.018;

      col = mix(col, vec3(1.0), uFlash);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class GameRenderer {
  /** opts.getSize() → [w, h] for embedded canvases; defaults to the window. */
  constructor(canvas, opts = {}) {
    this.getSize = opts.getSize || (() => [window.innerWidth, window.innerHeight]);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: !!opts.alpha });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.quality = QUALITY[opts.quality || 'high'];
    this.renderScale = 1;
    this.fx = { damage: 0, flash: 0, desat: 0, lowHp: 0 };
    this.aoCamera = new THREE.PerspectiveCamera();
    this.aoCamera.layers.set(LAYER_WORLD);
    this.build();
    if (!opts.getSize) window.addEventListener('resize', () => this.resize());
  }

  build() {
    const r = this.renderer, q = this.quality;
    this.composer?.dispose?.();
    const [w, h] = this.size();
    const target = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: q.samples });
    this.composer = new EffectComposer(r, target);
    this.renderPass = new RenderPass(null, null);
    this.composer.addPass(this.renderPass);
    this.aoPass = null;
    if (q.ao) {
      this.aoPass = new GTAOPass(null, this.aoCamera, w, h);
      this.aoPass.updateGtaoMaterial({ radius: 0.9, distanceExponent: 1.4, thickness: 2.2, scale: 1.1, samples: 12 });
      this.aoPass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
      this.aoPass.blendIntensity = 0.9;
      // ambient occlusion at half resolution (blended up with linear filtering)
      const setSize = this.aoPass.setSize.bind(this.aoPass);
      this.aoPass.setSize = (sw, sh) => setSize(Math.max(1, Math.floor(sw / 2)), Math.max(1, Math.floor(sh / 2)));
      this.composer.addPass(this.aoPass);
    }
    this.vmPass = new ViewmodelPass();
    this.composer.addPass(this.vmPass);
    this.bloomPass = null;
    if (q.bloom) {
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.45, 1.0);
      this.composer.addPass(this.bloomPass);
    }
    this.composer.addPass(new OutputPass());
    this.gradePass = new ShaderPass(GRADE_SHADER);
    this.composer.addPass(this.gradePass);
    this.resize();
  }

  size() {
    let [w, h] = this.getSize();
    return [Math.max(1, w), Math.max(1, h)];
  }

  setQuality(name) {
    this.quality = QUALITY[name] || QUALITY.high;
    this.build();
    this.onQuality?.(this.quality);
  }

  setRenderScale(s) { this.renderScale = s; this.resize(); }

  resize() {
    const [w, h] = this.size();
    const pr = Math.min(window.devicePixelRatio || 1, this.quality.pixelRatio) * this.renderScale;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.gradePass.uniforms.uRes.value.set(w * pr, h * pr);
    this.width = w; this.height = h;
    this.pixelRatio = pr;
    this.onResize?.(w, h);
  }

  render(scene, camera, vmScene, vmCamera, time) {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    if (this.aoPass) {
      const ao = this.aoCamera;
      ao.position.copy(camera.position);
      ao.quaternion.copy(camera.quaternion);
      ao.fov = camera.fov; ao.aspect = camera.aspect; ao.near = camera.near; ao.far = camera.far;
      ao.updateProjectionMatrix();
      ao.updateMatrixWorld();
      this.aoPass.scene = scene;
    }
    this.vmPass.scene = vmScene;
    this.vmPass.camera = vmCamera;
    const u = this.gradePass.uniforms;
    u.uTime.value = time;
    u.uDamage.value = this.fx.damage;
    u.uFlash.value = this.fx.flash;
    u.uDesat.value = this.fx.desat;
    u.uLowHp.value = this.fx.lowHp;
    this.composer.render();
  }

  /** Copy of the frame just presented (call right after render). */
  snapshot(w = 640) {
    const src = this.renderer.domElement;
    const h = Math.round(w * src.height / src.width);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(src, 0, 0, w, h);
    return c;
  }
}

/** Lightweight renderer for embedded previews (armory turntable, icon baking). */
export class PreviewRenderer {
  constructor(canvas, { getSize, alpha = false } = {}) {
    this.getSize = getSize;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: alpha });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    if (alpha) this.renderer.setClearColor(0x000000, 0);
    this.resize();
  }
  resize() {
    const [w, h] = this.getSize();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(Math.max(1, w), Math.max(1, h), false);
    this.width = w; this.height = h;
  }
  render(scene, camera) { this.renderer.render(scene, camera); }
}
