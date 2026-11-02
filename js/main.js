// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzd9bsl';
import { resize, requestRender } from './render.js?v=mvzd9bsl';
import { initInput } from './input.js?v=mvzd9bsl';
import { initPanel } from './panel.js?v=mvzd9bsl';
import { initMinimap } from './minimap.js?v=mvzd9bsl';
import { initClock } from './clock.js?v=mvzd9bsl';
import { initDrive } from './drive.js?v=mvzd9bsl';
import { initHistory } from './history.js?v=mvzd9bsl';

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
