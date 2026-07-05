// Settings menu: theme, language, text size, named liaisons, navigation
// (tutorial / visited boards), clear the current board. Audio and Visual
// (theme/text size) live in their own sub-panels to keep the main list short.
import { state, getBoardId, scheduleSave } from './state.js?v=mr7lanz7';
import { theme, themeId_, setTheme, getTextScale, setTextScale, THEME_LIST } from './theme.js?v=mr7lanz7';
import { listBoards, buildBoardUrl } from './boards.js?v=mr7lanz7';
import { listLiaisons, recordLiaison, renameLiaison, removeLiaison } from './liaisons.js?v=mr7lanz7';
import { liaisonStatus, disconnect, getPresence, announceName, setBoardReadOnly, isOwner } from './sync.js?v=mr7lanz7';
import { exportJSON, importJSON, exportAllBoards, importAllBoards } from './io.js?v=mr7lanz7';
import { exportBoardHtml } from './exportHtml.js?v=mr7lanz7';
import { getUserName, setUserName } from './users.js?v=mr7lanz7';
import { isAlwaysOn, setAlwaysOn, listMics, getPreferredMic, setPreferredMic, isMicOn } from './voicechat.js?v=mr7lanz7';
import { t, getLang, setLang, LANGS } from './i18n.js?v=mr7lanz7';
import { isDesktop, getLinkMode, setLinkMode, getAppVersion } from './platform.js?v=mr7lanz7';

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

// Which panel is currently shown: 'main' (the list) or a sub-panel.
let view = 'main';

export function initSettings() {
  const panel = document.getElementById('settings');
  // Click inside the panel: don't close it.
  panel.addEventListener('mousedown', (e) => e.stopPropagation());
  panel.addEventListener('touchstart', (e) => e.stopPropagation());
  const btn = document.getElementById('settingsbtn');
  if (btn) {
    const open = (e) => { e.preventDefault(); e.stopPropagation(); openSettings(); };
    btn.addEventListener('mousedown', open);
    btn.addEventListener('touchstart', open);
  }
}

export function closeSettings() {
  document.getElementById('settings').classList.add('hidden');
  document.removeEventListener('mousedown', onOutside);
  document.removeEventListener('touchstart', onOutside);
}
function onOutside() { closeSettings(); }

export function openSettings() {
  view = 'main'; // always land on the main list, never a stale sub-panel
  const panel = document.getElementById('settings');
  build(panel);
  panel.classList.remove('hidden');
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, { once: true });
    document.addEventListener('touchstart', onOutside, { once: true });
  }, 0);
}

function build(panel) {
  panel.innerHTML = '';
  if (view === 'audio') { buildAudio(panel); return; }
  if (view === 'visual') { buildVisual(panel); return; }
  buildMain(panel);
}

// Header for the main panel: title + close.
function mainHead(panel) {
  const head = el('div', 'set-head');
  head.appendChild(el('div', 'set-title', t('settings.title')));
  const close = el('button', 'set-x', '✕');
  close.addEventListener('click', closeSettings);
  head.appendChild(close);
  panel.appendChild(head);
}

// Header for a sub-panel: back arrow + title + close.
function subHead(panel, titleKey) {
  const head = el('div', 'set-head');
  const back = el('button', 'set-back', '←');
  back.title = t('settings.back');
  back.addEventListener('click', () => { view = 'main'; build(panel); });
  head.appendChild(back);
  head.appendChild(el('div', 'set-title', t(titleKey)));
  const close = el('button', 'set-x', '✕');
  close.addEventListener('click', closeSettings);
  head.appendChild(close);
  panel.appendChild(head);
}

