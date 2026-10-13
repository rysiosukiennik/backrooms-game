// Modele bossow: Nosorozec (Rhino) i Kingpin (Wilson Fisk).
// Ta sama "skora" na szkielecie co reszta postaci (build z model.js) + wlasne, bogate tekstury
// rysowane na canvasie (kolor, mapa normalnych z mapy wysokosci, szorstkosc/metalicznosc) i drobna
// geometria pancerza / garnituru doklejana do kosci (scalona w jedna siatke na kosc).
import { V3, cv, clamp } from './util.js';
import { build, C, noise, ell, tex, drawFace, toGeo, merge, headData, normalFromHeight, BODY, TY, AY, LY, HC } from './model.js';

const TAU = Math.PI * 2;
const rr = (a, b) => a + Math.random() * (b - a);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lin = t => { t.encoding = THREE.LinearEncoding; return t; };
const rgb = (c, k = 1, a = 1) => `rgba(${Math.min(255, c[0] * k | 0)},${Math.min(255, c[1] * k | 0)},${Math.min(255, c[2] * k | 0)},${a})`;
// canvas w jednostkach logicznych (s = mnoznik rozdzielczosci)
function cvs(w, h, s = 2) { const c = cv(w * s, h * s), x = c.getContext('2d'); x.scale(s, s); return { c, x, w, h }; }
const radial = (x, cx, cy, r, c0, c1 = 'rgba(0,0,0,0)') => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); };
const clipRect = (xs, x, y, w, h) => { for (const X of xs) { X.save(); X.beginPath(); X.rect(x, y, w, h); X.clip(); } };
const unclip = xs => { for (const X of xs) X.restore(); };

// ---------------------------------------------------------------- geometria: drobne elementy doklejane do kosci
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();
function put(geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  _e.set(r[0], r[1], r[2], 'XYZ'); _q.setFromEuler(_e); _p.set(p[0], p[1], p[2]); _s.set(s[0], s[1], s[2]);
  return geo.clone().applyMatrix4(_m.compose(_p, _q, _s));
}
function joinGeo(list) { // scala geometrie indeksowane (pozycja, normalna, uv)
  const pos = [], nor = [], uv = [], idx = []; let off = 0;
  for (const g of list) {
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); uv.push(U.getX(i), U.getY(i)); }
    const I = g.index; for (let i = 0; i < I.count; i++) idx.push(I.getX(i) + off);
    off += P.count;
  }
  const o = new THREE.BufferGeometry();
  o.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); o.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  o.setIndex(idx); return o;
}
function attach(bone, list, mat) { const m = new THREE.Mesh(joinGeo(list), mat); m.castShadow = true; m.receiveShadow = true; bone.add(m); return m; }
const SPH = (w = 24, h = 14, ph = 0, pl = TAU, th = 0, tl = Math.PI) => new THREE.SphereGeometry(1, w, h, ph, pl, th, tl);
const RING = (rt, rb, h, seg = 28) => { const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, 0.67 + 0.32 * uv.getY(i)); return g; }; // jedna plyta na pierscien
const BOX = (a, b, c) => new THREE.BoxGeometry(a, b, c);
const CONE = (r, h, seg = 12) => new THREE.ConeGeometry(r, h, seg);

