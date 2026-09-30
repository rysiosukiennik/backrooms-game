// Misja: Wilson Fisk (Kingpin) w Fisk Tower. Wchodzisz przez drzwi wiezowca, pokonujesz straz, potem Kingpina.
// Kingpin blokuje ciosy z przodu — trzeba go zajsc od tylu albo poczekac, az zmeczy sie po ataku.
import { V3, damp, angLerp, save, doSave } from './util.js';
import { G, P, scene, enemies, crimes } from './stan.js';
import { buildKingpin, newPose, zeroPose, blendPose, applyPose, runPose } from './postac.js';
import { hurtPlayer } from './gracz.js';
import { addXP, burst, makeCrime, removeEnemy } from './wrogowie.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, popText, hint } from './ui.js';
import { playCine } from './scenki.js';

let F = null; // { R, boss, phase: 'intro'|'guards'|'boss'|'done', crime, p2 }

function makeKingpin(R) {
  const H = buildKingpin(); H.root.scale.setScalar(1.1); scene.add(H.root);
  const pos = new V3(R.o[0], R.o[1], R.o[2] - 8.2);
  const b = {
    H, type: 'boss', name: 'KINGPIN', pos, vel: new V3(), yaw: 0, hp: 90, max: 90, st: 'idle', t: 0, cd: 2, webs: 0, dead: false, gone: false, air: false,
    down: 0, scale: 1.25, state: 'fight', dir: new V3(), pc: newPose(), pt: newPose(), ph: 0, deadT: 0, R,
    hit: fiskHit, webFn: fiskWeb, finFn: fiskFinish,
  };
  H.root.position.copy(pos); return b;
}
const behind = b => { // czy gracz jest za plecami Kingpina
  const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, l = Math.hypot(dx, dz) || 1;
  return (dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)) / l < -0.2;
};
const vulnerable = b => b.st === 'tired' || b.st === 'stun' || behind(b);
function fiskHit(b, dmg) {
  if (b.dead) return false;
  if (!vulnerable(b)) {
    burst(b.pos.x, b.pos.y + 2.6, b.pos.z, 8, 0x9fd8ff, 3); sfx('block'); popText('BLOK!');
    hint('fisk', 'Kingpin blokuje ciosy z przodu. Zajdź go od tyłu (unik + bieg za plecy) albo poczekaj, aż zmęczy się po ataku!');
    return 'block';
  }
  b.hp -= dmg * 1.6; burst(b.pos.x, b.pos.y + 2.4, b.pos.z, 14, 0xfff2c0, 5); sfx('punch'); rumble(0.1, 0.5, 0.5); G.shake = Math.max(G.shake, 0.2); addXP(8);
  if (b.hp <= 0) defeated(b);
  return true;
}
function fiskWeb(b) {
  if (b.dead) return;
  b.webs++; popText(`SIEĆ ${b.webs}/3`);
  if (b.webs >= 3 && b.st !== 'stun') { b.st = 'stun'; b.t = 3.5; b.webs = 0; popText('KINGPIN OGŁUSZONY!'); sfx('win', 0.5); }
}
function fiskFinish(b) { b.hp -= 12; b.st = 'stun'; b.t = 2; popText('WYKOŃCZENIE!'); if (b.hp <= 0) defeated(b); }

function defeated(b) {
  b.dead = true; b.hp = 0; b.st = 'down'; b.deadT = 0;
  save.fisk = (save.fisk || 0) + 1; addXP(2500); doSave();
  sfx('level'); G.slowT = 1.2; G.shake = 0.6; F.phase = 'done';
  setTimeout(() => { if (G.interior && !G.cine) playCine('fiskEnd', { b: b.pos, onEnd: () => showMsg('KINGPIN POKONANY!', '+2500 PD · Wyjdź drzwiami na południu', 5) }); }, 900);
}

