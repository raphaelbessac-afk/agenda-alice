// Endurance: orquestração, navegação, ações e celebrações.
import { load, save } from './store.js';
import { todayISO, ymOf, brl, cap, monthName, esc } from './utils.js';
import { monthSummary, timeline } from './engine.js';
import { computeMedals, MEDALS } from './medals.js';
import { confetti, toast, burst } from './fx.js';
import * as Strava from './strava.js';
import { renderToday, todayActions, todayInputs } from './views/today.js';
import { renderHistory, historyActions } from './views/history.js';
import { renderMedals } from './views/medals.js';
import { renderSettings, settingsActions, settingsInputs } from './views/settings.js';
import { renderOnboarding, closingActions } from './views/closing.js';

const TABS = ['hoje', 'historico', 'medalhas', 'ajustes'];

const app = {
  S: load(),
  ui: { tab: 'hoje', date: null, hYm: null },
  sheet: null,
};

// ---------- render ----------
const view = document.getElementById('view');
const tabs = document.getElementById('tabs');

app.render = function render() {
  const S = app.S;
  if (!S.setup) {
    tabs.hidden = true;
    view.innerHTML = renderOnboarding();
    return;
  }
  tabs.hidden = false;
  const t = app.ui.tab;
  const html = t === 'historico' ? renderHistory(app) : t === 'medalhas' ? renderMedals(app) : t === 'ajustes' ? renderSettings(app) : renderToday(app);
  view.innerHTML = html;
  view.dataset.tab = t;
  tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  const chip = document.querySelector('#daychips .chip.on');
  if (chip) chip.scrollIntoView({ block: 'nearest', inline: 'center' });
  app.animateCounts();
};

let lastHero = null;
app.animateCounts = function () {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count);
    const key = el.closest('.sheet') ? 'sheet' : 'hero';
    const from = key === 'hero' && lastHero !== null ? lastHero : key === 'sheet' ? 0 : to;
    if (key === 'hero') lastHero = to;
    if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now();
    const dur = key === 'sheet' ? 1200 : 600;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = brl(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
};

app.go = function (tab) {
  app.ui.tab = TABS.includes(tab) ? tab : 'hoje';
  if (location.hash !== `#${app.ui.tab}`) history.replaceState(null, '', `#${app.ui.tab}`);
  app.render();
  window.scrollTo({ top: 0 });
};

app.saveQuiet = function () {
  save(app.S);
};

// ---------- celebrações ----------
function metrics() {
  const S = app.S;
  if (!S.setup) return null;
  const ym = ymOf(todayISO());
  const ms = monthSummary(S, ym);
  const bonusKeys = new Set();
  ms.days.forEach((b) => b.bonuses.forEach((x) => bonusKeys.add(`${b.date}:${x.id}`)));
  return { ym, balance: ms.balance, pool: ms.pool, bonusKeys, medals: computeMedals(S).res };
}

function celebrate(before, after) {
  if (!before || !after) return;
  const S = app.S;
  // bônus novos
  const T = timeline(S);
  for (const k of after.bonusKeys) {
    if (!before.bonusKeys.has(k)) {
      const [d, id] = k.split(':');
      const bo = T.days[d].bonuses.find((x) => x.id === id);
      toast(`${bo.emoji} <b>${esc(bo.label)}</b> · ${brl(bo.amount, true)}`, { kind: 'good' });
      burst(innerWidth / 2, innerHeight / 3, { count: 40, emoji: '🪙' });
    }
  }
  // linha de chegada
  const gk = `${after.ym}:goal`;
  if (before.balance < after.pool && after.balance >= after.pool && !S.celebrated[gk]) {
    S.celebrated[gk] = true;
    save(S);
    setTimeout(() => {
      confetti();
      app.openSheet(
        () => `<div class="closing"><div class="podium">🥇</div><small class="eyebrow">${cap(monthName(after.ym))}</small>
        <div class="big-amount pos">${brl(after.balance)}</div><p class="lead"><b>Linha de chegada!</b> Você bateu os ${brl(after.pool)} do mês. Daqui pra frente é volta extra. 🏃💨</p>
        <button class="btn primary block big" data-act="close-sheet">Bora!</button></div>`
      );
    }, 250);
  }
  // medalhas novas
  checkMedals(after.medals);
}

