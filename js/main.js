// Bootstrap + boucle de rendu.
import { state, restore, addRect, addCircle, addHexagon, load, setSaveSuppressed, scheduleSave, newId, setBoardId } from './state.js?v=mqtyx9od';
import { setView } from './camera.js?v=mqtyx9od';
import { render } from './render.js?v=mqtyx9od';
import { step, reset } from './physics.js?v=mqtyx9od';
import * as minimap from './minimap.js?v=mqtyx9od';
import * as input from './input.js?v=mqtyx9od';
import * as fx from './fx.js?v=mqtyx9od';
import { joinHost, getNetMode } from './sync.js?v=mqtyx9od';

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

// ---- Choix du board (multi pense-bêtes) ----
// ?id=nom -> board nommé ; sinon ?peer=X -> slot dédié à l'hôte ; sinon 'home'.
function sanitizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'home';
}
const params = new URLSearchParams(location.search);
const idParam = params.get('id');
const peerId = params.get('peer');
const fileUrl = params.get('file');

let boardId, boardLabel;
if (idParam) { boardId = sanitizeId(idParam); boardLabel = boardId; }
else if (peerId) { boardId = 'peer-' + sanitizeId(peerId); boardLabel = 'partagé'; }
else { boardId = 'home'; boardLabel = ''; }
setBoardId(boardId);
document.title = 'TODOMAPPA' + (boardLabel ? ' · ' + boardLabel : '');

// Les boards nommés démarrent vides ; seul 'home' a la démo au premier lancement.
function seedIfHome() { if (boardId === 'home') seedDemo(); }

if (peerId) {
  // Mode CLIENT : affiche le board local puis se synchronise (bidirectionnel).
  if (!restore()) seedIfHome();
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
  if (!restore()) seedIfHome();
  state.nodes.forEach(reset);
  if (boardLabel) toast('BOARD : ' + boardLabel.toUpperCase());
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
    if (!restore()) seedIfHome();
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
  updateNetMode();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// Indicateur P2P direct / relais TURN (mis à jour seulement quand ça change).
let lastNet;
function updateNetMode() {
  const nm = getNetMode();
  if (nm === lastNet) return;
  lastNet = nm;
  const el = document.getElementById('netmode');
  if (!nm) { el.className = ''; el.textContent = ''; }
  else if (nm === 'relay') { el.className = 'show relay'; el.textContent = '● RELAIS (TURN)'; }
  else if (nm === 'p2p') { el.className = 'show p2p'; el.textContent = '● P2P DIRECT'; }
  else { el.className = 'show'; el.textContent = '● LIAISON…'; }
}

// Re-render propre une fois la police pixel chargée.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { /* la boucle RAF reprend le rendu */ });
}
