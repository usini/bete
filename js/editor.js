// Edit mode: one popup (modal <dialog>) to change a block's text and link.
// Opened by the 📝 button, a click on a label, Enter, or a double-click on a block with no link.
//  - the text field is hidden for image blocks (they have no text)
//  - the link field is hidden for YouTube blocks (their link is the video itself)
//  - when the link is an Amazon address the popup becomes "Produit Amazon": name, price and
//    delivery time fields appear (typed by hand, shown in the block's label)
// It closes only with the Annuler / Valider buttons (Ctrl+Enter, or Enter in a one-line field, also validate).
import { getNode, emit } from './state.js?v=mvzijf2m';
import { shortenAmazon, shortenAmazonText, isAmazonUrl, isAmazonText } from './amazon.js?v=mvzijf2m';
import { youTubeId } from './yt.js?v=mvzijf2m';
import { addImageFile, imageFor } from './images.js?v=mvzijf2m';

import { genericLink } from './links.js?v=mvzijf2m';

import { isLocked } from './mobile-mode.js?v=mvzijf2m';

import { serviceForNode } from './services.js?v=mvzijf2m';

const dlg = document.getElementById('textdialog');
const title = document.getElementById('dialog-title');
const textField = document.getElementById('text-field');
const linkField = document.getElementById('link-field');
const amazonBox = document.getElementById('amazon-fields');
const el = document.getElementById('editor');
const linkEl = document.getElementById('linkinput');
const errEl = document.getElementById('link-error');
const nameEl = document.getElementById('am-name');
const priceEl = document.getElementById('am-price');
const deliveryEl = document.getElementById('am-delivery');
const imageField = document.getElementById('image-field');
const preview = document.getElementById('image-preview');
const pickBtn = document.getElementById('image-pick');
const removeBtn = document.getElementById('image-remove');
const fileEl = document.getElementById('image-file');
const FIELD_MAX = 100;
let editingId = null;
let ytBlock = false; // no link / image fields: the block is a YouTube block or a group
let isGroup = false; // the block being edited is a group (its text is its title)

// Image chosen or pasted in the popup: only applied on Valider, thrown away on Annuler.
let pendingFile = null;   // a new image (File / Blob) waiting to be stored
let removeImage = false;  // the user asked to remove the block's image
let pendingUrl = '';      // object URL of the preview of pendingFile

function releasePending() {
  if (pendingUrl) URL.revokeObjectURL(pendingUrl);
  pendingUrl = '';
  pendingFile = null;
  removeImage = false;
}

function showPreview(src) {
  if (src) { preview.src = src; preview.hidden = false; }
  else { preview.removeAttribute('src'); preview.hidden = true; }
  removeBtn.hidden = !src;
  pickBtn.textContent = src ? "Changer l'image…" : 'Choisir un fichier…';
}

// Shows the block's current image (it may need a moment to load from IndexedDB).
function showCurrentImage(n) {
  if (!n.image) { showPreview(null); return; }
  const id = n.id;
  const show = () => {
    const img = imageFor(n.image, () => {});
    if (img && editingId === id && !pendingFile && !removeImage) showPreview(img.src);
  };
  showPreview(null);
  imageFor(n.image, show);
  show();
}

function setPendingImage(file) {
  releasePending();
  pendingFile = file;
  pendingUrl = URL.createObjectURL(file);
  showPreview(pendingUrl);
}

export function isEditing() { return editingId !== null; }

// Special Amazon mode, while the block's text is an Amazon address (the text IS the link then,
// so the separate link field is hidden), or the link field holds one (image blocks have no text).
// Shows the product fields and the special look.
function refreshAmazon() {
  const amazonText = !textField.hidden && !isGroup && isAmazonText(shortenAmazonText(el.value));
  linkField.hidden = ytBlock || amazonText;
  const amazonLink = !linkField.hidden && isAmazonUrl(normalizeLink(linkEl.value) || '');
  const on = amazonText || amazonLink;
  amazonBox.hidden = !on;
  dlg.classList.toggle('amazon', on);
  title.textContent = on ? 'Produit Amazon' : isGroup ? 'Modifier le groupe' : 'Modifier le bloc';
}

// focus: 'text' or 'link' — which field gets the cursor (when both are shown).
export function startEdit(id, focus = 'text') {
  const n = getNode(id);
  if (isLocked() || !n || dlg.open) return;
  editingId = id;
  textField.hidden = n.kind === 'image';
  isGroup = n.kind === 'group';
  ytBlock = isGroup || (!serviceForNode(n) && !!youTubeId(n.text));
  textField.querySelector('span').textContent = isGroup ? 'Titre' : 'Texte';
  el.value = n.text;
  linkEl.value = n.link || '';
  nameEl.value = n.name || '';
  priceEl.value = n.price || '';
  deliveryEl.value = n.delivery || '';
  errEl.hidden = true;
  releasePending();
  imageField.hidden = ytBlock; // a YouTube block shows its video thumbnail
  showCurrentImage(n);
  refreshAmazon();
  dlg.showModal();
  const target = textField.hidden || (focus === 'link' && !linkField.hidden) ? linkEl : el;
  target.focus();
  target.setSelectionRange(target.value.length, target.value.length);
}

