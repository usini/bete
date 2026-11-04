// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw1yed4y';
import { resize, requestRender } from './render.js?v=mw1yed4y';
import { initInput } from './input.js?v=mw1yed4y';
import { initPanel } from './panel.js?v=mw1yed4y';
import { initMinimap } from './minimap.js?v=mw1yed4y';
import { initClock } from './clock.js?v=mw1yed4y';
import { initDrive } from './drive.js?v=mw1yed4y';
import { initHistory } from './history.js?v=mw1yed4y';
import { initGroupSharing } from './group-share.js?v=mw1yed4y';
import { initGroupShareUI } from './group-share-ui.js?v=mw1yed4y';

import { initMobileMode } from './mobile-mode.js?v=mw1yed4y';
import { localStorageFailed } from './local-store.js?v=mw1yed4y';

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
