// Transient visual state: never written to board JSON, history or the network.
const motion = new WeakMap();
const dragging = new WeakSet();
// Smooth transient peer-pointer targets without sending animation frames over the network.
export function smoothPointer(cursor, now, animate = true) {
  if (!animate || cursor.drawX === undefined) { cursor.drawX = cursor.x; cursor.drawY = cursor.y; }
  const elapsed = Math.max(0, now - (cursor.drawTime ?? now));
  const factor = 1 - Math.exp(-elapsed / 65);
  cursor.drawX += (cursor.x - cursor.drawX) * factor;
  cursor.drawY += (cursor.y - cursor.drawY) * factor;
  cursor.drawTime = now;
  const moving = Math.hypot(cursor.x - cursor.drawX, cursor.y - cursor.drawY) > 0.15;
  if (!moving) { cursor.drawX = cursor.x; cursor.drawY = cursor.y; }
  return { x: cursor.drawX, y: cursor.drawY, moving };
}
export function setDragging(node, active) {
  if (active) dragging.add(node);
  else dragging.delete(node);
}

export function stepMotion(node, dt) {
  let p = motion.get(node);
  if (!p) { p = { x: node.x, y: node.y, vx: 0, vy: 0, sx: 0, sy: 0 }; motion.set(node, p); }
  dt = Math.max(1 / 240, Math.min(dt, 0.04));
  if (dragging.has(node)) {
    p.vx = Math.max(-2000, Math.min(2000, (node.x - p.x) / dt));
    p.vy = Math.max(-2000, Math.min(2000, (node.y - p.y) / dt));
    p.x = node.x; p.y = node.y;
  } else {
    // Large remote changes/undo should remain bounded even after a sleeping tab.
    if (Math.hypot(node.x - p.x, node.y - p.y) > 2500) { p.x = node.x; p.y = node.y; p.vx = p.vy = 0; }
    for (let remaining = dt; remaining > 0;) {
      const h = Math.min(1 / 120, remaining); remaining -= h;
      p.vx += (218 * (node.x - p.x) - 25 * p.vx) * h;
      p.vy += (218 * (node.y - p.y) - 25 * p.vy) * h;
      p.x += p.vx * h; p.y += p.vy * h;
    }
  }
  const f = Math.min(1, dt * 12);
  p.sx += (p.vx - p.sx) * f; p.sy += (p.vy - p.sy) * f;
  const speed = Math.hypot(p.sx, p.sy);
  const stretch = Math.min(0.14, speed * 0.00012);
  const active = Math.hypot(node.x - p.x, node.y - p.y) > 0.05 || Math.hypot(p.vx, p.vy) > 0.5 || speed > 0.5;
  if (!active) { p.x = node.x; p.y = node.y; p.vx = p.vy = p.sx = p.sy = 0; }
  return { dx: p.x - node.x, dy: p.y - node.y, angle: Math.atan2(p.sy, p.sx), stretch, active };
}
