import { openApplication } from './applications.js?v=mw4vr6ei';
import { notify } from './notifications.js?v=mw4vr6ei';
import { flyToBlock } from './camera.js?v=mw4vr6ei';
import { linkOf } from './labels.js?v=mw4vr6ei';
import { openLink } from './links.js?v=mw4vr6ei';
import { serviceForNode } from './services.js?v=mw4vr6ei';
import { getNode, select, state } from './state.js?v=mw4vr6ei';
import { cachedYouTubeTitle, youTubeId } from './yt.js?v=mw4vr6ei';

const normalize = text => text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

function search(query) {
  const commands = window.__TAURI__ ? [
    { command: 'focus', label: 'Focus' },
    { command: 'calc', label: 'Calc' },
    { command: 'minimize', label: 'Réduire' },
    { command: 'capture_screen', label: 'Capture d’une zone de l’écran' },
    { command: 'extend_desktop', label: 'Étendre le bureau' },
    { command: 'pc_screen_only', label: 'Écran du PC seul' },
  ] : [];
  const commandMatches = commands.filter(item => normalize(item.label).startsWith(query));
  if (!query) return commandMatches;
  const prefixes = [];
  const wordMatches = [];
  const escapedQuery = query.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
  const wordPrefix = new RegExp('[^\\p{L}\\p{N}]' + escapedQuery, 'u');
  for (const node of state.nodes) {
    const link = linkOf(node);
    const video = node.kind === 'group' ? null : youTubeId(link || node.text);
    const href = link || (video ? 'https://www.youtube.com/watch?v=' + video : null);
    const labels = [node.github?.repository, node.github?.description, node.application?.label, node.name, cachedYouTubeTitle(video), serviceForNode(node)?.name, node.text]
      .filter(Boolean).map(label => ({ label, text: normalize(label) }));
    const prefix = labels.find(({ text }) => text.startsWith(query));
    const match = prefix || labels.find(({ text }) => wordPrefix.test(text));
    if (match) (prefix ? prefixes : wordMatches).push({ id: node.id, label: match.label, href, application: !!node.application, group: node.kind === 'group' });
  }
  return commandMatches.concat(prefixes, wordMatches);
}

export function initCommandSearch() {
  const dialog = document.querySelector('#command-search');
  const input = dialog.querySelector('input');
  const list = dialog.querySelector('ul');
  const empty = dialog.querySelector('#command-empty');
  let matches = [];
  let active = -1;
  let openedFromGlobal = false;

  function highlight(index) {
    list.children[active]?.setAttribute('aria-selected', 'false');
    active = index;
    const item = list.children[active];
    if (item) {
      item.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }

  function refresh() {
    const query = normalize(input.value);
    matches = search(query);
    list.replaceChildren(...matches.map(({ label, href, group, command, application }, i) => {
      const item = document.createElement('li');
      item.id = 'command-result-' + i;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      const text = document.createElement('span');
      text.textContent = label;
      const kind = document.createElement('small');
      kind.textContent = command ? 'Commande Windows' : application ? 'Application' : group ? 'Groupe' : href ? 'Lien' : 'Bloc';
      item.append(text, kind);
      return item;
    }));
    list.hidden = matches.length === 0;
    empty.hidden = !query || matches.length > 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    highlight(matches.length ? 0 : -1);
  }

  async function activate(index) {
    const match = matches[index];
    if (match?.command && window.__TAURI__) {
      dialog.close();
      if (match.command === 'focus') document.getElementById('fit-board').click();
      else if (match.command === 'calc') window.__TAURI__.core.invoke('open_calculator').catch(() => notify('Impossible d’ouvrir la calculatrice.', {type:'error'}));
      else if (['capture_screen', 'extend_desktop', 'pc_screen_only'].includes(match.command)) window.__TAURI__.core.invoke(match.command).catch(() => notify('Impossible d’exécuter cette commande Windows.', {type:'error'}));
      else window.__TAURI__.core.invoke('minimize_window').catch(() => notify('Impossible de réduire la fenêtre.', { type: 'error' }));
      return;
    }
    const node = match && getNode(match.id);
    if (!node) return;
    const minimizeAfterOpening = openedFromGlobal;
    dialog.close();
    if (node.application) {
      const opened = await openApplication(node);
      if (opened && minimizeAfterOpening && window.__TAURI__) window.__TAURI__.core.invoke('minimize_window').catch(() => {});
    } else if (match.href) {
      const opened = await openLink(match.href);
      if (opened && minimizeAfterOpening && window.__TAURI__) {
        window.__TAURI__.core.invoke('minimize_window').catch(() => notify('Impossible de réduire la fenêtre.', { type: 'error' }));
      }
    }
    else {
      select(node.id);
      flyToBlock(node);
    }
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', event => {
    if (event.isComposing || !matches.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      highlight((active + offset + matches.length) % matches.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      activate(active);
    }
  });
  list.addEventListener('click', event => {
    const item = event.target.closest('li');
    if (item) activate(Array.prototype.indexOf.call(list.children, item));
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  const openCommands = (fromGlobal = false) => {
    openedFromGlobal = fromGlobal;
    if (dialog.open) { input.focus(); return; }
    if (document.querySelector('dialog[open]')) return;
    document.querySelectorAll(':popover-open').forEach(popover => popover.hidePopover());
    input.value = '';
    refresh();
    dialog.showModal();
    input.focus();
  };
  window.addEventListener('bete-open-command-search', event => openCommands(event.detail?.global === true));
  window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        document.querySelector('dialog[open], :popover-open')) return;
    const target = event.target;
    if (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, button, a[href]'))) return;
    event.preventDefault();
    openCommands();
  });
}
