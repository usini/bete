import { addSteamBlock, dropApplicationFile, openApplication } from './applications.js?v=mw3slh1j';
import { steamApplicationUri } from './application-model.js?v=mw3slh1j';
import { updateGitHubCard } from './github-cards.js?v=mw3slh1j';
import { settleDrop, dropTargetGroup, setDropPreview } from './placement.js?v=mw3slh1j';
import { parseProductClipboard, isProductClipboard } from './product-clipboard.js?v=mw3slh1j';
import { externalMode } from './external-board.js?v=mw3slh1j';
// Pointer, wheel, keyboard, paste and drop handling for the canvas.
//  - click on a label: edit popup, link field first (YouTube labels open the video instead)
//  - double-click on a block: play it (YouTube), open its link, pick an image (image block), or edit its text
//  - click on the 📝 button of a selected block: edit popup (text and link)
//  - click on the 🖼️ button of a selected image block: change its picture
import { state, getNode, getSelectedId, getLastSelectedGroup, select, addNode, newId, sanitizeNode, removeNode, raise, emit, rememberColor, rememberSize, groupsBySize, membersOf, containingGroups, fitGroupsAround, groupHeaderHeight, groupHeaderBox, COLORS } from './state.js?v=mw3slh1j';
import { screenToWorld, worldToScreen, zoomAt, panBy, view, cancelFlight, flyToBlock } from './camera.js?v=mw3slh1j';
import { startEdit, stopEdit, isEditing, previewGroupAlignment, resizeGroupBlocks } from './editor.js?v=mw3slh1j';
import { addDataUrl, addImageFile, fitNodeImage, imageCaptionFraction, imageFor } from './images.js?v=mw3slh1j';
import { playVideo } from './video.js?v=mw3slh1j';
import { youTubeId } from './yt.js?v=mw3slh1j';
import { snapMove, snapResize, clearGuides } from './snap.js?v=mw3slh1j';
import { labelHit, labelInfo, labelLayout, actionHit, linkOf } from './labels.js?v=mw3slh1j';
import { undo, redo } from './history.js?v=mw3slh1j';

import { setDragging } from './motion.js?v=mw3slh1j';

import { plainLink, genericLink, droppedLink, droppedTitle, openLink } from './links.js?v=mw3slh1j';
import { shortenAmazonText, isAmazonUrl, amazonBadgeLayout } from './amazon.js?v=mw3slh1j';

import { isLocked, setLocked, modeEvents } from './mobile-mode.js?v=mw3slh1j';

import { serviceForNode } from './services.js?v=mw3slh1j';

import { requestRender } from './render.js?v=mw3slh1j';

import { notify } from './notifications.js?v=mw3slh1j';

export const BLOCK_MIME = 'application/x-bete-block';
const CLIPBOARD_BLOCK = 'application/x-bete-clipboard-block';

const canvas = document.getElementById('canvas');
const picker = document.getElementById('filepick');
const HANDLE_PX = 12;  // screen tolerance of the resize handle
const MOVE_PX = 5;     // below this, a press is a click
const MIN_SIZE = 20, MAX_SIZE = 1e5;

const pointers = new Map(); // pointerId -> { x, y } (screen)
let gesture = null;         // { type: 'pan' | 'move' | 'resize' | 'pinch', ... }
let pickTarget = null;
let cursorPosition = null;
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
// title bars where no block is hit, the smallest (innermost) group first.
function nodeAt(w) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const n = state.nodes[i];
    if (n.kind !== 'group' && inside(n, w)) return n;
  }
  const groups = groupsBySize();
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (inside(groupHeaderBox(group), w)) return group;
  }
  return null;
}

function onHandle(n, sx, sy) {
  const p = worldToScreen(n.x + n.w, n.y + n.h);
  return Math.abs(p.x - sx) <= HANDLE_PX && Math.abs(p.y - sy) <= HANDLE_PX;
}