// ================================================================ pancerz: malarz stali
// Trzy plotna naraz: kolor (col), wysokosc (hgt -> mapa normalnych), szorstkosc+metal (orm: G = szorstkosc, B = metalicznosc).
function newSteel(w, h) {
  const S = { w, h, col: cvs(w, h), hgt: cvs(w, h), orm: cvs(w, h) };
  S.col.x.fillStyle = '#18191c'; S.col.x.fillRect(0, 0, w, h); noise(S.col.x, w, h, w * h / 6, 0.12);
  S.hgt.x.fillStyle = '#3a3a3a'; S.hgt.x.fillRect(0, 0, w, h);
  S.orm.x.fillStyle = 'rgb(0,178,115)'; S.orm.x.fillRect(0, 0, w, h);
  return S;
}
// jedna plyta pancerza: szczotkowana stal z fazowana krawedzia, nitami, wgnieceniami, rdza, rysami, zaciekami
function panel(S, x, y, w, h, o = {}) {
  const { col, hgt, orm } = S, xs = [col.x, hgt.x, orm.x], B = o.base || [112, 116, 124], tone = rr(0.8, 1.1), A = w * h;
  const gr = col.x.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, rgb(B, tone * 1.08)); gr.addColorStop(0.16, rgb(B, tone * 0.95)); gr.addColorStop(0.72, rgb(B, tone * 0.6)); gr.addColorStop(1, rgb(B, tone * 0.3));
  col.x.fillStyle = gr; col.x.fillRect(x, y, w, h);
  hgt.x.fillStyle = '#a2a2a2'; hgt.x.fillRect(x, y, w, h);
  orm.x.fillStyle = `rgb(0,${rr(80, 125) | 0},${rr(205, 238) | 0})`; orm.x.fillRect(x, y, w, h);
  clipRect(xs, x, y, w, h);
  // szczotkowanie (poziome smugi)
  for (let i = 0; i < A / 38; i++) {
    const px = rr(x - 20, x + w), py = rr(y, y + h), l = rr(14, 90);
    col.x.strokeStyle = Math.random() < 0.5 ? `rgba(255,255,255,${rr(0.02, 0.08)})` : `rgba(0,0,0,${rr(0.03, 0.09)})`;
    col.x.lineWidth = rr(0.4, 1); col.x.beginPath(); col.x.moveTo(px, py); col.x.lineTo(px + l, py + rr(-0.5, 0.5)); col.x.stroke();
    if (i % 3 === 0) { hgt.x.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},.08)`; hgt.x.lineWidth = 0.6; hgt.x.beginPath(); hgt.x.moveTo(px, py); hgt.x.lineTo(px + l, py); hgt.x.stroke(); }
  }
  // wgniecenia i slady uderzen
  const nd = (A / 4200) * (o.dents ?? 1);
  for (let i = 0; i < nd; i++) {
    const cx = rr(x + 6, x + w - 6), cy = rr(y + 6, y + h - 6), r = rr(4, 13);
    radial(col.x, cx, cy, r, 'rgba(0,0,0,.34)'); radial(col.x, cx - r * 0.25, cy - r * 0.25, r * 0.6, 'rgba(255,255,255,.1)');
    col.x.strokeStyle = 'rgba(255,255,255,.22)'; col.x.lineWidth = 1; col.x.beginPath(); col.x.arc(cx, cy, r * 0.8, Math.PI * 1.05, Math.PI * 1.7); col.x.stroke();
    radial(hgt.x, cx, cy, r, 'rgba(0,0,0,.6)'); radial(orm.x, cx, cy, r * 0.8, 'rgba(0,70,225,.5)');
  }
  // przypalenia (ciemne owalne slady po wybuchach)
  if (Math.random() < (o.scorch ?? 0.34)) {
    const cx = rr(x + w * 0.2, x + w * 0.8), cy = rr(y + h * 0.2, y + h * 0.8), r = rr(10, 22);
    col.x.save(); col.x.translate(cx, cy); col.x.scale(1, rr(0.5, 0.9)); radial(col.x, 0, 0, r, 'rgba(10,8,6,.55)'); col.x.restore();
    radial(orm.x, cx, cy, r, 'rgba(0,255,60,.5)');
  }
  // rdza: u dolu i przy krawedziach, szorstka i mniej metaliczna
  const rust = o.rust ?? 0.9;
  for (let i = 0; i < w / 15 * rust + 1; i++) {
    const cx = rr(x, x + w), cy = Math.random() < 0.7 ? y + h - rr(0, 9) : rr(y, y + h), r = rr(5, 17);
    radial(col.x, cx, cy, r, `rgba(${rr(110, 150) | 0},${rr(55, 80) | 0},${rr(22, 36) | 0},${rr(0.2, 0.45)})`);
    radial(orm.x, cx, cy, r, 'rgba(0,255,35,.6)'); radial(hgt.x, cx, cy, r, 'rgba(0,0,0,.12)');
  }
  // zacieki brudu spod nitow
  for (let i = 0; i < w / 40; i++) {
    const sx = rr(x + 4, x + w - 4); const g = col.x.createLinearGradient(0, y, 0, y + rr(14, 46));
    g.addColorStop(0, 'rgba(25,16,10,.28)'); g.addColorStop(1, 'rgba(25,16,10,0)'); col.x.fillStyle = g; col.x.fillRect(sx, y, rr(1.5, 3.5), 46);
  }
  // rysy i zadrapania
  for (let i = 0; i < A / 600; i++) {
    const px = rr(x, x + w), py = rr(y, y + h), a = rr(-0.5, 0.5) + (Math.random() < 0.3 ? 1.2 : 0), l = rr(5, 34), ex = px + Math.cos(a) * l, ey = py + Math.sin(a) * l;
    col.x.strokeStyle = `rgba(232,236,240,${rr(0.15, 0.5)})`; col.x.lineWidth = rr(0.5, 1.1); col.x.beginPath(); col.x.moveTo(px, py); col.x.lineTo(ex, ey); col.x.stroke();
    hgt.x.strokeStyle = 'rgba(0,0,0,.45)'; hgt.x.lineWidth = 0.8; hgt.x.beginPath(); hgt.x.moveTo(px, py); hgt.x.lineTo(ex, ey); hgt.x.stroke();
    orm.x.strokeStyle = 'rgba(0,60,240,.55)'; orm.x.lineWidth = 1; orm.x.beginPath(); orm.x.moveTo(px, py); orm.x.lineTo(ex, ey); orm.x.stroke();
  }
  unclip(xs);
  // fazowana krawedz
  hgt.x.strokeStyle = '#dcdcdc'; hgt.x.lineWidth = 2.6; hgt.x.strokeRect(x + 1.3, y + 1.3, w - 2.6, h - 2.6);
  hgt.x.strokeStyle = '#7a7a7a'; hgt.x.lineWidth = 1; hgt.x.strokeRect(x + 3.4, y + 3.4, w - 6.8, h - 6.8);
  col.x.fillStyle = 'rgba(255,255,255,.42)'; col.x.fillRect(x, y, w, 1.4);
  col.x.fillStyle = 'rgba(0,0,0,.5)'; col.x.fillRect(x, y + h - 3, w, 3);
  col.x.fillStyle = 'rgba(0,0,0,.25)'; col.x.fillRect(x, y, 1.2, h); col.x.fillRect(x + w - 1.2, y, 1.2, h);
  col.x.strokeStyle = 'rgba(205,210,216,.3)'; col.x.lineWidth = 0.8; col.x.strokeRect(x + 0.9, y + 0.9, w - 1.8, h - 1.8); // starcie krawedzi do gola
  orm.x.strokeStyle = 'rgba(0,55,245,.55)'; orm.x.lineWidth = 1.6; orm.x.strokeRect(x + 1, y + 1, w - 2, h - 2);
  // nity
  if (o.rivets !== false && w > 24) {
    const rows = h > 38 ? [y + 6, y + h - 7] : [y + h / 2];
    for (const ry of rows) for (let rx = x + 8 + rr(0, 6); rx < x + w - 6; rx += rr(20, 28)) {
      col.x.fillStyle = 'rgba(0,0,0,.5)'; col.x.beginPath(); col.x.arc(rx + 0.8, ry + 1, 3, 0, TAU); col.x.fill();
      const g = col.x.createRadialGradient(rx - 0.8, ry - 0.8, 0.2, rx, ry, 2.8); g.addColorStop(0, 'rgb(236,238,242)'); g.addColorStop(1, 'rgb(112,116,122)');
      col.x.fillStyle = g; col.x.beginPath(); col.x.arc(rx, ry, 2.6, 0, TAU); col.x.fill();
      hgt.x.fillStyle = '#fff'; hgt.x.beginPath(); hgt.x.arc(rx, ry, 2.7, 0, TAU); hgt.x.fill();
      hgt.x.strokeStyle = '#303030'; hgt.x.lineWidth = 0.8; hgt.x.beginPath(); hgt.x.arc(rx, ry, 3.6, 0, TAU); hgt.x.stroke();
    }
  }
}
// rzad plyt miedzy y0..y1, kolumny wg listy granic x
function band(S, y0, y1, cols, o = {}, m = 1.6) {
  for (let i = 0; i < cols.length - 1; i++) { const x0 = cols[i], x1 = cols[i + 1]; if (x1 - x0 > 8) panel(S, x0 + m, y0 + m, x1 - x0 - 2 * m, y1 - y0 - 2 * m, o); }
}
// pas z paskiem skorzanym
function leather(S, x, y, w, h) {
  const { col, hgt, orm } = S;
  col.x.fillStyle = '#1c1612'; col.x.fillRect(x, y, w, h); noise(col.x, w, h, w * h / 4, 0.2);
  const g = col.x.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(255,230,200,.12)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); col.x.fillStyle = g; col.x.fillRect(x, y, w, h);
  hgt.x.fillStyle = '#8e8e8e'; hgt.x.fillRect(x, y, w, h); orm.x.fillStyle = 'rgb(0,150,40)'; orm.x.fillRect(x, y, w, h);
  col.x.strokeStyle = 'rgba(190,160,110,.5)'; col.x.setLineDash([3, 3]); col.x.lineWidth = 0.8;
  for (const yy of [y + 2.5, y + h - 2.5]) { col.x.beginPath(); col.x.moveTo(x, yy); col.x.lineTo(x + w, yy); col.x.stroke(); }
  col.x.setLineDash([]);
  for (let sx = x + 10; sx < x + w; sx += 24) { // nity-ćwieki
    col.x.fillStyle = '#9a9ea4'; col.x.beginPath(); col.x.arc(sx, y + h / 2, 2.4, 0, TAU); col.x.fill(); hgt.x.fillStyle = '#fff'; hgt.x.beginPath(); hgt.x.arc(sx, y + h / 2, 2.4, 0, TAU); hgt.x.fill();
  }
}
function grime(S, n = 70) {
  const { col, orm, w, h } = S;
  for (let i = 0; i < n; i++) { const X = rr(0, w), Y = rr(0, h), r = rr(14, 48); radial(col.x, X, Y, r, `rgba(14,10,6,${rr(0.1, 0.3)})`); radial(orm.x, X, Y, r, 'rgba(0,255,70,.3)'); }
  for (let i = 0; i < n / 2; i++) { const X = rr(0, w), Y = rr(0, h * 0.8), g = col.x.createLinearGradient(0, Y, 0, Y + rr(30, 120)); g.addColorStop(0, 'rgba(18,12,8,.26)'); g.addColorStop(1, 'rgba(18,12,8,0)'); col.x.fillStyle = g; col.x.fillRect(X, Y, rr(2, 7), 120); }
}
function steelMat(S, nk = 3.6, extra = {}) {
  const m = new THREE.MeshStandardMaterial({
    map: tex(S.col), normalMap: lin(tex(normalFromHeight(S.hgt.c, nk))), roughnessMap: lin(tex(S.orm)), metalnessMap: lin(tex(S.orm)),
    roughness: 1, metalness: 1, ...extra,
  });
  m.envMapIntensity = 1.5; m.userData.env = 1.5; return m;
}

// ---------------------------------------------------------------- Nosorozec: materialy (raz na gre)
let RHM = null;
function rhinoMats() {
  if (RHM) return RHM;
  // tulow (512 x 512 logicznych; wysokosc wg TY)
  const tor = newSteel(512, 512);
  band(tor, TY(1.545), TY(1.4), [0, 92, 178, 256, 334, 420, 512]);
  band(tor, TY(1.4), TY(1.26), [0, 50, 134, 206, 256, 306, 378, 462, 512]);
  panel(tor, 246, TY(1.43), 20, TY(1.24) - TY(1.43), { rivets: false, dents: 0.4 }); // mostek (listwa srodkowa)
  for (let i = 0; i < 4; i++) band(tor, TY(1.26 - 0.055 * i), TY(1.205 - 0.055 * i), i % 2 ? [0, 64, 160, 352, 448, 512] : [0, 110, 256, 402, 512], { dents: 0.7 });
  leather(tor, 0, TY(1.0), 512, TY(0.945) - TY(1.0));
  band(tor, TY(0.945), TY(0.865), [0, 70, 150, 230, 282, 362, 442, 512]);
  band(tor, TY(0.865), TY(0.79), [0, 40, 120, 200, 256, 312, 392, 472, 512]);
  // ramie / ramie-lokiec (256 x 512; wysokosc wg AY)
  const arm = newSteel(256, 512);
  band(arm, AY(-0.015), AY(-0.1), [0, 32, 96, 160, 224, 256]); band(arm, AY(-0.1), AY(-0.19), [0, 64, 128, 192, 256]); band(arm, AY(-0.19), AY(-0.28), [0, 32, 96, 160, 224, 256]);
  leather(arm, 0, AY(-0.305), 256, AY(-0.28) - AY(-0.305) + 4);
  band(arm, AY(-0.31), AY(-0.4), [0, 64, 128, 192, 256]); band(arm, AY(-0.4), AY(-0.49), [0, 32, 96, 160, 224, 256]); band(arm, AY(-0.49), AY(-0.56), [0, 80, 176, 256]);
  // noga (256 x 512; wysokosc wg LY)
  const leg = newSteel(256, 512);
  for (let i = 0; i < 5; i++) band(leg, LY(0.1 - 0.1 * i), LY(0.0 - 0.1 * i), i % 2 ? [0, 64, 128, 192, 256] : [0, 32, 96, 160, 224, 256]);
  leather(leg, 0, LY(-0.39), 256, LY(-0.44) - LY(-0.39));
  for (let i = 0; i < 4; i++) band(leg, LY(-0.44 - 0.1 * i), LY(-0.54 - 0.1 * i), i % 2 ? [0, 64, 128, 192, 256] : [0, 32, 96, 160, 224, 256]);
  band(leg, LY(-0.84), LY(-0.87), [0, 256]);
  // plyty doklejane (pauldrony, nagolenniki, helm): kafelek z 3 rzedow
  const plate = newSteel(256, 256);
  band(plate, 0, 90, [0, 128, 256], { dents: 1.4, scorch: 0.5 }); band(plate, 90, 175, [0, 64, 192, 256], { dents: 1.4 }); band(plate, 175, 256, [0, 100, 256], { dents: 1.4 });
  for (const S of [tor, arm, leg, plate]) grime(S, S === plate ? 40 : 80);
  // glowa 512 x 256 logicznych: maska z oczami-szczelinami, kratka ust, nity
  const hd = newSteel(512, 256), hx = hd.col.x;
  panel(hd, 0, 0, 512, 256, { rivets: false, dents: 1.6, scorch: 0.8 });
  const emi = cvs(512, 256); emi.x.fillStyle = '#000'; emi.x.fillRect(0, 0, 512, 256);
  // linie podzialu helmu
  for (const X of [150, 362]) { hx.fillStyle = 'rgba(0,0,0,.55)'; hx.fillRect(X, 0, 3, 256); hd.hgt.x.fillStyle = '#202020'; hd.hgt.x.fillRect(X, 0, 3, 256); }
  hx.fillStyle = 'rgba(0,0,0,.5)'; hx.fillRect(0, 86, 512, 3); hd.hgt.x.fillStyle = '#202020'; hd.hgt.x.fillRect(0, 86, 512, 3);
  // przylbica: ciemna szczelina na oczy
  const slit = (cx, s, X) => { X.beginPath(); X.moveTo(cx - s * 24, 119); X.lineTo(cx + s * 6, 124); X.lineTo(cx + s * 6, 131); X.lineTo(cx - s * 22, 128); X.closePath(); };
  hx.fillStyle = '#050403'; for (const [cx, s] of [[226, 1], [286, -1]]) { slit(cx, s, hx); hx.fill(); }
  for (const [cx, s] of [[226, 1], [286, -1]]) {
    slit(cx, s, hd.hgt.x); hd.hgt.x.fillStyle = '#000'; hd.hgt.x.fill();
    emi.x.save(); emi.x.shadowColor = '#ff2a00'; emi.x.shadowBlur = 9; emi.x.fillStyle = '#ff5a22'; slit(cx, s, emi.x); emi.x.fill(); emi.x.restore();
    emi.x.fillStyle = '#ffd9a0'; emi.x.beginPath(); emi.x.moveTo(cx - s * 18, 124); emi.x.lineTo(cx + s * 3, 126.5); emi.x.lineTo(cx - s * 16, 126.6); emi.x.fill();
  }
  // grzbiet nosa i kratka ust
  hx.fillStyle = 'rgba(255,255,255,.18)'; hx.fillRect(250, 96, 12, 52); hd.hgt.x.fillStyle = '#e0e0e0'; hd.hgt.x.fillRect(250, 96, 12, 52);
  hx.fillStyle = '#080808'; hd.hgt.x.fillStyle = '#000';
  for (let k = 0; k < 8; k++) { const X = 230 + k * 7.4; hx.fillRect(X, 152, 3.2, 20); hd.hgt.x.fillRect(X, 152, 3.2, 20); }
  hx.strokeStyle = 'rgba(0,0,0,.6)'; hx.lineWidth = 3; hx.strokeRect(226, 149, 62, 26);
  hd.orm.x.fillStyle = 'rgb(0,230,60)'; hd.orm.x.fillRect(226, 152, 62, 20);
  // policzki - nity
  for (const X of [190, 322]) for (const Y of [118, 140, 162]) { radial(hx, X, Y, 4, 'rgb(230,232,236)', 'rgb(90,94,100)'); hd.hgt.x.fillStyle = '#fff'; hd.hgt.x.beginPath(); hd.hgt.x.arc(X, Y, 3, 0, TAU); hd.hgt.x.fill(); }
  // roh: jasny, szczotkowany metal, pierscienie narostu
  const horn = cvs(128, 256);
  const hg = horn.x.createLinearGradient(0, 0, 0, 256); hg.addColorStop(0, '#ece9e2'); hg.addColorStop(0.55, '#c9c6c0'); hg.addColorStop(1, '#6a665f');
  horn.x.fillStyle = hg; horn.x.fillRect(0, 0, 128, 256);
  const hh = cvs(128, 256), ho = cvs(128, 256);
  hh.x.fillStyle = '#909090'; hh.x.fillRect(0, 0, 128, 256); ho.x.fillStyle = 'rgb(0,72,235)'; ho.x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 700; i++) { const X = rr(0, 128), Y = rr(0, 256), l = rr(10, 60); horn.x.strokeStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '40,36,30'},${rr(0.03, 0.12)})`; horn.x.lineWidth = rr(0.4, 1); horn.x.beginPath(); horn.x.moveTo(X, Y); horn.x.lineTo(X + rr(-1, 1), Y + l); horn.x.stroke(); }
  for (let Y = 8; Y < 256; Y += rr(14, 24)) { horn.x.fillStyle = `rgba(60,50,40,${rr(0.08, 0.2)})`; horn.x.fillRect(0, Y, 128, 1.6); hh.x.fillStyle = '#404040'; hh.x.fillRect(0, Y, 128, 1.8); hh.x.fillStyle = '#c0c0c0'; hh.x.fillRect(0, Y + 1.8, 128, 1.2); }
  for (let i = 0; i < 30; i++) { const X = rr(0, 128), Y = rr(0, 256), a = rr(0, TAU), l = rr(6, 22); horn.x.strokeStyle = 'rgba(70,64,56,.45)'; horn.x.lineWidth = 0.9; horn.x.beginPath(); horn.x.moveTo(X, Y); horn.x.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); horn.x.stroke(); }
  const bg = horn.x.createLinearGradient(0, 200, 0, 256); bg.addColorStop(0, 'rgba(30,26,22,0)'); bg.addColorStop(1, 'rgba(30,26,22,.65)'); horn.x.fillStyle = bg; horn.x.fillRect(0, 200, 128, 56);
  noise(horn.x, 128, 256, 1200, 0.1);
  const mk = (S, nk) => steelMat(S, nk);
  const dark = new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.7, metalness: 0.2 }); dark.envMapIntensity = 1.2; dark.userData.env = 1.2;
  const glove = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.75, metalness: 0.2 }); glove.envMapIntensity = 1.3; glove.userData.env = 1.3;
  const hornM = new THREE.MeshStandardMaterial({ map: tex(horn), normalMap: lin(tex(normalFromHeight(hh.c, 3))), roughnessMap: lin(tex(ho)), roughness: 1, metalness: 0.92 });
  hornM.envMapIntensity = 1.8; hornM.userData.env = 1.8;
  const head = steelMat(hd, 3.4, { emissive: 0xffffff, emissiveMap: tex(emi), emissiveIntensity: 2.4 });
  head.userData.env = 1.5;
  return (RHM = { torso: mk(tor, 3.8), arm: mk(arm, 3.8), leg: mk(leg, 3.8), plate: mk(plate, 3.6), head, horn: hornM, dark, glove });
}

