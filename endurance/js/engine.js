// Motor de cálculo: valores do mês, avaliação de cada dia, bônus, saldo e projeção.
import { addDays, addMonths, daysInMonth, diffDays, monthEnd, monthStart, pad, todayISO, weekday, ymOf } from './utils.js';
import { RUN_TYPES, GYM_TYPES } from './rules.js';

export function rulesFor(S, ym) {
  const keys = Object.keys(S.rules).sort();
  let r = S.rules[keys[0]];
  for (const k of keys) if (k <= ym) r = S.rules[k];
  return r;
}

// Valor de cada hábito recorrente num mês: peso × pote ÷ Σ(peso × ocorrências).
export function computeValues(r, ym) {
  const [y, m] = ym.split('-').map(Number);
  const n = daysInMonth(ym);
  const occ = {};
  r.recurring.forEach((h) => (occ[h.id] = 0));
  for (let d = 1; d <= n; d++) {
    const wd = new Date(y, m - 1, d).getDay();
    r.recurring.forEach((h) => {
      if (h.days.includes(wd)) occ[h.id]++;
    });
  }
  const denom = r.recurring.reduce((a, h) => a + h.weight * occ[h.id], 0);
  const values = {};
  r.recurring.forEach((h) => (values[h.id] = denom ? (h.weight * r.pool) / denom : 0));
  return { values, occ };
}

const memo = { key: null, vals: new Map(), tl: null, months: new Map() };
function check(S) {
  const k = `${S.rev}|${todayISO()}`;
  if (memo.key !== k) {
    memo.key = k;
    memo.vals = new Map();
    memo.tl = null;
    memo.months = new Map();
  }
}

export function monthValues(S, ym) {
  check(S);
  if (!memo.vals.has(ym)) {
    const rules = rulesFor(S, ym);
    memo.vals.set(ym, { rules, ...computeValues(rules, ym) });
  }
  return memo.vals.get(ym);
}

export function stravaActs(S, date, types) {
  const a = S.strava?.acts?.[date];
  return a ? a.filter((x) => types.includes(x.type)) : [];
}
export const stravaRuns = (S, date) => stravaActs(S, date, RUN_TYPES);
export const stravaGym = (S, date) => stravaActs(S, date, GYM_TYPES);

function evalBase(S, date) {
  const { values, rules: r } = monthValues(S, ymOf(date));
  const e = S.days[date] || {};
  const joker = !!e.joker;
  const wd = weekday(date);
  const today = todayISO();
  const st = S.strava || {};
  let earned = 0;
  let lost = 0;

  const recurring = r.recurring
    .filter((h) => h.days.includes(wd))
    .map((h) => {
      const ov = e.off ? e.off[h.id] : undefined;
      let done;
      let auto = false;
      let pending = false;
      if (ov === undefined && h.manual) {
        // Hábito manual: só conta quando você marca. Hoje fica "pendente".
        done = false;
        pending = date === today;
      } else if (ov === undefined) {
        done = true;
        // Desmarca corrida sem atividade no Strava (dias passados, se o usuário ativou)
        if (h.id === 'run' && st.autoUncheck && st.token && st.coverFrom && date >= st.coverFrom && date < today && stravaRuns(S, date).length === 0) {
          done = false;
          auto = true;
        }
      } else done = !ov;
      if (joker) {
        done = true;
        pending = false;
      }
      const amount = done ? values[h.id] : 0;
      earned += amount;
      return { h, done, value: values[h.id], amount, autoOff: auto, pending };
    });

  const c = e.c || {};
  const extras = r.extras.map((h) => {
    const n = c[h.id] || 0;
    const amount = n * h.value;
    earned += amount;
    return { h, n, amount };
  });
  const penalties = r.penalties.map((h) => {
    const n = c[h.id] || 0;
    const amount = h.type === 'tiers' ? (n ? h.tiers[Math.min(n, h.tiers.length) - 1].value : 0) : n * h.value;
    lost += amount;
    return { h, n, amount };
  });

  return { date, ym: ymOf(date), rules: r, joker, recurring, extras, penalties, bonuses: [], earned, lost, note: e.note || '' };
}

// Percorre todos os dias desde o início, calculando sequências e bônus.
export function timeline(S) {
  check(S);
  if (memo.tl) return memo.tl;
  const days = {};
  const order = [];
  const start = S.setup.startDate;
  const today = todayISO();
  let streak = 0;
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const b = evalBase(S, d);
    const r = b.rules;
    const sc = r.bonuses.streak;
    const rec = sc && b.recurring.find((x) => x.h.id === sc.habit);
    if (rec) {
      if (rec.pending) {
        // hoje ainda não marcado: não quebra a sequência
      } else if (rec.done) {
        streak++;
        if (sc.every > 0 && sc.value > 0 && streak % sc.every === 0)
          b.bonuses.push({ id: 'streak', emoji: '🔥', label: `${streak} dias seguidos: ${rec.h.name.toLowerCase()}`, amount: sc.value });
      } else streak = 0;
    }
    b.streak = streak;

    const pw = r.bonuses.perfectWeek;
    if (pw && pw.value > 0 && weekday(d) === 0) {
      const mon = addDays(d, -6);
      if (mon >= start) {
        let ok = true;
        let any = false;
        for (let i = 0; i < 7; i++) {
          const bb = i === 6 ? b : days[addDays(mon, i)];
          for (const x of bb.recurring) {
            if (pw.habits.includes(x.h.id)) {
              any = true;
              if (!x.done) ok = false;
            }
          }
        }
        if (ok && any) b.bonuses.push({ id: 'week', emoji: '🏁', label: 'Semana perfeita de treinos', amount: pw.value });
      }
    }

    b.bonusTotal = b.bonuses.reduce((a, x) => a + x.amount, 0);
    b.earned += b.bonusTotal;
    b.net = b.earned - b.lost;
    const allDone = b.recurring.every((x) => x.done);
    b.status = b.lost > 0 ? (b.net < 0 ? 'bad' : 'mixed') : allDone ? 'perfect' : 'partial';
    days[d] = b;
    order.push(d);
  }
  memo.tl = { days, order, streak };
  return memo.tl;
}

