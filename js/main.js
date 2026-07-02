// Bootstrap + render loop.
import { state, restore, addRect, addCircle, addHexagon, load, setSaveSuppressed, scheduleSave, newId, setBoardId, setBoardName, getBoardName, initUndoBaseline } from './state.js?v=mr3qplto';
import { setView } from './camera.js?v=mr3qplto';
import { render } from './render.js?v=mr3qplto';
import { step, reset } from './physics.js?v=mr3qplto';
import * as minimap from './minimap.js?v=mr3qplto';
import * as input from './input.js?v=mr3qplto';
import * as fx from './fx.js?v=mr3qplto';
import { joinOrHost, getNetMode, liaisonStatus, disconnect, getUserCount, getPresence } from './sync.js?v=mr3qplto';
import { recordBoard, getBoardEntry } from './boards.js?v=mr3qplto';
import { TUTORIAL_FR, TUTORIAL_EN } from './tutorial.js?v=mr3qplto';
import { applyTheme } from './theme.js?v=mr3qplto';
import { initSettings, openSettings } from './settings.js?v=mr3qplto';
import { recordLiaison, getLiaison } from './liaisons.js?v=mr3qplto';
import { positionVideoOverlay } from './video.js?v=mr3qplto';
import { toggleMic, isMicOn, toggleListen, isListenOn } from './voicechat.js?v=mr3qplto';
import { migrateImages } from './images.js?v=mr3qplto';
import { t, getLang, applyStaticI18n } from './i18n.js?v=mr3qplto';

applyTheme(); // apply the saved theme right at startup
applyStaticI18n(); // translate the static HTML chrome (buttons, hint, etc.)

let toastTimer = null;
function toast(msg, ms = 2400) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// Shown when the liaison keeps flapping (see sync.js noteReconnectCycle): a
// toast would auto-hide and go unnoticed, so this is a persistent popup with
// an explicit action instead.
function showReconnectLoopPopup() {
  const el = document.getElementById('reconnectpopup');
  if (el) el.classList.remove('hidden');
}

const board = document.getElementById('board');
const ctx = board.getContext('2d');
let dpr = 1;

function resize() {
  dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  board.width = Math.floor(w * dpr);
  board.height = Math.floor(h * dpr);
  board.style.width = w + 'px';
  board.style.height = h + 'px';
  setView(w, h);
}

window.addEventListener('resize', resize);
resize();


// ---- Board selection (multi-boards) ----
function sanitizeId(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'home';
}
const params = new URLSearchParams(location.search);
const idParam = params.get('id');
const peerId = params.get('peer');
const fileUrl = params.get('file');
const nameParam = params.get('name');

// First launch: send the user to the tutorial (afterwards the app lives on home).
const REDIRECT = !localStorage.getItem('bete:seen') && !idParam && !peerId && !fileUrl;
if (REDIRECT) {
  try { localStorage.setItem('bete:seen', '1'); } catch (e) { /* */ }
  recordBoard('home', 'Home', null);
  recordBoard('tutorial', 'Tutorial', null);
  location.replace(location.pathname + '?id=tutorial');
}

let boardId = 'home';
function seedIfHome() { if (boardId === 'home') seedDemo(); }

