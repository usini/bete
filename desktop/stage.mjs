import { cpSync, mkdirSync } from 'node:fs';

const dist = new URL('./dist/', import.meta.url);
mkdirSync(dist, { recursive: true });
for (const path of ['index.html', 'js', 'css', 'img']) {
  cpSync(new URL('../' + path, import.meta.url), new URL(path, dist), { recursive: true });
}
