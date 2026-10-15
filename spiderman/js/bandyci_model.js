// Zolnierze Fiska (bandyci): fioletowa obcisla koszulka, szare przedramiona z nitami, czarny tactical harness,
// pas z magazynkami, kabura na udzie, szare spodnie bojowki, czarne buty taktyczne. Warianty: ranged / melee / brute.
// Ta sama "skora" na szkielecie co reszta postaci (build z model.js); tekstury rysowane na canvasie
// (kolor + mapa wypuklosci + mapa normalnych), drobna geometria (pasy, pas, kabura, naramienniki) scalona
// w jedna siatke na kosc z kolorami wierzcholkow.
import { V3, cv, clamp } from './util.js';
import { build, C, noise, ell, tex, drawFace, toGeo, tubeData, smooth, sweepData, normalFromHeight, torsoRings, BODY, TY, AY, LY, HC } from './model.js';

const TAU = Math.PI * 2;
const pick = a => a[Math.floor(Math.random() * a.length)];
const lin = t => { t.encoding = THREE.LinearEncoding; return t; };
const PUR = '#86499f', PUR_D = '#5c2f78', PUR_L = '#a468c0';
const GRY = '#92949b', GRY_D = '#686a71', GRY_L = '#b4b6bd';
const PNT = '#8b8d92', PNT_D = '#66686d', BLK = '#16161a';
const SKINS = ['#e6b996', '#d9a883', '#c68e6a', '#a56f4c', '#f1c9a5'];
const HAIRC = ['#1b1410', '#2a1d12', '#0e0e0e', '#4a3320', '#6e4e2c'];

export function fiskOutfit(kind = 'thug', variant) {
  const brute = kind === 'brute';
  return {
    fisk: brute ? 'brute' : (variant || pick(['ranged', 'melee'])), kind, skin: pick(SKINS), hairCol: pick(HAIRC),
    hair: pick(['mohawk', 'mohawk', 'buzz', 'crop']), beard: 0.85 + Math.random() * 0.15, eyeCol: pick(['#4a5a6a', '#3b2a1c', '#556b4a', '#6a7480']),
    balaclava: !brute && Math.random() < 0.1, scar: Math.random() < 0.4,
  };
}

