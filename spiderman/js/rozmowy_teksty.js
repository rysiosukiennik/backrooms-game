// Katalog linii rozmow i scenek (mowa) + definicje rozmow telefonicznych / komunikatow radiowych.
// Format linii jak w docinki_teksty.js: { id, kind, text, voice, mood }.
// voice: 'peter' | 'may' | 'mj' | 'yuri' | 'fisk' | 'rhino' | 'thug' | 'radio'
// Plik jest czystymi danymi (bez importow), zeby generator audio mogl go zaladowac w Node.
// ROZMOWY[id] = { kto (rozmowca w panelu), warunek(ctx) -> bool, kroki: [{ id_linii, pauza_ms }], powtarzalna?, cd? }
// ctx = { save, G, P, t (sekundy gry), crime (dystans do najblizszego aktywnego przestepstwa lub 9999), bags, crimes, lvl }

export const LINIE = [
  // ---------------------------------------------------------------- scenki
  { id: 'cine_intro_01', kind: 'cine', text: 'Nowy Jork. Osiem milionów ludzi, zero miejsc parkingowych.', voice: 'peter', mood: 'dry' },
  { id: 'cine_intro_02', kind: 'cine', text: 'Zwykły dzień. Ktoś właśnie szykuje coś głupiego.', voice: 'peter', mood: 'dry' },
  { id: 'cine_intro_03', kind: 'cine', text: 'Ktoś musi tu pilnować. Zawsze wychodzi na mnie.', voice: 'peter', mood: 'normal' },

  { id: 'cine_boss_01', kind: 'cine', text: 'Spider-Man! Ten park jest mój, a ty tu jesteś szkodnikiem!', voice: 'rhino', mood: 'excited' },
  { id: 'cine_boss_02', kind: 'cine', text: 'Rogaty kolego, może pogadamy? Nie? Dobra, tak też może być.', voice: 'peter', mood: 'dry' },
  { id: 'cine_bossend_01', kind: 'cine', text: 'Gotowy do transportu. Tylko ktoś musi naprawić ogrodzenie. I połowę parku.', voice: 'peter', mood: 'dry' },
  { id: 'cine_bossend_02', kind: 'cine', text: 'Spider-Man, tu Watanabe. Odbieramy go z parku. Dobra robota.', voice: 'yuri', mood: 'normal' },

  { id: 'cine_fisk_01', kind: 'cine', text: 'Drzwi są zamknięte, panie Parker. Nikt nam nie przeszkodzi.', voice: 'fisk', mood: 'dry' },
  { id: 'cine_fisk_02', kind: 'cine', text: 'Nie powinieneś tu wchodzić, pająku.', voice: 'fisk', mood: 'normal' },
  { id: 'cine_fisk_03', kind: 'cine', text: 'Ładny gabinet. Zawsze chciałem coś w tym stylu. Z wyjątkiem kolekcji nielegalnych rzeczy.', voice: 'peter', mood: 'dry' },
  { id: 'cine_fisk2_01', kind: 'cine', text: 'Skoro nalegasz… Straże to dopiero rozgrzewka.', voice: 'fisk', mood: 'normal' },
  { id: 'cine_fisk2_02', kind: 'cine', text: 'Bądź gotów. Ja jestem zawsze.', voice: 'fisk', mood: 'dry' },
  // Fisk Tower, poziom 5 (gabinet za szyba pancerna) i upadek z wiezy
  { id: 'fisk5_01', kind: 'fisk_cutscene', text: 'Piszesz notatnik? Nie zapomnij o dywizie między Spider a Man.', voice: 'peter', mood: 'dry' },
  { id: 'fisk5_02', kind: 'fisk_cutscene', text: 'Odpalcie śmigłowiec. Zaraz przyjdę.', voice: 'fisk', mood: 'normal' },
  { id: 'fisk5_03', kind: 'fisk_cutscene', text: 'Wiesz, że doskonale cię widzę.', voice: 'peter', mood: 'dry' },
  { id: 'fisk5_04', kind: 'fisk_cutscene', text: 'Osiem lat użerania się z nim.', voice: 'fisk', mood: 'dry' },
  { id: 'fisk5_05', kind: 'fisk_cutscene', text: 'Jak to możliwe?', voice: 'fisk', mood: 'excited' },
  { id: 'fisk5_06', kind: 'fisk_cutscene', text: 'Co się stało? Wydajesz się zdenerwowany.', voice: 'peter', mood: 'dry' },
  { id: 'fisk5_07', kind: 'fisk_cutscene', text: 'Zniszczę cię!', voice: 'fisk', mood: 'excited' },

  { id: 'cine_fiskend_01', kind: 'cine', text: 'Pański interes właśnie się skończył, panie Fisk.', voice: 'peter', mood: 'normal' },
  { id: 'cine_fiskend_02', kind: 'cine', text: 'Wszystkie jednostki, Kingpin zatrzymany. Powtarzam, Kingpin zatrzymany.', voice: 'radio', mood: 'normal' },

  // ---------------------------------------------------------------- ciocia May
  { id: 'may_hello_01', kind: 'call', text: 'Peter? Tu ciocia May. Jesteś tam?', voice: 'may', mood: 'normal' },
  { id: 'may_hello_02', kind: 'call', text: 'Cześć, ciociu. Jestem… w drodze.', voice: 'peter', mood: 'strained' },
  { id: 'may_hello_03', kind: 'call', text: 'W drodze dokąd? Słyszę wiatr. Znowu jesteś na jakimś dachu?', voice: 'may', mood: 'normal' },
  { id: 'may_hello_04', kind: 'call', text: 'Na jakim dachu? To tylko słuchawka. Ona tak ma.', voice: 'peter', mood: 'strained' },
  { id: 'may_hello_05', kind: 'call', text: 'Peter. Wracaj na kolację, upiekłam zapiekankę. I proszę, uważaj na siebie.', voice: 'may', mood: 'normal' },
  { id: 'may_hello_06', kind: 'call', text: 'Obiecuję. Zjawię się. Prawie na pewno.', voice: 'peter', mood: 'normal' },

  { id: 'may_obiad_01', kind: 'call', text: 'Peter, kochanie, rosół stygnie. Wiem, że miasto cię potrzebuje, ale żołądek też.', voice: 'may', mood: 'normal' },
  { id: 'may_obiad_02', kind: 'call', text: 'Ciociu, już lecę. No, bujam się. To znaczy idę, idę.', voice: 'peter', mood: 'strained' },
  { id: 'may_obiad_03', kind: 'call', text: 'Bujasz się? Ty się z kimś bujasz? Opowiesz mi przy zupie.', voice: 'may', mood: 'normal' },
  { id: 'may_obiad_04', kind: 'call', text: 'Przy zupie opowiem wszystko. Poza prawdą.', voice: 'peter', mood: 'dry' },

  { id: 'may_zakupy_01', kind: 'call', text: 'Peter, skończyło mi się mleko i chleb. Skoczysz do sklepu, jak będziesz w okolicy?', voice: 'may', mood: 'normal' },
  { id: 'may_zakupy_02', kind: 'call', text: 'Mleko i chleb. Zapisane. Mam nawet idealną torbę. Taką z siatki.', voice: 'peter', mood: 'dry' },
  { id: 'may_zakupy_03', kind: 'call', text: 'Tylko nie kupuj najtańszego. I nie rób niczego głupiego po drodze.', voice: 'may', mood: 'normal' },
  { id: 'may_zakupy_04', kind: 'call', text: 'Ja? Nigdy. Najwyżej coś mądrego, ale z dużym hukiem.', voice: 'peter', mood: 'dry' },

  { id: 'may_plecak_01', kind: 'call', text: 'Kochanie, dzwonił pan z biura rzeczy znalezionych. Ktoś oddał twój plecak. Znowu!', voice: 'may', mood: 'normal' },
  { id: 'may_plecak_02', kind: 'call', text: 'To długa historia. Właściwie krótka. Wiatr.', voice: 'peter', mood: 'strained' },
  { id: 'may_plecak_03', kind: 'call', text: 'Wiatr zabiera ci plecaki, a ty mi nic nie mówisz. Dobrze, dobrze. Do zobaczenia.', voice: 'may', mood: 'dry' },

  // ---------------------------------------------------------------- Mary Jane
  { id: 'mj_art_01', kind: 'call', text: 'Cześć, Parker. Widziałam w wiadomościach pajęczą robotę przy ulicy. Zbieg okoliczności, że byłeś nieosiągalny?', voice: 'mj', mood: 'dry' },
  { id: 'mj_art_02', kind: 'call', text: 'Telefon mi się rozładował. Cały dzień. Bardzo pechowo.', voice: 'peter', mood: 'strained' },
  { id: 'mj_art_03', kind: 'call', text: 'Jasne. Potrzebuję cytatu do artykułu. Czy on w ogóle sypia?', voice: 'mj', mood: 'normal' },
  { id: 'mj_art_04', kind: 'call', text: 'Słyszałem, że nie. Podobno żyje na zimnej coli i uporze.', voice: 'peter', mood: 'dry' },
  { id: 'mj_art_05', kind: 'call', text: 'Wezmę to jako bez komentarza. Ale kawa jutro jest twoja.', voice: 'mj', mood: 'normal' },
  { id: 'mj_art_06', kind: 'call', text: 'Kawa, jasne. Postaram się przyjść z obiema rękami i bez sieci.', voice: 'peter', mood: 'dry' },

  { id: 'mj_10_01', kind: 'call', text: 'Parker, rozmawiasz z kobietą, która dostała wstępniak. Tytuł roboczy: bohater czy utrapienie.', voice: 'mj', mood: 'excited' },
  { id: 'mj_10_02', kind: 'call', text: 'Mam nadzieję, że bohater. Ale utrapienie też brzmi sympatycznie.', voice: 'peter', mood: 'dry' },
  { id: 'mj_10_03', kind: 'call', text: 'Jeszcze nie zdecydowałam. Zależy, czy zjesz ze mną obiad.', voice: 'mj', mood: 'normal' },
  { id: 'mj_10_04', kind: 'call', text: 'Obiad. Zawsze. Daj mi dwadzieścia minut i jeden wysoki budynek.', voice: 'peter', mood: 'normal' },

  // ---------------------------------------------------------------- Yuri Watanabe
  { id: 'yuri_pomoc_01', kind: 'call', text: 'Spider-Man, tu Watanabe. Na ulicach robi się gorąco, a moi ludzie nie wyrabiają.', voice: 'yuri', mood: 'normal' },
  { id: 'yuri_pomoc_02', kind: 'call', text: 'Słyszę. Gdzie mam być?', voice: 'peter', mood: 'normal' },
  { id: 'yuri_pomoc_03', kind: 'call', text: 'Wszędzie. Ale zacznij od miejsc, gdzie słychać strzały. Reszta jest na ciebie.', voice: 'yuri', mood: 'normal' },
  { id: 'yuri_pomoc_04', kind: 'call', text: 'Przyjąłem. Zostaw dla mnie kawę.', voice: 'peter', mood: 'dry' },

  { id: 'yuri_rhino_01', kind: 'call', text: 'Spider-Man, tu Watanabe. Park wygląda jak po tornadzie, ale nikt nie ucierpiał. Dobra robota.', voice: 'yuri', mood: 'normal' },
  { id: 'yuri_rhino_02', kind: 'call', text: 'Zawsze do usług. Mogę prosić o odszkodowanie dla ogrodnika?', voice: 'peter', mood: 'dry' },
  { id: 'yuri_rhino_03', kind: 'call', text: 'Zobaczę, co się da zrobić. I uważaj. Takie typy mają szefów. Ktoś większy to wszystko organizuje.', voice: 'yuri', mood: 'normal' },
  { id: 'yuri_rhino_04', kind: 'call', text: 'Domyślam się. Sprawdzę, kto lubi wysokie wieże.', voice: 'peter', mood: 'normal' },

  // ---------------------------------------------------------------- radio policyjne
  { id: 'radio_napad_01', kind: 'radio', text: 'Wszystkie jednostki, zgłoszenie napadu w okolicy. Podejrzani uzbrojeni. Zachować ostrożność.', voice: 'radio', mood: 'normal' },
  { id: 'radio_bojka_01', kind: 'radio', text: 'Centrala do wszystkich patroli. Awantura na ulicy, kilku mężczyzn z kijami. Potrzebne wsparcie.', voice: 'radio', mood: 'normal' },
  { id: 'radio_kradziez_01', kind: 'radio', text: 'Uwaga, wszystkie jednostki. Kradzież w toku. Sprawcy w ciemnych kurtkach, możliwa broń.', voice: 'radio', mood: 'normal' },
  { id: 'radio_pajak_01', kind: 'radio', text: 'Wszystkie jednostki, świadkowie widzieli człowieka w czerwono-niebieskim kostiumie. Nie przeszkadzać.', voice: 'radio', mood: 'dry' },
  { id: 'radio_porzadek_01', kind: 'radio', text: 'Centrala, zgłoszenie podejrzanych osób w pobliżu. Kto jest najbliżej, niech sprawdzi.', voice: 'radio', mood: 'normal' },

  // ---------------------------------------------------------------- bandyci (okrzyki)
  { id: 'thug_spot_01', kind: 'thug', text: 'To Spider-Man! Uciekamy!', voice: 'thug', mood: 'excited' },
  { id: 'thug_spot_02', kind: 'thug', text: 'Cholera, pająk! Wszyscy do mnie!', voice: 'thug', mood: 'excited' },
  { id: 'thug_spot_03', kind: 'thug', text: 'Tylko nie on! Nie dzisiaj!', voice: 'thug', mood: 'strained' },
  { id: 'thug_spot_04', kind: 'thug', text: 'Ej, szefie mówił, że go tu nie będzie!', voice: 'thug', mood: 'strained' },
  { id: 'thug_spot_05', kind: 'thug', text: 'No to mamy gościa. Brać go!', voice: 'thug', mood: 'normal' },
  { id: 'thug_brute_01', kind: 'thug', text: 'Zgniotę cię jak puszkę!', voice: 'thug', mood: 'excited' },
  { id: 'thug_brute_02', kind: 'thug', text: 'Chodź tu, pająku, pogadamy na pięści!', voice: 'thug', mood: 'excited' },
];

