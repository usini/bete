// Entrées : souris + tactile, drag élastique, liens hexagone, menu radial,
// palette, édition texte, popup image.
import {
  state, addRect, addCircle, addHexagon, removeById, scheduleSave, COLORS,
  findById, newId, sourceOf, displayImage, displayLink, displayText, getBoardId,
} from './state.js?v=mqum8g73';
import { screenToWorld, worldToScreen, zoomAt, panBy } from './camera.js?v=mqum8g73';
import { dragTo, reset } from './physics.js?v=mqum8g73';
import { exportJSON, importJSON } from './io.js?v=mqum8g73';
import { pointInHex } from './geom.js?v=mqum8g73';
import { startHost, stopHost, refreshHostId, pushMove, pushDelete, isClient, hostId, buildUrl, loadQR } from './sync.js?v=mqum8g73';
import { explodeElementCascade } from './fx.js?v=mqum8g73';
import { genBoardId, listBoards, buildBoardUrl, recordBoard, parseBoardUrl } from './boards.js?v=mqum8g73';

let canvas;
let drag = null;        // { mode, id, offx, offy, startX, startY }
let lastPos = { x: 0, y: 0, t: 0 };
let editing = null;     // { type, id }
let onChange = () => {};
let clipboard = null;   // { isCircle?, isHex?, isLink?, data }
let lastMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// Tactile.
let pinch = null;
let longPressTimer = null;
let lastTap = 0;
let lastTapPos = null;

// Mode tactile : sur mobile, l'interaction est désactivée par défaut (on ne peut
// que naviguer : pan/zoom) pour éviter de déplacer des blocs par accident.
const isCoarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
let interactionEnabled = !isCoarse;

function updateHint() {
  const h = document.getElementById('hint');
  if (!h || !isCoarse) return;
  h.textContent = interactionEnabled ? 'INTERACTION ON · APPUI LONG = MENU' : 'VUE SEULE · APPUI LONG POUR ACTIVER';
}

const RESIZE_TOL = 12;  // tolérance (px écran) pour saisir le bord d'une zone

// ---- Menu radial : couleurs + icônes SVG (viewBox 0 0 24 24) ----
const COL = {
  green: '#39ff14', wood: '#b9772e', cyan: '#00b7eb', orange: '#ff8c00',
  magenta: '#e3008c', purple: '#9b30ff', yellow: '#ffd400', white: '#f2f2f2', red: '#fe4365',
};
const ICONS = {
  rect: '<rect x="3.5" y="6.5" width="17" height="11" rx="1.5"/>',
  pancarte: '<rect x="4" y="5" width="16" height="10" rx="1.5"/><line x1="12" y1="15" x2="12" y2="21"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  hexa: '<polygon points="12,3.2 19.5,7.6 19.5,16.4 12,20.8 4.5,16.4 4.5,7.6"/>',
  share: '<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><line x1="8" y1="11" x2="16" y2="7"/><line x1="8" y1="13" x2="16" y2="17"/>',
  export: '<line x1="12" y1="3" x2="12" y2="15"/><polyline points="7,10 12,15 17,10"/><line x1="4" y1="20" x2="20" y2="20"/>',
  import: '<line x1="12" y1="16" x2="12" y2="4"/><polyline points="7,9 12,4 17,9"/><line x1="4" y1="20" x2="20" y2="20"/>',
  edit: '<path d="M14.5 5.5l4 4"/><path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  text: '<line x1="5" y1="5" x2="19" y2="5"/><line x1="12" y1="5" x2="12" y2="20"/>',
  color: '<path d="M12 3C12 3 5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12z"/>',
  link: '<path d="M14 4h6v6"/><line x1="20" y1="4" x2="10" y2="14"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  eye: '<path d="M2.5 12C5.5 6.5 18.5 6.5 21.5 12C18.5 17.5 5.5 17.5 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
  trash: '<line x1="4" y1="7" x2="20" y2="7"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l1 12.5h9l1-12.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M4 16V4h12"/>',
  refresh: '<path d="M4 12a8 8 0 0 1 13.7-5.7M20 4v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.7M4 20v-4h4"/>',
  imgx: '<rect x="3.5" y="5" width="17" height="14" rx="1.5"/><line x1="3" y1="3" x2="21" y2="21"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  close: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  board: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M14 4h6v6"/><line x1="20" y1="4" x2="13" y2="11"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
};
let pendingBoardPos = null; // position monde où poser le prochain lien-board
function svgEl(key) { return '<svg viewBox="0 0 24 24">' + (ICONS[key] || ICONS.dot) + '</svg>'; }

