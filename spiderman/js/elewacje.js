// Szczegoly powierzchni elewacji: tekstury detalu (cegla z fugami, kamien, beton z szalunkiem, tynk, szklo),
// ich domieszanie w shaderze (onBeforeCompile), faktura dachow, rdza zelaza. Wszystko rysowane w kodzie.
import { cv } from './util.js';

// ---------------------------------------------------------------- narzedzia (deterministyczne, bez Math.random)
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash2(a, b, s) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
// szum wartosciowy, powtarzalny (kafelkowalny): siatka cx x cy komorek rozciagnieta na w x h
function vnoise(w, h, cx, cy, seed) {
  const R = rng(seed), g = new Float32Array(cx * cy); for (let i = 0; i < g.length; i++) g[i] = R();
  const o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / h * cy, y0 = Math.floor(fy), ty = fy - y0, sy = ty * ty * (3 - 2 * ty), r0 = (y0 % cy) * cx, r1 = ((y0 + 1) % cy) * cx;
    for (let x = 0; x < w; x++) {
      const fx = x / w * cx, x0 = Math.floor(fx), tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % cx;
      const a = g[r0 + x0] + (g[r0 + x1] - g[r0 + x0]) * sx, b = g[r1 + x0] + (g[r1 + x1] - g[r1 + x0]) * sx;
      o[y * w + x] = a + (b - a) * sy;
    }
  }
  return o;
}
function fbm(w, h, cx, cy, oct, seed) {
  const o = new Float32Array(w * h); let amp = 1, tot = 0;
  for (let k = 0; k < oct; k++) { const n = vnoise(w, h, cx << k, cy << k, seed + k * 17); for (let i = 0; i < o.length; i++) o[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < o.length; i++) o[i] /= tot;
  return o;
}
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
let GR = null, LO = null; // ziarno 256^2 (drobny szum) i niska czestotliwosc 256^2
function grain() { if (!GR) { GR = fbm(256, 256, 8, 8, 4, 101); LO = fbm(256, 256, 3, 3, 3, 202); } return GR; }
const G = (x, y) => GR[((y & 255) << 8) | (x & 255)];
function low(x, y, N) { // dwuliniowo z tablicy niskich czestotliwosci, x,y w pikselach tekstury N
  const u = x / N * 256, v = y / N * 256, x0 = Math.floor(u), y0 = Math.floor(v), tx = u - x0, ty = v - y0;
  const a = LO[((y0 & 255) << 8) | (x0 & 255)], b = LO[((y0 & 255) << 8) | ((x0 + 1) & 255)], c = LO[(((y0 + 1) & 255) << 8) | (x0 & 255)], d = LO[(((y0 + 1) & 255) << 8) | ((x0 + 1) & 255)];
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
function newImg(N) { const c = cv(N, N), x = c.getContext('2d'); return { c, x, img: x.createImageData(N, N), N }; }
function put(I, px, py, t, m, h) { // R = ton (0.5 = bez zmian), G = maska fugi/spoiny, B = wysokosc
  const N = I.N, k = ((py & (N - 1)) * N + (px & (N - 1))) * 4, d = I.img.data;
  d[k] = t < 0 ? 0 : t > 1 ? 255 : t * 255; d[k + 1] = m < 0 ? 0 : m > 1 ? 255 : m * 255; d[k + 2] = h < 0 ? 0 : h > 1 ? 255 : h * 255; d[k + 3] = 255;
}
function addPx(I, px, py, dt, dm, dh) { // dodaje do istniejacego piksela (pekniecia, zadrapania)
  const N = I.N, k = ((py & (N - 1)) * N + (px & (N - 1))) * 4, d = I.img.data;
  d[k] = Math.max(0, Math.min(255, d[k] + dt * 255)); d[k + 1] = Math.max(0, Math.min(255, d[k + 1] + dm * 255)); d[k + 2] = Math.max(0, Math.min(255, d[k + 2] + dh * 255));
}
function finish(I) {
  I.x.putImageData(I.img, 0, 0);
  const t = new THREE.CanvasTexture(I.c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; // kodowanie liniowe: dane, nie kolor
  return t;
}
// losowe pekniecie (wedrowka): pionowe, z wahaniem; ogranicza sie do bloku [bx0,bx1) x [by0,by1)
function crack(I, R, bx0, bx1, by0, by1, depth) {
  let x = bx0 + (bx1 - bx0) * (0.2 + R() * 0.6), y = by0 + 2, a = Math.PI / 2 + (R() - 0.5) * 0.9;
  const n = (by1 - by0) * (0.5 + R() * 0.6);
  for (let i = 0; i < n; i++) {
    a += (R() - 0.5) * 0.5; x += Math.cos(a) * 1.2; y += Math.sin(a) * 1.2;
    if (x < bx0 + 1 || x > bx1 - 1 || y > by1 - 1) break;
    const px = Math.round(x), py = Math.round(y);
    addPx(I, px, py, -0.3 * depth, 0.12 * depth, -0.5 * depth); addPx(I, px + 1, py, -0.1 * depth, 0.04 * depth, -0.2 * depth);
  }
}

// ---------------------------------------------------------------- tekstury detalu
function brickDetail(N = 1024) {
  grain(); const I = newImg(N), cols = 20, rows = 64, bw = N / cols, bh = N / rows;
  for (let y = 0; y < N; y++) {
    const row = Math.floor(y / bh), yy = y - row * bh, off = (row & 1) * bw / 2;
    for (let x = 0; x < N; x++) {
      const xo = (x + off) % N, col = Math.floor(xo / bw), xx = xo - col * bw;
      const e = Math.min(xx, bw - xx, (yy < bh - yy ? yy : bh - yy) * 1.15); // odleglosc od krawedzi cegly
      const gi = G(x + col * 37, y + row * 53), gj = G(x * 3 + row * 11, y * 3 + col * 29);
      const mortar = 1 - sstep(1.0, 2.8, e);
      const hb = hash2(col, row, 7), hc = hash2(col, row, 8);
      let t = 0.5 + (hb - 0.5) * 0.24 - (hc < 0.07 ? 0.1 : hc > 0.95 ? -0.08 : 0) + (gi - 0.5) * 0.2 + (gj - 0.5) * 0.08 + (yy / bh - 0.5) * 0.03;
      let h = 0.62 + (gi - 0.5) * 0.3 + sstep(1.5, 5, e) * 0.14;
      if (gi > 0.78 && gj > 0.55) { t -= 0.1; h -= 0.18; } // dolki i odpryski
      t = t * (1 - mortar) + (0.5 + (gj - 0.5) * 0.35) * mortar;
      h = h * (1 - mortar) + (0.16 + gj * 0.14) * mortar;
      put(I, x, y, t, mortar * (0.92 + gj * 0.08), h);
    }
  }
  return finish(I);
}
function stoneDetail(N = 1024) {
  grain(); const I = newImg(N), R = rng(9);
  const hs = []; let sum = 0; while (sum < 1) { const v = 0.09 + R() * 0.09; hs.push(v); sum += v; } // wysokosci warstw (kamien ciosany)
  const courses = []; let y0 = 0; for (const v of hs) { const h0 = Math.round(y0 * N), h1 = Math.min(N, Math.round((y0 + v / sum) * N)); if (h1 > h0) courses.push([h0, h1]); y0 += v / sum; }
  const blocks = courses.map(([a, b], ci) => { const ed = [0]; let x = R() * 120; const o = [x]; while (x < N - 80) { x += 160 + R() * 200; o.push(Math.min(N, x)); } o[o.length - 1] = N; return o; });
  courses.forEach(([ya, yb], ci) => {
    const ed = blocks[ci];
    for (let bi = 0; bi < ed.length - 1; bi++) {
      const xa = ed[bi], xb = ed[bi + 1], hb = hash2(ci, bi, 3), tone = 0.5 + (hb - 0.5) * 0.2;
      for (let y = ya; y < yb; y++) for (let x = Math.floor(xa); x < xb; x++) {
        const e = Math.min(x - xa + 0.5, xb - x - 0.5, y - ya + 0.5, yb - y - 0.5), joint = 1 - sstep(0.8, 3.0, e);
        const strata = G(Math.floor(x / 9), y * 2 + ci * 7), gi = G(x, y + ci * 31), l = low(x, y, N);
        let t = tone + (strata - 0.5) * 0.2 + (gi - 0.5) * 0.12 + (l - 0.5) * 0.18;
        let h = 0.66 + (gi - 0.5) * 0.26 + (strata - 0.5) * 0.12 + sstep(1, 4, e) * 0.1;
        if (gi > 0.84) { t -= 0.1; h -= 0.2; } // wżery
        t = t * (1 - joint) + (0.42 + (gi - 0.5) * 0.15) * joint; h = h * (1 - joint) + 0.14 * joint;
        put(I, x, y, t, joint, h);
      }
      if (hb > 0.72) crack(I, R, xa, xb, ya, yb, 1); // niektore bloki pekniete
      if (hb < 0.08) crack(I, R, xa, xb, ya, yb, 0.7);
    }
  });
  return finish(I);
}
function concreteDetail(N = 1024) {
  grain(); const I = newImg(N), R = rng(21), pw = N / 4, ph = N / 2;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const pxx = x % pw, pyy = y % ph, pi = Math.floor(x / pw), pj = Math.floor(y / ph);
    const e = Math.min(pxx, pw - pxx, pyy, ph - pyy), seam = 1 - sstep(0.8, 2.6, e);
    const gi = G(x, y), gj = G(x * 2 + 5, y * 2 + 9), l = low(x, y, N), vs = G(Math.floor(x / 2), 7); // pionowe smugi
    let t = 0.5 + (hash2(pi, pj, 5) - 0.5) * 0.08 + (l - 0.5) * 0.3 + (gi - 0.5) * 0.12 + (vs - 0.5) * 0.05 * (0.4 + low(x * 0.3, y * 0.05, N));
    let h = 0.55 + (gi - 0.5) * 0.18 + (l - 0.5) * 0.1;
    if (gj > 0.9) { t -= 0.12; h -= 0.25; } // pory powietrza
    t = t * (1 - seam * 0.7) + 0.32 * seam * 0.7; h = h * (1 - seam) + 0.2 * seam;
    put(I, x, y, t, seam * 0.9, h);
  }
  // otwory po kotwach szalunku
  const hx = [pw * 0.25, pw * 0.75], hy = [ph * 0.18, ph * 0.5, ph * 0.82];
  for (let pj = 0; pj < 2; pj++) for (let pi = 0; pi < 4; pi++) for (const ax of hx) for (const ay of hy)
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) { const r = Math.hypot(dx, dy); if (r < 4.2) addPx(I, pi * pw + ax + dx, pj * ph + ay + dy, -0.25 * (1 - r / 5), 0.3, -0.4 * (1 - r / 5)); else if (r < 6) addPx(I, pi * pw + ax + dx, pj * ph + ay + dy, -0.06, 0, 0.05); }
  return finish(I);
}
function plasterDetail(N = 1024) {
  grain(); const I = newImg(N), R = rng(33);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gi = G(x, y), gj = G(x * 2 + 3, y * 2 + 1), l = low(x, y, N);
    put(I, x, y, 0.5 + (l - 0.5) * 0.22 + (gi - 0.5) * 0.1 + (gj - 0.5) * 0.06, 0, 0.5 + (gi - 0.5) * 0.5 + (gj - 0.5) * 0.2);
  }
  for (let i = 0; i < 520; i++) { // zdrapania i rysy
    let x = R() * N, y = R() * N, a = R() * 6.28; const n = 8 + R() * 36;
    for (let k = 0; k < n; k++) { a += (R() - 0.5) * 0.15; x += Math.cos(a); y += Math.sin(a); addPx(I, Math.round(x), Math.round(y), 0.2, 0.0, -0.3); }
  }
  for (let i = 0; i < 34; i++) { // ubytki tynku: widac cegle pod spodem
    const cx = R() * N, cy = R() * N, rx = 6 + R() * 26, ry = 6 + R() * 22, rot = R() * 3;
    for (let dy = -ry * 1.6; dy <= ry * 1.6; dy++) for (let dx = -rx * 1.6; dx <= rx * 1.6; dx++) {
      const ux = dx * Math.cos(rot) + dy * Math.sin(rot), uy = -dx * Math.sin(rot) + dy * Math.cos(rot);
      const d = Math.hypot(ux / rx, uy / ry) + (G(Math.round(cx + dx), Math.round(cy + dy)) - 0.5) * 0.5;
      if (d < 1) addPx(I, Math.round(cx + dx), Math.round(cy + dy), 0, d < 0.85 ? 1 : 0.5, d < 0.85 ? -0.3 : -0.1);
    }
  }
  return finish(I);
}
function glassDetail(N = 512) {
  grain(); const I = newImg(N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const gi = G(x, y), l = low(x, y, N), band = G(Math.floor(x / 32) * 11, 3);
    put(I, x, y, 0.5 + (l - 0.5) * 0.16 + (gi - 0.5) * 0.06 + (band - 0.5) * 0.05, 0, 0.5 + (gi - 0.5) * 0.2);
  }
  return finish(I);
}
// wspolna tekstura szumu: R = ton wielkoskalowy, G = pionowe smugi po deszczu, B = szum sredni
function noiseTex() {
  grain(); const N = 512, I = newImg(N), a = fbm(N, N, 3, 3, 4, 301), b = fbm(N, N, 6, 6, 3, 302), mv = vnoise(N, N, 2, 3, 303), sx = vnoise(N, 1, 96, 1, 304), sy = vnoise(N, 1, 20, 1, 305);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const s = clamp01((sx[x] * 0.6 + sy[x] * 0.4 - 0.5) * 3.2), m = clamp01((mv[y * N + x] - 0.3) * 1.8);
    put(I, x, y, a[y * N + x], s * (0.3 + 0.7 * m) * (0.7 + 0.3 * (1 - y / N * 0.4)), b[y * N + x]);
  }
  return finish(I);
}

