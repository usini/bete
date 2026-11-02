// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvznbsbb';
import { resize, requestRender } from './render.js?v=mvznbsbb';
import { initInput } from './input.js?v=mvznbsbb';
import { initPanel } from './panel.js?v=mvznbsbb';
import { initMinimap } from './minimap.js?v=mvznbsbb';
import { initClock } from './clock.js?v=mvznbsbb';
import { initDrive } from './drive.js?v=mvznbsbb';
import { initHistory } from './history.js?v=mvznbsbb';
import { initGroupSharing } from './group-share.js?v=mvznbsbb';
import { initGroupShareUI } from './group-share-ui.js?v=mvznbsbb';

import { initMobileMode } from './mobile-mode.js?v=mvznbsbb';
import { localStorageFailed } from './local-store.js?v=mvznbsbb';

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
