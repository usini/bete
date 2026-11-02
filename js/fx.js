// Deletion effect: a block explodes into pieces that fly out, fall and fade away.
// Particles live in world coordinates and are drawn under the camera transform.
let particles = [];
let lastT = 0;

// Make a world box explode into coloured pieces.
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

export function hasParticles() { return particles.length > 0; }

// Advance the particles up to `now` (performance.now() in ms).
export function updateFx(now) {
  if (!particles.length) { lastT = now; return; }
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  for (const p of particles) {
    p.life -= dt / p.max;
    p.vy += 900 * dt; // gravity
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.99;
    p.rot += p.vr * dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

// Draw the particles; the context must already carry the world -> screen transform.
export function renderFx(ctx) {
  if (!particles.length) return;
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8; // device pixels
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    ctx.restore();
  }
}