let _tex = null;
export function detailTex(kind) {
  if (!_tex) _tex = { noise: noiseTex() };
  if (!_tex[kind]) _tex[kind] = { brick: brickDetail, stone: stoneDetail, concrete: concreteDetail, plaster: plasterDetail, glass: glassDetail }[kind]();
  return _tex[kind];
}
// parametry rodzajow: k = ile razy tekstura detalu powtarza sie na jednostke UV elewacji; bump = glebokosc reliefu [m]
function noiseOnly() { if (!_tex) _tex = { noise: noiseTex() }; return _tex.noise; }
export const DETAIL = {
  brick: { k: 3.4, bump: 0.012, mode: 0 }, stone: { k: 3.1, bump: 0.02, mode: 0 }, concrete: { k: 3.2, bump: 0.007, mode: 0 },
  plaster: { k: 2.5, bump: 0.004, mode: 0 }, glass: { k: 2.0, bump: 0.0, mode: 1 },
};
const lin = h => { const c = new THREE.Color(h); c.convertSRGBToLinear(); return new THREE.Vector3(c.r, c.g, c.b); };

// ---------------------------------------------------------------- shader: detal mnozony/zastepujacy kolor sciany, szorstkosc, wypuklosc
// o: { kind, wall, mort, str, mask, k }. Wygasa z odlegloscia (wypuklosc 30-90 m; kolor usrednia sie sam przez mipmapy).
export function detailPatch(m, o) {
  const D = DETAIL[o.kind], tex = detailTex(o.kind);
  const U = {
    uDet: { value: tex }, uDNoise: { value: _tex.noise }, uDK: { value: new THREE.Vector2(o.k || D.k, o.k || D.k) },
    uDWall: { value: lin(o.wall || '#888888') }, uDMort: { value: lin(o.mort || '#999999') }, uDBump: { value: D.bump * (o.bumpK || 1) },
    uDMode: { value: D.mode }, uDMask: { value: o.mask === false ? 0 : 1 }, uDStr: { value: o.str == null ? 1 : o.str }, uDAmt: { value: o.amt == null ? 0.5 : o.amt },
  };
  const prev = m.onBeforeCompile;
  m.extensions = Object.assign(m.extensions || {}, { derivatives: true });
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vDtW;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDtW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = `varying vec3 vDtW;
uniform sampler2D uDet; uniform sampler2D uDNoise; uniform vec2 uDK; uniform vec3 uDWall; uniform vec3 uDMort;
uniform float uDBump, uDMode, uDMask, uDStr, uDAmt;
vec3 dtPerturb(vec3 sp, vec3 sn, vec2 dH, float fd) {
  vec3 sX = dFdx(sp), sY = dFdy(sp), R1 = cross(sY, sn), R2 = cross(sn, sX);
  float fDet = dot(sX, R1) * fd; vec3 vG = sign(fDet) * (dH.x * R1 + dH.y * R2);
  return normalize(abs(fDet) * sn - vG);
}
` + sh.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
  float dtD = length(vDtW - cameraPosition);
  vec4 dtT = texture2D(uDet, vUv * uDK);
  vec4 dtN = texture2D(uDNoise, vUv * 0.62);
  vec4 dtN2 = texture2D(uDNoise, vUv * 2.3 + 0.37);
  vec4 dtS = texture2D(uDNoise, vUv * vec2(7.0, 0.42) + vec2(0.13, 0.0));
  float dtWall = 1.0;
  #ifdef USE_ROUGHNESSMAP
  if (uDMask > 0.5) dtWall = smoothstep(0.66, 0.78, texture2D(roughnessMap, vUv).g);
  #endif
  float dtLow = dtN.r + dtN2.r - 1.0;
  float dtStreak = dtS.g * (0.4 + 0.6 * dtN.b) * uDStr;
  if (uDMode < 0.5) {
    vec3 dtRel = clamp(diffuseColor.rgb / max(uDWall, vec3(0.03)), 0.0, 2.2);
    float dtTone = dtT.r * 2.0 * (1.0 + dtLow * 0.55);
    vec3 dtCol = mix(uDWall * dtTone, uDMort * (0.7 + dtT.r * 0.6), dtT.g);
    dtCol *= 1.0 - 0.4 * dtStreak;
    diffuseColor.rgb = mix(diffuseColor.rgb, dtCol * dtRel, dtWall);
  } else {
    diffuseColor.rgb *= 1.0 + (dtT.r * 2.0 - 1.0) * uDAmt + dtLow * 0.14 - 0.22 * dtStreak;
  }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  if (uDMode < 0.5) roughnessFactor = clamp(roughnessFactor + dtWall * (dtT.g * 0.12 + (dtT.r - 0.5) * 0.18 - dtStreak * 0.14), 0.04, 1.0);
  else roughnessFactor = clamp(roughnessFactor + dtStreak * 0.3 + (dtT.r - 0.5) * 0.12, 0.04, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  if (uDBump > 0.0) {
    vec2 dtH = vec2(dFdx(dtT.b), dFdy(dtT.b)) * uDBump * (1.0 - smoothstep(30.0, 90.0, dtD)) * dtWall;
    vec3 dtNn = dtPerturb(-vViewPosition, normal, clamp(dtH, -0.6, 0.6), faceDirection);
    if (dot(dtNn, dtNn) > 0.5) normal = dtNn;
  }`);
  };
  return m;
}
// tylko niskoczestotliwosciowa zmiana tonu (dachy: lamie 10-metrowe powtarzanie)
export function noisePatch(m, amt = 0.3) {
  const U = { uDNoise: { value: noiseOnly() } }, prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, U);
    sh.fragmentShader = 'uniform sampler2D uDNoise;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  { vec4 nq = texture2D(uDNoise, vUv * 0.37), nr = texture2D(uDNoise, vUv * 1.7 + 0.2); diffuseColor.rgb *= 1.0 + (nq.r + nr.r - 1.0) * ${amt.toFixed(2)}; }`);
  };
  return m;
}

