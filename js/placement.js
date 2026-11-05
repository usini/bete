// Find the closest free top-left position; only the dragged block moves.
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export function freeDropPosition(node, nodes, boundsOf = n => n, gap = 16) {
  const box = boundsOf(node);
  const others = nodes.filter(n => n !== node && n.kind !== 'group').map(boundsOf);
  if (!others.some(other => overlaps(box, other))) return { x: node.x, y: node.y };
  // For every horizontal boundary, merge forbidden vertical intervals. The closest
  // point outside this rectangle union lies on one of these boundaries.
  const xs = [...new Set([box.x, ...others.flatMap(b => [b.x - box.w - gap, b.x + b.w + gap])])]
    .sort((a, b) => Math.abs(a - box.x) - Math.abs(b - box.x));
  let best = null, distance = Infinity;
  for (const x of xs) {
    const dx = x - box.x;
    if (dx * dx > distance) break;
    const intervals = others.filter(b => x < b.x + b.w + gap && x + box.w + gap > b.x)
      .map(b => [b.y - box.h - gap, b.y + b.h + gap]).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const interval of intervals) {
      const last = merged.at(-1);
      if (last && interval[0] < last[1]) last[1] = Math.max(last[1], interval[1]);
      else merged.push([...interval]);
    }
    let y = box.y;
    for (const [low, high] of merged) {
      if (y > low && y < high) { y = y - low <= high - y ? low : high; break; }
    }
    const d = dx * dx + (y - box.y) ** 2;
    if (d < distance) { distance = d; best = { x, y }; }
  }
  return { x: node.x + best.x - box.x, y: node.y + best.y - box.y };
}

// Membership is captured at drag start: external blocks are never adopted by a moving frame.
export function settleDrop(node, nodes, members = [], boundsOf = n => n) {
  const carried = new Set(members);
  const position = freeDropPosition(node, nodes.filter(n => !carried.has(n)), boundsOf);
  const dx = position.x - node.x, dy = position.y - node.y;
  Object.assign(node, position);
  for (const member of carried) { member.x += dx; member.y += dy; }
}

// Capture intent before collision resolution can push the block outside the frame.
// Prefer the smallest touched frame when groups are nested.
export function dropTargetGroup(node, nodes, boundsOf = n => n) {
  if (node.kind === 'group') return null;
  const box = boundsOf(node);
  return nodes.filter(n => n.kind === 'group' && box.x <= n.x + n.w && box.x + box.w >= n.x
    && box.y <= n.y + n.h && box.y + box.h >= n.y)
    .sort((a, b) => a.w * a.h - b.w * b.h)[0] || null;
}

// Transient drag feedback; never serialized into the board.
export let dropPreviewGroup = null;
export function setDropPreview(group) { dropPreviewGroup = group; }
