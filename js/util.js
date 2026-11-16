export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

// Parse a numeric input; empty stays empty so placeholders show.
export const parseField = (v) => (String(v).trim() === '' ? '' : num(v));

export const fmtW = (w) => (w === '' || w == null ? '' : String(Math.round(num(w) * 100) / 100));

export const fmtSec = (s) => {
  s = Math.max(0, Math.ceil(s));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

export const dayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const fmtDate = (ts, opts = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Date(ts).toLocaleDateString(undefined, opts);

export const fmtTime = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const fmtDuration = (ms) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
