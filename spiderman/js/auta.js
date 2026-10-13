// auta.js - modele pojazdow ulicznych (nadwozia z gladkiego lofta, nadkola, opony, felgi, lampy, tablice NY)
// Zwraca listy czesci [geometria, kolor sRGB, rodzaj powierzchni, maska lakieru] - skleja je tpl() z ulica.js.
// Uklad: przod pojazdu = +z, lewo/prawo = +-x, y w gore. Lakier (maska 1) jest barwiony kolorem instancji.
const V3 = THREE.Vector3, PI = Math.PI;
const sg = Math.sign;

// ---------------------------------------------------------------- krzywa monotoniczna (bez przeregulowan)
function curve(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0]), n = p.length, h = [], d = [], m = [];
  for (let i = 0; i < n - 1; i++) { h[i] = p[i + 1][0] - p[i][0]; d[i] = (p[i + 1][1] - p[i][1]) / h[i]; }
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= p[0][0]) return p[0][1]; if (x >= p[n - 1][0]) return p[n - 1][1];
    let i = 0; while (x > p[i + 1][0]) i++;
    const t = (x - p[i][0]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p[i][1] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * p[i + 1][1] + (t3 - t2) * h[i] * m[i + 1];
  };
}
// ---------------------------------------------------------------- loft z pierscieni (przekroj: nadelipsa, zwezenie gory)
function loftRings(R, segs) {
  const pos = [], idx = [], S = segs + 1;
  for (const r of R) for (let i = 0; i <= segs; i++) {
    const a = i / segs * PI * 2, c = Math.cos(a), s = Math.sin(a), e = 2 / r.n;
    const ex = sg(c) * Math.pow(Math.abs(c), e), ey = sg(s) * Math.pow(Math.abs(s), e), u = (ey + 1) / 2;
    pos.push(r.hw * ex * (1 - (1 - r.tw) * Math.pow(u, 1.6)), r.yb + (r.yt - r.yb) * u, r.z);
  }
  for (let k = 0; k < R.length - 1; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, b = a + 1, c = b + S, d = a + S; idx.push(a, b, c, a, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  const nn = g.attributes.normal; // szew (kat 0 = kat 2pi): usrednij normalne, zeby nie bylo krawedzi
  for (let k = 0; k < R.length; k++) { const a = k * S, b = k * S + segs; const x = nn.getX(a) + nn.getX(b), y = nn.getY(a) + nn.getY(b), z = nn.getZ(a) + nn.getZ(b), l = Math.hypot(x, y, z) || 1; nn.setXYZ(a, x / l, y / l, z / l); nn.setXYZ(b, x / l, y / l, z / l); }
  return g;
}
// nadwozie: S = { zr, zf, W, yb, top:[[z,y]..], wid?, n, tw, er }
function prep(S) {
  S.n = S.n || 3.4; S.tw = S.tw || 0.93; S.er = S.er || 0.3; S.hf = curve(S.top);
  S.wf = curve(S.wid || [[S.zr, 0.94], [S.zr + 0.6, 1], [S.zf - 0.6, 1], [S.zf, 0.94]]);
  return S;
}
function hullGeo(S, N = 16, segs = 14) {
  prep(S); const R = [];
  for (let i = 0; i <= N; i++) {
    const t = 0.5 - 0.5 * Math.cos(PI * i / N), z = S.zr + (S.zf - S.zr) * t;
    let hw = S.W * S.wf(z), yb = S.yb, yt = S.hf(z); const d = Math.min(z - S.zr, S.zf - z);
    if (d < S.er) { const s = d / S.er, f = Math.sqrt(Math.max(0, 1 - (1 - s) * (1 - s))); hw = Math.max(0.02, hw * f); const m = (yb + yt) / 2, hh = (yt - yb) / 2 * (0.45 + 0.55 * f); yb = m - hh; yt = m + hh; }
    R.push({ z, hw, yb, yt, n: S.n, tw: S.tw });
  }
  return loftRings(R, segs);
}
// polozenie bocznej powierzchni nadwozia (x>0) na wysokosci y w punkcie z
function sideX(S, z, y) {
  const yt = S.hf(z), u = Math.min(0.97, Math.max(0.03, (y - S.yb) / Math.max(0.01, yt - S.yb))), ey = 2 * u - 1;
  return S.W * S.wf(z) * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(ey), S.n)), 1 / S.n) * (1 - (1 - S.tw) * Math.pow(u, 1.6));
}
// z powierzchni nosa/tylu dla danego x
function noseZ(S, x, front) {
  const t = Math.min(0.985, Math.abs(x) / (S.W * S.wf(front > 0 ? S.zf : S.zr))), d = S.er * (1 - Math.sqrt(1 - t * t));
  return front > 0 ? S.zf - d : S.zr + d;
}
// ---------------------------------------------------------------- drobne ksztalty
const B = (w, h, d, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const Cy = (r0, r1, h, x = 0, y = 0, z = 0, seg = 8) => new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y, z);
const CyZ = (r, h, x, y, z, seg = 8) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(PI / 2).translate(x, y, z); // walec wzdluz z
const CyX = (r, h, x, y, z, seg = 10) => new THREE.CylinderGeometry(r, r, h, seg).rotateZ(PI / 2).translate(x, y, z); // walec wzdluz x
const El = (sx, sy, sz, x, y, z, ws = 8, hs = 6) => new THREE.SphereGeometry(1, ws, hs).scale(sx, sy, sz).translate(x, y, z);
function beam(a, b, r, seg = 5) {
  const d = new V3().subVectors(b, a), len = d.length(), g = new THREE.CylinderGeometry(r, r, len, seg);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize())));
  const m = a.clone().add(b).multiplyScalar(0.5); return g.translate(m.x, m.y, m.z);
}
const P3 = (x, y, z) => new V3(x, y, z);
const shadowQ = (w, l, z = 0) => [new THREE.PlaneGeometry(w, l).rotateX(-PI / 2).translate(0, 0.035, z), 0x000000, 'r'];
// plaszczyzna na boku nadwozia (s = +-1), w wzdluz z, h wzdluz y
const sideP = (S, s, z, y, w, h, off = 0.004) => new THREE.PlaneGeometry(w, h).rotateY(s * PI / 2).translate(s * (sideX(S, z, y) + off), y, z);
// plaszczyzna pochylona miedzy punktami A i B (x=0 srodek), szerokosc w
function slantP(w, A, B, off = 0.012) {
  const th = Math.atan2(B.z - A.z, B.y - A.y), len = Math.hypot(B.z - A.z, B.y - A.y), g = new THREE.PlaneGeometry(w, len).rotateX(th);
  const nx = 0, ny = -Math.sin(th), nz = Math.cos(th);
  return g.translate(0, (A.y + B.y) / 2 + ny * off, (A.z + B.z) / 2 + nz * off);
}
// rurka wzdluz noska/tylu (zderzak, grill)
function noseTube(S, front, y, hwf, rad, off = 0, seg = 6, rs = 4) {
  const pts = [], K = 6; for (let i = 0; i <= K; i++) { const x = (i / K * 2 - 1) * S.W * hwf; pts.push(P3(x, y, noseZ(S, x, front) + front * off)); }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, rad, rs, false);
}
// lampa: splaszczony elipsoid dopasowany do krzywizny noska (front: +1 przod, -1 tyl)
function lampG(S, front, s, xf, y, w, h, d = 0.05) {
  const x = s * S.W * xf, z = noseZ(S, x, front) - front * 0.012;
  return new THREE.SphereGeometry(1, 6, 4).scale(w, h, d).rotateY(front > 0 ? s * 0.42 : -s * 0.42).translate(x, y, z);
}
// tablica rejestracyjna NY (zolto-niebieska): plansza + niebieski pasek + ciemne znaki
function plate(p, S, front, y) {
  const z = noseZ(S, 0.22, front) * 1 + front * 0.03, rot = front > 0 ? 0 : PI;
  const g = (w, h, x, yy, dz) => new THREE.PlaneGeometry(w, h).rotateY(rot).translate(x * (front > 0 ? 1 : -1), yy, z + front * dz);
  p.push([g(0.52, 0.26, 0, y, 0), 0xf0cf4a, 'pl'], [g(0.52, 0.06, 0, y + 0.1, 0.003), 0x1c3f94, 'pl'], [g(0.18, 0.09, -0.12, y - 0.03, 0.003), 0x1b1b1b, 'pl'], [g(0.18, 0.09, 0.12, y - 0.03, 0.003), 0x1b1b1b, 'pl']);
}
// pismo blokowe z prostokatow (siatka 3x5), litery NYPD itp.; kierunek czytania w lokalnym x
const GLY = {
  N: [[0.5, 2.5, 1, 5], [2.5, 2.5, 1, 5], [1.5, 2.5, 0.8, 5.5, 0.4]],
  Y: [[0.9, 3.7, 0.8, 2.8, 0.5], [2.1, 3.7, 0.8, 2.8, -0.5], [1.5, 1.2, 1, 2.5]],
  P: [[0.5, 2.5, 1, 5], [1.9, 4.5, 1.8, 0.9], [1.9, 2.4, 1.8, 0.9], [2.6, 3.5, 0.8, 2.2]],
  D: [[0.5, 2.5, 1, 5], [1.7, 4.55, 1.4, 0.9], [1.7, 0.45, 1.4, 0.9], [2.55, 2.5, 0.9, 3.6]],
  A: [[0.8, 2.3, 0.8, 5.4, -0.22], [2.2, 2.3, 0.8, 5.4, 0.22], [1.5, 1.8, 1.4, 0.8]], X: [[1.5, 2.5, 0.8, 5.4, 0.4], [1.5, 2.5, 0.8, 5.4, -0.4]],
  E: [[0.5, 2.5, 1, 5], [1.8, 4.55, 2, 0.9], [1.8, 2.5, 1.6, 0.9], [1.8, 0.45, 2, 0.9]],
  F: [[0.5, 2.5, 1, 5], [1.8, 4.55, 2, 0.9], [1.8, 2.5, 1.6, 0.9]],
  I: [[1.5, 2.5, 1, 5]], R: [[0.5, 2.5, 1, 5], [1.9, 4.5, 1.8, 0.9], [1.9, 2.5, 1.8, 0.9], [2.6, 3.6, 0.8, 2.2], [2.1, 1.0, 0.8, 2.6, 0.45]],
  C: [[0.5, 2.5, 1, 5], [1.8, 4.55, 2, 0.9], [1.8, 0.45, 2, 0.9]],
  O: [[0.5, 2.5, 1, 5], [2.5, 2.5, 1, 5], [1.5, 4.55, 1.4, 0.9], [1.5, 0.45, 1.4, 0.9]],
  L: [[0.5, 2.5, 1, 5], [1.8, 0.45, 2, 0.9]], T: [[1.5, 4.55, 3, 0.9], [1.5, 2, 1, 4]],
  U: [[0.5, 2.5, 1, 5], [2.5, 2.5, 1, 5], [1.5, 0.45, 1.4, 0.9]], S: [[1.5, 4.55, 3, 0.9], [1.5, 2.5, 3, 0.9], [1.5, 0.45, 3, 0.9], [0.5, 3.5, 0.9, 2], [2.5, 1.5, 0.9, 2]],
  B: [[0.5, 2.5, 1, 5], [1.9, 4.55, 1.8, 0.9], [1.9, 2.5, 1.8, 0.9], [1.9, 0.45, 1.8, 0.9], [2.6, 3.5, 0.8, 1.9], [2.6, 1.5, 0.8, 1.9]],
  Z: [[1.5, 4.55, 3, 0.9], [1.5, 0.45, 3, 0.9], [1.5, 2.5, 0.9, 5.2, 0.55]], ' ': [],
};
function textP(p, str, s, side, X, Y, Z, hex, k = 'pl') { // s = skala (m na komorke); side +-1; Z = poczatek tekstu
  let ox = 0;
  for (const ch of str) {
    for (const [cx, cy, w, h, rot = 0] of GLY[ch] || []) p.push([new THREE.PlaneGeometry(w * s, h * s).rotateZ(rot).translate((ox + cx) * s, (cy - 2.5) * s, 0).rotateY(side * PI / 2).translate(side * X, Y, Z), hex, k]);
    ox += 3.8;
  }
}
// ---------------------------------------------------------------- kolo: opona z bieznikiem, felga z szprychami, nadkole z wneka i obrzezem
function wheel(p, S, s, z, r, w, rimHex = 0xb9bec4, spokes = 5, well = true, xo) {
  xo = xo ?? sideX(S, z, (S.yb + S.hf(z)) / 2);
  const xc = s * (xo - w / 2 + 0.03), rot = s * PI / 2;
  const pr = [[0.99, -0.12], [1.0, 0.2], [0.985, 0.37], [0.9, 0.5], [0.6, 0.5]].map(([a, b]) => new THREE.Vector2(r * a, w * b));
  p.push([new THREE.LatheGeometry(pr, 12).rotateZ(-rot).translate(xc, r, z), 0x161617, 'r']);
  const fx = xc + s * w * 0.5, at = (g, dz = 0) => g.translate(0, 0, dz).rotateY(rot).translate(fx, r, z);
  p.push([at(new THREE.CircleGeometry(r * 0.62, 9)), 0x222427, 'mt']);
  p.push([at(new THREE.RingGeometry(r * 0.55, r * 0.63, 9), 0.004), rimHex, 'ch']);
  for (let k = 0; k < spokes; k++) p.push([at(new THREE.PlaneGeometry(r * 0.15, r * 0.56).translate(0, r * 0.29, 0).rotateZ(k / spokes * PI * 2), 0.006), rimHex, 'ch']);
  p.push([at(new THREE.CircleGeometry(r * 0.14, 5), 0.01), 0x5a5e63, 'mt']);
  if (well) {
    const wx = s * (xo + 0.004);
    p.push([new THREE.CircleGeometry(r * 1.2, 10, 0, PI).rotateY(rot).translate(wx, r, z), 0x08090a, 'r']);
    p.push([new THREE.RingGeometry(r * 1.17, r * 1.3, 10, 1, 0, PI).rotateY(rot).translate(wx + s * 0.006, r, z), 0xffffff, 'car', 1]);
  }
}
// ---------------------------------------------------------------- samochod osobowy
function car(P) {
  const S = prep({ zr: P.zr, zf: P.zf, W: P.W, yb: P.yb, top: P.top, n: P.n || 3.4, tw: P.tw || 0.93, er: P.er || 0.3 });
  const p = [shadowQ(P.W * 2.3, (P.zf - P.zr) * 1.08)];
  const { W } = S, belt = P.belt, roof = curve(P.roof), hb = P.hb ?? 0;
  p.push([hullGeo(S, 13, 12), P.fixed ?? 0xffffff, 'car', P.fixed ? 0 : 1]);
  p.push([B(W * 1.7, 0.07, (P.zf - P.zr) * 0.9, 0, P.yb + 0.01, (P.zf + P.zr) / 2), 0x0b0b0c, 'r']);
  // szyby i dach
  const rk = P.roof, z0 = Math.min(...rk.map(a => a[0])), z1 = Math.max(...rk.map(a => a[0])), gw = P.gw || 0.87;
  const Rg = [], NG = 8;
  for (let i = 0; i <= NG; i++) { const z = z0 + (z1 - z0) * (0.5 - 0.5 * Math.cos(PI * i / NG)); Rg.push({ z, hw: W * gw, yb: belt - 0.03, yt: Math.max(belt - 0.005, roof(z)), n: 3.2, tw: 0.84 }); }
  p.push([loftRings(Rg, 10), 0x0c1218, 'gl']);
  const Rr = [], [ra, rb] = P.rz;
  for (let i = 0; i <= 4; i++) { const z = ra + (rb - ra) * (0.5 - 0.5 * Math.cos(PI * i / 4)), e = i === 0 || i === 4 ? 0.6 : 1, y = roof(z); Rr.push({ z, hw: W * gw * 0.93 * e, yb: y - 0.05, yt: y + 0.014, n: 4, tw: 0.86 }); }
  p.push([loftRings(Rr, 8), P.fixed ?? 0xffffff, 'car', P.fixed ? 0 : 1]);
  const wsz = z1, rbz = z0, hwAt = y => W * gw * (1 - 0.14 * Math.pow(Math.min(1, (y - belt) / 0.45), 1.6));
  const pil = (za, zb) => { const ya = Math.max(belt, roof(za)), yb2 = Math.max(belt, roof(zb)); return [P3(1, ya, za), P3(1, yb2, zb)]; };
  const bzs = P.bzs || [P.bz];
  for (const s of [-1, 1]) {
    p.push([beam(P3(s * hwAt(belt) * 0.93, belt, wsz - 0.02), P3(s * hwAt(roof(rb)) * 0.9, roof(rb) - 0.02, rb), 0.03), P.fixed ?? 0xffffff, 'car', P.fixed ? 0 : 1]);
    for (const bz of bzs) p.push([beam(P3(s * hwAt(belt) * 0.98, belt, bz), P3(s * hwAt(roof(bz)) * 0.97, roof(bz) - 0.03, bz), 0.03), 0x101113, 'pl']);
    p.push([beam(P3(s * hwAt(belt) * 0.97, belt, rbz + 0.03), P3(s * hwAt(roof(ra)) * 0.93, roof(ra) - 0.04, ra - 0.05), 0.036, 5), P.fixed ?? 0xffffff, 'car', P.fixed ? 0 : 1]);
  }
  // koła, nadkola
  const ws = P.wheels, rr = P.r, ww = P.ww;
  for (const s of [-1, 1]) for (const z of ws) wheel(p, S, s, z, rr, ww, P.rim);
  // przod: zderzak, grill z logo, reflektory, kierunkowskazy, tablica
  const hy = P.hy, ty = P.ty, by = P.yb + 0.13;
  p.push([noseTube(S, 1, by, 0.9, 0.07, -0.01), P.bumper ?? 0x1c1d20, 'pl'], [noseTube(S, -1, by + 0.02, 0.9, 0.07, -0.01), P.bumper ?? 0x1c1d20, 'pl']);
  p.push([noseTube(S, 1, hy - 0.03, 0.4, 0.06, 0.0, 5, 3), 0x0e0f11, 'pl'], [noseTube(S, 1, hy + 0.01, 0.38, 0.012, 0.045, 4, 3), 0xc7ccd1, 'ch'], [noseTube(S, 1, hy - 0.07, 0.38, 0.012, 0.045, 4, 3), 0xc7ccd1, 'ch']);
  p.push([CyZ(0.04, 0.012, 0, hy - 0.03, S.zf + 0.052, 6), 0xd5d9dd, 'ch']);
  for (const s of [-1, 1]) {
    p.push([lampG(S, 1, s, 0.74, hy, 0.17, 0.065, 0.06), 0x9aa0a6, 'ch'], [lampG(S, 1, s, 0.74, hy, 0.12, 0.042, 0.075).translate(0, 0, 0.01 * 0), 0xf8f8ee, 'head']);
    p.push([lampG(S, 1, s, 0.9, hy - 0.04, 0.05, 0.035, 0.05), 0xffa23a, 'pl']);
    p.push([lampG(S, -1, s, 0.74, ty, 0.2, 0.075, 0.06), 0x8a0c0c, 'tail'], [lampG(S, -1, s, 0.9, ty - 0.13, 0.06, 0.03, 0.05), 0xf2f2e8, 'pl']);
    p.push([CyZ(0.03, 0.1, s * W * 0.55, P.yb + 0.04, S.zr + 0.02, 5), 0x7d8288, 'ch']);
  }
  p.push([noseTube(S, -1, by + 0.1, 0.5, 0.045, 0.0, 6, 4), 0x0a0a0b, 'r']);
  plate(p, S, 1, by + 0.02); plate(p, S, -1, by + 0.14);
  // boki: szwy drzwi, klamki, lusterka, progi
  const dz = P.dz || [wsz - 0.1, ...bzs, rbz + 0.3];
  for (const s of [-1, 1]) {
    for (const z of dz) p.push([sideP(S, s, z, (P.yb + belt) / 2 + 0.1, 0.014, belt - P.yb - 0.32), 0x0d0d0f, 'pl']);
    p.push([sideP(S, s, (S.zf + S.zr) / 2, P.yb + 0.1, (S.zf - S.zr) * 0.62, 0.1), 0x15161a, 'pl']);
    for (const z of [...bzs, dz[dz.length - 1]]) p.push([sideP(S, s, z + 0.26, belt - 0.12, 0.13, 0.025, 0.012), 0xd6dadf, 'ch']);
    const mx = s * (W * gw + 0.04);
    p.push([El(0.045, 0.06, 0.09, mx + s * 0.05, belt + 0.1, wsz - 0.12, 6, 4), P.fixed ?? 0xffffff, 'car', P.fixed ? 0 : 1], [B(0.1, 0.02, 0.02, mx, belt + 0.03, wsz - 0.12), 0x15161a, 'pl']);
  }
  // wycieraczki, antena
  for (const s of [-1, 1]) p.push([B(0.52, 0.012, 0.02, s * 0.28, S.hf(wsz) + 0.015, wsz + 0.02).rotateY(s * 0.12), 0x0a0a0a, 'pl']);
  if (!P.noAnt) p.push([Cy(0.006, 0.004, 0.55, W * 0.5, S.hf(P.zr + 0.5) + 0.27, S.zr + 0.5, 4), 0x0a0a0a, 'pl']);
  return { p, S, wsz, roofY: roof((ra + rb) / 2), roofZ: (ra + rb) / 2, belt, bzs };
}
// ---------------------------------------------------------------- definicje klas osobowych
const CROWN = { zf: 2.73, zr: -2.73, W: 0.99, yb: 0.33, n: 3.4, tw: 0.93, belt: 1.0, hy: 0.76, ty: 0.9, r: 0.36, ww: 0.25, wheels: [1.5, -1.44], rim: 0xb9bec4,
  top: [[-2.73, 0.82], [-2.55, 0.97], [-2.1, 1.01], [-1, 1.0], [1, 1.0], [1.9, 0.97], [2.4, 0.92], [2.73, 0.76]],
  roof: [[1.15, 1.0], [0.8, 1.2], [0.3, 1.42], [-0.3, 1.49], [-1, 1.46], [-1.5, 1.3], [-2.0, 1.02]], rz: [-1.0, 0.3], bz: -0.4 };
