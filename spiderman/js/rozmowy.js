// Rozmowy telefoniczne i komunikaty radiowe: maly panel w rogu (ikona, imie, napisy, wskaznik mowy),
// gra toczy sie dalej. Rozmowa odklada sie, gdy trwa walka / boss / scenka, i wraca pozniej.
// Wyzwalacze sprawdza updateCalls(dt) (wolane z petli gry); testowo: playCall(id), triggerCheck().
import { G, P, enemies, crimes } from './stan.js';
import { save, doSave, clamp } from './util.js';
import { sfx } from './dzwiek.js';
import { fiskActive } from './fisk.js';
import { LINIE, ROZMOWY, KTO, MOWCA } from './rozmowy_teksty.js';
import { glosPlay, glosStop, glosState, glosMs } from './rozmowy_glos.js';

const BY = new Map(LINIE.map(l => [l.id, l]));
export const lineInfo = id => BY.get(id) || null;
export const lineMs = id => { const l = BY.get(id); return l ? glosMs(id, l.text) : 0; };
export const speakerName = v => MOWCA[v] || '';

// ---------------------------------------------------------------- pojedyncza kwestia (dla scenek i rozmow)
// Gra kwestie przez silnik glosu; onEnd wola sie raz: po koncu nagrania albo po czasie zapasowym.
export function sayLine(id, onEnd, priority = 3) {
  const l = BY.get(id); let done = false, fb = 0;
  const fin = () => { if (done) return; done = true; clearTimeout(fb); if (onEnd) onEnd(); };
  if (!l) { fb = setTimeout(fin, 0); return { ms: 0, line: null, cancel() { done = true; clearTimeout(fb); } }; }
  const ms = glosMs(id, l.text);
  fb = setTimeout(fin, ms + 2500);
  try { glosPlay(id, { priority, text: l.text, voice: l.voice, onEnd: fin }); } catch (e) { /* silnik niedostepny: zostaje czas */ }
  return { ms, line: l, cancel() { done = true; clearTimeout(fb); } };
}

// ---------------------------------------------------------------- panel
const COL = { may: '#f2b36a', mj: '#ff7aa5', yuri: '#62b9ff', radio: '#9ee37d' };
let pan = null, bars = [], eName = null, eWho = null, eTxt = null, eSub = null, thugEl = null, thugT = 0;
function ui() {
  if (pan) return;
  const st = document.createElement('style');
  st.textContent = `#callPan{position:fixed;right:28px;top:118px;width:330px;z-index:6;padding:10px 14px 12px;background:linear-gradient(180deg,rgba(7,18,30,.9),rgba(4,12,20,.86));border-left:4px solid var(--cc,#f2b36a);border-radius:2px 8px 8px 2px;box-shadow:0 6px 22px rgba(0,0,0,.5);color:#fff;font:600 17px/1.3 Rajdhani,Arial,sans-serif;opacity:0;transform:translateX(30px);transition:opacity .35s,transform .35s;pointer-events:none}
#callPan.on{opacity:1;transform:none}
#callPan .ch{display:flex;align-items:center;gap:9px;margin-bottom:6px}
#callPan svg{width:22px;height:22px;flex:none;fill:var(--cc,#f2b36a)}
#callPan.ring svg{animation:cpr .22s linear infinite alternate}
@keyframes cpr{from{transform:rotate(-16deg)}to{transform:rotate(16deg)}}
#callPan .cn{flex:1;font-size:19px;letter-spacing:2px;text-transform:uppercase;color:var(--cc,#f2b36a);white-space:nowrap}
#callPan .cs{font-size:12px;letter-spacing:2px;color:#9fb4c4;margin-top:-3px}
#callPan .cb{display:flex;align-items:flex-end;gap:3px;height:20px}
#callPan .cb i{display:block;width:4px;height:4px;border-radius:2px;background:var(--cc,#f2b36a);transition:height .06s}
#callPan .cw{font-size:12px;letter-spacing:3px;color:#ff7a80;margin-bottom:1px}
#callPan .ct{min-height:2.6em;text-shadow:0 1px 5px rgba(0,0,0,.7)}
#thugSay{position:fixed;left:50%;bottom:235px;transform:translateX(-50%);z-index:6;padding:6px 18px;background:rgba(20,6,6,.8);border-left:4px solid #d44;font:700 19px Rajdhani,Arial,sans-serif;color:#fff;opacity:0;transition:opacity .25s;pointer-events:none}
#thugSay b{color:#ff7a70;letter-spacing:3px;font-size:12px;margin-right:10px}`;
  document.head.appendChild(st);
  pan = document.createElement('div'); pan.id = 'callPan';
  pan.innerHTML = '<div class="ch"><svg viewBox="0 0 24 24"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>' +
    '<div style="flex:1"><div class="cn"></div><div class="cs"></div></div><div class="cb"><i></i><i></i><i></i><i></i><i></i></div></div><div class="cw"></div><div class="ct"></div>';
  document.body.appendChild(pan);
  bars = [...pan.querySelectorAll('.cb i')]; eName = pan.querySelector('.cn'); eSub = pan.querySelector('.cs'); eWho = pan.querySelector('.cw'); eTxt = pan.querySelector('.ct');
  thugEl = document.createElement('div'); thugEl.id = 'thugSay'; thugEl.innerHTML = '<b></b><span></span>'; document.body.appendChild(thugEl);
}
function showPan(on) { ui(); pan.classList.toggle('on', on); if (!on) pan.classList.remove('ring'); }

