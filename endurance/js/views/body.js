// Tela "Corpo": pesagens da balança de bioimpedância.
import { brl, esc, fmtDay, cap, todayISO, ymOf, monthName, parse } from '../utils.js';
import { rulesFor } from '../engine.js';
import { FIELDS, FIELD, SEGMENTS, CHART_KEYS, weighings, fmtVal, delta, monthProgress, makeKeys } from '../body.js';
import { toast, confetti } from '../fx.js';

const dayLabel = (w) => `${cap(fmtDay(w.data))}${w.hora ? ` · ${w.hora}` : ''}`;

function deltaHtml(f, a, b) {
  const d = delta(f, a, b);
  if (!d) return '';
  if (d.diff === 0) return `<em class="dz">=</em>`;
  const s = `${d.diff > 0 ? '+' : '−'}${fmtVal(f, Math.abs(d.diff))}`;
  return `<em class="${d.good === null ? 'dz' : d.good ? 'dg' : 'db'}">${d.diff > 0 ? '▲' : '▼'} ${s}</em>`;
}

function chart(ws, k) {
  const f = FIELD[k];
  const pts = ws.filter((w) => w[k] != null);
  if (pts.length < 2) return `<p class="hint">O gráfico aparece a partir da 2ª pesagem.</p>`;
  const W = 340, H = 150, L = 34, R = 28, T = 18, B = 24;
  const vals = pts.map((w) => Number(w[k]));
  let mn = Math.min(...vals), mx = Math.max(...vals);
  if (mn === mx) { mn -= 1; mx += 1; }
  const pad = (mx - mn) * 0.15;
  mn -= pad; mx += pad;
  const t0 = parse(pts[0].data).getTime(), t1 = parse(pts[pts.length - 1].data).getTime() || t0 + 1;
  const x = (w) => L + ((parse(w.data).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const y = (v) => T + ((mx - v) / (mx - mn)) * (H - T - B);
  const path = pts.map((w, i) => `${i ? 'L' : 'M'}${x(w).toFixed(1)},${y(w[k]).toFixed(1)}`).join('');
  const area = `${path}L${x(pts[pts.length - 1]).toFixed(1)},${H - B}L${x(pts[0]).toFixed(1)},${H - B}Z`;
  const ticks = [mn + pad, (mn + mx) / 2, mx - pad];
  return `<svg class="bchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(f.label)} ao longo do tempo">
    <defs><linearGradient id="bg-${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--cyan)" stop-opacity=".35"/><stop offset="1" stop-color="var(--cyan)" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((v) => `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="yl" x="${L - 4}" y="${y(v) + 3}">${fmtVal(f, v)}</text>`).join('')}
    <path d="${area}" fill="url(#bg-${k})"/>
    <path class="ln" d="${path}"/>
    ${pts.map((w, i) => `<circle class="pt ${i === pts.length - 1 ? 'last' : ''}" cx="${x(w)}" cy="${y(w[k])}" r="${i === pts.length - 1 ? 5 : 3.5}"><title>${esc(fmtDay(w.data))}: ${fmtVal(f, w[k])} ${f.unit}</title></circle>`).join('')}
    <text class="xl" x="${L}" y="${H - 6}">${esc(fmtDay(pts[0].data))}</text>
    <text class="xl end" x="${W - R}" y="${H - 6}">${esc(fmtDay(pts[pts.length - 1].data))}</text>
    <text class="vl" x="${x(pts[pts.length - 1])}" y="${y(pts[pts.length - 1][k]) - 10}">${fmtVal(f, pts[pts.length - 1][k])}</text>
  </svg>`;
}

function segTable(w) {
  const has = SEGMENTS.some((s) => w[`seg_gordura_${s.k}_kg`] != null || w[`seg_musculo_${s.k}_kg`] != null);
  if (!has) return '';
  return `<section class="card"><h3>🧍 Por segmento <small class="muted">${esc(dayLabel(w))}</small></h3>
  <div class="segg"><span></span><small>Gordura</small><small>Músculo</small>
  ${SEGMENTS.map((s) => `<span>${s.label}</span><b class="sg">${fmtVal({ d: 1 }, w[`seg_gordura_${s.k}_kg`])} kg</b><b class="sm">${fmtVal({ d: 1 }, w[`seg_musculo_${s.k}_kg`])} kg</b>`).join('')}
  </div></section>`;
}

export function renderBody(app) {
  const S = app.S;
  const ws = weighings(S);
  const last = ws[ws.length - 1];
  const prev = ws[ws.length - 2];
  const first = ws[0];
  const ym = ymOf(todayISO());
  const cfg = rulesFor(S, ym).bonuses.body;
  const mp = monthProgress(S, ym, cfg);
  const k = CHART_KEYS.includes(app.ui.bodyKey) ? app.ui.bodyKey : 'peso';
  const sc = S.scale || {};

  let html = `<header class="top"><h1>Corpo</h1><button class="icon-btn" data-act="body-add" aria-label="Lançar pesagem">＋</button></header>`;

  if (!sc.pub) {
    html += `<section class="card setup"><h3>📸 Receber pesagens por foto</h3>
      <p class="hint">Mande o print da Fitdays para o Claude e a pesagem aparece aqui sozinha. Como o código do app é público, cada pesagem chega <b>criptografada</b>: só este app consegue abrir.</p>
      <button class="btn primary block" data-act="body-keys">🔐 Ativar (uma vez só)</button></section>`;
  } else if (!sc.keySent) {
    html += `<section class="card setup"><h3>📸 Falta 1 passo</h3>
      <p class="hint">Copie a chave abaixo e cole na conversa com o Claude. Ela é <b>pública</b> (só serve para trancar, não para abrir), pode mandar tranquilo.</p>
      <div class="code-box small">${esc(JSON.stringify(sc.pub))}</div>
      <div class="row2"><button class="btn primary" data-act="body-copykey">Copiar chave</button><button class="btn ghost" data-act="body-keysent">Já mandei</button></div></section>`;
  }

  if (!last) {
    html += `<section class="card empty"><div class="podium">⚖️</div><p class="lead center">Nenhuma pesagem ainda.</p>
      <p class="hint center">Mande o print da balança para o Claude ou toque em <b>＋</b> para lançar à mão.</p></section>`;
    return html;
  }

  // Última pesagem
  html += `<section class="hero body-hero">
    <div class="hero-top"><span class="pill glass">${esc(dayLabel(last))}</span>${last.fonte ? `<span class="pill glass">${esc(last.fonte)}</span>` : ''}</div>
    <div class="hero-label">Peso</div>
    <div class="hero-amount">${fmtVal(FIELD.peso, last.peso)}<small> kg</small></div>
    <div class="hero-sub">${prev ? `${deltaHtml(FIELD.peso, prev.peso, last.peso)} desde a anterior` : 'primeira pesagem'}${first !== last ? ` · ${deltaHtml(FIELD.peso, first.peso, last.peso)} desde o início` : ''}</div>
  </section>`;

  html += `<section class="bgrid">${FIELDS.filter((f) => f.main && f.k !== 'peso')
    .map((f) => `<button class="bstat ${k === f.k ? 'on' : ''}" ${CHART_KEYS.includes(f.k) ? `data-act="body-key" data-k="${f.k}"` : ''}><small>${esc(f.label)}</small><b>${fmtVal(f, last[f.k])}<i>${f.unit ? ` ${f.unit}` : ''}</i></b>${prev ? deltaHtml(f, prev[f.k], last[f.k]) : ''}</button>`)
    .join('')}</section>`;

  html += `<section class="card"><div class="chips inline">${CHART_KEYS.map((c) => `<button class="chip ${c === k ? 'on' : ''}" data-act="body-key" data-k="${c}">${esc(FIELD[c].label)}</button>`).join('')}</div>${chart(ws, k)}</section>`;

  // Bônus do mês
  if (cfg) {
    html += `<section class="card"><h3>💰 Bônus de progresso · ${monthName(ym)}</h3>`;
    if (mp.ws.length < 2) html += `<p class="hint">Compara a 1ª e a última pesagem do mês. ${mp.ws.length === 1 ? 'Falta mais uma pesagem este mês.' : 'Pese pelo menos 2 vezes este mês.'}</p>`;
    html += `<div class="list">${[
      { name: 'Gordura % caiu no mês', amount: cfg.fatPct, item: mp.items.find((i) => i.id === 'body-fat') },
      { name: 'Gordura visceral caiu no mês', amount: cfg.visceral, item: mp.items.find((i) => i.id === 'body-visc') },
    ]
      .filter((x) => x.amount > 0)
      .map((x) => `<div class="habit rec ${x.item && x.item.ok ? 'done' : 'xtra'}"><span class="hi">${x.item ? x.item.emoji : '⚖️'}</span><span class="hn"><b>${esc(x.name)}</b><small>${x.item ? esc(x.item.label.split(': ')[1] || '') : 'aguardando pesagens'}</small></span><span class="amt">${x.item && x.item.ok ? brl(x.amount, true) : `+${brl(x.amount)}`}</span></div>`)
      .join('')}</div>
      <p class="hint">O bônus entra no dia da última pesagem do mês e é recalculado a cada nova pesagem.</p></section>`;
  }

  html += segTable(last);

  html += `<section class="card"><h3>📋 Pesagens</h3><div class="wlist">${ws
    .slice()
    .reverse()
    .map((w, i, arr) => {
      const p = arr[i + 1];
      return `<button class="wrow" data-act="body-open" data-id="${esc(w.data)}"><span>${esc(dayLabel(w))}</span><b>${fmtVal(FIELD.peso, w.peso)} kg</b><small>${fmtVal(FIELD.gordura_pct, w.gordura_pct)}% gord.</small>${p ? deltaHtml(FIELD.peso, p.peso, w.peso) : '<em class="dz">—</em>'}</button>`;
    })
    .join('')}</div></section>`;

  html += `<p class="hint center">📸 Para lançar por foto: abra uma conversa do Claude Code com o repositório <b>agenda-alice</b>, mande o print da Fitdays e peça "lança essa pesagem".</p>`;
  return html;
}

function detailSheet(app, id) {
  const w = (app.S.weighings || {})[id];
  if (!w) return '<p>Pesagem não encontrada.</p>';
  const ws = weighings(app.S);
  const i = ws.findIndex((x) => x.data === id);
  const p = ws[i - 1];
  return `<div class="sheet-head"><h2>⚖️ ${esc(dayLabel(w))}</h2></div>
  ${FIELDS.filter((f) => w[f.k] != null).map((f) => `<div class="dl"><span></span><b>${esc(f.label)}</b><em>${fmtVal(f, w[f.k])}${f.unit ? ` ${f.unit}` : ''} ${p ? deltaHtml(f, p[f.k], w[f.k]) : ''}</em></div>`).join('')}
  ${w.fonte ? `<p class="hint">Fonte: ${esc(w.fonte)}</p>` : ''}
  <button class="btn ghost block danger" data-act="body-del" data-id="${esc(id)}">Apagar esta pesagem</button>`;
}

const FORM = ['peso', 'gordura_pct', 'massa_gorda', 'massa_muscular', 'gordura_visceral', 'agua_pct', 'idade_metabolica', 'tmb', 'imc'];
function formSheet() {
  const t = todayISO();
  const now = new Date();
  const hh = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `<div class="sheet-head"><h2>⚖️ Lançar pesagem</h2></div>
  <p class="hint">Preencha o que a balança mostrou. Só o peso é obrigatório.</p>
  <div class="form">
    <div class="ed-row"><label>Data <input id="bw-data" type="date" value="${t}" max="${t}"></label><label>Hora <input id="bw-hora" type="time" value="${hh}"></label></div>
    ${FORM.map((k) => `<label class="fl"><span>${esc(FIELD[k].label)}${FIELD[k].unit ? ` (${FIELD[k].unit})` : ''}</span><input id="bw-${k}" type="number" inputmode="decimal" step="any"></label>`).join('')}
  </div>
  <button class="btn primary block big" data-act="body-save">Salvar pesagem</button>`;
}

export const bodyActions = {
  'body-key'(app, el) {
    app.ui.bodyKey = el.dataset.k;
    app.render();
  },
  'body-open'(app, el) {
    app.openSheet(() => detailSheet(app, el.dataset.id));
  },
  'body-add'(app) {
    app.openSheet(() => formSheet(), { tall: true });
  },
  'body-save'(app) {
    const v = (id) => document.getElementById(id)?.value;
    const data = v('bw-data');
    const peso = Number(String(v('bw-peso') || '').replace(',', '.'));
    if (!data || !peso) return toast('Informe pelo menos a data e o peso.');
    const w = { data, hora: v('bw-hora') || '', fonte: 'Manual' };
    for (const k of FORM) {
      const raw = String(v(`bw-${k}`) || '').replace(',', '.');
      if (raw !== '') w[k] = Number(raw);
    }
    app.commit((S) => {
      S.weighings = S.weighings || {};
      S.weighings[data] = { ...(S.weighings[data] || {}), ...w };
    });
    app.closeSheet();
    toast('⚖️ Pesagem salva.');
  },
  'body-del'(app, el) {
    if (!confirm('Apagar esta pesagem?')) return;
    const id = el.dataset.id;
    app.commit((S) => {
      delete S.weighings[id];
      if (S.scale && S.scale.seen) S.scale.seen[id] = 'apagada';
    });
    app.closeSheet();
  },
  async 'body-keys'(app) {
    try {
      const { pub, priv } = await makeKeys();
      app.commit((S) => {
        S.scale = { ...(S.scale || {}), pub, priv, seen: {} };
      });
      toast('🔐 Chave criada. Agora copie e mande para o Claude.');
    } catch (e) {
      toast('Não consegui criar a chave neste aparelho.', { kind: 'bad' });
    }
  },
  async 'body-copykey'(app) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(app.S.scale.pub));
      toast('Chave copiada! Cole na conversa com o Claude.');
    } catch (e) {
      toast('Selecione e copie o texto manualmente.');
    }
  },
  'body-keysent'(app) {
    app.commit((S) => (S.scale.keySent = true));
    confetti({ count: 50, coins: false });
  },
};
