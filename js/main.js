// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvznreia';
import { resize, requestRender } from './render.js?v=mvznreia';
import { initInput } from './input.js?v=mvznreia';
import { initPanel } from './panel.js?v=mvznreia';
import { initMinimap } from './minimap.js?v=mvznreia';
import { initClock } from './clock.js?v=mvznreia';
import { initDrive } from './drive.js?v=mvznreia';
import { initHistory } from './history.js?v=mvznreia';
import { initGroupSharing } from './group-share.js?v=mvznreia';
import { initGroupShareUI } from './group-share-ui.js?v=mvznreia';

import { initMobileMode } from './mobile-mode.js?v=mvznreia';
import { localStorageFailed } from './local-store.js?v=mvznreia';

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
