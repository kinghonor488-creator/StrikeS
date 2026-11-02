// Downloads the licensed gun models listed in gun-sources.json from Sketchfab.
// Usage (your own API token from https://sketchfab.com/settings/password):
//   SKETCHFAB_TOKEN=xxxx node tools/fetch-guns.mjs
// Files land in assets/guns_src/<id>/ (glTF + textures). Already-downloaded guns are skipped.
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const token = process.env.SKETCHFAB_TOKEN;
if (!token) { console.error('Set SKETCHFAB_TOKEN first (Sketchfab → Settings → Password & API → API token).'); process.exit(1); }
const sources = JSON.parse(readFileSync(join(root, 'tools/gun-sources.json'), 'utf8'));
const only = process.argv.slice(2);

for (const [id, s] of Object.entries(sources)) {
  if (only.length && !only.includes(id)) continue;
  const dir = join(root, 'assets/guns_src', id);
  if (existsSync(join(dir, 'scene.gltf')) || existsSync(join(dir, 'scene.glb'))) { console.log(`✓ ${id} already here`); continue; }
  process.stdout.write(`↓ ${id} (${s.title}) … `);
  const res = await fetch(`https://api.sketchfab.com/v3/models/${s.uid}/download`, { headers: { Authorization: `Token ${token}` } });
  if (!res.ok) { console.log(`failed: HTTP ${res.status}`); continue; }
  const info = await res.json();
  const pick = info.gltf || info.glb;
  if (!pick) { console.log('no glTF download offered'); continue; }
  mkdirSync(dir, { recursive: true });
  const file = await fetch(pick.url);
  const buf = Buffer.from(await file.arrayBuffer());
  if (info.gltf) {
    const zip = join(dir, 'model.zip');
    writeFileSync(zip, buf);
    execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  } else {
    writeFileSync(join(dir, 'scene.glb'), buf);
  }
  console.log(`${(buf.length / 1e6).toFixed(1)} MB`);
}
console.log('done');
