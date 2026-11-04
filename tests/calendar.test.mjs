import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calendarEvents } from '../js/calendar.js';

test('calendar handles recurring events, exclusions and the exclusive end of all-day events', () => {
  const feed = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bete tests//EN',
    'BEGIN:VEVENT', 'UID:daily', 'DTSTART:20261104T120000', 'DTEND:20261104T130000',
    'RRULE:FREQ=DAILY;COUNT=3', 'EXDATE:20261105T120000', 'SUMMARY:Rendez-vous', 'END:VEVENT',
    'BEGIN:VEVENT', 'UID:days', 'DTSTART;VALUE=DATE:20261104', 'DTEND;VALUE=DATE:20261106',
    'SUMMARY:Congés', 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const events = calendarEvents(feed, new Date(2026, 10, 4), new Date(2026, 10, 7));
  assert.deepEqual(events.map(e => [e.title, e.start.getDate(), e.allDay]), [
    ['Congés', 4, true], ['Rendez-vous', 4, false], ['Rendez-vous', 6, false],
  ]);
  assert.equal(+events[0].end, +new Date(2026, 10, 6));
  assert.equal(events[1].start.getHours(), 12);
});
