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
function suitCanvases(s) {
  if (s._cv) return s._cv;
  const key = k => k || 'p', colOf = k => k === 'p' ? s.prim : k === 's' ? s.sec : (s.acc || '#222');
  const webOn = k => k === 'p' && !!s.web;
  const L = { map: [], bump: [], emi: [] };
  const mk = (w, h) => { const m = C(w, h), b = C(w, h), e = C(w, h); b.x.fillStyle = '#808080'; b.x.fillRect(0, 0, w, h); e.x.fillStyle = '#000'; e.x.fillRect(0, 0, w, h); return { m, b, e }; };
  const region = (T, y0, y1, k, x0 = 0, w) => {
    w = w ?? T.m.w; k = key(k);
    T.m.x.fillStyle = colOf(k); T.m.x.fillRect(x0, y0, w, y1 - y0);
    if (webOn(k)) {
      webLines(T.m.x, x0, y0, w, y1 - y0, s.web, 2.2); webLines(T.b.x, x0, y0, w, y1 - y0, '#d8d8d8', 3);
      if (s.glow) webLines(T.e.x, x0, y0, w, y1 - y0, s.web, 2.4);
    } else hexDots(T.b.x, x0, y0, w, y1 - y0, '#949494');
  };
  const logo = (T, cx, cy, size, sxk) => {
    if (s.logoS === 'none') return;
    drawSpider(T.m.x, cx, cy, size, s.logo, s.logoS, sxk);
    T.b.x.save(); T.b.x.shadowColor = '#fff'; T.b.x.shadowBlur = 4; drawSpider(T.b.x, cx, cy, size, '#c8c8c8', s.logoS, sxk); T.b.x.restore();
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
  if (webOn(hk)) { headWeb(Hd.m.x, 512, 256, s.web, 2.2); headWeb(Hd.b.x, 512, 256, '#d8d8d8', 3); if (s.glow) headWeb(Hd.e.x, 512, 256, s.web, 2.4); }
  else hexDots(Hd.b.x, 0, 0, 512, 256, '#949494');
  // dlonie i stopy: male kafelki z siecia
  const tile = k => { const t = mk(128, 128); region(t, 0, 128, k); return t; };
  return (s._cv = { T, A, G, Hd, hand: tile(s.parts.hand), foot: tile(s.parts.foot) });
}
export function suitMats(s) {
  if (s._mats) return s._mats;
  const cvs = suitCanvases(s), rough = s.gloss ? 0.32 : 0.55, metal = s.metal ? 0.45 : 0.05;
  const mat = (t, rep) => {
    const m = new THREE.MeshStandardMaterial({ map: tex(t.m, rep), bumpMap: tex(t.b, rep), bumpScale: 0.035, roughness: rough, metalness: metal });
    if (s.glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex(t.e, rep); }
    return m;
  };
  const hand = mat(cvs.hand, true), foot = mat(cvs.foot, true);
  hand.map.repeat.set(2, 1); hand.bumpMap.repeat.set(2, 1); foot.map.repeat.set(3, 1); foot.bumpMap.repeat.set(3, 1);
  return (s._mats = {
    torso: mat(cvs.T), arm: mat(cvs.A), leg: mat(cvs.G), head: mat(cvs.Hd), hand, foot,
    eye: new THREE.MeshStandardMaterial({ color: s.eye, emissive: s.eye, emissiveIntensity: 0.4, roughness: 0.2, side: THREE.DoubleSide }),
    rim: new THREE.MeshStandardMaterial({ color: s.rim, roughness: 0.4, side: THREE.DoubleSide }),
  });
}
export function suitThumb(s) {
  if (s._thumb) return s._thumb;
  const c = cv(180, 120), x = c.getContext('2d'), T = suitCanvases(s).T.m.c;
  x.drawImage(T, 256 - 120, TY(1.56), 240, TY(1.12) - TY(1.56), 0, 0, 180, 120);
  const g = x.createLinearGradient(0, 0, 180, 0); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  x.fillStyle = g; x.fillRect(0, 0, 180, 120);
  return (s._thumb = c.toDataURL());
}

// ---------------------------------------------------------------- ubrania bandytow
const SKINS = ['#e6b996', '#c68e6a', '#8d5a3b', '#f1c9a5', '#5e3a24', '#b07a55'];
const HAIR = ['#1b1410', '#3b2414', '#0e0e0e', '#6b4a2a', '#2a2a2a'];
const TOPS = { hoodie: ['#2b2f36', '#4a1e22', '#1f3a2b', '#5b5f66', '#243142', '#6b5a3a'], leather: ['#1a1716', '#2b1d16', '#161a1f'], tshirt: ['#c9c2b3', '#3a3a3a', '#6b1a1a', '#1d3050'] };
const PANTS = ['#27344f', '#1e2533', '#3b3f4a', '#2b2b2b', '#4a4032'];
const pick = a => a[Math.floor(Math.random() * a.length)];
export function randomOutfit(kind) {
  if (kind === 'brute') return { kind, top: 'tank', topCol: pick(['#dcd6c8', '#2d2d2d', '#3d4a2c']), pants: pick(['#3d4a2c', '#4a4032', '#2b2b2b']), skin: pick(SKINS), hair: 'bald', hairCol: '#1b1410', hat: 'none', mask: false, shoe: 'boot', shoeCol: '#1c1a18' };
  const top = pick(['hoodie', 'hoodie', 'leather', 'tshirt']);
  return {
    kind, top, topCol: pick(TOPS[top]), pants: pick(PANTS), skin: pick(SKINS), hair: 'short', hairCol: pick(HAIR),
    hat: pick(['beanie', 'cap', 'none', 'beanie']), hatCol: pick(['#1a1a1a', '#6b1a1a', '#222233', '#2d3d2d', '#d49a16']),
    mask: Math.random() < 0.55, maskCol: pick(['#8a1515', '#15306e', '#111111', '#3d4a2c']), shoe: 'sneaker', shoeCol: pick(['#e8e8e8', '#1a1a1a', '#b8141c', '#2d56a8']),
  };
}
function outfitCanvases(o) {
  const T = C(512, 512), A = C(256, 512), G = C(256, 512), Hd = C(512, 256), Sh = C(256, 128);
  const tx = T.x, top = o.topCol;
  // tulow
  tx.fillStyle = top; tx.fillRect(0, 0, 512, TY(0.98));
  tx.fillStyle = o.pants; tx.fillRect(0, TY(0.98), 512, 512);
  if (o.top === 'tank') {
    tx.fillStyle = o.skin; tx.fillRect(0, 0, 512, TY(1.47));
    ell(tx, 256, TY(1.47), 70, 34);
    for (const cx of [128, 384]) ell(tx, cx, TY(1.4), 44, 70);
  }
  tx.fillStyle = o.skin; tx.fillRect(0, 0, 512, TY(1.55)); // szyja
  if (o.top === 'hoodie') {
    tx.fillStyle = 'rgba(0,0,0,.25)'; tx.beginPath(); tx.roundRect ? tx.roundRect(186, TY(1.14), 140, TY(1.02) - TY(1.14), 18) : tx.rect(186, TY(1.14), 140, TY(1.02) - TY(1.14)); tx.fill();
    tx.fillStyle = 'rgba(255,255,255,.08)'; for (let a = 0; a < 512; a += 6) tx.fillRect(a, TY(1.01), 3, TY(0.98) - TY(1.01));
    tx.strokeStyle = '#ddd'; tx.lineWidth = 3; for (const x of [246, 266]) { tx.beginPath(); tx.moveTo(x, TY(1.52)); tx.lineTo(x + (x - 256) * 0.3, TY(1.42)); tx.stroke(); }
  } else if (o.top === 'leather') {
    tx.fillStyle = '#8a8d91'; tx.fillRect(254, TY(1.53), 4, TY(0.99) - TY(1.53));
    tx.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 40; i++) tx.fillRect(Math.random() * 512, TY(1.5) + Math.random() * 200, 40 + Math.random() * 60, 2);
    tx.fillStyle = 'rgba(0,0,0,.35)'; tx.fillRect(0, TY(1.53), 512, 14);
  } else if (o.top === 'tshirt') {
    // tekstura jest lustrzana wzgledem przodu postaci, wiec napis rysujemy odbity
    tx.save(); tx.translate(256, TY(1.3)); tx.scale(-1, 1);
    tx.fillStyle = 'rgba(0,0,0,.55)'; tx.font = 'bold 44px Arial'; tx.textAlign = 'center'; tx.fillText(pick(['NY', 'NYC', '★', 'BK']), 0, 0); tx.restore();
  }
  // spodnie: szwy, pasek, rozporek
  tx.fillStyle = 'rgba(255,255,255,.12)'; for (const x of [128, 384]) tx.fillRect(x - 1, TY(0.98), 3, 512);
  tx.fillStyle = '#1a1a1a'; tx.fillRect(0, TY(0.995), 512, TY(0.965) - TY(0.995));
  if (o.top !== 'tank') { tx.fillStyle = '#b8b8b8'; tx.fillRect(244, TY(0.995), 24, TY(0.965) - TY(0.995)); }
  tx.fillStyle = 'rgba(0,0,0,.25)'; tx.fillRect(255, TY(0.96), 2, 50);
  noise(tx, 512, 512, 6000, 0.05);
  // reka
  const ax = A.x, sleeve = o.top === 'tank' ? 0.2 : o.top === 'tshirt' ? -0.13 : -0.52;
  ax.fillStyle = o.skin; ax.fillRect(0, 0, 256, 512);
  const g = ax.createLinearGradient(0, 0, 256, 0); g.addColorStop(0, 'rgba(0,0,0,.08)'); g.addColorStop(0.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
  ax.fillStyle = g; ax.fillRect(0, 0, 256, 512);
  if (sleeve < 0.1) { ax.fillStyle = top; ax.fillRect(0, 0, 256, AY(sleeve)); ax.fillStyle = 'rgba(0,0,0,.25)'; ax.fillRect(0, AY(sleeve) - 8, 256, 8); }
  if (o.kind === 'brute') { // tatuaz
    ax.strokeStyle = 'rgba(20,30,40,.8)'; ax.lineWidth = 5;
    for (let i = 0; i < 4; i++) { ax.beginPath(); ax.moveTo(40, AY(-0.02) + i * 22); ax.bezierCurveTo(90, AY(-0.02) + i * 22 - 30, 130, AY(-0.02) + i * 22 + 30, 200, AY(-0.02) + i * 22); ax.stroke(); }
  }
  noise(ax, 256, 512, 2500, 0.04);
  // noga
  const gx = G.x; gx.fillStyle = o.pants; gx.fillRect(0, 0, 256, 512);
  gx.fillStyle = 'rgba(255,255,255,.12)'; gx.fillRect(63, 0, 3, 512);
  gx.strokeStyle = 'rgba(0,0,0,.25)'; gx.lineWidth = 2;
  for (let i = 0; i < 6; i++) { const y = LY(-0.47) + (i - 3) * 9; gx.beginPath(); gx.moveTo(90 + i * 8, y); gx.quadraticCurveTo(128, y + 6, 170 - i * 5, y); gx.stroke(); }
  if (o.kind === 'brute') { gx.fillStyle = 'rgba(0,0,0,.25)'; gx.fillRect(40, LY(-0.18), 48, LY(-0.33) - LY(-0.18)); }
  gx.fillStyle = 'rgba(0,0,0,.2)'; gx.fillRect(0, LY(-0.8), 256, 8);
  noise(gx, 256, 512, 3000, 0.06);
  // twarz
  const hx = Hd.x; hx.fillStyle = o.skin; hx.fillRect(0, 0, 512, 256);
  noise(hx, 512, 256, 2000, 0.03);
  if (o.hair !== 'bald') { hx.fillStyle = o.hairCol; hx.fillRect(0, 0, 512, 92); hx.fillRect(0, 0, 150, 150); hx.fillRect(362, 0, 150, 150); }
  else { hx.fillStyle = 'rgba(30,20,10,.25)'; hx.fillRect(0, 0, 512, 90); }
  const ey = 121;
  for (const X of [226, 286]) {
    hx.fillStyle = '#f2ece2'; ell(hx, X, ey, 11, 5);
    hx.fillStyle = '#3b2a1c'; hx.beginPath(); hx.arc(X, ey, 4.2, 0, TAU); hx.fill();
    hx.fillStyle = '#000'; hx.beginPath(); hx.arc(X, ey, 2, 0, TAU); hx.fill();
    hx.strokeStyle = 'rgba(40,20,10,.6)'; hx.lineWidth = 2; hx.beginPath(); hx.ellipse(X, ey, 12, 6, 0, Math.PI * 1.05, Math.PI * 1.95); hx.stroke();
    // brwi — zmarszczone
    hx.strokeStyle = o.hair === 'bald' ? '#2a1a10' : o.hairCol; hx.lineWidth = 4.5; hx.beginPath();
    const inner = X < 256 ? X + 13 : X - 13, outer = X < 256 ? X - 13 : X + 13;
    hx.moveTo(outer, ey - 13); hx.lineTo(inner, ey - 8); hx.stroke();
  }
  hx.fillStyle = 'rgba(80,30,20,.25)'; ell(hx, 256, 138, 9, 5);
  hx.fillStyle = 'rgba(40,10,10,.5)'; ell(hx, 251, 139, 2.2, 1.5); ell(hx, 261, 139, 2.2, 1.5);
  hx.strokeStyle = '#5a2a22'; hx.lineWidth = 3; hx.beginPath(); hx.moveTo(243, 154); hx.quadraticCurveTo(256, 150, 269, 154); hx.stroke();
  if (o.kind === 'brute') { hx.fillStyle = 'rgba(20,15,10,.35)'; for (let i = 0; i < 500; i++) hx.fillRect(200 + Math.random() * 112, 140 + Math.random() * 45, 1.5, 1.5); }
  if (o.mask) { // chusta na twarzy
    hx.fillStyle = o.maskCol; hx.beginPath(); hx.moveTo(120, 132); hx.lineTo(392, 132); hx.lineTo(392, 200); hx.lineTo(256, 215); hx.lineTo(120, 200); hx.fill();
    hx.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 40; i++) { hx.beginPath(); hx.arc(130 + Math.random() * 250, 140 + Math.random() * 60, 2.5, 0, TAU); hx.fill(); }
  }
  // but
  const sx = Sh.x; sx.fillStyle = o.shoeCol; sx.fillRect(0, 0, 256, 128);
  sx.fillStyle = o.shoe === 'boot' ? '#0d0c0b' : '#f2f2f2'; sx.fillRect((0.25 - 0.14) * 256, 0, 0.28 * 256, 128);
  sx.strokeStyle = o.shoe === 'boot' ? '#555' : '#fff'; sx.lineWidth = 2;
  for (let v = 20; v < 80; v += 9) { sx.beginPath(); sx.moveTo(0.7 * 256, v); sx.lineTo(0.8 * 256, v + 4); sx.stroke(); }
  noise(sx, 256, 128, 500, 0.05);
  return { T, A, G, Hd, Sh };
}
const outfitCache = new Map();
function outfitMats(o) {
  const key = JSON.stringify(o); if (outfitCache.has(key)) return outfitCache.get(key);
  const c = outfitCanvases(o);
  const bump = (() => { const b = C(128, 128); b.x.fillStyle = '#808080'; b.x.fillRect(0, 0, 128, 128); noise(b.x, 128, 128, 3000, 0.25); const t = tex(b, true); t.repeat.set(4, 4); return t; })();
  const mat = (cv2, rough = 0.85) => new THREE.MeshStandardMaterial({ map: tex(cv2), bumpMap: bump, bumpScale: 0.006, roughness: rough });
  const M = {
    torso: mat(c.T, o.top === 'leather' ? 0.45 : 0.85), arm: mat(c.A, o.top === 'leather' ? 0.5 : 0.8), leg: mat(c.G), head: new THREE.MeshStandardMaterial({ map: tex(c.Hd), roughness: 0.7 }),
    hand: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }), foot: mat(c.Sh, 0.6),
    skin: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: o.hairCol, roughness: 0.9 }),
    hat: new THREE.MeshStandardMaterial({ color: o.hatCol || '#222', roughness: 0.9 }),
    top: new THREE.MeshStandardMaterial({ color: o.topCol, roughness: 0.85 }),
  };
  outfitCache.set(key, M); return M;
}

