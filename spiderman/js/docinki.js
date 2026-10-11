// Docinki Spider-Mana: krotkie komentarze w trakcie gry (napis + glos z syntezatora mowy przegladarki, jesli ma polski glos).
// say(rodzaj) wywolujemy w miejscach zdarzen (cios, wykonczenie, obrazenia...); updateQuips(dt) w petli gry robi reszte
// (bujanie, bezczynnosc, niskie zdrowie, pora dnia na starcie). Kazdy rodzaj ma szanse i wlasny czas odpoczynku,
// a miedzy dwoma docinkami jest przerwa, wiec Spider-Man nie gada bez przerwy.
import { G, P } from './stan.js';
import { save } from './util.js';

const Q = {
  hit: { p: 0.1, cd: 12, l: ['Zostaw to, wyglądasz na zmęczonego.', 'Bez urazy, to tylko przyjacielska pięść!', 'Przepraszam, że przerywam napad.', 'Auć, to musiało boleć. Mnie też. Trochę.', 'Dasz radę wstać? Bo zaraz powtórka.', 'Ej, ja tu tylko przechodziłem!'] },
  finisher: { p: 0.55, cd: 8, l: ['I po zawodach!', 'Zapakowany na prezent!', 'Efektowne, prawda? Nie klaszcz, nie trzeba.', 'Teraz możesz sobie odpocząć w sieci.', 'Dobranoc, panie bandyto!'] },
  web: { p: 0.08, cd: 14, l: ['Sieć pająka — lepsza niż kajdanki!', 'Zostań tu, zaraz wracam!', 'Mam ich całą kolekcję. Sieci, nie bandytów.'] },
  combo: { p: 0.6, cd: 25, l: ['Rozgrzewka zaliczona!', 'Czuję się dziś w formie!', 'Ktoś tu zasłużył na ocenę dziesięć!'] },
  swing: { p: 0.07, cd: 30, l: ['Uwielbiam to bujanie!', 'Tarzan mógłby się czegoś nauczyć.', 'Wiatr we włosach... gdyby nie maska.', 'Piękne miasto. Szkoda, że nie da się go zaparkować.', 'Kto potrzebuje metra?'] },
  hero: { p: 0.5, cd: 20, l: ['Lądowanie na dziesiątkę! No, może na ósemkę.', 'Tak miało być. Zaplanowałem to.', 'Nic się nie stało! Naprawdę!'] },
  hurt: { p: 0.18, cd: 10, l: ['Au! To miało być na niby!', 'Ej! Mam kruchy kręgosłup... teoretycznie.', 'To bolało bardziej niż kolejka do kasy.', 'Dobra, teraz już się zdenerwowałem.'] },
  lowhp: { p: 0.9, cd: 40, l: ['Dobra, może jednak trzeba było zostać w łóżku.', 'Czy ktoś ma jeszcze colę?', 'Jeszcze tylko chwilkę... wytrzymać.'] },
  cola: { p: 1, cd: 5, l: ['Zimna cola — najlepsza broń w arsenale!', 'Cola za darmo? Kocham to miasto!', 'To się nazywa pełne zdrowie. Dzięki, szefie!'] },
  room: { p: 0.45, cd: 30, l: ['Dzień dobry, tylko oglądam!', 'Spokojnie, niczego nie będę łapał... sieciami.', 'Czy tu można zaparkować sieć?', 'Przepraszam za najście. Jestem z sąsiedztwa.'] },
  crime: { p: 0.7, cd: 15, l: ['Kolejny dzień, kolejny złodziej.', 'Nie dziękuj, to moja praca. Niezapłacona.', 'Wszystko pod kontrolą. Mniej więcej.', 'Przyjazny pająk z sąsiedztwa na posterunku!'] },
  carstop: { p: 0.8, cd: 35, l: ['Dzięki, że się zatrzymałeś! Zazwyczaj tylko mnie trąbią.', 'Nowy Jork i kierowcy, którzy hamują? Cud!', 'Spokojnie, panie taksówkarzu, nie rzucam się pod koła. Dziś.', 'Miło, że ktoś tu przestrzega przepisów.'] },
  rhino: { p: 1, cd: 60, l: ['Rogaty kolega! Ktoś tu potrzebuje urlopu.', 'Nosorożec? Dawno nie widziałem takiej góry mięśni.', 'Spokojnie, wielkoludzie, rozmawiajmy jak cywilizowani... no dobra, nie.'] },
  fisk: { p: 1, cd: 60, l: ['Panie Fisk, ładna wieża. Szkoda byłoby jej nie zburzyć.', 'Kingpin? Wolałem pana, kiedy pan jadł obiad.', 'Niezła laska. Szkoda, że tylko do chodzenia.'] },
  idle: { p: 1, cd: 40, l: ['Wiesz, że nic nie robię? To też praca.', 'Czy ktoś widział moją kawę?', 'Tak sobie myślę... może zmienić kostium na żółty?', 'To miasto nigdy nie śpi. Ja też nie. Niestety.'] },
  perch: { p: 0.5, cd: 40, l: ['Z tej wysokości wszystko wygląda lepiej.', 'Chwila oddechu... i znowu do roboty.', 'Ładny widok, prawda?'] },
  sunset: { p: 1, cd: 999, l: ['Złota godzina nad Nowym Jorkiem. Można się zakochać.', 'Taki zachód słońca i jeszcze mam pracę. Życie jest piękne.'] },
  night: { p: 1, cd: 999, l: ['Noc w mieście. Idealny czas na kłopoty.', 'Światła, kamera... pająk!'] },
  day: { p: 1, cd: 999, l: ['Piękny dzień na ratowanie miasta.', 'Słońce świeci, ptaki śpiewają, a ja bujam się na sieci.'] },
};

