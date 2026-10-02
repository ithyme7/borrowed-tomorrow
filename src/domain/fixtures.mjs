/** Original fictional catalogue; none of these records represents real inventory. */
export const eras = [
  { id: 'clockwork', name: 'The Clockwork Coast · 1896', startDate: '1896-01-01', endDate: '1897-01-01' },
  { id: 'neon', name: 'The Neon Rain · 1986', startDate: '1986-01-01', endDate: '1987-01-01' },
  { id: 'greenhouse', name: 'The Rooftop Greenhouses · 2073', startDate: '2073-01-01', endDate: '2074-01-01' },
  { id: 'orbital', name: 'The Orbital Tea Rooms · 2145', startDate: '2145-01-01', endDate: '2146-01-01' },
  { id: 'afterglow', name: 'The Afterglow Archive · 2301', startDate: '2301-01-01', endDate: '2302-01-01' },
];

export const objects = [
  { id: 'storm-umbrella', name: 'The Weather-Saving Umbrella', category: 'Weathercraft', description: 'Stores one clear afternoon inside its brass ribs. Please return the sunshine.', availableEraIds: ['clockwork', 'neon', 'orbital'], restorationStatus: 'ready' },
  { id: 'whisper-atlas', name: 'The Atlas of Unbuilt Streets', category: 'Wayfinding', description: 'Maps the alleys a city almost built; its margins whisper directions after dusk.', availableEraIds: ['clockwork', 'orbital'], restorationStatus: 'ready' },
  { id: 'moonseed-tin', name: 'The Moonseed Biscuit Tin', category: 'Botany', description: 'A dented tin of seeds that bloom only beneath borrowed moonlight.', availableEraIds: ['greenhouse', 'orbital'], restorationStatus: 'ready' },
  { id: 'yesterday-camera', name: 'The Yesterday Camera', category: 'Memory', description: 'Photographs the room exactly one day ago. Its shutter currently remembers too much.', availableEraIds: ['neon', 'greenhouse'], restorationStatus: 'needs-repair' },
  { id: 'comet-kettle', name: 'The Comet-Tail Kettle', category: 'Tea rituals', description: 'Steeps tea at the temperature of a passing comet. The handle is being carefully restored.', availableEraIds: ['orbital', 'afterglow'], restorationStatus: 'restoring' },
  { id: 'bookmark-moth', name: 'The Mechanical Bookmark Moth', category: 'Reading companions', description: 'Finds the page you meant to read, then folds its copper wings and waits.', availableEraIds: ['clockwork', 'neon', 'greenhouse', 'afterglow'], restorationStatus: 'ready' },
];

export const reservations = [
  { id: 'loan-rain-01', objectId: 'storm-umbrella', eraId: 'clockwork', borrower: 'Mara, cloud cartographer', startDate: '1896-05-04', endDate: '1896-05-08', status: 'approved' },
  { id: 'loan-atlas-02', objectId: 'whisper-atlas', eraId: 'clockwork', borrower: 'The midnight post office', startDate: '1896-05-11', endDate: '1896-05-15', status: 'approved' },
  { id: 'loan-seed-03', objectId: 'moonseed-tin', eraId: 'greenhouse', borrower: 'Saffron, rooftop gardener', startDate: '2073-06-01', endDate: '2073-06-05', status: 'approved' },
  { id: 'proposal-rain-04', objectId: 'storm-umbrella', eraId: 'clockwork', borrower: 'The lantern parade', startDate: '1896-05-06', endDate: '1896-05-09', status: 'proposed' },
  { id: 'proposal-atlas-05', objectId: 'whisper-atlas', eraId: 'orbital', borrower: 'Ivo, station archivist', startDate: '2145-07-16', endDate: '2145-07-20', status: 'proposed' },
  { id: 'declined-camera-06', objectId: 'yesterday-camera', eraId: 'neon', borrower: 'The lost-and-found detective', startDate: '1986-09-02', endDate: '1986-09-06', status: 'rejected', rejectionReason: 'The shutter needs repair before another journey.' },
];

export const INITIAL_SNAPSHOT = { objects, eras, reservations };

/** Return fresh arrays and records so a frontend cannot alter the baseline fixture. */
export function createInitialSnapshot() {
  return {
    objects: objects.map(item => ({ ...item, availableEraIds: [...item.availableEraIds] })),
    eras: eras.map(era => ({ ...era })),
    reservations: reservations.map(reservation => ({ ...reservation })),
  };
}
