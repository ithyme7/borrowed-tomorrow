import test from 'node:test';
import assert from 'node:assert/strict';
import { assessReservation, approveReservation, rejectReservation, suggestAlternatives } from '../engine.mjs';
import { createInitialSnapshot, INITIAL_SNAPSHOT, objects } from '../fixtures.mjs';

const proposal = (overrides = {}) => ({ id: 'pending', objectId: 'book', eraId: 'now', borrower: 'Fictional reader', startDate: '2026-04-10', endDate: '2026-04-14', status: 'proposed', ...overrides });
const snapshot = (reservations = []) => ({
  objects: [
    { id: 'book', name: 'A Borrowed Book', availableEraIds: ['now', 'later'], restorationStatus: 'ready' },
    { id: 'map', name: 'A Spare Map', availableEraIds: ['now'], restorationStatus: 'ready' },
    { id: 'broken', name: 'A Broken Clock', availableEraIds: ['now'], restorationStatus: 'needs-repair' },
  ],
  eras: [
    { id: 'now', name: 'Now', startDate: '2026-01-01', endDate: '2027-01-01' },
    { id: 'later', name: 'Later', startDate: '2030-01-01', endDate: '2031-01-01' },
  ],
  reservations,
});
const codes = result => result.reasons.map(item => item.code);
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

test('a ready object in its era with real dates is eligible', () => {
  assert.deepEqual(assessReservation(snapshot(), proposal()), { ok: true, reasons: [], conflictIds: [] });
});

test('return and borrowing on the same boundary day do not overlap', () => {
  const bookings = [proposal({ id: 'earlier', startDate: '2026-04-06', endDate: '2026-04-10', status: 'approved' }), proposal({ id: 'later', startDate: '2026-04-14', endDate: '2026-04-17', status: 'approved' })];
  assert.equal(assessReservation(snapshot(bookings), proposal()).ok, true);
});

test('overlaps include containing ranges and return sorted concrete conflict IDs', () => {
  const bookings = [proposal({ id: 'zeta', startDate: '2026-04-01', endDate: '2026-05-01', status: 'approved' }), proposal({ id: 'alpha', startDate: '2026-04-12', endDate: '2026-04-13', status: 'approved' })];
  const result = assessReservation(snapshot(bookings), proposal());
  assert.deepEqual(result.conflictIds, ['alpha', 'zeta']);
  assert.deepEqual(codes(result), ['OVERLAP']);
  assert.match(result.reasons[0].message, /alpha, zeta/);
});

test('other objects, pending proposals and rejected loans do not occupy this object', () => {
  const bookings = [proposal({ id: 'other-object', objectId: 'map', status: 'approved' }), proposal({ id: 'other-pending' }), proposal({ id: 'declined', status: 'rejected' })];
  assert.equal(assessReservation(snapshot(bookings), proposal()).ok, true);
});

test('all reservations for one object are checked, even with another eraId', () => {
  const booking = proposal({ id: 'cross-era-record', eraId: 'later', status: 'approved' });
  assert.deepEqual(assessReservation(snapshot([booking]), proposal()).conflictIds, ['cross-era-record']);
});

test('unrepaired and still-restoring objects are rejected with concrete reasons', () => {
  const data = snapshot();
  assert.match(assessReservation(data, proposal({ objectId: 'broken' })).reasons[0].message, /needs repair/);
  data.objects[0].restorationStatus = 'restoring';
  assert.match(assessReservation(data, proposal()).reasons[0].message, /still being restored/);
  delete data.objects[0].restorationStatus;
  assert.ok(codes(assessReservation(data, proposal())).includes('OBJECT_NOT_READY'));
});

test('an object exists only in its declared eras', () => {
  const data = snapshot();
  data.objects[0].availableEraIds = ['later'];
  assert.deepEqual(codes(assessReservation(data, proposal())), ['OBJECT_ABSENT_IN_ERA']);
});

test('the full half-open loan must fit inside the era, including its final return boundary', () => {
  assert.equal(assessReservation(snapshot(), proposal({ startDate: '2026-12-28', endDate: '2027-01-01' })).ok, true);
  assert.ok(codes(assessReservation(snapshot(), proposal({ startDate: '2025-12-31' }))).includes('OUTSIDE_ERA'));
  assert.ok(codes(assessReservation(snapshot(), proposal({ endDate: '2027-01-02' }))).includes('OUTSIDE_ERA'));
});

