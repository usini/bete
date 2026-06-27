// Chat vocal live en maillage (mesh) P2P via PeerJS MediaConnection.
// Chaque participant "voix active" appelle les autres en direct (audio).
// L'audio ne passe PAS par le Pi : navigateur <-> navigateur (latence faible).
import { getPeer, getPresence, setLocalVoice, onIncomingCall } from './sync.js?v=mqwus8x9';

let voiceOn = false;
let micStream = null;
let timer = null;
const calls = {}; // remotePeerId -> { conn, audio }

export function isVoiceOn() { return voiceOn; }

export async function toggleVoiceChat() {
  if (voiceOn) { disable(); return false; }
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { alert('Micro indisponible ou refusé.'); return false; }
  voiceOn = true;
  setLocalVoice(true);
  reconcile();
  timer = setInterval(reconcile, 1500); // (re)connecte selon la présence
  return true;
}

function disable() {
  voiceOn = false;
  setLocalVoice(false);
  if (timer) { clearInterval(timer); timer = null; }
  Object.keys(calls).forEach(dropCall);
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
}

// Connecte/déconnecte selon les participants "voix active".
function reconcile() {
  if (!voiceOn) return;
  const peer = getPeer();
  const myId = peer && peer.id;
  if (!myId || !micStream) return;
  const targets = getPresence().filter((u) => !u.me && u.voice && u.peerId);
  const want = {};
  targets.forEach((u) => {
    want[u.peerId] = 1;
    if (calls[u.peerId]) return;
    // Pour éviter un double appel, seul l'id le plus petit initie.
    if (myId < u.peerId) {
      try {
        const conn = peer.call(u.peerId, micStream);
        if (conn) attachCall(u.peerId, conn);
      } catch (e) { /* */ }
    }
  });
  // Ferme les appels devenus inutiles (peer parti / micro coupé).
  Object.keys(calls).forEach((id) => { if (!want[id]) dropCall(id); });
}

// Appel entrant : on répond avec notre micro et on joue l'audio distant.
onIncomingCall((conn) => {
  if (!voiceOn || !micStream) { try { conn.close(); } catch (e) { /* */ } return; }
  if (calls[conn.peer]) { try { conn.close(); } catch (e) { /* */ } return; } // glare : on garde l'existant
  try { conn.answer(micStream); } catch (e) { /* */ }
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
  if (!c.audio) {
    const a = new Audio();
    a.autoplay = true;
    a.playsInline = true;
    c.audio = a;
  }
  c.audio.srcObject = stream;
  c.audio.play().catch(() => {});
}

function dropCall(remoteId) {
  const c = calls[remoteId];
  if (!c) return;
  try { c.conn && c.conn.close(); } catch (e) { /* */ }
  if (c.audio) { c.audio.srcObject = null; }
  delete calls[remoteId];
}
