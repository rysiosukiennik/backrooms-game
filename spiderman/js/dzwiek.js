// Dzwiek: wszystko generowane w locie (WebAudio) — bez plikow audio (gra dziala z file://).
// Warstwy tla miasta (zaleznie od wysokosci / dzielnicy / pory dnia), pogloc (konwolwer z wygenerowanym
// impulsem), filtr w pomieszczeniach, dzwieki z pozycji (panning + tlumienie odlegloscia), muzyka filmowa
// z intensywnoscia. API dla reszty gry: initAudio, setWind, setMusic, setMusicMode, setMusicIntensity,
// cityAmbience(dt, nisko), sfx(nazwa, glosnosc, pozycja?), audioOK.
import { G, P, camera } from './stan.js';
import { save, V3 } from './util.js';
import { districtAt, inPark } from './miasto.js';

let AC = null, OFFLINE = false;
let master, comp, mix, roomLP, revSend, conv, revRet, musBus, musRevSend, duckMix, duckMus;
let nWhite, nPink, nBrown;
const Ly = {}; // warstwy ciagle (petle szumu / oscylatory)

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const rr = (a, b) => a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const live = () => AC && (OFFLINE || AC.state === 'running');
export const audioOK = () => !!(AC && AC.state === 'running');

// ---------------------------------------------------------------- budowa grafu
// Dla glos.js: kontekst i wezly grafu (null przed initAudio) oraz stan otoczenia (0..1) do pogloszu glosu.
export function audioGraph() { return AC && !OFFLINE ? { ac: AC, master, conv, duckMix, duckMus } : null; }
export function audioEnv() { return { indoor: ind, canyon, street: streetF }; }
export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  let ctx;
  try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  build(ctx, false);
}

function makeNoise(kind, secs) {
  const n = (AC.sampleRate * secs) | 0, b = AC.createBuffer(1, n, AC.sampleRate), d = b.getChannelData(0);
  if (kind === 'white') for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  else if (kind === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
  } else { let l = 0; for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } }
  return b;
}
// impuls pogloszu: gesty szum z wykladniczym zanikiem, z czasem coraz ciemniejszy + kilka wczesnych odbic
function makeIR(secs) {
  const sr = AC.sampleRate, n = (sr * secs) | 0, b = AC.createBuffer(2, n, sr);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / n, k = 0.8 - 0.72 * t;
      lp += ((Math.random() * 2 - 1) - lp) * k;
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < sr * 0.02 ? i / (sr * 0.02) : 1);
    }
    for (let e = 0; e < 7; e++) { const p = ((0.012 + Math.random() * 0.09) * sr) | 0; d[p] += (Math.random() < 0.5 ? -1 : 1) * rr(0.4, 0.9); }
  }
  return b;
}
function loopSrc(buf) { const s = AC.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * buf.duration * 0.9); return s; }
function layer(buf, type, f, q, dest = mix) {
  const s = loopSrc(buf), fl = AC.createBiquadFilter(), g = AC.createGain(), m = AC.createGain(); // m = modulacja (mnozy), g = poziom
  fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0;
  s.connect(fl).connect(m).connect(g).connect(dest); return { g, f: fl, m };
}
function oscLayer(type, f, lpF, dest = mix) {
  const o = AC.createOscillator(), fl = AC.createBiquadFilter(), g = AC.createGain();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lpF; g.gain.value = 0;
  o.connect(fl).connect(g).connect(dest); o.start(); return { g, o, f: fl };
}
function lfo(freq, depth, param, type = 'sine') {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = depth;
  o.connect(g).connect(param); o.start(); return o;
}
function panner(p) { if (!AC.createStereoPanner) return null; const n = AC.createStereoPanner(); n.pan.value = p; return n; }

function build(ctx, offline) {
  AC = ctx; OFFLINE = offline;
  master = AC.createGain(); master.gain.value = 1;
  comp = AC.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.22;
  master.connect(comp).connect(AC.destination);
  roomLP = AC.createBiquadFilter(); roomLP.type = 'lowpass'; roomLP.frequency.value = 20000; roomLP.Q.value = 0.4; roomLP.connect(master);
  duckMix = AC.createGain(); duckMix.connect(roomLP); // duckMix/duckMus: sciszanie tla i muzyki na czas mowy (glos.js)
  mix = AC.createGain(); mix.connect(duckMix);
  conv = AC.createConvolver(); conv.buffer = makeIR(offline ? 1.6 : 2.4);
  revSend = AC.createGain(); revSend.gain.value = 0.08; mix.connect(revSend).connect(conv);
  revRet = AC.createGain(); revRet.gain.value = 0.9; conv.connect(revRet).connect(roomLP);
  duckMus = AC.createGain(); duckMus.connect(master);
  musBus = AC.createGain(); musBus.gain.value = 0; musBus.connect(duckMus);
  musRevSend = AC.createGain(); musRevSend.gain.value = 0.22; musBus.connect(musRevSend).connect(conv);

  nWhite = makeNoise('white', 2); nPink = makeNoise('pink', 4); nBrown = makeNoise('brown', 4);

  // wiatr z predkosci (swist) + wiatr otoczenia (porywy)
  Ly.wind = layer(nPink, 'bandpass', 500, 0.6);
  Ly.whistle = layer(nPink, 'bandpass', 1800, 6);
  Ly.rumble = layer(nBrown, 'lowpass', 160, 0.5);
  Ly.amb = layer(nPink, 'bandpass', 380, 0.5);
  lfo(0.11, 0.5, Ly.amb.m.gain); lfo(0.29, 0.3, Ly.amb.m.gain);
  // ruch uliczny (dudnienie + szum opon), szum miasta, gwar tlumu
  Ly.traf = layer(nBrown, 'lowpass', 240, 0.6);
  Ly.tire = layer(nPink, 'bandpass', 900, 0.5);
  lfo(0.07, 0.25, Ly.traf.m.gain);
  Ly.hum = layer(nPink, 'lowpass', 700, 0.4);
  Ly.crowd = layer(nPink, 'bandpass', 620, 0.9);
  Ly.crowd2 = layer(nPink, 'bandpass', 1500, 1.4);
  lfo(0.9, 0.4, Ly.crowd.m.gain); lfo(1.7, 0.3, Ly.crowd.m.gain); lfo(0.6, 0.3, Ly.crowd2.m.gain);
  Ly.room = layer(nBrown, 'lowpass', 320, 0.5);
  // neony i transformatory (50/60 Hz + harmoniczne), wentylatory na dachach
  Ly.neon = oscLayer('sawtooth', 100, 520);
  Ly.neon2 = oscLayer('square', 3140, 4500);
  Ly.fan = oscLayer('sawtooth', 48, 140);
  // swierszcze: nosna ~4,5 kHz modulowana szybkim lfo i wolna bramka
  for (let i = 0; i < 2; i++) {
    const o = AC.createOscillator(), cg = AC.createGain(), gate = AC.createGain(), out = AC.createGain(), pn = panner(i ? 0.6 : -0.6);
    o.frequency.value = i ? 4720 : 4380; cg.gain.value = 0.5; gate.gain.value = 0.5; out.gain.value = 0;
    lfo(i ? 27 : 31, 0.5, cg.gain); lfo(i ? 0.42 : 0.31, 0.5, gate.gain);
    o.connect(cg).connect(gate).connect(out); pn ? out.connect(pn).connect(mix) : out.connect(mix); o.start();
    Ly['cr' + i] = { g: out };
  }
  // napiecie liny przy bujaniu (skrzypienie)
  Ly.rope = layer(nPink, 'bandpass', 420, 11);
  lfo(3.1, 0.3, Ly.rope.m.gain);

  startMusic();
}

