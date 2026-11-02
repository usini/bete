import { state, select } from './state.js?v=mvzpna3r';
import { worldToScreen, view } from './camera.js?v=mvzpna3r';
import { facebookPostOf, facebookEmbed } from './facebook.js?v=mvzpna3r';
import { googleMapsEmbedOf } from './google-maps.js?v=mvzpna3r';

const frames = new Map();

function setInteractive(item, active) {
  item.wrap.dataset.interactive = String(active);
  item.frame.inert = !active;
  item.button.textContent = active ? 'Manipuler le bloc' : item.action;
  item.button.setAttribute('aria-pressed', String(active));
}

document.addEventListener('pointerdown', e => {
  for (const item of frames.values()) if (!item.wrap.contains(e.target)) setInteractive(item, false);
});
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') for (const item of frames.values()) setInteractive(item, false);
});

// Keep visible embeds attached to their blocks. Offscreen content is unloaded.
export function positionEmbeds() {
  const visible = new Set();
  for (const n of state.nodes) {
    const map = googleMapsEmbedOf(n);
    const post = map || facebookPostOf(n);
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
      wrap.className = 'embedded-block ' + (map ? 'maps-embed' : 'facebook-post');
      wrap.dataset.nodeId = n.id;
      const frame = document.createElement('iframe');
      frame.title = map ? 'Carte Google Maps' : 'Publication Facebook';
      frame.referrerPolicy = 'no-referrer';
      frame.allow = 'encrypted-media; picture-in-picture; fullscreen';
      frame.allowFullscreen = true;
      frame.src = map || facebookEmbed(post);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'facebook-interact';
      wrap.append(frame, button);
      document.body.append(wrap);
      item = { wrap, frame, button, post, action: map ? 'Interagir avec la carte' : 'Interagir avec le post' };
      const entry = item;
      button.addEventListener('click', () => {
        select(entry.wrap.dataset.nodeId);
        setInteractive(entry, entry.wrap.dataset.interactive !== 'true');
      });
      setInteractive(item, false);
      frames.set(n.id, item);
    }
    Object.assign(item.wrap.style, { left: p.x + 'px', top: p.y + 'px', width: w + 'px', height: h + 'px' });
    const scale = w / 500;
    Object.assign(item.frame.style, { width: '500px', height: Math.max(map ? 200 : 100, h / scale) + 'px', transform: `scale(${scale})` });
  }
  for (const [id, item] of frames) if (!visible.has(id)) {
    item.wrap.remove(); frames.delete(id);
  }
}
