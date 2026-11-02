// Optional backup of the board on Google Drive.
//
//  - Scope: drive.appdata only. The file (Bete.json) lives in a hidden folder reserved to this
//    app in the user's own Drive. Nothing goes through a server of ours.
//  - Sign-in: Google Identity Services "token" flow, entirely in the browser. The access token
//    lasts about an hour and is kept in memory only (never written to storage); when it
//    expires the user presses "Se reconnecter" (no new consent needed).
//  - Sync: the board is uploaded ~30 s after the last change. When connecting, the local board
//    and the Drive file are compared; if both changed since the last sync, the user chooses.
import { state, onSaved } from './state.js?v=mvz9vkup';
import { exportData, importData } from './storage.js?v=mvz9vkup';

const CLIENT_ID = '1084992186623-ffj2bqhcehii9ml5cnpppc6cet23d0va.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'Bete.json';
const META_KEY = 'bete2:drive';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const driveConfig = { autosaveMs: 30000, retryMs: 60000 };

// What we remember between visits: { linked, fileId, remoteModified, lastSyncedAt, sig }
//  remoteModified = Drive's modifiedTime of the file as of our last sync
//  sig            = hash of the board's blocks as of our last sync
let meta = loadMeta();
let token = null;        // access token, memory only
let tokenExpiry = 0;
let dirty = false;       // the board changed since the last sync
let busy = false;
let conflictPending = false; // "Décider plus tard" was chosen: no autosave until the user acts
let timer = null;
let message = '';        // transient status line (progress, errors)

class AuthNeeded extends Error {}

const $ = (id) => document.getElementById(id);
const tokenValid = () => !!token && Date.now() < tokenExpiry;

function loadMeta() {
  try {
    const m = JSON.parse(localStorage.getItem(META_KEY));
    return m && m.linked ? m : null;
  } catch { return null; }
}
function saveMeta() {
  try {
    if (meta) localStorage.setItem(META_KEY, JSON.stringify(meta));
    else localStorage.removeItem(META_KEY);
  } catch { /* storage blocked: the link is only kept for this visit */ }
}

// ---- change detection ----
// The camera is not part of the signature: panning or zooming must not trigger an upload.
const nodesJson = () => JSON.stringify(state.nodes);
function hash(str) { // cyrb53, 53 bits, plenty to detect a change
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// ---- Google sign-in ----
let gisLoading = null;
function loadGis() {
  if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
  if (!gisLoading) {
    gisLoading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisLoading = null; reject(new Error('Impossible de joindre Google (hors ligne ?).')); };
      document.head.append(s);
    });
  }
  return gisLoading;
}

// Opens Google's sign-in popup. Must be called from a click.
async function requestToken() {
  await loadGis();
  await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback: (r) => {
        if (r.error) { reject(new Error('Connexion refusée.')); return; }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(r, SCOPE)) {
          reject(new Error("L'autorisation d'accès au dossier de l'appli est nécessaire."));
          return;
        }
        token = r.access_token;
        tokenExpiry = Date.now() + (Number(r.expires_in) - 60) * 1000;
        resolve();
      },
      error_callback: (e) => reject(new Error(
        e && e.type === 'popup_failed_to_open' ? 'Le navigateur a bloqué la fenêtre de connexion.'
          : e && e.type === 'popup_closed' ? 'Connexion annulée.'
            : 'Connexion impossible.')),
    });
    client.requestAccessToken();
  });
}

// ---- Drive API ----
async function api(url, opts = {}) {
  if (!tokenValid()) throw new AuthNeeded();
  const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  if (r.status === 401) { token = null; throw new AuthNeeded(); }
  if (!r.ok) {
    let detail = '';
    try { detail = (await r.json()).error.message; } catch { /* no JSON body */ }
    const e = new Error(detail || 'erreur ' + r.status);
    e.status = r.status;
    throw e;
  }
  return r;
}

async function findFile() {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    q: `name = '${FILE_NAME}' and trashed = false`,
    fields: 'files(id,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '1',
  });
  const j = await (await api(`${API}/files?${params}`)).json();
  return (j.files && j.files[0]) || null;
}

