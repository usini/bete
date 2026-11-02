import { state } from './state.js?v=mvziqt1v';
import { worldToScreen, view } from './camera.js?v=mvziqt1v';
import { facebookPostOf, facebookEmbed } from './facebook.js?v=mvziqt1v';

const frames = new Map();

function setInteractive(item, active) {
  item.wrap.dataset.interactive = String(active);
  item.frame.inert = !active;
  item.button.textContent = active ? 'Manipuler le bloc' : 'Interagir avec le post';
  item.button.setAttribute('aria-pressed', String(active));
}

document.addEventListener('pointerdown', e => {
  for (const item of frames.values()) if (!item.wrap.contains(e.target)) setInteractive(item, false);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') for (const item of frames.values()) setInteractive(item, false);
});

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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'facebook-interact';
      wrap.append(frame, button);
      document.body.append(wrap);
      item = { wrap, frame, button, post };
      const entry = item;
      button.addEventListener('click', () => setInteractive(entry, entry.wrap.dataset.interactive !== 'true'));
      setInteractive(item, false);
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
