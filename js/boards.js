// Historique des boards visités + utilitaires (ids uniques, URLs).
const KEY = 'todomappa:boards';

// Id de board unique (anti-collision, surtout sur un serveur partagé).
export function genBoardId() {
  return 'b-' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function listBoards() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
}

// Mémorise un board (le plus récent en tête).
export function recordBoard(id, name, peer) {
  if (!id) return;
  if (id === 'home') name = 'Home';        // noms réservés
  else if (id === 'tutorial') name = 'Tutoriel';
  const list = listBoards().filter((b) => b.id !== id);
  list.unshift({ id, name: name || id, peer: peer || null, ts: Date.now() });
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { /* */ }
}

export function getBoardEntry(id) {
  return listBoards().find((b) => b.id === id) || null;
}

// Construit l'URL d'un board (id + peer + nom optionnel pour l'affichage initial).
export function buildBoardUrl(id, peer, name) {
  let u = location.origin + location.pathname + '?id=' + encodeURIComponent(id);
  if (peer) u += '&peer=' + encodeURIComponent(peer);
  if (name) u += '&name=' + encodeURIComponent(name);
  return u;
}

// Si une URL pointe vers un board de cette app, renvoie { id, peer, name }, sinon null.
export function parseBoardUrl(url) {
  try {
    const u = new URL(url, location.href);
    if (u.origin !== location.origin || u.pathname !== location.pathname) return null;
    const id = u.searchParams.get('id');
    if (!id) return null;
    return { id, peer: u.searchParams.get('peer'), name: u.searchParams.get('name') };
  } catch (e) { return null; }
}
