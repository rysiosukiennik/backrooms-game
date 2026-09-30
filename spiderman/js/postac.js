// Pozy i animacja szkieletu postaci oraz lista strojow. Same modele buduje model.js.
import { V3, DOWN, cv, canvasTex } from './util.js';
export { buildSpider, buildThug, buildBoss, buildKingpin, suitThumb, suitMats } from './model.js';

export const SG = new THREE.SphereGeometry(1, 28, 18);
export function el(mat, sx, sy, sz, x = 0, y = 0, z = 0, geo = SG) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; return m;
}

// ---------------------------------------------------------------- pozy
export const POSEK = ['by', 'bp', 'br', 'bw', 'spx', 'spy', 'spz', 'chx', 'hx', 'hy', 'sLx', 'sLy', 'sLz', 'eL', 'sRx', 'sRy', 'sRz', 'eR', 'hLx', 'hLz', 'kL', 'hRx', 'hRz', 'kR', 'fL', 'fR'];
export function newPose() { const o = {}; for (const k of POSEK) o[k] = 0; return o; }
export function zeroPose(o) { for (const k of POSEK) o[k] = 0; }
export function blendPose(c, t, k) { for (const q of POSEK) c[q] += (t[q] - c[q]) * k; }
export function applyPose(H, c) {
  H.body.position.y = 0.95 + c.by;
  H.body.rotation.set(c.bp, c.bw, c.br, 'YXZ');
  H.spine.rotation.set(c.spx, c.spy, c.spz);
  H.chest.rotation.set(c.chx, 0, 0);
  H.neck.rotation.set(c.hx, c.hy, 0);
  H.shL.rotation.set(c.sLx, c.sLy, c.sLz); H.elL.rotation.set(c.eL, 0, 0);
  H.shR.rotation.set(c.sRx, c.sRy, c.sRz); H.elR.rotation.set(c.eR, 0, 0);
  H.hipL.rotation.set(c.hLx, 0, c.hLz); H.knL.rotation.set(c.kL, 0, 0);
  H.hipR.rotation.set(c.hRx, 0, c.hRz); H.knR.rotation.set(c.kR, 0, 0);
  H.ftL.rotation.set(c.fL, 0, 0); H.ftR.rotation.set(c.fR, 0, 0);
}
export function idlePose(t, time) {
  t.by = Math.sin(time * 2.2) * 0.008; t.chx = Math.sin(time * 2.2) * 0.02;
  t.sLz = 0.14; t.sRz = -0.14; t.sLx = 0.05; t.sRx = 0.05; t.eL = -0.25; t.eR = -0.25;
  t.hLz = 0.05; t.hRz = -0.05; t.kL = 0.04; t.kR = 0.04;
}
export function runPose(t, ph, a, sprint) {
  const s = Math.sin(ph), c = Math.cos(ph);
  t.hLx = -s * 0.85 * a; t.hRx = s * 0.85 * a;
  t.kL = 0.25 + Math.max(0, c) * 1.4 * a; t.kR = 0.25 + Math.max(0, -c) * 1.4 * a;
  t.by = (Math.abs(s) * 0.06 - 0.04) * a; t.bp = 0.12 * a;
  if (sprint) { // bieg z rekami do tylu
    t.sLx = 1.0; t.sRx = 1.0; t.sLz = 0.25; t.sRz = -0.25; t.eL = -0.2; t.eR = -0.2; t.bp = 0.5; t.hx = -0.4;
  } else {
    t.sLx = s * 0.75 * a; t.sRx = -s * 0.75 * a; t.eL = -0.9; t.eR = -0.9; t.sLz = 0.1; t.sRz = -0.1;
  }
}
export function crouchPose(t) {
  t.by = -0.5; t.hLx = -1.9; t.hRx = -1.9; t.kL = 2.3; t.kR = 2.3; t.hLz = 0.35; t.hRz = -0.35; t.bp = 0.55;
  t.sLx = -0.6; t.sRx = -0.6; t.eL = -0.9; t.eR = -0.9; t.sLz = 0.15; t.sRz = -0.15; t.hx = -0.5; t.fL = 0.4; t.fR = 0.4;
}
export function tuckPose(t) {
  t.hLx = -1.7; t.kL = 2.2; t.hRx = -1.7; t.kR = 2.2; t.sLx = -1; t.sRx = -1; t.eL = -1.6; t.eR = -1.6; t.by = 0.1; t.hx = 0.3;
}

