// Tela "Hoje": dashboard do mês + marcação do dia.
import { brl, clamp, daysInMonth, esc, relDay, fmtDay, monthName, cap, todayISO, ymOf, weekday, addDays, WD_LETTER, num, diffDays } from '../utils.js';
import { timeline, monthSummary, canEdit, editableDates, jokersLeft, pendingClosings, examStatus, stravaRuns, stravaGym } from '../engine.js';
import { burst, floatText, centerOf, toast } from '../fx.js';

export function hero(S, ms, { compact = false } = {}) {
  const today = todayISO();
  const ym = ms.ym;
  const dim = daysInMonth(ym);
  const dayN = ym === ymOf(today) ? Number(today.slice(8)) : dim;
  const pct = clamp(ms.balance / ms.pool, 0, 1);
  const over = ms.balance - ms.pool;
  const neg = ms.balance < 0;
  return `
  <section class="hero ${neg ? 'hero-neg' : ''} ${over >= 0 ? 'won' : ''}">
    <div class="hero-top">
      <span class="pill glass">${cap(monthName(ym))} · dia ${dayN} de ${dim}</span>
      ${ms.carryIn < 0 ? `<span class="pill glass warn">dívida ${brl(ms.carryIn)}</span>` : ''}
    </div>
    <div class="hero-label">${ym === ymOf(today) ? 'Saldo do mês' : 'Saldo final'}</div>
    <div class="hero-amount" data-count="${ms.balance.toFixed(2)}">${brl(ms.balance)}</div>
    <div class="hero-sub">de ${brl(ms.pool)} em jogo${over > 0 ? ` · <b>+${brl(over)} de volta extra!</b>` : ''}</div>
    <div class="track" role="img" aria-label="Progresso: ${Math.round(pct * 100)}% do pote">
      <div class="lanes"></div>
      <div class="trail" style="width:${pct * 100}%"></div>
      <div class="mark" style="left:33.33%"><span>${brl(ms.pool / 3).replace(',00', '')}</span></div>
      <div class="mark" style="left:66.66%"><span>${brl((ms.pool * 2) / 3).replace(',00', '')}</span></div>
      <div class="finish"></div>
      <div class="runner ${neg ? 'sad' : ''}" style="left:${pct * 100}%"><span>🏃</span></div>
    </div>
    ${compact ? '' : `
    <div class="hero-stats">
      <div><small>Ganhou</small><b>${brl(ms.earned)}</b></div>
      <div><small>Perdeu</small><b>${brl(-ms.lost)}</b></div>
      <div><small>${ms.complete ? 'Bônus' : 'Projeção'}</small><b>${ms.complete ? brl(ms.bonus) : brl(ms.projection)}</b></div>
    </div>`}
  </section>`;
}

function dayChips(S, sel) {
  const dates = editableDates(S);
  if (dates.length <= 1) return '';
  const T = timeline(S);
  return `<div class="chips" id="daychips">${dates
    .map((d) => {
      const b = T.days[d];
      const lbl = diffDays(d, todayISO()) <= 2 ? relDay(d) : `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][weekday(d)]} ${Number(d.slice(8))}`;
      return `<button class="chip ${d === sel ? 'on' : ''}" data-act="pick-date" data-date="${d}"><i class="dot ${b.status}"></i>${lbl}</button>`;
    })
    .join('')}</div>`;
}

function recCard(S, x, date) {
  const runs = x.h.id === 'run' ? stravaRuns(S, date) : x.h.id === 'gym' ? stravaGym(S, date) : [];
  const km = runs.reduce((a, r) => a + r.km, 0);
  const strava = runs.length ? `<span class="tag strava">Strava ✓ ${x.h.id === 'run' ? `${num(km)} km` : `${runs[0].min} min`}</span>` : '';
  const auto = x.autoOff ? `<span class="tag muted">sem corrida no Strava</span>` : '';
  return `
  <button class="habit rec ${x.done ? 'done' : 'off'}" data-act="toggle" data-id="${x.h.id}" aria-pressed="${x.done}">
    <span class="hi">${x.h.emoji}</span>
    <span class="hn"><b>${esc(x.h.name)}</b><small>${x.done ? `+${brl(x.value)}` : `não fiz · ${brl(x.value)} perdidos`} ${strava}${auto}</small></span>
    <span class="check">${x.done ? '✓' : ''}</span>
  </button>`;
}

