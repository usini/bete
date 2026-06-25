// Effets de particules (explosion à la suppression d'un objet).
import { worldToScreen } from './camera.js?v=mqtyx9od';
import { state, effectiveColor } from './state.js?v=mqtyx9od';

let particles = [];

// Fait exploser une boîte monde en morceaux qui retombent et s'estompent.
export function explode(x, y, w, h, color) {
  const cx = x + w / 2, cy = y + h / 2;
  const count = Math.max(14, Math.min(48, Math.round((w * h) / 600)));
  for (let i = 0; i < count; i++) {
    const px = x + Math.random() * w;
    const py = y + Math.random() * h;
    const ang = Math.atan2(py - cy, px - cx) + (Math.random() - 0.5) * 1.2;
    const sp = 130 + Math.random() * 360;
    particles.push({
      x: px, y: py,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 90,
      size: 6 + Math.random() * 14,
      color,
      life: 1,
      max: 0.55 + Math.random() * 0.5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 12,
    });
  }
}

export function explodeElement(el) {
  if (!el) return;
  if (el.r !== undefined) {
    explode(el.x - el.r, el.y - el.r, el.r * 2, el.r * 2, el.color || '#39ff14');
  } else {
    const color = el.kind === 'pancarte' ? '#7a5230' : effectiveColor(el);
    explode(el.x, el.y, el.w, el.h, color);
  }
}

// Explose un élément + les liens qui pointent vers lui (supprimés en cascade).
export function explodeElementCascade(el) {
  if (!el) return;
  explodeElement(el);
  state.nodes.forEach((n) => { if (n.ref === el.id) explodeElement(n); });
}

export function count() { return particles.length; }

export function update(dt) {
  if (!particles.length) return;
  dt = Math.min(dt, 0.05);
  for (const p of particles) {
    p.life -= dt / p.max;
    p.vy += 900 * dt; // gravité
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.99;
    p.rot += p.vr * dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

export function render(ctx) {
  if (!particles.length) return;
  const z = state.camera.zoom;
  for (const p of particles) {
    const s = worldToScreen(p.x, p.y);
    const d = p.size * z;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(s.x, s.y);
    ctx.rotate(p.rot);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.fillRect(-d / 2, -d / 2, d, d);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
