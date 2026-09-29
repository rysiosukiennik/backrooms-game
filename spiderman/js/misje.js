// Misje: boss Nosorozec w Central Parku, wyscigi przez pierscienie (wyzwania) i poscigi za autem zlodziei.
import { V3, rnd, clamp, damp, angLerp, save, doSave, cv } from './util.js';
import { G, P, scene, enemies } from './stan.js';
import { ARENA, NX, NZ, isecPos, inPark, glowTexture } from './miasto.js';
import { buildBoss, newPose, zeroPose, blendPose, applyPose, runPose } from './postac.js';
import { hurtPlayer } from './gracz.js';
import { addXP, burst, spawnStreetThugs, removeEnemy } from './wrogowie.js';
import { sfx, setMusicMode } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, popText, hint } from './ui.js';

const _t = new V3();
export const fmtTime = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ================================================================ BOSS: NOSOROZEC
let boss = null, bossWait = 0;
function makeBoss() {
  const H = buildBoss(); H.setHands('fist', 'fist');
  H.root.scale.setScalar(1.75); scene.add(H.root);
  return {
    H, type: 'boss', name: 'NOSOROŻEC', pos: new V3(ARENA.x, 0, ARENA.z - 20), vel: new V3(), yaw: 0, hp: 60, max: 60,
    st: 'walk', t: 0, cd: 2, webs: 0, dead: false, gone: false, air: false, down: 0, scale: 1.75, state: 'fight',
    dir: new V3(), pc: newPose(), pt: newPose(), ph: 0, deadT: 0,
  };
}
const vulnerable = b => b.st === 'tired' || b.st === 'stun';
export function bossHit(b, dmg) {
  if (b.dead) return false;
  if (!vulnerable(b)) {
    burst(b.pos.x, b.pos.y + 2.5, b.pos.z, 10, 0x9fd8ff, 4); sfx('block'); popText('PANCERZ!');
    hint('boss', 'Nosorożec ma pancerz! Zrób unik przed szarżą — po niej jest zmęczony. Albo 3 razy trafiaj go siecią.');
    return 'block';
  }
  b.hp -= dmg * 2; burst(b.pos.x, b.pos.y + 2.2, b.pos.z, 14, 0xfff2c0, 5); sfx('punch'); G.shake = Math.max(G.shake, 0.2); rumble(0.1, 0.5, 0.5);
  addXP(8);
  if (b.hp <= 0) bossDefeated(b);
  return true;
}
export function bossWeb(b) {
  if (b.dead) return;
  b.webs++; popText(`SIEĆ ${b.webs}/3`);
  if (b.webs >= 3 && b.st !== 'stun') { b.st = 'stun'; b.t = 3.5; b.webs = 0; popText('NOSOROŻEC OGŁUSZONY!'); sfx('win', 0.5); }
}
export function bossFinish(b) {
  b.hp -= 10; b.st = 'stun'; b.t = 2.2; popText('WYKOŃCZENIE!');
  if (b.hp <= 0) bossDefeated(b);
}
function bossDefeated(b) {
  b.dead = true; b.hp = 0; b.deadT = 0; b.st = 'down';
  save.bossWins++; addXP(1500); doSave();
  sfx('level'); showMsg('NOSOROŻEC POKONANY!', '+1500 PD · Wróci za 2 minuty na rewanż', 5);
  G.slowT = 1.2; G.shake = 0.6;
}
function startBoss() {
  boss = makeBoss(); enemies.push(boss);
  showMsg('NOSOROŻEC', 'Unikaj szarży, a gdy się zmęczy — bij! Sieć też go ogłusza.', 4.5);
  sfx('alarm');
}
function updateBoss(dt) {
  if (!boss) {
    bossWait -= dt;
    const d = Math.hypot(P.pos.x - ARENA.x, P.pos.z - ARENA.z);
    if (bossWait <= 0 && d < 45 && P.pos.y < 30 && !G.race) startBoss();
    G.boss = null; return;
  }
  const b = boss, H = b.H;
  G.boss = b.dead ? null : b;
  if (b.dead) {
    b.deadT += dt; b.down += (1 - b.down) * damp(4, dt);
    if (b.deadT > 12) { removeEnemy(b); boss = null; bossWait = 120; }
  } else {
    if (P.dead) { removeEnemy(b); boss = null; bossWait = 3; G.boss = null; return; }
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
    if (Math.hypot(P.pos.x - ARENA.x, P.pos.z - ARENA.z) > 160) { removeEnemy(b); boss = null; bossWait = 2; showMsg('NOSOROŻEC UCIEKŁ', 'Wróć do Central Parku, żeby dokończyć walkę', 3); return; }
    const face = k => { b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(k, dt)); };
    b.t -= dt; b.cd -= dt;
    switch (b.st) {
      case 'walk':
        face(5);
        if (dist > 4) { b.pos.x += dx / dist * 3.4 * dt; b.pos.z += dz / dist * 3.4 * dt; }
        if (dist < 5 && b.cd <= 0) { b.st = 'slamW'; b.t = 0.8; }
        else if (dist > 9 && b.cd <= 0) { b.st = 'chargeW'; b.t = 1.0; }
        break;
      case 'chargeW':
        face(6); G.sense = true;
        if (b.t <= 0) { b.st = 'charge'; b.t = 2.3; b.dir.set(dx, 0, dz).normalize(); sfx('slam', 0.4); }
        break;
      case 'charge':
        b.pos.addScaledVector(b.dir, 25 * dt); b.yaw = Math.atan2(b.dir.x, b.dir.z);
        if (Math.random() < 0.5) burst(b.pos.x, 0.2, b.pos.z, 2, 0x8a7a5a, 3);
        if (dist < 3 && Math.abs(P.pos.y - b.pos.y) < 3) { if (hurtPlayer(25, b, 18)) { b.st = 'tired'; b.t = 2.5; } }
        if (b.t <= 0 || Math.hypot(b.pos.x - ARENA.x, b.pos.z - ARENA.z) > 70) {
          b.st = 'tired'; b.t = 3; G.shake = Math.max(G.shake, 0.3); sfx('slam', 0.6); burst(b.pos.x, 0.5, b.pos.z, 20, 0x8a7a5a, 6);
          popText('JEST ZMĘCZONY — BIJ!');
        }
        break;
      case 'slamW': face(4); G.sense = true;
        if (b.t <= 0) {
          b.st = 'slam'; b.t = 0.5; sfx('slam'); G.shake = Math.max(G.shake, 0.6); rumble(0.3, 1, 0.6);
          for (let i = 0; i < 30; i++) { const a = i / 30 * 6.283; burst(b.pos.x + Math.cos(a) * 3, 0.3, b.pos.z + Math.sin(a) * 3, 1, 0xbdb5a8, 5); }
          if (dist < 6.5 && P.pos.y - b.pos.y < 1.5) hurtPlayer(18, b, 12);
        }
        break;
      case 'slam': if (b.t <= 0) { b.st = 'walk'; b.cd = 1.8; } break;
      case 'tired': case 'stun': if (b.t <= 0) { b.st = 'walk'; b.cd = 1.2; } break;
    }
    b.pos.y = 0;
  }
  // animacja
  const t = b.pt; zeroPose(t);
  if (b.dead) { t.sLz = 1.3; t.sRz = -1.3; }
  else switch (b.st) {
    case 'walk': b.ph += dt * 6; runPose(t, b.ph, 0.7, false); t.sLz = 0.5; t.sRz = -0.5; break;
    case 'chargeW': t.by = -0.3; t.bp = 0.7; t.hLx = -0.9; t.kL = 1.3; t.hRx = 0.4; t.kR = 0.5; t.sLx = 0.8; t.sRx = 0.8; t.hx = -0.5; break;
    case 'charge': b.ph += dt * 16; runPose(t, b.ph, 1, true); t.bp = 0.8; t.hx = -0.6; break;
    case 'slamW': t.sLx = -2.9; t.sRx = -2.9; t.eL = -0.3; t.eR = -0.3; t.bp = -0.25; break;
    case 'slam': t.sLx = -1.1; t.sRx = -1.1; t.bp = 0.7; t.by = -0.35; t.kL = 1; t.kR = 1; t.hLx = -0.7; t.hRx = -0.7; break;
    case 'tired': t.bp = 0.75; t.by = -0.2; t.sLx = -0.9; t.sRx = -0.9; t.eL = -0.2; t.eR = -0.2; t.kL = 0.6; t.kR = 0.6; t.hLx = -0.4; t.hRx = -0.4; t.hx = 0.2 + Math.sin(G.time * 8) * 0.08; break;
    case 'stun': t.bp = 0.2; t.spy = Math.sin(G.time * 3) * 0.4; t.hx = 0.4; t.sLz = 0.3; t.sRz = -0.3; break;
  }
  blendPose(b.pc, t, damp(b.st === 'slam' ? 25 : 10, dt)); applyPose(H, b.pc);
  H.root.position.copy(b.pos); H.root.position.y += 0.2 * b.down;
  H.root.rotation.set(-Math.PI / 2 * b.down, b.yaw, 0, 'YXZ');
}