// ---------------------------------------------------------------- skladanie postaci
function build(kind, M, opt = {}) {
  const b = BODY[kind], H = makeRig(b);
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

export function buildSpider(s) {
  const M = suitMats(s), H = build('spider', M, { thwip: true, shoe: 'spider' });
  for (const side of [1, -1]) {
    const rim = new THREE.Mesh(toGeo(lensData(H.b, side, 1.22, 0.004)), M.rim);
    const lens = new THREE.Mesh(toGeo(lensData(H.b, side, 1, 0.007)), M.eye);
    H.neck.add(rim, lens);
  }
  // wyrzutnie sieci na nadgarstkach
  for (const L of ['L', 'R']) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.028, 16), new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.8, roughness: 0.3 }));
    w.position.y = -0.24; H['el' + L].add(w);
  }
  return H;
}
function addHat(H, o, M) {
  const hs = H.b.head, hc = new V3(0, HC, 0.012);
  if (o.hair === 'short' && o.hat === 'none') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.2), M.hair);
    h.scale.set(0.103 * hs, 0.128 * hs, 0.114 * hs); h.position.copy(hc); h.rotation.x = -0.35; H.neck.add(h);
  }
  if (o.hat === 'beanie') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.45), M.hat);
    h.scale.set(0.108 * hs, 0.14 * hs, 0.118 * hs); h.position.copy(hc); h.rotation.x = -0.2; h.castShadow = true; H.neck.add(h);
    const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 28), M.hat);
    r.scale.set(0.104 * hs, 0.114 * hs, 1); r.rotation.x = Math.PI / 2 - 0.2; r.position.set(0, HC + 0.025, 0.005); r.scale.z = 0.11; H.neck.add(r);
  } else if (o.hat === 'cap') {
    const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.35), M.hat);
    h.scale.set(0.106 * hs, 0.125 * hs, 0.116 * hs); h.position.copy(hc); h.rotation.x = -0.15; h.castShadow = true; H.neck.add(h);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.008, 24, 1, false, -Math.PI / 2, Math.PI), M.hat);
    brim.position.set(0, HC + 0.06, 0.07); brim.scale.set(0.95, 1, 1.25); brim.rotation.x = 0.12; H.neck.add(brim);
  }
  if (o.top === 'hoodie') { // kaptur zsuniety na plecy: polkole za szyja
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 10, 24, Math.PI), M.top);
    hood.rotation.x = -Math.PI / 2 + 0.35; hood.position.set(0, 0.27, -0.01); hood.scale.set(1.1, 1.15, 0.8); hood.castShadow = true; H.chest.add(hood);
  }
  for (const s of [1, -1]) { // uszy
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.skin); e.scale.set(0.014, 0.03, 0.02); e.position.set(0.097 * hs * s, HC, 0.0); H.neck.add(e);
  }
}
export function buildThug(kind = 'thug', outfit) {
  const o = outfit || randomOutfit(kind), M = outfitMats(o);
  const H = build(kind, M, { face: true, shoe: o.shoe });
  addHat(H, o, M); H.outfit = o;
  return H;
}
export function buildBoss() {
  const plate = () => {
    const m = C(512, 512), b = C(512, 512);
    m.x.fillStyle = '#6d7076'; m.x.fillRect(0, 0, 512, 512); b.x.fillStyle = '#808080'; b.x.fillRect(0, 0, 512, 512);
    for (let y = 20; y < 512; y += 44) { m.x.fillStyle = '#44474c'; m.x.fillRect(0, y, 512, 5); b.x.fillStyle = '#404040'; b.x.fillRect(0, y, 512, 5); }
    for (let y = 30; y < 512; y += 44) for (let x = 16; x < 512; x += 64) { m.x.fillStyle = '#9da1a8'; m.x.beginPath(); m.x.arc(x, y, 3, 0, TAU); m.x.fill(); b.x.fillStyle = '#e0e0e0'; b.x.beginPath(); b.x.arc(x, y, 3, 0, TAU); b.x.fill(); }
    noise(m.x, 512, 512, 6000, 0.06);
    return new THREE.MeshStandardMaterial({ map: tex(m), bumpMap: tex(b), bumpScale: 0.05, metalness: 0.55, roughness: 0.45 });
  };
  const armor = plate();
  const face = C(512, 256); face.x.fillStyle = '#5c5f65'; face.x.fillRect(0, 0, 512, 256);
  face.x.fillStyle = '#a07a60'; face.x.fillRect(196, 100, 120, 70);
  face.x.fillStyle = '#ff3b1f'; ell(face.x, 230, 121, 9, 4); ell(face.x, 282, 121, 9, 4);
  face.x.strokeStyle = '#3a1a14'; face.x.lineWidth = 3; face.x.beginPath(); face.x.moveTo(240, 155); face.x.lineTo(272, 155); face.x.stroke();
  const M = {
    torso: armor, arm: armor, leg: armor, head: new THREE.MeshStandardMaterial({ map: tex(face), metalness: 0.4, roughness: 0.5 }),
    hand: new THREE.MeshStandardMaterial({ color: 0x3b3d42, roughness: 0.6, metalness: 0.4 }), foot: new THREE.MeshStandardMaterial({ color: 0x2e3034, roughness: 0.6, metalness: 0.4 }),
  };
  const H = build('boss', M, { face: true, shoe: 'boot' });
  const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 16), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.5 }));
  horn.position.set(0, HC + 0.05, 0.13); horn.rotation.x = 0.9; H.neck.add(horn);
  const helm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.5), armor);
  helm.scale.set(0.112, 0.14, 0.124); helm.position.set(0, HC, 0.0); helm.rotation.x = -0.25; H.neck.add(helm);
  for (const s of [1, -1]) {
    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, 1.6), armor);
    pad.scale.set(0.12, 0.09, 0.12); pad.position.set(0.02 * s, 0.03, 0); pad.rotation.z = -0.3 * s; H['sh' + (s > 0 ? 'L' : 'R')].add(pad);
  }
  return H;
}

