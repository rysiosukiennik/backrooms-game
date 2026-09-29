// Drzewko umiejetnosci: 1 punkt na kazdy poziom (pierwszy od razu na start).
import { save, doSave } from './util.js';

export const SKILLS = [
  { id: 'hp1', col: 0, name: 'TWARDZIEL I', desc: '+25 zdrowia.' },
  { id: 'hp2', col: 0, name: 'TWARDZIEL II', desc: '+25 zdrowia.', req: 'hp1' },
  { id: 'regen', col: 0, name: 'REGENERACJA', desc: 'Zdrowie wraca dwa razy szybciej.', req: 'hp2' },
  { id: 'hp3', col: 0, name: 'TWARDZIEL III', desc: '+25 zdrowia.', req: 'regen' },
  { id: 'pow', col: 1, name: 'MOCNE CIOSY', desc: 'Ciosy zadają o połowę więcej obrażeń.' },
  { id: 'focus', col: 1, name: 'SKUPIENIE', desc: 'Pasek skupienia ładuje się o połowę szybciej.', req: 'pow' },
  { id: 'fin', col: 1, name: 'PODWÓJNE WYKOŃCZENIE', desc: 'Wykończenie zawija w sieć także najbliższego bandytę obok.', req: 'focus' },
  { id: 'pow2', col: 1, name: 'PIĘŚĆ TYTANA', desc: 'Jeszcze +50% obrażeń. Osiłki szybciej padają.', req: 'fin' },
  { id: 'web', col: 2, name: 'MOCNA SIEĆ', desc: 'Bandytę zawiniesz w kokon już dwoma strzałami.' },
  { id: 'sense', col: 2, name: 'PAJĘCZY ZMYSŁ', desc: 'Idealny unik spowalnia czas dwa razy dłużej.', req: 'web' },
  { id: 'launch', col: 2, name: 'DALEKI ZACZEP', desc: 'Zaczep działa z 90 m zamiast 60 m.', req: 'sense' },
  { id: 'swing', col: 3, name: 'SZYBKIE BUJANIE', desc: 'Bujasz się o 15% szybciej.' },
  { id: 'zip', col: 3, name: 'TRZECI ZIP', desc: 'Trzy zipy siecią w powietrzu zamiast dwóch.', req: 'swing' },
  { id: 'swing2', col: 3, name: 'MISTRZ SIECI', desc: 'Jeszcze +15% prędkości i wyższy skok z sieci.', req: 'zip' },
];
export const COLS = ['ZDROWIE', 'WALKA', 'SIEĆ I ZMYSŁ', 'RUCH'];
export const has = id => save.skills.includes(id);
export const skillPoints = () => Math.max(0, save.lvl - save.skills.length);
export const maxHp = () => 100 + (has('hp1') ? 25 : 0) + (has('hp2') ? 25 : 0) + (has('hp3') ? 25 : 0);
export const dmgMul = () => 1 + (has('pow') ? 0.5 : 0) + (has('pow2') ? 0.5 : 0);
export const swingMul = () => 1 + (has('swing') ? 0.15 : 0) + (has('swing2') ? 0.15 : 0);
export const zipMax = () => has('zip') ? 3 : 2;
export const websToWrap = () => has('web') ? 2 : 3;
export const perchRange = () => has('launch') ? 90 : 60;
export function canBuy(s) { return !has(s.id) && skillPoints() > 0 && (!s.req || has(s.req)); }
export function buy(s) { if (!canBuy(s)) return false; save.skills.push(s.id); doSave(); return true; }
