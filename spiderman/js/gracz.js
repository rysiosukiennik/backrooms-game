// Spider-Man: ruch (bieg, skok, bujanie, bieg po scianach, zip, zaczep), walka (kombo, wybicie,
// kombo w powietrzu, wykonczenia, uniki), triki i animacja.
import { V3, UP, clamp, lerp, damp, angLerp, save, doSave } from './util.js';
import { G, P, cam, scene, camera, enemies } from './stan.js';
import { supportAt, boxesNear, raycastCity, LAND, START, START_H, roofs, perches, nearestDoor } from './miasto.js';
import { enterDoor, leaveInterior, nearExit } from './wnetrza.js';
import { buildSpider, newPose, zeroPose, blendPose, applyPose, idlePose, runPose, crouchPose, tuckPose, aimArm, basisQ, SUITS, suitById } from './postac.js';
import { hitEnemy, shootWeb, burst, finishEnemy, addXP } from './wrogowie.js';
import { carPunch, carLeave } from './misje.js';
import { has, maxHp, swingMul, zipMax, perchRange } from './umiejetnosci.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, flashDamage, popText } from './ui.js';

const GRAV = 27;
const _t = new V3(), _h = new V3(), _f = new V3(), _u = new V3(), _q = new THREE.Quaternion(), _cf = new V3();
const GROUND = { y1: 0, street: true };

// ---------------------------------------------------------------- nici pajeczyny
const webGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 5, 1, true); webGeo.translate(0, 0.5, 0);
const webLineMat = new THREE.MeshBasicMaterial({ color: 0xf6f6f6 });
export function mkLine(mat) { const m = new THREE.Mesh(webGeo, mat || webLineMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; }
export function setLine(m, a, b) {
  _t.subVectors(b, a); const L = _t.length(); if (L < 1e-4) { m.visible = false; return; }
  m.position.copy(a); m.quaternion.setFromUnitVectors(UP, _t.divideScalar(L)); m.scale.set(1, L, 1); m.visible = true;
}
let lineMain, lineZ1, lineZ2;

export function initPlayer() {
  P.pc = newPose(); P.pt = newPose();
  lineMain = mkLine(); lineZ1 = mkLine(); lineZ2 = mkLine();
  setSuit(save.suit);
  placeAtStart();
  P.hp = maxHp();
}
export function setSuit(id) {
  let s = suitById(id) || SUITS[0];
  if (s.lvl > save.lvl) s = SUITS[0];
  let q = null;
  if (P.H) { q = P.H.root.quaternion.clone(); scene.remove(P.H.root); }
  P.H = buildSpider(s); P.suit = s;
  if (q) P.H.root.quaternion.copy(q);
  P.H.root.position.copy(P.pos);
  scene.add(P.H.root);
  save.suit = s.id; doSave();
}
export function placeAtStart() {
  P.pos.copy(START); P.vel.set(0, 0, 0); P.state = 'ground'; P.heading = START_H; P.perch = true;
  P.H.root.position.copy(P.pos);
  basisQ(P.H.root.quaternion, UP, _f.set(Math.sin(P.heading), 0, Math.cos(P.heading)));
}
export function addFocus(v) { P.focus = Math.min(3, P.focus + v * (has('focus') ? 1.5 : 1)); }

// ---------------------------------------------------------------- kolizje gracza
const _cl = [], _res = { top: null, wall: null };
function collide() {
  const r = 0.35, p = P.pos; _res.top = null; _res.wall = null;
  boxesNear(p.x, p.z, 3, _cl);
  for (const b of _cl) {
    if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r && p.y < b.y1 && p.y + 1.7 > b.y0) {
      if (P.prev.y >= b.y1 - 0.3) { p.y = b.y1; if (P.vel.y < 0) P.vel.y = 0; _res.top = b; }
      else {
        const a = p.x - (b.x0 - r), c = (b.x1 + r) - p.x, d = p.z - (b.z0 - r), e = (b.z1 + r) - p.z, m = Math.min(a, c, d, e);
        const n = new V3();
        if (m === a) { p.x = b.x0 - r; n.set(-1, 0, 0); } else if (m === c) { p.x = b.x1 + r; n.set(1, 0, 0); }
        else if (m === d) { p.z = b.z0 - r; n.set(0, 0, -1); } else { p.z = b.z1 + r; n.set(0, 0, 1); }
        const vn = P.vel.dot(n); if (vn < 0) P.vel.addScaledVector(n, -vn);
        _res.wall = { b, n };
      }
    }
  }
  if (p.y <= 0) { p.y = 0; if (P.vel.y < 0) P.vel.y = 0; _res.top = _res.top || GROUND; }
  if (p.x < LAND.x0 + 1 || p.x > LAND.x1 - 1) { p.x = clamp(p.x, LAND.x0 + 1, LAND.x1 - 1); P.vel.x *= -0.2; }
  if (p.z < LAND.z0 + 1 || p.z > LAND.z1 - 1) { p.z = clamp(p.z, LAND.z0 + 1, LAND.z1 - 1); P.vel.z *= -0.2; }
  return _res;
}

