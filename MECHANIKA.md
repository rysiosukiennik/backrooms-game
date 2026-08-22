# NAREW — jak ta gra działa

Opis całej mechaniki gry z pliku `narew.html`. Stan na 22 sierpnia 2026.

Gra to **jeden plik HTML**. Nie ma serwera, nie ma logowania, nie ma konta, nie ma
zapisu w chmurze — otwierasz plik i grasz. Jedyne, co gra trzyma poza sobą, to kilka
drobiazgów w pamięci przeglądarki (wykopy, własne linki na półce prywatnej) i siedem
zdjęć tkanin w folderze `tekstury/`.

---

## 1. Co to jest

Trójwymiarowy spacer po **jednej prawdziwej działce w Gzowie nad Narwią**. Na działce
stoi przeszklony kloc (dom), za nim wzgórze z ogródkiem, obok wiata z maszynami, dalej
łąka, mur dookoła, a poniżej dolina i rzeka. Teren nie jest wymyślony: wysokości
pochodzą z modelu terenu (Copernicus DEM), a koryto Narwi, starorzecze i rowy
melioracyjne to linie przerysowane z OpenStreetMap i wcięte w teren.

Interfejs jest po polsku.

---

## 2. Świat

### 2.1 Rozmiary

| Rzecz | Wartość |
|---|---|
| Kloc (dom) | 56 × 56 m, wysokość 6,2 m, w środku pusty |
| Posesja | 1000 × 1000 m (mur 500 m od kloca w każdą stronę) |
| Brama | we wschodniej ścianie muru, szerokość 14 m |
| Wzgórze | promień 175 m, wysokość 42 m, płaski szczyt z ogródkiem (płotek o promieniu 26 m) |
| Siatka terenu | 2400 m, 400 oczek — czyli 6 m na oczko |
| Drobna siatka pod kopanie | 1 m na oczko, ±120 m od kloca |
| Lustro wody | 22,6 m poniżej poziomu posesji |
| Narew | ~80 m szerokości, koryto wcięte 4,2 m |

### 2.2 Wysokość terenu

Wysokość dowolnego punktu to suma czterech rzeczy:

1. **teren z danych** — dwuwymiarowa interpolacja z siatki 25 × 25 prawdziwych wysokości,
   spłaszczona do zera w promieniu 120 m od kloca (działka jest równa, jak w naturze),
2. **wzgórze** — dokładany garb za klocem,
3. **wykopy i kopce** — wszystko, co wykopano łopatą i koparką,
4. **wcięcie wody** — koryto Narwi, starorzecze i rowy, wycinane wzdłuż linii z mapy.

Woda nie jest osobnym „basenem": jest jedną płaszczyzną na wysokości −22,6 m, a to,
gdzie ta płaszczyzna wystaje ponad teren, jest rzeką. Dlatego wszystko w grze pyta nie
„czy tu jest rzeka", tylko **„jak głęboka jest tu woda"** — płot, trawa, kajaki, skuter,
dziki i Jan sprawdzają dokładnie tę jedną liczbę.

### 2.3 Niebo, słońce i pora dnia

Słońce liczone jest z astronomii dla współrzędnych Gzowa (52,61 N / 21,11 E): deklinacja
z dnia roku, kąt godzinny z zegara komputera, plus poprawka na długość geograficzną.
Świta i zmierzcha się **wtedy, kiedy naprawdę**. Od położenia słońca zależy barwa i moc
światła, mgła, ekspozycja, kolor nieba i to, czy w Tesli zapalają się światła.

W nocy główne światło przejmuje księżyc — świeci z przeciwnej strony nieba, chłodno
i słabo, ale nadal rzuca cienie. Bez tego świat po zmroku byłby czarną płachtą.

Przeliczenie robi się co dwie sekundy, bo słońce nie rusza się szybciej.

### 2.4 Pogoda

Telewizor pobiera prawdziwą pogodę dla Gzowa (temperatura, wiatr, zachmurzenie,
wilgotność) i wypisuje ją na ekranie startowym. Jeśli internet nie odpowie, ekran pokazuje
stan „ładowanie" i nic się nie psuje.

### 2.5 Wiatr

