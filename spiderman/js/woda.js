// Woda i okolice: rzeki z falami (shader), nabrzeza z pirsami, port (dzwigi, kontenery, barki), ruchome statki
// z kilwaterem, lodzie, boje, mewy, swiatla nawigacyjne, Statua Wolnosci oraz daleki brzeg (Jersey, Brooklyn, Bronx).
// Wszystko w jednym pliku; miasto.js wywoluje tylko buildRivers() w buildGround() i updateWater() w updateTraffic().
// Uwaga: wlasny generator losowy (nie srand z util.js), zeby nie przesunac ziarna reszty miasta.
const V3 = THREE.Vector3;
let CTX = null;

// ---------------------------------------------------------------- narzedzia
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const lin = c => Math.pow(c, 2.2);
const hexRGB = h => [lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255)];
const mixHex = (a, b, t) => { const A = hexRGB(a), B = hexRGB(b); return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]; };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// zlepiana geometria z kolorami wierzcholkow (kolory juz liniowe)
class Geo {
  constructor() { this.p = []; this.n = []; this.c = []; this.u = []; }
  tri(a, b, c, col, ctr, ta, tb, tc) {
    ta = ta || [0, 0]; tb = tb || [0, 0]; tc = tc || [0, 0];
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if (ctr) {
      const dx = (a[0] + b[0] + c[0]) / 3 - ctr[0], dy = (a[1] + b[1] + c[1]) / 3 - ctr[1], dz = (a[2] + b[2] + c[2]) / 3 - ctr[2];
      if (nx * dx + ny * dy + nz * dz < 0) { const t = b; b = c; c = t; const tt = tb; tb = tc; tc = tt; nx = -nx; ny = -ny; nz = -nz; }
    }
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    this.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    this.u.push(ta[0], ta[1], tb[0], tb[1], tc[0], tc[1]);
  }
  quad(a, b, c, d, col, ctr, ua, ub, uc, ud) { this.tri(a, b, c, col, ctr, ua, ub, uc); this.tri(a, c, d, col, ctr, ua, uc, ud); }
  // prostopadloscian osiowy
  box(x0, x1, y0, y1, z0, z1, col) {
    const c = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
    const P = (x, y, z) => [x, y, z];
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), col, c);
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), col, c);
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), col, c);
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), col, c);
    this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0), col, c);
    this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), col, c);
  }
  // prostopadloscian obrocony: srodek, rozmiary, punkt do lookAt
  rbox(cx, cy, cz, sx, sy, sz, tx, ty, tz, col) {
    const o = new THREE.Object3D(); o.position.set(cx, cy, cz); o.lookAt(tx, ty, tz); o.updateMatrix();
    const m = o.matrix, ctr = [cx, cy, cz], pts = [];
    for (let i = 0; i < 8; i++) { const v = new V3((i & 1 ? 0.5 : -0.5) * sx, (i & 2 ? 0.5 : -0.5) * sy, (i & 4 ? 0.5 : -0.5) * sz).applyMatrix4(m); pts.push([v.x, v.y, v.z]); }
    const F = [[4, 5, 7, 6], [1, 0, 2, 3], [5, 1, 3, 7], [0, 4, 6, 2], [6, 7, 3, 2], [0, 1, 5, 4]];
    for (const f of F) this.quad(pts[f[0]], pts[f[1]], pts[f[2]], pts[f[3]], col, ctr);
  }
  // belka miedzy dwoma punktami
  seg(a, b, th, col) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); if (L < 1e-4) return;
    this.rbox((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, th, th, L, b[0], b[1], b[2], col);
  }
  // bryla miedzy dwoma obrysami (x,z), zamknieta; wieko opcjonalne
  loft(ptsB, yb, ptsT, yt, col, cap, jit) {
    const n = ptsB.length; let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += (ptsB[i][0] + ptsT[i][0]) / (2 * n); cz += (ptsB[i][1] + ptsT[i][1]) / (2 * n); }
    const ctr = [cx, (yb + yt) / 2, cz];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, a = ptsB[i], b = ptsB[j], c = ptsT[j], d = ptsT[i];
      let k = col; if (jit) { const f = 1 + (((i * 7919) % 13) / 13 - 0.5) * jit; k = [col[0] * f, col[1] * f, col[2] * f]; }
      this.quad([a[0], yb, a[1]], [b[0], yb, b[1]], [c[0], yt, c[1]], [d[0], yt, d[1]], k, ctr);
    }
    if (cap) {
      let tx = 0, tz = 0; for (const p of ptsT) { tx += p[0] / n; tz += p[1] / n; }
      for (let i = 0; i < n; i++) { const a = ptsT[i], b = ptsT[(i + 1) % n]; this.tri([a[0], yt, a[1]], [b[0], yt, b[1]], [tx, yt, tz], col, [tx, yt - 10, tz]); }
    }
  }
  append(s, tx, ty, tz, rotY, sc) {
    sc = sc || 1; const co = Math.cos(rotY || 0), si = Math.sin(rotY || 0);
    for (let i = 0; i < s.p.length; i += 3) {
      const x = s.p[i] * sc, y = s.p[i + 1] * sc, z = s.p[i + 2] * sc;
      this.p.push(x * co + z * si + tx, y + ty, -x * si + z * co + tz);
      const nx = s.n[i], nz = s.n[i + 2]; this.n.push(nx * co + nz * si, s.n[i + 1], -nx * si + nz * co);
    }
    for (let i = 0; i < s.c.length; i++) this.c.push(s.c[i]);
    for (let i = 0; i < s.u.length; i++) this.u.push(s.u[i]);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeBoundingSphere(); return g;
  }
}
const ngonPts = (cx, cz, r, n, rot = 0, sx = 1, sz = 1) => Array.from({ length: n }, (_, i) => { const a = rot + i / n * Math.PI * 2; return [cx + Math.cos(a) * r * sx, cz + Math.sin(a) * r * sz]; });

