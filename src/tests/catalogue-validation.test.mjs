import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialSnapshot } from '../domain/fixtures.mjs';
import { validateCatalogue } from '../catalogue-validation.mjs';
test('missing or impossible era dates cannot replace a working catalogue', () => {
  for (const value of [undefined,'1896-02-30','not-a-date']) {
    const snapshot = createInitialSnapshot(); snapshot.eras[0].startDate=value;
    assert.throws(() => validateCatalogue(snapshot), /era/);
  }
});
test('duplicate ids and dangling references are rejected before rendering', () => {
  const duplicate=createInitialSnapshot(); duplicate.objects[1].id=duplicate.objects[0].id;
  assert.throws(() => validateCatalogue(duplicate), /duplicate/);
  const dangling=createInitialSnapshot(); dangling.objects[0].availableEraIds.push('nonexistent');
  assert.throws(() => validateCatalogue(dangling), /references/);
});
test('corrupt approved loans cannot silently become free inventory', () => {
  const snapshot=createInitialSnapshot(); snapshot.reservations[0].endDate='broken';
  assert.throws(() => validateCatalogue(snapshot), /reservation/);
});
test('a valid fixture is accepted without mutation, including a conflicted proposal', () => {
  const snapshot=createInitialSnapshot(); const original=structuredClone(snapshot);
  assert.equal(validateCatalogue(snapshot),snapshot);assert.deepEqual(snapshot,original);
});