// ---------------------------------------------------------------- zaczep: najlepszy punkt w polu widzenia
export function findPerch() {
  const R = perchRange(); camera.getWorldDirection(_cf);
  let best = null, bs = -1e9;
  for (const p of perches) {
    const dx = p.x - P.pos.x, dz = p.z - P.pos.z; if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
    const dy = p.y - P.pos.y; if (dy < -20) continue;
    const d = Math.hypot(dx, dy, dz); if (d < 12 || d > R) continue;
    _t.set(p.x - camera.position.x, p.y - camera.position.y, p.z - camera.position.z);
    const dot = _t.dot(_cf) / _t.length(); if (dot < 0.93) continue;
    const sc = dot * 4 - d / R + clamp(dy / 30, -0.5, 0.5); if (sc > bs) { bs = sc; best = p; }
  }
  if (best) {
    _h.set(P.pos.x, P.pos.y + 1.5, P.pos.z); _t.set(best.x, best.y + 0.8, best.z).sub(_h);
    const L = _t.length(); _t.divideScalar(L);
    if (raycastCity(_h, _t, L) < L - 1.5) best = null;
  }
  return best;
}
function nearestEnemy(r) {
  let best = null, bd = r;
  for (const e of enemies) { if (e.dead || e.gone) continue; const d = e.pos.distanceTo(P.pos); if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------------------------------------------------------------- aktualizacja
export function updatePlayer(dt, I) {
  P.invT -= dt; P.hurtT = Math.max(0, P.hurtT - dt); P.atkCD -= dt; P.comboT -= dt; P.dodgeCD -= dt;
  P.swingCD -= dt; P.webCD -= dt; P.webT -= dt; P.zipT -= dt; P.landT = Math.max(0, P.landT - dt); P.bufPunch -= dt;
  P.perchT -= dt; P.trickCD -= dt;
  if (P.trickT > 0) P.trickT -= dt;
  if (P.comboT <= 0) { P.combo = 0; P.step = 0; }
  if (P.dodgeT > 0) P.dodgeT -= dt;
  if (P.flipT >= 0) { P.flipT += dt; if (P.flipT >= P.flipDur) { P.flipT = -1; P.pc.bp = 0; } }
  const mh = maxHp();
  P.regenT -= dt; if (P.regenT <= 0 && P.hp < mh) P.hp = Math.min(mh, P.hp + (has('regen') ? 28 : 14) * dt);
  if (P.dead) { P.deadT -= dt; if (P.deadT <= 0) respawn(); return; }

  // kierunek ruchu wzgledem kamery
  const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw);
  let wx = -sy * (-I.my) + cy * I.mx, wz = -cy * (-I.my) - sy * I.mx;
  let wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; wl = 1; }
  if (P.state === 'ground' && wl > 0.1 && !P.atk && !P.lunge && !P.fin) P.heading = angLerp(P.heading, Math.atan2(wx, wz), damp(12, dt));

  // wykonczenie (animacja przejmuje ruch)
  if (P.fin) { stepFinisher(dt); return; }

  // cel zaczepu (do ikonki w HUD)
  const foe = nearestEnemy(5);
  P.finReady = !!(foe && P.focus >= 1);
  P.doorNear = (!G.interior && P.state === 'ground' && !foe) ? nearestDoor(P.pos.x, P.pos.y, P.pos.z) : null;
  P.exitNear = nearExit();
  P.perchPt = (P.state !== 'car' && P.state !== 'pz' && !P.finReady && !P.doorNear && !G.interior) ? findPerch() : null;

  if (I.specialP) {
    if (P.doorNear) enterDoor(P.doorNear);
    else if (P.exitNear && !P.finReady) leaveInterior();
    else if (P.finReady) startFinisher(foe);
    else if (P.perchPt) startPerchZip(P.perchPt);
  }
  if (I.dodgeP) startDodge(wx, wz, wl);
  if (I.punch) P.punchHold += dt; else { P.punchHold = 0; P.upDone = false; }
  if (P.punchHold > 0.32 && !P.upDone && P.state === 'ground') tryUppercut();
  if (I.punchP || (P.bufPunch > 0 && P.atkCD <= 0)) startPunch(wx, wz, wl);
  if (I.webP && P.webCD <= 0 && P.state !== 'pz') { P.webCD = 0.2; shootWeb(); }
  if (I.jumpP) doJump(wx, wz, wl);

  if (P.state === 'air' && I.swing && P.swingCD <= 0 && P.airT > 0.15 && P.vel.y < 5 && !P.lunge && !(P.atk && nearestEnemy(9))) tryAttach(wx, wz, wl);
  else if (P.state === 'swing') {
    P.swingT += dt;
    if (!I.swing) release(false);
    else {
      // automatyczne puszczanie sieci za punktem zaczepienia — trzymasz RT i bujasz sie dalej
      const hx = P.vel.x, hz = P.vel.z, hs = Math.hypot(hx, hz);
      if (hs > 6) {
        const along = ((P.anchor.x - P.pos.x) * hx + (P.anchor.z - P.pos.z) * hz) / hs;
        if (along < -P.rope * 0.55 && P.vel.y < 6) release(false);
      }
      if (P.state === 'swing' && P.swingT > 4) release(false);
    }
  }

  if (P.atk && !P.lunge) {
    const a = P.atk; a.t += dt;
    if (!a.hit && a.t >= a.dur * 0.42) { a.hit = true; landHit(a); }
    if (a.t >= a.dur) P.atk = null;
  }

  const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
  for (let k = 0; k < n; k++) step(h, I, wx, wz, wl);
  if (P.state !== 'ground') P.sprint = false;
  if (P.pos.y < -5) respawn();
}

