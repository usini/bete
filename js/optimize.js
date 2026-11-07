import { state, getNode, emit } from './state.js?v=mw6rq16y';
import { optimizeImage } from './images.js?v=mw6rq16y';
import { clearHistory } from './history.js?v=mw6rq16y';

let pending = null;
// One optimization at a time, shared by the menu and desktop shutdown.
export function optimizeBoardImages() {
  if (pending) return pending;
  pending = optimize().finally(() => { pending = null; });
  return pending;
}
async function optimize() {
  const candidates = new Map();
  for (const node of state.nodes) {
    if (!node.image || node.keepImageOriginal) continue;
    if (!candidates.has(node.image)) candidates.set(node.image, []);
    candidates.get(node.image).push(node);
  }
  let count = 0, failures = 0;
  for (const [ref, nodes] of candidates) {
    try {
      const optimized = await optimizeImage(ref);
      if (!optimized) continue;
      const current = nodes.filter(node => getNode(node.id) === node && node.image === ref && !node.keepImageOriginal);
      for (const node of current) node.image = optimized;
      count += current.length;
    } catch { failures++; }
  }
  // Keep only the final optimized state, including when no image needed recompression.
  clearHistory();
  emit();
  return { count, failures };
}