export function init(boardCanvas, changeCb) {
  canvas = boardCanvas;
  onChange = changeCb || (() => {});

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousemove', (e) => { lastMouse.x = e.clientX; lastMouse.y = e.clientY; });
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('dblclick', (e) => handleDouble(e.clientX, e.clientY));
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); openContextAt(e.clientX, e.clientY); });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('paste', onPaste);

  // Tactile.
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });

  // Drag & drop d'images.
  canvas.addEventListener('dragover', (e) => { e.preventDefault(); });
  canvas.addEventListener('drop', onDrop);
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());

  document.getElementById('editor').addEventListener('blur', commitEdit);

  // Bouton "OK" pour valider/fermer l'édition (sortie fiable au tactile).
  const done = document.getElementById('editDone');
  done.addEventListener('mousedown', (e) => { e.preventDefault(); commitEdit(); });
  done.addEventListener('touchstart', (e) => { e.preventDefault(); commitEdit(); });

  // Fermeture de la popup image.
  const pop = document.getElementById('imgpopup');
  pop.addEventListener('mousedown', closeImagePopup);
  pop.addEventListener('touchstart', (e) => { e.preventDefault(); closeImagePopup(); });

  // Le sélecteur de board ne se ferme pas quand on clique dedans.
  const bp = document.getElementById('boardpicker');
  bp.addEventListener('mousedown', (e) => e.stopPropagation());
  bp.addEventListener('touchstart', (e) => e.stopPropagation());

  updateHint();
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

function hitHexagon(w) {
  const tol = RESIZE_TOL / state.camera.zoom;
  for (let i = state.hexagons.length - 1; i >= 0; i--) {
    const h = state.hexagons[i];
    if (pointInHex(w.x, w.y, h.x, h.y, h.r + tol)) {
      const edge = !pointInHex(w.x, w.y, h.x, h.y, h.r - tol);
      return { c: h, edge };
    }
  }
  return null;
}

// Hexagone (corps) contenant un point, le plus haut d'abord.
function hexagonAt(px, py) {
  for (let i = state.hexagons.length - 1; i >= 0; i--) {
    const h = state.hexagons[i];
    if (pointInHex(px, py, h.x, h.y, h.r)) return h;
  }
  return null;
}

// ---- Pointeur générique (souris + tactile) ----
function pointerDown(sx, sy) {
  closeMenus();
  // Interaction verrouillée (mobile par défaut) : on ne fait que paner.
  if (!interactionEnabled) { drag = { mode: 'pan', px: sx, py: sy }; state.selected = null; return; }
  const w = screenToWorld(sx, sy);

  const r = hitRect(w);
  if (r) {
    state.selected = r.id;
    drag = { mode: 'rect', id: r.id, offx: w.x - r.x, offy: w.y - r.y, startX: r.x, startY: r.y };
    lastPos = { x: w.x, y: w.y, t: performance.now() };
    return;
  }

  const hz = hitHexagon(w) || hitCircle(w);
  if (hz) {
    state.selected = hz.c.id;
    drag = hz.edge
      ? { mode: 'resize', id: hz.c.id }
      : { mode: 'zone', id: hz.c.id, offx: w.x - hz.c.x, offy: w.y - hz.c.y };
    return;
  }

  state.selected = null;
  drag = { mode: 'pan', px: sx, py: sy };
}