export function monthSummary(S, ym) {
  check(S);
  if (memo.months.has(ym)) return memo.months.get(ym);
  const T = timeline(S);
  const start = S.setup.startDate;
  const startYm = ymOf(start);
  const today = todayISO();
  const { values, rules: r, occ } = monthValues(S, ym);
  const n = daysInMonth(ym);
  let earned = 0, lost = 0, bonus = 0, recDone = 0, recPossible = 0, future = 0, jokers = 0, km = 0;
  const days = [];
  const stats = {};
  r.recurring.forEach((h) => (stats[h.id] = { h, kind: 'rec', done: 0, sched: 0, amount: 0 }));
  r.extras.forEach((h) => (stats[h.id] = { h, kind: 'extra', n: 0, days: 0, amount: 0 }));
  r.penalties.forEach((h) => (stats[h.id] = { h, kind: 'pen', n: 0, days: 0, amount: 0 }));

  for (let i = 1; i <= n; i++) {
    const d = `${ym}-${pad(i)}`;
    if (d < start) continue;
    if (d > today) {
      const wd = weekday(d);
      r.recurring.forEach((h) => {
        if (h.days.includes(wd)) future += values[h.id];
      });
      continue;
    }
    const b = T.days[d];
    days.push(b);
    earned += b.earned;
    lost += b.lost;
    bonus += b.bonusTotal;
    if (b.joker) jokers++;
    stravaRuns(S, d).forEach((a) => (km += a.km));
    b.recurring.forEach((x) => {
      if (x.pending) {
        future += x.value; // ainda dá tempo hoje
        const s0 = stats[x.h.id];
        if (s0) s0.sched++;
        return;
      }
      recPossible += x.value;
      recDone += x.amount;
      const s = stats[x.h.id];
      if (s) {
        s.sched++;
        s.amount += x.amount;
        if (x.done) s.done++;
      }
    });
    [...b.extras, ...b.penalties].forEach((x) => {
      const s = stats[x.h.id];
      if (s) {
        s.n += x.n;
        if (x.n) s.days++;
        s.amount += x.amount;
      }
    });
  }
  const net = earned - lost;
  const carryIn = ym > startYm ? Math.min(0, monthSummary(S, addMonths(ym, -1)).balance) : 0;
  const balance = net + carryIn;
  const rate = recPossible ? recDone / recPossible : 1;
  const res = {
    ym, rules: r, values, occ, days, earned, lost, bonus, net, carryIn, balance, future, rate, recDone, recPossible, jokers, stats, km,
    projection: balance + rate * future,
    pool: r.pool,
    complete: monthEnd(ym) < today,
    fullTracked: monthStart(ym) >= start,
    started: ym >= startYm,
    closing: S.closings[ym] || null,
  };
  memo.months.set(ym, res);
  return res;
}

export function isClosed(S, ym) {
  return !!S.closings[ym];
}

export function canEdit(S, date) {
  const t = todayISO();
  if (!S.setup || date > t || date < S.setup.startDate) return false;
  if (isClosed(S, ymOf(date))) return false;
  if (diffDays(date, t) <= 2) return true;
  return diffDays(S.setup.setupDate, t) <= 2; // período de ajuste logo após instalar
}

export function editableDates(S) {
  const t = todayISO();
  const out = [];
  for (let d = S.setup.startDate; d <= t; d = addDays(d, 1)) if (canEdit(S, d)) out.push(d);
  return out;
}

export function jokersLeft(S, ym) {
  const r = rulesFor(S, ym);
  const used = Object.keys(S.days).filter((d) => d.startsWith(ym) && S.days[d].joker).length;
  return Math.max(0, (r.bonuses.jokers || 0) - used);
}

export function pendingClosings(S) {
  if (!S.setup) return [];
  const cur = ymOf(todayISO());
  const out = [];
  for (let ym = ymOf(S.setup.startDate); ym < cur; ym = addMonths(ym, 1)) if (!S.closings[ym]) out.push(ym);
  return out;
}

export function monthsTracked(S) {
  const cur = ymOf(todayISO());
  const out = [];
  for (let ym = ymOf(S.setup.startDate); ym <= cur; ym = addMonths(ym, 1)) out.push(ym);
  return out;
}

// Exames: próximo vencimento
export function examStatus(ex, today = todayISO()) {
  if (!ex.last) return { state: 'none', due: null, days: null };
  const d = new Date(ex.last + 'T00:00:00');
  d.setMonth(d.getMonth() + Number(ex.months || 12));
  const due = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const days = diffDays(today, due);
  return { state: days < 0 ? 'late' : days <= 30 ? 'soon' : 'ok', due, days };
}
