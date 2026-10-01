// Misja: Wilson Fisk (Kingpin) w Fisk Tower. Wchodzisz do sali na parterze wiezowca, pokonujesz straz, potem Kingpina.
// Walka ma trzy fazy. Kingpin blokuje ciosy z przodu — trzeba go zajsc od tylu albo poczekac, az zmeczy sie po ataku.
// Ataki: laska (1-3 uderzenia), fala uderzeniowa (przeskocz ja), szarza (w 2. fazie podwojna) i chwyt, ktorego nie da sie zablokowac
// — tylko uniknac. Spamowanie ciosami w jego blok wywoluje kontre.
import { V3, damp, angLerp, save, doSave } from './util.js';
import { G, P, scene, enemies, crimes } from './stan.js';
import { SW } from './miasto.js';
import { buildKingpin, newPose, zeroPose, blendPose, applyPose, runPose } from './postac.js';
import { hurtPlayer } from './gracz.js';
import { addXP, burst, makeCrime, removeEnemy } from './wrogowie.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, popText, hint } from './ui.js';
import { playCine } from './scenki.js';

let F = null; // { d, room, boss, phase: 'intro'|'guards'|'intro2'|'boss'|'done', crime, wave }
export const fiskActive = () => !!F;

const PH = b => b.hp > b.max * 0.66 ? 0 : b.hp > b.max * 0.33 ? 1 : 2;       // faza 0, 1, 2
const SPD = [1, 1.2, 1.5], CDM = [1, 0.7, 0.45], TIRED = [2.6, 2.0, 1.4];

function makeKingpin(room) {
  const H = buildKingpin(); H.root.scale.setScalar(1.1); scene.add(H.root);
  const [x, z] = room.W(0, room.cd - 3.8), pos = new V3(x, SW, z);
  const b = {
    H, type: 'boss', name: 'KINGPIN', pos, vel: new V3(), yaw: Math.PI, hp: 170, max: 170, st: 'idle', t: 0, cd: 2, webs: 0, dead: false, gone: false, air: false,
    down: 0, scale: 1.25, state: 'fight', dir: new V3(), pc: newPose(), pt: newPose(), ph: 0, deadT: 0, room, hit: fiskHit, webFn: fiskWeb, finFn: fiskFinish,
    hits: 0, blockT: 0, swings: 0, chain: 0, ring: -1, summoned: [false, false],
  };
  H.root.position.copy(pos); return b;
}
const behind = b => { // czy gracz jest za plecami Kingpina
  const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, l = Math.hypot(dx, dz) || 1;
  return (dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)) / l < -0.25;
};
const vulnerable = b => b.st === 'tired' || b.st === 'stun' || behind(b);
function fiskHit(b, dmg) {
  if (b.dead) return false;
  if (!vulnerable(b)) {
    burst(b.pos.x, b.pos.y + 2.6, b.pos.z, 8, 0x9fd8ff, 3); sfx('block'); popText('BLOK!');
    hint('fisk', 'Kingpin blokuje ciosy z przodu. Zajdź go od tyłu (unik + bieg za plecy) albo poczekaj, aż zmęczy się po ataku!');
    b.hits++; b.blockT = 3; // spamowanie w blok = kontra
    if (b.hits >= 3 && (b.st === 'walk')) { b.hits = 0; b.st = 'grabW'; b.t = 0.45; popText('KONTRA!'); }
    return 'block';
  }
  b.hp -= dmg * 1.15; burst(b.pos.x, b.pos.y + 2.4, b.pos.z, 14, 0xfff2c0, 5); sfx('punch'); rumble(0.1, 0.5, 0.5); G.shake = Math.max(G.shake, 0.2); addXP(8);
  if (b.hp <= 0) defeated(b);
  return true;
}
function fiskWeb(b) {
  if (b.dead) return;
  b.webs++; popText(`SIEĆ ${b.webs}/5`);
  if (b.webs >= 5 && b.st !== 'stun') { b.st = 'stun'; b.t = 2.5; b.webs = 0; popText('KINGPIN OGŁUSZONY!'); sfx('win', 0.5); }
}
function fiskFinish(b) { b.hp -= 10; b.st = 'stun'; b.t = 1.6; popText('WYKOŃCZENIE!'); if (b.hp <= 0) defeated(b); }

function defeated(b) {
  b.dead = true; b.hp = 0; b.st = 'down'; b.deadT = 0;
  save.fisk = (save.fisk || 0) + 1; addXP(3000); doSave();
  sfx('level'); G.slowT = 1.2; G.shake = 0.6; F.phase = 'done';
  setTimeout(() => { if (F && !G.cine) playCine('fiskEnd', { b: b.pos, room: F.room, onEnd: () => showMsg('KINGPIN POKONANY!', '+3000 PD · Wyjdź drzwiami na ulicę', 5) }); }, 900);
}

