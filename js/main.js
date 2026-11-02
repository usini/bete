// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzd5hxv';
import { resize, requestRender } from './render.js?v=mvzd5hxv';
import { initInput } from './input.js?v=mvzd5hxv';
import { initPanel } from './panel.js?v=mvzd5hxv';
import { initMinimap } from './minimap.js?v=mvzd5hxv';
import { initClock } from './clock.js?v=mvzd5hxv';
import { initDrive } from './drive.js?v=mvzd5hxv';
import { initHistory } from './history.js?v=mvzd5hxv';

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
