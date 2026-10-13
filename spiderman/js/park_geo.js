// Park: geometria i tekstury roslinnosci — atlas tekstur (liscie, kora, kwiaty, trawa), generator drzew gatunkowych
// (dab, klon, brzoza, wierzba, swierk) z koronami z wielu kep kart z przezroczystymi brzegami (alpha-test).
// Wszystko do scalonych geometrii (Geo) — bez instancji i bez swiatel.
import { cv } from './util.js';

// ---------------------------------------------------------------- losowanie z ziarnem (niezalezne od srand miasta)
export function rng(seed) {
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.r = (a, b) => a + f() * (b - a);
  f.i = (a, b) => Math.floor(a + f() * (b - a + 1));
  f.pick = a => a[Math.floor(f() * a.length)];
  return f;
}
export const lc = hex => [Math.pow((hex >> 16 & 255) / 255, 2.2), Math.pow((hex >> 8 & 255) / 255, 2.2), Math.pow((hex & 255) / 255, 2.2)];
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------------------------------------------------------- atlas tekstur 4x4 kafle po 256 px
export const T_OAK = 0, T_MAPLE = 1, T_BIRCH = 2, T_WILLOW = 3, T_SPRUCE = 4, T_BUSH = 5, T_FLOWER = 6, T_TUFT = 7, T_HEDGE = 8,
  T_BARK = 9, T_BIRCHBARK = 10, T_SPRUCEBARK = 11, T_WHITE = 12, T_LAMP = 13, T_LITTER = 14;
export function uvr(t, pad = 0.006) { const c = t % 4, r = Math.floor(t / 4); return [c / 4 + pad, 1 - (r + 1) / 4 + pad, (c + 1) / 4 - pad, 1 - r / 4 - pad]; }