function pointerMove(sx, sy) {
  if (!drag) return;
  if (drag.mode === 'pan') {
    panBy(sx - drag.px, sy - drag.py);
    drag.px = sx; drag.py = sy;
    return;
  }
  const w = screenToWorld(sx, sy);

  if (drag.mode === 'rect') {
    const n = findById(drag.id);
    if (!n) return;
    const now = performance.now();
    const dt = Math.max(0.001, (now - lastPos.t) / 1000);
    dragTo(n, w.x - drag.offx, w.y - drag.offy, dt);
    lastPos = { x: w.x, y: w.y, t: now };
    scheduleSave();
  } else if (drag.mode === 'zone') {
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

function pointerUp() {
  if (drag) finishDrag();
  drag = null;
}

// Lâcher un vrai rectangle dans un hexagone => crée un lien, l'original revient.
function finishDrag() {
  if (drag.mode === 'rect') {
    const n = findById(drag.id);
    // Bloc Liaison : un clic (déplacement négligeable) copie le lien.
    if (n && n.kind === 'liaison') {
      if (Math.hypot(n.x - drag.startX, n.y - drag.startY) < 3 && n.url) copyLink(n);
      scheduleSave();
      return;
    }
    // Clic (déplacement négligeable) sur un nœud à lien => ouvre l'onglet.
    if (n) {
      const lk = displayLink(n);
      if (lk && Math.hypot(n.x - drag.startX, n.y - drag.startY) < 3) {
        const bu = parseBoardUrl(lk);
        if (bu) {
          // Lien vers un board : navigue dans le MÊME onglet (l'historique s'enregistre au chargement).
          recordBoard(bu.id, bu.name || displayText(n), bu.peer);
          location.href = lk;
          return;
        }
        openLink(lk); scheduleSave(); return; // lien externe : nouvel onglet
      }
    }
    if (n && !n.ref) {
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      const hex = hexagonAt(cx, cy);
      if (hex) {
        const startedOutside = !pointInHex(drag.startX + n.w / 2, drag.startY + n.h / 2, hex.x, hex.y, hex.r);
        const dupInHex = state.nodes.some(m =>
          m.ref === n.id && pointInHex(m.x + m.w / 2, m.y + m.h / 2, hex.x, hex.y, hex.r));
        if (startedOutside && !dupInHex) {
          const link = { id: newId(), x: cx - n.w / 2, y: cy - n.h / 2, w: n.w, h: n.h, ref: n.id };
          state.nodes.push(link);
          reset(link);
          n.x = drag.startX; n.y = drag.startY; reset(n);
          state.selected = link.id;
        }
      }
    }
  }

  // Position déposée : on synchronise la position finale (pas pendant le drag).
  const el = findById(drag.id);
  if (el && el.kind !== 'liaison') pushMove(el);
  scheduleSave();
}

// ---- Souris ----
function onMouseDown(e) {
  if (e.button === 1 || e.button === 2) return; // milieu/droit gérés ailleurs
  pointerDown(e.clientX, e.clientY);
}
function onMouseMove(e) { pointerMove(e.clientX, e.clientY); }
function onMouseUp() { pointerUp(); }

function onWheel(e) {
  e.preventDefault();
  const factor = Math.exp(-e.deltaY * 0.0015);
  zoomAt(e.clientX, e.clientY, factor);
  scheduleSave();
}

// ---- Tactile ----
function onTouchStart(e) {
  // En édition : un tap hors du textarea valide et ferme (sinon preventDefault
  // empêcherait le blur, et on resterait coincé dans l'édition sur mobile).
  if (editing) { document.getElementById('editor').blur(); e.preventDefault(); return; }

  if (e.touches.length === 1) {
    const t = e.touches[0];
    const now = performance.now();
    if (now - lastTap < 300 && lastTapPos &&
        Math.hypot(t.clientX - lastTapPos.x, t.clientY - lastTapPos.y) < 30) {
      // Double-tap.
      lastTap = 0;
      handleDouble(t.clientX, t.clientY);
      e.preventDefault();
      return;
    }
    lastTap = now;
    lastTapPos = { x: t.clientX, y: t.clientY };
    pointerDown(t.clientX, t.clientY);
    // Appui long => menu radial.
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      drag = null;
      openContextAt(t.clientX, t.clientY);
    }, 450);
  } else if (e.touches.length === 2) {
    clearTimeout(longPressTimer);
    drag = null;
    const [a, b] = e.touches;
    pinch = {
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
      mx: (a.clientX + b.clientX) / 2,
      my: (a.clientY + b.clientY) / 2,
    };
  }
  e.preventDefault();
}

