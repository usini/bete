import { isLocked, modeEvents } from './mobile-mode.js?v=mw443e0p';
import { externalMode, recentGithubBoards, addExternalBoard, removeExternalBoard } from './external-board.js?v=mw443e0p';
// Right-hand panel: draggable blocks, selection tools, file actions.
import { state, getNode, getSelectedId, select, addNode, events, emit } from './state.js?v=mw443e0p';
import { screenToWorld, view, flyToBlock } from './camera.js?v=mw443e0p';
import { BLOCK_MIME, pickImage } from './input.js?v=mw443e0p';
import { exportDoc, importFile } from './storage.js?v=mw443e0p';


import { optimizeBoardImages as optimizeImages } from './optimize.js?v=mw443e0p';
import { notify } from './notifications.js?v=mw443e0p';
import { localStore } from './local-store.js?v=mw443e0p';

async function optimizeBoardImages(button) {
  const id = 'optimize-images';
  button.disabled = true;
  notify('Optimisation des images…', { id, type: 'progress', duration: 0 });
  try {
    const { count, failures } = await optimizeImages();
    const summary = count ? `${count} bloc(s) optimisé(s).` : 'Aucun bloc optimisé.';
    notify(summary + ' Historique vidé.' + (failures ? ` ${failures} image(s) en erreur.` : ''), { id, type: failures ? 'error' : 'success' });
  } finally {
    button.disabled = isLocked();
  }
}

