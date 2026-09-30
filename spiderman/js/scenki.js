// Przerywniki filmowe: pasy kinowe, ruch kamery, napisy. Gra stoi w miejscu, a swiat zyje dalej.
// Pomijanie: spacja / enter / esc / klikniecie / A na padzie.
import { V3, clamp, lerp } from './util.js';
import { G, P, camera } from './stan.js';
import { KP, MP, pp } from './wejscie.js';
import { START_H } from './miasto.js';
import { sfx } from './dzwiek.js';

let bars = null, sub = null, subT = null, subS = null, cine = null;
const ease = t => t * t * (3 - 2 * t);
const _a = new V3(), _b = new V3();

function ui() {
  if (bars) return;
  const st = document.createElement('style');
  st.textContent = `.cbar{position:fixed;left:0;right:0;height:0;background:#000;z-index:8;transition:height .7s ease}
  #cSub{position:fixed;left:0;right:0;bottom:15vh;text-align:center;z-index:9;opacity:0;transition:opacity .6s;pointer-events:none;color:#fff;text-shadow:0 2px 12px #000}
  #cSub b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(34px,6.5vh,64px);letter-spacing:4px;font-weight:400}
  #cSub span{font-family:'Rajdhani',Arial,sans-serif;font-size:clamp(17px,3vh,26px);font-weight:600;letter-spacing:1px}
  #cSkip{position:fixed;right:24px;bottom:calc(11vh - 14px);z-index:9;color:#cfe;font:600 15px Rajdhani,Arial;opacity:0;transition:opacity .6s}`;
  document.head.appendChild(st);
  bars = [document.createElement('div'), document.createElement('div')];
  bars[0].className = 'cbar'; bars[0].style.top = 0; bars[1].className = 'cbar'; bars[1].style.bottom = 0;
  sub = document.createElement('div'); sub.id = 'cSub'; sub.innerHTML = '<b></b><span></span>';
  subT = sub.querySelector('b'); subS = sub.querySelector('span');
  const skip = document.createElement('div'); skip.id = 'cSkip'; skip.textContent = 'SPACJA / A — pomiń'; skip.className = 'cskip';
  document.body.append(bars[0], bars[1], sub, skip);
}