export function startFisk(R) {
  abortFisk();
  F = { R, boss: makeKingpin(R), phase: 'intro', crime: null, p2: false };
  playCine('fisk', { b: F.boss.pos, onEnd: () => spawnGuards(2 + (save.lvl > 3 ? 1 : 0)) });
}
function spawnGuards(n, big = true) {
  const R = F.R, o = R.o;
  const cr = makeCrime(o[0] - 8, o[0] + 8, o[2] - 3, o[2] + 3, o[1], null, n + 2, big);
  cr.alert = true; for (const e of cr.list) e.state = 'fight';
  F.crime = cr; F.phase = F.phase === 'boss' ? 'boss' : 'guards';
  showMsg(F.phase === 'boss' ? 'KINGPIN WZYWA STRAŻ' : 'STRAŻ KINGPINA', F.phase === 'boss' ? 'Pokonaj ich, ale nie odwracaj się od Kingpina!' : 'Pokonaj ochroniarzy, zanim dotrzesz do Fiska.', 3.5);
}
function startBossFight() { F.phase = 'boss'; F.boss.st = 'walk'; F.boss.cd = 1.5; enemies.push(F.boss); showMsg('KINGPIN', 'Blokuje z przodu — zachodź go od tyłu!', 4); sfx('alarm'); }
export function abortFisk() {
  if (!F) return;
  const f = F; F = null;
  if (f.crime) for (const e of f.crime.list) removeEnemy(e);
  if (f.crime) { const i = crimes.indexOf(f.crime); if (i >= 0) crimes.splice(i, 1); }
  if (enemies.includes(f.boss)) removeEnemy(f.boss); else scene.remove(f.boss.H.root);
  if (G.boss === f.boss) G.boss = null;
}

