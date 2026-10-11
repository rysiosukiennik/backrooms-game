// Atlas pokoi do "interior mappingu" w oknach budynkow.
// Atlas 1024x1024: 4x4 pokoi, kazdy w bloku 256x256 = 2x2 kafle po 128 px:
//   lewy gorny  = SCIANA TYLNA (widok frontalny, meble, okno z miastem)
//   prawy gorny = SCIANA BOCZNA (lewa; prawa to odbicie lustrzane). x=0 przy oknie (z przodu), x=128 przy scianie tylnej
//   lewy dolny  = PODLOGA (widok z gory; gorna krawedz = sciana tylna, dolna = okno; os x jak w pokoju)
//   prawy dolny = SUFIT (rysowany jak podloga: gora = sciana tylna; elementy symetryczne w osi x)
// Druga tekstura (emi) zawiera tylko to, co swieci nocą: lampy, ekrany, okna na miasto.
// Pokoj nr r ma blok o lewym gornym rogu (r%4, floor(r/4)) * 256 px.
// Rysowane raz przy starcie; brak zaleznosci od util.js (wlasny generator liczb), zeby nie ruszac ziarna miasta.

export const ROOM_INFO = [
  { type: 'mieszkanie', lit: 0.55, tag: 'salon' },
  { type: 'mieszkanie', lit: 0.40, tag: 'sypialnia' },
  { type: 'mieszkanie', lit: 0.85, tag: 'kuchnia' },
  { type: 'mieszkanie', lit: 0.45, tag: 'gabinet-ksiazki' },
  { type: 'mieszkanie', lit: 0.70, tag: 'rosliny-obrazy' },
  { type: 'mieszkanie', lit: 0.65, tag: 'dzieciecy' },
  { type: 'mieszkanie', lit: 0.25, tag: 'pusty-zaslona' },
  { type: 'mieszkanie', lit: 0.50, tag: 'jadalnia' },
  { type: 'mieszkanie', lit: 0.35, tag: 'nastolatek' },
  { type: 'biuro', lit: 0.95, tag: 'open-space' },
  { type: 'biuro', lit: 0.90, tag: 'sala-konferencyjna' },
  { type: 'biuro', lit: 0.80, tag: 'gabinet-tablica' },
  { type: 'biuro', lit: 0.85, tag: 'archiwum-akta' },
  { type: 'biuro', lit: 0.60, tag: 'serwerownia-kserokopiarka' },
  { type: 'biuro', lit: 0.90, tag: 'recepcja' },
  { type: 'biuro', lit: 0.55, tag: 'open-space-programisci' },
];

/* ---------------- narzedzia kolorow i rysowania ---------------- */
const H = c => c.length === 4 ? [parseInt(c[1], 16) * 17, parseInt(c[2], 16) * 17, parseInt(c[3], 16) * 17] : [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)];
const cl = v => v < 0 ? 0 : v > 255 ? 255 : v | 0;
const hx = (r, g, b) => '#' + [r, g, b].map(v => cl(v).toString(16).padStart(2, '0')).join('');
const sh = (c, f) => { const [r, g, b] = H(c); return hx(r * f, g * f, b * f); };
const mx = (a, b, t) => { const p = H(a), q = H(b); return hx(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t); };
const rgba = (c, a) => { const [r, g, b] = H(c); return `rgba(${r},${g},${b},${a})`; };

