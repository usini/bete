// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzmqqm3';
import { resize, requestRender } from './render.js?v=mvzmqqm3';
import { initInput } from './input.js?v=mvzmqqm3';
import { initPanel } from './panel.js?v=mvzmqqm3';
import { initMinimap } from './minimap.js?v=mvzmqqm3';
import { initClock } from './clock.js?v=mvzmqqm3';
import { initDrive } from './drive.js?v=mvzmqqm3';
import { initHistory } from './history.js?v=mvzmqqm3';
import { initGroupSharing } from './group-share.js?v=mvzmqqm3';
import { initGroupShareUI } from './group-share-ui.js?v=mvzmqqm3';

import { initMobileMode } from './mobile-mode.js?v=mvzmqqm3';

initMobileMode();
loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
initInput();
initPanel();
initMinimap();
initClock();
initDrive();
initHistory();
initGroupSharing();
initGroupShareUI();
requestRender();