// ---------------------------------------------------------------- tekstury
function normalTex() {
  const N = 512, h = new Float32Array(N * N), rng = mulberry(77), waves = [];
  for (let i = 0; i < 26; i++) {
    const a = rng() * 6.283, k = 2 + Math.floor(Math.pow(rng(), 1.6) * 34);
    waves.push({ kx: Math.round(Math.cos(a) * k), ky: Math.round(Math.sin(a) * k), a: 1 / (1 + k * 0.28), p: rng() * 6.283, ch: rng() < 0.4 });
  }
  const W = waves.filter(w => w.kx || w.ky);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let v = 0;
    for (const w of W) { const s = Math.sin((w.kx * i + w.ky * j) / N * 6.2832 + w.p); v += w.a * (w.ch ? 1 - Math.abs(s) * 1.4 : s); }
    h[j * N + i] = v;
  }
  const c = mk(N, N), x = c.getContext('2d'), img = x.createImageData(N, N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = h[j * N + (i + 1) % N] - h[j * N + (i + N - 1) % N], dy = h[((j + 1) % N) * N + i] - h[((j + N - 1) % N) * N + i];
    const nx = -dx * 1.1, ny = -dy * 1.1, l = Math.hypot(nx, ny, 1), k = (j * N + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
// beton nabrzeza: plyty co 6 m, szwy, zacieki, glony przy linii wody (kafel = 6 m x 3.4 m; linia wody na ok. 53% wysokosci od dolu)
function quayTex() {
  const c = mk(256, 144), x = c.getContext('2d'), r = mulberry(5);
  x.fillStyle = '#8b887f'; x.fillRect(0, 0, 256, 144);
  for (let i = 0; i < 2600; i++) { const k = 110 + r() * 60 | 0; x.fillStyle = `rgba(${k},${k - 2},${k - 8},${0.25 + r() * 0.3})`; x.fillRect(r() * 256, r() * 144, 1 + r() * 3, 1 + r() * 2); }
  x.fillStyle = 'rgba(40,36,30,.5)'; x.fillRect(0, 0, 3, 144); x.fillRect(0, 70, 256, 2); // szwy
  for (let i = 0; i < 10; i++) { const px = r() * 256, g = x.createLinearGradient(0, 0, 0, 144); g.addColorStop(0, 'rgba(50,40,30,0)'); g.addColorStop(1, 'rgba(50,40,30,.35)'); x.fillStyle = g; x.fillRect(px, 0, 2 + r() * 5, 144); }
  const wl = 144 * (1 - 0.59), g = x.createLinearGradient(0, wl - 22, 0, 144); // pod woda: ciemny osad i glony
  g.addColorStop(0, 'rgba(40,52,30,0)'); g.addColorStop(0.3, 'rgba(46,60,30,.7)'); g.addColorStop(1, 'rgba(18,26,20,.9)'); x.fillStyle = g; x.fillRect(0, wl - 22, 256, 144 - wl + 22);
  x.fillStyle = 'rgba(30,25,20,.4)'; x.fillRect(0, wl - 3, 256, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.encoding = THREE.sRGBEncoding; return t;
}
function groundTexFar() {
  const c = mk(256, 256), x = c.getContext('2d'), r = mulberry(9);
  x.fillStyle = '#4d4e48'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { const k = 60 + r() * 50 | 0; x.fillStyle = `rgb(${k},${k},${k - 4})`; x.fillRect(r() * 256, r() * 256, 1 + r() * 3, 1 + r() * 3); }
  x.strokeStyle = 'rgba(20,20,20,.5)'; x.lineWidth = 2; x.strokeRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(210,190,90,.4)'; x.lineWidth = 3; x.setLineDash([22, 18]); x.beginPath(); x.moveTo(0, 128); x.lineTo(256, 128); x.stroke();
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}
// okna dalekich wiezowcow: 8 x 8 komorek; mapa emisji = zapalone okna (rzedy biurowe)
function farWinTex() {
  const S = 256, C = 32, r = mulberry(31), map = mk(S, S), emi = mk(S, S), a = map.getContext('2d'), e = emi.getContext('2d');
  a.fillStyle = '#8a8f96'; a.fillRect(0, 0, S, S); e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  const glass = ['#27323e', '#2c3a47', '#222b35', '#34414d', '#2a3540', '#303c42'];
  for (let j = 0; j < 8; j++) {
    const rowLit = r() < 0.5 ? 0.55 : 0.15;
    for (let i = 0; i < 8; i++) {
      const x0 = i * C + 3, y0 = j * C + 4, w = C - 6, h = C - 9;
      const g = a.createLinearGradient(0, y0, 0, y0 + h); const base = glass[(r() * glass.length) | 0];
      g.addColorStop(0, '#5d7387'); g.addColorStop(0.45, base); g.addColorStop(1, '#171d25'); a.fillStyle = g; a.fillRect(x0, y0, w, h);
      if (r() < rowLit) {
        const warm = r() < 0.72, k = 0.55 + r() * 0.45;
        e.fillStyle = warm ? `rgb(${255 * k | 0},${(205 + r() * 30) * k | 0},${(120 + r() * 40) * k | 0})` : `rgb(${190 * k | 0},${215 * k | 0},${255 * k | 0})`;
        e.fillRect(x0, y0, w, h);
      }
    }
  }
  const tm = new THREE.CanvasTexture(map), te = new THREE.CanvasTexture(emi);
  for (const t of [tm, te]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; }
  return { map: tm, emi: te };
}
// kilwater: V z dwoch ramion plus piana na osi (dluzsza os = -z)
function wakeTex() {
  const c = mk(128, 256), x = c.getContext('2d'); x.clearRect(0, 0, 128, 256);
  const r = mulberry(12);
  for (let i = 0; i < 1500; i++) {
    const t = Math.pow(r(), 0.8), y = t * 250 + 3; // 0 = rufa
    const arm = 8 + t * 54, side = r() < 0.5 ? -1 : 1, jx = (r() - 0.5) * (6 + t * 12);
    const px = 64 + side * arm + jx;
    x.fillStyle = `rgba(255,255,255,${(1 - t) * 0.55 * (0.4 + r() * 0.6)})`; x.beginPath(); x.arc(px, y, 1 + r() * 2.6, 0, 6.283); x.fill();
  }
  for (let i = 0; i < 1200; i++) {
    const t = Math.pow(r(), 0.7), y = t * 250 + 3, w = 14 * (1 - t * 0.5);
    x.fillStyle = `rgba(255,255,255,${(1 - t) * 0.5 * (0.3 + r() * 0.7)})`; x.beginPath(); x.arc(64 + (r() - 0.5) * w, y, 1 + r() * 3, 0, 6.283); x.fill();
  }
  const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)'); x.globalCompositeOperation = 'destination-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 256);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; t.encoding = THREE.sRGBEncoding; return t;
}

// ---------------------------------------------------------------- woda: shader fal, fresnela, sciezki slonca, piany i glebi
const WTOD = {
  sunset: { shallow: 0x55605a, deep: 0x1a2631, sky: [1.0, 0.72, 0.45], fres: 0.55, sun: 0xffb877, glit: 3.4, lights: 0.0, foam: 0.85 },
  day: { shallow: 0x3f6e76, deep: 0x153a56, sky: [0.7, 0.82, 0.95], fres: 0.25, sun: 0xfff2dc, glit: 1.1, lights: 0.0, foam: 0.9 },
  night: { shallow: 0x142230, deep: 0x060c18, sky: [0.06, 0.08, 0.2], fres: 0.3, sun: 0x9fb6e8, glit: 0.9, lights: 1.0, foam: 0.35 },
};
function setupWater(ctx) {
  const { water, LAND, W0, E0, N0, isl } = ctx;
  const nm = normalTex();
  const U = {
    uT: { value: 0 }, uNM: { value: nm }, uSun: { value: new V3(-0.8, 0.2, 0.3) }, uSunCol: { value: new THREE.Color() }, uGlit: { value: 1 },
    uShallow: { value: new THREE.Color() }, uDeep: { value: new THREE.Color() }, uSky: { value: new THREE.Color() }, uFres: { value: 0.5 }, uLights: { value: 0 }, uFoam: { value: 1 },
    uMC: { value: new THREE.Vector2((LAND.x0 + LAND.x1) / 2, (LAND.z0 + LAND.z1) / 2) }, uMH: { value: new THREE.Vector2((LAND.x1 - LAND.x0) / 2, (LAND.z1 - LAND.z0) / 2) },
    uB: { value: new V3(W0, E0, N0) }, uIs: { value: new V3(isl.x, isl.z, isl.r) },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.07, metalness: 0.0 });
  mat.userData.lin = true; mat.userData.env = 1.0;
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying vec3 vWP;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `
varying vec3 vWP;
uniform float uT, uGlit, uFres, uLights, uFoam; uniform sampler2D uNM; uniform vec3 uSun, uB, uIs; uniform vec3 uSunCol, uShallow, uDeep, uSky; uniform vec2 uMC, uMH;
float whash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(whash(i), whash(i + vec2(1, 0)), f.x), mix(whash(i + vec2(0, 1)), whash(i + vec2(1, 1)), f.x), f.y); }
float bankDist(vec2 p) {
  float dM = length(max(abs(p - uMC) - uMH, 0.0));
  float d = min(min(dM, p.x - uB.x), min(uB.y - p.x, p.y - uB.z));
  return max(min(d, length(p - uIs.xy) - uIs.z), 0.0);
}
void main() {`).replace('#include <color_fragment>', `#include <color_fragment>
  vec2 wp = vWP.xz; float wdist = length(vWP - cameraPosition);
  vec3 wn1 = texture2D(uNM, wp / 41.0 + vec2(uT * 0.011, uT * 0.006)).xyz * 2.0 - 1.0;
  vec3 wn2 = texture2D(uNM, mat2(0.87, -0.5, 0.5, 0.87) * wp / 17.0 + vec2(-uT * 0.019, uT * 0.012) + 0.37).xyz * 2.0 - 1.0;
  vec3 wn3 = texture2D(uNM, wp / 6.1 + vec2(uT * 0.032, -uT * 0.041) + 0.71).xyz * 2.0 - 1.0;
  vec3 wn4 = texture2D(uNM, mat2(0.6, 0.8, -0.8, 0.6) * wp / 2.3 + vec2(-uT * 0.05, -uT * 0.037) + 0.13).xyz * 2.0 - 1.0;
  float wfar = 1.0 / (1.0 + wdist / 380.0);
  vec2 wSl = (wn1.xy * 0.95 + wn2.xy * 0.75 + wn3.xy * 0.5 * (0.35 + 0.65 * wfar) + wn4.xy * 0.3 * wfar) * (0.5 + 0.9 * wfar);
  float wbd = bankDist(wp);
  float wnz = wnoise(wp * 0.5 + uT * 0.2) * 0.6 + wnoise(wp * 1.7 - uT * 0.35) * 0.4;
  float wFoam = (1.0 - smoothstep(0.4, 3.2 + 3.0 * wnz, wbd + (wnz - 0.5) * 2.2)) * smoothstep(0.28, 0.5, wnz + 0.22);
  float wLap = smoothstep(0.55, 0.95, sin(wbd * 1.3 - uT * 1.1 + wnz * 5.0)) * (1.0 - smoothstep(1.5, 11.0, wbd)) * wnz * 0.5;
  wFoam = clamp((wFoam + wLap) * uFoam, 0.0, 1.0) * (1.0 - smoothstep(250.0, 700.0, wdist));
  float wDeep = smoothstep(2.0, 75.0, wbd);
  diffuseColor.rgb = mix(uShallow, uDeep, wDeep);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.82, 0.8), wFoam);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.75, wFoam);')
      .replace('#include <normal_fragment_maps>', `
  { vec3 wnw = normalize(vec3(wSl.x * 0.55, 1.0, wSl.y * 0.55)); normal = normalize((viewMatrix * vec4(wnw, 0.0)).xyz); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
  {
    vec3 wV = normalize(vViewPosition); vec3 wR = reflect(-wV, normal);
    vec3 wS = normalize((viewMatrix * vec4(uSun, 0.0)).xyz);
    float wsd = max(dot(wR, wS), 0.0);
    float wsp = 0.55 + 0.9 * wnoise(wp * 3.1 + wSl * 4.0 + uT * 0.4);
    float wg = (pow(wsd, 700.0) * 5.0 + pow(wsd, 90.0) * 1.1 + pow(wsd, 14.0) * 0.28) * wsp;
    float wF = pow(1.0 - max(dot(normal, wV), 0.0), 4.0);
    totalEmissiveRadiance += (uSunCol * wg * uGlit + uSky * wF * uFres) * (1.0 - wFoam);
    float wlc = uLights * exp(-wbd / 110.0) * pow(wnoise(vec2(wp.y * 0.09 + wSl.y * 5.0, wp.x * 0.012 + wSl.x * 2.0 + uT * 0.05)), 2.2);
    totalEmissiveRadiance += vec3(1.0, 0.72, 0.42) * wlc * 0.45 * (1.0 - wFoam);
  }`);
  };
  water.material.dispose(); water.material = mat; water.receiveShadow = false;
  return U;
}

// ---------------------------------------------------------------- szablony lodzi (dziob = +z); kolory sRGB hex
const C = {
  white: hexRGB(0xe9e9e4), cream: hexRGB(0xd8d2c0), navy: hexRGB(0x1c2431), black: hexRGB(0x15171a), orange: hexRGB(0xe2560f), red: hexRGB(0xaa221a), blue: hexRGB(0x1f4f8f),
  glass: hexRGB(0x1b2430), grey: hexRGB(0x7b838a), rust: hexRGB(0x6b3a2a), yellow: hexRGB(0xe0b020), green: hexRGB(0x24603c),
};
const hullPts = (L, W, k = 1) => [[-W * 0.45 * k, -L / 2], [W * 0.45 * k, -L / 2], [W / 2 * k, -L * 0.15], [W * 0.43 * k, L * 0.25], [W * 0.13 * k, L * 0.45], [0, L / 2], [-W * 0.13 * k, L * 0.45], [-W * 0.43 * k, L * 0.25], [-W / 2 * k, -L * 0.15]];
function hull(g, L, W, draft, free, low, up) { g.loft(hullPts(L, W, 0.62), -draft, hullPts(L, W, 1), 0, low, false); g.loft(hullPts(L, W, 1), 0, hullPts(L, W, 1.0), free, up, true); }
// pas okien (swieci nocami): po obu burtach
function winStrip(l, y0, y1, z0, z1, hw) { l.box(hw, hw + 0.08, y0, y1, z0, z1, [1, 1, 1]); l.box(-hw - 0.08, -hw, y0, y1, z0, z1, [1, 1, 1]); }
function mkBoat(L) { return { g: new Geo(), l: new Geo(), lights: [], L }; }
function buildFerry() {
  const b = mkBoat(38), g = b.g, l = b.l; hull(g, 38, 10, 2, 2.4, C.navy, C.orange);
  g.box(-3.9, 3.9, 2.4, 5.2, -15, 14, C.white); g.box(-3.1, 3.1, 5.2, 7.4, -11, 8, C.white); g.box(-2.1, 2.1, 7.4, 9.2, 3, 8, C.white);
  g.box(-1.3, 1.3, 7.4, 11.6, -7, -4.6, C.orange); g.box(-1.35, 1.35, 10.4, 11.6, -7.05, -4.55, C.black);
  g.box(-3.95, 3.95, 5.1, 5.35, -15.2, 14.2, C.grey); g.box(-3.15, 3.15, 7.3, 7.5, -11.2, 8.2, C.grey);
  winStrip(l, 3.0, 4.5, -13, 12.5, 3.91); winStrip(l, 5.8, 6.9, -9.5, 6.5, 3.11); l.box(-2.12, 2.12, 8.0, 8.9, 7.6, 8.02, [1, 1, 1]);
  b.lights = [[-4.9, 3.2, 11, 1, 0.1, 0.1], [4.9, 3.2, 11, 0.1, 1, 0.2], [0, 9.9, 5.5, 1, 1, 0.9], [0, 5.5, -15.3, 1, 1, 0.9]]; return b;
}
function buildTour() {
  const b = mkBoat(26), g = b.g, l = b.l; hull(g, 26, 6.6, 1.4, 1.5, C.navy, C.white);
  g.loft(hullPts(26, 6.6, 1.015), 1.0, hullPts(26, 6.6, 1.015), 1.4, C.blue, false);
  g.box(-2.6, 2.6, 1.5, 3.9, -8, 7, C.white); g.box(-2.7, 2.7, 3.9, 4.15, -8.2, 7.2, C.cream); // salon i dach (otwarty poklad)
  for (const x of [-2.5, 2.5]) for (let z = -7; z <= 6; z += 3.2) g.box(x - 0.05, x + 0.05, 4.1, 6.0, z - 0.05, z + 0.05, C.grey);
  g.box(-2.7, 2.7, 6.0, 6.25, -7.5, 7, C.white); g.box(-1.0, 1.0, 6.25, 7.5, 0, 3, C.white);
  winStrip(l, 2.2, 3.4, -7.4, 6.5, 2.61); l.box(-1.0, 1.0, 6.6, 7.2, 3.02, 3.1, [1, 1, 1]);
  b.lights = [[-3.0, 2.2, 8, 1, 0.1, 0.1], [3.0, 2.2, 8, 0.1, 1, 0.2], [0, 7.8, 1.5, 1, 1, 0.9]]; return b;
}
function buildTug() {
  const b = mkBoat(17), g = b.g, l = b.l; hull(g, 17, 6.8, 1.8, 1.6, C.black, C.red);
  g.loft(hullPts(17, 6.8, 1.04), 1.1, hullPts(17, 6.8, 1.04), 1.5, C.black, false); // odbijacz
  g.box(-2.5, 2.5, 1.6, 4.2, -5, 1.2, C.white); g.box(-2.0, 2.0, 4.2, 6.2, -3.5, 0.2, C.white); g.box(-2.6, 2.6, 6.2, 6.4, -3.8, 0.5, C.red);
  g.box(-0.7, 0.7, 4.2, 8.0, -4.6, -3.2, C.black); g.box(-0.75, 0.75, 7.3, 8.0, -4.65, -3.15, C.red);
  winStrip(l, 2.4, 3.5, -4, 0.8, 2.51); l.box(-2.02, 2.02, 4.7, 5.7, 0.05, 0.22, [1, 1, 1]); l.box(-2.02, 2.02, 4.7, 5.7, -3.4, -3.3, [1, 1, 1]);
  b.lights = [[-3.2, 2.0, 5, 1, 0.1, 0.1], [3.2, 2.0, 5, 0.1, 1, 0.2], [0, 6.8, -1.5, 1, 1, 0.9]]; return b;
}
function buildSail() {
  const b = mkBoat(10), g = b.g; hull(g, 10, 3.2, 1.3, 0.9, C.navy, C.white);
  g.box(-0.9, 0.9, 0.9, 1.5, -3, 0.5, C.cream); g.box(-0.1, 0.1, 0.9, 12, 0.3, 0.5, C.grey); g.box(-0.08, 0.08, 1.7, 1.85, -3.4, 0.5, C.grey);
  const sc = [0.96, 0.95, 0.9], A = [0, 1.9, -3.3], B = [0, 1.9, 0.3], T = [0, 11.7, 0.32]; g.tri(A, B, T, sc); g.tri(A, T, B, sc);
  const J1 = [0, 1.3, 4.0], J2 = [0, 1.3, 0.8], J3 = [0, 10.2, 0.45]; g.tri(J1, J2, J3, [0.9, 0.9, 0.86]); g.tri(J1, J3, J2, [0.9, 0.9, 0.86]);
  b.lights = [[-1.4, 1.0, 3.0, 1, 0.1, 0.1], [1.4, 1.0, 3.0, 0.1, 1, 0.2], [0, 12.2, 0.4, 1, 1, 0.9]]; return b;
}
function buildSpeed() {
  const b = mkBoat(9), g = b.g, l = b.l; hull(g, 9, 2.6, 0.5, 0.8, C.white, C.red);
  g.box(-0.9, 0.9, 0.8, 1.3, -3, 0.5, C.white); l.box(-0.85, 0.85, 1.3, 1.9, 0.2, 0.6, [1, 1, 1]); g.box(-0.9, 0.9, 1.9, 2.0, -0.4, 0.6, C.white); g.box(-0.5, 0.5, 1.3, 1.8, -3.2, -2.4, C.black);
  b.lights = [[-1.1, 1.2, 2.5, 1, 0.1, 0.1], [1.1, 1.2, 2.5, 0.1, 1, 0.2], [0, 2.4, -0.2, 1, 1, 0.9]]; return b;
}
const CONT = [0xb3321f, 0x1f4f8f, 0x2c7a45, 0xd8a321, 0x8a8f95, 0xb9b3a0, 0x6a2a2a, 0x2a3b5a, 0xc9692a, 0x4f6b73];
function buildCargo() {
  const b = mkBoat(140), g = b.g, l = b.l, r = mulberry(4); hull(g, 140, 23, 7, 9, C.red, C.black);
  g.box(-10.5, 10.5, 9, 9.5, -70, 40, C.grey);
  for (let z = -42; z < 44; z += 12.3) for (let x = -9.7; x < 9.8; x += 2.5) { const hgt = 2 + ((r() * 3) | 0); for (let y = 0; y < hgt; y++) g.box(x, x + 2.3, 9.5 + y * 2.6, 9.5 + y * 2.6 + 2.5, z, z + 12, hexRGB(CONT[(r() * CONT.length) | 0])); }
  g.box(-10, 10, 9, 22, -66, -54, C.white); g.box(-9, 9, 22, 26, -64, -55, C.white); g.box(-1.6, 1.6, 26, 33, -63, -59, C.black); g.box(-1.7, 1.7, 30.5, 33, -63.1, -58.9, C.red);
  l.box(-9.1, 9.1, 23.2, 25.2, -55, -54.9, [1, 1, 1]); winStrip(l, 11, 12.2, -63.5, -55, 10.01); winStrip(l, 15, 16.2, -63.5, -55, 10.01); winStrip(l, 19, 20.2, -63.5, -55, 10.01);
  g.box(-8, 8, 9.5, 12, 56, 64, C.grey);
  b.lights = [[-11, 10, 60, 1, 0.1, 0.1], [11, 10, 60, 0.1, 1, 0.2], [0, 33.5, -61, 1, 1, 0.9], [0, 14, 66, 1, 1, 0.9]]; return b;
}
function buildBarge(kind, r) {
  const g = new Geo(), L = 46, W = 12;
  const pts = (k) => [[-W / 2 * k, -L / 2], [W / 2 * k, -L / 2], [W / 2 * k, L / 2 - 6], [W * 0.3 * k, L / 2], [-W * 0.3 * k, L / 2], [-W / 2 * k, L / 2 - 6]];
  g.loft(pts(0.9), -1.5, pts(1), 0, kind === 1 ? C.navy : C.rust, false); g.loft(pts(1), 0, pts(1), 2.4, kind === 1 ? C.navy : C.rust, true);
  g.box(-W / 2 - 0.15, W / 2 + 0.15, 2.2, 2.5, -L / 2 - 0.1, L / 2 - 5, C.black);
  if (kind === 0) for (let z = -18; z < 19; z += 12.3) for (let x of [-4.8, -2.4, 0, 2.4, 4.8]) { const h = 1 + ((r() * 3) | 0); for (let y = 0; y < h; y++) g.box(x - 1.15, x + 1.15, 2.4 + y * 2.6, 4.9 + y * 2.6, z, z + 12, hexRGB(CONT[(r() * CONT.length) | 0])); }
  else if (kind === 1) { g.loft(ngonPts(0, -2, 14, 8, 0.4, 0.38, 1), 2.4, ngonPts(0, -2, 3, 8, 0.4, 0.38, 1), 9, hexRGB(0xb09a72), true); }
  else { g.box(-4, 4, 2.4, 3.2, -16, 8, C.grey); g.box(-0.5, 0.5, 3.2, 17, -14, -13, C.yellow); g.seg([0, 16.5, -13.5], [0, 9, 14], 0.5, C.yellow); g.box(-1.4, 1.4, 3.2, 6.5, -17, -11, C.yellow); }
  return g;
}

// ---------------------------------------------------------------- budowa swiata
export function buildRivers(ctx) {
  CTX = ctx;
  const { scene, LAND, W0, E0, N0, addBox, glowPoints, glowTexture, getTOD } = ctx;
  const R = mulberry(2018);
  const isl = { x: -300, z: 985, r: 66, g: 62 }; ctx.isl = isl;
  const state = { U: setupWater(ctx), boats: [], tod: '', t: 0 };
  ctx.state = state;
  const lights = { pos: [], col: [] };

  // ---- brzegi: duze bryly z betonowym frontem i terenem portowym (Jersey/Brooklyn/Bronx)
  const quay = quayTex(), gtex = groundTexFar();
  const quayMat = new THREE.MeshStandardMaterial({ map: quay, roughness: 0.95 }), farGround = new THREE.MeshStandardMaterial({ map: gtex, roughness: 0.92 });
  const shoreBox = (x0, x1, z0, z1, faceDir) => { // faceDir: 'x-' | 'x+' | 'z+' (strona wody)
    const geo = new THREE.BoxGeometry(x1 - x0, 4, z1 - z0), uv = geo.attributes.uv, sx = x1 - x0, sz = z1 - z0;
    const set = (f, su, sv, ov = 0) => { for (let i = f * 4; i < f * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv + ov); };
    set(0, sz / 6, 1.18, -0.086); set(1, sz / 6, 1.18, -0.086); set(2, sx / 28, sz / 28); set(3, 1, 1); set(4, sx / 6, 1.18, -0.086); set(5, sx / 6, 1.18, -0.086);
    const m = new THREE.Mesh(geo, [quayMat, quayMat, farGround, quayMat, quayMat, quayMat]);
    m.position.set((x0 + x1) / 2, -1.5, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
  };
  shoreBox(-5000, W0, -5000, 5000); shoreBox(E0, 5000, -5000, 5000); shoreBox(W0, E0, -5000, N0);
  gtex.repeat.set(1, 1);

  // ---- nabrzeze Manhattanu: front betonowy, gzyms, balustrady, pachoły, pirsy
  const S = new Geo(); // wszystko co statyczne i teksturowane brakiem tekstury (kolory wierzcholkow)
  const concrete = hexRGB(0x9a968c), concreteDk = hexRGB(0x6d6a63), steel = hexRGB(0x2b2f34), wood = hexRGB(0x2a2018);
  const faceG = new Geo(), edges = [
    { n: 'W', ox: LAND.x0, oz: LAND.z0, len: LAND.z1 - LAND.z0, dx: -1, dz: 0 },
    { n: 'E', ox: LAND.x1, oz: LAND.z0, len: LAND.z1 - LAND.z0, dx: 1, dz: 0 },
    { n: 'N', ox: LAND.x0, oz: LAND.z0, len: LAND.x1 - LAND.x0, dx: 0, dz: -1 },
    { n: 'S', ox: LAND.x0, oz: LAND.z1, len: LAND.x1 - LAND.x0, dx: 0, dz: 1 },
  ];
  const wP = (e, t, o, y) => e.dx ? [e.ox + e.dx * o, y, e.oz + t] : [e.ox + t, y, e.oz + e.dz * o]; // t wzdluz krawedzi, o na zewnatrz
  const PIERS = {
    W: [[-370, 80, 'shed'], [-200, 100, 'cont'], [-30, 90, 'crane'], [160, 110, 'shed'], [330, 85, 'cont'], [500, 95, 'crane']],
    E: [[-420, 85, 'cont'], [-250, 100, 'shed'], [-80, 90, 'crane'], [270, 100, 'cont'], [500, 80, 'shed']],
    N: [[-200, 55, 'cont'], [0, 60, 'shed'], [210, 55, 'crane']],
    S: [[-230, 70, 'crane'], [-70, 90, 'shed'], [100, 70, 'cont'], [250, 80, 'crane']],
  };
  const OPEN = { W: [-469], E: [135, 402], N: [], S: [] }; // dojazdy do mostow
  const posts = [], bollards = [], pierLamps = [], beacons = [];
  const rotXZ = (x, z, a) => [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)];
  for (const e of edges) {
    const nrm = e.dx ? [e.dx, 0] : [0, e.dz], rotY = Math.atan2(e.dx, e.dz), tl = e.dx ? [0, 1] : [1, 0];
    // front: panel pionowy z tekstura betonu (tekstura osobnym meshem: uzywamy quayMat)
    const a = wP(e, 0, 0.05, -3.2), b = wP(e, e.len, 0.05, -3.2), c = wP(e, e.len, 0.05, 0.35), d = wP(e, 0, 0.05, 0.35);
    const ctr = wP(e, e.len / 2, -3, -1);
    faceG.quad(a, b, c, d, [1, 1, 1], ctr, [0, 0], [e.len / 6, 0], [e.len / 6, 1.044], [0, 1.044]);
    // gzyms (kamienna krawedz) i pas ciemniejszego betonu
    const cp0 = wP(e, 0, 0, 0), cp1 = wP(e, e.len, 0.9, 0.42);
    S.box(Math.min(cp0[0], cp1[0]), Math.max(cp0[0], cp1[0]), 0, 0.38, Math.min(cp0[2], cp1[2]), Math.max(cp0[2], cp1[2]), concrete);
    const cq0 = wP(e, 0, -0.05, 0.36), cq1 = wP(e, e.len, 0.35, 0.44);
    S.box(Math.min(cq0[0], cq1[0]), Math.max(cq0[0], cq1[0]), 0.36, 0.44, Math.min(cq0[2], cq1[2]), Math.max(cq0[2], cq1[2]), concreteDk);
    // otwory (pirsy + mosty)
    const gaps = (PIERS[e.n] || []).map(p => [p[0] - 13, p[0] + 13]).concat((OPEN[e.n] || []).map(z => [z - 10, z + 10]));
    const t0 = e.dx ? e.oz : e.ox, inGap = t => gaps.some(g => t > g[0] && t < g[1]);
    // balustrada
    let run = null; const rails = [];
    for (let t = t0 + 2; t < t0 + e.len - 2; t += 3.6) {
      if (inGap(t)) { if (run) { rails.push(run); run = null; } continue; }
      posts.push([wP(e, t - t0, -0.55, 0.4)]); if (!run) run = [t, t]; run[1] = t;
    }
    if (run) rails.push(run);
    for (const r of rails) for (const [yy, th] of [[1.08, 0.07], [0.62, 0.05]]) {
      const p0 = wP(e, r[0] - t0, -0.55, yy), p1 = wP(e, r[1] - t0, -0.55, yy);
      S.box(Math.min(p0[0], p1[0]) - th, Math.max(p0[0], p1[0]) + th, yy - th, yy + th, Math.min(p0[2], p1[2]) - th, Math.max(p0[2], p1[2]) + th, steel);
    }
    for (let t = t0 + 10; t < t0 + e.len - 10; t += 22) if (!inGap(t)) bollards.push(wP(e, t - t0, -1.3, 0.44));
    // pirsy
    for (const [pc, len, kind] of PIERS[e.n] || []) {
      const wid = 24, L = new Geo(), tt = pc - t0, org = wP(e, tt, 0, 0);
      L.box(-wid / 2, wid / 2, -0.35, 0.3, -2, len, hexRGB(0x7d7a72));
      L.box(-wid / 2 - 0.3, -wid / 2 + 0.35, 0.28, 0.55, -2, len + 0.3, concrete); L.box(wid / 2 - 0.35, wid / 2 + 0.3, 0.28, 0.55, -2, len + 0.3, concrete); L.box(-wid / 2 - 0.3, wid / 2 + 0.3, 0.28, 0.55, len - 0.3, len + 0.3, concrete);
      for (let z = 3; z < len; z += 5.5) for (const x of [-wid / 2 + 0.7, -wid / 4, 0, wid / 4, wid / 2 - 0.7]) L.box(x - 0.3, x + 0.3, -4.2, -0.3, z - 0.3, z + 0.3, wood);
      L.box(-wid / 2, wid / 2, -1.9, -0.35, -2, len, hexRGB(0x4a4a46));
      if (kind === 'shed') {
        const xe = wid / 2 - 1.3, z0 = 8, z1 = len - 7, rg = hexRGB(0x56606a), wl = hexRGB(0x6d7b86);
        L.box(-xe, xe, 0.3, 6.6, z0, z1, wl);
        const cm = [0, 5, (z0 + z1) / 2];
        L.quad([-xe - 0.7, 6.4, z0 - 0.7], [-xe - 0.7, 6.4, z1 + 0.7], [0, 9.7, z1 + 0.7], [0, 9.7, z0 - 0.7], rg, cm); L.quad([xe + 0.7, 6.4, z1 + 0.7], [xe + 0.7, 6.4, z0 - 0.7], [0, 9.7, z0 - 0.7], [0, 9.7, z1 + 0.7], rg, cm);
        L.tri([-xe, 6.6, z0 - 0.02], [xe, 6.6, z0 - 0.02], [0, 9.6, z0 - 0.02], wl, [0, 5, z0 + 5]); L.tri([-xe, 6.6, z1 + 0.02], [xe, 6.6, z1 + 0.02], [0, 9.6, z1 + 0.02], wl, [0, 5, z1 - 5]);
        L.box(-4.5, 4.5, 0.3, 5.4, z0 - 0.15, z0 + 0.05, hexRGB(0x1a1d20)); L.box(-0.4, 0.4, 9.6, 10.2, z0, z1, hexRGB(0x80888f));
        for (let z = z0 + 6; z < z1 - 3; z += 9) { L.box(-xe - 0.08, -xe, 3.5, 5.2, z, z + 3.5, hexRGB(0x15181c)); L.box(xe, xe + 0.08, 3.5, 5.2, z, z + 3.5, hexRGB(0x15181c)); }
      } else if (kind === 'cont') {
        for (let z = 6; z < len - 8; z += 12.4) for (const x0 of [-9.6, -7.2, -4.8, -2.4, 0, 2.4, 4.8, 7.2]) {
          if (R() < 0.2) continue; const h = 1 + ((R() * 3.2) | 0);
          for (let y = 0; y < h; y++) L.box(x0, x0 + 2.3, 0.3 + y * 2.6, 2.8 + y * 2.6, z, z + 12, hexRGB(CONT[(R() * CONT.length) | 0]));
        }
      } else { // dzwig portowy nad woda
        const zc = len - 20, red = hexRGB(0xc23b22), dark = hexRGB(0x3a3f45);
        for (const z of [zc - 6, zc + 6]) for (const x of [-wid / 2 + 1.5, wid / 2 - 1.5]) L.box(x - 0.6, x + 0.6, 0.3, 30, z - 0.6, z + 0.6, red);
        for (const x of [-wid / 2 + 1.5, wid / 2 - 1.5]) { L.box(x - 0.5, x + 0.5, 12, 13, zc - 6, zc + 6, red); L.box(x - 0.5, x + 0.5, 27, 28, zc - 6, zc + 6, red); }
        L.box(-wid / 2 - 28, wid / 2 + 2, 30, 32.4, zc - 3.2, zc + 3.2, red); L.box(-wid / 2 - 30, -wid / 2 - 26, 31, 33, zc - 2.5, zc + 2.5, dark);
        L.box(-wid / 2 - 14, -wid / 2 - 10, 26, 30, zc - 2, zc + 2, dark); L.box(-wid / 2 - 12.2, -wid / 2 - 11.8, 14, 26, zc - 0.1, zc + 0.1, dark);
        L.box(-wid / 2 - 14, -wid / 2 - 10, 11, 14, zc - 3, zc + 3, hexRGB(0xd8a321));
        L.seg([wid / 2 - 1.5, 32.4, zc], [-wid / 2 - 29, 32, zc], 0.25, dark);
      }
      for (let z = 4; z < len; z += 22) for (const x of [-wid / 2 + 1, wid / 2 - 1]) { L.box(x - 0.08, x + 0.08, 0.3, 7, z - 0.08, z + 0.08, steel); L.box(x - 0.5 * Math.sign(x) - 0.2, x - 0.5 * Math.sign(x) + 0.2, 6.8, 7.1, z - 0.15, z + 0.15, steel); const q = rotXZ(x - 0.5 * Math.sign(x), z, rotY); pierLamps.push([org[0] + q[0], 6.7, org[2] + q[1]]); }
      for (let z = 2; z < len; z += 14) for (const x of [-wid / 2 + 0.6, wid / 2 - 0.6]) { const q = rotXZ(x, z, rotY); bollards.push([org[0] + q[0], 0.55, org[2] + q[1]]); }
      const q = rotXZ(0, len, rotY); beacons.push([org[0] + q[0], 2.2, org[2] + q[1]]);
      // cumujaca barka przy pirsie
      if (R() < 0.7) { const bg = buildBarge((R() * 3) | 0, R), off = (R() < 0.5 ? -1 : 1) * (wid / 2 + 7.5); L.append(bg, off, -0.6, len * 0.5 + (R() - 0.5) * 20, 0, 1); }
      S.append(L, org[0], 0, org[2], rotY, 1);
    }
  }
  // slupki balustrad, pacholy -- instancje
  const addInst = (geo, mat, list, place) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), o = new THREE.Object3D();
    list.forEach((it, i) => { place(o, it); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.count = list.length; m.frustumCulled = false; m.receiveShadow = true; scene.add(m); return m;
  };
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x2b2f34, roughness: 0.55, metalness: 0.5 });
  addInst(new THREE.BoxGeometry(0.1, 1.12, 0.1), steelMat, posts, (o, p) => { o.position.set(p[0][0], 0.96, p[0][2]); });
  const bolt = new THREE.CylinderGeometry(0.2, 0.28, 0.6, 8); bolt.translate(0, 0.3, 0);
  addInst(bolt, new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.6, metalness: 0.4 }), bollards, (o, p) => o.position.set(p[0], p[1], p[2]));

  // ---- dalekie brzegi: port (kontenery, dzwigi, magazyny) i panorama wiezowcow
  const farG = new Geo(), roofG = new Geo(), tallLights = [];
  const FM = (u, v, side) => side === 'W' ? [W0 - u, v] : side === 'E' ? [E0 + u, v] : [v, N0 - u]; // (u: od brzegu w glab ladu, v: wzdluz)
  // port przy wodzie
  const craneT = new Geo(); { // dzwig kontenerowy (dziob = +z ku wodzie)
    const bl = hexRGB(0x2a5f9a), dk = hexRGB(0x32373c);
    for (const x of [-7, 7]) for (const z of [-7, 5]) craneT.box(x - 0.7, x + 0.7, 0, 34, z - 0.7, z + 0.7, bl);
    for (const y of [10, 22, 33]) { craneT.box(-7.7, 7.7, y, y + 1.1, -7.7, 5.7, bl); }
    craneT.box(-8.5, 8.5, 33.5, 36.5, -14, 52, bl); craneT.box(-3, 3, 36.5, 38.2, 6, 14, dk); craneT.seg([0, 52, -14], [0, 38, 30], 0.4, dk);
    craneT.box(-2, 2, 24, 29, 20, 26, dk); craneT.box(-0.2, 0.2, 8, 24, 22.8, 23.2, dk); craneT.box(-1.5, 1.5, 6, 9, 21, 25, hexRGB(0xe2560f));
    craneT.box(-5.5, 5.5, 36.5, 39, -14, -8, dk);
  }
  const dockStrip = (side, v0, v1, spacing) => {
    for (let v = v0; v < v1; v += spacing * (0.8 + R() * 0.6)) {
      const [x, z] = FM(20, v, side), ang = side === 'W' ? Math.PI / 2 : side === 'E' ? -Math.PI / 2 : 0;
      const pick = R();
      if (pick < 0.3) { const [cx, cz] = FM(5, v, side); farG.append(craneT, cx, 0.5, cz, ang, 1); }
      else if (pick < 0.75) { // blok kontenerow
        for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
          const hgt = 1 + ((R() * 4) | 0), [qx, qz] = FM(8 + j * 6.6, v + i * 2.5 - 6, side);
          for (let y = 0; y < hgt; y++) farG.box(qx - 3, qx + 3, 0.5 + y * 2.6, 3.0 + y * 2.6, qz - 1.15, qz + 1.15, hexRGB(CONT[(R() * CONT.length) | 0]));
        }
      } else { const [qx, qz] = FM(26, v, side); const w = 30 + R() * 24; farG.box(qx - 16, qx + 16, 0.5, 12, qz - w / 2, qz + w / 2, hexRGB(0x6a6e72)); roofG.box(qx - 16.2, qx + 16.2, 12, 12.6, qz - w / 2 - 0.2, qz + w / 2 + 0.2, hexRGB(0x4a4d51)); }
    }
  };
  dockStrip('W', -1300, 1300, 60); dockStrip('E', -1300, 1300, 62); dockStrip('N', -800, 800, 60);
  // wiezowce
  const PAL = [0x3a4552, 0x465260, 0x586470, 0x6a6a68, 0x4a4650, 0x5a5048, 0x364252, 0x52606c, 0x7a7568, 0x434a56];
  const clusterH = {
    W: v => 12 + 150 * gs(v, 540, 190) + 110 * gs(v, -230, 170) + 60 * gs(v, 120, 150),
    E: v => 12 + 105 * gs(v, 410, 200) + 170 * gs(v, -260, 90) + 55 * gs(v, 40, 170),
    N: v => 12 + 60 * gs(v, -200, 250) + 70 * gs(v, 300, 200),
  };
  const tower = (x, z, w, d, h, col, uvo) => {
    const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y0 = 0.5, ctr = [x, h / 2, z];
    const su = 25.6 / 1, sv = 27.2, vw = h / sv, ow = uvo[0], oh = uvo[1];
    const P = (a, b, c) => [a, b, c], k = col;
    farG.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, h, z1), P(x0, h, z1), k, ctr, [ow, oh], [ow + w / su, oh], [ow + w / su, oh + vw], [ow, oh + vw]);
    farG.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, h, z0), P(x1, h, z0), k, ctr, [ow, oh], [ow + w / su, oh], [ow + w / su, oh + vw], [ow, oh + vw]);
    farG.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, h, z0), P(x1, h, z1), k, ctr, [ow, oh], [ow + d / su, oh], [ow + d / su, oh + vw], [ow, oh + vw]);
    farG.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, h, z1), P(x0, h, z0), k, ctr, [ow, oh], [ow + d / su, oh], [ow + d / su, oh + vw], [ow, oh + vw]);
    roofG.quad(P(x0, h, z1), P(x1, h, z1), P(x1, h, z0), P(x0, h, z0), hexRGB(0x3c3f44), ctr);
    return h;
  };
  const sky = (side, uMax, step) => {
    for (let u = 95; u < uMax; u += step * (0.8 + R() * 0.5)) {
      const vr = side === 'N' ? 1100 : 1700;
      for (let v = -vr; v < vr; v += 22 + R() * 22) {
        const w = 14 + R() * 20, d = 14 + R() * 20; let h = clusterH[side](v) * Math.exp(-u / (side === 'N' ? 260 : 420)) * (0.55 + R() * 0.85);
        h = Math.max(h, 9 + R() * 14); if (R() < 0.05) h *= 1.4;
        const [x, z] = FM(u + (R() - 0.5) * 14, v + (R() - 0.5) * 10, side);
        const base = mixHex(PAL[(R() * PAL.length) | 0], 0x5a6270, R() * 0.4), jv = 0.8 + R() * 0.3, col = [base[0] * jv, base[1] * jv, base[2] * jv];
        const uvo = [R(), R()];
        if (h > 75) { // schodkowy wiezowiec: trzon i nadbudowa
          const h1 = h * (0.55 + R() * 0.2); tower(x, z, w, d, h1, col, uvo); const h2 = tower(x, z, w * 0.68, d * 0.68, h, col, [uvo[1], uvo[0]]);
          if (h > 120 && R() < 0.8) { farG.box(x - 0.5, x + 0.5, h, h + 14 + R() * 24, z - 0.5, z + 0.5, hexRGB(0x50565c)); tallLights.push(x, h + 14, z); }
          else if (h > 105) tallLights.push(x, h + 1, z);
        } else tower(x, z, w, d, h, col, uvo);
        if (h > 14 && R() < 0.35) roofG.box(x - w * 0.2, x + w * 0.2, h, h + 2.4, z - d * 0.2, z + d * 0.2, hexRGB(0x56595e));
      }
    }
  };
  sky('W', 560, 40); sky('E', 520, 40); sky('N', 330, 42);
  const win = farWinTex();
  const farMat = new THREE.MeshStandardMaterial({ map: win.map, emissiveMap: win.emi, emissive: 0xffffff, emissiveIntensity: 0.3, vertexColors: true, roughness: 0.4, metalness: 0.3 });
  farMat.userData.env = 1;
  farMat.onBeforeCompile = sh => { // dodatkowa mgla atmosferyczna u podstawy dalekich budynkow
    sh.vertexShader = sh.vertexShader.replace('void main() {', 'varying float vWY;\nvoid main() {').replace('#include <project_vertex>', '#include <project_vertex>\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'varying float vWY;\nvoid main() {').replace('#include <fog_fragment>', `
  #ifdef USE_FOG
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, clamp(exp(-max(vWY, 0.0) / 55.0) * 0.55 * smoothstep(120.0, 420.0, fogDepth), 0.0, 0.9));
  #endif
  #include <fog_fragment>`);
  };
  state.farMat = farMat;
  const addMesh = (G, mat, shadow) => { const m = new THREE.Mesh(G.geometry(), mat); m.receiveShadow = !!shadow; m.castShadow = false; scene.add(m); return m; };
  addMesh(farG, farMat);
  addMesh(roofG, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  const aviation = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(tallLights, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: 0xff3a2a, size: 12, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  aviation.frustumCulled = false; scene.add(aviation); state.aviation = aviation;

  // ---- kolory nabrzeza i front
  const faceM = new THREE.Mesh(faceG.geometry(), new THREE.MeshStandardMaterial({ map: quay, roughness: 0.95, side: THREE.FrontSide })); faceM.receiveShadow = true; scene.add(faceM);
  const mS = addMesh(S, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 }), true);
  glowPoints(pierLamps.flat(), 0xffd9a0, 5);

  // ---- lodzie ruchome
  buildFleet(ctx, state, lights);
  // ---- boje
  const buoys = []; for (let i = 0; i < 26; i++) { const west = i % 2 === 0; buoys.push([west ? sr2(R, -626, -560) : sr2(R, 400, 575), sr2(R, -620, 1500), i % 4 < 2 ? 0 : 1]); }
  { const bg = new THREE.ConeGeometry(0.9, 2.6, 8); bg.translate(0, 1.3, 0); const bm = new THREE.InstancedMesh(bg, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), buoys.length), o = new THREE.Object3D();
    buoys.forEach((b, i) => { o.position.set(b[0], -1.2, b[1]); o.updateMatrix(); bm.setMatrixAt(i, o.matrix); const c = b[2] ? [0.1, 0.55, 0.2] : [0.85, 0.12, 0.1]; bm.setColorAt(i, new THREE.Color().setRGB(lin(c[0]), lin(c[1]), lin(c[2]))); });
    bm.instanceColor.needsUpdate = true; bm.frustumCulled = false; scene.add(bm); state.buoys = buoys; }
  const stat = []; for (const b of buoys) stat.push(b[0], 1.9, b[1]); for (const p of beacons) stat.push(p[0], p[1], p[2]);
  state.statLights = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(stat, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: 0xffb050, size: 5, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  state.statLights.frustumCulled = false; scene.add(state.statLights);

  buildGulls(ctx, state, R);
  buildStatue(ctx, state, isl);
  state.update = null;
}
const sr2 = (R, a, b) => a + R() * (b - a);
const gs = (v, c, w) => Math.exp(-(((v - c) / w) * ((v - c) / w)));

