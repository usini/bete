import { xtoolSummary } from './xtool.js?v=mw560w8m';
import { applicationAllowed, applicationEvents } from './applications.js?v=mw560w8m';
import { githubRepository, cleanGitHubData } from './github-repo.js?v=mw560w8m';
import { dropPreviewGroup } from './placement.js?v=mw560w8m';
import { externalMode } from './external-board.js?v=mw560w8m';
import { positionEmbeds } from './embed-view.js?v=mw560w8m';
// Canvas drawing: grid, blocks (text / image / YouTube thumbnail), labels, snap guides, selection.
import { state, events, getSelectedId, groupsBySize, groupHeaderHeight, groupHeaderBox } from './state.js?v=mw560w8m';
import { view, screenToWorld } from './camera.js?v=mw560w8m';
import { youTubeId, ytThumb } from './yt.js?v=mw560w8m';
import { imageCaptionFraction, imageFor } from './images.js?v=mw560w8m';
import { positionVideo, isVideoPlaying } from './video.js?v=mw560w8m';
import { guides } from './snap.js?v=mw560w8m';
import { renderMinimap } from './minimap.js?v=mw560w8m';
import { updateFx, renderFx, hasParticles } from './fx.js?v=mw560w8m';
import { fitText, fitLine, TEXT_PAD, LINE, FONT_FAMILY } from './text.js?v=mw560w8m';
import { labelLayout, editIconBox, colorIconBox, imageIconBox, shareIconBox, deleteIconBox, optimizeIconBox, setLabelRedraw, LABEL_FONT, LABEL_SEP, ICON, ICON_GAP, LABEL_PAD } from './labels.js?v=mw560w8m';

import { genericLinkOf, plainLink } from './links.js?v=mw560w8m';
import { stepMotion } from './motion.js?v=mw560w8m';
import { remoteCursors, shareEvents, isGroupShared } from './group-share.js?v=mw560w8m';

import { isLocked } from './mobile-mode.js?v=mw560w8m';

import { serviceForNode, serviceIcon } from './services.js?v=mw560w8m';
import { amazonBadgeLayout } from './amazon.js?v=mw560w8m';

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const PAD = 10;         // inner padding of image blocks, in world units

let dpr = 1;
let scheduled = false;
let previousFrame = performance.now();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
shareEvents.addEventListener('presence', () => requestRender());
shareEvents.addEventListener('change', () => requestRender());
reducedMotion.addEventListener('change', () => requestRender());
document.addEventListener('visibilitychange', () => requestRender());
let sharedGlowVisible = false;
const thumbs = new Map(); // youtube id -> HTMLImageElement
const ICON_ANIM_MS = 220;  // appearance animation of the 📝 button
let iconSelId = null;      // selection the animation was started for
let iconStart = 0;         // when that selection happened
let iconT = 1;             // animation progress, 0 -> 1

setLabelRedraw(() => requestRender());
applicationEvents.addEventListener('change', requestRender);

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
  const now = performance.now();
  const dt = Math.min(0.04, (now - previousFrame) / 1000);
  previousFrame = now;
  let moving = false;
  sharedGlowVisible = false;
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
  for (const n of state.nodes) if (n.kind !== 'group') {
    const m = stepMotion(n, dt);
    moving ||= m.active;
    ctx.save();
    if (!reducedMotion.matches && !isVideoPlaying(n.id)) {
      ctx.translate(m.dx + n.x + n.w / 2, m.dy + n.y + n.h / 2);
      ctx.rotate(m.angle); ctx.scale(1 + m.stretch, 1 - m.stretch); ctx.rotate(-m.angle);
      ctx.translate(-n.x - n.w / 2, -n.y - n.h / 2);
    }
    drawNode(n, n.id === selId, zoom);
    ctx.restore();
  }
  const cursorMoving = drawRemoteCursors(zoom);
  renderFx(ctx); // deletion animation, above the blocks
  drawGuides(zoom);
  drawDropPreview(zoom);
  positionVideo();
  if (!externalMode) positionEmbeds();
  renderMinimap();
  // Keep animating until the 📝 button is fully shown and the deletion pieces are gone.
  if (iconT < 1 || hasParticles() || sharedGlowVisible || ((moving || cursorMoving) && !reducedMotion.matches)) requestRender();
}

