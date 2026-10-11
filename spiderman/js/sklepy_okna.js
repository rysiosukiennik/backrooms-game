// Wnetrza sklepow widoczne przez witryny (interior mapping) - atlas rysowany na canvasie.
//
// UKLAD ATLASU (map: 2048x2048 RGBA, emi: 1024x1024 - ten sam uklad uv, polowa rozdzielczosci):
//   atlas 2048x2560 (rzad 5 = lobby wiez, k=16..19); 16 sklepow (nr k = rzad*4 + kolumna, jak komorki shopTex: SHOPS[k]); kazdy ma blok 512x512 px
//   o lewym gornym rogu (bx, by) = ((k%4)*512, floor(k/4)*512), podzielony na kafle po 256 px:
//     lewy gorny  (bx,     by)      256x256  SCIANA TYLNA   - 4.0 m (x) na 3.06 m (y)
//     prawy gorny (bx+256, by)      256x256  SCIANA BOCZNA  - 7.0 m glebokosci (z, 0 = przod) na 3.06 m; lewa i prawa ta sama
//     lewy dolny  (bx,     by+256)  256x256  PODLOGA        - 4.0 m (x) na 7.0 m; glebokosc rosnie ku GORZE kafla
//     prawy dolny (bx+256, by+256)  256x128  SUFIT          - 4.0 m na 7.0 m; glebokosc rosnie ku gorze
//                 (bx+256, by+384)  256x128  PLAN SRODKOWY  - RGBA, 4.0 m na 2.1 m, stoi w glebokosci 2.6 m
//                                            (lada, ludzie - sylwetki, reszta przezroczysta)
// Pokoj: szerokosc 4 m (cala komorka witryny), wysokosc 3.06 m, glebokosc 7 m.
// emi: to co swieci nocy (lampy, ekrany, neony, piec), reszta czarna. Sprite nie ma emi.
const W = 4, H = 3.06, D = 7, SH = 2.1, ZS = 2.6, BLK = 512, AT = 2048, ATH = 2560;
export const ROOM = { W, H, D, SH, ZS };
// rodzaje wnetrz w kolejnosci SHOPS z miasto.js
export const SHOP_NAMES = ['PIZZA', 'DELI', 'KAWA', 'BANK', 'APTEKA', 'BIURO', 'KWIATY', 'BAR', 'SUSHI', 'SKLEP 24h', 'PIEKARNIA', 'KINO', 'KSIĘGARNIA', 'BURGER', 'LODY', 'FRYZJER'];

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// kafel: rysowanie w metrach (y w gore) w prostokacie atlasu; w trybie emi rysuje tylko to, co ma kolor emi
class Tl {
  constructor(g, emi, ox, oyb, sx, sy, wpx, hpx) { this.g = g; this.emi = emi; this.ox = ox; this.oyb = oyb; this.sx = sx; this.sy = sy; this.wpx = wpx; this.hpx = hpx; }
  begin() { const g = this.g; g.save(); g.beginPath(); g.rect(this.ox, this.oyb - this.hpx, this.wpx, this.hpx); g.clip(); return this; }
  end() { this.g.restore(); }
  f(c, e) { return this.emi ? e : c; }
  rect(x, y, w, h, c, e) { const f = this.f(c, e); if (!f) return; this.g.fillStyle = f; this.g.fillRect(this.ox + x * this.sx, this.oyb - (y + h) * this.sy, w * this.sx, h * this.sy); }
  vg(x, y, w, h, top, bot, e) { // gradient pionowy (gora -> dol)
    if (this.emi) { if (e) this.rect(x, y, w, h, null, e); return; }
    const g = this.g, y0 = this.oyb - (y + h) * this.sy, gr = g.createLinearGradient(0, y0, 0, y0 + h * this.sy); gr.addColorStop(0, top); gr.addColorStop(1, bot);
    g.fillStyle = gr; g.fillRect(this.ox + x * this.sx, y0, w * this.sx, h * this.sy);
  }
  ell(x, y, rx, ry, c, e) { const f = this.f(c, e); if (!f) return; const g = this.g; g.fillStyle = f; g.beginPath(); g.ellipse(this.ox + x * this.sx, this.oyb - y * this.sy, Math.max(0.3, rx * this.sx), Math.max(0.3, ry * this.sy), 0, 0, 7); g.fill(); }
  poly(pts, c, e) { const f = this.f(c, e); if (!f) return; const g = this.g; g.fillStyle = f; g.beginPath(); pts.forEach(([x, y], i) => { const X = this.ox + x * this.sx, Y = this.oyb - y * this.sy; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); g.fill(); }
  line(x0, y0, x1, y1, wm, c, e) { const f = this.f(c, e); if (!f) return; const g = this.g; g.strokeStyle = f; g.lineWidth = Math.max(0.6, wm * (this.sx + this.sy) / 2); g.beginPath(); g.moveTo(this.ox + x0 * this.sx, this.oyb - y0 * this.sy); g.lineTo(this.ox + x1 * this.sx, this.oyb - y1 * this.sy); g.stroke(); }
  txt(s, x, y, size, c, e, align = 'center', font = 'bold 100px Arial') { // size = wysokosc wersalikow w przyblizeniu (m)
    const f = this.f(c, e); if (!f) return; const g = this.g; g.save(); g.translate(this.ox + x * this.sx, this.oyb - y * this.sy); g.scale(size * this.sx / 100, size * this.sy / 100);
    g.font = font; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillStyle = f; g.fillText(s, 0, 0); g.restore();
  }
  glow(x, y, rx, ry, rgb, a) { // miekka plama swiatla (tylko mapa)
    if (this.emi) return; const g = this.g; g.save(); g.globalCompositeOperation = 'lighter'; g.translate(this.ox + x * this.sx, this.oyb - y * this.sy); g.scale(rx * this.sx, ry * this.sy);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1); gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(-1, -1, 2, 2); g.restore();
  }
  speck(x, y, w, h, n, cols, s, R) { if (this.emi) return; for (let i = 0; i < n; i++) this.rect(x + R() * w, y + R() * h, s, s, cols[Math.floor(R() * cols.length)]); }
}

function person(t, x, h, col, o = {}) {
  const c = col || '#1c1816', y0 = o.y0 || 0, sc = h / 1.75, hc = o.head || '#2a2220', sit = o.sit;
  if (!sit) { t.rect(x - 0.14 * sc, y0, 0.11 * sc, h * 0.52, o.legs || c); t.rect(x + 0.03 * sc, y0, 0.11 * sc, h * 0.52, o.legs || c); }
  t.poly([[x - 0.21 * sc, y0 + h * 0.5], [x + 0.21 * sc, y0 + h * 0.5], [x + 0.25 * sc, y0 + h * 0.8], [x + 0.14 * sc, y0 + h * 0.88], [x - 0.14 * sc, y0 + h * 0.88], [x - 0.25 * sc, y0 + h * 0.8]], c);
  t.rect(x - 0.32 * sc, y0 + h * 0.5, 0.09 * sc, h * 0.33, c); t.rect(x + 0.23 * sc, y0 + h * 0.5, 0.09 * sc, h * 0.33, c);
  t.rect(x - 0.035 * sc, y0 + h * 0.86, 0.07 * sc, h * 0.06, hc);
  t.ell(x, y0 + h * 0.95, 0.095 * sc, 0.12 * sc, hc);
  if (o.hat) { t.rect(x - 0.1 * sc, y0 + h * 1.0, 0.2 * sc, 0.12 * sc, o.hat); t.rect(x - 0.12 * sc, y0 + h * 1.0, 0.24 * sc, 0.025, o.hat); }
  if (o.apron) t.rect(x - 0.17 * sc, y0 + h * 0.5, 0.34 * sc, h * 0.3, o.apron);
}

