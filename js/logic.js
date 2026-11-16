// Workout logic: history lookups, plateau detection, prefilling from last session, templates.
import { LOWER_PATTERNS } from './exercises.js';
import { state, getExercise, allExercises } from './store.js';
import { uid, num } from './util.js';

export const PLATEAU_SESSIONS = 3;

export const isBodyweight = (ex) => ex.equipment === 'Bodyweight';

// lb added per bump for this exercise.
export const weightIncrement = (ex) => (LOWER_PATTERNS.has(ex.pattern) ? 10 : 5);

export const workingSets = (entry) => entry.sets.filter((s) => s.done && !s.drop);

export const topWeight = (entry) => Math.max(0, ...workingSets(entry).map((s) => num(s.weight)));

// Every working set reached the rep goal.
export const metGoal = (entry) => {
  const sets = workingSets(entry);
  return entry.targetReps > 0 && sets.length > 0 && sets.every((s) => num(s.reps) >= entry.targetReps);
};

// Finished sessions that include this exercise, newest first (one entry per session).
export function exerciseHistory(exId, sessions = state.sessions) {
  const out = [];
  for (const session of sessions) {
    let found = null;
    for (const b of session.blocks) {
      found = b.entries.find((e) => e.exerciseId === exId && workingSets(e).length);
      if (found) break;
    }
    if (found) out.push({ session, entry: found });
  }
  return out;
}

export function similarExercises(ex, limit = 3) {
  if (!ex.pattern) return [];
  return allExercises()
    .filter((o) => o.id !== ex.id && o.pattern === ex.pattern)
    .sort((a, b) => (b.muscle === ex.muscle) - (a.muscle === ex.muscle) || (a.equipment === ex.equipment) - (b.equipment === ex.equipment))
    .slice(0, limit);
}

/**
 * Look at the last N sessions of an exercise.
 * - "bump": same top weight N times in a row and every working set hit the rep goal → add weight
 *   (or +2 reps / +10 sec for unweighted bodyweight moves).
 * - "stall": same top weight N times, goal not met, and reps aren't improving → suggest a swap.
 */
export function analyze(ex, sessions = state.sessions) {
  const h = exerciseHistory(ex.id, sessions).slice(0, PLATEAU_SESSIONS);
  if (h.length < PLATEAU_SESSIONS) return null;
  const weights = h.map((x) => topWeight(x.entry));
  if (!weights.every((w) => w === weights[0])) return null;
  const weight = weights[0];
  const alternatives = similarExercises(ex).map((e) => e.id);

  if (h.every((x) => metGoal(x.entry))) {
    if (isBodyweight(ex) && weight === 0) {
      const step = ex.unit === 'sec' ? 10 : 2;
      return { kind: 'bump-reps', weight, step, sessions: h.length, alternatives };
    }
    return { kind: 'bump', weight, inc: weightIncrement(ex), sessions: h.length, alternatives };
  }

  const repsAtWeight = (e) => workingSets(e).filter((s) => num(s.weight) === weight).reduce((t, s) => t + num(s.reps), 0);
  const [newest, , oldest] = h.map((x) => repsAtWeight(x.entry));
  if (newest <= oldest) return { kind: 'stall', weight, sessions: h.length, alternatives };
  return null;
}

// Apply (sign = 1) or undo (sign = -1) a bump suggestion on an entry.
export function applyBump(entry, sign) {
  const s = entry.suggestion;
  if (!s) return;
  for (const set of entry.sets) {
    if (set.done) continue;
    if (s.kind === 'bump' && (num(set.weight) > 0 || !set.drop)) {
      set.weight = Math.max(0, num(set.weight) + sign * s.inc);
      set.bumped = sign > 0;
    }
    if (s.kind === 'bump-reps' && !set.drop) {
      set.reps = Math.max(1, num(set.reps) + sign * s.step);
      set.bumped = sign > 0;
    }
  }
  if (s.kind === 'bump-reps' && entry.targetReps) entry.targetReps = Math.max(1, entry.targetReps + sign * s.step);
  s.applied = sign > 0;
}

/**
 * Build a workout entry for an exercise, starting from the last time it was done.
 * fallback = { sets, reps, weight, style } from a template, used when there's no history.
 */
export function prefillEntry(exId, fallback = {}) {
  const ex = getExercise(exId);
  const last = exerciseHistory(exId)[0];
  let sets, style, targetReps;

  if (last) {
    sets = last.entry.sets.filter((s) => s.done).map((s) => ({ weight: s.weight, reps: s.reps, drop: !!s.drop, done: false }));
    style = last.entry.style || 'straight';
    targetReps = last.entry.targetReps || fallback.reps || num(sets[0]?.reps) || 10;
  } else {
    const reps = fallback.reps || (ex.unit === 'sec' ? 30 : 10);
    const weight = fallback.weight ?? (isBodyweight(ex) ? 0 : '');
    sets = Array.from({ length: fallback.sets || 3 }, () => ({ weight, reps, drop: false, done: false }));
    style = fallback.style || 'straight';
    targetReps = reps;
  }

  const entry = { id: uid(), exerciseId: exId, style, targetReps, sets, suggestion: null };
  const a = analyze(ex);
  if (a) {
    entry.suggestion = { ...a, applied: false };
    if (a.kind !== 'stall') applyBump(entry, 1); // auto-apply weight/rep bumps
  }
  return entry;
}

export function newSession({ name = '', templateId = null, rest = state.settings.rest, blocks = [] } = {}) {
  const now = Date.now();
  return { id: uid(), name, templateId, startedAt: now, endedAt: null, rest, blocks, cardio: '', notes: '' };
}

export function startFromTemplate(t, { linkTemplate = true } = {}) {
  return newSession({
    name: t.name,
    templateId: linkTemplate ? t.id : null,
    rest: t.rest ?? state.settings.rest,
    blocks: t.blocks.map((b) => ({ id: uid(), rest: b.rest ?? null, entries: b.entries.map((e) => prefillEntry(e.exerciseId, e)) })),
  });
}

export function templateBlocksFromSession(s) {
  return s.blocks.map((b) => ({
    rest: b.rest ?? null,
    entries: b.entries.map((e) => {
      const first = e.sets.find((x) => !x.drop) || e.sets[0] || {};
      return {
        exerciseId: e.exerciseId,
        style: e.style || 'straight',
        sets: e.sets.filter((x) => !x.drop).length || 3,
        reps: e.targetReps || num(first.reps) || 10,
        weight: first.weight ?? '',
      };
    }),
  }));
}

export function templateFromSession(s, name) {
  return { id: uid(), name: name || s.name || 'Workout', rest: s.rest, createdAt: Date.now(), blocks: templateBlocksFromSession(s) };
}

export const structureKey = (blocks) => blocks.map((b) => b.entries.map((e) => e.exerciseId).join('+')).join('|');

export function sessionStats(s) {
  let sets = 0, volume = 0;
  for (const b of s.blocks) for (const e of b.entries) for (const x of e.sets) {
    if (!x.done) continue;
    sets++;
    volume += num(x.weight) * num(x.reps);
  }
  const exercises = s.blocks.reduce((n, b) => n + b.entries.length, 0);
  return { sets, volume, exercises };
}

// Estimated one-rep max (Epley).
export const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30));