function step(h, I, wx, wz, wl) {
  P.prev.copy(P.pos);

  if (P.state === 'car') {
    const c = P.car;
    if (!c || c.done) { P.state = 'air'; P.airT = 0.2; P.car = null; return; }
    P.pos.set(c.mesh.position.x, 1.55, c.mesh.position.z); P.vel.copy(c.vel); P.heading = c.yaw;
    return;
  }

  if (P.state === 'pz') { // lot do punktu zaczepu
    const z = P.pz; _t.subVectors(z.to, P.pos); const d = _t.length(), st = 52 * h;
    if (d <= st + 0.2) {
      P.pos.copy(z.to); P.vel.set(0, 0, 0);
      if (P.launchBuf > 0 || I.jump) pointLaunch(z.dir);
      else { P.state = 'ground'; P.perchT = 0.45; P.landT = 0.3; P.landHard = false; P.zips = zipMax(); }
    } else { P.vel.copy(_t).multiplyScalar(52 / d); P.pos.addScaledVector(P.vel, h); }
    return;
  }

  if (P.lunge) {
    const L = P.lunge, e = L.e; L.t += h;
    _t.set(e.pos.x - P.pos.x, e.pos.y - P.pos.y, e.pos.z - P.pos.z); const d = _t.length();
    if (d < 1.35 * (e.scale || 1) || L.t > 0.45 || e.dead) {
      P.lunge = null; P.vel.multiplyScalar(0.15);
      if (P.state !== 'ground') { P.state = 'air'; P.airT = 0.2; }
    } else {
      P.vel.copy(_t).multiplyScalar(26 / d);
      if (P.vel.y > 1 && P.state === 'ground') { P.state = 'air'; P.airT = 0.2; }
    }
    P.pos.addScaledVector(P.vel, h);
    const c = collide();
    if (c.top && P.vel.y <= 0.1) P.state = 'ground';
    else if (P.state === 'ground' && supportAt(P.pos.x, P.pos.z, P.pos.y + 0.4) < P.pos.y - 0.05) { P.state = 'air'; P.airT = 0.2; }
    return;
  }

  if (P.state === 'ground') {
    P.sprint = I.swing;
    const spd = P.sprint ? 17 : 9;
    let tx = wx * spd, tz = wz * spd;
    if (P.dodgeT > 0) { tx = P.dodgeDir.x * 15; tz = P.dodgeDir.z * 15; }
    else if (P.atk) { tx *= 0.1; tz *= 0.1; }
    else if (P.landT > 0 && P.landHard) { tx = 0; tz = 0; }
    const k = damp(wl > 0.1 ? 9 : 14, h);
    P.vel.x += (tx - P.vel.x) * k; P.vel.z += (tz - P.vel.z) * k; P.vel.y = 0;
    P.pos.x += P.vel.x * h; P.pos.z += P.vel.z * h;
    const c = collide();
    const sup = supportAt(P.pos.x, P.pos.z, P.pos.y + 0.4);
    if (sup < P.pos.y - 0.05) { P.state = 'air'; P.airT = 0; } else P.pos.y = sup;
    if (c.wall && P.sprint && wl > 0.3 && (wx * c.wall.n.x + wz * c.wall.n.z) / wl < -0.5) enterWall(c.wall.b, c.wall.n);
    return;
  }

  if (P.state === 'air') {
    P.airT += h; P.vel.y -= GRAV * h;
    if (P.atk && P.vel.y < -1.5) P.vel.y = -1.5; // zawis przy ciosach w powietrzu
    if (P.dodgeT > 0) { P.vel.x = P.dodgeDir.x * 14; P.vel.z = P.dodgeDir.z * 14; }
    else { P.vel.x += wx * 14 * h; P.vel.z += wz * 14 * h; }
    const hs = Math.hypot(P.vel.x, P.vel.z), cap = 55 * swingMul();
    if (hs > 14) { const dr = 1 - 0.1 * h; P.vel.x *= dr; P.vel.z *= dr; }
    if (hs > cap) { P.vel.x *= cap / hs; P.vel.z *= cap / hs; }
    if (P.vel.y < -75) P.vel.y = -75;
    const vy = P.vel.y;
    P.pos.addScaledVector(P.vel, h);
    const c = collide();
    if (c.top) land(-vy); else if (c.wall) wallContact(c.wall);
    return;
  }

  if (P.state === 'swing') {
    const sm = swingMul();
    P.vel.y -= 32 * h;
    P.vel.x += wx * 9 * h; P.vel.z += wz * 9 * h;
    const sp = P.vel.length();
    if (sp > 1 && sp < 38 * sm && P.vel.y < 0) P.vel.multiplyScalar(1 + 0.3 * sm * h); // pomoc w rozpedzaniu (tylko w dol)
    if (P.rope > P.ropeT) P.rope = Math.max(P.ropeT, P.rope - 14 * h);
    P.pos.addScaledVector(P.vel, h);
    _t.subVectors(P.pos, P.anchor); const L = _t.length();
    if (L > P.rope) {
      _t.divideScalar(L); P.pos.copy(P.anchor).addScaledVector(_t, P.rope);
      const vn = P.vel.dot(_t); if (vn > 0) P.vel.addScaledVector(_t, -vn);
    }
    if (sp > 65 * sm) P.vel.multiplyScalar(65 * sm / sp);
    const vy = P.vel.y;
    const c = collide();
    if (c.top) { P.state = 'air'; land(-vy); }
    else if (c.wall) { P.state = 'air'; wallContact(c.wall); }
    return;
  }

  if (P.state === 'wall') {
    const n = P.wallN, b = P.wallBox;
    const up = -I.my; let side = I.mx;
    if ((-Math.sin(cam.yaw)) * -n.x + (-Math.cos(cam.yaw)) * -n.z < -0.2) side = -side;
    P.climbSide = side;
    const spd = I.swing ? 16 : 7, tvy = up * spd;
    P.wallVy += (tvy - P.wallVy) * damp(Math.abs(tvy) > Math.abs(P.wallVy) ? 6 : 3, h);
    P.pos.y += P.wallVy * h;
    const rx = n.z, rz = -n.x;
    P.pos.x += rx * side * spd * 0.7 * h; P.pos.z += rz * side * spd * 0.7 * h;
    if (n.x > 0.5) P.pos.x = b.x1 + 0.3; else if (n.x < -0.5) P.pos.x = b.x0 - 0.3;
    else if (n.z > 0.5) P.pos.z = b.z1 + 0.3; else P.pos.z = b.z0 - 0.3;
    if (Math.abs(n.x) > 0.5) P.pos.z = clamp(P.pos.z, b.z0 + 0.2, b.z1 - 0.2); else P.pos.x = clamp(P.pos.x, b.x0 + 0.2, b.x1 - 0.2);
    P.vel.set(0, P.wallVy, 0);
    if (P.pos.y >= b.y1 - 0.1) { // wskakujemy na dach
      P.pos.y = b.y1 + 0.05; P.pos.addScaledVector(n, -0.9);
      P.state = 'air'; P.airT = 0; P.vel.set(-n.x * 5, 7, -n.z * 5);
      P.heading = Math.atan2(-n.x, -n.z);
      if (P.wallVy > 10) { P.flipT = 0; P.flipDur = 0.5; P.flipBack = false; }
    } else if (P.pos.y <= 0) { P.pos.y = 0; P.state = 'ground'; }
  }
}

