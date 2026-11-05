import { localStore } from './local-store.js?v=mw3ifmhi';
// YouTube helpers: URL detection, thumbnail / embed URLs, and video titles.
// A rectangle whose text contains a YouTube URL is rendered as a video.
export { youTubeId } from './youtube-url.js?v=mw3ifmhi';
export function ytThumb(id) { return 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg'; }
export function ytEmbed(id) { return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&playsinline=1'; }

// ---- Titles (YouTube oEmbed, no API key) ----
// Cached in IndexedDB so titles survive offline. A missing title (deleted/private
// video) is cached as null; a network error is retried after RETRY_MS.
const TITLE_KEY = 'bete2:ytTitles';
const RETRY_MS = 60000;
const titles = new Map();   // id -> title | null
const pending = new Set();
const failedAt = new Map(); // id -> timestamp of last network failure

try {
  const saved = JSON.parse(localStore.getItem(TITLE_KEY) || '{}');
  for (const id of Object.keys(saved)) titles.set(id, saved[id]);
} catch { /* no cache available */ }

function saveTitles() {
  try { localStore.setItem(TITLE_KEY, JSON.stringify(Object.fromEntries(titles))); }
  catch { /* storage full or blocked: titles just won't persist */ }
}

export const cachedYouTubeTitle = id => titles.get(id) || null;

// Returns the cached title (or null while unknown); onReady is called once it arrives.
export function youTubeTitle(id, onReady) {
  if (titles.has(id)) return titles.get(id);
  if (pending.has(id)) return null;
  const last = failedAt.get(id);
  if (last && Date.now() - last < RETRY_MS) return null;
  pending.add(id);
  fetchTitle(id).then((res) => {
    pending.delete(id);
    if (res === undefined) { failedAt.set(id, Date.now()); return; }
    titles.set(id, res);
    saveTitles();
    onReady();
  });
  return null;
}

// Resolves to the title, null if YouTube has none, or undefined on a network error.
async function fetchTitle(id) {
  try {
    const url = 'https://www.youtube.com/oembed?format=json&url='
      + encodeURIComponent('https://www.youtube.com/watch?v=' + id);
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return typeof j.title === 'string' ? j.title.slice(0, 200) : null;
  } catch {
    return undefined;
  }
}
