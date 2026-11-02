// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzoawg5';
import { resize, requestRender } from './render.js?v=mvzoawg5';
import { initInput } from './input.js?v=mvzoawg5';
import { initPanel } from './panel.js?v=mvzoawg5';
import { initMinimap } from './minimap.js?v=mvzoawg5';
import { initClock } from './clock.js?v=mvzoawg5';
import { initDrive } from './drive.js?v=mvzoawg5';
import { initHistory } from './history.js?v=mvzoawg5';
import { initGroupSharing } from './group-share.js?v=mvzoawg5';
import { initGroupShareUI } from './group-share-ui.js?v=mvzoawg5';

import { initMobileMode } from './mobile-mode.js?v=mvzoawg5';
import { localStorageFailed } from './local-store.js?v=mvzoawg5';

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
