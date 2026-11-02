// Recognize explicit post URLs only; never resolve share links or fetch metadata.
export function facebookPost(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol !== 'https:' || u.username || u.password || u.port ||
        !['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(u.hostname)) return null;
    const path = u.pathname;
    if (/^\/groups(?:\/|$)/.test(path)) return null;
    const post = /^\/[^/]+\/posts\/[^/]+\/?$/.test(path);
    const permalink = ['/permalink.php', '/story.php'].includes(path) &&
      /^[\w]+$/.test(u.searchParams.get('story_fbid') || '') && /^\d+$/.test(u.searchParams.get('id') || '');
    if (!post && !permalink) return null;
    const clean = new URL(path, 'https://www.facebook.com');
    if (permalink) {
      clean.searchParams.set('story_fbid', u.searchParams.get('story_fbid'));
      clean.searchParams.set('id', u.searchParams.get('id'));
    }
    return clean.href;
  } catch { return null; }
}

export function facebookPostOf(node) {
  return node.kind === 'rect' && !node.image ? facebookPost(node.link || node.text) : null;
}

export function facebookEmbed(post) {
  return 'https://www.facebook.com/plugins/post.php?href=' + encodeURIComponent(post) + '&show_text=true&width=500';
}
