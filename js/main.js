import { flyTo, flyToBlock } from './camera.js?v=mwt1ps8b';
import { externalMode, githubBoard, loadGithubBoard } from './external-board.js?v=mwt1ps8b';
// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow, setDoc, events, getNode, state } from './state.js?v=mwt1ps8b';
import { resize, requestRender } from './render.js?v=mwt1ps8b';
import { initInput } from './input.js?v=mwt1ps8b';
import { initCommandSearch } from './command-search.js?v=mwt1ps8b';
import { initPanel } from './panel.js?v=mwt1ps8b';
import { initMinimap } from './minimap.js?v=mwt1ps8b';
import { initClock } from './clock.js?v=mwt1ps8b';
import { initHistory } from './history.js?v=mwt1ps8b';
import { initGroupSharing } from './group-share.js?v=mwt1ps8b';
import { initGroupShareUI } from './group-share-ui.js?v=mwt1ps8b';

import { initMobileMode } from './mobile-mode.js?v=mwt1ps8b';
import { localStorageFailed } from './local-store.js?v=mwt1ps8b';

initMobileMode();
if (externalMode) {
  document.body.classList.add('external-board');
  const status = document.getElementById('external-board-status');
  status.hidden = false;
  status.querySelector('span').textContent = 'Chargement du tableau GitHub…';
  loadGithubBoard(githubBoard).then(doc => {
    setDoc(doc);
    status.querySelector('span').textContent = 'Tableau GitHub · lecture seule';
  }).catch(error => {
    status.querySelector('span').textContent = error instanceof TypeError
      ? 'Impossible de joindre GitHub.' : error.message;
  });
} else loadFromStorage();
resize();
window.addEventListener('resize', resize);
window.addEventListener('pagehide', saveNow);
window.addEventListener('beforeunload', e => {
  if (!localStorageFailed()) return;
  e.preventDefault();
  e.returnValue = '';
});
events.addEventListener('created-away', event => {
  const node=getNode(event.detail.id);
  if (!node) return;
  if (event.detail.fit) flyToBlock(node);
  else flyTo(node.x+node.w/2,node.y+node.h/2,state.camera.zoom);
});
initInput();
initCommandSearch();
initPanel();
initMinimap();
initClock();
if (!externalMode) {
  initHistory();
  const { initDrive } = await import('./drive.js?v=mwt1ps8b');
  if (window.__BETE_ANDROID_NATIVE__) {
    const { initAndroid } = await import('./android.js?v=mwt1ps8b');
    await initAndroid();
  } else if (window.__TAURI__) {
    const driveSection = document.getElementById('drive-status').closest('section');
    driveSection.hidden = true;
    window.__TAURI__.core.invoke('drive_configured').then(configured => {
      if (!configured) return;
      driveSection.hidden = false;
      initDrive();
    }).catch(console.error);
    import('./desktop.js?v=mwt1ps8b').then(({ initDesktop }) => initDesktop());
  } else {
    initDrive();
    const { initDesktopCalendar } = await import('./calendar.js?v=mwt1ps8b');
    await initDesktopCalendar();
  }
  initGroupSharing();
  initGroupShareUI();
}
requestRender();
