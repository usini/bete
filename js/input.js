// Pointer, wheel, keyboard, paste and drop handling for the canvas.
//  - click on a label: edit popup, link field first (YouTube labels open the video instead)
//  - double-click on a block: play it (YouTube), open its link, pick an image (image block), or edit its text
//  - click on the 📝 button of a selected block: edit popup (text and link)
//  - click on the 🖼️ button of a selected image block: change its picture
import { state, getNode, getSelectedId, select, addNode, removeNode, raise, emit, rememberSize, groupsBySize, membersOf, COLORS } from './state.js?v=mvzo1n5i';
import { screenToWorld, worldToScreen, zoomAt, panBy, view, cancelFlight } from './camera.js?v=mvzo1n5i';
import { startEdit, stopEdit, isEditing } from './editor.js?v=mvzo1n5i';
import { addImageFile } from './images.js?v=mvzo1n5i';
import { playVideo } from './video.js?v=mvzo1n5i';
import { youTubeId } from './yt.js?v=mvzo1n5i';
import { snapMove, snapResize, clearGuides } from './snap.js?v=mvzo1n5i';
import { labelHit, labelInfo, actionHit, linkOf } from './labels.js?v=mvzo1n5i';
import { undo, redo } from './history.js?v=mvzo1n5i';

import { setDragging } from './motion.js?v=mvzo1n5i';

import { plainLink, genericLink, droppedLink, droppedTitle } from './links.js?v=mvzo1n5i';
import { shortenAmazonText } from './amazon.js?v=mvzo1n5i';

import { isLocked, modeEvents } from './mobile-mode.js?v=mvzo1n5i';

import { serviceForNode } from './services.js?v=mvzo1n5i';

export const BLOCK_MIME = 'application/x-bete-block';

const canvas = document.getElementById('canvas');
const picker = document.getElementById('filepick');
const HANDLE_PX = 12;  // screen tolerance of the resize handle
const MOVE_PX = 5;     // below this, a press is a click
const MIN_SIZE = 20, MAX_SIZE = 1e5;

const pointers = new Map(); // pointerId -> { x, y } (screen)
let gesture = null;         // { type: 'pan' | 'move' | 'resize' | 'pinch', ... }
let pickTarget = null;
let lastTap = { t: 0, x: 0, y: 0 }; // previous touch tap on a block, for the double-tap

// A double-click presses a button twice: ignore a repeat of the same action within 600 ms.
let lastAct = { key: '', t: 0 };
function once(key) {
  const now = performance.now();
  if (lastAct.key === key && now - lastAct.t < 600) return false;
  lastAct = { key, t: now };
  return true;
}

const clamp = (v) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, v));

const inside = (n, w) => w.x >= n.x && w.x <= n.x + n.w && w.y >= n.y && w.y <= n.y + n.h;

// Topmost block under the world point w. Groups lie under every other block: they are only
// hit where no block is, the smallest (innermost) group first.
function nodeAt(w) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const n = state.nodes[i];
    if (n.kind !== 'group' && inside(n, w)) return n;
  }
  const groups = groupsBySize();
  for (let i = groups.length - 1; i >= 0; i--) {
    if (inside(groups[i], w)) return groups[i];
  }
  return null;
}

function onHandle(n, sx, sy) {
  const p = worldToScreen(n.x + n.w, n.y + n.h);
  return Math.abs(p.x - sx) <= HANDLE_PX && Math.abs(p.y - sy) <= HANDLE_PX;
}

function pinchStart() {
  if (gesture?.type === 'move') setDragging(gesture.n, false);
  const [a, b] = [...pointers.values()];
  return { type: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
}

function pickColor(n, x, y) {
  if (isLocked()) return;
  const palette = document.getElementById('color-palette');
  const id = n.id;
  const names = ['Vert', 'Bleu', 'Rose', 'Orange', 'Violet', 'Jaune', 'Blanc', 'Rouge', 'Transparent'];
  palette.replaceChildren(...COLORS.map((color, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.style.background = color;
    if (color === 'transparent') button.classList.add('transparent-swatch');
    button.title = names[i];
    button.setAttribute('aria-label', names[i]);
    button.setAttribute('aria-pressed', String(n.color.toLowerCase() === color.toLowerCase()));
    button.addEventListener('click', () => {
      const target = getNode(id);
      if (target && !isLocked()) { target.color = color; emit(); }
      palette.hidePopover();
    });
    return button;
  }));
  palette.showPopover();
  const box = palette.getBoundingClientRect();
  palette.style.left = Math.max(8, Math.min(x + 8, window.innerWidth - box.width - 8)) + 'px';
  palette.style.top = Math.max(8, Math.min(y + 8, window.innerHeight - box.height - 8)) + 'px';
}

function onPointerDown(e) {
  // Stops the browser from moving focus after this press (it would close the editors).
  e.preventDefault();
  cancelFlight();
  if (isEditing()) stopEdit(true);
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) { gesture = pinchStart(); return; }
  if (pointers.size > 2) return;

  const sx = e.clientX, sy = e.clientY;
  const sel = getNode(getSelectedId());
  if (isLocked()) {
    gesture = { type: 'pan', sx, sy, moved: false, readNode: true };
    return;
  }
  if (sel && onHandle(sel, sx, sy)) {
    gesture = { type: 'resize', n: sel, ox: sel.w, oy: sel.h, sx, sy };
    return;
  }
  const w = screenToWorld(sx, sy);
  const action = sel ? actionHit(sel, w, state.camera.zoom) : null;
  if (action) {
    gesture = null;
    if (once(action)) {
      if (action === 'delete') {
        pointers.delete(e.pointerId);
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
        confirmDelete(sel.id);
        lastAct.t = performance.now();
      }
      else if (action === 'image') pickImage(sel); // 🖼️: change the picture
      else if (action === 'color') pickColor(sel, sx, sy);
      else if (action === 'share') document.dispatchEvent(new CustomEvent('bete-share-group', { detail: sel.id }));
      else startEdit(sel.id);                 // 📝: edit popup (text and link)
    }
    return;
  }
  const labelled = labelHit(w);
  if (labelled) { labelDown(labelled); return; }

  const n = nodeAt(w);
  if (!n) {
    select(null);
    gesture = { type: 'pan' };
    return;
  }
  const wasSelected = getSelectedId() === n.id;
  select(n.id);
  if (n.kind !== 'group') raise(n.id); // groups keep their place: they always lie underneath
  // Moving a group carries along the blocks inside it.
  const members = n.kind === 'group' ? membersOf(n).map((m) => ({ m, ox: m.x, oy: m.y })) : null;
  if (n.kind !== 'group') setDragging(n, true);
  gesture = { type: 'move', n, ox: n.x, oy: n.y, sx, sy, moved: false, wasSelected, members };
}

