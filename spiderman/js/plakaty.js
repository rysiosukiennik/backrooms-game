// Plakaty, graffiti, naklejki, zacieki (atlas 4x4 po 256 px, tlo przezroczyste) oraz tablice z nazwami ulic.
// Wszystko rysowane na <canvas>; uzywane przez ulica.js jako naklejki na scianach i chodnikach.
import { cv } from './util.js';

// indeksy kafli atlasu
export const DECAL_KINDS = { poster: [0, 1, 2, 3], graffiti: [4, 5, 6, 7, 8], sticker: [9, 10, 11], flyer: [12, 13], stain: [14], streak: [15] };

let _s = 4242;
const R = () => { _s = (_s * 16807) % 2147483647; return (_s - 1) / 2147483646; };
const Rb = (a, b) => a + R() * (b - a);

// postrzepiona krawedz kartki: wycina rogi i brzegi (przezroczyste)
function tear(x, X, Y, w, h) {
  x.save(); x.globalCompositeOperation = 'destination-out'; x.fillStyle = '#000';
  for (let i = 0; i < 9; i++) { const c = Math.floor(R() * 4), s = Rb(6, 26), px = c % 2 ? X + w : X, py = c < 2 ? Y : Y + h; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (c % 2 ? -s : s) * Rb(0.5, 1.3), py); x.lineTo(px, py + (c < 2 ? s : -s) * Rb(0.5, 1.3)); x.fill(); }
  for (let i = 0; i < 26; i++) { const e = Math.floor(R() * 4), t = R(), s = Rb(1.5, 5); const px = e < 2 ? X + t * w : (e === 2 ? X : X + w), py = e < 2 ? (e === 0 ? Y : Y + h) : Y + t * h; x.fillRect(px - s / 2, py - s / 2, s, s); }
  x.restore();
}
// zmieta, wyblakla, zabrudzona kartka: nakladka (tylko tam, gdzie jest kartka)
function age(x, X, Y, w, h) {
  x.save(); x.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < 5; i++) { const px = Rb(X, X + w), py = Rb(Y, Y + h), r = Rb(20, 70), g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, `rgba(70,55,35,${Rb(0.1, 0.3)})`); g.addColorStop(1, 'rgba(70,55,35,0)'); x.fillStyle = g; x.fillRect(X, Y, w, h); }
  x.strokeStyle = 'rgba(0,0,0,.14)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(X + Rb(0, w), Y); x.lineTo(X + Rb(0, w), Y + h); x.stroke(); }
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.beginPath(); x.moveTo(X, Y + Rb(0.3, 0.7) * h); x.lineTo(X + w, Y + Rb(0.3, 0.7) * h); x.stroke();
  for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${Rb(0.04, 0.16)})`; x.fillRect(Rb(X, X + w), Rb(Y, Y + h), 2, 2); }
  x.restore();
}
function drawPoster(x, X, Y, k) {
  const w = 190, h = 238, px = X + 33, py = Y + 9;
  const pal = [['#e8dcc0', '#b8261f', '#1b1c1f'], ['#1d2a4a', '#f2c200', '#f4f1e8'], ['#f1efe6', '#1f6f9c', '#1b1c1f'], ['#2a1a30', '#ff4f9a', '#f4f1e8']][k];
  x.fillStyle = pal[0]; x.fillRect(px, py, w, h);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (k === 0) { // koncert
    x.fillStyle = pal[1]; x.fillRect(px, py, w, 84); x.fillStyle = '#f4f1e8'; x.font = 'bold 40px Impact, Arial'; x.fillText('LIVE', px + w / 2, py + 30); x.font = 'bold 22px Arial'; x.fillText('AT THE BOWERY', px + w / 2, py + 62);
    x.fillStyle = pal[2]; x.beginPath(); x.arc(px + w / 2, py + 148, 40, 0, 7); x.fill(); x.fillStyle = pal[1]; x.beginPath(); x.arc(px + w / 2, py + 148, 14, 0, 7); x.fill();
    x.fillStyle = pal[2]; x.font = 'bold 15px Arial'; x.fillText('FRI  OCT 21  9PM', px + w / 2, py + 214);
  } else if (k === 1) { // wybory
    x.fillStyle = pal[1]; x.font = 'bold 34px Impact, Arial'; x.fillText('VOTE', px + w / 2, py + 40); x.fillStyle = pal[2]; x.fillRect(px + 12, py + 66, w - 24, 100);
    x.fillStyle = '#e0b090'; x.beginPath(); x.arc(px + w / 2, py + 108, 30, 0, 7); x.fill(); x.fillStyle = '#25324f'; x.fillRect(px + w / 2 - 38, py + 140, 76, 26);
    x.fillStyle = pal[1]; x.font = 'bold 18px Arial'; x.fillText('FOR NEW YORK', px + w / 2, py + 192); x.fillStyle = pal[2]; x.font = '13px Arial'; x.fillText('NOV 8', px + w / 2, py + 218);
  } else if (k === 2) { // zaginiony kot
    x.fillStyle = pal[2]; x.font = 'bold 34px Impact, Arial'; x.fillText('LOST CAT', px + w / 2, py + 34);
    x.fillStyle = '#c9a070'; x.beginPath(); x.ellipse(px + w / 2, py + 108, 38, 32, 0, 0, 7); x.fill(); x.beginPath(); x.moveTo(px + w / 2 - 34, py + 88); x.lineTo(px + w / 2 - 28, py + 62); x.lineTo(px + w / 2 - 10, py + 80); x.fill(); x.beginPath(); x.moveTo(px + w / 2 + 34, py + 88); x.lineTo(px + w / 2 + 28, py + 62); x.lineTo(px + w / 2 + 10, py + 80); x.fill();
    x.fillStyle = '#222'; x.beginPath(); x.arc(px + w / 2 - 14, py + 104, 4, 0, 7); x.arc(px + w / 2 + 14, py + 104, 4, 0, 7); x.fill();
    x.fillStyle = pal[2]; x.font = 'bold 16px Arial'; x.fillText('REWARD $200', px + w / 2, py + 170); x.font = '12px Arial'; x.fillText('CALL 555-0142', px + w / 2, py + 196);
    x.fillStyle = pal[1]; for (let i = 0; i < 6; i++) x.fillRect(px + 14 + i * 28, py + h - 22, 18, 22);
  } else { // reklama / klub
    x.fillStyle = pal[1]; x.font = 'bold 30px Impact, Arial'; x.fillText('DAILY BUGLE', px + w / 2, py + 34); x.fillStyle = pal[2]; x.fillRect(px + 10, py + 56, w - 20, 3);
    x.fillStyle = pal[2]; x.font = 'bold 18px Arial'; x.fillText('WALL-CRAWLER', px + w / 2, py + 86); x.fillText('SIGHTED AGAIN?', px + w / 2, py + 110);
    x.fillStyle = '#4a4352'; x.fillRect(px + 14, py + 130, w - 28, 62); x.fillStyle = '#f4f1e8'; for (let i = 0; i < 6; i++) x.fillRect(px + 22, py + 138 + i * 9, Rb(70, w - 52), 3);
    x.fillStyle = pal[1]; x.font = 'bold 14px Arial'; x.fillText('50 CENTS', px + w / 2, py + 216);
  }
  tear(x, px, py, w, h); age(x, px, py, w, h);
}
function drawGraffiti(x, X, Y, k) {
  const cols = [['#ff3b7a', '#1b1c1f'], ['#38d6ff', '#14213a'], ['#ffd23b', '#3a1530'], ['#7dff5b', '#12301a'], ['#ffffff', '#1b1c1f']];
  const [c, o] = cols[(k + Math.floor(R() * 2)) % cols.length], cx = X + 128, cy = Y + 120;
  const words = ['NYC', 'KING', 'ZEST', 'RAZE', 'CROW', 'SKY', 'MOB', 'DEX', 'WILD', 'OZ'];
  const w = words[(k * 2 + Math.floor(R() * 2)) % words.length];
  x.textAlign = 'center'; x.textBaseline = 'middle';
  if (k % 2 === 0) { // tag pismem wlasnym
    x.save(); x.translate(cx, cy); x.rotate(Rb(-0.15, 0.1)); x.font = `italic bold ${w.length > 3 ? 78 : 96}px "Brush Script MT", "Segoe Script", cursive`;
    x.lineJoin = 'round'; x.strokeStyle = o; x.lineWidth = 14; x.strokeText(w, 0, 0); x.fillStyle = c; x.fillText(w, 0, 0);
    x.strokeStyle = 'rgba(255,255,255,.6)'; x.lineWidth = 2; x.strokeText(w, -3, -3); x.restore();
  } else { // pismo "bombowe" z cieniem
    x.save(); x.translate(cx, cy); x.rotate(Rb(-0.12, 0.12)); x.font = `${w.length > 3 ? 82 : 104}px Impact, Arial Black, sans-serif`; x.lineJoin = 'round';
    x.fillStyle = o; x.fillText(w, 7, 7); x.strokeStyle = o; x.lineWidth = 12; x.strokeText(w, 0, 0); x.fillStyle = c; x.fillText(w, 0, 0); x.restore();
  }
  // zacieki farby
  x.fillStyle = c; for (let i = 0; i < 7; i++) { const px = cx + Rb(-95, 95), py = cy + Rb(15, 45), l = Rb(14, 60); x.fillRect(px, py, 3.2, l); x.beginPath(); x.arc(px + 1.6, py + l, 2.6, 0, 7); x.fill(); }
  // przetarcia: dziury w farbie
  x.save(); x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(0,0,0,${Rb(0.2, 0.8)})`; x.fillRect(X + Rb(20, 236), Y + Rb(40, 200), Rb(1, 5), Rb(1, 5)); } x.restore();
}
function drawSticker(x, X, Y, k) {
  const cx = X + 128, cy = Y + 128;
  if (k === 0) { x.fillStyle = '#f2f0e6'; x.beginPath(); x.arc(cx, cy, 80, 0, 7); x.fill(); x.fillStyle = '#d62a2a'; x.beginPath(); x.arc(cx, cy, 62, 0, 7); x.fill(); x.fillStyle = '#f2f0e6'; x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('NO', cx, cy - 12); x.fillText('WAR', cx, cy + 22); }
  else if (k === 1) { x.fillStyle = '#1b1c1f'; x.fillRect(cx - 90, cy - 50, 180, 100); x.fillStyle = '#ffd23b'; x.font = 'bold 44px Impact, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('HELLO', cx, cy - 16); x.font = '18px Arial'; x.fillText('MY NAME IS', cx, cy + 22); }
  else { x.fillStyle = '#3aa86a'; x.beginPath(); x.moveTo(cx, cy - 78); x.lineTo(cx + 70, cy + 52); x.lineTo(cx - 70, cy + 52); x.closePath(); x.fill(); x.fillStyle = '#f2f0e6'; x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('NY', cx, cy + 14); }
  tear(x, cx - 90, cy - 90, 180, 180); age(x, cx - 90, cy - 90, 180, 180);
}
function drawFlyer(x, X, Y, k) {
  const w = 130, h = 180, px = X + 63, py = Y + 38; x.fillStyle = k ? '#f2d95a' : '#f2f0e6'; x.fillRect(px, py, w, h);
  x.fillStyle = '#222'; x.font = 'bold 20px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(k ? 'ROOM' : 'GUITAR', px + w / 2, py + 26); x.fillText(k ? 'FOR RENT' : 'LESSONS', px + w / 2, py + 50);
  for (let i = 0; i < 8; i++) x.fillRect(px + 14, py + 70 + i * 6, Rb(60, 100), 2);
  x.fillStyle = k ? '#b8261f' : '#1f4f9c'; for (let i = 0; i < 7; i++) x.fillRect(px + 8 + i * 17, py + h - 30, 10, 30); // odrywane paski z numerem
  tear(x, px, py, w, h); age(x, px, py, w, h);
}
function drawStain(x, X, Y, k) {
  const cx = X + 128, cy = Y + 128;
  if (k === 0) { // mokra plama / zaciek na ziemi: nieregularna, ciemna
    for (let i = 0; i < 7; i++) { const px = cx + Rb(-50, 50), py = cy + Rb(-50, 50), r = Rb(30, 78), g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(10,10,12,.5)'); g.addColorStop(0.6, 'rgba(10,10,12,.3)'); g.addColorStop(1, 'rgba(10,10,12,0)'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); }
  } else { // zaciek z rynny: pionowa smuga brudu
    const g = x.createLinearGradient(0, Y, 0, Y + 256); g.addColorStop(0, 'rgba(25,22,18,.55)'); g.addColorStop(0.5, 'rgba(25,22,18,.4)'); g.addColorStop(1, 'rgba(25,22,18,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(X + 96, Y); x.lineTo(X + 160, Y); x.lineTo(X + 148, Y + 256); x.lineTo(X + 108, Y + 256); x.closePath(); x.fill();
    for (let i = 0; i < 6; i++) { const px = X + Rb(104, 152); x.fillStyle = `rgba(20,18,15,${Rb(0.08, 0.2)})`; x.fillRect(px, Y, Rb(2, 6), Rb(120, 256)); }
  }
}
let atlas = null;
export function decalAtlas() {
  if (atlas) return atlas;
  const c = cv(1024, 1024), x = c.getContext('2d');
  for (let i = 0; i < 16; i++) {
    const X = (i % 4) * 256, Y = Math.floor(i / 4) * 256; x.save(); x.beginPath(); x.rect(X, Y, 256, 256); x.clip();
    if (i < 4) drawPoster(x, X, Y, i); else if (i < 9) drawGraffiti(x, X, Y, i - 4); else if (i < 12) drawSticker(x, X, Y, i - 9); else if (i < 14) drawFlyer(x, X, Y, i - 12); else drawStain(x, X, Y, i - 14);
    x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; t.premultiplyAlpha = false; return (atlas = t);
}

// tablice z nazwami ulic: 4 kolumny x 18 wierszy, zielona plyta z biala ramka i napisem
export function streetNameTex(names) {
  const CW = 256, CH = 56, c = cv(CW * 4, CH * 18), x = c.getContext('2d');
  names.forEach((n, k) => {
    if (k >= 72) return;
    const X = (k % 4) * CW, Y = Math.floor(k / 4) * CH;
    x.fillStyle = '#1b6b3a'; x.fillRect(X, Y, CW, CH);
    x.strokeStyle = '#eeeeea'; x.lineWidth = 3; x.strokeRect(X + 4, Y + 4, CW - 8, CH - 8);
    x.fillStyle = '#f2f2ee'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px Arial'; x.fillText(n, X + CW / 2, Y + CH / 2 + 1);
    x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(X, Y + CH * 0.8, CW, CH * 0.2);
  });
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
}
