// Sincronização com a nuvem (Firebase Auth + Firestore).
// O app continua "local-first": os dados ficam no aparelho (funciona offline) e
// são enviados para users/{uid} no Firestore. Vale a última alteração.
import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const META_KEY = 'endurance:sync';
const CFG_KEY = 'endurance:fbconfig';

let fb = null;
let user = null;
let unsub = null;
let timer = null;
let ctx = null;
let firstSnap = true;
let attached = false;
const status = { state: 'off', msg: '' }; // off | signedout | syncing | synced | pending | error

const meta = (() => {
  try {
    return JSON.parse(localStorage.getItem(META_KEY)) || {};
  } catch (e) {
    return {};
  }
})();
const saveMeta = () => {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (e) { /* ignora */ }
};

export function getConfig() {
  if (FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) return FIREBASE_CONFIG;
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (c && c.apiKey) return c;
  } catch (e) { /* ignora */ }
  return null;
}
export const configFromFile = () => !!(FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);

// Aceita o trecho copiado do Console (objeto JavaScript) ou JSON.
export function parseConfig(text) {
  const m = String(text).match(/\{[\s\S]*\}/);
  if (!m) throw new Error('Não encontrei a configuração. Copie o bloco { apiKey: ... } inteiro.');
  const s = m[0]
    .replace(/\/\/.*$/gm, '')
    .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/'/g, '"')
    .replace(/,\s*}/g, '}');
  let c;
  try {
    c = JSON.parse(s);
  } catch (e) {
    throw new Error('Configuração com formato inválido.');
  }
  if (!c.apiKey || !c.projectId || !c.authDomain) throw new Error('Faltam campos (apiKey, authDomain, projectId).');
  return c;
}
export function saveConfig(c) {
  localStorage.setItem(CFG_KEY, JSON.stringify(c));
}
export function clearConfig() {
  localStorage.removeItem(CFG_KEY);
}

export const getStatus = () => ({ ...status, email: user ? user.email : meta.email || null, signedIn: !!user, configured: !!getConfig(), lastSync: meta.lastSync || null });

function setStatus(state, msg = '') {
  status.state = state;
  status.msg = msg;
  ctx && ctx.onStatus && ctx.onStatus(getStatus());
}

async function init() {
  if (fb) return fb;
  const cfg = getConfig();
  if (!cfg) return null;
  const [A0, A, F] = await Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js')]);
  const app = A0.initializeApp(cfg);
  const auth = A.initializeAuth(app, {
    persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence],
  });
  auth.languageCode = 'pt';
  const db = F.getFirestore(app);
  const emu = localStorage.getItem('endurance:emu'); // só para testes locais
  if (emu) {
    A.connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
    F.connectFirestoreEmulator(db, emu, 8080);
  }
  fb = { app, auth, db, A, F };
  return fb;
}

// ctx: { getState(), setState(state, info), onStatus(status), onConflict(remote, local) -> Promise<'remote'|'local'> }
export async function start(c) {
  ctx = c;
  if (attached) return;
  if (!getConfig()) return setStatus('off');
  try {
    await init();
  } catch (e) {
    return setStatus('error', navigator.onLine ? 'Não consegui carregar o Firebase.' : 'Offline');
  }
  attached = true;
  fb.A.onAuthStateChanged(fb.auth, (u) => {
    user = u;
    if (unsub) {
      unsub();
      unsub = null;
    }
    if (!u) return setStatus('signedout');
    firstSnap = true;
    setStatus('syncing');
    const ref = fb.F.doc(fb.db, 'users', u.uid);
    unsub = fb.F.onSnapshot(
      ref,
      (snap) => onRemote(snap).catch((e) => setStatus('error', e.message)),
      (err) => setStatus('error', friendly(err))
    );
  });
}
addEventListener('online', () => meta.pending && push());

