// Thème visuel + taille de texte (préférences locales au navigateur).
// 'pixel' = le look d'origine ; 'classic' = clair façon appli classique ;
// 'classic-dark' = clair-de-forme mais sombre.

const PIXEL_FONT = "'Press Start 2P', monospace";
const SANS_FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";

const THEMES = {
  pixel: {
    bg: '#0d0f12', grid: '#1a1f26', nodeBg: '#11151a', ink: '#cfd8d3',
    accent: '#39ff14', font: PIXEL_FONT, pixel: true, lightBg: false, glow: 1,
  },
  classic: {
    bg: '#f4f5f0', grid: '#d9dcd2', nodeBg: '#ffffff', ink: '#23262b',
    accent: '#1f9d2f', font: SANS_FONT, pixel: false, lightBg: true, glow: 0.25,
  },
  'classic-dark': {
    bg: '#15171c', grid: '#262a31', nodeBg: '#21252c', ink: '#e8e8e8',
    accent: '#39ff14', font: SANS_FONT, pixel: false, lightBg: false, glow: 0.7,
  },
};

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
