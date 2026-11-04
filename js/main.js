// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw22tbu2';
import { resize, requestRender } from './render.js?v=mw22tbu2';
import { initInput } from './input.js?v=mw22tbu2';
import { initPanel } from './panel.js?v=mw22tbu2';
import { initMinimap } from './minimap.js?v=mw22tbu2';
import { initClock } from './clock.js?v=mw22tbu2';
import { initDrive } from './drive.js?v=mw22tbu2';
import { initHistory } from './history.js?v=mw22tbu2';
import { initGroupSharing } from './group-share.js?v=mw22tbu2';
import { initGroupShareUI } from './group-share-ui.js?v=mw22tbu2';

import { initMobileMode } from './mobile-mode.js?v=mw22tbu2';
import { localStorageFailed } from './local-store.js?v=mw22tbu2';

initMobileMode();
loadFromStorage();
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
initHistory();
if (window.__TAURI__) {
  const driveSection = document.getElementById('drive-status').closest('section');
  driveSection.hidden = true;
  window.__TAURI__.core.invoke('drive_configured').then(configured => {
    if (!configured) return;
    driveSection.hidden = false;
    initDrive();
  }).catch(console.error);
  import('./desktop.js?v=mw22tbu2').then(({ initDesktop }) => initDesktop());
} else initDrive();
initGroupSharing();
initGroupShareUI();
requestRender();
