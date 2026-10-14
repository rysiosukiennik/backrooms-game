// STUB silnika glosu (tylko ksztalt stanu czytany przez animacje i UI). Prawdziwy glos.js pisze agent SILNIK —
// przy scalaniu ta wersja jest zastepowana jego plikiem (musi eksportowac glosState o tym samym ksztalcie).
export const glosState = { speaking: false, speaker: '', level: 0, id: '', mood: 'normal' };
export const glosSpeaking = () => glosState.speaking;
export function glosStop() { glosState.speaking = false; glosState.level = 0; }
