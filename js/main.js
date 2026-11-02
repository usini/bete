// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzi1ris';
import { resize, requestRender } from './render.js?v=mvzi1ris';
import { initInput } from './input.js?v=mvzi1ris';
import { initPanel } from './panel.js?v=mvzi1ris';
import { initMinimap } from './minimap.js?v=mvzi1ris';
import { initClock } from './clock.js?v=mvzi1ris';
import { initDrive } from './drive.js?v=mvzi1ris';
import { initHistory } from './history.js?v=mvzi1ris';
import { initGroupSharing } from './group-share.js?v=mvzi1ris';
import { initGroupShareUI } from './group-share-ui.js?v=mvzi1ris';

import { initMobileMode } from './mobile-mode.js?v=mvzi1ris';

initMobileMode();
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
initGroupSharing();
initGroupShareUI();
requestRender();
