// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvz95lma';
import { resize, requestRender } from './render.js?v=mvz95lma';
import { initInput } from './input.js?v=mvz95lma';
import { initPanel } from './panel.js?v=mvz95lma';
import { initMinimap } from './minimap.js?v=mvz95lma';
import { initClock } from './clock.js?v=mvz95lma';

loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
initInput();
initPanel();
initMinimap();
initClock();
requestRender();