// ---------------------------------------------------------------- prymitywy
function nz(dur, type, f, vol, f2, dest = mix, t = AC.currentTime, q = 0.8) {
  const s = AC.createBufferSource(); s.buffer = nWhite;
  const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  const g = AC.createGain();
  g.gain.setValueAtTime(Math.max(0.0002, vol), t); g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  s.connect(fl).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function tone(type, f1, f2, dur, vol, delay = 0, dest = mix, t0 = AC.currentTime, attack = 0) {
  const o = AC.createOscillator(); o.type = type;
  const g = AC.createGain(); const t = t0 + delay;
  o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); }
  else g.gain.setValueAtTime(Math.max(0.0002, vol), t);
  g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
// dzwonek z podtonami nieharmonicznymi
function bell(dest, t, f, dur, vol) {
  [[1, 1, 1], [2.76, 0.45, 0.6], [5.4, 0.22, 0.35], [8.9, 0.1, 0.2]].forEach(([r, a, d]) => tone('sine', f * r, f * r, dur * d, vol * a, 0, dest, t));
}
// glos (formanty): do chrzaknieC, okrzykow i jekow bandytow
function voice(dest, t, f0, f0e, dur, vol, fa, fb, att = 0.03) {
  const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0e, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + att); g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
  const b1 = AC.createBiquadFilter(), b2 = AC.createBiquadFilter(), g2 = AC.createGain();
  b1.type = b2.type = 'bandpass'; b1.frequency.setValueAtTime(fa, t); b1.frequency.linearRampToValueAtTime(fa * rr(0.8, 1.2), t + dur); b1.Q.value = 5; b2.frequency.value = fb; b2.Q.value = 7; g2.gain.value = 0.7;
  o.connect(g); g.connect(b1).connect(dest); g.connect(b2).connect(g2).connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
  nz(dur * 0.8, 'bandpass', fa * 1.8, vol * 0.25, 0, dest, t, 1.2); // oddech
}

// ---------------------------------------------------------------- sluchacz i przestrzen
const _fw = new V3();
const L = { x: 0, y: 0, z: 0, fx: 0, fz: -1, rx: 1, rz: 0 };
function updateListener() {
  try {
    camera.getWorldDirection(_fw);
    const h = Math.hypot(_fw.x, _fw.z) || 1; L.fx = _fw.x / h; L.fz = _fw.z / h; L.rx = -L.fz; L.rz = L.fx;
    L.x = camera.position.x; L.y = camera.position.y; L.z = camera.position.z;
  } catch (e) { /* bez kamery: zrodla bez pozycji */ }
}
const getPos = p => Array.isArray(p) ? { x: p[0], y: p[1], z: p[2] } : p;
// wezel wejsciowy dla zrodla w odleglosci d, na panoramie pan: tlumienie 1/(1+(d/R)^2), ciemnienie z odlegloscia
function route(d, pan, vol = 1) {
  const g = AC.createGain(), lp = AC.createBiquadFilter(), pn = panner(pan * Math.min(1, 0.25 + d / 4));
  g.gain.value = vol / (1 + (d / 24) * (d / 24));
  lp.type = 'lowpass'; lp.frequency.value = clamp(18000 / (1 + d / 16), 700, 18000);
  g.connect(lp); pn ? lp.connect(pn).connect(mix) : lp.connect(mix);
  return g;
}
function spatial(pos) {
  updateListener();
  const dx = pos.x - L.x, dy = pos.y - L.y, dz = pos.z - L.z, d = Math.hypot(dx, dy, dz) || 0.01;
  const pan = clamp((dx * L.rx + dz * L.rz) / d, -1, 1);
  return { out: route(d, pan), delay: d > 30 ? Math.min(0.6, (d - 30) / 343) : 0, d };
}

// ---------------------------------------------------------------- wiatr
let spd = 0, pauseMuf = 0;
export function setWind(speed) {
  if (!live()) return;
  spd = speed;
  const t = AC.currentTime, v = clamp((speed - 6) / 46, 0, 1);
  Ly.wind.g.gain.setTargetAtTime(Math.pow(v, 1.3) * 0.4, t, 0.12);
  Ly.wind.f.frequency.setTargetAtTime(320 + v * 1500, t, 0.12);
  Ly.whistle.g.gain.setTargetAtTime(Math.pow(v, 2.2) * 0.1, t, 0.15);
  Ly.whistle.f.frequency.setTargetAtTime(1500 + v * 2600, t, 0.15);
  Ly.rumble.g.gain.setTargetAtTime(v * v * 0.22, t, 0.2);
  const pm = G.state === 'pause' ? 1 : 0;
  if (pm !== pauseMuf) { pauseMuf = pm; applyRoom(); }
}

// ---------------------------------------------------------------- efekty
const last = {}, vari = {};
const BOOST = { whoosh: 3, hurt: 2, grunt: 2.5, horn: 2.2, step: 1.6, pedstep: 2, rope: 2.2, webhit: 1.4, ui: 1.4, bandit: 1.5, splat: 1.3 }; // wyrownanie glosnosci
function nextVar(n, k) { let v; do v = (Math.random() * k) | 0; while (v === vari[n] && k > 1); vari[n] = v; return v; }

