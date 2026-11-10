import { youTubeId } from './youtube-url.js?v=mwag82om';
import { isProductUrl } from './products.js?v=mwag82om';

// Only newly pasted/dropped links use this default; saved visibility is preserved.
export function showLinkByDefault(value) {
  if (youTubeId(value)) return true;
  if (isProductUrl(value)) return true;
  return isSocialUrl(value);
}

export function isSocialUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    const host = url.hostname.replace(/^(?:www|m|mobile)\./, '');
    return ['facebook.com', 'fb.watch', 'instagram.com', 'instagr.am', 'x.com', 'twitter.com',
      'linkedin.com', 'tiktok.com', 'reddit.com', 'threads.net', 'threads.com', 'bsky.app',
      'pinterest.com', 'snapchat.com', 'twitch.tv'].includes(host);
  } catch { return false; }
}
