// Named liaisons (local to the browser): Server 1, Family, Temporary…
// A liaison = a peer (host) id to connect to, + a chosen name.
const KEY = 'bete:liaisons';

export function listLiaisons() {
  try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function save(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50))); } catch (e) { /* */ }
}

// Adds (or bumps) a liaison. name is optional (defaults to the id).
// A name passed here (e.g. from a share URL) never overwrites a name the
// user chose locally (renameLiaison sets the renamed flag; entries from
// before that flag existed count as renamed when their name differs from
// the raw peer id).
export function recordLiaison(peer, name) {
  if (!peer) return;
  const list = listLiaisons();
  const i = list.findIndex((x) => x.peer === peer);
  if (i >= 0) {
    const renamed = list[i].renamed || (list[i].name && list[i].name !== peer);
    if (name && !renamed) list[i].name = name;
    const [e] = list.splice(i, 1);
    list.unshift(e);
  } else {
    list.unshift({ peer, name: name || peer });
  }
  save(list);
}

export function renameLiaison(peer, name) {
  const list = listLiaisons();
  const i = list.findIndex((x) => x.peer === peer);
  if (i >= 0) { list[i].name = name || peer; list[i].renamed = true; save(list); }
}

export function removeLiaison(peer) {
  save(listLiaisons().filter((x) => x.peer !== peer));
}

export function getLiaison(peer) {
  return listLiaisons().find((x) => x.peer === peer) || null;
}

// Owner token (per board): a random secret this browser presents to a
// headless host (e.g. Raspberry Pi, see server/bete-host.js) to prove it's
// the board's owner there. The server adopts whichever token shows up first
// for a fresh board (first-claim, same trust model as the peer id itself)
// and checks it on every later connection -- a browser-hosted liaison never
// needs this (the hosting tab edits state directly, no token involved), but
// sending it there too is harmless (a browser host just ignores it).
const OWNER_KEY_PREFIX = 'bete:ownerkey:';
export function getOwnerToken(boardId) {
  const key = OWNER_KEY_PREFIX + (boardId || 'home');
  try {
    let token = localStorage.getItem(key);
    if (!token) {
      token = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('o-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
      localStorage.setItem(key, token);
    }
    return token;
  } catch (e) { return null; }
}
