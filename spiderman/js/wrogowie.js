// Bandyci (zwykli, z bronia, osilki), przestepstwa, strzaly siecia, pociski, iskry, plecaki i doswiadczenie.
import { V3, rnd, clamp, damp, angLerp, save, doSave, cv, canvasTex, sr } from './util.js';
import { G, P, scene, camera, enemies, crimes } from './stan.js';
import { spots, supportAt, solidAt, raycastCity, rayN, roofs, scarePeds, glowTexture } from './miasto.js';
import { buildThug, el, newPose, zeroPose, blendPose, applyPose, idlePose, runPose, aimArm, flatMat, webMaterial, SUITS } from './postac.js';
import { hurtPlayer, mkLine, setLine } from './gracz.js';
import { bossHit, bossWeb, bossFinish } from './misje.js';
import { websToWrap, dmgMul, skillPoints } from './umiejetnosci.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, popText, hint } from './ui.js';

const _t = new V3(), _h = new V3(), _cf = new V3(), _a = new V3();

// ---------------------------------------------------------------- doswiadczenie
export const need = l => 600 + l * 400;
let saveT = 0;
export function addXP(n) {
  save.xp += n; let up = false;
  while (save.xp >= need(save.lvl)) { save.xp -= need(save.lvl); save.lvl++; up = true; }
  if (up) {
    sfx('level');
    const nu = SUITS.filter(s => s.lvl === save.lvl).map(s => s.name);
    showMsg('AWANS! POZIOM ' + save.lvl, (nu.length ? 'Nowy strój: ' + nu.join(', ') + ' · ' : '') + `Punkty umiejętności: ${skillPoints()} (Pauza → Umiejętności)`, 4);
    doSave();
  }
  saveT = 3;
}

// ---------------------------------------------------------------- iskry (czasteczki)
const PMAX = 700; let pts, pPos, pCol, pVel, pLife, pIdx = 0;
const trGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true); trGeo.translate(0, 0.5, 0);
const trMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const tracers = [], splats = [];
let splatMat, shotGeo, shotMat, glowTex;

export function initFX() {
  pPos = new Float32Array(PMAX * 3); pCol = new Float32Array(PMAX * 3); pVel = new Float32Array(PMAX * 3); pLife = new Float32Array(PMAX);
  for (let i = 0; i < PMAX; i++) pPos[i * 3 + 1] = -9999;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false }));
  pts.frustumCulled = false; scene.add(pts);

  const c = cv(128, 128), x = c.getContext('2d');
  x.strokeStyle = 'rgba(245,245,245,.95)'; x.lineWidth = 3; x.translate(64, 64);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); x.stroke(); }
  for (const r of [14, 28, 44]) { x.beginPath(); x.arc(0, 0, r, 0, 7); x.stroke(); }
  splatMat = new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  shotGeo = new THREE.SphereGeometry(0.13, 8, 6); shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  glowTex = glowTexture('rgba(255,230,120,1)', 'rgba(255,200,60,0)');
}
export function burst(x, y, z, n, col, spd = 5) {
  const c = new THREE.Color(col);
  for (let i = 0; i < n; i++) {
    const k = pIdx++ % PMAX;
    pPos[k * 3] = x; pPos[k * 3 + 1] = y; pPos[k * 3 + 2] = z;
    pVel[k * 3] = rnd(-1, 1) * spd; pVel[k * 3 + 1] = rnd(0, 1.5) * spd; pVel[k * 3 + 2] = rnd(-1, 1) * spd;
    pLife[k] = rnd(0.3, 0.7);
    pCol[k * 3] = c.r; pCol[k * 3 + 1] = c.g; pCol[k * 3 + 2] = c.b;
  }
}
export function tracer(a, b) {
  let t = tracers.find(q => q.life <= 0);
  if (!t) { t = { m: mkLine(trMat), life: 0 }; tracers.push(t); }
  setLine(t.m, a, b); t.life = 0.07;
}
function splat(p, n) {
  let s;
  if (splats.length < 30) { s = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), splatMat); scene.add(s); splats.push(s); }
  else { s = splats.shift(); splats.push(s); }
  s.position.copy(p).addScaledVector(n, 0.03);
  s.lookAt(_a.copy(p).add(n)); s.rotation.z = Math.random() * 6;
}
export function updateFX(dt) {
  for (let k = 0; k < PMAX; k++) {
    if (pLife[k] <= 0) continue;
    pLife[k] -= dt;
    if (pLife[k] <= 0) { pPos[k * 3 + 1] = -9999; continue; }
    pVel[k * 3 + 1] -= 12 * dt;
    pPos[k * 3] += pVel[k * 3] * dt; pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt; pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
  }
  pts.geometry.attributes.position.needsUpdate = true; pts.geometry.attributes.color.needsUpdate = true;
  for (const t of tracers) { if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; } }
  if (saveT > 0) { saveT -= dt; if (saveT <= 0) doSave(); }
}

