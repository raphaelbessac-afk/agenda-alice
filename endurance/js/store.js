// Persistência local (localStorage). Tudo fica só no aparelho.
import { DEFAULT_EXAMS } from './rules.js';
import { clone } from './utils.js';

const KEY = 'endurance:v1';

export function fresh() {
  return {
    v: 1,
    rev: 0,
    setup: null, // { startDate, setupDate }
    rules: {}, // { 'AAAA-MM': regras que valem a partir desse mês }
    days: {}, // { 'AAAA-MM-DD': { off: {id: bool}, c: {id: n}, joker, note } }
    closings: {}, // { 'AAAA-MM': { balance, spent, note, closedAt } }
    goal: null, // { name, amount }
    exams: clone(DEFAULT_EXAMS),
    strava: {},
    seenMedals: {},
    celebrated: {},
    lastBackup: null,
    hideInstall: false,
    mig: { runFri: true, saladManual: true, trainManual: true },
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = migrate(JSON.parse(raw));
      if (s._migrated) {
        delete s._migrated;
        localStorage.setItem(KEY, JSON.stringify(s));
      }
      return s;
    }
  } catch (e) {
    console.warn('Falha ao carregar dados', e);
  }
  return fresh();
}

let onSave = null;
export const setOnSave = (fn) => (onSave = fn);

export function save(S) {
  S.rev = (S.rev || 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(S));
    if (onSave) onSave();
    return true;
  } catch (e) {
    console.warn('Falha ao salvar', e);
    return false;
  }
}

export function replace(data) {
  const S = migrate(data);
  localStorage.setItem(KEY, JSON.stringify(S));
  return S;
}

export function wipe() {
  localStorage.removeItem(KEY);
}

function makeManual(s, ids) {
  for (const r of Object.values(s.rules || {})) for (const h of r.recurring || []) if (ids.includes(h.id)) h.manual = true;
  if (!s.setup) return;
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const t = key(new Date());
  for (const d = new Date(s.setup.startDate + 'T00:00:00'); key(d) < t; d.setDate(d.getDate() + 1)) {
    const e = (s.days[key(d)] = s.days[key(d)] || {});
    e.off = e.off || {};
    for (const id of ids) if (e.off[id] === undefined) e.off[id] = false; // feito, como era antes
  }
}

function migrate(s) {
  const f = fresh();
  for (const k of Object.keys(f)) if (!(k in s)) s[k] = f[k];
  s.mig = s.mig || {};
  // v1.1: corrida passa de domingo para sexta (seg, qua, sex, sáb)
  if (!s.mig.runFri) {
    for (const r of Object.values(s.rules || {})) {
      const run = (r.recurring || []).find((h) => h.id === 'run');
      if (run && [...run.days].sort().join() === '0,1,3,6') run.days = [1, 3, 5, 6];
    }
    const rem = (s.reminders || []).find((x) => x.id === 'run');
    if (rem && rem.days === 'SA,SU,MO,WE') rem.days = 'FR,SA,MO,WE';
    s.mig.runFri = true;
    s._migrated = true;
  }
  // v1.2: salada manual. v1.3: corrida e academia manuais também.
  // Os dias que já passaram ficam como estavam; a partir de hoje é manual.
  if (!s.mig.saladManual) {
    makeManual(s, ['salad']);
    s.mig.saladManual = true;
    s._migrated = true;
  }
  if (!s.mig.trainManual) {
    makeManual(s, ['run', 'gym']);
    s.mig.trainManual = true;
    s._migrated = true;
  }
  return s;
}
