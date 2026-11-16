// Rest timer overlay. Counts down from an end timestamp so it stays correct
// if the phone sleeps or you switch apps; state survives an app reload.
import { state } from './store.js';
import { fmtSec } from './util.js';

const KEY = 'wt-rest-timer';
let endAt = 0, total = 0, label = '', iv = null, hideTimeout = null, audioCtx = null;
let el;

function mount() {
  if (el) return;
  el = document.createElement('div');
  el.id = 'timer';
  el.hidden = true;
  el.innerHTML = `
    <div class="timer-backdrop" data-t="min"></div>
    <div class="timer-card" role="dialog" aria-label="Rest timer">
      <div class="timer-top"><span class="timer-title">Rest</span><button class="icon-btn" data-t="min" aria-label="Minimize">–</button></div>
      <div class="timer-ring">
        <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="52"/><circle class="ring-fg" cx="60" cy="60" r="52"/></svg>
        <div class="timer-time">0:00</div>
      </div>
      <div class="timer-label"></div>
      <div class="timer-btns">
        <button class="btn" data-t="-15">−15s</button>
        <button class="btn primary" data-t="skip">Skip</button>
        <button class="btn" data-t="+15">+15s</button>
      </div>
    </div>
    <button class="timer-pill" data-t="max"><span class="pill-time">0:00</span> rest</button>`;
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (!t) return;
    if (t === 'min') setMin(true);
    else if (t === 'max') setMin(false);
    else if (t === 'skip') stop();
    else adjust(parseInt(t, 10));
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && iv) tick(); });
}

function setMin(min) {
  el.classList.toggle('min', min);
}

// Call from a tap handler so iOS lets us play sound later.
export function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* no audio */ }
}

function beep() {
  if (!state.settings.sound || !audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.25, 0.5].forEach((dt, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t0 + dt);
    g.gain.exponentialRampToValueAtTime(0.4, t0 + dt + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + dt);
    o.stop(t0 + dt + 0.22);
  });
}

function persist() {
  try {
    if (endAt) localStorage.setItem(KEY, JSON.stringify({ endAt, total, label }));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
}

export function startRest(seconds, nextLabel = '') {
  mount();
  clearTimeout(hideTimeout);
  total = seconds;
  endAt = Date.now() + seconds * 1000;
  label = nextLabel;
  el.hidden = false;
  el.classList.remove('finished');
  setMin(false);
  persist();
  clearInterval(iv);
  iv = setInterval(tick, 250);
  tick();
}

export function resumeRest() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved && saved.endAt > Date.now()) {
      startRest((saved.endAt - Date.now()) / 1000, saved.label);
      total = saved.total;
      tick();
    } else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}

function adjust(delta) {
  if (!iv) return;
  endAt = Math.max(Date.now() + 1000, endAt + delta * 1000);
  total = Math.max(total + delta, (endAt - Date.now()) / 1000);
  persist();
  tick();
}

function tick() {
  const left = Math.max(0, (endAt - Date.now()) / 1000);
  const ring = el.querySelector('.ring-fg');
  const c = 2 * Math.PI * 52;
  ring.style.strokeDasharray = c;
  ring.style.strokeDashoffset = c * (1 - (total ? left / total : 0));
  el.querySelector('.timer-time').textContent = fmtSec(left);
  el.querySelector('.pill-time').textContent = fmtSec(left);
  el.querySelector('.timer-label').textContent = label;
  if (left <= 0) finish();
}

function finish() {
  clearInterval(iv);
  iv = null;
  endAt = 0;
  persist();
  el.classList.add('finished');
  el.querySelector('.timer-title').textContent = 'Rest over — go!';
  setMin(false);
  beep();
  if (state.settings.vibrate) navigator.vibrate?.([300, 150, 300]);
  hideTimeout = setTimeout(() => stop(), 4000);
}

export function stop() {
  clearInterval(iv);
  clearTimeout(hideTimeout);
  iv = null;
  endAt = 0;
  persist();
  if (el) {
    el.hidden = true;
    el.classList.remove('finished');
    el.querySelector('.timer-title').textContent = 'Rest';
  }
}
