// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzd10l4';
import { resize, requestRender } from './render.js?v=mvzd10l4';
import { initInput } from './input.js?v=mvzd10l4';
import { initPanel } from './panel.js?v=mvzd10l4';
import { initMinimap } from './minimap.js?v=mvzd10l4';
import { initClock } from './clock.js?v=mvzd10l4';
import { initDrive } from './drive.js?v=mvzd10l4';
import { initHistory } from './history.js?v=mvzd10l4';

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
