// Poziom ulicy: rekwizyty na chodnikach (latarnie, sygnalizacja, kioski, wozki z hot-dogami, wejscia do metra,
// rusztowania, stojaki, hydranty...), szyldy na fasadach oraz ruch uliczny (taksowki, sedany, SUV-y, ciezarowki,
// autobusy MTA) zatrzymujacy sie na czerwonym swietle.
// Wszystkie nieruchome detale sa scalane w kawalki 128 x 128 m (jedno rysowanie na kawalek, z cieniami),
// pojazdy to instancje (jedno rysowanie na typ pojazdu) rysowane tylko blisko kamery.
import { G, P, scene, camera } from './stan.js';
import { sfx } from './dzwiek.js';
import { say } from './docinki.js';
import { vehParts } from './auta.js';
import { SW, NX, NZ, CX, CZ, CW, CD, X0, Z0, ST, BW, BD, inPark, isPark, doors, footprints, addBox, ventList, glowPoints, todName, distKey, PK } from './miasto.js';

// wlasne losowanie z ziarnem (nie zmienia ukladu budynkow, ktory zalezy od srand)
let rs = 91733;
const rr = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
const rb = (a, b) => a + rr() * (b - a);
const pick = a => a[Math.floor(rr() * a.length)];
const LC = new Map();
const lin = hex => { let c = LC.get(hex); if (!c) { c = new THREE.Color(hex).convertSRGBToLinear(); LC.set(hex, c); } return c; };

