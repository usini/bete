// Modèle de données partagé + persistance localStorage.
import { pointInHex } from './geom.js?v=mqwdczl7';

export const DEFAULT_GREEN = '#39ff14';

// Presets de couleur (vert fluo + accents type Xbox).
export const COLORS = [
  '#39ff14', // vert nucléaire
  '#107c10', // vert Xbox
  '#00b7eb', // cyan
  '#e3008c', // magenta
  '#ff8c00', // orange
  '#9b30ff', // violet
  '#ffd400', // jaune
  '#f2f2f2', // blanc cassé
];

// Clé de stockage par board (multi pense-bêtes). 'home' = page perso par défaut.
let _boardId = 'home';
let _boardName = '';
let storageKey = 'todomappa:home';
export function setBoardId(id) { _boardId = id || 'home'; storageKey = 'todomappa:' + _boardId; }
export function getBoardId() { return _boardId; }
export function setBoardName(n) { _boardName = n || ''; }
export function getBoardName() { return _boardName; }

// État vivant de l'app. Les champs préfixés par _ ne sont jamais sérialisés.
export const state = {
  version: 1,
  camera: { x: 0, y: 0, zoom: 1 },
  // rectangles : { id, x, y, w, h, text, image } -- ou lien : { id, x, y, w, h, ref }
  nodes: [],
  circles: [],  // cercles   : { id, x, y, r, color, description }
  hexagons: [], // hexagones : { id, x, y, r, color, description }
  selected: null, // id sélectionné (rect, cercle ou hexagone)
  selectedIds: [], // sélection multiple (ids de rectangles) pour déplacer/effacer en groupe
};

let _id = 1;
export function newId() { return 'n' + (_id++).toString(36) + Date.now().toString(36); }

// ---- Création d'éléments ----
export function addRect(wx, wy, text = '') {
  const n = { id: newId(), x: wx, y: wy, w: 150, h: 70, text };
  state.nodes.push(n);
  return n;
}

export function addCircle(wx, wy, color = COLORS[1]) {
  const c = { id: newId(), x: wx, y: wy, r: 160, color, description: '' };
  state.circles.push(c);
  return c;
}

export function addHexagon(wx, wy, color = COLORS[4]) {
  const h = { id: newId(), x: wx, y: wy, r: 170, color, description: '' };
  state.hexagons.push(h);
  return h;
}

export function findById(id) {
  return state.nodes.find(n => n.id === id)
    || state.circles.find(c => c.id === id)
    || state.hexagons.find(h => h.id === id)
    || null;
}

export function removeById(id) {
  // Supprime l'élément + tout lien qui pointait vers lui (cascade).
  state.nodes = state.nodes.filter(n => n.id !== id && n.ref !== id);
  state.circles = state.circles.filter(c => c.id !== id);
  state.hexagons = state.hexagons.filter(h => h.id !== id);
  if (state.selected === id) state.selected = null;
  if (state.selectedIds.length) state.selectedIds = state.selectedIds.filter(x => x !== id);
}

// ---- Liens (rectangles dans un hexagone) ----
// La source d'un lien est toujours un vrai rectangle (jamais un autre lien).
export function sourceOf(node) {
  if (!node.ref) return null;
  return state.nodes.find(n => n.id === node.ref && !n.ref) || null;
}
export function displayText(node) {
  if (node.ref) { const s = sourceOf(node); return s ? s.text : ''; }
  return node.text;
}
export function displayImage(node) {
  if (node.ref) { const s = sourceOf(node); return s ? s.image : null; }
  return node.image;
}
export function displayLink(node) {
  if (node.ref) { const s = sourceOf(node); return s ? s.link : undefined; }
  return node.link;
}

// ---- Couleur effective d'un rectangle ----
// Lien : couleur de sa source (donc du cercle source). Sinon : couleur du dernier
// cercle/hexagone (z-order) qui contient son centre.
export function effectiveColor(node) {
  if (node.ref) {
    const src = sourceOf(node);
    return src ? effectiveColor(src) : DEFAULT_GREEN;
  }
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  let color = DEFAULT_GREEN;
  for (const c of state.circles) {
    const dx = cx - c.x, dy = cy - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) color = c.color;
  }
  for (const h of state.hexagons) {
    if (pointInHex(cx, cy, h.x, h.y, h.r)) color = h.color;
  }
  return color;
}

