// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvznvqfr';
import { resize, requestRender } from './render.js?v=mvznvqfr';
import { initInput } from './input.js?v=mvznvqfr';
import { initPanel } from './panel.js?v=mvznvqfr';
import { initMinimap } from './minimap.js?v=mvznvqfr';
import { initClock } from './clock.js?v=mvznvqfr';
import { initDrive } from './drive.js?v=mvznvqfr';
import { initHistory } from './history.js?v=mvznvqfr';
import { initGroupSharing } from './group-share.js?v=mvznvqfr';
import { initGroupShareUI } from './group-share-ui.js?v=mvznvqfr';

import { initMobileMode } from './mobile-mode.js?v=mvznvqfr';
import { localStorageFailed } from './local-store.js?v=mvznvqfr';

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
