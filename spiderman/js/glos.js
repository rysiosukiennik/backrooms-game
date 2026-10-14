// Glos: silnik odtwarzania mowy (Peter Parker i inne postacie). Gra dziala z file://, wiec nagrania sa
// w paczkach JS (base64) ladowanych leniwie dynamicznym <script>, a nie przez fetch.
//
// API (dla REZYSERA, ROZMOW, UI i animacji):
//   initGlos()                      - wola sie po initAudio() (start gry); buduje magistrale glosu i zaczyna ladowac manifest
//   glosPlay(id, opts)              - gra linie z katalogu. opts: { priority 0..3 (domysl 1), onEnd(ok), text, voice, pos, ttl }
//                                     voice: kto mowi ('peter' domyslnie, albo 'may','mj','yuri','fisk','rhino','thug','radio');
//                                       gdy manifest jest juz zaladowany, bierze sie voice z niego
//                                     text: tekst na zapas (fallback speechSynthesis, gdy nagrania brak / tryb 'syntezator')
//                                     pos: pozycja swiata {x,y,z} | [x,y,z] | () => pozycja (panorama + tlumienie odlegloscia)
//                                     ttl: ms, po ktorych czekajaca linia wypada (domysl 3000 + 3000*priority)
//                                     onEnd(ok): ok=true gdy dograla do konca, false gdy przerwana / odrzucona / przeterminowana
//                                     zwraca true, jesli linia przyjeta (zagra albo czeka w kolejce)
//   glosPlayText(text, { voice, priority, onEnd, pos })  - tylko syntezator (bez nagrania)
//   glosStop(voice?)                - zatrzymuje wszystko (albo tylko jedna postac) i czysci kolejki
//   glosSpeaking(voice?)            - czy ktos (albo ta postac) mowi
//   glosPreload(listaId | rodzaj)   - wczesne zaladowanie i zdekodowanie (tablica id, albo rodzaj np. 'hit' = id 'hit_NN'); Promise
//   glosState = { speaking, speaker, level, id }  - level 0..1 (obwiednia z AnalyserNode, odswiezana w updateGlos(dt))
//   updateGlos(dt)                  - wolane co klatke z main.js
//   glosSettings = { mask: true }   - korekcja "przez maske" dla peter (wylacz, jesli generator juz ja nalozyl;
//                                     wpis manifestu z mask:true tez ja pomija)
//   glosDebug()                     - stan wewnetrzny (testy)
// Zasady kolejki: kazda postac ma wlasny tor (jedna postac nigdy nie mowi sama ze soba nalozona); wyzszy priorytet
// przerywa, rowny dolacza do kolejki (max 3, przeterminowane wypadaja), nizszy od aktualnie granego jest odrzucany.
// Rozne postacie moga mowic rownolegle (max 3 tory). Ustawienia: save.voice, save.voiceVol (0..1),
// save.voiceMode: 'nagrania' | 'syntezator' | 'wylaczony'. Na czas mowy cichnie tlo i muzyka (duckMix/duckMus z dzwiek.js).
import { save } from './util.js';
import { camera } from './stan.js';
import { audioGraph, audioEnv } from './dzwiek.js';

export const glosState = { speaking: false, speaker: '', level: 0, id: '' };
export const glosSettings = { mask: true };

const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const now = () => performance.now();
const MAXLANES = 3, MAXQ = 3, MAXPACKS = 5, MAXBYTES = 24e6;
const DUCK_MIX = 0.42, DUCK_MUS = 0.3, DUCK_HOLD = 0.3;

// ---------------------------------------------------------------- adres bazowy (katalog z index.html / dev.html)
// bundle gra.js (IIFE) wykonuje sie synchronicznie przy ladowaniu: document.currentScript wskazuje gra.js;
// moduly (dev.html) nie maja currentScript, wtedy bierzemy adres strony — oba leza w katalogu spiderman/.
const BASE = (() => {
  try {
    const cs = document.currentScript;
    if (cs && cs.src) return cs.src.replace(/[#?].*$/, '').replace(/[^/]*$/, '').replace(/js\/$/, '');
  } catch (e) { /* adres strony */ }
  return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
})();

function loadScript(url) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.async = true;
    s.onload = () => { s.remove(); res(); };
    s.onerror = () => { s.remove(); rej(new Error('glos: brak ' + url)); };
    document.head.appendChild(s);
  });
}