export function buildBoss() {
  const R = rhinoMats();
  const body = { w: 1.5, chest: 1.32, waist: 1.3, belly: 0.06, pec: 1.1, hips: 1.32, arm: 1.7, leg: 1.36, neck: 1.25, head: 1.22 };
  const H = build('boss', { torso: R.torso, arm: R.arm, leg: R.leg, head: R.head, hand: R.glove, foot: R.dark }, { face: true, shoe: 'boot', body });
  for (const L of ['L', 'R']) for (const v in H.hands[L]) H.hands[L][v].scale.setScalar(1.2);
  const hs = body.head, PL = R.plate;
  // --- hełm: kopula, grzbiet brwiowy, policzki, kolnierz, roh
  const hc = [0, HC + 0.004, 0.01];
  attach(H.neck, [
    put(SPH(30, 16, 0, TAU, 0, 1.38), hc, [-0.18, 0, 0], [0.112 * hs, 0.14 * hs, 0.122 * hs]),
    put(SPH(20, 10), [0, HC + 0.034 * hs, 0.108 * hs], [0.42, 0, 0], [0.098 * hs, 0.02 * hs, 0.05 * hs]), // brew
    put(SPH(16, 10), [0.108 * hs, HC - 0.016, 0.03], [0, 0, 0.15], [0.02, 0.062 * hs, 0.074 * hs]),
    put(SPH(16, 10), [-0.108 * hs, HC - 0.016, 0.03], [0, 0, -0.15], [0.02, 0.062 * hs, 0.074 * hs]),
    put(SPH(20, 10), [0, HC - 0.1 * hs, 0.05], [0.25, 0, 0], [0.07 * hs, 0.032 * hs, 0.07 * hs]), // szczeka
    put(RING(0.105, 0.125, 0.07, 28), [0, 0.035, 0.004], [0, 0, 0], [1.1, 1, 1]),
    put(SPH(20, 10), [0, HC + 0.09, -0.07], [-0.5, 0, 0], [0.06 * hs, 0.05, 0.07 * hs]), // tylna plyta
  ], PL);
  // roh: wygiety, zwezajacy sie (rura wzdluz krzywej)
  const hp = [], hr = [], n = 14;
  for (let i = 0; i <= n; i++) { const t = i / n; hp.push(new V3(0, HC + 0.088 * hs + 0.17 * Math.pow(t, 1.5), 0.088 * hs + 0.16 * t + 0.02 * Math.sin(t * 2.2))); hr.push(0.056 * hs * Math.pow(1 - t, 0.8) + 0.004); }
  const hornGeo = (() => { const pos = [], uv = [], idx = [], S = 17; for (let k = 0; k < hp.length; k++) { const T = new V3().subVectors(hp[Math.min(k + 1, n)], hp[Math.max(k - 1, 0)]).normalize(), N = new V3(1, 0, 0), Bn = new V3().crossVectors(T, N).normalize(); for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU; const p = hp[k].clone().addScaledVector(N, Math.cos(a) * hr[k] * 1.05).addScaledVector(Bn, Math.sin(a) * hr[k]); pos.push(p.x, p.y, p.z); uv.push(i / 16, k / n); } } for (let k = 0; k < n; k++) for (let i = 0; i < 16; i++) { const a = k * S + i, b = a + 1, c = b + S, d = a + S; idx.push(a, b, c, a, c, d); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; })();
  const hornM = new THREE.Mesh(joinGeo([hornGeo, put(CONE(0.03 * hs, 0.1, 14), [0, HC + 0.14 * hs, -0.03 * hs], [-0.5, 0, 0])]), R.horn); hornM.castShadow = true; H.neck.add(hornM);
  // maly roh nad brwia (krotki, szeroki) — w tej samej siatce roga nie da sie, wiec jako stozek z materialem rogu
  
  const trap = [put(RING(0.115, 0.135, 0.07, 30), [0, 0.3, 0.0], [0, 0, 0], [1.1, 1, 0.95])];
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R', z = -0.3 * s;
    // barki: trzy warstwy nalozonych na siebie plyt + nity
    const sh = [
      put(SPH(26, 14), [0.03 * s, 0.045, 0], [0, 0, z], [0.185, 0.1, 0.165]),
      put(SPH(22, 12), [0.075 * s, -0.035, 0], [0, 0, z * 1.6], [0.165, 0.075, 0.15]),
      put(SPH(20, 10), [0.105 * s, -0.1, 0], [0, 0, z * 2.1], [0.14, 0.06, 0.135]),
      put(CONE(0.03, 0.09, 10), [0.04 * s, 0.135, 0], [0, 0, -0.4 * s], [1, 1, 1]), // kolec
    ];
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; sh.push(put(SPH(8, 6), [0.03 * s + Math.cos(a) * 0.12 * s, 0.06 + Math.sin(a) * 0.012, Math.sin(a) * 0.1], [0, 0, 0], [0.014, 0.014, 0.014])); }
    sh.push(put(RING(0.128, 0.124, 0.1), [0, -0.12, 0], [0, 0, 0], [1, 1, 1.02]), put(RING(0.12, 0.116, 0.09), [0, -0.215, 0], [0, 0, 0], [1, 1, 1.02])); // biceps
    attach(H['sh' + L], sh, PL);
    // przedramie: masywny karwasz + lokiec
    attach(H['el' + L], [
      put(RING(0.135, 0.15, 0.1), [0, -0.075, 0]), put(RING(0.145, 0.158, 0.1), [0, -0.165, 0]), put(RING(0.15, 0.162, 0.095), [0, -0.25, 0]),
      put(SPH(20, 12), [0, 0.0, -0.06], [0, 0, 0], [0.12, 0.11, 0.1]), put(CONE(0.03, 0.08, 10), [0, 0.0, -0.15], [-Math.PI / 2, 0, 0]),
    ], PL);
    // udo i golen
    attach(H['hip' + L], [put(RING(0.17, 0.165, 0.17), [0, -0.13, 0]), put(RING(0.16, 0.152, 0.15), [0, -0.285, 0])], PL);
    attach(H['kn' + L], [
      put(SPH(20, 12), [0, 0.0, 0.085], [0.2, 0, 0], [0.125, 0.115, 0.09]), put(CONE(0.03, 0.075, 10), [0, 0.0, 0.17], [Math.PI / 2, 0, 0]),
      put(RING(0.118, 0.11, 0.14), [0, -0.14, 0], [0, 0, 0], [1, 1, 1.08]), put(RING(0.108, 0.098, 0.13), [0, -0.255, 0], [0, 0, 0], [1, 1, 1.1]), put(RING(0.098, 0.092, 0.11), [0, -0.355, 0], [0, 0, 0], [1, 1, 1.1]),
    ], PL);
    trap.push(put(SPH(18, 10), [0.13 * s, 0.275, -0.012], [0, 0, -0.45 * s], [0.13, 0.05, 0.11])); // trapezy przy szyi
  }
  // gorget i klamra pasa
  attach(H.chest, trap, PL);
  attach(H.body, [put(BOX(0.22, 0.13, 0.05), [0, 0.0, 0.158]), put(SPH(14, 8), [0, 0.0, 0.185], [0, 0, 0], [0.06, 0.04, 0.02])], PL);
  return H;
}