export function makeAtlas() {
  const S = 256, W = cv(1024, 1024), X = W.getContext('2d'), E = cv(1024, 1024), XE = E.getContext('2d');
  XE.fillStyle = '#000'; XE.fillRect(0, 0, 1024, 1024);
  const R = rng(777);
  const g = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
  const tile = (t, fn) => { X.save(); X.translate((t % 4) * S, Math.floor(t / 4) * S); X.beginPath(); X.rect(0, 0, S, S); X.clip(); fn(); X.restore(); };
  const ell = (x, y, rx, ry, rot) => { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, 6.2832); X.fill(); };
  const star = (x, y, r, rot) => { // lisc klonu: 5 klapowy
    X.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r; X[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    X.closePath(); X.fill();
  };
  // geste kepy liscia o nieregularnym brzegu
  const blob = (o) => {
    const p1 = R.r(0, 6), p2 = R.r(0, 6), p3 = R.r(0, 6);
    const edge = a => o.rmax * (0.8 + 0.2 * Math.sin(3 * a + p1) * Math.cos(2 * a + p2) + 0.08 * Math.sin(7 * a + p3));
    // ciemne jadro (cien wewnatrz korony) zeby srodek byl pelny
    X.fillStyle = g(o.core || 80);
    X.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.2832, r = edge(a) * 0.74; X[i ? 'lineTo' : 'moveTo'](128 + Math.cos(a) * r, 128 + Math.sin(a) * r * 0.94); } X.fill();
    for (let i = 0; i < o.n; i++) {
      const a = R.r(0, 6.2832), r = Math.pow(R(), 0.55) * edge(a);
      const px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r * 0.94;
      const top = clamp01(1 - py / S), v = (o.v0 || 90) + ((o.v1 || 250) - (o.v0 || 90)) * (R() * 0.65 + top * 0.35);
      X.fillStyle = g(v);
      const ls = o.ls * R.r(0.7, 1.3);
      if (o.shape === 'star') star(px, py, ls, R.r(0, 6.28)); else ell(px, py, ls, ls * (o.asp || 0.55), R.r(0, 6.28));
    }
  };
  tile(T_OAK, () => blob({ n: 800, rmax: 96, ls: 10, asp: 0.6, core: 78 }));
  tile(T_MAPLE, () => blob({ n: 300, rmax: 98, ls: 13, shape: 'star', core: 85 }));
  tile(T_BIRCH, () => blob({ n: 900, rmax: 98, ls: 7, asp: 0.5, v0: 110, core: 95 }));
  tile(T_BUSH, () => blob({ n: 650, rmax: 98, ls: 9, asp: 0.6, core: 70, v0: 70, v1: 235 }));
  tile(T_WILLOW, () => {
    X.fillStyle = g(95); X.fillRect(0, 0, S, 16);
    for (let k = 0; k < 54; k++) {
      let x = 8 + R() * 240, y = 0; const len = 90 + R() * 160, sw = R.r(-0.35, 0.35);
      while (y < len) {
        X.fillStyle = g(R.r(100, 235)); ell(x, y, 3.2, 9, sw * 0.5 + R.r(-0.3, 0.3)); x += sw + R.r(-1.2, 1.2); y += 5.5;
      }
    }
  });
  tile(T_SPRUCE, () => {
    X.lineCap = 'round';
    const twig = (x0, y0, ang, len, w) => {
      X.strokeStyle = g(R.r(60, 110)); X.lineWidth = w; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len); X.stroke();
      for (let t = 0.1; t < 1; t += 0.07) {
        const px = x0 + Math.cos(ang) * len * t, py = y0 + Math.sin(ang) * len * t;
        for (const s of [-1, 1]) { const a = ang + s * 1.0, l = 15 * (1.15 - t * 0.6); X.strokeStyle = g(R.r(80, 220)); X.lineWidth = 1.7; X.beginPath(); X.moveTo(px, py); X.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); X.stroke(); }
      }
    };
    X.strokeStyle = g(90); X.lineWidth = 4; X.beginPath(); X.moveTo(128, S); X.lineTo(128, 6); X.stroke();
    for (let t = 0; t < 1; t += 0.045) { const y = S - 8 - t * 236, l = 100 * (1 - t * 0.62); for (const s of [-1, 1]) twig(128, y, -Math.PI / 2 + s * 1.05, l, 2.4); }
    for (let t = 0; t < 1; t += 0.035) { X.strokeStyle = g(R.r(80, 200)); X.lineWidth = 1.7; const y = S - 8 - t * 236; X.beginPath(); X.moveTo(128, y); X.lineTo(128 + R.r(-9, 9), y - 12); X.stroke(); }
  });
  tile(T_FLOWER, () => {
    const gc = ['#3f6a2a', '#4d7d32', '#5c8f3a', '#356027'];
    for (let i = 0; i < 260; i++) { X.fillStyle = R.pick(gc); const a = R.r(0, 6.28), r = Math.sqrt(R()) * 100; ell(128 + Math.cos(a) * r * 1.1, 190 + Math.sin(a) * r * 0.5, 14, 5, R.r(-1.2, 1.2)); }
    const fc = ['#f4f1e8', '#e85a8a', '#f4c93a', '#e8742a', '#b05ad0', '#d83a3a', '#ff9ac0'];
    for (let c = 0; c < 6; c++) {
      const col = fc[c % fc.length], cx = R.r(50, 206), cy = R.r(80, 160);
      for (let i = 0; i < 38; i++) { const a = R.r(0, 6.28), r = Math.sqrt(R()) * 46; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.75; X.fillStyle = col; X.beginPath(); X.arc(x, y, R.r(5, 8), 0, 6.3); X.fill(); X.fillStyle = '#fff3a0'; X.beginPath(); X.arc(x, y, 1.8, 0, 6.3); X.fill(); }
    }
  });
  tile(T_TUFT, () => {
    for (let i = 0; i < 70; i++) {
      const x = R.r(36, 220), h = R.r(80, 210), bend = R.r(-40, 40), w = R.r(3, 7), k = R.r(0.7, 1.15);
      const gr = X.createLinearGradient(0, S, 0, S - h); gr.addColorStop(0, `rgb(${50 * k | 0},${85 * k | 0},${30 * k | 0})`); gr.addColorStop(1, `rgb(${130 * k | 0},${165 * k | 0},${60 * k | 0})`);
      X.fillStyle = gr; X.beginPath(); X.moveTo(x - w, S); X.quadraticCurveTo(x + bend * 0.2, S - h * 0.6, x + bend, S - h); X.quadraticCurveTo(x + bend * 0.3 + w * 0.5, S - h * 0.55, x + w, S); X.fill();
    }
  });
  tile(T_HEDGE, () => {
    X.fillStyle = g(95); X.fillRect(0, 0, S, S);
    for (let i = 0; i < 1900; i++) { X.fillStyle = g(R.r(60, 235)); ell(R.r(0, S), R.r(0, S), 9, 5, R.r(0, 6.28)); }
  });
  const bark = (t, base, dark, light, n, wmax) => tile(t, () => {
    X.fillStyle = base; X.fillRect(0, 0, S, S);
    for (let i = 0; i < n; i++) {
      X.strokeStyle = R() < 0.62 ? dark : light; X.globalAlpha = R.r(0.25, 0.7); X.lineWidth = R.r(1, wmax);
      let x = R.r(0, S), y = R.r(-40, S); X.beginPath(); X.moveTo(x, y);
      for (let j = 0; j < 4; j++) { x += R.r(-6, 6); y += R.r(18, 50); X.lineTo(x, y); } X.stroke();
    }
    X.globalAlpha = 1;
    for (let i = 0; i < 1500; i++) { X.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.08)'; X.fillRect(R.r(0, S), R.r(0, S), 2, 2); }
  });
  bark(T_BARK, '#4d3e31', '#1e1612', '#8a7a68', 150, 5);
  bark(T_SPRUCEBARK, '#6b4c3a', '#2a1c14', '#9a7458', 120, 4);
  tile(T_BIRCHBARK, () => {
    X.fillStyle = '#e9e5db'; X.fillRect(0, 0, S, S);
    for (let i = 0; i < 700; i++) { X.fillStyle = `rgba(120,115,105,${R.r(0.04, 0.12)})`; X.fillRect(R.r(0, S), R.r(0, S), R.r(1, 3), R.r(6, 30)); }
    for (let i = 0; i < 46; i++) { X.fillStyle = `rgba(28,26,24,${R.r(0.55, 0.95)})`; const w = R.r(26, 110), h = R.r(3, 9); const x = R.r(-10, S - 20), y = R.r(0, S); X.beginPath(); X.ellipse(x + w / 2, y, w / 2, h / 2, 0, 0, 6.3); X.fill(); }
  });
  tile(T_WHITE, () => { X.fillStyle = '#fff'; X.fillRect(0, 0, S, S); });
  tile(T_LAMP, () => { X.fillStyle = '#fff2d2'; X.fillRect(0, 0, S, S); });
  XE.fillStyle = '#ffe3a0'; XE.fillRect((T_LAMP % 4) * S, Math.floor(T_LAMP / 4) * S, S, S);
  tile(T_LITTER, () => {
    const lc2 = ['#c0501c', '#d9892a', '#e4b13a', '#8e3a1c', '#a8682c', '#b33a1e', '#7a5a2a'];
    for (let i = 0; i < 46; i++) { X.fillStyle = R.pick(lc2); const x = R.r(14, 242), y = R.r(14, 242); if (R() < 0.5) star(x, y, R.r(9, 15), R.r(0, 6.28)); else ell(x, y, R.r(7, 12), R.r(4, 7), R.r(0, 6.28)); }
  });
  const map = new THREE.CanvasTexture(W), emi = new THREE.CanvasTexture(E);
  for (const t of [map, emi]) { t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; }
  return { map, emi };
}

