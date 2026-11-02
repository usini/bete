// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzexlfc';
import { resize, requestRender } from './render.js?v=mvzexlfc';
import { initInput } from './input.js?v=mvzexlfc';
import { initPanel } from './panel.js?v=mvzexlfc';
import { initMinimap } from './minimap.js?v=mvzexlfc';
import { initClock } from './clock.js?v=mvzexlfc';
import { initDrive } from './drive.js?v=mvzexlfc';
import { initHistory } from './history.js?v=mvzexlfc';
import { initGroupSharing } from './group-share.js?v=mvzexlfc';
import { initGroupShareUI } from './group-share-ui.js?v=mvzexlfc';

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
