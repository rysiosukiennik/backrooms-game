// Tymczasowy most do silnika glosu (glos.js pisze agent SILNIK). Ten sam ksztalt API:
// glosPlay(id, { priority, text, onEnd }), glosStop(), glosSpeaking(), glosState.
// Po scaleniu z glos.js ten plik nalezy zamienic na: export { glosPlay, glosStop, glosSpeaking, glosState } from './glos.js';
// Stub: jesli jest manifest nagran (window.GLOS_MANIFEST) bierze z niego dlugosc, inaczej szacuje z tekstu;
// glos czyta syntezatorem przegladarki (jesli wlaczony w ustawieniach), a zakonczenie zglasza po czasie.
import { save } from './util.js';

export const glosState = { speaking: false, speaker: '', level: 0, id: '' };
let tok = 0, tm = 0, lv = 0;

export const glosSpeaking = () => glosState.speaking;
export const glosMs = (id, text) => {
  const m = window.GLOS_MANIFEST && window.GLOS_MANIFEST[id];
  return m && m.ms ? m.ms : Math.max(1200, 450 + (text || '').length * 62);
};
function lvTick() {
  if (!glosState.speaking) { glosState.level = 0; lv = 0; return; }
  glosState.level = 0.35 + 0.5 * Math.abs(Math.sin(performance.now() / 95)) * (0.6 + 0.4 * Math.sin(performance.now() / 310));
  lv = requestAnimationFrame(lvTick);
}
export function glosStop() {
  tok++; clearTimeout(tm); cancelAnimationFrame(lv);
  glosState.speaking = false; glosState.level = 0; glosState.id = '';
  try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) {}
}
export function glosPlay(id, o = {}) {
  glosStop();
  const my = tok, ms = glosMs(id, o.text);
  glosState.speaking = true; glosState.id = id; glosState.speaker = o.voice || '';
  cancelAnimationFrame(lv); lv = requestAnimationFrame(lvTick);
  try {
    const ss = window.speechSynthesis;
    if (save.voice && ss && o.text && !(window.GLOS_MANIFEST && window.GLOS_MANIFEST[id])) {
      const v = ss.getVoices().find(x => /^pl/i.test(x.lang));
      if (v) { const u = new SpeechSynthesisUtterance(o.text); u.voice = v; u.lang = v.lang; u.rate = 1.05; u.volume = 0.9; ss.speak(u); }
    }
  } catch (e) {}
  tm = setTimeout(() => {
    if (my !== tok) return;
    glosState.speaking = false; glosState.level = 0; glosState.id = '';
    if (o.onEnd) o.onEnd();
  }, ms);
  return ms;
}
