import { youTubeId } from './yt.js?v=mvzgwjl8';
import { isAmazonUrl } from './amazon.js?v=mvzgwjl8';

export function plainLink(raw) {
  const text = String(raw || '').trim();
  if (!text || /\s/.test(text) || text.length > 2000) return null;
  const full = /^https?:\/\//i.test(text) ? text : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(text) ? 'https://' + text : null;
  if (!full) return null;
  try {
    const url = new URL(full);
    return url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function genericLink(raw) {
  const url = plainLink(raw);
  return url && !youTubeId(url) && !isAmazonUrl(url) ? url : null;
}
export function droppedLink(data) {
  // Native browser links/bookmarks use URI lists; Firefox can also include a title below the URL.
  for (const line of data.getData('text/uri-list').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const url = plainLink(line);
    if (url) return url;
  }
  return plainLink(data.getData('text/x-moz-url').split(/\r?\n/)[0]) || plainLink(data.getData('text/plain'));
}
export function genericLinkOf(node) {
  return node.kind === 'rect' && !youTubeId(node.text) ? genericLink(node.link || node.text) : null;
}

const icons = new Map();
export function faviconFor(url, redraw) {
  const target = new URL('/favicon.ico', new URL(url).origin).href;
  if (!icons.has(target)) {
    if (icons.size >= 200) return null;
    const entry = { image: null };
    icons.set(target, entry);
    // Unlike a regular cross-origin <img>, fetch explicitly omits credentials.
    // No opaque-response workaround or third-party proxy: CORS failures use the local fallback.
    fetch(target, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(8000) })
      .then(async response => {
        if (!response.ok || !/^(image\/|application\/octet-stream)/i.test(response.headers.get('Content-Type') || '')) return;
        const reader = response.body.getReader();
        const parts = []; let size = 0;
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > 256 * 1024) { await reader.cancel(); return; }
            parts.push(value);
          }
          const blob = new Blob(parts, { type: response.headers.get('Content-Type') });
          // SVG is excluded: only decode small raster favicons.
          if (/svg/i.test(blob.type)) return;
          const objectUrl = URL.createObjectURL(blob), image = new Image();
          try { image.src = objectUrl; await image.decode(); entry.image = image; redraw(); }
          finally { URL.revokeObjectURL(objectUrl); }
        } finally { reader.releaseLock(); }
      }).catch(() => {});
  }
  return icons.get(target).image;
}
