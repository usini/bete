// Bootstrap + boucle de rendu.
import { state, restore, addRect, addCircle, addHexagon, load, setSaveSuppressed, newId } from './state.js';
import { setView } from './camera.js';
import { render } from './render.js';
import { step, reset } from './physics.js';
import * as minimap from './minimap.js';
import * as input from './input.js';

const board = document.getElementById('board');
const ctx = board.getContext('2d');
let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  board.width = Math.floor(w * dpr);
  board.height = Math.floor(h * dpr);
  board.style.width = w + 'px';
  board.style.height = h + 'px';
  setView(w, h);
}

window.addEventListener('resize', resize);
resize();

// Source des données : ?file=<url> sinon localStorage sinon seed de démo.
const fileUrl = new URLSearchParams(location.search).get('file');
if (fileUrl) {
  // Mode "ouverture de fichier" : on n'écrase pas le localStorage perso.
  setSaveSuppressed(true);
  loadFromUrl(fileUrl);
} else if (!restore()) {
  seedDemo();
}
state.nodes.forEach(reset);

async function loadFromUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (!load(await res.json())) throw new Error('JSON invalide');
    state.nodes.forEach(reset);
  } catch (err) {
    console.warn('TODOMAPPA: échec du chargement de', url, err);
    // Repli : localStorage ou démo, et on réactive la sauvegarde.
    setSaveSuppressed(false);
    if (!restore()) seedDemo();
    state.nodes.forEach(reset);
  }
}

function seedDemo() {
  const c = addCircle(-140, 0, '#107c10');
  c.description = 'TODO';
  const a = addRect(-230, -30, 'Tache A');
  const b = addRect(-180, 50, 'Glisse-moi\ndans l\'hexa');
  // Hexagone "AUJOURDHUI" avec un lien vers Tache A.
  const hx = addHexagon(190, 0, '#ff8c00');
  hx.description = 'AUJOURDHUI';
  const link = { id: newId(), x: 130, y: -30, w: 150, h: 70, ref: a.id };
  state.nodes.push(link);
  reset(a); reset(b); reset(link);
}

minimap.init();
input.init(board, () => { state.nodes.forEach(reset); });

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  // Physique des rectangles.
  for (const n of state.nodes) step(n, dt);

  // Rendu board (en coordonnées CSS px grâce au scale DPR).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  render(ctx);

  minimap.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Re-render propre une fois la police pixel chargée.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { /* la boucle RAF reprend le rendu */ });
}
