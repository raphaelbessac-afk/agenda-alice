// Utilitários de data, dinheiro e texto. Datas são sempre strings "AAAA-MM-DD" no fuso local.

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
export const todayISO = () => iso(new Date());
export const ymOf = (s) => s.slice(0, 7);
export const daysInMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const monthStart = (ym) => `${ym}-01`;
export const monthEnd = (ym) => `${ym}-${pad(daysInMonth(ym))}`;
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const weekday = (s) => parse(s).getDay();

export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const WD_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const WD_LONG = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
export const WD_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
export const monthLabel = (ym) => `${cap(monthName(ym))} ${ym.slice(0, 4)}`;
export const fmtDay = (s) => {
  const d = parse(s);
  return `${WD_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};
export const fmtDateLong = (s) => {
  const d = parse(s);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
};
export const relDay = (s) => {
  const n = diffDays(s, todayISO());
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Ontem';
  if (n === 2) return 'Anteontem';
  return cap(fmtDay(s));
};

const nf = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const brl = (v, sign = false) => {
  const r = Math.round((v || 0) * 100) / 100;
  const s = nf.format(Math.abs(r)).replace(/ /g, ' ');
  if (r < 0) return `−${s}`;
  if (sign && r > 0) return `+${s}`;
  return s;
};
export const num = (v, d = 1) => (v || 0).toLocaleString('pt-BR', { maximumFractionDigits: d, minimumFractionDigits: 0 });

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clone = (o) => JSON.parse(JSON.stringify(o));
export const uid = (p = 'c') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