function extraCard(x) {
  return `
  <div class="habit extra ${x.n ? 'has' : ''}">
    <span class="hi">${x.h.emoji}</span>
    <span class="hn"><b>${esc(x.h.name)}</b><small>+${brl(x.h.value)} cada${x.n ? ` · <em>${brl(x.amount, true)}</em>` : ''}</small></span>
    <div class="stepper">
      <button data-act="dec" data-id="${x.h.id}" ${x.n ? '' : 'disabled'} aria-label="Remover">−</button>
      <b>${x.n}</b>
      <button data-act="inc" data-id="${x.h.id}" aria-label="Adicionar">+</button>
    </div>
  </div>`;
}

function penaltyTile(x) {
  const h = x.h;
  if (h.type === 'tiers') {
    return `
    <div class="pen wide ${x.n ? 'hit' : ''}">
      <span class="pe">${h.emoji}</span><span class="pn">${esc(h.name)}</span>
      <div class="seg">
        <button class="${x.n === 0 ? 'on' : ''}" data-act="tier" data-id="${h.id}" data-v="0">Nada</button>
        ${h.tiers.map((t, i) => `<button class="${x.n === i + 1 ? 'on bad' : ''}" data-act="tier" data-id="${h.id}" data-v="${i + 1}">${esc(t.label)}<small>${brl(-t.value)}</small></button>`).join('')}
      </div>
    </div>`;
  }
  if (h.type === 'toggle') {
    return `
    <button class="pen wide toggle ${x.n ? 'hit' : ''}" data-act="ptoggle" data-id="${h.id}" aria-pressed="${!!x.n}">
      <span class="pe">${h.emoji}</span><span class="pn">${esc(h.name)}<small>${brl(-h.value)}</small></span>
      <span class="switch ${x.n ? 'on' : ''}"><i></i></span>
    </button>`;
  }
  return `
  <div class="pen ${x.n ? 'hit' : ''}">
    <button class="pen-main" data-act="inc" data-id="${h.id}">
      <span class="pe">${h.emoji}</span>
      <span class="pn">${esc(h.name)}</span>
      <small>${brl(-h.value)}</small>
    </button>
    ${x.n ? `<span class="badge">${x.n}×</span><button class="pen-undo" data-act="dec" data-id="${h.id}" aria-label="Desfazer">−</button>` : ''}
  </div>`;
}

function weekProgress(S, date) {
  const T = timeline(S);
  const wd = weekday(date);
  const mon = addDays(date, -((wd + 6) % 7));
  const today = todayISO();
  const dots = [];
  let done = 0, total = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const b = T.days[d];
    let st = 'rest';
    const w = weekday(d);
    const habits = (b ? b.rules : null) || T.days[today].rules;
    const sched = habits.recurring.filter((h) => habits.bonuses.perfectWeek.habits.includes(h.id) && h.days.includes(w));
    if (sched.length) {
      total += sched.length;
      if (b && d <= today) {
        const ok = b.recurring.filter((x) => habits.bonuses.perfectWeek.habits.includes(x.h.id) && x.done).length;
        done += ok;
        st = ok === sched.length ? 'ok' : 'miss';
        if (d === today && ok === sched.length) st = 'ok today';
      } else st = d < S.setup.startDate ? 'rest' : 'todo';
    }
    dots.push(`<i class="wd ${st}"><span>${WD_LETTER[w]}</span></i>`);
  }
  return { done, total, dots: dots.join('') };
}

