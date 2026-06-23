// Modèle de données partagé + persistance localStorage.

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

const STORAGE_KEY = 'todomappa';

// État vivant de l'app. Les champs préfixés par _ ne sont jamais sérialisés.
export const state = {
  version: 1,
  camera: { x: 0, y: 0, zoom: 1 },
  nodes: [],   // rectangles : { id, x, y, w, h, text }
  circles: [], // cercles    : { id, x, y, r, color, description }
  selected: null, // id sélectionné (rect ou cercle)
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
  // Les cercles sont dessinés sous les rectangles : on les met en tête de liste.
  state.circles.push(c);
  return c;
}

export function findById(id) {
  return state.nodes.find(n => n.id === id) || state.circles.find(c => c.id === id) || null;
}

export function removeById(id) {
  state.nodes = state.nodes.filter(n => n.id !== id);
  state.circles = state.circles.filter(c => c.id !== id);
  if (state.selected === id) state.selected = null;
}

// ---- Couleur effective d'un rectangle ----
// = couleur du dernier cercle (z-order) qui contient le centre du rectangle.
export function effectiveColor(node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  let color = DEFAULT_GREEN;
  for (const c of state.circles) {
    const dx = cx - c.x, dy = cy - c.y;
    if (dx * dx + dy * dy <= c.r * c.r) color = c.color;
  }
  return color;
}

// ---- Sérialisation ----
export function serialize() {
  return {
    version: state.version,
    camera: { ...state.camera },
    nodes: state.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, text: n.text, image: n.image || undefined })),
    circles: state.circles.map(c => ({
      id: c.id, x: c.x, y: c.y, r: c.r, color: c.color, description: c.description || '',
    })),
  };
}

export function load(obj) {
  if (!obj || typeof obj !== 'object') return false;
  state.camera = obj.camera ? { ...obj.camera } : { x: 0, y: 0, zoom: 1 };
  state.nodes = Array.isArray(obj.nodes) ? obj.nodes.map(n => ({ ...n })) : [];
  state.circles = Array.isArray(obj.circles) ? obj.circles.map(c => ({ ...c })) : [];
  state.selected = null;
  // Évite les collisions d'ID après import.
  _id = Math.max(1, state.nodes.length + state.circles.length) + Date.now() % 1000;
  return true;
}

// ---- Persistance localStorage (throttle) ----
let _saveTimer = null;
let _saveSuppressed = false;
// Quand on ouvre un fichier via ?file=, on n'écrase pas le localStorage perso.
export function setSaveSuppressed(v) { _saveSuppressed = v; }

export function scheduleSave() {
  if (_saveSuppressed || _saveTimer) return;
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (e) { /* quota */ }
  }, 400);
}

export function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return load(JSON.parse(raw));
  } catch (e) { /* corrompu */ }
  return false;
}
