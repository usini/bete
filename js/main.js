// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw1z285p';
import { resize, requestRender } from './render.js?v=mw1z285p';
import { initInput } from './input.js?v=mw1z285p';
import { initPanel } from './panel.js?v=mw1z285p';
import { initMinimap } from './minimap.js?v=mw1z285p';
import { initClock } from './clock.js?v=mw1z285p';
import { initDrive } from './drive.js?v=mw1z285p';
import { initHistory } from './history.js?v=mw1z285p';
import { initGroupSharing } from './group-share.js?v=mw1z285p';
import { initGroupShareUI } from './group-share-ui.js?v=mw1z285p';

import { initMobileMode } from './mobile-mode.js?v=mw1z285p';
import { localStorageFailed } from './local-store.js?v=mw1z285p';

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
