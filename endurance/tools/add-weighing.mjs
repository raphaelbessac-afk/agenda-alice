#!/usr/bin/env node
// Adiciona (ou substitui) pesagens criptografadas em endurance/data/pesagens.json.
// Uso: node endurance/tools/add-weighing.mjs pesagem.json [outra.json ...]
// Cada arquivo tem um objeto (ou uma lista) de pesagens no formato do app, com pelo menos
// { "data": "AAAA-MM-DD", "peso": 84.25 }. Veja FIELDS em endurance/js/body.js.
import { readFileSync } from 'node:fs';
import { loadPublicKey, encryptEntry, readFeed, upsert, writeFeed } from './lib.mjs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node endurance/tools/add-weighing.mjs pesagem.json [...]');
  process.exit(1);
}
const pub = await loadPublicKey();
const feed = readFeed('pesagens.json');
const NUM = /^-?\d+([.,]\d+)?$/;
for (const f of files) {
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  for (const w0 of Array.isArray(raw) ? raw : [raw]) {
    const w = {};
    for (const [k, v] of Object.entries(w0)) w[k] = typeof v === 'string' && NUM.test(v) && !['data', 'hora'].includes(k) ? Number(v.replace(',', '.')) : v;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.data || '') || typeof w.peso !== 'number') throw new Error(`Pesagem inválida em ${f}: precisa de "data" (AAAA-MM-DD) e "peso" numérico.`);
    w.fonte = w.fonte || 'Fitdays';
    const replaced = upsert(feed, await encryptEntry(pub, w.data, w));
    console.log(`✓ ${w.data}${w.hora ? ` ${w.hora}` : ''}: ${w.peso} kg ${replaced ? '(substituída)' : '(nova)'}`);
  }
}
writeFeed('pesagens.json', feed);
console.log(`${feed.entries.length} pesagem(ns) em data/pesagens.json`);
