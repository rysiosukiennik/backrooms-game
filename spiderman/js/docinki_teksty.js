// STUB katalogu linii (zastapi go wersja agenta SCENARZYSTA). Format: LINIE = [{ id, kind, text, voice, mood }],
// RODZAJE (opcjonalnie) = { kind: { p: szansa, cd: odpoczynek w s, prio: 0..3 } } — nadpisuje domyslne ustawienia rezysera.
const Q = {
  hit: ['Zostaw to, wyglądasz na zmęczonego.', 'Bez urazy, to tylko przyjacielska pięść!', 'Przepraszam, że przerywam napad.', 'Auć, to musiało boleć. Mnie też. Trochę.', 'Dasz radę wstać? Bo zaraz powtórka.', 'Ej, ja tu tylko przechodziłem!'],
  finisher: ['I po zawodach!', 'Zapakowany na prezent!', 'Efektowne, prawda? Nie klaszcz, nie trzeba.', 'Teraz możesz sobie odpocząć w sieci.', 'Dobranoc, panie bandyto!'],
  web: ['Sieć pająka — lepsza niż kajdanki!', 'Zostań tu, zaraz wracam!', 'Mam ich całą kolekcję. Sieci, nie bandytów.'],
  combo: ['Rozgrzewka zaliczona!', 'Czuję się dziś w formie!', 'Ktoś tu zasłużył na ocenę dziesięć!'],
  swing: ['Uwielbiam to bujanie!', 'Tarzan mógłby się czegoś nauczyć.', 'Wiatr we włosach... gdyby nie maska.', 'Piękne miasto. Szkoda, że nie da się go zaparkować.', 'Kto potrzebuje metra?'],
  hero: ['Lądowanie na dziesiątkę! No, może na ósemkę.', 'Tak miało być. Zaplanowałem to.', 'Nic się nie stało! Naprawdę!'],
  hurt: ['Au! To miało być na niby!', 'Ej! Mam kruchy kręgosłup... teoretycznie.', 'To bolało bardziej niż kolejka do kasy.', 'Dobra, teraz już się zdenerwowałem.'],
  lowhp: ['Dobra, może jednak trzeba było zostać w łóżku.', 'Czy ktoś ma jeszcze colę?', 'Jeszcze tylko chwilkę... wytrzymać.'],
  cola: ['Zimna cola — najlepsza broń w arsenale!', 'Cola za darmo? Kocham to miasto!', 'To się nazywa pełne zdrowie. Dzięki, szefie!'],
  room: ['Dzień dobry, tylko oglądam!', 'Spokojnie, niczego nie będę łapał... sieciami.', 'Czy tu można zaparkować sieć?', 'Przepraszam za najście. Jestem z sąsiedztwa.'],
  crime: ['Kolejny dzień, kolejny złodziej.', 'Nie dziękuj, to moja praca. Niezapłacona.', 'Wszystko pod kontrolą. Mniej więcej.', 'Przyjazny pająk z sąsiedztwa na posterunku!'],
  carstop: ['Dzięki, że się zatrzymałeś! Zazwyczaj tylko mnie trąbią.', 'Nowy Jork i kierowcy, którzy hamują? Cud!', 'Spokojnie, panie taksówkarzu, nie rzucam się pod koła. Dziś.', 'Miło, że ktoś tu przestrzega przepisów.'],
  rhino: ['Rogaty kolega! Ktoś tu potrzebuje urlopu.', 'Nosorożec? Dawno nie widziałem takiej góry mięśni.', 'Spokojnie, wielkoludzie, rozmawiajmy jak cywilizowani... no dobra, nie.'],
  fisk: ['Panie Fisk, ładna wieża. Szkoda byłoby jej nie zburzyć.', 'Kingpin? Wolałem pana, kiedy pan jadł obiad.', 'Niezła laska. Szkoda, że tylko do chodzenia.'],
  idle: ['Wiesz, że nic nie robię? To też praca.', 'Czy ktoś widział moją kawę?', 'Tak sobie myślę... może zmienić kostium na żółty?', 'To miasto nigdy nie śpi. Ja też nie. Niestety.'],
  perch: ['Z tej wysokości wszystko wygląda lepiej.', 'Chwila oddechu... i znowu do roboty.', 'Ładny widok, prawda?'],
  sunset: ['Złota godzina nad Nowym Jorkiem. Można się zakochać.', 'Taki zachód słońca i jeszcze mam pracę. Życie jest piękne.'],
  night: ['Noc w mieście. Idealny czas na kłopoty.', 'Światła, kamera... pająk!'],
  day: ['Piękny dzień na ratowanie miasta.', 'Słońce świeci, ptaki śpiewają, a ja bujam się na sieci.'],
};
export const LINIE = [];
for (const k in Q) Q[k].forEach((text, i) => LINIE.push({ id: k + '_' + String(i + 1).padStart(2, '0'), kind: k, text, voice: 'peter', mood: k === 'hurt' || k === 'lowhp' ? 'strained' : 'normal' }));
export const RODZAJE = {};
