// Hôte PeerJS headless pour TODOMAPPA — destiné à tourner en permanence
// (ex. Raspberry Pi). Il joue exactement le rôle d'un hôte navigateur :
// même protocole de synchro, donc les clients web se connectent via
// ?peer=<id> sans aucune modification de l'app.
//
// Il ne fait QUE détenir le contenu (texte, image, couleur, description,
// liens, positions, créations/suppressions) et le persister sur disque.
// Aucun rendu, aucune caméra.

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
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
const ID_FILE = path.join(DATA_DIR, 'peer-id');
const APP_URL = process.env.TODOMAPPA_APP_URL || 'https://remisarrailh.github.io/pensebete/';

fs.mkdirSync(DATA_DIR, { recursive: true });

function resolveId() {
  if (process.env.TODOMAPPA_ID) return process.env.TODOMAPPA_ID;
  try { const id = fs.readFileSync(ID_FILE, 'utf8').trim(); if (id) return id; } catch (e) { /* */ }
  const id = 'tm-' + crypto.randomBytes(5).toString('hex');
  try { fs.writeFileSync(ID_FILE, id); } catch (e) { /* */ }
  return id;
}
const PEER_ID = resolveId();

// --- État (mêmes maps que le protocole) ---
let content = { n: {}, c: {}, h: {} };
let mt = {};            // id -> horodatage de dernière modif
let del = new Set();    // tombstones (suppressions)

// Conversion depuis un export de l'app (format {nodes:[],circles:[],hexagons:[]}).
function fromExport(obj) {
  const n = {}, c = {}, h = {}, m = {}; const now = Date.now();
  for (const nd of obj.nodes || []) {
    if (nd.kind === 'liaison') continue;
    if (nd.ref !== undefined) n[nd.id] = { ref: nd.ref, x: nd.x, y: nd.y, w: nd.w, h: nd.h };
    else {
      const e = { t: nd.text || '', img: nd.image || null, x: nd.x, y: nd.y, w: nd.w, h: nd.h };
      if (nd.kind === 'pancarte') e.k = 'pancarte';
      if (nd.link) e.lk = nd.link;
      n[nd.id] = e;
    }
    m[nd.id] = now;
  }
  for (const z of obj.circles || []) { c[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r }; m[z.id] = now; }
  for (const z of obj.hexagons || []) { h[z.id] = { col: z.color, d: z.description || '', x: z.x, y: z.y, r: z.r }; m[z.id] = now; }
  return { n, c, h, mt: m, del: [] };
}

function loadState() {
  try {
    const obj = JSON.parse(fs.readFileSync(BOARD_FILE, 'utf8'));
    const st = Array.isArray(obj.nodes) ? fromExport(obj) : obj; // export ou format natif
    content = { n: st.n || {}, c: st.c || {}, h: st.h || {} };
    mt = st.mt || {};
    del = new Set(st.del || []);
    console.log(`[todomappa] board chargé : ${Object.keys(content.n).length} blocs, ${Object.keys(content.c).length} cercles, ${Object.keys(content.h).length} hexagones`);
  } catch (e) {
    console.log('[todomappa] aucun board existant, démarrage à vide');
  }
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(BOARD_FILE, JSON.stringify({ ...content, mt, del: [...del] }));
    } catch (e) { console.error('[todomappa] échec sauvegarde', e); }
  }, 1000);
}

// --- Synchro (même logique que l'app : LWW + priorité à l'hôte à égalité) ---
const conns = [];

function buildPayload() {
  return { type: 'sync', from: 'host', n: content.n, c: content.c, h: content.h, mt: { ...mt }, del: [...del] };
}