// Click on a label: edits the link. On a YouTube block the label opens the video instead.
function labelDown(n) {
  select(n.id);
  gesture = null;
  const info = labelInfo(n);
  if (info.kind === 'yt') {
    if (once('label')) window.open(info.href, '_blank', 'noopener');
  } else {
    startEdit(n.id, 'link');
  }
}

// Double-click on a block (native 'dblclick' event: the browser counts the clicks, pointer
// events cannot). It does the most useful thing for the block: play a YouTube video, open the
// link if there is one, pick an image for an image block (empty or not), else edit the text.
function onDoubleClick(e) { doubleAt(e.clientX, e.clientY); }

// Shared by the mouse 'dblclick' event and the touch double-tap (see onPointerEnd). A browser
// may fire both for one double-tap: once() lets only the first one through.
function doubleAt(x, y) {
  if (lastAct.key === 'delete' && performance.now() - lastAct.t < 600) return;
  if (!once('dbl')) return;
  const w = screenToWorld(x, y);
  if (isLocked()) {
    const readable = labelHit(w) || nodeAt(w);
    if (readable && serviceForNode(readable) && linkOf(readable)) window.open(linkOf(readable), '_blank', 'noopener');
    else if (readable && youTubeId(readable.text)) playVideo(readable);
    else if (readable && linkOf(readable)) window.open(linkOf(readable), '_blank', 'noopener');
    return;
  }
  if (labelHit(w)) return;
  const selected = getNode(getSelectedId());
  if (selected && actionHit(selected, w, state.camera.zoom)) return;
  const n = nodeAt(w);
  if (!n) { addNode('rect', w.x, w.y); return; }
  if (serviceForNode(n) && linkOf(n)) window.open(linkOf(n), '_blank', 'noopener');
  else if (n.kind === 'group') startEdit(n.id);                               // group: edit its title
  else if (youTubeId(n.text)) playVideo(n);                              // YouTube: play
  else if (linkOf(n)) window.open(linkOf(n), '_blank', 'noopener');      // has a link: open it
  else if (n.kind === 'image') { if (once('pick')) pickImage(n); }       // image: (re)upload
  else startEdit(n.id);                                                  // text: edit
}

function onPointerMove(e) {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  const g = gesture;
  if (!g) return;

  if (g.type === 'pinch') {
    if (pointers.size !== 2) return;
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (g.d > 0 && d > 0) zoomAt(mx, my, d / g.d);
    panBy(mx - g.mx, my - g.my);
    g.d = d; g.mx = mx; g.my = my;
  } else if (g.type === 'pan') {
    if (g.readNode && Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > MOVE_PX) g.moved = true;
    panBy(dx, dy);
  } else if (g.type === 'move') {
    const z = state.camera.zoom;
    const skip = g.members ? new Set(g.members.map((o) => o.m)) : undefined;
    const pos = snapMove(g.n, g.ox + (e.clientX - g.sx) / z, g.oy + (e.clientY - g.sy) / z, skip);
    g.n.x = pos.x;
    g.n.y = pos.y;
    if (g.members) {
      for (const o of g.members) {
        o.m.x = o.ox + (pos.x - g.ox);
        o.m.y = o.oy + (pos.y - g.oy);
      }
    }
    if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) > MOVE_PX) g.moved = true;
  } else if (g.type === 'resize') {
    const z = state.camera.zoom;
    const size = snapResize(g.n, clamp(g.ox + (e.clientX - g.sx) / z), clamp(g.oy + (e.clientY - g.sy) / z));
    g.n.w = size.w;
    g.n.h = size.h;
  }
  emit();
}

function onPointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  clearGuides();
  const g = gesture;
  if (g?.type === 'move') setDragging(g.n, false);
  if (g && g.type === 'resize') rememberSize(g.n.kind, g.n.w, g.n.h);
  if (g && ((g.type === 'move' && g.moved) || g.type === 'resize')) {
    document.dispatchEvent(new CustomEvent('bete-node-moved', { detail: g.n.id }));
  }
  // Touch: a phone does not reliably send 'dblclick', so a double-tap on a block (two taps,
  // 400 ms and 30 px apart, without dragging) is detected here.
  if (e.pointerType === 'touch' && g && (g.type === 'move' || (g.type === 'pan' && g.readNode)) && !g.moved) {
    const now = performance.now();
    if (now - lastTap.t < 400 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
      lastTap = { t: 0, x: 0, y: 0 };
      doubleAt(e.clientX, e.clientY);
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
  }
  // A plain click on an already-selected, still empty image block: pick its image.
  if (g && g.type === 'move' && !g.moved && g.wasSelected && g.n.kind === 'image' && !g.n.image) {
    if (once('pick')) pickImage(g.n); // 'once': a double-click would otherwise open the picker twice
  }
  if (pointers.size === 0 || (g && g.type === 'pinch')) gesture = null;
  emit();
}

export function pickImage(n) {
  if (isLocked()) return;
  pickTarget = n.id;
  picker.value = '';
  picker.click();
}

async function imageToNode(file, n) {
  const ref = await addImageFile(file);
  if (isLocked()) return;
  n.image = ref;
  emit();
}

function confirmDelete(id) {
  if (isLocked()) return;
  const n = getNode(id);
  if (!n) return;
  const message = n.kind === 'group' ? 'Supprimer ce groupe ? Les blocs qu’il contient seront conservés.' : 'Supprimer ce bloc ?';
  if (confirm(message)) removeNode(id);
}

export function initInput() {
  modeEvents.addEventListener('change', () => {
    if (gesture?.type === 'move') setDragging(gesture.n, false);
    pointers.clear(); gesture = null; clearGuides();
    const palette = document.getElementById('color-palette');
    if (palette.matches(':popover-open')) palette.hidePopover();
    if (isLocked() && isEditing()) stopEdit(false);
    emit();
  });
  const palette = document.getElementById('color-palette');
  // Opening on canvas pointerdown must survive the same pointer's release outside the popup.
  // Capture dismisses an old palette before the canvas can open a new one.
  document.addEventListener('pointerdown', (e) => {
    if (palette.matches(':popover-open') && !palette.contains(e.target)) palette.hidePopover();
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && palette.matches(':popover-open')) {
      palette.hidePopover();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerEnd);
  canvas.addEventListener('pointercancel', onPointerEnd);
  canvas.addEventListener('dblclick', onDoubleClick);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelFlight();
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
    emit();
  }, { passive: false });

  canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = isLocked() ? 'none' : 'copy';
  });
  canvas.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (isLocked()) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      await imageToNode(file, addNode('image', w.x, w.y));
      return;
    }
    const kind = e.dataTransfer.getData(BLOCK_MIME);
    if (kind === 'rect' || kind === 'image' || kind === 'group') {
      addNode(kind, w.x, w.y); return;
    }
    const url = droppedLink(e.dataTransfer);
    if (url) {
      const n = addNode('rect', w.x, w.y);
      if (genericLink(url)) { n.link = url; n.text = droppedTitle(e.dataTransfer, url); }
      else n.text = shortenAmazonText(url);
      emit();
    }
  });

  window.addEventListener('paste', async (e) => {
    if (isLocked() || isEditing()) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable], dialog')) return;
    const selected = getNode(getSelectedId());
    const pasted = e.clipboardData?.getData('text/plain');
    const url = plainLink(pasted);
    if (selected?.kind === 'rect' && url) {
      e.preventDefault();
      if (genericLink(url)) {
        if (plainLink(selected.text)) selected.text = '';
        selected.link = url;
      } else {
        selected.text = shortenAmazonText(url);
        delete selected.link;
      }
      emit(); return;
    }
    const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    const c = screenToWorld(view.w / 2, view.h / 2);
    await imageToNode(file, addNode('image', c.x, c.y));
  });

  window.addEventListener('keydown', (e) => {
    if (isLocked() || isEditing()) return;
    // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes the board. Not inside a text field
    // (it keeps its own undo), nor while a popup is open.
    const inField = e.target instanceof Element && e.target.closest('input, textarea');
    if (!inField && (e.ctrlKey || e.metaKey) && !e.altKey && !document.querySelector('dialog[open]')) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
    }
    if (e.target instanceof Element && e.target.closest('input, textarea, button')) return;
    const id = getSelectedId();
    if (e.key === 'Escape') select(null);
    else if (id && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); removeNode(id); }
    else if (id && e.key === 'Enter') startEdit(id);
  });

  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    const n = getNode(pickTarget);
    if (file && n) await imageToNode(file, n);
  });
}
