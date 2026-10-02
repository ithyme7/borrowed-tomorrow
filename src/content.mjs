// Public Sanity content reads only. No write token or cloud mutation in the browser.
// The project must be owned and configured by the user before a live claim is made.
import { SNAPSHOT_QUERY, SANITY_API_VERSION } from '../sanity/snapshot-query.mjs';
import { validateCatalogue } from './catalogue-validation.mjs';

export async function loadCatalogue(fallback) {
  const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
  const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';
  if (!projectId) return {snapshot:fallback,label:'Local fixture catalogue · Sanity not connected',detail:'Fictional sample content. Proposals stay in this tab.'};
  if (!/^[a-z0-9]+$/.test(projectId) || !/^[a-zA-Z0-9_-]+$/.test(dataset)) throw new Error('Invalid public content configuration.');
  const url = new URL(`https://${projectId}.api.sanity.io/v${SANITY_API_VERSION}/data/query/${dataset}`);
  url.searchParams.set('query', SNAPSHOT_QUERY);
  url.searchParams.set('perspective','published');
  const response = await fetch(url,{credentials:'omit',signal:AbortSignal.timeout(10000)});
  if (!response.ok) throw new Error('Sanity public query failed.');
  const {result} = await response.json();
  validateCatalogue(result);
  return {snapshot:result,label:`Public Sanity catalogue · ${projectId}/${dataset}`,detail:'Loaded from published documents. Approvals below are local rehearsals.'};
}