function onTouchMove(e) {
  if (e.touches.length === 2 && pinch) {
    const [a, b] = e.touches;
    const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mx = (a.clientX + b.clientX) / 2, my = (a.clientY + b.clientY) / 2;
    if (pinch.dist > 0) zoomAt(mx, my, dist / pinch.dist);
    panBy(mx - pinch.mx, my - pinch.my);
    pinch = { dist, mx, my };
    scheduleSave();
  } else if (e.touches.length === 1) {
    const t = e.touches[0];
    if (lastTapPos && Math.hypot(t.clientX - lastTapPos.x, t.clientY - lastTapPos.y) > 10) {
      clearTimeout(longPressTimer);
    }
    pointerMove(t.clientX, t.clientY);
  }
  e.preventDefault();
}

function onTouchEnd(e) {
  clearTimeout(longPressTimer);
  if (e.touches.length < 2) pinch = null;
  if (e.touches.length === 0) pointerUp();
  e.preventDefault();
}

// ---- Drop d'image ----
function onDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  const w = screenToWorld(e.clientX, e.clientY);
  let target = hitRect(w);
  // Sur un lien : on remplit la source.
  if (target && target.ref) target = sourceOf(target);

  processImage(file, (src, ratio) => {
    if (target) {
      target.image = src;
      state.selected = target.id;
    } else {
      const { w: nw, h: nh } = imageRectSize(ratio);
      const n = addRect(w.x - nw / 2, w.y - nh / 2, '');
      n.w = nw; n.h = nh; n.image = src;
      reset(n);
      state.selected = n.id;
    }
    scheduleSave();
  });
}

// Dimensions d'un rectangle-image : aire ~ constante, ratio = celui de l'image.
function imageRectSize(ratio) {
  const TARGET = 185;
  let w = TARGET * Math.sqrt(ratio);
  let h = TARGET / Math.sqrt(ratio);
  w = Math.max(70, Math.min(340, Math.round(w)));
  h = Math.max(70, Math.min(340, Math.round(h)));
  return { w, h };
}

// Crée un rectangle-image (centré sur wx,wy) à partir d'un fichier.
function spawnImageRect(file, wx, wy) {
  processImage(file, (src, ratio) => {
    const { w: nw, h: nh } = imageRectSize(ratio);
    const n = addRect(wx - nw / 2, wy - nh / 2, '');
    n.w = nw; n.h = nh; n.image = src;
    reset(n);
    state.selected = n.id;
    scheduleSave();
  });
}