if (!REDIRECT) {
  if (idParam) boardId = sanitizeId(idParam);
  else if (peerId) boardId = 'peer-' + sanitizeId(peerId);
  else boardId = 'home';
  setBoardId(boardId);

  if (boardId === 'tutorial') {
    load(getLang() === 'fr' ? TUTORIAL_FR : TUTORIAL_EN); // built-in board, read-only
    setSaveSuppressed(true);
    state.nodes.forEach(reset);
  } else if (peerId && boardId !== 'home') {
    if (!restore()) seedIfHome();
    state.nodes.forEach(reset);
    recordLiaison(peerId); // remembers the active liaison (renamable in Settings)
    toast(t('toast.connecting'));
    joinOrHost(peerId, (st) => {
      if (st === 'host') toast(t('toast.noHost'), 3500);
      else if (st === 'synced') toast(t('toast.synced'));
      else if (st === 'connected') toast(t('toast.connectedReceiving'));
      else if (st === 'error') toast(t('toast.unreachable'), 4000);
      else if (st === 'closed') toast(t('toast.hostDisconnected'), 4000);
      else if (st === 'loop') showReconnectLoopPopup();
    });
  } else if (fileUrl) {
    setSaveSuppressed(true);
    loadFromUrl(fileUrl);
    state.nodes.forEach(reset);
  } else {
    // Home is sanctuarized: never connected (so it can't be overwritten).
    if (peerId && boardId === 'home') toast(t('toast.homeLocal'), 3500);
    if (!restore()) seedIfHome();
    state.nodes.forEach(reset);
  }

  // Board name: serialized > ?name= > history > default. Then display + history.
  resolveBoardName(boardId);
  recordBoard(boardId, getBoardName(), (boardId !== 'home' && peerId) || null);
  applyBoardNameUI();
  initUndoBaseline(); // reference state for undo

  // Soft migration of legacy images (inline base64 -> IndexedDB ref): lightens
  // localStorage AND sync. Not on the tutorial (read-only). Best-effort, in the background.
  if (boardId !== 'tutorial') migrateImages(state.nodes, scheduleSave).catch(() => {});
}

// Resolves and applies the displayed board name.
function resolveBoardName(id) {
  let name;
  if (id === 'home') name = t('board.home');
  else if (id === 'tutorial') name = t('board.tutorial');
  else {
    name = getBoardName() || nameParam || (getBoardEntry(id) && getBoardEntry(id).name) || id;
  }
  setBoardName(name);
  document.title = 'Bete' + (id === 'home' ? '' : ' · ' + name);
}

function applyBoardNameUI() {
  const el = document.getElementById('boardname');
  el.textContent = getBoardName();
  const editable = boardId !== 'home' && boardId !== 'tutorial';
  el.classList.toggle('editable', editable);
  if (editable && !el._wired) { el._wired = true; el.addEventListener('click', beginRenameBoard); }
}

function beginRenameBoard() {
  const el = document.getElementById('boardname');
  if (el.getAttribute('contenteditable') === 'true') return;
  el.setAttribute('contenteditable', 'true');
  el.focus();
  const range = document.createRange(); range.selectNodeContents(el);
  const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    else if (e.key === 'Escape') { el.textContent = getBoardName(); el.blur(); }
  };
  const commit = () => {
    el.removeAttribute('contenteditable');
    el.removeEventListener('blur', commit);
    el.removeEventListener('keydown', onKey);
    const nm = (el.textContent || '').replace(/\n/g, ' ').trim().slice(0, 40) || getBoardName();
    setBoardName(nm); el.textContent = nm;
    document.title = 'Bete · ' + nm;
    recordBoard(boardId, nm, peerId || null);
    scheduleSave();
  };
  el.addEventListener('keydown', onKey);
  el.addEventListener('blur', commit);
}

async function loadFromUrl(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (!load(await res.json())) throw new Error('Invalid JSON');
    state.nodes.forEach(reset);
  } catch (err) {
    console.warn('Bete: failed to load', url, err);
    // Fallback: localStorage or demo, and re-enable saving.
    setSaveSuppressed(false);
    if (!restore()) seedIfHome();
    state.nodes.forEach(reset);
  }
}

function seedDemo() {
  const c = addCircle(-140, 0, '#107c10');
  c.description = 'TODO';
  const a = addRect(-230, -30, 'Task A');
  const b = addRect(-180, 50, 'Drag me\ninto the hexa');
  // Hexagon "TODAY" with a link to Task A.
  const hx = addHexagon(190, 0, '#ff8c00');
  hx.description = 'TODAY';
  const link = { id: newId(), x: 130, y: -30, w: 150, h: 70, ref: a.id };
  state.nodes.push(link);
  reset(a); reset(b); reset(link);
}

