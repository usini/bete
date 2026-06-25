// Synchronisation P2P bidirectionnelle via PeerJS (WebRTC).
// On ne synchronise QUE le contenu (texte, image, couleur, description, liens,
// création/suppression) : ni la caméra, ni les positions/tailles. Chaque écran
// garde donc sa propre vue. Merge par id, conflit résolu en LWW + priorité HOST.
import { state, removeById, scheduleSave } from './state.js?v=mqtot15q';
import { reset } from './physics.js?v=mqtot15q';
import { explodeElementCascade } from './fx.js?v=mqtot15q';

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

// Vrai si on est connecté en client (ouvert via ?peer=).
export function isClient() { return mode === 'client'; }
// Id de l'hôte (celui auquel on est connecté en client, ou le nôtre si on héberge).
export function hostId() { return mode === 'client' ? clientPeerId : (hostPeer && hostPeer.id) || null; }

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
  if (n.ref !== undefined) return { ref: n.ref, x: n.x, y: n.y, w: n.w, h: n.h };
  const e = { t: n.text || '', img: n.image || null, x: n.x, y: n.y, w: n.w, h: n.h };
  if (n.kind === 'pancarte') e.k = 'pancarte';
  if (n.link) e.lk = n.link;
  return e;
}
function sigNode(e) { return e.ref !== undefined ? 'R' + e.ref : 'T' + e.t + '|' + (e.img || '') + '|' + (e.lk || ''); }
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
    const el = findLocal(id);
    if (el) { explodeElementCascade(el); removeById(id); delete mtimes[id]; applied.add(id); changed = true; }
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
      if (rd.k) node.kind = rd.k;
      if (rd.lk) node.link = rd.lk;
      state.nodes.push(node); reset(node);
      mtimes[id] = (remote.mt && remote.mt[id]) || now();
      applied.add(id); changed = true;
    } else if (win(id)) {
      if (rd.ref !== undefined) { if (ex.ref !== rd.ref) { ex.ref = rd.ref; changed = true; } }
      else {
        if ((ex.text || '') !== (rd.t || '')) { ex.text = rd.t || ''; changed = true; }
        const img = rd.img || undefined;
        if ((ex.image || undefined) !== img) { if (img) ex.image = img; else delete ex.image; changed = true; }
        const lk = rd.lk || undefined;
        if ((ex.link || undefined) !== lk) { if (lk) ex.link = lk; else delete ex.link; changed = true; }
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

function handleData(msg, origin) {
  if (!msg) return;
  if (msg.type === 'sync') {
    let justFirst = false;
    if (mode === 'client' && clientFirstSync) {
      // Première synchro côté client : on écrase le board local par celui du host.
      clientFirstSync = false;
      justFirst = true;
      state.nodes.length = 0;
      state.circles.length = 0;
      state.hexagons.length = 0;
      tombstones = new Set(); mtimes = {}; prevSigs = {}; prevLocalIds = null;
    }
    merge(msg);
    // Le client ne commence à ÉMETTRE qu'après avoir adopté l'état du host
    // (sinon il pousserait ses anciens blocs au host avant d'être réinitialisé).
    if (justFirst) startTick();
  } else if (msg.type === 'move') {
    applyMove(msg);
  } else if (msg.type === 'delete') {
    applyDelete(msg);
  }
  // Le host relaie les événements ponctuels aux autres clients.
  if (mode === 'host' && (msg.type === 'move' || msg.type === 'delete')) {
    conns.forEach((c) => { if (c !== origin) { try { if (c.open) c.send(msg); } catch (e) { /* */ } } });
  }
}

// Position déposée : on met à jour la cible (le ressort anime côté node).
function applyMove(msg) {
  const el = findLocal(msg.id);
  if (!el) return;
  if (msg.x != null) el.x = msg.x;
  if (msg.y != null) el.y = msg.y;
  if (msg.w != null) el.w = msg.w;
  if (msg.h != null) el.h = msg.h;
  if (msg.r != null) el.r = msg.r;
  scheduleSave();
}

function applyDelete(msg) {
  tombstones.add(msg.id);
  const el = findLocal(msg.id);
  if (el) { explodeElementCascade(el); removeById(msg.id); delete mtimes[msg.id]; delete prevSigs[msg.id]; scheduleSave(); }
}

// Appelé au lâcher d'un objet (drop) : diffuse sa position finale.
export function pushMove(el) {
  if (!conns.length || !el) return;
  const msg = el.r !== undefined
    ? { type: 'move', id: el.id, x: el.x, y: el.y, r: el.r }
    : { type: 'move', id: el.id, x: el.x, y: el.y, w: el.w, h: el.h };
  conns.forEach((c) => { try { if (c.open) c.send(msg); } catch (e) { /* */ } });
}

// Appelé à la suppression : déclenche l'explosion chez les pairs.
export function pushDelete(id) {
  if (!conns.length) return;
  conns.forEach((c) => { try { if (c.open) c.send({ type: 'delete', id }); } catch (e) { /* */ } });
}

// Id de peer stable, persisté : un refresh du host garde le même lien/QR.
function makeId() { return 'tm-' + Math.random().toString(36).slice(2, 10); }
function getStableId() {
  try {
    let id = localStorage.getItem('todomappa-peer');
    if (!id) { id = makeId(); localStorage.setItem('todomappa-peer', id); }
    return id;
  } catch (e) { return makeId(); }
}
function rotateStableId() {
  const id = makeId();
  try { localStorage.setItem('todomappa-peer', id); } catch (e) { /* */ }
  return id;
}

// ---- HOST ----
let hostPeer = null;
let hostNode = null;
let idRetries = 0;

export async function startHost(node) {
  stopHost();
  mode = 'host';
  hostNode = node;
  node.status = 'init';
  try {
    await Promise.all([loadPeer(), loadQR()]);
  } catch (e) {
    node.status = 'error';
    console.warn('TODOMAPPA: chargement PeerJS/QR échoué', e);
    return;
  }
  idRetries = 0;
  openHostPeer(getStableId());
}

function openHostPeer(id) {
  const peer = new Peer(id);
  hostPeer = peer;

  peer.on('open', (realId) => {
    idRetries = 0;
    hostNode.peerId = realId; hostNode.code = realId; hostNode.url = buildUrl(realId); hostNode.status = 'online';
    startTick();
  });
  peer.on('disconnected', () => {
    // Perte de la liaison au broker : on garde le même id et on retente.
    if (hostNode) hostNode.status = 'reconnexion';
    try { if (hostPeer && !hostPeer.destroyed) hostPeer.reconnect(); } catch (e) { /* */ }
  });
  peer.on('error', (err) => {
    if (err && err.type === 'unavailable-id') {
      // Id encore occupé (refresh trop rapide / autre onglet) : on retente le
      // même quelques fois, puis on bascule sur un nouvel id en dernier recours.
      try { peer.destroy(); } catch (e) { /* */ }
      const next = idRetries < 3 ? (idRetries++, id) : rotateStableId();
      setTimeout(() => { if (mode === 'host') openHostPeer(next); }, idRetries ? 1500 : 300);
      return;
    }
    if (hostNode) hostNode.status = 'error';
    console.warn('TODOMAPPA: erreur peer (host)', err);
  });
  peer.on('connection', (conn) => {
    conns.push(conn);
    if (hostNode) hostNode.status = 'connected';
    conn.on('open', () => {
      const content = buildContent(); // état courant envoyé immédiatement au nouveau venu
      try { conn.send({ type: 'sync', from: 'host', n: content.n, c: content.c, h: content.h, mt: { ...mtimes }, del: [...tombstones] }); } catch (e) { /* */ }
    });
    conn.on('data', (msg) => handleData(msg, conn));
    conn.on('close', () => { conns = conns.filter(c => c !== conn); });
    conn.on('error', () => { conns = conns.filter(c => c !== conn); });
  });
}

export function stopHost() {
  stopTick();
  resetSyncState();
  mode = null;
  hostNode = null;
  idRetries = 0;
  if (hostPeer) { try { hostPeer.destroy(); } catch (e) { /* */ } hostPeer = null; }
}

// Régénère un nouvel id (l'ancien lien/QR devient invalide) sans perdre le board.
// Utile si l'URL a fuité. Les clients déjà connectés sur l'ancien id sont coupés.
export function refreshHostId(node) {
  if (mode !== 'host' || !node) return;
  hostNode = node;
  node.status = 'init';
  node.peerId = undefined;
  node.url = undefined;
  node.code = undefined;
  stopTick();
  conns = [];
  if (hostPeer) { try { hostPeer.destroy(); } catch (e) { /* */ } hostPeer = null; }
  idRetries = 0;
  openHostPeer(rotateStableId());
}

// Libère l'id au broker quand on ferme/rafraîchit (pour le récupérer ensuite).
window.addEventListener('beforeunload', () => { if (hostPeer) { try { hostPeer.destroy(); } catch (e) { /* */ } } });

// ---- CLIENT ----
let clientPeer = null;
let clientPeerId = null;
let clientStatus = null;
let clientRetry = null;

export async function joinHost(peerId, onStatus) {
  clientPeerId = peerId;
  clientStatus = onStatus;
  try { await loadPeer(); } catch (e) { onStatus && onStatus('error'); return; }
  mode = 'client';
  clientFirstSync = true;
  onStatus && onStatus('connecting');
  const peer = new Peer();
  clientPeer = peer;

  peer.on('open', () => connectToHost());
  peer.on('disconnected', () => { try { if (clientPeer && !clientPeer.destroyed) clientPeer.reconnect(); } catch (e) { /* */ } });
  peer.on('error', (err) => { console.warn('TODOMAPPA: erreur peer (client)', err); scheduleClientRetry(); });
}

function connectToHost() {
  if (!clientPeer || clientPeer.destroyed) return;
  const conn = clientPeer.connect(clientPeerId, { reliable: true });
  conns = [conn];
  // Le tick (émission) ne démarre qu'après la 1re synchro reçue (cf. handleData).
  conn.on('open', () => { clientStatus && clientStatus('connected'); });
  conn.on('data', (msg) => {
    const wasFirst = clientFirstSync && msg && msg.type === 'sync';
    handleData(msg);
    if (wasFirst) clientStatus && clientStatus('synced');
  });
  conn.on('close', () => { clientStatus && clientStatus('closed'); scheduleClientRetry(); });
  conn.on('error', () => scheduleClientRetry());
}

// Reconnexion automatique du client si le host tombe (erreur réseau / refresh).
function scheduleClientRetry() {
  if (mode !== 'client' || clientRetry) return;
  clientStatus && clientStatus('reconnecting');
  clientRetry = setTimeout(() => {
    clientRetry = null;
    clientFirstSync = true; // on ré-adoptera l'état du host
    stopTick();
    connectToHost();
  }, 3000);
}
