import { youTubeId } from './yt.js?v=mvzijf2m';
import { isAmazonUrl } from './amazon.js?v=mvzijf2m';

import { serviceForUrl } from './services.js?v=mvzijf2m';

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
  return url && (serviceForUrl(url) || (!youTubeId(url) && !isAmazonUrl(url))) ? url : null;
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
export function droppedTitle(data, url) {
  const title = value => {
    const text = String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return text && !plainLink(text) ? text.slice(0, 500) : '';
  };
  const html = data.getData('text/html');
  if (html && html.length <= 65536 && typeof document !== 'undefined') {
    // A disconnected template is inert: no page navigation, scripts or image requests.
    const template = document.createElement('template');
    template.innerHTML = html;
    template.content.querySelectorAll('script, style, noscript').forEach(n => n.remove());
    const anchors = [...template.content.querySelectorAll('a[href]')];
    const anchor = anchors.find(a => plainLink(a.getAttribute('href')) === url) || (anchors.length === 1 ? anchors[0] : null);
    const text = title(anchor?.textContent) || title(anchor?.getAttribute('title'));
    if (text) return text;
  }
  return title(data.getData('text/x-moz-url').split(/\r?\n/).slice(1).join(' '))
    || title(data.getData('text/x-moz-url-desc')) || title(data.getData('text/plain'));
}
export function genericLinkOf(node) {
  return node.kind === 'rect' && (serviceForUrl(node.link || node.text) || !youTubeId(node.text)) ? genericLink(node.link || node.text) : null;
}