// ---------------------------------------------------------------- rysowanie
const ln = (c, x0, y0, x1, y1, col, w) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
const seam = (c, b, x0, y0, x1, y1, a = 0.35) => { ln(c, x0, y0, x1, y1, `rgba(0,0,0,${a})`, 1.6); ln(b, x0, y0, x1, y1, '#4c4c4c', 3); };
const stitch = (c, x0, y0, x1, y1, col = 'rgba(210,205,190,.55)') => { c.save(); c.setLineDash([3, 2.5]); ln(c, x0, y0, x1, y1, col, 1); c.restore(); };
const rivet = (c, b, px, py, r = 2.3) => {
  c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(px + 0.6, py + 0.8, r + 0.5, 0, TAU); c.fill();
  c.fillStyle = '#c9ccd2'; c.beginPath(); c.arc(px, py, r, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.arc(px - r * 0.3, py - r * 0.3, r * 0.4, 0, TAU); c.fill();
  b.fillStyle = '#fff'; b.beginPath(); b.arc(px, py, r, 0, TAU); b.fill();
};
const weave = (c, x0, y0, w, h, a) => { c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip(); c.strokeStyle = `rgba(0,0,0,${a})`; c.lineWidth = 1; for (let i = -h; i < w; i += 3) { c.beginPath(); c.moveTo(x0 + i, y0); c.lineTo(x0 + i + h, y0 + h); c.stroke(); } c.restore(); };
const blurDo = (c, px, fn) => { c.save(); c.filter = `blur(${px}px)`; fn(); c.restore(); };
const poly = (c, P) => { c.beginPath(); P.forEach(([a, b], i) => i ? c.lineTo(a, b) : c.moveTo(a, b)); c.closePath(); };
function patch(c, b, cx, cy, w, h, rot, mirror) { // naszywka FISK
  c.save(); c.translate(cx, cy); c.rotate(rot); if (mirror) c.scale(-1, 1);
  c.fillStyle = '#9b92b3'; c.fillRect(-w / 2, -h / 2, w, h); c.strokeStyle = '#2a2433'; c.lineWidth = 1.4; c.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2);
  c.fillStyle = '#f2f0f6'; c.font = `bold ${Math.round(h * 0.62)}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FISK', 0, 1);
  c.restore();
  b.save(); b.translate(cx, cy); b.rotate(rot); b.fillStyle = '#b0b0b0'; b.fillRect(-w / 2, -h / 2, w, h); b.strokeStyle = '#555'; b.lineWidth = 2; b.strokeRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2); b.restore();
}

function torsoTex(o) {
  const T = C(512, 512), TB = C(512, 512), x = T.x, b = TB.x, brute = o.fisk === 'brute', yb = TY(0.99);
  b.fillStyle = '#808080'; b.fillRect(0, 0, 512, 512); noise(b, 512, 512, 14000, 0.1);
  // koszulka
  x.fillStyle = PUR; x.fillRect(0, 0, 512, yb); weave(x, 0, 0, 512, yb, 0.05);
  let g = x.createLinearGradient(0, TY(1.5), 0, yb); g.addColorStop(0, 'rgba(160,110,210,.14)'); g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,0,35,.28)');
  x.fillStyle = g; x.fillRect(0, TY(1.5), 512, yb - TY(1.5));
  // miesnie pod obcisla koszulka: dolna krawedz piersi, kaloryfer, linia posrodku
  for (const sd of [-1, 1]) {
    blurDo(x, 3.5, () => { x.strokeStyle = 'rgba(22,4,38,.5)'; x.lineWidth = 7; x.beginPath(); x.moveTo(256 + sd * 6, TY(1.31)); x.quadraticCurveTo(256 + sd * 56, TY(1.19), 256 + sd * 104, TY(1.27)); x.stroke();
      x.strokeStyle = 'rgba(200,150,240,.2)'; x.lineWidth = 9; x.beginPath(); x.moveTo(256 + sd * 10, TY(1.36)); x.quadraticCurveTo(256 + sd * 60, TY(1.31), 256 + sd * 100, TY(1.34)); x.stroke(); });
    blurDo(x, 2, () => { x.strokeStyle = 'rgba(22,4,38,.32)'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { const y = TY(1.15 - i * 0.055); x.beginPath(); x.moveTo(256 + sd * 8, y); x.quadraticCurveTo(256 + sd * 28, y + 4, 256 + sd * 46, y - 2); x.stroke(); } });
    blurDo(b, 3, () => { b.strokeStyle = '#6a6a6a'; b.lineWidth = 6; b.beginPath(); b.moveTo(256 + sd * 6, TY(1.31)); b.quadraticCurveTo(256 + sd * 56, TY(1.19), 256 + sd * 104, TY(1.27)); b.stroke(); });
  }
  blurDo(x, 2, () => ln(x, 256, TY(1.3), 256, yb, 'rgba(22,4,38,.3)', 3));
  // zagniecenia przy pasie i pod pacha
  x.strokeStyle = 'rgba(22,4,38,.22)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const sd = i % 2 ? 1 : -1, y = TY(1.07) - i * 3; x.beginPath(); x.moveTo(256 + sd * (30 + i * 9), y + 14); x.quadraticCurveTo(256 + sd * (60 + i * 8), y, 256 + sd * (96 + i * 7), y + 8); x.stroke(); }
  // szary karczek na ramionach z nitami
  for (const cx of [128, 384]) {
    const Y0 = TY(1.552), Y1 = TY(1.405);
    x.fillStyle = GRY; poly(x, [[cx - 74, Y0], [cx + 74, Y0], [cx + 74, Y1 - 6], [cx + 34, Y1 + 8], [cx - 34, Y1 + 8], [cx - 74, Y1 - 6]]); x.fill();
    weave(x, cx - 74, Y0, 148, Y1 - Y0 + 8, 0.07);
    b.fillStyle = '#8a8a8a'; poly(b, [[cx - 74, Y0], [cx + 74, Y0], [cx + 74, Y1 - 6], [cx + 34, Y1 + 8], [cx - 34, Y1 + 8], [cx - 74, Y1 - 6]]); b.fill();
    x.save(); x.setLineDash([3, 2.5]); x.strokeStyle = 'rgba(0,0,0,.45)'; x.lineWidth = 1.8; x.beginPath(); x.moveTo(cx - 74, Y1 - 6); x.lineTo(cx - 34, Y1 + 8); x.lineTo(cx + 34, Y1 + 8); x.lineTo(cx + 74, Y1 - 6); x.stroke(); x.restore();
    b.strokeStyle = '#4a4a4a'; b.lineWidth = 3; b.beginPath(); b.moveTo(cx - 74, Y1 - 6); b.lineTo(cx - 34, Y1 + 8); b.lineTo(cx + 34, Y1 + 8); b.lineTo(cx + 74, Y1 - 6); b.stroke();
    for (let k = 0; k < 6; k++) rivet(x, b, cx - 60 + k * 24, Y1 + (k === 0 || k === 5 ? -5 : k === 1 || k === 4 ? 1 : 6), 2.2);
    x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(cx - 74, Y0, 148, 6);
  }
  // szyja (skora) i rowkowany kolnierz
  x.fillStyle = o.skin; x.fillRect(0, 0, 512, TY(1.556));
  x.fillStyle = PUR_D; x.fillRect(0, TY(1.556), 512, 14);
  x.fillStyle = 'rgba(0,0,0,.35)'; for (let a = 0; a < 512; a += 4) x.fillRect(a, TY(1.556), 1.5, 14);
  b.fillStyle = '#a0a0a0'; b.fillRect(0, TY(1.556), 512, 14);
  // naszywka FISK na piersi (lewa strona postaci)
  patch(x, b, 256 - 92, TY(1.37), 40, 15, 0, true);
  // pas (czarny, pod geometria pasa) i spodnie
  x.fillStyle = BLK; x.fillRect(0, yb - 4, 512, TY(0.955) - yb + 4);
  stitch(x, 0, yb + 1, 512, yb + 1); stitch(x, 0, TY(0.955) - 3, 512, TY(0.955) - 3);
  x.fillStyle = PNT; x.fillRect(0, TY(0.955), 512, 512);
  g = x.createLinearGradient(0, TY(0.955), 0, 512); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, TY(0.955), 512, 512);
  weave(x, 0, TY(0.955), 512, 512 - TY(0.955), 0.06);
  for (const px of [30, 90, 196, 316, 422, 482]) { x.fillStyle = BLK; x.fillRect(px - 3, yb - 6, 7, TY(0.95) - yb + 10); b.fillStyle = '#c0c0c0'; b.fillRect(px - 3, yb - 6, 7, TY(0.95) - yb + 10); } // szlufki
  seam(x, b, 256, TY(0.955), 256, TY(0.84), 0.4); stitch(x, 262, TY(0.955), 262, TY(0.86), 'rgba(0,0,0,.4)');
  x.fillStyle = '#8c8e94'; ell(x, 256, TY(0.962), 4, 4);
  for (const sd of [-1, 1]) { x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(256 + sd * 32, TY(0.955)); x.quadraticCurveTo(256 + sd * 46, TY(0.9), 256 + sd * 70, TY(0.88)); x.stroke(); b.strokeStyle = '#4a4a4a'; b.lineWidth = 3; b.beginPath(); b.moveTo(256 + sd * 32, TY(0.955)); b.quadraticCurveTo(256 + sd * 46, TY(0.9), 256 + sd * 70, TY(0.88)); b.stroke(); }
  for (const sx of [128, 384]) { seam(x, b, sx, TY(1.4), sx, yb, 0.22); seam(x, b, sx, TY(0.955), sx, 512, 0.25); }
  if (brute) { // kamizelka kuloodporna na koszulce: przod i tyl, pasy MOLLE
    const VC = '#2d2e34', pieces = [[158, 354], [-4, 98], [414, 516]];
    for (const [a, c] of pieces) {
      x.fillStyle = VC; x.fillRect(a, TY(1.5), c - a, yb - TY(1.5) - 2);
      g = x.createLinearGradient(0, TY(1.5), 0, yb); g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,.25)'); x.fillStyle = g; x.fillRect(a, TY(1.5), c - a, yb - TY(1.5));
      b.fillStyle = '#909090'; b.fillRect(a, TY(1.5), c - a, yb - TY(1.5) - 2);
      for (let y = TY(1.42); y < yb - 14; y += 15) for (let px = a + 7; px < c - 8; px += 14) { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(px, y, 8, 3); b.fillStyle = '#404040'; b.fillRect(px, y, 8, 3); }
      x.strokeStyle = 'rgba(160,160,168,.5)'; x.lineWidth = 1.5; x.strokeRect(a + 3, TY(1.5) + 3, c - a - 6, yb - TY(1.5) - 8);
      b.strokeStyle = '#4a4a4a'; b.lineWidth = 3; b.strokeRect(a + 1, TY(1.5) + 1, c - a - 2, yb - TY(1.5) - 4);
    }
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(240, TY(1.5), 32, yb - TY(1.5)); b.fillStyle = '#505050'; b.fillRect(240, TY(1.5), 32, yb - TY(1.5)); // zamek posrodku
    for (let y = TY(1.46); y < yb - 6; y += 7) { x.fillStyle = '#9a9ca2'; x.fillRect(254, y, 4, 2); }
  }
  // pot, brud, szum
  blurDo(x, 8, () => { x.fillStyle = 'rgba(15,0,28,.28)'; ell(x, 256, TY(1.28), 36, 60); ell(x, 8, TY(1.24), 36, 70); ell(x, 504, TY(1.24), 36, 70); });
  noise(x, 512, 512, 7000, 0.045);
  return { T, TB };
}

function armTex(o) {
  const A = C(256, 512), AB = C(256, 512), x = A.x, b = AB.x, brute = o.fisk === 'brute';
  b.fillStyle = '#808080'; b.fillRect(0, 0, 256, 512); noise(b, 256, 512, 7000, 0.1);
  x.fillStyle = GRY; x.fillRect(0, 0, 256, 512); weave(x, 0, 0, 256, 512, 0.06);
  const yE = AY(-0.28), yS = AY(-0.02);
  // fioletowy panel na gornej czesci reki (przod i wnetrze), szare boki
  const P = [[98, yS], [238, yS], [244, yE - 14], [232, yE + 6], [104, yE + 6], [92, yE - 14]];
  x.fillStyle = PUR; poly(x, P); x.fill(); weave(x, 90, yS, 160, yE - yS + 6, 0.05);
  b.fillStyle = '#7c7c7c'; poly(b, P); b.fill();
  x.save(); x.setLineDash([3, 2.5]); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1.8; poly(x, P); x.stroke(); x.restore();
  b.strokeStyle = '#4a4a4a'; b.lineWidth = 3; poly(b, P); b.stroke();
  for (let k = 0; k < 8; k++) { const py = yS + 12 + k * ((yE - yS - 24) / 7); rivet(x, b, 92 + (k % 2) * 1.5, py, 2); rivet(x, b, 241, py, 2); }
  // mankiet-sciagacz przy lokciu, nity, wzmocnienie lokcia
  x.fillStyle = GRY_D; x.fillRect(0, yE + 6, 256, 9); b.fillStyle = '#6a6a6a'; b.fillRect(0, yE + 6, 256, 9);
  for (let px = 12; px < 256; px += 30) rivet(x, b, px, yE + 10.5, 1.8);
  for (const px of [4, 252]) { x.fillStyle = 'rgba(0,0,0,.25)'; ell(x, px, yE, 26, 34); }
  // przedramie: szwy, zagniecenia, czarny mankiet
  for (const px of [66, 190]) seam(x, b, px, yE + 15, px, AY(-0.47), 0.3);
  x.strokeStyle = 'rgba(0,0,0,.2)'; x.lineWidth = 2; for (let i = 0; i < 6; i++) { const y = yE + 24 + i * 8; x.beginPath(); x.moveTo(80 + i * 3, y); x.quadraticCurveTo(128, y + 6, 176 - i * 3, y); x.stroke(); }
  const yC = AY(-0.495); x.fillStyle = '#2b2c31'; x.fillRect(0, yC, 256, 512 - yC); x.fillStyle = 'rgba(0,0,0,.4)'; for (let a = 0; a < 256; a += 4) x.fillRect(a, yC, 1.5, 512 - yC);
  b.fillStyle = '#a8a8a8'; b.fillRect(0, yC, 256, 512 - yC);
  // naszywka FISK na zewnetrznej stronie barku (tekst wzdluz reki)
  patch(x, b, 64, AY(0.02) + 40, 62, 17, Math.PI / 2, false);
  for (const px of [18, 110, 200]) rivet(x, b, px, AY(0.045) + 5, 1.8);
  if (brute) { x.fillStyle = 'rgba(20,30,40,.55)'; x.font = 'bold 26px serif'; x.fillText('✠', 120, yE + 70); } // tatuaz na przedramieniu
  noise(x, 256, 512, 3500, 0.05);
  return { A, AB };
}

function legTex(o) {
  const G = C(256, 512), GB = C(256, 512), x = G.x, b = GB.x;
  b.fillStyle = '#808080'; b.fillRect(0, 0, 256, 512); noise(b, 256, 512, 8000, 0.11);
  x.fillStyle = PNT; x.fillRect(0, 0, 256, 512); weave(x, 0, 0, 256, 512, 0.07);
  x.strokeStyle = 'rgba(0,0,0,.07)'; x.lineWidth = 1; for (let a = 0; a < 256; a += 6) { x.beginPath(); x.moveTo(a, 0); x.lineTo(a, 512); x.stroke(); }
  for (const px of [64, 192]) seam(x, b, px, 0, px, 512, 0.28);
  // duza kieszen cargo na udzie (z klapa, rzepem i guzikiem) na zewnetrznej stronie
  const p0 = LY(-0.12), p1 = LY(-0.43), fl = 30;
  x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(26, p0, 76, p1 - p0);
  b.fillStyle = '#9a9a9a'; b.fillRect(26, p0, 76, p1 - p0); b.strokeStyle = '#3c3c3c'; b.lineWidth = 4; b.strokeRect(26, p0, 76, p1 - p0);
  stitch(x, 29, p0 + fl + 4, 29, p1 - 3, 'rgba(0,0,0,.4)'); stitch(x, 99, p0 + fl + 4, 99, p1 - 3, 'rgba(0,0,0,.4)');
  x.fillStyle = PNT_D; x.fillRect(24, p0, 80, fl); b.fillStyle = '#b8b8b8'; b.fillRect(24, p0, 80, fl);
  poly(x, [[24, p0 + fl], [104, p0 + fl], [64, p0 + fl + 7]]); x.fill();
  stitch(x, 27, p0 + 4, 101, p0 + 4, 'rgba(0,0,0,.45)'); ln(x, 24, p0 + fl, 104, p0 + fl, 'rgba(0,0,0,.5)', 2);
  x.fillStyle = '#2b2b2e'; ell(x, 64, p0 + fl - 3, 4.5, 4.5); x.fillStyle = 'rgba(255,255,255,.25)'; ell(x, 63, p0 + fl - 4, 1.5, 1.5);
  b.fillStyle = '#d0d0d0'; ell(b, 64, p0 + fl - 3, 4.5, 4.5);
  // mala kieszen u gory, wzmocnienia kolan z przeszyciami, zagniecenia
  x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(36, LY(0.02), 56, 18); stitch(x, 36, LY(0.02) + 18, 92, LY(0.02) + 18, 'rgba(0,0,0,.4)');
  const ky = LY(-0.44); x.fillStyle = PNT_D; poly(x, [[96, ky - 30], [162, ky - 30], [166, ky + 4], [128, ky + 22], [92, ky + 4]]); x.fill();
  b.fillStyle = '#9a9a9a'; poly(b, [[96, ky - 30], [162, ky - 30], [166, ky + 4], [128, ky + 22], [92, ky + 4]]); b.fill();
  x.save(); x.setLineDash([3, 2.5]); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1.5; poly(x, [[96, ky - 30], [162, ky - 30], [166, ky + 4], [128, ky + 22], [92, ky + 4]]); x.stroke(); x.restore();
  for (let i = 0; i < 7; i++) { const y = ky - 14 + i * 5; x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2; x.beginPath(); x.moveTo(20 + i * 3, y + 6); x.quadraticCurveTo(128, y - 5, 236 - i * 3, y + 6); x.stroke(); }
  for (let i = 0; i < 6; i++) { const y = LY(-0.77) + i * 6; x.strokeStyle = 'rgba(0,0,0,.24)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(16 + i * 5, y); x.quadraticCurveTo(128, y - 8, 240 - i * 5, y); x.stroke(); b.strokeStyle = '#555'; b.lineWidth = 3; b.beginPath(); b.moveTo(16 + i * 5, y); b.quadraticCurveTo(128, y - 8, 240 - i * 5, y); b.stroke(); } // nogawka nad butem
  const gy = x.createLinearGradient(0, LY(-0.72), 0, 512); gy.addColorStop(0, 'rgba(40,30,20,0)'); gy.addColorStop(1, 'rgba(40,30,20,.4)'); x.fillStyle = gy; x.fillRect(0, LY(-0.72), 256, 512 - LY(-0.72));
  blurDo(x, 7, () => { x.fillStyle = 'rgba(30,22,14,.22)'; ell(x, 128, ky, 44, 34); });
  noise(x, 256, 512, 5000, 0.05);
  return { G, GB };
}

function bootTex(o) {
  const Sh = C(256, 128), x = Sh.x;
  x.fillStyle = '#18181b'; x.fillRect(0, 0, 256, 128); noise(x, 256, 128, 1300, 0.12);
  x.fillStyle = '#0b0b0d'; x.fillRect(18, 0, 92, 128); // podeszwa / bok
  x.strokeStyle = 'rgba(170,170,176,.45)'; x.lineWidth = 1.4; x.setLineDash([3, 2]); for (const px of [14, 114]) { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 128); x.stroke(); } x.setLineDash([]);
  x.fillStyle = '#8a8a90'; for (let v = 30; v < 104; v += 11) for (const px of [176, 206]) { x.beginPath(); x.arc(px, v, 2, 0, TAU); x.fill(); }
  x.strokeStyle = '#3a3a3f'; x.lineWidth = 2; for (let v = 30; v < 104; v += 11) { x.beginPath(); x.moveTo(176, v); x.lineTo(206, v + 11); x.moveTo(206, v); x.lineTo(176, v + 11); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.1)'; ell(x, 192, 8, 30, 7);
  return Sh;
}

// twarz: surowe rysy, zmarszczki, gesta broda, rzadko kominiarka
function faceTex(o) {
  const Hd = C(512, 256), x = Hd.x;
  drawFace(x, { skin: o.skin, hair: 'buzz', hairCol: o.hairCol, angry: true, beard: 0, browCol: o.hairCol, eyeCol: o.eyeCol });
  x.fillStyle = o.skin; for (let i = 0; i < 5000; i++) { x.globalAlpha = 0.2 + Math.random() * 0.25; x.fillRect(Math.random() * 512, Math.random() * 84, 1.5, 1.5); } x.globalAlpha = 1; // krotkie wlosy: skora przebija
  x.lineCap = 'round';
  const L = (a, col, w) => { x.strokeStyle = col; x.lineWidth = w; };
  for (let i = 0; i < 3; i++) { const y = 89 + i * 7; L(0, `rgba(60,30,20,${0.26 - i * 0.04})`, 1.5); x.beginPath(); x.moveTo(214 + i * 3, y); x.quadraticCurveTo(256, y - 3, 298 - i * 3, y); x.stroke(); }
  L(0, 'rgba(55,25,18,.32)', 1.6); x.beginPath(); x.moveTo(250, 103); x.lineTo(249, 114); x.moveTo(262, 103); x.lineTo(263, 114); x.stroke();
  for (const sd of [-1, 1]) {
    const X = 256 + sd * 30;
    L(0, 'rgba(60,30,20,.22)', 1.2); for (let i = -1; i <= 1; i++) { x.beginPath(); x.moveTo(X + sd * 12, 121 + i * 2); x.lineTo(X + sd * 26, 121 + i * 7 - 2); x.stroke(); } // kurze lapki
    L(0, 'rgba(70,35,40,.2)', 2.4); x.beginPath(); x.moveTo(X - sd * 11, 128.5); x.quadraticCurveTo(X, 133, X + sd * 11, 128.5); x.stroke(); // worki pod oczami
    L(0, 'rgba(50,20,15,.3)', 2.2); x.beginPath(); x.moveTo(256 + sd * 17, 138); x.quadraticCurveTo(256 + sd * 30, 150, 256 + sd * 24, 164); x.stroke(); // bruzdy nosowo-wargowe
    x.save(); x.filter = 'blur(6px)'; x.fillStyle = 'rgba(50,25,15,.22)'; ell(x, 256 + sd * 60, 152, 16, 20); x.restore(); // zapadniete policzki
  }
  if (o.scar) { L(0, 'rgba(60,20,20,.55)', 2.8); x.beginPath(); x.moveTo(298, 96); x.lineTo(312, 129); x.stroke(); L(0, 'rgba(225,165,150,.7)', 1.2); x.beginPath(); x.moveTo(298, 96); x.lineTo(312, 129); x.stroke(); }
  // gesta broda i wasy
  if (o.beard > 0) {
    const B = [[176, 120], [196, 138], [222, 146], [240, 141], [256, 143], [272, 141], [290, 146], [316, 138], [336, 120], [342, 150], [328, 184], [294, 205], [256, 214], [218, 205], [184, 184], [170, 150]];
    x.save(); x.filter = 'blur(4px)'; x.fillStyle = 'rgba(22,15,9,.5)'; x.beginPath(); B.forEach(([a, c], i) => i ? x.lineTo(a, c) : x.moveTo(a, c)); x.closePath(); x.fill(); x.restore();
    x.fillStyle = o.hairCol; for (let i = 0; i < 9000 * o.beard; i++) { const px = 164 + Math.random() * 184, py = 114 + Math.random() * 106; const e = ((px - 256) / 92) ** 2 + ((py - 172) / 54) ** 2; if (e > 1 || Math.random() > Math.min(1, (1 - e) * 3.2) || (Math.abs(px - 256) < 16 && py > 150 && py < 160) || (py < 138 && Math.abs(px - 256) < 56)) continue; x.globalAlpha = 0.4 + Math.random() * 0.45; x.fillRect(px, py, 1.4, 1.9); }
    x.globalAlpha = 0.16; x.fillStyle = '#fff'; for (let i = 0; i < 400; i++) x.fillRect(176 + Math.random() * 160, 140 + Math.random() * 66, 1, 1.6); x.globalAlpha = 1;
    x.fillStyle = 'rgba(150,70,60,.55)'; ell(x, 256, 156, 12, 2.8); x.strokeStyle = 'rgba(40,12,8,.8)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(243, 154.5); x.quadraticCurveTo(256, 156.5, 269, 154.5); x.stroke();
  }
  if (o.balaclava) { // czarna kominiarka z wycieciem na oczy i usta
    x.fillStyle = '#121214'; x.beginPath(); x.rect(0, 0, 512, 256);
    if (x.roundRect) x.roundRect(196, 104, 120, 34, 12); else x.rect(196, 104, 120, 34);
    x.ellipse(256, 156, 16, 8, 0, 0, TAU); x.fill('evenodd');
    x.fillStyle = 'rgba(255,255,255,.07)'; for (let a = 0; a < 512; a += 4) x.fillRect(a, 0, 1.5, 256);
  }
  return Hd;
}

const texCache = new Map();
function fiskTextures(o) {
  const key = o.fisk + '|' + o.skin;
  if (texCache.has(key)) return texCache.get(key);
  const t = torsoTex(o), a = armTex(o), g = legTex(o);
  const r = { T: t.T, TB: t.TB, A: a.A, AB: a.AB, G: g.G, GB: g.GB, Sh: bootTex(o) };
  texCache.set(key, r); return r;
}
const matCache = new Map();
function fiskMats(o) {
  const key = o.fisk + '|' + o.skin;
  let M = matCache.get(key);
  if (!M) {
    const c = fiskTextures(o), nm = (hc, k) => lin(tex(normalFromHeight(hc.c, k)));
    const mat = (cc, hc, rough, ns) => { const m = new THREE.MeshStandardMaterial({ map: tex(cc), normalMap: nm(hc, 3.2), roughness: rough }); m.normalScale.set(ns, ns); return m; };
    M = matCache.get(key) || { torso: mat(c.T, c.TB, 0.78, 1), arm: mat(c.A, c.AB, 0.8, 1), leg: mat(c.G, c.GB, 0.88, 1.1), foot: new THREE.MeshStandardMaterial({ map: tex(c.Sh), roughness: 0.55 }),
      hand: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.68 }), gear: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.15 }) };
    matCache.set(key, M);
  }
  // twarz i wlosy sa losowe (bez cache)
  return { ...M, head: new THREE.MeshStandardMaterial({ map: tex(faceTex(o)), roughness: 0.62 }), skin: new THREE.MeshStandardMaterial({ color: o.balaclava ? '#121214' : o.skin, roughness: 0.7 }),
    hair: new THREE.MeshStandardMaterial({ color: o.hairCol, roughness: 0.9 }) };
}

// ---------------------------------------------------------------- geometria drobnych elementow
function mergeGeos(items) { // items: [{ g, col }] -> jedna siatka z kolorami wierzcholkow
  const P = [], N = [], U = [], Cc = [], col = new THREE.Color();
  for (const { g, col: hex } of items) {
    const n = g.index ? g.toNonIndexed() : g; col.set(hex); const cnt = n.attributes.position.count;
    P.push(...n.attributes.position.array); N.push(...n.attributes.normal.array); U.push(...(n.attributes.uv ? n.attributes.uv.array : new Array(cnt * 2).fill(0)));
    for (let i = 0; i < cnt; i++) Cc.push(col.r, col.g, col.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  return g;
}
const _M4 = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _E = new THREE.Euler(), _P = new V3(), _S = new V3();
function xf(g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) { _E.set(r[0], r[1], r[2], 'XYZ'); _Q.setFromEuler(_E); _P.set(...p); _S.set(...s); return g.applyMatrix4(_M4.compose(_P, _Q, _S)); }
const box = (w, h, d, p, r, hex) => ({ g: xf(new THREE.BoxGeometry(w, h, d), p, r), col: hex });
function tubeGeo(pts, rad, segs, ref, n) { const g = toGeo(sweepData(pts, rad, segs, ref, n)); return g; }

// z powierzchni tulowia (przod/tyl) na wysokosci y dla danego x
function torsoSurf(rings, y, x, front) {
  let k = 0; while (k < rings.length - 2 && rings[k + 1].y < y) k++;
  const a = rings[k], b = rings[k + 1], t = clamp((y - a.y) / (b.y - a.y || 1), 0, 1), zs = [];
  for (const r of [a, b]) {
    const ex = Math.min(0.985, Math.abs(x) / r.rx), n = r.n, ez = Math.pow(Math.max(0, 1 - Math.pow(ex, n)), 1 / n), s2 = Math.pow(ez, n / 2) ** 2 || 0, c = Math.pow(ex, n / 2);
    let rz = r.rz;
    if (front) { rz *= 1 + r.fb * s2; if (r.pec) rz *= 1 + r.pec * Math.exp(-(((c - 0.42) / 0.2) ** 2)) * Math.sqrt(s2); zs.push(r.cz + rz * ez); }
    else { rz *= 1 + r.bb * s2; zs.push(r.cz - rz * ez); }
  }
  return zs[0] + (zs[1] - zs[0]) * t;
}

function addFiskGear(H, o, b, kind) {
  const brute = o.fisk === 'brute', rings = smooth(torsoRings(b), 3), items = [], limb = { shL: [], shR: [], hipR: [], hipL: [] };
  const sp = new V3().setFromMatrixPosition(H.spine.matrixWorld), ch = new V3().setFromMatrixPosition(H.chest.matrixWorld);
  const GRN = 0.0, ST = '#17171a', ST2 = '#222226', MET = '#8d9096', DK = '#101012';
  const strap = (sd, topY) => { // pas szelek: przez ramie, w dol przodem i tylem do pasa
    const pts = [];
    const xAt = (y, front) => sd * (front ? 0.072 - (1.5 - y) * 0.03 : 0.07 - (1.5 - y) * 0.05);
    for (let y = 1.0; y <= 1.5; y += 0.05) { const x = xAt(y, true); pts.push(new V3(x, y, torsoSurf(rings, y, x, true) + 0.006)); }
    for (const [y, f] of [[1.535, 0.35], [1.558, 0], [1.535, -0.35]]) { const x = sd * 0.074; pts.push(new V3(x, y, f > 0 ? torsoSurf(rings, 1.5, x, true) * f : f < 0 ? torsoSurf(rings, 1.5, x, false) * -f : 0.0)); }
    for (let y = 1.5; y >= 1.0; y -= 0.05) { const x = xAt(y, false); pts.push(new V3(x, y, torsoSurf(rings, y, x, false) - 0.006)); }
    return tubeGeo(pts, pts.map(() => [0.006, 0.019]), 8, new V3(1, 0, 0), 4);
  };
  if (!brute) {
    for (const sd of [-1, 1]) items.push({ g: strap(sd), col: ST });
    const zc = torsoSurf(rings, 1.31, 0.0, true) + 0.007, cp = []; // pasek piersiowy poprzecznie
    for (let x = -0.082; x <= 0.082; x += 0.0164) cp.push(new V3(x, 1.31 - Math.abs(x) * 0.1, torsoSurf(rings, 1.31, x, true) + 0.007));
    items.push({ g: tubeGeo(cp, cp.map(() => [0.0045, 0.009]), 6, new V3(0, 1, 0), 4), col: ST });
    items.push(box(0.03, 0.026, 0.01, [0, 1.31, zc + 0.004], [0, 0, 0], MET));
    for (const sd of [-1, 1]) items.push(box(0.022, 0.03, 0.012, [sd * 0.072, 1.5 - 0.024 + 0.01, torsoSurf(rings, 1.47, sd * 0.072, true) + 0.01], [0.15, 0, 0], ST2)); // klamry na obojczykach
  } else { // plyty kamizelki i naramienne wzmocnienia
    const zf = torsoSurf(rings, 1.31, 0, true), zb = torsoSurf(rings, 1.31, 0, false);
    items.push(box(0.25, 0.24, 0.026, [0, 1.3, zf + 0.008], [0, 0, 0], '#34353b'), box(0.2, 0.2, 0.012, [0, 1.3, zf + 0.022], [0, 0, 0], '#3d3e44'), box(0.25, 0.24, 0.024, [0, 1.3, zb - 0.008], [0, 0, 0], '#34353b'));
    items.push(box(0.2, 0.05, 0.03, [0, 1.12, zf + 0.018], [0, 0, 0], '#26272c')); // kieszen dolna
    for (const x of [-0.07, 0, 0.07]) items.push(box(0.058, 0.07, 0.036, [x, 1.09, zf + 0.04], [0, 0, 0], '#222327')); // magazynki
    for (const sd of [-1, 1]) items.push(box(0.04, 0.2, 0.045, [sd * 0.115, 1.43, torsoSurf(rings, 1.43, 0.115, true) - 0.04], [0, 0, sd * -0.5], '#2a2b30')); // paski barkowe
  }
  // pas
  const bp = [], N = 36, rb = rings.reduce((a, r) => Math.abs(r.y - 1.0) < Math.abs(a.y - 1.0) ? r : a);
  for (let i = 0; i <= N; i++) {
    const a = i / N * TAU, c = Math.cos(a), s = Math.sin(a), ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / rb.n), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / rb.n);
    bp.push(new V3(rb.cx + (rb.rx + 0.007) * ex, 1.0, rb.cz + (rb.rz * (s > 0 ? 1 + rb.fb * s * s : 1 + rb.bb * s * s) + 0.007) * ez));
  }
  items.push({ g: tubeGeo(bp, bp.map(() => [0.006, 0.028]), 4, new V3(0, 1, 0), 4), col: BLK });
  const zb0 = torsoSurf(rings, 1.0, 0, true);
  items.push(box(0.056, 0.046, 0.012, [0, 1.0, zb0 + 0.012], [0, 0, 0], MET), box(0.032, 0.026, 0.014, [0, 1.0, zb0 + 0.014], [0, 0, 0], DK));
  // magazynki na pasie (lewa strona postaci = +x) i maly woreczek z tylu
  for (let i = 0; i < 2; i++) { const x = 0.062 + i * 0.045, z = torsoSurf(rings, 1.0, x, true); items.push(box(0.042, 0.082, 0.034, [x, 0.99, z + 0.021 - i * 0.005], [-0.1, i * -0.12, 0], '#1b1b1f'), box(0.036, 0.016, 0.03, [x, 1.032, z + 0.023 - i * 0.005], [-0.1, i * -0.12, 0], '#2b2b30'));
    for (let m = 0; m < 2; m++) items.push(box(0.01, 0.01, 0.02, [x - 0.008 + m * 0.016, 1.045, z + 0.02 - i * 0.005], [-0.1, 0, 0], '#6a6c72')); }
  items.push(box(0.07, 0.06, 0.03, [0.0, 0.99, torsoSurf(rings, 1.0, 0, false) - 0.02], [0, 0, 0], '#1b1b1f'));
  const g = mergeGeos(items); g.translate(-sp.x, -sp.y, -sp.z);
  const m = new THREE.Mesh(g, H.M.gear); m.castShadow = true; H.spine.add(m);
  // kabura na prawym udzie (rangeed) / pałka przypieta (melee) + ochraniacze brute
  const hp = new V3().setFromMatrixPosition(H.hipR.matrixWorld);
  const li = [];
  if (o.fisk === 'ranged') {
    const hx = -0.19, hy = 0.66;
    li.push(box(0.1, 0.035, 0.085, [-0.152, 0.83, 0.0], [0, 0, 0.1], '#1a1a1d')); // platforma przy pasie
    li.push(box(0.042, 0.215, 0.07, [hx, hy, 0.012], [0.04, 0, 0.02], '#141416'), box(0.038, 0.05, 0.062, [hx - 0.002, hy + 0.12, 0.012], [0.04, 0, 0.02], '#1d1d20'));
    li.push(box(0.026, 0.065, 0.05, [hx + 0.004, hy + 0.17, -0.01], [-0.25, 0, 0], '#2b2c30'), box(0.022, 0.03, 0.044, [hx + 0.006, hy + 0.2, -0.032], [-0.55, 0, 0], '#1b1b1d')); // chwyt pistoletu
    li.push(box(0.012, 0.012, 0.02, [hx + 0.022, hy + 0.1, 0.03], [0, 0, 0], '#3a3b40'));
    for (const yy of [0.74, 0.585]) { const g2 = new THREE.TorusGeometry(1, 0.075, 6, 28); g2.scale(0.098, 0.106, 1); g2.rotateX(Math.PI / 2); li.push({ g: xf(g2, [-0.09, yy, 0.003]), col: '#202024' }); li.push(box(0.016, 0.026, 0.012, [-0.19, yy, 0.098], [0, 0, 0], MET)); }
  }
  if (li.length) { const g2 = mergeGeos(li); g2.translate(-hp.x, -hp.y, -hp.z); const m2 = new THREE.Mesh(g2, H.M.gear); m2.castShadow = true; H.hipR.add(m2); }
  if (brute) { // naramienniki
    for (const sd of [1, -1]) {
      const pad = new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI * 0.5); pad.scale(0.092, 0.058, 0.09);
      const rim = new THREE.TorusGeometry(1, 0.045, 6, 22); rim.scale(0.092, 0.09, 0.062); rim.rotateX(Math.PI / 2);
      const sh = sd > 0 ? H.shL : H.shR, items2 = [{ g: xf(pad, [sd * 0.024, 0.04, 0], [0, 0, -sd * 0.4]), col: '#6a6c73' }, { g: xf(rim, [sd * 0.03, 0.045, 0], [0, 0, -sd * 0.42]), col: '#3c3d42' }];
      const g3 = mergeGeos(items2); const m3 = new THREE.Mesh(g3, H.M.gear); m3.castShadow = true; sh.add(m3);
    }
  }
}

export function buildFisk(kind = 'thug', outfit) {
  const o = outfit && outfit.fisk ? outfit : fiskOutfit(kind), M = fiskMats(o), brute = o.fisk === 'brute';
  const b0 = BODY[brute ? 'brute' : 'thug'];
  const b = brute ? { ...b0, pec: 1.2, belly: 0.04 } : { ...b0, w: 1.04, chest: 1.0, waist: 1.0, belly: 0.03, pec: 0.85, arm: 1.0, neck: 1.2 };
  const H = build(brute ? 'brute' : 'thug', M, { face: true, shoe: 'boot', body: b });
  H.root.updateMatrixWorld(true);
  H.M = M; H.outfit = o;
  // cholewki butow
  for (const L of ['L', 'R']) {
    const k = brute ? 1.12 : 1;
    const rg = [{ y: -0.03, rx: 0.05, rz: 0.058, cz: 0.004 }, { y: 0.04, rx: 0.047, rz: 0.052 }, { y: 0.11, rx: 0.046, rz: 0.05 }, { y: 0.135, rx: 0.044, rz: 0.048 }].map(r => ({ ...r, rx: r.rx * k, rz: r.rz * k }));
    const m = new THREE.Mesh(toGeo(tubeData(smooth(rg, 2), 20, r => 0.95, null)), M.foot); m.castShadow = true; H['ft' + L].add(m);
  }
  addFiskGear(H, o, b, kind);
  // fryzura: irokez (grzebien) lub krotko ostrzyzone wlosy
  const hs = b.head, covered = o.balaclava;
  if (o.hair === 'mohawk' && !covered) {
    const crest = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8), M.hair); crest.scale.set(0.014 * hs, 0.03 * hs, 0.098 * hs); crest.position.set(0, HC + 0.106 * hs, 0.004); crest.rotation.x = -0.12; H.neck.add(crest);
  } else if (!covered) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, 1.12), M.hair); cap.scale.set(0.1 * hs, 0.126 * hs, 0.113 * hs); cap.position.set(0, HC + 0.003, 0.006); cap.rotation.x = -0.4; H.neck.add(cap);
  }
  for (const s of [1, -1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.skin); e.scale.set(0.014, 0.03, 0.02); e.position.set(0.097 * hs * s, HC, 0.0); H.neck.add(e); }
  return H;
}
