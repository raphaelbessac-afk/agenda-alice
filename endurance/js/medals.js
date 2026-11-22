// Medalhas de conquista, no estilo de medalhas de prova.
import { timeline, monthSummary, monthsTracked, examStatus } from './engine.js';
import { todayISO, addDays, weekday } from './utils.js';
import { weighings } from './body.js';

export const MEDALS = [
  { id: 'first', emoji: '👟', name: 'Primeiro passo', desc: 'Um dia completo: tudo feito e nenhum deslize.', color: '#3DD6F5' },
  { id: 'week', emoji: '🏁', name: 'Semana perfeita', desc: 'Todas as corridas e treinos da semana.', color: '#FF6B2C' },
  { id: 'clean7', emoji: '✨', name: 'Semana limpa', desc: '7 dias seguidos sem nenhum deslize.', color: '#8B6CFF' },
  { id: 'salad30', emoji: '🥗', name: 'Mestre da salada', desc: '30 saladas seguidas no jantar.', color: '#B8F23A' },
  { id: 'cookie30', emoji: '🍪', name: 'Adeus, biscoito', desc: '30 dias seguidos sem biscoito recheado.', color: '#FFD23F' },
  { id: 'sleep30', emoji: '😴', name: 'Sono de atleta', desc: '30 noites seguidas dormindo antes da meia-noite.', color: '#6C8BFF' },
  { id: 'zen', emoji: '🧘', name: 'Mente zen', desc: 'Meditar em 15 dias do mesmo mês.', color: '#3DD6F5' },
  { id: 'reader', emoji: '📚', name: 'Rato de biblioteca', desc: '10 leituras de 10 páginas no mesmo mês.', color: '#FF9F43' },
  { id: 'goal', emoji: '🥇', name: 'Linha de chegada', desc: 'Bater o pote do mês (R$ 300).', color: '#FFD23F' },
  { id: 'ultra', emoji: '🚀', name: 'Ultramaratona', desc: 'Passar R$ 50 além do pote no mês.', color: '#FF3D8B' },
  { id: 'perfectMonth', emoji: '👑', name: 'Mês perfeito', desc: 'Todos os hábitos recorrentes de um mês inteiro.', color: '#FFD23F' },
  { id: 'nobeer', emoji: '🚱', name: 'Mês sem cerveja', desc: 'Um mês inteiro sem cerveja.', color: '#3DD6F5' },
  { id: 'checkup', emoji: '🩺', name: 'Check-up em dia', desc: 'Todos os exames da lista em dia.', color: '#B8F23A' },
  { id: 'fat1', emoji: '🔥', name: '−1 kg de gordura', desc: 'Cada kg de massa gorda a menos desde a 1ª pesagem.', color: '#FF6B2C' },
  { id: 'muscle1', emoji: '💪', name: '+1 kg de músculo', desc: 'Cada kg de massa muscular a mais desde a 1ª pesagem.', color: '#B8F23A' },
  { id: 'visc7', emoji: '🫀', name: 'Visceral abaixo de 8', desc: 'Uma pesagem com gordura visceral menor que 8.', color: '#FF3D8B' },
  { id: 'weigh4', emoji: '⚖️', name: '4 semanas pesando', desc: 'Pesar em 4 semanas seguidas.', color: '#3DD6F5' },
  { id: 'km50', emoji: '🏃', name: '50 km no mês', desc: 'Correr 50 km num mês (Strava).', color: '#FF6B2C' },
  { id: 'km100', emoji: '⚡', name: '100 km no mês', desc: 'Correr 100 km num mês (Strava).', color: '#FF3D8B' },
];

