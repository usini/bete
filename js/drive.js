import { localStore } from './local-store.js?v=mw3rh9st';
import { updateBackupSize } from './backup-size.js?v=mw3rh9st';
// Optional backup of the board on Google Drive.
//
//  - Scope: drive.appdata only. The file (Bete.json) lives in a hidden folder reserved to this
//    app in the user's own Drive. Board content never passes through our OAuth service.
//  - Sign-in: OAuth code flow through a stateless service. Access tokens stay in memory.
//  - Drive transfers happen only on explicit save, restore or initial connection.
//    Local autosave remains automatic; leaving with unsaved Drive changes warns the user.
import { state, onSaved, saveNow, serialize } from './state.js?v=mw3rh9st';
import { exportData, importData } from './storage.js?v=mw3rh9st';

import { notify } from './notifications.js?v=mw3rh9st';

import { modeEvents } from './mobile-mode.js?v=mw3rh9st';

const AUTH_URL = 'https://auth-bete.usini.eu';
const FILE_NAME = 'Bete.json';
const META_KEY = 'bete2:drive';
const TOKEN_KEY = 'bete2:driveToken';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

// What we remember between visits: { linked, fileId, remoteModified, lastSyncedAt, sig }
//  remoteModified = Drive's modifiedTime of the file as of our last sync
//  sig            = hash of the board's blocks as of our last sync
let meta = loadMeta();
let token = null;        // access token, memory only
let tokenExpiry = 0;
let observed = '';
let dirty = false;       // the board changed since the last sync
let busy = false;
let idleWaiters = [];
const releaseIdle = () => { const waiters = idleWaiters; idleWaiters = []; for (const resolve of waiters) resolve(); };
let conflictPending = false; // "Décider plus tard" was chosen: wait for the next explicit action
let transferResult = '';
let lastRunError = null;
let message = '';        // transient status line (progress, errors)

class AuthNeeded extends Error {}

const $ = (id) => document.getElementById(id);
const tokenValid = () => !!token && Date.now() < tokenExpiry;

function loadMeta() {
  try {
    const m = JSON.parse(localStore.getItem(META_KEY));
    return m && m.linked ? m : null;
  } catch { return null; }
}
function saveMeta() {
  try {
    if (meta) localStore.setItem(META_KEY, JSON.stringify(meta));
    else localStore.removeItem(META_KEY);
  } catch { /* storage blocked: the link is only kept for this visit */ }
}

