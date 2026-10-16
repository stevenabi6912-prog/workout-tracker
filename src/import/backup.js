import * as repo from '../db/repo.js';
import { PROFILE_STORES } from '../db/schema.js';

export const BACKUP_VERSION = 1;

async function bundleProfile(profile) {
  const data = { profile };
  for (const store of PROFILE_STORES) data[store] = await repo.allForProfile(store, profile.id);
  return data;
}

export async function exportProfile(profileId) {
  const profile = await repo.getProfile(profileId);
  return { app: 'workout-tracker', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), profiles: [await bundleProfile(profile)] };
}

export async function exportAll() {
  const profiles = await repo.listProfiles();
  const out = [];
  for (const p of profiles) out.push(await bundleProfile(p));
  return { app: 'workout-tracker', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), profiles: out };
}

export function validateBackup(json) {
  if (!json || json.app !== 'workout-tracker' || !Array.isArray(json.profiles)) throw new Error('Not a Workout Tracker backup file');
  if (json.version > BACKUP_VERSION) throw new Error('Backup was made by a newer version of the app');
  for (const p of json.profiles) if (!p.profile?.id || !p.profile?.name) throw new Error('Backup is missing profile info');
  return true;
}

// mode: 'merge' puts every record by id (existing ids are overwritten with the file's copy);
//       'replace' clears each imported profile's stores first.
export async function importBackup(json, { mode = 'merge' } = {}) {
  validateBackup(json);
  let records = 0;
  for (const bundle of json.profiles) {
    const p = bundle.profile;
    if (mode === 'replace') for (const store of PROFILE_STORES) await repo.clearProfileStore(store, p.id);
    for (const store of PROFILE_STORES) {
      const rows = (bundle[store] || []).map((r) => ({ ...r, profileId: p.id }));
      records += await repo.bulkPut(store, rows);
    }
    await repo.saveProfile(p);
  }
  return { profiles: json.profiles.length, records };
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  // iOS Safari: the share sheet is the reliable way to save to Files / AirDrop.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: filename }).catch(() => fallback());
    return;
  }
  fallback();
  function fallback() {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.rel = 'noopener';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
