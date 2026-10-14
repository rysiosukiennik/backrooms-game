// Animacja mowy Spider-Mana: gdy mowi Peter (glosState z glos.js), glowa kiwa sie i przechyla w rytm akcentow,
// soczewki maski lekko sie zwezaja (mimika), a w spoczynku dochodza gesty rak i wzruszenie ramion.
// Wszystko plynnie wygasa, gdy glos milknie. Nie dotyka fizyki ani sterowania — tylko pozy (dodawane do celu pozy).
import { glosState } from './glos.js';

const S = { amt: 0, env: 0, slow: 0, acc: 0, sq: 0, shrug: 0, gL: 0, gR: 0, side: 1, prevAcc: 0, mood: 0, sqApplied: -1 };
const damp = (k, dt) => 1 - Math.exp(-k * dt);
export const speechState = S; // do testow i odczytu z zewnatrz

export function updateSpeech(dt, time) {
  if (!(dt > 0)) return;
  const g = glosState, on = !!g.speaking && (!g.speaker || g.speaker === 'peter');
  let lv = on ? g.level || 0 : 0;
  // gdy silnik nie mierzy poziomu (np. synteza przegladarki), udajemy rytm sylab
  if (on && lv < 0.02) lv = 0.3 + 0.25 * Math.sin(time * 8.5) * Math.sin(time * 3.1 + 1);
  lv = Math.min(1, Math.max(0, lv));
  S.amt += ((on ? 1 : 0) - S.amt) * damp(on ? 7 : 4, dt);
  S.env += (lv - S.env) * damp(on ? 20 : 8, dt);
  S.slow += (lv - S.slow) * damp(2.5, dt);
  // akcent = chwilowy wzrost poziomu ponad srednia; szybki atak, wolne opadanie
  const a = Math.max(0, S.env - S.slow) * 2.4;
  S.acc = a > S.acc ? S.acc + (a - S.acc) * damp(30, dt) : S.acc * Math.exp(-5 * dt);
  S.acc = Math.min(1, S.acc);
  if (S.acc > 0.35 && S.prevAcc <= 0.35) S.side = -S.side; // gesty na przemian lewa/prawa reka
  S.prevAcc = S.acc;
  const dry = g.mood === 'dry' ? 1 : 0, strained = g.mood === 'strained' ? 1 : 0;
  S.mood += (dry - S.mood) * damp(3, dt);
  // mruzenie: lekkie w trakcie mowy, mocniejsze na akcentach i przy sarkazmie (mood 'dry'); 'strained' = bardziej zacisniete
  const sqT = S.amt * (0.18 + 0.5 * S.acc + 0.45 * S.mood + 0.25 * strained);
  S.sq += (Math.min(1, sqT) - S.sq) * damp(14, dt);
  // wzruszenie ramion co kilka sekund (wolny puls), mocniejsze przy sarkazmie
  const sp = Math.max(0, Math.sin(time * 1.15 + 0.6)); const sg = sp * sp * sp * S.amt * (0.55 + 0.45 * S.mood);
  S.shrug += (sg - S.shrug) * damp(6, dt);
  const gT = S.amt * S.acc;
  S.gR += ((S.side > 0 ? gT : gT * 0.25) - S.gR) * damp(14, dt);
  S.gL += ((S.side < 0 ? gT : gT * 0.25) - S.gL) * damp(14, dt);
}

// dodaje ruch mowy do pozy docelowej t. mode: 'stand' (stoi), 'run' (biegnie), 'swing' (buja sie)
export function speechPose(t, mode, time) {
  const m = S.amt; if (m < 0.002) return;
  const k = mode === 'stand' ? 1 : mode === 'run' ? 0.45 : 0.35;
  // glowa: kiwniecia na akcentach (w dol), delikatne przechyly i skrety
  t.hx += k * m * (0.05 * Math.sin(time * 4.6) + 0.34 * S.acc + 0.18 * S.env - 0.04);
  t.hz += k * m * (0.07 * Math.sin(time * 1.9 + 0.5) + 0.05 * S.side * S.acc);
  t.hy += k * m * (0.09 * Math.sin(time * 2.4 + 1.1) + 0.06 * S.side * S.env);
  if (mode === 'swing') { t.br += m * 0.03 * Math.sin(time * 1.9); return; }
  if (mode !== 'stand') return;
  // gesty rak w spoczynku: na akcencie przedramie unosi sie do przodu, plus wzruszenie ramion
  t.sRx -= S.gR * 0.75; t.eR -= S.gR * 0.7; t.sRz -= S.gR * 0.12;
  t.sLx -= S.gL * 0.6; t.eL -= S.gL * 0.6; t.sLz += S.gL * 0.12;
  t.sLz += S.shrug * 0.32; t.sRz -= S.shrug * 0.32; t.eL -= S.shrug * 0.5; t.eR -= S.shrug * 0.5;
  t.chx -= S.shrug * 0.03; t.hx -= S.shrug * 0.05; t.hz += S.shrug * 0.06;
  t.spy += m * 0.04 * Math.sin(time * 1.6);
}

// mimika soczewek (wolac po applyPose; zmienia skale tylko gdy sie zmienila)
export function speechFace(H) {
  if (!H || !H.squint) return;
  const q = Math.round(S.sq * 200) / 200;
  if (q !== S.sqApplied) { S.sqApplied = q; H.squint(q); }
}
