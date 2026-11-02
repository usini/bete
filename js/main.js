// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzpna3r';
import { resize, requestRender } from './render.js?v=mvzpna3r';
import { initInput } from './input.js?v=mvzpna3r';
import { initPanel } from './panel.js?v=mvzpna3r';
import { initMinimap } from './minimap.js?v=mvzpna3r';
import { initClock } from './clock.js?v=mvzpna3r';
import { initDrive } from './drive.js?v=mvzpna3r';
import { initHistory } from './history.js?v=mvzpna3r';
import { initGroupSharing } from './group-share.js?v=mvzpna3r';
import { initGroupShareUI } from './group-share-ui.js?v=mvzpna3r';

import { initMobileMode } from './mobile-mode.js?v=mvzpna3r';
import { localStorageFailed } from './local-store.js?v=mvzpna3r';

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
