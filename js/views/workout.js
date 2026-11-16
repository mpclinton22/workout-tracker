// Active workout logger (also used to edit a past workout).
import { state, save, saveSoon, getExercise, sortSessions } from '../store.js';
import { prefillEntry, applyBump, structureKey, templateBlocksFromSession, isBodyweight, weightIncrement } from '../logic.js';
import { startRest, stop as stopTimer, unlockAudio } from '../timer.js';
import { openPicker, actionSheet, toast } from '../ui.js';
import { esc, uid, num, parseField, fmtW, fmtSec, fmtDate, fmtDuration } from '../util.js';
import { rerender } from '../app.js';

const REST_CHOICES = [0, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];
const STYLES = { straight: 'Straight sets', pyramid: 'Pyramid', drop: 'Drop sets' };

// ---------- screen wake lock ----------
let wakeLock = null;
async function keepAwake() {
  if (!state.settings.wakeLock || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { /* denied or unsupported */ }
}
export function releaseWake() {
  wakeLock?.release();
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && state.active && location.hash === '#/workout') keepAwake();
});

// ---------- render ----------
export function render(root) {
  const s = state.active;
  if (!s) { location.replace('#/'); return; }
  if (!s.editing) keepAwake();
  root.innerHTML = page(s);
  root.onclick = (e) => onClick(e, s);
  root.oninput = (e) => onInput(e, s);
  root.onchange = (e) => onChange(e, s);
  root.onfocusin = (e) => {
    if (e.target.matches('.set-row input, .goal input')) setTimeout(() => e.target.select(), 0);
  };
  const iv = setInterval(() => {
    const el = root.querySelector('#elapsed');
    if (el) el.textContent = fmtDuration(Date.now() - s.startedAt);
  }, 20000);
  return () => clearInterval(iv);
}