export function sfx(n, v = 1, pos = null, surf = null) {
  if (!live()) return;
  const now = AC.currentTime;
  if (last[n] !== undefined && now >= last[n] && now - last[n] < 0.03) return; // ochrona przed lawina tych samych dzwiekow
  last[n] = now;
  v = Math.max(0.01, v) * (BOOST[n] || 1);
  let out = mix, t = now;
  if (pos) { const s = spatial(getPos(pos)); out = s.out; t += s.delay; }
  const N = (dur, type, f, vol, f2, dl = 0, q) => nz(dur, type, f, vol * v, f2, out, t + dl, q);
  const T = (type, f1, f2, dur, vol, dl = 0, att = 0) => tone(type, f1, f2, dur, vol * v, dl, out, t, att);
  switch (n) {
    case 'thwip': { // wystrzal sieci: syk + pstryk, po chwili przyczepienie do budynku
      const k = rr(0.9, 1.15), w = nextVar(n, 2);
      N(0.14, 'bandpass', 2400 * k, 0.34, 7000 * k, 0, 1.2); N(0.05, 'highpass', 5000, 0.12);
      T('triangle', 1500 * k, 380, 0.08, 0.07); T('sine', 260, 110, 0.05, 0.14);
      if (w) N(0.09, 'highpass', 3500, 0.1, 9000, 0.03);
      N(0.05, 'bandpass', 1300, 0.2, 700, 0.14, 2); T('sine', 200, 85, 0.07, 0.15, 0.14); // thwack
      break;
    }
    case 'webhit': N(0.05, 'bandpass', 1300, 0.25, 700, 0, 2); T('sine', 200, 85, 0.07, 0.18); break;
    case 'rope': { // skrzypienie napietej liny
      const f = rr(70, 110);
      T('sawtooth', f, f * rr(1.1, 1.35), 0.35, 0.03, 0, 0.05);
      N(0.35, 'bandpass', rr(350, 520), 0.09, rr(600, 800), 0, 9); break;
    }
    case 'punch': {
      const w = nextVar(n, 4), b = rr(0.9, 1.15);
      if (w === 0) { T('sine', 170 * b, 42, 0.17, 0.7); N(0.07, 'lowpass', 1500, 0.4); N(0.05, 'bandpass', 700, 0.18); }
      else if (w === 1) { T('sine', 210 * b, 55, 0.12, 0.55); N(0.05, 'bandpass', 2300, 0.4, 900, 0, 1.2); N(0.12, 'bandpass', 900, 0.15, 400); }
      else if (w === 2) { T('sine', 130 * b, 38, 0.2, 0.75); N(0.1, 'lowpass', 800, 0.4); T('triangle', 300, 120, 0.06, 0.12); }
      else { T('sine', 160 * b, 45, 0.14, 0.6); N(0.04, 'lowpass', 1800, 0.35); T('sine', 120 * b, 40, 0.1, 0.4, 0.06); N(0.04, 'lowpass', 1200, 0.2, 0, 0.06); }
      break;
    }
    case 'hit_body': T('sine', 120 * rr(0.9, 1.2), 38, 0.18, 0.7); N(0.1, 'lowpass', 700, 0.45); N(0.04, 'bandpass', 1800, 0.18, 800, 0.01, 1.5); break;
    case 'hit_wall': T('sine', 85, 30, 0.3, 0.8); N(0.25, 'lowpass', 600, 0.5, 200); N(0.4, 'bandpass', 3000, 0.07, 1500, 0.05); break;
    case 'block': {
      const w = nextVar(n, 2);
      if (w) { T('triangle', 420, 240, 0.08, 0.16); N(0.07, 'bandpass', 1600, 0.28, 800, 0, 1.2); T('sine', 140, 60, 0.1, 0.25); }
      else { T('square', 900, 700, 0.08, 0.1); N(0.1, 'highpass', 3000, 0.22); T('sine', 180, 70, 0.1, 0.3); }
      break;
    }
    case 'shot': { // wystrzal: trzask + huk + echo od scian
      N(0.04, 'highpass', 1800, 0.5, 0, 0, 0.7);
      N(0.3, 'lowpass', 2800, 0.6, 260); T('sine', 150, 45, 0.12, 0.35); T('square', 180, 60, 0.07, 0.08);
      N(0.55, 'lowpass', 1100, 0.14, 250, 0.1); N(0.7, 'lowpass', 700, 0.07, 200, 0.24);
      break;
    }
    case 'ricochet': { const f = rr(2000, 3400); T('sine', f, f * 0.4, 0.28, 0.1); N(0.05, 'highpass', 4000, 0.2); break; }
    case 'reload': N(0.03, 'highpass', 2500, 0.3, 0, 0, 2); T('square', 700, 500, 0.03, 0.05); N(0.04, 'bandpass', 3000, 0.3, 0, 0.18, 3); T('triangle', 330, 250, 0.05, 0.08, 0.18); break;
    case 'whoosh': {
      const up = Math.random() < 0.5, d = rr(0.22, 0.38);
      N(d, 'bandpass', up ? 350 : 1900, 0.3, up ? 2000 : 380, 0, 0.9); N(d * 0.7, 'highpass', 3500, 0.05, 6000); break;
    }
    case 'land': {
      const s = surf || curSurf;
      T('sine', 105, 33, 0.28, 0.65); N(0.16, 'lowpass', 500, 0.3);
      if (s === 'metal') { T('triangle', 240, 220, 0.3, 0.1); N(0.2, 'bandpass', 2400, 0.12, 1800, 0, 3); }
      else if (s === 'gravel') N(0.25, 'highpass', 2200, 0.16, 4000);
      else if (s === 'grass') N(0.2, 'lowpass', 600, 0.18);
      else N(0.1, 'bandpass', 1800, 0.12, 800, 0, 1.5);
      N(0.18, 'bandpass', 600, 0.1, 300, 0.03); // szelest ubrania
      break;
    }
    case 'slam': {
      T('sine', 72, 24, 0.65, 0.9); N(0.5, 'lowpass', 320, 0.6); N(0.6, 'bandpass', 2500, 0.06, 1200, 0.05);
      for (let i = 0; i < 4; i++) T('triangle', rr(1800, 4200), rr(900, 1500), 0.04, 0.03, rr(0.08, 0.4)); // odlamki
      break;
    }
    case 'hurt': {
      const f = rr(105, 150);
      voice(out, t, f * 1.2, f * 0.7, 0.26, 0.2 * v, 650, 1100);
      T('sine', 110, 40, 0.1, 0.25); break;
    }
    case 'grunt': { const f = rr(90, 130); voice(out, t, f, f * 0.75, 0.2, 0.16 * v, rr(450, 700), rr(900, 1200)); break; }
    case 'bandit': { // okrzyk bandyty
      const f = rr(95, 135), w = nextVar(n, 3);
      if (w === 0) voice(out, t, f * 1.4, f * 1.5, 0.28, 0.18 * v, 800, 1200); // "hej!"
      else if (w === 1) { voice(out, t, f * 1.2, f * 1.3, 0.16, 0.16 * v, 550, 950); voice(out, t + 0.2, f * 1.3, f * 1.0, 0.24, 0.17 * v, 750, 1100); }
      else voice(out, t, f * 1.6, f * 1.0, 0.4, 0.17 * v, 700, 1350, 0.06);
      break;
    }
    case 'splat': N(0.12, 'bandpass', 900, 0.3, 300); T('sine', 180, 70, 0.1, 0.18); N(0.2, 'bandpass', 500, 0.1, 250, 0.06); break;
    case 'crash': { // zderzenie: metal + szklo + huk
      N(0.7, 'lowpass', 1800, 0.7, 200); T('sawtooth', 120, 40, 0.5, 0.2); T('sine', 70, 28, 0.6, 0.6);
      for (let i = 0; i < 6; i++) N(0.12, 'bandpass', rr(900, 2400), 0.25, rr(500, 1500), rr(0, 0.35), 4); // blacha
      for (let i = 0; i < 10; i++) T('sine', rr(3500, 8500), rr(3000, 6000), rr(0.04, 0.1), 0.06, rr(0.02, 0.7)); // szklo
      break;
    }
    case 'glass': for (let i = 0; i < 12; i++) T('sine', rr(3000, 9000), rr(2500, 6000), rr(0.04, 0.12), 0.07, rr(0, 0.5)); N(0.2, 'highpass', 5000, 0.2); break;
    case 'ring': bell(out, t, 1200, 0.5, 0.16 * v); tone('sine', 1760, 2200, 0.2, 0.1 * v, 0.07, out, t); break;
    case 'fin': T('sawtooth', 200, 800, 0.35, 0.1); N(0.4, 'bandpass', 800, 0.3, 3000); T('sine', 90, 30, 0.5, 0.8, 0.35); N(0.5, 'lowpass', 400, 0.5, 120, 0.35); break;
    case 'cola': N(0.06, 'highpass', 2500, 0.6, 8000); N(0.9, 'highpass', 5000, 0.18, 9000); T('sine', 300, 120, 0.25, 0.15, 0.9); N(0.12, 'bandpass', 500, 0.1, 250, 1.0); break;
    case 'horn': { // klakson: rozne tony aut, czasem podwojny
      const f = rr(300, 480), two = Math.random() < 0.3, d = rr(0.25, 0.5);
      const hn = dl => { T('square', f, f, d, 0.06, dl, 0.01); T('sawtooth', f * 1.26, f * 1.26, d, 0.05, dl, 0.01); T('sawtooth', f * 2.01, f * 2.01, d, 0.015, dl); };
      hn(0); if (two) hn(d + 0.12); break;
    }
    case 'pickup': [660, 880, 1320].forEach((f, i) => bell(out, t + i * 0.07, f, 0.35, 0.1 * v)); break;
    case 'level': [523, 659, 784, 1046].forEach((f, i) => { T('sawtooth', f, f * 1.005, 0.4, 0.05, i * 0.1, 0.03); T('triangle', f * 2, f * 2, 0.3, 0.06, i * 0.1); bell(out, t + i * 0.1, f * 2, 0.5, 0.05 * v); }); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => { T('sawtooth', f, f, 0.3, 0.05, i * 0.09, 0.02); T('triangle', f, f, 0.3, 0.12, i * 0.09); }); bell(out, t + 0.4, 1568, 0.7, 0.08 * v); break;
    case 'alarm': for (let i = 0; i < 3; i++) { T('square', 700, 950, 0.22, 0.07, i * 0.25); T('triangle', 1400, 1900, 0.22, 0.03, i * 0.25); } N(0.6, 'bandpass', 1500, 0.04, 1200, 0, 3); break;
    case 'ui': T('sine', 900, 700, 0.05, 0.08); N(0.02, 'highpass', 5000, 0.05); break;
    case 'step': step(out, t, surf || curSurf, (v > 0.8), v, false); break;
    case 'pedstep': step(out, t, surf || 'pavement', false, v, true); break;
    case 'siren': siren(); break;
  }
}
export function sfxAt(n, pos, v = 1) { sfx(n, v, pos); }

