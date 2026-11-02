// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzitqch';
import { resize, requestRender } from './render.js?v=mvzitqch';
import { initInput } from './input.js?v=mvzitqch';
import { initPanel } from './panel.js?v=mvzitqch';
import { initMinimap } from './minimap.js?v=mvzitqch';
import { initClock } from './clock.js?v=mvzitqch';
import { initDrive } from './drive.js?v=mvzitqch';
import { initHistory } from './history.js?v=mvzitqch';
import { initGroupSharing } from './group-share.js?v=mvzitqch';
import { initGroupShareUI } from './group-share-ui.js?v=mvzitqch';

import { initMobileMode } from './mobile-mode.js?v=mvzitqch';

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
