// Wspolny stan gry: renderer, scena, kamera, gracz, wrogowie.
import { V3, save, linearize, dbg } from './util.js';

export const canvas = document.createElement('canvas');
canvas.id = 'c';
document.body.prepend(canvas);

// blad pokazany na ekranie (funkcja z index.html); przy plikach z dysku przegladarka
// ukrywa tresc bledow w window.onerror, dlatego lapiemy je sami
export function zglosBlad(e) {
  let m = (e && e.message) || String(e);
  if (/WebGL/i.test(m)) m += '\n\nPrzeglądarka nie może rysować grafiki 3D. W Edge: Ustawienia → System → włącz „Użyj przyspieszenia sprzętowego, gdy jest dostępne” i uruchom przeglądarkę ponownie.';
  const gdzie = e && e.stack ? '\n\n' + e.stack.split('\n').slice(1, 3).join('\n') : '';
  if (window.pokazBlad) window.pokazBlad(m + gdzie); else console.error(e);
}
// Bez powerPreference: 'high-performance' — na laptopach z dwiema kartami (Intel + NVIDIA)
// przelaczanie karty w przegladarce potrafilo dawac czarny ekran.
let r0;
try { r0 = new THREE.WebGLRenderer({ canvas, antialias: save.gfx === 'high' }); }
catch (e) { zglosBlad(e); throw e; }
export const renderer = r0;
export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, save.gfx === 'high' ? 1.25 : 1);
renderer.setPixelRatio(pixelRatio());

// Karta graficzna "zgubila" obraz (za duzo gier/kart 3D naraz albo przeciazenie):
// zamiast czarnego ekranu pokazujemy komunikat, przelaczamy na niska grafike i odswiezamy.
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault();
  save.gfx = 'low'; try { localStorage.setItem('spiderman_nyc_v1', JSON.stringify(save)); } catch (er) {}
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#05090f;color:#fff;font:20px Arial;text-align:center;padding:20px';
  el.innerHTML = '<b style="font-size:40px">SPIDER-MAN</b><p>Karta graficzna się przeciążyła.<br>Włączam niską grafikę i uruchamiam grę ponownie…</p>' +
    '<p style="color:#9fd8ea;font-size:17px">Jeśli to się powtarza: zamknij inne karty z grami (np. drugą kartę ze Spider-Manem, Narew) i Robloxa.</p>';
  document.body.appendChild(el);
  setTimeout(() => location.reload(), 2500);
}, false);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = save.gfx === 'high' && !dbg('noshadow');
renderer.shadowMap.type = THREE.PCFShadowMap; // tansze niz PCFSoft, a na laptopie liczy sie kazda klatka
// realistyczne kolory: liczenie swiatla liniowo + filmowa tonacja (jak w aparacie)
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = dbg('notm') ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = false;

export const scene = new THREE.Scene();
// kazdy obiekt dodany do sceny dostaje przeliczone (liniowe) kolory
const _add = scene.add.bind(scene);
scene.add = (...objs) => { for (const o of objs) linearize(o); return _add(...objs); };
export const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3200);

// state: 'menu' | 'play' | 'pause'
export const G = {
  state: 'menu', mode: 'kb', lastDev: 'kb', time: 0, started: false,
  slowT: 0, shake: 0, sense: false, wp: null,
  pauseTab: 'map', pauseFrom: 'menu', menuIdx: 0, suitIdx: 0, gameIdx: 0, skillIdx: 0, missIdx: 0,
  boss: null, race: null, chase: null, cine: null, interior: null, // aktywne misje (do HUD)
};

export const P = {
  pos: new V3(), vel: new V3(), prev: new V3(), state: 'ground', heading: -Math.PI / 2,
  H: null, suit: null, pc: null, pt: null, perch: true,
  anchor: new V3(), rope: 0, ropeT: 0, swingT: 0, swingSide: 1, swingCD: 0,
  wallN: new V3(), wallBox: null, wallVy: 0, climbPh: 0, climbSide: 0,
  zips: 2, zipT: 0, zipPt: new V3(),
  hp: 100, invT: 0, hurtT: 0, regenT: 0, dead: false, deadT: 0,
  atk: null, atkCD: 0, combo: 0, comboT: 0, step: 0, lunge: null, bufPunch: 0,
  dodgeT: 0, dodgeCD: 0, dodgeDir: new V3(), dodgeSide: 1, rolling: false, spinning: false,
  flipT: -1, flipDur: 0.6, flipBack: false, landT: 0, landHard: false, runPh: 0,
  webT: 0, webAim: new V3(), webCD: 0, sprint: false, airT: 0,
  focus: 0, punchHold: 0, upDone: false,          // skupienie (0..3), przytrzymanie ciosu
  pz: null, perchT: 0, perchPt: null, launchBuf: 0, // zaczep (point launch)
  car: null,                                        // jazda na dachu auta w poscigu
  trickT: 0, trickType: 0, trickCD: 0, fin: null,   // triki w powietrzu, wykonczenie
};

export const cam = { yaw: 0, pitch: -0.2, dist: 6, tgt: new V3(), idle: 0 };
export const enemies = [], crimes = [];
// funkcje podpinane przez main.js (start gry, powrot do menu, grafika)
export const hooks = {};
