// Tela "Ajustes": valores, regras, recompensa, exames, Strava, lembretes e backup.
import { brl, cap, clone, esc, monthName, todayISO, ymOf, addMonths, uid, WD_LETTER, fmtDateLong, num } from '../utils.js';
import { rulesFor, computeValues, monthValues, examStatus } from '../engine.js';
import { REMINDERS, buildICS, openICS, deliverFile } from '../files.js';
import * as Strava from '../strava.js';
import { toast, confetti } from '../fx.js';
import { replace, wipe } from '../store.js';
import { cloudSection } from './cloudui.js';

const nextYm = () => addMonths(ymOf(todayISO()), 1);

function valuesTable(S) {
  const ym = ymOf(todayISO());
  const { values, occ, rules: r } = monthValues(S, ym);
  const recRows = r.recurring
    .map((h) => `<tr><td>${h.emoji} ${esc(h.name)}</td><td>${occ[h.id]}×</td><td class="pos">+${brl(values[h.id])}</td></tr>`)
    .join('');
  const total = r.recurring.reduce((a, h) => a + values[h.id] * occ[h.id], 0);
  const ex = r.extras.map((h) => `<tr><td>${h.emoji} ${esc(h.name)}</td><td>bônus</td><td class="pos">+${brl(h.value)}</td></tr>`).join('');
  const pen = r.penalties
    .map((h) =>
      h.type === 'tiers'
        ? h.tiers.map((t) => `<tr><td>${h.emoji} ${esc(h.name)} · ${esc(t.label)}</td><td></td><td class="neg">${brl(-t.value)}</td></tr>`).join('')
        : `<tr><td>${h.emoji} ${esc(h.name)}</td><td></td><td class="neg">${brl(-h.value)}</td></tr>`
    )
    .join('');
  const b = r.bonuses;
  const bon = `
    <tr><td>🔥 ${b.streak.every} dias seguidos de salada</td><td>bônus</td><td class="pos">+${brl(b.streak.value)}</td></tr>
    <tr><td>🏁 Semana perfeita de treinos</td><td>bônus</td><td class="pos">+${brl(b.perfectWeek.value)}</td></tr>
    <tr><td>🧊 Coringas por mês</td><td></td><td>${b.jokers}</td></tr>`;
  const pending = S.rules[nextYm()];
  return `
  <table class="vt">
    <thead><tr><th colspan="3">${cap(monthName(ym))}: mês perfeito = ${brl(total)}</th></tr></thead>
    <tbody>${recRows}${ex}${bon}${pen}</tbody>
  </table>
  ${pending ? `<p class="hint">✏️ Há mudanças agendadas para ${monthName(nextYm())}.</p>` : ''}`;
}

