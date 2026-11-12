// Interface da nuvem: cartão em Ajustes, folha de login e escolha de dados.
import * as Cloud from '../cloud.js';
import { esc, brl, fmtDateLong } from '../utils.js';
import { toast } from '../fx.js';

const RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, write: if request.auth != null
        && request.auth.uid == uid;
    }
  }
}`;

export function statusLine(s) {
  const when = s.lastSync ? new Date(s.lastSync).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : null;
  const map = {
    off: ['⚪', 'Nuvem não configurada'],
    signedout: ['⚪', 'Não conectado'],
    syncing: ['🔄', 'Sincronizando…'],
    synced: ['🟢', when ? `Sincronizado às ${when}` : 'Sincronizado'],
    pending: ['🟡', s.msg || 'Alterações aguardando envio'],
    error: ['🔴', s.msg || 'Erro na sincronização'],
  };
  const [i, t] = map[s.state] || map.off;
  return `${i} ${esc(t)}`;
}

export function cloudSection(app) {
  const s = Cloud.getStatus();
  if (!s.configured) {
    return `<p class="hint">Guarde seus dados num banco do Google (Firebase), gratuito. Assim você não perde nada se trocar de celular e pode usar em mais de um aparelho.</p>
    <details class="more" open><summary>Como criar (uns 10 minutos, uma vez só)</summary>
    <ol class="steps">
      <li>Acesse <b>console.firebase.google.com</b> e crie um projeto (ex.: <i>endurance</i>). Pode desligar o Analytics.</li>
      <li><b>Authentication</b> › Vamos começar › ative <b>E-mail/senha</b> (e <b>Google</b>, se quiser). Em <b>Configurações › Domínios autorizados</b>, adicione <code>${esc(location.hostname)}</code>.</li>
      <li><b>Firestore Database</b> › Criar banco › modo de produção, região <i>southamerica-east1 (São Paulo)</i>. Na aba <b>Regras</b>, cole:<pre class="code">${esc(RULES)}</pre><button class="btn small" data-act="copy-rules">Copiar regras</button></li>
      <li>Engrenagem ⚙️ › <b>Configurações do projeto</b> › Seus apps › ícone <b>&lt;/&gt;</b> (Web) › registre <i>Endurance</i>. Copie o bloco <code>firebaseConfig</code> e cole abaixo.</li>
    </ol></details>
    <label class="fl"><span>Configuração do Firebase</span><textarea id="fb-cfg" rows="5" placeholder="const firebaseConfig = { apiKey: &quot;…&quot;, authDomain: &quot;…&quot;, projectId: &quot;…&quot;, … };"></textarea></label>
    <button class="btn primary block" data-act="fb-save-cfg">Salvar configuração</button>`;
  }
  if (!s.signedIn) {
    return `<p class="cloud-st" data-cloud-status>${statusLine(s)}</p>
    <p class="hint">Entre ou crie sua conta para guardar os dados na nuvem.</p>
    <button class="btn primary block" data-act="fb-login">☁️ Entrar ou criar conta</button>
    ${Cloud.configFromFile() ? '' : '<button class="btn ghost block" data-act="fb-clear-cfg">Trocar configuração do Firebase</button>'}`;
  }
  return `<div class="strava-ok"><span class="sv-logo cloud">☁️</span><div><b>${esc(s.email || 'Conectado')}</b><small data-cloud-status>${statusLine(s)}</small></div></div>
    <p class="hint">Cada alteração vai para a nuvem em segundos. Sem internet, o app guarda no aparelho e envia depois.</p>
    <button class="btn ghost block" data-act="fb-sync">🔄 Sincronizar agora</button>
    <button class="btn ghost block danger" data-act="fb-logout">Sair da conta</button>`;
}

export function loginSheet(app) {
  const mode = app.ui.loginMode || 'in';
  return `<div class="sheet-head"><h2>☁️ ${mode === 'up' ? 'Criar conta' : 'Entrar'}</h2></div>
  <div class="seg wide3 login-seg"><button class="${mode === 'in' ? 'on' : ''}" data-act="fb-mode" data-m="in">Já tenho conta</button><button class="${mode === 'up' ? 'on' : ''}" data-act="fb-mode" data-m="up">Criar conta</button></div>
  <div class="form">
    <label class="fl"><span>E-mail</span><input id="fb-email" type="email" autocomplete="email" inputmode="email" value="${esc(app.ui.loginEmail || '')}"></label>
    <label class="fl"><span>Senha ${mode === 'up' ? '(mínimo 6 caracteres)' : ''}</span><input id="fb-pw" type="password" autocomplete="${mode === 'up' ? 'new-password' : 'current-password'}"></label>
  </div>
  <button class="btn primary block big" data-act="fb-submit">${mode === 'up' ? 'Criar conta' : 'Entrar'}</button>
  ${mode === 'in' ? '<button class="link block-link" data-act="fb-reset">Esqueci a senha</button>' : ''}
  <div class="or"><span>ou</span></div>
  <button class="btn ghost block" data-act="fb-google"><b class="g">G</b> Entrar com Google</button>
  <p class="hint center">No app instalado no iPhone, prefira e-mail e senha: o login do Google pode abrir fora do app.</p>`;
}

function summary(st) {
  const days = Object.keys(st.days || {}).length;
  const since = st.setup ? fmtDateLong(st.setup.startDate) : '—';
  return `${days} dias registrados · desde ${since}`;
}

export function conflictSheet(remote, local, d) {
  const when = d.updatedAt ? new Date(d.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  return `<div class="closing"><div class="podium">☁️</div><h2>Qual versão usar?</h2>
  <p class="lead">Já existem dados na nuvem e também neste aparelho. Escolha qual fica. A outra será substituída.</p>
  <button class="opt block-opt" data-act="fb-choose" data-v="remote"><b>☁️ Dados da nuvem</b><small>${esc(summary(remote))}<br>Último envio: ${esc(when)}${d.device ? ` (${esc(d.device)})` : ''}</small></button>
  <button class="opt block-opt" data-act="fb-choose" data-v="local"><b>📱 Dados deste aparelho</b><small>${esc(summary(local))}</small></button></div>`;
}

export const cloudActions = {
  'fb-save-cfg'(app) {
    try {
      const c = Cloud.parseConfig(document.getElementById('fb-cfg').value);
      Cloud.saveConfig(c);
      toast('✅ Configuração salva. Agora entre na sua conta.');
      app.startCloud();
      app.render();
      app.openLogin();
    } catch (e) {
      toast(esc(e.message), { kind: 'bad', ms: 5000 });
    }
  },
  'fb-clear-cfg'(app) {
    if (!confirm('Remover a configuração do Firebase deste aparelho?')) return;
    Cloud.clearConfig();
    location.reload();
  },
  async 'copy-rules'() {
    try {
      await navigator.clipboard.writeText(RULES);
      toast('Regras copiadas!');
    } catch (e) {
      toast('Selecione e copie o texto manualmente.');
    }
  },
  'fb-login'(app) {
    app.openLogin();
  },
  'fb-mode'(app, el) {
    app.ui.loginEmail = document.getElementById('fb-email')?.value || '';
    app.ui.loginMode = el.dataset.m;
    app.refreshSheet();
  },
  async 'fb-submit'(app, el) {
    const email = document.getElementById('fb-email').value;
    const pw = document.getElementById('fb-pw').value;
    app.ui.loginEmail = email;
    el.disabled = true;
    try {
      if (app.ui.loginMode === 'up') await Cloud.signUp(email, pw);
      else await Cloud.signIn(email, pw);
      app.closeSheet();
      toast('☁️ Conectado! Seus dados agora vão para a nuvem.', { kind: 'good' });
    } catch (e) {
      el.disabled = false;
      toast(esc(e.message), { kind: 'bad', ms: 5000 });
    }
  },
  async 'fb-reset'() {
    const email = document.getElementById('fb-email').value;
    if (!email) return toast('Digite seu e-mail primeiro.');
    try {
      await Cloud.resetPassword(email);
      toast('📧 Enviamos um link para redefinir a senha.');
    } catch (e) {
      toast(esc(e.message), { kind: 'bad' });
    }
  },
  async 'fb-google'(app) {
    try {
      await Cloud.google();
      app.closeSheet();
      toast('☁️ Conectado com Google!', { kind: 'good' });
    } catch (e) {
      toast(esc(e.message), { kind: 'bad', ms: 5000 });
    }
  },
  async 'fb-sync'() {
    await Cloud.push();
    const s = Cloud.getStatus();
    toast(s.state === 'error' ? esc(s.msg) : '☁️ Tudo sincronizado.', { kind: s.state === 'error' ? 'bad' : 'info' });
  },
  async 'fb-logout'(app) {
    if (!confirm('Sair da conta? Os dados continuam neste aparelho, mas param de sincronizar.')) return;
    await Cloud.signOut();
    app.render();
  },
  'fb-choose'(app, el) {
    app._conflictCb && app._conflictCb(el.dataset.v);
  },
};
