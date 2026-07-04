// Desktop-only auto-update: checks the GitHub release feed (via the Tauri
// updater plugin) and offers to install if a newer version is published.
// A no-op on the web build. Loaded from a CDN (esm.sh) only when running in
// the desktop wrapper, same pattern as the PeerJS/QR CDN loads in sync.js --
// keeps the web bundle free of any npm dependency.
import { isDesktop } from './platform.js?v=mr67o6w6';
import { t } from './i18n.js?v=mr67o6w6';

const UPDATER_MOD = 'https://esm.sh/@tauri-apps/plugin-updater@2';
const PROCESS_MOD = 'https://esm.sh/@tauri-apps/plugin-process@2';

export async function checkForUpdate() {
  if (!isDesktop) return;
  try {
    const { check } = await import(UPDATER_MOD);
    const update = await check();
    if (update) showUpdatePopup(update);
  } catch (e) { /* update checks must never block the app */ }
}

function showUpdatePopup(update) {
  const el = document.getElementById('updatepopup');
  if (!el) return;
  el.querySelector('.up-msg').textContent = t('update.available', { version: update.version });
  const installBtn = el.querySelector('.up-install');
  const laterBtn = el.querySelector('.up-later');
  const status = el.querySelector('.up-status');
  installBtn.onclick = async () => {
    installBtn.disabled = true; laterBtn.disabled = true;
    status.textContent = t('update.installing');
    try {
      await update.downloadAndInstall();
      const { relaunch } = await import(PROCESS_MOD);
      await relaunch();
    } catch (e) {
      status.textContent = t('update.failed');
      installBtn.disabled = false; laterBtn.disabled = false;
    }
  };
  laterBtn.onclick = () => el.classList.add('hidden');
  el.classList.remove('hidden');
}
