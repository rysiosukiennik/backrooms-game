// Wnetrza budynkow. Pokoje sa PRAWDZIWE: wneka w bryle budynku (wycieta w miasto.js) jest w miejscu, wchodzisz
// do niej zwyklym przejsciem przez drzwi na poziomie ulicy. Meble powstaja dopiero, gdy podejdziesz blisko.
// Uklad pokoju: "u" wzdluz sciany z drzwiami (0 = srodek pokoju), "v" w glab budynku (0 = przy drzwiach).
import { V3, cv, canvasTex, rnd } from './util.js';
import { G, P, scene } from './stan.js';
import { addBox, SW, doors } from './miasto.js';
import { buildThug, newPose, applyPose, idlePose } from './postac.js';
import { showMsg, popText } from './ui.js';
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

// ---------------------------------------------------------------- tekstury i materialy
const tcache = {};
function tex(name, draw) {
  if (tcache[name]) return tcache[name];
  const c = cv(256, 256), x = c.getContext('2d'); draw(x, 256); return (tcache[name] = canvasTex(c, true));
}
const noise = (x, s, n, a) => { for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } };
const TEX = {
  wood: () => tex('wood', (x, s) => { x.fillStyle = '#8a6540'; x.fillRect(0, 0, s, s); for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(40,25,10,.25)'; x.fillRect(0, i * 32, s, 2); for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(0,0,0,.2)'; x.fillRect((i * 53 + j * 91) % s, i * 32, 2, 32); } } noise(x, s, 3000, 0.05); }),
  tile: () => tex('tile', (x, s) => { x.fillStyle = '#c9c4b8'; x.fillRect(0, 0, s, s); for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { x.fillStyle = (i + j) % 2 ? '#b9b3a4' : '#d3cec2'; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); } noise(x, s, 3000, 0.04); }),
  marble: () => tex('marble', (x, s) => { x.fillStyle = '#1c1c20'; x.fillRect(0, 0, s, s); for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) { x.fillStyle = (i + j) % 2 ? '#26262b' : '#d8d3c8'; x.fillRect(i * 128 + 2, j * 128 + 2, 124, 124); } x.strokeStyle = 'rgba(120,120,120,.25)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.moveTo(Math.random() * s, Math.random() * s); x.bezierCurveTo(Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s, Math.random() * s); x.stroke(); } }),
  carpet: () => tex('carpet', (x, s) => { x.fillStyle = '#4a5560'; x.fillRect(0, 0, s, s); noise(x, s, 9000, 0.09); }),
  rubber: () => tex('rubber', (x, s) => { x.fillStyle = '#2a2d30'; x.fillRect(0, 0, s, s); for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = 'rgba(255,255,255,.04)'; x.beginPath(); x.arc(i * 16 + 8, j * 16 + 8, 4, 0, 7); x.fill(); } noise(x, s, 2000, 0.05); }),
  paint: () => tex('paint', (x, s) => { x.fillStyle = '#d9d1c2'; x.fillRect(0, 0, s, s); noise(x, s, 4000, 0.03); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, s - 26, s, 26); x.fillStyle = '#efe9dc'; x.fillRect(0, s - 26, s, 3); }),
  brick: () => tex('brick', (x, s) => { x.fillStyle = '#6e3a2c'; x.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 16) for (let xx = (y / 16 % 2) * 16; xx < s + 32; xx += 32) { x.fillStyle = `rgba(${Math.random() > 0.5 ? '255,200,170' : '0,0,0'},.1)`; x.fillRect(xx, y, 30, 14); } noise(x, s, 3000, 0.05); }),
  paneling: () => tex('paneling', (x, s) => { x.fillStyle = '#3a2517'; x.fillRect(0, 0, s, s); for (let i = 0; i < 4; i++) { x.fillStyle = '#4b3120'; x.fillRect(i * 64 + 6, 10, 52, s - 20); x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 3; x.strokeRect(i * 64 + 6, 10, 52, s - 20); } noise(x, s, 3000, 0.05); }),
  ceiling: () => tex('ceiling', (x, s) => { x.fillStyle = '#e9e6de'; x.fillRect(0, 0, s, s); noise(x, s, 2000, 0.03); x.strokeStyle = 'rgba(0,0,0,.12)'; x.strokeRect(0, 0, s, s); }),
  darkwall: () => tex('darkwall', (x, s) => { x.fillStyle = '#2b2b33'; x.fillRect(0, 0, s, s); noise(x, s, 3000, 0.05); }),
};
const mats = {};
// materialy wnetrz lekko "swieca" wlasnym swiatlem (lampy sufitowe), wiec sa czytelne o kazdej porze dnia
function M(tname, ts = 2, rough = 0.85) {
  const k = tname + ts + rough; if (mats[k]) return mats[k];
  const t = TEX[tname]();
  return (mats[k] = { m: new THREE.MeshStandardMaterial({ map: t, roughness: rough, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.32 }), ts });
}
const flat = (hex, rough = 0.7) => { const k = 'f' + hex + rough; return mats[k] || (mats[k] = { m: new THREE.MeshStandardMaterial({ color: hex, roughness: rough, emissive: hex, emissiveIntensity: 0.3 }), ts: 0 }); };
const glow = (hex, i = 1) => { const k = 'g' + hex + i; return mats[k] || (mats[k] = { m: new THREE.MeshStandardMaterial({ color: 0x111111, emissive: hex, emissiveIntensity: i, roughness: 0.5 }), ts: 0 }); };
function skyMat() {
  if (mats.sky) return mats.sky;
  const c = cv(64, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#6f86c8'); g.addColorStop(0.55, '#f0a98a'); g.addColorStop(0.85, '#f7c27a'); g.addColorStop(1, '#3a3a48'); x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  return (mats.sky = { m: new THREE.MeshBasicMaterial({ map: canvasTex(c) }), ts: 0 });
}
const PAL = ['#c0392b', '#f1c40f', '#2e86de', '#27ae60', '#ecf0f1', '#e67e22', '#8e44ad', '#1abc9c'];

// ---------------------------------------------------------------- pokoj: narzedzia
function makeCtx(d) {
  const r = d.room, ns = d.ns, y0 = SW, g = new THREE.Group(), rm = { d, g, npcs: [], entered: false, yaw: 0 };
  const world = (u, v) => r.W(u, v);
  // skrzynka w ukladzie pokoju -> prostopadloscian osiowy w swiecie
  const box = (u0, u1, v0, v1, ya, yb, mt, collide = true) => {
    const [ax0, az0] = world(u0, v0), [ax1, az1] = world(u1, v1);
    const x0 = Math.min(ax0, ax1), x1 = Math.max(ax0, ax1), z0 = Math.min(az0, az1), z1 = Math.max(az0, az1), w = x1 - x0, h = yb - ya, dp = z1 - z0;
    const geo = new THREE.BoxGeometry(w, h, dp), uv = geo.attributes.uv, ts = mt.ts || 0;
    if (ts) { const dims = [[dp, h], [dp, h], [w, dp], [w, dp], [w, h], [w, h]]; for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / ts, uv.getY(k) * dims[f][1] / ts); } }
    const m = new THREE.Mesh(geo, mt.m); m.position.set((x0 + x1) / 2, y0 + (ya + yb) / 2, (z0 + z1) / 2); g.add(m);
    if (collide) addBox({ x0, x1, y0: y0 + ya, y1: y0 + yb, z0, z1 });
    return m;
  };
  const inst = (list, cols) => { // wiele drobnych pudelek jednym rysowaniem
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, emissive: 0x222222 }), list.length), o = new THREE.Object3D(), c = new THREE.Color();
    list.forEach((it, i) => { const [x, z] = world(it[0], it[2]); o.position.set(x, y0 + it[1], z); o.scale.set(ns ? it[3] : it[5], it[4], ns ? it[5] : it[3]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, c.set(cols[Math.floor(Math.random() * cols.length)])); });
    im.frustumCulled = false; g.add(im);
  };
  const npc = (u, v, fu = 0, fv = -1, kind = 'thug') => { // fu,fv: w ktora strone patrzy (domyslnie na drzwi)
    const H = buildThug(kind), [x, z] = world(u, v), dx = ns ? fu : r.sIn * fv, dz = ns ? r.sIn * fv : fu;
    H.root.position.set(x, y0, z); H.root.rotation.y = Math.atan2(dx, dz); H.setHands('open', 'open'); g.add(H.root);
    rm.npcs.push({ H, t: rnd(0, 6), p: newPose() }); return H;
  };
  return { r, ns, rm, box, inst, npc, world, hw: r.cw / 2, cd: r.cd, ch: r.ch };
}
function shell(c, floorM, wallM, ceilM, backM) {
  const { box, hw, cd, ch, r } = c, e = 0.05;
  box(-hw, hw, 0, cd, -0.06, 0.004, floorM, false);                  // podloga
  box(-hw, hw, 0, cd, ch - e, ch, ceilM, false);                     // sufit
  box(-hw, hw, cd - e, cd, 0, ch, backM || wallM, false);            // sciana tylna
  box(-hw, -hw + e, 0, cd, 0, ch, wallM, false); box(hw - e, hw, 0, cd, 0, ch, wallM, false); // boczne
  // sciana frontowa od srodka: z otworem na drzwi
  const door = c.rm.d, du = door.c - r.uc, g0 = du - door.gw / 2, g1 = du + door.gw / 2, gh = door.gh - SW;
  box(-hw, g0, 0, e, 0, ch, wallM, false); box(g1, hw, 0, e, 0, ch, wallM, false); box(g0, g1, 0, e, gh, ch, wallM, false);
}
function lamps(c, us, vs) { for (const u of us) for (const v of vs) c.box(u - 0.7, u + 0.7, v - 0.35, v + 0.35, c.ch - 0.1, c.ch - 0.05, glow(0xfff0d0, 1.5), false); }
const shelfItems = (c, u0, u1, v, side, levels = [0.35, 0.9, 1.45, 2.0]) => { const list = []; for (const y of levels) for (let u = u0; u < u1; u += 0.42) list.push([u, y + 0.15, v + side * 0.2, 0.32, 0.28 + Math.random() * 0.1, 0.24]); c.inst(list, PAL); };