Trawa i korony drzew gną się na wietrze. Nie jest to osobny system — do materiałów, które
już istnieją, dopisywany jest kawałek programu cieniującego. Wychylenie liczone jest od
podstawy (trawa gnie się u ziemi, nie w powietrzu), a faza brana jest z położenia w świecie,
więc nic nie kołysze się równo z resztą.

---

## 3. Sterowanie

### Chodzenie
| Klawisz | Co robi |
|---|---|
| WASD | ruch |
| mysz albo strzałki | rozglądanie |
| SHIFT | sprint (zjada wytrzymałość, pasek u dołu) |
| SPACJA | skok |
| 2× SPACJA | latanie: SPACJA w górę, CTRL w dół |
| O / I | kamera zza pleców / z oczu |
| M | mapa |

### Na posesji
| Klawisz | Co robi |
|---|---|
| P | rozsuwa szklaną ścianę kloca |
| E | podnosi butelkę, wsiada do pojazdów, rozpala ognisko, siada na kanapie, otwiera klawiaturę kodu |
| Q | nabiera wody z Narwi do butelki |
| G | pije |
| F | sen w łóżku |
| T | teleport ze świecącej płyty |
| X | głaskanie wiewiórki |
| R | Jan Sukiennik wystrzeliwuje cię w powietrze |
| K | kopie łopatą |
| SHIFT+K ×2 | zasypuje wszystkie doły |

### Telewizor
| Klawisz | Co robi |
|---|---|
| N | NAREWFLIX |
| Y | NAREWKA |
| J | NAREWIFY |
| B | NAREBLOX |
| 1–9, 0, − | wybór gry |
| R | gra od nowa |
| ESC | wyjście |

Wszystko to wisi też **na tablicy w klocu**, na tylnej ścianie — w menu startowym nie ma
ściany komunikatów, bo instrukcje mają być w świecie, nie przed nim.

---

## 4. Gracz

| Parametr | Wartość |
|---|---|
| Wysokość oczu | 1,7 m (przy pływaniu 1,6 m) |
| Promień kolizji | 0,5 m |
| Chód | 4,2 m/s |
| Sprint | 7,4 m/s |
| Pływanie | 2,4 m/s |
| Wytrzymałość | 100, ubywa 22/s przy sprincie, wraca 15/s |
| Grawitacja | 16 m/s² |
| Siła skoku | 5,6 m/s |
| Latanie | 12 m/s, z SHIFT 26 m/s |

Pływanie włącza się samo, gdy woda ma ponad 1,5 m — ciało unosi się 1,25 m pod lustrem,
głowa 0,35 m nad nim. W płytkiej wodzie brnie się wolniej (55% prędkości). Postać to
model ze szkieletem z trzema klipami (stanie, chód, bieg), mieszanymi płynnie, z tempem
dopasowanym do prędkości; przy cofaniu klip leci wstecz, żeby stopy nie sunęły po ziemi.

Kolizje: kloc, mur (poza bramą), słupy wiaty, płotek ogródka, drzewa i pojazdy. Reszta
świata jest przechodnia.

---

## 5. Kloc — co jest w środku

- **Telewizor** — ekran 6,4 × 3,7 m na tylnej ścianie (opisany osobno niżej).
- **Kanapa** naprzeciwko telewizora, 3,4 × 1,5 m, poducha na 48 cm, obita lnem.
- **Mokry Jan Sukiennik** siedzi na niej w kąpielówkach, z telefonem w dłoni.
  Ocieka wodą — dziewięć kropel spływa mu z ramion i kolan, każda w swoim rytmie.
- **Łóżko** — wchodzisz na nie, F usypia, ekran gaśnie i budzisz się rano.
- **Butelka** na podłodze; po zabraniu po sześciu sekundach pojawia się nowa.
- **Płyta teleportu** — świecący krążek; T przenosi na bliźniaczą płytę nad Narwią i z powrotem.
- **Tablica ze sterowaniem** na tylnej ścianie, 8,8 × 5,5 m.
- **Klawiatura kodu** na zewnętrznej ścianie przy drzwiach.
- **Tancerz** — postać, która tańczy obok, nieprzerwanie.

### Kanapa i telefon

