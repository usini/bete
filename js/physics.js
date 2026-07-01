// Elastic inertia spring + squash/stretch (wobble) per rectangle.
// Stores fields _rx/_ry (rendered position), _vx/_vy (velocity),
// _svx/_svy (smoothed velocity, for a soft deformation without jitter).

// Hot-reloadable parameters (debug menu, '²' key). Not persisted.
export const wobbleCfg = {
  stiffness: 218,   // spring stiffness
  damping: 36,      // damping (< critical => elastic bounce)
  maxStretch: 0.26, // max deformation
  stretchK: 0.0002, // sensitivity of deformation to speed
};
export const WOBBLE_DEFAULTS = { ...wobbleCfg };

function ensure(n) {
  if (n._rx === undefined) {
    n._rx = n.x; n._ry = n.y;
    n._vx = 0; n._vy = 0;
    n._svx = 0; n._svy = 0;
  }
}

// Advances a node's simulation towards its logical target (n.x, n.y).
export function step(n, dt) {
  ensure(n);
  // Clamp dt for stability (backgrounded tab, big lag spike).
  dt = Math.min(dt, 0.05);

  const ax = wobbleCfg.stiffness * (n.x - n._rx) - wobbleCfg.damping * n._vx;
  const ay = wobbleCfg.stiffness * (n.y - n._ry) - wobbleCfg.damping * n._vy;
  n._vx += ax * dt;
  n._vy += ay * dt;
  n._rx += n._vx * dt;
  n._ry += n._vy * dt;

  // Smoothed velocity (low-pass) -> deformation no longer follows frame-to-frame jitter.
  const f = Math.min(1, dt * 10);
  n._svx += (n._vx - n._svx) * f;
  n._svy += (n._vy - n._svy) * f;
}

// While dragging: snaps the rendered position to the target and captures the
// real mouse velocity (for inertia on release).
export function dragTo(n, x, y, dt) {
  ensure(n);
  if (dt > 0) {
    n._vx = (x - n._rx) / dt;
    n._vy = (y - n._ry) / dt;
  }
  n.x = x; n.y = y;
  n._rx = x; n._ry = y;
}

// Directional squash/stretch factor based on the SMOOTHED velocity.
// Returns { angle, sx, sy } to apply around the node's center.
export function stretch(n) {
  const vx = n._svx || 0, vy = n._svy || 0;
  const sp = Math.hypot(vx, vy);
  const k = Math.min(sp * wobbleCfg.stretchK, wobbleCfg.maxStretch);
  return {
    angle: Math.atan2(vy, vx),
    sx: 1 + k,
    sy: 1 - k,
  };
}

export function reset(n) {
  n._rx = n.x; n._ry = n.y;
  n._vx = 0; n._vy = 0;
  n._svx = 0; n._svy = 0;
}
