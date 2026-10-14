// Modele postaci: jedna gladka "skora" na szkielecie (SkinnedMesh) — zgina sie plynnie w lokciach,
// kolanach i biodrach. Do tego dlonie z palcami (otwarte / piesc / gest "thwip"), buty, glowy
// z twarzami i czapkami, ubrania i stroje rysowane na teksturach (z wypukla pajeczyna).
import { V3, cv, canvasTex, clamp } from './util.js';

const TAU = Math.PI * 2;
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);

// ---------------------------------------------------------------- szkielet
export const BN = { body: 0, spine: 1, chest: 2, neck: 3, shL: 4, elL: 5, shR: 6, elR: 7, hipL: 8, knL: 9, ftL: 10, hipR: 11, knR: 12, ftR: 13 };
const MIRB = { 4: 6, 5: 7, 8: 11, 9: 12, 10: 13 };
const SHY = 1.45, HIPY = 0.91, HC = 0.125; // HC: srodek glowy nad koscia szyi

// sylwetki
export const BODY = {
  spider: { w: 1, chest: 1, waist: 1, belly: 0, pec: 1, hips: 1, arm: 1, leg: 1, neck: 1, head: 1 },
  thug: { w: 0.97, chest: 0.93, waist: 1.08, belly: 0.1, pec: 0.3, hips: 1.02, arm: 0.93, leg: 1, neck: 1.05, head: 1 },
  brute: { w: 1.16, chest: 1.12, waist: 1.16, belly: 0.08, pec: 1.4, hips: 1.14, arm: 1.4, leg: 1.18, neck: 1.35, head: 1.02 },
  fisk: { w: 1.34, chest: 1.24, waist: 1.6, belly: 0.55, pec: 0.4, hips: 1.32, arm: 1.32, leg: 1.1, neck: 1.6, head: 1.42 },
  boss: { w: 1.2, chest: 1.18, waist: 1.2, belly: 0.05, pec: 1.1, hips: 1.22, arm: 1.45, leg: 1.25, neck: 1.5, head: 1.05 },
};

function makeRig(b) {
  const H = {}, B = () => new THREE.Bone();
  H.root = new THREE.Group();
  H.body = B(); H.body.position.y = 0.95; H.root.add(H.body);
  H.spine = B(); H.spine.position.y = 0.06; H.body.add(H.spine);
  H.chest = B(); H.chest.position.y = 0.24; H.spine.add(H.chest);
  H.neck = B(); H.neck.position.y = 0.29; H.chest.add(H.neck);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = B(); sh.position.set(0.215 * b.w * s, 0.2, 0); H.chest.add(sh); H['sh' + L] = sh;
    const el = B(); el.position.y = -0.28; sh.add(el); H['el' + L] = el;
    const hand = new THREE.Group(); hand.position.y = -0.3; el.add(hand); H['hand' + L] = hand;
    const hp = B(); hp.position.set(0.09 * b.hips * s, -0.04, 0); H.body.add(hp); H['hip' + L] = hp;
    const kn = B(); kn.position.y = -0.42; hp.add(kn); H['kn' + L] = kn;
    const ft = B(); ft.position.y = -0.41; kn.add(ft); H['ft' + L] = ft;
  }
  H.bones = [H.body, H.spine, H.chest, H.neck, H.shL, H.elL, H.shR, H.elR, H.hipL, H.knL, H.ftL, H.hipR, H.knR, H.ftR];
  return H;
}

// ---------------------------------------------------------------- geometria: pierscienie
const KEYS = ['y', 'rx', 'rz', 'cx', 'cz', 'n', 'fb', 'bb', 'pec'];
const norm = r => { const o = {}; for (const k of KEYS) o[k] = r[k] ?? (k === 'n' ? 2 : 0); return o; };
function smooth(ctrl, sub) {
  ctrl = ctrl.map(norm); const out = [];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
    for (let s = 0; s < sub; s++) { const t = s / sub, r = {}; for (const k of KEYS) r[k] = cr(p0[k], p1[k], p2[k], p3[k], t); out.push(r); }
  }
  out.push({ ...ctrl[ctrl.length - 1] }); return out;
}
function packW(W, sk, sw) {
  const e = Object.entries(W).filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
  let t = 0; for (const [, w] of e) t += w;
  for (let j = 0; j < 4; j++) { if (e[j]) { sk.push(+e[j][0]); sw.push(e[j][1] / t); } else { sk.push(0); sw.push(0); } }
}
// pionowa "rura" z pierscieni (od dolu do gory). Przod postaci (+Z) jest w u = 0.5.
function tubeData(rings, segs, vOf, wFn) {
  const pos = [], uv = [], idx = [], sk = [], sw = [];
  for (const r of rings) {
    const v = vOf(r);
    for (let i = 0; i <= segs; i++) {
      const u = i / segs, a = (u - 0.5) * TAU + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / r.n), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / r.n);
      let rz = r.rz;
      if (s > 0) { rz *= 1 + r.fb * s * s; if (r.pec) rz *= 1 + r.pec * Math.exp(-(((Math.abs(c) - 0.42) / 0.2) ** 2)) * s; }
      else rz *= 1 + r.bb * s * s;
      const x = r.cx + r.rx * ex, z = r.cz + rz * ez;
      pos.push(x, r.y, z); uv.push(u, v);
      if (wFn) packW(wFn(x, r.y, z), sk, sw);
    }
  }
  const S = segs + 1;
  for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, b = a + 1, d = a + S, c = d + 1; idx.push(a, c, b, a, d, c); }
  return { pos, uv, idx, sk, sw, seams: [{ start: 0, S, R: rings.length }] };
}
// "rura" wzdluz dowolnej linii (palce, buty)
const _T = new V3(), _N = new V3(), _B = new V3(), _P = new V3();
function sweepData(pts, rad, segs, ref, n = 2) {
  const pos = [], uv = [], idx = []; const S = segs + 1; let len = 0; const L = [];
  for (let k = 0; k < pts.length; k++) { if (k) len += pts[k].distanceTo(pts[k - 1]); L.push(len); }
  for (let k = 0; k < pts.length; k++) {
    _T.subVectors(pts[Math.min(k + 1, pts.length - 1)], pts[Math.max(k - 1, 0)]).normalize();
    _N.crossVectors(_T, ref).normalize(); _B.crossVectors(_T, _N);
    const [rx, ry] = Array.isArray(rad[k]) ? rad[k] : [rad[k], rad[k]];
    for (let i = 0; i <= segs; i++) {
      const a = i / segs * TAU, c = Math.cos(a), s = Math.sin(a);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      _P.copy(pts[k]).addScaledVector(_N, ex * rx).addScaledVector(_B, ey * ry);
      pos.push(_P.x, _P.y, _P.z); uv.push(i / segs, L[k] / (len || 1));
    }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, b = a + 1, c = b + S, d = a + S; idx.push(a, b, c, a, c, d); }
  return { pos, uv, idx, sk: [], sw: [], seams: [{ start: 0, S, R: pts.length }] };
}
function mirror(d) {
  const pos = d.pos.slice(); for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i];
  const idx = []; for (let i = 0; i < d.idx.length; i += 3) idx.push(d.idx[i], d.idx[i + 2], d.idx[i + 1]);
  return { pos, uv: d.uv.slice(), idx, sk: d.sk.map(b => MIRB[b] ?? b), sw: d.sw.slice(), seams: d.seams };
}
function merge(list) {
  const o = { pos: [], uv: [], idx: [], sk: [], sw: [], seams: [] };
  for (const d of list) {
    const off = o.pos.length / 3;
    o.pos.push(...d.pos); o.uv.push(...d.uv); o.sk.push(...d.sk); o.sw.push(...d.sw);
    for (const i of d.idx) o.idx.push(i + off);
    for (const s of d.seams) o.seams.push({ ...s, start: s.start + off });
  }
  return o;
}
function toGeo(d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(d.pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(d.uv, 2));
  if (d.sk.length) {
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(d.sk, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(d.sw, 4));
  }
  g.setIndex(d.idx); g.computeVertexNormals();
  const n = g.attributes.normal; // wspolna normalna na szwie (bez widocznej kreski)
  for (const s of d.seams) for (let k = 0; k < s.R; k++) {
    const a = s.start + k * s.S, b = a + s.S - 1;
    const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
    n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
  }
  return g;
}

// ---------------------------------------------------------------- cialo
function torsoRings(b) {
  const w = b.w, ch = b.chest, wa = b.waist, be = b.belly, pe = b.pec, hp = b.hips, nk = b.neck;
  return [
    { y: 0.79, rx: 0.03, rz: 0.03 },
    { y: 0.815, rx: 0.1 * hp, rz: 0.08 },
    { y: 0.86, rx: 0.152 * hp, rz: 0.112, bb: 0.15, cz: -0.006, n: 2.3 },
    { y: 0.93, rx: 0.158 * hp, rz: 0.112, bb: 0.1, cz: -0.005, n: 2.4 },
    { y: 1.01, rx: 0.147 * wa, rz: 0.1 * wa, fb: be * 0.7, n: 2.4 },
    { y: 1.09, rx: 0.14 * wa, rz: 0.098 * wa, fb: 0.04 + be, n: 2.4 },
    { y: 1.17, rx: 0.152 * ch, rz: 0.104 * ch, fb: 0.06 + be * 0.5, n: 2.4 },
    { y: 1.25, rx: 0.174 * ch * w, rz: 0.113 * ch, fb: 0.07, pec: 0.03 * pe, n: 2.5, cz: 0.005 },
    { y: 1.33, rx: 0.192 * ch * w, rz: 0.12 * ch, fb: 0.06, pec: 0.1 * pe, n: 2.6, cz: 0.01 },
    { y: 1.4, rx: 0.208 * ch * w, rz: 0.118 * ch, fb: 0.04, pec: 0.07 * pe, n: 2.7, cz: 0.01 },
    // barki: tulow obejmuje gore ramienia, zeby nie wystawala jak kulka
    { y: 1.45, rx: 0.232 * w, rz: 0.104 * ch, n: 3 },
    { y: 1.49, rx: 0.2 * w, rz: 0.092 * ch, n: 2.6, cz: -0.004 },
    { y: 1.525, rx: 0.135 * w, rz: 0.08 * nk, n: 2.3, cz: -0.004 },
    { y: 1.555, rx: 0.08 * nk, rz: 0.072 * nk, cz: 0.004 },
    { y: 1.6, rx: 0.064 * nk, rz: 0.064 * nk, cz: 0.01 },
    { y: 1.68, rx: 0.045, rz: 0.045, cz: 0.015 },
  ];
}
function armRings(b) {
  const a = b.arm, X = 0.215 * b.w;
  // [t wzgledem barku, rx, rz, cx, przod (biceps), tyl (triceps)]
  return [
    [-0.56, 0.012, 0.012], [-0.545, 0.028, 0.025], [-0.52, 0.032, 0.028], [-0.46, 0.037, 0.032], [-0.4, 0.044, 0.039],
    [-0.34, 0.049, 0.044], [-0.295, 0.045, 0.042], [-0.25, 0.048, 0.046, 0, 0, 0.05], [-0.18, 0.054, 0.052, 0, 0.14, 0.08],
    [-0.1, 0.059, 0.057, 0.003, 0.1, 0.1], [-0.03, 0.064, 0.06, 0.006], [0.01, 0.062, 0.057, 0.006], [0.035, 0.046, 0.044, 0.004], [0.055, 0.018, 0.018],
  ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => ({ y: SHY + t, rx: rx * a, rz: rz * a, cx: X + cx * a, fb, bb }));
}
function legRings(b) {
  const l = b.leg, X = 0.09 * b.hips;
  return [
    [-0.87, 0.02, 0.02], [-0.85, 0.036, 0.04], [-0.82, 0.041, 0.045], [-0.75, 0.045, 0.05, 0, 0, 0.1], [-0.66, 0.051, 0.058, 0, 0, 0.2],
    [-0.57, 0.058, 0.066, 0, 0, 0.28], [-0.49, 0.057, 0.062], [-0.44, 0.058, 0.063, 0, 0.08], [-0.36, 0.067, 0.072, 0, 0.12],
    [-0.26, 0.078, 0.083, 0.004, 0.12], [-0.15, 0.088, 0.092, 0.008, 0.1], [-0.04, 0.096, 0.098, 0.01, 0, 0.05], [0.05, 0.095, 0.096, 0.01], [0.12, 0.05, 0.05],
  ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => { const m = Math.min(l, b.hips), k = m + (l - m) * sm(-0.02, -0.3, t); return { y: HIPY + t, rx: rx * k, rz: rz * k, cx: X + cx, fb, bb }; });
}
const wTorso = (x, y) => {
  const W = {}, t1 = sm(0.97, 1.05, y), t2 = sm(1.19, 1.29, y), t3 = sm(1.53, 1.6, y);
  let body = 1 - t1; const hl = clamp((0.93 - y) / 0.12, 0, 1) * 0.6 * sm(0.01, 0.07, Math.abs(x));
  if (hl > 0) { W[x > 0 ? BN.hipL : BN.hipR] = hl; body *= 1 - hl; }
  W[BN.body] = body; W[BN.spine] = t1 * (1 - t2); W[BN.chest] = t2 * (1 - t3); W[BN.neck] = t3; return W;
};
const wArm = (x, y) => { const t = y - SHY, e = sm(-0.34, -0.22, t), c = sm(0, 0.08, t) * 0.3; return { [BN.chest]: c, [BN.shL]: e * (1 - c), [BN.elL]: 1 - e }; };
const wLeg = (x, y) => {
  const t = y - HIPY, e = sm(-0.5, -0.36, t), f = 1 - sm(-0.86, -0.8, t), top = sm(0, 0.1, t) * 0.35;
  return { [BN.body]: top, [BN.hipL]: e * (1 - top), [BN.knL]: (1 - e) * (1 - f), [BN.ftL]: (1 - e) * f };
};
// wysokosci na teksturach (px)
export const TY = y => (1 - (y - 0.79) / 0.91) * 512;
export const AY = t => (1 - (t + 0.56) / 0.655) * 512;
export const LY = t => (1 - (t + 0.87) / 0.99) * 512;

// glowa (w przestrzeni kosci szyi)
function headPoint(a, phi, b, face, out) {
  const hs = b.head, c = Math.cos(a), s = Math.sin(a), cp = Math.cos(phi), sp = Math.sin(phi);
  let x = 0.098 * hs * cp * c, y = 0.122 * hs * sp, z = 0.108 * hs * cp * s;
  if (sp < 0) { x *= 1 + 0.28 * sp; z *= s > 0 ? 1 + 0.05 * sp : 1 + 0.22 * sp; }
  if (sp > 0.1 && s < 0) z *= 1 + 0.07 * sp;
  if (face) {
    const da = a - Math.PI / 2, fa = Math.exp(-((da / 0.14) ** 2));
    z += 0.024 * hs * fa * Math.exp(-(((sp + 0.06) / 0.1) ** 2));            // nos
    z += 0.007 * hs * Math.exp(-((da / 0.5) ** 2)) * Math.exp(-(((sp - 0.24) / 0.06) ** 2)); // luki brwiowe
    z += 0.01 * hs * fa * Math.exp(-(((sp + 0.55) / 0.12) ** 2));            // broda
  }
  return out.set(x, HC + y, 0.012 + z);
}
function headData(b, face, segs = 40, rings = 28) {
  const pos = [], uv = [], idx = [], P = new V3();
  for (let k = 0; k <= rings; k++) {
    const phi = -Math.PI / 2 + k / rings * Math.PI;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs; headPoint((u - 0.5) * TAU + Math.PI / 2, phi, b, face, P);
      pos.push(P.x, P.y, P.z); uv.push(u, k / rings);
    }
  }
  const S = segs + 1;
  for (let k = 0; k < rings; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, bb = a + 1, d = a + S, c = d + 1; idx.push(a, c, bb, a, d, c); }
  return { pos, uv, idx, sk: [], sw: [], seams: [{ start: 0, S, R: rings + 1 }] };
}
// soczewki oczu Spider-Mana (ksztalt lzy, dopasowane do glowy)
function lensData(b, s, scale, lift) {
  const pos = [], uv = [], idx = [], RN = 6, SN = 28, P = new V3(), C0 = new V3(0, HC, 0.012), n = new V3();
  for (let j = 0; j <= RN; j++) {
    const r = j / RN;
    for (let i = 0; i <= SN; i++) {
      const th = i / SN * TAU, R = 1 + 0.5 * Math.pow(Math.max(0, Math.cos(th - 0.55)), 4);
      const X = Math.cos(th) * 0.27 * R * r * scale, Y = Math.sin(th) * 0.17 * R * r * scale, tl = 0.38;
      const Xr = X * Math.cos(tl) - Y * Math.sin(tl), Yr = X * Math.sin(tl) + Y * Math.cos(tl);
      headPoint(Math.PI / 2 - s * 0.42 - s * Xr, 0.1 + Yr, b, false, P);
      n.copy(P).sub(C0).normalize(); P.addScaledVector(n, lift * (1 - 0.35 * r * r));
      pos.push(P.x, P.y, P.z); uv.push(0.5 + X, 0.5 + Y);
    }
  }
  for (let j = 0; j < RN; j++) for (let i = 0; i < SN; i++) { const a = j * (SN + 1) + i, bb = a + 1, d = a + SN + 1, c = d + 1; idx.push(a, bb, c, a, c, d); }
  return { pos, uv, idx, sk: [], sw: [], seams: [] };
}

