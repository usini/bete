// Cache-busting for a static site with no build step.
// Adds (or replaces) a ?v=<version> on the entry script and on all local ES
// imports, so every deploy forces the browser to re-download the changed JS
// (no more need to clear the cache).
//
// Run before every deployment commit: node cachebust.mjs
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
console.log(`cachebust: version ${V} applied (${touched} file(s))`);