const _q = new THREE.Quaternion(), _v = new V3();
// wyceluj reka w punkt w swiecie (w = 0..1). Wymaga aktualnych macierzy (root.updateMatrixWorld).
export function aimArm(H, side, pt, w) {
  const sh = side === 'R' ? H.shR : H.shL;
  _v.copy(pt); sh.parent.worldToLocal(_v); _v.sub(sh.position);
  if (_v.lengthSq() < 1e-6) return;
  _v.normalize();
  _q.setFromUnitVectors(DOWN, _v);
  sh.quaternion.slerp(_q, w);
  const eb = side === 'R' ? H.elR : H.elL; eb.rotation.x *= 1 - w;
}
const _m = new THREE.Matrix4(), _x = new V3(), _f = new V3(), _u = new V3();
// kwaternion z osi "gora" i "przod" modelu
export function basisQ(q, up, fw) {
  _u.copy(up).normalize();
  _f.copy(fw).addScaledVector(_u, -fw.dot(_u));
  if (_f.lengthSq() < 1e-6) { _f.set(0, 0, 1).addScaledVector(_u, -_u.z); if (_f.lengthSq() < 1e-6) _f.set(1, 0, 0); }
  _f.normalize(); _x.crossVectors(_u, _f);
  _m.makeBasis(_x, _u, _f); q.setFromRotationMatrix(_m); return q;
}

