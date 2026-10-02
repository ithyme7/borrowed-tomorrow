import {defineArrayMember, defineField, defineType, type ValidationContext} from 'sanity'

export const API_VERSION = '2025-02-19'

type Reference = {_type: 'reference'; _ref: string}
type ReservationDocument = {
  _id?: string
  artifactRef?: Reference
  eraRef?: Reference
  borrowerNickname?: string
  startDay?: string
  endDay?: string
  status?: 'proposed' | 'approved' | 'rejected'
}
type AvailabilityResult = {
  artifact?: {restorationStatus?: string; availableEraRefs?: Reference[]}
  era?: {startDate?: string; endDate?: string}
  conflicts?: {_id: string}[]
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const canonicalId = (id: string) => id.replace(/^drafts\./, '')
const isDay = (value: unknown): value is string => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false
  const day = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value
}
const validDay = (value: unknown) => value === undefined || isDay(value) || 'Use a real calendar date in YYYY-MM-DD format.'
const trimmedText = (value: unknown) => value === undefined || (typeof value === 'string' && value.trim().length > 0 && value === value.trim()) || 'Use nonempty text without surrounding whitespace.'

async function validateReservation(value: unknown, context: ValidationContext): Promise<true | string> {
  const doc = value as ReservationDocument | undefined
  if (!doc?.artifactRef?._ref || !doc.eraRef?._ref || !isDay(doc.startDay) || !isDay(doc.endDay)) return true
  if (doc.endDay <= doc.startDay) return 'The return day must be after the departure day. Loans use [departure, return), so another borrower may depart on the return day.'
  // Rejected requests keep their history; only valid dates and references are required.
  if (doc.status === 'rejected') return true
  const artifactId = canonicalId(doc.artifactRef._ref)
  const eraId = canonicalId(doc.eraRef._ref)
  const ownId = canonicalId(doc._id || '')
  try {
    const client = context.getClient({apiVersion: API_VERSION}).withConfig({perspective: 'raw', useCdn: false})
    const result = await client.fetch<AvailabilityResult>(`{
      "artifact": coalesce(*[_type == "artifact" && _id == $artifactDraft][0], *[_type == "artifact" && _id == $artifactId][0]) {restorationStatus, availableEraRefs},
      "era": coalesce(*[_type == "era" && _id == $eraDraft][0], *[_type == "era" && _id == $eraId][0]) {startDate, endDate},
      "conflicts": *[_type == "reservation" && status == "approved" && artifactRef._ref in $artifactIds && !(_id in $selfIds) && startDay < $end && endDay > $start] {_id}
    }`, {
      artifactId, artifactDraft: `drafts.${artifactId}`, eraId, eraDraft: `drafts.${eraId}`,
      artifactIds: [artifactId, `drafts.${artifactId}`], selfIds: [ownId, `drafts.${ownId}`], start: doc.startDay, end: doc.endDay,
    })
    if (!result.artifact || !result.era) return 'Publish or complete the referenced artifact and era before reviewing this request.'
    if (!result.artifact.availableEraRefs?.some(ref => canonicalId(ref._ref) === eraId)) return 'This artifact is not offered in the selected era.'
    if (!isDay(result.era.startDate) || !isDay(result.era.endDate)) return 'The selected era needs valid start and end dates.'
    if (doc.startDay < result.era.startDate || doc.endDay > result.era.endDate) return 'The complete loan must fit inside the selected era.'
    if (doc.status === 'approved' && result.artifact.restorationStatus !== 'ready') return 'An artifact must be ready before a request can be approved.'
    if (doc.status === 'approved' && result.conflicts?.length) return 'This artifact already has an approved loan in this window. The return day is excluded; back-to-back loans are allowed.'
    return true
  } catch {
    return 'Availability could not be checked. Reconnect and retry before publishing this request.'
  }
}

