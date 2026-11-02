// Dev-only: every gun model in a lit lineup, for visual checks. Not shipped with the game.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildGunModel, MODEL_IDS } from '../src/game/guns/models.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#3a414b');
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
sun.position.set(3, 4, 2);
scene.add(sun);

const params = new URLSearchParams(location.search);
const only = params.get('id');
const ids = only ? only.split(',') : MODEL_IDS;
const cols = ids.length === 1 ? 1 : ids.length <= 4 ? 2 : 4;
const cellW = 1.35, cellH = 0.55;
ids.forEach((id, i) => {
  const m = buildGunModel(id, '#e8553f');
  const box = new THREE.Box3().setFromObject(m);
  m.position.sub(box.getCenter(new THREE.Vector3()));
  const holder = new THREE.Group();
  holder.add(m);
  holder.rotation.y = Math.PI / 2 + (params.has('angle') ? +params.get('angle') : 0.35);
  const col = i % cols, row = Math.floor(i / cols);
  holder.position.set((col - (cols - 1) / 2) * cellW, -row * cellH, 0);
  scene.add(holder);
});
const rows = Math.ceil(ids.length / cols);
const cam = new THREE.PerspectiveCamera(ids.length === 1 ? 22 : 30, innerWidth / innerHeight, 0.1, 50);
const span = ids.length === 1 ? 1.4 : Math.max(cols * cellW, rows * cellH * 2.2 * (innerWidth / innerHeight)) * 0.9;
// ?zoom=3&px=0.1&py=0 frames a close-up (px/py: metres from the lineup centre)
const zoom = +(params.get('zoom') || 1), px = +(params.get('px') || 0), py = +(params.get('py') || 0);
const dist = (span / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (innerWidth / innerHeight)) + 0.6) / zoom;
cam.position.set(px, -(rows - 1) * cellH / 2 + 0.25 / zoom + py, dist);
cam.lookAt(px, -(rows - 1) * cellH / 2 + py, 0);
renderer.render(scene, cam);
window.__render = () => renderer.render(scene, cam);
