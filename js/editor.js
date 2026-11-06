import { exportGroup, GROUP_PREFIX } from './group-transfer.js?v=mw4v3cov';
import { notify } from './notifications.js?v=mw4v3cov';
import { githubRepository } from './github-repo.js?v=mw4v3cov';
import { updateGitHubCard } from './github-cards.js?v=mw4v3cov';
import { alignmentPlan } from './alignment.js?v=mw4v3cov';
import { labelLayout } from './labels.js?v=mw4v3cov';
import { amazonBadgeLayout } from './amazon.js?v=mw4v3cov';
import { freeDropPosition } from './placement.js?v=mw4v3cov';
// Edit mode: one popup (modal <dialog>) to change a block's text and link.
// Opened by the 📝 button, a click on a label, Enter, or a double-click on a block with no link.
//  - the text field is hidden for image blocks (they have no text)
//  - the link field is hidden for YouTube blocks (their link is the video itself)
//  - when the link is an Amazon address the popup becomes "Produit Amazon": name, price and
//    delivery time fields appear (typed by hand, shown in the block's label)
// It closes only with the Annuler / Valider buttons (Ctrl+Enter, or Enter in a one-line field, also validate).
import { state, getNode, emit, membersOf, fitGroupsAround, containingGroups, saveNow } from './state.js?v=mw4v3cov';
import { shortenAmazon, shortenAmazonText, isAmazonUrl, isAmazonText } from './amazon.js?v=mw4v3cov';
import { youTubeId } from './yt.js?v=mw4v3cov';
import { addImageFile, imageFor, fitNodeImage } from './images.js?v=mw4v3cov';

import { genericLink } from './links.js?v=mw4v3cov';

import { isLocked } from './mobile-mode.js?v=mw4v3cov';

import { serviceForNode } from './services.js?v=mw4v3cov';
import { deliveryDelay } from './delivery.js?v=mw4v3cov';
import { googleMapsEmbed } from './google-maps.js?v=mw4v3cov';

const dlg = document.getElementById('textdialog');
const title = document.getElementById('dialog-title');
const textField = document.getElementById('text-field');
const linkField = document.getElementById('link-field');
const amazonBox = document.getElementById('amazon-fields');
const el = document.getElementById('editor');
const linkEl = document.getElementById('linkinput');
const hideLinkLabel = document.getElementById('hide-link-label');
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
const alignSection = document.getElementById('group-align');
const alignStatus = document.getElementById('group-align-status');
const alignPreview = document.getElementById('group-align-preview');
let pendingAlignment = null;
let pendingApplication = null;
let editingId = null;
let ytBlock = false; // no link / image fields: the block is a YouTube block or a group
let isApplication = false;
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
  const amazonText = !textField.hidden && !isGroup && !isApplication && isAmazonText(shortenAmazonText(el.value));
  linkField.hidden = ytBlock || amazonText;
  const amazonLink = !linkField.hidden && isAmazonUrl(normalizeLink(linkEl.value) || '');
  const on = amazonText || amazonLink;
  amazonBox.hidden = !on;
  dlg.classList.toggle('amazon', on);
  title.textContent = on ? 'Produit Amazon' : isGroup ? 'Modifier le groupe' : isApplication ? 'Modifier l’application' : 'Modifier le bloc';
}

// focus: 'text' or 'link' — which field gets the cursor (when both are shown).
export function startEdit(id, focus = 'text') {
  const n = getNode(id);
  if (isLocked() || !n || dlg.open) return;
  editingId = id;
  document.getElementById('github-refresh').textContent = 'Actualiser les informations GitHub';
  pendingAlignment = null;
  pendingApplication = null;
  document.getElementById('application-change').hidden = !n.application || !window.__TAURI__;
  document.getElementById('application-change').textContent = 'Changer l’application…';
  alignSection.hidden = n.kind !== 'group';
  alignPreview.hidden = true;
  alignStatus.textContent = 'Prépare un aperçu du rangement des blocs.';
  textField.hidden = n.kind === 'image';
  isGroup = n.kind === 'group';
  isApplication = !!n.application;
  ytBlock = isGroup || isApplication || (!serviceForNode(n) && !!youTubeId(n.text));
  textField.querySelector('span').textContent = isGroup ? 'Titre' : 'Texte';
  el.value = n.text;
  linkEl.value = n.link || '';
  hideLinkLabel.closest('label').hidden = isGroup || isApplication;
  hideLinkLabel.checked = n.hideLinkLabel === true;
  nameEl.value = n.name || '';
  priceEl.value = n.price || '';
  deliveryEl.value = n.delivery || '';
  errEl.hidden = true;
  releasePending();
  imageField.hidden = ytBlock; // a YouTube block shows its video thumbnail
  showCurrentImage(n);
  refreshAmazon();
  document.getElementById('github-refresh').hidden = !githubRepository(n.link || n.text);
  dlg.showModal();
  const target = textField.hidden || (focus === 'link' && !linkField.hidden) ? linkEl : el;
  target.focus();
  target.setSelectionRange(target.value.length, target.value.length);
}