// dlon (w przestrzeni "hand", palce w dol, wnetrze dloni do srodka ciala)
const CURL = { open: [0.2, 0.24, 0.28, 0.32], fist: [1, 1, 1, 1], thwip: [0.05, 1, 1, 0.05] };
function handData(variant, s, b) {
  const k = b.arm, parts = [];
  const pr = [{ y: -0.05, rx: 0.015, rz: 0.036 }, { y: -0.036, rx: 0.02, rz: 0.044 }, { y: 0, rx: 0.021, rz: 0.044 }, { y: 0.03, rx: 0.019, rz: 0.038 }, { y: 0.05, rx: 0.017, rz: 0.03 }]
    .map(r => ({ ...r, rx: r.rx * k, rz: r.rz * k, cx: -s * 0.003 }));
  parts.push(tubeData(smooth(pr, 2), 16, r => (r.y + 0.05) / 0.1, null));
  const Z = [0.028, 0.009, -0.01, -0.028], LF = [1, 1.08, 1, 0.82], curl = CURL[variant];
  for (let f = 0; f < 4; f++) {
    let th = curl[f] * 0.3; const p = new V3(0, -0.04, Z[f] * k), pts = [p.clone()], rad = [0.0095 * k];
    const segL = [0.03, 0.024, 0.02], bend = [1.3, 1.5, 1.1];
    for (let j = 0; j < 3; j++) {
      th += bend[j] * curl[f] * (j === 0 ? 0.7 : 1);
      const d = new V3(-s * Math.sin(th), -Math.cos(th), 0);
      for (let q = 1; q <= 2; q++) { p.addScaledVector(d, segL[j] * LF[f] * k / 2); pts.push(p.clone()); rad.push((0.0092 - j * 0.0008) * k); }
    }
    p.addScaledVector(new V3(-s * Math.sin(th), -Math.cos(th), 0), 0.004 * k); pts.push(p.clone()); rad.push(0.004 * k);
    parts.push(sweepData(pts, rad, 10, new V3(0, 0, 1)));
  }
  const fist = variant === 'fist';
  const d1 = new V3(-s * (fist ? 0.75 : 0.25), fist ? -0.55 : -0.7, fist ? 0.25 : 0.55).normalize();
  const d2 = d1.clone().add(new V3(-s * 0.4, -0.1, -0.25)).normalize();
  const t0 = new V3(-s * 0.01, -0.004, 0.034 * k);
  const tp = [t0.clone(), t0.clone().addScaledVector(d1, 0.016 * k), t0.clone().addScaledVector(d1, 0.032 * k)];
  tp.push(tp[2].clone().addScaledVector(d2, 0.013 * k), tp[2].clone().addScaledVector(d2, 0.026 * k), tp[2].clone().addScaledVector(d2, 0.03 * k));
  parts.push(sweepData(tp, [0.012 * k, 0.012 * k, 0.011 * k, 0.01 * k, 0.009 * k, 0.004 * k], 10, new V3(0, 1, 0)));
  return merge(parts);
}
// but / stopa (w przestrzeni kosci stopy; podloze na y = -0.08)
function shoeData(kind, k = 1) {
  const Z = [-0.062, -0.05, -0.02, 0.03, 0.08, 0.12, 0.148, 0.166, 0.172];
  const RX = [0.022, 0.038, 0.043, 0.046, 0.048, 0.045, 0.037, 0.024, 0.008];
  const RY = kind === 'spider' ? [0.03, 0.045, 0.05, 0.04, 0.03, 0.024, 0.018, 0.012, 0.005] : [0.034, 0.052, 0.056, 0.048, 0.038, 0.03, 0.024, 0.016, 0.006];
  const sole = kind === 'spider' ? 0 : 0.008;
  const pts = Z.map((z, i) => new V3(0, -0.08 + sole + RY[i] * k, z * k)), rad = RX.map((r, i) => [r * k, RY[i] * k]);
  const parts = [sweepData(pts, rad, 20, new V3(0, 1, 0), kind === 'spider' ? 2.2 : 2.8)];
  if (kind !== 'spider') { // cholewka wokol kostki
    const col = [{ y: -0.04, rx: 0.048, rz: 0.055, cz: 0.005 }, { y: 0.01, rx: 0.046, rz: 0.05 }, { y: 0.05, rx: 0.044, rz: 0.047 }]
      .map(r => ({ ...r, rx: r.rx * k, rz: r.rz * k }));
    parts.push(tubeData(smooth(col, 2), 20, r => 0.9, null));
  }
  return merge(parts);
}

// ---------------------------------------------------------------- rysowanie tekstur
function C(w, h) { const c = cv(w, h); return { c, x: c.getContext('2d'), w, h }; }
function noise(x, w, h, n, a) { for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } }
function webLines(x, x0, y0, w, h, col, lw, sx = 32, sy = 34) {
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); x.strokeStyle = col; x.lineWidth = lw;
  for (let a = 0; a <= x0 + w + sx; a += sx) { x.beginPath(); x.moveTo(a, y0); x.lineTo(a, y0 + h); x.stroke(); }
  for (let y = Math.floor(y0 / sy) * sy + sy / 2; y <= y0 + h + sy; y += sy) {
    x.beginPath(); for (let a = 0; a < x0 + w + sx; a += sx) { x.moveTo(a, y); x.quadraticCurveTo(a + sx / 2, y + sy * 0.3, a + sx, y); } x.stroke();
  }
  x.restore();
}
function hexDots(x, x0, y0, w, h, col) {
  x.save(); x.beginPath(); x.rect(x0, y0, w, h); x.clip(); x.fillStyle = col;
  for (let y = y0; y < y0 + h; y += 6) for (let a = ((y / 6) % 2) * 3.5; a < x0 + w; a += 7) x.fillRect(a, y, 3, 3);
  x.restore();
}
function headWeb(x, W, H, col, lw) {
  const cx = W / 2, cy = H * 0.52, N = 22; x.strokeStyle = col; x.lineWidth = lw;
  for (let i = 0; i < N; i++) { const g = i / N * TAU; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(g) * W, cy + Math.sin(g) * W * 0.5); x.stroke(); }
  for (let r = 1; r <= 10; r++) {
    const R = r * 27; x.beginPath();
    for (let i = 0; i < N; i++) {
      const g0 = i / N * TAU, g1 = (i + 1) / N * TAU, gm = (g0 + g1) / 2;
      x.moveTo(cx + Math.cos(g0) * R, cy + Math.sin(g0) * R * 0.5);
      x.quadraticCurveTo(cx + Math.cos(gm) * R * 0.86, cy + Math.sin(gm) * R * 0.43, cx + Math.cos(g1) * R, cy + Math.sin(g1) * R * 0.5);
    }
    x.stroke();
  }
}
function ell(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, TAU); x.fill(); }
export function drawSpider(x, cx, cy, s, col, style, sxk = 0.85) {
  x.save(); x.translate(cx, cy); x.scale(sxk, 1); x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
  if (style === 'big') {
    x.lineWidth = s * 0.055;
    const L = [[0.05, -0.12, 0.22, -0.34, 0.3, -0.55], [0.05, -0.08, 0.3, -0.18, 0.47, -0.24], [0.05, 0, 0.3, 0.08, 0.42, 0.3], [0.04, 0.05, 0.18, 0.25, 0.22, 0.56]];
    for (const g of [-1, 1]) for (const l of L) { x.beginPath(); x.moveTo(g * l[0] * s, l[1] * s); x.quadraticCurveTo(g * l[2] * s, l[3] * s, g * l[4] * s, l[5] * s); x.stroke(); }
    ell(x, 0, -0.13 * s, 0.075 * s, 0.085 * s); ell(x, 0, 0.1 * s, 0.065 * s, 0.18 * s);
  } else {
    x.lineWidth = s * 0.06;
    const L = [[-0.08, -0.3, -0.42], [-0.02, -0.12, -0.05], [0.04, 0.12, 0.28], [0.08, 0.3, 0.46]];
    for (const g of [-1, 1]) for (const [y0, ky, ty] of L) { x.beginPath(); x.moveTo(g * 0.05 * s, y0 * s); x.lineTo(g * 0.28 * s, ky * s); x.lineTo(g * 0.36 * s, ty * s); x.stroke(); }
    ell(x, 0, -0.08 * s, 0.07 * s, 0.09 * s); ell(x, 0, 0.1 * s, 0.08 * s, 0.13 * s);
  }
  x.restore();
}
const tex = (c, rep) => canvasTex(c.c || c, rep);

// ---------------------------------------------------------------- stroje Spider-Mana
// Tekstury w podwojnej rozdzielczosci (rysujemy we wspolrzednych 512 px, canvas jest 2x wiekszy).
// Kazda czesc ma: kolor (m), wysokosc (b — z niej liczymy mape normalnych z wypukla pajeczyna),
// szorstkosc (r — linie sieci i logo sa gladsze, gumowe) i ewentualnie swiecenie (e).
const SC = 2;
function C2(w, h) { const c = cv(w * SC, h * SC), x = c.getContext('2d'); x.scale(SC, SC); return { c, x, w, h }; }
// mapa normalnych z mapy wysokosci (pochodne Sobela, konwencja OpenGL: zielony = "w gore" tekstury)
function normalFromHeight(hc, k) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = cv(w, h), ox = out.getContext('2d'), img = ox.createImageData(w, h), d = img.data;
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1) * w, yd = Math.min(h - 1, y + 1) * w, yr = y * w;
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w, xr = (x + 1) % w;
      const nx = -(src[(yr + xr) * 4] - src[(yr + xl) * 4]) / 255 * k, ny = (src[(yd + x) * 4] - src[(yu + x) * 4]) / 255 * k;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + 1), o = (yr + x) * 4;
      d[o] = (nx * l * 0.5 + 0.5) * 255; d[o + 1] = (ny * l * 0.5 + 0.5) * 255; d[o + 2] = (l * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }
  ox.putImageData(img, 0, 0); return out;
}
// zamknieta, gladka sciezka przez punkty (krzywe przez srodki bokow)
function smoothPath(x, P) {
  x.beginPath(); const n = P.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let m = mid(P[n - 1], P[0]); x.moveTo(m[0], m[1]);
  for (let i = 0; i < n; i++) { const q = mid(P[i], P[(i + 1) % n]); x.quadraticCurveTo(P[i][0], P[i][1], q[0], q[1]); }
  x.closePath();
}
// pajeczyna promienista (klatka piersiowa, plecy)
function radialWeb(x, cx, cy, col, lw, R = 330, N = 26, step = 25) {
  x.save(); x.strokeStyle = col; x.lineWidth = lw; x.lineCap = 'round';
  for (let i = 0; i < N; i++) { const g = (i + 0.5) / N * TAU; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.cos(g) * R, cy + Math.sin(g) * R); x.stroke(); }
  for (let r = step * 0.55; r < R; r += step * (1 + r / 900)) {
    x.beginPath();
    for (let i = 0; i < N; i++) {
      const g0 = (i + 0.5) / N * TAU, g1 = (i + 1.5) / N * TAU, gm = (g0 + g1) / 2;
      x.moveTo(cx + Math.cos(g0) * r, cy + Math.sin(g0) * r);
      x.quadraticCurveTo(cx + Math.cos(gm) * r * 0.86, cy + Math.sin(gm) * r * 0.86, cx + Math.cos(g1) * r, cy + Math.sin(g1) * r);
    }
    x.stroke();
  }
  x.restore();
}
// pajak ze stroju z PS4: smukly odwlok w ksztalcie kropli, dlugie zalamane nogi (gorne siegaja barkow)
function drawAdvSpider(x, cx, cy, s, col, sxk = 0.83) {
  x.save(); x.translate(cx, cy); x.scale(sxk, 1); x.fillStyle = col; x.strokeStyle = col; x.lineCap = 'round'; x.lineJoin = 'round';
  const L = [ // nasada, staw, koniec, grubosc
    [[0.03, -0.2], [0.15, -0.37], [0.2, -0.68], 0.066],
    [[0.05, -0.16], [0.31, -0.29], [0.58, -0.44], 0.066],
    [[0.05, -0.1], [0.31, -0.05], [0.5, 0.14], 0.064],
    [[0.035, -0.05], [0.17, 0.1], [0.21, 0.44], 0.06],
  ];
  for (const g of [-1, 1]) for (const [p0, p1, p2, w] of L) {
    const l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), N = 18;
    let px = g * p0[0] * s, py = p0[1] * s;
    for (let i = 1; i <= N * 2; i++) {
      const seg = i <= N, t = seg ? i / N : (i - N) / N, A = seg ? p0 : p1, B = seg ? p1 : p2;
      const qx = g * (A[0] + (B[0] - A[0]) * t) * s, qy = (A[1] + (B[1] - A[1]) * t) * s;
      const along = seg ? t * l1 / (l1 + l2) : (l1 + t * l2) / (l1 + l2);
      x.lineWidth = s * w * (1 - 0.75 * along); x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); px = qx; py = qy;
    }
  }
  ell(x, 0, -0.165 * s, 0.058 * s, 0.065 * s);
  x.beginPath(); x.moveTo(0, -0.12 * s);
  x.bezierCurveTo(0.1 * s, -0.1 * s, 0.085 * s, 0.1 * s, 0, 0.36 * s); x.bezierCurveTo(-0.085 * s, 0.1 * s, -0.1 * s, -0.1 * s, 0, -0.12 * s); x.fill();
  x.restore();
}

// stroj "Advanced" (PS4): czerwien z wypukla czarna siecia, granatowe boki, wewnetrzna strona rak, tyl ud i lydki
function advCanvases(s) {
  const mk = (w, h) => {
    const T = { m: C2(w, h), b: C2(w, h), r: C2(w, h) };
    T.m.x.fillStyle = s.prim; T.m.x.fillRect(0, 0, w, h);
    T.b.x.fillStyle = '#808080'; T.b.x.fillRect(0, 0, w, h);
    T.r.x.fillStyle = '#fff'; T.r.x.fillRect(0, 0, w, h);
    return T;
  };
  // drobna faktura czerwonego materialu (heksy) — tylko na mapie wysokosci
  const fabric = (T, step = 5) => { T.b.x.save(); T.b.x.globalAlpha = 0.3; T.b.x.filter = 'blur(0.8px)'; hexDots2(T.b.x, 0, 0, T.b.w, T.b.h, '#9a9a9a', step); T.b.x.restore(); };
  // linie sieci: ciemne w kolorze, wypukle (miekki profil) w wysokosci, gladsze w szorstkosci
  const web = (T, draw) => {
    draw(T.m.x, s.web, 1.5);
    T.b.x.save(); T.b.x.filter = 'blur(1.1px)'; draw(T.b.x, '#c4c4c4', 3.4); T.b.x.filter = 'none'; draw(T.b.x, '#dadada', 1.2); T.b.x.restore();
    draw(T.r.x, '#a8a8a8', 2.6);
  };
  // granatowy panel: kolor + drobna faktura, lekki rant na krawedzi
  const panel = (T, path) => {
    const { m, b, r } = T;
    m.x.save(); path(m.x); m.x.clip(); m.x.fillStyle = s.sec; m.x.fillRect(0, 0, m.w, m.h);
    m.x.globalAlpha = 0.1; hexDots2(m.x, 0, 0, m.w, m.h, '#000', 3.2); m.x.restore();
    b.x.save(); path(b.x); b.x.clip(); b.x.fillStyle = '#7a7a7a'; b.x.fillRect(0, 0, b.w, b.h); hexDots2(b.x, 0, 0, b.w, b.h, '#878787', 3.2); b.x.restore();
    r.x.save(); path(r.x); r.x.clip(); r.x.fillStyle = '#f2f2f2'; r.x.fillRect(0, 0, r.w, r.h); r.x.restore();
    m.x.save(); path(m.x); m.x.strokeStyle = 'rgba(0,0,0,.5)'; m.x.lineWidth = 1.4; m.x.stroke(); m.x.restore();
    b.x.save(); path(b.x); b.x.filter = 'blur(1px)'; b.x.strokeStyle = '#b4b4b4'; b.x.lineWidth = 2.6; b.x.stroke(); b.x.restore();
  };
  const logo = (T, cx, cy, size) => {
    drawAdvSpider(T.m.x, cx, cy, size, s.logo);
    T.b.x.save(); T.b.x.filter = 'blur(2px)'; drawAdvSpider(T.b.x, cx, cy, size, '#b8b8b8'); T.b.x.filter = 'none'; drawAdvSpider(T.b.x, cx, cy, size * 0.985, '#c4c4c4'); T.b.x.restore();
    drawAdvSpider(T.r.x, cx, cy, size, '#b4b4b4');
  };
  // tulow 512x512 (przod w 256, lewy bok 128, plecy na brzegach)
  const T = mk(512, 512), CY = TY(1.33);
  fabric(T);
  web(T, (x, col, lw) => {
    x.save(); x.beginPath(); x.rect(128, 0, 256, 512); x.clip(); radialWeb(x, 256, CY, col, lw); x.restore();
    for (const bx of [0, 512]) { x.save(); x.beginPath(); x.rect(bx - 128, 0, 256, 512); x.clip(); radialWeb(x, bx, CY, col, lw); x.restore(); }
  });
  for (const cx of [128, 384]) {
    const f = cx < 256 ? 1 : -1;
    const P = [[14, 1.43], [56, 1.31], [76, 1.2], [84, 1.08], [87, 0.99], [92, 0.92], [102, 0.86], [112, 0.79],
      [40, 0.77], [-60, 0.77], [-140, 0.77], [-140, 0.96], [-90, 0.99], [-84, 1.09], [-70, 1.21], [-42, 1.32], [-12, 1.43]].map(([dx, y]) => [cx + f * dx, TY(y)]);
    panel(T, x => smoothPath(x, P));
  }
  logo(T, 256, CY, 176);
  for (const bx of [0, 512]) logo(T, bx, TY(1.3), 182);
  noise(T.m.x, 512, 512, 2500, 0.025);
  // reka 256x512 (na zewnatrz 64, przod 128, wewnatrz 192)
  const A = mk(256, 512);
  fabric(A, 4.5);
  web(A, (x, col, lw) => webLines(x, 0, 0, 256, 512, col, lw, 32, 30));
  const armIn = x => smoothPath(x, [[148, AY(0.1)], [236, AY(0.1)], [228, AY(-0.27)], [214, AY(-0.47)], [192, AY(-0.53)], [170, AY(-0.47)], [156, AY(-0.27)]]);
  panel(A, armIn);
  A.m.x.fillStyle = 'rgba(0,0,0,.18)'; A.m.x.fillRect(0, AY(-0.5) - 1, 256, 2);
  noise(A.m.x, 256, 512, 1200, 0.025);
  // noga 256x512 (na zewnatrz 64, przod 128, wewnatrz 192, tyl na brzegach)
  const G = mk(256, 512);
  fabric(G, 5);
  web(G, (x, col, lw) => webLines(x, 0, 0, 256, 512, col, lw, 32, 27));
  const legBack = o => x => smoothPath(x, [[200 + o, LY(0.14)], [362 + o, LY(0.14)], [362 + o, LY(-0.2)], [366 + o, LY(-0.39)], [330 + o, LY(-0.44)], [290 + o, LY(-0.47)],
    [270 + o, LY(-0.56)], [262 + o, LY(-0.7)], [256 + o, LY(-0.8)], [250 + o, LY(-0.7)], [242 + o, LY(-0.56)], [222 + o, LY(-0.46)], [204 + o, LY(-0.4)], [196 + o, LY(-0.2)]]);
  panel(G, legBack(0)); panel(G, legBack(-256));
  noise(G.m.x, 256, 512, 1200, 0.025);
  // glowa 512x256: siec rozchodzi sie spomiedzy oczu
  const Hd = mk(512, 256);
  fabric(Hd, 4);
  web(Hd, (x, col, lw) => headWeb(x, 512, 256, col, lw * 0.9));
  // dlonie i stopy
  const tile = () => { const t = mk(128, 128); fabric(t, 4); web(t, (x, col, lw) => webLines(x, 0, 0, 128, 128, col, lw)); return t; };
  return { T, A, G, Hd, hand: tile(), foot: tile() };
}
function hexDots2(x, x0, y0, w, h, col, st) {
  x.fillStyle = col; const d = st * 0.5;
  for (let y = y0, k = 0; y < y0 + h; y += st, k++) for (let a = x0 + (k % 2) * st / 2; a < x0 + w; a += st) x.fillRect(a, y, d, d);
}

