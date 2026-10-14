// Rezyser docinkow Spider-Mana. Linie bierze z katalogu (docinki_teksty.js / docinki_dialogi.js), gra je przez silnik
// glosu (glos.js: nagranie albo syntezator) i pokazuje napis z imieniem mowiacego.
// Publiczne API: say(rodzaj, force), sayCtx(rodzaj, kontekst), updateQuips(dt), quipStart(), quipEvents, quipAdd(linie).
//
// Zasady:
//  * priorytet: 3 boss/smierc > 2 walka > 1 ruch > 0 tlo; wyzszy przerywa nizszy, rowny/nizszy czeka w kolejce (walka) albo przepada
//  * globalny odstep miedzy kwestiami zalezy od intensywnosci: walka ~3 s, ruch ~6 s, spokoj ~10 s
//  * pamiec: kazdy rodzaj ma "torbe" (losowanie bez zwracania do wyczerpania) + ostatnie 10 linii nie wracaja
//  * nastroj linii (mood) dopasowany do stanu: strained (malo zdrowia), excited (combo, szybkie bujanie), dry (po wpadce)
//  * zdarzenia: hooki say(...) w innych plikach + analiza stanu w updateQuips (co 0.4 s, nie co klatke)
// RODZAJE zgloszone przez kod (dla scenarzysty): hit hit_brute hit_gun finisher web web_brute brute_stun combo swing hero hurt hurt_bat
// hurt_gun hurt_brute hurt_boss lowhp cola room room_<typ: shop cafe bar apt office gym fisk> crime carstop dodge dodge_perfect jump
// death respawn race_start race_end race_end_gold|silver|bronze chase_start chase_end speed speed_record dive summit outnumbered
// idle idle_long perch level bag district_<harlem uws ues park hk mid gv ct fin> sunset night day rhino rhino_win fisk fisk_phase2
// fisk_phase3 fisk_win; wg katalogu: rhino_start rhino_phase2 fisk_enter race_win race_lose levelup airhit gun bat brute intro random_thought dialog_NN
import { G, P, enemies } from './stan.js';
import { save } from './util.js';
import { districtAt } from './miasto.js';
import { glosPlay, glosStop, glosState } from './glos.js';
import { fiskBossFight } from './fisk.js';
import * as T from './docinki_teksty.js';
import * as DLG from './docinki_dialogi.js';

// ---------------------------------------------------------------- katalog
const byKind = new Map(), byId = new Map();
export function quipAdd(list) {
  for (const l of list || []) {
    if (!l || !l.id || !l.kind || !l.text || byId.has(l.id)) continue;
    byId.set(l.id, l);
    let a = byKind.get(l.kind); if (!a) byKind.set(l.kind, a = []);
    a.push(l);
  }
}
quipAdd(T.LINIE); quipAdd(DLG.LINIE);

