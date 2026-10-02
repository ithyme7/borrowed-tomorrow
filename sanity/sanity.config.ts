import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemaTypes'

// Nonsecret values only. No example project is silently used as a real connection.
const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET
if (!projectId || !/^[a-z0-9]{1,40}$/.test(projectId) || !dataset || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(dataset)) {
  throw new Error('Studio is not connected. Set the actual SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET in .env.local. The frontend fixture demo does not require Studio.')
}

export default defineConfig({
  name: 'borrowed-tomorrow', title: 'Borrowed Tomorrow — editorial desk', projectId, dataset,
  schema: {types: schemaTypes},
  plugins: [structureTool({structure: S => S.list().title('Time library').items([
    S.documentTypeListItem('era').title('Destination eras'),
    S.documentTypeListItem('artifact').title('Artifacts and restoration'),
    S.divider(),
    S.listItem().title('Proposed loans').child(S.documentList().title('Proposed loans').filter('_type == "reservation" && status == "proposed"')),
    S.listItem().title('Approved loans').child(S.documentList().title('Approved loans').filter('_type == "reservation" && status == "approved"')),
    S.listItem().title('Rejected requests').child(S.documentList().title('Rejected requests').filter('_type == "reservation" && status == "rejected"')),
  ])})],
})
