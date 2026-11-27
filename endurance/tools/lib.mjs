// Utilitários compartilhados pelos scripts: chave pública do app e criptografia
// (AES-GCM 256 com chave aleatória, trancada com RSA-OAEP 2048 / SHA-256).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { subtle } = globalThis.crypto;
const b64 = (buf) => Buffer.from(buf).toString('base64');

export async function loadPublicKey() {
  const keyPath = join(root, 'data', 'scale-key.json');
  if (!existsSync(keyPath)) {
    console.error('Falta data/scale-key.json: ative "Receber pesagens por foto" na aba Corpo e salve aqui a chave pública.');
    process.exit(1);
  }
  const jwk = JSON.parse(readFileSync(keyPath, 'utf8'));
  return subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RSA-OAEP-256', ext: true }, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
}

export async function encryptEntry(pub, id, obj) {
  const aesRaw = globalThis.crypto.getRandomValues(new Uint8Array(32));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const aes = await subtle.importKey('raw', aesRaw, 'AES-GCM', false, ['encrypt']);
  const c = await subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  const k = await subtle.encrypt({ name: 'RSA-OAEP' }, pub, aesRaw);
  return { id, k: b64(k), iv: b64(iv), c: b64(c) };
}

export function readFeed(name) {
  const p = join(root, 'data', name);
  const feed = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { entries: [] };
  feed.entries = feed.entries || [];
  return feed;
}

export function upsert(feed, entry) {
  const i = feed.entries.findIndex((e) => e.id === entry.id);
  if (i >= 0) feed.entries[i] = entry;
  else feed.entries.push(entry);
  return i >= 0;
}

export function writeFeed(name, feed) {
  feed.entries.sort((a, b) => (a.id < b.id ? -1 : 1));
  writeFileSync(join(root, 'data', name), JSON.stringify(feed, null, 1) + '\n');
}
