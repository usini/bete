// Local, accessible toasts. Updating the same id replaces progress instead of stacking it.
const entries = new Map();
let region;

export function notify(message, { id = 'default', type = 'info', duration = 4000 } = {}) {
  if (!region) {
    region = document.createElement('aside');
    region.id = 'notifications';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-label', 'Notifications');
    document.body.append(region);
  }
  let entry = entries.get(id);
  if (!entry) {
    const node = document.createElement('div'); node.className = 'toast';
    const icon = document.createElement('span'); icon.className = 'toast-icon'; icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.className = 'toast-text';
    const close = document.createElement('button'); close.type = 'button'; close.className = 'toast-close';
    close.textContent = '×'; close.setAttribute('aria-label', 'Fermer la notification');
    entry = { node, icon, text, timer: null };
    close.addEventListener('click', () => { clearTimeout(entry.timer); entries.delete(id); node.remove(); });
    node.append(icon, text, close); region.append(node); entries.set(id, entry);
  }
  clearTimeout(entry.timer);
  entry.node.dataset.type = type;
  entry.icon.textContent = type === 'progress' ? '↻' : type === 'success' ? '✓' : type === 'error' ? '!' : '•';
  entry.text.textContent = message;
  if (duration > 0) entry.timer = setTimeout(() => { entry.node.remove(); entries.delete(id); }, duration);
}
