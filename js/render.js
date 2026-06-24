// Rendu du board : grille pixel, cercles, hexagones, rectangles, glow néon, sélection.
import { state, effectiveColor, sourceOf } from './state.js';
import { view, worldToScreen } from './camera.js';
import { stretch } from './physics.js';
import { hexCorners } from './geom.js';

const FONT = "'Press Start 2P', monospace";
const BG = '#0d0f12';

// Cache des images (data URL -> HTMLImageElement) pour ne pas recréer chaque frame.
const imgCache = new Map();
function getImg(src) {
  let img = imgCache.get(src);
  if (!img) { img = new Image(); img.src = src; imgCache.set(src, img); }
  return img;
}

export function render(ctx) {
  const { zoom } = state.camera;
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, view.w, view.h);

  drawGrid(ctx);

  // Zones (sous les rectangles) : cercles puis hexagones.
  for (const c of state.circles) drawCircle(ctx, c, c.id === state.selected);
  for (const h of state.hexagons) drawHexagon(ctx, h, h.id === state.selected);

  // Rectangles (au-dessus).
  for (const n of state.nodes) drawRect(ctx, n, effectiveColor(n), n.id === state.selected, zoom);
}

function drawHexagon(ctx, hgn, selected) {
  const p = worldToScreen(hgn.x, hgn.y);
  const R = hgn.r * state.camera.zoom;
  const pts = hexCorners(p.x, p.y, R);

  ctx.save();
  ctx.beginPath();
  pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
  ctx.closePath();
  ctx.fillStyle = hexToRgba(hgn.color, 0.08);
  ctx.fill();
  ctx.shadowColor = hgn.color;
  ctx.shadowBlur = selected ? 24 : 12;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = hgn.color;
  ctx.stroke();
  ctx.restore();

  if (hgn.description) {
    const fs = clamp(11 * state.camera.zoom, 7, 22);
    ctx.save();
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = hgn.color;
    ctx.shadowColor = hgn.color;
    ctx.shadowBlur = 8;
    ctx.fillText(hgn.description, p.x, p.y - R - 4);
    ctx.restore();
  }
}

function drawGrid(ctx) {
  const { x, y, zoom } = state.camera;
  const spacing = 48 * zoom;
  if (spacing < 6) return; // trop dézoomé : on masque la grille
  const ox = ((-x * zoom + view.w / 2) % spacing + spacing) % spacing;
  const oy = ((-y * zoom + view.h / 2) % spacing + spacing) % spacing;
  ctx.fillStyle = '#1a1f26';
  const s = Math.max(1, Math.round(zoom)); // gros points = pixel
  for (let gx = ox; gx < view.w; gx += spacing) {
    for (let gy = oy; gy < view.h; gy += spacing) {
      ctx.fillRect(Math.round(gx), Math.round(gy), s, s);
    }
  }
}

function drawCircle(ctx, c, selected) {
  const p = worldToScreen(c.x, c.y);
  const r = c.r * state.camera.zoom;

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(c.color, 0.08);
  ctx.fill();

  ctx.shadowColor = c.color;
  ctx.shadowBlur = selected ? 24 : 12;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = c.color;
  ctx.stroke();
  ctx.restore();

  // Description en haut du cercle.
  if (c.description) {
    const fs = clamp(11 * state.camera.zoom, 7, 22);
    ctx.save();
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = c.color;
    ctx.shadowColor = c.color;
    ctx.shadowBlur = 8;
    ctx.fillText(c.description, p.x, p.y - r + fs * 0.2 - 4);
    ctx.restore();
  }
}

function drawRect(ctx, n, color, selected, zoom) {
  // Liens : contenu dérivé de la source.
  const isLink = !!n.ref;
  const src = isLink ? sourceOf(n) : null;
  const text = isLink ? (src ? src.text : '') : n.text;
  const image = isLink ? (src ? src.image : null) : n.image;

  // Position rendue (physique) + centre.
  const rx = n._rx !== undefined ? n._rx : n.x;
  const ry = n._ry !== undefined ? n._ry : n.y;
  const cx = rx + n.w / 2;
  const cy = ry + n.h / 2;
  const p = worldToScreen(cx, cy);
  const w = n.w * zoom;
  const h = n.h * zoom;

  const st = stretch(n);

  ctx.save();
  ctx.translate(p.x, p.y);
  // Squash/stretch directionnel.
  if (st.sx !== 1 || st.sy !== 1) {
    ctx.rotate(st.angle);
    ctx.scale(st.sx, st.sy);
    ctx.rotate(-st.angle);
  }

  // Corps.
  ctx.shadowColor = color;
  ctx.shadowBlur = selected ? 22 : 10;
  ctx.fillStyle = '#11151a';
  ctx.fillRect(-w / 2, -h / 2, w, h);

  // Image éventuelle (cover-fit, clippée au rectangle).
  if (image) {
    const img = getImg(image);
    if (img.complete && img.naturalWidth) {
      ctx.save();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.clip();
      const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();
    }
  }

  // Bordure (pointillés pour un lien).
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = color;
  if (isLink) ctx.setLineDash([6 * zoom, 4 * zoom]);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);

  // Texte.
  if (text) {
    const fs = clamp(11 * zoom, 6, 26);
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawWrapped(ctx, text, w - 16 * zoom, fs);
  }
  ctx.restore();
}

function drawWrapped(ctx, text, maxW, fs) {
  const lineH = fs * 1.5;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  const startY = -((lines.length - 1) * lineH) / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, 0, startY + i * lineH));
}

// ---- utils ----
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