// ---------------------------------------------------------------- manifest i paczki
let MAN = null, manP = null;
function ensureManifest() {
  if (MAN) return Promise.resolve(MAN);
  if (window.GLOS_MANIFEST) return Promise.resolve(MAN = window.GLOS_MANIFEST);
  if (!manP) manP = loadScript(BASE + 'glos/manifest.js').then(() => MAN = window.GLOS_MANIFEST || {}, () => { MAN = {}; return MAN; });
  return manP;
}

const packP = {}, packUse = {};
function loadPack(name) {
  packUse[name] = now();
  window.GLOS_PACKS = window.GLOS_PACKS || {};
  if (window.GLOS_PACKS[name]) return Promise.resolve(window.GLOS_PACKS[name]);
  if (!packP[name]) {
    packP[name] = loadScript(BASE + 'glos/' + name + '.js').then(() => window.GLOS_PACKS[name] || null, () => null)
      .then(p => { delete packP[name]; if (p) evictPacks(name); return p; });
  }
  return packP[name];
}
// pamiec: trzymamy tylko kilka ostatnio uzywanych paczek (base64 jest duze); zdekodowane bufory maja wlasny cache
function evictPacks(keep) {
  const names = Object.keys(window.GLOS_PACKS || {});
  if (names.length <= MAXPACKS) return;
  names.filter(n => n !== keep).sort((a, b) => (packUse[a] || 0) - (packUse[b] || 0)).slice(0, names.length - MAXPACKS).forEach(n => { delete window.GLOS_PACKS[n]; });
}

// ---------------------------------------------------------------- graf audio
let G_ = null, bus = null;
function ensureGraph() {
  const g = audioGraph();
  if (!g) return null;
  if (bus && bus.ac === g.ac) return bus;
  const ac = g.ac, mk = t => ac.createBiquadFilter(), gn = v => { const n = ac.createGain(); n.gain.value = v; return n; };
  G_ = g;
  const b = { ac, duckMix: g.duckMix, duckMus: g.duckMus };
  b.plain = gn(1); b.mask = gn(1); b.radio = gn(1);
  // "przez maske": odciecie dolu, ciasniejszy srodek (lycra), przyciemnione gorne pasmo
  const hp = mk(); hp.type = 'highpass'; hp.frequency.value = 95; hp.Q.value = 0.7;
  const pk = mk(); pk.type = 'peaking'; pk.frequency.value = 1150; pk.Q.value = 0.9; pk.gain.value = 2.2;
  const hs = mk(); hs.type = 'highshelf'; hs.frequency.value = 4200; hs.gain.value = -4.5;
  const lp = mk(); lp.type = 'lowpass'; lp.frequency.value = 7800; lp.Q.value = 0.5;
  // radio policyjne: waskie pasmo
  const rh = mk(); rh.type = 'highpass'; rh.frequency.value = 480; const rl = mk(); rl.type = 'lowpass'; rl.frequency.value = 3300;
  b.sum = gn(1);
  b.mask.connect(hp).connect(pk).connect(hs).connect(lp).connect(b.sum);
  b.radio.connect(rh).connect(rl).connect(b.sum);
  b.plain.connect(b.sum);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.knee.value = 10; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
  b.sum.connect(comp);
  b.an = ac.createAnalyser(); b.an.fftSize = 1024; b.an.smoothingTimeConstant = 0; comp.connect(b.an);
  b.buf = new Float32Array(b.an.fftSize);
  b.out = gn(clamp(save.voiceVol ?? 0.9, 0, 1)); comp.connect(b.out); b.out.connect(g.master);
  b.rev = gn(0.1); b.out.connect(b.rev); b.rev.connect(g.conv);
  bus = b;
  return b;
}