// ================================================================ Kingpin
let KPM = null;
const CREAM = '#eee8d9', SKIN = '#d6a487';
// tkanina: splot (drobna kratka) w kolorze i wysokosci
function weave(c, hc, w, h) {
  const t = cv(4, 4), tx = t.getContext('2d'); tx.fillStyle = 'rgba(0,0,0,.05)'; tx.fillRect(0, 0, 2, 2); tx.fillRect(2, 2, 2, 2); tx.fillStyle = 'rgba(255,255,255,.05)'; tx.fillRect(2, 0, 2, 2); tx.fillRect(0, 2, 2, 2);
  c.save(); c.scale(0.5, 0.5); c.fillStyle = c.createPattern(t, 'repeat'); c.fillRect(0, 0, w * 2, h * 2); c.restore();
  const t2 = cv(4, 4), t2x = t2.getContext('2d'); t2x.fillStyle = '#707070'; t2x.fillRect(0, 0, 4, 4); t2x.fillStyle = '#929292'; t2x.fillRect(0, 0, 2, 2); t2x.fillRect(2, 2, 2, 2);
  hc.save(); hc.scale(0.5, 0.5); hc.fillStyle = hc.createPattern(t2, 'repeat'); hc.fillRect(0, 0, w * 2, h * 2); hc.restore();
}
function pinstripes(c, hc, x0, x1, y0, y1, step = 7) {
  for (let X = x0; X < x1; X += step) { c.fillStyle = 'rgba(88,92,108,.2)'; c.fillRect(X, y0, 1.1, y1 - y0); hc.fillStyle = 'rgba(70,70,70,.7)'; hc.fillRect(X, y0, 1, y1 - y0); }
}
// zmarszczki materialu: ciemna kreska + jasny refleks obok
function crease(c, hc, pts, a = 0.12, w = 2.5) {
  const path = X => { X.beginPath(); X.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i++) X.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); X.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); };
  c.strokeStyle = `rgba(70,60,48,${a})`; c.lineWidth = w; path(c); c.stroke();
  c.save(); c.translate(1.6, 1.6); c.strokeStyle = `rgba(255,255,255,${a * 2.2})`; c.lineWidth = w * 0.7; path(c); c.stroke(); c.restore();
  hc.strokeStyle = 'rgba(0,0,0,.55)'; hc.lineWidth = w; path(hc); hc.stroke();
  hc.save(); hc.translate(1.8, 1.8); hc.strokeStyle = 'rgba(255,255,255,.4)'; hc.lineWidth = w * 0.8; path(hc); hc.stroke(); hc.restore();
}
const poly = (X, pts) => { X.beginPath(); X.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) X.lineTo(pts[i][0], pts[i][1]); X.closePath(); };
const fabricMat = (col, hgt, nk = 3, rough = 0.78) => { const m = new THREE.MeshStandardMaterial({ map: tex(col), normalMap: lin(tex(normalFromHeight(hgt.c, nk))), roughness: rough, metalness: 0.0 }); m.envMapIntensity = 0.9; m.userData.env = 0.9; return m; };

