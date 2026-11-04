import ICAL from './vendor/ical.min.js?v=mw2e6cqi';

const day = (date, offset = 0) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
const month = (date, offset = 0) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const dayLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' });
const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const nextDateLabel = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const hourLabel = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const asDate = time => time.isDate ? new Date(time.year, time.month - 1, time.day) : time.toJSDate();

export function calendarEvents(source, from, until) {
  const calendar = new ICAL.Component(ICAL.parse(source));
  const items = [];
  let remaining = 50000;
  for (const component of calendar.getAllSubcomponents('vevent')) {
    try {
      if (component.hasProperty('recurrence-id') || component.getFirstPropertyValue('status') === 'CANCELLED') continue;
      const event = new ICAL.Event(component);
      const add = (item, startDate, endDate) => {
        if (item.component.getFirstPropertyValue('status') === 'CANCELLED') return;
        const start = asDate(startDate);
        const end = new Date(Math.max(+asDate(endDate), +start + 1));
        if (start < until && end > from) items.push({ start, end, allDay: startDate.isDate, title: item.summary || 'Événement' });
      };
      if (!event.isRecurring()) {
        add(event, event.startDate, event.endDate);
        continue;
      }
      const iterator = event.iterator();
      while (remaining > 0) {
        remaining--;
        const occurrence = iterator.next();
        if (!occurrence || asDate(occurrence) >= until) break;
        const { item, startDate, endDate } = event.getOccurrenceDetails(occurrence);
        add(item, startDate, endDate);
      }
    } catch { /* One malformed event should not hide the rest of the feed. */ }
  }
  return items.sort((a, b) => a.start - b.start);
}

