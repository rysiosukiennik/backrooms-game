// Sterowanie: pad (standardowe mapowanie Xbox/PlayStation), klawiatura i mysz.
import { clamp } from './util.js';
import { G, canvas } from './stan.js';
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
export function gameInput() {
  const [lx, ly] = stick(pad.a[0], pad.a[1]);
  const [rx, ry] = stick(pad.a[2], pad.a[3]);
  let mx = lx, my = ly;
  if (K.KeyW || K.ArrowUp) my -= 1;
  if (K.KeyS || K.ArrowDown) my += 1;
  if (K.KeyA || K.ArrowLeft) mx -= 1;
  if (K.KeyD || K.ArrowRight) mx += 1;
  const locked = document.pointerLockElement === canvas;
  return {
    mx: clamp(mx, -1, 1), my: clamp(my, -1, 1),
    plx: rx, ply: ry,
    mdx: locked ? mouse.dx : 0, mdy: locked ? mouse.dy : 0,
    swing: pad.b[7] || !!K.ShiftLeft || !!K.ShiftRight,
    jump: pad.b[0] || !!K.Space,
    jumpP: pp(0) || !!KP.Space,
    punchP: pp(2) || (locked && !!MP[0]) || !!KP.KeyF,
    punch: pad.b[2] || (locked && !!MB[0]) || !!K.KeyF,
    specialP: pp(3) || !!KP.KeyE || !!KP.KeyQ,
    webP: pp(5) || (locked && !!MP[2]) || !!KP.KeyR,
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
