// Regras padrão do Endurance. Dias da semana: 0 = domingo ... 6 = sábado.
// Hábitos recorrentes dividem o "pote" do mês (R$300) proporcionalmente ao peso,
// de modo que um mês perfeito some exatamente o valor do pote.

export const DEFAULT_RULES = {
  pool: 300,
  recurring: [
    { id: 'run', name: 'Correr', emoji: '🏃', days: [1, 3, 5, 6], weight: 6 },
    { id: 'gym', name: 'Malhar', emoji: '🏋️', days: [2, 4], weight: 9 },
    { id: 'salad', name: 'Salada no jantar', emoji: '🥗', days: [0, 1, 2, 3, 4, 5, 6], weight: 4 },
  ],
  extras: [
    { id: 'medical', name: 'Consulta ou exame', emoji: '🩺', value: 40, max: 3 },
    { id: 'reading', name: 'Ler 30 min', emoji: '📖', value: 8, max: 2 },
  ],
  penalties: [
    { id: 'cookie', name: 'Biscoito recheado', emoji: '🍪', value: 25, max: 5 },
    { id: 'beer', name: 'Cerveja', emoji: '🍺', value: 25, max: 5 },
    { id: 'pizza', name: 'Pizza', emoji: '🍕', value: 15, max: 5 },
    { id: 'fried', name: 'Fritura', emoji: '🍟', value: 6, max: 5 },
    { id: 'wine', name: 'Vinho', emoji: '🍷', type: 'tiers', tiers: [{ label: '1 taça', value: 10 }, { label: '2+ taças', value: 25 }] },
    { id: 'sleep', name: 'Dormi depois da meia-noite', emoji: '🌙', type: 'toggle', value: 10 },
  ],
  bonuses: {
    streak: { habit: 'salad', every: 7, value: 5 },
    perfectWeek: { habits: ['run', 'gym'], value: 10 },
    jokers: 2,
  },
};

export const DEFAULT_EXAMS = [
  { id: 'clinico', name: 'Check-up clínico', emoji: '🩺', months: 12, last: null },
  { id: 'sangue', name: 'Exame de sangue', emoji: '🩸', months: 12, last: null },
  { id: 'dentista', name: 'Dentista', emoji: '🦷', months: 6, last: null },
  { id: 'oftalmo', name: 'Oftalmologista', emoji: '👓', months: 12, last: null },
  { id: 'dermato', name: 'Dermatologista', emoji: '🧴', months: 12, last: null },
];

export const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'];
export const GYM_TYPES = ['WeightTraining', 'Workout', 'Crossfit', 'HighIntensityIntervalTraining'];
