// Integração com o Strava direto do navegador (sem servidor).
// O usuário cria um "app de API" próprio no Strava e informa Client ID e Secret.
import { addDays, todayISO } from './utils.js';

const AUTH = 'https://www.strava.com/oauth/authorize';
const TOKEN = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';

export const redirectUri = () => location.origin + location.pathname;

export function startAuth(S) {
  const q = new URLSearchParams({
    client_id: S.strava.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  });
  location.href = `${AUTH}?${q}`;
}

async function tokenRequest(params) {
  const r = await fetch(TOKEN, { method: 'POST', body: new URLSearchParams(params) });
  if (!r.ok) {
    let msg = `Strava respondeu ${r.status}`;
    try {
      const j = await r.json();
      if (j.message) msg += `: ${j.message}`;
    } catch (e) { /* ignora */ }
    throw new Error(msg);
  }
  return r.json();
}

export async function exchangeCode(S, code) {
  const st = S.strava;
  if (!st.clientId || !st.clientSecret) throw new Error('Preencha Client ID e Client Secret primeiro.');
  const j = await tokenRequest({ client_id: st.clientId, client_secret: st.clientSecret, code: code.trim(), grant_type: 'authorization_code' });
  st.token = { access: j.access_token, refresh: j.refresh_token, expiresAt: j.expires_at };
  if (j.athlete) st.athlete = [j.athlete.firstname, j.athlete.lastname].filter(Boolean).join(' ');
  st.connectedAt = todayISO();
}

async function accessToken(S) {
  const st = S.strava;
  if (!st.token) throw new Error('Strava não conectado');
  if (st.token.expiresAt * 1000 > Date.now() + 60000) return st.token.access;
  const j = await tokenRequest({ client_id: st.clientId, client_secret: st.clientSecret, grant_type: 'refresh_token', refresh_token: st.token.refresh });
  st.token = { access: j.access_token, refresh: j.refresh_token, expiresAt: j.expires_at };
  return st.token.access;
}

// Busca atividades desde o início (primeira vez) ou dos últimos 40 dias.
export async function sync(S) {
  const st = S.strava;
  const token = await accessToken(S);
  const start = S.setup.startDate;
  let from = st.coverFrom ? addDays(todayISO(), -40) : start;
  if (from < start) from = start;
  const after = Math.floor(new Date(from + 'T00:00:00').getTime() / 1000);
  const acts = [];
  for (let page = 1; page <= 10; page++) {
    const r = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
    if (r.status === 401) throw new Error('Permissão do Strava expirou. Conecte de novo.');
    if (!r.ok) throw new Error(`Strava respondeu ${r.status}`);
    const list = await r.json();
    acts.push(...list);
    if (list.length < 100) break;
  }
  const byDate = { ...(st.acts || {}) };
  for (const k of Object.keys(byDate)) if (k >= from) delete byDate[k];
  for (const a of acts) {
    const d = (a.start_date_local || a.start_date).slice(0, 10);
    (byDate[d] = byDate[d] || []).push({
      id: a.id,
      type: a.sport_type || a.type,
      km: Math.round((a.distance / 1000) * 100) / 100,
      min: Math.round((a.moving_time || 0) / 60),
      name: a.name,
    });
  }
  st.acts = byDate;
  if (!st.coverFrom) st.coverFrom = from;
  st.lastSync = Date.now();
  return acts.length;
}

export function disconnect(S) {
  const keep = { clientId: S.strava.clientId, clientSecret: S.strava.clientSecret };
  S.strava = keep;
}
