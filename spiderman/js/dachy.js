// Dachy i reklamy: klimatyzatory z wolno obracajacymi sie wentylatorami, budki wind i wyjscia na dach, zbiorniki na wode,
// maszty z migajacymi swiatlami, helipady, panele solarne, ogrody dachowe, pranie, drabiny, anteny, graffiti, a takze
// duze ekrany reklamowe (animowane) i neonowe szyldy HOTEL / BAR / PIZZA, ktore nocy daja poswiate.
// Wszystko scalone w kawalki 128 x 128 m. Poziom "baza" (duze sylwetki) budowany od razu, poziom "detal" (rury, anteny,
// pranie, ogrody...) - leniwie, tylko blisko gracza. Wlasne losowanie z ziarnem: nie zmienia ukladu miasta.
import { G } from './stan.js';
import { scene, camera, renderer } from './stan.js';
import { cv, canvasTex, dbg } from './util.js';
import { perches, addBox, glowTexture } from './miasto.js';

// ---------------------------------------------------------------- losowanie i kolory
const mulberry = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const LC = new Map();
const lin = h => { let c = LC.get(h); if (!c) { const k = new THREE.Color(h).convertSRGBToLinear(); c = [k.r, k.g, k.b]; LC.set(h, c); } return c; };
const pick = (rng, a) => a[Math.floor(rng() * a.length)];
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- konstruktor geometrii (indeksowany, atrybuty skompresowane)
const FACES = [[[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[-1, 0, 0], [0, 0, 1], [0, 1, 0]], [[0, 1, 0], [1, 0, 0], [0, 0, -1]], [[0, -1, 0], [1, 0, 0], [0, 0, 1]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]], [[0, 0, -1], [-1, 0, 0], [0, 1, 0]]];
class B {
  constructor(spin) { this.spin = spin; this.p = []; this.n = []; this.c = []; this.v = []; this.s = []; this.i = []; this.k = 0; this.sd = 12345; }
  jit() { this.sd = (this.sd * 16807) % 2147483647; return (this.sd - 1) / 2147483646; }
  rgb(col, o) { const c = lin(col), j = 1 + (o.j ?? 0.12) * (this.jit() * 2 - 1); return [c[0] * j, c[1] * j, c[2] * j]; }
  // czworokat CCW patrzac z zewnatrz
  q(pts, n, rgb, o, ox = 0, oy = 0, oz = 0) {
    const b = this.k, r = o.r ?? 0.8, m = o.m ?? 0, e = o.e ?? 0, sp = o.sp;
    for (const p of pts) {
      this.p.push(p[0] + ox, p[1] + oy, p[2] + oz); this.n.push(n[0], n[1], n[2]); this.c.push(rgb[0], rgb[1], rgb[2]);
      this.v.push(r, m, e / 10, 0); if (this.spin) this.s.push(sp ? sp[0] : 0, sp ? sp[1] : 0, sp ? sp[2] : 0, sp ? sp[3] : 0);
    }
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3); this.k += 4;
  }
  // prostopadloscian ze srodkiem w (cx,cy,cz), polowkami (hx,hy,hz), obrotem yaw wokol Y i pitch wokol X
  xbox(cx, cy, cz, hx, hy, hz, yaw, pitch, col, o = {}) {
    const rgb = this.rgb(col, o), cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const R = (x, y, z) => { const y1 = y * cp - z * sp, z1 = y * sp + z * cp; return [x * cw + z1 * sw, y1, -x * sw + z1 * cw]; };
    for (let f = 0; f < 6; f++) {
      if (f === 3 && !o.under) continue;
      const [n, u, v] = FACES[f];
      const hu = Math.abs(u[0]) * hx + Math.abs(u[1]) * hy + Math.abs(u[2]) * hz, hv = Math.abs(v[0]) * hx + Math.abs(v[1]) * hy + Math.abs(v[2]) * hz, hn = Math.abs(n[0]) * hx + Math.abs(n[1]) * hy + Math.abs(n[2]) * hz;
      const c0 = [n[0] * hn, n[1] * hn, n[2] * hn], pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => R(c0[0] + u[0] * hu * a + v[0] * hv * b, c0[1] + u[1] * hu * a + v[1] * hv * b, c0[2] + u[2] * hu * a + v[2] * hv * b));
      this.q(pts, R(n[0], n[1], n[2]), rgb, o, cx, cy, cz);
    }
  }
  box(x0, x1, y0, y1, z0, z1, col, o) { this.xbox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2, 0, 0, col, o); }
  // walec / stozek: podstawa w (cx,cy,cz), wysokosc h, obrot jak wyzej
  cyl(cx, cy, cz, r0, r1, h, seg, col, o = {}, yaw = 0, pitch = 0) {
    const rgb = this.rgb(col, o), cw = Math.cos(yaw), sw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const R = (x, y, z) => { const y1 = y * cp - z * sp, z1 = y * sp + z * cp; return [x * cw + z1 * sw + cx, y1 + cy, -x * sw + z1 * cw + cz]; };
    const Rn = (x, y, z) => { const y1 = y * cp - z * sp, z1 = y * sp + z * cp; return [x * cw + z1 * sw, y1, -x * sw + z1 * cw]; };
    const r = o.r ?? 0.8, m = o.m ?? 0, e = o.e ?? 0, spn = o.sp, base = this.k;
    const push = (p, n) => { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.c.push(rgb[0], rgb[1], rgb[2]); this.v.push(r, m, e / 10, 0); if (this.spin) this.s.push(spn ? spn[0] : 0, spn ? spn[1] : 0, spn ? spn[2] : 0, spn ? spn[3] : 0); this.k++; };
    const sl = r0 - r1, nl = Math.hypot(h, sl) || 1;
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * TAU, ca = Math.cos(a), sa = Math.sin(a), n = Rn(ca * h / nl, sl / nl, sa * h / nl);
      push(R(ca * r0, 0, sa * r0), n); push(R(ca * r1, h, sa * r1), n);
    }
    for (let i = 0; i < seg; i++) { const a = base + i * 2; this.i.push(a, a + 3, a + 1, a, a + 2, a + 3); }
    if (r1 > 0.001) {
      const c0 = this.k, n = Rn(0, 1, 0); push(R(0, h, 0), n);
      for (let i = 0; i <= seg; i++) { const a = i / seg * TAU; push(R(Math.cos(a) * r1, h, Math.sin(a) * r1), n); }
      for (let i = 0; i < seg; i++) this.i.push(c0, c0 + 2 + i, c0 + 1 + i);
    }
  }
  // wielokat plaski (poziomy) lezacy na dachu: wachlarz od srodka
  disc(cx, cz, rx, rz, y, seg, col, o = {}, rot = 0) {
    const rgb = this.rgb(col, o), c0 = this.k, r = o.r ?? 0.9, m = o.m ?? 0, e = o.e ?? 0, cr = Math.cos(rot), sr = Math.sin(rot);
    const push = (x, z) => { this.p.push(x, y, z); this.n.push(0, 1, 0); this.c.push(rgb[0], rgb[1], rgb[2]); this.v.push(r, m, e / 10, 0); if (this.spin) this.s.push(0, 0, 0, 0); this.k++; };
    push(cx, cz);
    for (let i = 0; i <= seg; i++) { const a = i / seg * TAU, wb = o.round ? 1 : 1 + 0.2 * Math.sin(a * 3 + rot * 5) + 0.12 * Math.sin(a * 5 + rot * 2), px = Math.cos(a) * rx * wb, pz = Math.sin(a) * rz * wb; push(cx + px * cr - pz * sr, cz + px * sr + pz * cr); }
    for (let i = 0; i < seg; i++) this.i.push(c0, c0 + 2 + i, c0 + 1 + i);
  }
  flat(x0, x1, z0, z1, y, col, o = {}) { this.q([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], this.rgb(col, o), o); }
  // odcinek (kabel, rura, szczebel) miedzy dwoma punktami
  seg(P, Q, t, col, o = {}) {
    const dx = Q[0] - P[0], dy = Q[1] - P[1], dz = Q[2] - P[2], hz = Math.hypot(dx, dz), L = Math.hypot(hz, dy);
    if (L < 0.01) return;
    this.xbox((P[0] + Q[0]) / 2, (P[1] + Q[1]) / 2, (P[2] + Q[2]) / 2, t / 2, t / 2, L / 2, Math.atan2(dx, dz), -Math.atan2(dy, hz), col, o);
  }
  cable(P, Q, sag, t, col, o = {}) { // przewieszony kabel (4 odcinki)
    let prev = P;
    for (let i = 1; i <= 4; i++) { const f = i / 4, nx = P[0] + (Q[0] - P[0]) * f, ny = P[1] + (Q[1] - P[1]) * f - sag * 4 * f * (1 - f), nz = P[2] + (Q[2] - P[2]) * f; this.seg(prev, [nx, ny, nz], t, col, o); prev = [nx, ny, nz]; }
  }
  geo() {
    if (!this.k) return null;
    const g = new THREE.BufferGeometry(), N = this.n.length;
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    const nn = new Int8Array(N); for (let i = 0; i < N; i++) nn[i] = Math.round(this.n[i] * 127);
    g.setAttribute('normal', new THREE.BufferAttribute(nn, 3, true));
    const cc = new Uint8Array(this.c.length); for (let i = 0; i < cc.length; i++) cc[i] = Math.max(0, Math.min(255, Math.round(this.c[i] * 255)));
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3, true));
    const vv = new Uint8Array(this.v.length); for (let i = 0; i < vv.length; i++) vv[i] = Math.max(0, Math.min(255, Math.round(this.v[i] * 255)));
    g.setAttribute('aV', new THREE.BufferAttribute(vv, 4, true));
    if (this.spin) g.setAttribute('aSp', new THREE.Float32BufferAttribute(this.s, 4));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.i), 1));
    g.computeBoundingSphere(); if (this.spin) g.boundingSphere.radius += 2;
    return g;
  }
}
// reklamy: czworokaty z atlasem (uv lokalne, prostokat w atlasie, parametry animacji)
class A {
  constructor() { this.p = []; this.u = []; this.r = []; this.a = []; this.i = []; this.k = 0; }
  face(cx, cy, cz, w, h, yaw, rect, anim) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const x = a * w / 2; this.p.push(cx + x * c, cy + b * h / 2, cz - x * s); this.u.push(a > 0 ? 1 : 0, b > 0 ? 1 : 0); this.r.push(...rect); this.a.push(...anim);
    }
    this.i.push(this.k, this.k + 1, this.k + 2, this.k, this.k + 2, this.k + 3); this.k += 4;
  }
  geo() {
    if (!this.k) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('aR', new THREE.Float32BufferAttribute(this.r, 4)); g.setAttribute('aN', new THREE.Float32BufferAttribute(this.a, 4));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.i), 1)); g.computeBoundingSphere(); return g;
  }
}
// swiatla punktowe (swiecace punkty): pozycja, kolor, rozmiar, tryb, faza
class L {
  constructor() { this.p = []; this.c = []; this.s = []; this.m = []; }
  add(x, y, z, col, size, mode, ph = 0) { this.p.push(x, y, z); this.c.push(col[0], col[1], col[2]); this.s.push(size); this.m.push(mode, ph); }
  geo() {
    if (!this.s.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(this.s, 1)); g.setAttribute('aM', new THREE.Float32BufferAttribute(this.m, 2)); g.computeBoundingSphere(); return g;
  }
}
const RED = [1, 0.12, 0.08], WARM = [1, 0.75, 0.4], COOL = [0.75, 0.88, 1], GREEN = [0.2, 1, 0.4], WHITE = [1, 1, 1];
// tryby swiatel: 0 czerwona lampa ostrzegawcza (miga), 1 tylko po zmroku, 2 stroboskop, 3 stale, 4 neon (lekko faluje)

