// Mémos vocaux : enregistrement (MediaRecorder/Opus), stockage IndexedDB,
// lecture play/pause, partage P2P de l'audio (cf. sync.js shareAudio/requestAudio).
import { state, newId, scheduleSave } from './state.js?v=mqwspf0j';
import { reset } from './physics.js?v=mqwspf0j';
import { putAudio, getAudio, delAudio } from './audio.js?v=mqwspf0j';
import { shareAudio, requestAudio } from './sync.js?v=mqwspf0j';

const players = {}; // id -> { audio, url }
const MAX_MS = 60000; // durée max d'un mémo : 1 minute

export function fmtDur(s) {
  s = Math.max(0, Math.round(s));
  const m = Math.floor(s / 60);
  return m + ':' + String(s % 60).padStart(2, '0');
}

function pickMime() {
  const cands = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'];
  for (const m of cands) { try { if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m; } catch (e) { /* */ } }
  return '';
}

// Petite fenêtre d'enregistrement (chrono + Stop / Annuler).
function buildRecModal() {
  const m = document.createElement('div');
  m.className = 'recmodal';
  m.innerHTML = '<div class="rec-card">'
    + '<div class="rec-dot"></div>'
    + '<div class="rec-timer">0:00</div>'
    + '<div class="rec-actions">'
    + '<button class="rec-stop">■ STOP</button>'
    + '<button class="rec-cancel">ANNULER</button>'
    + '</div></div>';
  // Empêche le clic de tomber sur le canvas.
  m.addEventListener('mousedown', (e) => e.stopPropagation());
  m.addEventListener('touchstart', (e) => e.stopPropagation());
  document.body.appendChild(m);
  return m;
}

export async function recordVoiceMemo(wx, wy) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    alert('Enregistrement audio non supporté par ce navigateur.');
    return;
  }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { alert('Micro indisponible ou refusé.'); return; }

  const mime = pickMime();
  let rec;
  try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined); }
  catch (e) { stream.getTracks().forEach((t) => t.stop()); alert('Enregistrement impossible.'); return; }

  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  const modal = buildRecModal();
  const t0 = performance.now();
  const timerEl = modal.querySelector('.rec-timer');
  const tick = setInterval(() => { timerEl.textContent = fmtDur((performance.now() - t0) / 1000) + ' / 1:00'; }, 200);
  // Arrêt automatique à 1 minute.
  const maxTimer = setTimeout(() => { if (rec.state !== 'inactive') rec.stop(); }, MAX_MS);
  let cancelled = false;

  rec.onstop = async () => {
    clearInterval(tick); clearTimeout(maxTimer);
    stream.getTracks().forEach((t) => t.stop());
    modal.remove();
    if (cancelled) return;
    const blob = new Blob(chunks, { type: mime || 'audio/webm' });
    if (!blob.size) return;
    const dur = Math.min(60, (performance.now() - t0) / 1000);
    const id = newId();
    try { await putAudio(id, blob); }
    catch (e) { alert('Stockage du mémo impossible.'); return; }
    const n = { id, kind: 'voice', x: wx - 90, y: wy - 40, w: 180, h: 80, dur: Math.round(dur) };
    state.nodes.push(n); reset(n); state.selected = n.id; scheduleSave();
    shareAudio(id, blob); // diffuse l'audio aux pairs connectés
  };

  modal.querySelector('.rec-stop').onclick = () => { if (rec.state !== 'inactive') rec.stop(); };
  modal.querySelector('.rec-cancel').onclick = () => { cancelled = true; clearTimeout(maxTimer); if (rec.state !== 'inactive') rec.stop(); else { clearInterval(tick); stream.getTracks().forEach((t) => t.stop()); modal.remove(); } };

  rec.start();
}

// Lecture / pause d'un mémo. Met à jour n._playing / n._prog pour le rendu.
export async function toggleVoice(n) {
  const p = players[n.id];
  if (p) {
    if (p.audio.paused) p.audio.play(); else p.audio.pause();
    return;
  }
  let blob;
  try { blob = await getAudio(n.id); } catch (e) { blob = null; }
  if (!blob) { n._missing = true; n._loading = true; requestAudio(n.id); return; } // demande l'audio aux pairs
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  players[n.id] = { audio, url };
  audio.ontimeupdate = () => { n._prog = audio.duration ? audio.currentTime / audio.duration : 0; };
  audio.onplay = () => { n._playing = true; };
  audio.onpause = () => { n._playing = false; };
  audio.onended = () => { n._playing = false; n._prog = 0; };
  audio.play();
}

// Supprime l'audio (IndexedDB + lecteur en cours) lors de la suppression du bloc.
export function removeVoiceAudio(id) {
  const p = players[id];
  if (p) { try { p.audio.pause(); } catch (e) { /* */ } URL.revokeObjectURL(p.url); delete players[id]; }
  delAudio(id);
}
