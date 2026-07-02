// Headless PeerJS host for Bete — meant to run permanently
// (e.g. Raspberry Pi). Same sync protocol as the app, so web clients
// connect via ?peer=<id> with no app modification needed.
//
// MULTI-BOARD: a single peer hosts several boards. Each client announces
// its board id (connection metadata). The server keeps one board per id,
// persists it to data/boards/<id>.json, and only relays between clients of the same board.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// --- WebRTC/WebSocket polyfills to run the PeerJS client under Node ---
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
const DATA_DIR = process.env.BETE_DATA || path.join(__dirname, 'data');
const BOARDS_DIR = path.join(DATA_DIR, 'boards');
const OLD_BOARD_FILE = path.join(DATA_DIR, 'board.json'); // legacy single-board file
const ID_FILE = path.join(DATA_DIR, 'peer-id');
// Base URL of the static app, used only to display a full link at startup
// (no effect on the protocol). Empty by default to stay portable across
// instances: set BETE_APP_URL to display it.
const APP_URL = process.env.BETE_APP_URL || '';
const MAX_BOARDS = parseInt(process.env.BETE_MAX_BOARDS || '300', 10);

fs.mkdirSync(BOARDS_DIR, { recursive: true });

function resolveId() {
  if (process.env.BETE_ID) return process.env.BETE_ID;
  try { const id = fs.readFileSync(ID_FILE, 'utf8').trim(); if (id) return id; } catch (e) { /* */ }
  const id = 'p-' + crypto.randomBytes(16).toString('hex'); // 128 bits: anti-collision/guessability
  try { fs.writeFileSync(ID_FILE, id); } catch (e) { /* */ }
  return id;
}
const PEER_ID = resolveId();

const now = () => Date.now();
function sanitizeBoard(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'home';
}

// --- Boards in memory: id -> { content, mt, del, conns, lastSig, saveTimer } ---
const boards = new Map();

// In-memory cache of voice memos (id -> received audioRes message, resent as-is).
// Allows sharing between clients + retrieval by a late arrival while the
// server is running. (No disk persistence: transient binary data.)
const audioMem = new Map();

// In-memory cache of images (hash -> imgRes message), same principle as audio:
// an image only transits once, then the server re-serves it to newcomers.
// Bounded: keeps at most IMG_MAX images (FIFO eviction) to avoid bloating RAM.
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
  const st = Array.isArray(obj.nodes) ? fromExport(obj) : obj; // export or native format
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
  // Migrates the legacy single-board file -> home.
  if (!boards.has('home') && fs.existsSync(OLD_BOARD_FILE)) {
    try { boards.set('home', boardFromObj(JSON.parse(fs.readFileSync(OLD_BOARD_FILE, 'utf8')))); } catch (e) { /* */ }
  }
  console.log(`[bete] ${boards.size} board(s) loaded: ${[...boards.keys()].join(', ') || '(none)'}`);
}

function getBoard(id) {
  let b = boards.get(id);
  if (!b) {
    if (boards.size >= MAX_BOARDS) { console.warn('[bete] board limit reached, ephemeral board:', id); }
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
    } catch (e) { console.error('[bete] save failed', id, e); }
  }, 1000);
}

// --- Sync (LWW + host priority on tie), per board ---
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
  audioMem.delete(msg.id); // frees the cached audio
  if (b.content.n[msg.id] || b.content.c[msg.id] || b.content.h[msg.id]) {
    delete b.content.n[msg.id]; delete b.content.c[msg.id]; delete b.content.h[msg.id]; delete b.mt[msg.id];
  }
}

// Presence: the server (host) + clients that have announced a name.
function broadcastPresence(b) {
  const users = [{ uid: 'server', name: 'Server', host: true, peerId: null, voice: false }];
  for (const c of b.conns) if (c._uid) users.push({ uid: c._uid, name: c._name || '', host: false, peerId: c._peerId || null, voice: !!c._voice });
  const payload = { type: 'presence', users };
  for (const c of b.conns) if (c.open) { try { c.send(payload); } catch (e) { /* */ } }
}

