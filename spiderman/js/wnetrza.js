// Wnetrza budynkow. Pokoje sa PRAWDZIWE: wneka w bryle budynku (wycieta w miasto.js) jest w miejscu, wchodzisz
// do niej zwyklym przejsciem przez drzwi na poziomie ulicy. Meble powstaja dopiero, gdy podejdziesz blisko.
// Uklad pokoju: "u" wzdluz sciany z drzwiami (0 = srodek pokoju), "v" w glab budynku (0 = przy drzwiach).
// Oswietlenie wnetrz jest "wypiekane": materialy ignoruja slonce i niebo (latka shadera), a swiatlo daje
// wlasna mapa otoczenia pokoju (cieple lampy sufitowe) + plamy swiatla na podlodze + cienie kontaktowe pod meblami.
// Cala geometria pokoju jest scalana: jedna siatka na material (malo wywolan rysowania mimo wielu detali).
import { V3, cv, canvasTex, rnd } from './util.js';
import { G, P, scene, renderer } from './stan.js';
import { addBox, SW, doors } from './miasto.js';
import { buildThug, newPose, applyPose, idlePose } from './postac.js';
import { randomOutfit } from './model.js';
import { showMsg, popText } from './ui.js';
import { sfx } from './dzwiek.js';
import { say, sayCtx } from './docinki.js';
import { maxHp } from './umiejetnosci.js';
import { save, doSave } from './util.js';
import { startFisk } from './fisk.js';

export const ROOMS = {};
const INTRO = {
  shop: ['SKLEP', 'Sprzedawca: „Spider-Man?! Weź sobie colę, na koszt firmy!”'],
  cafe: ['KAWIARNIA', 'Kelner: „Najlepsza kawa na Manhattanie — i nie gryzie!”'],
  bar: ['BAR', 'Barman: „Spokojnie, tu nikt nie chce kłopotów.”'],
  apt: ['MIESZKANIE', 'Lokator: „Ej, tylko nie zgnieć moich kwiatków!”'],
  office: ['BIURO', 'Pracownik: „Czy to zdjęcie do Daily Bugle?”'],
  gym: ['SIŁOWNIA', 'Trener: „Świetna forma! Chcesz zobaczyć nasze ciężary?”'],
  fisk: ['FISK TOWER', 'Sala główna. Tutaj urzęduje Kingpin.'],
};