function kingTorso() {
  const Tc = cvs(512, 512), Hc = cvs(512, 512), x = Tc.x, hx = Hc.x, Y = TY, cx = 256;
  x.fillStyle = CREAM; x.fillRect(0, 0, 512, 512); hx.fillStyle = '#808080'; hx.fillRect(0, 0, 512, 512);
  weave(x, hx, 512, 512); pinstripes(x, hx, 3, 512, Y(1.58), 512);
  // kark i szyja (skora), nad kolnierzem
  const ng = x.createLinearGradient(0, 0, 0, Y(1.572)); ng.addColorStop(0, SKIN); ng.addColorStop(1, '#b98466'); x.fillStyle = ng; x.fillRect(0, 0, 512, Y(1.572));
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, 512, Y(1.572));
  noise(x, 512, Y(1.572), 900, 0.05);
  // kolnierz marynarki i bialy kolnierzyk koszuli dookola szyi
  x.fillStyle = '#e9e3d3'; x.fillRect(0, Y(1.57), 512, Y(1.515) - Y(1.57)); pinstripes(x, hx, 3, 512, Y(1.57), Y(1.515));
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, Y(1.572), 512, 2.5); hx.fillStyle = '#e0e0e0'; hx.fillRect(0, Y(1.545), 512, 4);
  x.fillStyle = '#fbfaf6'; x.fillRect(0, Y(1.595), 512, Y(1.57) - Y(1.595)); x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, Y(1.595), 512, 2);
  // otwarcie marynarki: koszula + kamizelka
  const open = [[cx - 33, Y(1.572)], [cx + 33, Y(1.572)], [cx + 44, Y(1.45)], [cx + 32, Y(1.25)], [cx + 27, Y(1.04)], [cx + 38, Y(0.88)], [cx - 38, Y(0.88)], [cx - 27, Y(1.04)], [cx - 32, Y(1.25)], [cx - 44, Y(1.45)]];
  x.save(); poly(x, open); x.clip(); hx.save(); poly(hx, open); hx.clip();
  x.fillStyle = '#fbfaf6'; x.fillRect(0, 0, 512, 512); hx.fillStyle = '#707070'; hx.fillRect(0, 0, 512, 512);
  // kamizelka
  const vest = [[cx - 27, Y(1.54)], [cx, Y(1.3)], [cx + 27, Y(1.54)], [cx + 40, Y(1.22)], [cx + 34, Y(1.02)], [cx, Y(0.93)], [cx - 34, Y(1.02)], [cx - 40, Y(1.22)]];
  poly(x, vest); x.fillStyle = '#e1d7c0'; x.fill(); poly(hx, vest); hx.fillStyle = '#909090'; hx.fill();
  weave(x, hx, 512, 512);
  const vg = x.createLinearGradient(0, Y(1.3), 0, Y(0.93)); vg.addColorStop(0, 'rgba(255,255,255,.1)'); vg.addColorStop(1, 'rgba(60,45,25,.22)'); x.fillStyle = vg; poly(x, vest); x.fill();
  x.restore(); hx.restore();
  // spodnie pod kamizelka (talia) i brzeg kamizelki
  x.fillStyle = 'rgba(0,0,0,.24)'; x.fillRect(cx - 38, Y(0.9), 76, 3);
  // guziki kamizelki (zloto) + kieszonki ze szwami
  for (const yy of [1.115, 1.07, 1.025, 0.98]) {
    const g = x.createRadialGradient(cx - 1, Y(yy) - 1, 0.3, cx, Y(yy), 4); g.addColorStop(0, '#fff2b0'); g.addColorStop(0.5, '#c79c35'); g.addColorStop(1, '#6a4f12'); x.fillStyle = g; x.beginPath(); x.arc(cx, Y(yy), 3.3, 0, TAU); x.fill();
    hx.fillStyle = '#ffffff'; hx.beginPath(); hx.arc(cx, Y(yy), 3.3, 0, TAU); hx.fill(); hx.strokeStyle = '#303030'; hx.lineWidth = 1; hx.beginPath(); hx.arc(cx, Y(yy), 4.1, 0, TAU); hx.stroke();
  }
  x.strokeStyle = 'rgba(70,58,40,.55)'; x.lineWidth = 1.4; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * 20, Y(1.075)); x.lineTo(cx + s * 31, Y(1.088)); x.stroke(); }
  // kolnierzyk koszuli (dwa ostre rogi) i krawat
  for (const s of [-1, 1]) { x.fillStyle = '#ffffff'; poly(x, [[cx + s * 3, Y(1.59)], [cx + s * 33, Y(1.59)], [cx + s * 27, Y(1.5)], [cx + s * 5, Y(1.545)]]); x.fill(); x.strokeStyle = 'rgba(70,70,70,.35)'; x.lineWidth = 1.2; x.stroke(); hx.fillStyle = '#c0c0c0'; poly(hx, [[cx + s * 3, Y(1.59)], [cx + s * 33, Y(1.59)], [cx + s * 27, Y(1.5)], [cx + s * 5, Y(1.545)]]); hx.fill(); }
  const tie = [[cx - 5.5, Y(1.545)], [cx + 5.5, Y(1.545)], [cx + 6.5, Y(1.5)], [cx + 11, Y(1.3)], [cx + 10, Y(1.18)], [cx, Y(1.135)], [cx - 10, Y(1.18)], [cx - 11, Y(1.3)], [cx - 6.5, Y(1.5)]];
  x.save(); poly(x, tie); x.clip(); x.fillStyle = '#4a0f1a'; x.fillRect(cx - 20, 0, 40, 512);
  x.strokeStyle = 'rgba(205,165,115,.2)'; x.lineWidth = 2; for (let k = -40; k < 80; k += 8) { x.beginPath(); x.moveTo(cx - 20, Y(1.5) + k); x.lineTo(cx + 20, Y(1.5) + k - 24); x.stroke(); }
  const tg = x.createLinearGradient(cx - 11, 0, cx + 11, 0); tg.addColorStop(0, 'rgba(0,0,0,.45)'); tg.addColorStop(0.45, 'rgba(255,255,255,.14)'); tg.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = tg; x.fillRect(cx - 12, 0, 24, 512);
  x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(cx - 12, Y(1.5) - 1, 24, 3); // wezel
  x.restore(); hx.save(); poly(hx, tie); hx.fillStyle = '#b0b0b0'; hx.fill(); hx.restore();
  x.fillStyle = '#d6b04a'; x.fillRect(cx - 9, Y(1.37), 18, 2.2); radial(x, cx, Y(1.37) + 1, 3, '#fff4c0', '#a47a1c'); // szpilka
  hx.fillStyle = '#fff'; hx.fillRect(cx - 9, Y(1.37), 18, 2.2);
  // klapy (peak lapel): jasniejsze, z cieniem i przeszyciem
  for (const s of [-1, 1]) {
    const lap = [[cx + s * 33, Y(1.572)], [cx + s * 60, Y(1.55)], [cx + s * 74, Y(1.465)], [cx + s * 58, Y(1.435)], [cx + s * 62, Y(1.34)], [cx + s * 52, Y(1.2)], [cx + s * 42, Y(1.1)], [cx + s * 36, Y(1.05)], [cx + s * 27, Y(1.04)], [cx + s * 32, Y(1.25)], [cx + s * 44, Y(1.45)]];
    x.save(); x.shadowColor = 'rgba(0,0,0,.4)'; x.shadowBlur = 5; x.shadowOffsetX = -s * 1; x.shadowOffsetY = 2; poly(x, lap); x.fillStyle = '#f4efe1'; x.fill(); x.restore();
    pinstripes(x, hx, 0, 0, 0, 0);
    x.save(); poly(x, lap); x.clip(); weave(x, hx, 512, 512); x.restore();
    x.strokeStyle = 'rgba(60,52,38,.6)'; x.lineWidth = 1.4; poly(x, lap); x.stroke();
    
    hx.fillStyle = '#b8b8b8'; poly(hx, lap); hx.fill(); hx.strokeStyle = '#e8e8e8'; hx.lineWidth = 2; poly(hx, lap); hx.stroke(); hx.strokeStyle = '#404040'; hx.lineWidth = 1.2; hx.stroke();
    // klapa nad dziurka: kwiatek nie, ale dziurka na guzik
    x.strokeStyle = 'rgba(40,30,20,.5)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(cx + s * 50, Y(1.24)); x.lineTo(cx + s * 56, Y(1.24)); x.stroke();
  }
  // chusteczka w kieszonce i szew kieszeni (lewa piers, u < 0.5)
  x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect(188, Y(1.305), 36, 2.4); hx.fillStyle = '#404040'; hx.fillRect(188, Y(1.305), 36, 2.4);
  x.fillStyle = '#fdfdfb'; poly(x, [[193, Y(1.31)], [219, Y(1.31)], [217, Y(1.36)], [208, Y(1.335)], [200, Y(1.37)], [195, Y(1.34)]]); x.fill(); x.strokeStyle = 'rgba(80,80,80,.4)'; x.lineWidth = 0.8; x.stroke();
  hx.fillStyle = '#b0b0b0'; poly(hx, [[193, Y(1.31)], [219, Y(1.31)], [217, Y(1.36)], [208, Y(1.335)], [200, Y(1.37)], [195, Y(1.34)]]); hx.fill();
  // dol marynarki: kieszenie z klapkami i brzeg
  x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(0, Y(0.812), 512, 3); hx.fillStyle = '#c0c0c0'; hx.fillRect(0, Y(0.82), 512, 3); hx.fillStyle = '#303030'; hx.fillRect(0, Y(0.81), 512, 2.5);
  for (const X of [140, 372]) { x.fillStyle = 'rgba(70,58,40,.35)'; x.fillRect(X - 17, Y(1.0), 34, 2.2); hx.fillStyle = '#d0d0d0'; hx.fillRect(X - 17, Y(1.0), 34, 3); hx.fillStyle = '#404040'; hx.fillRect(X - 17, Y(1.0) + 3, 34, 2); }
  // szwy: srodek plecow, szwy boczne, pachy; rozporek
  for (const X of [0.8, 511]) { x.fillStyle = 'rgba(70,58,40,.45)'; x.fillRect(X - 1, Y(1.5), 2.2, Y(0.79) - Y(1.5)); hx.fillStyle = '#383838'; hx.fillRect(X - 1.2, Y(1.52), 2.6, Y(0.79) - Y(1.52)); }
  for (const X of [124, 388]) { x.strokeStyle = 'rgba(70,58,40,.35)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(X, Y(1.22)); x.lineTo(X + (X < 256 ? 2 : -2), Y(0.87)); x.stroke(); hx.strokeStyle = '#404040'; hx.lineWidth = 1.6; hx.beginPath(); hx.moveTo(X, Y(1.22)); hx.lineTo(X + (X < 256 ? 2 : -2), Y(0.87)); hx.stroke(); }
  crease(x, hx, [[0, Y(1.0)], [3, Y(0.93)], [1, Y(0.87)]], 0.2, 2); crease(x, hx, [[512, Y(1.0)], [509, Y(0.93)], [511, Y(0.87)]], 0.2, 2); // rozporek
  // zagniecenia: wokol brzucha (guzik) i pod pachami
  for (let i = 0; i < 7; i++) { const s = Math.random() < 0.5 ? -1 : 1, y0 = rr(1.0, 1.17); crease(x, hx, [[cx + s * rr(60, 120), Y(y0 + rr(0, 0.04))], [cx + s * rr(30, 60), Y(y0 - 0.02)], [cx + s * rr(28, 40), Y(y0 - 0.005)]], 0.07, rr(2, 3)); }
  for (const X of [128, 384]) for (let i = 0; i < 3; i++) crease(x, hx, [[X + rr(-18, 18), Y(1.33) - i * 5], [X + rr(-8, 8), Y(1.3) - i * 5], [X + (X < 256 ? 26 : -26), Y(1.26) - i * 6]], 0.05, 2.2);
  for (let i = 0; i < 2; i++) crease(x, hx, [[rr(60, 190), Y(1.27) - rr(0, 20)], [rr(150, 200), Y(1.3)], [rr(200, 215), Y(1.32)]], 0.06, 2.4);
  noise(x, 512, 512, 7000, 0.035);
  return { col: Tc, hgt: Hc };
}
function kingArm() {
  const Ac = cvs(256, 512), Hc = cvs(256, 512), x = Ac.x, hx = Hc.x;
  x.fillStyle = CREAM; x.fillRect(0, 0, 256, 512); hx.fillStyle = '#808080'; hx.fillRect(0, 0, 256, 512);
  weave(x, hx, 256, 512); pinstripes(x, hx, 3, 256, 0, AY(-0.495));
  // szew ramienia i lokciowe zagniecenia
  x.strokeStyle = 'rgba(70,58,40,.4)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, AY(-0.01)); x.quadraticCurveTo(128, AY(0.01), 256, AY(-0.01)); x.stroke();
  for (let i = 0; i < 4; i++) { const y0 = AY(-0.285) + (i - 3) * 7; crease(x, hx, [[60, y0 + rr(-3, 3)], [128, y0 + rr(-6, 0)], [196, y0 + rr(-3, 3)]], 0.1, rr(2, 3.2)); }
  for (let i = 0; i < 2; i++) crease(x, hx, [[rr(80, 100), AY(-0.1) + i * 9], [128, AY(-0.1) + i * 9 + 6], [rr(156, 176), AY(-0.1) + i * 9]], 0.07, 2.4);
  // mankiet: biala koszula wystaje, spinki
  const cy = AY(-0.49);
  x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, cy - 2, 256, 3); x.fillStyle = '#fbfaf6'; x.fillRect(0, cy + 1, 256, 512 - cy); hx.fillStyle = '#a0a0a0'; hx.fillRect(0, cy + 1, 256, 512 - cy); hx.fillStyle = '#d8d8d8'; hx.fillRect(0, cy - 3, 256, 3);
  x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(0, cy + 18, 256, 2); x.fillRect(0, cy + 21, 256, 1);
  for (const X of [64]) { radial(x, X, cy + 10, 6, '#fff0a8', '#9a7418'); x.strokeStyle = '#6a4f12'; x.lineWidth = 0.9; x.beginPath(); x.arc(X, cy + 10, 5, 0, TAU); x.stroke(); hx.fillStyle = '#fff'; hx.beginPath(); hx.arc(X, cy + 10, 5, 0, TAU); hx.fill(); }
  // guziki rekawa (3)
  for (let k = 0; k < 3; k++) { const by = cy - 11 - k * 10; radial(x, 64, by, 4, '#f2ecd8', '#aaa38c'); x.strokeStyle = 'rgba(60,52,38,.7)'; x.lineWidth = 0.9; x.beginPath(); x.arc(64, by, 3.4, 0, TAU); x.stroke(); hx.fillStyle = '#e8e8e8'; hx.beginPath(); hx.arc(64, by, 3.4, 0, TAU); hx.fill(); }
  crease(x, hx, [[64 - 6, cy - 3], [64 - 4, cy - 40], [64 - 7, cy - 60]], 0.18, 1.6);
  noise(x, 256, 512, 2500, 0.035);
  return { col: Ac, hgt: Hc };
}
function kingLeg() {
  const Gc = cvs(256, 512), Hc = cvs(256, 512), x = Gc.x, hx = Hc.x;
  x.fillStyle = CREAM; x.fillRect(0, 0, 256, 512); hx.fillStyle = '#808080'; hx.fillRect(0, 0, 256, 512);
  weave(x, hx, 256, 512); pinstripes(x, hx, 3, 256, 0, 512);
  // kant spodni z przodu i z tylu, szwy boczne
  for (const X of [128, 1]) { x.fillStyle = 'rgba(70,60,48,.22)'; x.fillRect(X - 1, 0, 2.2, LY(-0.8)); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(X + 1.2, 0, 1.4, LY(-0.8)); hx.fillStyle = '#505050'; hx.fillRect(X - 1, 0, 2.2, LY(-0.8)); hx.fillStyle = '#b8b8b8'; hx.fillRect(X + 1.2, 0, 1.4, LY(-0.8)); }
  for (const X of [64, 192]) { x.strokeStyle = 'rgba(70,58,40,.3)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, LY(-0.8)); x.stroke(); }
  // zagniecenia: udo (biodro), kolano, zalamanie nad butem
  for (let i = 0; i < 5; i++) crease(x, hx, [[rr(70, 110), LY(0.0) + i * 7 - 10], [128, LY(0.0) + i * 7 + 4], [rr(150, 190), LY(0.0) + i * 7 - 10 + rr(0, 8)]], 0.05, 2.6);
  for (let i = 0; i < 3; i++) crease(x, hx, [[60, LY(-0.43) + i * 6 - 12], [128, LY(-0.43) + i * 6 - 6], [196, LY(-0.43) + i * 6 - 10]], 0.09, 2.4);
  for (let i = 0; i < 3; i++) crease(x, hx, [[56, LY(-0.74) + i * 5], [128, LY(-0.74) + i * 5 + 6], [200, LY(-0.74) + i * 5]], 0.12, 2.8);
  // mankiet nogawki (podwiniety) i jego cien
  const cy = LY(-0.8); x.fillStyle = 'rgba(0,0,0,.3)'; x.fillRect(0, cy, 256, 4); hx.fillStyle = '#c8c8c8'; hx.fillRect(0, cy - 2, 256, 3); hx.fillStyle = '#383838'; hx.fillRect(0, cy + 1, 256, 3);
  noise(x, 256, 512, 2500, 0.035);
  return { col: Gc, hgt: Hc };
}
function kingFace() {
  const F = cvs(512, 256), x = F.x, Hc = cvs(512, 256), hx = Hc.x;
  drawFace(x, { skin: SKIN, hair: 'bald', angry: true, eyeCol: '#3e535d', browCol: 'rgba(135,108,92,.55)' });
  hx.fillStyle = '#808080'; hx.fillRect(0, 0, 512, 256);
  const L = (pts, a, w, hk = true) => {
    x.strokeStyle = `rgba(90,45,35,${a})`; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); x.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); x.stroke();
    x.save(); x.translate(0, w * 0.9); x.strokeStyle = `rgba(255,235,220,${a * 0.7})`; x.lineWidth = w * 0.7; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); x.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); x.stroke(); x.restore();
    if (hk) { hx.strokeStyle = `rgba(0,0,0,${Math.min(0.85, a * 3)})`; hx.lineWidth = w * 1.2; hx.lineCap = 'round'; hx.beginPath(); hx.moveTo(pts[0][0], pts[0][1]); hx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]); hx.stroke(); }
    x.lineCap = 'butt';
  };
  // czolo: poziome zmarszczki i pionowe miedzy brwiami
  L([[196, 90], [222, 86], [250, 90]], 0.18, 1.6); L([[262, 90], [290, 86], [316, 90]], 0.18, 1.6); L([[204, 78], [256, 72], [308, 78]], 0.12, 1.4);
  L([[249, 98], [250, 106], [248, 113]], 0.3, 1.8); L([[263, 98], [262, 106], [264, 113]], 0.3, 1.8);
  // worki pod oczami, kurze lapki
  for (const X of [226, 286]) { radial(x, X, 132, 18, 'rgba(120,70,80,.25)'); L([[X - 12, 130], [X, 137], [X + 12, 130]], 0.16, 1.4); }
  for (const [X, s] of [[226, -1], [286, 1]]) for (let k = 0; k < 3; k++) L([[X + s * 12, 118 + k * 4], [X + s * 18, 118 + k * 6], [X + s * 24, 116 + k * 9]], 0.14, 1);
  // bruzdy nosowo-wargowe i opadajace kaciki ust, podbrodek
  for (const s of [-1, 1]) {
    L([[256 + s * 15, 138], [256 + s * 30, 152], [256 + s * 27, 168]], 0.3, 2.4);
    L([[256 + s * 13, 154], [256 + s * 17, 160], [256 + s * 15, 168]], 0.22, 1.6);
    radial(x, 256 + s * 54, 168, 34, 'rgba(70,35,30,.16)'); radial(x, 256 + s * 38, 190, 36, 'rgba(60,30,25,.18)'); radial(x, 256 + s * 60, 140, 24, 'rgba(190,90,80,.12)'); // policzki, jowls
  }
  radial(x, 256, 214, 46, 'rgba(60,30,25,.3)'); L([[226, 192], [256, 200], [286, 192]], 0.2, 1.8);
  L([[237, 147], [256, 151], [275, 147]], 0.18, 1.2);
  // czerwonawy nos, rumience, zylki
  radial(x, 256, 138, 15, 'rgba(210,100,90,.28)'); for (const s of [-1, 1]) radial(x, 256 + s * 11, 142, 7, 'rgba(180,70,70,.22)');
  // zarost: siwy wasik i krotka kozia bródka, delikatny cien zarostu na szczece
  const sp = (n, cx, cy, rx, ry, c, a, keep) => { x.fillStyle = c; for (let i = 0; i < n; i++) { const px = cx + (Math.random() * 2 - 1) * rx, py = cy + (Math.random() * 2 - 1) * ry; if (((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 > 1) continue; if (keep && !keep(px, py)) continue; x.globalAlpha = a * rr(0.6, 1); x.fillRect(px, py, 1.5, 1.5); } x.globalAlpha = 1; };
  const notMouth = (px, py) => !(Math.abs(px - 256) < 17 && py > 150 && py < 160);
  sp(520, 256, 144, 20, 5, '#3b3636', 0.5, (px, py) => py < 150); sp(300, 256, 144, 20, 5, '#a7a29c', 0.5, (px, py) => py < 150);
  sp(2200, 256, 180, 26, 26, '#383434', 0.55, notMouth); sp(1100, 256, 182, 26, 26, '#a9a49e', 0.55, notMouth);
  sp(4000, 256, 178, 74, 38, '#3a2e2a', 0.12, (px, py) => py > 140 && notMouth(px, py)); sp(1500, 256, 178, 74, 38, '#a39d96', 0.12, (px, py) => py > 140 && notMouth(px, py));
  // sciezka usta + porach i nierownosci skory
  x.strokeStyle = 'rgba(55,25,20,.6)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(239, 155); x.quadraticCurveTo(256, 155.5, 273, 155); x.stroke();
  for (let i = 0; i < 6000; i++) { const px = rr(150, 362), py = rr(60, 230); x.fillStyle = `rgba(80,40,30,${rr(0.02, 0.07)})`; x.fillRect(px, py, 1.4, 1.4); hx.fillStyle = `rgba(0,0,0,${rr(0.08, 0.2)})`; hx.fillRect(px, py, 1.2, 1.2); }
  for (let i = 0; i < 40; i++) radial(x, rr(160, 352), rr(70, 220), rr(2, 6), 'rgba(130,80,60,.09)'); // plamki
  // wypuklosc: brwi, nos, kosci policzkowe
  hx.fillStyle = 'rgba(255,255,255,.2)'; for (const X of [212, 300]) { hx.beginPath(); hx.ellipse(X, 106, 32, 7, 0, 0, TAU); hx.fill(); }
  noise(x, 512, 256, 2500, 0.03);
  return { col: F, hgt: Hc };
}
function kingpinMats() {
  if (KPM) return KPM;
  const t = kingTorso(), a = kingArm(), g = kingLeg(), f = kingFace();
  const head = new THREE.MeshStandardMaterial({ map: tex(f.col), normalMap: lin(tex(normalFromHeight(f.hgt.c, 3.2))), roughness: 0.62, metalness: 0 });
  head.envMapIntensity = 0.9; head.userData.env = 0.9;
  // skora dloni: ten sam odcien, z porami
  const sk = cvs(128, 128), sh = cvs(128, 128); sk.x.fillStyle = SKIN; sk.x.fillRect(0, 0, 128, 128); sh.x.fillStyle = '#808080'; sh.x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 40; i++) radial(sk.x, rr(0, 128), rr(0, 128), rr(6, 18), `rgba(${rr(150, 210) | 0},${rr(80, 120) | 0},${rr(60, 90) | 0},.08)`);
  for (let i = 0; i < 900; i++) { sh.x.fillStyle = `rgba(0,0,0,${rr(0.1, 0.25)})`; sh.x.fillRect(rr(0, 128), rr(0, 128), 1.2, 1.2); }
  for (let i = 0; i < 30; i++) { sh.x.strokeStyle = 'rgba(0,0,0,.25)'; sh.x.lineWidth = 0.8; const X = rr(0, 128), Y = rr(0, 128); sh.x.beginPath(); sh.x.moveTo(X, Y); sh.x.lineTo(X + rr(-10, 10), Y + rr(-2, 2)); sh.x.stroke(); }
  noise(sk.x, 128, 128, 800, 0.05);
  const skin = new THREE.MeshStandardMaterial({ map: tex(sk), normalMap: lin(tex(normalFromHeight(sh.c, 2.2))), roughness: 0.6 }); skin.envMapIntensity = 0.9; skin.userData.env = 0.9;
  const shoe = new THREE.MeshStandardMaterial({ color: 0x0b0a0a, roughness: 0.22, metalness: 0.15 }); shoe.envMapIntensity = 1.8; shoe.userData.env = 1.8;
  const black = new THREE.MeshStandardMaterial({ color: 0x0d0b0b, roughness: 0.1, metalness: 0.55 }); black.envMapIntensity = 2.0; black.userData.env = 2.0;
  const gold = new THREE.MeshStandardMaterial({ color: 0xd1a53f, roughness: 0.24, metalness: 1.0 }); gold.envMapIntensity = 1.8; gold.userData.env = 1.8;
  const steel = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.28, metalness: 1.0 }); steel.envMapIntensity = 1.8; steel.userData.env = 1.8;
  const glass = new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.08, metalness: 0.4 }); glass.envMapIntensity = 2.2; glass.userData.env = 2.2;
  return (KPM = { torso: fabricMat(t.col, t.hgt, 3.4), arm: fabricMat(a.col, a.hgt, 3.4), leg: fabricMat(g.col, g.hgt, 3.4), head, skin, shoe, black, gold, steel, glass });
}

