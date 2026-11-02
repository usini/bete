// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzf2hn7';
import { resize, requestRender } from './render.js?v=mvzf2hn7';
import { initInput } from './input.js?v=mvzf2hn7';
import { initPanel } from './panel.js?v=mvzf2hn7';
import { initMinimap } from './minimap.js?v=mvzf2hn7';
import { initClock } from './clock.js?v=mvzf2hn7';
import { initDrive } from './drive.js?v=mvzf2hn7';
import { initHistory } from './history.js?v=mvzf2hn7';
import { initGroupSharing } from './group-share.js?v=mvzf2hn7';
import { initGroupShareUI } from './group-share-ui.js?v=mvzf2hn7';

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