// ---------------------------------------------------------------- statki ruchome, kilwater, swiatla
function buildFleet(ctx, state, lights) {
  const { scene, glowTexture } = ctx;
  const T = { ferry: buildFerry(), tour: buildTour(), tug: buildTug(), sail: buildSail(), speed: buildSpeed(), cargo: buildCargo() };
  const SPEC = [ // klasa, os x toru, kierunek (+1 = na poludnie), predkosc m/s
    ['ferry', -500, -1, 9.5], ['ferry', 478, 1, 9], ['tour', -520, 1, 5.5], ['tour', 568, -1, 6], ['tour', 478, -1, 5.2], ['tug', -588, -1, 4], ['tug', 495, 1, 3.8], ['tug', -535, 1, 4.2],
    ['sail', -545, 1, 3.2], ['sail', -480, -1, 2.8], ['sail', 555, 1, 3.4], ['sail', 520, -1, 3.0], ['sail', -570, -1, 3.1], ['speed', -560, -1, 19], ['speed', 540, 1, 17], ['cargo', -612, 1, 5], ['cargo', 575, -1, 4.6],
  ];
  const byCls = {}; SPEC.forEach((s, i) => (byCls[s[0]] = byCls[s[0]] || []).push(i));
  const R = mulberry(61), wakeCount = SPEC.length, ZMIN = -820, ZMAX = 1900;
  state.boats = SPEC.map((s, i) => ({ k: s[0], lane: s[1], dir: s[2], v: s[3], s: ZMIN + R() * 1700 * 0.9 + 80, ph: R() * 6.28, i, L: T[s[0]].L }));
  state.meshes = {};
  const solidMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2430, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.15, metalness: 0.3 });
  glassMat.userData.lin = false; state.glassMat = glassMat;
  const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  wakeMat.userData.lin = true; state.wakeMat = wakeMat;
  for (const [k, ids] of Object.entries(byCls)) {
    const t = T[k], ms = new THREE.InstancedMesh(t.g.geometry(), solidMat, ids.length); ms.frustumCulled = false; ms.receiveShadow = false; scene.add(ms);
    let mg = null; if (t.l.p.length) { mg = new THREE.InstancedMesh(t.l.geometry(), glassMat, ids.length); mg.instanceMatrix = ms.instanceMatrix; mg.frustumCulled = false; scene.add(mg); }
    state.meshes[k] = { ms, mg, ids, t };
    ids.forEach((id, n) => { state.boats[id].n = n; });
  }
  const wg = new THREE.PlaneGeometry(1, 1); wg.rotateX(-Math.PI / 2); wg.translate(0, 0, -0.5); // przod z=0, ciagnie sie ku -z
  const wm = new THREE.InstancedMesh(wg, wakeMat, wakeCount); wm.frustumCulled = false; wm.renderOrder = 2; scene.add(wm); state.wake = wm;
  // swiatla nawigacyjne
  const nl = state.boats.reduce((a, b) => a + T[b.k].lights.length, 0), pos = new Float32Array(nl * 3), col = new Float32Array(nl * 3);
  let q = 0; for (const b of state.boats) for (const L of T[b.k].lights) { col[q * 3] = L[3]; col[q * 3 + 1] = L[4]; col[q * 3 + 2] = L[5]; q++; }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  state.navLights = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTexture(), size: 2.6, vertexColors: true, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  state.navLights.frustumCulled = false; scene.add(state.navLights); state.T = T; state.pos = pos;
  const o = new THREE.Object3D(), ow = new THREE.Object3D();
  state.stepBoats = (dt, t) => {
    let q = 0;
    for (const b of state.boats) {
      b.s += b.dir * b.v * dt; if (b.s > ZMAX) b.s = ZMIN; else if (b.s < ZMIN) b.s = ZMAX;
      const sway = Math.sin(b.s * 0.011 + b.ph) * 5, dsw = Math.cos(b.s * 0.011 + b.ph) * 5 * 0.011;
      const x = b.lane + sway, z = b.s, head = (b.dir > 0 ? 0 : Math.PI) + Math.atan(dsw);
      const bob = Math.sin(t * 0.9 + b.ph) * 0.1, roll = Math.sin(t * 0.7 + b.ph * 2) * 0.025, pitch = Math.sin(t * 0.55 + b.ph) * 0.012;
      const m = state.meshes[b.k];
      o.position.set(x, -1.2 + bob + (b.k === 'speed' ? 0.15 : 0), z); o.rotation.set(pitch, head, roll, 'YXZ'); o.updateMatrix(); m.ms.setMatrixAt(b.n, o.matrix);
      const L = b.L, big = b.k === 'cargo' ? 1 : 0, fast = b.k === 'speed' ? 1.6 : 1;
      ow.position.set(x - Math.sin(head) * L * 0.5, -1.15, z - Math.cos(head) * L * 0.5); ow.rotation.set(0, head, 0); ow.scale.set(L * 0.55 * fast + 2, 1, L * (b.k === 'sail' ? 2.2 : 3.4) * (b.v > 12 ? 1.4 : 1)); ow.updateMatrix(); state.wake.setMatrixAt(b.i, ow.matrix);
      const co = Math.cos(head), si = Math.sin(head);
      for (const lp of state.T[b.k].lights) { state.pos[q * 3] = x + lp[0] * co + lp[2] * si; state.pos[q * 3 + 1] = lp[1] - 1.2 + bob; state.pos[q * 3 + 2] = z - lp[0] * si + lp[2] * co; q++; }
    }
    for (const k in state.meshes) state.meshes[k].ms.instanceMatrix.needsUpdate = true;
    state.wake.instanceMatrix.needsUpdate = true; state.navLights.geometry.attributes.position.needsUpdate = true;
  };
  state.stepBoats(0, 0);
}

