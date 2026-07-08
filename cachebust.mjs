// Cache-busting for a static site with no build step.
// Adds (or replaces) a ?v=<version> on the entry script and on all local ES
// imports, so every deploy forces the browser to re-download the changed JS
// (no more need to clear the cache).
//
// Run before every deployment commit: node cachebust.mjs
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';

const V = (process.argv[2] || Date.now().toString(36));

const files = ['index.html', ...readdirSync('js').filter((f) => f.endsWith('.js')).map((f) => 'js/' + f)];

// import/export ... from './x.js'   |   import('./x.js')   |   <script src="js/main.js">
// | <link href="css/style.css"> (the stylesheet went years without a buster:
// CSS-only changes silently waited out the browser/Pages cache).
const patterns = [
  /(from\s+['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(import\(\s*['"]\.\/[\w./-]+\.js)(\?v=[^'"]*)?(['"])/g,
  /(src=["']js\/main\.js)(\?v=[^"']*)?(["'])/g,
  /(href=["']css\/style\.css)(\?v=[^"']*)?(["'])/g,
];

let touched = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  const before = s;
  for (const re of patterns) s = s.replace(re, `$1?v=${V}$3`);
  if (s !== before) { writeFileSync(f, s); touched++; }
}

// Manifest for the desktop app's hot web-asset update (see desktop/src-tauri/src/main.rs
// check_web_update): lists every file the desktop app needs to mirror locally
// to run the current web build without a full MSI reinstall.
function listDir(dir) {
  let out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = dir + '/' + entry.name;
    if (entry.isDirectory()) out = out.concat(listDir(rel));
    else out.push(rel);
  }
  return out;
}
const manifestFiles = ['index.html', ...listDir('js'), ...listDir('css'), ...listDir('assets')];
writeFileSync('manifest.json', JSON.stringify({ version: V, files: manifestFiles }, null, 1) + '\n');

console.log(`cachebust: version ${V} applied (${touched} file(s)), manifest.json (${manifestFiles.length} file(s))`);
