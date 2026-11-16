// History: calendar of active days + list view, and single-session detail.
import { state, save, getExercise } from '../store.js';
import { sessionStats, templateFromSession, startFromTemplate } from '../logic.js';
import { toast } from '../ui.js';
import { esc, dayKey, fmtDate, fmtTime, fmtDuration, fmtW, plural, num } from '../util.js';
import { rerender } from '../app.js';
import { okToReplaceActive, begin } from './home.js';

let month = null; // Date for the first of the month shown
let selectedDay = null;

const isCardioOnly = (s) => !s.blocks.length && s.cardio?.trim();

function byDay() {
  const map = new Map();
  for (const s of state.sessions) {
    const k = dayKey(s.startedAt);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s);
  }
  return map;
}

function sessionCard(s) {
  const st = sessionStats(s);
  const parts = [];
  if (st.exercises) parts.push(plural(st.exercises, 'exercise'), plural(st.sets, 'set'));
  if (st.volume) parts.push(`${Math.round(st.volume).toLocaleString()} lb`);
  if (s.endedAt) parts.push(fmtDuration(s.endedAt - s.startedAt));
  return `
  <a class="card row-link" href="#/session/${s.id}">
    <div class="grow">
      <div class="tpl-name">${esc(s.name)}</div>
      <div class="muted small">${fmtDate(s.startedAt)} · ${parts.join(' · ')}</div>
      ${s.cardio?.trim() ? `<div class="cardio-snip small">🏃 ${esc(s.cardio.trim().split('\n')[0])}</div>` : ''}
    </div>
    <span class="chev">›</span>
  </a>`;
}

