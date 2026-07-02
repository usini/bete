// Board rendering: pixel grid, circles, hexagons, rectangles, neon glow, selection.
import { state, effectiveColor, sourceOf, displayLink } from './state.js?v=mr3rtn0v';
import { view, worldToScreen } from './camera.js?v=mr3rtn0v';
import { stretch } from './physics.js?v=mr3rtn0v';
import { hexCorners } from './geom.js?v=mr3rtn0v';
import { theme, getTextScale, nodeStyle, toneColor } from './theme.js?v=mr3rtn0v';
import { fmtDur } from './voice.js?v=mr3rtn0v';
import { getCursors, getPresence } from './sync.js?v=mr3rtn0v';
import { youTubeId, ytThumb } from './yt.js?v=mr3rtn0v';
import { getImageEl } from './images.js?v=mr3rtn0v';
import { t } from './i18n.js?v=mr3rtn0v';

const FONT = () => theme().font;
const GLOW = () => theme().glow;

// <img> element for a render source. Delegates to images.js which handles
// legacy data URLs, http URLs (YouTube thumbnails) and 'idb:<hash>' refs (IndexedDB + peers).
function getImg(src) { return getImageEl(src); }

export function render(ctx) {
  const { zoom } = state.camera;
  ctx.fillStyle = theme().bg;
  ctx.fillRect(0, 0, view.w, view.h);

  drawGrid(ctx);

  // Zones (below the rectangles): circles then hexagons.
  for (const c of state.circles) drawCircle(ctx, c, isSel(c.id));
  for (const h of state.hexagons) drawHexagon(ctx, h, isSel(h.id));

  // Rectangles, signs & liaison blocks (on top).
  for (const n of state.nodes) {
    if (n.kind === 'liaison') drawLiaison(ctx, n, isSel(n.id), zoom);
    else if (n.kind === 'pancarte') drawPancarte(ctx, n, isSel(n.id), zoom);
    else if (n.kind === 'voice') drawVoice(ctx, n, isSel(n.id), zoom);
    else drawRect(ctx, n, effectiveColor(n), isSel(n.id), zoom);
  }

  drawCursors(ctx); // other users' cursors (above everything)
}

// Stable color derived from the user id.
function uidColor(uid) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) % 360;
  return `hsl(${h}, 80%, 55%)`;
}

const cursorRender = {}; // uid -> { rx, ry } smoothed position (A->B animation)

function drawCursors(ctx) {
  const list = getCursors();
  const speaking = {};
  getPresence().forEach((u) => { if (u.voice) speaking[u.uid] = 1; });
  const seen = {};
  for (const c of list) {
    seen[c.uid] = 1;
    // Smoothing: the rendered position eases towards the last received position.
    let cr = cursorRender[c.uid];
    if (!cr) cr = cursorRender[c.uid] = { rx: c.x, ry: c.y };
    cr.rx += (c.x - cr.rx) * 0.25;
    cr.ry += (c.y - cr.ry) * 0.25;
    if (Math.abs(c.x - cr.rx) < 0.5) cr.rx = c.x;
    if (Math.abs(c.y - cr.ry) < 0.5) cr.ry = c.y;
    const p = worldToScreen(cr.rx, cr.ry);
    if (p.x < -40 || p.y < -40 || p.x > view.w + 40 || p.y > view.h + 40) continue;
    const col = uidColor(c.uid);
    // Cursor arrow.
    ctx.save();
    ctx.fillStyle = col;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + 17);
    ctx.lineTo(p.x + 4.5, p.y + 13);
    ctx.lineTo(p.x + 11, p.y + 13);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    // Name label (prefixed with 🎤 if the person is talking).
    const name = (speaking[c.uid] ? '🎤 ' : '') + (c.name || t('liaison.guest'));
    ctx.font = '11px ' + (theme().pixel ? "'Press Start 2P', monospace" : "'Segoe UI', sans-serif");
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(name).width;
    const lx = p.x + 12, ly = p.y + 16;
    ctx.fillStyle = col;
    ctx.fillRect(lx, ly, tw + 10, 18);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2;
    ctx.fillText(name, lx + 5, ly + 4);
    ctx.restore();
  }
  for (const uid in cursorRender) if (!seen[uid]) delete cursorRender[uid]; // purge those who left
}