function restOptions(cur, def = null) {
  const list = cur == null || REST_CHOICES.includes(cur) ? REST_CHOICES : [...REST_CHOICES, cur].sort((a, b) => a - b);
  const label = (v) => (v === 0 ? 'None' : fmtSec(v));
  return (def != null ? `<option value="" ${cur == null ? 'selected' : ''}>Default (${label(def)})</option>` : '')
    + list.map((v) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label(v)}</option>`).join('');
}

function page(s) {
  return `
  <div class="page workout">
    <div class="wk-head">
      <input class="title-input" data-f="name" value="${esc(s.name)}" placeholder="Workout name" enterkeyhint="done">
      <div class="wk-meta">
        ${s.editing ? `<span>Editing · ${fmtDate(s.startedAt)}</span>` : `<span>⏱ <span id="elapsed">${fmtDuration(Date.now() - s.startedAt)}</span></span>`}
        <label class="inline-sel">Rest between sets <select data-f="rest">${restOptions(s.rest)}</select></label>
      </div>
    </div>
    ${s.blocks.length ? s.blocks.map((b, bi) => blockHtml(s, b, bi)).join('')
      : '<div class="card empty">No exercises yet. Add some below, or just log cardio.</div>'}
    <button class="btn ghost wide" data-act="add">+ Add exercise</button>
    <section class="card">
      <h3 class="card-title">Cardio</h3>
      <textarea data-f="cardio" rows="3" placeholder="e.g. 20 min incline walk, 3.2 mph @ 12%">${esc(s.cardio)}</textarea>
    </section>
    <section class="card">
      <h3 class="card-title">Notes</h3>
      <textarea data-f="notes" rows="2" placeholder="How did it feel?">${esc(s.notes)}</textarea>
    </section>
    <div class="btn-row">
      <button class="btn danger" data-act="discard">${s.editing ? 'Cancel edit' : 'Discard'}</button>
      <button class="btn primary" data-act="finish">${s.editing ? 'Save changes' : 'Finish workout'}</button>
    </div>
  </div>`;
}

function blockHtml(s, b, bi) {
  const ss = b.entries.length > 1;
  const letter = String.fromCharCode(65 + (bi % 26));
  return `
  <section class="card block ${ss ? 'superset' : ''}">
    ${ss ? `<div class="ss-label">Superset ${letter} · do one set of each, then rest</div>` : ''}
    ${b.entries.map((e, ei) => entryHtml(s, e, bi, ei, ss ? `${letter}${ei + 1}` : '')).join('<hr class="ss-divider">')}
    <div class="block-foot">
      <label class="inline-sel">Rest <select data-f="blockRest" data-b="${bi}">${restOptions(b.rest, s.rest)}</select></label>
      <span class="spacer"></span>
      ${ss ? `<button class="link" data-act="unlink" data-b="${bi}">Split</button>` : ''}
      ${bi < s.blocks.length - 1 ? `<button class="link" data-act="link" data-b="${bi}">Superset with next</button>` : ''}
    </div>
  </section>`;
}

function entryHtml(s, e, bi, ei, tag) {
  const ex = getExercise(e.exerciseId);
  const unit = ex.unit === 'sec' ? 'sec' : 'reps';
  const d = `data-b="${bi}" data-e="${ei}"`;
  const repBump = e.suggestion?.kind === 'bump-reps';
  let n = 0;
  return `
  <div class="entry">
    <button class="ex-title" data-act="exmenu" ${d}>
      ${tag ? `<span class="tag">${tag}</span>` : ''}<span class="ex-title-txt">${esc(ex.name)}</span><span class="more">⋯</span>
    </button>
    <div class="entry-sub">
      <select class="style-sel" data-f="style" ${d}>${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${k === e.style ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <label class="goal">Goal <input inputmode="numeric" data-f="target" ${d} value="${e.targetReps ?? ''}"> ${unit}</label>
    </div>
    ${suggestionHtml(e, ex, d)}
    <div class="sets">
      <div class="set-row head"><span>Set</span><span>${isBodyweight(ex) ? '+lb' : 'lb'}</span><span>${unit}</span><span></span><span></span></div>
      ${e.sets.map((st, si) => {
        if (!st.drop) n++;
        const sd = `${d} data-s="${si}"`;
        const up = st.bumped ? '<i class="bump-arrow" title="Progressed from last time">↑</i>' : '';
        return `
        <div class="set-row ${st.done ? 'done' : ''} ${st.drop ? 'drop' : ''}">
          <span class="set-num">${st.drop ? '↳' : n}</span>
          <span class="cell">${repBump ? '' : up}<input inputmode="decimal" data-f="weight" ${sd} value="${fmtW(st.weight)}" placeholder="0" aria-label="Weight"></span>
          <span class="cell">${repBump ? up : ''}<input inputmode="numeric" data-f="reps" ${sd} value="${st.reps ?? ''}" placeholder="0" aria-label="${unit}"></span>
          <button class="check ${st.done ? 'on' : ''}" data-act="done" ${sd} aria-label="Mark set done">✓</button>
          <button class="x" data-act="delset" ${sd} aria-label="Delete set">×</button>
        </div>`;
      }).join('')}
    </div>
    <div class="entry-actions">
      <button class="link" data-act="addset" ${d}>+ Set</button>
      ${e.style === 'drop' ? `<button class="link" data-act="adddrop" ${d}>+ Drop</button>` : ''}
    </div>
  </div>`;
}

function swapChips(g, d) {
  if (!g.alternatives?.length) return '';
  return `<div class="sugg-swap"><span>${g.kind === 'stall' ? 'Try swapping in:' : 'Or swap for:'}</span>
    ${g.alternatives.map((id) => `<button class="chip" data-act="swapto" data-to="${esc(id)}" ${d}>${esc(getExercise(id).name)}</button>`).join('')}</div>`;
}

function suggestionHtml(e, ex, d) {
  const g = e.suggestion;
  if (!g || g.dismissed) return '';
  const w = `${fmtW(g.weight)} lb`;
  if (g.kind === 'bump' || g.kind === 'bump-reps') {
    const amount = g.kind === 'bump' ? `+${g.inc} lb` : `+${g.step} ${ex.unit === 'sec' ? 'sec' : 'reps'}`;
    const why = g.kind === 'bump' ? `${g.sessions} sessions at ${w} hitting your goal` : `${g.sessions} sessions hitting your goal`;
    return `
    <div class="sugg ${g.applied ? 'up' : ''}">
      <div>${g.applied ? `<b>↑ ${amount} applied</b>: ${why}.` : `Ready for <b>${amount}</b> (${why}).`}
        <button class="link" data-act="${g.applied ? 'unbump' : 'bump'}" ${d}>${g.applied ? 'Undo' : 'Apply'}</button></div>
      ${swapChips(g, d)}
    </div>`;
  }
  return `
  <div class="sugg stall">
    <div><b>Plateau:</b> stuck at ${w} for ${g.sessions} sessions without more reps.
      ${g.alternatives.length ? '' : 'Consider a deload or a new rep range.'}
      <button class="link" data-act="dismiss" ${d}>Dismiss</button></div>
    ${swapChips(g, d)}
  </div>`;
}

// ---------- helpers ----------
function commit() {
  save('active');
  rerender();
}

// Round = which working set (plus its drops) a set belongs to.
function roundOf(entry, si) {
  let r = -1;
  for (let i = 0; i <= si; i++) if (!entry.sets[i].drop) r++;
  return Math.max(r, 0);
}
function roundSets(entry, r) {
  const out = [];
  let cur = -1;
  for (const st of entry.sets) {
    if (!st.drop) cur++;
    if (cur === r) out.push(st);
  }
  return out;
}
function rounds(entry) {
  return entry.sets.filter((x) => !x.drop).length || (entry.sets.length ? 1 : 0);
}

function nextUp(s) {
  for (const b of s.blocks) {
    const maxR = Math.max(0, ...b.entries.map(rounds));
    for (let r = 0; r < maxR; r++) {
      for (const e of b.entries) {
        if (roundSets(e, r).some((x) => !x.done)) return `${getExercise(e.exerciseId).name} · set ${r + 1}`;
      }
    }
  }
  return null;
}

function afterSetDone(s, bi, ei, si) {
  if (s.editing) return;
  const b = s.blocks[bi];
  const e = b.entries[ei];
  const nextSet = e.sets[si + 1];
  if (nextSet?.drop && !nextSet.done) { toast('Drop set: strip the weight and go'); return; }
  const r = roundOf(e, si);
  const pending = b.entries.find((x) => roundSets(x, r).some((st) => !st.done));
  if (b.entries.length > 1 && pending) { toast(`Next: ${getExercise(pending.exerciseId).name}`); return; }
  // Prefer what's left in the current block, then anything else in the workout.
  const next = nextUp({ blocks: [b] }) || nextUp(s);
  if (!next) { toast('All sets done. Finish when ready 💪'); return; }
  const rest = b.rest ?? s.rest;
  if (rest > 0) startRest(rest, `Next: ${next}`);
}

function addSet(s, e, drop) {
  const ex = getExercise(e.exerciseId);
  const base = drop ? e.sets.at(-1) : e.sets.filter((x) => !x.drop).at(-1);
  const done = !!s.editing;
  if (!base) {
    e.sets.push({ weight: isBodyweight(ex) ? 0 : '', reps: e.targetReps || 10, drop: false, done });
    return;
  }
  let weight = base.weight;
  let reps = base.reps;
  if (drop) weight = Math.max(0, Math.round((num(base.weight) * 0.8) / 5) * 5);
  else if (e.style === 'pyramid' && base.weight !== '') {
    weight = num(base.weight) + weightIncrement(ex);
    reps = Math.max(1, num(reps) - 2);
  }
  e.sets.push({ weight, reps, drop, done });
}

function addExercises(s, ids, asSuperset) {
  const entries = ids.map((id) => {
    const e = prefillEntry(id);
    if (s.editing) e.sets.forEach((x) => { x.done = true; });
    return e;
  });
  if (asSuperset) s.blocks.push({ id: uid(), rest: null, entries });
  else entries.forEach((e) => s.blocks.push({ id: uid(), rest: null, entries: [e] }));
  commit();
  document.querySelector('.block:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function swap(s, bi, ei, toId) {
  const old = s.blocks[bi].entries[ei];
  if (old.sets.some((x) => x.done) && !s.editing && !confirm('This exercise has completed sets. Replace it anyway?')) return false;
  const e = prefillEntry(toId);
  if (s.editing) e.sets.forEach((x) => { x.done = true; });
  s.blocks[bi].entries[ei] = e;
  return true;
}

function exerciseMenu(s, bi, ei) {
  const b = s.blocks[bi];
  const e = b.entries[ei];
  const ex = getExercise(e.exerciseId);
  const inSS = b.entries.length > 1;
  const canUp = inSS ? ei > 0 : bi > 0;
  const canDown = inSS ? ei < b.entries.length - 1 : bi < s.blocks.length - 1;
  actionSheet(ex.name, [
    { act: 'swap', label: 'Swap exercise' },
    { act: 'history', label: 'View history' },
    ...(canUp ? [{ act: 'up', label: 'Move up' }] : []),
    ...(canDown ? [{ act: 'down', label: 'Move down' }] : []),
    { act: 'remove', label: 'Remove from workout', danger: true },
  ], (act) => {
    if (act === 'swap') {
      openPicker({ multi: false, title: `Swap ${ex.name}`, onDone: ([id]) => { if (swap(s, bi, ei, id)) commit(); } });
    } else if (act === 'history') {
      location.hash = `#/exercise/${encodeURIComponent(ex.id)}`;
    } else if (act === 'up' || act === 'down') {
      const dir = act === 'up' ? -1 : 1;
      const arr = inSS ? b.entries : s.blocks;
      const i = inSS ? ei : bi;
      [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
      commit();
    } else if (act === 'remove') {
      if (e.sets.some((x) => x.done) && !confirm(`Remove ${ex.name} and its completed sets?`)) return;
      b.entries.splice(ei, 1);
      if (!b.entries.length) s.blocks.splice(bi, 1);
      commit();
    }
  });
}

