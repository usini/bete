// Hôte PeerJS headless pour TODOMAPPA — destiné à tourner en permanence
// (ex. Raspberry Pi). Même protocole de synchro que l'app, donc les clients web
// se connectent via ?peer=<id> sans modification de l'app.
//
// MULTI-BOARD : un seul peer héberge plusieurs pense-bêtes. Chaque client annonce
// son board id (métadonnées de connexion). Le serveur garde un board par id,
// le persiste dans data/boards/<id>.json, et ne relaie qu'entre clients du même board.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// --- Polyfills WebRTC/WebSocket pour faire tourner le client PeerJS sous Node ---
import wrtc from '@roamhq/wrtc';
import WebSocket from 'ws';
globalThis.RTCPeerConnection = wrtc.RTCPeerConnection;
globalThis.RTCSessionDescription = wrtc.RTCSessionDescription;
globalThis.RTCIceCandidate = wrtc.RTCIceCandidate;
globalThis.WebSocket = WebSocket;
if (typeof globalThis.navigator === 'undefined') globalThis.navigator = { userAgent: 'node', product: 'node' };
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
if (typeof globalThis.document === 'undefined') globalThis.document = {};

const _peerjs = await import('peerjs');
const Peer = (_peerjs.default && _peerjs.default.Peer) || _peerjs.Peer;

// --- Config ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.TODOMAPPA_DATA || path.join(__dirname, 'data');
const BOARDS_DIR = path.join(DATA_DIR, 'boards');
const OLD_BOARD_FILE = path.join(DATA_DIR, 'board.json'); // ancien mono-board
const ID_FILE = path.join(DATA_DIR, 'peer-id');
const APP_URL = process.env.TODOMAPPA_APP_URL || 'https://remisarrailh.github.io/pensebete/';
const MAX_BOARDS = parseInt(process.env.TODOMAPPA_MAX_BOARDS || '300', 10);

fs.mkdirSync(BOARDS_DIR, { recursive: true });

function resolveId() {
  if (process.env.TODOMAPPA_ID) return process.env.TODOMAPPA_ID;
  try { const id = fs.readFileSync(ID_FILE, 'utf8').trim(); if (id) return id; } catch (e) { /* */ }
  const id = 'tm-' + crypto.randomBytes(16).toString('hex'); // 128 bits : anti-collision/devinabilité
  try { fs.writeFileSync(ID_FILE, id); } catch (e) { /* */ }
  return id;
}
const PEER_ID = resolveId();

const now = () => Date.now();
function sanitizeBoard(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'home';
}

// --- Boards en mémoire : id -> { content, mt, del, conns, lastSig, saveTimer } ---
const boards = new Map();

// Cache mémoire des mémos vocaux (id -> message audioRes reçu, renvoyé tel quel).
// Permet le partage entre clients + la récupération par un arrivant tardif tant
// que le serveur tourne. (Pas de persistance disque : binaire transitoire.)
const audioMem = new Map();

// Cache mémoire des images (hash -> message imgRes), même principe que l'audio :
// une image ne transite qu'une fois, puis le serveur la ressert aux arrivants.
// Bornage : on garde au plus IMG_MAX images (éviction FIFO) pour ne pas gonfler la RAM.
const imgMem = new Map();
const IMG_MAX = 400;
function cacheImg(hash, msg) {
  if (imgMem.has(hash)) imgMem.delete(hash);
  imgMem.set(hash, msg);
  while (imgMem.size > IMG_MAX) imgMem.delete(imgMem.keys().next().value);
}

function fromExport(obj) {
  const n = {}, c = {}, h = {}, m = {}; const t = now();
  for (const nd of obj.nodes || []) {
    if (nd.kind === 'liaison') continue;
    if (nd.ref !== undefined) n[nd.id] = { ref: nd.ref, x: nd.x, y: nd.y, w: nd.w, h: nd.h };
    else {
      const e = { t: nd.text || '', img: nd.image || null, x: nd.x, y: nd.y, w: nd.w, h: nd.h };
      if (nd.kind === 'pancarte') e.k = 'pancarte';
      if (nd.link) e.lk = nd.link;
      n[nd.id] = e;
    }
    m[nd.id] = t;
  }
  for (const z of obj.circles || []) { c[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r }; m[z.id] = t; }
  for (const z of obj.hexagons || []) { h[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r }; m[z.id] = t; }
  return { n, c, h, mt: m, del: [] };
}