// ---------------------------------------------------------------- szablony pokoi
const BUILD = {
  shop(c) {
    const { box, hw, cd, ch } = c; shell(c, M('tile', 2, 0.55), M('paint', 3), M('ceiling', 3));
    lamps(c, [-hw * 0.5, 0, hw * 0.5], [cd * 0.3, cd * 0.7]);
    const wood = flat(0x6b4a30, 0.6), cm = cd * 0.58;
    box(-4, 4, cm - 0.6, cm + 0.6, 0, 1.05, wood); box(-4.1, 4.1, cm - 0.7, cm + 0.7, 1.05, 1.12, flat(0xd9c9a8, 0.4)); box(-1, -0.2, cm - 0.2, cm + 0.3, 1.12, 1.35, flat(0x2b2f36, 0.5));
    box(-hw + 0.5, hw - 0.5, cd - 0.65, cd - 0.15, 0, 2.7, flat(0x8a8f96, 0.6)); shelfItems(c, -hw + 0.7, hw - 0.7, cd - 0.65, -1);
    box(-hw + 0.4, -hw + 0.95, 1.5, cd - 2, 0, 2.2, flat(0x8a8f96, 0.6)); shelfItems(c, 1.7, cd - 2.2, -hw + 0.95, 1);
    for (const a of [-hw + 2.8, hw - 4.6]) { box(a, a + 1.9, cd * 0.3, cd * 0.3 + 0.6, 0, 1.8, flat(0x8a8f96, 0.6)); shelfItems(c, a + 0.2, a + 1.7, cd * 0.3, -1, [0.3, 0.85, 1.4]); }
    box(hw - 1.4, hw - 0.4, 1.5, cd - 2, 0, 2.2, flat(0xdfe6ea, 0.4)); box(hw - 1.45, hw - 1.4, 1.7, cd - 2.2, 0.2, 2.1, glow(0x9fd6ff, 0.5), false); // lodowki
    c.npc(0, cm + 1.4); c.npc(hw * 0.4, 3, -1, 0.3);
  },
  cafe(c) {
    const { box, hw, cd, ch } = c; shell(c, M('wood', 2, 0.5), M('brick', 3), M('ceiling', 3), M('brick', 3));
    lamps(c, [-hw * 0.5, hw * 0.5], [cd * 0.3, cd * 0.65]);
    const wood = flat(0x5b3f28, 0.55), top = flat(0xe3d7c0, 0.4), cm = cd - 1.9;
    box(-hw + 1.5, hw - 1.5, cm - 0.5, cm + 0.5, 0, 1.1, wood); box(-hw + 1.4, hw - 1.4, cm - 0.6, cm + 0.6, 1.1, 1.17, top);
    box(-hw + 2.2, -hw + 3.4, cm - 0.3, cm + 0.2, 1.17, 1.65, flat(0xb8bcc2, 0.3)); box(2, 2.6, cm - 0.2, cm + 0.2, 1.17, 1.4, flat(0xb8bcc2, 0.3));  // ekspres, kasa
    box(-3, 3, cd - 0.2, cd - 0.15, 1.5, 2.8, glow(0xf4f0e0, 0.5), false);                                                                    // tablica z menu
    for (const [u, v] of [[-4, 2.5], [0, 3.2], [4, 2.5], [-4.5, 5.5], [4.5, 5.5]]) { box(u - 0.45, u + 0.45, v - 0.45, v + 0.45, 0, 0.75, wood); box(u - 0.55, u + 0.55, v - 0.55, v + 0.55, 0.75, 0.8, top); for (const du of [-0.9, 0.9]) box(u + du - 0.2, u + du + 0.2, v - 0.2, v + 0.2, 0, 0.45, flat(0x2b2b30, 0.7)); }
    box(-hw + 0.1, -hw + 0.6, 1.2, 2.2, 0, 1.4, flat(0x2d6a3a, 0.7));
    c.npc(0, cm + 1.1); c.npc(0.9, 3.2, -0.7, -0.7); c.npc(-4.9, 5.5, 0.7, 0);
  },
  bar(c) {
    const { box, hw, cd, ch } = c; shell(c, M('wood', 2, 0.4), M('darkwall', 3), M('darkwall', 3));
    lamps(c, [-hw * 0.5, hw * 0.5], [cd * 0.4]);
    const wood = flat(0x2a1a10, 0.35), bm = cd * 0.6;
    box(-hw + 1.5, hw - 1.5, bm - 0.5, bm + 0.5, 0, 1.1, wood); box(-hw + 1.4, hw - 1.4, bm - 0.6, bm + 0.6, 1.1, 1.18, flat(0x14100c, 0.3));
    for (let u = -hw + 2.2; u < hw - 2; u += 1.5) box(u - 0.22, u + 0.22, bm - 1.5, bm - 1.0, 0, 0.75, flat(0x7a1616, 0.6)); // stołki
    box(-hw + 0.8, hw - 0.8, cd - 0.55, cd - 0.15, 0.9, 2.5, flat(0x1a1a1f, 0.5)); const bots = []; for (const y of [1.1, 1.6, 2.1]) for (let u = -hw + 1; u < hw - 1; u += 0.35) bots.push([u, y, cd - 0.5, 0.14, 0.32, 0.14]); c.inst(bots, ['#2ecc71', '#e67e22', '#f1c40f', '#c0392b', '#ecf0f1']);
    box(-2.5, 2.5, cd - 0.15, cd - 0.1, 2.6, 3.3, glow(0xff3bb0, 1.5), false);                              // neon
    for (const [u, v] of [[-hw * 0.6, 2.2], [hw * 0.6, 2.2]]) { box(u - 0.5, u + 0.5, v - 0.5, v + 0.5, 0, 0.78, flat(0x4a3322, 0.5)); }
    c.npc(0, bm + 1.2); c.npc(-hw * 0.6 + 1, 2.2, -1, 0);
  },
  apt(c) {
    const { box, hw, cd, ch } = c; shell(c, M('wood', 2, 0.5), M('paint', 3), M('ceiling', 3));
    lamps(c, [0], [cd * 0.5]);
    for (const [a, b] of [[1.0, 2.6], [3.6, 5.4]]) if (b < cd - 0.5) box(hw - 0.1, hw - 0.05, a, b, 1.0, 2.4, skyMat(), false);   // okna z zachodem slonca
    box(-1.7, 1.7, cd - 1.4, cd - 0.9, 0, 0.45, flat(0x7a3b3b, 0.9)); box(-1.7, 1.7, cd - 0.9, cd - 0.6, 0.45, 1.0, flat(0x7a3b3b, 0.9)); // sofa przy tylnej scianie, front do drzwi
    box(-1, 1, cd - 2.8, cd - 2.1, 0, 0.42, flat(0x6b4a30, 0.6));                                            // stolik
    box(-1.4, 1.4, 0.6, 0.9, 0, 0.5, flat(0x2b2b30, 0.6)); box(-1.15, 1.15, 0.62, 0.66, 0.75, 1.55, glow(0x6ab0ff, 0.7), false); // tv przy drzwiach
    box(-hw + 0.1, -hw + 1.7, 1.2, cd - 0.4, 0, 0.95, flat(0xe8e4dc, 0.5)); box(-hw + 0.05, -hw + 1.8, 1.2, cd - 0.4, 0.95, 1.02, flat(0x555a60, 0.4));
    box(-2.5, 2.5, 1.2, cd - 1, 0, 0.02, flat(0x3a4a7a, 0.95), false);                                       // dywan
    c.npc(-hw + 2.8, cd * 0.5, 0.7, -0.5);
  },
  office(c) {
    const { box, hw, cd, ch } = c; shell(c, M('carpet', 2, 0.95), M('paint', 3), M('ceiling', 3));
    lamps(c, [-hw * 0.6, 0, hw * 0.6], [cd * 0.3, cd * 0.7]);
    const desk = flat(0x9a7b55, 0.5), chair = flat(0x25272b, 0.8);
    for (const v of [3, 6.2]) for (const u of [-hw * 0.65, 0, hw * 0.65]) {
      box(u - 1.1, u + 1.1, v, v + 1.0, 0, 0.76, desk); box(u - 0.35, u + 0.35, v + 0.4, v + 0.46, 0.8, 1.25, glow(0x8fc3ff, 0.8), false);
      box(u - 0.25, u + 0.25, v - 0.7, v - 0.2, 0, 0.5, chair, false);
    }
    box(-5, 5, cd - 0.1, cd - 0.05, 1, 2.6, glow(0xf4f4f0, 0.5), false);                                    // tablica
    box(hw - 1.2, hw - 0.4, cd - 1.2, cd - 0.4, 0, 1.6, flat(0x2d6a3a, 0.7)); box(-hw + 0.4, -hw + 1.2, cd - 1.2, cd - 0.4, 0, 1.1, flat(0x8fb8d6, 0.5));
    box(-hw + 0.5, -hw + 2, 1.5, 2.6, 0, 1.1, flat(0xcfd3d8, 0.5));                                         // kserokopiarka
    c.npc(-hw * 0.65, 2.4, 0, 1); c.npc(hw * 0.65, 5.6, 0, 1); c.npc(0, 3.4, 0.3, -1);
  },
  gym(c) {
    const { box, hw, cd, ch } = c; shell(c, M('rubber', 2, 0.8), M('paint', 3), M('darkwall', 3));
    lamps(c, [-hw * 0.5, hw * 0.5], [cd * 0.3, cd * 0.7]);
    box(-hw + 0.6, hw - 0.6, cd - 0.12, cd - 0.05, 0.4, 2.8, glow(0xcfe8ff, 0.7), false);                    // lustro na tylnej scianie
    for (let i = 0; i < 3; i++) { const u = -hw + 2.2 + i * 2.6; box(u - 0.4, u + 0.4, cd - 3.2, cd - 1.6, 0, 1.0, flat(0x2b2f36, 0.5)); box(u - 0.3, u + 0.3, cd - 1.8, cd - 1.7, 1.0, 1.7, glow(0x6ab0ff, 0.6), false); } // bieznie
    box(hw - 3.4, hw - 1.4, 3.5, 4.3, 0, 0.5, flat(0x2b2b30, 0.6)); box(hw - 3.6, hw - 1.2, 3.55, 4.25, 1.2, 1.35, flat(0x9aa0a6, 0.3));        // lawka ze sztanga
    box(-hw + 0.4, -hw + 1.0, 2, cd - 4.2, 0, 1.2, flat(0x1a1a1f, 0.5)); const w = []; for (let v = 2.2; v < cd - 4.4; v += 0.5) w.push([-hw + 0.7, 1.25, v, 0.28, 0.28, 0.28]); c.inst(w, ['#333', '#555', '#c0392b']);
    box(2.5, 3.4, 2.0, 2.9, 0.6, 1.9, flat(0x8b2a2a, 0.6), false);                                          // worek
    c.npc(2, 4.6, 0, -1);
  },
  fisk(c) {
    const { box, hw, cd, ch } = c; shell(c, M('marble', 4, 0.25), M('paneling', 4), M('darkwall', 4));
    for (const u of [-hw * 0.5, 0, hw * 0.5]) for (const v of [cd * 0.35, cd * 0.7]) box(u - 1.4, u + 1.4, v - 0.5, v + 0.5, ch - 0.14, ch - 0.06, glow(0xffe2b0, 1.4), false);
    for (const [u, v] of [[-hw + 2.5, cd * 0.3], [hw - 2.5, cd * 0.3], [-hw + 2.5, cd * 0.62], [hw - 2.5, cd * 0.62]]) box(u - 0.7, u + 0.7, v - 0.7, v + 0.7, 0, ch, flat(0xd9d3c8, 0.4));
    box(-hw + 2, hw - 2, cd - 0.15, cd - 0.1, 2.2, 6.6, skyMat(), false);                                    // panorama miasta za biurkiem
    box(-4.2, 4.2, cd - 3.6, cd - 1.6, 0, 1.15, flat(0x2a1a10, 0.35)); box(-4.3, 4.3, cd - 3.7, cd - 1.5, 1.15, 1.22, flat(0x14100c, 0.3));
    box(-1, 1, cd - 1.2, cd - 0.5, 0, 1.6, flat(0x1b1b1f, 0.6), false);
    box(-2, 2, 0.5, cd - 0.5, 0, 0.02, flat(0x7a1616, 0.9), false);                                          // czerwony dywan
    for (const u of [-hw + 2, hw - 2]) box(u - 1.6, u + 1.6, cd * 0.45, cd * 0.45 + 1.2, 0, 0.5, flat(0x1b1b1f, 0.7));
  },
};

