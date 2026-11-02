// Export / import of a board. Images are embedded as data URLs so the board is
// self-contained: it can be a JSON file, or the file saved on Google Drive (drive.js).
import { state, serialize, setDoc } from './state.js?v=mvzq511p';
import { addDataUrl, refToDataUrl } from './images.js?v=mvzq511p';


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
  const images = new Map();
  const assets = {};
  const assetByData = new Map();
  let count = 0;
  const embed = async (n) => {
    if (!n.image || (!n.image.startsWith('idb:') && !n.image.startsWith('data:image/'))) return n;
    if (!images.has(n.image)) images.set(n.image, n.image.startsWith('idb:') ? refToDataUrl(n.image) : Promise.resolve(n.image));
    const data = await images.get(n.image);
    if (!data) throw new Error('Une image manque encore sur cet appareil. Attends sa réception avant la sauvegarde ou l’export.');
    if (!assetByData.has(data)) {
      const id = 'image-' + (++count);
      assetByData.set(data, id);
      assets[id] = data;
    }
    return { ...n, image: 'asset:' + assetByData.get(data) };
  };
  doc.nodes = await Promise.all(doc.nodes.map(embed));
  if (doc.history) doc.history.states = await Promise.all(doc.history.states.map(async s => ({
    ...s, nodes: await Promise.all(s.nodes.map(embed)),
  })));
  return { ...doc, version: 2, assets };
}

// Replace the current board by `doc` (from a file or from Drive): the images are stored back
// in IndexedDB, then setDoc() sanitizes everything else. The doc is untrusted input.
export async function importData(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('Fichier invalide.');
  const images = new Map();
  const assetData = ref => {
    const id = ref.slice(6);
    const data = doc.assets && Object.hasOwn(doc.assets, id) ? doc.assets[id] : null;
    if (typeof data !== 'string' || !data.startsWith('data:image/') || data.length >= 20e6)
      throw new Error('Une image référencée dans ce fichier est absente ou invalide.');
    return data;
  };
  const restore = async (nodes) => Promise.all((Array.isArray(nodes) ? nodes.slice(0, 5000) : []).map(async n => {
    if (typeof n?.image === 'string' && n.image.startsWith('asset:')) n = { ...n, image: assetData(n.image) };
    if (n && typeof n.image === 'string' && n.image.startsWith('data:image/') && n.image.length < 20e6) {
      if (!images.has(n.image)) images.set(n.image, addDataUrl(n.image));
      return { ...n, image: await images.get(n.image) };
    }
    return n;
  }));
  doc = { ...doc, nodes: await restore(doc.nodes) };
  if (Array.isArray(doc.history?.states)) doc.history = {
    pos: doc.history.pos,
    states: await Promise.all(doc.history.states.slice(0, 60).map(async s => ({
      ...s, nodes: await restore(s?.nodes),
    }))),
  };
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