function suitCanvases(s) {
  if (s._cv) return s._cv;
  if (s.layout === 'adv') return (s._cv = advCanvases(s));
  const key = k => k || 'p', colOf = k => k === 'p' ? s.prim : k === 's' ? s.sec : (s.acc || '#222');
  const webOn = k => k === 'p' && !!s.web;
  const mk = (w, h) => {
    const m = C2(w, h), b = C2(w, h), e = s.glow ? C2(w, h) : null;
    b.x.fillStyle = '#808080'; b.x.fillRect(0, 0, w, h); if (e) { e.x.fillStyle = '#000'; e.x.fillRect(0, 0, w, h); }
    return { m, b, e };
  };
  const region = (T, y0, y1, k, x0 = 0, w) => {
    w = w ?? T.m.w; k = key(k);
    T.m.x.fillStyle = colOf(k); T.m.x.fillRect(x0, y0, w, y1 - y0);
    if (webOn(k)) {
      webLines(T.m.x, x0, y0, w, y1 - y0, s.web, 2.2);
      T.b.x.save(); T.b.x.filter = 'blur(1.2px)'; webLines(T.b.x, x0, y0, w, y1 - y0, '#cfcfcf', 3.6); T.b.x.restore();
      if (s.glow) webLines(T.e.x, x0, y0, w, y1 - y0, s.web, 2.4);
    } else hexDots(T.b.x, x0, y0, w, y1 - y0, '#949494');
  };
  const logo = (T, cx, cy, size, sxk) => {
    if (s.logoS === 'none') return;
    drawSpider(T.m.x, cx, cy, size, s.logo, s.logoS, sxk);
    T.b.x.save(); T.b.x.filter = 'blur(2px)'; drawSpider(T.b.x, cx, cy, size, '#c8c8c8', s.logoS, sxk); T.b.x.restore();
    if (s.glow) drawSpider(T.e.x, cx, cy, size, s.logo, s.logoS, sxk);
  };
  // tulow 512x512
  const T = mk(512, 512);
  region(T, 0, TY(1.555), s.parts.head);
  region(T, TY(1.555), TY(1.18), s.chestSec ? 's' : 'p');
  region(T, TY(1.18), TY(0.98), s.parts.abd);
  region(T, TY(0.98), 512, s.parts.pelvis);
  if (s.sides) for (const cx of [128, 384]) { // boczne panele pod pachami
    T.m.x.fillStyle = s.sec; T.m.x.beginPath(); T.m.x.moveTo(cx - 12, TY(1.44)); T.m.x.lineTo(cx + 12, TY(1.44)); T.m.x.lineTo(cx + 46, TY(0.99)); T.m.x.lineTo(cx - 46, TY(0.99)); T.m.x.fill();
  }
  if (s.stripe) for (const cx of [128, 384]) { T.m.x.fillStyle = s.stripe; T.m.x.fillRect(cx - 4, TY(0.98), 8, 512 - TY(0.98)); }
  T.m.x.fillStyle = 'rgba(0,0,0,.25)'; T.m.x.fillRect(0, TY(0.985) - 2, 512, 4); // szew w pasie
  const big = s.logoS === 'big';
  logo(T, 256, TY(big ? 1.34 : 1.36), big ? 185 : 80, 0.85);
  for (const bx of [0, 512]) logo(T, bx, TY(1.33), big ? 175 : 110, 0.85);
  noise(T.m.x, 512, 512, 3000, 0.035);
  // reka 256x512
  const A = mk(256, 512);
  region(A, 0, AY(-0.28), s.parts.uarm); region(A, AY(-0.28), 512, s.parts.farm);
  A.m.x.fillStyle = 'rgba(0,0,0,.25)'; A.m.x.fillRect(0, AY(-0.5) - 1, 256, 3);
  noise(A.m.x, 256, 512, 1500, 0.035);
  // noga 256x512
  const G = mk(256, 512);
  region(G, 0, LY(-0.47), s.parts.thigh); region(G, LY(-0.47), 512, s.parts.shin);
  if (s.stripe) { G.m.x.fillStyle = s.stripe; G.m.x.fillRect(56, 0, 16, 512); }
  noise(G.m.x, 256, 512, 1500, 0.035);
  // glowa 512x256
  const Hd = mk(512, 256), hk = key(s.parts.head);
  Hd.m.x.fillStyle = colOf(hk); Hd.m.x.fillRect(0, 0, 512, 256);
  if (webOn(hk)) {
    headWeb(Hd.m.x, 512, 256, s.web, 2.2);
    Hd.b.x.save(); Hd.b.x.filter = 'blur(1.2px)'; headWeb(Hd.b.x, 512, 256, '#cfcfcf', 3.4); Hd.b.x.restore();
    if (s.glow) headWeb(Hd.e.x, 512, 256, s.web, 2.4);
  } else hexDots(Hd.b.x, 0, 0, 512, 256, '#949494');
  // dlonie i stopy: male kafelki z siecia
  const tile = k => { const t = mk(128, 128); region(t, 0, 128, k); return t; };
  return (s._cv = { T, A, G, Hd, hand: tile(s.parts.hand), foot: tile(s.parts.foot) });
}
// soczewka oka: biala, z delikatna siateczka i ciemniejszym brzegiem
let _lensTex = null;
function lensTex() {
  if (_lensTex) return _lensTex;
  const c = C(256, 256), x = c.x, g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#f4f4f4'); g.addColorStop(1, '#b9bcc0');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(120,125,130,.28)'; x.lineWidth = 1;
  for (let y = 0, k = 0; y < 256; y += 7, k++) for (let a = (k % 2) * 6; a < 256; a += 12) { x.beginPath(); x.arc(a, y, 3.6, 0, TAU); x.stroke(); }
  _lensTex = tex(c); return _lensTex;
}
export function suitMats(s) {
  if (s._mats) return s._mats;
  const cvs = suitCanvases(s), adv = s.layout === 'adv';
  const rough = adv ? 0.45 : s.gloss ? 0.32 : 0.55, metal = s.metal ? 0.45 : 0.05, env = adv ? 1.5 : s.metal ? 1.6 : 1.2;
  const lin = t => { t.encoding = THREE.LinearEncoding; return t; };
  const mat = (t, rep, ns = 1) => {
    const m = new THREE.MeshStandardMaterial({ map: tex(t.m, rep), normalMap: lin(tex(normalFromHeight(t.b.c, adv ? 5 : 4), rep)), roughness: rough, metalness: metal });
    m.normalScale.set(ns, ns);
    if (t.r) m.roughnessMap = lin(tex(t.r, rep));
    if (s.glow && t.e) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex(t.e, rep); }
    m.envMapIntensity = env; m.userData.env = env; // polysk materialu (odbicie nieba), miasto mnozy to przez pore dnia
    return m;
  };
  const hand = mat(cvs.hand, true), foot = mat(cvs.foot, true);
  for (const [m, r] of [[hand, 2], [foot, 3]]) for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) if (m[k]) m[k].repeat.set(r, 1);
  const eye = new THREE.MeshStandardMaterial({ color: s.eye, map: lensTex(), emissive: s.eye, emissiveIntensity: 0.25, roughness: 0.18, metalness: 0.05, side: THREE.DoubleSide });
  eye.envMapIntensity = 1.8; eye.userData.env = 1.8;
  return (s._mats = {
    torso: mat(cvs.T), arm: mat(cvs.A), leg: mat(cvs.G), head: mat(cvs.Hd), hand, foot, eye,
    rim: new THREE.MeshStandardMaterial({ color: s.rim, roughness: 0.38, side: THREE.DoubleSide }),
  });
}
export function suitThumb(s) {
  if (s._thumb) return s._thumb;
  const c = cv(180, 120), x = c.getContext('2d'), T = suitCanvases(s).T.m.c;
  x.drawImage(T, (256 - 120) * SC, TY(1.56) * SC, 240 * SC, (TY(1.12) - TY(1.56)) * SC, 0, 0, 180, 120);
  const g = x.createLinearGradient(0, 0, 180, 0); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  x.fillStyle = g; x.fillRect(0, 0, 180, 120);
  return (s._thumb = c.toDataURL());
}

