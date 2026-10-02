# Borrowed Tomorrow: domain prototype

An original fictional lending library with six objects and five historical/future eras. This local prototype contains reservation rules and sample data only. It has no backend, persistence, payment integration, Sanity connection, external dependencies, AI API, or automatic decisions. It does not represent an earned challenge reward or a submitted entry.

## Snapshot and records

`fixtures.mjs` exports `objects`, `eras`, `reservations`, `INITIAL_SNAPSHOT`, and `createInitialSnapshot()`. Use the factory for a fresh frontend state; fixture arrays should otherwise be treated as read-only.

- Snapshot: `{ objects, eras, reservations }`.
- Object: `{ id, name, category, description, availableEraIds, restorationStatus }`.
- Restoration status: `ready`, `needs-repair`, or `restoring`. Only `ready` permits approval. Unknown/missing status blocks approval.
- Era: `{ id, name, startDate, endDate }`. The object exists only in its declared `availableEraIds`.
- Reservation: `{ id, objectId, eraId, borrower, startDate, endDate, status }`. The three states are `proposed`, `approved`, and `rejected`; `approved` means confirmed.

Calendar dates are real ISO days, `YYYY-MM-DD`, in years 0001–9999. Each range is half-open: `[startDate, endDate)`. A loan ending on April 14 may be followed by another beginning on April 14. The entire loan must fit inside one selected era. The same physical object cannot have overlapping approved loans, regardless of an existing record's era identifier. Proposed and rejected records do not occupy inventory.

## API

```js
import { assessReservation, approveReservation, rejectReservation, suggestAlternatives } from './engine.mjs';
import { createInitialSnapshot } from './fixtures.mjs';

const snapshot = createInitialSnapshot();
const checked = assessReservation(snapshot, snapshot.reservations[3]);
// { ok: false, reasons: [{ code: 'OVERLAP', message: '...' }], conflictIds: ['loan-rain-01'] }

const decision = approveReservation(snapshot, 'proposal-atlas-05');
// { ok: true, snapshot: NEW_SNAPSHOT, reservation: APPROVED_RECORD, assessment: { ... } }
```

`assessReservation(snapshot, proposal, options = {})` returns `{ ok, reasons, conflictIds }`. Reasons are concrete `{ code, message }` objects; conflict IDs are unique and sorted. A proposal's own `id` is excluded from conflicts by default; `options.excludeReservationId` can explicitly identify an existing record being assessed. New proposals must use unique IDs.

`approveReservation(snapshot, reservationId)` requires exactly one matching record in `proposed` state. Every constraint is rechecked against the snapshot passed at the moment of approval. An earlier eligibility result is never used as authorization. On failure the original snapshot is returned unchanged, and the record remains proposed. On success a new snapshot and approved record are returned. No timestamps or random IDs are generated.

`rejectReservation(snapshot, reservationId, rejectionReason = 'Declined by the librarian.')` makes an explicit, immutable `proposed` → `rejected` decision. A conflict does not automatically reject a proposal. Approved or rejected records cannot be decided again.

`suggestAlternatives(snapshot, proposal, options = {})` returns valid `{ objectId, eraId, startDate, endDate, kind, label }` suggestions only for a blocked request with a valid duration. It tries another ready object in the same era/dates, later dates for the requested object, then another era. Every suggestion is assessed against the current snapshot and retains the original number of borrowed days. `kind` is `another-object`, `later-dates`, or `another-era`. Default limit: four; configurable integer limit from zero to ten. Suggestions do not create reservations or approvals.

Unknown catalogue identifiers, duplicate identifiers, malformed dates, and corrupt approved records fail closed. This engine checks rules within one snapshot; it does not implement multi-user locking. A production backend would need atomic approval/transaction logic and authentication. The frontend must render borrower/catalogue text safely.

## Test command and execution log

From this directory, use `npm test` or `node --test tests/engine.test.mjs`. Node.js built-in `node:test` and `node:assert/strict` are the only test tools. No installation is required.

The suite covers date boundaries, leap-day validation, century handling, concrete overlap IDs, restoration/era constraints, stale approval checks, pure updates, explicit state transitions, fail-closed data checks, deterministic valid alternatives, and independent fixture copies.

Verified locally on 2026-10-02 using Node.js v22.23.2:

```text
$ node --test tests/engine.test.mjs
tests 24
pass 24
fail 0
cancelled 0
skipped 0
todo 0
exit code 0
```
