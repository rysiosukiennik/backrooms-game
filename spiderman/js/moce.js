// Moce strojow: kazdy stroj ma swoja (pole `power` w SUITS). Wlaczane L3+R3 (klik obu galek) albo V,
// kosztuja 1 pasek skupienia i maja odnowienie. Typy: shock, discharge, webstorm, shadow, regen, rage, haste.
import { V3, clamp } from './util.js';
import { G, P, enemies, scene } from './stan.js';
import { pad, pp, KP } from './wejscie.js';
import { sfx } from './dzwiek.js';
import { solidAt } from './miasto.js';
import { maxHp, buffs } from './umiejetnosci.js';
import { hitEnemy, finishEnemy, burst } from './wrogowie.js';
import { heroLand } from './efekty.js';
import { popText } from './ui.js';

// dur = czas trwania (s), cd = odnowienie (s), col = kolor efektow
export const POWERS = {
  shock: { name: 'WSTRZĄS', icon: '💥', dur: 0, cd: 18, col: 0xffc060, desc: 'Fala uderzeniowa z ziemi: odrzuca i ogłusza wrogów w promieniu 8 m.', sfx: 'shock' },
  discharge: { name: 'WYŁADOWANIE', icon: '⚡', dur: 0, cd: 20, col: 0x7fd8ff, desc: 'Impuls elektryczny: łuki skaczą między wrogami i ogłuszają ich.', sfx: 'zap' },
  webstorm: { name: 'BURZA SIECI', icon: '🕸', dur: 0, cd: 22, col: 0xffffff, desc: 'Automatycznie oplątuje sieciami wszystkich wrogów w promieniu 12 m.', sfx: 'web' },
  shadow: { name: 'CIEŃ', icon: '🌑', dur: 6, cd: 25, col: 0x6a7a99, desc: 'Przez 6 s jesteś niewidzialny: wrogowie tracą cel, a strój robi się półprzezroczysty.', sfx: 'cloak' },
  regen: { name: 'REGENERACJA', icon: '✚', dur: 6, cd: 30, col: 0x4dff88, desc: 'Zielona aura leczy cię przez 6 s: ok. +50% zdrowia.', sfx: 'heal' },
  rage: { name: 'SZAŁ', icon: '🔥', dur: 8, cd: 30, col: 0xff3320, desc: 'Przez 8 s ciosy są dwa razy szybsze i zadają o połowę więcej obrażeń.', sfx: 'rage' },
  haste: { name: 'PRZYSPIESZENIE', icon: '⏳', dur: 4, cd: 28, col: 0xb98cff, desc: 'Przez 4 s świat zwalnia, a ty zachowujesz pełną szybkość.', sfx: 'haste' },
};
export const powerOf = suit => POWERS[(suit && suit.power) || 'shock'];

export const powerState = { suit: '', id: '', name: '', icon: '', desc: '', ready: true, cd: 0, cdMax: 1, active: false, t: 0, dur: 0 };

let cd = 0, cdMax = 1, act = null, actT = 0, actDur = 0;
let t10 = -9999, t11 = -9999, fired = false, flash = '', flashT = 0, hudEl = null, useCount = 0;
let hasteTS = 1, myTS = null, cloakH = null;
const cloakMats = new Map();
const _v = new V3();