let rs = 1;
const rnd = () => { rs |= 0; rs = rs + 0x6D2B79F5 | 0; let t = Math.imul(rs ^ rs >>> 15, 1 | rs); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const rr_ = (a, b) => a + rnd() * (b - a);
const pick = a => a[(rnd() * a.length) | 0];

const R = (g, x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
const LG = (g, x0, y0, x1, y1, st) => { const k = g.createLinearGradient(x0, y0, x1, y1); for (const s of st) k.addColorStop(s[0], s[1]); return k; };
const VG = (g, x, y, w, h, a, b) => { g.fillStyle = LG(g, 0, y, 0, y + h, [[0, a], [1, b]]); g.fillRect(x, y, w, h); };
const HG = (g, x, y, w, h, a, b) => { g.fillStyle = LG(g, x, 0, x + w, 0, [[0, a], [1, b]]); g.fillRect(x, y, w, h); };
function GL(g, x, y, r, c, a) { const k = g.createRadialGradient(x, y, 0, x, y, r); k.addColorStop(0, rgba(c, a)); k.addColorStop(1, rgba(c, 0)); g.fillStyle = k; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
function RR(g, x, y, w, h, r, c) { g.fillStyle = c; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fill(); }
function EL(g, x, y, rx, ry, c) { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); }
// blok frontalny z cieniowaniem (jasniej u gory), obrysem i krawedzia
function BX(g, x, y, w, h, c, r = 0) {
  g.fillStyle = LG(g, 0, y, 0, y + h, [[0, sh(c, 1.14)], [1, sh(c, .82)]]);
  if (r) { RR(g, x, y, w, h, r, g.fillStyle); } else g.fillRect(x, y, w, h);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, w, 1);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(x, y + h - 1, w, 1); g.fillRect(x + w - 1, y, 1, h);
}
// miekki cien na podlodze pod meblem (sciana tylna/boczna)
const FS = (g, x, w, y = 126) => { EL(g, x + w / 2, y, w * .55, 2.6, 'rgba(0,0,0,.38)'); };
// cien na scianie za meblem
// tani miekki cien: kilka coraz wiekszych, przezroczystych prostokatow (zamiast shadowBlur, ktory jest wolny)
const SOFT = (g, x, y, w, h, a, n = 3) => { g.fillStyle = `rgba(0,0,0,${a / n})`; for (let k = 1; k <= n; k++) g.fillRect(x - k + 1, y - k + 2, w + 2 * k - 2, h + 2 * k - 2); };
const WS = (g, x, y, w, h) => SOFT(g, x + 1, y + 1, w, h, .5);

/* ---------------- baza scian / podlogi / sufitu ---------------- */
function wallBack(g, P) {
  const w = P.wall;
  VG(g, 0, 0, 128, 128, sh(w, 1.06), sh(w, .86));
  if (P.wp === 'stripe') for (let x = 4; x < 128; x += 12) R(g, x, 0, 5, 128, rgba(sh(w, P.dark ? 1.25 : .86), .35));
  if (P.wp === 'dots') for (let i = 0; i < 90; i++) EL(g, rr_(0, 128), rr_(0, 120), 1.4, 1.4, rgba(sh(w, .8), .35));
  if (P.wp === 'half') { VG(g, 0, 70, 128, 58, sh(P.wall2 || w, .95), sh(P.wall2 || w, .75)); R(g, 0, 69, 128, 2, sh(w, 1.2)); R(g, 0, 71, 128, 1, 'rgba(0,0,0,.3)'); }
  if (P.wp === 'panel') for (let x = 0; x < 128; x += 32) { R(g, x, 0, 1, 128, 'rgba(0,0,0,.18)'); R(g, x + 1, 0, 1, 128, 'rgba(255,255,255,.08)'); }
  for (let i = 0; i < 7; i++) GL(g, rr_(0, 128), rr_(0, 128), rr_(20, 40), rnd() < .5 ? '#ffffff' : '#000000', .05);
  GL(g, P.lx || 64, 0, 100, P.lamp, P.lampA == null ? .3 : P.lampA);
  baseVig(g, 1);
  R(g, 0, 122, 128, 6, sh(w, .62)); R(g, 0, 122, 128, 1, 'rgba(255,255,255,.18)');
}
function baseVig(g, back) {
  g.fillStyle = LG(g, 0, 0, 24, 0, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 24, 128);
  g.fillStyle = LG(g, 128, 0, 104, 0, [[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(104, 0, 24, 128);
  g.fillStyle = LG(g, 0, 0, 0, 14, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 128, 14);
  R(g, 0, 0, 128, 2, 'rgba(255,255,255,.1)');
}
function wallSide(g, P) {
  const w = sh(P.wall2 && P.wp !== 'half' ? P.wall2 : P.wall, .9);
  HG(g, 0, 0, 128, 128, sh(w, 1.08), sh(w, .66));   // z przodu jasniej (okno), przy scianie tylnej ciemniej
  VG(g, 0, 0, 128, 128, 'rgba(0,0,0,.1)', 'rgba(0,0,0,.2)');
  if (P.wp === 'stripe') for (let x = 4; x < 128; x += 12) R(g, x, 0, 5, 128, rgba(sh(w, P.dark ? 1.25 : .86), .3));
  if (P.wp === 'half') { VG(g, 0, 70, 128, 58, sh(P.wall2 || w, .85), sh(P.wall2 || w, .62)); R(g, 0, 69, 128, 2, sh(w, 1.1)); }
  if (P.wp === 'panel') for (let x = 0; x < 128; x += 32) { R(g, x, 0, 1, 128, 'rgba(0,0,0,.18)'); }
  for (let i = 0; i < 6; i++) GL(g, rr_(0, 128), rr_(0, 128), rr_(20, 40), rnd() < .5 ? '#ffffff' : '#000000', .05);
  GL(g, 40, 0, 80, P.lamp, (P.lampA == null ? .3 : P.lampA) * .7);
  g.fillStyle = LG(g, 0, 0, 0, 16, [[0, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 128, 16);
  g.fillStyle = LG(g, 128, 0, 108, 0, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(108, 0, 20, 128);
  R(g, 0, 122, 128, 6, sh(w, .55)); R(g, 0, 122, 128, 1, 'rgba(255,255,255,.14)');
}
function floorBase(g, P) {
  const f = P.floor, c1 = f.c, c2 = f.c2 || sh(f.c, .85);
  R(g, 0, 0, 128, 128, c1);
  if (f.t === 'parquet') {
    for (let x = 0; x < 128; x += 8) {
      let y = -rr_(0, 20);
      while (y < 128) { const l = rr_(24, 44); R(g, x, y, 8, l, mx(c1, c2, rnd()) ); R(g, x, y + l - 1, 8, 1, 'rgba(0,0,0,.35)'); R(g, x, y, 1, l, 'rgba(0,0,0,.28)'); R(g, x + 1, y, 1, l, 'rgba(255,255,255,.05)'); y += l; }
    }
  } else if (f.t === 'tile') {
    const s = f.s || 16;
    for (let y = 0; y < 128; y += s) for (let x = 0; x < 128; x += s) { R(g, x, y, s, s, ((x + y) / s) % 2 ? c1 : c2); R(g, x, y, s, 1, 'rgba(0,0,0,.35)'); R(g, x, y, 1, s, 'rgba(0,0,0,.35)'); R(g, x + 1, y + 1, s - 2, 1, 'rgba(255,255,255,.08)'); }
  } else if (f.t === 'carpet') {
    for (let i = 0; i < 900; i++) R(g, rr_(0, 128), rr_(0, 128), 1, 1, rnd() < .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.09)');
    if (f.sq) for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { R(g, x, y, 32, 1, 'rgba(0,0,0,.1)'); R(g, x, y, 1, 32, 'rgba(0,0,0,.1)'); }
  } else if (f.t === 'lino') {
    for (let x = 0; x < 128; x += 16) { R(g, x, 0, 1, 128, 'rgba(0,0,0,.18)'); }
    VG(g, 0, 0, 128, 128, 'rgba(255,255,255,.06)', 'rgba(0,0,0,.06)');
  } else if (f.t === 'concrete') {
    for (let i = 0; i < 14; i++) GL(g, rr_(0, 128), rr_(0, 128), rr_(15, 35), rnd() < .5 ? '#ffffff' : '#000000', .06);
    for (let i = 0; i < 700; i++) R(g, rr_(0, 128), rr_(0, 128), 1, 1, 'rgba(0,0,0,.12)');
  }
  // polysk (odbicie swiatla z okna u dolu) i swiatlo lampy
  VG(g, 0, 0, 128, 128, 'rgba(255,255,255,0)', 'rgba(255,255,255,' + (f.gloss || .06) + ')');
  GL(g, 64, 64, 80, P.lamp, .22);
}
function floorVig(g) {
  g.fillStyle = LG(g, 0, 0, 0, 22, [[0, 'rgba(0,0,0,.7)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 128, 22);
  g.fillStyle = LG(g, 0, 0, 20, 0, [[0, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 20, 128);
  g.fillStyle = LG(g, 128, 0, 108, 0, [[0, 'rgba(0,0,0,.6)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(108, 0, 20, 128);
}
// plama swiatla dziennego wpadajaca przez okno (u dolu kafla podlogi)
function sunPatch(g, x, w, a = .22, c = '#fff0c8') {
  g.save(); g.fillStyle = LG(g, 0, 128, 0, 60, [[0, rgba(c, a)], [1, rgba(c, 0)]]);
  g.beginPath(); g.moveTo(x, 128); g.lineTo(x + w, 128); g.lineTo(x + w + 22, 64); g.lineTo(x + 22, 64); g.closePath(); g.fill(); g.restore();
}
// podloga: prostokat mebla w rzucie z gory; d0 = odleglosc od sciany tylnej (px od gory kafla)
function FP(g, x, d0, w, d, c, r = 2) {
  SOFT(g, x, d0 + 1, w, d, .6, 4); RR(g, x, d0, w, d, r, c);
  g.fillStyle = LG(g, x, d0, x, d0 + d, [[0, 'rgba(255,255,255,.14)'], [1, 'rgba(0,0,0,.18)']]); g.fillRect(x, d0, w, d);
}
function rug(g, x, y, w, h, c, c2) {
  SOFT(g, x, y, w, h, .35, 2); RR(g, x, y, w, h, 3, c);
  g.strokeStyle = c2; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - 8);
  g.strokeStyle = rgba(c2, .5); g.lineWidth = 1; g.strokeRect(x + 8, y + 8, w - 16, h - 16);
  for (let i = 0; i < 160; i++) R(g, x + rr_(0, w), y + rr_(0, h), 1, 1, rnd() < .5 ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.12)');
}
function ceilBase(g, e, P) {
  const c = P.ceil;
  R(g, 0, 0, 128, 128, c);
  R(g, 0, 0, 128, 128, 'rgba(20,18,16,.3)');   // sufit patrzac z dolu jest zawsze nieco ciemniejszy od scian
  GL(g, 64, 64, 90, P.lamp, P.office ? .22 : .26);
  if (P.office) {
    for (let x = 0; x <= 128; x += 32) R(g, x, 0, 1, 128, 'rgba(0,0,0,.28)');
    for (let y = 0; y <= 128; y += 32) R(g, 0, y, 128, 1, 'rgba(0,0,0,.28)');
    for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) { for (let i = 0; i < 8; i++) R(g, x + rr_(2, 30), y + rr_(2, 30), 1, 1, 'rgba(0,0,0,.2)'); }
    // panele swietlowek 2x(2 rzedy)
    for (const [px, py] of P.panels || [[16, 30], [80, 30], [16, 94], [80, 94]]) {
      R(g, px - 1, py - 1, 34, 18, '#9a9a9a'); R(g, px, py, 32, 16, '#f6fbff'); R(g, px + 1, py + 1, 30, 14, '#ffffff');
      R(g, px + 3, py + 3, 26, 1, '#cfe6ff'); R(g, px + 3, py + 8, 26, 1, '#cfe6ff'); R(g, px + 3, py + 12, 26, 1, '#cfe6ff');
      R(e, px, py, 32, 16, P.panelE || '#e4f0ff'); GL(g, px + 16, py + 8, 30, '#dcecff', .25);
    }
  } else {
    // plafon mieszkania: rozeta lampy i listwa przysufitowa
    GL(g, 64, 64, 60, P.lamp, .3);
    const lx = P.cl ? P.cl[0] : 64, ly = P.cl ? P.cl[1] : 64;
    EL(g, lx, ly, 7, 7, '#d8d0c4'); EL(g, lx, ly, 5, 5, mx(P.lamp, '#ffffff', .5));
    GL(e, lx, ly, 26, P.lamp, .8); EL(e, lx, ly, 5, 5, mx(P.lamp, '#ffffff', .6));
    GL(g, lx, ly, 34, P.lamp, .45);
    if (P.spots) for (const [sx, sy] of P.spots) { EL(g, sx, sy, 3, 3, '#fff7e0'); EL(e, sx, sy, 3, 3, '#fff0c8'); GL(g, sx, sy, 14, P.lamp, .3); GL(e, sx, sy, 10, P.lamp, .4); }
  }
  for (let i = 0; i < 6; i++) GL(g, rr_(0, 128), rr_(0, 128), rr_(18, 36), rnd() < .5 ? '#fff' : '#000', .05);
  // narozniki / listwy
  g.fillStyle = LG(g, 0, 0, 0, 16, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 128, 16);
  g.fillStyle = LG(g, 0, 0, 16, 0, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, 16, 128);
  g.fillStyle = LG(g, 128, 0, 112, 0, [[0, 'rgba(0,0,0,.55)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(112, 0, 16, 128);
}

/* ---------------- okno z miejskim niebem ---------------- */
function WIN(g, e, x, y, w, h, P, o = {}) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  VG(g, x, y, w, h, P.skyT || '#8fb4de', P.skyB || '#f2d9b0');
  GL(g, x + w * .7, y + h * .85, w * .8, '#ffe2a8', .5);
  for (let i = 0; i < 3; i++) EL(g, x + rr_(0, w), y + rr_(0, h * .5), rr_(8, 16), rr_(2, 4), 'rgba(255,255,255,.18)');
  // panorama budynkow w dwoch warstwach
  for (let layer = 0; layer < 2; layer++) {
    let bx = x - rr_(0, 6);
    while (bx < x + w) {
      const bw = rr_(8, 16) + layer * 4, bh = rr_(h * .2, h * (.5 - layer * .12));
      const col = layer ? '#3d4863' : '#7585a3';
      R(g, bx, y + h - bh, bw, bh, col);
      R(g, bx, y + h - bh, bw, 1, 'rgba(255,255,255,.15)');
      for (let wy = y + h - bh + 3; wy < y + h - 2; wy += 4) for (let wx = bx + 2; wx < bx + bw - 2; wx += 3) {
        if (rnd() < .45) { R(g, wx, wy, 1.6, 2, layer ? 'rgba(255,215,150,.55)' : 'rgba(230,240,255,.35)'); if (rnd() < .5) R(e, wx, wy, 1.6, 2, layer ? '#ffb860' : '#9db9e6'); }
      }
      bx += bw + rr_(0, 2);
    }
  }
  g.restore();
  GL(e, x + w / 2, y + h * .5, w * .6, '#6a86b4', .12);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = LG(g, x, y, x + w * .6, y + h, [[0, 'rgba(255,255,255,.2)'], [.3, 'rgba(255,255,255,0)'], [.6, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h);
  g.restore();
  const fc = P.frame || '#e8e4dc';
  g.strokeStyle = fc; g.lineWidth = o.fw || 3; g.strokeRect(x - 1, y - 1, w + 2, h + 2);
  if (!o.nomull) { R(g, x + w / 2 - 1, y, 2, h, fc); if (h > 40) R(g, x, y + h * .38, w, 2, fc); }
  R(g, x - 3, y + h + 1, w + 6, 3, sh(fc, 1.05)); R(g, x - 3, y + h + 4, w + 6, 1, 'rgba(0,0,0,.35)');
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
}
// firana / zaslona
function CURT(g, x, y, w, h, c, o = {}) {
  const n = Math.max(3, (w / 4) | 0);
  for (let i = 0; i < n; i++) {
    const cx = x + w * i / n, ww = w / n;
    g.fillStyle = LG(g, cx, 0, cx + ww, 0, [[0, sh(c, .72)], [.45, sh(c, 1.1)], [1, sh(c, .8)]]);
    g.fillRect(cx, y, ww + .5, h);
  }
  R(g, x - 2, y - 2, w + 4, 2, '#4a3a2a'); EL(g, x - 2, y - 1, 2, 2, '#6b5a3c'); EL(g, x + w + 2, y - 1, 2, 2, '#6b5a3c');
  if (!o.open) return;
}
function ROLLER(g, x, y, w, h, c) {
  VG(g, x, y, w, h, sh(c, 1.1), sh(c, .9));
  for (let yy = y + 3; yy < y + h; yy += 3) R(g, x, yy, w, 1, 'rgba(0,0,0,.12)');
  R(g, x, y, w, 3, sh(c, .7)); R(g, x, y + h - 3, w, 3, sh(c, .65)); R(g, x + w / 2 - 1, y + h, 2, 4, '#ccc');
}

/* ---------------- meble i rekwizyty ---------------- */
function LAMPSHADE(g, e, x, y, w, h, c) {   // lampa stojaca / abazur (x srodek, y gora abazura)
  g.fillStyle = mx(c, '#ffffff', .4);
  g.beginPath(); g.moveTo(x - w * .35, y); g.lineTo(x + w * .35, y); g.lineTo(x + w * .5, y + h); g.lineTo(x - w * .5, y + h); g.closePath(); g.fill();
  GL(g, x, y + h * .5, w * 2.2, c, .4); GL(e, x, y + h * .5, w * 1.6, c, .55);
  e.fillStyle = mx(c, '#ffffff', .5); e.beginPath(); e.moveTo(x - w * .35, y); e.lineTo(x + w * .35, y); e.lineTo(x + w * .5, y + h); e.lineTo(x - w * .5, y + h); e.closePath(); e.fill();
}
function FLOORLAMP(g, e, x, c) {
  R(g, x - 1, 62, 2, 62, '#2a2a2a'); EL(g, x, 125, 6, 2, '#222'); LAMPSHADE(g, e, x, 50, 18, 14, c);
}
function TABLELAMP(g, e, x, yb, c) { R(g, x - 1, yb - 8, 2, 8, '#333'); EL(g, x, yb, 3, 1.5, '#333'); LAMPSHADE(g, e, x, yb - 16, 10, 8, c); }
function PLANT(g, x, yb, s, big) {
  const pot = pick(['#a2552f', '#d8d0c0', '#4a4d58', '#8a5a36']);
  g.fillStyle = pot; g.beginPath(); g.moveTo(x - 5 * s, yb - 9 * s); g.lineTo(x + 5 * s, yb - 9 * s); g.lineTo(x + 3.6 * s, yb); g.lineTo(x - 3.6 * s, yb); g.fill();
  R(g, x - 5.5 * s, yb - 10 * s, 11 * s, 2 * s, sh(pot, .85));
  FS(g, x - 5 * s, 10 * s, yb + 1);
  const n = big ? 22 : 12, hh = (big ? 38 : 20) * s;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + rr_(-1.1, 1.1), l = rr_(.5, 1) * hh, lx = x + Math.cos(a) * l, ly = yb - 10 * s + Math.sin(a) * l;
    g.strokeStyle = sh('#3d7a38', rr_(.6, 1.15)); g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, yb - 9 * s); g.lineTo(lx, ly); g.stroke();
    g.fillStyle = sh(pick(['#3f8a3c', '#2f6b32', '#58a04a']), rr_(.8, 1.15));
    g.beginPath(); g.ellipse(lx, ly, rr_(3, 5.5) * s, rr_(1.8, 3) * s, a + 1.57 + rr_(-.4, .4), 0, 7); g.fill();
  }
}
function HANGPLANT(g, x, y, len) {
  R(g, x, 0, 1, y, '#3a3a3a');
  g.fillStyle = '#b5693a'; g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 5, y); g.lineTo(x + 3, y + 7); g.lineTo(x - 2, y + 7); g.fill();
  for (let i = 0; i < 9; i++) { const lx = x + rr_(-6, 6), l = rr_(len * .4, len); g.strokeStyle = sh('#3f8a3c', rr_(.7, 1.1)); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y + 4); g.quadraticCurveTo(lx, y + l * .4, lx + rr_(-3, 3), y + l); g.stroke(); EL(g, lx, y + l, 2, 1.4, '#58a04a'); }
}
function PIC(g, x, y, w, h, kind, fc) {
  WS(g, x, y, w, h);
  R(g, x - 2, y - 2, w + 4, h + 4, fc || '#3a2c20'); R(g, x - 1, y - 1, w + 2, h + 2, '#e8e2d2');
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (kind === 0) { VG(g, x, y, w, h, '#e9c27a', '#6a8aa8'); EL(g, x + w * .65, y + h * .4, w * .16, w * .16, '#fff1c8'); g.fillStyle = '#2d4a38'; g.beginPath(); g.moveTo(x, y + h); g.lineTo(x + w * .4, y + h * .45); g.lineTo(x + w * .7, y + h); g.fill(); }
  else if (kind === 1) { R(g, x, y, w, h, '#efe8da'); R(g, x + w * .15, y + h * .2, w * .3, h * .5, '#c4452f'); R(g, x + w * .5, y + h * .35, w * .3, h * .45, '#2f5f9a'); EL(g, x + w * .55, y + h * .25, w * .12, w * .12, '#e8b830'); }
  else if (kind === 2) { VG(g, x, y, w, h, '#1d2c4a', '#5a7aa8'); for (let i = 0; i < 6; i++) { g.strokeStyle = pick(['#f0c040', '#e8e0b0', '#7aa0d8']); g.lineWidth = 1.5; g.beginPath(); g.arc(x + w * rr_(.2, .8), y + h * rr_(.2, .8), rr_(2, 6), 0, 6); g.stroke(); } }
  else if (kind === 3) { R(g, x, y, w, h, '#d8cfb8'); g.fillStyle = '#4a6a58'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(x + w * rr_(.2, .8), y + h * rr_(.25, .75), rr_(3, 7), rr_(5, 10), rr_(0, 3), 0, 7); g.fill(); } }
  else { VG(g, x, y, w, h, '#2a3a56', '#8f6a4a'); R(g, x, y + h * .6, w, h * .4, '#32465c'); R(g, x + w * .2, y + h * .35, w * .5, h * .25, '#a8483a'); }
  g.restore();
  g.fillStyle = LG(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,.18)'], [.5, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h);
}
function BOOKS(g, x, y, w, h, shelves) {   // regal pelny ksiazek (frontalnie)
  R(g, x, y, w, h, '#3a2a1c'); R(g, x + 1, y + 1, w - 2, h - 2, '#241812');
  const sh_ = h / shelves;
  for (let s = 0; s < shelves; s++) {
    const sy = y + s * sh_ + sh_ - 2;
    let bx = x + 2;
    const pal = ['#7a2a2a', '#2a4a6a', '#3a6a3a', '#8a6a2a', '#5a3a6a', '#aaa090', '#a4482a', '#1f3a4a', '#d0c4a0'];
    while (bx < x + w - 3) {
      const bw = rr_(2, 4.6), bh = (sh_ - 5) * rr_(.65, 1), c = pick(pal);
      const gap = rnd() < .08 ? rr_(3, 7) : 0;
      g.fillStyle = LG(g, bx, 0, bx + bw, 0, [[0, sh(c, 1.15)], [1, sh(c, .7)]]); g.fillRect(bx, sy - bh, bw, bh);
      if (rnd() < .5) R(g, bx, sy - bh * .7, bw, 1, 'rgba(240,220,150,.5)');
      bx += bw + .3 + gap;
    }
    R(g, x + 1, sy, w - 2, 2, '#6a4a2c'); R(g, x + 1, sy, w - 2, 1, '#8a6a42');
  }
  R(g, x, y, 1, h, '#5a3e26'); R(g, x + w - 1, y, 1, h, '#5a3e26');
}
function SHELF(g, x, y, w, items) {      // polka z drobiazgami
  WS(g, x, y, w, 2); R(g, x, y, w, 2, '#6a4a2c'); R(g, x, y, w, 1, '#8a6a42');
  let cx = x + 3;
  while (cx < x + w - 4) {
    const t = (rnd() * 4) | 0, bw = rr_(3, 7), bh = rr_(5, 10);
    if (t === 0) { const c = pick(['#7a2a2a', '#2a4a6a', '#3a6a3a']); R(g, cx, y - bh, bw, bh, c); }
    else if (t === 1) { EL(g, cx + 2, y - 3, 2.5, 3, pick(['#c8b49a', '#9ab4c8'])); }
    else if (t === 2) { R(g, cx, y - 3, bw, 3, pick(['#b8a070', '#707890'])); R(g, cx + 1, y - 6, bw - 2, 3, pick(['#a05848', '#c0b090'])); }
    else { PLANT(g, cx + 3, y, .35, false); }
    cx += bw + rr_(1, 5);
  }
}
function DOOR(g, x, y, w, h, c, o = {}) {
  WS(g, x - 2, y - 2, w + 4, h + 2);
  R(g, x - 3, y - 3, w + 6, h + 3, sh(c, 1.18)); R(g, x, y, w, h, c);
  g.fillStyle = LG(g, x, 0, x + w, 0, [[0, sh(c, 1.1)], [1, sh(c, .8)]]); g.fillRect(x, y, w, h);
  const pw = w * .7, px = x + w * .15;
  R(g, px, y + 5, pw, h * .38, 'rgba(0,0,0,.14)'); R(g, px + 1, y + 6, pw - 2, h * .38 - 2, 'rgba(255,255,255,.06)');
  R(g, px, y + h * .5, pw, h * .42, 'rgba(0,0,0,.14)'); R(g, px + 1, y + h * .5 + 1, pw - 2, h * .42 - 2, 'rgba(255,255,255,.06)');
  EL(g, x + w - 5, y + h * .52, 2, 2, '#d8cfa0'); R(g, x + w - 8, y + h * .52 - 1, 5, 2, '#c8b880');
  if (o.glass) { R(g, px, y + 6, pw, h * .5, '#9fb8cc'); VG(g, px + 1, y + 7, pw - 2, h * .5 - 2, '#bcd2e4', '#7f9cb4'); R(g, px, y + 6 + h * .5, pw, 2, c); }
  R(g, x, y + h - 1, w, 1, 'rgba(0,0,0,.4)');
}
function CHAIR(g, x, yb, s, c) {   // krzeslo biurowe od przodu (widac oparcie, siedzisko, kolumne, gwiazde)
  RR(g, x - 6 * s, yb - 24 * s, 12 * s, 14 * s, 3 * s, sh(c, 1)); RR(g, x - 7 * s, yb - 11 * s, 14 * s, 4 * s, 2 * s, sh(c, .85));
  R(g, x - .8 * s, yb - 7 * s, 1.6 * s, 5 * s, '#222'); R(g, x - 7 * s, yb - 2 * s, 14 * s, 1.4 * s, '#222');
  for (const dx of [-7, 0, 7]) EL(g, x + dx * s, yb - .6 * s, 1.1 * s, 1.1 * s, '#111');
}
function MON(g, e, x, y, w, h, kind, col = '#7ac0ff') {  // monitor: x,y lewy gorny rog ekranu
  R(g, x - 1, y - 1, w + 2, h + 2, '#151515');
  const lit = kind !== 'off';
  if (lit) {
    VG(g, x, y, w, h, mx(col, '#000000', .35), mx(col, '#000000', .55));
    if (kind === 'code') for (let yy = y + 1.5; yy < y + h - 1; yy += 1.6) R(g, x + 1 + rr_(0, 3), yy, rr_(w * .2, w * .8), .8, rgba(pick(['#9fe0a0', '#e8e8a0', '#a0c8ff']), .75));
    else if (kind === 'doc') { R(g, x + w * .1, y + 1, w * .45, h - 2, 'rgba(255,255,255,.7)'); for (let yy = y + 2; yy < y + h - 2; yy += 1.8) R(g, x + w * .14, yy, w * .36, .6, 'rgba(60,60,60,.6)'); R(g, x + w * .6, y + 2, w * .32, h * .4, 'rgba(100,170,240,.7)'); }
    else if (kind === 'chart') { for (let i = 0; i < 6; i++) { const bh = rr_(.2, .8) * (h - 3); R(g, x + 1.5 + i * (w - 3) / 6, y + h - 1 - bh, (w - 3) / 6 - 1, bh, 'rgba(255,200,90,.85)'); } }
    GL(g, x + w / 2, y + h / 2, w * 1.1, col, .35);
    R(e, x, y, w, h, mx(col, '#ffffff', .1)); GL(e, x + w / 2, y + h / 2, w * .9, col, .5);
    g.fillStyle = LG(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,.25)'], [.4, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h);
  } else { VG(g, x, y, w, h, '#16181c', '#0c0d10'); g.fillStyle = LG(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,.15)'], [.4, 'rgba(255,255,255,0)']]); g.fillRect(x, y, w, h); }
  R(g, x + w / 2 - 1, y + h + 1, 2, 3, '#222'); R(g, x + w / 2 - 4, y + h + 3, 8, 1.4, '#1c1c1c');
}
function DESK(g, x, yt, w, c, kind) {   // biurko od przodu: blat na wysokosci yt
  BX(g, x, yt, w, 3, mx(c, '#ffffff', .1)); R(g, x, yt + 3, w, 1, 'rgba(0,0,0,.4)');
  R(g, x + 2, yt + 4, 2, 126 - yt - 4, sh(c, .7)); R(g, x + w - 4, yt + 4, 2, 126 - yt - 4, sh(c, .7));
  if (kind === 'panel') { BX(g, x + 2, yt + 4, w - 4, 15, sh(c, .85)); }
  if (kind === 'drawers') { BX(g, x + w - 18, yt + 4, 16, 126 - yt - 4, sh(c, .9)); for (let i = 0; i < 3; i++) { R(g, x + w - 18, yt + 4 + i * ((126 - yt - 4) / 3), 16, 1, 'rgba(0,0,0,.4)'); R(g, x + w - 12, yt + 8 + i * ((126 - yt - 4) / 3), 4, 1, '#c8c8c8'); } }
  FS(g, x, w);
}
function PERSON(g, x, yb, s, shirt, o = {}) {   // sylwetka czlowieka (widok z przodu/tylu); yb = linia pasa (siedzac) albo stop (stojac)
  const skin = o.skin || '#c89574', hair = o.hair || '#2a1e18';
  const draw = (col, dx, dy) => { };
  if (o.stand) {
    R(g, x - 4 * s, yb - 30 * s, 3.4 * s, 30 * s, '#2a2e3c'); R(g, x + .6 * s, yb - 30 * s, 3.4 * s, 30 * s, '#2a2e3c');
    R(g, x - 4.5 * s, yb - 2 * s, 4.6 * s, 2 * s, '#111'); R(g, x, yb - 2 * s, 4.6 * s, 2 * s, '#111');
    yb -= 29 * s;
  }
  RR(g, x - 6.5 * s, yb - 22 * s, 13 * s, 24 * s, 4 * s, shirt);
  g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x - 6.5 * s, yb - 21 * s, 13 * s, 2 * s);
  if (o.arms === 'down') { RR(g, x - 9 * s, yb - 20 * s, 3.5 * s, 18 * s, 1.6 * s, sh(shirt, .85)); RR(g, x + 5.5 * s, yb - 20 * s, 3.5 * s, 18 * s, 1.6 * s, sh(shirt, .85)); }
  else if (o.arms === 'up') { g.strokeStyle = sh(shirt, .9); g.lineWidth = 3 * s; g.beginPath(); g.moveTo(x - 6 * s, yb - 18 * s); g.lineTo(x - 11 * s, yb - 8 * s); g.lineTo(x - 5 * s, yb + 1 * s); g.moveTo(x + 6 * s, yb - 18 * s); g.lineTo(x + 11 * s, yb - 8 * s); g.lineTo(x + 5 * s, yb + 1 * s); g.stroke(); }
  R(g, x - 1.8 * s, yb - 25 * s, 3.6 * s, 4 * s, skin);
  EL(g, x, yb - 30 * s, 4.6 * s, 5.4 * s, skin);
  g.fillStyle = hair; g.beginPath(); g.ellipse(x, yb - 32 * s, 4.9 * s, 4.4 * s, 0, Math.PI, 0); g.fill();
  if (o.back) EL(g, x, yb - 30 * s, 4.8 * s, 5.5 * s, hair);
}

/* ---------------- pokoje ---------------- */
const SKY_DAY = { skyT: '#7fa6d6', skyB: '#f3dcb6' };
const WARM = '#ffd08a', COLD = '#e6f1ff';

// kazdy pokoj: { P: parametry, back(g,e), side(g,e), floor(g,e), ceil(g,e)? }
const ROOMS = [
  // 0 salon: sofa pod tylna sciana, telewizor na bocznej
  { P: { wall: '#b8a688', lamp: WARM, floor: { t: 'parquet', c: '#9b6b40', c2: '#8a5c36', gloss: .1 }, ceil: '#e6dfd2', lx: 70, cl: [64, 58], ...SKY_DAY },
    back(g, e, P) {
      WIN(g, e, 12, 16, 36, 52, P, { fw: 3 });
      CURT(g, 4, 12, 14, 62, '#d9c3a0'); CURT(g, 42, 12, 14, 62, '#d9c3a0');
      PIC(g, 70, 26, 28, 20, 0);
      FS(g, 20, 78); WS(g, 24, 86, 70, 3);
      PLANT(g, 111, 126, 1.1, true);
      // sofa
      const sx = 24, sw = 74;
      RR(g, sx + 4, 82, sw - 8, 28, 7, '#5a6a7a'); RR(g, sx, 92, 10, 30, 5, '#4d5c6b'); RR(g, sx + sw - 10, 92, 10, 30, 5, '#4d5c6b');
      RR(g, sx + 9, 100, sw - 18, 22, 4, '#66788a');
      for (let i = 0; i < 3; i++) { RR(g, sx + 11 + i * 17.3, 86, 16, 20, 4, ['#6a7c8e', '#728596', '#6a7c8e'][i]); R(g, sx + 26 + i * 17.3, 90, 1, 15, 'rgba(0,0,0,.25)'); }
      RR(g, sx + 14, 98, 14, 13, 4, '#d8a248'); RR(g, sx + sw - 30, 100, 13, 13, 4, '#b04a3a');
      R(g, sx + 4, 122, 3, 4, '#222'); R(g, sx + sw - 7, 122, 3, 4, '#222');
      FLOORLAMP(g, e, 104, WARM);
    },
    side(g, e, P) {
      // telewizor na szafce
      BX(g, 28, 98, 56, 26, '#3a2a20'); R(g, 56, 100, 1, 22, 'rgba(0,0,0,.4)'); FS(g, 28, 56);
      R(g, 36, 56, 40, 24, '#080808'); R(g, 37, 57, 38, 22, '#202838');
      VG(g, 38, 58, 36, 20, '#3c78c0', '#d8944a'); for (let i = 0; i < 5; i++) R(g, 40 + i * 6, 60 + (i % 2) * 5, 4, 3, 'rgba(255,255,255,.35)');
      GL(g, 56, 68, 52, '#7ab0ff', .25); R(e, 38, 58, 36, 20, '#7aaae0'); GL(e, 56, 68, 44, '#5a90d8', .55);
      R(g, 54, 80, 4, 5, '#111');
      SHELF(g, 92, 54, 30); SHELF(g, 92, 74, 30); PIC(g, 6, 34, 16, 24, 1);
      R(g, 5, 18, 14, 3, '#ccc');
    },
    floor(g, e, P) { sunPatch(g, 10, 50); rug(g, 18, 36, 92, 62, '#7a3a34', '#d8b66a'); FP(g, 24, 4, 76, 28, '#4d5c6b', 6); FP(g, 42, 52, 38, 16, '#4a3626', 2); FP(g, 98, 8, 14, 14, '#2f5f2f', 7); FP(g, 7, 4, 4, 4, '#222', 1); },
  },
  // 1 sypialnia
  { P: { wall: '#7d8aa3', wall2: '#6f7b94', lamp: '#ffc47a', lampA: .18, floor: { t: 'carpet', c: '#a89a8a' }, ceil: '#d9d6d0', lx: 64, cl: [64, 64], ...SKY_DAY, skyT: '#5878a8', skyB: '#e8b890' },
    back(g, e, P) {
      WIN(g, e, 88, 22, 28, 44, P); CURT(g, 82, 16, 10, 56, '#ece4d8'); CURT(g, 112, 16, 10, 56, '#ece4d8');
      // lozko z wezglowiem
      RR(g, 14, 50, 66, 42, 6, '#4a3226'); R(g, 18, 56, 58, 30, '#583d2e'); for (let i = 0; i < 3; i++) R(g, 24 + i * 18, 58, 14, 26, 'rgba(0,0,0,.15)');
      RR(g, 12, 86, 70, 22, 4, '#dcd4c6'); RR(g, 12, 100, 70, 22, 3, '#8a3a40'); R(g, 12, 98, 70, 2, '#f0e8da');
      RR(g, 20, 80, 24, 12, 5, '#f4efe6'); RR(g, 48, 80, 24, 12, 5, '#f4efe6'); R(g, 20, 88, 52, 1, 'rgba(0,0,0,.12)');
      FS(g, 12, 70); R(g, 14, 122, 4, 4, '#2a1a12'); R(g, 76, 122, 4, 4, '#2a1a12');
      PIC(g, 28, 22, 34, 22, 2);
      BX(g, 2, 102, 10, 22, '#4a3226'); R(g, 3, 106, 8, 1, 'rgba(0,0,0,.4)'); TABLELAMP(g, e, 7, 102, '#ffc47a');
      BX(g, 82, 108, 14, 16, '#4a3226'); R(g, 83, 114, 12, 1, 'rgba(0,0,0,.4)'); R(g, 87, 110, 3, 1, '#c9b377');
    },
    side(g, e, P) { DOOR(g, 12, 28, 34, 96, '#d8d0c4'); BX(g, 58, 70, 62, 54, '#cfc6b8'); for (let i = 0; i < 3; i++) { R(g, 58, 70 + i * 18, 62, 1, 'rgba(0,0,0,.4)'); R(g, 84, 78 + i * 18, 10, 2, '#a89868'); } PIC(g, 70, 24, 24, 30, 3); EL(g, 105, 62, 3, 6, '#8aa68a'); FS(g, 58, 62); },
    floor(g, e, P) { rug(g, 12, 18, 80, 90, '#6a6e8a', '#c8c0b0'); FP(g, 14, 2, 66, 100, '#e0d8ca', 6); FP(g, 14, 70, 66, 26, '#8a3a40', 4); FP(g, 22, 4, 22, 12, '#f4efe6', 5); FP(g, 48, 4, 22, 12, '#f4efe6', 5); FP(g, 2, 4, 10, 12, '#4a3226'); FP(g, 82, 4, 14, 10, '#4a3226'); sunPatch(g, 82, 32, .18); },
  },
  // 2 kuchnia
  { P: { wall: '#dcd2bc', lamp: '#fff2d8', lampA: .35, floor: { t: 'tile', c: '#bcb4a4', c2: '#a89e8c', s: 16, gloss: .12 }, ceil: '#f0ece4', lx: 64, cl: [64, 58], spots: [[30, 40], [98, 40], [30, 90], [98, 90]], ...SKY_DAY },
    back(g, e, P) {
      // kafle nad blatem
      for (let y = 66; y < 96; y += 6) for (let x = 0; x < 128; x += 8) { R(g, x, y, 8, 6, '#e8e4da'); R(g, x, y, 8, 1, 'rgba(0,0,0,.18)'); R(g, x, y, 1, 6, 'rgba(0,0,0,.14)'); }
      // dolne szafki + blat
      BX(g, 0, 96, 82, 28, '#6d7f68'); for (let i = 0; i < 4; i++) { R(g, i * 20.5, 96, 1, 28, 'rgba(0,0,0,.4)'); R(g, 6 + i * 20.5, 100, 8, 1.5, '#cfcfcf'); }
      R(g, 0, 93, 84, 4, '#bdb6a8'); R(g, 0, 93, 84, 1, '#e6e0d4'); R(g, 0, 97, 84, 1, 'rgba(0,0,0,.4)'); R(g, 0, 122, 82, 4, '#2a2a2a');
      // gorne szafki
      BX(g, 0, 20, 36, 34, '#6d7f68'); BX(g, 46, 20, 34, 34, '#6d7f68'); R(g, 18, 20, 1, 34, 'rgba(0,0,0,.4)'); R(g, 63, 20, 1, 34, 'rgba(0,0,0,.4)'); R(g, 15, 48, 2, 5, '#cfcfcf'); R(g, 20, 48, 2, 5, '#cfcfcf'); R(g, 60, 48, 2, 5, '#cfcfcf'); R(g, 65, 48, 2, 5, '#cfcfcf');
      R(g, 36, 12, 10, 42, '#2a2c2e'); R(g, 38, 14, 6, 5, '#889');
      WS(g, 38, 58, 7, 8); g.fillStyle = '#b8bcc4'; g.beginPath(); g.moveTo(40, 60); g.lineTo(44, 60); g.lineTo(43, 66); g.lineTo(41, 66); g.fill();
      // garnki
      RR(g, 8, 84, 14, 9, 2, '#9a9ea6'); R(g, 6, 85, 3, 2, '#333'); RR(g, 52, 88, 10, 5, 1, '#c8c8c8'); EL(g, 70, 90, 4, 3, '#b04a3a');
      // lodowka
      BX(g, 90, 14, 30, 110, '#cfd4d8', 2); R(g, 90, 46, 30, 2, 'rgba(0,0,0,.5)'); R(g, 94, 20, 2, 22, '#7a7e82'); R(g, 94, 54, 2, 30, '#7a7e82');
      R(g, 92, 16, 26, 1, 'rgba(255,255,255,.5)'); R(g, 100, 62, 12, 10, '#e8c050'); R(g, 102, 64, 8, 6, '#c04a3a'); FS(g, 90, 30);
      // lampa wiszaca
      R(g, 66, 0, 1, 8, '#222');
    },
    side(g, e, P) { WIN(g, e, 24, 26, 36, 44, P, { nomull: false }); CURT(g, 20, 20, 8, 54, '#d4a860'); CURT(g, 58, 20, 8, 54, '#d4a860'); BX(g, 78, 70, 50, 54, '#6d7f68'); for (let i = 0; i < 2; i++) { R(g, 78 + i * 25, 70, 1, 54, 'rgba(0,0,0,.4)'); R(g, 94 + i * 25, 74, 2, 8, '#cfcfcf'); } R(g, 78, 67, 50, 4, '#bdb6a8'); FS(g, 78, 50); EL(g, 90, 62, 3, 5, '#6a9a50'); },
    floor(g, e, P) { sunPatch(g, 20, 40, .2); FP(g, 0, 2, 82, 28, '#6d7f68', 1); FP(g, 90, 2, 30, 30, '#cfd4d8', 2); FP(g, 98, 72, 28, 54, '#6d7f68', 1); rug(g, 28, 40, 54, 36, '#b05a38', '#e8d8b0'); },
  },
  // 3 gabinet z regalem pelnym ksiazek
  { P: { wall: '#6a4a38', wall2: '#5a3e30', lamp: '#ffb860', lampA: .35, dark: true, floor: { t: 'parquet', c: '#6a4426', c2: '#58381e', gloss: .12 }, ceil: '#cfc6b4', ...SKY_DAY, skyT: '#2c3c64', skyB: '#c88a58' },
    back(g, e, P) {
      BOOKS(g, 2, 8, 40, 114, 6); BOOKS(g, 86, 8, 40, 114, 6);
      WIN(g, e, 48, 22, 32, 44, P, { fw: 2 }); CURT(g, 44, 16, 8, 54, '#5a2a30'); CURT(g, 76, 16, 8, 54, '#5a2a30');
      DESK(g, 46, 86, 36, '#4a2e1a', 'drawers'); CHAIR(g, 62, 126, 1.1, '#2a1c14');
      // globus
      EL(g, 53, 80, 5, 5, '#4a7aa8'); EL(g, 52, 79, 2, 2, '#6a9a58'); R(g, 53, 85, 1, 2, '#aa8'); R(g, 50, 85, 6, 1, '#aa8');
      TABLELAMP(g, e, 74, 86, '#ffb860');
      MON(g, e, 58, 72, 12, 8, 'doc', '#a8d0ff');
    },
    side(g, e, P) { BOOKS(g, 6, 6, 52, 116, 6); DOOR(g, 76, 26, 34, 98, '#4a3020'); FS(g, 6, 52); },
    floor(g, e, P) { rug(g, 24, 16, 82, 72, '#7a2a2a', '#d4a850'); FP(g, 46, 4, 36, 22, '#4a2e1a', 1); FP(g, 54, 28, 20, 18, '#2a1c14', 9); FP(g, 2, 2, 40, 12, '#3a2a1c', 0); FP(g, 86, 2, 40, 12, '#3a2a1c', 0); sunPatch(g, 40, 30, .12, '#ffc080'); },
  },
  // 4 pokoj z roslinami i obrazami
  { P: { wall: '#d8dccc', wall2: '#cfd4c2', lamp: '#fff0d0', lampA: .3, floor: { t: 'parquet', c: '#c4a070', c2: '#b48e5c', gloss: .12 }, ceil: '#f0eee8', cl: [64, 60], ...SKY_DAY },
    back(g, e, P) {
      PIC(g, 10, 14, 22, 30, 3, '#2a2a2a'); PIC(g, 36, 10, 30, 22, 0, '#d8c8a0'); PIC(g, 38, 36, 18, 14, 1, '#2a2a2a'); PIC(g, 58, 36, 12, 14, 2, '#2a2a2a');
      HANGPLANT(g, 100, 26, 34);
      WIN(g, e, 76, 14, 28, 40, P, { fw: 2 });
      // regal z roslinami
      for (const y of [64, 86]) { SHELF(g, 76, y, 40, []); }
      PLANT(g, 112, 124, 1.1, true); PLANT(g, 8, 124, 1.3, true);
      BX(g, 22, 96, 50, 28, '#a07848'); R(g, 22, 96, 50, 2, '#c09860'); for (let i = 0; i < 3; i++) R(g, 38 + i * 16, 100, 1, 22, 'rgba(0,0,0,.3)'); FS(g, 22, 50);
      PLANT(g, 38, 96, .9, false); PLANT(g, 56, 96, .7, false);
      RR(g, 78, 100, 30, 24, 5, '#a8734a'); RR(g, 76, 108, 6, 16, 3, '#946440'); RR(g, 104, 108, 6, 16, 3, '#946440');
    },
    side(g, e, P) { PIC(g, 20, 20, 30, 22, 4, '#2a2a2a'); PIC(g, 60, 26, 20, 28, 1, '#2a2a2a'); PIC(g, 90, 18, 24, 32, 3, '#d8c8a0'); PLANT(g, 20, 124, 1.5, true); PLANT(g, 100, 124, 1.2, true); BX(g, 38, 98, 50, 26, '#a07848'); FS(g, 38, 50); PLANT(g, 60, 98, .8, false); },
    floor(g, e, P) { sunPatch(g, 70, 36); rug(g, 20, 44, 70, 56, '#4a7a5a', '#e8dcb8'); FP(g, 22, 2, 50, 20, '#a07848', 1); FP(g, 76, 6, 34, 26, '#a8734a', 8); FP(g, 104, 2, 12, 12, '#2f6f2f', 6); FP(g, 4, 2, 12, 12, '#2f6f2f', 6); },
  },
  // 5 pokoj dzieciecy
  { P: { wall: '#e8c868', wall2: '#e0b8c0', wp: 'dots', lamp: '#ffe8b0', lampA: .3, floor: { t: 'carpet', c: '#7aa8c8' }, ceil: '#f4f0e8', cl: [64, 64], ...SKY_DAY },
    back(g, e, P) {
      WIN(g, e, 10, 20, 30, 42, P, { fw: 3 }); CURT(g, 6, 14, 10, 54, '#e86a4a'); CURT(g, 34, 14, 10, 54, '#e86a4a');
      // lozeczko pietrowe / domek
      RR(g, 54, 56, 48, 68, 4, '#8a5a30'); R(g, 54, 56, 3, 68, '#6a4220'); R(g, 99, 56, 3, 68, '#6a4220'); R(g, 54, 88, 48, 3, '#6a4220');
      RR(g, 57, 66, 42, 22, 4, '#e86a4a'); RR(g, 57, 100, 42, 22, 4, '#4aa0c8'); RR(g, 60, 62, 16, 8, 4, '#fff'); EL(g, 85, 112, 5, 5, '#e8d040');
      // drabinka
      R(g, 104, 60, 2, 64, '#8a5a30'); for (let y = 66; y < 124; y += 8) R(g, 104, y, 10, 2, '#8a5a30');
      PIC(g, 14, 76, 24, 18, 4, '#e86a4a');
      // zabawki
      R(g, 8, 108, 14, 14, '#d84a4a'); R(g, 8, 108, 14, 3, '#f08080'); R(g, 14, 98, 14, 14, '#4a8ad8'); R(g, 14, 98, 14, 3, '#80b0f0'); R(g, 28, 112, 10, 10, '#e8c030');
      EL(g, 44, 118, 6, 6, '#58b058'); EL(g, 44, 118, 6, 6, '#58b058'); FS(g, 8, 36);
      GL(g, 100, 40, 14, '#ffe090', .3); EL(g, 100, 40, 3, 3, '#ffe8a0'); EL(e, 100, 40, 3, 3, '#ffe8a0'); GL(e, 100, 40, 12, '#ffd070', .5);
    },
    side(g, e, P) { SHELF(g, 14, 50, 50); SHELF(g, 14, 76, 50); SHELF(g, 14, 102, 50); DOOR(g, 84, 28, 32, 96, '#e0d0b0'); R(g, 92, 14, 18, 8, '#ee5555'); EL(g, 70, 36, 7, 7, '#e8c030'); },
    floor(g, e, P) { sunPatch(g, 6, 36); rug(g, 20, 42, 80, 62, '#e8c050', '#d84a4a'); FP(g, 54, 2, 48, 40, '#8a5a30', 3); FP(g, 8, 2, 38, 14, '#a05050', 3); for (let i = 0; i < 6; i++) EL(g, rr_(30, 100), rr_(54, 98), 3, 3, pick(['#d84a4a', '#4a8ad8', '#58b058', '#e8c030'])); },
  },
  // 6 pusty pokoj z zaslona
  { P: { wall: '#cfc8bc', lamp: '#fff4e0', lampA: .12, floor: { t: 'parquet', c: '#b89a6e', c2: '#a8895c', gloss: .15 }, ceil: '#ece9e2', cl: [64, 64], ...SKY_DAY, skyB: '#fbe8c8' },
    back(g, e, P) {
      WIN(g, e, 30, 14, 68, 70, P, { fw: 3 });
      ROLLER(g, 30, 10, 68, 26, '#eae2d2');
      CURT(g, 26, 8, 14, 90, '#cfc4b0'); CURT(g, 88, 8, 14, 90, '#cfc4b0');
      GL(g, 64, 50, 80, '#fff4d8', .22);
      // kartony i drabina
      BX(g, 8, 96, 24, 28, '#b08a58'); R(g, 8, 96, 24, 3, '#c9a068'); R(g, 18, 99, 4, 25, 'rgba(0,0,0,.2)'); FS(g, 8, 24);
      BX(g, 100, 106, 20, 18, '#b08a58'); R(g, 100, 106, 20, 3, '#c9a068'); FS(g, 100, 20);
      R(g, 56, 100, 18, 24, '#d8d4cc'); R(g, 60, 104, 10, 14, '#a8a49c');
    },
    side(g, e, P) { DOOR(g, 36, 28, 34, 96, '#e0dacc'); R(g, 4, 112, 20, 12, '#b08a58'); R(g, 84, 28, 28, 40, 'rgba(255,240,200,.08)'); },
    floor(g, e, P) { sunPatch(g, 30, 70, .35); sunPatch(g, 40, 40, .15); FP(g, 8, 8, 24, 24, '#b08a58', 1); FP(g, 100, 6, 20, 18, '#b08a58', 1); },
  },
  // 7 jadalnia
  { P: { wall: '#6f5a74', wall2: '#645070', lamp: '#ffd490', lampA: .35, dark: true, floor: { t: 'parquet', c: '#7a5232', c2: '#6a4428', gloss: .14 }, ceil: '#d8d0c4', cl: [64, 64], ...SKY_DAY, skyT: '#33406a', skyB: '#d8946a' },
    back(g, e, P) {
      WIN(g, e, 8, 22, 28, 50, P); CURT(g, 4, 14, 8, 62, '#c8b890'); CURT(g, 32, 14, 8, 62, '#c8b890');
      // kredens
      BX(g, 76, 66, 46, 58, '#4a2e1c'); R(g, 76, 66, 46, 3, '#6a4228'); R(g, 99, 69, 1, 55, 'rgba(0,0,0,.4)'); R(g, 76, 98, 46, 1, 'rgba(0,0,0,.4)');
      R(g, 79, 72, 18, 22, '#241812'); for (let y of [78, 86]) R(g, 79, y, 18, 1, '#6a4a2c'); for (let i = 0; i < 6; i++) EL(g, 82 + i * 3, 84, 1.3, 3, pick(['#aab', '#c8c0b0']));
      R(g, 96, 100, 2, 4, '#c8b880'); R(g, 101, 100, 2, 4, '#c8b880'); FS(g, 76, 46);
      PIC(g, 44, 18, 26, 22, 2, '#b89850'); PIC(g, 82, 22, 30, 28, 0, '#b89850');
      TABLELAMP(g, e, 90, 66, '#ffd490');
      // stol i krzesla z przodu, na wysokosci blatu
      R(g, 36, 92, 36, 4, '#6a4228'); R(g, 36, 92, 36, 1, '#9a6a40'); R(g, 38, 96, 3, 28, '#4a2e1c'); R(g, 67, 96, 3, 28, '#4a2e1c'); FS(g, 36, 36);
      RR(g, 16, 76, 14, 48, 3, '#3a2a1e'); R(g, 16, 76, 14, 2, '#5a3a24'); R(g, 20, 100, 6, 24, '#3a2a1e');
      // zastawa i swiece
      EL(g, 54, 90, 8, 2, '#e8e4dc'); R(g, 44, 80, 2, 12, '#e8d8b0'); EL(g, 45, 78, 1.5, 3, '#ffcf70'); EL(e, 45, 78, 1.5, 3, '#ffcf70'); GL(g, 45, 78, 16, '#ffb860', .4); GL(e, 45, 78, 10, '#ff9a40', .5);
    },
    side(g, e, P) { PIC(g, 14, 20, 28, 36, 4, '#b89850'); PIC(g, 50, 26, 34, 26, 3, '#b89850'); BX(g, 14, 96, 70, 28, '#4a2e1c'); R(g, 14, 96, 70, 3, '#6a4228'); for (let i = 0; i < 3; i++) R(g, 14 + i * 23, 99, 1, 25, 'rgba(0,0,0,.4)'); FS(g, 14, 70); R(g, 100, 40, 8, 78, '#3a2418'); },
    floor(g, e, P) { sunPatch(g, 4, 34, .14); rug(g, 14, 28, 100, 80, '#8a3a3a', '#d8b870'); FP(g, 34, 44, 54, 26, '#6a4228', 2); for (const [cx, cy] of [[30, 52], [30, 62], [92, 52], [92, 62], [50, 38], [70, 38], [50, 74], [70, 74]]) FP(g, cx - 5, cy - 5, 10, 10, '#3a2a1e', 3); FP(g, 76, 4, 46, 14, '#4a2e1c', 1); },
    ceilx(g, e) { EL(g, 64, 64, 22, 22, 'rgba(0,0,0,.25)'); EL(g, 64, 64, 20, 20, '#cfc4ae'); GL(e, 64, 64, 40, '#ffc870', .7); EL(e, 64, 64, 8, 8, '#fff0c8'); },
  },
  // 8 pokoj nastolatka (komputer, gitara, neon)
  { P: { wall: '#2e3550', wall2: '#283048', lamp: '#8a70ff', lampA: .22, dark: true, floor: { t: 'carpet', c: '#3a3c48' }, ceil: '#c8c6c0', cl: [64, 64], ...SKY_DAY, skyT: '#142038', skyB: '#7a5a80' },
    back(g, e, P) {
      WIN(g, e, 8, 18, 28, 40, P); ROLLER(g, 8, 14, 28, 14, '#2a2a38');
      // plakaty
      R(g, 44, 14, 20, 28, '#a02a40'); VG(g, 46, 16, 16, 24, '#e8a040', '#802a50'); EL(g, 54, 28, 5, 5, '#fff0b0'); R(g, 70, 16, 16, 22, '#2a8a9a'); R(g, 72, 18, 12, 14, '#102a3a');
      // neon
      g.strokeStyle = '#ff5ad0'; g.lineWidth = 2; g.beginPath(); g.moveTo(96, 24); g.lineTo(106, 14); g.lineTo(116, 24); g.lineTo(106, 34); g.closePath(); g.stroke(); GL(g, 106, 24, 24, '#ff40c0', .35);
      e.strokeStyle = '#ff7ae0'; e.lineWidth = 2; e.beginPath(); e.moveTo(96, 24); e.lineTo(106, 14); e.lineTo(116, 24); e.lineTo(106, 34); e.closePath(); e.stroke(); GL(e, 106, 24, 26, '#ff40c0', .6);
      // biurko z komputerem
      DESK(g, 40, 84, 80, '#25272e', 'panel');
      MON(g, e, 50, 62, 24, 15, 'code', '#60a8ff'); MON(g, e, 78, 62, 24, 15, 'chart', '#b060ff');
      R(g, 56, 80, 20, 3, '#16181c'); for (let i = 0; i < 8; i++) R(g, 58 + i * 2.2, 81, 1.4, 1, '#ff70c0'); R(g, 106, 76, 6, 8, '#222'); R(g, 100, 70, 8, 14, '#18181e'); R(g, 101, 72, 1, 10, '#40ff80'); R(e, 101, 72, 1, 10, '#40ff80');
      CHAIR(g, 90, 126, 1.2, '#16171c');
      // gitara
      RR(g, 10, 90, 18, 28, 8, '#b06a2e'); EL(g, 19, 104, 3, 3, '#1a1008'); R(g, 18, 56, 3, 36, '#6a4220'); R(g, 16, 50, 7, 8, '#3a2412'); FS(g, 8, 22);
    },
    side(g, e, P) { BX(g, 10, 70, 56, 54, '#25272e'); for (let i = 0; i < 3; i++) R(g, 10, 82 + i * 14, 56, 1, 'rgba(0,0,0,.5)'); R(g, 76, 20, 40, 3, '#444'); for (let i = 0; i < 6; i++) R(g, 78 + i * 6, 8, 4, 12, pick(['#c04a4a', '#4a8ac0', '#e0c040'])); DOOR(g, 84, 40, 30, 84, '#1c2030'); FS(g, 10, 56); },
    floor(g, e, P) { rug(g, 20, 36, 70, 60, '#40305a', '#6a58a0'); FP(g, 40, 2, 80, 22, '#25272e', 1); FP(g, 80, 28, 22, 22, '#16171c', 10); FP(g, 8, 2, 24, 14, '#6a4220', 2); GL(g, 64, 20, 60, '#8a70ff', .22); },
  },
  // 9 open space (rzedy biurek)
  { office: true, P: { wall: '#d6d9dc', wall2: '#c8ccd0', lamp: COLD, lampA: .25, office: true, floor: { t: 'carpet', c: '#5a6678', sq: true }, ceil: '#e8ebee', ...SKY_DAY, skyT: '#6a98cc', skyB: '#dce4ea', frame: '#b8bcc0' },
    back(g, e, P) {
      WIN(g, e, 6, 12, 116, 56, P, { fw: 2, nomull: true }); for (let x = 6 + 29; x < 120; x += 29) R(g, x - 1, 12, 2, 56, '#b8bcc0');
      PERSON(g, 20, 99, .85, '#4a6890', {});
      // dwa rzedy biurek z monitorami
      const cols = ['#c8a878', '#e0e0e0'];
      for (let row = 0; row < 2; row++) { const yt = row ? 100 : 82, sc = row ? 1.2 : .9;
        for (let i = 0; i < 3; i++) { const x = 4 + i * 40 + (row ? 6 : 0), w = 34;
          if (row === 0) { R(g, x, yt, w, 2, '#e8e8e8'); R(g, x + 2, yt + 2, 2, 24, '#888'); R(g, x + w - 4, yt + 2, 2, 24, '#888'); MON(g, e, x + 6, yt - 17, 20, 12, pick(['doc', 'chart', 'code']), pick(['#8ac0ff', '#a8d0f0', '#c8e0ff'])); CHAIR(g, x + 17, 126, .9, '#2a3040'); R(g, x + 28, yt - 5, 4, 5, '#ddd'); }
          else { BX(g, x, yt, w + 4, 3, '#e8e8e8'); R(g, x + 2, yt + 3, 2, 24, '#888'); R(g, x + w, yt + 3, 2, 24, '#888'); MON(g, e, x + 6, yt - 20, 24, 14, pick(['doc', 'chart', 'code', 'doc']), pick(['#8ac0ff', '#b8d8ff'])); R(g, x + 28, yt - 8, 6, 8, '#fff'); R(g, x + 29, yt - 6, 4, 1, '#c33'); CHAIR(g, x + 20, 126, 1.2, '#202838'); }
        }
      }
      R(g, 118, 76, 6, 48, '#667'); PLANT(g, 114, 124, .8, true);
    },
    side(g, e, P) { for (let i = 0; i < 3; i++) { R(g, 10 + i * 36, 40, 30, 80, '#a8b4c0'); R(g, 11 + i * 36, 41, 28, 78, '#d0d6dc'); for (let y = 44; y < 116; y += 8) R(g, 14 + i * 36, y, 22, 5, pick(['#e8e8a0', '#f0b0a0', '#a0d0f0', '#fff'])); } R(g, 6, 18, 116, 2, '#888'); R(g, 20, 22, 14, 12, '#fff'); EL(g, 100, 28, 8, 8, '#fff'); R(g, 100, 24, 1, 5, '#222'); R(g, 100, 28, 4, 1, '#222'); },
    floor(g, e, P) { sunPatch(g, 6, 116, .22, '#f0f4ff'); for (let row = 0; row < 2; row++) for (let i = 0; i < 3; i++) { FP(g, 4 + i * 40 + (row ? 6 : 0), row ? 26 : 12, 34, 14, '#d0ccc0', 0); FP(g, 14 + i * 40 + (row ? 6 : 0), row ? 42 : 28, 14, 12, '#2a3040', 6); } FP(g, 108, 4, 12, 12, '#2f6f2f', 6); },
  },
  // 10 sala konferencyjna
  { office: true, P: { wall: '#bfc6d0', wall2: '#a8b0bc', wp: 'panel', lamp: COLD, lampA: .3, office: true, floor: { t: 'carpet', c: '#3a4658' }, ceil: '#e6e9ec', panels: [[48, 20], [48, 56], [48, 92]], ...SKY_DAY, skyT: '#5a8ac8', skyB: '#e6d8c0', frame: '#9aa0a8' },
    back(g, e, P) {
      WIN(g, e, 8, 16, 70, 60, P, { fw: 2, nomull: true }); R(g, 43, 16, 2, 60, '#9aa0a8'); ROLLER(g, 8, 12, 70, 10, '#d8dce0');
      // ekran/projektor i tablica
      R(g, 84, 22, 38, 28, '#20242a'); R(g, 85, 23, 36, 26, '#2a5a9a'); VG(g, 86, 24, 34, 24, '#3a78c0', '#1c3c6a'); R(g, 90, 30, 14, 2, '#fff'); R(g, 90, 36, 22, 1, 'rgba(255,255,255,.6)'); R(g, 90, 40, 18, 1, 'rgba(255,255,255,.6)'); R(e, 86, 24, 34, 24, '#4a88d0'); GL(g, 103, 36, 40, '#6aa0f0', .3);
      PERSON(g, 30, 98, .8, '#b0b8c8', {});
      // stol i krzesla (widok od konca stolu)
      for (const cx of [20, 40, 64, 88, 108]) CHAIR(g, cx, 118, 1, '#262c3c');
      BX(g, 6, 88, 116, 5, '#7a5a3c'); R(g, 6, 88, 116, 1, '#b08a60'); R(g, 20, 93, 4, 30, '#555'); R(g, 104, 93, 4, 30, '#555'); GL(g, 64, 88, 50, '#ffffff', .15);
      // laptopy i papiery
      for (const x of [18, 50, 80]) { R(g, x, 82, 14, 6, '#2a2e36'); R(g, x + 1, 80, 12, 8, '#1a1c20'); R(g, x + 2, 81, 10, 6, '#6aa0d8'); R(e, x + 2, 81, 10, 6, '#6aa0d8'); }
      EL(g, 64, 86, 6, 2, '#fff');
    },
    side(g, e, P) { R(g, 14, 30, 70, 46, '#f4f4f0'); R(g, 14, 30, 70, 2, '#9aa0a8'); R(g, 14, 74, 70, 3, '#9aa0a8'); for (let i = 0; i < 7; i++) R(g, 20, 38 + i * 5, rr_(20, 56), 1, pick(['#2a5a9a', '#c33', '#3a3'])); R(g, 90, 24, 24, 90, '#d0d4d8'); EL(g, 102, 56, 8, 8, '#fff'); BX(g, 94, 100, 18, 22, '#4a5058'); FS(g, 94, 18); },
    floor(g, e, P) { sunPatch(g, 8, 70, .2, '#f0f4ff'); FP(g, 14, 34, 100, 54, '#7a5a3c', 4); for (const cx of [26, 50, 78, 102]) { FP(g, cx - 6, 24, 12, 10, '#262c3c', 4); FP(g, cx - 6, 90, 12, 10, '#262c3c', 4); } },
  },
  // 11 gabinet z tablica
  { office: true, P: { wall: '#cac2b4', wall2: '#bdb4a4', lamp: '#fff0d8', lampA: .3, office: true, floor: { t: 'carpet', c: '#6a6a74' }, ceil: '#e8e5df', panels: [[16, 30], [80, 30], [48, 80]], panelE: '#fff0d8', ...SKY_DAY },
    back(g, e, P) {
      // tablica magnetyczna
      R(g, 8, 18, 62, 42, '#8a8e94'); R(g, 10, 20, 58, 38, '#f6f6f2'); g.strokeStyle = '#2a4a9a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(14, 50); g.lineTo(26, 40); g.lineTo(38, 44); g.lineTo(54, 28); g.stroke();
      for (let i = 0; i < 5; i++) R(g, 14, 24 + i * 3, rr_(14, 30), .8, '#c33'); R(g, 44, 24, 18, 14, 'rgba(60,150,60,.4)'); R(g, 10, 58, 58, 2, '#6a6e74'); R(g, 20, 56, 8, 2, '#c33'); R(g, 32, 56, 8, 2, '#222');
      WIN(g, e, 82, 14, 38, 50, P, { fw: 2 });
      // biurko + monitor + osoba
      PERSON(g, 56, 84, 1, '#3a4a68', { back: false });
      DESK(g, 30, 88, 66, '#7a5a3a', 'drawers'); MON(g, e, 46, 70, 22, 13, 'doc', '#a0c8f0'); R(g, 74, 78, 8, 10, '#fff'); R(g, 76, 76, 4, 2, '#c33'); TABLELAMP(g, e, 90, 88, '#fff0c8');
      CHAIR(g, 56, 126, 1.3, '#202020');
      BX(g, 4, 92, 18, 32, '#5a4a3a'); PLANT(g, 110, 124, 1, true);
    },
    side(g, e, P) { BOOKS(g, 6, 20, 48, 100, 5); DOOR(g, 72, 26, 34, 98, '#8a6a48', { glass: true }); R(g, 110, 40, 12, 16, '#222'); R(g, 111, 41, 10, 14, '#eee'); EL(g, 116, 48, 4, 4, '#fff'); FS(g, 6, 48); },
    floor(g, e, P) { sunPatch(g, 82, 38, .2); rug(g, 24, 22, 84, 66, '#4a5a6a', '#8a98a8'); FP(g, 30, 4, 66, 22, '#7a5a3a', 1); FP(g, 46, 32, 20, 18, '#202020', 9); FP(g, 4, 4, 18, 14, '#5a4a3a', 1); },
  },
  // 12 archiwum z szafami na akta
  { office: true, P: { wall: '#bdbfb6', wall2: '#adb0a6', lamp: '#f4ffe8', lampA: .3, office: true, floor: { t: 'lino', c: '#8a8c84' }, ceil: '#e4e6e0', panels: [[16, 40], [80, 40], [16, 96]], panelE: '#f0ffe8', ...SKY_DAY },
    back(g, e, P) {
      // szafy kartotekowe
      for (let i = 0; i < 4; i++) { const x = 4 + i * 30; BX(g, x, 36, 28, 88, ['#6a7480', '#7a7c70', '#6a7480', '#8a7a60'][i]); for (let j = 0; j < 4; j++) { const y = 40 + j * 20; R(g, x + 2, y, 24, 17, 'rgba(0,0,0,.18)'); R(g, x + 2, y, 24, 1, 'rgba(255,255,255,.22)'); R(g, x + 9, y + 5, 10, 4, '#cfd0cc'); R(g, x + 10, y + 6, 8, 2, '#f4f0d0'); R(g, x + 12, y + 11, 4, 1.4, '#222'); } FS(g, x, 28); }
      // polki z segregatorami
      R(g, 0, 8, 128, 24, 'rgba(0,0,0,.1)'); for (let k = 0; k < 2; k++) { const sy = 12 + k * 12; R(g, 4, sy + 9, 120, 2, '#777'); for (let x = 5; x < 122; x += 5) { const c = pick(['#2a5a9a', '#9a2a2a', '#2a7a4a', '#c8a030', '#555', '#8a8a8a']); R(g, x, sy - rr_(0, 2), 4, 9 + rr_(0, 2), c); R(g, x + 1, sy + 1, 2, 3, '#e8e8e0'); } }
      PERSON(g, 108, 124, .9, '#707a8a', { stand: true, arms: 'down' });
    },
    side(g, e, P) { for (let i = 0; i < 3; i++) { const x = 6 + i * 38; BX(g, x, 30, 34, 94, '#707a86'); for (let j = 0; j < 5; j++) { const y = 34 + j * 17; R(g, x + 2, y, 30, 15, 'rgba(0,0,0,.16)'); R(g, x + 11, y + 5, 12, 4, '#cfd0cc'); } FS(g, x, 34); } R(g, 6, 8, 120, 14, '#8a8c84'); },
    floor(g, e, P) { sunPatch(g, 60, 50, .15); for (let i = 0; i < 4; i++) FP(g, 4 + i * 30, 2, 28, 20, ['#6a7480', '#7a7c70', '#6a7480', '#8a7a60'][i], 1); FP(g, 54, 60, 20, 20, '#a89870', 1); },
  },
  // 13 serwerownia / kserokopiarka
  { office: true, P: { wall: '#7e8590', wall2: '#6e7580', lamp: '#bfe0ff', lampA: .15, office: true, dark: true, floor: { t: 'tile', c: '#4a4e56', c2: '#44484f', s: 16, gloss: .14 }, ceil: '#b8bcc4', panels: [[16, 40], [80, 40]], panelE: '#b8d8ff', ...SKY_DAY },
    back(g, e, P) {
      // szafy rack
      for (let i = 0; i < 3; i++) { const x = 6 + i * 28; BX(g, x, 14, 26, 110, '#16181c'); R(g, x + 2, 16, 22, 106, '#0c0d10');
        for (let u = 0; u < 12; u++) { const y = 18 + u * 8.6; R(g, x + 3, y, 20, 7, '#242830'); R(g, x + 3, y, 20, 1, 'rgba(255,255,255,.1)');
          for (let l = 0; l < 4; l++) { const on = rnd(), c = on < .5 ? '#40ff70' : on < .75 ? '#ffb030' : on < .85 ? '#ff4040' : '#303038'; R(g, x + 15 + l * 2, y + 3, 1.2, 1.2, c); if (c !== '#303038') { R(e, x + 15 + l * 2, y + 3, 1.2, 1.2, c); GL(g, x + 15 + l * 2, y + 3.5, 3, c, .4); } }
          R(g, x + 5, y + 2, 7, 3, '#121418'); }
        GL(e, x + 13, 60, 30, '#3060ff', .1); FS(g, x, 26); }
      // kserokopiarka
      BX(g, 94, 78, 30, 46, '#d8dadc', 2); R(g, 94, 78, 30, 4, '#9a9ea2'); R(g, 100, 86, 14, 8, '#101418'); R(g, 101, 87, 12, 6, '#4aa0e8'); R(e, 101, 87, 12, 6, '#4aa0e8'); GL(g, 107, 90, 16, '#6ab8ff', .3); R(g, 98, 100, 22, 2, '#555'); R(g, 98, 108, 22, 14, '#c0c2c4'); R(g, 98, 102, 22, 1, 'rgba(0,0,0,.3)'); FS(g, 94, 30);
      R(g, 96, 72, 22, 6, '#fff'); R(g, 98, 70, 18, 3, '#e8e8e8');
    },
    side(g, e, P) { for (let i = 0; i < 2; i++) { const x = 8 + i * 30; BX(g, x, 14, 26, 110, '#16181c'); R(g, x + 2, 16, 22, 106, '#0c0d10'); for (let u = 0; u < 12; u++) { const y = 18 + u * 8.6; R(g, x + 3, y, 20, 7, '#242830'); for (let l = 0; l < 3; l++) { const c = pick(['#40ff70', '#40ff70', '#ffb030']); R(g, x + 16 + l * 2, y + 3, 1.2, 1.2, c); R(e, x + 16 + l * 2, y + 3, 1.2, 1.2, c); } } FS(g, x, 26); } DOOR(g, 76, 26, 34, 98, '#4a5058'); R(g, 114, 60, 8, 8, '#c33'); R(e, 114, 60, 8, 8, '#a02020'); },
    floor(g, e, P) { for (let i = 0; i < 3; i++) FP(g, 6 + i * 28, 2, 26, 22, '#16181c', 0); FP(g, 94, 2, 30, 26, '#d8dadc', 2); GL(g, 64, 30, 60, '#4090ff', .12); },
  },
  // 14 recepcja
  { office: true, P: { wall: '#d4cfc4', wall2: '#c4bfb2', lamp: '#fff0d4', lampA: .35, office: true, floor: { t: 'tile', c: '#c8c2b8', c2: '#b8b2a6', s: 32, gloss: .2 }, ceil: '#eeebe4', panels: [[48, 40], [48, 90]], panelE: '#fff0d4', cl: [64, 64], ...SKY_DAY },
    back(g, e, P) {
      // logo na scianie
      R(g, 34, 22, 60, 22, '#232a38'); R(g, 36, 24, 56, 18, '#2c3548'); EL(g, 50, 33, 6, 6, '#e8b830'); R(g, 60, 29, 26, 3, '#f0f0f0'); R(g, 60, 35, 20, 2, '#a8b0c0'); GL(g, 64, 34, 50, '#ffe8a0', .12);
      PERSON(g, 52, 84, .95, '#6a2a3a', { });
      // lada recepcji
      BX(g, 20, 84, 88, 40, '#3a4254'); R(g, 20, 80, 88, 6, '#e8e4dc'); R(g, 20, 80, 88, 1, '#fff'); R(g, 20, 86, 88, 1, 'rgba(0,0,0,.5)'); for (let x = 30; x < 104; x += 14) R(g, x, 90, 1, 32, 'rgba(255,255,255,.08)'); FS(g, 20, 88);
      MON(g, e, 74, 64, 18, 11, 'doc', '#a8d0ff'); R(g, 38, 76, 10, 4, '#222'); R(g, 40, 72, 6, 4, '#eee');
      // kanapa oczekujacych
      RR(g, 2, 90, 16, 32, 3, '#6a5a48'); RR(g, 110, 90, 16, 32, 3, '#6a5a48'); PLANT(g, 120, 100, .8, false);
      PLANT(g, 10, 126, .9, true);
    },
    side(g, e, P) { for (let i = 0; i < 3; i++) PIC(g, 14 + i * 36, 28, 28, 22, i + 2, '#2a2a2a'); BX(g, 14, 98, 100, 26, '#6a5a48'); RR(g, 18, 80, 92, 20, 5, '#7a6a56'); for (let i = 0; i < 3; i++) R(g, 48 + i * 31, 82, 1, 40, 'rgba(0,0,0,.3)'); FS(g, 14, 100); R(g, 16, 66, 20, 14, '#e8e4dc'); },
    floor(g, e, P) { rug(g, 24, 50, 80, 56, '#3a4254', '#c8a850'); FP(g, 20, 6, 88, 26, '#3a4254', 2); FP(g, 44, 34, 14, 14, '#202030', 7); sunPatch(g, 30, 60, .2); },
  },
  // 15 open space programistow (ciemny, ekrany)
  { office: true, P: { wall: '#3a4252', wall2: '#303848', lamp: '#6aa0ff', lampA: .1, dark: true, office: true, floor: { t: 'carpet', c: '#262c38' }, ceil: '#8a909c', panels: [[48, 40]], panelE: '#5070a0', ...SKY_DAY, skyT: '#0c1424', skyB: '#503858' },
    back(g, e, P) {
      WIN(g, e, 6, 10, 116, 40, P, { fw: 2, nomull: true });
      R(g, 4, 76, 120, 3, '#cfd2d6'); R(g, 6, 79, 2, 44, '#555'); R(g, 120, 79, 2, 44, '#555');
      PERSON(g, 29, 99, .95, '#2a3248', { back: true }); PERSON(g, 98, 99, .95, '#4a3a30', { back: true });
      const cols = ['#60a8ff', '#a070ff', '#40d8a0', '#ffa860', '#60a8ff'];
      for (let i = 0; i < 5; i++) { const x = 8 + i * 23; MON(g, e, x, 56, 18, 17, pick(['code', 'code', 'chart']), cols[i]); }
      for (let i = 0; i < 4; i++) CHAIR(g, 22 + i * 23, 126, 1.15, '#14171e');
      R(g, 60, 70, 4, 6, '#ddd'); EL(g, 90, 73, 2.4, 2.8, '#c8c8c8'); R(g, 88, 73, 4, 3, '#a02a2a');
    },
    side(g, e, P) { R(g, 6, 16, 116, 46, '#24282f'); for (let i = 0; i < 3; i++) { R(g, 10 + i * 38, 20, 34, 38, '#e8e8e0'); for (let j = 0; j < 5; j++) R(g, 13 + i * 38, 24 + j * 7, rr_(12, 26), 3, pick(['#f0d060', '#f08090', '#80c0f0', '#90e090'])); } BX(g, 10, 98, 40, 26, '#2a2e36'); R(g, 20, 80, 20, 18, '#d0d4d8'); R(e, 24, 84, 12, 8, '#40ff80'); FS(g, 10, 40); EL(g, 90, 108, 8, 8, '#a02a2a'); R(g, 80, 112, 20, 10, '#30343c'); },
    floor(g, e, P) { for (let i = 0; i < 4; i++) { FP(g, 20 + i * 23 - 4, 14, 22, 14, '#cfd2d6', 0); FP(g, 17 + i * 23, 32, 14, 12, '#14171e', 6); } GL(g, 64, 20, 70, '#4a80ff', .18); },
  },
];

/* ---------------- budowa atlasu ---------------- */
export function makeRoomAtlas() {
  const S = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = c.height = S; return c; };
  const cm = mk(), ce = mk();
  const g = cm.getContext('2d'), e = ce.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, S, S);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  for (let r = 0; r < 16; r++) {
    const rm = ROOMS[r], P = rm.P, ox = (r % 4) * 256, oy = ((r / 4) | 0) * 256;
    rs = 7919 * (r + 1) + 13;
    const tile = (tx, ty, fn) => {
      for (const ctx of [g, e]) { ctx.save(); ctx.translate(ox + tx * 128, oy + ty * 128); ctx.beginPath(); ctx.rect(0, 0, 128, 128); ctx.clip(); }
      fn();
      for (const ctx of [g, e]) ctx.restore();
    };
    tile(0, 0, () => { wallBack(g, P); rm.back(g, e, P); });
    tile(1, 0, () => { wallSide(g, P); rm.side(g, e, P); sideVig(g); });
    tile(0, 1, () => { floorBase(g, P); rm.floor(g, e, P); floorVig(g); });
    tile(1, 1, () => { ceilBase(g, e, P); if (rm.ceilx) rm.ceilx(g, e); });
  }
  // drobny szum (tylko mapa koloru), zeby nie wygladalo plasko
  // (kafelek szumu 256x256 jako wzor — taniej niz getImageData calego atlasu)
  const nc = document.createElement('canvas'); nc.width = nc.height = 256;
  const nx = nc.getContext('2d'), nid = nx.createImageData(256, 256), nd = nid.data;
  let n = 12345;
  for (let i = 0; i < nd.length; i += 4) {
    n = (n * 1664525 + 1013904223) | 0;
    const v = n >>> 24, w = v > 128;
    nd[i] = nd[i + 1] = nd[i + 2] = w ? 255 : 0; nd[i + 3] = Math.abs(v - 128) * .055;
  }
  nx.putImageData(nid, 0, 0);
  g.fillStyle = g.createPattern(nc, 'repeat'); g.fillRect(0, 0, S, S);
  const tex = c => { const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { map: tex(cm), emi: tex(ce), cols: 4, rows: 4, canvas: cm, canvasEmi: ce };
}
// przyciemnienie boczne: gorna krawedz (sufit) i dolna (podloga) widoczne przy ostrym kacie
function sideVig(g) {
  g.fillStyle = LG(g, 0, 128, 0, 112, [[0, 'rgba(0,0,0,.25)'], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 112, 128, 16);
}
