// Misja: Wilson Fisk (Kingpin) w Fisk Tower — SZESC POZIOMOW.
//  1-4: kolejne pietra wiezy (parter, biura, kasyno, arsenal), na kazdym fala zwyklych ludzi Fiska (ranged / melee / osilki);
//       po pokonaniu fali otwiera sie winda przy lewej scianie — wejdz do niej, zeby wjechac wyzej.
//  5:   gabinet Kingpina za szyba pancerna; dzialka strzelaja do gracza, trzeba nimi rzucic (L1+R1) w szybe: 3 trafienia i szyba pryska.
//       Potem scenka (Fisk rzuca sie na Spider-Mana, wypadaja przez okno) i dlugi upadek z wiezy.
//  6:   walka z Kingpinem w holu (3 fazy, bez dialogow i bez docinek Spider-Mana).
// Punkt kontrolny: po smierci wracasz na poczatek biezacego poziomu. Ucieczka: stoj 2 s w windzie (poza poziomem 6 wyjdz drzwiami).
// Walka z Kingpinem: blokuje ciosy z przodu — trzeba go zajsc od tylu albo poczekac, az zmeczy sie po ataku.
// Ataki: laska (1-3 uderzenia), fala uderzeniowa (przeskocz ja), szarza (w 2. fazie podwojna) i chwyt, ktorego nie da sie zablokowac
// — tylko uniknac. Spamowanie ciosami w jego blok wywoluje kontre.
import { V3, damp, angLerp, save, doSave, clamp, rnd } from './util.js';
import { G, P, scene, enemies, crimes, cam } from './stan.js';
import { SW, FISK_H, solidAt } from './miasto.js';
import { buildKingpin, newPose, zeroPose, blendPose, applyPose, runPose } from './postac.js';
import { hurtPlayer } from './gracz.js';
import { addXP, burst, makeCrime, makeEnemy, removeEnemy } from './wrogowie.js';
import { sfx } from './dzwiek.js';
import { rumble } from './wejscie.js';
import { showMsg, popText, hint, setMissionBar } from './ui.js';
import { playCine } from './scenki.js';
import { buildFiskFloor } from './wnetrza.js';
import { maxHp } from './umiejetnosci.js';
import { registerThrowable, throwTargets, throwables } from './rzucanie.js';
import { glassBurst, explosion } from './efekty.js';

let F = null; // { d, room, level, boss, crime, crimes[], cleared, busy, phase, lifts{}, glass, cannons[], bullets[] ... }
let CP = 1, SEEN5 = false; // punkt kontrolny (poziom) i czy scenka poziomu 5 juz byla
export const fiskActive = () => !!F;
export const fiskBossFight = () => !!F && F.level === 6 && (F.phase === 'boss' || F.phase === 'done');
const syncFight = () => { G.fiskFight = fiskBossFight(); }; // flaga dla docinki.js (Spider-Man milczy w walce z Kingpinem)
export const fiskLevel = () => F ? F.level : 0;

const PH = b => b.hp > b.max * 0.66 ? 0 : b.hp > b.max * 0.33 ? 1 : 2;       // faza 0, 1, 2
const SPD = [1, 1.2, 1.5], CDM = [1, 0.7, 0.45], TIRED = [2.6, 2.0, 1.4];
const TOTAL = 6;
const LABEL = ['', 'Hol główny — straż Kingpina', 'Biura — ochrona', 'Kasyno — ludzie Fiska', 'Arsenał — osiłki', 'Gabinet Kingpina', 'KINGPIN'];
const WAVE = {
  1: ['melee', 'melee', 'gun'],
  2: ['melee', 'melee', 'melee', 'gun', 'gun'],
  3: ['melee', 'melee', 'melee', 'gun', 'gun', 'gun', 'brute'],
  4: ['melee', 'melee', 'melee', 'melee', 'gun', 'gun', 'gun', 'gun', 'brute', 'brute'],
};
const floorOf = L => L <= 4 ? L - 1 : L === 5 ? 4 : 0;
const floorY = k => SW + k * FISK_H;

// ---------------------------------------------------------------- uklad pokoju
const _rk = new WeakMap();
function RK(room) {
  let r = _rk.get(room); if (r) return r;
  const [ox, oz] = room.W(0, 0), ns = Math.abs(room.W(1, 0)[0] - ox) > 0.5;
  r = {
    ns, hw: room.cw / 2, vg: room.cd - 7,
    uv: (x, z) => ns ? [x - room.uc, (z - room.cvDoor) * room.sIn] : [z - room.uc, (x - room.cvDoor) * room.sIn],
    wp: (u, v, y = 0) => { const [x, z] = room.W(u, v); return new V3(x, y, z); },
    yaw: (du, dv) => { const [x, z] = room.W(du, dv); return Math.atan2(x - ox, z - oz); },
  };
  _rk.set(room, r); return r;
}