export const era = defineType({
  name: 'era', title: 'Era', type: 'document',
  description: 'A fictional destination. Its available window is [first day, closing day), with closing day excluded.',
  fields: [
    defineField({name: 'name', type: 'string', validation: rule => rule.required().max(80).custom(trimmedText)}),
    defineField({name: 'startDate', type: 'date', title: 'First available day', validation: rule => rule.required().custom(validDay)}),
    defineField({name: 'endDate', type: 'date', title: 'Closing day (exclusive)', validation: rule => rule.required().custom(validDay)}),
  ],
  validation: rule => rule.custom(value => {
    const doc = value as {startDate?: string; endDate?: string} | undefined
    return !doc || !isDay(doc.startDate) || !isDay(doc.endDate) || doc.endDate > doc.startDate || 'An era must close after its first available day.'
  }),
  preview: {select: {title: 'name', start: 'startDate', end: 'endDate'}, prepare: ({title, start, end}) => ({title, subtitle: `${start || '?'} → ${end || '?'}`})},
})

export const artifact = defineType({
  name: 'artifact', title: 'Artifact', type: 'document',
  description: 'An object that may travel to one or more referenced eras.',
  initialValue: {restorationStatus: 'ready'},
  fields: [
    defineField({name: 'name', type: 'string', validation: rule => rule.required().max(100).custom(trimmedText)}),
    defineField({name: 'description', type: 'text', rows: 4, validation: rule => rule.required().max(900).custom(trimmedText)}),
    defineField({name: 'category', type: 'string', description: 'A short category such as navigation, music, or domestic life.', validation: rule => rule.required().max(50).custom(trimmedText)}),
    defineField({name: 'availableEraRefs', title: 'Available eras', type: 'array', of: [defineArrayMember({type: 'reference', to: [{type: 'era'}]})], validation: rule => rule.required().min(1).unique()}),
    defineField({name: 'restorationStatus', title: 'Restoration status', type: 'string', options: {list: [{title: 'Ready to lend', value: 'ready'}, {title: 'Needs repair', value: 'needs-repair'}, {title: 'Restoring', value: 'restoring'}], layout: 'radio'}, validation: rule => rule.required().custom(value => value === undefined || ['ready', 'needs-repair', 'restoring'].includes(value) || 'Choose a listed restoration status.')}),
  ],
  preview: {select: {title: 'name', status: 'restorationStatus', category: 'category'}, prepare: ({title, status, category}) => ({title, subtitle: `${category || ''} · ${status || 'missing status'}`})},
})

export const reservation = defineType({
  name: 'reservation', title: 'Reservation', type: 'document',
  description: 'Review a proposed fictional loan. Approval checks readiness, era bounds, and half-open date conflicts in Studio; it is not a server transaction.',
  initialValue: {status: 'proposed'},
  fields: [
    defineField({name: 'artifactRef', title: 'Artifact', type: 'reference', to: [{type: 'artifact'}], validation: rule => rule.required()}),
    defineField({name: 'eraRef', title: 'Destination era', type: 'reference', to: [{type: 'era'}], validation: rule => rule.required()}),
    defineField({name: 'borrowerNickname', title: 'Fictional borrower nickname', type: 'string', description: 'Use invented nicknames only. Do not enter real names or contact details.', validation: rule => rule.required().min(2).max(40).custom(trimmedText)}),
    defineField({name: 'startDay', title: 'Departure day (inclusive)', type: 'date', validation: rule => rule.required().custom(validDay)}),
    defineField({name: 'endDay', title: 'Return day (exclusive)', type: 'date', validation: rule => rule.required().custom(validDay)}),
    defineField({name: 'status', title: 'Review outcome', type: 'string', options: {list: [{title: 'Proposed — awaiting review', value: 'proposed'}, {title: 'Approved — reserves the object', value: 'approved'}, {title: 'Rejected — keeps the request history', value: 'rejected'}], layout: 'radio'}, validation: rule => rule.required().custom(value => value === undefined || ['proposed', 'approved', 'rejected'].includes(value) || 'Choose a listed review status.')}),
    defineField({name: 'rejectionReason', title: 'Rejection explanation (optional)', type: 'text', rows: 2, description: 'A short fictional explanation retained with a rejected request.', validation: rule => rule.max(400)}),
  ],
  validation: rule => rule.custom(validateReservation),
  preview: {select: {borrower: 'borrowerNickname', artifactName: 'artifactRef.name', status: 'status', start: 'startDay', end: 'endDay'}, prepare: ({borrower, artifactName, status, start, end}) => ({title: `${borrower || 'New borrower'} · ${artifactName || 'Choose artifact'}`, subtitle: `${status || 'proposed'} · ${start || '?'} → ${end || '?'}`})},
})

export const schemaTypes = [era, artifact, reservation]
