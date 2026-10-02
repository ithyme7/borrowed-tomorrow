import {defineCliConfig} from 'sanity/cli'

const projectId = process.env.SANITY_STUDIO_PROJECT_ID
const dataset = process.env.SANITY_STUDIO_DATASET
if (!projectId || !dataset) throw new Error('Set the actual Sanity project and dataset before using Studio CLI commands.')

export default defineCliConfig({api: {projectId, dataset}})
