// IndexedDB is used to store binary blobs (voice memos AND images) because localStorage
// is not suitable for large binary data. Audio is indexed by block ID ; images are indexed
// by their content hash (so an identical image is stored once and referenced by 'idb:<hash>').
// The state/board only stores a small reference, never the bytes.
const DB_NAME = 'todomappa';
const STORE = 'audio';
const IMG_STORE = 'images';
let _db = null;

// Open the IndexedDB database (or return the existing connection). Version 2 adds the
// 'images' store (created on upgrade for existing users who were on version 1).
function db() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 2);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      if (!d.objectStoreNames.contains(IMG_STORE)) d.createObjectStore(IMG_STORE);
    };
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

// ---- Images (indexed by content hash) ----
export async function putImage(hash, blob) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).put(blob, hash);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getImage(hash) {
  const d = await db();
  return new Promise((res, rej) => {
    const tx = d.transaction(IMG_STORE, 'readonly');
    const rq = tx.objectStore(IMG_STORE).get(hash);
    rq.onsuccess = () => res(rq.result || null);
    rq.onerror = () => rej(rq.error);
  });
}