// ---------------------------------------------------------------- atlas tekstur reklam i szyldow (2048 x 2048)
const AT = 2048;
const rectOf = (x, y, w, h) => [x / AT, 1 - (y + h) / AT, w / AT, h / AT];
const ADRECT = i => rectOf((i % 2) * 1024, Math.floor(i / 2) * 256, 512, 256);        // 8 reklam po 2 klatki
const TKRECT = i => rectOf((i % 2) * 1024, 1024 + Math.floor(i / 2) * 128, 1024, 128);  // 4 paski (przewijane)
const HNRECT = i => rectOf((i % 4) * 512, 1280 + Math.floor(i / 4) * 128, 512, 128);    // 8 poziomych neonow
const VNRECT = i => rectOf(i * 256, 1536, 256, 512);                                    // 8 pionowych neonow
function neonTxt(x, t, cx, cy, size, col, w) {
  x.font = `bold ${size}px "Arial Black", Impact, Arial, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (w) { const m = x.measureText(t).width; if (m > w) { size *= w / m; x.font = `bold ${size}px "Arial Black", Impact, Arial, sans-serif`; } }
  x.lineJoin = 'round'; x.shadowColor = col; x.shadowBlur = size * 0.35; x.strokeStyle = col; x.lineWidth = size * 0.1; x.strokeText(t, cx, cy);
  x.shadowBlur = size * 0.15; x.fillStyle = '#fff'; x.fillText(t, cx, cy); x.shadowBlur = 0;
}
function makeAtlas() {
  const c = cv(AT, AT), x = c.getContext('2d');
  x.fillStyle = '#05060a'; x.fillRect(0, 0, AT, AT);
  const ADS = [
    { c1: '#e0202a', c2: '#5c0810', pat: 'wave', ic: 'bottle', t: ['COLA COLD', 'ICE COLD FIZZ'], s: ['REFRESH YOURSELF', '2 FOR $3'], tc: '#fff' },
    { c1: '#07281a', c2: '#1f8a45', pat: 'hex', ic: 'ring', t: ['OSCORP', 'THE FUTURE'], s: ['INDUSTRIES', 'IS HERE'], tc: '#d8ffe4' },
    { c1: '#14052a', c2: '#7a1d86', pat: 'rays', ic: 'star', t: ['BROADWAY', 'NOW SHOWING'], s: ['THE MUSICAL', 'NIGHTLY 8PM'], tc: '#ffd84a' },
    { c1: '#f8c21e', c2: '#d4501a', pat: 'dots', ic: 'burger', t: ['BIG BURGER', '2 FOR 1'], s: ['NYC\'S BEST', 'ALL NIGHT LONG'], tc: '#3a0d05' },
    { c1: '#08143a', c2: '#2174e6', pat: 'rays', ic: 'phone', t: ['NOVA X', '5G CITY'], s: ['THE NEW PHONE', 'FASTER EVERY DAY'], tc: '#fff' },
    { c1: '#efe8d4', c2: '#c4bca2', pat: 'news', ic: 'none', t: ['DAILY BUGLE', 'EXTRA! EXTRA!'], s: ['SPIDER-MAN: MENACE?', 'READ ALL ABOUT IT'], tc: '#161616' },
    { c1: '#101010', c2: '#2a0a0a', pat: 'dots', ic: 'heart', t: ['I   NY', 'NEW YORK'], s: ['THE CITY THAT', 'NEVER SLEEPS'], tc: '#fff' },
    { c1: '#2b1810', c2: '#80502c', pat: 'wave', ic: 'cup', t: ['COFFEE', 'OPEN 24/7'], s: ['FRESH & HOT', 'BEST IN TOWN'], tc: '#ffeccf' },
  ];
  const icon = (a, f, ox, oy) => {
    x.save(); x.translate(ox, oy);
    if (a.ic === 'bottle') { x.fillStyle = '#7a0d12'; x.beginPath(); x.moveTo(-14, 60); x.lineTo(-14, -10); x.lineTo(-7, -30); x.lineTo(-7, -60); x.lineTo(7, -60); x.lineTo(7, -30); x.lineTo(14, -10); x.lineTo(14, 60); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.fillRect(-14, 5, 28, 26); }
    if (a.ic === 'ring') { x.strokeStyle = '#7dffa5'; x.lineWidth = 12; x.beginPath(); x.arc(0, 0, 42, 0, TAU); x.stroke(); x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 24, 0, TAU); x.stroke(); }
    if (a.ic === 'star') { x.fillStyle = '#ffd84a'; x.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 52, an = i / 10 * TAU - Math.PI / 2; x.lineTo(Math.cos(an) * r, Math.sin(an) * r); } x.fill(); }
    if (a.ic === 'burger') { x.fillStyle = '#c47a2a'; x.beginPath(); x.ellipse(0, -18, 48, 26, 0, Math.PI, 0); x.fill(); x.fillStyle = '#3a1a0c'; x.fillRect(-48, -14, 96, 14); x.fillStyle = '#48b02a'; x.fillRect(-50, 0, 100, 7); x.fillStyle = '#f5d02a'; x.fillRect(-46, 7, 92, 6); x.fillStyle = '#c47a2a'; x.beginPath(); x.ellipse(0, 24, 48, 14, 0, 0, Math.PI); x.fill(); }
    if (a.ic === 'phone') { x.fillStyle = '#05080f'; x.fillRect(-26, -54, 52, 108); x.fillStyle = f ? '#ff7a30' : '#38e0ff'; x.fillRect(-22, -48, 44, 92); x.fillStyle = '#fff'; x.fillRect(-12, -30, 24, 6); }
    if (a.ic === 'heart') { x.fillStyle = '#e8102a'; x.beginPath(); x.moveTo(0, 40); x.bezierCurveTo(-60, -8, -30, -50, 0, -18); x.bezierCurveTo(30, -50, 60, -8, 0, 40); x.fill(); }
    if (a.ic === 'cup') { x.fillStyle = '#f4efe6'; x.fillRect(-32, -10, 64, 56); x.strokeStyle = '#f4efe6'; x.lineWidth = 9; x.beginPath(); x.arc(38, 16, 16, -1.5, 1.5); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.7)'; x.lineWidth = 5; for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(i * 16, -18); x.bezierCurveTo(i * 16 + 12, -30, i * 16 - 12, -42, i * 16, -56); x.stroke(); } }
    x.restore();
  };
  ADS.forEach((a, i) => {
    for (let f = 0; f < 2; f++) {
      const ox = (i % 2) * 1024 + f * 512, oy = Math.floor(i / 2) * 256;
      x.save(); x.beginPath(); x.rect(ox, oy, 512, 256); x.clip(); x.translate(ox, oy);
      const g = x.createLinearGradient(0, 0, 512, 256); g.addColorStop(0, f ? a.c2 : a.c1); g.addColorStop(1, f ? a.c1 : a.c2); x.fillStyle = g; x.fillRect(0, 0, 512, 256);
      x.globalAlpha = 0.18; x.strokeStyle = '#fff'; x.fillStyle = '#fff';
      if (a.pat === 'wave') { x.lineWidth = 10; for (let k = 0; k < 6; k++) { x.beginPath(); for (let px = 0; px <= 512; px += 16) x.lineTo(px, 40 + k * 40 + Math.sin(px / 40 + k + f * 2) * 16); x.stroke(); } }
      if (a.pat === 'hex') { x.lineWidth = 3; for (let k = 0; k < 10; k++) for (let m = 0; m < 5; m++) { x.beginPath(); for (let q = 0; q < 6; q++) x.lineTo(k * 60 + (m % 2) * 30 + Math.cos(q / 6 * TAU) * 26, m * 52 + Math.sin(q / 6 * TAU) * 26); x.closePath(); x.stroke(); } }
      if (a.pat === 'rays') { for (let k = 0; k < 16; k++) { x.beginPath(); x.moveTo(256, 128); x.arc(256, 128, 400, k / 16 * TAU + f * 0.2, (k + 0.5) / 16 * TAU + f * 0.2); x.fill(); } }
      if (a.pat === 'dots') { for (let k = 0; k < 14; k++) for (let m = 0; m < 8; m++) { x.beginPath(); x.arc(k * 40 + (m % 2) * 20, m * 36, 5, 0, TAU); x.fill(); } }
      if (a.pat === 'news') { x.globalAlpha = 0.35; x.fillStyle = '#000'; for (let k = 0; k < 14; k++) x.fillRect(20 + (k % 2) * 250, 150 + Math.floor(k / 2) * 14, 230, 4); }
      x.globalAlpha = 1;
      icon(a, f, f ? 420 : 90, 118);
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = a.tc; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 8;
      let fs = a.pat === 'news' ? 62 : 70; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`;
      const mw = x.measureText(a.t[f]).width; if (mw > 360) { fs *= 360 / mw; x.font = `900 ${fs}px "Arial Black", Impact, sans-serif`; }
      const tx = f ? 220 : 300; x.fillText(a.t[f], a.ic === 'none' ? 256 : tx, 100);
      if (a.ic === 'heart' && !f) { x.fillStyle = '#e8102a'; x.beginPath(); const hx = 213, hy = 100; x.moveTo(hx, hy + 24); x.bezierCurveTo(hx - 36, hy - 4, hx - 18, hy - 30, hx, hy - 10); x.bezierCurveTo(hx + 18, hy - 30, hx + 36, hy - 4, hx, hy + 24); x.fill(); }
      x.font = `bold 34px Arial, sans-serif`; x.fillStyle = a.pat === 'news' ? '#222' : 'rgba(255,255,255,.9)'; x.fillText(a.s[f], a.ic === 'none' ? 256 : tx, 170);
      x.shadowBlur = 0; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 226, 512, 30); x.fillStyle = a.tc; x.globalAlpha = 0.8; x.font = 'bold 20px Arial'; x.fillText(a.s[1 - f] + '   *   ' + a.t[1 - f], 256, 242);
      x.restore();
      x.strokeStyle = '#05060a'; x.lineWidth = 6; x.strokeRect(ox + 3, oy + 3, 506, 250);
    }
  });
  // paski przewijane (okresowe na 1024 px)
  const TICK = [
    { bg: '#3a0507', fg: '#ffe9e0', items: ['BREAKING NEWS', 'NYC MARATHON SUNDAY', 'DAILY BUGLE', 'MAYOR SPEAKS', 'TRAFFIC ON 5TH AVE'] },
    { bg: '#031a0c', fg: '#58ff8c', items: ['DOW +1.2%', 'NASDAQ +0.8%', 'OSCP 412.5 +3.1', 'S&P +0.6%', 'GOLD 2310'] },
    { bg: '#06142e', fg: '#9fd2ff', items: ['NEW YORK 72F', 'SUNNY', 'WIND 6 MPH', 'TIMES SQ', 'WELCOME TO NYC'] },
    { bg: '#2b2000', fg: '#ffd84a', items: ['PIZZA SLICE $1', 'TAXI * UBER * METRO', 'SHOWS TONIGHT', 'HOT DOGS', 'OPEN LATE'] },
  ];
  TICK.forEach((t, i) => {
    const ox = (i % 2) * 1024, oy = 1024 + Math.floor(i / 2) * 128;
    x.fillStyle = t.bg; x.fillRect(ox, oy, 1024, 128); x.font = 'bold 56px "Arial Black", Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = t.fg;
    t.items.forEach((s, k) => { const px = (k + 0.5) * 1024 / t.items.length; x.font = `bold ${s.length > 14 ? 40 : 52}px "Arial Black", Arial, sans-serif`; for (const d of [-1024, 0, 1024]) x.fillText(s, ox + px + d, oy + 66); });
    x.fillStyle = 'rgba(0,0,0,.25)'; for (let yy = 0; yy < 128; yy += 4) x.fillRect(ox, oy + yy, 1024, 1);
  });
  // poziome neony 512 x 128
  const HN = [['HOTEL', '#ff3b5c'], ['BAR', '#38e8ff'], ['PIZZA', '#ffb13b'], ['MOTEL', '#ff4be0'], ['DINER', '#5bff8a'], ['CAFE', '#ffe14a'], ['LIQUOR', '#6b8dff'], ['PUB', '#ff7a2a']];
  HN.forEach(([t, col], i) => {
    const ox = (i % 4) * 512, oy = 1280 + Math.floor(i / 4) * 128;
    x.fillStyle = '#080a10'; x.fillRect(ox, oy, 512, 128); x.save(); x.beginPath(); x.rect(ox, oy, 512, 128); x.clip();
    x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 14; x.lineWidth = 5; x.strokeRect(ox + 12, oy + 12, 488, 104); x.shadowBlur = 0;
    neonTxt(x, t, ox + 256, oy + 66, 78, col, 430); x.restore();
  });
  // pionowe neony 256 x 512 (litery jedna pod druga)
  const VN = [['HOTEL', '#ff3b5c'], ['BAR', '#38e8ff'], ['PIZZA', '#ffb13b'], ['MOTEL', '#5bff8a'], ['DINER', '#ff4be0'], ['CLUB', '#9a6bff'], ['JAZZ', '#ffe14a'], ['OPEN', '#ff7a2a']];
  VN.forEach(([t, col], i) => {
    const ox = i * 256, oy = 1536;
    x.fillStyle = '#080a10'; x.fillRect(ox, oy, 256, 512); x.save(); x.beginPath(); x.rect(ox, oy, 256, 512); x.clip();
    x.strokeStyle = col; x.shadowColor = col; x.shadowBlur = 14; x.lineWidth = 6; x.strokeRect(ox + 12, oy + 12, 232, 488); x.shadowBlur = 0;
    const n = t.length, step = 456 / n; for (let k = 0; k < n; k++) neonTxt(x, t[k], ox + 128, oy + 28 + step * (k + 0.5), Math.min(120, step * 0.85), col, 190);
    x.restore();
  });
  const tex = canvasTex(c); tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; return tex;
}