function buildMain(panel) {
  mainHead(panel);

  // ---- Sub-menus ----
  const audioBtn = el('button', 'set-wide', '🎧 ' + t('settings.audio'));
  audioBtn.addEventListener('click', () => { view = 'audio'; build(panel); });
  panel.appendChild(audioBtn);

  const visualBtn = el('button', 'set-wide', '🎨 ' + t('settings.visual'));
  visualBtn.addEventListener('click', () => { view = 'visual'; build(panel); });
  panel.appendChild(visualBtn);

  // ---- 1. Language ----
  panel.appendChild(el('div', 'set-label', t('settings.language')));
  const langs = el('div', 'set-themes');
  LANGS.forEach((l) => {
    const b = el('button', 'set-theme' + (getLang() === l.code ? ' on' : ''), l.label);
    b.addEventListener('click', () => { setLang(l.code); build(panel); });
    langs.appendChild(b);
  });
  panel.appendChild(langs);

  // ---- 2. User ----
  panel.appendChild(el('div', 'set-label', t('settings.user')));
  const nameRow = el('div', 'set-new');
  const nin = el('input'); nin.placeholder = t('settings.namePlaceholder'); nin.maxLength = 24; nin.value = getUserName();
  const nb = el('button', null, t('settings.ok'));
  const saveName = () => { setUserName(nin.value.trim()); announceName(); build(panel); };
  nb.addEventListener('click', saveName);
  nin.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
  nameRow.appendChild(nin); nameRow.appendChild(nb);
  panel.appendChild(nameRow);

  const presence = getPresence();
  if (presence.length) {
    panel.appendChild(el('div', 'set-sub', t('settings.connectedCount', { n: presence.length })));
    presence.forEach((u) => {
      const label = (u.host ? '🟢 ' : '👤 ') + (u.name || t('liaison.guest')) + (u.me ? t('settings.you') : '') + (u.voice ? ' 🎤' : '');
      panel.appendChild(el('div', 'set-empty', label));
    });
  }

  // ---- 3. Navigation ----
  panel.appendChild(el('div', 'set-label', t('settings.navigation')));
  const tuto = el('button', 'set-wide', t('settings.replayTutorial'));
  tuto.addEventListener('click', () => { location.href = location.pathname + '?id=tutorial'; });
  panel.appendChild(tuto);

  const cur = getBoardId();
  const boards = listBoards().filter((b) => b.id !== cur);
  if (boards.length) {
    panel.appendChild(el('div', 'set-sub', t('settings.visitedBoards')));
    boards.forEach((b) => {
      const label = b.id === 'home' ? t('board.home') : b.id === 'tutorial' ? t('board.tutorial') : (b.name || b.id);
      const row = el('button', 'set-wide', label);
      row.addEventListener('click', () => { location.href = buildBoardUrl(b.id, b.peer, b.name); });
      panel.appendChild(row);
    });
  }

  // ---- Desktop only: which address to embed in links given to other people ----
  if (isDesktop) {
    panel.appendChild(el('div', 'set-label', t('settings.shareMode')));
    const modes = el('div', 'set-themes');
    const internet = el('button', 'set-theme' + (getLinkMode() === 'internet' ? ' on' : ''), t('settings.shareInternet'));
    internet.addEventListener('click', () => { setLinkMode('internet'); build(panel); });
    const lan = el('button', 'set-theme' + (getLinkMode() === 'lan' ? ' on' : ''), t('settings.shareLan'));
    lan.addEventListener('click', () => { setLinkMode('lan'); build(panel); });
    modes.appendChild(internet); modes.appendChild(lan);
    panel.appendChild(modes);
    panel.appendChild(el('div', 'set-sub', t('settings.shareMode.hint')));
    const verEl = el('div', 'set-empty', t('settings.loading'));
    panel.appendChild(verEl);
    getAppVersion().then((v) => { verEl.textContent = t('settings.version', { v: v || '?' }); });
  }

  // ---- 4. Liaisons ----
  panel.appendChild(el('div', 'set-label', t('settings.liaisons')));
  // Home is sanctuarized: never connected (so it can't be overwritten).
  if (getBoardId() === 'home') panel.appendChild(el('div', 'set-empty', t('settings.homeLocked')));
  // Active liaison + disconnect.
  const st = liaisonStatus();
  if (st.role) {
    const active = el('div', 'set-liaison on');
    active.appendChild(el('span', 'set-liaison-name', '● ' + (st.role === 'host' ? t('liaison.host') : t('settings.connected'))));
    const dc = el('button', 'set-mini', '⏏');
    dc.title = t('settings.disconnect.title');
    dc.addEventListener('click', () => { closeSettings(); disconnect(); });
    active.appendChild(dc);
    panel.appendChild(active);
  }
  // Owner-only (the host itself, or a Pi-confirmed owner token): locks the
  // board so everyone else connected can only watch.
  if (isOwner()) {
    const lockBtn = el('button', 'set-theme' + (state.readOnly ? ' on' : ''), (state.readOnly ? '🔒 ' : '🔓 ') + t('settings.lockBoard'));
    lockBtn.title = t('settings.lockBoard.title');
    lockBtn.addEventListener('click', () => { setBoardReadOnly(!state.readOnly); build(panel); });
    panel.appendChild(lockBtn);
  }
  const activePeer = new URLSearchParams(location.search).get('peer');
  const liaisons = listLiaisons();
  if (!liaisons.length) panel.appendChild(el('div', 'set-empty', t('settings.noLiaisons')));
  liaisons.forEach((l) => {
    const row = el('div', 'set-liaison' + (l.peer === activePeer ? ' on' : ''));
    const name = el('button', 'set-liaison-name', (l.peer === activePeer ? '● ' : '') + (l.name || l.peer));
    name.title = t('settings.joinThis.title');
    name.addEventListener('click', () => switchLiaison(l.peer));
    const ren = el('button', 'set-mini', '✎');
    ren.title = t('settings.rename.title');
    ren.addEventListener('click', () => {
      const nm = prompt(t('settings.rename.prompt'), l.name || l.peer);
      if (nm != null) { renameLiaison(l.peer, nm.trim() || l.peer); build(panel); }
    });
    const del = el('button', 'set-mini', '✕');
    del.title = t('settings.remove.title');
    del.addEventListener('click', () => { removeLiaison(l.peer); build(panel); });
    row.appendChild(name); row.appendChild(ren); row.appendChild(del);
    panel.appendChild(row);
  });
  // Join a new liaison (peer id or pasted link).
  const joinRow = el('div', 'set-new');
  const jin = el('input'); jin.placeholder = t('settings.peerPlaceholder');
  const jb = el('button', null, t('settings.join'));
  const join = () => {
    let v = jin.value.trim();
    if (!v) return;
    const m = v.match(/[?&]peer=([^&]+)/);
    if (m) v = decodeURIComponent(m[1]);
    recordLiaison(v);
    switchLiaison(v);
  };
  jb.addEventListener('click', join);
  jin.addEventListener('keydown', (e) => { if (e.key === 'Enter') join(); });
  joinRow.appendChild(jin); joinRow.appendChild(jb);
  panel.appendChild(joinRow);

  // ---- 5. Data: import / export ----
  panel.appendChild(el('div', 'set-label', t('settings.data')));
  const exp = el('button', 'set-wide', t('settings.export'));
  exp.addEventListener('click', () => exportJSON());
  panel.appendChild(exp);
  const expHtml = el('button', 'set-wide', t('settings.exportHtml'));
  expHtml.addEventListener('click', () => exportBoardHtml());
  panel.appendChild(expHtml);
  const imp = el('button', 'set-wide', t('settings.import'));
  imp.addEventListener('click', () => importJSON(() => { scheduleSave(); closeSettings(); }));
  panel.appendChild(imp);
  const expAll = el('button', 'set-wide', t('settings.exportAll'));
  expAll.addEventListener('click', () => exportAllBoards());
  panel.appendChild(expAll);
  const impAll = el('button', 'set-wide', t('settings.importAll'));
  impAll.addEventListener('click', () => importAllBoards(() => { closeSettings(); location.reload(); }));
  panel.appendChild(impAll);

  // ---- 6. Danger: clear the current board ----
  panel.appendChild(el('div', 'set-label', t('settings.currentBoard')));
  const clear = el('button', 'set-danger', t('settings.clearBoard'));
  let armed = false;
  clear.addEventListener('click', () => {
    if (!armed) { armed = true; clear.textContent = t('settings.clearConfirm'); setTimeout(() => { armed = false; clear.textContent = t('settings.clearBoard'); }, 3000); return; }
    state.nodes = []; state.circles = []; state.hexagons = [];
    state.selected = null; state.selectedIds = [];
    scheduleSave();
    closeSettings();
  });
  panel.appendChild(clear);
}