export function buildKingpin() {
  const K = kingpinMats();
  const body = { w: 1.42, chest: 1.3, waist: 1.55, belly: 0.5, pec: 0.5, hips: 1.32, arm: 1.38, leg: 1.12, neck: 1.7, head: 1.16 };
  const H = build('fisk', { torso: K.torso, arm: K.arm, leg: K.leg, head: K.head, hand: K.skin, foot: K.shoe }, { face: true, shoe: 'boot', body });
  H.setHands('open', 'fist');
  for (const L of ['L', 'R']) for (const v in H.hands[L]) H.hands[L][v].scale.setScalar(1.2);
  const hs = body.head;
  // glowa: ciezka szczeka (jowls), podwojny podbrodek, mocny luk brwiowy + uszy w jednej siatce
  const hd = headData(body, true, 56, 40);
  for (let i = 0; i < hd.pos.length; i += 3) {
    const ry = hd.pos[i + 1] - HC, k = sm(0.005, -0.085 * hs, ry), fr = sm(0.0, 0.07, hd.pos[i + 2]);
    hd.pos[i] *= 1 + 0.2 * k; hd.pos[i + 2] += 0.02 * k * fr * hs + (ry < -0.1 * hs ? 0.012 : 0); hd.pos[i + 1] -= 0.012 * k * (1 - Math.min(1, Math.abs(hd.pos[i]) / 0.18));
    hd.pos[i + 2] += 0.012 * Math.exp(-(((ry - 0.034 * hs) / 0.016) ** 2)) * fr * hs; // luk brwiowy
    hd.pos[i + 2] += 0.008 * Math.exp(-(((ry + 0.01) / 0.03) ** 2)) * Math.exp(-(((hd.pos[i] - 0) / 0.05) ** 2)) * fr; // nos
  }
  const ears = [];
  for (const s of [1, -1]) ears.push(put(new THREE.SphereGeometry(1, 14, 10), [0.1 * hs * 1.02 * s, HC - 0.006, 0.0], [0, 0, 0.12 * s], [0.014, 0.034, 0.024]));
  for (const g of ears) { // uszy: uv z gladkiego fragmentu tekstury skory (na boku glowy)
    const P = g.attributes.position, N = g.attributes.normal, base = hd.pos.length / 3;
    for (let i = 0; i < P.count; i++) { hd.pos.push(P.getX(i), P.getY(i), P.getZ(i)); hd.uv.push(0.16 + Math.random() * 0.02, 0.5); }
    for (let i = 0; i < g.index.count; i++) hd.idx.push(g.index.getX(i) + base);
  }
  for (let i = 1; i < hd.pos.length; i += 3) hd.pos[i] += 0.04; // glowa wyzej: widac gruba szyje nad kolnierzykiem
  H.headM.geometry.dispose(); H.headM.geometry = toGeo(hd);
  // zegarek na lewym nadgarstku (stalowa koperta i bransoleta)
  const band = new THREE.TorusGeometry(0.053, 0.008, 8, 28); band.rotateX(Math.PI / 2);
  const watch = [put(band, [0, -0.235, 0], [0, 0, 0], [1.02, 2.1, 1.02]), put(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 24), [0.058, -0.235, 0], [0, 0, Math.PI / 2])];
  attach(H.elL, watch, K.steel);
  // sygnet na palcu serdecznym lewej dloni (osobno dla kazdej wariantu dloni: pokaze sie ten, ktory jest widoczny)
  for (const v of ['open', 'fist']) {
    const hm = H.hands.L[v], k = body.arm, s = 1, curl = v === 'fist' ? 1 : 0.28, f = 2, Z = [0.028, 0.009, -0.01, -0.028];
    let th = curl * 0.3; const p = new V3(0, -0.04, Z[f] * k); th += 1.3 * curl * 0.7; const d = new V3(-s * Math.sin(th), -Math.cos(th), 0);
    const c = p.clone().addScaledVector(d, 0.014 * k), ring = new THREE.TorusGeometry(0.0125 * k, 0.0035 * k, 8, 16), q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d);
    const rg = ring.clone().applyMatrix4(new THREE.Matrix4().compose(c, q, new V3(1, 1, 1)));
    const stone = new THREE.SphereGeometry(0.0085 * k, 10, 8), sg = stone.clone().applyMatrix4(new THREE.Matrix4().compose(c.clone().add(new V3(0.0125 * k * 0.9 * -s, 0, 0)), new THREE.Quaternion(), new V3(1, 0.6, 1)));
    hm.add(new THREE.Mesh(joinGeo([rg, sg]), K.gold));
  }
  // laska: czarny, lsniacy trzon, zloty okucie, ciemna glowka ze zlota obrecza
  const cane = new THREE.Group();
  const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg);
  const shaft = lathe([[0.0, -0.87], [0.011, -0.87], [0.0125, -0.84], [0.0135, -0.5], [0.0145, 0.02], [0.0, 0.02]]);
  const knob = lathe([[0.0, 0.05], [0.026, 0.05], [0.036, 0.075], [0.043, 0.105], [0.04, 0.135], [0.03, 0.158], [0.012, 0.172], [0.0, 0.174]], 24);
  const hook = lathe([[0.0, 0.0], [0.02, 0.0], [0.02, 0.05], [0.0, 0.05]]); // (zapas)
  const goldGeo = [
    lathe([[0.0145, -0.87], [0.0165, -0.87], [0.0165, -0.835], [0.0145, -0.83]]), // okucie
    lathe([[0.0145, 0.02], [0.027, 0.03], [0.028, 0.05], [0.0145, 0.052]]), // kolnierz pod glowka
    lathe([[0.0425, 0.095], [0.0455, 0.1], [0.0455, 0.11], [0.0425, 0.115]]), // obreczy
  ];
  cane.add(new THREE.Mesh(joinGeoNoUv(shaft, knob), K.black)); cane.add(new THREE.Mesh(joinGeoNoUv(...goldGeo), K.gold));
  cane.position.set(0, -0.3, 0.02); cane.traverse(o2 => { if (o2.isMesh) o2.castShadow = true; }); H.elR.add(cane); H.cane = cane;
  return H;
}
function joinGeoNoUv(...gs) { // lathe ma uv, normalne i index — scal jak zwykle
  return joinGeo(gs);
}

// Rozgrzewka: tekstury bossow (rysowanie na canvasie trwa ok. sekundy) przygotowuja sie w tle po starcie gry,
// zeby nie zacinalo przy wejsciu do walki. Kazda postac w osobnym kroku.
if (typeof setTimeout === 'function' && typeof document !== 'undefined') {
  setTimeout(() => { try { rhinoMats(); } catch (e) { /* brak canvasu */ } }, 12000);
  setTimeout(() => { try { kingpinMats(); } catch (e) { /* brak canvasu */ } }, 20000);
}