// ================================================================ WYSCIGI PRZEZ PIERSCIENIE
const RACES = [
  { id: 'mid', name: 'MIDTOWN', route: [[3, 12, 28], [3, 9, 35], [6, 9, 40], [6, 11, 30], [8, 11, 25], [8, 14, 30], [4, 14, 35], [4, 12, 25]] },
  { id: 'park', name: 'WOKÓŁ PARKU', route: [[1, 1, 20], [7, 1, 25], [7, 3, 30], [6, 3, 25], [6, 8, 30], [2, 8, 35], [2, 1, 30], [1, 1, 22]] },
  { id: 'fin', name: 'DOLNY MANHATTAN', route: [[1, 15, 30], [1, 17, 40], [5, 17, 35], [5, 15, 45], [7, 15, 30], [7, 18, 25], [3, 18, 30], [3, 16, 40]] },
];
const ringGeo = new THREE.TorusGeometry(4.5, 0.32, 8, 40);
let race = null;
function buildRaces() {
  for (const R of RACES) {
    R.pts = [];
    for (let k = 0; k < R.route.length - 1; k++) {
      const [i0, j0, h0] = R.route[k], [i1, j1, h1] = R.route[k + 1];
      const [x0, z0] = isecPos(i0, j0), [x1, z1] = isecPos(i1, j1);
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 45));
      for (let s = 0; s < n; s++) { const f = s / n; R.pts.push(new V3(x0 + (x1 - x0) * f, h0 + (h1 - h0) * f, z0 + (z1 - z0) * f)); }
    }
    const [xe, ze] = isecPos(R.route[R.route.length - 1][0], R.route[R.route.length - 1][1]);
    R.pts.push(new V3(xe, R.route[R.route.length - 1][2], ze));
    let len = 0; for (let k = 1; k < R.pts.length; k++) len += R.pts[k].distanceTo(R.pts[k - 1]);
    R.par = len / 30;
    R.rings = R.pts.map((p, k) => {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: k === 0 ? 0xffc93c : 0x3fe3ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.position.copy(p);
      const nx = R.pts[Math.min(k + 1, R.pts.length - 1)], pv = R.pts[Math.max(k - 1, 0)];
      m.lookAt(_t.copy(p).add(nx).sub(pv).normalize().add(p));
      m.visible = k === 0; scene.add(m); return m;
    });
    R.start = R.pts[0];
  }
}
function updateRaces(dt) {
  const t = G.time;
  if (!race) {
    for (const R of RACES) {
      const r0 = R.rings[0]; r0.visible = !G.boss && !G.chase; r0.rotation.z = t; r0.material.color.setHex(0xffc93c);
      if (r0.visible && P.pos.distanceTo(R.start) < 5.5) {
        race = { R, idx: 1, t: 0 }; sfx('ring');
        R.rings.forEach((m, k) => { m.visible = k >= 1 && k <= 3; m.material.color.setHex(0x3fe3ff); });
        for (const O of RACES) if (O !== R) O.rings[0].visible = false;
        const best = save.races[R.id];
        showMsg('WYZWANIE: ' + R.name, `Przeleć przez wszystkie pierścienie! Złoto: ${fmtTime(R.par)}${best ? ' · Twój rekord: ' + fmtTime(best) : ''}`, 3.5);
        break;
      }
    }
    G.race = null; return;
  }
  const R = race.R; race.t += dt;
  G.race = { name: R.name, t: race.t, idx: race.idx, n: R.pts.length - 1, par: R.par };
  const next = R.pts[race.idx];
  R.rings.forEach((m, k) => {
    m.visible = k >= race.idx && k <= race.idx + 3;
    m.material.opacity = k === race.idx ? 0.95 : 0.35; m.scale.setScalar(k === race.idx ? 1 + Math.sin(t * 8) * 0.05 : 1);
  });
  if (_t.set(P.pos.x, P.pos.y + 1, P.pos.z).distanceTo(next) < 5.5) {
    race.idx++; sfx('ring'); addXP(5);
    if (race.idx >= R.pts.length) { finishRace(); return; }
  }
  if (race.t > R.par * 3 || P.pos.distanceTo(next) > 260 || P.dead) {
    showMsg('WYZWANIE PRZERWANE', 'Spróbuj jeszcze raz — wróć do żółtego pierścienia', 3); endRace();
  }
}
function finishRace() {
  const R = race.R, s = race.t, best = save.races[R.id];
  const medal = s <= R.par ? 'ZŁOTO' : s <= R.par * 1.3 ? 'SREBRO' : 'BRĄZ';
  const xp = medal === 'ZŁOTO' ? 400 : medal === 'SREBRO' ? 250 : 120;
  if (!best || s < best) save.races[R.id] = s;
  doSave(); addXP(xp); sfx('win');
  showMsg(`${medal}! ${fmtTime(s)}`, `${R.name} · +${xp} PD${!best || s < best ? ' · NOWY REKORD!' : ''}`, 4);
  endRace();
}
function endRace() { race.R.rings.forEach((m, k) => { m.visible = k === 0; m.scale.setScalar(1); m.material.opacity = 0.85; }); race = null; G.race = null; }

