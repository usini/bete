// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzpt511';
import { resize, requestRender } from './render.js?v=mvzpt511';
import { initInput } from './input.js?v=mvzpt511';
import { initPanel } from './panel.js?v=mvzpt511';
import { initMinimap } from './minimap.js?v=mvzpt511';
import { initClock } from './clock.js?v=mvzpt511';
import { initDrive } from './drive.js?v=mvzpt511';
import { initHistory } from './history.js?v=mvzpt511';
import { initGroupSharing } from './group-share.js?v=mvzpt511';
import { initGroupShareUI } from './group-share-ui.js?v=mvzpt511';

import { initMobileMode } from './mobile-mode.js?v=mvzpt511';
import { localStorageFailed } from './local-store.js?v=mvzpt511';

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