// ---------------------------------------------------------------- materialy
const U = { t: { value: 0 }, lamp: { value: 0.6 }, ad: { value: 1.3 }, scale: { value: 800 } };
const GLSL_NOISE = `
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }
`;
function solidMat(spin) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 1, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  m.userData.lin = true; m.customProgramCacheKey = () => 'dachy-solid' + (spin ? '-spin' : '');
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = U.t; sh.uniforms.uL = U.lamp;
    sh.vertexShader = `attribute vec4 aV;\n${spin ? 'attribute vec4 aSp;\n' : ''}uniform float uT;\nvarying vec4 vV;\nvarying vec3 vWp;\nvarying vec3 vWn;\n` + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vV = aV;
        ${spin ? `float ang = uT * aSp.z + aSp.w; float ca = cos(ang), sa = sin(ang);
        objectNormal = vec3(ca * objectNormal.x + sa * objectNormal.z, objectNormal.y, -sa * objectNormal.x + ca * objectNormal.z);` : ''}
        vWn = objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${spin ? `{ vec2 d = transformed.xz - aSp.xy; transformed.x = aSp.x + ca * d.x + sa * d.y; transformed.z = aSp.y - sa * d.x + ca * d.y; }` : ''}
        vWp = transformed;`);
    sh.fragmentShader = `uniform float uL;\nvarying vec4 vV;\nvarying vec3 vWp;\nvarying vec3 vWn;\n${GLSL_NOISE}\n` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec2 gp = abs(vWn.y) > 0.5 ? vWp.xz : vec2(vWp.x + vWp.z, vWp.y * 0.7);
          float gn = vn(gp * 1.3) * 0.55 + vn(gp * 6.1) * 0.45;
          diffuseColor.rgb *= 0.74 + 0.5 * gn;
        }`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vV.x;')
      .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vV.y;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        { float ek = floor(vV.z * 10.0 + 0.5);
          if (ek > 0.5) {
            vec3 ec;
            if (ek < 1.5) ec = vec3(1.0, 0.72, 0.4) * (0.08 + uL * 2.6);
            else if (ek < 2.5) ec = vec3(1.0, 0.06, 0.03) * (0.5 + uL * 1.5);
            else if (ek < 3.5) ec = vec3(0.85, 0.93, 1.0) * (0.15 + uL * 2.8);
            else if (ek < 4.5) ec = vec3(0.45, 0.8, 1.0) * (uL * 1.7);
            else ec = vec3(1.0, 0.4, 0.9) * (uL * 2.0);
            totalEmissiveRadiance += ec;
          } }`);
  };
  return m;
}
const ADVERT = {
  vs: `attribute vec4 aR; attribute vec4 aN; varying vec2 vUv; varying vec4 vR; varying vec4 vN;
    #include <fog_pars_vertex>
    void main() { vUv = uv; vR = aR; vN = aN; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    }`,
  fs: `uniform sampler2D uTex; uniform float uT; uniform float uI; varying vec2 vUv; varying vec4 vR; varying vec4 vN;
    #include <fog_pars_fragment>
    float hh(float n) { return fract(sin(n * 91.7) * 437.58); }
    void main() {
      vec4 R = vR; vec2 uv = vUv; float t = uT, k = 1.0, ty = vN.x;
      if (ty > 0.5 && ty < 1.5) { k *= hh(floor(t * vN.y + vN.z * 10.0)) > 0.94 ? 0.3 : 1.0; }
      else if (ty > 1.5 && ty < 2.5) { uv.x = fract(uv.x + t * vN.y); }
      else if (ty > 2.5 && ty < 3.5) { float ph = t / vN.y + vN.z; R.x += floor(mod(ph, vN.w)) * R.z; k *= 0.3 + 0.7 * smoothstep(0.0, 0.07, fract(ph)); }
      else if (ty > 3.5) { k *= 0.82 + 0.18 * sin(t * vN.y + vN.z); }
      vec3 c = texture2D(uTex, R.xy + uv * R.zw).rgb; c = pow(c, vec3(2.2));
      vec2 p = uv * R.zw * 2048.0 / 3.0; float fw = fwidth(p.x) * 1.5;
      vec2 f = abs(fract(p) - 0.5) * 2.0; float dots = mix(0.78 + 0.22 * (1.0 - max(f.x, f.y) * 0.5), 1.0, clamp(fw, 0.0, 1.0));
      gl_FragColor = vec4(c * uI * k * dots, 1.0);
      #include <tonemapping_fragment>
      #include <encodings_fragment>
      #include <fog_fragment>
    }`,
};
const LIGHTS = {
  vs: `attribute vec3 aCol; attribute float aSize; attribute vec2 aM; uniform float uT; uniform float uL; uniform float uScale; varying vec3 vC; varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float m = aM.x, t = uT + aM.y, k = 1.0;
      if (m < 0.5) { float x = fract(t / 1.8); k = 0.1 + 0.9 * smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.3, 0.42, x)); k *= 0.4 + 0.6 * min(1.0, uL * 1.6 + 0.2); }
      else if (m < 1.5) k = uL;
      else if (m < 2.5) { float x = fract(t / 1.4); k = (step(x, 0.05) + step(0.14, x) * step(x, 0.19)) * (0.35 + 0.65 * min(1.0, uL * 1.6 + 0.2)); }
      else if (m < 3.5) k = 0.25 + uL;
      else k = uL * (0.88 + 0.12 * sin(t * 6.0));
      float d = -mv.z; k *= 1.0 - smoothstep(700.0, 1500.0, d);
      vC = aCol; vA = k; gl_PointSize = clamp(aSize * uScale / max(d, 1.0), 0.0, 90.0);
    }`,
  fs: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
    void main() { float a = texture2D(uTex, gl_PointCoord).a; gl_FragColor = vec4(vC * vA, a * vA); if (gl_FragColor.a < 0.01) discard; }`,
};
let matSolid = null, matSpin = null, matAd = null, matLight = null, atlasTex = null, glowTex = null;
function initMats() {
  if (matSolid) return;
  matSolid = solidMat(false); matSpin = solidMat(true);
  atlasTex = makeAtlas();
  matAd = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTex: { value: atlasTex }, uT: U.t, uI: U.ad }]), vertexShader: ADVERT.vs, fragmentShader: ADVERT.fs, fog: true });
  glowTex = glowTexture();
  matLight = new THREE.ShaderMaterial({ uniforms: { uTex: { value: glowTex }, uT: U.t, uL: U.lamp, uScale: U.scale }, vertexShader: LIGHTS.vs, fragmentShader: LIGHTS.fs, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
}

// ---------------------------------------------------------------- zbieranie dachow i budowa
const recs = [];
export const dachyInfo = { ads: [], helis: [], houses: [] }; // do testow: gdzie co stoi

export function dachyCollect(b) { recs.push({ b, idx: recs.length, occ: [], house: null, tier: 0 }); }
const CH = 128;
const chunks = new Map();

const PAL = {
  conc: ['#8d8b86', '#a7a49c', '#76736d', '#b5b0a4', '#9a958a'],
  paint: ['#a39f94', '#8e6f5a', '#6b7a86', '#b7ae98', '#7c8a72', '#9c9186'],
  metal: ['#9aa0a6', '#b9bec3', '#7b8189', '#c5c9cc'],
  coat: ['#8a8d86', '#c9c6bb', '#7d5646', '#8a8f86', '#9a9488', '#b3aea0'],
  tar: ['#6a6762', '#5a5855', '#77736c', '#4f4d4b', '#837f77'],
  tag: ['#ff2f8f', '#26e0ff', '#ffe03a', '#f2f2f2', '#7dff3a', '#ff7a1a'],
  cloth: ['#d94a4a', '#e8e0d0', '#3f6fb5', '#e6b83a', '#58a05a', '#8e4fa8', '#f0f0f0', '#c97a3a'],
};
const rect = (cx, cz, sx, sz, pad = 0.6) => [cx - sx / 2 - pad, cx + sx / 2 + pad, cz - sz / 2 - pad, cz + sz / 2 + pad];
const hit = (occ, r) => occ.some(o => r[0] < o[1] && r[1] > o[0] && r[2] < o[3] && r[3] > o[2]);
// wolne miejsce w srodku dachu (poza rezerwacjami)
function slot(rec, rng, sx, sz, pad = 0.6) {
  const b = rec.b, ins = 1.1;
  const ax = b.x0 + ins + sx / 2, bx = b.x1 - ins - sx / 2, az = b.z0 + ins + sz / 2, bz = b.z1 - ins - sz / 2;
  if (bx < ax || bz < az) return null;
  for (let t = 0; t < 14; t++) {
    const x = ax + rng() * (bx - ax), z = az + rng() * (bz - az), r = rect(x, z, sx, sz, pad);
    if (!hit(rec.occ, r)) { rec.occ.push(r); return [x, z]; }
  }
  return null;
}
// miejsce przy krawedzi: side 0 = z1 (+z), 1 = z0, 2 = x1, 3 = x0
function edgeSlot(rec, rng, along, depth, side, pad = 0.4) {
  const b = rec.b, ins = 1.0, horiz = side < 2; // pas biegnie wzdluz x gdy side 0/1
  const len = horiz ? b.x1 - b.x0 : b.z1 - b.z0;
  if (len < along + 2 * ins + 1) return null;
  for (let t = 0; t < 12; t++) {
    const a = (horiz ? b.x0 : b.z0) + ins + along / 2 + rng() * (len - 2 * ins - along);
    let x, z;
    if (side === 0) { x = a; z = b.z1 - ins - depth / 2; } else if (side === 1) { x = a; z = b.z0 + ins + depth / 2; } else if (side === 2) { x = b.x1 - ins - depth / 2; z = a; } else { x = b.x0 + ins + depth / 2; z = a; }
    const r = horiz ? rect(x, z, along, depth, pad) : rect(x, z, depth, along, pad);
    if (!hit(rec.occ, r)) { rec.occ.push(r); return [x, z]; }
  }
  return null;
}
const SIDE_YAW = [0, Math.PI, Math.PI / 2, -Math.PI / 2]; // +z, -z, +x, -x (kierunek "na zewnatrz")
const SIDE_N = [[0, 1], [0, -1], [1, 0], [-1, 0]];

// ---- elementy
function fanSpin(S, cx, y, cz, r, speed, ph, col = '#2b2e32') {
  for (let a = 0; a < 4; a++) {
    const an = a * Math.PI / 2 + ph;
    S.xbox(cx + Math.cos(an) * r / 2, y, cz + Math.sin(an) * r / 2, r / 2, 0.015, r * 0.2, -an, 0.28, col, { r: 0.5, m: 0.5, sp: [cx, cz, speed, 0], j: 0 });
  }
}
function hvac(Bs, S, rng, x, z, y) {
  const type = Math.floor(rng() * 3), col = pick(rng, PAL.metal), M = { r: 0.5, m: 0.6 };
  if (type === 0) { // pojedyncza jednostka z wentylatorem
    const hx = 1.0 + rng() * 0.4, hz = 0.8 + rng() * 0.3, h = 1.1 + rng() * 0.5;
    Bs.xbox(x, y + h / 2 + 0.1, z, hx, h / 2, hz, 0, 0, col, M); Bs.box(x - hx - 0.05, x + hx + 0.05, y, y + 0.14, z - hz - 0.05, z + hz + 0.05, '#555a5e');
    for (let k = 0; k < 5; k++) { Bs.box(x - hx * 0.8, x + hx * 0.8, y + 0.3 + k * 0.17, y + 0.36 + k * 0.17, z + hz, z + hz + 0.04, '#33383c', M); Bs.box(x + hx, x + hx + 0.04, y + 0.3 + k * 0.17, y + 0.36 + k * 0.17, z - hz * 0.8, z + hz * 0.8, '#33383c', M); }
    Bs.cyl(x, y + h + 0.1, z, hz * 0.8, hz * 0.8, 0.08, 12, '#222528', M); S.cyl(x, y + h + 0.1, z, 0.08, 0.04, 0.2, 6, '#555', M);
    fanSpin(S, x, y + h + 0.2, z, hz * 0.7, (rng() < 0.5 ? 1 : -1) * (1.6 + rng() * 1.6), rng() * 6);
    return [hx, hz];
  }
  if (type === 1) { // rzad skraplaczy
    const n = 2 + Math.floor(rng() * 2); const hx = 0.7, hz = 0.7;
    for (let k = 0; k < n; k++) {
      const cx = x + (k - (n - 1) / 2) * 1.55;
      Bs.xbox(cx, y + 0.6, z, hx, 0.5, hz, 0, 0, col, M); Bs.box(cx - hx, cx + hx, y, y + 0.1, z - hz, z + hz, '#444');
      Bs.cyl(cx, y + 1.1, z, 0.55, 0.55, 0.06, 12, '#1d1f22', M); fanSpin(S, cx, y + 1.18, z, 0.5, (k % 2 ? -1 : 1) * (2 + rng()), rng() * 6);
    }
    return [n * 0.78, 0.75];
  }
  // duzy agregat chlodniczy z rurami
  const hx = 2.6, hz = 1.2, h = 2.0;
  Bs.xbox(x, y + h / 2 + 0.2, z, hx, h / 2, hz, 0, 0, '#b8bcc0', M); Bs.box(x - hx - 0.1, x + hx + 0.1, y, y + 0.22, z - hz - 0.1, z + hz + 0.1, '#4a4e52');
  for (const fx of [-1.3, 1.3]) { Bs.cyl(x + fx, y + h + 0.2, z, 0.9, 0.9, 0.1, 14, '#202327', M); fanSpin(S, x + fx, y + h + 0.3, z, 0.85, (fx < 0 ? 1 : -1) * (1.2 + rng()), rng() * 6); }
  Bs.cyl(x - hx - 0.4, y, z, 0.16, 0.16, h, 8, '#b0b5ba', M); Bs.seg([x - hx - 0.4, y + h - 0.1, z], [x - hx, y + h - 0.1, z], 0.28, '#b0b5ba', M);
  return [hx, hz];
}
function tankObj(Bs, rng, x, z, y) {
  const r = 1.55 + rng() * 0.5, h = 3.0 + rng() * 0.5, lg = 2.4, wood = pick(rng, ['#6b4a33', '#7a5a3d', '#5d4332', '#85644a']);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) Bs.xbox(x + dx * r * 0.62, y + lg / 2, z + dz * r * 0.62, 0.11, lg / 2, 0.11, 0, 0, '#2d2f33', { r: 0.6, m: 0.5 });
  for (let k = 0; k < 2; k++) { const yy = y + 0.5 + k * 1.3; Bs.box(x - r * 0.7, x + r * 0.7, yy, yy + 0.09, z - r * 0.7, z + r * 0.7, '#2d2f33', { r: 0.6, m: 0.5 }); }
  Bs.seg([x - r * 0.62, y + 0.4, z - r * 0.62], [x + r * 0.62, y + lg - 0.3, z - r * 0.62], 0.07, '#2d2f33', { r: 0.6, m: 0.5 }); Bs.seg([x + r * 0.62, y + 0.4, z + r * 0.62], [x - r * 0.62, y + lg - 0.3, z + r * 0.62], 0.07, '#2d2f33', { r: 0.6, m: 0.5 });
  Bs.cyl(x, y + lg, z, r, r, 0.12, 14, '#3a2c20'); Bs.cyl(x, y + lg + 0.12, z, r, r, h, 14, wood, { r: 0.95, j: 0.08 });
  for (const hy of [0.35, 1.0, 1.7, 2.4]) Bs.cyl(x, y + lg + 0.12 + hy, z, r + 0.06, r + 0.06, 0.11, 14, '#25272a', { r: 0.5, m: 0.7, j: 0 });
  Bs.cyl(x, y + lg + 0.12 + h, z, r + 0.15, 0.2, 1.1, 14, '#3b3e42', { r: 0.7, m: 0.3 });
  Bs.cyl(x, y + lg + 0.12 + h + 1.1, z, 0.12, 0.12, 0.25, 6, '#222');
  // drabinka z boku i rura spustowa
  const lx = x + r + 0.12; Bs.box(lx, lx + 0.06, y + 0.2, y + lg + h * 0.8, z - 0.25, z - 0.19, '#2d2f33', { m: 0.5 }); Bs.box(lx, lx + 0.06, y + 0.2, y + lg + h * 0.8, z + 0.19, z + 0.25, '#2d2f33', { m: 0.5 });
  for (let q = 0; q < 10; q++) Bs.box(lx, lx + 0.05, y + 0.5 + q * 0.5, y + 0.55 + q * 0.5, z - 0.22, z + 0.22, '#2d2f33', { m: 0.5 });
  Bs.cyl(x - r * 0.3, y, z - r * 0.3, 0.08, 0.08, lg, 6, '#4a4d52', { m: 0.6, r: 0.5 });
  return r;
}
function mast(Bs, Li, rec, rng, x, z, y, Hh, perch) {
  Bs.box(x - 0.45, x + 0.45, y, y + 0.2, z - 0.45, z + 0.45, '#4d5156', { m: 0.5 });
  Bs.cyl(x, y + 0.2, z, 0.15, 0.07, Hh, 7, '#6a6e73', { r: 0.45, m: 0.8, j: 0.05 });
  for (const f of [0.45, 0.68, 0.86]) { const yy = y + Hh * f; Bs.box(x - 0.9 * (1.1 - f), x + 0.9 * (1.1 - f), yy, yy + 0.07, z - 0.04, z + 0.04, '#6a6e73', { m: 0.8, r: 0.45 }); Bs.box(x - 0.04, x + 0.04, yy, yy + 0.07, z - 0.55 * (1.1 - f), z + 0.55 * (1.1 - f), '#6a6e73', { m: 0.8, r: 0.45 }); }
  for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + rng(); Bs.seg([x, y + Hh * 0.62, z], [x + Math.cos(a) * 5.5, y + 0.1, z + Math.sin(a) * 5.5], 0.03, '#2a2c2e'); }
  Bs.box(x - 0.12, x + 0.12, y + Hh + 0.15, y + Hh + 0.38, z - 0.12, z + 0.12, '#600', { e: 2 });
  Li.add(x, y + Hh + 0.28, z, RED, 5.5, 0, rng() * 1.8);
  if (Hh > 11) { Li.add(x, y + Hh * 0.55, z, RED, 4, 0, rng() * 1.8); }
  if (perch) perches.push(new THREE.Vector3(x, y, z + 0.8));
}
function house(Bs, Li, rec, rng, x, z, ax, az, h, side) {
  const y = rec.b.y1, col = pick(rng, PAL.paint), col2 = pick(rng, PAL.conc);
  Bs.box(x - ax, x + ax, y, y + h, z - az, z + az, col, { r: 0.9 });
  Bs.box(x - ax - 0.25, x + ax + 0.25, y + h, y + h + 0.2, z - az - 0.25, z + az + 0.25, col2, { r: 0.85 });
  Bs.box(x - ax - 0.03, x + ax + 0.03, y, y + 0.35, z - az - 0.03, z + az + 0.03, '#55524c');
  const yaw = SIDE_YAW[side], [nx, nz] = SIDE_N[side], dx = nx ? ax : 0, dz = nz ? az : 0, px = x + nx * (ax + 0.03), pz = z + nz * (az + 0.03);
  Bs.xbox(px, y + 1.1, pz, 0.62, 1.1, 0.05, yaw, 0, '#3f4a55', { r: 0.5, m: 0.5 });          // drzwi stalowe
  Bs.xbox(px + nx * 0.01, y + 1.1, pz + nz * 0.01, 0.74, 1.18, 0.03, yaw, 0, '#d7d3c8', { r: 0.8 });  // framuga
  Bs.xbox(px + nx * 0.06, y + 1.05, pz + nz * 0.06, 0.56, 1.02, 0.025, yaw, 0, '#46525d', { r: 0.5, m: 0.5 });
  Bs.xbox(px + nx * 0.1 - nz * 0.4, y + 1.0, pz + nz * 0.1 + nx * 0.4, 0.04, 0.03, 0.05, yaw, 0, '#c9c9c9', { m: 0.9, r: 0.3 });
  const lx = x + nx * (ax + 0.18), lz = z + nz * (az + 0.18);
  Bs.xbox(lx, y + 2.45, lz, 0.14, 0.1, 0.1, yaw, 0, '#ffe9bd', { e: 1, r: 0.3 }); Li.add(lx, y + 2.45, lz, WARM, 3.2, 1, rng());
  Bs.box(x - 0.4 + (rng() - 0.5) * ax, x + 0.4 + (rng() - 0.5) * ax, y + h + 0.2, y + h + 0.7, z - 0.4, z + 0.4, '#8c9096', { m: 0.6, r: 0.5 }); // wywietrznik na dachu budki
  addBox({ x0: x - ax, x1: x + ax, y0: y, y1: y + h + 0.2, z0: z - az, z1: z + az });
  rec.house = { x, z, ax, az, h, side, col };
}
// graffiti: kilka falistych pociagniec z czarnym obrysem na scianie budki
function tag(Bs, rng, rec, face) {
  const h = rec.house; if (!h) return;
  const [nx, nz] = SIDE_N[face], tx = nz, tz = -nx; // t = up x n
  const len = (nx ? h.az : h.ax) * 2, y0 = rec.b.y1 + 0.5, off = nx ? h.ax : h.az;
  const bx = h.x + nx * (off + 0.02), bz = h.z + nz * (off + 0.02);
  const ncol = pick(rng, PAL.tag), ncol2 = pick(rng, PAL.tag), n = [nx, 0, nz];
  const strokes = [];
  const s0 = -len * 0.35, sw = len * 0.7, cnt = 3 + Math.floor(rng() * 3);
  for (let k = 0; k < cnt; k++) { const pts = []; const base = y0 + (rng() * 0.7), ph = rng() * 6; for (let j = 0; j < 5; j++) pts.push([s0 + sw * (k / cnt + j / (5 * cnt) * 1.4), base + Math.sin(j * 1.4 + ph) * 0.35 + j * 0.05]); strokes.push(pts); }
  for (const pass of [0, 1]) {
    strokes.forEach((pts, k) => {
      const wdt = pass ? 0.13 : 0.26, col = pass ? (k % 2 ? ncol : ncol2) : '#101012', lift = 0.02 + pass * 0.012;
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j], b = pts[j + 1], A = [bx + tx * a[0] + nx * lift, a[1], bz + tz * a[0] + nz * lift], Bq = [bx + tx * b[0] + nx * lift, b[1], bz + tz * b[0] + nz * lift];
        Bs.q([[A[0], A[1] - wdt / 2, A[2]], [Bq[0], Bq[1] - wdt / 2, Bq[2]], [Bq[0], Bq[1] + wdt / 2, Bq[2]], [A[0], A[1] + wdt / 2, A[2]]], n, lin(col), { r: 0.9, m: 0, j: 0 });
      }
    });
  }
}
function helipad(Bs, Li, rec, rng) {
  const b = rec.b, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, y = b.y1, R = Math.min(8.2, Math.min(b.x1 - b.x0, b.z1 - b.z0) / 2 - 2.2);
  if (R < 5) return false;
  rec.occ.push([cx - R - 1, cx + R + 1, cz - R - 1, cz + R + 1]);
  Bs.disc(cx, cz, R + 0.5, R + 0.5, y + 0.04, 36, '#2d3336', { r: 0.9, j: 0.05, round: 1 });
  const ring = (r0, r1, col) => { for (let i = 0; i < 36; i++) { const a0 = i / 36 * TAU, a1 = (i + 1) / 36 * TAU; Bs.q([[cx + Math.cos(a0) * r0, y + 0.06, cz + Math.sin(a0) * r0], [cx + Math.cos(a0) * r1, y + 0.06, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, y + 0.06, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * r0, y + 0.06, cz + Math.sin(a1) * r0]], [0, 1, 0], lin(col), { r: 0.7, j: 0 }); } };
  ring(R - 0.8, R - 0.2, '#e8d23a'); ring(R * 0.62, R * 0.68, '#f2f2f2');
  const hw = R * 0.28, hh = R * 0.42, bw = R * 0.075;
  Bs.flat(cx - hw - bw, cx - hw + bw, cz - hh, cz + hh, y + 0.075, '#f4f4f4', { r: 0.6, j: 0 }); Bs.flat(cx + hw - bw, cx + hw + bw, cz - hh, cz + hh, y + 0.075, '#f4f4f4', { r: 0.6, j: 0 });
  Bs.flat(cx - hw, cx + hw, cz - bw, cz + bw, y + 0.075, '#f4f4f4', { r: 0.6, j: 0 });
  for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, lx = cx + Math.cos(a) * (R + 0.3), lz = cz + Math.sin(a) * (R + 0.3); Bs.box(lx - 0.1, lx + 0.1, y + 0.04, y + 0.2, lz - 0.1, lz + 0.1, '#4cff8a', { e: 4, r: 0.4 }); Li.add(lx, y + 0.3, lz, GREEN, 1.8, 3, 0); }
  // wiatrowskaz
  const px = cx + R + 1.3, pz = cz;
  if (px < b.x1 - 0.8) { Bs.cyl(px, y, pz, 0.05, 0.05, 3, 5, '#ddd'); Bs.cyl(px, y + 2.6, pz, 0.28, 0.1, 0.9, 7, '#ff6a1a', { r: 0.8 }, 0, Math.PI / 2 - 0.3); }
  dachyInfo.helis.push({ x: cx, y, z: cz });
  return true;
}
// duza reklama (animowana) albo szyld neonowy na krawedzi dachu
function adBoard(Bs, Ad, Li, rec, rng, kind) {
  const b = rec.b, y = b.y1;
  const sides = [0, 1, 2, 3].sort(() => rng() - 0.5);
  for (const side of sides) {
    const horiz = side < 2, len = horiz ? b.x1 - b.x0 : b.z1 - b.z0;
    let w, h, rectA, anim, tick = false, vert = false;
    if (kind === 'ad') { w = Math.min(10 + rng() * 8, len - 4); h = w / 2; if (w < 8) continue; const i = Math.floor(rng() * 8); rectA = ADRECT(i); anim = [3, 3 + rng() * 3, rng() * 4, 2]; tick = rng() < 0.55; }
    else if (kind === 'hneon') { w = Math.min(7 + rng() * 5, len - 3); h = w / 4; if (w < 5) continue; rectA = HNRECT(Math.floor(rng() * 8)); anim = [1, 3 + rng() * 3, rng(), 0]; }
    else { h = 8 + rng() * 5; w = h / 2; vert = true; rectA = VNRECT(Math.floor(rng() * 8)); anim = [1, 2 + rng() * 3, rng(), 0]; }
    const depth = vert ? w + 0.6 : 1.3 + (tick ? w / 8 * 0 : 0), pos = edgeSlot(rec, rng, vert ? 0.8 : w + 1.5, vert ? 0.8 : depth, side, 0.2);
    if (!pos) continue;
    const [px, pz] = pos, [nx, nz] = SIDE_N[side], yaw = SIDE_YAW[side], tx = nz, tz = -nx;
    const yb = y + (vert ? 1.4 : 2.3);
    const ST = { r: 0.6, m: 0.6 }, DK = '#272a2f';
    // nogi i kratownica
    const legs = vert ? [0] : [-w * 0.38, w * 0.38];
    for (const lo of legs) {
      Bs.xbox(px + tx * lo, (y + yb) / 2, pz + tz * lo, vert ? 0.14 : 0.17, (yb - y) / 2 + 0.05, vert ? 0.14 : 0.17, 0, 0, DK, ST);
      Bs.seg([px + tx * lo, y, pz + tz * lo], [px + tx * lo * 0.4 + nx * 0, yb, pz + tz * lo * 0.4], 0.08, DK, ST);
    }
    if (!vert) Bs.seg([px + tx * -w * 0.38, y + 0.2, pz + tz * -w * 0.38 - nz * 0.0], [px + tx * w * 0.38, yb - 0.1, pz + tz * w * 0.38], 0.08, DK, ST);
    const fy = yb + h / 2 + (vert ? 0.8 : 0.1);
    // obudowa (ciemna plyta) + ramka
    Bs.xbox(px - nx * 0.18, fy, pz - nz * 0.18, w / 2 + 0.25, h / 2 + 0.25, 0.16, yaw, 0, DK, { r: 0.7, m: 0.4 });
    Bs.xbox(px + nx * 0.01, fy, pz + nz * 0.01, w / 2 + 0.28, 0.12, 0.2, yaw, 0, '#4b4f55', { r: 0.5, m: 0.7 }); Bs.xbox(px + nx * 0.01, fy - h / 2 - 0.13, pz + nz * 0.01, w / 2 + 0.28, 0.12, 0.2, yaw, 0, '#4b4f55', { r: 0.5, m: 0.7 });
    Bs.xbox(px + tx * (w / 2 + 0.2) + nx * 0.01, fy, pz + tz * (w / 2 + 0.2) + nz * 0.01, 0.1, h / 2 + 0.25, 0.2, yaw, 0, '#4b4f55', { r: 0.5, m: 0.7 }); Bs.xbox(px - tx * (w / 2 + 0.2) + nx * 0.01, fy, pz - tz * (w / 2 + 0.2) + nz * 0.01, 0.1, h / 2 + 0.25, 0.2, yaw, 0, '#4b4f55', { r: 0.5, m: 0.7 });
    // ekran (dwie strony dla pionowego szyldu; reklama tylko z przodu)
    const fx = px + nx * 0.22, fz = pz + nz * 0.22;
    Ad.face(fx, fy, fz, w, h, yaw, rectA, anim);
    if (vert) { Ad.face(px - nx * 0.5, fy, pz - nz * 0.5, w, h, yaw + Math.PI, rectA, anim); }
    if (tick) { // przewijany pasek pod ekranem
      const th = w / 8; Bs.xbox(px - nx * 0.02, fy - h / 2 - th / 2 - 0.3, pz - nz * 0.02, w / 2 + 0.25, th / 2 + 0.12, 0.18, yaw, 0, DK, { r: 0.7, m: 0.4 });
      Ad.face(fx, fy - h / 2 - th / 2 - 0.3, fz, w, th, yaw, TKRECT(Math.floor(rng() * 4)), [2, (rng() < 0.5 ? 1 : -1) * (0.04 + rng() * 0.04), 0, 0]);
    }
    // pomost serwisowy i reflektory (reklamy)
    if (kind === 'ad') {
      Bs.xbox(px + nx * 0.7, yb - 0.35, pz + nz * 0.7, w / 2, 0.05, 0.75, yaw, 0, '#555a60', { r: 0.6, m: 0.6 });
      Bs.xbox(px + nx * 1.4, yb + 0.35, pz + nz * 1.4, w / 2, 0.04, 0.03, yaw, 0, DK, ST);
      for (const lo of [-0.4, -0.13, 0.13, 0.4]) {
        const lx = px + tx * w * lo + nx * 0.9, lz = pz + tz * w * lo + nz * 0.9, ly = fy + h / 2 + 0.55;
        Bs.seg([px + tx * w * lo + nx * 0.1, fy + h / 2 + 0.2, pz + tz * w * lo + nz * 0.1], [lx, ly, lz], 0.06, DK, ST);
        Bs.xbox(lx, ly, lz, 0.2, 0.12, 0.2, yaw, 0.5, '#e9edf2', { e: 3, r: 0.3 }); Li.add(lx + nx * 0.2, ly - 0.1, lz + nz * 0.2, COOL, 3.2, 1, 0);
      }
    }
    // poswiata po zmroku
    const gcol = kind === 'ad' ? [0.22, 0.25, 0.33] : kind === 'hneon' ? [0.33, 0.15, 0.2] : [0.33, 0.2, 0.27];
    Li.add(fx + nx * 1.5, fy, fz + nz * 1.5, gcol, Math.max(w, h) * 1.5, 4, rng() * 5);
    if (vert) Li.add(px - nx * 1.5, fy, pz - nz * 1.5, gcol, Math.max(w, h) * 1.3, 4, rng() * 5);
    perches.push(new THREE.Vector3(px + tx * w * 0.4, fy + h / 2 + 0.3, pz + tz * w * 0.4));
    dachyInfo.ads.push({ kind, x: px, y, z: pz, nx, nz, roof: [b.x0, b.x1, b.z0, b.z1] });
    return true;
  }
  return false;
}
function solarArr(Bs, rng, rec, x, z, rows, cols, yaw) {
  const y = rec.b.y1, pw = 2.0, ph = 1.1, c = Math.cos(yaw), s = Math.sin(yaw);
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const lx = (k - (cols - 1) / 2) * (pw + 0.12), lz = (r - (rows - 1) / 2) * 1.9;
    const wx = x + lx * c + lz * s, wz = z - lx * s + lz * c;
    Bs.xbox(wx, y + 0.75, wz, pw / 2, 0.025, ph / 2, yaw, -0.5, '#1a2a4c', { r: 0.22, m: 0.7, j: 0.06 });
    Bs.xbox(wx, y + 0.74, wz, pw / 2 + 0.03, 0.02, ph / 2 + 0.03, yaw, -0.5, '#a8adb2', { r: 0.4, m: 0.8, j: 0 });
    Bs.xbox(wx - lz * 0 + s * 0.45 * 0, y + 0.3, wz, 0.05, 0.3, 0.05, 0, 0, '#777c82', { m: 0.7 });
  }
}

