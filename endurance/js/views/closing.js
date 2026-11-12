// Fechamento do mês e boas-vindas.
import { brl, cap, esc, monthName, addMonths, todayISO, ymOf, iso, fmtDateLong } from '../utils.js';
import { monthSummary } from '../engine.js';
import { DEFAULT_RULES } from '../rules.js';
import { clone } from '../utils.js';
import { confetti, toast } from '../fx.js';

export function closingSheet(app, ym) {
  const ms = monthSummary(app.S, ym);
  const pos = ms.balance > 0;
  const recs = Object.values(ms.stats).filter((s) => s.kind === 'rec');
  const pens = Object.values(ms.stats).filter((s) => s.kind === 'pen' && s.amount > 0).sort((a, b) => b.amount - a.amount);
  const next = monthName(addMonths(ym, 1));
  return `
  <div class="closing">
    <div class="podium">${ms.balance >= ms.pool ? '🥇' : ms.balance > 0 ? '🏅' : '💸'}</div>
    <small class="eyebrow">Resultado de ${monthName(ym)}</small>
    <div class="big-amount ${pos ? 'pos' : 'neg'}" data-count="${ms.balance.toFixed(2)}">${brl(ms.balance)}</div>
    <p class="lead">${ms.balance >= ms.pool ? 'Linha de chegada cruzada! Mês de campeão. 🏆' : pos ? 'Boa prova! Esse dinheiro é seu.' : `Mês difícil. ${brl(-ms.balance)} serão descontados de ${next}.`}</p>
    <div class="sum-grid">
      <div><small>Ganhou</small><b class="pos">${brl(ms.earned - ms.bonus)}</b></div>
      <div><small>Bônus</small><b class="pos">${brl(ms.bonus, true)}</b></div>
      <div><small>Deslizes</small><b class="neg">${brl(-ms.lost)}</b></div>
      ${ms.carryIn < 0 ? `<div><small>Dívida anterior</small><b class="neg">${brl(ms.carryIn)}</b></div>` : ''}
    </div>
    <div class="sum-list">
      ${recs.map((s) => `<div><span>${s.h.emoji}</span><b>${esc(s.h.name)}</b><em>${s.done}/${s.sched}</em></div>`).join('')}
      ${pens.slice(0, 3).map((s) => `<div class="neg"><span>${s.h.emoji}</span><b>${esc(s.h.name)}</b><em>${brl(-s.amount)}</em></div>`).join('')}
    </div>
    ${pos ? `
    <div class="form">
      <label class="fl"><span>Quanto vai gastar (R$)</span><input id="cl-spent" type="number" inputmode="decimal" value="${(Math.round(ms.balance * 100) / 100).toFixed(2)}"></label>
      <label class="fl"><span>No que vai gastar? 🛍️</span><input id="cl-note" placeholder="Ex.: tênis de corrida" value="${esc(app.S.goal?.name || '')}"></label>
    </div>
    <p class="hint">O que não gastar não acumula: o próximo mês começa do zero.</p>` : `<label class="fl"><span>Nota (opcional)</span><input id="cl-note" placeholder="O que vai fazer diferente?"></label>`}
    <button class="btn primary block big" data-act="do-close" data-ym="${ym}">🏁 Fechar ${monthName(ym)}</button>
    <p class="hint center">Depois de fechado, os dias do mês não podem mais ser editados.</p>
  </div>`;
}

export function renderOnboarding() {
  const t = todayISO();
  const first = `${ymOf(t)}-01`;
  return `
  <section class="onb">
    <div class="onb-logo"><span>E</span></div>
    <h1>Endurance</h1>
    <p class="tag">Sua saúde vale dinheiro.<br><b>Literalmente.</b></p>
    <div class="onb-cards">
      <div><span>💰</span><p><b>R$ ${DEFAULT_RULES.pool} em jogo</b> todo mês. Mês perfeito de corrida, academia e salada = R$ 300.</p></div>
      <div><span>✅</span><p>A rotina <b>já vem marcada</b>. Você só desmarca o que não fez.</p></div>
      <div><span>🍪</span><p>Biscoito, pizza, cerveja, vinho e noites tardias <b>custam caro</b>.</p></div>
      <div><span>🏅</span><p>Bônus, sequências, medalhas e <b>celebração</b> quando cruzar a linha de chegada.</p></div>
    </div>
    <h3>Começar a contar a partir de:</h3>
    <div class="onb-opts">
      <button class="opt on" data-act="onb-opt" data-v="${first}"><b>1º de ${monthName(ymOf(t))}</b><small>Você revisa os dias que já passaram</small></button>
      ${first !== t ? `<button class="opt" data-act="onb-opt" data-v="${t}"><b>Hoje</b><small>${fmtDateLong(t)}</small></button>` : ''}
    </div>
    <button class="btn primary block big" data-act="onb-start">Largada! 🏁</button>
    <button class="btn ghost block" data-act="onb-cloud">☁️ Já uso o Endurance: entrar na minha conta</button>
  </section>`;
}

export const closingActions = {
  'open-closing'(app, el) {
    const ym = el.dataset.ym;
    app.openSheet(() => closingSheet(app, ym), { tall: true });
    app.animateCounts();
  },
  'do-close'(app, el) {
    const ym = el.dataset.ym;
    const ms = monthSummary(app.S, ym);
    const spent = Number(document.getElementById('cl-spent')?.value || 0) || 0;
    const note = document.getElementById('cl-note')?.value || '';
    app.commit((S) => {
      S.closings[ym] = { balance: Math.round(ms.balance * 100) / 100, spent: ms.balance > 0 ? spent : 0, note, closedAt: Date.now() };
    });
    app.closeSheet();
    if (ms.balance > 0) {
      confetti();
      toast(`🎉 ${cap(monthName(ym))} fechado! Aproveite seus ${brl(spent)}.`, { ms: 4500 });
    } else toast(`${cap(monthName(ym))} fechado. Bora virar o jogo! 💪`, { ms: 4500 });
    setTimeout(() => toast('💾 Que tal fazer um backup? Ajustes › Backup', { ms: 4000 }), 4800);
  },
  'onb-cloud'(app) {
    if (!app.cloudConfigured()) {
      app.openSheet(() => `<div class="sheet-head"><h2>☁️ Nuvem</h2></div><p class="hint">Primeiro configure o Firebase neste aparelho. Depois de entrar, seus dados são baixados.</p>${app.cloudSetupHtml()}`, { tall: true });
      return;
    }
    app.ui.loginMode = 'in';
    app.openLogin();
  },
  'onb-opt'(app, el) {
    document.querySelectorAll('.onb .opt').forEach((b) => b.classList.toggle('on', b === el));
  },
  'onb-start'(app) {
    const v = document.querySelector('.onb .opt.on')?.dataset.v || todayISO();
    app.commit((S) => {
      S.setup = { startDate: v, setupDate: todayISO() };
      S.rules[ymOf(v)] = clone(DEFAULT_RULES);
    });
    app.go('hoje');
    confetti({ count: 120 });
    if (v < todayISO()) setTimeout(() => toast('Revise os dias anteriores: desmarque o que não fez. Você tem 2 dias para ajustar tudo.', { ms: 6000 }), 600);
  },
};
