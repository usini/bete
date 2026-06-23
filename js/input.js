// Entrées : souris/clavier, drag élastique, menu radial, palette, édition texte.
import {
  state, addRect, addCircle, removeById, scheduleSave, COLORS, findById,
} from './state.js';
import { screenToWorld, worldToScreen, zoomAt, panBy } from './camera.js';
import { dragTo, reset } from './physics.js';
import { exportJSON, importJSON } from './io.js';

let canvas;
let drag = null;        // { mode, id, offx, offy }
let lastPos = { x: 0, y: 0, t: 0 };
let editing = null;     // { type:'rect'|'circle', id }
let onChange = () => {};

const RESIZE_TOL = 12;  // tolérance (px écran) pour saisir le bord d'un cercle

export function init(boardCanvas, changeCb) {
  canvas = boardCanvas;
  onChange = changeCb || (() => {});

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', onDblClick);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  window.addEventListener('keydown', onKeyDown);

  // Drag & drop d'images.
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
  canvas.addEventListener('drop', onDrop);
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  document.getElementById('editor').addEventListener('blur', commitEdit);
}

// ---- Hit testing (du plus haut au plus bas) ----
function hitRect(w) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const n = state.nodes[i];
    if (w.x >= n.x && w.x <= n.x + n.w && w.y >= n.y && w.y <= n.y + n.h) return n;
  }
  return null;
}

function hitCircle(w) {
  const tol = RESIZE_TOL / state.camera.zoom;
  for (let i = state.circles.length - 1; i >= 0; i--) {
    const c = state.circles[i];
    const d = Math.hypot(w.x - c.x, w.y - c.y);
    if (Math.abs(d - c.r) <= tol) return { c, edge: true };
    if (d < c.r) return { c, edge: false };
  }
  return null;
}

// ---- Souris ----
function onMouseDown(e) {
  if (e.button === 1 || e.button === 2) return; // milieu/droit gérés ailleurs
  closeMenus();
  const w = screenToWorld(e.clientX, e.clientY);

  const r = hitRect(w);
  if (r) {
    state.selected = r.id;
    drag = { mode: 'rect', id: r.id, offx: w.x - r.x, offy: w.y - r.y };
    lastPos = { x: w.x, y: w.y, t: performance.now() };
    return;
  }

  const hc = hitCircle(w);
  if (hc) {
    state.selected = hc.c.id;
    drag = hc.edge
      ? { mode: 'resize', id: hc.c.id }
      : { mode: 'circle', id: hc.c.id, offx: w.x - hc.c.x, offy: w.y - hc.c.y };
    return;
  }

  // Fond : pan + désélection.
  state.selected = null;
  drag = { mode: 'pan', px: e.clientX, py: e.clientY };
}

function onMouseMove(e) {
  if (!drag) return;
  if (drag.mode === 'pan') {
    panBy(e.clientX - drag.px, e.clientY - drag.py);
    drag.px = e.clientX; drag.py = e.clientY;
    return;
  }
  const w = screenToWorld(e.clientX, e.clientY);

  if (drag.mode === 'rect') {
    const n = findById(drag.id);
    if (!n) return;
    const now = performance.now();
    const dt = Math.max(0.001, (now - lastPos.t) / 1000);
    dragTo(n, w.x - drag.offx, w.y - drag.offy, dt);
    lastPos = { x: w.x, y: w.y, t: now };
    scheduleSave();
  } else if (drag.mode === 'circle') {
    const c = findById(drag.id);
    if (!c) return;
    c.x = w.x - drag.offx; c.y = w.y - drag.offy;
    scheduleSave();
  } else if (drag.mode === 'resize') {
    const c = findById(drag.id);
    if (!c) return;
    c.r = Math.max(40, Math.hypot(w.x - c.x, w.y - c.y));
    scheduleSave();
  }
}

function onMouseUp() {
  if (drag) scheduleSave();
  drag = null;
}

function onWheel(e) {
  e.preventDefault();
  const factor = Math.exp(-e.deltaY * 0.0015);
  zoomAt(e.clientX, e.clientY, factor);
  scheduleSave();
}

// ---- Drop d'image ----
function onDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const w = screenToWorld(e.clientX, e.clientY);
  const target = hitRect(w);

  processImage(file, (src, ratio) => {
    if (target) {
      target.image = src;          // remplit le rectangle visé
      state.selected = target.id;
    } else {
      // Crée un rectangle au ratio de l'image.
      const MAX = 220;
      let nw = MAX, nh = MAX;
      if (ratio >= 1) nh = Math.round(MAX / ratio);
      else nw = Math.round(MAX * ratio);
      const n = addRect(w.x - nw / 2, w.y - nh / 2, '');
      n.w = nw; n.h = nh; n.image = src;
      reset(n);
      state.selected = n.id;
    }
    scheduleSave();
  });
}

// Redimensionne (max 800px) et ré-encode pour ménager le localStorage.
function processImage(file, cb) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const cw = Math.max(1, Math.round(img.naturalWidth * scale));
      const ch = Math.max(1, Math.round(img.naturalHeight * scale));
      const cv = document.createElement('canvas');
      cv.width = cw; cv.height = ch;
      cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
      const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      cb(cv.toDataURL(type, 0.85), img.naturalWidth / img.naturalHeight);
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function onDblClick(e) {
  const w = screenToWorld(e.clientX, e.clientY);
  const r = hitRect(w);
  if (r) { startEdit('rect', r); return; }
  const hc = hitCircle(w);
  if (hc) startEdit('circle', hc.c);
}