// ---------------------------------------------------------------- scalona geometria z wierzcholkami: pozycja, normalna, uv, kolor, maska odcienia
export class Geo {
  constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.m = []; this.i = []; }
  get verts() { return this.p.length / 3; }
  vert(x, y, z, nx, ny, nz, u, v, r, g, b, m) { const k = this.p.length / 3; this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(r, g, b); this.m.push(m || 0); return k; }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  tri(a, b, c) { this.i.push(a, b, c); }
  // dodaje szablon (drzewo) z obrotem wokol Y, skala i odcieniem (tylko wierzcholki z maska)
  append(t, x, y, z, rot, sx, sy, tint) {
    const base = this.p.length / 3, cs = Math.cos(rot), sn = Math.sin(rot), P = t.p, N = t.n, n = P.length / 3;
    for (let k = 0; k < n; k++) {
      const px = P[k * 3] * sx, py = P[k * 3 + 1] * sy, pz = P[k * 3 + 2] * sx;
      this.p.push(x + px * cs + pz * sn, y + py, z - px * sn + pz * cs);
      const nx = N[k * 3], nz = N[k * 3 + 2]; this.n.push(nx * cs + nz * sn, N[k * 3 + 1], -nx * sn + nz * cs);
      this.u.push(t.u[k * 2], t.u[k * 2 + 1]);
      if (t.m[k] && tint) this.c.push(t.c[k * 3] * tint[0], t.c[k * 3 + 1] * tint[1], t.c[k * 3 + 2] * tint[2]); else this.c.push(t.c[k * 3], t.c[k * 3 + 1], t.c[k * 3 + 2]);
      this.m.push(t.m[k]);
    }
    for (let k = 0; k < t.i.length; k++) this.i.push(t.i[k] + base);
  }
  toBuffer() {
    const G = new THREE.BufferGeometry();
    G.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); G.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    G.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); G.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    G.setIndex(this.p.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    G.computeBoundingSphere(); return G;
  }
}

