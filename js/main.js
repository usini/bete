// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvz7o991';
import { resize, requestRender } from './render.js?v=mvz7o991';
import { initInput } from './input.js?v=mvz7o991';
import { initPanel } from './panel.js?v=mvz7o991';
import { initMinimap } from './minimap.js?v=mvz7o991';
import { initClock } from './clock.js?v=mvz7o991';

loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
initInput();
initPanel();
initMinimap();
initClock();
requestRender();