// ---------- wspolne elementy pomieszczenia
// o: wall [gora, dol], wain [wys, kolor], brick [kolor linii], slats kolor, floor typ, fc [a,b], ceil kolor, lamps [[x,z]], lk 'panel'|'round'|'strip'|'pend', lc kolor emi lampy, glow 'r,g,b'
function room(R, o) {
  const { b, s, f, c } = R, rn = R.rn;
  for (const t of [b, s]) {
    t.begin(); t.vg(0, 0, t === b ? W : D, H, o.wall[0], o.wall[1]);
    const len = t === b ? W : D;
    if (o.brick) { for (let y = 0; y < H; y += 0.14) { t.rect(0, y, len, 0.015, o.brick); for (let x = ((y / 0.14) & 1) * 0.15; x < len; x += 0.3) t.rect(x, y, 0.015, 0.14, o.brick); } t.speck(0, 0, len, H, 90, ['rgba(0,0,0,.12)', 'rgba(255,200,150,.07)'], 0.07, rn); }
    if (o.slats) for (let x = 0; x < len; x += 0.18) t.rect(x, 0, 0.012, H, o.slats);
    if (o.wain) { t.rect(0, 0, len, o.wain[0], o.wain[1]); t.rect(0, o.wain[0], len, 0.03, 'rgba(255,255,255,.25)'); }
    t.rect(0, 0, len, 0.1, 'rgba(0,0,0,.35)'); // listwa przypodlogowa
    t.end();
  }
  // podloga
  f.begin();
  const [fa, fb] = o.fc;
  if (o.floor === 'checker') { f.rect(0, 0, W, D, fa); for (let i = 0; i < 8; i++) for (let j = 0; j < 14; j++) if ((i + j) & 1) f.rect(i * 0.5, j * 0.5, 0.5, 0.5, fb); }
  else if (o.floor === 'wood') { f.rect(0, 0, W, D, fa); for (let j = 0; j < 28; j++) { f.rect(0, j * 0.25, W, 0.01, 'rgba(0,0,0,.35)'); if (j & 1) f.rect(0, j * 0.25, W, 0.25, 'rgba(0,0,0,.06)'); for (let x = (j * 0.37) % 0.9; x < W; x += 0.9) f.rect(x, j * 0.25, 0.01, 0.25, 'rgba(0,0,0,.3)'); } }
  else if (o.floor === 'tile') { f.rect(0, 0, W, D, fa); for (let i = 0; i <= 8; i++) f.rect(i * 0.5 - 0.01, 0, 0.02, D, fb); for (let j = 0; j <= 14; j++) f.rect(0, j * 0.5 - 0.01, W, 0.02, fb); }
  else { f.rect(0, 0, W, D, fa); f.speck(0, 0, W, D, 900, [fb, 'rgba(0,0,0,.18)', 'rgba(255,255,255,.07)'], 0.05, rn); }
  f.end();
  // sufit
  c.begin(); c.rect(0, 0, W, D, o.ceil || '#cfc8bd'); for (let z = 0; z < D; z += 0.7) c.rect(0, z, W, 0.015, 'rgba(0,0,0,.22)'); c.end();
  // lampy
  const lc = o.lc || '#ffe9c0', rgb = o.glow || '255,214,150';
  for (const [x, z] of o.lamps) {
    c.begin();
    if (o.lk === 'strip') { c.rect(x - 0.9, z - 0.08, 1.8, 0.16, '#f3f3ee', lc); }
    else if (o.lk === 'round' || o.lk === 'pend') { c.ell(x, z, 0.22, 0.4, '#fff', lc); }
    else c.rect(x - 0.3, z - 0.3, 0.6, 0.6, '#f6f4ee', lc);
    c.end();
    f.begin(); f.glow(x, z, 1.5, 3.2, rgb, 0.5); f.glow(x, z, 0.7, 1.4, rgb, 0.3); f.end();
    b.begin(); const zz = D - z; b.glow(x, H * 0.75, 1.3 + zz * 0.04, 1.3, rgb, 0.13 + z * 0.012); b.end();
    s.begin(); s.glow(z, H * 0.7, 1.6, 1.3, rgb, 0.1); s.end();
    if (o.lk === 'pend') { b.begin(); b.rect(x - 0.01, H - 0.6 + 0.35, 0.02, 0.6, '#222'); b.ell(x, H - 0.62 + 0.35, 0.17, 0.12, '#2a2118', lc); b.glow(x, H - 0.9, 0.5, 0.5, rgb, 0.25); b.end(); }
  }
  f.begin(); const sh = f.g; if (!f.emi) { sh.fillStyle = 'rgba(0,0,0,.18)'; } f.end(); // (rezerwa)
}
function foot(R, x0, x1, z0, z1, c) { R.f.begin(); R.f.rect(x0, z0, x1 - x0, z1 - z0, c || 'rgba(20,12,8,.8)'); R.f.rect(x0, z0 - 0.04, x1 - x0, 0.04, 'rgba(0,0,0,.35)'); R.f.end(); }
function table(R, x, z, r, c) { R.f.begin(); R.f.ell(x, z, r, r, 'rgba(0,0,0,.3)'); R.f.ell(x, z, r * 0.9, r * 0.9, c || '#6b4a30'); for (const a of [0.5, 2.1, 3.7, 5.3]) R.f.ell(x + Math.cos(a) * (r + 0.25), z + Math.sin(a) * (r + 0.25), 0.17, 0.17, '#2b2018'); R.f.end(); }
// regal z towarem: kolumny kolorowych pudelek na polkach
function shelf(t, x, y, w, h, rows, pal, R, dens = 0.8, frame = '#4a4034') {
  t.rect(x, y, w, h, frame); t.rect(x + 0.03, y + 0.03, w - 0.06, h - 0.06, 'rgba(0,0,0,.45)');
  const rh = (h - 0.05) / rows;
  for (let r = 0; r < rows; r++) {
    const yy = y + 0.03 + r * rh;
    for (let xx = x + 0.05; xx < x + w - 0.08; xx += 0.05 + R() * 0.09) { if (R() > dens) continue; const ph = rh * (0.4 + R() * 0.5), pw = 0.04 + R() * 0.07; t.rect(xx, yy + 0.025, Math.min(pw, x + w - 0.04 - xx), ph, pal[Math.floor(R() * pal.length)]); }
    t.rect(x + 0.02, yy, w - 0.04, 0.03, '#b8b0a2');
  }
}
function counter(R, x0, x1, hgt, body, top, glass) {
  const p = R.p; p.begin(); p.rect(x0, 0, x1 - x0, hgt, body); p.rect(x0 - 0.03, hgt - 0.04, x1 - x0 + 0.06, 0.06, top);
  p.rect(x0, 0, x1 - x0, 0.08, 'rgba(0,0,0,.45)');
  if (glass) { p.rect(x0 + 0.05, hgt + 0.02, x1 - x0 - 0.1, 0.34, 'rgba(190,225,240,.22)'); p.rect(x0 + 0.05, hgt + 0.36, x1 - x0 - 0.1, 0.02, 'rgba(220,240,255,.5)'); }
  p.end(); foot(R, x0, x1, ZS - 0.4, ZS + 0.3);
}
function menuBoard(t, x, y, w, h, title, lines, bg, fg, e) {
  t.rect(x - 0.04, y - 0.04, w + 0.08, h + 0.08, '#1a1511'); t.rect(x, y, w, h, bg, e ? 'rgba(255,230,180,.55)' : null);
  t.txt(title, x + w / 2, y + h - 0.2, 0.15, fg, e); lines.forEach((l, i) => { t.txt(l, x + 0.07, y + h - 0.42 - i * 0.17, 0.09, fg, e, 'left', '100px Arial'); t.rect(x + w - 0.38, y + h - 0.47 - i * 0.17, 0.28, 0.012, fg, e); });
}
function monitor(t, x, y, w, h, scr, e) { t.rect(x, y, w, h, '#14161a'); t.rect(x + 0.02, y + 0.02, w - 0.04, h - 0.04, scr, e || scr); t.rect(x + w / 2 - 0.02, y - 0.07, 0.04, 0.07, '#222'); t.rect(x + w / 2 - 0.1, y - 0.08, 0.2, 0.015, '#222'); }

