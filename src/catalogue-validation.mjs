const states = new Set(['proposed','approved','rejected']);
const conditions = new Set(['ready','needs-repair','restoring']);
const string = value => typeof value === 'string' && value.trim().length > 0;
function day(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
/** Validate externally loaded display content before replacing a working baseline. */
export function validateCatalogue(snapshot) {
  if (!snapshot || !['objects','eras','reservations'].every(key => Array.isArray(snapshot[key])) || !snapshot.objects.length || !snapshot.eras.length) throw new Error('The public catalogue is incomplete.');
  for (const key of ['objects','eras','reservations']) {
    if (!snapshot[key].every(item => item && string(item.id)) || new Set(snapshot[key].map(item => item.id)).size !== snapshot[key].length) throw new Error(`Invalid or duplicate ${key} identifiers.`);
  }
  const objectIds = new Set(snapshot.objects.map(item => item.id));
  const eraIds = new Set(snapshot.eras.map(item => item.id));
  for (const era of snapshot.eras) if (!string(era.name) || !day(era.startDate) || !day(era.endDate) || era.startDate >= era.endDate) throw new Error('A public era has invalid dates or a missing name.');
  for (const object of snapshot.objects) {
    if (!string(object.name) || typeof object.description !== 'string' || !conditions.has(object.restorationStatus) || !Array.isArray(object.availableEraIds) || !object.availableEraIds.every(id => eraIds.has(id))) throw new Error('An object has invalid display content or era references.');
  }
  for (const reservation of snapshot.reservations) {
    if (!objectIds.has(reservation.objectId) || !eraIds.has(reservation.eraId) || !string(reservation.borrower) || !states.has(reservation.status) || !day(reservation.startDate) || !day(reservation.endDate) || reservation.startDate >= reservation.endDate) throw new Error('A public reservation has invalid dates, state or references.');
  }
  return snapshot;
}
