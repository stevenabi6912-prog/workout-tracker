import * as db from './db.js';
import { PROFILE_STORES } from './schema.js';
import { buildExercises, buildRoutines, DEFAULT_SETTINGS } from '../domain/seed.js';

const { uid } = db;
export { uid };

// ---- Profiles ----
export const listProfiles = () => db.all('profiles').then((p) => p.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
export const getProfile = (id) => db.get('profiles', id);
export const saveProfile = (p) => db.put('profiles', p);

export async function createProfile({ name, goalWeightLb = null, startWeightLb = null, units } = {}) {
  const profileId = uid();
  const exercises = buildExercises(profileId, uid);
  const routines = buildRoutines(profileId, exercises, uid);
  const standard = routines.find((r) => r.mode === 'standard') || routines[0];
  const profile = {
    id: profileId,
    name: name || 'New profile',
    goalWeightLb,
    startWeightLb,
    units: { weight: 'lb', distance: 'mi', ...(units || {}) },
    settings: { ...DEFAULT_SETTINGS, increments: { ...DEFAULT_SETTINGS.increments }, trainingDays: [...standard.trainingDays], activeRoutineId: standard.id },
    createdAt: new Date().toISOString(),
  };
  await db.bulkPut('exercises', exercises);
  await db.bulkPut('routines', routines);
  await db.put('profiles', profile);
  return profile;
}

export async function deleteProfile(id) {
  for (const store of PROFILE_STORES) await db.clearProfile(store, id);
  await db.del('profiles', id);
}

export async function clearProfileData(id, stores = ['plans', 'workouts', 'cardio', 'bodyweight', 'hrDaily']) {
  for (const store of stores) await db.clearProfile(store, id);
}

// ---- Exercises ----
export const getExercises = (profileId) => db.byProfile('exercises', profileId).then((l) => l.sort((a, b) => a.name.localeCompare(b.name)));
export const getExercise = (id) => db.get('exercises', id);
export const saveExercise = (e) => db.put('exercises', e);
export const deleteExercise = (id) => db.del('exercises', id);

// ---- Routines ----
export const getRoutines = (profileId) => db.byProfile('routines', profileId);
export const getRoutine = (id) => db.get('routines', id);
export const saveRoutine = (r) => db.put('routines', r);
export const deleteRoutine = (id) => db.del('routines', id);

// ---- Plans (schedule overrides) ----
export const getPlans = (profileId, from, to) => db.byProfileDate('plans', profileId, from, to);
export async function setPlan(profileId, date, routineDayId, routineId) {
  const existing = await db.byIndex('plans', 'profileDate', [profileId, date]);
  const plan = { id: existing[0]?.id || uid(), profileId, date, routineDayId, routineId };
  return db.put('plans', plan);
}
export async function clearPlan(profileId, date) {
  const existing = await db.byIndex('plans', 'profileDate', [profileId, date]);
  await db.bulkDel('plans', existing.map((p) => p.id));
}

// ---- Workouts ----
export const getWorkouts = (profileId, from, to) => db.byProfileDate('workouts', profileId, from, to);
export const getWorkout = (id) => db.get('workouts', id);
export const saveWorkout = (w) => db.put('workouts', w);
export const deleteWorkout = (id) => db.del('workouts', id);
export async function getInProgressWorkout(profileId) {
  const list = await db.byProfile('workouts', profileId);
  return list.filter((w) => w.status === 'in_progress').sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
}

// ---- Cardio ----
export const getCardio = (profileId, from, to) => db.byProfileDate('cardio', profileId, from, to);
export const getCardioEntry = (id) => db.get('cardio', id);
export const saveCardio = (c) => db.put('cardio', c);
export const deleteCardio = (id) => db.del('cardio', id);

// ---- Body weight ----
export const getBodyweight = (profileId, from, to) => db.byProfileDate('bodyweight', profileId, from, to).then((l) => l.sort((a, b) => a.date.localeCompare(b.date) || (a.at || '').localeCompare(b.at || '')));
export const saveBodyweight = (b) => db.put('bodyweight', b);
export const deleteBodyweight = (id) => db.del('bodyweight', id);

// ---- Heart rate daily ----
export const getHrDaily = (profileId, from, to) => db.byProfileDate('hrDaily', profileId, from, to);

// ---- Meta ----
export const getMeta = (key) => db.get('meta', key).then((r) => r?.value);
export const setMeta = (key, value) => db.put('meta', { key, value });

// ---- Bulk (import) ----
export const bulkPut = db.bulkPut;
export const existingExternalIds = async (store, profileId) => {
  const rows = await db.byProfile(store, profileId);
  return new Set(rows.map((r) => r.externalId).filter(Boolean));
};
export const allForProfile = (store, profileId) => db.byProfile(store, profileId);
export const clearProfileStore = db.clearProfile;
