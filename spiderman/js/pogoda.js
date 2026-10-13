// Pogoda: deszcz (smugi na GPU + krople na obiektywie), mokre ulice i kaluze, pioruny, mgla, zachmurzenie, pogoda AUTO.
// Nie dodaje swiatel dynamicznych: jedna siatka LineSegments, jeden maly canvas 2D i kilka uniformow.
// Pogoda dziala jak nakladka: co klatke liczy niebo/mgle/swiatlo z wartosci bazowych pory dnia (miasto.js: envRefs).
import { V3, clamp, lerp, damp, save, doSave } from './util.js';
import { G, P, scene, camera, canvas } from './stan.js';
import { envRefs, todName, raycastCity } from './miasto.js';
import { SKY_TOD } from './niebo.js';
import { sfx } from './dzwiek.js';

export const WX_NAMES = { auto: 'AUTO', clear: 'SŁONECZNIE', cloud: 'ZACHMURZENIE', rain: 'DESZCZ', fog: 'MGŁA' };
const ORDER = ['auto', 'clear', 'cloud', 'rain', 'fog'];
// cele: zachmurzenie, deszcz, mgla
const GOAL = { clear: [0, 0, 0], cloud: [0.85, 0, 0.1], rain: [1, 1, 0.22], fog: [0.6, 0, 1] };
export const weatherName = () => WX_NAMES[save.weather] || WX_NAMES.auto;

// ---------------------------------------------------------------- mokra jezdnia (uniformy wspolne dla materialu podloza)
export const wetU = { uWet: { value: 0 }, uRain: { value: 0 }, uTm: { value: 0 } };
export function wetPatch(sh) {
  Object.assign(sh.uniforms, wetU);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vWP; uniform float uWet, uRain, uTm;
      float wH(vec2 p){ p = fract(p*vec2(.1031,.1030)); p += dot(p, p.yx+33.33); return fract((p.x+p.y)*p.x); }
      float wN(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(wH(i),wH(i+vec2(1,0)),f.x), mix(wH(i+vec2(0,1)),wH(i+vec2(1,1)),f.x), f.y); }`)
    .replace('#include <map_fragment>', `#include <map_fragment>
      float wPud = smoothstep(.56, .7, wN(vWP.xz*.12)*.6 + wN(vWP.xz*.41)*.4) * uWet;
      float wRip = 0.;
      if (uRain > .01) {
        float wFade = 1. - smoothstep(14., 38., length(vWP - cameraPosition));
        vec2 q = vWP.xz*1.4, ci = floor(q), cf = fract(q) - .5;
        float h = wH(ci), t = fract(uTm*.85 + h*3.);
        cf -= (vec2(wH(ci+7.3), wH(ci+13.1)) - .5)*.5;
        wRip = smoothstep(.07, .0, abs(length(cf) - t*.6)) * (1. - t) * step(h, .6) * uRain * wFade * (.35 + wPud);
      }
      diffuseColor.rgb *= (1. - .42*uWet) * (1. - .45*wPud);
      diffuseColor.rgb += wRip*.05;`)
    .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor *= 1. - .78*uWet;
      roughnessFactor = mix(roughnessFactor, .05, wPud);
      roughnessFactor = mix(roughnessFactor, .09, clamp(wRip*2., 0., 1.));`);
}