// Coller (Ctrl-V) : une image du presse-papier crée un rectangle-image ;
// sinon on colle l'élément interne copié.
function onPaste(e) {
  if (editing) return; // pendant l'édition, le textarea colle normalement
  const items = (e.clipboardData && e.clipboardData.items) || [];
  for (const it of items) {
    if (it.type && it.type.startsWith('image/')) {
      const file = it.getAsFile();
      if (file) {
        e.preventDefault();
        const w = screenToWorld(lastMouse.x, lastMouse.y);
        spawnImageRect(file, w.x, w.y);
        return;
      }
    }
  }
  if (clipboard) { e.preventDefault(); pasteClipboard(); }
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

// ---- Double-clic / double-tap ----
function handleDouble(sx, sy) {
  if (!interactionEnabled) return; // verrouillé : pas d'édition/ouverture
  const w = screenToWorld(sx, sy);
  const r = hitRect(w);
  if (r) {
    const img = displayImage(r);
    if (img) { openImagePopup(img); return; }
    const editTarget = r.ref ? sourceOf(r) : r; // éditer un lien = éditer sa source
    if (editTarget) startEdit('rect', editTarget, r);
    return;
  }
  const hz = hitHexagon(w) || hitCircle(w);
  if (hz) startEdit('zone', hz.c, hz.c);
}

function onKeyDown(e) {
  if (editing) return;

  const mod = e.ctrlKey || e.metaKey;
  if (mod && (e.key === 'c' || e.key === 'C')) { copySelection(); e.preventDefault(); return; }
  // Le collage (Ctrl-V) est géré par l'événement 'paste' (cf. onPaste) pour
  // pouvoir lire une image du presse-papier.

  if ((e.key === 'Delete' || e.key === 'Backspace') && state.selected) {
    removeElement(findById(state.selected));
    e.preventDefault();
  }
}

// Crée un bloc Liaison. En autonome : démarre l'hôte P2P. En client : affiche
// simplement le lien/QR de l'hôte auquel on est connecté (sans devenir hôte).
function createLiaison(wx, wy) {
  const n = { id: newId(), kind: 'liaison', x: wx - 100, y: wy - 115, w: 200, h: 230, status: 'init' };
  state.nodes.push(n);
  reset(n);
  state.selected = n.id;
  if (isClient()) {
    loadQR(); // en client, startHost n'est pas appelé : on charge la lib QR ici
    const id = hostId();
    if (id) { n.peerId = id; n.code = id; n.url = buildUrl(id); n.status = 'online'; }
    else n.status = 'error';
  } else {
    startHost(n);
  }
}

// Copie le lien d'un bloc Liaison dans le presse-papier + feedback visuel.
function copyLink(n) {
  const done = () => { n._copiedUntil = performance.now() + 1400; };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(n.url).then(done).catch(done);
  } else {
    done();
  }
}

// Ouvre un lien dans un nouvel onglet (préfixe https:// si besoin).
let _lastLinkOpen = 0;
function openLink(url) {
  const t = performance.now();
  if (t - _lastLinkOpen < 600) return; // évite le double-ouverture (double-clic)
  _lastLinkOpen = t;
  let u = String(url).trim();
  if (!u) return;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = 'https://' + u;
  window.open(u, '_blank', 'noopener,noreferrer');
}

// Supprime un élément (explosion + propagation ; coupe le host si Liaison).
function removeElement(el) {
  if (!el) return;
  if (el.kind === 'liaison') {
    if (!isClient()) stopHost(); // en client, le bloc n'héberge rien : ne pas couper la connexion
    removeById(el.id); scheduleSave(); return;
  }
  explodeElementCascade(el); // explosion locale
  pushDelete(el.id);         // explosion + suppression chez les pairs
  removeById(el.id);
  scheduleSave();
}

// ---- Copier / coller ----
function copySelection() {
  const el = state.selected && findById(state.selected);
  if (!el || el.kind === 'liaison') return; // un lien P2P ne se copie pas

  const data = {};
  for (const k in el) if (k[0] !== '_' && k !== 'id') data[k] = el[k];
  clipboard = {
    isCircle: state.circles.includes(el),
    isHex: state.hexagons.includes(el),
    data,
  };
}

function pasteClipboard() {
  if (!clipboard) return;
  const w = screenToWorld(lastMouse.x, lastMouse.y);
  if (clipboard.isCircle || clipboard.isHex) {
    const z = { ...clipboard.data, id: newId(), x: w.x, y: w.y };
    (clipboard.isHex ? state.hexagons : state.circles).push(z);
    state.selected = z.id;
  } else {
    const d = clipboard.data;
    const n = { ...d, id: newId(), x: w.x - (d.w || 150) / 2, y: w.y - (d.h || 70) / 2 };
    state.nodes.push(n);
    reset(n);
    state.selected = n.id;
  }
  scheduleSave();
}

