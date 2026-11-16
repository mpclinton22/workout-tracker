// Home: resume / start workouts, templates, recent sessions.
import { state, save, getExercise } from '../store.js';
import { newSession, startFromTemplate, sessionStats } from '../logic.js';
import { actionSheet, toast } from '../ui.js';
import { esc, fmtDate, fmtDuration, plural } from '../util.js';
import { rerender } from '../app.js';

function lastUsed(t) {
  const s = state.sessions.find((x) => x.templateId === t.id);
  return s ? `last done ${fmtDate(s.startedAt, { month: 'short', day: 'numeric' })}` : 'not done yet';
}

function okToReplaceActive() {
  if (!state.active) return true;
  return confirm(`You have a workout in progress ("${state.active.name || 'Untitled'}"). Discard it and start a new one?`);
}

async function begin(session) {
  state.active = session;
  await save('active');
  location.hash = '#/workout';
}

export function render(root) {
  const a = state.active;
  const recent = state.sessions.slice(0, 3);
  root.innerHTML = `
  <div class="page">
    <h1 class="page-title">Workout</h1>
    ${a ? `
      <button class="card resume" data-act="resume">
        <div><div class="eyebrow">${a.editing ? 'Editing' : 'In progress'}</div>
        <div class="resume-name">${esc(a.name || 'Untitled workout')}</div>
        <div class="muted">${a.editing ? fmtDate(a.startedAt) : `Started ${fmtDuration(Date.now() - a.startedAt)} ago`} · ${plural(sessionStats(a).sets, 'set')} done</div></div>
        <span class="resume-go">Resume ›</span>
      </button>` : `
      <button class="btn primary big wide" data-act="empty">Start empty workout</button>`}

    <h2 class="section-title">Templates</h2>
    ${state.templates.length ? state.templates.map((t) => `
      <div class="card tpl">
        <div class="tpl-main">
          <div class="tpl-name">${esc(t.name)}</div>
          <div class="muted small">${plural(t.blocks.reduce((n, b) => n + b.entries.length, 0), 'exercise')} · ${lastUsed(t)}</div>
          <div class="tpl-ex small">${esc(t.blocks.map((b) => b.entries.map((e) => getExercise(e.exerciseId).name).join(' + ')).join(' · '))}</div>
        </div>
        <div class="tpl-actions">
          <button class="btn primary sm" data-act="start" data-id="${t.id}">Start</button>
          <button class="icon-btn" data-act="tplmenu" data-id="${t.id}" aria-label="Template options">⋯</button>
        </div>
      </div>`).join('') : `
      <div class="card empty">No templates yet. When you finish a workout, tap <b>Save as template</b> to reuse it. Each time you repeat it, the app fills in your last weights and reps.</div>`}

    ${recent.length ? `
      <h2 class="section-title">Recent <a class="see-all" href="#/history">See all</a></h2>
      ${recent.map((s) => `
        <a class="card row-link" href="#/session/${s.id}">
          <div><div class="tpl-name">${esc(s.name)}</div><div class="muted small">${fmtDate(s.startedAt)}${sessionStats(s).exercises ? ` · ${plural(sessionStats(s).exercises, 'exercise')}` : ''}${s.cardio?.trim() ? ' · cardio' : ''}</div></div>
          <span class="chev">›</span>
        </a>`).join('')}` : ''}
  </div>`;

  root.onclick = (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const tpl = state.templates.find((x) => x.id === t.dataset.id);
    switch (t.dataset.act) {
      case 'resume': location.hash = '#/workout'; break;
      case 'empty': begin(newSession()); break;
      case 'start':
        if (okToReplaceActive()) begin(startFromTemplate(tpl));
        break;
      case 'tplmenu':
        actionSheet(tpl.name, [
          { act: 'rename', label: 'Rename' },
          { act: 'delete', label: 'Delete template', danger: true },
        ], async (act) => {
          if (act === 'rename') {
            const name = prompt('Template name', tpl.name);
            if (name?.trim()) { tpl.name = name.trim(); await save('templates'); rerender(); }
          } else if (act === 'delete' && confirm(`Delete the "${tpl.name}" template? Past workouts are kept.`)) {
            state.templates = state.templates.filter((x) => x.id !== tpl.id);
            await save('templates');
            toast('Template deleted');
            rerender();
          }
        });
        break;
      default:
    }
  };
}

export { okToReplaceActive, begin };