const SEDAN = { zf: 2.42, zr: -2.42, W: 0.9, yb: 0.34, n: 3.4, tw: 0.93, belt: 0.96, hy: 0.68, ty: 0.84, r: 0.33, ww: 0.23, wheels: [1.4, -1.33], rim: 0xaeb4ba,
  top: [[-2.42, 0.8], [-2.25, 0.93], [-1.8, 0.97], [-0.9, 0.96], [0.9, 0.94], [1.7, 0.9], [2.15, 0.84], [2.42, 0.68]],
  roof: [[0.95, 0.95], [0.6, 1.17], [0.15, 1.38], [-0.5, 1.45], [-1, 1.42], [-1.45, 1.25], [-1.85, 0.97]], rz: [-0.9, 0.2], bz: -0.4 };
const HATCH = { zf: 2.25, zr: -2.25, W: 0.88, yb: 0.33, n: 3.4, tw: 0.92, belt: 0.94, hy: 0.66, ty: 0.82, r: 0.31, ww: 0.21, wheels: [1.35, -1.3], rim: 0xc5c9ce, noAnt: true,
  top: [[-2.25, 0.85], [-2.1, 0.93], [-1.8, 0.95], [-0.9, 0.95], [0.8, 0.93], [1.5, 0.87], [1.95, 0.8], [2.25, 0.64]],
  roof: [[0.8, 0.93], [0.45, 1.15], [0.05, 1.38], [-0.5, 1.47], [-1.2, 1.47], [-1.8, 1.3], [-2.2, 0.96]], rz: [-1.2, 0.0], bz: -0.45 };
