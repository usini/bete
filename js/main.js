// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvz9vkup';
import { resize, requestRender } from './render.js?v=mvz9vkup';
import { initInput } from './input.js?v=mvz9vkup';
import { initPanel } from './panel.js?v=mvz9vkup';
import { initMinimap } from './minimap.js?v=mvz9vkup';
import { initClock } from './clock.js?v=mvz9vkup';
import { initDrive } from './drive.js?v=mvz9vkup';

loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
initInput();
initPanel();
initMinimap();
initClock();
initDrive();
requestRender();