// ---------------------------------------------------------------- strzaly siecia
const shots = [];
export function webTarget() {
  camera.getWorldDirection(_cf);
  let best = null, bs = -1e9;
  for (const e of enemies) {
    if (e.dead || e.gone) continue;
    _t.set(e.pos.x, e.pos.y + 1.1 * (e.scale || 1), e.pos.z).sub(camera.position);
    const d = _t.length(); if (d > 60) continue;
    const dot = _t.dot(_cf) / d; if (dot < 0.86) continue;
    const sc = dot * 2 - d / 60; if (sc > bs) { bs = sc; best = e; }
  }
  return best;
}
export function shootWeb() {
  const best = webTarget();
  P.H.handR.getWorldPosition(_h);
  const pt = new V3(); let n = null;
  if (best) pt.set(best.pos.x, best.pos.y + 1.1 * (best.scale || 1), best.pos.z);
  else {
    camera.getWorldDirection(_cf);
    const t = raycastCity(camera.position, _cf, 110);
    pt.copy(camera.position).addScaledVector(_cf, t);
    if (t < 110) n = rayN.clone();
  }
  const m = new THREE.Mesh(shotGeo, shotMat); m.position.copy(_h); scene.add(m);
  shots.push({ m, tr: mkLine(), pos: _h.clone(), target: best, pt, n, life: 2 });
  P.webT = 0.28; P.webAim.copy(pt);
  if (P.state === 'ground' && !P.atk) P.heading = Math.atan2(pt.x - P.pos.x, pt.z - P.pos.z);
  sfx('thwip');
}
export function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt;
    if (s.target && !s.target.gone) s.pt.set(s.target.pos.x, s.target.pos.y + (1.1 - s.target.down * 0.8) * (s.target.scale || 1), s.target.pos.z);
    _t.subVectors(s.pt, s.pos); const d = _t.length(), st = 85 * dt;
    let done = false;
    if (d <= st + 0.2) {
      s.pos.copy(s.pt); done = true;
      if (s.target) webHit(s.target); else if (s.n) { splat(s.pt, s.n); sfx('splat', 0.4); }
    } else s.pos.addScaledVector(_t, st / d);
    s.m.position.copy(s.pos);
    if (d > 0.01) { _a.copy(s.pos).addScaledVector(_t, -Math.min(3, d) / d); setLine(s.tr, _a, s.pos); }
    if (done || s.life <= 0) { scene.remove(s.m); scene.remove(s.tr); shots.splice(i, 1); }
  }
}
function webHit(e) {
  if (e.gone) return;
  burst(e.pos.x, e.pos.y + 1.1, e.pos.z, 12, 0xffffff, 3); sfx('splat'); addXP(5);
  if (e.type === 'boss') { (e.webFn || bossWeb)(e); return; }
  e.webs++; e.webT = 6;
  if (e.type === 'brute') {
    e.stunT = 2.5; if (!e.dead) { e.state = 'hurt'; e.t = 0.4; }
    if (e.webs >= websToWrap() + 2 && !e.dead) { e.webbed = true; killEnemy(e); e.state = 'down'; }
    else popText('OSIŁEK OGŁUSZONY!');
    return;
  }
  if (e.webs >= websToWrap() && !e.dead) { e.webbed = true; killEnemy(e); if (!e.air) e.state = 'down'; }
  else if (!e.dead && !e.air) { e.state = 'hurt'; e.t = 0.3; }
  if (e.air) e.airHold = 0.5;
}
// wykonczenie: natychmiastowe zawiniecie w kokon (boss dostaje duze obrazenia)
export function finishEnemy(e) {
  if (e.dead || e.gone) return;
  burst(e.pos.x, e.pos.y + 1, e.pos.z, 30, 0xffffff, 6);
  if (e.type === 'boss') { (e.finFn || bossFinish)(e); return; }
  e.webs = 9; e.webbed = true; killEnemy(e); e.air = false; e.state = 'down'; e.pos.y = supportAt(e.pos.x, e.pos.z, e.pos.y + 0.5, 0.1);
  addXP(20); popText('WYKOŃCZENIE!');
}

