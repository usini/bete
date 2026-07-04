// History of visited boards + utilities (unique IDs, URLs).
import { shareOrigin } from './platform.js?v=mr65a6rk';

const KEY = 'bete:boards';

// Unique board ID (anti-collision, especially on a shared server).
export function genBoardId() {
  return 'b-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function listBoards() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}
// Memorize a board (the most recent at the head).
export function recordBoard(id, name, peer) {
  if (!id) return;
  // Reserved board IDs: stored name is just a fallback, actual display is
  // translated at render time (settings.js special-cases 'home'/'tutorial').
  if (id === 'home') name = 'Home';
  else if (id === 'tutorial') name = 'Tutorial';
  const list = listBoards().filter((b) => b.id !== id);
  list.unshift({ id, name: name || id, peer: peer || null, ts: Date.now() });
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* */ }
}

// Forget a board (e.g., when deleted).
export function getBoardEntry(id) {
  return listBoards().find((b) => b.id === id) || null;
}

// Build the URL of a board (id + peer + optional name for initial display).
export function buildBoardUrl(id, peer, name) {
  let u = location.origin + location.pathname + '?id=' + encodeURIComponent(id);
  if (peer) u += '&peer=' + encodeURIComponent(peer);
  if (name) u += '&name=' + encodeURIComponent(name);
  return u;
}

// Same as buildBoardUrl, but for links handed to OTHER people (a "link to
// board" block, synced to peers) rather than internal navigation — see
// platform.js: shareOrigin() substitutes a reachable address on desktop.
export function buildShareBoardUrl(id, peer, name) {
  let u = shareOrigin() + '?id=' + encodeURIComponent(id);
  if (peer) u += '&peer=' + encodeURIComponent(peer);
  if (name) u += '&name=' + encodeURIComponent(name);
  return u;
}

// Parse a board URL (returns null if invalid or not a board URL).
export function parseBoardUrl(url) {
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin || u.pathname !== location.pathname) return null;
    const id = u.searchParams.get('id');
    if (!id) return null;
    return { id, peer: u.searchParams.get('peer'), name: u.searchParams.get('name') };
  } catch (e) { return null; }
}