// kroki: nawierzchnia (pavement / metal / gravel / grass / wood), bieg = glosniej i twardziej
function step(out, t, s, run, v, ped) {
  const k = rr(0.85, 1.2), a = (run ? 0.5 : 0.32) * v * (ped ? 0.7 : 1);
  if (s === 'metal') { tone('triangle', rr(330, 470), 200, 0.14, 0.09 * a * 2, 0, out, t); nz(0.05, 'bandpass', 2400 * k, 0.2 * a, 0, out, t, 2); tone('sine', 95, 50, 0.07, 0.25 * a, 0, out, t); }
  else if (s === 'gravel') { for (let i = 0; i < 4; i++) nz(0.03, 'highpass', 2600 * k, 0.16 * a, 0, out, t + i * 0.012, 1); tone('sine', 90, 50, 0.06, 0.18 * a, 0, out, t); }
  else if (s === 'grass') { nz(0.1, 'lowpass', 750 * k, 0.28 * a, 300, out, t); nz(0.05, 'highpass', 4000, 0.04 * a, 0, out, t); }
  else if (s === 'wood') { tone('sine', 150 * k, 90, 0.07, 0.3 * a, 0, out, t); nz(0.05, 'bandpass', 900 * k, 0.22 * a, 500, out, t, 1.5); }
  else { nz(0.035, 'bandpass', 1900 * k, 0.28 * a, 900, out, t, 1.4); tone('sine', 100 * k, 55, 0.06, 0.22 * a, 0, out, t); nz(0.08, 'lowpass', 600, 0.1 * a, 0, out, t + 0.01); }
}