// ---------------------------------------------------------------- efekty wizualne
let fxInit = false, aura, auraMat, rings = [], beamLines, beamPos, beamCol, beams = [];
const MAXB = 10, SEG = 8;
function initFx() {
  fxInit = true;
  auraMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  aura = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), auraMat); aura.visible = false; aura.renderOrder = 5; scene.add(aura);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const g = new THREE.RingGeometry(0.86, 1, 56); g.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(g, m); mesh.visible = false; mesh.renderOrder = 5; scene.add(mesh);
    rings.push({ mesh, t: 9, dur: 1, maxR: 1 });
  }
  const geo = new THREE.BufferGeometry();
  beamPos = new Float32Array(MAXB * SEG * 6); beamCol = new Float32Array(MAXB * SEG * 6);
  geo.setAttribute('position', new THREE.BufferAttribute(beamPos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(beamCol, 3));
  beamLines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  beamLines.frustumCulled = false; beamLines.visible = false; beamLines.renderOrder = 6; scene.add(beamLines);
}
function ring(x, y, z, maxR, dur, hex) {
  const r = rings.find(q => q.t >= q.dur) || rings[0];
  r.t = 0; r.dur = dur; r.maxR = maxR; r.mesh.position.set(x, y, z); r.mesh.material.color.setHex(hex); r.mesh.visible = true;
}
function addBeam(a, b, hex, dur = 0.4, jit = 0.35) {
  if (beams.length >= MAXB) beams.shift();
  beams.push({ a: a.clone(), b: b.clone(), t: 0, dur, hex, jit });
}
function updateBeams(dt) {
  let n = 0;
  const c = new THREE.Color();
  for (let i = beams.length - 1; i >= 0; i--) { beams[i].t += dt; if (beams[i].t >= beams[i].dur) beams.splice(i, 1); }
  for (const bm of beams) {
    const k = 1 - bm.t / bm.dur; c.setHex(bm.hex);
    let px = bm.a.x, py = bm.a.y, pz = bm.a.z;
    for (let s = 1; s <= SEG; s++) {
      const f = s / SEG, j = s === SEG ? 0 : bm.jit * (1 - bm.t / bm.dur * 0.5);
      const qx = bm.a.x + (bm.b.x - bm.a.x) * f + (Math.random() - 0.5) * j, qy = bm.a.y + (bm.b.y - bm.a.y) * f + (Math.random() - 0.5) * j, qz = bm.a.z + (bm.b.z - bm.a.z) * f + (Math.random() - 0.5) * j;
      const o = n * 6;
      beamPos[o] = px; beamPos[o + 1] = py; beamPos[o + 2] = pz; beamPos[o + 3] = qx; beamPos[o + 4] = qy; beamPos[o + 5] = qz;
      for (let q = 0; q < 2; q++) { beamCol[o + q * 3] = c.r * k * 1.6; beamCol[o + q * 3 + 1] = c.g * k * 1.6; beamCol[o + q * 3 + 2] = c.b * k * 1.6; }
      px = qx; py = qy; pz = qz; n++;
    }
  }
  beamLines.visible = n > 0;
  if (n > 0) { beamLines.geometry.setDrawRange(0, n * 2); beamLines.geometry.attributes.position.needsUpdate = true; beamLines.geometry.attributes.color.needsUpdate = true; }
}
function updateFx(dt) {
  if (!fxInit) return;
  for (const r of rings) {
    if (r.t >= r.dur) { r.mesh.visible = false; continue; }
    r.t += dt; const k = clamp(r.t / r.dur, 0, 1), s = 0.5 + r.maxR * (1 - Math.pow(1 - k, 2.2));
    r.mesh.scale.set(s, 1, s); r.mesh.material.opacity = (1 - k) * 0.85;
  }
  // aura wokol gracza dla mocy trwajacych
  const pw = act && POWERS[act];
  if (pw) {
    aura.visible = true; auraMat.color.setHex(pw.col);
    const k = actT / actDur, pulse = 1 + Math.sin(G.time * 9) * 0.06;
    aura.position.set(P.pos.x, P.pos.y + 1.0, P.pos.z); aura.scale.set(0.95 * pulse, 1.25 * pulse, 0.95 * pulse);
    auraMat.opacity = (act === 'shadow' ? 0.1 : 0.2) * Math.min(1, (1 - k) * 4) * Math.min(1, actT * 6);
  } else aura.visible = false;
  updateBeams(dt);
}

