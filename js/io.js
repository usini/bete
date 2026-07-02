// JSON export / import.
import { serialize, load, getBoardId, scheduleSave } from './state.js?v=mr3pqjxh';
import { reset } from './physics.js?v=mr3pqjxh';
import { state } from './state.js?v=mr3pqjxh';
import { inlineImages, migrateImages } from './images.js?v=mr3pqjxh';
import { t } from './i18n.js?v=mr3pqjxh';

export async function exportJSON() {
  const snap = serialize();          // fresh objects (safe to mutate)
  await inlineImages(snap.nodes);    // re-inline IndexedDB images -> self-contained file
  const data = JSON.stringify(snap, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bete-' + getBoardId() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function importJSON(onDone) {
  const input = document.getElementById('fileInput');
  input.value = '';
  const handler = () => {
    const file = input.files && input.files[0];
    input.removeEventListener('change', handler);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (load(obj)) {
          // Resets physics for the imported elements.
          state.nodes.forEach(reset);
          // Re-offloads inline images (data URL) to IndexedDB (ref 'idb:<hash>').
          migrateImages(state.nodes, scheduleSave).catch(() => {});
          if (onDone) onDone();
        }
      } catch (e) {
        alert(t('alert.jsonInvalid'));
      }
    };
    reader.readAsText(file);
  };
  input.addEventListener('change', handler);
  input.click();
}
