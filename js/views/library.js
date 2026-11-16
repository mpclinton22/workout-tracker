// Exercise library and per-exercise history / progress.
import { state, save, getExercise } from '../store.js';
import { PATTERNS } from '../exercises.js';
import { exerciseHistory, analyze, topWeight, similarExercises, e1rm, workingSets, weightIncrement } from '../logic.js';
import { equipChips, filterExercises, groupedList, openCustomForm, toast } from '../ui.js';
import { esc, fmtDate, fmtW, num } from '../util.js';
import { rerender } from '../app.js';

let query = '';

export function render(root) {
  root.innerHTML = `
  <div class="page">
    <h1 class="page-title">Exercises</h1>
    <input class="search" type="search" placeholder="Search exercises or muscles" value="${esc(query)}" autocomplete="off">
    <div class="filter-label small muted">Filter by equipment</div>
    <div class="lib-chips">${equipChips(state.settings.equipFilter)}</div>
    <button class="btn ghost wide" data-act="custom">+ Create custom exercise</button>
    <div class="lib-list">${groupedList(filterExercises(query, state.settings.equipFilter), { link: true })}</div>
  </div>`;
  const drawList = () => {
    root.querySelector('.lib-list').innerHTML = groupedList(filterExercises(query, state.settings.equipFilter), { link: true });
  };
  root.oninput = (e) => {
    if (e.target.classList.contains('search')) { query = e.target.value; drawList(); }
  };
  root.onclick = (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'equip') {
      const eq = t.dataset.eq;
      const f = state.settings.equipFilter;
      state.settings.equipFilter = f.includes(eq) ? f.filter((x) => x !== eq) : [...f, eq];
      save('settings');
      root.querySelector('.lib-chips').innerHTML = equipChips(state.settings.equipFilter);
      drawList();
    } else if (t.dataset.act === 'custom') {
      openCustomForm(null, (ex) => { location.hash = `#/exercise/${encodeURIComponent(ex.id)}`; });
    }
  };
}

function chart(points) {
  if (points.length < 2) return '';
  const W = 320, H = 120, P = 8;
  const ys = points.map((p) => p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const x = (i) => P + (i * (W - 2 * P)) / (points.length - 1);
  const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(' ');
  return `
  <div class="card">
    <h3 class="card-title">Top set weight <span class="muted small">last ${points.length} sessions</span></h3>
    <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Top weight over time">
      <path d="${d}" class="chart-line"/>
      ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.y)}" r="3" class="chart-dot"><title>${fmtDate(p.t)}: ${fmtW(p.y)} lb</title></circle>`).join('')}
    </svg>
    <div class="chart-axis small muted"><span>${fmtW(min)} lb</span><span>${fmtW(max)} lb</span></div>
  </div>`;
}

export function renderExercise(root, rawId) {
  const id = decodeURIComponent(rawId);
  const ex = getExercise(id);
  const hist = exerciseHistory(id);
  const unit = ex.unit === 'sec' ? 'sec' : 'reps';
  let best = null;
  for (const { session, entry } of hist) {
    for (const s of workingSets(entry)) {
      const score = e1rm(num(s.weight), num(s.reps));
      if (!best || score > best.score) best = { score, s, t: session.startedAt };
    }
  }
  const a = analyze(ex);
  const status = !hist.length ? 'Not logged yet.'
    : !a ? 'Progressing. Keep it up.'
      : a.kind === 'stall' ? `Plateau: stuck at ${fmtW(a.weight)} lb for ${a.sessions} sessions without more reps. Try a swap below.`
        : a.kind === 'bump' ? `Ready to progress: next time starts at ${fmtW(a.weight + a.inc)} lb (+${weightIncrement(ex)}).`
          : `Ready to progress: next time adds +${a.step} ${unit}.`;
  const similar = similarExercises(ex, 6);
  const points = hist.slice(0, 20).reverse().map(({ session, entry }) => ({ t: session.startedAt, y: topWeight(entry) }));

  root.innerHTML = `
  <div class="page">
    <button class="back" data-act="back">‹ Back</button>
    <h1 class="page-title">${esc(ex.name)}</h1>
    <div class="muted">${esc(ex.muscle)} · ${esc(ex.equipment)}${ex.pattern ? ` · ${esc(PATTERNS[ex.pattern] || '')}` : ''}${ex.custom ? ' · custom' : ''}</div>
    <div class="card sugg ${a?.kind === 'stall' ? 'stall' : a ? 'up' : ''}">${status}</div>
    ${best ? `<div class="stats">
      <div><b>${hist.length}</b><span>sessions</span></div>
      <div><b>${fmtW(best.s.weight)}×${best.s.reps}</b><span>best set</span></div>
      ${unit === 'reps' && num(best.s.weight) ? `<div><b>${Math.round(best.score)}</b><span>est. 1RM</span></div>` : ''}
    </div>` : ''}
    ${ex.unit !== 'sec' ? chart(points) : ''}
    ${hist.length ? `<div class="card"><h3 class="card-title">History</h3>
      ${hist.slice(0, 30).map(({ session, entry }) => `
        <a class="hist-row" href="#/session/${session.id}">
          <span class="muted small">${fmtDate(session.startedAt, { month: 'short', day: 'numeric', year: '2-digit' })}</span>
          <span class="set-chips">${entry.sets.map((s) => `<span class="set-chip ${s.drop ? 'drop' : ''}">${num(s.weight) ? fmtW(s.weight) + '×' : ''}${s.reps}${ex.unit === 'sec' ? 's' : ''}</span>`).join('')}</span>
        </a>`).join('')}
    </div>` : ''}
    ${similar.length ? `<div class="card"><h3 class="card-title">Similar exercises</h3>
      <ul class="ex-list">${similar.map((o) => `<li><a href="#/exercise/${encodeURIComponent(o.id)}"><span class="ex-name-txt">${esc(o.name)}</span><span class="ex-meta">${esc(o.equipment)}</span></a></li>`).join('')}</ul>
    </div>` : ''}
    ${ex.custom ? `<div class="btn-row"><button class="btn" data-act="edit">Edit</button><button class="btn danger" data-act="delete">Delete</button></div>` : ''}
  </div>`;

  root.onclick = async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'back') {
      if (history.length > 1) history.back(); else location.hash = '#/exercises';
    } else if (t.dataset.act === 'edit') {
      openCustomForm(ex, () => rerender());
    } else if (t.dataset.act === 'delete') {
      if (!confirm(`Delete ${ex.name}? Past workouts that used it keep their history.`)) return;
      ex.deleted = true;
      await save('customExercises');
      toast('Exercise deleted');
      location.hash = '#/exercises';
    }
  };
}
