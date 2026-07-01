// Chat vocal live en maillage (mesh) P2P via PeerJS MediaConnection.
// Écoute par défaut : tant qu'on est en liaison, on répond aux appels (on entend
// tout le monde). Le bouton micro ne contrôle que NOTRE émission (parler).
// L'audio ne passe PAS par le Pi : navigateur <-> navigateur (latence faible).
import { getPeer, getPresence, setLocalVoice, onIncomingCall } from './sync.js?v=mr2946h3';

let micOn = false;
let listenOn = true; // écoute activée par défaut
let micStream = null;
let silentStream = null;
let _ac = null;
let wakeLock = null;
const calls = {}; // remotePeerId -> { conn, audio }

// "Always On" (mobile) : sur téléphone, l'écran qui se verrouille suspend souvent
// le micro/la connexion. Ce mode demande un Wake Lock (écran maintenu allumé tant
// que le micro parle) et réacquiert automatiquement le flux s'il est coupé par l'OS
// (appel entrant, perte de focus, etc.), pour garder le micro actif en continu.
let alwaysOn = false;
try { alwaysOn = localStorage.getItem('bete:micalwayson') === '1'; } catch (e) { /* */ }
export function isAlwaysOn() { return alwaysOn; }
export function setAlwaysOn(v) {
  alwaysOn = !!v;
  try { localStorage.setItem('bete:micalwayson', alwaysOn ? '1' : '0'); } catch (e) { /* */ }
  if (alwaysOn && micOn) acquireWakeLock(); else releaseWakeLock();
}

// Micro d'entrée préféré (deviceId), si le téléphone/PC en a plusieurs.
let preferredMicId = '';
try { preferredMicId = localStorage.getItem('bete:micdevice') || ''; } catch (e) { /* */ }
export function getPreferredMic() { return preferredMicId; }
export function setPreferredMic(id) {
  preferredMicId = id || '';
  try { localStorage.setItem('bete:micdevice', preferredMicId); } catch (e) { /* */ }
  if (micOn) restartMic(); // applique tout de suite si on parle déjà
}
// Liste des micros disponibles (nécessite un accès micro déjà accordé pour avoir les labels).
export async function listMics() {
  try {
    const devs = await navigator.mediaDevices.enumerateDevices();
    return devs.filter((d) => d.kind === 'audioinput');
  } catch (e) { return []; }
}

function micConstraints() {
  return { audio: preferredMicId ? { deviceId: { exact: preferredMicId } } : true };
}

async function acquireWakeLock() {
  if (!alwaysOn || !navigator.wakeLock || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; } // refusé (onglet caché, etc.) : pas bloquant
}
function releaseWakeLock() { if (wakeLock) { try { wakeLock.release(); } catch (e) { /* */ } wakeLock = null; } }
// Le Wake Lock est libéré par le navigateur quand l'onglet passe en arrière-plan :
// on le redemande au retour au premier plan si le micro est toujours actif.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && micOn) acquireWakeLock(); });

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
    releaseWakeLock();
    stopMicStream();
    replaceOutgoing(silent().getAudioTracks()[0]);
    return false;
  }
  try { micStream = await navigator.mediaDevices.getUserMedia(micConstraints()); }
  catch (e) { alert('Micro indisponible ou refusé.'); return false; }
  attachEndedWatch(micStream);
  micOn = true; setLocalVoice(true);
  acquireWakeLock();
  replaceOutgoing(micStream.getAudioTracks()[0]);
  reconcile(); // connecte tout le monde pour qu'ils nous entendent
  return true;
}

function stopMicStream() {
  if (micStream) { micStream.getTracks().forEach((t) => t.stop()); micStream = null; }
}

// Surveille la coupure de la piste par l'OS (appel entrant, appareil débranché...).
// En mode Always On, on retente aussitôt pour garder le micro actif en continu.
function attachEndedWatch(stream) {
  const track = stream.getAudioTracks()[0];
  if (!track) return;
  track.onended = () => { if (micOn && stream === micStream) { if (alwaysOn) restartMic(); else { micOn = false; setLocalVoice(false); replaceOutgoing(silent().getAudioTracks()[0]); } } };
}

// Redémarre le flux micro sans le couper côté UI (utilisé par Always On + changement d'appareil).
async function restartMic() {
  stopMicStream();
  try { micStream = await navigator.mediaDevices.getUserMedia(micConstraints()); }
  catch (e) { micStream = null; return; } // réessaiera au prochain déclencheur (visibilitychange, etc.)
  attachEndedWatch(micStream);
  replaceOutgoing(micStream.getAudioTracks()[0]);
}
// Nouvelle tentative si la reprise a échoué au moment du 'ended' (ex : micro momentanément
// indisponible pendant un appel téléphonique) et qu'on revient au premier plan.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && micOn && alwaysOn && !micStream) restartMic(); });

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
