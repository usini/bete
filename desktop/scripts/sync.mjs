// Copies the static web app (index.html, css/, js/, assets/) into desktop/dist/,
// which is what Tauri actually bundles. Keeps the desktop wrapper isolated from
// repo internals (.git, server/, desktop/ itself) that must not end up in the binary.
import { cpSync, rmSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dist = path.resolve(here, '..', 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const entry of ['index.html', 'css', 'js', 'assets']) {
  const src = path.join(root, entry);
  if (existsSync(src)) cpSync(src, path.join(dist, entry), { recursive: true });
}

console.log('desktop/dist synced from', root);