// ---------------------------------------------------------------- mewy
function buildGulls(ctx, state, R) {
  const { scene } = ctx, N = 30;
  const wing = new THREE.BufferGeometry(); // prawe skrzydlo (os x+), zawias w 0
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.18, 0, 0, -0.2, 0.9, 0.04, 0.05, 0.9, 0.04, 0.05, 0, 0, -0.2, 1.4, 0.02, -0.25, 1.4, 0.02, -0.25, 0.9, 0.04, 0.05, 0, 0, -0.2], 3));
  wing.setAttribute('normal', new THREE.Float32BufferAttribute(Array(9).fill([0, 1, 0]).flat(), 3));
  const wl = wing.clone(); wl.scale(-1, 1, 1);
  const body = new THREE.BoxGeometry(0.22, 0.2, 0.7);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8, side: THREE.DoubleSide });
  const mk3 = g => { const m = new THREE.InstancedMesh(g, mat, N); m.frustumCulled = false; scene.add(m); return m; };
  const mW = mk3(wing), mL = mk3(wl), mB = mk3(body);
  const birds = Array.from({ length: N }, (_, i) => { const w = R() < 0.6; return { cx: w ? sr2(R, -660, -330) : sr2(R, 360, 600), cz: sr2(R, -560, 900), r: sr2(R, 18, 70), y: sr2(R, 10, 55), a: R() * 6.28, sp: sr2(R, 0.1, 0.22) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28, fr: sr2(R, 3.5, 6) }; });
  const g = new THREE.Object3D(), w = new THREE.Object3D(); g.add(w); const mm = new THREE.Matrix4();
  state.stepGulls = (dt, t) => {
    birds.forEach((b, i) => {
      b.a += b.sp * dt; const x = b.cx + Math.cos(b.a) * b.r, z = b.cz + Math.sin(b.a) * b.r * 0.8, y = b.y + Math.sin(t * 0.3 + b.ph) * 3;
      const sg = Math.sign(b.sp);
      g.position.set(x, y, z); g.rotation.set(0, Math.atan2(-Math.sin(b.a) * sg, 0.8 * Math.cos(b.a) * sg), -0.25 * sg, 'YXZ'); g.updateMatrix();
      mB.setMatrixAt(i, g.matrix);
      const f = Math.sin(t * b.fr + b.ph) * 0.55 * (Math.sin(t * 0.25 + b.ph * 3) > -0.3 ? 1 : 0.1);
      w.rotation.z = f; w.updateMatrix(); mm.multiplyMatrices(g.matrix, w.matrix); mW.setMatrixAt(i, mm);
      w.rotation.z = -f; w.updateMatrix(); mm.multiplyMatrices(g.matrix, w.matrix); mL.setMatrixAt(i, mm);
    });
    mW.instanceMatrix.needsUpdate = mL.instanceMatrix.needsUpdate = mB.instanceMatrix.needsUpdate = true;
  };
  state.stepGulls(0, 0);
}

