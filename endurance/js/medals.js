// Medalhas de conquista, no estilo de medalhas de prova.
import { timeline, monthSummary, monthsTracked, examStatus } from './engine.js';
import { todayISO } from './utils.js';

export const MEDALS = [
  { id: 'first', emoji: '👟', name: 'Primeiro passo', desc: 'Um dia completo: tudo feito e nenhum deslize.', color: '#3DD6F5' },
  { id: 'week', emoji: '🏁', name: 'Semana perfeita', desc: 'Todas as corridas e treinos da semana.', color: '#FF6B2C' },
  { id: 'clean7', emoji: '✨', name: 'Semana limpa', desc: '7 dias seguidos sem nenhum deslize.', color: '#8B6CFF' },
  { id: 'salad30', emoji: '🥗', name: 'Mestre da salada', desc: '30 saladas seguidas no jantar.', color: '#B8F23A' },
  { id: 'cookie30', emoji: '🍪', name: 'Adeus, biscoito', desc: '30 dias seguidos sem biscoito recheado.', color: '#FFD23F' },
  { id: 'sleep30', emoji: '😴', name: 'Sono de atleta', desc: '30 noites seguidas dormindo antes da meia-noite.', color: '#6C8BFF' },
  { id: 'reader', emoji: '📚', name: 'Rato de biblioteca', desc: '10 leituras de 30 min no mesmo mês.', color: '#FF9F43' },
  { id: 'goal', emoji: '🥇', name: 'Linha de chegada', desc: 'Bater o pote do mês (R$ 300).', color: '#FFD23F' },
  { id: 'ultra', emoji: '🚀', name: 'Ultramaratona', desc: 'Passar R$ 50 além do pote no mês.', color: '#FF3D8B' },
  { id: 'perfectMonth', emoji: '👑', name: 'Mês perfeito', desc: 'Todos os hábitos recorrentes de um mês inteiro.', color: '#FFD23F' },
  { id: 'nobeer', emoji: '🚱', name: 'Mês sem cerveja', desc: 'Um mês inteiro sem cerveja.', color: '#3DD6F5' },
  { id: 'checkup', emoji: '🩺', name: 'Check-up em dia', desc: 'Todos os exames da lista em dia.', color: '#B8F23A' },
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
      st.salad = sa.done ? st.salad + 1 : 0;
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
    bestKm = Math.max(bestKm, ms.km);
    if (ms.km >= 50) add('km50');
    if (ms.km >= 100) add('km100');
    if (ms.complete && ms.fullTracked) {
      if (ms.recPossible > 0 && ms.recDone >= ms.recPossible - 0.005) add('perfectMonth');
      if (ms.stats.beer && ms.stats.beer.n === 0) add('nobeer');
    }
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
