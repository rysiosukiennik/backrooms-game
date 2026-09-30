// Wnetrza budynkow: sklep, mieszkanie, biuro i sala Fisk Tower. Kazdy pokoj to zamkniete pudelko z meblami
// zbudowane wysoko nad miastem (tam nikt nie dolatuje); wchodzac przez drzwi gracz jest tam przenoszony.
import { V3, cv, canvasTex, rnd, save } from './util.js';
import { G, P, cam, scene } from './stan.js';
import { addBox, SW, setInteriorLight } from './miasto.js';
import { buildThug, newPose, applyPose, idlePose } from './postac.js';
import { showMsg, popText } from './ui.js';
import { sfx } from './dzwiek.js';

const T = 0.6; // grubosc scian
export const ROOMS = {};
const ORG = { shop: [-200, 900, 0], apt: [-100, 940, 0], office: [0, 980, 0], fisk: [120, 1040, 0] };
const SIZE = { shop: [18, 12, 4.2], apt: [12, 9, 3.1], office: [22, 14, 3.6], fisk: [34, 26, 9] };
const INTRO = {
  shop: ['SKLEP', 'Sprzedawca: „Spider-Man?! Weź sobie colę, na koszt firmy!”'],
  apt: ['MIESZKANIE', 'Lokator: „Ej, tylko nie zgnieć moich kwiatków!”'],
  office: ['BIURO', 'Pracownik: „Czy to zdjęcie do Daily Bugle?”'],
  fisk: ['FISK TOWER', 'Sala główna. Tutaj urzęduje Kingpin.'],
};

