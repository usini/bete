// IndexedDB is used to store audio blobs (voice memos) because localStorage is not suitable for large binary data.
// The audio blobs are indexed by their block ID, while the state/board only stores a reference (ID + duration).
const DB_NAME = 'todomappa';
const STORE = 'audio';
let _db = null;

// Open the IndexedDB database (or return the existing connection).
function db() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
    r.onsuccess = () => { _db = r.result; res(_db); };
    r.onerror = () => rej(r.error);
  });
}

// Store an audio blob in IndexedDB under the given ID.
export async function putAudio(id, blob) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

// Retrieve an audio blob from IndexedDB by its ID.
export async function getAudio(id) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}

// Delete an audio blob from IndexedDB by its ID.
export async function delAudio(id) {
  const d = await db();
  return new Promise((res) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => res();
    tx.onerror = () => res();
  });
}
