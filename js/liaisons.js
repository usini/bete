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
export function recordLiaison(peer, name) {
  if (!peer) return;
  const list = listLiaisons();
  const i = list.findIndex((x) => x.peer === peer);
  if (i >= 0) {
    if (name) list[i].name = name;
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
  if (i >= 0) { list[i].name = name || peer; save(list); }
}

export function removeLiaison(peer) {
  save(listLiaisons().filter((x) => x.peer !== peer));
}

export function getLiaison(peer) {
  return listLiaisons().find((x) => x.peer === peer) || null;
}
