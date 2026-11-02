// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzfvfhr';
import { resize, requestRender } from './render.js?v=mvzfvfhr';
import { initInput } from './input.js?v=mvzfvfhr';
import { initPanel } from './panel.js?v=mvzfvfhr';
import { initMinimap } from './minimap.js?v=mvzfvfhr';
import { initClock } from './clock.js?v=mvzfvfhr';
import { initDrive } from './drive.js?v=mvzfvfhr';
import { initHistory } from './history.js?v=mvzfvfhr';
import { initGroupSharing } from './group-share.js?v=mvzfvfhr';
import { initGroupShareUI } from './group-share-ui.js?v=mvzfvfhr';

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
