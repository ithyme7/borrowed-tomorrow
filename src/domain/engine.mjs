/** Pure, deterministic reservation rules for the Borrowed Tomorrow prototype. */
const DAY_MS = 86_400_000;
const STATES = new Set(['proposed', 'approved', 'rejected']);

function dayNumber(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date.getTime() / DAY_MS;
}

function isoDay(day) {
  const date = new Date(day * DAY_MS);
  if (!Number.isFinite(date.getTime())) return null;
  const value = date.toISOString().slice(0, 10);
  return dayNumber(value) === day ? value : null;
}

function interval(record) {
  const start = dayNumber(record?.startDate);
  const end = dayNumber(record?.endDate);
  return start !== null && end !== null && start < end ? { start, end } : null;
}

function validSnapshot(snapshot) {
  const validRecord = record => !!record && typeof record === 'object' && typeof record.id === 'string' && record.id.trim().length > 0;
  return !!snapshot && Array.isArray(snapshot.objects) && Array.isArray(snapshot.eras) && Array.isArray(snapshot.reservations)
    && snapshot.objects.every(validRecord) && snapshot.eras.every(validRecord) && snapshot.reservations.every(validRecord);
}

function assessment(reasons, conflictIds = []) {
  return { ok: reasons.length === 0, reasons, conflictIds: [...new Set(conflictIds)].sort() };
}

function reason(code, message) {
  return { code, message };
}

/**
 * Dates use [startDate, endDate): the return date is not a borrowed day.
 * Only approved reservations occupy an object; proposed/rejected ones do not.
 * options.excludeReservationId supports assessing an existing record against itself.
 */
export function assessReservation(snapshot, proposal, options = {}) {
  if (!validSnapshot(snapshot)) return assessment([reason('INVALID_SNAPSHOT', 'The library snapshot must contain objects, eras, and reservations arrays.')]);
  if (!proposal || typeof proposal !== 'object') return assessment([reason('INVALID_PROPOSAL', 'Choose an object, an era, and a valid date range.')]);

  const reasons = [];
  const matchingObjects = snapshot.objects.filter(item => item?.id === proposal.objectId);
  const matchingEras = snapshot.eras.filter(era => era?.id === proposal.eraId);
  const object = matchingObjects.length === 1 ? matchingObjects[0] : null;
  const era = matchingEras.length === 1 ? matchingEras[0] : null;
  if (!object) reasons.push(reason(matchingObjects.length > 1 ? 'AMBIGUOUS_OBJECT' : 'OBJECT_NOT_FOUND', matchingObjects.length > 1 ? 'The object identifier is duplicated in the catalogue.' : 'This object is not in the library catalogue.'));
  if (!era) reasons.push(reason(matchingEras.length > 1 ? 'AMBIGUOUS_ERA' : 'ERA_NOT_FOUND', matchingEras.length > 1 ? 'The era identifier is duplicated in the catalogue.' : 'This era is not in the library catalogue.'));

  const requested = interval(proposal);
  if (!requested) reasons.push(reason('INVALID_DATES', 'Use real ISO calendar days (YYYY-MM-DD), with the return date after the borrowing date.'));
  if (object) {
    if (object.restorationStatus !== 'ready') {
      const message = object.restorationStatus === 'needs-repair' ? `${object.name} needs repair before it can be borrowed.` : object.restorationStatus === 'restoring' ? `${object.name} is still being restored.` : `${object.name} has no confirmed ready-for-loan status.`;
      reasons.push(reason('OBJECT_NOT_READY', message));
    }
    if (!Array.isArray(object.availableEraIds) || !object.availableEraIds.includes(proposal.eraId)) reasons.push(reason('OBJECT_ABSENT_IN_ERA', `${object.name} does not exist in the selected era.`));
  }
  const eraInterval = era ? interval(era) : null;
  if (era && !eraInterval) reasons.push(reason('INVALID_ERA_DATES', 'The selected era has an invalid calendar range.'));
  if (requested && eraInterval && (requested.start < eraInterval.start || requested.end > eraInterval.end)) reasons.push(reason('OUTSIDE_ERA', `The entire loan must fit between ${era.startDate} and ${era.endDate} (return date).`));

  const conflictIds = [];
  // The exclusion is only for the named existing record, never an entire object.
  const excludedId = options?.excludeReservationId ?? proposal.id;
  if (object && requested) {
    for (const reservation of snapshot.reservations) {
      if (!reservation || reservation.objectId !== proposal.objectId || (excludedId != null && reservation.id === excludedId)) continue;
      if (!STATES.has(reservation.status)) {
        if (!reasons.some(item => item.code === 'INVALID_EXISTING_STATE')) reasons.push(reason('INVALID_EXISTING_STATE', 'An existing reservation for this object has an unknown state; resolve it before approving another loan.'));
        continue;
      }
      if (reservation.status !== 'approved') continue;
      const booked = interval(reservation);
      if (!booked) {
        if (!reasons.some(item => item.code === 'INVALID_CONFIRMED_DATES')) reasons.push(reason('INVALID_CONFIRMED_DATES', 'An approved reservation for this object has invalid dates; repair that record before approving another loan.'));
        continue;
      }
      if (requested.start < booked.end && booked.start < requested.end) conflictIds.push(reservation.id);
    }
  }
  if (conflictIds.length) reasons.push(reason('OVERLAP', `This object is already reserved during the requested dates (${[...new Set(conflictIds)].sort().join(', ')}).`));
  return assessment(reasons, conflictIds);
}