// ---------------------------------------------------------------- ubrania bandytow
const SKINS = ['#e6b996', '#c68e6a', '#8d5a3b', '#f1c9a5', '#5e3a24', '#b07a55'];
const HAIR = ['#1b1410', '#3b2414', '#0e0e0e', '#6b4a2a', '#2a2a2a'];
const TOPS = {
  hoodie: ['#2b2f36', '#4a1e22', '#1f3a2b', '#5b5f66', '#243142', '#6b5a3a', '#161616', '#7a2a12'],
  leather: ['#1a1716', '#2b1d16', '#161a1f', '#3a2418'],
  bomber: ['#3a4430', '#1c2230', '#3a3a36', '#5a1f1f', '#1a1a1a'],
  puffer: ['#141414', '#2a3346', '#6a1c1c', '#3d4a2c', '#b8a070', '#c8581a'],
  tracksuit: ['#1a1a1a', '#1d2f5a', '#5a1414', '#2a4a2a', '#4a4a50'],
  tshirt: ['#c9c2b3', '#3a3a3a', '#6b1a1a', '#1d3050'],
  tank: ['#dcd6c8', '#2d2d2d', '#3d4a2c'], vest: ['#1e1f1c', '#2f3826', '#2a2a2e', '#4a4032'],
};
const PANTS = { jeans: ['#27344f', '#1e2533', '#3a4560', '#222630'], cargo: ['#3d4a2c', '#4a4032', '#2b2b2b', '#5a5446', '#3a3a40'] };
const pick = a => a[Math.floor(Math.random() * a.length)];
export function randomOutfit(kind) {
  const ch = p => Math.random() < p;
  if (kind === 'brute') {
    const top = ch(0.5) ? 'vest' : 'tank';
    return { kind, top, topCol: pick(TOPS[top]), pantsType: 'cargo', pants: pick(PANTS.cargo), skin: pick(SKINS), hair: pick(['bald', 'bald', 'buzz']), hairCol: pick(HAIR), hat: 'none',
      mask: ch(0.25) ? 'bandana' : false, maskCol: pick(['#111111', '#8a1515']), shoe: 'boot', shoeCol: pick(['#1c1a18', '#3a2a1a']), gloves: ch(0.6), beard: Math.random() * 0.9, chain: ch(0.5) };
  }
  const top = pick(['hoodie', 'hoodie', 'leather', 'bomber', 'puffer', 'tracksuit', 'tshirt']), topCol = pick(TOPS[top]);
  const pantsType = top === 'tracksuit' ? 'track' : pick(['jeans', 'cargo', 'cargo']);
  const mask = pick([false, false, 'bandana', 'bandana', 'balaclava', 'skull']);
  let hat = pick(top === 'hoodie' ? ['hood', 'hood', 'beanie', 'cap', 'none'] : ['beanie', 'cap', 'capback', 'none', 'beanie']);
  if (mask === 'balaclava' && hat !== 'hood') hat = pick(['none', 'beanie']);
  return {
    kind, top, topCol, pantsType, pants: pantsType === 'track' ? topCol : pick(PANTS[pantsType]), skin: pick(SKINS), hair: pick(['short', 'short', 'buzz']), hairCol: pick(HAIR),
    hat, hatCol: pick(['#1a1a1a', '#6b1a1a', '#222233', '#2d3d2d', '#d49a16', '#5a5a5a']), mask, maskCol: pick(['#8a1515', '#15306e', '#111111', '#3d4a2c']),
    shoe: pantsType === 'cargo' && ch(0.6) ? 'boot' : 'sneaker', shoeCol: pick(['#e8e8e8', '#1a1a1a', '#b8141c', '#2d56a8', '#3a2a1a']),
    gloves: ch(0.35), beard: ch(0.5) ? Math.random() * 0.9 : 0, chain: ch(0.2), print: ch(0.4),
  };
}
// twarz na teksturze glowy 512x256 (przod w x = 256; oczy y ~121, nos ~133, usta ~154, broda ~175).
// mk: opcjonalna maska pikseli, ktorych nie barwi kolor skory (bialka oczu u przechodniow).
function drawFace(x, o, mk) {
  const W = 512, H = 256, fem = !!o.female, rg = (cx, cy, r, c0, c1) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
  x.fillStyle = o.skin; x.fillRect(0, 0, W, H);
  noise(x, W, H, 2500, 0.025);
  let g = x.createLinearGradient(0, 0, W, 0); // boki i tyl glowy ciemniejsze
  g.addColorStop(0, 'rgba(40,20,10,.22)'); g.addColorStop(0.3, 'rgba(40,20,10,0)'); g.addColorStop(0.7, 'rgba(40,20,10,0)'); g.addColorStop(1, 'rgba(40,20,10,.22)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  g = x.createLinearGradient(0, 160, 0, 256); g.addColorStop(0, 'rgba(30,15,8,0)'); g.addColorStop(0.5, 'rgba(30,15,8,.12)'); g.addColorStop(1, 'rgba(30,15,8,.4)');
  x.fillStyle = g; x.fillRect(0, 160, W, 96);
  rg(256, 92, 70, 'rgba(255,240,228,.14)', 'rgba(255,240,228,0)'); // czolo
  for (const X of [208, 304]) rg(X, 146, 30, `rgba(200,70,60,${fem ? 0.2 : 0.11})`, 'rgba(200,70,60,0)'); // policzki
  for (const X of [226, 286]) rg(X, 118, 24, 'rgba(70,35,25,.2)', 'rgba(70,35,25,0)'); // oczodoly
  // nos: jasny grzbiet, cienie z bokow, nozdrza
  x.fillStyle = 'rgba(255,240,230,.2)'; ell(x, 256, 124, 4.5, 14);
  x.fillStyle = 'rgba(90,45,30,.16)'; ell(x, 246, 132, 5, 10); ell(x, 266, 132, 5, 10);
  x.fillStyle = 'rgba(90,40,30,.2)'; ell(x, 256, 143, 11, 3.2);
  x.fillStyle = 'rgba(40,15,10,.55)'; ell(x, 250, 141, 3, 1.7); ell(x, 262, 141, 3, 1.7);
  // usta
  const lip = fem ? 'rgba(170,45,60,.7)' : 'rgba(140,60,50,.42)', mw = fem ? 12 : 14, mood = o.angry ? 2.5 : 0;
  x.fillStyle = lip; x.beginPath(); x.moveTo(256 - mw, 154 + mood * 0.4); x.quadraticCurveTo(250, 149, 256, 151); x.quadraticCurveTo(262, 149, 256 + mw, 154 + mood * 0.4); x.quadraticCurveTo(256, 155, 256 - mw, 154 + mood * 0.4); x.fill();
  x.fillStyle = fem ? 'rgba(180,55,70,.6)' : 'rgba(160,75,65,.35)'; ell(x, 256, 157.5, mw - 3, 3.6);
  x.fillStyle = 'rgba(255,225,215,.22)'; ell(x, 256, 157, 5, 1.3);
  x.strokeStyle = 'rgba(60,20,15,.75)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(256 - mw, 154 + mood); x.quadraticCurveTo(256, 155.5 - mood * 0.3, 256 + mw, 154 + mood); x.stroke();
  x.fillStyle = 'rgba(60,30,20,.13)'; ell(x, 256, 166, 12, 4);
  if (o.beard) { // zarost
    x.fillStyle = o.beardCol || 'rgba(30,20,12,.3)';
    for (let i = 0; i < 2600 * o.beard; i++) {
      const px = 256 + (Math.random() * 2 - 1) * 70, py = 140 + Math.random() * 60;
      if (((px - 256) / 70) ** 2 + ((py - 172) / 34) ** 2 > 1 || (Math.abs(px - 256) < 16 && py > 148 && py < 161)) continue;
      x.fillRect(px, py, 1.6, 1.6);
    }
  }
  // oczy
  for (const X of [226, 286]) {
    x.fillStyle = '#ece4da'; ell(x, X, 121, 10.5, 4.7);
    if (mk) { mk.fillStyle = '#fff'; ell(mk, X, 121, 10.5, 4.7); }
    x.fillStyle = o.eyeCol || '#3b2a1c'; x.beginPath(); x.arc(X, 121, 4.4, 0, TAU); x.fill();
    x.fillStyle = '#0a0a0a'; x.beginPath(); x.arc(X, 121, 2, 0, TAU); x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.arc(X + 1.6, 119.6, 1.1, 0, TAU); x.fill();
    x.strokeStyle = 'rgba(35,18,10,.85)'; x.lineWidth = fem ? 3.2 : 2.3; x.beginPath(); x.ellipse(X, 121.5, 11.5, 5.6, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke();
    if (fem) { const sg = X < 256 ? -1 : 1; x.beginPath(); x.moveTo(X + sg * 11, 120); x.lineTo(X + sg * 15, 116.5); x.stroke(); }
    x.strokeStyle = 'rgba(70,35,25,.3)'; x.lineWidth = 1.2; x.beginPath(); x.ellipse(X, 119, 12, 7.5, 0, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.beginPath(); x.ellipse(X, 121, 10, 5, 0, Math.PI * 0.15, Math.PI * 0.85); x.stroke();
    // brwi
    const inner = X < 256 ? X + 13 : X - 13, outer = X < 256 ? X - 14 : X + 14;
    x.strokeStyle = o.browCol || 'rgba(40,25,15,.85)'; x.lineWidth = fem ? 2.6 : 4.6; x.lineCap = 'round'; x.beginPath();
    if (o.angry) { x.moveTo(outer, 105); x.quadraticCurveTo((inner + outer) / 2, 105, inner, 112); }
    else { x.moveTo(inner, 109); x.quadraticCurveTo((inner + outer) / 2, fem ? 101 : 104, outer, 108); }
    x.stroke(); x.lineCap = 'butt';
  }
  // linia wlosow
  if (o.hair && o.hair !== 'none') {
    x.fillStyle = o.hair === 'bald' ? 'rgba(30,20,10,.18)' : o.hairCol;
    const front = o.hair === 'buzz' ? 80 : 74, nape = o.hair === 'long' ? 256 : 160;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, nape); x.lineTo(410, nape); x.quadraticCurveTo(392, 120, 360, 112); x.quadraticCurveTo(330, front + 6, 300, front);
    x.quadraticCurveTo(256, front - 8, 212, front); x.quadraticCurveTo(182, front + 6, 152, 112); x.quadraticCurveTo(120, 120, 102, nape); x.lineTo(0, nape); x.closePath(); x.fill();
    if (o.hair !== 'bald') { x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 1; for (let i = 0; i < 300; i++) { const px = Math.random() * W, py = Math.random() * 70; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (Math.random() - 0.5) * 8, py + 12); x.stroke(); } }
    if (o.hair === 'buzz') { x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 1500; i++) x.fillRect(Math.random() * W, Math.random() * 80, 1.4, 1.4); }
  }
}
// tekstury ubran bandyty: kolor + mapa wypuklosci (szwy, kieszenie, pikowanie, sciagacze)
function outfitCanvases(o) {
  const T = C(512, 512), A = C(256, 512), G = C(256, 512), Hd = C(512, 256), Sh = C(256, 128);
  const TB = C(512, 512), AB = C(256, 512), GB = C(256, 512);
  for (const b of [TB, AB, GB]) { b.x.fillStyle = '#808080'; b.x.fillRect(0, 0, b.w, b.h); noise(b.x, b.w, b.h, b.w * b.h / 24, 0.16); }
  const tx = T.x, tb = TB.x, top = o.topCol, pt = o.pantsType || 'jeans';
  const ln = (c, x0, y0, x1, y1, col, w, dash) => { c.strokeStyle = col; c.lineWidth = w; if (dash) c.setLineDash(dash); c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); if (dash) c.setLineDash([]); };
  // szew: ciemna linia na kolorze + rowek na wypuklosci
  const seam = (c, b, x0, y0, x1, y1, a = 0.3) => { ln(c, x0, y0, x1, y1, `rgba(0,0,0,${a})`, 2); ln(b, x0, y0, x1, y1, '#4a4a4a', 3); };
  const ribs = (c, b, x0, y0, w, h, step = 5) => { c.fillStyle = 'rgba(0,0,0,.18)'; b.fillStyle = '#5a5a5a'; for (let a = x0; a < x0 + w; a += step) { c.fillRect(a, y0, step * 0.4, h); b.fillRect(a, y0, step * 0.4, h); } };
  const zip = (c, b, x, y0, y1, col = '#9a9ea4') => { c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(x - 3, y0, 6, y1 - y0); c.fillStyle = col; for (let y = y0; y < y1; y += 4) c.fillRect(x - 2, y, 4, 2); b.fillStyle = '#404040'; b.fillRect(x - 3, y0, 6, y1 - y0); c.fillStyle = col; c.fillRect(x - 3, y0 + 4, 6, 12); };
  const quilt = (c, b, w, y0, y1, step) => { // pikowanie kurtki puchowej
    for (let y = y0; y < y1; y += step) {
      let g = c.createLinearGradient(0, y, 0, y + step); g.addColorStop(0, 'rgba(0,0,0,.16)'); g.addColorStop(0.4, 'rgba(255,255,255,.08)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)');
      c.fillStyle = g; c.fillRect(0, y, w, step);
      g = b.createLinearGradient(0, y, 0, y + step); g.addColorStop(0, '#5a5a5a'); g.addColorStop(0.5, '#c0c0c0'); g.addColorStop(1, '#5a5a5a');
      b.fillStyle = g; b.fillRect(0, y, w, step);
    }
  };
  const shade = (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(0,0,0,.12)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = g; c.fillRect(0, 0, w, h); };
  // ---- tulow
  tx.fillStyle = top; tx.fillRect(0, 0, 512, TY(0.98));
  tx.fillStyle = o.pants; tx.fillRect(0, TY(0.98), 512, 512);
  let g = tx.createLinearGradient(0, TY(1.5), 0, TY(0.98)); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); tx.fillStyle = g; tx.fillRect(0, TY(1.5), 512, TY(0.98) - TY(1.5));
  if (o.top === 'tank' || o.top === 'vest') {
    tx.fillStyle = o.skin; tx.fillRect(0, 0, 512, TY(1.47));
    ell(tx, 256, TY(1.47), o.top === 'vest' ? 56 : 70, 34);
    for (const cx of [128, 384]) ell(tx, cx, TY(1.4), 44, 70);
  }
  tx.fillStyle = o.skin; tx.fillRect(0, 0, 512, TY(1.55)); // szyja
  for (const sx of [128, 384]) if (o.top !== 'tank' && o.top !== 'vest') seam(tx, tb, sx, TY(1.44), sx, TY(0.99), 0.22); // boczne szwy
  if (o.top === 'hoodie') {
    tx.fillStyle = 'rgba(0,0,0,.22)'; tx.beginPath(); tx.moveTo(186, TY(1.02)); tx.lineTo(196, TY(1.15)); tx.lineTo(316, TY(1.15)); tx.lineTo(326, TY(1.02)); tx.fill(); // kieszen kangurka
    tb.strokeStyle = '#4a4a4a'; tb.lineWidth = 3; tb.beginPath(); tb.moveTo(186, TY(1.02)); tb.lineTo(196, TY(1.15)); tb.lineTo(316, TY(1.15)); tb.lineTo(326, TY(1.02)); tb.stroke();
    for (const s of [-1, 1]) seam(tx, tb, 256 + s * 60, TY(1.02), 256 + s * 52, TY(1.13), 0.45);
    ribs(tx, tb, 0, TY(1.03), 512, TY(0.98) - TY(1.03), 6);
    for (const x of [244, 268]) { ln(tx, x, TY(1.53), x + (x - 256) * 0.25, TY(1.37), '#d8d8d4', 3.5); tx.fillStyle = '#9a9a9a'; tx.fillRect(x + (x - 256) * 0.25 - 2, TY(1.37), 4, 10); }
    tx.fillStyle = 'rgba(0,0,0,.3)'; tx.fillRect(0, TY(1.555), 512, 10); // brzeg kaptura
    tx.fillStyle = 'rgba(0,0,0,.2)'; for (const x0 of [0, 452]) tx.fillRect(x0, TY(1.55), 60, TY(1.38) - TY(1.55));
    if (o.print) { tx.save(); tx.translate(256, TY(1.33)); tx.scale(-1, 1); tx.fillStyle = 'rgba(235,235,230,.55)'; tx.font = 'bold 30px Arial'; tx.textAlign = 'center'; tx.fillText(pick(['BRONX', 'NYC', 'KINGS', '718', 'HUSTLE']), 0, 0); tx.restore(); }
  } else if (o.top === 'leather') {
    tx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 50; i++) tx.fillRect(Math.random() * 512, TY(1.5) + Math.random() * 200, 40 + Math.random() * 60, 2);
    for (const s of [-1, 1]) { // klapy
      tx.fillStyle = 'rgba(0,0,0,.35)'; tx.beginPath(); tx.moveTo(256 + s * 44, TY(1.54)); tx.lineTo(256 + s * 18, TY(1.37)); tx.lineTo(256 + s * 36, TY(1.32)); tx.lineTo(256 + s * 70, TY(1.52)); tx.fill();
      ln(tx, 256 + s * 44, TY(1.54), 256 + s * 18, TY(1.37), 'rgba(255,255,255,.18)', 1.5);
      ln(tb, 256 + s * 18, TY(1.37), 256 + s * 70, TY(1.52), '#3a3a3a', 3);
    }
    zip(tx, tb, 280, TY(1.36), TY(0.99));
    seam(tx, tb, 0, TY(1.47), 512, TY(1.47), 0.3); // karczek
    tx.fillStyle = 'rgba(0,0,0,.4)'; tx.fillRect(0, TY(1.04), 512, TY(0.99) - TY(1.04)); tx.fillStyle = '#a0a4a8'; tx.fillRect(226, TY(1.035), 18, TY(0.995) - TY(1.035));
    for (const s of [-1, 1]) seam(tx, tb, 256 + s * 70, TY(1.18), 256 + s * 96, TY(1.08), 0.5); // kieszenie na suwak
  } else if (o.top === 'bomber') {
    ribs(tx, tb, 0, TY(1.56), 512, TY(1.5) - TY(1.56), 5); ribs(tx, tb, 0, TY(1.05), 512, TY(0.98) - TY(1.05), 5);
    tx.fillStyle = 'rgba(230,120,40,.55)'; tx.fillRect(0, TY(1.03), 512, 4); tx.fillRect(0, TY(1.53), 512, 3);
    zip(tx, tb, 256, TY(1.5), TY(1.0));
    for (const s of [-1, 1]) seam(tx, tb, 256 + s * 48, TY(1.08), 256 + s * 68, TY(1.2), 0.5);
    for (let i = 0; i < 14; i++) { const x0 = Math.random() * 512, y0 = TY(1.45) + Math.random() * 120; tx.fillStyle = 'rgba(255,255,255,.06)'; tx.fillRect(x0, y0, 3, 50 + Math.random() * 40); }
  } else if (o.top === 'puffer') {
    tx.fillStyle = 'rgba(0,0,0,.4)'; tx.fillRect(0, TY(1.57), 512, TY(1.5) - TY(1.57)); // wysoki kolnierz
    quilt(tx, tb, 512, TY(1.5), TY(0.99), 26);
    zip(tx, tb, 256, TY(1.57), TY(0.99));
    tx.fillStyle = 'rgba(255,255,255,.07)'; tx.fillRect(0, 0, 512, TY(1.0));
  } else if (o.top === 'tracksuit') {
    zip(tx, tb, 256, TY(1.55), TY(1.0), '#e8e8e8');
    tx.fillStyle = 'rgba(0,0,0,.3)'; tx.fillRect(0, TY(1.57), 512, TY(1.52) - TY(1.57));
    for (const sx of [128, 384]) { tx.fillStyle = '#ecece8'; tx.fillRect(sx - 9, TY(1.45), 5, TY(1.0) - TY(1.45)); tx.fillRect(sx + 4, TY(1.45), 5, TY(1.0) - TY(1.45)); }
    ribs(tx, tb, 0, TY(1.03), 512, TY(0.98) - TY(1.03), 6);
    tx.save(); tx.translate(300, TY(1.36)); tx.scale(-1, 1); tx.fillStyle = 'rgba(240,240,240,.8)'; tx.font = 'bold 16px Arial'; tx.fillText('◆', 0, 0); tx.restore();
  } else if (o.top === 'tshirt') {
    tx.fillStyle = 'rgba(0,0,0,.25)'; tx.fillRect(0, TY(1.55), 512, 6);
    if (o.print !== false) { tx.save(); tx.translate(256, TY(1.3)); tx.scale(-1, 1); tx.fillStyle = 'rgba(0,0,0,.55)'; tx.font = 'bold 44px Arial'; tx.textAlign = 'center'; tx.fillText(pick(['NY', 'NYC', '★', 'BK']), 0, 0); tx.restore(); }
    tx.fillStyle = 'rgba(0,0,0,.15)'; tx.fillRect(0, TY(1.0), 512, 4);
  } else if (o.top === 'vest') { // kamizelka taktyczna z paskami MOLLE
    for (let y = 1.42; y > 1.02; y -= 0.06) { tx.fillStyle = 'rgba(0,0,0,.35)'; tx.fillRect(0, TY(y), 512, 5); tb.fillStyle = '#505050'; tb.fillRect(0, TY(y), 512, 5); tx.fillStyle = 'rgba(0,0,0,.5)'; for (let x = 8; x < 512; x += 28) tx.fillRect(x, TY(y), 3, 5); }
    for (const sx of [128, 384]) { tx.fillStyle = 'rgba(0,0,0,.45)'; tx.fillRect(sx - 14, TY(1.3), 28, TY(1.0) - TY(1.3)); }
    tx.fillStyle = 'rgba(0,0,0,.4)'; tx.fillRect(0, TY(1.04), 512, TY(0.99) - TY(1.04));
  }
  // spodnie: pasek ze sprzaczka, kieszenie, rozporek, szlufki
  if (pt === 'track') { ribs(tx, tb, 0, TY(0.995), 512, TY(0.965) - TY(0.995), 5); for (const sx of [128, 384]) { tx.fillStyle = '#ecece8'; tx.fillRect(sx - 9, TY(0.965), 5, 512); tx.fillRect(sx + 4, TY(0.965), 5, 512); } }
  else {
    tx.fillStyle = '#16130f'; tx.fillRect(0, TY(0.995), 512, TY(0.965) - TY(0.995)); tb.fillStyle = '#c0c0c0'; tb.fillRect(0, TY(0.995), 512, TY(0.965) - TY(0.995));
    if (o.top !== 'tank') { tx.fillStyle = '#b8b8b8'; tx.fillRect(244, TY(0.995), 24, TY(0.965) - TY(0.995)); tx.fillStyle = '#16130f'; tx.fillRect(250, TY(0.99), 12, TY(0.97) - TY(0.99)); }
    for (const x of [60, 196, 316, 452]) { tx.fillStyle = 'rgba(0,0,0,.35)'; tx.fillRect(x, TY(1.0), 6, TY(0.96) - TY(1.0)); }
    const st = pt === 'jeans' ? 'rgba(210,150,70,.7)' : 'rgba(0,0,0,.35)';
    for (const s of [-1, 1]) { tx.strokeStyle = st; tx.lineWidth = 1.5; tx.setLineDash([3, 2]); tx.beginPath(); tx.moveTo(256 + s * 30, TY(0.965)); tx.quadraticCurveTo(256 + s * 40, TY(0.9), 256 + s * 70, TY(0.89)); tx.stroke(); tx.setLineDash([]); seam(tx, tb, 256 + s * 28, TY(0.965), 256 + s * 70, TY(0.89), 0.25); }
    tx.strokeStyle = st; tx.setLineDash([3, 2]); tx.beginPath(); tx.moveTo(262, TY(0.965)); tx.lineTo(262, TY(0.87)); tx.quadraticCurveTo(262, TY(0.85), 254, TY(0.85)); tx.stroke(); tx.setLineDash([]);
    for (const cx of [40, 472]) { tx.strokeStyle = st; tx.setLineDash([3, 2]); tx.strokeRect(cx - 26, TY(0.95), 52, 40); tx.setLineDash([]); tb.strokeStyle = '#505050'; tb.lineWidth = 3; tb.strokeRect(cx - 26, TY(0.95), 52, 40); }
  }
  if (pt === 'jeans') { tx.strokeStyle = 'rgba(255,255,255,.05)'; tx.lineWidth = 1; for (let a = -512; a < 512; a += 4) { tx.beginPath(); tx.moveTo(a, TY(0.98)); tx.lineTo(a + 200, 512); tx.stroke(); } }
  noise(tx, 512, 512, 6000, 0.05);
  // ---- reka
  const ax = A.x, abx = AB.x, sleeve = o.top === 'tank' || o.top === 'vest' ? 0.2 : o.top === 'tshirt' ? -0.13 : -0.53;
  ax.fillStyle = o.skin; ax.fillRect(0, 0, 256, 512); shade(ax, 256, 512);
  if (sleeve < 0.1) {
    ax.fillStyle = top; ax.fillRect(0, 0, 256, AY(sleeve)); shade(ax, 256, AY(sleeve));
    ax.fillStyle = 'rgba(0,0,0,.25)'; ax.fillRect(0, AY(sleeve) - 8, 256, 8);
    if (o.top === 'puffer') quilt(ax, abx, 256, AY(0.05), AY(sleeve) - 10, 30);
    if (['hoodie', 'bomber', 'puffer', 'tracksuit'].includes(o.top)) ribs(ax, abx, 0, AY(-0.47), 256, AY(sleeve) - AY(-0.47), 5);
    if (o.top === 'leather') { zip(ax, abx, 64, AY(-0.42), AY(sleeve) - 4); for (let i = -1; i <= 1; i++) seam(ax, abx, 0, AY(-0.28) + i * 12, 256, AY(-0.28) + i * 12, 0.35); ax.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 25; i++) ax.fillRect(Math.random() * 256, Math.random() * AY(sleeve), 2, 30 + Math.random() * 40); }
    if (o.top === 'bomber') { ax.fillStyle = 'rgba(0,0,0,.25)'; ax.fillRect(44, AY(-0.07), 40, AY(-0.2) - AY(-0.07)); zip(ax, abx, 64, AY(-0.075), AY(-0.12)); seam(ax, abx, 44, AY(-0.07), 84, AY(-0.07), 0.4); }
    if (o.top === 'tracksuit') { ax.fillStyle = '#ecece8'; ax.fillRect(52, 0, 5, AY(sleeve) - 10); ax.fillRect(66, 0, 5, AY(sleeve) - 10); }
    if (o.top === 'hoodie') for (let i = 0; i < 5; i++) { const y = AY(-0.44) - i * 9; ax.strokeStyle = 'rgba(0,0,0,.18)'; ax.lineWidth = 2; ax.beginPath(); ax.moveTo(70 + i * 4, y); ax.quadraticCurveTo(128, y + 7, 186 - i * 4, y); ax.stroke(); }
    for (let i = 0; i < 4; i++) { const y = AY(-0.28) + (i - 1.5) * 9; ax.strokeStyle = 'rgba(0,0,0,.16)'; ax.lineWidth = 2; ax.beginPath(); ax.moveTo(90, y); ax.quadraticCurveTo(128, y + 6, 166, y); ax.stroke(); }
  }
  if (o.kind === 'brute') { // tatuaz
    ax.strokeStyle = 'rgba(20,30,40,.8)'; ax.lineWidth = 5;
    for (let i = 0; i < 4; i++) { ax.beginPath(); ax.moveTo(40, AY(-0.02) + i * 22); ax.bezierCurveTo(90, AY(-0.02) + i * 22 - 30, 130, AY(-0.02) + i * 22 + 30, 200, AY(-0.02) + i * 22); ax.stroke(); }
    ax.fillStyle = 'rgba(20,30,40,.7)'; ax.font = 'bold 34px serif'; ax.fillText('✠', 110, AY(-0.38));
  }
  noise(ax, 256, 512, 2500, 0.04);
  // ---- noga
  const gx = G.x, gbx = GB.x; gx.fillStyle = o.pants; gx.fillRect(0, 0, 256, 512); shade(gx, 256, 512);
  if (pt === 'jeans') {
    gx.strokeStyle = 'rgba(255,255,255,.06)'; gx.lineWidth = 1; for (let a = -512; a < 256; a += 4) { gx.beginPath(); gx.moveTo(a, 0); gx.lineTo(a + 512, 512); gx.stroke(); }
    const r = gx.createRadialGradient(128, LY(-0.25), 5, 128, LY(-0.25), 90); r.addColorStop(0, 'rgba(255,255,255,.14)'); r.addColorStop(1, 'rgba(255,255,255,0)'); gx.fillStyle = r; gx.fillRect(0, 0, 256, 512);
    for (const x of [64, 192]) { gx.strokeStyle = 'rgba(210,150,70,.6)'; gx.setLineDash([3, 2]); gx.lineWidth = 1.5; gx.beginPath(); gx.moveTo(x - 4, 0); gx.lineTo(x - 4, 512); gx.stroke(); gx.setLineDash([]); seam(gx, gbx, x, 0, x, 512, 0.2); }
    for (let i = 0; i < 5; i++) { const y = LY(0.0) + i * 7; gx.strokeStyle = 'rgba(255,255,255,.1)'; gx.lineWidth = 2; gx.beginPath(); gx.moveTo(150, y); gx.lineTo(196, y + 8); gx.stroke(); }
  } else if (pt === 'cargo') {
    gx.strokeStyle = 'rgba(0,0,0,.08)'; gx.lineWidth = 1; for (let a = 0; a < 256; a += 8) { gx.beginPath(); gx.moveTo(a, 0); gx.lineTo(a, 512); gx.stroke(); } for (let a = 0; a < 512; a += 8) { gx.beginPath(); gx.moveTo(0, a); gx.lineTo(256, a); gx.stroke(); }
    for (const x of [64, 192]) seam(gx, gbx, x, 0, x, 512, 0.25);
    const py0 = LY(-0.17), py1 = LY(-0.42); // kieszen na udzie (na zewnatrz: u = 0.25)
    gx.fillStyle = 'rgba(0,0,0,.12)'; gx.fillRect(30, py0, 68, py1 - py0); gx.fillStyle = 'rgba(0,0,0,.28)'; gx.fillRect(28, py0, 72, 22);
    gbx.strokeStyle = '#3a3a3a'; gbx.lineWidth = 4; gbx.strokeRect(30, py0, 68, py1 - py0); gbx.fillStyle = '#b0b0b0'; gbx.fillRect(30, py0 + 22, 68, py1 - py0 - 22);
    ln(gx, 28, py0 + 22, 100, py0 + 22, 'rgba(0,0,0,.45)', 2); gx.fillStyle = '#2a2a2a'; ell(gx, 64, py0 + 14, 4, 4);
    for (let i = 0; i < 3; i++) seam(gx, gbx, 100, LY(-0.43) - i * 10, 156, LY(-0.43) - i * 10 + 4, 0.25); // przeszycia na kolanie
    for (let i = 0; i < 6; i++) { const y = LY(-0.8) + i * 6; gx.strokeStyle = 'rgba(0,0,0,.2)'; gx.lineWidth = 2; gx.beginPath(); gx.moveTo(20 + i * 7, y); gx.quadraticCurveTo(128, y - 8, 236 - i * 7, y); gx.stroke(); }
  } else { // dres
    gx.fillStyle = '#ecece8'; gx.fillRect(52, 0, 5, 512); gx.fillRect(66, 0, 5, 512);
    ribs(gx, gbx, 0, LY(-0.8), 256, 20, 5);
  }
  if (o.kind === 'brute') { gx.fillStyle = 'rgba(0,0,0,.25)'; gx.fillRect(100, LY(-0.38), 56, LY(-0.5) - LY(-0.38)); }
  for (let i = 0; i < 4; i++) { const y = LY(-0.45) + (i - 1.5) * 9; gx.strokeStyle = 'rgba(0,0,0,.18)'; gx.lineWidth = 2; gx.beginPath(); gx.moveTo(150, y); gx.quadraticCurveTo(192, y + 6, 234, y); gx.stroke(); }
  gx.fillStyle = 'rgba(0,0,0,.2)'; gx.fillRect(0, LY(-0.8), 256, 8);
  noise(gx, 256, 512, 3000, 0.06);
  // ---- twarz i maski
  const hx = Hd.x;
  drawFace(hx, { skin: o.skin, hair: o.hair === 'short' ? 'short' : o.hair, hairCol: o.hairCol, angry: true, beard: o.beard || 0, beardCol: 'rgba(25,18,12,.3)', browCol: o.hair === 'bald' ? 'rgba(42,26,16,.9)' : o.hairCol });
  if (o.mask === 'bandana' || o.mask === 'skull') {
    const mc = o.mask === 'skull' ? '#121212' : o.maskCol;
    hx.fillStyle = mc; hx.beginPath(); hx.moveTo(0, 138); hx.lineTo(512, 138); hx.lineTo(512, 160); hx.lineTo(392, 152); hx.lineTo(380, 205); hx.lineTo(256, 222); hx.lineTo(132, 205); hx.lineTo(120, 152); hx.lineTo(0, 160); hx.fill();
    hx.strokeStyle = 'rgba(0,0,0,.35)'; hx.lineWidth = 2; for (let i = 0; i < 5; i++) { hx.beginPath(); hx.moveTo(150 + i * 12, 160 + i * 9); hx.quadraticCurveTo(256, 172 + i * 9, 362 - i * 12, 160 + i * 9); hx.stroke(); }
    if (o.mask === 'skull') { hx.fillStyle = '#e8e4da'; for (let i = -3; i <= 3; i++) { hx.fillRect(256 + i * 11 - 4, 152, 8, 12); hx.fillRect(256 + i * 10 - 4, 168, 8, 10); } hx.fillRect(220, 164, 72, 3); hx.beginPath(); hx.moveTo(250, 142); hx.lineTo(262, 142); hx.lineTo(256, 150); hx.fill(); }
    else { hx.fillStyle = 'rgba(255,255,255,.4)'; for (let i = 0; i < 50; i++) { hx.beginPath(); hx.ellipse(130 + Math.random() * 250, 145 + Math.random() * 60, 3, 1.6, Math.random() * 3, 0, TAU); hx.fill(); } }
  } else if (o.mask === 'balaclava') {
    hx.fillStyle = o.maskCol; hx.beginPath(); hx.rect(0, 0, 512, 256);
    if (hx.roundRect) hx.roundRect(198, 106, 116, 30, 12); else hx.rect(198, 106, 116, 30);
    hx.ellipse(256, 156, 15, 7, 0, 0, TAU); hx.fill('evenodd');
    hx.fillStyle = 'rgba(0,0,0,.18)'; for (let a = 0; a < 512; a += 5) hx.fillRect(a, 0, 2, 256);
    hx.strokeStyle = 'rgba(0,0,0,.4)'; hx.lineWidth = 3; if (hx.roundRect) { hx.beginPath(); hx.roundRect(198, 106, 116, 30, 12); hx.stroke(); }
  }
  // ---- but (u: w kolko, v: od piety do noska; podeszwa = dol przekroju u ~ 0.25)
  const sx = Sh.x, boot = o.shoe === 'boot';
  sx.fillStyle = o.shoeCol; sx.fillRect(0, 0, 256, 128);
  if (boot) {
    noise(sx, 256, 128, 900, 0.1);
    sx.fillStyle = '#0d0c0b'; sx.fillRect(18, 0, 92, 128);
    sx.strokeStyle = 'rgba(200,180,140,.5)'; sx.setLineDash([3, 2]); sx.lineWidth = 1.5; for (const x of [14, 114]) { sx.beginPath(); sx.moveTo(x, 0); sx.lineTo(x, 128); sx.stroke(); } sx.setLineDash([]);
    sx.fillStyle = '#b8a070'; for (let v = 34; v < 100; v += 11) for (const x of [180, 204]) { sx.beginPath(); sx.arc(x, v, 2.2, 0, TAU); sx.fill(); }
    sx.strokeStyle = '#2a1f14'; sx.lineWidth = 2; for (let v = 34; v < 100; v += 11) { sx.beginPath(); sx.moveTo(180, v); sx.lineTo(204, v + 11); sx.stroke(); }
    sx.fillStyle = 'rgba(255,255,255,.12)'; ell(sx, 192, 10, 30, 8); // przetarty nosek
  } else {
    sx.fillStyle = '#f2f2f2'; sx.fillRect(18, 0, 92, 128); sx.fillStyle = 'rgba(0,0,0,.18)'; sx.fillRect(18, 0, 92, 4);
    sx.fillStyle = 'rgba(255,255,255,.25)'; sx.fillRect(130, 0, 126, 22); // nosek
    sx.strokeStyle = o.shoeCol === '#e8e8e8' ? '#222' : '#fff'; sx.lineWidth = 2; for (let v = 30; v < 84; v += 8) { sx.beginPath(); sx.moveTo(178, v); sx.lineTo(206, v + 4); sx.stroke(); }
    sx.strokeStyle = o.shoeCol === '#e8e8e8' ? '#b8141c' : '#f2f2f2'; sx.lineWidth = 6; sx.lineCap = 'round';
    for (const cx of [0, 128]) { sx.beginPath(); sx.moveTo(cx + 2, 110); sx.quadraticCurveTo(cx + 40, 76, cx + 110, 60); sx.stroke(); }
    sx.lineCap = 'butt'; sx.fillStyle = 'rgba(0,0,0,.25)'; sx.fillRect(140, 112, 104, 16); // zapietek
  }
  return { T, A, G, Hd, Sh, TB, AB, GB };
}
const outfitCache = new Map();
function outfitMats(o) {
  const key = JSON.stringify(o); if (outfitCache.has(key)) return outfitCache.get(key);
  const c = outfitCanvases(o), bs = o.top === 'puffer' ? 0.03 : 0.012;
  const mat = (cv2, b, rough = 0.85) => new THREE.MeshStandardMaterial({ map: tex(cv2), bumpMap: tex(b), bumpScale: bs, roughness: rough });
  const leather = o.top === 'leather', shiny = leather || o.top === 'bomber' || o.top === 'puffer' || o.top === 'tracksuit';
  const M = {
    torso: mat(c.T, c.TB, leather ? 0.42 : shiny ? 0.6 : 0.85), arm: mat(c.A, c.AB, leather ? 0.45 : shiny ? 0.6 : 0.8), leg: mat(c.G, c.GB, o.pantsType === 'track' ? 0.65 : 0.9),
    head: new THREE.MeshStandardMaterial({ map: tex(c.Hd), roughness: 0.65 }),
    hand: o.gloves ? new THREE.MeshStandardMaterial({ color: '#1c1b1a', roughness: 0.5 }) : new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }),
    foot: new THREE.MeshStandardMaterial({ map: tex(c.Sh), roughness: o.shoe === 'boot' ? 0.55 : 0.6 }),
    skin: new THREE.MeshStandardMaterial({ color: o.mask === 'balaclava' ? o.maskCol : o.skin, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: o.hairCol, roughness: 0.9 }),
    hat: new THREE.MeshStandardMaterial({ color: o.hatCol || '#222', roughness: 0.9 }),
    top: new THREE.MeshStandardMaterial({ color: o.topCol, roughness: leather ? 0.45 : 0.85, side: THREE.DoubleSide }),
    metal: new THREE.MeshStandardMaterial({ color: '#d4b048', roughness: 0.25, metalness: 0.9 }),
  };
  outfitCache.set(key, M); return M;
}