// ---------------------------------------------------------------- bandyci
const pick = a => a[Math.floor(Math.random() * a.length)];
// pistolet: zamek, lufa i rekojesc; trzymany w piesci, lufa wzdluz reki
function makeGun() {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x151618, metalness: 0.7, roughness: 0.35 });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.042), m); slide.position.set(0, -0.08, 0.035);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.085), m); grip.position.set(0, 0.0, 0.0); grip.rotation.x = 0.25;
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI), m); guard.rotation.y = Math.PI / 2; guard.position.set(0, -0.035, 0.012);
  g.add(slide, grip, guard); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.position.set(0, -0.32, 0.01); return g;
}
function makeBat() {
  const pts = [[0.012, 0], [0.016, 0.02], [0.014, 0.05], [0.017, 0.3], [0.03, 0.55], [0.036, 0.72], [0.034, 0.78], [0.0, 0.79]].map(([r, y]) => new THREE.Vector2(r, y));
  const bat = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshStandardMaterial({ color: pick([0x8a6039, 0x9a9da3, 0x5b3a22]), roughness: 0.5, metalness: 0.1 }));
  bat.rotation.x = Math.PI; bat.position.set(0, -0.26, 0.0); bat.castShadow = true; return bat;
}

export function makeEnemy(type) {
  const brute = type === 'brute';
  const H = buildThug(brute ? 'brute' : 'thug');
  let wpn = null;
  if (brute) H.root.scale.setScalar(1.12);
  else { wpn = type === 'gun' ? makeGun() : makeBat(); H.elR.add(wpn); H.setHands('open', 'fist'); }
  const cocoon = el(webMaterial(), 0.34, 0.98, 0.32, 0, 0.9, 0); cocoon.visible = false; H.root.add(cocoon);
  const blob = el(webMaterial(), 0.14, 0.12, 0.08, 0, 0.12, 0.12); blob.visible = false; H.chest.add(blob);
  scene.add(H.root);
  return {
    H, type, wpn, cocoon, blob, pos: new V3(), vel: new V3(), yaw: rnd(0, 6.28), hp: brute ? 10 : type === 'gun' ? 3 : 4,
    state: 'idle', t: rnd(1, 4), cd: rnd(0.5, 2), webs: 0, webT: 0, dead: false, air: false, down: 0, webbed: false,
    pc: newPose(), pt: newPose(), ph: rnd(0, 6), moving: false, groundY: 0, crime: null, gone: false, spin: 0, hurtT: 0,
    scale: brute ? 1.25 : 1, stunT: 0, airHold: 0,
  };
}

export function makeCrime(x0, x1, z0, z1, y, spot, n, bruteOK) {
  const cr = { spot, list: [], active: true, alert: false, clearT: 0, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2 };
  let brutes = 0;
  for (let k = 0; k < n; k++) {
    let type = Math.random() < 0.4 ? 'gun' : 'melee';
    if (bruteOK && brutes === 0 && Math.random() < 0.45) { type = 'brute'; brutes++; }
    const e = makeEnemy(type);
    e.pos.set(rnd(x0, x1), y, rnd(z0, z1)); e.groundY = y; e.crime = cr;
    cr.list.push(e); enemies.push(e);
  }
  crimes.push(cr); return cr;
}
export function spawnCrime(first) {
  const cand = spots.filter(s => !s.busy && Math.hypot(s.cx - P.pos.x, s.cz - P.pos.z) > (first ? 80 : 150));
  if (!cand.length) return;
  const s = cand[Math.floor(Math.random() * cand.length)]; s.busy = true;
  const n = 3 + Math.floor(Math.random() * 3) + Math.min(2, Math.floor(save.lvl / 4));
  makeCrime(s.x0 + 2, s.x1 - 2, s.z0 + 2, s.z1 - 2, s.y1, s, n, save.lvl >= 2);
}
// bandyci wysiadajacy z rozbitego auta w poscigu
export function spawnStreetThugs(x, z, n) {
  const cr = makeCrime(x - 2, x + 2, z - 2, z + 2, 0, null, n, false);
  cr.alert = true; for (const e of cr.list) e.state = 'fight';
  return cr;
}

