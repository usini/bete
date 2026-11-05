import { flyToBlock } from './camera.js?v=mw3jmzda';
import { linkOf } from './labels.js?v=mw3jmzda';
import { openLink } from './links.js?v=mw3jmzda';
import { serviceForNode } from './services.js?v=mw3jmzda';
import { getNode, select, state } from './state.js?v=mw3jmzda';
import { cachedYouTubeTitle, youTubeId } from './yt.js?v=mw3jmzda';

const normalize = text => text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');

function search(query) {
  if (!query) return [];
  const prefixes = [];
  const wordMatches = [];
  const escapedQuery = query.replace(/[.*+?^$\{\}()|[\]\\]/g, '\\$&');
  const wordPrefix = new RegExp('[^\\p{L}\\p{N}]' + escapedQuery, 'u');
  for (const node of state.nodes) {
    const link = linkOf(node);
    const video = node.kind === 'group' ? null : youTubeId(link || node.text);
    const href = link || (video ? 'https://www.youtube.com/watch?v=' + video : null);
    const labels = [node.name, cachedYouTubeTitle(video), serviceForNode(node)?.name, node.text]
      .filter(Boolean).map(label => ({ label, text: normalize(label) }));
    const prefix = labels.find(({ text }) => text.startsWith(query));
    const match = prefix || labels.find(({ text }) => wordPrefix.test(text));
    if (match) (prefix ? prefixes : wordMatches).push({ id: node.id, label: match.label, href, group: node.kind === 'group' });
  }
  return prefixes.concat(wordMatches);
}

export function initCommandSearch() {
  const dialog = document.querySelector('#command-search');
  const input = dialog.querySelector('input');
  const list = dialog.querySelector('ul');
  const empty = dialog.querySelector('#command-empty');
  let matches = [];
  let active = -1;

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
    list.replaceChildren(...matches.map(({ label, href, group }, i) => {
      const item = document.createElement('li');
      item.id = 'command-result-' + i;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');
      const text = document.createElement('span');
      text.textContent = label;
      const kind = document.createElement('small');
      kind.textContent = group ? 'Groupe' : href ? 'Lien' : 'Bloc';
      item.append(text, kind);
      return item;
    }));
    list.hidden = matches.length === 0;
    empty.hidden = !query || matches.length > 0;
    input.setAttribute('aria-expanded', String(!list.hidden));
    highlight(matches.length ? 0 : -1);
  }

  function activate(index) {
    const match = matches[index];
    const node = match && getNode(match.id);
    if (!node) return;
    dialog.close();
    if (match.href) openLink(match.href);
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

  window.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.defaultPrevented || event.repeat || event.isComposing ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        document.querySelector('dialog[open], :popover-open')) return;
    const target = event.target;
    if (target instanceof HTMLElement &&
        (target.isContentEditable || target.closest('input, textarea, select, button, a[href]'))) return;
    event.preventDefault();
    input.value = '';
    refresh();
    dialog.showModal();
  });
}