// ---------------------------------------------------------------- bufory
const cache = new Map(); // id -> { buf, bytes, t }
let cacheBytes = 0;
const decoding = {};
function trimCache() {
  if (cacheBytes <= MAXBYTES) return;
  const arr = [...cache.entries()].sort((a, b) => a[1].t - b[1].t);
  for (const [k, v] of arr) { if (cacheBytes <= MAXBYTES * 0.8) break; cache.delete(k); cacheBytes -= v.bytes; }
}
function getBuffer(id) {
  const c = cache.get(id);
  if (c) { c.t = now(); return Promise.resolve(c.buf); }
  if (decoding[id]) return decoding[id];
  const b = ensureGraph();
  if (!b || !MAN || !MAN[id]) return Promise.resolve(null);
  decoding[id] = loadPack(MAN[id].pack).then(pack => {
    const uri = pack && pack[id]; if (!uri) return null;
    const bin = atob(uri.slice(uri.indexOf(',') + 1)), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Promise((res, rej) => b.ac.decodeAudioData(u8.buffer, res, rej));
  }).then(buf => {
    delete decoding[id];
    if (buf) { const bytes = buf.length * buf.numberOfChannels * 4; cache.set(id, { buf, bytes, t: now() }); cacheBytes += bytes; trimCache(); }
    return buf;
  }, () => { delete decoding[id]; return null; });
  return decoding[id];
}

// ---------------------------------------------------------------- synteza (fallback)
const SYN = { // wysokosc i tempo wg postaci; sex: 'm' | 'f'
  peter: { pitch: 0.72, rate: 1.08, sex: 'm' }, may: { pitch: 1.0, rate: 0.95, sex: 'f' }, mj: { pitch: 1.12, rate: 1.05, sex: 'f' },
  yuri: { pitch: 0.92, rate: 1.0, sex: 'f' }, fisk: { pitch: 0.35, rate: 0.85, sex: 'm' }, rhino: { pitch: 0.25, rate: 0.9, sex: 'm' },
  thug: { pitch: 0.6, rate: 1.05, sex: 'm' }, radio: { pitch: 0.85, rate: 1.12, sex: 'm' },
};
const MALE = /marek|adam|jakub|piotr|krzysztof|jan\b|google polski|\bpl.*male/i, FEM = /paulina|zofia|agnieszka|ewa|maja|female|zira|kobiet/i;
let voiceCache = {};
function ssOK() { try { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); } catch (e) { return false; } }
try { if (ssOK()) window.speechSynthesis.addEventListener('voiceschanged', () => { voiceCache = {}; }); } catch (e) { /* bez syntezatora */ }
function pickVoice(sex) {
  if (sex in voiceCache) return voiceCache[sex];
  let v = null;
  try {
    const pl = window.speechSynthesis.getVoices().filter(x => /^pl/i.test(x.lang));
    if (pl.length) {
      v = sex === 'f' ? (pl.find(x => FEM.test(x.name)) || pl[0])
        : (pl.find(x => MALE.test(x.name)) || pl.find(x => !FEM.test(x.name)) || pl[0]);
    }
  } catch (e) { /* brak */ }
  if (v || window.speechSynthesis.getVoices().length) voiceCache[sex] = v;
  return v;
}

// ---------------------------------------------------------------- tory i kolejka
const lanes = {};
const lane = sp => lanes[sp] || (lanes[sp] = { sp, cur: null, queue: [], gap: false });
const activeLanes = () => Object.values(lanes).filter(l => l.cur);
const modeNow = () => (!save.voice ? 'wylaczony' : (save.voiceMode || 'nagrania'));