// ---------------------------------------------------------------- Statua Wolnosci na wyspie
function buildStatue(ctx, state, isl) {
  const { scene, glowTexture } = ctx, g = new Geo(), torch = new Geo();
  const rock = hexRGB(0x6c675d), grass = hexRGB(0x56693c), stone = hexRGB(0xb5ad9a), stoneD = hexRGB(0x9d9582), pat = hexRGB(0x62a595), patD = hexRGB(0x4a8578), gold = hexRGB(0xf0c040);
  // wyspa i fort w ksztalcie 11-ramiennej gwiazdy
  const star = (r1, r2) => Array.from({ length: 22 }, (_, i) => { const a = i / 22 * Math.PI * 2, r = i % 2 ? r2 : r1; return [Math.cos(a) * r, Math.sin(a) * r]; });
  g.loft(ngonPts(0, 0, isl.g * 1.12, 28), -4, ngonPts(0, 0, isl.g * 0.96, 28), 0.5, rock, false, 0.3);
  g.loft(ngonPts(0, 0, isl.g * 0.96, 28), 0.5, ngonPts(0, 0, isl.g * 0.92, 28), 0.7, grass, true, 0.4);
  g.loft(star(44, 31), 0.5, star(40, 29), 7.5, stoneD, false, 0.25); g.loft(star(40, 29), 7.5, star(36, 27), 8.4, grass, true, 0.3);
  // cokol: dwa stopnie i trzon z balkonem
  g.box(-17, 17, 8.4, 14, -17, 17, stone); g.box(-14, 14, 14, 24, -14, 14, stone); g.box(-15.5, 15.5, 24, 25.2, -15.5, 15.5, stoneD);
  g.box(-11, 11, 25.2, 41, -11, 11, stone); g.box(-12.5, 12.5, 41, 43, -12.5, 12.5, stoneD); g.box(-8.2, 8.2, 43, 47, -8.2, 8.2, stone); g.box(-9, 9, 47, 47.8, -9, 9, stoneD);
  for (const s of [-1, 1]) for (const a of [-6, 0, 6]) { g.box(s * 11.05, s * 11.4, 28, 38, a - 1.2, a + 1.2, stoneD); g.box(a - 1.2, a + 1.2, 28, 38, s * 11.05, s * 11.4, stoneD); }
  const y0 = 47.8, off = (y) => [Math.sin(y * 0.05) * 0.4, 0];
  const ring = (y, r, sx = 1, sz = 1, cx = 0, cz = 0) => ngonPts(cx, cz, r, 14, 0.2, sx, sz);
  // szata (patyna) — kilka pierscieni
  const rows = [[y0, 8.4, 1.0, 1.0], [y0 + 8, 7.4, 1.0, 0.95], [y0 + 17, 5.6, 1.0, 0.9], [y0 + 25, 4.4, 1.0, 0.85], [y0 + 31, 4.2, 1.05, 0.8], [y0 + 36, 3.6, 1.15, 0.75]];
  for (let i = 0; i < rows.length - 1; i++) { const A = rows[i], B = rows[i + 1]; g.loft(ring(A[0], A[1], A[2], A[3]), A[0], ring(B[0], B[1], B[2], B[3]), B[0], i % 2 ? pat : patD, false, 0.35); }
  g.loft(ring(0, 3.6, 1.15, 0.75), y0 + 36, ring(0, 2.6, 1, 1), y0 + 38.5, pat, false, 0.2); // ramiona
  g.loft(ring(0, 2.6, 1, 1), y0 + 38.5, ring(0, 1.0, 1, 1), y0 + 40, pat, true, 0.2); // szyja
  // glowa
  const head = [[y0 + 39, 1.2], [y0 + 40.6, 2.15], [y0 + 43, 2.3], [y0 + 45.5, 1.8], [y0 + 46.8, 0.7]];
  for (let i = 0; i < head.length - 1; i++) g.loft(ngonPts(0, 0, head[i][1], 10), head[i][0], ngonPts(0, 0, head[i + 1][1], 10), head[i + 1][0], i % 2 ? patD : pat, i === head.length - 2, 0.15);
  // korona: 7 promieni
  for (let i = 0; i < 7; i++) { const a = (i - 3) / 3 * 1.25 + Math.PI / 2, dx = Math.cos(a), dz = Math.sin(a) * 0.9; const ry = y0 + 44.3 + (3 - Math.abs(i - 3)) * 0.12; g.seg([dx * 1.6, ry, dz * 1.6], [dx * 5.6, ry + 2.0 + (3 - Math.abs(i - 3)) * 0.25, dz * 5.6], 0.45, patD); }
  g.loft(ngonPts(0, 0, 2.35, 10), y0 + 44.2, ngonPts(0, 0, 2.05, 10), y0 + 45, patD, false);
  // prawa reka z pochodnia (skierowana w gore)
  const sh = [4.1, y0 + 36.5, 0], el = [6.2, y0 + 45, 0.2], hand = [7.0, y0 + 55, 0];
  g.seg(sh, el, 2.5, pat); g.seg(el, hand, 2.0, patD); g.box(5.7, 8.4, y0 + 52, y0 + 56.4, -1.5, 1.5, patD);
  g.box(5.9, 8.2, y0 + 56.4, y0 + 62, -0.55, 0.55, pat); g.box(4.3, 9.8, y0 + 62, y0 + 63, -2.8, 2.8, gold); g.box(5.2, 8.9, y0 + 63, y0 + 65, -1.9, 1.9, gold);
  torch.loft(ngonPts(7.05, 0, 1.9, 8), y0 + 65, ngonPts(7.05, 0, 0.9, 8), y0 + 69, [1, 0.78, 0.25], false); torch.loft(ngonPts(7.05, 0, 0.9, 8), y0 + 69, ngonPts(7.05, 0, 0.08, 8), y0 + 72.5, [1, 0.9, 0.5], true);
  // lewa reka z tablica
  g.seg([-4.0, y0 + 36, 0.3], [-5.2, y0 + 30, 2.6], 2.1, patD); g.seg([-5.2, y0 + 30, 2.6], [-3, y0 + 26.5, 4.2], 1.8, pat);
  g.rbox(-4.2, y0 + 29, 4.2, 7.5, 10, 1.5, -4.2, y0 + 29, 9, patD); g.rbox(-4.2, y0 + 29.1, 4.9, 6.8, 9.2, 0.5, -4.2, y0 + 29.1, 9, stone);
  // draperia z tylu
  g.rbox(-0.5, y0 + 30, -3.6, 4.5, 14, 1.2, -0.5, y0 + 30, -9, patD);
  g.loft(ngonPts(0, 0, 8.4, 14), y0, ngonPts(0, 0, 9.0, 14), y0 + 0.4, patD, false);
  const sc = 1.1, rotY = 2.7;
  // skala: cala figura razem z wyspa (tylko cokol i statua), wiec skalujemy mesh
  const mesh = new THREE.Mesh(g.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15 }));
  mesh.position.set(isl.x, 0, isl.z); mesh.rotation.y = rotY; mesh.scale.set(sc, sc, sc); scene.add(mesh);
  const flame = new THREE.Mesh(torch.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
  flame.position.copy(mesh.position); flame.rotation.y = rotY; flame.scale.setScalar(sc); scene.add(flame);
  const tp = new V3(7.05, y0 + 69, 0).multiplyScalar(sc).applyAxisAngle(new V3(0, 1, 0), rotY).add(mesh.position);
  state.torch = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([tp.x, tp.y, tp.z], 3)), new THREE.PointsMaterial({ map: glowTexture(), color: 0xffc860, size: 60, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5 }));
  state.torch.frustumCulled = false; scene.add(state.torch);
  // lampy u podstawy (noca)
  const lp = []; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; lp.push(isl.x + Math.cos(a) * 36, 8, isl.z + Math.sin(a) * 36); }
  state.islLights = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)), new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd9a0, size: 14, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  state.islLights.frustumCulled = false; scene.add(state.islLights);
  // nocna iluminacja: pomaranczowa poswiata na cokole
  state.statueMesh = mesh;
}

