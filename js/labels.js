// Labels: the tab above a block. It shows the YouTube title (YouTube blocks) or the block's
// link URL; a block with neither has no label. The layout and the hit-testing live here,
// so the renderer and the pointer handling always agree on where the label is.
import { state } from './state.js?v=mvziqt1v';
import { youTubeId, youTubeTitle } from './yt.js?v=mvziqt1v';
import { FONT_FAMILY } from './text.js?v=mvziqt1v';
import { isAmazonUrl, isAmazonText } from './amazon.js?v=mvziqt1v';

import { genericLink } from './links.js?v=mvziqt1v';

import { serviceForNode } from './services.js?v=mvziqt1v';

export const LABEL_SIZE = 26;                       // font size, world units
export const LABEL_FONT = '600 ' + LABEL_SIZE + 'px ' + FONT_FAMILY;
export const LABEL_H = 40, LABEL_GAP = 6, LABEL_PAD = 12;
export const ICON = 14, ICON_GAP = 12;             // play icon, YouTube blocks only
const MAX_W_FACTOR = 1.5;                          // a tab may be up to 1.5x its block

const PRODUCT_W_FACTOR = 2.5;                      // Amazon product labels may be wider (up to 2.5x)
const measurer = document.createElement('canvas').getContext('2d');

// Called when an async value (a YouTube title) arrives: set by the renderer.
let redraw = () => {};
export function setLabelRedraw(fn) { redraw = fn; }

// What the label of a block shows, or null when it has none.
export function labelInfo(n) {
  if (n.kind === 'group') return null; // a group's text is its title, not a link or a video
  const yt = serviceForNode(n) ? null : youTubeId(n.text);
  if (yt) {
    return {
      kind: 'yt',
      text: youTubeTitle(yt, () => redraw()) || 'Vidéo YouTube',
      href: 'https://www.youtube.com/watch?v=' + yt,
    };
  }
  const link = linkOf(n);
  if (link) {
    // An Amazon link shows the product name, price and delivery time when they were filled in.
    const parts = isAmazonUrl(link) ? [n.name, n.price, n.delivery].filter(Boolean) : [];
    // When the link is only the block's own text (an Amazon URL), the URL is already visible
    // in the block: the label appears once there are product details to show.
    if (!n.link && !parts.length && !genericLink(n.text)) return null;
    return {
      kind: 'link',
      text: parts.length ? parts.join(' · ') : link,
      href: link,
      product: parts.length ? { name: n.name || '', price: n.price || '', delivery: n.delivery || '' } : null,
    };
  }
  return null;
}

// The address a block opens: its link, or its text when that text is an Amazon URL.
export function linkOf(n) {
  if (n.kind === 'group') return null;
  if (n.link) return n.link;
  return isAmazonText(n.text) ? n.text.trim() : genericLink(n.text);
}

function fitLabel(text, maxW) {
  measurer.font = LABEL_FONT;
  if (measurer.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && measurer.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// Product label (Amazon): name | 🏷️ price | 🚚 delivery. Each part is a segment with its own x
// offset (relative to the start of the text); the renderer draws a divider in the gap
// between two segments. Only the name is shortened, so price and delivery stay readable.
const PRICE_ICON = '\u{1F3F7}️';
const DELIVERY_ICON = '\u{1F69A}';
export const LABEL_SEP = 30;     // gap between two segments
const ICON_TEXT_GAP = 8;
function layoutProduct(p, maxW) {
  measurer.font = LABEL_FONT;
  const segs = [];
  if (p.name) segs.push({ icon: '', text: p.name });
  if (p.price) segs.push({ icon: PRICE_ICON, text: p.price });
  if (p.delivery) segs.push({ icon: DELIVERY_ICON, text: p.delivery });
  for (const s of segs) s.iconW = s.icon ? measurer.measureText(s.icon).width + ICON_TEXT_GAP : 0;
  const widthOf = (s) => s.iconW + measurer.measureText(s.text).width;
  if (p.name) {
    const others = segs.slice(1).reduce((sum, s) => sum + widthOf(s), 0);
    const room = maxW - others - LABEL_SEP * (segs.length - 1);
    segs[0].text = fitLabel(p.name.split('\n')[0], Math.max(60, room));
  }
  let x = 0;
  for (const s of segs) { s.x = x; x += widthOf(s) + LABEL_SEP; }
  return { segments: segs, width: x - LABEL_SEP };
}

// Geometry of a block's label, in world units: { info, text, icon, x, y, w, h }, or null.
export function labelLayout(n) {
  const info = labelInfo(n);
  if (!info) return null;
  if (info.product) {
    const maxW = Math.max(40, n.w * PRODUCT_W_FACTOR - 2 * LABEL_PAD);
    const { segments, width } = layoutProduct(info.product, maxW);
    return { info, text: '', icon: false, segments, x: n.x, y: n.y - LABEL_GAP - LABEL_H, w: 2 * LABEL_PAD + width, h: LABEL_H };
  }
  const icon = info.kind === 'yt';
  const iconW = icon ? ICON + ICON_GAP : 0;
  const maxText = Math.max(40, n.w * MAX_W_FACTOR - 2 * LABEL_PAD - iconW);
  const text = fitLabel(info.text.split('\n')[0], maxText);
  measurer.font = LABEL_FONT;
  const w = 2 * LABEL_PAD + iconW + measurer.measureText(text).width;
  return { info, text, icon, x: n.x, y: n.y - LABEL_GAP - LABEL_H, w, h: LABEL_H };
}

// Action buttons, stacked just outside the right edge of a selected block, in world units:
//   top:    📝 — opens the edit popup (text and link), on every block
//   below:  🎨 — change the block colour.
//   last:   🖼️ — change the picture. Image blocks only.
// Sizes and gaps are fixed in screen pixels, so they do not grow with the zoom.
const ACTION_PX = 28, ACTION_GAP_PX = 8, ACTION_STEP_PX = 36;
export function editIconBox(n, zoom) {
  const s = ACTION_PX / zoom, g = ACTION_GAP_PX / zoom;
  return { x: n.x + n.w + g, y: n.y, w: s, h: s };
}
export function colorIconBox(n, zoom) {
  const b = editIconBox(n, zoom);
  const step = ACTION_STEP_PX / zoom;
  return { x: b.x, y: b.y + step, w: b.w, h: b.h };
}
export function imageIconBox(n, zoom) {
  const b = colorIconBox(n, zoom);
  return { ...b, y: b.y + ACTION_STEP_PX / zoom };
}
export const shareIconBox = imageIconBox;
export function deleteIconBox(n, zoom) {
  const b = imageIconBox(n, zoom);
  return { ...b, y: b.y + (n.kind === 'rect' ? 0 : ACTION_STEP_PX / zoom) };
}
function inBox(b, w) {
  return w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h;
}
// 'edit', 'color', 'image' or null: which action button is under the world point w.
export function actionHit(n, w, zoom) {
  if (inBox(deleteIconBox(n, zoom), w)) return 'delete';
  if (inBox(editIconBox(n, zoom), w)) return 'edit';
  if (inBox(colorIconBox(n, zoom), w)) return 'color';
  if (n.kind === 'group' && inBox(shareIconBox(n, zoom), w)) return 'share';
  if (n.kind === 'image' && inBox(imageIconBox(n, zoom), w)) return 'image';
  return null;
}

// The block whose label is under the world point w, or null.
export function labelHit(w) {
  for (let i = state.nodes.length - 1; i >= 0; i--) {
    const n = state.nodes[i];
    const b = labelLayout(n);
    if (b && w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h) return n;
  }
  return null;
}
