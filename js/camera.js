// World <-> screen transforms (screen = CSS pixels, world = abstract units).
import { state, emit } from './state.js?v=mvzojnnt';

export const view = { w: window.innerWidth, h: window.innerHeight };

export function worldToScreen(wx, wy) {
  const { x, y, zoom } = state.camera;
  return { x: (wx - x) * zoom + view.w / 2, y: (wy - y) * zoom + view.h / 2 };
}

export function screenToWorld(sx, sy) {
  const { x, y, zoom } = state.camera;
  return { x: (sx - view.w / 2) / zoom + x, y: (sy - view.h / 2) / zoom + y };
}

// Zoom keeping the point under (sx, sy) fixed.
export function zoomAt(sx, sy, factor) {
  const before = screenToWorld(sx, sy);
  state.camera.zoom = Math.min(8, Math.max(0.05, state.camera.zoom * factor));
  const after = screenToWorld(sx, sy);
  state.camera.x += before.x - after.x;
  state.camera.y += before.y - after.y;
}

// Pan by a delta in screen pixels.
export function panBy(dxScreen, dyScreen) {
  state.camera.x -= dxScreen / state.camera.zoom;
  state.camera.y -= dyScreen / state.camera.zoom;
}

// Smooth camera flight to (x, y) at the given zoom. Any new flight, or cancelFlight(),
// stops the previous one (so the user can grab the view while it moves).
let flight = 0;
export function cancelFlight() { flight++; }
export function flyTo(x, y, zoom, ms = 450) {
  const id = ++flight;
  const from = { x: state.camera.x, y: state.camera.y, zoom: state.camera.zoom };
  const t0 = performance.now();
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const step = (now) => {
    if (id !== flight) return;
    const t = Math.min(1, (now - t0) / ms);
    const e = ease(t);
    state.camera.zoom = from.zoom * Math.pow(zoom / from.zoom, e); // zoom interpolated in log space
    state.camera.x = from.x + (x - from.x) * e;
    state.camera.y = from.y + (y - from.y) * e;
    emit();
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