// ---------------------------------------------------------------- skladanie postaci
function build(kind, M, opt = {}) {
  const b = opt.body || BODY[kind], H = makeRig(b);
  H.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(H.bones);
  const skinned = (d, mat) => {
    mat.skinning = true; // w three r128 bez tego skora nie podaza za koscmi
    const m = new THREE.SkinnedMesh(toGeo(d), mat); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    H.root.add(m); m.updateMatrixWorld(true); m.bind(skel); return m;
  };
  skinned(tubeData(smooth(torsoRings(b), 3), 40, r => (r.y - 0.79) / 0.91, wTorso), M.torso);
  const arm = tubeData(smooth(armRings(b), 3), 24, r => (r.y - (SHY - 0.56)) / 0.655, wArm);
  skinned(merge([arm, mirror(arm)]), M.arm);
  const leg = tubeData(smooth(legRings(b), 3), 24, r => (r.y - (HIPY - 0.87)) / 0.99, wLeg);
  skinned(merge([leg, mirror(leg)]), M.leg);
  const head = new THREE.Mesh(toGeo(headData(b, opt.face)), M.head); head.castShadow = true; H.neck.add(head); H.headM = head;
  // dlonie: kilka ksztaltow, pokazujemy jeden
  H.hands = {};
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', set = {};
    for (const v of opt.thwip ? ['open', 'fist', 'thwip'] : ['open', 'fist']) {
      const m = new THREE.Mesh(toGeo(handData(v, s, b)), M.hand); m.castShadow = true; m.visible = v === 'open';
      H['hand' + L].add(m); set[v] = m;
    }
    H.hands[L] = set;
    const f = new THREE.Mesh(toGeo(shoeData(opt.shoe || 'sneaker', kind === 'brute' || kind === 'boss' ? 1.12 : 1)), M.foot); f.castShadow = true;
    H['ft' + L].add(f);
  }
  H.handPose = { L: 'open', R: 'open' };
  H.setHands = (l, r) => {
    for (const [side, v] of [['L', l], ['R', r]]) {
      if (H.handPose[side] === v || !H.hands[side][v]) continue;
      for (const k in H.hands[side]) H.hands[side][k].visible = k === v;
      H.handPose[side] = v;
    }
  };
  H.b = b;
  return H;
}