function pendingReservation(snapshot, reservationId) {
  if (!validSnapshot(snapshot)) return { reservation: null, assessment: assessment([reason('INVALID_SNAPSHOT', 'The library snapshot must contain objects, eras, and reservations arrays.')]) };
  const matching = snapshot.reservations.filter(item => item?.id === reservationId);
  if (matching.length !== 1) return { reservation: null, assessment: assessment([reason(matching.length ? 'DUPLICATE_RESERVATION_ID' : 'RESERVATION_NOT_FOUND', matching.length ? 'The reservation identifier is duplicated; no decision was applied.' : 'The proposed reservation could not be found.')]) };
  const reservation = matching[0];
  if (reservation.status !== 'proposed') return { reservation, assessment: assessment([reason('INVALID_TRANSITION', 'Only a proposed reservation can be approved or rejected.')]) };
  return { reservation, assessment: null };
}

/** Approves only a pending proposal, rechecking every rule against this snapshot. */
export function approveReservation(snapshot, reservationId) {
  const pending = pendingReservation(snapshot, reservationId);
  const checked = pending.assessment ?? assessReservation(snapshot, pending.reservation, { excludeReservationId: reservationId });
  if (!checked.ok) return { ok: false, snapshot, reservation: pending.reservation, assessment: checked };
  const reservation = { ...pending.reservation, status: 'approved' };
  const next = { ...snapshot, reservations: snapshot.reservations.map(item => item.id === reservationId ? reservation : item) };
  return { ok: true, snapshot: next, reservation, assessment: checked };
}

/** Rejection is a decision, not an automatic side effect of failed approval. */
export function rejectReservation(snapshot, reservationId, rejectionReason = 'Declined by the librarian.') {
  const pending = pendingReservation(snapshot, reservationId);
  if (pending.assessment) return { ok: false, snapshot, reservation: pending.reservation, assessment: pending.assessment };
  const reservation = { ...pending.reservation, status: 'rejected', rejectionReason: typeof rejectionReason === 'string' && rejectionReason.trim() ? rejectionReason.trim() : 'Declined by the librarian.' };
  const next = { ...snapshot, reservations: snapshot.reservations.map(item => item.id === reservationId ? reservation : item) };
  return { ok: true, snapshot: next, reservation, assessment: assessment([]) };
}

function firstAvailableDates(snapshot, object, era, duration, earliest) {
  const bounds = interval(era);
  if (!bounds || object.restorationStatus !== 'ready' || !Array.isArray(object.availableEraIds) || !object.availableEraIds.includes(era.id)) return null;
  let start = Math.max(bounds.start, earliest);
  // Each failed overlap jumps past at least one confirmed booking, so this is bounded.
  for (let step = 0; step <= snapshot.reservations.length; step++) {
    if (start + duration > bounds.end) return null;
    const startDate = isoDay(start);
    const endDate = isoDay(start + duration);
    if (!startDate || !endDate) return null;
    const candidate = { objectId: object.id, eraId: era.id, startDate, endDate };
    const checked = assessReservation(snapshot, candidate);
    if (checked.ok) return candidate;
    if (checked.reasons.some(item => item.code !== 'OVERLAP')) return null;
    const conflictEnds = snapshot.reservations.filter(item => item.objectId === object.id && item.status === 'approved' && checked.conflictIds.includes(item.id)).map(item => interval(item)?.end).filter(Number.isFinite);
    if (!conflictEnds.length) return null;
    start = Math.max(...conflictEnds);
  }
  return null;
}

/**
 * Returns only currently valid alternatives, with the original loan duration.
 * Order: another ready object in the same era/dates, later dates, another era.
 * No suggestion is reserved or automatically approved. Default limit: 4 (max 10).
 */
export function suggestAlternatives(snapshot, proposal, options = {}) {
  if (!validSnapshot(snapshot) || !proposal) return [];
  const requested = interval(proposal);
  const object = snapshot.objects.find(item => item?.id === proposal.objectId);
  const era = snapshot.eras.find(item => item?.id === proposal.eraId);
  if (!requested || !object || !era || assessReservation(snapshot, proposal).ok) return [];
  const limit = Number.isInteger(options?.limit) ? Math.min(10, Math.max(0, options.limit)) : 4;
  const result = [];
  const seen = new Set();
  const add = (candidate, kind, item, candidateEra) => {
    if (!candidate || result.length >= limit || !assessReservation(snapshot, candidate).ok) return;
    const key = `${candidate.objectId}|${candidate.eraId}|${candidate.startDate}|${candidate.endDate}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ ...candidate, kind, label: `${item.name} · ${candidateEra.name} · ${candidate.startDate} to ${candidate.endDate}` });
  };
  for (const other of snapshot.objects) {
    if (other?.id === object.id) continue;
    add({ objectId: other.id, eraId: era.id, startDate: proposal.startDate, endDate: proposal.endDate }, 'another-object', other, era);
  }
  const duration = requested.end - requested.start;
  add(firstAvailableDates(snapshot, object, era, duration, requested.start + 1), 'later-dates', object, era);
  for (const otherEra of snapshot.eras) {
    if (otherEra?.id === era.id) continue;
    const bounds = interval(otherEra);
    if (bounds) add(firstAvailableDates(snapshot, object, otherEra, duration, bounds.start), 'another-era', object, otherEra);
  }
  return result;
}
