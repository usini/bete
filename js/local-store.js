import { openDatabase } from './database.js?v=mw4v3cov';
import { notify } from './notifications.js?v=mw4v3cov';

// Consumers read a preloaded cache; every mutation creates an IndexedDB transaction.
// This preserves synchronous change detection without retaining the Web Storage quota.
const values = new Map();
const pending = new Set();
let database;
let failed = false;
let reported = false;

function report(error) {
  failed = true;
  console.warn('bete2: IndexedDB save failed', error);
  if (!reported) notify('Sauvegarde locale indisponible. Exporte ton tableau en JSON avant de fermer. ' + (error?.message || ''),
    { id: 'local-storage', type: 'error', duration: 0 });
  reported = true;
}

function transaction(op) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction('local', 'readwrite');
    tx.oncomplete = () => resolve(true);
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('Écriture locale interrompue.'));
    try { op(tx.objectStore('local')); }
    catch (error) { tx.abort(); reject(error); }
  });
}

// Keep legacy data intact until the complete migration transaction has committed.
const legacy = new Map();
try {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('bete2:') && key !== 'bete2:driveToken') legacy.set(key, localStorage.getItem(key));
  }
  localStorage.removeItem('bete2:driveToken');
} catch { /* Legacy Web Storage may be disabled independently of IndexedDB. */ }

try {
  database = await openDatabase();
  await new Promise((resolve, reject) => {
    const tx = database.transaction('local', 'readonly');
    const request = tx.objectStore('local').openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { values.set(cursor.key, cursor.value); cursor.continue(); }
    };
    tx.oncomplete = resolve;
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
  if (legacy.size) {
    const missing = [...legacy].filter(([key]) => !values.has(key));
    await transaction(store => { for (const [key, value] of missing) store.put(value, key); });
    for (const [key, value] of missing) values.set(key, value);
    for (const [key, value] of legacy) {
      try { if (localStorage.getItem(key) === value) localStorage.removeItem(key); } catch { /* Keep the legacy copy if removal is blocked. */ }
    }
  }
} catch (error) {
  for (const [key, value] of legacy) if (!values.has(key)) values.set(key, value);
  // Do not overwrite unread existing data after a failed database read or migration.
  database = null;
  report(error);
}

function write(op) {
  let task;
  try {
    if (!database) throw new Error('Stockage indisponible : recharge après avoir exporté le tableau.');
    task = transaction(op);
  } catch (error) { task = Promise.reject(error); }
  const result = task.catch(error => { report(error); return false; });
  pending.add(result);
  result.then(() => pending.delete(result));
  return result;
}

export const localStore = {
  getItem: key => values.get(key) ?? null,
  setItem(key, value) { value = String(value); values.set(key, value); return write(store => store.put(value, key)); },
  removeItem(key) { values.delete(key); return write(store => store.delete(key)); },
};

export async function flushLocalWrites() {
  await Promise.all([...pending]);
  return !failed;
}

export const localStorageFailed = () => failed;