function land(imp) {
  P.state = 'ground'; P.zips = zipMax(); P.flipT = -1; P.pc.bp = 0; P.trickT = 0;
  if (imp > 32) {
    P.landT = 0.45; P.landHard = true; G.shake = Math.max(G.shake, 0.45);
    rumble(0.25, 0.8, 0.5); sfx('land'); burst(P.pos.x, P.pos.y + 0.1, P.pos.z, 26, 0xcfc6b8, 6);
  } else if (imp > 12) { P.landT = 0.22; P.landHard = false; sfx('land', 0.35); }
}
function wallContact(w) {
  const b = w.b;
  if (b.y1 - P.pos.y < 1.6) { // krawedz blisko — podciagamy sie na dach
    P.pos.y = b.y1 + 0.02; P.pos.addScaledVector(w.n, -0.7);
    P.state = 'ground'; P.vel.y = 0; P.vel.multiplyScalar(0.5); return;
  }
  enterWall(b, w.n);
}
function enterWall(b, n) {
  const hs = Math.hypot(P.vel.x, P.vel.z);
  P.state = 'wall'; P.wallBox = b; P.wallN.copy(n);
  P.wallVy = clamp(Math.max(P.vel.y, 0) + hs * 0.5, 0, 22);
  P.vel.set(0, 0, 0); P.zips = zipMax(); P.flipT = -1; P.pc.bp = 0; P.lunge = null; P.trickT = 0;
  sfx('land', 0.2);
}

function doJump(wx, wz, wl) {
  if (P.state === 'car') { carLeave(); P.state = 'air'; P.airT = 0; P.vel.y += 11; P.car = null; P.flipT = 0; P.flipDur = 0.6; P.flipBack = true; return; }
  if (P.state === 'pz') { P.launchBuf = 0.5; return; }
  if (P.state === 'ground') {
    if (P.perchT > 0 && P.pz) { pointLaunch(P.pz.dir); return; }
    if (P.atk) return;
    P.state = 'air'; P.airT = 0; P.landT = 0; P.vel.y = P.sprint ? 15 : 12.5;
    if (P.sprint) { P.vel.x *= 1.1; P.vel.z *= 1.1; }
  } else if (P.state === 'swing') release(true);
  else if (P.state === 'wall') {
    const n = P.wallN;
    P.state = 'air'; P.airT = 0; P.vel.set(n.x * 11, 12, n.z * 11);
    P.heading = Math.atan2(n.x, n.z); P.flipT = 0; P.flipDur = 0.55; P.flipBack = true; P.swingCD = 0.25; sfx('whoosh');
  } else if (P.state === 'air' && P.zips > 0) { // wystrzal sieci do przodu (zip)
    P.zips--;
    const hs = Math.hypot(P.vel.x, P.vel.z); let dx, dz;
    if (wl > 0.2) { dx = wx / wl; dz = wz / wl; } else if (hs > 3) { dx = P.vel.x / hs; dz = P.vel.z / hs; } else { dx = Math.sin(P.heading); dz = Math.cos(P.heading); }
    const sp = Math.max(hs, 22);
    P.vel.x = dx * sp; P.vel.z = dz * sp; P.vel.y = Math.max(P.vel.y, 0) + 9;
    P.zipT = 0.28; P.zipPt.set(P.pos.x + dx * 16, P.pos.y + 5, P.pos.z + dz * 16);
    P.heading = Math.atan2(dx, dz); sfx('thwip');
  }
}

// ---- zaczep
function startPerchZip(p) {
  if (P.state === 'swing') release(false);
  const to = new V3(p.x, p.y + 0.05, p.z), dir = new V3().subVectors(to, P.pos); dir.y = 0;
  if (dir.lengthSq() < 0.01) dir.set(Math.sin(P.heading), 0, Math.cos(P.heading)); dir.normalize();
  P.pz = { to, dir }; P.state = 'pz'; P.launchBuf = 0; P.atk = null; P.lunge = null; P.flipT = -1; P.pc.bp = 0;
  P.heading = Math.atan2(dir.x, dir.z);
  sfx('thwip'); sfx('whoosh', 0.6); rumble(0.08, 0.2, 0.4);
}
function pointLaunch(dir) {
  P.state = 'air'; P.airT = 0.2; P.perchT = 0; P.launchBuf = 0;
  const up = has('swing2') ? 17 : 15;
  P.vel.set(dir.x * 24, up, dir.z * 24);
  P.flipT = 0; P.flipDur = 0.6; P.flipBack = false; P.zips = zipMax();
  sfx('whoosh'); addXP(3); popText('WYBICIE!');
}

