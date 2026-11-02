// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvznhy77';
import { resize, requestRender } from './render.js?v=mvznhy77';
import { initInput } from './input.js?v=mvznhy77';
import { initPanel } from './panel.js?v=mvznhy77';
import { initMinimap } from './minimap.js?v=mvznhy77';
import { initClock } from './clock.js?v=mvznhy77';
import { initDrive } from './drive.js?v=mvznhy77';
import { initHistory } from './history.js?v=mvznhy77';
import { initGroupSharing } from './group-share.js?v=mvznhy77';
import { initGroupShareUI } from './group-share-ui.js?v=mvznhy77';

import { initMobileMode } from './mobile-mode.js?v=mvznhy77';
import { localStorageFailed } from './local-store.js?v=mvznhy77';

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
initDrive();
initHistory();
initGroupSharing();
initGroupShareUI();
requestRender();