const SUV = { zf: 2.6, zr: -2.6, W: 1.0, yb: 0.5, n: 4, tw: 0.95, belt: 1.13, hy: 0.92, ty: 1.0, r: 0.42, ww: 0.27, wheels: [1.55, -1.5], rim: 0x8f949a, er: 0.25,
  top: [[-2.6, 1.0], [-2.5, 1.14], [-1.5, 1.16], [1, 1.15], [1.9, 1.12], [2.35, 1.05], [2.6, 0.92]],
  roof: [[1.1, 1.12], [0.75, 1.45], [0.3, 1.8], [-0.3, 1.9], [-1.6, 1.9], [-2.3, 1.85], [-2.55, 1.3]], rz: [-2.2, 0.0], bzs: [-0.45, -1.55], gw: 0.9 };
const CROSS = { zf: 2.35, zr: -2.35, W: 0.93, yb: 0.4, n: 3.8, tw: 0.94, belt: 1.03, hy: 0.82, ty: 0.94, r: 0.37, ww: 0.24, wheels: [1.4, -1.35], rim: 0xb2b7bd, noAnt: true,
  top: [[-2.35, 0.95], [-2.2, 1.04], [-1, 1.05], [0.9, 1.05], [1.7, 1.0], [2.1, 0.92], [2.35, 0.78]],
  roof: [[0.95, 1.03], [0.55, 1.3], [0.1, 1.58], [-0.5, 1.64], [-1.5, 1.62], [-2.0, 1.5], [-2.3, 1.1]], rz: [-1.6, 0.0], bz: -0.5, gw: 0.88 };