// ---------------------------------------------------------------- tekstury
const tcache = {};
function tex(name, draw, rep = 1) {
  const k = name; if (tcache[k]) return tcache[k];
  const c = cv(256, 256), x = c.getContext('2d'); draw(x, 256);
  const t = canvasTex(c, true); tcache[k] = t; return t;
}
const noise = (x, s, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } };
const TEX = {
  wood: () => tex('wood', (x, s) => { x.fillStyle = '#8a6540'; x.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(${40 + i * 6},25,10,.25)`; x.fillRect(0, i * 32, s, 2); x.fillStyle = `rgba(255,220,170,${0.02 * (i % 3)})`; x.fillRect(0, i * 32 + 3, s, 28); for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect((i * 53 + j * 91) % s, i * 32, 2, 32); } } noise(x, s, 3000, 0.05); }),
  tile: () => tex('tile', (x, s) => { x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, s, s); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? '#b9b3a4' : '#d3cec2'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } noise(x, s, 3000, 0.04); }),
  marble: () => tex('marble', (x, s) => { x.fillStyle = '#1c1c20'; x.fillRect(0, 0, s, s); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { x.fillStyle = (i + j) % 2 ? '#26262b' : '#d8d3c8'; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); } x.strokeStyle = 'rgba(120,120,120,.25)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(Math.random() * s, Math.random() * s); x.bezierCurveTo(Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s); x.stroke(); } }),
  carpet: () => tex('carpet', (x, s) => { x.fillStyle = '#4a5560'; x.fillRect(0, 0, s, s); noise(x, s, 9000, 0.09); }),
  paint: () => tex('paint', (x, s) => { x.fillStyle = '#d9d1c2'; x.fillRect(0, 0, s, s); noise(x, s, 4000, 0.03); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, s - 26, s, 26); x.fillStyle = '#efe9dc'; x.fillRect(0, s - 26, s, 3); }),
  paneling: () => tex('paneling', (x, s) => { x.fillStyle = '#3a2517'; x.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { x.fillStyle = '#4b3120'; x.fillRect(i * 64 + 6, 10, 52, s - 20); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 3; x.strokeRect(i * 64 + 6, 10, 52, s - 20); } noise(x, s, 3000, 0.05); }),
  ceiling: () => tex('ceiling', (x, s) => { x.fillStyle = '#e9e6de'; x.fillRect(0, 0, s, s); noise(x, s, 2000, 0.03); x.strokeStyle = 'rgba(0,0,0,.12)'; x.strokeRect(0, 0, s, s); }),
  darkwall: () => tex('darkwall', (x, s) => { x.fillStyle = '#2b2b33'; x.fillRect(0, 0, s, s); noise(x, s, 3000, 0.05); }),
};
const mats = {};
function M(name, tname, ts = 2, rough = 0.9, extra = {}) {
  const k = name; if (mats[k]) return mats[k];
  return (mats[k] = { m: new THREE.MeshStandardMaterial({ map: TEX[tname](), roughness: rough, ...extra }), ts });
}
const flat = (hex, rough = 0.8, extra = {}) => { const k = 'f' + hex + rough + JSON.stringify(extra); return mats[k] || (mats[k] = { m: new THREE.MeshStandardMaterial({ color: hex, roughness: rough, ...extra }), ts: 0 }); };
const glow = (hex, i = 1) => { const k = 'g' + hex + i; return mats[k] || (mats[k] = { m: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: i, roughness: 0.5 }), ts: 0 }); };

// ---------------------------------------------------------------- budowanie
function makeBox(R, x0, x1, y0, y1, z0, z1, mt, o = {}) {
  const [ox, oy, oz] = R.o, w = x1 - x0, h = y1 - y0, d = z1 - z0;
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, ts = mt.ts || 0;
  if (ts) { // powtarzanie tekstury wg rozmiaru sciany (kolejnosc scian BoxGeometry: +x -x +y -y +z -z)
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / ts, uv.getY(k) * dims[f][1] / ts); }
  }
  const m = new THREE.Mesh(g, mt.m); m.position.set(ox + (x0 + x1) / 2, oy + (y0 + y1) / 2, oz + (z0 + z1) / 2);
  m.castShadow = false; m.receiveShadow = false; R.group.add(m);
  if (o.collide !== false) addBox({ x0: ox + x0, x1: ox + x1, y0: oy + y0, y1: oy + y1, z0: oz + z0, z1: oz + z1 });
  return m;
}
function items(R, list, cols) { // wiele drobnych pudelek jednym rysowaniem (towary na polkach, ksiazki)
  const g = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), list.length), o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((it, i) => { o.position.set(R.o[0] + it[0], R.o[1] + it[1], R.o[2] + it[2]); o.scale.set(it[3], it[4], it[5]); o.rotation.set(0, 0, 0); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(cols[Math.floor(Math.random() * cols.length)])); });
  im.frustumCulled = false; R.group.add(im);
}
const PAL = ['#c0392b', '#f1c40f', '#2e86de', '#27ae60', '#ecf0f1', '#e67e22', '#8e44ad', '#1abc9c'];
function shelfItems(R, x0, x1, z, side, levels = [0.35, 0.9, 1.45, 2.0]) {
  const list = []; for (const y of levels) for (let x = x0; x < x1; x += 0.42) list.push([x, y + 0.15, z + side * 0.2, 0.32, 0.28 + Math.random() * 0.1, 0.24]);
  items(R, list, PAL);
}
function skyPanel(R, x0, x1, y0, y1, z, dir) { // "okno" ze swiecacym niebem o zachodzie
  const c = cv(64, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#6f86c8'); g.addColorStop(0.55, '#f0a98a'); g.addColorStop(0.85, '#f7c27a'); g.addColorStop(1, '#3a3a48'); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  const t = canvasTex(c), m = new THREE.MeshBasicMaterial({ map: t });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), m);
  p.position.set(R.o[0] + (x0 + x1) / 2, R.o[1] + (y0 + y1) / 2, R.o[2] + z); p.rotation.y = dir; R.group.add(p);
}
function shell(R, floorM, wallM, ceilM) {
  const [w, d, h] = R.sz, hw = w / 2, hd = d / 2;
  makeBox(R, -hw - T, hw + T, -1, 0, -hd - T, hd + T, floorM);                 // podloga
  makeBox(R, -hw - T, hw + T, h, h + 0.5, -hd - T, hd + T, ceilM);             // sufit
  makeBox(R, -hw - T, -hw, 0, h, -hd - T, hd + T, wallM); makeBox(R, hw, hw + T, 0, h, -hd - T, hd + T, wallM);
  makeBox(R, -hw, hw, 0, h, -hd - T, -hd, wallM); makeBox(R, -hw, hw, 0, h, hd, hd + T, wallM);
  // drzwi wyjsciowe w poludniowej scianie
  makeBox(R, -0.85, 0.85, 0, 2.6, hd - 0.14, hd, flat(0x4a3122, 0.6), { collide: false });
  makeBox(R, -0.7, 0.7, 2.75, 3.0, hd - 0.1, hd, glow(0x39ff6a, 0.9), { collide: false }); // szyld WYJSCIE
  R.exit = new V3(R.o[0], R.o[1], R.o[2] + hd - 1.3);
  R.spawn = new V3(R.o[0], R.o[1] + 0.05, R.o[2] + hd - 2.4);
}
function lamps(R, xs, zs, y) { for (const x of xs) for (const z of zs) makeBox(R, x - 0.7, x + 0.7, y - 0.06, y, z - 0.35, z + 0.35, glow(0xfff0d0, 1.6), { collide: false }); }
function npc(R, x, z, yaw, outfitKind = 'thug') {
  const H = buildThug(outfitKind); H.root.position.set(R.o[0] + x, R.o[1], R.o[2] + z); H.root.rotation.y = yaw; H.setHands('open', 'open');
  R.group.add(H.root); R.npcs.push({ H, t: rnd(0, 6), p: newPose() }); return H;
}

const BUILD = {
  shop(R) {
    const [w, d, h] = R.sz; shell(R, M('tile', 'tile', 2, 0.55), M('paint', 'paint', 3), M('ceil', 'ceiling', 3));
    lamps(R, [-5, 0, 5], [-2, 3], h);
    const wood = flat(0x6b4a30, 0.6), top = flat(0xd9c9a8, 0.4);
    makeBox(R, -5, 3, 0, 1.05, -2.6, -1.4, wood); makeBox(R, -5.1, 3.1, 1.05, 1.12, -2.7, -1.3, top);
    makeBox(R, -1, -0.2, 1.12, 1.35, -2.2, -1.7, flat(0x2b2f36, 0.5)); // kasa
    makeBox(R, -8.4, 8.4, 0, 2.7, -5.7, -5.1, flat(0x8a8f96, 0.6)); shelfItems(R, -8.2, 8.2, -5.1, 1);
    for (const [a, b] of [[-7, -2], [2, 7]]) { makeBox(R, a, b, 0, 1.9, 1.3, 1.9, flat(0x8a8f96, 0.6)); shelfItems(R, a + 0.2, b - 0.2, 1.3, -1, [0.3, 0.85, 1.4]); shelfItems(R, a + 0.2, b - 0.2, 1.9, 1, [0.3, 0.85, 1.4]); }
    makeBox(R, 7.5, 8.9, 0, 2.2, -4.5, 4.5, flat(0xdfe6ea, 0.4)); makeBox(R, 7.45, 7.52, 0.2, 2.1, -4.3, 4.3, glow(0x9fd6ff, 0.5), { collide: false }); // lodowki
    makeBox(R, -8.8, -8.2, 0, 1.0, -2, 3, flat(0x2d6a3a, 0.7));            // roslinki
    npc(R, -1.6, -3.4, 0); npc(R, 4.5, 3, -Math.PI / 2);
  },
  apt(R) {
    const [w, d, h] = R.sz; shell(R, M('wood', 'wood', 2, 0.5), M('paint', 'paint', 3), M('ceil', 'ceiling', 3));
    lamps(R, [-2, 2], [0], h);
    for (const [a, b] of [[-3.2, -1.4], [0.8, 2.6]]) { skyPanel(R, a, b, 1.0, 2.5, 0, 0); const p = R.group.children.pop(); p.position.set(R.o[0] + w / 2 - 0.02, R.o[1] + 1.75, R.o[2] + (a + b) / 2); p.rotation.y = -Math.PI / 2; R.group.add(p); }
    makeBox(R, -5.7, -3.3, 0, 0.5, -4.3, -1.9, flat(0xc7d3e0, 0.9)); makeBox(R, -5.75, -5.5, 0, 1.1, -4.3, -1.9, flat(0x5a3d28, 0.6)); // lozko
    makeBox(R, -1.6, 1.6, 0, 0.45, -2.5, -1.5, flat(0x7a3b3b, 0.9)); makeBox(R, -1.6, 1.6, 0.45, 1.0, -1.5, -1.2, flat(0x7a3b3b, 0.9)); // sofa
    makeBox(R, -0.9, 0.9, 0, 0.42, -3.5, -2.9, flat(0x6b4a30, 0.6));       // stolik
    makeBox(R, -1.3, 1.3, 0, 0.5, -4.4, -4.1, flat(0x2b2b30, 0.6)); makeBox(R, -1.1, 1.1, 0.75, 1.55, -4.42, -4.36, glow(0x6ab0ff, 0.7), { collide: false }); // tv
    makeBox(R, 4.1, 5.7, 0, 0.95, -3.5, 4, flat(0xe8e4dc, 0.5)); makeBox(R, 4.0, 5.8, 0.95, 1.02, -3.6, 4.1, flat(0x555a60, 0.4)); makeBox(R, 4.1, 5.7, 0, 2.1, -4.2, -3.5, flat(0xdfe6ea, 0.4));
    makeBox(R, -0.9, 0.9, 0, 0.78, 1.3, 2.5, flat(0x8a6540, 0.6));         // stol
    makeBox(R, -2.5, 2.5, 0, 0.02, -3.8, -0.6, flat(0x3a4a7a, 0.95), { collide: false });
    npc(R, 2.2, 0.8, 0.5);
  },
  office(R) {
    const [w, d, h] = R.sz; shell(R, M('carpet', 'carpet', 2, 0.95), M('paint', 'paint', 3), M('ceil', 'ceiling', 3));
    lamps(R, [-7, -2.5, 2.5, 7], [-4, 1], h);
    const desk = flat(0x9a7b55, 0.5), chair = flat(0x25272b, 0.8);
    for (const z of [-5, -1.8]) for (const x of [-7.5, -3.8, 0, 3.8, 7.5]) {
      makeBox(R, x - 1.1, x + 1.1, 0, 0.76, z, z + 1.0, desk); makeBox(R, x - 0.35, x + 0.35, 0.8, 1.25, z + 0.1, z + 0.16, glow(0x8fc3ff, 0.8), { collide: false });
      makeBox(R, x - 0.25, x + 0.25, 0, 0.5, z + 1.3, z + 1.8, chair, { collide: false });
    }
    makeBox(R, -6, 6, 1, 2.6, -6.92, -6.85, glow(0xf4f4f0, 0.5), { collide: false }); // tablica
    makeBox(R, 9.2, 10.4, 0, 1.6, -6.4, -5.6, flat(0x2d6a3a, 0.7)); makeBox(R, -10.4, -9.2, 0, 1.1, 5.6, 6.4, flat(0x8fb8d6, 0.5)); // roslina, dystrybutor
    npc(R, -3.8, -3.2, 0); npc(R, 3.8, 0.2, Math.PI); npc(R, 7.5, -3.2, 0);
  },
  fisk(R) {
    const [w, d, h] = R.sz, hw = w / 2, hd = d / 2; shell(R, M('marble', 'marble', 4, 0.25, { metalness: 0.1 }), M('pan', 'paneling', 4), M('dark', 'darkwall', 4));
    for (const x of [-11, 0, 11]) for (const z of [-6, 3]) makeBox(R, x - 1.4, x + 1.4, h - 0.08, h, z - 0.5, z + 0.5, glow(0xffe2b0, 1.4), { collide: false });
    for (const [x, z] of [[-12, -7], [12, -7], [-12, 5], [12, 5]]) makeBox(R, x - 0.7, x + 0.7, 0, h, z - 0.7, z + 0.7, flat(0xd9d3c8, 0.4));
    skyPanel(R, -9, 9, 2.2, 7.4, -hd + 0.03, 0);                           // panorama miasta za biurkiem
    makeBox(R, -4.2, 4.2, 0, 1.15, -11.6, -9.6, flat(0x2a1a10, 0.35));    // biurko
    makeBox(R, -4.3, 4.3, 1.15, 1.22, -11.7, -9.5, flat(0x14100c, 0.3));
    makeBox(R, -1.0, 1.0, 0, 1.6, -12.9, -12.2, flat(0x1b1b1f, 0.6), { collide: false }); // fotel
    makeBox(R, -2, 2, 0, 0.02, -12, 12, flat(0x7a1616, 0.9), { collide: false });         // czerwony dywan
    for (const x of [-9, 9]) makeBox(R, x - 1.6, x + 1.6, 0, 0.5, -3, -1.5, flat(0x1b1b1f, 0.7));
    npc(R, -13, 9.5, 0.5).root; npc(R, 13, 9.5, -0.5);
  },
};

// ---------------------------------------------------------------- wchodzenie i wychodzenie
function room(type) {
  if (ROOMS[type]) return ROOMS[type];
  const R = { type, o: ORG[type], sz: SIZE[type], group: new THREE.Group(), npcs: [], exit: null, spawn: null };
  BUILD[type](R); scene.add(R.group); ROOMS[type] = R; return R;
}
function fadeBlink() {
  const f = document.getElementById('fade'); if (!f) return;
  f.style.transition = 'none'; f.style.opacity = 1; void f.offsetWidth; f.style.transition = 'opacity .6s'; f.style.opacity = 0;
}
let seen = new Set();
export function enterDoor(d) {
  if (G.interior || P.dead) return;
  const R = room(d.type); R.group.visible = true;
  G.interior = { type: d.type, door: d, R };
  fadeBlink(); sfx('ui');
  P.pos.copy(R.spawn); P.vel.set(0, 0, 0); P.state = 'ground'; P.heading = Math.PI; P.atk = null; P.lunge = null; P.landT = 0;
  cam.yaw = 0; cam.pitch = -0.12; cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0)); cam.dist = 3.2; cam.idle = 0;
  setInteriorLight(true);
  const [t, s] = INTRO[d.type]; showMsg(t, s, 3.2);
  if (d.type !== 'fisk' && !seen.has(d)) { seen.add(d); popText('+20 PD'); import('./wrogowie.js').then(m => m.addXP(20)); }
  if (d.type === 'fisk') import('./fisk.js').then(m => m.startFisk(R));
}
export function leaveInterior(silent) {
  const I = G.interior; if (!I) return;
  G.interior = null; I.R.group.visible = false; setInteriorLight(false);
  const d = I.door;
  P.pos.set(d.gx, SW + 0.05, d.gz); P.vel.set(0, 0, 0); P.state = 'ground'; P.heading = Math.atan2(d.nx, d.nz);
  cam.yaw = Math.atan2(-d.nx, -d.nz); cam.pitch = -0.15; cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0)); cam.dist = 5.5;
  if (!silent) fadeBlink();
  import('./fisk.js').then(m => m.abortFisk());
}
export function nearExit() { const I = G.interior; return !!I && Math.hypot(P.pos.x - I.R.exit.x, P.pos.z - I.R.exit.z) < 1.9 && Math.abs(P.pos.y - I.R.exit.y) < 2; }
export function updateInterior(dt) {
  const I = G.interior; if (!I) return;
  for (const n of I.R.npcs) { n.t += dt; const p = n.p; for (const k in p) p[k] = 0; idlePose(p, n.t); applyPose(n.H, p); }
}