// Creates or updates Bete.json; returns { id, modifiedTime }.
async function upload(doc) {
  const body = JSON.stringify(doc);
  if (meta.fileId) {
    try {
      const r = await api(`${UPLOAD}/files/${meta.fileId}?uploadType=media&fields=id,modifiedTime`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body,
      });
      return await r.json();
    } catch (e) {
      if (e.status !== 404) throw e; // the file was deleted on Drive: create it again
      meta.fileId = '';
    }
  }
  const boundary = 'bete' + Math.random().toString(36).slice(2);
  const metadata = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
  const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`
    + `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const r = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart,
  });
  return r.json();
}

// ---- sync steps (always run through run()) ----
async function pushStep() {
  const sig = hash(nodesJson());
  const saved = await upload(await exportData());
  meta.fileId = saved.id;
  meta.remoteModified = saved.modifiedTime;
  meta.lastSyncedAt = Date.now();
  meta.sig = sig;
  saveMeta();
  dirty = hash(nodesJson()) !== sig; // the board may have changed while uploading
}

async function pullStep(remote) {
  conflictPending = false;
  const doc = await (await api(`${API}/files/${remote.id}?alt=media`)).json();
  await importData(doc);
  meta.fileId = remote.id;
  meta.remoteModified = remote.modifiedTime;
  meta.lastSyncedAt = Date.now();
  meta.sig = hash(nodesJson());
  saveMeta();
  dirty = false;
}

// Right after connecting: decide what to do with the local board and the Drive file.
async function reconcileStep() {
  conflictPending = false;
  const remote = await findFile();
  const sig = hash(nodesJson());
  if (!remote) { // nothing on Drive yet
    if (state.nodes.length) await pushStep();
    else { meta.sig = sig; saveMeta(); }
    return;
  }
  const firstTime = !meta.remoteModified;                 // this device never synced
  const remoteChanged = remote.modifiedTime !== meta.remoteModified;
  const localChanged = sig !== meta.sig;
  let choice;
  if (firstTime) choice = state.nodes.length ? 'ask' : 'remote';
  else if (remoteChanged && localChanged) choice = 'ask';
  else if (remoteChanged) choice = 'remote';
  else if (localChanged) choice = 'local';
  else { meta.fileId = remote.id; saveMeta(); return; }   // already in sync
  if (choice === 'ask') choice = await askConflict(remote);
  if (choice === 'remote') await pullStep(remote);
  else if (choice === 'local') await pushStep();
  else {
    meta.fileId = remote.id;
    saveMeta();
    conflictPending = true; // stop the autosave: it would ask again every 30 s
    say('Conflit non résolu : « Sauvegarder maintenant » te redemandera lequel garder, « Restaurer depuis Drive » prend celui de Drive.');
  }
}

// Runs one sync operation: one at a time, with status messages and error handling.
async function run(label, step) {
  if (busy) return false;
  busy = true;
  say(label);
  try {
    await step();
    if (message === label) say('');
    return true;
  } catch (e) {
    fail(e);
    return false;
  } finally {
    busy = false;
    render();
    if (dirty && meta && tokenValid()) schedule();
  }
}

function fail(e) {
  if (e instanceof AuthNeeded) { say('Session expirée : reconnecte-toi pour continuer.'); return; }
  const offline = e instanceof TypeError;
  const apiOff = e.status === 403 && /not been used|disabled/i.test(e.message || '');
  say(offline ? 'Hors ligne ou Google injoignable : nouvel essai bientôt.'
    : apiOff ? "Google Drive : l'API Drive n'est pas activée dans le projet Google Cloud."
      : 'Google Drive : ' + (e.message || 'erreur'));
  if (offline || e.status >= 500) schedule(driveConfig.retryMs);
}

function schedule(ms = driveConfig.autosaveMs) {
  clearTimeout(timer);
  if (!meta || !dirty || conflictPending) return;
  timer = setTimeout(() => {
    if (!tokenValid()) { render(); return; } // the user must reconnect first
    // reconcileStep, not pushStep: Drive may have changed meanwhile (another device), and an
    // upload must never overwrite that silently.
    run('Sauvegarde…', reconcileStep);
  }, ms);
}

// ---- conflict popup ----
const when = (v) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