let el = null, hideT = 0, gcd = 4, startT = 0, prevState = '', idleT = 0, comboSaid = false, lowSaid = false;
const kcd = {}, lastIdx = {};

function bar() {
  const st = document.createElement('style');
  st.textContent = '#quip{position:fixed;left:50%;bottom:190px;transform:translateX(-50%);z-index:6;max-width:720px;padding:9px 20px 10px;background:rgba(5,16,26,.82);border-left:4px solid #e8232b;font:600 20px/1.3 Rajdhani,Arial,sans-serif;color:#fff;opacity:0;transition:opacity .35s;pointer-events:none;text-shadow:0 1px 6px rgba(0,0,0,.6)}#quip b{display:block;font-size:12px;letter-spacing:3px;color:#ff5a5f;margin-bottom:1px}';
  document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'quip'; el.innerHTML = '<b>SPIDER-MAN</b><span></span>'; document.body.appendChild(el);
}
function speak(t) {
  try {
    const ss = window.speechSynthesis; if (!save.voice || !ss) return;
    const v = ss.getVoices().find(x => /^pl/i.test(x.lang)); if (!v) return;
    ss.cancel(); const u = new SpeechSynthesisUtterance(t); u.voice = v; u.lang = v.lang; u.rate = 1.06; u.pitch = 1.25; u.volume = 0.9; ss.speak(u);
  } catch (e) { /* synteza mowy niedostepna: zostaje sam napis */ }
}
function show(t) {
  if (!el) bar();
  el.querySelector('span').textContent = t; el.style.opacity = 1; hideT = 3.2 + t.length * 0.045; speak(t);
}
export function say(kind, force) {
  const q = Q[kind]; if (!q || G.state !== 'play' || G.cine) return false;
  if (!force && (gcd > 0 || (kcd[kind] || 0) > 0 || Math.random() > q.p)) return false;
  let i = Math.floor(Math.random() * q.l.length);
  if (q.l.length > 1 && i === lastIdx[kind]) i = (i + 1) % q.l.length;
  lastIdx[kind] = i; show(q.l[i]); kcd[kind] = q.cd; gcd = 6; return true;
}
export const quipStart = () => { startT = 5; };
export function updateQuips(dt) {
  gcd -= dt; for (const k in kcd) kcd[k] -= dt;
  if (hideT > 0) { hideT -= dt; if (hideT <= 0 && el) el.style.opacity = 0; }
  if (G.state !== 'play' || G.cine) { prevState = ''; return; }
  if (startT > 0) { startT -= dt; if (startT <= 0) say(save.tod === 'night' ? 'night' : save.tod === 'day' ? 'day' : 'sunset', true); }
  const st = P.state;
  if (st === 'swing' && prevState !== 'swing') say('swing');
  prevState = st;
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (st === 'ground' && hs < 0.5 && !P.atk && !P.dead) { idleT += dt; if (idleT > (P.perchT > 0 ? 6 : 14)) { idleT = 0; say(P.perchT > 0 ? 'perch' : 'idle', true); } } else idleT = 0;
  if (P.combo >= 6) { if (!comboSaid) { comboSaid = true; say('combo'); } } else if (P.combo < 2) comboSaid = false;
  if (!P.dead && P.hp <= 30) { if (!lowSaid) { lowSaid = true; say('lowhp'); } } else if (P.hp > 60) lowSaid = false;
}
