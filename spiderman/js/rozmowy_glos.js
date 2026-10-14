// Cienka warstwa: rozmowy korzystaja z prawdziwego silnika glosu (glos.js).
// glosMs: czas trwania linii z manifestu nagran (ms) albo oszacowany z dlugosci tekstu, gdy nagrania brak.
export { glosPlay, glosStop, glosSpeaking, glosState } from './glos.js';
export const glosMs = (id, text) => {
  const m = window.GLOS_MANIFEST && window.GLOS_MANIFEST[id];
  return m && m.ms ? m.ms : Math.max(1200, 450 + (text || '').length * 62);
};
