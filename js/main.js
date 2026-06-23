// Bootstrap + boucle de rendu.
import { state, restore, addRect, addCircle } from './state.js';
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

// Restauration ou seed de démo.
if (!restore()) seedDemo();
state.nodes.forEach(reset);

function seedDemo() {
  const c = addCircle(0, 0, '#107c10');
  c.description = 'TODO';
  const a = addRect(-110, -40, 'Clic droit\npour creer');
  const b = addRect(40, 10, 'Glisse-moi !');
  reset(a); reset(b);
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
