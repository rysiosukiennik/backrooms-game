// Central Park: rozplanowanie (sciezki, alejki, kepy drzew, rabaty, wyposazenie) i system porcji (chunkow) ze scalonymi
// siatkami o dwoch poziomach szczegolowosci. Drzewa: dab, klon, brzoza, wierzba, swierk — korony z kart z alpha-testem.
// Tez drzewa miejskie (kraty przy ulicach, kieszonkowe parki) — jedna siatka na porcje, bez instancji.
import { cv, canvasTex } from './util.js';
import { scene, camera, G } from './stan.js';
import { makeAtlas, Geo, rng, lc, treeTpl, bushTpl, TINTS, VARIANTS } from './park_geo.js';
import * as PR from './park_props.js';
import { initLife, updateLife } from './park_life.js';

let C = null, parkMat = null;
const CELL = 64, HI_D = 150, HI_BUILD = 200, LO_D = 720;
const chunks = new Map();

function material() {
  if (parkMat) return parkMat;
  const { map, emi } = makeAtlas();
  parkMat = new THREE.MeshStandardMaterial({
    map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.15, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide,
    roughness: 0.93, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  parkMat.userData.env = 0.5;
  // dwustronne karty lisci: normalna taka sama z obu stron (kopulaste oswietlenie korony)
  parkMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.split('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;').join('float faceDirection = 1.0;'); };
  return parkMat;
}
export function parkTOD(lamps) { if (parkMat) parkMat.emissiveIntensity = 0.12 + lamps * 2.1; }

// ---------------------------------------------------------------- porcje
function chunkAt(x, z) {
  const ix = Math.floor(x / CELL), iz = Math.floor(z / CELL), k = ix + ',' + iz; let c = chunks.get(k);
  if (!c) { c = { ix, iz, x0: ix * CELL, z0: iz * CELL, trees: [], fns: [], hi: null, lo: null, st: 0, ti: 0 }; chunks.set(k, c); }
  return c;
}
// f(g) dopisuje geometrie; lo = czy ma byc widoczne tez z daleka
function put(x, z, f, lo = false) { chunkAt(x, z).fns.push({ f, lo }); }
function buildMesh(c, hi) {
  const g = new Geo();
  for (const t of c.trees) g.append(treeTpl(t.sp, t.v, hi ? 0 : 1), t.x, 0, t.z, t.rot, t.sx, t.sy, t.tint);
  for (const q of c.fns) if (hi || q.lo) q.f(g);
  if (!g.verts) return null;
  const m = new THREE.Mesh(g.toBuffer(), material());
  m.matrixAutoUpdate = false; m.castShadow = false; m.receiveShadow = false; m.visible = false; scene.add(m);
  return m;
}
const _fr = { b: 0 };
export function updatePark(dt) {
  if (!C) return;
  const cx = camera.position.x, cz = camera.position.z;
  let bh = 0, bl = 0;
  for (const c of chunks.values()) {
    if (!c.trees.length && !c.fns.length) continue;
    const dx = Math.max(c.x0 - cx, 0, cx - (c.x0 + CELL)), dz = Math.max(c.z0 - cz, 0, cz - (c.z0 + CELL)), d = Math.hypot(dx, dz);
    const hiWant = d < (c.st === 2 ? HI_D + 25 : HI_D), loWant = d < LO_D;
    if ((hiWant || d < HI_BUILD) && c.hi === null && bh < 1) { c.hi = buildMesh(c, true) || 0; bh++; }
    if (loWant && c.lo === null && bl < 3) { c.lo = buildMesh(c, false) || 0; bl++; }
    let st = 0;
    if (hiWant && c.hi) st = 2; else if (loWant && c.lo) st = 1; else if (loWant && c.hi) st = 2;
    c.st = st;
    if (c.hi) c.hi.visible = st === 2;
    if (c.lo) c.lo.visible = st === 1;
    if (c.hi && st !== 2 && d > 380) { scene.remove(c.hi); c.hi.geometry.dispose(); c.hi = null; }
  }
  animPark(G.time);
  updateLife(dt, G.time);
}
function sampleAlong(pts, step, first, cb) {
  let total = 0; const segs = [];
  for (let i = 0; i + 1 < pts.length; i++) { const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dz); if (L > 1e-6) { segs.push({ i, L, s0: total, ux: dx / L, uz: dz / L }); total += L; } }
  let k = 0;
  for (let s = first; s < total; s += step) {
    while (k < segs.length - 1 && segs[k].s0 + segs[k].L < s) k++;
    const g = segs[k], t = s - g.s0; cb(pts[g.i][0] + g.ux * t, pts[g.i][1] + g.uz * t, g.ux, g.uz, s);
  }
}

// ---------------------------------------------------------------- plan parku
const TR = { // wspolczynniki gatunkow: promien korony, cien na ziemi
  oak: { cr: 6.2, sh: 0.4 }, maple: { cr: 4.8, sh: 0.38 }, birch: { cr: 2.8, sh: 0.2 }, willow: { cr: 5.2, sh: 0.4 }, spruce: { cr: 3.2, sh: 0.5 },
};
const WEIGHTS = {
  oak: [['oak', 6], ['maple', 2], ['birch', 1]], maple: [['maple', 6], ['oak', 2], ['birch', 1], ['spruce', 1]], birch: [['birch', 6], ['maple', 2], ['spruce', 1]],
  pines: [['spruce', 7], ['birch', 2], ['oak', 1]], mixed: [['oak', 3], ['maple', 3], ['birch', 2], ['spruce', 2]],
};
function pickW(R, list) { let s = 0; for (const [, w] of list) s += w; let r = R() * s; for (const [k, w] of list) { r -= w; if (r <= 0) return k; } return list[0][0]; }

