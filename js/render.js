// Rendu du board : grille pixel, cercles, hexagones, rectangles, glow néon, sélection.
import { state, effectiveColor, sourceOf, displayLink } from './state.js?v=mqtph0eo';
import { view, worldToScreen } from './camera.js?v=mqtph0eo';
import { stretch } from './physics.js?v=mqtph0eo';
import { hexCorners } from './geom.js?v=mqtph0eo';

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

  // Rectangles, pancartes & blocs Liaison (au-dessus).
  for (const n of state.nodes) {
    if (n.kind === 'liaison') drawLiaison(ctx, n, n.id === state.selected, zoom);
    else if (n.kind === 'pancarte') drawPancarte(ctx, n, n.id === state.selected, zoom);
    else drawRect(ctx, n, effectiveColor(n), n.id === state.selected, zoom);
  }
}

// Pancarte : rectangle plus grand avec texture bois et texte gravé.
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

  // Planches de bois (clippées au rectangle).
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
    ctx.fillStyle = '#3d2917'; // séparateur de planche
    ctx.fillRect(-w / 2, top, w, Math.max(1, 2 * zoom));
    ctx.strokeStyle = 'rgba(40,25,12,0.4)'; // veines
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

  // Cadre + clous + liseré de sélection.
  ctx.shadowBlur = 0;
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = '#3d2917';
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  if (selected) {
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 2;
    ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
  }
  ctx.fillStyle = '#2a1a0e';
  const nail = Math.max(2, 3 * zoom), off = 9 * zoom;
  [[-w / 2 + off, -h / 2 + off], [w / 2 - off, -h / 2 + off], [-w / 2 + off, h / 2 - off], [w / 2 - off, h / 2 - off]]
    .forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, nail, 0, Math.PI * 2); ctx.fill(); });

  // Texte gravé (clair avec ombre sombre).
  if (n.text) {
    const fs = clamp(11 * zoom, 6, 24);
    ctx.fillStyle = '#f3e3c0';
    ctx.shadowColor = '#2a1a0e';
    ctx.shadowOffsetX = 1.5 * zoom;
    ctx.shadowOffsetY = 1.5 * zoom;
    ctx.font = `${fs}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    drawWrapped(ctx, n.text, w - 22 * zoom, fs);
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.restore();
}

// Bloc de liaison P2P : QR code + statut. Clic = copie le lien.
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
  } catch (e) { /* lib pas prête */ }
}

function drawLiaison(ctx, n, selected, zoom) {
  const rx = n._rx !== undefined ? n._rx : n.x;
  const ry = n._ry !== undefined ? n._ry : n.y;
  const p = worldToScreen(rx + n.w / 2, ry + n.h / 2);
  const w = n.w * zoom, h = n.h * zoom;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = selected ? 22 : 12;
  ctx.fillStyle = '#11151a';
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.lineWidth = selected ? 5 : 3;
  ctx.strokeStyle = '#39ff14';
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
    ctx.fillStyle = '#39ff14';
    ctx.font = `${clamp(10 * zoom, 7, 16)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('...', 0, qrY + qrSide / 2);
  }

  const now = performance.now();
  let label;
  if (n._copiedUntil && now < n._copiedUntil) label = 'LIEN COPIE !';
  else if (n.status === 'connected') label = 'CONNECTE - CLIC=COPIER';
  else if (n.status === 'online') label = 'CLIC = COPIER LIEN';
  else if (n.status === 'error') label = 'ERREUR RESEAU';
  else label = 'CONNEXION...';

  const fs = clamp(7 * zoom, 5, 11);
  ctx.fillStyle = '#39ff14';
  ctx.shadowColor = '#39ff14';
  ctx.shadowBlur = 6;
  ctx.font = `${fs}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, (qrY + qrSide + h / 2) / 2);
  ctx.restore();
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
      // contain : image entière, centrée (letterbox si besoin).
      const sc = Math.min(w / img.naturalWidth, h / img.naturalHeight);
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

  // Badge "lien cliquable" (flèche ↗ cyan en haut à droite).
  if (displayLink(n)) {
    const bs = Math.max(9, 12 * zoom);
    const bx = w / 2 - bs - 4 * zoom, by = -h / 2 + 4 * zoom;
    ctx.fillStyle = '#00b7eb';
    ctx.shadowColor = '#00b7eb';
    ctx.shadowBlur = 6;
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
