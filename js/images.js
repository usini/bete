import { fittedImageSize } from './image-size.js?v=mw62q2s5';
// Image blobs live in IndexedDB; nodes only keep a reference 'idb:<id>'.
import { newId, getNode } from './state.js?v=mw62q2s5';

import { openDatabase } from './database.js?v=mw62q2s5';
const STORE = 'images';

async function run(mode, op) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = op(t.objectStore(STORE));
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const putBlob = (id, blob) => run('readwrite', (s) => s.put(blob, id));
const getBlob = (id) => run('readonly', (s) => s.get(id));

export const imageBlob = ref => typeof ref === 'string' && ref.startsWith('idb:') ? getBlob(ref.slice(4)) : Promise.resolve(null);
export async function storeSharedImage(hash, blob) {
  const ref = 'idb:shared-' + hash;
  await putBlob(ref.slice(4), blob);
  cache.delete(ref); // A missing remote image may have already been requested by the renderer.
  return ref;
}

// ref -> { img, ok }. Images are decoded once and then reused by the renderer.
const cache = new Map();

// Reserve the same share of the block during rendering and resizing.
export const imageCaptionFraction = node => node.text?.trim() ? 0.16 : 0;

// Returns a ready HTMLImageElement, or null while it loads (onReady is then called).
export function imageFor(ref, onReady) {
  let e = cache.get(ref);
  if (!e) {
    e = { img: new Image(), ok: false };
    cache.set(ref, e);
    loadRef(ref, e, onReady);
  }
  return e.ok ? e.img : null;
}

async function loadRef(ref, e, onReady) {
  try {
    let src = ref;
    if (ref.startsWith('idb:')) {
      const blob = await getBlob(ref.slice(4));
      if (!blob) return;
      src = URL.createObjectURL(blob);
    }
    e.img.src = src;
    await e.img.decode();
    e.ok = true;
    onReady();
  } catch (err) {
    console.warn('bete2: image load failed', err);
  }
}

// Return a new reference so undo and other blocks can keep the original.
export async function optimizeImage(ref) {
  const blob = ref.startsWith('idb:') ? await imageBlob(ref) : await (await fetch(ref)).blob();
  if (!blob || !['image/jpeg', 'image/png'].includes(blob.type)) return null;
  if (blob.type === 'image/png' && new TextDecoder('latin1').decode(await blob.arrayBuffer()).includes('acTL')) return null;

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const compressed = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.86));
    if (compressed?.type !== 'image/webp' || compressed.size >= blob.size) return null;
    return addImageFile(compressed);
  } finally {
    bitmap.close();
  }
}

export async function addImageFile(file) {
  const id = newId();
  await putBlob(id, file);
  return 'idb:' + id;
}

export async function addDataUrl(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return addImageFile(blob);
}

export async function refToDataUrl(ref) {
  const blob = await getBlob(ref.slice(4));
  return blob ? blobToDataUrl(blob) : null;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function fitNodeImage(node) {
  const ref = node.image;
  if (!ref) return false;
  let bitmap;
  try {
    const blob = ref.startsWith('idb:') ? await imageBlob(ref) : await (await fetch(ref)).blob();
    if (!blob) return false;
    bitmap = await createImageBitmap(blob);
    if (getNode(node.id) !== node || node.image !== ref) return false;
    const size = fittedImageSize(node, bitmap.width, bitmap.height);
    if (!size) return false;
    Object.assign(node, size);
    return true;
  } catch { return false; }
  finally { bitmap?.close(); }
}
