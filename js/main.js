// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzaas6o';
import { resize, requestRender } from './render.js?v=mvzaas6o';
import { initInput } from './input.js?v=mvzaas6o';
import { initPanel } from './panel.js?v=mvzaas6o';
import { initMinimap } from './minimap.js?v=mvzaas6o';
import { initClock } from './clock.js?v=mvzaas6o';
import { initDrive } from './drive.js?v=mvzaas6o';
import { initHistory } from './history.js?v=mvzaas6o';

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
