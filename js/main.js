// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzcyshb';
import { resize, requestRender } from './render.js?v=mvzcyshb';
import { initInput } from './input.js?v=mvzcyshb';
import { initPanel } from './panel.js?v=mvzcyshb';
import { initMinimap } from './minimap.js?v=mvzcyshb';
import { initClock } from './clock.js?v=mvzcyshb';
import { initDrive } from './drive.js?v=mvzcyshb';
import { initHistory } from './history.js?v=mvzcyshb';

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
