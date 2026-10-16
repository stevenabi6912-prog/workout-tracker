import * as repo from '../db/repo.js';
import { suggestWeight } from './progression.js';
import { markPRs } from './prs.js';
import { today } from './dates.js';

// Most recent done entry for an exercise (workouts sorted newest first).
export function findLastEntry(workoutsDesc, exerciseId, { excludeId } = {}) {
  for (const w of workoutsDesc) {
    if (w.status !== 'done' || w.id === excludeId) continue;
    const e = (w.entries || []).find((x) => x.exerciseId === exerciseId && (x.sets || []).some((s) => s.done));
    if (e) return { entry: e, workout: w };
  }
  return null;
}

export function sortDesc(workouts) {
  return [...workouts].sort((a, b) => (b.date + (b.startedAt || '')).localeCompare(a.date + (a.startedAt || '')));
}

// Preview suggestions for a routine day without creating anything.
export function previewDay({ routineDay, exercises, workoutsDesc, settings }) {
  const exById = new Map(exercises.map((e) => [e.id, e]));
  return routineDay.slots.map((slot) => {
    const exercise = exById.get(slot.exerciseId);
    const last = findLastEntry(workoutsDesc, slot.exerciseId);
    const suggestion = last ? suggestWeight({ slot, exercise, lastEntry: last.entry, settings }) : null;
    return { slot, exercise, last, suggestion };
  });
}

// Build and persist a new in-progress workout from a routine day.
// accepted: Set of slot ids whose increase suggestion is accepted (default: all).
export async function startWorkout({ profile, routine, routineDay, date = today(), exercises, workoutsDesc, accepted = null }) {
  const preview = previewDay({ routineDay, exercises, workoutsDesc, settings: profile.settings });
  const entries = preview.map(({ slot, exercise, last, suggestion }) => {
    const useSuggestion = suggestion && suggestion.kind === 'increase' && (accepted === null || accepted.has(slot.id));
    const weight = useSuggestion ? suggestion.toLb : suggestion ? suggestion.fromLb : null;
    const lastSets = last ? last.entry.sets.filter((s) => s.done) : [];
    const sets = Array.from({ length: slot.sets }, (_, i) => ({
      weightLb: weight ?? lastSets[i]?.weightLb ?? null,
      reps: lastSets[i]?.reps ?? null,
      targetReps: slot.repMax,
      done: false,
      pr: null,
    }));
    return {
      id: repo.uid(),
      exerciseId: exercise?.id || slot.exerciseId,
      slotId: slot.id,
      target: { sets: slot.sets, repMin: slot.repMin, repMax: slot.repMax, restSec: slot.restSec },
      suggestion: suggestion ? { ...suggestion, accepted: !!useSuggestion } : null,
      notes: '',
      sets,
    };
  });
  const workout = {
    id: repo.uid(),
    profileId: profile.id,
    date,
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'in_progress',
    routineId: routine?.id || null,
    routineDayId: routineDay?.id || null,
    label: routineDay?.label || 'Workout',
    finisher: routineDay?.finisher ? { ...routineDay.finisher } : null,
    entries,
    notes: '',
    source: 'app',
    externalId: null,
  };
  await repo.saveWorkout(workout);
  return workout;
}

export async function startBlankWorkout({ profile, date = today(), label = 'Workout' }) {
  const workout = {
    id: repo.uid(), profileId: profile.id, date, startedAt: new Date().toISOString(), endedAt: null,
    status: 'in_progress', routineId: null, routineDayId: null, label, finisher: null, entries: [], notes: '', source: 'app', externalId: null,
  };
  await repo.saveWorkout(workout);
  return workout;
}

export async function finishWorkout(workout) {
  const all = await repo.getWorkouts(workout.profileId);
  const prior = all.filter((w) => w.id !== workout.id && w.status === 'done' && (w.date < workout.date || (w.date === workout.date && (w.startedAt || '') < (workout.startedAt || ''))));
  // Drop sets that were never filled in.
  for (const e of workout.entries) e.sets = e.sets.filter((s) => s.done || s.reps || s.weightLb);
  markPRs(workout, prior);
  workout.status = 'done';
  workout.endedAt = workout.endedAt || new Date().toISOString();
  await repo.saveWorkout(workout);
  return workout;
}
