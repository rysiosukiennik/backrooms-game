// Start gry i glowna petla: stan menu / gra / pauza, kamera trzecioosobowa, poswiata (bloom).
import { V3, clamp, lerp, damp, angLerp, save, doSave, dbg } from './util.js';
import { G, P, cam, scene, camera, renderer, canvas, hooks, zglosBlad, pixelRatio } from './stan.js';
import { buildCity, updateTraffic, updateEnv, raycastCity, setTOD } from './miasto.js';
import { initPlayer, updatePlayer, updatePlayerVisual } from './gracz.js';
import { initFX, updateFX, spawnCrime, updateEnemies, updateCrimes, updateShots, initBags, updateBags } from './wrogowie.js';
import { initMissions, updateMissions } from './misje.js';
import { playCine, updateCine } from './scenki.js';
import { initUI, updateHUD, updateMenu, updatePause, openPause, showHUD, showMsg, key } from './ui.js';
import { pollPads, gameInput, endFrame, lockMouse, pad } from './wejscie.js';
import { initAudio, setWind, setMusic, cityAmbience } from './dzwiek.js';

try {
  buildCity();
  setTOD(save.tod);
  initFX();
  initPlayer();
  initBags();
  initMissions();
  initUI();
  for (let i = 0; i < 5; i++) spawnCrime(true);
} catch (e) { zglosBlad(e); throw e; }
document.getElementById('ladowanie')?.remove(); // gra gotowa — zdejmujemy ekran ladowania
setMusic(save.music);

// ---------------------------------------------------------------- poswiata (bloom) — tylko noca i na wysokiej grafice
// (w dzien prawie jej nie widac, a kosztuje kilka pelnoekranowych przebiegow)
let composer = null, bloom = null;
function setupComposer() {
  composer = null; bloom = null;
  if (save.gfx !== 'high' || save.tod !== 'night' || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
  try {
    composer = new THREE.EffectComposer(renderer); composer.setPixelRatio(renderer.getPixelRatio());
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 0.85);
    composer.addPass(bloom);
    // przy renderowaniu do bufora kolory sa liniowe — na koniec zamiana na ekranowe (sRGB)
    if (THREE.GammaCorrectionShader) composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    tuneBloom();
  } catch (e) { composer = null; }
}
function tuneBloom() {
  if (!bloom) return;
  const n = save.tod === 'night';
  bloom.strength = n ? 0.5 : 0.3; bloom.threshold = n ? 0.85 : 0.9;
}
setupComposer();

// slup swiatla nad wlasnym znacznikiem z mapy
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 600, 16, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x3fe3ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
beacon.visible = false; scene.add(beacon);

hooks.start = mode => {
  G.mode = mode; initAudio();
  showHUD(true); G.state = 'play';
  if (!G.started) {
    G.started = true; P.perch = false;
    cam.yaw = P.heading + Math.PI - 0.6; cam.pitch = -0.3; cam.dist = 6; cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0));
    P.perch = true; // wstep filmowy: Spider-Man przycupniety na szczycie wiezowca
    playCine('intro', { onEnd: () => { P.perch = false; cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0)); showMsg('NOWY JORK', `Zeskocz z wieżowca i przytrzymaj ${key('swing')} w powietrzu, żeby się bujać`, 6); } });
  }
  if (!G.cine) P.perch = false;
  if (mode === 'kb') lockMouse();
  else if (!pad.connected) showMsg('NIE WYKRYTO PADA', 'Podłącz pada i naciśnij na nim dowolny przycisk', 4);
};
hooks.toMenu = () => {
  G.state = 'menu'; showHUD(false);
  if (document.pointerLockElement) document.exitPointerLock();
};
hooks.gfx = () => {
  save.gfx = save.gfx === 'high' ? 'low' : 'high'; doSave();
  resScale = 1; renderer.setPixelRatio(pixelRatio());
  renderer.shadowMap.enabled = save.gfx === 'high';
  scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.needsUpdate = true); });
  setupComposer();
};
hooks.tod = () => {
  const order = ['sunset', 'night', 'day'];
  save.tod = order[(order.indexOf(save.tod) + 1) % order.length]; doSave();
  setTOD(save.tod); setupComposer();
};
hooks.music = () => { save.music = !save.music; doSave(); setMusic(save.music); };

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && G.state === 'play' && G.mode === 'kb') openPause('game', false);
});
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  if (composer) composer.setSize(innerWidth, innerHeight);
});