function defaultName(s) {
  const muscles = [...new Set(s.blocks.flatMap((b) => b.entries.map((e) => getExercise(e.exerciseId).muscle)))];
  if (!muscles.length) return 'Cardio';
  return muscles.slice(0, 2).join(' & ') + (muscles.length > 2 ? ' +' : '');
}

async function finish(s) {
  if (s.editing) {
    for (const b of s.blocks) for (const e of b.entries) for (const x of e.sets) if (num(x.reps) > 0) x.done = true;
  }
  const clean = structuredClone(s);
  for (const b of clean.blocks) {
    for (const e of b.entries) e.sets = e.sets.filter((x) => x.done);
    b.entries = b.entries.filter((e) => e.sets.length);
  }
  clean.blocks = clean.blocks.filter((b) => b.entries.length);
  const hasCardio = clean.cardio.trim().length > 0;

  if (!clean.blocks.length && !hasCardio) {
    alert('Nothing to save yet. Check off at least one set or add some cardio notes.');
    return;
  }
  const unchecked = s.blocks.reduce((n, b) => n + b.entries.reduce((m, e) => m + e.sets.filter((x) => !x.done).length, 0), 0);
  if (unchecked && !confirm(`${unchecked} unchecked ${unchecked === 1 ? 'set' : 'sets'} won't be saved. Finish anyway?`)) return;

  const editing = !!clean.editing;
  delete clean.editing;
  if (!clean.name.trim()) clean.name = defaultName(clean);
  if (!editing) clean.endedAt = Date.now();

  const i = state.sessions.findIndex((x) => x.id === clean.id);
  if (i >= 0) state.sessions[i] = clean; else state.sessions.push(clean);
  sortSessions();
  state.active = null;
  stopTimer();
  releaseWake();

  const t = !editing && clean.templateId && state.templates.find((x) => x.id === clean.templateId);
  if (t && clean.blocks.length && structureKey(t.blocks) !== structureKey(clean.blocks)
    && confirm(`Today's exercises differ from your "${t.name}" template. Update the template to match?`)) {
    t.blocks = templateBlocksFromSession(clean);
    t.rest = clean.rest;
    await save('templates');
  }
  await save('sessions', 'active');
  location.hash = `#/session/${clean.id}`;
  toast(editing ? 'Changes saved' : 'Workout saved 🎉');
}