// ================================================================ POSCIG ZA AUTEM
let chase = null, chaseWait = 45, police = null;
function carMesh(body, stripe) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.6), new THREE.MeshStandardMaterial({ color: body, metalness: 0.5, roughness: 0.3 })); b.position.y = 0.75;
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 2.3), new THREE.MeshStandardMaterial({ color: 0x11161c, metalness: 0.6, roughness: 0.15 })); c.position.set(0, 1.45, -0.2);
  const s = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 4.62), new THREE.MeshStandardMaterial({ color: stripe })); s.position.y = 0.95;
  g.add(b, c, s);
  const wm = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  for (const [x, z] of [[1, 1.5], [-1, 1.5], [1, -1.5], [-1, -1.5]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), wm); w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w); }
  const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xfff2d0, blending: THREE.AdditiveBlending, depthWrite: false })); hl.position.set(0, 0.8, 2.4); hl.scale.set(3, 1.5, 1); g.add(hl);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  scene.add(g); return g;
}
function pickNext(c) {
  const opts = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const i = c.i + di, j = c.j + dj;
    if (i < 0 || i > NX || j < 0 || j > NZ) continue;
    if (i === c.pi && j === c.pj) continue;
    const [x0, z0] = isecPos(c.i, c.j), [x1, z1] = isecPos(i, j);
    if (inPark((x0 + x1) / 2, (z0 + z1) / 2)) continue;
    opts.push([i, j]);
  }
  if (!opts.length) opts.push([c.pi, c.pj]);
  const [i, j] = opts[Math.floor(Math.random() * opts.length)];
  c.pi = c.i; c.pj = c.j; c.i = i; c.j = j;
}
export function startChase() {
  let i, j, tries = 0;
  do { i = Math.floor(Math.random() * (NX + 1)); j = Math.floor(Math.random() * (NZ + 1)); const [x, z] = isecPos(i, j); const d = Math.hypot(x - P.pos.x, z - P.pos.z); if (d > 120 && d < 320 && !inPark(x, z)) break; } while (++tries < 60);
  const [x, z] = isecPos(i, j);
  chase = { i, j, pi: -1, pj: -1, pos: new V3(x, 0, z), vel: new V3(), yaw: 0, hp: 6, t: 0, done: false, doneT: 0, mesh: carMesh(0x7a0d12, 0x111111), trail: [] };
  pickNext(chase);
  police = { mesh: carMesh(0x1b2a55, 0xf2f2f2), red: null, blue: null };
  const mk = c => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, blending: THREE.AdditiveBlending, depthWrite: false })); s.scale.set(2.2, 2.2, 1); police.mesh.add(s); return s; };
  police.red = mk(0xff2020); police.red.position.set(0.5, 2, -0.2); police.blue = mk(0x2060ff); police.blue.position.set(-0.5, 2, -0.2);
  showMsg('POŚCIG!', 'Złodzieje uciekają autem. Wskocz na dach i bij, żeby je zatrzymać!', 4); sfx('alarm');
}
export function carPunch() {
  const c = chase; if (!c || c.done) return;
  c.hp--; burst(c.pos.x, 1.8, c.pos.z, 12, 0xfff2c0, 4); sfx('punch'); G.shake = Math.max(G.shake, 0.2); rumble(0.08, 0.4, 0.4);
  popText(`AUTO ${Math.max(0, c.hp)}/6`);
  if (c.hp <= 0) {
    c.done = true; c.vel.set(0, 0, 0); sfx('crash'); G.shake = 0.6; burst(c.pos.x, 1, c.pos.z, 40, 0x555555, 6);
    const side = new V3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
    spawnStreetThugs(c.pos.x + side.x * 3, c.pos.z + side.z * 3, 2 + (save.lvl > 3 ? 1 : 0));
    save.chases++; addXP(400); doSave();
    showMsg('AUTO ZATRZYMANE!', '+400 PD · Teraz pokonaj złodziei!', 3.5);
    P.state = 'air'; P.airT = 0.2; P.vel.set(-side.x * 4, 10, -side.z * 4); P.car = null; P.flipT = 0; P.flipDur = 0.6; P.flipBack = true;
  }
}
export function carLeave() { hint('car', 'Wskocz znowu na dach auta, żeby dalej je bić.'); }
function updateChase(dt) {
  if (!chase) {
    chaseWait -= dt;
    if (chaseWait <= 0 && !G.boss && !G.race && G.state === 'play') { startChase(); chaseWait = rnd(70, 110); }
    G.chase = null; return;
  }
  const c = chase; c.t += dt;
  if (!c.done) {
    const [tx, tz] = isecPos(c.i, c.j);
    const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
    if (d < 1) { c.pos.x = tx; c.pos.z = tz; pickNext(c); }
    else {
      const sp = 20, ux = dx / d, uz = dz / d;
      c.vel.set(ux * sp, 0, uz * sp);
      c.pos.x += ux * Math.min(sp * dt, d); c.pos.z += uz * Math.min(sp * dt, d);
      c.yaw = angLerp(c.yaw, Math.atan2(ux, uz), damp(8, dt));
    }
    c.trail.push([c.pos.x, c.pos.z, c.yaw]); if (c.trail.length > 60) c.trail.shift();
    // prawy pas
    const ox = Math.cos(c.yaw) * -3.2, oz = -Math.sin(c.yaw) * -3.2;
    c.mesh.position.set(c.pos.x + ox, 0, c.pos.z + oz); c.mesh.rotation.y = c.yaw;
    // wskakiwanie na dach
    if (P.state !== 'car' && !P.dead && P.state !== 'pz' && !P.fin) {
      const px = P.pos.x - c.mesh.position.x, pz = P.pos.z - c.mesh.position.z, py = P.pos.y;
      if (Math.hypot(px, pz) < 3.2 && py > 0.5 && py < 5.5) {
        P.state = 'car'; P.car = c; P.atk = null; P.lunge = null; P.flipT = -1; P.pc.bp = 0; sfx('land', 0.5);
        hint('car', 'Jesteś na dachu! Bij, żeby zatrzymać auto (skok = zeskocz).');
      }
    }
    if (c.t > 80) { showMsg('ZŁODZIEJE UCIEKLI...', 'Następnym razem szybciej!', 3); endChase(); return; }
  } else {
    c.doneT += dt; if (Math.random() < 0.3) burst(c.mesh.position.x, 1.8, c.mesh.position.z, 1, 0x333333, 1.5);
    if (c.doneT > 20) { endChase(); return; }
  }
  if (police) {
    const tr = c.trail[0] || [c.pos.x, c.pos.z, c.yaw];
    const ox = Math.cos(tr[2]) * -3.2, oz = -Math.sin(tr[2]) * -3.2;
    police.mesh.position.set(tr[0] + ox, 0, tr[1] + oz); police.mesh.rotation.y = tr[2];
    const on = Math.floor(G.time * 6) % 2 === 0; police.red.visible = on; police.blue.visible = !on;
  }
  G.chase = c.done ? null : { pos: c.mesh.position, hp: c.hp, t: c.t };
}
function endChase() {
  if (P.car === chase) { P.state = 'air'; P.car = null; }
  scene.remove(chase.mesh); if (police) scene.remove(police.mesh);
  chase = null; police = null; G.chase = null;
}