// ---- poziom "baza": duze sylwetki
function genBase(rec, ch) {
  const b = rec.b, Bs = ch.base.solid, S = ch.base.spin, Ad = ch.base.ad, Li = ch.base.lights, rng = mulberry(rec.idx * 7919 + 13);
  const w = b.x1 - b.x0, d = b.z1 - b.z0, y = b.y1, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  Bs.sd = rec.idx * 31 + 7;
  // srodek dachu wolny (miejsce startu misji / ladowania)
  const rc = Math.min(w, d) < 14 ? 2.5 : 5;
  rec.occ.push([cx - rc, cx + rc, cz - rc, cz + rc]);
  const heli = y >= 45 && w >= 20 && d >= 20 && rng() < 0.5 ? helipad(Bs, Li, rec, rng) : false;
  // reklamy i szyldy
  if (!heli && y > 18 && y < 125 && w >= 16 && d >= 14 && rng() < 0.25) adBoard(Bs, Ad, Li, rec, rng, 'ad');
  if (y > 14 && rng() < 0.14) adBoard(Bs, Ad, Li, rec, rng, rng() < 0.5 ? 'hneon' : 'vneon');
  // budka windy / wyjscie na dach
  if (y > 10 && rng() < 0.65) {
    const ax = 1.8 + rng() * 1.6, az = 1.5 + rng() * 1.3, h = y > 70 ? 3.4 + rng() * 1.2 : 2.6 + rng() * 0.7, side = Math.floor(rng() * 4);
    const pos = edgeSlot(rec, rng, side < 2 ? ax * 2 + 0.6 : az * 2 + 0.6, side < 2 ? az * 2 + 0.6 : ax * 2 + 0.6, [1, 0, 3, 2][side], 0.5);
    if (pos) house(Bs, Li, rec, rng, pos[0], pos[1], ax, az, h, side);
  }
  // klimatyzatory
  const nh = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < nh; i++) {
    const p = slot(rec, rng, 5.4, 3, 0.7); if (!p) break;
    const sz = hvac(Bs, S, rng, p[0], p[1], y); rec.occ[rec.occ.length - 1] = rect(p[0], p[1], sz[0] * 2, sz[1] * 2, 0.7);
  }
  // zbiornik na wode
  if (y < 90 && w > 11 && d > 11 && rng() < 0.42) { const p = slot(rec, rng, 4.8, 4.8, 0.8); if (p) tankObj(Bs, rng, p[0], p[1], y); }
  // maszty
  if (y > 60) for (let i = 0, n = 1 + Math.floor(rng() * 2); i < n; i++) { const p = slot(rec, rng, 1.2, 1.2, 1.0); if (p) mast(Bs, Li, rec, rng, p[0], p[1], y, 5 + rng() * 14, true); }
  // swiatla ostrzegawcze na narozach najwyzszych wiez
  if (y > 85) for (const [px, pz] of [[b.x0 + 0.6, b.z0 + 0.6], [b.x1 - 0.6, b.z1 - 0.6]]) { Li.add(px, y + 0.8, pz, RED, 5.5, 0, rng() * 1.8); Bs.box(px - 0.1, px + 0.1, y, y + 0.5, pz - 0.1, pz + 0.1, '#600', { e: 2 }); }
  if (y > 150 && rng() < 0.6) Li.add(cx, y + 1.2, cz, WHITE, 6, 2, rng() * 1.4);
  // panele solarne
  if (y < 80 && !heli && w >= 14 && d >= 10 && rng() < 0.22) { const rows = 2, cols = 2 + Math.floor(rng() * 3), p = slot(rec, rng, cols * 2.2 + 0.4, 5, 0.8); if (p) solarArr(Bs, rng, rec, p[0], p[1], rows, cols, 0); }
  // powloka dachu i laty
  const rf = b.x0 + 0.45, rt = b.x1 - 0.45, zf = b.z0 + 0.45, zt = b.z1 - 0.45;
  if (!heli && rng() < 0.3) Bs.flat(rf, rt, zf, zt, y + 0.035, pick(rng, PAL.coat), { r: 0.85, j: 0.05 });
  for (let i = 0, n = 2 + Math.floor(rng() * 3); i < n; i++) {
    const pw = 1.6 + rng() * 3.2, pd = 1.4 + rng() * 2.6, px = rf + 0.5 + rng() * Math.max(0.1, rt - rf - pw - 1), pz = zf + 0.5 + rng() * Math.max(0.1, zt - zf - pd - 1);
    if (rng() < 0.5) Bs.flat(px, px + pw, pz, pz + pd, y + 0.05 + i * 0.008, pick(rng, PAL.tar), { r: 0.95 }); else Bs.disc(px + pw / 2, pz + pd / 2, pw / 2, pd / 2, y + 0.05 + i * 0.008, 16, pick(rng, PAL.tar), { r: 0.95 }, rng() * 3);
  }
  // graffiti na budce (tylko niskie i srednie, gdzie widac je z ulicy)
  if (rec.house && y < 60 && rng() < 0.5) { const f = Math.floor(rng() * 4); if (f !== rec.house.side) tag(Bs, rng, rec, f); }
}

