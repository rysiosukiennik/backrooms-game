// Park: zywe istoty (instancing, kilkanascie sztuk): biegacze i spacerowicze na sciezkach, kaczki ze stawu (z kaczatkami),
// golebie (uciekaja przed graczem), wiewiorki (chowaja sie na drzewach). Symulowane tylko gdy gracz jest blisko parku.
import { P, camera, scene } from './stan.js';
import { Geo, box, cyl, sph, lc, rng } from './park_geo.js';

let K = null; // dane parku
const meshes = [], M0 = new THREE.Matrix4(), M1 = new THREE.Matrix4(), M2 = new THREE.Matrix4(), tmpO = new THREE.Object3D(), tmpC = new THREE.Color();
const mkMesh = (geo, n, color = true) => {
  const m = new THREE.InstancedMesh(geo.toBuffer(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 }), n);
  m.frustumCulled = false; m.count = 0; m.castShadow = false; m.receiveShadow = false;
  if (color) { const c = new THREE.Color(1, 1, 1); for (let i = 0; i < n; i++) m.setColorAt(i, c); m.instanceColor.needsUpdate = true; }
  scene.add(m); meshes.push(m); return m;
};
const setCol = (m, i, hex) => { tmpC.setHex(hex).convertSRGBToLinear(); m.setColorAt(i, tmpC); m.instanceColor.needsUpdate = true; };
const W1 = [1, 1, 1];

// ---------------------------------------------------------------- geometrie postaci
function walkerGeos() {
  const skin = lc(0xe8c4a0), hair = lc(0x3a2a1c);
  const torso = new Geo(); box(torso, 0, 0.92, 0, 0.4, 0.58, 0.23, 0, W1); box(torso, 0, 0.8, 0, 0.36, 0.14, 0.215, 0, [0.7, 0.7, 0.7]);
  const head = new Geo(); sph(head, 0, 1.68, 0.01, 0.115, 0.135, 0.12, 8, skin); sph(head, 0, 1.73, -0.02, 0.122, 0.11, 0.125, 8, hair); box(head, 0, 1.46, 0.0, 0.1, 0.1, 0.1, 0, skin);
  const leg = new Geo(); box(leg, 0, -0.84, 0, 0.16, 0.84, 0.17, 0, W1, false); box(leg, 0, -0.92, 0.04, 0.15, 0.09, 0.27, 0, [0.12, 0.12, 0.12], false);
  const arm = new Geo(); box(arm, 0, -0.55, 0, 0.09, 0.56, 0.1, 0, skin, false);
  return { torso, head, leg, arm };
}
function duckGeo(kid) {
  const g = new Geo(), grn = lc(0x1f6a3a), brn = lc(0x8a5a38), gry = lc(0xa8a8a0), wht = lc(0xf0f0e8), org = lc(0xe8a020), dk = lc(0x2a2a28);
  sph(g, 0, 0.09, 0, 0.12, 0.09, 0.2, 8, gry); sph(g, 0, 0.12, 0.12, 0.1, 0.09, 0.1, 6, brn); sph(g, 0, 0.17, -0.2, 0.05, 0.05, 0.08, 5, dk);
  sph(g, 0, 0.21, 0.19, 0.055, 0.075, 0.055, 6, wht); sph(g, 0, 0.27, 0.22, 0.062, 0.062, 0.062, 7, grn); box(g, 0, 0.255, 0.27, 0.05, 0.02, 0.09, 0, org);
  for (const s of [-1, 1]) sph(g, s * 0.1, 0.12, -0.02, 0.025, 0.05, 0.13, 5, brn);
  return g;
}
function pigeonGeo(wing) {
  const g = new Geo(), gr = lc(0x8a8f98), dk = lc(0x4a4e58), nk = lc(0x3a6a7a), org = lc(0xd88a8a), wt = lc(0xe4e4e4);
  sph(g, 0, 0.1, 0, 0.065, 0.065, 0.12, 6, gr); sph(g, 0, 0.17, 0.08, 0.04, 0.05, 0.05, 6, nk); sph(g, 0, 0.2, 0.115, 0.032, 0.032, 0.035, 5, dk); box(g, 0, 0.19, 0.15, 0.012, 0.012, 0.03, 0, org);
  box(g, 0, 0.1, -0.15, 0.05, 0.015, 0.1, 0, dk); box(g, 0, 0.0, 0.0, 0.01, 0.07, 0.01, 0, org);
  if (wing === 0) { for (const s of [-1, 1]) box(g, s * 0.062, 0.09, -0.01, 0.015, 0.06, 0.18, 0, dk); }
  else { const y = wing === 1 ? 1 : -1; for (const s of [-1, 1]) { for (let i = 1; i <= 3; i++) box(g, s * i * 0.07, 0.12 + y * i * 0.05, -0.02, 0.07, 0.012, 0.13 - i * 0.015, 0, i === 3 ? dk : gr); box(g, s * 0.2, 0.12 + y * 0.15, -0.02, 0.03, 0.012, 0.05, 0, wt); } }
  return g;
}
function squirrelGeo() {
  const g = new Geo(), fur = lc(0x9a8a78), tail = lc(0xb0a090), wt = lc(0xe8e0d0), dk = lc(0x1a1a1a);
  sph(g, 0, 0.11, 0, 0.055, 0.07, 0.11, 6, fur); sph(g, 0, 0.19, 0.09, 0.045, 0.045, 0.05, 6, fur); sph(g, 0, 0.1, 0.09, 0.04, 0.05, 0.03, 5, wt);
  sph(g, 0, 0.2, 0.13, 0.012, 0.012, 0.012, 4, dk); for (const s of [-1, 1]) sph(g, s * 0.025, 0.24, 0.075, 0.012, 0.025, 0.01, 4, fur);
  sph(g, 0, 0.14, -0.14, 0.04, 0.05, 0.08, 6, tail); sph(g, 0, 0.24, -0.2, 0.05, 0.07, 0.07, 6, tail); sph(g, 0, 0.33, -0.17, 0.045, 0.06, 0.06, 6, tail);
  return g;
}

