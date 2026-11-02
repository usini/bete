// Export / import of a board as one JSON file. Images are embedded as data URLs
// so the file is self-contained and can be moved to another device.
import { state, serialize, setDoc } from './state.js?v=mvz7o991';
import { addDataUrl, refToDataUrl } from './images.js?v=mvz7o991';

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportDoc() {
  const doc = serialize();
  doc.nodes = await Promise.all(state.nodes.map(async (n) => {
    if (!n.image || !n.image.startsWith('idb:')) return n;
    const data = await refToDataUrl(n.image);
    return { ...n, image: data || undefined };
  }));
  const stamp = new Date().toISOString().slice(0, 10);
  download(new Blob([JSON.stringify(doc, null, 1)], { type: 'application/json' }), `bete-${stamp}.json`);
}

export async function importFile(file) {
  try {
    const doc = JSON.parse(await file.text());
    if (!confirm('Remplacer le tableau actuel par ce fichier ?')) return;
    if (Array.isArray(doc.nodes)) {
      for (const n of doc.nodes) {
        if (n && typeof n.image === 'string' && n.image.startsWith('data:')) {
          n.image = await addDataUrl(n.image);
        }
      }
    }
    setDoc(doc);
  } catch (err) {
    console.warn('bete2: import failed', err);
    alert('Fichier invalide.');
  }
}