// ---------------------------------------------------------------- mosty: dodatki (liny skosne, ostrołuki, latarnie)
export function dressBridge(xa, xb, z, kind) {
  const ctx = CTX, { scene, glowPoints } = ctx, stone = kind === 'stone', deckY = 38, W = 13, L = xb - xa, tH = stone ? 84 : 92, tx = [xa + L * 0.3, xb - L * 0.3];
  const G = new Geo(), st = hexRGB(0xb3a086), stD = hexRGB(0x8a7a64), seg = [], red = [];
  for (const x of tx) {
    if (stone) {
      // ostroluk w kazdym portalu: ceglane "klinowe" wypelnienia naroży i jasny gzyms po obu stronach
      for (const sx of [-1, 1]) for (const zs of [-1, 1]) for (let k = 0; k < 10; k++) {
        const t = (k + 0.5) / 10, wdt = (W / 2 - 0.75) * Math.sqrt(1 - t * t * 0.9), yy = deckY + 13.5 + k * 0.85, za = z + zs * wdt, zb = z + zs * (W / 2 + 0.2);
        G.box(sx > 0 ? x + 5.0 : x - 5.25, sx > 0 ? x + 5.25 : x - 5.0, yy, yy + 0.86, Math.min(za, zb), Math.max(za, zb), stD);
      }
      for (const sx of [-1, 1]) { G.box(x + sx * 5.0, x + sx * 5.5, deckY + 26, deckY + 27, z - 7.5, z + 7.5, st); G.box(x + sx * 5.0, x + sx * 5.4, deckY + 21.4, deckY + 21.8, z - 7.5, z + 7.5, st); }
      for (const zs of [-1, 1]) for (const dxx of [-3.6, 0, 3.6]) { G.box(x + dxx - 0.8, x + dxx + 0.8, tH, tH + 7 + (dxx === 0 ? 3 : 0), z + zs * (W / 2 + 1.5) - 0.8, z + zs * (W / 2 + 1.5) + 0.8, stD); }
      for (const zs of [-1, 1]) red.push(x, tH + 11, z + zs * (W / 2 + 1.5));
      // liny skosne (wachlarz) i pionowe w kazda strone od wiezy
      for (const zs of [-1, 1]) for (let d = 10; d < L * 0.34; d += 9) for (const dir of [-1, 1]) { const px = x + dir * d; if (px < xa + ramp(L) || px > xb - ramp(L)) continue; seg.push(x + dir * 1.0, tH - 8 - d * 0.02, z + zs * (W / 2 + 0.2), px, deckY + 1.5, z + zs * (W / 2 + 0.2)); }
    } else {
      for (const zs of [-1, 1]) { G.box(x - 1.3, x + 1.3, tH, tH + 4, z + zs * (W / 2 + 1) - 1.3, z + zs * (W / 2 + 1) + 1.3, stD); red.push(x, tH + 6, z + zs * (W / 2 + 1)); }
      for (let y = deckY + 6; y < tH - 6; y += 16) for (const zs of [-1, 1]) { G.seg([x, y, z + zs * (W / 2 + 1)], [x, y + 16, z - zs * (W / 2 + 1)], 0.45, hexRGB(0x56606a)); }
      // gorne lacznie w ksztalcie luku portalowego
      for (let k = 0; k <= 10; k++) { const t = k / 10, ang = t * Math.PI, zz = z + Math.cos(ang) * (W / 2 + 1), yy = tH - 4 + Math.sin(ang) * 3.2; G.box(x - 1.0, x + 1.0, yy - 0.6, yy + 0.6, zz - 0.5, zz + 0.5, hexRGB(0x6f7c86)); }
    }
  }
  if (G.p.length) { const m = new THREE.Mesh(G.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: stone ? 0.05 : 0.4 })); m.receiveShadow = true; scene.add(m); }
  if (seg.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); scene.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: stone ? 0x4a4f55 : 0x56606a, transparent: true, opacity: 0.85 }))); }
  // swiatla ostrzegawcze na wiezach (czerwone), floodlights wiez
  if (red.length) glowPoints(red, 0xff3a2a, 6);
  const fl = []; for (const x of tx) fl.push(x, deckY + 5, z - W / 2 - 3, x, deckY + 5, z + W / 2 + 3, x, 40, z);
  glowPoints(fl, stone ? 0xffe0a8 : 0xd8e4ff, 9);
}
const ramp = L => Math.min(70, L * 0.22);

