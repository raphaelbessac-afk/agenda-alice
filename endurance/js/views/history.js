// Tela "Histórico": calendário, gráfico mês a mês, estatísticas e fechamento.
import { brl, cap, monthName, monthLabel, MONTHS_SHORT, WD_LETTER, daysInMonth, pad, todayISO, ymOf, addMonths, weekday, esc, fmtDay, num } from '../utils.js';
import { monthSummary, monthsTracked, timeline, canEdit, stravaRuns } from '../engine.js';
import { hero } from './today.js';

function chart(S) {
  const months = monthsTracked(S).slice(-12);
  const data = months.map((ym) => ({ ym, v: monthSummary(S, ym).balance, pool: monthSummary(S, ym).pool }));
  const max = Math.max(...data.map((d) => Math.max(d.v, d.pool)), 1);
  const min = Math.min(0, ...data.map((d) => d.v));
  const H = 150, top = 14, bottom = 22;
  const span = max - min || 1;
  const y = (v) => top + ((max - v) / span) * (H - top - bottom);
  const bw = Math.min(38, 300 / Math.max(data.length, 1) - 10);
  const gap = 10;
  const W = Math.max(data.length * (bw + gap) + gap, 300);
  const cur = ymOf(todayISO());
  const bars = data
    .map((d, i) => {
      const x = gap + i * (bw + gap);
      const y0 = y(0), y1 = y(d.v);
      const hgt = Math.max(2, Math.abs(y1 - y0));
      const cls = d.v < 0 ? 'neg' : d.v >= d.pool ? 'win' : 'pos';
      return `<g class="bar ${cls} ${d.ym === cur ? 'cur' : ''}" data-act="h-month" data-ym="${d.ym}">
        <rect x="${x}" y="${Math.min(y0, y1)}" width="${bw}" height="${hgt}" rx="6"/>
        <text class="v" x="${x + bw / 2}" y="${d.v < 0 ? y1 + 12 : y1 - 4}">${Math.round(d.v)}</text>
        <text class="l" x="${x + bw / 2}" y="${H - 6}">${MONTHS_SHORT[Number(d.ym.slice(5)) - 1]}</text>
      </g>`;
    })
    .join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMinYMid meet">
    <line class="goal" x1="0" x2="${W}" y1="${y(data[0]?.pool || 300)}" y2="${y(data[0]?.pool || 300)}"/>
    <text class="goal-t" x="${W - 4}" y="${y(data[0]?.pool || 300) - 4}">meta ${data[0]?.pool || 300}</text>
    <line class="zero" x1="0" x2="${W}" y1="${y(0)}" y2="${y(0)}"/>
    ${bars}
  </svg>`;
}

function calendar(S, ym) {
  const T = timeline(S);
  const n = daysInMonth(ym);
  const first = weekday(`${ym}-01`);
  const today = todayISO();
  let cells = WD_LETTER.map((l) => `<span class="wh">${l}</span>`).join('');
  for (let i = 0; i < first; i++) cells += '<span></span>';
  for (let i = 1; i <= n; i++) {
    const d = `${ym}-${pad(i)}`;
    const b = T.days[d];
    if (!b) {
      cells += `<span class="cd ${d > today ? 'future' : 'none'}"><b>${i}</b></span>`;
      continue;
    }
    cells += `<button class="cd ${b.status} ${d === today ? 'today' : ''} ${b.joker ? 'joker' : ''}" data-act="h-day" data-date="${d}"><b>${i}</b><small>${Math.round(b.net)}</small></button>`;
  }
  return `<div class="cal">${cells}</div>
  <div class="legend"><span><i class="perfect"></i>perfeito</span><span><i class="partial"></i>parcial</span><span><i class="mixed"></i>deslize</span><span><i class="bad"></i>negativo</span></div>`;
}

function statsBlock(S, ym) {
  const ms = monthSummary(S, ym);
  const prevYm = addMonths(ym, -1);
  const prev = prevYm >= ymOf(S.setup.startDate) ? monthSummary(S, prevYm) : null;
  const rows = Object.values(ms.stats).map((s) => {
    const p = prev && prev.stats[s.h.id];
    if (s.kind === 'rec') {
      const pct = s.sched ? Math.round((s.done / s.sched) * 100) : 0;
      return `<div class="st"><span>${s.h.emoji}</span><div><b>${esc(s.h.name)}</b><div class="bar sm"><i style="width:${pct}%"></i></div></div><span class="sv">${s.done}/${s.sched}<small>${brl(s.amount)}</small></span></div>`;
    }
    const delta = p ? s.n - p.n : null;
    const arrow = delta === null || delta === 0 ? '' : s.kind === 'pen' ? (delta < 0 ? `<em class="good">▼${-delta}</em>` : `<em class="bad">▲${delta}</em>`) : delta > 0 ? `<em class="good">▲${delta}</em>` : `<em class="bad">▼${-delta}</em>`;
    return `<div class="st ${s.kind}"><span>${s.h.emoji}</span><div><b>${esc(s.h.name)}</b><small>${s.kind === 'pen' ? (s.h.type === 'tiers' ? `${s.days} dias` : `${s.n}×`) : `${s.n}×`} ${arrow}</small></div><span class="sv ${s.kind === 'pen' ? 'neg' : 'pos'}">${s.kind === 'pen' ? brl(-s.amount) : brl(s.amount, true)}</span></div>`;
  });
  const runKm = ms.km ? `<div class="st"><span>📍</span><div><b>Distância corrida</b><small>Strava</small></div><span class="sv">${num(ms.km)} km</span></div>` : '';
  return `<div class="stats">${rows.join('')}${runKm}</div>`;
}

export function renderHistory(app) {
  const { S, ui } = app;
  const cur = ymOf(todayISO());
  const startYm = ymOf(S.setup.startDate);
  const ym = ui.hYm && ui.hYm >= startYm && ui.hYm <= cur ? ui.hYm : cur;
  ui.hYm = ym;
  const ms = monthSummary(S, ym);
  const months = monthsTracked(S);
  const totalWon = months.reduce((a, m) => a + Math.max(0, monthSummary(S, m).balance), 0);
  const spent = Object.values(S.closings).reduce((a, c) => a + (Number(c.spent) || 0), 0);
  const best = months.reduce((a, m) => Math.max(a, monthSummary(S, m).balance), -Infinity);

  let html = `<header class="top"><h1>Histórico</h1></header>`;
  html += `
  <section class="totals">
    <div class="tot big"><small>Total conquistado</small><b>${brl(totalWon)}</b><span>${months.length} ${months.length === 1 ? 'mês' : 'meses'} de prova</span></div>
    <div class="tot"><small>Já gasto</small><b>${brl(spent)}</b></div>
    <div class="tot"><small>Melhor mês</small><b>${brl(best === -Infinity ? 0 : best)}</b></div>
  </section>`;
  html += `<section class="card"><h3>Mês a mês</h3>${chart(S)}</section>`;
  html += `
  <div class="month-nav">
    <button class="icon-btn" data-act="h-prev" ${ym <= startYm ? 'disabled' : ''} aria-label="Mês anterior">‹</button>
    <h2>${monthLabel(ym)}</h2>
    <button class="icon-btn" data-act="h-next" ${ym >= cur ? 'disabled' : ''} aria-label="Próximo mês">›</button>
  </div>`;
  html += hero(S, ms);
  if (ms.closing) {
    html += `<section class="card closed"><div class="row"><span class="gi">🧾</span><div><small>Mês fechado</small><b>${ms.closing.spent ? `Gastou ${brl(ms.closing.spent)}` : 'Fechado'}</b>${ms.closing.note ? `<p>${esc(ms.closing.note)}</p>` : ''}</div></div></section>`;
  } else if (ms.complete) {
    html += `<button class="banner closing" data-act="open-closing" data-ym="${ym}"><span>🏁</span><div><b>Fechar ${monthName(ym)}</b><small>Registre o prêmio e no que gastou.</small></div><span class="go">›</span></button>`;
  }
  html += `<section class="card">${calendar(S, ym)}</section>`;
  html += `<section class="card"><h3>Hábitos no mês</h3>${statsBlock(S, ym)}</section>`;
  const notes = ms.days.filter((b) => b.note);
  if (notes.length)
    html += `<section class="card"><h3>📝 Notas</h3>${notes
      .slice(-8)
      .reverse()
      .map((b) => `<div class="noteline"><small>${cap(fmtDay(b.date))}</small><p>${esc(b.note)}</p></div>`)
      .join('')}</section>`;
  return html;
}

export function dayDetail(app, date) {
  const S = app.S;
  const b = timeline(S).days[date];
  const runs = stravaRuns(S, date);
  const line = (emoji, name, amt, cls = '') => `<div class="dl ${cls}"><span>${emoji}</span><b>${esc(name)}</b><em>${amt}</em></div>`;
  let h = `<div class="sheet-head"><h2>${cap(fmtDay(date))}</h2><span class="net ${b.net >= 0 ? 'pos' : 'neg'}">${brl(b.net, true)}</span></div>`;
  if (b.joker) h += `<p class="hint">🧊 Coringa usado neste dia.</p>`;
  h += b.recurring.map((x) => line(x.h.emoji, x.h.name, x.done ? brl(x.amount, true) : 'não fez', x.done ? 'pos' : 'off')).join('');
  h += b.extras.filter((x) => x.n).map((x) => line(x.h.emoji, `${x.h.name} ×${x.n}`, brl(x.amount, true), 'pos')).join('');
  h += b.bonuses.map((x) => line(x.emoji, x.label, brl(x.amount, true), 'pos')).join('');
  h += b.penalties.filter((x) => x.n).map((x) => line(x.h.emoji, x.h.type === 'tiers' ? `${x.h.name} (${x.h.tiers[x.n - 1].label})` : x.h.type === 'toggle' ? x.h.name : `${x.h.name} ×${x.n}`, brl(-x.amount), 'neg')).join('');
  if (runs.length) h += runs.map((r) => line('📍', `${r.name} · ${num(r.km)} km`, `${r.min} min`)).join('');
  if (b.note) h += `<p class="note-view">📝 ${esc(b.note)}</p>`;
  if (canEdit(S, date)) h += `<button class="btn primary block" data-act="edit-day" data-date="${date}">Editar este dia</button>`;
  else h += `<p class="hint center">Só dá para editar até 2 dias para trás.</p>`;
  return h;
}

export const historyActions = {
  'h-prev'(app) {
    app.ui.hYm = addMonths(app.ui.hYm, -1);
    app.render();
  },
  'h-next'(app) {
    app.ui.hYm = addMonths(app.ui.hYm, 1);
    app.render();
  },
  'h-month'(app, el) {
    app.ui.hYm = el.dataset.ym;
    app.render();
    document.querySelector('.month-nav')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'h-day'(app, el) {
    app.openSheet(() => dayDetail(app, el.dataset.date));
  },
  'edit-day'(app, el) {
    app.closeSheet();
    app.ui.date = el.dataset.date;
    app.go('hoje');
  },
};