function askConflict(remote) {
  return new Promise((resolve) => {
    const dlg = $('drivedialog');
    const local = meta && meta.lastSyncedAt ? 'dernière synchronisation le ' + when(meta.lastSyncedAt) : 'jamais synchronisé';
    $('drive-dialog-text').textContent = `Le tableau sur Google Drive (modifié le ${when(remote.modifiedTime)}) `
      + `est différent de celui de cet appareil (${local}). Lequel garder ? L'autre sera remplacé.`;
    let answered = false;
    const done = (v) => { answered = true; dlg.close(); resolve(v); };
    $('drive-keep-local').onclick = () => done('local');
    $('drive-keep-remote').onclick = () => done('remote');
    $('drive-later').onclick = () => done(null);
    dlg.addEventListener('close', () => { if (!answered) resolve(null); }, { once: true }); // forced close
    dlg.showModal();
  });
}

// ---- panel ----
function say(text) { message = text; render(); }

function stamp(ms) {
  const d = new Date(ms), now = new Date();
  return d.toDateString() === now.toDateString()
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusText(linked, ok) {
  if (message) return message;
  if (!linked) return 'Sauvegarde automatique du tableau dans un dossier caché de ton Drive.';
  if (!ok) return dirty ? 'Session expirée : des modifications ne sont pas sauvegardées. Reconnecte-toi.'
    : 'Session expirée : reconnecte-toi pour reprendre la sauvegarde.';
  if (dirty) return 'Modifications en attente de sauvegarde…';
  return meta.lastSyncedAt ? 'Sauvegardé à ' + stamp(meta.lastSyncedAt) : 'Connecté à Google Drive.';
}

function render() {
  const linked = !!meta, ok = linked && tokenValid();
  $('drive-connect').hidden = ok;
  $('drive-connect').textContent = linked ? 'Se reconnecter' : 'Connecter Google Drive';
  $('drive-save').hidden = !ok;
  $('drive-restore').hidden = !ok;
  $('drive-disconnect').hidden = !linked;
  for (const id of ['drive-connect', 'drive-save', 'drive-restore', 'drive-disconnect']) $(id).disabled = busy;
  $('drive-status').textContent = statusText(linked, ok);
}

async function connect() {
  say('Connexion à Google…');
  try {
    await requestToken();
  } catch (e) {
    say(e.message || 'Connexion annulée.');
    return;
  }
  if (!meta) {
    meta = { linked: true, fileId: '', remoteModified: '', lastSyncedAt: 0, sig: '' };
    saveMeta();
  }
  await run('Synchronisation…', reconcileStep);
}

function disconnect() {
  if (!confirm('Déconnecter Google Drive ? La sauvegarde déjà présente reste sur ton Drive.')) return;
  const t = token;
  token = null; tokenExpiry = 0; meta = null; dirty = false;
  clearTimeout(timer);
  saveMeta();
  if (t && window.google && window.google.accounts) window.google.accounts.oauth2.revoke(t, () => {});
  say('Déconnecté. La sauvegarde reste sur ton Drive.');
}

function restore() {
  if (!confirm('Remplacer le tableau actuel par la sauvegarde de Google Drive ?')) return;
  run('Restauration…', async () => {
    const remote = await findFile();
    if (!remote) throw new Error('aucune sauvegarde trouvée sur ton Drive.');
    await pullStep(remote);
  });
}

export function initDrive() {
  if (meta) {
    dirty = hash(nodesJson()) !== meta.sig;
    loadGis().catch(() => {}); // already linked: have Google's script ready for "Se reconnecter"
  }
  // Content changed (not the camera): remember it and (re)start the autosave countdown.
  onSaved(() => {
    if (!meta) return;
    const changed = hash(nodesJson()) !== meta.sig;
    if (changed !== dirty) { dirty = changed; render(); }
    if (dirty) schedule();
  });
  $('drive-connect').addEventListener('click', connect);
  $('drive-connect').addEventListener('pointerenter', () => { loadGis().catch(() => {}); }, { once: true });
  $('drive-save').addEventListener('click', () => { run('Sauvegarde…', reconcileStep); });
  $('drive-restore').addEventListener('click', restore);
  $('drive-disconnect').addEventListener('click', disconnect);
  $('drivedialog').addEventListener('cancel', (e) => e.preventDefault()); // buttons only
  setInterval(render, 30000); // notices a token that expired
  render();
}