// domyslne ustawienia rodzajow (p: szansa, cd: odpoczynek tego rodzaju w s, prio); RODZAJE z katalogu je nadpisuje
const DEF = {
  death: [3, 1, 20], respawn: [3, 1, 20], rhino: [3, 1, 60], fisk: [3, 1, 60], boss: [3, 1, 20],
  hit: [2, 0.1, 12], finisher: [2, 0.55, 8], web: [2, 0.08, 14], combo: [2, 0.6, 25], hurt: [2, 0.18, 10], lowhp: [2, 0.9, 40],
  dodge: [2, 0.15, 18], brute: [2, 0.5, 20], outnumbered: [2, 0.7, 35], crime: [2, 0.7, 15], cola: [2, 1, 5], thug: [2, 1, 6],
  swing: [1, 0.07, 30], speed: [1, 0.7, 45], hero: [1, 0.5, 20], jump: [1, 0.03, 30], dive: [1, 0.7, 40], summit: [1, 0.8, 60],
  race: [1, 1, 10], chase: [1, 1, 20], room: [1, 0.45, 30], level: [1, 1, 10], bag: [1, 1, 10], carstop: [1, 0.8, 35], district: [1, 0.7, 90],
  idle: [0, 1, 40], perch: [0, 0.5, 40], sunset: [0, 1, 999], night: [0, 1, 999], day: [0, 1, 999],
};
const metaCache = {};
function meta(kind) {
  let m = metaCache[kind]; if (m) return m;
  const fam = kind.split('_')[0], d = DEF[kind] || DEF[fam] || [1, 0.5, 20], r = (T.RODZAJE && (T.RODZAJE[kind] || T.RODZAJE[fam])) || {};
  return metaCache[kind] = { prio: r.prio != null ? r.prio : d[0], p: r.p != null ? r.p : d[1], cd: r.cd != null ? r.cd : d[2], fam };
}
// gdy rodzaj nie ma linii w katalogu, probujemy podobnego (potem obcinamy koncowke _xxx)
const FALL = {
  hit_brute: 'hit', hit_gun: 'hit', web_brute: 'web', brute_stun: 'web', hurt_bat: 'hurt', hurt_gun: 'hurt', hurt_brute: 'hurt', hurt_boss: 'hurt',
  race_start: 'swing', race_end: 'hero', chase_start: 'crime', chase_end: 'crime', dive: 'swing', summit: 'perch', speed: 'swing', speed_record: 'speed',
  idle_long: 'idle', death: 'lowhp', respawn: 'lowhp', dodge_perfect: 'dodge', airhit: 'hit', level: 'levelup',
};
function linesFor(kind) {
  for (let k = kind, n = 0; k && n < 4; n++) {
    const a = byKind.get(k); if (a && a.length) return { key: k, all: a };
    k = FALL[k] || (k.lastIndexOf('_') > 0 ? k.slice(0, k.lastIndexOf('_')) : null);
  }
  return null;
}
// warianty zalezne od kontekstu: [najbardziej szczegolowy, ..., ogolny]
function candidates(kind, c) {
  const L = [];
  if (c) {
    if (c.variant) L.push(kind + '_' + c.variant);
    const e = c.enemy || c.from;
    if (e && e.type && e.type !== 'boss' && kind === 'hit') L.push(e.type === 'brute' ? 'hit_brute' : e.type === 'gun' ? 'hit_gun' : kind);
    if (e && kind === 'hurt') L.push(e.type === 'brute' ? 'hurt_brute' : e.type === 'gun' ? 'hurt_gun' : e.type === 'boss' ? 'hurt_boss' : 'hurt_bat');
    if (c.fromAir && kind === 'hit') L.unshift('airhit');
    if (e && kind === 'web' && e.type === 'brute') L.push('web_brute');
  }
  L.push(kind); return L;
}

// ---------------------------------------------------------------- stan
const SPEAKER = { peter: 'SPIDER-MAN', thug: 'BANDYTA', may: 'CIOCIA MAY', mj: 'MARY JANE', yuri: 'POLICJA', fisk: 'KINGPIN', rhino: 'NOSOROŻEC', radio: 'RADIO' };
export const quipEvents = { onShow: null, onHide: null }; // UI podpina: onShow({ id, text, speaker, voice, mood, kind }), onHide()
let el = null, now = 0, gcd = 3, startT = 0, prevState = '', idleT = 0, comboSaid = false, lowSaid = false, silence = 0;
let cur = null, pending = null, reply = null, replyT = 0, dryT = 0, scanT = 0, distT = 0, lastDist = '', fast = 0, fastSaid = 0, diveSaid = false, summitSaid = false;
let combat = false, aware = 0, bossSeen = null, bossPh = 0;
const kcdAt = {}, recent = [], bags = {}, lastKey = {};