// ---------------------------------------------------------------- stroje
// parts: p = kolor glowny z siecia, s = drugi kolor, a = dodatek
const ADV = { head: 'p', abd: 's', pelvis: 'p', uarm: 'p', farm: 's', hand: 'p', thigh: 's', shin: 's', foot: 'p' };
const ALLP = { head: 'p', abd: 'p', pelvis: 'p', uarm: 'p', farm: 'p', hand: 'p', thigh: 'p', shin: 'p', foot: 'p' };
export const SUITS = [
  { id: 'adv', name: 'ZAAWANSOWANY STRÓJ', lvl: 1, desc: 'Strój, który Peter zaprojektował sam. Lekki, wytrzymały i z wielkim białym pająkiem.', prim: '#c8141c', web: '#3b0508', sec: '#15204a', logo: '#f4f4f4', logoS: 'big', eye: '#f5f5f5', rim: '#0c0c0c', sides: true, stripe: '#c8141c', parts: ADV },
  { id: 'classic', name: 'KLASYCZNY STRÓJ', lvl: 1, desc: 'Czerwień i błękit, czarna pajęczyna. Tak to się wszystko zaczęło.', prim: '#d3161e', web: '#1a0000', sec: '#1d3ea8', logo: '#111', logoS: 'small', eye: '#f2f2f2', rim: '#111', sides: true, parts: { head: 'p', abd: 'p', pelvis: 'p', uarm: 's', farm: 'p', hand: 'p', thigh: 's', shin: 's', foot: 'p' } },
  { id: 'home', name: 'DOMOWY STRÓJ', lvl: 1, desc: 'Bluza, dresy i gogle. Uszyty w pokoju, ale działa.', prim: '#b8262b', web: null, sec: '#2d56a8', acc: '#2a2a2a', logo: '#111', logoS: 'small', eye: '#161616', rim: '#555', parts: { head: 'p', abd: 'p', pelvis: 's', uarm: 'p', farm: 'p', hand: 'p', thigh: 's', shin: 's', foot: 'a' } },
  { id: 'black', name: 'CZARNY STRÓJ', lvl: 2, desc: 'Czarny jak noc, z ogromnym białym pająkiem na piersi.', prim: '#111317', web: null, sec: '#111317', logo: '#f2f2f2', logoS: 'big', eye: '#f5f5f5', rim: '#000', gloss: true, parts: ALLP },
  { id: 'neg', name: 'NEGATYW', lvl: 2, desc: 'Odwrócone kolory — białe tło i czarna sieć.', prim: '#eeeeee', web: '#111', sec: '#141414', logo: '#111', logoS: 'big', eye: '#1a1a1a', rim: '#eee', sides: true, stripe: '#eeeeee', parts: ADV },
  { id: 'miles', name: 'STRÓJ MILESA', lvl: 3, desc: 'Czarny strój z czerwoną pajęczyną.', prim: '#121212', web: '#d0141c', sec: '#121212', logo: '#d0141c', logoS: 'big', eye: '#f5f5f5', rim: '#000', parts: ALLP },
  { id: 'iron', name: 'ŻELAZNY PAJĄK', lvl: 3, desc: 'Czerwień i złoto. Metalowe płytki lśnią w słońcu.', prim: '#b3121a', web: '#4a0004', sec: '#d9ab2e', acc: '#d9ab2e', logo: '#e6b93a', logoS: 'big', eye: '#f5f5f5', rim: '#222', sides: true, metal: true, parts: { head: 'p', abd: 's', pelvis: 's', uarm: 's', farm: 'p', hand: 's', thigh: 's', shin: 'p', foot: 's' } },
  { id: 'scarlet', name: 'SZKARŁATNY PAJĄK', lvl: 4, desc: 'Czerwony kombinezon i niebieska bluza bez rękawów.', prim: '#b01218', web: '#3d0003', sec: '#233f8f', logo: '#b01218', logoS: 'big', eye: '#f0f0f0', rim: '#111', chestSec: true, parts: { head: 'p', abd: 's', pelvis: 's', uarm: 'p', farm: 'p', hand: 'p', thigh: 'p', shin: 'p', foot: 'p' } },
  { id: '2099', name: 'SPIDER-MAN 2099', lvl: 4, desc: 'Strój z przyszłości: granat, czerń i czerwony znak.', prim: '#152461', web: null, sec: '#0a0d1c', logo: '#d4161f', logoS: 'big', eye: '#e21b25', rim: '#0a0a0a', sides: true, parts: { head: 'p', abd: 's', pelvis: 's', uarm: 'p', farm: 's', hand: 's', thigh: 'p', shin: 'p', foot: 's' } },
  { id: 'noir', name: 'NOIR', lvl: 5, desc: 'Czarno-biały detektyw z lat trzydziestych.', prim: '#1a1a1a', web: null, sec: '#2e2e2e', acc: '#3a3a3a', logo: '#2e2e2e', logoS: 'none', eye: '#9aa0a6', rim: '#4a4a4a', parts: { head: 'p', abd: 's', pelvis: 's', uarm: 's', farm: 's', hand: 'p', thigh: 'p', shin: 'p', foot: 'a' } },
  { id: 'anti', name: 'ANTY-VENOM', lvl: 5, desc: 'Biel i czerń, czarna głowa i wielki czarny pająk.', prim: '#efefef', web: null, sec: '#101010', logo: '#101010', logoS: 'big', eye: '#ffffff', rim: '#222', sides: true, parts: { head: 's', abd: 's', pelvis: 's', uarm: 'p', farm: 's', hand: 'p', thigh: 's', shin: 'p', foot: 'p' } },
  { id: 'toxic', name: 'TOKSYCZNY', lvl: 6, desc: 'Świecąca na zielono sieć — widać cię w nocy z daleka.', prim: '#0e1210', web: '#39ff6a', glow: true, sec: '#0a0c0b', logo: '#39ff6a', logoS: 'big', eye: '#9dffb5', rim: '#000', parts: ALLP },
  { id: 'mk', name: 'ZBROJA MK II', lvl: 6, desc: 'Ciężka zbroja w czerni i żółci.', prim: '#1b1b1d', web: '#2d2d30', sec: '#f0c419', logo: '#f0c419', logoS: 'big', eye: '#f0c419', rim: '#111', sides: true, metal: true, parts: { head: 'p', abd: 's', pelvis: 's', uarm: 's', farm: 'p', hand: 'p', thigh: 'p', shin: 's', foot: 'p' } },
  { id: 'stealth', name: 'STRÓJ UKRYCIA', lvl: 7, desc: 'Ciemny strój z błękitną, świecącą pajęczyną.', prim: '#1c2127', web: '#18e0ff', glow: true, sec: '#12161a', logo: '#18e0ff', logoS: 'big', eye: '#6ff2ff', rim: '#000', parts: ALLP },
  { id: 'gold', name: 'ZŁOTY PAJĄK', lvl: 8, desc: 'Czyste złoto. Nagroda dla najlepszych.', prim: '#d4a52a', web: '#5b4108', sec: '#1a1a1a', logo: '#1a1a1a', logoS: 'big', eye: '#fff', rim: '#111', metal: true, sides: true, stripe: '#d4a52a', parts: ADV },
];
export const suitById = id => SUITS.find(s => s.id === id);

function webCanvas(base, line) {
  const c = cv(256, 256), x = c.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = line; x.lineWidth = 2.2;
  for (let a = 0; a <= 256; a += 32) { x.beginPath(); x.moveTo(a, 0); x.lineTo(a, 256); x.stroke(); }
  for (let y = 16; y <= 256; y += 32) { x.beginPath(); for (let a = 0; a < 256; a += 32) { x.moveTo(a, y); x.quadraticCurveTo(a + 16, y + 10, a + 32, y); } x.stroke(); }
  return c;
}
let _webMat = null;
export function webMaterial() {
  return _webMat || (_webMat = new THREE.MeshStandardMaterial({ map: canvasTex(webCanvas('#ececec', '#9c9c9c'), true), roughness: 0.9 }));
}
const flat = {};
export function flatMat(hex) { return flat[hex] || (flat[hex] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8 })); }
