import { initApplications, flushApplicationWrites } from './applications.js?v=mw560w8m';
import { initDesktopShortcuts } from './desktop-shortcuts.js?v=mw560w8m';
import { optimizeBoardImages } from './optimize.js?v=mw560w8m';
import { waitForDriveIdle, saveDriveBeforeClose, hasPendingDriveChanges } from './drive.js?v=mw560w8m';
import { isEditing, stopEdit } from './editor.js?v=mw560w8m';
import { initDesktopCalendar } from './calendar.js?v=mw560w8m';
import { saveNow } from './state.js?v=mw560w8m';
import { flushLocalWrites } from './local-store.js?v=mw560w8m';
import { openLink } from './links.js?v=mw560w8m';
import { notify } from './notifications.js?v=mw560w8m';
import { parseShareLink } from './group-share.js?v=mw560w8m';

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
  await initApplications(window.__TAURI__);
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
      progress.textContent = 'Fermeture en cours…';
      progress.addEventListener('cancel', event => event.preventDefault());
      document.body.append(progress);
      progress.show();
      await flushApplicationWrites();
      await waitForDriveIdle();
      progress.close();
      progress.showModal();
      const prepareBackup = hasPendingDriveChanges();
      if (prepareBackup) {
        progress.textContent = 'Sauvegarde en cours — optimisation des images…';
        const optimized = await optimizeBoardImages();
        if (optimized.failures) notify('Certaines images ont été conservées sans optimisation.', { type: 'info' });
      }
      if (await saveNow() !== true || !await flushLocalWrites()) throw new Error('La sauvegarde locale a échoué. Exporte le tableau avant de continuer.');
      progress.textContent = prepareBackup ? 'Sauvegarde en cours — Google Drive…' : 'Fermeture en cours…';
      const driveResult = await saveDriveBeforeClose();
      if (await saveNow() !== true || !await flushLocalWrites()) throw new Error('La sauvegarde locale a échoué.');
      if (version && (!driveResult?.unavailable || restart)) {
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
    try {
      if (await core.invoke('hide_on_close')) { saveNow(); await flushLocalWrites(); return; }
    } catch (error) { notify(String(error), {type:'error'}); return; }
    const version = scheduledVersion;
    await finish(version);
  });
  if (window.__TAURI__.event) {
    const section = document.getElementById('desktop-close-mode');
    const toggle = document.getElementById('close-to-tray');
    toggle.checked = await core.invoke('get_close_to_tray');
    section.hidden = false;
    toggle.addEventListener('change', async () => {
      toggle.disabled = true;
      try { await core.invoke('set_close_to_tray', {enabled:toggle.checked}); }
      catch(error) { toggle.checked = !toggle.checked; notify(String(error), {type:'error'}); }
      finally { toggle.disabled = false; }
    });
    const autostart = document.getElementById('desktop-autostart');
    autostart.checked = await core.invoke('get_autostart');
    autostart.addEventListener('change', async () => {
      autostart.disabled = true;
      try { await core.invoke('set_autostart', {enabled:autostart.checked}); }
      catch(error) { autostart.checked = !autostart.checked; notify(String(error), {type:'error'}); }
      finally { autostart.disabled = false; }
    });
    const quit = async () => { if (!busy) await finish(scheduledVersion); };
    await window.__TAURI__.event.listen('bete-quit-requested', quit);
    document.getElementById('desktop-quit').addEventListener('click', quit);
  }
  const updateButton = document.getElementById?.('desktop-check-update');
  let checkingUpdate = false;
  async function checkUpdates(manual = false) {
    if (busy || checkingUpdate) return;
    checkingUpdate = true;
    if (updateButton) updateButton.disabled = true;
    if (manual) notify('Recherche de mises à jour…', {id:'desktop-update',type:'progress',duration:0});
    try {
      const version = await core.invoke('check_update');
      if (!version) {
        if (manual) notify('Bête est à jour.', {id:'desktop-update',type:'success'});
        return;
      }
      if (busy) return;
      if (manual) notify('Une mise à jour est disponible : ' + version, {id:'desktop-update',type:'info'});
      busy = true;
      const choice = await chooseUpdate(version).finally(() => { busy = false; });
      if (choice === 'on-close') scheduledVersion = version;
      if (choice === 'now') await finish(version, true);
    } catch {
      notify('Impossible de vérifier les mises à jour. Vérifie ta connexion et réessaie.', {id:'desktop-update',type:'error'});
    } finally {
      checkingUpdate = false;
      if (updateButton) updateButton.disabled = false;
    }
  }
  updateButton?.addEventListener('click', () => checkUpdates(true));
  await checkUpdates();
}
