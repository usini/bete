// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzo1n5i';
import { resize, requestRender } from './render.js?v=mvzo1n5i';
import { initInput } from './input.js?v=mvzo1n5i';
import { initPanel } from './panel.js?v=mvzo1n5i';
import { initMinimap } from './minimap.js?v=mvzo1n5i';
import { initClock } from './clock.js?v=mvzo1n5i';
import { initDrive } from './drive.js?v=mvzo1n5i';
import { initHistory } from './history.js?v=mvzo1n5i';
import { initGroupSharing } from './group-share.js?v=mvzo1n5i';
import { initGroupShareUI } from './group-share-ui.js?v=mvzo1n5i';

import { initMobileMode } from './mobile-mode.js?v=mvzo1n5i';
import { localStorageFailed } from './local-store.js?v=mvzo1n5i';

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
