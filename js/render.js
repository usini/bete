// Canvas drawing: grid, blocks (text / image / YouTube thumbnail), labels, snap guides, selection.
import { state, events, getSelectedId, groupsBySize } from './state.js?v=mvzd9bsl';
import { view, screenToWorld } from './camera.js?v=mvzd9bsl';
import { youTubeId, ytThumb } from './yt.js?v=mvzd9bsl';
import { imageFor } from './images.js?v=mvzd9bsl';
import { positionVideo, isVideoPlaying } from './video.js?v=mvzd9bsl';
import { guides } from './snap.js?v=mvzd9bsl';
import { renderMinimap } from './minimap.js?v=mvzd9bsl';
import { updateFx, renderFx, hasParticles } from './fx.js?v=mvzd9bsl';
import { fitText, fitLine, TEXT_PAD, LINE, FONT_FAMILY } from './text.js?v=mvzd9bsl';
import { labelLayout, editIconBox, colorIconBox, imageIconBox, setLabelRedraw, LABEL_FONT, LABEL_SEP, ICON, ICON_GAP, LABEL_PAD } from './labels.js?v=mvzd9bsl';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const PAD = 10;         // inner padding of image blocks, in world units
const CAPTION = 26;     // caption strip height for image blocks with text
const CAPTION_FONT = '16px ' + FONT_FAMILY;

let dpr = 1;
let scheduled = false;
const thumbs = new Map(); // youtube id -> HTMLImageElement
const ICON_ANIM_MS = 220;  // appearance animation of the 📝 button
let iconSelId = null;      // selection the animation was started for
let iconStart = 0;         // when that selection happened
let iconT = 1;             // animation progress, 0 -> 1

setLabelRedraw(() => requestRender());

export function requestRender() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(draw);
  }
}

export function resize() {
  dpr = window.devicePixelRatio || 1;
  view.w = window.innerWidth;
  view.h = window.innerHeight;
  canvas.width = Math.round(view.w * dpr);
  canvas.height = Math.round(view.h * dpr);
  canvas.style.width = view.w + 'px';
  canvas.style.height = view.h + 'px';
  requestRender();
}

events.addEventListener('change', requestRender);

function draw() {
  scheduled = false;
  const { x, y, zoom } = state.camera;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0c0e12';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const k = dpr * zoom;
  ctx.setTransform(k, 0, 0, k, dpr * (view.w / 2 - x * zoom), dpr * (view.h / 2 - y * zoom));
  drawGrid(zoom);
  const selId = getSelectedId();
  if (selId !== iconSelId) {
    iconSelId = selId;
    iconStart = performance.now();
  }
  iconT = Math.min(1, (performance.now() - iconStart) / ICON_ANIM_MS);
  updateFx(performance.now());
  // Groups first (the biggest underneath), then the other blocks on top of them.
  for (const n of groupsBySize()) drawNode(n, n.id === selId, zoom);
  for (const n of state.nodes) if (n.kind !== 'group') drawNode(n, n.id === selId, zoom);
  renderFx(ctx); // deletion animation, above the blocks
  drawGuides(zoom);
  positionVideo();
  renderMinimap();
  // Keep animating until the 📝 button is fully shown and the deletion pieces are gone.
  if (iconT < 1 || hasParticles()) requestRender();
}

// Snap guide lines (shown only while a block is being moved or resized).
function drawGuides(zoom) {
  if (!guides.x.length && !guides.y.length) return;
  ctx.save();
  ctx.strokeStyle = '#ff3ea5';
  ctx.lineWidth = 1 / zoom;
  ctx.beginPath();
  for (const g of guides.x) { ctx.moveTo(g.at, g.y0); ctx.lineTo(g.at, g.y1); }
  for (const g of guides.y) { ctx.moveTo(g.x0, g.at); ctx.lineTo(g.x1, g.at); }
  ctx.stroke();
  ctx.restore();
}

function drawGrid(zoom) {
  if (zoom < 0.25) return;
  const step = 40;
  const tl = screenToWorld(0, 0), br = screenToWorld(view.w, view.h);
  if (((br.x - tl.x) / step) * ((br.y - tl.y) / step) > 6000) return;
  const r = 1.5 / zoom;
  ctx.fillStyle = '#23272f';
  for (let gx = Math.floor(tl.x / step) * step; gx <= br.x; gx += step) {
    for (let gy = Math.floor(tl.y / step) * step; gy <= br.y; gy += step) {
      ctx.fillRect(gx - r, gy - r, 2 * r, 2 * r);
    }
  }
}

