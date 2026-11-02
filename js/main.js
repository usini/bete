// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzeg834';
import { resize, requestRender } from './render.js?v=mvzeg834';
import { initInput } from './input.js?v=mvzeg834';
import { initPanel } from './panel.js?v=mvzeg834';
import { initMinimap } from './minimap.js?v=mvzeg834';
import { initClock } from './clock.js?v=mvzeg834';
import { initDrive } from './drive.js?v=mvzeg834';
import { initHistory } from './history.js?v=mvzeg834';
import { initGroupSharing } from './group-share.js?v=mvzeg834';
import { initGroupShareUI } from './group-share-ui.js?v=mvzeg834';

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
