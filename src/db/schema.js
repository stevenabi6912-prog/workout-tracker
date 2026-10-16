export const DB_NAME = 'workout-tracker';
export const DB_VERSION = 1;

// store -> { keyPath, indexes: [{ name, keyPath, unique }] }
export const STORES = {
  profiles: { keyPath: 'id', indexes: [] },
  exercises: { keyPath: 'id', indexes: [{ name: 'profileId', keyPath: 'profileId' }] },
  routines: { keyPath: 'id', indexes: [{ name: 'profileId', keyPath: 'profileId' }] },
  plans: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileDate', keyPath: ['profileId', 'date'] },
    ],
  },
  workouts: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileDate', keyPath: ['profileId', 'date'] },
      { name: 'externalId', keyPath: 'externalId' },
    ],
  },
  cardio: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileDate', keyPath: ['profileId', 'date'] },
      { name: 'externalId', keyPath: 'externalId' },
    ],
  },
  bodyweight: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileDate', keyPath: ['profileId', 'date'] },
      { name: 'externalId', keyPath: 'externalId' },
    ],
  },
  hrDaily: {
    keyPath: 'id',
    indexes: [
      { name: 'profileId', keyPath: 'profileId' },
      { name: 'profileDate', keyPath: ['profileId', 'date'] },
    ],
  },
  meta: { keyPath: 'key', indexes: [] },
};

export const PROFILE_STORES = ['exercises', 'routines', 'plans', 'workouts', 'cardio', 'bodyweight', 'hrDaily'];