function ruleEditor(app) {
  const d = app.ui.draft;
  const ym = nextYm();
  const { values, occ } = computeValues(d, ym);
  const total = d.recurring.reduce((a, h) => a + values[h.id] * occ[h.id], 0);
  const inp = (path, v, attrs = '') => `<input type="number" inputmode="decimal" step="any" data-in="draft" data-path="${path}" value="${v}" ${attrs}>`;
  let h = `<div class="sheet-head"><h2>Editar regras</h2></div>
  <p class="hint">As mudanças valem a partir de <b>${monthName(ym)}</b>. O mês atual não muda, para não ter tentação. 😉</p>
  <div class="form">
    <label class="fl"><span>💰 Pote do mês (mês perfeito)</span>${inp('pool', d.pool)}</label>
    <h3 class="sec">Rotina recorrente <small>peso define a fatia do pote</small></h3>`;
  d.recurring.forEach((r, i) => {
    h += `<div class="ed">
      <div class="ed-top"><span>${r.emoji}</span>${r.custom ? `<input class="name" data-in="draft" data-path="recurring.${i}.name" value="${esc(r.name)}">` : `<b>${esc(r.name)}</b>`}
      <span class="pv" data-pv="${r.id}">${brl(values[r.id])} × ${occ[r.id]}</span>${r.custom ? `<button class="x" data-act="ed-del" data-list="recurring" data-i="${i}" aria-label="Remover">🗑</button>` : ''}</div>
      <div class="ed-row"><label>Peso ${inp(`recurring.${i}.weight`, r.weight, 'min="0"')}</label>
      <div class="days">${WD_LETTER.map((l, w) => `<button class="${r.days.includes(w) ? 'on' : ''}" data-act="ed-day" data-i="${i}" data-w="${w}">${l}</button>`).join('')}</div></div>
    </div>`;
  });
  h += `<p class="hint" data-pv="total">Mês perfeito em ${monthName(ym)}: <b>${brl(total)}</b></p>`;
  h += `<h3 class="sec">Extras</h3>`;
  d.extras.forEach((r, i) => {
    h += `<div class="ed"><div class="ed-top"><span>${r.emoji}</span>${r.custom ? `<input class="name" data-in="draft" data-path="extras.${i}.name" value="${esc(r.name)}">` : `<b>${esc(r.name)}</b>`}${r.custom ? `<button class="x" data-act="ed-del" data-list="extras" data-i="${i}">🗑</button>` : ''}</div>
      <div class="ed-row"><label>Valor R$ ${inp(`extras.${i}.value`, r.value, 'min="0"')}</label><label>Máx/dia ${inp(`extras.${i}.max`, r.max || 1, 'min="1"')}</label></div></div>`;
  });
  h += `<h3 class="sec">Deslizes</h3>`;
  d.penalties.forEach((r, i) => {
    h += `<div class="ed"><div class="ed-top"><span>${r.emoji}</span>${r.custom ? `<input class="name" data-in="draft" data-path="penalties.${i}.name" value="${esc(r.name)}">` : `<b>${esc(r.name)}</b>`}${r.custom ? `<button class="x" data-act="ed-del" data-list="penalties" data-i="${i}">🗑</button>` : ''}</div>
    <div class="ed-row">${
      r.type === 'tiers'
        ? r.tiers.map((t, j) => `<label>${esc(t.label)} R$ ${inp(`penalties.${i}.tiers.${j}.value`, t.value, 'min="0"')}</label>`).join('')
        : `<label>Perde R$ ${inp(`penalties.${i}.value`, r.value, 'min="0"')}</label>`
    }</div></div>`;
  });
  h += `<h3 class="sec">Bônus e coringas</h3>
    <div class="ed"><div class="ed-row">
      <label>🔥 A cada (dias) ${inp('bonuses.streak.every', d.bonuses.streak.every, 'min="1"')}</label>
      <label>ganha R$ ${inp('bonuses.streak.value', d.bonuses.streak.value, 'min="0"')}</label></div>
      <div class="ed-row"><label>🏁 Semana perfeita R$ ${inp('bonuses.perfectWeek.value', d.bonuses.perfectWeek.value, 'min="0"')}</label>
      <label>🧊 Coringas/mês ${inp('bonuses.jokers', d.bonuses.jokers, 'min="0"')}</label></div>
    </div>
    <h3 class="sec">Novo hábito</h3>
    <div class="ed new">
      <div class="seg wide3">
        ${['recurring:Recorrente', 'extras:Bom avulso', 'penalties:Deslize'].map((s) => { const [k, l] = s.split(':'); return `<button class="${app.ui.newKind === k ? 'on' : ''}" data-act="ed-kind" data-k="${k}">${l}</button>`; }).join('')}
      </div>
      <div class="ed-row"><input id="nh-emoji" class="emoji" value="⭐" maxlength="4" aria-label="Emoji"><input id="nh-name" placeholder="Nome do hábito"></div>
      <div class="ed-row"><label>${app.ui.newKind === 'recurring' ? 'Peso' : 'Valor R$'} <input id="nh-val" type="number" inputmode="decimal" value="${app.ui.newKind === 'recurring' ? 3 : 5}"></label>
      <button class="btn small" data-act="ed-add">Adicionar</button></div>
    </div>
  </div>
  <div class="sheet-actions">
    ${S_hasPending(app) ? `<button class="btn ghost" data-act="ed-discard">Descartar agendadas</button>` : ''}
    <button class="btn primary" data-act="ed-save">Salvar para ${monthName(ym)}</button>
  </div>`;
  return h;
}
const S_hasPending = (app) => !!app.S.rules[nextYm()];

function setPath(obj, path, val) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  const last = ks[ks.length - 1];
  o[last] = typeof o[last] === 'number' ? (val === '' ? 0 : Number(String(val).replace(',', '.'))) : val;
}