if (!REDIRECT) {
  minimap.init();
  input.init(board, () => { state.nodes.forEach(reset); });
  initSettings();
  const vbtn = document.getElementById('voicebtn');
  if (vbtn) {
    const tog = async (e) => { e.preventDefault(); e.stopPropagation(); await toggleMic(); vbtn.classList.toggle('on', isMicOn()); };
    vbtn.addEventListener('mousedown', tog);
    vbtn.addEventListener('touchstart', tog);
  }
  const spk = document.getElementById('speakerbtn');
  if (spk) {
    const tog = (e) => { e.preventDefault(); e.stopPropagation(); toggleListen(); spk.classList.toggle('off', !isListenOn()); };
    spk.addEventListener('mousedown', tog);
    spk.addEventListener('touchstart', tog);
  }
  const rpRefresh = document.getElementById('reconnectRefresh');
  if (rpRefresh) rpRefresh.addEventListener('click', () => location.reload());
  const rpDismiss = document.getElementById('reconnectDismiss');
  if (rpDismiss) rpDismiss.addEventListener('click', () => document.getElementById('reconnectpopup').classList.add('hidden'));

  // Debug handle (console inspection: bete.state).
  window.bete = { state, fx };
  requestAnimationFrame(loop);
}

let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  // Rectangle physics + particles.
  for (const n of state.nodes) step(n, dt);
  fx.update(dt);

  // Render the board (in CSS px coordinates thanks to the DPR scale).
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  render(ctx);
  fx.render(ctx);

  minimap.render();
  updateNetMode();
  updateLiaisonBadge();
  positionVideoOverlay(); // realigns the inline YouTube player on its block
  requestAnimationFrame(loop);
}

// "Who's talking" banner: list of participants with the mic active.
let lastSpeakers = '';
function updateSpeakers(connected) {
  const el = document.getElementById('speakers');
  if (!el) return;
  const talkers = connected ? getPresence().filter((u) => u.voice).map((u) => (u.me ? t('liaison.you') : (u.name || t('liaison.guest')))) : [];
  const sig = talkers.join(',');
  if (sig === lastSpeakers) return;
  lastSpeakers = sig;
  if (!talkers.length) { el.classList.remove('show'); el.textContent = ''; return; }
  el.textContent = '🎤 ' + talkers.join(', ');
  el.classList.add('show');
}

// Active liaison indicator (top center) + disconnect button.
let lastLiaison = '';
function updateLiaisonBadge() {
  const st = liaisonStatus();
  const name = st.role === 'host' ? t('liaison.host') : (st.role === 'client' ? ((getLiaison(st.peer) && getLiaison(st.peer).name) || st.peer) : '');
  const count = st.role ? getUserCount() : 0;
  const sig = (st.role || '') + '|' + name + '|' + count;
  const vb = document.getElementById('voicebtn');
  if (vb) { vb.classList.toggle('hidden', !st.role); if (!st.role) vb.classList.remove('on'); }
  const spk = document.getElementById('speakerbtn');
  if (spk) spk.classList.toggle('hidden', !st.role);
  updateSpeakers(!!st.role);
  if (sig === lastLiaison) return;
  lastLiaison = sig;
  const el = document.getElementById('liaisonbadge');
  if (!el) return;
  if (!st.role) { el.classList.remove('show'); el.innerHTML = ''; return; }
  el.innerHTML = '';
  const lbl = document.createElement('span');
  lbl.className = 'lb-name';
  lbl.textContent = (st.role === 'host' ? '🟢 ' : '🔗 ') + name + (count > 1 ? '  👤' + count : '');
  lbl.title = t('liaison.manage');
  lbl.addEventListener('click', () => openSettings());
  const x = document.createElement('button');
  x.className = 'lb-x';
  x.textContent = '✕';
  x.title = t('liaison.disconnect');
  x.addEventListener('click', (e) => { e.stopPropagation(); disconnect(); });
  el.appendChild(lbl); el.appendChild(x);
  el.classList.add('show');
}

// Direct P2P / TURN relay indicator (only updated when it changes).
let lastNet;
function updateNetMode() {
  const nm = getNetMode();
  if (nm === lastNet) return;
  lastNet = nm;
  const el = document.getElementById('netmode');
  if (!nm) { el.className = ''; el.textContent = ''; }
  else if (nm === 'relay') { el.className = 'show relay'; el.textContent = t('net.relay'); }
  else if (nm === 'p2p') { el.className = 'show p2p'; el.textContent = t('net.p2p'); }
  else { el.className = 'show'; el.textContent = t('net.connecting'); }
}

// Clean re-render once the pixel font has loaded.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { /* the RAF loop resumes rendering */ });
}
