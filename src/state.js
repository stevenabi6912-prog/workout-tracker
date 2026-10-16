import * as repo from './db/repo.js';
import { DEFAULT_PROFILES } from './domain/seed.js';

const KEY = 'wt:currentProfileId';
const listeners = new Set();

export const state = {
  profiles: [],
  profile: null,
};

export async function initState() {
  let profiles = await repo.listProfiles();
  if (!profiles.length) {
    for (const p of DEFAULT_PROFILES) await repo.createProfile(p);
    profiles = await repo.listProfiles();
  }
  state.profiles = profiles;
  const savedId = localStorage.getItem(KEY);
  state.profile = profiles.find((p) => p.id === savedId) || profiles[0];
  applyTheme();
  emit();
}

export async function reloadProfiles() {
  state.profiles = await repo.listProfiles();
  state.profile = state.profiles.find((p) => p.id === state.profile?.id) || state.profiles[0];
  applyTheme();
  emit();
}

export function setProfile(id) {
  const p = state.profiles.find((x) => x.id === id);
  if (!p) return;
  state.profile = p;
  localStorage.setItem(KEY, id);
  applyTheme();
  emit();
}

export async function updateProfile(patch) {
  const next = typeof patch === 'function' ? patch(state.profile) : { ...state.profile, ...patch };
  await repo.saveProfile(next);
  await reloadProfiles();
  return state.profile;
}

export function onState(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { for (const fn of listeners) fn(state); }

export function applyTheme() {
  const theme = state.profile?.settings?.theme || 'system';
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}
