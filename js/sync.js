// Synchronisation P2P bidirectionnelle via PeerJS (WebRTC).
// On ne synchronise QUE le contenu (texte, image, couleur, description, liens,
// création/suppression) : ni la caméra, ni les positions/tailles. Chaque écran
// garde donc sa propre vue. Merge par id, conflit résolu en LWW + priorité HOST.
import { state, removeById, scheduleSave } from './state.js';
import { reset } from './physics.js';

const PEERJS_SRC = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
const QR_SRC = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';

const _loaded = {};
function loadScript(src) {
  if (_loaded[src]) return _loaded[src];
  _loaded[src] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('load ' + src));
    document.head.appendChild(s);
  });
  return _loaded[src];
}
export const loadQR = () => loadScript(QR_SRC);
const loadPeer = () => loadScript(PEERJS_SRC);

export function buildUrl(id) {
  return location.origin + location.pathname + '?peer=' + encodeURIComponent(id);
}

// ---- État de synchro ----
let mode = null;          // 'host' | 'client'
let conns = [];           // connexions data ouvertes
let tickTimer = null;
let tombstones = new Set(); // ids supprimés (pour propager les suppressions)
let mtimes = {};            // id -> horodatage de la dernière modif de contenu
let prevSigs = {};          // id -> signature de contenu au tick précédent
let prevLocalIds = null;
let lastSentGate = '';
let clientFirstSync = false;

const now = () => Date.now();

function resetSyncState() {
  conns = [];
  tombstones = new Set();
  mtimes = {};
  prevSigs = {};
  prevLocalIds = null;
  lastSentGate = '';
}

// ---- Construction du contenu (sans la caméra ; positions = indice de spawn) ----
function localIds() {
  const ids = new Set();
  state.nodes.forEach(n => { if (n.kind !== 'liaison') ids.add(n.id); });
  state.circles.forEach(c => ids.add(c.id));
  state.hexagons.forEach(h => ids.add(h.id));
  return ids;
}
function nodeEntry(n) {
  return n.ref !== undefined
    ? { ref: n.ref, x: n.x, y: n.y, w: n.w, h: n.h }
    : { t: n.text || '', img: n.image || null, x: n.x, y: n.y, w: n.w, h: n.h };
}
function sigNode(e) { return e.ref !== undefined ? 'R' + e.ref : 'T' + e.t + '' + (e.img || ''); }
function sigZone(e) { return 'Z' + e.col + '' + e.d; }

function buildContent() {
  const n = {}, c = {}, h = {};
  for (const node of state.nodes) { if (node.kind === 'liaison') continue; n[node.id] = nodeEntry(node); }
  for (const z of state.circles) c[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r };
  for (const z of state.hexagons) h[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r };
  return { n, c, h };
}
function sigMap(content) {
  const m = {};
  for (const id in content.n) m[id] = sigNode(content.n[id]);
  for (const id in content.c) m[id] = sigZone(content.c[id]);
  for (const id in content.h) m[id] = sigZone(content.h[id]);
  return m;
}

// ---- Tick : détecte les modifs de contenu et diffuse si besoin ----
function startTick() {
  stopTick();
  prevLocalIds = localIds();
  prevSigs = sigMap(buildContent());
  for (const id in prevSigs) if (!mtimes[id]) mtimes[id] = now();
  tickTimer = setInterval(tick, 800);
}
function stopTick() { if (tickTimer) { clearInterval(tickTimer); tickTimer = null; } }

function tick() {
  // Détection des suppressions locales (id présent au tick précédent, absent maintenant).
  const ids = localIds();
  if (prevLocalIds) {
    for (const id of prevLocalIds) {
      if (!ids.has(id)) { tombstones.add(id); delete mtimes[id]; delete prevSigs[id]; }
    }
  }
  prevLocalIds = ids;

  const content = buildContent();
  const sigs = sigMap(content);
  for (const id in sigs) { if (prevSigs[id] !== sigs[id]) mtimes[id] = now(); } // contenu modifié -> horodate
  prevSigs = sigs;

  // La gate ignore les positions : un simple déplacement ne déclenche aucun envoi.
  const gate = JSON.stringify({ s: sigs, m: mtimes, d: [...tombstones] });
  if (gate === lastSentGate) return;
  lastSentGate = gate;
  const payload = { type: 'sync', from: mode, n: content.n, c: content.c, h: content.h, mt: { ...mtimes }, del: [...tombstones] };
  conns.forEach(c => { try { if (c.open) c.send(payload); } catch (e) { /* */ } });
}

// ---- Merge d'un payload distant ----
function findLocal(id) {
  return state.nodes.find(n => n.id === id) || state.circles.find(c => c.id === id) || state.hexagons.find(h => h.id === id);
}