function calendar() {
  const days = byDay();
  const first = month;
  const y = first.getFullYear(), m = first.getMonth();
  const startPad = first.getDay();
  const count = new Date(y, m + 1, 0).getDate();
  const today = dayKey(Date.now());
  const monthSessions = state.sessions.filter((s) => { const d = new Date(s.startedAt); return d.getFullYear() === y && d.getMonth() === m; });
  const activeDays = new Set(monthSessions.map((s) => dayKey(s.startedAt))).size;

  let cells = '';
  for (let i = 0; i < startPad; i++) cells += '<span class="cal-cell pad"></span>';
  for (let d = 1; d <= count; d++) {
    const k = dayKey(new Date(y, m, d));
    const list = days.get(k) || [];
    const lift = list.some((s) => s.blocks.length);
    const cardio = list.some((s) => s.cardio?.trim());
    cells += `<button class="cal-cell ${lift ? 'lift' : ''} ${!lift && cardio ? 'cardio' : ''} ${k === today ? 'today' : ''} ${k === selectedDay ? 'sel' : ''}" data-act="day" data-k="${k}">
      <span>${d}</span>${lift && cardio ? '<i class="dot"></i>' : ''}</button>`;
  }
  const dayList = selectedDay ? (days.get(selectedDay) || []) : [];
  return `
  <div class="card cal">
    <div class="cal-head">
      <button class="icon-btn" data-act="prev" aria-label="Previous month">‹</button>
      <div class="cal-title">${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <button class="icon-btn" data-act="next" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid cal-dow">${['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<span>${d}</span>`).join('')}</div>
    <div class="cal-grid">${cells}</div>
    <div class="cal-legend small muted">
      <span><i class="lg lift"></i>Lifting</span><span><i class="lg cardio"></i>Cardio only</span><span><i class="lg both"></i>Both</span>
      <span class="spacer"></span><b>${plural(activeDays, 'active day')}</b>
    </div>
  </div>
  ${selectedDay ? `
    <h2 class="section-title">${fmtDate(new Date(selectedDay + 'T12:00'), { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
    ${dayList.length ? dayList.map(sessionCard).join('') : '<div class="card empty">Rest day.</div>'}` : ''}`;
}

function list() {
  if (!state.sessions.length) return '';
  let out = '', cur = '';
  for (const s of state.sessions) {
    const label = new Date(s.startedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    if (label !== cur) { cur = label; out += `<h2 class="section-title">${label}</h2>`; }
    out += sessionCard(s);
  }
  return out;
}

export function render(root) {
  month ??= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const mode = state.settings.historyMode;
  root.innerHTML = `
  <div class="page">
    <h1 class="page-title">History</h1>
    <div class="seg">
      <button class="${mode === 'calendar' ? 'on' : ''}" data-act="mode" data-m="calendar">Calendar</button>
      <button class="${mode === 'list' ? 'on' : ''}" data-act="mode" data-m="list">List</button>
    </div>
    ${!state.sessions.length ? '<div class="card empty">No workouts yet. Finished workouts show up here.</div>' : ''}
    ${mode === 'calendar' ? calendar() : list()}
  </div>`;
  root.onclick = (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act;
    if (a === 'mode') { state.settings.historyMode = t.dataset.m; save('settings'); }
    else if (a === 'prev') month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
    else if (a === 'next') month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    else if (a === 'day') selectedDay = selectedDay === t.dataset.k ? null : t.dataset.k;
    else return;
    rerender();
  };
}

// ---------- session detail ----------

function setsText(e, ex) {
  const unit = ex.unit === 'sec' ? 's' : '';
  return e.sets.map((x) => {
    const w = num(x.weight) ? `${fmtW(x.weight)}×` : (ex.equipment === 'Bodyweight' ? 'BW×' : '');
    return `<span class="set-chip ${x.drop ? 'drop' : ''}">${x.drop ? '↳ ' : ''}${w}${x.reps}${unit}${x.bumped ? ' <i class="bump-arrow">↑</i>' : ''}</span>`;
  }).join('');
}

export function renderSession(root, id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) { root.innerHTML = '<div class="page"><div class="card empty">Workout not found.</div><a class="btn wide" href="#/history">Back to history</a></div>'; root.onclick = null; return; }
  const st = sessionStats(s);
  const hasTemplate = s.templateId && state.templates.some((t) => t.id === s.templateId);
  root.innerHTML = `
  <div class="page">
    <button class="back" data-act="back">‹ Back</button>
    <h1 class="page-title">${esc(s.name)}</h1>
    <div class="muted">${fmtDate(s.startedAt, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} · ${fmtTime(s.startedAt)}${s.endedAt ? ` · ${fmtDuration(s.endedAt - s.startedAt)}` : ''}</div>
    ${st.sets ? `<div class="stats">
      <div><b>${st.exercises}</b><span>exercises</span></div>
      <div><b>${st.sets}</b><span>sets</span></div>
      <div><b>${Math.round(st.volume).toLocaleString()}</b><span>lb volume</span></div>
    </div>` : ''}
    ${s.blocks.map((b, bi) => `
      <div class="card ${b.entries.length > 1 ? 'superset' : ''}">
        ${b.entries.length > 1 ? `<div class="ss-label">Superset ${String.fromCharCode(65 + (bi % 26))}</div>` : ''}
        ${b.entries.map((e) => {
          const ex = getExercise(e.exerciseId);
          return `<div class="detail-entry">
            <a class="tpl-name" href="#/exercise/${encodeURIComponent(ex.id)}">${esc(ex.name)}</a>
            ${e.style && e.style !== 'straight' ? `<span class="badge">${e.style}</span>` : ''}
            <div class="set-chips">${setsText(e, ex)}</div>
          </div>`;
        }).join('')}
      </div>`).join('')}
    ${s.cardio?.trim() ? `<div class="card"><h3 class="card-title">Cardio</h3><p class="pre">${esc(s.cardio)}</p></div>` : ''}
    ${s.notes?.trim() ? `<div class="card"><h3 class="card-title">Notes</h3><p class="pre">${esc(s.notes)}</p></div>` : ''}
    <div class="btn-col">
      ${s.blocks.length ? '<button class="btn primary wide" data-act="repeat">Repeat this workout</button>' : ''}
      ${s.blocks.length && !hasTemplate ? '<button class="btn wide" data-act="template">Save as template</button>' : ''}
      <div class="btn-row">
        <button class="btn" data-act="edit">Edit</button>
        <button class="btn danger" data-act="delete">Delete</button>
      </div>
    </div>
  </div>`;

  root.onclick = async (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    switch (t.dataset.act) {
      case 'back':
        if (history.length > 1) history.back(); else location.hash = '#/history';
        break;
      case 'repeat': {
        if (!okToReplaceActive()) return;
        const tpl = s.templateId && state.templates.find((x) => x.id === s.templateId);
        begin(startFromTemplate(tpl || templateFromSession(s), { linkTemplate: !!tpl }));
        break;
      }
      case 'template': {
        const name = prompt('Template name', s.name);
        if (!name?.trim()) return;
        const tpl = templateFromSession(s, name.trim());
        state.templates.push(tpl);
        s.templateId = tpl.id;
        await save('templates', 'sessions');
        toast(`Saved template "${tpl.name}"`);
        rerender();
        break;
      }
      case 'edit':
        if (state.active) { alert('Finish or discard your current workout before editing a past one.'); return; }
        state.active = { ...structuredClone(s), editing: true };
        await save('active');
        location.hash = '#/workout';
        break;
      case 'delete':
        if (!confirm('Delete this workout permanently?')) return;
        state.sessions = state.sessions.filter((x) => x.id !== s.id);
        await save('sessions');
        toast('Workout deleted');
        location.hash = '#/history';
        break;
      default:
    }
  };
}
