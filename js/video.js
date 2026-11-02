// Inline YouTube player: an iframe laid over the block, following the camera.
// Only one player at a time. Started by a click on a selected video block.
import { state, getNode } from './state.js?v=mvzaas6o';
import { worldToScreen, view } from './camera.js?v=mvzaas6o';
import { youTubeId, ytEmbed } from './yt.js?v=mvzaas6o';

let activeId = null;
let wrap = null;

export function isVideoPlaying(id) { return activeId === id; }

export function playVideo(n) {
  const vid = youTubeId(n.text);
  if (!vid) return;
  stopVideo();
  activeId = n.id;
  wrap = document.createElement('div');
  wrap.className = 'vp';
  const frame = document.createElement('iframe');
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  frame.src = ytEmbed(vid);
  const close = document.createElement('button');
  close.className = 'vp-x';
  close.textContent = '✕';
  close.title = 'Fermer la vidéo';
  close.addEventListener('click', (e) => { e.stopPropagation(); stopVideo(); });
  wrap.append(frame, close);
  document.body.append(wrap);
  positionVideo();
}

export function stopVideo() {
  if (wrap) { wrap.remove(); wrap = null; }
  activeId = null;
}

// Called on every frame: keeps the iframe on its block, or stops it if the block is gone.
export function positionVideo() {
  if (!wrap) return;
  const n = getNode(activeId);
  if (!n || !youTubeId(n.text)) { stopVideo(); return; }
  const z = state.camera.zoom;
  const p = worldToScreen(n.x, n.y);
  const w = n.w * z, h = n.h * z;
  const offscreen = p.x + w < 0 || p.y + h < 0 || p.x > view.w || p.y > view.h;
  wrap.style.display = offscreen ? 'none' : 'block';
  wrap.style.left = p.x + 'px';
  wrap.style.top = p.y + 'px';
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
}
