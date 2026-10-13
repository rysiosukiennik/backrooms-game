// Swiatlo: cienie slonca, okluzja otoczenia, cienie kontaktowe (blob AO) i poswiata latarni.
// Wszystko tanie: jedno swiatlo kierunkowe z cieniem, kilka InstancedMesh, zero swiatel dynamicznych i zero przebiegow pelnoekranowych.
import { V3, clamp, cv, canvasTex } from './util.js';
import { scene, camera, P, G, enemies } from './stan.js';

const SW_H = 0.15; // wysokosc chodnika (jak SW w miasto.js)
export const CFG = {
  map: 2048,
  cross: 58,          // polowa szerokosci okna cienia (w poprzek swiatla)
  up: 44,             // polowa wysokosci okna cienia (wzdluz "gory" kamery swiatla); rosnie z wysokoscia gracza
  dist: 450,
  bias: -0.0005, normalBias: 0.03,
  lead: 16,           // okno cienia przesuniete przed gracza (tam patrzy kamera)
  cloud: 0.09,        // glebokosc przesuwajacego sie "cienia chmur" na swietle slonca
};
if (typeof window !== 'undefined') window.__SW = CFG;

// ---------------------------------------------------------------- okluzja otoczenia w materialach (przy ziemi, zimny odcien cienia)
export const AOU = { uAoTint: { value: new V3(0.84, 0.91, 1.0) } };
// fragment shadera wstawiany po <map_fragment>: gradient wysokosci + dodatkowe sciemnienie tuz przy ziemi (kontakt) + chlodny odcien
export function aoGLSL(k, h) {
  return `float aoH = smoothstep(0.0, ${h.toFixed(1)}, vWY);
  float aoV = mix(${k.toFixed(2)}, 1.0, pow(aoH, 0.85));
  aoV *= 1.0 - 0.2 * (1.0 - smoothstep(0.0, 2.4, vWY));
  diffuseColor.rgb *= aoV * mix(uAoTint, vec3(1.0), aoH);`;
}