// ---------------------------------------------------------------- przechodnie (lekkie, "upieczone" ksztalty)
// Z tego samego generatora co bandyci, ale w niskiej rozdzielczosci i od razu w pozie kroku.
// Zwraca dla dwoch klatek chodu trzy czesci: gora (bluza), dol (spodnie+buty), skora (glowa, dlonie).
export function pedGeometries() {
  const b = BODY.thug, frames = [];
  for (const ph of [0.9, 0.9 + Math.PI]) {
    const H = makeRig(b); H.root.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(H.bones);
    const s = Math.sin(ph), c = Math.cos(ph);
    H.hipL.rotation.x = -s * 0.42; H.hipR.rotation.x = s * 0.42;
    H.knL.rotation.x = 0.15 + Math.max(0, c) * 0.6; H.knR.rotation.x = 0.15 + Math.max(0, -c) * 0.6;
    H.shL.rotation.set(s * 0.35, 0, 0.1); H.shR.rotation.set(-s * 0.35, 0, -0.1); H.elL.rotation.x = -0.35; H.elR.rotation.x = -0.35;
    H.root.updateMatrixWorld(true);
    const M = H.bones.map((bn, i) => new THREE.Matrix4().multiplyMatrices(bn.matrixWorld, skel.boneInverses[i]));
    const skin = d => { // przeliczenie wierzcholkow jak w SkinnedMesh, tylko na procesorze
      const p = d.pos.slice(), v = new V3(), acc = new V3(), t = new V3();
      for (let i = 0; i < p.length / 3; i++) {
        v.set(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]); acc.set(0, 0, 0);
        for (let j = 0; j < 4; j++) { const w = d.sw[i * 4 + j]; if (w) acc.addScaledVector(t.copy(v).applyMatrix4(M[d.sk[i * 4 + j]]), w); }
        p[i * 3] = acc.x; p[i * 3 + 1] = acc.y; p[i * 3 + 2] = acc.z;
      }
      return { ...d, pos: p, sk: [], sw: [] };
    };
    const rigid = (d, obj) => { const p = d.pos.slice(), v = new V3(); obj.updateMatrixWorld(true);
      for (let i = 0; i < p.length; i += 3) { v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(obj.matrixWorld); p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z; }
      return { ...d, pos: p }; };
    const torso = skin(tubeData(smooth(torsoRings(b), 1), 9, () => 0, wTorso));
    // rozdzielenie tulowia na gore i spodnie wedlug wysokosci w pozie spoczynkowej
    const top = { pos: torso.pos, uv: torso.uv, idx: [], sk: [], sw: [], seams: [] }, bot = { ...top, idx: [] };
    const rest = tubeData(smooth(torsoRings(b), 1), 9, () => 0, null).pos;
    for (let i = 0; i < torso.idx.length; i += 3) {
      const a = torso.idx[i], bb = torso.idx[i + 1], cc = torso.idx[i + 2];
      const y = (rest[a * 3 + 1] + rest[bb * 3 + 1] + rest[cc * 3 + 1]) / 3;
      (y > 0.98 ? top : bot).idx.push(a, bb, cc);
    }
    const arm = tubeData(smooth(armRings(b), 1), 6, () => 0, wArm);
    const leg = tubeData(smooth(legRings(b), 1), 6, () => 0, wLeg);
    const handL = rigid(tubeData(smooth([{ y: -0.06, rx: 0.01, rz: 0.01 }, { y: -0.03, rx: 0.02, rz: 0.04 }, { y: 0.03, rx: 0.02, rz: 0.038 }, { y: 0.05, rx: 0.01, rz: 0.01 }], 1), 8, () => 0, null), H.handL);
    const handR = rigid(tubeData(smooth([{ y: -0.06, rx: 0.01, rz: 0.01 }, { y: -0.03, rx: 0.02, rz: 0.04 }, { y: 0.03, rx: 0.02, rz: 0.038 }, { y: 0.05, rx: 0.01, rz: 0.01 }], 1), 8, () => 0, null), H.handR);
    const shoeL = rigid(shoeData('spider', 1.05), H.ftL), shoeR = rigid(shoeData('spider', 1.05), H.ftR);
    const head = rigid(headData(b, true, 16, 11), H.neck);
    frames.push({
      top: toGeo(merge([top, skin(arm), skin(mirror(arm))])),
      bot: toGeo(merge([bot, skin(leg), skin(mirror(leg)), shoeL, shoeR])),
      hand: toGeo(merge([handL, handR])),
      head: toGeo(head),
    });
  }
  return frames;
}

