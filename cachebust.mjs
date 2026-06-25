// Cache-busting pour site statique sans build.
// Met (ou remplace) un ?v=<version> sur le script d'entrée et sur tous les
// imports ES locaux, afin que chaque déploiement force le navigateur à
// re-télécharger le JS modifié (plus besoin de vider le cache).
//
// À lancer avant chaque commit de déploiement :  node cachebust.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const V = (process.argv[2] || Date.now().toString(36));

const files = ['index.html', ...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];

// import/export ... from './x.js'   |   import('./x.js')   |   <script src="js/main.js">
const patterns = [
  /(from\s+['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(import\(\s*['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(src=["']js\/main\.js)(\?v=[^"']*)?(["'])/g,
];

let touched = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  const before = s;
  for (const re of patterns) s = s.replace(re, `$1?v=${V}$3`);
  if (s !== before) { writeFileSync(f, s); touched++; }
}
console.log(`cachebust: version ${V} appliquée (${touched} fichier(s))`);