// ---- Sérialisation ----
export function serialize() {
  return {
    version: state.version,
    name: _boardName || undefined,
    camera: { ...state.camera },
    nodes: state.nodes
      .filter(n => n.kind !== 'liaison') // blocs de liaison = transitoires
      .map(n => {
        if (n.ref) return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, ref: n.ref };
        if (n.kind === 'voice') return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, kind: 'voice', dur: n.dur || 0 }; // audio en IndexedDB
        return { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text, image: n.image || undefined, link: n.link || undefined, kind: n.kind === 'pancarte' ? 'pancarte' : undefined };
      }),
    circles: state.circles.map(c => ({
      id: c.id, x: c.x, y: c.y, r: c.r, color: c.color, description: c.description || '',
    })),
    hexagons: state.hexagons.map(h => ({
      id: h.id, x: h.x, y: h.y, r: h.r, color: h.color, description: h.description || '',
    })),
  };
}

export function load(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.name != null) _boardName = obj.name;
  state.camera = obj.camera ? { ...obj.camera } : { x: 0, y: 0, zoom: 1 };
  state.nodes = Array.isArray(obj.nodes) ? obj.nodes.map(n => ({ ...n })) : [];
  state.circles = Array.isArray(obj.circles) ? obj.circles.map(c => ({ ...c })) : [];
  state.hexagons = Array.isArray(obj.hexagons) ? obj.hexagons.map(h => ({ ...h })) : [];
  // Élague les liens orphelins (source disparue).
  state.nodes = state.nodes.filter(n => !n.ref || state.nodes.some(m => m.id === n.ref && !m.ref));
  state.selected = null;
  state.selectedIds = [];
  // Évite les collisions d'ID après import.
  _id = Math.max(1, state.nodes.length + state.circles.length + state.hexagons.length) + (Date.now() % 1000);
  return true;
}

// ---- Persistance localStorage (throttle) + historique d'annulation ----
let _saveTimer = null;
let _saveSuppressed = false;
// Quand on ouvre un fichier via ?file=, on n'écrase pas le localStorage perso.
export function setSaveSuppressed(v) { _saveSuppressed = v; }

let _undoStack = [];        // états sérialisés précédents (pour annuler)
let _lastSaved = null;      // dernier état sauvegardé (JSON)
let _applyingUndo = false;
const UNDO_MAX = 25;

// Définit l'état de référence (après chargement) : la 1re modif sera annulable.
export function initUndoBaseline() {
  _lastSaved = JSON.stringify(serialize());
  _undoStack = [];
}

function commitSave() {
  const cur = JSON.stringify(serialize());
  if (cur === _lastSaved) return;
  if (!_applyingUndo && _lastSaved != null) {
    _undoStack.push(_lastSaved);
    if (_undoStack.length > UNDO_MAX) _undoStack.shift();
  }
  _lastSaved = cur;
  try { localStorage.setItem(storageKey, cur); } catch (e) { /* quota */ }
}

export function scheduleSave() {
  if (_saveSuppressed || _saveTimer) return;
  _saveTimer = setTimeout(() => { _saveTimer = null; commitSave(); }, 400);
}

export function canUndo() { return _undoStack.length > 0; }

// Annule la dernière modification (revient à l'état précédent).
export function undo() {
  if (!_undoStack.length) return false;
  const prev = _undoStack.pop();
  const cam = { ...state.camera }; // l'annulation ne doit pas bouger la vue
  _applyingUndo = true;
  load(JSON.parse(prev));
  state.camera = cam;
  _applyingUndo = false;
  _lastSaved = prev;
  try { localStorage.setItem(storageKey, prev); } catch (e) { /* */ }
  return true;
}

export function restore() {
  try {
    let raw = localStorage.getItem(storageKey);
    // Migration : ancien board unique -> slot 'home'.
    if (!raw && _boardId === 'home') raw = localStorage.getItem('todomappa');
    if (raw) return load(JSON.parse(raw));
  } catch (e) { /* corrompu */ }
  return false;
}