function examsSheet(app) {
  const S = app.S;
  return `<div class="sheet-head"><h2>🩺 Saúde preventiva</h2></div>
  <p class="hint">Registre a data do último exame. O app avisa quando estiver vencendo.</p>
  <div class="form">${S.exams
    .map((e, i) => {
      const s = examStatus(e);
      return `<div class="ed"><div class="ed-top"><input class="emoji" data-in="exam" data-i="${i}" data-k="emoji" value="${esc(e.emoji)}" maxlength="4"><input class="name" data-in="exam" data-i="${i}" data-k="name" value="${esc(e.name)}"><button class="x" data-act="ex-del" data-i="${i}">🗑</button></div>
      <div class="ed-row"><label>Último <input type="date" data-in="exam" data-i="${i}" data-k="last" value="${e.last || ''}" max="${todayISO()}"></label><label>A cada (meses) <input type="number" inputmode="numeric" data-in="exam" data-i="${i}" data-k="months" value="${e.months}"></label></div>
      <small class="exs ${s.state}">${s.state === 'none' ? 'Sem registro' : s.state === 'late' ? `Venceu em ${fmtDateLong(s.due)}` : `Próximo: ${fmtDateLong(s.due)}`}</small></div>`;
    })
    .join('')}
  <button class="btn ghost block" data-act="ex-add">+ Adicionar exame</button></div>`;
}

function stravaSection(app) {
  const st = app.S.strava || {};
  const host = location.hostname;
  if (st.token) {
    const last = st.lastSync ? new Date(st.lastSync).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca';
    const n = Object.values(st.acts || {}).flat().filter((a) => ['Run', 'TrailRun', 'VirtualRun'].includes(a.type));
    const km = n.reduce((a, x) => a + x.km, 0);
    return `<div class="strava-ok"><span class="sv-logo">S</span><div><b>${esc(st.athlete || 'Conectado')}</b><small>Última sincronização: ${last}<br>${n.length} corridas · ${num(km)} km registrados</small></div></div>
      <button class="btn primary block" data-act="st-sync">🔄 Sincronizar agora</button>
      <label class="switch-row"><span>Desmarcar corrida automaticamente quando não houver atividade no Strava<small>Só para dias passados. Você ainda pode remarcar até 2 dias depois.</small></span><input type="checkbox" data-in="st-auto" ${st.autoUncheck ? 'checked' : ''}></label>
      <button class="btn ghost block danger" data-act="st-off">Desconectar</button>`;
  }
  return `<ol class="steps">
      <li>No navegador, abra <b>strava.com/settings/api</b> e crie um app (nome: <i>Endurance</i>, categoria: <i>Training</i>).</li>
      <li>Em <b>Website</b> coloque <code>${esc(location.origin)}</code> e em <b>Authorization Callback Domain</b> coloque <code>${esc(host)}</code>.</li>
      <li>Copie o <b>Client ID</b> e o <b>Client Secret</b> para os campos abaixo.</li>
    </ol>
    <div class="form">
      <label class="fl"><span>Client ID</span><input data-in="st-field" data-k="clientId" inputmode="numeric" value="${esc(st.clientId || '')}"></label>
      <label class="fl"><span>Client Secret</span><input data-in="st-field" data-k="clientSecret" type="password" value="${esc(st.clientSecret || '')}"></label>
    </div>
    <button class="btn strava block" data-act="st-connect">Conectar com Strava</button>
    <details class="more"><summary>Voltou para o Safari em vez do app?</summary>
      <p class="hint">Se depois de autorizar a página abriu no Safari, copie o código que apareceu lá e cole aqui:</p>
      <div class="ed-row"><input id="st-code" placeholder="Código do Strava"><button class="btn small" data-act="st-code">Usar código</button></div>
    </details>
    <p class="hint">Seus dados do Strava ficam só neste aparelho.</p>`;
}

