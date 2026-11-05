import { localStore } from './local-store.js?v=mw3ifmhi';

export const githubBoard = new URLSearchParams(location.search).get('github');
export const externalMode = githubBoard !== null;
const RECENTS = 'bete2:githubBoards';
const MAX_BYTES = 50 * 1024 * 1024;

export function githubSource(value) {
  const parts = value.includes('/') ? value.split('/') : value.split('-');
  const [owner, repo, ...rest] = parts;
  const file = (value.includes('/') ? rest.length === 1 && rest[0] : rest.join('-'));
  if (!/^[a-z0-9][a-z0-9-]{0,38}$/i.test(owner || '') ||
      !/^[a-z0-9_][a-z0-9_.-]{0,99}$/i.test(repo || '') ||
      !/^[a-z0-9_][a-z0-9_.-]{0,199}$/i.test(file || '')) return null;
  const name = file.replace(/\.json$/i, '');
  if (!name) return null;
  return { id: [owner, repo, name].join('/'), name, url: `https://raw.githubusercontent.com/${owner}/${repo}/main/${name}.json` };
}

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
