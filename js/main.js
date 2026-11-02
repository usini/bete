// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzckz4s';
import { resize, requestRender } from './render.js?v=mvzckz4s';
import { initInput } from './input.js?v=mvzckz4s';
import { initPanel } from './panel.js?v=mvzckz4s';
import { initMinimap } from './minimap.js?v=mvzckz4s';
import { initClock } from './clock.js?v=mvzckz4s';
import { initDrive } from './drive.js?v=mvzckz4s';
import { initHistory } from './history.js?v=mvzckz4s';

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
requestRender();