// trafienie. Zwraca 'block', gdy cios zostal zablokowany.
export function hitEnemy(e, dmg, kx, ky, kz, launch, fromAir) {
  if (e.dead || e.gone) return false;
  if (e.type === 'boss') return (e.hit || bossHit)(e, dmg * dmgMul(), launch);
  if (e.type === 'brute' && e.stunT <= 0 && !fromAir && e.state !== 'hurt') {
    burst(e.pos.x, e.pos.y + 1.6, e.pos.z, 8, 0x9fd8ff, 3); sfx('block'); rumble(0.06, 0.2, 0.2);
    popText('BLOK!'); hint('brute', 'Osiłek blokuje ciosy. Trafiaj go siecią albo atakuj z powietrza!');
    e.cd = Math.min(e.cd, 0.3); return 'block';
  }
  e.hp -= dmg * dmgMul(); e.hurtT = 0.35;
  burst(e.pos.x, e.pos.y + 1.2 * e.scale, e.pos.z, 10, 0xfff2c0, 4);
  sfx('punch'); rumble(0.08, 0.35, 0.5); G.shake = Math.max(G.shake, launch ? 0.3 : 0.12);
  addXP(5);
  const heavy = e.type === 'brute';
  if (e.air) { e.vel.set(kx * 0.3, 3, kz * 0.3); e.airHold = 0.9; e.state = 'air'; }
  else if (launch === 'up' && !heavy) { e.air = true; e.vel.set(0, 14, 0); e.airHold = 1.6; e.state = 'air'; e.spin = rnd(-3, 3); popText('WYBICIE!'); }
  else if ((e.hp <= 0 || launch) && !(heavy && e.hp > 0)) { e.air = true; e.vel.set(kx * (heavy ? 0.5 : 1), ky, kz * (heavy ? 0.5 : 1)); e.state = 'air'; e.spin = rnd(-6, 6); }
  else { e.state = 'hurt'; e.t = 0.4; e.vel.set(kx, 0, kz); }
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; addXP(e.type === 'brute' ? 60 : 25);
}
function moveEnemy(e, vx, vz, dt) {
  const nx = e.pos.x + vx * dt, nz = e.pos.z + vz * dt;
  const g = supportAt(nx, nz, e.pos.y + 0.5, 0.1);
  if (Math.abs(g - e.groundY) < 0.3 && !solidAt(nx, e.pos.y + 1, nz)) { e.pos.x = nx; e.pos.z = nz; }
}
function fireAt(e, d) {
  e.wpn.getWorldPosition(_h);
  _t.set(P.pos.x, P.pos.y + 1.2, P.pos.z);
  let ch = 0.75 - P.vel.length() / 55 - d / 140; if (P.state === 'swing') ch -= 0.15;
  ch = clamp(ch, 0.08, 0.75);
  const hit = Math.random() < ch && P.invT <= 0 && P.dodgeT <= 0;
  if (!hit) { _t.x += rnd(-2.5, 2.5); _t.y += rnd(-1, 2.5); _t.z += rnd(-2.5, 2.5); _t.sub(_h).multiplyScalar(1.6).add(_h); }
  tracer(_h, _t); burst(_h.x, _h.y, _h.z, 4, 0xffd070, 2);
  sfx('shot', clamp(1.2 - d / 80, 0.15, 1));
  if (e.pos.y < 3) scarePeds(e.pos.x, e.pos.z);
  if (hit) hurtPlayer(7, e);
}

