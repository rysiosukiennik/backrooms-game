// Scenki poziomu 5 Fisk Tower: wstep (notatnik, szyba pancerna, dzialka), rozbicie szyby i upadek z wiezy.
// Kamera i ruch modeli liczone sa w ukladzie pokoju (u wzdluz sciany, v w glab), wiec dziala przy kazdym obrocie wiezy.
// Kontekst z fisk.js: { room, fy (wysokosc podlogi pietra), fisk (model Kingpina H), hooks: { glassDrop(p), cannonsUp(p), cannonsHide(), flashFront() }, onEnd }
import { V3, clamp, lerp } from './util.js';
import { P, G, camera, scene } from './stan.js';
import { sfx } from './dzwiek.js';
import { newPose, zeroPose, mixPose, applyPose, buildSpider, heroLandPose, runPose, idlePose } from './postac.js';
import { glassBurst, heroLand, burst } from './efekty.js';

const ease = t => t * t * (3 - 2 * t), sm = (a, b, x) => ease(clamp((x - a) / (b - a), 0, 1));

function geo(ctx) {
  const R = ctx.room, fy = ctx.fy, [ox, oz] = R.W(0, 0);
  const wp = (u, v, h = 0) => { const [x, z] = R.W(u, v); return new V3(x, fy + h, z); };
  const yaw = (du, dv) => { const [x, z] = R.W(du, dv); return Math.atan2(x - ox, z - oz); };
  return { R, fy, wp, yaw, cd: R.cd, vg: R.cd - 7, set: (u, v, h) => camera.position.copy(wp(u, v, h)), look: (u, v, h) => camera.lookAt(wp(u, v, h)) };
}

// poza Fiska: siedzi i pisze (w = 0) -> stoi (w = 1); arm: reka z pilotem uniesiona (0..1)
const FP = newPose(), FS = newPose();
function fiskPose(H, w, T, arm = 0, shock = 0) {
  zeroPose(FP); zeroPose(FS);
  FP.by = -0.46; FP.bp = 0.22; FP.hLx = -1.5; FP.hRx = -1.5; FP.kL = 1.5; FP.kR = 1.5; FP.sLx = -0.85; FP.eL = -1.15; FP.sRx = -1.0; FP.eR = -1.25 + Math.sin(T * 9) * 0.07; FP.hx = 0.5; FP.hLz = 0.08; FP.hRz = -0.08;
  idlePose(FS, T, false); FS.sLz = 0.3; FS.sRz = -0.3; FS.eL = -0.3; FS.eR = -0.3; FS.hx = -0.05;
  mixPose(FP, FS, w);
  if (arm > 0) { FP.sRx += (-1.5 - FP.sRx) * arm; FP.eR += (-1.0 - FP.eR) * arm; FP.sRz += (-0.25 - FP.sRz) * arm; FP.hx -= 0.2 * arm; }
  if (shock > 0) { FP.sLz += (0.95 - FP.sLz) * shock; FP.sRz += (-0.95 - FP.sRz) * shock; FP.eL = -0.5; FP.eR = -0.5; FP.hx -= 0.25 * shock; FP.bp -= 0.15 * shock; }
  applyPose(H, FP);
}
const punch = (p, T, ph, lean) => { // bojowka w locie: tulow pochylony, rece na zmiane
  zeroPose(p); p.bp = lean; p.hLx = -0.75; p.kL = 0.95; p.hRx = -0.25; p.kR = 0.5; p.hLz = 0.15; p.hRz = -0.15;
  const a = Math.sin(T * 5.2 + ph), b = Math.sin(T * 5.2 + ph + Math.PI);
  p.sRx = -1.25 - Math.max(0, a) * 0.95; p.eR = -0.3 - Math.max(0, -a) * 0.9; p.sLx = -1.25 - Math.max(0, b) * 0.95; p.eL = -0.3 - Math.max(0, -b) * 0.9; p.hx = -0.2; p.spy = a * 0.35; p.sRz = -0.2; p.sLz = 0.2;
};