// ---------------------------------------------------------------- dach: papa, zwir, lata, kaluze (10 x 10 m)
export function roofTextures() {
  grain(); const N = 512, A = newImg(N), Rg = newImg(N), B = newImg(N), R = rng(77);
  const a = A.img.data, r = Rg.img.data, b = B.img.data;
  const patches = []; for (let i = 0; i < 9; i++) patches.push({ x: R() * N, y: R() * N, w: 40 + R() * 110, h: 30 + R() * 80, k: R() < 0.5 ? 0.78 : 1.18 });
  const pud = fbm(N, N, 3, 3, 3, 88);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = (y * N + x) * 4, gi = G(x, y), gj = G(x * 2 + 1, y * 2 + 5), l = low(x, y, N);
    let L = 0.34 + (l - 0.5) * 0.12 + (gi - 0.5) * 0.14 + (gj - 0.5) * 0.06, rough = 0.9, h = 0.5 + (gi - 0.5) * 0.7 + (gj - 0.5) * 0.3;
    const strip = (x % (N / 5)) / (N / 5); // pasy papy co ~2 m
    if (strip < 0.02) { L *= 0.7; h -= 0.2; } else if (strip > 0.985) { L *= 0.85; }
    if (gi > 0.86) { L += 0.08; h += 0.2; } // zwir
    for (const p of patches) { const dx = (x - p.x + N) % N, dy = (y - p.y + N) % N; if (dx < p.w && dy < p.h) { L *= p.k; if (dx < 3 || dy < 3 || dx > p.w - 3 || dy > p.h - 3) { L *= 0.55; h += 0.2; } } }
    const pu = pud[y * N + x] + (gi - 0.5) * 0.04;
    if (pu > 0.6) { const w = sstep(0.6, 0.64, pu); L = L * (1 - 0.45 * w); rough = 0.9 - 0.82 * w; h = h * (1 - w) + 0.5 * w; }
    const lum = Math.max(0.02, L);
    a[k] = lum * 255 * 0.98; a[k + 1] = lum * 255 * 0.96; a[k + 2] = lum * 255 * 0.92; a[k + 3] = 255;
    r[k] = r[k + 1] = r[k + 2] = rough * 255; r[k + 3] = 255;
    b[k] = b[k + 1] = b[k + 2] = clamp01(h) * 255; b[k + 3] = 255;
  }
  const mk = (I, srgb) => { I.x.putImageData(I.img, 0, 0); const t = new THREE.CanvasTexture(I.c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.encoding = THREE.sRGBEncoding; return t; };
  return { map: mk(A, true), rough: mk(Rg), bump: mk(B) };
}

