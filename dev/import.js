// Dev: show a raw glTF gun from the side with a 1 cm / 10 cm grid and named marker points.
// ?file=/models/guns/service_pistol/service_pistol_2k.gltf&hide=name1,name2&span=0.3&cx=0&cy=0
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
const span = +(q.get('span') || 0.4);
const aspect = innerWidth / innerHeight;
const cam = new THREE.OrthographicCamera(-span * aspect, span * aspect, span, -span, -10, 10);
const cx = +(q.get('cx') || 0), cy = +(q.get('cy') || 0);
const view = q.get('view') || 'side'; // side: look along -Z (gltf), top: look down -Y
if (view === 'top') { cam.position.set(cx, 5, cy); cam.up.set(0, 0, -1); cam.lookAt(cx, 0, cy); }
else { cam.position.set(cx, cy, 5); cam.lookAt(cx, cy, 0); }
// grid in the gltf XY plane (or XZ for top)
const grid = (step, color, size) => {
  const g = new THREE.GridHelper(size, size / step, color, color);
  if (view !== 'top') g.rotation.x = Math.PI / 2;
  g.position.set(cx, view === 'top' ? -1 : cy, view === 'top' ? cy : -1);
  g.material.depthTest = false; g.renderOrder = -1;
  scene.add(g);
};
grid(0.01, 0x4a5058, 2); grid(0.1, 0x8a9098, 2);
scene.add(new THREE.AxesHelper(0.1));
const marks = (q.get('marks') || '').split(';').filter(Boolean);
for (const m of marks) {
  const [name, x, y, z] = m.split(',');
  const s = new THREE.Mesh(new THREE.SphereGeometry(span * 0.012), new THREE.MeshBasicMaterial({ color: 0xff3355, depthTest: false }));
  s.position.set(+x, +y, +(z || 0)); s.renderOrder = 10; scene.add(s);
}
new GLTFLoader().load(q.get('file'), (gltf) => {
  const hide = (q.get('hide') || '').split(',');
  gltf.scene.traverse((o) => { if (hide.includes(o.name)) o.visible = false; });
  scene.add(gltf.scene);
  const lines = [];
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    const b = new THREE.Box3().setFromObject(o);
    lines.push(`${o.name.padEnd(36)} x ${b.min.x.toFixed(3)}..${b.max.x.toFixed(3)}  y ${b.min.y.toFixed(3)}..${b.max.y.toFixed(3)}  z ${b.min.z.toFixed(3)}..${b.max.z.toFixed(3)}`);
  });
  document.getElementById('info').textContent = lines.join('\n');
  renderer.render(scene, cam);
  window.__ready = true;
});