export function initDesktopCalendar(invoke) {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'clock-calendar';
  trigger.title = 'Ouvrir le calendrier';
  trigger.setAttribute('aria-label', 'Ouvrir le calendrier');
  trigger.setAttribute('aria-haspopup', 'dialog');
  const clock = document.getElementById('clock');
  trigger.append(document.getElementById('clock-date'), document.getElementById('clock-time'));
  clock.prepend(trigger);
  const nextLabel = document.createElement('span');
  nextLabel.id = 'clock-next-event';
  nextLabel.hidden = true;
  trigger.after(nextLabel);

  const dialog = document.createElement('dialog');
  dialog.id = 'calendar-dialog';
  dialog.setAttribute('aria-labelledby', 'calendar-title');
  dialog.innerHTML = `
    <header class="calendar-toolbar">
      <button type="button" data-prev aria-label="Mois précédent">‹</button>
      <h2 id="calendar-title">Calendrier</h2>
      <button type="button" data-next aria-label="Mois suivant">›</button>
      <button type="button" data-today>Aujourd’hui</button>
      <button type="button" data-close aria-label="Fermer le calendrier">×</button>
    </header>
    <div class="calendar-grid" data-days></div>
    <h3 data-agenda-title></h3>
    <ul class="calendar-agenda" data-agenda></ul>
    <p class="hint" data-status role="status"></p>
    <form class="calendar-feed">
      <label class="field">Lien iCal <input type="password" name="feed" placeholder="https://… ou webcal://…" autocomplete="off" spellcheck="false" required></label>
      <div class="calendar-actions">
        <button type="submit">Enregistrer le lien</button>
        <button type="button" data-reload>Actualiser</button>
        <button type="button" data-remove hidden>Retirer le lien</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const get = name => dialog.querySelector('[data-' + name + ']');
  const form = dialog.querySelector('form');
  const input = form.elements.feed;
  let selected = day(new Date()), current = month(selected);
  let source = null, events = [], upcoming = [], busy = false;
  let nextTimer;

  function showNextEvent() {
    clearTimeout(nextTimer);
    const now = Date.now();
    const next = upcoming.find(event => event.start >= now);
    nextLabel.hidden = !next;
    if (!next) {
      nextLabel.textContent = '';
      nextLabel.removeAttribute('title');
      return;
    }
    const time = next.allDay ? '' : ' à ' + hourLabel.format(next.start);
    const text = nextDateLabel.format(next.start) + time + ' · ' + next.title;
    nextLabel.textContent = text;
    nextLabel.title = 'Prochain rendez-vous · ' + text;
    nextTimer = setTimeout(showNextEvent, Math.min(86400000, +next.start - now + 1));
  }

  const onDay = date => events.filter(event => event.start < day(date, 1) && event.end > date);
  function renderDay() {
    get('agenda-title').textContent = dayLabel.format(selected);
    const rows = onDay(selected).map(event => {
      const row = document.createElement('li');
      const time = event.allDay ? 'Toute la journée' : hourLabel.format(event.start);
      row.textContent = time + ' · ' + event.title;
      return row;
    });
    if (!rows.length) {
      const empty = document.createElement('li');
      empty.textContent = 'Aucun événement.';
      rows.push(empty);
    }
    get('agenda').replaceChildren(...rows);
  }

  function renderMonth() {
    const first = day(current, -((current.getDay() + 6) % 7));
    events = source ? calendarEvents(source, first, day(first, 42)) : [];
    dialog.querySelector('h2').textContent = monthLabel.format(current);
    const cells = ['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'].map(text => {
      const cell = document.createElement('span');
      cell.textContent = text;
      return cell;
    });
    const today = +day(new Date());
    for (let i = 0; i < 42; i++) {
      const date = day(first, i);
      const cell = document.createElement('button');
      const count = onDay(date).length;
      cell.type = 'button';
      cell.textContent = date.getDate();
      cell.classList.toggle('calendar-outside', date.getMonth() !== current.getMonth());
      cell.classList.toggle('calendar-has-events', count > 0);
      cell.setAttribute('aria-label', dayLabel.format(date) + (count ? ' · ' + count + ' événement(s)' : ''));
      cell.setAttribute('aria-pressed', String(+date === +selected));
      if (+date === today) cell.setAttribute('aria-current', 'date');
      cell.addEventListener('click', () => {
        get('days').querySelector('[aria-pressed="true"]')?.setAttribute('aria-pressed', 'false');
        selected = date;
        cell.setAttribute('aria-pressed', 'true');
        renderDay();
      });
      cells.push(cell);
    }
    get('days').replaceChildren(...cells);
    renderDay();
  }

  async function load(url) {
    if (busy) return;
    busy = true;
    const actions = [...form.querySelectorAll('button')];
    actions.forEach(button => { button.disabled = true; });
    get('status').textContent = url === '' ? 'Retrait du lien…' : 'Chargement du calendrier…';
    try {
      const next = await invoke('calendar_feed', { url });
      const now = new Date();
      upcoming = next ? calendarEvents(next, now, month(now, 13)) : [];
      source = next;
      showNextEvent();
      input.value = '';
      get('remove').hidden = !source;
      get('status').textContent = source ? 'Calendrier à jour.' : 'Ajoute un lien iCal pour afficher tes événements.';
      if (dialog.open) renderMonth();
    } catch (error) {
      get('status').textContent = typeof error === 'string' ? error : 'Le calendrier iCal est illisible.';
    } finally {
      busy = false;
      actions.forEach(button => { button.disabled = false; });
    }
  }

  trigger.addEventListener('click', () => {
    if (dialog.open) return;
    dialog.showModal();
    renderMonth();
    void load(null);
  });
  get('prev').addEventListener('click', () => { current = month(current, -1); selected = current; renderMonth(); });
  get('next').addEventListener('click', () => { current = month(current, 1); selected = current; renderMonth(); });
  get('today').addEventListener('click', () => { selected = day(new Date()); current = month(selected); renderMonth(); });
  get('close').addEventListener('click', () => dialog.close());
  get('reload').addEventListener('click', () => load(null));
  get('remove').addEventListener('click', () => load(''));
  form.addEventListener('submit', event => {
    event.preventDefault();
    const url = input.value.trim();
    if (url) void load(url);
  });
  dialog.addEventListener('close', () => { input.value = ''; });
  void load(null);
}
