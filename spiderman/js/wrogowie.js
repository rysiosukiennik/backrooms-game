// Bandyci (zwykli, z bronia, osilki), przestepstwa, strzaly siecia, pociski, iskry, plecaki i doswiadczenie.
import { V3, rnd, clamp, damp, angLerp, save, doSave, cv, canvasTex, sr } from './util.js';
import { G, P, scene, camera, enemies, crimes } from './stan.js';
import { spots, supportAt, solidAt, raycastCity, rayN, roofs, scarePeds, glowTexture } from './miasto.js';
import { buildThug, el, newPose, zeroPose, blendPose, applyPose, idlePose, runPose, aimArm, flatMat, webMaterial, SUITS } from './postac.js';
import { hurtPlayer, mkLine, setLine } from './gracz.js';
import { bossHit, bossWeb, bossFinish } from './misje.js';
import { websToWrap, dmgMul, skillPoints } from './umiejetnosci.js';
import { sfx } from './dzwiek.js';
import { say, sayCtx } from './docinki.js';
import { rumble } from './wejscie.js';
import { initEfekty, updateEfekty, burst, webSplat, getRope, freeRope, wrapFX, muzzleFlash, bulletImpact } from './efekty.js';
export { burst };
import { showMsg, popText, hint } from './ui.js';

const _t = new V3(), _h = new V3(), _cf = new V3(), _a = new V3();

// ---------------------------------------------------------------- TRUDNOSC wrogow (jedno miejsce do strojenia)
// Wszystko ponizej mozna zmieniac bez ruszania reszty kodu. "Bylo" = wartosc sprzed rundy 5.
export const DIFF = {
  hp: 1.4,            // mnoznik zdrowia (bylo 1.0): bandyta 6, strzelec 4, osilek 14; plus hpLvl za kazdy poziom gracza
  hpLvl: 0.03,        // +3% zdrowia na poziom gracza (maks. 10 poziomow)
  speed: 1.2,         // predkosc biegu wrogow (bylo 1.0): bandyta 5.0 m/s, osilek 3.8 m/s
  dmg: 1.15,          // obrazenia wrogow (bylo 1.0): bandyta 11.5, osilek 29, pocisk 8
  cd: 0.65,           // mnoznik przerw miedzy atakami (bylo 1.0; mniej = czesciej)
  windup: 0.8,        // mnoznik czasu zamachu / reakcji (bylo 1.0); zamach nie spada ponizej 0.44 s, wiec unik/kontra nadal dziala
  aim: 0.8,           // mnoznik czasu celowania strzelca (bylo 0.75 s -> 0.6 s)
  spread: 0.55,       // mnoznik rozrzutu chybien strzelcow (bylo 1.0)
  hitBase: 0.85,      // bazowa szansa trafienia strzelca (bylo 0.75)
  lead: 0.8,          // 0..1: jak bardzo celuja z wyprzedzeniem (w predkosc gracza; bujanie nie daje juz takiej ochrony)
  cover: 0.55,        // szansa, ze strzelec po strzale schowa sie za przeszkoda / przykucnie
  meleeMax: 2,        // ilu wrogow z bronia biala atakuje naraz (reszta okrazaja); +1 od poziomu 6
  shooterMax: 2,      // ilu strzelcow celuje naraz; +1 od poziomu 6
  orbit: 3.2,         // promien okrazania gracza przez oczekujacych [m]
  bruteStun: 1.6,     // czas ogluszenia osilka siecia [s] (bylo 2.5)
  bruteHurtBlock: 0.35, // szansa, ze osilek zablokuje cios takze tuz po trafieniu (przerywa kombo); w innych chwilach blokuje zawsze
  bruteHurt: 0.28,    // czas "zachwiania" osilka po trafieniu [s] (bylo 0.4)
  extraPerLvl: 3,     // +1 wrog w przestepstwie na kazde tyle poziomow gracza (maks. +4); bylo +1 na 4 poziomy (maks. +2)
  brute2Lvl: 6,       // od tego poziomu w przestepstwie moze byc 2 osilkow
  regenFight: 0.35,   // mnoznik odnawiania zdrowia gracza, gdy wrog jest w poblizu (bylo 1.0)
};
const lvlHp = () => 1 + DIFF.hpLvl * Math.min(10, save.lvl - 1);
let nMelee = 0, nShoot = 0; // ile wrogow ma teraz "zezwolenie na atak" (liczone co klatke)
// mnoznik regeneracji zdrowia gracza (gracz.js): w walce goi sie wolniej
export function regenMul() { return enemies.some(e => !e.dead && !e.gone && e.state !== 'idle' && e.type !== 'boss' && e.pos.distanceTo(P.pos) < 30) ? DIFF.regenFight : 1; }

