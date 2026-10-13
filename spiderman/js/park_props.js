// Park: wyposazenie — lawki, latarnie, kosze, fontanna, mostek, plac zabaw, boisko, koce z ludzmi, zywoplot, rabaty, murki z bramami.
// Kazda funkcja dopisuje do scalonej geometrii Geo (kolor przez wierzcholki).
import { box, cyl, sph, slab, card, lc, T_LAMP, T_FLOWER, T_TUFT, T_LITTER, T_HEDGE, uvr } from './park_geo.js';

const loc = (x, z, rot, lx, lz) => { const cs = Math.cos(rot), sn = Math.sin(rot); return [x + lx * cs + lz * sn, z - lx * sn + lz * cs]; };
const C = {
  wood: lc(0x7a4e2a), woodL: lc(0x9a6a3a), iron: lc(0x20262a), green: lc(0x1f3a2c), stone: lc(0xb3ab9c), stoneD: lc(0x8f887b), stoneL: lc(0xc8c1b2),
  white: [1, 1, 1], skin: [0xf1c8a5, 0xd9a47c, 0xa8704a, 0x7a4a2e, 0xffdbb5].map(lc), hair: [0x2a1c12, 0x4a3020, 0x8a6a3a, 0xc8a050, 0x1a1a1a].map(lc),
};
const SHIRTS = [0xd94a3a, 0x3a6ad9, 0xf0c63a, 0x4aa86a, 0xf0f0f0, 0xd96aa8, 0x2a2a30, 0xe8883a, 0x7a4ad9].map(lc);
const PANTS = [0x2a3a5a, 0x3a3a3e, 0x6a5a3a, 0x1c1c20, 0x4a6a8a, 0x8a3a3a].map(lc);