function fin(item, ok) { // zdarzenie koncowe dokladnie raz
  if (item.fin) return; item.fin = true;
  if (item.onEnd) { try { item.onEnd(ok); } catch (e) { console.error(e); } }
}
function release(item) { // sprzatanie zasobow granej linii
  if (item.src) { item.src.onended = null; try { const t = bus.ac.currentTime; item.gain.gain.cancelScheduledValues(t); item.gain.gain.setTargetAtTime(0, t, 0.012); item.src.stop(t + 0.07); } catch (e) { /* juz zatrzymane */ } }
  if (item.state === 'synth' && ssOK()) { try { item.utt.onend = item.utt.onerror = null; window.speechSynthesis.cancel(); } catch (e) { /* brak */ } }
  clearTimeout(item.wd); item.state = 'done';
}
function endItem(l, item, ok) {
  if (l.cur !== item) return;
  release(item); l.cur = null; l.gap = true;
  fin(item, ok);
  pump(l);
}
function pump(l) {
  while (!l.cur && l.queue.length) {
    const it = l.queue.shift();
    if (now() - it.t > it.ttl) { fin(it, false); continue; }
    start(l, it); break;
  }
}
function interrupt(l) { const c = l.cur; if (!c) return; l.cur = null; release(c); fin(c, false); }

function enqueue(item) {
  const m = modeNow();
  if (m === 'wylaczony') { fin(item, false); return false; }
  const l = lane(item.speaker), cur = l.cur;
  if (item.id && ((cur && cur.id === item.id) || l.queue.some(q => q.id === item.id))) { fin(item, false); return false; }
  if (!cur) {
    if (activeLanes().length >= MAXLANES && item.priority < 2) { fin(item, false); return false; }
    start(l, item); return true;
  }
  if (item.priority > cur.priority) {
    l.queue = l.queue.filter(q => { if (q.priority >= item.priority) return true; fin(q, false); return false; });
    interrupt(l); start(l, item); return true;
  }
  if (item.priority < cur.priority) { fin(item, false); return false; }
  l.queue.push(item);
  if (l.queue.length > MAXQ) { // wypada najstarsza z najnizszym priorytetem
    let k = 0; for (let i = 1; i < l.queue.length; i++) if (l.queue[i].priority < l.queue[k].priority) k = i;
    fin(l.queue.splice(k, 1)[0], false);
  }
  return true;
}

function start(l, item) {
  l.cur = item; item.state = 'loading';
  const m = modeNow();
  if (item.forceSynth || m === 'syntezator') return startSynth(l, item);
  const b = ensureGraph(), c = item.id && cache.get(item.id);
  if (b && c) { c.t = now(); return startBuffer(l, item, c.buf); } // sciezka szybka: bufor juz zdekodowany
  const tok = item;
  ensureManifest().then(() => {
    if (l.cur !== tok) return null;
    return getBuffer(item.id);
  }).then(buf => {
    if (l.cur !== tok) return;
    if (now() - item.t > item.ttl) return endItem(l, item, false); // za pozno: kwestia juz nieaktualna
    if (buf && ensureGraph()) startBuffer(l, item, buf);
    else if (item.text) startSynth(l, item);
    else endItem(l, item, false);
  });
}

function startBuffer(l, item, buf) {
  const b = bus, ac = b.ac;
  if (ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* brak */ } }
  const src = ac.createBufferSource(); src.buffer = buf;
  const g = ac.createGain(), t0 = ac.currentTime + (l.gap ? 0.12 : 0.02); l.gap = false;
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(1, t0 + 0.015);
  src.connect(g);
  const man = (MAN && MAN[item.id]) || {};
  let dest = b.plain;
  if (item.speaker === 'peter' && glosSettings.mask && !man.mask) dest = b.mask;
  else if (item.speaker === 'radio' && !man.fx) dest = b.radio;
  if (item.pos && ac.createStereoPanner) {
    const sp = spat(item.pos);
    item.pan = ac.createStereoPanner(); item.pan.pan.value = sp.pan;
    item.dist = ac.createGain(); item.dist.gain.value = sp.gain;
    g.connect(item.pan).connect(item.dist).connect(dest);
  } else g.connect(dest);
  item.src = src; item.gain = g; item.state = 'playing'; item.t0 = t0; item.dur = buf.duration;
  src.onended = () => endItem(l, item, true);
  src.start(t0);
  item.wd = setTimeout(() => endItem(l, item, true), (buf.duration + 1.5) * 1000 + (t0 - ac.currentTime) * 1000); // gdyby onended nie przyszlo
  noteStart(item);
}