// ---------------------------------------------------------------- aktualizacja co klatke
let _lastT = 0;
export function updateWater(dt) {
  const ctx = CTX; if (!ctx) return; const st = ctx.state; if (!st) return;
  st.t += dt; const t = st.t, U = st.U, tod = ctx.getTOD();
  U.uT.value = t; U.uSun.value.copy(ctx.sunDir);
  if (tod !== st.tod) {
    st.tod = tod; const T = WTOD[tod] || WTOD.sunset;
    U.uShallow.value.setRGB(...hexRGB(T.shallow)); U.uDeep.value.setRGB(...hexRGB(T.deep)); U.uSky.value.setRGB(T.sky[0] ** 2.2, T.sky[1] ** 2.2, T.sky[2] ** 2.2);
    U.uSunCol.value.setRGB(...hexRGB(T.sun)); U.uGlit.value = T.glit; U.uFres.value = T.fres; U.uLights.value = T.lights; U.uFoam.value = T.foam;
    const night = tod === 'night', sun = tod === 'sunset';
    st.glassMat.emissiveIntensity = night ? 1.4 : sun ? 0.35 : 0;
    st.farMat.emissiveIntensity = night ? 1.15 : sun ? 0.4 : 0.02;
    st.navLights.material.opacity = night ? 1 : sun ? 0.35 : 0; st.statLights.material.opacity = night ? 1 : sun ? 0.3 : 0; st.aviation.material.opacity = night ? 1 : sun ? 0.5 : 0.1;
    st.islLights.material.opacity = night ? 1 : 0; st.torch.material.opacity = night ? 1 : sun ? 0.7 : 0.25;
    const wk = night ? [0.18, 0.2, 0.25] : sun ? [0.95, 0.8, 0.62] : [0.92, 0.95, 0.98]; st.wakeMat.color.setRGB(lin(wk[0]), lin(wk[1]), lin(wk[2]));
  }
  st.stepBoats(dt, t); st.stepGulls(dt, t);
}