function drawNode(n, selected, zoom) {
  if (n.kind === 'group') {
    drawGroup(n);
    drawSelection(n, selected, zoom);
    return;
  }
  const yt = youTubeId(n.text);
  ctx.fillStyle = '#14171d';
  ctx.fillRect(n.x, n.y, n.w, n.h);

  ctx.save();
  ctx.beginPath();
  ctx.rect(n.x, n.y, n.w, n.h);
  ctx.clip();
  const src = yt ? thumb(yt) : n.image ? imageFor(n.image, requestRender) : null;
  // Caption strip inside image blocks (their text).
  const label = !yt && n.kind !== 'image' && src && n.text ? n.text : null;
  const areaH = n.h - 2 * PAD - (label ? CAPTION : 0);
  if (src) {
    if (areaH > 0) drawContained(src, n.x + PAD, n.y + PAD, n.w - 2 * PAD, areaH);
    if (yt) drawPlay(n);
    if (label) drawCaption(n, label);
  } else if (!yt && n.kind !== 'image') {
    // Image blocks show no text: they only show their picture (changed with the 🖼️ button).
    drawBlockText(n.text, n, '#e8e8e8');
  }
  ctx.restore();

  ctx.lineWidth = 4;
  ctx.strokeStyle = n.color;
  ctx.strokeRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);

  drawSelection(n, selected, zoom);
  drawLabel(n, zoom);
}

// Selection outline, resize handle and action buttons of the selected block.
function drawSelection(n, selected, zoom) {
  if (!selected) return;
  ctx.save();
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(n.x - 4, n.y - 4, n.w + 8, n.h + 8);
  ctx.restore();
  const hs = 10 / zoom; // resize handle, bottom-right corner
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(n.x + n.w - hs / 2, n.y + n.h - hs / 2, hs, hs);
  drawEditIcon(n, zoom);
  if (n.kind === 'image') drawImageIcon(n, zoom);
}

// Group: a translucent area in its colour, with a header bar at the top holding the title
// (centred, black or white for contrast). Drawn under the other blocks.
// The header grows with the group (22 % of its height, between 64 and 220), and the title is as
// big as fits on one line: a big group stays readable when zoomed out.
const GROUP_HEADER_MIN = 64, GROUP_HEADER_MAX = 220;
function drawGroup(n) {
  ctx.fillStyle = hexAlpha(n.color, 0.16);
  ctx.fillRect(n.x, n.y, n.w, n.h);
  const hh = Math.min(n.h, Math.min(GROUP_HEADER_MAX, Math.max(GROUP_HEADER_MIN, n.h * 0.22)));
  ctx.fillStyle = n.color;
  ctx.fillRect(n.x, n.y, n.w, hh);
  ctx.lineWidth = 4;
  ctx.strokeStyle = n.color;
  ctx.strokeRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);

  const title = firstLine(n.text).trim();
  ctx.save();
  ctx.beginPath();
  ctx.rect(n.x, n.y, n.w, hh);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textOn(n.color);
  if (!title) ctx.globalAlpha = 0.45; // placeholder
  const text = title || 'Groupe';
  const size = fitLine(text, n.w - 4 * PAD, hh * 0.62);
  ctx.font = '600 ' + size + 'px ' + FONT_FAMILY;
  ctx.fillText(text, n.x + n.w / 2, n.y + hh / 2);
  ctx.restore();
}

// '#rrggbb' -> 'rgba(r, g, b, a)'
function hexAlpha(hex, a) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return 'rgba(255,255,255,' + a + ')';
  return 'rgba(' + parseInt(m[1], 16) + ',' + parseInt(m[2], 16) + ',' + parseInt(m[3], 16) + ',' + a + ')';
}