// ---------------------------------------------------------------- sceny
// shot: { dur, at(t 0..1, ctx) -> ustawia camera, text?, sub? }
const SCENES = {
  intro: ctx => {
    const f = new V3(Math.sin(START_H), 0, Math.cos(START_H)), r = new V3(f.z, 0, -f.x), p = ctx.p;
    return [
      { dur: 4.2, text: 'NOWY JORK', sub: 'Miasto, które nigdy nie śpi.', at: t => {
        const a = lerp(0.5, -0.7, ease(t));
        camera.position.copy(p).addScaledVector(f, -Math.cos(a) * 4.4).addScaledVector(r, Math.sin(a) * 4.4); camera.position.y = p.y + 1.1 + t * 0.6;
        camera.lookAt(p.x, p.y + 0.9, p.z); camera.fov = 50;
      } },
      { dur: 4.2, text: '', sub: '', at: t => {
        camera.position.copy(p).addScaledVector(f, lerp(3, 16, ease(t))); camera.position.y = p.y + lerp(0.4, 9, ease(t));
        camera.lookAt(_a.copy(p).addScaledVector(f, 320).add(_b.set(0, -75, 0))); camera.fov = 62;
      } },
      { dur: 3.4, text: 'Ktoś musi go pilnować.', sub: '', at: t => {
        camera.position.copy(p).addScaledVector(f, lerp(-3.8, -2.6, t)).addScaledVector(r, 0.9); camera.position.y = p.y + 1.7;
        camera.lookAt(_a.copy(p).addScaledVector(f, 40).add(_b.set(0, -6, 0))); camera.fov = 58;
      } },
    ];
  },
  boss: ctx => {
    const b = ctx.b, p = ctx.p, d = _a.subVectors(p, b).setY(0).normalize().clone(), r = new V3(d.z, 0, -d.x);
    return [
      { dur: 3.8, text: 'NOSOROŻEC', sub: 'Człowiek w pancerzu, którego nic nie zatrzyma.', at: t => {
        camera.position.copy(b).addScaledVector(d, lerp(11, 6.5, ease(t))).addScaledVector(r, lerp(-3, 1, t)); camera.position.y = b.y + lerp(0.5, 1.2, t);
        camera.lookAt(b.x, b.y + 2.6, b.z); camera.fov = lerp(52, 44, t);
      } },
      { dur: 2, text: '', sub: '', at: t => {
        camera.position.copy(p).addScaledVector(d, -3.2).addScaledVector(r, 1.2); camera.position.y = p.y + 1.6;
        camera.lookAt(p.x, p.y + 1.5, p.z); camera.position.y += t * 0.15; camera.fov = 55;
      } },
    ];
  },
  fisk: ctx => {
    const b = ctx.b, p = ctx.p;
    return [
      { dur: 4, text: 'WILSON FISK', sub: 'Kingpin. Prawie całe miasto jest jego.', at: t => {
        camera.position.set(p.x + lerp(3.4, 1.2, ease(t)), p.y + 1.55, p.z + lerp(3.2, 1.8, ease(t)));
        camera.lookAt(b.x, b.y + 1.5, b.z); camera.fov = 48;
      } },
      { dur: 3.4, text: 'Nie powinieneś tu wchodzić, pająku.', sub: '', at: t => {
        camera.position.set(b.x + 0.9, b.y + 1.6, b.z + lerp(5.2, 3.6, ease(t))); camera.lookAt(b.x, b.y + 1.55, b.z); camera.fov = 42;
      } },
    ];
  },
  fisk2: ctx => {
    const b = ctx.b;
    return [{ dur: 3.4, text: 'Skoro nalegasz…', sub: 'Bądź gotów.', at: t => {
      camera.position.set(b.x - 2.6, b.y + lerp(0.6, 1.3, t), b.z + lerp(6, 4.4, ease(t))); camera.lookAt(b.x, b.y + 1.9, b.z); camera.fov = 46;
    } }];
  },
  fiskEnd: ctx => {
    const b = ctx.b;
    return [{ dur: 4.2, text: 'KINGPIN POKONANY', sub: 'Nowy Jork odetchnął z ulgą.', at: t => {
      const a = lerp(0.2, 2.4, ease(t)); camera.position.set(b.x + Math.cos(a) * 7, b.y + lerp(1.3, 3.2, t), b.z + Math.sin(a) * 7); camera.lookAt(b.x, b.y + 0.8, b.z); camera.fov = 48;
    } }];
  },
  bossEnd: ctx => {
    const b = ctx.b;
    return [
      { dur: 4.2, text: 'NOSOROŻEC POKONANY', sub: 'Central Park znów jest bezpieczny.', at: t => {
        const a = lerp(0.3, 2.2, ease(t));
        camera.position.set(b.x + Math.cos(a) * 9, b.y + lerp(1.4, 4.2, t), b.z + Math.sin(a) * 9);
        camera.lookAt(b.x, b.y + 0.8, b.z); camera.fov = 48;
      } },
    ];
  },
};

// ---------------------------------------------------------------- odtwarzanie
export function playCine(name, ctx = {}) {
  ui();
  ctx.p = P.pos.clone(); if (ctx.b) ctx.b = ctx.b.clone();
  cine = { name, shots: SCENES[name](ctx), i: 0, t: 0, onEnd: ctx.onEnd, sk: 0 };
  G.cine = name;
  const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden';
  bars[0].style.height = bars[1].style.height = '11vh';
  document.getElementById('cSkip').style.opacity = 0.9;
  setShotText();
}
function setShotText() {
  const s = cine.shots[cine.i];
  if (s.text) { subT.textContent = s.text; subS.textContent = s.sub || ''; sub.style.opacity = 1; } else sub.style.opacity = 0;
}
export function endCine() {
  if (!cine) return;
  const cb = cine.onEnd; cine = null; G.cine = null;
  bars[0].style.height = bars[1].style.height = '0'; sub.style.opacity = 0; document.getElementById('cSkip').style.opacity = 0;
  const h = document.getElementById('hud'); if (h) h.style.visibility = '';
  if (cb) cb();
}
// zwraca true, gdy przerywnik trwa (wtedy gra sie nie aktualizuje)
export function updateCine(dt) {
  if (!cine) return false;
  cine.sk += dt;
  if (cine.sk > 0.6 && (KP.Space || KP.Enter || KP.Escape || MP[0] || pp(0) || pp(9))) { endCine(); return false; }
  const s = cine.shots[cine.i]; cine.t += dt;
  const t = clamp(cine.t / s.dur, 0, 1);
  s.at(t);
  camera.updateProjectionMatrix();
  if (cine.t >= s.dur) {
    if (++cine.i >= cine.shots.length) { endCine(); return false; }
    cine.t = 0; setShotText();
  }
  return true;
}
