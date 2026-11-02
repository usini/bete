// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzpds6l';
import { resize, requestRender } from './render.js?v=mvzpds6l';
import { initInput } from './input.js?v=mvzpds6l';
import { initPanel } from './panel.js?v=mvzpds6l';
import { initMinimap } from './minimap.js?v=mvzpds6l';
import { initClock } from './clock.js?v=mvzpds6l';
import { initDrive } from './drive.js?v=mvzpds6l';
import { initHistory } from './history.js?v=mvzpds6l';
import { initGroupSharing } from './group-share.js?v=mvzpds6l';
import { initGroupShareUI } from './group-share-ui.js?v=mvzpds6l';

import { initMobileMode } from './mobile-mode.js?v=mvzpds6l';
import { localStorageFailed } from './local-store.js?v=mvzpds6l';

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
