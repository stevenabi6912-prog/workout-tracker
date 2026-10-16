import { roundToStep } from './units.js';

// Double progression: work within a rep range at a fixed weight. Once every working set
// reaches the top of the range, add weight and start again at the bottom.
//
// Returns null when there is no history for the exercise, otherwise
// { fromLb, toLb, reason, kind: 'increase' | 'hold' | 'decrease' }
export function suggestWeight({ slot, exercise, lastEntry, settings, lastSetsOverride }) {
  const sets = (lastSetsOverride || lastEntry?.sets || []).filter((s) => s.done && s.reps > 0 && s.weightLb != null);
  if (!sets.length) return null;

  // Use the heaviest weight the lifter worked with last time as the baseline.
  const fromLb = Math.max(...sets.map((s) => s.weightLb));
  const working = sets.filter((s) => s.weightLb === fromLb);
  const inc = incrementFor(exercise, settings);

  const hitTop = working.length >= Math.min(slot.sets, working.length) && working.every((s) => s.reps >= slot.repMax) && working.length >= slot.sets;
  if (hitTop) {
    return {
      fromLb,
      toLb: roundToStep(fromLb + inc, 2.5),
      kind: 'increase',
      reason: `Hit ${slot.sets}×${slot.repMax} at ${fromLb}. Add ${inc}.`,
    };
  }
  const missedBottom = working.some((s) => s.reps < slot.repMin);
  if (missedBottom && working.length >= slot.sets) {
    return {
      fromLb,
      toLb: fromLb,
      kind: 'hold',
      reason: `Missed ${slot.repMin} reps on a set. Stay at ${fromLb} and build back up.`,
    };
  }
  return {
    fromLb,
    toLb: fromLb,
    kind: 'hold',
    reason: `Stay at ${fromLb}. Aim for ${slot.sets}×${slot.repMax} before adding weight.`,
  };
}

export function incrementFor(exercise, settings) {
  if (exercise?.incrementLb != null && exercise.incrementLb > 0) return exercise.incrementLb;
  const inc = settings?.increments || { lower: 5, upper: 2.5 };
  return exercise?.region === 'lower' ? inc.lower : inc.upper;
}