// ---------------------------------------------------------------- nakladka: zaciemnienie / blysk
let fadeEl = null;
function fade(a, col = '#000', ms = 500) {
  if (!fadeEl) { fadeEl = document.createElement('div'); fadeEl.style.cssText = 'position:fixed;inset:0;z-index:20;pointer-events:none;opacity:0;background:#000'; document.body.appendChild(fadeEl); }
  fadeEl.style.transition = `opacity ${ms}ms ease`; fadeEl.style.background = col; fadeEl.style.opacity = a;
}
function flash() { fade(1, '#fff', 40); setTimeout(() => fade(0, '#fff', 500), 90); }

// ---------------------------------------------------------------- Kingpin (model i dane walki — bez zmian)
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
  save.fisk = (save.fisk || 0) + 1; addXP(3000); doSave(); CP = 1; SEEN5 = false;
  sfx('level'); G.slowT = 1.2; G.shake = 0.6; F.phase = 'done';
  setMissionBar(TOTAL, TOTAL, 'UKOŃCZONO');
  setTimeout(() => { if (F && !G.cine) playCine('fiskEnd', { b: b.pos, room: F.room, onEnd: () => showMsg('KINGPIN POKONANY!', '+3000 PD · Wyjdź drzwiami na ulicę', 5) }); }, 900);
}

// ---------------------------------------------------------------- wejscie / wyjscie z misji
export function startFisk(d) {
  if (F) return;
  const room = d.room; room.o = [(room.bx0 + room.bx1) / 2, SW, (room.bz0 + room.bz1) / 2];
  F = { d, room, level: 0, boss: makeKingpin(room), crime: null, crimes: [], cleared: false, busy: false, phase: '', lifts: {}, glass: null, cannons: [], bullets: [], liftT: 0, quitT: 0, hk: null };
  F.boss.H.root.visible = false; F.hk = makeHooks();
  setMissionBar(0);
  beginLevel(CP, true);
}
export function abortFisk() {
  if (!F) return;
  const f = F; wipeLevel(); F = null; G.fiskFight = false;
  for (const k in f.lifts) scene.remove(f.lifts[k].g);
  if (enemies.includes(f.boss)) removeEnemy(f.boss); else scene.remove(f.boss.H.root);
  if (G.boss === f.boss) G.boss = null;
  setMissionBar(0); if (fadeEl) fade(0, '#000', 200);
}
// usuwa wszystko, co nalezy do biezacego poziomu (wrogowie, dzialka, szyba, pociski)
function wipeLevel() {
  const f = F; if (!f) return;
  for (const cr of f.crimes) { for (const e of cr.list) removeEnemy(e); const i = crimes.indexOf(cr); if (i >= 0) crimes.splice(i, 1); }
  f.crimes = []; f.crime = null;
  for (const c of f.cannons) killCannon(c, false); f.cannons = [];
  for (const b of f.bullets) scene.remove(b.m); f.bullets = [];
  if (f.glass) { scene.remove(f.glass.g); const i = throwTargets.indexOf(f.glass.target); if (i >= 0) throwTargets.splice(i, 1); f.glass = null; }
  { const i = enemies.indexOf(f.boss); if (i >= 0) enemies.splice(i, 1); } // Kingpin wraca do gry dopiero na poziomie 6 (model zostaje)
  if (G.boss === f.boss) G.boss = null;
}
function placePlayer(pos, heading) {
  P.pos.copy(pos); P.prev.copy(pos); P.vel.set(0, 0, 0); P.state = 'ground'; P.heading = heading; P.invT = Math.max(P.invT, 1.5);
  cam.yaw = heading + Math.PI; cam.pitch = -0.15; cam.tgt.copy(P.pos);
}
function arrival(k) { const R = RK(F.room); return R.wp(-R.hw + 3.4, 3.5, floorY(k) + 0.05); }

