import { deliveryDelay } from './delivery.js?v=mw560w8m';
import { isAmazonUrl, shortenAmazon } from './amazon.js?v=mw560w8m';
export const PRODUCT_CLIPBOARD_PREFIX = 'BETE_BLOCK_V1\n';
// Windows clipboard transfers may turn LF into CRLF. Accept either header separator.
const PRODUCT_HEADER = /^\uFEFF?BETE_BLOCK_V1\r?\n/;
export const isProductClipboard = text => typeof text === 'string' && PRODUCT_HEADER.test(text);
// Clipboard data is untrusted: import only product fields, never ids or remote images.
export function parseProductClipboard(text, today = new Date()) {
  if (!isProductClipboard(text) || text.length > 5 * 1024 * 1024) return null;
  try {
    const raw = JSON.parse(text.replace(PRODUCT_HEADER, ''));
    if (!raw || typeof raw.link !== 'string' || raw.link.length > 2000 || !isAmazonUrl(raw.link)) return null;
    const url = new URL(raw.link);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const link = shortenAmazon(raw.link);
    const block = { kind: 'rect', text: link, link, w: 400, h: 300, hideLinkLabel: true };
    for (const field of ['name', 'price', 'delivery']) if (typeof raw[field] === 'string') block[field] = raw[field].trim().slice(0,100);
    if (block.delivery) block.delivery = deliveryDelay(raw.delivery, today) || block.delivery;
    if (typeof raw.image === 'string' && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(raw.image)) {
      block.image = raw.image;
      if (Number.isFinite(raw.w)) block.w = Math.min(1600, Math.max(100, raw.w));
      if (Number.isFinite(raw.h)) block.h = Math.min(1600, Math.max(100, raw.h));
    }
    return block;
  } catch { return null; }
}