test('invalid, reversed, zero-length and datetime ranges fail calendar validation', () => {
  for (const dates of [
    { startDate: '2026-02-30', endDate: '2026-03-04' },
    { startDate: '2026-02-29', endDate: '2026-03-04' },
    { startDate: '2026-4-10', endDate: '2026-04-14' },
    { startDate: '2026-04-10T00:00:00Z', endDate: '2026-04-14' },
    { startDate: '2026-04-14', endDate: '2026-04-10' },
    { startDate: '2026-04-10', endDate: '2026-04-10' },
    { startDate: '0000-01-01', endDate: '0000-01-02' },
  ]) assert.ok(codes(assessReservation(snapshot(), proposal(dates))).includes('INVALID_DATES'), JSON.stringify(dates));
});

test('real leap days and years below 100 are parsed without a 1900 offset', () => {
  const data = snapshot();
  data.eras[0] = { id: 'now', name: 'Early era', startDate: '0096-01-01', endDate: '0097-01-01' };
  assert.equal(assessReservation(data, proposal({ startDate: '0096-02-29', endDate: '0096-03-01' })).ok, true);
});

test('approval rechecks a confirmed booking added after the proposal was made', () => {
  const data = snapshot([proposal()]);
  assert.equal(assessReservation(data, proposal()).ok, true);
  data.reservations.push(proposal({ id: 'newly-confirmed', status: 'approved' }));
  const result = approveReservation(data, 'pending');
  assert.equal(result.ok, false);
  assert.deepEqual(result.assessment.conflictIds, ['newly-confirmed']);
  assert.equal(result.snapshot, data);
  assert.equal(data.reservations[0].status, 'proposed');
});

test('approval rechecks restoration, existence in the era and updated era boundaries', () => {
  for (const [change, code] of [
    [data => { data.objects[0].restorationStatus = 'needs-repair'; }, 'OBJECT_NOT_READY'],
    [data => { data.objects[0].availableEraIds = ['later']; }, 'OBJECT_ABSENT_IN_ERA'],
    [data => { data.eras[0].endDate = '2026-04-12'; }, 'OUTSIDE_ERA'],
  ]) {
    const data = snapshot([proposal()]);
    change(data);
    const result = approveReservation(data, 'pending');
    assert.equal(result.ok, false);
    assert.ok(codes(result.assessment).includes(code));
  }
});

test('valid approval creates a new snapshot and leaves frozen inputs unchanged', () => {
  const data = freeze(snapshot([proposal()]));
  const result = approveReservation(data, 'pending');
  assert.equal(result.ok, true);
  assert.notEqual(result.snapshot, data);
  assert.equal(result.reservation.status, 'approved');
  assert.equal(result.snapshot.reservations[0], result.reservation);
  assert.equal(data.reservations[0].status, 'proposed');
});

test('already approved and rejected records cannot be approved again', () => {
  for (const status of ['approved', 'rejected']) {
    const data = snapshot([proposal({ status })]);
    assert.deepEqual(codes(approveReservation(data, 'pending').assessment), ['INVALID_TRANSITION']);
  }
});

test('missing and duplicate reservation IDs prevent ambiguous decisions', () => {
  assert.deepEqual(codes(approveReservation(snapshot(), 'absent').assessment), ['RESERVATION_NOT_FOUND']);
  assert.deepEqual(codes(approveReservation(snapshot([proposal(), proposal()]), 'pending').assessment), ['DUPLICATE_RESERVATION_ID']);
});

test('malformed snapshots and duplicate catalogue identifiers fail closed', () => {
  assert.deepEqual(codes(assessReservation({}, proposal())), ['INVALID_SNAPSHOT']);
  assert.equal(approveReservation(null, 'pending').ok, false);
  const data = snapshot();
  data.objects.push({ ...data.objects[0] });
  data.eras.push({ ...data.eras[0] });
  assert.deepEqual(codes(assessReservation(data, proposal())), ['AMBIGUOUS_OBJECT', 'AMBIGUOUS_ERA']);
});

test('unknown catalogue items and invalid era dates produce distinct reasons', () => {
  assert.deepEqual(codes(assessReservation(snapshot(), proposal({ objectId: 'absent', eraId: 'absent' }))), ['OBJECT_NOT_FOUND', 'ERA_NOT_FOUND']);
  const data = snapshot();
  data.eras[0].endDate = 'invalid';
  assert.ok(codes(assessReservation(data, proposal())).includes('INVALID_ERA_DATES'));
});

