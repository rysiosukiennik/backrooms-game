// Rzucanie przedmiotami (L1+R1 / klawisz T): Spider-Man przyciaga siecia najblizszy lekki przedmiot,
// unosi go nad glowa, a kolejne nacisniecie (R1 / T / cios) ciska go tam, gdzie celuje kamera
// (albo w wroga najblizszego celownika). Trafienie = obrazenia + odrzut (hitEnemy), potem rozbicie.
//
// Kontrakt dla innych modulow (np. baza Fiska):
//   throwables  - lista rzucalnych obiektow { pos, mesh, radius, mass, kind, onHit, state, vel }
//   registerThrowable({ pos, mesh, radius, mass, kind, onHit }) - dodaje obiekt (mesh trafia do sceny, gdy nie ma rodzica)
//   throwTargets - lista celow { box:{x0,x1,y0,y1,z0,z1} | pos+radius, onHit(power) } trafianych rzuconymi przedmiotami
import { V3, rnd, clamp, cv, canvasTex } from './util.js';
import { G, P, scene, camera, enemies } from './stan.js';
import { supportAt, solidAt, LAND } from './miasto.js';
import { hitEnemy } from './wrogowie.js';
import { burst, getRope, freeRope } from './efekty.js';
import { flatMat } from './postac.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { popText } from './ui.js';

export const throwables = [];
export const throwTargets = [];
export const throwState = { near: false, holding: false, item: null };

const MAX_AMBIENT = 6, RANGE = 42, SPEED = 38, GRAV = 16;
const _a = new V3(), _b = new V3(), _c = new V3(), _d = new V3();
let GEO = null, MAT = null, rope = null, held = null, throwCD = 0, spawnT = 0, nearT = 0, firstFill = true, animT = 0;

