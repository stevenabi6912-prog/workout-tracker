import { describe, it, expect } from 'vitest';
import { workoutVolume, exerciseSeries, weeklyLifting, weeklyCardio, fillWeeks } from '../src/domain/stats.js';

const s = (weightLb, reps, done = true) => ({ weightLb, reps, done });

describe('stats', () => {
  it('sums volume over done sets', () => {
    const w = { status: 'done', entries: [{ exerciseId: 'a', sets: [s(100, 10), s(100, 10, false)] }] };
    expect(workoutVolume(w)).toBe(1000);
  });
  it('builds per-exercise series sorted by date', () => {
    const ws = [
      { id: '2', date: '2026-02-01', status: 'done', entries: [{ exerciseId: 'a', sets: [s(110, 8)] }] },
      { id: '1', date: '2026-01-01', status: 'done', entries: [{ exerciseId: 'a', sets: [s(100, 8), s(100, 8)] }] },
    ];
    const series = exerciseSeries(ws, 'a');
    expect(series.map((p) => p.topWeight)).toEqual([100, 110]);
    expect(series[0].volume).toBe(1600);
  });
  it('aggregates weekly lifting and cardio', () => {
    const ws = [
      { date: '2026-10-12', status: 'done', entries: [{ sets: [s(100, 10)] }] },
      { date: '2026-10-15', status: 'done', entries: [{ sets: [s(100, 10)] }] },
      { date: '2026-10-19', status: 'done', entries: [] },
    ];
    const lift = weeklyLifting(ws);
    expect(lift).toEqual([{ week: '2026-10-12', workouts: 2, volume: 2000 }, { week: '2026-10-19', workouts: 1, volume: 0 }]);
    const cardio = weeklyCardio([{ date: '2026-10-13', durationSec: 600, distanceMi: 2 }, { date: '2026-10-14', durationSec: 1200, distanceMi: 1 }]);
    expect(cardio[0]).toEqual({ week: '2026-10-12', sessions: 2, minutes: 30, miles: 3 });
  });
  it('fills missing weeks', () => {
    const rows = fillWeeks([{ week: '2026-10-19', workouts: 1 }], '2026-10-19', 3, () => ({ workouts: 0 }));
    expect(rows.map((r) => r.week)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(rows[2].workouts).toBe(1);
  });
});
