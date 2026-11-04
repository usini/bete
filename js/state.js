import { externalMode } from './external-board.js?v=mw2oi5mc';
import { localStore } from './local-store.js?v=mw2oi5mc';
// Data model, sanitizers and local autosave (IndexedDB).
// Image bytes are NOT stored here: a node only keeps a reference ('idb:<id>').
import { explode } from './fx.js?v=mw2oi5mc';

export const COLORS = ['#39ff14', '#00b7eb', '#e3008c', '#ff8c00', '#9b30ff', '#ffd400', '#f2f2f2', '#ff3030', 'transparent'];
export const DEFAULT_COLOR = COLORS[1];
const COLOR_KEY = 'bete2:lastColor';
const savedColor = localStore.getItem(COLOR_KEY);
let lastColor = COLORS.includes(savedColor) ? savedColor : DEFAULT_COLOR;

export function rememberColor(color) {
  lastColor = color;
  localStore.setItem(COLOR_KEY, color);
}
export const SIZES = { rect: { w: 180, h: 110 }, image: { w: 220, h: 170 }, group: { w: 420, h: 300 } };

// Size of the last block resized by the user, per kind: new blocks of that kind reuse it.
const SIZE_KEY = 'bete2:lastSize';
const sizeOk = (v) => v && Number.isFinite(v.w) && Number.isFinite(v.h)
  ? { w: Math.min(LIMITS_SIZE, Math.max(20, v.w)), h: Math.min(LIMITS_SIZE, Math.max(20, v.h)) }
  : undefined;
const LIMITS_SIZE = 1e5;
const lastSize = (() => {
  try {
    const o = JSON.parse(localStore.getItem(SIZE_KEY) || '{}');
    return { rect: sizeOk(o.rect), image: sizeOk(o.image), group: sizeOk(o.group) };
  } catch { return {}; }
})();

export function rememberSize(kind, w, h) {
  lastSize[kind] = sizeOk({ w, h });
  try { localStore.setItem(SIZE_KEY, JSON.stringify(lastSize)); }
  catch { /* storage blocked: the size is only kept for this session */ }
}

const KEY = 'bete2:doc';
const LIMITS = { pos: 1e6, size: 1e5, minSize: 20, text: 20000, maxNodes: 5000, dataUrl: 20e6 };

// Keep camera transforms numerically stable even far below normal viewing scales.
export const MIN_ZOOM = 1e-9;
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
    color: raw.color === 'transparent' ? 'transparent' : /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : DEFAULT_COLOR,
  };
  if (kind !== 'group' && raw.hideLinkLabel === true) n.hideLinkLabel = true;
  if (kind === 'group' && typeof raw.shareId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(raw.shareId)) n.shareId = raw.shareId;
  if (typeof raw.image === 'string' && raw.image.length < LIMITS.dataUrl
      && (raw.image.startsWith('idb:') || raw.image.startsWith('data:image/'))) {
    n.image = raw.image;
    if (raw.keepImageOriginal === true) n.keepImageOriginal = true;
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
    zoom: num(c.zoom, MIN_ZOOM, 8, 1),
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
  if (externalMode) return;
  clearTimeout(saveTimer);
  let saved;
  try { saved = localStore.setItem(KEY, JSON.stringify(serialize())); }
  catch (err) { console.warn('bete2: save failed', err); }
  for (const fn of savedListeners) fn();
  return saved;
}

export function loadFromStorage() {
  try {
    const raw = localStore.getItem(KEY);
    if (raw) setDoc(JSON.parse(raw));
  } catch (err) { console.warn('bete2: load failed', err); }
}

let saveTimer = null;
// Every change goes through emit(): notifies the UI and schedules an autosave.
export function emit() {
  events.dispatchEvent(new Event('change'));
  if (externalMode) return;
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
  const n = { id: newId(), kind, x: cx - s.w / 2, y: cy - s.h / 2, w: s.w, h: s.h, text: '', color: lastColor };
  state.nodes.push(n);
  fitGroupsAround(n);
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
  const groups = gone ? containingGroups(gone) : [];
  if (gone) explode(gone.x, gone.y, gone.w, gone.h, gone.color); // deletion animation
  state.nodes = state.nodes.filter((n) => n.id !== id);
  fitGroupsAround(null, groups);
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
let protectGroupFit = () => {};
export function setGroupMemberFilter(filter, protectFit = () => {}) {
  groupMemberFilter = filter;
  protectGroupFit = protectFit;
}

const GROUP_HEADER_MIN = 64, GROUP_HEADER_MAX = 220, GROUP_HEADER_RATIO = 0.22;
const GROUP_MIN_PADDING = 28, GROUP_PADDING_RATIO = 0.10;
const headerForHeight = height => Math.min(GROUP_HEADER_MAX, Math.max(GROUP_HEADER_MIN, height * GROUP_HEADER_RATIO));
export const groupHeaderHeight = group => Math.min(group.h, headerForHeight(group.h));

function insideGroup(group, node) {
  if (node === group || (node.kind === 'group' && node.w * node.h >= group.w * group.h)) return false;
  const x = node.x + node.w / 2, y = node.y + node.h / 2;
  return x >= group.x && x <= group.x + group.w && y >= group.y && y <= group.y + group.h;
}
const isMember = (group, node) => insideGroup(group, node) && groupMemberFilter(group, node);

export function membersOf(group) {
  return state.nodes.filter(node => isMember(group, node));
}

export function containingGroups(node) {
  return state.nodes.filter(group => group.kind === 'group' && isMember(group, node));
}

// Fit the affected frames after the gesture, keeping their contents in world coordinates.
export function fitGroupsAround(node, previous = [], keepMembership = false) {
  const affected = new Set([...previous, ...(node ? containingGroups(node) : [])]);
  const fittedChildren = new Map();
  for (const group of groupsBySize().reverse()) {
    if (!affected.has(group)) continue;
    const members = new Set([...membersOf(group), ...(fittedChildren.get(group) || [])]);
    if (keepMembership && previous.includes(group)) members.add(node);
    if (!members.size) continue; // Keep an empty frame available for the next drop.
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const member of members) {
      left = Math.min(left, member.x);
      right = Math.max(right, member.x + member.w);
      top = Math.min(top, member.y);
      bottom = Math.max(bottom, member.y + member.h);
    }
    const width = right - left, height = bottom - top;
    const padX = Math.max(GROUP_MIN_PADDING, width * GROUP_PADDING_RATIO);
    const padY = Math.max(GROUP_MIN_PADDING, height * GROUP_PADDING_RATIO);
    const bodyHeight = height + 2 * padY;
    const header = headerForHeight(bodyHeight / (1 - GROUP_HEADER_RATIO));
    const bounds = {
      x: left - padX, y: top - padY - header,
      w: width + 2 * padX, h: bodyHeight + header,
    };
    if (bounds.w > LIMITS.size || bounds.h > LIMITS.size) continue;
    for (const parent of containingGroups(group)) {
      affected.add(parent);
      if (!fittedChildren.has(parent)) fittedChildren.set(parent, []);
      fittedChildren.get(parent).push(group);
    }
    protectGroupFit(group, state.nodes.filter(other => other !== group && !members.has(other) && insideGroup(bounds, other)));
    Object.assign(group, bounds);
  }
}

// Move a node to the top of the z-order (end of the array).
export function raise(id) {
  const i = state.nodes.findIndex((n) => n.id === id);
  if (i >= 0 && i < state.nodes.length - 1) state.nodes.push(state.nodes.splice(i, 1)[0]);
}
