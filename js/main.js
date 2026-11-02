// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzh5g0m';
import { resize, requestRender } from './render.js?v=mvzh5g0m';
import { initInput } from './input.js?v=mvzh5g0m';
import { initPanel } from './panel.js?v=mvzh5g0m';
import { initMinimap } from './minimap.js?v=mvzh5g0m';
import { initClock } from './clock.js?v=mvzh5g0m';
import { initDrive } from './drive.js?v=mvzh5g0m';
import { initHistory } from './history.js?v=mvzh5g0m';
import { initGroupSharing } from './group-share.js?v=mvzh5g0m';
import { initGroupShareUI } from './group-share-ui.js?v=mvzh5g0m';

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
