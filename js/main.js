// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw1yobwe';
import { resize, requestRender } from './render.js?v=mw1yobwe';
import { initInput } from './input.js?v=mw1yobwe';
import { initPanel } from './panel.js?v=mw1yobwe';
import { initMinimap } from './minimap.js?v=mw1yobwe';
import { initClock } from './clock.js?v=mw1yobwe';
import { initDrive } from './drive.js?v=mw1yobwe';
import { initHistory } from './history.js?v=mw1yobwe';
import { initGroupSharing } from './group-share.js?v=mw1yobwe';
import { initGroupShareUI } from './group-share-ui.js?v=mw1yobwe';

import { initMobileMode } from './mobile-mode.js?v=mw1yobwe';
import { localStorageFailed } from './local-store.js?v=mw1yobwe';

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