function startSynth(l, item) {
  if (!ssOK() || !item.text) return endItem(l, item, false);
  const sy = SYN[item.speaker] || SYN.thug, u = new SpeechSynthesisUtterance(item.text);
  const v = pickVoice(sy.sex); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'pl-PL';
  u.pitch = sy.pitch; u.rate = sy.rate; u.volume = clamp(save.voiceVol ?? 0.9, 0, 1);
  u.onend = () => endItem(l, item, true);
  u.onerror = () => endItem(l, item, false);
  item.utt = u; item.state = 'synth'; item.t0 = 0; item.dur = item.text.length * 0.075;
  l.gap = false;
  try { window.speechSynthesis.speak(u); } catch (e) { return endItem(l, item, false); }
  item.wd = setTimeout(() => endItem(l, item, true), item.text.length * 95 + 4000); // watchdog: czesc silnikow nie zglasza konca
  noteStart(item);
}
function noteStart(item) { glosState.speaker = item.speaker; glosState.id = item.id || ''; }

// ---------------------------------------------------------------- API
export function initGlos() {
  ensureGraph();
  ensureManifest();
}

export function glosPlay(id, o = {}) {
  initGlos();
  const sp = o.voice || (MAN && MAN[id] && MAN[id].voice) || 'peter', pr = o.priority ?? 1;
  return enqueue({ id, text: o.text || '', speaker: sp, priority: pr, onEnd: o.onEnd, pos: o.pos || null, t: now(), ttl: o.ttl ?? (3000 + 3000 * pr), state: 'new' });
}
export function glosPlayText(text, o = {}) {
  initGlos();
  return enqueue({ id: '', text: String(text || ''), speaker: o.voice || 'peter', priority: o.priority ?? 1, onEnd: o.onEnd, pos: o.pos || null, t: now(), ttl: o.ttl ?? 6000, forceSynth: true, state: 'new' });
}
export function glosStop(sp) {
  for (const l of Object.values(lanes)) {
    if (sp && l.sp !== sp) continue;
    const q = l.queue; l.queue = []; q.forEach(i => fin(i, false)); interrupt(l);
  }
}
export function glosSpeaking(sp) {
  return Object.values(lanes).some(l => l.cur && (l.cur.state === 'playing' || l.cur.state === 'synth') && (!sp || l.sp === sp));
}
export function glosPreload(what) {
  return ensureManifest().then(() => {
    let ids = Array.isArray(what) ? what.slice() : Object.keys(MAN).filter(k => k.replace(/_\d+$/, '') === what || MAN[k].kind === what);
    ids = ids.filter(k => MAN[k]).slice(0, 12);
    const packs = [...new Set(ids.map(k => MAN[k].pack))];
    return Promise.all(packs.map(loadPack)).then(() => ensureGraph() ? Promise.all(ids.map(getBuffer)) : null).then(() => ids.length);
  });
}
export function glosDebug() {
  return { base: BASE, manifest: MAN ? Object.keys(MAN).length : -1, cache: cache.size, cacheBytes, packs: Object.keys(window.GLOS_PACKS || {}),
    lanes: Object.values(lanes).map(l => ({ sp: l.sp, cur: l.cur && { id: l.cur.id, st: l.cur.state, pr: l.cur.priority }, q: l.queue.map(i => i.id || i.text.slice(0, 12)) })),
    duckMix: bus ? bus.duckMix.gain.value : null, duckMus: bus ? bus.duckMus.gain.value : null, rev: bus ? bus.rev.gain.value : null, vol: bus ? bus.out.gain.value : null };
}