const FNS = [];
// 0 PIZZA
FNS[0] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#8c4a30', '#5e2c1b'], brick: 'rgba(40,15,8,.45)', floor: 'checker', fc: ['#d9cdb4', '#a3281f'], lamps: [[1.0, 2.0], [3.0, 3.8], [1.0, 5.6], [3.0, 5.6]], lk: 'pend', glow: '255,170,90', lc: '#ffc27a' });
  b.begin(); b.rect(1.25, 0.9, 1.5, 1.2, '#2b2420'); b.poly([[1.25, 2.1], [1.45, 2.55], [1.9, 2.8], [2.1, 2.8], [2.55, 2.55], [2.75, 2.1]], '#33291f'); b.poly([[1.45, 0.9], [1.45, 1.7], [1.6, 1.95], [2.4, 1.95], [2.55, 1.7], [2.55, 0.9]], '#0d0805', '#ff7a1a');
  b.glow(2, 1.3, 1.1, 0.9, '255,130,40', 0.45); b.rect(1.45, 0.9, 1.1, 0.12, '#7a2408', '#ff4a08'); b.rect(1.1, 0.8, 1.8, 0.12, '#554638'); b.rect(1.15, 0, 1.7, 0.8, '#3a2f27');
  menuBoard(b, 3.0, 1.2, 0.85, 1.25, 'PIZZA', ['Margherita', 'Funghi', 'Diavola', 'Quattro'], '#20302a', '#f2eedf', true);
  b.rect(0.15, 1.6, 0.8, 0.04, '#5a3a22'); for (let i = 0; i < 6; i++) b.rect(0.2 + i * 0.12, 1.64, 0.07, 0.3, ['#3b6b2a', '#8a1c1c', '#c9a227'][i % 3]); b.end();
  s.begin(); s.rect(0.5, 1.2, 1.6, 0.05, '#5a3a22'); for (let i = 0; i < 9; i++) s.rect(0.6 + i * 0.16, 1.25, 0.08, 0.3, ['#2d5a2a', '#7a1c1c', '#c9a227'][i % 3]); s.rect(4, 0.8, 2, 1.3, 'rgba(0,0,0,.25)'); s.end();
  counter(R, 0.3, 2.4, 1.0, '#8a2a1c', '#d7ccb6', false);
  p.begin(); person(p, 1.35, 1.75, '#ece6d6', { hat: '#ece6d6', apron: '#f4efe2' }); p.rect(0.7, 1.0, 0.45, 0.07, '#d8c8a0'); p.rect(0.7, 1.07, 0.45, 0.06, '#c9b88c'); p.end();
  p.begin(); person(p, 3.15, 1.78, '#2c3340'); p.end(); table(R, 3.2, 4.0, 0.45); table(R, 0.9, 5.2, 0.4);
  p.begin(); p.rect(0.2, 1.0, 0.1, 0.08, 'rgba(0,0,0,0)'); p.end();
};
// 1 DELI
FNS[1] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#e9e2cf', '#cfc6af'], wain: [0.9, '#2f6b3f'], floor: 'checker', fc: ['#d8d2c0', '#b4ad98'], lamps: [[1.0, 2.3], [3.0, 2.3], [1.0, 5.0], [3.0, 5.0]], lk: 'panel', lc: '#fff4d8', glow: '255,235,190' });
  b.begin(); const pal = ['#c0392b', '#e9c46a', '#2a9d8f', '#f4f1de', '#e76f51', '#457b9d', '#6a994e', '#8d5a2b'];
  shelf(b, 0.2, 0.7, 1.7, 2.1, 5, pal, rn, 0.9); shelf(b, 2.1, 0.7, 1.7, 2.1, 5, pal, rn, 0.9); b.rect(0.2, 2.9, 3.6, 0.1, '#2f6b3f'); b.txt('DELI', 2, 2.93, 0.08, '#fff', null); b.end();
  s.begin(); shelf(s, 2.4, 0.5, 4.2, 2.0, 5, pal, rn, 0.85); s.end();
  counter(R, 0.3, 3.0, 1.0, '#e8e4da', '#555', true);
  p.begin(); for (let i = 0; i < 12; i++) p.rect(0.4 + i * 0.2, 1.04, 0.14, 0.12, ['#b5483a', '#e3b04b', '#d9c9a0', '#8a5a3a'][i % 4]); p.rect(2.6, 1.04, 0.3, 0.22, '#aaa'); p.end();
  p.begin(); person(p, 1.5, 1.72, '#f0ede4', { apron: '#fff', hat: '#f0ede4' }); p.end(); p.begin(); p.rect(0.3, 0.0, 2.7, 0.0, '#000'); p.end();
  p.begin(); person(p, 3.4, 1.7, '#352c28'); p.end();
};
// 2 KAWA
FNS[2] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#4a3426', '#2c1d14'], slats: 'rgba(0,0,0,.25)', floor: 'wood', fc: ['#6f4a2e'], lamps: [[1.0, 2.2], [3.0, 4.0], [1.0, 5.4]], lk: 'pend', glow: '255,180,100', lc: '#ffc070' });
  b.begin(); b.rect(0.2, 0, 3.6, 1.0, '#3b2a1f'); b.rect(0.15, 0.98, 3.7, 0.06, '#8d6a48');
  b.rect(0.5, 1.04, 0.9, 0.55, '#a8aab0'); b.rect(0.6, 1.5, 0.7, 0.2, '#85878e'); b.ell(0.8, 1.2, 0.05, 0.05, '#222'); b.ell(1.1, 1.2, 0.05, 0.05, '#222'); b.rect(1.6, 1.04, 0.15, 0.12, '#eee'); b.rect(1.8, 1.04, 0.15, 0.12, '#eee');
  menuBoard(b, 2.4, 1.5, 1.2, 1.1, 'KAWA', ['Espresso', 'Latte', 'Cappuccino', 'Flat white'], '#1d211e', '#f2ead8', true);
  b.rect(0.3, 1.9, 1.7, 0.05, '#6e4e32'); for (let i = 0; i < 8; i++) b.rect(0.4 + i * 0.2, 1.95, 0.14, 0.3, ['#d8d0c0', '#7a4a2a', '#3a6a6a'][i % 3]); b.rect(0.3, 2.45, 1.7, 0.05, '#6e4e32'); for (let i = 0; i < 8; i++) b.rect(0.4 + i * 0.2, 2.5, 0.14, 0.3, ['#d8d0c0', '#7a4a2a', '#3a6a6a'][(i + 1) % 3]); b.end();
  s.begin(); s.rect(1.5, 1.0, 4.5, 0.05, '#6e4e32'); s.end();
  counter(R, 0.2, 2.6, 1.05, '#5a3c26', '#2a1c12', false);
  p.begin(); p.rect(0.5, 1.08, 0.22, 0.2, '#ddd'); person(p, 1.6, 1.74, '#2a2220', { apron: '#4a3a30' }); p.end();
  p.begin(); person(p, 3.3, 1.3, '#4a5a66', { sit: true, y0: 0.45 }); p.rect(2.9, 0.72, 0.8, 0.05, '#7a5a3a'); p.rect(3.27, 0.0, 0.06, 0.72, '#2a1c12'); p.rect(3.05, 0.8, 0.3, 0.2, '#aaa', null); p.end();
  table(R, 3.2, 2.7, 0.4); table(R, 3.1, 4.8, 0.42); table(R, 0.9, 5.5, 0.4);
};
// 3 BANK
FNS[3] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#dfe3e6', '#bcc4ca'], wain: [0.3, '#2c4a6e'], floor: 'carpet', fc: ['#566471', '#6d7b88'], ceil: '#e8ebee', lamps: [[1.0, 1.8], [3.0, 1.8], [1.0, 4.2], [3.0, 4.2], [2.0, 6.2]], lk: 'panel', lc: '#f0f6ff', glow: '210,225,255' });
  b.begin(); b.rect(0.4, 1.5, 3.2, 1.2, '#1b3556'); b.txt('BANK', 2.0, 1.85, 0.5, '#e8eef6', '#cfe4ff'); b.rect(0.55, 1.6, 2.9, 0.03, '#d4a63c', '#aa8420'); b.rect(0.2, 0, 0.5, 0.9, '#2d5a38'); b.ell(0.45, 1.05, 0.3, 0.3, '#3e7a4a'); b.ell(3.6, 1.0, 0.3, 0.3, '#3e7a4a'); b.rect(3.35, 0, 0.5, 0.8, '#3b3f44'); b.end();
  s.begin(); for (let z = 0.4; z < 6; z += 2.1) { s.rect(z, 0.9, 1.6, 1.5, 'rgba(160,200,230,.18)'); s.rect(z, 0.9, 1.6, 0.03, '#8a98a6'); s.rect(z, 2.4, 1.6, 0.03, '#8a98a6'); s.rect(z + 0.8, 0.9, 0.03, 1.5, '#8a98a6'); } s.end();
  p.begin(); for (const x of [0.2, 1.5, 2.8]) { p.rect(x, 0, 1.15, 0.78, '#5a4a38'); p.rect(x - 0.03, 0.76, 1.21, 0.05, '#c8c0b0'); }
  person(p, 0.75, 1.3, '#26303c', { sit: true, y0: 0.45 }); p.rect(0.2, 0, 1.15, 0.78, '#5a4a38'); p.rect(0.17, 0.76, 1.21, 0.05, '#c8c0b0'); person(p, 3.4, 1.75, '#262c34'); p.end();
  for (const x of [0.5, 1.8, 3.1]) { p.begin(); p.rect(x, 0.81, 0.3, 0.22, '#14161a'); p.rect(x + 0.02, 0.83, 0.26, 0.18, '#9cc4ee'); p.end(); }
  foot(R, 0.2, 1.35, 2.3, 2.9, '#3a2c20'); foot(R, 1.5, 2.65, 2.3, 2.9, '#3a2c20'); foot(R, 2.8, 3.95, 2.3, 2.9, '#3a2c20');
};
// 4 APTEKA
FNS[4] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#f4f6f4', '#dbe3dc'], wain: [0.35, '#2f8f4e'], floor: 'tile', fc: ['#e8ece8', '#c0c8c0'], ceil: '#f2f4f2', lamps: [[1.0, 2.0], [3.0, 2.0], [1.0, 4.6], [3.0, 4.6], [2.0, 6.4]], lk: 'strip', lc: '#f4fff8', glow: '230,255,235' });
  b.begin(); const pal = ['#ffffff', '#e8f0ea', '#3d9a5a', '#c6dfcc', '#f2c14e', '#d9534f'];
  shelf(b, 0.2, 0.5, 3.6, 1.7, 6, pal, rn, 0.95, '#c9d2cb'); b.rect(1.65, 2.35, 0.7, 0.2, '#2f8f4e', '#4cf08a'); b.rect(1.85, 2.2, 0.3, 0.7, '#2f8f4e', '#4cf08a'); b.rect(1.65, 2.55, 0.7, 0.2, '#2f8f4e', '#4cf08a'); b.rect(1.75, 2.35, 0.5, 0.0, '#fff'); b.end();
  s.begin(); shelf(s, 2.5, 0.5, 4.0, 1.9, 6, pal, rn, 0.9, '#c9d2cb'); s.end();
  counter(R, 0.3, 3.1, 1.0, '#f2f4f2', '#7a8a7e', false);
  p.begin(); p.rect(0.3, 0.45, 2.8, 0.06, '#2f8f4e'); p.rect(1.0, 1.05, 0.5, 0.35, '#14161a'); p.rect(1.03, 1.08, 0.44, 0.29, '#a6d4ff'); person(p, 2.2, 1.75, '#f1f3f1', { hat: null, head: '#2a2220' }); p.end();
  p.begin(); person(p, 3.5, 1.7, '#3a3028'); p.end();
};
// 5 BIURO
FNS[5] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#e4e4e0', '#cbcac4'], floor: 'carpet', fc: ['#50606e', '#6a7a88'], ceil: '#ebebe8', lamps: [[1.0, 1.8], [3.0, 1.8], [1.0, 4.0], [3.0, 4.0], [1.0, 6.0], [3.0, 6.0]], lk: 'strip', lc: '#f2f8ff', glow: '215,230,255' });
  b.begin(); b.rect(0.4, 0.9, 1.9, 1.5, '#7ab0d8', '#8fc3ec'); b.vg(0.4, 0.9, 1.9, 1.5, '#9ac8ec', '#e7d6bc'); for (let i = 0; i < 7; i++) b.rect(0.45 + i * 0.26, 0.9, 0.18, 0.3 + rn() * 0.7, '#4a5868'); b.rect(0.35, 0.85, 2.0, 0.05, '#555'); b.rect(0.35, 2.4, 2.0, 0.05, '#555');
  b.rect(2.7, 1.2, 1.0, 1.0, '#f4f4f0'); b.rect(2.8, 1.8, 0.5, 0.03, '#2a6ab0'); b.rect(2.8, 1.6, 0.7, 0.03, '#b02a2a'); b.rect(2.8, 1.4, 0.4, 0.03, '#2a6ab0'); b.rect(0.3, 0, 0.3, 0.8, '#2d5a38'); b.ell(0.45, 0.95, 0.3, 0.28, '#3e7a4a'); b.end();
  s.begin(); s.rect(1.0, 0.9, 1.0, 1.4, 'rgba(180,200,220,.2)'); s.rect(3.0, 0.9, 1.0, 1.4, 'rgba(180,200,220,.2)'); s.rect(5.0, 0.9, 1.0, 1.4, 'rgba(180,200,220,.2)'); s.end();
  p.begin(); for (const x of [0.15, 2.1]) { person(p, x + 0.6, 1.3, x < 1 ? '#3a4a60' : '#5a3a3a', { sit: true, y0: 0.45 }); p.rect(x, 0, 1.4, 0.74, '#6a604f'); p.rect(x - 0.03, 0.72, 1.46, 0.05, '#cfc7b4'); p.rect(x + 0.4, 0.77, 0.4, 0.28, '#14161a'); p.rect(x + 0.43, 0.8, 0.34, 0.22, '#7fb4f0', '#4a90e0'); p.rect(x + 1.0, 0.77, 0.15, 0.06, '#333'); }
  person(p, 3.7, 1.74, '#2a303a'); p.end();
  foot(R, 0.15, 1.55, 2.3, 2.9, '#3a3a40'); foot(R, 2.1, 3.5, 2.3, 2.9, '#3a3a40');
};
// 6 KWIATY
FNS[6] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#e1ead6', '#b8c9a8'], wain: [0.5, '#7a5a3a'], floor: 'wood', fc: ['#a58a66'], lamps: [[1.0, 2.2], [3.0, 3.8], [2.0, 5.6]], lk: 'round', lc: '#ffeab8', glow: '255,230,170' });
  const bl = ['#e8467c', '#f4c430', '#ffffff', '#b35fd8', '#ff7a45', '#ff3b3b'];
  b.begin(); for (let i = 0; i < 3; i++) { const y = 0.5 + i * 0.75; b.rect(0.2, y, 3.6, 0.05, '#6a4a2c'); for (let x = 0.3; x < 3.7; x += 0.28) { b.rect(x - 0.005, y + 0.05, 0.01, 0.2, '#3a7a2a'); b.ell(x, y + 0.34, 0.1, 0.1, bl[Math.floor(rn() * bl.length)]); b.rect(x - 0.07, y + 0.05, 0.14, 0.14, '#a85a3a'); } }
  for (let x = 0.3; x < 3.7; x += 0.18) b.ell(x, 2.9, 0.025, 0.025, '#ffd890', '#ffc860'); b.end();
  s.begin(); for (let i = 0; i < 3; i++) { const y = 0.5 + i * 0.75; s.rect(1.5, y, 4.5, 0.05, '#6a4a2c'); for (let x = 1.6; x < 6; x += 0.3) s.ell(x, y + 0.3, 0.1, 0.1, bl[Math.floor(rn() * bl.length)]); } s.end();
  p.begin(); p.rect(0.2, 0.0, 2.2, 0.7, '#7a5a3a'); p.rect(0.15, 0.68, 2.3, 0.05, '#a4825a'); for (let i = 0; i < 6; i++) { const x = 0.4 + i * 0.35; p.rect(x - 0.12, 0.73, 0.24, 0.3, '#4a6a78'); for (let k = 0; k < 4; k++) { p.rect(x - 0.1 + k * 0.06, 1.0, 0.012, 0.35, '#3a7a2a'); p.ell(x - 0.09 + k * 0.06 + (rn() - .5) * 0.1, 1.38 + rn() * 0.2, 0.08, 0.08, bl[Math.floor(rn() * bl.length)]); } }
  person(p, 3.2, 1.65, '#6a3a52', { head: '#3a2a26' }); p.end(); foot(R, 0.2, 2.45, 2.3, 2.9, '#4a3220');
};
// 7 BAR
FNS[7] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#2e1a16', '#170c0a'], slats: 'rgba(0,0,0,.4)', floor: 'wood', fc: ['#3a2418'], ceil: '#1c1411', lamps: [[1.0, 2.0], [3.0, 3.2], [2.0, 5.0]], lk: 'pend', lc: '#ff9a40', glow: '255,150,70' });
  b.begin(); b.rect(0.3, 0.9, 3.4, 1.8, '#1a0f0b'); b.vg(0.35, 0.95, 3.3, 1.7, '#7a4a1c', '#3a1c08', '#c06a1a'); for (let y of [1.3, 1.85, 2.4]) b.rect(0.3, y, 3.4, 0.05, '#4a3020', '#a0541a');
  for (let r = 0; r < 3; r++) for (let x = 0.4; x < 3.6; x += 0.2 + rn() * 0.15) { const h = 0.2 + rn() * 0.2; const c = ['#2a6a3a', '#8a3a1a', '#c9a227', '#2a4a8a', '#6a2a2a'][Math.floor(rn() * 5)]; b.rect(x, [1.35, 1.9, 2.45][r], 0.09, h, c); b.rect(x + 0.025, [1.35, 1.9, 2.45][r] + h, 0.04, 0.1, c); }
  b.txt('BAR', 2.0, 2.78, 0.3, '#ff7ac0', '#ff3a9a'); b.rect(0, 0, 4, 0.9, '#2a1a12'); b.end();
  s.begin(); s.rect(1.0, 2.2, 0.8, 0.5, '#ff3a9a', '#ff3a9a'); s.rect(1.05, 2.25, 0.7, 0.4, '#1a0f0b', '#0a0204'); s.rect(3.0, 1.8, 2.0, 0.04, '#ff9a40', '#a05010'); s.end();
  counter(R, 0.15, 3.65, 1.05, '#3a2216', '#7a5030', false);
  p.begin(); p.rect(0.15, 0.6, 3.5, 0.03, '#b88a50'); for (let i = 0; i < 6; i++) p.rect(0.4 + i * 0.55, 1.1, 0.08, 0.16, 'rgba(255,200,120,.55)'); p.end();
  p.begin(); for (const [x, c] of [[0.6, '#1a1412'], [1.7, '#2a1c20'], [2.9, '#14181e']]) { person(p, x, 1.3, c, { sit: true, y0: 0.5 }); p.rect(x - 0.01, 0.0, 0.02, 0.5, '#222'); p.ell(x, 0.5, 0.17, 0.04, '#6a1a1a'); } person(p, 2.2, 1.75, '#161212', { apron: '#222' }); p.end();
};
// 8 SUSHI
FNS[8] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#2a2420', '#161210'], slats: 'rgba(120,80,50,.35)', floor: 'wood', fc: ['#4a3020'], lamps: [[1.0, 2.2], [3.0, 2.2], [1.0, 4.6], [3.0, 4.6]], lk: 'round', lc: '#ff6a40', glow: '255,110,70' });
  b.begin(); for (const x of [0.4, 1.4, 2.4]) { b.rect(x, 1.5, 0.9, 1.4, '#a02020'); b.rect(x + 0.45, 1.5, 0.02, 1.4, 'rgba(0,0,0,.4)'); b.rect(x, 2.9, 0.9, 0.05, '#222'); b.txt('SUSHI', x + 0.45, 1.8, 0.16, '#f0e0c8', null); }
  b.rect(3.3, 1.5, 0.5, 1.4, '#8a6a40'); b.ell(3.55, 2.1, 0.18, 0.18, '#d83a2a', '#ff3a1a'); b.glow(3.55, 2.1, 0.5, 0.5, '255,80,40', 0.3);
  b.rect(0.3, 0.9, 3.5, 0.05, '#7a5a3a'); for (let i = 0; i < 9; i++) b.rect(0.4 + i * 0.37, 0.95, 0.1, 0.35, ['#e8e0d0', '#2a6a4a', '#a08040'][i % 3]); b.end();
  s.begin(); s.ell(2.5, 2.2, 0.25, 0.25, '#d83a2a', '#ff3a1a'); s.ell(4.5, 2.2, 0.25, 0.25, '#d83a2a', '#ff3a1a'); s.end();
  counter(R, 0.2, 3.7, 0.95, '#6a4a2c', '#d4b888', false);
  p.begin(); for (let i = 0; i < 8; i++) { p.ell(0.5 + i * 0.4, 1.0, 0.1, 0.02, '#f0ece4'); p.rect(0.43 + i * 0.4, 1.0, 0.14, 0.06, ['#e8683a', '#f0a090', '#e8e0c8', '#d84a3a'][i % 4]); } person(p, 1.6, 1.75, '#f0ede4', { hat: '#f4f0e8', apron: '#fff' }); person(p, 3.1, 1.75, '#161212'); p.end();
};
// 9 SKLEP 24h
FNS[9] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#f1f1ee', '#d6d6d0'], floor: 'tile', fc: ['#e6e6e2', '#bfbfba'], ceil: '#f0f0ee', lamps: [[1.0, 2.0], [3.0, 2.0], [1.0, 4.4], [3.0, 4.4], [2.0, 6.4]], lk: 'strip', lc: '#fbfff4', glow: '240,250,230' });
  b.begin(); b.rect(0.2, 0.2, 3.6, 2.5, '#aeb7bc'); b.rect(0.25, 0.25, 3.5, 2.4, '#d6ecf6', '#8fc8e8'); b.glow(2, 1.5, 1.6, 1.3, '200,235,255', 0.2);
  const dr = ['#d83a2a', '#2a6ad8', '#f0c030', '#2aa06a', '#e8e0d0', '#a02a8a'];
  for (let r = 0; r < 4; r++) { b.rect(0.25, 0.4 + r * 0.6, 3.5, 0.03, '#8a949a'); for (let x = 0.3; x < 3.7; x += 0.12) b.rect(x, 0.45 + r * 0.6, 0.08, 0.4 + rn() * 0.08, dr[Math.floor(rn() * 6)]); } for (let x of [1.4, 2.6]) b.rect(x, 0.2, 0.04, 2.5, '#6a747a'); b.end();
  s.begin(); shelf(s, 3.0, 0.4, 3.6, 1.8, 5, dr, rn, 0.9, '#8a949a'); s.end();
  foot(R, 0.4, 1.3, 3.8, 6.0, '#a8a8a2'); foot(R, 2.7, 3.6, 3.8, 6.0, '#a8a8a2');
  counter(R, 2.0, 3.8, 1.0, '#cfd3d6', '#333', false);
  p.begin(); p.rect(2.1, 1.05, 0.35, 0.3, '#14161a'); p.rect(2.13, 1.1, 0.29, 0.2, '#8fe0a0', '#40e070'); person(p, 3.1, 1.7, '#3a4a8a', { apron: '#c82a2a' }); person(p, 0.9, 1.78, '#4a3a30'); p.rect(0.0, 0.0, 0.0, 0.0, '#000'); p.end();
  p.begin(); for (let x of [0.2, 1.6]) { p.rect(x, 0, 0.9, 1.5, '#cfd3d6'); p.rect(x + 0.05, 0.15, 0.8, 1.3, '#d6ecf6'); for (let k = 0; k < 4; k++) p.rect(x + 0.1, 0.25 + k * 0.3, 0.7, 0.05, dr[k]); } p.end();
};
// 10 PIEKARNIA
FNS[10] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#e8d3a8', '#c8a878'], wain: [0.9, '#8a5a30'], floor: 'tile', fc: ['#b8642f', '#8e4620'], lamps: [[1.0, 2.2], [3.0, 3.8], [1.0, 5.6], [3.0, 5.6]], lk: 'pend', lc: '#ffcf80', glow: '255,200,120' });
  b.begin(); b.rect(0.2, 0.5, 3.6, 2.4, '#6a4426'); b.rect(0.28, 0.58, 3.44, 2.24, '#2a1a0e'); const br = ['#b8742e', '#d09040', '#a05a22', '#e0a850'];
  for (let r = 0; r < 4; r++) { const y = 0.65 + r * 0.55; b.rect(0.28, y, 3.44, 0.04, '#8a5a30'); for (let x = 0.35; x < 3.6; x += 0.3) { if (r % 2) { b.poly([[x, y + 0.04], [x + 0.2, y + 0.45], [x + 0.26, y + 0.43], [x + 0.07, y + 0.04]], br[Math.floor(rn() * 4)]); } else { b.ell(x + 0.1, y + 0.17, 0.12, 0.13, br[Math.floor(rn() * 4)]); } } }
  b.glow(2, 1.6, 1.8, 1.4, '255,190,100', 0.2); b.end();
  s.begin(); s.rect(0.5, 1.4, 5.5, 0.06, '#6a4426'); for (let x = 0.6; x < 6; x += 0.45) s.ell(x, 1.58, 0.15, 0.13, br[Math.floor(rn() * 4)]); s.end();
  counter(R, 0.2, 3.2, 1.0, '#7a4a28', '#e8dcc0', true);
  p.begin(); for (let i = 0; i < 6; i++) p.ell(0.5 + i * 0.4, 1.12, 0.14, 0.1, br[i % 4]); p.rect(2.5, 1.04, 0.5, 0.25, '#7a5a30'); person(p, 1.5, 1.72, '#f0ebe0', { hat: '#f4efe6', apron: '#fff' }); p.end();
  p.begin(); person(p, 3.5, 1.7, '#4a3a42'); p.end();
};
// 11 KINO
FNS[11] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#2a1536', '#150a1c'], floor: 'carpet', fc: ['#5a1a22', '#7a2a30'], ceil: '#120a16', lamps: [[1.0, 2.0], [3.0, 2.0], [1.0, 4.4], [3.0, 4.4]], lk: 'round', lc: '#ffa860', glow: '255,160,110' });
  b.begin(); const pc = [['#b02a2a', '#e8a030'], ['#2a4ab0', '#60d0e8'], ['#2a8a4a', '#d0e040'], ['#8a2ab0', '#f080a0']];
  for (let i = 0; i < 4; i++) { const x = 0.3 + i * 0.9, c = pc[i]; b.vg(x, 1.0, 0.7, 1.4, c[0], c[1], c[1]); b.rect(x - 0.03, 0.97, 0.76, 0.03, '#d8c890'); b.rect(x - 0.03, 2.4, 0.76, 0.03, '#d8c890'); b.ell(x + 0.35, 1.75, 0.15, 0.15, 'rgba(0,0,0,.55)'); b.rect(x + 0.2, 1.1, 0.3, 0.12, 'rgba(255,255,255,.7)'); }
  b.txt('KINO', 2.0, 2.6, 0.28, '#ffd8a0', '#ffb050'); b.rect(0.2, 0, 3.6, 0.06, '#e03a8a', '#ff3aa0'); b.end();
  s.begin(); for (let i = 0; i < 3; i++) { s.vg(1.0 + i * 1.8, 1.0, 1.0, 1.3, pc[i][0], pc[i][1], pc[i][1]); } s.rect(0, 2.9, 7, 0.05, '#3a8aff', '#2a6aff'); s.end();
  c: { R.c.begin(); R.c.speck(0, 0, W, D, 50, ['#fff'], 0.03, rn); for (let i = 0; i < 40; i++) R.c.ell(rn() * W, rn() * D, 0.025, 0.025, '#fff', '#ffe8c0'); R.c.end(); }
  counter(R, 0.3, 2.0, 1.0, '#7a1a1a', '#d8c070', false);
  p.begin(); p.rect(0.55, 1.05, 0.5, 0.6, 'rgba(255,230,150,.55)', null); p.rect(0.55, 1.05, 0.5, 0.06, '#c82a2a'); p.rect(0.5, 1.65, 0.6, 0.06, '#c82a2a'); p.poly([[0.55, 1.1], [0.5, 1.65], [1.1, 1.65], [1.05, 1.1]], '#e8c050'); p.rect(1.3, 1.04, 0.5, 0.3, '#14161a'); person(p, 1.5, 1.72, '#261a1e', { apron: '#c82a2a' }); person(p, 3.0, 1.75, '#1a1a24'); person(p, 3.5, 1.5, '#241a20'); p.end();
};
// 12 KSIEGARNIA
FNS[12] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#4a3322', '#2c1d12'], floor: 'wood', fc: ['#6a4a2a'], lamps: [[1.0, 2.4], [3.0, 4.2]], lk: 'round', lc: '#ffd890', glow: '255,205,130' });
  const bc = ['#7a1c1c', '#1c3a6a', '#2a5a3a', '#c9a227', '#5a2a5a', '#d8cfb8', '#3a3a3a', '#a85a2a', '#2a6a7a'];
  const books = (t, x, y, w, h) => { for (let xx = x; xx < x + w - 0.04;) { const bw = 0.03 + rn() * 0.04, bh = h * (0.6 + rn() * 0.35); t.rect(xx, y, bw, bh, bc[Math.floor(rn() * bc.length)]); xx += bw + 0.005; } };
  b.begin(); b.rect(0.1, 0.1, 3.8, 2.8, '#2a1c10'); for (let r = 0; r < 5; r++) { const y = 0.2 + r * 0.55; books(b, 0.15, y + 0.04, 3.7, 0.48); b.rect(0.1, y, 3.8, 0.05, '#5a3a20'); } b.rect(3.0, 0.1, 0.04, 2.8, '#8a8a8a'); b.end();
  s.begin(); s.rect(0.1, 0.1, 6.8, 2.8, '#2a1c10'); for (let r = 0; r < 5; r++) { const y = 0.2 + r * 0.55; for (const z0 of [0.3, 3.7]) books(s, z0, y + 0.04, 3.1, 0.48); s.rect(0.1, y, 6.8, 0.05, '#5a3a20'); } s.end();
  p.begin(); p.rect(0.3, 0, 1.6, 0.8, '#6a4a2a'); p.rect(0.25, 0.78, 1.7, 0.05, '#8a6a42'); for (let i = 0; i < 4; i++) p.rect(0.4 + i * 0.1, 0.83 + i * 0.0, 0.5, 0.06, bc[i + 1]); for (let i = 0; i < 7; i++) p.rect(1.2 + (i % 2) * 0.05, 0.83 + i * 0.07, 0.5, 0.06, bc[i]); person(p, 2.8, 1.72, '#2a3a4a'); p.rect(2.62, 1.1, 0.2, 0.25, '#7a1c1c'); p.end();
  foot(R, 0.3, 1.95, 2.3, 2.9, '#3a2616');
};
// 13 BURGER
FNS[13] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#d8382a', '#a8241a'], wain: [0.9, '#f0c030'], floor: 'checker', fc: ['#eadfc8', '#d8782a'], ceil: '#efe6d4', lamps: [[1.0, 2.0], [3.0, 2.0], [1.0, 4.6], [3.0, 4.6]], lk: 'panel', lc: '#fff0d0', glow: '255,225,170' });
  b.begin(); b.txt('BURGER', 2.0, 2.65, 0.32, '#ffe040', '#ffd020');
  for (let i = 0; i < 3; i++) { const x = 0.3 + i * 1.2; b.rect(x - 0.03, 1.28, 1.06, 1.2, '#14100c'); b.rect(x, 1.31, 1.0, 1.14, '#2a1a10', 'rgba(255,230,170,.65)'); b.ell(x + 0.28, 2.1, 0.18, 0.12, '#c8782a'); b.rect(x + 0.1, 2.0, 0.36, 0.05, '#4a2a14'); b.rect(x + 0.1, 2.05, 0.36, 0.03, '#78c040'); b.ell(x + 0.28, 2.15, 0.18, 0.08, '#d8902a'); for (let k = 0; k < 4; k++) { b.rect(x + 0.58, 1.45 + k * 0.22, 0.3, 0.025, '#f0e8d0', '#f0e8d0'); b.rect(x + 0.1, 1.45 + k * 0.22, 0.2, 0.025, '#f0c030', '#f0c030'); } }
  b.rect(0.2, 0.9, 3.6, 0.15, '#8a8a8a'); b.end();
  s.begin(); s.rect(1.0, 1.4, 1.5, 1.0, '#f0c030', '#c89a20'); s.txt('BURGER', 1.75, 1.8, 0.15, '#a82418', null); s.end();
  counter(R, 0.3, 3.2, 1.0, '#d8382a', '#e8e0d0', false);
  p.begin(); p.rect(0.5, 1.05, 0.3, 0.3, '#14161a'); p.rect(0.53, 1.08, 0.24, 0.24, '#ffd060', '#ffb030'); person(p, 1.9, 1.72, '#f0c030', { hat: '#c82a1a' }); person(p, 0.9, 1.0, '#3a2a28', { sit: false, y0: 0.0, head: '#000' }); p.end();
  p.begin(); person(p, 3.6, 1.75, '#2a3040'); p.end();
};
// 14 LODY
FNS[14] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#fbe0ea', '#f2c2d2'], wain: [0.8, '#8ad8c8'], floor: 'checker', fc: ['#fff6ee', '#f6a8c0'], ceil: '#fdf2f4', lamps: [[1.0, 2.2], [3.0, 3.6], [1.0, 5.2]], lk: 'pend', lc: '#fff0e0', glow: '255,225,215' });
  b.begin(); b.txt('LODY', 2.0, 2.45, 0.5, '#e8508a', '#ff60a0'); for (let i = 0; i < 4; i++) { const x = 0.45 + i * 0.9; b.poly([[x - 0.18, 1.4], [x + 0.18, 1.4], [x, 0.9]], '#d8a050'); b.ell(x, 1.55, 0.2, 0.2, ['#f06aa0', '#80d8c0', '#f8e070', '#a0602a'][i]); b.ell(x, 1.8, 0.14, 0.12, ['#fff', '#f8e0a0', '#f06aa0', '#fff'][i]); }
  b.rect(0.3, 2.7, 3.4, 0.0, '#000'); b.end();
  s.begin(); s.rect(1.5, 1.2, 1.4, 1.1, '#fff', '#ffe8f0'); s.txt('MENU', 2.2, 2.05, 0.14, '#e8508a', '#ff80b0'); s.end();
  counter(R, 0.3, 3.1, 1.0, '#fff6ee', '#8ad8c8', true);
  p.begin(); const tub = ['#f06aa0', '#80d8c0', '#f8e070', '#a0602a', '#fff', '#c090e0', '#78c040']; for (let i = 0; i < 7; i++) { p.ell(0.55 + i * 0.37, 1.1, 0.15, 0.07, tub[i]); } person(p, 1.5, 1.72, '#8ad8c8', { hat: '#fff', apron: '#fff' }); p.end();
  p.begin(); person(p, 3.5, 1.2, '#2a2030'); p.end();
};
// 15 FRYZJER
FNS[15] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#6a7a80', '#3e4c52'], floor: 'checker', fc: ['#1a1a1c', '#d8d8d4'], ceil: '#d8dcdc', lamps: [[1.0, 2.0], [3.0, 2.0], [1.0, 4.4], [3.0, 4.4]], lk: 'round', lc: '#fff4e0', glow: '255,240,215' });
  b.begin(); for (let i = 0; i < 3; i++) { const x = 0.25 + i * 1.2; b.rect(x - 0.05, 0.75, 1.1, 1.8, '#1a1a1a'); b.vg(x, 0.8, 1.0, 1.7, '#c8dce0', '#7a9098'); b.glow(x + 0.5, 1.7, 0.4, 0.8, '255,255,255', 0.15); b.line(x + 0.15, 0.9, x + 0.5, 2.3, 0.05, 'rgba(255,255,255,.35)');
    for (let k = 0; k < 8; k++) { b.ell(x - 0.02, 0.9 + k * 0.2, 0.025, 0.025, '#fff', '#fff0c0'); b.ell(x + 1.02, 0.9 + k * 0.2, 0.025, 0.025, '#fff', '#fff0c0'); } b.rect(x, 0.75, 1.0, 0.05, '#bbb'); for (let k = 0; k < 5; k++) b.rect(x + 0.1 + k * 0.18, 0.8, 0.08, 0.2, ['#d8a0b0', '#80b0c8', '#e8e0c0'][k % 3]); } b.end();
  s.begin(); s.rect(1.0, 0.9, 3.0, 1.7, '#c8dce0'); s.vg(1.0, 0.9, 3.0, 1.7, '#b4ccd0', '#6a8088'); s.end();
  p.begin(); for (const [x, cc] of [[0.75, '#d0b0b8'], [2.05, '#a8c0d0']]) { p.rect(x - 0.35, 0.0, 0.7, 0.1, '#222'); p.rect(x - 0.03, 0.1, 0.06, 0.35, '#888'); p.rect(x - 0.3, 0.45, 0.6, 0.12, '#1a1a1a'); person(p, x, 1.2, cc, { sit: true, y0: 0.45, head: '#3a2c28' }); p.rect(x - 0.27, 0.5, 0.54, 0.5, cc); }
  person(p, 1.4, 1.76, '#16161a', { apron: '#222' }); person(p, 3.3, 1.72, '#2a2228'); p.end();
  foot(R, 0.4, 1.1, 2.3, 2.9, '#2a2a2a'); foot(R, 1.7, 2.4, 2.3, 2.9, '#2a2a2a');
};

