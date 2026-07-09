// History of visited boards + utilities (unique IDs, URLs).
import { appOrigins, shareOrigin } from './platform.js?v=mrddah4q';

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
  // translated at render time -- see reservedBoardLabel below.
  if (id === 'home') name = 'Home';
  else if (id === 'tutorial') name = 'Tutorial';
  else if (id === 'boards') name = 'Boards';
  const list = listBoards().filter((b) => b.id !== id);
  list.unshift({ id, name: name || id, peer: peer || null, ts: Date.now() });
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* */ }
}

// Reserved board ids always show a translated name instead of their stored
// one (see recordBoard). Returns null for a regular, user-named board.
export function reservedBoardLabel(id, t) {
  if (id === 'home') return t('board.home');
  if (id === 'tutorial') return t('board.tutorial');
  if (id === 'boards') return t('board.boards');
  return null;
}

export function getBoardEntry(id) {
  return listBoards().find((b) => b.id === id) || null;
}

// Forgets a board entirely: its history entry AND its saved content
// (localStorage['bete:'+id], same key state.js uses). Used by the "boards"
// directory board's delete-with-confirmation flow (js/input.js) -- unlike
// deleting a normal rectangle, this destroys real data, so the reserved
// boards (never meant to be deletable) are refused.
export function deleteBoardData(id) {
  if (!id || id === 'home' || id === 'tutorial' || id === 'boards') return;
  const list = listBoards().filter((b) => b.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* */ }
  try { localStorage.removeItem('bete:' + id); } catch (e) { /* */ }
}

// Build the URL of a board (id + peer + optional name for initial display).
// Relative to location.origin: for INTERNAL navigation (switching the current
// window to another local board), which must resolve inside the desktop
// webview too. Links meant to live in a block (copy-pasteable, shareable)
// use buildShareBoardUrl below instead.
export function buildBoardUrl(id, peer, name) {
  return withBoardParams(location.origin + location.pathname, id, peer, name);
}

// Same, but on the shareable origin (public deployment or LAN address on
// desktop, see platform.js: shareOrigin) -- used for "link to board" blocks,
// so a link authored on desktop still means something outside this machine.
// parseBoardUrl recognizes those as internal, so clicking one locally
// navigates in-window instead of opening a browser.
export function buildShareBoardUrl(id, peer, name) {
  return withBoardParams(shareOrigin(), id, peer, name);
}

function withBoardParams(base, id, peer, name) {
  let u = base + '?id=' + encodeURIComponent(id);
  if (peer) u += '&peer=' + encodeURIComponent(peer);
  if (name) u += '&name=' + encodeURIComponent(name);
  return u;
}

// Parse a board URL (returns null if invalid or not a board URL). A URL is a
// board URL when it lives under any of the app's own origins (local window,
// public deployment or LAN address on desktop -- see platform.js: appOrigins).
export function parseBoardUrl(url) {
  try {
    const u = new URL(url, location.href);
    const internal = appOrigins().some((o) => {
      try { const b = new URL(o, location.href); return u.origin === b.origin && u.pathname === b.pathname; }
      catch (e) { return false; }
    });
    if (!internal) return null;
    const id = u.searchParams.get('id');
    if (!id) return null;
    return { id, peer: u.searchParams.get('peer'), name: u.searchParams.get('name') };
  } catch (e) { return null; }
}