// ---------------------------------------------------------------- pozycja i obwiednia
const _d = new THREE.Vector3();
function spat(p) {
  const q = typeof p === 'function' ? p() : p; if (!q) return { pan: 0, gain: 1 };
  const x = Array.isArray(q) ? q[0] : q.x, y = Array.isArray(q) ? q[1] : q.y, z = Array.isArray(q) ? q[2] : q.z;
  try {
    camera.getWorldDirection(_d);
    const h = Math.hypot(_d.x, _d.z) || 1, fx = _d.x / h, fz = _d.z / h;
    const dx = x - camera.position.x, dy = y - camera.position.y, dz = z - camera.position.z, d = Math.hypot(dx, dy, dz) || 0.01;
    return { pan: clamp((dx * -fz + dz * fx) / d * Math.min(1, 0.25 + d / 4), -1, 1), gain: clamp(1 / (1 + (d / 22) * (d / 22)), 0.12, 1) };
  } catch (e) { return { pan: 0, gain: 1 }; }
}

let duckOn = false, hold = 0, envT = 0, fakeT = 0, fakeL = 0;
export function updateGlos(dt) {
  const m = modeNow();
  if (m === 'wylaczony' && activeLanes().length) glosStop();
  const b = bus;
  const t = b ? b.ac.currentTime : 0;
  // najwazniejszy aktualnie mowiacy -> glosState
  let top = null, synth = false;
  for (const l of Object.values(lanes)) {
    const c = l.cur; if (!c) continue;
    if (c.state === 'playing' && c.t0 > t) continue; // zaplanowane, jeszcze nie zaczelo
    if (c.state !== 'playing' && c.state !== 'synth') continue;
    if (!top || c.priority > top.priority || (c.priority === top.priority && c.speaker === 'peter')) top = c;
    if (c.state === 'synth') synth = true;
    if (c.pos && c.dist) { const sp = spat(c.pos); c.pan.pan.setTargetAtTime(sp.pan, t, 0.05); c.dist.gain.setTargetAtTime(sp.gain, t, 0.05); }
  }
  const speaking = !!top;
  glosState.speaking = speaking;
  if (top) { glosState.speaker = top.speaker; glosState.id = top.id || ''; } else glosState.id = '';
  // poziom: z analizatora (nagrania) albo sztuczna obwiednia (syntezator, ktory nie daje sygnalu)
  let lv = 0;
  if (top && b && top.state === 'playing') {
    b.an.getFloatTimeDomainData(b.buf); let e = 0; for (let i = 0; i < b.buf.length; i++) e += b.buf[i] * b.buf[i];
    lv = clamp(Math.sqrt(e / b.buf.length) * 5.5, 0, 1);
  } else if (top && synth) {
    fakeT -= dt; if (fakeT <= 0) { fakeT = 0.07 + Math.random() * 0.09; fakeL = Math.random() < 0.18 ? 0.05 : 0.3 + Math.random() * 0.5; }
    lv = fakeL;
  }
  glosState.level += (lv - glosState.level) * (lv > glosState.level ? 0.6 : 0.25);
  if (!speaking && glosState.level < 0.01) glosState.level = 0;
  if (!b) return;
  // glosnosc uzytkownika
  const vol = clamp(save.voiceVol ?? 0.9, 0, 1);
  if (Math.abs(b.out.gain.value - vol) > 0.005) b.out.gain.setTargetAtTime(vol, t, 0.05);
  // ducking: wchodzi szybko, wraca powoli
  if (speaking) hold = DUCK_HOLD; else hold = Math.max(0, hold - dt);
  const want = speaking || hold > 0;
  if (want !== duckOn) {
    duckOn = want;
    const tc = want ? 0.07 : 0.4;
    b.duckMix.gain.setTargetAtTime(want ? DUCK_MIX : 1, t, tc);
    b.duckMus.gain.setTargetAtTime(want ? DUCK_MUS : 1, t, tc);
  }
  // poglos zalezny od otoczenia (ulica / kanion miedzy budynkami / wnetrze)
  envT -= dt;
  if (envT <= 0) {
    envT = 0.2;
    const e = audioEnv();
    b.rev.gain.setTargetAtTime(0.05 + 0.2 * (e.canyon || 0) * (1 - e.indoor) + 0.3 * e.indoor, t, 0.3);
  }
}
