// All app data lives in IndexedDB on this device and is mirrored in memory.
import { BUILTIN } from './exercises.js';

const DEFAULT_SETTINGS = {
  rest: 90,
  sound: true,
  vibrate: true,
  wakeLock: true,
  equipFilter: [],
  historyMode: 'calendar',
};

export const state = {
  sessions: [], // finished workouts, newest first
  templates: [],
  customExercises: [],
  settings: { ...DEFAULT_SETTINGS },
  active: null, // workout in progress
};

const KEYS = ['sessions', 'templates', 'customExercises', 'settings', 'active'];

let dbPromise;
function idb() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('workout-tracker', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction('kv', mode);
    const req = fn(t.objectStore('kv'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

export async function load() {
  for (const k of KEYS) {
    const v = await tx('readonly', (st) => st.get(k));
    if (v !== undefined && v !== null) state[k] = v;
  }
  state.settings = { ...DEFAULT_SETTINGS, ...state.settings };
  sortSessions();
  try { await navigator.storage?.persist?.(); } catch { /* not supported */ }
}

export function save(...keys) {
  return Promise.all(keys.map((k) => tx('readwrite', (st) => st.put(state[k] ?? null, k))));
}

const timers = {};
export function saveSoon(key) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => save(key), 400);
}
export function flush() {
  for (const k of Object.keys(timers)) {
    clearTimeout(timers[k]);
    save(k);
  }
}
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

export function sortSessions() {
  state.sessions.sort((a, b) => b.startedAt - a.startedAt);
}

const builtinMap = new Map(BUILTIN.map((e) => [e.id, e]));

export function allExercises() {
  return [...BUILTIN, ...state.customExercises.filter((e) => !e.deleted)];
}

export function getExercise(id) {
  return builtinMap.get(id)
    || state.customExercises.find((e) => e.id === id)
    || { id, name: 'Unknown exercise', muscle: 'Other', equipment: 'Other', pattern: null, unit: 'reps' };
}

export function exportData() {
  const { sessions, templates, customExercises, settings } = state;
  return JSON.stringify({ app: 'workout-tracker', version: 1, exportedAt: new Date().toISOString(), sessions, templates, customExercises, settings }, null, 2);
}

export async function importData(json) {
  const data = JSON.parse(json);
  if (data.app !== 'workout-tracker') throw new Error('Not a workout tracker backup file');
  state.sessions = data.sessions || [];
  state.templates = data.templates || [];
  state.customExercises = data.customExercises || [];
  state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  sortSessions();
  await save('sessions', 'templates', 'customExercises', 'settings');
}