export function updateFisk(dt) {
  if (!F) return;
  if (!G.interior || P.dead) { abortFisk(); return; }
  const b = F.boss, H = b.H, R = F.R, o = R.o;
  if (F.phase === 'guards' && F.crime && F.crime.list.every(e => e.dead)) { F.phase = 'intro2'; playCine('fisk2', { b: b.pos, onEnd: startBossFight }); }
  if (F.phase === 'boss' || F.phase === 'done') G.boss = b.dead ? null : b;
  if (F.phase === 'boss' && !F.p2 && b.hp <= b.max * 0.5 && !b.dead) { F.p2 = true; spawnGuards(1, false); }
  const t = b.pt; zeroPose(t);
  if (b.dead) { b.deadT += dt; b.down += (1 - b.down) * damp(3, dt); t.bp = 0.5; t.sLz = 0.8; t.sRz = -0.8; }
  else if (F.phase === 'boss') {
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
    const face = k => { b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(k, dt)); };
    b.t -= dt; b.cd -= dt;
    switch (b.st) {
      case 'walk': face(4);
        if (dist > 3.5) { b.pos.x += dx / dist * 2.6 * dt; b.pos.z += dz / dist * 2.6 * dt; }
        if (dist < 4.6 && b.cd <= 0) { b.st = 'caneW'; b.t = 0.9; }
        else if (dist > 9 && b.cd <= 0) { b.st = 'chargeW'; b.t = 1.1; }
        else if (b.cd <= 0 && dist < 9) { b.st = 'stompW'; b.t = 1.1; }
        break;
      case 'caneW': face(6); G.sense = true; if (b.t <= 0) { b.st = 'cane'; b.t = 0.45; sfx('slam', 0.7); G.shake = Math.max(G.shake, 0.4); burst(b.pos.x, b.pos.y + 1, b.pos.z, 20, 0xffe3a0, 6); if (dist < 6 && Math.abs(P.pos.y - b.pos.y) < 2.5) hurtPlayer(20, b, 14); } break;
      case 'cane': if (b.t <= 0) { b.st = 'tired'; b.t = 2.8; popText('KINGPIN ZMĘCZONY — BIJ!'); } break;
      case 'stompW': face(5); G.sense = true; if (b.t <= 0) { b.st = 'stomp'; b.t = 0.5; sfx('slam'); G.shake = Math.max(G.shake, 0.6); rumble(0.3, 1, 0.6); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; burst(b.pos.x + Math.cos(a) * 3, b.pos.y + 0.2, b.pos.z + Math.sin(a) * 3, 1, 0xbdb5a8, 5); } if (dist < 8 && P.pos.y - b.pos.y < 1.4) hurtPlayer(16, b, 12); } break;
      case 'stomp': if (b.t <= 0) { b.st = 'walk'; b.cd = 1.6; } break;
      case 'chargeW': face(6); G.sense = true; if (b.t <= 0) { b.st = 'charge'; b.t = 1.5; b.dir.set(dx, 0, dz).normalize(); sfx('slam', 0.4); } break;
      case 'charge': b.pos.addScaledVector(b.dir, 13 * dt); b.yaw = Math.atan2(b.dir.x, b.dir.z);
        if (dist < 3 && Math.abs(P.pos.y - b.pos.y) < 2.5 && hurtPlayer(22, b, 16)) { b.st = 'tired'; b.t = 2.2; }
        if (b.t <= 0) { b.st = 'tired'; b.t = 3; popText('KINGPIN ZMĘCZONY — BIJ!'); G.shake = Math.max(G.shake, 0.3); }
        break;
      case 'tired': case 'stun': if (b.t <= 0) { b.st = 'walk'; b.cd = 1.2; } break;
    }
    b.pos.x = Math.max(o[0] - 15.5, Math.min(o[0] + 15.5, b.pos.x)); b.pos.z = Math.max(o[2] - 11.5, Math.min(o[2] + 11.5, b.pos.z)); b.pos.y = o[1];
  } else if (F.phase === 'intro' || F.phase === 'guards' || F.phase === 'intro2') { // stoi za biurkiem, patrzy na gracza
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z; b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(2, dt));
  }
  switch (b.st) {
    case 'idle': t.by = Math.sin(G.time * 2) * 0.006; t.sLz = 0.3; t.sRz = -0.3; t.eL = -0.3; t.eR = -0.3; t.hLz = 0.12; t.hRz = -0.12; break;
    case 'walk': b.ph += dt * 4.5; runPose(t, b.ph, 0.5, false); t.sLz = 0.5; t.sRz = -0.5; break;
    case 'caneW': t.sRx = -2.8; t.eR = -0.4; t.bp = -0.2; t.sLz = 0.6; break;
    case 'cane': t.sRx = -0.6; t.eR = -0.1; t.bp = 0.5; t.spy = -0.5; t.sLz = 0.6; break;
    case 'stompW': t.hRx = -1.5; t.kR = 1.4; t.sLx = -1; t.sRx = -1; t.by = 0.1; break;
    case 'stomp': t.hRx = 0.3; t.kR = 0.1; t.by = -0.25; t.bp = 0.5; t.sLx = -0.8; t.sRx = -0.8; break;
    case 'chargeW': t.by = -0.25; t.bp = 0.7; t.hLx = -0.8; t.kL = 1.2; t.hRx = 0.4; t.sLx = 0.8; t.sRx = 0.8; break;
    case 'charge': b.ph += dt * 10; runPose(t, b.ph, 1, true); t.bp = 0.8; break;
    case 'tired': t.bp = 0.7; t.by = -0.2; t.sLx = -0.9; t.sRx = -0.9; t.kL = 0.5; t.kR = 0.5; t.hLx = -0.4; t.hRx = -0.4; t.hx = 0.2 + Math.sin(G.time * 8) * 0.08; break;
    case 'stun': t.bp = 0.2; t.spy = Math.sin(G.time * 3) * 0.4; t.hx = 0.4; t.sLz = 0.3; t.sRz = -0.3; break;
  }
  blendPose(b.pc, t, damp(b.st === 'stomp' ? 25 : 10, dt)); applyPose(H, b.pc);
  H.setHands('open', b.st === 'idle' ? 'open' : 'fist');
  H.root.position.copy(b.pos); H.root.position.y += 0.2 * b.down;
  H.root.rotation.set(-Math.PI / 2 * b.down, b.yaw, 0, 'YXZ');
}