// ---- Audio sub-panel: Always On (mobile) + input microphone ----
function buildAudio(panel) {
  subHead(panel, 'settings.audio');

  const alwaysRow = el('div', 'set-row');
  const alwaysBtn = el('button', 'set-theme' + (isAlwaysOn() ? ' on' : ''), (isAlwaysOn() ? '✓ ' : '') + t('settings.micAlwaysOn'));
  alwaysBtn.title = t('settings.micAlwaysOn.title');
  alwaysBtn.addEventListener('click', () => { setAlwaysOn(!isAlwaysOn()); build(panel); });
  alwaysRow.appendChild(alwaysBtn);
  panel.appendChild(alwaysRow);
  if (isAlwaysOn() && !isMicOn()) panel.appendChild(el('div', 'set-empty', t('settings.micAlwaysOn.hint')));

  panel.appendChild(el('div', 'set-sub', t('settings.micInput')));
  const micList = el('div', 'set-themes');
  micList.appendChild(el('div', 'set-empty', t('settings.loading')));
  panel.appendChild(micList);
  listMics().then((mics) => {
    micList.innerHTML = '';
    if (!mics.length) { micList.appendChild(el('div', 'set-empty', t('settings.noMic'))); return; }
    const cur = getPreferredMic();
    const def = el('button', 'set-theme' + (!cur ? ' on' : ''), t('settings.micDefault'));
    def.addEventListener('click', () => { setPreferredMic(''); build(panel); });
    micList.appendChild(def);
    mics.forEach((d, i) => {
      const b = el('button', 'set-theme' + (cur === d.deviceId ? ' on' : ''), d.label || t('settings.micN', { n: i + 1 }));
      b.addEventListener('click', () => { setPreferredMic(d.deviceId); build(panel); });
      micList.appendChild(b);
    });
  });
}