function beginLevel(L, first, restart) {
  const room = F.room, R = RK(room), k = floorOf(L), fy = floorY(k);
  F.level = L; CP = L; F.cleared = false; F.phase = ''; F.quitT = 0; F.armed = false;
  setMissionBar(L, TOTAL, LABEL[L]);
  if (k > 0) buildFiskFloor(F.d, k);
  ensureLift(k); F.lift = F.lifts[k]; F.liftT = 3; F.lift.target = 1;
  F.boss.H.root.visible = L >= 5;
  if (!(first && L === 1)) placePlayer(arrival(k), R.yaw(1, 0));
  if (L <= 4) {
    spawnWave(WAVE[L], k);
    showMsg(`POZIOM ${L}/${TOTAL}`, LABEL[L] + ' — pokonaj wszystkich', 3.2);
    if (L === 1) hint('fisk_lift', 'Po pokonaniu fali otworzy się winda przy lewej ścianie. Wejdź do niej, żeby wjechać wyżej.');
  } else if (L === 5) {
    setupLevel5(restart);
  } else {
    setupLevel6();
  }
}
function nextLevel() {
  if (F.busy) return; F.busy = true; F.lift.target = 0; sfx('ui'); fade(1, '#000', 600);
  const me = F; setTimeout(() => { if (F !== me) return; wipeLevel(); beginLevel(F.level + 1); fade(0, '#000', 700); F.busy = false; }, 800);
}
function quitMission() {
  if (F.busy) return; F.busy = true; fade(1, '#000', 500); const me = F, d = F.d;
  setTimeout(() => {
    if (F !== me) return;
    placePlayer(new V3(d.x + d.nx * 3.2, 0.05, d.z + d.nz * 3.2), Math.atan2(d.nx, d.nz)); abortFisk(); fade(0, '#000', 600);
    showMsg('FISK TOWER', CP > 1 ? `Wrócisz do poziomu ${CP}/${TOTAL}, gdy znów wejdziesz do holu.` : 'Misja przerwana.', 3.5);
  }, 650);
}
function revive() { // punkt kontrolny: po smierci wracasz na poczatek biezacego poziomu
  P.dead = false; P.hp = maxHp(); P.invT = 2.5; P.deadT = 0; P.atk = null; P.lunge = null; P.flipT = -1; P.fin = null; P.car = null; P.focus = 0;
  P.vel.set(0, 0, 0); P.state = 'ground'; P.pc.bp = 0; P.pc.br = 0; P.pc.bw = 0;
  F.busy = true; fade(1, '#000', 400); const me = F;
  setTimeout(() => {
    if (F !== me) return;
    wipeLevel(); beginLevel(F.level, false, true); fade(0, '#000', 700); F.busy = false;
    showMsg('PUNKT KONTROLNY', `Wracasz na początek poziomu ${F.level}/${TOTAL}.`, 3);
  }, 550);
}

// ---------------------------------------------------------------- fale wrogow (poziomy 1-4)
function spawnWave(types, k) {
  const room = F.room, R = RK(room), fy = floorY(k);
  const cr = { spot: null, list: [], active: true, alert: true, clearT: 0, x: 0, y: fy, z: 0 };
  const lobby = k === 0, du = lobby ? 5 : 3.6, v0 = lobby ? 9 : 8, v1 = lobby ? 18 : 18.5;
  for (const type of types) {
    const e = makeEnemy(type); let p = null;
    for (let i = 0; i < 14; i++) { const u = rnd(-du, du), v = rnd(v0, v1); p = R.wp(u, v, fy); if (!solidAt(p.x, fy + 1, p.z)) break; }
    e.pos.copy(p); e.groundY = fy; e.crime = cr; e.state = 'fight'; cr.list.push(e); enemies.push(e);
  }
  cr.x = F.d.x; cr.z = F.d.z; crimes.push(cr); F.crime = cr; F.crimes.push(cr);
}
function levelCleared() {
  F.cleared = true; F.lift.target = 1; F.liftT = 1e9; sfx('win'); addXP(150 * F.level);
  showMsg(`POZIOM ${F.level}/${TOTAL} UKOŃCZONY`, `+${150 * F.level} PD · Wejdź do windy przy lewej ścianie`, 4);
  hint('fisk_lift2', 'Winda otwarta — wejdź do niej, aby wjechać na kolejne piętro.');
  F.lift.light.color.setHex(0x30ff60);
}

// ---------------------------------------------------------------- winda
function ensureLift(k) {
  if (F.lifts[k]) return;
  const R = RK(F.room), hw = R.hw, g = new THREE.Group();
  const M = (c, m, r) => new THREE.MeshStandardMaterial({ color: c, metalness: m, roughness: r });
  const frame = M(0x1c1e22, 0.8, 0.4), doorM = M(0xb8bcc2, 0.9, 0.3), dark = new THREE.MeshBasicMaterial({ color: 0x0a0b0c });
  const lightM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  box(0.22, 3.1, 0.3, -1.3, 1.55, 0.15, frame); box(0.22, 3.1, 0.3, 1.3, 1.55, 0.15, frame); box(2.84, 0.3, 0.3, 0, 3.05, 0.15, frame);
  box(2.4, 2.9, 0.04, 0, 1.45, 0.02, dark);
  const light = box(2.4, 0.1, 0.05, 0, 3.26, 0.31, lightM);
  const dl = box(1.2, 2.85, 0.06, -0.6, 1.43, 0.1, doorM), dr = box(1.2, 2.85, 0.06, 0.6, 1.43, 0.1, doorM);
  // tabliczka z numerem pietra
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#0a0b0c'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#ffc93c'; x.font = 'bold 44px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(k === 0 ? 'P' : String(k), 64, 34);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) })); sign.position.set(0, 3.55, 0.31); g.add(sign);
  const p = R.wp(-hw + 0.04, 3.5, floorY(k)); g.position.copy(p); g.rotation.y = R.yaw(1, 0);
  scene.add(g); F.lifts[k] = { g, dl, dr, light: lightM, open: 0, target: 0 };
}
function updateLift(dt) {
  const L = F.lift; if (!L) return;
  L.open += (L.target - L.open) * damp(2.4, dt);
  const s = 1 - 0.93 * L.open; L.dl.scale.x = s; L.dl.position.x = -1.2 + 0.6 * s; L.dr.scale.x = s; L.dr.position.x = 1.2 - 0.6 * s;
  if (F.liftT > 0 && F.liftT < 1e8) { F.liftT -= dt; if (F.liftT <= 0 && !F.cleared && F.level <= 4) L.target = 0; } // drzwi otwarte na przyjezdnego, potem sie zamykaja
  if (!F.cleared && F.level <= 4) L.light.color.setHex(0xff2a2a);
}

