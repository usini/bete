import { externalMode, githubBoard, loadGithubBoard } from './external-board.js?v=mw3nilz8';
// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow, setDoc } from './state.js?v=mw3nilz8';
import { resize, requestRender } from './render.js?v=mw3nilz8';
import { initInput } from './input.js?v=mw3nilz8';
import { initCommandSearch } from './command-search.js?v=mw3nilz8';
import { initPanel } from './panel.js?v=mw3nilz8';
import { initMinimap } from './minimap.js?v=mw3nilz8';
import { initClock } from './clock.js?v=mw3nilz8';
import { initHistory } from './history.js?v=mw3nilz8';
import { initGroupSharing } from './group-share.js?v=mw3nilz8';
import { initGroupShareUI } from './group-share-ui.js?v=mw3nilz8';

import { initMobileMode } from './mobile-mode.js?v=mw3nilz8';
import { localStorageFailed } from './local-store.js?v=mw3nilz8';

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
initCommandSearch();
initPanel();
initMinimap();
initClock();
if (!externalMode) {
  initHistory();
  const { initDrive } = await import('./drive.js?v=mw3nilz8');
  if (window.__TAURI__) {
    const driveSection = document.getElementById('drive-status').closest('section');
    driveSection.hidden = true;
    window.__TAURI__.core.invoke('drive_configured').then(configured => {
      if (!configured) return;
      driveSection.hidden = false;
      initDrive();
    }).catch(console.error);
    import('./desktop.js?v=mw3nilz8').then(({ initDesktop }) => initDesktop());
  } else initDrive();
  initGroupSharing();
  initGroupShareUI();
}
requestRender();