const LIMO = { ...CROWN, zf: 3.6, zr: -3.6, wheels: [2.2, -2.15], top: [[-3.6, 0.82], [-3.4, 0.97], [-2.9, 1.01], [-1, 1.0], [1, 1.0], [2.7, 0.97], [3.1, 0.92], [3.6, 0.76]],
  roof: [[2.0, 1.0], [1.65, 1.18], [1.2, 1.34], [0.5, 1.4], [-2.4, 1.4], [-3.0, 1.3], [-3.3, 1.05]], rz: [-2.6, 0.9], bzs: [0.9, -0.3, -1.5, -2.5] };
const POLICE = { ...CROWN, fixed: 0xf2f4f6, bumper: 0x15171a, rim: 0xcfd3d8 };

// sygnalizacja: belka z dwoma polowkami (czerwona/niebieska albo czerwona/biala)
function lightBar(p, y, z, w, kR = 'sirR', kB = 'sirB', hexR = 0xff2a1a, hexB = 0x2a5bff) {
  p.push([B(w + 0.1, 0.035, 0.36, 0, y, z), 0x101114, 'pl']);
  p.push([B(w / 2, 0.1, 0.3, -w / 4, y + 0.065, z), hexR, kR], [B(w / 2, 0.1, 0.3, w / 4, y + 0.065, z), hexB, kB]);
  p.push([El(0.06, 0.05, 0.15, -w / 2, y + 0.06, z, 6, 4), 0x16171a, 'pl'], [El(0.06, 0.05, 0.15, w / 2, y + 0.06, z, 6, 4), 0x16171a, 'pl']);
}

