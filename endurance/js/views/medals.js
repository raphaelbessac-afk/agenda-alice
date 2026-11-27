// Tela "Medalhas".
import { MEDALS, computeMedals } from '../medals.js';
import { esc } from '../utils.js';

export function renderMedals(app) {
  const { res, prog } = computeMedals(app.S);
  const got = MEDALS.filter((m) => res[m.id]).length;
  let html = `<header class="top"><h1>Medalhas</h1><span class="pill">${got}/${MEDALS.length}</span></header>`;
  html += `<p class="lead">Cada conquista vira uma medalha de prova. Algumas você ganha várias vezes.</p>`;
  const card = (m) => {
    const n = res[m.id] || 0;
    return `<div class="medal ${n ? 'got' : 'locked'}" style="--mc:${m.color}">
      <div class="ribbon"></div>
      <div class="disc"><span>${m.emoji}</span>${n > 1 ? `<i class="times">${n}×</i>` : ''}</div>
      <b>${esc(m.name)}</b>
      <small>${esc(m.desc)}</small>
      ${n && !m.streak ? '' : `<em>${esc(prog[m.id] || '')}</em>`}
    </div>`;
  };
  html += `<h3 class="sec">Conquistas</h3><div class="medals">${MEDALS.filter((m) => !m.sec).map(card).join('')}</div>`;
  html += `<h3 class="sec">Constância <small>manter o ritmo</small></h3><p class="hint">Sequências que premiam continuar o que já deu medalha. Coringa conta como dia cumprido.</p><div class="medals">${MEDALS.filter((m) => m.sec === 'const').map(card).join('')}</div>`;
  return html;
}
