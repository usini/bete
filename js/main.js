// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzgwjl8';
import { resize, requestRender } from './render.js?v=mvzgwjl8';
import { initInput } from './input.js?v=mvzgwjl8';
import { initPanel } from './panel.js?v=mvzgwjl8';
import { initMinimap } from './minimap.js?v=mvzgwjl8';
import { initClock } from './clock.js?v=mvzgwjl8';
import { initDrive } from './drive.js?v=mvzgwjl8';
import { initHistory } from './history.js?v=mvzgwjl8';
import { initGroupSharing } from './group-share.js?v=mvzgwjl8';
import { initGroupShareUI } from './group-share-ui.js?v=mvzgwjl8';

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