function thumb(id) {
  let img = thumbs.get(id);
  if (!img) {
    img = new Image();
    img.onload = requestRender;
    img.src = ytThumb(id);
    thumbs.set(id, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

function drawContained(img, x, y, w, h) {
  const s = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawPlay(n) {
  if (isVideoPlaying(n.id)) return;
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2, r = Math.min(n.w, n.h) * 0.12;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy - r * 0.5);
  ctx.lineTo(cx - r * 0.35, cy + r * 0.5);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.closePath();
  ctx.fill();
}

function drawCaption(n, label) {
  const y = n.y + n.h - CAPTION;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(n.x, y, n.w, CAPTION);
  ctx.font = CAPTION_FONT;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(fit(firstLine(label), n.w - 2 * PAD), n.x + PAD, y + CAPTION / 2);
}

// Label tab above the block: a pill in the block colour (text black or white for contrast),
// a soft shadow, a ▶ icon on YouTube blocks. Blocks without a link have no label.
// Geometry comes from labels.js.
function drawLabel(n, zoom) {
  const L = labelLayout(n);
  if (!L) return; // no link and not a video: no label
  const r = L.h / 2;

  ctx.save();
  // Shadow blur and offset are in device pixels (not affected by the zoom transform).
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10 * dpr;
  ctx.shadowOffsetY = 2 * dpr;
  ctx.fillStyle = n.color;
  pillPath(L.x, L.y, L.w, L.h, r);
  ctx.fill();
  ctx.restore();

  pillPath(L.x, L.y, L.w, L.h, r);
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();

  const fg = textOn(n.color);
  const cy = L.y + L.h / 2;
  let tx = L.x + LABEL_PAD;
  if (L.segments) { drawProductSegments(L, tx, cy, fg); return; }
  if (L.icon) {
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(tx, cy - ICON * 0.55);
    ctx.lineTo(tx, cy + ICON * 0.55);
    ctx.lineTo(tx + ICON * 0.9, cy);
    ctx.closePath();
    ctx.fill();
    tx += ICON + ICON_GAP;
  }
  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(L.text, tx, cy);
}

// Amazon product label content: name | 🏷️ price | 🚚 delivery, with a thin divider between parts.
function drawProductSegments(L, tx, cy, fg) {
  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'middle';
  L.segments.forEach((s, i) => {
    if (i > 0) {
      const dx = tx + s.x - LABEL_SEP / 2;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(dx, L.y + L.h * 0.25);
      ctx.lineTo(dx, L.y + L.h * 0.75);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = fg;
    if (s.icon) ctx.fillText(s.icon, tx + s.x, cy);
    ctx.fillText(s.text, tx + s.x + s.iconW, cy);
  });
}

// Buttons just outside the right edge of a selected block: 📝 opens the edit popup (text and
// link), 🖼️ (image blocks) picks another image. They fade in and grow slightly (iconT = progress).
function drawEditIcon(n, zoom) {
  drawButton(editIconBox(n, zoom), '\u{1F4DD}', n.color, zoom);
  drawButton(colorIconBox(n, zoom), '\u{1F3A8}', n.color, zoom);
}

function drawImageIcon(n, zoom) {
  drawButton(imageIconBox(n, zoom), '\u{1F5BC}️', n.color, zoom);
}

// One round button (28 px) with an emoji, drawn in screen pixels, animated by iconT.
function drawButton(b, emoji, color, zoom) {
  const e = 1 - Math.pow(1 - iconT, 3); // ease-out
  const s = 0.6 + 0.4 * e;
  ctx.save();
  ctx.globalAlpha = e;
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
  ctx.scale(s / zoom, s / zoom); // local units are screen pixels, 28 px circle
  ctx.fillStyle = 'rgba(20,23,29,0.92)';
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 1);
  ctx.restore();
}

// Rounded rectangle path (pill when r = h / 2).
function pillPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
}

// '#000000' or '#ffffff', whichever has the higher WCAG contrast with the given #rrggbb colour.
function textOn(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
  if (!m) return '#000000';
  const lin = (c) => {
    const v = parseInt(c, 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(m[1]) + 0.7152 * lin(m[2]) + 0.0722 * lin(m[3]);
  return (L + 0.05) / 0.05 > 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
}

// Text of a text block: centred horizontally and vertically, font size auto-fitted.
function drawBlockText(text, n, color) {
  if (!text) return;
  const { size, lines } = fitText(text, n.w - 2 * TEXT_PAD, n.h - 2 * TEXT_PAD);
  const lh = size * LINE;
  const top = n.y + (n.h - lines.length * lh) / 2;
  ctx.font = size + 'px ' + FONT_FAMILY;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  // 'middle' baseline on each line's centre: the glyphs sit in the middle of their line box.
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, n.x + n.w / 2, top + (i + 0.5) * lh));
  ctx.textAlign = 'left';
}

function firstLine(text) { return String(text).split('\n')[0]; }

function fit(text, maxW, font = CAPTION_FONT) {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