// ---- Visual sub-panel: theme + text size ----
function buildVisual(panel) {
  subHead(panel, 'settings.visual');

  panel.appendChild(el('div', 'set-label', t('settings.theme')));
  const themes = el('div', 'set-themes');
  THEME_LIST.forEach((th) => {
    const b = el('button', 'set-theme' + (themeId_() === th.id ? ' on' : ''), th.label);
    b.addEventListener('click', () => { setTheme(th.id); build(panel); });
    themes.appendChild(b);
  });
  panel.appendChild(themes);

  panel.appendChild(el('div', 'set-label', t('settings.textSize')));
  const ts = el('div', 'set-row');
  const minus = el('button', 'set-btn', '−');
  const val = el('span', 'set-val', Math.round(getTextScale() * 100) + '%');
  const plus = el('button', 'set-btn', '+');
  minus.addEventListener('click', () => { setTextScale(getTextScale() - 0.1); val.textContent = Math.round(getTextScale() * 100) + '%'; });
  plus.addEventListener('click', () => { setTextScale(getTextScale() + 0.1); val.textContent = Math.round(getTextScale() * 100) + '%'; });
  ts.appendChild(minus); ts.appendChild(val); ts.appendChild(plus);
  panel.appendChild(ts);
}

function switchLiaison(peer) {
  closeSettings();
  location.href = location.pathname + '?peer=' + encodeURIComponent(peer) + '&id=' + encodeURIComponent(getBoardId());
}