// ---- LOBBY nowych wiez (bloki 16..19): ciemniejsze, marmur, mosiadz
// 16 recepcja
FNS[16] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#8b857b', '#5c574f'], floor: 'tile', fc: ['#d9d5cc', '#a9a49a'], ceil: '#2a2825', lamps: [[1.0, 1.6], [3.0, 1.6], [1.0, 4.0], [3.0, 4.0], [2.0, 6.0]], lk: 'round', lc: '#fff0d0', glow: '255,232,195' });
  b.begin(); for (let x = 0.5; x < 4; x += 1.0) b.rect(x, 0.1, 0.012, 2.9, 'rgba(0,0,0,.3)'); b.rect(0.7, 1.35, 2.6, 1.3, '#25221f'); b.rect(0.7, 1.35, 2.6, 0.03, '#d4af6a', '#a07a30'); b.rect(0.7, 2.62, 2.6, 0.03, '#d4af6a', '#a07a30'); b.txt('PLAZA', 2.0, 1.85, 0.5, '#e0bd7a', '#ffd488');
  b.rect(0.22, 0.3, 0.06, 2.5, '#fff', '#fff0d0'); b.rect(3.72, 0.3, 0.06, 2.5, '#fff', '#fff0d0'); b.rect(0.15, 0, 0.3, 0.5, '#2a2622'); b.ell(0.3, 0.8, 0.28, 0.3, '#3e6a3a'); b.end();
  s.begin(); for (let z = 0.8; z < 7; z += 1.8) { s.rect(z, 1.8, 0.1, 0.35, '#fff', '#ffe8b8'); s.glow(z + 0.05, 1.97, 0.5, 0.6, '255,225,160', 0.25); } s.end();
  p.begin(); p.rect(0.7, 0, 2.6, 1.08, '#1d1b19'); p.rect(0.6, 1.05, 2.8, 0.06, '#cfc7b6'); p.rect(0.7, 0.55, 2.6, 0.025, '#d4af6a'); p.end();
  p.begin(); person(p, 1.4, 1.75, '#1b1d24'); person(p, 2.6, 1.7, '#201a1a'); p.end();
  p.begin(); p.rect(1.1, 1.11, 0.4, 0.28, '#14161a'); p.rect(1.13, 1.14, 0.34, 0.22, '#a0c8f0', '#6aa8f0'); p.rect(2.3, 1.11, 0.4, 0.28, '#14161a'); p.rect(2.33, 1.14, 0.34, 0.22, '#a0c8f0', '#6aa8f0'); p.end();
  foot(R, 0.7, 3.3, 2.2, 2.9, '#2a2622');
};
// 17 winda/ochrona
FNS[17] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#7a746a', '#4d4943'], floor: 'tile', fc: ['#2c2b2a', '#4a4845'], ceil: '#222', lamps: [[1.0, 1.8], [3.0, 1.8], [1.0, 4.2], [3.0, 4.2]], lk: 'round', lc: '#ffe8c0', glow: '255,225,180' });
  b.begin(); for (let i = 0; i < 3; i++) { const x = 0.35 + i * 1.2; b.rect(x - 0.05, 0, 1.1, 2.6, '#1c1a18'); b.vg(x, 0, 1.0, 2.5, '#d9c9a0', '#a8935c'); b.rect(x + 0.5, 0, 0.02, 2.5, 'rgba(0,0,0,.5)'); b.rect(x + 0.35, 2.65, 0.3, 0.14, '#06100a', '#40ff90'); b.ell(x + 1.1, 1.2, 0.04, 0.04, '#ffcc66', '#ffaa30'); }
  b.rect(0.2, 2.85, 3.6, 0.04, '#d4af6a', '#a07a30'); b.end();
  s.begin(); s.rect(0.8, 0.4, 2.0, 2.0, '#2a2622'); s.vg(0.9, 0.5, 1.8, 1.8, '#c8b890', '#7a6a48'); s.rect(4.5, 1.2, 1.2, 1.0, '#1a1816'); s.rect(4.55, 1.25, 1.1, 0.9, '#e8ecf0', '#a0b8d8'); s.end();
  counter(R, 2.5, 3.8, 1.05, '#1e1c1a', '#cfc7b6', false);
  p.begin(); person(p, 3.15, 1.78, '#101216'); p.rect(2.7, 1.1, 0.35, 0.25, '#14161a'); p.rect(2.73, 1.13, 0.29, 0.19, '#90d8a8', '#40e070'); person(p, 0.9, 1.75, '#2a2420', { legs: '#161618' }); person(p, 1.6, 1.68, '#3a2a30'); p.end();
};
// 18 kawiarnia premium
FNS[18] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#3c2a1e', '#22160e'], slats: 'rgba(0,0,0,.4)', floor: 'wood', fc: ['#2a1c14'], ceil: '#1a120d', lamps: [[1.0, 2.0], [3.0, 3.0], [1.0, 4.6], [3.0, 5.6]], lk: 'pend', lc: '#ffb060', glow: '255,170,90' });
  b.begin(); b.rect(0.2, 0.9, 3.6, 1.7, '#140e0a'); for (let r = 0; r < 3; r++) { const y = 1.15 + r * 0.5; b.rect(0.25, y, 3.5, 0.03, '#d4af6a', '#a0702a'); b.glow(2, y + 0.2, 1.8, 0.25, '255,170,80', 0.22); for (let x = 0.35; x < 3.6; x += 0.22) b.rect(x, y + 0.03, 0.1, 0.12 + rn() * 0.2, ['#c8a060', '#7a5a38', '#d8d0c0', '#3a5a4a'][Math.floor(rn() * 4)]); }
  b.txt('CAFÉ NOIR', 2.0, 2.78, 0.2, '#e0bd7a', '#ffc070'); b.rect(0.2, 0, 3.6, 0.9, '#1c130d'); b.rect(0.5, 0.95, 0.9, 0.5, '#b8860b'); b.end();
  counter(R, 0.3, 2.7, 1.08, '#241811', '#dcd6cc', false);
  p.begin(); person(p, 1.5, 1.76, '#17120f', { apron: '#2e1e14' }); p.rect(0.6, 1.12, 0.2, 0.22, '#e8e4dc'); p.rect(2.0, 1.12, 0.4, 0.3, '#b8860b'); p.end();
  p.begin(); person(p, 3.3, 1.25, '#2a3040', { sit: true, y0: 0.5 }); p.rect(3.29, 0, 0.02, 0.5, '#d4af6a'); p.ell(3.3, 0.5, 0.18, 0.04, '#3a2a20'); p.end();
  table(R, 3.2, 3.8, 0.4, '#3a2a1e'); table(R, 1.0, 5.0, 0.42, '#3a2a1e');
};
// 19 bank
FNS[19] = R => {
  const { b, s, p, rn } = R; room(R, { wall: ['#1a2a40', '#0e1826'], floor: 'carpet', fc: ['#2c3644', '#3a4656'], ceil: '#1c2430', lamps: [[1.0, 1.8], [3.0, 1.8], [1.0, 4.2], [3.0, 4.2], [2.0, 6.2]], lk: 'strip', lc: '#e4efff', glow: '200,220,255' });
  b.begin(); b.rect(0.5, 1.4, 3.0, 1.2, '#0c1420'); b.txt('TRUST', 2.0, 1.75, 0.5, '#9cc8ff', '#7cb4ff'); b.rect(0.6, 1.5, 2.8, 0.03, '#9cc8ff', '#6aa0e0'); b.rect(0.6, 2.45, 2.8, 0.03, '#9cc8ff', '#6aa0e0'); b.glow(2, 2, 1.8, 0.9, '120,180,255', 0.2); b.end();
  s.begin(); for (let z = 0.5; z < 6; z += 2.0) { s.rect(z, 0.9, 1.5, 1.5, 'rgba(140,190,240,.15)'); s.rect(z, 0.9, 1.5, 0.03, '#8aa0b8'); s.rect(z, 2.4, 1.5, 0.03, '#8aa0b8'); } s.end();
  p.begin(); for (const x of [0.3, 2.1]) { person(p, x + 0.8, 1.75, '#12161e'); p.rect(x, 0, 1.6, 1.0, '#222a36'); p.rect(x - 0.03, 0.98, 1.66, 0.05, '#cfd6de'); p.rect(x + 0.2, 1.03, 0.4, 0.3, '#14161a'); p.rect(x + 0.23, 1.06, 0.34, 0.24, '#9cc8ff', '#5aa0ff'); }
  p.rect(0.3, 1.03, 1.6, 0.5, 'rgba(160,200,240,.15)'); p.rect(2.1, 1.03, 1.6, 0.5, 'rgba(160,200,240,.15)'); p.end(); foot(R, 0.3, 1.9, 2.2, 2.9, '#12161e'); foot(R, 2.1, 3.7, 2.2, 2.9, '#12161e');
};