// ---------------------------------------------------------------- kamera
const _f = new V3(), _b = new V3(), _v = new V3();
function camLook(dt, I) {
  const lx = I.plx * 2.7 * dt + I.mdx * 0.0024, ly = I.ply * 1.9 * dt + I.mdy * 0.0024;
  cam.yaw -= lx; cam.pitch = clamp(cam.pitch - ly, -1.3, 0.9);
  if (Math.abs(lx) + Math.abs(ly) > 1e-4) cam.idle = 0; else cam.idle += dt;
}
function camFollow(dt) {
  const hs = Math.hypot(P.vel.x, P.vel.z), sp = P.vel.length();
  // kamera sama ustawia sie za plecami przy szybkim ruchu
  if (cam.idle > 0.7 && hs > 7 && P.state !== 'wall' && !P.lunge && !P.fin) {
    cam.yaw = angLerp(cam.yaw, Math.atan2(-P.vel.x, -P.vel.z), damp(1.4, dt));
    cam.pitch = lerp(cam.pitch, P.state === 'swing' ? -0.12 : -0.2, damp(1, dt));
  }
  _v.set(P.pos.x, P.pos.y + 1.4, P.pos.z);
  cam.tgt.lerp(_v, damp(20, dt));
  const boss = G.boss && G.boss.pos.distanceTo(P.pos) < 40;
  const want = 5.5 + clamp(sp / 55, 0, 1) * 3.5 + (P.state === 'wall' ? 1 : 0) + (boss ? 4 : 0) + (P.fin ? 1.5 : 0);
  cam.dist = lerp(cam.dist, want, damp(3, dt));
  const cp = Math.cos(cam.pitch);
  _f.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
  _b.copy(_f).negate();
  let d = cam.dist; const t = raycastCity(cam.tgt, _b, d + 0.3);
  if (t < d + 0.3) d = Math.max(0.8, t - 0.4);
  camera.position.copy(cam.tgt).addScaledVector(_b, d);
  if (camera.position.y < 0.4) camera.position.y = 0.4;
  camera.lookAt(cam.tgt);
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 1.8);
    const s = G.shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; camera.position.z += (Math.random() - 0.5) * s;
  }
  const fov = 68 + clamp(sp / 60, 0, 1) * 16;
  if (Math.abs(fov - camera.fov) > 0.05) { camera.fov = lerp(camera.fov, fov, damp(3, dt)); camera.updateProjectionMatrix(); }
}
function menuCam(dt) {
  const h = P.heading, a = Math.sin(G.time * 0.15) * 0.7, r = P.perch ? 4.2 : 6;
  camera.position.set(P.pos.x - Math.sin(h + a) * r, P.pos.y + 1.5, P.pos.z - Math.cos(h + a) * r);
  camera.lookAt(P.pos.x + Math.sin(h) * 12, P.pos.y + (P.perch ? -1.5 : 1), P.pos.z + Math.cos(h) * 12);
  if (camera.fov !== 60) { camera.fov = 60; camera.updateProjectionMatrix(); }
}

// Plynnosc: co 2 sekundy mierzymy klatki. Za wolno -> mniejsza rozdzielczosc (do 60%),
// duzy zapas -> wieksza. Dopiero gdy nawet to nie pomaga, przechodzimy na niska grafike.
let resScale = 1, spT = 0, spN = 0, lowWarn = 0;
function applyRes() {
  renderer.setPixelRatio(pixelRatio() * resScale);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
}
function checkSpeed(rdt) {
  if (document.hidden) return;
  spT += rdt; spN++;
  if (spT < 2) return;
  const fps = spN / spT; spT = 0; spN = 0;
  if (dbg('fixres')) return;
  if (fps < 40 && resScale > 0.6) { resScale = Math.max(0.6, resScale - 0.1); applyRes(); }
  else if (fps > 56 && resScale < 1) { resScale = Math.min(1, resScale + 0.1); applyRes(); }
  else if (fps < 24 && resScale <= 0.6 && save.gfx === 'high' && ++lowWarn >= 2) {
    hooks.gfx(); showMsg('GRAFIKA: NISKA', 'Przełączyłem, żeby gra działała płynniej (zmienisz w Pauza → Gra)', 4);
  }
}

// ---------------------------------------------------------------- petla
let last = performance.now();
function step(now) {
  const rdt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
  pollPads();
  let dt = rdt;
  if (G.slowT > 0) { G.slowT -= rdt; dt = rdt * 0.35; }
  G.time += dt;

  if (G.state === 'play' && G.cine) {
    updateCine(rdt);
  } else if (G.state === 'play') {
    const I = gameInput();
    if (I.pauseP) openPause('game', false);
    else if (I.mapP) openPause('map', false);
    else {
      camLook(rdt, I);
      updatePlayer(dt, I);
      updateEnemies(dt); updateCrimes(dt); updateShots(dt); updateBags(dt); updateMissions(dt);
      camFollow(rdt);
      updateHUD(rdt);
      setWind(P.vel.length());
      cityAmbience(rdt, P.pos.y < 30);
      checkSpeed(rdt);
    }
  } else if (G.state === 'menu') { updateMenu(rdt); menuCam(rdt); setWind(0); }
  else if (G.state === 'pause') { updatePause(rdt); setWind(0); }

  if (G.state !== 'pause') { updateTraffic(dt); updateFX(dt); updatePlayerVisual(dt); }
  if (G.wp) { beacon.visible = true; beacon.position.set(G.wp.x, 300, G.wp.z); } else beacon.visible = false;
  updateEnv();
  if (composer) composer.render(); else renderer.render(scene, camera);
  endFrame();
}
let zepsute = false;
function loop(now) {
  requestAnimationFrame(loop);
  if (zepsute) return;
  try { step(now); } catch (e) { zepsute = true; zglosBlad(e); }
}
requestAnimationFrame(loop);
// podglad stanu w konsoli przegladarki (do testow)
window.SPIDER = { G, P, cam, hooks, res: () => resScale, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), tick: (n, ms = 1000 / 60) => { for (let i = 0; i < n; i++) step(last + ms); } };