// Selection: current id OR membership in the multi-selection.
function isSel(id) {
  return id === state.selected || (state.selectedIds && state.selectedIds.indexOf(id) !== -1);
}

// Sign: a larger rectangle with a wood texture and engraved text.
function drawPancarte(ctx, n, selected, zoom) {
  const rx = n._rx !== undefined ? n._rx : n.x;
  const ry = n._ry !== undefined ? n._ry : n.y;
  const p = worldToScreen(rx + n.w / 2, ry + n.h / 2);
  const w = n.w * zoom, h = n.h * zoom;
  const st = stretch(n);

  ctx.save();
  ctx.translate(p.x, p.y);
  if (st.sx !== 1 || st.sy !== 1) {
    ctx.rotate(st.angle);
    ctx.scale(st.sx, st.sy);
    ctx.rotate(-st.angle);
  }

  // Classic themes: sign = yellow post-it (instead of wood).
  if (!theme().pixel) {
    drawPostit(ctx, n, selected, zoom, w, h);
    ctx.restore();
    return;
  }

  // Wood planks (clipped to the rectangle).
  ctx.shadowColor = '#000';
  ctx.shadowBlur = selected ? 20 : 8;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-w / 2, -h / 2, w, h);
  ctx.clip();
  const shades = ['#6b4a2b', '#5c3f24', '#74522f'];
  const planks = 3;
  const ph = h / planks;
  for (let i = 0; i < planks; i++) {
    const top = -h / 2 + i * ph;
    ctx.fillStyle = shades[i % shades.length];
    ctx.fillRect(-w / 2, top, w, ph);
    ctx.fillStyle = '#3d2917'; // plank seam
    ctx.fillRect(-w / 2, top, w, Math.max(1, 2 * zoom));
    ctx.strokeStyle = 'rgba(40,25,12,0.4)'; // wood grain
    ctx.lineWidth = Math.max(1, zoom);
    for (let g = 0; g < 2; g++) {
      const gy = top + ph * (0.35 + g * 0.35);
      ctx.beginPath();
      ctx.moveTo(-w / 2, gy);
      ctx.lineTo(w / 2, gy + (g ? -3 : 3) * zoom);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Frame + nails + selection outline.
  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = '#3d2917';
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  if (selected) {
    ctx.strokeStyle = theme().accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  }
  ctx.fillStyle = '#2a1a0e';
  const nail = Math.max(2, 3 * zoom), off = 9 * zoom;
  [[-w / 2 + off, -h / 2 + off], [w / 2 - off, -h / 2 + off], [-w / 2 + off, h / 2 - off], [w / 2 - off, h / 2 - off]]
    .forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, nail, 0, Math.PI * 2); ctx.fill(); });

  // Engraved text (light with a dark shadow).
  if (n.text) {
    const baseFs = 13 * zoom * getTextScale();
    ctx.fillStyle = '#f3e3c0';
    ctx.shadowColor = '#2a1a0e';
    ctx.shadowOffsetX = 1.5 * zoom;
    ctx.shadowOffsetY = 1.5 * zoom;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawFitted(ctx, n.text, w - 22 * zoom, h - 22 * zoom, baseFs);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();
}