// ---------------------------------------------------------------- Spider-Man: atletyczna sylwetka z miesniami
// Wlasne pierscienie (szersze barki, waska talia, mocne uda) + "rzezba": wierzcholki przesuwane
// na zewnatrz/do srodka wedlug mapy miesni (piersi, brzuch, lopatki, naramienne, czworoglowe, lydki).
const gs = (v, m, w) => Math.exp(-(((v - m) / w) ** 2));
function spTorsoRings() {
  return [
    { y: 0.79, rx: 0.03, rz: 0.03 },
    { y: 0.815, rx: 0.1, rz: 0.08 },
    { y: 0.86, rx: 0.148, rz: 0.108, bb: 0.15, cz: -0.006, n: 2.3 },
    { y: 0.93, rx: 0.152, rz: 0.106, bb: 0.1, cz: -0.005, n: 2.4 },
    { y: 1.0, rx: 0.138, rz: 0.097, n: 2.35 },
    { y: 1.08, rx: 0.134, rz: 0.096, fb: 0.04, n: 2.35 },
    { y: 1.16, rx: 0.15, rz: 0.102, fb: 0.06, n: 2.4 },
    { y: 1.24, rx: 0.178, rz: 0.113, fb: 0.07, pec: 0.04, n: 2.5, cz: 0.005 },
    { y: 1.32, rx: 0.2, rz: 0.121, fb: 0.06, pec: 0.1, n: 2.6, cz: 0.01 },
    { y: 1.39, rx: 0.214, rz: 0.119, fb: 0.04, pec: 0.06, n: 2.6, cz: 0.01 },
    { y: 1.445, rx: 0.226, rz: 0.106, n: 2.4 },
    { y: 1.49, rx: 0.178, rz: 0.094, n: 2.3, cz: -0.006 },
    { y: 1.525, rx: 0.122, rz: 0.084, n: 2.2, cz: -0.006 },
    { y: 1.56, rx: 0.08, rz: 0.074, cz: 0.002 },
    { y: 1.6, rx: 0.071, rz: 0.069, cz: 0.01 },
    { y: 1.68, rx: 0.05, rz: 0.05, cz: 0.015 },
  ];
}
function spArmRings() {
  const X = 0.215;
  return [
    [-0.56, 0.012, 0.012], [-0.545, 0.029, 0.026], [-0.52, 0.033, 0.029], [-0.46, 0.036, 0.031], [-0.41, 0.043, 0.037],
    [-0.35, 0.05, 0.044], [-0.3, 0.046, 0.043], [-0.25, 0.049, 0.047, 0, 0, 0.06], [-0.18, 0.055, 0.053, 0, 0.16, 0.1],
    [-0.1, 0.06, 0.057, 0.003, 0.1, 0.12], [-0.035, 0.066, 0.061, 0.008], [-0.005, 0.063, 0.059, 0.007], [0.018, 0.054, 0.051, 0.005], [0.034, 0.036, 0.035, 0.003], [0.045, 0.012, 0.012],
  ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => ({ y: SHY + t, rx, rz, cx: X + cx, fb, bb }));
}
function spLegRings() {
  const X = 0.09;
  return [
    [-0.87, 0.02, 0.02], [-0.85, 0.036, 0.04], [-0.82, 0.04, 0.045], [-0.76, 0.044, 0.05, 0, 0, 0.1], [-0.67, 0.052, 0.058, 0, 0, 0.24],
    [-0.58, 0.059, 0.066, 0, 0, 0.3], [-0.5, 0.058, 0.062], [-0.44, 0.06, 0.064, 0, 0.08], [-0.36, 0.071, 0.075, 0, 0.12],
    [-0.26, 0.083, 0.087, 0.004, 0.13], [-0.15, 0.093, 0.096, 0.008, 0.1], [-0.04, 0.099, 0.1, 0.01, 0, 0.06], [0.05, 0.097, 0.097, 0.01], [0.12, 0.05, 0.05],
  ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => ({ y: HIPY + t, rx, rz, cx: X + cx, fb, bb }));
}
// c: bok (+1 = na zewnatrz / lewy bok tulowia), s: przod (+1)
function torsoSculpt(c, s, y) {
  const ac = Math.abs(c), fr = Math.max(0, s), bk = Math.max(0, -s);
  let d = 0.013 * fr * gs(ac, 0.42, 0.24) * sm(1.235, 1.285, y) * (1 - sm(1.37, 1.44, y)); // piersi z wyrazna dolna krawedzia
  d -= 0.005 * fr * gs(c, 0, 0.07) * sm(1.17, 1.24, y) * (1 - sm(1.4, 1.46, y));             // rowek mostka
  for (const yr of [1.03, 1.09, 1.15]) d += 0.0045 * fr * gs(ac, 0.2, 0.1) * gs(y, yr, 0.024); // "kaloryfer"
  d -= 0.003 * fr * gs(c, 0, 0.05) * sm(0.97, 1.03, y) * (1 - sm(1.19, 1.24, y));            // kresa biala
  d += 0.004 * gs(ac, 0.8, 0.14) * gs(y, 0.99, 0.04) * (0.5 + 0.5 * fr);                     // skosne brzucha
  d += 0.011 * bk * gs(ac, 0.62, 0.22) * gs(y, 1.27, 0.075);                                  // najszersze grzbietu
  d += 0.006 * bk * gs(ac, 0.36, 0.15) * gs(y, 1.38, 0.045);                                  // lopatki
  d -= 0.006 * bk * gs(c, 0, 0.08) * sm(0.95, 1.05, y) * (1 - sm(1.44, 1.5, y));             // rowek kregoslupa
  d += 0.006 * bk * gs(ac, 0.45, 0.28) * gs(y, 0.88, 0.045);                                 // posladki
  d += 0.007 * bk * gs(ac, 0.4, 0.3) * gs(y, 1.5, 0.03);                                      // czworoboczny
  d += 0.007 * gs(ac, 0.93, 0.12) * gs(y, 1.42, 0.04);                                        // przod barku
  return d;
}
function armSculpt(c, s, y) {
  const t = y - SHY, fr = Math.max(0, s), bk = Math.max(0, -s);
  let d = 0.01 * gs(t, -0.04, 0.07) * Math.max(0, c * 0.8 + 0.35);  // naramienny
  d += 0.007 * fr * gs(t, -0.19, 0.055) * gs(c, 0, 0.6);            // biceps
  d += 0.007 * bk * gs(t, -0.15, 0.06);                              // triceps
  d += 0.006 * gs(t, -0.36, 0.035) * Math.max(0, c * 0.5 + s * 0.7); // przedramie
  d -= 0.003 * fr * gs(t, -0.27, 0.02);                              // zgiecie lokcia
  return d;
}
function legSculpt(c, s, y) {
  const t = y - HIPY, fr = Math.max(0, s), bk = Math.max(0, -s);
  let d = 0.008 * fr * gs(t, -0.17, 0.1) * gs(c, 0.1, 0.7);          // prosty uda
  d += 0.008 * gs(t, -0.36, 0.04) * Math.max(0, -c * 0.8 + s * 0.4); // obszerny przysrodkowy ("kropla" nad kolanem)
  d += 0.005 * gs(t, -0.22, 0.09) * Math.max(0, c);                  // obszerny boczny
  d += 0.004 * fr * gs(c, 0, 0.3) * gs(t, -0.445, 0.02);             // rzepka
  d += 0.006 * bk * gs(t, -0.2, 0.1);                                // tyl uda
  d += 0.008 * bk * gs(t, -0.6, 0.05) * gs(Math.abs(c), 0.35, 0.35); // lydki (dwie glowy)
  return d;
}
function sculpt(d, rings, segs, fn) {
  const S = segs + 1;
  for (let k = 0; k < rings.length; k++) for (let i = 0; i <= segs; i++) {
    const a = (i / segs - 0.5) * TAU + Math.PI / 2, c = Math.cos(a), s = Math.sin(a), v = fn(c, s, rings[k].y);
    if (v) { const o = (k * S + i) * 3; d.pos[o] += c * v; d.pos[o + 2] += s * v; }
  }
  return d;
}
// glowa w masce: delikatnie widoczny nos, luki brwiowe, kosci policzkowe i broda
function spHeadPoint(a, phi, b, out) {
  headPoint(a, phi, b, false, out);
  const sp = Math.sin(phi), da = a - Math.PI / 2, ad = Math.abs(da);
  let z = 0.009 * gs(da, 0, 0.16) * gs(sp, -0.02, 0.12);
  z += 0.005 * gs(da, 0, 0.6) * gs(sp, 0.25, 0.07);
  z += 0.007 * gs(da, 0, 0.3) * gs(sp, -0.6, 0.12);
  z += 0.004 * gs(ad, 0.55, 0.2) * gs(sp, -0.06, 0.1);
  if (sp < -0.2) { const j = sm(-0.2, -0.75, sp) * sm(0.35, 1.0, ad) * sm(0, 1, Math.sin(a)); out.x *= 1 - 0.07 * j; } // zwezona zuchwa
  out.z += z * Math.max(0, Math.sin(a));
  return out;
}
function spHeadData(b, segs = 48, rings = 34) {
  const pos = [], uv = [], idx = [], P = new V3();
  for (let k = 0; k <= rings; k++) {
    const phi = -Math.PI / 2 + k / rings * Math.PI;
    for (let i = 0; i <= segs; i++) { const u = i / segs; spHeadPoint((u - 0.5) * TAU + Math.PI / 2, phi, b, P); pos.push(P.x, P.y, P.z); uv.push(u, k / rings); }
  }
  const S = segs + 1;
  for (let k = 0; k < rings; k++) for (let i = 0; i < segs; i++) { const a = k * S + i, bb = a + 1, d = a + S, c = d + 1; idx.push(a, c, bb, a, d, c); }
  return { pos, uv, idx, sk: [], sw: [], seams: [{ start: 0, S, R: rings + 1 }] };
}
// duze soczewki jak w PS4: szeroki kat na zewnatrz-w gore, ostrzejszy kacik przy nosie
function spLensData(b, s, scale, lift) {
  const pos = [], uv = [], idx = [], RN = 7, SN = 40, P = new V3(), C0 = new V3(0, HC, 0.012), n = new V3();
  for (let j = 0; j <= RN; j++) {
    const r = j / RN;
    for (let i = 0; i <= SN; i++) {
      const th = i / SN * TAU, c = Math.cos(th), sn = Math.sin(th);
      const R = (1 + 0.55 * Math.pow(Math.max(0, Math.cos(th - 0.5)), 3) + 0.3 * Math.pow(Math.max(0, Math.cos(th - 3.75)), 8)) / Math.pow(Math.pow(Math.abs(c), 2.6) + Math.pow(Math.abs(sn), 2.6), 1 / 2.6);
      const X = c * 0.27 * R * r * scale, Y = sn * 0.165 * R * r * scale, tl = 0.36;
      const Xr = X * Math.cos(tl) - Y * Math.sin(tl), Yr = X * Math.sin(tl) + Y * Math.cos(tl);
      spHeadPoint(Math.PI / 2 - s * 0.4 - s * Xr, 0.1 + Yr, b, P);
      n.copy(P).sub(C0).normalize(); P.addScaledVector(n, lift * (1 - 0.35 * r * r));
      pos.push(P.x, P.y, P.z); uv.push(0.5 + X * 0.9, 0.5 + Y * 1.3);
    }
  }
  for (let j = 0; j < RN; j++) for (let i = 0; i < SN; i++) { const a = j * (SN + 1) + i, bb = a + 1, d = a + SN + 1, c = d + 1; idx.push(a, bb, c, a, c, d); }
  return { pos, uv, idx, sk: [], sw: [], seams: [] };
}

export function buildSpider(s) {
  const M = suitMats(s), b = BODY.spider, H = makeRig(b);
  H.root.updateMatrixWorld(true);
  const skel = new THREE.Skeleton(H.bones);
  const skinned = (d, mat) => {
    mat.skinning = true; // w three r128 bez tego skora nie podaza za koscmi
    const m = new THREE.SkinnedMesh(toGeo(d), mat); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true;
    H.root.add(m); m.updateMatrixWorld(true); m.bind(skel); return m;
  };
  const tr = smooth(spTorsoRings(), 5);
  skinned(sculpt(tubeData(tr, 56, r => (r.y - 0.79) / 0.91, wTorso), tr, 56, torsoSculpt), M.torso);
  const ar = smooth(spArmRings(), 4);
  const arm = sculpt(tubeData(ar, 32, r => (r.y - (SHY - 0.56)) / 0.655, wArm), ar, 32, armSculpt);
  skinned(merge([arm, mirror(arm)]), M.arm);
  const lr = smooth(spLegRings(), 4);
  const leg = sculpt(tubeData(lr, 32, r => (r.y - (HIPY - 0.87)) / 0.99, wLeg), lr, 32, legSculpt);
  skinned(merge([leg, mirror(leg)]), M.leg);
  const head = new THREE.Mesh(toGeo(spHeadData(b)), M.head); head.castShadow = true; H.neck.add(head); H.headM = head;
  // dlonie w rekawicach (troche wieksze niz u przechodniow) i stopy
  const HB = { arm: 1.08 };
  H.hands = {};
  for (const sd of [1, -1]) {
    const L = sd > 0 ? 'L' : 'R', set = {};
    for (const v of ['open', 'fist', 'thwip']) {
      const m = new THREE.Mesh(toGeo(handData(v, sd, HB)), M.hand); m.castShadow = true; m.visible = v === 'open';
      H['hand' + L].add(m); set[v] = m;
    }
    H.hands[L] = set;
    const f = new THREE.Mesh(toGeo(shoeData('spider', 1.03)), M.foot); f.castShadow = true;
    H['ft' + L].add(f);
  }
  H.handPose = { L: 'open', R: 'open' };
  H.setHands = (l, r) => {
    for (const [side, v] of [['L', l], ['R', r]]) {
      if (H.handPose[side] === v || !H.hands[side][v]) continue;
      for (const k in H.hands[side]) H.hands[side][k].visible = k === v;
      H.handPose[side] = v;
    }
  };
  H.b = b;
  // oczy: czarna oprawa i biale soczewki
  for (const side of [1, -1]) {
    const rim = new THREE.Mesh(toGeo(spLensData(b, side, 1.36, 0.0035)), M.rim);
    const lens = new THREE.Mesh(toGeo(spLensData(b, side, 1.1, 0.0062)), M.eye);
    H.neck.add(rim, lens);
    // do mimiki mowy (mowa.js): zwezanie soczewek wzdluz osi "gora" glowy wokol ich srodka
    for (const m of [rim, lens]) { m.geometry.computeBoundingBox(); (H.lens || (H.lens = [])).push({ m, cy: (m.geometry.boundingBox.min.y + m.geometry.boundingBox.max.y) / 2 }); }
  }
  H.squint = k => { // k 0..1 (0 = oczy normalne)
    const sy = 1 - 0.34 * k, sx = 1 + 0.05 * k;
    for (const l of H.lens) { l.m.scale.set(sx, sy, 1); l.m.position.y = l.cy * (1 - sy); }
  };
  // wyrzutnie sieci na nadgarstkach (w stroju z PS4 schowane pod rekawica)
  if (s.layout === 'adv') return H;
  const wm = new THREE.MeshStandardMaterial({ color: 0x8d9399, metalness: 0.8, roughness: 0.32 });
  for (const L of ['L', 'R']) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0335, 0.035, 0.022, 20), wm);
    w.position.y = -0.245; w.scale.z = 0.92; H['el' + L].add(w);
  }
  return H;
}
function addHat(H, o, M) {
  const hs = H.b.head, hc = new V3(0, HC, 0.012), sh = m => { m.castShadow = true; return m; };
  const covered = o.hat === 'hood' || o.mask === 'balaclava';
  if (o.hair === 'short' && !covered && o.hat !== 'beanie') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.22), M.hair);
    h.scale.set(0.106 * hs, 0.132 * hs, 0.12 * hs); h.position.set(0, HC + 0.004, 0.006); h.rotation.x = -0.38; H.neck.add(h);
  }
  if (o.hat === 'beanie') {
    const h = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.45), M.hat));
    h.scale.set(0.11 * hs, 0.145 * hs, 0.12 * hs); h.position.copy(hc); h.rotation.x = -0.2; H.neck.add(h);
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.15, 8, 28), M.hat); // wywiniety brzeg
    r.scale.set(0.106 * hs, 0.116 * hs, 0.12); r.rotation.x = Math.PI / 2 - 0.2; r.position.set(0, HC + 0.022, 0.006); H.neck.add(r);
  } else if (o.hat === 'cap' || o.hat === 'capback') {
    const g = new THREE.Group(); g.position.copy(hc); if (o.hat === 'capback') g.rotation.y = Math.PI; H.neck.add(g);
    const h = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.35), M.hat));
    h.scale.set(0.108 * hs, 0.126 * hs, 0.118 * hs); h.rotation.x = -0.15; g.add(h);
    const brim = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), M.hat));
    brim.position.set(0, 0.048, 0.058); brim.scale.set(0.95, 1, 1.25); brim.rotation.x = 0.12; g.add(brim);
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), M.hat); btn.position.set(0, 0.126 * hs, -0.015); g.add(btn);
  } else if (o.hat === 'hood') { // kaptur na glowie, otwarty z przodu
    const hood = sh(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, Math.PI / 2 + 1.0, TAU - 2.0, 0, 2.25), M.top));
    hood.scale.set(0.13 * hs, 0.152 * hs, 0.142 * hs); hood.position.set(0, HC + 0.012, -0.008); hood.rotation.x = -0.12; H.neck.add(hood);
  }
  if (o.top === 'hoodie' && o.hat !== 'hood') { // kaptur zsuniety na plecy
    const hood = sh(new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 10, 24, Math.PI), M.top));
    hood.rotation.x = -Math.PI / 2 + 0.35; hood.position.set(0, 0.27, -0.01); hood.scale.set(1.1, 1.15, 0.8); H.chest.add(hood);
  }
  if (o.top === 'bomber' || o.top === 'leather' || o.top === 'puffer') { // kolnierz
    const r = sh(new THREE.Mesh(new THREE.TorusGeometry(1, 0.22, 8, 28), o.top === 'leather' ? M.top : M.top));
    const nk = H.b.neck; r.scale.set(0.09 * nk, 0.085 * nk, o.top === 'puffer' ? 0.12 : 0.08); r.rotation.x = Math.PI / 2 - 0.25; r.position.set(0, 0.29, 0.0); H.chest.add(r);
  }
  for (const s of [1, -1]) { // uszy (pod kominiarka w jej kolorze)
    if (o.hat === 'hood') continue;
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.skin); e.scale.set(0.014, 0.03, 0.02); e.position.set(0.097 * hs * s, HC, 0.0); H.neck.add(e);
  }
}
// dodatki: lancuch na szyi, kieszenie kamizelki, cholewki butow
function addGear(H, o, M) {
  const b = H.b;
  if (o.chain) {
    const g = new THREE.TorusGeometry(1, 0.045, 6, 40); g.scale(0.14 * b.w + 0.016, 0.125 * b.chest + 0.02, 0.16); g.rotateX(Math.PI / 2); g.rotateX(0.5); g.translate(0, 0.27, 0.0);
    const c = new THREE.Mesh(g, M.metal); H.chest.add(c);
    const pend = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.035, 0.008), M.metal); pend.position.set(0, 0.27 - (0.125 * b.chest + 0.02) * Math.sin(0.5) - 0.02, (0.125 * b.chest + 0.02) * Math.cos(0.5) + 0.006); pend.rotation.x = -0.3; H.chest.add(pend);
  }
  if (o.top === 'vest') {
    const vm = new THREE.MeshStandardMaterial({ color: o.topCol, roughness: 0.85 }), fz = 0.112 * b.waist * (1 + b.belly) + 0.02;
    for (const x of [-0.085, 0, 0.085]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.045), vm); p.position.set(x, -0.13, fz); p.castShadow = true; H.chest.add(p); }
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.04), vm); r.position.set(0.11, 0.07, 0.118 * b.chest * 1.12 + 0.02); r.castShadow = true; H.chest.add(r);
  }
  if (o.shoe === 'boot') for (const L of ['L', 'R']) {
    const k = b === BODY.brute || b.leg > 1.1 ? 1.12 : 1;
    const rg = [{ y: -0.03, rx: 0.05, rz: 0.058, cz: 0.004 }, { y: 0.04, rx: 0.047, rz: 0.052 }, { y: 0.11, rx: 0.046, rz: 0.05 }, { y: 0.135, rx: 0.044, rz: 0.048 }].map(r => ({ ...r, rx: r.rx * k, rz: r.rz * k }));
    const m = new THREE.Mesh(toGeo(tubeData(smooth(rg, 2), 20, r => 0.95, null)), M.foot); m.castShadow = true; H['ft' + L].add(m);
  }
}
export function buildThug(kind = 'thug', outfit) {
  const o = outfit || randomOutfit(kind), M = outfitMats(o);
  let body;
  if (o.top === 'puffer') { const b0 = BODY[kind]; body = { ...b0, w: b0.w * 1.04, chest: b0.chest * 1.07, waist: b0.waist * 1.12, belly: b0.belly + 0.04, arm: b0.arm * 1.1 }; }
  const H = build(kind, M, { face: true, shoe: o.shoe, body });
  addHat(H, o, M); addGear(H, o, M); H.outfit = o;
  return H;
}
// Bossowie (Nosorozec, Kingpin) maja wlasny plik: tekstury, geometria pancerza/garnituru
export { buildBoss, buildKingpin } from './bossowie_model.js';
export { build, C, noise, ell, tex, drawFace, outfitCanvases, toGeo, merge, tubeData, smooth, sweepData, headData, normalFromHeight, HC, SHY, HIPY };

