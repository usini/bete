// Transformations monde <-> écran et zoom centré sur le pointeur.
import { state } from './state.js?v=mquzce9a';

// Dimensions logiques (CSS px) du viewport, mises à jour par main.js.
export const view = { w: window.innerWidth, h: window.innerHeight };

export function setView(w, h) { view.w = w; view.h = h; }

export function worldToScreen(wx, wy) {
  const { x, y, zoom } = state.camera;
  return {
    x: (wx - x) * zoom + view.w / 2,
    y: (wy - y) * zoom + view.h / 2,
  };
}

export function screenToWorld(sx, sy) {
  const { x, y, zoom } = state.camera;
  return {
    x: (sx - view.w / 2) / zoom + x,
    y: (sy - view.h / 2) / zoom + y,
  };
}

// Zoom multiplicatif en gardant fixe le point monde sous le curseur.
export function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  state.camera.zoom = Math.min(8, Math.max(0.05, state.camera.zoom * factor));
  const after = screenToWorld(sx, sy);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
}

// Pan en pixels écran.
export function panBy(dxScreen, dyScreen) {
  state.camera.x -= dxScreen / state.camera.zoom;
  state.camera.y -= dyScreen / state.camera.zoom;
}

export function centerOn(wx, wy) {
  state.camera.x = wx;
  state.camera.y = wy;
}