function bar() {
  const st = document.createElement('style');
  st.textContent = '#quip{position:fixed;left:50%;bottom:190px;transform:translateX(-50%);z-index:6;max-width:720px;padding:9px 20px 10px;background:rgba(5,16,26,.82);border-left:4px solid #e8232b;font:600 20px/1.3 Rajdhani,Arial,sans-serif;color:#fff;opacity:0;transition:opacity .35s;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.6)}#quip b{display:block;font-size:12px;letter-spacing:3px;color:#ff5a5f;margin-bottom:1px}#quip[data-v=thug]{border-left-color:#e8a02b}#quip[data-v=thug] b{color:#ffc15a}';
  document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'quip'; el.innerHTML = '<b>SPIDER-MAN</b><span></span>'; document.body.appendChild(el);
}

// ---------------------------------------------------------------- wybor linii
function wantMood(m, c) {
  if (c && c.mood) return c.mood;
  if (P.hp <= 35 && !P.dead) return 'strained';
  if (dryT > 0 || m.fam === 'hurt' || m.fam === 'death' || m.fam === 'respawn') return 'dry';
  if (P.combo >= 5 || fast > 1 || m.fam === 'combo' || m.fam === 'finisher' || m.fam === 'speed' || m.fam === 'dive') return 'excited';
  return 'normal';
}
function pick(found, mood) {
  const key = found.key; let bag = bags[key];
  if (!bag || !bag.length) { // nowa torba: tasowanie; ostatnio uzyta linia nie moze byc pierwsza
    bag = bags[key] = found.all.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = bag[i]; bag[i] = bag[j]; bag[j] = t; }
    if (bag.length > 1 && lastKey[key] === bag[0].id) { const t = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = t; }
  }
  let bi = 0, bs = -99;
  for (let i = 0; i < bag.length; i++) {
    const l = bag[i]; let s = Math.random() * 0.5;
    s += l.mood === mood ? 3 : (!l.mood || l.mood === 'normal') ? 1 : 0;
    if (combat && l.text.length <= 48) s += 1;
    if (recent.indexOf(l.id) >= 0) s -= 5;
    if (s > bs) { bs = s; bi = i; }
  }
  const l = bag.splice(bi, 1)[0]; lastKey[key] = l.id;
  recent.push(l.id); if (recent.length > 10) recent.shift();
  return l;
}

// ---------------------------------------------------------------- odtwarzanie
function showLine(l, speaker) {
  if (save.subs === false) return;
  if (!el) bar();
  el.dataset.v = l.voice || 'peter'; el.firstChild.textContent = speaker; el.lastChild.textContent = l.text; el.style.opacity = 1;
  if (quipEvents.onShow) try { quipEvents.onShow({ id: l.id, text: l.text, speaker, voice: l.voice || 'peter', mood: l.mood || 'normal', kind: l.kind }); } catch (e) {}
}
function hideLine() {
  if (el) el.style.opacity = 0;
  if (quipEvents.onHide) try { quipEvents.onHide(); } catch (e) {}
}
function gapFor() { return (combat ? 3.2 : G.chase || G.race || P.state === 'swing' || P.state === 'air' ? 6 : 10) * (0.8 + Math.random() * 0.5); }
function playKind(kind, c, found, prio) {
  const m = meta(kind);
  kcdAt[kind] = now + m.cd * (0.85 + Math.random() * 0.35);
  return playLine(pick(found, wantMood(m, c)), kind, prio, m);
}
function playLine(l, kind, prio, m, next) {
  if (cur) glosStop();
  const speaker = SPEAKER[l.voice || 'peter'] || SPEAKER.peter, me = cur = { id: l.id, kind, prio, age: 0, min: 1.4 + l.text.length * 0.045, audioEnd: false, voice: l.voice || 'peter', next };
  if (m && (m.fam === 'hurt' || m.fam === 'death')) dryT = 8;
  silence = 0; pending = null;
  showLine(l, speaker);
  try { glosPlay(l.id, { priority: prio, text: l.text, voice: l.voice || 'peter', onEnd: () => { me.audioEnd = true; } }); } catch (e) { me.audioEnd = true; }
  return true;
}
function finish() {
  const c = cur; cur = null; hideLine(); gcd = gapFor();
  if (c && c.next) { reply = c.next; replyT = 0.4; } // Peter odpowiada bandycie
}
// rozmowa z wrogiem: pary dialog_NN (a = bandyta, b = Peter), losowane bez zwracania
let dlgBag = [];
function dialogStart() {
  if (G.state !== 'play' || G.cine || fiskBossFight() || cur || gcd > 0 || (kcdAt.dialog || 0) > now || Math.random() > 0.35) return false;
  if (!dlgBag.length) { for (const k of byKind.keys()) if (k.startsWith('dialog_')) dlgBag.push(k); for (let i = dlgBag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = dlgBag[i]; dlgBag[i] = dlgBag[j]; dlgBag[j] = t; } }
  const k = dlgBag.pop(); if (!k) return false;
  const a = byKind.get(k).find(l => l.voice === 'thug'), b = byKind.get(k).find(l => l.voice !== 'thug'); if (!a || !b) return false;
  kcdAt.dialog = now + 45; return playLine(a, 'dialog', 1, null, b);
}