// ---------------------------------------------------------------- muzyka
// Progresja a-moll (8 taktow), warstwy wchodza z intensywnoscia 0..1: smyczki i roznosc basu, waltornie
// (podczas bujania), arpeggio z opoznieniem, potem taiko, werbel i talerze w walce. Tempo rosnie z intensywnoscia.
let musOn = true, mode = 'calm', userInt = 0, mi = 0.1, swingF = 0, stepN = 0, nextT = 0, timer = null;
let padLP, padG, bassLP, hornLP, dIn, vibG;
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]];
const MEL = [
  [[0, 69, 6], [6, 72, 2], [8, 76, 8]], [[0, 77, 6], [6, 76, 2], [8, 72, 8]],
  [[0, 72, 4], [4, 74, 4], [8, 76, 4], [12, 79, 4]], [[0, 79, 8], [8, 74, 4], [12, 71, 4]],
  [[0, 76, 6], [6, 74, 2], [8, 72, 8]], [[0, 77, 8], [8, 81, 8]],
  [[0, 74, 6], [6, 77, 2], [8, 81, 6], [14, 79, 2]], [[0, 80, 8], [8, 76, 4], [12, 71, 4]],
];
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
const BASEVOL = 0.08;
function startMusic() {
  musBus.gain.value = musOn ? BASEVOL : 0;
  padLP = AC.createBiquadFilter(); padLP.type = 'lowpass'; padLP.frequency.value = 900; padLP.Q.value = 0.5;
  padG = AC.createGain(); padG.gain.value = 1; padLP.connect(padG).connect(musBus);
  bassLP = AC.createBiquadFilter(); bassLP.type = 'lowpass'; bassLP.frequency.value = 500; bassLP.connect(musBus);
  hornLP = AC.createBiquadFilter(); hornLP.type = 'lowpass'; hornLP.frequency.value = 1400; hornLP.Q.value = 0.7; hornLP.connect(musBus);
  // opoznienie ze sprzezeniem dla arpeggio (przestrzen)
  dIn = AC.createGain(); const dl = AC.createDelay(1), fb = AC.createGain(), dlp = AC.createBiquadFilter();
  dl.delayTime.value = 0.34; fb.gain.value = 0.38; dlp.type = 'lowpass'; dlp.frequency.value = 2500;
  dIn.connect(dl); dl.connect(dlp); dlp.connect(fb).connect(dl); dlp.connect(musBus);
  vibG = AC.createGain(); vibG.gain.value = 14; const vo = AC.createOscillator(); vo.frequency.value = 5.4; vo.connect(vibG); vo.start();
  if (OFFLINE) return;
  nextT = AC.currentTime + 0.1;
  timer = setInterval(sched, 25);
}
export function setMusic(on) { musOn = on; if (musBus && AC) musBus.gain.setTargetAtTime(on ? BASEVOL : 0, AC.currentTime, 0.3); }
export function setMusicMode(m) { mode = m; }
export function setMusicIntensity(x) { userInt = clamp(+x || 0, 0, 1); }
function targetInt() {
  const base = mode === 'boss' ? 1 : mode === 'calm' ? 0.12 : 0.72;
  return Math.max(base, userInt);
}
function sched() {
  if (!AC || OFFLINE || AC.state !== 'running') return;
  if (!musOn) { nextT = AC.currentTime + 0.1; return; }
  mi += (targetInt() - mi) * 0.018;
  musBus.gain.setTargetAtTime(BASEVOL * (0.6 + 0.4 * mi), AC.currentTime, 0.3); // glosniej w walce
  swingF += ((P.state === 'swing' || (P.state === 'air' && spd > 18) ? 1 : 0) - swingF) * 0.01;
  padLP.frequency.setTargetAtTime(650 + mi * 1900, AC.currentTime, 0.4);
  while (nextT < AC.currentTime + 0.15) { const s16 = 60 / (88 + 38 * mi) / 4; playStep(stepN, nextT, s16); stepN++; nextT += s16; }
}
// pojedynczy glos instrumentu z obwiednia (atak, spadek)
function nt(type, f, t, dur, vol, dest, att = 0.01, f2 = f) {
  const o = AC.createOscillator(), g = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + att); g.gain.exponentialRampToValueAtTime(0.0002, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); return o;
}
export function playStep(s, t, S16) {
  const bar = ((s / 16) | 0) % 8, st = s % 16, ch = PROG[bar], root = ch[0] - 24;
  const hi = mi > 0.55, boss = mode === 'boss';
  if (st === 0) { // smyczki: akord + oktawa, wolny atak; w napieciu dysonans
    const len = S16 * 16 * 1.04;
    for (const n of [...ch, ch[0] + 12]) for (const dt of [-6, 6]) { const o = nt('sawtooth', mf(n), t, len, 0.024 + 0.01 * mi, padLP, 0.5 - 0.3 * mi); o.detune.value = dt; }
    nt('sine', mf(root - 12), t, len, 0.12, musBus, 0.3);
    if (mi > 0.5) nt('sawtooth', mf(ch[2] + 1), t, len, 0.012 * (mi - 0.4) * 2, padLP, 0.8);
    if (hi && bar % 4 === 0) nz(1.0, 'highpass', 5000, 0.07 * mi, 9000, musBus, t); // talerz / narastanie
  }
  // bas / wiolonczele
  const bv = 0.05 + 0.08 * mi;
  if (mi < 0.28) { if (st % 8 === 0) nt('sawtooth', mf(root), t, S16 * 7.5, 0.06, bassLP, 0.08); }
  else if (st % 2 === 0) nt('sawtooth', mf(root + (st % 8 === 6 ? 12 : 0)), t, S16 * (mi > 0.6 ? 1.6 : 1.9), bv, bassLP, 0.01);
  else if (mi > 0.75 && st % 4 === 3) nt('sawtooth', mf(root + 12), t, S16 * 0.8, bv * 0.5, bassLP, 0.005);
  // arpeggio (fortepian / pizzicato) z opoznieniem
  const dense = mi > 0.5 ? 1 : 2;
  if (st % dense === 0 && (mi > 0.3 || Math.random() < 0.55)) {
    const idx = st / dense, n = ch[idx % 3] + (((idx / 3) | 0) % 2 ? 24 : 12), o = nt('triangle', mf(n), t, mi > 0.5 ? 0.18 : 0.6, 0.018 + 0.012 * mi, musBus, 0.004);
    const g2 = AC.createGain(); g2.gain.value = 0.9; o.connect(g2).connect(dIn);
    if (mi <= 0.5) nt('sine', mf(n + 12), t, 0.35, 0.008, dIn, 0.004);
  }
  // waltornie: melodia podczas bujania albo w wysokiej intensywnosci
  if ((swingF > 0.4 && mi < 0.6) || hi) {
    for (const [ms, mn, ml] of MEL[bar]) if (ms === st) {
      const n = mn - (hi ? 12 : 0), len = ml * S16 * 0.97, va = (0.045 + 0.04 * mi) * clamp(swingF * 1.5 + mi, 0.4, 1);
      for (const [type, k] of [['sawtooth', 1], ['square', 0.5]]) { const o = nt(type, mf(n), t, len, va * k, hornLP, 0.07); o.detune.value = type === 'square' ? 8 : -5; vibG.connect(o.detune); }
      if (hi) nt('sawtooth', mf(n + 7), t, len, va * 0.5, hornLP, 0.05);
    }
  }
  // perkusja
  if (mi > 0.3) {
    const kv = (0.25 + 0.55 * mi) * (mi > 0.6 ? 1 : 0.8);
    const beat = mi > 0.6 ? st % 4 === 0 : st % 8 === 0;
    if (beat || (mi > 0.78 && st === 10) || (boss && st === 14)) { nt('sine', 95, t, 0.22, kv, musBus, 0.003, 42); nz(0.08, 'lowpass', 300, kv * 0.5, 0, musBus, t); }
    if (mi > 0.55 && (st === 4 || st === 12)) { nz(0.16, 'bandpass', 1900, 0.2 * mi, 900, musBus, t, 0.7); nt('triangle', 220, t, 0.08, 0.12, musBus, 0.002, 140); }
    if (mi > 0.45 && st % 2 === 0) nz(0.035, 'highpass', 7000, 0.04 + 0.05 * mi, 0, musBus, t);
    if (boss && st % 8 === 7) nt('sine', 220, t, 0.15, 0.2, musBus, 0.003, 80);
  }
}