// przezroczysty strj (Cien)
function setCloakVis(on) {
  const H = P.H; if (!H) return;
  if (cloakH !== H) { cloakMats.clear(); cloakH = H; }
  H.root.traverse(o => {
    if (!o.isMesh || !o.material) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      if (on) { if (!cloakMats.has(m)) cloakMats.set(m, { t: m.transparent, o: m.opacity, w: m.depthWrite }); m.transparent = true; m.opacity = 0.2; m.depthWrite = false; m.needsUpdate = true; }
      else if (cloakMats.has(m)) { const s = cloakMats.get(m); m.transparent = s.t; m.opacity = s.o; m.depthWrite = s.w; m.needsUpdate = true; cloakMats.delete(m); }
    }
  });
}

// ---------------------------------------------------------------- dzialanie mocy
const live = e => e && !e.dead && !e.gone && e.type !== 'boss';
function foesIn(r) {
  const out = [];
  for (const e of enemies) { if (e.dead || e.gone || !e.pos) continue; const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z); if (d < r && Math.abs(e.pos.y - P.pos.y) < r) out.push([e, d]); }
  return out.sort((a, b) => a[1] - b[1]);
}
function stun(e, t) {
  if (e.dead || e.gone) return;
  e.stunT = Math.max(e.stunT || 0, t); e.cd = Math.max(e.cd || 0, t);
  if (!e.air && e.type !== 'boss') { e.state = e.type === 'brute' ? 'stun' : 'hurt'; e.t = t; }
}
const chest = e => _v.set(e.pos.x, e.pos.y + 1.2 * (e.scale || 1), e.pos.z);

function begin(id) {
  const pw = POWERS[id]; act = id; actT = 0; actDur = pw.dur;
  if (id === 'shadow') { P.cloak = pw.dur; setCloakVis(true); }
  if (id === 'rage') buffs.dmg = 1.5;
  if (id === 'haste') { hasteTS = 0.45; if ('timeScale' in G) { myTS = hasteTS; G.timeScale = hasteTS; } else myTS = null; }
}
function end() {
  if (act === 'shadow') { P.cloak = 0; setCloakVis(false); }
  if (act === 'rage') buffs.dmg = 1;
  if (act === 'haste' && myTS !== null && G.timeScale === myTS) G.timeScale = 1;
  myTS = null; act = null; actT = 0;
}

function instant(id) {
  const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
  if (id === 'shock') {
    heroLand(px, py, pz, 2); G.shake = Math.max(G.shake, 0.7);
    ring(px, py + 0.15, pz, 8, 0.55, 0xffc060); ring(px, py + 0.15, pz, 5, 0.4, 0xffffff);
    burst(px, py + 0.3, pz, 26, 0xffd9a0, 8);
    for (const [e, d] of foesIn(8)) {
      const k = Math.max(0.2, 1 - d / 9), dx = (e.pos.x - px) / (d || 1), dz = (e.pos.z - pz) / (d || 1);
      if (e.type === 'boss') { hitEnemy(e, 1, dx * 3, 2, dz * 3, false); continue; }
      e.stunT = 3; hitEnemy(e, 0.6 * k + 0.2, dx * 9 * k, 9 * k + 3, dz * 9 * k, true, false); stun(e, 3);
    }
  } else if (id === 'discharge') {
    ring(px, py + 1, pz, 3, 0.35, 0x7fd8ff);
    burst(px, py + 1.2, pz, 14, 0x7fd8ff, 5);
    let from = new V3(px, py + 1.2, pz), pool = foesIn(14).map(q => q[0]), hops = 0;
    while (pool.length && hops < 8) {
      pool.sort((a, b) => a.pos.distanceTo(from) - b.pos.distanceTo(from));
      const e = pool.shift(); if (hops > 0 && e.pos.distanceTo(from) > 10) break;
      const to = chest(e).clone(); addBeam(from, to, hops % 2 ? 0xffffff : 0x7fd8ff, 0.45, 0.5);
      burst(to.x, to.y, to.z, 10, 0x7fd8ff, 4);
      if (e.type !== 'boss') { e.stunT = 3; hitEnemy(e, 0.5, 0, 0, 0, false, true); stun(e, 3.5); } else hitEnemy(e, 1, 0, 0, 0, false);
      from = to; hops++;
    }
    G.shake = Math.max(G.shake, 0.25);
  } else if (id === 'webstorm') {
    ring(px, py + 1, pz, 12, 0.6, 0xffffff);
    const from = new V3(px, py + 1.3, pz); let n = 0;
    for (const [e] of foesIn(12)) {
      if (!live(e)) continue;
      addBeam(from, chest(e).clone(), 0xffffff, 0.5, 0.15);
      finishEnemy(e); n++;
    }
    if (n === 0) burst(px, py + 1, pz, 16, 0xffffff, 6);
  }
}

