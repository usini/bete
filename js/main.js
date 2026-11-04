// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw2e6cqi';
import { resize, requestRender } from './render.js?v=mw2e6cqi';
import { initInput } from './input.js?v=mw2e6cqi';
import { initPanel } from './panel.js?v=mw2e6cqi';
import { initMinimap } from './minimap.js?v=mw2e6cqi';
import { initClock } from './clock.js?v=mw2e6cqi';
import { initDrive } from './drive.js?v=mw2e6cqi';
import { initHistory } from './history.js?v=mw2e6cqi';
import { initGroupSharing } from './group-share.js?v=mw2e6cqi';
import { initGroupShareUI } from './group-share-ui.js?v=mw2e6cqi';

import { initMobileMode } from './mobile-mode.js?v=mw2e6cqi';
import { localStorageFailed } from './local-store.js?v=mw2e6cqi';

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
  import('./desktop.js?v=mw2e6cqi').then(({ initDesktop }) => initDesktop());
} else initDrive();
initGroupSharing();
initGroupShareUI();
requestRender();
