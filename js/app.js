// Entry point: hash router + tab bar.
import { load, state } from './store.js';
import { resumeRest } from './timer.js';
import * as home from './views/home.js';
import * as workout from './views/workout.js';
import * as hist from './views/history.js';
import * as library from './views/library.js';
import * as settings from './views/settings.js';

const routes = [
  [/^#?\/?$/, home.render, 'home'],
  [/^#\/workout$/, workout.render, 'home'],
  [/^#\/history$/, hist.render, 'history'],
  [/^#\/session\/(.+)$/, hist.renderSession, 'history'],
  [/^#\/exercises$/, library.render, 'exercises'],
  [/^#\/exercise\/(.+)$/, library.renderExercise, 'exercises'],
  [/^#\/settings$/, settings.render, 'settings'],
];

const root = document.getElementById('view');
let cleanup = null;

function draw() {
  cleanup?.();
  cleanup = null;
  root.oninput = root.onchange = root.onfocusin = null;
  const hash = location.hash || '#/';
  for (const [re, view, tab] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    cleanup = view(root, ...m.slice(1)) || null;
    document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
    document.querySelector('.tabbar .live')?.toggleAttribute('hidden', !state.active);
    return;
  }
  location.replace('#/');
}

// Re-render the current screen, keeping scroll position.
export function rerender() {
  const y = window.scrollY;
  draw();
  window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => {
  draw();
  window.scrollTo(0, 0);
});

(async () => {
  await load();
  draw();
  resumeRest();
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
})();