export function updateEnemies(dt) {
  G.sense = false;
  for (const e of enemies) if (e.type !== 'boss') updateEnemy(e, dt);
  // rozpychanie sie
  for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
    const a = enemies[i], b = enemies[j]; if (a.dead || b.dead || a.air || b.air || a.type === 'boss' || b.type === 'boss') continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), md = 0.45 * (a.scale + b.scale);
    if (d > 0.001 && d < md && Math.abs(a.pos.y - b.pos.y) < 1) {
      const p = (md - d) / 2 / d;
      moveEnemy(a, -dx * p, -dz * p, 1); moveEnemy(b, dx * p, dz * p, 1);
    }
  }
}
function updateEnemy(e, dt) {
  const H = e.H;
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dy = P.pos.y - e.pos.y, dist = Math.hypot(dx, dz), d3 = Math.hypot(dist, dy);
  if (d3 > 280 && !e.air) { H.root.visible = false; return; }
  H.root.visible = true;
  e.moving = false; e.hurtT = Math.max(0, e.hurtT - dt); e.stunT -= dt; e.airHold -= dt;
  if (e.webT > 0 && !e.dead) { e.webT -= dt; if (e.webT <= 0) { e.webs = Math.max(0, e.webs - 1); if (e.webs > 0) e.webT = 4; } }
  const R = e.scale;

  if (e.air) {
    // po wybiciu / ciosie w powietrzu bandyta "zawisa" chwile, zeby dalo sie go dalej bic
    if (e.airHold > 0) { e.vel.y = e.vel.y * (1 - Math.min(1, 4 * dt)) - 3 * dt; e.vel.x *= 1 - Math.min(1, 3 * dt); e.vel.z *= 1 - Math.min(1, 3 * dt); }
    else e.vel.y -= 26 * dt;
    const ox = e.pos.x, oz = e.pos.z;
    e.pos.addScaledVector(e.vel, dt);
    if (solidAt(e.pos.x, e.pos.y + 0.8, e.pos.z)) { e.pos.x = ox; e.pos.z = oz; e.vel.x *= -0.3; e.vel.z *= -0.3; }
    const g = supportAt(e.pos.x, e.pos.z, e.pos.y + 0.3, 0.1);
    if (e.pos.y <= g && e.vel.y <= 0) {
      e.pos.y = g; e.air = false; e.groundY = g; e.vel.set(0, 0, 0);
      burst(e.pos.x, g + 0.1, e.pos.z, 10, 0xbdb5a8, 3); sfx('land', 0.3);
      if (e.dead) e.state = 'down'; else { e.state = 'getup'; e.t = 0.7; }
    }
  } else if (!e.dead) {
    const cr = e.crime; if (!cr.alert && d3 < 45) cr.alert = true;
    const slow = e.webs > 0 ? 0.35 : 1;
    const face = () => { e.yaw = angLerp(e.yaw, Math.atan2(dx, dz), damp(8, dt)); };
    if (e.state === 'hurt' && e.vel.lengthSq() > 0.01) { moveEnemy(e, e.vel.x, e.vel.z, dt); e.vel.multiplyScalar(1 - Math.min(1, dt * 8)); }
    if (e.type === 'brute' && e.stunT > 0 && e.state !== 'hurt') { e.state = 'stun'; }
    switch (e.state) {
      case 'idle':
        if (cr.alert) { e.state = 'fight'; break; }
        e.t -= dt; if (e.t <= 0) { e.t = rnd(2, 5); e.yawT = rnd(0, 6.28); }
        if (e.yawT !== undefined) e.yaw = angLerp(e.yaw, e.yawT, damp(2, dt));
        break;
      case 'stun': if (e.stunT <= 0) e.state = 'fight'; break;
      case 'fight':
        face(); e.cd -= dt;
        if (e.type !== 'gun') {
          if (Math.abs(dy) < 2.5 && dist < 35) {
            const sp = (e.type === 'brute' ? 3.2 : 4.2) * slow;
            if (dist > 1.4 * R) { moveEnemy(e, dx / dist * sp, dz / dist * sp, dt); e.moving = true; }
            if (dist < 1.9 * R && e.cd <= 0 && P.state !== 'wall') { e.state = 'windup'; e.t = e.type === 'brute' ? 0.8 : 0.55; }
          }
        } else {
          if (dist < 5 && dist > 0.1) { moveEnemy(e, -dx / dist * 2.5 * slow, -dz / dist * 2.5 * slow, dt); e.moving = true; }
          if (e.cd <= 0 && d3 < 65) { e.state = 'aim'; e.t = 0.75; }
        }
        break;
      case 'windup':
        face(); e.t -= dt; G.sense = true;
        if (e.t <= 0) {
          const big = e.type === 'brute';
          if (dist < 2.4 * R && Math.abs(dy) < 1.8) hurtPlayer(big ? 25 : 10, e, big ? 16 : 6);
          if (big) { G.shake = Math.max(G.shake, 0.3); sfx('slam', 0.5); burst(e.pos.x, e.pos.y + 0.2, e.pos.z, 16, 0xbdb5a8, 5); }
          e.state = 'recover'; e.t = big ? 0.8 : 0.45; e.cd = rnd(1.2, 2.4);
        }
        break;
      case 'aim':
        face(); e.t -= dt; if (e.t < 0.5) G.sense = true;
        if (e.t <= 0) { fireAt(e, d3); e.state = 'fight'; e.cd = rnd(1.6, 3.2); }
        break;
      case 'recover': case 'hurt': case 'getup':
        e.t -= dt; if (e.t <= 0) e.state = 'fight';
        break;
    }
  }
  poseEnemy(e, dt, d3);
}
function poseEnemy(e, dt, d3) {
  const t = e.pt, H = e.H; zeroPose(t);
  if (e.air) { t.bp = -0.9; t.sLz = 1.6; t.sRz = -1.6; t.hLx = -0.6; t.hRx = 0.3; t.kL = 0.8; t.kR = 0.6; e.spin *= 1 - dt; }
  else if (e.dead) { if (!e.webbed) { t.sLz = 1.3; t.sRz = -1.3; t.hLz = 0.15; t.hRz = -0.15; } }
  else switch (e.state) {
    case 'windup': if (e.type === 'brute') { t.sRx = -2.8; t.sLx = -2.8; t.eL = -0.6; t.eR = -0.6; t.bp = -0.2; } else { t.sRx = 1.1; t.eR = -1.2; t.spy = 0.5; t.sLx = -0.5; t.hLx = -0.3; t.kL = 0.3; } break;
    case 'recover': if (e.type === 'brute') { t.sRx = -1.2; t.sLx = -1.2; t.bp = 0.6; t.by = -0.3; t.kL = 0.9; t.kR = 0.9; t.hLx = -0.6; t.hRx = -0.6; } else { t.sRx = -1.7; t.eR = -0.1; t.spy = -0.5; t.hLx = -0.4; t.kL = 0.4; } break;
    case 'aim': t.sRx = -1.5; t.sLx = -0.9; t.eL = -1.2; t.sLz = -0.3; break;
    case 'hurt': t.bp = -0.4; t.hx = 0.3; t.sLz = 0.6; t.sRz = -0.6; t.eL = -1; t.eR = -1; break;
    case 'stun': t.bp = 0.3; t.hx = 0.5; t.sLz = 0.2; t.sRz = -0.2; t.by = Math.sin(G.time * 6) * 0.03; t.spy = Math.sin(G.time * 3) * 0.3; break;
    case 'getup': t.by = -0.4; t.hLx = -1.4; t.kL = 1.9; t.hRx = -1.2; t.kR = 1.8; t.bp = 0.5; break;
    default:
      if (e.moving) { e.ph += dt * 9; runPose(t, e.ph, 0.8, false); }
      else idlePose(t, G.time + e.ph);
      if (e.type === 'melee' && !e.moving) { t.sRx = -0.5; t.eR = -1.3; }
      if (e.type === 'brute') { t.sLz = 0.45; t.sRz = -0.45; t.eL = -1.4; t.eR = -1.4; t.sLx = -0.4; t.sRx = -0.4; }
      if (e.state === 'fight' && e.type === 'gun') { t.sRx = -1.2; t.eR = -0.2; }
  }
  if (d3 < 120 || e.air) {
    blendPose(e.pc, t, damp(e.state === 'recover' ? 30 : 12, dt));
    applyPose(H, e.pc);
    const angry = !e.dead && (e.state === 'windup' || e.state === 'recover' || e.state === 'fight' || e.type === 'brute');
    H.setHands(angry && e.type !== 'gun' ? 'fist' : 'open', e.wpn || angry ? 'fist' : 'open');
  }
  e.down += ((e.dead && !e.air ? 1 : 0) - e.down) * damp(6, dt);
  H.root.position.copy(e.pos); H.root.position.y += 0.12 * e.down * e.scale;
  if (e.air) e.yaw += e.spin * dt;
  H.root.rotation.set(-Math.PI / 2 * e.down, e.yaw, 0, 'YXZ');
  if (e.state === 'aim' && !e.dead && !e.air) { H.root.updateMatrixWorld(true); aimArm(H, 'R', _a.set(P.pos.x, P.pos.y + 1.2, P.pos.z), 1); }
  e.cocoon.visible = e.webbed;
  e.blob.visible = !e.webbed && e.webs > 0;
  if (e.blob.visible) e.blob.scale.set(0.1 + Math.min(e.webs, 4) * 0.07, 0.09 + Math.min(e.webs, 4) * 0.06, 0.08);
}
export function removeEnemy(e) {
  e.gone = true; scene.remove(e.H.root);
  const k = enemies.indexOf(e); if (k >= 0) enemies.splice(k, 1);
}