// ---------------------------------------------------------------- tlo miasta
// profile dzielnic: tr = ruch, cr = tlum, hum = szum wysoki, ne = neony
const PROF = {
  harlem: { tr: 0.8, cr: 1.1, hum: 0.7, ne: 0.7 }, uws: { tr: 0.7, cr: 0.8, hum: 0.8, ne: 0.5 }, ues: { tr: 0.7, cr: 0.7, hum: 0.8, ne: 0.5 },
  park: { tr: 0.2, cr: 0.35, hum: 0.5, ne: 0 }, hk: { tr: 0.9, cr: 1.0, hum: 0.9, ne: 1.0 }, mid: { tr: 1.2, cr: 1.2, hum: 1.2, ne: 1.3 },
  gv: { tr: 0.5, cr: 1.2, hum: 0.6, ne: 0.9 }, ct: { tr: 0.7, cr: 1.5, hum: 0.8, ne: 1.5 }, fin: { tr: 1.0, cr: 0.8, hum: 1.3, ne: 0.6 },
};
let ind = 0, streetF = 1, canyon = 0, simT = 0, envT = 0, dist = 'mid', distT = 0, curSurf = 'pavement';
const OVR = {}; // reczne nadpisania: { indoor, canyon, surface }
export function setAudioEnv(o) { Object.assign(OVR, o || {}); }
const TM = { car: 2, horn: 6, siren: 30, steam: 9, heli: 45, pig: 6, bird: 3, ped: 4, creak: 1, stepD: 0 };
let stepSide = 1;

function applyRoom() {
  if (!AC) return;
  const f = Math.min(20000 - ind * 18900, pauseMuf ? 1300 : 20000);
  roomLP.frequency.setTargetAtTime(Math.max(500, f), AC.currentTime, 0.12);
}
function surfaceNow() {
  if (OVR.surface) return OVR.surface;
  if (G.interior || ind > 0.5) return 'wood';
  const p = P.pos;
  if (p.y < 0.4) return inPark(p.x, p.z) ? 'grass' : 'pavement';
  return ((Math.floor(p.x / 22) + Math.floor(p.z / 22)) & 1) ? 'metal' : 'gravel';
}

export function cityAmbience(dt, nearStreet) {
  if (!live()) return;
  dt = Math.min(dt, 0.1); simT += dt;
  const y = P.pos.y, speed = Math.hypot(P.vel.x, P.vel.z);
  const tod = save.tod || 'sunset', night = tod === 'night' ? 1 : 0, day = tod === 'day' ? 1 : tod === 'sunset' ? 0.6 : 0;
  const inT = (OVR.indoor !== undefined ? OVR.indoor : !!G.interior) ? 1 : 0;
  ind += (inT - ind) * Math.min(1, dt * 4);
  streetF = clamp(1 - (y - 3) / 38, 0, 1); if (y === undefined) streetF = nearStreet ? 1 : 0;
  const roofF = 1 - streetF;
  distT -= dt; if (distT <= 0) { distT = 0.6; try { dist = districtAt(P.pos.x, P.pos.z); } catch (e) { /* zostaje poprzednia */ } }
  const pr = PROF[dist] || PROF.mid, parkF = dist === 'park' ? 1 : 0;
  canyon = OVR.canyon !== undefined ? OVR.canyon : (parkF ? 0.15 : clamp((y - 3) / 10, 0, 1) * clamp(1 - (y - 30) / 40, 0, 1) + 0.25 * (y < 3 ? 1 : 0));

  // --- warstwy ciagle (co ~0.1 s)
  envT -= dt;
  if (envT <= 0) {
    envT = 0.1;
    const t = AC.currentTime, open = 1 - 0.7 * ind, tc = 0.5;
    const set = (l, v) => l.g.gain.setTargetAtTime(v, t, tc);
    const gust = 0.5 + 0.5 * Math.sin(simT * 0.37) * Math.sin(simT * 0.91 + 1);
    const traf = (0.11 * streetF + 0.03 * roofF) * pr.tr * (night ? 0.6 : 1) * open;
    set(Ly.traf, traf); set(Ly.tire, traf * 0.35);
    set(Ly.hum, (0.02 + 0.05 * roofF * pr.hum) * open);
    set(Ly.crowd, 0.05 * pr.cr * streetF * (night ? 0.5 : 1) * open); set(Ly.crowd2, 0.025 * pr.cr * streetF * (night ? 0.5 : 1) * open);
    set(Ly.neon, 0.006 * streetF * pr.ne * (night ? 1.6 : 0.5) * open); set(Ly.neon2, 0.0012 * streetF * pr.ne * (night ? 1.6 : 0.4) * open);
    set(Ly.fan, 0.025 * roofF * open);
    set(Ly.room, 0.05 * ind);
    const cr = night ? (parkF ? 0.05 : 0.008) * streetF * open : 0; set(Ly.cr0, cr); set(Ly.cr1, cr * 0.8);
    set(Ly.amb, (0.03 + 0.11 * roofF * (0.5 + gust)) * open);
    Ly.amb.f.frequency.setTargetAtTime(300 + 500 * gust + 200 * roofF, t, 0.3);
    const sw = P.state === 'swing' ? clamp(Math.hypot(P.vel.x, P.vel.y, P.vel.z) / 40, 0.15, 1) : 0;
    set(Ly.rope, sw * 0.05); Ly.rope.f.frequency.setTargetAtTime(330 + sw * 500, t, 0.2);
    revSend.gain.setTargetAtTime(0.06 + 0.3 * canyon * (1 - ind) + 0.45 * ind, t, 0.4);
    applyRoom();
  }

  // --- kroki gracza (zalezne od nawierzchni, szybszy bieg = czestsze i glosniejsze)
  curSurf = surfaceNow();
  if (P.state === 'ground' && speed > 1.2 && G.state === 'play') {
    TM.stepD += speed * dt;
    const len = speed > 9 ? 2.3 : 1.35;
    if (TM.stepD > len) {
      TM.stepD = 0; stepSide = -stepSide;
      const run = speed > 9, o = route(0.5, stepSide * 0.25, 1);
      step(o, AC.currentTime, curSurf, run, clamp(speed / 14, 0.45, 1), false);
    }
  } else TM.stepD = Math.min(TM.stepD, 0.6);
  if (P.state === 'swing') { TM.creak -= dt; if (TM.creak <= 0) { TM.creak = rr(0.7, 1.5); sfx('rope', 0.5 + 0.5 * clamp(speed / 30, 0, 1)); } }

  // --- zdarzenia
  for (const k in TM) if (k !== 'stepD' && k !== 'creak') TM[k] -= dt;
  const hush = 1 - 0.8 * ind;
  if (TM.car <= 0) { TM.car = rr(2.5, 7) / Math.max(0.2, pr.tr) * (night ? 1.6 : 1) * (streetF > 0.4 ? 1 : 2.2); if (Math.random() < hush) carPass(streetF); }
  if (TM.horn <= 0) { TM.horn = rr(5, 14) / Math.max(0.3, pr.tr); if (streetF > 0.3 && Math.random() < hush) farHorn(); }
  if (TM.siren <= 0) { TM.siren = rr(28, 60); if (ind < 0.5) siren(); }
  if (TM.steam <= 0) { TM.steam = rr(10, 28); if (streetF > 0.5 && !parkF && ind < 0.5) steam(); }
  if (TM.heli <= 0) { TM.heli = rr(45, 90); if (roofF > 0.4 && ind < 0.5) heli(); }
  if (TM.pig <= 0) { TM.pig = rr(7, 18); if (!night && ind < 0.5 && y < 140) pigeons(streetF < 0.5); }
  if (TM.bird <= 0) { TM.bird = parkF ? rr(0.8, 2.5) : rr(4, 11); if (day > 0 && ind < 0.5 && y < 90 && streetF > 0.1) birds(day * (parkF ? 1 : 0.6) * (streetF > 0.5 ? 1 : 0.5)); }
  if (TM.ped <= 0) { TM.ped = rr(3, 9) / Math.max(0.3, pr.cr); if (streetF > 0.7 && speed < 14 && !parkF && ind < 0.5) pedPass(); }
}