Siadasz [E]. Kamera schodzi na wysokość siedzącego (oczy 1,36 m nad podłogą), a widok
przechodzi **do ekranu telefonu**: pionowa aplikacja z rolkami. Nie ma tam nic poza
**filmikami Edwarda Warchockiego** — osiem sztuk, każdy rysowany klatka po klatce
(zryta łąka, Waldek konno, tańczące szopy, skuter robiący fale, koparka, wiewiórka,
łopata, świt nad Narwią). W/S przewija do następnej rolki, jak kciukiem. Konta nie ma,
zalogować się nie da, dodać swojego filmiku też nie — to jest konto Edwarda.

Wstajesz [E] i wracasz tam, gdzie stałeś.

---

## 6. Telewizor

Ekran to **rysowane płótno**, przemalowywane w miejscu. Ma kilka trybów:

### NAREW TV (start)
Pogoda dla Gzowa na żywo, zegar, data, pora roku i rząd ikon aplikacji.

### NAREWFLIX
Katalog sześciu filmów, **rysowanych klatka po klatce** — zachód nad Narwią, wiewiórki,
burza nad Gzowem, zima w dolinie, nocne niebo, mgła nad łąkami. To nie są pliki wideo,
tylko animacje w kodzie.

### NAREWKA
Półka z linkami do YouTube. Filmy odtwarzają się w prawdziwym oknie osadzonym
w miejscu ekranu (płótno na moment ustępuje). Lista jest przewijana, więc mieści się
w niej więcej niż jeden ekran pozycji.

Osobno jest **półka PRYWATNE**, zamykana dwucyfrowym hasłem. Linki dodane po hasłem
zapisują się w pamięci przeglądarki i nie mieszają się z resztą.

### NAREWIFY
Muzyka z tej samej półki, z paskiem postępu utworu i przyciskiem „＋ DODAJ LINK"
w prawym dolnym rogu.

### NAREBLOX — jedenaście gier

| # | Gra | Rodzaj |
|---|---|---|
| 1 | OBBY NAD NARWIĄ | tor przeszkód |
| 2 | WIEŻA PIEKIEŁ | wspinaczka na czas |
| 3 | KATASTROFA | przetrwanie żywiołów |
| 4 | TAJKUN PIZZERII | buduj i zarabiaj |
| 5 | NAPAD NA BANK | ucieczka przed policją |
| 6 | ŚWINKA | klucze i ucieczka |
| 7 | DRZWI | hotel i potwór |
| 8 | MORDERCA | kto z nich zabija |
| 9 | OWOCE MOCY | walka i poziomy |
| 10 | SZPITAL ZWIERZĄT | **3D** — wpuszczaj, lecz, wypatruj anomalii |
| 11 | MINI WAR | **3D** — buduj kraj i zdobywaj |

Dziewięć pierwszych rysowanych jest na tym samym płótnie co reszta telewizora.
**Dwie ostatnie nie są rysowane wcale** — to osobne sceny trójwymiarowe, z własną kamerą
i światłem, renderowane do tekstury, którą ekran następnie pokazuje. Telewizor wyświetla
prawdziwe 3D z wnętrza 3D, tymi samymi materiałami i tym samym modelem postaci co świat gry.

**Wszystkie jedenaście działa we dwoje.** W dziewięciu rysowanych widzisz ducha drugiego
gracza — jego pozycję na planszy. W dwóch trójwymiarowych gospodarz prowadzi rozgrywkę,
a gość wysyła prośby o akcje (przyjęcie pacjenta, postawienie budynku) i dostaje z powrotem
migawkę stanu.

---

## 7. Woda

### Kajaki
Trzy sztuki na brzegu. W/S wiosłuje, A/D skręca. Prędkość maksymalna 11,5 m/s, wstecz 4 m/s.
**Kadłub nie wypłynie z wody płytszej niż 30 cm** — rzeka trzyma cię w korycie.

### Skuter wodny
Zacumowany na nurcie. Znacznie szybszy: 26 m/s. Za rufą co 0,16 sekundy zostawia
**krąg fali**, tym wyższy, im szybciej płyniesz.

