// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzpbq8z';
import { resize, requestRender } from './render.js?v=mvzpbq8z';
import { initInput } from './input.js?v=mvzpbq8z';
import { initPanel } from './panel.js?v=mvzpbq8z';
import { initMinimap } from './minimap.js?v=mvzpbq8z';
import { initClock } from './clock.js?v=mvzpbq8z';
import { initDrive } from './drive.js?v=mvzpbq8z';
import { initHistory } from './history.js?v=mvzpbq8z';
import { initGroupSharing } from './group-share.js?v=mvzpbq8z';
import { initGroupShareUI } from './group-share-ui.js?v=mvzpbq8z';

import { initMobileMode } from './mobile-mode.js?v=mvzpbq8z';
import { localStorageFailed } from './local-store.js?v=mvzpbq8z';

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