export function renderSettings(app) {
  const S = app.S;
  const goal = S.goal || { name: '', amount: '' };
  const lastB = S.lastBackup ? new Date(S.lastBackup).toLocaleDateString('pt-BR') : 'nunca';
  const rem = S.reminders || REMINDERS;
  let html = `<header class="top"><h1>Ajustes</h1></header>`;
  html += `<section class="card" id="nuvem"><h3>☁️ Nuvem</h3>${cloudSection(app)}</section>`;
  html += `<section class="card"><h3>💰 Valores deste mês</h3>${valuesTable(S)}<button class="btn ghost block" data-act="ed-open">✏️ Editar regras e hábitos</button></section>`;
  html += `<section class="card"><h3>🎯 Recompensa do mês</h3><p class="hint">No que você quer gastar o prêmio? Aparece no painel com o progresso.</p>
    <div class="form"><label class="fl"><span>O que</span><input data-in="goal" data-k="name" placeholder="Ex.: tênis novo" value="${esc(goal.name)}"></label>
    <label class="fl"><span>Quanto (R$)</span><input data-in="goal" data-k="amount" type="number" inputmode="decimal" value="${goal.amount || ''}"></label></div></section>`;
  html += `<section class="card" id="exames"><h3>🩺 Saúde preventiva</h3>${S.exams
    .map((e) => {
      const s = examStatus(e);
      return `<div class="ex ${s.state}"><span>${e.emoji}</span><b>${esc(e.name)}</b><small>${s.state === 'none' ? 'sem registro' : s.state === 'late' ? 'vencido' : s.state === 'soon' ? `vence em ${s.days}d` : 'em dia ✓'}</small></div>`;
    })
    .join('')}<button class="btn ghost block" data-act="ex-open">Editar exames</button></section>`;
  html += `<section class="card"><h3><span class="sv-logo sm">S</span> Strava</h3>${stravaSection(app)}</section>`;
  html += `<section class="card"><h3>⏰ Lembretes</h3><p class="hint">Apps web no iPhone não conseguem agendar notificações sozinhos. A solução: adicionar lembretes recorrentes ao seu Calendário, com alarme.</p>
    <div class="rems">${rem
      .map((r, i) => `<label class="rem"><input type="checkbox" data-in="rem" data-i="${i}" data-k="on" ${r.on ? 'checked' : ''}><span>${esc(r.title)}</span><input type="time" data-in="rem" data-i="${i}" data-k="time" value="${r.time}"></label>`)
      .join('')}</div>
    <button class="btn primary block" data-act="ics">📅 Adicionar ao Calendário</button></section>`;
  html += `<section class="card"><h3>💾 Backup</h3><p class="hint">Cópia em arquivo, extra à nuvem (salve em Arquivos ou iCloud Drive). Último: <b>${lastB}</b>.</p>
    <div class="row2"><button class="btn primary" data-act="backup">Exportar</button><label class="btn ghost">Importar<input type="file" accept="application/json,.json" data-in="import" hidden></label></div></section>`;
  html += `<section class="card"><h3>ℹ️ Como funciona</h3><ul class="how">
    <li>Corrida, academia e salada <b>já vêm marcadas</b>. Toque para desmarcar o que não fez.</li>
    <li>Dá para editar <b>até 2 dias</b> para trás.</li>
    <li>Os valores da rotina são recalculados todo mês para o mês perfeito dar <b>${brl(rulesFor(S, ymOf(todayISO())).pool)}</b>.</li>
    <li>Extras e bônus podem levar você <b>acima</b> do pote.</li>
    <li>Saldo que sobra não acumula. <b>Saldo negativo</b> é descontado do mês seguinte.</li>
    <li>Contando desde ${fmtDateLong(S.setup.startDate)}.</li></ul></section>`;
  html += `<section class="card danger-zone"><button class="btn ghost block danger" data-act="reset">Apagar tudo e recomeçar</button></section>`;
  html += `<p class="ver">Endurance · v1.1</p>`;
  return html;
}

