import 'fake-indexeddb/auto';
import { describe, it, expect, beforeAll } from 'vitest';
import * as repo from '../src/db/repo.js';
import { exportProfile, exportAll, importBackup, validateBackup } from '../src/import/backup.js';
import { commitHealthImport } from '../src/import/health-import.js';

if (!globalThis.crypto?.randomUUID) globalThis.crypto = { randomUUID: () => Math.random().toString(36).slice(2) };

describe('backup and import', () => {
  let profile;
  beforeAll(async () => {
    profile = await repo.createProfile({ name: 'Test', goalWeightLb: 180 });
    await repo.saveBodyweight({ id: repo.uid(), profileId: profile.id, date: '2026-01-01', weightLb: 200, source: 'app', externalId: null });
  });

  it('seeds exercises and routines for a new profile', async () => {
    const ex = await repo.getExercises(profile.id);
    const routines = await repo.getRoutines(profile.id);
    expect(ex.length).toBeGreaterThan(40);
    expect(routines.map((r) => r.name).sort()).toEqual(['3-Day Full Body', 'Winter Upper / Lower']);
    const fb = routines.find((r) => r.mode === 'standard');
    expect(fb.days.every((d) => d.slots.every((s) => ex.some((e) => e.id === s.exerciseId)))).toBe(true);
    expect(profile.settings.activeRoutineId).toBe(fb.id);
  });

  it('round-trips a profile export through replace import', async () => {
    const data = await exportProfile(profile.id);
    expect(validateBackup(data)).toBe(true);
    expect(data.profiles[0].bodyweight).toHaveLength(1);
    await repo.saveBodyweight({ id: repo.uid(), profileId: profile.id, date: '2026-01-02', weightLb: 199, source: 'app', externalId: null });
    expect(await repo.getBodyweight(profile.id)).toHaveLength(2);
    const res = await importBackup(JSON.parse(JSON.stringify(data)), { mode: 'replace' });
    expect(res.profiles).toBe(1);
    expect(await repo.getBodyweight(profile.id)).toHaveLength(1);
  });

  it('merge import keeps existing rows', async () => {
    const data = await exportAll();
    await repo.saveBodyweight({ id: repo.uid(), profileId: profile.id, date: '2026-01-03', weightLb: 198, source: 'app', externalId: null });
    await importBackup(data, { mode: 'merge' });
    expect(await repo.getBodyweight(profile.id)).toHaveLength(2);
  });

  it('rejects foreign files', () => {
    expect(() => validateBackup({ hello: 'world' })).toThrow();
  });

  it('dedupes Apple Health rows on re-import', async () => {
    const result = {
      bodyweight: [{ profileId: profile.id, date: '2026-02-01', weightLb: 197, source: 'apple_health', externalId: 'ah:bm:x' }],
      cardio: [{ profileId: profile.id, date: '2026-02-01', type: 'run', durationSec: 600, source: 'apple_health', externalId: 'ah:wk:run' }],
      workouts: [],
      hrDaily: [{ date: '2026-02-01', avg: 70, min: 60, max: 90, samples: 3, resting: 55 }],
    };
    const first = await commitHealthImport(result, profile.id);
    expect(first).toMatchObject({ bodyweight: 1, cardio: 1, hrDays: 1, skippedDuplicates: 0 });
    const second = await commitHealthImport(result, profile.id);
    expect(second).toMatchObject({ bodyweight: 0, cardio: 0, skippedDuplicates: 2 });
    expect(await repo.getHrDaily(profile.id)).toHaveLength(1);
  });
});
