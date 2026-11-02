// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzrb4x0';
import { resize, requestRender } from './render.js?v=mvzrb4x0';
import { initInput } from './input.js?v=mvzrb4x0';
import { initPanel } from './panel.js?v=mvzrb4x0';
import { initMinimap } from './minimap.js?v=mvzrb4x0';
import { initClock } from './clock.js?v=mvzrb4x0';
import { initDrive } from './drive.js?v=mvzrb4x0';
import { initHistory } from './history.js?v=mvzrb4x0';
import { initGroupSharing } from './group-share.js?v=mvzrb4x0';
import { initGroupShareUI } from './group-share-ui.js?v=mvzrb4x0';

import { initMobileMode } from './mobile-mode.js?v=mvzrb4x0';
import { localStorageFailed } from './local-store.js?v=mvzrb4x0';

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
