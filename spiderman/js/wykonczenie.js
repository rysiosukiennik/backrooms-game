// Wykonczenie (takedown) jako filmowa scenka w zwolnionym tempie: Spider-Man wybija sie, okreca sie po orbicie
// wokol glowy wroga (cialo poziomo, reka na glowie, nitka), jednym ciosem go powala i laduje.
// Scenka biegnie w CZASIE RZECZYWISTYM (G.rdt); G.timeScale spowalnia swiat (czasteczki, inni wrogowie, ruch).
import { V3, UP, clamp, lerp, damp, angLerp } from './util.js';
import { G, P, cam, camera, enemies } from './stan.js';
import { supportAt, solidAt, raycastCity } from './miasto.js';
import { finishEnemy, burst } from './wrogowie.js';
import { aimArm, basisQ } from './postac.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { fxBoost } from './kamera_fx.js';
import { has } from './umiejetnosci.js';
import { mkLine, setLine } from './gracz.js';

const DUR = 1.95, T0 = 0.38, THIT = 1.15, TS_MIN = 0.25;
const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const _a = new V3(), _b = new V3(), _c = new V3(), _up = new V3(), _fw = new V3();
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
let FIN = null, thread = null;

export const finActive = () => !!FIN;

function freeAt(x, z, y0, sc) {
  const g = supportAt(x, z, y0 + 0.5, 0.1);
  return Math.abs(g - y0) < 0.5 && !solidAt(x, y0 + 0.9, z) && !solidAt(x, y0 + 1.9 * sc, z);
}
// czy caly luk orbity (kat a0 -> a0 + sg*sweep) jest wolny od scian i ma podloze pod soba
function arcFree(c, a0, sg, sweep, R, sc) {
  for (let i = 0; i <= 12; i++) { const a = a0 + sg * sweep * i / 12; if (!freeAt(c.x + Math.sin(a) * R, c.z + Math.cos(a) * R, c.y, sc)) return false; }
  return true;
}

// start scenki; zwraca false, gdy nie da sie (boss / wrog w powietrzu -> proste wykonczenie bez orbity)
export function startFinisherNow(e) {
  if (!e || e.dead || e.gone || P.fin) return false;
  P.atk = null; P.lunge = null; P.vel.set(0, 0, 0);
  if (e.type === 'boss' || e.air) { // bossowie maja wlasne finFn; wrog w locie nie ma podloza do orbity
    finishEnemy(e); G.slowT = 0.9; sfx('fin'); G.shake = 0.5; rumble(0.3, 0.5, 0.8); return true;
  }
  const sc = e.scale || 1, R = 0.9 * sc;
  const c = e.pos.clone();
  let a0 = Math.atan2(P.pos.x - c.x, P.pos.z - c.z);
  const dist = Math.hypot(P.pos.x - c.x, P.pos.z - c.z);
  if (dist < 0.4) a0 = P.heading + Math.PI;
  const sweep = Math.PI * 1.25;
  let sg = (Math.random() < 0.5 ? 1 : -1), simple = false;
  if (!arcFree(c, a0, sg, sweep + 0.6, R, sc)) { sg = -sg; if (!arcFree(c, a0, sg, sweep + 0.6, R, sc)) simple = true; }
  // miejsce ladowania (twarde podloze, wolne od scian)
  const from = P.pos.clone(), land = new V3();
  let ok = false;
  const aL = a0 + sg * (sweep + 0.6);
  for (const da of [0, 0.6, -0.6, 1.2, -1.2, 2.4]) {
    const a = aL + da, x = c.x + Math.sin(a) * 1.9 * sc, z = c.z + Math.cos(a) * 1.9 * sc;
    if (freeAt(x, z, c.y, sc)) { land.set(x, supportAt(x, z, c.y + 0.5, 0.1), z); ok = true; break; }
  }
  if (!ok) land.copy(from);
  if (simple) { // brak miejsca na orbite: scenka uproszczona (wypad i cios z miejsca obok wroga)
    const x = c.x + Math.sin(a0) * 1.25 * sc, z = c.z + Math.cos(a0) * 1.25 * sc;
    if (freeAt(x, z, c.y, sc)) land.set(x, supportAt(x, z, c.y + 0.5, 0.1), z); else land.copy(from);
  }
  FIN = {
    e, t: 0, dur: DUR, from, to: land, land, c, sc, R, a0, sg, sweep, simple, hy: c.y + 1.62 * sc + 0.05,
    done: false, w: 0, strike: 0, h0: P.heading, a: a0, cam: null, qCur: new THREE.Quaternion().setFromAxisAngle(UP, P.heading),
    cp: new V3(), head: new V3(c.x, c.y + 1.62 * sc, c.z), away: new V3(), hitP: new V3(), q: new THREE.Quaternion(),
  };
  P.fin = FIN; P.state = 'ground'; P.invT = Math.max(P.invT, DUR + 0.3);
  FIN.q.copy(FIN.qCur);
  e.finScene = enemyScene; e.finPose = enemyPose; e.finOwn = true; e.state = 'fight';
  G.timeScale = 1; sfx('fin'); rumble(0.4, 0.4, 0.6);
  return true;
}

