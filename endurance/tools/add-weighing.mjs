#!/usr/bin/env node
// Adiciona (ou substitui) pesagens criptografadas em endurance/data/pesagens.json.
// Uso: node endurance/tools/add-weighing.mjs pesagem.json [outra.json ...]
// Cada arquivo tem um objeto (ou uma lista) de pesagens no formato do app, com pelo menos
// { "data": "AAAA-MM-DD", "peso": 84.25 }. Veja FIELDS em endurance/js/body.js.
// Cada pesagem é trancada com a chave pública do app (data/scale-key.json):
// AES-GCM 256 com chave aleatória, e essa chave trancada com RSA-OAEP 2048 / SHA-256.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyPath = join(root, 'data', 'scale-key.json');
const feedPath = join(root, 'data', 'pesagens.json');
const { subtle } = globalThis.crypto;
const b64 = (buf) => Buffer.from(buf).toString('base64');

if (!existsSync(keyPath)) {
  console.error('Falta data/scale-key.json: ative "Receber pesagens por foto" na aba Corpo e salve aqui a chave pública.');
  process.exit(1);
}
const files = process.argv.slice(2);
if (!files.length) {
  console.error('Uso: node endurance/tools/add-weighing.mjs pesagem.json [...]');
  process.exit(1);
}

const jwk = JSON.parse(readFileSync(keyPath, 'utf8'));
const pub = await subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RSA-OAEP-256', ext: true }, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
const feed = existsSync(feedPath) ? JSON.parse(readFileSync(feedPath, 'utf8')) : { entries: [] };
feed.entries = feed.entries || [];

const NUM = /^-?\d+([.,]\d+)?$/;
for (const f of files) {
  const raw = JSON.parse(readFileSync(f, 'utf8'));
  for (const w0 of Array.isArray(raw) ? raw : [raw]) {
    const w = {};
    for (const [k, v] of Object.entries(w0)) w[k] = typeof v === 'string' && NUM.test(v) && !['data', 'hora'].includes(k) ? Number(v.replace(',', '.')) : v;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.data || '') || typeof w.peso !== 'number') throw new Error(`Pesagem inválida em ${f}: precisa de "data" (AAAA-MM-DD) e "peso" numérico.`);
    w.fonte = w.fonte || 'Fitdays';
    const aesRaw = globalThis.crypto.getRandomValues(new Uint8Array(32));
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const aes = await subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['encrypt']);
    const c = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(w)));
    const k = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, aesRaw);
    const entry = { id: w.data, k: b64(k), iv: b64(iv), c: b64(c) };
    const i = feed.entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) feed.entries[i] = entry;
    else feed.entries.push(entry);
    console.log(`✓ ${w.data}${w.hora ? ` ${w.hora}` : ''}: ${w.peso} kg ${i >= 0 ? '(substituída)' : '(nova)'}`);
  }
}
feed.entries.sort((a, b) => (a.id < b.id ? -1 : 1));
writeFileSync(feedPath, JSON.stringify(feed, null, 1) + '\n');
console.log(`${feed.entries.length} pesagem(ns) em data/pesagens.json`);