// ---------------------------------------------------------------- pojazdy skrzyniowe: wspolne elementy
function mirrorsBig(p, S, y, z, x) { for (const s of [-1, 1]) p.push([B(0.1, 0.34, 0.2, s * (x + 0.08), y, z), 0x111214, 'pl'], [B(0.04, 0.04, 0.05 + 0, s * (x + 0.02), y, z), 0x111214, 'pl'], [beam(P3(s * x, y + 0.1, z), P3(s * (x + 0.08), y + 0.1, z), 0.015), 0x15161a, 'pl']); }
function frontEnd(p, S, hy, ty, by, lampW = 0.15, plateY) {
  p.push([noseTube(S, 1, by, 0.92, 0.09, -0.01), 0x1d1e21, 'pl'], [noseTube(S, -1, by, 0.92, 0.09, -0.01), 0x1d1e21, 'pl']);
  for (const s of [-1, 1]) {
    p.push([lampG(S, 1, s, 0.78, hy, lampW, 0.07, 0.06), 0x9aa0a6, 'ch'], [lampG(S, 1, s, 0.78, hy, lampW * 0.7, 0.045, 0.075), 0xf8f8ee, 'head'], [lampG(S, 1, s, 0.92, hy - 0.02, 0.04, 0.04, 0.05), 0xffa23a, 'pl']);
    p.push([lampG(S, -1, s, 0.86, ty, 0.07, 0.2, 0.06), 0x8a0c0c, 'tail']);
  }
  plate(p, S, 1, plateY ?? by + 0.04); plate(p, S, -1, plateY ?? by + 0.2);
}
function dualWheels(p, S, s, z, r, w, rim) { wheel(p, S, s, z, r, w, rim); const xo = sideX(S, z, (S.yb + S.hf(z)) / 2); wheel(p, S, s, z, r, w, rim, 5, false, xo - w * 0.95); }

export function vehParts(type) {
  const done = (p, hl) => ({ p, hl });
  // ---- osobowe
  const mk = (P, extra) => { const c = car(P); if (extra) extra(c.p, c, P); return done(c.p, P.zf); };
  switch (type) {
    case 'crown': return mk(CROWN);
    case 'taxi': return mk(CROWN, (p, c) => {
      const S = c.S, y = c.roofY;
      p.push([B(0.7, 0.05, 0.32, 0, y + 0.03, c.roofZ), 0x111111, 'pl'], [B(0.62, 0.22, 0.26, 0, y + 0.16, c.roofZ), 0xfff3c0, 'taxi'], [B(0.64, 0.04, 0.28, 0, y + 0.28, c.roofZ), 0x222222, 'pl']);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 13; k++) for (const r2 of [0, 1]) p.push([sideP(S, s, -1.35 + k * 0.17, 0.77 + r2 * 0.07, 0.17, 0.07, 0.006), (k + r2) % 2 ? 0x111111 : 0xf2f2f2, 'pl']);
        textP(p, 'TAXI', 0.028, s, sideX(S, 0.6, 0.54) + 0.006, 0.52, 0.6 + s * 0.24, 0x111111);
      }
    });
    case 'sedan': return mk(SEDAN);
    case 'hatch': return mk(HATCH);
    case 'suv': return mk(SUV, (p, c) => { // bagaznik dachowy + oslony nadkoli
      for (const s of [-1, 1]) p.push([B(0.04, 0.04, 2.2, s * 0.75, 1.96, -1.0), 0x1b1c1f, 'pl'], [B(0.05, 0.05, 0.08, s * 0.75, 1.93, -0.1), 0x1b1c1f, 'pl'], [B(0.05, 0.05, 0.08, s * 0.75, 1.93, -1.9), 0x1b1c1f, 'pl']);
    });
    case 'cross': return mk(CROSS);
    case 'limo': return mk(LIMO, (p, c, P) => { // dodatkowe szwy drzwi i kilka kolorowych diod w srodku
      for (const s of [-1, 1]) for (const z of [-0.9, -1.9]) p.push([sideP(c.S, s, z, 0.7, 0.014, 0.5), 0x0d0d0f, 'pl']);
    });
    case 'police': return mk(POLICE, (p, c) => {
      const S = c.S; lightBar(p, c.roofY + 0.04, c.roofZ + 0.05, 1.2);
      for (const s of [-1, 1]) {
        p.push([sideP(S, s, 0, 0.6, 4.3, 0.24, 0.006), 0x1d3f8f, 'pl']);
        textP(p, 'NYPD', 0.034, s, sideX(S, -0.3, 0.6) + 0.011, 0.6, -0.3 + s * 0.26, 0xf4f6f8);
      }
      p.push([B(0.2, 0.022, 0.05, -0.28, c.belt + 0.07, S.zf - 1.45), 0xff2a1a, 'sirR'], [B(0.2, 0.022, 0.05, 0.28, c.belt + 0.07, S.zf - 1.45), 0x2a5bff, 'sirB']);
      p.push([B(0.18, 0.02, 0.05, -0.3, c.belt + 0.07, S.zr + 0.82), 0xff2a1a, 'sirR'], [B(0.18, 0.02, 0.05, 0.3, c.belt + 0.07, S.zr + 0.82), 0x2a5bff, 'sirB']);
      p.push([sideP(S, 1, 0, 0.9, 4.3, 0.025, 0.006), 0xe8e8ea, 'pl'], [sideP(S, -1, 0, 0.9, 4.3, 0.025, 0.006), 0xe8e8ea, 'pl']);
    });
    case 'pizza': return mk(HATCH, (p, c) => {
      p.push([B(0.7, 0.05, 0.3, 0, c.roofY + 0.04, c.roofZ), 0x15161a, 'pl'], [B(0.64, 0.22, 0.14, 0, c.roofY + 0.19, c.roofZ), 0xffa53a, 'dest']);
      for (const s of [-1, 1]) p.push([sideP(c.S, s, -0.7, 0.78, 3.0, 0.1, 0.006), 0xd8261c, 'pl']);
    });
    case 'moto': return done(moto(), 1.05);
    case 'van': return done(van(), 3.0);
    case 'ambulance': return done(ambulance(), 3.0);
    case 'fire': return done(fire(), 4.8);
    case 'garbage': return done(garbage(), 4.2);
    case 'truck': return done(truck(), 3.7);
    case 'bus': return done(bus(), 6.15);
  }
  return null;
}

