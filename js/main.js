// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzq511p';
import { resize, requestRender } from './render.js?v=mvzq511p';
import { initInput } from './input.js?v=mvzq511p';
import { initPanel } from './panel.js?v=mvzq511p';
import { initMinimap } from './minimap.js?v=mvzq511p';
import { initClock } from './clock.js?v=mvzq511p';
import { initDrive } from './drive.js?v=mvzq511p';
import { initHistory } from './history.js?v=mvzq511p';
import { initGroupSharing } from './group-share.js?v=mvzq511p';
import { initGroupShareUI } from './group-share-ui.js?v=mvzq511p';

import { initMobileMode } from './mobile-mode.js?v=mvzq511p';
import { localStorageFailed } from './local-store.js?v=mvzq511p';

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