// ---------------------------------------------------------------- poziom 5: szyba pancerna i dzialka
const CMOUNT = [[-8, 9.2], [8, 9.2], [0, 12.4], [-5.4, 4.3], [5.4, 4.3]];
let cMat = null;
function makeCannonMesh() {
  if (!cMat) cMat = { steel: new THREE.MeshStandardMaterial({ color: 0x2b2f35, metalness: 0.85, roughness: 0.35 }), dark: new THREE.MeshStandardMaterial({ color: 0x14161a, metalness: 0.6, roughness: 0.5 }), glow: new THREE.MeshBasicMaterial({ color: 0xff7a1a }), red: new THREE.MeshStandardMaterial({ color: 0x8a1e1e, metalness: 0.5, roughness: 0.5 }) };
  const g = new THREE.Group(), head = new THREE.Group();
  const add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
  add(new THREE.CylinderGeometry(0.5, 0.62, 0.34, 16), cMat.dark, 0, -0.78, 0);       // podstawa (srodek masy w (0,0,0))
  add(new THREE.CylinderGeometry(0.22, 0.3, 0.7, 12), cMat.steel, 0, -0.45, 0);        // kolumna
  g.add(head); head.position.y = 0;
  add(new THREE.BoxGeometry(0.85, 0.6, 0.95), cMat.steel, 0, 0, 0, head);
  add(new THREE.BoxGeometry(0.9, 0.12, 0.6), cMat.red, 0, 0.36, -0.1, head);
  const barrel = add(new THREE.CylinderGeometry(0.13, 0.16, 1.2, 12), cMat.dark, 0, 0.02, 0.95, head); barrel.rotation.x = Math.PI / 2;
  const muz = add(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 12), cMat.glow, 0, 0.02, 1.58, head); muz.rotation.x = Math.PI / 2;
  add(new THREE.BoxGeometry(0.06, 0.1, 0.5), cMat.glow, 0.44, 0.1, 0.0, head); add(new THREE.BoxGeometry(0.06, 0.1, 0.5), cMat.glow, -0.44, 0.1, 0.0, head);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return { g, head, muz };
}
function addCannon(mi) {
  const R = RK(F.room), fy = floorY(4), [u, v] = CMOUNT[mi % CMOUNT.length];
  const { g, head, muz } = makeCannonMesh(), home = R.wp(u, v, fy + 0.95);
  g.position.copy(home); g.scale.setScalar(0.001); scene.add(g);
  const c = { pos: home.clone(), home, mesh: g, head, muz, radius: 0.9, mass: 4, kind: 'cannon', dead: false, det: false, cd: rnd(1.4, 2.6) + mi * 0.5, tele: 0, up: 0, onHit: (power, other) => { /* trafienie dzialkiem we wroga: nic specjalnego */ } };
  registerThrowable(c); F.cannons.push(c); return c;
}
function killCannon(c, fx = true) {
  if (c.dead) return; c.dead = true;
  if (fx) { explosion(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, 26); sfx('slam', 0.8); }
  scene.remove(c.mesh);
  const i = throwables.indexOf(c); if (i >= 0) throwables.splice(i, 1);
}
function cannonsAnim(p) { // p 0..1: dzialka wysuwaja sie z podlogi
  if (!F) return;
  for (const c of F.cannons) { c.up = p; if (!c.det) { c.mesh.scale.setScalar(Math.max(0.001, p)); c.mesh.position.set(c.home.x, c.home.y - (1 - p) * 1.2, c.home.z); c.pos.copy(c.home); } c.mesh.visible = p > 0 || c.det; }
}
let gMat = null;
function makeGlass() {
  const R = RK(F.room), fy = floorY(4), W = F.room.cw - 0.1, Hh = 7.3;
  const cvs = document.createElement('canvas'); cvs.width = 1536; cvs.height = 512;
  const tex = new THREE.CanvasTexture(cvs); tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  const g = new THREE.Group(); g.add(mesh); const c0 = R.wp(0, R.vg, fy + 0.04 + Hh / 2); g.position.copy(c0); g.rotation.y = R.yaw(0, 1);
  g.visible = false; scene.add(g);
  const a = R.wp(-R.hw, R.vg - 0.35, 0), b = R.wp(R.hw, R.vg + 0.35, 0);
  const gl = { g, mesh, cvs, tex, W, H: Hh, c0, hits: 0, list: [], broken: false, y0: c0.y, drop: 0 };
  gl.target = { kind: 'glass', box: { x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), y0: fy, y1: fy + 7.4 }, onHit: (power, obj) => glassHit(power, obj) };
  throwTargets.push(gl.target); drawGlass(gl); return gl;
}
function genCrack(x, y) { // siatka pekniec: promienie z odgalezieniami + luki
  const rays = [], n = 12 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    let a = i / n * 6.283 + rnd(-0.2, 0.2), px = x, py = y; const pts = [[px, py]], br = [];
    for (let s = 0; s < 10; s++) {
      a += rnd(-0.35, 0.35); const l = rnd(24, 48) * (1 + s * 0.05); px += Math.cos(a) * l; py += Math.sin(a) * l * 0.9; pts.push([px, py]);
      if (s >= 2 && s <= 6 && Math.random() < 0.4) { let b = a + rnd(0.5, 1.0) * (Math.random() < 0.5 ? 1 : -1), qx = px, qy = py; const bp = [[qx, qy]]; for (let t = 0; t < 4; t++) { b += rnd(-0.3, 0.3); qx += Math.cos(b) * rnd(18, 36); qy += Math.sin(b) * rnd(18, 36) * 0.9; bp.push([qx, qy]); } br.push(bp); }
    }
    rays.push({ pts, br });
  }
  return { x, y, rays };
}
function drawGlass(gl) {
  const c = gl.cvs.getContext('2d'), W = gl.cvs.width, H = gl.cvs.height; c.clearRect(0, 0, W, H);
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, 'rgba(150,205,230,0.34)'); g.addColorStop(0.5, 'rgba(205,235,250,0.2)'); g.addColorStop(1, 'rgba(150,205,230,0.36)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,255,255,0.16)'; for (const x0 of [220, 640, 1060, 1440]) { c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + 110, 0); c.lineTo(x0 - 70, H); c.lineTo(x0 - 180, H); c.fill(); }
  c.fillStyle = 'rgba(25,60,60,0.7)'; for (const x0 of [W / 4, W * 3 / 4]) c.fillRect(x0 - 5, 0, 10, H); c.fillRect(0, H * 0.5 - 4, W, 8); // szwy plyt pancernych
  c.strokeStyle = 'rgba(170,235,225,0.8)'; c.lineWidth = 10; c.strokeRect(5, 5, W - 10, H - 10);
  const fr = gl.hits >= 2 ? 1 : 0.5;
  for (const h of gl.list) {
    for (const r of h.rays) {
      for (const pass of [[6, 'rgba(160,215,255,0.22)'], [1.6, 'rgba(255,255,255,0.92)']]) {
        c.lineWidth = pass[0]; c.strokeStyle = pass[1];
        const n = Math.max(2, Math.floor(r.pts.length * fr)); c.beginPath(); c.moveTo(r.pts[0][0], r.pts[0][1]); for (let i = 1; i < n; i++) c.lineTo(r.pts[i][0], r.pts[i][1]); c.stroke();
        if (fr >= 1) for (const bp of r.br) { c.beginPath(); c.moveTo(bp[0][0], bp[0][1]); for (let i = 1; i < bp.length; i++) c.lineTo(bp[i][0], bp[i][1]); c.stroke(); }
      }
    }
    // luki laczace promienie (siatka)
    c.lineWidth = 1.2; c.strokeStyle = 'rgba(255,255,255,0.7)';
    for (const idx of fr >= 1 ? [2, 4, 6] : [2]) { c.beginPath(); h.rays.forEach((r, i) => { const p = r.pts[Math.min(idx, r.pts.length - 1)]; i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(h.x, h.y, 9, 0, 6.283); c.fill();
  }
  gl.tex.needsUpdate = true;
}
function glassAnim(p) { // p 0..1: szyba zjezdza z sufitu
  if (!F || !F.glass) return;
  const gl = F.glass; gl.drop = p; gl.g.visible = p > 0 && !gl.broken;
  gl.g.position.y = gl.y0 + (1 - ease(p)) * 7.4;
}
const ease = t => t * t * (3 - 2 * t);
function glassHit(power, obj) {
  if (!F || !F.glass || F.glass.broken || F.glass.drop < 1) return;
  const gl = F.glass, R = RK(F.room), fy = floorY(4); gl.hits++;
  // punkt trafienia na tafli
  let hu = rnd(-4, 4), hy = rnd(2, 5);
  if (obj && obj.pos) { const [u] = R.uv(obj.pos.x, obj.pos.z); hu = clamp(u, -R.hw + 1, R.hw - 1); hy = clamp(obj.pos.y - fy, 1, 6.3); }
  const wpnt = R.wp(hu, R.vg, fy + hy), nrm = R.wp(0, 1, 0).sub(R.wp(0, 0, 0));
  // zniszcz dzialko, ktore trafilo
  let cn = obj && F.cannons.includes(obj) ? obj : null;
  if (!cn) { let bd = 1e9; for (const c of F.cannons) if (!c.dead && c.det) { const d = c.mesh.position.distanceTo(wpnt); if (d < bd) { bd = d; cn = c; } } }
  if (cn) { killCannon(cn); F.cannons.splice(F.cannons.indexOf(cn), 1); }
  G.shake = Math.max(G.shake, 0.5); rumble(0.3, 0.8, 0.5);
  if (gl.hits >= 3) { breakGlass(); return; }
  gl.list.push(genCrack((hu / (gl.W / 2) * 0.5 + 0.5) * gl.cvs.width, (1 - hy / gl.H) * gl.cvs.height)); drawGlass(gl);
  glassBurst(wpnt.x, wpnt.y, wpnt.z, -nrm.x, 0.1, -nrm.z, 14); sfx('glass', 0.7); sfx('slam', 0.6);
  popText(gl.hits === 1 ? 'SZYBA PĘKA!' : 'SZYBA POPĘKANA — JESZCZE RAZ!');
  hint('fisk_glass2', 'Kolejne działko w szybę! Zostało trafień: ' + (3 - gl.hits));
}
function breakGlass() {
  const gl = F.glass, R = RK(F.room), fy = floorY(4); gl.broken = true; gl.g.visible = false;
  const i = throwTargets.indexOf(gl.target); if (i >= 0) throwTargets.splice(i, 1);
  const nrm = R.wp(0, 1, 0).sub(R.wp(0, 0, 0));
  for (let k = 0; k < 14; k++) { const w = R.wp(rnd(-R.hw + 1, R.hw - 1), R.vg, fy + rnd(0.6, 6.8)); glassBurst(w.x, w.y, w.z, nrm.x * -1, 0.2, nrm.z * -1, 22); }
  sfx('glass', 1.3); sfx('slam', 0.9); G.shake = 0.9; flash();
  for (const c of F.cannons) killCannon(c, true); F.cannons = [];
  for (const b of F.bullets) scene.remove(b.m); F.bullets = [];
  F.armed = false; F.phase = 'cine5b'; addXP(400);
  const b = F.boss; b.pos.copy(R.wp(0, F.room.cd - 4.6, fy)); b.yaw = R.yaw(0, -1);
  const me = F;
  setTimeout(() => {
    if (F !== me || G.cine) return;
    playCine('fisk5b', { room: F.room, fy, fisk: F.boss.H, hooks: F.hk, onEnd: () => {
      if (F !== me) return;
      playCine('fiskFall', { room: F.room, fy, fisk: F.boss.H, hooks: F.hk, onEnd: () => { if (F === me) toLevel6(); } });
    } });
  }, 500);
}
function toLevel6() {
  F.busy = true; fade(1, '#000', 250); const me = F;
  setTimeout(() => { if (F !== me) return; wipeLevel(); beginLevel(6); fade(0, '#000', 900); F.busy = false; }, 400);
}
function makeHooks() { return { glassDrop: p => glassAnim(p), cannonsUp: p => cannonsAnim(p), cannonsHide: () => cannonsAnim(0), flashFront: () => flash() }; }

function setupLevel5(restart) {
  const room = F.room, R = RK(room), fy = floorY(4), b = F.boss;
  F.glass = makeGlass(); for (let i = 0; i < 3; i++) addCannon(i);
  b.hp = b.max; b.dead = false; b.down = 0; b.st = 'idle'; b.pos.copy(R.wp(0, R.vg + 2.4, fy)); b.yaw = R.yaw(0, -1);
  b.H.root.visible = true;
  F.phase = 'l5';
  const ready = () => {
    SEEN5 = true; F.phase = 'l5'; F.glass.drop = 1; glassAnim(1); cannonsAnim(1); F.armed = true; F.supplyT = 0;
    showMsg('POZIOM 5/6', 'Namierz działko i rzuć nim (L1 + R1) w szybę pancerną. Unikaj pocisków!', 5);
    hint('fisk_throw', 'Działko podnosisz i rzucasz przytrzymując L1 i R1 (klawiatura: T). Trzy trafienia w szybę rozbijają ją.');
  };
  if (restart || SEEN5) { cannonsAnim(0); ready(); return; }
  F.phase = 'cine5a'; cannonsAnim(0); glassAnim(0);
  const me = F;
  playCine('fisk5a', { room, fy, fisk: b.H, hooks: F.hk, onEnd: () => { if (F === me) ready(); } });
}
function setupLevel6() {
  const room = F.room, R = RK(room), b = F.boss, fy = floorY(0);
  const [x, z] = room.W(0, room.cd - 3.8); b.pos.set(x, SW, z); b.yaw = R.yaw(0, -1);
  b.hp = b.max; b.dead = false; b.down = 0; b.st = 'walk'; b.cd = 1.6; b.summoned = [false, false]; b.webs = 0; b.hits = 0; b.pc = newPose();
  b.H.root.visible = true; enemies.push(b);
  placePlayer(R.wp(0, 3.6, fy + 0.05), R.yaw(0, 1));
  F.phase = 'boss'; G.boss = b;
  showMsg(`POZIOM 6/6 — KINGPIN`, 'Blokuje z przodu — zachodź go od tyłu! Trzy fazy, z każdą szybszy.', 4.5); sfx('alarm');
}

function spawnGuards(n, first) { // straz przywolywana przez Kingpina w trakcie walki (poziom 6)
  const room = F.room, [ax, az] = room.W(-7, room.cd * 0.35), [bx, bz] = room.W(7, room.cd * 0.62);
  const cr = makeCrime(Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz), SW, null, n + 2, true);
  cr.alert = true; for (const e of cr.list) e.state = 'fight';
  F.crime = cr; F.crimes.push(cr);
  showMsg('KINGPIN WZYWA STRAŻ', 'Pokonaj ich, ale nie odwracaj się od Kingpina!', 3.5);
}

// ---------------------------------------------------------------- aktualizacja
export function updateFisk(dt) {
  if (!F) return;
  syncFight();
  const room = F.room, R = RK(room), L = F.level, fy = floorY(floorOf(L));
  if (P.dead) { if (P.deadT < 0.7 && !F.busy) revive(); return; }
  if (!F.busy) {
    const inRoom = P.pos.x > room.bx0 - 1.5 && P.pos.x < room.bx1 + 1.5 && P.pos.z > room.bz0 - 4 && P.pos.z < room.bz1 + 4 && P.pos.y < fy + room.ch + 1.5 && P.pos.y > fy - 4;
    if (!inRoom) { abortFisk(); return; }
  }
  const b = F.boss, H = b.H;
  updateLift(dt);
  // winda: wejscie po ukonczeniu poziomu jedzie wyzej; stanie w niej 2 s przed ukonczeniem (poziomy 1-5) = wyjscie z misji
  if (!F.busy && L <= 5 && P.state !== 'swing') {
    const lp = R.wp(-R.hw + 1.0, 3.5), d = Math.hypot(P.pos.x - lp.x, P.pos.z - lp.z);
    if (d < 1.3 && Math.abs(P.pos.y - fy) < 1.5) {
      if (F.cleared && L <= 4) nextLevel();
      else { if (F.quitT === 0) popText('ZOSTAŃ W WINDZIE, ABY ZJECHAĆ NA ULICĘ'); F.quitT += dt; if (F.quitT > 2.2) quitMission(); }
    } else F.quitT = 0;
  }
  if (L <= 4 && !F.cleared && F.crime && F.crime.list.every(e => e.dead)) levelCleared();
  if (L === 5) updateLevel5(dt, R, fy);
  if (L === 6) { if (F.phase === 'boss' || F.phase === 'done') G.boss = b.dead ? null : b; }
  if (L < 5) { H.root.visible = false; return; }
  if (L === 5) { // Fisk stoi za szyba i patrzy na gracza
    const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z; b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(2, dt)); b.pos.y = fy;
  }
  const t = b.pt; zeroPose(t);
  if (b.dead) { b.deadT += dt; b.down += (1 - b.down) * damp(3, dt); t.bp = 0.5; t.sLz = 0.8; t.sRz = -0.8; }
  else if (L === 6 && F.phase === 'boss') {
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

// ---------------------------------------------------------------- poziom 5: dzialka strzelaja, szyba blokuje
const bGeo = new THREE.SphereGeometry(0.2, 10, 8), bMat = new THREE.MeshBasicMaterial({ color: 0xffa040 }), bHalo = new THREE.MeshBasicMaterial({ color: 0xff6a10, transparent: true, opacity: 0.28, depthWrite: false });
function fireCannon(c) {
  const dir = new V3(P.pos.x + P.vel.x * 0.3 - c.pos.x, P.pos.y + 1.1 + P.vel.y * 0.1 - c.pos.y, P.pos.z + P.vel.z * 0.3 - c.pos.z).normalize();
  const m = new THREE.Mesh(bGeo, bMat); m.add(new THREE.Mesh(bGeo, bHalo)); m.children[0].scale.setScalar(1.9);
  const p = c.pos.clone().addScaledVector(dir, 1.6); m.position.copy(p); scene.add(m);
  F.bullets.push({ m, pos: p, vel: dir.multiplyScalar(9.5), life: 5, t: 0 }); sfx('shot', 0.7);
  burst(p.x, p.y, p.z, 8, 0xffa040, 4); c.muz.scale.setScalar(1);
}
function updateLevel5(dt, R, fy) {
  const gl = F.glass;
  // pelna blokada szyby (gracz nie przechodzi przez tafle, dopoki nie peknie)
  if (gl && !gl.broken && gl.drop >= 1) {
    const [u, v] = R.uv(P.pos.x, P.pos.z);
    if (v > R.vg - 0.4 && P.pos.y < fy + 8) { const w = R.wp(u, R.vg - 0.42, P.pos.y); P.pos.x = w.x; P.pos.z = w.z; const n = R.wp(0, 1, 0).sub(R.wp(0, 0, 0)), vn = P.vel.x * n.x + P.vel.z * n.z; if (vn > 0) { P.vel.x -= n.x * vn; P.vel.z -= n.z * vn; } }
  }
  if (!F.armed) return;
  // dzialka: celuja, ladowanie (blysk lufy), strzal; oderwane (podniesione/rzucone) nie strzelaja
  for (const c of F.cannons) {
    if (c.dead) continue;
    const det = c.pos.distanceTo(c.home) > 0.45 || c.mesh.position.distanceTo(c.home) > 0.45;
    if (det && !c.det) { c.det = true; c.mesh.visible = true; c.mesh.scale.setScalar(1); }
    if (c.det) { c.muz.scale.setScalar(0.6); continue; }
    c.mesh.position.copy(c.home); c.pos.copy(c.home);
    const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, want = Math.atan2(dx, dz);
    c.head.rotation.y = angLerp(c.head.rotation.y, want, damp(5, dt));
    c.cd -= dt;
    if (c.tele > 0) { c.tele -= dt; c.muz.scale.setScalar(1 + (0.8 - c.tele) * 1.4); if (c.tele <= 0) { fireCannon(c); c.cd = rnd(2.6, 3.6); } }
    else if (c.cd <= 0) { c.tele = 0.8; sfx('reload', 0.5); }
    else c.muz.scale.setScalar(0.8 + Math.sin(G.time * 5) * 0.1);
  }
  // pociski
  for (let i = F.bullets.length - 1; i >= 0; i--) {
    const bl = F.bullets[i]; bl.life -= dt; bl.t += dt; bl.pos.addScaledVector(bl.vel, dt); bl.m.position.copy(bl.pos);
    bl.m.scale.setScalar(1 + Math.sin(bl.t * 20) * 0.12);
    let end = bl.life <= 0 || solidAt(bl.pos.x, bl.pos.y, bl.pos.z);
    const dxp = bl.pos.x - P.pos.x, dyp = bl.pos.y - (P.pos.y + 1.0), dzp = bl.pos.z - P.pos.z;
    if (!end && dxp * dxp + dyp * dyp + dzp * dzp < 0.8 * 0.8) { if (hurtPlayer(9, { pos: bl.pos }, 6)) end = true; else if (P.dodgeT > 0) popText('UNIK!'); }
    if (end) { burst(bl.pos.x, bl.pos.y, bl.pos.z, 12, 0xff8a30, 5); sfx('hit_wall', 0.5); scene.remove(bl.m); F.bullets.splice(i, 1); }
  }
  // zapas dzialek: musi starczyc na pozostale trafienia
  if (gl && !gl.broken) {
    const need = 3 - gl.hits, have = F.cannons.filter(c => !c.dead).length;
    if (have < need) { F.supplyT += dt; if (F.supplyT > 4) { F.supplyT = 0; const c = addCannon(F.cannons.length + gl.hits); c.mesh.scale.setScalar(1); c.mesh.position.copy(c.home); c.mesh.visible = true; popText('NOWE DZIAŁKO!'); sfx('slam', 0.5); } }
    else F.supplyT = 0;
  }
}

function swingCane(b, dist) { // uderzenie laska: obszar przed Kingpinem
  sfx('slam', 0.7); G.shake = Math.max(G.shake, 0.4); burst(b.pos.x + Math.sin(b.yaw) * 2, b.pos.y + 1, b.pos.z + Math.cos(b.yaw) * 2, 20, 0xffe3a0, 6);
  if (dist < 6.2 && Math.abs(P.pos.y - b.pos.y) < 2.5) hurtPlayer(22, b, 14);
}
function grab(b, dist) { // chwyt: nie do zablokowania, trzeba zrobic unik (kolo w czasie 'grabW' zapala sie zmysl pajaka)
  if (dist < 3.2 && Math.abs(P.pos.y - b.pos.y) < 2) { if (hurtPlayer(34, b, 18)) { sfx('slam'); G.shake = 0.7; popText('CHWYT!'); } }
  else popText('UNIK!');
}

// testowanie z konsoli: przeskok poziomu / zabicie fali / trafienie szyby
export const fiskDebug = {
  state: () => F && ({ level: F.level, cleared: F.cleared, phase: F.phase, cp: CP, hits: F.glass && F.glass.hits, cannons: F.cannons.length, busy: F.busy }),
  killWave: () => { if (F && F.crime) for (const e of F.crime.list) if (!e.dead) { e.hp = 0; e.dead = true; } },
  hitGlass: () => { if (F && F.glass) glassHit(1, null); },
  skipTo: n => { if (F) { F.busy = false; wipeLevel(); beginLevel(n); } },
  F: () => F,
};