// ---------------------------------------------------------------- rozmowy
// kolejnosc na liscie = priorytet sprawdzania. Warunki dotycza postepu zapisu i biezacego stanu gry.
const K = (...ids) => ids.map(id_linii => ({ id_linii, pauza_ms: 350 }));
const ciag = (prefix, n) => K(...Array.from({ length: n }, (_, i) => prefix + String(i + 1).padStart(2, '0')));

export const ROZMOWY = {
  may_hello: { kto: 'may', warunek: c => c.t > 25, kroki: ciag('may_hello_', 6) },
  mj_art: { kto: 'mj', warunek: c => c.crimes >= 1 && c.t > 40, kroki: ciag('mj_art_', 6) },
  may_plecak: { kto: 'may', warunek: c => c.bags >= 2, kroki: ciag('may_plecak_', 3) },
  yuri_pomoc: { kto: 'yuri', warunek: c => c.crimes >= 4, kroki: ciag('yuri_pomoc_', 4) },
  may_obiad: { kto: 'may', warunek: c => c.crimes >= 6, kroki: ciag('may_obiad_', 4) },
  yuri_rhino: { kto: 'yuri', warunek: c => c.save.bossWins >= 1, kroki: ciag('yuri_rhino_', 4) },
  may_zakupy: { kto: 'may', warunek: c => c.lvl >= 5, kroki: ciag('may_zakupy_', 4) },
  mj_10: { kto: 'mj', warunek: c => c.lvl >= 10, kroki: ciag('mj_10_', 4) },
  // komunikaty radiowe o przestepstwie w okolicy (powtarzalne, z przerwa)
  radio_napad: { kto: 'radio', warunek: c => c.crime < 260 && c.crime > 45, powtarzalna: true, cd: 150, kroki: K('radio_napad_01') },
  radio_bojka: { kto: 'radio', warunek: c => c.crime < 260 && c.crime > 45, powtarzalna: true, cd: 150, kroki: K('radio_bojka_01') },
  radio_kradziez: { kto: 'radio', warunek: c => c.crime < 260 && c.crime > 45, powtarzalna: true, cd: 150, kroki: K('radio_kradziez_01') },
  radio_pajak: { kto: 'radio', warunek: c => c.crime < 260 && c.crime > 45 && c.crimes >= 2, powtarzalna: true, cd: 150, kroki: K('radio_pajak_01') },
  radio_porzadek: { kto: 'radio', warunek: c => c.crime < 260 && c.crime > 45, powtarzalna: true, cd: 150, kroki: K('radio_porzadek_01') },
};

// nazwy rozmowcow w panelu i etykiety mowcow w napisach
export const KTO = {
  may: 'Ciocia May', mj: 'MJ', yuri: 'Yuri Watanabe', radio: 'Radio policyjne',
};
export const MOWCA = {
  peter: 'TY', may: 'CIOCIA MAY', mj: 'MJ', yuri: 'WATANABE', fisk: 'FISK', rhino: 'NOSOROŻEC', thug: 'BANDYTA', radio: 'RADIO',
};