// ---------------------------------------------------------------- prymitywy (kolor jednolity przez kafel bialy)
const UW = uvr(T_WHITE, 0.1);
export function box(g, cx, y0, cz, sx, sy, sz, rot, col, skipBottom = true) {
  const cs = Math.cos(rot), sn = Math.sin(rot), hx = sx / 2, hz = sz / 2, y1 = y0 + sy;
  const P = (lx, lz) => [cx + lx * cs + lz * sn, cz - lx * sn + lz * cs];
  const c = [P(-hx, -hz), P(hx, -hz), P(hx, hz), P(-hx, hz)];
  const faces = [[0, 1, [0, 0, -1]], [1, 2, [1, 0, 0]], [2, 3, [0, 0, 1]], [3, 0, [-1, 0, 0]]];
  for (const [a, b, n] of faces) {
    const nn = [n[0] * cs + n[2] * sn, 0, -n[0] * sn + n[2] * cs];
    const k = g.vert(c[a][0], y0, c[a][1], nn[0], 0, nn[2], UW[0], UW[1], col[0], col[1], col[2]); g.vert(c[b][0], y0, c[b][1], nn[0], 0, nn[2], UW[2], UW[1], col[0], col[1], col[2]);
    g.vert(c[b][0], y1, c[b][1], nn[0], 0, nn[2], UW[2], UW[3], col[0], col[1], col[2]); g.vert(c[a][0], y1, c[a][1], nn[0], 0, nn[2], UW[0], UW[3], col[0], col[1], col[2]); g.quad(k, k + 1, k + 2, k + 3);
  }
  const k = g.vert(c[0][0], y1, c[0][1], 0, 1, 0, UW[0], UW[1], col[0], col[1], col[2]); for (let q = 1; q < 4; q++) g.vert(c[q][0], y1, c[q][1], 0, 1, 0, UW[0], UW[1], col[0], col[1], col[2]); g.quad(k, k + 1, k + 2, k + 3);
  if (!skipBottom) { const b = g.vert(c[0][0], y0, c[0][1], 0, -1, 0, UW[0], UW[1], col[0], col[1], col[2]); for (let q = 1; q < 4; q++) g.vert(c[q][0], y0, c[q][1], 0, -1, 0, UW[0], UW[1], col[0], col[1], col[2]); g.quad(b, b + 3, b + 2, b + 1); }
}
export function cyl(g, cx, y0, cz, r0, r1, h, sides, col, cap = true, tile = T_WHITE) {
  const uv = uvr(tile, 0.1), ry = (r0 - r1) / h;
  const k0 = g.verts;
  for (let s = 0; s <= sides; s++) {
    const a = s / sides * 6.2832, c = Math.cos(a), sn = Math.sin(a), nl = Math.hypot(1, ry);
    g.vert(cx + c * r0, y0, cz + sn * r0, c / nl, ry / nl, sn / nl, uv[0] + (uv[2] - uv[0]) * s / sides, uv[1], col[0], col[1], col[2]);
    g.vert(cx + c * r1, y0 + h, cz + sn * r1, c / nl, ry / nl, sn / nl, uv[0] + (uv[2] - uv[0]) * s / sides, uv[3], col[0], col[1], col[2]);
  }
  for (let s = 0; s < sides; s++) { const a = k0 + s * 2; g.quad(a, a + 2, a + 3, a + 1); }
  if (cap && r1 > 0.001) { const c = g.vert(cx, y0 + h, cz, 0, 1, 0, uv[0], uv[1], col[0], col[1], col[2]); for (let s = 0; s <= sides; s++) { const a = s / sides * 6.2832; g.vert(cx + Math.cos(a) * r1, y0 + h, cz + Math.sin(a) * r1, 0, 1, 0, uv[0], uv[1], col[0], col[1], col[2]); } for (let s = 0; s < sides; s++) g.tri(c, c + 1 + s, c + 2 + s); }
}
export function sph(g, cx, cy, cz, rx, ry, rz, seg, col, tile = T_WHITE) {
  const uv = uvr(tile, 0.1), rings = Math.max(3, seg >> 1), k0 = g.verts;
  for (let j = 0; j <= rings; j++) {
    const v = j / rings, a = v * Math.PI, y = Math.cos(a), r = Math.sin(a);
    for (let s = 0; s <= seg; s++) { const b = s / seg * 6.2832, nx = Math.cos(b) * r, nz = Math.sin(b) * r; g.vert(cx + nx * rx, cy + y * ry, cz + nz * rz, nx, y, nz, uv[0], uv[1], col[0], col[1], col[2]); }
  }
  for (let j = 0; j < rings; j++) for (let s = 0; s < seg; s++) { const a = k0 + j * (seg + 1) + s, b = a + seg + 1; g.quad(a, b, b + 1, a + 1); }
}
// belka miedzy dwoma punktami 3D (szerokosc w poziomie, grubosc w pionie)
export function slab(g, a, b, w, t, col) {
  const f = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
  let sd = norm([f[2], 0, -f[0]]); if (Math.abs(f[0]) + Math.abs(f[2]) < 1e-4) sd = [1, 0, 0];
  const up = [f[1] * sd[2] - f[2] * sd[1], f[2] * sd[0] - f[0] * sd[2], f[0] * sd[1] - f[1] * sd[0]];
  const cor = [];
  for (const e of [a, b]) for (const [sw, st] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) cor.push([e[0] + sd[0] * sw * w / 2 + up[0] * st * t / 2, e[1] + sd[1] * sw * w / 2 + up[1] * st * t / 2, e[2] + sd[2] * sw * w / 2 + up[2] * st * t / 2]);
  const faces = [[0, 1, 5, 4, [-up[0], -up[1], -up[2]]], [3, 2, 6, 7, up], [0, 3, 7, 4, [-sd[0], -sd[1], -sd[2]]], [1, 2, 6, 5, sd], [0, 1, 2, 3, [-f[0], -f[1], -f[2]]], [4, 5, 6, 7, f]];
  for (const [i0, i1, i2, i3, n] of faces) {
    const k = g.verts; for (const i of [i0, i1, i2, i3]) g.vert(cor[i][0], cor[i][1], cor[i][2], n[0], n[1], n[2], UW[0], UW[1], col[0], col[1], col[2]);
    g.quad(k, k + 1, k + 2, k + 3);
  }
}
// plaska karta (np. kwiat, trawa, lisc na ziemi): centrum, osie a,b (wektory polowkowe), kafel, kolor, normalna
export function card(g, c, a, b, tile, col, nrm, mask = 0, uvFlip = false) {
  const uv = uvr(tile), k = g.verts;
  const cs = [[-1, -1, 0, 1], [1, -1, 2, 1], [1, 1, 2, 3], [-1, 1, 0, 3]];
  for (const [sa, sb, ui, vi] of cs) g.vert(c[0] + a[0] * sa + b[0] * sb, c[1] + a[1] * sa + b[1] * sb, c[2] + a[2] * sa + b[2] * sb, nrm[0], nrm[1], nrm[2], uv[ui], uv[vi], col[0], col[1], col[2], mask);
  g.quad(k, k + 1, k + 2, k + 3);
}

