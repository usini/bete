import { freeDropPosition } from './placement.js?v=mwag82om';

// Reuse the last size only while it remains usable in the current viewport.
export function creationSize(size, zoom, viewport = {w:800,h:600}) {
  const maxW = Math.min(640, viewport.w * .65), maxH = Math.min(480, viewport.h * .6);
  const sw = size.w * zoom, sh = size.h * zoom;
  if (Math.min(sw, sh) >= 40 && sw <= maxW && sh <= maxH) return {...size};
  const factor = Math.min(Math.min(320, viewport.w * .45) / sw, Math.min(220, viewport.h * .38) / sh);
  return {w:Math.max(20,Math.min(1e5,size.w*factor)),h:Math.max(20,Math.min(1e5,size.h*factor))};
}

export function freeCreationPosition(node, nodes, boundsOf = n=>n, gap = 32) {
  const obstacles = nodes.filter(n=>n!==node).map(n=>{
    const b=boundsOf(n);
    return {kind:'rect',x:b.x-gap,y:b.y-gap,w:b.w+gap*2,h:b.h+gap*2};
  });
  // Treat groups as solid obstacles during creation, including empty frames.
  return freeDropPosition(node, obstacles, n=>n===node?boundsOf(n):n, 0);
}