// ---------------------------------------------------------------- zelazo: ciemna stal z rdza i zaciekami (4 x 4 m)
export function rustTexture() {
  const N = 512, c = cv(N, N), x = c.getContext('2d'); x.fillStyle = '#25282c'; x.fillRect(0, 0, N, N);
  const R = rng(55);
  for (let i = 0; i < 2600; i++) { x.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.05)'; x.fillRect(R() * N, R() * N, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < 40; i++) { // plamy rdzy
    const px = R() * N, py = R() * N, rr = 10 + R() * 50, g = x.createRadialGradient(px, py, 0, px, py, rr);
    g.addColorStop(0, `rgba(${130 + R() * 40 | 0},${60 + R() * 25 | 0},20,${0.35 + R() * 0.3})`); g.addColorStop(1, 'rgba(110,50,20,0)'); x.fillStyle = g;
    for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) x.fillRect(px - rr + ox, py - rr + oy, rr * 2, rr * 2);
  }
  for (let i = 0; i < 70; i++) { // zacieki rdzy
    const px = R() * N, py = R() * N, l = 30 + R() * 120, g = x.createLinearGradient(0, py, 0, py + l);
    g.addColorStop(0, 'rgba(140,70,25,.4)'); g.addColorStop(1, 'rgba(140,70,25,0)'); x.fillStyle = g; x.fillRect(px, py, 1 + R() * 2.5, l);
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
}

// ---------------------------------------------------------------- wyblakle reklamy malowane na scianach (ghost signs); x = kontekst canvas elewacji
export function ghostSign(x, S, C, row, text, hue) {
  const R = Math.random;
  x.save(); x.textAlign = 'center'; x.textBaseline = 'middle';
  let fs = 38; x.font = `900 ${fs}px Impact, "Arial Black", sans-serif`;
  const wmax = S * (0.62 + R() * 0.2); fs = Math.floor(fs * Math.min(1.2, wmax / x.measureText(text).width)); x.font = `900 ${fs}px Impact, "Arial Black", sans-serif`;
  const cx = S * (0.3 + R() * 0.4), cy = row * C + C - 22 - 2;
  x.globalAlpha = 0.17; x.fillStyle = hue || '#e9dcc0'; x.fillText(text, cx, cy);
  x.globalAlpha = 0.09; x.strokeStyle = '#201810'; x.lineWidth = 2; x.strokeText(text, cx + 1, cy + 1);
  // poplamione, "zjedzone" przez czas: ciemne plamy zakrywaja czesc liter
  x.globalAlpha = 1; x.globalCompositeOperation = 'source-over';
  x.restore();
}
