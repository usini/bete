// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzijf2m';
import { resize, requestRender } from './render.js?v=mvzijf2m';
import { initInput } from './input.js?v=mvzijf2m';
import { initPanel } from './panel.js?v=mvzijf2m';
import { initMinimap } from './minimap.js?v=mvzijf2m';
import { initClock } from './clock.js?v=mvzijf2m';
import { initDrive } from './drive.js?v=mvzijf2m';
import { initHistory } from './history.js?v=mvzijf2m';
import { initGroupSharing } from './group-share.js?v=mvzijf2m';
import { initGroupShareUI } from './group-share-ui.js?v=mvzijf2m';

import { initMobileMode } from './mobile-mode.js?v=mvzijf2m';

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
