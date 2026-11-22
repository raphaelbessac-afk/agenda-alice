// Composição corporal (balança de bioimpedância): campos, comparações, bônus e
// recebimento de pesagens criptografadas (o repositório é público, então cada
// pesagem chega trancada com a chave pública do app e só ele a abre).

// dir: 'down' = menor é melhor, 'up' = maior é melhor, '' = neutro
export const FIELDS = [
  { k: 'peso', label: 'Peso', unit: 'kg', dir: 'down', main: true, d: 2 },
  { k: 'gordura_pct', label: 'Gordura', unit: '%', dir: 'down', main: true },
  { k: 'massa_gorda', label: 'Massa gorda', unit: 'kg', dir: 'down', main: true },
  { k: 'massa_muscular', label: 'Massa muscular', unit: 'kg', dir: 'up', main: true },
  { k: 'gordura_visceral', label: 'Gordura visceral', unit: '', dir: 'down', main: true },
  { k: 'agua_pct', label: 'Água', unit: '%', dir: 'up', main: true },
  { k: 'idade_metabolica', label: 'Idade metabólica', unit: 'anos', dir: 'down', main: true, d: 0 },
  { k: 'tmb', label: 'Metabolismo basal', unit: 'kcal', dir: 'up', main: true, d: 0 },
  { k: 'imc', label: 'IMC', unit: '', dir: 'down' },
  { k: 'gordura_subcutanea_pct', label: 'Gordura subcutânea', unit: '%', dir: 'down' },
  { k: 'taxa_muscular_pct', label: 'Taxa muscular', unit: '%', dir: 'up' },
  { k: 'mme_pct', label: 'Músculo esquelético', unit: '%', dir: 'up' },
  { k: 'massa_livre_gordura', label: 'Massa livre de gordura', unit: 'kg', dir: 'up' },
  { k: 'massa_proteica', label: 'Massa proteica', unit: 'kg', dir: 'up' },
  { k: 'proteina_pct', label: 'Proteína', unit: '%', dir: 'up' },
  { k: 'agua_kg', label: 'Água', unit: 'kg', dir: '' },
  { k: 'massa_ossea', label: 'Massa óssea', unit: 'kg', dir: '' },
  { k: 'whr', label: 'Relação cintura-quadril', unit: '', dir: 'down', d: 2 },
];
export const FIELD = Object.fromEntries(FIELDS.map((f) => [f.k, f]));

export const SEGMENTS = [
  { k: 'braco_esq', label: 'Braço esq.' },
  { k: 'braco_dir', label: 'Braço dir.' },
  { k: 'tronco', label: 'Tronco' },
  { k: 'perna_esq', label: 'Perna esq.' },
  { k: 'perna_dir', label: 'Perna dir.' },
];

export const CHART_KEYS = ['peso', 'gordura_pct', 'massa_gorda', 'massa_muscular', 'gordura_visceral', 'agua_pct'];

const key = (w) => `${w.data} ${w.hora || '00:00'}`;
export function weighings(S) {
  return Object.values(S.weighings || {}).filter((w) => w && w.data).sort((a, b) => (key(a) < key(b) ? -1 : 1));
}
export function inMonth(S, ym) {
  return weighings(S).filter((w) => w.data.startsWith(ym));
}

export function fmtVal(f, v) {
  if (v === undefined || v === null || v === '') return '—';
  const d = f.d ?? 1;
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

// Variação a e b: { diff, good } (good: true melhorou, false piorou, null neutro/igual)
export function delta(f, a, b) {
  if (a == null || b == null) return null;
  const diff = Math.round((b - a) * 100) / 100;
  if (diff === 0 || !f.dir) return { diff, good: null };
  return { diff, good: f.dir === 'down' ? diff < 0 : diff > 0 };
}

// Bônus de progresso do mês: compara a 1ª e a última pesagem do mês.
export function monthProgress(S, ym, cfg) {
  const ws = inMonth(S, ym);
  const items = [];
  const cmp = (k) => {
    const has = ws.filter((w) => w[k] != null);
    return has.length >= 2 ? [has[0], has[has.length - 1]] : null;
  };
  const fat = cfg && cfg.fatPct > 0 && cmp('gordura_pct');
  if (fat)
    items.push({ id: 'body-fat', emoji: '⚖️', ok: fat[1].gordura_pct < fat[0].gordura_pct, amount: cfg.fatPct, day: fat[1].data, label: `Gordura caiu: ${fmtVal(FIELD.gordura_pct, fat[0].gordura_pct)}% → ${fmtVal(FIELD.gordura_pct, fat[1].gordura_pct)}%` });
  const vis = cfg && cfg.visceral > 0 && cmp('gordura_visceral');
  if (vis)
    items.push({ id: 'body-visc', emoji: '🫀', ok: vis[1].gordura_visceral < vis[0].gordura_visceral, amount: cfg.visceral, day: vis[1].data, label: `Visceral caiu: ${vis[0].gordura_visceral} → ${vis[1].gordura_visceral}` });
  return { ws, items, first: ws[0], last: ws[ws.length - 1] };
}

// ---------- criptografia (RSA-OAEP 2048 + AES-GCM 256) ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };

export async function makeKeys() {
  const kp = await crypto.subtle.generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
  const pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
  const priv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  return { pub: { kty: pub.kty, n: pub.n, e: pub.e, alg: pub.alg }, priv };
}

export async function decryptEntry(privJwk, entry) {
  const priv = await crypto.subtle.importKey('jwk', privJwk, RSA, false, ['decrypt']);
  const raw = await crypto.subtle.decrypt(RSA, priv, unb64(entry.k));
  const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(entry.iv) }, aes, unb64(entry.c));
  return JSON.parse(new TextDecoder().decode(plain));
}

// Busca o arquivo de pesagens e importa as novas ou alteradas. Devolve a lista importada.
export async function fetchFeed(S) {
  const sc = S.scale || {};
  if (!sc.priv || !navigator.onLine) return [];
  const r = await fetch('data/pesagens.json', { cache: 'no-store' });
  if (!r.ok) return [];
  const feed = await r.json();
  const out = [];
  for (const e of feed.entries || []) {
    if (!e || !e.id || !e.k) continue;
    const mark = e.k.slice(0, 24);
    if (sc.seen && (sc.seen[e.id] === mark || sc.seen[e.id] === 'apagada')) continue;
    try {
      const w = await decryptEntry(sc.priv, e);
      out.push({ id: e.id, w, mark });
    } catch (err) {
      // trancada com outra chave: ignora
    }
  }
  return out;
}
