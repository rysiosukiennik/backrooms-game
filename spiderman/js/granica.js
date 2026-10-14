// Granica obszaru grywalnego: LAND (brzegi miasta) i polowa rzeki na mostach.
// Po przekroczeniu gra sie wstrzymuje (G.state = 'border'), pojawia sie panel z komunikatem,
// a po nacisnieciu X (krzyzyk na padzie) / Enter / Spacja gracz wraca na bezpieczne miejsce.
import { V3, clamp } from './util.js';
import { G, P, cam } from './stan.js';
import { LAND, START, BRIDGES, bridgeAt, bridgeDeckAt, supportAt } from './miasto.js';
import { pad, pp, KP } from './wejscie.js';

const HIST = [];            // ostatnie pozycje na ziemi (do powrotu z granicy ladu)
let histT = 0;
let box = null, phase = 'none', t = 0, to = null, viol = null;

function ui() {
  if (box) return box;
  box = document.createElement('div'); box.id = 'granica';
  box.style.cssText = 'position:fixed;inset:0;z-index:40;display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:#fff;background:radial-gradient(ellipse at center,rgba(8,12,18,.78),rgba(0,0,0,.92));opacity:0;transition:opacity .35s;pointer-events:auto;cursor:pointer;font-family:Rajdhani,Arial,sans-serif;padding:0 5vw';
  box.innerHTML = '<div style="font-family:\'Bebas Neue\',Impact,sans-serif;font-size:min(8vw,84px);letter-spacing:4px;line-height:1.05;text-shadow:0 0 24px rgba(227,36,43,.85),0 3px 8px #000">PRZEKRACZASZ OBSZAR GRYWALNY</div>'
    + '<div id="granicaS" style="margin-top:22px;font-size:min(3.2vw,28px);font-weight:700;letter-spacing:1px;text-shadow:0 2px 6px #000">Naciśnij <span style="display:inline-flex;align-items:center;justify-content:center;min-width:34px;height:30px;padding:0 9px;margin:0 6px;border:2px solid #fff;border-radius:7px;background:rgba(0,0,0,.55)">X</span> (krzyżyk) na padzie, aby wrócić do gry</div>'
    + '<div style="margin-top:10px;font-size:min(2.2vw,18px);opacity:.7;font-weight:600">klawiatura: Enter lub Spacja</div>';
  box.addEventListener('click', () => { if (phase === 'show' && t > 0.45) confirm(); });
  document.body.appendChild(box);
  return box;
}

// Czy pozycja jest poza obszarem grywalnym? Zwraca true i zatrzymuje gre. Wolane z collide() gracza.
export function checkBounds(p) {
  if (G.state !== 'play') return false;
  const outside = p.x < LAND.x0 + 1 || p.x > LAND.x1 - 1 || p.z < LAND.z0 + 1 || p.z > LAND.z1 - 1;
  if (!outside) {
    if (P.state === 'ground') { // zapamietaj miejsca na ziemi (co ~0,3 s) — cel powrotu
      histT -= 1 / 60; if (histT <= 0 && p.x > LAND.x0 + 6 && p.x < LAND.x1 - 6 && p.z > LAND.z0 + 6 && p.z < LAND.z1 - 6) { histT = 0.3; HIST.push(new V3().copy(p)); if (HIST.length > 120) HIST.shift(); }
    }
    return false;
  }
  const br = bridgeAt(p.x, p.z);
  let bad = !br;
  if (br) {
    const deck = bridgeDeckAt(br, p.x);
    if (p.y < deck - 2.5) bad = true;                                   // pod pomostem / za nisko: woda
    else {
      if (p.y < deck + 3) p.z = clamp(p.z, br.z - br.W / 2 + 0.6, br.z + br.W / 2 - 0.6); // barierki
      if ((br.side > 0 && p.x >= br.mid) || (br.side < 0 && p.x <= br.mid)) { p.x = br.mid; bad = true; } // polowa rzeki
    }
  }
  if (!bad) return false;
  p.x = clamp(p.x, LAND.x0 + 1, LAND.x1 - 1); p.z = clamp(p.z, LAND.z0 + 1, LAND.z1 - 1);
  begin(br);
  return true;
}

function begin(br) {
  viol = new V3().copy(P.pos);
  to = new V3();
  if (br) { // 25 m wstecz po moscie
    to.set(br.mid - br.side * 25, 0, br.z); to.y = bridgeDeckAt(br, to.x);
    to.dir = new V3(-br.side, 0, 0);
  } else {
    let pick = null;
    for (let i = HIST.length - 1; i >= 0; i--) if (HIST[i].distanceTo(viol) >= 25) { pick = HIST[i]; break; }
    if (!pick) pick = HIST.length ? HIST[0] : START;
    to.copy(pick); to.dir = new V3(pick.x - viol.x, 0, pick.z - viol.z);
  }
  P.vel.set(0, 0, 0);
  G.state = 'border'; phase = 'show'; t = 0;
  const b = ui(); b.style.display = 'flex'; void b.offsetWidth; b.style.opacity = 1;
  b.style.background = 'radial-gradient(ellipse at center,rgba(8,12,18,.78),rgba(0,0,0,.92))';
}

function confirm() {
  phase = 'out'; t = 0; // zaciemnienie, potem teleport
  box.style.transition = 'opacity .15s'; box.style.background = '#000'; box.style.opacity = 1;
}

function teleport() {
  const p = P.pos;
  p.copy(to); P.prev.copy(p); P.vel.set(0, 0, 0);
  const sy = supportAt(p.x, p.z, p.y + 1.5); if (sy > p.y - 1) p.y = Math.max(p.y, sy);
  P.state = 'ground'; P.airT = 0; P.rope = 0; P.lunge = null; P.atk = null; P.invT = Math.max(P.invT, 1.5);
  const d = to.dir; if (d && (d.x || d.z)) { P.heading = Math.atan2(d.x, d.z); cam.yaw = Math.atan2(-d.x, -d.z); }
  cam.tgt.copy(p); P.H.root.position.copy(p);
}

// z petli glownej, gdy G.state === 'border'
export function updateBorder(dt) {
  t += dt;
  if (phase === 'show') {
    if (t > 0.45 && (pp(0) || KP.Enter || KP.NumpadEnter || KP.Space)) confirm();
  } else if (phase === 'out') {
    if (t > 0.2) { teleport(); phase = 'in'; t = 0; box.style.transition = 'opacity .55s'; box.style.opacity = 0; G.state = 'play'; }
  } else if (phase === 'in') {
    if (t > 0.6) { box.style.display = 'none'; phase = 'none'; box.style.transition = 'opacity .35s'; }
  }
}
export const borderActive = () => phase === 'show' || phase === 'out';