// ---------------------------------------------------------------- material z parametrami w wierzcholkach
// vp = (maska lakieru, szorstkosc, metalicznosc, rodzaj swiecenia). Swiecenie zalezy od pory dnia (uLamp)
// i - dla pojazdow - od hamowania (aBrake, osobno dla kazdej instancji).
const U = { lamp: { value: 0.6 }, time: { value: 0 } };
const LAMPS = { sunset: 0.6, day: 0, night: 1 };
function streetMat(veh) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0 });
  m.userData.lin = true; // kolory wierzcholkow sa juz liniowe
  m.customProgramCacheKey = () => veh ? 'ulica-veh' : 'ulica-st';
  m.onBeforeCompile = sh => {
    sh.uniforms.uLamp = U.lamp; sh.uniforms.uTime = U.time;
    sh.vertexShader = 'attribute vec4 vp;\nvarying vec4 vVp;\n' + (veh ? 'attribute float aBrake;\nvarying float vBrake;\nvarying float vLy;\n' : '') + sh.vertexShader
      .replace('#include <color_vertex>', `vColor = color;
        #ifdef USE_INSTANCING_COLOR
          vColor = mix(vColor, vColor * instanceColor, vp.x);
        #endif
        vVp = vp;${veh ? ' vBrake = aBrake; vLy = position.y;' : ''}`);
    sh.fragmentShader = 'uniform float uLamp;\nuniform float uTime;\nvarying vec4 vVp;\n' + (veh ? 'varying float vBrake;\nvarying float vLy;\n' : 'const float vBrake = 0.0;\n') + sh.fragmentShader
      .replace('#include <color_fragment>', veh ? `#include <color_fragment>
        if (vVp.x > 0.5) diffuseColor.rgb *= mix(0.4, 1.0, smoothstep(0.3, 0.78, vLy));   // zabrudzenie przy progach` : '#include <color_fragment>')
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vVp.y;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vVp.z;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${veh ? `{
          // lekkie odbicie nieba: szyby (mocne), lakier (polysk), chrom (udawany)
          float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
          vec3 sk = uLamp < 0.6 ? mix(vec3(0.55, 0.64, 0.78), vec3(0.62, 0.42, 0.26), uLamp / 0.6) : mix(vec3(0.62, 0.42, 0.26), vec3(0.05, 0.06, 0.1), (uLamp - 0.6) / 0.4);
          if (vVp.y < 0.1) totalEmissiveRadiance += sk * (0.1 + fr * 0.9);
          else if (vVp.z > 0.9) totalEmissiveRadiance += sk * (0.3 + fr * 0.5);
          else if (vVp.x > 0.5) totalEmissiveRadiance += sk * fr * 0.28;
        }` : ''}
        float ek = floor(vVp.w + 0.5);
        if (ek > 0.5) {
          vec3 ec;
          if (ek < 1.5) ec = vec3(1.0, 0.72, 0.42) * (0.1 + uLamp * 2.6);                         // lampa
          else if (ek < 2.5) ec = vec3(0.3, 1.0, 0.45) * (0.25 + uLamp * 2.2);                     // kule przy metrze
          else if (ek < 3.5) ec = vec3(1.0, 0.9, 0.75) * (uLamp * 1.5);                            // lampki, podswietlenie
          else if (ek < 4.5) ec = vec3(1.0, 0.96, 0.88) * (0.3 + uLamp * 3.0);                     // reflektory
          else if (ek < 5.5) ec = vec3(1.0, 0.05, 0.02) * (0.2 + uLamp * 1.0 + vBrake * 2.6);      // swiatla tylne / stop
          else if (ek < 6.5) ec = vec3(1.0, 0.9, 0.62) * (0.45 + uLamp * 1.6);                     // kogut taksowki
          else if (ek < 7.5) ec = vec3(1.0, 0.55, 0.08) * (0.9 + uLamp * 1.4);                     // tablica autobusu
          else if (ek < 8.5) ec = vec3(1.0, 0.42, 0.08) * (0.6 + uLamp * 1.4);                    // pomaranczowa reka
          else if (ek < 9.5) ec = vec3(1.0, 0.06, 0.03) * (0.5 + 3.4 * step(0.5, fract(uTime * 2.6)));          // koguty: czerwony
          else if (ek < 10.5) ec = vec3(0.12, 0.3, 1.0) * (0.5 + 3.4 * (1.0 - step(0.5, fract(uTime * 2.6)))); // koguty: niebieski
          else ec = vec3(1.0, 0.95, 0.85) * (0.6 + 3.0 * (1.0 - step(0.5, fract(uTime * 2.6))));                // koguty: bialy
          totalEmissiveRadiance += ec;
        }`);
  };
  return m;
}
// rodzaje powierzchni: [szorstkosc, metalicznosc, swiecenie]
const MT = {
  m: [0.88, 0, 0], r: [1, 0, 0], p: [0.45, 0.1, 0], car: [0.24, 0.5, 0], mt: [0.42, 0.7, 0], ch: [0.18, 1, 0], gl: [0.04, 0.8, 0], pl: [0.32, 0, 0],
  lamp: [0.4, 0, 1], globe: [0.3, 0, 2], light: [0.5, 0, 3], head: [0.1, 0.3, 4], tail: [0.3, 0.2, 5], taxi: [0.5, 0, 6], dest: [0.5, 0, 7], hand: [0.5, 0, 8], sirR: [0.3, 0, 9], sirB: [0.3, 0, 10], sirW: [0.3, 0, 11],
};
// ksztalty pomocnicze
const B = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const C = (r0, r1, h, x = 0, y = 0, z = 0, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);
const Sph = (r, x, y, z, sx = 1, sy = 1, sz = 1, ws = 8, hs = 6) => new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
// szablon: lista [geometria, kolor sRGB, rodzaj, lakier?] -> plaskie tablice
function tpl(parts) {
  const P = [], N = [], Cc = [], V = [], I = [], lamps = { head: [], tail: [] };
  for (const [g, hex, k = 'm', paint = 0] of parts) {
    if (k === 'head' || k === 'tail') { g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); lamps[k].push([c.x, c.y, c.z]); } // srodek kazdej lampy: tu rysujemy poswiate
    const off = P.length / 3, p = g.attributes.position, n = g.attributes.normal, M = MT[k], c = lin(hex);
    for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); Cc.push(c.r, c.g, c.b); V.push(paint, M[0], M[1], M[2]); }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) I.push(i + off);
  }
  return { p: new Float32Array(P), n: new Float32Array(N), c: new Float32Array(Cc), v: new Float32Array(V), i: new Uint32Array(I), cnt: P.length / 3, lamps };
}
function tplGeo(T) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(T.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(T.n, 3));
  g.setAttribute('color', new THREE.BufferAttribute(T.c, 3)); g.setAttribute('vp', new THREE.BufferAttribute(T.v, 4));
  g.setIndex(new THREE.BufferAttribute(T.i, 1)); g.computeBoundingSphere(); return g;
}
// markiza: skosny daszek z falbanka z przodu (jedna geometria do instancji w miasto.js)
export function awningGeo() {
  const T = tpl([[B(1, 0.05, 1.5), 0xffffff], [B(1, 0.34, 0.03, 0, -0.17, 0.74), 0xffffff], [B(1, 0.05, 0.05, 0, -0.33, 0.75), 0x222222]]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(T.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(T.n, 3));
  g.setIndex(new THREE.BufferAttribute(T.i, 1)); return g;
}

// ---------------------------------------------------------------- scalanie nieruchomych detali w kawalki
const SCH = 128, chunks = new Map();
const grow = (a, n) => { const r = new a.constructor(n); r.set(a); return r; };
function chunkAt(x, z) {
  const k = Math.floor(x / SCH) * 4096 + Math.floor(z / SCH);
  let b = chunks.get(k);
  if (!b) { b = { n: 0, ni: 0, p: new Float32Array(3 * 16384), nn: new Float32Array(3 * 16384), c: new Float32Array(3 * 16384), v: new Float32Array(4 * 16384), i: new Uint32Array(32768) }; chunks.set(k, b); }
  return b;
}
// stawia szablon w punkcie (x, y, z), obrocony o yaw wokol osi Y; tint koloruje czesci "lakierowane"
function place(T, x, y, z, yaw = 0, tint = null) {
  const b = chunkAt(x, z);
  if ((b.n + T.cnt) * 3 > b.p.length) { const cap = Math.max((b.n + T.cnt) * 2, 16384); b.p = grow(b.p, cap * 3); b.nn = grow(b.nn, cap * 3); b.c = grow(b.c, cap * 3); b.v = grow(b.v, cap * 4); }
  if (b.ni + T.i.length > b.i.length) b.i = grow(b.i, Math.max((b.ni + T.i.length) * 2, 32768));
  const cs = Math.cos(yaw), sn = Math.sin(yaw), o = b.n, tc = tint ? lin(tint) : null;
  for (let i = 0; i < T.cnt; i++) {
    const i3 = i * 3, j = (o + i) * 3, px = T.p[i3], pz = T.p[i3 + 2], nx = T.n[i3], nz = T.n[i3 + 2];
    b.p[j] = x + px * cs + pz * sn; b.p[j + 1] = y + T.p[i3 + 1]; b.p[j + 2] = z - px * sn + pz * cs;
    b.nn[j] = nx * cs + nz * sn; b.nn[j + 1] = T.n[i3 + 1]; b.nn[j + 2] = -nx * sn + nz * cs;
    const t = tc && T.v[i * 4] > 0.5;
    b.c[j] = T.c[i3] * (t ? tc.r : 1); b.c[j + 1] = T.c[i3 + 1] * (t ? tc.g : 1); b.c[j + 2] = T.c[i3 + 2] * (t ? tc.b : 1);
    const q = (o + i) * 4; b.v[q] = 0; b.v[q + 1] = T.v[i * 4 + 1]; b.v[q + 2] = T.v[i * 4 + 2]; b.v[q + 3] = T.v[i * 4 + 3];
  }
  for (let k = 0; k < T.i.length; k++) b.i[b.ni + k] = T.i[k] + o;
  b.n += T.cnt; b.ni += T.i.length;
}
const boxAt = (x0, x1, y0, y1, z0, z1, hex, k = 'm') => place(tpl([[B(x1 - x0, y1 - y0, z1 - z0), hex, k]]), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
function flushStatics() {
  const mat = streetMat(false);
  for (const b of chunks.values()) {
    if (!b.n) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b.p.slice(0, b.n * 3), 3)); g.setAttribute('normal', new THREE.BufferAttribute(b.nn.slice(0, b.n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(b.c.slice(0, b.n * 3), 3)); g.setAttribute('vp', new THREE.BufferAttribute(b.v.slice(0, b.n * 4), 4));
    g.setIndex(new THREE.BufferAttribute(b.i.slice(0, b.ni), 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
  }
  chunks.clear();
}

// ---------------------------------------------------------------- szablony rekwizytow (przod = +z, czyli w strone jezdni)
let PT = null;
function propTemplates() {
  const T = {};
  // hydrant nowojorski: kolnierz, korpus, pokrywa, boczne wyloty z zaslepkami (lakier = korpus)
  T.hydrant = tpl([
    [C(0.18, 0.2, 0.08, 0, 0.04, 0, 10), 0xffffff, 'p', 1], [C(0.13, 0.14, 0.56, 0, 0.36, 0, 10), 0xffffff, 'p', 1], [C(0.175, 0.175, 0.07, 0, 0.66, 0, 10), 0xffffff, 'p', 1],
    [Sph(0.14, 0, 0.7, 0, 1, 0.75, 1), 0xffffff, 'p', 1], [C(0.035, 0.05, 0.09, 0, 0.82, 0, 6), 0xc8c8c8, 'mt'],
    [C(0.055, 0.055, 0.36, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(0, 0.46, 0), 0xffffff, 'p', 1],
    [C(0.07, 0.07, 0.04, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(0.19, 0.46, 0), 0xd0d0d0, 'mt'], [C(0.07, 0.07, 0.04, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(-0.19, 0.46, 0), 0xd0d0d0, 'mt'],
    [C(0.085, 0.085, 0.12, 0, 0, 0, 8).rotateX(Math.PI / 2).translate(0, 0.48, 0.15), 0xd0d0d0, 'mt'],
  ]);
  // kosz na smieci z siatki (zielony), z czarnym workiem w srodku
  T.trash = tpl([[C(0.3, 0.25, 0.86, 0, 0.43, 0, 10), 0xffffff, 'mt', 1], [C(0.32, 0.32, 0.05, 0, 0.86, 0, 10), 0xffffff, 'mt', 1], [C(0.305, 0.305, 0.03, 0, 0.32, 0, 10), 0x1c1c1c, 'mt'], [C(0.28, 0.28, 0.02, 0, 0.875, 0, 10), 0x0d0d0d, 'pl']]);
  // kosz z prasa (BigBelly): niebieska skrzynka z ciemnym panelem slonecznym
  T.bigbelly = tpl([[B(0.62, 1.2, 0.66, 0, 0.6, 0), 0x2a5d9c, 'p'], [B(0.64, 0.06, 0.68, 0, 1.23, 0), 0x2b2f33, 'mt'], [B(0.56, 0.02, 0.5, 0, 1.27, -0.02).rotateX(-0.12), 0x161c2a, 'gl'], [B(0.36, 0.22, 0.02, 0, 0.92, 0.335), 0x111111, 'mt']]);
  T.mailbox = tpl([[B(0.52, 0.66, 0.46, 0, 0.98, 0), 0x1f4f9c, 'p'], [C(0.23, 0.23, 0.46, 0, 0, 0, 12).rotateX(Math.PI / 2).translate(0, 1.31, 0), 0x1f4f9c, 'p'], [B(0.1, 0.66, 0.1, -0.19, 0.33, 0), 0x22252a, 'mt'], [B(0.1, 0.66, 0.1, 0.19, 0.33, 0), 0x22252a, 'mt'], [B(0.34, 0.04, 0.03, 0, 1.12, 0.23), 0x111111, 'mt'], [B(0.18, 0.12, 0.01, 0, 0.92, 0.235), 0xe8e8e8, 'm']]);
  T.bench = tpl([[B(1.7, 0.07, 0.5, 0, 0.5, 0), 0x6b4a2a], [B(1.7, 0.4, 0.06, 0, 0.78, -0.22), 0x6b4a2a], [B(0.08, 0.5, 0.45, -0.75, 0.25, 0), 0x2a2d30, 'mt'], [B(0.08, 0.5, 0.45, 0.75, 0.25, 0), 0x2a2d30, 'mt']]);
  // parkometr (muni-meter): ciemny slupek z niebieska glowica
  T.meter = tpl([[B(0.3, 1.3, 0.24, 0, 0.65, 0), 0x2b2f33, 'mt'], [B(0.32, 0.24, 0.27, 0, 1.42, 0), 0x1f4f9c, 'p'], [B(0.16, 0.1, 0.01, 0, 1.2, 0.125), 0x9ad6a0, 'light'], [B(0.4, 0.04, 0.3, 0, 0.02, 0), 0x3a3d40, 'mt']]);
  // automaty z gazetami - kilka w rzedzie, rozne kolory
  const newsRow = () => { const parts = [], cols = [0xb8261f, 0x2c5fa8, 0xd9a01e, 0x2f7a4a, 0xe8e4d8, 0x1d1d1d, 0x6a1b7a]; const n = 3 + Math.floor(rr() * 3);
    for (let k = 0; k < n; k++) { const x = (k - (n - 1) / 2) * 0.56, h = rb(0.85, 1.1), c = pick(cols);
      parts.push([B(0.5, h, 0.46, x, h / 2, 0), c, 'p'], [B(0.38, 0.3, 0.02, x, h * 0.66, 0.235), 0xe9e4d2, 'gl'], [B(0.52, 0.05, 0.48, x, h + 0.02, 0), 0x2b2b2b, 'mt'], [B(0.2, 0.04, 0.04, x, h * 0.45, 0.24), 0x999999, 'mt']); }
    return tpl(parts); };
  T.news = [newsRow(), newsRow(), newsRow()];
  T.cone = tpl([[new THREE.ConeGeometry(0.16, 0.7, 10).translate(0, 0.4, 0), 0xff6a14, 'p'], [B(0.4, 0.05, 0.4, 0, 0.03, 0), 0x2b2b2b], [C(0.13, 0.145, 0.06, 0, 0.42, 0, 10), 0xf2f2f2, 'p']]);
  // beczka drogowa: pomaranczowa w biale pasy, czarna podstawa
  T.barrel = tpl([[C(0.4, 0.42, 0.09, 0, 0.045, 0, 10), 0x1a1a1a, 'm'], [C(0.27, 0.3, 0.95, 0, 0.55, 0, 10), 0xff6012, 'p'], [C(0.288, 0.296, 0.11, 0, 0.42, 0, 10), 0xf2f2f2, 'p'], [C(0.278, 0.286, 0.11, 0, 0.72, 0, 10), 0xf2f2f2, 'p'], [C(0.2, 0.27, 0.06, 0, 1.04, 0, 10), 0xff6012, 'p']]);
  T.crates = tpl([[B(0.7, 0.55, 0.7, 0, 0.28, 0), 0xa8804f], [B(0.6, 0.5, 0.6, 0.15, 0.83, 0.05), 0x9b7a4c], [B(0.5, 0.4, 0.5, -0.55, 0.2, 0.3), 0x7e6a4a]]);
  T.dumpster = tpl([[B(2.3, 1.15, 1.1, 0, 0.7, 0), 0xffffff, 'p', 1], [B(2.34, 0.08, 1.14, 0, 1.31, 0), 0x2b2b2b, 'pl'], [B(2.3, 0.14, 1.1, 0, 0.1, 0), 0x222222], [C(0.11, 0.11, 0.1, -0.9, 0.09, 0.4, 8), 0x111111], [C(0.11, 0.11, 0.1, 0.9, 0.09, 0.4, 8), 0x111111], [B(0.6, 0.3, 0.02, 0.5, 0.85, 0.56), 0xe8e8e8, 'm']]);
  // komin pary Con Ed na jezdni (pomaranczowy w biale pasy)
  T.vent = tpl([[new THREE.CylinderGeometry(0.22, 0.4, 1.4, 12).translate(0, 0.7, 0), 0xff7a1a, 'p'], [C(0.42, 0.42, 0.12, 0, 0.06, 0, 12), 0x444444], [C(0.235, 0.235, 0.12, 0, 0.9, 0, 12), 0xf2f2f2, 'p'], [C(0.2, 0.2, 0.1, 0, 1.36, 0, 12), 0xf2f2f2, 'p']]);
  // wiata przystanku: ciemne szklo, podswietlana reklama nocą
  T.shelter = tpl([[B(3.6, 0.1, 1.5, 0, 2.5, 0), 0x2b2f33, 'mt'], [B(0.08, 2.5, 0.08, -1.7, 1.25, -0.6), 0x2b2f33, 'mt'], [B(0.08, 2.5, 0.08, 1.7, 1.25, -0.6), 0x2b2f33, 'mt'], [B(0.08, 2.5, 0.08, -1.7, 1.25, 0.55), 0x2b2f33, 'mt'],
    [B(3.4, 2.0, 0.03, 0, 1.3, -0.62), 0x4f6470, 'gl'], [B(0.03, 2.0, 1.05, -1.7, 1.3, -0.05), 0x4f6470, 'gl'], [B(1.8, 0.06, 0.4, 0.2, 0.5, -0.4), 0x6b4a2a], [B(0.06, 0.45, 0.35, 1.0, 0.25, -0.4), 0x2b2f33, 'mt'],
    [B(1.1, 1.6, 0.12, 1.15, 1.3, 0.55), 0x2b2f33, 'mt'], [B(0.95, 1.4, 0.13, 1.15, 1.3, 0.55), 0xe8dcc8, 'light'], [B(3.6, 0.22, 0.04, 0, 2.38, 0.75), 0x1f4f9c, 'p']]);
  // kiosk z gazetami: zielona budka, wystawa czasopism, daszek
  const kiosk = [[B(2.6, 2.25, 1.45, 0, 1.13, 0), 0xffffff, 'p', 1], [B(2.95, 0.14, 1.9, 0, 2.32, 0.15), 0xffffff, 'p', 1], [B(2.6, 0.32, 0.03, 0, 2.08, 0.74), 0xb8261f, 'p'],
    [B(2.2, 1.1, 0.02, 0, 1.38, 0.735), 0x2a2420, 'm'], [B(2.3, 0.08, 0.32, 0, 0.92, 0.86), 0x4a4a4a, 'mt'], [B(2.0, 0.08, 0.1, 0, 2.0, 0.55), 0xfff0d0, 'light']];
  const mag = [0xc0392b, 0xe9c46a, 0x2a9d8f, 0xf4f1de, 0xe76f51, 0x457b9d, 0x8d99ae, 0x6a994e, 0xd62828, 0x222222];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 9; k++) kiosk.push([B(0.2, 0.28, 0.02, -0.96 + k * 0.24, 1.05 + r * 0.34, 0.75), pick(mag), 'pl']);
  for (let k = 0; k < 7; k++) kiosk.push([B(0.26, 0.04, 0.2, -0.85 + k * 0.28, 0.98, 0.86), pick(mag), 'pl']);
  // tyl i boki: podswietlane plakaty reklamowe, cokol, okapnik
  kiosk.push([B(2.2, 1.3, 0.03, 0, 1.35, -0.735), 0xe8dcc8, 'light'], [B(2.3, 1.4, 0.02, 0, 1.35, -0.73), 0x1b1c1f, 'mt'], [B(2.0, 0.5, 0.035, -0.05, 1.55, -0.74), 0xc0392b, 'pl'], [B(1.2, 0.35, 0.035, 0.3, 1.0, -0.74), 0x2a5d9c, 'pl'],
    [B(0.03, 1.1, 1.0, 1.31, 1.35, 0), 0xe8dcc8, 'light'], [B(0.03, 1.1, 1.0, -1.31, 1.35, 0), 0xe8dcc8, 'light'], [B(0.035, 0.4, 0.8, 1.31, 1.5, 0), 0xe9c46a, 'pl'], [B(0.035, 0.4, 0.8, -1.31, 1.5, 0), 0x2a9d8f, 'pl'],
    [B(2.65, 0.18, 1.5, 0, 0.09, 0), 0x2b2b2b, 'mt']);
  T.kiosk = tpl(kiosk);
  // wozek z hot-dogami: blacha nierdzewna, dwa kola, parasol (lakier = parasol)
  T.hotdog = tpl([[B(1.5, 0.72, 0.8, 0, 0.76, 0), 0xc9ced3, 'ch'], [B(1.52, 0.06, 0.82, 0, 1.15, 0), 0xa9aeb3, 'ch'], [B(1.2, 0.28, 0.02, 0, 0.82, 0.41), 0xc0281f, 'p'], [B(1.0, 0.07, 0.02, 0, 0.82, 0.425), 0xf2c00f, 'p'],
    [C(0.3, 0.3, 0.06, 0, 0, 0, 12).rotateZ(Math.PI / 2).translate(-0.35, 0.3, 0.43), 0x1a1a1a, 'r'], [C(0.3, 0.3, 0.06, 0, 0, 0, 12).rotateZ(Math.PI / 2).translate(-0.35, 0.3, -0.43), 0x1a1a1a, 'r'],
    [B(0.08, 0.5, 0.08, 0.6, 0.25, 0), 0x777777, 'mt'], [B(0.04, 0.04, 0.8, 0.85, 1.0, 0), 0x777777, 'mt'],
    [C(0.025, 0.025, 1.5, 0.1, 1.9, 0, 6), 0xcccccc, 'mt'], [C(0.03, 1.15, 0.42, 0.1, 2.72, 0, 10), 0xffffff, 'p', 1], [C(0.04, 0.04, 0.08, 0.1, 2.97, 0, 6), 0x333333, 'mt'],
    [B(0.3, 0.25, 0.25, -0.5, 1.3, 0), 0xe8a020, 'pl'], [B(0.25, 0.3, 0.2, 0.3, 1.33, 0), 0xc0281f, 'pl']]);
  // automat telefoniczny: slupek, srebrna obudowa, niebieski znak na gorze
  T.phone = tpl([[C(0.06, 0.07, 1.3, 0, 0.65, 0, 8), 0x8a8f94, 'mt'], [B(0.58, 0.9, 0.38, 0, 1.55, 0), 0xa8adb2, 'ch'], [B(0.5, 0.75, 0.04, 0, 1.55, 0.2), 0x2b2f33, 'mt'],
    [B(0.12, 0.38, 0.08, -0.15, 1.6, 0.23), 0x111111, 'pl'], [B(0.18, 0.24, 0.03, 0.1, 1.65, 0.23), 0x9aa0a6, 'ch'], [B(0.64, 0.3, 0.42, 0, 2.18, 0), 0x1f4f9c, 'p'], [B(0.5, 0.12, 0.43, 0, 2.18, 0), 0xf2f2f2, 'light'], [B(0.4, 0.04, 0.4, 0, 0.02, 0), 0x3a3d40, 'mt']]);
  // stojak na rowery: rzad odwroconych "U"
  { const parts = []; for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 0.85; parts.push([new THREE.TorusGeometry(0.38, 0.028, 5, 10, Math.PI).scale(1, 1.15, 1).translate(x, 0.5, 0), 0x8f959b, 'mt'], [C(0.028, 0.028, 0.5, x - 0.38, 0.25, 0, 5), 0x8f959b, 'mt'], [C(0.028, 0.028, 0.5, x + 0.38, 0.25, 0, 5), 0x8f959b, 'mt']); }
    T.bikes = tpl(parts); }
  T.bollard = tpl([[C(0.12, 0.13, 0.85, 0, 0.43, 0, 10), 0xffffff, 'mt', 1], [Sph(0.12, 0, 0.86, 0, 1, 0.5, 1), 0xffffff, 'mt', 1], [C(0.135, 0.135, 0.05, 0, 0.7, 0, 10), 0xd8d8d8, 'ch']]);
  // worki ze smieciami: kilka splaszczonych bryl (czarne, zielone, przezroczyste)
  T.bags = [0, 1, 2].map(() => { const parts = [], n = 3 + Math.floor(rr() * 5);
    for (let k = 0; k < n; k++) { const s = rb(0.26, 0.4); parts.push([new THREE.IcosahedronGeometry(s, 1).scale(rb(1, 1.3), rb(0.75, 1.0), rb(0.9, 1.2)).translate(rb(-0.7, 0.7), s * 0.8 + (k > 3 ? 0.35 : 0), rb(-0.35, 0.35)), pick([0x141518, 0x141518, 0x1b1d1a, 0x1f2a1e, 0xa7aaa9]), 'pl']); }
    return tpl(parts); });
  // dolek z drzewem: ziemia + niskie metalowe ogrodzenie (albo sama krata)
  { const soil = [B(1.5, 0.02, 1.5, 0, 0.012, 0), 0x3a2c20, 'r'], edge = [];
    for (const s of [-1, 1]) { edge.push([B(1.6, 0.03, 0.06, 0, 0.02, s * 0.77), 0x6d6a64, 'm'], [B(0.06, 0.03, 1.6, s * 0.77, 0.02, 0), 0x6d6a64, 'm']); }
    const fence = [];
    for (const [x, z] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) fence.push([C(0.02, 0.02, 0.46, x, 0.23, z, 5), 0x1b1d20, 'mt']);
    for (const s of [-1, 1]) for (const y of [0.22, 0.44]) fence.push([B(1.46, 0.025, 0.025, 0, y, s * 0.72), 0x1b1d20, 'mt'], [B(0.025, 0.025, 1.46, s * 0.72, y, 0), 0x1b1d20, 'mt']);
    T.pit = tpl([soil, ...edge]); T.pitFence = tpl([soil, ...edge, ...fence]); }
  // krata wentylacyjna metra w chodniku
  { const parts = [[B(2.8, 0.02, 1.2, 0, 0.011, 0), 0x0c0d0e, 'mt'], [B(2.9, 0.025, 0.06, 0, 0.014, 0.62), 0x55585c, 'mt'], [B(2.9, 0.025, 0.06, 0, 0.014, -0.62), 0x55585c, 'mt']];
    for (let k = 0; k < 24; k++) parts.push([B(0.035, 0.025, 1.2, -1.38 + k * 0.12, 0.016, 0), 0x5c5f63, 'mt']);
    T.grate = tpl(parts); }
  T.plate = tpl([[B(2.4, 0.03, 1.8, 0, 0.03, 0), 0x3b3d40, 'mt']]);
  // znak "zakaz parkowania" na cienkim slupku
  T.noPark = tpl([[C(0.03, 0.03, 2.6, 0, 1.3, 0, 6), 0x5a5e62, 'mt'], [B(0.32, 0.46, 0.02, 0, 2.3, 0.04), 0xeeeeee, 'm'], [B(0.26, 0.06, 0.025, 0, 2.38, 0.045), 0xc0281f, 'm'], [B(0.2, 0.05, 0.025, 0, 2.22, 0.045), 0x222222, 'm']]);
  // przylacze strazackie na scianie (mosiezne "Y")
  T.siamese = tpl([[C(0.06, 0.06, 0.3, 0, 0, 0, 8).rotateX(Math.PI / 2).translate(0, 0.65, 0.15), 0xb08d3c, 'mt'], [C(0.05, 0.05, 0.22, 0, 0, 0, 8).rotateZ(0.9).translate(-0.1, 0.72, 0.3), 0xb08d3c, 'mt'], [C(0.05, 0.05, 0.22, 0, 0, 0, 8).rotateZ(-0.9).translate(0.1, 0.72, 0.3), 0xb08d3c, 'mt'], [C(0.07, 0.07, 0.04, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(-0.2, 0.79, 0.3), 0x9a7a30, 'mt'], [C(0.07, 0.07, 0.04, 0, 0, 0, 8).rotateZ(Math.PI / 2).translate(0.2, 0.79, 0.3), 0x9a7a30, 'mt']]);
  // wejscie do metra: ciemny otwor ze stopniami, zielona balustrada, dwie kule-latarnie przy wejsciu (+x)
  { const L = 4.4, W = 1.7, parts = [[B(L, 0.02, W - 0.1, 0, 0.012, 0), 0x0a0a0b, 'r']], g = 0x2e5a3c;
    for (let k = 0; k < 9; k++) parts.push([B(0.05, 0.022, W - 0.2, L / 2 - 0.4 - k * 0.42, 0.013, 0), 0x3b3b3b, 'm']);
    for (const s of [-1, 1]) {
      for (let k = 0; k <= 4; k++) parts.push([C(0.03, 0.03, 1.05, -L / 2 + k * L / 4, 0.52, s * W / 2, 6), g, 'mt']);
      parts.push([B(L, 0.06, 0.06, 0, 1.05, s * W / 2), g, 'mt'], [B(L, 0.03, 0.03, 0, 0.55, s * W / 2), g, 'mt'], [B(L, 0.14, 0.05, 0, 0.2, s * W / 2), g, 'mt']);
      parts.push([C(0.045, 0.06, 2.0, L / 2, 1.0, s * W / 2, 8), g, 'mt'], [Sph(0.17, L / 2, 2.15, s * W / 2, 1, 1, 1, 10, 8), 0x7fe39a, 'globe'], [C(0.09, 0.06, 0.06, L / 2, 1.99, s * W / 2, 8), g, 'mt']);
    }
    parts.push([B(0.06, 1.05, W, -L / 2, 0.55, 0), g, 'mt'], [B(0.05, 0.42, W - 0.2, -L / 2 + 0.01, 1.32, 0), 0x111111, 'm'], [B(0.06, 0.08, W - 0.5, -L / 2 + 0.01, 1.36, 0), 0xf2f2f2, 'm']);
    for (const [c, z] of [[0xee352e, -0.45], [0x00933c, -0.15], [0xfccc0a, 0.15], [0x0039a6, 0.45]]) parts.push([Sph(0.07, -L / 2 + 0.03, 1.22, z, 0.4, 1, 1, 8, 6), c, 'p']);
    T.subway = tpl(parts); }
  // tabliczki z nazwami ulic (zielone) i "ONE WAY" na slupku
  const blades = (y) => [[B(1.05, 0.22, 0.03, 0.45, y, 0), 0x1f6a3a, 'p'], [B(0.85, 0.07, 0.035, 0.45, y, 0), 0xe8e8e8, 'm'], [B(0.03, 0.22, 1.05, 0, y - 0.26, 0.45), 0x1f6a3a, 'p'], [B(0.035, 0.07, 0.85, 0, y - 0.26, 0.45), 0xe8e8e8, 'm']];
  T.signPole = tpl([[C(0.045, 0.05, 3.7, 0, 1.85, 0, 6), 0x3c4a3e, 'mt'], [Sph(0.06, 0, 3.72, 0), 0x3c4a3e, 'mt'], ...blades(3.45), [B(0.8, 0.26, 0.03, 0, 2.7, 0.04), 0x111111, 'm'], [B(0.6, 0.06, 0.035, 0, 2.7, 0.045), 0xf0f0f0, 'm']]);
  // latarnia "cobra head": slupek z podstawa i lukowate ramie wzdluz +x (glowica osobno, swieci)
  { const arm = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 7.9, 0), new THREE.Vector3(0.1, 9.0, 0), new THREE.Vector3(2.3, 9.0, 0)), 8, 0.055, 5, false);
    T.lampPole = tpl([[C(0.2, 0.24, 0.55, 0, 0.27, 0, 8), 0x2c3238, 'mt'], [C(0.16, 0.2, 0.12, 0, 0.6, 0, 8), 0x2c3238, 'mt'], [C(0.075, 0.13, 7.6, 0, 4.4, 0, 8), 0x2c3238, 'mt'], [arm, 0x2c3238, 'mt']]); }
  // slup z sygnalizacja (narozny): ramie nad aleja (-x), ramie nad ulica (-z), lampa na gorze, tabliczki z nazwami
  { const parts = [[C(0.24, 0.28, 0.65, 0, 0.32, 0, 10), 0x2b3033, 'mt'], [C(0.11, 0.16, 8.0, 0, 4.6, 0, 10), 0x2b3033, 'mt'],
      [B(8.2, 0.17, 0.17, -4.1, 6.05, 0), 0x2b3033, 'mt'], [B(0.05, 0.05, 4.4, 0, 0, 0).rotateY(Math.PI / 2).rotateZ(0.16).translate(-2.1, 6.45, 0), 0x2b3033, 'mt'],
      [B(0.15, 0.15, 6.6, 0, 5.6, -3.3), 0x2b3033, 'mt'], [B(0.18, 0.18, 0.18, 0, 6.05, 0), 0x2b3033, 'mt'], ...blades(3.3).map(([g, c, k]) => [g.clone().rotateY(Math.PI).translate(0, 0, 0), c, k])];
    const head = (x, z, yaw, y) => { // glowica z soczewkami na obu stronach
      const g = [[B(0.36, 1.05, 0.3), 0x1c2024, 'pl'], [B(0.56, 1.25, 0.03), 0x111315, 'pl'], [B(0.05, 0.25, 0.05, 0, 0.62, 0), 0x2b3033, 'mt']];
      for (const s of [-1, 1]) for (const [ly, c] of [[0.32, 0x3a0e0b], [0, 0x3a2c08], [-0.32, 0x0b3a1a]]) g.push([C(0.105, 0.105, 0.02, 0, 0, 0, 10).rotateX(Math.PI / 2).translate(0, ly, s * 0.155), c, 'gl'], [B(0.26, 0.03, 0.15, 0, ly + 0.14, s * 0.23), 0x1c2024, 'pl']);
      for (const [gg, c, k] of g) parts.push([gg.rotateY(yaw).translate(x, y, z), c, k]);
    };
    head(-3.9, 0, 0, 5.35); head(-7.6, 0, 0, 5.35); head(0, -6.0, Math.PI / 2, 4.95);
    // przycisk i sygnalizator dla pieszych (pomaranczowa reka)
    parts.push([B(0.34, 0.34, 0.26, 0.2, 2.75, 0.0), 0x1c2024, 'pl'], [B(0.24, 0.24, 0.01, 0.2, 2.75, 0.135), 0xff7a1a, 'hand'], [B(0.34, 0.34, 0.26, 0, 2.75, 0.2).rotateY(0), 0x1c2024, 'pl'], [B(0.01, 0.24, 0.24, 0.175, 2.75, 0.2), 0xff7a1a, 'hand']);
    const arm = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 8.2, 0), new THREE.Vector3(-0.1, 9.1, 0), new THREE.Vector3(-2.3, 9.1, 0)), 8, 0.055, 5, false);
    parts.push([arm, 0x2b3033, 'mt']);
    T.sigPole = tpl(parts); }
  // rusztowanie nad chodnikiem (sidewalk shed): jedno przeslo 2.4 m; lakier = ploty i daszek
  T.shedBay = tpl([[B(2.42, 0.2, 2.75, 0, 3.15, 1.375), 0x5d5848, 'm'], [B(2.42, 0.72, 0.06, 0, 3.6, 2.78), 0xffffff, 'p', 1], [B(2.42, 0.06, 0.12, 0, 3.98, 2.78), 0xffffff, 'p', 1],
    [B(0.12, 3.1, 0.12, -1.15, 1.55, 2.62), 0x56616b, 'mt'], [B(0.06, 0.95, 0.06, 0, 0, 0).rotateX(0).rotateZ(-0.75).translate(-0.82, 2.72, 2.62), 0x56616b, 'mt'],
    [B(2.42, 0.18, 0.12, 0, 2.97, 2.62), 0x56616b, 'mt'], [B(2.42, 0.14, 0.1, 0, 2.99, 0.12), 0x56616b, 'mt'], [B(0.4, 0.05, 0.14, 0, 3.02, 1.4), 0xfff4dc, 'light'],
    [B(0.12, 0.18, 0.12, -1.15, 0.09, 2.62), 0x2b2b2b, 'mt'], [B(0.5, 0.35, 0.02, rb(-0.6, 0.6), 3.62, 2.815), 0xe8e4d8, 'm']]);
  T.shedEnd = tpl([[B(0.12, 3.1, 0.12, 0, 1.55, 2.62), 0x56616b, 'mt'], [B(0.06, 0.72, 2.8, 0, 3.6, 1.4), 0xffffff, 'p', 1], [B(0.12, 0.18, 0.12, 0, 0.09, 2.62), 0x2b2b2b, 'mt']]);
  // szyldy wystajace z fasad: rama (napisy osobno, z tekstura)
  T.blade = tpl([[B(0.1, 2.5, 1.0, 0, 1.25, 0.72), 0x1b1c1f, 'mt'], [B(0.06, 0.06, 0.3, 0, 2.35, 0.1), 0x1b1c1f, 'mt'], [B(0.06, 0.06, 0.3, 0, 0.15, 0.1), 0x1b1c1f, 'mt']]);
  return T;
}

// ---------------------------------------------------------------- latarnie i sygnalizacja
export const lampList = [];          // [x, z, yaw] - glowice rysowane osobno (material lampy z miasto.js)
const poles = [];             // slupy z sygnalizacja: { x, z, i, j, st }
let lensMesh = null, lensGlow = null;
const CYC = 27;
// faza swiatel na skrzyzowaniu (i, j): "zielona fala" dzieki przesunieciu
const sigOff = (i, j) => ((i * 5 + j * 3) % 9) * 3;
function sigU(i, j) { return ((G.time + sigOff(i, j)) % CYC + CYC) % CYC; }
// 0 zielone, 1 zolte, 2 czerwone; os 'z' = aleje (ruch wzdluz z), 'x' = ulice
function sigState(i, j, ax) {
  const u = sigU(i, j);
  if (ax === 'z') return u < 10 ? 0 : u < 12.5 ? 1 : 2;
  return u >= 13.5 && u < 23.5 ? 0 : u >= 23.5 && u < 26 ? 1 : 2;
}
export function buildLampHeads(lampMat) {
  const g = Sph(0.5, 0, 0, 0, 1.0, 0.22, 0.42, 10, 6), lens = B(0.6, 0.04, 0.3, 0, -0.1, 0), geo = new THREE.BufferGeometry();
  const T = tpl([[g, 0xffffff], [lens, 0xffffff]]);
  geo.setAttribute('position', new THREE.BufferAttribute(T.p, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(T.n, 3)); geo.setIndex(new THREE.BufferAttribute(T.i, 1));
  const im = new THREE.InstancedMesh(geo, lampMat, lampList.length), o = new THREE.Object3D();
  lampList.forEach(([x, z, yaw, h], i) => { o.position.set(x + Math.cos(yaw) * 2.45, SW + h, z - Math.sin(yaw) * 2.45); o.rotation.set(0, yaw, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); });
  im.frustumCulled = false; im.receiveShadow = false; scene.add(im);
  glowPoints(lampList.flatMap(([x, z, yaw, h]) => [x + Math.cos(yaw) * 2.45, SW + h - 0.2, z - Math.sin(yaw) * 2.45]), 0xffc070, 7);
}
function buildSignals() {
  // soczewki, ktore swieca: po jednej na kazda strone kazdej glowicy (8 na slup); przesuwane przy zmianie swiatla
  const lg = C(0.11, 0.11, 0.03, 0, 0, 0, 10).rotateX(Math.PI / 2);
  lensMesh = new THREE.InstancedMesh(lg, new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true }), Math.max(1, poles.length * 8));
  lensMesh.material.userData.lin = true; lensMesh.userData.linIC = true;
  lensMesh.setColorAt(0, new THREE.Color(1, 1, 1)); lensMesh.frustumCulled = false; lensMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(lensMesh);
  lensGlow = glowPoints(new Array(Math.max(1, poles.length * 3) * 3).fill(0), 0xffffff, 2.4);
  lensGlow.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(Math.max(1, poles.length * 3) * 3), 3));
  lensGlow.material.vertexColors = true; lensGlow.material.needsUpdate = true;
  for (const p of poles) p.st = -1;
  updateSignals(true);
}
const SIGC = [[0.25, 3.2, 0.9], [3.2, 1.6, 0.12], [3.4, 0.22, 0.12]]; // zielone, zolte, czerwone (liniowo, mocne - dla poswiaty)
const GLOWC = [[0.3, 1, 0.5], [1, 0.62, 0.15], [1, 0.18, 0.1]];
function setLens(k, x, y, z, rotY, st) {
  const a = lensMesh.instanceMatrix.array, o = k * 16, c = Math.cos(rotY), s = Math.sin(rotY);
  a[o] = c; a[o + 1] = 0; a[o + 2] = -s; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = 1; a[o + 6] = 0; a[o + 7] = 0; a[o + 8] = s; a[o + 9] = 0; a[o + 10] = c; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  const ca = lensMesh.instanceColor.array; ca[k * 3] = SIGC[st][0]; ca[k * 3 + 1] = SIGC[st][1]; ca[k * 3 + 2] = SIGC[st][2];
}
function updateSignals(force) {
  if (!lensMesh) return;
  let dirty = false; const gp = lensGlow.geometry.attributes.position, gc = lensGlow.geometry.attributes.color;
  poles.forEach((p, n) => {
    const zs = sigState(p.i, p.j, 'z'), xs = sigState(p.i, p.j, 'x'), key = zs * 3 + xs;
    if (key === p.st && !force) return;
    p.st = key; dirty = true;
    const yz = SW + 5.35 + (zs === 2 ? 0.32 : zs === 1 ? 0 : -0.32), yx = SW + 4.95 + (xs === 2 ? 0.32 : xs === 1 ? 0 : -0.32);
    let k = n * 8;
    for (const hx of [-3.9, -7.6]) for (const s of [-1, 1]) setLens(k++, p.x + hx, yz, p.z + s * 0.165, 0, zs);
    for (const s of [-1, 1]) setLens(k++, p.x + s * 0.165, yx, p.z - 6.0, Math.PI / 2, xs);
    for (let q = 0; q < 2; q++) setLens(k++, 0, -50, 0, 0, 0); // zapas
    const g3 = n * 3;
    gp.setXYZ(g3, p.x - 3.9, yz, p.z); gp.setXYZ(g3 + 1, p.x - 7.6, yz, p.z); gp.setXYZ(g3 + 2, p.x, yx, p.z - 6.0);
    for (let q = 0; q < 3; q++) { const c = GLOWC[q < 2 ? zs : xs]; gc.setXYZ(g3 + q, c[0], c[1], c[2]); }
  });
  if (dirty) { lensMesh.instanceMatrix.needsUpdate = true; lensMesh.instanceColor.needsUpdate = true; gp.needsUpdate = true; gc.needsUpdate = true; }
}

// ---------------------------------------------------------------- szyldy z napisami (tekstura z kilkoma napisami)
const BLADES = [['HOTEL', '#7a1f2b', '#ffd9a0'], ['BAR', '#13233f', '#ff4f7a'], ['PIZZA', '#b8141c', '#fff2c0'], ['DELI', '#1a5e2c', '#ffffff'], ['CAFE', '#2a1d14', '#ffc46b'], ['BOOKS', '#15306e', '#f2e6c8'], ['LIQUOR', '#111111', '#4fd1ff'], ['DINER', '#c9c3b4', '#c0281f']];
function bladeTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  BLADES.forEach(([t, bg, fg], k) => {
    const X = (k % 4) * 128, Y = Math.floor(k / 4) * 256;
    x.fillStyle = bg; x.fillRect(X, Y, 128, 256);
    x.strokeStyle = fg; x.lineWidth = 5; x.strokeRect(X + 9, Y + 9, 110, 238);
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = fg; x.shadowBlur = 8;
    const n = t.length, fs = Math.min(64, 220 / n); x.font = `bold ${fs | 0}px Arial`;
    for (let q = 0; q < n; q++) x.fillText(t[q], X + 64, Y + 128 + (q - (n - 1) / 2) * fs * 0.98);
    x.shadowBlur = 0;
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
}
let bladeMat = null;
function buildBlades(list) { // list: [x, z, yaw, y, ci] ; yaw: lokalne +z = na zewnatrz sciany
  if (!list.length) return;
  const P = [], UV = [], N = [], I = [];
  for (const [x, z, yaw, y, ci] of list) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), u0 = (ci % 4) / 4, v0 = 1 - (Math.floor(ci / 4) + 1) / 2, v1 = v0 + 0.5;
    const W = (lx, ly, lz) => [x + lx * cs + lz * sn, y + ly, z - lx * sn + lz * cs];
    for (const s of [-1, 1]) {
      const o = P.length / 3, lx = s * 0.056;
      // patrzacy z boku s: napis czytany od sciany na zewnatrz albo odwrotnie
      const ua = s > 0 ? u0 + 0.25 : u0, ub = s > 0 ? u0 : u0 + 0.25;
      for (const [lz, ly, u, v] of [[0.27, 0.07, ua, v0], [1.17, 0.07, ub, v0], [1.17, 2.43, ub, v1], [0.27, 2.43, ua, v1]]) { P.push(...W(lx, ly, lz)); UV.push(u, v); N.push(s * cs, 0, -s * sn); }
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
  const t = bladeTex();
  bladeMat = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.5, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, bladeMat); m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m);
}

// ---------------------------------------------------------------- rozstawianie wszystkiego na chodnikach
const sheds = [];
export const inShed = (x, z) => sheds.some(s => x > s.x0 - 0.6 && x < s.x1 + 0.6 && z > s.z0 - 0.6 && z < s.z1 + 0.6);
export function buildStreet(blocks, trees) {
  PT = propTemplates();
  const occ = [], blades = [];
  const free = (x, z, r) => !occ.some(o => (x - o[0]) ** 2 + (z - o[1]) ** 2 < (r + o[2]) ** 2) && !doors.some(d => Math.hypot(x - d.gx, z - d.gz) < r + 1.0);
  const take = (x, z, r) => occ.push([x, z, r]);
  // kolko drzew na chodniku: drzewa z miasto.js (pit) + nowe
  for (const b of blocks) {
    const i = Math.round((b.x0 - X0 - ST / 2) / CX), j = Math.round((b.z0 - Z0 - ST / 2) / CZ), dk = distKey(i, j);
    const cx = (b.x0 + b.x1) / 2;
    const sides = [
      { len: BW, P: (t, ins) => [b.x0 + t, b.z0 + ins], yaw: Math.PI, ave: false },
      { len: BW, P: (t, ins) => [b.x0 + t, b.z1 - ins], yaw: 0, ave: false },
      { len: BD, P: (t, ins) => [b.x0 + ins, b.z0 + t], yaw: -Math.PI / 2, ave: true },
      { len: BD, P: (t, ins) => [b.x1 - ins, b.z0 + t], yaw: Math.PI / 2, ave: true },
    ];
    const put = (T, side, t, ins, r, opt = {}) => {
      const S = sides[side], [x, z] = S.P(t, ins);
      if (!opt.force && !free(x, z, r)) return false;
      take(x, z, r); place(Array.isArray(T) ? pick(T) : T, x, opt.road ? 0.02 : SW, z, S.yaw + (opt.yaw || 0), opt.tint ?? null); return [x, z];
    };
    // kraweznik z granitu (jasniejszy pas na krawedzi chodnika) i znaczniki dla niewidomych na rogach
    const k = 0.26, cc = 0xa8a397;
    boxAt(b.x0 - 0.02, b.x1 + 0.02, 0, SW + 0.012, b.z0 - 0.02, b.z0 + k, cc); boxAt(b.x0 - 0.02, b.x1 + 0.02, 0, SW + 0.012, b.z1 - k, b.z1 + 0.02, cc);
    boxAt(b.x0 - 0.02, b.x0 + k, 0, SW + 0.012, b.z0 + k, b.z1 - k, cc); boxAt(b.x1 - k, b.x1 + 0.02, 0, SW + 0.012, b.z0 + k, b.z1 - k, cc);
    for (const [px, pz, sx, sz] of [[b.x0, b.z0, 1, 1], [b.x1, b.z0, -1, 1], [b.x0, b.z1, 1, -1], [b.x1, b.z1, -1, -1]]) {
      boxAt(Math.min(px + sx * 1.6, px + sx * 2.8), Math.max(px + sx * 1.6, px + sx * 2.8), SW, SW + 0.016, Math.min(pz + sz * k, pz + sz * (k + 0.6)), Math.max(pz + sz * k, pz + sz * (k + 0.6)), 0x9c3b2a, 'm');
      boxAt(Math.min(px + sx * k, px + sx * (k + 0.6)), Math.max(px + sx * k, px + sx * (k + 0.6)), SW, SW + 0.016, Math.min(pz + sz * 1.6, pz + sz * 2.8), Math.max(pz + sz * 1.6, pz + sz * 2.8), 0x9c3b2a, 'm');
    }
    // narozniki: slup z sygnalizacja (NW, nad skrzyzowaniem i,j), latarnie na pozostalych rogach i w polowie ulic
    { const px = b.x0 + 0.6, pz = b.z0 + 0.6; place(PT.sigPole, px, SW, pz, 0); take(px, pz, 0.7); poles.push({ x: px, z: pz, i, j, st: -1 }); lampList.push([px, pz, Math.PI, 9.1]); }
    for (const [px, pz, yaw] of [[b.x1 - 0.6, b.z0 + 0.6, 0], [b.x0 + 0.6, b.z1 - 0.6, Math.PI], [b.x1 - 0.6, b.z1 - 0.6, 0], [cx + rb(-8, 8), b.z0 + 0.55, Math.PI / 2], [cx + rb(-8, 8), b.z1 - 0.55, -Math.PI / 2]]) {
      place(PT.lampPole, px, SW, pz, yaw); take(px, pz, 0.6); lampList.push([px, pz, yaw, 9.0]);
    }
    { const px = b.x1 - 0.6, pz = b.z1 - 1.9; place(PT.signPole, px, SW, pz, 0); take(px, pz, 0.4); }
    // drzewa w kratach: istniejace (z miasto.js) dostaja dolek; w srodmiesciu i na alejach dosadzamy nowe
    for (let q = trees.length - 1; q >= 0; q--) {
      const t = trees[q]; if (!t.pit || t.x < b.x0 || t.x > b.x1 || t.z < b.z0 || t.z > b.z1) continue;
      if (!free(t.x, t.z, 0.9)) { trees.splice(q, 1); continue; }
      take(t.x, t.z, 0.9); place(rr() < 0.4 ? PT.pitFence : PT.pit, t.x, SW, t.z, 0);
    }
    for (let s = 0; s < 4; s++) {
      const S = sides[s], p = S.ave ? 0.3 : (dk === 'mid' || dk === 'fin' ? 0.35 : 0.12);
      if (rr() > p) continue;
      for (let t = 6 + rr() * 3; t < S.len - 5; t += rb(8, 11)) {
        const [x, z] = S.P(t, 1.1); if (!free(x, z, 0.9)) continue;
        take(x, z, 0.9); place(rr() < 0.4 ? PT.pitFence : PT.pit, x, SW, z, 0); trees.push({ x, y: SW, z, s: rb(1.4, 2.0), h: rb(2.2, 3.0), pit: 1 });
      }
    }
    // przy krawezniku
    put(PT.hydrant, Math.floor(rr() * 4), rb(5, 40), 0.6, 0.5, { tint: pick([0xb3261e, 0xb3261e, 0xb3261e, 0xc9a227, 0x9aa0a6, 0x2f6b3d]) });
    for (let s = 0; s < 4; s++) if (rr() < 0.55) { put(PT.trash, s, rr() < 0.5 ? rb(2.2, 3.5) : sides[s].len - rb(2.2, 3.5), 0.75, 0.4, { tint: pick([0x355e3b, 0x355e3b, 0x1e2124]) }); }
    if (rr() < 0.25) put(PT.bigbelly, Math.floor(rr() * 4), rb(3, 9), 0.7, 0.45);
    for (let s = 0; s < 2; s++) {
      if (rr() < 0.75) for (let n = 0; n < 1 + Math.floor(rr() * 2); n++) put(PT.meter, s, rb(8, BW - 8), 0.45, 0.3);
      if (rr() < 0.8) put(PT.noPark, s, rb(6, BW - 6), 0.35, 0.25, { yaw: Math.PI / 2 });
    }
    if (rr() < 0.4) put(PT.news, Math.floor(rr() * 4), rb(4, 8), 0.75, 1.3);
    if (rr() < 0.4) put(PT.mailbox, Math.floor(rr() * 4), rb(3, 7), 0.7, 0.45);
    if (rr() < 0.3) put(PT.phone, Math.floor(rr() * 4), rb(6, 30), 0.6, 0.45);
    if (rr() < 0.35) put(PT.bikes, Math.floor(rr() * 2), rb(12, BW - 12), 0.85, 1.7);
    if (rr() < 0.5) for (let n = 0; n < 1 + Math.floor(rr() * 2); n++) put(PT.bags, Math.floor(rr() * 4), rb(5, 38), 0.65, 0.9);
    if (rr() < 0.16) put(PT.kiosk, 2 + Math.floor(rr() * 2), rb(8, BD - 8), 0.95, 1.6, { tint: pick([0x2f4f3a, 0x5d6469, 0x2b2f33, 0x6b2a22]), yaw: Math.PI });
    if (rr() < 0.2) { const s = Math.floor(rr() * 4); put(PT.hotdog, s, rr() < 0.5 ? rb(4, 8) : sides[s].len - rb(4, 8), 1.0, 1.3, { tint: pick([0xf2c00f, 0x1f5fb0, 0xc0281f, 0x2f7a4a]), yaw: Math.PI }); }
    if (rr() < 0.14) put(PT.shelter, 2 + Math.floor(rr() * 2), rb(10, BD - 10), 1.0, 2.0);
    if (rr() < 0.12 && dk !== 'harlem') { const s = 2 + Math.floor(rr() * 2), t = rr() < 0.5 ? rb(6, 9) : BD - rb(6, 9); put(PT.subway, s, t, 1.05, 2.4, { yaw: rr() < 0.5 ? 0 : Math.PI }); }
    if (rr() < 0.08) put(PT.bench, Math.floor(rr() * 4), rb(8, 30), 2.4, 1.0);
    // przy budynkach: kontenery, skrzynki, kraty z para, slupki
    if (rr() < 0.45) { const s = Math.floor(rr() * 4); put(PT.dumpster, s, rb(6, sides[s].len - 6), 2.65, 1.3, { tint: pick([0x2f6b3d, 0x2c4f8a, 0x7a3a22, 0x3b3f44]), yaw: rr() < 0.5 ? 0 : Math.PI }); }
    if (rr() < 0.3) put(PT.crates, Math.floor(rr() * 4), rb(6, 38), 2.6, 0.9, { yaw: rr() * 6 });
    if (rr() < 0.55) { const s = Math.floor(rr() * 4), r = put(PT.grate, s, rb(6, sides[s].len - 6), 1.9, 1.5, { force: false }); if (r && rr() < 0.45) ventList.push({ x: r[0], z: r[1], y0: SW + 0.1 }); }
    if ((dk === 'mid' || dk === 'fin') && rr() < 0.5) { const s = Math.floor(rr() * 4), t0 = rb(8, sides[s].len - 16); for (let n = 0; n < 5; n++) put(PT.bollard, s, t0 + n * 1.6, 2.3, 0.25, { tint: pick([0x2a2c2f, 0x8c9196]) }); }
    // na jezdni: kominy pary, roboty drogowe (beczki, pacholki, plyta)
    if (rr() < 0.3) { const inX = rr() < 0.5, x = inX ? b.x0 + rr() * (b.x1 - b.x0) : (rr() < 0.5 ? b.x0 - 4.5 : b.x1 + 4.5), z = inX ? (rr() < 0.5 ? b.z0 - 4.5 : b.z1 + 4.5) : b.z0 + rr() * (b.z1 - b.z0); place(PT.vent, x, 0.02, z, 0); ventList.push({ x, z, y0: 1.5 }); }
    if (rr() < 0.14) { // roboty drogowe przy krawezniku alei (miedzy pasem a krawezniem)
      const east = rr() < 0.5, x = east ? b.x1 + 1.3 : b.x0 - 1.3, z0 = b.z0 + rb(6, 18);
      for (let n = 0; n < 4; n++) place(PT.barrel, x, 0.02, z0 + n * 2.6, rr() * 6);
      for (let n = 0; n < 5; n++) place(PT.cone, x + (east ? 0.9 : -0.9), 0.02, z0 - 2 + n * 2.6, 0);
      place(PT.plate, x + (east ? 0.6 : -0.6), 0.0, z0 + 4, rr() * 0.2);
    }
  }
  // fasady przy ulicy: rusztowania (sidewalk sheds), szyldy wystajace ze scian, przylacza strazackie
  for (const b of blocks) for (const f of footprints) {
    if (f.x0 < b.x0 - 0.1 || f.x1 > b.x1 + 0.1 || f.z0 < b.z0 - 0.1 || f.z1 > b.z1 + 0.1) continue;
    const faces = [];
    if (f.z0 - b.z0 < 4.5) faces.push({ w: f.z0, a0: f.x0, a1: f.x1, yaw: Math.PI, P: (a, d) => [a, f.z0 - d] });
    if (b.z1 - f.z1 < 4.5) faces.push({ w: f.z1, a0: f.x0, a1: f.x1, yaw: 0, P: (a, d) => [a, f.z1 + d] });
    if (f.x0 - b.x0 < 4.5) faces.push({ w: f.x0, a0: f.z0, a1: f.z1, yaw: -Math.PI / 2, P: (a, d) => [f.x0 - d, a] });
    if (b.x1 - f.x1 < 4.5) faces.push({ w: f.x1, a0: f.z0, a1: f.z1, yaw: Math.PI / 2, P: (a, d) => [f.x1 + d, a] });
    for (const F of faces) {
      const len = F.a1 - F.a0; if (len < 8) continue;
      if (f.h > 12 && rr() < 0.13) { // rusztowanie
        const L = Math.min(len - 2, rb(12, 32)), s0 = F.a0 + 1 + rr() * (len - 2 - L), nb = Math.max(2, Math.floor(L / 2.4)), tint = pick([0x2d4f37, 0x2d4f37, 0x3f5566, 0x30343a, 0x6b6f4a]);
        for (let k = 0; k < nb; k++) { const [x, z] = F.P(s0 + 1.2 + k * 2.4, 0); place(PT.shedBay, x, SW, z, F.yaw, tint); }
        const aEnd = s0 + nb * 2.4, [ex, ez] = F.P(aEnd, 0), [sx, sz] = F.P(s0, 0);
        place(PT.shedEnd, ex, SW, ez, F.yaw, tint); place(PT.shedEnd, sx, SW, sz, F.yaw, tint);
        const [p0x, p0z] = F.P(s0, 0), [p1x, p1z] = F.P(aEnd, 2.85);
        const box = { x0: Math.min(p0x, p1x), x1: Math.max(p0x, p1x), z0: Math.min(p0z, p1z), z1: Math.max(p0z, p1z) };
        sheds.push(box); addBox({ ...box, y0: SW + 3.04, y1: SW + 3.26 });
      }
      if (rr() < 0.3) { // szyld wystajacy ze sciany
        const a = F.a0 + rb(2, len - 2), [x, z] = F.P(a, 0);
        if (!doors.some(d => Math.hypot(x - d.x, z - d.z) < 2.5)) { const y = SW + rb(5.4, 7.5); place(PT.blade, x, y, z, F.yaw); blades.push([x, z, F.yaw, y, Math.floor(rr() * BLADES.length)]); }
      }
      if (rr() < 0.35) { const a = F.a0 + (rr() < 0.5 ? rb(1.2, 2.5) : len - rb(1.2, 2.5)), [x, z] = F.P(a, 0); place(PT.siamese, x, SW, z, F.yaw); }
    }
  }
  // lawki w parku
  for (let k = 0; k < 14; k++) { const x = PK.x0 + (k % 2 ? 42 : 196) + 3, z = PK.z0 + 20 + k * 25; if (z < PK.z1 - 10) place(PT.bench, x, 0.06, z, k % 2 ? -Math.PI / 2 : Math.PI / 2); }
  buildBlades(blades);
  flushStatics();
  buildSignals();
}

// ---------------------------------------------------------------- pojazdy (modele w auta.js)
// konfiguracja klas: udzialy w ruchu (mv) i wsrod zaparkowanych (pk), palety lakieru, szerokosc (hw) do kolizji zaparkowanych
const TAXI = [0xf7b500, 0xf2b10a, 0xf5b800];
const CARC = [0x1d1f24, 0x1d1f24, 0xe9e9e9, 0xe9e9e9, 0x8a1a1a, 0x2a4d8a, 0x6c6f75, 0x234a2f, 0xb0b3b8, 0x3a3d42, 0x5a1d24, 0xc9c3b4, 0x0f2440, 0x7b3a1c, 0x4b6a8c, 0xa99572];
const SUVC = [0x16181c, 0x16181c, 0x2a2c30, 0xe5e5e5, 0x3b4048, 0x1c2a40, 0x5b5e63, 0x6e1f22, 0x2d3b2f];
const TRKC = [0xb8261f, 0x1f4f9c, 0x2f7a4a, 0x4a3222, 0xe2e2e2, 0xf2c00f];
const VCFG = {
  taxi: { mv: 0.30, pk: 0.05, cols: TAXI, hw: 1.0 }, sedan: { mv: 0.13, pk: 0.2, cols: CARC, hw: 0.92 }, hatch: { mv: 0.07, pk: 0.12, cols: CARC, hw: 0.9 },
  crown: { mv: 0.05, pk: 0.11, cols: CARC, hw: 1.0 }, cross: { mv: 0.08, pk: 0.13, cols: SUVC, hw: 0.95 }, suv: { mv: 0.12, pk: 0.2, cols: SUVC, hw: 1.02 },
  van: { mv: 0.05, pk: 0.04, cols: [0x5b3a22, 0x5b3a22, 0x5b3a22, 0xe9e9e9, 0x1f3a5c, 0x6c6f75], hw: 1.04 }, truck: { mv: 0.035, pk: 0.02, cols: TRKC, hw: 1.2 },
  police: { mv: 0.035, pk: 0.02, cols: [0xffffff], hw: 1.0 }, ambulance: { mv: 0.008, pk: 0, cols: [0xf6f6f6, 0xf0f0ea], hw: 1.04 }, fire: { mv: 0.004, pk: 0, cols: [0xb8141c, 0xa8120f], hw: 1.25 },
  garbage: { mv: 0.014, pk: 0.005, cols: [0x2f7a4a, 0x3d8a55, 0x1f5e8a, 0xe2e2e2], hw: 1.22 }, pizza: { mv: 0.014, pk: 0.02, cols: CARC, hw: 0.9 }, limo: { mv: 0.012, pk: 0.006, cols: [0x0e0e10, 0x1b1b1f, 0xf0f0f0], hw: 1.0 },
  moto: { mv: 0.02, pk: 0.04, cols: [0xc9281f, 0x1f4f9c, 0x16181c, 0xe9e9e9, 0xe0a11a], hw: 0.4 }, bus: { mv: 0, pk: 0, cols: [0x1f57a8], hw: 1.32 },
};
const PASS = ['sedan', 'hatch', 'crown', 'cross', 'suv', 'taxi', 'police', 'pizza', 'limo', 'van']; // lekka zmiennosc wymiarow
function vehTemplates() {
  const T = {};
  for (const k in VCFG) { const r = vehParts(k); const t = tpl(r.p); let hl = r.hl; T[k] = { t, hl }; }
  return T;
}
function wpick(key) { let q = 0; for (const k in VCFG) q += VCFG[k][key]; q *= rr(); for (const k in VCFG) { q -= VCFG[k][key]; if (q <= 0) return k; } return 'sedan'; }

const lanes = [], parked = [];
let hornT = 0;
let VT = null, vehMat = null, headL = null, tailL = null, nMoving = 0;
function mkVeh(type, extra) {
  const v = { type, hl: VT[type].hl, v: 0, brake: 0, x: 0, z: 0, yaw: 0, sc: [1, 1, 1], ...extra };
  if (PASS.includes(type)) v.sc = [rb(0.98, 1.03), rb(0.97, 1.04), rb(0.97, 1.03)];
  v.hl *= v.sc[2]; v.hw = VCFG[type].hw * v.sc[0];
  const hex = pick(VCFG[type].cols);
  v.col = new THREE.Color(hex).convertSRGBToLinear();
  return v;
}
export function initCars() {
  VT = vehTemplates();
  for (let i = 0; i <= NX; i++) { const x = X0 + i * CX; for (const [o, d] of [[-2.0, 1], [-5.6, 1], [2.0, -1], [5.6, -1]]) lanes.push({ ax: 'z', c: x + o, dir: d, i, curb: Math.abs(o) > 4, len: CD + 20, st: Z0 - 10, list: [] }); }
  for (let j = 0; j <= NZ; j++) { const z = Z0 + j * CZ; lanes.push({ ax: 'x', c: z + 3.6, dir: 1, j, len: CW + 20, st: X0 - 10, list: [] }, { ax: 'x', c: z - 3.6, dir: -1, j, len: CW + 20, st: X0 - 10, list: [] }); }
  for (const L of lanes) {
    const n = L.ax === 'z' ? 4 + Math.floor(rr() * 3) : 2 + Math.floor(rr() * 2), types = [];
    for (let k = 0; k < n; k++) types.push(wpick('mv'));
    if (L.curb && rr() < 0.55) types[Math.floor(rr() * n)] = 'bus';
    types.forEach((t, k) => {
      const v = mkVeh(t, { L, s: (k / n) * L.len + rb(0, L.len / n * 0.3) });
      v.vmax = t === 'bus' ? rb(8, 10) : t === 'truck' ? rb(9, 11.5) : t === 'garbage' ? rb(7.5, 9.5) : t === 'fire' ? rb(9, 11) : t === 'moto' || t === 'police' || t === 'ambulance' ? rb(12, 16) : rb(10.5, 14.5); v.v = v.vmax * rr();
      L.list.push(v);
    });
    L.list.sort((a, b) => a.s - b.s);
  }
  nMoving = lanes.reduce((a, L) => a + L.list.length, 0);
  // zaparkowane wzdluz ulic (przy obu kraweznikach)
  for (let j = 0; j <= NZ; j++) for (let i = 0; i < NX; i++) for (const side of [-1, 1]) {
    const z = Z0 + j * CZ + side * 7.35, xa = X0 + i * CX + 14, xb = X0 + (i + 1) * CX - 14;
    if (inPark((xa + xb) / 2, z) || (j === 0 && side < 0) || (j === NZ && side > 0)) continue;
    for (let x = xa + rb(0, 3); x < xb - 2.5;) {
      const t = wpick('pk'), v = mkVeh(t);
      if (x + 2 * v.hl > xb) break;
      if (rr() < 0.72) { v.x = x + v.hl; v.z = z + rb(-0.12, 0.12); v.yaw = side > 0 ? Math.PI / 2 : -Math.PI / 2; parked.push(v); addBox({ x0: v.x - v.hl, x1: v.x + v.hl, y0: 0, y1: 1.5, z0: v.z - v.hw, z1: v.z + v.hw }); }
      x += 2 * v.hl + rb(0.9, 2.6);
    }
  }
  // instancje: po jednym rysowaniu na typ pojazdu
  vehMat = streetMat(true);
  const cap = {}; for (const k in VT) cap[k] = 0;
  for (const L of lanes) for (const v of L.list) cap[v.type]++;
  for (const v of parked) cap[v.type]++;
  for (const k in VT) cap[k] += 3; // zapas na pojazdy ustawiane przez debugPlace
  for (const k in VT) {
    const g = tplGeo(VT[k].t), n = Math.max(1, cap[k]);
    const ab = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); ab.setUsage(THREE.DynamicDrawUsage); g.setAttribute('aBrake', ab);
    const m = new THREE.InstancedMesh(g, vehMat, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1)); m.instanceColor.setUsage(THREE.DynamicDrawUsage);
    m.userData.linIC = true; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true; m.count = 0; scene.add(m);
    VT[k].mesh = m;
  }
  headL = glowPoints(new Array(nMoving * 4 * 3).fill(0), 0xfff2d0, 1.5); // poswiata na kazdej lampie (do 4 na auto), nie jeden punkt na srodku
  tailL = glowPoints(new Array(nMoving * 4 * 3).fill(0), 0xff2020, 1.1);
}
// ruch na jednym pasie: trzymanie odstepu i zatrzymywanie przed linia na czerwonym
const parkIsec = (i, j) => inPark(X0 + i * CX, Z0 + j * CZ);
function stepLane(L, dt) {
  const n = L.list.length, Q0 = L.ax === 'z' ? Z0 : X0, Q = L.ax === 'z' ? CZ : CX, NQ = L.ax === 'z' ? NZ : NX;
  for (let k = 0; k < n; k++) {
    const c = L.list[k], ld = L.list[(k + 1) % n];
    let gap = n > 1 ? ((ld.s - c.s) % L.len + L.len) % L.len - ld.hl - c.hl : 1e9;
    const p = L.dir > 0 ? L.st + c.s : L.st + L.len - c.s, front = p + L.dir * c.hl;
    // gracz na jezdni przed autem (albo w nim): auto hamuje jak przed innym pojazdem
    let blockP = false;
    if (P.pos.y < 3.2 && P.state !== 'car' && !P.dead) {
      const along = L.ax === 'z' ? P.pos.z : P.pos.x, lat = (L.ax === 'z' ? P.pos.x : P.pos.z) - L.c, dP = (along - front) * L.dir;
      if (Math.abs(lat) < 1.2 * c.sc[0] + 0.55 && dP > -2 * c.hl - 0.6 && dP < 40 && dP - 0.45 < gap) { gap = dP - 0.45; blockP = true; }
    }
    let vt = c.vmax;
    const k2 = L.dir > 0 ? Math.ceil((front - 0.5 + 13.5 - Q0) / Q) : Math.floor((front + 0.5 - 13.5 - Q0) / Q);
    if (k2 >= 0 && k2 <= NQ) {
      const q = Q0 + k2 * Q, dS = L.dir > 0 ? (q - 13.5) - front : front - (q + 13.5);
      const ii = L.ax === 'z' ? L.i : k2, jj = L.ax === 'z' ? k2 : L.j;
      if (dS < 70 && !parkIsec(ii, jj)) {
        const st = sigState(ii, jj, L.ax);
        if (st === 2 || (st === 1 && dS > c.v * c.v / 9 + 1.5)) vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 4.5 * (dS - 0.4))));
      }
    }
    vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 4.5 * (gap - 2.4))));
    const was = c.v;
    c.v = vt > c.v ? Math.min(vt, c.v + 2.8 * dt) : Math.max(vt, c.v - 9 * dt);
    c.v = Math.max(0, Math.min(c.v, (gap - 1.2) / Math.max(dt, 1e-3)));
    if (blockP && c.v < 0.8 && hornT <= 0) { hornT = 3 + Math.random() * 3; sfx('horn', 0.5); say('carstop'); }
    const br = c.v < was - 0.01 || c.v < 0.4 ? 1 : 0; c.brake += (br - c.brake) * Math.min(1, dt * 8);
    c.s += c.v * dt; if (c.s >= L.len) c.s -= L.len;
    const pp = L.dir > 0 ? L.st + c.s : L.st + L.len - c.s;
    if (L.ax === 'z') { c.x = L.c; c.z = pp; c.yaw = L.dir > 0 ? 0 : Math.PI; } else { c.z = L.c; c.x = pp; c.yaw = L.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  }
  // po przeskoku na poczatek pasa kolejnosc na liscie zostaje cykliczna - nic nie trzeba sortowac
}
function writeInst(m, k, v) {
  const a = m.instanceMatrix.array, o = k * 16, c = Math.cos(v.yaw), s = Math.sin(v.yaw), [sx, sy, sz] = v.sc;
  a[o] = c * sx; a[o + 1] = 0; a[o + 2] = -s * sx; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = s * sz; a[o + 9] = 0; a[o + 10] = c * sz; a[o + 11] = 0; a[o + 12] = v.x; a[o + 13] = 0; a[o + 14] = v.z; a[o + 15] = 1;
  const ca = m.instanceColor.array; ca[k * 3] = v.col.r; ca[k * 3 + 1] = v.col.g; ca[k * 3 + 2] = v.col.b;
  m.geometry.attributes.aBrake.array[k] = v.brake;
}
const _f = new THREE.Vector3();
export function updateCars(dt) {
  if (!VT) return;
  dt = Math.min(dt, 0.1); hornT -= dt; U.time.value += dt;
  U.lamp.value = LAMPS[todName] ?? 0.6;
  if (bladeMat) bladeMat.emissiveIntensity = 0.12 + U.lamp.value * 1.3;
  updateSignals(false);
  for (const L of lanes) stepLane(L, dt);
  // rysujemy tylko pojazdy blisko kamery i nie za nia
  camera.getWorldDirection(_f); const fl = Math.hypot(_f.x, _f.z) || 1, fx = _f.x / fl, fz = _f.z / fl;
  const cx = camera.position.x, cz = camera.position.z, hiCam = camera.position.y > 60;
  const R1 = hiCam ? 600 : 420, R2 = hiCam ? 320 : 230;
  for (const k in VT) VT[k].mesh.count = 0;
  const hp = headL.geometry.attributes.position, tp = tailL.geometry.attributes.position; let nh = 0, nt = 0; const hMax = nMoving * 4;
  const vis = (v, R) => { const dx = v.x - cx, dz = v.z - cz, d2 = dx * dx + dz * dz; return d2 < R * R && (d2 < 400 || dx * fx + dz * fz > -15); };
  for (const L of lanes) for (const v of L.list) {
    if (inPark(v.x, v.z) || !vis(v, R1)) continue;
    const m = VT[v.type].mesh; writeInst(m, m.count++, v);
    // poswiata przyklejona do prawdziwych lamp auta: pozycja lampy w ukladzie auta -> swiat (obrot i skala), kawalek przed szybka
    const c = Math.cos(v.yaw), sn = Math.sin(v.yaw), kx = v.sc[0], ky = v.sc[1], kz = v.sc[2], LP = VT[v.type].t.lamps;
    for (const [lx, ly, lz] of LP.head) { if (nh >= hMax) break; const z0 = lz + 0.1; hp.setXYZ(nh++, v.x + c * kx * lx + sn * kz * z0, ly * ky, v.z - sn * kx * lx + c * kz * z0); }
    for (const [lx, ly, lz] of LP.tail) { if (nt >= hMax) break; const z0 = lz - 0.1; tp.setXYZ(nt++, v.x + c * kx * lx + sn * kz * z0, ly * ky, v.z - sn * kx * lx + c * kz * z0); }
  }
  for (const v of parked) { if (!vis(v, R2)) continue; const m = VT[v.type].mesh; writeInst(m, m.count++, v); }
  for (const k in VT) { const m = VT[k].mesh; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; m.geometry.attributes.aBrake.needsUpdate = true; }
  headL.geometry.setDrawRange(0, nh); tailL.geometry.setDrawRange(0, nt); hp.needsUpdate = tp.needsUpdate = true;
}
// stan swiatla dla innych modulow (np. przechodnie na pasach)
export const signalAt = sigState;

// diagnostyka testow: dostep do pasow ruchu
export const debugLanes = () => lanes;

// diagnostyka: ustawienie zaparkowanego pojazdu danego typu (testy wygladu)
export const debugParked = () => parked;
export function debugPlace(type, x, z, yaw, col) { const v = mkVeh(type); v.x = x; v.z = z; v.yaw = yaw; if (col !== undefined) v.col = new THREE.Color(col).convertSRGBToLinear(); parked.push(v); return v; }
