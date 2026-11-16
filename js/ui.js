// Shared UI: bottom sheets, toasts, exercise list / picker, custom exercise form.
import { state, allExercises, save, getExercise } from './store.js';
import { MUSCLES, EQUIPMENT, PATTERNS, slug } from './exercises.js';
import { esc, uid } from './util.js';

export function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, ms);
}

/** Open a bottom sheet. Returns { el, close }. onClick receives (action, target, event). */
export function sheet(html, { onClick, onInput, onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-backdrop" data-act="close"></div><div class="sheet">${html}</div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  const close = () => {
    wrap.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 200);
    onClose?.();
  };
  wrap.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'close') return close();
    onClick?.(t.dataset.act, t, e);
  });
  if (onInput) wrap.addEventListener('input', onInput);
  return { el: wrap.querySelector('.sheet'), close };
}

/** Simple list-of-actions sheet. actions: [{ label, act, danger }] */
export function actionSheet(title, actions, onPick) {
  const s = sheet(`
    <div class="sheet-head"><h3>${esc(title)}</h3></div>
    <div class="action-list">
      ${actions.map((a) => `<button class="action ${a.danger ? 'danger' : ''}" data-act="${a.act}">${esc(a.label)}</button>`).join('')}
      <button class="action" data-act="close">Cancel</button>
    </div>`, {
    onClick: (act) => { s.close(); onPick(act); },
  });
}

// ---------- exercise list (library + picker) ----------

export function filterExercises(query, equip) {
  const q = query.trim().toLowerCase();
  return allExercises().filter((e) =>
    (!equip.length || equip.includes(e.equipment))
    && (!q || e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q)));
}

export function equipChips(selected) {
  return `<div class="chips">${EQUIPMENT.map((eq) =>
    `<button class="chip ${selected.includes(eq) ? 'on' : ''}" data-act="equip" data-eq="${esc(eq)}">${esc(eq)}</button>`).join('')}</div>`;
}

export function groupedList(list, { selected = null, link = false } = {}) {
  if (!list.length) return '<p class="empty">No exercises match.</p>';
  const groups = MUSCLES.concat(['Other']).map((m) => [m, list.filter((e) => (MUSCLES.includes(e.muscle) ? e.muscle : 'Other') === m)]);
  return groups.filter(([, items]) => items.length).map(([m, items]) => `
    <h4 class="group-head">${esc(m)} <span>${items.length}</span></h4>
    <ul class="ex-list">${items.sort((a, b) => a.name.localeCompare(b.name)).map((e) => {
      const inner = `<span class="ex-name-txt">${esc(e.name)}${e.custom ? ' <em class="badge">custom</em>' : ''}</span><span class="ex-meta">${esc(e.equipment)}</span>`;
      if (link) return `<li><a href="#/exercise/${encodeURIComponent(e.id)}">${inner}</a></li>`;
      const on = selected?.includes(e.id);
      return `<li><button class="pick ${on ? 'on' : ''}" data-act="pick" data-id="${esc(e.id)}"><span class="pick-box">${on ? (selected.indexOf(e.id) + 1) : ''}</span>${inner}</button></li>`;
    }).join('')}</ul>`).join('');
}

function toggleEquip(eq) {
  const f = state.settings.equipFilter;
  state.settings.equipFilter = f.includes(eq) ? f.filter((x) => x !== eq) : [...f, eq];
  save('settings');
}

/**
 * Exercise picker. multi=true allows selecting several (order kept) and adding as a superset.
 * onDone(ids, asSuperset)
 */
export function openPicker({ multi = true, title = 'Add exercises', onDone, initial = [] }) {
  let query = '';
  const selected = [...initial];
  const s = sheet(`
    <div class="sheet-head">
      <h3>${esc(title)}</h3>
      <button class="icon-btn" data-act="close" aria-label="Close">✕</button>
    </div>
    <input class="search" type="search" placeholder="Search exercises or muscles" autocomplete="off">
    <div class="picker-chips"></div>
    <div class="picker-list"></div>
    <div class="sheet-foot picker-foot"></div>`, {
    onClick: (act, t) => {
      if (act === 'equip') { toggleEquip(t.dataset.eq); draw(); }
      else if (act === 'pick') {
        const id = t.dataset.id;
        if (!multi) { s.close(); onDone([id], false); return; }
        const i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1); else selected.push(id);
        draw();
      } else if (act === 'add') { s.close(); onDone([...selected], false); }
      else if (act === 'superset') { s.close(); onDone([...selected], true); }
      else if (act === 'custom') {
        s.close();
        // Reopen the picker afterwards with the new exercise selected.
        openCustomForm(null, (ex) => openPicker({ multi, title, onDone, initial: multi ? [...selected, ex.id] : [] }));
      }
    },
    onInput: (e) => { if (e.target.classList.contains('search')) { query = e.target.value; draw(); } },
  });
  const draw = () => {
    s.el.querySelector('.picker-chips').innerHTML = equipChips(state.settings.equipFilter);
    s.el.querySelector('.picker-list').innerHTML = groupedList(filterExercises(query, state.settings.equipFilter), { selected })
      + '<button class="btn ghost wide" data-act="custom">+ Create custom exercise</button>';
    s.el.querySelector('.picker-foot').innerHTML = multi ? `
      <button class="btn" data-act="superset" ${selected.length < 2 ? 'disabled' : ''}>Add as superset</button>
      <button class="btn primary" data-act="add" ${selected.length ? '' : 'disabled'}>Add ${selected.length || ''}</button>` : '';
  };
  draw();
}

/** Create or edit a custom exercise. onSaved(exercise) */
export function openCustomForm(existing, onSaved) {
  const ex = existing || { name: '', muscle: 'Chest', equipment: 'Dumbbell', pattern: '', unit: 'reps' };
  const opts = (list, cur) => list.map((v) => `<option ${v === cur ? 'selected' : ''}>${esc(v)}</option>`).join('');
  const s = sheet(`
    <div class="sheet-head"><h3>${existing ? 'Edit' : 'New'} custom exercise</h3><button class="icon-btn" data-act="close">✕</button></div>
    <form class="form">
      <label>Name<input name="name" required value="${esc(ex.name)}" placeholder="e.g. Landmine Press"></label>
      <label>Muscle group<select name="muscle">${opts(MUSCLES, ex.muscle)}</select></label>
      <label>Equipment<select name="equipment">${opts(EQUIPMENT, ex.equipment)}</select></label>
      <label>Movement pattern <small>(used to suggest swaps)</small>
        <select name="pattern"><option value="">None</option>${Object.entries(PATTERNS).map(([k, v]) => `<option value="${k}" ${k === ex.pattern ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <label>Measured in<select name="unit"><option value="reps" ${ex.unit !== 'sec' ? 'selected' : ''}>Reps</option><option value="sec" ${ex.unit === 'sec' ? 'selected' : ''}>Seconds (holds, carries)</option></select></label>
      <div class="sheet-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn primary" type="submit">Save</button></div>
    </form>`);
  s.el.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const name = String(f.get('name')).trim();
    if (!name) return;
    const data = { name, muscle: f.get('muscle'), equipment: f.get('equipment'), pattern: f.get('pattern') || null, unit: f.get('unit') };
    let saved;
    if (existing) {
      saved = Object.assign(existing, data);
    } else {
      saved = { id: `custom-${slug(name)}-${uid().slice(-4)}`, custom: true, ...data };
      state.customExercises.push(saved);
    }
    save('customExercises');
    s.close();
    toast(`Saved ${name}`);
    onSaved?.(saved);
  });
}

export const exName = (id) => getExercise(id).name;
