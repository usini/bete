// Export / Import JSON.
import { serialize, load, getBoardId, scheduleSave } from './state.js?v=mr27bxz8';
import { reset } from './physics.js?v=mr27bxz8';
import { state } from './state.js?v=mr27bxz8';
import { inlineImages, migrateImages } from './images.js?v=mr27bxz8';

export async function exportJSON() {
  const snap = serialize();          // objets neufs (mutation sûre)
  await inlineImages(snap.nodes);    // ré-inline les images IndexedDB -> fichier auto-contenu
  const data = JSON.stringify(snap, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'todomappa-' + getBoardId() + '.json';
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
          // Réinitialise la physique pour les éléments importés.
          state.nodes.forEach(reset);
          // Ré-offload les images inline (data URL) vers IndexedDB (réf 'idb:<hash>').
          migrateImages(state.nodes, scheduleSave).catch(() => {});
          if (onDone) onDone();
        }
      } catch (e) {
        alert('JSON invalide');
      }
    };
    reader.readAsText(file);
  };
  input.addEventListener('change', handler);
  input.click();
}