export function finAbort() {
  if (FIN && FIN.e) { FIN.e.finScene = null; FIN.e.finPose = null; FIN.e.finOwn = false; }
  FIN = null; P.fin = null; G.timeScale = 1; fxBoost.zoom = 0; fxBoost.ca = 0;
  if (thread) thread.visible = false;
}

// wspolczynnik czasu: 1 -> 0.25 w 0.25 s, trzymany, powrot w ostatnich 0.3 s
function timeScaleAt(t) {
  if (t < 0.25) return lerp(1, TS_MIN, ease(t / 0.25));
  if (t > DUR - 0.3) return lerp(TS_MIN, 1, ease((t - (DUR - 0.3)) / 0.3));
  return TS_MIN;
}

function orbitA(F, t) { const u = clamp((t - T0) / (THIT - T0), 0, 1); return F.a0 + F.sg * F.sweep * (u * 0.65 + 0.35 * ease(u)); }

export function stepFinisher(dt) {
  const F = FIN; if (!F) { P.fin = null; return; }
  const rdt = G.rdt || dt;
  F.t += rdt; const t = F.t, e = F.e;
  if (e.gone) { finAbort(); return; }
  G.timeScale = timeScaleAt(t);
  P.vel.set(0, 0, 0);
  const c = F.c, sc = F.sc;
  // --- tor srodka ciala (center) i orientacja
  const hFace = Math.atan2(c.x - P.pos.x, c.z - P.pos.z);
  let w, a;
  if (F.simple) {
    const k = ease(t / 0.4); w = 0;
    _a.copy(F.from).lerp(F.land, k); _a.y += 0.95 + Math.sin(k * Math.PI) * 0.5;
    F.cp.copy(_a); a = F.a0;
    _up.copy(UP); const h = angLerp(F.h0, Math.atan2(c.x - F.land.x, c.z - F.land.z), ease(t / 0.3)); _fw.set(Math.sin(h), 0, Math.cos(h));
    basisQ(_qa, _up, _fw); F.q.copy(_qa); F.heading = h;
  } else {
    if (t < T0) {
      const k = ease(t / T0); a = F.a0;
      _b.set(c.x + Math.sin(a) * F.R, F.hy, c.z + Math.cos(a) * F.R);
      _a.set(F.from.x, F.from.y + 0.95, F.from.z).lerp(_b, k); _a.y += Math.sin(k * Math.PI) * 0.45;
      w = k;
    } else if (t <= THIT) {
      a = orbitA(F, t); w = 1;
      _a.set(c.x + Math.sin(a) * F.R, F.hy + Math.sin((t - T0) / (THIT - T0) * Math.PI) * 0.12, c.z + Math.cos(a) * F.R);
    } else {
      const k = ease((t - THIT) / (DUR - THIT - 0.12));
      a = orbitA(F, THIT) + F.sg * 0.5 * k; w = 1 - ease((t - THIT - 0.1) / 0.5);
      _b.set(c.x + Math.sin(F.a0 + F.sg * F.sweep) * F.R, F.hy, c.z + Math.cos(F.a0 + F.sg * F.sweep) * F.R);
      _a.copy(_b).lerp(_c.set(F.land.x, F.land.y + 0.95, F.land.z), k); _a.y += Math.sin(k * Math.PI) * 0.35;
    }
    F.cp.copy(_a);
    // poza pionowa (twarza do wroga) <-> pozioma (glowa po stycznej, klatka do srodka orbity)
    const hh = angLerp(F.h0, hFace, ease(t / 0.3));
    _up.copy(UP); _fw.set(Math.sin(hh), 0, Math.cos(hh)); basisQ(_qa, _up, _fw);
    _up.set(Math.cos(a) * F.sg, 0, -Math.sin(a) * F.sg); _fw.set(-Math.sin(a), 0, -Math.cos(a)); basisQ(_qb, _up, _fw);
    F.q.copy(_qa).slerp(_qb, w);
    F.heading = hh;
  }
  F.w = w; F.a = a;
  _up.copy(UP).applyQuaternion(F.q);
  P.pos.copy(F.cp).addScaledVector(_up, -0.95);
  P.heading = F.heading; F.strike = Math.sin(clamp((t - (THIT - 0.2)) / 0.3, 0, 1) * Math.PI);
  F.hand = t < THIT - 0.05;
  // --- uderzenie
  if (t >= THIT && !F.done) {
    F.done = true;
    F.hitP.set(c.x, F.hy - 0.05, c.z);
    F.away.set(c.x - P.pos.x, 0, c.z - P.pos.z); if (F.away.lengthSq() < 0.01) F.away.set(Math.sin(F.heading), 0, Math.cos(F.heading)); F.away.normalize();
    finishEnemy(e);
    if (has('fin')) { let b = null, bd = 9; for (const o of enemies) { if (o === e || o.dead || o.gone || o.type === 'boss') continue; const d = o.pos.distanceTo(e.pos); if (d < bd) { bd = d; b = o; } } if (b) finishEnemy(b); }
    burst(F.hitP.x, F.hitP.y, F.hitP.z, 26, 0xffffff, 7); burst(F.hitP.x, F.hitP.y, F.hitP.z, 18, 0xffd070, 9);
    sfx('punch', 1); sfx('slam', 0.7); G.shake = 0.55; rumble(0.3, 1, 1);
  }
  if (t >= DUR) {
    P.fin = null; e.finScene = null; e.finPose = null; e.finOwn = false;
    P.pos.copy(F.land); P.invT = Math.max(P.invT, 0.5);
    P.state = supportAt(P.pos.x, P.pos.z, P.pos.y + 0.5) >= P.pos.y - 0.3 ? 'ground' : 'air';
    P.pc.bp = 0; P.pc.br = 0; P.pc.bw = 0; G.timeScale = 1; fxBoost.zoom = 0; fxBoost.ca = 0;
    if (thread) thread.visible = false;
    FIN = null;
  }
}

