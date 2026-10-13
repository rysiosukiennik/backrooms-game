// Efekty wizualne: czasteczki (kurz, dym, para, iskry, szklo, krople, liscie), fale uderzeniowe, ploty i plamy sieci,
// liny sieci z wlokienkami, slady po kulach. Wszystko z pul obiektow — w petli klatki zero alokacji.
import { V3, rnd, clamp, cv, canvasTex } from './util.js';
import { G, P, scene, camera, renderer } from './stan.js';
import { supportAt, solidAt, raycastCity, rayN } from './miasto.js';

const _c = new THREE.Color();
const _a = new V3(), _b = new V3(), _d = new V3(), _p1 = new V3(), _p2 = new V3(), _q = new V3();
const col = [1, 1, 1];
// kolor "jak na ekranie" (sRGB) -> liniowy
function lin(hex, k = 1) { _c.setHex(hex).convertSRGBToLinear(); col[0] = _c.r * k; col[1] = _c.g * k; col[2] = _c.b * k; return col; }
let T = 0; // czas efektow
const wind = { x: 2, z: 1 };

// ---------------------------------------------------------------- uklad czasteczek (Points z wlasnym shaderem)
const VS = `attribute vec4 aCol; attribute float aSize; attribute float aSeed; uniform float uScale; varying vec4 vC; varying float vS;
void main(){ vC = aCol; vS = aSeed; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = min(aSize * uScale / max(-mv.z, 0.1), 320.0); if (aCol.a <= 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }`;
const FS = `uniform float uNoise; varying vec4 vC; varying float vS;
void main(){ vec2 q = gl_PointCoord - 0.5; float cs = cos(vS * 6.283), sn = sin(vS * 6.283); q = mat2(cs, -sn, sn, cs) * q;
  float d = length(q) * 2.0;
  float n = (sin(q.x * 11.0 + vS * 20.0) * sin(q.y * 9.0 + vS * 13.0) + sin(q.x * 23.0 + q.y * 17.0 + vS * 5.0) * 0.5) * 0.11 * uNoise;
  float a = smoothstep(1.0, 0.2, d + n);
  gl_FragColor = vec4(vC.rgb, vC.a * a);
  #include <encodings_fragment>
}`;

