// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzbmn95';
import { resize, requestRender } from './render.js?v=mvzbmn95';
import { initInput } from './input.js?v=mvzbmn95';
import { initPanel } from './panel.js?v=mvzbmn95';
import { initMinimap } from './minimap.js?v=mvzbmn95';
import { initClock } from './clock.js?v=mvzbmn95';
import { initDrive } from './drive.js?v=mvzbmn95';
import { initHistory } from './history.js?v=mvzbmn95';

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