// ---- wrog: rozglada sie za graczem, dostaje cios, odlatuje i pada na plecy (animacja w czasie rzeczywistym)
function enemyScene(e, dt) {
  const F = FIN; if (!F || F.e !== e) { e.finScene = null; e.finPose = null; e.finOwn = false; return; }
  const rdt = G.rdt || dt, t = F.t;
  if (!F.done) {
    e.yaw = angLerp(e.yaw, Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z), damp(7, rdt));
    e.state = 'fight'; e.down += (0 - e.down) * damp(10, rdt);
  } else {
    const kt = t - THIT;
    e.yaw = angLerp(e.yaw, Math.atan2(-F.away.x, -F.away.z), damp(20, rdt));
    e.down = ease(kt / 0.55);
    const sp = 5.5 * Math.pow(clamp(1 - kt / 0.7, 0, 1), 2);
    if (sp > 0.05) {
      const nx = e.pos.x + F.away.x * sp * rdt, nz = e.pos.z + F.away.z * sp * rdt;
      if (Math.abs(supportAt(nx, nz, e.pos.y + 0.5, 0.1) - e.pos.y) < 0.35 && !solidAt(nx, e.pos.y + 1, nz)) { e.pos.x = nx; e.pos.z = nz; }
    }
  }
}
function enemyPose(e, t) {
  const F = FIN; if (!F) return;
  if (!F.done) { // przed ciosem: rece w gore, glowa sledzi Spider-Mana
    const k = ease(F.t / 0.5);
    t.sLz = 0.9 * k; t.sRz = -0.9 * k; t.eL = -0.9 * k; t.eR = -0.9 * k; t.hx = -0.25 * k; t.bp = -0.1 * k;
  } else { // po ciosie: glowa odchylona, rece rozrzucone
    const kt = ease((F.t - THIT) / 0.25);
    t.hx = -0.7 * kt; t.sLz = 1.5; t.sRz = -1.5; t.sLx = -0.4; t.sRx = -0.4; t.eL = -0.5; t.eR = -0.5; t.bp = -0.3 * kt;
  }
}

