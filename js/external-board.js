import { githubSource, parseExternalBoardLink } from './external-source.js?v=mw3nilz8';
export { githubSource } from './external-source.js?v=mw3nilz8';
import { localStore } from './local-store.js?v=mw3nilz8';

export const githubBoard = new URLSearchParams(location.search).get('github');
export const externalMode = githubBoard !== null;
const RECENTS = 'bete2:githubBoards';
const MAX_BYTES = 50 * 1024 * 1024;

export function recentGithubBoards() {
  try {
    const values = JSON.parse(localStore.getItem(RECENTS));
    return Array.isArray(values) ? values.filter(value => typeof value === 'string').slice(0, 30).map(githubSource).filter(Boolean) : [];
  } catch { return []; }
}

export async function loadGithubBoard(value) {
  const source = githubSource(value);
  if (!source) throw new Error('Lien GitHub invalide. Utilise COMPTE-DEPOT-FICHIER ou COMPTE/DEPOT/FICHIER.');
  const url = new URL(source.url);
  url.searchParams.set('_t', Date.now().toString());
  const response = await fetch(url, {
    cache: 'no-store',
    credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error',
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error('Fichier introuvable ou dépôt inaccessible sur GitHub (' + response.status + ').');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Le fichier GitHub dépasse 50 Mio.');
      chunks.push(decoder.decode(value, { stream: true }));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  chunks.push(decoder.decode());
  let raw;
  try { raw = JSON.parse(chunks.join('')); } catch { throw new Error('Le fichier GitHub ne contient pas de JSON valide.'); }
  if (!Array.isArray(raw?.nodes)) throw new Error('Le fichier ne contient pas de tableau Bête.');
  const nodes = raw.nodes.slice(0, 5000).map(node => {
    if (!node || typeof node !== 'object') return null;
    let image = node.image;
    if (typeof image === 'string' && image.startsWith('asset:')) {
      const id = image.slice(6);
      image = raw.assets && Object.hasOwn(raw.assets, id) ? raw.assets[id] : null;
    }
    // Only images embedded in the export are available to the viewer.
    if (typeof image !== 'string' || !/^data:image\/(png|jpeg|gif|webp|avif|bmp);base64,/i.test(image)) image = null;
    return { ...node, image, shareId: undefined };
  });
  localStore.setItem(RECENTS, JSON.stringify([source.id, ...recentGithubBoards().map(board => board.id).filter(id => id !== source.id)].slice(0, 30)));
  return { camera: raw.camera, nodes };
}

export async function addExternalBoard(link) {
  const source=parseExternalBoardLink(link,location.origin);
  if(!source)throw new Error('Lien invalide : utilise un lien Bête avec ?github=, COMPTE/DEPOT/FICHIER ou un fichier JSON sur la branche main.');
  const ids=[source.id,...recentGithubBoards().map(b=>b.id).filter(id=>id!==source.id)].slice(0,30);
  if(await localStore.setItem(RECENTS,JSON.stringify(ids))===false)throw new Error('Impossible d’enregistrer le lien sur cet appareil.');
  return source;
}
export async function removeExternalBoard(id) {
  const ids=recentGithubBoards().map(b=>b.id).filter(value=>value!==id);
  if(await localStore.setItem(RECENTS,JSON.stringify(ids))===false)throw new Error('Impossible d’enregistrer la suppression sur cet appareil.');
}
