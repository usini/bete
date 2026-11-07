import { flyTo, flyToBlock } from './camera.js?v=mw6xpxbq';
import { externalMode, githubBoard, loadGithubBoard } from './external-board.js?v=mw6xpxbq';
// Bootstrap: load the saved board, wire the UI, start rendering.
import { loadFromStorage, saveNow, setDoc, events, getNode, state } from './state.js?v=mw6xpxbq';
import { resize, requestRender } from './render.js?v=mw6xpxbq';
import { initInput } from './input.js?v=mw6xpxbq';
import { initCommandSearch } from './command-search.js?v=mw6xpxbq';
import { initPanel } from './panel.js?v=mw6xpxbq';
import { initMinimap } from './minimap.js?v=mw6xpxbq';
import { initClock } from './clock.js?v=mw6xpxbq';
import { initHistory } from './history.js?v=mw6xpxbq';
import { initGroupSharing } from './group-share.js?v=mw6xpxbq';
import { initGroupShareUI } from './group-share-ui.js?v=mw6xpxbq';

import { initMobileMode } from './mobile-mode.js?v=mw6xpxbq';
import { localStorageFailed } from './local-store.js?v=mw6xpxbq';

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
  const { initDrive } = await import('./drive.js?v=mw6xpxbq');
  if (window.__BETE_ANDROID_NATIVE__) {
    const { initAndroid } = await import('./android.js?v=mw6xpxbq');
    await initAndroid();
  } else if (window.__TAURI__) {
    const driveSection = document.getElementById('drive-status').closest('section');
    driveSection.hidden = true;
    window.__TAURI__.core.invoke('drive_configured').then(configured => {
      if (!configured) return;
      driveSection.hidden = false;
      initDrive();
    }).catch(console.error);
    import('./desktop.js?v=mw6xpxbq').then(({ initDesktop }) => initDesktop());
  } else {
    initDrive();
    const { initDesktopCalendar } = await import('./calendar.js?v=mw6xpxbq');
    await initDesktopCalendar();
  }
  initGroupSharing();
  initGroupShareUI();
}
requestRender();