function movePan(g, from, to, t, dur) { // przesuwa zrodlo po panoramie
  const p = panner(from); if (!p) return null;
  p.pan.setValueAtTime(from, t); p.pan.linearRampToValueAtTime(to, t + dur); return p;
}
// przejezdzajace auto: szum opon + silnik, filtr przesuwa sie (efekt Dopplera), panorama z boku na bok
function carPass(sf) {
  const t = AC.currentTime, dur = rr(3.2, 5.5), a = rr(0.05, 0.11) * (sf > 0.4 ? 1 : 0.4), dir = Math.random() < 0.5 ? -1 : 1;
  const env = AC.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(a, t + dur * 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pn = movePan(env, -0.85 * dir, 0.85 * dir, t, dur);
  const s = AC.createBufferSource(); s.buffer = nPink; const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(rr(700, 950), t); bp.frequency.linearRampToValueAtTime(rr(380, 520), t + dur);
  const o = AC.createOscillator(); o.type = 'sawtooth'; const f = rr(48, 75);
  o.frequency.setValueAtTime(f * 1.12, t); o.frequency.linearRampToValueAtTime(f * 0.88, t + dur);
  const olp = AC.createBiquadFilter(); olp.type = 'lowpass'; olp.frequency.value = 260; const og = AC.createGain(); og.gain.value = 0.7;
  s.connect(bp).connect(env); o.connect(olp).connect(og).connect(env);
  pn ? env.connect(pn).connect(mix) : env.connect(mix);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.1); o.start(t); o.stop(t + dur + 0.1);
}
function farHorn() {
  const n = 1 + (Math.random() < 0.4 ? 1 : 0), d = rr(30, 110), pan = rr(-1, 1);
  const o = route(d, pan, 3), f = rr(300, 470);
  for (let i = 0; i < n; i++) { const dl = i * 0.45; tone('square', f, f, 0.3, 0.07, dl, o, AC.currentTime, 0.01); tone('sawtooth', f * 1.26, f * 1.26, 0.3, 0.06, dl, o, AC.currentTime, 0.01); }
}
// syrena: wail (policja), yelp (szybka) lub dwutonowa (karetka); przesuwa sie w stereo z efektem Dopplera
function siren() {
  const t = AC.currentTime, dur = rr(9, 14), kind = (Math.random() * 3) | 0, dir = Math.random() < 0.5 ? -1 : 1;
  const env = AC.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.55); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(2800, t + dur * 0.55); lp.frequency.linearRampToValueAtTime(700, t + dur);
  const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.6;
  const pn = movePan(env, -1 * dir, 1 * dir, t, dur);
  const o = AC.createOscillator(); o.type = 'sawtooth'; let tt = 0;
  o.frequency.setValueAtTime(700, t);
  while (tt < dur) {
    const k = 1.05 - 0.1 * (tt / dur); // Doppler: wyzszy przy zblizaniu, nizszy przy oddalaniu
    if (kind === 0) { o.frequency.linearRampToValueAtTime(1450 * k, t + tt + 1.2); o.frequency.linearRampToValueAtTime(700 * k, t + tt + 2.4); tt += 2.4; }
    else if (kind === 1) { o.frequency.linearRampToValueAtTime(1500 * k, t + tt + 0.22); o.frequency.linearRampToValueAtTime(650 * k, t + tt + 0.3); tt += 0.3; }
    else { o.frequency.setValueAtTime(1075 * k, t + tt); o.frequency.setValueAtTime(1350 * k, t + tt + 0.55); tt += 1.1; }
  }
  o.connect(bp).connect(lp).connect(env);
  pn ? env.connect(pn).connect(mix) : env.connect(mix);
  o.start(t); o.stop(t + dur + 0.1);
}
function steam() {
  const t = AC.currentTime, dur = rr(2.5, 5), pan = rr(-0.8, 0.8), o = route(rr(6, 18), pan, 1.3);
  const s = AC.createBufferSource(); s.buffer = nWhite; const hp = AC.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 0.6;
  hp.frequency.setValueAtTime(5500, t); hp.frequency.linearRampToValueAtTime(3200, t + dur);
  const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.25); g.gain.setValueAtTime(0.06, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(hp).connect(g).connect(o); s.start(t, Math.random()); s.stop(t + dur + 0.1);
  tone('sine', 90, 80, 0.3, 0.05, 0, o, t, 0.1); // metaliczne stukniecie pokrywy
}
// helikopter w oddali: lopaty ~11 Hz (modulowany szum) + dudnienie turbiny
function heli() {
  const t = AC.currentTime, dur = rr(10, 16), dir = Math.random() < 0.5 ? -1 : 1;
  const env = AC.createGain(); env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.9, t + dur * 0.5); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const pn = movePan(env, -0.9 * dir, 0.9 * dir, t, dur);
  const s = AC.createBufferSource(); s.buffer = nBrown; const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const bl = AC.createGain(); bl.gain.value = 0.45; const lf = lfo(rr(10.5, 12.5), 0.45, bl.gain, 'sawtooth');
  const o = AC.createOscillator(); o.type = 'triangle'; o.frequency.value = rr(75, 95); const og = AC.createGain(); og.gain.value = 0.3;
  s.connect(lp).connect(bl).connect(env); o.connect(og).connect(env);
  pn ? env.connect(pn).connect(mix) : env.connect(mix);
  s.start(t, Math.random() * 2); s.stop(t + dur + 0.1); o.start(t); o.stop(t + dur + 0.1); lf.stop(t + dur + 0.1);
}
function pigeons(near) {
  const t = AC.currentTime, d = near ? rr(3, 9) : rr(8, 25), o = route(d, rr(-1, 1), 1.2);
  if (Math.random() < 0.5) { // trzepot skrzydel przy odlocie
    for (let i = 0; i < 7; i++) nz(0.05, 'bandpass', rr(500, 900), 0.12, 0, o, t + i * (0.09 - i * 0.006), 1.2);
  }
  const f = rr(260, 340); // gruchanie
  for (const [dl, k] of [[0.1, 1], [0.38, 1.12], [0.55, 1.05]]) {
    const ov = AC.createOscillator(); ov.type = 'sine'; ov.frequency.setValueAtTime(f * k, t + dl); ov.frequency.linearRampToValueAtTime(f * k * 0.82, t + dl + 0.2);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t + dl); g.gain.linearRampToValueAtTime(0.05, t + dl + 0.04); g.gain.linearRampToValueAtTime(0.0001, t + dl + 0.2);
    lfo(28, 0.02, g.gain).stop(t + dl + 0.3);
    ov.connect(g).connect(o); ov.start(t + dl); ov.stop(t + dl + 0.25);
  }
}
function birds(a) { // ptasie trele: kilka krotkich sylab o opadajacej lub rosnacej wysokosci
  const t = AC.currentTime, o = route(rr(10, 40), rr(-1, 1), 1.4), n = 2 + ((Math.random() * 5) | 0), f = rr(2600, 5200), up = Math.random() < 0.5;
  for (let i = 0; i < n; i++) {
    const dl = i * rr(0.07, 0.13), ff = f * rr(0.9, 1.1);
    tone('sine', up ? ff : ff * 1.3, up ? ff * 1.3 : ff, rr(0.04, 0.08), 0.03 * a, dl, o, t, 0.005);
  }
}
function pedPass() { // przechodnie blisko: kilka krokow przesuwajacych sie po panoramie
  const t = AC.currentTime, side = Math.random() < 0.5 ? -1 : 1, n = 4 + ((Math.random() * 4) | 0), gap = rr(0.45, 0.6), s = Math.random() < 0.15 ? 'metal' : 'pavement';
  for (let i = 0; i < n; i++) {
    const p = side * (1 - 2 * i / (n - 1)), d = rr(2.5, 6) + Math.abs(p) * 3, o = route(d, p * 0.9, 0.8);
    step(o, t + i * gap, s, false, 0.6, true);
  }
  if (Math.random() < 0.35) voice(route(rr(4, 9), side * 0.5, 0.6), t + 0.2, rr(110, 220), rr(110, 220), rr(0.15, 0.3), 0.04, rr(500, 800), rr(1000, 1500)); // pomruk rozmowy
}