// Remove access tokens left by the previous browser-only flow.
try { localStore.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
let refreshing = null;
let connecting = false;
let driveFailed = false;
async function desktopAuth(command) {
  let result;
  try { result = await globalThis.__TAURI__.core.invoke(command); }
  catch (error) { throw new Error(String(error)); }
  if (command === 'drive_token' && !result) throw new AuthNeeded();
  return result;
}
async function authRequest(path) {
  if (globalThis.__TAURI__) return desktopAuth(path === '/logout' ? 'drive_logout' : 'drive_token');
  const r = await fetch(AUTH_URL + path, {
    method: 'POST', credentials: 'include', headers: { 'X-Bete-Request': '1' },
    signal: AbortSignal.timeout(20000),
  });
  if (r.status === 401) throw new AuthNeeded();
  if (!r.ok) {
    const error = new Error('Service de connexion indisponible. Réessaie bientôt.');
    error.status = r.status;
    throw error;
  }
  return r.json();
}
async function ensureToken() {
  if (tokenValid()) return;
  if (!refreshing) {
    connecting = true; driveFailed = false; renderIndicator();
    driveNotice('Connexion à Google Drive en cours…');
    refreshing = authRequest('/token').then(r => {
      token = r.access_token;
      tokenExpiry = Date.now() + (Number(r.expires_in) - 60) * 1000;
      driveNotice('Connexion à Google Drive établie.', 'success');
    }).catch(error => { driveFailed = true; throw error; })
      .finally(() => { refreshing = null; connecting = false; renderIndicator(); });
  }
  return refreshing;
}

function driveNotice(text, type = 'progress') {
  notify(text, { id: 'drive', type, duration: type === 'progress' ? 0 : 4500 });
}

// ---- change detection ----
// The camera is not part of the signature: panning or zooming must not trigger an upload.
const nodesJson = () => {
  const doc = serialize();
  return JSON.stringify({ nodes: doc.nodes, history: doc.history });
};
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

// Opens synchronously from the click, so popup blockers can allow it.
async function requestToken() {
  if (globalThis.__TAURI__) {
    const response = await desktopAuth('drive_login');
    token = response.access_token;
    tokenExpiry = Date.now() + (response.expires_in - 60) * 1000;
    return;
  }
  const popup = window.open(AUTH_URL + '/login', 'bete-google', 'popup,width=520,height=700');
  if (!popup) throw new Error('Le navigateur a bloqué la fenêtre de connexion.');
  await new Promise((resolve, reject) => {
    let poll, timeout;
    const finish = (error) => {
      window.removeEventListener('message', receive);
      clearInterval(poll); clearTimeout(timeout);
      if (!popup.closed) popup.close();
      error ? reject(error) : resolve();
    };
    const receive = e => {
      if (e.origin !== AUTH_URL || e.source !== popup || e.data?.type !== 'bete-oauth') return;
      finish(e.data.ok ? null : new Error('Connexion annulée.'));
    };
    window.addEventListener('message', receive);
    poll = setInterval(() => { if (popup.closed) finish(new Error('Connexion annulée.')); }, 500);
    timeout = setTimeout(() => finish(new Error('Connexion trop longue. Réessaie.')), 600000);
  });
  token = null;
  await ensureToken();
}

// ---- Drive API ----
async function api(url, opts = {}) {
  await ensureToken();
  let r = await fetch(url, { ...(globalThis.AbortSignal?.timeout ? { signal: AbortSignal.timeout(10000) } : {}), ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  if (r.status === 401) {
    token = null; await ensureToken();
    r = await fetch(url, { ...(globalThis.AbortSignal?.timeout ? { signal: AbortSignal.timeout(10000) } : {}), ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
    if (r.status === 401) { token = null; throw new AuthNeeded(); }
  }
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
  // keepalive lets a small request finish even if the page is being closed (browsers cap it at 64 KB).
  const keepalive = body.length < 60000;
  if (meta.fileId) {
    try {
      const r = await api(`${UPLOAD}/files/${meta.fileId}?uploadType=media&fields=id,modifiedTime`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body, keepalive,
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
    method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body: multipart, keepalive,
  });
  return r.json();
}

// ---- sync steps (always run through run()) ----
async function pushStep() {
  driveNotice('Sauvegarde Google Drive en cours…');
  const sig = hash(nodesJson());
  const saved = await upload(await exportData());
  meta.fileId = saved.id;
  meta.remoteModified = saved.modifiedTime;
  meta.lastSyncedAt = Date.now();
  meta.sig = sig;
  saveMeta();
  dirty = hash(nodesJson()) !== sig; // the board may have changed while uploading
  transferResult = 'saved';
}

async function pullStep(remote, expectedLocal) {
  driveNotice('Restauration depuis Google Drive en cours…');
  conflictPending = false;
  const doc = await (await api(`${API}/files/${remote.id}?alt=media`)).json();
  if (expectedLocal !== undefined && hash(nodesJson()) !== expectedLocal) {
    throw new Error('Le tableau local a changé pendant la restauration. Utilise Restaurer pour réessayer.');
  }
  await importData(doc);
  meta.fileId = remote.id;
  meta.remoteModified = remote.modifiedTime;
  meta.lastSyncedAt = Date.now();
  meta.sig = hash(nodesJson());
  saveMeta();
  dirty = false;
  transferResult = 'restored';
}

// Opening Bête can read Drive, but never sends the local board.
async function checkRemoteBackup(firstConnection = false) {
  const remote = await findFile();
  const localSignature = hash(nodesJson());
  if (!remote) {
    if (firstConnection) {
      if (!state.nodes.length) { meta.sig = localSignature; saveMeta(); }
      driveNotice('Google Drive est connecté. Aucune sauvegarde trouvée.', 'success');
    }
    return;
  }
  if (remote.id === meta.fileId && remote.modifiedTime === meta.remoteModified) return;
  const localChanged = meta.sig ? localSignature !== meta.sig : state.nodes.length > 0;
  if (localChanged && await askConflict(remote, true) !== 'remote') {
    driveNotice('Sauvegarde Drive disponible. Le tableau local est conservé.', 'info');
    return;
  }
  await pullStep(remote, localSignature);
}

// Right after connecting: decide what to do with the local board and the Drive file.
async function reconcileStep(interactive = true) {
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
  else { meta.fileId = remote.id; dirty = false; saveMeta(); return; } // already in sync
  if (choice === 'ask') choice = interactive ? await askConflict(remote) : null;
  if (choice === 'remote') await pullStep(remote);
  else if (choice === 'local') {
    const current = await findFile();
    if (current?.id !== remote.id || current.modifiedTime !== remote.modifiedTime) {
      throw new Error('La sauvegarde Drive a changé. Relance la sauvegarde pour vérifier les deux versions.');
    }
    meta.fileId = remote.id;
    await pushStep();
  }
  else {
    meta.fileId = remote.id;
    saveMeta();
    conflictPending = true; // leave the choice pending until the user acts
    say('Conflit non résolu : clique sur la disquette pour choisir la version, ou sur « Restaurer » pour prendre celle de Drive.');
  }
}

// Runs one sync operation: one at a time, with status messages and error handling.
async function run(label, step, announce = false) {
  if (busy) return false;
  busy = true; driveFailed = false; transferResult = ''; lastRunError = null;
  say(label);
  if (announce) driveNotice(label);
  try {
    await ensureToken();
    await step();
    if (message === label) say('');
    if (conflictPending) driveNotice('Conflit Google Drive : clique sur la disquette pour choisir la version.', 'info');
    else if (transferResult === 'restored') driveNotice('Restauration terminée.', 'success');
    else if (transferResult === 'saved') driveNotice(dirty ? 'Sauvegarde terminée. De nouvelles modifications restent en attente.' : 'Sauvegarde terminée sur Google Drive.', dirty ? 'info' : 'success');
    else if (announce) driveNotice('Synchronisation terminée. Aucune modification en attente.', 'success');
    return true;
  } catch (e) {
    lastRunError = e;
    fail(e);
    return false;
  } finally {
    busy = false;
    releaseIdle();
    render();
  }
}

function fail(e) {
  driveFailed = true;
  if (e instanceof AuthNeeded) { say('Session expirée : reconnecte-toi pour continuer.'); driveNotice('Connexion Google Drive échouée. Clique sur la disquette pour te reconnecter.', 'error'); return; }
  const offline = e instanceof TypeError;
  const apiOff = e.status === 403 && /not been used|disabled/i.test(e.message || '');
  say(offline ? 'Hors ligne ou Google injoignable : clique sur la disquette pour réessayer.'
    : apiOff ? "Google Drive : l'API Drive n'est pas activée dans le projet Google Cloud."
      : 'Google Drive : ' + (e.message || 'erreur'));
  driveNotice(message, 'error');
}

// ---- conflict popup ----
const when = (v) => new Date(v).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

function askConflict(remote, restoreOnly = false) {
  return new Promise((resolve) => {
    const dlg = $('drivedialog');
    const local = meta && meta.lastSyncedAt ? 'dernière synchronisation le ' + when(meta.lastSyncedAt) : 'jamais synchronisé';
    $('drive-keep-local').hidden = restoreOnly;
    $('drive-dialog-text').textContent = restoreOnly
      ? `Une sauvegarde Google Drive est disponible (modifiée le ${when(remote.modifiedTime)}). La restaurer remplacera le tableau local.`
      : `Le tableau sur Google Drive (modifié le ${when(remote.modifiedTime)}) `
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
  if (!linked) return 'Sauvegarde manuelle du tableau dans un dossier caché de ton Drive.';
  if (!ok) return dirty ? 'Session expirée : des modifications ne sont pas sauvegardées. Reconnecte-toi.'
    : 'Session expirée : reconnecte-toi pour reprendre la sauvegarde.';
  if (dirty) return 'Modifications en attente de sauvegarde…';
  return meta.lastSyncedAt ? 'Sauvegardé à ' + stamp(meta.lastSyncedAt) : 'Connecté à Google Drive.';
}

function renderIndicator() {
  if (typeof document.getElementById !== 'function') return;
  const button = $('drive-save');
  if (!button?.dataset) return;
  button.hidden = !meta;
  const size = $('drive-size');
  if (size) {
    const wasHidden = size.hidden;
    size.hidden = !meta;
    if (meta && wasHidden) updateBackupSize();
  }
  const mode = driveFailed ? 'error' : connecting || !tokenValid() ? 'connecting'
    : dirty || busy || conflictPending ? 'pending' : 'saved';
  button.dataset.state = mode;
  button.dataset.working = String(busy || connecting);
  const descriptions = {
    error: 'Échec de connexion ou de sauvegarde Google Drive. Cliquer pour réessayer.',
    connecting: 'Connexion ou reconnexion à Google Drive en cours.',
    pending: conflictPending ? 'Conflit Drive : cliquer pour choisir la version.' : 'Modifications non sauvegardées sur Drive. Cliquer pour sauvegarder.',
    saved: 'Sauvegardé sur Google Drive, aucune modification en attente.',
  };
  button.title = message || descriptions[mode];
  button.setAttribute('aria-label', descriptions[mode]);
  button.disabled = busy || connecting;
}

function render() {
  const linked = !!meta;
  $('drive-connect').hidden = linked;
  $('drive-connect-label').textContent = 'Connecter Google Drive';
  $('drive-restore').hidden = !linked;
  $('drive-disconnect').hidden = !linked;
  for (const id of ['drive-connect', 'drive-restore', 'drive-disconnect']) $(id).disabled = busy || connecting;
  $('drive-restore').disabled = busy || connecting;
  $('drive-status').textContent = statusText(linked, linked && tokenValid());
  $('drive-status').hidden = linked || !message;
  renderIndicator();
}

async function connect() {
  connecting = true; driveFailed = false; say('Connexion à Google…');
  driveNotice('Connexion à Google Drive en cours…');
  try {
    await requestToken();
  } catch (e) {
    connecting = false; driveFailed = true; say(e.message || 'Connexion annulée.');
    driveNotice(message, 'error');
    return;
  }
  connecting = false;
  if (!meta || globalThis.__TAURI__) {
    meta = { linked: true, fileId: '', remoteModified: '', lastSyncedAt: 0, sig: '' };
    saveMeta();
  }
  if (globalThis.__TAURI__) {
    dirty = !!state.nodes.length;
    await run('Recherche de la sauvegarde Google Drive…', () => checkRemoteBackup(true));
    return;
  }
  await run('Synchronisation…', reconcileStep, true);
}

async function disconnect() {
  if (!confirm('Déconnecter Google Drive ? La sauvegarde déjà présente reste sur ton Drive.')) return;
  if (busy) return;
  busy = true; render();
  try {
    await authRequest('/logout');
    token = null; tokenExpiry = 0; meta = null; dirty = false;
    saveMeta();
    say('Déconnecté. La sauvegarde reste sur ton Drive.');
  } catch {
    driveFailed = true;
    say('Déconnexion non confirmée. Réessaie ou retire l’accès depuis ton compte Google.');
  } finally { busy = false; releaseIdle(); render(); }
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
  modeEvents.addEventListener('change', render);
  if (meta) {
    dirty = hash(nodesJson()) !== meta.sig;
  }
  observed = hash(nodesJson());
  // Local saves update the Drive indicator without starting a transfer.
  onSaved(() => {
    if (!meta) return;
    const sig = hash(nodesJson());
    if (sig === observed) return;
    observed = sig;
    const changed = sig !== meta.sig;
    dirty = changed;
    updateBackupSize();

    render();
  });
  $('drive-connect').addEventListener('click', connect);
  $('drive-save').addEventListener('click', () => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      $('drive-save').querySelector('svg')?.animate([
        { transform: 'scale(1)' }, { transform: 'scale(0.75) rotate(-12deg)' }, { transform: 'scale(1)' },
      ], { duration: 500, easing: 'ease-out' });
    }
    if (!tokenValid() && driveFailed) connect();
    else run('Sauvegarde…', reconcileStep, true);
  });
  $('drive-restore').addEventListener('click', restore);
  $('drive-disconnect').addEventListener('click', disconnect);
  $('drivedialog').addEventListener('cancel', (e) => e.preventDefault()); // buttons only
  // Flush local storage before the browser asks whether to leave. No Drive upload here.
  window.addEventListener('beforeunload', (e) => {
    saveNow();
    if (!meta || !dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveNow();
  });
  render();
  if (meta) run('Vérification de la sauvegarde Google Drive…', checkRemoteBackup);
}

// Desktop shutdown must await existing transfers and never overwrite a newer remote backup.
export async function waitForDriveIdle() {
  while (busy) await new Promise(resolve => idleWaiters.push(resolve));
}
export function hasPendingDriveChanges() {
  return !meta || !meta.sig || conflictPending || hash(nodesJson()) !== meta.sig;
}
export async function saveDriveBeforeClose() {
  await waitForDriveIdle();
  if (!meta) return { skipped: true };
  if (!conflictPending && meta.sig && hash(nodesJson()) === meta.sig) {
    dirty = false;
    return { skipped: true };
  }
  const ok = await run('Sauvegarde en cours…', async () => {
    const remote = await findFile();
    if (remote && (remote.id !== meta.fileId || remote.modifiedTime !== meta.remoteModified)) {
      const error = new Error('La sauvegarde Drive a changé. Résous le conflit avec la disquette avant de fermer.');
      error.code = 'DRIVE_CONFLICT';
      throw error;
    }
    conflictPending = false;
    await pushStep();
  });
  if (!ok) {
    if (lastRunError?.code === 'DRIVE_CONFLICT') throw lastRunError;
    return { skipped: true, unavailable: true };
  }
  if (dirty || conflictPending) throw new Error(message || 'La sauvegarde Google Drive n’est pas terminée.');
  return { skipped: false };
}
