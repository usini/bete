// Accept only the public embed URLs copied from Google Maps, never arbitrary iframe HTML.
export function googleMapsEmbed(raw) {
  let value = String(raw || '').trim();
  if (value.length > 65536) return null;
  if (/^<iframe\b/i.test(value)) {
    const src = value.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    if (!src) return null;
    value = src[2].replace(/&amp;/gi, '&');
  }
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['www.google.com', 'google.com', 'www.google.fr', 'google.fr', 'maps.google.com'].includes(url.hostname) ||
        !/^\/maps\/embed\/?$/.test(url.pathname) || !url.searchParams.get('pb')) return null;
    const clean = new URL('/maps/embed', url.origin);
    clean.searchParams.set('pb', url.searchParams.get('pb'));
    if (url.searchParams.has('hl')) clean.searchParams.set('hl', url.searchParams.get('hl'));
    return clean.href.length <= 2000 ? clean.href : null;
  } catch { return null; }
}

export const googleMapsEmbedOf = node => node.kind === 'rect' && !node.image ? googleMapsEmbed(node.link || node.text) : null;
