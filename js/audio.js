// Stockage des blobs audio (mémos vocaux) dans IndexedDB.
// localStorage ne convient pas (binaire volumineux) : on garde ici le Blob,
// indexé par l'id du bloc ; l'état/board ne stocke que la référence (id + durée).
const DB_NAME = 'todomappa';
const STORE = 'audio';
let _db = null;

function db() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}

export async function putAudio(id, blob) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getAudio(id) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

export async function delAudio(id) {
  const d = await db();
  return new Promise((res) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}