// ---------------------------------------------------------------- uzycie
function msg(t) { flash = t; flashT = 1.6; }
export function usePower() {
  const pw = powerOf(P.suit), id = (P.suit && P.suit.power) || 'shock';
  if (P.dead || G.state !== 'play') return false;
  if (act) { msg('MOC JEST AKTYWNA'); return false; }
  if (cd > 0) { msg('ODNOWIENIE ' + Math.ceil(cd) + ' s'); sfx('ui', 0.4); return false; }
  if (P.focus < 1) { msg('BRAK PASKA SKUPIENIA'); sfx('hurt', 0.25); return false; }
  P.focus -= 1; cd = cdMax = pw.cd; useCount++;
  if (!fxInit) initFx();
  sfx('power', 1, null, pw.sfx);
  popText(pw.name + '!');
  const cinematic = P.pos;
  ring(cinematic.x, cinematic.y + 0.2, cinematic.z, 3.5, 0.5, pw.col);
  if (pw.dur > 0) begin(id); else instant(id);
  return true;
}

export function updatePowers(dt) {
  const pw = powerOf(P.suit);
  powerState.suit = P.suit ? P.suit.id : ''; powerState.id = (P.suit && P.suit.power) || 'shock';
  powerState.name = pw.name; powerState.icon = pw.icon; powerState.desc = pw.desc;
  if (G.state !== 'play') { hudShow(false); return; }
  // wejscie: L3 + R3 (okno 120 ms, zbocze) albo klawisz V
  const now = performance.now();
  if (pp(10)) t10 = now; if (pp(11)) t11 = now;
  const both = pad.b[10] && pad.b[11];
  if (both && !fired && Math.abs(t10 - t11) < 120 && now - Math.max(t10, t11) < 200) { fired = true; usePower(); }
  if (!both) fired = false;
  if (KP.KeyV) usePower();

  if (cd > 0) cd = Math.max(0, cd - dt);
  if (act) {
    actT += dt;
    if (P.dead || actT >= actDur) end();
    else if (act === 'shadow') P.cloak = actDur - actT;
    else if (act === 'regen') {
      const mh = maxHp(); P.hp = Math.min(mh, P.hp + mh * 0.5 / actDur * dt); P.regenT = Math.max(P.regenT, 1);
      if (Math.random() < dt * 14) burst(P.pos.x + (Math.random() - 0.5) * 0.9, P.pos.y + 0.2 + Math.random() * 1.6, P.pos.z + (Math.random() - 0.5) * 0.9, 1, 0x5cff8a, 1.2);
    } else if (act === 'rage') {
      P.atkCD -= dt; P.comboT += dt * 0.3; // dwa razy szybsze ciosy
      if (Math.random() < dt * 12) burst(P.pos.x, P.pos.y + 1, P.pos.z, 1, 0xff4a2a, 2.5);
    } else if (act === 'haste') {
      // swiat zwolniony (G.timeScale, jesli istnieje); gracz nadrabia ruchem, wiec zachowuje pelna szybkosc
      const ts = myTS !== null ? (G.timeScale || 1) : 1, extra = (myTS !== null ? 1.15 : 1.5) - ts;
      if (extra > 0 && !P.dead && !P.fin && (P.state === 'ground' || P.state === 'air' || P.state === 'swing')) {
        const dx = P.vel.x * dt * extra, dy = P.vel.y * dt * extra, dz = P.vel.z * dt * extra;
        if (!solidAt(P.pos.x + dx, P.pos.y + 1, P.pos.z + dz) && (P.state !== 'ground' || P.vel.lengthSq() > 0.01)) { P.pos.x += dx; P.pos.z += dz; if (P.state !== 'ground') P.pos.y += dy; }
      }
      P.atkCD -= dt * 0.6; P.dodgeCD -= dt * 0.6;
      if (Math.random() < dt * 10) burst(P.pos.x, P.pos.y + 1, P.pos.z, 1, 0xb98cff, 2);
    }
  }
  if (P.H && act === 'shadow' && cloakH !== P.H) setCloakVis(true); // nowy model po zmianie stroju
  powerState.cd = cd; powerState.cdMax = cdMax; powerState.ready = cd <= 0 && !act;
  powerState.active = !!act; powerState.t = act ? actT : 0; powerState.dur = act ? actDur : 0;
  updateFx(dt); updatePowerHUD(dt);
}