export const settingsActions = {
  'ed-open'(app) {
    app.ui.draft = clone(app.S.rules[nextYm()] || rulesFor(app.S, ymOf(todayISO())));
    app.ui.newKind = app.ui.newKind || 'recurring';
    app.openSheet(() => ruleEditor(app), { tall: true });
  },
  'ed-day'(app, el) {
    const r = app.ui.draft.recurring[Number(el.dataset.i)];
    const w = Number(el.dataset.w);
    r.days = r.days.includes(w) ? r.days.filter((x) => x !== w) : [...r.days, w].sort();
    app.refreshSheet();
  },
  'ed-kind'(app, el) {
    app.ui.newKind = el.dataset.k;
    app.refreshSheet();
  },
  'ed-del'(app, el) {
    app.ui.draft[el.dataset.list].splice(Number(el.dataset.i), 1);
    app.refreshSheet();
  },
  'ed-add'(app) {
    const name = document.getElementById('nh-name').value.trim();
    const emoji = document.getElementById('nh-emoji').value.trim() || '⭐';
    const val = Number(String(document.getElementById('nh-val').value).replace(',', '.')) || 0;
    if (!name) return toast('Dê um nome ao hábito.');
    const k = app.ui.newKind;
    const h = { id: uid(), name, emoji, custom: true };
    if (k === 'recurring') Object.assign(h, { weight: val || 1, days: [0, 1, 2, 3, 4, 5, 6] });
    else Object.assign(h, { value: val, max: k === 'extras' ? 1 : 5 });
    app.ui.draft[k].push(h);
    app.refreshSheet();
  },
  'ed-save'(app) {
    const d = app.ui.draft;
    if (!d.recurring.length || d.pool <= 0) return toast('Precisa de pelo menos um hábito recorrente e um pote maior que zero.');
    app.commit((S) => (S.rules[nextYm()] = d));
    app.closeSheet();
    toast(`✅ Regras salvas para ${monthName(nextYm())}.`);
  },
  'ed-discard'(app) {
    app.commit((S) => delete S.rules[nextYm()]);
    app.closeSheet();
    toast('Mudanças agendadas descartadas.');
  },
  'ex-open'(app) {
    app.openSheet(() => examsSheet(app), { tall: true, onClose: () => app.render() });
  },
  'ex-add'(app) {
    app.S.exams.push({ id: uid('ex'), name: 'Novo exame', emoji: '🩺', months: 12, last: null });
    app.saveQuiet();
    app.refreshSheet();
  },
  'ex-del'(app, el) {
    app.S.exams.splice(Number(el.dataset.i), 1);
    app.saveQuiet();
    app.refreshSheet();
  },
  async 'st-connect'(app) {
    const st = app.S.strava;
    if (!st.clientId || !st.clientSecret) return toast('Preencha Client ID e Client Secret.');
    app.saveQuiet();
    Strava.startAuth(app.S);
  },
  async 'st-code'(app) {
    const code = document.getElementById('st-code').value.trim();
    if (!code) return;
    await app.stravaExchange(code);
  },
  async 'st-sync'(app) {
    await app.stravaSync(true);
  },
  'st-off'(app) {
    if (!confirm('Desconectar o Strava? As corridas importadas serão removidas.')) return;
    app.commit((S) => Strava.disconnect(S));
  },
  ics(app) {
    const rem = app.S.reminders || REMINDERS;
    openICS(buildICS(rem));
    toast('Abra o arquivo e toque em <b>Adicionar todos</b> no Calendário.', { ms: 5000 });
  },
  async backup(app) {
    const S = app.S;
    S.lastBackup = Date.now();
    app.saveQuiet();
    const r = await deliverFile(`endurance-backup-${todayISO()}.json`, JSON.stringify(S, null, 1), 'application/json');
    if (r !== 'aborted') toast('💾 Backup gerado.');
    app.render();
  },
  reset(app) {
    if (!confirm('Apagar TODOS os dados do Endurance? Isso não pode ser desfeito.')) return;
    if (!confirm('Tem certeza mesmo? Faça um backup antes, se quiser.')) return;
    wipe();
    location.reload();
  },
};

export const settingsInputs = {
  draft(app, el) {
    setPath(app.ui.draft, el.dataset.path, el.value);
    // atualiza prévia sem re-renderizar (mantém o foco)
    const d = app.ui.draft;
    const { values, occ } = computeValues(d, nextYm());
    d.recurring.forEach((r) => {
      const pv = document.querySelector(`[data-pv="${r.id}"]`);
      if (pv) pv.textContent = `${brl(values[r.id])} × ${occ[r.id]}`;
    });
    const total = d.recurring.reduce((a, h) => a + values[h.id] * occ[h.id], 0);
    const t = document.querySelector('[data-pv="total"]');
    if (t) t.innerHTML = `Mês perfeito em ${monthName(nextYm())}: <b>${brl(total)}</b>`;
  },
  goal(app, el) {
    const S = app.S;
    S.goal = S.goal || { name: '', amount: 0 };
    S.goal[el.dataset.k] = el.dataset.k === 'amount' ? Number(el.value) || 0 : el.value;
    app.saveQuiet();
  },
  exam(app, el) {
    const e = app.S.exams[Number(el.dataset.i)];
    const k = el.dataset.k;
    e[k] = k === 'months' ? Number(el.value) || 12 : k === 'last' ? el.value || null : el.value;
    app.saveQuiet();
  },
  'st-field'(app, el) {
    app.S.strava = app.S.strava || {};
    app.S.strava[el.dataset.k] = el.value.trim();
    app.saveQuiet();
  },
  'st-auto'(app, el) {
    app.commit((S) => (S.strava.autoUncheck = el.checked));
  },
  rem(app, el) {
    const S = app.S;
    S.reminders = S.reminders || clone(REMINDERS);
    const r = S.reminders[Number(el.dataset.i)];
    if (el.dataset.k === 'on') r.on = el.checked;
    else r.time = el.value;
    app.saveQuiet();
  },
  import(app, el) {
    const f = el.files && el.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (!data.setup || !data.rules) throw new Error('Arquivo inválido');
        if (!confirm('Substituir os dados atuais por este backup?')) return;
        app.S = replace(data);
        app.saveQuiet(); // envia para a nuvem, se conectado
        toast('✅ Backup restaurado.');
        confetti({ count: 60, coins: false });
        app.render();
      } catch (e) {
        toast('Não consegui ler esse arquivo.', { kind: 'bad' });
      }
    };
    rd.readAsText(f);
  },
};
