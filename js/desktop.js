import { initDesktopCalendar } from './calendar.js?v=mw2jmum7';
import { saveNow } from './state.js?v=mw2jmum7';
import { flushLocalWrites } from './local-store.js?v=mw2jmum7';
import { openLink } from './links.js?v=mw2jmum7';
import { notify } from './notifications.js?v=mw2jmum7';
import { parseShareLink } from './group-share.js?v=mw2jmum7';

function confirmUpdate(version) {
  const dialog = document.createElement('dialog');
  dialog.className = 'share-approval';
  const form = document.createElement('form');
  form.method = 'dialog';
  const message = document.createElement('p');
  message.textContent = 'Installer Bête ' + version + ' à la fermeture ?';
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  for (const [value, text] of [
    ['cancel', 'Annuler'], ['close', 'Fermer sans mise à jour'], ['update', 'Mettre à jour et fermer'],
  ]) {
    const button = document.createElement('button');
    button.value = value;
    button.textContent = text;
    actions.append(button);
  }
  form.append(message, actions);
  dialog.append(form);
  document.body.append(dialog);
  return new Promise(resolve => {
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue);
      dialog.remove();
    }, { once: true });
    dialog.showModal();
  });
}

export async function initDesktop() {
  const { core, window: native } = window.__TAURI__;
  const appWindow = native.getCurrentWindow();
  initDesktopCalendar(core.invoke);
  const privacy = document.querySelector('.panel-footer a');
  privacy.href = 'https://bete.usini.eu/confidentialite.html';
  privacy.addEventListener('click', event => { event.preventDefault(); openLink(privacy.href); });

  const join = document.createElement('input');
  join.type = 'url';
  join.placeholder = 'Coller un lien de partage Bête';
  join.setAttribute('aria-label', 'Lien du groupe à rejoindre');
  join.addEventListener('change', () => {
    let link;
    try { link = new URL(join.value.trim()); } catch { /* Invalid input. */ }
    if (link?.origin !== 'https://bete.usini.eu' || !parseShareLink(link.href)) {
      notify('Ce lien de partage Bête est invalide.', { type: 'error' });
      return;
    }
    location.hash = link.hash;
    join.value = '';
  });
  document.querySelector('#share-display-name').after(join);

  let version = null;
  let closing = false;
  let progress;
  await appWindow.onCloseRequested(async event => {
    event.preventDefault();
    if (closing) return;
    closing = true;
    try {
      const choice = version ? await confirmUpdate(version) : 'close';
      if (choice !== 'close' && choice !== 'update') return;
      if (await saveNow() !== true || !await flushLocalWrites()) throw new Error('La sauvegarde locale a échoué. Exporte le tableau avant de fermer.');
      if (choice === 'update') {
        progress = document.createElement('dialog');
        progress.className = 'share-approval';
        progress.textContent = 'Téléchargement de la mise à jour…';
        progress.addEventListener('cancel', event => event.preventDefault());
        document.body.append(progress);
        progress.showModal();
        await core.invoke('install_update', { version });
      } else await appWindow.destroy();
    } catch (error) {
      notify(String(error), { id: 'desktop-update', type: 'error', duration: 0 });
    } finally {
      progress?.remove();
      progress = undefined;
      closing = false;
    }
  });
  try {
    version = await core.invoke('check_update');
    if (version) notify('Bête ' + version + ' est disponible. Tu pourras l’installer à la fermeture.', { id: 'desktop-update', duration: 0 });
  } catch {
    notify('La vérification des mises à jour a échoué.', { id: 'desktop-update', type: 'error' });
  }
}