### Fale
Fale to nie ozdoba. Każdy krąg rośnie w promieniu i gaśnie po 3,4 sekundy, a wysokość
lustra w danym punkcie liczona jest z sumy wszystkich kręgów, które akurat przez ten punkt
przechodzą. Z tej wysokości korzystają **kajaki i sam skuter**: podnoszą się i kołyszą, gdy
dojdzie do nich kilwater. Suma jest ograniczona do 62 cm, bo przy zawracaniu w kółko
kręgi nakładały się kilkanaście razy i kajak jechał w górę jak winda.

W grze sieciowej fale lecą do wszystkich — u każdego podnoszą te same kajaki.

### Jan Sukiennik w Narwi
Stoi po pas w wodzie, ma tabliczkę z imieniem. Podchodzisz, wciskasz R, on bierze zamach,
leci odliczanie i **wystrzeliwuje cię w górę z prędkością 270 m/s** — szczyt lotu wypada
około 2,3 km, wyraźnie ponad pokrywą chmur. Woda po drodze lotu nie przechwytuje.

Obok, na brzegu, stoi druga płyta teleportu.

---

## 8. Kopanie

Ziemi naprawdę ubywa.

| Parametr | Wartość |
|---|---|
| Zasięg kopania | ±120 m od kloca |
| Oczko drobnej siatki | 1 m (58 081 wierzchołków) |
| Największy dół | 4,5 m w głąb |
| Największy kopiec | 2,5 m |

Każdy dół to zapis „środek, promień, głębokość". Profil ma **płaskie dno**: pełną głębokość
ma całe wnętrze do 55% promienia, dalej ściana wychodzi łagodnie do krawędzi. Dzięki temu
**do dołu da się wejść i w nim stanąć** — w lejku pełną głębokość miał tylko jeden punkt
pośrodku i noga zawsze wypychała cię na skarpę.

Po każdej zmianie przeliczane są tylko wierzchołki wokół niej, nie cała siatka. Świeży
wykop dostaje barwę gołej ziemi (przez kolory wierzchołków), a trawa przesiewana jest
tylko przy zupełnie nowym dole — inaczej całe pole przeskakiwałoby w oczach przy każdej
łyżce.

### Czym się kopie

**Koparka** stoi przy wiacie. W/S jazda, A/D skręt, ←→ obrót kabiny, ↑↓ wysięgnik,
Q/Z ramię, SPACJA nabiera łyżką albo wysypuje urobek. Zęby muszą być w ziemi — inaczej
maszyna powie ci, żebyś opuścił łyżkę.

**Łopata** stoi oparta o słup wiaty. E bierze ją do ręki, K kopie: płycej i węziej niż
koparka (24 cm na raz, promień metr), ale wszędzie tam, gdzie stoisz.

### Co się dzieje z wykopami

- **Zostają po zamknięciu karty** — lista dołów siedzi w pamięci przeglądarki i wraca
  przy wejściu do świata, z komunikatem, ile ich odzyskano.
- **Są wspólne w grze we dwoje** — każda łyżka leci do pozostałych graczy, gospodarz
  przekazuje ją dalej, a kto dołącza w trakcie, dostaje całą listę dołów w paczce startowej.
  Bez tego jeden gracz stał w dole, którego drugi u siebie nie miał.
- **SHIFT+K dwa razy pod rząd** wyrównuje teren, gdyby ktoś przesadził.

---

## 9. Pojazdy lądowe

### Tesla
Elektryczny sedan na podjeździe między klocem a bramą. E wsiadka, W/S gaz i hamulec,
A/D kierownica.

- rozpędza się do **64 km/h w pięć sekund**, maksymalnie ~108 km/h,
- **skręt zależy od prędkości** — stojąc w miejscu kierownica nic nie daje, bo koła nie
  mają się o co oprzeć,
- przednie koła naprawdę się wykręcają, wszystkie kręcą się proporcjonalnie do
  przejechanej drogi,
- nadwozie kiwa się przy gazie i hamowaniu,
- tylna listwa czerwienieje przy hamowaniu, światła zapalają się same o zmroku,
- **do wody nie wjedzie** i odbija się od muru i kloca zamiast przez nie przenikać.

### Koparka
Opisana wyżej, przy kopaniu. Jeździ wolno (4,2 m/s) i też nie wjedzie do wody.

