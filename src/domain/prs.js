// Estimated one-rep max (Epley). Reps capped so very high rep sets don't produce silly numbers.
export function e1rm(weightLb, reps) {
  if (!weightLb || !reps) return 0;
  const r = Math.min(reps, 15);
  return r === 1 ? weightLb : weightLb * (1 + r / 30);
}

// Build a "best so far" table for one exercise from prior workouts (status done).
// Returns { bestE1rm, bestWeight, bestAtReps: Map<reps, weight> }
export function bestsFromWorkouts(workouts, exerciseId, { before } = {}) {
  const bests = { bestE1rm: 0, bestWeight: 0, bestAtReps: new Map() };
  for (const w of workouts) {
    if (w.status !== 'done') continue;
    if (before && w.id === before) continue;
    for (const entry of w.entries || []) {
      if (entry.exerciseId !== exerciseId) continue;
      for (const s of entry.sets || []) {
        if (!s.done || !s.reps || s.weightLb == null) continue;
        bests.bestE1rm = Math.max(bests.bestE1rm, e1rm(s.weightLb, s.reps));
        bests.bestWeight = Math.max(bests.bestWeight, s.weightLb);
        // Best weight at >= this many reps counts as a record at this rep count.
        for (let r = 1; r <= s.reps; r++) {
          const cur = bests.bestAtReps.get(r) || 0;
          if (s.weightLb > cur) bests.bestAtReps.set(r, s.weightLb);
        }
      }
    }
  }
  return bests;
}

// Classify a set against the bests. Returns 'weight' | 'e1rm' | 'reps' | null.
export function classifySet(set, bests) {
  if (!set.done || !set.reps || set.weightLb == null || set.weightLb <= 0) return null;
  if (set.weightLb > bests.bestWeight) return 'weight';
  const est = e1rm(set.weightLb, set.reps);
  if (est > bests.bestE1rm + 0.01) return 'e1rm';
  const atReps = bests.bestAtReps.get(set.reps) || 0;
  if (set.weightLb > atReps) return 'reps';
  return null;
}

// Mark PRs across a workout's entries, considering sets within the same workout in order.
export function markPRs(workout, priorWorkouts) {
  for (const entry of workout.entries || []) {
    const bests = bestsFromWorkouts(priorWorkouts, entry.exerciseId, { before: workout.id });
    for (const s of entry.sets || []) {
      s.pr = classifySet(s, bests);
      if (s.done && s.reps && s.weightLb != null) {
        bests.bestE1rm = Math.max(bests.bestE1rm, e1rm(s.weightLb, s.reps));
        bests.bestWeight = Math.max(bests.bestWeight, s.weightLb);
        for (let r = 1; r <= s.reps; r++) {
          if (s.weightLb > (bests.bestAtReps.get(r) || 0)) bests.bestAtReps.set(r, s.weightLb);
        }
      }
    }
  }
  return workout;
}
