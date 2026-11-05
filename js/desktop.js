import { initDesktopShortcuts } from './desktop-shortcuts.js?v=mw3kjxkr';
import { optimizeBoardImages } from './optimize.js?v=mw3kjxkr';
import { waitForDriveIdle, saveDriveBeforeClose } from './drive.js?v=mw3kjxkr';
import { isEditing, stopEdit } from './editor.js?v=mw3kjxkr';
import { initDesktopCalendar } from './calendar.js?v=mw3kjxkr';
import { saveNow } from './state.js?v=mw3kjxkr';
import { flushLocalWrites } from './local-store.js?v=mw3kjxkr';
import { openLink } from './links.js?v=mw3kjxkr';
import { notify } from './notifications.js?v=mw3kjxkr';
import { parseShareLink } from './group-share.js?v=mw3kjxkr';

function chooseUpdate(version) {
  const dialog = document.createElement('dialog');
  dialog.className = 'share-approval';
  const form = document.createElement('form');
  form.method = 'dialog';
  const message = document.createElement('p');
  message.textContent = 'Bête ' + version + ' est disponible.';
  const actions = document.createElement('div');
  actions.className = 'dialog-actions';
  for (const [value, text] of [
    ['now', 'Installer maintenant'], ['later', 'Plus tard'], ['on-close', 'Installer à la fermeture'],
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
  await initDesktopShortcuts(window.__TAURI__);
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

  let scheduledVersion = null;
  let busy = false;
  async function finish(version, restart = false) {
    let progress;
    busy = true;
    try {
      if (isEditing()) {
        await stopEdit(true);
        if (isEditing()) throw new Error('Valide ou annule la modification du bloc avant de fermer.');
      }
      progress = document.createElement('dialog');
      progress.className = 'share-approval';
      progress.setAttribute('aria-live', 'polite');
      progress.textContent = 'Sauvegarde en cours — optimisation des images…';
      progress.addEventListener('cancel', event => event.preventDefault());
      document.body.append(progress);
      progress.show();
      await waitForDriveIdle();
      progress.close();
      progress.showModal();
      const optimized = await optimizeBoardImages();
      if (optimized.failures) notify('Certaines images ont été conservées sans optimisation.', { type: 'info' });
      if (await saveNow() !== true || !await flushLocalWrites()) throw new Error('La sauvegarde locale a échoué. Exporte le tableau avant de continuer.');
      progress.textContent = 'Sauvegarde en cours — Google Drive…';
      await saveDriveBeforeClose();
      if (await saveNow() !== true || !await flushLocalWrites()) throw new Error('La sauvegarde locale a échoué.');
      if (version) {
        progress.textContent = 'Téléchargement de la mise à jour…';
        await core.invoke('install_update', { version, restart });
      } else await appWindow.destroy();
    } catch (error) {
      notify(String(error), { id: 'desktop-update', type: 'error', duration: 0 });
    } finally {
      progress?.remove();
      busy = false;
    }
  }
  await appWindow.onCloseRequested(async event => {
    event.preventDefault();
    if (busy) return;
    const version = scheduledVersion;
    await finish(version);
  });
  try {
    const version = await core.invoke('check_update');
    if (!version || busy) return;
    busy = true;
    const choice = await chooseUpdate(version).finally(() => { busy = false; });
    if (choice === 'on-close') scheduledVersion = version;
    if (choice === 'now') await finish(version, true);
  } catch {
    notify('La vérification des mises à jour a échoué.', { id: 'desktop-update', type: 'error' });
  }
}
