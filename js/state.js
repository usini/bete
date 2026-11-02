// Data model, sanitizers and local autosave (localStorage).
// Image bytes are NOT stored here: a node only keeps a reference ('idb:<id>').
import { explode } from './fx.js?v=mvzfvfhr';

export const COLORS = ['#39ff14', '#00b7eb', '#e3008c', '#ff8c00', '#9b30ff', '#ffd400', '#f2f2f2'];
export const DEFAULT_COLOR = COLORS[1];
export const SIZES = { rect: { w: 180, h: 110 }, image: { w: 220, h: 170 }, group: { w: 420, h: 300 } };

// Size of the last block resized by the user, per kind: new blocks of that kind reuse it.
const SIZE_KEY = 'bete2:lastSize';
const sizeOk = (v) => v && Number.isFinite(v.w) && Number.isFinite(v.h)
  ? { w: Math.min(LIMITS_SIZE, Math.max(20, v.w)), h: Math.min(LIMITS_SIZE, Math.max(20, v.h)) }
  : undefined;
const LIMITS_SIZE = 1e5;
const lastSize = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(SIZE_KEY) || '{}');
    return { rect: sizeOk(o.rect), image: sizeOk(o.image), group: sizeOk(o.group) };
  } catch { return {}; }
})();

export function rememberSize(kind, w, h) {
  lastSize[kind] = sizeOk({ w, h });
  try { localStorage.setItem(SIZE_KEY, JSON.stringify(lastSize)); }
  catch { /* storage blocked: the size is only kept for this session */ }
}

const KEY = 'bete2:doc';
const LIMITS = { pos: 1e6, size: 1e5, minSize: 20, text: 20000, maxNodes: 5000, dataUrl: 20e6 };

export const state = { camera: { x: 0, y: 0, zoom: 1 }, nodes: [] };
export const events = new EventTarget();
let selectedId = null;

export function newId() {
  if (globalThis.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const num = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

// Untrusted input (imported file): coerce every field, never trust types or sizes.
export function sanitizeNode(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const kind = raw.kind === 'image' ? 'image' : raw.kind === 'group' ? 'group' : 'rect';
  const size = SIZES[kind];
  const n = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 64) : newId(),
    kind,
    x: num(raw.x, -LIMITS.pos, LIMITS.pos, 0),
    y: num(raw.y, -LIMITS.pos, LIMITS.pos, 0),
    w: num(raw.w, LIMITS.minSize, LIMITS.size, size.w),
    h: num(raw.h, LIMITS.minSize, LIMITS.size, size.h),
    text: typeof raw.text === 'string' ? raw.text.slice(0, LIMITS.text) : '',
    color: /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : DEFAULT_COLOR,
  };
  if (kind === 'group' && typeof raw.shareId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(raw.shareId)) n.shareId = raw.shareId;
  if (typeof raw.image === 'string' && raw.image.length < LIMITS.dataUrl
      && (raw.image.startsWith('idb:') || raw.image.startsWith('data:image/'))) {
    n.image = raw.image;
  }
  if (typeof raw.link === 'string' && raw.link.length <= 2000 && /^https?:\/\//i.test(raw.link)) {
    n.link = raw.link;
  }
  // Amazon product details, typed by hand in the edit popup (shown in the label).
  for (const k of ['name', 'price', 'delivery']) {
    if (typeof raw[k] === 'string' && raw[k].trim()) n[k] = raw[k].trim().slice(0, 100);
  }
  return n;
}

let historyAdapter = null;
let pendingHistory = null;
export function registerHistory(adapter) {
  historyAdapter = adapter;
  adapter.load(pendingHistory);
  pendingHistory = null;
}

export function setDoc(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const c = o.camera && typeof o.camera === 'object' ? o.camera : {};
  state.camera = {
    x: num(c.x, -LIMITS.pos, LIMITS.pos, 0),
    y: num(c.y, -LIMITS.pos, LIMITS.pos, 0),
    zoom: num(c.zoom, 0.05, 8, 1),
  };
  state.nodes = (Array.isArray(o.nodes) ? o.nodes.slice(0, LIMITS.maxNodes) : [])
    .map(sanitizeNode)
    .filter(Boolean);
  selectedId = null;
  if (historyAdapter) historyAdapter.load(o.history);
  else pendingHistory = o.history;
  emit();
}

export function serialize() {
  return { app: 'bete2', version: 1, camera: state.camera, nodes: state.nodes,
    ...(historyAdapter ? { history: historyAdapter.save() } : {}) };
}

// Called after every local save: lets drive.js notice that the board's content changed.
const savedListeners = [];
export function onSaved(fn) { savedListeners.push(fn); }

export function saveNow() {
  try { localStorage.setItem(KEY, JSON.stringify(serialize())); }
  catch (err) { console.warn('bete2: save failed', err); }
  for (const fn of savedListeners) fn();
}

export function loadFromStorage() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) setDoc(JSON.parse(raw));
  } catch (err) { console.warn('bete2: load failed', err); }
}

let saveTimer = null;
// Every change goes through emit(): notifies the UI and schedules an autosave.
export function emit() {
  events.dispatchEvent(new Event('change'));
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 300);
}

export function getNode(id) { return state.nodes.find((n) => n.id === id) || null; }
export function getSelectedId() { return selectedId; }

export function select(id) {
  selectedId = id;
  emit();
}

export function addNode(kind, cx, cy) {
  const s = lastSize[kind] || SIZES[kind];
  const n = { id: newId(), kind, x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, text: '', color: DEFAULT_COLOR };
  state.nodes.push(n);
  selectedId = n.id;
  emit();
  return n;
}

// Replaces the blocks only (the camera stays): used by undo / redo. Untrusted-looking input is
// sanitized like any other, and the selection is dropped if its block is gone.
export function replaceNodes(list) {
  state.nodes = list.map(sanitizeNode).filter(Boolean);
  if (selectedId && !getNode(selectedId)) selectedId = null;
  emit();
}

export function removeNode(id) {
  const gone = getNode(id);
  if (gone) explode(gone.x, gone.y, gone.w, gone.h, gone.color); // deletion animation
  state.nodes = state.nodes.filter((n) => n.id !== id);
  if (selectedId === id) selectedId = null;
  emit();
}

// Groups from the biggest to the smallest: the biggest is drawn first (underneath) and hit
// last, so nested groups stay visible and clickable.
export function groupsBySize() {
  return state.nodes.filter((n) => n.kind === 'group').sort((a, b) => b.w * b.h - a.w * a.h);
}

// Blocks that move with a group: every other block whose centre lies inside it
// (smaller groups included, bigger or equal ones never).
let groupMemberFilter = () => true;
export function setGroupMemberFilter(filter) { groupMemberFilter = filter; }
export function membersOf(group) {
  const area = group.w * group.h;
  return state.nodes.filter((o) => {
    if (o === group) return false;
    if (!groupMemberFilter(group, o)) return false;
    if (o.kind === 'group' && o.w * o.h >= area) return false;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    return cx >= group.x && cx <= group.x + group.w && cy >= group.y && cy <= group.y + group.h;
  });
}

// Move a node to the top of the z-order (end of the array).
export function raise(id) {
  const i = state.nodes.findIndex((n) => n.id === id);
  if (i >= 0 && i < state.nodes.length - 1) state.nodes.push(state.nodes.splice(i, 1)[0]);
}