// ---------------------------------------------------------------- deszcz (smugi liczone w shaderze wierzcholkow)
const NR = 6000;
let rainMesh = null, rainU = null;
function buildRain() {
  const seed = new Float32Array(NR * 6), end = new Float32Array(NR * 2);
  for (let i = 0; i < NR; i++) {
    const a = Math.random(), b = Math.random(), c = Math.random();
    seed.set([a, b, c, a, b, c], i * 6); end[i * 2] = 0; end[i * 2 + 1] = 1;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(seed, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 3)); g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  rainU = { uCam: { value: new V3() }, uTm: { value: 0 }, uVel: { value: new V3(3, -24, 1) }, uLen: { value: 0.045 }, uCol: { value: new V3(0.8, 0.85, 0.95) }, uA: { value: 0 } };
  const m = new THREE.ShaderMaterial({
    uniforms: rainU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform vec3 uCam, uVel; uniform float uTm, uLen; varying float vA;
      void main(){
        vec3 B = vec3(46., 32., 46.);
        vec3 p = aSeed*B + uVel*uTm*(.85 + .3*fract(aSeed.x*37.));
        vec3 q = mod(p - uCam, B) - B*.5;
        vec3 pos = uCam + q;
        float d = length(q);
        vA = (1. - smoothstep(12., 23., d)) * smoothstep(.7, 2.2, d) * (1. - .75*aEnd) * step(.1, pos.y);
        pos -= uVel*uLen*aEnd*(1. + 1.5*smoothstep(8., 1., d));
        gl_Position = projectionMatrix*viewMatrix*vec4(pos, 1.);
      }`,
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(uCol, vA*uA); }',
  });
  rainMesh = new THREE.LineSegments(g, m); rainMesh.frustumCulled = false; rainMesh.renderOrder = 6; rainMesh.visible = false; scene.add(rainMesh);
}

// ---------------------------------------------------------------- krople na obiektywie (maly canvas nad obrazem)
let lens = null, lx = null, drops = [], lensAcc = 0, lensT = 0;
const LW = 480, LH = 270;
function buildLens() {
  lens = document.createElement('canvas'); lens.id = 'lens'; lens.width = LW; lens.height = LH;
  lens.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;display:none';
  document.body.appendChild(lens); lx = lens.getContext('2d');
  flashEl = document.createElement('div'); flashEl.style.cssText = 'position:fixed;inset:0;z-index:4;pointer-events:none;background:#dfe8ff;opacity:0;mix-blend-mode:screen';
  document.body.appendChild(flashEl);
}
let flashEl = null;
function updateLens(dt, amount) {
  if (amount > 0.08) { lensAcc += dt * 7 * amount; while (lensAcc > 1 && drops.length < 70) { lensAcc -= 1; const big = Math.random() < 0.3; drops.push({ x: Math.random() * LW, y: Math.random() * LH, r: big ? 3 + Math.random() * 3 : 1 + Math.random() * 1.8, life: 3 + Math.random() * 5, v: 0, slide: Math.random() < (big ? 0.7 : 0.25), wait: Math.random() * 2 }); } lensAcc = Math.min(lensAcc, 1); }
  if (!drops.length) { if (lens.style.display !== 'none') { lens.style.display = 'none'; lx.clearRect(0, 0, LW, LH); } return; }
  lensT += dt; if (lensT < 1 / 30) { for (const d of drops) stepDrop(d, dt); drops = drops.filter(d => d.life > 0); return; } // rysujemy w 30 kl./s
  const ddt = lensT; lensT = 0;
  lens.style.display = 'block';
  lx.globalCompositeOperation = 'destination-out'; lx.fillStyle = 'rgba(0,0,0,.09)'; lx.fillRect(0, 0, LW, LH); lx.globalCompositeOperation = 'source-over';
  for (const d of drops) {
    stepDrop(d, ddt);
    const a = clamp(d.life, 0, 1), r = d.r;
    lx.globalAlpha = a;
    lx.fillStyle = 'rgba(190,205,225,.07)'; lx.beginPath(); lx.ellipse(d.x, d.y, r, r * 1.18, 0, 0, 7); lx.fill();
    lx.strokeStyle = 'rgba(10,14,24,.3)'; lx.lineWidth = 1; lx.beginPath(); lx.ellipse(d.x, d.y, r, r * 1.18, 0, 0.15 * Math.PI, 0.85 * Math.PI); lx.stroke(); // ciemny dol (zalamanie)
    lx.fillStyle = 'rgba(255,255,255,.5)'; lx.beginPath(); lx.ellipse(d.x - r * 0.3, d.y - r * 0.4, Math.max(0.5, r * 0.28), Math.max(0.5, r * 0.2), 0, 0, 7); lx.fill(); // odblysk
  }
  lx.globalAlpha = 1;
  drops = drops.filter(d => d.life > 0);
}
function stepDrop(d, dt) {
  d.life -= dt * 0.35;
  if (d.slide) { d.wait -= dt; if (d.wait < 0) { d.v = Math.min(d.v + dt * 60, 55); d.y += d.v * dt; d.x += Math.sin(d.y * 0.3 + d.r) * dt * 6; d.r = Math.max(d.r * (1 - dt * 0.12), 1); if (d.v > 25 && Math.random() < dt * 0.8) { d.v *= 0.2; d.wait = Math.random(); } if (d.y > LH + 8) d.life = 0; } }
}

// ---------------------------------------------------------------- stan pogody
const cur = { cloud: 0, rain: 0, fog: 0 };
const goal = { cloud: 0, rain: 0, fog: 0 };
let autoName = 'clear', autoT = 240 + Math.random() * 180, inited = false, snap = true;
let flash = 0, flashT = 9, nextBolt = 12 + Math.random() * 10, thunderT = -1, rainSnd = 0, shelter = 0, shelterT = 0, shelterGoal = 0;
let lastT = null, lastKey = '', dirty = true, wetV = 0;
const BASE_FILTER = { sunset: 'sepia(.12) saturate(1.15) contrast(1.12) brightness(.96)', day: 'saturate(1.12) contrast(1.06)', night: 'saturate(1.08) contrast(1.1)' };
const _o = new V3(), _up = new V3(0, 1, 0);

function pickAuto() {
  const w = { sunset: { clear: 0.4, cloud: 0.3, rain: 0.2, fog: 0.1 }, day: { clear: 0.42, cloud: 0.28, rain: 0.2, fog: 0.1 }, night: { clear: 0.3, cloud: 0.2, rain: 0.32, fog: 0.18 } }[todName] || { clear: 1 };
  let tot = 0; for (const k in w) if (k !== autoName) tot += w[k];
  let r = Math.random() * tot;
  for (const k in w) { if (k === autoName) continue; r -= w[k]; if (r <= 0) return k; }
  return 'clear';
}
function setGoal() {
  const n = save.weather === 'auto' ? autoName : (GOAL[save.weather] ? save.weather : 'clear');
  const g = GOAL[n]; goal.cloud = g[0]; goal.rain = g[1]; goal.fog = g[2];
}
export function cycleWeather() {
  save.weather = ORDER[(ORDER.indexOf(save.weather) + 1) % ORDER.length]; doSave();
  if (save.weather === 'auto') autoT = 300 + Math.random() * 300;
  setGoal();
}
export function triggerBolt() { flashT = 0; thunderT = 0.8; } // test: blysk teraz
// natychmiastowa zmiana (testy / start)
export function setWeatherNow(name) { save.weather = name; setGoal(); Object.assign(cur, { cloud: goal.cloud, rain: goal.rain, fog: goal.fog }); wetV = cur.rain; dirty = true; }

function grey(c, k) { const l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) * k; return [l * 0.96, l * 0.99, l * 1.04]; }
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const lin = a => a.map(v => Math.pow(Math.max(0, v), 2.2));

// przelicza niebo, mgle, chmury i filtr obrazu z wartosci bazowych pory dnia
function applySky(R) {
  const T = R.T, S = SKY_TOD[todName], U = R.skyU, c = cur.cloud, f = cur.fog, r = cur.rain;
  const gr = clamp(c * 0.8 + f * 0.7, 0, 1), dim = 1 - 0.34 * c * (1 - f) + 0.12 * f, fl = flash;
  const night = todName === 'night';
  for (const k of ['top', 'mid', 'hor']) {
    let col = mix3(T[k], grey(T[k], dim * (k === 'top' ? 0.85 : 1)), gr);
    if (fl > 0.01) col = col.map(v => v * (1 + fl * 4.5));
    U[k].value.set(...lin(col));
  }
  U.cover.value = lerp(S.cover, 0.98, c); U.cK.value = S.cK * (1 - 0.3 * c * (night ? 0.4 : 1));
  U.cirr.value = lerp(S.cirr, 0.15, c);
  const lit = mix3(S.cLit, grey(S.cLit, 0.9), c * 0.75), sh = mix3(S.cShade, grey(S.cShade, 0.62), c * 0.85);
  const fc = grey(T.hor, dim), lit2 = mix3(lit, fc, f * 0.9), sh2 = mix3(sh, fc.map(v => v * 0.94), f * 0.9); // w mgle chmury zlewaja sie z niebem
  U.cLit.value.set(...lin(lit2)); U.cShade.value.set(...lin(sh2));
  R.fog.near = lerp(T.fogN, 6, f); R.fog.far = lerp(T.fogF * (1 - 0.4 * r - 0.15 * c), 240, f);
  R.applyFog();
  const gs = c * 0.22 + f * 0.1;
  canvas.style.filter = BASE_FILTER[todName] + ` saturate(${(1 - gs * 1.1).toFixed(3)}) contrast(${(1 - f * 0.1 - c * 0.04).toFixed(3)}) brightness(${(1 + f * 0.06).toFixed(3)})`;
}

const _sh = new V3();
export function updateWeather(rdt) {
  const R = envRefs(); if (!R.T) return;
  if (!inited) { inited = true; buildRain(); buildLens(); setGoal(); Object.assign(cur, goal); wetV = cur.rain; }
  // pogoda AUTO: zmiana co 6-12 minut, zalezna od pory dnia
  if (save.weather === 'auto') { autoT -= rdt; if (autoT <= 0) { autoT = 360 + Math.random() * 360; autoName = pickAuto(); setGoal(); } }
  else setGoal();
  const k = damp(snap ? 5 : save.weather === 'auto' ? 0.1 : 0.22, rdt);
  if (snap) { snap = false; }
  for (const n of ['cloud', 'rain', 'fog']) { const d = goal[n] - cur[n]; cur[n] += Math.abs(d) < 0.0008 ? d : d * k; }
  // pioruny: tylko w ulewie
  if (cur.rain > 0.8 && cur.cloud > 0.9) {
    nextBolt -= rdt;
    if (nextBolt <= 0) { nextBolt = 8 + Math.random() * 18; flashT = 0; thunderT = 0.5 + Math.random() * 3; }
  }
  if (flashT < 1) {
    flashT += rdt;
    flash = Math.max(Math.exp(-flashT * 9), flashT > 0.14 ? Math.exp(-(flashT - 0.14) * 6) * 0.8 : 0) * (flashT < 0.9 ? 1 : 0);
    if (flashT >= 0.9) flash = 0;
  } else flash = 0;
  if (thunderT > 0) { thunderT -= rdt; if (thunderT <= 0) sfx('thunder', G.interior ? 0.5 : 1); }
  // zadaszenie: pod markiza/dachem deszcz nie pada na kamere
  shelterT -= rdt;
  if (shelterT <= 0) { shelterT = 0.25; _o.copy(camera.position); _o.y += 0.3; shelterGoal = raycastCity(_o, _up, 14) < 14 ? 1 : 0; }
  shelter = lerp(shelter, shelterGoal, damp(5, rdt));
  const open = (G.interior ? 0 : 1) * (1 - shelter * 0.9);
  const rainA = cur.rain * open;
  // wilgotnosc: rosnie szybko w deszczu, schnie powoli
  wetV += (cur.rain - wetV) * damp(cur.rain > wetV ? 0.08 : 0.01, rdt);
  wetU.uWet.value = wetV; wetU.uRain.value = cur.rain; wetU.uTm.value = G.time;

  // niebo/mgla: tylko gdy sie zmienia (albo trwa blysk), albo zmienila sie pora dnia
  const key = cur.cloud.toFixed(3) + cur.rain.toFixed(3) + cur.fog.toFixed(3);
  if (R.T !== lastT || key !== lastKey || flash > 0 || dirty) { lastT = R.T; lastKey = key; dirty = false; applySky(R); }
  // swiatlo: slonce slabsze pod chmurami (po swUpdate, ktory ustawia je co klatke), miekkie swiatlo hemisfery
  if (!G.interior) {
    const sk = 1 - 0.86 * cur.cloud - 0.1 * cur.fog;
    R.sun.intensity = (todName === 'night' ? R.T.sunI : R.sun.intensity) * sk;
    R.hemi.intensity = R.hemi.intensity * (1 + 0.3 * cur.cloud + 0.2 * cur.fog) + flash * 1.8;
  }
  if (flashEl) flashEl.style.opacity = (flash * 0.28 * (G.interior ? 0.3 : 1)).toFixed(3);

  // deszcz
  if (rainMesh) {
    const vis = rainA > 0.01 && G.state !== 'pause';
    rainMesh.visible = vis;
    if (vis) {
      const t = G.time, u = rainU;
      u.uTm.value = t; u.uCam.value.set(camera.position.x, Math.max(camera.position.y + 4, 15), camera.position.z);
      u.uVel.value.set(3.5 + Math.sin(t * 0.13) * 2, -24, 1.2 + Math.cos(t * 0.09));
      u.uA.value = rainA * (todName === 'night' ? 0.62 : todName === 'sunset' ? 0.5 : 0.45);
      const fc = R.fog.color; u.uCol.value.set(0.55 + fc.r * 0.45, 0.58 + fc.g * 0.42, 0.62 + fc.b * 0.38);
    }
  }
  if (lens) updateLens(rdt, G.state === 'play' && !G.cine ? rainA * (cur.rain > 0.5 ? 1 : 0) : 0);
  // szum deszczu
  rainSnd -= rdt;
  if (rainSnd <= 0 && cur.rain > 0.05 && G.state !== 'pause') { rainSnd = 0.32; sfx('rain', cur.rain * (G.interior ? 0.35 : 0.5 + 0.5 * open) * 1.3); }
}