// ---- poziom "detal": rzeczy widoczne z bliska
function genDetail(rec, ch) {
  const b = rec.b, Bs = ch.det.solid, S = ch.det.spin, Li = ch.det.lights, rng = mulberry(rec.idx * 104729 + 5);
  const w = b.x1 - b.x0, d = b.z1 - b.z0, y = b.y1;
  Bs.sd = rec.idx * 17 + 3;
  const M = { r: 0.5, m: 0.7 };
  // kominy i wywietrzniki
  for (let i = 0, n = 1 + Math.floor(rng() * 3); i < n; i++) {
    const p = slot(rec, rng, 1, 1, 0.3); if (!p) break;
    if (rng() < 0.55) { const h = 1.2 + rng() * 1.6; Bs.cyl(p[0], y, p[1], 0.22, 0.2, h, 8, '#9aa0a5', M); Bs.cyl(p[0], y + h + 0.1, p[1], 0.42, 0.04, 0.22, 8, '#6d7378', M); Bs.seg([p[0], y + h - 0.2, p[1]], [p[0], y + h + 0.1, p[1]], 0.04, '#444'); }
    else if (rng() < 0.5) { const h = 0.9 + rng() * 1.2; Bs.box(p[0] - 0.55, p[0] + 0.55, y, y + h, p[1] - 0.5, p[1] + 0.5, pick(rng, ['#8b4a38', '#7d3f2e', '#9a5a46']), { r: 0.95 }); Bs.box(p[0] - 0.62, p[0] + 0.62, y + h, y + h + 0.1, p[1] - 0.58, p[1] + 0.58, '#6a6a68'); } // ceglany komin
    else { Bs.cyl(p[0], y, p[1], 0.24, 0.2, 0.9, 8, '#7d8388', M); S.cyl(p[0], y + 0.9, p[1], 0.38, 0.12, 0.65, 10, '#b6bbc0', M); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; S.xbox(p[0] + Math.cos(a) * 0.32, y + 1.22, p[1] + Math.sin(a) * 0.32, 0.02, 0.26, 0.07, -a + Math.PI / 2, 0.0, '#8e949a', { ...M, sp: [p[0], p[1], 2.2, 0], j: 0 }); } }
  }
  // rury i przewody
  if (rng() < 0.6) {
    const p0 = slot(rec, rng, 6, 1, 0.2);
    if (p0) {
      const col = pick(rng, ['#c9a227', '#b9bec3', '#d8d8d2', '#8a8f94']), len = 4 + rng() * 3;
      Bs.seg([p0[0] - len / 2, y + 0.45, p0[1]], [p0[0] + len / 2, y + 0.45, p0[1]], 0.2, col, M);
      for (let k = 0; k < 4; k++) Bs.box(p0[0] - len / 2 + k * len / 3 - 0.06, p0[0] - len / 2 + k * len / 3 + 0.06, y, y + 0.4, p0[1] - 0.08, p0[1] + 0.08, '#2e3033', M);
      Bs.cyl(p0[0] + len / 2, y, p0[1], 0.1, 0.1, 0.45, 8, col, M); Bs.cyl(p0[0] - len / 2, y, p0[1], 0.1, 0.1, 0.45, 8, col, M);
    }
  }
  if (rec.house && rng() < 0.7) { const h = rec.house, a = [h.x + h.ax + 0.2, y + h.h - 0.5, h.z]; // kabel z budki do masztu / klimatyzatora
    Bs.cable([h.x - h.ax, y + h.h + 0.2, h.z], [h.x - h.ax - 3 - rng() * 3, y + 0.5, h.z + (rng() - 0.5) * 4], 0.4, 0.04, '#17181a'); }
  // drabinka stala do dachu budki
  if (rec.house && rng() < 0.6) {
    const h = rec.house, side = (h.side + 1 + Math.floor(rng() * 3)) % 4, [nx, nz] = SIDE_N[side], tx = nz, tz = -nx, off = (nx ? h.ax : h.az) + 0.18, cxl = h.x + nx * off, czl = h.z + nz * off;
    for (const s of [-0.22, 0.22]) Bs.box(cxl + tx * s - 0.025 + nx * 0.0, cxl + tx * s + 0.025, y, y + h.h + 0.8, czl + tz * s - 0.025, czl + tz * s + 0.025, '#2e3033', M);
    for (let q = 0; q < h.h / 0.32; q++) Bs.seg([cxl + tx * -0.22, y + 0.3 + q * 0.32, czl + tz * -0.22], [cxl + tx * 0.22, y + 0.3 + q * 0.32, czl + tz * 0.22], 0.04, '#2e3033', M);
  }
  // drabina przeciwpozarowa przez attyke na zewnatrz
  if (rng() < 0.22 && w > 10) {
    const side = Math.floor(rng() * 4), horiz = side < 2, [nx, nz] = SIDE_N[side], tx = nz, tz = -nx, len = horiz ? w : d, a = (horiz ? b.x0 : b.z0) + 3 + rng() * (len - 6);
    const wx = horiz ? a : (side === 2 ? b.x1 : b.x0), wz = horiz ? (side === 0 ? b.z1 : b.z0) : a, o = 0.25;
    for (const s of [-0.28, 0.28]) Bs.box(wx + tx * s + nx * o - 0.03, wx + tx * s + nx * o + 0.03, y - 6, y + 1.0, wz + tz * s + nz * o - 0.03, wz + tz * s + nz * o + 0.03, '#26282b', M);
    for (let q = 0; q < 24; q++) Bs.seg([wx + tx * -0.28 + nx * o, y - 5.8 + q * 0.3, wz + tz * -0.28 + nz * o], [wx + tx * 0.28 + nx * o, y - 5.8 + q * 0.3, wz + tz * 0.28 + nz * o], 0.04, '#26282b', M);
    Bs.seg([wx + nx * o, y + 1.0, wz + nz * o], [wx - nx * 0.2, y + 0.55, wz - nz * 0.2], 0.05, '#26282b', M);
  }
  // anteny telewizyjne i talerze satelitarne
  if (y < 55) for (let i = 0, n = Math.floor(rng() * 3); i < n; i++) {
    const p = slot(rec, rng, 1.2, 1.2, 0.3); if (!p) break;
    if (rng() < 0.55) {
      const hh = 3.2 + rng() * 2, yw = rng() * TAU; Bs.cyl(p[0], y, p[1], 0.04, 0.03, hh, 5, '#9aa0a5', M);
      Bs.seg([p[0], y + 0.6, p[1]], [p[0] + 0.7, y, p[1]], 0.025, '#777', M); Bs.seg([p[0], y + 0.6, p[1]], [p[0] - 0.7, y, p[1]], 0.025, '#777', M);
      Bs.xbox(p[0], y + hh - 0.5, p[1], 0.02, 0.02, 0.55, yw, 0, '#b8bdc2', M);
      for (let k = 0; k < 6; k++) { const L = 0.5 - k * 0.05, zz = -0.5 + k * 0.22; Bs.xbox(p[0] + Math.sin(yw) * zz, y + hh - 0.5, p[1] + Math.cos(yw) * zz, L, 0.012, 0.012, yw + Math.PI / 2, 0, '#b8bdc2', M); }
    } else {
      const yw = rng() * TAU; Bs.cyl(p[0], y, p[1], 0.05, 0.05, 0.9, 6, '#8a8f94', M);
      Bs.cyl(p[0], y + 0.95, p[1], 0.08, 0.42, 0.22, 12, '#e8e8e4', { r: 0.4, m: 0.2 }, yw, 1.0);
      Bs.seg([p[0], y + 1.0, p[1]], [p[0] + Math.sin(yw) * 0.4, y + 1.35, p[1] + Math.cos(yw) * 0.4], 0.02, '#555');
    }
  }
  // ogrod dachowy
  if (y < 70 && w >= 15 && d >= 13 && rng() < 0.2) {
    const gx = 7.5, gz = 5.4, p = slot(rec, rng, gx, gz, 0.4);
    if (p) {
      const [x0, z0] = [p[0], p[1]], dk = pick(rng, ['#6c4d33', '#8d8a82']);
      Bs.flat(x0 - gx / 2, x0 + gx / 2, z0 - gz / 2, z0 + gz / 2, y + 0.07, pick(rng, ['#8a6f4e', '#6e7a63']), { r: 0.9 });
      for (let k = 0; k < 4; k++) {
        const px = x0 - gx / 2 + 0.8 + k * 1.9, pz = z0 - gz / 2 + 0.55; Bs.box(px - 0.7, px + 0.7, y, y + 0.55, pz - 0.35, pz + 0.35, dk, { r: 0.9 });
        Bs.cyl(px, y + 0.5, pz, 0.45, 0.2, 0.7 + rng() * 0.5, 7, pick(rng, ['#2f5d2a', '#3a7a33', '#4b8a3c']), { r: 0.9, j: 0.2 }); Bs.cyl(px + 0.3, y + 0.5, pz + 0.1, 0.25, 0.1, 0.5, 6, pick(rng, ['#e04a6a', '#f2c230', '#f2f2f2']), { r: 0.9 });
      }
      for (let k = 0; k < 2; k++) { const px = x0 - 1.5 + k * 2.6, pz = z0 + 1.4; Bs.xbox(px, y + 0.3, pz, 0.35, 0.05, 0.9, 0.2 - k * 0.4, 0, '#efe8da', { r: 0.7 }); Bs.xbox(px, y + 0.55, pz - 0.7, 0.35, 0.05, 0.4, 0.2 - k * 0.4, -0.9, '#efe8da', { r: 0.7 }); Bs.box(px - 0.3, px - 0.2, y, y + 0.28, pz - 0.5, pz - 0.4, '#555'); Bs.box(px + 0.2, px + 0.3, y, y + 0.28, pz + 0.7, pz + 0.8, '#555'); }
      const ux = x0 + gx / 2 - 1.2, uz = z0 + 0.2;
      Bs.cyl(ux, y, uz, 0.03, 0.03, 2.3, 6, '#ddd'); Bs.cyl(ux, y + 1.9, uz, 1.5, 0.03, 0.5, 8, pick(rng, ['#e8dcb8', '#c0392b', '#2d6a8f']), { r: 0.9 }); Bs.cyl(ux, y, uz + 0.9, 0.35, 0.35, 0.5, 10, '#6a5a48');
      // lampki girlandowe
      const A1 = [x0 - gx / 2, y + 2.4, z0 + gz / 2], B1 = [x0 + gx / 2, y + 2.4, z0 + gz / 2];
      Bs.cyl(A1[0], y, A1[2], 0.04, 0.04, 2.4, 5, '#555'); Bs.cyl(B1[0], y, B1[2], 0.04, 0.04, 2.4, 5, '#555'); Bs.cable(A1, B1, 0.5, 0.015, '#1a1a1a');
      for (let k = 1; k < 8; k++) { const f = k / 8; Li.add(A1[0] + (B1[0] - A1[0]) * f, A1[1] - 0.5 * 4 * f * (1 - f) - 0.05, A1[2], WARM, 1.2, 1, 0); }
    }
  }
  // pranie na niskich budynkach
  if (y < 34 && rng() < 0.4) {
    const p = slot(rec, rng, 6.6, 1.2, 0.2);
    if (p) {
      const x0 = p[0] - 3.1, x1 = p[0] + 3.1, z = p[1];
      Bs.cyl(x0, y, z, 0.04, 0.04, 2.3, 5, '#7a6a58'); Bs.cyl(x1, y, z, 0.04, 0.04, 2.3, 5, '#7a6a58');
      Bs.cable([x0, y + 2.25, z], [x1, y + 2.25, z], 0.18, 0.012, '#bbb');
      const n = 6 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) { const f = (k + 0.7) / (n + 0.4), cxk = x0 + (x1 - x0) * f, hy = y + 2.25 - 0.18 * 4 * f * (1 - f), hh = 0.55 + rng() * 0.45, ww = 0.3 + rng() * 0.3; Bs.xbox(cxk, hy - hh / 2, z, ww / 2, hh / 2, 0.012, 0.15 * Math.sin(k * 3), 0, pick(rng, PAL.cloth), { r: 0.95 }); }
    }
  }
  // balustrady i slupki
  if (rng() < 0.28) {
    const side = Math.floor(rng() * 4), horiz = side < 2, len = (horiz ? w : d) - 6;
    if (len > 5) {
      const l0 = 2.8 + rng() * (len * 0.3), L2 = Math.min(len, 6 + rng() * 8), a0 = (horiz ? b.x0 : b.z0) + l0, off = 1.55;
      const wp = (a) => horiz ? [a, side === 0 ? b.z1 - off : b.z0 + off] : [side === 2 ? b.x1 - off : b.x0 + off, a];
      const n = Math.floor(L2 / 1.5);
      for (let k = 0; k <= n; k++) { const q = wp(a0 + k * L2 / n); Bs.box(q[0] - 0.035, q[0] + 0.035, y, y + 1.1, q[1] - 0.035, q[1] + 0.035, '#8d9298', M); }
      const q0 = wp(a0), q1 = wp(a0 + L2); Bs.seg([q0[0], y + 1.1, q0[1]], [q1[0], y + 1.1, q1[1]], 0.05, '#8d9298', M); Bs.seg([q0[0], y + 0.6, q0[1]], [q1[0], y + 0.6, q1[1]], 0.035, '#8d9298', M);
    }
  }
  // drobiazgi: beczki, skrzynie, palety, zwoje papy, swietliki
  for (let i = 0, n = 2 + Math.floor(rng() * 4); i < n; i++) {
    const p = slot(rec, rng, 1.3, 1.3, 0.2); if (!p) break;
    const t = rng();
    if (t < 0.25) { const c = pick(rng, ['#2f5da8', '#2f8a56', '#a8322f', '#444']); Bs.cyl(p[0], y, p[1], 0.3, 0.3, 0.9, 10, c, { r: 0.55, m: 0.4 }); if (rng() < 0.6) Bs.cyl(p[0] + 0.7, y, p[1] + 0.2, 0.3, 0.3, 0.9, 10, c, { r: 0.55, m: 0.4 }); }
    else if (t < 0.45) { Bs.box(p[0] - 0.5, p[0] + 0.5, y, y + 0.7, p[1] - 0.5, p[1] + 0.5, '#9b7a52', { r: 0.95 }); if (rng() < 0.5) Bs.box(p[0] - 0.4, p[0] + 0.4, y + 0.7, y + 1.3, p[1] - 0.4, p[1] + 0.4, '#8a6a46', { r: 0.95 }); }
    else if (t < 0.6) { Bs.box(p[0] - 0.6, p[0] + 0.6, y, y + 0.14, p[1] - 0.5, p[1] + 0.5, '#a8885a', { r: 0.95 }); Bs.box(p[0] - 0.5, p[0] + 0.5, y + 0.14, y + 0.7, p[1] - 0.4, p[1] + 0.4, '#d8d3c4', { r: 0.9 }); }
    else if (t < 0.78) { Bs.cyl(p[0], y + 0.4, p[1], 0.4, 0.4, 1.4, 10, '#1c1c1e', { r: 0.9 }, rng() * 3, Math.PI / 2); }
    else { const s = 1.0 + rng() * 0.6; Bs.box(p[0] - s, p[0] + s, y, y + 0.35, p[1] - s, p[1] + s, '#566069', { r: 0.8 }); Bs.xbox(p[0], y + 0.6, p[1], s * 0.8, 0.02, s * 0.8, 0, 0, '#5f7f92', { r: 0.4, m: 0.1, e: 4 }); Bs.xbox(p[0], y + 0.5, p[1], s * 0.92, 0.12, s * 0.92, 0, 0.0, '#566069'); }
  }
  // dodatkowe plamy (wieksza gestosc z bliska), kaluze, szwy membrany
  const rf = b.x0 + 0.45, rt = b.x1 - 0.45, zf = b.z0 + 0.45, zt = b.z1 - 0.45;
  for (let i = 0, n = 2 + Math.floor(rng() * 3); i < n; i++) {
    const rx = 0.8 + rng() * 2.2, rz = 0.6 + rng() * 1.6, px = rf + rx + rng() * Math.max(0.1, rt - rf - rx * 2), pz = zf + rz + rng() * Math.max(0.1, zt - zf - rz * 2);
    if (rng() < 0.45) Bs.disc(px, pz, rx * 0.8, rz * 0.8, y + 0.07 + i * 0.006, 16, '#232c33', { r: 0.06, m: 0.1, j: 0.04 }, rng() * 3); else Bs.disc(px, pz, rx, rz, y + 0.06 + i * 0.006, 16, pick(rng, ['#9a968c', '#5a5a58', '#6b665c']), { r: 0.95 }, rng() * 3);
  }
  if (rng() < 0.35) for (let a = rf + 2.4; a < rt - 1; a += 2.4) Bs.flat(a, a + 0.07, zf + 0.3, zt - 0.3, y + 0.045, '#606266', { r: 0.9, j: 0.05 });
  // sciezka z plyt
  if (rec.house && rng() < 0.6) { const h = rec.house, [nx, nz] = SIDE_N[h.side]; const x0 = h.x + nx * (nx ? h.ax + 0.2 : 0), z0 = h.z + nz * (nz ? h.az + 0.2 : 0); for (let k = 0; k < 4; k++) Bs.flat(x0 + nx * (0.4 + k * 1.2) - 0.45 - (nx ? 0.2 : 0), x0 + nx * (0.4 + k * 1.2) + 0.45 + (nx ? 0.2 : 0), z0 + nz * (0.4 + k * 1.2) - 0.45 - (nz ? 0.2 : 0), z0 + nz * (0.4 + k * 1.2) + 0.45 + (nz ? 0.2 : 0), y + 0.08, '#b8b4a8', { r: 0.9 }); }
  // reflektor na attyce
  if (rng() < 0.35) { const q = [b.x0 + 1.4 + rng() * (w - 2.8), b.z1 - 0.9]; Bs.cyl(q[0], y, q[1], 0.05, 0.05, 2.6, 6, '#555'); Bs.xbox(q[0], y + 2.65, q[1], 0.25, 0.12, 0.2, rng() * TAU, 0.6, '#d8dde2', { e: 3, r: 0.3 }); Li.add(q[0], y + 2.6, q[1], COOL, 4, 1, 0); }
}

