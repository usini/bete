// Extract a French calendar date locally; ignore the surrounding marketing/countdown text.
const months = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
export function deliveryDelay(raw, today = new Date()) {
  const text = String(raw || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[*_\u00a0\u202f]/g, ' ').toLowerCase();
  const match = text.match(new RegExp('\\b(\\d{1,2})(?:er)?\\s+(' + months.join('|') + ')(?:\\s+(\\d{4}))?\\b'));
  if (!match) return null;
  const day = Number(match[1]), month = months.indexOf(match[2]);
  let year = match[3] ? Number(match[3]) : today.getFullYear();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  let end = Date.UTC(year, month, day);
  if (!match[3] && end < start) { year++; end = Date.UTC(year, month, day); }
  const date = new Date(end);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day || end < start) return null;
  const days = Math.round((end - start) / 86400000);
  return days + (days === 1 ? ' jour' : ' jours');
}