// ---- walka
function tryUppercut() {
  const e = nearestEnemy(2.8);
  if (!e || e.type === 'boss') return;
  P.upDone = true; P.atk = { type: 4, t: 0, dur: 0.38, target: e, hit: false }; P.atkCD = 0.4;
  P.heading = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
}
function startPunch(wx, wz, wl) {
  if (P.state === 'car') { carPunch(); P.atk = { type: P.step++ % 2, t: 0, dur: 0.25, target: null, hit: true }; return; }
  if (P.atkCD > 0 || P.state === 'wall' || P.state === 'pz' || P.dodgeT > 0) { P.bufPunch = 0.25; return; }
  P.bufPunch = 0;
  let best = null, bs = 1e9;
  for (const e of enemies) {
    if (e.dead || e.gone) continue;
    _t.subVectors(e.pos, P.pos); const d = _t.length(); if (d > 9 + (e.scale || 1)) continue;
    let sc = d; if (wl > 0.2) sc -= ((_t.x * wx + _t.z * wz) / (d || 1)) * 3;
    if (sc < bs) { bs = sc; best = e; }
  }
  if (!best && P.state !== 'ground') { startTrick(); return; }
  const type = P.step % 4; P.step++;
  P.atk = { type, t: 0, dur: type === 3 ? 0.42 : 0.3, target: best, hit: false };
  P.atkCD = type === 3 ? 0.4 : 0.24;
  if (best) {
    P.heading = Math.atan2(best.pos.x - P.pos.x, best.pos.z - P.pos.z);
    if (P.pos.distanceTo(best.pos) > 1.6 * (best.scale || 1)) { if (P.state === 'swing') release(false); P.lunge = { e: best, t: 0 }; }
  }
  sfx('whoosh', 0.35);
}
function startTrick() {
  if (P.trickCD > 0) return;
  P.trickT = 0.55; P.trickType = Math.floor(Math.random() * 3); P.trickCD = 0.6;
  addXP(5); addFocus(0.05); popText(['TRIK!', 'SALTO!', 'SZPAGAT!'][P.trickType]); sfx('whoosh', 0.5);
}
function landHit(a) {
  const e = a.target; if (!e || e.dead) return;
  if (P.pos.distanceTo(e.pos) > 2.6 * (e.scale || 1)) return;
  _t.subVectors(e.pos, P.pos); _t.y = 0; _t.normalize();
  const fin = a.type === 3, up = a.type === 4;
  const r = hitEnemy(e, fin ? 2 : 1, _t.x * (fin ? 14 : 3), up ? 13 : fin ? 7 : 0, _t.z * (fin ? 14 : 3), up ? 'up' : fin, P.state !== 'ground');
  if (r === 'block') { P.vel.x -= _t.x * 5; P.vel.z -= _t.z * 5; P.combo = 0; return; }
  P.combo++; P.comboT = 2.5; addFocus(0.12);
  if (up) { P.vel.y = 0; }
}
function startFinisher(e) {
  P.focus -= 1; if (P.state === 'swing') release(false);
  const dir = new V3().subVectors(e.pos, P.pos); dir.y = 0; if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
  const to = e.pos.clone().addScaledVector(dir, 1.5 * (e.scale || 1)); to.y = supportAt(to.x, to.z, e.pos.y + 0.5);
  if (Math.abs(to.y - e.pos.y) > 0.5) to.copy(P.pos);
  P.fin = { e, t: 0, dur: 0.8, from: P.pos.clone(), to, done: false };
  P.atk = null; P.lunge = null; P.state = 'ground'; P.heading = Math.atan2(dir.x, dir.z);
  G.slowT = 0.9; sfx('fin'); rumble(0.3, 0.5, 0.8);
}
function stepFinisher(dt) {
  const F = P.fin; F.t += dt; const k = clamp(F.t / F.dur, 0, 1);
  P.pos.lerpVectors(F.from, F.to, k); P.pos.y += Math.sin(k * Math.PI) * 2.8;
  P.vel.set(0, 0, 0);
  if (k > 0.55 && !F.done) {
    F.done = true; finishEnemy(F.e);
    if (has('fin')) { let b = null, bd = 9; for (const e of enemies) { if (e === F.e || e.dead || e.gone || e.type === 'boss') continue; const d = e.pos.distanceTo(F.e.pos); if (d < bd) { bd = d; b = e; } } if (b) finishEnemy(b); }
    G.shake = 0.5;
  }
  if (k >= 1) { P.fin = null; P.state = supportAt(P.pos.x, P.pos.z, P.pos.y + 0.5) >= P.pos.y - 0.3 ? 'ground' : 'air'; P.pc.bp = 0; P.heading += Math.PI; }
}
function startDodge(wx, wz, wl) {
  if (P.dodgeCD > 0 || P.state === 'pz') return;
  if (P.state === 'car') { carLeave(); P.state = 'air'; P.airT = 0; P.vel.y += 6; P.car = null; return; }
  if (P.state === 'wall') { P.state = 'air'; P.airT = 0; P.vel.set(P.wallN.x * 5, 2, P.wallN.z * 5); P.dodgeCD = 0.4; return; }
  if (P.state === 'swing') release(false);
  if (wl > 0.2) P.dodgeDir.set(wx / wl, 0, wz / wl); else P.dodgeDir.set(-Math.sin(P.heading), 0, -Math.cos(P.heading));
  P.dodgeSide = (P.dodgeDir.x * Math.cos(P.heading) - P.dodgeDir.z * Math.sin(P.heading)) > 0 ? -1 : 1;
  P.dodgeT = 0.32; P.invT = Math.max(P.invT, 0.45); P.dodgeCD = 0.5; P.atk = null; P.lunge = null;
  for (const e of enemies) // idealny unik — spowolnienie czasu
    if (!e.dead && (e.state === 'windup' || e.state === 'aim') && e.pos.distanceTo(P.pos) < (e.state === 'aim' ? 70 : 5 * (e.scale || 1))) {
      G.slowT = has('sense') ? 1.2 : 0.6; addFocus(0.3); popText('IDEALNY UNIK!'); break;
    }
  sfx('whoosh');
  if (P.state === 'air') P.vel.y = Math.max(P.vel.y, 4);
}

