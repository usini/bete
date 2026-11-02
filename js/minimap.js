// Minimap (bottom-left): all the blocks in their colour + the current view as a white frame.
// Click or drag on it to move the view there.
import { state, emit, groupsBySize } from './state.js?v=mvzqx4cw';
import { view } from './camera.js?v=mvzqx4cw';

const canvas = document.getElementById('minimap');
const ctx = canvas.getContext('2d');
let frozen = null; // fit transform kept while dragging, so the map does not shift under the finger

// World rectangle currently visible on the main canvas.
function viewport() {
  const z = state.camera.zoom;
  const w = view.w / z, h = view.h / z;
  return { x: state.camera.x - w / 2, y: state.camera.y - h / 2, w, h };
}

// Scale and offset that fit every block and the current view inside a W x H minimap
// (aspect ratio kept, centred): screen = world * s + (ox, oy).
function fit(W, H) {
  const v = viewport();
  let minx = v.x, miny = v.y, maxx = v.x + v.w, maxy = v.y + v.h;
  for (const n of state.nodes) {
    minx = Math.min(minx, n.x); miny = Math.min(miny, n.y);
    maxx = Math.max(maxx, n.x + n.w); maxy = Math.max(maxy, n.y + n.h);
  }
  const pad = Math.max(maxx - minx, maxy - miny) * 0.08 + 20;
  minx -= pad; miny -= pad; maxx += pad; maxy += pad;
  const bw = maxx - minx, bh = maxy - miny;
  const s = Math.min(W / bw, H / bh);
  return { s, ox: (W - bw * s) / 2 - minx * s, oy: (H - bh * s) / 2 - miny * s };
}

export function renderMinimap() {
  const W = canvas.clientWidth, H = canvas.clientHeight;
  if (!W || !H) return;
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const t = frozen || fit(W, H);
  const rect = (n) => {
    ctx.fillStyle = n.color === 'transparent' ? '#ffffff' : n.color;
    ctx.fillRect(n.x * t.s + t.ox, n.y * t.s + t.oy, Math.max(2, n.w * t.s), Math.max(2, n.h * t.s));
  };
  // Groups first and translucent (the biggest underneath), then the other blocks on top.
  ctx.globalAlpha = 0.3;
  for (const n of groupsBySize()) rect(n);
  ctx.globalAlpha = 1;
  for (const n of state.nodes) if (n.kind !== 'group') rect(n);
  const v = viewport();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(v.x * t.s + t.ox, v.y * t.s + t.oy, v.w * t.s, v.h * t.s);
}

// Centre the main view on the world point under the pointer.
function recenter(e) {
  const r = canvas.getBoundingClientRect();
  state.camera.x = (e.clientX - r.left - frozen.ox) / frozen.s;
  state.camera.y = (e.clientY - r.top - frozen.oy) / frozen.s;
  emit();
}

export function initMinimap() {
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    frozen = fit(canvas.clientWidth, canvas.clientHeight);
    recenter(e);
  });
  canvas.addEventListener('pointermove', (e) => { if (frozen) recenter(e); });
  const end = () => { frozen = null; emit(); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
}