function drawRemoteCursors(zoom) {
  let moving = false;
  for (const cursor of remoteCursors(!reducedMotion.matches)) {
    moving ||= cursor.moving;
    ctx.save();
    ctx.translate(cursor.x, cursor.y); ctx.scale(1 / zoom, 1 / zoom);
    ctx.fillStyle = cursor.color; ctx.strokeStyle = '#0c0e12'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(4, 19); ctx.lineTo(9, 13); ctx.lineTo(16, 11); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.font = '11px ' + FONT_FAMILY; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const width = ctx.measureText(cursor.label).width;
    ctx.fillStyle = '#14171dee'; ctx.fillRect(13, 19, width + 12, 21);
    ctx.fillStyle = cursor.color; ctx.fillText(cursor.label, 19, 29);
    ctx.restore();
  }
  return moving;
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
  const service = serviceForNode(n);
  const repository = n.kind === 'rect' ? githubRepository(n.link || n.text) : null;
  const yt = service || n.image ? null : youTubeId(n.text);
  if (n.color !== 'transparent') {
    ctx.fillStyle = '#14171d';
    ctx.fillRect(n.x, n.y, n.w, n.h);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(n.x, n.y, n.w, n.h);
  ctx.clip();
  const appIcon = service && !n.image ? serviceIcon(service, requestRender) : null;
  const link = genericLinkOf(n);
  const linkTitle = link ? ((!plainLink(n.text) && n.text.trim()) || new URL(link).hostname) : '';
  const src = yt && !externalMode ? thumb(yt) : n.image ? imageFor(n.image, requestRender) : null;
  const captionHeight = !yt && src ? n.h * imageCaptionFraction(n) : 0;
  if (n.xtool) {
    drawXtoolBlock(n);
  } else if (n.application) {
    drawApplicationBlock(n);
  } else if (src) {
    const pad = yt ? PAD : 0;
    const areaH = n.h - 2 * pad - captionHeight;
    if (areaH > 0) drawContained(src, n.x + pad, n.y + pad, n.w - 2 * pad, areaH);
    if (yt) drawPlay(n);
    if (captionHeight) drawCaption(n, n.text, captionHeight);
  } else if (repository && !n.image) {
    drawRepositoryCard(n, repository, appIcon);
  } else if (service && !n.image) {
    const label = (!plainLink(n.text) && n.text.trim()) || service.name;
    if (appIcon) {
      const height = n.h * 0.16;
      drawContained(appIcon, n.x, n.y, n.w, n.h - height);
      drawCaption(n, label, height);
    } else drawBlockText(label, n, '#e8e8e8');
  } else if (linkTitle && !n.image) {
    drawBlockText(linkTitle, n, '#e8e8e8');
  } else if (!yt && n.kind !== 'image') {
    // Image blocks show no text: they only show their picture (changed with the 🖼️ button).
    drawBlockText(n.text, n, '#e8e8e8');
  }
  ctx.restore();

  if (n.color !== 'transparent') {
    ctx.lineWidth = 4;
    ctx.strokeStyle = n.color;
    ctx.strokeRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);
  }

  drawSelection(n, selected, zoom);
  drawLabel(n, zoom);
  drawAmazonBadge(n);
}

// A local brand tag outside the product image, aligned with the block's top-left edge.
function drawAmazonBadge(n) {
  const badge = amazonBadgeLayout(n);
  if (!badge) return;
  const { x, y, w, h } = badge;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, w, h);
  const icon = serviceIcon({ id: 'amazon' }, requestRender);
  if (icon) drawContained(icon, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76);
}

