// Sterowanie: pad (standardowe mapowanie Xbox/PlayStation), klawiatura i mysz.
import { clamp } from './util.js';
import { G, P, canvas } from './stan.js';
import { initAudio } from './dzwiek.js';

export const K = {}, KP = {}, MB = {}, MP = {};
export const mouse = { dx: 0, dy: 0, wheel: 0 };
export const pad = { b: new Array(18).fill(false), prev: new Array(18).fill(false), a: [0, 0, 0, 0], name: '', type: 'xbox', connected: false, gp: null };

addEventListener('keydown', e => {
  if (!K[e.code]) KP[e.code] = true;
  K[e.code] = true;
  G.lastDev = 'kb';
  if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  initAudio();
});
addEventListener('keyup', e => { K[e.code] = false; });
addEventListener('blur', () => { for (const k in K) K[k] = false; });
addEventListener('mousedown', e => { MB[e.button] = true; MP[e.button] = true; G.lastDev = 'kb'; initAudio(); });
addEventListener('mouseup', e => { MB[e.button] = false; });
addEventListener('mousemove', e => {
  if (document.pointerLockElement === canvas) { mouse.dx += e.movementX; mouse.dy += e.movementY; G.lastDev = 'kb'; }
});
addEventListener('wheel', e => { mouse.wheel += e.deltaY; }, { passive: true });
addEventListener('contextmenu', e => e.preventDefault());

export function lockMouse() {
  try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {}
}

export function pollPads() {
  pad.prev = pad.b.slice();
  pad.b.fill(false); pad.a = [0, 0, 0, 0]; pad.connected = false; pad.gp = null;
  const gps = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const gp of gps) {
    if (!gp || !gp.connected) continue;
    pad.connected = true; if (!pad.gp) { pad.gp = gp; pad.name = gp.id; }
    gp.buttons.forEach((b, i) => { if (i < 18 && (b.pressed || b.value > 0.35)) pad.b[i] = true; });
    for (let a = 0; a < 4; a++) { const v = gp.axes[a] || 0; if (Math.abs(v) > Math.abs(pad.a[a])) pad.a[a] = v; }
  }
  pad.type = /054c|playstation|dualsense|dualshock|wireless controller/i.test(pad.name) ? 'ps' : 'xbox';
  if (pad.b.some((b, i) => b && !pad.prev[i]) || pad.a.some(v => Math.abs(v) > 0.5)) {
    G.lastDev = 'pad';
    if (pad.b.some((b, i) => b && !pad.prev[i])) initAudio();
  }
}

export const pp = i => pad.b[i] && !pad.prev[i];

export function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < 0.18) return [0, 0];
  const k = Math.min(1, (m - 0.18) / 0.82) / m;
  return [x * k, y * k];
}

export function endFrame() {
  for (const k in KP) delete KP[k];
  for (const k in MP) delete MP[k];
  mouse.dx = mouse.dy = mouse.wheel = 0;
}

