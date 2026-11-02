// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzd6zeq';
import { resize, requestRender } from './render.js?v=mvzd6zeq';
import { initInput } from './input.js?v=mvzd6zeq';
import { initPanel } from './panel.js?v=mvzd6zeq';
import { initMinimap } from './minimap.js?v=mvzd6zeq';
import { initClock } from './clock.js?v=mvzd6zeq';
import { initDrive } from './drive.js?v=mvzd6zeq';
import { initHistory } from './history.js?v=mvzd6zeq';

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