export function updateCrimes(dt) {
  for (let i = crimes.length - 1; i >= 0; i--) {
    const cr = crimes[i];
    if (cr.active) {
      if (cr.list.every(e => e.dead)) {
        cr.active = false; cr.clearT = 0; save.crimes++; addXP(300); doSave();
        sfx('win'); showMsg('PRZESTĘPSTWO UDAREMNIONE', '+300 PD', 3);
      }
    } else {
      cr.clearT += dt;
      if (cr.clearT > 12) {
        for (const e of cr.list) removeEnemy(e);
        if (cr.spot) cr.spot.busy = false;
        crimes.splice(i, 1);
      }
    }
  }
  if (crimes.filter(c => c.active && c.spot).length < 5) spawnCrime(false);
}

// ---------------------------------------------------------------- plecaki do znalezienia
export const bags = [];
export const BAGS_N = 20;
export function initBags() {
  const cand = roofs.filter(r => r.y1 >= 20 && r.y1 <= 220 && r.x1 - r.x0 > 6 && r.z1 - r.z0 > 6);
  const used = new Set();
  const bm = new THREE.MeshStandardMaterial({ color: 0x7a3b2a, roughness: 0.8 });
  const fm = new THREE.MeshStandardMaterial({ color: 0xc8141c, roughness: 0.6 });
  const gm = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  for (let i = 0; i < BAGS_N && used.size < cand.length; i++) {
    let k; do { k = Math.floor(sr(0, cand.length)); } while (used.has(k));
    used.add(k); const r = cand[k];
    const g = new THREE.Group();
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), bm); b1.castShadow = true;
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.06), fm); b2.position.set(0, -0.08, 0.17);
    const gl = new THREE.Sprite(gm); gl.scale.set(2.6, 2.6, 1);
    g.add(b1, b2, gl);
    g.position.set((r.x0 + r.x1) / 2, r.y1 + 0.9, (r.z0 + r.z1) / 2);
    const got = save.bags.includes(i); g.visible = !got;
    scene.add(g); bags.push({ g, got, i });
  }
}
export function updateBags(dt) {
  for (const b of bags) {
    if (b.got) continue;
    b.g.rotation.y += dt * 1.5;
    const d = b.g.position.distanceTo(_t.set(P.pos.x, P.pos.y + 0.9, P.pos.z));
    if (d < 2.4) {
      b.got = true; b.g.visible = false; save.bags.push(b.i); doSave();
      addXP(150); sfx('pickup'); rumble(0.1, 0.2, 0.4);
      showMsg('PLECAK ZNALEZIONY', `${save.bags.length} / ${BAGS_N}   +150 PD`, 2.5);
    }
  }
}
