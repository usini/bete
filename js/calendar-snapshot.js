export function cleanCalendarSnapshot(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 100).flatMap(event => {
    if (!event || typeof event.title !== 'string') return [];
    const start = new Date(event.start), end = new Date(event.end);
    if (!Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) return [];
    return [{ title: event.title.slice(0, 500), start: start.toISOString(), end: end.toISOString(), allDay: event.allDay === true }];
  }).sort((a,b) => new Date(a.start) - new Date(b.start)).slice(0, 2);
}