// ---------------------------------------------------------------- stan rozmow
let cur = null;               // trwajaca: { id, def, i, phase: 'ring'|'talk'|'pause'|'wait'|'end', t, h, pauseMs }
const queue = [];             // oczekujace id
const cdUntil = {};           // powtarzalne: czas gry, od kiedy znow wolno
let playT = 0, gapT = 0, pollT = 0;

const calls = () => save.calls || (save.calls = {});
export const callActive = () => !!cur;
export const callState = () => ({ active: !!cur, id: cur && cur.id, phase: cur && cur.phase, step: cur && cur.i, queue: queue.slice(), panel: !!(pan && pan.classList.contains('on')), done: Object.keys(calls()), playT, gapT });

// walka / boss / pogon / wyscig: wtedy rozmowa sie nie zaczyna ani nie rusza dalej
function inCombat() {
  if (G.boss || G.race || G.chase || G.interior || fiskActive()) return true;
  if (P.atk || P.comboT > 0 && P.combo > 0 || P.hp < 35 || P.dead) return true;
  for (const e of enemies) if (!e.dead && !e.gone && !e.webbed && e.pos.distanceTo(P.pos) < 24) return true;
  return false;
}
const canRun = () => G.state === 'play' && !G.cine && !P.dead;

function nearCrime() {
  let d = 9999;
  for (const c of crimes) if (c.active) d = Math.min(d, Math.hypot(c.x - P.pos.x, c.z - P.pos.z));
  return d;
}
const ctx = () => ({ save, G, P, t: playT, crime: nearCrime(), bags: save.bags.length, crimes: save.crimes, lvl: save.lvl });

function setCaller(def) {
  ui();
  pan.style.setProperty('--cc', COL[def.kto] || '#f2b36a');
  eName.textContent = KTO[def.kto] || def.kto;
}
function setLine(id) {
  const l = BY.get(id); if (!l) return;
  eWho.textContent = MOWCA[l.voice] || ''; eTxt.textContent = l.text;
  pan.style.setProperty('--cc', l.voice === 'peter' ? '#e8232b' : COL[cur.def.kto] || '#f2b36a');
}

function start(id) {
  const def = ROZMOWY[id]; if (!def) return false;
  if (cur) abort(false);
  const radio = def.kto === 'radio';
  cur = { id, def, i: 0, phase: radio ? 'talk' : 'ring', t: 0, h: null, pauseMs: 0, waitT: 0 };
  setCaller(def);
  eSub.textContent = radio ? 'KOMUNIKAT' : 'DZWONI…'; eWho.textContent = ''; eTxt.textContent = radio ? '' : def.kto === 'may' ? '☎' : '';
  showPan(true); pan.classList.toggle('ring', !radio);
  if (radio) playStep(); else sfx('ring', 0.6);
  return true;
}
function playStep() {
  const k = cur.def.kroki[cur.i], me = cur;
  cur.phase = 'talk'; cur.t = 0; pan.classList.remove('ring'); eSub.textContent = cur.def.kto === 'radio' ? 'KOMUNIKAT' : 'POŁĄCZENIE';
  setLine(k.id_linii);
  cur.h = sayLine(k.id_linii, () => { if (cur === me && me.phase === 'talk') { me.phase = 'pause'; me.t = 0; me.pauseMs = k.pauza_ms || 300; } });
}
function finish() {
  const me = cur, def = me.def;
  calls()[me.id] = Date.now(); doSave();
  if (def.powtarzalna) cdUntil[me.id] = playT + (def.cd || 120);
  gapT = def.kto === 'radio' ? 45 : 80;
  me.phase = 'end'; me.t = 0; eSub.textContent = def.kto === 'radio' ? '' : 'ROZMOWA ZAKOŃCZONA'; eWho.textContent = ''; eTxt.textContent = '';
  for (const b of bars) b.style.height = '4px';
}
// przerwanie (scenka, menu, smierc, zbyt dluga walka); niedokonczona rozmowa wraca do kolejki
function abort(requeue = true) {
  if (!cur) return;
  const id = cur.id, ended = cur.phase === 'end';
  if (cur.h) cur.h.cancel();
  if (cur.phase === 'talk') glosStop();
  cur = null; showPan(false);
  if (requeue && !ended && !queue.includes(id)) queue.unshift(id);
}