function onKeyDown(e) {
  if (editing) return;
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
    removeById(state.selected);
    scheduleSave();
    e.preventDefault();
  }
}

// ---- Menu radial ----
function onContextMenu(e) {
  e.preventDefault();
  closeMenus();
  const w = screenToWorld(e.clientX, e.clientY);
  const r = hitRect(w);
  const hc = !r ? hitCircle(w) : null;

  let items;
  if (r) {
    items = [{ label: 'Éditer', fn: () => startEdit('rect', r) }];
    if (r.image) items.push({ label: 'Img ✕', fn: () => { delete r.image; scheduleSave(); } });
    items.push({ label: 'Suppr', fn: () => { removeById(r.id); scheduleSave(); } });
  } else if (hc) {
    const c = hc.c;
    items = [
      { label: 'Couleur', fn: () => openPalette(e.clientX, e.clientY, c) },
      { label: 'Texte', fn: () => startEdit('circle', c) },
      { label: 'Suppr', fn: () => { removeById(c.id); scheduleSave(); } },
    ];
  } else {
    items = [
      { label: '+ Rect', fn: () => { const n = addRect(w.x - 75, w.y - 35); reset(n); state.selected = n.id; startEdit('rect', n); scheduleSave(); } },
      { label: '+ Cercle', fn: () => { const c = addCircle(w.x, w.y); state.selected = c.id; scheduleSave(); } },
      { label: 'Export', fn: () => exportJSON() },
      { label: 'Import', fn: () => importJSON(() => { onChange(); }) },
    ];
  }
  openRadial(e.clientX, e.clientY, items);
}

function openRadial(x, y, items) {
  const radial = document.getElementById('radial');
  radial.innerHTML = '';
  radial.style.left = x + 'px';
  radial.style.top = y + 'px';
  radial.classList.remove('hidden');

  const n = items.length;
  const radius = 78;
  const start = -Math.PI / 2; // premier item en haut
  items.forEach((it, i) => {
    const ang = start + (i / Math.max(n, 1)) * Math.PI * 2;
    const dx = Math.cos(ang) * radius;
    const dy = Math.sin(ang) * radius;
    const el = document.createElement('div');
    el.className = 'item';
    el.textContent = it.label;
    el.style.left = dx + 'px';
    el.style.top = dy + 'px';
    el.addEventListener('mousedown', (ev) => ev.stopPropagation());
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeMenus();
      it.fn();
    });
    radial.appendChild(el);
    // Déclenche l'animation de pop.
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('pop')));
  });

  // Fermeture au prochain clic ailleurs.
  setTimeout(() => document.addEventListener('mousedown', closeMenusOnce, { once: true }), 0);
}

// ---- Palette de couleurs ----
function openPalette(x, y, circle) {
  const pal = document.getElementById('palette');
  pal.innerHTML = '';
  pal.style.left = Math.min(x, window.innerWidth - 134) + 'px';
  pal.style.top = Math.min(y, window.innerHeight - 120) + 'px';
  pal.classList.remove('hidden');
  COLORS.forEach((col) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = col;
    sw.addEventListener('mousedown', (ev) => ev.stopPropagation());
    sw.addEventListener('click', (ev) => {
      ev.stopPropagation();
      circle.color = col;
      scheduleSave();
      closeMenus();
    });
    pal.appendChild(sw);
  });
  setTimeout(() => document.addEventListener('mousedown', closeMenusOnce, { once: true }), 0);
}

function closeMenusOnce() { closeMenus(); }
function closeMenus() {
  document.getElementById('radial').classList.add('hidden');
  document.getElementById('palette').classList.add('hidden');
  document.removeEventListener('mousedown', closeMenusOnce);
}

// ---- Édition de texte ----
function startEdit(type, target) {
  closeMenus();
  editing = { type, id: target.id };
  const ed = document.getElementById('editor');
  const z = state.camera.zoom;

  if (type === 'rect') {
    const p = worldToScreen(target.x, target.y);
    ed.style.left = p.x + 'px';
    ed.style.top = p.y + 'px';
    ed.style.width = (target.w * z) + 'px';
    ed.style.height = (target.h * z) + 'px';
    ed.value = target.text || '';
  } else {
    const p = worldToScreen(target.x, target.y - target.r);
    const wpx = 220;
    ed.style.left = (p.x - wpx / 2) + 'px';
    ed.style.top = p.y + 'px';
    ed.style.width = wpx + 'px';
    ed.style.height = '40px';
    ed.value = target.description || '';
  }
  ed.style.fontSize = Math.max(8, Math.min(18, 11 * z)) + 'px';
  ed.classList.add('show');
  ed.focus();
  ed.select();
}

function commitEdit() {
  if (!editing) return;
  const ed = document.getElementById('editor');
  const target = findById(editing.id);
  if (target) {
    if (editing.type === 'rect') target.text = ed.value;
    else target.description = ed.value.replace(/\n/g, ' ').trim();
    scheduleSave();
  }
  editing = null;
  ed.classList.remove('show');
}

// Échap pour valider/fermer l'éditeur.
window.addEventListener('keydown', (e) => {
  if (editing && e.key === 'Escape') {
    e.preventDefault();
    document.getElementById('editor').blur();
  }
});