// ---- poza Spider-Mana (cele pozy; obrot calego ciala ustawia stepFinisher przez F.q)
export function finPose(t) {
  const F = FIN; if (!F) return;
  const w = F.w, ks = F.strike;
  if (F.simple) {
    t.sRx = lerp(-0.6, -1.7, ks); t.eR = lerp(-1.8, -0.05, ks); t.sLx = -0.7; t.eL = -1.9; t.spy = -0.3 * ks; t.hLx = -0.5; t.kL = 0.6; t.hRx = 0.4; t.kR = 0.4;
    return;
  }
  t.hLx = -0.2 - 1.2 * w; t.kL = 0.3 + 1.7 * w; t.hRx = -0.1 - 1.0 * w; t.kR = 0.3 + 1.6 * w; t.hLz = 0.1; t.hRz = -0.1; // nogi podkurczone
  t.hx = -0.45 * w; t.bp = 0.2 * w; // glowa przy wrogu
  t.sRx = -1.3; t.eR = -0.2; t.sRz = -0.2; // prawa reka siega do glowy (aimArm doprecyzuje)
  t.sLx = lerp(0.5, -1.4, ks); t.eL = lerp(-0.8, -0.1, ks); t.sLz = lerp(0.5, 0.15, ks); // lewa: odchylona, potem cios
}
// po zastosowaniu pozy: obrot calego ciala i reka na glowie / cios (wolane z updatePlayerVisual)
export function finRoot(q) { if (FIN) q.copy(FIN.q); }
export function finAim(H) {
  const F = FIN; if (!F || F.simple) return;
  H.root.updateMatrixWorld(true);
  _b.copy(F.head);
  if (F.hand) aimArm(H, 'R', _b, 1);
  else aimArm(H, 'L', _b, ease((F.t - (THIT - 0.2)) / 0.2));
  H.root.updateMatrixWorld(true);
  // nitka z lewej reki do glowy wroga podczas orbity
  if (!thread) thread = mkLine();
  if (F.t > T0 && F.t < THIT + 0.25) { H.handL.getWorldPosition(_a); setLine(thread, _a, _b); } else thread.visible = false;
}

// ---- kamera filmowa: najazd, pol obiegu po orbicie, niski kat przy powaleniu, powrot do kamery gry
export function finCamera() {
  const F = FIN;
  if (!F) { if (fxBoost.zoom || fxBoost.ca) { fxBoost.zoom = 0; fxBoost.ca = 0; } return; }
  const t = F.t, sc = F.sc, c = F.c;
  const cx = c.x, cy = c.y + 1.35 * sc, cz = c.z;
  if (!F.cam) { _a.set(camera.position.x - cx, 0, camera.position.z - cz); F.cam = { ang: Math.atan2(_a.x, _a.z), d: clamp(_a.length(), 2.5, 9), h: camera.position.y - cy, fov: camera.fov }; }
  const C = F.cam, push = ease(t / 0.5), kb = ease((t - (DUR - 0.4)) / 0.4);
  const ang = C.ang + F.sg * Math.PI * 0.75 * ease((t - 0.1) / (THIT + 0.4));
  const low = ease((t - (THIT - 0.2)) / 0.35) * (1 - ease((t - (THIT + 0.35)) / 0.4));
  let d = lerp(C.d, 3.0 * sc, push); d = lerp(d, 4.2 * sc, low);
  const h = lerp(lerp(C.h, 0.55, push), -0.6, low);
  _b.set(Math.sin(ang), h / Math.max(1, d), Math.cos(ang));
  const hd = Math.hypot(d, h);
  _b.set(Math.sin(ang) * d, h, Math.cos(ang) * d);
  _c.set(_b.x, _b.y, _b.z).normalize();
  const rt = raycastCity(_a.set(cx, cy, cz), _c, hd + 0.3); if (rt < hd + 0.3) { const f = Math.max(0.8, rt - 0.4) / hd; _b.multiplyScalar(f); }
  _a.set(cx + _b.x, Math.max(1.0, cy + _b.y), cz + _b.z);
  _c.set(cx, cy + 0.15 + low * 0.35, cz);
  if (kb > 0) { _a.lerp(camera.position, kb); _c.lerp(cam.tgt, kb); }
  camera.position.copy(_a); camera.lookAt(_c);
  const fov = 68 - 14 * push * (1 - kb) - 4 * low;
  camera.fov = kb > 0 ? lerp(fov, camera.fov, kb) : fov; camera.updateProjectionMatrix();
  const bump = Math.exp(-Math.abs(t - THIT) * 4.5);
  fxBoost.zoom = 0.06 * bump * (1 - kb) + 0.015 * push * (1 - kb); fxBoost.ca = 0.004 * bump;
}