// kolejka: jedno miejsce, wyzszy priorytet wypiera nizszy
function enqueue(kind, c, prio, ttl) {
  if (pending && pending.prio >= prio) return false;
  pending = { kind, c, prio, ttl }; return true;
}
function request(kind, c, force) {
  if (G.state !== 'play' || G.cine || fiskBossFight()) return false; // walka z Kingpinem (poziom 6): Spider-Man milczy
  const m = meta(kind), prio = c && c.prio != null ? c.prio : m.prio;
  let found = null; for (const k of candidates(kind, c)) if ((found = linesFor(k))) break;
  if (!found) return false;
  if (!force) {
    if ((kcdAt[kind] || 0) > now) return false;
    if (Math.random() > m.p) return false;
  }
  if (cur) {
    if (prio > cur.prio && (prio >= 3 || force) || (force && prio >= cur.prio && cur.age > 0.5)) return playKind(kind, c, found, prio);
    return prio >= 2 && !(c && c.noqueue) ? enqueue(kind, c, prio, prio >= 3 ? 4 : 2) : false;
  }
  if (!force && prio < 3 && gcd > 0) return prio >= 2 && !(c && c.noqueue) ? enqueue(kind, c, prio, 2) : false;
  return playKind(kind, c, found, prio);
}
export function say(kind, force) { return request(kind, null, force); }
export function sayCtx(kind, ctx) { return request(kind, ctx || null, ctx && ctx.force); }
export const quipStart = () => { startT = 5; };
export const quipState = () => ({ cur, pending, gcd, combat, aware, silence, now });