function merge(remote) {
  let changed = false;
  const applied = new Set();

  for (const id of remote.del || []) {
    tombstones.add(id);
    if (findLocal(id)) { removeById(id); delete mtimes[id]; applied.add(id); changed = true; }
  }

  const win = (id) => {
    const rm = (remote.mt && remote.mt[id]) || 0;
    const lm = mtimes[id] || 0;
    return rm > lm || (rm === lm && remote.from === 'host');
  };

  for (const id in remote.n || {}) {
    if (tombstones.has(id)) continue;
    const rd = remote.n[id];
    const ex = state.nodes.find(x => x.id === id);
    if (!ex) {
      const node = rd.ref !== undefined
        ? { id, x: rd.x, y: rd.y, w: rd.w, h: rd.h, ref: rd.ref }
        : { id, x: rd.x, y: rd.y, w: rd.w, h: rd.h, text: rd.t || '', image: rd.img || undefined };
      state.nodes.push(node); reset(node);
      mtimes[id] = (remote.mt && remote.mt[id]) || now();
      applied.add(id); changed = true;
    } else if (win(id)) {
      if (rd.ref !== undefined) { if (ex.ref !== rd.ref) { ex.ref = rd.ref; changed = true; } }
      else {
        if ((ex.text || '') !== (rd.t || '')) { ex.text = rd.t || ''; changed = true; }
        const img = rd.img || undefined;
        if ((ex.image || undefined) !== img) { if (img) ex.image = img; else delete ex.image; changed = true; }
      }
      mtimes[id] = remote.mt[id];
      applied.add(id);
    }
  }

  changed = mergeZones(state.circles, remote.c, remote, win, applied) || changed;
  changed = mergeZones(state.hexagons, remote.h, remote, win, applied) || changed;

  if (changed) {
    // Met à jour prevSigs UNIQUEMENT pour les ids touchés par le merge,
    // pour ne pas avaler une éventuelle modif locale non encore envoyée.
    const sm = sigMap(buildContent());
    applied.forEach(id => { if (sm[id] != null) prevSigs[id] = sm[id]; else delete prevSigs[id]; });
    scheduleSave();
  }
}

function mergeZones(arr, rem, remote, win, applied) {
  if (!rem) return false;
  let changed = false;
  for (const id in rem) {
    if (tombstones.has(id)) continue;
    const rd = rem[id];
    const ex = arr.find(x => x.id === id);
    if (!ex) {
      arr.push({ id, x: rd.x, y: rd.y, r: rd.r, color: rd.col, description: rd.d });
      mtimes[id] = (remote.mt && remote.mt[id]) || now();
      applied.add(id); changed = true;
    } else if (win(id)) {
      if (ex.color !== rd.col) { ex.color = rd.col; changed = true; }
      if ((ex.description || '') !== rd.d) { ex.description = rd.d; changed = true; }
      mtimes[id] = remote.mt[id];
      applied.add(id);
    }
  }
  return changed;
}

function handleData(msg) {
  if (!msg || msg.type !== 'sync') return;
  if (mode === 'client' && clientFirstSync) {
    // Première synchro côté client : on écrase le board local par celui du host.
    clientFirstSync = false;
    state.nodes.length = 0;
    state.circles.length = 0;
    state.hexagons.length = 0;
    tombstones = new Set(); mtimes = {}; prevSigs = {}; prevLocalIds = null;
  }
  merge(msg);
}

// ---- HOST ----
let hostPeer = null;

export async function startHost(node) {
  stopHost();
  mode = 'host';
  node.status = 'init';
  try {
    await Promise.all([loadPeer(), loadQR()]);
  } catch (e) {
    node.status = 'error';
    console.warn('TODOMAPPA: chargement PeerJS/QR échoué', e);
    return;
  }
  const peer = new Peer();
  hostPeer = peer;

  peer.on('open', (id) => {
    node.peerId = id; node.code = id; node.url = buildUrl(id); node.status = 'online';
    startTick();
  });
  peer.on('error', (err) => { node.status = 'error'; console.warn('TODOMAPPA: erreur peer (host)', err); });
  peer.on('connection', (conn) => {
    conns.push(conn);
    node.status = 'connected';
    conn.on('open', () => {
      // Envoi immédiat de l'état courant au nouveau venu.
      const content = buildContent();
      try { conn.send({ type: 'sync', from: 'host', n: content.n, c: content.c, h: content.h, mt: { ...mtimes }, del: [...tombstones] }); } catch (e) { /* */ }
    });
    conn.on('data', handleData);
    conn.on('close', () => { conns = conns.filter(c => c !== conn); });
    conn.on('error', () => { conns = conns.filter(c => c !== conn); });
  });
}

export function stopHost() {
  stopTick();
  resetSyncState();
  mode = null;
  if (hostPeer) { try { hostPeer.destroy(); } catch (e) { /* */ } hostPeer = null; }
}

// ---- CLIENT ----
let clientPeer = null;

export async function joinHost(peerId, onStatus) {
  try { await loadPeer(); } catch (e) { onStatus && onStatus('error'); return; }
  mode = 'client';
  clientFirstSync = true;
  onStatus && onStatus('connecting');
  const peer = new Peer();
  clientPeer = peer;

  peer.on('open', () => {
    const conn = peer.connect(peerId, { reliable: true });
    conns = [conn];
    conn.on('open', () => { onStatus && onStatus('connected'); startTick(); });
    conn.on('data', (msg) => {
      const wasFirst = clientFirstSync;
      handleData(msg);
      if (wasFirst) onStatus && onStatus('synced');
    });
    conn.on('error', () => onStatus && onStatus('error'));
    conn.on('close', () => onStatus && onStatus('closed'));
  });
  peer.on('error', (err) => { onStatus && onStatus('error'); console.warn('TODOMAPPA: erreur peer (client)', err); });
}
