import { state, getNode } from './state.js?v=mw1yobwe';
import { shareInfo, prepareShare, enableShare, disableShare, regenerateShare, joinSharedGroup, parseShareLink, shareEvents, loadShareScript } from './group-share.js?v=mw1yobwe';

const $ = id => document.getElementById(id);
let groupId = null, invitation = null, lastQr = '', working = false;
const currentGroup = () => {
  const node = getNode(groupId);
  return node?.kind === 'group' ? node : state.nodes.find(n => n.kind === 'group' && n.shareId === groupId);
};

async function drawQr(url) {
  if (url === lastQr) return;
  lastQr = url;
  try {
    await loadShareScript('qrcode.min.js');
    if (lastQr !== url) return;
    const qr = window.qrcode(0, 'M');
    qr.addData(url); qr.make();
    $('share-qr').src = qr.createDataURL(4, 12);
    $('share-qr').hidden = false;
  } catch { $('share-status').textContent = 'QR code indisponible. Le lien reste utilisable.'; }
}

function render() {
  if (!$('sharedialog').open) return;
  const group = currentGroup();
  const info = invitation ? null : group ? shareInfo(group) : groupId ? shareInfo({ id: groupId }) : null;
  const joining = !!invitation;
  $('share-title').textContent = joining ? 'Rejoindre un groupe partagé' : 'Partager un groupe';
  $('share-name').textContent = group?.text.split('\n')[0].trim() || (joining ? 'Un groupe sera ajouté dans un espace libre de ton tableau.' : 'Groupe partagé');
  $('share-id').textContent = 'ID : ' + (info?.groupId || invitation?.groupId || groupId || '');
  $('share-status').textContent = info?.status || 'Le contenu sera reçu directement depuis l’appareil qui partage.';
  $('share-activate').hidden = joining || !!info?.enabled;
  $('share-deactivate').hidden = joining || !info?.enabled;
  $('share-regenerate').hidden = joining || info?.role !== 'host';
  $('share-join').hidden = !joining;
  for (const id of ['share-activate', 'share-deactivate', 'share-regenerate', 'share-join']) $(id).disabled = working;
  const url = info?.url || (invitation ? location.origin + location.pathname + '#' + new URLSearchParams({ group: invitation.groupId, peer: invitation.peerId, access: invitation.cap }) : '');
  $('share-link').value = url;
  if (url) drawQr(url);
}

async function act(fn) {
  if (working) return;
  working = true; render();
  try { await fn(); }
  catch (e) { $('share-status').textContent = e.message || 'Partage impossible.'; }
  finally { working = false; }
  // Do not replace an error with an older status message.
  for (const id of ['share-activate', 'share-deactivate', 'share-regenerate', 'share-join']) $(id).disabled = false;
}

export function initGroupShareUI() {
  document.addEventListener('bete-share-group', e => {
    const group = getNode(e.detail);
    if (!group || group.kind !== 'group') return;
    groupId = group.id; invitation = null;
    prepareShare(group);
    $('sharedialog').showModal(); render();
  });
  shareEvents.addEventListener('change', render);
  $('share-close').addEventListener('click', () => $('sharedialog').close());
  $('share-activate').addEventListener('click', () => act(async () => { await enableShare(currentGroup() || { id: groupId }); render(); }));
  $('share-deactivate').addEventListener('click', () => { disableShare(currentGroup() || { id: groupId }); render(); });
  $('share-regenerate').addEventListener('click', () => {
    if (!confirm('Invalider l’ancien lien et déconnecter ses participants ? Leurs copies locales resteront disponibles.')) return;
    act(async () => { const group = currentGroup(); if (group) { await regenerateShare(group); render(); } });
  });
  $('share-join').addEventListener('click', () => act(async () => {
    await joinSharedGroup(invitation);
    groupId = invitation.groupId; invitation = null;
    render();
  }));
  $('share-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('share-link').value); $('share-copy').textContent = 'Copié !'; }
    catch { $('share-link').focus(); $('share-link').select(); }
    setTimeout(() => { $('share-copy').textContent = 'Copier le lien'; }, 2000);
  });
  const openInvitation = () => {
    const config = parseShareLink(location.href);
    if (!config) return;
    // Bearer capabilities stay in the fragment and are removed from the address bar after reading.
    history.replaceState(null, '', location.pathname + location.search);
    invitation = config; groupId = config.groupId;
    if (!$('sharedialog').open) $('sharedialog').showModal();
    render();
  };
  window.addEventListener('hashchange', openInvitation);
  openInvitation();
}
