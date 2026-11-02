// Optional backup of the board on Google Drive.
//
//  - Scope: drive.appdata only. The file (Bete.json) lives in a hidden folder reserved to this
//    app in the user's own Drive. Board content never passes through our OAuth service.
//  - Sign-in: OAuth code flow through a stateless service. Access tokens stay in memory.
//  - Sync: check every 30 s and upload only changed content. When connecting, the local board
//    and the Drive file are compared; if both changed since the last sync, the user chooses.
import { state, onSaved, saveNow } from './state.js?v=mvzfvfhr';
import { exportData, importData } from './storage.js?v=mvzfvfhr';

const AUTH_URL = 'https://auth-bete.usini.eu';
const FILE_NAME = 'Bete.json';
const META_KEY = 'bete2:drive';
const TOKEN_KEY = 'bete2:driveToken';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';

export const driveConfig = { autosaveMs: 30000, retryMs: 60000 };

// What we remember between visits: { linked, fileId, remoteModified, lastSyncedAt, sig }
//  remoteModified = Drive's modifiedTime of the file as of our last sync
//  sig            = hash of the board's blocks as of our last sync
let meta = loadMeta();
let token = null;        // access token, memory only
let tokenExpiry = 0;
let retryAfter = 0;
let observed = '';
let dirty = false;       // the board changed since the last sync
let busy = false;
let lastCheck = 0;       // last time we compared with Drive (to catch another device's changes)
let conflictPending = false; // "Décider plus tard" was chosen: no autosave until the user acts
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

// Remove access tokens left by the previous browser-only flow.
try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
let refreshing = null;
async function authRequest(path) {
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
  if (!refreshing) refreshing = authRequest('/token').then(r => {
    token = r.access_token;
    tokenExpiry = Date.now() + (Number(r.expires_in) - 60) * 1000;
  }).finally(() => { refreshing = null; });
  return refreshing;
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

// Opens synchronously from the click, so popup blockers can allow it.
async function requestToken() {
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
  let r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  if (r.status === 401) {
    token = null; await ensureToken();
    r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
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
  const sig = hash(nodesJson());
  const saved = await upload(await exportData());
  meta.fileId = saved.id;
  meta.remoteModified = saved.modifiedTime;
  meta.lastSyncedAt = Date.now();
  meta.sig = sig;
  saveMeta();
  dirty = hash(nodesJson()) !== sig; // the board may have changed while uploading
  retryAfter = 0;
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
  retryAfter = 0;
}

// Right after connecting: decide what to do with the local board and the Drive file.
async function reconcileStep(interactive = true) {
  conflictPending = false;
  lastCheck = Date.now();
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
    await ensureToken();
    await step();
    if (message === label) say('');
    return true;
  } catch (e) {
    fail(e);
    return false;
  } finally {
    busy = false;
    render();
    // The periodic timer handles subsequent changes.
  }
}

function fail(e) {
  if (e instanceof AuthNeeded) { say('Session expirée : reconnecte-toi pour continuer.'); return; }
  const offline = e instanceof TypeError;
  const apiOff = e.status === 403 && /not been used|disabled/i.test(e.message || '');
  say(offline ? 'Hors ligne ou Google injoignable : nouvel essai bientôt.'
    : apiOff ? "Google Drive : l'API Drive n'est pas activée dans le projet Google Cloud."
      : 'Google Drive : ' + (e.message || 'erreur'));
  if (offline || e.status >= 500 || e.name === 'TimeoutError') {
    retryAfter = Date.now() + driveConfig.retryMs;
  }
}

function periodicSave() {
  if (!meta || !dirty || busy || conflictPending || Date.now() < retryAfter) return;
  run('Sauvegarde…', () => reconcileStep(false));
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
  $('drive-connect-label').textContent = linked ? 'Se reconnecter' : 'Connecter Google Drive';
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
    say('Déconnexion non confirmée. Réessaie ou retire l’accès depuis ton compte Google.');
  } finally { busy = false; render(); }
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
  }
  observed = hash(nodesJson());
  // Camera-only local saves must not postpone a pending content upload.
  onSaved(() => {
    if (!meta) return;
    const sig = hash(nodesJson());
    if (sig === observed) return;
    observed = sig;
    const changed = sig !== meta.sig;
    dirty = changed;

    render();
  });
  $('drive-connect').addEventListener('click', connect);
  $('drive-save').addEventListener('click', () => { run('Sauvegarde…', reconcileStep); });
  $('drive-restore').addEventListener('click', restore);
  $('drive-disconnect').addEventListener('click', disconnect);
  $('drivedialog').addEventListener('cancel', (e) => e.preventDefault()); // buttons only
  setInterval(() => { render(); periodicSave(); }, driveConfig.autosaveMs);

  // Leaving the page with changes not yet on Drive: start the upload at once, and make the
  // browser warn (it shows its own generic text, which a page cannot change). A page also
  // cannot close itself, so the user answers the browser's question.
  window.addEventListener('beforeunload', (e) => {
    saveNow(); // flush the local save first: it also refreshes `dirty`
    if (!meta || !(dirty || busy)) return;
    flush();
    e.preventDefault();
    e.returnValue = '';
  });
  // Switching tab / app, or closing on a phone: the page is hidden first, which is the one
  // reliable moment to save without waiting for the 30 s countdown.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { saveNow(); flush(); return; }
    checkRemote(); // back on the page: catch what another device saved meanwhile
  });
  render();
  checkRemote(); // after a reload: same check
}

// Compares with Drive, renewing authorization if necessary, at most once every 20 s.
function checkRemote() {
  if (!meta || busy || conflictPending) return;
  if (Date.now() - lastCheck < 20000) return;
  run('Synchronisation…', () => reconcileStep(false));
}

// Uploads now, instead of waiting for the countdown, when there is something to save.
function flush() {
  if (!meta || !dirty || busy || conflictPending) return;
  run('Sauvegarde…', () => reconcileStep(false));
}