// ---------------------------------------------------------------- wyzwalacze
function eligible() {
  const c = ctx(), out = [], rad = [], done = calls();
  for (const id in ROZMOWY) {
    const d = ROZMOWY[id];
    if (queue.includes(id) || (cur && cur.id === id)) continue;
    if (d.powtarzalna) { if ((cdUntil[id] || 0) > playT) continue; } else if (done[id]) continue;
    let ok = false; try { ok = !!d.warunek(c); } catch (e) {}
    if (ok) (d.kto === 'radio' ? rad : out).push(id);
  }
  return out.length ? out : rad.length ? [rad[Math.floor(Math.random() * rad.length)]] : [];
}
// wymusza sprawdzenie warunkow od razu (test); force pomija przerwe miedzy rozmowami
export function triggerCheck(force = false) {
  if (!force && gapT > 0) return [];
  const e = eligible(); if (e.length) queue.push(e[0]);
  return e.slice(0, 1);
}
// test / zdarzenie: odtwarza rozmowe od razu (force) albo ustawia w kolejce
export function playCall(id, opts = {}) {
  if (!ROZMOWY[id]) return 'brak';
  if (opts.force) { const i = queue.indexOf(id); if (i >= 0) queue.splice(i, 1); start(id); return 'started'; }
  if (!queue.includes(id) && !(cur && cur.id === id)) queue.push(id);
  return 'queued';
}
export function resetCalls() { abort(false); queue.length = 0; for (const k in cdUntil) delete cdUntil[k]; playT = 0; gapT = 0; }

// okrzyk bandyty na widok Spider-Mana (krotki napis nad dolem ekranu, bez panelu)
export function thugShout(brute = false) {
  const ids = LINIE.filter(l => l.id.startsWith(brute ? 'thug_brute_' : 'thug_spot_')).map(l => l.id);
  const id = ids[Math.floor(Math.random() * ids.length)], l = BY.get(id); ui();
  thugEl.querySelector('b').textContent = 'BANDYTA'; thugEl.querySelector('span').textContent = l.text; thugEl.style.opacity = 1; thugT = 2.6 + l.text.length * 0.04;
  try { glosPlay(id, { priority: 1, text: l.text, voice: l.voice }); } catch (e) {}
  return id;
}
let shoutCD = 12;

// ---------------------------------------------------------------- petla
export function updateCalls(dt) {
  if (G.state === 'menu') { if (cur) abort(); playT = 0; return; }
  if (thugT > 0) { thugT -= dt; if (thugT <= 0 && thugEl) thugEl.style.opacity = 0; }
  if (G.state !== 'play') { if (pan && pan.classList.contains('on')) pan.style.opacity = 0; return; }
  if (pan) pan.style.opacity = '';
  if (G.cine || P.dead) { if (cur) abort(); return; }
  playT += dt; gapT -= dt; shoutCD -= dt;

  if (cur) {
    cur.t += dt;
    if (cur.phase === 'talk') {
      const lv = glosState.level, on = glosState.speaking;
      for (let i = 0; i < bars.length; i++) bars[i].style.height = on ? Math.round(4 + 16 * clamp(lv * (0.55 + 0.45 * Math.abs(Math.sin(performance.now() / (70 + i * 23) + i))), 0, 1)) + 'px' : '4px';
    } else for (const b of bars) b.style.height = '4px';
    if (cur.phase === 'ring') {
      if (Math.floor((cur.t + dt) / 1.1) > Math.floor(cur.t / 1.1) && cur.t < 2.2) sfx('ring', 0.6);
      if (cur.t > 2.4) playStep();
    } else if (cur.phase === 'pause') {
      if (cur.t * 1000 >= cur.pauseMs) {
        if (++cur.i >= cur.def.kroki.length) finish();
        else if (inCombat()) { cur.phase = 'wait'; cur.t = 0; eSub.textContent = 'ZAWIESZONA'; }
        else playStep();
      }
    } else if (cur.phase === 'wait') {
      if (!inCombat()) playStep();
      else if (cur.t > 25) abort(); // za dlugo trwa walka: rozmowa wraca do kolejki
    } else if (cur.phase === 'end') {
      if (cur.t > 0.9) { showPan(false); cur = null; }
    }
    return;
  }

  // brak rozmowy: ewentualny wyzwalacz i start z kolejki
  pollT -= dt;
  if (pollT <= 0) { pollT = 0.7; if (gapT <= 0 && playT > 3 && !queue.length) triggerCheck(false); }
  if (queue.length && gapT <= 0 && !inCombat()) start(queue.shift());
  // okrzyki bandytow w poblizu gracza
  if (shoutCD <= 0 && !cur) {
    for (const e of enemies) {
      if (e.dead || e.gone || e.webbed || e.type === 'boss') continue;
      if (e.pos.distanceTo(P.pos) < 15 && Math.random() < 0.5) { thugShout(e.type === 'brute'); shoutCD = 30; break; }
    }
    if (shoutCD <= 0) shoutCD = 3;
  }
}
