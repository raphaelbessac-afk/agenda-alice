// Efeitos de celebração: confete, chuva de moedas, textos flutuantes e toasts.
const COLORS = ['#FF6B2C', '#FF3D8B', '#B8F23A', '#3DD6F5', '#FFD23F', '#8B6CFF', '#ffffff'];
let canvas, ctx, parts = [], running = false, dpr = 1;

function setup() {
  if (canvas) return;
  canvas = document.getElementById('fx');
  ctx = canvas.getContext('2d');
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
}

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  parts = parts.filter((p) => p.life > 0 && p.y < innerHeight + 60);
  for (const p of parts) {
    p.vy += p.g;
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= p.decay;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.translate(p.x * dpr, p.y * dpr);
    ctx.rotate(p.rot);
    if (p.emoji) {
      ctx.font = `${p.size * dpr}px system-ui, "Apple Color Emoji"`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.scale(1, Math.abs(Math.cos(p.rot * 1.5)) * 0.6 + 0.4);
      ctx.fillText(p.emoji, 0, 0);
    } else {
      ctx.fillStyle = p.color;
      ctx.scale(1, Math.cos(p.rot * 2));
      ctx.fillRect((-p.size / 2) * dpr, (-p.size / 4) * dpr, p.size * dpr, (p.size / 2) * dpr);
    }
    ctx.restore();
  }
  if (parts.length) requestAnimationFrame(loop);
  else {
    running = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}
function kick() {
  if (!running) {
    running = true;
    requestAnimationFrame(loop);
  }
}

export function burst(x, y, { count = 18, emoji = null, spread = 6, colors = COLORS } = {}) {
  if (reduced()) return;
  setup();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * spread + 2;
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s - 4,
      g: 0.28,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
      size: emoji ? 18 + Math.random() * 8 : 7 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      emoji: emoji && Math.random() < 0.7 ? emoji : null,
      life: 1.4,
      decay: 0.012 + Math.random() * 0.01,
    });
  }
  kick();
}

export function confetti({ count = 160, coins = true } = {}) {
  if (reduced()) return;
  setup();
  for (let i = 0; i < count; i++) {
    const coin = coins && Math.random() < 0.25;
    parts.push({
      x: Math.random() * innerWidth,
      y: -20 - Math.random() * innerHeight * 0.6,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 2 + 1,
      g: 0.06,
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      size: coin ? 22 + Math.random() * 10 : 8 + Math.random() * 7,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      emoji: coin ? (Math.random() < 0.5 ? '🪙' : '💰') : null,
      life: 3,
      decay: 0.004,
    });
  }
  // dois "canhões" laterais
  for (const side of [0, 1]) {
    for (let i = 0; i < 40; i++) {
      parts.push({
        x: side ? innerWidth + 10 : -10,
        y: innerHeight * 0.75,
        vx: (side ? -1 : 1) * (Math.random() * 9 + 5),
        vy: -(Math.random() * 12 + 8),
        g: 0.25,
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        size: 8 + Math.random() * 6,
        color: COLORS[(Math.random() * COLORS.length) | 0],
        life: 2.2,
        decay: 0.008,
      });
    }
  }
  kick();
}

export function floatText(x, y, text, cls = 'good') {
  const el = document.createElement('div');
  el.className = `float-txt ${cls}`;
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

export function toast(html, { kind = 'info', ms = 3200 } = {}) {
  const root = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.innerHTML = html;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

export function centerOf(el) {
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