function merge(remote) {
  let changed = false;
  const win = (id) => {
    const rm = (remote.mt && remote.mt[id]) || 0;
    const lm = mt[id] || 0;
    return rm > lm || (rm === lm && remote.from === 'host');
  };
  for (const id of remote.del || []) {
    if (!del.has(id)) del.add(id);
    if (content.n[id] || content.c[id] || content.h[id]) {
      delete content.n[id]; delete content.c[id]; delete content.h[id]; delete mt[id]; changed = true;
    }
  }
  const mergeMap = (map, rem) => {
    for (const id in rem || {}) {
      if (del.has(id)) continue;
      if (win(id)) { map[id] = rem[id]; mt[id] = (remote.mt && remote.mt[id]) || Date.now(); changed = true; }
    }
  };
  mergeMap(content.n, remote.n);
  mergeMap(content.c, remote.c);
  mergeMap(content.h, remote.h);
  return changed;
}

function applyMove(msg) {
  const e = content.n[msg.id] || content.c[msg.id] || content.h[msg.id];
  if (!e) return;
  if (msg.x != null) e.x = msg.x;
  if (msg.y != null) e.y = msg.y;
  if (msg.w != null) e.w = msg.w;
  if (msg.h != null) e.h = msg.h;
  if (msg.r != null) e.r = msg.r;
  scheduleSave();
}

function applyDelete(msg) {
  del.add(msg.id);
  if (content.n[msg.id] || content.c[msg.id] || content.h[msg.id]) {
    delete content.n[msg.id]; delete content.c[msg.id]; delete content.h[msg.id]; delete mt[msg.id];
    scheduleSave();
  }
}

function handleData(msg, origin) {
  if (!msg) return;
  if (msg.type === 'sync') { if (merge(msg)) scheduleSave(); }
  else if (msg.type === 'move') applyMove(msg);
  else if (msg.type === 'delete') applyDelete(msg);
  // Relais des événements ponctuels aux autres clients.
  if (msg.type === 'move' || msg.type === 'delete') {
    for (const c of conns) if (c !== origin && c.open) { try { c.send(msg); } catch (e) { /* */ } }
  }
}

// Diffusion périodique de l'état si le contenu a changé.
let lastSig = '';
function tick() {
  if (!conns.length) return;
  const sig = JSON.stringify({ n: content.n, c: content.c, h: content.h, del: [...del] });
  if (sig === lastSig) return;
  lastSig = sig;
  const payload = buildPayload();
  for (const c of conns) if (c.open) { try { c.send(payload); } catch (e) { /* */ } }
}

// --- Peer ---
loadState();

const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];

function start() {
  const peer = new Peer(PEER_ID, {
    host: '0.peerjs.com', port: 443, path: '/', secure: true, key: 'peerjs',
    config: { iceServers: ICE },
  });

  peer.on('open', (id) => {
    console.log('\n[todomappa] HÔTE EN LIGNE');
    console.log('  id    : ' + id);
    console.log('  lien  : ' + APP_URL + '?peer=' + encodeURIComponent(id) + '\n');
  });
  peer.on('connection', (conn) => {
    conns.push(conn);
    console.log('[todomappa] client connecté (' + conns.length + ')');
    conn.on('open', () => { try { conn.send(buildPayload()); } catch (e) { /* */ } });
    conn.on('data', (msg) => handleData(msg, conn));
    const drop = () => { const i = conns.indexOf(conn); if (i >= 0) conns.splice(i, 1); console.log('[todomappa] client déconnecté (' + conns.length + ')'); };
    conn.on('close', drop);
    conn.on('error', drop);
  });
  peer.on('disconnected', () => {
    console.warn('[todomappa] déconnecté du broker, reconnexion…');
    try { peer.reconnect(); } catch (e) { /* */ }
  });
  peer.on('error', (err) => {
    console.error('[todomappa] erreur peer :', err && err.type ? err.type : err);
    if (err && err.type === 'unavailable-id') {
      console.error('  -> id déjà utilisé (un autre hôte tourne ?). Réessai dans 5s.');
      setTimeout(() => { try { peer.destroy(); } catch (e) {} start(); }, 5000);
    }
  });

  setInterval(tick, 800);
}

start();