function tryAttach(wx, wz, wl) {
  const hs = Math.hypot(P.vel.x, P.vel.z); let dx, dz;
  if (wl > 0.3) { dx = wx / wl; dz = wz / wl; } else if (hs > 4) { dx = P.vel.x / hs; dz = P.vel.z / hs; } else { dx = -Math.sin(cam.yaw); dz = -Math.cos(cam.yaw); }
  P.swingSide = -P.swingSide;
  const o = _h.set(P.pos.x, P.pos.y + 1.5, P.pos.z), base = Math.atan2(dx, dz);
  let best = null, bs = -1e9;
  for (const el of [0.95, 0.8, 1.1, 0.65, 1.25]) for (const az of [0, 0.3, -0.3, 0.6, -0.6]) {
    const a = base - az * P.swingSide;
    const d = _t.set(Math.sin(a) * Math.cos(el), Math.sin(el), Math.cos(a) * Math.cos(el));
    const t = raycastCity(o, d, 80);
    if (t < 80 && t > 9) {
      const y = o.y + d.y * t; if (y < P.pos.y + 5) continue;
      const sc = -Math.abs(t - 34) - Math.abs(el - 0.9) * 25 - Math.abs(az) * 12;
      if (sc > bs) { bs = sc; best = (best || new V3()).copy(o).addScaledVector(d, t); }
    }
  }
  if (!best) {
    // nad parkiem i niskimi domami: siec "w niebo", zeby nie spasc — ale tylko nisko,
    // inaczej dalo sie wspinac bez konca
    if (P.pos.y > 75) return;
    best = new V3(o.x + Math.sin(base) * Math.cos(0.9) * 34, Math.min(o.y + Math.sin(0.9) * 34, 95), o.z + Math.cos(base) * Math.cos(0.9) * 34);
  }
  P.anchor.copy(best); P.state = 'swing'; P.swingT = 0;
  P.rope = P.pos.distanceTo(best); P.ropeT = clamp(Math.min(P.rope, best.y - 2.5), 6, 90);
  if (hs < 18) { P.vel.x += dx * 8; P.vel.z += dz * 8; }
  P.zips = zipMax(); P.flipT = -1; P.pc.bp = 0; P.trickT = 0;
  sfx('thwip'); rumble(0.05, 0, 0.25);
}
function release(jump) {
  P.state = 'air'; P.airT = 0.2; P.swingCD = 0.12;
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (jump) {
    P.vel.y = Math.max(P.vel.y, 0) + (has('swing2') ? 15 : 12);
    if (hs > 1) { P.vel.x += P.vel.x / hs * 5; P.vel.z += P.vel.z / hs * 5; }
    P.flipT = 0; P.flipDur = 0.6; P.flipBack = false; sfx('whoosh');
  } else if (P.vel.y > 0) {
    P.vel.y += 1.5;
    if (hs > 1) { P.vel.x += P.vel.x / hs * 2; P.vel.z += P.vel.z / hs * 2; }
    if (hs > 22 && Math.random() < 0.35) { P.flipT = 0; P.flipDur = 0.6; P.flipBack = false; }
  }
}

export function hurtPlayer(dmg, from, knock = 6) {
  if (P.invT > 0 || P.dead || P.dodgeT > 0 || P.fin || G.state !== 'play') return false;
  P.hp -= dmg; P.invT = 0.6; P.hurtT = 0.3; P.regenT = 4; P.combo = 0; P.atk = null; P.lunge = null;
  flashDamage(); rumble(0.25, 0.7, 0.5); sfx('hurt'); G.shake = Math.max(G.shake, 0.25 + knock / 60);
  if (P.state === 'car') { carLeave(); P.state = 'air'; P.car = null; }
  if (from) {
    _t.subVectors(P.pos, from.pos); _t.y = 0; _t.normalize(); P.vel.x += _t.x * knock; P.vel.z += _t.z * knock;
    if (knock > 10) { P.state = 'air'; P.airT = 0.2; P.vel.y = 8; P.flipT = 0; P.flipDur = 0.6; P.flipBack = true; }
  }
  if (P.hp <= 0) { P.hp = 0; P.dead = true; P.deadT = 2.6; if (P.state !== 'ground') P.state = 'air'; showMsg('SPIDER-MAN POKONANY', 'Za chwilę wracasz do gry...', 2.4); }
  return true;
}
export function respawn() {
  if (G.interior) leaveInterior(true);
  let best = null, bd = 1e9;
  for (const r of roofs) {
    if (r.y1 < 25 || r.y1 > 120) continue;
    const d = Math.hypot((r.x0 + r.x1) / 2 - P.pos.x, (r.z0 + r.z1) / 2 - P.pos.z);
    if (d < bd) { bd = d; best = r; }
  }
  if (best) P.pos.set((best.x0 + best.x1) / 2, best.y1, (best.z0 + best.z1) / 2); else P.pos.copy(START);
  P.vel.set(0, 0, 0); P.state = 'ground'; P.hp = maxHp(); P.dead = false; P.invT = 2; P.atk = null; P.lunge = null; P.flipT = -1; P.fin = null; P.car = null; P.focus = 0;
  P.pc.bp = 0; P.pc.br = 0; P.pc.bw = 0;
  cam.tgt.copy(P.pos);
}

