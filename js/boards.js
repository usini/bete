// History of visited boards + utilities (unique IDs, URLs).
import { appOrigins } from './platform.js?v=mrdf3ucb';

const KEY = 'bete:boards';

// Unique board ID (anti-collision, especially on a shared server).
export function genBoardId() {
  return 'b-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function listBoards() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}
// Memorize a board (the most recent at the head). A falsy `name` PRESERVES
// whatever name this board already had on file (id as a last resort for a
// never-seen board) instead of clobbering it -- callers that only know the
// id/peer at this point (e.g. following a board link) rely on this to not
// blow away a name that arrived earlier via sync (see sync.js: merge()).
export function recordBoard(id, name, peer) {
  if (!id) return;
  // Reserved board IDs: stored name is just a fallback, actual display is
  // translated at render time -- see reservedBoardLabel below.
  if (id === 'home') name = 'Home';
  else if (id === 'tutorial') name = 'Tutorial';
  else if (id === 'boards') name = 'Boards';
  const list = listBoards();
  const i = list.findIndex((b) => b.id === id);
  const finalName = name || (i >= 0 && list[i].name) || id;
  if (i >= 0) list.splice(i, 1);
  list.unshift({ id, name: finalName, peer: peer || null, ts: Date.now() });
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

// Build the URL of a board (id + peer). Deliberately origin-less (just
// "?id=...&peer=..."): a board block travels inside synced content (see
// sync.js), so baking in *this* device's origin would break the link for a
// peer on a different domain/fork, or for a JSON export re-opened elsewhere
// -- a bare query string resolves against whatever page it's clicked from
// (see platform.js's comment on why this differs from the Liaison QR link,
// which genuinely needs an absolute, shareable address). No name param
// either -- a board/liaison's display name now arrives over the wire, like
// the rest of the content (see sync.js: merge() adopts a synced `bn` when
// the local one is still empty), instead of being guessed from whatever the
// link happened to be created with.
export function buildBoardUrl(id, peer) {
  let u = '?id=' + encodeURIComponent(id);
  if (peer) u += '&peer=' + encodeURIComponent(peer);
  return u;
}

// Parse a board URL (returns null if invalid or not a board URL). Accepts
// both today's origin-less form and legacy absolute links (old exports/synced
// boards saved before buildBoardUrl dropped the origin) -- a URL is a board
// URL when it's either relative or lives under one of the app's own origins
// (local window, public deployment or LAN address on desktop -- see
// platform.js: appOrigins).
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
    return { id, peer: u.searchParams.get('peer') };
  } catch (e) { return null; }
}