export function bench(g, x, z, rot) {
  for (const lz of [-0.12, 0.02, 0.16]) { const p = loc(x, z, rot, 0, lz); box(g, p[0], 0.43, p[1], 1.8, 0.05, 0.12, rot, C.wood); }
  for (const y of [0.6, 0.72, 0.84]) { const p = loc(x, z, rot, 0, -0.25); box(g, p[0], y, p[1], 1.8, 0.09, 0.035, rot, C.wood); }
  for (const lx of [-0.8, 0.8]) { const p = loc(x, z, rot, lx, -0.03); box(g, p[0], 0, p[1], 0.06, 0.43, 0.5, rot, C.iron); const q = loc(x, z, rot, lx * 1.06, -0.25); box(g, q[0], 0.43, q[1], 0.06, 0.5, 0.06, rot, C.iron); const r = loc(x, z, rot, lx * 1.06, 0.05); box(g, r[0], 0.6, r[1], 0.06, 0.04, 0.5, rot, C.iron); }
}
export function bin(g, x, z) {
  cyl(g, x, 0, z, 0.26, 0.3, 0.8, 8, C.green, false); cyl(g, x, 0.8, z, 0.33, 0.33, 0.05, 8, C.iron, true);
  for (let i = 0; i < 3; i++) cyl(g, x, 0.14 + i * 0.28, z, 0.31, 0.31, 0.03, 8, C.iron, false);
}
export function lampPost(g, x, z) {
  cyl(g, x, 0, z, 0.24, 0.12, 0.6, 8, C.green, false); cyl(g, x, 0.6, z, 0.09, 0.06, 3.3, 6, C.green, false);
  cyl(g, x, 3.9, z, 0.2, 0.2, 0.07, 6, C.green, true); cyl(g, x, 3.97, z, 0.15, 0.17, 0.5, 6, [1, 1, 1], false, T_LAMP); cyl(g, x, 4.47, z, 0.24, 0.0, 0.22, 6, C.green, false); sph(g, x, 4.72, z, 0.05, 0.05, 0.05, 4, C.green);
  cyl(g, x, 2.3, z, 0.13, 0.11, 0.07, 6, C.green, true);
}
// lawka z siedzaca osoba (kolor koszuli itd. z generatora)
export function person(g, R, x, y, z, rot, pose) {
  const sh = R.pick(SHIRTS), pa = R.pick(PANTS), sk = R.pick(C.skin), hr = R.pick(C.hair);
  const P = (lx, lz) => loc(x, z, rot, lx, lz);
  if (pose === 'sit') { // siedzi: nogi do przodu (+z) nad siedziskiem
    let p = P(0, -0.05); box(g, p[0], y + 0.05, p[1], 0.36, 0.52, 0.2, rot, sh);
    p = P(0, 0.2); box(g, p[0], y + 0.02, p[1], 0.3, 0.14, 0.5, rot, pa);
    p = P(0, 0.42); box(g, p[0], y - 0.4, p[1], 0.3, 0.42, 0.14, rot, pa);
    p = P(0, -0.05); sph(g, p[0], y + 0.72, p[1], 0.11, 0.12, 0.11, 6, sk); sph(g, p[0], y + 0.76, p[1] - 0.015, 0.115, 0.1, 0.115, 6, hr);
    for (const s of [-1, 1]) { p = P(s * 0.22, 0.05); box(g, p[0], y + 0.12, p[1], 0.08, 0.1, 0.34, rot, sk); p = P(s * 0.22, -0.05); box(g, p[0], y + 0.3, p[1], 0.08, 0.26, 0.09, rot, sh); }
  } else if (pose === 'lie') { // lezy na kocu
    let p = P(0, 0); box(g, p[0], y, p[1], 0.34, 0.16, 0.5, rot, sh);
    p = P(0, 0.6); box(g, p[0], y, p[1], 0.3, 0.14, 0.7, rot, pa);
    p = P(0, -0.38); sph(g, p[0], y + 0.1, p[1], 0.11, 0.1, 0.12, 6, sk); sph(g, p[0], y + 0.12, p[1] - 0.02, 0.115, 0.08, 0.115, 6, hr);
  } else { // siedzi po turecku na ziemi
    let p = P(0, 0); box(g, p[0], y + 0.14, p[1], 0.36, 0.5, 0.22, rot, sh);
    p = P(0, 0.2); box(g, p[0], y, p[1], 0.5, 0.14, 0.34, rot, pa);
    p = P(0, 0); sph(g, p[0], y + 0.8, p[1], 0.11, 0.12, 0.11, 6, sk); sph(g, p[0], y + 0.85, p[1] - 0.015, 0.115, 0.1, 0.115, 6, hr);
    for (const s of [-1, 1]) { p = P(s * 0.25, 0.12); box(g, p[0], y + 0.1, p[1], 0.08, 0.08, 0.3, rot, sk); }
  }
}
export function picnic(g, R, x, z, rot) {
  const col = R.pick(SHIRTS), col2 = lc(0xf3efe2);
  box(g, x, 0.07, z, 2.0, 0.025, 1.6, rot, col);
  for (let i = 0; i < 4; i++) { const p = loc(x, z, rot, -0.75 + i * 0.5, 0); box(g, p[0], 0.0955, p[1], 0.22, 0.004, 1.6, rot, col2); }
  const n = R.i(1, 3);
  for (let i = 0; i < n; i++) { const p = loc(x, z, rot, -0.5 + i * 0.75, R.r(-0.15, 0.15)); person(g, R, p[0], 0.08, p[1], rot + R.r(-1.2, 1.2) + (i ? 3.14 : 0), R.pick(['lie', 'sit2', 'sit2'])); }
  const p = loc(x, z, rot, 0.75, 0.5); box(g, p[0], 0.09, p[1], 0.4, 0.22, 0.28, rot, C.woodL); box(g, p[0], 0.31, p[1], 0.42, 0.03, 0.3, rot, C.wood);
  const q = loc(x, z, rot, -0.8, 0.5); cyl(g, q[0], 0.09, q[1], 0.08, 0.08, 0.28, 6, lc(0x3a8a5a), true);
}
export function hedge(g, x0, z0, x1, z1, h = 1.0, w = 0.9, col = lc(0x3d6a30)) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx); // box: lokalne x wzdluz
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(g, cx, 0, cz, len, h, w, rot, col); box(g, cx, h * 0.9, cz, len, h * 0.22, w * 0.7, rot, [col[0] * 1.15, col[1] * 1.15, col[2] * 1.15]);
}
export function flowerbed(g, R, x, z, rx) {
  const rz = rx;
  const soil = lc(0x4a3626), edge = lc(0x9a9488);
  cyl(g, x, 0.0, z, rx, rx, 0.1, 14, soil, true);
  const n = Math.min(46, Math.round(rx * rz * 3));
  const fu = uvr(T_FLOWER);
  for (let i = 0; i < n; i++) {
    const a = R.r(0, 6.28), r = Math.sqrt(R()), px = x + Math.cos(a) * r * rx, pz = z + Math.sin(a) * r * rz, s = R.r(0.8, 1.15), t = R.r(0, 3.14), v = R.r(0.85, 1.1);
    for (let q = 0; q < 2; q++) { const tt = t + q * 1.5708; card(g, [px, 0.1 + 0.4 * s, pz], [Math.cos(tt) * 0.5 * s, 0, Math.sin(tt) * 0.5 * s], [0, 0.42 * s, 0], T_FLOWER, [v, v * R.r(0.9, 1), v * R.r(0.85, 1)], [0, 1, 0]); }
  }
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.2832; box(g, x + Math.cos(a) * rx * 1.04, 0, z + Math.sin(a) * rz * 1.04, 0.5, 0.2, 0.28, -a + Math.PI / 2 + 0, edge); }
}
export function tuft(g, R, x, z, s) {
  const t = R.r(0, 3.14), v = R.r(0.8, 1.1);
  for (let q = 0; q < 2; q++) { const tt = t + q * 1.5708; card(g, [x, 0.07 + 0.45 * s, z], [Math.cos(tt) * 0.45 * s, 0, Math.sin(tt) * 0.45 * s], [0, 0.45 * s, 0], T_TUFT, [v, v, v * 0.95], [0, 1, 0]); }
}
export function litter(g, R, x, z, s, col) {
  const t = R.r(0, 6.28), cs = Math.cos(t) * s, sn = Math.sin(t) * s;
  card(g, [x, 0.095, z], [cs, 0, sn], [-sn, 0, cs], T_LITTER, col, [0, 1, 0]);
}
export function chestnut(g, x, z) { sph(g, x, 0.07, z, 0.045, 0.04, 0.045, 5, lc(0x5a2e14)); }