// ---------------------------------------------------------------- trasy
function route(pts, closed) {
  const p = closed ? pts.concat([pts[0]]) : pts, cum = [0];
  for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  return { p, cum, L: cum[cum.length - 1], closed };
}
function at(r, s, out) {
  let lo = 0, hi = r.cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; }
  const t = (s - r.cum[lo]) / ((r.cum[hi] - r.cum[lo]) || 1), a = r.p[lo], b = r.p[hi];
  out.x = a[0] + (b[0] - a[0]) * t; out.z = a[1] + (b[1] - a[1]) * t; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.dx = (b[0] - a[0]) / l; out.dz = (b[1] - a[1]) / l;
}

let walkers = [], ducks = [], pigeons = [], squirrels = [], WM = null, DM = null, PM = null, SM = null, active = false;
const _o = { x: 0, z: 0, dx: 0, dz: 1 };

export function initLife(ctx, data) {
  K = data;
  const R = rng(4711), PK = data.bounds, pond = data.pond;
  // ----- spacerowicze i biegacze
  const gts = walkerGeos(), routes = data.paths.filter(p => !p.name.startsWith('most') && p.pts.length >= 2).map(p => route(p.pts, p.closed));
  const NW = 19;
  WM = { torso: mkMesh(gts.torso, NW), head: mkMesh(gts.head, NW), leg: mkMesh(gts.leg, NW * 2), arm: mkMesh(gts.arm, NW * 2) };
  const shirts = [0xd94a3a, 0x3a6ad9, 0xf0c63a, 0x4aa86a, 0xf0f0f0, 0xd96aa8, 0x2a2a30, 0xe8883a, 0x7a4ad9, 0x20a0b0], pants = [0x2a3a5a, 0x3a3a3e, 0x6a5a3a, 0x1c1c20, 0x4a6a8a, 0x222222, 0x8a3a3a];
  const tones = [0xffffff, 0xe8c8a8, 0xc89870, 0x9a6a48, 0x6a4430];
  let n = 0;
  const add = (rt, run, s0, dir, lat) => {
    if (walkers.length >= NW) return;
    walkers.push({ r: rt, run, s: s0, dir, lat, ph: R.r(0, 6), v: run ? R.r(2.7, 3.6) : R.r(1.2, 1.5), sc: R.r(0.93, 1.06), x: 0, z: 0, yaw: 0 });
    const i = walkers.length - 1, pc = R.pick(pants), tn = R.pick(tones);
    setCol(WM.torso, i, R.pick(shirts)); setCol(WM.leg, i * 2, pc); setCol(WM.leg, i * 2 + 1, pc);
    setCol(WM.head, i, tn); setCol(WM.arm, i * 2, tn); setCol(WM.arm, i * 2 + 1, tn);
  };
  for (let i = 0; i < 8; i++) { const rt = R.pick(routes); add(rt, true, R.r(0, rt.L), R() < 0.5 ? 1 : -1, R.r(-1.2, 1.2)); }
  for (let i = 0; i < 5; i++) { const rt = R.pick(routes), s0 = R.r(0, rt.L), d = R() < 0.5 ? 1 : -1, l = R.r(-0.8, 0.8); add(rt, false, s0, d, l - 0.45); add(rt, false, s0 + 0.05, d, l + 0.45); walkers[walkers.length - 1].v = walkers[walkers.length - 2].v; }
  // ----- kaczki
  const dg = duckGeo(), ND = 15; DM = mkMesh(dg, ND);
  for (let i = 0; i < ND; i++) {
    const a = R.r(0, 6.28), r = Math.sqrt(R()) * 0.7, kid = i >= 9, mom = kid ? (i - 9) % 3 : -1;
    ducks.push({ x: pond.x + Math.cos(a) * pond.rx * r, z: pond.z + Math.sin(a) * pond.rz * r, yaw: R.r(0, 6.28), tx: 0, tz: 0, t: 0, sp: R.r(0.5, 0.9), kid, mom, off: kid ? 0.7 + Math.floor((i - 9) / 3) * 0.55 : 0, sc: kid ? 0.45 : R.r(0.95, 1.1) });
    const f = R.r(0.7, 1.1); tmpC.setRGB(f, f * R.r(0.85, 1), f * R.r(0.75, 1)).convertSRGBToLinear(); DM.setColorAt(i, tmpC);
  }
  DM.instanceColor.needsUpdate = true;
  // ----- golebie
  const NP = 21; PM = [mkMesh(pigeonGeo(0), NP, false), mkMesh(pigeonGeo(1), NP, false), mkMesh(pigeonGeo(2), NP, false)];
  const A = data.attract;
  for (let i = 0; i < NP; i++) { const a = R.pick(A); pigeons.push({ x: a[0] + R.r(-3, 3), z: a[1] + R.r(-3, 3), y: 0.09, yaw: R.r(0, 6.28), st: 'peck', t: R.r(0, 4), tx: 0, tz: 0, fx: 0, fz: 0, ft: 0, ph: R.r(0, 6) }); }
  // ----- wiewiorki
  const NS = 7; SM = mkMesh(squirrelGeo(), NS, false);
  for (let i = 0; i < NS; i++) { const t = R.pick(data.trees); squirrels.push({ x: t.x + R.r(-3, 3), z: t.z + R.r(-3, 3), y: 0, yaw: R.r(0, 6.28), st: 'sit', t: R.r(0, 5), tx: 0, tz: 0, hop: 0, home: t, climb: 0 }); }
}