// Selection outline, resize handle and action buttons of the selected block.
function drawSelection(n, selected, zoom) {
  if (!selected || isLocked()) return;
  ctx.save();
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(n.x - 4, n.y - 4, n.w + 8, n.h + 8);
  ctx.restore();
  const hs = 10 / zoom; // resize handle, bottom-right corner
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(n.x + n.w - hs / 2, n.y + n.h - hs / 2, hs, hs);
  drawButton(deleteIconBox(n, zoom), '\u{1F5D1}️', '#ff7777', zoom);
  if (n.image) drawButton(optimizeIconBox(n, zoom), n.keepImageOriginal ? '🔒' : '🔓', n.keepImageOriginal ? '#ffcb6b' : n.color, zoom);
  drawEditIcon(n, zoom);
  if (n.kind === 'image') drawImageIcon(n, zoom);
  if (n.kind === 'group') drawButton(shareIconBox(n, zoom), 'qr', n.color, zoom);
}

// Group: a translucent area in its colour, with a header bar at the top holding the title
// (centred, black or white for contrast). Drawn under the other blocks.
// The header grows with the group (22 % of its height, between 64 and 220), and the title is as
// big as fits on one line: a big group stays readable when zoomed out.
function drawGroup(n) {
  ctx.fillStyle = n.color === 'transparent' ? 'transparent' : hexAlpha(n.color, 0.16);
  ctx.fillRect(n.x, n.y, n.w, n.h);
  const header = groupHeaderBox(n);
  const hh = header.h;
  ctx.fillStyle = n.color === 'transparent' ? '#ffffff' : n.color;
  ctx.fillRect(n.x, header.y, n.w, hh);
  if (n.color !== 'transparent') {
    ctx.lineWidth = 4;
    ctx.strokeStyle = n.color;
    ctx.strokeRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);
  }

  const title = firstLine(n.text).trim();
  ctx.save();
  ctx.beginPath();
  ctx.rect(n.x, header.y, n.w, hh);
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textOn(n.color === 'transparent' ? '#ffffff' : n.color);
  if (!title) ctx.globalAlpha = 0.45; // placeholder
  const text = title || 'Groupe';
  // Follow the visible header height instead of shrinking the whole title to fit.
  const size = hh * 0.62;
  ctx.font = '600 ' + size + 'px ' + FONT_FAMILY;
  const available = Math.max(0, n.w - 2 * Math.min(n.w * 0.04, 8 / state.camera.zoom));
  let label = text;
  if (ctx.measureText(label).width > available) {
    let low = 0, high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(text.slice(0, mid) + '…').width <= available) low = mid;
      else high = mid - 1;
    }
    label = ctx.measureText('…').width <= available ? text.slice(0, low) + '…' : '';
  }
  ctx.fillText(label, n.x + n.w / 2, header.y + hh / 2);
  ctx.restore();
  if (isGroupShared(n)) drawSharedGlow(n);
}