// ---- Menu radial ----
function openContextAt(sx, sy) {
  closeMenus();
  // Verrouillé (mobile) : le menu ne propose que d'activer l'interaction.
  if (!interactionEnabled) {
    openRadial(sx, sy, [{ label: 'Activer', icon: 'unlock', color: COL.green, fn: () => { interactionEnabled = true; updateHint(); } }]);
    return;
  }
  const w = screenToWorld(sx, sy);
  const r = hitRect(w);
  const hz = !r ? (hitHexagon(w) || hitCircle(w)) : null;

  let items;
  if (r && r.kind === 'liaison') {
    items = [{ label: 'Copier le lien', icon: 'copy', color: COL.green, fn: () => copyLink(r) }];
    if (!isClient()) items.push({ label: 'Nouveau lien', icon: 'refresh', color: COL.yellow, fn: () => refreshHostId(r) });
    items.push({ label: 'Supprimer', icon: 'trash', color: COL.red, fn: () => removeElement(r) });
  } else if (r) {
    const isLink = !!r.ref;
    items = [{ label: 'Éditer le texte', icon: 'edit', color: COL.cyan, fn: () => { const t = isLink ? sourceOf(r) : r; if (t) startEdit('rect', t, r); } }];
    items.push({ label: 'Lien cliquable', icon: 'link', color: COL.purple, fn: () => { const t = isLink ? sourceOf(r) : r; if (t) startEdit('link', t, r); } });
    const img = displayImage(r);
    if (img) items.push({ label: "Voir l'image", icon: 'eye', color: COL.white, fn: () => openImagePopup(img) });
    if (!isLink && r.image) items.push({ label: "Retirer l'image", icon: 'imgx', color: COL.orange, fn: () => { delete r.image; scheduleSave(); } });
    items.push({ label: isLink ? 'Délier' : 'Supprimer', icon: 'trash', color: COL.red, fn: () => { removeById(r.id); scheduleSave(); } });
  } else if (hz) {
    const c = hz.c;
    items = [
      { label: 'Couleur', icon: 'color', color: COL.purple, fn: () => openPalette(sx, sy, c) },
      { label: 'Texte', icon: 'text', color: COL.cyan, fn: () => startEdit('zone', c, c) },
      { label: 'Supprimer', icon: 'trash', color: COL.red, fn: () => { removeById(c.id); scheduleSave(); } },
    ];
  } else {
    items = [
      { label: 'Rectangle', icon: 'rect', color: COL.green, fn: () => { const n = addRect(w.x - 75, w.y - 35); reset(n); state.selected = n.id; startEdit('rect', n, n); scheduleSave(); } },
      { label: 'Pancarte', icon: 'pancarte', color: COL.wood, fn: () => { const n = { id: newId(), kind: 'pancarte', x: w.x - 120, y: w.y - 65, w: 240, h: 130, text: '' }; state.nodes.push(n); reset(n); state.selected = n.id; startEdit('rect', n, n); scheduleSave(); } },
      { label: 'Cercle', icon: 'circle', color: COL.cyan, fn: () => { const c = addCircle(w.x, w.y); state.selected = c.id; scheduleSave(); } },
      { label: 'Hexagone', icon: 'hexa', color: COL.orange, fn: () => { const h = addHexagon(w.x, w.y); state.selected = h.id; scheduleSave(); } },
      { label: 'Liaison', icon: 'share', color: COL.magenta, fn: () => createLiaison(w.x, w.y) },
      { label: 'Lien board', icon: 'board', color: COL.cyan, fn: () => openBoardPicker(w.x, w.y) },
      { label: 'Exporter', icon: 'export', color: COL.yellow, fn: () => exportJSON() },
      { label: 'Importer', icon: 'import', color: COL.white, fn: () => importJSON(() => { onChange(); }) },
    ];
    // Sur mobile : possibilité de reverrouiller l'interaction.
    if (isCoarse) items.push({ label: 'Verrouiller', icon: 'lock', color: COL.orange, fn: () => { interactionEnabled = false; state.selected = null; updateHint(); } });
  }
  openRadial(sx, sy, items);
}

