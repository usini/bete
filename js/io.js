// JSON export / import.
import { serialize, load, getBoardId, scheduleSave } from './state.js?v=mrdx3kml';
import { reset } from './physics.js?v=mrdx3kml';
import { state } from './state.js?v=mrdx3kml';
import { inlineImages, migrateImages } from './images.js?v=mrdx3kml';
import { listBoards, recordBoard } from './boards.js?v=mrdx3kml';
import { t } from './i18n.js?v=mrdx3kml';
import { saveTextFile } from './platform.js?v=mrdx3kml';

function downloadJSON(obj, filename) {
  saveTextFile(JSON.stringify(obj), filename, 'json');
}

export async function exportJSON() {
  const snap = serialize();          // fresh objects (safe to mutate)
  await inlineImages(snap.nodes);    // re-inline IndexedDB images -> self-contained file
  downloadJSON(snap, 'bete-' + getBoardId() + '.json');
}

// Bulk backup: every board this browser knows about (see boards.js), each
// with its images re-inlined so the file is self-contained (no IndexedDB refs).
export async function exportAllBoards() {
  const bundle = { version: 1, boards: {} };
  for (const b of listBoards()) {
    let raw;
    try { raw = localStorage.getItem('bete:' + b.id); } catch (e) { raw = null; }
    if (!raw) continue; // e.g. 'tutorial': built-in, never saved to localStorage
    let data;
    try { data = JSON.parse(raw); } catch (e) { continue; }
    if (data.nodes) await inlineImages(data.nodes);
    bundle.boards[b.id] = { name: b.name, peer: b.peer, ts: b.ts, data };
  }
  downloadJSON(bundle, 'bete-all-boards.json');
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

// Bulk restore: writes every board from the file straight to localStorage
// and records it in the board list. Images stay inline (data URL) until each
// board is actually opened -- migrateImages() then offloads them to IndexedDB
// in the background, same as a legacy single-board import.
export function importAllBoards(onDone) {
  const input = document.getElementById('fileInput');
  input.value = '';
  const handler = () => {
    const file = input.files && input.files[0];
    input.removeEventListener('change', handler);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const bundle = JSON.parse(reader.result);
        if (!bundle || typeof bundle.boards !== 'object') throw new Error('bad format');
        for (const id in bundle.boards) {
          const entry = bundle.boards[id];
          try { localStorage.setItem('bete:' + id, JSON.stringify(entry.data)); } catch (e) { /* quota */ }
          recordBoard(id, entry.name, entry.peer || null);
        }
        if (onDone) onDone();
      } catch (e) {
        alert(t('alert.jsonInvalid'));
      }
    };
    reader.readAsText(file);
  };
  input.addEventListener('change', handler);
  input.click();
}