// ---------------------------------------------------------------- petla
export function updateQuips(dt) {
  now += dt; gcd -= dt; dryT -= dt; silence += dt;
  if (cur) { // zycie biezacej kwestii: napis min. czas, potem do konca nagrania
    cur.age += dt;
    const talking = glosState.speaking && glosState.id === cur.id;
    if (cur.age > 16 || (cur.age >= cur.min && (cur.audioEnd || !talking))) finish();
  } else if (replyT > 0) { replyT -= dt; if (replyT <= 0 && reply) { const l = reply; reply = null; playLine(l, 'dialog', 1, null); } }
  if (G.state !== 'play' || G.cine) { prevState = ''; pending = null; return; }
  if (pending) {
    pending.ttl -= dt;
    if (pending.ttl <= 0) pending = null;
    else if (!cur && (gcd <= 0 || pending.prio >= 3)) { const p = pending; pending = null; request(p.kind, p.c, true); }
  }
  if (startT > 0) { startT -= dt; if (startT <= 0) if (!save.introSaid && byKind.has('intro')) { save.introSaid = true; say('intro', true); } else say(save.tod === 'night' ? 'night' : save.tod === 'day' ? 'day' : 'sunset', true); }
  const st = P.state;
  if (st === 'swing' && prevState !== 'swing') say('swing');
  prevState = st;
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (st === 'ground' && hs < 0.5 && !P.atk && !P.dead && !combat) { idleT += dt; if (idleT > (P.perchT > 0 ? 6 : 14)) { idleT = 0; say(P.perchT > 0 ? 'perch' : 'idle', true); } } else idleT = 0;
  if (P.combo >= 6) { if (!comboSaid) { comboSaid = true; say('combo'); } } else if (P.combo < 2) comboSaid = false;
  if (!P.dead && P.hp <= 30) { if (!lowSaid) { lowSaid = true; say('lowhp'); } } else if (P.hp > 60) lowSaid = false;

  // szybkie bujanie i rekord predkosci
  const sp = P.vel.length();
  if ((st === 'swing' || st === 'air') && sp > 40) {
    fast += dt;
    if (fast > 1.1 && now - fastSaid > 5) {
      fastSaid = now; const rec = sp > 48 && sp > (save.recSpeed || 0) + 1.5;
      if (rec) save.recSpeed = sp;
      sayCtx('speed', { variant: rec ? 'record' : '' });
    }
  } else if (fast > 0) fast = Math.max(0, fast - dt * 2);
  // nurkowanie z wysokosci i szczyt
  if (st === 'air' && P.vel.y < -28 && P.pos.y > 50) { if (!diveSaid) { diveSaid = true; say('dive'); } } else if (st !== 'air' || P.vel.y > -5) diveSaid = false;
  if (P.pos.y > 130 && st !== 'air') { if (!summitSaid) { summitSaid = true; say('summit'); } } else if (P.pos.y < 80) summitSaid = false;
  // dluga cisza (poza walka)
  if (!combat && !G.boss) { if (silence > 75) { silence = 40; say('idle_long'); } else if (silence > 40 && say('random_thought')) silence = 20; }

  // wolniejsze skanowanie: wrogowie, boss, dzielnica
  scanT -= dt;
  if (scanT <= 0) {
    scanT = 0.4; let n = 0, anyAwake = false;
    for (const e of enemies) {
      if (e.dead || e.gone || e.type === 'boss') continue;
      const s = e.state, hot = s === 'fight' || s === 'windup' || s === 'aim' || s === 'recover' || s === 'hurt' || s === 'stun';
      if (!hot) { e._qa = false; continue; }
      const d = Math.abs(e.pos.x - P.pos.x) + Math.abs(e.pos.z - P.pos.z);
      if (d > 60) continue;
      anyAwake = true; if (d < 28) n++;
      if (!e._qa && d < 40) { e._qa = true; if (!request(e.type === 'gun' ? 'gun' : e.type === 'brute' ? 'brute' : 'bat')) dialogStart(); }
    }
    aware = n; combat = anyAwake || P.hurtT > 0 || !!G.boss;
    if (n >= 3) request('outnumbered');
    // boss: wejscie, fazy Kingpina, wygrana
    const b = G.boss;
    if (b && !bossSeen) { bossSeen = b; bossPh = 0; request(b.name === 'KINGPIN' ? 'fisk_enter' : 'rhino_start', { prio: 3 }, true); }
    else if (b && b === bossSeen && b.max) {
      const king = b.name === 'KINGPIN', ph = king ? (b.hp > b.max * 0.66 ? 0 : b.hp > b.max * 0.33 ? 1 : 2) : (b.hp > b.max * 0.5 ? 0 : 1);
      if (ph > bossPh) { bossPh = ph; request((king ? 'fisk_phase' : 'rhino_phase') + (ph + 1), { prio: 3 }, true); }
    } else if (!b && bossSeen) { const w = bossSeen; bossSeen = null; if (w.dead) request(w.name === 'KINGPIN' ? 'fisk_win' : 'rhino_win', { prio: 3 }, true); }
    // dzielnica (raz na sekunde, nie we wnetrzu)
    if ((distT -= 0.4) <= 0) {
      distT = 1;
      if (!G.interior) { const d = districtAt(P.pos.x, P.pos.z); if (d !== lastDist) { if (lastDist) say('district_' + d); lastDist = d; } }
    }
  }
}
