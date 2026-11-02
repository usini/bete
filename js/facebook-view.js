import { state } from './state.js?v=mvzijf2m';
import { worldToScreen, view } from './camera.js?v=mvzijf2m';
import { facebookPostOf, facebookEmbed } from './facebook.js?v=mvzijf2m';

const frames = new Map();

// Keep visible posts attached to their blocks. Offscreen posts are unloaded.
export function positionFacebookPosts() {
  const visible = new Set();
  for (const n of state.nodes) {
    const post = facebookPostOf(n);
    if (!post) continue;
    const p = worldToScreen(n.x + 8, n.y + 8);
    const w = Math.max(1, n.w - 16) * state.camera.zoom;
    const h = Math.max(1, n.h - 16) * state.camera.zoom;
    if (p.x + w < 0 || p.y + h < 0 || p.x > view.w || p.y > view.h) continue;
    visible.add(n.id);
    let item = frames.get(n.id);
    if (item && item.post !== post) { item.wrap.remove(); frames.delete(n.id); item = null; }
    if (!item) {
      const wrap = document.createElement('div');
      wrap.className = 'facebook-post';
      wrap.dataset.nodeId = n.id;
      const frame = document.createElement('iframe');
      frame.title = 'Publication Facebook';
      frame.referrerPolicy = 'no-referrer';
      frame.src = facebookEmbed(post);
      wrap.append(frame);
      document.body.append(wrap);
      item = { wrap, frame, post };
      frames.set(n.id, item);
    }
    Object.assign(item.wrap.style, { left: p.x + 'px', top: p.y + 'px', width: w + 'px', height: h + 'px' });
    const scale = w / 500;
    Object.assign(item.frame.style, { width: '500px', height: Math.max(100, h / scale) + 'px', transform: `scale(${scale})` });
  }
  for (const [id, item] of frames) if (!visible.has(id)) {
    item.wrap.remove(); frames.delete(id);
  }
}