test('corrupt confirmed dates and unknown existing states never silently free an object', () => {
  assert.ok(codes(assessReservation(snapshot([proposal({ id: 'corrupt', status: 'approved', endDate: 'invalid' })]), proposal())).includes('INVALID_CONFIRMED_DATES'));
  assert.ok(codes(assessReservation(snapshot([proposal({ id: 'unknown-state', status: 'maybe-approved' })]), proposal())).includes('INVALID_EXISTING_STATE'));
});

test('manual rejection leaves a pending conflicted proposal intact until the decision', () => {
  const data = freeze(snapshot([proposal(), proposal({ id: 'existing', status: 'approved' })]));
  const result = rejectReservation(data, 'pending', '  Choose another date.  ');
  assert.equal(result.ok, true);
  assert.equal(result.reservation.status, 'rejected');
  assert.equal(result.reservation.rejectionReason, 'Choose another date.');
  assert.equal(data.reservations[0].status, 'proposed');
  assert.equal(rejectReservation(result.snapshot, 'pending').ok, false);
});

test('alternatives preserve duration and each passes the actual assessor', () => {
  const data = freeze(snapshot([proposal({ id: 'confirmed', status: 'approved', endDate: '2026-04-16' })]));
  const alternatives = suggestAlternatives(data, proposal());
  assert.deepEqual(alternatives.map(item => item.kind), ['another-object', 'later-dates', 'another-era']);
  assert.equal(alternatives[0].objectId, 'map');
  assert.equal(alternatives[1].startDate, '2026-04-16');
  assert.equal(alternatives[1].endDate, '2026-04-20');
  assert.equal(alternatives[2].eraId, 'later');
  for (const item of alternatives) {
    assert.equal(assessReservation(data, item).ok, true);
    assert.equal((Date.parse(item.endDate) - Date.parse(item.startDate)) / 86_400_000, 4);
  }
  assert.deepEqual(suggestAlternatives(data, proposal()), alternatives);
});

test('the next available gap moves past successive conflicts, never outside the era', () => {
  const data = snapshot([
    proposal({ id: 'first', status: 'approved', startDate: '2026-04-10', endDate: '2026-04-17' }),
    proposal({ id: 'second', status: 'approved', startDate: '2026-04-18', endDate: '2026-04-21' }),
  ]);
  const later = suggestAlternatives(data, proposal()).find(item => item.kind === 'later-dates');
  assert.equal(later.startDate, '2026-04-21');
  assert.equal(later.endDate, '2026-04-25');
  data.eras[0].endDate = '2026-04-22';
  assert.equal(suggestAlternatives(data, proposal()).some(item => item.kind === 'later-dates'), false);
});

test('alternative limits, invalid requests and an already eligible request are handled safely', () => {
  const data = snapshot([proposal({ id: 'confirmed', status: 'approved' })]);
  assert.equal(suggestAlternatives(data, proposal(), { limit: 1 }).length, 1);
  assert.deepEqual(suggestAlternatives(data, proposal(), { limit: 0 }), []);
  assert.deepEqual(suggestAlternatives(data, proposal({ endDate: 'invalid' })), []);
  assert.deepEqual(suggestAlternatives(snapshot(), proposal()), []);
  assert.deepEqual(suggestAlternatives(null, proposal()), []);
});

test('the six original object fixtures contain a blocked and an approvable pending story', () => {
  assert.equal(objects.length, 6);
  assert.equal(new Set(objects.map(item => item.id)).size, 6);
  const data = createInitialSnapshot();
  const conflict = approveReservation(data, 'proposal-rain-04');
  assert.deepEqual(conflict.assessment.conflictIds, ['loan-rain-01']);
  assert.equal(approveReservation(data, 'proposal-atlas-05').ok, true);
  data.objects[0].availableEraIds.push('fictional-new-era');
  assert.equal(INITIAL_SNAPSHOT.objects[0].availableEraIds.includes('fictional-new-era'), false);
});

test('malformed records cannot crash a decision or produce an anonymous approved loan', () => {
  const nullRecord = snapshot([proposal(), null]);
  assert.deepEqual(codes(approveReservation(nullRecord, 'pending').assessment), ['INVALID_SNAPSHOT']);
  assert.deepEqual(suggestAlternatives(nullRecord, proposal()), []);
  const anonymous = snapshot([proposal({ id: undefined })]);
  assert.equal(approveReservation(anonymous, undefined).ok, false);
  const unavailable = snapshot();
  unavailable.objects[0].availableEraIds = {};
  assert.doesNotThrow(() => suggestAlternatives(unavailable, proposal(), null));
  assert.equal(suggestAlternatives(unavailable, proposal(), null).some(item => item.objectId === 'book'), false);
  assert.equal(assessReservation(snapshot(), proposal(), null).ok, true);
});
