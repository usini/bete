// Synchronisation P2P temporaire via PeerJS (WebRTC).
// HOST : héberge un peer, diffuse son board aux clients connectés.
// CLIENT : se connecte à un peer, reçoit le board et écrase le sien.
// Les libs (PeerJS, générateur de QR) sont chargées à la demande depuis un CDN.
import { serialize, load } from './state.js';

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

// ---- HOST ----
let hostPeer = null;
let hostConns = [];
let broadcastTimer = null;
let lastSent = '';

export async function startHost(node) {
  stopHost();
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
    node.peerId = id;
    node.code = id;
    node.url = buildUrl(id);
    node.status = 'online';
  });
  peer.on('error', (err) => {
    node.status = 'error';
    console.warn('TODOMAPPA: erreur peer (host)', err);
  });
  peer.on('connection', (conn) => {
    hostConns.push(conn);
    node.status = 'connected';
    conn.on('open', () => { try { conn.send({ type: 'state', data: serialize() }); } catch (e) { /* */ } });
    conn.on('close', () => { hostConns = hostConns.filter((c) => c !== conn); });
    conn.on('error', () => { hostConns = hostConns.filter((c) => c !== conn); });
  });

  // Diffusion périodique du board si modifié.
  broadcastTimer = setInterval(() => {
    if (!hostConns.length) return;
    const json = JSON.stringify(serialize());
    if (json === lastSent) return;
    lastSent = json;
    const data = JSON.parse(json);
    hostConns.forEach((c) => { try { if (c.open) c.send({ type: 'state', data }); } catch (e) { /* */ } });
  }, 800);
}

export function stopHost() {
  if (broadcastTimer) { clearInterval(broadcastTimer); broadcastTimer = null; }
  hostConns = [];
  lastSent = '';
  if (hostPeer) { try { hostPeer.destroy(); } catch (e) { /* */ } hostPeer = null; }
}

// ---- CLIENT ----
let clientPeer = null;

export async function joinHost(peerId, onState, onStatus) {
  try {
    await loadPeer();
  } catch (e) {
    onStatus && onStatus('error');
    return;
  }
  onStatus && onStatus('connecting');
  const peer = new Peer();
  clientPeer = peer;

  peer.on('open', () => {
    const conn = peer.connect(peerId, { reliable: true });
    conn.on('open', () => onStatus && onStatus('connected'));
    conn.on('data', (msg) => {
      if (msg && msg.type === 'state') {
        load(msg.data);
        onState && onState();
        onStatus && onStatus('synced');
      }
    });
    conn.on('error', () => onStatus && onStatus('error'));
    conn.on('close', () => onStatus && onStatus('closed'));
  });
  peer.on('error', (err) => {
    onStatus && onStatus('error');
    console.warn('TODOMAPPA: erreur peer (client)', err);
  });
}
