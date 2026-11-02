// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow } from './state.js?v=mvzo2vgf';
import { resize, requestRender } from './render.js?v=mvzo2vgf';
import { initInput } from './input.js?v=mvzo2vgf';
import { initPanel } from './panel.js?v=mvzo2vgf';
import { initMinimap } from './minimap.js?v=mvzo2vgf';
import { initClock } from './clock.js?v=mvzo2vgf';
import { initDrive } from './drive.js?v=mvzo2vgf';
import { initHistory } from './history.js?v=mvzo2vgf';
import { initGroupSharing } from './group-share.js?v=mvzo2vgf';
import { initGroupShareUI } from './group-share-ui.js?v=mvzo2vgf';

import { initMobileMode } from './mobile-mode.js?v=mvzo2vgf';
import { localStorageFailed } from './local-store.js?v=mvzo2vgf';

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