function boardFromObj(obj) {
  const st = Array.isArray(obj.nodes) ? fromExport(obj) : obj; // export ou format natif
  return {
    content: { n: st.n || {}, c: st.c || {}, h: st.h || {} },
    mt: st.mt || {},
    del: new Set(st.del || []),
    conns: [], lastSig: '', saveTimer: null,
  };
}

function loadBoards() {
  let files = [];
  try { files = fs.readdirSync(BOARDS_DIR).filter((f) => f.endsWith('.json')); } catch (e) { /* */ }
  for (const f of files) {
    const id = sanitizeBoard(f.replace(/\.json$/, ''));
    try { boards.set(id, boardFromObj(JSON.parse(fs.readFileSync(path.join(BOARDS_DIR, f), 'utf8')))); } catch (e) { /* */ }
  }
  // Migration de l'ancien mono-board -> home.
  if (!boards.has('home') && fs.existsSync(OLD_BOARD_FILE)) {
    try { boards.set('home', boardFromObj(JSON.parse(fs.readFileSync(OLD_BOARD_FILE, 'utf8')))); } catch (e) { /* */ }
  }
  console.log(`[todomappa] ${boards.size} board(s) chargé(s) : ${[...boards.keys()].join(', ') || '(aucun)'}`);
}

function getBoard(id) {
  let b = boards.get(id);
  if (!b) {
    if (boards.size >= MAX_BOARDS) { console.warn('[todomappa] limite de boards atteinte, board éphémère :', id); }
    b = { content: { n: {}, c: {}, h: {} }, mt: {}, del: new Set(), conns: [], lastSig: '', saveTimer: null };
    boards.set(id, b);
  }
  return b;
}

function scheduleSave(id, b) {
  if (b.saveTimer || boards.size > MAX_BOARDS) return;
  b.saveTimer = setTimeout(() => {
    b.saveTimer = null;
    try {
      fs.writeFileSync(path.join(BOARDS_DIR, id + '.json'), JSON.stringify({ ...b.content, mt: b.mt, del: [...b.del] }));
    } catch (e) { console.error('[todomappa] échec sauvegarde', id, e); }
  }, 1000);
}

// --- Synchro (LWW + priorité hôte à égalité), par board ---
function buildPayload(b) {
  return { type: 'sync', from: 'host', n: b.content.n, c: b.content.c, h: b.content.h, mt: { ...b.mt }, del: [...b.del] };
}

function merge(b, remote) {
  let changed = false;
  const win = (id) => {
    const rm = (remote.mt && remote.mt[id]) || 0;
    const lm = b.mt[id] || 0;
    return rm > lm || (rm === lm && remote.from === 'host');
  };
  for (const id of remote.del || []) {
    if (!b.del.has(id)) b.del.add(id);
    if (b.content.n[id] || b.content.c[id] || b.content.h[id]) {
      delete b.content.n[id]; delete b.content.c[id]; delete b.content.h[id]; delete b.mt[id]; changed = true;
    }
  }
  const mergeMap = (map, rem) => {
    for (const id in rem || {}) {
      if (b.del.has(id)) continue;
      if (win(id)) { map[id] = rem[id]; b.mt[id] = (remote.mt && remote.mt[id]) || now(); changed = true; }
    }
  };
  mergeMap(b.content.n, remote.n);
  mergeMap(b.content.c, remote.c);
  mergeMap(b.content.h, remote.h);
  return changed;
}

function applyMove(b, msg) {
  const e = b.content.n[msg.id] || b.content.c[msg.id] || b.content.h[msg.id];
  if (!e) return;
  if (msg.x != null) e.x = msg.x;
  if (msg.y != null) e.y = msg.y;
  if (msg.w != null) e.w = msg.w;
  if (msg.h != null) e.h = msg.h;
  if (msg.r != null) e.r = msg.r;
}