// Post-it style sign (classic themes): yellow background, folded corner, dark text.
function drawPostit(ctx, n, selected, zoom, w, h) {
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = selected ? 16 : 8;
  ctx.shadowOffsetX = 2 * zoom; ctx.shadowOffsetY = 3 * zoom;
  ctx.fillStyle = '#ffe066'; // post-it yellow
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;

  // Slightly darker top band (stuck-on effect).
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  ctx.fillRect(-w / 2, -h / 2, w, Math.max(4, h * 0.16));
  // Folded bottom-right corner.
  const fold = Math.min(w, h) * 0.18;
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.moveTo(w / 2 - fold, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(w / 2, h / 2 - fold);
  ctx.closePath(); ctx.fill();

  if (selected) {
    ctx.strokeStyle = theme().accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
  }

  if (n.text) {
    const baseFs = 13 * zoom * getTextScale();
    ctx.fillStyle = '#3a2f00'; // dark ink
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawFitted(ctx, n.text, w - 22 * zoom, h - 22 * zoom, baseFs);
  }
}

// P2P liaison block: QR code + status. Click = copies the link.
function ensureQR(n) {
  if (!n.url || !window.qrcode || n._qrUrl === n.url) return;
  try {
    const qr = window.qrcode(0, 'M');
    qr.addData(n.url);
    qr.make();
    const cnt = qr.getModuleCount();
    const mods = [];
    for (let r = 0; r < cnt; r++) {
      const row = [];
      for (let c = 0; c < cnt; c++) row.push(qr.isDark(r, c));
      mods.push(row);
    }
    n._qrMods = mods;
    n._qrUrl = n.url;
  } catch (e) { /* lib not ready yet */ }
}

function drawLiaison(ctx, n, selected, zoom) {
  const accent = theme().accent;
  const rx = n._rx !== undefined ? n._rx : n.x;
  const ry = n._ry !== undefined ? n._ry : n.y;
  const p = worldToScreen(rx + n.w / 2, ry + n.h / 2);
  const w = n.w * zoom, h = n.h * zoom;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = accent;
  ctx.shadowBlur = (selected ? 22 : 12) * GLOW();
  ctx.fillStyle = theme().nodeBg;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = accent;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;

  ensureQR(n);
  const pad = w * 0.1;
  const qrSide = w - pad * 2;
  const qrX = -qrSide / 2, qrY = -h / 2 + pad;

  if (n._qrMods) {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(qrX - 3, qrY - 3, qrSide + 6, qrSide + 6);
    const cnt = n._qrMods.length;
    const ms = qrSide / cnt;
    ctx.fillStyle = '#0d0f12';
    for (let r = 0; r < cnt; r++) {
      for (let c = 0; c < cnt; c++) {
        if (n._qrMods[r][c]) {
          ctx.fillRect(Math.floor(qrX + c * ms), Math.floor(qrY + r * ms), Math.ceil(ms), Math.ceil(ms));
        }
      }
    }
  } else {
    ctx.fillStyle = '#1a1f26';
    ctx.fillRect(qrX, qrY, qrSide, qrSide);
    ctx.fillStyle = accent;
    ctx.font = `${clamp(10 * zoom, 7, 16)}px ${FONT()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('...', 0, qrY + qrSide / 2);
  }

  const now = performance.now();
  let label;
  if (n._copiedUntil && now < n._copiedUntil) label = t('liaisonBlock.copied');
  else if (n.status === 'connected') label = t('liaisonBlock.connected');
  else if (n.status === 'online') label = t('liaisonBlock.online');
  else if (n.status === 'error') label = t('liaisonBlock.error');
  else label = t('liaisonBlock.connecting');

  const fs = clamp(8 * zoom, 6, 13);
  ctx.fillStyle = accent;
  ctx.shadowColor = accent;
  ctx.shadowBlur = 6 * GLOW();
  ctx.font = `${fs}px ${FONT()}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, (qrY + qrSide + h / 2) / 2);
  ctx.restore();
}

// Voice memo block: play/pause button + duration + progress bar.
function drawVoice(ctx, n, selected, zoom) {
  const color = effectiveColor(n);
  const stl = nodeStyle(color);
  const rx = n._rx !== undefined ? n._rx : n.x;
  const ry = n._ry !== undefined ? n._ry : n.y;
  const p = worldToScreen(rx + n.w / 2, ry + n.h / 2);
  const w = n.w * zoom, h = n.h * zoom;
  const st = stretch(n);

  ctx.save();
  ctx.translate(p.x, p.y);
  if (st.sx !== 1 || st.sy !== 1) { ctx.rotate(st.angle); ctx.scale(st.sx, st.sy); ctx.rotate(-st.angle); }

  ctx.shadowColor = color;
  ctx.shadowBlur = (selected ? 22 : 10) * GLOW();
  ctx.fillStyle = stl.fill;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = stl.border;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;

  // Play / pause button (circle on the left).
  const r = Math.min(w, h) * 0.28;
  const bx = -w / 2 + r + 10 * zoom, by = 0;
  ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2);
  ctx.fillStyle = stl.text; ctx.fill();
  ctx.fillStyle = stl.fill;
  if (n._playing) { // two bars = pause
    const bw = r * 0.26, bh = r * 0.9;
    ctx.fillRect(bx - bw * 1.4, by - bh / 2, bw, bh);
    ctx.fillRect(bx + bw * 0.4, by - bh / 2, bw, bh);
  } else { // triangle = play
    ctx.beginPath();
    ctx.moveTo(bx - r * 0.35, by - r * 0.5);
    ctx.lineTo(bx + r * 0.55, by);
    ctx.lineTo(bx - r * 0.35, by + r * 0.5);
    ctx.closePath(); ctx.fill();
  }

  // Text (duration or warning) + progress bar.
  const tx = bx + r + 10 * zoom;
  const fs = clamp(11 * zoom * getTextScale(), 7, 22);
  ctx.font = `${fs}px ${FONT()}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = stl.text;
  ctx.shadowColor = color; ctx.shadowBlur = 4 * GLOW();
  ctx.fillText(n._loading ? t('voiceBlock.loading') : (n._missing ? t('voiceBlock.missing') : ('♪ ' + fmtDur(n.dur || 0))), tx, -h * 0.16);
  ctx.shadowBlur = 0;

  const barX = tx, barW = w / 2 - 10 * zoom - barX, barY = h * 0.18, barH = Math.max(3, 5 * zoom);
  if (barW > 4) {
    ctx.fillStyle = hexToRgba(stl.text, 0.25);
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = stl.text;
    ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, n._prog || 0)), barH);
  }
  ctx.restore();
}

function drawHexagon(ctx, hgn, selected) {
  const p = worldToScreen(hgn.x, hgn.y);
  const R = hgn.r * state.camera.zoom;
  const pts = hexCorners(p.x, p.y, R);
  const col = toneColor(hgn.color);

  ctx.save();
  ctx.beginPath();
  pts.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y)));
  ctx.closePath();
  ctx.fillStyle = hexToRgba(col, 0.08);
  ctx.fill();
  ctx.shadowColor = col;
  ctx.shadowBlur = (selected ? 24 : 12) * GLOW();
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.restore();

  if (hgn.description) {
    const fs = clamp(16 * state.camera.zoom * getTextScale(), 11, 48);
    ctx.save();
    ctx.font = `${fs}px ${FONT()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 * GLOW();
    ctx.fillText(hgn.description, p.x, p.y - R - 4);
    ctx.restore();
  }
}

