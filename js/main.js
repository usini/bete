// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mw11h6tn';
import { resize, requestRender } from './render.js?v=mw11h6tn';
import { initInput } from './input.js?v=mw11h6tn';
import { initPanel } from './panel.js?v=mw11h6tn';
import { initMinimap } from './minimap.js?v=mw11h6tn';
import { initClock } from './clock.js?v=mw11h6tn';
import { initDrive } from './drive.js?v=mw11h6tn';
import { initHistory } from './history.js?v=mw11h6tn';
import { initGroupSharing } from './group-share.js?v=mw11h6tn';
import { initGroupShareUI } from './group-share-ui.js?v=mw11h6tn';

import { initMobileMode } from './mobile-mode.js?v=mw11h6tn';
import { localStorageFailed } from './local-store.js?v=mw11h6tn';

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
