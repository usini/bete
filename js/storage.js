// Export / import of a board. Images are embedded as data URLs so the board is
// self-contained: it can be a JSON file, or the file saved on Google Drive (drive.js).
import { state, serialize, setDoc } from './state.js?v=mvzckz4s';
import { addDataUrl, refToDataUrl } from './images.js?v=mvzckz4s';

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// The whole board as a plain object, images included (as data URLs).
export async function exportData() {
  const doc = serialize();
  doc.nodes = await Promise.all(state.nodes.map(async (n) => {
    if (!n.image || !n.image.startsWith('idb:')) return n;
    const data = await refToDataUrl(n.image);
    return { ...n, image: data || undefined };
  }));
  return doc;
}

// Replace the current board by `doc` (from a file or from Drive): the images are stored back
// in IndexedDB, then setDoc() sanitizes everything else. The doc is untrusted input.
export async function importData(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Fichier invalide.');
  if (Array.isArray(doc.nodes)) {
    for (const n of doc.nodes) {
      if (n && typeof n.image === 'string' && n.image.startsWith('data:image/')) {
        n.image = await addDataUrl(n.image);
      }
    }
  }
  setDoc(doc);
}

export async function exportDoc() {
  const doc = await exportData();
  const stamp = new Date().toISOString().slice(0, 10);
  download(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), `bete-${stamp}.json`);
}

export async function importFile(file) {
  try {
    const doc = JSON.parse(await file.text());
    if (!confirm('Remplacer le tableau actuel par ce fichier ?')) return;
    await importData(doc);
  } catch (err) {
    console.warn('bete2: import failed', err);
    alert('Fichier invalide.');
  }
}