export function renderToday(app) {
  const { S, ui } = app;
  const today = todayISO();
  const ym = ymOf(today);
  const ms = monthSummary(S, ym);
  const T = timeline(S);
  let date = ui.date && canEdit(S, ui.date) ? ui.date : today;
  if (!canEdit(S, date)) date = today;
  ui.date = date;
  const b = T.days[date];
  const r = b.rules;
  const left = jokersLeft(S, ymOf(date));
  const pend = pendingClosings(S);
  const wp = weekProgress(S, today);
  const sc = r.bonuses.streak;
  const streakHabit = r.recurring.find((h) => h.id === sc.habit);
  const streakNow = T.days[today].streak;
  const toNext = sc.every - (streakNow % sc.every);
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;

  const exams = (S.exams || []).map((e) => ({ e, s: examStatus(e) })).filter((x) => x.s.state !== 'ok');
  const goal = S.goal && S.goal.amount > 0 ? S.goal : null;

  let html = '';
  html += `<header class="top"><div class="brand"><span class="logo">E</span>Endurance</div><div class="top-btns"><button class="icon-btn" data-act="go" data-tab="ajustes" data-anchor="nuvem" aria-label="Nuvem">☁️<i id="cloud-dot" class="cdot ${app.cloudState ? app.cloudState() : 'off'}"></i></button><button class="icon-btn" data-act="go" data-tab="medalhas" aria-label="Medalhas">🏅</button></div></header>`;

  if (isIOS && !standalone && !S.hideInstall)
    html += `<div class="banner info"><span>📲</span><div><b>Instale no iPhone</b><small>Toque em <b>Compartilhar</b> ⬆️ e depois em <b>Adicionar à Tela de Início</b>.</small></div><button class="x" data-act="hide-install" aria-label="Fechar">✕</button></div>`;

  for (const p of pend)
    html += `<button class="banner closing" data-act="open-closing" data-ym="${p}"><span>🏁</span><div><b>${cap(monthName(p))} terminou!</b><small>Veja o resultado e feche o mês.</small></div><span class="go">›</span></button>`;

  html += hero(S, ms);

  if (ms.carryIn < 0)
    html += `<div class="banner debt"><span>💸</span><div><b>Começou devendo ${brl(-ms.carryIn)}</b><small>O saldo negativo de ${monthName(ymOf(addDays(ym + '-01', -1)))} foi descontado deste mês.</small></div></div>`;

  html += `
  <section class="mini-stats">
    <div class="mini">
      <span class="mi">🔥</span>
      <b>${streakNow} ${streakNow === 1 ? 'dia' : 'dias'}</b>
      <small>${streakHabit ? esc(streakHabit.name.toLowerCase()) : 'sequência'} · faltam ${toNext} p/ +${brl(sc.value)}</small>
    </div>
    <div class="mini">
      <span class="mi">🏁</span>
      <b>${wp.done}/${wp.total} treinos</b>
      <div class="week">${wp.dots}</div>
    </div>
  </section>`;

  html += dayChips(S, date);

  html += `
  <section class="day">
    <div class="day-head">
      <div><h2>${relDay(date)}</h2><small>${cap(fmtDay(date))}${b.joker ? ' · 🧊 coringa' : ''}</small></div>
      <span class="net ${b.net >= 0 ? 'pos' : 'neg'}">${brl(b.net, true)}</span>
    </div>`;

  if (b.recurring.length) {
    html += `<h3 class="sec">Rotina do dia <small>já marcada · toque se não fez</small></h3><div class="list">${b.recurring.map((x) => recCard(S, x, date)).join('')}</div>`;
  }
  if (!b.recurring.some((x) => ['run', 'gym'].includes(x.h.id))) html += `<p class="rest">😌 Dia de descanso dos treinos. Recupera que amanhã tem mais.</p>`;

  if (b.bonuses.length)
    html += `<div class="list">${b.bonuses.map((x) => `<div class="habit bonus"><span class="hi">${x.emoji}</span><span class="hn"><b>${esc(x.label)}</b><small>bônus</small></span><span class="amt">${brl(x.amount, true)}</span></div>`).join('')}</div>`;

  html += `<h3 class="sec">Extras <small>dinheiro a mais</small></h3><div class="list">${b.extras.map(extraCard).join('')}</div>`;
  html += `<h3 class="sec">Deslizes <small>toque para registrar</small></h3><div class="pens">${b.penalties.map(penaltyTile).join('')}</div>`;

  html += `
    <div class="day-foot">
      <button class="btn ghost ${b.joker ? 'on' : ''}" data-act="joker" ${!b.joker && left === 0 ? 'disabled' : ''}>
        🧊 ${b.joker ? 'Coringa ativo · desfazer' : `Usar coringa <small>(${left} ${left === 1 ? 'resta' : 'restam'})</small>`}
      </button>
      <p class="hint">Coringa: para dias doente ou viajando. A rotina conta como feita e a sequência não quebra.</p>
      <label class="note"><span>📝 Nota do dia</span><textarea data-in="note" rows="2" placeholder="Como foi o dia?">${esc(b.note)}</textarea></label>
    </div>
  </section>`;

  if (goal) {
    const p = clamp(Math.max(0, ms.balance) / goal.amount, 0, 1);
    html += `
    <button class="card goal" data-act="go" data-tab="ajustes">
      <div class="row"><span class="gi">🎯</span><div><small>Recompensa do mês</small><b>${esc(goal.name)}</b></div><span class="gv">${brl(Math.max(0, ms.balance))} <small>/ ${brl(goal.amount)}</small></span></div>
      <div class="bar"><i style="width:${p * 100}%"></i></div>
      ${p >= 1 ? '<small class="ok">Pode comprar! 🎉</small>' : `<small>Faltam ${brl(goal.amount - Math.max(0, ms.balance))}</small>`}
    </button>`;
  }

  if (exams.length) {
    html += `<section class="card exams"><h3>🩺 Saúde preventiva</h3>${exams
      .slice(0, 3)
      .map(({ e, s }) => `<div class="ex ${s.state}"><span>${e.emoji}</span><b>${esc(e.name)}</b><small>${s.state === 'none' ? 'sem registro' : s.state === 'late' ? `venceu há ${-s.days} dias` : `vence em ${s.days} dias`}</small></div>`)
      .join('')}<button class="link" data-act="go" data-tab="ajustes" data-anchor="exames">Ver todos ›</button><p class="hint">Fez uma consulta? Registre em Extras: vale +${brl(r.extras.find((x) => x.id === 'medical')?.value || 40)}.</p></section>`;
  }
  return html;
}

