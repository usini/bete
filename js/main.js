// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw11boe7';
import { resize, requestRender } from './render.js?v=mw11boe7';
import { initInput } from './input.js?v=mw11boe7';
import { initPanel } from './panel.js?v=mw11boe7';
import { initMinimap } from './minimap.js?v=mw11boe7';
import { initClock } from './clock.js?v=mw11boe7';
import { initDrive } from './drive.js?v=mw11boe7';
import { initHistory } from './history.js?v=mw11boe7';
import { initGroupSharing } from './group-share.js?v=mw11boe7';
import { initGroupShareUI } from './group-share-ui.js?v=mw11boe7';

import { initMobileMode } from './mobile-mode.js?v=mw11boe7';
import { localStorageFailed } from './local-store.js?v=mw11boe7';

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