function applyDelete(b, msg) {
  b.del.add(msg.id);
  audioMem.delete(msg.id); // libère l'audio caché
  if (b.content.n[msg.id] || b.content.c[msg.id] || b.content.h[msg.id]) {
    delete b.content.n[msg.id]; delete b.content.c[msg.id]; delete b.content.h[msg.id]; delete b.mt[msg.id];
  }
}

// Présence : le serveur (hôte) + les clients ayant annoncé un nom.
function broadcastPresence(b) {
  const users = [{ uid: 'server', name: 'Serveur', host: true, peerId: null, voice: false }];
  for (const c of b.conns) if (c._uid) users.push({ uid: c._uid, name: c._name || '', host: false, peerId: c._peerId || null, voice: !!c._voice });
  const payload = { type: 'presence', users };
  for (const c of b.conns) if (c.open) { try { c.send(payload); } catch (e) { /* */ } }
}

function handleData(id, b, msg, origin) {
  if (!msg) return;
  if (msg.type === 'sync') { if (merge(b, msg)) scheduleSave(id, b); }
  else if (msg.type === 'move') { applyMove(b, msg); scheduleSave(id, b); }
  else if (msg.type === 'delete') { applyDelete(b, msg); scheduleSave(id, b); }
  else if (msg.type === 'audioReq') {
    // Mémo vocal demandé : on répond depuis le cache, sinon on relaie aux autres.
    const cached = audioMem.get(msg.id);
    if (cached) { try { if (origin.open) origin.send(cached); } catch (e) { /* */ } }
    else for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'audioRes') {
    if (msg.buf) audioMem.set(msg.id, msg); // cache + renvoi tel quel
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'imgReq') {
    // Image demandée par hash : on ressert depuis le cache, sinon on relaie aux autres.
    const cached = imgMem.get(msg.hash);
    if (cached) { try { if (origin.open) origin.send(cached); } catch (e) { /* */ } }
    else for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'imgRes') {
    if (msg.buf) cacheImg(msg.hash, msg); // cache borné + renvoi tel quel
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'hello') {
    origin._uid = msg.uid; origin._name = msg.name; origin._peerId = msg.peerId; origin._voice = msg.voice;
    broadcastPresence(b);
    return;
  } else if (msg.type === 'cursor') {
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } } // relai curseurs
    return;
  }
  if (msg.type === 'move' || msg.type === 'delete') {
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
  }
}

// Signatures par entrée (n/c/h) pour ne diffuser QUE ce qui change (delta).
function entrySigs(b) {
  const m = {};
  for (const id in b.content.n) m['n' + id] = JSON.stringify(b.content.n[id]);
  for (const id in b.content.c) m['c' + id] = JSON.stringify(b.content.c[id]);
  for (const id in b.content.h) m['h' + id] = JSON.stringify(b.content.h[id]);
  return m;
}

// Diffusion périodique EN DELTA : seules les entrées modifiées + les suppressions.
function tick() {
  for (const [, b] of boards) {
    if (!b.conns.length) continue;
    const sigs = entrySigs(b);
    const prev = b.prevSigs || {};
    const nn = {}, cc = {}, hh = {}, mt = {};
    let changed = false;
    for (const k in sigs) {
      if (prev[k] === sigs[k]) continue;
      changed = true;
      const t = k[0], rid = k.slice(1);
      if (t === 'n') nn[rid] = b.content.n[rid];
      else if (t === 'c') cc[rid] = b.content.c[rid];
      else hh[rid] = b.content.h[rid];
      mt[rid] = b.mt[rid] || now();
    }
    const delSig = b.del.size;
    const delChanged = b._lastDelSig !== delSig;
    if (!changed && !delChanged) { b.prevSigs = sigs; continue; }
    b.prevSigs = sigs; b._lastDelSig = delSig;
    const payload = { type: 'sync', from: 'host', n: nn, c: cc, h: hh, mt, del: [...b.del] };
    for (const c of b.conns) if (c.open) { try { c.send(payload); } catch (e) { /* */ } }
  }
}