export function computeMedals(S) {
  const res = {};
  const prog = {};
  if (!S.setup) return { res, prog };
  const add = (id) => (res[id] = (res[id] || 0) + 1);
  const T = timeline(S);
  let first = false;
  const st = { cookie: 0, sleep: 0, clean: 0, salad: 0 };
  for (const d of T.order) {
    const b = T.days[d];
    if (b.status === 'perfect' && b.recurring.length) first = true;
    const pen = (id) => b.penalties.find((x) => x.h.id === id);
    const ck = pen('cookie');
    if (ck) {
      st.cookie = ck.n ? 0 : st.cookie + 1;
      if (st.cookie && st.cookie % 30 === 0) add('cookie30');
    }
    const sl = pen('sleep');
    if (sl) {
      st.sleep = sl.n ? 0 : st.sleep + 1;
      if (st.sleep && st.sleep % 30 === 0) add('sleep30');
    }
    st.clean = b.lost > 0 ? 0 : st.clean + 1;
    if (st.clean && st.clean % 7 === 0) add('clean7');
    const sa = b.recurring.find((x) => x.h.id === 'salad');
    if (sa) {
      if (!sa.pending) st.salad = sa.done ? st.salad + 1 : 0;
      if (st.salad && st.salad % 30 === 0) add('salad30');
    }
    if (b.bonuses.some((x) => x.id === 'week')) add('week');
  }
  if (first) res.first = 1;

  let bestReading = 0, bestKm = 0;
  for (const ym of monthsTracked(S)) {
    const ms = monthSummary(S, ym);
    if (ms.balance >= ms.pool - 0.005) add('goal');
    if (ms.balance >= ms.pool + 50 - 0.005) add('ultra');
    const reading = ms.stats.reading ? ms.stats.reading.n : 0;
    bestReading = Math.max(bestReading, reading);
    if (reading >= 10) add('reader');
    if (ms.stats.meditation && ms.stats.meditation.days >= 15) add('zen');
    bestKm = Math.max(bestKm, ms.km);
    if (ms.km >= 50) add('km50');
    if (ms.km >= 100) add('km100');
    if (ms.complete && ms.fullTracked) {
      if (ms.recPossible > 0 && ms.recDone >= ms.recPossible - 0.005) add('perfectMonth');
      if (ms.stats.beer && ms.stats.beer.n === 0) add('nobeer');
    }
  }
  // Balança
  const ws = weighings(S);
  if (ws.length) {
    const f0 = ws[0];
    const lastWith = (k) => [...ws].reverse().find((w) => w[k] != null) || {};
    const fatDrop = (f0.massa_gorda ?? 0) - Math.min(...ws.map((w) => w.massa_gorda ?? Infinity));
    const musGain = Math.max(...ws.map((w) => w.massa_muscular ?? -Infinity)) - (f0.massa_muscular ?? 0);
    if (f0.massa_gorda != null && fatDrop >= 1) res.fat1 = Math.floor(fatDrop + 1e-9);
    if (f0.massa_muscular != null && musGain >= 1) res.muscle1 = Math.floor(musGain + 1e-9);
    if (ws.some((w) => w.gordura_visceral != null && w.gordura_visceral < 8)) res.visc7 = 1;
    const mon = (d) => addDays(d, -((weekday(d) + 6) % 7));
    const weeks = [...new Set(ws.map((w) => mon(w.data)))].sort();
    let run = 0, best = 0;
    weeks.forEach((wk, i) => {
      run = i && addDays(weeks[i - 1], 7) === wk ? run + 1 : 1;
      best = Math.max(best, run);
      if (run && run % 4 === 0) add('weigh4');
    });
    prog.fat1 = f0.massa_gorda != null && lastWith('massa_gorda').massa_gorda != null ? `Até agora: ${(f0.massa_gorda - lastWith('massa_gorda').massa_gorda).toFixed(1).replace('.', ',')} kg` : '';
    prog.muscle1 = f0.massa_muscular != null && lastWith('massa_muscular').massa_muscular != null ? `Até agora: ${(lastWith('massa_muscular').massa_muscular - f0.massa_muscular).toFixed(1).replace('.', ',')} kg` : '';
    prog.visc7 = lastWith('gordura_visceral').gordura_visceral != null ? `Última: ${lastWith('gordura_visceral').gordura_visceral}` : '';
    prog.weigh4 = `Sequência: ${run % 4}/4 semanas`;
  } else {
    prog.fat1 = prog.muscle1 = prog.visc7 = prog.weigh4 = 'Registre pesagens na aba Corpo';
  }

  const today = todayISO();
  const exams = S.exams || [];
  const okExams = exams.filter((e) => ['ok', 'soon'].includes(examStatus(e, today).state)).length;
  if (exams.length && okExams === exams.length) res.checkup = 1;

  const cur = monthSummary(S, today.slice(0, 7));
  prog.first = first ? '' : 'Complete um dia inteiro';
  prog.clean7 = `Sequência atual: ${st.clean % 7}/7`;
  prog.salad30 = `Sequência atual: ${st.salad % 30}/30`;
  prog.cookie30 = `Sequência atual: ${st.cookie % 30}/30`;
  prog.sleep30 = `Sequência atual: ${st.sleep % 30}/30`;
  prog.zen = `Este mês: ${cur.stats.meditation ? cur.stats.meditation.days : 0}/15 dias`;
  prog.reader = `Este mês: ${cur.stats.reading ? cur.stats.reading.n : 0}/10`;
  prog.goal = `Este mês: ${Math.max(0, Math.round((cur.balance / cur.pool) * 100))}%`;
  prog.ultra = prog.goal;
  prog.checkup = `${okExams}/${exams.length} exames em dia`;
  prog.km50 = S.strava?.token ? `Este mês: ${cur.km.toFixed(1).replace('.', ',')} km` : 'Conecte o Strava';
  prog.km100 = prog.km50;
  prog.week = 'Feche uma semana sem falhar';
  prog.perfectMonth = 'Termine um mês sem desmarcar nada';
  prog.nobeer = 'Termine um mês sem cerveja';
  return { res, prog, best: { bestReading, bestKm } };
}