// Wejscie w trakcie gry
// Kombinacje przyciskow wykrywane w oknie WIN ms: L1+R1 = rzucanie (R1 sam = siec), kwadrat+trojkat = wykonczenie,
// L3+R3 = moc stroju. Pojedynczy przycisk jest wypuszczany dopiero po uplywie okna (siec: tylko gdy L1 nie wcisniety).
const WIN = 110;
const CB = { web: 0, punch: 0, spec: 0, bothSt: false, punchDown: 0 };
const now = () => performance.now();
export function gameInput() {
  const [lx, ly] = stick(pad.a[0], pad.a[1]);
  const [rx, ry] = stick(pad.a[2], pad.a[3]);
  let mx = lx, my = ly;
  if (K.KeyW || K.ArrowUp) my -= 1;
  if (K.KeyS || K.ArrowDown) my += 1;
  if (K.KeyA || K.ArrowLeft) mx -= 1;
  if (K.KeyD || K.ArrowRight) mx += 1;
  const locked = document.pointerLockElement === canvas;
  const t = now();
  // --- rzucanie / siec (R1, L1)
  let throwP = !!KP.KeyT, webP = (locked && !!MP[2]) || !!KP.KeyR;
  if (pp(5)) { if (pad.b[4]) throwP = true; else CB.web = t; }
  if (pp(4) && CB.web && t - CB.web <= WIN) { throwP = true; CB.web = 0; }
  if (CB.web && t - CB.web > WIN) { CB.web = 0; webP = true; }
  // --- kwadrat / trojkat
  let punchP = (locked && !!MP[0]) || !!KP.KeyF, specialP = !!KP.KeyE || !!KP.KeyQ, finisherP = !!KP.KeyE;
  const waitFin = P.focus >= 1; // okno oczekiwania tylko gdy wykonczenie w ogole mozliwe
  if (pp(2)) CB.punch = t;
  if (pp(3)) CB.spec = t;
  if (CB.punch && CB.spec) { finisherP = true; CB.punch = CB.spec = 0; }
  else if (!waitFin) { if (CB.punch) { punchP = true; CB.punch = 0; } if (CB.spec) { specialP = true; CB.spec = 0; } }
  else {
    if (CB.punch && t - CB.punch > WIN) { punchP = true; CB.punch = 0; }
    if (CB.spec && t - CB.spec > WIN) { specialP = true; CB.spec = 0; }
  }
  // --- moc stroju (L3+R3), zbocze
  const both = pad.b[10] && pad.b[11], powerP = (both && !CB.bothSt) || !!KP.KeyV; CB.bothSt = both;
  // --- przytrzymanie kwadratu: launcher
  const punchHeld = pad.b[2] || (locked && !!MB[0]) || !!K.KeyF;
  if (punchHeld) { if (!CB.punchDown) CB.punchDown = t; } else CB.punchDown = 0;
  const launcher = !!CB.punchDown && t - CB.punchDown > 320;
  return {
    mx: clamp(mx, -1, 1), my: clamp(my, -1, 1),
    plx: rx, ply: ry,
    mdx: locked ? mouse.dx : 0, mdy: locked ? mouse.dy : 0,
    swing: pad.b[6] || !!K.ShiftLeft || !!K.ShiftRight,
    jump: pad.b[0] || !!K.Space,
    jumpP: pp(0) || !!KP.Space,
    punchP, punch: punchHeld, launcher,
    specialP, heavyP: !!KP.KeyG || (locked && !!MP[1]),
    finisherP, throwP, powerP,
    healHeld: pad.b[13] || !!K.KeyH,
    webP,
    dodgeP: pp(1) || !!KP.KeyC || !!KP.ControlLeft,
    mapP: pp(8) || !!KP.KeyM || !!KP.Tab,
    pauseP: pp(9) || !!KP.Escape || !!KP.KeyP,
  };
}

// Wejscie w menu (z powtarzaniem przy przytrzymaniu)
const NV = {};
export function navInput(dt) {
  const [lx, ly] = stick(pad.a[0], pad.a[1]);
  const held = {
    up: pad.b[12] || ly < -0.55 || K.ArrowUp || K.KeyW,
    down: pad.b[13] || ly > 0.55 || K.ArrowDown || K.KeyS,
    left: pad.b[14] || lx < -0.55 || K.ArrowLeft || K.KeyA,
    right: pad.b[15] || lx > 0.55 || K.ArrowRight || K.KeyD,
  };
  const o = {};
  for (const d in held) {
    const s = NV[d] || (NV[d] = { t: 0, n: 0 });
    if (held[d]) {
      if (s.t === 0) { o[d] = true; s.n = 0.38; }
      s.t += dt;
      if (s.t >= s.n) { o[d] = true; s.n += 0.11; }
    } else s.t = 0;
  }
  o.ok = pp(0) || pp(9) || !!KP.Enter || !!KP.Space || !!KP.NumpadEnter;
  o.back = pp(1) || !!KP.Escape || !!KP.Backspace;
  o.tl = pp(4) || !!KP.KeyQ;
  o.tr = pp(5) || !!KP.KeyE;
  o.y = pp(3) || !!KP.KeyX;
  return o;
}

export function rumble(dur, strong, weak) {
  const gp = pad.gp;
  if (!gp || !gp.vibrationActuator) return;
  try { gp.vibrationActuator.playEffect('dual-rumble', { duration: dur * 1000, strongMagnitude: strong, weakMagnitude: weak }); } catch (e) {}
}