async function discard(s) {
  const msg = s.editing ? 'Discard your edits?' : 'Discard this workout? Nothing will be saved.';
  if (!confirm(msg)) return;
  const back = s.editing ? `#/session/${s.id}` : '#/';
  state.active = null;
  stopTimer();
  releaseWake();
  await save('active');
  location.hash = back;
}

// ---------- events ----------
function onClick(ev, s) {
  const t = ev.target.closest('[data-act]');
  if (!t) return;
  const { act } = t.dataset;
  const bi = +t.dataset.b, ei = +t.dataset.e, si = +t.dataset.s;
  const b = s.blocks[bi];
  const e = b?.entries[ei];

  switch (act) {
    case 'add':
      openPicker({ onDone: (ids, ss) => ids.length && addExercises(s, ids, ss) });
      return;
    case 'done': {
      const st = e.sets[si];
      st.done = !st.done;
      if (st.done) {
        unlockAudio();
        if (st.reps === '' || st.reps == null) st.reps = e.targetReps || 0;
        if (st.weight === '' || st.weight == null) st.weight = 0;
        afterSetDone(s, bi, ei, si);
      }
      break;
    }
    case 'delset': e.sets.splice(si, 1); break;
    case 'addset': addSet(s, e, false); break;
    case 'adddrop': addSet(s, e, true); break;
    case 'bump': applyBump(e, 1); break;
    case 'unbump': applyBump(e, -1); break;
    case 'dismiss': e.suggestion.dismissed = true; break;
    case 'swapto': if (!swap(s, bi, ei, t.dataset.to)) return; break;
    case 'exmenu': exerciseMenu(s, bi, ei); return;
    case 'link':
      b.entries.push(...s.blocks[bi + 1].entries);
      s.blocks.splice(bi + 1, 1);
      break;
    case 'unlink':
      s.blocks.splice(bi, 1, ...b.entries.map((x) => ({ id: uid(), rest: b.rest, entries: [x] })));
      break;
    case 'finish': finish(s); return;
    case 'discard': discard(s); return;
    default: return;
  }
  commit();
}