function pinchStart() {
  setDropPreview(null);
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
      if (target && !isLocked()) { target.color = color; rememberColor(color); emit(); }
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
  // The canvas prevents native focus changes, so release a previously focused toolbar button.
  if (document.activeElement?.matches('button')) document.activeElement.blur();
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
    const members = sel.kind === 'group' ? membersOf(sel).map(m => ({
      m, x: m.x - sel.x, y: m.y - sel.y, w: m.w, h: m.h,
    })) : null;
    gesture = { type: 'resize', n: sel, ox: sel.w, oy: sel.h, sx, sy, members, previousGroups: containingGroups(sel) };
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
      else if (action === 'optimize-image') {
        sel.keepImageOriginal = !sel.keepImageOriginal;
        emit();
        notify(sel.keepImageOriginal ? 'Image protégée de l’optimisation.' : 'Image de nouveau optimisable.');
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
  gesture = { type: 'move', n, ox: n.x, oy: n.y, sx, sy, moved: false, wasSelected, members, previousGroups: containingGroups(n) };
}

// Click on a label: edits the link. On a YouTube block the label opens the video instead.
function labelDown(n) {
  select(n.id);
  gesture = null;
  const info = labelInfo(n);
  if (info.kind === 'yt') {
    if (once('label')) openLink(info.href);
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
    if (readable?.application) { openApplication(readable); return; }
    if (readable && serviceForNode(readable) && linkOf(readable)) openLink(linkOf(readable));
    else if (readable && youTubeId(readable.text)) playVideo(readable);
    else if (readable && linkOf(readable)) openLink(linkOf(readable));
    return;
  }
  if (labelHit(w)) return;
  if (nodeAt(w)?.application) { openApplication(nodeAt(w)); return; }
  const selected = getNode(getSelectedId());
  if (selected && actionHit(selected, w, state.camera.zoom)) return;
  const n = nodeAt(w);
  if (!n) {
    const created = addNode('rect', w.x, w.y);
    startEdit(created.id);
    return;
  }
  if (!n.image && isAmazonUrl(linkOf(n))) startEdit(n.id);
  else if (serviceForNode(n) && linkOf(n)) openLink(linkOf(n));
  else if (n.kind === 'group') startEdit(n.id);                               // group: edit its title
  else if (youTubeId(n.text)) playVideo(n);                              // YouTube: play
  else if (linkOf(n)) openLink(linkOf(n));      // has a link: open it
  else if (n.kind === 'image') { if (once('pick')) pickImage(n); }       // image: (re)upload
  else startEdit(n.id);                                                  // text: edit
}

function onPointerMove(e) {
  if (!gesture && e.pointerType === 'mouse') {
    const selected = getNode(getSelectedId());
    const overToggle = selected?.image && actionHit(selected, screenToWorld(e.clientX, e.clientY), state.camera.zoom) === 'optimize-image';
    canvas.title = overToggle ? (selected.keepImageOriginal ? 'Autoriser l’optimisation' : 'Ne pas optimiser') : '';
  }
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
    setDropPreview(g.moved ? dropTargetGroup(g.n, state.nodes, visualBounds) : null);
  } else if (g.type === 'resize') {
    const z = state.camera.zoom;
    const w = g.ox + (e.clientX - g.sx) / z;
    const h = g.oy + (e.clientY - g.sy) / z;
    if (g.members) {
      // Project the handle onto the diagonal of the original group so both axes use one scale.
      const requested = (w * g.ox + h * g.oy) / (g.ox ** 2 + g.oy ** 2);
      let minScale = MIN_SIZE / Math.min(g.ox, g.oy);
      let maxScale = MAX_SIZE / Math.max(g.ox, g.oy);
      for (const member of g.members) {
        minScale = Math.max(minScale, MIN_SIZE / Math.min(member.w, member.h));
        maxScale = Math.min(maxScale, MAX_SIZE / Math.max(member.w, member.h));
      }
      const scale = Math.max(Math.min(1, minScale), Math.min(Math.max(1, maxScale), requested));
      g.n.w = g.ox * scale;
      g.n.h = g.oy * scale;
      for (const { m, x, y, w, h } of g.members) {
        m.x = g.n.x + x * scale;
        m.y = g.n.y + y * scale;
        m.w = w * scale;
        m.h = h * scale;
      }
      clearGuides();
      emit();
      return;
    }
    const image = g.n.image && imageFor(g.n.image, requestRender);
    if (image) {
      const ratio = image.naturalWidth / image.naturalHeight * (1 - imageCaptionFraction(g.n));
      // Project the dragged corner onto the line of valid sizes.
      const width = (w + h / ratio) / (1 + 1 / (ratio * ratio));
      const maxWidth = Math.min(MAX_SIZE, MAX_SIZE * ratio);
      const minWidth = Math.min(maxWidth, Math.max(MIN_SIZE, MIN_SIZE * ratio));
      g.n.w = Math.max(minWidth, Math.min(maxWidth, width));
      g.n.h = g.n.w / ratio;
      clearGuides();
    } else if (!g.n.image) {
      const size = snapResize(g.n, clamp(w), clamp(h));
      g.n.w = size.w;
      g.n.h = size.h;
    }
  }
  emit();
}