// ---------- ações ----------
function day(S, date) {
  return (S.days[date] = S.days[date] || {});
}

export const todayActions = {
  'pick-date'(app, el) {
    app.ui.date = el.dataset.date;
    app.render();
  },
  'hide-install'(app) {
    app.commit((S) => (S.hideInstall = true));
  },
  toggle(app, el) {
    const date = app.ui.date;
    const id = el.dataset.id;
    const b = timeline(app.S).days[date];
    const x = b.recurring.find((y) => y.h.id === id);
    if (b.joker) return toast('🧊 Dia com coringa: desative o coringa para editar.');
    const p = centerOf(el);
    app.commit((S) => {
      const e = day(S, date);
      e.off = e.off || {};
      e.off[id] = x.done; // true = não fiz
    });
    if (!x.done) {
      burst(p.x, p.y, { count: 14, emoji: '🪙' });
      floatText(p.x, p.y - 20, `+${brl(x.value)}`, 'good');
    } else floatText(p.x, p.y - 20, `${brl(-x.value)}`, 'meh');
  },
  inc(app, el) {
    const date = app.ui.date;
    const id = el.dataset.id;
    const b = timeline(app.S).days[date];
    const ex = b.extras.find((y) => y.h.id === id);
    const pen = b.penalties.find((y) => y.h.id === id);
    const item = ex || pen;
    const max = item.h.max || 9;
    if (item.n >= max) return toast(`Máximo de ${max} por dia.`);
    const p = centerOf(el);
    const apply = () => {
      app.commit((S) => {
        const e = day(S, date);
        e.c = e.c || {};
        e.c[id] = (e.c[id] || 0) + 1;
      });
      if (ex) {
        burst(p.x, p.y, { count: 22, emoji: '🪙' });
        floatText(p.x, p.y - 20, `+${brl(ex.h.value)}`, 'good');
      } else {
        floatText(p.x, p.y - 20, brl(-pen.h.value), 'bad');
        document.querySelector(`[data-id="${id}"]`)?.closest('.pen')?.classList.add('shake');
        if (navigator.vibrate) navigator.vibrate(60);
      }
    };
    if (id === 'medical') return app.pickExam(date, apply);
    apply();
  },
  dec(app, el) {
    const date = app.ui.date;
    const id = el.dataset.id;
    app.commit((S) => {
      const e = day(S, date);
      e.c = e.c || {};
      e.c[id] = Math.max(0, (e.c[id] || 0) - 1);
    });
  },
  tier(app, el) {
    const date = app.ui.date;
    const id = el.dataset.id;
    const v = Number(el.dataset.v);
    const p = centerOf(el);
    const b = timeline(app.S).days[date];
    const before = b.penalties.find((y) => y.h.id === id);
    app.commit((S) => {
      const e = day(S, date);
      e.c = e.c || {};
      e.c[id] = v;
    });
    if (v > before.n) floatText(p.x, p.y - 20, brl(-before.h.tiers[v - 1].value), 'bad');
  },
  ptoggle(app, el) {
    const date = app.ui.date;
    const id = el.dataset.id;
    const p = centerOf(el);
    let on;
    app.commit((S) => {
      const e = day(S, date);
      e.c = e.c || {};
      e.c[id] = e.c[id] ? 0 : 1;
      on = e.c[id];
    });
    const h = timeline(app.S).days[date].penalties.find((y) => y.h.id === id).h;
    if (on) floatText(p.x, p.y - 20, brl(-h.value), 'bad');
  },
  joker(app) {
    const date = app.ui.date;
    const S = app.S;
    const e = S.days[date] || {};
    if (!e.joker && jokersLeft(S, ymOf(date)) === 0) return toast('Sem coringas neste mês.');
    app.commit((S2) => {
      const d = day(S2, date);
      d.joker = !d.joker;
    });
    if (!e.joker) toast('🧊 Coringa usado. Melhoras!');
  },
};

export const todayInputs = {
  note(app, el) {
    const date = app.ui.date;
    const e = (app.S.days[date] = app.S.days[date] || {});
    e.note = el.value;
    app.saveQuiet();
  },
};
