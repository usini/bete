// Clock at the top of the page: the date and the time as HH:MM:SS, updated every second.
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

export function initClock() { tick(); }