// ---------------------------------------------------------------- fontanna
export function fountainStone(g, x, z) {
  const st = C.stoneL, sd = C.stoneD;
  cyl(g, x, 0.08, z, 6.2, 6.2, 0.06, 28, sd, true);
  const N = 24;
  for (let i = 0; i < N; i++) { const a = i / N * 6.2832, px = x + Math.cos(a) * 5.6, pz = z + Math.sin(a) * 5.6; box(g, px, 0.0, pz, 1.55, 0.78, 0.55, -a + Math.PI / 2, C.stone); box(g, px, 0.78, pz, 1.6, 0.1, 0.8, -a + Math.PI / 2, st); }
  cyl(g, x, 0.1, z, 1.3, 0.95, 1.5, 12, st, true);
  cyl(g, x, 1.5, z, 2.4, 1.5, 0.5, 16, st, true); cyl(g, x, 2.0, z, 1.5, 1.6, 0.08, 16, sd, true);
  cyl(g, x, 2.0, z, 0.5, 0.35, 1.6, 10, st, true);
  cyl(g, x, 3.6, z, 1.2, 0.5, 0.35, 12, st, true);
  cyl(g, x, 3.95, z, 0.25, 0.12, 0.9, 8, st, true); sph(g, x, 4.95, z, 0.22, 0.22, 0.22, 6, st);
}
// ---------------------------------------------------------------- mostek lukowy nad stawem (w osi z, od zA do zB, szerokosc w)
export function bridge(g, x, zA, zB, w) {
  const n = 16, deck = C.stoneD, par = C.stone, cap = C.stoneL, pts = [];
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push([x, 0.32 + 1.7 * (1 - Math.pow(2 * t - 1, 2)), zA + (zB - zA) * t]); }
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    slab(g, a, b, w, 0.42, deck);
    for (const s of [-1, 1]) {
      const a2 = [a[0] + s * (w / 2 - 0.2), a[1] + 0.62, a[2]], b2 = [b[0] + s * (w / 2 - 0.2), b[1] + 0.62, b[2]];
      slab(g, a2, b2, 0.4, 0.8, par); const a3 = [a2[0], a2[1] + 0.46, a2[2]], b3 = [b2[0], b2[1] + 0.46, b2[2]]; slab(g, a3, b3, 0.56, 0.1, cap);
    }
  }
  // podpory w wodzie i przyczolki
  for (const t of [0.0, 0.3, 0.7, 1.0]) {
    const zz = zA + (zB - zA) * t, y = 0.32 + 1.7 * (1 - Math.pow(2 * t - 1, 2)) - 0.2;
    for (const s of [-1, 1]) box(g, x + s * (w / 2 - 0.3), -0.4, zz, 0.6, y + 0.4, t === 0 || t === 1 ? 1.4 : 0.9, 0, par);
  }
  for (const t of [0.0, 0.25, 0.5, 0.75, 1.0]) { const i = Math.round(t * n), p = pts[i]; for (const s of [-1, 1]) { box(g, p[0] + s * (w / 2 - 0.2), p[1] + 0.2, p[2], 0.6, 1.3, 0.6, 0, par); box(g, p[0] + s * (w / 2 - 0.2), p[1] + 1.5, p[2], 0.72, 0.12, 0.72, 0, cap); } }
}
// ---------------------------------------------------------------- plac zabaw
export function playground(g, R, x, z) {
  const rub = lc(0x9a4a3a), sand = lc(0xdcc48e), red = lc(0xd23a2a), yel = lc(0xf0c02a), blue = lc(0x2a6ad2), grn = lc(0x2f9a4a), met = lc(0x8a9098);
  box(g, x, 0, z, 44, 0.1, 30, 0, rub);
  // ogrodzenie z furtka od wschodu (+x)
  for (const sz of [-1, 1]) for (let i = -10; i <= 10; i++) { box(g, x + i * 2.1, 0, z + sz * 15, 0.06, 1.1, 0.06, 0, grn); }
  for (const sz of [-1, 1]) { box(g, x, 0.95, z + sz * 15, 44, 0.05, 0.05, 0, grn); box(g, x, 0.5, z + sz * 15, 44, 0.04, 0.04, 0, grn); }
  for (let i = -7; i <= 7; i++) { if (Math.abs(i) < 2) continue; box(g, x - 22, 0, z + i * 2, 0.06, 1.1, 0.06, 0, grn); }
  box(g, x - 22, 0.95, z, 0.05, 0.05, 30, 0, grn); box(g, x - 22, 0.5, z, 0.04, 0.04, 30, 0, grn);
  for (let i = -7; i <= 7; i++) { if (Math.abs(i) < 2) continue; box(g, x + 22, 0, z + i * 2, 0.06, 1.1, 0.06, 0, grn); }
  box(g, x + 22, 0.95, z + 8.5, 0.05, 0.05, 13, 0, grn); box(g, x + 22, 0.95, z - 8.5, 0.05, 0.05, 13, 0, grn);
  // huśtawki
  const sx = x - 12, sz0 = z - 7;
  for (const e of [-3, 3]) for (const s of [-1, 1]) slab(g, [sx + e, 0, sz0 + s * 1.2], [sx + e, 2.7, sz0], 0.1, 0.1, red);
  slab(g, [sx - 3, 2.7, sz0], [sx + 3, 2.7, sz0], 0.14, 0.14, red);
  for (const k of [-1.5, 0, 1.5]) { for (const s of [-0.18, 0.18]) slab(g, [sx + k + s, 2.65, sz0], [sx + k + s, 0.5, sz0], 0.025, 0.025, met); box(g, sx + k, 0.44, sz0, 0.5, 0.05, 0.2, 0, blue); }
  // zjezdzalnia z wieza
  const tx = x + 6, tz = z - 6;
  for (const a of [-0.6, 0.6]) for (const b of [-0.6, 0.6]) slab(g, [tx + a, 0, tz + b], [tx + a, 2.3, tz + b], 0.1, 0.1, yel);
  box(g, tx, 2.25, tz, 1.4, 0.1, 1.4, 0, yel); for (const a of [-0.65, 0.65]) box(g, tx + a, 2.35, tz, 0.05, 0.8, 1.4, 0, yel); box(g, tx, 2.35, tz - 0.65, 1.4, 0.8, 0.05, 0, yel);
  slab(g, [tx + 0.7, 2.25, tz], [tx + 4.2, 0.35, tz], 0.7, 0.05, met); for (const s of [-0.38, 0.38]) slab(g, [tx + 0.7, 2.5, tz + s], [tx + 4.2, 0.6, tz + s], 0.04, 0.22, red);
  for (const s of [-0.3, 0.3]) slab(g, [tx - 0.7, 0, tz + 1.2 + s], [tx - 0.7, 2.25, tz + 0.7 + s * 0.3], 0.05, 0.05, met);
  for (let i = 1; i < 5; i++) slab(g, [tx - 0.7, i * 0.45, tz + 1.5 - i * 0.15 - 0.35], [tx - 0.7, i * 0.45, tz + 1.5 - i * 0.15 + 0.35], 0.04, 0.04, met);
  // piaskownica
  const bx = x + 8, bz = z + 7;
  box(g, bx, 0, bz, 5, 0.3, 5, 0, lc(0x8a6a40)); box(g, bx, 0.28, bz, 4.5, 0.03, 4.5, 0, sand);
  box(g, bx - 1, 0.31, bz + 0.5, 0.5, 0.35, 0.5, 0.4, lc(0xd9b84a)); // babka z piasku
  // hustawka na sprezynie i karuzela
  for (const [px, pz, c] of [[x - 16, z + 8, red], [x - 13, z + 10, yel], [x - 19, z + 10.5, blue]]) { cyl(g, px, 0.1, pz, 0.08, 0.08, 0.5, 6, met, false); sph(g, px, 0.8, pz, 0.28, 0.25, 0.4, 8, c); }
  cyl(g, x - 5, 0.1, z + 6, 1.4, 1.4, 0.16, 12, blue, true); cyl(g, x - 5, 0.1, z + 6, 0.08, 0.08, 1.0, 6, met, true);
  for (let i = 0; i < 4; i++) { const a = i * 1.5708; slab(g, [x - 5 + Math.cos(a) * 0.1, 1.0, z + 6 + Math.sin(a) * 0.1], [x - 5 + Math.cos(a) * 1.3, 0.6, z + 6 + Math.sin(a) * 1.3], 0.06, 0.06, yel); }
  // drabinki / kopula do wspinania (siatka krzyzowa)
  const kx = x + 12, kz = z - 1;
  for (const a of [-1.4, 1.4]) for (const b of [-1.4, 1.4]) slab(g, [kx + a, 0, kz + b], [kx + a, 2.0, kz + b], 0.08, 0.08, grn);
  for (const y of [0.7, 1.4, 2.0]) for (const s of [-1.4, 1.4]) { slab(g, [kx - 1.4, y, kz + s], [kx + 1.4, y, kz + s], 0.05, 0.05, grn); slab(g, [kx + s, y, kz - 1.4], [kx + s, y, kz + 1.4], 0.05, 0.05, grn); }
  slab(g, [kx - 1.4, 0.5, kz], [kx + 1.4, 1.9, kz], 0.04, 0.04, grn); slab(g, [kx + 1.4, 0.5, kz], [kx - 1.4, 1.9, kz], 0.04, 0.04, grn);
  // hustawka-bujak (deska na podporze)
  box(g, x + 14, 0, z + 8, 0.2, 0.4, 0.5, 0, met); slab(g, [x + 11.8, 0.7, z + 8], [x + 16.2, 0.2, z + 8], 0.3, 0.07, red);
}
// ---------------------------------------------------------------- boisko do koszykowki
export function court(g, x, z) {
  const grn = lc(0x3d6a58), line = lc(0xf0f0e6), blu = lc(0x2f4a68), met = lc(0x8a9098), rim = lc(0xd8541a);
  box(g, x, 0, z, 19, 0.09, 33, 0, blu); box(g, x, 0.09, z, 15, 0.012, 28, 0, grn);
  const L = (cx, cz, sx, sz) => box(g, cx, 0.103, cz, sx, 0.006, sz, 0, line);
  L(x, z - 14, 15, 0.1); L(x, z + 14, 15, 0.1); L(x - 7.5, z, 0.1, 28); L(x + 7.5, z, 0.1, 28); L(x, z, 15, 0.1);
  for (const s of [-1, 1]) { L(x, z + s * 14 - s * 5.8, 4.9, 0.1); L(x - 2.45, z + s * 14 - s * 2.9, 0.1, 5.8); L(x + 2.45, z + s * 14 - s * 2.9, 0.1, 5.8); }
  for (const s of [-1, 1]) {
    const hz = z + s * 13.4;
    cyl(g, x, 0.09, z + s * 15.4, 0.1, 0.08, 3.4, 6, met, true); box(g, x, 3.0, z + s * 14.4, 0.06, 0.06, 1.0, 0, met);
    box(g, x, 2.85, hz + s * 0.45 - s * 0.0, 1.8, 1.05, 0.05, 0, [0.9, 0.92, 0.95]);
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832; box(g, x + Math.cos(a) * 0.23, 2.9, hz + Math.sin(a) * 0.23 - s * 0.0, 0.1, 0.03, 0.1, -a, rim); }
  }
  // siatka ogrodzenia (slupki i poprzeczki)
  for (let i = -8; i <= 8; i++) for (const s of [-1, 1]) { box(g, x + i * 1.2, 0, z + s * 17, 0.05, 3.6, 0.05, 0, met); }
  for (let i = -14; i <= 14; i++) for (const s of [-1, 1]) { if (Math.abs(i) < 2) continue; box(g, x + s * 9.8, 0, z + i * 1.2, 0.05, 3.6, 0.05, 0, met); }
  for (const s of [-1, 1]) { box(g, x, 3.55, z + s * 17, 19.6, 0.05, 0.05, 0, met); box(g, x + s * 9.8, 3.55, z, 0.05, 0.05, 34, 0, met); box(g, x, 1.2, z + s * 17, 19.6, 0.03, 0.03, 0, met); }
}
// ---------------------------------------------------------------- kamienny murek z bramami: segment prosty (po osi x lub z)
export function wallSeg(g, x0, z0, x1, z1) {
  const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), rot = Math.atan2(-dz, dx), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  box(g, cx, 0, cz, len, 0.9, 0.55, rot, C.stone); box(g, cx, 0.9, cz, len, 0.12, 0.72, rot, C.stoneL);
  const n = Math.max(1, Math.round(len / 2.2));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, px = x0 + dx * t, pz = z0 + dz * t; box(g, px, 0.18 + (i * 37 % 5) * 0.12, pz, 1.0, 0.04, 0.58, rot, C.stoneD); } // spoiny blokow
}
export function gatePillar(g, x, z) {
  box(g, x, 0, z, 1.1, 2.0, 1.1, 0, C.stone); box(g, x, 2.0, z, 1.3, 0.14, 1.3, 0, C.stoneL); box(g, x, 2.14, z, 0.9, 0.12, 0.9, 0, C.stone);
  cyl(g, x, 2.26, z, 0.3, 0.26, 0.5, 8, [1, 1, 1], false, T_LAMP); cyl(g, x, 2.76, z, 0.34, 0.0, 0.25, 8, C.iron, false);
}

// krawezniki sciezek (krotki kamienny prostopadloscian wzdluz sciezki)
export function curb(g, x, z, len, rot) { box(g, x, 0.0, z, len, 0.17, 0.2, rot, C.stoneD); }
