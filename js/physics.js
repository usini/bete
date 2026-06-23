// Ressort d'inertie élastique + squash/stretch (wobble) par rectangle.
// Stocke des champs _rx/_ry (position rendue), _vx/_vy (vélocité) sur le node.

const STIFFNESS = 170;   // raideur du ressort
const DAMPING = 13;      // amortissement (< critique => rebond élastique)
const MAX_STRETCH = 0.22;

function ensure(n) {
  if (n._rx === undefined) {
    n._rx = n.x; n._ry = n.y;
    n._vx = 0; n._vy = 0;
  }
}

// Avance la simulation d'un node vers sa cible logique (n.x, n.y).
export function step(n, dt) {
  ensure(n);
  // Clamp dt pour la stabilité (onglet en arrière-plan, gros lag).
  dt = Math.min(dt, 0.05);

  const ax = STIFFNESS * (n.x - n._rx) - DAMPING * n._vx;
  const ay = STIFFNESS * (n.y - n._ry) - DAMPING * n._vy;
  n._vx += ax * dt;
  n._vy += ay * dt;
  n._rx += n._vx * dt;
  n._ry += n._vy * dt;
}

// Pendant un drag : on colle la position rendue à la cible et on capture la
// vélocité réelle de la souris (pour l'inertie au lâcher).
export function dragTo(n, x, y, dt) {
  ensure(n);
  if (dt > 0) {
    n._vx = (x - n._rx) / dt;
    n._vy = (y - n._ry) / dt;
  }
  n.x = x; n.y = y;
  n._rx = x; n._ry = y;
}

// Facteur de squash/stretch directionnel basé sur la vélocité courante.
// Retourne { angle, sx, sy } à appliquer autour du centre du node.
export function stretch(n) {
  const sp = Math.hypot(n._vx || 0, n._vy || 0);
  const k = Math.min(sp * 0.00055, MAX_STRETCH);
  return {
    angle: Math.atan2(n._vy || 0, n._vx || 0),
    sx: 1 + k,
    sy: 1 - k,
  };
}

export function reset(n) {
  n._rx = n.x; n._ry = n.y; n._vx = 0; n._vy = 0;
}