// ---------------------------------------------------------------- motocykl/skuter z kierowca
function moto() {
  const p = [shadowQ(1.0, 2.2)];
  const S = prep({ zr: -0.95, zf: 0.95, W: 0.2, yb: 0.3, top: [[-0.95, 0.5], [0, 0.62], [0.95, 0.5]], n: 2.4, tw: 0.9, er: 0.3 });
  p.push([El(0.17, 0.2, 0.62, 0, 0.52, -0.25, 10, 7), 0xffffff, 'car', 1], [El(0.14, 0.18, 0.34, 0, 0.78, 0.55, 8, 6), 0xffffff, 'car', 1]);
  p.push([B(0.28, 0.1, 0.62, 0, 0.74, -0.25), 0x16171a, 'pl'], [B(0.26, 0.06, 0.5, 0, 0.84, -0.2), 0x222326, 'pl']);
  for (const [z, ax] of [[0.7, 1], [-0.65, 1]]) { const r = 0.3; p.push([new THREE.LatheGeometry([[0.96, -0.1], [1, -0.06], [1, 0.06], [0.96, 0.1]].map(([a, b]) => new THREE.Vector2(r * a, b * 0.5 + 0)), 14).rotateZ(PI / 2).translate(0, r, z), 0x161617, 'r']); p.push([CyX(r * 0.62, 0.07, 0, r, z), 0xb9bec4, 'ch']); }
  p.push([beam(P3(0, 0.3, 0.7), P3(0, 1.0, 0.5), 0.022), 0xaeb3b8, 'ch'], [B(0.62, 0.03, 0.04, 0, 1.03, 0.5), 0x15161a, 'pl']);
  p.push([El(0.08, 0.08, 0.05, 0, 0.9, 0.6, 6, 4), 0xf8f8ee, 'head'], [El(0.07, 0.04, 0.03, 0, 0.78, -0.58, 6, 4), 0x8a0c0c, 'tail']);
  // kierowca: tulow, glowa w kasku, rece
  p.push([El(0.2, 0.3, 0.17, 0, 1.12, -0.18, 8, 6), 0x1c1e22, 'm'], [El(0.115, 0.125, 0.13, 0, 1.55, -0.1, 8, 6), 0xd23a2a, 'p'], [B(0.2, 0.055, 0.07, 0, 1.54, -0.0), 0x0b0f14, 'gl']);
  p.push([beam(P3(-0.19, 1.28, -0.14), P3(-0.28, 1.05, 0.5), 0.04), 0x1c1e22, 'm'], [beam(P3(0.19, 1.28, -0.14), P3(0.28, 1.05, 0.5), 0.04), 0x1c1e22, 'm']);
  p.push([beam(P3(-0.1, 0.9, -0.2), P3(-0.2, 0.45, 0.1), 0.06), 0x24262b, 'm'], [beam(P3(0.1, 0.9, -0.2), P3(0.2, 0.45, 0.1), 0.06), 0x24262b, 'm']);
  return p;
}
// ---------------------------------------------------------------- furgonetka dostawcza (typ UPS bez znakow), karetka, wozy specjalne
function van() {
  const S = prep({ zr: -2.9, zf: 2.9, W: 1.02, yb: 0.5, n: 6, tw: 0.97, er: 0.45,
    top: [[-2.9, 2.5], [-2.7, 2.62], [1.0, 2.62], [1.5, 2.55], [1.9, 2.3], [2.4, 1.95], [2.75, 1.55], [2.9, 1.25]] });
  const p = [shadowQ(2.4, 6.2)];
  p.push([hullGeo(S, 11, 12), 0xffffff, 'car', 1], [B(1.8, 0.08, 5.4, 0, 0.5, 0), 0x0b0b0c, 'r']);
  p.push([slantP(1.62, P3(0, S.hf(2.6) + 0.01, 2.6), P3(0, S.hf(1.55) - 0.12, 1.55)), 0x0b0f14, 'gl']);
  for (const s of [-1, 1]) {
    p.push([sideP(S, s, 2.0, 1.78, 1.0, 0.7, 0.006), 0x0b0f14, 'gl'], [sideP(S, s, 1.5, 1.2, 0.014, 1.9), 0x0d0d0f, 'pl'], [sideP(S, s, 2.62, 1.0, 0.014, 0.7), 0x0d0d0f, 'pl'], [sideP(S, s, -0.3, 1.45, 0.014, 2.0), 0x0d0d0f, 'pl'], [sideP(S, s, -2.0, 1.45, 0.014, 2.0), 0x0d0d0f, 'pl']);
    p.push([sideP(S, s, -0.3, 0.64, 4.0, 0.06, 0.006), 0xd7b24b, 'pl'], [sideP(S, s, 1.3, 1.25, 0.1, 0.03, 0.01), 0xd6dadf, 'ch']);
    wheel(p, S, s, 1.75, 0.42, 0.26, 0x9a9fa5); wheel(p, S, s, -1.55, 0.42, 0.26, 0x9a9fa5);
  }
  mirrorsBig(p, S, 1.95, 2.05, 1.15);
  frontEnd(p, S, 0.95, 1.2, 0.72, 0.15, 0.82); p.push([noseTube(S, 1, 1.0, 0.55, 0.07, -0.01, 6, 4), 0x0e0f11, 'pl']);
  for (let k = 0; k < 6; k++) p.push([new THREE.PlaneGeometry(2.0, 0.025).rotateY(PI).translate(0, 0.9 + k * 0.28, S.zr - 0.004), 0xc8cdd2, 'mt']);
  p.push([B(1.7, 0.03, 3.4, 0, 2.64, -0.9), 0xe9ecee, 'p'], [B(0.5, 0.06, 0.5, 0.0, 2.67, 0.5), 0xcfd3d8, 'mt']);
  return p;
}
function ambulance() {
  const S = prep({ zr: -3.0, zf: 3.0, W: 1.02, yb: 0.5, n: 5.5, tw: 0.97, er: 0.4,
    top: [[-3.0, 2.5], [-2.8, 2.65], [0.7, 2.65], [1.2, 2.5], [1.55, 2.0], [1.75, 1.34], [2.2, 1.28], [2.75, 1.15], [3.0, 0.95]] });
  const p = [shadowQ(2.4, 6.6)];
  p.push([hullGeo(S, 13, 12), 0xffffff, 'car', 1], [B(1.8, 0.08, 5.6, 0, 0.5, 0), 0x0b0b0c, 'r']);
  p.push([slantP(1.62, P3(0, 1.38, 1.7), P3(0, 2.4, 1.3)), 0x0b0f14, 'gl']);
  for (const s of [-1, 1]) {
    p.push([sideP(S, s, 1.1, 1.95, 0.55, 0.62, 0.006), 0x0b0f14, 'gl'], [sideP(S, s, 0.62, 1.4, 0.014, 2.0), 0x0d0d0f, 'pl'], [sideP(S, s, -1.0, 1.4, 0.014, 1.7), 0x0d0d0f, 'pl']);
    p.push([sideP(S, s, -0.6, 1.5, 3.6, 0.2, 0.006), 0xd8261c, 'pl'], [sideP(S, s, -0.6, 0.96, 3.6, 0.06, 0.006), 0xe8a21a, 'pl']);
    p.push([sideP(S, s, -1.5, 1.5, 0.5, 0.14, 0.01), 0xffffff, 'pl'], [sideP(S, s, -1.5, 1.5, 0.14, 0.5, 0.01), 0xffffff, 'pl']);
    wheel(p, S, s, 1.9, 0.42, 0.26, 0xb9bec4); wheel(p, S, s, -1.7, 0.42, 0.26, 0xb9bec4);
  }
  mirrorsBig(p, S, 1.9, 1.5, 1.15);
  frontEnd(p, S, 0.92, 1.5, 0.7, 0.15, 0.82); p.push([noseTube(S, 1, 0.98, 0.5, 0.07, -0.01, 6, 4), 0x0e0f11, 'pl']);
  lightBar(p, 2.66, 1.0, 1.55, 'sirR', 'sirW', 0xff2a1a, 0xf4f4ff);
  p.push([B(0.9, 0.12, 0.05, 0, 1.18, S.zf - 0.35), 0xff2a1a, 'sirR']);
  for (const s of [-1, 1]) p.push([B(0.1, 0.5, 0.04, s * 0.95, 1.9, S.zr + 0.0 - 0.004), 0xff2a1a, 'sirR'], [B(0.12, 0.12, 0.05, s * 0.4, 2.6, S.zr + 0.02), 0xf4f4ff, 'sirW']);
  return p;
}
function fire() {
  const cab = prep({ zr: 2.1, zf: 4.8, W: 1.1, yb: 0.6, n: 5, tw: 0.97, er: 0.4, top: [[2.1, 3.0], [3.2, 3.05], [4.1, 2.9], [4.55, 2.3], [4.8, 1.5]] });
  const bd = prep({ zr: -4.9, zf: 2.05, W: 1.2, yb: 0.75, n: 7, tw: 1, er: 0.1, top: [[-4.9, 2.75], [-4.5, 2.9], [2.05, 2.9]] });
  const p = [shadowQ(2.8, 9.9)];
  p.push([hullGeo(cab, 8, 12), 0xffffff, 'car', 1], [hullGeo(bd, 6, 12), 0xffffff, 'car', 1], [B(2.0, 0.3, 9.4, 0, 0.7, 0), 0x0d0d0e, 'r']);
  p.push([slantP(1.9, P3(0, 2.55, 4.6), P3(0, 2.95, 4.2)), 0x0b0f14, 'gl'], [slantP(1.9, P3(0, 2.4, 4.7), P3(0, 1.8, 4.78)), 0x0b0f14, 'gl']);
  for (const s of [-1, 1]) {
    p.push([sideP(cab, s, 3.6, 2.4, 1.3, 0.75, 0.006), 0x0b0f14, 'gl'], [sideP(cab, s, 2.9, 1.9, 0.014, 2.2), 0x0d0d0f, 'pl'], [sideP(cab, s, 4.2, 1.7, 0.014, 1.6), 0x0d0d0f, 'pl']);
    p.push([sideP(bd, s, -1.4, 1.5, 6.4, 0.07, 0.006), 0xf2f2f2, 'pl'], [sideP(bd, s, -1.4, 2.0, 6.4, 0.07, 0.006), 0xe7c23a, 'pl']);
    for (let k = 0; k < 3; k++) p.push([sideP(bd, s, -3.7 + k * 1.9, 1.75, 1.7, 1.55, 0.008), 0xb4b9be, 'mt'], [sideP(bd, s, -3.7 + k * 1.9, 1.75, 1.64, 1.48, 0.012), 0xc9ced3, 'mt']);
    wheel(p, cab, s, 3.4, 0.52, 0.3, 0xb9bec4); dualWheels(p, bd, s, -2.6, 0.52, 0.3, 0xb9bec4);
    p.push([beam(P3(s * 0.55, 3.0, -4.5), P3(s * 0.55, 3.0, 2.4), 0.04), 0xc9ced3, 'mt'], [beam(P3(s * 0.35, 3.0, -4.5), P3(s * 0.35, 3.0, 2.4), 0.04), 0xc9ced3, 'mt']);
  }
  for (let k = 0; k < 9; k++) p.push([B(0.5, 0.03, 0.03, 0, 3.0, -4.3 + k * 0.7), 0xc9ced3, 'mt']);
  mirrorsBig(p, cab, 2.15, 4.35, 1.2);
  frontEnd(p, cab, 1.05, 2.3, 0.82, 0.16, 0.95); p.push([noseTube(cab, 1, 1.1, 0.6, 0.08, -0.01, 6, 4), 0x0e0f11, 'pl']);
  lightBar(p, 3.08, 3.7, 1.6, 'sirR', 'sirW', 0xff2a1a, 0xf4f4ff);
  p.push([B(0.2, 0.1, 0.06, 0.85, 1.28, cab.zf - 0.1), 0xff2a1a, 'sirR'], [B(0.2, 0.1, 0.06, -0.85, 1.28, cab.zf - 0.1), 0xf4f4ff, 'sirW'], [B(0.1, 0.2, 0.04, 0.95, 2.2, bd.zr - 0.0), 0xff2a1a, 'sirR'], [B(0.1, 0.2, 0.04, -0.95, 2.2, bd.zr), 0xf4f4ff, 'sirW']);
  return p;
}
function garbage() {
  const cab = prep({ zr: 1.6, zf: 4.2, W: 1.05, yb: 0.65, n: 5, tw: 0.97, er: 0.4, top: [[1.6, 2.9], [2.6, 2.95], [3.4, 2.75], [3.9, 2.2], [4.2, 1.5]] });
  const bd = prep({ zr: -4.2, zf: 1.5, W: 1.2, yb: 0.85, n: 4.5, tw: 0.97, er: 0.35, top: [[-4.2, 2.1], [-3.8, 2.85], [-3.2, 3.3], [-1, 3.4], [1.5, 3.3]] });
  const p = [shadowQ(2.7, 8.8, 0)];
  p.push([hullGeo(cab, 8, 12), 0xf0f0ee, 'p'], [hullGeo(bd, 10, 12), 0xffffff, 'car', 1], [B(2.0, 0.3, 8.0, 0, 0.75, 0), 0x0d0d0e, 'r']);
  p.push([slantP(1.8, P3(0, 2.45, 3.9), P3(0, 2.85, 3.55)), 0x0b0f14, 'gl'], [slantP(1.8, P3(0, 2.4, 4.05), P3(0, 1.75, 4.17)), 0x0b0f14, 'gl']);
  for (const s of [-1, 1]) {
    p.push([sideP(cab, s, 3.0, 2.2, 1.0, 0.8, 0.006), 0x0b0f14, 'gl'], [sideP(cab, s, 2.4, 1.9, 0.014, 2.2), 0x0d0d0f, 'pl']);
    p.push([sideP(bd, s, -1.7, 3.0, 5.6, 0.07, 0.006), 0xf2f2f2, 'pl'], [sideP(bd, s, -2.7, 2.1, 0.5, 0.9, 0.006), 0x1a1c20, 'pl']);
    wheel(p, cab, s, 3.0, 0.5, 0.3, 0xb9bec4); dualWheels(p, bd, s, -1.9, 0.5, 0.3, 0xb9bec4);
  }
  p.push([B(1.9, 0.9, 0.7, 0, 1.2, -4.45), 0x1a1c20, 'r'], [B(2.2, 0.12, 0.5, 0, 0.88, -4.55), 0x1c1d20, 'pl'], [new THREE.PlaneGeometry(1.7, 1.0).rotateY(PI).translate(0, 2.45, bd.zr - 0.004), 0x2b2d31, 'm']);
  for (const s of [-1, 1]) p.push([B(0.2, 0.3, 0.06, s * 1.05, 0.95, bd.zr - 0.25), 0xe7c23a, 'pl'], [B(0.12, 0.3, 0.04, s * 0.95, 1.55, bd.zr - 0.0), 0x8a0c0c, 'tail']);
  mirrorsBig(p, cab, 2.1, 3.45, 1.15);
  frontEnd(p, cab, 1.0, 1.7, 0.8, 0.16, 0.9); p.push([noseTube(cab, 1, 1.05, 0.55, 0.08, -0.01, 6, 4), 0x0e0f11, 'pl']);
  p.push([B(0.8, 0.1, 0.25, 0, 3.0, 3.2), 0xe7a21a, 'taxi']);
  return p;
}
function truck() {
  const cab = prep({ zr: 1.3, zf: 3.65, W: 1.02, yb: 0.55, n: 5, tw: 0.96, er: 0.4, top: [[1.3, 2.55], [2.2, 2.6], [3.0, 2.45], [3.4, 2.0], [3.65, 1.3]] });
  const bx = prep({ zr: -3.7, zf: 1.2, W: 1.2, yb: 0.85, n: 8, tw: 1, er: 0.06, top: [[-3.7, 3.35], [1.2, 3.35]] });
  const p = [shadowQ(2.6, 7.6)];
  p.push([hullGeo(cab, 8, 12), 0xe9e9e6, 'p'], [hullGeo(bx, 5, 12), 0xf0f0ee, 'p'], [B(1.1, 0.4, 7.1, 0, 0.7, -0.05), 0x161616, 'r']);
  p.push([slantP(1.85, P3(0, 2.3, 3.45), P3(0, 2.62, 3.05)), 0x0b0f14, 'gl'], [slantP(1.85, P3(0, 2.3, 3.55), P3(0, 1.4, 3.64)), 0x0b0f14, 'gl']);
  for (const s of [-1, 1]) {
    p.push([sideP(cab, s, 2.55, 1.95, 0.95, 0.72, 0.006), 0x0b0f14, 'gl'], [sideP(cab, s, 2.0, 1.7, 0.014, 1.8), 0x0d0d0f, 'pl']);
    p.push([sideP(bx, s, -1.2, 1.2, 4.8, 0.3, 0.007), 0xffffff, 'car', 1]);
    wheel(p, cab, s, 2.55, 0.45, 0.24, 0x8a8f94); dualWheels(p, bx, s, -2.3, 0.45, 0.24, 0x8a8f94);
  }
  p.push([new THREE.PlaneGeometry(2.2, 2.3).rotateY(PI).translate(0, 2.2, bx.zr - 0.004), 0xd6d6d4, 'mt']);
  for (let k = 0; k < 9; k++) p.push([new THREE.PlaneGeometry(2.2, 0.03).rotateY(PI).translate(0, 1.15 + k * 0.25, bx.zr - 0.008), 0xbfc4c9, 'mt']);
  p.push([B(2.3, 0.15, 0.2, 0, 0.78, -3.8), 0x222222, 'pl']);
  for (const s of [-1, 1]) p.push([B(0.18, 0.3, 0.05, s * 1.0, 1.2, bx.zr - 0.03), 0x8a0c0c, 'tail']);
  mirrorsBig(p, cab, 2.1, 3.2, 1.1);
  frontEnd(p, cab, 0.95, 1.2, 0.74, 0.15, 0.84); p.push([noseTube(cab, 1, 1.0, 0.55, 0.07, -0.01, 6, 4), 0x0e0f11, 'pl']);
  return p;
}
// autobus MTA: bialy z niebieskim pasem, ciemne okna, pomaranczowa tablica kierunkowa
function bus() {
  const S = prep({ zr: -6.1, zf: 6.1, W: 1.3, yb: 0.38, n: 8, tw: 0.97, er: 0.45, top: [[-6.1, 3.0], [-5.9, 3.2], [5.9, 3.2], [6.1, 3.0]], wid: [[-6.1, 0.95], [-5.5, 1], [5.5, 1], [6.1, 0.95]] });
  const p = [shadowQ(2.9, 12.6)];
  p.push([hullGeo(S, 13, 12), 0xeef0f0, 'p'], [B(2.4, 0.7, 11.6, 0, 0.66, 0), 0x0d0d0d, 'r']);
  for (const s of [-1, 1]) {
    p.push([sideP(S, s, -0.2, 2.15, 11.0, 1.1, 0.006), 0x0b0f14, 'gl'], [sideP(S, s, -0.2, 1.15, 12.0, 0.5, 0.006), 0x1f57a8, 'p']);
    for (const z of [-3.5, -2.6, -1.4, -0.3, 0.9, 2.1, 3.0]) p.push([sideP(S, s, z, 2.15, 0.07, 1.1, 0.012), 0xdfe3e5, 'p']);
    p.push([sideP(S, s, 3.8, 1.2, 1.0, 1.95, 0.008), 0x0b0f14, 'gl'], [sideP(S, s, -2.5, 1.2, 1.0, 1.95, 0.008), 0x0b0f14, 'gl']);
    p.push([B(0.08, 0.38, 0.1, s * 1.48, 2.55, 5.95), 0x111111, 'pl'], [B(0.2, 0.04, 0.04, s * 1.38, 2.75, 6.0), 0x111111, 'pl']);
    wheel(p, S, s, 3.8, 0.5, 0.34, 0x9a9fa5, 6); wheel(p, S, s, -2.55, 0.5, 0.34, 0x9a9fa5, 6);
  }
  p.push([B(2.3, 1.55, 0.05, 0, 1.95, 6.11), 0x0b0f14, 'gl'], [B(1.9, 0.26, 0.05, 0, 2.93, 6.1), 0xffa500, 'dest'], [B(1.9, 0.6, 0.04, 0, 2.5, -6.12), 0x0b0f14, 'gl']);
  p.push([B(0.32, 0.16, 0.04, 0.95, 0.72, 6.13), 0xf5f5f0, 'head'], [B(0.32, 0.16, 0.04, -0.95, 0.72, 6.13), 0xf5f5f0, 'head'], [B(0.2, 0.5, 0.04, 1.05, 1.0, -6.12), 0x8a0c0c, 'tail'], [B(0.2, 0.5, 0.04, -1.05, 1.0, -6.12), 0x8a0c0c, 'tail']);
  p.push([B(2.5, 0.3, 0.2, 0, 0.5, 6.15), 0x1b1c1f, 'pl'], [B(2.5, 0.3, 0.2, 0, 0.5, -6.15), 0x1b1c1f, 'pl'], [B(1.7, 0.3, 3.2, 0, 3.33, -3.6), 0xd8dadb, 'p'], [B(1.2, 0.2, 1.6, 0, 3.28, 2.5), 0xd8dadb, 'p']);
  p.push([B(0.9, 0.5, 0.25, 0, 0.75, 6.32), 0x2a2a2a, 'mt']);
  plate(p, S, 1, 0.62);
  return p;
}
