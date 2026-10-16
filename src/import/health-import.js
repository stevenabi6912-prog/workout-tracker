// Runs the worker and writes deduped results to IndexedDB for the profile.
import * as repo from '../db/repo.js';

export function parseHealthFile(file, profileId, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./health-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const msg = e.data;
      if (msg.type === 'progress') onProgress?.(msg);
      else if (msg.type === 'done') { worker.terminate(); resolve(msg); }
      else if (msg.type === 'error') { worker.terminate(); reject(new Error(msg.message)); }
    };
    worker.onerror = (err) => { worker.terminate(); reject(new Error(err.message || 'Import worker failed')); };
    worker.postMessage({ file, profileId });
  });
}

// Dedupe against existing externalIds; hrDaily rows replace by id (per-day summaries).
export async function commitHealthImport(result, profileId) {
  const stats = { bodyweight: 0, cardio: 0, workouts: 0, hrDays: 0, skippedDuplicates: 0 };
  const seen = {
    bodyweight: await repo.existingExternalIds('bodyweight', profileId),
    cardio: await repo.existingExternalIds('cardio', profileId),
    workouts: await repo.existingExternalIds('workouts', profileId),
  };
  for (const store of ['bodyweight', 'cardio', 'workouts']) {
    const fresh = [];
    const inFile = new Set();
    for (const r of result[store]) {
      if (seen[store].has(r.externalId) || inFile.has(r.externalId)) { stats.skippedDuplicates++; continue; }
      inFile.add(r.externalId);
      fresh.push({ ...r, id: repo.uid(), profileId });
    }
    for (let i = 0; i < fresh.length; i += 500) await repo.bulkPut(store, fresh.slice(i, i + 500));
    stats[store] = fresh.length;
  }
  const hr = result.hrDaily.map((r) => ({ ...r, profileId, id: `${profileId}:${r.date}` }));
  for (let i = 0; i < hr.length; i += 500) await repo.bulkPut('hrDaily', hr.slice(i, i + 500));
  stats.hrDays = hr.length;
  await repo.setMeta(`lastHealthImport:${profileId}`, { at: new Date().toISOString(), ...stats });
  return stats;
}
