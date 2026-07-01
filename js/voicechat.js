// Chat vocal live en maillage (mesh) P2P via PeerJS MediaConnection.
// Écoute par défaut : tant qu'on est en liaison, on répond aux appels (on entend
// tout le monde). Le bouton micro ne contrôle que NOTRE émission (parler).
// L'audio ne passe PAS par le Pi : navigateur <-> navigateur (latence faible).
import { getPeer, getPresence, setLocalVoice, onIncomingCall } from './sync.js?v=mr263t0f';

let micOn = false;
let listenOn = true; // écoute activée par défaut
let micStream = null;
let silentStream = null;
let _ac = null;
const calls = {}; // remotePeerId -> { conn, audio }

export function isMicOn() { return micOn; }
export function isListenOn() { return listenOn; }

// Coupe / réactive l'écoute (audio entrant). Par défaut activée.
export function toggleListen() {
  listenOn = !listenOn;
  Object.values(calls).forEach((c) => { if (c.audio) c.audio.muted = !listenOn; });
  reconcile();
  return listenOn;
}

// Piste audio silencieuse (pour participer/écouter sans demander le micro).
function silent() {
  if (silentStream) return silentStream;
  try {
    _ac = new (window.AudioContext || window.webkitAudioContext)();
    const dst = _ac.createMediaStreamDestination();
    const g = _ac.createGain(); g.gain.value = 0;
    const o = _ac.createOscillator(); o.connect(g).connect(dst); o.start();
    silentStream = dst.stream;
  } catch (e) { silentStream = new MediaStream(); }
  return silentStream;
}
function outStream() { return (micOn && micStream) ? micStream : silent(); }

// Active / coupe NOTRE micro (émission). L'écoute reste toujours active.
export async function toggleMic() {
  if (micOn) {
    micOn = false; setLocalVoice(false);
    if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
    replaceOutgoing(silent().getAudioTracks()[0]);
    return false;
  }
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { alert('Micro indisponible ou refusé.'); return false; }
  micOn = true; setLocalVoice(true);
  replaceOutgoing(micStream.getAudioTracks()[0]);
  reconcile(); // connecte tout le monde pour qu'ils nous entendent
  return true;
}

// Remplace la piste émise sur toutes les connexions actives (sans rouvrir).
function replaceOutgoing(track) {
  Object.values(calls).forEach((c) => {
    try {
      const pc = c.conn && c.conn.peerConnection;
      const s = pc && pc.getSenders().find((x) => x.track && x.track.kind === 'audio');
      if (s && track) s.replaceTrack(track);
    } catch (e) { /* */ }
  });
}

// Connecte selon qui parle : on appelle un pair si NOUS parlons ou s'IL parle.
// (Silence total => aucune connexion. On entend chacun dès qu'il prend la parole.)
function reconcile() {
  const peer = getPeer();
  const myId = peer && peer.id;
  if (!myId) { Object.keys(calls).forEach(dropCall); return; }
  const want = {};
  getPresence().forEach((u) => {
    if (u.me || !u.peerId) return;
    // On se connecte si NOUS parlons (pour être entendu), ou si on écoute quelqu'un qui parle.
    if (!micOn && !(listenOn && u.voice)) return;
    want[u.peerId] = 1;
    if (calls[u.peerId]) return;
    if (myId < u.peerId) { // l'id le plus petit initie (anti-doublon)
      try { const c = peer.call(u.peerId, outStream()); if (c) attachCall(u.peerId, c); } catch (e) { /* */ }
    }
  });
  Object.keys(calls).forEach((id) => { if (!want[id]) dropCall(id); });
}
setInterval(reconcile, 1500);

// Appel entrant : on répond TOUJOURS (écoute par défaut), avec notre piste courante.
onIncomingCall((conn) => {
  if (calls[conn.peer]) { try { conn.close(); } catch (e) { /* */ } return; } // glare
  if (!micOn && !listenOn) { try { conn.close(); } catch (e) { /* */ } return; } // ni parler ni écouter
  try { conn.answer(outStream()); } catch (e) { /* */ }
  attachCall(conn.peer, conn);
});

function attachCall(remoteId, conn) {
  calls[remoteId] = { conn, audio: null };
  conn.on('stream', (stream) => playRemote(remoteId, stream));
  conn.on('close', () => dropCall(remoteId));
  conn.on('error', () => dropCall(remoteId));
}

function playRemote(remoteId, stream) {
  const c = calls[remoteId];
  if (!c) return;
  if (!c.audio) { const a = new Audio(); a.autoplay = true; a.playsInline = true; c.audio = a; }
  c.audio.muted = !listenOn;
  c.audio.srcObject = stream;
  c.audio.play().catch(() => {});
}

function dropCall(remoteId) {
  const c = calls[remoteId];
  if (!c) return;
  try { c.conn && c.conn.close(); } catch (e) { /* */ }
  if (c.audio) c.audio.srcObject = null;
  delete calls[remoteId];
}
