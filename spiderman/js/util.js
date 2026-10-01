// Drobne narzedzia wspolne dla calej gry + zapis postepu.
export const V3 = THREE.Vector3;
export const UP = new V3(0, 1, 0), DOWN = new V3(0, -1, 0);

export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
// wspolczynnik wygladzania niezalezny od liczby klatek
export const damp = (k, dt) => 1 - Math.exp(-k * dt);
export function wrapA(a) { return ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
export function angLerp(a, b, t) { return a + wrapA(b - a) * t; }

// losowanie z ziarnem — miasto wyglada zawsze tak samo
let seed = 20180907;
export function srand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
export const sr = (a, b) => a + srand() * (b - a);

export const $ = id => document.getElementById(id);
export function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(c, rep) {
  const t = new THREE.CanvasTexture(c);
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.encoding = THREE.sRGBEncoding; // kolory z canvas sa w sRGB (dla map wypuklosci/szorstkosci nie ma to znaczenia)
  return t;
}

// Kolory w kodzie sa pisane "tak jak na ekranie" (sRGB), a oswietlenie liczy sie w przestrzeni liniowej.
// Ta funkcja przelicza kolory materialow, swiatel i instancji — raz, przy dodaniu do sceny.
export function linearize(root) {
  root.traverse(o => {
    for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
      if (m.isShaderMaterial || m.userData.lin) continue;
      m.userData.lin = true;
      if (m.color) m.color.convertSRGBToLinear();
      if (m.emissive) m.emissive.convertSRGBToLinear();
    }
    if (o.isInstancedMesh && o.instanceColor && !o.userData.linIC) {
      o.userData.linIC = true;
      const a = o.instanceColor.array, c = new THREE.Color();
      for (let i = 0; i < a.length; i += 3) { c.setRGB(a[i], a[i + 1], a[i + 2]).convertSRGBToLinear(); a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b; }
      o.instanceColor.needsUpdate = true;
    }
    if (o.isLight && !o.userData.lin) { o.userData.lin = true; o.color.convertSRGBToLinear(); if (o.groundColor) o.groundColor.convertSRGBToLinear(); }
  });
}
export const linHex = (c, hex) => c.setHex(hex).convertSRGBToLinear();

const KEY = 'spiderman_nyc_v1';
export const save = {
  lvl: 1, xp: 0, suit: 'adv', bags: [], crimes: 0, gfx: 'high',
  skills: [], races: {}, bossWins: 0, chases: 0, fisk: 0, pos: null, hd: 0, hasGame: false, savedAt: 0, tod: 'sunset', music: true,
};
try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
// nowa gra: kasuje caly postep, ale zostawia ustawienia (grafika, pora dnia, muzyka)
export function resetProgress() {
  const keep = { gfx: save.gfx, tod: save.tod, music: save.music };
  Object.assign(save, { lvl: 1, xp: 0, suit: 'adv', bags: [], crimes: 0, skills: [], races: {}, bossWins: 0, chases: 0, fisk: 0, pos: null, hd: 0, hasGame: false, savedAt: 0 }, keep);
  doSave();
}
export function doSave() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

// przelaczniki diagnostyczne z adresu strony, np. index.html?noenv&noshadow (do pomiarow wydajnosci)
const QS = new URLSearchParams(location.search);
export const dbg = k => QS.has(k);