export function makeShopAtlas() {
  const mapC = document.createElement('canvas'); mapC.width = AT; mapC.height = ATH;
  const emiC = document.createElement('canvas'); emiC.width = AT / 2; emiC.height = ATH / 2;
  const mg = mapC.getContext('2d'), eg = emiC.getContext('2d');
  mg.fillStyle = '#000'; mg.fillRect(0, 0, AT, ATH); eg.fillStyle = '#000'; eg.fillRect(0, 0, AT / 2, ATH / 2);
  for (let k = 0; k < 20; k++) {
    const bx = (k % 4) * BLK, by = Math.floor(k / 4) * BLK;
    mg.clearRect(bx + 256, by + 384, 256, 128); // plan srodkowy z przezroczystoscia
    const R = { rn: rng(k * 7919 + 13) };
    // dwa przebiegi: mapa i emisja; ten sam generator liczb losowych, wiec ten sam uklad
    for (const emi of [false, true]) {
      const g = emi ? eg : mg; g.save(); if (emi) g.scale(0.5, 0.5);
      R.rn = rng(k * 7919 + 13);
      R.b = new Tl(g, emi, bx, by + 256, 64, 256 / H, 256, 256);
      R.s = new Tl(g, emi, bx + 256, by + 256, 256 / D, 256 / H, 256, 256);
      R.f = new Tl(g, emi, bx, by + 512, 64, 256 / D, 256, 256);
      R.c = new Tl(g, emi, bx + 256, by + 384, 64, 128 / D, 256, 128);
      R.p = new Tl(g, emi, bx + 256, by + 512, 64, 128 / SH, 256, 128);
      FNS[k](R); g.restore();
    }
  }
  const map = new THREE.CanvasTexture(mapC), emi = new THREE.CanvasTexture(emiC);
  for (const t of [map, emi]) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; }
  return { map, emi, cols: 4, rows: 5, canvas: mapC };
}
