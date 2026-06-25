// Bootstrap + boucle de rendu.
import { state, restore, addRect, addCircle, addHexagon, load, setSaveSuppressed, scheduleSave, newId } from './state.js?v=mqtot15q';
import { setView } from './camera.js?v=mqtot15q';
import { render } from './render.js?v=mqtot15q';
import { step, reset } from './physics.js?v=mqtot15q';
import * as minimap from './minimap.js?v=mqtot15q';
import * as input from './input.js?v=mqtot15q';
import * as fx from './fx.js?v=mqtot15q';
import { joinHost } from './sync.js?v=mqtot15q';

let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

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

// Source des données : ?peer=<id> (client P2P), ?file=<url>, sinon localStorage.
const params = new URLSearchParams(location.search);
const peerId = params.get('peer');
const fileUrl = params.get('file');

if (peerId) {
  // Mode CLIENT : affiche le board local puis se synchronise (bidirectionnel).
  if (!restore()) seedDemo();
  state.nodes.forEach(reset);
  toast('CONNEXION AU HOST...');
  joinHost(peerId, (st) => {
    if (st === 'synced') toast('SYNCHRONISE ✓');
    else if (st === 'connected') toast('CONNECTE - RECEPTION...');
    else if (st === 'error') toast('HOST INJOIGNABLE', 4000);
    else if (st === 'closed') toast('HOST DECONNECTE', 4000);
  });
} else if (fileUrl) {
  // Mode "ouverture de fichier" : on n'écrase pas le localStorage perso.
  setSaveSuppressed(true);
  loadFromUrl(fileUrl);
  state.nodes.forEach(reset);
} else {
  if (!restore()) seedDemo();
  state.nodes.forEach(reset);
}

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

// Handle de debug (inspection console : todomappa.state).
window.todomappa = { state, fx };

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  // Physique des rectangles + particules.
  for (const n of state.nodes) step(n, dt);
  fx.update(dt);

  // Rendu board (en coordonnées CSS px grâce au scale DPR).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  render(ctx);
  fx.render(ctx);

  minimap.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Re-render propre une fois la police pixel chargée.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { /* la boucle RAF reprend le rendu */ });
}