function drawGrid(ctx) {
  const { x, y, zoom } = state.camera;
  const spacing = 48 * zoom;
  if (spacing < 6) return; // too zoomed out: hide the grid
  const ox = ((-x * zoom + view.w / 2) % spacing + spacing) % spacing;
  const oy = ((-y * zoom + view.h / 2) % spacing + spacing) % spacing;
  ctx.fillStyle = theme().grid;
  const s = Math.max(1, Math.round(zoom)); // big dots = pixelated
  for (let gx = ox; gx < view.w; gx += spacing) {
    for (let gy = oy; gy < view.h; gy += spacing) {
      ctx.fillRect(Math.round(gx), Math.round(gy), s, s);
    }
  }
}

function drawCircle(ctx, c, selected) {
  const p = worldToScreen(c.x, c.y);
  const r = c.r * state.camera.zoom;
  const col = toneColor(c.color);

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexToRgba(col, 0.08);
  ctx.fill();

  ctx.shadowColor = col;
  ctx.shadowBlur = (selected ? 24 : 12) * GLOW();
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = col;
  ctx.stroke();
  ctx.restore();

  // Description above the circle.
  if (c.description) {
    const fs = clamp(16 * state.camera.zoom * getTextScale(), 11, 48);
    ctx.save();
    ctx.font = `${fs}px ${FONT()}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 8 * GLOW();
    ctx.fillText(c.description, p.x, p.y - r + fs * 0.2 - 4);
    ctx.restore();
  }
}

function drawRect(ctx, n, color, selected, zoom) {
  // Links: content derived from the source.
  const isLink = !!n.ref;
  const src = isLink ? sourceOf(n) : null;
  const text = isLink ? (src ? src.text : '') : n.text;
  const image = isLink ? (src ? src.image : null) : n.image;
  const ytId = !image ? youTubeId(text) : null; // text = YouTube URL -> video

  // Rendered (physics) position + center.
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
  // Directional squash/stretch.
  if (st.sx !== 1 || st.sy !== 1) {
    ctx.rotate(st.angle);
    ctx.scale(st.sx, st.sy);
    ctx.rotate(-st.angle);
  }

  // Style depending on the theme (pixel = neon; classic = pastel + default black/white square).
  const stl = nodeStyle(color);

  // Optional image (contain), or YouTube thumbnail (cover, fills the block).
  const imgSrc = image || (ytId ? ytThumb(ytId) : null);
  const img = imgSrc ? getImg(imgSrc) : null;
  const hasImage = !!(img && img.complete && img.naturalWidth);

  if (hasImage) {
    // Image block: raw rendering, no colored glow/fill/border.
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    const sc = ytId ? Math.max(w / img.naturalWidth, h / img.naturalHeight) // cover (thumbnail)
      : Math.min(w / img.naturalWidth, h / img.naturalHeight);             // contain (image)
    const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    // Body (fallback: no image loaded yet, or text block).
    ctx.shadowColor = color;
    ctx.shadowBlur = (selected ? 22 : 10) * GLOW();
    ctx.fillStyle = stl.fill;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.shadowBlur = 0;

    // Border (dashed for a link).
    ctx.lineWidth = selected ? 5 : 3;
    ctx.strokeStyle = stl.border;
    if (isLink) ctx.setLineDash([6 * zoom, 4 * zoom]);
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    ctx.setLineDash([]);
  }

  // Resize handle (bottom-right corner), only when selected alone.
  if (selected && state.selected === n.id && !isLink) {
    const hs = Math.max(7, 9 * zoom);
    ctx.fillStyle = stl.border;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - hs);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(w / 2 - hs, h / 2);
    ctx.closePath();
    ctx.fill();
  }

  // "Clickable link" badge (cyan ↗ arrow, top-right).
  if (displayLink(n)) {
    const bs = Math.max(9, 12 * zoom);
    const bx = w / 2 - bs - 4 * zoom, by = -h / 2 + 4 * zoom;
    ctx.fillStyle = '#00b7eb';
    ctx.shadowColor = '#00b7eb';
    ctx.shadowBlur = 6 * GLOW();
    ctx.fillRect(bx, by, bs, bs);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#04130a';
    ctx.lineWidth = Math.max(1, 1.4 * zoom);
    ctx.beginPath();
    ctx.moveTo(bx + bs * 0.28, by + bs * 0.72);
    ctx.lineTo(bx + bs * 0.72, by + bs * 0.28);
    ctx.moveTo(bx + bs * 0.46, by + bs * 0.28);
    ctx.lineTo(bx + bs * 0.72, by + bs * 0.28);
    ctx.lineTo(bx + bs * 0.72, by + bs * 0.54);
    ctx.stroke();
  }

  // Centered ▶ play button for a YouTube video block.
  if (ytId) {
    const r = Math.min(w, h) * 0.22;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2222';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.42); ctx.lineTo(r * 0.5, 0); ctx.lineTo(-r * 0.3, r * 0.42);
    ctx.closePath(); ctx.fill();
  }

  // Text (shrunk to fit the rectangle, except for an image/video block).
  if (text && !image && !ytId) {
    const baseFs = 13 * zoom * getTextScale();
    ctx.shadowBlur = 6 * GLOW();
    ctx.fillStyle = stl.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawFitted(ctx, text, w - 16 * zoom, h - 14 * zoom, baseFs);
  }
  ctx.restore();
}

// Splits into lines, respecting explicit line breaks + word wrapping.
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = '';
    for (const word of words) {
      const test = cur ? cur + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = word; }
      else cur = test;
    }
    if (cur) out.push(cur);
  }
  return out;
}

// Centered text that shrinks until it fits within (maxW x maxH).
function drawFitted(ctx, text, maxW, maxH, baseFs) {
  const fam = FONT();
  let fs = Math.max(5, baseFs);
  let lines = [];
  for (let i = 0; i < 16; i++) {
    ctx.font = `${fs}px ${fam}`;
    lines = wrapLines(ctx, text, maxW);
    const lineH = fs * 1.4;
    const tall = lines.length * lineH > maxH;
    const wide = lines.some(l => ctx.measureText(l).width > maxW);
    if ((!tall && !wide) || fs <= 5) break;
    fs = Math.max(5, fs * 0.86);
  }
  ctx.font = `${fs}px ${fam}`;
  const lineH = fs * 1.4;
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