// ---------------------------------------------------------------- tekstury (rysowane na canvas)
const R = Math.random, rr = (a, b) => a + R() * (b - a), ri = (a, b) => Math.floor(rr(a, b)), pick = a => a[Math.floor(R() * a.length)];
const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
const tcache = {};
function tex(name, w, h, draw, rep = true) {
  if (tcache[name]) return tcache[name];
  const c = cv(w, h), x = c.getContext('2d'); draw(x, w, h); return (tcache[name] = canvasTex(c, rep));
}
function speck(x, w, h, n, a, sz = 2) { for (let i = 0; i < n; i++) { x.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; x.fillRect(R() * w, R() * h, sz, sz); } }
function grainLines(x, x0, y0, w, h, hue, l, n = 14) { // slojowanie drewna wzdluz osi x
  for (let k = 0; k < n; k++) {
    x.strokeStyle = hsl(hue, 45, l + rr(-10, 4), rr(0.15, 0.4)); x.lineWidth = rr(0.6, 1.8); x.beginPath();
    const y = y0 + rr(1, h - 1), f = rr(0.01, 0.04), a = rr(0.5, 2.5); x.moveTo(x0, y);
    for (let q = x0; q <= x0 + w; q += 8) x.lineTo(q, y + Math.sin(q * f + k) * a);
    x.stroke();
  }
}
const txt = (x, s, font, col, X, Y, al = 'center') => { x.font = font; x.fillStyle = col; x.textAlign = al; x.textBaseline = 'middle'; x.fillText(s, X, Y); };
const TEX = {
  // winyl w szachownice (kremowy / ciemny) z fugami i marmurkowaniem
  tile: () => tex('tile', 512, 512, (x, s) => {
    x.fillStyle = '#4a463f'; x.fillRect(0, 0, s, s); const t = s / 4;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const dark = (i + j) % 2, l = dark ? rr(30, 33) : rr(66, 70);
      x.fillStyle = hsl(dark ? 150 : 40, dark ? 6 : 16, l); x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
      for (let k = 0; k < 50; k++) { x.fillStyle = hsl(dark ? 150 : 38, 10, l + rr(-7, 7), 0.22); x.beginPath(); x.ellipse(i * t + rr(6, t - 6), j * t + rr(6, t - 6), rr(2, 9), rr(1, 4), rr(0, 3), 0, 7); x.fill(); }
    }
    speck(x, s, s, 5000, 0.035);
    x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 1; for (let k = 0; k < 25; k++) { x.beginPath(); const a = rr(0, s), b = rr(0, s); x.moveTo(a, b); x.lineTo(a + rr(-30, 30), b + rr(-8, 8)); x.stroke(); }
  }),
  // deski podlogowe z przesunietymi stykami
  wood: () => tex('wood', 512, 512, (x, s) => {
    const rows = 8, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let a = -rr(0, 250);
      while (a < s) {
        const L = rr(170, 330), l = rr(30, 40), hh = rr(24, 32);
        for (const o of [0, -s, s]) { if (a + o + L < 0 || a + o > s) continue; x.fillStyle = hsl(hh, 42, l); x.fillRect(a + o, r * rh, L, rh); grainLines(x, a + o, r * rh, L, rh, hh, l, 9); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(a + o, r * rh, 1.5, rh); }
        a += L;
      }
      x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, r * rh, s, 1.5); x.fillStyle = 'rgba(255,230,200,.06)'; x.fillRect(0, r * rh + 2, s, 2);
    }
    speck(x, s, s, 4000, 0.03);
  }),
  carpet: () => tex('carpet', 256, 256, (x, s) => {
    x.fillStyle = '#7d858f'; x.fillRect(0, 0, s, s);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const hz = (i + j) % 2; x.fillStyle = hz ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)'; x.fillRect(i * 128, j * 128, 128, 128);
      for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; if (hz) x.fillRect(i * 128, j * 128 + R() * 128, 128, 1); else x.fillRect(i * 128 + R() * 128, j * 128, 1, 128); }
      x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(i * 128, j * 128, 128, 1); x.fillRect(i * 128, j * 128, 1, 128);
    }
    speck(x, s, s, 9000, 0.07, 1.5);
  }),
  rubber: () => tex('rubber', 256, 256, (x, s) => {
    x.fillStyle = '#34373b'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) { x.fillStyle = pick(['rgba(140,140,140,.35)', 'rgba(90,110,150,.3)', 'rgba(170,60,50,.25)']); x.fillRect(R() * s, R() * s, rr(1, 2.5), rr(1, 2.5)); }
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, s, 2); x.fillRect(0, 0, 2, s); x.fillRect(0, 128, s, 1); x.fillRect(128, 0, 1, s);
  }),
  // marmur: szachownica kremowa / czarna z zylkami
  marble: () => tex('marble', 512, 512, (x, s) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const dark = (i + j) % 2, X = i * 256, Y = j * 256;
      x.fillStyle = dark ? '#1b1a1c' : '#d9d2c6'; x.fillRect(X, Y, 256, 256);
      const g = x.createRadialGradient(X + rr(50, 200), Y + rr(50, 200), 10, X + 128, Y + 128, 220); g.addColorStop(0, dark ? 'rgba(60,55,58,.5)' : 'rgba(255,250,240,.4)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(X, Y, 256, 256);
      x.save(); x.beginPath(); x.rect(X, Y, 256, 256); x.clip();
      for (let k = 0; k < 9; k++) {
        x.strokeStyle = dark ? `rgba(200,195,185,${rr(0.12, 0.35)})` : `rgba(110,100,95,${rr(0.12, 0.35)})`; x.lineWidth = rr(0.6, 2.4); x.beginPath();
        let px = X + rr(0, 256), py = Y + rr(0, 256); x.moveTo(px, py);
        for (let q = 0; q < 14; q++) { px += rr(-10, 30); py += rr(-25, 25); x.lineTo(px, py); }
        x.stroke();
      }
      x.restore(); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X, Y, 256, 1.5); x.fillRect(X, Y, 1.5, 256);
    }
  }),
  plaster: () => tex('plaster', 256, 256, (x, s) => {
    x.fillStyle = '#dedad3'; x.fillRect(0, 0, s, s);
    for (let k = 0; k < 40; k++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.025)`; x.beginPath(); x.arc(R() * s, R() * s, rr(10, 50), 0, 7); x.fill(); }
    speck(x, s, s, 6000, 0.035, 1.5);
  }),
  brick: () => tex('brick', 512, 512, (x, s) => {
    x.fillStyle = '#8f8577'; x.fillRect(0, 0, s, s); const bh = s / 24, bw = s / 8;
    for (let r = 0; r < 24; r++) for (let k = -1; k < 9; k++) {
      const X = k * bw + (r % 2) * bw / 2, l = rr(26, 38), h = rr(8, 18);
      x.fillStyle = hsl(h, rr(32, 48), R() < 0.08 ? l - 10 : l); x.fillRect(X + 2, r * bh + 2, bw - 4, bh - 3);
      x.fillStyle = 'rgba(255,220,190,.08)'; x.fillRect(X + 2, r * bh + 2, bw - 4, 2);
      x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(X + 2, r * bh + bh - 3, bw - 4, 2);
    }
    speck(x, s, s, 9000, 0.06);
  }),
  // boazeria: rama + plycina z fazowaniem (1 m x 1 m)
  paneling: () => tex('paneling', 256, 256, (x, s) => {
    x.fillStyle = hsl(26, 42, 40); x.fillRect(0, 0, s, s); grainLines(x, 0, 0, s, s, 26, 40, 40);
    const i = 30; x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(i, i, s - 2 * i, s - 2 * i);
    grainLines(x, i, i, s - 2 * i, s - 2 * i, 26, 36, 18);
    x.strokeStyle = 'rgba(255,225,190,.22)'; x.lineWidth = 3; x.beginPath(); x.moveTo(i, s - i); x.lineTo(i, i); x.lineTo(s - i, i); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.45)'; x.beginPath(); x.moveTo(s - i, i); x.lineTo(s - i, s - i); x.lineTo(i, s - i); x.stroke();
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, s - 2, s - 2);
  }),
  subway: () => tex('subway', 256, 256, (x, s) => {
    x.fillStyle = '#9b968c'; x.fillRect(0, 0, s, s);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
      const X = k * 64 + (r % 2) * 32, g = x.createLinearGradient(0, r * 32, 0, r * 32 + 32); g.addColorStop(0, '#efece4'); g.addColorStop(1, '#d9d5cb');
      x.fillStyle = g; x.fillRect(X + 2, r * 32 + 2, 60, 28);
    }
    speck(x, s, s, 1500, 0.03);
  }),
  acoustic: () => tex('acoustic', 256, 256, (x, s) => {
    x.fillStyle = '#d2cfc7'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(60,55,50,${rr(0.08, 0.25)})`; x.fillRect(R() * s, R() * s, rr(1, 3), 1); }
    for (const p of [0, 128]) { x.fillStyle = '#ecebe6'; x.fillRect(0, p, s, 4); x.fillRect(p, 0, 4, s); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, p + 4, s, 1); x.fillRect(p + 4, 0, 1, s); }
  }),
  // tloczona blacha sufitowa (typowa dla starych barow w NY)
  tin: () => tex('tin', 256, 256, (x, s) => {
    x.fillStyle = '#a89a80'; x.fillRect(0, 0, s, s);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const X = i * 128 + 64, Y = j * 128 + 64;
      for (const [r, a] of [[60, 0.25], [46, -0.2], [30, 0.25], [14, -0.25]]) { x.strokeStyle = a > 0 ? `rgba(255,240,210,${a})` : `rgba(0,0,0,${-a})`; x.lineWidth = 3; x.strokeRect(X - r, Y - r, 2 * r, 2 * r); }
      x.fillStyle = 'rgba(255,240,210,.25)'; x.beginPath(); x.arc(X, Y, 8, 0, 7); x.fill();
    }
    speck(x, s, s, 2500, 0.05);
  }),
  grain: () => tex('grain', 256, 256, (x, s) => { x.fillStyle = hsl(30, 38, 55); x.fillRect(0, 0, s, s); grainLines(x, 0, 0, s, s, 28, 52, 70); speck(x, s, s, 1500, 0.03); }),
  fabric: () => tex('fabric', 128, 128, (x, s) => {
    x.fillStyle = '#c9c9c9'; x.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 2) { x.fillStyle = 'rgba(0,0,0,.05)'; x.fillRect(0, i, s, 1); x.fillStyle = 'rgba(255,255,255,.04)'; x.fillRect(i, 0, 1, s); }
    speck(x, s, s, 2500, 0.06, 1);
  }),
  leather: () => tex('leather', 128, 128, (x, s) => {
    x.fillStyle = '#bdbdbd'; x.fillRect(0, 0, s, s);
    for (let k = 0; k < 120; k++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},.05)`; x.beginPath(); x.arc(R() * s, R() * s, rr(2, 8), 0, 7); x.fill(); }
    speck(x, s, s, 2000, 0.05, 1);
  }),
  rug: () => tex('rug', 256, 256, (x, s) => {
    x.fillStyle = '#7a1e1e'; x.fillRect(0, 0, s, s);
    x.strokeStyle = '#1f2a4a'; x.lineWidth = 14; x.strokeRect(14, 14, s - 28, s - 28);
    x.strokeStyle = '#d9c9a0'; x.lineWidth = 3; x.strokeRect(26, 26, s - 52, s - 52); x.strokeRect(6, 6, s - 12, s - 12);
    x.fillStyle = '#1f2a4a'; x.beginPath(); x.moveTo(s / 2, 50); x.lineTo(s - 60, s / 2); x.lineTo(s / 2, s - 50); x.lineTo(60, s / 2); x.closePath(); x.fill();
    x.fillStyle = '#d9c9a0'; x.beginPath(); x.moveTo(s / 2, 80); x.lineTo(s - 90, s / 2); x.lineTo(s / 2, s - 80); x.lineTo(90, s / 2); x.closePath(); x.fill();
    x.fillStyle = '#9a2a22'; x.beginPath(); x.arc(s / 2, s / 2, 22, 0, 7); x.fill();
    for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(217,201,160,.5)'; x.fillRect(rr(36, s - 36), rr(36, s - 36), 3, 3); }
    speck(x, s, s, 6000, 0.08, 1.5);
  }),
  // atlas opakowan 8x8 (pierwsze komorki: napoje)
  goods: () => tex('goods', 512, 512, (x) => {
    const base = ['#c8102e', '#d6d6d6', '#f28c1a', '#6cbf3a', '#2b78c5', '#161616', '#f2c318', '#7b2d8b', '#0f7a6a', '#d9c7a0', '#8b1a1a', '#1f3f7a', '#efe9dc', '#3a6b2a', '#e85d9c', '#5a3a22'];
    const L = 'ABCDEFGHIKLMNOPRSTUWZ';
    for (let i = 0; i < 64; i++) {
      const X = (i % 8) * 64, Y = Math.floor(i / 8) * 64, b = i < 16 ? base[i] : pick(base), acc = pick(['#ffffff', '#f2c318', '#c8102e', '#161616', '#2b78c5']);
      x.fillStyle = b; x.fillRect(X, Y, 64, 64);
      x.fillStyle = acc; x.fillRect(X, Y + rr(34, 46), 64, rr(4, 10));
      x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.ellipse(X + 32, Y + 20, rr(12, 22), rr(7, 11), 0, 0, 7); x.fill();
      let w = ''; for (let k = 0; k < ri(3, 6); k++) w += L[ri(0, L.length)];
      txt(x, w, 'bold 11px sans-serif', b === '#efe9dc' || b === '#d6d6d6' ? '#222' : b, X + 32, Y + 20);
      x.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 3; k++) x.fillRect(X + 10, Y + 52 + k * 3, rr(20, 44), 1.5);
      if (i === 0) { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(X, Y + 44); x.bezierCurveTo(X + 20, Y + 30, X + 40, Y + 58, X + 64, Y + 40); x.lineTo(X + 64, Y + 46); x.bezierCurveTo(X + 40, Y + 62, X + 20, Y + 36, X, Y + 50); x.fill(); txt(x, 'COLA', 'italic bold 15px serif', '#c8102e', X + 32, Y + 20); }
      const g = x.createLinearGradient(X, 0, X + 64, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(0.35, 'rgba(255,255,255,.12)'); g.addColorStop(1, 'rgba(0,0,0,.32)'); x.fillStyle = g; x.fillRect(X, Y, 64, 64);
    }
  }, false),
  // plakaty 4 x (256x512)
  posters: () => tex('posters', 1024, 512, (x) => {
    let g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#d0101e'); g.addColorStop(1, '#6a0610'); x.fillStyle = g; x.fillRect(0, 0, 256, 512);
    x.fillStyle = '#f2f2f2'; x.beginPath(); x.ellipse(128, 300, 62, 14, 0, 0, 7); x.fill(); x.fillStyle = '#c8102e'; x.fillRect(66, 170, 124, 130); x.fillStyle = '#e8e8e8'; x.fillRect(66, 160, 124, 14); x.beginPath(); x.ellipse(128, 160, 62, 12, 0, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.fillRect(66, 225, 124, 12); txt(x, 'COLA', 'italic bold 40px serif', '#fff', 128, 205);
    txt(x, 'ZIMNA', 'bold 52px sans-serif', '#fff', 128, 60); txt(x, 'COLA', 'bold 52px sans-serif', '#ffd23a', 128, 112); txt(x, 'TYLKO 1$', 'bold 34px sans-serif', '#fff', 128, 400); txt(x, 'ORZEŹWIA MIASTO', 'bold 16px sans-serif', 'rgba(255,255,255,.8)', 128, 450);
    g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#2a2f5a'); g.addColorStop(0.55, '#e0805a'); g.addColorStop(0.8, '#f4c27a'); x.fillStyle = g; x.fillRect(256, 0, 256, 512);
    x.fillStyle = '#ffd9a0'; x.beginPath(); x.arc(384, 340, 40, 0, 7); x.fill();
    for (let k = 0; k < 22; k++) { const w = rr(10, 26), h = rr(60, 260), X = 256 + rr(0, 240); x.fillStyle = '#1a1d30'; x.fillRect(X, 420 - h, w, h + 100); }
    x.fillStyle = '#1a1d30'; x.fillRect(256, 420, 256, 92); txt(x, 'NEW YORK', 'bold 46px sans-serif', '#fff', 384, 70); txt(x, 'CITY THAT NEVER SLEEPS', 'bold 14px sans-serif', 'rgba(255,255,255,.8)', 384, 110);
    x.fillStyle = '#14264a'; x.fillRect(512, 0, 256, 512); x.fillStyle = '#f2b318'; x.beginPath(); x.arc(640, 210, 90, 0, 7); x.fill();
    x.fillStyle = '#c8302a'; x.save(); x.translate(640, 260); x.rotate(-0.5); x.fillRect(-200, -12, 400, 24); x.fillRect(-200, 30, 400, 10); x.restore();
    txt(x, 'JAZZ', 'bold 70px serif', '#fff', 640, 390); txt(x, 'NOC', 'bold 40px serif', '#f2b318', 640, 440); txt(x, 'PIĄTEK 21:00', 'bold 18px sans-serif', '#fff', 640, 480);
    x.fillStyle = '#111'; x.fillRect(768, 0, 256, 512); x.fillStyle = '#f2c318';
    for (let k = -4; k < 10; k++) { x.save(); x.translate(768 + k * 40, 0); x.transform(1, 0, -0.5, 1, 0, 0); x.fillRect(0, 440, 18, 80); x.restore(); }
    txt(x, 'TRENUJ', 'bold 50px sans-serif', '#fff', 896, 120); txt(x, 'MOCNIEJ', 'bold 50px sans-serif', '#f2c318', 896, 180); txt(x, 'BEZ WYMÓWEK', 'bold 20px sans-serif', '#ccc', 896, 240);
    x.fillStyle = '#f2c318'; x.fillRect(826, 300, 140, 16); x.fillRect(806, 280, 22, 56); x.fillRect(964, 280, 22, 56);
    speck(x, 1024, 512, 6000, 0.04);
  }, false),
  // obrazy 2x2
  art: () => tex('art', 512, 512, (x) => {
    x.fillStyle = '#d9cbb0'; x.fillRect(0, 0, 256, 256);
    for (const [y, h, c] of [[20, 90, '#c8562a'], [118, 30, '#7a1e1e'], [156, 80, '#d9a03a']]) { x.fillStyle = c; x.shadowColor = c; x.shadowBlur = 12; x.fillRect(24, y, 208, h); }
    x.shadowBlur = 0;
    let g = x.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, '#8fb0d0'); g.addColorStop(1, '#f2d0a0'); x.fillStyle = g; x.fillRect(256, 0, 256, 140);
    x.fillStyle = '#f7e0a0'; x.beginPath(); x.arc(420, 110, 22, 0, 7); x.fill();
    g = x.createLinearGradient(0, 140, 0, 256); g.addColorStop(0, '#3a6a8a'); g.addColorStop(1, '#1a3048'); x.fillStyle = g; x.fillRect(256, 140, 256, 116);
    for (let k = 0; k < 40; k++) { x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(256 + rr(0, 256), rr(150, 250), rr(6, 20), 1.5); }
    x.fillStyle = '#e6dcc6'; x.fillRect(0, 256, 256, 256); x.strokeStyle = '#5a4630'; x.lineWidth = 3;
    for (const X of [70, 186]) { x.strokeRect(X - 14, 300, 28, 160); x.beginPath(); x.arc(X, 340, 8, Math.PI, 0); x.stroke(); }
    x.lineWidth = 1.2; for (let k = 0; k < 14; k++) { x.beginPath(); x.moveTo(70, 300); x.lineTo(10 + k * 17, 420); x.stroke(); x.beginPath(); x.moveTo(186, 300); x.lineTo(10 + k * 17, 420); x.stroke(); }
    x.lineWidth = 4; x.beginPath(); x.moveTo(0, 420); x.lineTo(256, 420); x.stroke();
    g = x.createLinearGradient(0, 256, 0, 512); g.addColorStop(0, '#bdbdbd'); g.addColorStop(1, '#4a4a4a'); x.fillStyle = g; x.fillRect(256, 256, 256, 256);
    for (let k = 0; k < 16; k++) { const w = rr(14, 30), h = rr(50, 200), X = 256 + rr(0, 236); x.fillStyle = `rgb(${ri(30, 70)},${ri(30, 70)},${ri(30, 70)})`; x.fillRect(X, 512 - h, w, h); for (let q = 0; q < 12; q++) { x.fillStyle = 'rgba(220,220,220,.35)'; x.fillRect(X + rr(2, w - 4), 512 - rr(4, h), 2, 2); } }
    speck(x, 512, 512, 5000, 0.05);
  }, false),
  menu: () => tex('menu', 512, 256, (x, w, h) => {
    x.fillStyle = '#1f2622'; x.fillRect(0, 0, w, h); speck(x, w, h, 5000, 0.05);
    for (let k = 0; k < 30; k++) { x.fillStyle = 'rgba(255,255,255,.03)'; x.beginPath(); x.ellipse(R() * w, R() * h, rr(20, 60), rr(5, 15), rr(0, 3), 0, 7); x.fill(); }
    txt(x, '~ MENU ~', 'bold 34px serif', 'rgba(245,240,225,.9)', w / 2, 32);
    const items = [['ESPRESSO', '2,50'], ['AMERICANO', '3,00'], ['CAPPUCCINO', '3,80'], ['LATTE', '4,20'], ['HERBATA', '2,50'], ['SERNIK', '4,50'], ['BAJGIEL', '3,50'], ['MUFFIN', '2,90']];
    items.forEach(([n, p], i) => { const X = i < 4 ? 30 : 270, Y = 82 + (i % 4) * 42; txt(x, n, 'bold 20px sans-serif', 'rgba(240,236,220,.85)', X, Y, 'left'); txt(x, p + ' $', 'bold 20px sans-serif', 'rgba(250,215,120,.9)', X + 210, Y, 'right'); });
  }, false),
  whiteboard: () => tex('whiteboard', 512, 256, (x, w, h) => {
    x.fillStyle = '#eef0ee'; x.fillRect(0, 0, w, h); txt(x, 'PLAN Q3', 'bold 28px sans-serif', '#1f4ab0', 90, 34);
    x.strokeStyle = '#1f4ab0'; x.lineWidth = 3; for (let k = 0; k < 5; k++) { x.beginPath(); x.moveTo(30, 75 + k * 28); for (let q = 30; q < 210; q += 10) x.lineTo(q, 75 + k * 28 + rr(-2, 2)); x.stroke(); }
    x.strokeStyle = '#222'; x.beginPath(); x.moveTo(270, 40); x.lineTo(270, 220); x.lineTo(480, 220); x.stroke();
    [60, 100, 80, 140, 170].forEach((v, i) => { x.fillStyle = i === 4 ? '#c8302a' : '#2a8a4a'; x.fillRect(290 + i * 38, 220 - v, 24, v); });
    x.strokeStyle = '#c8302a'; x.lineWidth = 3; x.beginPath(); x.moveTo(300, 150); x.lineTo(470, 50); x.stroke(); x.beginPath(); x.moveTo(470, 50); x.lineTo(450, 52); x.moveTo(470, 50); x.lineTo(462, 68); x.stroke();
    x.fillStyle = 'rgba(0,0,0,.05)'; for (let k = 0; k < 10; k++) x.fillRect(rr(0, w), rr(0, h), rr(40, 120), rr(6, 20));
  }, false),
  neon: () => tex('neon', 512, 256, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    x.font = 'italic bold 130px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [b, c] of [[40, '#ff2aa0'], [20, '#ff4ab8'], [6, '#ffc0e8']]) { x.shadowColor = c; x.shadowBlur = b; x.fillStyle = c; x.fillText('Bar', w / 2, 110); }
    x.font = 'bold 40px sans-serif'; for (const [b, c] of [[24, '#30b0ff'], [4, '#c0e8ff']]) { x.shadowColor = c; x.shadowBlur = b; x.fillStyle = c; x.fillText('O P E N', w / 2, 210); }
  }, false),
  // widok z okna: miasto o zachodzie
  view: () => tex('view', 512, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#34406a'); g.addColorStop(0.45, '#b8705a'); g.addColorStop(0.7, '#f0a868'); g.addColorStop(1, '#f6c886'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (const [n, hmin, hmax, col, lit] of [[30, 80, 260, '#5a4a5e', 0.15], [22, 120, 380, '#2a2638', 0.35]]) for (let k = 0; k < n; k++) {
      const bw = rr(18, 60), bh = rr(hmin, hmax), X = rr(-20, w), Y = h - bh; x.fillStyle = col; x.fillRect(X, Y, bw, bh);
      if (R() < 0.3) x.fillRect(X + bw * 0.4, Y - 30, bw * 0.2, 30);
      for (let yy = Y + 8; yy < h - 6; yy += 10) for (let xx = X + 4; xx < X + bw - 4; xx += 8) if (R() < lit) { x.fillStyle = `rgba(255,${ri(190, 230)},${ri(120, 170)},.85)`; x.fillRect(xx, yy, 4, 5); x.fillStyle = col; }
    }
  }, false),
  screens: () => tex('screens', 256, 256, (x) => {
    x.fillStyle = '#dfe6ee'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#2a5ab0'; x.fillRect(0, 0, 128, 14);
    x.strokeStyle = 'rgba(0,0,0,.2)'; for (let k = 0; k < 9; k++) { x.beginPath(); x.moveTo(0, 22 + k * 11); x.lineTo(128, 22 + k * 11); x.stroke(); } for (let k = 1; k < 5; k++) { x.beginPath(); x.moveTo(k * 26, 14); x.lineTo(k * 26, 128); x.stroke(); }
    x.fillStyle = '#1e1f26'; x.fillRect(128, 0, 128, 128);
    for (let k = 0; k < 14; k++) { x.fillStyle = pick(['#7fd0ff', '#ffb070', '#b0e080', '#e0e0e0', '#d090ff']); x.fillRect(136 + ri(0, 4) * 6, 8 + k * 8, rr(20, 90), 3); }
    let g = x.createLinearGradient(0, 128, 0, 256); g.addColorStop(0, '#1a3a7a'); g.addColorStop(1, '#0a1a3a'); x.fillStyle = g; x.fillRect(0, 128, 128, 128);
    x.fillStyle = '#c9a080'; x.beginPath(); x.arc(64, 180, 16, 0, 7); x.fill(); x.fillStyle = '#2a2a3a'; x.fillRect(40, 196, 48, 40);
    x.fillStyle = '#c8202a'; x.fillRect(0, 226, 128, 18); txt(x, 'WIADOMOŚCI', 'bold 10px sans-serif', '#fff', 64, 235);
    x.fillStyle = '#0c0e10'; x.fillRect(128, 128, 128, 128); txt(x, '8.5', 'bold 34px monospace', '#ffa030', 192, 172); txt(x, 'KM/H', 'bold 12px sans-serif', '#80ff80', 192, 200);
    x.fillStyle = '#30d060'; for (let k = 0; k < 10; k++) x.fillRect(140 + k * 10, 240 - k * 3, 7, k * 3 + 4);
  }, false),
  panelL: () => tex('panelL', 64, 64, (x, s) => {
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 44); g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f2f0ea'); g.addColorStop(1, '#a8a6a0'); x.fillStyle = g; x.fillRect(0, 0, s, s);
    x.fillStyle = 'rgba(0,0,0,.08)'; for (let k = 1; k < 4; k++) { x.fillRect(k * 16, 0, 1, s); x.fillRect(0, k * 16, s, 1); }
  }, false),
  pool: () => tex('pool', 128, 128, (x, s) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, '#fff'); g.addColorStop(0.35, '#9a9a9a'); g.addColorStop(0.7, '#2a2a2a'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false),
  blob: () => tex('blob', 128, 128, (x, s) => { const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.72)'); g.addColorStop(0.55, 'rgba(0,0,0,.42)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }, false),
};

// ---------------------------------------------------------------- swiatlo wnetrz: wlasna mapa otoczenia
// Pokoj-pudelko z lampami na suficie przeliczone przez PMREM: daje rozproszone swiatlo (z gory jasniej, od podlogi ciemniej)
// i odbicia lamp w lakierowanej podlodze, szkle i chromie. Slonce i niebo sa we wnetrzach wylaczone latka shadera.
const ENVK = {
  bright: { wall: [0.42, 0.38, 0.32], floor: [0.3, 0.27, 0.22], ceil: [0.4, 0.37, 0.32], lamp: [7, 6.3, 5.2], n: 6, i: 1.9 },
  cool: { wall: [0.36, 0.37, 0.39], floor: [0.26, 0.27, 0.29], ceil: [0.36, 0.36, 0.35], lamp: [6.4, 6.4, 6.2], n: 6, i: 1.8 },
  warm: { wall: [0.45, 0.31, 0.19], floor: [0.3, 0.2, 0.12], ceil: [0.36, 0.27, 0.19], lamp: [9, 6.2, 3.4], n: 4, i: 2.2 },
  dark: { wall: [0.26, 0.14, 0.09], floor: [0.2, 0.11, 0.07], ceil: [0.2, 0.14, 0.09], lamp: [9, 5.2, 2.4], n: 3, i: 2.3, neon: [4, 0.5, 2.2] },
  lux: { wall: [0.3, 0.2, 0.12], floor: [0.28, 0.23, 0.18], ceil: [0.26, 0.19, 0.12], lamp: [9, 6.8, 4.2], n: 6, i: 2.0 },
};
const ENV_OF = { shop: 'bright', cafe: 'warm', bar: 'dark', apt: 'warm', office: 'cool', gym: 'cool', fisk: 'lux' };
const ENVT = {};
function envTex(k) {
  if (ENVT[k]) return ENVT[k];
  const E = ENVK[k], s = new THREE.Scene(), W = 12, D = 10, H = 3.6, y0 = -1.5;
  const bm = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.BackSide });
  const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [bm(E.wall), bm(E.wall), bm(E.ceil), bm(E.floor), bm(E.wall), bm([E.wall[0] * 1.3, E.wall[1] * 1.25, E.wall[2] * 1.2])]);
  room.position.y = y0 + H / 2; s.add(room);
  const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(...E.lamp) });
  for (let i = 0; i < E.n; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.5), lm), row = E.n > 3 ? Math.floor(i / 3) : 0.5;
    l.position.set(((i % 3) - 1) * 3.8, y0 + H - 0.04, (row - 0.5) * 4.2); s.add(l);
  }
  if (E.neon) { const n = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(...E.neon) })); n.position.set(0, y0 + 2.8, D / 2 - 0.1); s.add(n); }
  try { const pm = new THREE.PMREMGenerator(renderer); ENVT[k] = pm.fromScene(s, 0.02, 0.1, 50).texture; pm.dispose(); } catch (e) { ENVT[k] = null; }
  return ENVT[k];
}
// latka shadera: bez slonca (swiatlo kierunkowe), bez polkuli nieba i swiatla otoczenia; wlasne "AO" przy podlodze
const AO_GLSL = 'float wAo = mix(0.58, 1.0, smoothstep(0.0, 1.3, vWY - 0.15)); reflectedLight.indirectDiffuse *= wAo; reflectedLight.indirectSpecular *= mix(wAo, 1.0, 0.5);';
let LIGHTS_INT = null;
function patchInt(sh) {
  if (!LIGHTS_INT) LIGHTS_INT = THREE.ShaderChunk.lights_fragment_begin
    .replace(/#if \( NUM_DIR_LIGHTS > 0 \)[\s\S]*?#endif\n(?=#if \( NUM_RECT_AREA_LIGHTS)/, '')
    .replace('irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );', '')
    .replace('getAmbientLightIrradiance( ambientLightColor )', 'vec3( 0.0 )');
  sh.vertexShader = 'varying float vWY;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvec4 wyP = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nwyP = instanceMatrix * wyP;\n#endif\nvWY = ( modelMatrix * wyP ).y;');
  sh.fragmentShader = 'varying float vWY;\n' + sh.fragmentShader.replace('#include <lights_fragment_begin>', LIGHTS_INT).replace('#include <aomap_fragment>', AO_GLSL + '\n#include <aomap_fragment>');
}

// ---------------------------------------------------------------- materialy
// t: tekstura, ts: rozmiar kafla tekstury w metrach, r: szorstkosc, m: metalicznosc
const MDEF = {
  tile: { t: 'tile', ts: 1.2, r: 0.3 }, wood: { t: 'wood', ts: 2, r: 0.38 }, carpet: { t: 'carpet', ts: 1, r: 0.95 }, rubber: { t: 'rubber', ts: 1, r: 0.8 },
  marble: { t: 'marble', ts: 2.4, r: 0.1 }, plaster: { t: 'plaster', ts: 2, r: 0.92 }, brick: { t: 'brick', ts: 2, r: 0.9 }, panel: { t: 'paneling', ts: 1, r: 0.42 },
  subway: { t: 'subway', ts: 0.6, r: 0.2 }, acoustic: { t: 'acoustic', ts: 1.2, r: 0.95 }, tin: { t: 'tin', ts: 0.6, r: 0.35, m: 0.55 },
  grain: { t: 'grain', ts: 1, r: 0.55 }, grainG: { t: 'grain', ts: 1, r: 0.25 }, fabric: { t: 'fabric', ts: 0.5, r: 0.95 }, leather: { t: 'leather', ts: 0.5, r: 0.4 }, rug: { t: 'rug', r: 0.95 },
  matte: { r: 0.88 }, paint: { r: 0.6 }, gloss: { r: 0.2 }, chrome: { r: 0.14, m: 1 }, steel: { r: 0.4, m: 0.85 }, brass: { r: 0.28, m: 1 },
  glass: { r: 0.03, glass: 0.16 }, bottle: { r: 0.06 }, mirror: { r: 0.12, m: 0.9 },
  goods: { t: 'goods', r: 0.45 }, poster: { t: 'posters', r: 0.55 }, art: { t: 'art', r: 0.5 }, menu: { t: 'menu', r: 0.9 }, white: { t: 'whiteboard', r: 0.2 },
  lamp: { basic: 1 }, panelL: { basic: 1, t: 'panelL' }, screen: { basic: 1, t: 'screens' }, view: { basic: 1, t: 'view' }, neon: { basic: 1, t: 'neon', add: 1 }, pool: { basic: 1, t: 'pool', add: 1 }, blob: { blob: 1 },
};
const mats = {};
function matFor(name, env) {
  const k = name + '|' + env; if (mats[k]) return mats[k];
  const D = MDEF[name], map = D.t ? TEX[D.t]() : null; let m;
  if (D.basic) {
    m = new THREE.MeshBasicMaterial({ map, vertexColors: true });
    if (D.add) Object.assign(m, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  } else if (D.blob) {
    m = new THREE.MeshBasicMaterial({ map: TEX.blob(), color: 0x000000, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  } else {
    m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: D.r, metalness: D.m || 0 });
    if (D.glass) Object.assign(m, { transparent: true, opacity: D.glass, depthWrite: false });
    m.envMap = envTex(env); const ei = ENVK[env].i;
    // natezenie ustalone na stale (miasto zmienia envMapIntensity wszystkich materialow wraz z pora dnia)
    Object.defineProperty(m, 'envMapIntensity', { get: () => ei, set() {}, configurable: true });
    m.onBeforeCompile = patchInt;
  }
  m.userData.ts = D.ts || 0;
  return (mats[k] = m);
}

// ---------------------------------------------------------------- geometria bazowa i scalanie
const BASE = {};
function baseGeo(k) {
  if (BASE[k]) return BASE[k];
  let g; const p = k.split('_');
  if (k === 'box') g = new THREE.BoxGeometry(1, 1, 1);
  else if (k === 'plane') g = new THREE.PlaneGeometry(1, 1);
  else if (p[0] === 'cyl') g = new THREE.CylinderGeometry(0.5 * +p[2], 0.5, 1, +p[1], 1);
  else if (p[0] === 'sph') g = new THREE.SphereGeometry(0.5, +p[1], Math.max(4, Math.round(+p[1] * 0.6)));
  else if (k === 'tor') g = new THREE.TorusGeometry(0.5, 0.06, 6, 20);
  return (BASE[k] = g.toNonIndexed());
}
const cellUV = (i, nx, ny) => { const x0 = (i % nx) / nx, row = Math.floor(i / nx); return [x0, 1 - (row + 1) / ny, x0 + 1 / nx, 1 - row / ny]; };
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _sc = new V3(), _n3 = new THREE.Matrix3(), _v = new V3(), _col = new THREE.Color();
function emit(c, mat, gk, u, y, v, sx, sy, sz, rx, ry, rz, col, k, uvf) {
  _e.set(rx, ry, rz, 'XYZ'); _q.setFromEuler(_e); _p.set(c.s * u, y, v); _sc.set(sx, sy, sz);
  emitM(c, mat, gk, _m4.compose(_p, _q, _sc).premultiply(c.F), col, k, uvf);
}
// m4: gotowa macierz (uklad pokoju -> swiat)
function emitM(c, mat, gk, m4, col, k, uvf) {
  const g = baseGeo(gk); let b = c.bk.get(mat); if (!b) c.bk.set(mat, b = { p: [], n: [], uv: [], c: [] });
  const _m4 = m4; _n3.getNormalMatrix(_m4);
  _col.set(col).convertSRGBToLinear(); const cr = _col.r * k, cg = _col.g * k, cb = _col.b * k;
  const Pa = g.attributes.position.array, Na = g.attributes.normal.array, Ua = g.attributes.uv.array, n = Pa.length / 3;
  for (let i = 0; i < n; i++) {
    _v.set(Pa[i * 3], Pa[i * 3 + 1], Pa[i * 3 + 2]).applyMatrix4(_m4); b.p.push(_v.x, _v.y, _v.z);
    _v.set(Na[i * 3], Na[i * 3 + 1], Na[i * 3 + 2]).applyMatrix3(_n3).normalize(); b.n.push(_v.x, _v.y, _v.z);
    if (uvf) uvf(i, Ua[i * 2], Ua[i * 2 + 1], b.uv); else b.uv.push(Ua[i * 2], Ua[i * 2 + 1]);
    b.c.push(cr, cg, cb);
  }
}
function flush(c) {
  for (const [m, b] of c.bk) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false;
    if (m.transparent) mesh.renderOrder = m.blending === THREE.AdditiveBlending ? 3 : m.depthWrite === false && !m.map ? 2 : 1;
    c.rm.g.add(mesh);
  }
  c.bk.clear();
}

// ---------------------------------------------------------------- pokoj: narzedzia
const civ = () => Object.assign(randomOutfit('thug'), { mask: false, hat: R() < 0.75 ? 'none' : 'cap', top: R() < 0.6 ? 'tshirt' : 'hoodie', topCol: pick(['#c9c2b3', '#3a3a3a', '#6b1a1a', '#1d3050', '#5b5f66', '#2d4a3a', '#8a6a3a']) });
function makeCtx(d) {
  const r = d.room, ns = d.ns, g = new THREE.Group(), rm = { d, g, npcs: [], entered: false, yaw: 0 };
  const ud = ns ? new V3(1, 0, 0) : new V3(0, 0, 1), vd = ns ? new V3(0, 0, r.sIn) : new V3(r.sIn, 0, 0);
  // znak osi u tak, by uklad (s*u, y, v) byl prawoskretny: meble i napisy nigdy nie sa odbite lustrzanie
  const s = new V3().crossVectors(ud, new V3(0, 1, 0)).dot(vd) > 0 ? 1 : -1;
  const [ox, oz] = r.W(0, 0);
  const F = new THREE.Matrix4().makeBasis(ud.clone().multiplyScalar(s), new V3(0, 1, 0), vd).setPosition(ox, SW, oz);
  const env = ENV_OF[d.type];
  const c = { r, ns, rm, s, F, env, bk: new Map(), hw: r.cw / 2, cd: r.cd, ch: r.ch, du: d.c - r.uc, gw: d.gw, gh: d.gh - SW, world: (u, v) => r.W(u, v) };
  const M = name => matFor(name, env);
  c.solid = (u0, u1, v0, v1, y0, y1) => {
    const [ax0, az0] = r.W(u0, v0), [ax1, az1] = r.W(u1, v1);
    addBox({ x0: Math.min(ax0, ax1), x1: Math.max(ax0, ax1), y0: SW + y0, y1: SW + y1, z0: Math.min(az0, az1), z1: Math.max(az0, az1) });
  };
  const uvOf = (m, o, sx, sy, sz) => {
    if (o && o.cell) { const [x0, y0, x1, y1] = o.cell; return (i, u, v, out) => out.push(x0 + u * (x1 - x0), y0 + v * (y1 - y0)); }
    const ts = (o && o.ts) || m.userData.ts; if (!ts || sx === undefined) return null;
    const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
    return (i, u, v, out) => { const f = (i / 6) | 0; out.push(u * dims[f][0] / ts, v * dims[f][1] / ts); };
  };
  // prostopadloscian w ukladzie pokoju; o === true -> z kolizja
  c.B = (u0, u1, v0, v1, y0, y1, mn, col = '#ffffff', o) => {
    const a0 = Math.min(u0, u1), a1 = Math.max(u0, u1), b0 = Math.min(v0, v1), b1 = Math.max(v0, v1), sx = a1 - a0, sy = y1 - y0, sz = b1 - b0;
    if (sx <= 0 || sy <= 0 || sz <= 0) return;
    const m = M(mn), oo = o === true ? null : o;
    emit(c, m, 'box', (a0 + a1) / 2, (y0 + y1) / 2, (b0 + b1) / 2, sx, sy, sz, 0, 0, 0, col, (oo && oo.k) || 1, uvOf(m, oo, sx, sy, sz));
    if (o === true || (oo && oo.col)) c.solid(a0, a1, b0, b1, y0, y1);
  };
  // walec pionowy (rt: stosunek promienia gory do dolu)
  c.Cy = (u, v, y0, y1, rad, mn, col = '#ffffff', o = {}) => { const m = M(mn); emit(c, m, `cyl_${o.seg || 12}_${o.rt ?? 1}`, u, (y0 + y1) / 2, v, 2 * rad, y1 - y0, 2 * rad, 0, 0, 0, col, o.k || 1, uvOf(m, o)); };
  c.Ch = (u0, u1, v, y, rad, mn, col = '#ffffff', o = {}) => { const m = M(mn); emit(c, m, `cyl_${o.seg || 10}_${o.rt ?? 1}`, (u0 + u1) / 2, y, v, 2 * rad, Math.abs(u1 - u0), 2 * rad, 0, 0, Math.PI / 2, col, o.k || 1, uvOf(m, o)); };
  c.Cv = (u, v0, v1, y, rad, mn, col = '#ffffff', o = {}) => { const m = M(mn); emit(c, m, `cyl_${o.seg || 10}_${o.rt ?? 1}`, u, y, (v0 + v1) / 2, 2 * rad, Math.abs(v1 - v0), 2 * rad, Math.PI / 2, 0, 0, col, o.k || 1, uvOf(m, o)); };
  c.Sp = (u, y, v, ru, ry, rv, mn, col = '#ffffff', o = {}) => { const m = M(mn); emit(c, m, `sph_${o.seg || 10}`, u, y, v, 2 * ru, 2 * ry, 2 * rv, o.rx || 0, o.ry || 0, o.rz || 0, col, o.k || 1, uvOf(m, o)); };
  c.T = (u, y, v, rad, mn, col = '#ffffff', o = {}) => { emit(c, M(mn), 'tor', u, y, v, 2 * rad, 2 * rad, (o.th || 1) * 2 * rad, Math.PI / 2, 0, 0, col, o.k || 1, null); };
  const FACE = { '+v': [0, 0], '-v': [0, Math.PI], '+u': [0, s * Math.PI / 2], '-u': [0, -s * Math.PI / 2], up: [-Math.PI / 2, 0], down: [Math.PI / 2, 0] };
  c.Pl = (u, v, y, w, h, face, mn, col = '#ffffff', o = {}) => { const m = M(mn), [rx, ry] = FACE[face]; emit(c, m, 'plane', u, y, v, w, h, 1, rx, ry, 0, col, o.k || 1, uvOf(m, o)); };
  // "linie": sciany i fronty regalow. a = wzdluz, d = odleglosc od linii w strone pokoju
  c.L = { back: { ax: 'u', b: c.cd - 0.05, dir: -1 }, front: { ax: 'u', b: 0.05, dir: 1 }, left: { ax: 'v', b: -c.hw + 0.05, dir: 1 }, right: { ax: 'v', b: c.hw - 0.05, dir: -1 } };
  c.at = (L, a, d) => L.ax === 'u' ? [a, L.b + L.dir * d] : [L.b + L.dir * d, a];
  c.LB = (L, a0, a1, d0, d1, y0, y1, mn, col, o) => L.ax === 'u' ? c.B(a0, a1, L.b + L.dir * d0, L.b + L.dir * d1, y0, y1, mn, col, o) : c.B(L.b + L.dir * d0, L.b + L.dir * d1, a0, a1, y0, y1, mn, col, o);
  c.LP = (L, a, d, y, w, h, mn, col, o) => { const [u, v] = c.at(L, a, d); c.Pl(u, v, y, w, h, L.ax === 'u' ? (L.dir > 0 ? '+v' : '-v') : (L.dir > 0 ? '+u' : '-u'), mn, col, o); };
  c.LC = (L, a, d, y0, y1, rad, mn, col, o) => { const [u, v] = c.at(L, a, d); c.Cy(u, v, y0, y1, rad, mn, col, o); };
  c.LH = (L, a0, a1, d, y, rad, mn, col, o) => { if (L.ax === 'u') c.Ch(a0, a1, L.b + L.dir * d, y, rad, mn, col, o); else c.Cv(L.b + L.dir * d, a0, a1, y, rad, mn, col, o); };
  c.LD = (L, a, d0, d1, y, rad, mn, col, o) => { if (L.ax === 'u') c.Cv(a, L.b + L.dir * d0, L.b + L.dir * d1, y, rad, mn, col, o); else c.Ch(L.b + L.dir * d0, L.b + L.dir * d1, a, y, rad, mn, col, o); };
  c.LS = (L, a, d, y, ra, ry, rd, mn, col, o) => { const [u, v] = c.at(L, a, d); if (L.ax === 'u') c.Sp(u, y, v, ra, ry, rd, mn, col, o); else c.Sp(u, y, v, rd, ry, ra, mn, col, o); };
  // obrocone pudelko: (fu,fv) = kierunek "przodu" mebla (osiowo), a = w prawo, b = do przodu
  c.O = (u, v, fu, fv, a0, a1, b0, b1, y0, y1, mn, col, o) => {
    const us = [a0 * fv + b0 * fu, a1 * fv + b0 * fu, a0 * fv + b1 * fu, a1 * fv + b1 * fu], vs = [-a0 * fu + b0 * fv, -a1 * fu + b0 * fv, -a0 * fu + b1 * fv, -a1 * fu + b1 * fv];
    c.B(u + Math.min(...us), u + Math.max(...us), v + Math.min(...vs), v + Math.max(...vs), y0, y1, mn, col, o);
  };
  c.op = (u, v, fu, fv, a, b) => [u + a * fv + b * fu, v - a * fu + b * fv];
  c.pool = (u, v, w, dd, col, k, y = 0.012) => c.Pl(u, v, y, w, dd, 'up', 'pool', col, { k });
  c.blob = (u0, u1, v0, v1, y = 0.008, gr = 0.25) => c.Pl((u0 + u1) / 2, (v0 + v1) / 2, y, Math.abs(u1 - u0) + 2 * gr, Math.abs(v1 - v0) + 2 * gr, 'up', 'blob');
  c.npc = (u, v, fu = 0, fv = -1, kind = 'thug') => { // fu,fv: w ktora strone patrzy (domyslnie na drzwi)
    const H = buildThug(kind, civ()), [x, z] = r.W(u, v), dx = ns ? fu : r.sIn * fv, dz = ns ? r.sIn * fv : fu;
    H.root.position.set(x, SW, z); H.root.rotation.y = Math.atan2(dx, dz); H.setHands('open', 'open'); g.add(H.root);
    rm.npcs.push({ H, t: rnd(0, 6), p: newPose() }); return H;
  };
  return c;
}

// ---------------------------------------------------------------- wspolne elementy
function shell(c, o) {
  const { B, hw, cd, ch } = c, e = 0.05;
  const [fm, fc = '#ffffff'] = o.floor, [cm, cc = '#ffffff'] = o.ceil, [wm, wc = '#ffffff'] = o.wall, [km, kc = '#ffffff'] = o.back || o.wall;
  B(-hw, hw, 0, cd, -0.06, 0.004, fm, fc);
  B(-hw, hw, 0, cd, ch - e, ch + 0.02, cm, cc);
  B(-hw, hw, cd - e, cd, 0, ch, km, kc); B(-hw, -hw + e, 0, cd, 0, ch, wm, wc); B(hw - e, hw, 0, cd, 0, ch, wm, wc);
  const g0 = c.du - c.gw / 2, g1 = c.du + c.gw / 2, gh = c.gh;
  B(-hw, g0, 0, e, 0, ch, wm, wc); B(g1, hw, 0, e, 0, ch, wm, wc); B(g0, g1, 0, e, gh, ch, wm, wc);
  const tc = o.trim || o.base;
  B(g0 - 0.09, g0, 0, e + 0.03, 0, gh + 0.09, 'gloss', tc); B(g1, g1 + 0.09, 0, e + 0.03, 0, gh + 0.09, 'gloss', tc); B(g0 - 0.09, g1 + 0.09, 0, e + 0.03, gh, gh + 0.09, 'gloss', tc);
  const segs = [[c.L.back, -hw + e, hw - e], [c.L.left, e, cd - e], [c.L.right, e, cd - e], [c.L.front, -hw + e, g0 - 0.09], [c.L.front, g1 + 0.09, hw - e]];
  let off = 0;
  if (o.wains) { // boazeria do wysokosci ph
    const [pm, pc, ph] = o.wains; off = 0.03;
    for (const [L, a0, a1] of segs) { c.LB(L, a0, a1, 0, 0.03, 0, ph, pm, pc); c.LB(L, a0, a1, 0, 0.055, ph, ph + 0.06, 'grainG', pc); }
  }
  if (o.band) for (const [L, a0, a1] of segs) { const y = o.bandY || ch - 0.75; c.LB(L, a0, a1, 0, 0.006, y, y + 0.22, 'paint', o.band); }
  for (const [L, a0, a1] of segs) c.LB(L, a0, a1, off, off + 0.018, 0, 0.11, 'gloss', o.base);       // listwy przypodlogowe
  if (o.crown) for (const [L, a0, a1] of segs) c.LB(L, a0, a1, 0, 0.05, ch - e - 0.09, ch - e, 'gloss', o.crown); // gzyms
}
function lampPanel(c, u, v, w = 1.2, d = 0.6, k = 2.2, tint = '#fff4e2', pool = 1) {
  const y = c.ch - 0.05;
  c.B(u - w / 2 - 0.04, u + w / 2 + 0.04, v - d / 2 - 0.04, v + d / 2 + 0.04, y - 0.02, y, 'paint', '#cfcfcb');
  c.B(u - w / 2, u + w / 2, v - d / 2, v + d / 2, y - 0.03, y - 0.02, 'panelL', tint, { k });
  if (pool) c.pool(u, v, 3.2 * pool, 3.2 * pool, tint, 0.12 * pool);
}
function pendant(c, u, v, drop, shadeCol = '#2b2b2b', rad = 0.2, k = 3, tint = '#ffd9a0', pool = 1, mn = 'steel') {
  const y = c.ch - 0.05, yb = y - drop;
  c.Cy(u, v, yb + 0.2, y, 0.006, 'matte', '#111111', { seg: 4 }); c.Cy(u, v, y - 0.03, y, 0.06, 'steel', '#222222');
  c.Cy(u, v, yb, yb + 0.22, rad, mn, shadeCol, { rt: 0.28, seg: 16 });
  c.Cy(u, v, yb - 0.004, yb, rad * 0.94, 'lamp', tint, { seg: 16, k });
  if (pool) c.pool(u, v, 2.4 * pool, 2.4 * pool, tint, 0.16 * pool);
}
function plant(c, u, v, sz = 1, pot = '#e8e2d6', kind = 'bush') {
  c.Cy(u, v, 0, 0.42 * sz, 0.2 * sz, 'gloss', pot, { rt: 1.25, seg: 14 }); c.Cy(u, v, 0.4 * sz, 0.41 * sz, 0.24 * sz, 'matte', '#2a1d14', { seg: 14 });
  c.blob(u - 0.2 * sz, u + 0.2 * sz, v - 0.2 * sz, v + 0.2 * sz, 0.008, 0.15);
  const greens = ['#3d6a2c', '#4f7d34', '#2f5a28', '#5d8a3a'];
  if (kind === 'bush') for (let i = 0; i < 7; i++) { const a = R() * 6.28, d = rr(0, 0.18) * sz; c.Sp(u + Math.cos(a) * d, rr(0.6, 1.05) * sz, v + Math.sin(a) * d, rr(0.14, 0.24) * sz, rr(0.12, 0.2) * sz, rr(0.14, 0.24) * sz, 'matte', pick(greens), { seg: 8 }); }
  const n = kind === 'palm' ? 10 : 9;
  for (let i = 0; i < n; i++) { // liscie: plaskie ostrza od srodka donicy
    const yaw = (i / n) * 6.28 + rr(-0.2, 0.2), tilt = kind === 'palm' ? rr(0.9, 1.3) : kind === 'snake' ? rr(0.05, 0.25) : rr(0.5, 0.9), len = (kind === 'palm' ? rr(0.7, 1.0) : kind === 'snake' ? rr(0.5, 0.8) : rr(0.35, 0.5)) * sz;
    const eb = new THREE.Euler(tilt, yaw, 0, 'YXZ'), dir = new V3(0, 1, 0).applyEuler(eb), y0 = kind === 'palm' ? 1.5 * sz : 0.42 * sz;
    const m4 = new THREE.Matrix4().compose(new V3(c.s * u + dir.x * len / 2, y0 + dir.y * len / 2, v + dir.z * len / 2), new THREE.Quaternion().setFromEuler(eb), new V3(kind === 'snake' ? 0.07 * sz : 0.16 * sz, len, 0.012)).premultiply(c.F);
    emitM(c, matFor('matte', c.env), 'box', m4, pick(greens), 1, null);
  }
  if (kind === 'palm') c.Cy(u, v, 0.4 * sz, 1.55 * sz, 0.05 * sz, 'grain', '#6a5038', { rt: 0.7 });
}
// obraz / plakat w ramie na scianie L
function picture(c, L, a, y, w, h, mn, cell, frame = '#2a1e16', mat = 0.05) {
  c.LB(L, a - w / 2 - 0.04, a + w / 2 + 0.04, 0, 0.035, y - h / 2 - 0.04, y + h / 2 + 0.04, 'grainG', frame);
  if (mat) c.LP(L, a, 0.036, y, w, h, 'matte', '#e8e2d4');
  c.LP(L, a, 0.037, y, w - 2 * mat, h - 2 * mat, mn, '#ffffff', { cell });
}
function chair(c, u, v, fu, fv, col = '#5a3b25', kind = 'wood') {
  const O = (a0, a1, b0, b1, y0, y1, mn, cl) => c.O(u, v, fu, fv, a0, a1, b0, b1, y0, y1, mn, cl);
  const leg = (a, b, y1, mn, cl, r = 0.018) => { const [x, z] = c.op(u, v, fu, fv, a, b); c.Cy(x, z, 0, y1, r, mn, cl, { seg: 6 }); };
  if (kind === 'bistro') {
    c.Cy(u, v, 0.44, 0.48, 0.2, 'grain', col, { seg: 14 }); for (const [a, b] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) leg(a, b, 0.44, 'steel', '#222222', 0.012);
    for (const a of [-0.15, 0.15]) { const [x, z] = c.op(u, v, fu, fv, a, -0.17); c.Cy(x, z, 0.48, 0.86, 0.012, 'steel', '#222222', { seg: 6 }); }
    O(-0.18, 0.18, -0.19, -0.16, 0.7, 0.86, 'grain', col);
  } else {
    O(-0.21, 0.21, -0.2, 0.2, 0.43, 0.47, kind === 'pad' ? 'fabric' : 'grain', col);
    for (const [a, b] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) leg(a, b, 0.43, 'grain', col);
    for (const a of [-0.18, 0.18]) { const [x, z] = c.op(u, v, fu, fv, a, -0.18); c.Cy(x, z, 0.47, 0.92, 0.018, 'grain', col, { seg: 6 }); }
    O(-0.19, 0.19, -0.2, -0.17, 0.62, 0.9, 'grain', col);
  }
  c.blob(u - 0.22, u + 0.22, v - 0.22, v + 0.22, 0.008, 0.12);
}
function table(c, u, v, kind, top = '#5a3b25', w = 0.8, d = 0.8, h = 0.75, legCol = '#222222') {
  if (kind === 'round') {
    c.Cy(u, v, h - 0.035, h, w / 2, 'grainG', top, { seg: 20 }); c.Cy(u, v, 0.04, h - 0.035, 0.035, 'steel', legCol, { seg: 8 }); c.Cy(u, v, 0, 0.04, 0.24, 'steel', legCol, { seg: 14, rt: 0.8 });
  } else {
    c.B(u - w / 2, u + w / 2, v - d / 2, v + d / 2, h - 0.04, h, 'grainG', top);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.B(u + a * (w / 2 - 0.06) - 0.025, u + a * (w / 2 - 0.06) + 0.025, v + b * (d / 2 - 0.06) - 0.025, v + b * (d / 2 - 0.06) + 0.025, 0, h - 0.04, 'grainG', legCol);
  }
  c.solid(u - w / 2, u + w / 2, v - d / 2, v + d / 2, 0, h);
  c.blob(u - w / 2, u + w / 2, v - d / 2, v + d / 2, 0.008, 0.25);
}
// sofa przy linii L (oparcie przy linii), wycentrowana na a
function sofa(c, L, a, len, col, dep = 0.92) {
  const a0 = a - len / 2, a1 = a + len / 2;
  c.LB(L, a0, a1, 0, dep, 0.1, 0.42, 'fabric', col); c.LB(L, a0, a1, 0, 0.22, 0.42, 0.88, 'fabric', col);
  c.LB(L, a0, a0 + 0.2, 0, dep, 0.42, 0.66, 'fabric', col); c.LB(L, a1 - 0.2, a1, 0, dep, 0.42, 0.66, 'fabric', col);
  const n = Math.max(2, Math.round((len - 0.4) / 0.7)), cw = (len - 0.4) / n;
  for (let i = 0; i < n; i++) { const s0 = a0 + 0.2 + i * cw; c.LB(L, s0 + 0.01, s0 + cw - 0.01, 0.22, dep - 0.02, 0.42, 0.55, 'fabric', col); c.LB(L, s0 + 0.02, s0 + cw - 0.02, 0.2, 0.36, 0.55, 0.86, 'fabric', col); }
  for (const s0 of [a0 + 0.08, a1 - 0.08]) for (const d of [0.08, dep - 0.08]) c.LC(L, s0, d, 0, 0.1, 0.025, 'grain', '#2a1a10', { seg: 6 });
  c.LB(L, a0 + 0.3, a0 + 0.72, 0.3, 0.42, 0.55, 0.92, 'fabric', pick(['#c9a24a', '#a8432f', '#e8dcc0'])); c.LB(L, a1 - 0.72, a1 - 0.3, 0.3, 0.42, 0.55, 0.92, 'fabric', pick(['#c9a24a', '#2f4a6a', '#e8dcc0']));
  const [p0, q0] = c.at(L, a0, 0), [p1, q1] = c.at(L, a1, dep); c.solid(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 0, 0.88);
  c.blob(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 0.008, 0.2);
}
// towar na polce: rzad produktow wzdluz linii L, front polki na odleglosci dF
const GOODS = { box: [0.17, 0.25, 0.22, 0.32], bag: [0.18, 0.24, 0.2, 0.3], can: [0.066, 0.066, 0.12, 0.12], bottle: [0.07, 0.09, 0.24, 0.32], jar: [0.09, 0.1, 0.11, 0.15], carton: [0.08, 0.09, 0.18, 0.22] };
function goodsRow(c, L, a0, a1, dF, y, hMax, kinds, drink = false) {
  let a = a0 + 0.03;
  while (a < a1 - 0.1) {
    const k = pick(kinds), [w0, w1, h0, h1] = GOODS[k], w = rr(w0, w1), h = Math.min(hMax, rr(h0, h1)), cell = cellUV(drink || k === 'can' ? ri(0, 8) : ri(8, 64), 8, 8);
    const tint = pick(['#ffffff', '#f2eee8', '#e8eef2']); let n = ri(2, 7);
    while (n-- > 0 && a + w < a1 - 0.02) { item(c, L, k, a + w / 2, dF, y, w, h, cell, tint); a += w + 0.008; }
    a += rr(0.02, 0.08);
  }
}
function item(c, L, k, a, dF, y, w, h, cell, tint) {
  const o = { cell, seg: 8 };
  if (k === 'box') c.LB(L, a - w / 2, a + w / 2, dF - 0.075, dF, y, y + h, 'goods', tint, { cell });
  else if (k === 'carton') c.LB(L, a - w / 2, a + w / 2, dF - w, dF, y, y + h, 'goods', tint, { cell });
  else if (k === 'bag') c.LS(L, a, dF - 0.05, y + h / 2, w / 2, h / 2, 0.045, 'goods', tint, { cell, seg: 8 });
  else if (k === 'can') { c.LC(L, a, dF - w / 2, y, y + h, w / 2, 'goods', tint, o); c.LC(L, a, dF - w / 2 - 0.07, y, y + h, w / 2, 'goods', tint, o); }
  else if (k === 'jar') { c.LC(L, a, dF - w / 2, y, y + h * 0.85, w / 2, 'goods', tint, o); c.LC(L, a, dF - w / 2, y + h * 0.85, y + h, w * 0.46, 'steel', pick(['#c8a040', '#d0d0d0', '#a02020']), { seg: 8 }); }
  else if (k === 'bottle') {
    const gc = pick(['#2a5a2a', '#5a3010', '#d8e4e8', '#1a2a4a']);
    c.LC(L, a, dF - w / 2, y, y + h * 0.6, w / 2, 'goods', tint, o); c.LC(L, a, dF - w / 2, y + h * 0.6, y + h * 0.74, w / 2, 'bottle', gc, { rt: 0.36, seg: 8 });
    c.LC(L, a, dF - w / 2, y + h * 0.74, y + h * 0.95, w * 0.18, 'bottle', gc, { seg: 6 }); c.LC(L, a, dF - w / 2, y + h * 0.95, y + h, w * 0.2, 'gloss', pick(['#c8102e', '#e8e8e8', '#2b78c5', '#d4a020']), { seg: 6 });
  }
}
// regal przy linii L: plecy przy linii, glebokosc dep, polki na wysokosciach lv
function shelving(c, L, a0, a1, dep, h, lv, kinds, o = {}) {
  const fc = o.frame || '#7c8085', bc = o.backCol || '#3a3c3f';
  c.LB(L, a0, a1, 0, 0.03, 0.12, h, 'paint', bc); c.LB(L, a0, a1, 0.03, dep, 0, 0.12, 'paint', '#2a2b2d');
  c.LB(L, a0, a0 + 0.03, 0, dep, 0, h, 'paint', fc); c.LB(L, a1 - 0.03, a1, 0, dep, 0, h, 'paint', fc); c.LB(L, a0, a1, 0, dep, h - 0.04, h, 'paint', fc);
  for (const y of lv) {
    c.LB(L, a0 + 0.03, a1 - 0.03, 0.03, dep, y - 0.025, y, 'paint', fc);
    c.LB(L, a0 + 0.03, a1 - 0.03, dep - 0.004, dep + 0.006, y - 0.045, y + 0.005, 'gloss', o.strip || '#e8e4d8');      // listwa cenowa
    if (kinds) goodsRow(c, L, a0 + 0.03, a1 - 0.03, dep - 0.02, y, Math.min(0.34, (lv[lv.indexOf(y) + 1] || h) - y - 0.06), kinds, o.drink);
  }
  if (o.col !== false) { const [p0, q0] = c.at(L, a0, 0), [p1, q1] = c.at(L, a1, dep); c.solid(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 0, h); }
  const [p0, q0] = c.at(L, a0, 0), [p1, q1] = c.at(L, a1, dep); c.blob(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 0.009, 0.3);
}

// ---------------------------------------------------------------- szablony pokoi
const BUILD = {
  shop(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['tile'], wall: ['plaster', '#b3ab9a'], ceil: ['acoustic', '#c9c4ba'], base: '#2e2d2b', band: '#8e2a22', bandY: ch - 0.7 });
    for (const u of [-hw * 0.55, 0, hw * 0.55]) for (const v of [cd * 0.22, cd * 0.52, cd * 0.82]) lampPanel(c, u, v, 1.2, 0.3, 2.3, '#fff3e0', 0.9);
    // lodowki z napojami wzdluz prawej sciany (szklane drzwi, podswietlone wnetrze)
    const f0 = 1.4, f1 = cd - 1.0, fd = 0.85, R_ = L.right, nU = Math.max(2, Math.round((f1 - f0) / 1.25)), uw = (f1 - f0) / nU;
    c.LB(R_, f0, f1, 0, fd, 0, 0.18, 'paint', '#1c1d1f'); c.LB(R_, f0, f1, 0, fd, 2.12, 2.25, 'paint', '#e6e6e2'); c.LB(R_, f0, f1, 0, 0.04, 0.18, 2.12, 'lamp', '#dfeeff', { k: 0.85 });
    c.LB(R_, f0, f1, fd - 0.02, fd, 2.25, 2.55, 'lamp', '#d81a28', { k: 1.4 }); c.LB(R_, f0 - 0.02, f1 + 0.02, 0, fd + 0.02, 2.55, 2.6, 'paint', '#202022');
    for (let i = 0; i <= nU; i++) { const a = f0 + i * uw; c.LB(R_, a - 0.035, a + 0.035, 0, fd, 0.18, 2.12, 'paint', '#e6e6e2'); }
    for (let i = 0; i < nU; i++) {
      const a0 = f0 + i * uw + 0.035, a1 = f0 + (i + 1) * uw - 0.035;
      for (const y of [0.55, 0.98, 1.41, 1.84]) { c.LB(R_, a0, a1, 0.04, fd - 0.1, y - 0.015, y, 'steel', '#bfc4c8'); goodsRow(c, R_, a0, a1, fd - 0.12, y, 0.3, i % 2 ? ['bottle', 'can'] : ['can', 'can', 'bottle'], true); }
      goodsRow(c, R_, a0, a1, fd - 0.12, 0.18, 0.32, ['can', 'bottle'], true);
      c.LB(R_, a0, a1, fd - 0.03, fd - 0.01, 0.2, 2.1, 'glass', '#d8e8f0');
      c.LB(R_, a0, a1, fd - 0.035, fd, 0.18, 0.24, 'paint', '#1c1d1f'); c.LB(R_, a0, a1, fd - 0.035, fd, 2.06, 2.12, 'paint', '#1c1d1f');
      c.LB(R_, a1 - 0.08, a1 - 0.06, fd, fd + 0.05, 0.8, 1.6, 'chrome', '#d0d0d0');
    }
    { const [p, q] = c.at(R_, f0, 0), [p2, q2] = c.at(R_, f1, fd); c.solid(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0, 2.6); }
    c.pool(hw - 1.6, (f0 + f1) / 2, 1.8, f1 - f0, '#cfe6ff', 0.1);
    c.rm.cola = c.world(hw - 2.1, (1.5 + cd - 2) / 2); c.rm.colaT = 0;
    // regaly: tylna sciana i lewa sciana
    shelving(c, L.back, -hw + 0.62, hw - 0.1, 0.5, 2.2, [0.12, 0.55, 0.95, 1.35, 1.75], ['box', 'box', 'bag', 'jar', 'carton', 'bottle']);
    shelving(c, L.left, 3.4, cd - 0.6, 0.5, 2.2, [0.12, 0.55, 0.95, 1.35, 1.75], ['box', 'bag', 'can', 'jar']);
    // dwustronne regaly (gondole) na srodku
    const gv0 = 3.3, gv1 = cd - 1.6, rC = hw - 3.4, lC = rC - 3.0;
    for (const gc of lC - 0.45 > -hw + 2.2 ? [rC, lC] : [rC]) {
      for (const dir of [1, -1]) shelving(c, { ax: 'v', b: gc, dir }, gv0, gv1, 0.44, 1.62, [0.12, 0.5, 0.88, 1.26], ['box', 'bag', 'jar', 'bottle', 'can', 'carton'], { col: false, backCol: '#8a8d90', frame: '#9a9da0' });
      c.solid(gc - 0.45, gc + 0.45, gv0, gv1, 0, 1.62);
      c.B(gc - 0.45, gc + 0.45, gv0 - 0.02, gv0, 1.62, 1.9, 'paint', '#c8102e'); c.B(gc - 0.4, gc + 0.4, gv0 - 0.03, gv0 - 0.02, 1.66, 1.86, 'goods', '#ffffff', { cell: cellUV(0, 8, 8) });
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) c.B(gc - 0.4 + j * 0.27 + i * 0.13, gc - 0.15 + j * 0.27 + i * 0.13, gv0 - 0.45, gv0 - 0.05, i * 0.26, i * 0.26 + 0.25, 'goods', '#ffffff', { cell: cellUV(ri(8, 64), 8, 8) });
    }
    // lada z kasa przy wejsciu po lewej
    const cu0 = -hw + 0.1, cu1 = Math.min(-hw + 3.4, du - 1.4), cv0 = 1.5, cv1 = 2.1;
    if (cu1 - cu0 > 1.2) {
      B(cu0, cu1, cv0, cv1, 0, 1.0, 'grain', '#5a3a24', true); B(cu0, cu1, cv0 - 0.01, cv0, 0.08, 0.95, 'panel', '#6a4a30'); B(cu0, cu1, cv0 + 0.04, cv1, 0, 0.08, 'matte', '#1a1816');
      B(cu0 - 0.02, cu1 + 0.04, cv0 - 0.06, cv1 + 0.02, 1.0, 1.05, 'gloss', '#cfc6b4');
      const ku = cu1 - 0.6; B(ku - 0.2, ku + 0.2, cv0 + 0.15, cv0 + 0.5, 1.05, 1.15, 'gloss', '#202224'); B(ku - 0.17, ku + 0.17, cv0 + 0.42, cv0 + 0.46, 1.15, 1.42, 'gloss', '#151618');
      c.Pl(ku, cv0 + 0.415, 1.285, 0.3, 0.22, '-v', 'screen', '#ffffff', { cell: cellUV(0, 2, 2) });
      B(ku + 0.3, ku + 0.42, cv0 + 0.1, cv0 + 0.25, 1.05, 1.12, 'gloss', '#2a2a2a'); // terminal
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) B(cu0 + 0.3 + i * 0.18, cu0 + 0.44 + i * 0.18, cv0 + 0.1 + j * 0.17, cv0 + 0.24 + j * 0.17, 1.05, 1.13, 'goods', '#ffffff', { cell: cellUV(ri(8, 64), 8, 8) });
      // za lada: szafka z papierosami i losami
      c.LB(L.left, 2.2, 3.3, 0, 0.35, 0, 0.9, 'grain', '#4a3020'); c.LB(L.left, 2.2, 3.3, 0, 0.3, 1.25, 2.3, 'paint', '#2a2b2d');
      for (const y of [1.3, 1.65, 2.0]) for (let a = 2.25; a < 3.25; a += 0.08) c.LB(L.left, a, a + 0.065, 0.2, 0.29, y, y + 0.28, 'goods', '#ffffff', { cell: cellUV(ri(8, 64), 8, 8) });
      c.npc((cu0 + cu1) / 2, 2.75);
    }
    // zamrazarka z lodami przy wejsciu po prawej
    const zu0 = du + 1.35, zu1 = hw - 0.15;
    if (zu1 - zu0 > 1.2) {
      B(zu0, zu1, 0.1, 0.85, 0, 0.82, 'gloss', '#e8e8e4', true); B(zu0 + 0.05, zu1 - 0.05, 0.15, 0.8, 0.82, 0.84, 'glass', '#cfe6ff');
      for (let a = zu0 + 0.1; a < zu1 - 0.2; a += 0.17) B(a, a + 0.15, 0.2, 0.75, 0.62, 0.74, 'goods', '#ffffff', { cell: cellUV(ri(8, 64), 8, 8) });
      B(zu0, zu1, 0.08, 0.1, 0.4, 0.75, 'goods', '#ffffff', { cell: cellUV(14, 8, 8) });
    }
    B(du - 0.9, du + 0.9, 0.06, 1.25, 0.004, 0.016, 'carpet', '#3a3a3a');                                     // wycieraczka
    picture(c, L.left, 0.9, 1.9, 0.5, 1.0, 'poster', cellUV(0, 4, 1), '#111111', 0);
    c.Sp(hw - 0.4, ch - 0.25, 0.4, 0.16, 0.12, 0.16, 'mirror', '#9aa0a8');                                     // lustro bezpieczenstwa
    c.npc(rC - 1.5, cd * 0.55, 1, 0);
  },
  cafe(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['wood'], wall: ['plaster', '#b9a07c'], back: ['brick'], ceil: ['plaster', '#b8ab98'], wains: ['panel', '#8a6a4a', 1.0], base: '#2a1c12', crown: '#cfc4b0' });
    for (let v = 1.4; v < cd - 0.5; v += 1.9) B(-hw, hw, v - 0.09, v + 0.09, ch - 0.28, ch - 0.05, 'grain', '#4a3222');  // belki stropowe
    // lada
    const v0 = cd - 2.5, v1 = cd - 1.85, u0 = -hw + 1.2, u1 = hw - 1.6;
    B(u0, u1, v0, v1, 0, 1.0, 'grain', '#4a3020', true); B(u0, u1, v0 + 0.04, v1, 0, 0.08, 'matte', '#141210');
    for (let u = u0 + 0.06; u < u1 - 0.05; u += 0.12) B(u - 0.045, u + 0.045, v0 - 0.02, v0, 0.08, 0.98, 'grain', '#6a4529');
    B(u0 - 0.05, u1 + 0.05, v0 - 0.08, v1 + 0.02, 1.0, 1.05, 'gloss', '#d6cfc2');
    // gablota z ciastami
    const gu0 = u0 + 0.2, gu1 = Math.min(u0 + 1.9, u1 - 1.2);
    B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.05, 1.5, 'glass', '#e8f0f0'); B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.5, 1.53, 'steel', '#c8c8c8'); B(gu0, gu1, v0 + 0.06, v1 - 0.06, 1.25, 1.26, 'glass', '#e8f0f0');
    for (let u = gu0 + 0.2; u < gu1 - 0.15; u += 0.32) { c.Cy(u, (v0 + v1) / 2, 1.06, 1.16, 0.12, 'matte', pick(['#5a3018', '#e8d0b0', '#c86070', '#f0e8d8']), { seg: 14 }); c.Sp(u, 1.31, (v0 + v1) / 2, 0.09, 0.04, 0.05, 'matte', '#c88a40', { seg: 8 }); }
    c.B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.05, 1.06, 'lamp', '#ffe0b0', { k: 0.5 });
    const ku = u1 - 0.7; B(ku - 0.18, ku + 0.18, v0 + 0.2, v0 + 0.5, 1.05, 1.14, 'gloss', '#202224'); B(ku - 0.15, ku + 0.15, v0 + 0.42, v0 + 0.46, 1.14, 1.36, 'gloss', '#151618');
    c.Pl(ku, v0 + 0.415, 1.25, 0.26, 0.18, '-v', 'screen', '#ffffff', { cell: cellUV(1, 2, 2) });
    c.Cy(ku - 0.5, v0 + 0.2, 1.05, 1.22, 0.06, 'glass', '#e0f0e8');
    for (const u of [u0 + 0.15, (u0 + u1) / 2, u1 - 0.15]) pendant(c, u, v0 + 0.25, 1.15, '#b88a3e', 0.17, 3, '#ffcf90', 0.8, 'brass');
    if (u1 - u0 > 3) pendant(c, (u0 * 3 + u1) / 4 + 0.6, v0 + 0.25, 1.15, '#b88a3e', 0.17, 3, '#ffcf90', 0.8, 'brass');
    // tylny blat z ekspresem, mlynkiem, kubkami
    const K = L.back; c.LB(K, -hw + 0.4, hw - 0.4, 0, 0.6, 0, 0.9, 'grain', '#4a3020', true); c.LB(K, -hw + 0.38, hw - 0.38, 0, 0.62, 0.9, 0.94, 'gloss', '#2a2725');
    c.LB(K, -hw + 0.4, hw - 0.4, 0, 0.012, 0.94, 1.5, 'subway', '#ffffff');
    const eu = -0.4; c.LB(K, eu - 0.6, eu + 0.6, 0.12, 0.58, 0.94, 1.45, 'chrome', '#d6d6d6'); c.LB(K, eu - 0.58, eu + 0.58, 0.58, 0.6, 1.0, 1.38, 'gloss', '#8a1a14');
    for (const a of [eu - 0.3, eu + 0.3]) { c.LC(K, a, 0.66, 1.16, 1.24, 0.05, 'chrome', '#d6d6d6'); c.LB(K, a - 0.02, a + 0.02, 0.66, 0.84, 1.14, 1.18, 'gloss', '#111111'); }
    c.LB(K, eu - 0.5, eu + 0.5, 0.58, 0.72, 0.94, 0.98, 'chrome', '#c8c8c8'); c.LD(K, eu + 0.5, 0.58, 0.72, 1.15, 0.008, 'chrome', '#d6d6d6');
    for (let i = 0; i < 6; i++) c.LC(K, eu - 0.45 + i * 0.18, 0.3, 1.45, 1.53, 0.04, 'gloss', '#f0ece4', { seg: 10 });
    c.LB(K, 0.6, 0.85, 0.15, 0.4, 0.94, 1.25, 'gloss', '#1a1a1a'); c.LC(K, 0.725, 0.28, 1.25, 1.5, 0.11, 'bottle', '#3a2216', { rt: 1.35, seg: 12 });
    picture(c, K, 0, 2.4, 3.2, 1.0, 'menu', null, '#2a1a10', 0);
    for (const s of [-1, 1]) { const a0 = s < 0 ? -hw + 0.5 : 2.0, a1 = s < 0 ? -2.0 : hw - 0.5; if (a1 - a0 < 0.6) continue; for (const y of [1.85, 2.35]) { c.LB(K, a0, a1, 0, 0.26, y - 0.03, y, 'grainG', '#4a3020'); for (let a = a0 + 0.1; a < a1 - 0.1; a += rr(0.14, 0.24)) R() < 0.6 ? c.LC(K, a, 0.13, y, y + rr(0.08, 0.2), rr(0.04, 0.06), pick(['gloss', 'bottle']), pick(['#f0ece4', '#3a2216', '#c8a060', '#2a5a2a']), { seg: 10 }) : c.LC(K, a, 0.13, y, y + 0.1, 0.045, 'gloss', '#ffffff', { seg: 10 }); } }
    // stoliki z krzeslami
    const tc = ['#5a3b25', '#3a2a1e'];
    for (const v of [2.0, 4.3, v0 - 1.6]) for (const u of [-hw + 2.0, -hw + 4.6, hw - 4.6, hw - 2.0]) {
      if (v < 3.4 && Math.abs(u - du) < 1.7) continue; if (v > v0 - 1.0) continue;
      const round = (Math.round(u + v * 3) & 1) === 0;
      table(c, u, v, round ? 'round' : 'rect', '#6a4a30', round ? 0.76 : 0.75, 0.75);
      chair(c, u - 0.62, v, 1, 0, pick(tc), round ? 'bistro' : 'wood'); chair(c, u + 0.62, v, -1, 0, pick(tc), round ? 'bistro' : 'wood');
      c.Cy(u + 0.12, v + 0.05, 0.75, 0.83, 0.04, 'gloss', '#f0ece4', { seg: 10 }); if (R() < 0.5) c.Cy(u - 0.15, v - 0.1, 0.75, 0.76, 0.09, 'gloss', '#f0ece4', { seg: 12 });
      pendant(c, u, v, 1.45, '#1f1f1f', 0.14, 2.6, '#ffc880', 0.65);
    }
    plant(c, -hw + 0.55, 0.6, 1.3, '#cfc6b4'); plant(c, hw - 0.55, 0.6, 1.2, '#3a3a3a', 'snake');
    picture(c, L.left, cd * 0.35, 1.85, 0.8, 0.6, 'art', cellUV(1, 2, 2)); picture(c, L.left, cd * 0.62, 1.85, 0.7, 0.7, 'art', cellUV(2, 2, 2));
    picture(c, L.right, cd * 0.45, 1.95, 0.5, 1.0, 'poster', cellUV(2, 4, 1), '#111111', 0);
    c.npc(0, cd - 1.25); c.npc(1.0, v0 - 0.7, 0, 1); c.npc(-hw + 2.6, 4.3, -1, 0);
  },
  bar(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['wood', '#8a6a52'], wall: ['plaster', '#5e2c25'], ceil: ['tin', '#8a7a5e'], wains: ['panel', '#6a4a34', 1.15], base: '#1c120c', crown: '#3a2416' });
    const v0 = cd * 0.6 - 0.35, v1 = cd * 0.6 + 0.35, u0 = -hw + 1.4, u1 = hw - 1.4;
    B(u0, u1, v0, v1, 0, 1.05, 'panel', '#6a4630', true); B(u0, u1, v0 + 0.05, v1, 0, 0.1, 'matte', '#100c0a');
    B(u0 - 0.05, u1 + 0.05, v0 - 0.12, v1 + 0.04, 1.05, 1.11, 'grainG', '#3a2214'); c.Ch(u0 - 0.05, u1 + 0.05, v0 - 0.1, 1.09, 0.05, 'grainG', '#2e1a10');
    c.Ch(u0 + 0.2, u1 - 0.2, v0 - 0.3, 0.22, 0.025, 'brass', '#d9b060'); for (let u = u0 + 0.3; u < u1 - 0.2; u += 1.4) c.Cv(u, v0 - 0.3, v0, 0.22, 0.015, 'brass', '#d9b060');
    for (let u = u0 + 0.5; u < u1 - 0.3; u += 1.0) {
      const sv = v0 - 0.72; c.Cy(u, sv, 0.72, 0.8, 0.2, 'leather', '#6b1a1a', { seg: 14 }); c.Cy(u, sv, 0.05, 0.72, 0.028, 'chrome', '#d0d0d0', { seg: 8 });
      c.Cy(u, sv, 0, 0.04, 0.2, 'chrome', '#bcbcbc', { seg: 14 }); c.T(u, 0.3, sv, 0.17, 'chrome', '#d0d0d0'); c.blob(u - 0.2, u + 0.2, sv - 0.2, sv + 0.2, 0.008, 0.1);
    }
    const tu = 0.4; c.B(tu - 0.3, tu + 0.3, v0 + 0.2, v0 + 0.32, 1.11, 1.55, 'chrome', '#d0d0d0');
    for (let i = 0; i < 4; i++) { const u = tu - 0.22 + i * 0.147; c.Cv(u, v0 + 0.08, v0 + 0.2, 1.42, 0.014, 'chrome', '#d0d0d0'); c.B(u - 0.02, u + 0.02, v0 + 0.06, v0 + 0.1, 1.42, 1.62, 'gloss', pick(['#1a1a1a', '#c8a040', '#8a1a14', '#1a3a6a'])); }
    for (const u of [u0 + 1.2, -0.6, u1 - 0.9]) { c.Cy(u, v0 + 0.1, 1.11, 1.26, 0.04, 'glass', '#f0e0b0', { seg: 10 }); c.Cy(u, v0 + 0.1, 1.11, 1.22, 0.035, 'bottle', '#c88a20', { seg: 10 }); }
    // zaplecze baru: lustro, szklane polki z butelkami podswietlone od spodu, neon
    const K = L.back; c.LB(K, -hw + 0.6, hw - 0.6, 0, 0.55, 0, 0.95, 'panel', '#5a3a26', true); c.LB(K, -hw + 0.58, hw - 0.58, 0, 0.58, 0.95, 1.0, 'grainG', '#2a1810');
    c.LB(K, -hw + 0.6, hw - 0.6, 0, 0.015, 1.0, 2.62, 'mirror', '#8a8478'); c.LB(K, -hw + 0.55, hw - 0.55, 0, 0.04, 2.62, 2.7, 'grainG', '#2a1810');
    for (const y of [1.35, 1.82, 2.29]) {
      c.LB(K, -hw + 0.65, hw - 0.65, 0.015, 0.3, y - 0.012, y, 'glass', '#f0f0e0'); c.LB(K, -hw + 0.65, hw - 0.65, 0.2, 0.29, y - 0.03, y - 0.012, 'lamp', '#ffb050', { k: 1.6 });
      for (let a = -hw + 0.75; a < hw - 0.8; a += rr(0.09, 0.14)) {
        const t = ri(0, 3), gc = pick(['#2a4a1a', '#6a3008', '#a85a10', '#d8e0e0', '#1a1a3a', '#5a0a10']), h = t === 0 ? rr(0.28, 0.34) : rr(0.22, 0.27), lab = cellUV(ri(0, 64), 8, 8);
        if (t === 1) { c.LB(K, a - 0.04, a + 0.04, 0.1, 0.18, y, y + h * 0.7, 'bottle', gc); c.LB(K, a - 0.041, a + 0.041, 0.099, 0.181, y + h * 0.2, y + h * 0.45, 'goods', '#ffffff', { cell: lab }); }
        else { c.LC(K, a, 0.14, y, y + h * 0.65, 0.038, 'bottle', gc, { seg: 8 }); c.LC(K, a, 0.14, y + h * 0.25, y + h * 0.5, 0.039, 'goods', '#ffffff', { cell: lab, seg: 8 }); c.LC(K, a, 0.14, y + h * 0.65, y + h * 0.75, 0.038, 'bottle', gc, { rt: 0.35, seg: 8 }); }
        c.LC(K, a, 0.14, y + h * 0.7, y + h, 0.012, 'bottle', gc, { seg: 6 });
      }
    }
    c.LP(K, 0, 0.05, 3.1, 2.0, 1.0, 'neon', '#ffffff', { k: 1.4 }); c.pool(0, cd - 1.0, 4, 2, '#ff60c0', 0.12);
    for (const u of [u0 + 0.4, 0, u1 - 0.4]) pendant(c, u, (v0 + v1) / 2, 1.25, '#7a3a10', 0.14, 3.2, '#ffb060', 0.9, 'brass');
    // boksy przy lewej scianie
    for (let a = 1.5; a + 1.9 < v0 - 0.6; a += 2.4) {
      const Lf = L.left;
      for (const [b0, b1, bb0, bb1] of [[a - 0.8, a - 0.35, a - 0.8, a - 0.68], [a + 0.35, a + 0.8, a + 0.68, a + 0.8]]) { c.LB(Lf, b0, b1, 0, 1.1, 0, 0.46, 'leather', '#5a1414', true); c.LB(Lf, bb0, bb1, 0, 1.1, 0.46, 1.25, 'leather', '#4a1010'); }
      c.LB(Lf, a - 0.33, a + 0.33, 0.05, 0.95, 0.72, 0.76, 'grainG', '#3a2214', true); c.LC(Lf, a, 0.6, 0, 0.72, 0.04, 'steel', '#222222');
      c.LB(Lf, a - 0.1, a + 0.1, 0, 0.12, 1.65, 1.95, 'brass', '#c9a25a'); c.LB(Lf, a - 0.08, a + 0.08, 0.12, 0.14, 1.68, 1.9, 'lamp', '#ffc070', { k: 2 });
      const [pu, pv] = c.at(Lf, a, 0.6); c.pool(pu, pv, 1.6, 1.6, '#ffb060', 0.14);
      picture(c, Lf, a, 2.4, 0.6, 0.45, 'art', cellUV(3, 2, 2), '#1a1008');
    }
    // stol bilardowy
    const pu = hw - 2.5, pv = 2.6;
    if (pu - 0.7 > du + 1.0 && v0 > pv + 1.6) {
      B(pu - 0.7, pu + 0.7, pv - 1.2, pv + 1.2, 0.66, 0.8, 'grainG', '#3a2012', true); B(pu - 0.6, pu + 0.6, pv - 1.1, pv + 1.1, 0.8, 0.81, 'fabric', '#1f6a3a');
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { B(pu + a * 0.55 - 0.07, pu + a * 0.55 + 0.07, pv + b * 1.05 - 0.07, pv + b * 1.05 + 0.07, 0, 0.66, 'grainG', '#2a160c'); c.Cy(pu + a * 0.6, pv + b * 1.1, 0.79, 0.812, 0.05, 'matte', '#050505'); }
      for (let i = 0; i < 9; i++) c.Sp(pu + rr(-0.45, 0.45), 0.838, pv + rr(-0.9, 0.9), 0.028, 0.028, 0.028, 'gloss', pick(['#f0f0e8', '#c8202a', '#f2c318', '#1a3a8a', '#1a1a1a', '#2a7a3a']), { seg: 8 });
      c.Ch(pu - 0.3, pu + 0.5, pv + 0.4, 0.84, 0.01, 'grainG', '#c8a070');
      B(pu - 0.25, pu + 0.25, pv - 0.8, pv + 0.8, ch - 1.45, ch - 1.3, 'gloss', '#1f4a2a'); B(pu - 0.22, pu + 0.22, pv - 0.77, pv + 0.77, ch - 1.46, ch - 1.45, 'lamp', '#fff0c8', { k: 2.4 });
      for (const v of [pv - 0.7, pv + 0.7]) c.Cy(pu, v, ch - 1.3, ch, 0.005, 'matte', '#111111', { seg: 4 });
      c.pool(pu, pv, 2.0, 3.2, '#fff0c8', 0.22, 0.815); c.pool(pu, pv, 3.4, 4.4, '#ffd8a0', 0.08);
      c.npc(pu - 1.2, pv - 0.6, 1, 0);
    }
    const dv = Math.min(v0 - 0.8, 4.4); c.Ch(hw - 0.09, hw - 0.05, dv, 1.75, 0.23, 'matte', '#141414', { seg: 20 }); c.Ch(hw - 0.1, hw - 0.09, dv, 1.75, 0.18, 'matte', '#d8c9a0', { seg: 20 }); c.Ch(hw - 0.11, hw - 0.1, dv, 1.75, 0.08, 'matte', '#a01818', { seg: 16 }); c.Ch(hw - 0.12, hw - 0.11, dv, 1.75, 0.02, 'matte', '#1a6a2a', { seg: 8 });
    picture(c, L.right, cd - 1.2, 2.0, 0.5, 1.0, 'poster', cellUV(2, 4, 1), '#111111', 0);
    c.npc(0, v1 + 0.6); c.npc(u0 + 1.5, v0 - 0.75, 0, 1);
  },
  apt(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['wood', '#c49870'], wall: ['plaster', '#a8977e'], back: ['plaster', '#4c6461'], ceil: ['plaster', '#cfc8bd'], base: '#e2dccf', crown: '#e2dccf' });
    // lampa sufitowa z abazurem
    c.Cy(0, cd * 0.5, ch - 0.55, ch - 0.05, 0.006, 'matte', '#111111', { seg: 4 }); c.Cy(0, cd * 0.5, ch - 0.82, ch - 0.55, 0.32, 'lamp', '#e8c890', { seg: 20, k: 0.75 });
    c.Cy(0, cd * 0.5, ch - 0.825, ch - 0.82, 0.3, 'lamp', '#fff0d0', { seg: 20, k: 2.2 }); c.pool(0, cd * 0.5, 4, 4, '#ffd8a0', 0.14);
    // okna w lewej scianie: widok na miasto, rama, parapet, zaslony
    const W = L.left;
    for (const a of [cd * 0.3, cd * 0.7]) {
      const w = 1.15, y0 = 0.9, y1 = 2.45;
      c.LP(W, a, 0.008, (y0 + y1) / 2, w, y1 - y0, 'view', '#e8e0d8', { cell: [a / cd * 0.6, 0.15, a / cd * 0.6 + 0.35, 0.75] });
      for (const [b0, b1] of [[a - w / 2 - 0.07, a - w / 2], [a + w / 2, a + w / 2 + 0.07], [a - 0.025, a + 0.025]]) c.LB(W, b0, b1, 0, 0.09, y0, y1, 'gloss', '#e8e2d6');
      for (const [z0, z1] of [[y1, y1 + 0.07], [(y0 + y1) / 2 - 0.025, (y0 + y1) / 2 + 0.025]]) c.LB(W, a - w / 2, a + w / 2, 0, 0.09, z0, z1, 'gloss', '#e8e2d6');
      c.LB(W, a - w / 2 - 0.12, a + w / 2 + 0.12, 0, 0.2, y0 - 0.06, y0, 'gloss', '#e8e2d6');
      c.LH(W, a - w / 2 - 0.5, a + w / 2 + 0.5, 0.16, y1 + 0.28, 0.015, 'brass', '#b89050');
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const ac = a + s * (w / 2 + 0.06 + i * 0.065); c.LC(W, ac, 0.13 + (i % 2) * 0.04, 0.03, y1 + 0.26, 0.042, 'fabric', '#8a3a2c', { seg: 8 }); }
      const [pu, pv] = c.at(W, a, 1.2); c.pool(pu, pv, 1.8, 1.6, '#ffc890', 0.1);
    }
    // salon: sofa przy tylnej scianie, stolik, dywan, telewizor na szafce przy drzwiach
    const la = -hw + 1.7;
    B(la - 1.4, la + 1.4, cd - 3.3, cd - 0.5, 0.004, 0.016, 'rug', '#ffffff');
    sofa(c, L.back, la, 2.2, '#5f6f78');
    picture(c, L.back, la, 1.75, 1.1, 0.75, 'art', cellUV(0, 2, 2), '#c9a25a');
    const tv = cd - 1.95; B(la - 0.55, la + 0.55, tv - 0.28, tv + 0.28, 0.38, 0.42, 'grainG', '#4a2e1c', true); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.Cy(la + a * 0.48, tv + b * 0.22, 0, 0.38, 0.02, 'grainG', '#2a1a10', { seg: 6 });
    c.B(la - 0.25, la + 0.05, tv - 0.15, tv + 0.1, 0.42, 0.46, 'goods', '#ffffff', { cell: cellUV(20, 8, 8) }); c.Cy(la + 0.3, tv, 0.42, 0.52, 0.04, 'gloss', '#c8402a', { seg: 10 });
    c.blob(la - 0.55, la + 0.55, tv - 0.28, tv + 0.28, 0.018, 0.2);
    const t0 = -hw + 0.6, t1 = Math.min(-hw + 2.6, du - 1.2);
    if (t1 - t0 > 1.0) {
      c.LB(L.front, t0, t1, 0, 0.42, 0, 0.5, 'grainG', '#3a2a20', true); c.LB(L.front, (t0 + t1) / 2 - 0.08, (t0 + t1) / 2 + 0.08, 0.15, 0.3, 0.5, 0.58, 'gloss', '#111111');
      c.LB(L.front, (t0 + t1) / 2 - 0.65, (t0 + t1) / 2 + 0.65, 0.18, 0.23, 0.6, 1.36, 'gloss', '#101012');
      c.LP(L.front, (t0 + t1) / 2, 0.232, 0.98, 1.22, 0.69, 'screen', '#ffffff', { cell: cellUV(2, 2, 2), k: 0.9 });
    }
    // kuchnia wzdluz prawej sciany
    const K = L.right, k0 = Math.max(1.6, cd - 3.4), k1 = cd - 0.05;
    c.LB(K, k0, k1, 0, 0.6, 0.1, 0.88, 'paint', '#e2ddd2', true); c.LB(K, k0, k1, 0.04, 0.56, 0, 0.1, 'matte', '#1a1816');
    for (let a = k0; a < k1 - 0.1; a += 0.6) { c.LB(K, a + 0.005, a + 0.01, 0.6, 0.605, 0.12, 0.86, 'matte', '#6a665e'); c.LB(K, a + 0.25, a + 0.35, 0.6, 0.625, 0.78, 0.8, 'chrome', '#c8c8c8'); }
    c.LB(K, k0, k1, 0, 0.63, 0.88, 0.92, 'gloss', '#2b2b2b'); c.LB(K, k0, k1, 0, 0.012, 0.92, 1.45, 'subway', '#ffffff');
    c.LB(K, k0, k1, 0, 0.35, 1.45, 2.25, 'paint', '#e2ddd2'); for (let a = k0; a < k1 - 0.1; a += 0.5) c.LB(K, a + 0.005, a + 0.01, 0.35, 0.355, 1.47, 2.23, 'matte', '#6a665e');
    c.LB(K, k0, k1, 0.3, 0.34, 1.44, 1.45, 'lamp', '#fff0d0', { k: 2 }); { const [pu, pv] = c.at(K, (k0 + k1) / 2, 0.4); c.pool(pu, pv, 1.4, k1 - k0, '#ffe0b0', 0.08, 0.93); }
    const sa = k0 + 0.9; c.LB(K, sa - 0.3, sa + 0.3, 0.1, 0.5, 0.86, 0.925, 'steel', '#bfc2c4'); c.LC(K, sa, 0.08, 0.92, 1.2, 0.015, 'chrome', '#d0d0d0'); c.LD(K, sa, 0.08, 0.28, 1.2, 0.013, 'chrome', '#d0d0d0');
    const so = k0 + 2.1; if (so + 0.35 < k1) { c.LB(K, so - 0.32, so + 0.32, 0.03, 0.6, 0.921, 0.93, 'gloss', '#0e0e0e'); for (const [x, y] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, 0.45], [0.15, 0.45]]) { const [pu, pv] = c.at(K, so + x, y); c.T(pu, 0.932, pv, 0.08, 'steel', '#3a3a3a'); } c.LB(K, so - 0.33, so + 0.33, 0, 0.45, 2.0, 2.25, 'steel', '#c0c2c4'); }
    { const a0 = k0 - 0.75, a1 = k0 - 0.04; if (a0 > 1.4) { c.LB(K, a0, a1, 0, 0.68, 0, 1.95, 'gloss', '#cfd0cc', true); c.LB(K, a0, a1, 0.68, 0.69, 1.25, 1.27, 'matte', '#555555'); c.LB(K, a0 + 0.05, a0 + 0.08, 0.69, 0.73, 1.35, 1.75, 'chrome', '#d0d0d0'); } }
    // regal z ksiazkami
    const b0 = la + 1.4, b1 = Math.min(hw - 0.75, b0 + 2.4);
    if (b1 - b0 > 0.8) {
      c.LB(L.back, b0, b1, 0, 0.32, 0, 2.0, 'paint', '#e8e2d6', true);
      for (const y of [0.1, 0.5, 0.9, 1.3, 1.7]) { c.LB(L.back, b0 + 0.03, b1 - 0.03, 0.02, 0.3, y - 0.03, y, 'paint', '#ece6da'); c.LB(L.back, b0 + 0.03, b1 - 0.03, 0.02, 0.025, y, y + 0.36, 'matte', '#2a2622');
        for (let a = b0 + 0.05; a < b1 - 0.08;) { if (R() < 0.08) { c.LC(L.back, a + 0.06, 0.15, y, y + 0.2, 0.05, 'gloss', pick(['#2a5a6a', '#c8a060', '#e8e2d6']), { seg: 10 }); a += 0.14; continue; } const w = rr(0.025, 0.05), h = rr(0.2, 0.32); c.LB(L.back, a, a + w, 0.05, 0.27, y, y + h, 'matte', pick(['#7a1e1e', '#1f3f5a', '#2f4a2a', '#c8a060', '#e8e2d6', '#3a2a20', '#5a3a6a', '#a85a20'])); a += w + 0.003; } }
    }
    // lampa stojaca, fotel, stolik jadalny, rosliny
    const fu = -hw + 0.45, fv = cd - 0.45; c.Cy(fu, fv, 0, 0.03, 0.16, 'steel', '#222222'); c.Cy(fu, fv, 0.03, 1.45, 0.012, 'brass', '#b89050', { seg: 6 }); c.Cy(fu, fv, 1.45, 1.75, 0.2, 'lamp', '#f2d8a8', { rt: 0.7, seg: 16, k: 1.0 }); c.pool(fu + 0.4, fv - 0.4, 2, 2, '#ffd090', 0.14);
    const au = -hw + 0.85, av = cd * 0.5;
    c.O(au, av, 1, 0, -0.42, 0.42, -0.4, 0.4, 0.1, 0.44, 'fabric', '#8a6a3a', true); c.O(au, av, 1, 0, -0.42, 0.42, -0.42, -0.24, 0.44, 0.95, 'fabric', '#8a6a3a'); c.O(au, av, 1, 0, -0.42, -0.3, -0.4, 0.4, 0.44, 0.65, 'fabric', '#8a6a3a'); c.O(au, av, 1, 0, 0.3, 0.42, -0.4, 0.4, 0.44, 0.65, 'fabric', '#8a6a3a');
    c.blob(au - 0.4, au + 0.4, av - 0.42, av + 0.42, 0.008, 0.15);
    if (hw - 1.9 > du + 1.4) { table(c, hw - 1.9, 1.7, 'round', '#6a4a30', 0.8); chair(c, hw - 1.9, 1.08, 0, 1, '#4a3222'); chair(c, hw - 1.9, 2.32, 0, -1, '#4a3222'); c.Sp(hw - 1.9, 0.82, 1.7, 0.1, 0.06, 0.1, 'gloss', '#c8a040'); }
    plant(c, -hw + 0.45, cd * 0.5 + 0.75, 1.1, '#c86a3a'); plant(c, la + 1.25, cd - 0.45, 0.8, '#e8e2d6', 'snake');
    c.npc(hw - 1.5, cd - 1.7, 1, 0);
  },
  office(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['carpet', '#8a929c'], wall: ['plaster', '#a9adae'], back: ['plaster', '#3c5266'], ceil: ['acoustic', '#cfccc6'], base: '#2f3236' });
    for (const u of [-hw * 0.6, 0, hw * 0.6]) for (const v of [cd * 0.2, cd * 0.5, cd * 0.8]) lampPanel(c, u, v, 1.2, 0.6, 2.0, '#f6f6f2', 0.85);
    const desk = (u, vb, fv) => { // biurko z monitorem; uzytkownik siedzi po stronie fv
      const vf = vb + fv * 0.75, va = Math.min(vb, vf), vz = Math.max(vb, vf);
      B(u - 0.72, u + 0.72, va, vz, 0.72, 0.75, 'grainG', '#c9b79a'); for (const s of [-1, 1]) B(u + s * 0.68 - 0.02, u + s * 0.68 + 0.02, va + 0.03, vz - 0.03, 0, 0.72, 'steel', '#3a3d40');
      c.solid(u - 0.72, u + 0.72, va, vz, 0, 0.75); c.blob(u - 0.72, u + 0.72, va, vz, 0.012, 0.15);
      const mv = vb + fv * 0.18; c.Cy(u, mv, 0.75, 0.76, 0.1, 'steel', '#222222'); c.B(u - 0.02, u + 0.02, mv - 0.02, mv + 0.02, 0.76, 0.98, 'steel', '#222222');
      c.B(u - 0.3, u + 0.3, mv - 0.012, mv + 0.012, 0.92, 1.27, 'gloss', '#141518'); c.Pl(u, mv + fv * 0.013, 1.095, 0.56, 0.32, fv > 0 ? '+v' : '-v', 'screen', '#ffffff', { cell: cellUV(R() < 0.5 ? 0 : 1, 2, 2), k: 0.85 });
      const kv = vb + fv * 0.45; c.B(u - 0.22, u + 0.22, kv - 0.07, kv + 0.07, 0.75, 0.77, 'gloss', '#1e1f22'); c.B(u + 0.3, u + 0.36, kv - 0.04, kv + 0.04, 0.75, 0.77, 'gloss', '#1e1f22');
      if (R() < 0.6) c.Cy(u - 0.5, vb + fv * 0.35, 0.75, 0.85, 0.04, 'gloss', pick(['#f0ece4', '#c8402a', '#2a5a8a']), { seg: 10 }); if (R() < 0.7) c.B(u + 0.4, u + 0.62, vb + fv * 0.2, vb + fv * 0.5, 0.75, 0.78, 'matte', '#e8e6e0');
      // fotel biurowy
      const cv_ = vb + fv * 1.05; c.B(u - 0.3, u + 0.3, cv_ - 0.03, cv_ + 0.03, 0.04, 0.07, 'steel', '#1a1a1a'); c.B(u - 0.03, u + 0.03, cv_ - 0.3, cv_ + 0.3, 0.04, 0.07, 'steel', '#1a1a1a');
      c.Cy(u, cv_, 0.07, 0.42, 0.025, 'chrome', '#a0a0a0', { seg: 8 }); c.B(u - 0.24, u + 0.24, cv_ - 0.24, cv_ + 0.24, 0.42, 0.5, 'fabric', '#2a2d31');
      const bv = cv_ + fv * 0.24; c.B(u - 0.22, u + 0.22, bv - 0.03, bv + 0.03, 0.56, 1.05, 'fabric', '#2a2d31'); for (const s of [-1, 1]) c.B(u + s * 0.25 - 0.02, u + s * 0.25 + 0.02, cv_ - 0.15, cv_ + 0.12, 0.6, 0.63, 'gloss', '#1a1a1a');
      c.blob(u - 0.3, u + 0.3, cv_ - 0.3, cv_ + 0.3, 0.012, 0.1);
    };
    for (const vc of [3.6, 6.9]) for (const u of [-hw * 0.62, 0, hw * 0.62]) {
      if (vc + 1.8 > cd - 0.6) continue;
      desk(u, vc - 0.02, -1); desk(u, vc + 0.02, 1);
      c.B(u - 0.74, u + 0.74, vc - 0.02, vc + 0.02, 0.75, 1.25, 'fabric', '#5c6b78'); c.B(u - 0.75, u + 0.75, vc - 0.025, vc + 0.025, 1.25, 1.27, 'steel', '#9aa0a4');
    }
    // tablica, zegar, szafy na akta, kopiarka, dystrybutor wody, rosliny, obrazy
    const wb = Math.min(4, c.r.cw - 4); picture(c, L.back, 0, 1.65, wb, 1.15, 'white', null, '#b8bcc0', 0); c.LB(L.back, -wb / 2, wb / 2, 0.03, 0.09, 1.02, 1.05, 'steel', '#9aa0a4');
    c.LD(L.back, wb / 2 + 0.6, 0.0, 0.04, 2.75, 0.2, 'gloss', '#1a1a1a', { seg: 20 }); c.LD(L.back, wb / 2 + 0.6, 0.04, 0.05, 2.75, 0.18, 'gloss', '#f2f2ee', { seg: 20 });
    { const [pu, pv] = c.at(L.back, wb / 2 + 0.6, 0.055); c.B(pu - 0.006, pu + 0.006, pv - 0.004, pv + 0.004, 2.75, 2.88, 'matte', '#111111'); c.B(pu, pu + 0.1, pv - 0.004, pv + 0.004, 2.745, 2.755, 'matte', '#111111'); }
    for (let a = cd - 3.2; a < cd - 0.6; a += 0.52) { c.LB(L.right, a, a + 0.5, 0, 0.62, 0, 1.32, 'paint', '#8e9498', true); for (const y of [0.33, 0.66, 0.99]) { c.LB(L.right, a + 0.02, a + 0.48, 0.62, 0.625, y - 0.005, y, 'matte', '#3a3d40'); c.LB(L.right, a + 0.18, a + 0.32, 0.62, 0.645, y + 0.2, y + 0.23, 'chrome', '#d0d0d0'); } }
    { const [p, q] = c.at(L.right, cd - 3.2, 0), [p2, q2] = c.at(L.right, cd - 0.6, 0.62); c.blob(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0.012, 0.2); }
    c.LB(L.left, 1.4, 2.4, 0, 0.7, 0, 1.0, 'gloss', '#d0d2cc', true); c.LB(L.left, 1.4, 2.4, 0, 0.7, 1.0, 1.06, 'gloss', '#3a3d40'); c.LB(L.left, 2.0, 2.3, 0.5, 0.65, 1.06, 1.1, 'lamp', '#80c0ff', { k: 0.8 });
    c.LB(L.left, 2.9, 3.25, 0.05, 0.4, 0, 0.95, 'gloss', '#e8e8e4', true); c.LC(L.left, 3.075, 0.22, 0.95, 1.38, 0.14, 'glass', '#a0d0ff', { seg: 14 }); c.LC(L.left, 3.075, 0.22, 0.95, 1.3, 0.12, 'bottle', '#7ab8e8', { seg: 14 });
    plant(c, -hw + 0.55, cd - 0.55, 1.3, '#3a3d40', 'snake'); plant(c, hw - 0.55, 0.7, 1.2, '#e8e8e4');
    picture(c, L.left, cd * 0.5, 1.8, 1.0, 0.8, 'art', cellUV(3, 2, 2), '#111111'); picture(c, L.left, cd * 0.75, 1.8, 0.9, 0.9, 'art', cellUV(0, 2, 2), '#111111');
    c.npc(-hw * 0.62, 1.9, 0, 1); c.npc(hw * 0.62 + 0.95, 8.3, -1, 0); c.npc(0, 5.25, 1, 0);
  },
  gym(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['rubber', '#b0b4ba'], wall: ['plaster', '#8a8e96'], back: ['plaster', '#7a7e86'], ceil: ['plaster', '#5a5d62'], base: '#161616', band: '#b3261e', bandY: 2.7 });
    // instalacje pod sufitem i liniowe lampy
    c.Cv(-hw * 0.35, 0.2, cd - 0.2, ch - 0.45, 0.28, 'steel', '#a9acb0', { seg: 16 }); for (let v = 1; v < cd - 0.5; v += 2.2) c.Cy(-hw * 0.35, v, ch - 0.2, ch, 0.02, 'steel', '#333333');
    c.Cv(hw * 0.42, 0.2, cd - 0.2, ch - 0.3, 0.07, 'paint', '#8a1f1a');
    for (const u of [-hw * 0.62, 0, hw * 0.62]) for (const v of [cd * 0.28, cd * 0.7]) {
      B(u - 0.09, u + 0.09, v - 1.2, v + 1.2, ch - 0.68, ch - 0.6, 'steel', '#222222'); B(u - 0.07, u + 0.07, v - 1.18, v + 1.18, ch - 0.69, ch - 0.68, 'lamp', '#f2f6ff', { k: 3 });
      for (const s of [-1, 1]) c.Cy(u, v + s * 1.0, ch - 0.6, ch, 0.004, 'matte', '#111111', { seg: 4 }); c.pool(u, v, 3.2, 4.2, '#eef2ff', 0.12);
    }
    // lustro na tylnej scianie
    c.LB(L.back, -hw + 0.55, hw - 0.55, 0, 0.012, 0.3, 2.55, 'mirror', '#8a9098'); c.LB(L.back, -hw + 0.5, hw - 0.5, 0, 0.03, 2.55, 2.6, 'steel', '#2a2a2a'); c.LB(L.back, -hw + 0.5, hw - 0.5, 0, 0.03, 0.25, 0.3, 'steel', '#2a2a2a');
    // bieznie
    const n = Math.max(2, Math.min(4, Math.floor((c.r.cw - 3) / 2.2))), tv = cd - 3.4;
    for (let i = 0; i < n; i++) {
      const u = (i - (n - 1) / 2) * 2.2;
      B(u - 0.42, u + 0.42, tv, tv + 1.85, 0.06, 0.22, 'gloss', '#1d1f22', true); B(u - 0.27, u + 0.27, tv + 0.06, tv + 1.62, 0.22, 0.235, 'rubber', '#777777'); B(u - 0.42, u + 0.42, tv - 0.02, tv + 0.12, 0, 0.12, 'steel', '#2a2c30');
      for (const s of [-1, 1]) { B(u + s * 0.37 - 0.04, u + s * 0.37 + 0.04, tv + 1.62, tv + 1.72, 0.22, 1.2, 'steel', '#2a2c30'); c.Cv(u + s * 0.33, tv + 1.15, tv + 1.68, 1.05, 0.018, 'chrome', '#bcbcbc'); }
      B(u - 0.4, u + 0.4, tv + 1.58, tv + 1.78, 1.18, 1.44, 'gloss', '#202226'); c.Pl(u, tv + 1.578, 1.31, 0.42, 0.2, '-v', 'screen', '#ffffff', { cell: cellUV(3, 2, 2) });
      c.blob(u - 0.42, u + 0.42, tv, tv + 1.85, 0.008, 0.2);
    }
    // stojak z hantlami przy lewej scianie
    const D = L.left, r0 = 1.5, r1 = Math.min(cd - 3.8, r0 + 3.6);
    if (r1 - r0 > 1) {
      for (const [y, d0, d1] of [[0.45, 0.1, 0.6], [0.85, 0.08, 0.45]]) c.LB(D, r0, r1, d0, d1, y - 0.04, y, 'steel', '#1c1c1e');
      for (const a of [r0 + 0.05, (r0 + r1) / 2, r1 - 0.05]) c.LB(D, a - 0.04, a + 0.04, 0.1, 0.55, 0, 0.85, 'steel', '#1c1c1e');
      { const [p, q] = c.at(D, r0, 0), [p2, q2] = c.at(D, r1, 0.62); c.solid(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0, 0.9); c.blob(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0.008, 0.2); }
      let i = 0;
      for (let a = r0 + 0.25; a < r1 - 0.2; a += 0.36, i++) for (const [y, dd] of [[0.45, 0.35], [0.85, 0.27]]) {
        const hr = 0.05 + (i % 6) * 0.008 + (y > 0.6 ? -0.01 : 0.01);
        c.LD(D, a, dd - 0.18, dd + 0.18, y + hr, 0.014, 'chrome', '#c0c0c0', { seg: 6 });
        for (const s of [-1, 1]) c.LD(D, a, dd + s * 0.1 - 0.05, dd + s * 0.1 + 0.05, y + hr, hr, 'gloss', '#202022', { seg: 6 });
      }
    }
    // laweczka ze sztanga
    const bu = hw - 2.3, bv = Math.min(4.2, tv - 1.6);
    B(bu - 0.16, bu + 0.16, bv - 0.62, bv + 0.62, 0.38, 0.48, 'leather', '#1c1c1e', true); B(bu - 0.05, bu + 0.05, bv - 0.55, bv + 0.55, 0, 0.38, 'steel', '#2a2a2a');
    for (const s of [-1, 1]) { B(bu + s * 0.55 - 0.03, bu + s * 0.55 + 0.03, bv - 0.62, bv - 0.56, 0, 1.12, 'steel', '#2a2a2a'); B(bu + s * 0.55 - 0.2, bu + s * 0.55 + 0.2, bv - 0.64, bv - 0.54, 0, 0.04, 'steel', '#2a2a2a'); }
    c.Ch(bu - 1.1, bu + 1.1, bv - 0.59, 1.12, 0.014, 'chrome', '#d0d0d0');
    for (const s of [-1, 1]) for (const [o, r, col] of [[0.78, 0.225, '#b3261e'], [0.84, 0.2, '#1f4a8a']]) c.Ch(bu + s * o - 0.025, bu + s * o + 0.025, bv - 0.59, 1.12, r, 'matte', col, { seg: 18 });
    c.blob(bu - 0.6, bu + 0.6, bv - 0.7, bv + 0.62, 0.008, 0.2);
    // worek bokserski
    const pu = Math.max(2.5, du + 1.6), pv = 2.45; c.Cy(pu, pv, 0.55, 1.75, 0.18, 'leather', '#7a1a1a', { seg: 14 }); c.Cy(pu, pv, 1.75, 1.82, 0.15, 'matte', '#1a1a1a', { seg: 14 }); c.Cy(pu, pv, 1.82, ch, 0.008, 'chrome', '#909090', { seg: 4 });
    c.blob(pu - 0.2, pu + 0.2, pv - 0.2, pv + 0.2, 0.008, 0.2);
    // kettlebelle i maty
    for (let i = 0; i < 6; i++) { const u = -hw + 0.5 + i * 0.32; if (u > du - 1.1) break; c.Sp(u, 0.11, 0.35, 0.1, 0.1, 0.1, 'matte', ['#1a1a1a', '#b3261e', '#1f4a8a', '#2a7a3a', '#c8a020', '#1a1a1a'][i], { seg: 10 }); c.T(u, 0.24, 0.35, 0.06, 'matte', '#1a1a1a', { th: 1 }); }
    for (let i = 0; i < 4; i++) c.Ch(-hw + 0.15, -hw + 0.75, cd - 0.5 - i * 0.16, 0.08, 0.075, 'fabric', pick(['#5a2a6a', '#2a6a7a', '#7a3a2a']));
    picture(c, L.right, 1.6, 1.7, 0.6, 1.2, 'poster', cellUV(3, 4, 1), '#111111', 0); picture(c, L.left, cd - 1.6, 1.8, 0.5, 1.0, 'poster', cellUV(3, 4, 1), '#111111', 0);
    c.npc(Math.min(2, pu - 0.8), 4.0, 0, -1);
  },
  fisk(c) {
    const { B, hw, cd, ch, du, L } = c;
    shell(c, { floor: ['marble'], wall: ['plaster', '#3a2a22'], back: ['plaster', '#2a1e18'], ceil: ['plaster', '#2a221d'], wains: ['panel', '#7a4a2c', 3.2], base: '#1a120c', crown: '#c9a25a' });
    // kasetonowy sufit z wpuszczonymi swiatlami
    for (let u = -hw + 3.6; u < hw - 1; u += 3.6) B(u - 0.15, u + 0.15, 0, cd, ch - 0.5, ch - 0.05, 'grainG', '#3a2416');
    for (let v = 3.6; v < cd - 1; v += 3.6) B(-hw, hw, v - 0.15, v + 0.15, ch - 0.5, ch - 0.05, 'grainG', '#3a2416');
    for (let u = -hw + 1.8; u < hw; u += 3.6) for (let v = 1.8; v < cd; v += 3.6) { B(u - 0.7, u + 0.7, v - 0.7, v + 0.7, ch - 0.07, ch - 0.05, 'panelL', '#ffe2b0', { k: 1.5 }); c.pool(u, v, 4.5, 4.5, '#ffd8a0', 0.07); }
    // kolumny
    for (const [u, v] of [[-hw + 2.5, cd * 0.3], [hw - 2.5, cd * 0.3], [-hw + 2.5, cd * 0.62], [hw - 2.5, cd * 0.62]]) {
      B(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 0, 0.4, 'marble', '#ffffff'); c.Cy(u, v, 0.4, ch - 0.6, 0.48, 'marble', '#d8d0c4', { seg: 20 });
      c.Cy(u, v, 0.4, 0.5, 0.52, 'brass', '#c9a25a', { seg: 20 }); c.Cy(u, v, ch - 0.7, ch - 0.6, 0.52, 'brass', '#c9a25a', { seg: 20 }); B(u - 0.65, u + 0.65, v - 0.65, v + 0.65, ch - 0.6, ch - 0.05, 'grainG', '#3a2416');
      c.solid(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 0, ch); c.blob(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 0.008, 0.4);
    }
    // panorama miasta za biurkiem
    const pw = c.r.cw - 4;
    c.LP(L.back, 0, 0.03, 4.0, pw, 5.4, 'view', '#d8d0c8');
    for (let a = -pw / 2; a <= pw / 2 + 0.01; a += pw / Math.round(pw / 2.4)) c.LB(L.back, a - 0.06, a + 0.06, 0, 0.12, 1.3, 6.7, 'steel', '#141414');
    for (const y of [1.3, 3.9, 6.7]) c.LB(L.back, -pw / 2 - 0.06, pw / 2 + 0.06, 0, 0.12, y - 0.06, y + 0.06, 'steel', '#141414');
    c.pool(0, cd - 2.5, pw, 5, '#ffb070', 0.08);
    // biurko Kingpina, fotel, lampa bankierska
    B(-2.4, 2.4, cd - 3.6, cd - 2.6, 0, 0.78, 'panel', '#5a3420', true); B(-2.5, 2.5, cd - 3.7, cd - 2.5, 0.78, 0.84, 'grainG', '#2a160c');
    B(-1.6, 1.6, cd - 3.4, cd - 2.7, 0.84, 0.845, 'leather', '#1f3a2a'); c.Ch(-2.5, 2.5, cd - 3.7, 0.81, 0.02, 'brass', '#c9a25a');
    c.Cy(1.6, cd - 2.85, 0.84, 0.86, 0.1, 'brass', '#c9a25a'); c.Cy(1.6, cd - 2.85, 0.86, 1.2, 0.012, 'brass', '#c9a25a'); c.Ch(1.35, 1.85, cd - 2.95, 1.22, 0.07, 'gloss', '#1f6a3a', { seg: 12 }); c.Ch(1.37, 1.83, cd - 2.95, 1.19, 0.05, 'lamp', '#ffe8b0', { k: 1.5 });
    c.pool(1.6, cd - 3.05, 1.6, 1.0, '#ffe0a0', 0.25, 0.85);
    c.B(-1.3, -0.9, cd - 3.2, cd - 2.9, 0.845, 0.88, 'matte', '#e8e2d4'); c.B(-0.5, -0.2, cd - 3.0, cd - 2.8, 0.845, 0.9, 'gloss', '#111111'); c.Cy(-1.8, cd - 2.9, 0.845, 0.98, 0.04, 'brass', '#c9a25a');
    c.B(-0.4, 0.4, cd - 2.05, cd - 1.35, 0, 0.52, 'leather', '#1a1414', true); c.B(-0.42, 0.42, cd - 1.4, cd - 1.25, 0.52, 1.75, 'leather', '#1a1414'); for (const s of [-1, 1]) c.B(s * 0.44 - 0.07, s * 0.44 + 0.07, cd - 2.05, cd - 1.35, 0.52, 0.78, 'leather', '#1a1414');
    // czerwony chodnik od drzwi
    B(du - 1.6, du + 1.6, 0.4, cd - 4.0, 0.004, 0.02, 'fabric', '#7a1616'); for (const s of [-1, 1]) B(du + s * 1.6 - 0.08, du + s * 1.6 + 0.08, 0.4, cd - 4.0, 0.004, 0.021, 'fabric', '#c9a25a');
    // zyrandole
    for (const v of [cd * 0.32, cd * 0.62]) {
      c.Cy(0, v, ch - 1.6, ch - 0.05, 0.015, 'brass', '#c9a25a', { seg: 6 }); c.T(0, ch - 2.2, v, 0.9, 'brass', '#c9a25a'); c.T(0, ch - 1.9, v, 0.55, 'brass', '#c9a25a');
      c.Sp(0, ch - 2.0, v, 0.22, 0.32, 0.22, 'lamp', '#ffe0a8', { k: 1.8 });
      for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28; c.Sp(Math.cos(a) * 0.9, ch - 2.13, v + Math.sin(a) * 0.9, 0.06, 0.09, 0.06, 'lamp', '#ffe8c0', { k: 2.2, seg: 6 }); c.Sp(Math.cos(a) * 0.9, ch - 2.32, v + Math.sin(a) * 0.9, 0.035, 0.07, 0.035, 'glass', '#ffffff', { seg: 6 }); }
      c.pool(0, v, 7, 7, '#ffd8a0', 0.12);
    }
    // grupy wypoczynkowe po bokach
    for (const s of [-1, 1]) {
      const gu = s * (hw - 5.2), gv = cd * 0.46;
      sofa(c, { ax: 'u', b: gv - 1.5, dir: 1 }, gu, 2.4, '#1a1414'); sofa(c, { ax: 'u', b: gv + 1.5, dir: -1 }, gu, 2.4, '#1a1414');
      B(gu - 0.7, gu + 0.7, gv - 0.4, gv + 0.4, 0.38, 0.42, 'marble', '#ffffff', true); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.Cy(gu + a * 0.62, gv + b * 0.32, 0, 0.38, 0.02, 'brass', '#c9a25a', { seg: 6 });
      c.Cy(gu, gv, 0.42, 0.62, 0.08, 'gloss', '#e8e2d4', { rt: 0.6 }); c.blob(gu - 0.7, gu + 0.7, gv - 0.4, gv + 0.4, 0.01, 0.2);
      B(gu - 1.6, gu + 1.6, gv - 1.0, gv + 1.0, 0.004, 0.012, 'rug', '#ffffff');
      // regaly z ksiazkami
      const W = s < 0 ? L.left : L.right;
      for (const [a0, a1] of [[cd * 0.66, cd - 1.6]]) {
        c.LB(W, a0, a1, 0, 0.42, 0, 3.4, 'grainG', '#3a2214', true);
        for (let y = 0.1; y < 3.2; y += 0.55) { c.LB(W, a0 + 0.04, a1 - 0.04, 0.02, 0.4, y - 0.03, y, 'grainG', '#3a2214'); c.LB(W, a0 + 0.04, a1 - 0.04, 0.02, 0.025, y, y + 0.52, 'matte', '#1a120c');
          for (let a = a0 + 0.06; a < a1 - 0.1;) { const w = rr(0.03, 0.06), h = rr(0.28, 0.45); c.LB(W, a, a + w, 0.08, 0.36, y, y + h, 'leather', pick(['#5a1414', '#1a2a3a', '#2a3a1a', '#4a3a20', '#3a1a2a', '#6a5030'])); a += w + 0.004; } }
      }
      picture(c, W, cd * 0.42, 4.7, 2.4, 1.8, 'art', cellUV(s < 0 ? 0 : 1, 2, 2), '#c9a25a', 0.08);
      plant(c, s * (hw - 1.0), cd - 1.0, 1.4, '#2a2a2a', 'palm');
      // rzezba na postumencie przy wejsciu
      const su = du + s * 3.2; B(su - 0.3, su + 0.3, 1.4, 2.0, 0, 1.1, 'marble', '#ffffff', true); c.Sp(su, 1.42, 1.7, 0.18, 0.26, 0.16, 'brass', '#b8954a', { seg: 14 }); c.B(su - 0.15, su + 0.15, 1.55, 1.85, 1.1, 1.18, 'brass', '#b8954a');
    }
  },
};

// ---------------------------------------------------------------- zarzadzanie
function buildRoom(d) {
  const c = makeCtx(d); BUILD[d.type](c); flush(c); d.rm = c.rm; scene.add(c.rm.g);
  return c.rm;
}
export const playerInRoom = (d, m = 0) => { const r = d.room; return P.pos.x > r.bx0 - m && P.pos.x < r.bx1 + m && P.pos.z > r.bz0 - m && P.pos.z < r.bz1 + m && P.pos.y > -1 && P.pos.y < SW + r.ch + 0.6; };
let acc = 0, wasInFisk = false;
// cola z lodowki w sklepie: pelne zdrowie + puszka w dloni
let canMesh = null, canT = 0;
export function takeCola() {
  const d = P.colaNear; if (!d || !d.rm) return;
  d.rm.colaT = 15; P.hp = maxHp(); save.colas = (save.colas || 0) + 1; doSave();
  sfx('cola'); say('cola', true); popText('+ ZDROWIE'); showMsg('ZIMNA COLA', save.colas === 1 ? 'Pełne zdrowie! Sprzedawca macha ręką: „Na koszt firmy!”' : `Pełne zdrowie · wypite cole: ${save.colas}`, 2.6);
  if (!canMesh) { canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.3, metalness: 0.6 })); }
  if (P.H && P.H.handR) { P.H.handR.add(canMesh); canMesh.position.set(0, -0.05, 0.03); canMesh.rotation.set(0, 0, 0); canT = 3; }
}
export function updateRooms(dt) {
  acc += dt;
  if (canT > 0) { canT -= dt; if (canT <= 0 && canMesh && canMesh.parent) canMesh.parent.remove(canMesh); }
  P.colaNear = null;
  const near = (d) => Math.hypot(P.pos.x - d.x, P.pos.z - d.z);
  if (acc > 0.3) { // budowanie i ukrywanie co chwile, nie co klatke
    acc = 0; let built = 0;
    for (const d of doors) {
      const dist = near(d);
      if (!d.rm && dist < 55 && P.pos.y < 40 && built < 1) { buildRoom(d); built++; }
      if (d.rm) d.rm.g.visible = dist < 70;
    }
  }
  for (const d of doors) {
    if (!d.rm || !d.rm.g.visible) continue;
    if (Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 32) { for (const n of d.rm.npcs) { n.t += dt; for (const k in n.p) n.p[k] = 0; idlePose(n.p, n.t); applyPose(n.H, n.p); } }
    const inside = playerInRoom(d, 0);
    if (d.rm.cola) { d.rm.colaT = Math.max(0, d.rm.colaT - dt); if (inside && d.rm.colaT <= 0 && Math.hypot(P.pos.x - d.rm.cola[0], P.pos.z - d.rm.cola[1]) < 2.4) P.colaNear = d; }
    if (inside && !d.rm.entered) { d.rm.entered = true; const [t, s] = INTRO[d.type]; showMsg(t, s, 3.2); sayCtx('room', { variant: d.type }); if (d.type !== 'fisk') { popText('+20 PD'); import('./wrogowie.js').then(m => m.addXP(20)); } }
  }
  const fd = doors.find(d => d.type === 'fisk');
  if (fd && fd.rm) { const inF = playerInRoom(fd, -0.5); if (inF && !wasInFisk && !G.cine && !P.dead) startFisk(fd); wasInFisk = inF; }
}
// zachowane dla zgodnosci z reszta kodu (dawne teleportowane wnetrza)
export const enterDoor = () => {}, leaveInterior = () => {}, nearExit = () => false, updateInterior = () => {};
