// Pary "dialog z wrogiem": wrog (voice thug) wola, Spider-Man (voice peter) odpowiada.
// Para ma wspolny kind 'dialog_NN'; id: dlg_NN_a (wrog) i dlg_NN_b (Peter).

const PARY = [
  ['Hej, pająku! Oddaj mi to miasto!', 'Przykro mi, jest na wynajem tylko dla uczciwych.', 'dry'],
  ['Nie masz z nami szans, jest nas więcej!', 'Wiem. Dlatego jestem już rozgrzany.', 'dry'],
  ['Zobaczymy, kto tu jest szybszy!', 'Zakład? Stawiam pizzę.', 'excited'],
  ['Co to ma być, jakiś kostium na Halloween?', 'Nie, na całoroczne przedsięwzięcie.', 'dry'],
  ['Stój! Gdzie ci się tak spieszy?', 'Do pracy. Dwie ulice stąd.', 'normal'],
  ['Szef nas zabije, jeśli cię wypuścimy!', 'Szef was zabije i tak. Mogę pomóc to opóźnić.', 'dry'],
  ['Tym razem cię dorwiemy!', 'Mówisz tak każdego wieczoru. Zaczynam się przyzwyczajać.', 'dry'],
  ['Zostaw nas w spokoju, przecież nic ci nie zrobiliśmy!', 'Oprócz tego, że napadliście na sklep. Drobiazg.', 'dry'],
  ['Ej, ludzie, ten typ znowu się pojawił!', 'Dzień dobry, panowie. Miło być zauważonym.', 'normal'],
  ['Mam broń, pająku! Nie podchodź!', 'Spokojnie, odłóż to, zanim zrobisz coś głupiego.', 'strained'],
  ['Zamknij się i walcz!', 'Ja mogę oba na raz. Kto lepiej?', 'excited'],
  ['Czemu nas ciągle gonisz?', 'Bo wy ciągle uciekacie. Sami wiecie, jak to wygląda.', 'normal'],
  ['Zaraz przywołamy posiłki!', 'Świetnie, to wreszcie będzie jakaś zabawa.', 'excited'],
  ['Nie wejdziesz tu, ta ulica jest nasza!', 'Dziękuję za gościnę, nie zostaję długo.', 'dry'],
  ['Kim ty właściwie jesteś pod tą maską?', 'Przyjacielem z sąsiedztwa. Bardzo upartym.', 'normal'],
  ['Ruszaj się, bo cię złapiemy!', 'Wolę, żebyś ty ruszył się z tej ulicy.', 'dry'],
  ['Co on robi na tej ścianie?!', 'Wiszę. To moja specjalność.', 'dry'],
  ['Zabierz tę swoją pajęczynę!', 'Sorry, to dostawa bez prawa zwrotu.', 'dry'],
];

export const LINIE = [];
export const RODZAJE = {};
PARY.forEach(([a, b, mood], i) => {
  const nn = String(i + 1).padStart(2, '0'), kind = 'dialog_' + nn;
  LINIE.push({ id: 'dlg_' + nn + '_a', kind, text: a, voice: 'thug', mood: 'normal' });
  LINIE.push({ id: 'dlg_' + nn + '_b', kind, text: b, voice: 'peter', mood });
  RODZAJE[kind] = { p: 0.35, cd: 45, prio: 1, opis: 'dialog z wrogiem (para: wrog, Peter)' };
});