// ---------------------------------------------------------------- slonce / ksiezyc: kamera cieni sledzaca gracza
const _X = new V3(), _Y = new V3(), _Z = new V3(), _T = new V3(), _UP = new V3(0, 1, 0), _F = new V3();
let shadowInit = false, lastHalf = 0;
export function swInit(sun) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(CFG.map, CFG.map);
  const sc = sun.shadow.camera; sc.near = 150; sc.far = 750;
  sun.shadow.bias = CFG.bias; sun.shadow.normalBias = CFG.normalBias;
  shadowInit = true;
}
let base = { sunI: 1, hemiI: 0.4, ground: null, sky: null, warm: null, warmK: 0.3, lamps: 0, day: 0 };
const WARM = { // swiatlo odbite od scian budynkow (sRGB), jego udzial i moc pooli latarni
  sunset: { warm: 0xd08a52, k: 0.55, hi: 0.92 },
  day: { warm: 0x9a8c7c, k: 0.3, hi: 1.0 },
  night: { warm: 0x4a4c66, k: 0.25, hi: 1.0 },
};
const srgb = (c, hex) => c.setHex(hex).convertSRGBToLinear();
// po ustawieniu swiatel przez setTOD: zapamietujemy wartosci bazowe
export function swTOD(name, sun, hemi, lampK) {
  const w = WARM[name] || WARM.sunset;
  base.sunI = sun.intensity; base.hemiI = hemi.intensity; base.ground = hemi.groundColor.clone(); base.sky = hemi.color.clone();
  base.warm = srgb(new THREE.Color(), w.warm); base.warmK = w.k; base.hi = w.hi; base.day = name;
  base.lamps = lampK;
  const tint = { sunset: [0.8, 0.87, 1.0], day: [0.86, 0.92, 1.0], night: [0.78, 0.86, 1.0] }[name] || [0.84, 0.91, 1];
  AOU.uAoTint.value.set(...tint);
  if (pools) { pools.material.opacity = lampK > 0 ? Math.min(1, 0.25 + lampK * 0.85) : 0; pools.visible = lampK > 0; }
}
const _c = new THREE.Color();
// co klatke: okno cienia, swiatlo hemisfery zalezne od wysokosci, drobna zmiennosc slonca (chmury); interior = swiatlo wnetrz, nie ruszamy
export function swUpdate(sun, sunDir, hemi, interior, pos) {
  // cienie: srodek okna przed graczem, przyciety do siatki tekseli (brak migotania krawedzi)
  camera.getWorldDirection(_F); _F.y = 0; const fl = _F.length() || 1; _F.multiplyScalar(1 / fl);
  _T.copy(P.pos); _T.x += _F.x * CFG.lead; _T.z += _F.z * CFG.lead;
  const hUp = Math.round((CFG.up + clamp(P.pos.y, 0, 160) * 0.55) / 6) * 6;
  const sc = sun.shadow.camera;
  if (hUp !== lastHalf) { sc.left = -CFG.cross; sc.right = CFG.cross; sc.top = hUp; sc.bottom = -hUp; sc.updateProjectionMatrix(); lastHalf = hUp; sun.shadow.needsUpdate = true; }
  _Z.copy(sunDir);                                   // os swiatla (od celu do slonca)
  _X.crossVectors(_UP, _Z).normalize(); _Y.crossVectors(_Z, _X);
  const tx = 2 * CFG.cross / CFG.map, ty = 2 * hUp / CFG.map;
  const a = Math.round(_T.dot(_X) / tx) * tx, b = Math.round(_T.dot(_Y) / ty) * ty, c = _T.dot(_Z);
  _T.set(0, 0, 0).addScaledVector(_X, a).addScaledVector(_Y, b).addScaledVector(_Z, c);
  sun.target.position.copy(_T); sun.target.updateMatrixWorld();
  sun.position.copy(_T).addScaledVector(sunDir, CFG.dist);
  sun.shadow.bias = CFG.bias; sun.shadow.normalBias = CFG.normalBias;
  if (interior || !base.ground) return;
  // swiatlo odbite od scian: nisko w wawozie ulicy cieplej i ciemniej, wysoko ponad dachami jasniej i chlodniej
  const hh = clamp(P.pos.y / 130, 0, 1);
  hemi.intensity = base.hemiI * (0.82 + 0.28 * hh);
  hemi.groundColor.copy(base.ground).lerp(base.warm, base.warmK * (1 - hh * 0.65));
  if (base.day !== 'night') {
    const t = G.time; const n = 0.5 + 0.25 * Math.sin(t * 0.045) + 0.15 * Math.sin(t * 0.113 + 1.7) + 0.1 * Math.sin(t * 0.021 + 4);
    sun.intensity = base.sunI * (1 - CFG.cloud * (1 - n));
  }
  actorBlobs();
}