---

## 10. Ludzie i zwierzęta

### Edward Warchocki
Chodzi w kółko po posesji ośmiopunktową trasą poprowadzoną **poza obrysem kloca, wiaty,
koparki i kręgu przy ognisku**. Ma kapelusz z sukna, siwą brodę, laskę i tabliczkę
z imieniem. Kiedy staniesz bliżej niż 4,6 m, zatrzymuje się, obraca do ciebie, kołysze się
w powitaniu i mówi swoje — cztery kwestie na zmianę, nie częściej niż co jedenaście sekund.

### Waldek na koniu
Nie ma go w świecie, dopóki nie wpiszesz kodu. Na ścianie kloca, przy drzwiach, wisi
**klawiatura na dwie cyfry**. E ją budzi, cyfry sprawdzają się same po drugiej, zły kod
miga na czerwono i się kasuje. Poprawny kod to **00**.

Po nim zza łąki nadjeżdża Waldek: koń z czterema chodzącymi nogami, jeździec w kaszkiecie
i wiejskiej kamizeli, z papierosem w kąciku ust, którego żar raz jaśnieje, raz przygasa.
Zatrzymuje się przed klocem i zostaje.

### Ciszewscy
Po **czterech minutach gry** bramą wjeżdża ciemne kombi, przejeżdża przez posesję,
parkuje przed klocem, po chwili wysiada z niego **czworo ludzi** i idą na plac przed dom.
Tam zostają. Pierwszy z nich ma tabliczkę „CISZEWSCY".

### Dziki
Wataha **dziesięciu sztuk** na łące na północny zachód: sześć dorosłych z kłami i cztery
pasiaste warchlaki. Chodzą własnymi drogami po dwudziestu paru metrach łąki, między
marszami ryją ryjem w ziemi, a kiedy podejdziesz bliżej niż siedem metrów, **cała wataha
zrywa się i ucieka** w przeciwną stronę, szybciej, niż idziesz. Sierść jest celowo dwa tony
ciemniejsza, niż wygląda w kodzie — w pełnym słońcu jaśniejsza dawała siwe świnie.

### Szopy pracze
Pięć sztuk tańczy w kręgu wokół ogniska: krążą, podskakują, machają łapami na przemian,
ogony zamiatają, głowy kiwają się na boki. **Przy rozpalonym ogniu** tańczą dwa razy
szybciej i podskakują z siedmiu centymetrów na siedemnaście.

### Wiewiórki
Szesnaście sztuk siedzi na pniach **nisko, w zasięgu ręki**. X głaszcze najbliższą: skacze
wtedy i macha ogonem, a licznik pogłaskanych rośnie. Nie rzucają cienia — szesnaście
wiewiórek to 176 drobiazgów, a każdy wchodziłby osobno do mapy cieni i kosztował 6 ms
na klatkę, przy cieniu, którego i tak nie widać.

### Ptaki
Latają nad doliną, część kluczem, machając skrzydłami.

---

## 11. Rzeczy na posesji

- **Wiata** — 16 × 11 m, blacha na dachu z prawdziwych żeber geometrii (nie z tekstury:
  pofalowanie mieszka w mapie normalnych, której nie ma w folderze, a płaska mapa koloru
  czytała się jak tafla szkła). Pod nią betonowa posadzka, na której nie rośnie trawa.
- **Ognisko** — krąg z jedenastu kamieni, pięć polan w stożek. E rozpala i gasi. Płomienie
  to cztery świecące stożki, każdy w innym rytmie, więc ogień nigdy nie wygląda dwa razy
  tak samo. Migające światło po zmroku oświetla plac, a co jakiś czas strzela iskrami.
- **Butelka** — z etykietą i małym znaczkiem kaucji. Nabierasz z Narwi [Q], pijesz [G].
- **Mur** — z bramą we wschodniej ścianie. Tam, gdzie linia muru wchodzi w wodę, muru nie
  ma, tak jak w terenie.
- **Drogi** — asfaltowe i polne wstęgi po liniach z OpenStreetMap, układane po
  nierównościach terenu i omijające posesję, wodę i wzgórze.
