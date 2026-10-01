// Miasto: siatka ulic Manhattanu, wiezowce ze sklepami i gzymsami, billboardy, Central Park,
// rzeki, niebo (zachod / dzien / noc), samochody, przechodnie. Tu sa tez kolizje i promienie.
import { V3, clamp, srand, sr, cv, canvasTex, rnd, linHex, linearize, dbg } from './util.js';
import { scene, camera, renderer, P, G } from './stan.js';
import { pedGeometries, pedFaceTexture } from './model.js';

export const BW = 64, BD = 44, ST = 18, NX = 8, NZ = 18;
export const CX = BW + ST, CZ = BD + ST, CW = NX * CX, CD = NZ * CZ, X0 = -CW / 2, Z0 = -CD / 2;
export const LAND = { x0: X0 - 24, x1: X0 + CW + 24, z0: Z0 - 24, z1: Z0 + CD + 24 };
export const PK = { x0: X0 + 2 * CX + ST / 2, x1: X0 + 6 * CX - ST / 2, z0: Z0 + 2 * CZ + ST / 2, z1: Z0 + 8 * CZ - ST / 2 };
export const POND = { x: (PK.x0 + PK.x1) / 2 + 30, z: PK.z0 + (PK.z1 - PK.z0) * 0.62, rx: 60, rz: 38 };
export const isPark = (i, j) => i >= 2 && i <= 5 && j >= 2 && j <= 7;
export const inPark = (x, z) => x > PK.x0 && x < PK.x1 && z > PK.z0 && z < PK.z1;
export const isecPos = (i, j) => [X0 + i * CX, Z0 + j * CZ];

export const DIST = {
  harlem: { name: 'HARLEM', h: [12, 32], tall: 0, st: [0, 1, 2, 0] },
  uws: { name: 'UPPER WEST SIDE', h: [22, 50], tall: 0.08, st: [1, 5, 0, 2] },
  ues: { name: 'UPPER EAST SIDE', h: [22, 55], tall: 0.1, st: [5, 1, 2, 0] },
  park: { name: 'CENTRAL PARK' },
  hk: { name: "HELL'S KITCHEN", h: [18, 55], tall: 0.12, st: [0, 2, 1, 3] },
  mid: { name: 'MIDTOWN', h: [45, 115], tall: 0.35, st: [3, 4, 2, 5, 1] },
  gv: { name: 'GREENWICH VILLAGE', h: [12, 35], tall: 0.03, st: [0, 1, 5] },
  ct: { name: 'CHINATOWN', h: [14, 40], tall: 0.05, st: [0, 2, 1] },
  fin: { name: 'FINANCIAL DISTRICT', h: [45, 125], tall: 0.4, st: [4, 3, 2, 5] },
};
export function distKey(i, j) {
  if (j < 2) return 'harlem';
  if (j < 8) return i < 2 ? 'uws' : i > 5 ? 'ues' : 'park';
  if (j < 12) return i < 4 ? 'hk' : 'mid';
  if (j < 15) return i < 4 ? 'gv' : 'ct';
  return 'fin';
}
export function districtAt(x, z) {
  if (inPark(x, z)) return 'park';
  const i = clamp(Math.floor((x - X0) / CX), 0, NX - 1), j = clamp(Math.floor((z - Z0) / CZ), 0, NZ - 1);
  return distKey(i, j);
}
export function blk(i, j) { const x0 = X0 + i * CX + ST / 2, z0 = Z0 + j * CZ + ST / 2; return { x0, x1: x0 + BW, z0, z1: z0 + BD }; }

// ---------------------------------------------------------------- kolizje
export const doors = [];
export const boxes = [], roofs = [], footprints = [], spots = [], perches = [];
export const START = new V3();
export const START_H = -Math.PI / 2;
const HC = 48, hash = new Map(); let stamp = 0;
const hk = (ix, iz) => (ix + 500) * 2000 + (iz + 500);
export function addBox(b) {
  b.q = 0; boxes.push(b);
  for (let ix = Math.floor(b.x0 / HC); ix <= Math.floor(b.x1 / HC); ix++)
    for (let iz = Math.floor(b.z0 / HC); iz <= Math.floor(b.z1 / HC); iz++) {
      const k = hk(ix, iz); let l = hash.get(k); if (!l) { l = []; hash.set(k, l); } l.push(b);
    }
  return b;
}
export function boxesNear(x, z, r, out) {
  out.length = 0; stamp++;
  const a = Math.floor((x - r) / HC), b = Math.floor((x + r) / HC), c = Math.floor((z - r) / HC), d = Math.floor((z + r) / HC);
  for (let ix = a; ix <= b; ix++) for (let iz = c; iz <= d; iz++) {
    const l = hash.get(hk(ix, iz)); if (!l) continue;
    for (const bx of l) if (bx.q !== stamp) { bx.q = stamp; out.push(bx); }
  }
  return out;
}
const _s1 = [], _s2 = [], _rl = [];
// najwyzszy dach pod punktem (nie wyzej niz maxY); 0 = ulica
export function supportAt(x, z, maxY, r = 0.3) {
  let h = 0; boxesNear(x, z, r + 1, _s1);
  for (const b of _s1) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && b.y1 <= maxY && b.y1 > h) h = b.y1;
  return h;
}
export function solidAt(x, y, z) {
  boxesNear(x, z, 1, _s2);
  for (const b of _s2) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true;
  return false;
}
export const rayN = new V3(); const _rbN = new V3();
function rayBox(o, d, b, maxT) {
  let tmin = -Infinity, tmax = Infinity, ax = -1, sg = 0;
  const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], LO = [b.x0, b.y0, b.z0], HI = [b.x1, b.y1, b.z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(D[i]) < 1e-9) { if (O[i] < LO[i] || O[i] > HI[i]) return Infinity; continue; }
    let t1 = (LO[i] - O[i]) / D[i], t2 = (HI[i] - O[i]) / D[i], s = -1;
    if (t1 > t2) { const q = t1; t1 = t2; t2 = q; s = 1; }
    if (t1 > tmin) { tmin = t1; ax = i; sg = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return Infinity;
  }
  if (tmin < 0 || tmin > maxT) return Infinity;
  _rbN.set(0, 0, 0); if (ax === 0) _rbN.x = sg; else if (ax === 1) _rbN.y = sg; else _rbN.z = sg;
  return tmin;
}
// promien przez miasto: zwraca odleglosc do trafienia (albo maxT), normalna w rayN
export function raycastCity(o, d, maxT) {
  let best = maxT;
  const mx = o.x + d.x * maxT * 0.5, mz = o.z + d.z * maxT * 0.5;
  boxesNear(mx, mz, maxT * 0.5 * Math.hypot(d.x, d.z) + 2, _rl);
  for (const b of _rl) { const t = rayBox(o, d, b, best); if (t < best) { best = t; rayN.copy(_rbN); } }
  if (d.y < -1e-4) { const t = -o.y / d.y; if (t > 0 && t < best) { best = t; rayN.set(0, 1, 0); } }
  return best;
}