function handleData(id, b, msg, origin) {
  if (!msg) return;
  if (msg.type === 'sync') {
    if (merge(b, msg)) scheduleSave(id, b);
    // Actively pull any brand-new voice memo's audio directly from whoever
    // just announced it, instead of passively waiting for their proactive
    // push (shareAudio) to arrive cleanly. Whoever sent this delta is the
    // only one who could know about a fresh id, so they must be the recorder.
    for (const nid in msg.n || {}) {
      if (msg.n[nid].vc && !audioMem.has(nid)) {
        try { if (origin.open) origin.send({ type: 'audioReq', id: nid }); } catch (e) { /* */ }
      }
    }
  }
  else if (msg.type === 'move') { applyMove(b, msg); scheduleSave(id, b); }
  else if (msg.type === 'delete') { applyDelete(b, msg); scheduleSave(id, b); }
  else if (msg.type === 'audioReq') {
    // Voice memo requested: answers from the cache, otherwise relays to others.
    const cached = audioMem.get(msg.id);
    if (cached) { try { if (origin.open) origin.send(cached); } catch (e) { /* */ } }
    else for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'audioRes') {
    if (msg.buf) audioMem.set(msg.id, msg); // cache + resend as-is
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'imgReq') {
    // Image requested by hash: re-serves from cache, otherwise relays to others.
    const cached = imgMem.get(msg.hash);
    if (cached) { try { if (origin.open) origin.send(cached); } catch (e) { /* */ } }
    else for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'imgRes') {
    if (msg.buf) cacheImg(msg.hash, msg); // bounded cache + resend as-is
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
    return;
  } else if (msg.type === 'hello') {
    origin._uid = msg.uid; origin._name = msg.name; origin._peerId = msg.peerId; origin._voice = msg.voice;
    broadcastPresence(b);
    return;
  } else if (msg.type === 'cursor') {
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } } // relays cursors
    return;
  }
  if (msg.type === 'move' || msg.type === 'delete') {
    for (const c of b.conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
  }
}

// Per-entry signatures (n/c/h) to only broadcast what changed (delta).
function entrySigs(b) {
  const m = {};
  for (const id in b.content.n) m['n' + id] = JSON.stringify(b.content.n[id]);
  for (const id in b.content.c) m['c' + id] = JSON.stringify(b.content.c[id]);
  for (const id in b.content.h) m['h' + id] = JSON.stringify(b.content.h[id]);
  return m;
}

// Periodic broadcast IN DELTA: only the changed entries + deletions.
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

// --- Safety net: never crash on an unhandled error ---
// (e.g. "WebSocket was closed before the connection was established" from ws/peerjs).
process.on('uncaughtException', (e) => {
  console.error('[bete] uncaughtException ignored:', (e && e.message) || e);
  if (peer) { try { peer.destroy(); } catch (er) { /* */ } peer = null; scheduleRestart(); }
});
process.on('unhandledRejection', (e) => { console.error('[bete] unhandledRejection:', (e && e.message) || e); });

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
    console.log('\n[bete] HOST ONLINE (multi-board)');
    console.log('  id    : ' + rid);
    if (APP_URL) console.log('  link  : ' + APP_URL + '?peer=' + encodeURIComponent(rid));
    else console.log('  link  : <your-instance-url>/?peer=' + encodeURIComponent(rid) + '  (set BETE_APP_URL to show it in full)');
    console.log('  (add &id=name for a specific board)\n');
  });
  p.on('connection', (conn) => {
    if (p !== peer) return;
    const id = sanitizeBoard(conn.metadata && conn.metadata.board);
    const b = getBoard(id);
    conn._lastSeen = now();
    b.conns.push(conn);
    console.log(`[bete] client connected on "${id}" (${b.conns.length})`);
    conn.on('open', () => { try { conn.send(buildPayload(b)); } catch (e) { /* */ } });
    conn.on('data', (msg) => { conn._lastSeen = now(); handleData(id, b, msg, conn); });
    const drop = () => { const i = b.conns.indexOf(conn); if (i >= 0) b.conns.splice(i, 1); broadcastPresence(b); console.log(`[bete] client disconnected from "${id}" (${b.conns.length})`); };
    conn.on('close', drop);
    conn.on('error', drop);
  });
  p.on('disconnected', () => {
    if (p !== peer) return;
    // NB: p.reconnect() on this stack (wrtc/ws) can emit an unhandled WS error
    // and crash the process. We prefer to destroy + restart cleanly.
    console.warn('[bete] disconnected from the broker, restarting cleanly…');
    try { p.destroy(); } catch (e) { /* */ }
    peer = null;
    scheduleRestart();
  });
  p.on('error', (err) => {
    if (p !== peer) return;
    const t = err && err.type ? err.type : String(err);
    console.error('[bete] peer error:', t);
    if (t === 'unavailable-id') console.error('  -> id taken (another host running?). Retrying in 5s.');
    if (t === 'unavailable-id' || t === 'network' || t === 'server-error' || t === 'socket-error') {
      try { p.destroy(); } catch (e) { /* */ }
      peer = null;
      scheduleRestart();
    }
  });
}

setInterval(tick, 800);
// Regular heartbeat: proves to clients that the server is alive (otherwise
// they would trigger a re-election during periods of inactivity).
setInterval(() => {
  for (const [, b] of boards) for (const c of b.conns) if (c.open) { try { c.send({ type: 'ping' }); } catch (e) { /* */ } }
}, 3000);
// Cleans up silent clients (tab closed without a signal): > 9s with no message.
setInterval(() => {
  const cutoff = Date.now() - 9000;
  for (const [, b] of boards) {
    const before = b.conns.length;
    b.conns = b.conns.filter((c) => { const alive = !c._lastSeen || c._lastSeen > cutoff; if (!alive) { try { c.close(); } catch (e) { /* */ } } return alive; });
    if (b.conns.length !== before) broadcastPresence(b);
  }
}, 3000);
start();