// Rotating blue highlight and halo, inspired by liyrofx's CSS Glow Border Animation:
// https://codepen.io/liyrofx/pen/poVZeEG — rendered locally, with no external dependencies.
function drawSharedGlow(n) {
  if (document.hidden) return;
  const z = state.camera.zoom, c = state.camera;
  if (n.x + n.w < c.x - view.w / (2 * z) || n.x > c.x + view.w / (2 * z) ||
      n.y + n.h < c.y - view.h / (2 * z) || n.y > c.y + view.h / (2 * z)) return;
  const angle = reducedMotion.matches ? 0 : performance.now() * Math.PI * 2 / 4000;
  const glow = ctx.createConicGradient(angle, n.x + n.w / 2, n.y + n.h / 2);
  glow.addColorStop(0, 'rgba(25,118,237,0)');
  glow.addColorStop(0.09, '#1976ed');
  glow.addColorStop(0.25, 'rgba(25,118,237,0)');
  glow.addColorStop(1, 'rgba(25,118,237,0)');
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineWidth = 10 / z;
  ctx.shadowColor = '#1976ed';
  ctx.shadowBlur = 32 * dpr;
  ctx.strokeRect(n.x + 2, n.y + 2, n.w - 4, n.h - 4);
  ctx.restore();
  if (!reducedMotion.matches) sharedGlowVisible = true;
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

function drawCaption(n, label, height) {
  const y = n.y + n.h - height;
  const pad = Math.min(n.w * 0.05, height * 0.3);
  const text = label.trim().replace(/\s+/g, ' ');
  const maxWidth = n.w - 2 * pad;
  const maxSize = Math.min(height * 0.72, n.w * 0.18);
  ctx.font = maxSize + 'px ' + FONT_FAMILY;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth) ctx.font = (maxSize * maxWidth / measured) + 'px ' + FONT_FAMILY;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(n.x, y, n.w, height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e8e8e8';
  ctx.fillText(text, n.x + n.w / 2, y + height / 2, maxWidth);
}

// Label tab above the block: a pill in the block colour (text black or white for contrast),
// a soft shadow, a ▶ icon on YouTube blocks. Blocks without a link have no label.
// Geometry comes from labels.js.
function drawLabel(n, zoom) {
  const L = labelLayout(n);
  if (!L) return; // no link and not a video: no label
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.scale(L.scale, L.scale);
  drawScaledLabel(n, { ...L, x: 0, y: 0, w: L.w / L.scale, h: L.h / L.scale }, zoom * L.scale);
  ctx.restore();
}

function drawScaledLabel(n, L, zoom) {
  const r = L.h / 2;

  ctx.save();
  // Shadow blur and offset are in device pixels (not affected by the zoom transform).
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 10 * dpr;
  ctx.shadowOffsetY = 2 * dpr;
  ctx.fillStyle = n.color === 'transparent' ? '#ffffff' : n.color;
  pillPath(L.x, L.y, L.w, L.h, r);
  ctx.fill();
  ctx.restore();

  pillPath(L.x, L.y, L.w, L.h, r);
  ctx.lineWidth = 2 / zoom;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();

  const fg = textOn(n.color === 'transparent' ? '#ffffff' : n.color);
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
  ctx.strokeStyle = color === 'transparent' ? '#ffffff' : color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (emoji === 'qr') {
    ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1.5;
    for (const [x, y] of [[-7, -7], [2, -7], [-7, 2]]) {
      ctx.strokeRect(x, y, 5, 5); ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + 2, y + 2, 1, 1);
    }
    ctx.fillStyle = '#e8e8e8';
    for (const [x, y] of [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]]) ctx.fillRect(x, y, 2, 2);
  } else ctx.fillText(emoji, 0, 1);
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

function drawDropPreview(zoom) {
  const group = dropPreviewGroup;
  if (!group || isLocked() || !state.nodes.includes(group)) return;
  ctx.save();
  ctx.fillStyle = '#39ff1418';
  ctx.fillRect(group.x, group.y, group.w, group.h);
  ctx.strokeStyle = '#39ff14';
  ctx.lineWidth = 3 / zoom;
  ctx.setLineDash([8 / zoom, 5 / zoom]);
  ctx.strokeRect(group.x, group.y, group.w, group.h);
  ctx.setLineDash([]);
  const text = '＋ Ajouter au groupe';
  ctx.font = '600 ' + 14 / zoom + 'px ' + FONT_FAMILY;
  const width = ctx.measureText(text).width + 20 / zoom;
  const x = group.x + (group.w - width) / 2, y = group.y - 34 / zoom;
  ctx.fillStyle = '#39ff14';
  ctx.fillRect(x, y, width, 26 / zoom);
  ctx.fillStyle = '#10200c';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + width / 2, y + 13 / zoom);
  ctx.restore();
}