// ---------------------------------------------------------------- doswiadczenie
export const need = l => 600 + l * 400;
let saveT = 0;
export function addXP(n) {
  save.xp += n; let up = false;
  while (save.xp >= need(save.lvl)) { save.xp -= need(save.lvl); save.lvl++; up = true; }
  if (up) {
    sfx('level'); say('levelup', true);
    const nu = SUITS.filter(s => s.lvl === save.lvl).map(s => s.name);
    showMsg('AWANS! POZIOM ' + save.lvl, (nu.length ? 'Nowy strój: ' + nu.join(', ') + ' · ' : '') + `Punkty umiejętności: ${skillPoints()} (Pauza → Umiejętności)`, 4);
    doSave();
  }
  saveT = 3;
}

// ---------------------------------------------------------------- iskry (czasteczki)
const trGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true); trGeo.translate(0, 0.5, 0);
const trMat = new THREE.MeshBasicMaterial({ color: 0xffe08a });
const tracers = [];
let shotGeo, shotMat, glowTex;

export function initFX() {
  initEfekty();
  shotGeo = new THREE.SphereGeometry(0.1, 8, 6); shotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  glowTex = glowTexture('rgba(255,230,120,1)', 'rgba(255,200,60,0)');
}
export function tracer(a, b) {
  let t = tracers.find(q => q.life <= 0);
  if (!t) { t = { m: mkLine(trMat), life: 0 }; tracers.push(t); }
  setLine(t.m, a, b); t.life = 0.07;
}
export function updateFX(dt) {
  updateEfekty(dt);
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
  const best = webTarget(); sayCtx('web', { enemy: best });
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
  shots.push({ m, tr: getRope(), pos: _h.clone(), target: best, pt, n, life: 2, hit: 0 });
  P.webT = 0.28; P.webAim.copy(pt);
  if (P.state === 'ground' && !P.atk) P.heading = Math.atan2(pt.x - P.pos.x, pt.z - P.pos.z);
  sfx('thwip');
}
export function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt;
    if (s.hit > 0) { // po trafieniu nic jeszcze chwile napiete, a potem znika
      s.hit -= dt; P.H.handR.getWorldPosition(_h); if (s.target && !s.target.gone) s.pt.set(s.target.pos.x, s.target.pos.y + 1.0 * (s.target.scale || 1), s.target.pos.z);
      if (s.hit <= 0) { freeRope(s.tr); shots.splice(i, 1); } else s.tr.set(_h, s.pt, 0.9, s.hit * 2);
      continue;
    }
    if (s.target && !s.target.gone) s.pt.set(s.target.pos.x, s.target.pos.y + (1.1 - s.target.down * 0.8) * (s.target.scale || 1), s.target.pos.z);
    _t.subVectors(s.pt, s.pos); const d = _t.length(), st = 85 * dt;
    let done = false;
    if (d <= st + 0.2) {
      s.pos.copy(s.pt); done = true;
      if (s.target) webHit(s.target); else if (s.n) { webSplat(s.pt, s.n); sfx('splat', 0.4); }
    } else s.pos.addScaledVector(_t, st / d);
    s.m.position.copy(s.pos);
    P.H.handR.getWorldPosition(_a); s.tr.set(_a, s.pos, 0.85, 0.25);
    if (done) { scene.remove(s.m); s.hit = 0.22; }
    else if (s.life <= 0) { scene.remove(s.m); freeRope(s.tr); shots.splice(i, 1); }
  }
}
function webHit(e) {
  if (e.gone) return;
  burst(e.pos.x, e.pos.y + 1.1, e.pos.z, 12, 0xffffff, 3); sfx('splat'); addXP(5); wrapFX(e);
  if (e.type === 'boss') { (e.webFn || bossWeb)(e); return; }
  e.webs++; e.webT = 6;
  if (e.type === 'brute') {
    e.stunT = DIFF.bruteStun; if (!e.dead) { e.state = 'hurt'; e.t = 0.4; }
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
  say('finisher');
  burst(e.pos.x, e.pos.y + 1, e.pos.z, 30, 0xffffff, 6); wrapFX(e, true);
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
    H, type, wpn, cocoon, blob, pos: new V3(), vel: new V3(), yaw: rnd(0, 6.28), hp: Math.round((brute ? 10 : type === 'gun' ? 3 : 4) * DIFF.hp * lvlHp()), orbitDir: Math.random() < 0.5 ? 1 : -1, crouchT: 0, coverT: 0, losT: 0, los: true,
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
    if (bruteOK && brutes < (save.lvl >= DIFF.brute2Lvl ? 2 : 1) && Math.random() < (brutes === 0 ? 0.5 : 0.35)) { type = 'brute'; brutes++; }
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
  const n = 3 + Math.floor(Math.random() * 3) + Math.min(4, Math.floor(save.lvl / DIFF.extraPerLvl));
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
  sayCtx('hit', { enemy: e, fromAir });
  if (e.type === 'boss') return (e.hit || bossHit)(e, dmg * dmgMul(), launch);
  if (e.type === 'brute' && e.stunT <= 0 && !fromAir && (e.state !== 'hurt' || Math.random() < DIFF.bruteHurtBlock)) {
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
  else { e.state = 'hurt'; e.t = heavy ? DIFF.bruteHurt : 0.4; e.vel.set(kx, 0, kz); }
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
  // celowanie z wyprzedzeniem: punkt przed graczem (predkosc * ~0,25 s * lead)
  _t.x += P.vel.x * 0.25 * DIFF.lead; _t.y += P.vel.y * 0.12 * DIFF.lead; _t.z += P.vel.z * 0.25 * DIFF.lead;
  let ch = DIFF.hitBase - P.vel.length() / 55 * (1 - 0.5 * DIFF.lead) - d / 160; if (P.state === 'swing') ch -= 0.1;
  ch = clamp(ch, 0.12, DIFF.hitBase);
  const hit = Math.random() < ch && P.invT <= 0 && P.dodgeT <= 0;
  if (!hit) { const sp = DIFF.spread; _t.x += rnd(-2.5, 2.5) * sp; _t.y += rnd(-1, 2.5) * sp; _t.z += rnd(-2.5, 2.5) * sp; _t.sub(_h).multiplyScalar(1.6).add(_h); }
  tracer(_h, _t);
  _a.subVectors(_t, _h); const bl = _a.length(); if (bl > 0.1) {
    _a.divideScalar(bl); muzzleFlash(_h, _a);
    const rt = raycastCity(_h, _a, bl); // kula w sciane: iskry, rykoszet i slad
    if (rt < bl - 0.05) { _cf.copy(_h).addScaledVector(_a, rt); bulletImpact(_cf, rayN); }
    else if (hit) burst(_t.x, _t.y, _t.z, 4, 0xffd070, 2);
  }
  sfx('shot', clamp(1.2 - d / 80, 0.15, 1));
  if (e.pos.y < 3) scarePeds(e.pos.x, e.pos.z);
  if (hit) hurtPlayer(7 * DIFF.dmg, e);
}

export function updateEnemies(dt) {
  G.sense = false;
  nMelee = 0; nShoot = 0; // "zezwolenia na atak": ilu juz zamachuje sie / celuje (koordynacja grupy)
  for (const e of enemies) if (!e.dead && !e.air) { if (e.state === 'windup' || e.state === 'recover') nMelee++; else if (e.state === 'aim') nShoot++; }
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
            const sp = (e.type === 'brute' ? 3.2 : 4.2) * DIFF.speed * slow, big = e.type === 'brute';
            const canAtk = nMelee < DIFF.meleeMax + (save.lvl >= 6 ? 1 : 0); // reszta okrazaja gracza
            if (!canAtk && dist < 14 && e.cd > -0.5) { // czeka na swoja kolej: kraza wokol gracza po okregu
              const k = dist > 0.1 ? 1 / dist : 0, rx = dx * k, rz = dz * k, rad = (dist - DIFF.orbit * R) * 0.8;
              moveEnemy(e, (rx * rad - rz * e.orbitDir * sp * 0.8), (rz * rad + rx * e.orbitDir * sp * 0.8), dt); e.moving = true;
              if (e.cd < 0.2) e.cd = 0.2; // gotowy do ataku, jak tylko zwolni sie miejsce
            } else {
              if (dist > 1.4 * R) { moveEnemy(e, dx / dist * sp, dz / dist * sp, dt); e.moving = true; }
              if (dist < 1.9 * R && e.cd <= 0 && P.state !== 'wall' && canAtk) { e.state = 'windup'; e.t = Math.max(0.44, (big ? 0.8 : 0.55) * DIFF.windup); nMelee++; if (Math.random() < 0.5) e.orbitDir = -e.orbitDir; }
            }
          }
        } else {
          // strzelec: kryje sie / kuca po strzale, potem wychyla sie, gdy ma linie strzalu
          if (e.crouchT > 0) { e.crouchT -= dt; break; }
          if (e.coverT > 0) { e.coverT -= dt; if (e.coverDir) { moveEnemy(e, e.coverDir.x * 5 * DIFF.speed * slow, e.coverDir.z * 5 * DIFF.speed * slow, dt); e.moving = true; } if (e.coverT <= 0) { e.coverDir = null; e.crouchT = rnd(0.5, 1.0); } break; }
          e.losT -= dt;
          if (e.losT <= 0 && d3 < 70) { // linia strzalu (sprawdzana co ~0,3 s)
            e.losT = 0.3; _h.set(e.pos.x, e.pos.y + 1.4, e.pos.z); _t.set(P.pos.x - _h.x, P.pos.y + 1.2 - _h.y, P.pos.z - _h.z); const L = _t.length(); _t.divideScalar(L);
            e.los = raycastCity(_h, _t, L) >= L - 1.0;
          }
          if (dist < 5 && dist > 0.1) { moveEnemy(e, -dx / dist * 2.5 * DIFF.speed * slow, -dz / dist * 2.5 * DIFF.speed * slow, dt); e.moving = true; }
          else if (!e.los && dist > 3) { // brak linii: obchodzi przeszkode bokiem i zblizaja sie
            const k = 1 / dist; moveEnemy(e, (dx * 0.6 - dz * e.orbitDir * 0.8) * k * 4 * DIFF.speed * slow, (dz * 0.6 + dx * e.orbitDir * 0.8) * k * 4 * DIFF.speed * slow, dt); e.moving = true;
          }
          if (e.cd <= 0 && d3 < 65 && e.los) { if (nShoot < DIFF.shooterMax + (save.lvl >= 6 ? 1 : 0)) { e.state = 'aim'; e.t = 0.75 * DIFF.aim; nShoot++; } else e.cd = 0.25; }
        }
        break;
      case 'windup':
        face(); e.t -= dt; G.sense = true;
        if (e.t <= 0) {
          const big = e.type === 'brute';
          if (dist < 2.4 * R && Math.abs(dy) < 1.8) hurtPlayer((big ? 25 : 10) * DIFF.dmg, e, big ? 16 : 6);
          if (big) { G.shake = Math.max(G.shake, 0.3); sfx('slam', 0.5); burst(e.pos.x, e.pos.y + 0.2, e.pos.z, 16, 0xbdb5a8, 5); }
          e.state = 'recover'; e.t = (big ? 0.8 : 0.45) * (0.5 + 0.5 * DIFF.windup); e.cd = rnd(1.2, 2.4) * DIFF.cd;
        }
        break;
      case 'aim':
        face(); e.t -= dt; if (e.t < 0.5) G.sense = true;
        if (e.t <= 0) {
          fireAt(e, d3); e.state = 'fight'; e.cd = rnd(1.6, 3.2) * DIFF.cd;
          if (Math.random() < DIFF.cover) { // po strzale: schowaj sie za przeszkoda (jesli jest blisko) albo przykucnij
            let found = null; const a0 = Math.random() * 6.28;
            for (let k = 0; k < 8 && !found; k++) {
              const a = a0 + k * 0.785, cx = Math.sin(a), cz = Math.cos(a);
              _h.set(e.pos.x + cx * 3.5, e.pos.y + 1.4, e.pos.z + cz * 3.5); if (solidAt(_h.x, _h.y, _h.z)) continue;
              _t.set(P.pos.x - _h.x, P.pos.y + 1.2 - _h.y, P.pos.z - _h.z); const L = _t.length(); _t.divideScalar(L);
              if (raycastCity(_h, _t, L) < L - 1.0) found = { x: cx, z: cz };
            }
            if (found) { e.coverDir = found; e.coverT = 0.7; } else e.crouchT = rnd(0.6, 1.1);
            e.los = false; e.losT = 0.5;
          }
        }
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
      if (e.crouchT > 0 && !e.moving) { t.by = -0.4; t.hLx = -1.3; t.kL = 1.9; t.hRx = -1.1; t.kR = 1.7; t.bp = 0.4; } // kuca za oslona
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
        sfx('win'); showMsg('PRZESTĘPSTWO UDAREMNIONE', '+300 PD', 3); say('crime');
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
      addXP(150); sfx('pickup'); say('bag'); rumble(0.1, 0.2, 0.4);
      showMsg('PLECAK ZNALEZIONY', `${save.bags.length} / ${BAGS_N}   +150 PD`, 2.5);
    }
  }
}