export function sceneFisk5() {
  return {
    // ---------------------------------------------------------------- wstep: notatnik, szyba, pilot, dzialka
    fisk5a: ctx => {
      const g = geo(ctx), { R, wp, yaw, set, look, vg, cd } = g, H = ctx.fisk, hk = ctx.hooks, fpos = wp(0, cd - 1.95, 0), FY = yaw(0, -1);
      const peter = v => { P.pos.copy(wp(0, v, 0.02)); P.heading = yaw(0, 1); P.state = 'ground'; };
      const walk = on => { const f = wp(0, 1, 0).sub(wp(0, 0, 0)); P.vel.copy(f).multiplyScalar(on ? 3.4 : 0); };
      const fisk = (w, arm = 0) => { H.root.visible = true; H.root.position.copy(fpos); H.root.rotation.set(0, FY, 0); fiskPose(H, w, G.time, arm); };
      return [
        { dur: 4.6, say: ['fisk5_01'], text: 'SZCZYT FISK TOWER', sub: 'Ostatnie piętro. Gabinet Kingpina.', enter: () => { peter(4.8); walk(false); hk.glassDrop(0); hk.cannonsUp(0); }, at: t => {
          peter(4.8); fisk(0);
          set(-1.9, lerp(1.2, 6.0, ease(t)), 1.65); look(0, cd - 2.1, 1.25); camera.fov = 38;
        } },
        { dur: 3.4, say: ['fisk5_02'], text: '', sub: '', at: t => {
          peter(lerp(4.8, 8.2, t)); walk(t < 0.9); fisk(sm(0.12, 0.6, t));
          set(-2.7, cd - 6.4, 1.5); look(0, cd - 2.0, lerp(1.0, 1.6, ease(t))); camera.fov = 40;
          hk.glassDrop(sm(0.4, 1.0, t));
        } },
        { dur: 3.0, say: ['fisk5_03'], text: '', sub: '', enter: () => { sfx('slam', 0.5); }, at: t => {
          peter(lerp(8.2, vg - 3.2, sm(0, 0.7, t))); walk(t < 0.7); fisk(1); hk.glassDrop(1);
          set(1.1, vg - 6.2, 1.85); look(0, vg + 1.8, 1.45); camera.fov = 44;
        } },
        { dur: 3.6, say: ['fisk5_04'], text: '', sub: '', at: t => {
          peter(vg - 3.2); walk(false); fisk(1, sm(0.25, 0.5, t)); hk.glassDrop(1);
          set(lerp(-5.4, -4.2, ease(t)), vg - 1.0, 1.35); look(0, cd - 2.2, 1.5); camera.fov = 40;
          hk.cannonsUp(sm(0.55, 1, t));
        } },
      ];
    },

    // ---------------------------------------------------------------- szyba pekla: Fisk rzuca sie na Spider-Mana i wypadaja przez okno
    fisk5b: ctx => {
      const g = geo(ctx), { R, wp, yaw, set, look, vg, cd } = g, H = ctx.fisk, hk = ctx.hooks, FY = yaw(0, -1);
      const peter = (v, u = 0) => { P.pos.copy(wp(u, v, 0.02)); P.heading = yaw(0, 1); };
      let burstDone = false;
      const fisk = (v, mode, T) => {
        H.root.visible = true; H.root.position.copy(wp(0, v, 0)); H.root.rotation.set(0, FY, 0);
        if (mode === 'shock') fiskPose(H, 1, G.time, 0, 1);
        else { const q = FP; zeroPose(q); runPose(q, T * 11, 1, true); q.bp = 0.7; q.sLx = -1.3; q.sRx = -1.3; q.eL = -0.3; q.eR = -0.3; q.hx = 0.1; applyPose(H, q); }
      };
      return [
        { dur: 2.8, say: ['fisk5_05'], text: '', sub: '', enter: () => { hk.cannonsHide(); peter(vg - 3.0); P.vel.set(0, 0, 0); P.state = 'ground'; }, at: t => {
          fisk(cd - 4.6, 'shock'); peter(vg - 3.0);
          set(lerp(2.6, 1.3, ease(t)), vg + 0.2, 1.75); look(0, cd - 4.6, 1.75); camera.fov = lerp(44, 36, t);
        } },
        { dur: 3.2, say: ['fisk5_06'], text: '', sub: '', at: t => {
          fisk(cd - 4.6, 'shock'); peter(vg - 3.0);
          set(2.6, vg + 0.3, 1.5); look(0.1, vg - 3.0, 1.62 + t * 0.05); camera.fov = 36;
        } },
        { dur: 2.4, say: ['fisk5_07'], text: '', sub: '', at: t => {
          const v = lerp(cd - 4.6, vg - 1.6, sm(0.3, 1, t)); fisk(v, t < 0.3 ? 'shock' : 'run', t); peter(vg - 3.0);
          set(lerp(-0.9, -0.5, t), vg - 5.4, lerp(0.7, 1.0, t)); look(0, v, 1.6); camera.fov = lerp(48, 58, ease(t));
        } },
        { dur: 1.8, say: [], text: '', sub: '', enter: () => { sfx('slam', 0.8); }, at: t => {
          const pv = lerp(vg - 2.6, 1.0, ease(t)), fv = pv + 1.15; peter(pv); fisk(fv, 'run', t);
          P.state = 'air'; P.vel.set(0, 0, 0); P.heading = yaw(0, -1);
          set(8.5, lerp(vg - 4, 3, ease(t)), 1.5); look(0, lerp(vg - 2.6, 1.0, ease(t)) + 0.6, 1.45); camera.fov = 50;
          if (t > 0.9 && !burstDone) { burstDone = true; const w = wp(0, 0.1, 2.3), q = wp(0, -1, 2.3).sub(w).normalize(); glassBurst(w.x, w.y, w.z, q.x, 0.2, q.z, 70); glassBurst(w.x, w.y - 1, w.z, q.x, 0.1, q.z, 50); sfx('glass', 1.2); G.shake = 0.7; hk.flashFront(); }
        } },
      ];
    },

    // ---------------------------------------------------------------- DLUGI upadek z wiezy: walka w locie, ujecia z boku, z gory, zwolnione tempo, ladowanie
    fiskFall: ctx => {
      const g = geo(ctx), { R, wp, yaw, fy } = g, H = ctx.fisk;
      const o = wp(0, 0, 0), q = wp(0, -1, 0), out = new V3(q.x - o.x, 0, q.z - o.z).normalize(), side = new V3(-out.z, 0, out.x);
      const start = wp(0, -0.8, 1.3), y0 = fy + 1.3, GY = 1.0;
      const sp2 = buildSpider(P.suit); sp2.setHands('fist', 'fist'); scene.add(sp2.root); P.H.root.visible = false;
      const pf = newPose(), pp = newPose();
      const wind = []; { const gm = new THREE.BoxGeometry(0.02, 2.6, 0.02), mt = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false });
        for (let i = 0; i < 34; i++) { const m = new THREE.Mesh(gm, mt); m.userData.o = new V3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 16); m.visible = false; m.frustumCulled = false; scene.add(m); wind.push(m); } }
      let lastNow = performance.now(), landed = false, shardT = 0;
      const starts = [0, 2.8, 6.0, 9.2, 11.8];
      const Tp = T => T < 9.2 ? T : T < 11.8 ? 9.2 + (T - 9.2) * 0.3 : 9.98 + (T - 11.8);   // zwolnione tempo ruchu w kluczowym momencie
      const TL = 10.5, prog = T => clamp(Tp(T) / TL, 0, 1);
      const Cpos = T => { const x = prog(T), h = 6.5 * (1 - Math.pow(1 - x, 3)), y = lerp(y0, GY, Math.pow(x, 1.7)); return new V3(start.x + out.x * h, y, start.z + out.z * h); };
      const body = (Hh, C, off, rx, ry, rz) => {
        const e = new THREE.Euler(rx, ry, rz, 'YXZ'), qq = new THREE.Quaternion().setFromEuler(e), sc = Hh.root.scale.y, d = new V3(0, -0.95 * sc, 0).applyQuaternion(qq);
        Hh.root.position.copy(C).add(off).add(d); Hh.root.quaternion.copy(qq);
      };
      const frame = (T, i, t) => {
        const now = performance.now(), dt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
        const C = Cpos(T), x = prog(T), ph = Tp(T) * 1.3;
        H.root.visible = true; sp2.root.visible = true;
        if (x < 1) {
          const rx = new V3(Math.cos(ph), 0.12 * Math.sin(2 * ph), Math.sin(ph)).multiplyScalar(0.62);
          const fyaw = Math.atan2(-rx.x, -rx.z), pyaw = fyaw + Math.PI;
          punch(pf, T, 0, 0.45); punch(pp, T, 1.7, 0.3); applyPose(H, pf); applyPose(sp2, pp);
          body(H, C, rx, 0.35 + 0.25 * Math.sin(T * 0.8), fyaw + 0.4, 0.5 * Math.sin(T * 0.6));
          body(sp2, C, rx.clone().negate(), -0.25 + 0.3 * Math.sin(T * 0.9 + 1), pyaw - 0.4, 0.6 * Math.sin(T * 0.7 + 2));
          shardT -= dt; if (shardT <= 0 && i >= 1 && i <= 3) { shardT = 0.55; glassBurst(C.x, C.y + 0.3, C.z, -out.x * 0.3, 0.1, -out.z * 0.3, 8); }
        } else {
          const Cg = Cpos(99);
          zeroPose(pf); pf.by = 0.0; applyPose(H, pf); H.root.position.set(Cg.x + side.x * 1.1, 0.15 + 0.2, Cg.z + side.z * 1.1); H.root.rotation.set(-Math.PI / 2, Math.atan2(out.x, out.z), 0, 'YXZ');
          zeroPose(pp); heroLandPose(pp); applyPose(sp2, pp); sp2.root.position.set(Cg.x - side.x * 1.0, 0.0, Cg.z - side.z * 1.0); sp2.root.rotation.set(0, Math.atan2(side.x, side.z), 0);
        }
        // wiatr: kreski przesuwaja sie w gore wzgledem kamery
        const on = i >= 1 && i <= 3 && x < 1;
        for (const m of wind) {
          m.visible = on; if (!on) continue;
          const oo = m.userData.o; oo.y += dt * (14 + Math.abs(oo.x) * 0.4); if (oo.y > 9) oo.y -= 18;
          m.position.set(camera.position.x + oo.x, camera.position.y + oo.y, camera.position.z + oo.z); m.scale.y = 0.7 + Math.abs(oo.x) * 0.06;
        }
        if (!landed && i === 4 && t > 0.3) { landed = true; const Cg = Cpos(99); heroLand(Cg.x, 0.15, Cg.z, 1.7); burst(Cg.x, 0.6, Cg.z, 30, 0xd9d2c4, 7); sfx('slam', 1); sfx('land', 1); G.shake = 1.0; }
        return C;
      };
      ctx.cleanup = () => { scene.remove(sp2.root); for (const m of wind) scene.remove(m); P.H.root.visible = true; };
      const tt = (i, t, durs) => starts[i] + t * durs;
      return [
        { dur: 2.8, say: [], text: '', sub: '', enter: () => { const w = wp(0, -0.3, 1.8); glassBurst(w.x, w.y, w.z, out.x, 0.1, out.z, 80); sfx('glass', 1.1); }, at: t => {
          const C = frame(tt(0, t, 2.8), 0, t);
          camera.position.set(start.x + out.x * 17 + side.x * 3.5, 4.0, start.z + out.z * 17 + side.z * 3.5); camera.lookAt(C.x, lerp(C.y + 3, C.y, ease(t)), C.z); camera.fov = 56;
        } },
        { dur: 3.2, say: [], text: '', sub: '', at: t => {
          const C = frame(tt(1, t, 3.2), 1, t);
          camera.position.set(C.x + side.x * 9.5 - out.x * 0.5, C.y + 0.6, C.z + side.z * 9.5 - out.z * 0.5); camera.lookAt(C); camera.fov = 48;
        } },
        { dur: 3.2, say: [], text: '', sub: '', at: t => {
          const C = frame(tt(2, t, 3.2), 2, t);
          camera.position.set(C.x - out.x * 0.9, C.y + 6.6, C.z - out.z * 0.9); camera.lookAt(C.x, C.y - 3, C.z); camera.fov = 64;
        } },
        { dur: 2.6, say: [], text: '', sub: '', at: t => {
          const C = frame(tt(3, t, 2.6), 3, t), a = lerp(0.2, 1.5, ease(t));
          camera.position.set(C.x + (side.x * Math.cos(a) + out.x * Math.sin(a)) * 4.2, C.y + 0.4, C.z + (side.z * Math.cos(a) + out.z * Math.sin(a)) * 4.2); camera.lookAt(C); camera.fov = 38;
        } },
        { dur: 1.9, say: [], text: '', sub: '', at: t => {
          const C = frame(tt(4, t, 1.9), 4, t), Cg = Cpos(99);
          camera.position.set(Cg.x + side.x * 2.5 + out.x * 9, 3.6, Cg.z + side.z * 2.5 + out.z * 9); camera.lookAt(Cg.x, lerp(C.y, 1.0, t) , Cg.z); camera.fov = 46;
        } },
      ].map(s => s);
    },
  };
}
