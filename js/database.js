// One database for image blobs and all persistent application values.
let opening;
export function openDatabase() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('bete2', 3);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('media')) db.createObjectStore('media').createIndex('savedAt', 'savedAt');
      for (const store of ['images', 'local']) if (!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Ferme les anciens onglets Bête puis recharge pour mettre à jour le stockage local.'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
  }).catch(error => { opening = null; throw error; });
  return opening;
}
