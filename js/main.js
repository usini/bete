// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvziqt1v';
import { resize, requestRender } from './render.js?v=mvziqt1v';
import { initInput } from './input.js?v=mvziqt1v';
import { initPanel } from './panel.js?v=mvziqt1v';
import { initMinimap } from './minimap.js?v=mvziqt1v';
import { initClock } from './clock.js?v=mvziqt1v';
import { initDrive } from './drive.js?v=mvziqt1v';
import { initHistory } from './history.js?v=mvziqt1v';
import { initGroupSharing } from './group-share.js?v=mvziqt1v';
import { initGroupShareUI } from './group-share-ui.js?v=mvziqt1v';

import { initMobileMode } from './mobile-mode.js?v=mvziqt1v';

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