class PSys {
  constructor(N, additive, noise, pw) {
    this.N = N; this.i = 0; this.pw = pw; this.alive = 0; this.dirty = false;
    const f = n => new Float32Array(n);
    this.pos = f(N * 3); this.col = f(N * 4); this.size = f(N); this.seed = f(N);
    this.vx = f(N); this.vy = f(N); this.vz = f(N); this.age = f(N); this.life = f(N);
    this.s0 = f(N); this.s1 = f(N); this.cr = f(N); this.cg = f(N); this.cb = f(N); this.ca = f(N);
    this.grav = f(N); this.drag = f(N); this.fl = f(N); this.ph = f(N); this.fy = f(N); this.fm = new Uint8Array(N);
    for (let k = 0; k < N; k++) { this.age[k] = 1; this.life[k] = 1; this.seed[k] = Math.random(); this.pos[k * 3 + 1] = -9999; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSeed', new THREE.BufferAttribute(this.seed, 1));
    this.uni = { uScale: { value: 800 }, uNoise: { value: noise } };
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: this.uni, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.pts = new THREE.Points(g, m); this.pts.frustumCulled = false; this.pts.renderOrder = additive ? 6 : 5; scene.add(this.pts);
    this.geo = g;
  }
  // fm: 0 bez podlogi, 1 lezy na podlodze, 2 ginie na podlodze, 3 odbija sie
  e(x, y, z, vx, vy, vz, life, s0, s1, c, a, grav, drag, fl = 0, fy = -1e4, fm = 0) {
    const k = this.i; this.i = (k + 1) % this.N;
    if (this.age[k] >= this.life[k]) this.alive++;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vx[k] = vx; this.vy[k] = vy; this.vz[k] = vz; this.age[k] = 0; this.life[k] = life;
    this.s0[k] = s0; this.s1[k] = s1; this.cr[k] = c[0]; this.cg[k] = c[1]; this.cb[k] = c[2]; this.ca[k] = a;
    this.grav[k] = grav; this.drag[k] = drag; this.fl[k] = fl; this.ph[k] = Math.random() * 6.28; this.fy[k] = fy; this.fm[k] = fm;
    this.dirty = true;
  }
  update(dt) {
    if (this.alive <= 0 && !this.dirty) return;
    this.uni.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
    const N = this.N, pos = this.pos, col = this.col, pw = this.pw;
    let alive = 0;
    for (let k = 0; k < N; k++) {
      if (this.age[k] >= this.life[k]) continue;
      this.age[k] += dt;
      if (this.age[k] >= this.life[k]) { col[k * 4 + 3] = 0; pos[k * 3 + 1] = -9999; continue; }
      alive++;
      let vx = this.vx[k], vy = this.vy[k], vz = this.vz[k];
      const fl = this.fl[k];
      if (fl > 0) { // lekkie przedmioty niesione wiatrem i trzepoczace
        const ph = this.ph[k];
        vx += (wind.x - vx) * 1.4 * dt + Math.sin(T * 3.1 + ph) * fl * dt;
        vz += (wind.z - vz) * 1.4 * dt + Math.cos(T * 2.7 + ph * 1.3) * fl * dt;
        vy += Math.sin(T * 4.3 + ph) * fl * 0.5 * dt;
      }
      vy -= this.grav[k] * dt;
      const dr = Math.max(0, 1 - this.drag[k] * dt); vx *= dr; vy *= dr; vz *= dr;
      let x = pos[k * 3] + vx * dt, y = pos[k * 3 + 1] + vy * dt, z = pos[k * 3 + 2] + vz * dt;
      if (y < this.fy[k] && this.fm[k]) {
        const m = this.fm[k];
        if (m === 2) { this.age[k] = this.life[k]; col[k * 4 + 3] = 0; pos[k * 3 + 1] = -9999; alive--; continue; }
        y = this.fy[k];
        if (m === 3) { vy = -vy * 0.3; vx *= 0.6; vz *= 0.6; } else { vx = vy = vz = 0; this.fl[k] = 0; this.drag[k] = 0; this.grav[k] = 0; }
      }
      this.vx[k] = vx; this.vy[k] = vy; this.vz[k] = vz;
      pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z;
      const t = this.age[k] / this.life[k], fo = 1 - t;
      let a = this.ca[k] * Math.min(1, t * 14) * (pw === 2 ? fo * fo : fo);
      if (fl > 0 || (this.fm[k] === 1 && vx === 0)) a *= Math.min(1, fo * 5); // lisc/papier gasnie na koncu zycia
      col[k * 4] = this.cr[k]; col[k * 4 + 1] = this.cg[k]; col[k * 4 + 2] = this.cb[k]; col[k * 4 + 3] = a;
      this.size[k] = this.s0[k] + (this.s1[k] - this.s0[k]) * Math.sqrt(t);
    }
    this.alive = alive; this.dirty = alive > 0;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- iskry i odlamki (kreski z ogonem)
class Sparks {
  constructor(N) {
    this.N = N; this.i = 0; this.alive = 0; this.dirty = false;
    this.pos = new Float32Array(N * 6); this.colr = new Float32Array(N * 6);
    this.vel = new Float32Array(N * 3); this.age = new Float32Array(N).fill(1); this.life = new Float32Array(N).fill(1);
    this.c = new Float32Array(N * 3); this.tail = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N); this.fy = new Float32Array(N);
    for (let k = 0; k < N; k++) { this.pos[k * 6 + 1] = this.pos[k * 6 + 4] = -9999; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.colr, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    this.obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.obj.frustumCulled = false; this.obj.renderOrder = 7; scene.add(this.obj);
  }
  e(x, y, z, vx, vy, vz, life, c, tail, grav, drag, fy = 0) {
    const k = this.i; this.i = (k + 1) % this.N;
    if (this.age[k] >= this.life[k]) this.alive++;
    this.pos[k * 6] = this.pos[k * 6 + 3] = x; this.pos[k * 6 + 1] = this.pos[k * 6 + 4] = y; this.pos[k * 6 + 2] = this.pos[k * 6 + 5] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz; this.age[k] = 0; this.life[k] = life;
    this.c[k * 3] = c[0]; this.c[k * 3 + 1] = c[1]; this.c[k * 3 + 2] = c[2]; this.tail[k] = tail; this.grav[k] = grav; this.drag[k] = drag; this.fy[k] = fy;
    this.dirty = true;
  }
  update(dt) {
    if (this.alive <= 0 && !this.dirty) return;
    const pos = this.pos, cl = this.colr, vel = this.vel; let alive = 0;
    for (let k = 0; k < this.N; k++) {
      if (this.age[k] >= this.life[k]) continue;
      this.age[k] += dt;
      if (this.age[k] >= this.life[k]) { pos[k * 6 + 1] = pos[k * 6 + 4] = -9999; cl[k * 6] = cl[k * 6 + 1] = cl[k * 6 + 2] = cl[k * 6 + 3] = cl[k * 6 + 4] = cl[k * 6 + 5] = 0; continue; }
      alive++;
      let vx = vel[k * 3], vy = vel[k * 3 + 1], vz = vel[k * 3 + 2];
      vy -= this.grav[k] * dt; const dr = Math.max(0, 1 - this.drag[k] * dt); vx *= dr; vy *= dr; vz *= dr;
      let x = pos[k * 6] + vx * dt, y = pos[k * 6 + 1] + vy * dt, z = pos[k * 6 + 2] + vz * dt;
      if (y < this.fy[k] && vy < 0) { y = this.fy[k]; vy = -vy * 0.4; vx *= 0.7; vz *= 0.7; }
      vel[k * 3] = vx; vel[k * 3 + 1] = vy; vel[k * 3 + 2] = vz;
      const tl = this.tail[k];
      pos[k * 6] = x; pos[k * 6 + 1] = y; pos[k * 6 + 2] = z;
      pos[k * 6 + 3] = x - vx * tl; pos[k * 6 + 4] = y - vy * tl; pos[k * 6 + 5] = z - vz * tl;
      const f = 1 - this.age[k] / this.life[k], br = f * f;
      cl[k * 6] = this.c[k * 3] * br; cl[k * 6 + 1] = this.c[k * 3 + 1] * br; cl[k * 6 + 2] = this.c[k * 3 + 2] * br;
      cl[k * 6 + 3] = cl[k * 6 + 4] = cl[k * 6 + 5] = 0;
    }
    this.alive = alive; this.dirty = alive > 0;
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- fale uderzeniowe (pierscienie)
const rings = []; let ringTex = null;
function ringTexture() {
  const c = cv(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0)'); g.addColorStop(0.86, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.94, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return canvasTex(c);
}
function ring(x, y, z, r1, dur, c, a, flat, nx = 0, ny = 1, nz = 0) {
  let r = null;
  for (const q of rings) if (!q.m.visible) { r = q; break; }
  if (!r) return;
  r.t = 0; r.dur = dur; r.r1 = r1; r.a = a; r.flat = flat;
  r.m.material.color.setRGB(c[0], c[1], c[2]); r.m.position.set(x, y, z); r.m.visible = true;
  if (flat) { r.m.quaternion.setFromUnitVectors(_q.set(0, 0, 1), _d.set(nx, ny, nz).normalize()); }
}
function updateRings(dt) {
  for (const r of rings) {
    if (!r.m.visible) continue;
    r.t += dt; const t = r.t / r.dur;
    if (t >= 1) { r.m.visible = false; continue; }
    const e = 1 - (1 - t) * (1 - t), s = Math.max(0.05, r.r1 * 2 * e);
    r.m.scale.set(s, s, 1); r.m.material.opacity = r.a * (1 - t) * (1 - t);
    if (!r.flat) r.m.quaternion.copy(camera.quaternion);
  }
}

// ---------------------------------------------------------------- plamy sieci, slady po kulach, pekniecia (decale z pul)
const decals = { web: [], hole: [], crack: [] }; const dIdx = { web: 0, hole: 0, crack: 0 };
const decalTex = {};
function webSplatTexture() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), m = S / 2;
  const K = 9 + (Math.random() * 3 | 0), ang = [], len = [];
  for (let i = 0; i < K; i++) { ang.push(i / K * 6.283 + (Math.random() - 0.5) * 0.35); len.push(78 + Math.random() * 44); }
  const draw = (style, lw, off) => {
    x.strokeStyle = style; x.lineCap = 'round';
    for (let i = 0; i < K; i++) { // promienie z lekkim wygieciem
      const a = ang[i], bend = (Math.random() - 0.5) * 0.18;
      x.lineWidth = lw * (0.8 + Math.random() * 0.5); x.beginPath(); x.moveTo(m + off, m + off);
      x.quadraticCurveTo(m + off + Math.cos(a + bend) * len[i] * 0.55, m + off + Math.sin(a + bend) * len[i] * 0.55, m + off + Math.cos(a) * len[i], m + off + Math.sin(a) * len[i]); x.stroke();
    }
    for (const r of [20, 38, 58, 80, 102]) { // lukowe oczka miedzy promieniami (zwisaja ku srodkowi)
      x.lineWidth = lw * 0.7;
      for (let i = 0; i < K; i++) {
        const j = (i + 1) % K, a0 = ang[i], a1 = ang[j] + (j === 0 ? 6.283 : 0);
        if (r > len[i] * 0.97 || r > len[j] * 0.97) continue;
        const am = (a0 + a1) / 2, rr = r * (0.8 + Math.random() * 0.06);
        x.beginPath(); x.moveTo(m + off + Math.cos(a0) * r, m + off + Math.sin(a0) * r);
        x.quadraticCurveTo(m + off + Math.cos(am) * rr, m + off + Math.sin(am) * rr, m + off + Math.cos(a1) * r, m + off + Math.sin(a1) * r); x.stroke();
      }
    }
  };
  draw('rgba(0,0,0,0.3)', 4.2, 2); // delikatny cien pod siecia, zeby bylo widac na jasnej scianie
  draw('rgba(244,246,250,0.96)', 2.1, 0);
  const g = x.createRadialGradient(m, m, 0, m, m, 17); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(250,250,252,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, 17, 0, 7); x.fill();
  for (let i = 0; i < 9; i++) { const a = Math.random() * 6.283, r = 25 + Math.random() * 60; x.fillStyle = 'rgba(250,250,252,0.85)'; x.beginPath(); x.arc(m + Math.cos(a) * r, m + Math.sin(a) * r, 1.2 + Math.random() * 2.2, 0, 7); x.fill(); }
  return canvasTex(c);
}
function holeTexture() {
  const S = 64, c = cv(S, S), x = c.getContext('2d'), m = S / 2;
  let g = x.createRadialGradient(m, m, 0, m, m, 30); g.addColorStop(0, 'rgba(10,8,6,0.55)'); g.addColorStop(0.5, 'rgba(25,20,15,0.25)'); g.addColorStop(1, 'rgba(25,20,15,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(30,26,22,0.6)'; x.lineWidth = 1;
  for (let i = 0; i < 7; i++) { const a = Math.random() * 6.283, l = 8 + Math.random() * 18; x.beginPath(); x.moveTo(m + Math.cos(a) * 3, m + Math.sin(a) * 3); x.lineTo(m + Math.cos(a + 0.1) * l * 0.6, m + Math.sin(a + 0.1) * l * 0.6); x.lineTo(m + Math.cos(a - 0.05) * l, m + Math.sin(a - 0.05) * l); x.stroke(); }
  g = x.createRadialGradient(m, m, 0, m, m, 4.5); g.addColorStop(0, 'rgba(0,0,0,0.97)'); g.addColorStop(1, 'rgba(0,0,0,0.8)');
  x.fillStyle = g; x.beginPath(); x.arc(m, m, 4, 0, 7); x.fill();
  return canvasTex(c);
}
function crackTexture() {
  const S = 256, c = cv(S, S), x = c.getContext('2d'), m = S / 2;
  const g = x.createRadialGradient(m, m, 0, m, m, 120); g.addColorStop(0, 'rgba(15,12,10,0.5)'); g.addColorStop(1, 'rgba(15,12,10,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  x.strokeStyle = 'rgba(12,10,8,0.8)'; x.lineCap = 'round';
  const branch = (px, py, a, l, w) => {
    if (l < 8 || w < 0.4) return;
    x.lineWidth = w; x.beginPath(); x.moveTo(px, py);
    let cx = px, cy = py, ca = a;
    for (let s = 0; s < 4; s++) { ca += (Math.random() - 0.5) * 0.7; cx += Math.cos(ca) * l / 4; cy += Math.sin(ca) * l / 4; x.lineTo(cx, cy); }
    x.stroke();
    if (Math.random() < 0.8) branch(cx, cy, ca + (Math.random() - 0.5) * 1.4, l * 0.55, w * 0.6);
    if (Math.random() < 0.5) branch(px + (cx - px) * 0.5, py + (cy - py) * 0.5, ca + (Math.random() < 0.5 ? 1 : -1) * 0.8, l * 0.5, w * 0.55);
  };
  for (let i = 0; i < 9; i++) branch(m, m, i / 9 * 6.283 + Math.random() * 0.4, 70 + Math.random() * 45, 3);
  return canvasTex(c);
}
function decal(kind, p, n, size, spin = true) {
  const list = decals[kind]; let d;
  const cap = kind === 'web' ? 24 : kind === 'hole' ? 48 : 8;
  if (list.length < cap) {
    const tex = kind === 'web' ? pickWebTex() : decalTex[kind];
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.frustumCulled = true; scene.add(m);
    d = { m, t: 0, life: 1 }; list.push(d);
  } else { d = list[dIdx[kind] % cap]; dIdx[kind]++; }
  d.t = 0; d.life = kind === 'web' ? 30 : kind === 'hole' ? 40 : 25; d.m.visible = true; d.m.material.opacity = 1;
  d.m.position.copy(p).addScaledVector(n, 0.02 + Math.random() * 0.008);
  d.m.lookAt(_a.copy(p).add(n)); if (spin) d.m.rotateZ(Math.random() * 6.28);
  d.m.scale.set(size, size, 1);
}
function updateDecals(dt) {
  for (const k in decals) for (const d of decals[k]) {
    if (!d.m.visible) continue;
    d.t += dt; const r = d.life - d.t;
    if (r <= 0) d.m.visible = false; else if (r < 4) d.m.material.opacity = r / 4;
  }
}
// plama sieci z promienistymi nitkami (trafienie w sciane/ziemie)
export function webSplat(p, n, size = 1.9) {
  decal('web', p, n, size * (0.85 + Math.random() * 0.3));
  _a.set(0, 0, 0);
  for (let i = 0; i < 6; i++) { // drobne krople sieci rozbryzgane po sciance
    _p1.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).addScaledVector(n, -_p1.dot(n)).normalize().multiplyScalar(rnd(0.6, 2.2));
    ps.e(p.x, p.y, p.z, _p1.x + n.x * 1.2, _p1.y + n.y * 1.2, _p1.z + n.z * 1.2, rnd(0.25, 0.5), 0.1, 0.04, lin(0xffffff, 1.2), 0.8, 2, 3, 0.5);
  }
  ps.e(p.x + n.x * 0.1, p.y + n.y * 0.1, p.z + n.z * 0.1, 0, 0, 0, 0.14, 0.9, 1.2, lin(0xffffff, 1.4), 0.7, 0, 0);
}
// miejsce zaczepienia liny: ucinek sieci na scianie
export function anchorFX(anchor, from) {
  _d.subVectors(anchor, from); const L = _d.length(); if (L < 1) return;
  _d.divideScalar(L);
  const t = raycastCity(from, _d, L + 1.5);
  if (t < L + 1.4) { _b.copy(from).addScaledVector(_d, t); webSplat(_b, rayN, 1.1); }
  else ps.e(anchor.x, anchor.y, anchor.z, 0, 0, 0, 0.12, 0.7, 1, lin(0xffffff, 1.3), 0.6, 0, 0);
}

// ---------------------------------------------------------------- liny sieci: gladka rurka + wlokienka skrecone wokol osi
const RN = 16; // punkty wzdluz liny
const ropePool = [];
let ropeMat, fiberMat;
export class Rope {
  constructor() {
    this.seed = Math.random() * 10; this.cp = new Float32Array(RN * 3);
    const pos = new Float32Array(RN * 4 * 3), colr = new Float32Array(RN * 4 * 3).fill(1), idx = [];
    for (let i = 0; i < RN - 1; i++) for (let j = 0; j < 4; j++) {
      const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = (i + 1) * 4 + j, d = (i + 1) * 4 + (j + 1) % 4;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx);
    this.tube = new THREE.Mesh(g, ropeMat); this.tube.frustumCulled = false; this.tube.visible = false; this.tube.renderOrder = 4;
    const fpos = new Float32Array(3 * (RN - 1) * 2 * 3);
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fpos, 3).setUsage(THREE.DynamicDrawUsage));
    this.fibers = new THREE.LineSegments(fg, fiberMat); this.fibers.frustumCulled = false; this.fibers.visible = false; this.fibers.renderOrder = 4;
    scene.add(this.tube, this.fibers);
  }
  // a - dlon, b - punkt zaczepienia; napiecie 0..1 (mniej = wiecej falowania), pluck - dodatkowe drgania po wystrzale/zaczepieniu
  set(a, b, tension = 1, pluck = 0, r = 0.011) {
    _d.subVectors(b, a); const L = _d.length();
    if (L < 0.05) { this.tube.visible = this.fibers.visible = false; return; }
    _d.divideScalar(L);
    _p1.set(0, 1, 0).cross(_d); if (_p1.lengthSq() < 1e-4) _p1.set(1, 0, 0).cross(_d);
    _p1.normalize(); _p2.crossVectors(_d, _p1);
    const fl = Math.min(1, L / 14), amp = (0.03 + 0.35 * (1 - tension) + 0.5 * pluck) * fl, sag = (1 - tension) * 0.1 * L;
    const cp = this.cp, sd = this.seed, tp = this.tube.geometry.attributes.position.array, tc = this.tube.geometry.attributes.color.array;
    const fp = this.fibers.geometry.attributes.position.array;
    for (let i = 0; i < RN; i++) {
      const s = i / (RN - 1), env = Math.sin(Math.PI * s), env2 = env * env;
      const w1 = amp * env * Math.sin(T * 12 + s * 9 + sd) , w2 = amp * env * Math.cos(T * 9.3 + s * 6.5 + sd * 1.7);
      const dn = sag * 4 * s * (1 - s);
      cp[i * 3] = a.x + _d.x * L * s + _p1.x * w1 + _p2.x * w2;
      cp[i * 3 + 1] = a.y + _d.y * L * s + _p1.y * w1 + _p2.y * w2 - dn;
      cp[i * 3 + 2] = a.z + _d.z * L * s + _p1.z * w1 + _p2.z * w2;
      // blysk przesuwajacy sie wzdluz liny
      const sh = Math.pow(Math.max(0, Math.sin((s * 3.2 - T * 2.4 + sd) * 3.14159)), 6), br = 0.95 + 0.9 * sh;
      const rr = r * (0.85 + 0.3 * env2);
      for (let j = 0; j < 4; j++) {
        const o = (i * 4 + j) * 3, cx = (j & 1) ? 0 : (j === 0 ? 1 : -1), cy = (j & 1) ? (j === 1 ? 1 : -1) : 0;
        tp[o] = cp[i * 3] + (_p1.x * cx + _p2.x * cy) * rr; tp[o + 1] = cp[i * 3 + 1] + (_p1.y * cx + _p2.y * cy) * rr; tp[o + 2] = cp[i * 3 + 2] + (_p1.z * cx + _p2.z * cy) * rr;
        tc[o] = br; tc[o + 1] = br; tc[o + 2] = br * 1.02;
      }
    }
    // trzy wlokienka skrecone wokol liny, zbiegaja sie w dloni i w punkcie zaczepu
    const R0 = (0.05 + 0.1 * (1 - tension) + 0.08 * pluck) * (0.5 + 0.5 * fl);
    let w = 0;
    for (let f = 0; f < 3; f++) {
      const ph0 = f * 2.094; let px = 0, py = 0, pz = 0;
      for (let i = 0; i < RN; i++) {
        const s = i / (RN - 1), R = R0 * Math.pow(Math.sin(Math.PI * s), 0.8) * (0.7 + 0.3 * Math.sin(T * 5 + f * 2 + s * 7)), ph = ph0 + s * 7 + T * 1.5;
        const cs = Math.cos(ph) * R, sn = Math.sin(ph) * R;
        const x = cp[i * 3] + _p1.x * cs + _p2.x * sn, y = cp[i * 3 + 1] + _p1.y * cs + _p2.y * sn, z = cp[i * 3 + 2] + _p1.z * cs + _p2.z * sn;
        if (i > 0) { fp[w++] = px; fp[w++] = py; fp[w++] = pz; fp[w++] = x; fp[w++] = y; fp[w++] = z; }
        px = x; py = y; pz = z;
      }
    }
    this.tube.geometry.attributes.position.needsUpdate = true; this.tube.geometry.attributes.color.needsUpdate = true; this.fibers.geometry.attributes.position.needsUpdate = true;
    this.tube.visible = this.fibers.visible = true;
  }
  hide() { this.tube.visible = this.fibers.visible = false; }
}
export function getRope() { return ropePool.pop() || new Rope(); }
export function freeRope(r) { r.hide(); ropePool.push(r); }

// ---------------------------------------------------------------- oplatanie przeciwnika siecia (nitki spiralnie zaciagaja sie na ciele)
const wraps = [];
const WN = 22; // odcinkow na nitke
function wrapFX_init() {
  for (let i = 0; i < 6; i++) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(4 * WN * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const o = new THREE.LineSegments(g, m); o.frustumCulled = false; o.visible = false; scene.add(o);
    wraps.push({ o, e: null, t: 0, th: 0 });
  }
}
export function wrapFX(e, full = false) {
  if (!e || !e.H) return;
  let w = wraps.find(q => q.e === e);
  if (!w) w = wraps.find(q => !q.e);
  if (!w) return;
  w.e = e; w.t = 0; w.th = Math.random() * 6.28; w.full = full; w.o.visible = true;
  const sc = e.scale || 1;
  for (let i = 0; i < 10; i++) { // nitki lecace do przeciwnika i zaciagajace sie
    const a = Math.random() * 6.283, r = rnd(1.4, 2.4) * sc;
    ps.e(e.pos.x + Math.cos(a) * r, e.pos.y + rnd(0.3, 1.8) * sc, e.pos.z + Math.sin(a) * r, -Math.cos(a) * r * 3.2, rnd(-0.5, 0.8), -Math.sin(a) * r * 3.2, 0.5, 0.09, 0.05, lin(0xffffff, 1.1), 0.7, 0, 1.5);
  }
}
function updateWraps(dt) {
  for (const w of wraps) {
    if (!w.e) continue;
    const e = w.e;
    if (e.gone || !e.H || !e.H.root.parent) { w.e = null; w.o.visible = false; continue; }
    w.t += dt; const dur = 0.85, t = w.t / dur;
    if (t >= 1) { w.e = null; w.o.visible = false; continue; }
    const grow = 1 - (1 - Math.min(1, t * 1.6)) * (1 - Math.min(1, t * 1.6)), pull = 1 - Math.pow(1 - Math.min(1, t * 1.15), 3);
    const rad = 0.2 * (1.9 - 1.0 * pull), p = w.o.geometry.attributes.position.array;
    e.H.root.updateMatrixWorld(true);
    const mw = e.H.root.matrixWorld; let o = 0;
    for (let f = 0; f < 4; f++) {
      let px = 0, py = 0, pz = 0;
      for (let i = 0; i <= WN; i++) {
        const u = i / WN, uu = Math.min(u, grow), h = 0.15 + uu * 1.6 * (f % 2 ? 1 : 0.92), ph = w.th + f * 1.57 + uu * (13 + f * 1.3) * (f % 2 ? 1 : -1) + t * 2;
        _a.set(Math.cos(ph) * rad * (1 + 0.15 * Math.sin(uu * 9 + f)), h, Math.sin(ph) * rad * 0.8).applyMatrix4(mw);
        if (i > 0) { p[o++] = px; p[o++] = py; p[o++] = pz; p[o++] = _a.x; p[o++] = _a.y; p[o++] = _a.z; }
        px = _a.x; py = _a.y; pz = _a.z;
      }
    }
    w.o.geometry.attributes.position.needsUpdate = true;
    w.o.material.opacity = 0.9 * Math.min(1, (1 - t) * 3);
  }
}

// ---------------------------------------------------------------- uklady
let ps, pa, sp; // normalne, addytywne, iskry
let inited = false;
export function initEfekty() {
  if (inited) return; inited = true;
  ropeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  fiberMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  ps = new PSys(1600, false, 1, 1);
  pa = new PSys(900, true, 0.35, 2);
  sp = new Sparks(600);
  ringTex = ringTexture();
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 7; scene.add(m); rings.push({ m, t: 0, dur: 1, r1: 1, a: 1, flat: false });
  }
  decalTex.hole = holeTexture(); decalTex.crack = crackTexture();
  wrapFX_init();
}

// kilka roznych plam sieci zeby nie powtarzac wzoru
const webTexVariants = [];
function pickWebTex() {
  if (!webTexVariants.length) for (let i = 0; i < 4; i++) webTexVariants.push(webSplatTexture());
  return webTexVariants[Math.random() * webTexVariants.length | 0];
}

// ---------------------------------------------------------------- gotowe efekty
// dym/kurz: puff
function puff(x, y, z, vx, vy, vz, life, s0, s1, hex, a, drag = 1.6, grav = -0.3, fy = -1e4, fm = 0) {
  lin(hex);
  const k = rnd(0.88, 1.08); col[0] *= k; col[1] *= k; col[2] *= k;
  ps.e(x, y, z, vx, vy, vz, life, s0, s1, col, a, grav, drag, 0, fy, fm);
}
function flash(x, y, z, size, hex, k = 2.2, life = 0.09) { pa.e(x, y, z, 0, 0, 0, life, size, size * 1.4, lin(hex, k), 0.9, 0, 0); }

// uniwersalny wybuch czasteczek — klasyfikacja po kolorze (zachowuje stare wywolania burst(x,y,z,n,kolor,predkosc))
export function burst(x, y, z, n, hex, spd = 5) {
  if (!inited) return;
  _c.setHex(hex); const r = _c.r, g = _c.g, b = _c.b, lum = 0.3 * r + 0.59 * g + 0.11 * b;
  if (hex === 0xffffff) { // sieciowe strzepy
    for (let i = 0; i < n; i++) {
      const s = spd * rnd(0.35, 1.1);
      sp.e(x, y, z, rnd(-1, 1) * s, rnd(-0.2, 1) * s, rnd(-1, 1) * s, rnd(0.3, 0.65), lin(0xffffff, 1.3), 0.07, 2.5, 3, 0);
    }
    for (let i = 0; i < Math.min(4, n >> 2); i++) puff(x, y, z, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), 0.5, 0.3, 0.7, 0xf4f6fa, 0.28, 3, 0);
    if (n >= 20) { flash(x, y, z, 1.3, 0xffffff, 1.6, 0.12); ring(x, y, z, 1.7, 0.3, lin(0xe8f0ff, 0.9), 0.7, false); }
  } else if (b > 0.85 && r < 0.7) { // blok: niebieskie iskry
    for (let i = 0; i < n * 2; i++) { const s = spd * rnd(0.5, 1.6); sp.e(x, y, z, rnd(-1, 1) * s, rnd(-0.3, 1) * s, rnd(-1, 1) * s, rnd(0.18, 0.4), lin(0xa8dcff, 1.5), 0.04, 9, 1.5, 0); }
    flash(x, y, z, 0.9, 0xbfe6ff, 2, 0.1); ring(x, y, z, 1.2, 0.22, lin(0x9fd8ff, 1.2), 0.9, false);
  } else if (r > 0.9 && b < 0.85 && lum > 0.7) { // uderzenie: bialy blysk, fala, iskry, kurz
    const big = clamp(n / 10, 0.6, 2);
    flash(x, y, z, 1.1 * big, 0xffffff, 2.6, 0.08); flash(x, y, z, 2.0 * big, 0xffd890, 1.1, 0.13);
    ring(x, y, z, 1.1 * big, 0.2, lin(0xfff4dc, 1.3), 0.85, false);
    for (let i = 0; i < n * 1.6; i++) {
      const a = Math.random() * 6.283, el = rnd(-0.4, 1), s = spd * rnd(0.6, 2.0);
      sp.e(x, y, z, Math.cos(a) * s, el * s, Math.sin(a) * s, rnd(0.22, 0.5), lin(i & 1 ? 0xffe8a0 : 0xffb050, 1.6), 0.035, 12, 1.2, 0);
    }
    for (let i = 0; i < 2; i++) puff(x, y, z, rnd(-1, 1), rnd(0, 1), rnd(-1, 1), 0.7, 0.3, 0.9, 0xb9b2a6, 0.2, 2.5, 0);
  } else if (lum < 0.4) { // dym / wybuch
    if (n >= 20) explosion(x, y, z, n);
    else puff(x, y, z, rnd(-0.4, 0.4) * spd, rnd(1, 2.2), rnd(-0.4, 0.4) * spd, rnd(1.4, 2.2), 0.5, rnd(2, 3.2), hex, 0.38, 0.6, -0.4);
  } else { // kurz, pyl
    const gy = y;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = spd * rnd(0.2, 0.75);
      puff(x + Math.cos(a) * 0.3, y, z + Math.sin(a) * 0.3, Math.cos(a) * s, rnd(0, 1) * spd * 0.22, Math.sin(a) * s, rnd(0.8, 1.5), rnd(0.4, 0.7), 1.3 + spd * 0.2, hex, 0.42, 2.2, -0.35);
    }
    for (let i = 0; i < (n >> 1); i++) ps.e(x, y, z, rnd(-1, 1) * spd * 0.7, rnd(0.4, 1.3) * spd * 0.9, rnd(-1, 1) * spd * 0.7, rnd(0.5, 0.9), 0.07, 0.06, lin(0x6b665f), 0.9, 16, 0.2, 0, gy - 0.1, 3);
  }
}
export function explosion(x, y, z, n = 40) {
  flash(x, y, z, 6, 0xfff0c0, 2.4, 0.18); flash(x, y, z, 10, 0xff8a20, 1.2, 0.35);
  ring(x, y, z, 5, 0.45, lin(0xffc880, 1.2), 0.8, false);
  ring(x, 0.25, z, 8, 0.6, lin(0xffe0b0, 0.8), 0.6, true);
  for (let i = 0; i < n * 0.6; i++) { // kula ognia
    const a = Math.random() * 6.283, s = rnd(0.5, 4);
    pa.e(x + rnd(-0.6, 0.6), y + rnd(-0.3, 0.6), z + rnd(-0.6, 0.6), Math.cos(a) * s, rnd(0.5, 4), Math.sin(a) * s, rnd(0.35, 0.8), 1.2, 3.6, lin(i & 1 ? 0xff9a30 : 0xffd070, 1.2), 0.75, -0.5, 1.5);
  }
  for (let i = 0; i < n * 0.5; i++) { // czarny dym
    const a = Math.random() * 6.283, s = rnd(0.4, 3);
    puff(x + rnd(-0.8, 0.8), y + rnd(0, 1), z + rnd(-0.8, 0.8), Math.cos(a) * s, rnd(1.5, 4.5), Math.sin(a) * s, rnd(1.6, 3), 1.2, rnd(4, 7), 0x2a2724, 0.55, 0.9, -0.5);
  }
  for (let i = 0; i < n * 1.2; i++) { // iskry i zar
    const a = Math.random() * 6.283, el = rnd(0.1, 1), s = rnd(4, 16);
    sp.e(x, y, z, Math.cos(a) * s * (1 - el * 0.4), el * s, Math.sin(a) * s * (1 - el * 0.4), rnd(0.5, 1.2), lin(i & 1 ? 0xffc060 : 0xff7a20, 1.5), 0.05, 14, 0.6, 0);
  }
  for (let i = 0; i < 14; i++) ps.e(x, y, z, rnd(-1, 1) * 8, rnd(2, 9), rnd(-1, 1) * 8, rnd(1, 1.8), 0.14, 0.1, lin(0x35302b), 1, 18, 0.1, 0, 0, 3);
}
export function heroLand(x, y, z, pow = 1) {
  if (!inited) return;
  const street = y < 0.6, wet = street && hash2(Math.floor(x / 7), Math.floor(z / 7)) < 0.22;
  const hex = street ? 0x8f8b85 : 0xb4ada2;
  ring(x, y + 0.08, z, 4.6 * pow, 0.34, lin(0xfff0d8, 0.7), 0.7, true);
  ring(x, y + 0.1, z, 7.5 * pow, 0.55, lin(0xe9e2d6, 0.5), 0.45, true);
  flash(x, y + 0.2, z, 2.2, 0xfff2d8, 1.4, 0.1);
  const n = 34;
  for (let i = 0; i < n; i++) { // pierscien kurzu rozchodzacy sie po ziemi
    const a = i / n * 6.283 + Math.random() * 0.2, s = rnd(5, 9.5) * pow;
    puff(x + Math.cos(a) * 0.4, y + 0.1, z + Math.sin(a) * 0.4, Math.cos(a) * s, rnd(0.2, 1.2), Math.sin(a) * s, rnd(1, 1.8), rnd(0.5, 0.8), rnd(1.8, 2.8), hex, 0.4, 2.6, -0.3);
  }
  for (let i = 0; i < 12; i++) { // slup dymu nad miejscem uderzenia
    const a = Math.random() * 6.283, s = rnd(0, 1.6);
    puff(x + Math.cos(a) * 0.3, y + 0.2, z + Math.sin(a) * 0.3, Math.cos(a) * s, rnd(1.2, 3.6), Math.sin(a) * s, rnd(1.5, 2.4), 0.8, rnd(2.6, 3.8), hex, 0.36, 0.8, -0.6);
  }
  for (let i = 0; i < 18; i++) { const a = Math.random() * 6.283, s = rnd(2, 6) * pow; ps.e(x, y + 0.1, z, Math.cos(a) * s, rnd(3, 7), Math.sin(a) * s, rnd(0.7, 1.2), 0.08, 0.07, lin(0x5e5a54), 1, 17, 0.1, 0, y - 0.02, 3); }
  for (let i = 0; i < 14; i++) { const a = Math.random() * 6.283, s = rnd(3, 8); sp.e(x, y + 0.1, z, Math.cos(a) * s, rnd(1.5, 5), Math.sin(a) * s, rnd(0.25, 0.5), lin(0xffd69a, 1.4), 0.035, 12, 1, y); }
  tmpN.set(0, 1, 0); tmpP.set(x, y, z); decal('crack', tmpP, tmpN, 3.6 * pow);
  if (wet) splash(x, y, z, 1.3);
}
const tmpN = new V3(), tmpP = new V3();
function hash2(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
// kropelki i bryzgi (kaluza)
export function splash(x, y, z, pow = 1) {
  if (!inited) return;
  ring(x, y + 0.04, z, 2.2 * pow, 0.55, lin(0xbcd8ee, 0.7), 0.55, true);
  ring(x, y + 0.05, z, 3.4 * pow, 0.8, lin(0xbcd8ee, 0.4), 0.35, true);
  for (let i = 0; i < 38 * pow; i++) {
    const a = Math.random() * 6.283, s = rnd(1, 4.5) * pow;
    ps.e(x + Math.cos(a) * 0.2, y + 0.05, z + Math.sin(a) * 0.2, Math.cos(a) * s, rnd(2.5, 7) * pow, Math.sin(a) * s, rnd(0.5, 1), rnd(0.06, 0.12), 0.05, lin(0xdbe9f4), 0.75, 15, 0.05, 0, y, 2);
  }
  for (let i = 0; i < 10; i++) { const a = Math.random() * 6.283, s = rnd(0.5, 2); pa.e(x, y + 0.1, z, Math.cos(a) * s, rnd(1, 3), Math.sin(a) * s, 0.4, 0.12, 0.2, lin(0xe6f2fb, 0.9), 0.5, 8, 1); }
  puff(x, y + 0.1, z, 0, 0.8, 0, 0.8, 0.5, 1.6, 0xdce6ee, 0.14, 2, -0.2);
}
// blysk wylotowy broni
export function muzzleFlash(pos, dir) {
  if (!inited) return;
  flash(pos.x, pos.y, pos.z, 0.55, 0xfff0c0, 3, 0.05);
  flash(pos.x + dir.x * 0.18, pos.y + dir.y * 0.18, pos.z + dir.z * 0.18, 0.9, 0xffb040, 1.4, 0.07);
  for (let i = 0; i < 6; i++) { const s = rnd(5, 14); sp.e(pos.x, pos.y, pos.z, dir.x * s + rnd(-2, 2), dir.y * s + rnd(-2, 2), dir.z * s + rnd(-2, 2), rnd(0.1, 0.22), lin(0xffc060, 1.5), 0.03, 4, 2, 0); }
  puff(pos.x + dir.x * 0.3, pos.y + dir.y * 0.3, pos.z + dir.z * 0.3, dir.x * 1.2, dir.y * 1.2 + 0.4, dir.z * 1.2, 0.8, 0.18, 0.7, 0xb8b4ae, 0.22, 2, -0.2);
}
// trafienie kuli w powierzchnie: iskry, rykoszet, kurz, slad w scianie
export function bulletImpact(p, n) {
  if (!inited) return;
  flash(p.x + n.x * 0.05, p.y + n.y * 0.05, p.z + n.z * 0.05, 0.5, 0xffe8b0, 2.4, 0.06);
  for (let i = 0; i < 9; i++) { // rykoszet: kierunek odbity + rozrzut
    const s = rnd(3, 11);
    sp.e(p.x, p.y, p.z, n.x * s * rnd(0.3, 1) + rnd(-3, 3), n.y * s * rnd(0.3, 1) + rnd(-1, 3), n.z * s * rnd(0.3, 1) + rnd(-3, 3), rnd(0.15, 0.4), lin(i & 1 ? 0xffe8a0 : 0xffb050, 1.6), 0.03, 11, 1.4, Math.max(0, p.y - 3));
  }
  for (let i = 0; i < 3; i++) puff(p.x, p.y, p.z, n.x * 1.2 + rnd(-0.5, 0.5), n.y * 1.2 + rnd(0, 0.8), n.z * 1.2 + rnd(-0.5, 0.5), rnd(0.6, 1), 0.2, 0.7, 0xb4ada2, 0.3, 2.5, -0.2);
  decal('hole', p, n, rnd(0.28, 0.4));
}
// pekajace szklo: odlamki z blyskami (trafienie w okno / szybe auta)
export function glassBurst(x, y, z, nx = 0, ny = 0, nz = 1, n = 28) {
  if (!inited) return;
  flash(x, y, z, 1.0, 0xe6f4ff, 1.6, 0.1);
  for (let i = 0; i < n; i++) {
    const s = rnd(2, 9);
    sp.e(x + rnd(-0.3, 0.3), y + rnd(-0.3, 0.3), z + rnd(-0.3, 0.3), nx * s + rnd(-3, 3), ny * s + rnd(0, 3), nz * s + rnd(-3, 3), rnd(0.6, 1.3), lin(i % 3 ? 0xcfeaff : 0xffffff, 1.2), 0.07, 16, 0.4, 0.02);
  }
  for (let i = 0; i < n >> 1; i++) { const s = rnd(1, 6); pa.e(x, y, z, nx * s + rnd(-2, 2), ny * s + rnd(0, 3), nz * s + rnd(-2, 2), rnd(0.4, 0.9), 0.12, 0.05, lin(0xffffff, 1.6), 0.9, 12, 0.5); }
  puff(x, y, z, nx, ny + 0.3, nz, 0.9, 0.4, 1.2, 0xc9d2d8, 0.16, 2, -0.1);
}

// ---------------------------------------------------------------- otoczenie: wiatr, liscie, papiery, para
const vents = new Map(); let leafAcc = 0, ventAcc = 0;
const LEAF = [0xe6e0d0, 0xf0ece0, 0x8a5a2a, 0xa07a30, 0x6b6b2a, 0xd8d2c2];
function ambient(dt) {
  if (G.state !== 'play' && G.state !== 'pause') return;
  wind.x = 2.2 + Math.sin(T * 0.31) * 1.3 + Math.sin(T * 1.7) * 0.5; wind.z = 0.9 + Math.cos(T * 0.23) * 1.1;
  if (P.pos.y > 28) return; // wyzej nie ma sensu
  leafAcc += dt * 5;
  while (leafAcc >= 1) {
    leafAcc -= 1;
    const a = Math.random() * 6.283, r = rnd(5, 32), x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r;
    const gy = supportAt(x, z, P.pos.y + 2, 0.1);
    if (solidAt(x, gy + 0.4, z)) continue;
    const hex = LEAF[Math.random() * LEAF.length | 0], paper = hex === 0xe6e0d0 || hex === 0xf0ece0 || hex === 0xd8d2c2;
    ps.e(x, gy + rnd(0.2, 1.4), z, wind.x, rnd(0, 1), wind.z, rnd(8, 14), paper ? 0.14 : 0.1, paper ? 0.13 : 0.09, lin(hex), 0.9, 0.5, 0.6, 3.5, gy + 0.03, 1);
  }
  // para z kratek i rurek (stale miejsca wyliczane z haszu komorek siatki)
  const CS = 29, cx0 = Math.floor(P.pos.x / CS), cz0 = Math.floor(P.pos.z / CS);
  ventAcc += dt;
  const emit = ventAcc > 0.07; if (emit) ventAcc = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const cx = cx0 + i, cz = cz0 + j, key = cx * 100003 + cz;
    let v = vents.get(key);
    if (!v) {
      const h = hash2(cx, cz), x = (cx + hash2(cx + 7, cz)) * CS, z = (cz + hash2(cx, cz + 9)) * CS;
      v = { ok: h < 0.3 && !solidAt(x, 0.8, z) && supportAt(x, z, 1, 0.2) < 0.2, x, z };
      vents.set(key, v);
      if (vents.size > 400) vents.clear();
    }
    if (!v.ok || !emit || Math.abs(v.x - P.pos.x) > 70 || Math.abs(v.z - P.pos.z) > 70) continue;
    puff(v.x + rnd(-0.1, 0.1), 0.1, v.z + rnd(-0.1, 0.1), wind.x * 0.25 + rnd(-0.2, 0.2), rnd(1.4, 2.2), wind.z * 0.25 + rnd(-0.2, 0.2), rnd(1.8, 2.8), 0.25, rnd(1.6, 2.4), 0xe9edf0, 0.2, 0.35, -0.1);
  }
}

// ---------------------------------------------------------------- aktualizacja
export function updateEfekty(dt) {
  if (!inited) return;
  T += dt;
  ambient(dt);
  ps.update(dt); pa.update(dt); sp.update(dt);
  updateRings(dt); updateDecals(dt); updateWraps(dt);
}
export const fxPools = () => ({ ps, pa, sp });
