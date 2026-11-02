// Right-hand panel: draggable blocks, selection tools, file actions.
import { state, getNode, getSelectedId, select, addNode, events } from './state.js?v=mvzh5g0m';
import { screenToWorld, view, flyTo } from './camera.js?v=mvzh5g0m';
import { BLOCK_MIME, pickImage } from './input.js?v=mvzh5g0m';
import { exportDoc, importFile } from './storage.js?v=mvzh5g0m';

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
      e.dataTransfer.setData(BLOCK_MIME, kind);
      e.dataTransfer.setData('text/plain', kind); // needed for the drag to start in some browsers
      e.dataTransfer.effectAllowed = 'copy';
    });
    el.addEventListener('click', () => {
      const c = screenToWorld(view.w / 2, view.h / 2);
      const n = addNode(kind, c.x, c.y);
      if (kind === 'image') pickImage(n);
    });
  }

  // Group links: one button per group, a click flies the camera to it and selects it.
  const groupsBox = document.getElementById('groups');
  const groupList = document.getElementById('group-list');
  let groupSig = '';
  const goToGroup = (id) => {
    const g = getNode(id);
    if (!g) return;
    const zoom = Math.min(1.5, Math.max(0.1, Math.min(view.w * 0.7 / g.w, view.h * 0.7 / g.h)));
    select(id);
    flyTo(g.x + g.w / 2, g.y + g.h / 2, zoom);
    if (matchMedia('(max-width: 600px)').matches) { // on a phone the panel would hide the group
      panel.classList.add('collapsed');
      setToggleLabel();
    }
  };
  const refreshGroups = () => {
    const groups = state.nodes.filter((n) => n.kind === 'group');
    // The list is rebuilt only when a title, a colour or the set of groups changes (not on every pan).
    const sig = groups.map((g) => g.id + '|' + g.text + '|' + g.color).join('\n');
    if (sig === groupSig) return;
    groupSig = sig;
    groupsBox.hidden = groups.length === 0;
    groupList.replaceChildren(...groups.map((g) => {
      const b = document.createElement('button');
      b.className = 'group-link';
      b.title = 'Aller au groupe';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = g.color;
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = g.text.split('\n')[0].trim() || 'Groupe sans titre';
      b.append(dot, name);
      b.addEventListener('click', () => goToGroup(g.id));
      return b;
    }));
  };
  events.addEventListener('change', refreshGroups);
  refreshGroups();

  // File actions.
  document.getElementById('export').addEventListener('click', () => { exportDoc(); });
  const fileIn = document.getElementById('fileimport');
  document.getElementById('import').addEventListener('click', () => {
    fileIn.value = '';
    fileIn.click();
  });
  fileIn.addEventListener('change', () => {
    if (fileIn.files[0]) importFile(fileIn.files[0]);
  });
}
