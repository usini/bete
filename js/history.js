// Undo / redo of the board's blocks, with a small browsable history.
//  - Only the blocks are tracked (not the camera): panning and zooming are never "actions".
//  - Nothing is instrumented: every local save (debounced 300 ms after the last change, so one
//    drag = one entry) is compared with the previous state, and a new entry is recorded when the
//    blocks differ. The label ("Déplacement", "Suppression d'un bloc"...) comes from that diff.
//  - Up to 60 states, persisted with the board and included in JSON exports.
import { state, onSaved, replaceNodes, sanitizeNode, registerHistory, saveNow } from './state.js?v=mw3slh1j';

import { isLocked, modeEvents } from './mobile-mode.js?v=mw3slh1j';

const MAX = 60;
let states = []; // { json, norm, label, t } — oldest first
let pos = 0;     // index of the state currently shown

const $ = (id) => document.getElementById(id);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
// Order-insensitive signature: bringing a block to the front is not an action worth undoing.
const normOf = (nodes) => JSON.stringify([...nodes].sort(byId));

// Records the board as a new history entry if its blocks differ from the current entry.
function commit() {
  if (!states.length) return;
  const cur = states[pos];
  const json = JSON.stringify(state.nodes);
  const norm = normOf(state.nodes);
  if (norm === cur.norm) { cur.json = json; return; } // same blocks (maybe a new z-order)
  states.length = pos + 1;                            // a new action drops the "redo" branch
  states.push({ json, norm, label: describe(cur.json, json), t: Date.now() });
  if (states.length > MAX) states.shift();
  pos = states.length - 1;
  refreshUi();
}

// Shows entry i. Only called right after commit(), so nothing is lost.
function go(i) {
  if (isLocked() || i < 0 || i >= states.length || i === pos) return;
  pos = i;
  replaceNodes(JSON.parse(states[pos].json));
  refreshUi();
}

export function undo() { commit(); go(pos - 1); }
export function redo() { commit(); go(pos + 1); }

// Human label of what changed between two snapshots.
function describe(prevJson, nextJson) {
  const prev = new Map(JSON.parse(prevJson).map((n) => [n.id, n]));
  const next = new Map(JSON.parse(nextJson).map((n) => [n.id, n]));
  const added = [...next.keys()].filter((id) => !prev.has(id));
  const removed = [...prev.keys()].filter((id) => !next.has(id));
  const changed = [...next.keys()].filter((id) => prev.has(id)
    && JSON.stringify(prev.get(id)) !== JSON.stringify(next.get(id)));
  if (added.length && removed.length) return 'Tableau remplacé';
  if (added.length && !changed.length) return added.length === 1 ? "Ajout d'un bloc" : `Ajout de ${added.length} blocs`;
  if (removed.length && !changed.length) return removed.length === 1 ? "Suppression d'un bloc" : `Suppression de ${removed.length} blocs`;
  if (!changed.length) return 'Modification';

  const kinds = new Set();
  for (const id of changed) {
    const a = prev.get(id), b = next.get(id);
    const differs = (keys) => keys.some((k) => a[k] !== b[k]);
    if (differs(['x', 'y'])) kinds.add('move');
    if (differs(['w', 'h'])) kinds.add('resize');
    if (differs(['text'])) kinds.add('text');
    if (differs(['color'])) kinds.add('color');
    if (differs(['image'])) kinds.add('image');
    if (differs(['link', 'name', 'price', 'delivery'])) kinds.add('link');
  }
  const n = changed.length;
  if (kinds.size === 1) {
    const labels = {
      move: ['Déplacement', `Déplacement de ${n} blocs`],
      resize: ['Redimensionnement', `Redimensionnement de ${n} blocs`],
      text: ['Texte modifié', `Texte modifié sur ${n} blocs`],
      color: ['Couleur modifiée', `Couleur modifiée sur ${n} blocs`],
      image: ['Image modifiée', `Image modifiée sur ${n} blocs`],
      link: ['Lien modifié', `Lien modifié sur ${n} blocs`],
    };
    return labels[[...kinds][0]][n > 1 ? 1 : 0];
  }
  return n > 1 ? `${n} blocs modifiés` : 'Bloc modifié';
}

// ---- toolbar (top-left) ----
function refreshUi() {
  $('undo-btn').disabled = isLocked() || pos === 0;
  $('redo-btn').disabled = isLocked() || pos === states.length - 1;
  if (!$('history-list').hidden) renderList();
}

function renderList() {
  const list = $('history-list');
  list.replaceChildren();
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'history-item history-clear';
  clear.textContent = 'Vider l’historique';
  clear.disabled = isLocked() || states.length <= 1;
  clear.addEventListener('click', () => {
    if (isLocked() || !confirm('Vider tout l’historique ? Le tableau actuel sera conservé, mais les anciennes actions ne pourront plus être rétablies.')) return;
    clearHistory();
  });
  list.append(clear);
  for (let i = states.length - 1; i >= 0; i--) { // newest first
    const s = states[i];
    const b = document.createElement('button');
    b.type = 'button';
    b.disabled = isLocked();
    b.className = 'history-item' + (i === pos ? ' current' : i > pos ? ' future' : '');
    const label = document.createElement('span');
    label.textContent = s.label;
    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = new Date(s.t).toLocaleTimeString('fr-FR');
    b.append(label, time);
    b.addEventListener('click', () => { commit(); go(i); });
    list.append(b);
  }
}

export function clearHistory() {
  if (isLocked()) return;
  // A single current state is already an empty undo history: keep its timestamp stable.
  if (states.length === 1 && pos === 0 && states[0].norm === normOf(state.nodes)) return;
  states = [{ json: JSON.stringify(state.nodes), norm: normOf(state.nodes), label: 'Historique vidé', t: Date.now() }];
  pos = 0;
  refreshUi();
  saveNow();
}

function restoreHistory(raw) {
  const entries = Array.isArray(raw?.states) ? raw.states.slice(0, MAX) : [];
  states = entries.filter(s => s && Array.isArray(s.nodes)).map(s => {
    const nodes = s.nodes.slice(0, 5000).map(sanitizeNode).filter(Boolean);
    return { json: JSON.stringify(nodes), norm: normOf(nodes),
      label: typeof s.label === 'string' ? s.label.slice(0, 200) : 'Modification',
      t: Number.isFinite(s.t) ? s.t : Date.now() };
  });
  pos = Number.isInteger(raw?.pos) ? Math.max(0, Math.min(states.length - 1, raw.pos)) : states.length - 1;
  if (!states.length || states[pos].norm !== normOf(state.nodes)) {
    states = [{ json: JSON.stringify(state.nodes), norm: normOf(state.nodes), label: 'État initial', t: Date.now() }];
    pos = 0;
  }
  refreshUi();
}

function serializeHistory() {
  commit();
  return { pos, states: states.map(s => ({ nodes: JSON.parse(s.json), label: s.label, t: s.t })) };
}

export function initHistory() {
  modeEvents.addEventListener('change', refreshUi);
  registerHistory({ load: restoreHistory, save: serializeHistory });
  onSaved(commit);

  $('undo-btn').addEventListener('click', undo);
  $('redo-btn').addEventListener('click', redo);
  $('history-btn').addEventListener('click', () => {
    const list = $('history-list');
    list.hidden = !list.hidden;
    if (!list.hidden) { commit(); renderList(); }
  });
  // A press outside the toolbar closes the list.
  document.addEventListener('pointerdown', (e) => {
    if ($('history-list').hidden) return;
    if (e.target instanceof Element && e.target.closest('#history-bar')) return;
    $('history-list').hidden = true;
  });
  refreshUi();
}
