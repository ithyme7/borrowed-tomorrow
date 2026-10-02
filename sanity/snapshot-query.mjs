// Published documents only. Domain ids are actual Sanity _ids, not display labels.
export const SANITY_API_VERSION = '2025-02-19';
export const SNAPSHOT_QUERY = `{
  "objects": *[_type == "artifact"] | order(name asc) {
    "id": _id, name, description, category,
    "availableEraIds": availableEraRefs[]._ref,
    restorationStatus
  },
  "eras": *[_type == "era"] | order(startDate asc, name asc) {
    "id": _id, name, startDate, endDate
  },
  "reservations": *[_type == "reservation"] | order(startDay asc, _id asc) {
    "id": _id,
    "objectId": artifactRef._ref,
    "eraId": eraRef._ref,
    "borrower": borrowerNickname,
    "startDate": startDay,
    "endDate": endDay,
    status,
    defined(rejectionReason) => {rejectionReason}
  }
}`;

/** Build-time, read-only fetch. Deliberately no token or cloud-write methods. */
export async function fetchPublishedSnapshot({projectId, dataset, fetchImpl = globalThis.fetch}) {
  if (!/^[a-z0-9]{1,40}$/.test(projectId || '')) throw new Error('Configure an actual Sanity project ID.');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(dataset || '')) throw new Error('Configure an actual Sanity dataset name.');
  if (typeof fetchImpl !== 'function') throw new Error('This build needs a runtime with fetch support.');
  const endpoint = new URL(`https://${projectId}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}`);
  endpoint.searchParams.set('query', SNAPSHOT_QUERY);
  endpoint.searchParams.set('perspective', 'published');
  const response = await fetchImpl(endpoint, {headers: {Accept: 'application/json'}, signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Sanity read failed with HTTP ${response.status}. No fixture fallback was applied.`);
  const body = await response.json();
  if (body.error || !body.result || !['objects', 'eras', 'reservations'].every(key => Array.isArray(body.result[key]))) throw new Error('Sanity returned an invalid snapshot. No fixture fallback was applied.');
  return body.result;
}
