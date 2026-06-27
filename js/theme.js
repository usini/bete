// Thème visuel + taille de texte (préférences locales au navigateur).
// 'pixel' = le look d'origine (fluo + glow) ; 'classic' = clair, couleurs
// pastel, sans glow ; 'classic-dark' = sombre, pastel, sans glow.
import { DEFAULT_GREEN } from './state.js?v=mqwr5rg4';

const PIXEL_FONT = "'Press Start 2P', monospace";
const SANS_FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

const THEMES = {
  pixel: {
    bg: '#0d0f12', grid: '#1a1f26', nodeBg: '#11151a', ink: '#cfd8d3',
    accent: '#39ff14', font: PIXEL_FONT, pixel: true, lightBg: false, glow: 1,
  },
  classic: {
    bg: '#f4f5f0', grid: '#d9dcd2', nodeBg: '#ffffff', ink: '#23262b',
    accent: '#2f8f3a', font: SANS_FONT, pixel: false, lightBg: true, glow: 0,
  },
  'classic-dark': {
    bg: '#15171c', grid: '#262a31', nodeBg: '#21252c', ink: '#e8e8e8',
    accent: '#7bd88a', font: SANS_FONT, pixel: false, lightBg: false, glow: 0,
  },
};

// ---- Couleurs dérivées (mélange de teintes) ----
function hx(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function toHex(r, g, b) { const c = (v) => ('0' + Math.round(Math.max(0, Math.min(255, v))).toString(16)).slice(-2); return '#' + c(r) + c(g) + c(b); }
function mix(a, b, t) { const A = hx(a), B = hx(b); return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
function lum(hex) { const c = hx(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }

export function isDefaultColor(color) { return !color || color.toLowerCase() === DEFAULT_GREEN.toLowerCase(); }

// Couleur des zones (cercles/hexagones) selon le thème : fluo en pixel, pastel sinon,
// avec un garde-fou de contraste (une couleur trop claire devient sombre sur fond clair,
// et inversement) pour rester visible.
export function toneColor(color) {
  const t = THEMES[themeId];
  if (t.pixel) return color;
  if (themeId === 'classic') {
    if (lum(color) > 0.72) return mix(color, '#1a1a1a', 0.8); // trop clair sur blanc -> foncer
    return mix(color, '#ffffff', 0.32); // pastel
  }
  // classic-dark
  if (lum(color) < 0.22) return mix(color, '#e8e8e8', 0.75); // trop sombre sur fond noir -> éclaircir
  return mix(color, '#ffffff', 0.22);
}

// Style d'un rectangle { fill, border, text } selon le thème.
// La couleur "par défaut" (sans zone) devient un carré noir/blanc contrasté.
export function nodeStyle(color) {
  const t = THEMES[themeId];
  if (t.pixel) return { fill: t.nodeBg, border: color, text: color };
  const def = isDefaultColor(color);
  if (themeId === 'classic') {
    if (def) return { fill: '#141414', border: '#141414', text: '#ffffff' }; // carré noir, texte blanc
    return { fill: '#ffffff', border: toneColor(color), text: '#2a2a2a' };
  }
  // classic-dark
  if (def) return { fill: '#fafafa', border: '#fafafa', text: '#141414' };   // carré blanc, texte noir
  const p = toneColor(color);
  return { fill: t.nodeBg, border: p, text: p };
}

export const THEME_LIST = [
  { id: 'pixel', label: 'Pixel Art' },
  { id: 'classic', label: 'Classic' },
  { id: 'classic-dark', label: 'Classic dark' },
];

let themeId = 'pixel';
let textScale = 1;
try { const t = localStorage.getItem('todomappa:theme'); if (t && THEMES[t]) themeId = t; } catch (e) { /* */ }
try { const s = parseFloat(localStorage.getItem('todomappa:textscale')); if (s > 0) textScale = Math.max(0.5, Math.min(2.5, s)); } catch (e) { /* */ }

export function theme() { return THEMES[themeId]; }
export function themeId_() { return themeId; }
export function getTextScale() { return textScale; }

export function setTextScale(v) {
  textScale = Math.max(0.5, Math.min(2.5, v));
  try { localStorage.setItem('todomappa:textscale', String(textScale)); } catch (e) { /* */ }
}

export function setTheme(id) {
  if (!THEMES[id]) return;
  themeId = id;
  try { localStorage.setItem('todomappa:theme', id); } catch (e) { /* */ }
  applyTheme();
}

// Applique la classe de thème au <body> (le CSS s'occupe des éléments DOM).
export function applyTheme() {
  const b = document.body;
  b.classList.remove('theme-pixel', 'theme-classic', 'theme-classic-dark');
  b.classList.add('theme-' + themeId);
}