// --- Filet de sécurité : ne jamais crasher sur une erreur non gérée ---
// (ex. "WebSocket was closed before the connection was established" côté ws/peerjs).
process.on('uncaughtException', (e) => {
  console.error('[todomappa] uncaughtException ignorée :', (e && e.message) || e);
  if (peer) { try { peer.destroy(); } catch (er) { /* */ } peer = null; scheduleRestart(); }
});
process.on('unhandledRejection', (e) => { console.error('[todomappa] unhandledRejection :', (e && e.message) || e); });

// --- Peer ---
loadBoards();

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];

let peer = null;
let restartTimer = null;
function scheduleRestart() {
  if (restartTimer) return;
  restartTimer = setTimeout(() => { restartTimer = null; start(); }, 5000);
}

function start() {
  const p = new Peer(PEER_ID, {
    host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs',
    config: { iceServers: ICE },
  });
  peer = p;

  p.on('open', (rid) => {
    console.log('\n[todomappa] HÔTE EN LIGNE (multi-board)');
    console.log('  id    : ' + rid);
    console.log('  lien  : ' + APP_URL + '?peer=' + encodeURIComponent(rid));
    console.log('  (ajoute &id=nom pour un board précis)\n');
  });
  p.on('connection', (conn) => {
    if (p !== peer) return;
    const id = sanitizeBoard(conn.metadata && conn.metadata.board);
    const b = getBoard(id);
    conn._lastSeen = now();
    b.conns.push(conn);
    console.log(`[todomappa] client connecté sur "${id}" (${b.conns.length})`);
    conn.on('open', () => { try { conn.send(buildPayload(b)); } catch (e) { /* */ } });
    conn.on('data', (msg) => { conn._lastSeen = now(); handleData(id, b, msg, conn); });
    const drop = () => { const i = b.conns.indexOf(conn); if (i >= 0) b.conns.splice(i, 1); broadcastPresence(b); console.log(`[todomappa] client déconnecté de "${id}" (${b.conns.length})`); };
    conn.on('close', drop);
    conn.on('error', drop);
  });
  p.on('disconnected', () => {
    if (p !== peer) return;
    // NB: p.reconnect() sur ce stack (wrtc/ws) peut émettre une erreur WS non gérée
    // et faire crasher le process. On préfère détruire + repartir proprement.
    console.warn('[todomappa] déconnecté du broker, redémarrage propre…');
    try { p.destroy(); } catch (e) { /* */ }
    peer = null;
    scheduleRestart();
  });
  p.on('error', (err) => {
    if (p !== peer) return;
    const t = err && err.type ? err.type : String(err);
    console.error('[todomappa] erreur peer :', t);
    if (t === 'unavailable-id') console.error('  -> id occupé (un autre hôte tourne ?). Réessai dans 5s.');
    if (t === 'unavailable-id' || t === 'network' || t === 'server-error' || t === 'socket-error') {
      try { p.destroy(); } catch (e) { /* */ }
      peer = null;
      scheduleRestart();
    }
  });
}

setInterval(tick, 800);
// Battement régulier : prouve aux clients que le serveur est vivant (sinon ils
// déclencheraient une ré-élection pendant les périodes d'inactivité).
setInterval(() => {
  for (const [, b] of boards) for (const c of b.conns) if (c.open) { try { c.send({ type: 'ping' }); } catch (e) { /* */ } }
}, 3000);
// Nettoyage des clients muets (onglet fermé sans signal) : > 9s sans message.
setInterval(() => {
  const cutoff = Date.now() - 9000;
  for (const [, b] of boards) {
    const before = b.conns.length;
    b.conns = b.conns.filter((c) => { const alive = !c._lastSeen || c._lastSeen > cutoff; if (!alive) { try { c.close(); } catch (e) { /* */ } } return alive; });
    if (b.conns.length !== before) broadcastPresence(b);
  }
}, 3000);
start();