// '' (no link), a valid http(s) URL, or undefined (invalid). "example.com" gets https://.
// Amazon product links are shortened.
export function normalizeLink(raw) {
  const s = String(raw).trim();
  if (!s) return '';
  const full = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s) ? 'https://' + s : null;
  if (!full || full.length > 2000) return undefined;
  try { return shortenAmazon(full); } catch { return undefined; }
}

// Sets (or removes, when empty) an optional text field of the block. Returns true if it changed.
function setField(n, key, raw) {
  const v = raw.trim().slice(0, FIELD_MAX);
  if (v === (n[key] || '')) return false;
  if (v) n[key] = v;
  else delete n[key];
  return true;
}

export function stopEdit(commit) {
  if (isLocked()) commit = false;
  if (editingId === null) return;
  const n = getNode(editingId);
  if (!commit || !n) {
    editingId = null;
    releasePending();
    if (dlg.open) dlg.close();
    return;
  }
  let link;
  if (!linkField.hidden) {
    link = normalizeLink(linkEl.value);
    if (link === undefined) { // invalid: stay open and say why
      errEl.hidden = false;
      linkEl.focus();
      return;
    }
  }
  editingId = null;
  dlg.close();
  let changed = false;
  let text = n.text;
  if (!textField.hidden) {
    text = isGroup ? el.value : shortenAmazonText(el.value);
    if (text !== n.text) { n.text = text; changed = true; }
  }
  if (link !== undefined && link !== (n.link || '')) {
    if (link) n.link = link;
    else delete n.link;
    changed = true;
  }
  const pastedLink = !isGroup && n.kind === 'rect' && genericLink(n.text);
  if (pastedLink) {
    n.link = pastedLink; n.text = ''; text = ''; link = pastedLink; changed = true;
  }
  // Product details only make sense on an Amazon address (text or link): cleared otherwise.
  const amazon = (!isGroup && isAmazonText(text)) || (!!link && isAmazonUrl(link));
  changed = setField(n, 'name', amazon ? nameEl.value : '') || changed;
  changed = setField(n, 'price', amazon ? priceEl.value : '') || changed;
  changed = setField(n, 'delivery', amazon ? deliveryEl.value : '') || changed;
  if (!imageField.hidden) {
    if (pendingFile) {
      // Stored asynchronously (IndexedDB): the block is updated once the image is saved.
      addImageFile(pendingFile).then((ref) => {
        if (!isLocked() && getNode(n.id)) { n.image = ref; emit(); }
      });
    } else if (removeImage && n.image) {
      delete n.image;
      changed = true;
    }
  }
  pendingFile = null; // already handed over above
  releasePending();
  if (changed) emit();
}

document.getElementById('text-ok').addEventListener('click', () => stopEdit(true));
document.getElementById('text-cancel').addEventListener('click', () => stopEdit(false));
// The popup closes only through Annuler / Valider: Escape and clicks on the backdrop do nothing.
dlg.addEventListener('cancel', (e) => e.preventDefault());
// Chrome can still close a modal dialog on a second Escape press (it cannot be prevented):
// stopEdit() clears editingId before closing, so any other close is unwanted -> reopen.
dlg.addEventListener('close', () => { if (editingId !== null) dlg.showModal(); });
el.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    stopEdit(true);
  }
});
for (const input of [linkEl, nameEl, priceEl, deliveryEl]) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      stopEdit(true);
    }
  });
}
linkEl.addEventListener('input', () => {
  errEl.hidden = true;
  refreshAmazon();
});
el.addEventListener('input', refreshAmazon);

// Image: pick a file, or paste an image (Ctrl+V) anywhere in the popup.
pickBtn.addEventListener('click', () => { fileEl.value = ''; fileEl.click(); });
fileEl.addEventListener('change', () => {
  const file = fileEl.files[0];
  if (file && file.type.startsWith('image/')) setPendingImage(file);
});
removeBtn.addEventListener('click', () => {
  releasePending();
  removeImage = true;
  showPreview(null);
});
dlg.addEventListener('paste', (e) => {
  if (imageField.hidden) return;
  const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((f) => f.type.startsWith('image/'));
  if (!file) return; // plain text: let the field handle it
  e.preventDefault();
  setPendingImage(file);
});