const polyDist = (pts, x, z) => {
  let best = 1e9;
  for (let i = 0; i + 1 < pts.length; i++) {
    const ax = pts[i][0], az = pts[i][1], bx = pts[i + 1][0], bz = pts[i + 1][1], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)), d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)); if (d < best) best = d;
  }
  return best;
};
function catmull(P, seg = 8) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(P[P.length - 1].slice()); return out;
}

let gravelMat = null, dirtMat = null, fountainJets = null, fountainWater = null;
function gravelTex() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'); x.fillStyle = '#b7a98f'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 26; i++) { const px = Math.random() * S, py = Math.random() * S, r = 20 + Math.random() * 50, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(90,75,55,.12)' : 'rgba(255,245,225,.12)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); }
  for (let i = 0; i < 5200; i++) { const k = 90 + Math.random() * 130 | 0; x.fillStyle = `rgba(${k},${k * 0.93 | 0},${k * 0.8 | 0},${0.35 + Math.random() * 0.4})`; x.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 2, 1 + Math.random() * 2); }
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(60,50,40,${0.2 + Math.random() * 0.2})`; x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 1.5 + Math.random() * 2, 1 + Math.random() * 1.5, Math.random() * 3, 0, 6.3); x.fill(); }
  return canvasTex(c, true);
}
function dirtTex() {
  const c = cv(64, 64), x = c.getContext('2d'); x.clearRect(0, 0, 64, 64);
  for (let i = 0; i < 700; i++) { const u = Math.random(), a = Math.exp(-Math.pow((u - 0.5) / 0.22, 2)); x.fillStyle = `rgba(${110 + Math.random() * 30 | 0},${88 + Math.random() * 25 | 0},${58 + Math.random() * 20 | 0},${a * (0.25 + Math.random() * 0.5)})`; x.fillRect(u * 64, Math.random() * 64, 2.5, 2.5); }
  const t = canvasTex(c, true); t.wrapS = THREE.ClampToEdgeWrapping; return t;
}

// pas wzdluz lamanej: wierzcholki z normalnymi usrednionymi; uv swiatowe (zwarte z innymi sciezkami)
function ribbon(out, pts, w, y, worldUV, closed) {
  const n = pts.length; let len = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1]; if (closed) { const aa = pts[(i - 1 + n) % n], bb = pts[(i + 1) % n]; dx = bb[0] - aa[0]; dz = bb[1] - aa[1]; }
    const l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l, p = pts[i];
    if (i) len += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    for (const s of [-1, 1]) {
      const px = p[0] + nx * s * w / 2, pz = p[1] + nz * s * w / 2; out.p.push(px, y, pz); out.n.push(0, 1, 0);
      if (worldUV) out.u.push(px / 3.4, pz / 3.4); else out.u.push(s < 0 ? 0 : 1, len / 5);
      out.c.push(1, 1, 1);
    }
  }
  const base = out.p.length / 3 - n * 2;
  for (let i = 0; i + 1 < n + (closed ? 1 : 0); i++) { const a = base + i * 2, b = base + ((i + 1) % n) * 2; out.i.push(a, a + 1, b + 1, a, b + 1, b); }
}
function disc(out, x, z, r, y, col) {
  const k = out.p.length / 3; out.p.push(x, y, z); out.n.push(0, 1, 0); out.u.push(x / 3.4, z / 3.4); out.c.push(col[0], col[1], col[2]);
  for (let i = 0; i <= 28; i++) { const a = i / 28 * 6.2832, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; out.p.push(px, y, pz); out.n.push(0, 1, 0); out.u.push(px / 3.4, pz / 3.4); out.c.push(col[0], col[1], col[2]); }
  for (let i = 0; i < 28; i++) out.i.push(k, k + 2 + i, k + 1 + i);
}
const flatGeo = () => ({ p: [], n: [], u: [], c: [], i: [] });
const flatBuf = o => { const G2 = new THREE.BufferGeometry(); G2.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); G2.setAttribute('normal', new THREE.Float32BufferAttribute(o.n, 3)); G2.setAttribute('uv', new THREE.Float32BufferAttribute(o.u, 2)); G2.setAttribute('color', new THREE.Float32BufferAttribute(o.c, 3)); G2.setIndex(o.p.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(o.i, 1) : new THREE.Uint16BufferAttribute(o.i, 1)); G2.computeBoundingSphere(); return G2; };

export function planPark(ctx) {
  C = ctx;
  const { PK, POND, ARENA } = ctx;
  const PW = PK.x1 - PK.x0, PD = PK.z1 - PK.z0, cx = (PK.x0 + PK.x1) / 2;
  const ph1z = PK.z0 + PD * 0.15, ph2z = PK.z0 + PD * 0.42, paX = cx - 60, pbX = cx + 70;
  const ell = (sc, t) => [POND.x + POND.rx * sc * Math.cos(t), POND.z + POND.rz * sc * Math.sin(t)];
  const ellZ = (x, sc, sg) => POND.z + sg * POND.rz * sc * Math.sqrt(Math.max(0, 1 - Math.pow((x - POND.x) / (POND.rx * sc), 2)));
  const RING = 1.18;
  // ---- sciezki
  const paths = [];
  const addPath = (name, pts, w, o = {}) => { const p = { name, pts, w, closed: !!o.closed, curb: o.curb !== false, walk: o.walk !== false }; paths.push(p); return p; };
  addPath('Pa', [[paX, PK.z0], [paX, PK.z1]], 5);
  addPath('Pb', [[pbX, PK.z0], [pbX, ellZ(pbX, RING, -1) - 0.5]], 5);
  addPath('Ph1', [[PK.x0, ph1z], [PK.x1, ph1z]], 4.5);
  addPath('Ph2', [[PK.x0, ph2z], [PK.x1, ph2z]], 4.5);
  const loop = []; for (let i = 0; i < 64; i++) loop.push(ell(RING, i / 64 * 6.2832));
  addPath('ring', loop, 3.6, { closed: true });
  const bx = POND.x + 54, bz0 = ellZ(bx, 1, -1), bz1 = ellZ(bx, 1, 1);
  addPath('mostN', [[bx, ellZ(bx, RING, -1)], [bx, bz0 - 1.5]], 4.2, { curb: false });
  addPath('mostS', [[bx, bz1 + 1.5], [bx, ellZ(bx, RING, 1)]], 4.2, { curb: false });
  addPath('E3', [[paX, POND.z], [POND.x - POND.rx * RING, POND.z]], 3.6);
  const plz = (PK.z0 + ph1z) / 2 * 0 + (ph1z + ph2z) / 2, plx = paX - 48;
  addPath('E4', catmull([[paX, plz], [paX - 12, plz + 2], [plx + 30, plz - 1.5], [plx + 23, plz]], 6), 3.6);
  const ctx0 = cx + 22;
  addPath('E6', catmull([[pbX, plz + 2], [pbX - 16, plz - 1], [ctx0 + 14, plz], [ctx0 + 10.5, plz]], 6), 3.6);
  addPath('E7', catmull([[cx + 112, ph1z], [cx + 124, ph1z + 20], [cx + 121, ph1z + 45], [cx + 108, ph1z + 70], [cx + 98, ph2z]], 8), 3.4);
  addPath('E8', catmull([[paX, POND.z - 40], [paX - 26, POND.z - 27], [paX - 52, POND.z - 10], [paX - 72, POND.z + 15], [paX - 90, POND.z + 35], [PK.x0, POND.z + 40]], 8), 3.4);
  addPath('E5', catmull([ell(RING, 0.28), [cx + 118, POND.z + 28], [cx + 135, POND.z + 52], [PK.x1, POND.z + 75]], 8), 3.6);
  // ---- przeszkody (do rozstawiania drzew itp.)
  const fountain = { x: paX, z: ph2z, r: 15 };
  const circles = [fountain, { x: ARENA.x, z: ARENA.z, r: 66 }];
  const rects = [
    { x0: plx - 26, x1: plx + 26, z0: plz - 18, z1: plz + 18 }, // plac zabaw
    { x0: ctx0 - 12, x1: ctx0 + 12, z0: plz - 20, z1: plz + 20 }, // boisko
    { x0: bx - 8, x1: bx + 8, z0: bz0 - 14, z1: bz1 + 14 }, // mostek
  ];
  const pondOK = (x, z, pad) => Math.pow((x - POND.x) / (POND.rx + pad), 2) + Math.pow((z - POND.z) / (POND.rz + pad), 2) >= 1;
  const blocked = (x, z, pad, ign) => {
    if (x < PK.x0 + 4 || x > PK.x1 - 4 || z < PK.z0 + 4 || z > PK.z1 - 4) return true;
    for (const p of paths) { if (p === ign || !p.walk) continue; if (polyDist(p.pts.length < 3 ? p.pts : p.pts, x, z) < p.w / 2 + pad) return true; if (p.closed && polyDist([p.pts[p.pts.length - 1], p.pts[0]], x, z) < p.w / 2 + pad) return true; }
    if (!pondOK(x, z, pad + 2)) return true;
    for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + pad) return true;
    for (const r of rects) if (x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad) return true;
    return false;
  };
  const R = rng(20181);
  const trees = [], grid = new Map(), gk = (x, z) => Math.floor(x / 6) * 1000 + Math.floor(z / 6);
  const tooClose = (x, z, d) => { for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(gk(x + a * 6, z + b * 6)); if (l) for (const t of l) if (Math.hypot(t.x - x, t.z - z) < d) return true; } return false; };
  const addTree = (sp, x, z, o = {}) => {
    const sc = o.sc || R.r(0.8, 1.25), t = { sp, v: R.i(0, VARIANTS[sp] - 1), x, z, rot: R.r(0, 6.28), sx: sc * (o.wx || 1), sy: sc * (o.hy || 1), tint: lc(R.pick(TINTS[sp])).map(v => v * R.r(0.92, 1.08)) };
    t.r = TR[sp].cr * t.sx; t.sh = TR[sp].sh; trees.push(t); const k = gk(x, z); let l = grid.get(k); if (!l) { l = []; grid.set(k, l); } l.push(t); return t;
  };
  // ---- piknikowe koce (przed drzewami: to polany)
  const picnics = [];
  for (let i = 0, tries = 0; i < 11 && tries < 400; tries++) { const x = R.r(PK.x0 + 12, PK.x1 - 12), z = R.r(PK.z0 + 12, PK.z1 - 12); if (blocked(x, z, 6)) continue; if (picnics.some(p => Math.hypot(p.x - x, p.z - z) < 16)) continue; picnics.push({ x, z, rot: R.r(0, 6.28) }); i++; }
  for (const p of picnics) circles.push({ x: p.x, z: p.z, r: 3.5 });
  // ---- rabaty
  const beds = [], hedges = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) beds.push({ x: fountain.x + sx * 10.4, z: fountain.z + sz * 10.4, r: 2.7 });
  for (const gx of [paX, pbX]) for (const s of [-1, 1]) beds.push({ x: gx + s * 8.5, z: PK.z0 + 12, r: 2.3 });
  for (const gz of [ph1z, ph2z]) for (const s of [-1, 1]) { beds.push({ x: PK.x0 + 12, z: gz + s * 8, r: 2.1 }); beds.push({ x: PK.x1 - 12, z: gz + s * 8, r: 2.1 }); }
  beds.push({ x: paX + 9, z: PK.z1 - 12, r: 2.4 }, { x: paX - 9, z: PK.z1 - 12, r: 2.4 });
  for (const b of beds) circles.push({ x: b.x, z: b.z, r: b.r + 1.5 });
  // zywoplot wzdluz Pa/Pb przy bramach i wokol fontanny
  for (const gx of [paX, pbX]) for (const s of [-1, 1]) hedges.push([gx + s * 4.4, PK.z0 + 3.5, gx + s * 4.4, PK.z0 + 34]);
  // ---- aleje: drzewa wzdluz sciezek po obu stronach
  const avenue = (path, sp, step, off, o = {}) => {
    sampleAlong(path.pts, step, step * 0.5, (px, pz, ux, uz) => {
      for (const s of [-1, 1]) {
        const x = px - uz * s * off + R.r(-0.7, 0.7), z = pz + ux * s * off + R.r(-0.7, 0.7), spp = typeof sp === 'function' ? sp() : sp;
        if (blocked(x, z, 2.2, path) || tooClose(x, z, 6)) continue;
        addTree(spp, x, z, { sc: R.r(0.95, 1.2) * (o.sc || 1), wx: o.wx || 1, hy: o.hy || 1 });
      }
    });
  };
  avenue(paths[0], 'oak', 12.5, 7.6, { wx: 0.85, hy: 1.12 });
  avenue(paths[1], 'maple', 11, 7, { wx: 0.95, hy: 1.1 });
  avenue(paths[2], () => R.pick(['oak', 'maple']), 12, 6.8);
  avenue(paths[3], () => R.pick(['oak', 'oak', 'maple', 'birch']), 12, 6.8);
  // ---- wierzby nad stawem
  for (let i = 0; i < 9; i++) {
    const t = i / 9 * 6.2832 + R.r(-0.2, 0.2), sc = 1.32 + R.r(-0.05, 0.12), p = ell(sc, t);
    if (blocked(p[0], p[1], 2.5, paths.find(q => q.name === 'ring'))) continue; if (tooClose(p[0], p[1], 8)) continue;
    addTree('willow', p[0], p[1], { sc: R.r(0.95, 1.25) });
  }
  // ---- kepy: lasy, klonowe polany, brzozowe gaje, sosnowe
  const types = ['oak', 'maple', 'maple', 'birch', 'pines', 'mixed', 'oak', 'mixed', 'maple'];
  const groves = [];
  for (let gI = 0, tries = 0; gI < 26 && tries < 500; tries++) {
    const x = R.r(PK.x0 + 14, PK.x1 - 14), z = R.r(PK.z0 + 14, PK.z1 - 14);
    if (blocked(x, z, 6) || groves.some(q => Math.hypot(q.x - x, q.z - z) < 38)) continue;
    const g = { x, z, type: types[gI % types.length], rad: R.r(11, 22), n: R.i(13, 30) }; groves.push(g); gI++;
    for (let k = 0, kt = 0; k < g.n && kt < 200; kt++) {
      const a = R.r(0, 6.28), rr = Math.abs(R.r(-1, 1) + R.r(-1, 1)) * 0.6 * g.rad, px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr;
      if (blocked(px, pz, 2.4) || tooClose(px, pz, 4.4)) continue;
      addTree(pickW(R, WEIGHTS[g.type]), px, pz, { sc: R.r(0.75, 1.3) }); k++;
    }
  }
  // ---- pojedyncze okazale drzewa na polanach
  for (let k = 0, tries = 0; k < 70 && tries < 600; tries++) {
    const x = R.r(PK.x0 + 6, PK.x1 - 6), z = R.r(PK.z0 + 6, PK.z1 - 6);
    if (blocked(x, z, 3) || tooClose(x, z, 12)) continue;
    addTree(R.pick(['oak', 'oak', 'maple', 'maple', 'birch']), x, z, { sc: R.r(1.0, 1.45) }); k++;
  }
  // ---- pas drzew przy murku od strony ulicy
  for (let side = 0; side < 4; side++) {
    const len = side < 2 ? PW : PD;
    for (let d = 8; d < len - 8; d += R.r(8, 14)) {
      const inset = R.r(5, 8);
      const x = side === 0 ? PK.x0 + d : side === 1 ? PK.x0 + d : side === 2 ? PK.x0 + inset : PK.x1 - inset, z = side === 0 ? PK.z0 + inset : side === 1 ? PK.z1 - inset : PK.z0 + d, zz = side === 3 ? PK.z0 + d : z;
      if (blocked(x, zz, 2.6) || tooClose(x, zz, 5)) continue;
      addTree(R.pick(['oak', 'maple', 'maple', 'birch', 'spruce', 'oak']), x, zz, { sc: R.r(0.9, 1.3) });
    }
  }
  // ---- krzewy: obrzeza kep, wzdluz murku i wokol stawu
  const bushes = [];
  const addBush = (x, z, s) => bushes.push({ x, z, s, v: R.i(0, 2), tint: lc(R.pick(TINTS.bush)).map(v => v * R.r(0.9, 1.1)) });
  for (const g of groves) for (let i = 0; i < R.i(4, 9); i++) { const a = R.r(0, 6.28), rr = g.rad * R.r(0.55, 0.9), x = g.x + Math.cos(a) * rr, z = g.z + Math.sin(a) * rr; if (!blocked(x, z, 1.8) && !tooClose(x, z, 2.2)) addBush(x, z, R.r(0.8, 1.5)); }
  for (const t of trees) if (R() < 0.12) { const a = R.r(0, 6.28), rr = t.r * R.r(0.5, 0.9), x = t.x + Math.cos(a) * rr, z = t.z + Math.sin(a) * rr; if (!blocked(x, z, 1.5)) addBush(x, z, R.r(0.7, 1.2)); }
  for (let i = 0; i < 70; i++) { const t = R.r(0, 6.28), sc = R.r(1.28, 1.42), p = ell(sc, t); if (!blocked(p[0], p[1], 1.2, paths.find(q => q.name === 'ring')) && !tooClose(p[0], p[1], 3)) addBush(p[0], p[1], R.r(0.8, 1.4)); }
  for (let d = 10; d < PW - 10; d += R.r(7, 13)) for (const z of [PK.z0 + 2.6, PK.z1 - 2.6]) addBushSafe(PK.x0 + d, z);
  for (let d = 10; d < PD - 10; d += R.r(7, 13)) for (const x of [PK.x0 + 2.6, PK.x1 - 2.6]) addBushSafe(x, PK.z0 + d);
  function addBushSafe(x, z) { for (const p of paths) if (p.walk && polyDist(p.pts, x, z) < p.w / 2 + 3.5) return; addBush(x, z, R.r(0.9, 1.5)); }

  // ---------------- cienie i wydeptania w kolorze trawy (wierzcholki siatki trawy)
  const benches = [], lamps = [], bins = [], gates = [];
  const benchWear = [];
  const shade = (wx, wz) => {
    let s = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const l = grid.get(gk(wx + a * 6, wz + b * 6)); if (l) for (const t of l) { const d = Math.hypot(t.x - wx, t.z - wz) / (t.r * 0.95); if (d < 1) s = Math.max(s, (1 - d * d) * (t.sh / 0.4)); } }
    return Math.min(1, s);
  };
  const wear = (wx, wz) => {
    let w = 0;
    for (const b of benchWear) { const d = Math.hypot(b[0] - wx, b[1] - wz); if (d < 3.2) w = Math.max(w, 1 - d / 3.2); }
    const df = Math.hypot(wx - fountain.x, wz - fountain.z); if (df < 22 && df > 12) w = Math.max(w, (1 - Math.abs(df - 17) / 5) * 0.4);
    return w;
  };
  const plan = {
    groundTint(wx, wz) { const s = shade(wx, wz) * 0.34, w = wear(wx, wz); return [1 - s + w * 0.22, 1 - s * 0.95 - w * 0.02, 1 - s * 1.05 - w * 0.22]; },
    build() { buildPark(); },
    paths, fountain,
  };

  // ---------------------------------------------------------------- budowa zawartosci
  function buildPark() {
    material(); const Rb = rng(33);
    // --- nawierzchnia (zwir) i place
    gravelMat = new THREE.MeshStandardMaterial({ map: gravelTex(), vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const fl = flatGeo(), Y = 0.085;
    for (const p of paths) ribbon(fl, p.pts, p.w, Y, true, p.closed);
    const plaza = lc(0xcfc6b2), light = [1, 1, 1];
    disc(fl, fountain.x, fountain.z, 13.5, Y + 0.003, plaza);
    disc(fl, plx + 27, plz, 3.2, Y + 0.003, light); disc(fl, ctx0 + 12, plz, 3.2, Y + 0.003, light);
    const gm = new THREE.Mesh(flatBuf(fl), gravelMat); gm.receiveShadow = true; scene.add(gm);
    // --- wydeptane sciezki skrotow (trawa przeswituje)
    dirtMat = new THREE.MeshStandardMaterial({ map: dirtTex(), transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1.5, polygonOffsetUnits: -1.5, vertexColors: true });
    const dl = flatGeo();
    const cut = [[[paX + 4, ph1z + 8], [paX + 40, ph2z - 20], [cx + 4, ph2z - 6]], [[pbX - 4, ph1z + 40], [pbX - 38, ph1z + 62], [pbX - 50, ph2z + 4]], [[paX - 5, POND.z + 30], [paX - 25, POND.z + 56], [paX - 30, PK.z1 - 40]], [[pbX + 4, ph2z + 20], [pbX + 30, ph2z + 48], [pbX + 28, POND.z - 40]], [[cx - 10, PK.z1 - 3], [cx - 25, PK.z1 - 25], [cx - 40, PK.z1 - 60]]];
    for (const c of cut) { const pts = catmull(c, 8); ribbon(dl, pts, 1.3, 0.09, false, false); }
    const dm = new THREE.Mesh(flatBuf(dl), dirtMat); scene.add(dm);
    // --- krawezniki ze zwiru
    for (const p of paths) {
      if (!p.curb) continue; const pts = p.closed ? p.pts.concat([p.pts[0]]) : p.pts;
      sampleAlong(pts, 3, 1.5, (px, pz, ux, uz) => {
        const rot = Math.atan2(-uz, ux);
        for (const s of [-1, 1]) {
          const x = px - uz * s * (p.w / 2 + 0.1), z = pz + ux * s * (p.w / 2 + 0.1);
          let skip = false; for (const q of paths) if (q !== p && q.walk && polyDist(q.pts, x, z) < q.w / 2 + 0.6) { skip = true; break; }
          if (skip || Math.hypot(x - fountain.x, z - fountain.z) < 14.5) continue;
          put(x, z, g => PR.curb(g, x, z, 3.1, rot));
        }
      });
    }
    // --- mur z bramami
    const gateList = [[paX, PK.z0, 'z'], [paX, PK.z1, 'z'], [pbX, PK.z0, 'z'], [PK.x0, ph1z, 'x'], [PK.x1, ph1z, 'x'], [PK.x0, ph2z, 'x'], [PK.x1, ph2z, 'x'], [PK.x0, POND.z + 40, 'x'], [PK.x1, POND.z + 75, 'x']];
    const inset = 0.9;
    const wallRun = (fixed, a0, a1, axis, gl) => { // axis 'z': mur wzdluz x przy z=fixed
      const gaps = gl.map(v => [v - 4.3, v + 4.3]).sort((p, q) => p[0] - q[0]); let s = a0;
      const seg = (u0, u1) => { for (let u = u0; u < u1; u += 11) { const v = Math.min(u1, u + 11); const [x0, z0, x1, z1] = axis === 'z' ? [u, fixed, v, fixed] : [fixed, u, fixed, v]; put((x0 + x1) / 2, (z0 + z1) / 2, g => PR.wallSeg(g, x0, z0, x1, z1), true); C.addBox({ x0: Math.min(x0, x1) - (axis === 'z' ? 0 : 0.3), x1: Math.max(x0, x1) + (axis === 'z' ? 0 : 0.3), y0: 0, y1: 1.0, z0: Math.min(z0, z1) - (axis === 'z' ? 0.3 : 0), z1: Math.max(z0, z1) + (axis === 'z' ? 0.3 : 0) }); } };
      for (const [g0, g1] of gaps) { if (g0 > s) seg(s, g0); s = g1; } if (s < a1) seg(s, a1);
      for (const [g0, g1] of gaps) for (const v of [g0, g1]) { const [x, z] = axis === 'z' ? [v, fixed] : [fixed, v]; put(x, z, g => PR.gatePillar(g, x, z), true); lamps.push([x, 2.5, z]); }
    };
    wallRun(PK.z0 + inset, PK.x0, PK.x1, 'z', gateList.filter(g => g[2] === 'z' && Math.abs(g[1] - PK.z0) < 1).map(g => g[0]));
    wallRun(PK.z1 - inset, PK.x0, PK.x1, 'z', gateList.filter(g => g[2] === 'z' && Math.abs(g[1] - PK.z1) < 1).map(g => g[0]));
    wallRun(PK.x0 + inset, PK.z0, PK.z1, 'x', gateList.filter(g => g[2] === 'x' && Math.abs(g[0] - PK.x0) < 1).map(g => g[1]));
    wallRun(PK.x1 - inset, PK.z0, PK.z1, 'x', gateList.filter(g => g[2] === 'x' && Math.abs(g[0] - PK.x1) < 1).map(g => g[1]));
    // --- latarnie, lawki, kosze wzdluz sciezek
    const nearPlaza = (x, z) => Math.hypot(x - fountain.x, z - fountain.z) < 15;
    const inPark = (x, z) => x > PK.x0 + 3 && x < PK.x1 - 3 && z > PK.z0 + 3 && z < PK.z1 - 3;
    for (const p of paths) {
      if (!p.walk || p.name.startsWith('most')) continue;
      const pts = p.closed ? p.pts.concat([p.pts[0]]) : p.pts;
      const free = (xx, zz) => !nearPlaza(xx, zz) && inPark(xx, zz) && !paths.some(q => q !== p && q.walk && polyDist(q.pts, xx, zz) < q.w / 2 + 6) && !rects.some(r => xx > r.x0 - 4 && xx < r.x1 + 4 && zz > r.z0 - 4 && zz < r.z1 + 4);
      let side = 1;
      sampleAlong(pts, 30 * (p.closed ? 0.75 : 1), 14, (x0, z0, ux, uz) => {
        side = -side; const x = x0 - uz * side * (p.w / 2 + 1.3), z = z0 + ux * side * (p.w / 2 + 1.3);
        if (free(x, z)) { lamps.push([x, 4.2, z]); put(x, z, g => PR.lampPost(g, x, z)); }
      });
      let at = 22;
      sampleAlong(pts, 11, 6, (x0, z0, ux, uz, sPos) => {
        if (sPos < at) return; at = sPos + R.r(30, 44);
        const s = R() < 0.5 ? 1 : -1, off = p.w / 2 + 1.0, x = x0 - uz * s * off, z = z0 + ux * s * off;
        if (!free(x, z) || !pondOK(x, z, 1)) return;
        const rot = Math.atan2(x0 - x, z0 - z); benches.push({ x, z, rot }); benchWear.push([x, z]);
        const sit = R() < 0.4, sd = R.i(1, 1e6);
        put(x, z, g => { PR.bench(g, x, z, rot); if (sit) PR.person(g, rng(sd), x, 0.45, z, rot, 'sit'); if (sd % 2) PR.bin(g, x + Math.cos(rot) * 1.4, z - Math.sin(rot) * 1.4); });
      });
    }
    // lawki wokol fontanny i latarnie, lawki nad stawem
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.2832 + 0.785, x = fountain.x + Math.cos(a) * 8.8, z = fountain.z + Math.sin(a) * 8.8; benches.push({ x, z, rot: Math.atan2(fountain.x - x, fountain.z - z) }); benchWear.push([x, z]); const sd = R.i(1, 1e6); put(x, z, g => { PR.bench(g, x, z, Math.atan2(fountain.x - x, fountain.z - z)); if (sd % 3) PR.person(g, rng(sd), x, 0.45, z, Math.atan2(fountain.x - x, fountain.z - z), 'sit'); }); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832, x = fountain.x + Math.cos(a) * 12.6, z = fountain.z + Math.sin(a) * 12.6; if (i % 2) { lamps.push([x, 4.2, z]); put(x, z, g => PR.lampPost(g, x, z), false); } }
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * 6.2832 + 0.2, p = ell(1.27, a), pp = ell(1.2, a);
      if (blocked(p[0], p[1], 0.6, paths.find(q => q.name === 'ring')) && polyDist(paths.find(q => q.name === 'ring').pts, p[0], p[1]) < 3) continue;
      if (paths.some(q => q.name !== 'ring' && q.walk && polyDist(q.pts, p[0], p[1]) < q.w / 2 + 4)) continue;
      const rot = Math.atan2(POND.x - p[0], POND.z - p[1]); benches.push({ x: p[0], z: p[1], rot }); benchWear.push([p[0], p[1]]);
      const sd = R.i(1, 1e6); put(p[0], p[1], g => { PR.bench(g, p[0], p[1], rot); if (sd % 3 < 2) PR.person(g, rng(sd), p[0], 0.45, p[1], rot, 'sit'); });
    }
    // --- fontanna
    put(fountain.x, fountain.z, g => PR.fountainStone(g, fountain.x, fountain.z), true);
    // --- mostek
    put(bx, (bz0 + bz1) / 2, g => PR.bridge(g, bx, bz0 - 1.4, bz1 + 1.4, 4.2), true);
    for (const z of [bz0 - 2, bz1 + 2]) for (const s of [-1, 1]) lamps.push([bx + s * 2.0, 2.4, z]);
    // --- plac zabaw i boisko
    put(plx, plz, g => PR.playground(g, rng(9), plx, plz), true);
    put(ctx0, plz, g => PR.court(g, ctx0, plz), true);
    for (const [x, z] of [[plx + 26, plz - 6], [plx + 26, plz + 6], [ctx0 + 12, plz - 8], [ctx0 + 12, plz + 8]]) { lamps.push([x, 4.2, z]); put(x, z, g => PR.lampPost(g, x, z)); }
    for (const [x, z, rot] of [[plx + 25, plz + 12, Math.PI / 2], [plx + 25, plz - 12, Math.PI / 2], [ctx0 + 11.5, plz + 13, -Math.PI / 2]]) { put(x, z, g => PR.bench(g, x, z, rot)); benchWear.push([x, z]); }
    // --- rabaty, zywoplot, koce
    beds.forEach((b, i) => put(b.x, b.z, g => PR.flowerbed(g, rng(100 + i), b.x, b.z, b.r)));
    for (const h of hedges) put((h[0] + h[2]) / 2, (h[1] + h[3]) / 2, g => PR.hedge(g, h[0], h[1], h[2], h[3]));
    for (const g0 of [[fountain.x - 16.5, fountain.z + 7, fountain.x - 16.5, fountain.z + 12]]) put(g0[0], g0[1], g => PR.hedge(g, g0[0], g0[1], g0[2], g0[3], 0.9, 0.8));
    picnics.forEach((p, i) => put(p.x, p.z, g => PR.picnic(g, rng(300 + i), p.x, p.z, p.rot)));
    // --- krzewy, kepy trawy, opadle liscie, kasztany
    for (const b of bushes) put(b.x, b.z, g => g.append(bushTpl(b.v), b.x, 0, b.z, b.x * 0.37, b.s, b.s * 0.9, b.tint));
    for (const t of trees) {
      if (t.sp === 'willow') continue;
      const sd = Math.floor((t.x * 7.3 + t.z * 3.1) * 100) & 0xffff;
      put(t.x, t.z, g => {
        const r = rng(sd + 7);
        for (let i = 0; i < 3; i++) { const a = r.r(0, 6.28), d = r.r(0.7, 2.4) * t.sx; PR.tuft(g, r, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.r(0.5, 0.85)); }
        if (t.sp === 'maple') for (let i = 0; i < 5; i++) { const a = r.r(0, 6.28), d = r.r(1.5, t.r * 0.9); PR.litter(g, r, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.r(0.7, 1.1), lc(r.pick([0xe0a050, 0xd0602a, 0xc04028, 0xe8b040, 0xb8803a]))); }
        else if (t.sp === 'oak') { for (let i = 0; i < 3; i++) { const a = r.r(0, 6.28), d = r.r(1.5, t.r * 0.8); PR.litter(g, r, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, r.r(0.6, 1), lc(r.pick([0x9a7a40, 0xb08a38, 0x7a5a2a]))); } if (sd % 3 === 0) for (let i = 0; i < 5; i++) { const a = r.r(0, 6.28), d = r.r(1, 3.4); PR.chestnut(g, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d); } }
        else if (t.sp === 'birch') { for (let i = 0; i < 2; i++) { const a = r.r(0, 6.28), d = r.r(1, 3); PR.litter(g, r, t.x + Math.cos(a) * d, t.z + Math.sin(a) * d, 0.7, lc(0xd8b840)); } }
      });
    }
    for (const p of paths) { // trawa przy krawedziach sciezek
      if (!p.walk) continue; const pts = p.closed ? p.pts.concat([p.pts[0]]) : p.pts;
      sampleAlong(pts, 4.5, 2, (px, pz, ux, uz) => {
        const s = Rb() < 0.5 ? 1 : -1, off = p.w / 2 + 0.7 + Rb() * 1.4, x = px - uz * s * off, z = pz + ux * s * off;
        if (x < PK.x0 + 2 || x > PK.x1 - 2 || z < PK.z0 + 2 || z > PK.z1 - 2 || !pondOK(x, z, -0.5) || Math.hypot(x - fountain.x, z - fountain.z) < 15) return;
        const sd = Math.floor(Rb() * 1e6); put(x, z, g => PR.tuft(g, rng(sd), x, z, 0.6 + (sd % 10) / 25));
      });
    }
    // --- drzewa do porcji
    for (const t of trees) chunkAt(t.x, t.z).trees.push(t);
    // --- swiatla latarni (halo noca)
    const lp = []; for (const l of lamps) lp.push(l[0], l[1], l[2]);
    C.glowPoints(lp, 0xffd59a, 4);
    // --- animowane: wody fontanny
    fountainWater = new THREE.Mesh(new THREE.CircleGeometry(5.3, 28), new THREE.MeshStandardMaterial({ color: 0x78a8c0, roughness: 0.05, metalness: 0.35 }));
    fountainWater.rotation.x = -Math.PI / 2; fountainWater.position.set(fountain.x, 0.66, fountain.z); scene.add(fountainWater);
    const jm = new THREE.MeshBasicMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
    fountainJets = new THREE.Group();
    const addJet = (r0, r1, h, x, y, z) => { const m = new THREE.Mesh(new THREE.ConeGeometry(r0, h, 8, 1, true), jm); m.geometry.translate(0, h / 2, 0); m.position.set(x, y, z); m.userData.base = h; fountainJets.add(m); };
    addJet(0.1, 0.5, 2.8, fountain.x, 4.9, fountain.z);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832; addJet(0.04, 0.2, 1.4, fountain.x + Math.cos(a) * 1.25, 3.9, fountain.z + Math.sin(a) * 1.25); }
    for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832; addJet(0.03, 0.15, 0.9, fountain.x + Math.cos(a) * 2.2, 2.05, fountain.z + Math.sin(a) * 2.2); }
    scene.add(fountainJets);
    // --- zywe istoty: kaczki, golebie, wiewiorki, biegacze
    initLife(C, {
      paths: paths.filter(p => p.walk && !p.name.startsWith('most') || p.name.startsWith('most')), pond: POND, fountain,
      attract: benches.map(b => [b.x, b.z]).concat([[fountain.x + 9, fountain.z], [fountain.x - 9, fountain.z], [fountain.x, fountain.z + 9], [fountain.x, fountain.z - 9]]),
      trees: trees.filter(t => t.sp !== 'willow' && t.sp !== 'spruce'), bounds: PK, arena: ARENA, blocked: (x, z) => blocked(x, z, 0.5),
    });
  }
  return plan;
}
export function animPark(t) {
  if (!fountainJets) return;
  for (const m of fountainJets.children) { const k = 0.82 + 0.18 * Math.sin(t * 9 + m.position.x * 3 + m.position.z * 5); m.scale.set(1, k, 1); }
}

// ---------------------------------------------------------------- drzewa miejskie (kraty przy ulicach, kieszonkowe parki)
export function addCityTrees(list) {
  material();
  const R = rng(777);
  for (const t of list) {
    const pit = !!t.pit, sp = R.pick(pit ? ['oak', 'maple', 'maple', 'birch', 'oak'] : ['oak', 'maple', 'birch', 'maple', 'spruce']);
    const sc = pit ? R.r(0.46, 0.6) : R.r(0.6, 0.95) * (t.s / 2.4 + 0.3);
    const tr = { sp, v: R.i(0, VARIANTS[sp] - 1), x: t.x, z: t.z, rot: R.r(0, 6.28), sx: sc * (pit ? 0.85 : 1), sy: sc * (pit ? 1.12 : 1), tint: lc(R.pick(TINTS[sp])).map(v => v * R.r(0.92, 1.08)) };
    chunkAt(t.x, t.z).trees.push(tr);
  }
}