// ---------------------------------------------------------------- zarzadzanie
function buildRoom(d) {
  const c = makeCtx(d); BUILD[d.type](c); d.rm = c.rm; scene.add(c.rm.g);
  return c.rm;
}
export const playerInRoom = (d, m = 0) => { const r = d.room; return P.pos.x > r.bx0 - m && P.pos.x < r.bx1 + m && P.pos.z > r.bz0 - m && P.pos.z < r.bz1 + m && P.pos.y > -1 && P.pos.y < SW + r.ch + 0.6; };
let acc = 0, wasInFisk = false;
export function updateRooms(dt) {
  acc += dt;
  const near = (d) => Math.hypot(P.pos.x - d.x, P.pos.z - d.z);
  if (acc > 0.3) { // budowanie i ukrywanie co chwile, nie co klatke
    acc = 0; let built = 0;
    for (const d of doors) {
      const dist = near(d);
      if (!d.rm && dist < 55 && P.pos.y < 40 && built < 1) { buildRoom(d); built++; }
      if (d.rm) d.rm.g.visible = dist < 110;
    }
  }
  for (const d of doors) {
    if (!d.rm || !d.rm.g.visible) continue;
    if (Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 32) { for (const n of d.rm.npcs) { n.t += dt; for (const k in n.p) n.p[k] = 0; idlePose(n.p, n.t); applyPose(n.H, n.p); } }
    const inside = playerInRoom(d, 0);
    if (inside && !d.rm.entered) { d.rm.entered = true; const [t, s] = INTRO[d.type]; showMsg(t, s, 3.2); if (d.type !== 'fisk') { popText('+20 PD'); import('./wrogowie.js').then(m => m.addXP(20)); } }
  }
  const fd = doors.find(d => d.type === 'fisk');
  if (fd && fd.rm) { const inF = playerInRoom(fd, -0.5); if (inF && !wasInFisk && !G.cine && !P.dead) startFisk(fd); wasInFisk = inF; }
}
// zachowane dla zgodnosci z reszta kodu (dawne teleportowane wnetrza)
export const enterDoor = () => {}, leaveInterior = () => {}, nearExit = () => false, updateInterior = () => {};
