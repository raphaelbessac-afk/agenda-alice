// Arquivos: lembretes de calendário (.ics) e backup (.json).
import { todayISO } from './utils.js';

export const REMINDERS = [
  { id: 'run', on: true, time: '06:30', title: '🏃 Dia de corrida! Bora pra rua', days: 'FR,SA,MO,WE' },
  { id: 'gym', on: true, time: '06:30', title: '🏋️ Dia de malhar! Partiu academia', days: 'TU,TH' },
  { id: 'salad', on: true, time: '19:30', title: '🥗 Salada no jantar = dinheiro no bolso', days: '' },
  { id: 'check', on: true, time: '21:30', title: '📲 Endurance: confira seu dia', days: '' },
  { id: 'sleep', on: true, time: '23:15', title: '🌙 Hora de ir pra cama (meia-noite custa R$ 10)', days: '' },
];

export function buildICS(items) {
  const t = todayISO().replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Endurance//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Endurance'];
  for (const it of items) {
    if (!it.on) continue;
    const hhmm = it.time.replace(':', '');
    const rrule = it.days ? `RRULE:FREQ=WEEKLY;BYDAY=${it.days}` : 'RRULE:FREQ=DAILY';
    lines.push(
      'BEGIN:VEVENT',
      `UID:endurance-${it.id}-${t}@endurance.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${t}T${hhmm}00`,
      'DURATION:PT5M',
      rrule,
      `SUMMARY:${it.title}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${it.title}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT'
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export async function deliverFile(name, content, type) {
  const file = new File([content], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'aborted';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function openICS(content) {
  // No iPhone, abrir o .ics direto faz o Calendário oferecer "Adicionar todos".
  const blob = new Blob([content], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'endurance-lembretes.ics';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
