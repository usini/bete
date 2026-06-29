// Hexagon geometry (pointy-top : a vertex at the top) shared by the modules.

export function hexCorners(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

// Check if a point (px, py) is inside a polygon defined by an array of points (pts).
export function pointInPolygon(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Check if a point (px, py) is inside a hexagon centered at (cx, cy) with radius r.
export function pointInHex(px, py, cx, cy, r) {
  return pointInPolygon(px, py, hexCorners(cx, cy, r));
}