- **Las** — 350 drzew wysypanych w obrysy lasów z mapy.
- **Trawa** — 3000 kęp w promieniu 46 m od gracza, przesiewanych przy ruchu; nie rośnie
  na betonie, w wykopach ani pod wiatą.
- **Minimapa** w lewym dolnym rogu, z korytem rzeki, drogami, bramą i drzewami.
- **Nazwa miejsca** w prawym dolnym rogu — zmienia się, kiedy przechodzisz z posesji na
  łąkę, na wzgórze, nad rzekę.

---

## 12. Sekret: wyjście do BACKROOMS

Trzy razy z rzędu daj się wystrzelić Janowi [R].

Po **trzecim** locie nie ma zwykłego lądowania: gdy dotkniesz ziemi, ekran gaśnie z napisem
„ŚCIANY SIĘ ZMIENIAJĄ…" i po dwóch i pół sekundy gra przechodzi do `backrooms.html` —
drugiej gry z tego samego katalogu.

Liczy się **wylądowanie na ziemi**. Jeśli spadniesz do Narwi, przejście się nie odpala,
bo woda cię łapie.

---

## 13. Gra we dwoje

Połączenie jest **bezpośrednie, między przeglądarkami** (peer to peer). Jeden gracz zakłada
pokój i dostaje czteroznakowy kod, drugi ten kod wpisuje. Nie ma konta, nie ma rejestracji,
nie ma serwera gry — kod działa tylko póki pokój jest otwarty.

Gospodarz prowadzi świat: dziesięć razy na sekundę rozsyła pozycje wszystkich graczy,
a goście odsyłają swoją. Poza pozycjami przez łącze lecą:

- **kręgi fal** ze skutera,
- **wykopy** (każda łyżka, plus cała lista przy dołączeniu),
- **duchy** graczy w dziewięciu rysowanych grach na telewizorze,
- **migawki** dwóch gier trójwymiarowych i prośby gości o akcje w nich.

Kiedy gospodarz zniknie, gość dostaje komunikat i gra dalej sam.

---

## 14. Grafika i wydajność

- **Zdjęcia zamiast rysunków.** Trawa, kora, liście, beton, deski, blacha, tkanina, len,
  sukno i skóra to zdjęcia materiałów z bibliotek na wolnej licencji (CC0), przeskalowane
  do 512 pikseli. Cały komplet waży niecałe pół megabajta.
- **Zapas na wypadek braku folderu.** Każdy materiał startuje od tekstury **rysowanej
  w kodzie** i podmienia ją dopiero wtedy, gdy zdjęcie się wczyta. Jeśli folder `tekstury/`
  zniknie, świat nie zrobi się czarny — wróci do wersji rysowanej.
- **Trawa jako jedna siatka.** Trzy tysiące kęp to jeden obiekt z trzema tysiącami kopii,
  nie trzy tysiące obiektów.
- **Dwie siatki terenu.** Gruba (6 m na oczko) na cały świat i drobna (1 m) tylko tam, gdzie
  wolno kopać. Gruba jest pod drobną wciśnięta 55 cm w dół, z wyrównaniem przy krawędzi,
  żeby dwie powierzchnie nie migotały jedna przez drugą.
- **Cienie tylko z dużych rzeczy.** Oczy, brwi, sznurówki i wiewiórki do mapy cieni nie wchodzą.
- **Przeliczanie tylko tam, gdzie trzeba** — słońce co dwie sekundy, teren tylko wokół
  świeżego wykopu, trawa tylko przy ruchu gracza.

---

## 15. Pliki

```
narew.html        cała gra — świat, telewizor, gry, sieć
backrooms.html    druga gra, do której prowadzi sekret z trzema wystrzałami
index.html        to samo co backrooms.html
ev.html           osobny projekt
tekstury/         dziesięć zdjęć materiałów, CC0, po 512 px
MECHANIKA.md      ten plik
```

## 16. Jak to uruchomić

Otworzyć `narew.html` w przeglądarce. Nic więcej nie trzeba: żadnej instalacji, żadnego
serwera, żadnego konta, żadnych kluczy. Do gry we dwoje wystarczy, że obaj macie internet
i jeden poda drugiemu czteroznakowy kod pokoju.