export function startFisk(d) {
  if (F) return;
  const room = d.room; room.o = [(room.bx0 + room.bx1) / 2, SW, (room.bz0 + room.bz1) / 2];
  F = { d, room, boss: makeKingpin(room), phase: 'intro', crime: null };
  playCine('fisk', { b: F.boss.pos, room, onEnd: () => spawnGuards(3 + (save.lvl > 3 ? 1 : 0), true) });
}
function spawnGuards(n, first) {
  const room = F.room, [ax, az] = room.W(-7, room.cd * 0.35), [bx, bz] = room.W(7, room.cd * 0.62);
  const cr = makeCrime(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), SW, null, n + 2, true);
  cr.alert = true; for (const e of cr.list) e.state = 'fight';
  F.crime = cr; if (first) F.phase = 'guards';
  showMsg(first ? 'STRAŻ KINGPINA' : 'KINGPIN WZYWA STRAŻ', first ? 'Pokonaj ochroniarzy, zanim dotrzesz do Fiska.' : 'Pokonaj ich, ale nie odwracaj się od Kingpina!', 3.5);
}
function startBossFight() { F.phase = 'boss'; F.boss.st = 'walk'; F.boss.cd = 1.2; enemies.push(F.boss); showMsg('KINGPIN', 'Blokuje z przodu — zachodź go od tyłu! Trzy fazy, z każdą szybszy.', 4.5); sfx('alarm'); }
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
  const room = F.room;
  const inRoom = P.pos.x > room.bx0 - 1.5 && P.pos.x < room.bx1 + 1.5 && P.pos.z > room.bz0 - 4 && P.pos.z < room.bz1 + 4 && P.pos.y < SW + room.ch + 1;
  if (!inRoom || P.dead) { abortFisk(); return; }
  const b = F.boss, H = b.H;
  if (F.phase === 'guards' && F.crime && F.crime.list.every(e => e.dead)) { F.phase = 'intro2'; playCine('fisk2', { b: b.pos, room, onEnd: startBossFight }); }
  if (F.phase === 'boss' || F.phase === 'done') G.boss = b.dead ? null : b;
  const t = b.pt; zeroPose(t);
  if (b.dead) { b.deadT += dt; b.down += (1 - b.down) * damp(3, dt); t.bp = 0.5; t.sLz = 0.8; t.sRz = -0.8; }
  else if (F.phase === 'boss') {
    const ph = PH(b), sp = SPD[ph];
    // przywolanie strazy na 66% i 33% zycia
    for (let k = 0; k < 2; k++) if (!b.summoned[k] && b.hp <= b.max * (k ? 0.33 : 0.66)) { b.summoned[k] = true; spawnGuards(k ? 3 : 2, false); }
    b.blockT -= dt; if (b.blockT <= 0) b.hits = 0;
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
    const face = k => { b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(k * sp, dt)); };
    b.t -= dt; b.cd -= dt;
    const tired = () => { b.st = 'tired'; b.t = TIRED[ph]; popText('KINGPIN ZMĘCZONY — BIJ!'); };
    switch (b.st) {
      case 'walk': face(4.5);
        if (dist > 3.2) { b.pos.x += dx / dist * 2.9 * sp * dt; b.pos.z += dz / dist * 2.9 * sp * dt; }
        if (b.cd <= 0) {
          const r = Math.random();
          if (dist < 2.8 && r < 0.55) { b.st = 'grabW'; b.t = 0.55 / sp; }                       // chwyt z bliska
          else if (dist < 5) { b.st = 'caneW'; b.t = 0.8 / sp; b.swings = ph + 1; }
          else if (dist > 9 && r < 0.6) { b.st = 'chargeW'; b.t = 1.0 / sp; b.chain = ph >= 1 ? 1 : 0; }
          else { b.st = 'stompW'; b.t = 1.0 / sp; }
        }
        break;
      case 'caneW': face(7); G.sense = true; if (b.t <= 0) { b.st = 'cane'; b.t = 0.4 / sp; swingCane(b, dist); } break;
      case 'cane': if (b.t <= 0) { if (--b.swings > 0) { b.st = 'caneW'; b.t = 0.28 / sp; } else tired(); } break;
      case 'grabW': face(8); G.sense = true; if (b.t <= 0) { b.st = 'grab'; b.t = 0.5; grab(b, dist); } break;
      case 'grab': if (b.t <= 0) { tired(); } break;
      case 'stompW': face(5); G.sense = true; if (b.t <= 0) { b.st = 'stomp'; b.t = 1.0; b.ring = 0; sfx('slam'); G.shake = Math.max(G.shake, 0.6); rumble(0.3, 1, 0.6); } break;
      case 'stomp':
        if (b.ring >= 0) { // fala uderzeniowa rosnaca od Kingpina: trzeba ja przeskoczyc
          const R0 = b.ring; b.ring += (11 + ph * 3) * dt; const R1 = b.ring;
          for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; burst(b.pos.x + Math.cos(a) * R1, b.pos.y + 0.2, b.pos.z + Math.sin(a) * R1, 1, 0xd9cdb8, 2); }
          if (dist > R0 - 0.8 && dist < R1 + 0.8 && P.pos.y - b.pos.y < 0.9) { if (hurtPlayer(20, b, 12)) b.ring = -1; }
          if (b.ring > 16) b.ring = -1;
        }
        if (b.t <= 0) { b.ring = -1; b.st = 'walk'; b.cd = 1.2 * CDM[ph]; }
        break;
      case 'chargeW': face(7); G.sense = true; if (b.t <= 0) { b.st = 'charge'; b.t = 1.4; b.dir.set(dx, 0, dz).normalize(); sfx('slam', 0.4); } break;
      case 'charge': b.pos.addScaledVector(b.dir, 15 * sp * dt); b.yaw = Math.atan2(b.dir.x, b.dir.z);
        if (dist < 3 && Math.abs(P.pos.y - b.pos.y) < 2.5 && hurtPlayer(28, b, 18)) { tired(); }
        if (b.t <= 0) { if (b.chain-- > 0) { b.st = 'chargeW'; b.t = 0.55; } else { tired(); G.shake = Math.max(G.shake, 0.3); } }
        break;
      case 'tired': case 'stun': if (b.t <= 0) { b.st = 'walk'; b.cd = 0.9 * CDM[ph]; } break;
    }
    b.pos.x = Math.max(room.bx0 + 1.4, Math.min(room.bx1 - 1.4, b.pos.x)); b.pos.z = Math.max(room.bz0 + 1.4, Math.min(room.bz1 - 1.4, b.pos.z)); b.pos.y = SW;
  } else if (F.phase === 'intro' || F.phase === 'guards' || F.phase === 'intro2') {
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z; b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(2, dt));
  }
  switch (b.st) {
    case 'idle': t.by = Math.sin(G.time * 2) * 0.006; t.sLz = 0.3; t.sRz = -0.3; t.eL = -0.3; t.eR = -0.3; t.hLz = 0.12; t.hRz = -0.12; break;
    case 'walk': b.ph += dt * 4.5 * SPD[PH(b)]; runPose(t, b.ph, 0.5, false); t.sLz = 0.5; t.sRz = -0.5; break;
    case 'caneW': t.sRx = -2.8; t.eR = -0.4; t.bp = -0.2; t.sLz = 0.6; break;
    case 'cane': t.sRx = -0.6; t.eR = -0.1; t.bp = 0.5; t.spy = -0.5; t.sLz = 0.6; break;
    case 'grabW': t.sLx = -1.6; t.sRx = -1.6; t.eL = -0.2; t.eR = -0.2; t.bp = 0.3; break;
    case 'grab': t.sLx = -1.0; t.sRx = -1.0; t.bp = 0.7; t.by = -0.2; break;
    case 'stompW': t.hRx = -1.5; t.kR = 1.4; t.sLx = -1; t.sRx = -1; t.by = 0.1; break;
    case 'stomp': t.hRx = 0.3; t.kR = 0.1; t.by = -0.25; t.bp = 0.5; t.sLx = -0.8; t.sRx = -0.8; break;
    case 'chargeW': t.by = -0.25; t.bp = 0.7; t.hLx = -0.8; t.kL = 1.2; t.hRx = 0.4; t.sLx = 0.8; t.sRx = 0.8; break;
    case 'charge': b.ph += dt * 11; runPose(t, b.ph, 1, true); t.bp = 0.8; break;
    case 'tired': t.bp = 0.7; t.by = -0.2; t.sLx = -0.9; t.sRx = -0.9; t.kL = 0.5; t.kR = 0.5; t.hLx = -0.4; t.hRx = -0.4; t.hx = 0.2 + Math.sin(G.time * 8) * 0.08; break;
    case 'stun': t.bp = 0.2; t.spy = Math.sin(G.time * 3) * 0.4; t.hx = 0.4; t.sLz = 0.3; t.sRz = -0.3; break;
  }
  blendPose(b.pc, t, damp(b.st === 'stomp' || b.st === 'grab' ? 25 : 10, dt)); applyPose(H, b.pc);
  H.setHands('open', b.st === 'idle' ? 'open' : 'fist');
  H.root.position.copy(b.pos); H.root.position.y += 0.2 * b.down;
  H.root.rotation.set(-Math.PI / 2 * b.down, b.yaw, 0, 'YXZ');
}
function swingCane(b, dist) { // uderzenie laska: obszar przed Kingpinem
  sfx('slam', 0.7); G.shake = Math.max(G.shake, 0.4); burst(b.pos.x + Math.sin(b.yaw) * 2, b.pos.y + 1, b.pos.z + Math.cos(b.yaw) * 2, 20, 0xffe3a0, 6);
  if (dist < 6.2 && Math.abs(P.pos.y - b.pos.y) < 2.5) hurtPlayer(22, b, 14);
}
function grab(b, dist) { // chwyt: nie do zablokowania, trzeba zrobic unik (kolo w czasie 'grabW' zapala sie zmysl pajaka)
  if (dist < 3.2 && Math.abs(P.pos.y - b.pos.y) < 2) { if (hurtPlayer(34, b, 18)) { sfx('slam'); G.shake = 0.7; popText('CHWYT!'); } }
  else popText('UNIK!');
}