function mkRitem(it, extraClass) {
  const el = document.createElement('div');
  el.className = 'ritem' + (extraClass ? ' ' + extraClass : '');
  el.title = it.label;
  el.style.setProperty('--c', it.color || COL.green);
  el.innerHTML = svgEl(it.icon);
  el.addEventListener('mousedown', (ev) => ev.stopPropagation());
  el.addEventListener('touchstart', (ev) => ev.stopPropagation());
  el.addEventListener('click', (ev) => { ev.stopPropagation(); closeMenus(); it.fn(); });
  return el;
}

function openRadial(x, y, items) {
  const radial = document.getElementById('radial');
  radial.innerHTML = '';
  radial.classList.remove('hidden');

  const n = items.length;
  const D = isCoarse ? 62 : 52;        // diamètre d'un bouton
  const start = -Math.PI / 2;

  // Rayon : la corde entre deux boutons voisins dépasse leur diamètre (pas de chevauchement).
  let radius = n > 1 ? (D + 14) / (2 * Math.sin(Math.PI / n)) : 0;
  radius = Math.max(radius, D + 6);

  // Recadre le centre pour que tout le menu reste visible.
  const m = radius + D / 2 + 6;
  const cx = Math.max(m, Math.min(x, window.innerWidth - m));
  const cy = Math.max(m, Math.min(y, window.innerHeight - m));
  radial.style.left = cx + 'px';
  radial.style.top = cy + 'px';

  // Bouton central : ferme le menu (ancre visuelle).
  const center = mkRitem({ label: 'Fermer', icon: 'close', color: COL.green, fn: () => {} }, 'ritem-center show');
  center.style.transform = 'translate(-50%, -50%) scale(1)';
  center.style.opacity = '1';
  radial.appendChild(center);

  // Items qui se déploient en éventail (animation ressort décalée).
  items.forEach((it, i) => {
    const ang = start + (i / n) * Math.PI * 2;
    const dx = Math.cos(ang) * radius, dy = Math.sin(ang) * radius;
    const el = mkRitem(it);
    radial.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transitionDelay = (i * 32) + 'ms';
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`;
      el.classList.add('show');
    }));
  });
  armCloseOnce();
}

// ---- Palette de couleurs ----
function openPalette(x, y, zone) {
  const pal = document.getElementById('palette');
  pal.innerHTML = '';
  pal.style.left = Math.min(x, window.innerWidth - 150) + 'px';
  pal.style.top = Math.min(y, window.innerHeight - 130) + 'px';
  pal.classList.remove('hidden');
  COLORS.forEach((col) => {
    const sw = document.createElement('div');
    sw.className = 'swatch';
    sw.style.background = col;
    sw.addEventListener('mousedown', (ev) => ev.stopPropagation());
    sw.addEventListener('touchstart', (ev) => ev.stopPropagation());
    sw.addEventListener('click', (ev) => { ev.stopPropagation(); zone.color = col; scheduleSave(); closeMenus(); });
    pal.appendChild(sw);
  });
  armCloseOnce();
}

function armCloseOnce() {
  setTimeout(() => {
    document.addEventListener('mousedown', closeMenusOnce, { once: true });
    document.addEventListener('touchstart', closeMenusOnce, { once: true });
  }, 0);
}
function closeMenusOnce() { closeMenus(); }
function closeMenus() {
  document.getElementById('radial').classList.add('hidden');
  document.getElementById('palette').classList.add('hidden');
  document.getElementById('boardpicker').classList.add('hidden');
  document.removeEventListener('mousedown', closeMenusOnce);
  document.removeEventListener('touchstart', closeMenusOnce);
}

// ---- Sélecteur de board (créer un lien vers un autre board) ----
function openBoardPicker(wx, wy) {
  closeMenus();
  pendingBoardPos = { x: wx, y: wy };
  const bp = document.getElementById('boardpicker');
  bp.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'bp-title';
  title.textContent = 'LIEN VERS UN BOARD';
  bp.appendChild(title);

  // Créer un nouveau board.
  const newRow = document.createElement('div');
  newRow.className = 'bp-new';
  const inp = document.createElement('input');
  inp.maxLength = 40; inp.placeholder = 'Nouveau board…';
  const okb = document.createElement('button');
  okb.textContent = '+';
  newRow.appendChild(inp); newRow.appendChild(okb);
  bp.appendChild(newRow);
  const createNew = () => { const nm = inp.value.trim(); if (nm) createBoardLink(genBoardId(), nm, null); };
  okb.addEventListener('click', createNew);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') createNew(); });

  // Boards déjà visités.
  const cur = getBoardId();
  const visited = listBoards().filter((b) => b.id !== cur);
  if (!visited.length) {
    const empty = document.createElement('div');
    empty.className = 'bp-empty';
    empty.textContent = '(aucun autre board visité)';
    bp.appendChild(empty);
  }
  visited.forEach((b) => {
    const row = document.createElement('div');
    row.className = 'bp-row';
    row.textContent = b.name || b.id;
    row.addEventListener('click', () => createBoardLink(b.id, b.name, b.peer));
    bp.appendChild(row);
  });

  bp.classList.remove('hidden');
  armCloseOnce();
  setTimeout(() => inp.focus(), 50);
}

function createBoardLink(targetId, name, peerOverride) {
  closeMenus();
  const peer = peerOverride || hostId() || null; // hérite du host courant
  const url = buildBoardUrl(targetId, peer, name);
  const pos = pendingBoardPos || screenToWorld(lastMouse.x, lastMouse.y);
  const n = addRect(pos.x - 80, pos.y - 30, name || targetId);
  n.w = 160; n.link = url;
  reset(n);
  state.selected = n.id;
  recordBoard(targetId, name, peer);
  scheduleSave();
}

// ---- Popup image ----
function openImagePopup(src) {
  closeMenus();
  const pop = document.getElementById('imgpopup');
  pop.querySelector('img').src = src;
  pop.classList.add('show');
}
function closeImagePopup() {
  document.getElementById('imgpopup').classList.remove('show');
}

// ---- Édition de texte ----
// target = élément édité (pour un lien : sa source) ; posNode = élément à survoler.
function startEdit(type, target, posNode) {
  posNode = posNode || target;
  closeMenus();
  editing = { type, id: target.id };
  const ed = document.getElementById('editor');
  const z = state.camera.zoom;

  if (type === 'rect' || type === 'link') {
    const p = worldToScreen(posNode.x, posNode.y);
    ed.style.left = p.x + 'px';
    ed.style.top = p.y + 'px';
    ed.style.width = (posNode.w * z) + 'px';
    ed.style.height = (type === 'link' ? 40 : posNode.h * z) + 'px';
    ed.value = type === 'link' ? (target.link || '') : (target.text || '');
  } else {
    const p = worldToScreen(posNode.x, posNode.y - posNode.r);
    const wpx = 220;
    ed.style.left = (p.x - wpx / 2) + 'px';
    ed.style.top = p.y + 'px';
    ed.style.width = wpx + 'px';
    ed.style.height = '40px';
    ed.value = target.description || '';
  }
  ed.style.fontSize = Math.max(8, Math.min(18, 11 * z)) + 'px';
  ed.classList.add('show');
  document.getElementById('editDone').classList.add('show');
  ed.focus();
  ed.select();
}

function commitEdit() {
  if (!editing) return;
  const ed = document.getElementById('editor');
  const target = findById(editing.id);
  if (target) {
    if (editing.type === 'rect') target.text = ed.value;
    else if (editing.type === 'link') { const v = ed.value.trim(); if (v) target.link = v; else delete target.link; }
    else target.description = ed.value.replace(/\n/g, ' ').trim();
    scheduleSave();
  }
  editing = null;
  ed.classList.remove('show');
  document.getElementById('editDone').classList.remove('show');
}

// Échap : ferme l'éditeur ou la popup image.
window.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (editing) { e.preventDefault(); document.getElementById('editor').blur(); }
  closeImagePopup();
});
