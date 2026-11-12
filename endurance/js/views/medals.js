// Tela "Medalhas".
import { MEDALS, computeMedals } from '../medals.js';
import { esc } from '../utils.js';

export function renderMedals(app) {
  const { res, prog } = computeMedals(app.S);
  const got = MEDALS.filter((m) => res[m.id]).length;
  let html = `<header class="top"><h1>Medalhas</h1><span class="pill">${got}/${MEDALS.length}</span></header>`;
  html += `<p class="lead">Cada conquista vira uma medalha de prova. Algumas você ganha várias vezes.</p>`;
  html += `<div class="medals">${MEDALS.map((m) => {
    const n = res[m.id] || 0;
    return `<div class="medal ${n ? 'got' : 'locked'}" style="--mc:${m.color}">
      <div class="ribbon"></div>
      <div class="disc"><span>${m.emoji}</span>${n > 1 ? `<i class="times">${n}×</i>` : ''}</div>
      <b>${esc(m.name)}</b>
      <small>${esc(m.desc)}</small>
      ${n ? '' : `<em>${esc(prog[m.id] || '')}</em>`}
    </div>`;
  }).join('')}</div>`;
  return html;
}
