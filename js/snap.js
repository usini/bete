// Alignment snapping: a moving or resizing block snaps its edges and centre to
// the edges and centres of the other blocks. Guide lines are drawn while it applies.
import { state } from './state.js?v=mw3s4pp0';

const TOL_PX = 8;
const MIN = 20, MAX = 1e5;
const EPS = 1e-6;
// x: vertical guide lines {at, y0, y1}; y: horizontal guide lines {at, x0, x1} (world units)
export const guides = { x: [], y: [] };

export function clearGuides() {
  guides.x = [];
  guides.y = [];
}

// Smallest offset that brings one of `mine` onto one of `theirs`, within tolerance.
function bestDelta(mine, theirs, tol) {
  let best = null;
  for (const a of mine) {
    for (const b of theirs) {
      const d = b - a;
      if (Math.abs(d) <= tol && (best === null || Math.abs(d) < Math.abs(best))) best = d;
    }
  }
  return best;
}

const xsOf = (b) => [b.x, b.x + b.w / 2, b.x + b.w];
const ysOf = (b) => [b.y, b.y + b.h / 2, b.y + b.h];
const clampSize = (v) => Math.min(MAX, Math.max(MIN, v));

// Snapped top-left corner for block n dragged to (x, y).
// `skip` (optional Set): blocks that move together with n (a group's members), never snapped to.
export function snapMove(n, x, y, skip) {
  const tol = TOL_PX / state.camera.zoom;
  const others = state.nodes.filter((o) => o !== n && !(skip && skip.has(o)));
  const dx = bestDelta([x, x + n.w / 2, x + n.w], others.flatMap(xsOf), tol) ?? 0;
  const dy = bestDelta([y, y + n.h / 2, y + n.h], others.flatMap(ysOf), tol) ?? 0;
  x += dx;
  y += dy;
  buildGuides(x, y, n.w, n.h, others);
  return { x, y };
}

// Snapped size for block n resized to (w, h): only its right and bottom edges move.
export function snapResize(n, w, h) {
  const tol = TOL_PX / state.camera.zoom;
  const others = state.nodes.filter((o) => o !== n);
  const dw = bestDelta([n.x + w], others.flatMap(xsOf), tol);
  const dh = bestDelta([n.y + h], others.flatMap(ysOf), tol);
  if (dw !== null) w += dw;
  if (dh !== null) h += dh;
  w = clampSize(w);
  h = clampSize(h);
  buildGuides(n.x, n.y, w, h, others);
  return { w, h };
}

function buildGuides(x, y, w, h, others) {
  clearGuides();
  const mineX = [x, x + w / 2, x + w];
  const mineY = [y, y + h / 2, y + h];
  for (const o of others) {
    for (const ov of xsOf(o)) {
      if (mineX.some((mv) => Math.abs(mv - ov) < EPS)) {
        guides.x.push({ at: ov, y0: Math.min(y, o.y), y1: Math.max(y + h, o.y + o.h) });
      }
    }
    for (const ov of ysOf(o)) {
      if (mineY.some((mv) => Math.abs(mv - ov) < EPS)) {
        guides.y.push({ at: ov, x0: Math.min(x, o.x), x1: Math.max(x + w, o.x + o.w) });
      }
    }
  }
}