// ---------------------------------------------------------------- HUD (prawy dolny rog nad podpowiedziami)
function hudBuild() {
  const st = document.createElement('style');
  st.textContent = '#power{position:absolute;right:30px;bottom:200px;min-width:230px;padding:8px 12px 9px;background:rgba(5,20,30,.78);border-right:4px solid var(--cy,#3fe3ff);font-weight:700;text-align:right;text-shadow:0 2px 4px #000;pointer-events:none}'
    + '#power .pn{font-size:18px;letter-spacing:1px}#power .pi{font-size:24px;margin-left:8px;vertical-align:middle}#power .pk{font-size:13px;opacity:.75;letter-spacing:2px;margin-top:1px}'
    + '#power .pb{height:6px;margin-top:5px;background:rgba(255,255,255,.18)}#power .pb i{display:block;height:100%;width:100%;background:var(--cy,#3fe3ff)}'
    + '#power.rdy .pb i{box-shadow:0 0 8px var(--cy,#3fe3ff)}#power.act{border-right-color:#ffd24a}#power.act .pb i{background:#ffd24a}#power .pm{font-size:14px;color:#ff7b6b;min-height:17px}';
  document.head.appendChild(st);
  hudEl = document.createElement('div'); hudEl.id = 'power';
  hudEl.innerHTML = '<div class="pm"></div><div class="pn"></div><div class="pk"></div><div class="pb"><i></i></div>';
  const h = document.getElementById('hud'); (h || document.body).appendChild(hudEl);
}
function hudShow(v) { if (hudEl) hudEl.style.display = v ? '' : 'none'; }
let lastSig = '', lastB = 0;
export function updatePowerHUD(dt = 0) {
  if (!hudEl) { if (!document.getElementById('hud')) return; hudBuild(); }
  hudEl.style.display = '';
  const pr = document.getElementById('prompts'); if (pr) { const b = 40 + pr.offsetHeight; if (b !== lastB) { lastB = b; hudEl.style.bottom = b + 'px'; } }
  if (flashT > 0) { flashT -= dt; if (flashT <= 0) flash = ''; }
  const S = powerState, key = G.lastDev === 'pad' ? 'L3 + R3' : 'V';
  const sig = S.id + key + flash + (S.active ? 'a' : S.ready ? 'r' : 'c');
  if (sig !== lastSig) {
    lastSig = sig;
    hudEl.querySelector('.pm').textContent = flash;
    hudEl.querySelector('.pn').innerHTML = `${S.name}<span class="pi">${S.icon}</span>`;
    hudEl.querySelector('.pk').textContent = (S.active ? 'AKTYWNA' : S.ready ? 'GOTOWA' : 'ODNOWIENIE') + ' · ' + key;
    hudEl.className = S.active ? 'act' : S.ready ? 'rdy' : '';
  }
  const f = S.active ? 1 - S.t / (S.dur || 1) : S.cdMax ? 1 - S.cd / S.cdMax : 1;
  hudEl.querySelector('.pb i').style.width = clamp(f, 0, 1) * 100 + '%';
}

// zerowanie przy restarcie / powrocie do menu
export function resetPowers() { if (act) end(); cd = 0; beams.length = 0; }