function visualBounds(node) {
        const boxes = [node, labelLayout(node), amazonBadgeLayout(node)].filter(Boolean);
        const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
        return { x, y, w: Math.max(...boxes.map(b => b.x + b.w)) - x, h: Math.max(...boxes.map(b => b.y + b.h)) - y };
}

function onPointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  setDropPreview(null);
  clearGuides();
  const g = gesture;
  if (g?.type === 'move') {
    if (g.moved) {
      g.targetGroup = dropTargetGroup(g.n, state.nodes, visualBounds);
      if (g.targetGroup) {
        // Move the visual box into the body before finding space among its members.
        const box = visualBounds(g.n), group = g.targetGroup;
        const minX = group.x + 16, minY = group.y + groupHeaderHeight(group) + 16;
        const maxX = Math.max(minX, group.x + group.w - box.w - 16);
        const maxY = Math.max(minY, group.y + group.h - box.h - 16);
        g.n.x += Math.max(minX, Math.min(maxX, box.x)) - box.x;
        g.n.y += Math.max(minY, Math.min(maxY, box.y)) - box.y;
      }
      settleDrop(g.n, state.nodes, (g.members || []).map(entry => entry.m), visualBounds);
    }
    setDragging(g.n, false);
  }
  if (g && g.type === 'resize') rememberSize(g.n.kind, g.n.w, g.n.h);
  if (g && ((g.type === 'move' && g.moved) || g.type === 'resize')) {
    document.dispatchEvent(new CustomEvent('bete-node-moved', { detail: g.n.id }));
    fitGroupsAround(g.n, g.previousGroups, g.type === 'resize', g.targetGroup);
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
  if (isLocked() || getNode(n.id) !== n) return;
  const previousGroups = containingGroups(n);
  n.image = ref;
  await fitNodeImage(n);
  if (getNode(n.id) !== n) return;
  fitGroupsAround(n, previousGroups, true);
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
  document.addEventListener('pointermove', e => { cursorPosition = { x: e.clientX, y: e.clientY }; }, { passive: true });
  // Pointer clicks should not leave Space/Enter attached to the last action.
  // Keyboard activation has detail=0, keeping Tab navigation and native button activation.
  document.addEventListener('click', e => {
    if (e.detail > 0 && document.activeElement?.matches('button')) document.activeElement.blur();
  });
  modeEvents.addEventListener('change', () => {
    if (gesture?.type === 'move') setDragging(gesture.n, false);
    if (gesture?.type === 'move') setDragging(gesture.n, false);
    pointers.clear(); gesture = null; clearGuides(); setDropPreview(null);
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
    if (externalMode) { e.dataTransfer.dropEffect = 'none'; return; }
    e.dataTransfer.dropEffect = isLocked() ? 'none' : 'copy';
  });
  canvas.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (externalMode || isLocked()) {
      notify('Le tableau est verrouillé : déverrouille-le avec V avant de déposer un fichier.');
      return;
    }
    const w = screenToWorld(e.clientX, e.clientY);
    const kind = e.dataTransfer.getData(BLOCK_MIME);
    if (kind === 'rect' || kind === 'image' || kind === 'group') {
      addNode(kind, w.x, w.y); return;
    }
    if (isLocked()) return;
    const applicationFile = [...e.dataTransfer.files].find(f => /\.(?:exe|lnk|url|bat)$/i.test(f.name));
    if (applicationFile && dropApplicationFile(applicationFile, w.x, w.y)) return;
    const steam = steamApplicationUri(e.dataTransfer.getData('text/uri-list').trim()) || steamApplicationUri(e.dataTransfer.getData('text/plain'));
    if (steam) { addSteamBlock(steam, w.x, w.y); return; }
    const file = [...e.dataTransfer.files].find((f) => f.type.startsWith('image/'));
    if (file) {
      await imageToNode(file, addNode('image', w.x, w.y));
      return;
    }
    const url = droppedLink(e.dataTransfer);
    if (!url && ([...e.dataTransfer.types].includes('Files') || /^file:/i.test(e.dataTransfer.getData('text/uri-list')))) {
      notify('Le fichier déposé n’a pas été transmis. Pour une application, utilise Ajouter une application dans le menu.', { type: 'error' });
    }
    if (url) {
      const n = addNode('rect', w.x, w.y);
      if (genericLink(url)) { n.link = url; n.text = droppedTitle(e.dataTransfer, url); }
      else n.text = shortenAmazonText(url);
      emit();
      updateGitHubCard(n);
      if (isAmazonUrl(url)) startEdit(n.id);
    }
  });

  const clipboardBlocked = e => isLocked() || isEditing() || document.querySelector('dialog[open]')
    || (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]'));

  window.addEventListener('copy', e => {
    if (clipboardBlocked(e) || !e.clipboardData || window.getSelection()?.toString()) return;
    const selected = getNode(getSelectedId());
    if (!selected) return;
    const { id, shareId, ...block } = selected;
    e.clipboardData.setData(CLIPBOARD_BLOCK, JSON.stringify(block));
    e.clipboardData.setData('text/plain', block.text || block.link || '');
    e.preventDefault();
  });

  window.addEventListener('paste', async (e) => {
    if (clipboardBlocked(e)) return;
    const productText = e.clipboardData?.getData('text/plain');
    if (isProductClipboard(productText)) {
      e.preventDefault();
      const product = parseProductClipboard(productText);
      if (!product) { notify('Bloc Amazon invalide ou trop volumineux.'); return; }
      const center = screenToWorld(view.w / 2, view.h / 2);
      if (product.image) {
        try { product.image = await addDataUrl(product.image); }
        catch { delete product.image; notify('Image indisponible ; produit collé sans image.'); }
      }
      if (isLocked() || externalMode) return;
      // Use the same remembered size and colour as a newly created rectangle.
      const { w, h, ...content } = product;
      const block = addNode('rect', center.x, center.y);
      const previousGroups = containingGroups(block);
      Object.assign(block, content);
      await fitNodeImage(block);
      if (getNode(block.id) !== block) return;
      fitGroupsAround(block, previousGroups, true);
      select(block.id);
      return;
    }
    const steam = steamApplicationUri(productText);
    if (steam) {
      e.preventDefault();
      const center = screenToWorld(view.w / 2, view.h / 2);
      addSteamBlock(steam, center.x, center.y);
      return;
    }
    const copied = e.clipboardData?.getData(CLIPBOARD_BLOCK);
    if (copied) {
      let block;
      try { block = sanitizeNode(JSON.parse(copied)); } catch { /* Fall back to standard clipboard data. */ }
      if (block) {
        e.preventDefault();
        const center = screenToWorld(view.w / 2, view.h / 2);
        const offset = 24 / state.camera.zoom;
        block.id = newId();
        delete block.shareId;
        block.x = center.x - block.w / 2 + offset;
        block.y = center.y - block.h / 2 + offset;
        state.nodes.push(block);
        fitGroupsAround(block);
        select(block.id);
        return;
      }
    }
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
      emit();
      updateGitHubCard(selected);
      if (isAmazonUrl(url)) startEdit(selected.id);
      return;
    }
    const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => f.type.startsWith('image/'));
    const c = screenToWorld(view.w / 2, view.h / 2);
    if (file) {
      e.preventDefault();
      await imageToNode(file, addNode('image', c.x, c.y));
      return;
    }
    if (!pasted?.trim()) return;
    e.preventDefault();
    const n = addNode('rect', c.x, c.y);
    if (url && genericLink(url)) n.link = url;
    else n.text = url ? shortenAmazonText(url) : pasted.slice(0, 20000);
    emit();
    if (url) updateGitHubCard(n);
    if (url && isAmazonUrl(url)) startEdit(n.id);
  });

  window.addEventListener('keydown', (e) => {
    const targetField = e.target instanceof Element && (e.target.closest('input, textarea, select') || e.target.isContentEditable);
    if (e.isComposing) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (e.repeat || externalMode) return;
      if (isEditing() || document.querySelector('dialog[open]')) { notify('Valide ou ferme la fenêtre en cours avant de sauvegarder sur Google Drive.'); return; }
      const button = document.getElementById('drive-save');
      if (button.hidden) notify('Connecte Google Drive depuis le menu pour sauvegarder.');
      else if (!button.disabled) button.click();
      return;
    }
    if (!targetField && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !document.querySelector('dialog[open], :popover-open') && e.key.toLowerCase() === 'v') {
      e.preventDefault();
      setLocked(!isLocked());
      return;
    }
    if (isLocked() || isEditing() || document.querySelector('dialog[open]')) return;
    // Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y redoes the board. Not inside a text field
    // (it keeps its own undo), nor while a popup is open.
    const inField = e.target instanceof Element && (e.target.closest('input, textarea, select') || e.target.isContentEditable);
    if (!inField && (e.ctrlKey || e.metaKey) && !e.altKey && !document.querySelector('dialog[open]')) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); return; }
    }
    if (inField || e.isComposing) return;
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat && !gesture && !document.querySelector(':popover-open')) {
      const key = e.key.toLowerCase();
      if (['r', 'g', 'm', 't', 'a', 'f'].includes(key)) {
        e.preventDefault();
        if (key === 'r' && getNode(getSelectedId())?.kind === 'group') {
          resizeGroupBlocks(getSelectedId());
        } else if (key === 'r' || key === 'g') {
          const point = cursorPosition || { x: view.w / 2, y: view.h / 2 };
          const world = screenToWorld(point.x, point.y);
          const created = addNode(key === 'r' ? 'rect' : 'group', world.x, world.y);
          startEdit(created.id);
        } else if (key === 'm') {
          document.getElementById('panel-toggle').click();
        } else if (key === 'f') {
          document.getElementById('fit-board').click();
        } else if (key === 't') document.getElementById('open-group-index').click();
        else {
          const group = getLastSelectedGroup();
          if (group) { previewGroupAlignment(group.id); stopEdit(true); }
          else notify('Sélectionne un groupe avant de l’aligner.');
        }
        return;
      }
    }
    const id = getSelectedId();
    // Toolbar buttons can retain focus after a pointer click on the canvas.
    if (id && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault(); removeNode(id); return;
    }
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (e.key === 'Escape') select(null);
    else if (id && e.key === 'Enter') startEdit(id);
  });

  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    const n = getNode(pickTarget);
    if (file && n) await imageToNode(file, n);
  });
}
