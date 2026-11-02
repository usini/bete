// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvznzo9z';
import { resize, requestRender } from './render.js?v=mvznzo9z';
import { initInput } from './input.js?v=mvznzo9z';
import { initPanel } from './panel.js?v=mvznzo9z';
import { initMinimap } from './minimap.js?v=mvznzo9z';
import { initClock } from './clock.js?v=mvznzo9z';
import { initDrive } from './drive.js?v=mvznzo9z';
import { initHistory } from './history.js?v=mvznzo9z';
import { initGroupSharing } from './group-share.js?v=mvznzo9z';
import { initGroupShareUI } from './group-share-ui.js?v=mvznzo9z';

import { initMobileMode } from './mobile-mode.js?v=mvznzo9z';
import { localStorageFailed } from './local-store.js?v=mvznzo9z';

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
