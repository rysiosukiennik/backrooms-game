// Dzwieki i muzyka generowane w locie (WebAudio) — bez plikow.
let AC = null, master = null, noise = null, windG = null, windF = null;

export function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = 0.55; master.connect(AC.destination);
  noise = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // szum wiatru — glosniejszy im szybciej lecisz
  const src = AC.createBufferSource(); src.buffer = noise; src.loop = true;
  windF = AC.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = 0.6;
  windG = AC.createGain(); windG.gain.value = 0;
  src.connect(windF).connect(windG).connect(master); src.start();
  startMusic();
}

export const audioOK = () => AC && AC.state === 'running';

export function setWind(speed) {
  if (!AC) return;
  const v = Math.min(1, Math.max(0, (speed - 8) / 50));
  windG.gain.setTargetAtTime(v * 0.45, AC.currentTime, 0.1);
  windF.frequency.setTargetAtTime(300 + v * 900, AC.currentTime, 0.1);
}

function nz(dur, type, f, vol, f2, dest = master, t = AC.currentTime) {
  const s = AC.createBufferSource(); s.buffer = noise;
  const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  s.connect(fl).connect(g).connect(dest);
  s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
}
function tone(type, f1, f2, dur, vol, delay = 0, dest = master, t0 = AC.currentTime, attack = 0) {
  const o = AC.createOscillator(); o.type = type;
  const g = AC.createGain(); const t = t0 + delay;
  o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); }
  else g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

export function sfx(n, v = 1) {
  if (!audioOK()) return;
  v = Math.max(0.01, v);
  switch (n) {
    case 'thwip': nz(0.13, 'highpass', 2500, 0.35 * v, 6000); tone('triangle', 1400, 400, 0.07, 0.08 * v); break;
    case 'punch': tone('sine', 160, 45, 0.16, 0.7 * v); nz(0.06, 'lowpass', 1200, 0.4 * v); break;
    case 'block': tone('square', 900, 700, 0.08, 0.12 * v); nz(0.1, 'highpass', 3000, 0.25 * v); break;
    case 'shot': nz(0.28, 'lowpass', 2600, 0.55 * v, 300); tone('square', 180, 60, 0.08, 0.12 * v); break;
    case 'whoosh': nz(0.3, 'bandpass', 400, 0.3 * v, 2000); break;
    case 'land': tone('sine', 100, 35, 0.25, 0.6 * v); nz(0.15, 'lowpass', 500, 0.3 * v); break;
    case 'slam': tone('sine', 70, 25, 0.6, 0.9 * v); nz(0.5, 'lowpass', 300, 0.6 * v); break;
    case 'hurt': tone('square', 220, 80, 0.2, 0.18 * v); break;
    case 'splat': nz(0.12, 'bandpass', 900, 0.3 * v, 300); break;
    case 'crash': nz(0.7, 'lowpass', 1800, 0.7 * v, 200); tone('sawtooth', 120, 40, 0.5, 0.2 * v); break;
    case 'ring': tone('sine', 880, 1320, 0.15, 0.2 * v); tone('sine', 1320, 1760, 0.15, 0.12 * v, 0.06); break;
    case 'fin': tone('sawtooth', 200, 800, 0.35, 0.12 * v); nz(0.4, 'bandpass', 800, 0.3 * v, 3000); break;
    case 'cola': nz(0.06, 'highpass', 2500, 0.6 * v, 8000); nz(0.9, 'highpass', 5000, 0.18 * v, 9000); tone('sine', 300, 120, 0.25, 0.15 * v, 0.9); break; // syk otwieranej puszki i lyk
    case 'pickup': [660, 880, 1320].forEach((f, i) => tone('triangle', f, f, 0.18, 0.18, i * 0.08)); break;
    case 'level': [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f * 1.01, 0.3, 0.2, i * 0.1)); break;
    case 'win': [392, 523, 659, 784].forEach((f, i) => tone('triangle', f, f, 0.25, 0.18, i * 0.09)); break;
    case 'alarm': [0, 0.25].forEach(d => tone('square', 700, 950, 0.22, 0.08, d)); break;
    case 'ui': tone('sine', 900, 700, 0.05, 0.08); break;
  }
}

// ---------------------------------------------------------------- muzyka
// Akordy a-moll, F, C, G; w walce wchodza bebny i szybsze arpeggio.
let musicG = null, musOn = true, mode = 'calm', stepN = 0, nextT = 0, timer = null;
const BPM = 118, S16 = 60 / BPM / 4;
const PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
function startMusic() {
  if (!AC || timer) return;
  musicG = AC.createGain(); musicG.gain.value = musOn ? 0.5 : 0; musicG.connect(master);
  nextT = AC.currentTime + 0.1;
  timer = setInterval(sched, 25);
}
export function setMusic(on) { musOn = on; if (musicG) musicG.gain.setTargetAtTime(on ? 0.5 : 0, AC.currentTime, 0.3); }
export function setMusicMode(m) { mode = m; }
function sched() {
  if (!AC || AC.state !== 'running' || !musOn) { if (AC) nextT = AC.currentTime + 0.1; return; }
  while (nextT < AC.currentTime + 0.15) { playStep(stepN, nextT); stepN++; nextT += S16; }
}
function playStep(s, t) {
  const bar = Math.floor(s / 16) % 4, st = s % 16, ch = PROG[bar];
  const fight = mode !== 'calm', boss = mode === 'boss';
  if (st === 0) for (const n of ch) tone('triangle', mf(n), mf(n), S16 * 16, 0.035, 0, musicG, t, 0.4);
  if (fight ? st % 2 === 0 : st % 4 === 0) {
    const n = ch[0] - 24 + (st % 8 === 6 ? 12 : 0);
    tone('sawtooth', mf(n), mf(n), S16 * 1.8, boss ? 0.09 : 0.07, 0, musicG, t);
  }
  if (fight || st % 2 === 0) {
    const idx = fight ? st : st / 2, n = ch[idx % 3] + ((Math.floor(idx / 3) % 2) ? 24 : 12);
    tone('square', mf(n), mf(n), S16 * 0.9, fight ? 0.022 : 0.015, 0, musicG, t);
  }
  if (fight ? st % 4 === 0 : (st === 0 || st === 8)) tone('sine', 120, 40, 0.2, fight ? 0.45 : 0.25, 0, musicG, t);
  if (fight && (st === 4 || st === 12)) nz(0.14, 'highpass', 1500, 0.22, 0, musicG, t);
  if (fight ? st % 2 === 0 : st % 4 === 2) nz(0.04, 'highpass', 7000, fight ? 0.08 : 0.04, 0, musicG, t);
  if (boss && st % 8 === 7) tone('sine', 220, 80, 0.15, 0.25, 0, musicG, t);
}

// ---------------------------------------------------------------- odglosy miasta
let hornT = 6, sirenT = 25;
export function cityAmbience(dt, nearStreet) {
  if (!audioOK()) return;
  hornT -= dt; sirenT -= dt;
  if (hornT <= 0) {
    hornT = 6 + Math.random() * 14;
    if (nearStreet) { const f = 330 + Math.random() * 120; tone('square', f, f, 0.25, 0.035); tone('square', f * 1.26, f * 1.26, 0.25, 0.025); }
  }
  if (sirenT <= 0) {
    sirenT = 30 + Math.random() * 40;
    for (let i = 0; i < 6; i++) tone('sine', i % 2 ? 900 : 650, i % 2 ? 650 : 900, 0.5, 0.02, i * 0.5);
  }
}
