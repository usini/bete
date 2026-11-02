// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzj279c';
import { resize, requestRender } from './render.js?v=mvzj279c';
import { initInput } from './input.js?v=mvzj279c';
import { initPanel } from './panel.js?v=mvzj279c';
import { initMinimap } from './minimap.js?v=mvzj279c';
import { initClock } from './clock.js?v=mvzj279c';
import { initDrive } from './drive.js?v=mvzj279c';
import { initHistory } from './history.js?v=mvzj279c';
import { initGroupSharing } from './group-share.js?v=mvzj279c';
import { initGroupShareUI } from './group-share-ui.js?v=mvzj279c';

import { initMobileMode } from './mobile-mode.js?v=mvzj279c';

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
