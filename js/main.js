// Bootstrap + boucle de rendu.
import { state, restore, addRect, addCircle, addHexagon, load, setSaveSuppressed, scheduleSave, newId, setBoardId, setBoardName, getBoardName, initUndoBaseline } from './state.js?v=mqwdczl7';
import { setView } from './camera.js?v=mqwdczl7';
import { render } from './render.js?v=mqwdczl7';
import { step, reset } from './physics.js?v=mqwdczl7';
import * as minimap from './minimap.js?v=mqwdczl7';
import * as input from './input.js?v=mqwdczl7';
import * as fx from './fx.js?v=mqwdczl7';
import { joinHost, getNetMode, liaisonStatus, disconnect } from './sync.js?v=mqwdczl7';
import { recordBoard, getBoardEntry } from './boards.js?v=mqwdczl7';
import { TUTORIAL } from './tutorial.js?v=mqwdczl7';
import { applyTheme } from './theme.js?v=mqwdczl7';
import { initSettings, openSettings } from './settings.js?v=mqwdczl7';
import { recordLiaison, getLiaison } from './liaisons.js?v=mqwdczl7';

applyTheme(); // applique le thème enregistré dès le démarrage

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
function sanitizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'home';
}
const params = new URLSearchParams(location.search);
const idParam = params.get('id');
const peerId = params.get('peer');
const fileUrl = params.get('file');
const nameParam = params.get('name');

// Premier lancement : on envoie l'utilisateur vers le tutoriel (puis l'app vit sur home).
const REDIRECT = !localStorage.getItem('todomappa:seen') && !idParam && !peerId && !fileUrl;
if (REDIRECT) {
  try { localStorage.setItem('todomappa:seen', '1'); } catch (e) { /* */ }
  recordBoard('home', 'Home', null);
  recordBoard('tutorial', 'Tutoriel', null);
  location.replace(location.pathname + '?id=tutorial');
}

let boardId = 'home';
function seedIfHome() { if (boardId === 'home') seedDemo(); }

if (!REDIRECT) {
  if (idParam) boardId = sanitizeId(idParam);
  else if (peerId) boardId = 'peer-' + sanitizeId(peerId);
  else boardId = 'home';
  setBoardId(boardId);

  if (boardId === 'tutorial') {
    load(TUTORIAL);                 // board intégré, lecture seule
    setSaveSuppressed(true);
    state.nodes.forEach(reset);
  } else if (peerId && boardId !== 'home') {
    if (!restore()) seedIfHome();
    state.nodes.forEach(reset);
    recordLiaison(peerId); // mémorise la liaison active (renommable dans Paramètres)
    toast('CONNEXION AU HOST...');
    joinHost(peerId, (st) => {
      if (st === 'synced') toast('SYNCHRONISE ✓');
      else if (st === 'connected') toast('CONNECTE - RECEPTION...');
      else if (st === 'error') toast('HOST INJOIGNABLE', 4000);
      else if (st === 'closed') toast('HOST DECONNECTE', 4000);
    });
  } else if (fileUrl) {
    setSaveSuppressed(true);
    loadFromUrl(fileUrl);
    state.nodes.forEach(reset);
  } else {
    // Home est sanctuarisé : jamais connecté (pour ne pas être écrasé).
    if (peerId && boardId === 'home') toast('HOME RESTE LOCAL (non connectable)', 3500);
    if (!restore()) seedIfHome();
    state.nodes.forEach(reset);
  }

  // Nom du board : sérialisé > ?name= > historique > défaut. Puis affichage + historique.
  resolveBoardName(boardId);
  recordBoard(boardId, getBoardName(), (boardId !== 'home' && peerId) || null);
  applyBoardNameUI();
  initUndoBaseline(); // état de référence pour l'annulation
}

// Résout et applique le nom affiché du board.
function resolveBoardName(id) {
  let name;
  if (id === 'home') name = 'Home';
  else if (id === 'tutorial') name = 'Tutoriel';
  else {
    name = getBoardName() || nameParam || (getBoardEntry(id) && getBoardEntry(id).name) || id;
  }
  setBoardName(name);
  document.title = 'TODOMAPPA' + (id === 'home' ? '' : ' · ' + name);
}

function applyBoardNameUI() {
  const el = document.getElementById('boardname');
  el.textContent = getBoardName();
  const editable = boardId !== 'home' && boardId !== 'tutorial';
  el.classList.toggle('editable', editable);
  if (editable && !el._wired) { el._wired = true; el.addEventListener('click', beginRenameBoard); }
}

function beginRenameBoard() {
  const el = document.getElementById('boardname');
  if (el.getAttribute('contenteditable') === 'true') return;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  const range = document.createRange(); range.selectNodeContents(el);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    else if (e.key === 'Escape') { el.textContent = getBoardName(); el.blur(); }
  };
  const commit = () => {
    el.removeAttribute('contenteditable');
    el.removeEventListener('blur', commit);
    el.removeEventListener('keydown', onKey);
    const nm = (el.textContent || '').replace(/\n/g, ' ').trim().slice(0, 40) || getBoardName();
    setBoardName(nm); el.textContent = nm;
    document.title = 'TODOMAPPA · ' + nm;
    recordBoard(boardId, nm, peerId || null);
    scheduleSave();
  };
  el.addEventListener('keydown', onKey);
  el.addEventListener('blur', commit);
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

if (!REDIRECT) {
  minimap.init();
  input.init(board, () => { state.nodes.forEach(reset); });
  initSettings();
  // Handle de debug (inspection console : todomappa.state).
  window.todomappa = { state, fx };
  requestAnimationFrame(loop);
}

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
  updateLiaisonBadge();
  requestAnimationFrame(loop);
}

// Indicateur de la liaison active (haut centre) + bouton déconnecter.
let lastLiaison = '';
function updateLiaisonBadge() {
  const st = liaisonStatus();
  const name = st.role === 'host' ? 'Hôte' : (st.role === 'client' ? ((getLiaison(st.peer) && getLiaison(st.peer).name) || st.peer) : '');
  const sig = (st.role || '') + '|' + name;
  if (sig === lastLiaison) return;
  lastLiaison = sig;
  const el = document.getElementById('liaisonbadge');
  if (!el) return;
  if (!st.role) { el.classList.remove('show'); el.innerHTML = ''; return; }
  el.innerHTML = '';
  const lbl = document.createElement('span');
  lbl.className = 'lb-name';
  lbl.textContent = (st.role === 'host' ? '🟢 ' : '🔗 ') + name;
  lbl.title = 'Gérer les liaisons';
  lbl.addEventListener('click', () => openSettings());
  const x = document.createElement('button');
  x.className = 'lb-x';
  x.textContent = '✕';
  x.title = 'Déconnecter la liaison';
  x.addEventListener('click', (e) => { e.stopPropagation(); disconnect(); });
  el.appendChild(lbl); el.appendChild(x);
  el.classList.add('show');
}

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
