// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzcifgl';
import { resize, requestRender } from './render.js?v=mvzcifgl';
import { initInput } from './input.js?v=mvzcifgl';
import { initPanel } from './panel.js?v=mvzcifgl';
import { initMinimap } from './minimap.js?v=mvzcifgl';
import { initClock } from './clock.js?v=mvzcifgl';
import { initDrive } from './drive.js?v=mvzcifgl';
import { initHistory } from './history.js?v=mvzcifgl';

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