// ---------------------------------------------------------------- Kingpin (Wilson Fisk): jasny garnitur, krawat, laska
export function buildKingpin() {
  const o = { kind: 'brute', top: 'tshirt', topCol: '#ece6d8', pants: '#ece6d8', skin: '#dcae8c', hair: 'bald', hairCol: '#111', hat: 'none', mask: false, shoe: 'boot', shoeCol: '#0d0d0d' };
  const base = outfitCanvases(o), cream = '#ebe5d6';
  const T = C(512, 512), A = C(256, 512), G = C(256, 512), tx = T.x;
  tx.fillStyle = cream; tx.fillRect(0, 0, 512, 512);
  tx.fillStyle = o.skin; tx.fillRect(0, 0, 512, TY(1.555));
  for (const cx of [256]) { // koszula, klapy, krawat, guziki
    tx.fillStyle = '#fbfaf5'; tx.beginPath(); tx.moveTo(cx - 34, TY(1.545)); tx.lineTo(cx + 34, TY(1.545)); tx.lineTo(cx + 8, TY(1.1)); tx.lineTo(cx - 8, TY(1.1)); tx.fill();
    tx.strokeStyle = 'rgba(60,55,45,.55)'; tx.lineWidth = 3;
    for (const sg of [-1, 1]) { tx.beginPath(); tx.moveTo(cx + sg * 36, TY(1.545)); tx.lineTo(cx + sg * 16, TY(1.3)); tx.lineTo(cx + sg * 30, TY(1.22)); tx.lineTo(cx + sg * 9, TY(1.02)); tx.stroke(); }
    tx.fillStyle = '#161616'; tx.beginPath(); tx.moveTo(cx - 6, TY(1.52)); tx.lineTo(cx + 6, TY(1.52)); tx.lineTo(cx + 10, TY(1.16)); tx.lineTo(cx, TY(1.1)); tx.lineTo(cx - 10, TY(1.16)); tx.fill();
    tx.fillStyle = '#8b7a4a'; for (const y of [1.06, 0.99]) { tx.beginPath(); tx.arc(cx + 22, TY(y), 3.2, 0, 7); tx.fill(); }
  }
  tx.fillStyle = 'rgba(0,0,0,.18)'; tx.fillRect(0, TY(0.975), 512, 4);
  for (const cx of [128, 384]) { tx.fillStyle = 'rgba(80,70,55,.18)'; tx.fillRect(cx - 1, TY(0.97), 3, 512); }
  noise(tx, 512, 512, 5000, 0.04);
  A.x.fillStyle = cream; A.x.fillRect(0, 0, 256, 512); A.x.fillStyle = '#fbfaf5'; A.x.fillRect(0, AY(-0.5), 256, 512 - AY(-0.5)); noise(A.x, 256, 512, 1500, 0.04);
  G.x.fillStyle = cream; G.x.fillRect(0, 0, 256, 512); G.x.fillStyle = 'rgba(80,70,55,.22)'; G.x.fillRect(63, 0, 3, 512); G.x.fillRect(191, 0, 3, 512); noise(G.x, 256, 512, 2500, 0.04);
  const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ map: tex(c), roughness: r });
  const M = { torso: mat(T), arm: mat(A), leg: mat(G), head: new THREE.MeshStandardMaterial({ map: tex(base.Hd), roughness: 0.65 }), hand: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }), foot: mat(base.Sh, 0.5) };
  const H = build('fisk', M, { face: true, shoe: 'boot' });
  H.setHands('open', 'fist');
  // laska: czarny trzon i srebrna galka
  const cane = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 1.05, 10), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.35, metalness: 0.3 }));
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 0xc9c9cf, roughness: 0.25, metalness: 0.9 }));
  knob.position.y = 0.55; shaft.position.y = 0.05; cane.add(shaft, knob); cane.rotation.x = Math.PI; cane.position.set(0, -0.3, 0.02);
  cane.traverse(o2 => { if (o2.isMesh) o2.castShadow = true; }); H.elR.add(cane); H.cane = cane;
  return H;
}

// tekstura twarzy przechodniow: jasna skora + rysy; kolor skory dochodzi z koloru instancji (mnozenie)
export function pedFaceTexture() {
  const c = outfitCanvases({ kind: 'thug', top: 'tshirt', topCol: '#fff', pants: '#fff', skin: '#f6e9de', hair: 'short', hairCol: '#5a5a5a', hat: 'none', mask: false, shoe: 'sneaker', shoeCol: '#fff' });
  return tex(c.Hd);
}