// ---------------------------------------------------------------- scalanie w kawalki i zarzadzanie poziomami
const newSet = () => ({ solid: new B(false), spin: new B(true), ad: new A(), lights: new L() });
function mkMeshes(set, tag) {
  const out = [];
  const g1 = set.solid.geo(); if (g1) { const m = new THREE.Mesh(g1, matSolid); m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); out.push(m); }
  const g2 = set.spin.geo(); if (g2) { const m = new THREE.Mesh(g2, matSpin); m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; scene.add(m); out.push(m); }
  const g3 = set.ad.geo(); if (g3) { const m = new THREE.Mesh(g3, matAd); m.matrixAutoUpdate = false; scene.add(m); out.push(m); }
  const g4 = set.lights.geo(); if (g4) { const m = new THREE.Points(g4, matLight); m.matrixAutoUpdate = false; scene.add(m); out.push(m); }
  return out;
}
export function buildDachy() {
  if (dbg('nodachy')) return;
  initMats();
  for (const rec of recs) {
    const b = rec.b, k = Math.floor((b.x0 + b.x1) / 2 / CH) + ',' + Math.floor((b.z0 + b.z1) / 2 / CH);
    let ch = chunks.get(k); if (!ch) { ch = { recs: [], base: newSet(), det: newSet(), detMeshes: null, baseMeshes: null }; chunks.set(k, ch); }
    ch.recs.push(rec);
  }
  for (const ch of chunks.values()) { for (const rec of ch.recs) genBase(rec, ch); ch.baseMeshes = mkMeshes(ch.base); ch.base = null; }
}
export function setDachyTOD(lamps, name) {
  U.lamp.value = lamps; U.ad.value = name === 'night' ? 2.3 : name === 'day' ? 1.15 : 1.55;
}
let _tick = 0;
export function updateDachy(time, pos) {
  U.t.value = time;
  U.scale.value = renderer.domElement.height * 0.5 * camera.projectionMatrix.elements[5];
  if (++_tick % 8) return;
  let budget = 2;
  for (const ch of chunks.values()) {
    let dm = 1e9;
    for (const rec of ch.recs) { const b = rec.b, dx = Math.max(b.x0 - pos.x, 0, pos.x - b.x1), dz = Math.max(b.z0 - pos.z, 0, pos.z - b.z1); dm = Math.min(dm, Math.hypot(dx, dz)); }
    if (!ch.detMeshes && dm < 230 && budget > 0) {
      budget--; for (const rec of ch.recs) genDetail(rec, ch);
      ch.detMeshes = mkMeshes(ch.det); ch.det = null;
    } else if (ch.detMeshes) {
      const vis = ch.detMeshes[0].visible ? dm < 420 : dm < 300;
      for (const m of ch.detMeshes) m.visible = vis;
    }
  }
}
// do testow: zbuduj od razu wszystkie detale
export function dachyDetaleWszystkie() { for (const ch of chunks.values()) if (!ch.detMeshes) { for (const rec of ch.recs) genDetail(rec, ch); ch.detMeshes = mkMeshes(ch.det); ch.det = null; } }
