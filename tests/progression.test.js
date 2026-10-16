import { describe, it, expect } from 'vitest';
import { suggestWeight, incrementFor } from '../src/domain/progression.js';

const settings = { increments: { lower: 5, upper: 2.5 } };
const slot = { sets: 3, repMin: 6, repMax: 8 };
const squat = { region: 'lower' };
const bench = { region: 'upper' };
const sets = (w, ...reps) => reps.map((r) => ({ weightLb: w, reps: r, done: true }));

describe('suggestWeight', () => {
  it('returns null with no history', () => {
    expect(suggestWeight({ slot, exercise: squat, lastEntry: null, settings })).toBeNull();
    expect(suggestWeight({ slot, exercise: squat, lastEntry: { sets: [] }, settings })).toBeNull();
  });
  it('suggests +5 lower body when all sets hit the top of the range', () => {
    const s = suggestWeight({ slot, exercise: squat, lastEntry: { sets: sets(185, 8, 8, 8) }, settings });
    expect(s.kind).toBe('increase');
    expect(s.toLb).toBe(190);
  });
  it('suggests +2.5 upper body', () => {
    const s = suggestWeight({ slot, exercise: bench, lastEntry: { sets: sets(135, 8, 9, 8) }, settings });
    expect(s.toLb).toBe(137.5);
  });
  it('holds when a set is below the top', () => {
    const s = suggestWeight({ slot, exercise: squat, lastEntry: { sets: sets(185, 8, 8, 7) }, settings });
    expect(s.kind).toBe('hold');
    expect(s.toLb).toBe(185);
  });
  it('holds and explains when a set missed the bottom of the range', () => {
    const s = suggestWeight({ slot, exercise: squat, lastEntry: { sets: sets(185, 6, 5, 5) }, settings });
    expect(s.kind).toBe('hold');
    expect(s.reason).toMatch(/Missed 6/);
  });
  it('does not increase when fewer sets than prescribed were done', () => {
    const s = suggestWeight({ slot, exercise: squat, lastEntry: { sets: sets(185, 8, 8) }, settings });
    expect(s.kind).toBe('hold');
  });
  it('ignores undone sets and uses the heaviest weight as baseline', () => {
    const last = { sets: [...sets(135, 8), ...sets(185, 8, 8, 8), { weightLb: 200, reps: 0, done: false }] };
    const s = suggestWeight({ slot, exercise: squat, lastEntry: last, settings });
    expect(s.fromLb).toBe(185);
    expect(s.toLb).toBe(190);
  });
  it('uses a per-exercise increment override', () => {
    expect(incrementFor({ region: 'upper', incrementLb: 10 }, settings)).toBe(10);
    expect(incrementFor({ region: 'upper' }, settings)).toBe(2.5);
    expect(incrementFor({ region: 'lower' }, settings)).toBe(5);
  });
});