// ---------------------------------------------------------------- cienie kontaktowe (blob AO)
let blobTex = null, poolTex = null;
function radialTex(stops) {
  const c = cv(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  for (const [o, col] of stops) g.addColorStop(o, col);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return canvasTex(c);
}
function blobMesh(n) {
  if (!blobTex) blobTex = radialTex([[0, 'rgba(0,0,0,.62)'], [0.45, 'rgba(0,0,0,.4)'], [0.8, 'rgba(0,0,0,.1)'], [1, 'rgba(0,0,0,0)']]);
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ map: blobTex, color: 0x0a0e1c, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  mat.userData.lin = true; // kolor juz liniowy: nie przeliczaj
  mat.color.setHex(0x0a0e1c).convertSRGBToLinear();
  const m = new THREE.InstancedMesh(geo, mat, n);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.renderOrder = 1; m.castShadow = false; m.receiveShadow = false;
  scene.add(m); return m;
}
const _o = new THREE.Object3D();
const pedBlobs = { m: null, n: 0 }, actBlobs = { m: null };
// przechodnie: miasto.js wola begin / add / end w updatePeds
export function pedBlobBegin() { if (!pedBlobs.m) pedBlobs.m = blobMesh(400); pedBlobs.n = 0; }
export function pedBlobAdd(x, z, yaw, sc) {
  const m = pedBlobs.m, k = pedBlobs.n; if (k >= 400) return;
  _o.position.set(x, SW_H + 0.025, z); _o.rotation.set(0, yaw, 0); _o.scale.set(0.95 * sc, 1, 0.7 * sc); _o.updateMatrix();
  m.setMatrixAt(k, _o.matrix); pedBlobs.n++;
}
export function pedBlobEnd() { const m = pedBlobs.m; if (!m) return; m.count = pedBlobs.n; m.instanceMatrix.needsUpdate = true; }
// gracz i bandyci
function actorBlobs() {
  if (!actBlobs.m) actBlobs.m = blobMesh(64);
  const m = actBlobs.m; let k = 0;
  const put = (x, y, z, rx, rz, yaw) => { _o.position.set(x, y + 0.03, z); _o.rotation.set(0, yaw, 0); _o.scale.set(rx, 1, rz); _o.updateMatrix(); m.setMatrixAt(k++, _o.matrix); };
  if (!P.dead && (P.state === 'ground' || P.state === 'crouch' || P.state === 'roll') && P.pos.y < 400) put(P.pos.x, P.pos.y, P.pos.z, 1.05, 0.85, P.heading || 0);
  for (const e of enemies) {
    if (k >= 60) break;
    if (e.gone || !e.pos || e.air) continue;
    const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; if (dx * dx + dz * dz > 80 * 80) continue;
    const s = (e.scale || 1) * (e.dead ? 1.5 : 1.0);
    put(e.pos.x, e.pos.y, e.pos.z, 1.0 * s, 0.8 * s, e.yaw || 0);
  }
  m.count = k; m.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- statyczne: blob pod slupami + poswiata latarni na ziemi
let pools = null;
// lampy: [x, z, yaw, h] jak w ulica.js (glowica wysunieta o 2.45 m w bok od slupa)
export function swBuildStatic(lamps) {
  if (!lamps || !lamps.length) return;
  const n = lamps.length;
  const sm = blobMesh(n); sm.frustumCulled = false;
  lamps.forEach(([x, z], i) => { _o.position.set(x, SW_H + 0.025, z); _o.rotation.set(0, 0, 0); _o.scale.set(1.5, 1, 1.5); _o.updateMatrix(); sm.setMatrixAt(i, _o.matrix); });
  sm.count = n; sm.instanceMatrix.needsUpdate = true; sm.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  // plama swiatla na asfalcie: plaski, addytywny dysk z gradientem (nie swiatlo dynamiczne); wygasa z odlegloscia od kamery
  if (!poolTex) poolTex = radialTex([[0, 'rgba(255,196,120,.85)'], [0.25, 'rgba(255,170,90,.5)'], [0.6, 'rgba(255,140,60,.16)'], [1, 'rgba(255,120,40,0)']]);
  const mat = new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  mat.userData.lin = true;
  mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', 'gl_FragColor.a *= 1.0 - smoothstep(35.0, 150.0, fogDepth);'); };
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const m = new THREE.InstancedMesh(geo, mat, n);
  lamps.forEach(([x, z, yaw], i) => { _o.position.set(x + Math.cos(yaw) * 2.45, SW_H + 0.03, z - Math.sin(yaw) * 2.45); _o.rotation.set(0, 0, 0); _o.scale.set(15, 1, 15); _o.updateMatrix(); m.setMatrixAt(i, _o.matrix); });
  m.count = n; m.frustumCulled = false; m.renderOrder = 2; m.visible = false; m.castShadow = false; m.receiveShadow = false;
  scene.add(m); pools = m;
}
