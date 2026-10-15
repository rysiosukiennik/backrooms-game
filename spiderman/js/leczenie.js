// Leczenie: przytrzymanie D-pad w dol (klawiatura H) zuzywa pasek skupienia i leczy.
// Jeden pasek skupienia (P.focus = 1) daje ok. +35% maksymalnego zdrowia. Przerywane przez hurtPlayer / walke.
import { rnd } from './util.js';
import { G, P } from './stan.js';
import { maxHp } from './umiejetnosci.js';
import { sfx } from './dzwiek.js';
import { burst, fxPools } from './efekty.js';

export const HEAL_PER_FOCUS = 0.35; // czesc maksymalnego zdrowia na jeden pasek
const DRAIN = 0.55;                  // pasek skupienia na sekunde
const GREEN = [0.12, 1.0, 0.38];
let fxT = 0, sndT = 0;

export function stopHeal() { P.healing = false; }
export function canHeal() {
  return !P.dead && !P.fin && !P.atk && !P.lunge && P.state === 'ground' && P.dodgeT <= 0 && P.hurtT <= 0 && P.hp < maxHp() && P.focus > 0.02 && G.state === 'play';
}

export function updateHeal(dt, I) {
  if (!(I && I.healHeld && canHeal())) { if (P.healing) { P.healing = false; sfx('ui', 0.5); } return; }
  const mh = maxHp(), use = Math.min(P.focus, DRAIN * dt, (mh - P.hp) / (mh * HEAL_PER_FOCUS));
  if (!P.healing) { P.healing = true; sndT = 0; fxT = 0; sfx('pickup', 0.35); }
  P.focus -= use; P.hp = Math.min(mh, P.hp + use * HEAL_PER_FOCUS * mh);
  P.regenT = Math.max(P.regenT, 0.5); P.healT = (P.healT || 0) + dt;
  fxT -= dt; sndT -= dt;
  if (fxT <= 0) { // zielone iskry unoszace sie wokol ciala
    fxT = 0.045; const { sp } = fxPools();
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * 6.283, r = rnd(0.25, 0.7);
      sp.e(P.pos.x + Math.cos(a) * r, P.pos.y + rnd(0.1, 1.5), P.pos.z + Math.sin(a) * r, 0, rnd(1.2, 2.6), 0, rnd(0.5, 0.9), GREEN, 0.14, -0.6, 1.5, 0);
    }
  }
  if (sndT <= 0) { sndT = 0.5; sfx('ring', 0.18); burst(P.pos.x, P.pos.y + 0.9, P.pos.z, 3, 0x39ff6a, 1.2); }
}

// poza przygotowana pod leczenie (przysiad, dlonie przy piersi) — wolane z buildPose
export function healPose(t) {
  const k = 0.5 + 0.5 * Math.sin((P.healT || 0) * 6);
  t.by = -0.28; t.hLx = -0.9; t.kL = 1.5; t.hRx = -0.7; t.kR = 1.3; t.bp = 0.45 + 0.05 * k; t.hx = 0.35;
  t.sLx = -1.0; t.sRx = -1.0; t.eL = -1.7; t.eR = -1.7; t.sLz = 0.35; t.sRz = -0.35;
}
