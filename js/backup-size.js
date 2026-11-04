import { exportData } from './storage.js?v=mw2e6cqi';

let timer, revision = 0, running = false;

export function updateBackupSize() {
  revision++;
  clearTimeout(timer);
  timer = setTimeout(measure, 1000);
}

async function measure() {
  if (running) return;
  const label = document.getElementById('drive-size');
  if (!label || label.hidden) return;
  const current = revision;
  running = true;
  try {
    // Same compact JSON as the Drive upload, including unique images and history.
    const bytes = new Blob([JSON.stringify(await exportData())]).size;
    if (current !== revision || label.hidden) return;
    const unit = bytes >= 1e9 ? 'Go' : bytes >= 1e6 ? 'Mo' : bytes >= 1e3 ? 'Ko' : 'o';
    const divisor = { Go: 1e9, Mo: 1e6, Ko: 1e3, o: 1 }[unit];
    label.textContent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(bytes / divisor) + ' ' + unit;
    label.dataset.bytes = String(bytes);
    label.title = 'Taille du prochain JSON Drive, images et historique compris : ' + bytes.toLocaleString('fr-FR') + ' octets.';
  } catch {
    if (current !== revision) return;
    label.textContent = '—';
    delete label.dataset.bytes;
    label.title = 'Taille indisponible : une image peut être encore en cours de réception.';
  } finally {
    running = false;
    if (current !== revision) { clearTimeout(timer); timer = setTimeout(measure, 1000); }
  }
}
