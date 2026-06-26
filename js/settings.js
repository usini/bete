// Menu Paramètres : thème, taille du texte, liaisons nommées, navigation
// (tutoriel / boards visités), effacer le board courant.
import { state, getBoardId, scheduleSave } from './state.js?v=mqv9hiue';
import { theme, themeId_, setTheme, getTextScale, setTextScale, THEME_LIST } from './theme.js?v=mqv9hiue';
import { listBoards, buildBoardUrl } from './boards.js?v=mqv9hiue';
import { listLiaisons, recordLiaison, renameLiaison, removeLiaison } from './liaisons.js?v=mqv9hiue';

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

export function initSettings() {
  const panel = document.getElementById('settings');
  // Clic dans le panneau : ne pas fermer.
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

  const head = el('div', 'set-head');
  head.appendChild(el('div', 'set-title', 'PARAMETRES'));
  const close = el('button', 'set-x', '✕');
  close.addEventListener('click', closeSettings);
  head.appendChild(close);
  panel.appendChild(head);

  // ---- Thème ----
  panel.appendChild(el('div', 'set-label', 'Thème'));
  const themes = el('div', 'set-themes');
  THEME_LIST.forEach((t) => {
    const b = el('button', 'set-theme' + (themeId_() === t.id ? ' on' : ''), t.label);
    b.addEventListener('click', () => { setTheme(t.id); build(panel); });
    themes.appendChild(b);
  });
  panel.appendChild(themes);

  // ---- Taille du texte ----
  panel.appendChild(el('div', 'set-label', 'Taille du texte'));
  const ts = el('div', 'set-row');
  const minus = el('button', 'set-btn', '−');
  const val = el('span', 'set-val', Math.round(getTextScale() * 100) + '%');
  const plus = el('button', 'set-btn', '+');
  minus.addEventListener('click', () => { setTextScale(getTextScale() - 0.1); val.textContent = Math.round(getTextScale() * 100) + '%'; });
  plus.addEventListener('click', () => { setTextScale(getTextScale() + 0.1); val.textContent = Math.round(getTextScale() * 100) + '%'; });
  ts.appendChild(minus); ts.appendChild(val); ts.appendChild(plus);
  panel.appendChild(ts);

  // ---- Liaisons ----
  panel.appendChild(el('div', 'set-label', 'Liaisons'));
  const activePeer = new URLSearchParams(location.search).get('peer');
  const liaisons = listLiaisons();
  if (!liaisons.length) panel.appendChild(el('div', 'set-empty', '(aucune liaison enregistrée)'));
  liaisons.forEach((l) => {
    const row = el('div', 'set-liaison' + (l.peer === activePeer ? ' on' : ''));
    const name = el('button', 'set-liaison-name', (l.peer === activePeer ? '● ' : '') + (l.name || l.peer));
    name.title = 'Rejoindre cette liaison';
    name.addEventListener('click', () => switchLiaison(l.peer));
    const ren = el('button', 'set-mini', '✎');
    ren.title = 'Renommer';
    ren.addEventListener('click', () => {
      const nm = prompt('Nom de la liaison :', l.name || l.peer);
      if (nm != null) { renameLiaison(l.peer, nm.trim() || l.peer); build(panel); }
    });
    const del = el('button', 'set-mini', '✕');
    del.title = 'Retirer';
    del.addEventListener('click', () => { removeLiaison(l.peer); build(panel); });
    row.appendChild(name); row.appendChild(ren); row.appendChild(del);
    panel.appendChild(row);
  });
  // Rejoindre une nouvelle liaison (id de peer ou lien collé).
  const joinRow = el('div', 'set-new');
  const jin = el('input'); jin.placeholder = 'id de peer ou lien…';
  const jb = el('button', null, 'Rejoindre');
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

  // ---- Navigation ----
  panel.appendChild(el('div', 'set-label', 'Navigation'));
  const tuto = el('button', 'set-wide', '↻ Revoir le tutoriel');
  tuto.addEventListener('click', () => { location.href = location.pathname + '?id=tutorial'; });
  panel.appendChild(tuto);

  const cur = getBoardId();
  const boards = listBoards().filter((b) => b.id !== cur);
  if (boards.length) {
    panel.appendChild(el('div', 'set-sub', 'Boards visités'));
    boards.forEach((b) => {
      const row = el('button', 'set-wide', b.name || b.id);
      row.addEventListener('click', () => { location.href = buildBoardUrl(b.id, b.peer, b.name); });
      panel.appendChild(row);
    });
  }

  // ---- Danger : effacer le board courant ----
  panel.appendChild(el('div', 'set-label', 'Board courant'));
  const clear = el('button', 'set-danger', 'Effacer ce board');
  let armed = false;
  clear.addEventListener('click', () => {
    if (!armed) { armed = true; clear.textContent = 'Confirmer l\'effacement ?'; setTimeout(() => { armed = false; clear.textContent = 'Effacer ce board'; }, 3000); return; }
    state.nodes = []; state.circles = []; state.hexagons = [];
    state.selected = null; state.selectedIds = [];
    scheduleSave();
    closeSettings();
  });
  panel.appendChild(clear);
}

function switchLiaison(peer) {
  closeSettings();
  location.href = location.pathname + '?peer=' + encodeURIComponent(peer) + '&id=' + encodeURIComponent(getBoardId());
}