function checkMedals(res) {
  const S = app.S;
  const seen = S.seenMedals || {};
  const fresh = MEDALS.filter((m) => (res[m.id] || 0) > (seen[m.id] || 0));
  if (!fresh.length) return;
  S.seenMedals = { ...seen, ...res };
  save(S);
  fresh.slice(0, 2).forEach((m, i) =>
    setTimeout(() => {
      toast(`<span class="tm" style="--mc:${m.color}">${m.emoji}</span><div><small>Nova medalha!</small><b>${esc(m.name)}</b></div>`, { kind: 'medalt', ms: 4200 });
      confetti({ count: 90, coins: false });
    }, 400 + i * 1600)
  );
}

app.commit = function (mut) {
  const before = metrics();
  mut(app.S);
  save(app.S);
  app.render();
  if (app.sheet) app.refreshSheet();
  celebrate(before, metrics());
};

// ---------- folha (bottom sheet) ----------
const sheetRoot = document.getElementById('sheet-root');
app.openSheet = function (renderFn, opts = {}) {
  app.sheet = { renderFn, opts };
  sheetRoot.innerHTML = `<div class="backdrop" data-act="close-sheet"></div><div class="sheet ${opts.tall ? 'tall' : ''}" role="dialog" aria-modal="true"><div class="grab"></div><button class="sheet-x" data-act="close-sheet" aria-label="Fechar">✕</button><div class="sheet-body">${renderFn()}</div></div>`;
  document.body.classList.add('noscroll');
  requestAnimationFrame(() => sheetRoot.classList.add('open'));
};
app.refreshSheet = function () {
  if (!app.sheet) return;
  const body = sheetRoot.querySelector('.sheet-body');
  const st = body.scrollTop;
  body.innerHTML = app.sheet.renderFn();
  body.scrollTop = st;
};
app.closeSheet = function () {
  if (!app.sheet) return;
  const onClose = app.sheet.opts.onClose;
  app.sheet = null;
  sheetRoot.classList.remove('open');
  document.body.classList.remove('noscroll');
  setTimeout(() => {
    if (!app.sheet) sheetRoot.innerHTML = '';
  }, 300);
  if (onClose) onClose();
};

app.pickExam = function (date, done) {
  const S = app.S;
  app.openSheet(
    () => `<div class="sheet-head"><h2>🩺 Qual consulta ou exame?</h2></div><p class="hint">Atualiza a data na sua lista de saúde preventiva.</p>
    <div class="list">${S.exams.map((e, i) => `<button class="habit pick" data-act="exam-pick" data-i="${i}"><span class="hi">${e.emoji}</span><span class="hn"><b>${esc(e.name)}</b></span><span class="go">›</span></button>`).join('')}
    <button class="habit pick" data-act="exam-pick" data-i="-1"><span class="hi">➕</span><span class="hn"><b>Outro</b></span><span class="go">›</span></button></div>`
  );
  app._examCb = (i) => {
    if (i >= 0) S.exams[i].last = date;
    app.closeSheet();
    done();
  };
};

// ---------- Strava ----------
app.stravaExchange = async function (code) {
  try {
    toast('Conectando ao Strava…');
    await Strava.exchangeCode(app.S, code);
    save(app.S);
    await app.stravaSync(true);
    toast('🟠 Strava conectado!', { kind: 'good' });
  } catch (e) {
    toast(`Não deu para conectar: ${esc(e.message)}`, { kind: 'bad', ms: 6000 });
  }
  app.render();
};

app.stravaSync = async function (verbose = false) {
  const st = app.S.strava;
  if (!st || !st.token || !navigator.onLine) return;
  try {
    const n = await Strava.sync(app.S);
    app.commit(() => {});
    if (verbose) toast(`🔄 ${n} atividades sincronizadas.`);
  } catch (e) {
    if (verbose) toast(`Strava: ${esc(e.message)}`, { kind: 'bad', ms: 5000 });
  }
};

