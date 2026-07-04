// Desktop-only concerns (Windows wrapper via Tauri). A no-op module on the
// web build: isDesktop is false there, and every exported helper falls back
// to the normal browser behavior.
const KEY = 'bete:linkmode'; // desktop-only: 'internet' (default) | 'lan'

export const isDesktop = !!(window.__TAURI_INTERNALS__ || window.__TAURI__);

let linkMode = 'internet';
try { const m = localStorage.getItem(KEY); if (m === 'lan' || m === 'internet') linkMode = m; } catch (e) { /* */ }

export function getLinkMode() { return linkMode; }
export function setLinkMode(m) {
  if (m !== 'lan' && m !== 'internet') return;
  linkMode = m;
  try { localStorage.setItem(KEY, m); } catch (e) { /* */ }
}

// Cached "http://<lan-ip>:<port>" resolved once at boot via a Tauri command
// (a plain webview has no way to read the machine's LAN address itself).
let lanUrl = null;

export async function initDesktopLink() {
  if (!isDesktop) return;
  try { lanUrl = await window.__TAURI__.core.invoke('get_lan_url'); } catch (e) { lanUrl = null; }
}

// Displayed in Settings so a user can tell which build they're actually
// running without guessing -- useful when troubleshooting the auto-updater.
export async function getAppVersion() {
  if (!isDesktop) return null;
  try { return await window.__TAURI__.core.invoke('plugin:app|version'); } catch (e) { return null; }
}

// The origin+path to embed in links handed to OTHER people (liaison QR code,
// "link to board" blocks) — as opposed to internal navigation (switching the
// current window to a different local board), which must keep using the real
// location.origin so it still resolves inside the desktop webview.
//
// tauri://localhost (or http://tauri.localhost) isn't reachable by anyone
// else, so on desktop we substitute either the public deployment or this
// machine's LAN address, per the user's choice in Settings > Sharing.
export function shareOrigin() {
  if (!isDesktop) return location.origin + location.pathname;
  if (linkMode === 'lan' && lanUrl) return lanUrl;
  return 'https://bete.usini.eu/';
}
