// Offload des images en IndexedDB (comme les mémos vocaux) : au lieu de stocker
// une image en base64 dans le contenu synchronisé (énorme, rediffusé à chaque pair),
// on la range dans IndexedDB indexée par le HASH de son contenu, et le bloc ne garde
// qu'une référence courte 'idb:<hash>'. Les octets ne transitent qu'UNE fois par pair
// (via sync.js : imgReq/imgRes), et un pair qui a déjà l'image ne la re-télécharge pas.
import { putImage, getImage } from './audio.js?v=mr26jq6l';
import { requestImage } from './sync.js?v=mr26jq6l';

const els = new Map();   // ref -> HTMLImageElement (cache de rendu, 1 par ref)
const urls = new Map();  // hash -> objectURL (blob décodé, réutilisé)
const reqAt = new Map(); // hash -> dernière demande aux pairs (throttle)
const RE_REQ = 4000;     // ne re-demande pas la même image avant 4 s

function hashOf(ref) { return (ref && ref.indexOf('idb:') === 0) ? ref.slice(4) : null; }

async function sha256Hex(buf) {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// data URL -> Blob (sans fetch, pour marcher hors ligne / file://).
function dataUrlToBlob(dataUrl) {
  const c = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, c), b64 = dataUrl.slice(c + 1);
  const mime = (meta.match(/:(.*?);/) || [])[1] || 'image/png';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function cacheUrl(hash, blob) {
  let u = urls.get(hash);
  if (!u) { u = URL.createObjectURL(blob); urls.set(hash, u); }
  return u;
}

// Range une image (data URL) en IndexedDB, renvoie sa référence 'idb:<hash>'.
export async function storeImage(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  const buf = await blob.arrayBuffer();
  const hash = await sha256Hex(buf);
  await putImage(hash, blob);
  cacheUrl(hash, blob);
  return 'idb:' + hash;
}

function requestOnce(hash) {
  const t = performance.now();
  if (t - (reqAt.get(hash) || 0) < RE_REQ) return;
  reqAt.set(hash, t);
  requestImage(hash);
}

async function loadFromDb(ref, hash, img) {
  try {
    const blob = await getImage(hash);
    if (blob) { img.src = cacheUrl(hash, blob); return; }
  } catch (e) { /* */ }
  requestOnce(hash); // pas en local -> demande aux pairs (sync relaiera)
}

// Élément <img> à dessiner pour une référence de bloc (rendu). Gère :
//  - data URL héritée / URL http (miniature YouTube) : src direct ;
//  - 'idb:<hash>' : charge le blob depuis IndexedDB (ou le demande aux pairs).
export function getImageEl(ref) {
  let img = els.get(ref);
  if (img) {
    const hash = hashOf(ref);
    if (hash && !(img.complete && img.naturalWidth)) {
      if (urls.has(hash)) { if (img.src !== urls.get(hash)) img.src = urls.get(hash); }
      else requestOnce(hash);
    }
    return img;
  }
  img = new Image();
  els.set(ref, img);
  const hash = hashOf(ref);
  if (!hash) { img.src = ref; return img; } // data URL héritée ou URL http
  const u = urls.get(hash);
  if (u) img.src = u; else loadFromDb(ref, hash, img);
  return img;
}

// Résout une référence en une src affichable (pour la popup "Voir l'image").
export async function resolveSrc(ref) {
  if (!ref) return '';
  const hash = hashOf(ref);
  if (!hash) return ref;
  if (urls.has(hash)) return urls.get(hash);
  try { const blob = await getImage(hash); if (blob) return cacheUrl(hash, blob); } catch (e) { /* */ }
  requestOnce(hash);
  return '';
}

// Migration douce : convertit les images héritées (data URL base64 inline dans le
// contenu) en réf 'idb:<hash>'. Enorme gain sur les vieilles boards pleines d'images
// (le contenu synchronisé passe de plusieurs Mo à quelques octets par bloc).
// Best-effort et idempotent : un bloc déjà en 'idb:' est ignoré.
export async function migrateImages(nodes, onChange) {
  let n = 0;
  for (const node of nodes) {
    const img = node.image;
    if (!img || img.indexOf('data:') !== 0) continue; // déjà migré / pas d'image
    try { node.image = await storeImage(img); n++; } catch (e) { /* garde la data URL */ }
  }
  if (n && onChange) onChange();
  return n;
}

function blobToDataUrl(blob) {
  return new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => res('');
    r.readAsDataURL(blob);
  });
}

// Ré-inline les images ('idb:<hash>' -> data URL) pour un export JSON auto-contenu
// (le fichier reste ouvrable sur un autre navigateur sans les pairs). Mute les nœuds
// fournis (utiliser une copie jetable, p.ex. le résultat de serialize()).
export async function inlineImages(nodes) {
  for (const node of nodes || []) {
    const img = node.image;
    if (!img || img.indexOf('idb:') !== 0) continue;
    try { const blob = await getImage(img.slice(4)); if (blob) node.image = await blobToDataUrl(blob); } catch (e) { /* */ }
  }
}

// Appelé par sync.js quand une image arrive d'un pair : met à jour les <img> en attente.
export function onImageArrived(hash, blob) {
  const u = cacheUrl(hash, blob);
  els.forEach((img, ref) => { if (hashOf(ref) === hash) img.src = u; });
}
