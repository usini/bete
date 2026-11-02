// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzqx4cw';
import { resize, requestRender } from './render.js?v=mvzqx4cw';
import { initInput } from './input.js?v=mvzqx4cw';
import { initPanel } from './panel.js?v=mvzqx4cw';
import { initMinimap } from './minimap.js?v=mvzqx4cw';
import { initClock } from './clock.js?v=mvzqx4cw';
import { initDrive } from './drive.js?v=mvzqx4cw';
import { initHistory } from './history.js?v=mvzqx4cw';
import { initGroupSharing } from './group-share.js?v=mvzqx4cw';
import { initGroupShareUI } from './group-share-ui.js?v=mvzqx4cw';

import { initMobileMode } from './mobile-mode.js?v=mvzqx4cw';
import { localStorageFailed } from './local-store.js?v=mvzqx4cw';

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