// ---------------------------------------------------------------- przechodnie (tlum na instancjach)
// Kazda sylwetka (mezczyzna, tegi mezczyzna, kobieta) to JEDNA geometria w pozie spoczynkowej z dodatkami
// (czapki, plecaki, torby, plaszcz, spodnica, telefon...). Chod liczy shader wierzcholkow: kazdy wierzcholek
// wie, do ktorej konczyny nalezy (pp.x) i jak mocno (pp.y, pp.z), a faza kroku przychodzi z instancji.
// Kolory czesci ubrania to indeksy do wspolnej palety, dodatki wlacza maska bitowa — jedno rysowanie na sylwetke.
export const PED_PAL = [
  '#1a1a1e', '#2a2626', '#b48a5a', // 0 telefon, 1 rajstopy, 2 papierowa torba
  '#f1c9a5', '#e0b394', '#c68e6a', '#b07a55', '#8d5a3b', '#5e3a24', // 3-8 skora
  '#1b1410', '#3b2414', '#6b4a2a', '#a07040', '#d8b878', '#8a8a86', // 9-14 wlosy
  '#c0392b', '#2e6fbe', '#efefec', '#222222', '#2f8f57', '#e2b31a', '#7d3c98', '#7f8c8d', '#c8581a', '#3b4b5c', '#e8d8c0', '#1f3a5c', '#6b1a2a', '#4a5a3a', '#c76b8a', '#9fb6c8', // 15-30 gora
  '#27344f', '#1e2533', '#3b3f4a', '#2b2b2b', '#4a4032', '#5c4a3a', '#b8a888', // 31-37 spodnie
  '#2b2b2e', '#5a4636', '#8a7a64', '#1d2a3a', '#6b2a2a', // 38-42 plaszcze
  '#eeeeee', '#1a1a1a', '#5a3a22', '#8a8a8a', '#b8141c', // 43-47 buty
  '#1a1a1a', '#6b1a1a', '#d49a16', '#2d3d2d', '#c8b896', '#3a5a8a', // 48-53 torby i czapki
];
export const PF = { CAP: 1, BEANIE: 2, BACKPACK: 4, BAG: 8, PHONE: 16, COAT: 32, SKIRT: 64, SHORT: 128, SHOP: 256, LONGHAIR: 512 };
const PR = (a, b) => [a, b];
const PAL = { skin: PR(3, 8), hair: PR(9, 14), top: PR(15, 30), bot: PR(31, 37), coat: PR(38, 42), shoe: PR(43, 47), acc: PR(48, 53) };
// losowy wyglad przechodnia: [gora, dol, skora, wlosy], [buty, czapka, torba, plaszcz], flagi
export function pedLook(r, female) {
  const P = k => PAL[k][0] + Math.floor(r() * (PAL[k][1] - PAL[k][0] + 1)), ch = p => r() < p;
  let f = 0;
  const coat = ch(0.28); if (coat) f |= PF.COAT; else if (ch(0.3)) f |= PF.SHORT;
  if (female) {
    if (ch(0.75)) f |= PF.LONGHAIR;
    if (ch(0.35)) f |= PF.SKIRT;
    if (ch(0.45)) f |= PF.BAG; else if (ch(0.15)) f |= PF.BACKPACK;
    if (ch(0.08)) f |= PF.BEANIE;
  } else {
    const h = r(); if (h < 0.18) f |= PF.CAP; else if (h < 0.3) f |= PF.BEANIE;
    if (ch(0.2)) f |= PF.BACKPACK; else if (ch(0.1)) f |= PF.BAG;
  }
  if (ch(0.24)) f |= PF.PHONE;
  if (ch(0.1)) f |= PF.SHOP;
  let hair = P('hair'); const skin = P('skin');
  if (skin >= 7 && hair > 11) hair = 9 + Math.floor(r() * 2); // ciemna karnacja: zwykle ciemne wlosy
  return { c0: [P('top'), P('bot'), skin, hair], c1: [P('shoe'), P('acc'), P('acc'), P('coat')], flags: f };
}

// atlas 512x512: twarz (gora), tulow, reka, noga i male kafelki. Kanal alfa < 1 = piksel NIE barwiony kolorem czesci.
const AT = { face: [0, 0, 512, 256], torso: [0, 256, 256, 256], arm: [256, 256, 64, 256], leg: [320, 256, 64, 256],
  skin: [384, 256, 64, 64], hair: [448, 256, 64, 64], shoe: [384, 320, 64, 64], fab: [448, 320, 64, 64],
  phone: [384, 384, 64, 64], coat: [448, 384, 64, 64], paper: [384, 448, 64, 64], hat: [448, 448, 64, 64] };
