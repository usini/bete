// Clock at the top of the page: the date and the time as HH:MM:SS, updated every second.
import { sharingSummary, shareEvents } from './group-share.js?v=mvzijf2m';
const dateEl = document.getElementById('clock-date');
const timeEl = document.getElementById('clock-time');

function tick() {
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  dateEl.textContent = date.charAt(0).toUpperCase() + date.slice(1);
  timeEl.textContent = now.toLocaleTimeString('fr-FR', { hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  // Next tick right on the next full second, so the display never lags behind.
  setTimeout(tick, 1000 - now.getMilliseconds());
}

function updateSharing() {
  const badge = document.getElementById('clock-sharing');
  const summary = sharingSummary();
  badge.hidden = !summary.enabled;
  badge.textContent = summary.groups
    ? `Partage actif · ${summary.participants} participant${summary.participants > 1 ? 's' : ''}`
    : 'Partage en connexion…';
  badge.title = summary.groups ? `${summary.groups} groupe${summary.groups > 1 ? 's' : ''} partagé${summary.groups > 1 ? 's' : ''} · toi inclus` : 'En attente de connexion';
}
export function initClock() {
  tick(); updateSharing();
  shareEvents.addEventListener('change', updateSharing);
}