// ---------------------------------------------------------------- rodzaje przedmiotow
function plankTex() {
  const c = cv(128, 128), g = c.getContext('2d');
  g.fillStyle = '#8a6a3f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) { g.fillStyle = i & 1 ? '#7d5f37' : '#946f42'; g.fillRect(0, i * 32 + 2, 128, 28); }
  g.strokeStyle = '#3d2c17'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
  g.beginPath(); g.moveTo(2, 2); g.lineTo(126, 126); g.moveTo(126, 2); g.lineTo(2, 126); g.stroke();
  for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(40,25,10,${Math.random() * 0.25})`; g.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 14, 1); }
  return canvasTex(c);
}
function init() {
  GEO = {
    crate: new THREE.BoxGeometry(0.9, 0.9, 0.9), barrel: new THREE.CylinderGeometry(0.4, 0.4, 1.0, 12),
    bin: new THREE.CylinderGeometry(0.4, 0.3, 0.85, 10), door: new THREE.BoxGeometry(1.25, 0.95, 0.1),
    tire: new THREE.TorusGeometry(0.32, 0.14, 8, 14), chip: new THREE.BoxGeometry(0.16, 0.16, 0.16),
  };
  MAT = {
    crate: new THREE.MeshStandardMaterial({ map: plankTex(), roughness: 0.9 }),
    barrelB: flatMat(0x2d6a9c), barrelR: flatMat(0x9a2b22), bin: flatMat(0x3b4a3f), tire: flatMat(0x1b1b1d),
    doorA: flatMat(0xb11f1f), doorB: flatMat(0xd8d6cf), doorC: flatMat(0x1f3e6e), doorD: flatMat(0xe0b021),
    chipWood: flatMat(0x8a6a3f), chipMetal: flatMat(0x8d949b), chipDark: flatMat(0x2a2a2a),
  };
}
// rodzaj: geometria, material(y), promien, masa, obrazenia, dzwiek, kolor kurzu, odlamki
const KINDS = {
  crate: { geo: 'crate', mat: () => MAT.crate, r: 0.55, mass: 12, dmg: 2.2, y: 0.45, snd: 'hit_wall', dust: 0xb0865a, chip: 'chipWood', w: 30 },
  barrel: { geo: 'barrel', mat: () => (Math.random() < 0.5 ? MAT.barrelB : MAT.barrelR), r: 0.55, mass: 25, dmg: 3, y: 0.5, snd: 'crash', dust: 0xa09a90, chip: 'chipMetal', w: 25 },
  bin: { geo: 'bin', mat: () => MAT.bin, r: 0.5, mass: 8, dmg: 1.6, y: 0.43, snd: 'hit_wall', dust: 0x8f958b, chip: 'chipDark', w: 20 },
  door: { geo: 'door', mat: () => [MAT.doorA, MAT.doorB, MAT.doorC, MAT.doorD][Math.random() * 4 | 0], r: 0.7, mass: 15, dmg: 2.4, y: 0.6, snd: 'crash', dust: 0xb0aaa0, chip: 'chipMetal', w: 15, lay: true },
  tire: { geo: 'tire', mat: () => MAT.tire, r: 0.5, mass: 9, dmg: 1.5, y: 0.45, snd: 'land', dust: 0x777777, chip: 'chipDark', w: 10 },
};
function pickKind() {
  let s = 0; for (const k in KINDS) s += KINDS[k].w;
  let r = Math.random() * s; for (const k in KINDS) { r -= KINDS[k].w; if (r <= 0) return k; }
  return 'crate';
}

// ---------------------------------------------------------------- rejestr
export function registerThrowable(o) {
  const it = { pos: o.pos || new V3(), mesh: o.mesh, radius: o.radius || 0.5, mass: o.mass || 10, kind: o.kind || 'crate', onHit: o.onHit || null,
    state: 'idle', vel: new V3(), t: 0, own: false, dmg: (KINDS[o.kind] || KINDS.crate).dmg * (o.mass ? clamp(o.mass / 12, 0.6, 1.6) : 1), spin: new V3() };
  if (it.mesh && !it.mesh.parent) scene.add(it.mesh);
  throwables.push(it); return it;
}
export function spawnThrowable(kind, x, y, z) {
  if (!GEO) init();
  const K = KINDS[kind] || KINDS.crate;
  const m = new THREE.Mesh(GEO[K.geo], K.mat()); m.castShadow = true; m.receiveShadow = true;
  m.position.set(x, y + K.y, z);
  m.rotation.y = rnd(0, 6.28); if (K.lay) m.rotation.x = 0; if (kind === 'tire') m.rotation.x = Math.PI / 2;
  scene.add(m);
  const it = registerThrowable({ pos: m.position, mesh: m, radius: K.r, mass: K.mass, kind });
  it.own = true; it.gy = y; return it;
}
function removeItem(it) {
  const i = throwables.indexOf(it); if (i >= 0) throwables.splice(i, 1);
  if (it.own) scene.remove(it.mesh); else it.mesh.visible = false;
  if (held === it) { held = null; throwState.holding = false; throwState.item = null; if (rope) { freeRope(rope); rope = null; } }
}

// ---------------------------------------------------------------- przedmioty w otoczeniu gracza
function onScreen(x, y, z) { _d.set(x, y, z).project(camera); return Math.abs(_d.x) < 1.08 && Math.abs(_d.y) < 1.08 && _d.z < 1; }
function ambientTick() {
  let own = 0;
  for (let i = throwables.length - 1; i >= 0; i--) {
    const it = throwables[i]; if (!it.own || it.state !== 'idle') continue;
    if (Math.hypot(it.pos.x - P.pos.x, it.pos.z - P.pos.z) > RANGE * 1.7 || Math.abs(it.pos.y - P.pos.y) > 45) removeItem(it); else own++;
  }
  if (own >= MAX_AMBIENT || P.pos.y > 130) return;
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * 6.283, r = rnd(7, RANGE - 4), x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    if (x < LAND.x0 + 3 || x > LAND.x1 - 3 || z < LAND.z0 + 3 || z > LAND.z1 - 3) continue;
    const g = supportAt(x, z, P.pos.y + 0.6, 0.5);
    if (g < P.pos.y - 6 || solidAt(x, g + 0.3, z)) continue;
    if (!firstFill && r < 32 && onScreen(x, g + 0.5, z)) continue; // nie pojawiaj sie na oczach
    spawnThrowable(pickKind(), x, g, z); return;
  }
}
function handPos(out) {
  const H = P.H;
  if (H && H.handR) { H.handR.getWorldPosition(out); return out; }
  return out.set(P.pos.x, P.pos.y + 1.4, P.pos.z);
}
function pickItem() {
  camera.getWorldDirection(_a);
  let best = null, bs = 1e9;
  for (const it of throwables) {
    if (it.state !== 'idle') continue;
    const dx = it.pos.x - P.pos.x, dy = it.pos.y - P.pos.y, dz = it.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > RANGE || Math.abs(dy) > 22) continue;
    const dot = (dx * _a.x + dz * _a.z) / ((d || 1) * (Math.hypot(_a.x, _a.z) || 1));
    const sc = d * (1.7 - dot); if (sc < bs) { bs = sc; best = it; }
  }
  return best;
}

// ---------------------------------------------------------------- akcje
function startPull(it) {
  it.state = 'pull'; it.t = 0; it.from = it.pos.clone(); held = it; throwState.holding = true; throwState.item = it;
  rope = getRope(); P.holdThrow = true;
  P.heading = Math.atan2(it.pos.x - P.pos.x, it.pos.z - P.pos.z);
  sfx('thwip'); rumble(0.06, 0.1, 0.3);
}
function overhead(out, t) { return out.set(P.pos.x, P.pos.y + 2.55 + Math.sin(t * 3) * 0.08, P.pos.z); }

function doThrow() {
  const it = held; if (!it) return;
  camera.getWorldDirection(_a);
  // cel: wrog najblizszy celownika (kat < ~18 stopni), w przeciwnym razie punkt przed kamera
  let tgt = null, bd = 0.94;
  for (const e of enemies) {
    if (e.dead || e.gone) continue;
    _b.set(e.pos.x - camera.position.x, e.pos.y + 1 * (e.scale || 1) - camera.position.y, e.pos.z - camera.position.z);
    const L = _b.length(); if (L > 70 || L < 2) continue;
    const dot = _b.dot(_a) / L; if (dot > bd) { bd = dot; tgt = e; }
  }
  overhead(_c, G.time); it.pos.copy(_c); it.mesh.position.copy(_c);
  if (tgt) {
    _b.set(tgt.pos.x, tgt.pos.y + 1.0 * (tgt.scale || 1), tgt.pos.z).sub(_c); const T = _b.length() / SPEED;
    _b.y += 0.5 * GRAV * T * T * 0.9; _b.normalize();
  } else {
    _b.copy(camera.position).addScaledVector(_a, 60).sub(_c).normalize(); _b.y += 0.04; _b.normalize();
  }
  it.vel.copy(_b).multiplyScalar(SPEED); it.state = 'fly'; it.t = 0;
  it.spin.set(rnd(-9, 9), rnd(-9, 9), rnd(-9, 9));
  held = null; throwState.holding = false; throwState.item = null; P.holdThrow = false; P.throwT = 0.34; throwCD = 0.35;
  if (rope) { freeRope(rope); rope = null; }
  sfx('whoosh', 0.8); sfx('thwip', 0.5); rumble(0.1, 0.3, 0.5); G.shake = Math.max(G.shake, 0.08);
}

function shatter(it, x, y, z) {
  const K = KINDS[it.kind] || KINDS.crate;
  burst(x, y, z, 12, K.dust, 4); burst(x, y, z, 8, 0xfff2c0, 3);
  sfx(K.snd, 0.7, null); G.shake = Math.max(G.shake, 0.18); rumble(0.1, 0.4, 0.4);
  spawnChips(x, y, z, K.chip, it.kind === 'door' ? 5 : 8);
  removeItem(it);
}
// odlamki: mala pula meshy
const chips = [];
function spawnChips(x, y, z, mat, n) {
  const gy = supportAt(x, z, y + 0.6, 0.1);
  for (let i = 0; i < n; i++) {
    let c = chips.find(q => !q.mesh.visible);
    if (!c) { if (chips.length >= 28) break; const m = new THREE.Mesh(GEO.chip, MAT.chipWood); scene.add(m); c = { mesh: m, vel: new V3(), life: 0, gy: 0, spin: new V3() }; chips.push(c); }
    c.mesh.material = MAT[mat]; c.mesh.visible = true; c.mesh.position.set(x, y, z); c.life = rnd(1.1, 1.8); c.gy = gy + 0.08;
    const s = rnd(0.6, 1.4); c.mesh.scale.set(s, s * rnd(0.4, 1), s * rnd(0.6, 1.6));
    c.vel.set(rnd(-1, 1) * 5, rnd(2, 7), rnd(-1, 1) * 5); c.spin.set(rnd(-8, 8), rnd(-8, 8), rnd(-8, 8));
  }
}
function updateChips(dt) {
  for (const c of chips) {
    if (!c.mesh.visible) continue;
    c.life -= dt; if (c.life <= 0) { c.mesh.visible = false; continue; }
    if (c.mesh.position.y > c.gy) {
      c.vel.y -= 22 * dt; c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
      if (c.mesh.position.y <= c.gy) { c.mesh.position.y = c.gy; c.vel.set(0, 0, 0); }
    }
    if (c.life < 0.3) c.mesh.scale.multiplyScalar(1 - dt * 3);
  }
}

function flyStep(it, h) {
  it.vel.y -= GRAV * h; it.pos.addScaledVector(it.vel, h); it.t += h;
  const m = it.mesh; m.rotation.x += it.spin.x * h; m.rotation.y += it.spin.y * h; m.rotation.z += it.spin.z * h;
  const p = it.pos;
  // wrogowie
  for (const e of enemies) {
    if (e.dead || e.gone) continue;
    const sc = e.scale || 1, dx = p.x - e.pos.x, dy = p.y - (e.pos.y + 0.9 * sc), dz = p.z - e.pos.z;
    if (dx * dx + dy * dy + dz * dz < (it.radius + 0.8 * sc) ** 2) {
      _a.copy(it.vel).setY(0).normalize();
      hitEnemy(e, it.dmg, _a.x * 12, 6, _a.z * 12, true, true);
      if (it.onHit) it.onHit(e);
      popText('RZUT!'); shatter(it, p.x, p.y, p.z); return true;
    }
  }
  // cele zewnetrzne
  for (const t of throwTargets) {
    let hit = false;
    if (t.box) { const b = t.box, r = it.radius * 0.6; hit = p.x > b.x0 - r && p.x < b.x1 + r && p.y > b.y0 - r && p.y < b.y1 + r && p.z > b.z0 - r && p.z < b.z1 + r; }
    else if (t.pos) hit = p.distanceTo(t.pos) < (t.radius || 1) + it.radius;
    if (hit) { const pw = it.mass * it.vel.length(); if (t.onHit) t.onHit(pw); if (it.onHit) it.onHit(t); shatter(it, p.x, p.y, p.z); return true; }
  }
  // swiat
  if (it.t > 0.06 && (solidAt(p.x, p.y, p.z) || p.y <= supportAt(p.x, p.z, p.y + 0.4, 0.1) + it.radius * 0.5)) { shatter(it, p.x, Math.max(p.y, supportAt(p.x, p.z, p.y + 0.5, 0.1)), p.z); return true; }
  if (it.t > 5 || p.y < -10) { removeItem(it); return true; }
  return false;
}

// ---------------------------------------------------------------- aktualizacja (z updatePlayer)
export function updateThrow(dt, I) {
  throwCD -= dt; updateChips(dt);
  if (P.throwT > 0) P.throwT -= dt;
  if (G.interior || G.state !== 'play') { if (held) dropHeld(); return; }
  if (!GEO) init();
  spawnT -= dt; if (spawnT <= 0) { spawnT = firstFill ? 0.1 : 0.9; ambientTick(); if (firstFill && throwables.filter(t => t.own).length >= MAX_AMBIENT) firstFill = false; }
  nearT -= dt; if (nearT <= 0) { nearT = 0.25; throwState.near = !held && !!pickItem(); }

  const busy = P.dead || P.fin || P.healing || P.state === 'car' || P.state === 'pz';
  if (held) {
    if (busy) { dropHeld(); return; }
    if (I && throwCD <= 0 && held.state === 'held' && (I.throwP || I.webP || I.punchP)) { I.webP = I.punchP = I.throwP = false; doThrow(); }
  } else if (I && I.throwP && !busy && throwCD <= 0) {
    const it = pickItem();
    if (it) startPull(it); else { popText('NIC DO RZUCENIA'); throwCD = 0.6; }
  }

  // ruch przedmiotow
  for (let i = throwables.length - 1; i >= 0; i--) {
    const it = throwables[i];
    if (it.state === 'pull') {
      it.t += dt; const k = clamp(it.t / 0.38, 0, 1), e = k * k * (3 - 2 * k);
      overhead(_c, G.time); it.pos.lerpVectors(it.from, _c, e); it.pos.y += Math.sin(k * Math.PI) * 1.2;
      it.mesh.position.copy(it.pos); it.mesh.rotation.y += dt * 8;
      if (k >= 1) { it.state = 'held'; it.t = 0; sfx('pickup', 0.25); }
    } else if (it.state === 'held') {
      it.t += dt; overhead(it.pos, G.time); it.mesh.position.copy(it.pos); it.mesh.rotation.y += dt * 1.6;
      if (it.t > 8) dropHeld();
    } else if (it.state === 'fly') {
      const n = 3, h = dt / n;
      for (let k = 0; k < n; k++) if (flyStep(it, h)) break;
      if (throwables.includes(it)) it.mesh.position.copy(it.pos);
    }
  }
  if (rope && held) { handPos(_b); rope.set(_b, held.pos, held.state === 'pull' ? 1 : 0.8, held.state === 'pull' ? 0.4 : 0.05); }
}
function dropHeld() {
  const it = held; if (!it) return;
  it.state = 'fly'; it.vel.set(0, 0, 0); it.t = 0; it.spin.set(rnd(-3, 3), 0, rnd(-3, 3));
  held = null; throwState.holding = false; throwState.item = null; P.holdThrow = false;
  if (rope) { freeRope(rope); rope = null; }
}

// poza gracza: ramiona w gore (przedmiot nad glowa) i zamach przy rzucie — wolane z buildPose
export function throwPose(t) {
  if (P.throwT > 0) { const k = 1 - P.throwT / 0.34; t.sRx = -2.9 + k * 2.4; t.sLx = -2.7 + k * 2.2; t.eR = -0.2; t.eL = -0.2; t.bp = -0.25 + k * 0.7; t.hx = 0.2; return true; }
  if (P.holdThrow) { t.sRx = -2.9; t.sLx = -2.8; t.eR = -0.25; t.eL = -0.25; t.sRz = -0.18; t.sLz = 0.18; t.bp = -0.18; t.hx = -0.35; t.by = -0.04; return true; }
  return false;
}