const atUV = k => { const [x0, y0, w, h] = AT[k]; return (u, v) => [(x0 + 1 + u * (w - 2)) / 512, 1 - (y0 + 1 + (1 - v) * (h - 2)) / 512]; };
let pedAtlasTex = null;
function pedAtlas() {
  if (pedAtlasTex) return pedAtlasTex;
  const A = C(512, 512), M = C(512, 512), x = A.x, m = M.x;
  x.fillStyle = '#f6f2ee'; x.fillRect(0, 0, 512, 512);
  m.fillStyle = '#fff';
  // twarz
  x.save(); x.beginPath(); x.rect(0, 0, 512, 256); x.clip();
  drawFace(x, { skin: '#fff3ea', hair: 'none', browCol: 'rgba(60,35,20,.75)', beard: 0, eyeCol: '#3b2a1c' }, m);
  x.restore();
  // tulow (v = wysokosc 0.79..1.7)
  const ty = y => 256 + (1 - (y - 0.79) / 0.91) * 256;
  for (let i = 0; i < 2500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.05)'; x.fillRect(Math.random() * 256, 256 + Math.random() * 256, 2, 2); }
  let g = x.createLinearGradient(0, ty(1.45), 0, ty(1.0)); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.14)');
  x.fillStyle = g; x.fillRect(0, ty(1.45), 256, ty(1.0) - ty(1.45));
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, ty(1.56), 256, 5); // kolnierz
  x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 2; x.beginPath(); x.moveTo(104, ty(1.545)); x.lineTo(128, ty(1.45)); x.lineTo(152, ty(1.545)); x.stroke(); // wyciecie pod szyja
  x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(127, ty(1.43), 2, ty(1.0) - ty(1.43)); // zapiecie
  x.fillStyle = 'rgba(255,255,255,.35)'; for (let y = 1.4; y > 1.02; y -= 0.08) { x.beginPath(); x.arc(133, ty(y), 1.6, 0, TAU); x.fill(); }
  x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 1.5;
  for (const sx of [64, 192]) { x.beginPath(); x.moveTo(sx, ty(1.47)); x.lineTo(sx, ty(1.0)); x.stroke(); }
  for (const sx of [100, 156]) { x.strokeRect(sx - 12, ty(1.38), 24, 18); } // kieszonki
  for (let i = 0; i < 5; i++) { const y = ty(1.08 + i * 0.03); x.beginPath(); x.moveTo(30 + i * 9, y); x.quadraticCurveTo(64, y + 5, 98 - i * 6, y); x.moveTo(158 + i * 6, y); x.quadraticCurveTo(192, y + 5, 226 - i * 9, y); x.stroke(); }
  x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(0, ty(1.0), 256, 4); // dol bluzy
  // spodnie: pasek, klamra, kieszenie, rozporek, tylne kieszenie
  x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(0, ty(0.995), 256, ty(0.965) - ty(0.995));
  x.fillStyle = 'rgba(255,255,255,.6)'; x.fillRect(123, ty(0.993), 10, ty(0.967) - ty(0.993));
  x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.5;
  for (const sg of [-1, 1]) { x.beginPath(); x.moveTo(128 + sg * 22, ty(0.965)); x.quadraticCurveTo(128 + sg * 34, ty(0.9), 128 + sg * 56, ty(0.9)); x.stroke(); }
  x.beginPath(); x.moveTo(131, ty(0.965)); x.lineTo(131, ty(0.86)); x.stroke();
  for (const cx of [26, 230]) x.strokeRect(cx - 16, ty(0.94), 32, 26);
  // reka: mankiet, szew na barku, zmarszczki w lokciu
  const [ax] = AT.arm, ay = v => 256 + (1 - v) * 256;
  for (let i = 0; i < 700; i++) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(ax + Math.random() * 64, 256 + Math.random() * 256, 2, 2); }
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(ax, ay(0.085), 64, 5); x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(ax, ay(0.86), 64, 3);
  x.strokeStyle = 'rgba(0,0,0,.14)'; x.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) { const y = ay(0.43) + (i - 1.5) * 7; x.beginPath(); x.moveTo(ax + 16, y); x.quadraticCurveTo(ax + 32, y + 4, ax + 48, y); x.stroke(); }
  // noga: szwy, zmarszczki w kolanie, nogawka
  const [lx] = AT.leg, ly = v => 256 + (1 - v) * 256;
  for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.06)' : 'rgba(255,255,255,.05)'; x.fillRect(lx + Math.random() * 64, 256 + Math.random() * 256, 1.5, 1.5); }
  x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(lx + 15, 256, 2, 256); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(lx + 47, 256, 2, 256);
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(lx, ly(0.06), 64, 6);
  x.strokeStyle = 'rgba(0,0,0,.15)';
  for (let i = 0; i < 4; i++) { const y = ly(0.45) + (i - 1.5) * 8; x.beginPath(); x.moveTo(lx + 20, y); x.quadraticCurveTo(lx + 32, y + 4, lx + 44, y); x.stroke(); }
  // kafelki
  const tile = (k, f) => { const [x0, y0, w, h] = AT[k]; x.save(); x.translate(x0, y0); x.beginPath(); x.rect(0, 0, w, h); x.clip(); f(x, w, h); x.restore(); };
  tile('hair', (c, w, h) => { c.fillStyle = '#d8d8d8'; c.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { c.strokeStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.3)'; c.lineWidth = 1; const x0 = Math.random() * w; c.beginPath(); c.moveTo(x0, 0); c.lineTo(x0 + (Math.random() - 0.5) * 6, h); c.stroke(); } });
  tile('shoe', (c, w, h) => { c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.fillRect(w * 0.12, 0, w * 0.26, h); c.strokeStyle = 'rgba(0,0,0,.3)'; for (let v = 18; v < 44; v += 5) { c.beginPath(); c.moveTo(w * 0.68, v); c.lineTo(w * 0.82, v + 2); c.stroke(); } });
  tile('fab', (c, w, h) => { c.fillStyle = '#e4e4e4'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h * 0.3, w, 2); c.fillRect(w * 0.5, 0, 1.5, h); noise(c, w, h, 200, 0.08); });
  tile('phone', (c, w, h) => { c.fillStyle = '#121214'; c.fillRect(0, 0, w, h); const gg = c.createLinearGradient(0, 0, 0, h); gg.addColorStop(0, '#9cc4ff'); gg.addColorStop(1, '#3a62b8'); c.fillStyle = gg; c.fillRect(8, 8, w - 16, h - 16); });
  tile('coat', (c, w, h) => { c.fillStyle = '#ececec'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(w / 2 - 1, 0, 2, h); c.fillRect(0, h - 4, w, 4); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(w / 2 + 2, 0, 6, h); noise(c, w, h, 300, 0.06); });
  tile('paper', (c, w, h) => { c.fillStyle = '#b48a5a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, 8, w, 2); c.fillRect(w * 0.5, 0, 1, h); c.fillStyle = '#f2ead8'; c.beginPath(); c.arc(w * 0.25, h * 0.55, 8, 0, TAU); c.fill(); });
  tile('hat', (c, w, h) => { c.fillStyle = '#e6e6e6'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(0,0,0,.14)'; for (let a = 0; a < w; a += 4) c.fillRect(a, 0, 1.5, h); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h * 0.85, w, 2); });
  // maska "niebarwionych" pikseli (oczy, telefon, papierowa torba)
  for (const k of ['phone', 'paper']) { const [x0, y0, w, h] = AT[k]; m.fillRect(x0, y0, w, h); }
  { const [x0, y0, w, h] = AT.shoe; m.fillRect(x0 + w * 0.12, y0, w * 0.26, h); } // podeszwa: zawsze jasna
  const im = x.getImageData(0, 0, 512, 512), mk = m.getImageData(0, 0, 512, 512).data;
  for (let i = 0; i < mk.length; i += 4) if (mk[i] > 127) im.data[i + 3] = 128;
  x.putImageData(im, 0, 0);
  pedAtlasTex = tex(A); pedAtlasTex.premultiplyAlpha = false;
  return pedAtlasTex;
}

// sylwetki przechodniow
export const PED_BODIES = [
  { b: { w: 0.98, chest: 0.96, waist: 1.04, belly: 0.06, pec: 0.45, hips: 1, arm: 0.95, leg: 1, neck: 1.02, head: 1 }, abd: 0.1, female: false },
  { b: { w: 1.1, chest: 1.1, waist: 1.34, belly: 0.42, pec: 0.2, hips: 1.14, arm: 1.12, leg: 1.08, neck: 1.22, head: 1.03 }, abd: 0.17, female: false },
  { b: { w: 0.86, chest: 0.9, waist: 0.84, belly: 0, pec: 1.6, hips: 1.12, arm: 0.84, leg: 0.97, neck: 0.84, head: 0.95 }, abd: 0.17, female: true },
];
const geoD = g => ({ pos: Array.from(g.attributes.position.array), uv: Array.from(g.attributes.uv.array), idx: g.index ? Array.from(g.index.array) : [...Array(g.attributes.position.count).keys()], sk: [], sw: [], seams: [] });
const _m4 = new THREE.Matrix4(), _o3 = new THREE.Object3D();
function prim(g, p, r, s, parent) {
  _o3.position.set(p[0], p[1], p[2]); _o3.rotation.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0); _o3.scale.set(s ? s[0] : 1, s ? s[1] : 1, s ? s[2] : 1); _o3.updateMatrix();
  g.applyMatrix4(_o3.matrix); if (parent) g.applyMatrix4(parent.matrixWorld); return geoD(g);
}
function xform(d, obj) { const p = d.pos, v = new V3(); for (let i = 0; i < p.length; i += 3) { v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(obj.matrixWorld); p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z; } return d; }
function splitRings(rings, y) { const k = rings.findIndex(r => r.y >= y); return [rings.slice(0, k + 1), rings.slice(k)]; }
function pedBody(b, L) {
  const H = makeRig(b); H.root.updateMatrixWorld(true);
  const pieces = [], pivX = [0, 0.09 * b.hips, -0.09 * b.hips, 0.215 * b.w, -0.215 * b.w, 0];
  const add = (d, part, at, wf) => {
    const n = d.pos.length / 3; d.pp = []; d.pv = [];
    for (let i = 0; i < n; i++) { const w = typeof wf === 'function' ? wf(d.pos[3 * i], d.pos[3 * i + 1], d.pos[3 * i + 2]) : wf; d.pp.push(w[0], w[1], w[2], part); d.pv.push(pivX[w[0]]); }
    if (at) { const f = atUV(at); for (let i = 0; i < d.uv.length; i += 2) { const [u, v] = f(d.uv[i], d.uv[i + 1]); d.uv[i] = u; d.uv[i + 1] = v; } }
    pieces.push(d);
  };
  const wT = (x, y) => { const hl = clamp((0.93 - y) / 0.12, 0, 1) * 0.6 * sm(0.01, 0.07, Math.abs(x)); if (hl > 0) return [x > 0 ? 1 : 2, hl, 0]; const t3 = sm(1.53, 1.6, y); return t3 > 0 ? [5, t3, 0] : [0, 0, 0]; };
  const wA = (x, y) => { const t = y - SHY; return [x > 0 ? 3 : 4, 1 - sm(0, 0.08, t) * 0.3, 1 - sm(-0.34, -0.22, t)]; };
  const wL = (x, y) => { const t = y - HIPY; return [x > 0 ? 1 : 2, 1 - sm(0, 0.1, t) * 0.35, 1 - sm(-0.5, -0.36, t)]; };
  // tulow: gora (1) i spodnie (2)
  const [tb, tr] = splitRings(smooth(torsoRings(b), 1), 0.98), [tt, tn] = splitRings(tr, 1.54), tv = r => (r.y - 0.79) / 0.91;
  add(tubeData(tb, L.t, tv, null), 2, 'torso', wT); add(tubeData(tt, L.t, tv, null), 1, 'torso', wT); add(tubeData(tn, L.t, tv, null), 0, 'torso', wT);
  // rece: ramie (1) i przedramie (13, krotki rekaw = skora)
  const [af, au] = splitRings(smooth(armRings(b), 1), SHY - 0.15), av = r => (r.y - (SHY - 0.56)) / 0.655;
  for (const [rg, part] of [[au, 1], [af, 13]]) { const d = tubeData(rg, L.a, av, null); add(d, part, 'arm', wA); add(mirror(d), part, 'arm', wA); }
  const leg = tubeData(smooth(legRings(b), 1), L.a, r => (r.y - (HIPY - 0.87)) / 0.99, null);
  add(leg, 12, 'leg', wL); add(mirror(leg), 12, 'leg', wL);
  // dlonie, buty, glowa
  const handR = [{ y: -0.125, rx: 0.008, rz: 0.016 }, { y: -0.11, rx: 0.015, rz: 0.034 }, { y: -0.07, rx: 0.019, rz: 0.044 }, { y: -0.025, rx: 0.021, rz: 0.045 }, { y: 0.015, rx: 0.019, rz: 0.035 }, { y: 0.04, rx: 0.012, rz: 0.014 }].map(r => ({ ...r, rx: r.rx * b.arm, rz: r.rz * b.arm }));
  for (const [hn, lb] of [['handL', 3], ['handR', 4]]) add(xform(tubeData(smooth(handR, 1), L.h, () => 0.5, null), H[hn]), 0, 'skin', [lb, 1, 1]);
  const SZ = [-0.062, -0.045, 0.0, 0.06, 0.12, 0.155, 0.17], SX = [0.024, 0.04, 0.045, 0.047, 0.04, 0.026, 0.008], SY = [0.036, 0.054, 0.052, 0.04, 0.028, 0.02, 0.008];
  for (const [fn, lb] of [['ftL', 1], ['ftR', 2]]) {
    const k = b.leg > 1.05 ? 1.06 : b.leg < 1 ? 0.92 : 1;
    const d = sweepData(SZ.map((z, i) => new V3(0, -0.072 + SY[i] * k, z * k)), SX.map((r, i) => [r * k, SY[i] * k]), L.s, new V3(0, 1, 0), 2.8);
    add(xform(d, H[fn]), 3, 'shoe', [lb, 1, 1]);
  }
  const hs = b.head, onHead = d => xform(d, H.neck);
  add(onHead(headData(b, true, L.hd[0], L.hd[1])), 0, 'face', [5, 1, 0]);
  if (L.ears) for (const s of [1, -1]) add(prim(new THREE.SphereGeometry(1, 8, 6), [0.097 * hs * s, HC, 0], null, [0.014, 0.03, 0.02], H.neck), 0, 'skin', [5, 1, 0]);
  const [sw, sh] = L.sp;
  add(prim(new THREE.SphereGeometry(1, sw, sh, 0, TAU, 0, 1.25), [0, HC + 0.004, 0.002], [-0.38, 0, 0], [0.107 * hs, 0.134 * hs, 0.122 * hs], H.neck), 4, 'hair', [5, 1, 0]);
  // dlugie wlosy (15): pelniejsza czapa + pasmo na plecy
  add(prim(new THREE.SphereGeometry(1, sw, sh, 0, TAU, 0, 1.4), [0, HC + 0.006, 0.0], [-0.45, 0, 0], [0.113 * hs, 0.14 * hs, 0.128 * hs], H.neck), 15, 'hair', [5, 1, 0]);
  add(prim(new THREE.SphereGeometry(1, sw, sh), [0, HC - 0.1, -0.055], [0.12, 0, 0], [0.108 * hs, 0.19, 0.068], H.neck), 15, 'hair', [5, 1, 0]);
  // czapka z daszkiem (5) i czapka zimowa (6)
  add(prim(new THREE.SphereGeometry(1, sw, sh, 0, TAU, 0, 1.38), [0, HC, 0.004], [-0.15, 0, 0], [0.11 * hs, 0.128 * hs, 0.12 * hs], H.neck), 5, 'hat', [5, 1, 0]);
  add(prim(new THREE.CylinderGeometry(0.1, 0.1, 0.01, 10, 1, false, -Math.PI / 2, Math.PI), [0, HC + 0.05, 0.075 * hs], [0.14, 0, 0], [0.95 * hs, 1, 1.3 * hs], H.neck), 5, 'hat', [5, 1, 0]);
  add(prim(new THREE.SphereGeometry(1, sw, sh, 0, TAU, 0, 1.52), [0, HC + 0.006, 0.0], [-0.22, 0, 0], [0.113 * hs, 0.148 * hs, 0.124 * hs], H.neck), 6, 'hat', [5, 1, 0]);
  // plecak (7)
  const back = 0.113 * b.chest;
  add(prim(new THREE.BoxGeometry(0.28 * b.w, 0.38, 0.13), [0, 1.2, -back - 0.07], null, null), 7, 'fab', [0, 0, 0]);
  if (L.ears) for (const s of [1, -1]) add(prim(new THREE.BoxGeometry(0.035, 0.02, 0.2 * b.chest), [0.085 * s, 1.5, -0.01], null, null), 7, 'fab', [0, 0, 0]);
  // torba na ramie (8): pasek po skosie przez tulow + torba z boku
  {
    let rz = 0; for (const r of torsoRings(b)) if (r.y > 0.95 && r.y < 1.42) rz = Math.max(rz, (r.rz || 0) * (1 + (r.fb || 0) + (r.pec || 0) * 0.6));
    // od lewego biodra (x+, nisko) przez piers do prawego barku przy szyi (x-, wysoko)
    const hx0 = 0.16 * Math.max(b.hips, b.waist), e0 = new V3(hx0, 0.95, 0), e1 = new V3(-0.11 * b.w, 1.52, 0), c0 = e0.clone().add(e1).multiplyScalar(0.5), ax = e1.clone().sub(e0).multiplyScalar(0.5), pts = [], rad = [];
    for (let i = 0; i <= 20; i++) { const a = i / 20 * TAU; pts.push(c0.clone().addScaledVector(ax, Math.cos(a)).add(new V3(0, 0, (rz + 0.016) * Math.sin(a)))); rad.push([0.012, 0.005]); }
    add(sweepData(pts, rad, 4, new V3(0, 1, 0)), 8, 'fab', [0, 0, 0]);
    const hx = 0.17 * Math.max(b.hips, b.waist * 0.95) + 0.03;
    add(prim(new THREE.BoxGeometry(0.075, 0.2, 0.25), [hx, 0.93, 0.03], [0, 0, 0.06], null), 8, 'fab', [0, 0, 0]);
  }
  // telefon w prawej dloni (9)
  add(prim(new THREE.BoxGeometry(0.068, 0.135, 0.01), [-0.215 * b.w + 0.012, HIPY - 0.04 - 0.035, 0.03], [-0.67, 0, 0], null), 9, 'phone', [4, 1, 1]);
  // plaszcz (10) i spodnica (11): stozki od pasa w dol
  const kw = Math.max(b.waist * (1 + b.belly * 0.8), b.chest), kh = Math.max(b.hips, b.waist * (1 + b.belly * 0.3));
  const coat = [{ y: 0.45, rx: 0.205 * kh, rz: 0.19 }, { y: 0.62, rx: 0.195 * kh, rz: 0.17 }, { y: 0.8, rx: 0.18 * kh, rz: 0.145 * kh }, { y: 0.95, rx: 0.168 * kh + 0.01, rz: 0.125 * kh + 0.01 }, { y: 1.06, rx: 0.15 * kw + 0.012, rz: 0.105 * kw + 0.012 }];
  add(tubeData(smooth(coat, L.c), L.t, r => (r.y - 0.45) / 0.61, null), 10, 'coat', [0, 0, 0]);
  const skirt = [{ y: 0.6, rx: 0.2 * kh, rz: 0.17 }, { y: 0.75, rx: 0.185 * kh, rz: 0.15 }, { y: 0.9, rx: 0.17 * kh + 0.008, rz: 0.125 * kh + 0.01 }, { y: 1.0, rx: 0.152 * b.waist + 0.01, rz: 0.104 * b.waist + 0.01 }];
  add(tubeData(smooth(skirt, L.c), L.t, r => (r.y - 0.6) / 0.4, null), 11, 'fab', [0, 0, 0]);
  // torba z zakupami w lewej dloni (14)
  add(prim(new THREE.BoxGeometry(0.1, 0.3, 0.26), [0.215 * b.w + 0.075, 0.66, 0], null, null), 14, 'paper', [3, 1, 1]);
  // scalenie + atrybuty animacji
  const o = merge(pieces), pp = [], pv = [];
  for (const d of pieces) { pp.push(...d.pp); pv.push(...d.pv); }
  const g = toGeo(o);
  g.setAttribute('pp', new THREE.Float32BufferAttribute(pp, 4)); g.setAttribute('pv', new THREE.Float32BufferAttribute(pv, 1));
  return g;
}
const PED_LOD = { hi: { t: 16, a: 8, h: 7, s: 8, hd: [18, 12], sp: [14, 7], c: 2, ears: true }, lo: { t: 8, a: 5, h: 4, s: 5, hd: [10, 7], sp: [8, 4], c: 1, ears: false } };
export function pedGeometries() { return PED_BODIES.map(B => ({ ...B, hi: pedBody(B.b, PED_LOD.hi), lo: pedBody(B.b, PED_LOD.lo) })); }

// shader chodu
export const pedU = { uTime: { value: 0 }, uPal: { value: PED_PAL.map(h => new THREE.Color(h).convertSRGBToLinear()) } };
const PED_VH = `
attribute vec4 pp; attribute float pv; attribute vec4 iA; attribute vec4 iC0; attribute vec4 iC1;
uniform vec3 uPal[${PED_PAL.length}]; uniform float uTime; uniform float uAbd;
varying vec3 vPedCol;
float pbit(float f, float b) { return mod(floor((f + 0.5) / b), 2.0); }
mat3 rX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
`;
const PED_VB = `
vec3 objectNormal = vec3(normal);
vec3 pedP = position;
{
  float ph = iA.x, A = iA.y, F = iA.z, sd = iA.w;
  float limb = pp.x, wu = pp.y, wl = pp.z, part = pp.w;
  float coat = pbit(F, 32.0), skirt = pbit(F, 64.0), phone = pbit(F, 16.0), shop = pbit(F, 256.0), shortS = pbit(F, 128.0);
  float vis = 1.0;
  if (part > 4.5) {
    if (part < 5.5) vis = pbit(F, 1.0);
    else if (part < 6.5) vis = pbit(F, 2.0);
    else if (part < 7.5) vis = pbit(F, 4.0);
    else if (part < 8.5) vis = pbit(F, 8.0);
    else if (part < 9.5) vis = phone;
    else if (part < 10.5) vis = coat;
    else if (part < 11.5) vis = skirt;
    else if (part > 13.5 && part < 14.5) vis = shop;
    else if (part > 14.5) vis = pbit(F, 512.0);
  }
  float ci = iC0.x;
  if (part < 0.5) ci = iC0.z;
  else if (part < 1.5) ci = coat > 0.5 ? iC1.w : iC0.x;
  else if (part < 2.5) ci = iC0.y;
  else if (part < 3.5) ci = iC1.x;
  else if (part < 4.5) ci = iC0.w;
  else if (part < 6.5) ci = iC1.y;
  else if (part < 8.5) ci = iC1.z;
  else if (part < 9.5) ci = 0.0;
  else if (part < 10.5) ci = iC1.w;
  else if (part < 11.5) ci = iC0.y;
  else if (part < 12.5) ci = skirt > 0.5 ? 1.0 : iC0.y;
  else if (part < 13.5) ci = coat > 0.5 ? iC1.w : (shortS > 0.5 ? iC0.z : iC0.x);
  else if (part < 14.5) ci = 2.0;
  else ci = iC0.w;
  vPedCol = uPal[int(ci + 0.5)];
  float s = sin(ph);
  if (limb > 0.5 && limb < 2.5) {
    float q = limb < 1.5 ? ph : ph + 3.14159;
    float aU = -A * 0.44 * sin(q);
    float aL = A * (0.07 + 0.8 * pow(max(0.0, cos(q + 0.35)), 1.5));
    vec3 P1 = vec3(pv, 0.91, 0.0), P2 = vec3(pv, 0.49, 0.0);
    mat3 R1 = rX(aU), R2 = rX(aL);
    vec3 lo = R1 * (R2 * (pedP - P2) + P2 - P1) + P1, up = R1 * (pedP - P1) + P1;
    pedP = mix(pedP, mix(up, lo, wl), wu);
    objectNormal = mix(objectNormal, mix(R1 * objectNormal, R1 * (R2 * objectNormal), wl), wu);
  } else if (limb > 2.5 && limb < 4.5) {
    bool isL = limb < 3.5;
    float q = isL ? ph : ph + 3.14159;
    float k = (isL && shop > 0.5) ? 0.25 : 1.0;
    float aU = (A * 0.38 * sin(q) + 0.03) * k;
    float aL = -0.22 - A * 0.42 * max(0.0, -sin(q)) * k;
    float aZ = (isL ? 1.0 : -1.0) * (uAbd + ((isL && shop > 0.5) ? 0.07 : 0.0));
    if (A < 0.05) aU += 0.035 * sin(uTime * 0.9 + sd * 7.0 + limb);
    if (!isL && phone > 0.5) { aU = -0.45; aL = -1.75; aZ = 0.2; }
    vec3 P1 = vec3(pv, 1.45, 0.0), P2 = vec3(pv, 1.17, 0.0);
    mat3 R1 = rZ(aZ) * rX(aU), R2 = rX(aL);
    vec3 lo = R1 * (R2 * (pedP - P2) + P2 - P1) + P1, up = R1 * (pedP - P1) + P1;
    pedP = mix(pedP, mix(up, lo, wl), wu);
    objectNormal = mix(objectNormal, mix(R1 * objectNormal, R1 * (R2 * objectNormal), wl), wu);
  } else if (limb > 4.5) {
    float pitch = phone > 0.5 ? 0.42 : 0.05 * A;
    float yaw = (A < 0.05 ? 0.55 : 0.18) * sin(uTime * 0.31 + sd * 3.7) * (1.0 - 0.8 * phone);
    mat3 R = rY(yaw) * rX(pitch); vec3 P = vec3(0.0, 1.54, 0.0);
    pedP = mix(pedP, R * (pedP - P) + P, wu);
    objectNormal = mix(objectNormal, R * objectNormal, wu);
  }
  if (limb < 0.5 || limb > 2.5) {
    mat3 T = rY(A * 0.1 * s * smoothstep(0.95, 1.5, position.y));
    pedP = T * pedP; objectNormal = T * objectNormal;
  }
  if (A < 0.05) pedP.y += 0.004 * sin(uTime * 1.6 + sd * 5.0) * smoothstep(1.0, 1.45, position.y);
  pedP.y += A * (0.03 * cos(2.0 * ph) - 0.015);
  pedP *= vis;
}
`;
const PED_FM = `
#ifdef USE_MAP
  vec4 texelColor = texture2D(map, vUv);
  texelColor = mapTexelToLinear(texelColor);
  diffuseColor.rgb *= texelColor.rgb * mix(vec3(1.0), vPedCol, step(0.75, texelColor.a));
#endif
`;
export function pedMaterial(abd) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, map: pedAtlas() });
  m.userData.lin = true;
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = pedU.uTime; sh.uniforms.uPal = pedU.uPal; sh.uniforms.uAbd = { value: abd };
    sh.vertexShader = PED_VH + sh.vertexShader.replace('#include <beginnormal_vertex>', PED_VB).replace('#include <begin_vertex>', 'vec3 transformed = pedP;');
    sh.fragmentShader = 'varying vec3 vPedCol;\n' + sh.fragmentShader.replace('#include <map_fragment>', PED_FM);
  };
  return m;
}
