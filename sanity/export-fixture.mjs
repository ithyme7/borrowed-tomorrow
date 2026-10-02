import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, relative, isAbsolute} from 'node:path';
import {createInitialSnapshot} from '../src/domain/fixtures.mjs';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const validDay = value => {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const requireText = (value, label, max) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > max) throw new Error(`Invalid ${label}.`);
  return value;
};
const requireWindow = (start, end, label) => {
  if (!validDay(start) || !validDay(end) || start >= end) throw new Error(`Invalid half-open date window for ${label}.`);
};
const ref = (id, key) => ({_type: 'reference', _ref: id, ...(key ? {_key: key} : {})});

/** Pure local conversion. IDs remain unchanged so the GROQ projection round-trips. */
export function toSanityDocuments(snapshot) {
  if (!snapshot || !['objects', 'eras', 'reservations'].every(key => Array.isArray(snapshot[key]))) throw new Error('Expected a complete domain snapshot.');
  const ids = new Set();
  for (const item of [...snapshot.eras, ...snapshot.objects, ...snapshot.reservations]) {
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(item.id) || ids.has(item.id)) throw new Error('Every document needs a unique Sanity-safe id.');
    ids.add(item.id);
  }
  const eras = new Map(snapshot.eras.map(era => [era.id, era]));
  const objects = new Map(snapshot.objects.map(object => [object.id, object]));
  const eraDocs = snapshot.eras.map(era => {
    requireWindow(era.startDate, era.endDate, era.id);
    return {_id: era.id, _type: 'era', name: requireText(era.name, 'era name', 80), startDate: era.startDate, endDate: era.endDate};
  });
  const artifactDocs = snapshot.objects.map(object => {
    if (!['ready', 'needs-repair', 'restoring'].includes(object.restorationStatus)) throw new Error(`Invalid restoration status for ${object.id}.`);
    if (!Array.isArray(object.availableEraIds) || !object.availableEraIds.length || new Set(object.availableEraIds).size !== object.availableEraIds.length || !object.availableEraIds.every(id => eras.has(id))) throw new Error(`Invalid era references for ${object.id}.`);
    return {
      _id: object.id, _type: 'artifact', name: requireText(object.name, 'artifact name', 100), description: requireText(object.description, 'artifact description', 900),
      category: requireText(object.category, 'artifact category', 50), restorationStatus: object.restorationStatus,
      availableEraRefs: object.availableEraIds.map((id, index) => ref(id, `era-${index}`)),
    };
  });
  const reservationDocs = snapshot.reservations.map(reservation => {
    requireWindow(reservation.startDate, reservation.endDate, reservation.id);
    const object = objects.get(reservation.objectId);
    const era = eras.get(reservation.eraId);
    if (!object || !era || !['proposed', 'approved', 'rejected'].includes(reservation.status)) throw new Error(`Invalid reservation references or status for ${reservation.id}.`);
    if (reservation.status !== 'rejected' && (!object.availableEraIds.includes(era.id) || reservation.startDate < era.startDate || reservation.endDate > era.endDate)) throw new Error(`Reservation ${reservation.id} does not fit its available era.`);
    if (reservation.status === 'approved' && object.restorationStatus !== 'ready') throw new Error(`Approved reservation ${reservation.id} uses an unavailable artifact.`);
    if (reservation.status === 'approved' && snapshot.reservations.some(other => other.id !== reservation.id && other.status === 'approved' && other.objectId === reservation.objectId && other.startDate < reservation.endDate && other.endDate > reservation.startDate)) throw new Error(`Approved reservations overlap for ${reservation.objectId}.`);
    const borrower = requireText(reservation.borrower, 'fictional borrower nickname', 40);
    if (borrower.length < 2) throw new Error('Borrower nicknames need at least two characters.');
    return {
      _id: reservation.id, _type: 'reservation', artifactRef: ref(object.id), eraRef: ref(era.id), borrowerNickname: borrower,
      startDay: reservation.startDate, endDay: reservation.endDate, status: reservation.status,
      ...(reservation.rejectionReason ? {rejectionReason: requireText(reservation.rejectionReason, 'rejection explanation', 400)} : {}),
    };
  });
  return [...eraDocs, ...artifactDocs, ...reservationDocs];
}

export const toNdjson = snapshot => `${toSanityDocuments(snapshot).map(doc => JSON.stringify(doc)).join('\n')}\n`;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--output')) throw new Error('Usage: node export-fixture.mjs [--output fixture.ndjson]');
  const ndjson = toNdjson(createInitialSnapshot());
  if (args.length) {
    const ownDirectory = fileURLToPath(new URL('.', import.meta.url));
    const destination = resolve(ownDirectory, args[1]);
    const fromOwnDirectory = relative(ownDirectory, destination);
    if (!fromOwnDirectory || fromOwnDirectory.startsWith('..') || isAbsolute(fromOwnDirectory)) throw new Error('Export destination must be a file inside the sanity directory.');
    await writeFile(destination, ndjson, {encoding: 'utf8', flag: 'wx'});
    process.stderr.write(`Prepared ${toSanityDocuments(createInitialSnapshot()).length} fictional documents locally. No import was performed.\n`);
  } else process.stdout.write(ndjson);
}