const _m = new THREE.Matrix4();
function put(mesh, i, x, y, z, yaw, sc, rx = 0, rz = 0) {
  tmpO.position.set(x, y, z); tmpO.rotation.set(rx, yaw, rz); tmpO.scale.setScalar(sc); tmpO.updateMatrix(); mesh.setMatrixAt(i, tmpO.matrix);
}
const angTo = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };

export function updateLife(dt, time) {
  if (!K || !WM) return;
  const cx = camera.position.x, cz = camera.position.z, PK = K.bounds;
  const near = cx > PK.x0 - 260 && cx < PK.x1 + 260 && cz > PK.z0 - 260 && cz < PK.z1 + 260;
  if (!near) { if (active) { for (const m of meshes) m.visible = false; active = false; } return; }
  if (!active) { for (const m of meshes) m.visible = true; active = true; }
  dt = Math.min(dt, 0.05);
  const px = P.pos.x, pz = P.pos.z, py = P.pos.y;
  // ----- biegacze / spacerowicze
  walkers.forEach((w, i) => {
    w.s += w.v * dt * w.dir;
    if (w.r.closed) { if (w.s > w.r.L) w.s -= w.r.L; if (w.s < 0) w.s += w.r.L; } else if (w.s > w.r.L) { w.s = w.r.L; w.dir = -1; } else if (w.s < 0) { w.s = 0; w.dir = 1; }
    at(w.r, w.s, _o); const nx = -_o.dz * w.lat, nz = _o.dx * w.lat; w.x = _o.x + nx; w.z = _o.z + nz;
    const yaw = Math.atan2(_o.dx * w.dir, _o.dz * w.dir); w.yaw = w.yaw ? angTo(w.yaw, yaw, Math.min(1, dt * 6)) : yaw;
    w.ph += dt * w.v * (w.run ? 2.5 : 3.4);
    const sw = Math.sin(w.ph) * (w.run ? 0.95 : 0.5), bob = Math.abs(Math.cos(w.ph)) * (w.run ? 0.06 : 0.025), y = 0.09 + bob;
    tmpO.position.set(w.x, y, w.z); tmpO.rotation.set(w.run ? 0.12 : 0.03, w.yaw, 0); tmpO.scale.setScalar(w.sc); tmpO.updateMatrix(); M0.copy(tmpO.matrix);
    WM.torso.setMatrixAt(i, M0); WM.head.setMatrixAt(i, M0);
    for (let s = 0; s < 2; s++) {
      const sg = s ? 1 : -1;
      M1.makeTranslation(sg * 0.1, 0.92, 0); M2.makeRotationX(sw * -sg); M1.multiply(M2); WM.leg.setMatrixAt(i * 2 + s, _m.copy(M0).multiply(M1));
      M1.makeTranslation(sg * 0.27, 1.43, 0); M2.makeRotationX(sw * sg * (w.run ? 1.1 : 0.8) - (w.run ? 0.7 : 0.05)); M1.multiply(M2); WM.arm.setMatrixAt(i * 2 + s, _m.copy(M0).multiply(M1));
    }
  });
  WM.torso.count = WM.head.count = walkers.length; WM.leg.count = WM.arm.count = walkers.length * 2;
  for (const k of Object.keys(WM)) WM[k].instanceMatrix.needsUpdate = true;
  // ----- kaczki
  const pond = K.pond;
  ducks.forEach((d, i) => {
    if (d.kid) { const m = ducks[d.mom], bx = m.x - Math.sin(m.yaw) * d.off * 1.6 + Math.cos(m.yaw) * (i % 2 ? 0.25 : -0.25), bz = m.z - Math.cos(m.yaw) * d.off * 1.6 - Math.sin(m.yaw) * (i % 2 ? 0.25 : -0.25); const dx = bx - d.x, dz = bz - d.z, l = Math.hypot(dx, dz); const sp = Math.min(1.4, l * 1.5); if (l > 0.05) { d.x += dx / l * sp * dt; d.z += dz / l * sp * dt; d.yaw = angTo(d.yaw, Math.atan2(dx, dz), Math.min(1, dt * 5)); } }
    else {
      d.t -= dt;
      if (d.t <= 0) { const a = Math.random() * 6.28, r = 0.25 + Math.sqrt(Math.random()) * 0.55; d.tx = pond.x + Math.cos(a) * pond.rx * r; d.tz = pond.z + Math.sin(a) * pond.rz * r; d.t = 6 + Math.random() * 12; d.sp = 0.45 + Math.random() * 0.45; }
      const dx = d.tx - d.x, dz = d.tz - d.z, l = Math.hypot(dx, dz);
      if (l > 1.2) { d.yaw = angTo(d.yaw, Math.atan2(dx, dz), Math.min(1, dt * 1.6)); d.x += Math.sin(d.yaw) * d.sp * dt; d.z += Math.cos(d.yaw) * d.sp * dt; }
    }
    const e = Math.pow((d.x - pond.x) / (pond.rx * 0.92), 2) + Math.pow((d.z - pond.z) / (pond.rz * 0.92), 2);
    if (e > 1) { d.x = pond.x + (d.x - pond.x) / Math.sqrt(e); d.z = pond.z + (d.z - pond.z) / Math.sqrt(e); }
    put(DM, i, d.x, 0.1 + Math.sin(time * 1.8 + i) * 0.012, d.z, d.yaw, d.sc, Math.sin(time * 1.3 + i * 2) * 0.03, Math.sin(time * 1.1 + i) * 0.03);
  });
  DM.count = ducks.length; DM.instanceMatrix.needsUpdate = true;
  // ----- golebie
  let c0 = 0, c1 = 0, c2 = 0; const A = K.attract;
  for (const b of pigeons) {
    const dx = b.x - px, dz = b.z - pz, dd = Math.hypot(dx, dz);
    if (b.st !== 'fly' && dd < 7 && Math.abs(py - b.y) < 12) { // plosza sie
      const a = A[Math.floor(Math.random() * A.length)]; b.st = 'fly'; b.ft = 0; b.fx = a[0] + (Math.random() - 0.5) * 6; b.fz = a[1] + (Math.random() - 0.5) * 6;
      if (Math.hypot(b.fx - b.x, b.fz - b.z) < 20) { const an = Math.atan2(dz, dx) + (Math.random() - 0.5); b.fx = b.x + Math.cos(an) * 35; b.fz = b.z + Math.sin(an) * 35; }
      b.sx = b.x; b.sz = b.z; b.dur = 2.6 + Math.random() * 1.2; b.yaw = Math.atan2(b.fx - b.x, b.fz - b.z);
    }
    let wing = 0, y = 0.09, rx = 0;
    if (b.st === 'fly') {
      b.ft += dt; const u = Math.min(1, b.ft / b.dur); b.x = b.sx + (b.fx - b.sx) * u; b.z = b.sz + (b.fz - b.sz) * u; y = 0.09 + Math.sin(u * Math.PI) * 7;
      wing = Math.floor((b.ft + b.ph) * 11) % 2 ? 1 : 2; rx = -0.25 * Math.cos(u * Math.PI); if (u >= 1) { b.st = 'peck'; b.t = 1 + Math.random() * 3; }
    } else {
      b.t -= dt;
      if (b.st === 'peck') { rx = 0.5 * Math.max(0, Math.sin((time + b.ph) * 5.5)); if (b.t <= 0) { b.st = 'walk'; b.t = 1 + Math.random() * 2; const a = Math.random() * 6.28; b.tx = b.x + Math.cos(a) * 2; b.tz = b.z + Math.sin(a) * 2; } }
      else { const ddx = b.tx - b.x, ddz = b.tz - b.z, l = Math.hypot(ddx, ddz); if (l > 0.15) { b.yaw = angTo(b.yaw, Math.atan2(ddx, ddz), Math.min(1, dt * 8)); b.x += ddx / l * 0.55 * dt; b.z += ddz / l * 0.55 * dt; y = 0.09 + Math.abs(Math.sin(time * 9 + b.ph)) * 0.01; rx = Math.sin(time * 9 + b.ph) * 0.1; } if (b.t <= 0 || l <= 0.15) { b.st = 'peck'; b.t = 1 + Math.random() * 3; } }
    }
    const M = PM[wing]; put(M, wing === 0 ? c0++ : wing === 1 ? c1++ : c2++, b.x, y, b.z, b.yaw, 1, rx);
  }
  PM[0].count = c0; PM[1].count = c1; PM[2].count = c2; for (const m of PM) m.instanceMatrix.needsUpdate = true;
  // ----- wiewiorki
  squirrels.forEach((q, i) => {
    const dx = q.x - px, dz = q.z - pz, dd = Math.hypot(dx, dz); let y = 0, rx = 0;
    if (q.st !== 'flee' && q.st !== 'climb' && q.st !== 'hide' && dd < 8) { q.st = 'flee'; q.t = 0; }
    if (q.st === 'sit') { q.t -= dt; rx = -0.35 + Math.sin(time * 3 + i) * 0.04; if (q.t <= 0) { q.st = 'hop'; q.t = 1.5 + Math.random() * 3; const a = Math.random() * 6.28, l = 2 + Math.random() * 5; q.tx = q.home.x + Math.cos(a) * l; q.tz = q.home.z + Math.sin(a) * l; } }
    else if (q.st === 'hop') {
      const ddx = q.tx - q.x, ddz = q.tz - q.z, l = Math.hypot(ddx, ddz); q.hop += dt * 9;
      if (l > 0.3) { q.yaw = angTo(q.yaw, Math.atan2(ddx, ddz), Math.min(1, dt * 10)); q.x += ddx / l * 2.4 * dt; q.z += ddz / l * 2.4 * dt; y = Math.abs(Math.sin(q.hop)) * 0.18; } else { q.st = 'sit'; q.t = 1 + Math.random() * 4; }
    } else if (q.st === 'flee') {
      const t = q.home, ddx = t.x - q.x, ddz = t.z - q.z, l = Math.hypot(ddx, ddz); q.hop += dt * 14;
      if (l > 0.9) { q.yaw = angTo(q.yaw, Math.atan2(ddx, ddz), Math.min(1, dt * 12)); q.x += ddx / l * 6 * dt; q.z += ddz / l * 6 * dt; y = Math.abs(Math.sin(q.hop)) * 0.22; } else { q.st = 'climb'; q.climb = 0; }
    } else if (q.st === 'climb') {
      q.climb += dt * 2.6; y = q.climb; rx = -1.4; q.x += (q.home.x - q.x) * dt * 4; q.z += (q.home.z - q.z) * dt * 4;
      if (q.climb > 4.5) { q.st = 'hide'; q.t = 6 + Math.random() * 6; }
    } else if (q.st === 'hide') { y = -50; q.t -= dt; if (q.t <= 0 && dd > 14) { q.st = 'sit'; q.t = 2; q.x = q.home.x + 1.6; q.z = q.home.z + 1.2; } }
    put(SM, i, q.x, y, q.z, q.yaw, 1, rx);
  });
  SM.count = squirrels.length; SM.instanceMatrix.needsUpdate = true;
}