// ---------------------------------------------------------------- drzewa
const BARKS = { oak: T_BARK, maple: T_BARK, willow: T_BARK, birch: T_BIRCHBARK, spruce: T_SPRUCEBARK };
// kawalek konara: krzywa bezier podzielona na odcinki ~1.3 m (zeby tekstura kory nie rozciagala sie za bardzo)
function limb(g, a, b, r0, r1, tile, sides, bend, bcol) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), n = Math.max(1, Math.round(len / 1.3));
  const ctl = [(a[0] + b[0]) / 2 + bend[0], (a[1] + b[1]) / 2 + bend[1], (a[2] + b[2]) / 2 + bend[2]];
  const pt = t => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * ctl[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * ctl[1] + t * t * b[1], (1 - t) * (1 - t) * a[2] + 2 * (1 - t) * t * ctl[2] + t * t * b[2]];
  const uv = uvr(tile, 0.012);
  let prev = pt(0), pr = r0;
  for (let s = 1; s <= n; s++) {
    const cur = pt(s / n), rr = r0 + (r1 - r0) * s / n;
    const d = norm([cur[0] - prev[0], cur[1] - prev[1], cur[2] - prev[2]]);
    let u1 = norm([d[1] * 0 - d[2] * 1, d[2] * 0 - d[0] * 0, d[0] * 1 - d[1] * 0]); // d x (0,1,0)
    if (Math.abs(d[1]) > 0.98) u1 = [1, 0, 0];
    const u2 = [d[1] * u1[2] - d[2] * u1[1], d[2] * u1[0] - d[0] * u1[2], d[0] * u1[1] - d[1] * u1[0]];
    const k = g.verts, vu = uv[1] + (uv[3] - uv[1]) * 0.15 * (s % 5), vd = vu + (uv[3] - uv[1]) * 0.18;
    for (let q = 0; q <= sides; q++) {
      const ang = q / sides * 6.2832, c = Math.cos(ang), sn = Math.sin(ang), nx = u1[0] * c + u2[0] * sn, ny = u1[1] * c + u2[1] * sn, nz = u1[2] * c + u2[2] * sn;
      const uu = uv[0] + (uv[2] - uv[0]) * q / sides;
      g.vert(prev[0] + nx * pr, prev[1] + ny * pr, prev[2] + nz * pr, nx, ny, nz, uu, vu, bcol[0], bcol[1], bcol[2], 0);
      g.vert(cur[0] + nx * rr, cur[1] + ny * rr, cur[2] + nz * rr, nx, ny, nz, uu, vd, bcol[0], bcol[1], bcol[2], 0);
    }
    for (let q = 0; q < sides; q++) { const i = k + q * 2; g.quad(i, i + 2, i + 3, i + 1); }
    prev = cur; pr = rr;
  }
  return b;
}
// kepa lisci: trzy przecinajace sie karty (dwie pionowe i jedna pozioma), normalne "kopulaste" od srodka korony, cieniowanie wg wysokosci
function cluster(g, R, x, y, z, size, tile, cr) {
  const th = R.r(0, 6.28), hw = size / 2, hh = size * 0.47;
  const defs = [[th, 'v'], [th + 1.5708 + R.r(-0.3, 0.3), 'v'], [th * 1.7, 'h']];
  const uv = uvr(tile), shadeV = (py, px, pz) => {
    const dx = px - cr.x, dy = py - cr.y, dz = pz - cr.z, d = Math.hypot(dx, dy, dz);
    return (0.5 + 0.7 * clamp01((py - cr.y0) / cr.H)) * (0.74 + 0.26 * Math.min(1, d / cr.R));
  };
  for (const [t, kind] of defs) {
    const tl = R.r(-0.3, 0.3), cs = Math.cos(t), sn = Math.sin(t);
    let a = [cs * hw, 0, sn * hw], b;
    if (kind === 'v') b = norm([-sn * tl, 1, cs * tl]).map(v => v * hh); else b = norm([-sn, tl, cs]).map(v => v * hh * 1.05);
    const jx = R.r(-0.25, 0.25) * size * 0.3, jz = R.r(-0.25, 0.25) * size * 0.3, rv = R.r(0.9, 1.1);
    const k = g.verts;
    for (const [sa, sb, ui, vi] of [[-1, -1, 0, 1], [1, -1, 2, 1], [1, 1, 2, 3], [-1, 1, 0, 3]]) {
      const px = x + jx + a[0] * sa + b[0] * sb, py = y + a[1] * sa + b[1] * sb, pz = z + jz + a[2] * sa + b[2] * sb;
      const n = norm([(px - cr.x) / cr.R, (py - cr.y) / cr.R * 0.9 + 0.3, (pz - cr.z) / cr.R]), sh = shadeV(py, px, pz) * rv;
      g.vert(px, py, pz, n[0], n[1], n[2], uv[ui], uv[vi], sh, sh, sh, 1);
    }
    g.quad(k, k + 1, k + 2, k + 3);
  }
}
function broadleaf(g, R, lod, P, species) {
  const bk = BARKS[species], bc = species === 'maple' ? [0.62, 0.58, 0.56] : [0.8, 0.76, 0.72], hi = lod === 0, sides = hi ? 6 : 4;
  const th = R.r(P.th[0], P.th[1]), lean = [R.r(-0.5, 0.5), R.r(-0.5, 0.5)];
  const top = [lean[0], th, lean[1]];
  limb(g, [0, -0.3, 0], [0, 0.7, 0], P.tr * 1.5, P.tr * 1.05, bk, sides, [0, 0, 0], bc);
  limb(g, [0, 0.7, 0], top, P.tr * 1.05, P.tr * 0.62, bk, sides, [lean[0] * 0.3, 0, lean[1] * 0.3], bc);
  const cy = th + P.ch * 0.46, cr = { x: top[0], y: cy, z: top[2], R: P.cr, y0: th - 0.5, H: P.ch };
  const nb = R.i(P.nb[0], P.nb[1]), size = P.cs;
  for (let b = 0; b < nb; b++) {
    const az = b / nb * 6.2832 + R.r(-0.4, 0.4), el = R.r(P.el[0], P.el[1]), len = R.r(P.len[0], P.len[1]);
    const st = [top[0], th - R.r(0, 0.9), top[2]], dir = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const mid = [st[0] + dir[0] * len * 0.5, st[1] + dir[1] * len * 0.5, st[2] + dir[2] * len * 0.5], end = [st[0] + dir[0] * len, st[1] + dir[1] * len + 0.5, st[2] + dir[2] * len];
    limb(g, st, mid, P.tr * 0.45, P.tr * 0.3, bk, sides, [0, 0.15, 0], bc);
    limb(g, mid, end, P.tr * 0.3, P.tr * 0.12, bk, sides, [0, 0.35, 0], bc);
    cluster(g, R, end[0], end[1] + size * 0.15, end[2], size * (hi ? 1 : 1.3) * R.r(0.9, 1.1), P.tile, cr);
    if (hi) {
      for (let s = 0; s < 2; s++) {
        const az2 = az + (s ? 1 : -1) * R.r(0.5, 1.1), el2 = el * 0.7 + 0.1, l2 = R.r(1.6, 2.6);
        const e2 = [mid[0] + Math.cos(az2) * Math.cos(el2) * l2, mid[1] + Math.sin(el2) * l2, mid[2] + Math.sin(az2) * Math.cos(el2) * l2];
        limb(g, mid, e2, P.tr * 0.16, P.tr * 0.06, bk, 4, [0, 0.2, 0], bc);
        cluster(g, R, e2[0], e2[1] + size * 0.1, e2[2], size * 0.85 * R.r(0.9, 1.1), P.tile, cr);
      }
      cluster(g, R, mid[0] * 0.9, mid[1] + size * 0.28, mid[2] * 0.9, size * 0.72, P.tile, cr);
    }
  }
  const nt = hi ? 4 : 2;
  for (let t = 0; t < nt; t++) cluster(g, R, top[0] + R.r(-1.5, 1.5), cy + P.ch * R.r(0.15, 0.42), top[2] + R.r(-1.5, 1.5), size * (hi ? 1.0 : 1.3) * R.r(0.95, 1.15), P.tile, cr);
  cluster(g, R, top[0], cy, top[2], size * (hi ? 1.1 : 1.45), P.tile, cr);
}
function birch(g, R, lod) {
  const hi = lod === 0, H = R.r(8, 10), tr = 0.15, ln = [R.r(-0.9, 0.9), R.r(-0.9, 0.9)], bc = [1, 1, 1];
  const trunk = (lx, lz, h, r0) => {
    let p = [0, -0.2, 0]; const n = hi ? Math.round(h / 1.3) : 3;
    for (let s = 1; s <= n; s++) { const t = s / n, q = [lx * t * t, -0.2 + (h + 0.2) * t, lz * t * t]; limb(g, p, q, r0 * (1 - t * 0.7) + 0.01 + r0 * 0.3 * (1 - (s - 1) / n), r0 * (1 - t * 0.78) + 0.01, T_BIRCHBARK, hi ? 5 : 4, [0, 0, 0], bc); p = q; }
    return p;
  };
  const top = trunk(ln[0], ln[1], H, tr);
  const cr = { x: top[0] * 0.6, y: H * 0.68, z: top[2] * 0.6, R: 3, y0: H * 0.36, H: H * 0.7 };
  const nb = hi ? R.i(9, 12) : 5;
  for (let b = 0; b < nb; b++) {
    const t = R.r(0.38, 0.92), py = H * t, az = R.r(0, 6.28), el = R.r(0.9, 1.35), len = R.r(1.3, 2.3) * (1.1 - t * 0.5);
    const lx = ln[0] * t * t, lz = ln[1] * t * t, e = [lx + Math.cos(az) * Math.cos(el) * len, py + Math.sin(el) * len, lz + Math.sin(az) * Math.cos(el) * len];
    limb(g, [lx, py, lz], e, 0.045, 0.02, T_BIRCHBARK, 4, [0, 0.1, 0], bc);
    cluster(g, R, e[0], e[1] + 0.2, e[2], R.r(2, 2.7) * (hi ? 1 : 1.3), T_BIRCH, cr);
  }
  cluster(g, R, top[0], H + 0.35, top[2], hi ? 2.3 : 3, T_BIRCH, cr);
  if (R() < 0.55) { // drugi pien (brzozy czesto rosna po kilka)
    const lx = -ln[0] * 0.8, lz = -ln[1] * 0.8, h2 = H * R.r(0.7, 0.88); let p = [0.15, -0.2, 0.1]; const n = hi ? Math.round(h2 / 1.3) : 2;
    for (let s = 1; s <= n; s++) { const t = s / n, q = [0.15 + lx * t * t, -0.2 + (h2 + 0.2) * t, 0.1 + lz * t * t]; limb(g, p, q, 0.1 * (1 - t * 0.6) + 0.015, 0.1 * (1 - t * 0.7) + 0.012, T_BIRCHBARK, 4, [0, 0, 0], bc); p = q; }
    cluster(g, R, p[0], h2 + 0.3, p[2], 2.4 * (hi ? 1 : 1.3), T_BIRCH, cr);
    if (hi) for (let b = 0; b < 4; b++) { const t = R.r(0.5, 0.9), az = R.r(0, 6.28); cluster(g, R, 0.15 + lx * t * t + Math.cos(az) * 1.1, h2 * t + 0.8, 0.1 + lz * t * t + Math.sin(az) * 1.1, 2, T_BIRCH, cr); }
  }
}
function willow(g, R, lod) {
  const hi = lod === 0, th = R.r(2.2, 3), bc = [0.7, 0.66, 0.62], sides = hi ? 7 : 5, lean = [R.r(-0.6, 0.6), R.r(-0.6, 0.6)];
  limb(g, [0, -0.3, 0], [0, 0.8, 0], 0.75, 0.55, T_BARK, sides, [0, 0, 0], bc);
  limb(g, [0, 0.8, 0], [lean[0], th, lean[1]], 0.55, 0.4, T_BARK, sides, [0.1, 0, 0.1], bc);
  const cr = { x: lean[0], y: th + 2, z: lean[1], R: 5.5, y0: 0.5, H: 9 };
  const nb = hi ? 5 : 4, ends = [];
  for (let b = 0; b < nb; b++) {
    const az = b / nb * 6.2832 + R.r(-0.35, 0.35), el = R.r(0.5, 0.95), len = R.r(2.8, 4);
    const st = [lean[0], th - 0.2, lean[1]], e = [st[0] + Math.cos(az) * Math.cos(el) * len, st[1] + Math.sin(el) * len + 0.4, st[2] + Math.sin(az) * Math.cos(el) * len];
    limb(g, st, e, 0.28, 0.1, T_BARK, hi ? 5 : 4, [0, 0.5, 0], bc); ends.push([e, az]);
    const mid = [(st[0] + e[0]) / 2, (st[1] + e[1]) / 2 + 0.3, (st[2] + e[2]) / 2];
    if (hi) ends.push([mid, az + 0.5]);
  }
  const hang = (p, w, L, az) => {
    const bot = Math.max(0.5, p[1] - L), cy = (p[1] + 0.4 + bot) / 2, hh = (p[1] + 0.4 - bot) / 2, uv = uvr(T_WILLOW);
    for (let q = 0; q < 2; q++) {
      const t = az + q * 1.5708 + R.r(-0.25, 0.25), a = [Math.cos(t) * w / 2, 0, Math.sin(t) * w / 2], k = g.verts, rv = R.r(0.92, 1.08);
      for (const [sa, sb, ui, vi] of [[-1, -1, 0, 1], [1, -1, 2, 1], [1, 1, 2, 3], [-1, 1, 0, 3]]) {
        const px = p[0] + a[0] * sa, py = cy + hh * sb, pz = p[2] + a[2] * sa, n = norm([(px - cr.x) / cr.R, 0.15, (pz - cr.z) / cr.R]);
        const sh = (0.55 + 0.55 * clamp01((py - 0.5) / 7)) * rv;
        g.vert(px, py, pz, n[0], n[1], n[2], uv[ui], uv[vi], sh, sh, sh, 1); // zawieszone: gora tekstury u gory
      }
      g.quad(k, k + 1, k + 2, k + 3);
    }
  };
  for (const [e, az] of ends) { hang(e, R.r(2.2, 3.0), R.r(4.2, 6), az); if (hi) hang([e[0] * 0.8 + cr.x * 0.2, e[1] - 0.3, e[2] * 0.8 + cr.z * 0.2], 2.6, R.r(3.5, 5), az + 0.9); }
  const nring = hi ? 9 : 4; for (let i = 0; i < nring; i++) { const a = i / nring * 6.2832 + R.r(-0.2, 0.2), r = R.r(1.8, 3.4); hang([lean[0] + Math.cos(a) * r, th + R.r(1.4, 2.6), lean[1] + Math.sin(a) * r], 2.6, R.r(4, 5.8), a); }
  for (let i = 0; i < (hi ? 4 : 2); i++) cluster(g, R, lean[0] + R.r(-1.6, 1.6), th + R.r(2.4, 3.6), lean[1] + R.r(-1.6, 1.6), 3.2, T_BUSH, cr);
}
function spruce(g, R, lod) {
  const hi = lod === 0, H = R.r(10, 13), bc = [1, 1, 1], tiers = hi ? 15 : 8, tile = T_SPRUCE;
  const lean = [R.r(-0.25, 0.25), R.r(-0.25, 0.25)];
  limb(g, [0, -0.2, 0], [lean[0], H * 0.5, lean[1]], 0.34, 0.18, T_SPRUCEBARK, hi ? 6 : 4, [0, 0, 0], bc);
  limb(g, [lean[0], H * 0.5, lean[1]], [lean[0] * 1.4, H, lean[1] * 1.4], 0.18, 0.025, T_SPRUCEBARK, hi ? 5 : 4, [0, 0, 0], bc);
  const uv = uvr(tile), y0 = 1.3, Rmax = R.r(2.9, 3.6);
  for (let t = 0; t < tiers; t++) {
    const f = t / (tiers - 1), y = y0 + f * (H - y0 - 0.8), rr = Rmax * Math.pow(1 - f, 0.85) + 0.35, n = Math.max(hi ? 6 : 5, Math.round((hi ? 8 : 6) * (rr / Rmax) + (hi ? 4 : 3))), off = R.r(0, 6.28);
    for (let s = 0; s < n; s++) {
      const az = off + s / n * 6.2832 + R.r(-0.2, 0.2), cs = Math.cos(az), sn = Math.sin(az), droop = 0.45 + R.r(0, 0.2);
      const len = rr * R.r(0.92, 1.1), w = Math.max(0.55, rr * 0.7);
      const tip = [cs * len, y - droop * len * 0.55, sn * len], base = [cs * 0.25, y, sn * 0.25];
      const side = [-sn * w / 2, 0, cs * w / 2], k = g.verts, rv = R.r(0.85, 1.12), sh = 0.5 + 0.55 * f + 0.15;
      const n0 = norm([cs * 0.6, 0.7, sn * 0.6]);
      g.vert(base[0] - side[0], base[1] - side[1] - 0.05, base[2] - side[2], n0[0], n0[1], n0[2], uv[0], uv[1], sh * rv * 0.8, sh * rv * 0.8, sh * rv * 0.8, 1);
      g.vert(base[0] + side[0], base[1] + side[1] - 0.05, base[2] + side[2], n0[0], n0[1], n0[2], uv[2], uv[1], sh * rv * 0.8, sh * rv * 0.8, sh * rv * 0.8, 1);
      g.vert(tip[0] + side[0] * 0.8, tip[1], tip[2] + side[2] * 0.8, n0[0], n0[1], n0[2], uv[2], uv[3], sh * rv, sh * rv, sh * rv, 1);
      g.vert(tip[0] - side[0] * 0.8, tip[1], tip[2] - side[2] * 0.8, n0[0], n0[1], n0[2], uv[0], uv[3], sh * rv, sh * rv, sh * rv, 1);
      g.quad(k, k + 1, k + 2, k + 3);
    }
  }
}
const SPEC = {
  oak: (g, R, l) => broadleaf(g, R, l, { th: [2.4, 3.4], tr: 0.46, nb: [5, 7], el: [0.4, 1.0], len: [3.4, 4.8], cs: 4.4, cr: 6.2, ch: 8, tile: T_OAK }, 'oak'),
  maple: (g, R, l) => broadleaf(g, R, l, { th: [2.4, 3.2], tr: 0.34, nb: [5, 6], el: [0.75, 1.25], len: [2.4, 3.6], cs: 3.4, cr: 4.8, ch: 7, tile: T_MAPLE }, 'maple'),
  birch, willow, spruce,
};
export const SPECIES = Object.keys(SPEC);
export const VARIANTS = { oak: 3, maple: 3, birch: 2, willow: 2, spruce: 2 };
const tplCache = {};
export function treeTpl(sp, variant, lod) {
  const key = sp + variant + '_' + lod; if (tplCache[key]) return tplCache[key];
  const g = new Geo(); SPEC[sp](g, rng(1000 + variant * 77 + SPECIES.indexOf(sp) * 913), lod); return tplCache[key] = g;
}
// krzew: kilka malych kep tuz nad ziemia
const bushCache = {};
export function bushTpl(v) {
  if (bushCache[v]) return bushCache[v];
  const g = new Geo(), R = rng(5000 + v * 31), n = R.i(4, 6), cr = { x: 0, y: 0.5, z: 0, R: 0.95, y0: 0, H: 1.2 };
  for (let i = 0; i < n; i++) { const a = R.r(0, 6.28), r = i ? R.r(0.25, 0.75) : 0; cluster(g, R, Math.cos(a) * r, R.r(0.35, 0.75), Math.sin(a) * r, R.r(1.0, 1.5), T_BUSH, cr); }
  return bushCache[v] = g;
}
// paleta odcieni lisci (sRGB hex) — tint wierzcholkow z maska
export const TINTS = {
  oak: [0x5d8c32, 0x4f7f2c, 0x6b9838, 0x477a2b, 0x789a30, 0x8a9a2c],
  maple: [0xc2481c, 0xd8741e, 0xe0a52a, 0x9c2c18, 0xcf5a1c, 0xe8b838, 0x6a8a2a],
  birch: [0x9ab83a, 0xaec43e, 0xb8b43a, 0x86a838, 0xc2c040],
  willow: [0x9bb44a, 0x8aa83f, 0xa9be55],
  spruce: [0x2c5c3a, 0x346845, 0x27503a, 0x3a6a40],
  bush: [0x3f7a2c, 0x4f8a34, 0x2f6a2a, 0x6a8a30, 0xa8482a, 0x5a8a3a],
};
