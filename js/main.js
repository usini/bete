import { externalMode, githubBoard, loadGithubBoard } from './external-board.js?v=mw2oi5mc';
// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow, setDoc } from './state.js?v=mw2oi5mc';
import { resize, requestRender } from './render.js?v=mw2oi5mc';
import { initInput } from './input.js?v=mw2oi5mc';
import { initPanel } from './panel.js?v=mw2oi5mc';
import { initMinimap } from './minimap.js?v=mw2oi5mc';
import { initClock } from './clock.js?v=mw2oi5mc';
import { initHistory } from './history.js?v=mw2oi5mc';
import { initGroupSharing } from './group-share.js?v=mw2oi5mc';
import { initGroupShareUI } from './group-share-ui.js?v=mw2oi5mc';

import { initMobileMode } from './mobile-mode.js?v=mw2oi5mc';
import { localStorageFailed } from './local-store.js?v=mw2oi5mc';

initMobileMode();
if (externalMode) {
  document.body.classList.add('external-board');
  const status = document.getElementById('external-board-status');
  status.hidden = false;
  status.querySelector('span').textContent = 'Chargement du tableau GitHub…';
  loadGithubBoard(githubBoard).then(doc => {
    setDoc(doc);
    status.querySelector('span').textContent = 'Tableau GitHub · lecture seule';
  }).catch(error => {
    status.querySelector('span').textContent = error instanceof TypeError
      ? 'Impossible de joindre GitHub.' : error.message;
  });
} else loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
window.addEventListener('beforeunload', e => {
  if (!localStorageFailed()) return;
  e.preventDefault();
  e.returnValue = '';
});
initInput();
initPanel();
initMinimap();
initClock();
if (!externalMode) {
  initHistory();
  const { initDrive } = await import('./drive.js?v=mw2oi5mc');
  if (window.__TAURI__) {
    const driveSection = document.getElementById('drive-status').closest('section');
    driveSection.hidden = true;
    window.__TAURI__.core.invoke('drive_configured').then(configured => {
      if (!configured) return;
      driveSection.hidden = false;
      initDrive();
    }).catch(console.error);
    import('./desktop.js?v=mw2oi5mc').then(({ initDesktop }) => initDesktop());
  } else initDrive();
  initGroupSharing();
  initGroupShareUI();
}
requestRender();
