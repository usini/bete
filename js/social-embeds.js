// Only explicit public-post URL formats. No metadata fetch, redirects or third-party proxy.
export function socialEmbed(raw) {
  try {
    const value = String(raw || '').trim();
    if (value.length > 2000) return null;
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
    if (['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com','m.twitter.com'].includes(u.hostname)) {
      const match = u.pathname.match(/^\/(?:[a-zA-Z0-9_]{1,15}\/status|i\/web\/status|i\/status)\/(\d{1,25})(?:\/(?:photo|video)\/\d+)?\/?$/);
      if (!match) return null;
      return { key:'x:'+match[1], className:'x-embed', title:'Publication X',
        src:'https://platform.twitter.com/embed/Tweet.html?id='+match[1]+'&lang=fr&dnt=true&theme=dark',
        action:'Interagir avec le post', minHeight:200 };
    }
    if (['instagram.com','www.instagram.com','instagr.am','www.instagr.am'].includes(u.hostname)) {
      const match = u.pathname.match(/^\/(p|reel)\/([a-zA-Z0-9_-]{1,64})(?:\/embed(?:\/captioned)?)?\/?$/);
      if (!match) return null;
      return { key:'instagram:'+match[1]+':'+match[2], className:'instagram-embed', title:'Publication Instagram',
        src:'https://www.instagram.com/'+match[1]+'/'+match[2]+'/embed/captioned/',
        action:'Interagir avec le post', minHeight:200 };
    }
  } catch { /* Keep unsupported links as ordinary links. */ }
  return null;
}

export const socialEmbedOf = node => node.kind === 'rect' && !node.image ? socialEmbed(node.link || node.text) : null;