async function onRemote(snap) {
  if (snap.metadata.hasPendingWrites) return;
  const local = ctx.getState();
  const linked = meta.uid === user.uid;
  if (!snap.exists()) {
    // Nuvem vazia: envia o que existe neste aparelho.
    meta.uid = user.uid;
    meta.email = user.email;
    saveMeta();
    if (local && local.setup) await push();
    else setStatus('synced');
    firstSnap = false;
    return;
  }
  const d = snap.data();
  const isFirst = firstSnap;
  firstSnap = false;
  if (linked && d.updatedAt <= (meta.remoteAt || 0)) {
    if (meta.pending) push();
    else setStatus('synced');
    return;
  }
  let remote;
  try {
    remote = JSON.parse(d.state);
  } catch (e) {
    return setStatus('error', 'Dados da nuvem ilegíveis.');
  }

  if (!linked) {
    // Primeira vez neste aparelho com esta conta.
    let choice = 'remote';
    if (local && local.setup && Object.keys(local.days || {}).length && isFirst) choice = await ctx.onConflict(remote, local, d);
    meta.uid = user.uid;
    meta.email = user.email;
    if (choice === 'local') {
      meta.remoteAt = d.updatedAt;
      saveMeta();
      return push();
    }
    return adopt(remote, d);
  }
  // Já vinculado: a alteração mais recente vence.
  if (meta.pending && (meta.localEditAt || 0) > d.updatedAt) return push();
  return adopt(remote, d);
}

function adopt(remote, d) {
  meta.remoteAt = d.updatedAt;
  meta.pending = false;
  meta.lastSync = Date.now();
  saveMeta();
  ctx.setState(remote, { device: d.device });
  setStatus('synced');
}

// Chamado a cada salvamento local.
export function changed() {
  meta.pending = true;
  meta.localEditAt = Date.now();
  saveMeta();
  if (!user) return;
  setStatus('pending');
  clearTimeout(timer);
  timer = setTimeout(push, 1500);
}

export async function push() {
  clearTimeout(timer);
  if (!user || !fb) return;
  if (!navigator.onLine) return setStatus('pending', 'Offline: envia quando voltar a internet.');
  const state = ctx.getState();
  if (!state || !state.setup) return;
  const at = Date.now();
  setStatus('syncing');
  try {
    await fb.F.setDoc(fb.F.doc(fb.db, 'users', user.uid), {
      state: JSON.stringify(state),
      updatedAt: at,
      device: deviceName(),
      email: user.email || null,
    });
    meta.remoteAt = at;
    meta.uid = user.uid;
    meta.email = user.email;
    if ((meta.localEditAt || 0) <= at) meta.pending = false;
    meta.lastSync = Date.now();
    saveMeta();
    setStatus(meta.pending ? 'pending' : 'synced');
  } catch (e) {
    setStatus('error', friendly(e));
  }
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows';
  return 'Navegador';
}

// ---------- autenticação ----------
async function ready() {
  const f = await init();
  if (!f) throw new Error('Configure a nuvem primeiro.');
  return f;
}
export async function signIn(email, pw) {
  const f = await ready();
  try {
    await f.A.signInWithEmailAndPassword(f.auth, email.trim(), pw);
  } catch (e) {
    throw new Error(friendly(e));
  }
}
export async function signUp(email, pw) {
  const f = await ready();
  try {
    await f.A.createUserWithEmailAndPassword(f.auth, email.trim(), pw);
  } catch (e) {
    throw new Error(friendly(e));
  }
}
export async function google() {
  const f = await ready();
  try {
    await f.A.signInWithPopup(f.auth, new f.A.GoogleAuthProvider(), f.A.browserPopupRedirectResolver);
  } catch (e) {
    throw new Error(friendly(e));
  }
}
export async function resetPassword(email) {
  const f = await ready();
  try {
    await f.A.sendPasswordResetEmail(f.auth, email.trim());
  } catch (e) {
    throw new Error(friendly(e));
  }
}
export async function signOut() {
  if (!fb) return;
  await fb.A.signOut(fb.auth);
  delete meta.uid;
  delete meta.remoteAt;
  saveMeta();
}

function friendly(e) {
  const c = (e && e.code) || '';
  const map = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/missing-password': 'Digite a senha.',
    'auth/weak-password': 'Senha fraca: use pelo menos 6 caracteres.',
    'auth/email-already-in-use': 'Esse e-mail já tem conta. Use "Entrar".',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'Conta não encontrada. Use "Criar conta".',
    'auth/too-many-requests': 'Muitas tentativas. Espere um pouco.',
    'auth/network-request-failed': 'Sem conexão com a internet.',
    'auth/popup-blocked': 'O navegador bloqueou a janela do Google.',
    'auth/popup-closed-by-user': 'Login com Google cancelado.',
    'auth/unauthorized-domain': 'Domínio não autorizado no Firebase (Authentication › Configurações › Domínios autorizados).',
    'auth/operation-not-allowed': 'Ative esse método de login no Firebase (Authentication › Método de login).',
    'permission-denied': 'Sem permissão no Firestore: confira as regras de segurança.',
    unavailable: 'Firestore indisponível (offline?).',
  };
  return map[c] || (e && e.message) || 'Erro desconhecido';
}
