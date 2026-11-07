import { externalMode, githubBoard, loadGithubBoard } from './external-board.js?v=mw62ezdd';
// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow, setDoc } from './state.js?v=mw62ezdd';
import { resize, requestRender } from './render.js?v=mw62ezdd';
import { initInput } from './input.js?v=mw62ezdd';
import { initCommandSearch } from './command-search.js?v=mw62ezdd';
import { initPanel } from './panel.js?v=mw62ezdd';
import { initMinimap } from './minimap.js?v=mw62ezdd';
import { initClock } from './clock.js?v=mw62ezdd';
import { initHistory } from './history.js?v=mw62ezdd';
import { initGroupSharing } from './group-share.js?v=mw62ezdd';
import { initGroupShareUI } from './group-share-ui.js?v=mw62ezdd';

import { initMobileMode } from './mobile-mode.js?v=mw62ezdd';
import { localStorageFailed } from './local-store.js?v=mw62ezdd';

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
  const { initDrive } = await import('./drive.js?v=mw62ezdd');
  if (window.__TAURI__) {
    const driveSection = document.getElementById('drive-status').closest('section');
    driveSection.hidden = true;
    window.__TAURI__.core.invoke('drive_configured').then(configured => {
      if (!configured) return;
      driveSection.hidden = false;
      initDrive();
    }).catch(console.error);
    import('./desktop.js?v=mw62ezdd').then(({ initDesktop }) => initDesktop());
  } else {
    initDrive();
    const { initDesktopCalendar } = await import('./calendar.js?v=mw62ezdd');
    await initDesktopCalendar();
  }
  initGroupSharing();
  initGroupShareUI();
}
requestRender();