function onInput(ev, s) {
  const t = ev.target;
  const f = t.dataset.f;
  if (!f) return;
  const bi = +t.dataset.b, ei = +t.dataset.e, si = +t.dataset.s;
  if (f === 'name') s.name = t.value;
  else if (f === 'cardio') s.cardio = t.value;
  else if (f === 'notes') s.notes = t.value;
  else if (f === 'target') s.blocks[bi].entries[ei].targetReps = parseField(t.value) || null;
  else if (f === 'weight' || f === 'reps') {
    const e = s.blocks[bi].entries[ei];
    const st = e.sets[si];
    const old = st[f];
    st[f] = parseField(t.value);
    if (f === 'weight') st.bumped = false;
    // Straight sets: carry the change to later unchecked sets that matched the old value.
    if (e.style === 'straight' && !st.drop) {
      for (let j = si + 1; j < e.sets.length; j++) {
        const o = e.sets[j];
        if (o.done || o.drop || o[f] !== old) continue;
        o[f] = st[f];
        if (f === 'weight') o.bumped = false;
        const input = t.closest('.sets').querySelector(`input[data-f="${f}"][data-s="${j}"]`);
        if (input) input.value = f === 'weight' ? fmtW(o[f]) : o[f];
      }
    }
  } else return;
  saveSoon('active');
}

function onChange(ev, s) {
  const t = ev.target;
  const f = t.dataset.f;
  if (!['rest', 'blockRest', 'style'].includes(f)) return;
  const bi = +t.dataset.b, ei = +t.dataset.e;
  if (f === 'rest') s.rest = +t.value;
  else if (f === 'blockRest') s.blocks[bi].rest = t.value === '' ? null : +t.value;
  else if (f === 'style') s.blocks[bi].entries[ei].style = t.value;
  commit();
}