// ---------------------------------------------------------------- geometria scalana
// Geometria miasta jest dzielona na kawalki 160 x 160 m: karta graficzna rysuje tylko te,
// ktore widac (i tylko te blisko gracza do cieni), zamiast calego miasta naraz.
const CHUNK = +(new URLSearchParams(location.search).get('chunk')) || 330;
// parametry biezacego budynku: odcien, rozmiar kafla okien i jego przesuniecie (kazdy budynek wyglada inaczej)
const cur = { tint: [1, 1, 1], us: 16, vs: 14, uo: 0, vo: 0 };
function randomBuildingLook() {
  const L = 0.8 + srand() * 0.32;
  cur.tint = [L * (1 + (srand() - 0.5) * 0.14), L * (1 + (srand() - 0.5) * 0.1), L * (1 + (srand() - 0.5) * 0.14)];
  cur.us = 13 + srand() * 5; cur.vs = 12 + srand() * 4; cur.uo = Math.floor(srand() * 4) / 4; cur.vo = Math.floor(srand() * 4) / 4;
}
function newGeo() { return { chunks: new Map() }; }
function quad(g, a, b, c, d, n, ua, ub, uc, ud) {
  const key = Math.floor(a[0] / CHUNK) * 1000 + Math.floor(a[2] / CHUNK);
  let s = g.chunks.get(key); if (!s) { s = { p: [], n: [], u: [], c: [] }; g.chunks.set(key, s); }
  for (const [Q, U] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
    s.p.push(Q[0], Q[1], Q[2]); s.n.push(n[0], n[1], n[2]); s.u.push(U[0], U[1]); s.c.push(cur.tint[0], cur.tint[1], cur.tint[2]);
  }
}
// sciany (n: z0, s: z1, w: x0, e: x1); UV liczone z bezwzglednych wspolrzednych. Elewacje (16 x 14) biora rozmiar i przesuniecie wzoru z cur.
function wallsFaces(g, x0, x1, y0, y1, z0, z1, us, vs, faces) {
  let uo = 0, vo = 0; if (us === 16 && vs === 14) { us = cur.us; vs = cur.vs; uo = cur.uo; vo = cur.vo; }
  const v0 = y0 / vs + vo, v1 = y1 / vs + vo, X0 = x0 / us + uo, X1 = x1 / us + uo, Z0 = z0 / us + uo, Z1 = z1 / us + uo;
  if (faces.includes('s')) quad(g, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [X0, v0], [X1, v0], [X1, v1], [X0, v1]);
  if (faces.includes('n')) quad(g, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-X1, v0], [-X0, v0], [-X0, v1], [-X1, v1]);
  if (faces.includes('e')) quad(g, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-Z1, v0], [-Z0, v0], [-Z0, v1], [-Z1, v1]);
  if (faces.includes('w')) quad(g, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [Z0, v0], [Z1, v0], [Z1, v1], [Z0, v1]);
}
function walls(g, x0, x1, y0, y1, z0, z1, us, vs) { wallsFaces(g, x0, x1, y0, y1, z0, z1, us, vs, ['n', 's', 'w', 'e']); }
function top(g, x0, x1, y, z0, z1, us) {
  quad(g, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / us, z1 / us], [x1 / us, z1 / us], [x1 / us, z0 / us], [x0 / us, z0 / us]);
}
function bottom(g, x0, x1, y, z0, z1) {
  quad(g, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
}
function fullBox(g, x0, x1, y0, y1, z0, z1, us = 4, under = false) {
  walls(g, x0, x1, y0, y1, z0, z1, us, us); top(g, x0, x1, y1, z0, z1, us); if (under) bottom(g, x0, x1, y0, z0, z1);
}
function meshFrom(g, mat, cast = true) {
  for (const s of g.chunks.values()) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(s.p, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.n, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(s.u, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(s.c, 3));
    mat.vertexColors = true;
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = true; m.matrixAutoUpdate = false;
    scene.add(m);
  }
}

// ---------------------------------------------------------------- tekstury (wszystkie rysowane, bez plikow)
const STY = [
  { wall: '#7d3f2e', gTop: '#e8b68e', gBot: '#2d3440', inset: [26, 20, 26, 30], lit: 0.12, rough: 0.9, frame: '#d9d0c0', brick: true, fire: true },
  { wall: '#b8a283', gTop: '#f3c49a', gBot: '#3a4250', inset: [24, 20, 24, 30], lit: 0.1, rough: 0.85, frame: '#8a7a62' },
  { wall: '#8b8e93', gTop: '#e9b58f', gBot: '#34404d', inset: [20, 16, 20, 24], lit: 0.1, rough: 0.8, frame: '#5a5d62' },
  { wall: '#4d6275', gTop: '#f5c9a0', gBot: '#27415a', inset: [4, 6, 4, 18], lit: 0.05, rough: 0.35, metal: 0.3, band: '#34495a' },
  { wall: '#2a3340', gTop: '#d7a887', gBot: '#1b2430', inset: [4, 6, 4, 14], lit: 0.06, rough: 0.3, metal: 0.4, band: '#1c232d' },
  { wall: '#c9c3b5', gTop: '#f2c6a0', gBot: '#3b4552', inset: [30, 24, 30, 28], lit: 0.1, rough: 0.9, frame: '#9d968a' },
];
const CURT = ['rgba(200,60,50,.55)', 'rgba(230,210,160,.55)', 'rgba(60,90,150,.5)', 'rgba(240,240,230,.5)', 'rgba(120,160,90,.5)'];
function facadeTex(s) {
  const S = 512, C = 128, c = cv(2 * S, 2 * S), x = c.getContext('2d'), e = cv(2 * S, 2 * S), ex = e.getContext('2d');
  // szorstkosc (jasne = matowe, ciemne = gladkie jak szklo) i wypuklosc (okna wglebione w sciane)
  const rc = cv(2 * S, 2 * S), rx = rc.getContext('2d'), bc = cv(2 * S, 2 * S), bx = bc.getContext('2d'), mc = cv(2 * S, 2 * S), mx = mc.getContext('2d');
  for (const q of [x, ex, rx, bx, mx]) q.scale(2, 2);
  mx.fillStyle = s.metal ? '#707070' : '#000'; mx.fillRect(0, 0, S, S); // szyby odbijaja niebo mocniej niz sciana
  const wr = Math.round(s.rough * 255);
  rx.fillStyle = `rgb(${wr},${wr},${wr})`; rx.fillRect(0, 0, S, S);
  bx.fillStyle = '#9a9a9a'; bx.fillRect(0, 0, S, S);
  x.fillStyle = s.wall; x.fillRect(0, 0, S, S);
  ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
  for (let i = 0; i < 5000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); }
  if (s.brick) {
    for (let y = 0; y < S; y += 6) for (let xx = (y / 6 % 2) * 7 - 7; xx < S; xx += 14) { // pojedyncze cegly w lekko roznych odcieniach
      const k = Math.random() * 0.14 - 0.07; x.fillStyle = k > 0 ? `rgba(255,220,200,${k})` : `rgba(0,0,0,${-k})`; x.fillRect(xx, y, 13, 5);
    }
    x.fillStyle = 'rgba(0,0,0,.14)'; for (let y = 0; y < S; y += 6) x.fillRect(0, y, S, 1); for (let y = 0; y < S; y += 6) for (let xx = (y / 6 % 2) * 7; xx < S; xx += 14) x.fillRect(xx, y, 1, 6);
    bx.fillStyle = '#7a7a7a'; for (let y = 0; y < S; y += 6) bx.fillRect(0, y, S, 1); for (let y = 0; y < S; y += 6) for (let xx = (y / 6 % 2) * 7; xx < S; xx += 14) bx.fillRect(xx, y, 1, 6);
  }
  for (let i = 0; i < 26; i++) { const px = Math.random() * S, py = Math.random() * S, rr = 30 + Math.random() * 70, gg = x.createRadialGradient(px, py, 0, px, py, rr); gg.addColorStop(0, `rgba(30,25,20,${0.05 + Math.random() * 0.05})`); gg.addColorStop(1, 'rgba(30,25,20,0)'); x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  const [l, t, r, b] = s.inset;
  for (let j = 0; j < 4; j++) {
    if (s.band) { x.fillStyle = s.band; x.fillRect(0, j * C + C - b, S, b); }
    else { x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, j * C + C - 8, S, 4); }
    for (let i = 0; i < 4; i++) {
      const X = i * C + l, Y = j * C + t, W = C - l - r, H = C - t - b;
      // szyba: ciemne wnetrze; niebo odbija sie w niej naprawde (mapa otoczenia), wiec tylko lekki gradient
      const g = x.createLinearGradient(0, Y, 0, Y + H); g.addColorStop(0, s.gTop); g.addColorStop(1, s.gBot);
      x.fillStyle = g; x.fillRect(X, Y, W, H);
      x.fillStyle = 'rgba(18,22,30,.55)'; x.fillRect(X, Y, W, H);
      rx.fillStyle = s.metal ? '#0a0a0a' : '#1c1c1c'; rx.fillRect(X, Y, W, H);
      mx.fillStyle = s.metal ? '#d8d8d8' : '#a8a8a8'; mx.fillRect(X, Y, W, H);
      // wnetrze: rolety, zaslony albo ciemny pokoj; odbicie nieba jako jasna skosna smuga
      { const kind = Math.random();
        if (kind < 0.28) { x.fillStyle = 'rgba(205,195,170,.55)'; const hh = H * (0.25 + Math.random() * 0.6); x.fillRect(X, Y, W, hh); x.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = Y; yy < Y + hh; yy += 5) x.fillRect(X, yy, W, 1); } // roleta
        else if (kind < 0.5) { x.fillStyle = CURT[Math.floor(Math.random() * CURT.length)]; x.fillRect(X, Y, W * 0.34, H); x.fillRect(X + W * 0.66, Y, W * 0.34, H); }                                            // zaslony
        x.fillStyle = 'rgba(255,255,255,.09)'; x.beginPath(); x.moveTo(X + W * 0.1, Y + H); x.lineTo(X + W * 0.55, Y); x.lineTo(X + W * 0.75, Y); x.lineTo(X + W * 0.3, Y + H); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(X, Y, W, 4); x.fillRect(X, Y, 3, H);              // cien gornej i lewej krawedzi wneki
      x.fillStyle = 'rgba(255,255,255,.14)'; x.fillRect(X, Y + H - 2, W, 2);                       // jasny dolny brzeg (parapet)
      if (s.frame) { x.fillStyle = 'rgba(255,255,255,.1)'; x.fillRect(X - 5, Y - 8, W + 10, 6); x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(X - 5, Y - 2, W + 10, 2); } // nadproze
      { const sg = x.createLinearGradient(0, Y + H, 0, Y + H + 40); sg.addColorStop(0, 'rgba(20,16,12,.32)'); sg.addColorStop(1, 'rgba(20,16,12,0)'); x.fillStyle = sg; x.fillRect(X + 3, Y + H, W - 6, 40); } // smuga brudu pod oknem
      bx.fillStyle = '#5a5a5a'; bx.fillRect(X, Y, W, H);
      const q = Math.random();
      if (q < s.lit) { x.fillStyle = 'rgba(255,205,130,.7)'; x.fillRect(X, Y, W, H); }
      else if (q < s.lit + 0.3) { x.fillStyle = CURT[Math.floor(Math.random() * CURT.length)]; x.fillRect(X, Y, W * 0.3, H); x.fillRect(X + W * 0.7, Y, W * 0.3, H); }
      else if (q < s.lit + 0.5) { x.fillStyle = 'rgba(225,215,195,.4)'; x.fillRect(X, Y, W, H * (0.2 + Math.random() * 0.5)); }
      // swiecace okna w nocy
      if (Math.random() < 0.42) {
        const warm = Math.random() < 0.8;
        ex.fillStyle = warm ? `rgb(255,${190 + Math.random() * 40 | 0},${110 + Math.random() * 50 | 0})` : 'rgb(170,200,255)';
        ex.fillRect(X, Y, W, H);
        if (Math.random() < 0.5) { ex.fillStyle = 'rgba(0,0,0,.6)'; ex.fillRect(X, Y, W * 0.3, H); }
      }
      if (s.frame) {
        rx.strokeStyle = '#8c8c8c'; rx.lineWidth = 4; rx.strokeRect(X, Y, W, H);
        bx.fillStyle = '#c8c8c8'; bx.fillRect(X - 5, Y + H, W + 10, 6); bx.strokeStyle = '#b0b0b0'; bx.lineWidth = 4; bx.strokeRect(X, Y, W, H);
        x.strokeStyle = s.frame; x.lineWidth = 4; x.strokeRect(X, Y, W, H);
        x.lineWidth = 3; x.beginPath(); x.moveTo(X + W / 2, Y); x.lineTo(X + W / 2, Y + H); x.moveTo(X, Y + H * 0.45); x.lineTo(X + W, Y + H * 0.45); x.stroke();
        x.fillStyle = s.frame; x.fillRect(X - 5, Y + H, W + 10, 6);
        x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(X - 5, Y + H + 6, W + 10, 4);
        if (Math.random() < 0.12) { x.fillStyle = '#9ea3a8'; x.fillRect(X + W * 0.3, Y + H - 22, W * 0.4, 20); x.fillStyle = '#6d7277'; x.fillRect(X + W * 0.3, Y + H - 8, W * 0.4, 3); }
      } else { x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(X + W - 2, Y, 4, H); }
    }
    if (s.band) { x.fillStyle = 'rgba(0,0,0,.35)'; for (let k = 0; k <= 4; k++) { x.fillRect(k * C - 1, j * C, 3, C); mx.fillStyle = '#303030'; mx.fillRect(k * C - 1, j * C, 3, C); } }
    if (false) { // (schody przeciwpozarowe sa teraz prawdziwa geometria)
      x.strokeStyle = '#161616'; x.lineWidth = 3;
      const fx = 128 + 10, fw = 236, fy = j * C + C - 16;
      x.fillStyle = 'rgba(20,20,20,.9)'; x.fillRect(fx, fy, fw, 5);
      for (let k = fx; k <= fx + fw; k += 12) { x.beginPath(); x.moveTo(k, fy); x.lineTo(k, fy - 26); x.stroke(); }
      x.beginPath(); x.moveTo(fx, fy - 26); x.lineTo(fx + fw, fy - 26); x.stroke();
      x.beginPath(); x.moveTo(fx + 30, fy); x.lineTo(fx + 110, fy - C + 16); x.stroke();
    }
  }
  const map = canvasTex(c, true), emi = canvasTex(e, true), rough = canvasTex(rc, true), bump = canvasTex(bc, true), metal = canvasTex(mc, true);
  return { map, emi, rough, bump, metal };
}
// ciemniej przy ziemi miedzy budynkami (jak w prawdziwych ulicach, gdzie malo swiatla dochodzi na dol)
function groundAO(m, k = 0.5, h = 18) {
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n  diffuseColor.rgb *= mix(${k.toFixed(2)}, 1.0, smoothstep(0.0, ${h.toFixed(1)}, vWY));`);
  };
  return m;
}
// normalne fal na wodzie (z sumy fal), przesuwane w czasie
function waterNormals() {
  const N = 256, hgt = new Float32Array(N * N), c = cv(N, N), x = c.getContext('2d'), img = x.createImageData(N, N);
  const waves = Array.from({ length: 14 }, () => ({ kx: Math.round(rnd(-8, 8)), ky: Math.round(rnd(-8, 8)), a: rnd(0.3, 1), p: rnd(0, 6.28) }));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v = 0; for (const w of waves) v += w.a * Math.sin((w.kx * i + w.ky * j) / N * 6.2832 + w.p); hgt[j * N + i] = v; }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const dx = hgt[j * N + (i + 1) % N] - hgt[j * N + (i + N - 1) % N], dy = hgt[((j + 1) % N) * N + i] - hgt[((j + N - 1) % N) * N + i];
    const nx = -dx * 0.6, ny = -dy * 0.6, l = Math.hypot(nx, ny, 1), k = (j * N + i) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255; img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255; img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// sklepy na parterze: 4 rzedy po 4 witryny, szerokosc tekstury = 16 m
const SHOPS = ['PIZZA', 'DELI', 'KAWA', 'BANK', 'APTEKA', 'HOT DOG', 'KWIATY', 'BAR', 'SUSHI', 'SKLEP 24h', 'PIEKARNIA', 'KINO', 'KSIĘGARNIA', 'BURGER', 'LODY', 'FRYZJER'];
const SIGNC = ['#b8141c', '#1a5e2c', '#15306e', '#d49a16', '#6a1b7a', '#0d6b73', '#222222', '#b0480f'];
function shopTex() {
  const W = 1024, H = 512, c = cv(W, H), x = c.getContext('2d'), e = cv(W, H), ex = e.getContext('2d');
  ex.fillStyle = '#000'; ex.fillRect(0, 0, W, H);
  for (let row = 0; row < 4; row++) for (let u = 0; u < 4; u++) {
    const X = u * 256, Y = row * 128, col = SIGNC[Math.floor(Math.random() * SIGNC.length)], name = SHOPS[Math.floor(Math.random() * SHOPS.length)];
    x.fillStyle = '#2b2622'; x.fillRect(X, Y, 256, 128);
    x.fillStyle = col; x.fillRect(X + 4, Y + 4, 248, 28);
    x.fillStyle = '#fff'; x.font = 'bold 22px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(name, X + 128, Y + 19);
    ex.fillStyle = col; ex.fillRect(X + 4, Y + 4, 248, 28);
    ex.fillStyle = '#fff'; ex.font = 'bold 22px Arial'; ex.textAlign = 'center'; ex.textBaseline = 'middle'; ex.fillText(name, X + 128, Y + 19);
    const g = x.createLinearGradient(0, Y + 36, 0, Y + 128); g.addColorStop(0, '#b8966c'); g.addColorStop(1, '#3b2c20');
    x.fillStyle = g; x.fillRect(X + 10, Y + 38, 160, 86);
    x.fillStyle = 'rgba(40,30,25,.5)'; for (let k = 0; k < 5; k++) x.fillRect(X + 18 + k * 30, Y + 80 + Math.random() * 20, 20, 44);
    x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(X + 10, Y + 38, 160, 86);
    x.fillStyle = '#1d1a18'; x.fillRect(X + 184, Y + 40, 60, 88);
    x.fillStyle = '#e7c48c'; x.fillRect(X + 192, Y + 48, 44, 40);
    ex.fillStyle = 'rgb(255,200,130)'; ex.fillRect(X + 10, Y + 38, 160, 86); ex.fillRect(X + 192, Y + 48, 44, 40);
  }
  const map = canvasTex(c, true), emi = canvasTex(e, true);
  map.wrapT = emi.wrapT = THREE.ClampToEdgeWrapping;
  return { map, emi };
}
function noiseCanvas(base, n, a, size = 256, spots) {
  const c = cv(size, size), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`; x.fillRect(Math.random() * size, Math.random() * size, 2, 2); }
  if (spots) for (let i = 0; i < spots.n; i++) { x.fillStyle = spots.c[Math.floor(Math.random() * spots.c.length)]; x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * spots.r, 0, 7); x.fill(); }
  return c;
}
function grassCanvas(size = 256) {
  const c = cv(size, size), x = c.getContext('2d');
  x.fillStyle = '#557f36'; x.fillRect(0, 0, size, size);
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '30,50,15' : '140,160,70'},${0.05 + Math.random() * 0.07})`; x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 10 + Math.random() * 30, 0, 7); x.fill(); }
  x.lineWidth = 1;
  for (let i = 0; i < 9000; i++) {
    const px = Math.random() * size, py = Math.random() * size, l = 2 + Math.random() * 4, k = 0.6 + Math.random() * 0.7;
    x.strokeStyle = `rgba(${70 * k | 0},${115 * k | 0},${40 * k | 0},0.55)`;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 2, py - l); x.stroke();
  }
  for (let i = 0; i < 14; i++) { x.fillStyle = Math.random() < 0.6 ? '#f2efe2' : '#e6d36a'; x.beginPath(); x.arc(Math.random() * size, Math.random() * size, 0.9, 0, 7); x.fill(); } // pojedyncze kwiatki
  return c;
}
function sidewalkCanvas() {
  const c = cv(256, 256), x = c.getContext('2d');
  x.fillStyle = '#9a958c'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { const k = Math.random() * 0.08; x.fillStyle = `rgba(0,0,0,${k})`; x.fillRect(i * 128, j * 128, 128, 128); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 0, 256, 2); x.fillRect(0, 128, 256, 2); x.fillRect(0, 0, 2, 256); x.fillRect(128, 0, 2, 256);
  for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(40,40,40,.25)'; x.beginPath(); x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 0, 7); x.fill(); } // gumy do zucia :)
  return c;
}
function groundTex() {
  const S = 6, W = CX * S, H = CZ * S, c = cv(W, H), x = c.getContext('2d'), s0 = ST / 2 * S;
  x.fillStyle = '#56575c'; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) { const g = 48 + Math.random() * 28 | 0; x.fillStyle = `rgba(${g},${g},${g + 4},.4)`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  x.fillStyle = '#8e8981'; x.fillRect(s0, s0, BW * S, BD * S);
  x.strokeStyle = 'rgba(0,0,0,.13)'; x.lineWidth = 1;
  for (let a = s0; a <= s0 + BW * S; a += 2 * S) { x.beginPath(); x.moveTo(a, s0); x.lineTo(a, s0 + BD * S); x.stroke(); }
  for (let a = s0; a <= s0 + BD * S; a += 2 * S) { x.beginPath(); x.moveTo(s0, a); x.lineTo(s0 + BW * S, a); x.stroke(); }
  x.fillStyle = '#6f6b64'; x.fillRect(s0 + 3 * S, s0 + 3 * S, (BW - 6) * S, (BD - 6) * S);
  x.strokeStyle = '#c2bcb2'; x.lineWidth = 3; x.strokeRect(s0 + 1, s0 + 1, BW * S - 2, BD * S - 2);
  x.fillStyle = '#d8b23a'; x.fillRect(0, 0, 2, H); x.fillRect(W - 2, 0, 2, H);
  x.fillStyle = 'rgba(235,235,235,.8)';
  for (let a = 0; a < W; a += 5 * S) { x.fillRect(a, 0, 2.5 * S, 1.5); x.fillRect(a, H - 1.5, 2.5 * S, 1.5); }
  x.fillStyle = 'rgba(240,240,240,.85)';
  const cw = 3.5 * S, sw = 0.6 * S;
  for (let a = 0; a < s0 - sw; a += 1.2 * S) {
    x.fillRect(a, s0 + 2, sw, cw); x.fillRect(W - a - sw, s0 + 2, sw, cw);
    x.fillRect(a, H - s0 - cw - 2, sw, cw); x.fillRect(W - a - sw, H - s0 - cw - 2, sw, cw);
    x.fillRect(s0 + 2, a, cw, sw); x.fillRect(s0 + 2, H - a - sw, cw, sw);
    x.fillRect(W - s0 - cw - 2, a, cw, sw); x.fillRect(W - s0 - cw - 2, H - a - sw, cw, sw);
  }
  // szorstkosc: asfalt matowy, kaluze i slady opon blyszcza (odbijaja niebo)
  const rc = cv(W, H), rx = rc.getContext('2d'); rx.fillStyle = '#f4f4f4'; rx.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) { const k = 225 + Math.random() * 30 | 0; rx.fillStyle = `rgb(${k},${k},${k})`; rx.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
  const road = (fx) => { for (let n = 0; n < fx; n++) { // kaluze tylko na jezdni (pasy przy krawedziach komorki)
    const alongX = Math.random() < 0.5, px = alongX ? Math.random() * W : Math.random() * s0 * 0.9, py = alongX ? Math.random() * s0 * 0.9 : Math.random() * H;
    const r = 6 + Math.random() * 26; rx.fillStyle = 'rgb(70,70,70)'; rx.beginPath(); rx.ellipse(px, py, r * (1 + Math.random()), r, Math.random() * 3, 0, 7); rx.fill(); x.fillStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.ellipse(px, py, r, r * 0.8, 0, 0, 7); x.fill(); } };
  road(26);
  for (const lx of [s0 * 0.28, s0 * 0.72]) { rx.fillStyle = 'rgb(205,205,205)'; rx.fillRect(0, lx - 5, W, 10); rx.fillRect(lx - 5, 0, 10, H); x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0, lx - 5, W, 10); x.fillRect(lx - 5, 0, 10, H); }
  const t = canvasTex(c, true), r2 = canvasTex(rc, true); return { map: t, rough: r2 };
}
function neonTex(text, col) {
  const c = cv(512, 216), x = c.getContext('2d');
  x.fillStyle = '#0d0f14'; x.fillRect(0, 0, 512, 216);
  x.strokeStyle = col; x.lineWidth = 6; x.shadowColor = col; x.shadowBlur = 18; x.strokeRect(14, 14, 484, 188);
  x.fillStyle = '#fff'; x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 108);
  x.fillStyle = col; x.shadowBlur = 30; x.fillText(text, 256, 108);
  return canvasTex(c);
}
export function glowTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const c = cv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '.35)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return canvasTex(c);
}

// ---------------------------------------------------------------- niebo, swiatlo i pory dnia
export const sunDir = new V3(-0.82, 0.26, 0.3).normalize();
export let sun = null;
let sky = null, clouds = null, stars = null, moon = null, hemi = null, amb = null, water = null, pondM = null, waterNormal = null;
// kolory nieba jak na ekranie (sRGB); natezenia dobrane pod filmowa tonacje (ACES)
const TOD = {
  sunset: {
    top: [0.3, 0.38, 0.66], mid: [0.9, 0.6, 0.62], hor: [1, 0.74, 0.5], glow: [1, 0.66, 0.32], disk: 6,
    sun: [-0.82, 0.26, 0.3], sunCol: 0xffc08a, sunI: 2.6, hemi: [0xffd9b8, 0x3d3440, 0.35], amb: 0.03, env: 0.9,
    fogN: 160, fogF: 1600, win: 0.35, shop: 0.45, lamps: 0.6, cloud: 0.85, cloudCol: 0xffffff, water: 0x6d7f96, stars: 0, exp: 1.05,
  },
  day: {
    top: [0.18, 0.4, 0.85], mid: [0.46, 0.66, 0.93], hor: [0.8, 0.87, 0.95], glow: [1, 0.95, 0.8], disk: 5,
    sun: [-0.45, 0.8, 0.35], sunCol: 0xfff2dc, sunI: 3.0, hemi: [0xdcebff, 0x4a4740, 0.4], amb: 0.03, env: 1,
    fogN: 240, fogF: 2000, win: 0, shop: 0.12, lamps: 0, cloud: 0.55, cloudCol: 0xffffff, water: 0x5b7fa0, stars: 0, exp: 0.95,
  },
  night: {
    top: [0.01, 0.015, 0.05], mid: [0.03, 0.05, 0.12], hor: [0.12, 0.13, 0.22], glow: [0.5, 0.6, 0.85], disk: 3,
    sun: [0.45, 0.55, -0.4], sunCol: 0x9fb6e8, sunI: 0.9, hemi: [0x5a6f96, 0x141420, 0.7], amb: 0.04, env: 1.2,
    fogN: 90, fogF: 1150, win: 0.6, shop: 0.85, lamps: 1, cloud: 0.2, cloudCol: 0x7080a0, water: 0x1f2c40, stars: 1, exp: 1.25,
  },
};
export const TOD_NAMES = { sunset: 'ZACHÓD SŁOŃCA', day: 'DZIEŃ', night: 'NOC' };
let skyU = null;
const lin3 = (v, a) => v.set(...a.map(x => Math.pow(x, 2.2))); // sRGB -> liniowo
function buildSky() {
  scene.fog = new THREE.Fog(0xeab38c, 140, 1500);
  scene.background = new THREE.Color(0x000000);
  hemi = new THREE.HemisphereLight(0xffd9b8, 0x4d4458, 0.35); scene.add(hemi);
  amb = new THREE.AmbientLight(0x8080a0, 0.03); scene.add(amb);
  sun = new THREE.DirectionalLight(0xffc28a, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 150; sc.far = 750;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun); scene.add(sun.target);

  skyU = {
    sunDir: { value: sunDir }, top: { value: new V3() }, mid: { value: new V3() }, hor: { value: new V3() },
    glowC: { value: new V3() }, disk: { value: 2.5 },
  };
  // niebo liczone liniowo i puszczone przez ta sama tonacje co miasto — mgla na horyzoncie pasuje do nieba
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 sunDir, top, mid, hor, glowC; uniform float disk; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = mix(hor, mid, smoothstep(0.,.18,h)); c = mix(c, top, smoothstep(.14,.7,h));
        if(h<0.) c = mix(hor, hor*.7, smoothstep(0.,-.3,h));
        float s = max(dot(vP, sunDir), 0.);
        c += glowC*pow(s,5.)*.7 + glowC*pow(s,60.)*1.5 + vec3(1.,.95,.85)*pow(s,900.)*disk;
        gl_FragColor = vec4(c,1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), mat);
  sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);

  const c = cv(1024, 1024), x = c.getContext('2d');
  for (let i = 0; i < 90; i++) {
    const px = Math.random() * 1024, py = Math.random() * 1024, rw = 60 + Math.random() * 220, rh = 10 + Math.random() * 30;
    const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
    const col = Math.random() < 0.5 ? '255,200,200' : '255,225,195';
    g.addColorStop(0, `rgba(${col},.55)`); g.addColorStop(1, `rgba(${col},0)`);
    x.save(); x.translate(px, py); x.scale(rw, rh); x.fillStyle = g; x.beginPath(); x.arc(0, 0, 1, 0, 7); x.fill(); x.restore();
  }
  clouds = new THREE.Mesh(new THREE.PlaneGeometry(7000, 7000),
    new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide }));
  clouds.rotation.x = Math.PI / 2; clouds.frustumCulled = false; clouds.renderOrder = -1; scene.add(clouds);

  const sp = [];
  for (let i = 0; i < 1800; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
    sp.push(Math.cos(a) * r * 2800, y * 2800, Math.sin(a) * r * 2800);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  stars.frustumCulled = false; stars.renderOrder = -1; scene.add(stars);
  moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(235,240,255,1)', 'rgba(150,170,255,0)'), fog: false, depthWrite: false, transparent: true }));
  moon.scale.set(240, 240, 1); moon.renderOrder = -1; scene.add(moon);
}
// odbicia nieba w szybach, autach i wodzie: mapa otoczenia liczona z samego nieba
let pmrem = null, envRT = null, skyScene = null;
function updateEnvMap(T) {
  try {
    if (!pmrem) { pmrem = new THREE.PMREMGenerator(renderer); skyScene = new THREE.Scene(); skyScene.add(new THREE.Mesh(sky.geometry, sky.material)); }
    sky.material.toneMapped = false; sky.material.needsUpdate = true;
    const old = envRT; envRT = pmrem.fromScene(skyScene, 0.03, 1, 4000);
    sky.material.toneMapped = true; sky.material.needsUpdate = true;
    scene.environment = dbg('noenv') ? null : envRT.texture; if (old) old.dispose();
  } catch (e) { scene.environment = null; }
  scene.traverse(o => { const m = o.material; if (m && m.isMeshStandardMaterial) m.envMapIntensity = (m.userData.env ?? 1) * T.env; });
}
let facMats = [], shopMat = null, lampMat = null, boardMats = [], glowPts = [];
export let todName = 'sunset';
export function setTOD(name) {
  const T = TOD[name] || TOD.sunset; todName = TOD[name] ? name : 'sunset';
  sunDir.set(...T.sun).normalize();
  lin3(skyU.top.value, T.top); lin3(skyU.mid.value, T.mid); lin3(skyU.hor.value, T.hor); lin3(skyU.glowC.value, T.glow); skyU.disk.value = T.disk;
  const h = skyU.hor.value; scene.fog.color.setRGB(h.x, h.y, h.z).multiplyScalar(0.92); scene.fog.near = T.fogN; scene.fog.far = T.fogF;
  linHex(sun.color, T.sunCol); sun.intensity = T.sunI;
  linHex(hemi.color, T.hemi[0]); linHex(hemi.groundColor, T.hemi[1]); hemi.intensity = T.hemi[2]; amb.intensity = T.amb;
  clouds.material.opacity = T.cloud; linHex(clouds.material.color, T.cloudCol);
  linHex(water.material.color, T.water); linHex(pondM.material.color, T.water).multiplyScalar(0.45); pondM.material.color.g *= 1.15;
  stars.visible = T.stars > 0; moon.visible = name === 'night';
  for (const m of facMats) m.emissiveIntensity = T.win;
  shopMat.emissiveIntensity = T.shop;
  lampMat.emissiveIntensity = 0.2 + T.lamps * 2;
  for (const m of boardMats) m.emissiveIntensity = 0.8 + T.lamps * 1.2;
  for (const g of glowPts) { g.visible = T.lamps > 0; g.material.opacity = T.lamps; }
  renderer.toneMappingExposure = T.exp;
  updateEnvMap(T);
}
// swiatlo we wnetrzach: slonce wylaczone, cieple swiatlo otoczenia (bez przeliczania mapy nieba)
let savedL = null;
export function setInteriorLight(on) {
  if (on) {
    if (!savedL) savedL = { sun: sun.intensity, hemi: hemi.intensity, amb: amb.intensity, exp: renderer.toneMappingExposure, hc: hemi.color.clone() };
    sun.intensity = 0; hemi.intensity = 1.1; linHex(hemi.color, 0xffeedd); amb.intensity = 0.35; renderer.toneMappingExposure = 1.0;
  } else if (savedL) {
    sun.intensity = savedL.sun; hemi.intensity = savedL.hemi; hemi.color.copy(savedL.hc); amb.intensity = savedL.amb; renderer.toneMappingExposure = savedL.exp; savedL = null;
  }
}
export function updateEnv() {
  sky.position.copy(camera.position);
  clouds.position.set(camera.position.x, 700, camera.position.z);
  stars.position.copy(camera.position);
  moon.position.copy(camera.position).addScaledVector(sunDir, 2500);
  sun.position.copy(P.pos).addScaledVector(sunDir, 450);
  sun.target.position.copy(P.pos); sun.target.updateMatrixWorld();
  if (waterNormal) { waterNormal.offset.x = G.time * 0.004; waterNormal.offset.y = G.time * 0.006; }
}

// ---------------------------------------------------------------- budowanie miasta
let facGeo, roofGeo, farGeo, shopGeo, trimGeo, curbGeo, ironGeo, pitchGeo;
export const SW = 0.15; // wysokosc chodnika
const tanks = [], awnings = [], masts = [], boards = [];
// sciany budynku z otworem drzwiowym: trzy sciany w calosci, czwarta w trzech kawalkach (po bokach i nad drzwiami)
function carveWalls(g, x0, x1, y0, y1, z0, z1, d) {
  const f = d.face, ga0 = d.c - d.gw / 2, ga1 = d.c + d.gw / 2;
  wallsFaces(g, x0, x1, y0, y1, z0, z1, 16, 14, ['n', 's', 'w', 'e'].filter(q => q !== f));
  if (d.ns) { wallsFaces(g, x0, ga0, y0, y1, z0, z1, 16, 14, [f]); wallsFaces(g, ga1, x1, y0, y1, z0, z1, 16, 14, [f]); wallsFaces(g, ga0, ga1, d.gh, y1, z0, z1, 16, 14, [f]); }
  else { wallsFaces(g, x0, x1, y0, y1, z0, ga0, 16, 14, [f]); wallsFaces(g, x0, x1, y0, y1, ga1, z1, 16, 14, [f]); wallsFaces(g, x0, x1, d.gh, y1, ga0, ga1, 16, 14, [f]); }
}
// kolizje budynku z wneka: sciany, tyl, nadproze, strop nad pokojem — wszystko na pelna wysokosc, zeby dalo sie biegac po scianach
function carveBoxes(d, x0, x1, y0, y1, z0, z1) {
  const r = d.room, ns = d.ns, ga0 = d.c - d.gw / 2, ga1 = d.c + d.gw / 2;
  const P = (u0, u1, v0, v1, ya, yb) => { if (u1 - u0 < 0.02 || v1 - v0 < 0.02 || yb - ya < 0.02) return; addBox(ns ? { x0: u0, x1: u1, z0: v0, z1: v1, y0: ya, y1: yb } : { x0: v0, x1: v1, z0: u0, z1: u1, y0: ya, y1: yb }); };
  P(r.fa0, r.cu0, r.fd0, r.fd1, y0, y1); P(r.cu1, r.fa1, r.fd0, r.fd1, y0, y1);
  const front = r.doorV === r.fd1 ? [r.cv1, r.fd1] : [r.fd0, r.cv0];
  if (r.doorV === r.fd1) P(r.cu0, r.cu1, r.fd0, r.cv0, y0, y1); else P(r.cu0, r.cu1, r.cv1, r.fd1, y0, y1);
  P(r.cu0, ga0, front[0], front[1], y0, y1); P(ga1, r.cu1, front[0], front[1], y0, y1); P(ga0, ga1, front[0], front[1], d.gh, y1);
  P(r.cu0, r.cu1, r.cv0, r.cv1, SW + r.ch, y1);
  return { x0, x1, y0, y1, z0, z1 };
}
function solid(x0, x1, y0, y1, z0, z1, st, door) {
  if (door) carveWalls(facGeo[st], x0, x1, y0, y1, z0, z1, door); else walls(facGeo[st], x0, x1, y0, y1, z0, z1, 16, 14);
  top(roofGeo, x0, x1, y1, z0, z1, 10);
  if (x1 - x0 > 5 && z1 - z0 > 5 && y1 - y0 > 6) { // gzyms
    const o = st >= 3 && st <= 4 ? 0.2 : 0.4, h = 0.7;
    fullBox(trimGeo, x0 - o, x1 + o, y1 - h, y1 - 0.05, z0 - o, z0 + 0.02, 4, true);
    fullBox(trimGeo, x0 - o, x1 + o, y1 - h, y1 - 0.05, z1 - 0.02, z1 + o, 4, true);
    fullBox(trimGeo, x0 - o, x0 + 0.02, y1 - h, y1 - 0.05, z0, z1, 4, true);
    fullBox(trimGeo, x1 - 0.02, x1 + o, y1 - h, y1 - 0.05, z0, z1, 4, true);
  }
  if (x1 - x0 > 8 && z1 - z0 > 8 && y1 - y0 > 10) {
    const pw = 0.7, po = 0.18;
    for (const [px, pz] of [[x0, z0], [x1 - pw, z0], [x0, z1 - pw], [x1 - pw, z1 - pw]]) // pilastry w narozach
      fullBox(trimGeo, px - (px === x0 ? po : 0), px + pw + (px === x0 ? 0 : po), y0, y1 - 0.7, pz - (pz === z0 ? po : 0), pz + pw + (pz === z0 ? 0 : po), 4);
    for (let y = y0 + 13.5; y < y1 - 4; y += 13.5) { // pasy miedzy kondygnacjami
      const o = 0.22, h = 0.4;
      fullBox(trimGeo, x0 - o, x1 + o, y, y + h, z0 - o, z0 + 0.02, 4, true); fullBox(trimGeo, x0 - o, x1 + o, y, y + h, z1 - 0.02, z1 + o, 4, true);
      fullBox(trimGeo, x0 - o, x0 + 0.02, y, y + h, z0, z1, 4, true); fullBox(trimGeo, x1 - 0.02, x1 + o, y, y + h, z0, z1, 4, true);
    }
  }
  if (!door && y0 === 0 && x1 - x0 > 6 && z1 - z0 > 6 && y1 > 8) { // cokol z ciemniejszego kamienia
    const o = 0.14, h = 0.95;
    fullBox(trimGeo, x0 - o, x1 + o, 0, h, z0 - o, z0 + 0.02, 4); fullBox(trimGeo, x0 - o, x1 + o, 0, h, z1 - 0.02, z1 + o, 4);
    fullBox(trimGeo, x0 - o, x0 + 0.02, 0, h, z0, z1, 4); fullBox(trimGeo, x1 - 0.02, x1 + o, 0, h, z0, z1, 4);
  }
  return door ? carveBoxes(door, x0, x1, y0, y1, z0, z1) : addBox({ x0, x1, y0, y1, z0, z1 });
}
function parapet(b) {
  const t = 0.35, h = 0.5, { x0, x1, z0, z1, y1 } = b;
  fullBox(trimGeo, x0, x1, y1, y1 + h, z0, z0 + t); fullBox(trimGeo, x0, x1, y1, y1 + h, z1 - t, z1);
  fullBox(trimGeo, x0, x0 + t, y1, y1 + h, z0 + t, z1 - t); fullBox(trimGeo, x1 - t, x1, y1, y1 + h, z0 + t, z1 - t);
  for (const [px, pz] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5]]) perches.push(new V3(px, y1, pz));
}
// witryny sklepow na scianach od ulicy
function storefront(X0, X1, Z0, Z1, bk, gap) {
  const H = 4.6, o = 0.06, row = () => Math.floor(srand() * 4), v = r => [r / 4, (r + 1) / 4];
  const side = (face, x0, x1, z0, z1) => {
    const [va, vb] = v(row()); const g = shopGeo;
    if (face === 'n') quad(g, [x1, 0.1, z0 - o], [x0, 0.1, z0 - o], [x0, H, z0 - o], [x1, H, z0 - o], [0, 0, -1], [-x1 / 16, 1 - vb], [-x0 / 16, 1 - vb], [-x0 / 16, 1 - va], [-x1 / 16, 1 - va]);
    if (face === 's') quad(g, [x0, 0.1, z1 + o], [x1, 0.1, z1 + o], [x1, H, z1 + o], [x0, H, z1 + o], [0, 0, 1], [x0 / 16, 1 - vb], [x1 / 16, 1 - vb], [x1 / 16, 1 - va], [x0 / 16, 1 - va]);
    if (face === 'w') quad(g, [x0 - o, 0.1, z0], [x0 - o, 0.1, z1], [x0 - o, H, z1], [x0 - o, H, z0], [-1, 0, 0], [z0 / 16, 1 - vb], [z1 / 16, 1 - vb], [z1 / 16, 1 - va], [z0 / 16, 1 - va]);
    if (face === 'e') quad(g, [x1 + o, 0.1, z1], [x1 + o, 0.1, z0], [x1 + o, H, z0], [x1 + o, H, z1], [1, 0, 0], [-z1 / 16, 1 - vb], [-z0 / 16, 1 - vb], [-z0 / 16, 1 - va], [-z1 / 16, 1 - va]);
    const along = face === 'n' || face === 's' ? [x0, x1] : [z0, z1];
    for (let a = along[0] + 1.5; a < along[1] - 4; a += sr(5, 9)) {
      if (srand() < 0.45) continue;
      const w = sr(2.6, 4), c = a + w / 2;
      if (face === 'n') awnings.push([c, z0 - 0.7, Math.PI, w]); else if (face === 's') awnings.push([c, z1 + 0.7, 0, w]);
      else if (face === 'w') awnings.push([x0 - 0.7, c, -Math.PI / 2, w]); else awnings.push([x1 + 0.7, c, Math.PI / 2, w]);
    }
  };
  const run = face => {
    if (gap && gap.face === face) { // drzwi: dwa kawalki witryny po bokach
      if (face === 'n' || face === 's') { if (gap.a0 - X0 > 0.8) side(face, X0, gap.a0, Z0, Z1); if (X1 - gap.a1 > 0.8) side(face, gap.a1, X1, Z0, Z1); }
      else { if (gap.a0 - Z0 > 0.8) side(face, X0, X1, Z0, gap.a0); if (Z1 - gap.a1 > 0.8) side(face, X0, X1, gap.a1, Z1); }
    } else side(face, X0, X1, Z0, Z1);
  };
  if (Z0 - bk.z0 < 4.5) run('n'); if (bk.z1 - Z1 < 4.5) run('s');
  if (X0 - bk.x0 < 4.5) run('w'); if (bk.x1 - X1 < 4.5) run('e');
}
const DOOR_TYPES = [['shop', 'SKLEP'], ['shop', 'SKLEP'], ['cafe', 'KAWIARNIA'], ['bar', 'BAR'], ['apt', 'MIESZKANIE'], ['apt', 'MIESZKANIE'], ['office', 'BIURO'], ['gym', 'SIŁOWNIA']];
// wymiary pokoi (cw: szerokosc wzdluz sciany, cd: glebokosc w glab budynku, ch: wysokosc)
export const ROOMSPEC = { shop: { cw: 14, cd: 9, ch: 3.6 }, cafe: { cw: 14, cd: 10, ch: 3.6 }, bar: { cw: 12, cd: 9, ch: 3.6 }, apt: { cw: 9, cd: 7, ch: 3.1 }, office: { cw: 16, cd: 11, ch: 3.6 }, gym: { cw: 14, cd: 10, ch: 3.8 }, fisk: { cw: 22, cd: 22, ch: 8 } };
// drzwi + wneka na pokoj wewnatrz bryly budynku. Zwraca null, gdy pokoj sie nie miesci.
// Uklad: "u" biegnie wzdluz sciany z drzwiami, "v" w glab budynku (v = 0 przy drzwiach).
function makeDoor(x0, x1, z0, z1, bk, type, name, forceFace, forceC) {
  const faces = [];
  if (z0 - bk.z0 < 4.5) faces.push('n'); if (bk.z1 - z1 < 4.5) faces.push('s'); if (x0 - bk.x0 < 4.5) faces.push('w'); if (bk.x1 - x1 < 4.5) faces.push('e');
  const face = forceFace || faces[Math.floor(srand() * faces.length)]; if (!face) return null;
  const spec = ROOMSPEC[type], big = type === 'fisk', gw = big ? 3.4 : 1.7, gh = big ? 3.6 : 2.7, t = 0.5, margin = t + 0.8;
  const ns = face === 'n' || face === 's', a0 = ns ? x0 : z0, a1 = ns ? x1 : z1, fd0 = ns ? z0 : x0, fd1 = ns ? z1 : x1;
  let c = forceC ?? (a0 + (a1 - a0) / 2 + (srand() - 0.5) * (a1 - a0 - 10));
  c = Math.max(a0 + margin + gw / 2, Math.min(a1 - margin - gw / 2, c));
  const cu0 = Math.max(a0 + margin, c - spec.cw / 2), cu1 = Math.min(a1 - margin, c + spec.cw / 2), cw = cu1 - cu0, cd = Math.min(spec.cd, fd1 - fd0 - 2 * t - 0.8);
  if (cw < Math.min(8, spec.cw * 0.7) || cd < 5.5) return null;
  const nx = face === 'w' ? -1 : face === 'e' ? 1 : 0, nz = face === 'n' ? -1 : face === 's' ? 1 : 0;
  const doorV = nx + nz > 0 ? fd1 : fd0, sIn = doorV === fd1 ? -1 : 1, cvDoor = doorV + sIn * t, cvFar = cvDoor + sIn * cd;
  const room = { cu0, cu1, cv0: Math.min(cvDoor, cvFar), cv1: Math.max(cvDoor, cvFar), cvDoor, sIn, doorV, fd0, fd1, fa0: a0, fa1: a1, cw, cd, t, ch: spec.ch, uc: (cu0 + cu1) / 2 };
  room.bx0 = ns ? cu0 : room.cv0; room.bx1 = ns ? cu1 : room.cv1; room.bz0 = ns ? room.cv0 : cu0; room.bz1 = ns ? room.cv1 : cu1;
  room.W = (u, v) => { const A = room.uc + u, D = room.cvDoor + room.sIn * v; return ns ? [A, D] : [D, A]; };
  const d = { x: ns ? c : doorV, z: ns ? doorV : c, nx, nz, type, name, big, gw, gh, face, ns, c, room };
  doors.push(d); return d;
}
function roofProps(b) {
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  parapet(b);
  if (w < 9 || d < 9) return;
  const n = 1 + Math.floor(srand() * 3);
  for (let i = 0; i < n; i++) {
    const x = sr(b.x0 + 2.5, b.x1 - 4), z = sr(b.z0 + 2.5, b.z1 - 4);
    fullBox(roofGeo, x, x + 1.6, b.y1, b.y1 + 1.1, z, z + 2.2, 6);
  }
  if (srand() < 0.4) { const x = sr(b.x0 + 2, b.x1 - 5), z = sr(b.z0 + 2, b.z1 - 5); fullBox(trimGeo, x, x + 3, b.y1, b.y1 + 2.6, z, z + 3, 4); }
  if (b.y1 < 85 && w > 11 && d > 11 && srand() < 0.45) tanks.push({ x: sr(b.x0 + 4, b.x1 - 4), y: b.y1, z: sr(b.z0 + 4, b.z1 - 4) });
  if (b.y1 > 80) for (let i = 0; i < 1 + Math.floor(srand() * 2); i++) masts.push({ x: sr(b.x0 + 2, b.x1 - 2), y: b.y1, z: sr(b.z0 + 2, b.z1 - 2), h: sr(6, 18) });
  if (b.y1 > 18 && b.y1 < 80 && w > 18 && srand() < 0.14) boards.push(b);
}
const acUnits = [];
function slopeQuad(g, a, b, c, d) { // sciana dachu: normalna liczona z wierzcholkow, skierowana w gore
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const uv = p => [p[0] / 5, p[2] / 5];
  quad(g, a, b, c, d, [nx, ny, nz], uv(a), uv(b), uv(c), uv(d));
}
function hipRoof(x0, x1, z0, z1, y, rise) {
  const o = 0.35; x0 -= o; x1 += o; z0 -= o; z1 += o; y -= 0.15;
  const w = x1 - x0, d = z1 - z0, top = y + rise + 0.15;
  const A = w >= d ? [x0 + d / 2, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z0 + w / 2];
  const B = w >= d ? [x1 - d / 2, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z1 - w / 2];
  const g = pitchGeo;
  slopeQuad(g, [x0, y, z1], [x1, y, z1], [B[0], B[1], B[2]], [A[0], A[1], A[2]]);   // poludnie
  slopeQuad(g, [x1, y, z0], [x0, y, z0], [A[0], A[1], A[2]], [B[0], B[1], B[2]]);   // polnoc
  slopeQuad(g, [x1, y, z1], [x1, y, z0], [B[0], B[1], B[2]], [B[0], B[1], B[2]]);   // wschod (trojkat)
  slopeQuad(g, [x0, y, z0], [x0, y, z1], [A[0], A[1], A[2]], [A[0], A[1], A[2]]);   // zachod (trojkat)
}
const acUnits_ = null;
let balconyCount = 0;
function wallBox(g, face, x0, x1, z0, z1, a0, a1, ya, yb, d0, d1) {
  const w = face === 'n' ? z0 : face === 's' ? z1 : face === 'w' ? x0 : x1, sg = face === 'n' || face === 'w' ? -1 : 1;
  const e0 = w + sg * d0, e1 = w + sg * d1, lo = Math.min(e0, e1), hi = Math.max(e0, e1);
  if (face === 'n' || face === 's') fullBox(g, a0, a1, ya, yb, lo, hi, 4); else fullBox(g, lo, hi, ya, yb, a0, a1, 4);
}
const streetFaces = (x0, x1, z0, z1, bk) => { const r = []; if (z0 - bk.z0 < 4.5) r.push('n'); if (bk.z1 - z1 < 4.5) r.push('s'); if (x0 - bk.x0 < 4.5) r.push('w'); if (bk.x1 - x1 < 4.5) r.push('e'); return r; };
// parapety pod oknami nizszych pieter (ciagle pasy z kamienia)
function addSills(x0, x1, z0, z1, h, bk, dr) {
  const ch = cur.vs / 4;
  for (const face of streetFaces(x0, x1, z0, z1, bk)) {
    const ns = face === 'n' || face === 's', a0 = (ns ? x0 : z0) + 0.3, a1 = (ns ? x1 : z1) - 0.3;
    for (let m = 1; m * ch < Math.min(h - 3, 19); m++) {
      const y = ((m + 0.25) / 4 - cur.vo) * cur.vs; if (y < 5 || y > Math.min(h - 3, 19)) continue;
      if (dr && dr.face === face && y < 7) continue;
      wallBox(trimGeo, face, x0, x1, z0, z1, a0, a1, y - 0.04, y + 0.1, 0, 0.17);
    }
  }
}
// schody przeciwpozarowe: pomosty, balustrady i drabinki na scianie od ulicy
function addFireEscape(x0, x1, z0, z1, h, bk, dr) {
  const faces = streetFaces(x0, x1, z0, z1, bk).filter(q => !dr || dr.face !== q); if (!faces.length) return;
  const face = faces[Math.floor(srand() * faces.length)], ns = face === 'n' || face === 's', len = ns ? x1 - x0 : z1 - z0, ch = cur.vs / 4;
  const c = (ns ? x0 : z0) + 5 + srand() * Math.max(0.1, len - 10);
  const B = (a0, a1, ya, yb, d0, d1) => wallBox(ironGeo, face, x0, x1, z0, z1, a0, a1, ya, yb, d0, d1);
  let prev = null;
  for (let m = 1; m * ch < h - 3; m++) {
    const y = ((m + 0.25) / 4 - cur.vo) * cur.vs; if (y < 5.5 || y > h - 3.5) continue;
    B(c - 1.5, c + 1.5, y, y + 0.07, 0, 1.1);                                             // pomost
    B(c - 1.5, c + 1.5, y + 0.95, y + 1.0, 1.04, 1.1); B(c - 1.5, c + 1.5, y + 0.5, y + 0.54, 1.04, 1.1); // balustrada
    B(c - 1.5, c - 1.44, y + 0.07, y + 1.0, 0, 1.1); B(c + 1.44, c + 1.5, y + 0.07, y + 1.0, 0, 1.1);
    for (const a of [-0.5, 0.5]) B(c + a - 0.03, c + a + 0.03, y, y + 1.0, 1.04, 1.1);
    if (prev !== null) { B(c + 1.0, c + 1.06, prev, y, 0.12, 0.18); B(c + 1.3, c + 1.36, prev, y, 0.12, 0.18); for (let r = prev + 0.35; r < y; r += 0.35) B(c + 1.0, c + 1.36, r, r + 0.03, 0.12, 0.18); } // drabinka
    prev = y;
  }
}
// balkony z balustrada przy czesci okien (wyzsze pietra, budynki mieszkalne)
function addBalconies(x0, x1, z0, z1, h, bk, dr) {
  const ch = cur.vs / 4, cw = cur.us / 4;
  for (const face of streetFaces(x0, x1, z0, z1, bk)) {
    const ns = face === 'n' || face === 's', lo = (ns ? x0 : z0) + 1.5, hi = (ns ? x1 : z1) - 1.5;
    for (let k = -2; k < Math.ceil((hi - lo) / cw) + 3; k++) {
      const a = ((k + 0.5) / 4 - cur.uo) * cur.us; if (a < lo || a > hi) continue;
      for (let m = 2; m * ch < h - 4 && balconyCount < 420; m++) {
        const y = ((m + 0.25) / 4 - cur.vo) * cur.vs; if (y < 6 || y > h - 3.5 || srand() > 0.07) continue;
        if (dr && dr.face === face && Math.abs(a - dr.c) < 3) continue;
        balconyCount++; const wd = cw * 0.42;
        wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a + wd, y - 0.05, y + 0.1, 0, 1.0);
        wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a + wd, y + 0.95, y + 1.0, 0.94, 1.0);
        wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a - wd + 0.05, y + 0.1, y + 1.0, 0, 1.0); wallBox(ironGeo, face, x0, x1, z0, z1, a + wd - 0.05, a + wd, y + 0.1, y + 1.0, 0, 1.0);
        for (let q = -2; q <= 2; q++) wallBox(ironGeo, face, x0, x1, z0, z1, a + q * wd * 0.4 - 0.025, a + q * wd * 0.4 + 0.025, y + 0.1, y + 0.95, 0.94, 1.0);
      }
    }
  }
}
// klimatyzatory w oknach: pozycje liczone z siatki okien tego budynku (ten sam wzor co tekstura)
function addAC(x0, x1, z0, z1, h, dr) {
  const per = 0.07 + srand() * 0.05;
  for (const face of ['n', 's', 'w', 'e']) {
    const ns = face === 'n' || face === 's', len = ns ? x1 - x0 : z1 - z0, cw = cur.us / 4, ch = cur.vs / 4;
    for (let k = -2; k < Math.ceil(len / cw) + 2; k++) {
      const a = ((k + 0.5) / 4 - cur.uo) * cur.us; // srodek okna wzdluz sciany (wspolrzedna bezwzgledna)
      const pos = ns ? a : a; if (pos < (ns ? x0 : z0) + 1.2 || pos > (ns ? x1 : z1) - 1.2) continue;
      for (let m = 1; m * ch < h - 4 && acUnits.length < 2600; m++) {
        const y = ((m + 0.54) / 4 - cur.vo) * cur.vs + (cur.vs / 4) * 0; if (y < 5.2 || y > h - 2) continue;
        if (srand() > per) continue;
        if (dr && dr.face === face && Math.abs(pos - dr.c) < 3 && y < 8) continue;
        acUnits.push({ face, x: ns ? pos : face === 'w' ? x0 - 0.3 : x1 + 0.3, z: ns ? (face === 'n' ? z0 - 0.3 : z1 + 0.3) : pos, y: y - 0.55, ns, c: 0.55 + srand() * 0.4 });
      }
    }
  }
}
function building(x0, x1, z0, z1, h, st, dk, bk, pitched) {
  randomBuildingLook();
  let dr = null;
  if (bk && doors.length < 90 && srand() < 0.3) { const [t, n] = DOOR_TYPES[Math.floor(srand() * DOOR_TYPES.length)]; dr = makeDoor(x0, x1, z0, z1, bk, t, n); }
  let b = solid(x0, x1, 0, h, z0, z1, st, dr);
  footprints.push({ x0, x1, z0, z1, h, dk });
  if (bk && h > 9) addAC(x0, x1, z0, z1, h, dr);
  if (bk && h > 9 && st !== 3 && st !== 4) addSills(x0, x1, z0, z1, h, bk, dr);
  if (bk && h > 14 && st === 0 && srand() < 0.6) addFireEscape(x0, x1, z0, z1, h, bk, dr);
  if (bk && h > 14 && (st === 1 || st === 2 || st === 5) && srand() < 0.55) addBalconies(x0, x1, z0, z1, h, bk, dr);
  if (bk) storefront(x0, x1, z0, z1, bk, dr ? { face: dr.face, a0: dr.c - dr.gw / 2 - 0.3, a1: dr.c + dr.gw / 2 + 0.3 } : null);
  if (h > 55 && srand() < 0.55) {
    const ix = Math.min(sr(3, 7), (x1 - x0) * 0.2), iz = Math.min(sr(3, 7), (z1 - z0) * 0.2), h2 = h + sr(12, h * 0.45);
    b = solid(x0 + ix, x1 - ix, h, h2, z0 + iz, z1 - iz, st);
    footprints.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: h2, dk });
    if (h2 > 110 && srand() < 0.5) {
      const jx = (b.x1 - b.x0) * 0.2, jz = (b.z1 - b.z0) * 0.2, h3 = h2 + sr(10, 40);
      b = solid(b.x0 + jx, b.x1 - jx, h2, h3, b.z0 + jz, b.z1 - jz, st);
      footprints.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: h3, dk });
    }
  }
  if (pitched) { // skosny dach: nad bryla budynku; kolizja = plaski rdzen nieco nizej niz kalenica
    const rise = 1.7 + srand() * 1.4, ins = Math.min(1.8, (x1 - x0) / 4, (z1 - z0) / 4);
    hipRoof(x0, x1, z0, z1, h, rise);
    const core = addBox({ x0: x0 + ins, x1: x1 - ins, y0: h, y1: h + rise * 0.72, z0: z0 + ins, z1: z1 - ins });
    const cx = x0 + (x1 - x0) * (0.3 + srand() * 0.4), cz = (z0 + z1) / 2;
    fullBox(trimGeo, cx - 0.5, cx + 0.5, h + rise * 0.3, h + rise + 1.3, cz - 0.5, cz + 0.5, 4); // komin
    roofs.push(core); return;
  }
  roofs.push(b); roofProps(b);
}
function tiers(cx, cz, T, st, dk, door) {
  randomBuildingLook();
  let b, first = true;
  for (const [hw, hd, y0, y1, s] of T) {
    b = solid(cx - hw, cx + hw, y0, y1, cz - hd, cz + hd, s ?? st, first ? door : null); first = false;
    footprints.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, h: y1, dk });
  }
  roofs.push(b); parapet(b); return b;
}
function spire(x, z, y0, y1, r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r, y1 - y0, 8), new THREE.MeshStandardMaterial({ color: 0x9a9a9e, metalness: 0.7, roughness: 0.35 }));
  m.position.set(x, (y0 + y1) / 2, z); m.castShadow = true; scene.add(m);
  addBox({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });
  masts.push({ x, y: y1, z, h: 0.01 });
}
export let FISK_DOOR = null;
const LANDMARKS = {
  '4,10': (b, cx, cz) => { // wiezowiec w stylu Empire State — tu zaczyna sie gra
    const t = tiers(cx, cz, [[29, 19, 0, 28], [23, 15, 28, 90], [16, 11, 90, 172], [10, 7.5, 172, 196], [5, 4, 196, 206]], 5, 'mid');
    spire(cx, cz, 206, 252, 1.4);
    START.set(t.x0 + 0.5, 206, cz + 1.2);
  },
  '6,9': (b, cx, cz) => { // szklana wieza
    FISK_DOOR = makeDoor(cx - 13, cx + 13, cz - 13, cz + 13, b, 'fisk', 'FISK TOWER', 's', cx);
    tiers(cx, cz, [[13, 13, 0, 285, 3], [9, 9, 285, 300, 4], [2, 10, 300, 330, 4]], 3, 'mid', FISK_DOOR);
    building(b.x0 + 3, b.x0 + 16, b.z0 + 3, b.z1 - 3, 30, 2, 'mid', b);
  },
  '2,16': (b, cx, cz) => { // wieza w dzielnicy finansowej
    tiers(cx, cz, [[17, 17, 0, 300, 4]], 4, 'fin');
    spire(cx, cz, 300, 380, 1);
  },
};

function buildGround() {
  const LW = LAND.x1 - LAND.x0, LD = LAND.z1 - LAND.z0;
  const gt = groundTex(); for (const t of [gt.map, gt.rough]) { t.repeat.set(LW / CX, LD / CZ); t.offset.set(-24 / CX, -24 / CZ); }
  const g = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD), new THREE.MeshStandardMaterial({ map: gt.map, roughnessMap: gt.rough, roughness: 1, metalness: 0 }));
  g.rotation.x = -Math.PI / 2; g.position.y = 0.02; g.receiveShadow = true; scene.add(g);
  const base = new THREE.Mesh(new THREE.BoxGeometry(LW, 6, LD), new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 1 }));
  base.position.y = -3; scene.add(base);
  waterNormal = waterNormals(); waterNormal.repeat.set(9000 / 30, 9000 / 30);
  water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ color: 0x5d6f86, roughness: 0.08, metalness: 0.35, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35) }));
  water.rotation.x = -Math.PI / 2; water.position.y = -1.2; water.receiveShadow = true; scene.add(water);
  const shoreMat = new THREE.MeshStandardMaterial({ color: 0x5d5f52, roughness: 1 });
  const shore = (x0, x1, z0, z1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 4, z1 - z0), shoreMat);
    m.position.set((x0 + x1) / 2, -1.5, (z0 + z1) / 2); scene.add(m);
  };
  const W0 = LAND.x0 - 270, E0 = LAND.x1 + 230, N0 = LAND.z0 - 90;
  shore(-5000, W0, -5000, 5000); shore(E0, 5000, -5000, 5000); shore(W0, E0, -5000, N0);
  for (let i = 0; i < 520; i++) {
    const side = srand(); let x, z, h = sr(6, 38), w = sr(12, 40), d = sr(12, 40);
    if (side < 0.42) { x = sr(W0 - 420, W0 - 20); z = sr(-1500, 1500); if (z > 250 && srand() < 0.12) h = sr(60, 170); }
    else if (side < 0.84) { x = sr(E0 + 20, E0 + 420); z = sr(-1500, 1500); }
    else { x = sr(W0, E0); z = sr(N0 - 400, N0 - 20); }
    walls(farGeo, x - w / 2, x + w / 2, 0.5, h, z - d / 2, z + d / 2, 16, 14);
    top(farGeo, x - w / 2, x + w / 2, h, z - d / 2, z + d / 2, 10);
  }
}

function buildPark(inst) {
  const gt = canvasTex(grassCanvas(), true); gt.repeat.set((PK.x1 - PK.x0) / 9, (PK.z1 - PK.z0) / 9);
  const PW = PK.x1 - PK.x0, PD = PK.z1 - PK.z0, cx0 = (PK.x0 + PK.x1) / 2, cz0 = (PK.z0 + PK.z1) / 2;
  const pg = new THREE.PlaneGeometry(PW, PD, Math.ceil(PW / 6), Math.ceil(PD / 6)), pp = pg.attributes.position, pc = [];
  const pathsX = [cx0 - 60, cx0 + 70], pathsZ = [PK.z0 + PD * 0.15, PK.z0 + PD * 0.42];
  for (let i = 0; i < pp.count; i++) {
    const wx = cx0 + pp.getX(i), wz = cz0 - pp.getY(i);
    let k = 1 + 0.13 * Math.sin(wx * 0.021 + Math.sin(wz * 0.013) * 2) * Math.cos(wz * 0.017 + 1.3) + 0.07 * Math.sin(wx * 0.07 + wz * 0.05);
    k += (Math.floor(wx / 9) % 2 ? 0.05 : -0.05) * (Math.abs(wz - cz0) < PD * 0.4 ? 1 : 0); // pasy po kosiarce
    let dry = 0;
    for (const px of pathsX) dry = Math.max(dry, 1 - Math.abs(wx - px) / 7);
    for (const pz of pathsZ) dry = Math.max(dry, 1 - Math.abs(wz - pz) / 7);
    const pe = Math.sqrt(((wx - POND.x) / POND.rx) ** 2 + ((wz - POND.z) / POND.rz) ** 2);
    if (pe < 1.15) k *= 0.82; // wilgotna, ciemniejsza trawa przy stawie
    dry = Math.max(0, dry) * 0.6;
    pc.push(k * (1 + dry * 0.35), k * (1 - dry * 0.05), k * (1 - dry * 0.3));
  }
  pg.setAttribute('color', new THREE.Float32BufferAttribute(pc, 3));
  const g = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: gt, roughness: 1, vertexColors: true }));
  g.rotation.x = -Math.PI / 2; g.position.set((PK.x0 + PK.x1) / 2, 0.06, (PK.z0 + PK.z1) / 2); g.receiveShadow = true; scene.add(g);
  pondM = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 0x5b7690, roughness: 0.08, metalness: 0.35, normalMap: waterNormal, normalScale: new THREE.Vector2(0.2, 0.2) }));
  pondM.rotation.x = -Math.PI / 2; pondM.scale.set(POND.rx, POND.rz, 1); pondM.position.set(POND.x, 0.1, POND.z); scene.add(pondM);
  {
    const mud = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.07, 96, 1), new THREE.MeshStandardMaterial({ color: 0x5a4c3a, roughness: 1 }));
    mud.rotation.x = -Math.PI / 2; mud.scale.set(POND.rx, POND.rz, 1); mud.position.set(POND.x, 0.11, POND.z); mud.receiveShadow = true; scene.add(mud);
    const stones = [], reeds = [];
    for (let i = 0; i < 260; i++) {
      const a = srand() * Math.PI * 2, r = 0.985 + srand() * 0.06;
      stones.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, s: sr(0.25, 0.75), r: srand() * 6 });
    }
    for (let c = 0; c < 9; c++) {
      const a0 = srand() * Math.PI * 2;
      for (let i = 0; i < 70; i++) { const a = a0 + sr(-0.12, 0.12), r = sr(0.9, 1.0); reeds.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, h: sr(1.1, 2.2), t: sr(-0.25, 0.25), r: srand() * 6 }); }
    }
    const sg = new THREE.DodecahedronGeometry(1, 0); sg.scale(1, 0.45, 0.8);
    buildInstanced(sg, new THREE.MeshStandardMaterial({ color: 0x86817a, roughness: 0.9, flatShading: true }), stones, (o, t) => { o.position.set(t.x, 0.12, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); });
    const rg = new THREE.ConeGeometry(0.035, 1, 4); rg.translate(0, 0.5, 0);
    buildInstanced(rg, new THREE.MeshStandardMaterial({ color: 0x7d8a45, roughness: 0.9 }), reeds, (o, t) => { o.position.set(t.x, 0.1, t.z); o.rotation.set(t.t, t.r, t.t * 0.5); o.scale.set(1, t.h, 1); });
    const lily = [];
    for (let i = 0; i < 60; i++) { const a = srand() * Math.PI * 2, r = sr(0.55, 0.9); lily.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, s: sr(0.35, 0.8), r: srand() * 6 }); }
    const lg = new THREE.CircleGeometry(1, 10, 0.4, Math.PI * 2 - 0.4); lg.rotateX(-Math.PI / 2);
    buildInstanced(lg, new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 0.6 }), lily, (o, t) => { o.position.set(t.x, 0.13, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.s); }, false);
  }
  const pm = new THREE.MeshStandardMaterial({ color: 0xb5a78e, roughness: 1 });
  const path = (x, z, w, d) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pm); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.08, z); m.receiveShadow = true; scene.add(m); };
  const cx = (PK.x0 + PK.x1) / 2;
  path(cx - 60, (PK.z0 + PK.z1) / 2, 5, PK.z1 - PK.z0); path(cx + 70, (PK.z0 + PK.z1) / 2 - 60, 5, PK.z1 - PK.z0 - 120);
  for (const f of [0.15, 0.42]) path(cx, PK.z0 + (PK.z1 - PK.z0) * f, PK.x1 - PK.x0, 4.5);
  // Polana (arena bossa) — bez drzew
  export_arena.x = cx; export_arena.z = PK.z1 - 70;
  for (let i = 0; i < 560; i++) {
    const x = sr(PK.x0 + 4, PK.x1 - 4), z = sr(PK.z0 + 4, PK.z1 - 4);
    if (((x - POND.x) / (POND.rx + 5)) ** 2 + ((z - POND.z) / (POND.rz + 5)) ** 2 < 1) continue;
    if (Math.hypot(x - export_arena.x, z - export_arena.z) < 62) continue;
    inst.push({ x, z, s: sr(2.4, 4.4), h: sr(2.5, 4.5) });
  }
}
const export_arena = { x: 0, z: 0 };
export const ARENA = export_arena;

function buildTrees(list) {
  const trunk = new THREE.CylinderGeometry(0.13, 0.34, 1, 8); trunk.translate(0, 0.5, 0);
  // korona z kilku splaszczonych, pofalowanych kep liscia; ciemniejsza od spodu, jasniejsza od gory
  const crown = (() => {
    const pos = [], col = [], idx = [], nor = []; let base = 0;
    const lobes = [[0, 0.1, 0, 0.75], [0.45, -0.05, 0.1, 0.5], [-0.42, 0, -0.15, 0.52], [0.1, 0.05, 0.48, 0.48], [-0.1, 0.0, -0.5, 0.5], [0.05, 0.55, 0.05, 0.45], [0.35, 0.3, -0.35, 0.38]];
    for (const [lx, ly, lz, lr] of lobes) {
      const g = new THREE.IcosahedronGeometry(lr, 2), p = g.attributes.position, ix = g.index ? g.index.array : null;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
        const n = 1 + 0.16 * Math.sin(x * 9 + lx * 7) * Math.cos(z * 8 + ly * 5) + 0.1 * Math.sin(y * 13 + lz * 9);
        const X = lx + x * n, Y = ly + y * n * 0.82, Z = lz + z * n;
        pos.push(X, Y, Z); nor.push(x / l * 0.8 + X * 0.25, y / l * 0.8 + Y * 0.25 + 0.15, z / l * 0.8 + Z * 0.25); // gladkie, kopulaste normalne
        const k = 0.62 + 0.5 * Math.min(1, Math.max(0, (Y + 0.7) / 1.5)) + 0.12 * Math.sin(X * 17 + Z * 11);
        col.push(k, k, k);
      }
      if (ix) for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); else for (let i = 0; i < p.count; i++) idx.push(i + base);
      base += p.count;
    }
    const G2 = new THREE.BufferGeometry();
    G2.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); G2.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    G2.setIndex(idx); const nv = new THREE.Vector3(); for (let i = 0; i < nor.length; i += 3) { nv.set(nor[i], nor[i + 1], nor[i + 2]).normalize(); nor[i] = nv.x; nor[i + 1] = nv.y; nor[i + 2] = nv.z; }
    G2.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); return G2;
  })();
  const tm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas('#5a4030', 3000, 0.15, 128), true), roughness: 1 });
  const cm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas('#dddddd', 4000, 0.18, 128), true), roughness: 0.92, vertexColors: true });
  const T = new THREE.InstancedMesh(trunk, tm, list.length), C = new THREE.InstancedMesh(crown, cm, list.length);
  const o = new THREE.Object3D(), col = new THREE.Color();
  const pal = [0x4f7a2f, 0x5d8a35, 0x3f6a2a, 0x6f8f3a, 0xb8782e, 0xa0522d, 0x7a8f35];
  list.forEach((t, i) => {
    o.position.set(t.x, t.y || 0, t.z); o.rotation.set(0, srand() * 6, 0); o.scale.set(1, t.h, 1); o.updateMatrix(); T.setMatrixAt(i, o.matrix);
    o.position.set(t.x, (t.y || 0) + t.h + t.s * 0.45, t.z); o.rotation.set(0, srand() * 6, 0); o.scale.set(t.s * 1.5, t.s * 1.5, t.s * 1.5); o.updateMatrix(); C.setMatrixAt(i, o.matrix);
    col.setHex(pal[Math.floor(srand() * pal.length)]); C.setColorAt(i, col);
  });
  for (const m of [T, C]) { m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
}

function buildInstanced(geo, mat, items, place, cast = true) {
  const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)), o = new THREE.Object3D();
  items.forEach((it, i) => { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(o, it, i); o.updateMatrix(); m.setMatrixAt(i, o.matrix); });
  m.count = items.length;
  m.castShadow = false; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; // instancje sa w calym miescie — bez cieni (za drogie)
}
function glowPoints(pos, color, size) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  p.frustumCulled = false; scene.add(p); glowPts.push(p); return p;
}

// sygnalizacja swietlna na rogu kazdego kwartalu
function buildTrafficLights(list) {
  const metal = new THREE.MeshStandardMaterial({ color: 0x2b3033, metalness: 0.6, roughness: 0.45 });
  const pole = new THREE.CylinderGeometry(0.09, 0.12, 6, 8); pole.translate(0, 3, 0);
  const arm = new THREE.BoxGeometry(4.6, 0.12, 0.12); arm.translate(-2.3, 5.8, 0);
  const head = new THREE.BoxGeometry(0.36, 1.0, 0.34); head.translate(-4.4, 5.25, 0);
  const put = (o, t) => o.position.set(t[0], SW, t[1]);
  buildInstanced(pole, metal, list, put); buildInstanced(arm, metal, list, put);
  buildInstanced(head, new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.6 }), list, put);
  const lg = new THREE.BoxGeometry(0.2, 0.2, 0.36); lg.translate(-4.4, 0, 0);
  const lm = buildInstanced(lg, new THREE.MeshBasicMaterial({ color: 0xffffff }), list, (o, t) => o.position.set(t[0], SW + (t[2] ? 4.92 : 5.58), t[1]), false);
  const col = new THREE.Color();
  list.forEach((t, i) => lm.setColorAt(i, col.setHex(t[2] ? 0x39ff6a : 0xff2a1a)));
  linearize(lm);
  glowPoints(list.flatMap(t => [t[0] - 4.4, SW + (t[2] ? 4.92 : 5.58), t[1]]), 0xffd0a0, 1.6);
}

// geometria drzwi: framuga, skrzydlo, daszek; szyld z nazwa swieci nocy
function buildDoors() {
  const frameG = trimGeo, gl = [];
  for (const d of doors) {
    const w = d.gw, h = d.gh, tx = -d.nz, tz = d.nx; // tx,tz: kierunek wzdluz sciany
    const box = (g, a0, a1, y0, y1, o0, o1) => { // a: wzdluz sciany (od srodka), o: od sciany na zewnatrz
      const ax0 = d.x + tx * a0 + d.nx * o0, ax1 = d.x + tx * a1 + d.nx * o1, az0 = d.z + tz * a0 + d.nz * o0, az1 = d.z + tz * a1 + d.nz * o1;
      fullBox(g, Math.min(ax0, ax1), Math.max(ax0, ax1), y0, y1, Math.min(az0, az1), Math.max(az0, az1), 4, true);
    };
    box(frameG, -w / 2 - 0.3, -w / 2, SW, h + 0.3, 0, 0.32); box(frameG, w / 2, w / 2 + 0.3, SW, h + 0.3, 0, 0.32);
    box(frameG, -w / 2 - 0.3, w / 2 + 0.3, h, h + 0.35, 0, 0.32);                  // nadproze
    box(frameG, -w / 2 - 0.5, w / 2 + 0.5, 0, SW + 0.12, 0.1, 0.9);                 // schodek
    if (d.big) box(frameG, -w / 2 - 0.9, w / 2 + 0.9, h + 0.35, h + 0.55, 0, 1.6);  // wielki daszek
    else awnings.push([d.x + d.nx * 0.9, d.z + d.nz * 0.9, Math.atan2(-d.nx, -d.nz) + Math.PI, w + 0.8]);
    d.gx = d.x + d.nx * 1.6; d.gz = d.z + d.nz * 1.6; // punkt przed drzwiami (tu stoi gracz)
    gl.push(d.x + d.nx * 0.5, h + 0.9, d.z + d.nz * 0.5);
  }
  glowPoints(gl, 0xffd9a0, 4);
}
// ---------------------------------------------------------------- rekwizyty uliczne
// Male detale na chodnikach: kazdy rodzaj to jedna geometria z kolorami wierzcholkow i jedno rysowanie
// (instancje), wiec kosztuja prawie nic. Kolor wariantu (np. zielony/niebieski kontener) daje kolor instancji.
function propGeo(parts) { // parts: [geometria, hex] — scala, koloruje wierzcholki (liniowo)
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
  for (const [g, hex] of parts) {
    const off = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
    c.setHex(hex).convertSRGBToLinear();
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
  }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  m.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); m.setIndex(idx); return m;
}
const bx = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
const cy = (r0, r1, h, x, y, z, seg = 10) => { const g = new THREE.CylinderGeometry(r0, r1, h, seg); g.translate(x, y, z); return g; };
const PROPS = {
  trash: { geo: () => propGeo([[cy(0.3, 0.26, 0.86, 0, 0.43, 0), 0x9a9da0], [cy(0.34, 0.34, 0.07, 0, 0.9, 0), 0x6f7377], [cy(0.31, 0.31, 0.03, 0, 0.6, 0, 12), 0x55595d]]), cols: [0xffffff, 0x9fd0a8, 0x9fb8d6, 0x777777] },
  dumpster: { geo: () => propGeo([[bx(2.3, 1.15, 1.1, 0, 0.7, 0), 0xffffff], [bx(2.34, 0.08, 1.14, 0, 1.31, 0), 0x2b2b2b], [bx(2.3, 0.14, 1.1, 0, 0.1, 0), 0x222222], [cy(0.11, 0.11, 0.1, -0.9, 0.09, 0.4, 8), 0x111111], [cy(0.11, 0.11, 0.1, 0.9, 0.09, 0.4, 8), 0x111111]]), cols: [0x2f6b3d, 0x2c4f8a, 0x7a3a22, 0x3b3f44] },
  hydrant: { geo: () => propGeo([[cy(0.15, 0.17, 0.62, 0, 0.33, 0), 0xffffff], [new THREE.SphereGeometry(0.15, 10, 8).translate(0, 0.66, 0), 0xffffff], [cy(0.06, 0.06, 0.4, 0, 0.45, 0, 8).rotateZ(Math.PI / 2), 0xd9d9d9], [cy(0.09, 0.09, 0.05, 0, 0.05, 0), 0x333333]]), cols: [0xc0281f, 0xc0281f, 0xe0b81e] },
  mailbox: { geo: () => propGeo([[bx(0.5, 0.65, 0.45, 0, 0.98, 0), 0xffffff], [cy(0.23, 0.23, 0.45, 0, 1.31, 0, 10).rotateX(Math.PI / 2), 0xffffff], [bx(0.1, 0.7, 0.1, -0.18, 0.35, 0), 0x333333], [bx(0.1, 0.7, 0.1, 0.18, 0.35, 0), 0x333333], [bx(0.32, 0.03, 0.02, 0, 1.1, 0.23), 0x111111]]), cols: [0x1f4f9c, 0x1f4f9c, 0x9c2a1f] },
  bench: { geo: () => propGeo([[bx(1.7, 0.07, 0.5, 0, 0.5, 0), 0xffffff], [bx(1.7, 0.4, 0.06, 0, 0.78, -0.22), 0xffffff], [bx(0.08, 0.5, 0.45, -0.75, 0.25, 0), 0x2a2d30], [bx(0.08, 0.5, 0.45, 0.75, 0.25, 0), 0x2a2d30]]), cols: [0x6b4a2a, 0x3d6a48, 0x8a6a3a] },
  meter: { geo: () => propGeo([[cy(0.035, 0.035, 1.15, 0, 0.58, 0, 6), 0x3a3d40], [bx(0.2, 0.3, 0.14, 0, 1.28, 0), 0x55595d], [bx(0.14, 0.1, 0.02, 0, 1.33, 0.08), 0x9ad6a0]]), cols: [0xffffff] },
  news: { geo: () => propGeo([[bx(0.65, 0.95, 0.5, 0, 0.5, 0), 0xffffff], [bx(0.5, 0.32, 0.04, 0, 0.72, 0.26), 0xe9e4d2], [bx(0.7, 0.08, 0.55, 0, 1.0, 0), 0x2b2b2b]]), cols: [0xb8261f, 0x2c5fa8, 0xd9a01e, 0x2f7a4a] },
  cone: { geo: () => propGeo([[new THREE.ConeGeometry(0.16, 0.7, 10).translate(0, 0.4, 0), 0xff6a14], [bx(0.4, 0.05, 0.4, 0, 0.03, 0), 0x2b2b2b], [cy(0.13, 0.145, 0.06, 0, 0.42, 0, 10), 0xf2f2f2]]), cols: [0xffffff] },
  sign: { geo: () => propGeo([[cy(0.04, 0.04, 3.4, 0, 1.7, 0, 6), 0x55595d], [bx(1.05, 0.26, 0.04, 0.0, 3.3, 0), 0x1f6a3a], [bx(0.9, 0.16, 0.05, 0, 3.3, 0.005), 0xf2f2f2]]), cols: [0xffffff] },
  crates: { geo: () => propGeo([[bx(0.7, 0.55, 0.7, 0, 0.28, 0), 0xffffff], [bx(0.6, 0.5, 0.6, 0.15, 0.83, 0.05), 0xffffff], [bx(0.5, 0.4, 0.5, -0.55, 0.2, 0.3), 0xffffff]]), cols: [0xa8804f, 0x9b7a4c, 0x7e6a4a] },
  vent: { geo: () => propGeo([[new THREE.CylinderGeometry(0.22, 0.4, 1.4, 12).translate(0, 0.7, 0), 0xff7a1a], [cy(0.42, 0.42, 0.12, 0, 0.06, 0, 12), 0x444444], [cy(0.235, 0.235, 0.12, 0, 0.9, 0, 12), 0xf2f2f2], [cy(0.2, 0.2, 0.1, 0, 1.36, 0, 12), 0xf2f2f2]]), cols: [0xffffff] },
  shelter: { geo: () => propGeo([[bx(3.6, 0.1, 1.4, 0, 2.5, 0), 0x2b2f33], [bx(0.08, 2.5, 0.08, -1.7, 1.25, -0.6), 0x2b2f33], [bx(0.08, 2.5, 0.08, 1.7, 1.25, -0.6), 0x2b2f33], [bx(3.4, 2.1, 0.04, 0, 1.3, -0.62), 0x9fc4d6], [bx(0.04, 2.1, 1.1, -1.7, 1.3, -0.05), 0x9fc4d6], [bx(1.8, 0.06, 0.4, 0.2, 0.5, -0.4), 0x6b4a2a], [bx(0.9, 1.4, 0.05, -0.5, 1.4, -0.6), 0xe8e4d8]]), cols: [0xffffff] },
};
export const ventList = [];
function buildProps(blocks) {
  const L = {}; for (const k in PROPS) L[k] = [];
  const near = (x, z, r) => doors.some(d => Math.hypot(x - d.gx, z - d.gz) < r);
  const put = (k, x, z, yaw, r = 1.5) => { if (near(x, z, r)) return; L[k].push({ x, z, yaw, ci: Math.floor(srand() * PROPS[k].cols.length) }); };
  const edge = (b, side, t, ins) => { // punkt na chodniku przy krawedzi kwartalu, yaw = twarza do ulicy
    const x0 = b.x0 + 4, x1 = b.x1 - 4, z0 = b.z0 + 4, z1 = b.z1 - 4;
    if (side === 0) return [x0 + t * (x1 - x0), b.z0 + ins, Math.PI]; if (side === 1) return [x0 + t * (x1 - x0), b.z1 - ins, 0];
    if (side === 2) return [b.x0 + ins, z0 + t * (z1 - z0), -Math.PI / 2]; return [b.x1 - ins, z0 + t * (z1 - z0), Math.PI / 2];
  };
  const R4 = () => Math.floor(srand() * 4);
  for (const b of blocks) {
    const [hx, hz, hy] = edge(b, R4(), srand(), 1.9); put('hydrant', hx, hz, hy);
    if (srand() < 0.6) { const [mx, mz, my] = edge(b, R4(), srand(), 1.8); put('mailbox', mx, mz, my); }
    for (let k = 0, n = 2 + Math.floor(srand() * 3); k < n; k++) { const [tx, tz, ty] = edge(b, R4(), srand(), 1.6 + srand() * 0.4); put('trash', tx, tz, ty, 1.2); }
    if (srand() < 0.55) { const s = R4(), [dx, dz, dy] = edge(b, s, 0.1 + srand() * 0.8, 3.0); put('dumpster', dx, dz, dy + (srand() < 0.5 ? 0 : Math.PI), 2.6); const q = edge(b, s, 0.1 + srand() * 0.8, 3.0); put('crates', q[0], q[1], srand() * 6, 2.2); }
    if (srand() < 0.5) { const [nx, nz, ny] = edge(b, R4(), srand(), 2.1); put('news', nx, nz, ny); }
    if (srand() < 0.35) { const s = R4(), t0 = srand() * 0.6; for (let k = 0; k < 4; k++) { const [px, pz, py] = edge(b, s, t0 + k * 0.07, 1.3); put('meter', px, pz, py + Math.PI / 2, 1.2); } }
    if (srand() < 0.5) { const [bx2, bz2, by2] = edge(b, R4(), srand(), 2.3); put('bench', bx2, bz2, by2); }
    if (srand() < 0.14) { const [sx, sz, sy] = edge(b, R4(), 0.3 + srand() * 0.4, 1.4); put('shelter', sx, sz, sy, 3); }
    if (srand() < 0.12) { const s = R4(), t0 = srand() * 0.7; for (let k = 0; k < 5; k++) { const [cx, cz] = edge(b, s, t0 + k * 0.05, 0.55); put('cone', cx, cz, 0, 0.3); } }
    const cs = [[b.x0 + 0.9, b.z0 + 0.9], [b.x1 - 0.9, b.z0 + 0.9], [b.x0 + 0.9, b.z1 - 0.9], [b.x1 - 0.9, b.z1 - 0.9]][R4()]; put('sign', cs[0], cs[1], srand() < 0.5 ? 0 : Math.PI / 2, 0.5);
    if (srand() < 0.3) { const inX = srand() < 0.5, x = inX ? b.x0 + srand() * (b.x1 - b.x0) : (srand() < 0.5 ? b.x0 - 3 : b.x1 + 3), z = inX ? (srand() < 0.5 ? b.z0 - 3 : b.z1 + 3) : b.z0 + srand() * (b.z1 - b.z0); L.vent.push({ x, z, yaw: 0, ci: 0, road: true }); }
  }
  for (const v of L.vent) ventList.push(v);
  for (let k = 0; k < 14; k++) { const x = (k % 2 ? PK.x0 + 42 : PK.x0 + 196) + 3, z = PK.z0 + 20 + k * 25; if (z < PK.z1 - 10) L.bench.push({ x, z, yaw: k % 2 ? -Math.PI / 2 : Math.PI / 2, ci: Math.floor(srand() * 3), park: true }); }
  const o = new THREE.Object3D(), col = new THREE.Color();
  for (const k in PROPS) {
    const list = L[k]; if (!list.length) continue;
    const im = new THREE.InstancedMesh(PROPS[k].geo(), new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.65, metalness: k === 'hydrant' || k === 'mailbox' ? 0.2 : 0.05 }), list.length);
    list.forEach((p, i) => { o.position.set(p.x, p.road ? 0.02 : (p.park ? 0.06 : SW), p.z); o.rotation.set(0, p.yaw, 0); o.scale.setScalar(1); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, col.setHex(PROPS[k].cols[p.ci % PROPS[k].cols.length])); });
    im.frustumCulled = false; im.receiveShadow = true; scene.add(im);
  }
}

function buildAC() {
  if (!acUnits.length) return;
  const g = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.2 }), acUnits.length), o = new THREE.Object3D(), c = new THREE.Color();
  acUnits.forEach((u, i) => { o.position.set(u.x, u.y, u.z); o.scale.set(u.ns ? 0.85 : 0.55, 0.5, u.ns ? 0.55 : 0.85); o.updateMatrix(); im.setMatrixAt(i, o.matrix); const v = 0.55 + u.c * 0.4; im.setColorAt(i, c.setRGB(v, v, v * 1.02)); });
  im.frustumCulled = false; im.receiveShadow = true; scene.add(im);
}
export function nearestDoor(x, y, z, r = 2.6) {
  if (y > 6) return null;
  let best = null, bd = r;
  for (const d of doors) { const dd = Math.hypot(x - d.gx, z - d.gz); if (dd < bd) { bd = dd; best = d; } }
  return best;
}
export function buildCity() {
  buildSky();
  facGeo = STY.map(() => newGeo()); roofGeo = newGeo(); farGeo = newGeo(); shopGeo = newGeo(); trimGeo = newGeo(); curbGeo = newGeo(); ironGeo = newGeo(); pitchGeo = newGeo();
  const trees = [], lamps = [], tlights = [], propBlocks = [], pocketParks = [];
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
    if (isPark(i, j)) continue;
    const b = blk(i, j), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dk = distKey(i, j), D = DIST[dk];
    lamps.push([b.x0 + 0.6, b.z0 + 0.6, -1], [b.x1 - 0.6, b.z0 + 0.6, 1], [b.x0 + 0.6, b.z1 - 0.6, -1], [b.x1 - 0.6, b.z1 - 0.6, 1]);
    tlights.push([b.x0 + 1.1, b.z0 + 1.6, (i + j) % 2]); propBlocks.push(b);
    fullBox(curbGeo, b.x0, b.x1, 0, SW, b.z0, b.z1, 4); // plyta chodnika (budynki stoja na niej)
    addBox({ x0: b.x0, x1: b.x1, y0: 0, y1: SW, z0: b.z0, z1: b.z1 });
    if (['harlem', 'uws', 'ues', 'gv', 'ct', 'hk'].includes(dk) && srand() < 0.6)
      for (let x = b.x0 + 6; x < b.x1 - 4; x += 11) { trees.push({ x, y: SW, z: b.z0 + 1, s: sr(1.4, 2), h: sr(2.2, 3) }, { x, y: SW, z: b.z1 - 1, s: sr(1.4, 2), h: sr(2.2, 3) }); }
    const L = LANDMARKS[i + ',' + j];
    if (L) { L(b, cx, cz); continue; }
    const x0 = b.x0 + 3, x1 = b.x1 - 3, z0 = b.z0 + 3, z1 = b.z1 - 3, r = srand();
    let lots;
    if (r < 0.2) lots = [[x0, x1, z0, z1]];
    else if (r < 0.5) { const m = sr(x0 + 18, x1 - 18); lots = [[x0, m, z0, z1], [m, x1, z0, z1]]; }
    else if (r < 0.75) { const m = (z0 + z1) / 2 + sr(-4, 4); lots = [[x0, x1, z0, m], [x0, x1, m, z1]]; }
    else { const mx = sr(x0 + 20, x1 - 20), mz = (z0 + z1) / 2 + sr(-3, 3); lots = [[x0, mx, z0, mz], [mx, x1, z0, mz], [x0, mx, mz, z1], [mx, x1, mz, z1]]; }
    for (const l of lots) {
      if (srand() < 0.07 && l[1] - l[0] > 16 && l[3] - l[2] > 14 && dk !== 'mid' && dk !== 'fin') { pocketParks.push(l); for (let q = 0, n = 5 + Math.floor(srand() * 5); q < n; q++) trees.push({ x: sr(l[0] + 2, l[1] - 2), y: SW, z: sr(l[2] + 2, l[3] - 2), s: sr(1.8, 3), h: sr(2.4, 3.6) }); continue; }
      let h = sr(D.h[0], D.h[1]); if (srand() < D.tall) h *= sr(1.4, 2.1);
      let pitched = false;
      if (dk !== 'mid' && dk !== 'fin' && srand() < 0.14) { h = sr(8, 14); pitched = (l[1] - l[0]) < 34 && (l[3] - l[2]) < 30 && srand() < 0.7; }
      building(l[0] + 0.4, l[1] - 0.4, l[2] + 0.4, l[3] - 0.4, h, D.st[Math.floor(srand() * D.st.length)], dk, b, pitched);
    }
  }
  buildGround();
  buildPark(trees);
  buildTrees(trees);
  buildDoors(); // przed sklejeniem geometrii (framugi trafiaja do trimGeo, daszki do markiz)
  buildAC();
  buildProps(propBlocks); // po drzwiach: nie stawiamy niczego w wejsciach

  facMats = STY.map(s => {
    const t = facadeTex(s);
    return groundAO(new THREE.MeshStandardMaterial({
      map: t.map, emissiveMap: t.emi, emissive: 0xffffff, emissiveIntensity: 0.3,
      roughness: 1, roughnessMap: t.rough, bumpMap: dbg('nobump') ? null : t.bump, bumpScale: 0.07, metalness: 1, metalnessMap: t.metal,
    }));
  });
  facMats.forEach((m, i) => { m.userData.env = STY[i].metal ? 2.2 : 1.5; });
  facGeo.forEach((g, i) => meshFrom(g, facMats[i]));
  const roofMat = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas('#8a8780', 7000, 0.14, 256, { n: 40, r: 5, c: ['rgba(60,60,60,.3)', 'rgba(120,110,100,.3)'] }), true), roughness: 1 });
  meshFrom(roofGeo, roofMat, false);
  meshFrom(ironGeo, new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.55 }), false);
  { // gonty
    const c = cv(256, 256), x = c.getContext('2d'); x.fillStyle = '#5b4a43'; x.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16) for (let xx = (y / 16 % 2) * 16 - 16; xx < 256; xx += 32) { const k = 0.85 + Math.random() * 0.3; x.fillStyle = `rgb(${91 * k | 0},${74 * k | 0},${67 * k | 0})`; x.fillRect(xx + 1, y + 1, 30, 14); }
    meshFrom(pitchGeo, new THREE.MeshStandardMaterial({ map: canvasTex(c, true), roughness: 0.9 }), true);
  }
  if (pocketParks.length) {
    const gm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas('#5b8a3a', 6000, 0.1, 128, { n: 30, r: 3, c: ['#6f9e45', '#4b7a2e', '#f3f3f3'] }), true), roughness: 1 });
    for (const l of pocketParks) { const m = new THREE.Mesh(new THREE.PlaneGeometry(l[1] - l[0] - 1, l[3] - l[2] - 1), gm); m.rotation.x = -Math.PI / 2; m.position.set((l[0] + l[1]) / 2, SW + 0.03, (l[2] + l[3]) / 2); m.receiveShadow = true; scene.add(m); }
  }
  meshFrom(trimGeo, groundAO(new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas('#b3aa9c', 3000, 0.1, 128), true), roughness: 0.9 })));
  const st = shopTex();
  shopMat = groundAO(new THREE.MeshStandardMaterial({ map: st.map, emissiveMap: st.emi, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.1 }), 0.75, 6);
  meshFrom(shopGeo, shopMat, false);
  meshFrom(farGeo, facMats[2], false);
  // podniesione chodniki z kraweznikami
  const cm = new THREE.MeshStandardMaterial({ map: canvasTex(sidewalkCanvas(), true), roughness: 0.95 });
  meshFrom(curbGeo, cm, false);

  // markizy nad sklepami
  const aw = new THREE.BoxGeometry(1, 0.12, 1.4); aw.translate(0, 0, 0);
  const awM = buildInstanced(aw, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), awnings,
    (o, a) => { o.position.set(a[0], 3.7, a[1]); o.rotation.set(0.28, a[2], 0, 'YXZ'); o.scale.set(a[3], 1, 1); });
  const awc = [0xb8141c, 0x1a5e2c, 0x15306e, 0x7a1f1f, 0x2d2d2d, 0x0d6b73, 0xa86b12], col = new THREE.Color();
  awnings.forEach((a, i) => awM.setColorAt(i, col.setHex(awc[Math.floor(srand() * awc.length)])));
  linearize(awM);

  // wieze cisnien
  const woodC = cv(128, 128), wx = woodC.getContext('2d');
  wx.fillStyle = '#6b4a33'; wx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 128; i += 10) { wx.fillStyle = 'rgba(0,0,0,.25)'; wx.fillRect(i, 0, 2, 128); }
  wx.fillStyle = '#2a2a2a'; wx.fillRect(0, 30, 128, 5); wx.fillRect(0, 90, 128, 5);
  const tm = new THREE.MeshStandardMaterial({ map: canvasTex(woodC, true), roughness: 0.95 });
  const tBody = new THREE.CylinderGeometry(1.6, 1.6, 3, 12); tBody.translate(0, 2.7, 0);
  const tRoof = new THREE.ConeGeometry(1.75, 1.2, 12); tRoof.translate(0, 4.8, 0);
  const tLeg = new THREE.CylinderGeometry(1.1, 1.1, 1.2, 8, 1, true); tLeg.translate(0, 0.6, 0);
  const put = (o, t) => o.position.set(t.x, t.y, t.z);
  buildInstanced(tBody, tm, tanks, put);
  buildInstanced(tRoof, new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.7, metalness: 0.3 }), tanks, put);
  buildInstanced(tLeg, new THREE.MeshStandardMaterial({ color: 0x222222, side: THREE.DoubleSide }), tanks, put);

  // anteny z czerwonymi swiatelkami
  const mg = new THREE.CylinderGeometry(0.08, 0.15, 1, 5); mg.translate(0, 0.5, 0);
  buildInstanced(mg, new THREE.MeshStandardMaterial({ color: 0x55585c, metalness: 0.6, roughness: 0.4 }), masts, (o, m) => { o.position.set(m.x, m.y, m.z); o.scale.set(1, m.h, 1); });
  glowPoints(masts.flatMap(m => [m.x, m.y + m.h + 0.3, m.z]), 0xff2a2a, 5);
  for (const m of masts) if (m.h > 1) perches.push(new V3(m.x, m.y, m.z + 0.8));

  // billboardy z neonami
  const texts = [['DAILY BUGLE', '#ff3b3b'], ['NOWY JORK', '#3fe3ff'], ['PIZZA 24h', '#ffb13b'], ['HOT DOGI', '#ff5bd1'], ['OSCORP', '#39ff6a'], ['KINO', '#fff35b'], ['METRO', '#5b8dff'], ['TAXI', '#ffd21e']];
  boardMats = texts.map(([t, c]) => { const tx = neonTex(t, c); return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 1, roughness: 0.5 }); });
  const bg = new THREE.PlaneGeometry(12, 5);
  boards.forEach((b, i) => {
    const alongX = b.x1 - b.x0 >= 18, m = new THREE.Mesh(bg, boardMats[i % boardMats.length]);
    if (alongX) { const s = srand() < 0.5; m.position.set((b.x0 + b.x1) / 2, b.y1 + 4.2, s ? b.z0 + 0.5 : b.z1 - 0.5); m.rotation.y = s ? Math.PI : 0; }
    else { const s = srand() < 0.5; m.position.set(s ? b.x0 + 0.5 : b.x1 - 0.5, b.y1 + 4.2, (b.z0 + b.z1) / 2); m.rotation.y = s ? -Math.PI / 2 : Math.PI / 2; }
    const back = new THREE.Mesh(new THREE.BoxGeometry(12.4, 5.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.8 }));
    back.position.set(0, 0, -0.18); m.add(back);
    for (const px of [-4, 4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), back.material); leg.position.set(px, -3.6, -0.2); m.add(leg); }
    m.castShadow = true; scene.add(m);
  });

  // latarnie + poswiata
  const pole = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6); pole.translate(0, 3.75, 0);
  buildInstanced(pole, new THREE.MeshStandardMaterial({ color: 0x2c3238, metalness: 0.5, roughness: 0.5 }), lamps, (o, l) => o.position.set(l[0], SW, l[1]));
  lampMat = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 0.9 });
  buildInstanced(new THREE.BoxGeometry(1.6, 0.2, 0.4), lampMat, lamps, (o, l) => o.position.set(l[0] + l[2] * 0.8, 7.5 + SW, l[1]), false);
  glowPoints(lamps.flatMap(l => [l[0] + l[2] * 0.8, 7.3 + SW, l[1]]), 0xffc070, 7);
  buildTrafficLights(tlights);

  for (const r of roofs) if (r.x1 - r.x0 >= 14 && r.z1 - r.z0 >= 14 && r.y1 >= 15 && r.y1 <= 100) spots.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y1: r.y1, cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2, busy: false });
  footprints.sort((a, b) => a.h - b.h);
  initTraffic();
  initLife();
}

// ---------------------------------------------------------------- ruch uliczny
const cars = [], peds = [];
let carBody, carGlass, carWheel, carSign, headL, tailL, pedMesh = [];
const _o = new THREE.Object3D(), _c = new THREE.Color();

// ksztalt wzdluz osi Z z pierscieni (przekroj prostokat z zaokragleniami)
function loftZ(rings, segs, n) {
  const pos = [], idx = [];
  for (const r of rings) for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
    pos.push(r[1] * ex, (r[2] + r[3]) / 2 + (r[3] - r[2]) / 2 * ey, r[0]);
  }
  const S = segs + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, b = a + 1, c = b + S, d = a + S; idx.push(a, b, c, a, c, d); } // trojkaty skierowane na zewnatrz
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function mergeGeos(list) {
  const pos = [], nor = [], idx = [];
  for (const g0 of list) {
    const g = g0.index ? g0 : g0; const off = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
  }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setIndex(idx);
  return m;
}
// samochod: nadwozie z maska i bagaznikiem, kabina z szybami, dach, kola
function carGeometries() {
  // [z, pol szerokosci, dol, gora]
  const body = loftZ([[-2.26, 0.5, 0.42, 0.66], [-2.22, 0.84, 0.32, 0.86], [-2.05, 0.9, 0.29, 0.94], [-1.3, 0.92, 0.28, 0.98], [0.7, 0.92, 0.28, 0.98], [1.55, 0.91, 0.29, 0.9], [2.1, 0.87, 0.31, 0.8], [2.27, 0.55, 0.38, 0.62]], 20, 5);
  const roof = loftZ([[-1.0, 0.66, 1.36, 1.4], [-0.95, 0.74, 1.37, 1.47], [0.3, 0.74, 1.37, 1.48], [0.36, 0.66, 1.37, 1.42]], 16, 5);
  const glass = loftZ([[-1.45, 0.8, 0.9, 0.97], [-1.02, 0.78, 0.9, 1.42], [0.33, 0.78, 0.9, 1.44], [1.02, 0.82, 0.9, 0.99]], 18, 4);
  const wheels = [];
  for (const [x, z] of [[0.83, 1.38], [-0.83, 1.38], [0.83, -1.36], [-0.83, -1.36]]) {
    const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16); w.rotateZ(Math.PI / 2); w.translate(x, 0.34, z); wheels.push(w);
  }
  const sign = new THREE.BoxGeometry(0.55, 0.2, 0.26); sign.translate(0, 1.58, -0.3);
  return { body: mergeGeos([body, roof]), glass, wheels: mergeGeos(wheels), sign };
}
function initTraffic() {
  const lanes = [];
  for (let i = 0; i <= NX; i++) { const x = X0 + i * CX; lanes.push({ ax: 'z', c: x - 4, dir: 1 }, { ax: 'z', c: x + 4, dir: -1 }); }
  for (let j = 0; j <= NZ; j++) { const z = Z0 + j * CZ; lanes.push({ ax: 'x', c: z + 4, dir: -1 }, { ax: 'x', c: z - 4, dir: 1 }); }
  const carCols = [0xf2c00f, 0xf2c00f, 0xf2c00f, 0x1d1f24, 0xe9e9e9, 0x8a1a1a, 0x2a4d8a, 0x6c6f75, 0x234a2f, 0xb0b3b8];
  for (const L of lanes) {
    L.sp = sr(9, 15); L.len = (L.ax === 'z' ? CD : CW) + 20;
    const n = L.ax === 'z' ? 3 + Math.floor(srand() * 3) : 1 + Math.floor(srand() * 2);
    for (let k = 0; k < n; k++) cars.push({ L, s: (k / n) * L.len + sr(0, L.len / n * 0.4), col: carCols[Math.floor(srand() * carCols.length)] });
  }
  const G2 = carGeometries();
  // lakier: gladki i metaliczny, zeby odbijal niebo
  carBody = new THREE.InstancedMesh(G2.body, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.22, metalness: 0.55 }), cars.length);
  carGlass = new THREE.InstancedMesh(G2.glass, new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.05, metalness: 0.6 }), cars.length);
  carWheel = new THREE.InstancedMesh(G2.wheels, new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.85 }), cars.length);
  carSign = new THREE.InstancedMesh(G2.sign, new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe7a0, emissiveIntensity: 0.6 }), cars.length);
  cars.forEach((c, i) => { carBody.setColorAt(i, _c.setHex(c.col)); c.taxi = c.col === 0xf2c00f; });
  for (const m of [carBody, carGlass, carWheel, carSign]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; scene.add(m); }
  headL = glowPoints(new Array(cars.length * 3).fill(0), 0xfff2d0, 2.6);
  tailL = glowPoints(new Array(cars.length * 3).fill(0), 0xff2020, 1.8);

  // przechodnie: prawdziwe sylwetki, dwie klatki kroku; kolory ubran i skory na osobe
  const skins = [0xe0b394, 0xc68e6a, 0x8d5a3b, 0xf1c9a5, 0x5e3a24, 0xb07a55];
  const tops = [0xc0392b, 0x2e86de, 0xf5f5f5, 0x222222, 0x27ae60, 0xf1c40f, 0x8e44ad, 0x7f8c8d, 0xd35400, 0x3b4b5c, 0xe8d8c0];
  const bots = [0x27344f, 0x1e2533, 0x3b3f4a, 0x2b2b2b, 0x4a4032, 0x5c4a3a, 0x1c1c1c];
  const lin = hex => new THREE.Color(hex).convertSRGBToLinear();
  for (let n = 0; n < 260; n++) {
    let i, j; do { i = Math.floor(srand() * NX); j = Math.floor(srand() * NZ); } while (isPark(i, j));
    const b = blk(i, j), side = Math.floor(srand() * 4);
    const p = side < 2
      ? { ax: 'x', c: side ? b.z1 - 2 : b.z0 + 2, s0: b.x0 + 1, s1: b.x1 - 1 }
      : { ax: 'z', c: side === 3 ? b.x1 - 2 : b.x0 + 2, s0: b.z0 + 1, s1: b.z1 - 1 };
    p.s = sr(p.s0, p.s1); p.sp = sr(1, 1.6) * (srand() < 0.5 ? 1 : -1); p.ph = sr(0, 6); p.flee = 0;
    p.cols = [lin(tops[Math.floor(srand() * tops.length)]), lin(bots[Math.floor(srand() * bots.length)]), lin(skins[Math.floor(srand() * skins.length)])];
    p.sc = sr(0.92, 1.06);
    peds.push(p);
  }
  const frames = pedGeometries(), face = pedFaceTexture(), mats = [0.85, 0.8, 0.6, 0.65].map((r, q) => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: r, map: q === 3 ? face : null }));
  mats.forEach(m => { m.userData.lin = true; });
  pedMesh = frames.map(f => ['top', 'bot', 'hand', 'head'].map((k, q) => {
    const m = new THREE.InstancedMesh(f[k], mats[q], peds.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = true;
    m.setColorAt(0, _c.setRGB(1, 1, 1)); m.userData.linIC = true; m.count = 0; scene.add(m); return m;
  }));
}
// ---------------------------------------------------------------- para z kominow i golebie
let steam = null, birds = null;
const BIRD_N = 70, birdData = [];
function initLife() {
  const sc = cv(64, 64), sx = sc.getContext('2d'), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
  sg.addColorStop(0, 'rgba(255,255,255,.55)'); sg.addColorStop(0.6, 'rgba(255,255,255,.2)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 64);
  const N = Math.max(1, ventList.length) * 10, pos = new Float32Array(N * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  steam = { N, pos, age: new Float32Array(N).map((_, i) => (i % 10) * 0.35), pts: new THREE.Points(g, new THREE.PointsMaterial({ map: canvasTex(sc), size: 4.5, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, color: 0xe8ecf0 })) };
  steam.pts.frustumCulled = false; scene.add(steam.pts);
  // golebie: trojkatne skrzydla, krazace nad kwartalami
  const wg = new THREE.BufferGeometry();
  wg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.12, 0.45, 0.05, -0.08, 0, 0, -0.14, 0, 0, 0.12, -0.45, 0.05, -0.08, 0, 0, -0.14, 0, 0, 0.12, 0.02, 0, -0.14, -0.02, 0, -0.14], 3)); wg.computeVertexNormals();
  birds = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.9, side: THREE.DoubleSide }), BIRD_N);
  for (let i = 0; i < BIRD_N; i++) { const gi = Math.floor(i / 7); const r = srand; birdData.push({ cx: X0 + 40 + ((gi * 97) % 600) , cz: Z0 + 60 + ((gi * 173) % 1050), r: 22 + srand() * 30, h: 45 + srand() * 90, w: 0.35 + srand() * 0.25, ph: srand() * 6.28, fl: 8 + srand() * 4 }); }
  birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage); birds.frustumCulled = false; scene.add(birds);
}
const _bo = new THREE.Object3D();
function updateLife(dt) {
  if (!steam) return;
  const t = G.time;
  ventList.forEach((v, vi) => {
    for (let k = 0; k < 10; k++) {
      const i = vi * 10 + k; steam.age[i] += dt; if (steam.age[i] > 3.5) steam.age[i] -= 3.5;
      const a = steam.age[i], dx = Math.sin(i * 12.9 + a * 1.3) * 0.25 * a, dz = Math.cos(i * 7.7 + a * 1.1) * 0.25 * a;
      steam.pos[i * 3] = v.x + dx + a * 0.25; steam.pos[i * 3 + 1] = 1.5 + a * 1.9; steam.pos[i * 3 + 2] = v.z + dz;
    }
  });
  steam.pts.geometry.attributes.position.needsUpdate = true;
  birdData.forEach((b, i) => {
    const a = t * b.w + b.ph, x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r, y = b.h + Math.sin(a * 2.3) * 4;
    _bo.position.set(x, y, z); _bo.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2 * 0, Math.sin(t * b.fl + i) * 0.5);
    _bo.rotation.y = Math.atan2(-Math.sin(a) * b.r, Math.cos(a) * b.r) ; _bo.scale.set(1, 1, 1); _bo.updateMatrix(); birds.setMatrixAt(i, _bo.matrix);
  });
  birds.instanceMatrix.needsUpdate = true;
}
// przechodnie uciekaja przed strzalami
export function scarePeds(x, z, r = 45) {
  for (const p of peds) {
    const px = p.ax === 'x' ? p.s : p.c, pz = p.ax === 'x' ? p.c : p.s;
    if (Math.abs(px - x) < r && Math.abs(pz - z) < r) {
      p.flee = 6; const away = p.ax === 'x' ? Math.sign(px - x) : Math.sign(pz - z);
      p.sp = (away || 1) * 4.5;
    }
  }
}
export function updateTraffic(dt) {
  updateLife(dt);
  const hp = headL.geometry.attributes.position, tp = tailL.geometry.attributes.position;
  cars.forEach((c, i) => {
    const L = c.L;
    c.s = ((c.s + L.sp * dt * L.dir) % L.len + L.len) % L.len;
    let x, z, yaw, fx, fz;
    if (L.ax === 'z') { x = L.c; z = Z0 - 10 + c.s; yaw = L.dir > 0 ? 0 : Math.PI; fx = 0; fz = L.dir; }
    else { z = L.c; x = X0 - 10 + c.s; yaw = L.dir > 0 ? Math.PI / 2 : -Math.PI / 2; fx = L.dir; fz = 0; }
    const hide = inPark(x, z);
    _o.position.set(x, 0, z); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(hide ? 0.0001 : 1); _o.updateMatrix();
    carBody.setMatrixAt(i, _o.matrix); carGlass.setMatrixAt(i, _o.matrix); carWheel.setMatrixAt(i, _o.matrix);
    if (!c.taxi) { _o.scale.setScalar(0.0001); _o.updateMatrix(); }
    carSign.setMatrixAt(i, _o.matrix);
    const hy = hide ? -99 : 0.72;
    hp.setXYZ(i, x + fx * 2.3, hy, z + fz * 2.3); tp.setXYZ(i, x - fx * 2.3, hy, z - fz * 2.3);
  });
  carBody.instanceMatrix.needsUpdate = carGlass.instanceMatrix.needsUpdate = carWheel.instanceMatrix.needsUpdate = carSign.instanceMatrix.needsUpdate = true;
  hp.needsUpdate = tp.needsUpdate = true;
  // przechodnie blisko kamery; kazdy w jednej z dwoch klatek kroku
  const cnt = [0, 0], cxp = camera.position.x, czp = camera.position.z;
  for (const p of peds) {
    if (p.flee > 0) { p.flee -= dt; if (p.flee <= 0) p.sp = Math.sign(p.sp) * sr(1, 1.6); }
    p.s += p.sp * dt; if (p.s > p.s1 || p.s < p.s0) { p.sp = -p.sp; p.s = clamp(p.s, p.s0, p.s1); }
    p.ph += dt * Math.abs(p.sp) * 3.2;
    const x = p.ax === 'x' ? p.s : p.c, z = p.ax === 'x' ? p.c : p.s;
    if (dbg('noped') || Math.abs(x - cxp) > 120 || Math.abs(z - czp) > 120 || cnt[0] + cnt[1] >= 80) continue;
    const f = Math.floor(p.ph / Math.PI) % 2, k = cnt[f]++;
    const yaw = p.ax === 'x' ? (p.sp > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.sp > 0 ? 0 : Math.PI);
    _o.position.set(x, SW + Math.abs(Math.sin(p.ph)) * 0.03, z); _o.rotation.set(0, yaw, 0); _o.scale.setScalar(p.sc); _o.updateMatrix();
    for (let q = 0; q < 4; q++) { pedMesh[f][q].setMatrixAt(k, _o.matrix); pedMesh[f][q].setColorAt(k, p.cols[Math.min(q, 2)]); }
  }
  for (let f = 0; f < 2; f++) for (const m of pedMesh[f]) { m.count = cnt[f]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
