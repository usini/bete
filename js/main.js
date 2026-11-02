// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzojnnt';
import { resize, requestRender } from './render.js?v=mvzojnnt';
import { initInput } from './input.js?v=mvzojnnt';
import { initPanel } from './panel.js?v=mvzojnnt';
import { initMinimap } from './minimap.js?v=mvzojnnt';
import { initClock } from './clock.js?v=mvzojnnt';
import { initDrive } from './drive.js?v=mvzojnnt';
import { initHistory } from './history.js?v=mvzojnnt';
import { initGroupSharing } from './group-share.js?v=mvzojnnt';
import { initGroupShareUI } from './group-share-ui.js?v=mvzojnnt';

import { initMobileMode } from './mobile-mode.js?v=mvzojnnt';
import { localStorageFailed } from './local-store.js?v=mvzojnnt';

initMobileMode();
loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
window.addEventListener('beforeunload', e => {
  if (!localStorageFailed()) return;
  e.preventDefault();
  e.returnValue = '';
});
initInput();
initPanel();
initMinimap();
initClock();
initDrive();
initHistory();
initGroupSharing();
initGroupShareUI();
requestRender();
