// YouTube URL detection in a text + thumbnail/embed helpers.
// A rectangle whose text contains a YouTube URL is rendered as a video.
export function youTubeId(text) {
  if (!text) return null;
  const m = String(text).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
export function ytThumb(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
export function ytEmbed(id) { return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1'; }
