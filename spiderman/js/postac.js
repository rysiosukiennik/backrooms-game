// Pozy i animacja szkieletu postaci oraz lista strojow. Same modele buduje model.js.
import { V3, DOWN, cv, canvasTex } from './util.js';
export { buildSpider, buildThug, buildBoss, buildKingpin, suitThumb, suitMats, suitWear } from './model.js';

export const SG = new THREE.SphereGeometry(1, 28, 18);
export function el(mat, sx, sy, sz, x = 0, y = 0, z = 0, geo = SG) {
  const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; return m;
}

// ---------------------------------------------------------------- pozy
export const POSEK = ['by', 'bp', 'br', 'bw', 'spx', 'spy', 'spz', 'chx', 'hx', 'hy', 'hz', 'sLx', 'sLy', 'sLz', 'eL', 'sRx', 'sRy', 'sRz', 'eR', 'hLx', 'hLz', 'kL', 'hRx', 'hRz', 'kR', 'fL', 'fR'];
export function newPose() { const o = {}; for (const k of POSEK) o[k] = 0; return o; }
export function zeroPose(o) { for (const k of POSEK) o[k] = 0; }
export function blendPose(c, t, k) { for (const q of POSEK) c[q] += (t[q] - c[q]) * k; }
export function applyPose(H, c) {
  H.body.position.y = 0.95 + c.by;
  H.body.rotation.set(c.bp, c.bw, c.br, 'YXZ');
  H.spine.rotation.set(c.spx, c.spy, c.spz);
  H.chest.rotation.set(c.chx, 0, 0);
  H.neck.rotation.set(c.hx, c.hy, c.hz);
  H.shL.rotation.set(c.sLx, c.sLy, c.sLz); H.elL.rotation.set(c.eL, 0, 0);
  H.shR.rotation.set(c.sRx, c.sRy, c.sRz); H.elR.rotation.set(c.eR, 0, 0);
  H.hipL.rotation.set(c.hLx, 0, c.hLz); H.knL.rotation.set(c.kL, 0, 0);
  H.hipR.rotation.set(c.hRx, 0, c.hRz); H.knR.rotation.set(c.kR, 0, 0);
  H.ftL.rotation.set(c.fL, 0, 0); H.ftR.rotation.set(c.fR, 0, 0);
}
// hero = true: postawa Spider-Mana (lekko ugiete kolana, balans ciezaru, rozgladanie sie); reszta postaci ma spokojny stoj
export function idlePose(t, time, hero) {
  const br = Math.sin(time * 2.2), sw = Math.sin(time * 0.55), sw2 = Math.sin(time * 0.37 + 1.3);
  t.by = br * 0.008 - (hero ? 0.04 : 0); t.chx = br * 0.025 + (hero ? 0.1 : 0);
  t.sLz = 0.14 + br * 0.02; t.sRz = -0.14 - br * 0.02; t.sLx = 0.05; t.sRx = 0.05; t.eL = -0.25; t.eR = -0.25;
  t.hLz = 0.05; t.hRz = -0.05; t.kL = 0.04; t.kR = 0.04;
  if (!hero) return;
  // oddech (unosi sie klatka i barki), przenoszenie ciezaru z nogi na noge, lekkie rozgladanie sie glowa
  t.spz = sw * 0.035; t.br = sw * 0.03; t.bw = sw2 * 0.05; t.hy = sw2 * 0.22 - t.bw; t.hx = 0.04 + Math.sin(time * 0.43) * 0.05;
  t.hLz = 0.1 + Math.max(0, sw) * 0.05; t.hRz = -0.1 - Math.max(0, -sw) * 0.05;
  t.hLx = -0.06; t.hRx = 0.05; t.kL = 0.2 + Math.max(0, sw) * 0.12; t.kR = 0.2 + Math.max(0, -sw) * 0.12;
  t.sLz = 0.2 + br * 0.03; t.sRz = -0.2 - br * 0.03; t.sLx = -0.12 + sw * 0.05; t.sRx = -0.12 - sw * 0.05; t.eL = -0.5; t.eR = -0.5;
}
export function runPose(t, ph, a, sprint) {
  const s = Math.sin(ph), c = Math.cos(ph);
  t.hLx = -s * 0.85 * a; t.hRx = s * 0.85 * a;
  t.kL = 0.25 + Math.max(0, c) * 1.4 * a; t.kR = 0.25 + Math.max(0, -c) * 1.4 * a;
  t.by = (Math.abs(s) * 0.06 - 0.04) * a; t.bp = 0.12 * a;
  t.spy = -s * 0.16 * a; t.br = s * 0.035 * a; // skret tulowia przeciwny do kroku i kolysanie bioder
  t.fL = Math.max(0, -c) * 0.5 * a; t.fR = Math.max(0, c) * 0.5 * a; // odbicie palcami
  if (sprint) { // bieg z rekami do tylu, nisko nad ziemia
    t.sLx = 0.95 + s * 0.35; t.sRx = 0.95 - s * 0.35; t.sLz = 0.25; t.sRz = -0.25; t.eL = -0.25 - Math.max(0, s) * 0.3; t.eR = -0.25 - Math.max(0, -s) * 0.3;
    t.bp = 0.55; t.hx = -0.45; t.by = (Math.abs(s) * 0.08 - 0.12) * a; t.hLx = -s * 1.05; t.hRx = s * 1.05; t.kL += 0.2; t.kR += 0.2;
  } else {
    t.sLx = s * 0.8 * a; t.sRx = -s * 0.8 * a; t.eL = -0.9 - Math.max(0, -s) * 0.4; t.eR = -0.9 - Math.max(0, s) * 0.4; t.sLz = 0.1; t.sRz = -0.1; t.hx = -0.08 * a;
  }
}
// mieszanie dwoch póz: t = t*(1-w) + o*w
export function mixPose(t, o, w) { for (const q of POSEK) t[q] += (o[q] - t[q]) * w; }
// ladowanie "superbohatera": przyklek na jednym kolanie, reka podparta o ziemie, glowa do gory
export function heroLandPose(t) {
  t.by = -0.7; t.bp = 0.55; t.spx = 0.2; t.hx = -0.8;
  t.hLx = -1.55; t.kL = 1.95; t.hLz = 0.2; t.fL = 0.2; // noga z przodu: udo poziomo, stopa na ziemi
  t.hRx = 0.55; t.kR = 2.3; t.hRz = -0.25; t.fR = 0.9; // noga z tylu: kolano przy ziemi
  t.sRx = -0.95; t.sRz = -0.3; t.eR = -0.08; // reka podparta na ziemi (prosta w dol)
  t.sLx = 0.9; t.sLz = 0.95; t.eL = -0.3; // druga reka odrzucona do tylu / w bok
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
  { id: 'adv', name: 'ZAAWANSOWANY STRÓJ', lvl: 1, desc: 'Strój, który Peter zaprojektował sam. Lekki, wytrzymały i z wielkim białym pająkiem.', prim: '#a8101a', web: '#170204', sec: '#16204a', logo: '#f2f2f0', logoS: 'big', eye: '#f7f7f7', rim: '#070707', sides: true, stripe: '#c8141c', layout: 'adv', cuff: '#10183a', sole: '#141414', parts: ADV },
  // klasyk z komiksu: czerwien z czarna siatka na calosci, niebieskie boki i nogi, czerwone buty, duze oczy
  { id: 'classic', name: 'KLASYCZNY STRÓJ', lvl: 1, desc: 'Czerwień i błękit, czarna pajęczyna. Tak to się wszystko zaczęło.', prim: '#d3161e', web: '#150000', webAll: true, sec: '#1f46b5', logo: '#0d0d0d', logoS: 'small', eye: '#f4f4f4', eyeK: 1.22, rim: '#111', sides: true, boot: '#c8141c', bootCuff: '#1f46b5', cuff: '#1f46b5', sole: '#2a0a0a', parts: { head: 'p', abd: 'p', pelvis: 's', uarm: 'p', farm: 'p', hand: 'p', thigh: 's', shin: 's', foot: 'p' } },
  // domowy: szara bluza z czerwonymi rekawami, ciemne rekawiczki i tenisowki, gogle z bursztynowymi szkielkami
  { id: 'home', name: 'DOMOWY STRÓJ', lvl: 1, desc: 'Bluza, dresy i gogle. Uszyty w pokoju, ale działa.', prim: '#a8242a', web: '#4a1013', sec: '#6c7076', acc: '#2a2a2e', logo: '#16161a', logoS: 'small', eye: '#d9a441', eyeK: 1.12, rim: '#3a3a40', goggles: true, hoodie: true, pin: false, cuff: '#2a2a2e', belt: null, sole: '#e6e6e0', parts: { head: 'p', abd: 'p', pelvis: 's', uarm: 'p', farm: 'p', hand: 'a', thigh: 's', shin: 's', foot: 'a' } },
  // czarny: gladka czern, biale logo, srebrne wstawki wzdluz bokow i metalowe mankiety
  { id: 'black', name: 'CZARNY STRÓJ', lvl: 2, desc: 'Czarny jak noc, z ogromnym białym pająkiem na piersi.', prim: '#101216', web: '#262a31', sec: '#1b1e24', logo: '#f2f2f2', logoS: 'big', eye: '#f5f5f5', rim: '#000', gloss: true, layout: 'adv', stripe: '#b9c1cc', metal: 'logo', cuff: '#9aa3ae', belt: '#1a1d22', buckle: '#b9c1cc', sole: '#0c0c0e', parts: ALLP },
  { id: 'neg', name: 'NEGATYW', lvl: 2, desc: 'Odwrócone kolory — białe tło i czarna sieć.', prim: '#eeeeee', web: '#111', sec: '#141414', logo: '#111', logoS: 'big', eye: '#1a1a1a', rim: '#eee', layout: 'adv', sides: true, stripe: '#eeeeee', cuff: '#141414', sole: '#e8e8e8', parts: ADV },
  { id: 'miles', name: 'STRÓJ MILESA', lvl: 3, desc: 'Czarny strój z czerwoną pajęczyną.', prim: '#121212', web: '#d0141c', sec: '#19191b', logo: '#d0141c', logoS: 'big', eye: '#f5f5f5', rim: '#000', layout: 'adv', glowLogo: false, boot: '#cf1620', bootCuff: '#e8e8e8', cuff: '#d0141c', sole: '#ececec', parts: ALLP },
  // zelazny pajak: czerwien z zlotymi plytkami (metal), zlote logo i cztery mechaniczne nogi na plecach
  { id: 'iron', name: 'ŻELAZNY PAJĄK', lvl: 3, desc: 'Czerwień i złoto. Metalowe płytki lśnią w słońcu.', prim: '#b3121a', web: '#4a0004', sec: '#d9ab2e', acc: '#d9ab2e', logo: '#e6b93a', logoS: 'big', eye: '#f5f5f5', rim: '#9a7416', sides: true, metal: true, legs: true, cuff: '#d9ab2e', belt: '#d9ab2e', buckle: '#f3d27a', sole: '#3a2a08', parts: { head: 'p', abd: 'p', pelvis: 's', uarm: 'p', farm: 's', hand: 's', thigh: 'p', shin: 's', foot: 's' } },
  // szkarlatny: czerwony kombinezon, granatowa bluza bez rekawow z zamkiem
  { id: 'scarlet', name: 'SZKARŁATNY PAJĄK', lvl: 4, desc: 'Czerwony kombinezon i niebieska bluza bez rękawów.', prim: '#b01218', web: '#3d0003', sec: '#233f8f', logo: '#b01218', logoS: 'big', eye: '#f0f0f0', rim: '#111', chestSec: true, hoodie: true, sole: '#1a1a1a', cuff: '#233f8f', parts: { head: 'p', abd: 's', pelvis: 's', uarm: 'p', farm: 'p', hand: 'p', thigh: 'p', shin: 'p', foot: 'p' } },
  // 2099: granat i czern, czerwone swiecace paski i znak, czerwone oczy
  { id: '2099', name: 'SPIDER-MAN 2099', lvl: 4, desc: 'Strój z przyszłości: granat, czerń i czerwony znak.', prim: '#152461', web: '#0d1a52', sec: '#0a0d1c', logo: '#d4161f', logoS: 'big', eye: '#e21b25', eyeK: 0.95, rim: '#0a0a0a', sides: true, stripe: '#d4161f', glowLogo: true, metal: 'logo', cuff: '#0a0d1c', belt: '#0a0d1c', buckle: '#d4161f', sole: '#0a0a0e', parts: { head: 'p', abd: 's', pelvis: 's', uarm: 'p', farm: 's', hand: 's', thigh: 'p', shin: 'p', foot: 's' } },
  // noir: ciemny garnitur w prazki, skorzany pas
  { id: 'noir', name: 'NOIR', lvl: 5, desc: 'Czarno-biały detektyw z lat trzydziestych.', prim: '#27272a', web: null, sec: '#3a3a3e', acc: '#3a3a3a', logo: '#2e2e2e', logoS: 'none', eye: '#9aa0a6', rim: '#4a4a4a', pin: true, belt: '#4a3320', buckle: '#b79b5a', cuff: '#2e2e2e', sole: '#24160c', parts: { head: 'p', abd: 's', pelvis: 's', uarm: 's', farm: 's', hand: 'p', thigh: 'p', shin: 'p', foot: 'a' } },
  { id: 'anti', name: 'ANTY-VENOM', lvl: 5, desc: 'Biel i czerń, czarna głowa i wielki czarny pająk.', prim: '#efefef', web: '#a9aaae', sec: '#101010', logo: '#101010', logoS: 'big', eye: '#ffffff', rim: '#222', sides: true, cuff: '#101010', sole: '#101010', parts: { head: 's', abd: 's', pelvis: 's', uarm: 'p', farm: 's', hand: 'p', thigh: 's', shin: 'p', foot: 'p' } },
  // toksyczny: czarny z zielona swiecaca siecia, ciemne panele
  { id: 'toxic', name: 'TOKSYCZNY', lvl: 6, desc: 'Świecąca na zielono sieć — widać cię w nocy z daleka.', prim: '#0e1210', web: '#39ff6a', glow: true, sec: '#070908', logo: '#39ff6a', logoS: 'big', eye: '#9dffb5', rim: '#000', layout: 'adv', cuff: '#0b2a14', sole: '#070908', parts: ALLP },
  // zbroja MK II: czern i zolty metal, plytki, pas z klamra
  { id: 'mk', name: 'ZBROJA MK II', lvl: 6, desc: 'Ciężka zbroja w czerni i żółci.', prim: '#1b1b1d', web: '#2d2d30', sec: '#f0c419', logo: '#f0c419', logoS: 'big', eye: '#f0c419', rim: '#111', sides: true, metal: true, glowLogo: true, cuff: '#f0c419', belt: '#f0c419', buckle: '#1b1b1d', sole: '#101010', parts: { head: 'p', abd: 's', pelvis: 'p', uarm: 's', farm: 'p', hand: 'p', thigh: 'p', shin: 's', foot: 'p' } },
  // ukrycie: matowy granat-czern, blekitna swiecaca siec, pas z kieszonkami
  { id: 'stealth', name: 'STRÓJ UKRYCIA', lvl: 7, desc: 'Ciemny strój z błękitną, świecącą pajęczyną.', prim: '#1c2127', web: '#18e0ff', glow: true, sec: '#0e1216', logo: '#18e0ff', logoS: 'big', eye: '#6ff2ff', rim: '#000', layout: 'adv', rough: 0.62, belt: '#0e1216', buckle: '#2b3440', pouch: true, cuff: '#0e1216', sole: '#08090b', parts: ALLP },
  { id: 'gold', name: 'ZŁOTY PAJĄK', lvl: 8, desc: 'Czyste złoto. Nagroda dla najlepszych.', prim: '#d4a52a', web: '#5b4108', sec: '#1a1a1a', logo: '#1a1a1a', logoS: 'big', eye: '#fff', rim: '#111', metal: 'all', layout: 'adv', sides: true, stripe: '#d4a52a', cuff: '#1a1a1a', belt: '#1a1a1a', buckle: '#f3d27a', sole: '#1a1a1a', parts: ADV },
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