export function initPanel() {
  const panel = document.getElementById('panel');
  const toggle = document.getElementById('panel-toggle');
  // The icon itself is switched by CSS (.collapsed); only the tooltip / accessible name changes here.
  const setToggleLabel = () => {
    const label = panel.classList.contains('collapsed') ? 'Ouvrir le menu' : 'Fermer le menu';
    toggle.title = label;
    toggle.setAttribute('aria-label', label);
  };
  if (matchMedia('(max-width: 600px)').matches) panel.classList.add('collapsed');
  setToggleLabel();
  toggle.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    setToggleLabel();
  });
  // A press anywhere outside the menu hides it (the menu itself, its button and the popups
  // do not count as "outside").
  document.addEventListener('pointerdown', (e) => {
    if (panel.classList.contains('collapsed')) return;
    if (e.target instanceof Element && e.target.closest('#panel, #panel-toggle, dialog')) return;
    panel.classList.add('collapsed');
    setToggleLabel();
  });

  // Blocks: drag onto the canvas (desktop), or tap to add at the view centre (touch).
  for (const el of panel.querySelectorAll('[data-block]')) {
    const kind = el.dataset.block;
    el.addEventListener('dragstart', (e) => {
      if (isLocked()) { e.preventDefault(); return; }
      e.dataTransfer.setData(BLOCK_MIME, kind);
      e.dataTransfer.setData('text/plain', kind); // needed for the drag to start in some browsers
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('click', () => {
      if (isLocked()) return;
      const c = screenToWorld(view.w / 2, view.h / 2);
      const n = addNode(kind, c.x, c.y);
      if (kind === 'image') pickImage(n);
    });
  }

  const groupsBox = document.getElementById('groups');
  const groupIndex = document.getElementById('group-index');
  const groupList = document.getElementById('group-list');
  const externalSection = document.getElementById('external-boards');
  const externalList = document.getElementById('external-board-list');
  const orderKey = 'bete2:groupIndexOrder';
  let order = [];
  try {
    const saved = JSON.parse(localStore.getItem(orderKey));
    if (Array.isArray(saved)) order = saved.filter(id => typeof id === 'string');
  } catch { /* Start with the board order. */ }

  const goToGroup = (id) => {
    const group = getNode(id);
    if (group?.kind !== 'group') return;
    groupIndex.close();
    panel.classList.add('collapsed');
    setToggleLabel();
    select(id);
    flyToBlock(group);
  };

  let groupSig = '';

  function refreshGroups() {
    const groups = state.nodes.filter(node => node.kind === 'group');
    groupsBox.hidden = false;
    if (!groupIndex.open) return;
    const ranks = new Map(order.map((id, index) => [id, index]));
    groups.sort((a, b) => (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity));
    const signature = JSON.stringify(groups.map(group => [group.id, group.text, group.color]));
    if (signature === groupSig) return;
    groupSig = signature;
    groupList.replaceChildren(...groups.map(group => {
      const card = document.createElement('article');
      card.dataset.groupId = group.id;
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'group-link';
      const name = group.text.split('\n')[0].trim() || 'Groupe sans titre';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = group.color === 'transparent' ? 'white' : group.color;
      const text = document.createElement('span');
      text.className = 'name';
      text.textContent = name;
      link.append(dot, text);
      link.addEventListener('click', () => goToGroup(group.id));

      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'group-grip';
      grip.textContent = '⠿';
      grip.title = 'Glisser ou utiliser les flèches pour déplacer';
      grip.setAttribute('aria-label', 'Déplacer ' + name);
      grip.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        grip.setPointerCapture(event.pointerId);
        card.classList.add('group-dragging');
      });
      grip.addEventListener('lostpointercapture', () => card.classList.remove('group-dragging'));
      grip.addEventListener('pointerup', event => {
        if (!grip.hasPointerCapture(event.pointerId)) return;
        const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-group-id]');
        if (target && groupList.contains(target)) moveShortcut(card, target);
      });
      grip.addEventListener('keydown', event => {
        const target = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? card.previousElementSibling
          : ['ArrowRight', 'ArrowDown'].includes(event.key) ? card.nextElementSibling : null;
        if (!target) return;
        event.preventDefault();
        moveShortcut(card, target);
      });
      card.append(link);
      if (!externalMode) card.append(grip);
      return card;
    }));
  }

  function moveShortcut(card, target) {
    if (card === target) return;
    const cards = [...groupList.children];
    const index = cards.indexOf(target);
    cards.splice(cards.indexOf(card), 1);
    cards.splice(index, 0, card);
    order = cards.map(item => item.dataset.groupId);
    localStore.setItem(orderKey, JSON.stringify(order));
    refreshGroups();
    [...groupList.children].find(item => item.dataset.groupId === card.dataset.groupId)
      ?.querySelector('.group-grip').focus();
  }

  const externalForm = document.getElementById('external-board-add');
  const externalInput = document.getElementById('external-board-link');
  const externalMessage = document.getElementById('external-board-message');
  function refreshExternalBoards() {
    const boards = recentGithubBoards();
    externalSection.hidden = false;
    externalList.replaceChildren(...boards.map(board => {
      const row = document.createElement('div');
      row.className = 'external-board-item';
      const link = document.createElement('a');
      link.href = '?' + new URLSearchParams({ github: board.id });
      link.textContent = board.name;
      link.title = board.id;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Retirer';
      remove.setAttribute('aria-label', 'Retirer ' + board.id + ' de la liste');
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        try { await removeExternalBoard(board.id); refreshExternalBoards(); externalMessage.textContent = 'Lien retiré de cet appareil.'; }
        catch (error) { externalMessage.textContent = error.message; remove.disabled = false; }
      });
      row.append(link, remove);
      return row;
    }));
    if (!boards.length) externalMessage.textContent = 'Aucun tableau externe enregistré.';
  }
  externalForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = externalForm.querySelector('button');
    button.disabled = true;
    try {
      await addExternalBoard(externalInput.value);
      externalInput.value = '';
      refreshExternalBoards();
      externalMessage.textContent = 'Lien ajouté. Clique sur son nom pour ouvrir le tableau.';
      externalInput.focus();
    } catch (error) { externalMessage.textContent = error.message; }
    finally { button.disabled = false; }
  });
  document.getElementById('open-group-index').addEventListener('click', () => {
    groupSig = '';
    externalMessage.textContent = '';
    refreshExternalBoards();
    groupIndex.showModal();
    refreshGroups();
  });
  events.addEventListener('change', refreshGroups);
  refreshGroups();

  // File actions.
  const optimize = document.getElementById('optimize-images');
  optimize.addEventListener('click', () => { if (!isLocked()) optimizeBoardImages(optimize); });
  document.getElementById('export').addEventListener('click', () => { exportDoc(); });
  const fileIn = document.getElementById('fileimport');
  document.getElementById('import').addEventListener('click', () => {
    if (isLocked()) return;
    fileIn.value = '';
    fileIn.click();
  });
  fileIn.addEventListener('change', () => {
    if (!isLocked() && fileIn.files[0]) importFile(fileIn.files[0]);
  });
  const refreshLock = () => {
    document.getElementById('import').disabled = isLocked();
    optimize.disabled = isLocked();
    for (const block of panel.querySelectorAll('[data-block]')) {
      block.draggable = !isLocked();
      block.setAttribute('aria-disabled', String(isLocked()));
    }
  };
  modeEvents.addEventListener('change', refreshLock);
  refreshLock();

}