// ---------------------------------------------------------------- testy offline (bez glosnikow)
// Renderuje pojedynczy efekt / muzyke do bufora i zwraca szczyt oraz RMS (do kontroli przesterowania/ciszy).
export async function renderTest(what, arg = {}) {
  const sr = 44100, secs = arg.secs || 3, ctx = new OfflineAudioContext(2, sr * secs, sr);
  build(ctx, true);
  musBus.gain.value = what === "music" ? BASEVOL * (0.6 + 0.4 * (arg.mi ?? 0.5)) : 0;
  if (arg.pre) arg.pre({ Ly, mix, roomLP, master, musBus, conv, revSend, revRet });
  if (what === 'music') { mi = arg.mi ?? 0.5; swingF = arg.swing ?? 0; mode = 'calm'; userInt = mi; let tt = 0.05, s = 0; while (tt < secs) { const s16 = 60 / (88 + 38 * mi) / 4; playStep(s, tt, s16); s++; tt += s16; } }
  else if (what === 'ambience') { for (const k in arg.layers || {}) { Ly[k].g.gain.value = arg.layers[k]; } }
  else if (what === 'event') { ({ car: carPass, horn: farHorn, siren, steam, heli, pig: pigeons, bird: () => birds(1), ped: pedPass })[arg.name](1); }
  else sfx(what, arg.v ?? 1, arg.pos || null, arg.surf || null);
  const buf = await ctx.startRendering(), a = buf.getChannelData(0), b = buf.getChannelData(1);
  let pk = 0, e = 0, lo = 0, hi = 0, pl = 0;
  for (let i = 0; i < a.length; i++) { pk = Math.max(pk, Math.abs(a[i]), Math.abs(b[i])); e += a[i] * a[i]; const d = a[i] - pl; pl = a[i]; hi += d * d; lo += a[i] * a[i]; }
  return { peak: +pk.toFixed(3), rms: +Math.sqrt(e / a.length).toFixed(4), bright: +(Math.sqrt(hi / a.length) / (Math.sqrt(lo / a.length) + 1e-9)).toFixed(2), bad: a.some(x => !isFinite(x)) };
}
