// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzmnbc5';
import { resize, requestRender } from './render.js?v=mvzmnbc5';
import { initInput } from './input.js?v=mvzmnbc5';
import { initPanel } from './panel.js?v=mvzmnbc5';
import { initMinimap } from './minimap.js?v=mvzmnbc5';
import { initClock } from './clock.js?v=mvzmnbc5';
import { initDrive } from './drive.js?v=mvzmnbc5';
import { initHistory } from './history.js?v=mvzmnbc5';
import { initGroupSharing } from './group-share.js?v=mvzmnbc5';
import { initGroupShareUI } from './group-share-ui.js?v=mvzmnbc5';

import { initMobileMode } from './mobile-mode.js?v=mvzmnbc5';

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
