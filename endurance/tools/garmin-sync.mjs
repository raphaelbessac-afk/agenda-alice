#!/usr/bin/env node
// Grava as atividades do Garmin, criptografadas, em endurance/data/garmin.json.
// Uso: node endurance/tools/garmin-sync.mjs atividades.json [--months 2026-11,2026-12]
// atividades.json é a resposta da ferramenta do conector Garmin "atividades_por_periodo"
// (uma lista, ou um objeto { result: [...] }). Cada mês vira uma entrada que SUBSTITUI
// a anterior, então busque sempre o mês inteiro (do dia 1 até hoje).
// --months garante a entrada de um mês mesmo sem atividades (zera o mês no app).
import { readFileSync } from 'node:fs';
import { loadPublicKey, encryptEntry, readFeed, upsert, writeFeed } from './lib.mjs';

const args = process.argv.slice(2);
const mi = args.indexOf('--months');
const months = new Set(mi >= 0 ? args[mi + 1].split(',').map((s) => s.trim()).filter(Boolean) : []);
const files = args.filter((a, i) => a !== '--months' && i !== mi + 1);
if (!files.length) {
  console.error('Uso: node endurance/tools/garmin-sync.mjs atividades.json [--months AAAA-MM,...]');
  process.exit(1);
}

const TYPE = (t) => {
  if (/run/.test(t)) return 'Run';
  if (/strength|hiit|weight/.test(t)) return 'WeightTraining';
  if (/breath|meditat/.test(t)) return 'Breathwork';
  if (/walk|hik/.test(t)) return 'Walk';
  if (/cycl|bik|ride/.test(t)) return 'Ride';
  if (/swim/.test(t)) return 'Swim';
  if (/yoga|pilates/.test(t)) return 'Yoga';
  if (/cardio|fitness|elliptical|stair/.test(t)) return 'Workout';
  return t || 'Other';
};

const byMonth = {};
for (const m of months) byMonth[m] = {};
for (const f of files) {
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.result || raw.activities || [];
  for (const a of list) {
    const when = String(a.startTimeLocal || '');
    const date = when.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const ym = date.slice(0, 7);
    const day = ((byMonth[ym] = byMonth[ym] || {})[date] = byMonth[ym][date] || []);
    if (day.some((x) => x.id === a.activityId)) continue;
    day.push({
      id: a.activityId,
      src: 'garmin',
      type: TYPE(String(a.activityType || '')),
      gtype: a.activityType,
      name: a.activityName || '',
      hora: when.slice(11, 16),
      km: a.distance ? Math.round(a.distance / 10) / 100 : 0,
      min: Math.round((a.movingDuration || a.duration || 0) / 60) || Math.round((a.duration || 0) / 60),
      hr: a.averageHR || null,
      kcal: a.calories || null,
      te: a.trainingEffectLabel && a.trainingEffectLabel !== 'UNKNOWN' ? a.trainingEffectLabel : null,
    });
  }
}

const pub = await loadPublicKey();
const feed = readFeed('garmin.json');
const syncedAt = Date.now();
for (const [ym, acts] of Object.entries(byMonth).sort()) {
  const n = Object.values(acts).flat().length;
  upsert(feed, await encryptEntry(pub, `garmin-${ym}`, { month: ym, syncedAt, acts }));
  const runs = Object.values(acts).flat().filter((x) => x.type === 'Run');
  console.log(`✓ ${ym}: ${n} atividades (${runs.length} corridas, ${runs.reduce((s, x) => s + x.km, 0).toFixed(1)} km)`);
}
writeFeed('garmin.json', feed);
