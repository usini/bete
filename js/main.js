// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzgiske';
import { resize, requestRender } from './render.js?v=mvzgiske';
import { initInput } from './input.js?v=mvzgiske';
import { initPanel } from './panel.js?v=mvzgiske';
import { initMinimap } from './minimap.js?v=mvzgiske';
import { initClock } from './clock.js?v=mvzgiske';
import { initDrive } from './drive.js?v=mvzgiske';
import { initHistory } from './history.js?v=mvzgiske';
import { initGroupSharing } from './group-share.js?v=mvzgiske';
import { initGroupShareUI } from './group-share-ui.js?v=mvzgiske';

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