function handleStravaCallback() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const err = q.get('error');
  if (!code && !err) return;
  history.replaceState(null, '', location.pathname + '#ajustes');
  app.ui.tab = 'ajustes';
  if (err) return setTimeout(() => toast('Autorização do Strava cancelada.', { kind: 'bad' }), 300);
  const scope = q.get('scope') || '';
  if (!scope.includes('activity:read')) {
    setTimeout(() => toast('Marque a permissão de ver suas atividades no Strava e tente de novo.', { kind: 'bad', ms: 6000 }), 300);
    return;
  }
  const st = app.S.strava || {};
  if (st.clientId && st.clientSecret && app.S.setup) {
    app.stravaExchange(code);
  } else {
    // Aberto fora do app instalado (ex.: Safari): mostra o código para colar no app.
    setTimeout(
      () =>
        app.openSheet(
          () => `<div class="closing"><div class="podium">🟠</div><h2>Quase lá!</h2><p class="lead">O Strava abriu no Safari, fora do app. Copie o código abaixo, abra o <b>Endurance</b> pela tela de início e cole em <b>Ajustes › Strava › Usar código</b>.</p>
          <div class="code-box">${esc(code)}</div><button class="btn primary block" data-act="copy-code" data-code="${esc(code)}">Copiar código</button></div>`
        ),
      300
    );
  }
}

// ---------- eventos ----------
const actions = {
  ...todayActions,
  ...historyActions,
  ...settingsActions,
  ...closingActions,
  go(app, el) {
    app.go(el.dataset.tab);
    if (el.dataset.anchor) setTimeout(() => document.getElementById(el.dataset.anchor)?.scrollIntoView({ behavior: 'smooth' }), 50);
  },
  'close-sheet'(app) {
    app.closeSheet();
  },
  'exam-pick'(app, el) {
    app._examCb && app._examCb(Number(el.dataset.i));
  },
  async 'copy-code'(app, el) {
    try {
      await navigator.clipboard.writeText(el.dataset.code);
      toast('Código copiado!');
    } catch (e) {
      toast('Selecione e copie o código manualmente.');
    }
  },
};
const inputs = { ...todayInputs, ...settingsInputs };

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (fn) {
    ev.preventDefault();
    fn(app, el, ev);
  }
});
let tmr;
document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-in]');
  if (!el) return;
  const fn = inputs[el.dataset.in];
  if (!fn) return;
  if (el.type === 'checkbox' || el.type === 'file') return; // tratados no change
  clearTimeout(tmr);
  if (el.dataset.in === 'draft') fn(app, el);
  else tmr = setTimeout(() => fn(app, el), 250);
});
document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-in]');
  if (!el) return;
  const fn = inputs[el.dataset.in];
  if (fn && (el.type === 'checkbox' || el.type === 'file' || el.type === 'date' || el.type === 'time')) fn(app, el);
});
tabs.addEventListener('click', (ev) => {
  const b = ev.target.closest('button[data-tab]');
  if (b) {
    if (b.dataset.tab === 'hoje' && app.ui.tab === 'hoje') app.ui.date = todayISO();
    app.go(b.dataset.tab);
  }
});
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') app.closeSheet();
});

// Ao voltar para o app (ex.: virou o dia), recalcula e sincroniza.
let lastDay = todayISO();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !app.S.setup) return;
  if (todayISO() !== lastDay) {
    lastDay = todayISO();
    app.ui.date = lastDay;
  }
  app.render();
  maybeSync();
});
function maybeSync() {
  const st = app.S.strava;
  if (st && st.token && (!st.lastSync || Date.now() - st.lastSync > 30 * 60000)) app.stravaSync(false);
}

// ---------- início ----------
const hashTab = location.hash.replace('#', '');
if (TABS.includes(hashTab)) app.ui.tab = hashTab;
handleStravaCallback();
app.render();
if (app.S.setup) {
  checkMedals(computeMedals(app.S).res);
  maybeSync();
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
