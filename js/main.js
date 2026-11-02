// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzpjd1s';
import { resize, requestRender } from './render.js?v=mvzpjd1s';
import { initInput } from './input.js?v=mvzpjd1s';
import { initPanel } from './panel.js?v=mvzpjd1s';
import { initMinimap } from './minimap.js?v=mvzpjd1s';
import { initClock } from './clock.js?v=mvzpjd1s';
import { initDrive } from './drive.js?v=mvzpjd1s';
import { initHistory } from './history.js?v=mvzpjd1s';
import { initGroupSharing } from './group-share.js?v=mvzpjd1s';
import { initGroupShareUI } from './group-share-ui.js?v=mvzpjd1s';

import { initMobileMode } from './mobile-mode.js?v=mvzpjd1s';
import { localStorageFailed } from './local-store.js?v=mvzpjd1s';

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