// ---------------------------------------------------------------- wyglad i animacja
function buildPose(t, dt, hs) {
  if (P.perch && (G.state !== 'play' || G.cine)) { crouchPose(t); return; }
  if (P.dead) { t.sLz = 1.3; t.sRz = -1.3; t.hLz = 0.2; t.hRz = -0.2; t.bp = -0.4; return; }
  if (P.fin) { tuckPose(t); t.sRx = -2.6; t.sLx = -2.6; t.eL = -0.2; t.eR = -0.2; return; }
  switch (P.state) {
    case 'car':
      t.by = -0.45; t.hLx = -1.6; t.kL = 2.2; t.hRx = -0.4; t.kR = 1.8; t.hLz = 0.35; t.hRz = -0.4; t.bp = 0.5;
      t.sLz = 0.8; t.sRx = -1.0; t.eR = -0.4; t.hx = -0.5;
      break;
    case 'pz':
      t.hLx = -1.2; t.kL = 1.8; t.hRx = -1.0; t.kR = 1.6; t.bp = 0.3; t.hx = -0.3;
      break;
    case 'ground':
      if (P.perchT > 0) crouchPose(t);
      else if (P.landT > 0) {
        if (P.landHard) { t.by = -0.42; t.hLx = -1.5; t.kL = 2.1; t.hRx = 0.3; t.kR = 1.9; t.bp = 0.55; t.sRx = -1.0; t.sRz = -0.2; t.sLz = 0.9; t.sLx = 0.3; t.hx = -0.5; }
        else { t.by = -0.2; t.hLx = -0.7; t.kL = 1.2; t.hRx = -0.5; t.kR = 1; t.bp = 0.25; t.sLz = 0.4; t.sRz = -0.4; }
      } else if (hs > 0.6) { P.runPh += dt * (hs * 1.05 + 1.5); runPose(t, P.runPh, Math.min(1, hs / 9), P.sprint && hs > 11); }
      else idlePose(t, G.time);
      break;
    case 'air':
      if (P.vel.y > 2) { t.hLx = -1.3; t.kL = 1.9; t.hRx = 0.35; t.kR = 0.7; t.sLz = 1.1; t.sRz = -1.1; t.sLx = -0.4; t.sRx = 0.3; t.eL = -0.6; t.eR = -0.6; t.bp = 0.15; }
      else {
        const dive = clamp(-P.vel.y / 45, 0, 1);
        t.sLz = 1.7; t.sRz = -1.7; t.eL = -0.4; t.eR = -0.4; t.hLz = 0.3; t.hRz = -0.3;
        t.hLx = -0.35 + dive * 0.3; t.kL = 0.9 - dive * 0.5; t.hRx = 0.2; t.kR = 0.5; t.bp = dive * 1.1; t.hx = -dive * 0.7;
      }
      if (P.trickT > 0 && P.trickType === 2) { t.hLz = 1.4; t.hRz = -1.4; t.kL = 0; t.kR = 0; t.hLx = 0; t.hRx = 0; t.sLz = 2.6; t.sRz = -2.6; t.bp = 0; }
      break;
    case 'swing':
      t.hLx = -0.75; t.kL = 1.1; t.hRx = -0.45; t.kR = 0.8; t.hLz = 0.06; t.hRz = -0.06; t.hx = -0.25;
      if (P.vel.y > 4) { t.hLx = -0.2; t.kL = 0.3; t.hRx = -0.1; t.kR = 0.2; }
      if (P.swingSide > 0) { t.sLz = 1.0; t.sLx = 0.6; t.eL = -0.5; } else { t.sRz = -1.0; t.sRx = 0.6; t.eR = -0.5; }
      break;
    case 'wall': {
      const v = Math.abs(P.wallVy);
      if (v > 9) { P.runPh += dt * v * 1.1; runPose(t, P.runPh, 1, false); t.bp = 0.1; }
      else {
        P.climbPh += dt * (v * 1.5 + Math.abs(P.climbSide) * 6);
        const s = Math.sin(P.climbPh);
        t.by = -0.45; t.hLz = 0.9; t.hRz = -0.9; t.hLx = 0.3 + s * 0.35; t.hRx = 0.3 - s * 0.35; t.kL = 0.9; t.kR = 0.9;
        t.sLx = -1.1 + s * 0.4; t.sRx = -1.1 - s * 0.4; t.sLz = 0.5; t.sRz = -0.5; t.eL = -0.6; t.eR = -0.6; t.hx = -0.7;
      }
      break;
    }
  }
  if (P.flipT >= 0 || P.dodgeT > 0 || (P.trickT > 0 && P.trickType < 2)) tuckPose(t);
  if (P.atk) attackPose(t, P.atk);
  if (P.lunge) { t.sRx = -1.4; t.sLx = 0.6; t.bp = 0.35; t.hLx = -0.9; t.kL = 1.2; t.hRx = 0.4; t.kR = 0.6; }
  if (P.hurtT > 0) { t.bp -= 0.35; t.hx += 0.25; }
}
function attackPose(t, a) {
  const k = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI);
  switch (a.type) {
    case 0: t.sLx = lerp(-0.6, -1.65, k); t.eL = lerp(-1.8, -0.05, k); t.sLz = 0.1; t.sRx = -0.7; t.eR = -1.9; t.spy = -0.4 * k; t.hLx = -0.4; t.kL = 0.4; t.hRx = 0.35; t.kR = 0.3; t.by = -0.08; break;
    case 1: t.sRx = lerp(-0.6, -1.65, k); t.eR = lerp(-1.8, -0.05, k); t.sRz = -0.1; t.sLx = -0.7; t.eL = -1.9; t.spy = 0.4 * k; t.hRx = -0.4; t.kR = 0.4; t.hLx = 0.35; t.kL = 0.3; t.by = -0.08; break;
    case 2: t.hRx = lerp(0, -1.7, k); t.kR = lerp(1, 0.05, k); t.bp = -0.3 * k; t.sLz = 0.8; t.sRz = -0.8; t.spy = 0.3 * k; t.kL = 0.25; break;
    case 3: t.hRz = -1.3 * k; t.hRx = -0.3; t.kR = 0.2; t.sLz = 1.2; t.sRz = -1.2; t.by = 0.15 * k; t.kL = 0.5; t.hLx = -0.4; break;
    case 4: t.sRx = lerp(0.4, -2.9, k); t.eR = lerp(-2, -0.1, k); t.by = lerp(-0.35, 0.1, k); t.hLx = -0.8 * (1 - k); t.kL = 1.2 * (1 - k); t.bp = -0.2 * k; t.sLz = 0.6; break;
  }
}