function drawXtoolBlock(n) {
  const lines = xtoolSummary(n.xtool).split('\n');
  const colors = { Puissance: '#943d30', Vitesse: '#175d83', Passages: '#67469a', DPI: '#28654b', Épaisseur: '#795820', Tramage: '#67469a', Mode: '#175d83', 'Durée du point': '#795820', Fréquence: '#28654b', 'Plage puissance': '#943d30', Traitement: '#943d30', 'Source laser': '#465568' };
  const pad = Math.min(n.w, n.h) * .07;
  const width = n.w - pad * 2;
  const row = (n.h - pad * 2) / lines.length;
  let font = row * .48;
  ctx.save();
  ctx.font = `600 ${font}px ${FONT_FAMILY}`;
  const longest = Math.max(...lines.map(line => ctx.measureText(line).width + font * 1.7));
  font *= Math.min(1, width / longest);
  ctx.font = `600 ${font}px ${FONT_FAMILY}`;
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    const y = n.y + pad + row * (i + .5);
    const separator = line.indexOf(' : ');
    if (separator < 0) {
      ctx.fillStyle = i === 0 ? '#ffffff' : '#b9c7d3';
      ctx.textAlign = 'center';
      ctx.fillText(line, n.x + n.w / 2, y);
      return;
    }
    const label = line.slice(0, separator), value = line.slice(separator + 3);
    const pill = ctx.measureText(label).width + font;
    const total = pill + font * .5 + ctx.measureText(': ' + value).width;
    const x = n.x + (n.w - total) / 2;
    ctx.fillStyle = colors[label] || '#465568';
    ctx.beginPath();ctx.roundRect(x, y - font * .8, pill, font * 1.6, font * .8);ctx.fill();
    ctx.textAlign = 'left';ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + font * .5, y);
    ctx.fillText(': ' + value, x + pill + font * .5, y);
  });
  ctx.restore();
}

function drawRepositoryCard(n, repo, icon) {
  const data=cleanGitHubData(n.github,n.link||n.text);
  if(!data){
    const height=n.h*.2;
    if(icon)drawContained(icon,n.x+n.w*.08,n.y+n.h*.06,n.w*.84,n.h-height-n.h*.1);
    drawCaption(n,repo.key,height);return;
  }
  const pad=Math.min(n.w,n.h)*.06;
  if(icon)drawContained(icon,n.x+pad,n.y+pad,n.w*.14,n.h*.18);
  drawBlockText(repo.key,{x:n.x+n.w*.22,y:n.y+pad,w:n.w*.72-pad,h:n.h*.18},'#f2f2f2');
  drawBlockText(data.description||'Dépôt public GitHub',{x:n.x+pad,y:n.y+n.h*.28,w:n.w-2*pad,h:n.h*.35},'#dedee5');
  const details=[data.language,data.license,'★ '+data.stars.toLocaleString('fr-FR'),data.release?'Version '+data.release:'',data.pushedAt?'Activité : '+new Date(data.pushedAt).toLocaleDateString('fr-FR'):''].filter(Boolean).join(' · ');
  drawBlockText(details,{x:n.x+pad,y:n.y+n.h*.69,w:n.w-2*pad,h:n.h*.25},'#a8cbd5');
}

function drawApplicationBlock(n) {
  const size=Math.min(n.w*.55,n.h*.55),x=n.x+(n.w-size)/2,y=n.y+n.h*.08;
  const icon=n.application.icon && imageFor(n.application.icon, requestRender);
  if (icon) drawContained(icon,x,y,size,size);
  else {
  ctx.fillStyle='#dce9f3';
  ctx.fillRect(x,y,size,size);ctx.fillStyle='#1d3545';
  ctx.fillRect(x+size*.12,y+size*.24,size*.76,size*.64);
  ctx.fillStyle='#dce9f3';ctx.fillRect(x+size*.22,y+size*.38,size*.2,size*.2);
  }
  drawCaption(n,n.application.label,n.h*.23);
  if(!applicationAllowed(n)){
    ctx.save();ctx.strokeStyle='#ff3030';ctx.lineWidth=Math.max(2,Math.min(n.w,n.h)*.045);ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+size,y+size);ctx.moveTo(x+size,y);ctx.lineTo(x,y+size);ctx.stroke();ctx.restore();
  }
}
