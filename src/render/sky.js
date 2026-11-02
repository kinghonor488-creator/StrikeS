// Stylized-realistic sky dome (warm afternoon), plus an IBL environment baked from it.
import * as THREE from 'three';
import { LAYER_FX } from './renderer.js';

export const SKY = {
  sunDir: new THREE.Vector3(-0.42, 0.62, 0.66).normalize(),
  zenith: new THREE.Color('#3f7fd0'),
  horizon: new THREE.Color('#cfe3f2'),
  ground: new THREE.Color('#9c9184'),
  sun: new THREE.Color('#fff2d6'),
  fog: new THREE.Color('#c6d8e6'),
};

const VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const FRAG = /* glsl */`
precision highp float;
varying vec3 vDir;
uniform vec3 uZenith, uHorizon, uGround, uSun, uSunDir;
uniform float uTime, uSunDisc, uClouds;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  // atmosphere gradient
  vec3 sky = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.85, h), 0.55));
  vec3 col = h > 0.0 ? sky : mix(uHorizon, uGround, smoothstep(0.0, -0.25, h));
  // sun glow + HDR disc (blooms)
  float sd = max(dot(d, uSunDir), 0.0);
  col += uSun * (pow(sd, 8.0) * 0.25 + pow(sd, 64.0) * 0.35);
  col += uSun * smoothstep(0.9993, 0.9996, sd) * uSunDisc;
  // soft cumulus on a virtual cloud deck
  if (h > 0.02 && uClouds > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 1.4 + vec2(uTime * 0.004, uTime * 0.002);
    float n = fbm(uv * 0.9);
    float c = smoothstep(0.52, 0.78, n) * smoothstep(0.02, 0.25, h);
    float lit = 0.75 + 0.35 * pow(sd, 3.0);
    vec3 cloudCol = mix(vec3(0.78, 0.82, 0.88), vec3(1.0, 0.98, 0.94), smoothstep(0.55, 0.9, n)) * lit;
    col = mix(col, cloudCol, c * uClouds);
  }
  gl_FragColor = vec4(col, 1.0);
}`;

function skyMaterial(disc) {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uZenith: { value: SKY.zenith }, uHorizon: { value: SKY.horizon }, uGround: { value: SKY.ground },
      uSun: { value: SKY.sun }, uSunDir: { value: SKY.sunDir },
      uTime: { value: 0 }, uSunDisc: { value: disc }, uClouds: { value: 0.85 },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

export function createSky() {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(450, 48, 24), skyMaterial(18));
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = -100;
  mesh.frustumCulled = false;
  return mesh;
}

/** Bake a prefiltered environment map from the sky (dim sun so speculars don't sparkle). */
export function bakeEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial(2)));
  const env = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  return env;
}
