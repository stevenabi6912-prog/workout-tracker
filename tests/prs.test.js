import { describe, it, expect } from 'vitest';
import { e1rm, bestsFromWorkouts, classifySet, markPRs } from '../src/domain/prs.js';

const w = (id, date, exId, sets) => ({ id, date, status: 'done', entries: [{ exerciseId: exId, sets }] });
const s = (weightLb, reps, done = true) => ({ weightLb, reps, done });

describe('prs', () => {
  it('estimates 1RM with Epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 10)).toBeCloseTo(133.33, 1);
  });
  it('builds bests from done workouts only', () => {
    const prior = [w('a', '2026-01-01', 'sq', [s(185, 5), s(185, 5)]), { ...w('b', '2026-01-03', 'sq', [s(300, 1)]), status: 'in_progress' }];
    const b = bestsFromWorkouts(prior, 'sq');
    expect(b.bestWeight).toBe(185);
    expect(b.bestAtReps.get(5)).toBe(185);
    expect(b.bestAtReps.get(3)).toBe(185);
  });
  it('classifies weight, e1rm and rep PRs', () => {
    const b = bestsFromWorkouts([w('a', '2026-01-01', 'sq', [s(185, 5)])], 'sq');
    expect(classifySet(s(190, 3), b)).toBe('weight');
    expect(classifySet(s(185, 7), b)).toBe('e1rm');
    expect(classifySet(s(185, 5), b)).toBeNull();
    expect(classifySet(s(185, 4), b)).toBeNull();
    expect(classifySet(s(100, 5, false), b)).toBeNull();
  });
  it('marks PRs within a workout in order', () => {
    const prior = [w('a', '2026-01-01', 'sq', [s(185, 5)])];
    const cur = w('c', '2026-01-08', 'sq', [s(190, 5), s(190, 5), s(195, 3)]);
    markPRs(cur, [...prior, cur]);
    const sets = cur.entries[0].sets;
    expect(sets[0].pr).toBe('weight');
    expect(sets[1].pr).toBeNull();
    expect(sets[2].pr).toBe('weight');
  });
});
