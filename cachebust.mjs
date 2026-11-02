// Cache-busting for a static site with no build step.
// Adds (or replaces) a ?v=<version> on the entry script, the stylesheet and all local ES
// imports, so every deploy forces the browser to re-download the changed files
// (no more need to clear the cache).
//
// Run it after any change to a js/ or css/ file, and before every deploy:
//   node cachebust.mjs            (version = time-based stamp)
//   node cachebust.mjs 1.2.3      (explicit version)
//
// All imports of a module must carry the SAME ?v=, otherwise the browser loads it twice
// (two copies of the state, two sets of listeners). Re-run the script when you add an import.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const V = process.argv[2] || Date.now().toString(36);

const files = ['index.html', ...readdirSync(join(root, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];

// import/export ... from './x.js'   |   import('./x.js')   |   <script src="js/main.js">
// | <link href="css/style.css">
const patterns = [
  /(from\s+['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(import\(\s*['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(src=["']js\/main\.js)(\?v=[^"']*)?(["'])/g,
  /(href=["']css\/style\.css)(\?v=[^"']*)?(["'])/g,
];

let touched = 0;
for (const f of files) {
  const path = join(root, f);
  const before = readFileSync(path, 'utf8');
  let s = before;
  for (const re of patterns) s = s.replace(re, `$1?v=${V}$3`);
  if (s !== before) { writeFileSync(path, s); touched++; }
}

console.log(`cachebust: version ${V} applied (${touched} file(s) changed)`);
