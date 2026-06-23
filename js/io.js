// Export / Import JSON.
import { serialize, load } from './state.js';
import { reset } from './physics.js';
import { state } from './state.js';

export function exportJSON() {
  const data = JSON.stringify(serialize(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'todomappa.json';
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
