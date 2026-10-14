// Napisy rozmow w stylu gry: imie mowiacego w jego kolorze, plynne pojawianie, czas zalezny od dlugosci tekstu.
// Naraz widac najwyzej dwie linie (rozne osoby jedna pod druga); kolejne czekaja w kolejce. Pasek siedzi nad HUD-em
// i podpowiedziami (dolna czesc ekranu), wiec nie zaslania srodka.
// API: showSubtitle({ speaker, text, mood, ms }) i hideSubtitle(speaker?) — wolane przez docinki.js (REZYSER).
const WHO = {
  peter: ['PETER', '#ff4650'], may: ['CIOCIA MAY', '#ffb86b'], mj: ['MJ', '#ff7ac0'], yuri: ['YURI', '#5db0ff'],
  fisk: ['FISK', '#c6a2ff'], rhino: ['NOSOROŻEC', '#ff8a3d'], thug: ['BANDYTA', '#c4ccd4'], radio: ['RADIO', '#6fe6c9'],
};
const MAX_LINES = 2;
let box = null, lines = [], queue = [];

function ensure() {
  if (box) return;
  const st = document.createElement('style');
  st.textContent = `
#napisy{position:fixed;left:50%;bottom:200px;transform:translateX(-50%);z-index:6;width:min(780px,calc(100vw - 520px));min-width:300px;
  display:flex;flex-direction:column;gap:6px;align-items:stretch;pointer-events:none;font-family:Rajdhani,Arial,sans-serif}
.nap{position:relative;padding:8px 20px 9px 18px;background:linear-gradient(90deg,rgba(4,10,18,.9),rgba(4,10,18,.78));
  border-left:4px solid var(--c);border-radius:0 6px 6px 0;box-shadow:0 4px 18px rgba(0,0,0,.45);
  opacity:0;transform:translateY(8px);transition:opacity .28s ease,transform .28s ease;overflow:hidden}
.nap.in{opacity:1;transform:none}
.nap.out{opacity:0;transform:translateY(-4px);transition-duration:.4s}
.nap b{display:block;font-size:12px;letter-spacing:3px;font-weight:700;color:var(--c);margin-bottom:1px;text-shadow:0 0 8px rgba(0,0,0,.7)}
.nap span{display:block;font-size:21px;line-height:1.28;font-weight:600;color:#fff;text-shadow:0 1px 3px #000,0 0 8px rgba(0,0,0,.8)}
.nap.excited span{font-weight:700}
.nap.dry span{color:#e4eaf0;font-style:italic}
.nap.strained span{animation:napdrz .09s linear infinite}
.nap i{position:absolute;left:0;bottom:0;height:2px;width:100%;background:var(--c);opacity:.55;transform-origin:left;animation:napbar var(--d) linear forwards}
@keyframes napbar{to{transform:scaleX(0)}}
@keyframes napdrz{50%{transform:translateX(.6px)}}
@media (max-width:1100px){#napisy{width:calc(100vw - 40px)}}`;
  document.head.appendChild(st);
  box = document.createElement('div'); box.id = 'napisy'; document.body.appendChild(box);
}

const duration = (text, ms) => ms > 0 ? ms : Math.min(9000, 1700 + text.length * 62);

function remove(l) {
  clearTimeout(l.timer); l.el.classList.remove('in'); l.el.classList.add('out');
  lines = lines.filter(x => x !== l);
  setTimeout(() => { l.el.remove(); pump(); }, 420);
}
function start(o) {
  ensure();
  const [name, col] = WHO[o.speaker] || [String(o.speaker || 'PETER').toUpperCase(), '#ffffff'];
  const el = document.createElement('div'); el.className = 'nap ' + (o.mood || 'normal'); el.style.setProperty('--c', col);
  const d = duration(o.text, o.ms);
  el.style.setProperty('--d', d + 'ms');
  el.innerHTML = '<b></b><span></span><i></i>';
  el.firstChild.textContent = name; el.children[1].textContent = o.text;
  box.appendChild(el);
  const l = { el, speaker: o.speaker || 'peter', timer: 0 };
  lines.push(l);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  l.timer = setTimeout(() => remove(l), d);
}
function pump() { while (queue.length && lines.length < MAX_LINES) start(queue.shift()); }

export function showSubtitle({ speaker = 'peter', text = '', mood = 'normal', ms = 0 } = {}) {
  if (!text) return;
  const o = { speaker, text, mood, ms };
  ensure();
  // ten sam mowiacy zastepuje swoja poprzednia linie; drugi mowiacy pojawia sie pod spodem
  const same = lines.find(l => l.speaker === speaker);
  if (same) { remove(same); queue = queue.filter(q => q.speaker !== speaker); start(o); return; }
  if (lines.length < MAX_LINES) start(o); else queue.push(o);
}
export function hideSubtitle(speaker) {
  queue = speaker ? queue.filter(q => q.speaker !== speaker) : [];
  for (const l of [...lines]) if (!speaker || l.speaker === speaker) remove(l);
}