// ================================================================ wspolne
export function initMissions() { buildRaces(); }
export function updateMissions(dt) {
  updateBoss(dt); updateRaces(dt); updateChase(dt);
  // muzyka dopasowana do akcji
  let m = 'calm';
  if (G.boss) m = 'boss';
  else if (G.chase || G.race || enemies.some(e => !e.dead && e.crime && e.crime.alert && e.pos.distanceTo(P.pos) < 70)) m = 'fight';
  setMusicMode(m);
}
export function missionList() {
  const L = [];
  L.push({ id: 'boss', icon: 'boss', name: 'NOSOROŻEC', x: ARENA.x, z: ARENA.z,
    desc: 'Opancerzony osiłek szaleje w Central Parku. Unikaj szarży i bij, gdy się zmęczy.',
    status: boss && !boss.dead ? 'WALKA TRWA!' : bossWait > 0 ? `Wraca za ${Math.ceil(bossWait)} s` : save.bossWins ? `Pokonany ${save.bossWins}× · dostępny rewanż` : 'Dostępny — idź na polanę w parku' });
  for (const R of RACES) {
    const b = save.races[R.id];
    L.push({ id: 'race-' + R.id, icon: 'race', name: 'WYZWANIE: ' + R.name, x: R.start.x, z: R.start.z,
      desc: `Przeleć przez ${R.pts.length - 1} pierścieni jak najszybciej. Złoto poniżej ${fmtTime(R.par)}.`,
      status: b ? `Rekord ${fmtTime(b)} · ${b <= R.par ? 'ZŁOTO' : b <= R.par * 1.3 ? 'SREBRO' : 'BRĄZ'}` : 'Jeszcze nieukończone' });
  }
  L.push({ id: 'chase', icon: 'chase', name: 'POŚCIGI', x: chase ? chase.mesh.position.x : null, z: chase ? chase.mesh.position.z : null,
    desc: 'Co jakiś czas złodzieje uciekają autem. Wskocz na dach i zatrzymaj ich.',
    status: chase && !chase.done ? 'POŚCIG TRWA!' : `Zatrzymane auta: ${save.chases}` });
  return L;
}
