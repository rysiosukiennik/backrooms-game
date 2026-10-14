// STUB silnika glosu (zastapi go wersja agenta SILNIK o tym samym API).
// Bez nagran: glosPlay oddaje napis do syntezatora przegladarki, jak dawniej w docinki.js.
import { save } from './util.js';

export const glosState = { speaking: false, speaker: '', level: 0, id: '' };
let onEndCb = null;

export function initGlos() {}
function end() { const f = onEndCb; onEndCb = null; glosState.speaking = false; glosState.level = 0; glosState.id = ''; if (f) try { f(); } catch (e) {} }
export function glosStop() { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} onEndCb = null; glosState.speaking = false; glosState.level = 0; glosState.id = ''; }
export function glosSpeaking() { return glosState.speaking; }
export function glosPlayText(text, opt = {}) {
  try {
    const ss = window.speechSynthesis; if (!save.voice || !ss || !text) return false;
    const v = ss.getVoices().find(x => /^pl/i.test(x.lang)); if (!v) return false;
    ss.cancel(); const u = new SpeechSynthesisUtterance(text); u.voice = v; u.lang = v.lang; u.rate = 1.06; u.pitch = 1.25; u.volume = 0.9;
    glosState.speaking = true; glosState.speaker = opt.voice || 'peter'; glosState.id = opt.id || '';
    onEndCb = opt.onEnd || null; u.onend = u.onerror = end; ss.speak(u); return true;
  } catch (e) { return false; }
}
export function glosPlay(id, opt = {}) { return glosPlayText(opt.text, { voice: opt.voice, id, onEnd: opt.onEnd }); }
