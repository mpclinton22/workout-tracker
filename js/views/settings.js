// Settings, backup / restore.
import { state, save, exportData, importData } from '../store.js';
import { toast } from '../ui.js';
import { fmtSec } from '../util.js';
import { rerender } from '../app.js';

const RESTS = [30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300];

export function render(root) {
  const st = state.settings;
  const toggle = (key, label, hint) => `
    <label class="toggle-row"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
      <input type="checkbox" data-key="${key}" ${st[key] ? 'checked' : ''}></label>`;
  root.innerHTML = `
  <div class="page">
    <h1 class="page-title">Settings</h1>
    <div class="card form">
      <label>Default rest between sets
        <select data-key="rest">${RESTS.map((v) => `<option value="${v}" ${v === st.rest ? 'selected' : ''}>${fmtSec(v)}</option>`).join('')}</select>
        <small>Used for new workouts. Each workout and exercise can override it.</small>
      </label>
      ${toggle('sound', 'Sound when rest ends', 'Your phone\'s silent switch may mute it')}
      ${toggle('vibrate', 'Vibrate when rest ends', 'Android only. iOS doesn\'t allow web apps to vibrate')}
      ${toggle('wakeLock', 'Keep screen on during workouts')}
    </div>

    <h2 class="section-title">Your data</h2>
    <div class="card">
      <p class="small muted">Everything is stored only on this device. Export a backup now and then, especially before switching phones or clearing browser data.</p>
      <p class="small"><b>${state.sessions.length}</b> workouts · <b>${state.templates.length}</b> templates · <b>${state.customExercises.filter((e) => !e.deleted).length}</b> custom exercises</p>
      <div class="btn-row">
        <button class="btn" data-act="export">Export backup</button>
        <label class="btn">Import backup<input type="file" accept="application/json,.json" data-act-file="import" hidden></label>
      </div>
    </div>
    <p class="small muted center">Workout Tracker · weights in lb</p>
  </div>`;

  root.onchange = async (e) => {
    const t = e.target;
    if (t.dataset.key) {
      st[t.dataset.key] = t.type === 'checkbox' ? t.checked : +t.value;
      await save('settings');
      toast('Saved');
    } else if (t.dataset.actFile === 'import' && t.files[0]) {
      const text = await t.files[0].text();
      if (!confirm('Importing replaces all workouts, templates and custom exercises on this device. Continue?')) { t.value = ''; return; }
      try {
        await importData(text);
        toast('Backup restored');
        rerender();
      } catch (err) {
        alert(`Couldn't import: ${err.message}`);
      }
    }
  };
  root.onclick = async (e) => {
    const t = e.target.closest('[data-act]');
    if (t?.dataset.act !== 'export') return;
    const blob = new Blob([exportData()], { type: 'application/json' });
    const name = `workout-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; } catch (err) { if (err.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  root.oninput = null;
}