// '' (no link), a valid http(s) URL, or undefined (invalid). "example.com" gets https://.
// Amazon product links are shortened.
export function normalizeLink(raw) {
  const map = googleMapsEmbed(raw);
  if (map) return map;
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
    pendingAlignment = null;
    pendingApplication = null;
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
  if (pendingAlignment) saveNow();
  editingId = null;
  dlg.close();
  const originalLink = n.link || n.text;
  let changed = false;
  if (pendingApplication && n.application) {
    n.application = pendingApplication;
    el.value = pendingApplication.label;
    changed = true;
  }
  pendingApplication = null;
  let imageSave = null;
  if (!isGroup && hideLinkLabel.checked !== (n.hideLinkLabel === true)) {
    if (hideLinkLabel.checked) n.hideLinkLabel = true;
    else delete n.hideLinkLabel;
    changed = true;
  }
  let text = n.text;
  if (!textField.hidden) {
    text = isGroup ? el.value : shortenAmazonText(el.value);
    if (text !== n.text) { n.text = text; changed = true; }
    if (n.application) n.application.label = text.trim().slice(0,100) || 'Application';
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
  changed = setField(n, 'delivery', amazon ? (deliveryDelay(deliveryEl.value) || deliveryEl.value) : '') || changed;
  if (!imageField.hidden) {
    if (pendingFile) {
      // Stored asynchronously (IndexedDB): the block is updated once the image is saved.
      imageSave = addImageFile(pendingFile).then(async (ref) => {
        if (!isLocked() && getNode(n.id) === n) {
          const previousGroups = containingGroups(n);
          n.image = ref;
          await fitNodeImage(n);
          if (getNode(n.id) !== n) return;
          fitGroupsAround(n, previousGroups, true);
          emit();
        }
      });
    } else if (removeImage && n.image) {
      delete n.image;
      changed = true;
    }
  }
  pendingFile = null; // already handed over above
  releasePending();
  if (pendingAlignment && isGroup) {
    for (const placement of pendingAlignment.nodes) {
      const block = getNode(placement.id);
      if (!block) continue;
      const dx = placement.x - block.x, dy = placement.y - block.y;
      if (block.kind === 'group') for (const child of membersOf(block)) { child.x += dx; child.y += dy; }
      Object.assign(block, { x: placement.x, y: placement.y, w: placement.w, h: placement.h });
    }
    fitGroupsAround(null, [n]);
    const contents = membersOf(n);
    const obstacles = state.nodes.filter(other => other.kind === 'group' && other !== n && !contents.includes(other) && !membersOf(other).includes(n)).map(other => ({...other, kind:'rect'}));
    const position = freeDropPosition(n, obstacles);
    const dx = position.x - n.x, dy = position.y - n.y;
    n.x += dx; n.y += dy;
    for (const child of contents) { child.x += dx; child.y += dy; }
    changed = true;
  }
  pendingAlignment = null;
  if (changed) {
    emit();
    if ((n.link || n.text) !== originalLink) updateGitHubCard(n);
  }
  return imageSave;
}

document.getElementById('text-ok').addEventListener('click', () => stopEdit(true));
document.getElementById('text-cancel').addEventListener('click', () => stopEdit(false));
// The popup closes only through Annuler / Valider: Escape and clicks on the backdrop do nothing.
dlg.addEventListener('cancel', (e) => e.preventDefault());
// Chrome can still close a modal dialog on a second Escape press (it cannot be prevented):
// stopEdit() clears editingId before closing, so any other close is unwanted -> reopen.
dlg.addEventListener('close', () => { if (editingId !== null) dlg.showModal(); });
el.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.isComposing && (!e.shiftKey || e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    stopEdit(true);
  }
});
deliveryEl.addEventListener('paste', e => {
  if (isLocked()) return;
  const delay = deliveryDelay(e.clipboardData?.getData('text/plain'));
  if (!delay) return;
  e.preventDefault();
  deliveryEl.value = delay;
});
deliveryEl.addEventListener('blur', () => {
  const delay = deliveryDelay(deliveryEl.value);
  if (delay) deliveryEl.value = delay;
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

function alignmentBounds(n) {
  const boxes=[n,labelLayout(n),amazonBadgeLayout(n)].filter(Boolean);
  const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  return {x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};
}
document.getElementById('group-align-button').addEventListener('click', () => {
  const group=getNode(editingId);
  if (isLocked() || group?.kind !== 'group') return;
  const all=membersOf(group);
  const nested=all.filter(n=>n.kind==='group');
  const descendants=new Set(nested.flatMap(n=>membersOf(n)));
  const members=all.filter(n=>!descendants.has(n));
  pendingAlignment=alignmentPlan(group,members,alignmentBounds);
  const ids=new Set(pendingAlignment.nodes.map(n=>n.id));
  const obstacles=state.nodes.filter(n=>n.kind!=='group'&&!ids.has(n.id)&&!descendants.has(n));
  for(const block of pendingAlignment.nodes){
    Object.assign(block,freeDropPosition(block,obstacles,alignmentBounds));
    obstacles.push(block);
  }
  alignStatus.textContent=pendingAlignment.mode+(pendingAlignment.nodes.length?' — Valider pour appliquer, Annuler pour conserver.':'');
  const displayed=members.map(n=>pendingAlignment.nodes.find(p=>p.id===n.id)||n);
  alignPreview.hidden=!displayed.length;
  if(!displayed.length)return;
  const ctx=alignPreview.getContext('2d'), boxes=displayed.map(alignmentBounds);
  const x=Math.min(...boxes.map(b=>b.x)), y=Math.min(...boxes.map(b=>b.y));
  const w=Math.max(...boxes.map(b=>b.x+b.w))-x,h=Math.max(...boxes.map(b=>b.y+b.h))-y;
  const scale=Math.min(560/Math.max(1,w),220/Math.max(1,h));
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,600,260);
  ctx.translate((600-w*scale)/2,(260-h*scale)/2);ctx.scale(scale,scale);ctx.translate(-x,-y);
  for(const n of displayed){
    ctx.fillStyle='#14171d';ctx.fillRect(n.x,n.y,n.w,n.h);
    ctx.strokeStyle=n.color==='transparent'?'#aaa':n.color;ctx.lineWidth=1.5/scale;ctx.strokeRect(n.x,n.y,n.w,n.h);
    ctx.save();ctx.beginPath();ctx.rect(n.x,n.y,n.w,n.h);ctx.clip();
    ctx.fillStyle='#eee';ctx.font=12/scale+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText((n.name||n.text||'Bloc').split('\n')[0].slice(0,45),n.x+n.w/2,n.y+n.h/2,Math.max(1,n.w-8/scale));ctx.restore();
  }
});

export function previewGroupAlignment(id) {
  startEdit(id);
  if (editingId === id && isGroup) document.getElementById('group-align-button').click();
}

document.getElementById('github-refresh').addEventListener('click',async()=>{
  const n=getNode(editingId),button=document.getElementById('github-refresh');
  if(!n||isLocked())return;
  const id=n.id;button.disabled=true;button.textContent='Chargement…';
  try {const ok=await updateGitHubCard(n,true);if(editingId===id)button.textContent=ok?'Informations actualisées':'Dépôt inaccessible : icône et nom conservés';}
  finally{button.disabled=false;}
});

document.getElementById('application-change').addEventListener('click', async () => {
  const id = editingId;
  const button = document.getElementById('application-change');
  if (!id || isLocked() || !window.__TAURI__) return;
  button.disabled = true;
  try {
    const chosen = await window.__TAURI__.core.invoke('pick_application');
    if (chosen && editingId === id) { pendingApplication = chosen; button.textContent = 'Nouvelle application : ' + chosen.label; }
  } catch (error) { alert(String(error)); }
  finally { button.disabled = false; }
});

export function resizeGroupBlocks(id) {
  const group = getNode(id);
  if (isLocked() || group?.kind !== 'group') return;
  const blocks = membersOf(group).filter(n => n.kind !== 'group');
  if (!blocks.length) return;
  saveNow();
  const w = Math.max(...blocks.map(n => n.w)), h = Math.max(...blocks.map(n => n.h));
  for (const block of blocks) { block.w = w; block.h = h; }
  fitGroupsAround(null, [group]);
  emit();
  previewGroupAlignment(id);
  stopEdit(true);
}
document.getElementById('group-resize-button').addEventListener('click', () => {
  const id = editingId;
  stopEdit(true);
  if (!isEditing()) resizeGroupBlocks(id);
});

for(const [id,copy] of [['group-download-board',false],['group-copy-content',true]]) {
  document.getElementById(id).addEventListener('click',async()=>{
    const group=getNode(editingId),button=document.getElementById(id);
    if(group?.kind!=='group')return;
    button.disabled=true;
    try{
      const data=await exportGroup(group,el.value,copy);
      if(copy){await navigator.clipboard.writeText(GROUP_PREFIX+JSON.stringify(data));notify('Groupe copié : colle-le dans un tableau avec Ctrl+V.');}
      else {
        const name=(el.value.trim().split('\n')[0]||'groupe').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/[. ]+$/g,'').slice(0,100)||'groupe';
        const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));
        const link=Object.assign(document.createElement('a'),{href:url,download:name+'.json'});document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
    }catch(error){notify(String(error.message||error),{type:'error'});}
    finally{button.disabled=false;}
  });
}