export function updatePlayerVisual(dt) {
  const H = P.H; H.root.position.copy(P.pos);
  const hs = Math.hypot(P.vel.x, P.vel.z);
  const up = _u.set(0, 1, 0), fw = _f.set(Math.sin(P.heading), 0, Math.cos(P.heading));
  if (P.state === 'swing') {
    up.subVectors(P.anchor, P.pos).normalize().lerp(UP, 0.2).normalize();
    if (P.vel.lengthSq() > 4) fw.copy(P.vel).normalize();
  } else if (P.state === 'wall') { up.copy(P.wallN); fw.set(0, 1, 0); }
  else if (P.state === 'air' && hs > 3 && !P.lunge && !P.atk) { fw.set(P.vel.x, 0, P.vel.z).normalize(); P.heading = Math.atan2(fw.x, fw.z); }
  basisQ(_q, up, fw);
  H.root.quaternion.slerp(_q, damp(P.state === 'swing' ? 9 : 14, dt));

  const t = P.pt; zeroPose(t); buildPose(t, dt, hs);
  blendPose(P.pc, t, damp(P.atk ? 26 : 14, dt));
  // obroty "na calego" ustawiamy wprost, zeby salto nie cofalo sie przy wygladzaniu
  if (P.fin) P.pc.bp = clamp(P.fin.t / P.fin.dur, 0, 1) * Math.PI * 2;
  else if (P.flipT >= 0) P.pc.bp = clamp(P.flipT / P.flipDur, 0, 1) * Math.PI * 2 * (P.flipBack ? -1 : 1);
  else if (P.trickT > 0 && P.trickType === 1) P.pc.bp = (1 - P.trickT / 0.55) * Math.PI * 2;
  if (P.dodgeT > 0) { P.pc.br = P.dodgeSide * (1 - P.dodgeT / 0.32) * Math.PI * 2; P.rolling = true; }
  else if (P.rolling) { P.rolling = false; P.pc.br = 0; }
  if (P.atk && P.atk.type === 3) { P.pc.bw = clamp(P.atk.t / P.atk.dur, 0, 1) * Math.PI * 2; P.spinning = true; }
  else if (P.trickT > 0 && P.trickType === 0) { P.pc.bw = (1 - P.trickT / 0.55) * Math.PI * 4; P.spinning = true; }
  else if (P.spinning) { P.spinning = false; P.pc.bw = 0; }
  if (!P.fin && P.flipT < 0 && !(P.trickT > 0 && P.trickType === 1) && Math.abs(P.pc.bp) > 3) P.pc.bp = 0;
  applyPose(H, P.pc);
  // dlonie: piesc w walce, gest "thwip" przy strzelaniu siecia i bujaniu
  const fight = P.atk || P.lunge || P.fin || P.state === 'car' || P.punchHold > 0;
  const webR = P.webT > 0 || P.zipT > 0 || P.state === 'pz' || (P.state === 'swing' && P.swingSide > 0);
  const webL = P.zipT > 0 || P.state === 'pz' || (P.state === 'swing' && P.swingSide < 0);
  H.setHands(fight ? 'fist' : webL ? 'thwip' : 'open', fight ? 'fist' : webR ? 'thwip' : 'open');

  H.root.updateMatrixWorld(true);
  if (P.state === 'swing') aimArm(H, P.swingSide > 0 ? 'R' : 'L', P.anchor, 1);
  if (P.webT > 0) aimArm(H, 'R', P.webAim, 1);
  if (P.zipT > 0) { aimArm(H, 'R', P.zipPt, 1); aimArm(H, 'L', P.zipPt, 1); }
  if (P.state === 'pz') { aimArm(H, 'R', P.pz.to, 1); aimArm(H, 'L', P.pz.to, 1); }
  H.root.updateMatrixWorld(true);

  if (P.state === 'swing') { (P.swingSide > 0 ? H.handR : H.handL).getWorldPosition(_h); setLine(lineMain, _h, P.anchor); }
  else lineMain.visible = false;
  const two = P.zipT > 0 ? P.zipPt : P.state === 'pz' ? P.pz.to : null;
  if (two) { H.handR.getWorldPosition(_h); setLine(lineZ1, _h, two); H.handL.getWorldPosition(_h); setLine(lineZ2, _h, two); }
  else lineZ1.visible = lineZ2.visible = false;
  H.root.visible = !(P.hurtT > 0 && Math.floor(P.hurtT * 30) % 2 === 0);
}
