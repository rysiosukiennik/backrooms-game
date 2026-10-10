(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // js/util.js
  function wrapA(a) {
    return ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  }
  function angLerp(a, b, t) {
    return a + wrapA(b - a) * t;
  }
  function srand() {
    seed = seed * 16807 % 2147483647;
    return (seed - 1) / 2147483646;
  }
  function cv(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  function canvasTex(c, rep) {
    const t = new THREE.CanvasTexture(c);
    if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function linearize(root) {
    root.traverse((o) => {
      for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : []) {
        if (m.isShaderMaterial || m.userData.lin) continue;
        m.userData.lin = true;
        if (m.color) m.color.convertSRGBToLinear();
        if (m.emissive) m.emissive.convertSRGBToLinear();
      }
      if (o.isInstancedMesh && o.instanceColor && !o.userData.linIC) {
        o.userData.linIC = true;
        const a = o.instanceColor.array, c = new THREE.Color();
        for (let i = 0; i < a.length; i += 3) {
          c.setRGB(a[i], a[i + 1], a[i + 2]).convertSRGBToLinear();
          a[i] = c.r;
          a[i + 1] = c.g;
          a[i + 2] = c.b;
        }
        o.instanceColor.needsUpdate = true;
      }
      if (o.isLight && !o.userData.lin) {
        o.userData.lin = true;
        o.color.convertSRGBToLinear();
        if (o.groundColor) o.groundColor.convertSRGBToLinear();
      }
    });
  }
  function resetProgress() {
    const keep = { gfx: save.gfx, tod: save.tod, music: save.music };
    Object.assign(save, { lvl: 1, xp: 0, suit: "adv", bags: [], crimes: 0, skills: [], races: {}, bossWins: 0, chases: 0, fisk: 0, pos: null, hd: 0, hasGame: false, savedAt: 0, colas: 0 }, keep);
    doSave();
  }
  function doSave() {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch (e) {
    }
  }
  var V3, UP, DOWN, rnd, clamp, lerp, damp, seed, sr, $, linHex, KEY, save, QS, dbg;
  var init_util = __esm({
    "js/util.js"() {
      V3 = THREE.Vector3;
      UP = new V3(0, 1, 0);
      DOWN = new V3(0, -1, 0);
      rnd = (a, b) => a + Math.random() * (b - a);
      clamp = (v, a, b) => v < a ? a : v > b ? b : v;
      lerp = (a, b, t) => a + (b - a) * t;
      damp = (k, dt) => 1 - Math.exp(-k * dt);
      seed = 20180907;
      sr = (a, b) => a + srand() * (b - a);
      $ = (id) => document.getElementById(id);
      linHex = (c, hex) => c.setHex(hex).convertSRGBToLinear();
      KEY = "spiderman_nyc_v1";
      save = {
        lvl: 1,
        xp: 0,
        suit: "adv",
        bags: [],
        crimes: 0,
        gfx: "high",
        skills: [],
        races: {},
        bossWins: 0,
        chases: 0,
        fisk: 0,
        pos: null,
        hd: 0,
        hasGame: false,
        savedAt: 0,
        tod: "sunset",
        music: true
      };
      try {
        Object.assign(save, JSON.parse(localStorage.getItem(KEY) || "{}"));
      } catch (e) {
      }
      QS = new URLSearchParams(location.search);
      dbg = (k) => QS.has(k);
    }
  });

  // js/stan.js
  function zglosBlad(e) {
    let m = e && e.message || String(e);
    if (/WebGL/i.test(m)) m += "\n\nPrzegl\u0105darka nie mo\u017Ce rysowa\u0107 grafiki 3D. W Edge: Ustawienia \u2192 System \u2192 w\u0142\u0105cz \u201EU\u017Cyj przyspieszenia sprz\u0119towego, gdy jest dost\u0119pne\u201D i uruchom przegl\u0105dark\u0119 ponownie.";
    const gdzie = e && e.stack ? "\n\n" + e.stack.split("\n").slice(1, 3).join("\n") : "";
    if (window.pokazBlad) window.pokazBlad(m + gdzie);
    else console.error(e);
  }
  var canvas, r0, renderer, pixelRatio, scene, _add, camera, G, P, cam, enemies, crimes, hooks;
  var init_stan = __esm({
    "js/stan.js"() {
      init_util();
      canvas = document.createElement("canvas");
      canvas.id = "c";
      document.body.prepend(canvas);
      try {
        r0 = new THREE.WebGLRenderer({ canvas, antialias: true });
      } catch (e) {
        zglosBlad(e);
        throw e;
      }
      renderer = r0;
      pixelRatio = () => Math.max(1, Math.min(window.devicePixelRatio || 1, save.gfx === "high" ? 1.5 : 1));
      renderer.setPixelRatio(pixelRatio());
      canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        save.gfx = "low";
        try {
          localStorage.setItem("spiderman_nyc_v1", JSON.stringify(save));
        } catch (er) {
        }
        const el2 = document.createElement("div");
        el2.style.cssText = "position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#05090f;color:#fff;font:20px Arial;text-align:center;padding:20px";
        el2.innerHTML = '<b style="font-size:40px">SPIDER-MAN</b><p>Karta graficzna si\u0119 przeci\u0105\u017Cy\u0142a.<br>W\u0142\u0105czam nisk\u0105 grafik\u0119 i uruchamiam gr\u0119 ponownie\u2026</p><p style="color:#9fd8ea;font-size:17px">Je\u015Bli to si\u0119 powtarza: zamknij inne karty z grami (np. drug\u0105 kart\u0119 ze Spider-Manem, Narew) i Robloxa.</p>';
        document.body.appendChild(el2);
        setTimeout(() => location.reload(), 2500);
      }, false);
      renderer.setSize(innerWidth, innerHeight);
      renderer.shadowMap.enabled = save.gfx === "high" && !dbg("noshadow");
      renderer.shadowMap.type = THREE.PCFShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = dbg("notm") ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.physicallyCorrectLights = false;
      scene = new THREE.Scene();
      _add = scene.add.bind(scene);
      scene.add = (...objs) => {
        for (const o of objs) linearize(o);
        return _add(...objs);
      };
      camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3200);
      G = {
        state: "menu",
        mode: "kb",
        lastDev: "kb",
        time: 0,
        started: false,
        slowT: 0,
        shake: 0,
        sense: false,
        wp: null,
        pauseTab: "map",
        pauseFrom: "menu",
        menuIdx: 0,
        suitIdx: 0,
        gameIdx: 0,
        skillIdx: 0,
        missIdx: 0,
        boss: null,
        race: null,
        chase: null,
        cine: null,
        interior: null
        // aktywne misje (do HUD)
      };
      P = {
        pos: new V3(),
        vel: new V3(),
        prev: new V3(),
        state: "ground",
        heading: -Math.PI / 2,
        H: null,
        suit: null,
        pc: null,
        pt: null,
        perch: true,
        anchor: new V3(),
        rope: 0,
        ropeT: 0,
        swingT: 0,
        swingSide: 1,
        swingCD: 0,
        wallN: new V3(),
        wallBox: null,
        wallVy: 0,
        climbPh: 0,
        climbSide: 0,
        zips: 2,
        zipT: 0,
        zipPt: new V3(),
        hp: 100,
        invT: 0,
        hurtT: 0,
        regenT: 0,
        dead: false,
        deadT: 0,
        atk: null,
        atkCD: 0,
        combo: 0,
        comboT: 0,
        step: 0,
        lunge: null,
        bufPunch: 0,
        dodgeT: 0,
        dodgeCD: 0,
        dodgeDir: new V3(),
        dodgeSide: 1,
        rolling: false,
        spinning: false,
        flipT: -1,
        flipDur: 0.6,
        flipBack: false,
        landT: 0,
        landHard: false,
        runPh: 0,
        webT: 0,
        webAim: new V3(),
        webCD: 0,
        sprint: false,
        airT: 0,
        focus: 0,
        punchHold: 0,
        upDone: false,
        // skupienie (0..3), przytrzymanie ciosu
        pz: null,
        perchT: 0,
        perchPt: null,
        launchBuf: 0,
        // zaczep (point launch)
        car: null,
        // jazda na dachu auta w poscigu
        trickT: 0,
        trickType: 0,
        trickCD: 0,
        fin: null
        // triki w powietrzu, wykonczenie
      };
      cam = { yaw: 0, pitch: -0.2, dist: 6, tgt: new V3(), idle: 0 };
      enemies = [];
      crimes = [];
      hooks = {};
    }
  });

  // js/model.js
  function makeRig(b) {
    const H = {}, B = () => new THREE.Bone();
    H.root = new THREE.Group();
    H.body = B();
    H.body.position.y = 0.95;
    H.root.add(H.body);
    H.spine = B();
    H.spine.position.y = 0.06;
    H.body.add(H.spine);
    H.chest = B();
    H.chest.position.y = 0.24;
    H.spine.add(H.chest);
    H.neck = B();
    H.neck.position.y = 0.29;
    H.chest.add(H.neck);
    for (const s of [1, -1]) {
      const L = s > 0 ? "L" : "R";
      const sh = B();
      sh.position.set(0.215 * b.w * s, 0.2, 0);
      H.chest.add(sh);
      H["sh" + L] = sh;
      const el2 = B();
      el2.position.y = -0.28;
      sh.add(el2);
      H["el" + L] = el2;
      const hand = new THREE.Group();
      hand.position.y = -0.3;
      el2.add(hand);
      H["hand" + L] = hand;
      const hp = B();
      hp.position.set(0.09 * b.hips * s, -0.04, 0);
      H.body.add(hp);
      H["hip" + L] = hp;
      const kn = B();
      kn.position.y = -0.42;
      hp.add(kn);
      H["kn" + L] = kn;
      const ft = B();
      ft.position.y = -0.41;
      kn.add(ft);
      H["ft" + L] = ft;
    }
    H.bones = [H.body, H.spine, H.chest, H.neck, H.shL, H.elL, H.shR, H.elR, H.hipL, H.knL, H.ftL, H.hipR, H.knR, H.ftR];
    return H;
  }
  function smooth(ctrl, sub2) {
    ctrl = ctrl.map(norm);
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(i - 1, 0)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(i + 2, ctrl.length - 1)];
      for (let s = 0; s < sub2; s++) {
        const t = s / sub2, r = {};
        for (const k of KEYS) r[k] = cr(p0[k], p1[k], p2[k], p3[k], t);
        out.push(r);
      }
    }
    out.push({ ...ctrl[ctrl.length - 1] });
    return out;
  }
  function packW(W, sk, sw) {
    const e = Object.entries(W).filter(([, w]) => w > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4);
    let t = 0;
    for (const [, w] of e) t += w;
    for (let j = 0; j < 4; j++) {
      if (e[j]) {
        sk.push(+e[j][0]);
        sw.push(e[j][1] / t);
      } else {
        sk.push(0);
        sw.push(0);
      }
    }
  }
  function tubeData(rings, segs, vOf, wFn) {
    const pos = [], uv = [], idx = [], sk = [], sw = [];
    for (const r of rings) {
      const v = vOf(r);
      for (let i = 0; i <= segs; i++) {
        const u = i / segs, a = (u - 0.5) * TAU + Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / r.n), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / r.n);
        let rz = r.rz;
        if (s > 0) {
          rz *= 1 + r.fb * s * s;
          if (r.pec) rz *= 1 + r.pec * Math.exp(-(((Math.abs(c) - 0.42) / 0.2) ** 2)) * s;
        } else rz *= 1 + r.bb * s * s;
        const x = r.cx + r.rx * ex, z = r.cz + rz * ez;
        pos.push(x, r.y, z);
        uv.push(u, v);
        if (wFn) packW(wFn(x, r.y, z), sk, sw);
      }
    }
    const S = segs + 1;
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < segs; i++) {
      const a = k * S + i, b = a + 1, d = a + S, c = d + 1;
      idx.push(a, c, b, a, d, c);
    }
    return { pos, uv, idx, sk, sw, seams: [{ start: 0, S, R: rings.length }] };
  }
  function sweepData(pts2, rad, segs, ref, n = 2) {
    const pos = [], uv = [], idx = [];
    const S = segs + 1;
    let len = 0;
    const L = [];
    for (let k = 0; k < pts2.length; k++) {
      if (k) len += pts2[k].distanceTo(pts2[k - 1]);
      L.push(len);
    }
    for (let k = 0; k < pts2.length; k++) {
      _T.subVectors(pts2[Math.min(k + 1, pts2.length - 1)], pts2[Math.max(k - 1, 0)]).normalize();
      _N.crossVectors(_T, ref).normalize();
      _B.crossVectors(_T, _N);
      const [rx, ry] = Array.isArray(rad[k]) ? rad[k] : [rad[k], rad[k]];
      for (let i = 0; i <= segs; i++) {
        const a = i / segs * TAU, c = Math.cos(a), s = Math.sin(a);
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
        _P.copy(pts2[k]).addScaledVector(_N, ex * rx).addScaledVector(_B, ey * ry);
        pos.push(_P.x, _P.y, _P.z);
        uv.push(i / segs, L[k] / (len || 1));
      }
    }
    for (let k = 0; k < pts2.length - 1; k++) for (let i = 0; i < segs; i++) {
      const a = k * S + i, b = a + 1, c = b + S, d = a + S;
      idx.push(a, b, c, a, c, d);
    }
    return { pos, uv, idx, sk: [], sw: [], seams: [{ start: 0, S, R: pts2.length }] };
  }
  function mirror(d) {
    const pos = d.pos.slice();
    for (let i = 0; i < pos.length; i += 3) pos[i] = -pos[i];
    const idx = [];
    for (let i = 0; i < d.idx.length; i += 3) idx.push(d.idx[i], d.idx[i + 2], d.idx[i + 1]);
    return { pos, uv: d.uv.slice(), idx, sk: d.sk.map((b) => {
      var _a4;
      return (_a4 = MIRB[b]) != null ? _a4 : b;
    }), sw: d.sw.slice(), seams: d.seams };
  }
  function merge(list) {
    const o = { pos: [], uv: [], idx: [], sk: [], sw: [], seams: [] };
    for (const d of list) {
      const off = o.pos.length / 3;
      o.pos.push(...d.pos);
      o.uv.push(...d.uv);
      o.sk.push(...d.sk);
      o.sw.push(...d.sw);
      for (const i of d.idx) o.idx.push(i + off);
      for (const s of d.seams) o.seams.push({ ...s, start: s.start + off });
    }
    return o;
  }
  function toGeo(d) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(d.pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(d.uv, 2));
    if (d.sk.length) {
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(d.sk, 4));
      g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(d.sw, 4));
    }
    g.setIndex(d.idx);
    g.computeVertexNormals();
    const n = g.attributes.normal;
    for (const s of d.seams) for (let k = 0; k < s.R; k++) {
      const a = s.start + k * s.S, b = a + s.S - 1;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l);
      n.setXYZ(b, x / l, y / l, z / l);
    }
    return g;
  }
  function torsoRings(b) {
    const w = b.w, ch = b.chest, wa = b.waist, be = b.belly, pe = b.pec, hp = b.hips, nk = b.neck;
    return [
      { y: 0.79, rx: 0.03, rz: 0.03 },
      { y: 0.815, rx: 0.1 * hp, rz: 0.08 },
      { y: 0.86, rx: 0.152 * hp, rz: 0.112, bb: 0.15, cz: -6e-3, n: 2.3 },
      { y: 0.93, rx: 0.158 * hp, rz: 0.112, bb: 0.1, cz: -5e-3, n: 2.4 },
      { y: 1.01, rx: 0.147 * wa, rz: 0.1 * wa, fb: be * 0.7, n: 2.4 },
      { y: 1.09, rx: 0.14 * wa, rz: 0.098 * wa, fb: 0.04 + be, n: 2.4 },
      { y: 1.17, rx: 0.152 * ch, rz: 0.104 * ch, fb: 0.06 + be * 0.5, n: 2.4 },
      { y: 1.25, rx: 0.174 * ch * w, rz: 0.113 * ch, fb: 0.07, pec: 0.03 * pe, n: 2.5, cz: 5e-3 },
      { y: 1.33, rx: 0.192 * ch * w, rz: 0.12 * ch, fb: 0.06, pec: 0.1 * pe, n: 2.6, cz: 0.01 },
      { y: 1.4, rx: 0.208 * ch * w, rz: 0.118 * ch, fb: 0.04, pec: 0.07 * pe, n: 2.7, cz: 0.01 },
      // barki: tulow obejmuje gore ramienia, zeby nie wystawala jak kulka
      { y: 1.45, rx: 0.232 * w, rz: 0.104 * ch, n: 3 },
      { y: 1.49, rx: 0.2 * w, rz: 0.092 * ch, n: 2.6, cz: -4e-3 },
      { y: 1.525, rx: 0.135 * w, rz: 0.08 * nk, n: 2.3, cz: -4e-3 },
      { y: 1.555, rx: 0.08 * nk, rz: 0.072 * nk, cz: 4e-3 },
      { y: 1.6, rx: 0.064 * nk, rz: 0.064 * nk, cz: 0.01 },
      { y: 1.68, rx: 0.045, rz: 0.045, cz: 0.015 }
    ];
  }
  function armRings(b) {
    const a = b.arm, X = 0.215 * b.w;
    return [
      [-0.56, 0.012, 0.012],
      [-0.545, 0.028, 0.025],
      [-0.52, 0.032, 0.028],
      [-0.46, 0.037, 0.032],
      [-0.4, 0.044, 0.039],
      [-0.34, 0.049, 0.044],
      [-0.295, 0.045, 0.042],
      [-0.25, 0.048, 0.046, 0, 0, 0.05],
      [-0.18, 0.054, 0.052, 0, 0.14, 0.08],
      [-0.1, 0.059, 0.057, 3e-3, 0.1, 0.1],
      [-0.03, 0.064, 0.06, 6e-3],
      [0.01, 0.062, 0.057, 6e-3],
      [0.035, 0.046, 0.044, 4e-3],
      [0.055, 0.018, 0.018]
    ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => ({ y: SHY + t, rx: rx * a, rz: rz * a, cx: X + cx * a, fb, bb }));
  }
  function legRings(b) {
    const l = b.leg, X = 0.09 * b.hips;
    return [
      [-0.87, 0.02, 0.02],
      [-0.85, 0.036, 0.04],
      [-0.82, 0.041, 0.045],
      [-0.75, 0.045, 0.05, 0, 0, 0.1],
      [-0.66, 0.051, 0.058, 0, 0, 0.2],
      [-0.57, 0.058, 0.066, 0, 0, 0.28],
      [-0.49, 0.057, 0.062],
      [-0.44, 0.058, 0.063, 0, 0.08],
      [-0.36, 0.067, 0.072, 0, 0.12],
      [-0.26, 0.078, 0.083, 4e-3, 0.12],
      [-0.15, 0.088, 0.092, 8e-3, 0.1],
      [-0.04, 0.096, 0.098, 0.01, 0, 0.05],
      [0.05, 0.095, 0.096, 0.01],
      [0.12, 0.05, 0.05]
    ].map(([t, rx, rz, cx = 0, fb = 0, bb = 0]) => {
      const m = Math.min(l, b.hips), k = m + (l - m) * sm(-0.02, -0.3, t);
      return { y: HIPY + t, rx: rx * k, rz: rz * k, cx: X + cx, fb, bb };
    });
  }
  function headPoint(a, phi, b, face, out) {
    const hs = b.head, c = Math.cos(a), s = Math.sin(a), cp = Math.cos(phi), sp = Math.sin(phi);
    let x = 0.098 * hs * cp * c, y = 0.122 * hs * sp, z = 0.108 * hs * cp * s;
    if (sp < 0) {
      x *= 1 + 0.28 * sp;
      z *= s > 0 ? 1 + 0.05 * sp : 1 + 0.22 * sp;
    }
    if (sp > 0.1 && s < 0) z *= 1 + 0.07 * sp;
    if (face) {
      const da = a - Math.PI / 2, fa = Math.exp(-((da / 0.14) ** 2));
      z += 0.024 * hs * fa * Math.exp(-(((sp + 0.06) / 0.1) ** 2));
      z += 7e-3 * hs * Math.exp(-((da / 0.5) ** 2)) * Math.exp(-(((sp - 0.24) / 0.06) ** 2));
      z += 0.01 * hs * fa * Math.exp(-(((sp + 0.55) / 0.12) ** 2));
    }
    return out.set(x, HC + y, 0.012 + z);
  }
  function headData(b, face, segs = 40, rings = 28) {
    const pos = [], uv = [], idx = [], P2 = new V3();
    for (let k = 0; k <= rings; k++) {
      const phi = -Math.PI / 2 + k / rings * Math.PI;
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        headPoint((u - 0.5) * TAU + Math.PI / 2, phi, b, face, P2);
        pos.push(P2.x, P2.y, P2.z);
        uv.push(u, k / rings);
      }
    }
    const S = segs + 1;
    for (let k = 0; k < rings; k++) for (let i = 0; i < segs; i++) {
      const a = k * S + i, bb = a + 1, d = a + S, c = d + 1;
      idx.push(a, c, bb, a, d, c);
    }
    return { pos, uv, idx, sk: [], sw: [], seams: [{ start: 0, S, R: rings + 1 }] };
  }
  function lensData(b, s, scale, lift) {
    const pos = [], uv = [], idx = [], RN = 6, SN = 28, P2 = new V3(), C0 = new V3(0, HC, 0.012), n = new V3();
    for (let j = 0; j <= RN; j++) {
      const r = j / RN;
      for (let i = 0; i <= SN; i++) {
        const th = i / SN * TAU, R2 = 1 + 0.5 * Math.pow(Math.max(0, Math.cos(th - 0.55)), 4);
        const X = Math.cos(th) * 0.27 * R2 * r * scale, Y = Math.sin(th) * 0.17 * R2 * r * scale, tl = 0.38;
        const Xr = X * Math.cos(tl) - Y * Math.sin(tl), Yr = X * Math.sin(tl) + Y * Math.cos(tl);
        headPoint(Math.PI / 2 - s * 0.42 - s * Xr, 0.1 + Yr, b, false, P2);
        n.copy(P2).sub(C0).normalize();
        P2.addScaledVector(n, lift * (1 - 0.35 * r * r));
        pos.push(P2.x, P2.y, P2.z);
        uv.push(0.5 + X, 0.5 + Y);
      }
    }
    for (let j = 0; j < RN; j++) for (let i = 0; i < SN; i++) {
      const a = j * (SN + 1) + i, bb = a + 1, d = a + SN + 1, c = d + 1;
      idx.push(a, bb, c, a, c, d);
    }
    return { pos, uv, idx, sk: [], sw: [], seams: [] };
  }
  function handData(variant, s, b) {
    const k = b.arm, parts = [];
    const pr = [{ y: -0.05, rx: 0.015, rz: 0.036 }, { y: -0.036, rx: 0.02, rz: 0.044 }, { y: 0, rx: 0.021, rz: 0.044 }, { y: 0.03, rx: 0.019, rz: 0.038 }, { y: 0.05, rx: 0.017, rz: 0.03 }].map((r) => ({ ...r, rx: r.rx * k, rz: r.rz * k, cx: -s * 3e-3 }));
    parts.push(tubeData(smooth(pr, 2), 16, (r) => (r.y + 0.05) / 0.1, null));
    const Z = [0.028, 9e-3, -0.01, -0.028], LF = [1, 1.08, 1, 0.82], curl = CURL[variant];
    for (let f = 0; f < 4; f++) {
      let th = curl[f] * 0.3;
      const p = new V3(0, -0.04, Z[f] * k), pts2 = [p.clone()], rad = [95e-4 * k];
      const segL = [0.03, 0.024, 0.02], bend = [1.3, 1.5, 1.1];
      for (let j = 0; j < 3; j++) {
        th += bend[j] * curl[f] * (j === 0 ? 0.7 : 1);
        const d = new V3(-s * Math.sin(th), -Math.cos(th), 0);
        for (let q = 1; q <= 2; q++) {
          p.addScaledVector(d, segL[j] * LF[f] * k / 2);
          pts2.push(p.clone());
          rad.push((92e-4 - j * 8e-4) * k);
        }
      }
      p.addScaledVector(new V3(-s * Math.sin(th), -Math.cos(th), 0), 4e-3 * k);
      pts2.push(p.clone());
      rad.push(4e-3 * k);
      parts.push(sweepData(pts2, rad, 10, new V3(0, 0, 1)));
    }
    const fist = variant === "fist";
    const d1 = new V3(-s * (fist ? 0.75 : 0.25), fist ? -0.55 : -0.7, fist ? 0.25 : 0.55).normalize();
    const d2 = d1.clone().add(new V3(-s * 0.4, -0.1, -0.25)).normalize();
    const t0 = new V3(-s * 0.01, -4e-3, 0.034 * k);
    const tp = [t0.clone(), t0.clone().addScaledVector(d1, 0.016 * k), t0.clone().addScaledVector(d1, 0.032 * k)];
    tp.push(tp[2].clone().addScaledVector(d2, 0.013 * k), tp[2].clone().addScaledVector(d2, 0.026 * k), tp[2].clone().addScaledVector(d2, 0.03 * k));
    parts.push(sweepData(tp, [0.012 * k, 0.012 * k, 0.011 * k, 0.01 * k, 9e-3 * k, 4e-3 * k], 10, new V3(0, 1, 0)));
    return merge(parts);
  }
  function shoeData(kind, k = 1) {
    const Z = [-0.062, -0.05, -0.02, 0.03, 0.08, 0.12, 0.148, 0.166, 0.172];
    const RX = [0.022, 0.038, 0.043, 0.046, 0.048, 0.045, 0.037, 0.024, 8e-3];
    const RY = kind === "spider" ? [0.03, 0.045, 0.05, 0.04, 0.03, 0.024, 0.018, 0.012, 5e-3] : [0.034, 0.052, 0.056, 0.048, 0.038, 0.03, 0.024, 0.016, 6e-3];
    const sole = kind === "spider" ? 0 : 8e-3;
    const pts2 = Z.map((z, i) => new V3(0, -0.08 + sole + RY[i] * k, z * k)), rad = RX.map((r, i) => [r * k, RY[i] * k]);
    const parts = [sweepData(pts2, rad, 20, new V3(0, 1, 0), kind === "spider" ? 2.2 : 2.8)];
    if (kind !== "spider") {
      const col = [{ y: -0.04, rx: 0.048, rz: 0.055, cz: 5e-3 }, { y: 0.01, rx: 0.046, rz: 0.05 }, { y: 0.05, rx: 0.044, rz: 0.047 }].map((r) => ({ ...r, rx: r.rx * k, rz: r.rz * k }));
      parts.push(tubeData(smooth(col, 2), 20, (r) => 0.9, null));
    }
    return merge(parts);
  }
  function C(w, h) {
    const c = cv(w, h);
    return { c, x: c.getContext("2d"), w, h };
  }
  function noise(x, w, h, n, a) {
    for (let i = 0; i < n; i++) {
      x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.7})`;
      x.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }
  function webLines(x, x0, y0, w, h, col, lw, sx = 32, sy = 34) {
    x.save();
    x.beginPath();
    x.rect(x0, y0, w, h);
    x.clip();
    x.strokeStyle = col;
    x.lineWidth = lw;
    for (let a = 0; a <= x0 + w + sx; a += sx) {
      x.beginPath();
      x.moveTo(a, y0);
      x.lineTo(a, y0 + h);
      x.stroke();
    }
    for (let y = Math.floor(y0 / sy) * sy + sy / 2; y <= y0 + h + sy; y += sy) {
      x.beginPath();
      for (let a = 0; a < x0 + w + sx; a += sx) {
        x.moveTo(a, y);
        x.quadraticCurveTo(a + sx / 2, y + sy * 0.3, a + sx, y);
      }
      x.stroke();
    }
    x.restore();
  }
  function hexDots(x, x0, y0, w, h, col) {
    x.save();
    x.beginPath();
    x.rect(x0, y0, w, h);
    x.clip();
    x.fillStyle = col;
    for (let y = y0; y < y0 + h; y += 6) for (let a = y / 6 % 2 * 3.5; a < x0 + w; a += 7) x.fillRect(a, y, 3, 3);
    x.restore();
  }
  function headWeb(x, W, H, col, lw) {
    const cx = W / 2, cy2 = H * 0.52, N = 22;
    x.strokeStyle = col;
    x.lineWidth = lw;
    for (let i = 0; i < N; i++) {
      const g = i / N * TAU;
      x.beginPath();
      x.moveTo(cx, cy2);
      x.lineTo(cx + Math.cos(g) * W, cy2 + Math.sin(g) * W * 0.5);
      x.stroke();
    }
    for (let r = 1; r <= 10; r++) {
      const R2 = r * 27;
      x.beginPath();
      for (let i = 0; i < N; i++) {
        const g0 = i / N * TAU, g1 = (i + 1) / N * TAU, gm = (g0 + g1) / 2;
        x.moveTo(cx + Math.cos(g0) * R2, cy2 + Math.sin(g0) * R2 * 0.5);
        x.quadraticCurveTo(cx + Math.cos(gm) * R2 * 0.86, cy2 + Math.sin(gm) * R2 * 0.43, cx + Math.cos(g1) * R2, cy2 + Math.sin(g1) * R2 * 0.5);
      }
      x.stroke();
    }
  }
  function ell(x, cx, cy2, rx, ry) {
    x.beginPath();
    x.ellipse(cx, cy2, rx, ry, 0, 0, TAU);
    x.fill();
  }
  function drawSpider(x, cx, cy2, s, col, style, sxk = 0.85) {
    x.save();
    x.translate(cx, cy2);
    x.scale(sxk, 1);
    x.fillStyle = col;
    x.strokeStyle = col;
    x.lineCap = "round";
    x.lineJoin = "round";
    if (style === "big") {
      x.lineWidth = s * 0.055;
      const L = [[0.05, -0.12, 0.22, -0.34, 0.3, -0.55], [0.05, -0.08, 0.3, -0.18, 0.47, -0.24], [0.05, 0, 0.3, 0.08, 0.42, 0.3], [0.04, 0.05, 0.18, 0.25, 0.22, 0.56]];
      for (const g of [-1, 1]) for (const l of L) {
        x.beginPath();
        x.moveTo(g * l[0] * s, l[1] * s);
        x.quadraticCurveTo(g * l[2] * s, l[3] * s, g * l[4] * s, l[5] * s);
        x.stroke();
      }
      ell(x, 0, -0.13 * s, 0.075 * s, 0.085 * s);
      ell(x, 0, 0.1 * s, 0.065 * s, 0.18 * s);
    } else {
      x.lineWidth = s * 0.06;
      const L = [[-0.08, -0.3, -0.42], [-0.02, -0.12, -0.05], [0.04, 0.12, 0.28], [0.08, 0.3, 0.46]];
      for (const g of [-1, 1]) for (const [y0, ky, ty] of L) {
        x.beginPath();
        x.moveTo(g * 0.05 * s, y0 * s);
        x.lineTo(g * 0.28 * s, ky * s);
        x.lineTo(g * 0.36 * s, ty * s);
        x.stroke();
      }
      ell(x, 0, -0.08 * s, 0.07 * s, 0.09 * s);
      ell(x, 0, 0.1 * s, 0.08 * s, 0.13 * s);
    }
    x.restore();
  }
  function suitCanvases(s) {
    if (s._cv) return s._cv;
    const key2 = (k) => k || "p", colOf = (k) => k === "p" ? s.prim : k === "s" ? s.sec : s.acc || "#222";
    const webOn = (k) => k === "p" && !!s.web;
    const L = { map: [], bump: [], emi: [] };
    const mk = (w, h) => {
      const m = C(w, h), b = C(w, h), e = C(w, h);
      b.x.fillStyle = "#808080";
      b.x.fillRect(0, 0, w, h);
      e.x.fillStyle = "#000";
      e.x.fillRect(0, 0, w, h);
      return { m, b, e };
    };
    const region = (T2, y0, y1, k, x0 = 0, w) => {
      w = w != null ? w : T2.m.w;
      k = key2(k);
      T2.m.x.fillStyle = colOf(k);
      T2.m.x.fillRect(x0, y0, w, y1 - y0);
      if (webOn(k)) {
        webLines(T2.m.x, x0, y0, w, y1 - y0, s.web, 2.2);
        webLines(T2.b.x, x0, y0, w, y1 - y0, "#d8d8d8", 3);
        if (s.glow) webLines(T2.e.x, x0, y0, w, y1 - y0, s.web, 2.4);
      } else hexDots(T2.b.x, x0, y0, w, y1 - y0, "#949494");
    };
    const logo = (T2, cx, cy2, size, sxk) => {
      if (s.logoS === "none") return;
      drawSpider(T2.m.x, cx, cy2, size, s.logo, s.logoS, sxk);
      T2.b.x.save();
      T2.b.x.shadowColor = "#fff";
      T2.b.x.shadowBlur = 4;
      drawSpider(T2.b.x, cx, cy2, size, "#c8c8c8", s.logoS, sxk);
      T2.b.x.restore();
      if (s.glow) drawSpider(T2.e.x, cx, cy2, size, s.logo, s.logoS, sxk);
    };
    const T = mk(512, 512);
    region(T, 0, TY(1.555), s.parts.head);
    region(T, TY(1.555), TY(1.18), s.chestSec ? "s" : "p");
    region(T, TY(1.18), TY(0.98), s.parts.abd);
    region(T, TY(0.98), 512, s.parts.pelvis);
    if (s.sides) for (const cx of [128, 384]) {
      T.m.x.fillStyle = s.sec;
      T.m.x.beginPath();
      T.m.x.moveTo(cx - 12, TY(1.44));
      T.m.x.lineTo(cx + 12, TY(1.44));
      T.m.x.lineTo(cx + 46, TY(0.99));
      T.m.x.lineTo(cx - 46, TY(0.99));
      T.m.x.fill();
    }
    if (s.stripe) for (const cx of [128, 384]) {
      T.m.x.fillStyle = s.stripe;
      T.m.x.fillRect(cx - 4, TY(0.98), 8, 512 - TY(0.98));
    }
    T.m.x.fillStyle = "rgba(0,0,0,.25)";
    T.m.x.fillRect(0, TY(0.985) - 2, 512, 4);
    const big = s.logoS === "big";
    logo(T, 256, TY(big ? 1.34 : 1.36), big ? 185 : 80, 0.85);
    for (const bx2 of [0, 512]) logo(T, bx2, TY(1.33), big ? 175 : 110, 0.85);
    noise(T.m.x, 512, 512, 3e3, 0.035);
    const A = mk(256, 512);
    region(A, 0, AY(-0.28), s.parts.uarm);
    region(A, AY(-0.28), 512, s.parts.farm);
    A.m.x.fillStyle = "rgba(0,0,0,.25)";
    A.m.x.fillRect(0, AY(-0.5) - 1, 256, 3);
    noise(A.m.x, 256, 512, 1500, 0.035);
    const G2 = mk(256, 512);
    region(G2, 0, LY(-0.47), s.parts.thigh);
    region(G2, LY(-0.47), 512, s.parts.shin);
    if (s.stripe) {
      G2.m.x.fillStyle = s.stripe;
      G2.m.x.fillRect(56, 0, 16, 512);
    }
    noise(G2.m.x, 256, 512, 1500, 0.035);
    const Hd = mk(512, 256), hk2 = key2(s.parts.head);
    Hd.m.x.fillStyle = colOf(hk2);
    Hd.m.x.fillRect(0, 0, 512, 256);
    if (webOn(hk2)) {
      headWeb(Hd.m.x, 512, 256, s.web, 2.2);
      headWeb(Hd.b.x, 512, 256, "#d8d8d8", 3);
      if (s.glow) headWeb(Hd.e.x, 512, 256, s.web, 2.4);
    } else hexDots(Hd.b.x, 0, 0, 512, 256, "#949494");
    const tile = (k) => {
      const t = mk(128, 128);
      region(t, 0, 128, k);
      return t;
    };
    return s._cv = { T, A, G: G2, Hd, hand: tile(s.parts.hand), foot: tile(s.parts.foot) };
  }
  function suitMats(s) {
    if (s._mats) return s._mats;
    const cvs = suitCanvases(s), rough = s.gloss ? 0.32 : 0.55, metal = s.metal ? 0.45 : 0.05;
    const mat = (t, rep) => {
      const m = new THREE.MeshStandardMaterial({ map: tex(t.m, rep), bumpMap: tex(t.b, rep), bumpScale: 0.035, roughness: rough, metalness: metal });
      if (s.glow) {
        m.emissive = new THREE.Color(16777215);
        m.emissiveMap = tex(t.e, rep);
      }
      return m;
    };
    const hand = mat(cvs.hand, true), foot = mat(cvs.foot, true);
    hand.map.repeat.set(2, 1);
    hand.bumpMap.repeat.set(2, 1);
    foot.map.repeat.set(3, 1);
    foot.bumpMap.repeat.set(3, 1);
    return s._mats = {
      torso: mat(cvs.T),
      arm: mat(cvs.A),
      leg: mat(cvs.G),
      head: mat(cvs.Hd),
      hand,
      foot,
      eye: new THREE.MeshStandardMaterial({ color: s.eye, emissive: s.eye, emissiveIntensity: 0.4, roughness: 0.2, side: THREE.DoubleSide }),
      rim: new THREE.MeshStandardMaterial({ color: s.rim, roughness: 0.4, side: THREE.DoubleSide })
    };
  }
  function suitThumb(s) {
    if (s._thumb) return s._thumb;
    const c = cv(180, 120), x = c.getContext("2d"), T = suitCanvases(s).T.m.c;
    x.drawImage(T, 256 - 120, TY(1.56), 240, TY(1.12) - TY(1.56), 0, 0, 180, 120);
    const g = x.createLinearGradient(0, 0, 180, 0);
    g.addColorStop(0, "rgba(0,0,0,.5)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,.5)");
    x.fillStyle = g;
    x.fillRect(0, 0, 180, 120);
    return s._thumb = c.toDataURL();
  }
  function randomOutfit(kind) {
    if (kind === "brute") return { kind, top: "tank", topCol: pick(["#dcd6c8", "#2d2d2d", "#3d4a2c"]), pants: pick(["#3d4a2c", "#4a4032", "#2b2b2b"]), skin: pick(SKINS), hair: "bald", hairCol: "#1b1410", hat: "none", mask: false, shoe: "boot", shoeCol: "#1c1a18" };
    const top2 = pick(["hoodie", "hoodie", "leather", "tshirt"]);
    return {
      kind,
      top: top2,
      topCol: pick(TOPS[top2]),
      pants: pick(PANTS),
      skin: pick(SKINS),
      hair: "short",
      hairCol: pick(HAIR),
      hat: pick(["beanie", "cap", "none", "beanie"]),
      hatCol: pick(["#1a1a1a", "#6b1a1a", "#222233", "#2d3d2d", "#d49a16"]),
      mask: Math.random() < 0.55,
      maskCol: pick(["#8a1515", "#15306e", "#111111", "#3d4a2c"]),
      shoe: "sneaker",
      shoeCol: pick(["#e8e8e8", "#1a1a1a", "#b8141c", "#2d56a8"])
    };
  }
  function outfitCanvases(o) {
    const T = C(512, 512), A = C(256, 512), G2 = C(256, 512), Hd = C(512, 256), Sh = C(256, 128);
    const tx = T.x, top2 = o.topCol;
    tx.fillStyle = top2;
    tx.fillRect(0, 0, 512, TY(0.98));
    tx.fillStyle = o.pants;
    tx.fillRect(0, TY(0.98), 512, 512);
    if (o.top === "tank") {
      tx.fillStyle = o.skin;
      tx.fillRect(0, 0, 512, TY(1.47));
      ell(tx, 256, TY(1.47), 70, 34);
      for (const cx of [128, 384]) ell(tx, cx, TY(1.4), 44, 70);
    }
    tx.fillStyle = o.skin;
    tx.fillRect(0, 0, 512, TY(1.55));
    if (o.top === "hoodie") {
      tx.fillStyle = "rgba(0,0,0,.25)";
      tx.beginPath();
      tx.roundRect ? tx.roundRect(186, TY(1.14), 140, TY(1.02) - TY(1.14), 18) : tx.rect(186, TY(1.14), 140, TY(1.02) - TY(1.14));
      tx.fill();
      tx.fillStyle = "rgba(255,255,255,.08)";
      for (let a = 0; a < 512; a += 6) tx.fillRect(a, TY(1.01), 3, TY(0.98) - TY(1.01));
      tx.strokeStyle = "#ddd";
      tx.lineWidth = 3;
      for (const x of [246, 266]) {
        tx.beginPath();
        tx.moveTo(x, TY(1.52));
        tx.lineTo(x + (x - 256) * 0.3, TY(1.42));
        tx.stroke();
      }
    } else if (o.top === "leather") {
      tx.fillStyle = "#8a8d91";
      tx.fillRect(254, TY(1.53), 4, TY(0.99) - TY(1.53));
      tx.fillStyle = "rgba(255,255,255,.06)";
      for (let i = 0; i < 40; i++) tx.fillRect(Math.random() * 512, TY(1.5) + Math.random() * 200, 40 + Math.random() * 60, 2);
      tx.fillStyle = "rgba(0,0,0,.35)";
      tx.fillRect(0, TY(1.53), 512, 14);
    } else if (o.top === "tshirt") {
      tx.save();
      tx.translate(256, TY(1.3));
      tx.scale(-1, 1);
      tx.fillStyle = "rgba(0,0,0,.55)";
      tx.font = "bold 44px Arial";
      tx.textAlign = "center";
      tx.fillText(pick(["NY", "NYC", "\u2605", "BK"]), 0, 0);
      tx.restore();
    }
    tx.fillStyle = "rgba(255,255,255,.12)";
    for (const x of [128, 384]) tx.fillRect(x - 1, TY(0.98), 3, 512);
    tx.fillStyle = "#1a1a1a";
    tx.fillRect(0, TY(0.995), 512, TY(0.965) - TY(0.995));
    if (o.top !== "tank") {
      tx.fillStyle = "#b8b8b8";
      tx.fillRect(244, TY(0.995), 24, TY(0.965) - TY(0.995));
    }
    tx.fillStyle = "rgba(0,0,0,.25)";
    tx.fillRect(255, TY(0.96), 2, 50);
    noise(tx, 512, 512, 6e3, 0.05);
    const ax = A.x, sleeve = o.top === "tank" ? 0.2 : o.top === "tshirt" ? -0.13 : -0.52;
    ax.fillStyle = o.skin;
    ax.fillRect(0, 0, 256, 512);
    const g = ax.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, "rgba(0,0,0,.08)");
    g.addColorStop(0.5, "rgba(255,255,255,.05)");
    g.addColorStop(1, "rgba(0,0,0,.08)");
    ax.fillStyle = g;
    ax.fillRect(0, 0, 256, 512);
    if (sleeve < 0.1) {
      ax.fillStyle = top2;
      ax.fillRect(0, 0, 256, AY(sleeve));
      ax.fillStyle = "rgba(0,0,0,.25)";
      ax.fillRect(0, AY(sleeve) - 8, 256, 8);
    }
    if (o.kind === "brute") {
      ax.strokeStyle = "rgba(20,30,40,.8)";
      ax.lineWidth = 5;
      for (let i = 0; i < 4; i++) {
        ax.beginPath();
        ax.moveTo(40, AY(-0.02) + i * 22);
        ax.bezierCurveTo(90, AY(-0.02) + i * 22 - 30, 130, AY(-0.02) + i * 22 + 30, 200, AY(-0.02) + i * 22);
        ax.stroke();
      }
    }
    noise(ax, 256, 512, 2500, 0.04);
    const gx = G2.x;
    gx.fillStyle = o.pants;
    gx.fillRect(0, 0, 256, 512);
    gx.fillStyle = "rgba(255,255,255,.12)";
    gx.fillRect(63, 0, 3, 512);
    gx.strokeStyle = "rgba(0,0,0,.25)";
    gx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const y = LY(-0.47) + (i - 3) * 9;
      gx.beginPath();
      gx.moveTo(90 + i * 8, y);
      gx.quadraticCurveTo(128, y + 6, 170 - i * 5, y);
      gx.stroke();
    }
    if (o.kind === "brute") {
      gx.fillStyle = "rgba(0,0,0,.25)";
      gx.fillRect(40, LY(-0.18), 48, LY(-0.33) - LY(-0.18));
    }
    gx.fillStyle = "rgba(0,0,0,.2)";
    gx.fillRect(0, LY(-0.8), 256, 8);
    noise(gx, 256, 512, 3e3, 0.06);
    const hx = Hd.x;
    hx.fillStyle = o.skin;
    hx.fillRect(0, 0, 512, 256);
    noise(hx, 512, 256, 2e3, 0.03);
    if (o.hair !== "bald") {
      hx.fillStyle = o.hairCol;
      hx.fillRect(0, 0, 512, 92);
      hx.fillRect(0, 0, 150, 150);
      hx.fillRect(362, 0, 150, 150);
    } else {
      hx.fillStyle = "rgba(30,20,10,.25)";
      hx.fillRect(0, 0, 512, 90);
    }
    const ey = 121;
    for (const X of [226, 286]) {
      hx.fillStyle = "#f2ece2";
      ell(hx, X, ey, 11, 5);
      hx.fillStyle = "#3b2a1c";
      hx.beginPath();
      hx.arc(X, ey, 4.2, 0, TAU);
      hx.fill();
      hx.fillStyle = "#000";
      hx.beginPath();
      hx.arc(X, ey, 2, 0, TAU);
      hx.fill();
      hx.strokeStyle = "rgba(40,20,10,.6)";
      hx.lineWidth = 2;
      hx.beginPath();
      hx.ellipse(X, ey, 12, 6, 0, Math.PI * 1.05, Math.PI * 1.95);
      hx.stroke();
      hx.strokeStyle = o.hair === "bald" ? "#2a1a10" : o.hairCol;
      hx.lineWidth = 4.5;
      hx.beginPath();
      const inner = X < 256 ? X + 13 : X - 13, outer = X < 256 ? X - 13 : X + 13;
      hx.moveTo(outer, ey - 13);
      hx.lineTo(inner, ey - 8);
      hx.stroke();
    }
    hx.fillStyle = "rgba(80,30,20,.25)";
    ell(hx, 256, 138, 9, 5);
    hx.fillStyle = "rgba(40,10,10,.5)";
    ell(hx, 251, 139, 2.2, 1.5);
    ell(hx, 261, 139, 2.2, 1.5);
    hx.strokeStyle = "#5a2a22";
    hx.lineWidth = 3;
    hx.beginPath();
    hx.moveTo(243, 154);
    hx.quadraticCurveTo(256, 150, 269, 154);
    hx.stroke();
    if (o.kind === "brute") {
      hx.fillStyle = "rgba(20,15,10,.35)";
      for (let i = 0; i < 500; i++) hx.fillRect(200 + Math.random() * 112, 140 + Math.random() * 45, 1.5, 1.5);
    }
    if (o.mask) {
      hx.fillStyle = o.maskCol;
      hx.beginPath();
      hx.moveTo(120, 132);
      hx.lineTo(392, 132);
      hx.lineTo(392, 200);
      hx.lineTo(256, 215);
      hx.lineTo(120, 200);
      hx.fill();
      hx.fillStyle = "rgba(255,255,255,.35)";
      for (let i = 0; i < 40; i++) {
        hx.beginPath();
        hx.arc(130 + Math.random() * 250, 140 + Math.random() * 60, 2.5, 0, TAU);
        hx.fill();
      }
    }
    const sx = Sh.x;
    sx.fillStyle = o.shoeCol;
    sx.fillRect(0, 0, 256, 128);
    sx.fillStyle = o.shoe === "boot" ? "#0d0c0b" : "#f2f2f2";
    sx.fillRect((0.25 - 0.14) * 256, 0, 0.28 * 256, 128);
    sx.strokeStyle = o.shoe === "boot" ? "#555" : "#fff";
    sx.lineWidth = 2;
    for (let v = 20; v < 80; v += 9) {
      sx.beginPath();
      sx.moveTo(0.7 * 256, v);
      sx.lineTo(0.8 * 256, v + 4);
      sx.stroke();
    }
    noise(sx, 256, 128, 500, 0.05);
    return { T, A, G: G2, Hd, Sh };
  }
  function outfitMats(o) {
    const key2 = JSON.stringify(o);
    if (outfitCache.has(key2)) return outfitCache.get(key2);
    const c = outfitCanvases(o);
    const bump = (() => {
      const b = C(128, 128);
      b.x.fillStyle = "#808080";
      b.x.fillRect(0, 0, 128, 128);
      noise(b.x, 128, 128, 3e3, 0.25);
      const t = tex(b, true);
      t.repeat.set(4, 4);
      return t;
    })();
    const mat = (cv2, rough = 0.85) => new THREE.MeshStandardMaterial({ map: tex(cv2), bumpMap: bump, bumpScale: 6e-3, roughness: rough });
    const M = {
      torso: mat(c.T, o.top === "leather" ? 0.45 : 0.85),
      arm: mat(c.A, o.top === "leather" ? 0.5 : 0.8),
      leg: mat(c.G),
      head: new THREE.MeshStandardMaterial({ map: tex(c.Hd), roughness: 0.7 }),
      hand: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }),
      foot: mat(c.Sh, 0.6),
      skin: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: o.hairCol, roughness: 0.9 }),
      hat: new THREE.MeshStandardMaterial({ color: o.hatCol || "#222", roughness: 0.9 }),
      top: new THREE.MeshStandardMaterial({ color: o.topCol, roughness: 0.85 })
    };
    outfitCache.set(key2, M);
    return M;
  }
  function build(kind, M, opt = {}) {
    const b = BODY[kind], H = makeRig(b);
    H.root.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(H.bones);
    const skinned = (d, mat) => {
      mat.skinning = true;
      const m = new THREE.SkinnedMesh(toGeo(d), mat);
      m.frustumCulled = false;
      m.castShadow = true;
      m.receiveShadow = true;
      H.root.add(m);
      m.updateMatrixWorld(true);
      m.bind(skel);
      return m;
    };
    skinned(tubeData(smooth(torsoRings(b), 3), 40, (r) => (r.y - 0.79) / 0.91, wTorso), M.torso);
    const arm = tubeData(smooth(armRings(b), 3), 24, (r) => (r.y - (SHY - 0.56)) / 0.655, wArm);
    skinned(merge([arm, mirror(arm)]), M.arm);
    const leg = tubeData(smooth(legRings(b), 3), 24, (r) => (r.y - (HIPY - 0.87)) / 0.99, wLeg);
    skinned(merge([leg, mirror(leg)]), M.leg);
    const head = new THREE.Mesh(toGeo(headData(b, opt.face)), M.head);
    head.castShadow = true;
    H.neck.add(head);
    H.headM = head;
    H.hands = {};
    for (const s of [1, -1]) {
      const L = s > 0 ? "L" : "R", set2 = {};
      for (const v of opt.thwip ? ["open", "fist", "thwip"] : ["open", "fist"]) {
        const m = new THREE.Mesh(toGeo(handData(v, s, b)), M.hand);
        m.castShadow = true;
        m.visible = v === "open";
        H["hand" + L].add(m);
        set2[v] = m;
      }
      H.hands[L] = set2;
      const f = new THREE.Mesh(toGeo(shoeData(opt.shoe || "sneaker", kind === "brute" || kind === "boss" ? 1.12 : 1)), M.foot);
      f.castShadow = true;
      H["ft" + L].add(f);
    }
    H.handPose = { L: "open", R: "open" };
    H.setHands = (l, r) => {
      for (const [side, v] of [["L", l], ["R", r]]) {
        if (H.handPose[side] === v || !H.hands[side][v]) continue;
        for (const k in H.hands[side]) H.hands[side][k].visible = k === v;
        H.handPose[side] = v;
      }
    };
    H.b = b;
    return H;
  }
  function buildSpider(s) {
    const M = suitMats(s), H = build("spider", M, { thwip: true, shoe: "spider" });
    for (const side of [1, -1]) {
      const rim = new THREE.Mesh(toGeo(lensData(H.b, side, 1.22, 4e-3)), M.rim);
      const lens = new THREE.Mesh(toGeo(lensData(H.b, side, 1, 7e-3)), M.eye);
      H.neck.add(rim, lens);
    }
    for (const L of ["L", "R"]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.036, 0.028, 16), new THREE.MeshStandardMaterial({ color: 10133670, metalness: 0.8, roughness: 0.3 }));
      w.position.y = -0.24;
      H["el" + L].add(w);
    }
    return H;
  }
  function addHat(H, o, M) {
    const hs = H.b.head, hc = new V3(0, HC, 0.012);
    if (o.hair === "short" && o.hat === "none") {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.2), M.hair);
      h.scale.set(0.103 * hs, 0.128 * hs, 0.114 * hs);
      h.position.copy(hc);
      h.rotation.x = -0.35;
      H.neck.add(h);
    }
    if (o.hat === "beanie") {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.45), M.hat);
      h.scale.set(0.108 * hs, 0.14 * hs, 0.118 * hs);
      h.position.copy(hc);
      h.rotation.x = -0.2;
      h.castShadow = true;
      H.neck.add(h);
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.13, 8, 28), M.hat);
      r.scale.set(0.104 * hs, 0.114 * hs, 1);
      r.rotation.x = Math.PI / 2 - 0.2;
      r.position.set(0, HC + 0.025, 5e-3);
      r.scale.z = 0.11;
      H.neck.add(r);
    } else if (o.hat === "cap") {
      const h = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.35), M.hat);
      h.scale.set(0.106 * hs, 0.125 * hs, 0.116 * hs);
      h.position.copy(hc);
      h.rotation.x = -0.15;
      h.castShadow = true;
      H.neck.add(h);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 8e-3, 24, 1, false, -Math.PI / 2, Math.PI), M.hat);
      brim.position.set(0, HC + 0.06, 0.07);
      brim.scale.set(0.95, 1, 1.25);
      brim.rotation.x = 0.12;
      H.neck.add(brim);
    }
    if (o.top === "hoodie") {
      const hood = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 10, 24, Math.PI), M.top);
      hood.rotation.x = -Math.PI / 2 + 0.35;
      hood.position.set(0, 0.27, -0.01);
      hood.scale.set(1.1, 1.15, 0.8);
      hood.castShadow = true;
      H.chest.add(hood);
    }
    for (const s of [1, -1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.skin);
      e.scale.set(0.014, 0.03, 0.02);
      e.position.set(0.097 * hs * s, HC, 0);
      H.neck.add(e);
    }
  }
  function buildThug(kind = "thug", outfit) {
    const o = outfit || randomOutfit(kind), M = outfitMats(o);
    const H = build(kind, M, { face: true, shoe: o.shoe });
    addHat(H, o, M);
    H.outfit = o;
    return H;
  }
  function buildBoss() {
    const plate = () => {
      const m = C(512, 512), b = C(512, 512);
      m.x.fillStyle = "#6d7076";
      m.x.fillRect(0, 0, 512, 512);
      b.x.fillStyle = "#808080";
      b.x.fillRect(0, 0, 512, 512);
      for (let y = 20; y < 512; y += 44) {
        m.x.fillStyle = "#44474c";
        m.x.fillRect(0, y, 512, 5);
        b.x.fillStyle = "#404040";
        b.x.fillRect(0, y, 512, 5);
      }
      for (let y = 30; y < 512; y += 44) for (let x = 16; x < 512; x += 64) {
        m.x.fillStyle = "#9da1a8";
        m.x.beginPath();
        m.x.arc(x, y, 3, 0, TAU);
        m.x.fill();
        b.x.fillStyle = "#e0e0e0";
        b.x.beginPath();
        b.x.arc(x, y, 3, 0, TAU);
        b.x.fill();
      }
      noise(m.x, 512, 512, 6e3, 0.06);
      return new THREE.MeshStandardMaterial({ map: tex(m), bumpMap: tex(b), bumpScale: 0.05, metalness: 0.55, roughness: 0.45 });
    };
    const armor = plate();
    const face = C(512, 256);
    face.x.fillStyle = "#5c5f65";
    face.x.fillRect(0, 0, 512, 256);
    face.x.fillStyle = "#a07a60";
    face.x.fillRect(196, 100, 120, 70);
    face.x.fillStyle = "#ff3b1f";
    ell(face.x, 230, 121, 9, 4);
    ell(face.x, 282, 121, 9, 4);
    face.x.strokeStyle = "#3a1a14";
    face.x.lineWidth = 3;
    face.x.beginPath();
    face.x.moveTo(240, 155);
    face.x.lineTo(272, 155);
    face.x.stroke();
    const M = {
      torso: armor,
      arm: armor,
      leg: armor,
      head: new THREE.MeshStandardMaterial({ map: tex(face), metalness: 0.4, roughness: 0.5 }),
      hand: new THREE.MeshStandardMaterial({ color: 3882306, roughness: 0.6, metalness: 0.4 }),
      foot: new THREE.MeshStandardMaterial({ color: 3026996, roughness: 0.6, metalness: 0.4 })
    };
    const H = build("boss", M, { face: true, shoe: "boot" });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 16), new THREE.MeshStandardMaterial({ color: 14209732, roughness: 0.5 }));
    horn.position.set(0, HC + 0.05, 0.13);
    horn.rotation.x = 0.9;
    H.neck.add(horn);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, 1.5), armor);
    helm.scale.set(0.112, 0.14, 0.124);
    helm.position.set(0, HC, 0);
    helm.rotation.x = -0.25;
    H.neck.add(helm);
    for (const s of [1, -1]) {
      const pad2 = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12, 0, TAU, 0, 1.6), armor);
      pad2.scale.set(0.12, 0.09, 0.12);
      pad2.position.set(0.02 * s, 0.03, 0);
      pad2.rotation.z = -0.3 * s;
      H["sh" + (s > 0 ? "L" : "R")].add(pad2);
    }
    return H;
  }
  function pedGeometries() {
    const b = BODY.thug, frames = [];
    for (const ph of [0.9, 0.9 + Math.PI]) {
      const H = makeRig(b);
      H.root.updateMatrixWorld(true);
      const skel = new THREE.Skeleton(H.bones);
      const s = Math.sin(ph), c = Math.cos(ph);
      H.hipL.rotation.x = -s * 0.42;
      H.hipR.rotation.x = s * 0.42;
      H.knL.rotation.x = 0.15 + Math.max(0, c) * 0.6;
      H.knR.rotation.x = 0.15 + Math.max(0, -c) * 0.6;
      H.shL.rotation.set(s * 0.35, 0, 0.1);
      H.shR.rotation.set(-s * 0.35, 0, -0.1);
      H.elL.rotation.x = -0.35;
      H.elR.rotation.x = -0.35;
      H.root.updateMatrixWorld(true);
      const M = H.bones.map((bn, i) => new THREE.Matrix4().multiplyMatrices(bn.matrixWorld, skel.boneInverses[i]));
      const skin = (d) => {
        const p = d.pos.slice(), v = new V3(), acc2 = new V3(), t = new V3();
        for (let i = 0; i < p.length / 3; i++) {
          v.set(d.pos[i * 3], d.pos[i * 3 + 1], d.pos[i * 3 + 2]);
          acc2.set(0, 0, 0);
          for (let j = 0; j < 4; j++) {
            const w = d.sw[i * 4 + j];
            if (w) acc2.addScaledVector(t.copy(v).applyMatrix4(M[d.sk[i * 4 + j]]), w);
          }
          p[i * 3] = acc2.x;
          p[i * 3 + 1] = acc2.y;
          p[i * 3 + 2] = acc2.z;
        }
        return { ...d, pos: p, sk: [], sw: [] };
      };
      const rigid = (d, obj) => {
        const p = d.pos.slice(), v = new V3();
        obj.updateMatrixWorld(true);
        for (let i = 0; i < p.length; i += 3) {
          v.set(p[i], p[i + 1], p[i + 2]).applyMatrix4(obj.matrixWorld);
          p[i] = v.x;
          p[i + 1] = v.y;
          p[i + 2] = v.z;
        }
        return { ...d, pos: p };
      };
      const torso = skin(tubeData(smooth(torsoRings(b), 1), 9, () => 0, wTorso));
      const top2 = { pos: torso.pos, uv: torso.uv, idx: [], sk: [], sw: [], seams: [] }, bot = { ...top2, idx: [] };
      const rest = tubeData(smooth(torsoRings(b), 1), 9, () => 0, null).pos;
      for (let i = 0; i < torso.idx.length; i += 3) {
        const a = torso.idx[i], bb = torso.idx[i + 1], cc = torso.idx[i + 2];
        const y = (rest[a * 3 + 1] + rest[bb * 3 + 1] + rest[cc * 3 + 1]) / 3;
        (y > 0.98 ? top2 : bot).idx.push(a, bb, cc);
      }
      const arm = tubeData(smooth(armRings(b), 1), 6, () => 0, wArm);
      const leg = tubeData(smooth(legRings(b), 1), 6, () => 0, wLeg);
      const handL = rigid(tubeData(smooth([{ y: -0.06, rx: 0.01, rz: 0.01 }, { y: -0.03, rx: 0.02, rz: 0.04 }, { y: 0.03, rx: 0.02, rz: 0.038 }, { y: 0.05, rx: 0.01, rz: 0.01 }], 1), 8, () => 0, null), H.handL);
      const handR = rigid(tubeData(smooth([{ y: -0.06, rx: 0.01, rz: 0.01 }, { y: -0.03, rx: 0.02, rz: 0.04 }, { y: 0.03, rx: 0.02, rz: 0.038 }, { y: 0.05, rx: 0.01, rz: 0.01 }], 1), 8, () => 0, null), H.handR);
      const shoeL = rigid(shoeData("spider", 1.05), H.ftL), shoeR = rigid(shoeData("spider", 1.05), H.ftR);
      const head = rigid(headData(b, true, 16, 11), H.neck);
      frames.push({
        top: toGeo(merge([top2, skin(arm), skin(mirror(arm))])),
        bot: toGeo(merge([bot, skin(leg), skin(mirror(leg)), shoeL, shoeR])),
        hand: toGeo(merge([handL, handR])),
        head: toGeo(head)
      });
    }
    return frames;
  }
  function buildKingpin() {
    const o = { kind: "brute", top: "tshirt", topCol: "#ece6d8", pants: "#ece6d8", skin: "#dcae8c", hair: "bald", hairCol: "#111", hat: "none", mask: false, shoe: "boot", shoeCol: "#0d0d0d" };
    const base = outfitCanvases(o), cream = "#ebe5d6";
    const T = C(512, 512), A = C(256, 512), G2 = C(256, 512), tx = T.x;
    tx.fillStyle = cream;
    tx.fillRect(0, 0, 512, 512);
    tx.fillStyle = o.skin;
    tx.fillRect(0, 0, 512, TY(1.555));
    for (const cx of [256]) {
      tx.fillStyle = "#fbfaf5";
      tx.beginPath();
      tx.moveTo(cx - 34, TY(1.545));
      tx.lineTo(cx + 34, TY(1.545));
      tx.lineTo(cx + 8, TY(1.1));
      tx.lineTo(cx - 8, TY(1.1));
      tx.fill();
      tx.strokeStyle = "rgba(60,55,45,.55)";
      tx.lineWidth = 3;
      for (const sg of [-1, 1]) {
        tx.beginPath();
        tx.moveTo(cx + sg * 36, TY(1.545));
        tx.lineTo(cx + sg * 16, TY(1.3));
        tx.lineTo(cx + sg * 30, TY(1.22));
        tx.lineTo(cx + sg * 9, TY(1.02));
        tx.stroke();
      }
      tx.fillStyle = "#161616";
      tx.beginPath();
      tx.moveTo(cx - 6, TY(1.52));
      tx.lineTo(cx + 6, TY(1.52));
      tx.lineTo(cx + 10, TY(1.16));
      tx.lineTo(cx, TY(1.1));
      tx.lineTo(cx - 10, TY(1.16));
      tx.fill();
      tx.fillStyle = "#8b7a4a";
      for (const y of [1.06, 0.99]) {
        tx.beginPath();
        tx.arc(cx + 22, TY(y), 3.2, 0, 7);
        tx.fill();
      }
    }
    tx.fillStyle = "rgba(0,0,0,.18)";
    tx.fillRect(0, TY(0.975), 512, 4);
    for (const cx of [128, 384]) {
      tx.fillStyle = "rgba(80,70,55,.18)";
      tx.fillRect(cx - 1, TY(0.97), 3, 512);
    }
    noise(tx, 512, 512, 5e3, 0.04);
    A.x.fillStyle = cream;
    A.x.fillRect(0, 0, 256, 512);
    A.x.fillStyle = "#fbfaf5";
    A.x.fillRect(0, AY(-0.5), 256, 512 - AY(-0.5));
    noise(A.x, 256, 512, 1500, 0.04);
    G2.x.fillStyle = cream;
    G2.x.fillRect(0, 0, 256, 512);
    G2.x.fillStyle = "rgba(80,70,55,.22)";
    G2.x.fillRect(63, 0, 3, 512);
    G2.x.fillRect(191, 0, 3, 512);
    noise(G2.x, 256, 512, 2500, 0.04);
    const mat = (c, r = 0.75) => new THREE.MeshStandardMaterial({ map: tex(c), roughness: r });
    const M = { torso: mat(T), arm: mat(A), leg: mat(G2), head: new THREE.MeshStandardMaterial({ map: tex(base.Hd), roughness: 0.65 }), hand: new THREE.MeshStandardMaterial({ color: o.skin, roughness: 0.7 }), foot: mat(base.Sh, 0.5) };
    const H = build("fisk", M, { face: true, shoe: "boot" });
    H.setHands("open", "fist");
    const cane = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 1.05, 10), new THREE.MeshStandardMaterial({ color: 1315860, roughness: 0.35, metalness: 0.3 }));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), new THREE.MeshStandardMaterial({ color: 13224399, roughness: 0.25, metalness: 0.9 }));
    knob.position.y = 0.55;
    shaft.position.y = 0.05;
    cane.add(shaft, knob);
    cane.rotation.x = Math.PI;
    cane.position.set(0, -0.3, 0.02);
    cane.traverse((o2) => {
      if (o2.isMesh) o2.castShadow = true;
    });
    H.elR.add(cane);
    H.cane = cane;
    return H;
  }
  function pedFaceTexture() {
    const c = outfitCanvases({ kind: "thug", top: "tshirt", topCol: "#fff", pants: "#fff", skin: "#f6e9de", hair: "short", hairCol: "#5a5a5a", hat: "none", mask: false, shoe: "sneaker", shoeCol: "#fff" });
    return tex(c.Hd);
  }
  var TAU, sm, cr, BN, MIRB, SHY, HIPY, HC, BODY, KEYS, norm, _T, _N, _B, _P, wTorso, wArm, wLeg, TY, AY, LY, CURL, tex, SKINS, HAIR, TOPS, PANTS, pick, outfitCache;
  var init_model = __esm({
    "js/model.js"() {
      init_util();
      TAU = Math.PI * 2;
      sm = (a, b, x) => {
        const t = clamp((x - a) / (b - a), 0, 1);
        return t * t * (3 - 2 * t);
      };
      cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
      BN = { body: 0, spine: 1, chest: 2, neck: 3, shL: 4, elL: 5, shR: 6, elR: 7, hipL: 8, knL: 9, ftL: 10, hipR: 11, knR: 12, ftR: 13 };
      MIRB = { 4: 6, 5: 7, 8: 11, 9: 12, 10: 13 };
      SHY = 1.45;
      HIPY = 0.91;
      HC = 0.125;
      BODY = {
        spider: { w: 1, chest: 1, waist: 1, belly: 0, pec: 1, hips: 1, arm: 1, leg: 1, neck: 1, head: 1 },
        thug: { w: 0.97, chest: 0.93, waist: 1.08, belly: 0.1, pec: 0.3, hips: 1.02, arm: 0.93, leg: 1, neck: 1.05, head: 1 },
        brute: { w: 1.16, chest: 1.12, waist: 1.16, belly: 0.08, pec: 1.4, hips: 1.14, arm: 1.4, leg: 1.18, neck: 1.35, head: 1.02 },
        fisk: { w: 1.34, chest: 1.24, waist: 1.6, belly: 0.55, pec: 0.4, hips: 1.32, arm: 1.32, leg: 1.1, neck: 1.6, head: 1.42 },
        boss: { w: 1.2, chest: 1.18, waist: 1.2, belly: 0.05, pec: 1.1, hips: 1.22, arm: 1.45, leg: 1.25, neck: 1.5, head: 1.05 }
      };
      KEYS = ["y", "rx", "rz", "cx", "cz", "n", "fb", "bb", "pec"];
      norm = (r) => {
        var _a4;
        const o = {};
        for (const k of KEYS) o[k] = (_a4 = r[k]) != null ? _a4 : k === "n" ? 2 : 0;
        return o;
      };
      _T = new V3();
      _N = new V3();
      _B = new V3();
      _P = new V3();
      wTorso = (x, y) => {
        const W = {}, t1 = sm(0.97, 1.05, y), t2 = sm(1.19, 1.29, y), t3 = sm(1.53, 1.6, y);
        let body = 1 - t1;
        const hl = clamp((0.93 - y) / 0.12, 0, 1) * 0.6 * sm(0.01, 0.07, Math.abs(x));
        if (hl > 0) {
          W[x > 0 ? BN.hipL : BN.hipR] = hl;
          body *= 1 - hl;
        }
        W[BN.body] = body;
        W[BN.spine] = t1 * (1 - t2);
        W[BN.chest] = t2 * (1 - t3);
        W[BN.neck] = t3;
        return W;
      };
      wArm = (x, y) => {
        const t = y - SHY, e = sm(-0.34, -0.22, t), c = sm(0, 0.08, t) * 0.3;
        return { [BN.chest]: c, [BN.shL]: e * (1 - c), [BN.elL]: 1 - e };
      };
      wLeg = (x, y) => {
        const t = y - HIPY, e = sm(-0.5, -0.36, t), f = 1 - sm(-0.86, -0.8, t), top2 = sm(0, 0.1, t) * 0.35;
        return { [BN.body]: top2, [BN.hipL]: e * (1 - top2), [BN.knL]: (1 - e) * (1 - f), [BN.ftL]: (1 - e) * f };
      };
      TY = (y) => (1 - (y - 0.79) / 0.91) * 512;
      AY = (t) => (1 - (t + 0.56) / 0.655) * 512;
      LY = (t) => (1 - (t + 0.87) / 0.99) * 512;
      CURL = { open: [0.2, 0.24, 0.28, 0.32], fist: [1, 1, 1, 1], thwip: [0.05, 1, 1, 0.05] };
      tex = (c, rep) => canvasTex(c.c || c, rep);
      SKINS = ["#e6b996", "#c68e6a", "#8d5a3b", "#f1c9a5", "#5e3a24", "#b07a55"];
      HAIR = ["#1b1410", "#3b2414", "#0e0e0e", "#6b4a2a", "#2a2a2a"];
      TOPS = { hoodie: ["#2b2f36", "#4a1e22", "#1f3a2b", "#5b5f66", "#243142", "#6b5a3a"], leather: ["#1a1716", "#2b1d16", "#161a1f"], tshirt: ["#c9c2b3", "#3a3a3a", "#6b1a1a", "#1d3050"] };
      PANTS = ["#27344f", "#1e2533", "#3b3f4a", "#2b2b2b", "#4a4032"];
      pick = (a) => a[Math.floor(Math.random() * a.length)];
      outfitCache = /* @__PURE__ */ new Map();
    }
  });

  // js/miasto.js
  function distKey(i, j) {
    if (j < 2) return "harlem";
    if (j < 8) return i < 2 ? "uws" : i > 5 ? "ues" : "park";
    if (j < 12) return i < 4 ? "hk" : "mid";
    if (j < 15) return i < 4 ? "gv" : "ct";
    return "fin";
  }
  function districtAt(x, z) {
    if (inPark(x, z)) return "park";
    const i = clamp(Math.floor((x - X0) / CX), 0, NX - 1), j = clamp(Math.floor((z - Z0) / CZ), 0, NZ - 1);
    return distKey(i, j);
  }
  function blk(i, j) {
    const x0 = X0 + i * CX + ST / 2, z0 = Z0 + j * CZ + ST / 2;
    return { x0, x1: x0 + BW, z0, z1: z0 + BD };
  }
  function addBox(b) {
    b.q = 0;
    boxes.push(b);
    for (let ix = Math.floor(b.x0 / HC2); ix <= Math.floor(b.x1 / HC2); ix++)
      for (let iz = Math.floor(b.z0 / HC2); iz <= Math.floor(b.z1 / HC2); iz++) {
        const k = hk(ix, iz);
        let l = hash.get(k);
        if (!l) {
          l = [];
          hash.set(k, l);
        }
        l.push(b);
      }
    return b;
  }
  function boxesNear(x, z, r, out) {
    out.length = 0;
    stamp++;
    const a = Math.floor((x - r) / HC2), b = Math.floor((x + r) / HC2), c = Math.floor((z - r) / HC2), d = Math.floor((z + r) / HC2);
    for (let ix = a; ix <= b; ix++) for (let iz = c; iz <= d; iz++) {
      const l = hash.get(hk(ix, iz));
      if (!l) continue;
      for (const bx2 of l) if (bx2.q !== stamp) {
        bx2.q = stamp;
        out.push(bx2);
      }
    }
    return out;
  }
  function supportAt(x, z, maxY, r = 0.3) {
    let h = 0;
    boxesNear(x, z, r + 1, _s1);
    for (const b of _s1) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && b.y1 <= maxY && b.y1 > h) h = b.y1;
    return h;
  }
  function solidAt(x, y, z) {
    boxesNear(x, z, 1, _s2);
    for (const b of _s2) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1) return true;
    return false;
  }
  function rayBox(o, d, b, maxT) {
    let tmin = -Infinity, tmax = Infinity, ax = -1, sg = 0;
    const O = [o.x, o.y, o.z], D = [d.x, d.y, d.z], LO = [b.x0, b.y0, b.z0], HI = [b.x1, b.y1, b.z1];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(D[i]) < 1e-9) {
        if (O[i] < LO[i] || O[i] > HI[i]) return Infinity;
        continue;
      }
      let t1 = (LO[i] - O[i]) / D[i], t2 = (HI[i] - O[i]) / D[i], s = -1;
      if (t1 > t2) {
        const q = t1;
        t1 = t2;
        t2 = q;
        s = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        ax = i;
        sg = s;
      }
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
    if (tmin < 0 || tmin > maxT) return Infinity;
    _rbN.set(0, 0, 0);
    if (ax === 0) _rbN.x = sg;
    else if (ax === 1) _rbN.y = sg;
    else _rbN.z = sg;
    return tmin;
  }
  function raycastCity(o, d, maxT) {
    let best = maxT;
    const mx = o.x + d.x * maxT * 0.5, mz = o.z + d.z * maxT * 0.5;
    boxesNear(mx, mz, maxT * 0.5 * Math.hypot(d.x, d.z) + 2, _rl);
    for (const b of _rl) {
      const t = rayBox(o, d, b, best);
      if (t < best) {
        best = t;
        rayN.copy(_rbN);
      }
    }
    if (d.y < -1e-4) {
      const t = -o.y / d.y;
      if (t > 0 && t < best) {
        best = t;
        rayN.set(0, 1, 0);
      }
    }
    return best;
  }
  function randomBuildingLook() {
    const L = 0.58 + srand() * 0.42;
    cur.tint = [L * (1 + (srand() - 0.5) * 0.14), L * (1 + (srand() - 0.5) * 0.1), L * (1 + (srand() - 0.5) * 0.14)];
    cur.us = 13 + srand() * 5;
    cur.vs = 12 + srand() * 4;
    cur.uo = Math.floor(srand() * 4) / 4;
    cur.vo = Math.floor(srand() * 4) / 4;
  }
  function newGeo() {
    return { chunks: /* @__PURE__ */ new Map() };
  }
  function quad(g, a, b, c, d, n, ua, ub, uc, ud) {
    const key2 = Math.floor(a[0] / CHUNK) * 1e3 + Math.floor(a[2] / CHUNK);
    let s = g.chunks.get(key2);
    if (!s) {
      s = { p: [], n: [], u: [], c: [] };
      g.chunks.set(key2, s);
    }
    for (const [Q, U] of [[a, ua], [b, ub], [c, uc], [a, ua], [c, uc], [d, ud]]) {
      s.p.push(Q[0], Q[1], Q[2]);
      s.n.push(n[0], n[1], n[2]);
      s.u.push(U[0], U[1]);
      s.c.push(cur.tint[0], cur.tint[1], cur.tint[2]);
    }
  }
  function wallsFaces(g, x0, x1, y0, y1, z0, z1, us, vs, faces) {
    let uo = 0, vo = 0;
    if (us === 16 && vs === 14) {
      us = cur.us;
      vs = cur.vs;
      uo = cur.uo;
      vo = cur.vo;
    }
    const v0 = y0 / vs + vo, v1 = y1 / vs + vo, X02 = x0 / us + uo, X1 = x1 / us + uo, Z02 = z0 / us + uo, Z1 = z1 / us + uo;
    if (faces.includes("s")) quad(g, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [X02, v0], [X1, v0], [X1, v1], [X02, v1]);
    if (faces.includes("n")) quad(g, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [-X1, v0], [-X02, v0], [-X02, v1], [-X1, v1]);
    if (faces.includes("e")) quad(g, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [-Z1, v0], [-Z02, v0], [-Z02, v1], [-Z1, v1]);
    if (faces.includes("w")) quad(g, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [Z02, v0], [Z1, v0], [Z1, v1], [Z02, v1]);
  }
  function walls(g, x0, x1, y0, y1, z0, z1, us, vs) {
    wallsFaces(g, x0, x1, y0, y1, z0, z1, us, vs, ["n", "s", "w", "e"]);
  }
  function top(g, x0, x1, y, z0, z1, us) {
    quad(g, [x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [x0 / us, z1 / us], [x1 / us, z1 / us], [x1 / us, z0 / us], [x0 / us, z0 / us]);
  }
  function bottom(g, x0, x1, y, z0, z1) {
    quad(g, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, -1, 0], [0, 0], [1, 0], [1, 1], [0, 1]);
  }
  function fullBox(g, x0, x1, y0, y1, z0, z1, us = 4, under = false) {
    walls(g, x0, x1, y0, y1, z0, z1, us, us);
    top(g, x0, x1, y1, z0, z1, us);
    if (under) bottom(g, x0, x1, y0, z0, z1);
  }
  function meshFrom(g, mat, cast = true) {
    for (const s of g.chunks.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(s.p, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(s.n, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(s.u, 2));
      geo.setAttribute("color", new THREE.Float32BufferAttribute(s.c, 3));
      mat.vertexColors = true;
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast;
      m.receiveShadow = true;
      m.matrixAutoUpdate = false;
      scene.add(m);
    }
  }
  function facadeTex(s) {
    const S = 512, C2 = 128, c = cv(2 * S, 2 * S), x = c.getContext("2d"), e = cv(2 * S, 2 * S), ex = e.getContext("2d");
    const rc = cv(2 * S, 2 * S), rx = rc.getContext("2d"), bc = cv(2 * S, 2 * S), bx2 = bc.getContext("2d"), mc = cv(2 * S, 2 * S), mx = mc.getContext("2d");
    for (const q of [x, ex, rx, bx2, mx]) q.scale(2, 2);
    mx.fillStyle = s.metal ? "#707070" : "#000";
    mx.fillRect(0, 0, S, S);
    const wr = Math.round(s.rough * 255);
    rx.fillStyle = `rgb(${wr},${wr},${wr})`;
    rx.fillRect(0, 0, S, S);
    bx2.fillStyle = "#9a9a9a";
    bx2.fillRect(0, 0, S, S);
    x.fillStyle = s.wall;
    x.fillRect(0, 0, S, S);
    ex.fillStyle = "#000";
    ex.fillRect(0, 0, S, S);
    for (let i = 0; i < 5e3; i++) {
      x.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)";
      x.fillRect(Math.random() * S, Math.random() * S, 2, 2);
    }
    if (s.brick) {
      for (let y = 0; y < S; y += 6) for (let xx = y / 6 % 2 * 7 - 7; xx < S; xx += 14) {
        const k = Math.random() * 0.14 - 0.07;
        x.fillStyle = k > 0 ? `rgba(255,220,200,${k})` : `rgba(0,0,0,${-k})`;
        x.fillRect(xx, y, 13, 5);
      }
      x.fillStyle = "rgba(0,0,0,.14)";
      for (let y = 0; y < S; y += 6) x.fillRect(0, y, S, 1);
      for (let y = 0; y < S; y += 6) for (let xx = y / 6 % 2 * 7; xx < S; xx += 14) x.fillRect(xx, y, 1, 6);
      bx2.fillStyle = "#7a7a7a";
      for (let y = 0; y < S; y += 6) bx2.fillRect(0, y, S, 1);
      for (let y = 0; y < S; y += 6) for (let xx = y / 6 % 2 * 7; xx < S; xx += 14) bx2.fillRect(xx, y, 1, 6);
    }
    for (let i = 0; i < 26; i++) {
      const px = Math.random() * S, py = Math.random() * S, rr2 = 30 + Math.random() * 70, gg = x.createRadialGradient(px, py, 0, px, py, rr2);
      gg.addColorStop(0, `rgba(30,25,20,${0.05 + Math.random() * 0.05})`);
      gg.addColorStop(1, "rgba(30,25,20,0)");
      x.fillStyle = gg;
      x.fillRect(px - rr2, py - rr2, rr2 * 2, rr2 * 2);
    }
    const [l, t, r, b] = s.inset;
    for (let j = 0; j < 4; j++) {
      if (s.band) {
        x.fillStyle = s.band;
        x.fillRect(0, j * C2 + C2 - b, S, b);
      } else {
        x.fillStyle = "rgba(0,0,0,.14)";
        x.fillRect(0, j * C2 + C2 - 8, S, 4);
      }
      for (let i = 0; i < 4; i++) {
        const X = i * C2 + l, Y = j * C2 + t, W = C2 - l - r, H = C2 - t - b;
        const g = x.createLinearGradient(0, Y, 0, Y + H);
        g.addColorStop(0, s.gTop);
        g.addColorStop(1, s.gBot);
        x.fillStyle = g;
        x.fillRect(X, Y, W, H);
        x.fillStyle = "rgba(18,22,30,.55)";
        x.fillRect(X, Y, W, H);
        rx.fillStyle = s.metal ? "#0a0a0a" : "#1c1c1c";
        rx.fillRect(X, Y, W, H);
        mx.fillStyle = s.metal ? "#d8d8d8" : "#a8a8a8";
        mx.fillRect(X, Y, W, H);
        {
          const kind = Math.random();
          if (kind < 0.28) {
            x.fillStyle = "rgba(205,195,170,.55)";
            const hh = H * (0.25 + Math.random() * 0.6);
            x.fillRect(X, Y, W, hh);
            x.fillStyle = "rgba(0,0,0,.18)";
            for (let yy = Y; yy < Y + hh; yy += 5) x.fillRect(X, yy, W, 1);
          } else if (kind < 0.5) {
            x.fillStyle = CURT[Math.floor(Math.random() * CURT.length)];
            x.fillRect(X, Y, W * 0.34, H);
            x.fillRect(X + W * 0.66, Y, W * 0.34, H);
          }
          x.fillStyle = "rgba(255,255,255,.09)";
          x.beginPath();
          x.moveTo(X + W * 0.1, Y + H);
          x.lineTo(X + W * 0.55, Y);
          x.lineTo(X + W * 0.75, Y);
          x.lineTo(X + W * 0.3, Y + H);
          x.fill();
        }
        x.fillStyle = "rgba(0,0,0,.4)";
        x.fillRect(X, Y, W, 4);
        x.fillRect(X, Y, 3, H);
        x.fillStyle = "rgba(255,255,255,.14)";
        x.fillRect(X, Y + H - 2, W, 2);
        if (s.frame) {
          x.fillStyle = "rgba(255,255,255,.1)";
          x.fillRect(X - 5, Y - 8, W + 10, 6);
          x.fillStyle = "rgba(0,0,0,.2)";
          x.fillRect(X - 5, Y - 2, W + 10, 2);
        }
        {
          const sg = x.createLinearGradient(0, Y + H, 0, Y + H + 40);
          sg.addColorStop(0, "rgba(20,16,12,.32)");
          sg.addColorStop(1, "rgba(20,16,12,0)");
          x.fillStyle = sg;
          x.fillRect(X + 3, Y + H, W - 6, 40);
        }
        bx2.fillStyle = "#5a5a5a";
        bx2.fillRect(X, Y, W, H);
        const q = Math.random();
        if (q < s.lit) {
          x.fillStyle = "rgba(255,205,130,.7)";
          x.fillRect(X, Y, W, H);
        } else if (q < s.lit + 0.3) {
          x.fillStyle = CURT[Math.floor(Math.random() * CURT.length)];
          x.fillRect(X, Y, W * 0.3, H);
          x.fillRect(X + W * 0.7, Y, W * 0.3, H);
        } else if (q < s.lit + 0.5) {
          x.fillStyle = "rgba(225,215,195,.4)";
          x.fillRect(X, Y, W, H * (0.2 + Math.random() * 0.5));
        }
        if (Math.random() < 0.42) {
          const warm = Math.random() < 0.8;
          ex.fillStyle = warm ? `rgb(255,${190 + Math.random() * 40 | 0},${110 + Math.random() * 50 | 0})` : "rgb(170,200,255)";
          ex.fillRect(X, Y, W, H);
          if (Math.random() < 0.5) {
            ex.fillStyle = "rgba(0,0,0,.6)";
            ex.fillRect(X, Y, W * 0.3, H);
          }
        }
        if (s.frame) {
          rx.strokeStyle = "#8c8c8c";
          rx.lineWidth = 4;
          rx.strokeRect(X, Y, W, H);
          bx2.fillStyle = "#c8c8c8";
          bx2.fillRect(X - 5, Y + H, W + 10, 6);
          bx2.strokeStyle = "#b0b0b0";
          bx2.lineWidth = 4;
          bx2.strokeRect(X, Y, W, H);
          x.strokeStyle = s.frame;
          x.lineWidth = 4;
          x.strokeRect(X, Y, W, H);
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(X + W / 2, Y);
          x.lineTo(X + W / 2, Y + H);
          x.moveTo(X, Y + H * 0.45);
          x.lineTo(X + W, Y + H * 0.45);
          x.stroke();
          x.fillStyle = s.frame;
          x.fillRect(X - 5, Y + H, W + 10, 6);
          x.fillStyle = "rgba(0,0,0,.3)";
          x.fillRect(X - 5, Y + H + 6, W + 10, 4);
          if (Math.random() < 0.12) {
            x.fillStyle = "#9ea3a8";
            x.fillRect(X + W * 0.3, Y + H - 22, W * 0.4, 20);
            x.fillStyle = "#6d7277";
            x.fillRect(X + W * 0.3, Y + H - 8, W * 0.4, 3);
          }
        } else {
          x.fillStyle = "rgba(0,0,0,.4)";
          x.fillRect(X + W - 2, Y, 4, H);
        }
      }
      if (s.band) {
        x.fillStyle = "rgba(0,0,0,.35)";
        for (let k = 0; k <= 4; k++) {
          x.fillRect(k * C2 - 1, j * C2, 3, C2);
          mx.fillStyle = "#303030";
          mx.fillRect(k * C2 - 1, j * C2, 3, C2);
        }
      }
      if (false) {
        x.strokeStyle = "#161616";
        x.lineWidth = 3;
        const fx = 128 + 10, fw = 236, fy = j * C2 + C2 - 16;
        x.fillStyle = "rgba(20,20,20,.9)";
        x.fillRect(fx, fy, fw, 5);
        for (let k = fx; k <= fx + fw; k += 12) {
          x.beginPath();
          x.moveTo(k, fy);
          x.lineTo(k, fy - 26);
          x.stroke();
        }
        x.beginPath();
        x.moveTo(fx, fy - 26);
        x.lineTo(fx + fw, fy - 26);
        x.stroke();
        x.beginPath();
        x.moveTo(fx + 30, fy);
        x.lineTo(fx + 110, fy - C2 + 16);
        x.stroke();
      }
    }
    const map = canvasTex(c, true), emi = canvasTex(e, true), rough = canvasTex(rc, true), bump = canvasTex(bc, true), metal = canvasTex(mc, true);
    return { map, emi, rough, bump, metal };
  }
  function groundAO(m, k = 0.5, h = 18) {
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = "varying float vWY;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vWY = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = "varying float vWY;\n" + sh.fragmentShader.replace("#include <map_fragment>", `#include <map_fragment>
  diffuseColor.rgb *= mix(${k.toFixed(2)}, 1.0, smoothstep(0.0, ${h.toFixed(1)}, vWY));`);
    };
    return m;
  }
  function waterNormals() {
    const N = 256, hgt = new Float32Array(N * N), c = cv(N, N), x = c.getContext("2d"), img = x.createImageData(N, N);
    const waves = Array.from({ length: 14 }, () => ({ kx: Math.round(rnd(-8, 8)), ky: Math.round(rnd(-8, 8)), a: rnd(0.3, 1), p: rnd(0, 6.28) }));
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let v = 0;
      for (const w of waves) v += w.a * Math.sin((w.kx * i + w.ky * j) / N * 6.2832 + w.p);
      hgt[j * N + i] = v;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const dx = hgt[j * N + (i + 1) % N] - hgt[j * N + (i + N - 1) % N], dy = hgt[(j + 1) % N * N + i] - hgt[(j + N - 1) % N * N + i];
      const nx = -dx * 0.6, ny = -dy * 0.6, l = Math.hypot(nx, ny, 1), k = (j * N + i) * 4;
      img.data[k] = (nx / l * 0.5 + 0.5) * 255;
      img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
      img.data[k + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  function shopTex() {
    const W = 1024, H = 512, c = cv(W, H), x = c.getContext("2d"), e = cv(W, H), ex = e.getContext("2d");
    ex.fillStyle = "#000";
    ex.fillRect(0, 0, W, H);
    const FONTS = ["bold 21px Arial", "bold 22px Georgia", "italic bold 22px Georgia", "bold 20px Verdana", "900 22px Impact"];
    for (let row = 0; row < 4; row++) for (let u = 0; u < 4; u++) {
      const X = u * 256, Y = row * 128, col = SIGNC[Math.floor(Math.random() * SIGNC.length)], name = SHOPS[Math.floor(Math.random() * SHOPS.length)];
      const stone = ["#3b3633", "#4a4440", "#2c2b2d", "#5a534b"][Math.floor(Math.random() * 4)];
      x.fillStyle = stone;
      x.fillRect(X, Y, 256, 128);
      for (let i = 0; i < 700; i++) {
        x.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.15)";
        x.fillRect(X + Math.random() * 256, Y + Math.random() * 128, 1.5, 1.5);
      }
      const dark = Math.random() < 0.35, sy = Y + 5, sh = 25;
      const sg = x.createLinearGradient(0, sy, 0, sy + sh);
      sg.addColorStop(0, dark ? "#1d1d1f" : col);
      sg.addColorStop(1, dark ? "#0f0f10" : "rgba(0,0,0,.35)");
      x.fillStyle = dark ? "#1d1d1f" : col;
      x.fillRect(X + 14, sy, 228, sh);
      x.fillStyle = sg;
      x.fillRect(X + 14, sy, 228, sh);
      x.fillStyle = "rgba(255,255,255,.18)";
      x.fillRect(X + 14, sy, 228, 2);
      x.fillStyle = "rgba(0,0,0,.5)";
      x.fillRect(X + 14, sy + sh, 228, 3);
      x.font = FONTS[Math.floor(Math.random() * FONTS.length)];
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillStyle = "rgba(0,0,0,.5)";
      x.fillText(name, X + 129, sy + sh / 2 + 2);
      x.fillStyle = dark ? "#e0b860" : "#fff";
      x.fillText(name, X + 128, sy + sh / 2 + 1);
      ex.font = x.font;
      ex.textAlign = "center";
      ex.textBaseline = "middle";
      ex.fillStyle = dark ? "#c09040" : "#ddd";
      ex.fillText(name, X + 128, sy + sh / 2 + 1);
      for (const lx of [X + 50, X + 128, X + 206]) {
        x.fillStyle = "#111";
        x.fillRect(lx - 3, sy - 4, 6, 4);
      }
      const gx = X + 16, gy = Y + 38, gw = 164, gh = 80;
      const wg = x.createLinearGradient(0, gy, 0, gy + gh);
      wg.addColorStop(0, "#5b4a36");
      wg.addColorStop(0.5, "#2a241f");
      wg.addColorStop(1, "#141414");
      x.fillStyle = wg;
      x.fillRect(gx, gy, gw, gh);
      const shelfC = ["#c0392b", "#e9c46a", "#2a9d8f", "#f4f1de", "#e76f51", "#457b9d", "#8d99ae", "#6a994e"];
      for (let r = 0; r < 3; r++) {
        const yy = gy + 22 + r * 20;
        x.fillStyle = "rgba(200,190,170,.35)";
        x.fillRect(gx + 6, yy, gw - 12, 2);
        for (let k = gx + 8; k < gx + gw - 10; k += 4 + Math.random() * 6) {
          x.fillStyle = shelfC[Math.floor(Math.random() * shelfC.length)];
          const ph = 5 + Math.random() * 9;
          x.globalAlpha = 0.55;
          x.fillRect(k, yy - ph, 3 + Math.random() * 3, ph);
          x.globalAlpha = 1;
        }
      }
      if (Math.random() < 0.6) {
        x.fillStyle = "rgba(15,12,10,.75)";
        const px = gx + 20 + Math.random() * (gw - 40);
        x.beginPath();
        x.arc(px, gy + 34, 5, 0, 7);
        x.fill();
        x.fillRect(px - 6, gy + 39, 12, 30);
      }
      const lg = x.createLinearGradient(0, gy, 0, gy + 30);
      lg.addColorStop(0, "rgba(255,220,160,.35)");
      lg.addColorStop(1, "rgba(255,220,160,0)");
      x.fillStyle = lg;
      x.fillRect(gx, gy, gw, 30);
      x.fillStyle = "rgba(190,210,235,.13)";
      x.beginPath();
      x.moveTo(gx + 20, gy + gh);
      x.lineTo(gx + 80, gy);
      x.lineTo(gx + 115, gy);
      x.lineTo(gx + 55, gy + gh);
      x.fill();
      x.fillStyle = "rgba(190,210,235,.07)";
      x.fillRect(gx, gy + gh - 18, gw, 18);
      if (Math.random() < 0.5) {
        x.fillStyle = "rgba(255,255,255,.75)";
        x.font = "bold 9px Arial";
        x.fillText(Math.random() < 0.5 ? "OTWARTE" : "-30%", gx + gw - 26, gy + 12);
      }
      x.strokeStyle = "#1a1b1d";
      x.lineWidth = 3;
      x.strokeRect(gx, gy, gw, gh);
      x.fillStyle = "#1a1b1d";
      x.fillRect(gx + gw / 2 - 1, gy, 3, gh);
      x.fillStyle = "#6b6e72";
      x.fillRect(gx, gy + gh, gw, 8);
      ex.fillStyle = "rgba(150,110,60,.9)";
      ex.fillRect(gx, gy, gw, gh * 0.7);
      const dx = X + 190, dy = Y + 40, dw = 48, dh = 86;
      x.fillStyle = "#1a1b1d";
      x.fillRect(dx - 3, dy - 3, dw + 6, dh + 3);
      const dg = x.createLinearGradient(0, dy, 0, dy + dh);
      dg.addColorStop(0, "#4a3c2c");
      dg.addColorStop(1, "#151515");
      x.fillStyle = dg;
      x.fillRect(dx, dy, dw, dh);
      x.fillStyle = "rgba(190,210,235,.12)";
      x.fillRect(dx + 6, dy, 10, dh);
      x.fillStyle = "#b8bcc2";
      x.fillRect(dx + dw - 9, dy + 38, 3, 16);
      ex.fillStyle = "rgba(120,90,50,.9)";
      ex.fillRect(dx, dy, dw, dh * 0.6);
    }
    const map = canvasTex(c, true), emi = canvasTex(e, true);
    map.wrapT = emi.wrapT = THREE.ClampToEdgeWrapping;
    return { map, emi };
  }
  function noiseCanvas(base, n, a, size = 256, spots2) {
    const c = cv(size, size), x = c.getContext("2d");
    x.fillStyle = base;
    x.fillRect(0, 0, size, size);
    for (let i = 0; i < n; i++) {
      x.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a * 0.8})`;
      x.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
    if (spots2) for (let i = 0; i < spots2.n; i++) {
      x.fillStyle = spots2.c[Math.floor(Math.random() * spots2.c.length)];
      x.beginPath();
      x.arc(Math.random() * size, Math.random() * size, 2 + Math.random() * spots2.r, 0, 7);
      x.fill();
    }
    return c;
  }
  function grassCanvas(size = 256) {
    const c = cv(size, size), x = c.getContext("2d");
    x.fillStyle = "#557f36";
    x.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      x.fillStyle = `rgba(${Math.random() < 0.5 ? "30,50,15" : "140,160,70"},${0.05 + Math.random() * 0.07})`;
      x.beginPath();
      x.arc(Math.random() * size, Math.random() * size, 10 + Math.random() * 30, 0, 7);
      x.fill();
    }
    x.lineWidth = 1;
    for (let i = 0; i < 9e3; i++) {
      const px = Math.random() * size, py = Math.random() * size, l = 2 + Math.random() * 4, k = 0.6 + Math.random() * 0.7;
      x.strokeStyle = `rgba(${70 * k | 0},${115 * k | 0},${40 * k | 0},0.55)`;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + (Math.random() - 0.5) * 2, py - l);
      x.stroke();
    }
    for (let i = 0; i < 14; i++) {
      x.fillStyle = Math.random() < 0.6 ? "#f2efe2" : "#e6d36a";
      x.beginPath();
      x.arc(Math.random() * size, Math.random() * size, 0.9, 0, 7);
      x.fill();
    }
    return c;
  }
  function stoneCanvas() {
    const S = 256, c = cv(S, S), x = c.getContext("2d");
    x.fillStyle = "#b5ac9e";
    x.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      const px = Math.random() * S, py = Math.random() * S, r = 20 + Math.random() * 60, g = x.createRadialGradient(px, py, 0, px, py, r);
      const d = Math.random() < 0.6;
      g.addColorStop(0, d ? "rgba(70,60,50,.08)" : "rgba(255,250,235,.07)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      x.fillStyle = g;
      x.fillRect(0, 0, S, S);
    }
    for (let i = 0; i < 900; i++) {
      x.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.035)" : "rgba(255,255,255,.03)";
      x.fillRect(Math.random() * S, Math.random() * S, 1, 1);
    }
    x.fillStyle = "rgba(60,50,40,.16)";
    for (let y = 0; y < S; y += 64) x.fillRect(0, y, S, 1.5);
    for (let y = 0; y < S; y += 64) for (let xx = y / 64 % 2 * 64; xx < S; xx += 128) x.fillRect(xx, y, 1.5, 64);
    return c;
  }
  function sidewalkCanvas() {
    const c = cv(256, 256), x = c.getContext("2d");
    x.fillStyle = "#9a958c";
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5e3; i++) {
      x.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,.06)" : "rgba(255,255,255,.05)";
      x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const k = Math.random() * 0.08;
      x.fillStyle = `rgba(0,0,0,${k})`;
      x.fillRect(i * 128, j * 128, 128, 128);
    }
    x.fillStyle = "rgba(0,0,0,.28)";
    x.fillRect(0, 0, 256, 2);
    x.fillRect(0, 128, 256, 2);
    x.fillRect(0, 0, 2, 256);
    x.fillRect(128, 0, 2, 256);
    for (let i = 0; i < 6; i++) {
      x.fillStyle = "rgba(40,40,40,.25)";
      x.beginPath();
      x.arc(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 4, 0, 7);
      x.fill();
    }
    return c;
  }
  function groundTex() {
    const S = 10, W = CX * S, H = CZ * S, c = cv(W, H), x = c.getContext("2d"), s0 = ST / 2 * S;
    x.fillStyle = "#56575c";
    x.fillRect(0, 0, W, H);
    for (let i = 0; i < 16e3; i++) {
      const g = 48 + Math.random() * 28 | 0;
      x.fillStyle = `rgba(${g},${g},${g + 4},.4)`;
      x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
    }
    const onRoad = () => {
      const ax = Math.random() < 0.5;
      return ax ? [Math.random() * W, Math.random() * s0 * 0.95] : [Math.random() * s0 * 0.95, Math.random() * H];
    };
    for (let i = 0; i < 14; i++) {
      const [px, py] = onRoad(), w = (4 + Math.random() * 14) * S, h = (2 + Math.random() * 4) * S, k = Math.random() < 0.6 ? 38 : 72;
      x.save();
      x.translate(px, py);
      x.rotate(Math.random() < 0.5 ? 0 : Math.PI / 2);
      x.fillStyle = `rgba(${k},${k},${k + 3},.55)`;
      x.fillRect(-w / 2, -h / 2, w, h);
      x.strokeStyle = "rgba(20,20,20,.35)";
      x.lineWidth = 1.5;
      x.strokeRect(-w / 2, -h / 2, w, h);
      x.restore();
    }
    x.strokeStyle = "rgba(25,25,28,.5)";
    x.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      let [px, py] = onRoad();
      x.beginPath();
      x.moveTo(px, py);
      for (let j = 0; j < 6; j++) {
        px += (Math.random() - 0.5) * 18;
        py += (Math.random() - 0.5) * 18;
        x.lineTo(px, py);
      }
      x.stroke();
    }
    for (let i = 0; i < 30; i++) {
      const [px, py] = onRoad(), r = 3 + Math.random() * 9;
      const gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, "rgba(15,15,18,.45)");
      gr.addColorStop(1, "rgba(15,15,18,0)");
      x.fillStyle = gr;
      x.beginPath();
      x.arc(px, py, r, 0, 7);
      x.fill();
    }
    const manhole = (px, py) => {
      const r = 0.42 * S;
      x.fillStyle = "#2f2c29";
      x.beginPath();
      x.arc(px, py, r + 1.5, 0, 7);
      x.fill();
      x.fillStyle = "#4a443d";
      x.beginPath();
      x.arc(px, py, r, 0, 7);
      x.fill();
      x.strokeStyle = "rgba(20,18,16,.8)";
      x.lineWidth = 1;
      for (let k = -r + 2; k < r; k += 2.5) {
        x.beginPath();
        x.moveTo(px - r * 0.8, py + k);
        x.lineTo(px + r * 0.8, py + k);
        x.stroke();
      }
    };
    manhole(W * 0.31, s0 * 0.5);
    manhole(s0 * 0.5, H * 0.62);
    manhole(W * 0.77, s0 * 0.45);
    manhole(s0 * 0.45, H * 0.18);
    const drain = (px, py, vert) => {
      x.fillStyle = "#1b1c1e";
      const w = (vert ? 0.5 : 1) * S, h = (vert ? 1 : 0.5) * S;
      x.fillRect(px - w / 2, py - h / 2, w, h);
      x.fillStyle = "#5b5d60";
      for (let k = 0; k < 5; k++) vert ? x.fillRect(px - w / 2, py - h / 2 + (k + 0.5) * h / 5, w, 1) : x.fillRect(px - w / 2 + (k + 0.5) * w / 5, py - h / 2, 1, h);
    };
    for (const fx of [0.25, 0.75]) {
      drain(s0 + BW * S * fx, s0 - 0.5 * S, false);
      drain(s0 + BW * S * fx, s0 + BD * S + 0.5 * S, false);
    }
    for (const fz of [0.3, 0.7]) {
      drain(s0 - 0.5 * S, s0 + BD * S * fz, true);
      drain(s0 + BW * S + 0.5 * S, s0 + BD * S * fz, true);
    }
    x.fillStyle = "#8e8981";
    x.fillRect(s0, s0, BW * S, BD * S);
    x.strokeStyle = "rgba(0,0,0,.13)";
    x.lineWidth = 1;
    for (let a = s0; a <= s0 + BW * S; a += 2 * S) {
      x.beginPath();
      x.moveTo(a, s0);
      x.lineTo(a, s0 + BD * S);
      x.stroke();
    }
    for (let a = s0; a <= s0 + BD * S; a += 2 * S) {
      x.beginPath();
      x.moveTo(s0, a);
      x.lineTo(s0 + BW * S, a);
      x.stroke();
    }
    for (let i = 0; i < 60; i++) {
      const k = Math.random() < 0.5 ? "rgba(0,0,0," : "rgba(255,250,240,";
      x.fillStyle = k + (0.04 + Math.random() * 0.07) + ")";
      x.fillRect(s0 + Math.floor(Math.random() * BW / 2) * 2 * S, s0 + Math.floor(Math.random() * BD / 2) * 2 * S, 2 * S, 2 * S);
    }
    for (let i = 0; i < 120; i++) {
      x.fillStyle = "rgba(40,40,40,.35)";
      x.beginPath();
      x.arc(s0 + Math.random() * BW * S, s0 + Math.random() * BD * S, 0.8 + Math.random(), 0, 7);
      x.fill();
    }
    x.fillStyle = "#6f6b64";
    x.fillRect(s0 + 3 * S, s0 + 3 * S, (BW - 6) * S, (BD - 6) * S);
    x.strokeStyle = "#c2bcb2";
    x.lineWidth = 3;
    x.strokeRect(s0 + 1, s0 + 1, BW * S - 2, BD * S - 2);
    x.fillStyle = "#d8b23a";
    x.fillRect(0, 0, 2, H);
    x.fillRect(W - 2, 0, 2, H);
    x.fillStyle = "rgba(235,235,235,.8)";
    for (let a = 0; a < W; a += 5 * S) {
      x.fillRect(a, 0, 2.5 * S, 1.5);
      x.fillRect(a, H - 1.5, 2.5 * S, 1.5);
    }
    x.fillStyle = "rgba(240,240,240,.85)";
    const cw = 3.5 * S, sw = 0.6 * S;
    for (let a = 0; a < s0 - sw; a += 1.2 * S) {
      x.fillRect(a, s0 + 2, sw, cw);
      x.fillRect(W - a - sw, s0 + 2, sw, cw);
      x.fillRect(a, H - s0 - cw - 2, sw, cw);
      x.fillRect(W - a - sw, H - s0 - cw - 2, sw, cw);
      x.fillRect(s0 + 2, a, cw, sw);
      x.fillRect(s0 + 2, H - a - sw, cw, sw);
      x.fillRect(W - s0 - cw - 2, a, cw, sw);
      x.fillRect(W - s0 - cw - 2, H - a - sw, cw, sw);
    }
    const rc = cv(W, H), rx = rc.getContext("2d");
    rx.fillStyle = "#f4f4f4";
    rx.fillRect(0, 0, W, H);
    for (let i = 0; i < 900; i++) {
      const k = 225 + Math.random() * 30 | 0;
      rx.fillStyle = `rgb(${k},${k},${k})`;
      rx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
    }
    const road = (fx) => {
      for (let n = 0; n < fx; n++) {
        const alongX = Math.random() < 0.5, px = alongX ? Math.random() * W : Math.random() * s0 * 0.9, py = alongX ? Math.random() * s0 * 0.9 : Math.random() * H;
        const r = 4 + Math.random() * 9;
        for (let q = 0, nq = 3 + Math.random() * 4 | 0; q < nq; q++) {
          const ox = px + (Math.random() - 0.5) * r * 2.2, oy = py + (Math.random() - 0.5) * r * 1.4, rr2 = r * (0.4 + Math.random() * 0.6);
          rx.fillStyle = "rgb(135,135,135)";
          rx.beginPath();
          rx.ellipse(ox, oy, rr2 * 1.4, rr2, Math.random() * 3, 0, 7);
          rx.fill();
          x.fillStyle = "rgba(0,0,0,.12)";
          x.beginPath();
          x.ellipse(ox, oy, rr2 * 1.5, rr2 * 1.1, 0, 0, 7);
          x.fill();
        }
      }
    };
    for (const lx of [s0 * 0.28, s0 * 0.72]) {
      rx.fillStyle = "rgb(222,222,222)";
      rx.fillRect(0, lx - 5, W, 10);
      rx.fillRect(lx - 5, 0, 10, H);
      x.fillStyle = "rgba(0,0,0,.14)";
      x.fillRect(0, lx - 5, W, 10);
      x.fillRect(lx - 5, 0, 10, H);
    }
    road(20);
    const t = canvasTex(c, true), r2 = canvasTex(rc, true);
    return { map: t, rough: r2 };
  }
  function neonTex(text, col) {
    const c = cv(512, 216), x = c.getContext("2d");
    x.fillStyle = "#0d0f14";
    x.fillRect(0, 0, 512, 216);
    x.strokeStyle = col;
    x.lineWidth = 6;
    x.shadowColor = col;
    x.shadowBlur = 18;
    x.strokeRect(14, 14, 484, 188);
    x.fillStyle = "#fff";
    x.font = "bold 64px Arial";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(text, 256, 108);
    x.fillStyle = col;
    x.shadowBlur = 30;
    x.fillText(text, 256, 108);
    return canvasTex(c);
  }
  function glowTexture(inner = "rgba(255,255,255,1)", outer = "rgba(255,255,255,0)") {
    const c = cv(64, 64), x = c.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, ".35)"));
    g.addColorStop(1, outer);
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return canvasTex(c);
  }
  function setFogEncoded(v) {
    fogEnc = v;
    if (lastTOD) applyFog(lastTOD);
  }
  function applyFog(T) {
    const h = skyU.hor.value;
    const c = displayColor([h.x * 0.97, h.y * 0.97, h.z * 0.97], T.exp);
    scene.fog.color.setRGB(c[0], c[1], c[2]);
  }
  function displayColor(c, exp) {
    let [r, g, b] = c.map((v) => v * exp / 0.6);
    [r, g, b] = [0.59719 * r + 0.35458 * g + 0.04823 * b, 0.076 * r + 0.90834 * g + 0.01566 * b, 0.0284 * r + 0.13383 * g + 0.83777 * b];
    const fit = (v) => (v * (v + 0.0245786) - 90537e-9) / (v * (0.983729 * v + 0.432951) + 0.238081);
    [r, g, b] = [fit(r), fit(g), fit(b)];
    [r, g, b] = [1.60475 * r - 0.53108 * g - 0.07367 * b, -0.10208 * r + 1.10813 * g - 605e-5 * b, -327e-5 * r - 0.07276 * g + 1.07602 * b];
    return [r, g, b].map((v) => {
      v = Math.min(1, Math.max(0, v));
      if (!fogEnc) return v;
      return v < 31308e-7 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    });
  }
  function buildSky() {
    scene.fog = new THREE.Fog(15381388, 140, 1500);
    scene.background = new THREE.Color(0);
    hemi = new THREE.HemisphereLight(16767416, 5063768, 0.35);
    scene.add(hemi);
    amb = new THREE.AmbientLight(8421536, 0.03);
    scene.add(amb);
    sun = new THREE.DirectionalLight(16761482, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -70;
    sc.right = 70;
    sc.top = 70;
    sc.bottom = -70;
    sc.near = 150;
    sc.far = 750;
    sun.shadow.bias = -4e-4;
    sun.shadow.normalBias = 0.05;
    scene.add(sun);
    scene.add(sun.target);
    skyU = {
      sunDir: { value: sunDir },
      top: { value: new V3() },
      mid: { value: new V3() },
      hor: { value: new V3() },
      glowC: { value: new V3() },
      disk: { value: 2.5 }
    };
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyU,
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }",
      fragmentShader: `uniform vec3 sunDir, top, mid, hor, glowC; uniform float disk; varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = mix(hor, mid, smoothstep(0.,.18,h)); c = mix(c, top, smoothstep(.14,.7,h));
        if(h<0.) c = mix(hor, hor*.7, smoothstep(0.,-.3,h));
        float s = max(dot(vP, sunDir), 0.);
        c += glowC*pow(s,5.)*.7 + glowC*pow(s,60.)*1.5 + vec3(1.,.95,.85)*pow(s,900.)*disk;
        vec3 fogC = hor*.97 + glowC*pow(s,4.)*.45; // przy horyzoncie niebo przechodzi w mgle (bez ostrego pasa)
        c = mix(fogC, c, smoothstep(-.01,.16,h));
        gl_FragColor = vec4(c,1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`
    });
    sky = new THREE.Mesh(new THREE.SphereGeometry(3e3, 32, 16), mat);
    sky.renderOrder = -2;
    sky.frustumCulled = false;
    scene.add(sky);
    const c = cv(1024, 1024), x = c.getContext("2d");
    for (let i = 0; i < 90; i++) {
      const px = Math.random() * 1024, py = Math.random() * 1024, rw = 60 + Math.random() * 220, rh = 10 + Math.random() * 30;
      const g = x.createRadialGradient(0, 0, 0, 0, 0, 1);
      const col = Math.random() < 0.5 ? "255,200,200" : "255,225,195";
      g.addColorStop(0, `rgba(${col},.55)`);
      g.addColorStop(1, `rgba(${col},0)`);
      x.save();
      x.translate(px, py);
      x.scale(rw, rh);
      x.fillStyle = g;
      x.beginPath();
      x.arc(0, 0, 1, 0, 7);
      x.fill();
      x.restore();
    }
    clouds = new THREE.Mesh(
      new THREE.PlaneGeometry(7e3, 7e3),
      new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide })
    );
    clouds.rotation.x = Math.PI / 2;
    clouds.frustumCulled = false;
    clouds.renderOrder = -1;
    scene.add(clouds);
    const sp = [];
    for (let i = 0; i < 1800; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * 6.283, y = Math.abs(u) * 0.95 + 0.05, r = Math.sqrt(1 - y * y);
      sp.push(Math.cos(a) * r * 2800, y * 2800, Math.sin(a) * r * 2800);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
    stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 16777215, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
    stars.frustumCulled = false;
    stars.renderOrder = -1;
    scene.add(stars);
    moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture("rgba(235,240,255,1)", "rgba(150,170,255,0)"), fog: false, depthWrite: false, transparent: true }));
    moon.scale.set(240, 240, 1);
    moon.renderOrder = -1;
    scene.add(moon);
  }
  function updateEnvMap(T) {
    try {
      if (!pmrem) {
        pmrem = new THREE.PMREMGenerator(renderer);
        skyScene = new THREE.Scene();
        skyScene.add(new THREE.Mesh(sky.geometry, sky.material));
      }
      sky.material.toneMapped = false;
      sky.material.needsUpdate = true;
      const old = envRT;
      envRT = pmrem.fromScene(skyScene, 0.03, 1, 4e3);
      sky.material.toneMapped = true;
      sky.material.needsUpdate = true;
      scene.environment = dbg("noenv") ? null : envRT.texture;
      if (old) old.dispose();
    } catch (e) {
      scene.environment = null;
    }
    scene.traverse((o) => {
      var _a4;
      const m = o.material;
      if (m && m.isMeshStandardMaterial) m.envMapIntensity = ((_a4 = m.userData.env) != null ? _a4 : 1) * T.env;
    });
  }
  function setTOD(name) {
    const T = TOD[name] || TOD.sunset;
    todName = TOD[name] ? name : "sunset";
    sunDir.set(...T.sun).normalize();
    lin3(skyU.top.value, T.top);
    lin3(skyU.mid.value, T.mid);
    lin3(skyU.hor.value, T.hor);
    lin3(skyU.glowC.value, T.glow);
    skyU.disk.value = T.disk;
    lastTOD = T;
    applyFog(T);
    scene.fog.near = T.fogN;
    scene.fog.far = T.fogF;
    linHex(sun.color, T.sunCol);
    sun.intensity = T.sunI;
    linHex(hemi.color, T.hemi[0]);
    linHex(hemi.groundColor, T.hemi[1]);
    hemi.intensity = T.hemi[2];
    amb.intensity = T.amb;
    clouds.material.opacity = T.cloud;
    linHex(clouds.material.color, T.cloudCol);
    linHex(water.material.color, T.water);
    linHex(pondM.material.color, T.water).multiplyScalar(0.45);
    pondM.material.color.g *= 1.15;
    stars.visible = T.stars > 0;
    moon.visible = name === "night";
    for (const m of facMats) m.emissiveIntensity = T.win;
    shopMat.emissiveIntensity = T.shop;
    lampMat.emissiveIntensity = 0.2 + T.lamps * 2;
    for (const m of boardMats) m.emissiveIntensity = 0.8 + T.lamps * 1.2;
    for (const g of glowPts) {
      g.visible = T.lamps > 0;
      g.material.opacity = T.lamps;
    }
    renderer.toneMappingExposure = T.exp;
    canvas.style.filter = { sunset: "sepia(.12) saturate(1.15) contrast(1.12) brightness(.96)", day: "saturate(1.12) contrast(1.06)", night: "saturate(1.08) contrast(1.1)" }[name] || "";
    updateEnvMap(T);
  }
  function updateEnv() {
    sky.position.copy(camera.position);
    clouds.position.set(camera.position.x, 700, camera.position.z);
    stars.position.copy(camera.position);
    moon.position.copy(camera.position).addScaledVector(sunDir, 2500);
    sun.position.copy(P.pos).addScaledVector(sunDir, 450);
    sun.target.position.copy(P.pos);
    sun.target.updateMatrixWorld();
    if (waterNormal) {
      waterNormal.offset.x = G.time * 4e-3;
      waterNormal.offset.y = G.time * 6e-3;
    }
  }
  function carveWalls(g, x0, x1, y0, y1, z0, z1, d) {
    const f = d.face, ga0 = d.c - d.gw / 2, ga1 = d.c + d.gw / 2;
    wallsFaces(g, x0, x1, y0, y1, z0, z1, 16, 14, ["n", "s", "w", "e"].filter((q) => q !== f));
    if (d.ns) {
      wallsFaces(g, x0, ga0, y0, y1, z0, z1, 16, 14, [f]);
      wallsFaces(g, ga1, x1, y0, y1, z0, z1, 16, 14, [f]);
      wallsFaces(g, ga0, ga1, d.gh, y1, z0, z1, 16, 14, [f]);
    } else {
      wallsFaces(g, x0, x1, y0, y1, z0, ga0, 16, 14, [f]);
      wallsFaces(g, x0, x1, y0, y1, ga1, z1, 16, 14, [f]);
      wallsFaces(g, x0, x1, d.gh, y1, ga0, ga1, 16, 14, [f]);
    }
  }
  function carveBoxes(d, x0, x1, y0, y1, z0, z1) {
    const r = d.room, ns = d.ns, ga0 = d.c - d.gw / 2, ga1 = d.c + d.gw / 2;
    const P2 = (u0, u1, v0, v1, ya, yb) => {
      if (u1 - u0 < 0.02 || v1 - v0 < 0.02 || yb - ya < 0.02) return;
      addBox(ns ? { x0: u0, x1: u1, z0: v0, z1: v1, y0: ya, y1: yb } : { x0: v0, x1: v1, z0: u0, z1: u1, y0: ya, y1: yb });
    };
    P2(r.fa0, r.cu0, r.fd0, r.fd1, y0, y1);
    P2(r.cu1, r.fa1, r.fd0, r.fd1, y0, y1);
    const front = r.doorV === r.fd1 ? [r.cv1, r.fd1] : [r.fd0, r.cv0];
    if (r.doorV === r.fd1) P2(r.cu0, r.cu1, r.fd0, r.cv0, y0, y1);
    else P2(r.cu0, r.cu1, r.cv1, r.fd1, y0, y1);
    P2(r.cu0, ga0, front[0], front[1], y0, y1);
    P2(ga1, r.cu1, front[0], front[1], y0, y1);
    P2(ga0, ga1, front[0], front[1], d.gh, y1);
    P2(r.cu0, r.cu1, r.cv0, r.cv1, SW + r.ch, y1);
    return { x0, x1, y0, y1, z0, z1 };
  }
  function solid(x0, x1, y0, y1, z0, z1, st, door) {
    if (door) carveWalls(facGeo[st], x0, x1, y0, y1, z0, z1, door);
    else walls(facGeo[st], x0, x1, y0, y1, z0, z1, 16, 14);
    top(roofGeo, x0, x1, y1, z0, z1, 10);
    if (x1 - x0 > 5 && z1 - z0 > 5 && y1 - y0 > 6) {
      const o = st >= 3 && st <= 4 ? 0.2 : 0.4, h = 0.7;
      fullBox(trimGeo, x0 - o, x1 + o, y1 - h, y1 - 0.05, z0 - o, z0 + 0.02, 4, true);
      fullBox(trimGeo, x0 - o, x1 + o, y1 - h, y1 - 0.05, z1 - 0.02, z1 + o, 4, true);
      fullBox(trimGeo, x0 - o, x0 + 0.02, y1 - h, y1 - 0.05, z0, z1, 4, true);
      fullBox(trimGeo, x1 - 0.02, x1 + o, y1 - h, y1 - 0.05, z0, z1, 4, true);
    }
    if (x1 - x0 > 8 && z1 - z0 > 8 && y1 - y0 > 10) {
      const pw = 0.7, po = 0.18;
      for (const [px, pz] of [[x0, z0], [x1 - pw, z0], [x0, z1 - pw], [x1 - pw, z1 - pw]])
        fullBox(trimGeo, px - (px === x0 ? po : 0), px + pw + (px === x0 ? 0 : po), y0, y1 - 0.7, pz - (pz === z0 ? po : 0), pz + pw + (pz === z0 ? 0 : po), 4);
      for (let y = y0 + 13.5; y < y1 - 4; y += 13.5) {
        const o = 0.22, h = 0.4;
        fullBox(trimGeo, x0 - o, x1 + o, y, y + h, z0 - o, z0 + 0.02, 4, true);
        fullBox(trimGeo, x0 - o, x1 + o, y, y + h, z1 - 0.02, z1 + o, 4, true);
        fullBox(trimGeo, x0 - o, x0 + 0.02, y, y + h, z0, z1, 4, true);
        fullBox(trimGeo, x1 - 0.02, x1 + o, y, y + h, z0, z1, 4, true);
      }
    }
    if (!door && y0 === 0 && x1 - x0 > 6 && z1 - z0 > 6 && y1 > 8) {
      const o = 0.14, h = 0.95;
      fullBox(trimGeo, x0 - o, x1 + o, 0, h, z0 - o, z0 + 0.02, 4);
      fullBox(trimGeo, x0 - o, x1 + o, 0, h, z1 - 0.02, z1 + o, 4);
      fullBox(trimGeo, x0 - o, x0 + 0.02, 0, h, z0, z1, 4);
      fullBox(trimGeo, x1 - 0.02, x1 + o, 0, h, z0, z1, 4);
    }
    return door ? carveBoxes(door, x0, x1, y0, y1, z0, z1) : addBox({ x0, x1, y0, y1, z0, z1 });
  }
  function parapet(b) {
    const t = 0.35, h = 0.5, { x0, x1, z0, z1, y1 } = b;
    fullBox(trimGeo, x0, x1, y1, y1 + h, z0, z0 + t);
    fullBox(trimGeo, x0, x1, y1, y1 + h, z1 - t, z1);
    fullBox(trimGeo, x0, x0 + t, y1, y1 + h, z0 + t, z1 - t);
    fullBox(trimGeo, x1 - t, x1, y1, y1 + h, z0 + t, z1 - t);
    for (const [px, pz] of [[x0 + 0.5, z0 + 0.5], [x1 - 0.5, z0 + 0.5], [x0 + 0.5, z1 - 0.5], [x1 - 0.5, z1 - 0.5]]) perches.push(new V3(px, y1, pz));
  }
  function storefront(X02, X1, Z02, Z1, bk, gap) {
    const H = 4.6, o = 0.06, row = () => Math.floor(srand() * 4), v = (r) => [r / 4, (r + 1) / 4];
    const side = (face, x0, x1, z0, z1) => {
      const [va, vb] = v(row());
      const g = shopGeo;
      if (face === "n") quad(g, [x1, 0.1, z0 - o], [x0, 0.1, z0 - o], [x0, H, z0 - o], [x1, H, z0 - o], [0, 0, -1], [-x1 / 16, 1 - vb], [-x0 / 16, 1 - vb], [-x0 / 16, 1 - va], [-x1 / 16, 1 - va]);
      if (face === "s") quad(g, [x0, 0.1, z1 + o], [x1, 0.1, z1 + o], [x1, H, z1 + o], [x0, H, z1 + o], [0, 0, 1], [x0 / 16, 1 - vb], [x1 / 16, 1 - vb], [x1 / 16, 1 - va], [x0 / 16, 1 - va]);
      if (face === "w") quad(g, [x0 - o, 0.1, z0], [x0 - o, 0.1, z1], [x0 - o, H, z1], [x0 - o, H, z0], [-1, 0, 0], [z0 / 16, 1 - vb], [z1 / 16, 1 - vb], [z1 / 16, 1 - va], [z0 / 16, 1 - va]);
      if (face === "e") quad(g, [x1 + o, 0.1, z1], [x1 + o, 0.1, z0], [x1 + o, H, z0], [x1 + o, H, z1], [1, 0, 0], [-z1 / 16, 1 - vb], [-z0 / 16, 1 - vb], [-z0 / 16, 1 - va], [-z1 / 16, 1 - va]);
      const along = face === "n" || face === "s" ? [x0, x1] : [z0, z1];
      for (let a = along[0] + 1.5; a < along[1] - 4; a += sr(5, 9)) {
        if (srand() < 0.45) continue;
        const w = sr(2.6, 4), c = a + w / 2;
        if (face === "n") awnings.push([c, z0 - 0.7, Math.PI, w]);
        else if (face === "s") awnings.push([c, z1 + 0.7, 0, w]);
        else if (face === "w") awnings.push([x0 - 0.7, c, -Math.PI / 2, w]);
        else awnings.push([x1 + 0.7, c, Math.PI / 2, w]);
      }
    };
    const run = (face) => {
      if (gap && gap.face === face) {
        if (face === "n" || face === "s") {
          if (gap.a0 - X02 > 0.8) side(face, X02, gap.a0, Z02, Z1);
          if (X1 - gap.a1 > 0.8) side(face, gap.a1, X1, Z02, Z1);
        } else {
          if (gap.a0 - Z02 > 0.8) side(face, X02, X1, Z02, gap.a0);
          if (Z1 - gap.a1 > 0.8) side(face, X02, X1, gap.a1, Z1);
        }
      } else side(face, X02, X1, Z02, Z1);
    };
    if (Z02 - bk.z0 < 4.5) run("n");
    if (bk.z1 - Z1 < 4.5) run("s");
    if (X02 - bk.x0 < 4.5) run("w");
    if (bk.x1 - X1 < 4.5) run("e");
  }
  function makeDoor(x0, x1, z0, z1, bk, type, name, forceFace, forceC) {
    const faces = [];
    if (z0 - bk.z0 < 4.5) faces.push("n");
    if (bk.z1 - z1 < 4.5) faces.push("s");
    if (x0 - bk.x0 < 4.5) faces.push("w");
    if (bk.x1 - x1 < 4.5) faces.push("e");
    const face = forceFace || faces[Math.floor(srand() * faces.length)];
    if (!face) return null;
    const spec = ROOMSPEC[type], big = type === "fisk", gw = big ? 3.4 : 1.7, gh = big ? 3.6 : 2.7, t = 0.5, margin = t + 0.8;
    const ns = face === "n" || face === "s", a0 = ns ? x0 : z0, a1 = ns ? x1 : z1, fd0 = ns ? z0 : x0, fd1 = ns ? z1 : x1;
    let c = forceC != null ? forceC : a0 + (a1 - a0) / 2 + (srand() - 0.5) * (a1 - a0 - 10);
    c = Math.max(a0 + margin + gw / 2, Math.min(a1 - margin - gw / 2, c));
    const cu0 = Math.max(a0 + margin, c - spec.cw / 2), cu1 = Math.min(a1 - margin, c + spec.cw / 2), cw = cu1 - cu0, cd = Math.min(spec.cd, fd1 - fd0 - 2 * t - 0.8);
    if (cw < Math.min(8, spec.cw * 0.7) || cd < 5.5) return null;
    const nx = face === "w" ? -1 : face === "e" ? 1 : 0, nz2 = face === "n" ? -1 : face === "s" ? 1 : 0;
    const doorV = nx + nz2 > 0 ? fd1 : fd0, sIn = doorV === fd1 ? -1 : 1, cvDoor = doorV + sIn * t, cvFar = cvDoor + sIn * cd;
    const room = { cu0, cu1, cv0: Math.min(cvDoor, cvFar), cv1: Math.max(cvDoor, cvFar), cvDoor, sIn, doorV, fd0, fd1, fa0: a0, fa1: a1, cw, cd, t, ch: spec.ch, uc: (cu0 + cu1) / 2 };
    room.bx0 = ns ? cu0 : room.cv0;
    room.bx1 = ns ? cu1 : room.cv1;
    room.bz0 = ns ? room.cv0 : cu0;
    room.bz1 = ns ? room.cv1 : cu1;
    room.W = (u, v) => {
      const A = room.uc + u, D = room.cvDoor + room.sIn * v;
      return ns ? [A, D] : [D, A];
    };
    const d = { x: ns ? c : doorV, z: ns ? doorV : c, nx, nz: nz2, type, name, big, gw, gh, face, ns, c, room };
    doors.push(d);
    return d;
  }
  function roofProps(b) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    parapet(b);
    if (w < 9 || d < 9) return;
    const n = 1 + Math.floor(srand() * 3);
    for (let i = 0; i < n; i++) {
      const x = sr(b.x0 + 2.5, b.x1 - 4), z = sr(b.z0 + 2.5, b.z1 - 4);
      fullBox(roofGeo, x, x + 1.6, b.y1, b.y1 + 1.1, z, z + 2.2, 6);
    }
    if (srand() < 0.4) {
      const x = sr(b.x0 + 2, b.x1 - 5), z = sr(b.z0 + 2, b.z1 - 5);
      fullBox(trimGeo, x, x + 3, b.y1, b.y1 + 2.6, z, z + 3, 4);
    }
    if (b.y1 < 85 && w > 11 && d > 11 && srand() < 0.45) tanks.push({ x: sr(b.x0 + 4, b.x1 - 4), y: b.y1, z: sr(b.z0 + 4, b.z1 - 4) });
    if (b.y1 > 80) for (let i = 0; i < 1 + Math.floor(srand() * 2); i++) masts.push({ x: sr(b.x0 + 2, b.x1 - 2), y: b.y1, z: sr(b.z0 + 2, b.z1 - 2), h: sr(6, 18) });
    if (b.y1 > 18 && b.y1 < 80 && w > 18 && srand() < 0.14) boards.push(b);
  }
  function slopeQuad(g, a, b, c, d) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz2 = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz2) || 1;
    nx /= l;
    ny /= l;
    nz2 /= l;
    if (ny < 0) {
      nx = -nx;
      ny = -ny;
      nz2 = -nz2;
    }
    const uv = (p) => [p[0] / 5, p[2] / 5];
    quad(g, a, b, c, d, [nx, ny, nz2], uv(a), uv(b), uv(c), uv(d));
  }
  function hipRoof(x0, x1, z0, z1, y, rise) {
    const o = 0.35;
    x0 -= o;
    x1 += o;
    z0 -= o;
    z1 += o;
    y -= 0.15;
    const w = x1 - x0, d = z1 - z0, top2 = y + rise + 0.15;
    const A = w >= d ? [x0 + d / 2, top2, (z0 + z1) / 2] : [(x0 + x1) / 2, top2, z0 + w / 2];
    const B = w >= d ? [x1 - d / 2, top2, (z0 + z1) / 2] : [(x0 + x1) / 2, top2, z1 - w / 2];
    const g = pitchGeo;
    slopeQuad(g, [x0, y, z1], [x1, y, z1], [B[0], B[1], B[2]], [A[0], A[1], A[2]]);
    slopeQuad(g, [x1, y, z0], [x0, y, z0], [A[0], A[1], A[2]], [B[0], B[1], B[2]]);
    slopeQuad(g, [x1, y, z1], [x1, y, z0], [B[0], B[1], B[2]], [B[0], B[1], B[2]]);
    slopeQuad(g, [x0, y, z0], [x0, y, z1], [A[0], A[1], A[2]], [A[0], A[1], A[2]]);
  }
  function wallBox(g, face, x0, x1, z0, z1, a0, a1, ya, yb, d0, d1) {
    const w = face === "n" ? z0 : face === "s" ? z1 : face === "w" ? x0 : x1, sg = face === "n" || face === "w" ? -1 : 1;
    const e0 = w + sg * d0, e1 = w + sg * d1, lo = Math.min(e0, e1), hi = Math.max(e0, e1);
    if (face === "n" || face === "s") fullBox(g, a0, a1, ya, yb, lo, hi, 4);
    else fullBox(g, lo, hi, ya, yb, a0, a1, 4);
  }
  function addSills(x0, x1, z0, z1, h, bk, dr) {
    const ch = cur.vs / 4;
    for (const face of streetFaces(x0, x1, z0, z1, bk)) {
      const ns = face === "n" || face === "s", a0 = (ns ? x0 : z0) + 0.3, a1 = (ns ? x1 : z1) - 0.3;
      for (let m = 1; m * ch < Math.min(h - 3, 19); m++) {
        const y = ((m + 0.25) / 4 - cur.vo) * cur.vs;
        if (y < 5 || y > Math.min(h - 3, 19)) continue;
        if (dr && dr.face === face && y < 7) continue;
        wallBox(trimGeo, face, x0, x1, z0, z1, a0, a1, y - 0.04, y + 0.1, 0, 0.17);
      }
    }
  }
  function addFireEscape(x0, x1, z0, z1, h, bk, dr) {
    const faces = streetFaces(x0, x1, z0, z1, bk).filter((q) => !dr || dr.face !== q);
    if (!faces.length) return;
    const face = faces[Math.floor(srand() * faces.length)], ns = face === "n" || face === "s", len = ns ? x1 - x0 : z1 - z0, ch = cur.vs / 4;
    const c = (ns ? x0 : z0) + 5 + srand() * Math.max(0.1, len - 10);
    const B = (a0, a1, ya, yb, d0, d1) => wallBox(ironGeo, face, x0, x1, z0, z1, a0, a1, ya, yb, d0, d1);
    let prev = null;
    for (let m = 1; m * ch < h - 3; m++) {
      const y = ((m + 0.25) / 4 - cur.vo) * cur.vs;
      if (y < 5.5 || y > h - 3.5) continue;
      B(c - 1.5, c + 1.5, y, y + 0.07, 0, 1.1);
      B(c - 1.5, c + 1.5, y + 0.95, y + 1, 1.04, 1.1);
      B(c - 1.5, c + 1.5, y + 0.5, y + 0.54, 1.04, 1.1);
      B(c - 1.5, c - 1.44, y + 0.07, y + 1, 0, 1.1);
      B(c + 1.44, c + 1.5, y + 0.07, y + 1, 0, 1.1);
      for (const a of [-0.5, 0.5]) B(c + a - 0.03, c + a + 0.03, y, y + 1, 1.04, 1.1);
      if (prev !== null) {
        B(c + 1, c + 1.06, prev, y, 0.12, 0.18);
        B(c + 1.3, c + 1.36, prev, y, 0.12, 0.18);
        for (let r = prev + 0.35; r < y; r += 0.35) B(c + 1, c + 1.36, r, r + 0.03, 0.12, 0.18);
      }
      prev = y;
    }
  }
  function addBalconies(x0, x1, z0, z1, h, bk, dr) {
    const ch = cur.vs / 4, cw = cur.us / 4;
    for (const face of streetFaces(x0, x1, z0, z1, bk)) {
      const ns = face === "n" || face === "s", lo = (ns ? x0 : z0) + 1.5, hi = (ns ? x1 : z1) - 1.5;
      for (let k = -2; k < Math.ceil((hi - lo) / cw) + 3; k++) {
        const a = ((k + 0.5) / 4 - cur.uo) * cur.us;
        if (a < lo || a > hi) continue;
        for (let m = 2; m * ch < h - 4 && balconyCount < 420; m++) {
          const y = ((m + 0.25) / 4 - cur.vo) * cur.vs;
          if (y < 6 || y > h - 3.5 || srand() > 0.07) continue;
          if (dr && dr.face === face && Math.abs(a - dr.c) < 3) continue;
          balconyCount++;
          const wd = cw * 0.42;
          wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a + wd, y - 0.05, y + 0.1, 0, 1);
          wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a + wd, y + 0.95, y + 1, 0.94, 1);
          wallBox(ironGeo, face, x0, x1, z0, z1, a - wd, a - wd + 0.05, y + 0.1, y + 1, 0, 1);
          wallBox(ironGeo, face, x0, x1, z0, z1, a + wd - 0.05, a + wd, y + 0.1, y + 1, 0, 1);
          for (let q = -2; q <= 2; q++) wallBox(ironGeo, face, x0, x1, z0, z1, a + q * wd * 0.4 - 0.025, a + q * wd * 0.4 + 0.025, y + 0.1, y + 0.95, 0.94, 1);
        }
      }
    }
  }
  function addAC(x0, x1, z0, z1, h, dr) {
    const per = 0.07 + srand() * 0.05;
    for (const face of ["n", "s", "w", "e"]) {
      const ns = face === "n" || face === "s", len = ns ? x1 - x0 : z1 - z0, cw = cur.us / 4, ch = cur.vs / 4;
      for (let k = -2; k < Math.ceil(len / cw) + 2; k++) {
        const a = ((k + 0.5) / 4 - cur.uo) * cur.us;
        const pos = ns ? a : a;
        if (pos < (ns ? x0 : z0) + 1.2 || pos > (ns ? x1 : z1) - 1.2) continue;
        for (let m = 1; m * ch < h - 4 && acUnits.length < 2600; m++) {
          const y = ((m + 0.54) / 4 - cur.vo) * cur.vs + cur.vs / 4 * 0;
          if (y < 5.2 || y > h - 2) continue;
          if (srand() > per) continue;
          if (dr && dr.face === face && Math.abs(pos - dr.c) < 3 && y < 8) continue;
          acUnits.push({ face, x: ns ? pos : face === "w" ? x0 - 0.3 : x1 + 0.3, z: ns ? face === "n" ? z0 - 0.3 : z1 + 0.3 : pos, y: y - 0.55, ns, c: 0.55 + srand() * 0.4 });
        }
      }
    }
  }
  function addCornice(x0, x1, z0, z1, h, st) {
    const glass = st === 3 || st === 4, p = glass ? 0.15 : 0.55;
    fullBox(trimGeo, x0 - p, x1 + p, h - 0.75, h - 0.15, z0 - p, z1 + p, 4);
    if (!glass) {
      const q = 0.28;
      fullBox(trimGeo, x0 - q, x1 + q, h - 1.25, h - 0.75, z0 - q, z1 + q, 4);
      fullBox(trimGeo, x0 - 0.12, x1 + 0.12, h - 1.6, h - 1.25, z0 - 0.12, z1 + 0.12, 4);
    }
  }
  function addBase(x0, x1, z0, z1, h, st) {
    const glass = st === 3 || st === 4;
    if (h > 8) fullBox(glass ? ironGeo : trimGeo, x0 - 0.22, x1 + 0.22, 4.65, 5.05, z0 - 0.22, z1 + 0.22, 4);
    if (!glass && h > 10) for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
      const ax = px === x0 ? -1 : 1, az = pz === z0 ? -1 : 1;
      const A = [px, px - ax * 0.9].sort((m, n) => m - n), Bz = [pz, pz + az * 0.12].sort((m, n) => m - n), Cx = [px, px + ax * 0.12].sort((m, n) => m - n), Dz = [pz, pz - az * 0.9].sort((m, n) => m - n);
      fullBox(trimGeo, A[0], A[1], 5.05, h - 1.6, Bz[0], Bz[1], 4);
      fullBox(trimGeo, Cx[0], Cx[1], 5.05, h - 1.6, Dz[0], Dz[1], 4);
    }
  }
  function building(x0, x1, z0, z1, h, st, dk, bk, pitched) {
    randomBuildingLook();
    let dr = null;
    if (bk && doors.length < 90 && srand() < 0.3) {
      const [t, n] = DOOR_TYPES[Math.floor(srand() * DOOR_TYPES.length)];
      dr = makeDoor(x0, x1, z0, z1, bk, t, n);
    }
    let b = solid(x0, x1, 0, h, z0, z1, st, dr);
    footprints.push({ x0, x1, z0, z1, h, dk });
    if (bk && h > 9) addAC(x0, x1, z0, z1, h, dr);
    if (bk && h > 9 && st !== 3 && st !== 4) addSills(x0, x1, z0, z1, h, bk, dr);
    if (bk && h > 14 && st === 0 && srand() < 0.6) addFireEscape(x0, x1, z0, z1, h, bk, dr);
    if (bk && h > 14 && (st === 1 || st === 2 || st === 5) && srand() < 0.55) addBalconies(x0, x1, z0, z1, h, bk, dr);
    if (bk && !pitched) {
      addBase(x0, x1, z0, z1, h, st);
      if (h < 140) addCornice(x0, x1, z0, z1, h, st);
    }
    if (bk) storefront(x0, x1, z0, z1, bk, dr ? { face: dr.face, a0: dr.c - dr.gw / 2 - 0.3, a1: dr.c + dr.gw / 2 + 0.3 } : null);
    if (h > 55 && srand() < 0.55) {
      const ix = Math.min(sr(3, 7), (x1 - x0) * 0.2), iz = Math.min(sr(3, 7), (z1 - z0) * 0.2), h2 = h + sr(12, h * 0.45);
      b = solid(x0 + ix, x1 - ix, h, h2, z0 + iz, z1 - iz, st);
      if (h2 < 160) addCornice(b.x0, b.x1, b.z0, b.z1, h2, st);
      footprints.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: h2, dk });
      if (h2 > 110 && srand() < 0.5) {
        const jx = (b.x1 - b.x0) * 0.2, jz = (b.z1 - b.z0) * 0.2, h3 = h2 + sr(10, 40);
        b = solid(b.x0 + jx, b.x1 - jx, h2, h3, b.z0 + jz, b.z1 - jz, st);
        footprints.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, h: h3, dk });
      }
    }
    if (pitched) {
      const rise = 1.7 + srand() * 1.4, ins = Math.min(1.8, (x1 - x0) / 4, (z1 - z0) / 4);
      hipRoof(x0, x1, z0, z1, h, rise);
      const core = addBox({ x0: x0 + ins, x1: x1 - ins, y0: h, y1: h + rise * 0.72, z0: z0 + ins, z1: z1 - ins });
      const cx = x0 + (x1 - x0) * (0.3 + srand() * 0.4), cz = (z0 + z1) / 2;
      fullBox(trimGeo, cx - 0.5, cx + 0.5, h + rise * 0.3, h + rise + 1.3, cz - 0.5, cz + 0.5, 4);
      roofs.push(core);
      return;
    }
    roofs.push(b);
    roofProps(b);
  }
  function tiers(cx, cz, T, st, dk, door) {
    randomBuildingLook();
    let b, first = true;
    for (const [hw, hd, y0, y1, s] of T) {
      b = solid(cx - hw, cx + hw, y0, y1, cz - hd, cz + hd, s != null ? s : st, first ? door : null);
      first = false;
      footprints.push({ x0: cx - hw, x1: cx + hw, z0: cz - hd, z1: cz + hd, h: y1, dk });
    }
    roofs.push(b);
    parapet(b);
    return b;
  }
  function spire(x, z, y0, y1, r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r, y1 - y0, 8), new THREE.MeshStandardMaterial({ color: 10132126, metalness: 0.7, roughness: 0.35 }));
    m.position.set(x, (y0 + y1) / 2, z);
    m.castShadow = true;
    scene.add(m);
    addBox({ x0: x - r, x1: x + r, y0, y1, z0: z - r, z1: z + r });
    masts.push({ x, y: y1, z, h: 0.01 });
  }
  function buildGround() {
    const LW = LAND.x1 - LAND.x0, LD = LAND.z1 - LAND.z0;
    const gt = groundTex();
    for (const t of [gt.map, gt.rough]) {
      t.repeat.set(LW / CX, LD / CZ);
      t.offset.set(-24 / CX, -24 / CZ);
    }
    const g = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD), new THREE.MeshStandardMaterial({ map: gt.map, roughnessMap: gt.rough, roughness: 1, metalness: 0 }));
    g.rotation.x = -Math.PI / 2;
    g.position.y = 0.02;
    g.receiveShadow = true;
    scene.add(g);
    {
      const c = cv(256, 256), x = c.getContext("2d");
      x.fillStyle = "#ffffff";
      x.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 9e3; i++) {
        const k = 150 + Math.random() * 105 | 0;
        x.fillStyle = `rgb(${k},${k},${k})`;
        x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
      }
      for (let i = 0; i < 500; i++) {
        x.fillStyle = "rgb(250,250,250)";
        x.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
      }
      const t = canvasTex(c, true);
      t.repeat.set(LW / 3, LD / 3);
      t.encoding = THREE.LinearEncoding;
      const m = new THREE.MeshBasicMaterial({ map: t, blending: THREE.MultiplyBlending, transparent: true, premultipliedAlpha: true, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      m.userData.lin = true;
      const gr = new THREE.Mesh(new THREE.PlaneGeometry(LW, LD), m);
      gr.rotation.x = -Math.PI / 2;
      gr.position.y = 0.025;
      gr.renderOrder = 1;
      scene.add(gr);
    }
    const base = new THREE.Mesh(new THREE.BoxGeometry(LW, 6, LD), new THREE.MeshStandardMaterial({ color: 7828074, roughness: 1 }));
    base.position.y = -3;
    scene.add(base);
    waterNormal = waterNormals();
    waterNormal.repeat.set(9e3 / 30, 9e3 / 30);
    water = new THREE.Mesh(new THREE.PlaneGeometry(9e3, 9e3), new THREE.MeshStandardMaterial({ color: 6123398, roughness: 0.16, metalness: 0.55, normalMap: waterNormal, normalScale: new THREE.Vector2(0.7, 0.7) }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = -1.2;
    water.receiveShadow = true;
    scene.add(water);
    const shoreMat = new THREE.MeshStandardMaterial({ color: 6119250, roughness: 1 });
    const shore = (x0, x1, z0, z1) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 4, z1 - z0), shoreMat);
      m.position.set((x0 + x1) / 2, -1.5, (z0 + z1) / 2);
      scene.add(m);
    };
    const W0 = LAND.x0 - 270, E0 = LAND.x1 + 230, N0 = LAND.z0 - 90;
    shore(-5e3, W0, -5e3, 5e3);
    shore(E0, 5e3, -5e3, 5e3);
    shore(W0, E0, -5e3, N0);
    bridge(LAND.x1 - 6, E0 + 30, Z0 + CD * 0.86, "stone");
    bridge(LAND.x1 - 6, E0 + 30, Z0 + CD * 0.62, "steel");
    bridge(W0 - 30, LAND.x0 + 6, Z0 + CD * 0.08, "steel");
    for (let i = 0; i < 760; i++) {
      const side = srand();
      let x, z, h = sr(6, 38), w = sr(12, 40), d = sr(12, 40);
      if (side < 0.42) {
        x = sr(W0 - 420, W0 - 20);
        z = sr(-1500, 1500);
        if ((z > 150 || z < -700) && srand() < 0.3) {
          h = sr(60, 190);
          w = sr(16, 30);
          d = sr(16, 30);
        }
      } else if (side < 0.84) {
        x = sr(E0 + 20, E0 + 420);
        z = sr(-1500, 1500);
        if (z > 300 && z < 900 && srand() < 0.35) {
          h = sr(50, 150);
          w = sr(16, 28);
          d = sr(16, 28);
        }
      } else {
        x = sr(W0, E0);
        z = sr(N0 - 400, N0 - 20);
      }
      walls(farGeo, x - w / 2, x + w / 2, 0.5, h, z - d / 2, z + d / 2, 16, 14);
      top(farGeo, x - w / 2, x + w / 2, h, z - d / 2, z + d / 2, 10);
    }
  }
  function bridge(xa, xb, z, kind) {
    const stone = kind === "stone", deckY = 38, W = 13, L = xb - xa;
    const tm = new THREE.MeshStandardMaterial(stone ? { color: 11048316, roughness: 0.9 } : { color: 7306374, roughness: 0.5, metalness: 0.5 });
    const dm = new THREE.MeshStandardMaterial({ color: 3816770, roughness: 0.8 }), cm = new THREE.MeshStandardMaterial({ color: stone ? 8159108 : 9082270, roughness: 0.5, metalness: 0.6 });
    const add = (geo, m, x, y, zz) => {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x, y, zz);
      o.castShadow = false;
      o.receiveShadow = true;
      scene.add(o);
      return o;
    };
    const ramp = Math.min(70, L * 0.22), mid0 = xa + ramp, mid1 = xb - ramp;
    add(new THREE.BoxGeometry(mid1 - mid0, 2.2, W), dm, (mid0 + mid1) / 2, deckY, z);
    addBox({ x0: mid0, x1: mid1, y0: deckY - 1.1, y1: deckY + 1.1, z0: z - W / 2, z1: z + W / 2 });
    for (const [a, b] of [[xa, mid0], [mid1, xb]]) {
      const up = a === xa, g = new THREE.BoxGeometry(Math.hypot(b - a, deckY), 2.2, W), m = add(g, dm, (a + b) / 2, deckY / 2, z);
      m.rotation.z = (up ? 1 : -1) * Math.atan2(deckY, b - a);
    }
    add(new THREE.BoxGeometry(mid1 - mid0, 1.2, 0.3), cm, (mid0 + mid1) / 2, deckY + 1.7, z - W / 2);
    add(new THREE.BoxGeometry(mid1 - mid0, 1.2, 0.3), cm, (mid0 + mid1) / 2, deckY + 1.7, z + W / 2);
    const tH = stone ? 84 : 92, tx = [xa + L * 0.3, xb - L * 0.3];
    for (const x of tx) {
      if (stone) {
        add(new THREE.BoxGeometry(10, tH, 4.5), tm, x, tH / 2, z - W / 2 - 1.5);
        add(new THREE.BoxGeometry(10, tH, 4.5), tm, x, tH / 2, z + W / 2 + 1.5);
        add(new THREE.BoxGeometry(10, tH - deckY - 22, W + 3), tm, x, deckY + 22 + (tH - deckY - 22) / 2, z);
        add(new THREE.BoxGeometry(11, 3, W + 13), tm, x, tH, z);
        add(new THREE.BoxGeometry(12, deckY - 4, W + 14), tm, x, (deckY - 4) / 2, z);
      } else {
        for (const zz of [z - W / 2 - 1, z + W / 2 + 1]) add(new THREE.BoxGeometry(3.5, tH, 3.5), tm, x, tH / 2, zz);
        for (let y = deckY + 12; y < tH; y += 16) add(new THREE.BoxGeometry(2.5, 2, W + 4), tm, x, y, z);
        for (let y = deckY + 12; y < tH - 10; y += 16) for (const sgn of [1, -1]) {
          const d = add(new THREE.BoxGeometry(0.8, Math.hypot(16, W + 2), 0.8), tm, x, y + 8, z);
          d.rotation.x = sgn * Math.atan2(W + 2, 16);
        }
        add(new THREE.BoxGeometry(8, deckY - 4, W + 8), new THREE.MeshStandardMaterial({ color: 9077624, roughness: 0.9 }), x, (deckY - 4) / 2, z);
      }
      addBox({ x0: x - 5, x1: x + 5, y0: 0, y1: tH, z0: z - W / 2 - 4, z1: z - W / 2 + 0.2 });
      addBox({ x0: x - 5, x1: x + 5, y0: 0, y1: tH, z0: z + W / 2 - 0.2, z1: z + W / 2 + 4 });
      perches.push(new V3(x, tH + 1.5, z));
    }
    const cable = (zz) => {
      const pts2 = [], sag = (x) => {
        if (x < tx[0]) return deckY + 2 + (tH - deckY - 2) * (x - xa) / (tx[0] - xa);
        if (x > tx[1]) return deckY + 2 + (tH - deckY - 2) * (xb - x) / (xb - tx[1]);
        const t = (x - tx[0]) / (tx[1] - tx[0]);
        return tH - (tH - deckY - 4) * 4 * t * (1 - t);
      };
      for (let x = mid0 - ramp * 0.5; x <= mid1 + ramp * 0.5; x += 6) pts2.push(new V3(x, sag(x), zz));
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts2), 80, 0.45, 6, false), cm, 0, 0, 0);
      const seg = [];
      for (let x = mid0; x <= mid1; x += 4) {
        const y = sag(x);
        if (y > deckY + 3) seg.push(x, deckY + 1, zz, x, y, zz);
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
      const l = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 5922662, transparent: true, opacity: 0.8 }));
      scene.add(l);
    };
    cable(z - W / 2 - 0.2);
    cable(z + W / 2 + 0.2);
    const lp = [];
    for (let x = mid0; x <= mid1; x += 14) lp.push(x, deckY + 3.5, z - W / 2, x, deckY + 3.5, z + W / 2);
    glowPoints(lp, 16766362, 4);
  }
  function buildPark(inst) {
    const gt = canvasTex(grassCanvas(), true);
    gt.repeat.set((PK.x1 - PK.x0) / 9, (PK.z1 - PK.z0) / 9);
    const PW = PK.x1 - PK.x0, PD = PK.z1 - PK.z0, cx0 = (PK.x0 + PK.x1) / 2, cz0 = (PK.z0 + PK.z1) / 2;
    const pg = new THREE.PlaneGeometry(PW, PD, Math.ceil(PW / 6), Math.ceil(PD / 6)), pp2 = pg.attributes.position, pc = [];
    const pathsX = [cx0 - 60, cx0 + 70], pathsZ = [PK.z0 + PD * 0.15, PK.z0 + PD * 0.42];
    for (let i = 0; i < pp2.count; i++) {
      const wx = cx0 + pp2.getX(i), wz = cz0 - pp2.getY(i);
      let k = 1 + 0.13 * Math.sin(wx * 0.021 + Math.sin(wz * 0.013) * 2) * Math.cos(wz * 0.017 + 1.3) + 0.07 * Math.sin(wx * 0.07 + wz * 0.05);
      k += (Math.floor(wx / 9) % 2 ? 0.05 : -0.05) * (Math.abs(wz - cz0) < PD * 0.4 ? 1 : 0);
      let dry = 0;
      for (const px of pathsX) dry = Math.max(dry, 1 - Math.abs(wx - px) / 7);
      for (const pz of pathsZ) dry = Math.max(dry, 1 - Math.abs(wz - pz) / 7);
      const pe = Math.sqrt(((wx - POND.x) / POND.rx) ** 2 + ((wz - POND.z) / POND.rz) ** 2);
      if (pe < 1.15) k *= 0.82;
      dry = Math.max(0, dry) * 0.6;
      pc.push(k * (1 + dry * 0.35), k * (1 - dry * 0.05), k * (1 - dry * 0.3));
    }
    pg.setAttribute("color", new THREE.Float32BufferAttribute(pc, 3));
    const g = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: gt, roughness: 1, vertexColors: true }));
    g.rotation.x = -Math.PI / 2;
    g.position.set((PK.x0 + PK.x1) / 2, 0.06, (PK.z0 + PK.z1) / 2);
    g.receiveShadow = true;
    scene.add(g);
    pondM = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: 5994128, roughness: 0.08, metalness: 0.35, normalMap: waterNormal, normalScale: new THREE.Vector2(0.2, 0.2) }));
    pondM.rotation.x = -Math.PI / 2;
    pondM.scale.set(POND.rx, POND.rz, 1);
    pondM.position.set(POND.x, 0.1, POND.z);
    scene.add(pondM);
    {
      const mud = new THREE.Mesh(new THREE.RingGeometry(0.97, 1.07, 96, 1), new THREE.MeshStandardMaterial({ color: 5917754, roughness: 1 }));
      mud.rotation.x = -Math.PI / 2;
      mud.scale.set(POND.rx, POND.rz, 1);
      mud.position.set(POND.x, 0.11, POND.z);
      mud.receiveShadow = true;
      scene.add(mud);
      const stones = [], reeds = [];
      for (let i = 0; i < 260; i++) {
        const a = srand() * Math.PI * 2, r = 0.985 + srand() * 0.06;
        stones.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, s: sr(0.25, 0.75), r: srand() * 6 });
      }
      for (let c = 0; c < 9; c++) {
        const a0 = srand() * Math.PI * 2;
        for (let i = 0; i < 70; i++) {
          const a = a0 + sr(-0.12, 0.12), r = sr(0.9, 1);
          reeds.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, h: sr(1.1, 2.2), t: sr(-0.25, 0.25), r: srand() * 6 });
        }
      }
      const sg = new THREE.DodecahedronGeometry(1, 0);
      sg.scale(1, 0.45, 0.8);
      buildInstanced(sg, new THREE.MeshStandardMaterial({ color: 8814970, roughness: 0.9, flatShading: true }), stones, (o, t) => {
        o.position.set(t.x, 0.12, t.z);
        o.rotation.set(0, t.r, 0);
        o.scale.setScalar(t.s);
      });
      const rg = new THREE.ConeGeometry(0.035, 1, 4);
      rg.translate(0, 0.5, 0);
      buildInstanced(rg, new THREE.MeshStandardMaterial({ color: 8227397, roughness: 0.9 }), reeds, (o, t) => {
        o.position.set(t.x, 0.1, t.z);
        o.rotation.set(t.t, t.r, t.t * 0.5);
        o.scale.set(1, t.h, 1);
      });
      const lily = [];
      for (let i = 0; i < 60; i++) {
        const a = srand() * Math.PI * 2, r = sr(0.55, 0.9);
        lily.push({ x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, s: sr(0.35, 0.8), r: srand() * 6 });
      }
      const lg = new THREE.CircleGeometry(1, 10, 0.4, Math.PI * 2 - 0.4);
      lg.rotateX(-Math.PI / 2);
      buildInstanced(lg, new THREE.MeshStandardMaterial({ color: 5208628, roughness: 0.6 }), lily, (o, t) => {
        o.position.set(t.x, 0.13, t.z);
        o.rotation.set(0, t.r, 0);
        o.scale.setScalar(t.s);
      }, false);
    }
    const pm = new THREE.MeshStandardMaterial({ color: 11904910, roughness: 1 });
    const path = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), pm);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.08, z);
      m.receiveShadow = true;
      scene.add(m);
    };
    const cx = (PK.x0 + PK.x1) / 2;
    path(cx - 60, (PK.z0 + PK.z1) / 2, 5, PK.z1 - PK.z0);
    path(cx + 70, (PK.z0 + PK.z1) / 2 - 60, 5, PK.z1 - PK.z0 - 120);
    for (const f of [0.15, 0.42]) path(cx, PK.z0 + (PK.z1 - PK.z0) * f, PK.x1 - PK.x0, 4.5);
    export_arena.x = cx;
    export_arena.z = PK.z1 - 70;
    for (let i = 0; i < 560; i++) {
      const x = sr(PK.x0 + 4, PK.x1 - 4), z = sr(PK.z0 + 4, PK.z1 - 4);
      if (((x - POND.x) / (POND.rx + 5)) ** 2 + ((z - POND.z) / (POND.rz + 5)) ** 2 < 1) continue;
      if (Math.hypot(x - export_arena.x, z - export_arena.z) < 62) continue;
      inst.push({ x, z, s: sr(2.4, 4.4), h: sr(2.5, 4.5) });
    }
  }
  function buildTrees(list) {
    const trunk = new THREE.CylinderGeometry(0.13, 0.34, 1, 8);
    trunk.translate(0, 0.5, 0);
    const crown = (() => {
      const pos = [], col2 = [], idx = [], nor = [];
      let base = 0;
      const lobes = [[0, 0.1, 0, 0.75], [0.45, -0.05, 0.1, 0.5], [-0.42, 0, -0.15, 0.52], [0.1, 0.05, 0.48, 0.48], [-0.1, 0, -0.5, 0.5], [0.05, 0.55, 0.05, 0.45], [0.35, 0.3, -0.35, 0.38]];
      for (const [lx, ly, lz, lr] of lobes) {
        const g = new THREE.IcosahedronGeometry(lr, 2), p = g.attributes.position, ix = g.index ? g.index.array : null;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
          const n = 1 + 0.16 * Math.sin(x * 9 + lx * 7) * Math.cos(z * 8 + ly * 5) + 0.1 * Math.sin(y * 13 + lz * 9);
          const X = lx + x * n, Y = ly + y * n * 0.82, Z = lz + z * n;
          pos.push(X, Y, Z);
          nor.push(x / l * 0.8 + X * 0.25, y / l * 0.8 + Y * 0.25 + 0.15, z / l * 0.8 + Z * 0.25);
          const k = 0.62 + 0.5 * Math.min(1, Math.max(0, (Y + 0.7) / 1.5)) + 0.12 * Math.sin(X * 17 + Z * 11);
          col2.push(k, k, k);
        }
        if (ix) for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base);
        else for (let i = 0; i < p.count; i++) idx.push(i + base);
        base += p.count;
      }
      const G2 = new THREE.BufferGeometry();
      G2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      G2.setAttribute("color", new THREE.Float32BufferAttribute(col2, 3));
      G2.setIndex(idx);
      const nv = new THREE.Vector3();
      for (let i = 0; i < nor.length; i += 3) {
        nv.set(nor[i], nor[i + 1], nor[i + 2]).normalize();
        nor[i] = nv.x;
        nor[i + 1] = nv.y;
        nor[i + 2] = nv.z;
      }
      G2.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
      return G2;
    })();
    const tm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas("#5a4030", 3e3, 0.15, 128), true), roughness: 1 });
    const cm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas("#dddddd", 4e3, 0.18, 128), true), roughness: 0.92, vertexColors: true });
    const T = new THREE.InstancedMesh(trunk, tm, list.length), C2 = new THREE.InstancedMesh(crown, cm, list.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    const pal = [5208623, 6130229, 4155946, 7311162, 12089390, 10506797, 8032053];
    list.forEach((t, i) => {
      o.position.set(t.x, t.y || 0, t.z);
      o.rotation.set(0, srand() * 6, 0);
      o.scale.set(1, t.h, 1);
      o.updateMatrix();
      T.setMatrixAt(i, o.matrix);
      o.position.set(t.x, (t.y || 0) + t.h + t.s * 0.45, t.z);
      o.rotation.set(0, srand() * 6, 0);
      o.scale.set(t.s * 1.5, t.s * 1.5, t.s * 1.5);
      o.updateMatrix();
      C2.setMatrixAt(i, o.matrix);
      col.setHex(pal[Math.floor(srand() * pal.length)]);
      C2.setColorAt(i, col);
    });
    for (const m of [T, C2]) {
      m.castShadow = false;
      m.receiveShadow = true;
      m.frustumCulled = false;
      scene.add(m);
    }
  }
  function buildInstanced(geo, mat, items, place, cast = true) {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length)), o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(0, 0, 0);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, 1, 1);
      place(o, it, i);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.count = items.length;
    m.castShadow = false;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  function glowPoints(pos, color, size) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ map: glowTexture(), color, size, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    p.frustumCulled = false;
    scene.add(p);
    glowPts.push(p);
    return p;
  }
  function buildTrafficLights(list) {
    const metal = new THREE.MeshStandardMaterial({ color: 2830387, metalness: 0.6, roughness: 0.45 });
    const pole = new THREE.CylinderGeometry(0.09, 0.12, 6, 8);
    pole.translate(0, 3, 0);
    const arm = new THREE.BoxGeometry(4.6, 0.12, 0.12);
    arm.translate(-2.3, 5.8, 0);
    const head = new THREE.BoxGeometry(0.36, 1, 0.34);
    head.translate(-4.4, 5.25, 0);
    const put = (o, t) => o.position.set(t[0], SW, t[1]);
    buildInstanced(pole, metal, list, put);
    buildInstanced(arm, metal, list, put);
    buildInstanced(head, new THREE.MeshStandardMaterial({ color: 1711392, roughness: 0.6 }), list, put);
    const lg = new THREE.BoxGeometry(0.2, 0.2, 0.36);
    lg.translate(-4.4, 0, 0);
    const lm = buildInstanced(lg, new THREE.MeshBasicMaterial({ color: 16777215 }), list, (o, t) => o.position.set(t[0], SW + (t[2] ? 4.92 : 5.58), t[1]), false);
    const col = new THREE.Color();
    list.forEach((t, i) => lm.setColorAt(i, col.setHex(t[2] ? 3800938 : 16722458)));
    linearize(lm);
    glowPoints(list.flatMap((t) => [t[0] - 4.4, SW + (t[2] ? 4.92 : 5.58), t[1]]), 16765088, 1.6);
  }
  function buildDoors() {
    const frameG = trimGeo, gl = [];
    for (const d of doors) {
      const w = d.gw, h = d.gh, tx = -d.nz, tz = d.nx;
      const box = (g, a0, a1, y0, y1, o0, o1) => {
        const ax0 = d.x + tx * a0 + d.nx * o0, ax1 = d.x + tx * a1 + d.nx * o1, az0 = d.z + tz * a0 + d.nz * o0, az1 = d.z + tz * a1 + d.nz * o1;
        fullBox(g, Math.min(ax0, ax1), Math.max(ax0, ax1), y0, y1, Math.min(az0, az1), Math.max(az0, az1), 4, true);
      };
      box(frameG, -w / 2 - 0.3, -w / 2, SW, h + 0.3, 0, 0.32);
      box(frameG, w / 2, w / 2 + 0.3, SW, h + 0.3, 0, 0.32);
      box(frameG, -w / 2 - 0.3, w / 2 + 0.3, h, h + 0.35, 0, 0.32);
      box(frameG, -w / 2 - 0.5, w / 2 + 0.5, 0, SW + 0.12, 0.1, 0.9);
      if (d.big) box(frameG, -w / 2 - 0.9, w / 2 + 0.9, h + 0.35, h + 0.55, 0, 1.6);
      else awnings.push([d.x + d.nx * 0.9, d.z + d.nz * 0.9, Math.atan2(-d.nx, -d.nz) + Math.PI, w + 0.8]);
      d.gx = d.x + d.nx * 1.6;
      d.gz = d.z + d.nz * 1.6;
      gl.push(d.x + d.nx * 0.5, h + 0.9, d.z + d.nz * 0.5);
    }
    glowPoints(gl, 16767392, 4);
  }
  function propGeo(parts) {
    const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
    for (const [g, hex] of parts) {
      const off = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
      c.setHex(hex).convertSRGBToLinear();
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        col.push(c.r, c.g, c.b);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    m.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    m.setIndex(idx);
    return m;
  }
  function buildProps(blocks) {
    const L = {};
    for (const k in PROPS) L[k] = [];
    const near = (x, z, r) => doors.some((d) => Math.hypot(x - d.gx, z - d.gz) < r);
    const put = (k, x, z, yaw, r = 1.5) => {
      if (near(x, z, r)) return;
      L[k].push({ x, z, yaw, ci: Math.floor(srand() * PROPS[k].cols.length) });
    };
    const edge = (b, side, t, ins) => {
      const x0 = b.x0 + 4, x1 = b.x1 - 4, z0 = b.z0 + 4, z1 = b.z1 - 4;
      if (side === 0) return [x0 + t * (x1 - x0), b.z0 + ins, Math.PI];
      if (side === 1) return [x0 + t * (x1 - x0), b.z1 - ins, 0];
      if (side === 2) return [b.x0 + ins, z0 + t * (z1 - z0), -Math.PI / 2];
      return [b.x1 - ins, z0 + t * (z1 - z0), Math.PI / 2];
    };
    const R4 = () => Math.floor(srand() * 4);
    for (const b of blocks) {
      const [hx, hz, hy] = edge(b, R4(), srand(), 1.9);
      put("hydrant", hx, hz, hy);
      if (srand() < 0.6) {
        const [mx, mz, my] = edge(b, R4(), srand(), 1.8);
        put("mailbox", mx, mz, my);
      }
      for (let k = 0, n = 2 + Math.floor(srand() * 3); k < n; k++) {
        const [tx, tz, ty] = edge(b, R4(), srand(), 1.6 + srand() * 0.4);
        put("trash", tx, tz, ty, 1.2);
      }
      if (srand() < 0.55) {
        const s = R4(), [dx, dz, dy] = edge(b, s, 0.1 + srand() * 0.8, 3);
        put("dumpster", dx, dz, dy + (srand() < 0.5 ? 0 : Math.PI), 2.6);
        const q = edge(b, s, 0.1 + srand() * 0.8, 3);
        put("crates", q[0], q[1], srand() * 6, 2.2);
      }
      if (srand() < 0.5) {
        const [nx, nz2, ny] = edge(b, R4(), srand(), 2.1);
        put("news", nx, nz2, ny);
      }
      if (srand() < 0.35) {
        const s = R4(), t0 = srand() * 0.6;
        for (let k = 0; k < 4; k++) {
          const [px, pz, py] = edge(b, s, t0 + k * 0.07, 1.3);
          put("meter", px, pz, py + Math.PI / 2, 1.2);
        }
      }
      if (srand() < 0.5) {
        const [bx2, bz2, by2] = edge(b, R4(), srand(), 2.3);
        put("bench", bx2, bz2, by2);
      }
      if (srand() < 0.14) {
        const [sx, sz, sy] = edge(b, R4(), 0.3 + srand() * 0.4, 1.4);
        put("shelter", sx, sz, sy, 3);
      }
      if (srand() < 0.12) {
        const s = R4(), t0 = srand() * 0.7;
        for (let k = 0; k < 5; k++) {
          const [cx, cz] = edge(b, s, t0 + k * 0.05, 0.55);
          put("cone", cx, cz, 0, 0.3);
        }
      }
      const cs = [[b.x0 + 0.9, b.z0 + 0.9], [b.x1 - 0.9, b.z0 + 0.9], [b.x0 + 0.9, b.z1 - 0.9], [b.x1 - 0.9, b.z1 - 0.9]][R4()];
      put("sign", cs[0], cs[1], srand() < 0.5 ? 0 : Math.PI / 2, 0.5);
      if (srand() < 0.3) {
        const inX = srand() < 0.5, x = inX ? b.x0 + srand() * (b.x1 - b.x0) : srand() < 0.5 ? b.x0 - 3 : b.x1 + 3, z = inX ? srand() < 0.5 ? b.z0 - 3 : b.z1 + 3 : b.z0 + srand() * (b.z1 - b.z0);
        L.vent.push({ x, z, yaw: 0, ci: 0, road: true });
      }
    }
    for (const v of L.vent) ventList.push(v);
    for (let k = 0; k < 14; k++) {
      const x = (k % 2 ? PK.x0 + 42 : PK.x0 + 196) + 3, z = PK.z0 + 20 + k * 25;
      if (z < PK.z1 - 10) L.bench.push({ x, z, yaw: k % 2 ? -Math.PI / 2 : Math.PI / 2, ci: Math.floor(srand() * 3), park: true });
    }
    const o = new THREE.Object3D(), col = new THREE.Color();
    for (const k in PROPS) {
      const list = L[k];
      if (!list.length) continue;
      const im = new THREE.InstancedMesh(PROPS[k].geo(), new THREE.MeshStandardMaterial({ color: 16777215, vertexColors: true, roughness: 0.65, metalness: k === "hydrant" || k === "mailbox" ? 0.2 : 0.05 }), list.length);
      list.forEach((p, i) => {
        o.position.set(p.x, p.road ? 0.02 : p.park ? 0.06 : SW, p.z);
        o.rotation.set(0, p.yaw, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        im.setMatrixAt(i, o.matrix);
        im.setColorAt(i, col.setHex(PROPS[k].cols[p.ci % PROPS[k].cols.length]));
      });
      im.frustumCulled = false;
      im.receiveShadow = true;
      scene.add(im);
    }
  }
  function buildAC() {
    if (!acUnits.length) return;
    const g = new THREE.BoxGeometry(1, 1, 1), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 16777215, roughness: 0.6, metalness: 0.2 }), acUnits.length), o = new THREE.Object3D(), c = new THREE.Color();
    acUnits.forEach((u, i) => {
      o.position.set(u.x, u.y, u.z);
      o.scale.set(u.ns ? 0.85 : 0.55, 0.5, u.ns ? 0.55 : 0.85);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
      const v = 0.55 + u.c * 0.4;
      im.setColorAt(i, c.setRGB(v, v, v * 1.02));
    });
    im.frustumCulled = false;
    im.receiveShadow = true;
    scene.add(im);
  }
  function buildCity() {
    buildSky();
    facGeo = STY.map(() => newGeo());
    roofGeo = newGeo();
    farGeo = newGeo();
    shopGeo = newGeo();
    trimGeo = newGeo();
    curbGeo = newGeo();
    ironGeo = newGeo();
    pitchGeo = newGeo();
    const trees = [], lamps = [], tlights = [], propBlocks = [], pocketParks = [];
    for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) {
      if (isPark(i, j)) continue;
      const b = blk(i, j), cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, dk = distKey(i, j), D = DIST[dk];
      lamps.push([b.x0 + 0.6, b.z0 + 0.6, -1], [b.x1 - 0.6, b.z0 + 0.6, 1], [b.x0 + 0.6, b.z1 - 0.6, -1], [b.x1 - 0.6, b.z1 - 0.6, 1]);
      tlights.push([b.x0 + 1.1, b.z0 + 1.6, (i + j) % 2]);
      propBlocks.push(b);
      fullBox(curbGeo, b.x0, b.x1, 0, SW, b.z0, b.z1, 4);
      addBox({ x0: b.x0, x1: b.x1, y0: 0, y1: SW, z0: b.z0, z1: b.z1 });
      if (["harlem", "uws", "ues", "gv", "ct", "hk"].includes(dk) && srand() < 0.6)
        for (let x = b.x0 + 6; x < b.x1 - 4; x += 11) {
          trees.push({ x, y: SW, z: b.z0 + 1, s: sr(1.4, 2), h: sr(2.2, 3) }, { x, y: SW, z: b.z1 - 1, s: sr(1.4, 2), h: sr(2.2, 3) });
        }
      const L = LANDMARKS[i + "," + j];
      if (L) {
        L(b, cx, cz);
        continue;
      }
      const x0 = b.x0 + 3, x1 = b.x1 - 3, z0 = b.z0 + 3, z1 = b.z1 - 3, r = srand();
      let lots;
      if (r < 0.2) lots = [[x0, x1, z0, z1]];
      else if (r < 0.5) {
        const m = sr(x0 + 18, x1 - 18);
        lots = [[x0, m, z0, z1], [m, x1, z0, z1]];
      } else if (r < 0.75) {
        const m = (z0 + z1) / 2 + sr(-4, 4);
        lots = [[x0, x1, z0, m], [x0, x1, m, z1]];
      } else {
        const mx = sr(x0 + 20, x1 - 20), mz = (z0 + z1) / 2 + sr(-3, 3);
        lots = [[x0, mx, z0, mz], [mx, x1, z0, mz], [x0, mx, mz, z1], [mx, x1, mz, z1]];
      }
      for (const l of lots) {
        if (srand() < 0.07 && l[1] - l[0] > 16 && l[3] - l[2] > 14 && dk !== "mid" && dk !== "fin") {
          pocketParks.push(l);
          for (let q = 0, n = 5 + Math.floor(srand() * 5); q < n; q++) trees.push({ x: sr(l[0] + 2, l[1] - 2), y: SW, z: sr(l[2] + 2, l[3] - 2), s: sr(1.8, 3), h: sr(2.4, 3.6) });
          continue;
        }
        let h = sr(D.h[0], D.h[1]);
        if (srand() < D.tall) h *= sr(1.4, 2.1);
        let pitched = false;
        if (dk !== "mid" && dk !== "fin" && srand() < 0.14) {
          h = sr(8, 14);
          pitched = l[1] - l[0] < 34 && l[3] - l[2] < 30 && srand() < 0.7;
        }
        building(l[0] + 0.4, l[1] - 0.4, l[2] + 0.4, l[3] - 0.4, h, D.st[Math.floor(srand() * D.st.length)], dk, b, pitched);
      }
    }
    buildGround();
    buildPark(trees);
    buildTrees(trees);
    buildDoors();
    buildAC();
    buildProps(propBlocks);
    facMats = STY.map((s) => {
      const t = facadeTex(s);
      return groundAO(new THREE.MeshStandardMaterial({
        map: t.map,
        emissiveMap: t.emi,
        emissive: 16777215,
        emissiveIntensity: 0.3,
        roughness: 1,
        roughnessMap: t.rough,
        bumpMap: dbg("nobump") ? null : t.bump,
        bumpScale: 0.07,
        metalness: 1,
        metalnessMap: t.metal
      }));
    });
    facMats.forEach((m, i) => {
      m.userData.env = STY[i].metal ? 3.6 : 1.6;
    });
    facGeo.forEach((g, i) => meshFrom(g, facMats[i]));
    const roofMat = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas("#8a8780", 7e3, 0.14, 256, { n: 40, r: 5, c: ["rgba(60,60,60,.3)", "rgba(120,110,100,.3)"] }), true), roughness: 1 });
    meshFrom(roofGeo, roofMat, false);
    meshFrom(ironGeo, new THREE.MeshStandardMaterial({ color: 2303530, roughness: 0.5, metalness: 0.55 }), false);
    {
      const c = cv(256, 256), x = c.getContext("2d");
      x.fillStyle = "#5b4a43";
      x.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 256; y += 16) for (let xx = y / 16 % 2 * 16 - 16; xx < 256; xx += 32) {
        const k = 0.85 + Math.random() * 0.3;
        x.fillStyle = `rgb(${91 * k | 0},${74 * k | 0},${67 * k | 0})`;
        x.fillRect(xx + 1, y + 1, 30, 14);
      }
      meshFrom(pitchGeo, new THREE.MeshStandardMaterial({ map: canvasTex(c, true), roughness: 0.9 }), true);
    }
    if (pocketParks.length) {
      const gm = new THREE.MeshStandardMaterial({ map: canvasTex(noiseCanvas("#5b8a3a", 6e3, 0.1, 128, { n: 30, r: 3, c: ["#6f9e45", "#4b7a2e", "#f3f3f3"] }), true), roughness: 1 });
      for (const l of pocketParks) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(l[1] - l[0] - 1, l[3] - l[2] - 1), gm);
        m.rotation.x = -Math.PI / 2;
        m.position.set((l[0] + l[1]) / 2, SW + 0.03, (l[2] + l[3]) / 2);
        m.receiveShadow = true;
        scene.add(m);
      }
    }
    meshFrom(trimGeo, groundAO(new THREE.MeshStandardMaterial({ map: canvasTex(stoneCanvas(), true), roughness: 0.85 })));
    const st = shopTex();
    shopMat = groundAO(new THREE.MeshStandardMaterial({ map: st.map, emissiveMap: st.emi, emissive: 16777215, emissiveIntensity: 0.8, roughness: 0.35, metalness: 0.1 }), 0.75, 6);
    meshFrom(shopGeo, shopMat, false);
    meshFrom(farGeo, facMats[2], false);
    const cm = new THREE.MeshStandardMaterial({ map: canvasTex(sidewalkCanvas(), true), roughness: 0.95 });
    meshFrom(curbGeo, cm, false);
    const aw = new THREE.BoxGeometry(1, 0.12, 1.4);
    aw.translate(0, 0, 0);
    const awM = buildInstanced(
      aw,
      new THREE.MeshStandardMaterial({ color: 16777215, roughness: 0.8 }),
      awnings,
      (o, a) => {
        o.position.set(a[0], 3.7, a[1]);
        o.rotation.set(0.28, a[2], 0, "YXZ");
        o.scale.set(a[3], 1, 1);
      }
    );
    const awc = [12063772, 1728044, 1388654, 8003359, 2960685, 879475, 11037458], col = new THREE.Color();
    awnings.forEach((a, i) => awM.setColorAt(i, col.setHex(awc[Math.floor(srand() * awc.length)])));
    linearize(awM);
    const woodC = cv(128, 128), wx = woodC.getContext("2d");
    wx.fillStyle = "#6b4a33";
    wx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 10) {
      wx.fillStyle = "rgba(0,0,0,.25)";
      wx.fillRect(i, 0, 2, 128);
    }
    wx.fillStyle = "#2a2a2a";
    wx.fillRect(0, 30, 128, 5);
    wx.fillRect(0, 90, 128, 5);
    const tm = new THREE.MeshStandardMaterial({ map: canvasTex(woodC, true), roughness: 0.95 });
    const tBody = new THREE.CylinderGeometry(1.6, 1.6, 3, 12);
    tBody.translate(0, 2.7, 0);
    const tRoof = new THREE.ConeGeometry(1.75, 1.2, 12);
    tRoof.translate(0, 4.8, 0);
    const tLeg = new THREE.CylinderGeometry(1.1, 1.1, 1.2, 8, 1, true);
    tLeg.translate(0, 0.6, 0);
    const put = (o, t) => o.position.set(t.x, t.y, t.z);
    buildInstanced(tBody, tm, tanks, put);
    buildInstanced(tRoof, new THREE.MeshStandardMaterial({ color: 3882562, roughness: 0.7, metalness: 0.3 }), tanks, put);
    buildInstanced(tLeg, new THREE.MeshStandardMaterial({ color: 2236962, side: THREE.DoubleSide }), tanks, put);
    const mg = new THREE.CylinderGeometry(0.08, 0.15, 1, 5);
    mg.translate(0, 0.5, 0);
    buildInstanced(mg, new THREE.MeshStandardMaterial({ color: 5593180, metalness: 0.6, roughness: 0.4 }), masts, (o, m) => {
      o.position.set(m.x, m.y, m.z);
      o.scale.set(1, m.h, 1);
    });
    glowPoints(masts.flatMap((m) => [m.x, m.y + m.h + 0.3, m.z]), 16722474, 5);
    for (const m of masts) if (m.h > 1) perches.push(new V3(m.x, m.y, m.z + 0.8));
    const texts = [["DAILY BUGLE", "#ff3b3b"], ["NOWY JORK", "#3fe3ff"], ["PIZZA 24h", "#ffb13b"], ["HOT DOGI", "#ff5bd1"], ["OSCORP", "#39ff6a"], ["KINO", "#fff35b"], ["METRO", "#5b8dff"], ["TAXI", "#ffd21e"]];
    boardMats = texts.map(([t, c]) => {
      const tx = neonTex(t, c);
      return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 16777215, emissiveIntensity: 1, roughness: 0.5 });
    });
    const bg = new THREE.PlaneGeometry(12, 5);
    boards.forEach((b, i) => {
      const alongX = b.x1 - b.x0 >= 18, m = new THREE.Mesh(bg, boardMats[i % boardMats.length]);
      if (alongX) {
        const s = srand() < 0.5;
        m.position.set((b.x0 + b.x1) / 2, b.y1 + 4.2, s ? b.z0 + 0.5 : b.z1 - 0.5);
        m.rotation.y = s ? Math.PI : 0;
      } else {
        const s = srand() < 0.5;
        m.position.set(s ? b.x0 + 0.5 : b.x1 - 0.5, b.y1 + 4.2, (b.z0 + b.z1) / 2);
        m.rotation.y = s ? -Math.PI / 2 : Math.PI / 2;
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(12.4, 5.4, 0.3), new THREE.MeshStandardMaterial({ color: 1842980, roughness: 0.8 }));
      back.position.set(0, 0, -0.18);
      m.add(back);
      for (const px of [-4, 4]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), back.material);
        leg.position.set(px, -3.6, -0.2);
        m.add(leg);
      }
      m.castShadow = true;
      scene.add(m);
    });
    const pole = new THREE.CylinderGeometry(0.1, 0.14, 7.5, 6);
    pole.translate(0, 3.75, 0);
    buildInstanced(pole, new THREE.MeshStandardMaterial({ color: 2896440, metalness: 0.5, roughness: 0.5 }), lamps, (o, l) => o.position.set(l[0], SW, l[1]));
    lampMat = new THREE.MeshStandardMaterial({ color: 16767392, emissive: 16758880, emissiveIntensity: 0.9 });
    buildInstanced(new THREE.BoxGeometry(1.6, 0.2, 0.4), lampMat, lamps, (o, l) => o.position.set(l[0] + l[2] * 0.8, 7.5 + SW, l[1]), false);
    glowPoints(lamps.flatMap((l) => [l[0] + l[2] * 0.8, 7.3 + SW, l[1]]), 16760944, 7);
    buildTrafficLights(tlights);
    for (const r of roofs) if (r.x1 - r.x0 >= 14 && r.z1 - r.z0 >= 14 && r.y1 >= 15 && r.y1 <= 100) spots.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, y1: r.y1, cx: (r.x0 + r.x1) / 2, cz: (r.z0 + r.z1) / 2, busy: false });
    footprints.sort((a, b) => a.h - b.h);
    initTraffic();
    initLife();
  }
  function loftZ(rings, segs, n) {
    const pos = [], idx = [];
    for (const r of rings) for (let i = 0; i <= segs; i++) {
      const a = i / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / n), ey = Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      pos.push(r[1] * ex, (r[2] + r[3]) / 2 + (r[3] - r[2]) / 2 * ey, r[0]);
    }
    const S = segs + 1;
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < segs; i++) {
      const a = k * S + i, b = a + 1, c = b + S, d = a + S;
      idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function mergeGeos(list) {
    const pos = [], nor = [], idx = [];
    for (const g0 of list) {
      const g = g0.index ? g0 : g0;
      const off = pos.length / 3, p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off);
      else for (let i = 0; i < p.count; i++) idx.push(i + off);
    }
    const m = new THREE.BufferGeometry();
    m.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    m.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
    m.setIndex(idx);
    return m;
  }
  function carGeometries() {
    const body = loftZ([[-2.26, 0.5, 0.42, 0.66], [-2.22, 0.84, 0.32, 0.86], [-2.05, 0.9, 0.29, 0.94], [-1.3, 0.92, 0.28, 0.98], [0.7, 0.92, 0.28, 0.98], [1.55, 0.91, 0.29, 0.9], [2.1, 0.87, 0.31, 0.8], [2.27, 0.55, 0.38, 0.62]], 20, 5);
    const roof = loftZ([[-1, 0.66, 1.36, 1.4], [-0.95, 0.74, 1.37, 1.47], [0.3, 0.74, 1.37, 1.48], [0.36, 0.66, 1.37, 1.42]], 16, 5);
    const glass = loftZ([[-1.45, 0.8, 0.9, 0.97], [-1.02, 0.78, 0.9, 1.42], [0.33, 0.78, 0.9, 1.44], [1.02, 0.82, 0.9, 0.99]], 18, 4);
    const wheels = [];
    for (const [x, z] of [[0.83, 1.38], [-0.83, 1.38], [0.83, -1.36], [-0.83, -1.36]]) {
      const w = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 16);
      w.rotateZ(Math.PI / 2);
      w.translate(x, 0.34, z);
      wheels.push(w);
    }
    const sign = new THREE.BoxGeometry(0.55, 0.2, 0.26);
    sign.translate(0, 1.58, -0.3);
    const bx2 = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      return g;
    };
    const rims = [];
    for (const [x, z] of [[0.83, 1.38], [-0.83, 1.38], [0.83, -1.36], [-0.83, -1.36]]) {
      const r = new THREE.CylinderGeometry(0.21, 0.21, 0.03, 14);
      r.rotateZ(Math.PI / 2);
      r.translate(x + Math.sign(x) * 0.115, 0.34, z);
      rims.push(r);
      const hub = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8);
      hub.rotateZ(Math.PI / 2);
      hub.translate(x + Math.sign(x) * 0.13, 0.34, z);
      rims.push(hub);
    }
    const chrome = mergeGeos([bx2(0.82, 0.03, 0.03, 0, 0.73, 2.21), bx2(0.06, 0.03, 0.03, 0.62, 0.95, 0.15), bx2(0.06, 0.03, 0.03, -0.62, 0.95, 0.15)]);
    const trim = mergeGeos([
      bx2(1.74, 0.2, 0.16, 0, 0.37, 2.19),
      bx2(1.74, 0.2, 0.16, 0, 0.37, -2.19),
      bx2(0.8, 0.15, 0.05, 0, 0.62, 2.22),
      bx2(0.16, 0.1, 0.12, 0.97, 1, 0.95),
      bx2(0.16, 0.1, 0.12, -0.97, 1, 0.95),
      bx2(1.84, 0.05, 3, 0, 0.27, 0)
    ]);
    const plate = mergeGeos([bx2(0.5, 0.12, 0.02, 0, 0.58, -2.29), bx2(0.5, 0.12, 0.02, 0, 0.42, 2.28)]);
    const head = mergeGeos([bx2(0.34, 0.12, 0.05, 0.6, 0.74, 2.13), bx2(0.34, 0.12, 0.05, -0.6, 0.74, 2.13)]);
    const tail = mergeGeos([bx2(0.36, 0.13, 0.05, 0.62, 0.78, -2.21), bx2(0.36, 0.13, 0.05, -0.62, 0.78, -2.21)]);
    return { body: mergeGeos([body, roof]), glass, wheels: mergeGeos(wheels), rims: mergeGeos(rims), sign, chrome, trim, plate, head, tail };
  }
  function initTraffic() {
    const lanes = [];
    for (let i = 0; i <= NX; i++) {
      const x = X0 + i * CX;
      lanes.push({ ax: "z", c: x - 4, dir: 1 }, { ax: "z", c: x + 4, dir: -1 });
    }
    for (let j = 0; j <= NZ; j++) {
      const z = Z0 + j * CZ;
      lanes.push({ ax: "x", c: z + 4, dir: -1 }, { ax: "x", c: z - 4, dir: 1 });
    }
    const carCols = [15908879, 15908879, 15908879, 1908516, 15329769, 9050650, 2772362, 7106421, 2312751, 11580344];
    for (const L of lanes) {
      L.sp = sr(9, 15);
      L.len = (L.ax === "z" ? CD : CW) + 20;
      const n = L.ax === "z" ? 7 + Math.floor(srand() * 4) : 2 + Math.floor(srand() * 3);
      for (let k = 0; k < n; k++) cars.push({ L, s: k / n * L.len + sr(0, L.len / n * 0.4), col: carCols[Math.floor(srand() * carCols.length)] });
    }
    const G2 = carGeometries();
    carBody = new THREE.InstancedMesh(G2.body, new THREE.MeshStandardMaterial({ color: 16777215, roughness: 0.22, metalness: 0.55 }), cars.length);
    carGlass = new THREE.InstancedMesh(G2.glass, new THREE.MeshStandardMaterial({ color: 790550, roughness: 0.05, metalness: 0.6 }), cars.length);
    carWheel = new THREE.InstancedMesh(G2.wheels, new THREE.MeshStandardMaterial({ color: 1381653, roughness: 0.85 }), cars.length);
    carSign = new THREE.InstancedMesh(G2.sign, new THREE.MeshStandardMaterial({ color: 16774872, emissive: 16770976, emissiveIntensity: 0.6 }), cars.length);
    const chromeM = new THREE.MeshStandardMaterial({ color: 13159634, roughness: 0.25, metalness: 0.9 });
    carRims = new THREE.InstancedMesh(G2.rims, chromeM, cars.length);
    carRims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    carRims.frustumCulled = false;
    scene.add(carRims);
    carParts = [
      [G2.chrome, chromeM],
      [G2.trim, new THREE.MeshStandardMaterial({ color: 1776671, roughness: 0.7 })],
      [G2.plate, new THREE.MeshStandardMaterial({ color: 15789796, roughness: 0.5 })],
      [G2.head, new THREE.MeshStandardMaterial({ color: 16054015, emissive: 16773846, emissiveIntensity: 0.7, roughness: 0.1 })],
      [G2.tail, new THREE.MeshStandardMaterial({ color: 7998476, emissive: 16718352, emissiveIntensity: 0.6, roughness: 0.2 })]
    ].map(([g, m]) => {
      const im = new THREE.InstancedMesh(g, m, cars.length);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      scene.add(im);
      return im;
    });
    cars.forEach((c, i) => {
      carBody.setColorAt(i, _c.setHex(c.col));
      c.taxi = c.col === 15908879;
      const t = c.taxi ? 1 : srand();
      c.sc = t < 0.2 ? [0.94, 0.95, 0.86] : t < 0.7 ? [1, 1, 1 + srand() * 0.06] : t < 0.9 ? [1.06, 1.2, 1.04] : [1.08, 1.42, 1.16];
    });
    for (const m of [carBody, carGlass, carWheel, carSign]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = false;
      scene.add(m);
    }
    headL = glowPoints(new Array(cars.length * 3).fill(0), 16773840, 2.6);
    tailL = glowPoints(new Array(cars.length * 3).fill(0), 16719904, 1.8);
    const skins = [14726036, 13012586, 9263675, 15845797, 6175268, 11565653];
    const tops = [12597547, 3049182, 16119285, 2236962, 2600544, 15844367, 9323693, 8359053, 13849600, 3885916, 15259840];
    const bots = [2569295, 1975603, 3882826, 2829099, 4866098, 6048314, 1842204];
    const lin = (hex) => new THREE.Color(hex).convertSRGBToLinear();
    for (let n = 0; n < 260; n++) {
      let i, j;
      do {
        i = Math.floor(srand() * NX);
        j = Math.floor(srand() * NZ);
      } while (isPark(i, j));
      const b = blk(i, j), side = Math.floor(srand() * 4);
      const p = side < 2 ? { ax: "x", c: side ? b.z1 - 2 : b.z0 + 2, s0: b.x0 + 1, s1: b.x1 - 1 } : { ax: "z", c: side === 3 ? b.x1 - 2 : b.x0 + 2, s0: b.z0 + 1, s1: b.z1 - 1 };
      p.s = sr(p.s0, p.s1);
      p.sp = sr(1, 1.6) * (srand() < 0.5 ? 1 : -1);
      p.ph = sr(0, 6);
      p.flee = 0;
      p.cols = [lin(tops[Math.floor(srand() * tops.length)]), lin(bots[Math.floor(srand() * bots.length)]), lin(skins[Math.floor(srand() * skins.length)])];
      p.sc = sr(0.92, 1.06);
      peds.push(p);
    }
    const frames = pedGeometries(), face = pedFaceTexture(), mats2 = [0.85, 0.8, 0.6, 0.65].map((r, q) => new THREE.MeshStandardMaterial({ color: 16777215, roughness: r, map: q === 3 ? face : null }));
    mats2.forEach((m) => {
      m.userData.lin = true;
    });
    pedMesh = frames.map((f) => ["top", "bot", "hand", "head"].map((k, q) => {
      const m = new THREE.InstancedMesh(f[k], mats2[q], peds.length);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.castShadow = false;
      m.receiveShadow = true;
      m.setColorAt(0, _c.setRGB(1, 1, 1));
      m.userData.linIC = true;
      m.count = 0;
      scene.add(m);
      return m;
    }));
  }
  function initLife() {
    const sc = cv(64, 64), sx = sc.getContext("2d"), sg = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    sg.addColorStop(0, "rgba(255,255,255,.55)");
    sg.addColorStop(0.6, "rgba(255,255,255,.2)");
    sg.addColorStop(1, "rgba(255,255,255,0)");
    sx.fillStyle = sg;
    sx.fillRect(0, 0, 64, 64);
    const N = Math.max(1, ventList.length) * 10, pos = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    steam = { N, pos, age: new Float32Array(N).map((_, i) => i % 10 * 0.35), pts: new THREE.Points(g, new THREE.PointsMaterial({ map: canvasTex(sc), size: 4.5, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, color: 15265008 })) };
    steam.pts.frustumCulled = false;
    scene.add(steam.pts);
    const wg = new THREE.BufferGeometry();
    wg.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.12, 0.45, 0.05, -0.08, 0, 0, -0.14, 0, 0, 0.12, -0.45, 0.05, -0.08, 0, 0, -0.14, 0, 0, 0.12, 0.02, 0, -0.14, -0.02, 0, -0.14], 3));
    wg.computeVertexNormals();
    birds = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: 5593182, roughness: 0.9, side: THREE.DoubleSide }), BIRD_N);
    for (let i = 0; i < BIRD_N; i++) {
      const gi = Math.floor(i / 7);
      const r = srand;
      birdData.push({ cx: X0 + 40 + gi * 97 % 600, cz: Z0 + 60 + gi * 173 % 1050, r: 22 + srand() * 30, h: 45 + srand() * 90, w: 0.35 + srand() * 0.25, ph: srand() * 6.28, fl: 8 + srand() * 4 });
    }
    birds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    birds.frustumCulled = false;
    scene.add(birds);
  }
  function updateLife(dt) {
    if (!steam) return;
    const t = G.time;
    ventList.forEach((v, vi) => {
      for (let k = 0; k < 10; k++) {
        const i = vi * 10 + k;
        steam.age[i] += dt;
        if (steam.age[i] > 3.5) steam.age[i] -= 3.5;
        const a = steam.age[i], dx = Math.sin(i * 12.9 + a * 1.3) * 0.25 * a, dz = Math.cos(i * 7.7 + a * 1.1) * 0.25 * a;
        steam.pos[i * 3] = v.x + dx + a * 0.25;
        steam.pos[i * 3 + 1] = 1.5 + a * 1.9;
        steam.pos[i * 3 + 2] = v.z + dz;
      }
    });
    steam.pts.geometry.attributes.position.needsUpdate = true;
    birdData.forEach((b, i) => {
      const a = t * b.w + b.ph, x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r, y = b.h + Math.sin(a * 2.3) * 4;
      _bo.position.set(x, y, z);
      _bo.rotation.set(0, Math.atan2(-Math.sin(a), Math.cos(a)) + Math.PI / 2 * 0, Math.sin(t * b.fl + i) * 0.5);
      _bo.rotation.y = Math.atan2(-Math.sin(a) * b.r, Math.cos(a) * b.r);
      _bo.scale.set(1, 1, 1);
      _bo.updateMatrix();
      birds.setMatrixAt(i, _bo.matrix);
    });
    birds.instanceMatrix.needsUpdate = true;
  }
  function scarePeds(x, z, r = 45) {
    for (const p of peds) {
      const px = p.ax === "x" ? p.s : p.c, pz = p.ax === "x" ? p.c : p.s;
      if (Math.abs(px - x) < r && Math.abs(pz - z) < r) {
        p.flee = 6;
        const away = p.ax === "x" ? Math.sign(px - x) : Math.sign(pz - z);
        p.sp = (away || 1) * 4.5;
      }
    }
  }
  function updateTraffic(dt) {
    updateLife(dt);
    const hp = headL.geometry.attributes.position, tp = tailL.geometry.attributes.position;
    cars.forEach((c, i) => {
      const L = c.L;
      c.s = ((c.s + L.sp * dt * L.dir) % L.len + L.len) % L.len;
      let x, z, yaw, fx, fz;
      if (L.ax === "z") {
        x = L.c;
        z = Z0 - 10 + c.s;
        yaw = L.dir > 0 ? 0 : Math.PI;
        fx = 0;
        fz = L.dir;
      } else {
        z = L.c;
        x = X0 - 10 + c.s;
        yaw = L.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        fx = L.dir;
        fz = 0;
      }
      const hide = inPark(x, z);
      _o.position.set(x, 0, z);
      _o.rotation.set(0, yaw, 0);
      if (hide) _o.scale.setScalar(1e-4);
      else _o.scale.set(c.sc[0], c.sc[1], c.sc[2]);
      _o.updateMatrix();
      carBody.setMatrixAt(i, _o.matrix);
      carGlass.setMatrixAt(i, _o.matrix);
      for (const m of carParts) m.setMatrixAt(i, _o.matrix);
      if (!hide) {
        _o.scale.y = 1;
        _o.updateMatrix();
      }
      carWheel.setMatrixAt(i, _o.matrix);
      carRims.setMatrixAt(i, _o.matrix);
      if (!c.taxi) {
        _o.scale.setScalar(1e-4);
        _o.updateMatrix();
      }
      carSign.setMatrixAt(i, _o.matrix);
      const hy = hide ? -99 : 0.72;
      hp.setXYZ(i, x + fx * 2.3, hy, z + fz * 2.3);
      tp.setXYZ(i, x - fx * 2.3, hy, z - fz * 2.3);
    });
    for (const m of carParts) m.instanceMatrix.needsUpdate = true;
    carRims.instanceMatrix.needsUpdate = true;
    carBody.instanceMatrix.needsUpdate = carGlass.instanceMatrix.needsUpdate = carWheel.instanceMatrix.needsUpdate = carSign.instanceMatrix.needsUpdate = true;
    hp.needsUpdate = tp.needsUpdate = true;
    const cnt = [0, 0], cxp = camera.position.x, czp = camera.position.z;
    for (const p of peds) {
      if (p.flee > 0) {
        p.flee -= dt;
        if (p.flee <= 0) p.sp = Math.sign(p.sp) * sr(1, 1.6);
      }
      p.s += p.sp * dt;
      if (p.s > p.s1 || p.s < p.s0) {
        p.sp = -p.sp;
        p.s = clamp(p.s, p.s0, p.s1);
      }
      p.ph += dt * Math.abs(p.sp) * 3.2;
      const x = p.ax === "x" ? p.s : p.c, z = p.ax === "x" ? p.c : p.s;
      if (dbg("noped") || Math.abs(x - cxp) > 120 || Math.abs(z - czp) > 120 || cnt[0] + cnt[1] >= 80) continue;
      const f = Math.floor(p.ph / Math.PI) % 2, k = cnt[f]++;
      const yaw = p.ax === "x" ? p.sp > 0 ? Math.PI / 2 : -Math.PI / 2 : p.sp > 0 ? 0 : Math.PI;
      _o.position.set(x, SW + Math.abs(Math.sin(p.ph)) * 0.03, z);
      _o.rotation.set(0, yaw, 0);
      _o.scale.setScalar(p.sc);
      _o.updateMatrix();
      for (let q = 0; q < 4; q++) {
        pedMesh[f][q].setMatrixAt(k, _o.matrix);
        pedMesh[f][q].setColorAt(k, p.cols[Math.min(q, 2)]);
      }
    }
    for (let f = 0; f < 2; f++) for (const m of pedMesh[f]) {
      m.count = cnt[f];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
  var BW, BD, ST, NX, NZ, CX, CZ, CW, CD, X0, Z0, LAND, PK, POND, isPark, inPark, isecPos, DIST, doors, boxes, roofs, footprints, spots, perches, START, START_H, HC2, hash, stamp, hk, _s1, _s2, _rl, rayN, _rbN, CHUNK, cur, STY, CURT, SHOPS, SIGNC, sunDir, sun, sky, clouds, stars, moon, hemi, amb, water, pondM, waterNormal, TOD, TOD_NAMES, skyU, fogEnc, lastTOD, lin3, pmrem, envRT, skyScene, facMats, shopMat, lampMat, boardMats, glowPts, todName, facGeo, roofGeo, farGeo, shopGeo, trimGeo, curbGeo, ironGeo, pitchGeo, SW, tanks, awnings, masts, boards, DOOR_TYPES, ROOMSPEC, acUnits, balconyCount, streetFaces, FISK_DOOR, LANDMARKS, export_arena, ARENA, bx, cy, PROPS, ventList, cars, peds, carBody, carGlass, carWheel, carSign, carParts, carRims, headL, tailL, pedMesh, _o, _c, steam, birds, BIRD_N, birdData, _bo;
  var init_miasto = __esm({
    "js/miasto.js"() {
      init_util();
      init_stan();
      init_model();
      BW = 64;
      BD = 44;
      ST = 18;
      NX = 8;
      NZ = 18;
      CX = BW + ST;
      CZ = BD + ST;
      CW = NX * CX;
      CD = NZ * CZ;
      X0 = -CW / 2;
      Z0 = -CD / 2;
      LAND = { x0: X0 - 24, x1: X0 + CW + 24, z0: Z0 - 24, z1: Z0 + CD + 24 };
      PK = { x0: X0 + 2 * CX + ST / 2, x1: X0 + 6 * CX - ST / 2, z0: Z0 + 2 * CZ + ST / 2, z1: Z0 + 8 * CZ - ST / 2 };
      POND = { x: (PK.x0 + PK.x1) / 2 + 30, z: PK.z0 + (PK.z1 - PK.z0) * 0.62, rx: 60, rz: 38 };
      isPark = (i, j) => i >= 2 && i <= 5 && j >= 2 && j <= 7;
      inPark = (x, z) => x > PK.x0 && x < PK.x1 && z > PK.z0 && z < PK.z1;
      isecPos = (i, j) => [X0 + i * CX, Z0 + j * CZ];
      DIST = {
        harlem: { name: "HARLEM", h: [12, 32], tall: 0, st: [0, 1, 2, 0] },
        uws: { name: "UPPER WEST SIDE", h: [22, 50], tall: 0.08, st: [1, 5, 0, 2] },
        ues: { name: "UPPER EAST SIDE", h: [22, 55], tall: 0.1, st: [5, 1, 2, 0] },
        park: { name: "CENTRAL PARK" },
        hk: { name: "HELL'S KITCHEN", h: [18, 55], tall: 0.12, st: [0, 2, 1, 3] },
        mid: { name: "MIDTOWN", h: [45, 115], tall: 0.35, st: [3, 4, 2, 5, 1] },
        gv: { name: "GREENWICH VILLAGE", h: [12, 35], tall: 0.03, st: [0, 1, 5] },
        ct: { name: "CHINATOWN", h: [14, 40], tall: 0.05, st: [0, 2, 1] },
        fin: { name: "FINANCIAL DISTRICT", h: [45, 125], tall: 0.4, st: [4, 3, 2, 5] }
      };
      doors = [];
      boxes = [];
      roofs = [];
      footprints = [];
      spots = [];
      perches = [];
      START = new V3();
      START_H = -Math.PI / 2;
      HC2 = 48;
      hash = /* @__PURE__ */ new Map();
      stamp = 0;
      hk = (ix, iz) => (ix + 500) * 2e3 + (iz + 500);
      _s1 = [];
      _s2 = [];
      _rl = [];
      rayN = new V3();
      _rbN = new V3();
      CHUNK = +new URLSearchParams(location.search).get("chunk") || 330;
      cur = { tint: [1, 1, 1], us: 16, vs: 14, uo: 0, vo: 0 };
      STY = [
        { wall: "#7d3f2e", gTop: "#e8b68e", gBot: "#2d3440", inset: [26, 20, 26, 30], lit: 0.12, rough: 0.9, frame: "#d9d0c0", brick: true, fire: true },
        { wall: "#9c866a", gTop: "#f3c49a", gBot: "#3a4250", inset: [24, 20, 24, 30], lit: 0.1, rough: 0.85, frame: "#8a7a62" },
        { wall: "#76797e", gTop: "#e9b58f", gBot: "#34404d", inset: [20, 16, 20, 24], lit: 0.1, rough: 0.8, frame: "#5a5d62" },
        { wall: "#4d6275", gTop: "#f5c9a0", gBot: "#27415a", inset: [4, 6, 4, 18], lit: 0.05, rough: 0.35, metal: 0.3, band: "#34495a" },
        { wall: "#2a3340", gTop: "#d7a887", gBot: "#1b2430", inset: [4, 6, 4, 14], lit: 0.06, rough: 0.3, metal: 0.4, band: "#1c232d" },
        { wall: "#a69c8a", gTop: "#f2c6a0", gBot: "#3b4552", inset: [30, 24, 30, 28], lit: 0.1, rough: 0.9, frame: "#9d968a" }
      ];
      CURT = ["rgba(200,60,50,.55)", "rgba(230,210,160,.55)", "rgba(60,90,150,.5)", "rgba(240,240,230,.5)", "rgba(120,160,90,.5)"];
      SHOPS = ["PIZZA", "DELI", "KAWA", "BANK", "APTEKA", "HOT DOG", "KWIATY", "BAR", "SUSHI", "SKLEP 24h", "PIEKARNIA", "KINO", "KSI\u0118GARNIA", "BURGER", "LODY", "FRYZJER"];
      SIGNC = ["#b8141c", "#1a5e2c", "#15306e", "#d49a16", "#6a1b7a", "#0d6b73", "#222222", "#b0480f"];
      sunDir = new V3(-0.82, 0.26, 0.3).normalize();
      sun = null;
      sky = null;
      clouds = null;
      stars = null;
      moon = null;
      hemi = null;
      amb = null;
      water = null;
      pondM = null;
      waterNormal = null;
      TOD = {
        sunset: {
          top: [0.3, 0.38, 0.66],
          mid: [0.9, 0.6, 0.62],
          hor: [1, 0.76, 0.48],
          glow: [1, 0.68, 0.3],
          disk: 6,
          sun: [-0.85, 0.17, 0.3],
          sunCol: 16758903,
          sunI: 2.9,
          hemi: [13156584, 3812906, 0.38],
          amb: 0.05,
          env: 0.52,
          fogN: 30,
          fogF: 1050,
          win: 0.12,
          shop: 0.45,
          lamps: 0.6,
          cloud: 0.85,
          cloudCol: 16777215,
          water: 10125936,
          stars: 0,
          exp: 1.05
        },
        day: {
          top: [0.18, 0.4, 0.85],
          mid: [0.46, 0.66, 0.93],
          hor: [0.8, 0.87, 0.95],
          glow: [1, 0.95, 0.8],
          disk: 5,
          sun: [-0.45, 0.8, 0.35],
          sunCol: 16773852,
          sunI: 3,
          hemi: [14478335, 4867904, 0.4],
          amb: 0.03,
          env: 1,
          fogN: 60,
          fogF: 1500,
          win: 0,
          shop: 0.12,
          lamps: 0,
          cloud: 0.55,
          cloudCol: 16777215,
          water: 5996448,
          stars: 0,
          exp: 0.95
        },
        night: {
          top: [0.01, 0.015, 0.05],
          mid: [0.03, 0.05, 0.12],
          hor: [0.12, 0.13, 0.22],
          glow: [0.5, 0.6, 0.85],
          disk: 3,
          sun: [0.45, 0.55, -0.4],
          sunCol: 10467048,
          sunI: 0.9,
          hemi: [5926806, 1315872, 0.7],
          amb: 0.04,
          env: 1.2,
          fogN: 90,
          fogF: 1150,
          win: 0.6,
          shop: 0.85,
          lamps: 1,
          cloud: 0.2,
          cloudCol: 7372960,
          water: 2042944,
          stars: 1,
          exp: 1.25
        }
      };
      TOD_NAMES = { sunset: "ZACH\xD3D S\u0141O\u0143CA", day: "DZIE\u0143", night: "NOC" };
      skyU = null;
      fogEnc = true;
      lastTOD = null;
      lin3 = (v, a) => v.set(...a.map((x) => Math.pow(x, 2.2)));
      pmrem = null;
      envRT = null;
      skyScene = null;
      facMats = [];
      shopMat = null;
      lampMat = null;
      boardMats = [];
      glowPts = [];
      todName = "sunset";
      SW = 0.15;
      tanks = [];
      awnings = [];
      masts = [];
      boards = [];
      DOOR_TYPES = [["shop", "SKLEP"], ["shop", "SKLEP"], ["cafe", "KAWIARNIA"], ["bar", "BAR"], ["apt", "MIESZKANIE"], ["apt", "MIESZKANIE"], ["office", "BIURO"], ["gym", "SI\u0141OWNIA"]];
      ROOMSPEC = { shop: { cw: 14, cd: 9, ch: 3.6 }, cafe: { cw: 14, cd: 10, ch: 3.6 }, bar: { cw: 12, cd: 9, ch: 3.6 }, apt: { cw: 9, cd: 7, ch: 3.1 }, office: { cw: 16, cd: 11, ch: 3.6 }, gym: { cw: 14, cd: 10, ch: 3.8 }, fisk: { cw: 22, cd: 22, ch: 8 } };
      acUnits = [];
      balconyCount = 0;
      streetFaces = (x0, x1, z0, z1, bk) => {
        const r = [];
        if (z0 - bk.z0 < 4.5) r.push("n");
        if (bk.z1 - z1 < 4.5) r.push("s");
        if (x0 - bk.x0 < 4.5) r.push("w");
        if (bk.x1 - x1 < 4.5) r.push("e");
        return r;
      };
      FISK_DOOR = null;
      LANDMARKS = {
        "4,10": (b, cx, cz) => {
          const t = tiers(cx, cz, [[29, 19, 0, 28], [23, 15, 28, 90], [16, 11, 90, 172], [10, 7.5, 172, 196], [5, 4, 196, 206]], 5, "mid");
          spire(cx, cz, 206, 252, 1.4);
          START.set(t.x0 + 0.5, 206, cz + 1.2);
        },
        "6,9": (b, cx, cz) => {
          FISK_DOOR = makeDoor(cx - 13, cx + 13, cz - 13, cz + 13, b, "fisk", "FISK TOWER", "s", cx);
          tiers(cx, cz, [[13, 13, 0, 285, 3], [9, 9, 285, 300, 4], [2, 10, 300, 330, 4]], 3, "mid", FISK_DOOR);
          building(b.x0 + 3, b.x0 + 16, b.z0 + 3, b.z1 - 3, 30, 2, "mid", b);
        },
        "2,16": (b, cx, cz) => {
          tiers(cx, cz, [[17, 17, 0, 300, 4]], 4, "fin");
          spire(cx, cz, 300, 380, 1);
        }
      };
      export_arena = { x: 0, z: 0 };
      ARENA = export_arena;
      bx = (w, h, d, x, y, z) => {
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(x, y, z);
        return g;
      };
      cy = (r02, r1, h, x, y, z, seg = 10) => {
        const g = new THREE.CylinderGeometry(r02, r1, h, seg);
        g.translate(x, y, z);
        return g;
      };
      PROPS = {
        trash: { geo: () => propGeo([[cy(0.3, 0.26, 0.86, 0, 0.43, 0), 10132896], [cy(0.34, 0.34, 0.07, 0, 0.9, 0), 7304055], [cy(0.31, 0.31, 0.03, 0, 0.6, 0, 12), 5593437]]), cols: [16777215, 10473640, 10467542, 7829367] },
        dumpster: { geo: () => propGeo([[bx(2.3, 1.15, 1.1, 0, 0.7, 0), 16777215], [bx(2.34, 0.08, 1.14, 0, 1.31, 0), 2829099], [bx(2.3, 0.14, 1.1, 0, 0.1, 0), 2236962], [cy(0.11, 0.11, 0.1, -0.9, 0.09, 0.4, 8), 1118481], [cy(0.11, 0.11, 0.1, 0.9, 0.09, 0.4, 8), 1118481]]), cols: [3107645, 2903946, 8010274, 3882820] },
        hydrant: { geo: () => propGeo([[cy(0.15, 0.17, 0.62, 0, 0.33, 0), 16777215], [new THREE.SphereGeometry(0.15, 10, 8).translate(0, 0.66, 0), 16777215], [cy(0.06, 0.06, 0.4, 0, 0.45, 0, 8).rotateZ(Math.PI / 2), 14277081], [cy(0.09, 0.09, 0.05, 0, 0.05, 0), 3355443]]), cols: [12593183, 12593183, 14727198] },
        mailbox: { geo: () => propGeo([[bx(0.5, 0.65, 0.45, 0, 0.98, 0), 16777215], [cy(0.23, 0.23, 0.45, 0, 1.31, 0, 10).rotateX(Math.PI / 2), 16777215], [bx(0.1, 0.7, 0.1, -0.18, 0.35, 0), 3355443], [bx(0.1, 0.7, 0.1, 0.18, 0.35, 0), 3355443], [bx(0.32, 0.03, 0.02, 0, 1.1, 0.23), 1118481]]), cols: [2051996, 2051996, 10234399] },
        bench: { geo: () => propGeo([[bx(1.7, 0.07, 0.5, 0, 0.5, 0), 16777215], [bx(1.7, 0.4, 0.06, 0, 0.78, -0.22), 16777215], [bx(0.08, 0.5, 0.45, -0.75, 0.25, 0), 2764080], [bx(0.08, 0.5, 0.45, 0.75, 0.25, 0), 2764080]]), cols: [7031338, 4024904, 9071162] },
        meter: { geo: () => propGeo([[cy(0.035, 0.035, 1.15, 0, 0.58, 0, 6), 3816768], [bx(0.2, 0.3, 0.14, 0, 1.28, 0), 5593437], [bx(0.14, 0.1, 0.02, 0, 1.33, 0.08), 10147488]]), cols: [16777215] },
        news: { geo: () => propGeo([[bx(0.65, 0.95, 0.5, 0, 0.5, 0), 16777215], [bx(0.5, 0.32, 0.04, 0, 0.72, 0.26), 15328466], [bx(0.7, 0.08, 0.55, 0, 1, 0), 2829099]]), cols: [12068383, 2908072, 14262302, 3111498] },
        cone: { geo: () => propGeo([[new THREE.ConeGeometry(0.16, 0.7, 10).translate(0, 0.4, 0), 16738836], [bx(0.4, 0.05, 0.4, 0, 0.03, 0), 2829099], [cy(0.13, 0.145, 0.06, 0, 0.42, 0, 10), 15921906]]), cols: [16777215] },
        sign: { geo: () => propGeo([[cy(0.04, 0.04, 3.4, 0, 1.7, 0, 6), 5593437], [bx(1.05, 0.26, 0.04, 0, 3.3, 0), 2058810], [bx(0.9, 0.16, 0.05, 0, 3.3, 5e-3), 15921906]]), cols: [16777215] },
        crates: { geo: () => propGeo([[bx(0.7, 0.55, 0.7, 0, 0.28, 0), 16777215], [bx(0.6, 0.5, 0.6, 0.15, 0.83, 0.05), 16777215], [bx(0.5, 0.4, 0.5, -0.55, 0.2, 0.3), 16777215]]), cols: [11042895, 10189388, 8284746] },
        vent: { geo: () => propGeo([[new THREE.CylinderGeometry(0.22, 0.4, 1.4, 12).translate(0, 0.7, 0), 16742938], [cy(0.42, 0.42, 0.12, 0, 0.06, 0, 12), 4473924], [cy(0.235, 0.235, 0.12, 0, 0.9, 0, 12), 15921906], [cy(0.2, 0.2, 0.1, 0, 1.36, 0, 12), 15921906]]), cols: [16777215] },
        shelter: { geo: () => propGeo([[bx(3.6, 0.1, 1.4, 0, 2.5, 0), 2830131], [bx(0.08, 2.5, 0.08, -1.7, 1.25, -0.6), 2830131], [bx(0.08, 2.5, 0.08, 1.7, 1.25, -0.6), 2830131], [bx(3.4, 2.1, 0.04, 0, 1.3, -0.62), 10470614], [bx(0.04, 2.1, 1.1, -1.7, 1.3, -0.05), 10470614], [bx(1.8, 0.06, 0.4, 0.2, 0.5, -0.4), 7031338], [bx(0.9, 1.4, 0.05, -0.5, 1.4, -0.6), 15262936]]), cols: [16777215] }
      };
      ventList = [];
      cars = [];
      peds = [];
      carParts = [];
      pedMesh = [];
      _o = new THREE.Object3D();
      _c = new THREE.Color();
      steam = null;
      birds = null;
      BIRD_N = 70;
      birdData = [];
      _bo = new THREE.Object3D();
    }
  });

  // js/postac.js
  function el(mat, sx, sy, sz, x = 0, y = 0, z = 0, geo = SG) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  }
  function newPose() {
    const o = {};
    for (const k of POSEK) o[k] = 0;
    return o;
  }
  function zeroPose(o) {
    for (const k of POSEK) o[k] = 0;
  }
  function blendPose(c, t, k) {
    for (const q of POSEK) c[q] += (t[q] - c[q]) * k;
  }
  function applyPose(H, c) {
    H.body.position.y = 0.95 + c.by;
    H.body.rotation.set(c.bp, c.bw, c.br, "YXZ");
    H.spine.rotation.set(c.spx, c.spy, c.spz);
    H.chest.rotation.set(c.chx, 0, 0);
    H.neck.rotation.set(c.hx, c.hy, 0);
    H.shL.rotation.set(c.sLx, c.sLy, c.sLz);
    H.elL.rotation.set(c.eL, 0, 0);
    H.shR.rotation.set(c.sRx, c.sRy, c.sRz);
    H.elR.rotation.set(c.eR, 0, 0);
    H.hipL.rotation.set(c.hLx, 0, c.hLz);
    H.knL.rotation.set(c.kL, 0, 0);
    H.hipR.rotation.set(c.hRx, 0, c.hRz);
    H.knR.rotation.set(c.kR, 0, 0);
    H.ftL.rotation.set(c.fL, 0, 0);
    H.ftR.rotation.set(c.fR, 0, 0);
  }
  function idlePose(t, time) {
    t.by = Math.sin(time * 2.2) * 8e-3;
    t.chx = Math.sin(time * 2.2) * 0.02;
    t.sLz = 0.14;
    t.sRz = -0.14;
    t.sLx = 0.05;
    t.sRx = 0.05;
    t.eL = -0.25;
    t.eR = -0.25;
    t.hLz = 0.05;
    t.hRz = -0.05;
    t.kL = 0.04;
    t.kR = 0.04;
  }
  function runPose(t, ph, a, sprint) {
    const s = Math.sin(ph), c = Math.cos(ph);
    t.hLx = -s * 0.85 * a;
    t.hRx = s * 0.85 * a;
    t.kL = 0.25 + Math.max(0, c) * 1.4 * a;
    t.kR = 0.25 + Math.max(0, -c) * 1.4 * a;
    t.by = (Math.abs(s) * 0.06 - 0.04) * a;
    t.bp = 0.12 * a;
    if (sprint) {
      t.sLx = 1;
      t.sRx = 1;
      t.sLz = 0.25;
      t.sRz = -0.25;
      t.eL = -0.2;
      t.eR = -0.2;
      t.bp = 0.5;
      t.hx = -0.4;
    } else {
      t.sLx = s * 0.75 * a;
      t.sRx = -s * 0.75 * a;
      t.eL = -0.9;
      t.eR = -0.9;
      t.sLz = 0.1;
      t.sRz = -0.1;
    }
  }
  function crouchPose(t) {
    t.by = -0.5;
    t.hLx = -1.9;
    t.hRx = -1.9;
    t.kL = 2.3;
    t.kR = 2.3;
    t.hLz = 0.35;
    t.hRz = -0.35;
    t.bp = 0.55;
    t.sLx = -0.6;
    t.sRx = -0.6;
    t.eL = -0.9;
    t.eR = -0.9;
    t.sLz = 0.15;
    t.sRz = -0.15;
    t.hx = -0.5;
    t.fL = 0.4;
    t.fR = 0.4;
  }
  function tuckPose(t) {
    t.hLx = -1.7;
    t.kL = 2.2;
    t.hRx = -1.7;
    t.kR = 2.2;
    t.sLx = -1;
    t.sRx = -1;
    t.eL = -1.6;
    t.eR = -1.6;
    t.by = 0.1;
    t.hx = 0.3;
  }
  function aimArm(H, side, pt, w) {
    const sh = side === "R" ? H.shR : H.shL;
    _v.copy(pt);
    sh.parent.worldToLocal(_v);
    _v.sub(sh.position);
    if (_v.lengthSq() < 1e-6) return;
    _v.normalize();
    _q.setFromUnitVectors(DOWN, _v);
    sh.quaternion.slerp(_q, w);
    const eb = side === "R" ? H.elR : H.elL;
    eb.rotation.x *= 1 - w;
  }
  function basisQ(q, up, fw) {
    _u.copy(up).normalize();
    _f.copy(fw).addScaledVector(_u, -fw.dot(_u));
    if (_f.lengthSq() < 1e-6) {
      _f.set(0, 0, 1).addScaledVector(_u, -_u.z);
      if (_f.lengthSq() < 1e-6) _f.set(1, 0, 0);
    }
    _f.normalize();
    _x.crossVectors(_u, _f);
    _m.makeBasis(_x, _u, _f);
    q.setFromRotationMatrix(_m);
    return q;
  }
  function webCanvas(base, line) {
    const c = cv(256, 256), x = c.getContext("2d");
    x.fillStyle = base;
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = line;
    x.lineWidth = 2.2;
    for (let a = 0; a <= 256; a += 32) {
      x.beginPath();
      x.moveTo(a, 0);
      x.lineTo(a, 256);
      x.stroke();
    }
    for (let y = 16; y <= 256; y += 32) {
      x.beginPath();
      for (let a = 0; a < 256; a += 32) {
        x.moveTo(a, y);
        x.quadraticCurveTo(a + 16, y + 10, a + 32, y);
      }
      x.stroke();
    }
    return c;
  }
  function webMaterial() {
    return _webMat || (_webMat = new THREE.MeshStandardMaterial({ map: canvasTex(webCanvas("#ececec", "#9c9c9c"), true), roughness: 0.9 }));
  }
  var SG, POSEK, _q, _v, _m, _x, _f, _u, ADV, ALLP, SUITS, suitById, _webMat;
  var init_postac = __esm({
    "js/postac.js"() {
      init_util();
      init_model();
      SG = new THREE.SphereGeometry(1, 28, 18);
      POSEK = ["by", "bp", "br", "bw", "spx", "spy", "spz", "chx", "hx", "hy", "sLx", "sLy", "sLz", "eL", "sRx", "sRy", "sRz", "eR", "hLx", "hLz", "kL", "hRx", "hRz", "kR", "fL", "fR"];
      _q = new THREE.Quaternion();
      _v = new V3();
      _m = new THREE.Matrix4();
      _x = new V3();
      _f = new V3();
      _u = new V3();
      ADV = { head: "p", abd: "s", pelvis: "p", uarm: "p", farm: "s", hand: "p", thigh: "s", shin: "s", foot: "p" };
      ALLP = { head: "p", abd: "p", pelvis: "p", uarm: "p", farm: "p", hand: "p", thigh: "p", shin: "p", foot: "p" };
      SUITS = [
        { id: "adv", name: "ZAAWANSOWANY STR\xD3J", lvl: 1, desc: "Str\xF3j, kt\xF3ry Peter zaprojektowa\u0142 sam. Lekki, wytrzyma\u0142y i z wielkim bia\u0142ym paj\u0105kiem.", prim: "#c8141c", web: "#3b0508", sec: "#15204a", logo: "#f4f4f4", logoS: "big", eye: "#f5f5f5", rim: "#0c0c0c", sides: true, stripe: "#c8141c", parts: ADV },
        { id: "classic", name: "KLASYCZNY STR\xD3J", lvl: 1, desc: "Czerwie\u0144 i b\u0142\u0119kit, czarna paj\u0119czyna. Tak to si\u0119 wszystko zacz\u0119\u0142o.", prim: "#d3161e", web: "#1a0000", sec: "#1d3ea8", logo: "#111", logoS: "small", eye: "#f2f2f2", rim: "#111", sides: true, parts: { head: "p", abd: "p", pelvis: "p", uarm: "s", farm: "p", hand: "p", thigh: "s", shin: "s", foot: "p" } },
        { id: "home", name: "DOMOWY STR\xD3J", lvl: 1, desc: "Bluza, dresy i gogle. Uszyty w pokoju, ale dzia\u0142a.", prim: "#b8262b", web: null, sec: "#2d56a8", acc: "#2a2a2a", logo: "#111", logoS: "small", eye: "#161616", rim: "#555", parts: { head: "p", abd: "p", pelvis: "s", uarm: "p", farm: "p", hand: "p", thigh: "s", shin: "s", foot: "a" } },
        { id: "black", name: "CZARNY STR\xD3J", lvl: 2, desc: "Czarny jak noc, z ogromnym bia\u0142ym paj\u0105kiem na piersi.", prim: "#111317", web: null, sec: "#111317", logo: "#f2f2f2", logoS: "big", eye: "#f5f5f5", rim: "#000", gloss: true, parts: ALLP },
        { id: "neg", name: "NEGATYW", lvl: 2, desc: "Odwr\xF3cone kolory \u2014 bia\u0142e t\u0142o i czarna sie\u0107.", prim: "#eeeeee", web: "#111", sec: "#141414", logo: "#111", logoS: "big", eye: "#1a1a1a", rim: "#eee", sides: true, stripe: "#eeeeee", parts: ADV },
        { id: "miles", name: "STR\xD3J MILESA", lvl: 3, desc: "Czarny str\xF3j z czerwon\u0105 paj\u0119czyn\u0105.", prim: "#121212", web: "#d0141c", sec: "#121212", logo: "#d0141c", logoS: "big", eye: "#f5f5f5", rim: "#000", parts: ALLP },
        { id: "iron", name: "\u017BELAZNY PAJ\u0104K", lvl: 3, desc: "Czerwie\u0144 i z\u0142oto. Metalowe p\u0142ytki l\u015Bni\u0105 w s\u0142o\u0144cu.", prim: "#b3121a", web: "#4a0004", sec: "#d9ab2e", acc: "#d9ab2e", logo: "#e6b93a", logoS: "big", eye: "#f5f5f5", rim: "#222", sides: true, metal: true, parts: { head: "p", abd: "s", pelvis: "s", uarm: "s", farm: "p", hand: "s", thigh: "s", shin: "p", foot: "s" } },
        { id: "scarlet", name: "SZKAR\u0141ATNY PAJ\u0104K", lvl: 4, desc: "Czerwony kombinezon i niebieska bluza bez r\u0119kaw\xF3w.", prim: "#b01218", web: "#3d0003", sec: "#233f8f", logo: "#b01218", logoS: "big", eye: "#f0f0f0", rim: "#111", chestSec: true, parts: { head: "p", abd: "s", pelvis: "s", uarm: "p", farm: "p", hand: "p", thigh: "p", shin: "p", foot: "p" } },
        { id: "2099", name: "SPIDER-MAN 2099", lvl: 4, desc: "Str\xF3j z przysz\u0142o\u015Bci: granat, czer\u0144 i czerwony znak.", prim: "#152461", web: null, sec: "#0a0d1c", logo: "#d4161f", logoS: "big", eye: "#e21b25", rim: "#0a0a0a", sides: true, parts: { head: "p", abd: "s", pelvis: "s", uarm: "p", farm: "s", hand: "s", thigh: "p", shin: "p", foot: "s" } },
        { id: "noir", name: "NOIR", lvl: 5, desc: "Czarno-bia\u0142y detektyw z lat trzydziestych.", prim: "#1a1a1a", web: null, sec: "#2e2e2e", acc: "#3a3a3a", logo: "#2e2e2e", logoS: "none", eye: "#9aa0a6", rim: "#4a4a4a", parts: { head: "p", abd: "s", pelvis: "s", uarm: "s", farm: "s", hand: "p", thigh: "p", shin: "p", foot: "a" } },
        { id: "anti", name: "ANTY-VENOM", lvl: 5, desc: "Biel i czer\u0144, czarna g\u0142owa i wielki czarny paj\u0105k.", prim: "#efefef", web: null, sec: "#101010", logo: "#101010", logoS: "big", eye: "#ffffff", rim: "#222", sides: true, parts: { head: "s", abd: "s", pelvis: "s", uarm: "p", farm: "s", hand: "p", thigh: "s", shin: "p", foot: "p" } },
        { id: "toxic", name: "TOKSYCZNY", lvl: 6, desc: "\u015Awiec\u0105ca na zielono sie\u0107 \u2014 wida\u0107 ci\u0119 w nocy z daleka.", prim: "#0e1210", web: "#39ff6a", glow: true, sec: "#0a0c0b", logo: "#39ff6a", logoS: "big", eye: "#9dffb5", rim: "#000", parts: ALLP },
        { id: "mk", name: "ZBROJA MK II", lvl: 6, desc: "Ci\u0119\u017Cka zbroja w czerni i \u017C\xF3\u0142ci.", prim: "#1b1b1d", web: "#2d2d30", sec: "#f0c419", logo: "#f0c419", logoS: "big", eye: "#f0c419", rim: "#111", sides: true, metal: true, parts: { head: "p", abd: "s", pelvis: "s", uarm: "s", farm: "p", hand: "p", thigh: "p", shin: "s", foot: "p" } },
        { id: "stealth", name: "STR\xD3J UKRYCIA", lvl: 7, desc: "Ciemny str\xF3j z b\u0142\u0119kitn\u0105, \u015Bwiec\u0105c\u0105 paj\u0119czyn\u0105.", prim: "#1c2127", web: "#18e0ff", glow: true, sec: "#12161a", logo: "#18e0ff", logoS: "big", eye: "#6ff2ff", rim: "#000", parts: ALLP },
        { id: "gold", name: "Z\u0141OTY PAJ\u0104K", lvl: 8, desc: "Czyste z\u0142oto. Nagroda dla najlepszych.", prim: "#d4a52a", web: "#5b4108", sec: "#1a1a1a", logo: "#1a1a1a", logoS: "big", eye: "#fff", rim: "#111", metal: true, sides: true, stripe: "#d4a52a", parts: ADV }
      ];
      suitById = (id) => SUITS.find((s) => s.id === id);
      _webMat = null;
    }
  });

  // js/dzwiek.js
  function initAudio() {
    if (AC) {
      if (AC.state === "suspended") AC.resume();
      return;
    }
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return;
    }
    master = AC.createGain();
    master.gain.value = 0.55;
    master.connect(AC.destination);
    noise2 = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const d = noise2.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = AC.createBufferSource();
    src.buffer = noise2;
    src.loop = true;
    windF = AC.createBiquadFilter();
    windF.type = "bandpass";
    windF.frequency.value = 500;
    windF.Q.value = 0.6;
    windG = AC.createGain();
    windG.gain.value = 0;
    src.connect(windF).connect(windG).connect(master);
    src.start();
    startMusic();
  }
  function setWind(speed) {
    if (!AC) return;
    const v = Math.min(1, Math.max(0, (speed - 8) / 50));
    windG.gain.setTargetAtTime(v * 0.45, AC.currentTime, 0.1);
    windF.frequency.setTargetAtTime(300 + v * 900, AC.currentTime, 0.1);
  }
  function nz(dur, type, f, vol, f2, dest = master, t = AC.currentTime) {
    const s = AC.createBufferSource();
    s.buffer = noise2;
    const fl = AC.createBiquadFilter();
    fl.type = type;
    fl.frequency.value = f;
    const g = AC.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(1e-3, t + dur);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }
  function tone(type, f1, f2, dur, vol, delay = 0, dest = master, t0 = AC.currentTime, attack = 0) {
    const o = AC.createOscillator();
    o.type = type;
    const g = AC.createGain();
    const t = t0 + delay;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (attack) {
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
    } else g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(1e-3, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  function sfx(n, v = 1) {
    if (!audioOK()) return;
    v = Math.max(0.01, v);
    switch (n) {
      case "thwip":
        nz(0.13, "highpass", 2500, 0.35 * v, 6e3);
        tone("triangle", 1400, 400, 0.07, 0.08 * v);
        break;
      case "punch":
        tone("sine", 160, 45, 0.16, 0.7 * v);
        nz(0.06, "lowpass", 1200, 0.4 * v);
        break;
      case "block":
        tone("square", 900, 700, 0.08, 0.12 * v);
        nz(0.1, "highpass", 3e3, 0.25 * v);
        break;
      case "shot":
        nz(0.28, "lowpass", 2600, 0.55 * v, 300);
        tone("square", 180, 60, 0.08, 0.12 * v);
        break;
      case "whoosh":
        nz(0.3, "bandpass", 400, 0.3 * v, 2e3);
        break;
      case "land":
        tone("sine", 100, 35, 0.25, 0.6 * v);
        nz(0.15, "lowpass", 500, 0.3 * v);
        break;
      case "slam":
        tone("sine", 70, 25, 0.6, 0.9 * v);
        nz(0.5, "lowpass", 300, 0.6 * v);
        break;
      case "hurt":
        tone("square", 220, 80, 0.2, 0.18 * v);
        break;
      case "splat":
        nz(0.12, "bandpass", 900, 0.3 * v, 300);
        break;
      case "crash":
        nz(0.7, "lowpass", 1800, 0.7 * v, 200);
        tone("sawtooth", 120, 40, 0.5, 0.2 * v);
        break;
      case "ring":
        tone("sine", 880, 1320, 0.15, 0.2 * v);
        tone("sine", 1320, 1760, 0.15, 0.12 * v, 0.06);
        break;
      case "fin":
        tone("sawtooth", 200, 800, 0.35, 0.12 * v);
        nz(0.4, "bandpass", 800, 0.3 * v, 3e3);
        break;
      case "cola":
        nz(0.06, "highpass", 2500, 0.6 * v, 8e3);
        nz(0.9, "highpass", 5e3, 0.18 * v, 9e3);
        tone("sine", 300, 120, 0.25, 0.15 * v, 0.9);
        break;
      // syk otwieranej puszki i lyk
      case "pickup":
        [660, 880, 1320].forEach((f, i) => tone("triangle", f, f, 0.18, 0.18, i * 0.08));
        break;
      case "level":
        [523, 659, 784, 1046].forEach((f, i) => tone("triangle", f, f * 1.01, 0.3, 0.2, i * 0.1));
        break;
      case "win":
        [392, 523, 659, 784].forEach((f, i) => tone("triangle", f, f, 0.25, 0.18, i * 0.09));
        break;
      case "alarm":
        [0, 0.25].forEach((d) => tone("square", 700, 950, 0.22, 0.08, d));
        break;
      case "ui":
        tone("sine", 900, 700, 0.05, 0.08);
        break;
    }
  }
  function startMusic() {
    if (!AC || timer) return;
    musicG = AC.createGain();
    musicG.gain.value = musOn ? 0.5 : 0;
    musicG.connect(master);
    nextT = AC.currentTime + 0.1;
    timer = setInterval(sched, 25);
  }
  function setMusic(on) {
    musOn = on;
    if (musicG) musicG.gain.setTargetAtTime(on ? 0.5 : 0, AC.currentTime, 0.3);
  }
  function setMusicMode(m) {
    mode = m;
  }
  function sched() {
    if (!AC || AC.state !== "running" || !musOn) {
      if (AC) nextT = AC.currentTime + 0.1;
      return;
    }
    while (nextT < AC.currentTime + 0.15) {
      playStep(stepN, nextT);
      stepN++;
      nextT += S16;
    }
  }
  function playStep(s, t) {
    const bar = Math.floor(s / 16) % 4, st = s % 16, ch = PROG[bar];
    const fight = mode !== "calm", boss2 = mode === "boss";
    if (st === 0) for (const n of ch) tone("triangle", mf(n), mf(n), S16 * 16, 0.035, 0, musicG, t, 0.4);
    if (fight ? st % 2 === 0 : st % 4 === 0) {
      const n = ch[0] - 24 + (st % 8 === 6 ? 12 : 0);
      tone("sawtooth", mf(n), mf(n), S16 * 1.8, boss2 ? 0.09 : 0.07, 0, musicG, t);
    }
    if (fight || st % 2 === 0) {
      const idx = fight ? st : st / 2, n = ch[idx % 3] + (Math.floor(idx / 3) % 2 ? 24 : 12);
      tone("square", mf(n), mf(n), S16 * 0.9, fight ? 0.022 : 0.015, 0, musicG, t);
    }
    if (fight ? st % 4 === 0 : st === 0 || st === 8) tone("sine", 120, 40, 0.2, fight ? 0.45 : 0.25, 0, musicG, t);
    if (fight && (st === 4 || st === 12)) nz(0.14, "highpass", 1500, 0.22, 0, musicG, t);
    if (fight ? st % 2 === 0 : st % 4 === 2) nz(0.04, "highpass", 7e3, fight ? 0.08 : 0.04, 0, musicG, t);
    if (boss2 && st % 8 === 7) tone("sine", 220, 80, 0.15, 0.25, 0, musicG, t);
  }
  function cityAmbience(dt, nearStreet) {
    if (!audioOK()) return;
    hornT -= dt;
    sirenT -= dt;
    if (hornT <= 0) {
      hornT = 6 + Math.random() * 14;
      if (nearStreet) {
        const f = 330 + Math.random() * 120;
        tone("square", f, f, 0.25, 0.035);
        tone("square", f * 1.26, f * 1.26, 0.25, 0.025);
      }
    }
    if (sirenT <= 0) {
      sirenT = 30 + Math.random() * 40;
      for (let i = 0; i < 6; i++) tone("sine", i % 2 ? 900 : 650, i % 2 ? 650 : 900, 0.5, 0.02, i * 0.5);
    }
  }
  var AC, master, noise2, windG, windF, audioOK, musicG, musOn, mode, stepN, nextT, timer, BPM, S16, PROG, mf, hornT, sirenT;
  var init_dzwiek = __esm({
    "js/dzwiek.js"() {
      AC = null;
      master = null;
      noise2 = null;
      windG = null;
      windF = null;
      audioOK = () => AC && AC.state === "running";
      musicG = null;
      musOn = true;
      mode = "calm";
      stepN = 0;
      nextT = 0;
      timer = null;
      BPM = 118;
      S16 = 60 / BPM / 4;
      PROG = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
      mf = (m) => 440 * Math.pow(2, (m - 69) / 12);
      hornT = 6;
      sirenT = 25;
    }
  });

  // js/wejscie.js
  function lockMouse() {
    try {
      const r = canvas.requestPointerLock();
      if (r && r.catch) r.catch(() => {
      });
    } catch (e) {
    }
  }
  function pollPads() {
    pad.prev = pad.b.slice();
    pad.b.fill(false);
    pad.a = [0, 0, 0, 0];
    pad.connected = false;
    pad.gp = null;
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of gps) {
      if (!gp || !gp.connected) continue;
      pad.connected = true;
      if (!pad.gp) {
        pad.gp = gp;
        pad.name = gp.id;
      }
      gp.buttons.forEach((b, i) => {
        if (i < 18 && (b.pressed || b.value > 0.35)) pad.b[i] = true;
      });
      for (let a = 0; a < 4; a++) {
        const v = gp.axes[a] || 0;
        if (Math.abs(v) > Math.abs(pad.a[a])) pad.a[a] = v;
      }
    }
    pad.type = /054c|playstation|dualsense|dualshock|wireless controller/i.test(pad.name) ? "ps" : "xbox";
    if (pad.b.some((b, i) => b && !pad.prev[i]) || pad.a.some((v) => Math.abs(v) > 0.5)) {
      G.lastDev = "pad";
      if (pad.b.some((b, i) => b && !pad.prev[i])) initAudio();
    }
  }
  function stick(x, y) {
    const m = Math.hypot(x, y);
    if (m < 0.18) return [0, 0];
    const k = Math.min(1, (m - 0.18) / 0.82) / m;
    return [x * k, y * k];
  }
  function endFrame() {
    for (const k in KP) delete KP[k];
    for (const k in MP) delete MP[k];
    mouse.dx = mouse.dy = mouse.wheel = 0;
  }
  function gameInput() {
    const [lx, ly] = stick(pad.a[0], pad.a[1]);
    const [rx, ry] = stick(pad.a[2], pad.a[3]);
    let mx = lx, my = ly;
    if (K.KeyW || K.ArrowUp) my -= 1;
    if (K.KeyS || K.ArrowDown) my += 1;
    if (K.KeyA || K.ArrowLeft) mx -= 1;
    if (K.KeyD || K.ArrowRight) mx += 1;
    const locked = document.pointerLockElement === canvas;
    return {
      mx: clamp(mx, -1, 1),
      my: clamp(my, -1, 1),
      plx: rx,
      ply: ry,
      mdx: locked ? mouse.dx : 0,
      mdy: locked ? mouse.dy : 0,
      swing: pad.b[7] || !!K.ShiftLeft || !!K.ShiftRight,
      jump: pad.b[0] || !!K.Space,
      jumpP: pp(0) || !!KP.Space,
      punchP: pp(2) || locked && !!MP[0] || !!KP.KeyF,
      punch: pad.b[2] || locked && !!MB[0] || !!K.KeyF,
      specialP: pp(3) || !!KP.KeyE || !!KP.KeyQ,
      webP: pp(5) || locked && !!MP[2] || !!KP.KeyR,
      dodgeP: pp(1) || !!KP.KeyC || !!KP.ControlLeft,
      mapP: pp(8) || !!KP.KeyM || !!KP.Tab,
      pauseP: pp(9) || !!KP.Escape || !!KP.KeyP
    };
  }
  function navInput(dt) {
    const [lx, ly] = stick(pad.a[0], pad.a[1]);
    const held = {
      up: pad.b[12] || ly < -0.55 || K.ArrowUp || K.KeyW,
      down: pad.b[13] || ly > 0.55 || K.ArrowDown || K.KeyS,
      left: pad.b[14] || lx < -0.55 || K.ArrowLeft || K.KeyA,
      right: pad.b[15] || lx > 0.55 || K.ArrowRight || K.KeyD
    };
    const o = {};
    for (const d in held) {
      const s = NV[d] || (NV[d] = { t: 0, n: 0 });
      if (held[d]) {
        if (s.t === 0) {
          o[d] = true;
          s.n = 0.38;
        }
        s.t += dt;
        if (s.t >= s.n) {
          o[d] = true;
          s.n += 0.11;
        }
      } else s.t = 0;
    }
    o.ok = pp(0) || pp(9) || !!KP.Enter || !!KP.Space || !!KP.NumpadEnter;
    o.back = pp(1) || !!KP.Escape || !!KP.Backspace;
    o.tl = pp(4) || !!KP.KeyQ;
    o.tr = pp(5) || !!KP.KeyE;
    o.y = pp(3) || !!KP.KeyX;
    return o;
  }
  function rumble(dur, strong, weak) {
    const gp = pad.gp;
    if (!gp || !gp.vibrationActuator) return;
    try {
      gp.vibrationActuator.playEffect("dual-rumble", { duration: dur * 1e3, strongMagnitude: strong, weakMagnitude: weak });
    } catch (e) {
    }
  }
  var K, KP, MB, MP, mouse, pad, pp, NV;
  var init_wejscie = __esm({
    "js/wejscie.js"() {
      init_util();
      init_stan();
      init_dzwiek();
      K = {};
      KP = {};
      MB = {};
      MP = {};
      mouse = { dx: 0, dy: 0, wheel: 0 };
      pad = { b: new Array(18).fill(false), prev: new Array(18).fill(false), a: [0, 0, 0, 0], name: "", type: "xbox", connected: false, gp: null };
      addEventListener("keydown", (e) => {
        if (!K[e.code]) KP[e.code] = true;
        K[e.code] = true;
        G.lastDev = "kb";
        if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
        initAudio();
      });
      addEventListener("keyup", (e) => {
        K[e.code] = false;
      });
      addEventListener("blur", () => {
        for (const k in K) K[k] = false;
      });
      addEventListener("mousedown", (e) => {
        MB[e.button] = true;
        MP[e.button] = true;
        G.lastDev = "kb";
        initAudio();
      });
      addEventListener("mouseup", (e) => {
        MB[e.button] = false;
      });
      addEventListener("mousemove", (e) => {
        if (document.pointerLockElement === canvas) {
          mouse.dx += e.movementX;
          mouse.dy += e.movementY;
          G.lastDev = "kb";
        }
      });
      addEventListener("wheel", (e) => {
        mouse.wheel += e.deltaY;
      }, { passive: true });
      addEventListener("contextmenu", (e) => e.preventDefault());
      pp = (i) => pad.b[i] && !pad.prev[i];
      NV = {};
    }
  });

  // js/scenki.js
  function ui() {
    if (bars) return;
    const st = document.createElement("style");
    st.textContent = `.cbar{position:fixed;left:0;right:0;height:0;background:#000;z-index:8;transition:height .7s ease}
  #cSub{position:fixed;left:0;right:0;bottom:15vh;text-align:center;z-index:9;opacity:0;transition:opacity .6s;pointer-events:none;color:#fff;text-shadow:0 2px 12px #000}
  #cSub b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(34px,6.5vh,64px);letter-spacing:4px;font-weight:400}
  #cSub span{font-family:'Rajdhani',Arial,sans-serif;font-size:clamp(17px,3vh,26px);font-weight:600;letter-spacing:1px}
  #cSkip{position:fixed;right:24px;bottom:calc(11vh - 14px);z-index:9;color:#cfe;font:600 15px Rajdhani,Arial;opacity:0;transition:opacity .6s}`;
    document.head.appendChild(st);
    bars = [document.createElement("div"), document.createElement("div")];
    bars[0].className = "cbar";
    bars[0].style.top = 0;
    bars[1].className = "cbar";
    bars[1].style.bottom = 0;
    sub = document.createElement("div");
    sub.id = "cSub";
    sub.innerHTML = "<b></b><span></span>";
    subT = sub.querySelector("b");
    subS = sub.querySelector("span");
    const skip = document.createElement("div");
    skip.id = "cSkip";
    skip.textContent = "SPACJA / A \u2014 pomi\u0144";
    skip.className = "cskip";
    document.body.append(bars[0], bars[1], sub, skip);
  }
  function playCine(name, ctx = {}) {
    ui();
    ctx.p = P.pos.clone();
    if (ctx.b) ctx.b = ctx.b.clone();
    cine = { name, shots: SCENES[name](ctx), i: 0, t: 0, onEnd: ctx.onEnd, sk: 0 };
    G.cine = name;
    const h = document.getElementById("hud");
    if (h) h.style.visibility = "hidden";
    bars[0].style.height = bars[1].style.height = "11vh";
    document.getElementById("cSkip").style.opacity = 0.9;
    setShotText();
  }
  function setShotText() {
    const s = cine.shots[cine.i];
    if (s.text) {
      subT.textContent = s.text;
      subS.textContent = s.sub || "";
      sub.style.opacity = 1;
    } else sub.style.opacity = 0;
  }
  function endCine() {
    if (!cine) return;
    const cb = cine.onEnd;
    cine = null;
    G.cine = null;
    bars[0].style.height = bars[1].style.height = "0";
    sub.style.opacity = 0;
    document.getElementById("cSkip").style.opacity = 0;
    const h = document.getElementById("hud");
    if (h) h.style.visibility = "";
    if (cb) cb();
  }
  function updateCine(dt) {
    if (!cine) return false;
    cine.sk += dt;
    if (cine.sk > 0.6 && (KP.Space || KP.Enter || KP.Escape || MP[0] || pp(0) || pp(9))) {
      endCine();
      return false;
    }
    const s = cine.shots[cine.i];
    cine.t += dt;
    const t = clamp(cine.t / s.dur, 0, 1);
    s.at(t);
    camera.updateProjectionMatrix();
    if (cine.t >= s.dur) {
      if (++cine.i >= cine.shots.length) {
        endCine();
        return false;
      }
      cine.t = 0;
      setShotText();
    }
    return true;
  }
  var bars, sub, subT, subS, cine, ease, _a, _b, SCENES;
  var init_scenki = __esm({
    "js/scenki.js"() {
      init_util();
      init_stan();
      init_wejscie();
      init_miasto();
      init_dzwiek();
      bars = null;
      sub = null;
      subT = null;
      subS = null;
      cine = null;
      ease = (t) => t * t * (3 - 2 * t);
      _a = new V3();
      _b = new V3();
      SCENES = {
        intro: (ctx) => {
          const f = new V3(Math.sin(START_H), 0, Math.cos(START_H)), r = new V3(f.z, 0, -f.x), p = ctx.p;
          return [
            { dur: 4.2, text: "NOWY JORK", sub: "Miasto, kt\xF3re nigdy nie \u015Bpi.", at: (t) => {
              const a = lerp(0.5, -0.7, ease(t));
              camera.position.copy(p).addScaledVector(f, -Math.cos(a) * 4.4).addScaledVector(r, Math.sin(a) * 4.4);
              camera.position.y = p.y + 1.1 + t * 0.6;
              camera.lookAt(p.x, p.y + 0.9, p.z);
              camera.fov = 50;
            } },
            { dur: 4.2, text: "", sub: "", at: (t) => {
              camera.position.copy(p).addScaledVector(f, lerp(3, 16, ease(t)));
              camera.position.y = p.y + lerp(0.4, 9, ease(t));
              camera.lookAt(_a.copy(p).addScaledVector(f, 320).add(_b.set(0, -75, 0)));
              camera.fov = 62;
            } },
            { dur: 3.4, text: "Kto\u015B musi go pilnowa\u0107.", sub: "", at: (t) => {
              camera.position.copy(p).addScaledVector(f, lerp(-3.8, -2.6, t)).addScaledVector(r, 0.9);
              camera.position.y = p.y + 1.7;
              camera.lookAt(_a.copy(p).addScaledVector(f, 40).add(_b.set(0, -6, 0)));
              camera.fov = 58;
            } }
          ];
        },
        boss: (ctx) => {
          const b = ctx.b, p = ctx.p, d = _a.subVectors(p, b).setY(0).normalize().clone(), r = new V3(d.z, 0, -d.x);
          return [
            { dur: 3.8, text: "NOSORO\u017BEC", sub: "Cz\u0142owiek w pancerzu, kt\xF3rego nic nie zatrzyma.", at: (t) => {
              camera.position.copy(b).addScaledVector(d, lerp(11, 6.5, ease(t))).addScaledVector(r, lerp(-3, 1, t));
              camera.position.y = b.y + lerp(0.5, 1.2, t);
              camera.lookAt(b.x, b.y + 2.6, b.z);
              camera.fov = lerp(52, 44, t);
            } },
            { dur: 2, text: "", sub: "", at: (t) => {
              camera.position.copy(p).addScaledVector(d, -3.2).addScaledVector(r, 1.2);
              camera.position.y = p.y + 1.6;
              camera.lookAt(p.x, p.y + 1.5, p.z);
              camera.position.y += t * 0.15;
              camera.fov = 55;
            } }
          ];
        },
        fisk: (ctx) => {
          const b = ctx.b, R2 = ctx.room, y = b.y, bv = R2.cd - 3.8;
          const at = (u, v, h) => {
            const [x, z] = R2.W(u, v);
            camera.position.set(x, y + h, z);
          };
          return [
            { dur: 4, text: "WILSON FISK", sub: "Kingpin. Prawie ca\u0142e miasto jest jego.", at: (t) => {
              at(lerp(-6, -3.5, ease(t)), lerp(R2.cd * 0.3, R2.cd * 0.45, ease(t)), 1.7);
              camera.lookAt(b.x, y + 1.5, b.z);
              camera.fov = 50;
            } },
            { dur: 3.4, text: "Nie powiniene\u015B tu wchodzi\u0107, paj\u0105ku.", sub: "", at: (t) => {
              at(0.9, bv - lerp(5.2, 3.6, ease(t)), 1.6);
              camera.lookAt(b.x, y + 1.55, b.z);
              camera.fov = 42;
            } }
          ];
        },
        fisk2: (ctx) => {
          const b = ctx.b, R2 = ctx.room, y = b.y, bv = R2.cd - 3.8;
          return [{ dur: 3.4, text: "Skoro nalegasz\u2026", sub: "B\u0105d\u017A got\xF3w.", at: (t) => {
            const [x, z] = R2.W(-2.6, bv - lerp(6, 4.4, ease(t)));
            camera.position.set(x, y + lerp(0.6, 1.3, t), z);
            camera.lookAt(b.x, y + 1.9, b.z);
            camera.fov = 46;
          } }];
        },
        fiskEnd: (ctx) => {
          const b = ctx.b, R2 = ctx.room, y = b.y, bv = R2.cd - 3.8;
          return [{ dur: 4.2, text: "KINGPIN POKONANY", sub: "Nowy Jork odetchn\u0105\u0142 z ulg\u0105.", at: (t) => {
            const a = lerp(0.3, 2.6, ease(t)), [x, z] = R2.W(5 * Math.cos(a), bv - 5 * Math.sin(a));
            camera.position.set(x, y + lerp(1.3, 3, t), z);
            camera.lookAt(b.x, y + 0.8, b.z);
            camera.fov = 48;
          } }];
        },
        bossEnd: (ctx) => {
          const b = ctx.b;
          return [
            { dur: 4.2, text: "NOSORO\u017BEC POKONANY", sub: "Central Park zn\xF3w jest bezpieczny.", at: (t) => {
              const a = lerp(0.3, 2.2, ease(t));
              camera.position.set(b.x + Math.cos(a) * 9, b.y + lerp(1.4, 4.2, t), b.z + Math.sin(a) * 9);
              camera.lookAt(b.x, b.y + 0.8, b.z);
              camera.fov = 48;
            } }
          ];
        }
      };
    }
  });

  // js/fisk.js
  function makeKingpin(room) {
    const H = buildKingpin();
    H.root.scale.setScalar(1.1);
    scene.add(H.root);
    const [x, z] = room.W(0, room.cd - 3.8), pos = new V3(x, SW, z);
    const b = {
      H,
      type: "boss",
      name: "KINGPIN",
      pos,
      vel: new V3(),
      yaw: Math.PI,
      hp: 170,
      max: 170,
      st: "idle",
      t: 0,
      cd: 2,
      webs: 0,
      dead: false,
      gone: false,
      air: false,
      down: 0,
      scale: 1.25,
      state: "fight",
      dir: new V3(),
      pc: newPose(),
      pt: newPose(),
      ph: 0,
      deadT: 0,
      room,
      hit: fiskHit,
      webFn: fiskWeb,
      finFn: fiskFinish,
      hits: 0,
      blockT: 0,
      swings: 0,
      chain: 0,
      ring: -1,
      summoned: [false, false]
    };
    H.root.position.copy(pos);
    return b;
  }
  function fiskHit(b, dmg) {
    if (b.dead) return false;
    if (!vulnerable(b)) {
      burst(b.pos.x, b.pos.y + 2.6, b.pos.z, 8, 10475775, 3);
      sfx("block");
      popText("BLOK!");
      hint("fisk", "Kingpin blokuje ciosy z przodu. Zajd\u017A go od ty\u0142u (unik + bieg za plecy) albo poczekaj, a\u017C zm\u0119czy si\u0119 po ataku!");
      b.hits++;
      b.blockT = 3;
      if (b.hits >= 3 && b.st === "walk") {
        b.hits = 0;
        b.st = "grabW";
        b.t = 0.45;
        popText("KONTRA!");
      }
      return "block";
    }
    b.hp -= dmg * 1.15;
    burst(b.pos.x, b.pos.y + 2.4, b.pos.z, 14, 16773824, 5);
    sfx("punch");
    rumble(0.1, 0.5, 0.5);
    G.shake = Math.max(G.shake, 0.2);
    addXP(8);
    if (b.hp <= 0) defeated(b);
    return true;
  }
  function fiskWeb(b) {
    if (b.dead) return;
    b.webs++;
    popText(`SIE\u0106 ${b.webs}/5`);
    if (b.webs >= 5 && b.st !== "stun") {
      b.st = "stun";
      b.t = 2.5;
      b.webs = 0;
      popText("KINGPIN OG\u0141USZONY!");
      sfx("win", 0.5);
    }
  }
  function fiskFinish(b) {
    b.hp -= 10;
    b.st = "stun";
    b.t = 1.6;
    popText("WYKO\u0143CZENIE!");
    if (b.hp <= 0) defeated(b);
  }
  function defeated(b) {
    b.dead = true;
    b.hp = 0;
    b.st = "down";
    b.deadT = 0;
    save.fisk = (save.fisk || 0) + 1;
    addXP(3e3);
    doSave();
    sfx("level");
    G.slowT = 1.2;
    G.shake = 0.6;
    F.phase = "done";
    setTimeout(() => {
      if (F && !G.cine) playCine("fiskEnd", { b: b.pos, room: F.room, onEnd: () => showMsg("KINGPIN POKONANY!", "+3000 PD \xB7 Wyjd\u017A drzwiami na ulic\u0119", 5) });
    }, 900);
  }
  function startFisk(d) {
    if (F) return;
    const room = d.room;
    room.o = [(room.bx0 + room.bx1) / 2, SW, (room.bz0 + room.bz1) / 2];
    F = { d, room, boss: makeKingpin(room), phase: "intro", crime: null };
    playCine("fisk", { b: F.boss.pos, room, onEnd: () => spawnGuards(3 + (save.lvl > 3 ? 1 : 0), true) });
  }
  function spawnGuards(n, first) {
    const room = F.room, [ax, az] = room.W(-7, room.cd * 0.35), [bx2, bz] = room.W(7, room.cd * 0.62);
    const cr2 = makeCrime(Math.min(ax, bx2), Math.max(ax, bx2), Math.min(az, bz), Math.max(az, bz), SW, null, n + 2, true);
    cr2.alert = true;
    for (const e of cr2.list) e.state = "fight";
    F.crime = cr2;
    if (first) F.phase = "guards";
    showMsg(first ? "STRA\u017B KINGPINA" : "KINGPIN WZYWA STRA\u017B", first ? "Pokonaj ochroniarzy, zanim dotrzesz do Fiska." : "Pokonaj ich, ale nie odwracaj si\u0119 od Kingpina!", 3.5);
  }
  function startBossFight() {
    F.phase = "boss";
    F.boss.st = "walk";
    F.boss.cd = 1.2;
    enemies.push(F.boss);
    showMsg("KINGPIN", "Blokuje z przodu \u2014 zachod\u017A go od ty\u0142u! Trzy fazy, z ka\u017Cd\u0105 szybszy.", 4.5);
    sfx("alarm");
  }
  function abortFisk() {
    if (!F) return;
    const f = F;
    F = null;
    if (f.crime) for (const e of f.crime.list) removeEnemy(e);
    if (f.crime) {
      const i = crimes.indexOf(f.crime);
      if (i >= 0) crimes.splice(i, 1);
    }
    if (enemies.includes(f.boss)) removeEnemy(f.boss);
    else scene.remove(f.boss.H.root);
    if (G.boss === f.boss) G.boss = null;
  }
  function updateFisk(dt) {
    if (!F) return;
    const room = F.room;
    const inRoom = P.pos.x > room.bx0 - 1.5 && P.pos.x < room.bx1 + 1.5 && P.pos.z > room.bz0 - 4 && P.pos.z < room.bz1 + 4 && P.pos.y < SW + room.ch + 1;
    if (!inRoom || P.dead) {
      abortFisk();
      return;
    }
    const b = F.boss, H = b.H;
    if (F.phase === "guards" && F.crime && F.crime.list.every((e) => e.dead)) {
      F.phase = "intro2";
      playCine("fisk2", { b: b.pos, room, onEnd: startBossFight });
    }
    if (F.phase === "boss" || F.phase === "done") G.boss = b.dead ? null : b;
    const t = b.pt;
    zeroPose(t);
    if (b.dead) {
      b.deadT += dt;
      b.down += (1 - b.down) * damp(3, dt);
      t.bp = 0.5;
      t.sLz = 0.8;
      t.sRz = -0.8;
    } else if (F.phase === "boss") {
      const ph = PH(b), sp = SPD[ph];
      for (let k = 0; k < 2; k++) if (!b.summoned[k] && b.hp <= b.max * (k ? 0.33 : 0.66)) {
        b.summoned[k] = true;
        spawnGuards(k ? 3 : 2, false);
      }
      b.blockT -= dt;
      if (b.blockT <= 0) b.hits = 0;
      const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
      const face = (k) => {
        b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(k * sp, dt));
      };
      b.t -= dt;
      b.cd -= dt;
      const tired = () => {
        b.st = "tired";
        b.t = TIRED[ph];
        popText("KINGPIN ZM\u0118CZONY \u2014 BIJ!");
      };
      switch (b.st) {
        case "walk":
          face(4.5);
          if (dist > 3.2) {
            b.pos.x += dx / dist * 2.9 * sp * dt;
            b.pos.z += dz / dist * 2.9 * sp * dt;
          }
          if (b.cd <= 0) {
            const r = Math.random();
            if (dist < 2.8 && r < 0.55) {
              b.st = "grabW";
              b.t = 0.55 / sp;
            } else if (dist < 5) {
              b.st = "caneW";
              b.t = 0.8 / sp;
              b.swings = ph + 1;
            } else if (dist > 9 && r < 0.6) {
              b.st = "chargeW";
              b.t = 1 / sp;
              b.chain = ph >= 1 ? 1 : 0;
            } else {
              b.st = "stompW";
              b.t = 1 / sp;
            }
          }
          break;
        case "caneW":
          face(7);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "cane";
            b.t = 0.4 / sp;
            swingCane(b, dist);
          }
          break;
        case "cane":
          if (b.t <= 0) {
            if (--b.swings > 0) {
              b.st = "caneW";
              b.t = 0.28 / sp;
            } else tired();
          }
          break;
        case "grabW":
          face(8);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "grab";
            b.t = 0.5;
            grab(b, dist);
          }
          break;
        case "grab":
          if (b.t <= 0) {
            tired();
          }
          break;
        case "stompW":
          face(5);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "stomp";
            b.t = 1;
            b.ring = 0;
            sfx("slam");
            G.shake = Math.max(G.shake, 0.6);
            rumble(0.3, 1, 0.6);
          }
          break;
        case "stomp":
          if (b.ring >= 0) {
            const R0 = b.ring;
            b.ring += (11 + ph * 3) * dt;
            const R1 = b.ring;
            for (let i = 0; i < 18; i++) {
              const a = i / 18 * 6.283;
              burst(b.pos.x + Math.cos(a) * R1, b.pos.y + 0.2, b.pos.z + Math.sin(a) * R1, 1, 14273976, 2);
            }
            if (dist > R0 - 0.8 && dist < R1 + 0.8 && P.pos.y - b.pos.y < 0.9) {
              if (hurtPlayer(20, b, 12)) b.ring = -1;
            }
            if (b.ring > 16) b.ring = -1;
          }
          if (b.t <= 0) {
            b.ring = -1;
            b.st = "walk";
            b.cd = 1.2 * CDM[ph];
          }
          break;
        case "chargeW":
          face(7);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "charge";
            b.t = 1.4;
            b.dir.set(dx, 0, dz).normalize();
            sfx("slam", 0.4);
          }
          break;
        case "charge":
          b.pos.addScaledVector(b.dir, 15 * sp * dt);
          b.yaw = Math.atan2(b.dir.x, b.dir.z);
          if (dist < 3 && Math.abs(P.pos.y - b.pos.y) < 2.5 && hurtPlayer(28, b, 18)) {
            tired();
          }
          if (b.t <= 0) {
            if (b.chain-- > 0) {
              b.st = "chargeW";
              b.t = 0.55;
            } else {
              tired();
              G.shake = Math.max(G.shake, 0.3);
            }
          }
          break;
        case "tired":
        case "stun":
          if (b.t <= 0) {
            b.st = "walk";
            b.cd = 0.9 * CDM[ph];
          }
          break;
      }
      b.pos.x = Math.max(room.bx0 + 1.4, Math.min(room.bx1 - 1.4, b.pos.x));
      b.pos.z = Math.max(room.bz0 + 1.4, Math.min(room.bz1 - 1.4, b.pos.z));
      b.pos.y = SW;
    } else if (F.phase === "intro" || F.phase === "guards" || F.phase === "intro2") {
      const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z;
      b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(2, dt));
    }
    switch (b.st) {
      case "idle":
        t.by = Math.sin(G.time * 2) * 6e-3;
        t.sLz = 0.3;
        t.sRz = -0.3;
        t.eL = -0.3;
        t.eR = -0.3;
        t.hLz = 0.12;
        t.hRz = -0.12;
        break;
      case "walk":
        b.ph += dt * 4.5 * SPD[PH(b)];
        runPose(t, b.ph, 0.5, false);
        t.sLz = 0.5;
        t.sRz = -0.5;
        break;
      case "caneW":
        t.sRx = -2.8;
        t.eR = -0.4;
        t.bp = -0.2;
        t.sLz = 0.6;
        break;
      case "cane":
        t.sRx = -0.6;
        t.eR = -0.1;
        t.bp = 0.5;
        t.spy = -0.5;
        t.sLz = 0.6;
        break;
      case "grabW":
        t.sLx = -1.6;
        t.sRx = -1.6;
        t.eL = -0.2;
        t.eR = -0.2;
        t.bp = 0.3;
        break;
      case "grab":
        t.sLx = -1;
        t.sRx = -1;
        t.bp = 0.7;
        t.by = -0.2;
        break;
      case "stompW":
        t.hRx = -1.5;
        t.kR = 1.4;
        t.sLx = -1;
        t.sRx = -1;
        t.by = 0.1;
        break;
      case "stomp":
        t.hRx = 0.3;
        t.kR = 0.1;
        t.by = -0.25;
        t.bp = 0.5;
        t.sLx = -0.8;
        t.sRx = -0.8;
        break;
      case "chargeW":
        t.by = -0.25;
        t.bp = 0.7;
        t.hLx = -0.8;
        t.kL = 1.2;
        t.hRx = 0.4;
        t.sLx = 0.8;
        t.sRx = 0.8;
        break;
      case "charge":
        b.ph += dt * 11;
        runPose(t, b.ph, 1, true);
        t.bp = 0.8;
        break;
      case "tired":
        t.bp = 0.7;
        t.by = -0.2;
        t.sLx = -0.9;
        t.sRx = -0.9;
        t.kL = 0.5;
        t.kR = 0.5;
        t.hLx = -0.4;
        t.hRx = -0.4;
        t.hx = 0.2 + Math.sin(G.time * 8) * 0.08;
        break;
      case "stun":
        t.bp = 0.2;
        t.spy = Math.sin(G.time * 3) * 0.4;
        t.hx = 0.4;
        t.sLz = 0.3;
        t.sRz = -0.3;
        break;
    }
    blendPose(b.pc, t, damp(b.st === "stomp" || b.st === "grab" ? 25 : 10, dt));
    applyPose(H, b.pc);
    H.setHands("open", b.st === "idle" ? "open" : "fist");
    H.root.position.copy(b.pos);
    H.root.position.y += 0.2 * b.down;
    H.root.rotation.set(-Math.PI / 2 * b.down, b.yaw, 0, "YXZ");
  }
  function swingCane(b, dist) {
    sfx("slam", 0.7);
    G.shake = Math.max(G.shake, 0.4);
    burst(b.pos.x + Math.sin(b.yaw) * 2, b.pos.y + 1, b.pos.z + Math.cos(b.yaw) * 2, 20, 16769952, 6);
    if (dist < 6.2 && Math.abs(P.pos.y - b.pos.y) < 2.5) hurtPlayer(22, b, 14);
  }
  function grab(b, dist) {
    if (dist < 3.2 && Math.abs(P.pos.y - b.pos.y) < 2) {
      if (hurtPlayer(34, b, 18)) {
        sfx("slam");
        G.shake = 0.7;
        popText("CHWYT!");
      }
    } else popText("UNIK!");
  }
  var F, PH, SPD, CDM, TIRED, behind, vulnerable;
  var init_fisk = __esm({
    "js/fisk.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_postac();
      init_gracz();
      init_wrogowie();
      init_dzwiek();
      init_wejscie();
      init_ui();
      init_scenki();
      F = null;
      PH = (b) => b.hp > b.max * 0.66 ? 0 : b.hp > b.max * 0.33 ? 1 : 2;
      SPD = [1, 1.2, 1.5];
      CDM = [1, 0.7, 0.45];
      TIRED = [2.6, 2, 1.4];
      behind = (b) => {
        const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, l = Math.hypot(dx, dz) || 1;
        return (dx * Math.sin(b.yaw) + dz * Math.cos(b.yaw)) / l < -0.25;
      };
      vulnerable = (b) => b.st === "tired" || b.st === "stun" || behind(b);
    }
  });

  // js/misje.js
  function makeBoss() {
    const H = buildBoss();
    H.setHands("fist", "fist");
    H.root.scale.setScalar(1.75);
    scene.add(H.root);
    return {
      H,
      type: "boss",
      name: "NOSORO\u017BEC",
      pos: new V3(ARENA.x, 0, ARENA.z - 20),
      vel: new V3(),
      yaw: 0,
      hp: 60,
      max: 60,
      st: "walk",
      t: 0,
      cd: 2,
      webs: 0,
      dead: false,
      gone: false,
      air: false,
      down: 0,
      scale: 1.75,
      state: "fight",
      dir: new V3(),
      pc: newPose(),
      pt: newPose(),
      ph: 0,
      deadT: 0
    };
  }
  function bossHit(b, dmg) {
    if (b.dead) return false;
    if (!vulnerable2(b)) {
      burst(b.pos.x, b.pos.y + 2.5, b.pos.z, 10, 10475775, 4);
      sfx("block");
      popText("PANCERZ!");
      hint("boss", "Nosoro\u017Cec ma pancerz! Zr\xF3b unik przed szar\u017C\u0105 \u2014 po niej jest zm\u0119czony. Albo 3 razy trafiaj go sieci\u0105.");
      return "block";
    }
    b.hp -= dmg * 2;
    burst(b.pos.x, b.pos.y + 2.2, b.pos.z, 14, 16773824, 5);
    sfx("punch");
    G.shake = Math.max(G.shake, 0.2);
    rumble(0.1, 0.5, 0.5);
    addXP(8);
    if (b.hp <= 0) bossDefeated(b);
    return true;
  }
  function bossWeb(b) {
    if (b.dead) return;
    b.webs++;
    popText(`SIE\u0106 ${b.webs}/3`);
    if (b.webs >= 3 && b.st !== "stun") {
      b.st = "stun";
      b.t = 3.5;
      b.webs = 0;
      popText("NOSORO\u017BEC OG\u0141USZONY!");
      sfx("win", 0.5);
    }
  }
  function bossFinish(b) {
    b.hp -= 10;
    b.st = "stun";
    b.t = 2.2;
    popText("WYKO\u0143CZENIE!");
    if (b.hp <= 0) bossDefeated(b);
  }
  function bossDefeated(b) {
    b.dead = true;
    b.hp = 0;
    b.deadT = 0;
    b.st = "down";
    save.bossWins++;
    addXP(1500);
    doSave();
    sfx("level");
    showMsg("NOSORO\u017BEC POKONANY!", "+1500 PD \xB7 Wr\xF3ci za 2 minuty na rewan\u017C", 5);
    G.slowT = 1.2;
    G.shake = 0.6;
    setTimeout(() => {
      if (G.state === "play" && !G.cine) playCine("bossEnd", { b: b.pos });
    }, 900);
  }
  function startBoss() {
    boss = makeBoss();
    enemies.push(boss);
    boss.H.root.position.copy(boss.pos);
    boss.yaw = Math.atan2(P.pos.x - boss.pos.x, P.pos.z - boss.pos.z);
    boss.H.root.rotation.y = boss.yaw;
    playCine("boss", { b: boss.pos });
    showMsg("NOSORO\u017BEC", "Unikaj szar\u017Cy, a gdy si\u0119 zm\u0119czy \u2014 bij! Sie\u0107 te\u017C go og\u0142usza.", 4.5);
    sfx("alarm");
  }
  function updateBoss(dt) {
    if (!boss) {
      bossWait -= dt;
      const d = Math.hypot(P.pos.x - ARENA.x, P.pos.z - ARENA.z);
      if (bossWait <= 0 && d < 45 && P.pos.y < 30 && !G.race) startBoss();
      G.boss = null;
      return;
    }
    const b = boss, H = b.H;
    G.boss = b.dead ? null : b;
    if (b.dead) {
      b.deadT += dt;
      b.down += (1 - b.down) * damp(4, dt);
      if (b.deadT > 12) {
        removeEnemy(b);
        boss = null;
        bossWait = 120;
      }
    } else {
      if (P.dead) {
        removeEnemy(b);
        boss = null;
        bossWait = 3;
        G.boss = null;
        return;
      }
      const dx = P.pos.x - b.pos.x, dz = P.pos.z - b.pos.z, dist = Math.hypot(dx, dz);
      if (Math.hypot(P.pos.x - ARENA.x, P.pos.z - ARENA.z) > 160) {
        removeEnemy(b);
        boss = null;
        bossWait = 2;
        showMsg("NOSORO\u017BEC UCIEK\u0141", "Wr\xF3\u0107 do Central Parku, \u017Ceby doko\u0144czy\u0107 walk\u0119", 3);
        return;
      }
      const face = (k) => {
        b.yaw = angLerp(b.yaw, Math.atan2(dx, dz), damp(k, dt));
      };
      b.t -= dt;
      b.cd -= dt;
      switch (b.st) {
        case "walk":
          face(5);
          if (dist > 4) {
            b.pos.x += dx / dist * 3.4 * dt;
            b.pos.z += dz / dist * 3.4 * dt;
          }
          if (dist < 5 && b.cd <= 0) {
            b.st = "slamW";
            b.t = 0.8;
          } else if (dist > 9 && b.cd <= 0) {
            b.st = "chargeW";
            b.t = 1;
          }
          break;
        case "chargeW":
          face(6);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "charge";
            b.t = 2.3;
            b.dir.set(dx, 0, dz).normalize();
            sfx("slam", 0.4);
          }
          break;
        case "charge":
          b.pos.addScaledVector(b.dir, 25 * dt);
          b.yaw = Math.atan2(b.dir.x, b.dir.z);
          if (Math.random() < 0.5) burst(b.pos.x, 0.2, b.pos.z, 2, 9075290, 3);
          if (dist < 3 && Math.abs(P.pos.y - b.pos.y) < 3) {
            if (hurtPlayer(25, b, 18)) {
              b.st = "tired";
              b.t = 2.5;
            }
          }
          if (b.t <= 0 || Math.hypot(b.pos.x - ARENA.x, b.pos.z - ARENA.z) > 70) {
            b.st = "tired";
            b.t = 3;
            G.shake = Math.max(G.shake, 0.3);
            sfx("slam", 0.6);
            burst(b.pos.x, 0.5, b.pos.z, 20, 9075290, 6);
            popText("JEST ZM\u0118CZONY \u2014 BIJ!");
          }
          break;
        case "slamW":
          face(4);
          G.sense = true;
          if (b.t <= 0) {
            b.st = "slam";
            b.t = 0.5;
            sfx("slam");
            G.shake = Math.max(G.shake, 0.6);
            rumble(0.3, 1, 0.6);
            for (let i = 0; i < 30; i++) {
              const a = i / 30 * 6.283;
              burst(b.pos.x + Math.cos(a) * 3, 0.3, b.pos.z + Math.sin(a) * 3, 1, 12432808, 5);
            }
            if (dist < 6.5 && P.pos.y - b.pos.y < 1.5) hurtPlayer(18, b, 12);
          }
          break;
        case "slam":
          if (b.t <= 0) {
            b.st = "walk";
            b.cd = 1.8;
          }
          break;
        case "tired":
        case "stun":
          if (b.t <= 0) {
            b.st = "walk";
            b.cd = 1.2;
          }
          break;
      }
      b.pos.y = 0;
    }
    const t = b.pt;
    zeroPose(t);
    if (b.dead) {
      t.sLz = 1.3;
      t.sRz = -1.3;
    } else switch (b.st) {
      case "walk":
        b.ph += dt * 6;
        runPose(t, b.ph, 0.7, false);
        t.sLz = 0.5;
        t.sRz = -0.5;
        break;
      case "chargeW":
        t.by = -0.3;
        t.bp = 0.7;
        t.hLx = -0.9;
        t.kL = 1.3;
        t.hRx = 0.4;
        t.kR = 0.5;
        t.sLx = 0.8;
        t.sRx = 0.8;
        t.hx = -0.5;
        break;
      case "charge":
        b.ph += dt * 16;
        runPose(t, b.ph, 1, true);
        t.bp = 0.8;
        t.hx = -0.6;
        break;
      case "slamW":
        t.sLx = -2.9;
        t.sRx = -2.9;
        t.eL = -0.3;
        t.eR = -0.3;
        t.bp = -0.25;
        break;
      case "slam":
        t.sLx = -1.1;
        t.sRx = -1.1;
        t.bp = 0.7;
        t.by = -0.35;
        t.kL = 1;
        t.kR = 1;
        t.hLx = -0.7;
        t.hRx = -0.7;
        break;
      case "tired":
        t.bp = 0.75;
        t.by = -0.2;
        t.sLx = -0.9;
        t.sRx = -0.9;
        t.eL = -0.2;
        t.eR = -0.2;
        t.kL = 0.6;
        t.kR = 0.6;
        t.hLx = -0.4;
        t.hRx = -0.4;
        t.hx = 0.2 + Math.sin(G.time * 8) * 0.08;
        break;
      case "stun":
        t.bp = 0.2;
        t.spy = Math.sin(G.time * 3) * 0.4;
        t.hx = 0.4;
        t.sLz = 0.3;
        t.sRz = -0.3;
        break;
    }
    blendPose(b.pc, t, damp(b.st === "slam" ? 25 : 10, dt));
    applyPose(H, b.pc);
    H.root.position.copy(b.pos);
    H.root.position.y += 0.2 * b.down;
    H.root.rotation.set(-Math.PI / 2 * b.down, b.yaw, 0, "YXZ");
  }
  function buildRaces() {
    for (const R2 of RACES) {
      R2.pts = [];
      for (let k = 0; k < R2.route.length - 1; k++) {
        const [i0, j0, h0] = R2.route[k], [i1, j1, h1] = R2.route[k + 1];
        const [x0, z0] = isecPos(i0, j0), [x1, z1] = isecPos(i1, j1);
        const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 45));
        for (let s = 0; s < n; s++) {
          const f = s / n;
          R2.pts.push(new V3(x0 + (x1 - x0) * f, h0 + (h1 - h0) * f, z0 + (z1 - z0) * f));
        }
      }
      const [xe, ze] = isecPos(R2.route[R2.route.length - 1][0], R2.route[R2.route.length - 1][1]);
      R2.pts.push(new V3(xe, R2.route[R2.route.length - 1][2], ze));
      let len = 0;
      for (let k = 1; k < R2.pts.length; k++) len += R2.pts[k].distanceTo(R2.pts[k - 1]);
      R2.par = len / 30;
      R2.rings = R2.pts.map((p, k) => {
        const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: k === 0 ? 16763196 : 4187135, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        m.position.copy(p);
        const nx = R2.pts[Math.min(k + 1, R2.pts.length - 1)], pv = R2.pts[Math.max(k - 1, 0)];
        m.lookAt(_t.copy(p).add(nx).sub(pv).normalize().add(p));
        m.visible = k === 0;
        scene.add(m);
        return m;
      });
      R2.start = R2.pts[0];
    }
  }
  function updateRaces(dt) {
    const t = G.time;
    if (!race) {
      for (const R3 of RACES) {
        const r02 = R3.rings[0];
        r02.visible = !G.boss && !G.chase;
        r02.rotation.z = t;
        r02.material.color.setHex(16763196);
        if (r02.visible && P.pos.distanceTo(R3.start) < 5.5) {
          race = { R: R3, idx: 1, t: 0 };
          sfx("ring");
          R3.rings.forEach((m, k) => {
            m.visible = k >= 1 && k <= 3;
            m.material.color.setHex(4187135);
          });
          for (const O of RACES) if (O !== R3) O.rings[0].visible = false;
          const best = save.races[R3.id];
          showMsg("WYZWANIE: " + R3.name, `Przele\u0107 przez wszystkie pier\u015Bcienie! Z\u0142oto: ${fmtTime(R3.par)}${best ? " \xB7 Tw\xF3j rekord: " + fmtTime(best) : ""}`, 3.5);
          break;
        }
      }
      G.race = null;
      return;
    }
    const R2 = race.R;
    race.t += dt;
    G.race = { name: R2.name, t: race.t, idx: race.idx, n: R2.pts.length - 1, par: R2.par };
    const next = R2.pts[race.idx];
    R2.rings.forEach((m, k) => {
      m.visible = k >= race.idx && k <= race.idx + 3;
      m.material.opacity = k === race.idx ? 0.95 : 0.35;
      m.scale.setScalar(k === race.idx ? 1 + Math.sin(t * 8) * 0.05 : 1);
    });
    if (_t.set(P.pos.x, P.pos.y + 1, P.pos.z).distanceTo(next) < 5.5) {
      race.idx++;
      sfx("ring");
      addXP(5);
      if (race.idx >= R2.pts.length) {
        finishRace();
        return;
      }
    }
    if (race.t > R2.par * 3 || P.pos.distanceTo(next) > 260 || P.dead) {
      showMsg("WYZWANIE PRZERWANE", "Spr\xF3buj jeszcze raz \u2014 wr\xF3\u0107 do \u017C\xF3\u0142tego pier\u015Bcienia", 3);
      endRace();
    }
  }
  function finishRace() {
    const R2 = race.R, s = race.t, best = save.races[R2.id];
    const medal = s <= R2.par ? "Z\u0141OTO" : s <= R2.par * 1.3 ? "SREBRO" : "BR\u0104Z";
    const xp = medal === "Z\u0141OTO" ? 400 : medal === "SREBRO" ? 250 : 120;
    if (!best || s < best) save.races[R2.id] = s;
    doSave();
    addXP(xp);
    sfx("win");
    showMsg(`${medal}! ${fmtTime(s)}`, `${R2.name} \xB7 +${xp} PD${!best || s < best ? " \xB7 NOWY REKORD!" : ""}`, 4);
    endRace();
  }
  function endRace() {
    race.R.rings.forEach((m, k) => {
      m.visible = k === 0;
      m.scale.setScalar(1);
      m.material.opacity = 0.85;
    });
    race = null;
    G.race = null;
  }
  function carMesh(body, stripe) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4.6), new THREE.MeshStandardMaterial({ color: body, metalness: 0.5, roughness: 0.3 }));
    b.position.y = 0.75;
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.6, 2.3), new THREE.MeshStandardMaterial({ color: 1119772, metalness: 0.6, roughness: 0.15 }));
    c.position.set(0, 1.45, -0.2);
    const s = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.12, 4.62), new THREE.MeshStandardMaterial({ color: stripe }));
    s.position.y = 0.95;
    g.add(b, c, s);
    const wm = new THREE.MeshStandardMaterial({ color: 1118481, roughness: 0.9 });
    for (const [x, z] of [[1, 1.5], [-1, 1.5], [1, -1.5], [-1, -1.5]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), wm);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, 0.38, z);
      g.add(w);
    }
    const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 16773840, blending: THREE.AdditiveBlending, depthWrite: false }));
    hl.position.set(0, 0.8, 2.4);
    hl.scale.set(3, 1.5, 1);
    g.add(hl);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    scene.add(g);
    return g;
  }
  function pickNext(c) {
    const opts = [];
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i2 = c.i + di, j2 = c.j + dj;
      if (i2 < 0 || i2 > NX || j2 < 0 || j2 > NZ) continue;
      if (i2 === c.pi && j2 === c.pj) continue;
      const [x0, z0] = isecPos(c.i, c.j), [x1, z1] = isecPos(i2, j2);
      if (inPark((x0 + x1) / 2, (z0 + z1) / 2)) continue;
      opts.push([i2, j2]);
    }
    if (!opts.length) opts.push([c.pi, c.pj]);
    const [i, j] = opts[Math.floor(Math.random() * opts.length)];
    c.pi = c.i;
    c.pj = c.j;
    c.i = i;
    c.j = j;
  }
  function startChase() {
    let i, j, tries = 0;
    do {
      i = Math.floor(Math.random() * (NX + 1));
      j = Math.floor(Math.random() * (NZ + 1));
      const [x2, z2] = isecPos(i, j);
      const d = Math.hypot(x2 - P.pos.x, z2 - P.pos.z);
      if (d > 120 && d < 320 && !inPark(x2, z2)) break;
    } while (++tries < 60);
    const [x, z] = isecPos(i, j);
    chase = { i, j, pi: -1, pj: -1, pos: new V3(x, 0, z), vel: new V3(), yaw: 0, hp: 6, t: 0, done: false, doneT: 0, mesh: carMesh(7998738, 1118481), trail: [] };
    pickNext(chase);
    police = { mesh: carMesh(1780309, 15921906), red: null, blue: null };
    const mk = (c) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: c, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.set(2.2, 2.2, 1);
      police.mesh.add(s);
      return s;
    };
    police.red = mk(16719904);
    police.red.position.set(0.5, 2, -0.2);
    police.blue = mk(2121983);
    police.blue.position.set(-0.5, 2, -0.2);
    showMsg("PO\u015ACIG!", "Z\u0142odzieje uciekaj\u0105 autem. Wskocz na dach i bij, \u017Ceby je zatrzyma\u0107!", 4);
    sfx("alarm");
  }
  function carPunch() {
    const c = chase;
    if (!c || c.done) return;
    c.hp--;
    burst(c.pos.x, 1.8, c.pos.z, 12, 16773824, 4);
    sfx("punch");
    G.shake = Math.max(G.shake, 0.2);
    rumble(0.08, 0.4, 0.4);
    popText(`AUTO ${Math.max(0, c.hp)}/6`);
    if (c.hp <= 0) {
      c.done = true;
      c.vel.set(0, 0, 0);
      sfx("crash");
      G.shake = 0.6;
      burst(c.pos.x, 1, c.pos.z, 40, 5592405, 6);
      const side = new V3(Math.cos(c.yaw), 0, -Math.sin(c.yaw));
      spawnStreetThugs(c.pos.x + side.x * 3, c.pos.z + side.z * 3, 2 + (save.lvl > 3 ? 1 : 0));
      save.chases++;
      addXP(400);
      doSave();
      showMsg("AUTO ZATRZYMANE!", "+400 PD \xB7 Teraz pokonaj z\u0142odziei!", 3.5);
      P.state = "air";
      P.airT = 0.2;
      P.vel.set(-side.x * 4, 10, -side.z * 4);
      P.car = null;
      P.flipT = 0;
      P.flipDur = 0.6;
      P.flipBack = true;
    }
  }
  function carLeave() {
    hint("car", "Wskocz znowu na dach auta, \u017Ceby dalej je bi\u0107.");
  }
  function updateChase(dt) {
    if (!chase) {
      chaseWait -= dt;
      if (chaseWait <= 0 && !G.boss && !G.race && G.state === "play") {
        startChase();
        chaseWait = rnd(70, 110);
      }
      G.chase = null;
      return;
    }
    const c = chase;
    c.t += dt;
    if (!c.done) {
      const [tx, tz] = isecPos(c.i, c.j);
      const dx = tx - c.pos.x, dz = tz - c.pos.z, d = Math.hypot(dx, dz);
      if (d < 1) {
        c.pos.x = tx;
        c.pos.z = tz;
        pickNext(c);
      } else {
        const sp = 20, ux = dx / d, uz = dz / d;
        c.vel.set(ux * sp, 0, uz * sp);
        c.pos.x += ux * Math.min(sp * dt, d);
        c.pos.z += uz * Math.min(sp * dt, d);
        c.yaw = angLerp(c.yaw, Math.atan2(ux, uz), damp(8, dt));
      }
      c.trail.push([c.pos.x, c.pos.z, c.yaw]);
      if (c.trail.length > 60) c.trail.shift();
      const ox = Math.cos(c.yaw) * -3.2, oz = -Math.sin(c.yaw) * -3.2;
      c.mesh.position.set(c.pos.x + ox, 0, c.pos.z + oz);
      c.mesh.rotation.y = c.yaw;
      if (P.state !== "car" && !P.dead && P.state !== "pz" && !P.fin) {
        const px = P.pos.x - c.mesh.position.x, pz = P.pos.z - c.mesh.position.z, py = P.pos.y;
        if (Math.hypot(px, pz) < 3.2 && py > 0.5 && py < 5.5) {
          P.state = "car";
          P.car = c;
          P.atk = null;
          P.lunge = null;
          P.flipT = -1;
          P.pc.bp = 0;
          sfx("land", 0.5);
          hint("car", "Jeste\u015B na dachu! Bij, \u017Ceby zatrzyma\u0107 auto (skok = zeskocz).");
        }
      }
      if (c.t > 80) {
        showMsg("Z\u0141ODZIEJE UCIEKLI...", "Nast\u0119pnym razem szybciej!", 3);
        endChase();
        return;
      }
    } else {
      c.doneT += dt;
      if (Math.random() < 0.3) burst(c.mesh.position.x, 1.8, c.mesh.position.z, 1, 3355443, 1.5);
      if (c.doneT > 20) {
        endChase();
        return;
      }
    }
    if (police) {
      const tr = c.trail[0] || [c.pos.x, c.pos.z, c.yaw];
      const ox = Math.cos(tr[2]) * -3.2, oz = -Math.sin(tr[2]) * -3.2;
      police.mesh.position.set(tr[0] + ox, 0, tr[1] + oz);
      police.mesh.rotation.y = tr[2];
      const on = Math.floor(G.time * 6) % 2 === 0;
      police.red.visible = on;
      police.blue.visible = !on;
    }
    G.chase = c.done ? null : { pos: c.mesh.position, hp: c.hp, t: c.t };
  }
  function endChase() {
    if (P.car === chase) {
      P.state = "air";
      P.car = null;
    }
    scene.remove(chase.mesh);
    if (police) scene.remove(police.mesh);
    chase = null;
    police = null;
    G.chase = null;
  }
  function initMissions() {
    buildRaces();
  }
  function updateMissions(dt) {
    updateBoss(dt);
    updateRaces(dt);
    updateChase(dt);
    updateFisk(dt);
    let m = "calm";
    if (G.boss) m = "boss";
    else if (G.chase || G.race || enemies.some((e) => !e.dead && e.crime && e.crime.alert && e.pos.distanceTo(P.pos) < 70)) m = "fight";
    setMusicMode(m);
  }
  function missionList() {
    const L = [];
    L.push({
      id: "boss",
      icon: "boss",
      name: "NOSORO\u017BEC",
      x: ARENA.x,
      z: ARENA.z,
      desc: "Opancerzony osi\u0142ek szaleje w Central Parku. Unikaj szar\u017Cy i bij, gdy si\u0119 zm\u0119czy.",
      status: boss && !boss.dead ? "WALKA TRWA!" : bossWait > 0 ? `Wraca za ${Math.ceil(bossWait)} s` : save.bossWins ? `Pokonany ${save.bossWins}\xD7 \xB7 dost\u0119pny rewan\u017C` : "Dost\u0119pny \u2014 id\u017A na polan\u0119 w parku"
    });
    for (const R2 of RACES) {
      const b = save.races[R2.id];
      L.push({
        id: "race-" + R2.id,
        icon: "race",
        name: "WYZWANIE: " + R2.name,
        x: R2.start.x,
        z: R2.start.z,
        desc: `Przele\u0107 przez ${R2.pts.length - 1} pier\u015Bcieni jak najszybciej. Z\u0142oto poni\u017Cej ${fmtTime(R2.par)}.`,
        status: b ? `Rekord ${fmtTime(b)} \xB7 ${b <= R2.par ? "Z\u0141OTO" : b <= R2.par * 1.3 ? "SREBRO" : "BR\u0104Z"}` : "Jeszcze nieuko\u0144czone"
      });
    }
    if (FISK_DOOR) L.push({
      id: "fisk",
      icon: "fisk",
      name: "KINGPIN",
      x: FISK_DOOR.x + FISK_DOOR.nx * 2,
      z: FISK_DOOR.z + FISK_DOOR.nz * 2,
      desc: "Wilson Fisk rz\u0105dzi p\xF3\u0142\u015Bwiatkiem z wie\u017Cowca Fisk Tower w Midtown. Wejd\u017A drzwiami od po\u0142udnia, pokonaj jego stra\u017C, a potem samego Kingpina \u2014 blokuje ciosy z przodu, wi\u0119c zachod\u017A go od ty\u0142u.",
      status: save.fisk ? `Pokonany ${save.fisk}\xD7 \xB7 mo\u017Cesz wr\xF3ci\u0107 na rewan\u017C` : "Dost\u0119pna \u2014 wejd\u017A do Fisk Tower (drzwi od po\u0142udnia)"
    });
    L.push({
      id: "chase",
      icon: "chase",
      name: "PO\u015ACIGI",
      x: chase ? chase.mesh.position.x : null,
      z: chase ? chase.mesh.position.z : null,
      desc: "Co jaki\u015B czas z\u0142odzieje uciekaj\u0105 autem. Wskocz na dach i zatrzymaj ich.",
      status: chase && !chase.done ? "PO\u015ACIG TRWA!" : `Zatrzymane auta: ${save.chases}`
    });
    return L;
  }
  var _t, fmtTime, boss, bossWait, vulnerable2, RACES, ringGeo, race, chase, chaseWait, police;
  var init_misje = __esm({
    "js/misje.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_postac();
      init_gracz();
      init_wrogowie();
      init_dzwiek();
      init_wejscie();
      init_ui();
      init_scenki();
      init_fisk();
      init_miasto();
      _t = new V3();
      fmtTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
      boss = null;
      bossWait = 0;
      vulnerable2 = (b) => b.st === "tired" || b.st === "stun";
      RACES = [
        { id: "mid", name: "MIDTOWN", route: [[3, 12, 28], [3, 9, 35], [6, 9, 40], [6, 11, 30], [8, 11, 25], [8, 14, 30], [4, 14, 35], [4, 12, 25]] },
        { id: "park", name: "WOK\xD3\u0141 PARKU", route: [[1, 1, 20], [7, 1, 25], [7, 3, 30], [6, 3, 25], [6, 8, 30], [2, 8, 35], [2, 1, 30], [1, 1, 22]] },
        { id: "fin", name: "DOLNY MANHATTAN", route: [[1, 15, 30], [1, 17, 40], [5, 17, 35], [5, 15, 45], [7, 15, 30], [7, 18, 25], [3, 18, 30], [3, 16, 40]] }
      ];
      ringGeo = new THREE.TorusGeometry(4.5, 0.32, 8, 40);
      race = null;
      chase = null;
      chaseWait = 45;
      police = null;
    }
  });

  // js/umiejetnosci.js
  function canBuy(s) {
    return !has(s.id) && skillPoints() > 0 && (!s.req || has(s.req));
  }
  function buy(s) {
    if (!canBuy(s)) return false;
    save.skills.push(s.id);
    doSave();
    return true;
  }
  var SKILLS, COLS, has, skillPoints, maxHp, dmgMul, swingMul, zipMax, websToWrap, perchRange;
  var init_umiejetnosci = __esm({
    "js/umiejetnosci.js"() {
      init_util();
      SKILLS = [
        { id: "hp1", col: 0, name: "TWARDZIEL I", desc: "+25 zdrowia." },
        { id: "hp2", col: 0, name: "TWARDZIEL II", desc: "+25 zdrowia.", req: "hp1" },
        { id: "regen", col: 0, name: "REGENERACJA", desc: "Zdrowie wraca dwa razy szybciej.", req: "hp2" },
        { id: "hp3", col: 0, name: "TWARDZIEL III", desc: "+25 zdrowia.", req: "regen" },
        { id: "pow", col: 1, name: "MOCNE CIOSY", desc: "Ciosy zadaj\u0105 o po\u0142ow\u0119 wi\u0119cej obra\u017Ce\u0144." },
        { id: "focus", col: 1, name: "SKUPIENIE", desc: "Pasek skupienia \u0142aduje si\u0119 o po\u0142ow\u0119 szybciej.", req: "pow" },
        { id: "fin", col: 1, name: "PODW\xD3JNE WYKO\u0143CZENIE", desc: "Wyko\u0144czenie zawija w sie\u0107 tak\u017Ce najbli\u017Cszego bandyt\u0119 obok.", req: "focus" },
        { id: "pow2", col: 1, name: "PI\u0118\u015A\u0106 TYTANA", desc: "Jeszcze +50% obra\u017Ce\u0144. Osi\u0142ki szybciej padaj\u0105.", req: "fin" },
        { id: "web", col: 2, name: "MOCNA SIE\u0106", desc: "Bandyt\u0119 zawiniesz w kokon ju\u017C dwoma strza\u0142ami." },
        { id: "sense", col: 2, name: "PAJ\u0118CZY ZMYS\u0141", desc: "Idealny unik spowalnia czas dwa razy d\u0142u\u017Cej.", req: "web" },
        { id: "launch", col: 2, name: "DALEKI ZACZEP", desc: "Zaczep dzia\u0142a z 90 m zamiast 60 m.", req: "sense" },
        { id: "swing", col: 3, name: "SZYBKIE BUJANIE", desc: "Bujasz si\u0119 o 15% szybciej." },
        { id: "zip", col: 3, name: "TRZECI ZIP", desc: "Trzy zipy sieci\u0105 w powietrzu zamiast dw\xF3ch.", req: "swing" },
        { id: "swing2", col: 3, name: "MISTRZ SIECI", desc: "Jeszcze +15% pr\u0119dko\u015Bci i wy\u017Cszy skok z sieci.", req: "zip" }
      ];
      COLS = ["ZDROWIE", "WALKA", "SIE\u0106 I ZMYS\u0141", "RUCH"];
      has = (id) => save.skills.includes(id);
      skillPoints = () => Math.max(0, save.lvl - save.skills.length);
      maxHp = () => 100 + (has("hp1") ? 25 : 0) + (has("hp2") ? 25 : 0) + (has("hp3") ? 25 : 0);
      dmgMul = () => 1 + (has("pow") ? 0.5 : 0) + (has("pow2") ? 0.5 : 0);
      swingMul = () => 1 + (has("swing") ? 0.15 : 0) + (has("swing2") ? 0.15 : 0);
      zipMax = () => has("zip") ? 3 : 2;
      websToWrap = () => has("web") ? 2 : 3;
      perchRange = () => has("launch") ? 90 : 60;
    }
  });

  // js/wrogowie.js
  var wrogowie_exports = {};
  __export(wrogowie_exports, {
    BAGS_N: () => BAGS_N,
    addXP: () => addXP,
    bags: () => bags,
    burst: () => burst,
    finishEnemy: () => finishEnemy,
    hitEnemy: () => hitEnemy,
    initBags: () => initBags,
    initFX: () => initFX,
    makeCrime: () => makeCrime,
    makeEnemy: () => makeEnemy,
    need: () => need,
    removeEnemy: () => removeEnemy,
    shootWeb: () => shootWeb,
    spawnCrime: () => spawnCrime,
    spawnStreetThugs: () => spawnStreetThugs,
    tracer: () => tracer,
    updateBags: () => updateBags,
    updateCrimes: () => updateCrimes,
    updateEnemies: () => updateEnemies,
    updateFX: () => updateFX,
    updateShots: () => updateShots,
    webTarget: () => webTarget
  });
  function addXP(n) {
    save.xp += n;
    let up = false;
    while (save.xp >= need(save.lvl)) {
      save.xp -= need(save.lvl);
      save.lvl++;
      up = true;
    }
    if (up) {
      sfx("level");
      const nu = SUITS.filter((s) => s.lvl === save.lvl).map((s) => s.name);
      showMsg("AWANS! POZIOM " + save.lvl, (nu.length ? "Nowy str\xF3j: " + nu.join(", ") + " \xB7 " : "") + `Punkty umiej\u0119tno\u015Bci: ${skillPoints()} (Pauza \u2192 Umiej\u0119tno\u015Bci)`, 4);
      doSave();
    }
    saveT = 3;
  }
  function initFX() {
    pPos = new Float32Array(PMAX * 3);
    pCol = new Float32Array(PMAX * 3);
    pVel = new Float32Array(PMAX * 3);
    pLife = new Float32Array(PMAX);
    for (let i = 0; i < PMAX; i++) pPos[i * 3 + 1] = -9999;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
    pts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.25, vertexColors: true, transparent: true, depthWrite: false }));
    pts.frustumCulled = false;
    scene.add(pts);
    const c = cv(128, 128), x = c.getContext("2d");
    x.strokeStyle = "rgba(245,245,245,.95)";
    x.lineWidth = 3;
    x.translate(64, 64);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a) * 60, Math.sin(a) * 60);
      x.stroke();
    }
    for (const r of [14, 28, 44]) {
      x.beginPath();
      x.arc(0, 0, r, 0, 7);
      x.stroke();
    }
    splatMat = new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    shotGeo = new THREE.SphereGeometry(0.13, 8, 6);
    shotMat = new THREE.MeshBasicMaterial({ color: 16777215 });
    glowTex = glowTexture("rgba(255,230,120,1)", "rgba(255,200,60,0)");
  }
  function burst(x, y, z, n, col, spd = 5) {
    const c = new THREE.Color(col);
    for (let i = 0; i < n; i++) {
      const k = pIdx++ % PMAX;
      pPos[k * 3] = x;
      pPos[k * 3 + 1] = y;
      pPos[k * 3 + 2] = z;
      pVel[k * 3] = rnd(-1, 1) * spd;
      pVel[k * 3 + 1] = rnd(0, 1.5) * spd;
      pVel[k * 3 + 2] = rnd(-1, 1) * spd;
      pLife[k] = rnd(0.3, 0.7);
      pCol[k * 3] = c.r;
      pCol[k * 3 + 1] = c.g;
      pCol[k * 3 + 2] = c.b;
    }
  }
  function tracer(a, b) {
    let t = tracers.find((q) => q.life <= 0);
    if (!t) {
      t = { m: mkLine(trMat), life: 0 };
      tracers.push(t);
    }
    setLine(t.m, a, b);
    t.life = 0.07;
  }
  function splat(p, n) {
    let s;
    if (splats.length < 30) {
      s = new THREE.Mesh(new THREE.CircleGeometry(0.8, 14), splatMat);
      scene.add(s);
      splats.push(s);
    } else {
      s = splats.shift();
      splats.push(s);
    }
    s.position.copy(p).addScaledVector(n, 0.03);
    s.lookAt(_a2.copy(p).add(n));
    s.rotation.z = Math.random() * 6;
  }
  function updateFX(dt) {
    for (let k = 0; k < PMAX; k++) {
      if (pLife[k] <= 0) continue;
      pLife[k] -= dt;
      if (pLife[k] <= 0) {
        pPos[k * 3 + 1] = -9999;
        continue;
      }
      pVel[k * 3 + 1] -= 12 * dt;
      pPos[k * 3] += pVel[k * 3] * dt;
      pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt;
      pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt;
    }
    pts.geometry.attributes.position.needsUpdate = true;
    pts.geometry.attributes.color.needsUpdate = true;
    for (const t of tracers) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.m.visible = false;
      }
    }
    if (saveT > 0) {
      saveT -= dt;
      if (saveT <= 0) doSave();
    }
  }
  function webTarget() {
    camera.getWorldDirection(_cf);
    let best = null, bs = -1e9;
    for (const e of enemies) {
      if (e.dead || e.gone) continue;
      _t2.set(e.pos.x, e.pos.y + 1.1 * (e.scale || 1), e.pos.z).sub(camera.position);
      const d = _t2.length();
      if (d > 60) continue;
      const dot = _t2.dot(_cf) / d;
      if (dot < 0.86) continue;
      const sc = dot * 2 - d / 60;
      if (sc > bs) {
        bs = sc;
        best = e;
      }
    }
    return best;
  }
  function shootWeb() {
    const best = webTarget();
    P.H.handR.getWorldPosition(_h);
    const pt = new V3();
    let n = null;
    if (best) pt.set(best.pos.x, best.pos.y + 1.1 * (best.scale || 1), best.pos.z);
    else {
      camera.getWorldDirection(_cf);
      const t = raycastCity(camera.position, _cf, 110);
      pt.copy(camera.position).addScaledVector(_cf, t);
      if (t < 110) n = rayN.clone();
    }
    const m = new THREE.Mesh(shotGeo, shotMat);
    m.position.copy(_h);
    scene.add(m);
    shots.push({ m, tr: mkLine(), pos: _h.clone(), target: best, pt, n, life: 2 });
    P.webT = 0.28;
    P.webAim.copy(pt);
    if (P.state === "ground" && !P.atk) P.heading = Math.atan2(pt.x - P.pos.x, pt.z - P.pos.z);
    sfx("thwip");
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.life -= dt;
      if (s.target && !s.target.gone) s.pt.set(s.target.pos.x, s.target.pos.y + (1.1 - s.target.down * 0.8) * (s.target.scale || 1), s.target.pos.z);
      _t2.subVectors(s.pt, s.pos);
      const d = _t2.length(), st = 85 * dt;
      let done = false;
      if (d <= st + 0.2) {
        s.pos.copy(s.pt);
        done = true;
        if (s.target) webHit(s.target);
        else if (s.n) {
          splat(s.pt, s.n);
          sfx("splat", 0.4);
        }
      } else s.pos.addScaledVector(_t2, st / d);
      s.m.position.copy(s.pos);
      if (d > 0.01) {
        _a2.copy(s.pos).addScaledVector(_t2, -Math.min(3, d) / d);
        setLine(s.tr, _a2, s.pos);
      }
      if (done || s.life <= 0) {
        scene.remove(s.m);
        scene.remove(s.tr);
        shots.splice(i, 1);
      }
    }
  }
  function webHit(e) {
    if (e.gone) return;
    burst(e.pos.x, e.pos.y + 1.1, e.pos.z, 12, 16777215, 3);
    sfx("splat");
    addXP(5);
    if (e.type === "boss") {
      (e.webFn || bossWeb)(e);
      return;
    }
    e.webs++;
    e.webT = 6;
    if (e.type === "brute") {
      e.stunT = 2.5;
      if (!e.dead) {
        e.state = "hurt";
        e.t = 0.4;
      }
      if (e.webs >= websToWrap() + 2 && !e.dead) {
        e.webbed = true;
        killEnemy(e);
        e.state = "down";
      } else popText("OSI\u0141EK OG\u0141USZONY!");
      return;
    }
    if (e.webs >= websToWrap() && !e.dead) {
      e.webbed = true;
      killEnemy(e);
      if (!e.air) e.state = "down";
    } else if (!e.dead && !e.air) {
      e.state = "hurt";
      e.t = 0.3;
    }
    if (e.air) e.airHold = 0.5;
  }
  function finishEnemy(e) {
    if (e.dead || e.gone) return;
    burst(e.pos.x, e.pos.y + 1, e.pos.z, 30, 16777215, 6);
    if (e.type === "boss") {
      (e.finFn || bossFinish)(e);
      return;
    }
    e.webs = 9;
    e.webbed = true;
    killEnemy(e);
    e.air = false;
    e.state = "down";
    e.pos.y = supportAt(e.pos.x, e.pos.z, e.pos.y + 0.5, 0.1);
    addXP(20);
    popText("WYKO\u0143CZENIE!");
  }
  function makeGun() {
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 1381912, metalness: 0.7, roughness: 0.35 });
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.17, 0.042), m);
    slide.position.set(0, -0.08, 0.035);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.045, 0.085), m);
    grip.position.set(0, 0, 0);
    grip.rotation.x = 0.25;
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.018, 4e-3, 6, 12, Math.PI), m);
    guard.rotation.y = Math.PI / 2;
    guard.position.set(0, -0.035, 0.012);
    g.add(slide, grip, guard);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    g.position.set(0, -0.32, 0.01);
    return g;
  }
  function makeBat() {
    const pts2 = [[0.012, 0], [0.016, 0.02], [0.014, 0.05], [0.017, 0.3], [0.03, 0.55], [0.036, 0.72], [0.034, 0.78], [0, 0.79]].map(([r, y]) => new THREE.Vector2(r, y));
    const bat = new THREE.Mesh(new THREE.LatheGeometry(pts2, 14), new THREE.MeshStandardMaterial({ color: pick2([9068601, 10132899, 5978658]), roughness: 0.5, metalness: 0.1 }));
    bat.rotation.x = Math.PI;
    bat.position.set(0, -0.26, 0);
    bat.castShadow = true;
    return bat;
  }
  function makeEnemy(type) {
    const brute = type === "brute";
    const H = buildThug(brute ? "brute" : "thug");
    let wpn = null;
    if (brute) H.root.scale.setScalar(1.12);
    else {
      wpn = type === "gun" ? makeGun() : makeBat();
      H.elR.add(wpn);
      H.setHands("open", "fist");
    }
    const cocoon = el(webMaterial(), 0.34, 0.98, 0.32, 0, 0.9, 0);
    cocoon.visible = false;
    H.root.add(cocoon);
    const blob = el(webMaterial(), 0.14, 0.12, 0.08, 0, 0.12, 0.12);
    blob.visible = false;
    H.chest.add(blob);
    scene.add(H.root);
    return {
      H,
      type,
      wpn,
      cocoon,
      blob,
      pos: new V3(),
      vel: new V3(),
      yaw: rnd(0, 6.28),
      hp: brute ? 10 : type === "gun" ? 3 : 4,
      state: "idle",
      t: rnd(1, 4),
      cd: rnd(0.5, 2),
      webs: 0,
      webT: 0,
      dead: false,
      air: false,
      down: 0,
      webbed: false,
      pc: newPose(),
      pt: newPose(),
      ph: rnd(0, 6),
      moving: false,
      groundY: 0,
      crime: null,
      gone: false,
      spin: 0,
      hurtT: 0,
      scale: brute ? 1.25 : 1,
      stunT: 0,
      airHold: 0
    };
  }
  function makeCrime(x0, x1, z0, z1, y, spot, n, bruteOK) {
    const cr2 = { spot, list: [], active: true, alert: false, clearT: 0, x: (x0 + x1) / 2, y, z: (z0 + z1) / 2 };
    let brutes = 0;
    for (let k = 0; k < n; k++) {
      let type = Math.random() < 0.4 ? "gun" : "melee";
      if (bruteOK && brutes === 0 && Math.random() < 0.45) {
        type = "brute";
        brutes++;
      }
      const e = makeEnemy(type);
      e.pos.set(rnd(x0, x1), y, rnd(z0, z1));
      e.groundY = y;
      e.crime = cr2;
      cr2.list.push(e);
      enemies.push(e);
    }
    crimes.push(cr2);
    return cr2;
  }
  function spawnCrime(first) {
    const cand = spots.filter((s2) => !s2.busy && Math.hypot(s2.cx - P.pos.x, s2.cz - P.pos.z) > (first ? 80 : 150));
    if (!cand.length) return;
    const s = cand[Math.floor(Math.random() * cand.length)];
    s.busy = true;
    const n = 3 + Math.floor(Math.random() * 3) + Math.min(2, Math.floor(save.lvl / 4));
    makeCrime(s.x0 + 2, s.x1 - 2, s.z0 + 2, s.z1 - 2, s.y1, s, n, save.lvl >= 2);
  }
  function spawnStreetThugs(x, z, n) {
    const cr2 = makeCrime(x - 2, x + 2, z - 2, z + 2, 0, null, n, false);
    cr2.alert = true;
    for (const e of cr2.list) e.state = "fight";
    return cr2;
  }
  function hitEnemy(e, dmg, kx, ky, kz, launch, fromAir) {
    if (e.dead || e.gone) return false;
    if (e.type === "boss") return (e.hit || bossHit)(e, dmg * dmgMul(), launch);
    if (e.type === "brute" && e.stunT <= 0 && !fromAir && e.state !== "hurt") {
      burst(e.pos.x, e.pos.y + 1.6, e.pos.z, 8, 10475775, 3);
      sfx("block");
      rumble(0.06, 0.2, 0.2);
      popText("BLOK!");
      hint("brute", "Osi\u0142ek blokuje ciosy. Trafiaj go sieci\u0105 albo atakuj z powietrza!");
      e.cd = Math.min(e.cd, 0.3);
      return "block";
    }
    e.hp -= dmg * dmgMul();
    e.hurtT = 0.35;
    burst(e.pos.x, e.pos.y + 1.2 * e.scale, e.pos.z, 10, 16773824, 4);
    sfx("punch");
    rumble(0.08, 0.35, 0.5);
    G.shake = Math.max(G.shake, launch ? 0.3 : 0.12);
    addXP(5);
    const heavy = e.type === "brute";
    if (e.air) {
      e.vel.set(kx * 0.3, 3, kz * 0.3);
      e.airHold = 0.9;
      e.state = "air";
    } else if (launch === "up" && !heavy) {
      e.air = true;
      e.vel.set(0, 14, 0);
      e.airHold = 1.6;
      e.state = "air";
      e.spin = rnd(-3, 3);
      popText("WYBICIE!");
    } else if ((e.hp <= 0 || launch) && !(heavy && e.hp > 0)) {
      e.air = true;
      e.vel.set(kx * (heavy ? 0.5 : 1), ky, kz * (heavy ? 0.5 : 1));
      e.state = "air";
      e.spin = rnd(-6, 6);
    } else {
      e.state = "hurt";
      e.t = 0.4;
      e.vel.set(kx, 0, kz);
    }
    if (e.hp <= 0) killEnemy(e);
    return true;
  }
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true;
    addXP(e.type === "brute" ? 60 : 25);
  }
  function moveEnemy(e, vx, vz, dt) {
    const nx = e.pos.x + vx * dt, nz2 = e.pos.z + vz * dt;
    const g = supportAt(nx, nz2, e.pos.y + 0.5, 0.1);
    if (Math.abs(g - e.groundY) < 0.3 && !solidAt(nx, e.pos.y + 1, nz2)) {
      e.pos.x = nx;
      e.pos.z = nz2;
    }
  }
  function fireAt(e, d) {
    e.wpn.getWorldPosition(_h);
    _t2.set(P.pos.x, P.pos.y + 1.2, P.pos.z);
    let ch = 0.75 - P.vel.length() / 55 - d / 140;
    if (P.state === "swing") ch -= 0.15;
    ch = clamp(ch, 0.08, 0.75);
    const hit = Math.random() < ch && P.invT <= 0 && P.dodgeT <= 0;
    if (!hit) {
      _t2.x += rnd(-2.5, 2.5);
      _t2.y += rnd(-1, 2.5);
      _t2.z += rnd(-2.5, 2.5);
      _t2.sub(_h).multiplyScalar(1.6).add(_h);
    }
    tracer(_h, _t2);
    burst(_h.x, _h.y, _h.z, 4, 16765040, 2);
    sfx("shot", clamp(1.2 - d / 80, 0.15, 1));
    if (e.pos.y < 3) scarePeds(e.pos.x, e.pos.z);
    if (hit) hurtPlayer(7, e);
  }
  function updateEnemies(dt) {
    G.sense = false;
    for (const e of enemies) if (e.type !== "boss") updateEnemy(e, dt);
    for (let i = 0; i < enemies.length; i++) for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.dead || b.dead || a.air || b.air || a.type === "boss" || b.type === "boss") continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz), md = 0.45 * (a.scale + b.scale);
      if (d > 1e-3 && d < md && Math.abs(a.pos.y - b.pos.y) < 1) {
        const p = (md - d) / 2 / d;
        moveEnemy(a, -dx * p, -dz * p, 1);
        moveEnemy(b, dx * p, dz * p, 1);
      }
    }
  }
  function updateEnemy(e, dt) {
    const H = e.H;
    const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, dy = P.pos.y - e.pos.y, dist = Math.hypot(dx, dz), d3 = Math.hypot(dist, dy);
    if (d3 > 280 && !e.air) {
      H.root.visible = false;
      return;
    }
    H.root.visible = true;
    e.moving = false;
    e.hurtT = Math.max(0, e.hurtT - dt);
    e.stunT -= dt;
    e.airHold -= dt;
    if (e.webT > 0 && !e.dead) {
      e.webT -= dt;
      if (e.webT <= 0) {
        e.webs = Math.max(0, e.webs - 1);
        if (e.webs > 0) e.webT = 4;
      }
    }
    const R2 = e.scale;
    if (e.air) {
      if (e.airHold > 0) {
        e.vel.y = e.vel.y * (1 - Math.min(1, 4 * dt)) - 3 * dt;
        e.vel.x *= 1 - Math.min(1, 3 * dt);
        e.vel.z *= 1 - Math.min(1, 3 * dt);
      } else e.vel.y -= 26 * dt;
      const ox = e.pos.x, oz = e.pos.z;
      e.pos.addScaledVector(e.vel, dt);
      if (solidAt(e.pos.x, e.pos.y + 0.8, e.pos.z)) {
        e.pos.x = ox;
        e.pos.z = oz;
        e.vel.x *= -0.3;
        e.vel.z *= -0.3;
      }
      const g = supportAt(e.pos.x, e.pos.z, e.pos.y + 0.3, 0.1);
      if (e.pos.y <= g && e.vel.y <= 0) {
        e.pos.y = g;
        e.air = false;
        e.groundY = g;
        e.vel.set(0, 0, 0);
        burst(e.pos.x, g + 0.1, e.pos.z, 10, 12432808, 3);
        sfx("land", 0.3);
        if (e.dead) e.state = "down";
        else {
          e.state = "getup";
          e.t = 0.7;
        }
      }
    } else if (!e.dead) {
      const cr2 = e.crime;
      if (!cr2.alert && d3 < 45) cr2.alert = true;
      const slow = e.webs > 0 ? 0.35 : 1;
      const face = () => {
        e.yaw = angLerp(e.yaw, Math.atan2(dx, dz), damp(8, dt));
      };
      if (e.state === "hurt" && e.vel.lengthSq() > 0.01) {
        moveEnemy(e, e.vel.x, e.vel.z, dt);
        e.vel.multiplyScalar(1 - Math.min(1, dt * 8));
      }
      if (e.type === "brute" && e.stunT > 0 && e.state !== "hurt") {
        e.state = "stun";
      }
      switch (e.state) {
        case "idle":
          if (cr2.alert) {
            e.state = "fight";
            break;
          }
          e.t -= dt;
          if (e.t <= 0) {
            e.t = rnd(2, 5);
            e.yawT = rnd(0, 6.28);
          }
          if (e.yawT !== void 0) e.yaw = angLerp(e.yaw, e.yawT, damp(2, dt));
          break;
        case "stun":
          if (e.stunT <= 0) e.state = "fight";
          break;
        case "fight":
          face();
          e.cd -= dt;
          if (e.type !== "gun") {
            if (Math.abs(dy) < 2.5 && dist < 35) {
              const sp = (e.type === "brute" ? 3.2 : 4.2) * slow;
              if (dist > 1.4 * R2) {
                moveEnemy(e, dx / dist * sp, dz / dist * sp, dt);
                e.moving = true;
              }
              if (dist < 1.9 * R2 && e.cd <= 0 && P.state !== "wall") {
                e.state = "windup";
                e.t = e.type === "brute" ? 0.8 : 0.55;
              }
            }
          } else {
            if (dist < 5 && dist > 0.1) {
              moveEnemy(e, -dx / dist * 2.5 * slow, -dz / dist * 2.5 * slow, dt);
              e.moving = true;
            }
            if (e.cd <= 0 && d3 < 65) {
              e.state = "aim";
              e.t = 0.75;
            }
          }
          break;
        case "windup":
          face();
          e.t -= dt;
          G.sense = true;
          if (e.t <= 0) {
            const big = e.type === "brute";
            if (dist < 2.4 * R2 && Math.abs(dy) < 1.8) hurtPlayer(big ? 25 : 10, e, big ? 16 : 6);
            if (big) {
              G.shake = Math.max(G.shake, 0.3);
              sfx("slam", 0.5);
              burst(e.pos.x, e.pos.y + 0.2, e.pos.z, 16, 12432808, 5);
            }
            e.state = "recover";
            e.t = big ? 0.8 : 0.45;
            e.cd = rnd(1.2, 2.4);
          }
          break;
        case "aim":
          face();
          e.t -= dt;
          if (e.t < 0.5) G.sense = true;
          if (e.t <= 0) {
            fireAt(e, d3);
            e.state = "fight";
            e.cd = rnd(1.6, 3.2);
          }
          break;
        case "recover":
        case "hurt":
        case "getup":
          e.t -= dt;
          if (e.t <= 0) e.state = "fight";
          break;
      }
    }
    poseEnemy(e, dt, d3);
  }
  function poseEnemy(e, dt, d3) {
    const t = e.pt, H = e.H;
    zeroPose(t);
    if (e.air) {
      t.bp = -0.9;
      t.sLz = 1.6;
      t.sRz = -1.6;
      t.hLx = -0.6;
      t.hRx = 0.3;
      t.kL = 0.8;
      t.kR = 0.6;
      e.spin *= 1 - dt;
    } else if (e.dead) {
      if (!e.webbed) {
        t.sLz = 1.3;
        t.sRz = -1.3;
        t.hLz = 0.15;
        t.hRz = -0.15;
      }
    } else switch (e.state) {
      case "windup":
        if (e.type === "brute") {
          t.sRx = -2.8;
          t.sLx = -2.8;
          t.eL = -0.6;
          t.eR = -0.6;
          t.bp = -0.2;
        } else {
          t.sRx = 1.1;
          t.eR = -1.2;
          t.spy = 0.5;
          t.sLx = -0.5;
          t.hLx = -0.3;
          t.kL = 0.3;
        }
        break;
      case "recover":
        if (e.type === "brute") {
          t.sRx = -1.2;
          t.sLx = -1.2;
          t.bp = 0.6;
          t.by = -0.3;
          t.kL = 0.9;
          t.kR = 0.9;
          t.hLx = -0.6;
          t.hRx = -0.6;
        } else {
          t.sRx = -1.7;
          t.eR = -0.1;
          t.spy = -0.5;
          t.hLx = -0.4;
          t.kL = 0.4;
        }
        break;
      case "aim":
        t.sRx = -1.5;
        t.sLx = -0.9;
        t.eL = -1.2;
        t.sLz = -0.3;
        break;
      case "hurt":
        t.bp = -0.4;
        t.hx = 0.3;
        t.sLz = 0.6;
        t.sRz = -0.6;
        t.eL = -1;
        t.eR = -1;
        break;
      case "stun":
        t.bp = 0.3;
        t.hx = 0.5;
        t.sLz = 0.2;
        t.sRz = -0.2;
        t.by = Math.sin(G.time * 6) * 0.03;
        t.spy = Math.sin(G.time * 3) * 0.3;
        break;
      case "getup":
        t.by = -0.4;
        t.hLx = -1.4;
        t.kL = 1.9;
        t.hRx = -1.2;
        t.kR = 1.8;
        t.bp = 0.5;
        break;
      default:
        if (e.moving) {
          e.ph += dt * 9;
          runPose(t, e.ph, 0.8, false);
        } else idlePose(t, G.time + e.ph);
        if (e.type === "melee" && !e.moving) {
          t.sRx = -0.5;
          t.eR = -1.3;
        }
        if (e.type === "brute") {
          t.sLz = 0.45;
          t.sRz = -0.45;
          t.eL = -1.4;
          t.eR = -1.4;
          t.sLx = -0.4;
          t.sRx = -0.4;
        }
        if (e.state === "fight" && e.type === "gun") {
          t.sRx = -1.2;
          t.eR = -0.2;
        }
    }
    if (d3 < 120 || e.air) {
      blendPose(e.pc, t, damp(e.state === "recover" ? 30 : 12, dt));
      applyPose(H, e.pc);
      const angry = !e.dead && (e.state === "windup" || e.state === "recover" || e.state === "fight" || e.type === "brute");
      H.setHands(angry && e.type !== "gun" ? "fist" : "open", e.wpn || angry ? "fist" : "open");
    }
    e.down += ((e.dead && !e.air ? 1 : 0) - e.down) * damp(6, dt);
    H.root.position.copy(e.pos);
    H.root.position.y += 0.12 * e.down * e.scale;
    if (e.air) e.yaw += e.spin * dt;
    H.root.rotation.set(-Math.PI / 2 * e.down, e.yaw, 0, "YXZ");
    if (e.state === "aim" && !e.dead && !e.air) {
      H.root.updateMatrixWorld(true);
      aimArm(H, "R", _a2.set(P.pos.x, P.pos.y + 1.2, P.pos.z), 1);
    }
    e.cocoon.visible = e.webbed;
    e.blob.visible = !e.webbed && e.webs > 0;
    if (e.blob.visible) e.blob.scale.set(0.1 + Math.min(e.webs, 4) * 0.07, 0.09 + Math.min(e.webs, 4) * 0.06, 0.08);
  }
  function removeEnemy(e) {
    e.gone = true;
    scene.remove(e.H.root);
    const k = enemies.indexOf(e);
    if (k >= 0) enemies.splice(k, 1);
  }
  function updateCrimes(dt) {
    for (let i = crimes.length - 1; i >= 0; i--) {
      const cr2 = crimes[i];
      if (cr2.active) {
        if (cr2.list.every((e) => e.dead)) {
          cr2.active = false;
          cr2.clearT = 0;
          save.crimes++;
          addXP(300);
          doSave();
          sfx("win");
          showMsg("PRZEST\u0118PSTWO UDAREMNIONE", "+300 PD", 3);
        }
      } else {
        cr2.clearT += dt;
        if (cr2.clearT > 12) {
          for (const e of cr2.list) removeEnemy(e);
          if (cr2.spot) cr2.spot.busy = false;
          crimes.splice(i, 1);
        }
      }
    }
    if (crimes.filter((c) => c.active && c.spot).length < 5) spawnCrime(false);
  }
  function initBags() {
    const cand = roofs.filter((r) => r.y1 >= 20 && r.y1 <= 220 && r.x1 - r.x0 > 6 && r.z1 - r.z0 > 6);
    const used = /* @__PURE__ */ new Set();
    const bm = new THREE.MeshStandardMaterial({ color: 8010538, roughness: 0.8 });
    const fm = new THREE.MeshStandardMaterial({ color: 13112348, roughness: 0.6 });
    const gm = new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < BAGS_N && used.size < cand.length; i++) {
      let k;
      do {
        k = Math.floor(sr(0, cand.length));
      } while (used.has(k));
      used.add(k);
      const r = cand[k];
      const g = new THREE.Group();
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.3), bm);
      b1.castShadow = true;
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.06), fm);
      b2.position.set(0, -0.08, 0.17);
      const gl = new THREE.Sprite(gm);
      gl.scale.set(2.6, 2.6, 1);
      g.add(b1, b2, gl);
      g.position.set((r.x0 + r.x1) / 2, r.y1 + 0.9, (r.z0 + r.z1) / 2);
      const got = save.bags.includes(i);
      g.visible = !got;
      scene.add(g);
      bags.push({ g, got, i });
    }
  }
  function updateBags(dt) {
    for (const b of bags) {
      if (b.got) continue;
      b.g.rotation.y += dt * 1.5;
      const d = b.g.position.distanceTo(_t2.set(P.pos.x, P.pos.y + 0.9, P.pos.z));
      if (d < 2.4) {
        b.got = true;
        b.g.visible = false;
        save.bags.push(b.i);
        doSave();
        addXP(150);
        sfx("pickup");
        rumble(0.1, 0.2, 0.4);
        showMsg("PLECAK ZNALEZIONY", `${save.bags.length} / ${BAGS_N}   +150 PD`, 2.5);
      }
    }
  }
  var _t2, _h, _cf, _a2, need, saveT, PMAX, pts, pPos, pCol, pVel, pLife, pIdx, trGeo, trMat, tracers, splats, splatMat, shotGeo, shotMat, glowTex, shots, pick2, bags, BAGS_N;
  var init_wrogowie = __esm({
    "js/wrogowie.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_postac();
      init_gracz();
      init_misje();
      init_umiejetnosci();
      init_dzwiek();
      init_wejscie();
      init_ui();
      _t2 = new V3();
      _h = new V3();
      _cf = new V3();
      _a2 = new V3();
      need = (l) => 600 + l * 400;
      saveT = 0;
      PMAX = 700;
      pIdx = 0;
      trGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5, 1, true);
      trGeo.translate(0, 0.5, 0);
      trMat = new THREE.MeshBasicMaterial({ color: 16769162 });
      tracers = [];
      splats = [];
      shots = [];
      pick2 = (a) => a[Math.floor(Math.random() * a.length)];
      bags = [];
      BAGS_N = 20;
    }
  });

  // js/ui.js
  function key(a, dev) {
    const g = (dev || G.lastDev) === "pad" ? GLY[pad.type] : dev && dev !== "kb" ? GLY[dev] : GLY.kb;
    return kk(g[a]);
  }
  function showMsg(t, s, dur = 2.5) {
    $("msgT").textContent = t;
    $("msgS").innerHTML = s || "";
    $("msg").style.opacity = 1;
    msgT = dur;
  }
  function flashDamage() {
    dmgT = 0.25;
  }
  function popText(t) {
    const p = $("pop");
    p.textContent = t;
    p.style.opacity = 1;
    p.style.transform = "translate(-50%,-50%) scale(1.1)";
    popT = 0.9;
  }
  function hint(id, text) {
    if (hintsShown.has(id)) return;
    hintsShown.add(id);
    $("hint").innerHTML = text;
    $("hint").style.opacity = 1;
    hintT = 6;
  }
  function drawCity(x, hl) {
    x.fillStyle = "#3d0e16";
    x.fillRect(-6e3, -6e3, 12e3, 12e3);
    x.fillStyle = "#1a1d22";
    const W0 = LAND.x0 - 270, E0 = LAND.x1 + 230, N0 = LAND.z0 - 90;
    x.fillRect(-6e3, -6e3, W0 + 6e3, 12e3);
    x.fillRect(E0, -6e3, 6e3, 12e3);
    x.fillRect(W0, -6e3, E0 - W0, N0 + 6e3);
    x.fillStyle = "#0f171d";
    x.fillRect(LAND.x0, LAND.z0, LAND.x1 - LAND.x0, LAND.z1 - LAND.z0);
    x.fillStyle = "#123222";
    x.fillRect(PK.x0, PK.z0, PK.x1 - PK.x0, PK.z1 - PK.z0);
    x.fillStyle = "#3d0e16";
    x.beginPath();
    x.ellipse(POND.x, POND.z, POND.rx, POND.rz, 0, 0, 7);
    x.fill();
    for (const f of footprints) {
      const k = Math.min(f.h, 220) / 220;
      x.fillStyle = hl && f.dk === hl ? `hsl(193,85%,${46 + k * 30}%)` : `hsl(205,12%,${24 + k * 40}%)`;
      x.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
    }
  }
  function icoDiamond(x, sx, sy, s, col, txt2) {
    x.save();
    x.translate(sx, sy);
    x.rotate(Math.PI / 4);
    x.fillStyle = col;
    x.strokeStyle = "#fff";
    x.lineWidth = 2;
    x.fillRect(-s / 2, -s / 2, s, s);
    x.strokeRect(-s / 2, -s / 2, s, s);
    x.restore();
    if (txt2) {
      x.fillStyle = "#fff";
      x.font = `bold ${s * 0.85}px Rajdhani`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText(txt2, sx, sy + 1);
    }
  }
  function icoBag(x, sx, sy, s) {
    x.fillStyle = "#f5d76e";
    x.strokeStyle = "#3a2a00";
    x.lineWidth = 1.5;
    x.beginPath();
    x.arc(sx, sy, s / 2, 0, 7);
    x.fill();
    x.stroke();
  }
  function icoPlayer(x, sx, sy, rot, s) {
    x.save();
    x.translate(sx, sy);
    x.rotate(rot);
    x.fillStyle = "#fff";
    x.strokeStyle = "#0a2230";
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(0, -s);
    x.lineTo(s * 0.72, s * 0.8);
    x.lineTo(0, s * 0.35);
    x.lineTo(-s * 0.72, s * 0.8);
    x.closePath();
    x.fill();
    x.stroke();
    x.restore();
  }
  function missionIcons(x, S, s) {
    for (const m of missionList()) {
      if (m.x == null) continue;
      const [a, b] = S(m.x, m.z);
      if (m.icon === "boss") icoDiamond(x, a, b, s * 1.2, "#8a1be0", "\u2620");
      else if (m.icon === "race") icoDiamond(x, a, b, s, "#ffc93c", "\u2691");
      else if (m.icon === "fisk") icoDiamond(x, a, b, s * 1.15, "#ffffff", "\u265B");
      else icoDiamond(x, a, b, s, "#ff8a1e", "\u25B6");
    }
  }
  function buildMiniBase() {
    const c = cv(LAND.x1 - LAND.x0 + 640, LAND.z1 - LAND.z0 + 640), x = c.getContext("2d");
    x.translate(-MM.x0, -MM.z0);
    drawCity(x, null);
    miniBase = c;
  }
  function drawMini() {
    const c = $("mini"), x = c.getContext("2d"), R2 = c.width / 2, Z = 0.75;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    if (G.interior) {
      x.fillStyle = "rgba(8,16,24,.92)";
      x.beginPath();
      x.arc(R2, R2, R2, 0, 7);
      x.fill();
      x.fillStyle = "#3fe3ff";
      x.font = "bold 22px Rajdhani";
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillText("WN\u0118TRZE", R2, R2 - 8);
      icoPlayer(x, R2, R2 + 22, cam.yaw + Math.PI - P.heading, 9);
      return;
    }
    x.save();
    x.beginPath();
    x.arc(R2, R2, R2, 0, 7);
    x.clip();
    x.translate(R2, R2);
    x.rotate(cam.yaw);
    x.scale(Z, Z);
    x.translate(-P.pos.x, -P.pos.z);
    x.drawImage(miniBase, MM.x0, MM.z0);
    x.fillStyle = "#ff3b3b";
    for (const e of enemies) if (!e.dead && !e.gone) {
      x.beginPath();
      x.arc(e.pos.x, e.pos.z, (e.type === "boss" ? 7 : 3.5) / Z, 0, 7);
      x.fill();
    }
    for (const b of bags) if (!b.got && Math.abs(b.g.position.x - P.pos.x) < 200 && Math.abs(b.g.position.z - P.pos.z) < 200) icoBag(x, b.g.position.x, b.g.position.z, 9 / Z);
    x.restore();
    const cs = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
    const toMini = (wx, wz) => {
      let dx = (wx - P.pos.x) * Z, dz = (wz - P.pos.z) * Z;
      let rx = dx * cs - dz * sn, ry = dx * sn + dz * cs;
      const d = Math.hypot(rx, ry);
      if (d > R2 - 12) {
        rx *= (R2 - 12) / d;
        ry *= (R2 - 12) / d;
      }
      return [R2 + rx, R2 + ry];
    };
    for (const cr2 of crimes) if (cr2.active) {
      const [a, b] = toMini(cr2.x, cr2.z);
      icoCrime(x, a, b, 13);
    }
    missionIcons(x, toMini, 13);
    if (G.wp) {
      const [a, b] = toMini(G.wp.x, G.wp.z);
      icoWP(x, a, b, 12);
    }
    icoPlayer(x, R2, R2, cam.yaw + Math.PI - P.heading, 10);
    const [nx, ny] = toMini(P.pos.x, P.pos.z - 5e3);
    x.fillStyle = "#3fe3ff";
    x.font = "bold 15px Rajdhani";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText("N", nx, ny);
  }
  function drawLines(k, dt) {
    const c = $("lines");
    if (k <= 0.01) {
      c.style.opacity = 0;
      return;
    }
    if (c.width !== innerWidth >> 1) {
      c.width = innerWidth >> 1;
      c.height = innerHeight >> 1;
    }
    const x = c.getContext("2d"), W = c.width, H = c.height, R2 = Math.hypot(W, H) / 2;
    x.clearRect(0, 0, W, H);
    x.strokeStyle = "rgba(255,255,255,.55)";
    x.lineWidth = 1.5;
    for (const L of LN) {
      L.r += dt * (1.5 + k * 3);
      if (L.r > 1) {
        L.r = 0.35 + Math.random() * 0.2;
        L.a = Math.random() * 6.283;
      }
      const r02 = R2 * L.r, r1 = r02 + R2 * L.l;
      x.beginPath();
      x.moveTo(W / 2 + Math.cos(L.a) * r02, H / 2 + Math.sin(L.a) * r02);
      x.lineTo(W / 2 + Math.cos(L.a) * r1, H / 2 + Math.sin(L.a) * r1);
      x.stroke();
    }
    c.style.opacity = k;
  }
  function placeMarker(elm, x, y, z, txt2) {
    _p.set(x, y, z).project(camera);
    let sx = _p.x, sy = _p.y;
    const behind2 = _p.z > 1;
    if (behind2) {
      sx = -sx;
      sy = -sy;
    }
    const m = 0.88;
    if (behind2 || Math.abs(sx) > m || Math.abs(sy) > m) {
      const s = m / Math.max(Math.abs(sx), Math.abs(sy), 1e-3);
      sx *= s;
      sy *= s;
    }
    elm.style.transform = `translate(${(sx * 0.5 + 0.5) * innerWidth}px,${(-sy * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
    elm.querySelector(".l").textContent = txt2;
    elm.style.display = "block";
  }
  function toScreen(x, y, z) {
    _p.set(x, y, z).project(camera);
    return _p.z < 1 ? [(_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight] : null;
  }
  function updateHUD(dt) {
    set("hpFill", "width", P.hp / maxHp() * 100 + "%");
    const fs = $("focus").querySelectorAll("i");
    fs.forEach((f, i) => {
      f.style.width = clamp(P.focus - i, 0, 1) * 100 + "%";
    });
    $("lvlNum").textContent = save.lvl;
    $("xpTxt").textContent = `${Math.floor(save.xp)} / ${need(save.lvl)} PD`;
    $("xpFill").style.width = save.xp / need(save.lvl) * 100 + "%";
    const sp = skillPoints();
    $("skp").textContent = sp ? `\u2605 ${sp} punkt${sp === 1 ? "" : sp < 5 ? "y" : "\xF3w"} umiej\u0119tno\u015Bci` : "";
    const cb = $("combo");
    if (P.combo >= 2) {
      cb.textContent = "x" + P.combo + " KOMBO";
      cb.style.opacity = 1;
    } else cb.style.opacity = 0;
    if (msgT > 0) {
      msgT -= dt;
      if (msgT <= 0) $("msg").style.opacity = 0;
    }
    if (popT > 0) {
      popT -= dt;
      if (popT <= 0.5) {
        $("pop").style.opacity = 0;
        $("pop").style.transform = "translate(-50%,-50%) scale(1)";
      }
    }
    if (hintT > 0) {
      hintT -= dt;
      if (hintT <= 0) $("hint").style.opacity = 0;
    }
    dmgT -= dt;
    $("dmg").style.opacity = dmgT > 0 ? 1 : P.hp < maxHp() * 0.3 ? 0.55 : 0;
    $("fade").style.opacity = P.dead && P.deadT < 1.3 ? 1 : 0;
    const speed = P.vel.length();
    $("speedfx").style.opacity = clamp((speed - 25) / 35, 0, 0.85);
    drawLines(clamp((speed - 30) / 30, 0, 0.8), dt);
    const noFocus = !document.hasFocus(), noLock = G.mode === "kb" && document.pointerLockElement !== canvas;
    const lh = $("lockHint");
    lh.classList.toggle("hidden", !(noFocus || noLock));
    const lt = noFocus ? "Kliknij w gr\u0119, \u017Ceby sterowa\u0107" : "Kliknij, aby sterowa\u0107 mysz\u0105";
    if (lh.textContent !== lt) lh.textContent = lt;
    const bb = $("bossBar");
    if (G.boss) {
      bb.classList.remove("hidden");
      bb.querySelector("b").textContent = G.boss.name || "NOSORO\u017BEC";
      bb.querySelector("i").style.width = G.boss.hp / G.boss.max * 100 + "%";
      bb.querySelector("small").textContent = G.boss.st === "tired" || G.boss.st === "stun" ? "BEZBRONNY \u2014 BIJ!" : G.boss.st === "chargeW" ? "SZAR\u017BA \u2014 UNIK!" : "";
    } else bb.classList.add("hidden");
    const rp = $("racePan");
    if (G.race) {
      rp.classList.remove("hidden");
      rp.querySelector("b").textContent = fmtTime(G.race.t);
      rp.querySelector("small").textContent = `${G.race.name} \xB7 PIER\u015ACIE\u0143 ${G.race.idx} / ${G.race.n} \xB7 Z\u0141OTO ${fmtTime(G.race.par)}`;
    } else rp.classList.add("hidden");
    distChk -= dt;
    if (distChk <= 0) {
      distChk = 0.4;
      const d = G.interior ? lastDist : districtAt(P.pos.x, P.pos.z);
      if (d !== lastDist) {
        lastDist = d;
        $("distName").textContent = DIST[d].name;
        $("district").style.opacity = 1;
        distT = 3;
      }
    }
    if (distT > 0) {
      distT -= dt;
      if (distT <= 0) $("district").style.opacity = 0;
    }
    promptT -= dt;
    if (promptT <= 0) {
      promptT = 0.2;
      const arr = [];
      const near = enemies.some((e) => !e.dead && e.pos.distanceTo(P.pos) < 14);
      if (P.colaNear) arr.push(["special", '<b style="color:#ff4a4a">We\u017A col\u0119 z lod\xF3wki</b>']);
      if (P.doorNear) arr.push(["special", `<b style="color:#ffc93c">Wejd\u017A: ${P.doorNear.name}</b>`]);
      else if (P.exitNear) arr.push(["special", '<b style="color:#39ff6a">Wyjd\u017A</b>']);
      if (P.finReady) arr.push(["special", '<b style="color:#3fe3ff">WYKO\u0143CZENIE</b>']);
      if (P.state === "car") arr.push(["punch", "Bij w dach"], ["jump", "Zeskocz"]);
      else if (P.state === "ground") {
        if (P.perchT > 0) arr.push(["jump", '<b style="color:#3fe3ff">WYBICIE</b>']);
        arr.push(["swing", "Parkour (przytrzymaj)"], ["jump", "Skok"]);
      } else if (P.state === "air") {
        arr.push(["swing", "Bujanie (przytrzymaj)"]);
        if (P.zips > 0) arr.push(["jump", "Zip sieci\u0105"]);
        if (!near) arr.push(["punch", "Trik"]);
      } else if (P.state === "swing") arr.push(["jump", "Skok z sieci"]);
      else if (P.state === "wall") arr.push(["jump", "Odbicie od \u015Bciany"], ["swing", "Bieg po \u015Bcianie"]);
      else if (P.state === "pz") arr.push(["jump", "Wybicie z zaczepu"]);
      if (near && P.state !== "car") arr.push(["punch", "Cios (przytrzymaj = wybicie)"], ["web", "Strza\u0142 sieci\u0105"], ["dodge", "Unik"]);
      arr.push(["map", "Mapa"]);
      const h = arr.map(([a, t]) => `<div>${t}${key(a)}</div>`).join("");
      if (h !== lastPrompt) {
        lastPrompt = h;
        $("prompts").innerHTML = h;
      }
    }
    let best = null, bd = 1e9;
    for (const cr2 of crimes) if (cr2.active) {
      const d = Math.hypot(cr2.x - P.pos.x, cr2.z - P.pos.z);
      if (d < bd) {
        bd = d;
        best = cr2;
      }
    }
    if (best && bd > 25 && !G.race && !G.interior) placeMarker($("crimeMk"), best.x, best.y + 4, best.z, "PRZEST\u0118PSTWO " + Math.round(bd) + " m");
    else $("crimeMk").style.display = "none";
    if (G.chase && P.state !== "car") placeMarker($("chaseMk"), G.chase.pos.x, 3, G.chase.pos.z, `PO\u015ACIG ${Math.round(Math.hypot(G.chase.pos.x - P.pos.x, G.chase.pos.z - P.pos.z))} m \xB7 ${Math.max(0, 80 - G.chase.t | 0)} s`);
    else $("chaseMk").style.display = "none";
    if (G.boss) {
      const d = Math.hypot(G.boss.pos.x - P.pos.x, G.boss.pos.z - P.pos.z);
      if (d > 20) placeMarker($("bossMk"), G.boss.pos.x, 6, G.boss.pos.z, (G.boss.name || "NOSORO\u017BEC") + " " + Math.round(d) + " m");
      else $("bossMk").style.display = "none";
    } else $("bossMk").style.display = "none";
    if (G.wp) {
      const d = Math.hypot(G.wp.x - P.pos.x, G.wp.z - P.pos.z);
      if (d < 20) {
        G.wp = null;
        $("wpMk").style.display = "none";
        sfx("ui");
      } else placeMarker($("wpMk"), G.wp.x, P.pos.y + 3, G.wp.z, Math.round(d) + " m");
    } else $("wpMk").style.display = "none";
    const pe = $("perch"), pp2 = P.perchPt && toScreen(P.perchPt.x, P.perchPt.y + 0.6, P.perchPt.z);
    if (pp2) {
      pe.style.display = "block";
      pe.style.transform = `translate(${pp2[0] - 17}px,${pp2[1] - 17}px)`;
      const k = key("special");
      if (pe.firstChild.outerHTML !== k) pe.innerHTML = k;
    } else pe.style.display = "none";
    const tg = webTarget(), ret = $("reticle");
    const sp2 = tg && toScreen(tg.pos.x, tg.pos.y + 1.1 * (tg.scale || 1), tg.pos.z);
    if (sp2) {
      ret.style.opacity = 1;
      ret.style.transform = `translate(${sp2[0] - 15}px,${sp2[1] - 15}px) rotate(45deg)`;
    } else ret.style.opacity = 0;
    const sn = $("sense"), hp = G.sense && toScreen(P.pos.x, P.pos.y + 2.1, P.pos.z);
    if (hp) {
      sn.style.opacity = 1;
      sn.style.transform = `translate(${hp[0] - 55}px,${hp[1] - 60}px)`;
    } else sn.style.opacity = 0;
    drawMini();
    updateFlare();
  }
  function updateFlare() {
    const el2 = $("flare");
    if (!el2) return;
    let want = 0;
    if (G.state === "play" && !G.cine && !G.interior && save.tod !== "night") {
      _sf.copy(camera.position).addScaledVector(sunDir, 1500).project(camera);
      if (_sf.z < 1 && Math.abs(_sf.x) < 1.15 && Math.abs(_sf.y) < 1.15) {
        _so.copy(sunDir);
        const blocked = raycastCity(camera.position, _so, 700) < 699;
        if (!blocked) {
          want = Math.max(0, 1 - Math.hypot(_sf.x, _sf.y) * 0.55) * (save.tod === "day" ? 0.55 : 1);
          el2.style.transform = `translate(${(_sf.x * 0.5 + 0.5) * innerWidth}px,${(-_sf.y * 0.5 + 0.5) * innerHeight}px)`;
        }
      }
    }
    flareK += (want - flareK) * 0.12;
    el2.style.opacity = flareK.toFixed(3);
  }
  function menuItems() {
    return [
      ["pad", "GRAJ NA PADZIE"],
      ["kb", "GRAJ NA KOMPUTERZE <small>klawiatura + mysz</small>"],
      ...SLOTS.map((n) => ["ld" + n, slotLabel(n, "WCZYTAJ ZAPIS")]),
      ["new", newLabel()],
      ["suits", "STROJE"],
      ["skills", "UMIEJ\u0118TNO\u015ACI"],
      ["moves", "STEROWANIE"],
      ["tod", todLabel()],
      ["music", musLabel()],
      ["gfx", gfxLabel()]
    ];
  }
  function renderMenu() {
    const L = $("menuList"), items = menuItems();
    if (L.children.length !== items.length) {
      L.innerHTML = items.map(() => '<div class="mi"></div>').join("");
      [...L.children].forEach((d, i) => {
        d.onmouseenter = () => {
          G.menuIdx = i;
          renderMenu();
        };
        d.onclick = () => menuAct(menuItems()[i][0]);
      });
    }
    [...L.children].forEach((d, i) => {
      const [a, t] = items[i];
      const h = a === "pad" || a === "kb" ? t.replace("GRAJ", G.started ? "WR\xD3\u0106 DO GRY" : save.hasGame ? "KONTYNUUJ" : "GRAJ") : t;
      if (d.innerHTML !== h) d.innerHTML = h;
      d.classList.toggle("f", i === G.menuIdx);
    });
  }
  function slotRead(n) {
    try {
      return JSON.parse(localStorage.getItem(slotKey(n)) || "null");
    } catch (e) {
      return null;
    }
  }
  function slotLabel(n, verb) {
    const s = slotRead(n);
    return s ? `${verb} ${n} <small>poz. ${s.lvl} \xB7 ${s.pct}% \xB7 ${fmtT(s.savedAt)}</small>` : `${verb} ${n} <small>pusty</small>`;
  }
  function slotSave(n) {
    hooks.save();
    try {
      localStorage.setItem(slotKey(n), JSON.stringify({ ...save, pct: progress() }));
      showMsg("ZAPIS " + n, "Gra zapisana w slocie " + n, 2.5);
    } catch (e) {
      showMsg("B\u0141\u0104D ZAPISU", "Przegl\u0105darka nie pozwala zapisywa\u0107 (tryb prywatny?)", 3.5);
    }
  }
  function slotLoad(n) {
    const sl = slotRead(n);
    if (!sl) {
      showMsg("SLOT " + n + " JEST PUSTY", "Najpierw zapisz gr\u0119: Pauza \u2192 Gra \u2192 Zapisz w slocie", 3);
      return;
    }
    const keep = { gfx: save.gfx, tod: save.tod, music: save.music };
    delete sl.pct;
    Object.assign(save, sl, keep, { hasGame: true });
    doSave();
    try {
      sessionStorage.setItem("sp_skip", "1");
      sessionStorage.setItem("sp_load", G.mode || (pad.connected ? "pad" : "kb"));
    } catch (e) {
    }
    location.reload();
  }
  function confirmNew(refresh) {
    if (performance.now() - askNew < 4e3) {
      hooks.newGame();
      return;
    }
    askNew = performance.now();
    refresh();
    setTimeout(refresh, 4100);
  }
  function hideSplash() {
    const t = $("tytul");
    if (!t || !G.splash) return;
    G.splash = false;
    t.classList.add("off");
    setTimeout(() => t.remove(), 1e3);
  }
  function menuAct(a) {
    sfx("ui");
    if (a === "new") {
      confirmNew(renderMenu);
      return;
    }
    if (a[0] === "l" && a[1] === "d") {
      slotLoad(+a[2]);
      return;
    }
    if (a === "pad" || a === "kb") hooks.start(a);
    else if (a === "suits") openPause("suits", true);
    else if (a === "skills") openPause("skills", true);
    else if (a === "moves") openPause("moves", true);
    else if (a === "gfx") {
      hooks.gfx();
      renderMenu();
    } else if (a === "tod") {
      hooks.tod();
      renderMenu();
    } else if (a === "music") {
      hooks.music();
      renderMenu();
    }
  }
  function updateMenu(dt) {
    const N = navInput(dt), n = menuItems().length;
    if (N.up) {
      G.menuIdx = (G.menuIdx + n - 1) % n;
      renderMenu();
      sfx("ui");
    }
    if (N.down) {
      G.menuIdx = (G.menuIdx + 1) % n;
      renderMenu();
      sfx("ui");
    }
    if (N.ok) menuAct(menuItems()[G.menuIdx][0]);
    const f = (pad.connected ? `\u{1F3AE} Wykryto pada: <b>${pad.type === "ps" ? "PlayStation" : "Xbox / inny"}</b>` : "\u{1F3AE} Pad niepod\u0142\u0105czony \u2014 pod\u0142\u0105cz i naci\u015Bnij dowolny przycisk") + `<br>${audioOK() ? "\u{1F50A} D\u017Awi\u0119k w\u0142\u0105czony" : "\u{1F508} Kliknij lub naci\u015Bnij klawisz, \u017Ceby w\u0142\u0105czy\u0107 d\u017Awi\u0119k"}<br>Poziom ${save.lvl} \xB7 Plecaki ${save.bags.length}/${BAGS_N} \xB7 Post\u0119py ${progress()}%` + (save.savedAt ? ` \xB7 Zapis: ${new Date(save.savedAt).toLocaleString("pl-PL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}` : "");
    if (f !== footTxt) {
      footTxt = f;
      $("menuFoot").innerHTML = f;
    }
  }
  function openPause(tab, fromMenu) {
    G.pauseFrom = fromMenu ? "menu" : "play";
    G.state = "pause";
    G.pauseTab = tab;
    $("pause").classList.remove("hidden");
    $("menu").classList.add("hidden");
    $("hud").classList.add("hidden");
    if (document.pointerLockElement) document.exitPointerLock();
    G.suitIdx = Math.max(0, SUITS.findIndex((s) => s.id === save.suit));
    G.gameIdx = 0;
    showTab(true);
  }
  function closePause() {
    $("pause").classList.add("hidden");
    if (G.pauseFrom === "menu") {
      G.state = "menu";
      $("menu").classList.remove("hidden");
      renderMenu();
    } else {
      G.state = "play";
      $("hud").classList.remove("hidden");
      if (G.mode === "kb") lockMouse();
    }
  }
  function switchTab(d) {
    const i = TABS.findIndex((t) => t[0] === G.pauseTab);
    G.pauseTab = TABS[(i + d + TABS.length) % TABS.length][0];
    sfx("ui");
    showTab(true);
  }
  function showTab(recenter) {
    const sp = skillPoints();
    $("tabs").innerHTML = key("lb") + TABS.map(([id, t]) => `<div class="tab${id === G.pauseTab ? " on" : ""}" data-t="${id}">${t}${id === "skills" && sp ? `<sup> ${sp}</sup>` : ""}</div>`).join("") + key("rb") + `<div id="pLvl"><span>POZIOM</span><b>${save.lvl}</b><span>${Math.floor(save.xp)} / ${need(save.lvl)} PD</span></div>`;
    [...$("tabs").querySelectorAll(".tab")].forEach((d) => d.onclick = () => {
      G.pauseTab = d.dataset.t;
      sfx("ui");
      showTab(true);
    });
    for (const [id] of TABS) $("pg-" + id).classList.toggle("hidden", id !== G.pauseTab);
    const T = G.pauseTab;
    if (T === "map" && recenter) {
      const c = $("mapc");
      c.width = c.clientWidth;
      c.height = c.clientHeight;
      mapV.cx = P.pos.x;
      mapV.cz = P.pos.z;
      mapV.zoom = c.height / (LAND.z1 - LAND.z0) * 1.4;
    }
    if (T === "suits") renderSuits();
    if (T === "skills") renderSkills();
    if (T === "miss") renderMiss();
    if (T === "moves") renderMoves();
    if (T === "game") renderGame();
    const close = G.pauseFrom === "menu" ? "WR\xD3\u0106" : "ZAMKNIJ";
    $("pauseFoot").innerHTML = {
      map: `<span>${key("lt")}${key("rt")} PRZYBLI\u017B</span><span>${key("ok")} W\u0141ASNY ZNACZNIK</span><span>${key("y")} USU\u0143 ZNACZNIK</span><span>${key("back")} ${close}</span>`,
      skills: `<span>${key("ok")} ODBLOKUJ</span><span>${key("back")} ${close}</span>`,
      miss: `<span>${key("ok")} USTAW ZNACZNIK</span><span>${key("back")} ${close}</span>`,
      suits: `<span>${key("ok")} ZA\u0141\xD3\u017B STR\xD3J</span><span>${key("back")} ${close}</span>`,
      moves: `<span>${key("back")} ${close}</span>`,
      game: `<span>${key("ok")} WYBIERZ</span><span>${key("back")} ${close}</span>`
    }[T];
  }
  function updatePause(dt) {
    const N = navInput(dt);
    if (N.tl) switchTab(-1);
    else if (N.tr) switchTab(1);
    const T = G.pauseTab;
    if (N.back || T === "map" && (KP.KeyM || KP.Tab || pp(8))) {
      sfx("ui");
      closePause();
      return;
    }
    if (T === "map") updateMap(dt, N);
    else if (T === "suits") updateSuits(dt, N);
    else if (T === "skills") updateSkills(N);
    else if (T === "miss") updateMiss(N);
    else if (T === "game") updateGame(N);
  }
  function setWP(x, z) {
    G.wp = { x: clamp(x, LAND.x0, LAND.x1), z: clamp(z, LAND.z0, LAND.z1) };
    sfx("ui");
  }
  function updateMap(dt, N) {
    const c = $("mapc");
    if (c.width !== c.clientWidth || c.height !== c.clientHeight) {
      c.width = c.clientWidth;
      c.height = c.clientHeight;
    }
    let [px, py] = stick(pad.a[0], pad.a[1]);
    if (K.KeyW || K.ArrowUp) py -= 1;
    if (K.KeyS || K.ArrowDown) py += 1;
    if (K.KeyA || K.ArrowLeft) px -= 1;
    if (K.KeyD || K.ArrowRight) px += 1;
    const sp = 520 / mapV.zoom * dt;
    mapV.cx += px * sp;
    mapV.cz += py * sp;
    let z = 0;
    if (pad.b[7] || K.Equal || K.NumpadAdd) z += 1;
    if (pad.b[6] || K.Minus || K.NumpadSubtract) z -= 1;
    mapV.zoom *= Math.exp(z * dt * 1.6);
    if (mouse.wheel) mapV.zoom *= Math.exp(-mouse.wheel * 15e-4);
    mapV.zoom = clamp(mapV.zoom, 0.25, 5);
    mapV.cx = clamp(mapV.cx, LAND.x0 - 150, LAND.x1 + 150);
    mapV.cz = clamp(mapV.cz, LAND.z0 - 150, LAND.z1 + 150);
    if (N.ok) setWP(mapV.cx, mapV.cz);
    if (N.y) {
      G.wp = null;
      sfx("ui");
    }
    drawMap();
  }
  function drawMap() {
    const c = $("mapc"), x = c.getContext("2d"), W = c.width, H = c.height, z = mapV.zoom;
    const dk = districtAt(mapV.cx, mapV.cz);
    x.setTransform(z, 0, 0, z, W / 2 - mapV.cx * z, H / 2 - mapV.cz * z);
    drawCity(x, dk);
    x.setTransform(1, 0, 0, 1, 0, 0);
    const S = (wx, wz) => [W / 2 + (wx - mapV.cx) * z, H / 2 + (wz - mapV.cz) * z];
    for (const b of bags) if (!b.got) {
      const [a, q] = S(b.g.position.x, b.g.position.z);
      icoBag(x, a, q, 11);
    }
    for (const cr2 of crimes) if (cr2.active) {
      const [a, q] = S(cr2.x, cr2.z);
      icoCrime(x, a, q, 16);
    }
    missionIcons(x, S, 18);
    if (G.wp) {
      const [a, q] = S(G.wp.x, G.wp.z);
      icoWP(x, a, q, 15);
    }
    const [px, py] = S(P.pos.x, P.pos.z);
    icoPlayer(x, px, py, Math.PI - P.heading, 14);
    x.strokeStyle = "rgba(255,255,255,.85)";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(W / 2, H / 2, 11, 0, 7);
    x.moveTo(W / 2 - 20, H / 2);
    x.lineTo(W / 2 - 6, H / 2);
    x.moveTo(W / 2 + 6, H / 2);
    x.lineTo(W / 2 + 20, H / 2);
    x.moveTo(W / 2, H / 2 - 20);
    x.lineTo(W / 2, H / 2 - 6);
    x.moveTo(W / 2, H / 2 + 6);
    x.lineTo(W / 2, H / 2 + 20);
    x.stroke();
    $("mapDist").textContent = "\u{1F4CD} " + DIST[dk].name;
    $("mapProg").innerHTML = `<span>OG\xD3LNE POST\u0118PY</span><b>${progress()}%</b>`;
  }
  function renderSkills() {
    const P2 = $("skPanel");
    if (!P2.children.length) {
      P2.innerHTML = COLS.map((c, ci) => `<div class="skc"><h4>${c}</h4>${SKILLS.map((s, i) => s.col === ci ? `<div class="sk" data-i="${i}"></div>` : "").join("")}</div>`).join("");
      P2.querySelectorAll(".sk").forEach((d) => {
        const i = +d.dataset.i;
        d.onmouseenter = () => {
          G.skillIdx = i;
          refreshSkills();
        };
        d.onclick = () => {
          G.skillIdx = i;
          buySkill();
        };
      });
    }
    refreshSkills();
  }
  function refreshSkills() {
    $("skPanel").querySelectorAll(".sk").forEach((d) => {
      const s2 = SKILLS[+d.dataset.i], own = has(s2.id), can = canBuy(s2);
      d.className = "sk" + (own ? " own" : can ? " can" : !s2.req || has(s2.req) ? "" : " no") + (+d.dataset.i === G.skillIdx ? " f" : "");
      d.innerHTML = `${own ? "\u2714 " : ""}${s2.name}<small>${s2.desc}</small>`;
    });
    const s = SKILLS[G.skillIdx], sp = skillPoints();
    $("skName").textContent = s.name;
    $("skInfo").innerHTML = `${s.desc}<br>` + (has(s.id) ? '<b style="color:#3fe3ff">Odblokowane</b>' : s.req && !has(s.req) ? `<b style="color:#ff6b6b">Najpierw odblokuj: ${SKILLS.find((q) => q.id === s.req).name}</b>` : sp ? `<b style="color:#ffc93c">Koszt: 1 punkt \xB7 masz ${sp}</b>` : '<b style="color:#ff6b6b">Brak punkt\xF3w \u2014 zdob\u0105d\u017A kolejny poziom</b>');
  }
  function buySkill() {
    const s = SKILLS[G.skillIdx];
    if (buy(s)) {
      sfx("level");
      if (s.id.startsWith("hp")) P.hp = maxHp();
      showTab(false);
    } else sfx("hurt", 0.3);
    refreshSkills();
  }
  function updateSkills(N) {
    const cur2 = SKILLS[G.skillIdx];
    const col = SKILLS.filter((s) => s.col === cur2.col), ri2 = col.indexOf(cur2);
    let t = null;
    if (N.up && ri2 > 0) t = col[ri2 - 1];
    if (N.down && ri2 < col.length - 1) t = col[ri2 + 1];
    if (N.left || N.right) {
      const nc = clamp(cur2.col + (N.left ? -1 : 1), 0, COLS.length - 1), c2 = SKILLS.filter((s) => s.col === nc);
      t = c2[Math.min(ri2, c2.length - 1)];
    }
    if (t) {
      G.skillIdx = SKILLS.indexOf(t);
      refreshSkills();
      sfx("ui");
    }
    if (N.ok) buySkill();
  }
  function renderMiss() {
    const L = missionList();
    G.missIdx = clamp(G.missIdx, 0, L.length - 1);
    $("miList").innerHTML = L.map((m2, i) => `<div class="mis${i === G.missIdx ? " f" : ""}" data-i="${i}"><b>${m2.name}</b><small>${m2.status}</small></div>`).join("");
    $("miList").querySelectorAll(".mis").forEach((d) => {
      const i = +d.dataset.i;
      d.onclick = () => {
        G.missIdx = i;
        missWP();
        renderMiss();
      };
    });
    const m = L[G.missIdx];
    $("miName").textContent = m.name;
    $("miInfo").innerHTML = `${m.desc}<br><br><b style="color:#ffc93c">${m.status}</b>` + (m.x != null ? `<br><br>${key("ok")} ustaw znacznik na mapie` : "");
  }
  function missWP() {
    const m = missionList()[G.missIdx];
    if (m && m.x != null) {
      setWP(m.x, m.z);
      showTabHint();
    }
  }
  function showTabHint() {
    $("miInfo").innerHTML += '<br><b style="color:#3fe3ff">Znacznik ustawiony!</b>';
  }
  function updateMiss(N) {
    const n = missionList().length;
    if (N.up) {
      G.missIdx = (G.missIdx + n - 1) % n;
      renderMiss();
      sfx("ui");
    }
    if (N.down) {
      G.missIdx = (G.missIdx + 1) % n;
      renderMiss();
      sfx("ui");
    }
    if (N.ok) missWP();
  }
  function renderSuits() {
    const g = $("suitGrid");
    if (!g.children.length) SUITS.forEach((s, i) => {
      const d = document.createElement("div");
      d.className = "card";
      d.innerHTML = `<img src="${suitThumb(s)}"><div class="lk"></div><div class="eq">\u2714</div>`;
      d.onclick = () => {
        G.suitIdx = i;
        equip(i);
      };
      d.onmouseenter = () => {
        G.suitIdx = i;
        refreshSuits();
      };
      g.appendChild(d);
    });
    refreshSuits();
  }
  function refreshSuits() {
    const un = SUITS.filter((s2) => s2.lvl <= save.lvl).length;
    $("suitPct").textContent = Math.round(un / SUITS.length * 100) + "% ODBLOKOWANE";
    [...$("suitGrid").children].forEach((d, i) => {
      const s2 = SUITS[i], lock = s2.lvl > save.lvl;
      d.classList.toggle("f", i === G.suitIdx);
      d.classList.toggle("lock", lock);
      d.querySelector(".lk").innerHTML = lock ? "\u{1F512}<br>POZIOM " + s2.lvl : "";
      d.querySelector(".eq").style.display = s2.id === save.suit ? "block" : "none";
      if (i === G.suitIdx) d.scrollIntoView({ block: "nearest" });
    });
    const s = SUITS[G.suitIdx];
    $("suitName").textContent = s.name;
    $("suitInfo").innerHTML = (s.lvl > save.lvl ? `<b style="color:#ff6b6b">Odblokujesz na poziomie ${s.lvl}</b><br>` : s.id === save.suit ? '<b style="color:#3fe3ff">Za\u0142o\u017Cony</b><br>' : "") + s.desc;
  }
  function equip(i) {
    const s = SUITS[i];
    if (s.lvl > save.lvl) {
      sfx("hurt", 0.3);
      refreshSuits();
      return;
    }
    setSuit(s.id);
    sfx("ui");
    refreshSuits();
  }
  function updateSuits(dt, N) {
    let i = G.suitIdx;
    if (N.left) i--;
    if (N.right) i++;
    if (N.up) i -= 5;
    if (N.down) i += 5;
    i = clamp(i, 0, SUITS.length - 1);
    if (i !== G.suitIdx) {
      G.suitIdx = i;
      refreshSuits();
      sfx("ui");
    }
    if (N.ok) equip(G.suitIdx);
    suitView(dt);
  }
  function suitView(dt) {
    const c = $("suitView");
    if (!SV) {
      const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
      r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
      r.outputEncoding = THREE.sRGBEncoding;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      sc.add(new THREE.HemisphereLight(14677247, 2109504, 0.9));
      const d1 = new THREE.DirectionalLight(16777215, 1.1);
      d1.position.set(2, 3, 4);
      sc.add(d1);
      const d2 = new THREE.DirectionalLight(4187135, 0.7);
      d2.position.set(-3, 2, -3);
      sc.add(d2);
      const ca = new THREE.PerspectiveCamera(26, 1, 0.1, 50);
      ca.position.set(0, 1, 4.8);
      ca.lookAt(0, 0.92, 0);
      SV = { r, sc, ca, model: null, id: null, rot: 0, w: 0, h: 0 };
    }
    const w = c.clientWidth, h = c.clientHeight;
    if (w && h && (w !== SV.w || h !== SV.h)) {
      SV.w = w;
      SV.h = h;
      SV.r.setSize(w, h, false);
      SV.ca.aspect = w / h;
      SV.ca.updateProjectionMatrix();
    }
    const s = SUITS[G.suitIdx];
    if (SV.id !== s.id) {
      if (SV.model) SV.sc.remove(SV.model.root);
      SV.model = buildSpider(s);
      linearize(SV.model.root);
      const p = newPose();
      p.sLz = 0.3;
      p.sRz = -0.3;
      p.eL = -0.15;
      p.eR = -0.15;
      p.hLz = 0.07;
      p.hRz = -0.07;
      applyPose(SV.model, p);
      SV.sc.add(SV.model.root);
      SV.id = s.id;
    }
    SV.rot += dt * 0.7;
    SV.model.root.rotation.y = Math.sin(SV.rot) * 0.9;
    SV.r.render(SV.sc, SV.ca);
  }
  function renderMoves() {
    const ps = pad.type === "ps" ? "ps" : "xbox";
    const R2 = [
      ["Chodzenie i bieg", kk("L-GA\u0141KA"), kk("W") + kk("A") + kk("S") + kk("D")],
      ["Kamera", kk("P-GA\u0141KA"), kk("MYSZ")],
      ["Skok", key("jump", ps), kk("SPACJA")],
      ["Bujanie na sieci \u2014 przytrzymaj w powietrzu", key("swing", ps), kk("SHIFT")],
      ["Bieg parkour \u2014 przytrzymaj na ziemi", key("swing", ps), kk("SHIFT")],
      ["Bieg po \u015Bcianie \u2014 wbiegnij w \u015Bcian\u0119 trzymaj\u0105c", key("swing", ps), kk("SHIFT")],
      ["Zaczep \u2014 lot na kraw\u0119d\u017A dachu (celuj kamer\u0105 w k\xF3\u0142ko)", key("special", ps), kk("E")],
      ["Wybicie z zaczepu \u2014 skok w chwili dolotu", key("jump", ps), kk("SPACJA")],
      ["Skok z sieci / odbicie od \u015Bciany / zip w powietrzu", key("jump", ps), kk("SPACJA")],
      ["Cios \u2014 naciskaj szybko, 4. cios to kopni\u0119cie z obrotu", key("punch", ps), kk("LPM") + kk("F")],
      ["Wybicie bandyty w g\xF3r\u0119 \u2014 przytrzymaj cios, potem skocz i bij w powietrzu", key("punch", ps), kk("LPM") + kk("F")],
      ["Trik w powietrzu (gdy nikogo nie ma obok)", key("punch", ps), kk("LPM") + kk("F")],
      ["Wyko\u0144czenie \u2014 gdy pasek skupienia jest pe\u0142ny", key("special", ps), kk("E")],
      ["Strza\u0142 sieci\u0105 \u2014 zawija bandyt\xF3w, og\u0142usza osi\u0142ki i Nosoro\u017Cca", key("web", ps), kk("PPM") + kk("R")],
      ["Unik \u2014 gdy nad g\u0142ow\u0105 b\u0142y\u015Bnie zmys\u0142 paj\u0105ka", key("dodge", ps), kk("C") + kk("CTRL")],
      ["Mapa", key("map", ps), kk("M") + kk("TAB")],
      ["Pauza", key("pause", ps), kk("ESC")]
    ];
    $("movesT").innerHTML = `<tr><th>RUCH</th><th>PAD</th><th>KLAWIATURA + MYSZ</th></tr>` + R2.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
  }
  function gameItems() {
    const base = [["tod", todLabel()], ["music", musLabel()], ["gfx", gfxLabel()]];
    return G.pauseFrom === "menu" ? [["back", "WR\xD3\u0106"], ...base] : [["resume", "WZN\xD3W GR\u0118"], ...SLOTS.map((n) => ["sv" + n, slotLabel(n, "ZAPISZ W SLOCIE")]), ...SLOTS.map((n) => ["ld" + n, slotLabel(n, "WCZYTAJ ZAPIS")]), ...base, ["new", newLabel()], ["menu", "MENU G\u0141\xD3WNE"]];
  }
  function renderGame() {
    const it = gameItems(), L = $("gameList");
    G.gameIdx = clamp(G.gameIdx, 0, it.length - 1);
    if (L.children.length !== it.length) {
      L.innerHTML = it.map(() => '<div class="mi"></div>').join("");
      [...L.children].forEach((d, i) => {
        d.onmouseenter = () => {
          G.gameIdx = i;
          renderGame();
        };
        d.onclick = () => gameAct(gameItems()[i][0]);
      });
    }
    [...L.children].forEach((d, i) => {
      if (d.innerHTML !== it[i][1]) d.innerHTML = it[i][1];
      d.classList.toggle("f", i === G.gameIdx);
    });
    $("gameStats").innerHTML = `Poziom: <b>${save.lvl}</b><br>Udaremnione przest\u0119pstwa: <b>${save.crimes}</b><br>Znalezione plecaki: <b>${save.bags.length} / ${BAGS_N}</b><br>Pokonany Nosoro\u017Cec: <b>${save.bossWins}\xD7</b><br>Zatrzymane auta: <b>${save.chases}</b><br>Og\xF3lne post\u0119py: <b>${progress()}%</b>`;
  }
  function gameAct(a) {
    sfx("ui");
    if (a[0] === "s" && a[1] === "v") {
      slotSave(+a[2]);
      renderGame();
      return;
    }
    if (a[0] === "l" && a[1] === "d") {
      slotLoad(+a[2]);
      return;
    }
    if (a === "new") {
      confirmNew(renderGame);
      return;
    }
    if (a === "resume" || a === "back") closePause();
    else if (a === "gfx") {
      hooks.gfx();
      renderGame();
    } else if (a === "tod") {
      hooks.tod();
      renderGame();
    } else if (a === "music") {
      hooks.music();
      renderGame();
    } else if (a === "menu") {
      $("pause").classList.add("hidden");
      hooks.toMenu();
    }
  }
  function updateGame(N) {
    const n = gameItems().length;
    if (N.up) {
      G.gameIdx = (G.gameIdx + n - 1) % n;
      renderGame();
    }
    if (N.down) {
      G.gameIdx = (G.gameIdx + 1) % n;
      renderGame();
    }
    if (N.ok) gameAct(gameItems()[G.gameIdx][0]);
  }
  function initUI() {
    G.splash = true;
    {
      const c = cv(192, 192), x = c.getContext("2d"), im = x.createImageData(192, 192);
      for (let i = 0; i < im.data.length; i += 4) {
        const v = Math.random() * 255 | 0;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = v;
        im.data[i + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      const g = document.createElement("div");
      g.id = "grain";
      g.style.backgroundImage = "url(" + c.toDataURL() + ")";
      document.body.appendChild(g);
    }
    const st = document.createElement("style");
    st.textContent = CSS;
    document.head.appendChild(st);
    const wrap = document.createElement("div");
    wrap.innerHTML = HTML;
    while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
    try {
      if (sessionStorage.getItem("sp_skip")) {
        sessionStorage.removeItem("sp_skip");
        G.splash = false;
        const t = $("tytul");
        if (t) t.remove();
      }
    } catch (e) {
    }
    buildMiniBase();
    renderMenu();
    const mc = $("mapc");
    let drag = null;
    mc.addEventListener("mousedown", (e) => {
      if (e.button === 0) drag = { x: e.clientX, y: e.clientY, m: false };
    });
    addEventListener("mousemove", (e) => {
      if (!drag) return;
      if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.m = true;
      if (drag.m) {
        mapV.cx -= e.movementX / mapV.zoom;
        mapV.cz -= e.movementY / mapV.zoom;
      }
    });
    addEventListener("mouseup", (e) => {
      if (drag && !drag.m && G.state === "pause" && G.pauseTab === "map") {
        const r = mc.getBoundingClientRect();
        setWP(mapV.cx + (e.clientX - r.left - mc.width / 2) / mapV.zoom, mapV.cz + (e.clientY - r.top - mc.height / 2) / mapV.zoom);
      }
      drag = null;
    });
    canvas.addEventListener("click", () => {
      if (G.state === "play" && G.mode === "kb" && document.pointerLockElement !== canvas) lockMouse();
    });
  }
  function showHUD(on) {
    $("hud").classList.toggle("hidden", !on);
    $("menu").classList.toggle("hidden", on);
    if (!on) renderMenu();
  }
  var CSS, HTML, GLY, kk, msgT, dmgT, distT, distChk, promptT, lastPrompt, lastDist, popT, hintT, hintsShown, icoCrime, icoWP, progress, miniBase, MM, LN, _p, set, _sf, _so, flareK, gfxLabel, todLabel, musLabel, SLOTS, slotKey, fmtT, askNew, newLabel, footTxt, TABS, mapV, SV;
  var init_ui = __esm({
    "js/ui.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_postac();
      init_gracz();
      init_wrogowie();
      init_misje();
      init_wnetrza();
      init_umiejetnosci();
      init_wejscie();
      init_dzwiek();
      CSS = `
:root{--cy:#3fe3ff;--red:#e3242b;--gold:#ffc93c}
#c{position:fixed;inset:0;width:100vw;height:100vh;display:block}
body{overflow:hidden;color:#fff;font-family:'Rajdhani',sans-serif;user-select:none}
.hidden{display:none!important}
.key{display:inline-flex;align-items:center;justify-content:center;min-width:28px;height:24px;padding:0 7px;margin:0 5px;border:2px solid rgba(255,255,255,.9);border-radius:6px;font-weight:700;font-size:14px;line-height:1;background:rgba(0,0,0,.5);vertical-align:middle;letter-spacing:0}
#hud{position:fixed;inset:0;pointer-events:none;z-index:5}
#hpWrap{position:absolute;left:34px;top:26px;width:330px}
#hpBar{height:16px;background:rgba(0,0,0,.55);transform:skewX(-24deg);border:1px solid rgba(255,255,255,.45);overflow:hidden}
#hpFill{height:100%;width:100%;background:linear-gradient(90deg,#d61f29,#ff5a60);transition:width .15s}
#focus{display:flex;gap:6px;margin-top:6px;transform:skewX(-24deg)}
#focus div{flex:1;height:8px;background:rgba(0,0,0,.55);border:1px solid rgba(63,227,255,.5);overflow:hidden}
#focus i{display:block;height:100%;width:0;background:var(--cy);box-shadow:0 0 8px var(--cy)}
#hpLbl{font-size:13px;letter-spacing:3px;margin-top:5px;font-weight:700;opacity:.85;text-shadow:0 1px 3px #000}
#combo{position:absolute;left:34px;top:92px;font-family:'Bebas Neue',Impact,sans-serif;font-size:48px;text-shadow:0 0 14px var(--cy),0 2px 4px #000;opacity:0;transition:opacity .2s}
#lvlBox{position:absolute;right:28px;top:20px;display:flex}
.lvN{background:var(--red);padding:3px 16px 1px 26px;clip-path:polygon(16px 0,100% 0,100% 100%,0 100%);text-align:center;line-height:1}
.lvN small{display:block;font-size:11px;letter-spacing:2px;font-weight:700}
.lvN b{font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;font-weight:400}
.lvX{background:rgba(0,0,0,.55);padding:8px 14px;min-width:190px}
#xpTxt{font-weight:700;font-size:16px;letter-spacing:1px}
#xpBar{height:4px;background:rgba(255,255,255,.18);margin-top:5px}#xpFill{height:100%;width:0;background:var(--cy)}
#skp{position:absolute;right:28px;top:78px;font-weight:700;font-size:15px;color:var(--gold);text-shadow:0 1px 3px #000}
#district{position:absolute;top:10vh;left:50%;transform:translateX(-50%);font-family:'Bebas Neue',Impact,sans-serif;font-size:58px;letter-spacing:6px;opacity:0;transition:opacity .7s;text-shadow:0 3px 20px rgba(0,0,0,.7);text-align:center;white-space:nowrap}
#district small{display:block;font-family:'Rajdhani';font-weight:700;font-size:15px;letter-spacing:6px;color:var(--cy);margin-top:-6px}
#msg{position:absolute;top:30vh;left:50%;transform:translateX(-50%);text-align:center;opacity:0;transition:opacity .3s;white-space:nowrap}
#msg .t{font-family:'Bebas Neue',Impact,sans-serif;font-size:44px;letter-spacing:3px;padding:2px 70px;background:linear-gradient(90deg,transparent,rgba(200,20,28,.88) 20%,rgba(200,20,28,.88) 80%,transparent)}
#msg .s{font-size:21px;font-weight:600;margin-top:8px;text-shadow:0 2px 6px #000}
#pop{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;letter-spacing:3px;color:#fff;text-shadow:0 0 16px var(--cy),0 2px 5px #000;opacity:0;transition:opacity .25s,transform .25s}
#hint{position:absolute;left:50%;bottom:120px;transform:translateX(-50%);max-width:640px;padding:10px 20px;background:rgba(5,20,30,.85);border-left:4px solid var(--gold);font-weight:600;font-size:18px;opacity:0;transition:opacity .4s}
#bossBar{position:absolute;left:50%;top:22px;transform:translateX(-50%);width:min(560px,60vw);text-align:center}
#bossBar b{font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;letter-spacing:4px;text-shadow:0 2px 6px #000}
#bossBar .bb{height:14px;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.5);margin-top:2px}
#bossBar .bb i{display:block;height:100%;background:linear-gradient(90deg,#8a1be0,#e3242b);transition:width .2s}
#bossBar small{font-weight:700;letter-spacing:2px;color:var(--gold)}
#racePan{position:absolute;left:50%;top:18px;transform:translateX(-50%);text-align:center;background:rgba(0,0,0,.5);padding:6px 26px;border-bottom:3px solid var(--cy)}
#racePan b{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;letter-spacing:2px}
#racePan small{display:block;font-weight:700;letter-spacing:2px;color:var(--cy)}
#mini{position:absolute;left:28px;bottom:28px;width:210px;height:210px;border-radius:50%;box-shadow:0 0 0 3px rgba(63,227,255,.55),0 8px 24px rgba(0,0,0,.5)}
#prompts{position:absolute;right:30px;bottom:28px;text-align:right;font-weight:700;font-size:18px;text-shadow:0 2px 4px #000;line-height:2}
.mk{position:absolute;left:0;top:0;font-weight:700;font-size:14px;text-align:center;text-shadow:0 1px 3px #000;white-space:nowrap;display:none}
.mk .d{width:20px;height:20px;margin:0 auto 4px;transform:rotate(45deg);border:2px solid #fff;font-size:0}
#crimeMk .d{background:var(--red)} #wpMk .d{background:var(--cy)} #chaseMk .d{background:#ff8a1e} #bossMk .d{background:#8a1be0}
#perch{position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 10px var(--cy);display:none;text-align:center}
#perch .key{position:absolute;left:50%;top:40px;transform:translateX(-50%);margin:0}
#perch:after{content:'';position:absolute;left:9px;top:9px;width:10px;height:10px;border-radius:50%;background:var(--cy)}
#reticle{position:absolute;left:0;top:0;width:30px;height:30px;border:2px solid var(--cy);opacity:0;transition:opacity .15s;box-shadow:0 0 8px var(--cy)}
#sense{position:absolute;left:0;top:0;width:110px;height:60px;opacity:0;transition:opacity .08s}
#speedfx{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(255,255,255,.2) 100%);opacity:0}
#lines{position:absolute;inset:0;width:100%;height:100%;opacity:0}
#dmg{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 40%,rgba(200,0,0,.65) 100%);opacity:0;transition:opacity .35s}
#lockHint{position:absolute;left:50%;top:62%;transform:translateX(-50%);padding:10px 24px;background:rgba(0,0,0,.65);font-weight:700;font-size:20px;border:1px solid var(--cy)}
#grain{position:fixed;inset:-50%;z-index:5;pointer-events:none;opacity:.07;mix-blend-mode:overlay;animation:grain .5s steps(4) infinite}
@keyframes grain{0%{transform:translate(0,0)}25%{transform:translate(-7%,4%)}50%{transform:translate(5%,-6%)}75%{transform:translate(-3%,8%)}100%{transform:translate(0,0)}}
#vig{position:fixed;inset:0;z-index:4;pointer-events:none;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(8,6,14,.42) 100%)}
#flare{position:fixed;left:0;top:0;width:520px;height:520px;margin:-260px 0 0 -260px;z-index:4;pointer-events:none;opacity:0;background:radial-gradient(circle,rgba(255,236,200,.55) 0%,rgba(255,200,130,.22) 18%,rgba(255,170,90,.08) 40%,rgba(255,170,90,0) 62%),radial-gradient(circle at 70% 70%,rgba(160,200,255,.14) 0,rgba(160,200,255,0) 8%)}
#tytul{position:fixed;inset:0;z-index:40;background:#05090f radial-gradient(ellipse at 50% 40%,#2a1a3a,#05090f 70%);transition:opacity .9s;cursor:pointer}
#tytul.off{opacity:0;pointer-events:none}
#tytul img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#tytul:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.25) 0%,rgba(0,0,0,0) 35%,rgba(0,0,0,.6) 100%)}
#tytul .tt{position:absolute;left:0;right:0;top:11vh;text-align:center;z-index:2;text-shadow:0 6px 40px rgba(0,0,0,.7)}
#tytul .tt b{display:block;font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:clamp(70px,14vw,200px);line-height:.85;letter-spacing:4px}
#tytul .tt b i{font-style:normal;color:var(--red)}
#tytul .tt span{display:block;font-weight:700;font-size:clamp(16px,2.2vw,28px);letter-spacing:14px;color:var(--cy);margin-top:12px}
#tytul .tp{position:absolute;left:0;right:0;bottom:7vh;text-align:center;z-index:2;font-weight:700;font-size:22px;letter-spacing:4px;animation:mig 1.6s ease-in-out infinite}
@keyframes mig{50%{opacity:.35}}
#fade{position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:20;transition:opacity .6s}
#menu{position:fixed;inset:0;z-index:10;background:linear-gradient(90deg,rgba(3,10,18,.9) 0%,rgba(3,10,18,.55) 38%,transparent 64%)}
#logo{position:absolute;left:7vw;top:8vh}
#logo .t1{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(48px,min(9.5vw,15vh),140px);line-height:.85;letter-spacing:2px;text-shadow:0 6px 30px rgba(0,0,0,.6)}
#logo .t1 span{color:var(--red)}
#logo .t2{font-size:20px;font-weight:700;letter-spacing:12px;color:var(--cy);margin-top:10px}
#menuList{position:absolute;left:7vw;top:max(33vh,190px);display:flex;flex-direction:column;gap:2px}
.mi{font-family:'Bebas Neue',Impact,sans-serif;font-size:clamp(20px,4.6vh,34px);letter-spacing:2px;padding:3px 44px 0 18px;color:rgba(255,255,255,.72);cursor:pointer;clip-path:polygon(0 0,100% 0,calc(100% - 18px) 100%,0 100%);transition:background .12s,padding .12s}
.mi small{font-family:'Rajdhani';font-weight:600;font-size:17px;letter-spacing:1px;margin-left:10px;opacity:.85}
.mi.f{background:var(--red);color:#fff;padding-left:30px}
#menuFoot{position:absolute;left:7vw;bottom:4vh;font-size:17px;font-weight:600;color:#bfe9f5;line-height:1.6}
#pause{position:fixed;inset:0;z-index:12;background:rgba(3,12,20,.94)}
#tabs{position:absolute;left:0;right:0;top:0;height:56px;display:flex;align-items:center;gap:2px;padding-left:20px;background:linear-gradient(#050d14,#08151f);border-bottom:2px solid rgba(63,227,255,.25);overflow:hidden}
.tab{font-family:'Bebas Neue',Impact,sans-serif;font-size:25px;letter-spacing:1px;padding:9px 20px 4px;cursor:pointer;color:#cfe9f2;clip-path:polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%);white-space:nowrap}
.tab.on{background:var(--red);color:#fff}
.tab sup{color:var(--gold);font-family:'Rajdhani';font-weight:700;font-size:14px}
#pLvl{margin-left:auto;margin-right:20px;display:flex;align-items:center;gap:12px;font-weight:700;letter-spacing:1px;white-space:nowrap}
#pLvl b{font-family:'Bebas Neue',Impact,sans-serif;font-size:34px;font-weight:400;color:#fff;background:var(--red);padding:0 14px;clip-path:polygon(10px 0,100% 0,100% 100%,0 100%)}
.page{position:absolute;left:0;right:0;top:58px;bottom:48px}
#pauseFoot{position:absolute;left:0;right:0;bottom:0;height:48px;display:flex;justify-content:flex-end;gap:28px;align-items:center;padding:0 30px;background:#050d14;font-weight:700;letter-spacing:1px}
#mapc{position:absolute;inset:0;width:100%;height:100%;cursor:crosshair}
#mapDist{position:absolute;left:26px;top:22px;min-width:330px;padding:8px 18px;border:2px solid var(--cy);background:rgba(4,30,42,.85);color:var(--cy);font-family:'Bebas Neue',Impact,sans-serif;font-size:30px;letter-spacing:2px}
#mapProg{position:absolute;left:26px;bottom:22px;min-width:330px;padding:10px 18px;border:2px solid rgba(63,227,255,.6);background:rgba(4,30,42,.85);font-weight:700;font-size:20px;letter-spacing:2px;display:flex;justify-content:space-between}
#mapProg b{color:var(--cy)}
#mapLeg{position:absolute;right:26px;top:22px;padding:12px 18px;background:rgba(4,30,42,.85);border:1px solid rgba(63,227,255,.4);font-weight:600;line-height:1.9}
#mapLeg i{display:inline-block;width:12px;height:12px;margin-right:10px;transform:rotate(45deg)}
#pg-suits,#pg-skills,#pg-miss{background:radial-gradient(ellipse at 72% 50%,#0f3645,#04121b 70%)}
#suitPanel{position:absolute;left:3vw;top:3vh;width:min(58vw,780px);bottom:3vh;border:1px solid rgba(63,227,255,.45);padding:18px;background:rgba(4,20,30,.6);overflow:auto}
.sh{display:flex;justify-content:space-between;color:var(--cy);font-size:22px;font-weight:700;letter-spacing:2px;border-bottom:1px solid rgba(63,227,255,.4);padding-bottom:8px;margin-bottom:16px}
#suitGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
.card{position:relative;aspect-ratio:3/2;border:1px solid rgba(63,227,255,.35);cursor:pointer;background:#061a26}
.card img{width:100%;height:100%;display:block}
.card.f{outline:3px solid var(--cy);outline-offset:3px}
.card.lock img{filter:grayscale(1) brightness(.35)}
.card .lk{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;font-size:13px;letter-spacing:1px}
.card .eq{position:absolute;right:5px;bottom:1px;color:var(--cy);font-size:22px;text-shadow:0 0 6px #000}
#suitRight{position:absolute;left:calc(3vw + min(58vw,780px) + 24px);right:2vw;top:3vh;bottom:3vh;display:flex;flex-direction:column}
#suitView{flex:1;width:100%;min-height:0}
#suitName,#skName,#miName{font-family:'Bebas Neue',Impact,sans-serif;font-size:40px;letter-spacing:1px}
#suitInfo,#skInfo,#miInfo{font-size:18px;color:#bfe0ea;min-height:54px;line-height:1.5}
#skPanel{position:absolute;left:3vw;right:3vw;top:3vh;bottom:22vh;display:grid;grid-template-columns:repeat(4,1fr);gap:22px}
.skc h4{color:var(--cy);letter-spacing:3px;font-size:18px;margin:0 0 10px;border-bottom:1px solid rgba(63,227,255,.4);padding-bottom:6px}
.sk{position:relative;padding:12px 14px;margin-bottom:12px;border:1px solid rgba(63,227,255,.3);background:rgba(4,20,30,.7);cursor:pointer;font-weight:700;letter-spacing:1px}
.sk.own{background:rgba(63,227,255,.18);border-color:var(--cy)}
.sk.can{border-color:var(--gold)}
.sk.no{opacity:.45}
.sk.f{outline:3px solid #fff;outline-offset:2px}
.sk small{display:block;font-weight:600;letter-spacing:0;color:#bfe0ea;font-size:14px;margin-top:3px}
#skBottom{position:absolute;left:3vw;right:3vw;bottom:3vh;height:16vh;padding:14px 20px;border-top:2px solid var(--cy);background:rgba(4,20,30,.6)}
#miList{position:absolute;left:3vw;top:3vh;width:min(46vw,640px);bottom:3vh;overflow:auto}
.mis{padding:14px 18px;margin-bottom:10px;border:1px solid rgba(63,227,255,.3);background:rgba(4,20,30,.7);cursor:pointer}
.mis b{font-family:'Bebas Neue',Impact,sans-serif;font-size:28px;letter-spacing:1px}
.mis small{display:block;font-weight:700;color:var(--gold);letter-spacing:1px}
.mis.f{outline:3px solid var(--cy);outline-offset:2px}
#miRight{position:absolute;left:calc(3vw + min(46vw,640px) + 30px);right:3vw;top:3vh}
#pg-moves{overflow:auto}
#movesT{margin:26px auto;border-collapse:collapse;min-width:min(900px,92vw)}
#movesT td,#movesT th{padding:8px 18px;border-bottom:1px solid rgba(63,227,255,.18);font-size:18px;font-weight:600;text-align:left}
#movesT th{color:var(--cy);letter-spacing:2px;font-size:16px}
#pg-game{display:flex;flex-direction:column;align-items:flex-start;padding:8vh 8vw;gap:8px}
#gameStats{margin-top:30px;font-size:20px;font-weight:600;line-height:1.8;color:#cfe9f2}
`;
      HTML = `
<div id="hud" class="hidden">
  <div id="hpWrap"><div id="hpBar"><div id="hpFill"></div></div><div id="focus"><div><i></i></div><div><i></i></div><div><i></i></div></div><div id="hpLbl">ZDROWIE \xB7 SKUPIENIE</div></div>
  <div id="combo"></div>
  <div id="lvlBox"><div class="lvN"><small>POZIOM</small><b id="lvlNum">1</b></div><div class="lvX"><div id="xpTxt"></div><div id="xpBar"><div id="xpFill"></div></div></div></div>
  <div id="skp"></div>
  <div id="bossBar" class="hidden"><b>NOSORO\u017BEC</b><div class="bb"><i></i></div><small></small></div>
  <div id="racePan" class="hidden"><b></b><small></small></div>
  <div id="district"><span id="distName"></span><small>NOWY JORK</small></div>
  <div id="msg"><div class="t" id="msgT"></div><div class="s" id="msgS"></div></div>
  <div id="pop"></div>
  <div id="hint"></div>
  <canvas id="lines"></canvas>
  <canvas id="mini" width="220" height="220"></canvas>
  <div id="prompts"></div>
  <div id="crimeMk" class="mk"><div class="d"></div><div class="l"></div></div>
  <div id="chaseMk" class="mk"><div class="d"></div><div class="l"></div></div>
  <div id="bossMk" class="mk"><div class="d"></div><div class="l"></div></div>
  <div id="wpMk" class="mk"><div class="d"></div><div class="l"></div></div>
  <div id="perch"><span class="key"></span></div>
  <div id="reticle"></div>
  <div id="sense"><svg viewBox="0 0 110 60" width="110" height="60" fill="none" stroke="#ff3b3b" stroke-width="3.5" stroke-linecap="round">
    <path d="M55 58 L50 44 L58 34 L51 20 L57 4"/><path d="M40 58 L30 48 L34 36 L22 28 L24 14"/><path d="M70 58 L80 48 L76 36 L88 28 L86 14"/>
    <path d="M28 60 L14 54 L12 42 L2 36"/><path d="M82 60 L96 54 L98 42 L108 36"/></svg></div>
  <div id="speedfx"></div>
  <div id="dmg"></div>
  <div id="lockHint" class="hidden">Kliknij, aby sterowa\u0107 mysz\u0105</div>
</div>
<div id="menu">
  <div id="logo"><div class="t1">SPIDER<span>-</span>MAN</div><div class="t2">NOWY JORK</div></div>
  <div id="menuList"></div>
  <div id="menuFoot"></div>
</div>
<div id="pause" class="hidden">
  <div id="tabs"></div>
  <div class="page" id="pg-map"><canvas id="mapc"></canvas><div id="mapDist"></div><div id="mapProg"></div>
    <div id="mapLeg"><div><i style="background:#fff"></i>Spider-Man</div><div><i style="background:#e3242b"></i>Przest\u0119pstwo</div><div><i style="background:#8a1be0"></i>Nosoro\u017Cec</div><div><i style="background:#fff"></i>Kingpin</div><div><i style="background:#ffc93c"></i>Wyzwanie</div><div><i style="background:#ff8a1e"></i>Po\u015Bcig</div><div><i style="background:#f5d76e;border-radius:50%"></i>Plecak</div><div><i style="background:#3fe3ff"></i>Tw\xF3j znacznik</div></div></div>
  <div class="page" id="pg-skills"><div id="skPanel"></div><div id="skBottom"><div id="skName"></div><div id="skInfo"></div></div></div>
  <div class="page" id="pg-miss"><div id="miList"></div><div id="miRight"><div id="miName"></div><div id="miInfo"></div></div></div>
  <div class="page" id="pg-suits"><div id="suitPanel"><div class="sh"><span>STR\xD3J</span><span id="suitPct"></span></div><div id="suitGrid"></div></div>
    <div id="suitRight"><canvas id="suitView"></canvas><div id="suitName"></div><div id="suitInfo"></div></div></div>
  <div class="page" id="pg-moves"><table id="movesT"></table></div>
  <div class="page" id="pg-game"><div id="gameList"></div><div id="gameStats"></div></div>
  <div id="pauseFoot"></div>
</div>
<div id="vig"></div><div id="flare"></div>
<div id="tytul"><img src="tytul.jpg" alt="" onerror="this.style.display='none'"><div class="tt"><b>SPIDER<i>-</i>MAN</b><span>NOWY JORK</span></div><div class="tp">NACI\u015ANIJ DOWOLNY PRZYCISK</div></div>
<div id="fade"></div>`;
      GLY = {
        xbox: { jump: "A", dodge: "B", punch: "X", web: "RB", swing: "RT", special: "Y", map: "VIEW", pause: "MENU", ok: "A", back: "B", y: "Y", lb: "LB", rb: "RB", lt: "LT", rt: "RT" },
        ps: { jump: "\u2715", dodge: "\u25CB", punch: "\u25A1", web: "R1", swing: "R2", special: "\u25B3", map: "SHARE", pause: "OPTIONS", ok: "\u2715", back: "\u25CB", y: "\u25B3", lb: "L1", rb: "R1", lt: "L2", rt: "R2" },
        kb: { jump: "SPACJA", dodge: "C", punch: "LPM", web: "PPM", swing: "SHIFT", special: "E", map: "M", pause: "ESC", ok: "ENTER", back: "ESC", y: "X", lb: "Q", rb: "E", lt: "\u2212", rt: "+" }
      };
      kk = (t) => `<span class="key">${t}</span>`;
      msgT = 0;
      dmgT = 0;
      distT = 0;
      distChk = 0;
      promptT = 0;
      lastPrompt = "";
      lastDist = "";
      popT = 0;
      hintT = 0;
      hintsShown = /* @__PURE__ */ new Set();
      icoCrime = (x, a, b, s) => icoDiamond(x, a, b, s, "#e3242b", "!");
      icoWP = (x, a, b, s) => icoDiamond(x, a, b, s, "#3fe3ff");
      progress = () => Math.round(save.bags.length / BAGS_N * 35 + Math.min(save.crimes, 30) / 30 * 35 + Math.min(save.bossWins, 1) * 10 + Object.keys(save.races).length / 3 * 10 + Math.min(save.chases, 5) / 5 * 10);
      miniBase = null;
      MM = { x0: LAND.x0 - 320, z0: LAND.z0 - 320 };
      LN = Array.from({ length: 40 }, () => ({ a: Math.random() * 6.283, r: Math.random(), l: 0.1 + Math.random() * 0.2 }));
      _p = new V3();
      set = (id, prop, v) => {
        const e = $(id);
        if (e.style[prop] !== v) e.style[prop] = v;
      };
      _sf = new V3();
      _so = new V3();
      flareK = 0;
      gfxLabel = () => "GRAFIKA: " + (save.gfx === "high" ? "WYSOKA" : "NISKA");
      todLabel = () => "PORA DNIA: " + TOD_NAMES[save.tod];
      musLabel = () => "MUZYKA: " + (save.music ? "W\u0141\u0104CZONA" : "WY\u0141\u0104CZONA");
      SLOTS = [1, 2, 3];
      slotKey = (n) => "spiderman_nyc_slot" + n;
      fmtT = (ts) => new Date(ts).toLocaleString("pl-PL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
      askNew = -9999;
      newLabel = () => performance.now() - askNew < 4e3 ? "NA PEWNO? POST\u0118P ZNIKNIE" : G.started || save.hasGame ? "NOWA GRA <small>kasuje post\u0119p</small>" : "NOWA GRA";
      footTxt = "";
      TABS = [["map", "MAPA"], ["skills", "UMIEJ\u0118TNO\u015ACI"], ["miss", "MISJE"], ["suits", "STROJE"], ["moves", "LISTA RUCH\xD3W"], ["game", "GRA"]];
      mapV = { cx: 0, cz: 0, zoom: 1 };
      SV = null;
    }
  });

  // js/wnetrza.js
  function tex2(name, w, h, draw, rep = true) {
    if (tcache[name]) return tcache[name];
    const c = cv(w, h), x = c.getContext("2d");
    draw(x, w, h);
    return tcache[name] = canvasTex(c, rep);
  }
  function speck(x, w, h, n, a, sz = 2) {
    for (let i = 0; i < n; i++) {
      x.fillStyle = R() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
      x.fillRect(R() * w, R() * h, sz, sz);
    }
  }
  function grainLines(x, x0, y0, w, h, hue, l, n = 14) {
    for (let k = 0; k < n; k++) {
      x.strokeStyle = hsl(hue, 45, l + rr(-10, 4), rr(0.15, 0.4));
      x.lineWidth = rr(0.6, 1.8);
      x.beginPath();
      const y = y0 + rr(1, h - 1), f = rr(0.01, 0.04), a = rr(0.5, 2.5);
      x.moveTo(x0, y);
      for (let q = x0; q <= x0 + w; q += 8) x.lineTo(q, y + Math.sin(q * f + k) * a);
      x.stroke();
    }
  }
  function envTex(k) {
    if (ENVT[k]) return ENVT[k];
    const E = ENVK[k], s = new THREE.Scene(), W = 12, D = 10, H = 3.6, y0 = -1.5;
    const bm = (c) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), side: THREE.BackSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), [bm(E.wall), bm(E.wall), bm(E.ceil), bm(E.floor), bm(E.wall), bm([E.wall[0] * 1.3, E.wall[1] * 1.25, E.wall[2] * 1.2])]);
    room.position.y = y0 + H / 2;
    s.add(room);
    const lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(...E.lamp) });
    for (let i = 0; i < E.n; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.5), lm), row = E.n > 3 ? Math.floor(i / 3) : 0.5;
      l.position.set((i % 3 - 1) * 3.8, y0 + H - 0.04, (row - 0.5) * 4.2);
      s.add(l);
    }
    if (E.neon) {
      const n = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.6, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(...E.neon) }));
      n.position.set(0, y0 + 2.8, D / 2 - 0.1);
      s.add(n);
    }
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      ENVT[k] = pm.fromScene(s, 0.02, 0.1, 50).texture;
      pm.dispose();
    } catch (e) {
      ENVT[k] = null;
    }
    return ENVT[k];
  }
  function patchInt(sh) {
    if (!LIGHTS_INT) LIGHTS_INT = THREE.ShaderChunk.lights_fragment_begin.replace(/#if \( NUM_DIR_LIGHTS > 0 \)[\s\S]*?#endif\n(?=#if \( NUM_RECT_AREA_LIGHTS)/, "").replace("irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );", "").replace("getAmbientLightIrradiance( ambientLightColor )", "vec3( 0.0 )");
    sh.vertexShader = "varying float vWY;\n" + sh.vertexShader.replace("#include <project_vertex>", "#include <project_vertex>\nvec4 wyP = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nwyP = instanceMatrix * wyP;\n#endif\nvWY = ( modelMatrix * wyP ).y;");
    sh.fragmentShader = "varying float vWY;\n" + sh.fragmentShader.replace("#include <lights_fragment_begin>", LIGHTS_INT).replace("#include <aomap_fragment>", AO_GLSL + "\n#include <aomap_fragment>");
  }
  function matFor(name, env) {
    const k = name + "|" + env;
    if (mats[k]) return mats[k];
    const D = MDEF[name], map = D.t ? TEX[D.t]() : null;
    let m;
    if (D.basic) {
      m = new THREE.MeshBasicMaterial({ map, vertexColors: true });
      if (D.add) Object.assign(m, { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    } else if (D.blob) {
      m = new THREE.MeshBasicMaterial({ map: TEX.blob(), color: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    } else {
      m = new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: D.r, metalness: D.m || 0 });
      if (D.glass) Object.assign(m, { transparent: true, opacity: D.glass, depthWrite: false });
      m.envMap = envTex(env);
      const ei = ENVK[env].i;
      Object.defineProperty(m, "envMapIntensity", { get: () => ei, set() {
      }, configurable: true });
      m.onBeforeCompile = patchInt;
    }
    m.userData.ts = D.ts || 0;
    return mats[k] = m;
  }
  function baseGeo(k) {
    if (BASE[k]) return BASE[k];
    let g;
    const p = k.split("_");
    if (k === "box") g = new THREE.BoxGeometry(1, 1, 1);
    else if (k === "plane") g = new THREE.PlaneGeometry(1, 1);
    else if (p[0] === "cyl") g = new THREE.CylinderGeometry(0.5 * +p[2], 0.5, 1, +p[1], 1);
    else if (p[0] === "sph") g = new THREE.SphereGeometry(0.5, +p[1], Math.max(4, Math.round(+p[1] * 0.6)));
    else if (k === "tor") g = new THREE.TorusGeometry(0.5, 0.06, 6, 20);
    return BASE[k] = g.toNonIndexed();
  }
  function emit(c, mat, gk, u, y, v, sx, sy, sz, rx, ry, rz, col, k, uvf) {
    _e.set(rx, ry, rz, "XYZ");
    _q2.setFromEuler(_e);
    _p2.set(c.s * u, y, v);
    _sc.set(sx, sy, sz);
    emitM(c, mat, gk, _m4.compose(_p2, _q2, _sc).premultiply(c.F), col, k, uvf);
  }
  function emitM(c, mat, gk, m4, col, k, uvf) {
    const g = baseGeo(gk);
    let b = c.bk.get(mat);
    if (!b) c.bk.set(mat, b = { p: [], n: [], uv: [], c: [] });
    const _m42 = m4;
    _n3.getNormalMatrix(_m42);
    _col.set(col).convertSRGBToLinear();
    const cr2 = _col.r * k, cg = _col.g * k, cb = _col.b * k;
    const Pa = g.attributes.position.array, Na = g.attributes.normal.array, Ua = g.attributes.uv.array, n = Pa.length / 3;
    for (let i = 0; i < n; i++) {
      _v2.set(Pa[i * 3], Pa[i * 3 + 1], Pa[i * 3 + 2]).applyMatrix4(_m42);
      b.p.push(_v2.x, _v2.y, _v2.z);
      _v2.set(Na[i * 3], Na[i * 3 + 1], Na[i * 3 + 2]).applyMatrix3(_n3).normalize();
      b.n.push(_v2.x, _v2.y, _v2.z);
      if (uvf) uvf(i, Ua[i * 2], Ua[i * 2 + 1], b.uv);
      else b.uv.push(Ua[i * 2], Ua[i * 2 + 1]);
      b.c.push(cr2, cg, cb);
    }
  }
  function flush(c) {
    for (const [m, b] of c.bk) {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(b.p, 3));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(b.n, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(b.uv, 2));
      g.setAttribute("color", new THREE.Float32BufferAttribute(b.c, 3));
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, m);
      mesh.matrixAutoUpdate = false;
      if (m.transparent) mesh.renderOrder = m.blending === THREE.AdditiveBlending ? 3 : m.depthWrite === false && !m.map ? 2 : 1;
      c.rm.g.add(mesh);
    }
    c.bk.clear();
  }
  function makeCtx(d) {
    const r = d.room, ns = d.ns, g = new THREE.Group(), rm = { d, g, npcs: [], entered: false, yaw: 0 };
    const ud = ns ? new V3(1, 0, 0) : new V3(0, 0, 1), vd = ns ? new V3(0, 0, r.sIn) : new V3(r.sIn, 0, 0);
    const s = new V3().crossVectors(ud, new V3(0, 1, 0)).dot(vd) > 0 ? 1 : -1;
    const [ox, oz] = r.W(0, 0);
    const F2 = new THREE.Matrix4().makeBasis(ud.clone().multiplyScalar(s), new V3(0, 1, 0), vd).setPosition(ox, SW, oz);
    const env = ENV_OF[d.type];
    const c = { r, ns, rm, s, F: F2, env, bk: /* @__PURE__ */ new Map(), hw: r.cw / 2, cd: r.cd, ch: r.ch, du: d.c - r.uc, gw: d.gw, gh: d.gh - SW, world: (u, v) => r.W(u, v) };
    const M = (name) => matFor(name, env);
    c.solid = (u0, u1, v0, v1, y0, y1) => {
      const [ax0, az0] = r.W(u0, v0), [ax1, az1] = r.W(u1, v1);
      addBox({ x0: Math.min(ax0, ax1), x1: Math.max(ax0, ax1), y0: SW + y0, y1: SW + y1, z0: Math.min(az0, az1), z1: Math.max(az0, az1) });
    };
    const uvOf = (m, o, sx, sy, sz) => {
      if (o && o.cell) {
        const [x0, y0, x1, y1] = o.cell;
        return (i, u, v, out) => out.push(x0 + u * (x1 - x0), y0 + v * (y1 - y0));
      }
      const ts = o && o.ts || m.userData.ts;
      if (!ts || sx === void 0) return null;
      const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
      return (i, u, v, out) => {
        const f = i / 6 | 0;
        out.push(u * dims[f][0] / ts, v * dims[f][1] / ts);
      };
    };
    c.B = (u0, u1, v0, v1, y0, y1, mn, col = "#ffffff", o) => {
      const a0 = Math.min(u0, u1), a1 = Math.max(u0, u1), b0 = Math.min(v0, v1), b1 = Math.max(v0, v1), sx = a1 - a0, sy = y1 - y0, sz = b1 - b0;
      if (sx <= 0 || sy <= 0 || sz <= 0) return;
      const m = M(mn), oo = o === true ? null : o;
      emit(c, m, "box", (a0 + a1) / 2, (y0 + y1) / 2, (b0 + b1) / 2, sx, sy, sz, 0, 0, 0, col, oo && oo.k || 1, uvOf(m, oo, sx, sy, sz));
      if (o === true || oo && oo.col) c.solid(a0, a1, b0, b1, y0, y1);
    };
    c.Cy = (u, v, y0, y1, rad, mn, col = "#ffffff", o = {}) => {
      var _a4;
      const m = M(mn);
      emit(c, m, `cyl_${o.seg || 12}_${(_a4 = o.rt) != null ? _a4 : 1}`, u, (y0 + y1) / 2, v, 2 * rad, y1 - y0, 2 * rad, 0, 0, 0, col, o.k || 1, uvOf(m, o));
    };
    c.Ch = (u0, u1, v, y, rad, mn, col = "#ffffff", o = {}) => {
      var _a4;
      const m = M(mn);
      emit(c, m, `cyl_${o.seg || 10}_${(_a4 = o.rt) != null ? _a4 : 1}`, (u0 + u1) / 2, y, v, 2 * rad, Math.abs(u1 - u0), 2 * rad, 0, 0, Math.PI / 2, col, o.k || 1, uvOf(m, o));
    };
    c.Cv = (u, v0, v1, y, rad, mn, col = "#ffffff", o = {}) => {
      var _a4;
      const m = M(mn);
      emit(c, m, `cyl_${o.seg || 10}_${(_a4 = o.rt) != null ? _a4 : 1}`, u, y, (v0 + v1) / 2, 2 * rad, Math.abs(v1 - v0), 2 * rad, Math.PI / 2, 0, 0, col, o.k || 1, uvOf(m, o));
    };
    c.Sp = (u, y, v, ru, ry, rv, mn, col = "#ffffff", o = {}) => {
      const m = M(mn);
      emit(c, m, `sph_${o.seg || 10}`, u, y, v, 2 * ru, 2 * ry, 2 * rv, o.rx || 0, o.ry || 0, o.rz || 0, col, o.k || 1, uvOf(m, o));
    };
    c.T = (u, y, v, rad, mn, col = "#ffffff", o = {}) => {
      emit(c, M(mn), "tor", u, y, v, 2 * rad, 2 * rad, (o.th || 1) * 2 * rad, Math.PI / 2, 0, 0, col, o.k || 1, null);
    };
    const FACE = { "+v": [0, 0], "-v": [0, Math.PI], "+u": [0, s * Math.PI / 2], "-u": [0, -s * Math.PI / 2], up: [-Math.PI / 2, 0], down: [Math.PI / 2, 0] };
    c.Pl = (u, v, y, w, h, face, mn, col = "#ffffff", o = {}) => {
      const m = M(mn), [rx, ry] = FACE[face];
      emit(c, m, "plane", u, y, v, w, h, 1, rx, ry, 0, col, o.k || 1, uvOf(m, o));
    };
    c.L = { back: { ax: "u", b: c.cd - 0.05, dir: -1 }, front: { ax: "u", b: 0.05, dir: 1 }, left: { ax: "v", b: -c.hw + 0.05, dir: 1 }, right: { ax: "v", b: c.hw - 0.05, dir: -1 } };
    c.at = (L, a, d2) => L.ax === "u" ? [a, L.b + L.dir * d2] : [L.b + L.dir * d2, a];
    c.LB = (L, a0, a1, d0, d1, y0, y1, mn, col, o) => L.ax === "u" ? c.B(a0, a1, L.b + L.dir * d0, L.b + L.dir * d1, y0, y1, mn, col, o) : c.B(L.b + L.dir * d0, L.b + L.dir * d1, a0, a1, y0, y1, mn, col, o);
    c.LP = (L, a, d2, y, w, h, mn, col, o) => {
      const [u, v] = c.at(L, a, d2);
      c.Pl(u, v, y, w, h, L.ax === "u" ? L.dir > 0 ? "+v" : "-v" : L.dir > 0 ? "+u" : "-u", mn, col, o);
    };
    c.LC = (L, a, d2, y0, y1, rad, mn, col, o) => {
      const [u, v] = c.at(L, a, d2);
      c.Cy(u, v, y0, y1, rad, mn, col, o);
    };
    c.LH = (L, a0, a1, d2, y, rad, mn, col, o) => {
      if (L.ax === "u") c.Ch(a0, a1, L.b + L.dir * d2, y, rad, mn, col, o);
      else c.Cv(L.b + L.dir * d2, a0, a1, y, rad, mn, col, o);
    };
    c.LD = (L, a, d0, d1, y, rad, mn, col, o) => {
      if (L.ax === "u") c.Cv(a, L.b + L.dir * d0, L.b + L.dir * d1, y, rad, mn, col, o);
      else c.Ch(L.b + L.dir * d0, L.b + L.dir * d1, a, y, rad, mn, col, o);
    };
    c.LS = (L, a, d2, y, ra, ry, rd, mn, col, o) => {
      const [u, v] = c.at(L, a, d2);
      if (L.ax === "u") c.Sp(u, y, v, ra, ry, rd, mn, col, o);
      else c.Sp(u, y, v, rd, ry, ra, mn, col, o);
    };
    c.O = (u, v, fu, fv, a0, a1, b0, b1, y0, y1, mn, col, o) => {
      const us = [a0 * fv + b0 * fu, a1 * fv + b0 * fu, a0 * fv + b1 * fu, a1 * fv + b1 * fu], vs = [-a0 * fu + b0 * fv, -a1 * fu + b0 * fv, -a0 * fu + b1 * fv, -a1 * fu + b1 * fv];
      c.B(u + Math.min(...us), u + Math.max(...us), v + Math.min(...vs), v + Math.max(...vs), y0, y1, mn, col, o);
    };
    c.op = (u, v, fu, fv, a, b) => [u + a * fv + b * fu, v - a * fu + b * fv];
    c.pool = (u, v, w, dd, col, k, y = 0.012) => c.Pl(u, v, y, w, dd, "up", "pool", col, { k });
    c.blob = (u0, u1, v0, v1, y = 8e-3, gr = 0.25) => c.Pl((u0 + u1) / 2, (v0 + v1) / 2, y, Math.abs(u1 - u0) + 2 * gr, Math.abs(v1 - v0) + 2 * gr, "up", "blob");
    c.npc = (u, v, fu = 0, fv = -1, kind = "thug") => {
      const H = buildThug(kind, civ()), [x, z] = r.W(u, v), dx = ns ? fu : r.sIn * fv, dz = ns ? r.sIn * fv : fu;
      H.root.position.set(x, SW, z);
      H.root.rotation.y = Math.atan2(dx, dz);
      H.setHands("open", "open");
      g.add(H.root);
      rm.npcs.push({ H, t: rnd(0, 6), p: newPose() });
      return H;
    };
    return c;
  }
  function shell(c, o) {
    const { B, hw, cd, ch } = c, e = 0.05;
    const [fm, fc = "#ffffff"] = o.floor, [cm, cc = "#ffffff"] = o.ceil, [wm, wc = "#ffffff"] = o.wall, [km, kc = "#ffffff"] = o.back || o.wall;
    B(-hw, hw, 0, cd, -0.06, 4e-3, fm, fc);
    B(-hw, hw, 0, cd, ch - e, ch + 0.02, cm, cc);
    B(-hw, hw, cd - e, cd, 0, ch, km, kc);
    B(-hw, -hw + e, 0, cd, 0, ch, wm, wc);
    B(hw - e, hw, 0, cd, 0, ch, wm, wc);
    const g0 = c.du - c.gw / 2, g1 = c.du + c.gw / 2, gh = c.gh;
    B(-hw, g0, 0, e, 0, ch, wm, wc);
    B(g1, hw, 0, e, 0, ch, wm, wc);
    B(g0, g1, 0, e, gh, ch, wm, wc);
    const tc = o.trim || o.base;
    B(g0 - 0.09, g0, 0, e + 0.03, 0, gh + 0.09, "gloss", tc);
    B(g1, g1 + 0.09, 0, e + 0.03, 0, gh + 0.09, "gloss", tc);
    B(g0 - 0.09, g1 + 0.09, 0, e + 0.03, gh, gh + 0.09, "gloss", tc);
    const segs = [[c.L.back, -hw + e, hw - e], [c.L.left, e, cd - e], [c.L.right, e, cd - e], [c.L.front, -hw + e, g0 - 0.09], [c.L.front, g1 + 0.09, hw - e]];
    let off = 0;
    if (o.wains) {
      const [pm, pc, ph] = o.wains;
      off = 0.03;
      for (const [L, a0, a1] of segs) {
        c.LB(L, a0, a1, 0, 0.03, 0, ph, pm, pc);
        c.LB(L, a0, a1, 0, 0.055, ph, ph + 0.06, "grainG", pc);
      }
    }
    if (o.band) for (const [L, a0, a1] of segs) {
      const y = o.bandY || ch - 0.75;
      c.LB(L, a0, a1, 0, 6e-3, y, y + 0.22, "paint", o.band);
    }
    for (const [L, a0, a1] of segs) c.LB(L, a0, a1, off, off + 0.018, 0, 0.11, "gloss", o.base);
    if (o.crown) for (const [L, a0, a1] of segs) c.LB(L, a0, a1, 0, 0.05, ch - e - 0.09, ch - e, "gloss", o.crown);
  }
  function lampPanel(c, u, v, w = 1.2, d = 0.6, k = 2.2, tint = "#fff4e2", pool = 1) {
    const y = c.ch - 0.05;
    c.B(u - w / 2 - 0.04, u + w / 2 + 0.04, v - d / 2 - 0.04, v + d / 2 + 0.04, y - 0.02, y, "paint", "#cfcfcb");
    c.B(u - w / 2, u + w / 2, v - d / 2, v + d / 2, y - 0.03, y - 0.02, "panelL", tint, { k });
    if (pool) c.pool(u, v, 3.2 * pool, 3.2 * pool, tint, 0.12 * pool);
  }
  function pendant(c, u, v, drop, shadeCol = "#2b2b2b", rad = 0.2, k = 3, tint = "#ffd9a0", pool = 1, mn = "steel") {
    const y = c.ch - 0.05, yb = y - drop;
    c.Cy(u, v, yb + 0.2, y, 6e-3, "matte", "#111111", { seg: 4 });
    c.Cy(u, v, y - 0.03, y, 0.06, "steel", "#222222");
    c.Cy(u, v, yb, yb + 0.22, rad, mn, shadeCol, { rt: 0.28, seg: 16 });
    c.Cy(u, v, yb - 4e-3, yb, rad * 0.94, "lamp", tint, { seg: 16, k });
    if (pool) c.pool(u, v, 2.4 * pool, 2.4 * pool, tint, 0.16 * pool);
  }
  function plant(c, u, v, sz = 1, pot = "#e8e2d6", kind = "bush") {
    c.Cy(u, v, 0, 0.42 * sz, 0.2 * sz, "gloss", pot, { rt: 1.25, seg: 14 });
    c.Cy(u, v, 0.4 * sz, 0.41 * sz, 0.24 * sz, "matte", "#2a1d14", { seg: 14 });
    c.blob(u - 0.2 * sz, u + 0.2 * sz, v - 0.2 * sz, v + 0.2 * sz, 8e-3, 0.15);
    const greens = ["#3d6a2c", "#4f7d34", "#2f5a28", "#5d8a3a"];
    if (kind === "bush") for (let i = 0; i < 7; i++) {
      const a = R() * 6.28, d = rr(0, 0.18) * sz;
      c.Sp(u + Math.cos(a) * d, rr(0.6, 1.05) * sz, v + Math.sin(a) * d, rr(0.14, 0.24) * sz, rr(0.12, 0.2) * sz, rr(0.14, 0.24) * sz, "matte", pick3(greens), { seg: 8 });
    }
    const n = kind === "palm" ? 10 : 9;
    for (let i = 0; i < n; i++) {
      const yaw = i / n * 6.28 + rr(-0.2, 0.2), tilt = kind === "palm" ? rr(0.9, 1.3) : kind === "snake" ? rr(0.05, 0.25) : rr(0.5, 0.9), len = (kind === "palm" ? rr(0.7, 1) : kind === "snake" ? rr(0.5, 0.8) : rr(0.35, 0.5)) * sz;
      const eb = new THREE.Euler(tilt, yaw, 0, "YXZ"), dir = new V3(0, 1, 0).applyEuler(eb), y0 = kind === "palm" ? 1.5 * sz : 0.42 * sz;
      const m4 = new THREE.Matrix4().compose(new V3(c.s * u + dir.x * len / 2, y0 + dir.y * len / 2, v + dir.z * len / 2), new THREE.Quaternion().setFromEuler(eb), new V3(kind === "snake" ? 0.07 * sz : 0.16 * sz, len, 0.012)).premultiply(c.F);
      emitM(c, matFor("matte", c.env), "box", m4, pick3(greens), 1, null);
    }
    if (kind === "palm") c.Cy(u, v, 0.4 * sz, 1.55 * sz, 0.05 * sz, "grain", "#6a5038", { rt: 0.7 });
  }
  function picture(c, L, a, y, w, h, mn, cell, frame = "#2a1e16", mat = 0.05) {
    c.LB(L, a - w / 2 - 0.04, a + w / 2 + 0.04, 0, 0.035, y - h / 2 - 0.04, y + h / 2 + 0.04, "grainG", frame);
    if (mat) c.LP(L, a, 0.036, y, w, h, "matte", "#e8e2d4");
    c.LP(L, a, 0.037, y, w - 2 * mat, h - 2 * mat, mn, "#ffffff", { cell });
  }
  function chair(c, u, v, fu, fv, col = "#5a3b25", kind = "wood") {
    const O = (a0, a1, b0, b1, y0, y1, mn, cl) => c.O(u, v, fu, fv, a0, a1, b0, b1, y0, y1, mn, cl);
    const leg = (a, b, y1, mn, cl, r = 0.018) => {
      const [x, z] = c.op(u, v, fu, fv, a, b);
      c.Cy(x, z, 0, y1, r, mn, cl, { seg: 6 });
    };
    if (kind === "bistro") {
      c.Cy(u, v, 0.44, 0.48, 0.2, "grain", col, { seg: 14 });
      for (const [a, b] of [[-0.13, -0.13], [0.13, -0.13], [-0.13, 0.13], [0.13, 0.13]]) leg(a, b, 0.44, "steel", "#222222", 0.012);
      for (const a of [-0.15, 0.15]) {
        const [x, z] = c.op(u, v, fu, fv, a, -0.17);
        c.Cy(x, z, 0.48, 0.86, 0.012, "steel", "#222222", { seg: 6 });
      }
      O(-0.18, 0.18, -0.19, -0.16, 0.7, 0.86, "grain", col);
    } else {
      O(-0.21, 0.21, -0.2, 0.2, 0.43, 0.47, kind === "pad" ? "fabric" : "grain", col);
      for (const [a, b] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) leg(a, b, 0.43, "grain", col);
      for (const a of [-0.18, 0.18]) {
        const [x, z] = c.op(u, v, fu, fv, a, -0.18);
        c.Cy(x, z, 0.47, 0.92, 0.018, "grain", col, { seg: 6 });
      }
      O(-0.19, 0.19, -0.2, -0.17, 0.62, 0.9, "grain", col);
    }
    c.blob(u - 0.22, u + 0.22, v - 0.22, v + 0.22, 8e-3, 0.12);
  }
  function table(c, u, v, kind, top2 = "#5a3b25", w = 0.8, d = 0.8, h = 0.75, legCol = "#222222") {
    if (kind === "round") {
      c.Cy(u, v, h - 0.035, h, w / 2, "grainG", top2, { seg: 20 });
      c.Cy(u, v, 0.04, h - 0.035, 0.035, "steel", legCol, { seg: 8 });
      c.Cy(u, v, 0, 0.04, 0.24, "steel", legCol, { seg: 14, rt: 0.8 });
    } else {
      c.B(u - w / 2, u + w / 2, v - d / 2, v + d / 2, h - 0.04, h, "grainG", top2);
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.B(u + a * (w / 2 - 0.06) - 0.025, u + a * (w / 2 - 0.06) + 0.025, v + b * (d / 2 - 0.06) - 0.025, v + b * (d / 2 - 0.06) + 0.025, 0, h - 0.04, "grainG", legCol);
    }
    c.solid(u - w / 2, u + w / 2, v - d / 2, v + d / 2, 0, h);
    c.blob(u - w / 2, u + w / 2, v - d / 2, v + d / 2, 8e-3, 0.25);
  }
  function sofa(c, L, a, len, col, dep = 0.92) {
    const a0 = a - len / 2, a1 = a + len / 2;
    c.LB(L, a0, a1, 0, dep, 0.1, 0.42, "fabric", col);
    c.LB(L, a0, a1, 0, 0.22, 0.42, 0.88, "fabric", col);
    c.LB(L, a0, a0 + 0.2, 0, dep, 0.42, 0.66, "fabric", col);
    c.LB(L, a1 - 0.2, a1, 0, dep, 0.42, 0.66, "fabric", col);
    const n = Math.max(2, Math.round((len - 0.4) / 0.7)), cw = (len - 0.4) / n;
    for (let i = 0; i < n; i++) {
      const s0 = a0 + 0.2 + i * cw;
      c.LB(L, s0 + 0.01, s0 + cw - 0.01, 0.22, dep - 0.02, 0.42, 0.55, "fabric", col);
      c.LB(L, s0 + 0.02, s0 + cw - 0.02, 0.2, 0.36, 0.55, 0.86, "fabric", col);
    }
    for (const s0 of [a0 + 0.08, a1 - 0.08]) for (const d of [0.08, dep - 0.08]) c.LC(L, s0, d, 0, 0.1, 0.025, "grain", "#2a1a10", { seg: 6 });
    c.LB(L, a0 + 0.3, a0 + 0.72, 0.3, 0.42, 0.55, 0.92, "fabric", pick3(["#c9a24a", "#a8432f", "#e8dcc0"]));
    c.LB(L, a1 - 0.72, a1 - 0.3, 0.3, 0.42, 0.55, 0.92, "fabric", pick3(["#c9a24a", "#2f4a6a", "#e8dcc0"]));
    const [p0, q0] = c.at(L, a0, 0), [p1, q1] = c.at(L, a1, dep);
    c.solid(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 0, 0.88);
    c.blob(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 8e-3, 0.2);
  }
  function goodsRow(c, L, a0, a1, dF, y, hMax, kinds, drink = false) {
    let a = a0 + 0.03;
    while (a < a1 - 0.1) {
      const k = pick3(kinds), [w0, w1, h0, h1] = GOODS[k], w = rr(w0, w1), h = Math.min(hMax, rr(h0, h1)), cell = cellUV(drink || k === "can" ? ri(0, 8) : ri(8, 64), 8, 8);
      const tint = pick3(["#ffffff", "#f2eee8", "#e8eef2"]);
      let n = ri(2, 7);
      while (n-- > 0 && a + w < a1 - 0.02) {
        item(c, L, k, a + w / 2, dF, y, w, h, cell, tint);
        a += w + 8e-3;
      }
      a += rr(0.02, 0.08);
    }
  }
  function item(c, L, k, a, dF, y, w, h, cell, tint) {
    const o = { cell, seg: 8 };
    if (k === "box") c.LB(L, a - w / 2, a + w / 2, dF - 0.075, dF, y, y + h, "goods", tint, { cell });
    else if (k === "carton") c.LB(L, a - w / 2, a + w / 2, dF - w, dF, y, y + h, "goods", tint, { cell });
    else if (k === "bag") c.LS(L, a, dF - 0.05, y + h / 2, w / 2, h / 2, 0.045, "goods", tint, { cell, seg: 8 });
    else if (k === "can") {
      c.LC(L, a, dF - w / 2, y, y + h, w / 2, "goods", tint, o);
      c.LC(L, a, dF - w / 2 - 0.07, y, y + h, w / 2, "goods", tint, o);
    } else if (k === "jar") {
      c.LC(L, a, dF - w / 2, y, y + h * 0.85, w / 2, "goods", tint, o);
      c.LC(L, a, dF - w / 2, y + h * 0.85, y + h, w * 0.46, "steel", pick3(["#c8a040", "#d0d0d0", "#a02020"]), { seg: 8 });
    } else if (k === "bottle") {
      const gc = pick3(["#2a5a2a", "#5a3010", "#d8e4e8", "#1a2a4a"]);
      c.LC(L, a, dF - w / 2, y, y + h * 0.6, w / 2, "goods", tint, o);
      c.LC(L, a, dF - w / 2, y + h * 0.6, y + h * 0.74, w / 2, "bottle", gc, { rt: 0.36, seg: 8 });
      c.LC(L, a, dF - w / 2, y + h * 0.74, y + h * 0.95, w * 0.18, "bottle", gc, { seg: 6 });
      c.LC(L, a, dF - w / 2, y + h * 0.95, y + h, w * 0.2, "gloss", pick3(["#c8102e", "#e8e8e8", "#2b78c5", "#d4a020"]), { seg: 6 });
    }
  }
  function shelving(c, L, a0, a1, dep, h, lv, kinds, o = {}) {
    const fc = o.frame || "#7c8085", bc = o.backCol || "#3a3c3f";
    c.LB(L, a0, a1, 0, 0.03, 0.12, h, "paint", bc);
    c.LB(L, a0, a1, 0.03, dep, 0, 0.12, "paint", "#2a2b2d");
    c.LB(L, a0, a0 + 0.03, 0, dep, 0, h, "paint", fc);
    c.LB(L, a1 - 0.03, a1, 0, dep, 0, h, "paint", fc);
    c.LB(L, a0, a1, 0, dep, h - 0.04, h, "paint", fc);
    for (const y of lv) {
      c.LB(L, a0 + 0.03, a1 - 0.03, 0.03, dep, y - 0.025, y, "paint", fc);
      c.LB(L, a0 + 0.03, a1 - 0.03, dep - 4e-3, dep + 6e-3, y - 0.045, y + 5e-3, "gloss", o.strip || "#e8e4d8");
      if (kinds) goodsRow(c, L, a0 + 0.03, a1 - 0.03, dep - 0.02, y, Math.min(0.34, (lv[lv.indexOf(y) + 1] || h) - y - 0.06), kinds, o.drink);
    }
    if (o.col !== false) {
      const [p02, q02] = c.at(L, a0, 0), [p12, q12] = c.at(L, a1, dep);
      c.solid(Math.min(p02, p12), Math.max(p02, p12), Math.min(q02, q12), Math.max(q02, q12), 0, h);
    }
    const [p0, q0] = c.at(L, a0, 0), [p1, q1] = c.at(L, a1, dep);
    c.blob(Math.min(p0, p1), Math.max(p0, p1), Math.min(q0, q1), Math.max(q0, q1), 9e-3, 0.3);
  }
  function buildRoom(d) {
    const c = makeCtx(d);
    BUILD[d.type](c);
    flush(c);
    d.rm = c.rm;
    scene.add(c.rm.g);
    return c.rm;
  }
  function takeCola() {
    const d = P.colaNear;
    if (!d || !d.rm) return;
    d.rm.colaT = 15;
    P.hp = maxHp();
    save.colas = (save.colas || 0) + 1;
    doSave();
    sfx("cola");
    popText("+ ZDROWIE");
    showMsg("ZIMNA COLA", save.colas === 1 ? "Pe\u0142ne zdrowie! Sprzedawca macha r\u0119k\u0105: \u201ENa koszt firmy!\u201D" : `Pe\u0142ne zdrowie \xB7 wypite cole: ${save.colas}`, 2.6);
    if (!canMesh) {
      canMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, 0.12, 12), new THREE.MeshStandardMaterial({ color: 13111342, roughness: 0.3, metalness: 0.6 }));
    }
    if (P.H && P.H.handR) {
      P.H.handR.add(canMesh);
      canMesh.position.set(0, -0.05, 0.03);
      canMesh.rotation.set(0, 0, 0);
      canT = 3;
    }
  }
  function updateRooms(dt) {
    acc += dt;
    if (canT > 0) {
      canT -= dt;
      if (canT <= 0 && canMesh && canMesh.parent) canMesh.parent.remove(canMesh);
    }
    P.colaNear = null;
    const near = (d) => Math.hypot(P.pos.x - d.x, P.pos.z - d.z);
    if (acc > 0.3) {
      acc = 0;
      let built = 0;
      for (const d of doors) {
        const dist = near(d);
        if (!d.rm && dist < 55 && P.pos.y < 40 && built < 1) {
          buildRoom(d);
          built++;
        }
        if (d.rm) d.rm.g.visible = dist < 70;
      }
    }
    for (const d of doors) {
      if (!d.rm || !d.rm.g.visible) continue;
      if (Math.hypot(P.pos.x - d.x, P.pos.z - d.z) < 32) {
        for (const n of d.rm.npcs) {
          n.t += dt;
          for (const k in n.p) n.p[k] = 0;
          idlePose(n.p, n.t);
          applyPose(n.H, n.p);
        }
      }
      const inside = playerInRoom(d, 0);
      if (d.rm.cola) {
        d.rm.colaT = Math.max(0, d.rm.colaT - dt);
        if (inside && d.rm.colaT <= 0 && Math.hypot(P.pos.x - d.rm.cola[0], P.pos.z - d.rm.cola[1]) < 2.4) P.colaNear = d;
      }
      if (inside && !d.rm.entered) {
        d.rm.entered = true;
        const [t, s] = INTRO[d.type];
        showMsg(t, s, 3.2);
        if (d.type !== "fisk") {
          popText("+20 PD");
          Promise.resolve().then(() => (init_wrogowie(), wrogowie_exports)).then((m) => m.addXP(20));
        }
      }
    }
    const fd = doors.find((d) => d.type === "fisk");
    if (fd && fd.rm) {
      const inF = playerInRoom(fd, -0.5);
      if (inF && !wasInFisk && !G.cine && !P.dead) startFisk(fd);
      wasInFisk = inF;
    }
  }
  var INTRO, R, rr, ri, pick3, hsl, tcache, txt, TEX, ENVK, ENV_OF, ENVT, AO_GLSL, LIGHTS_INT, MDEF, mats, BASE, cellUV, _m4, _q2, _e, _p2, _sc, _n3, _v2, _col, civ, GOODS, BUILD, playerInRoom, acc, wasInFisk, canMesh, canT, enterDoor, leaveInterior;
  var init_wnetrza = __esm({
    "js/wnetrza.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_postac();
      init_model();
      init_ui();
      init_dzwiek();
      init_umiejetnosci();
      init_util();
      init_fisk();
      INTRO = {
        shop: ["SKLEP", "Sprzedawca: \u201ESpider-Man?! We\u017A sobie col\u0119, na koszt firmy!\u201D"],
        cafe: ["KAWIARNIA", "Kelner: \u201ENajlepsza kawa na Manhattanie \u2014 i nie gryzie!\u201D"],
        bar: ["BAR", "Barman: \u201ESpokojnie, tu nikt nie chce k\u0142opot\xF3w.\u201D"],
        apt: ["MIESZKANIE", "Lokator: \u201EEj, tylko nie zgnie\u0107 moich kwiatk\xF3w!\u201D"],
        office: ["BIURO", "Pracownik: \u201ECzy to zdj\u0119cie do Daily Bugle?\u201D"],
        gym: ["SI\u0141OWNIA", "Trener: \u201E\u015Awietna forma! Chcesz zobaczy\u0107 nasze ci\u0119\u017Cary?\u201D"],
        fisk: ["FISK TOWER", "Sala g\u0142\xF3wna. Tutaj urz\u0119duje Kingpin."]
      };
      R = Math.random;
      rr = (a, b) => a + R() * (b - a);
      ri = (a, b) => Math.floor(rr(a, b));
      pick3 = (a) => a[Math.floor(R() * a.length)];
      hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;
      tcache = {};
      txt = (x, s, font, col, X, Y, al = "center") => {
        x.font = font;
        x.fillStyle = col;
        x.textAlign = al;
        x.textBaseline = "middle";
        x.fillText(s, X, Y);
      };
      TEX = {
        // winyl w szachownice (kremowy / ciemny) z fugami i marmurkowaniem
        tile: () => tex2("tile", 512, 512, (x, s) => {
          x.fillStyle = "#4a463f";
          x.fillRect(0, 0, s, s);
          const t = s / 4;
          for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
            const dark = (i + j) % 2, l = dark ? rr(30, 33) : rr(66, 70);
            x.fillStyle = hsl(dark ? 150 : 40, dark ? 6 : 16, l);
            x.fillRect(i * t + 2, j * t + 2, t - 4, t - 4);
            for (let k = 0; k < 50; k++) {
              x.fillStyle = hsl(dark ? 150 : 38, 10, l + rr(-7, 7), 0.22);
              x.beginPath();
              x.ellipse(i * t + rr(6, t - 6), j * t + rr(6, t - 6), rr(2, 9), rr(1, 4), rr(0, 3), 0, 7);
              x.fill();
            }
          }
          speck(x, s, s, 5e3, 0.035);
          x.strokeStyle = "rgba(0,0,0,.08)";
          x.lineWidth = 1;
          for (let k = 0; k < 25; k++) {
            x.beginPath();
            const a = rr(0, s), b = rr(0, s);
            x.moveTo(a, b);
            x.lineTo(a + rr(-30, 30), b + rr(-8, 8));
            x.stroke();
          }
        }),
        // deski podlogowe z przesunietymi stykami
        wood: () => tex2("wood", 512, 512, (x, s) => {
          const rows = 8, rh = s / rows;
          for (let r = 0; r < rows; r++) {
            let a = -rr(0, 250);
            while (a < s) {
              const L = rr(170, 330), l = rr(30, 40), hh = rr(24, 32);
              for (const o of [0, -s, s]) {
                if (a + o + L < 0 || a + o > s) continue;
                x.fillStyle = hsl(hh, 42, l);
                x.fillRect(a + o, r * rh, L, rh);
                grainLines(x, a + o, r * rh, L, rh, hh, l, 9);
                x.fillStyle = "rgba(0,0,0,.5)";
                x.fillRect(a + o, r * rh, 1.5, rh);
              }
              a += L;
            }
            x.fillStyle = "rgba(0,0,0,.45)";
            x.fillRect(0, r * rh, s, 1.5);
            x.fillStyle = "rgba(255,230,200,.06)";
            x.fillRect(0, r * rh + 2, s, 2);
          }
          speck(x, s, s, 4e3, 0.03);
        }),
        carpet: () => tex2("carpet", 256, 256, (x, s) => {
          x.fillStyle = "#7d858f";
          x.fillRect(0, 0, s, s);
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
            const hz = (i + j) % 2;
            x.fillStyle = hz ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.03)";
            x.fillRect(i * 128, j * 128, 128, 128);
            for (let k = 0; k < 60; k++) {
              x.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},.05)`;
              if (hz) x.fillRect(i * 128, j * 128 + R() * 128, 128, 1);
              else x.fillRect(i * 128 + R() * 128, j * 128, 1, 128);
            }
            x.fillStyle = "rgba(0,0,0,.18)";
            x.fillRect(i * 128, j * 128, 128, 1);
            x.fillRect(i * 128, j * 128, 1, 128);
          }
          speck(x, s, s, 9e3, 0.07, 1.5);
        }),
        rubber: () => tex2("rubber", 256, 256, (x, s) => {
          x.fillStyle = "#34373b";
          x.fillRect(0, 0, s, s);
          for (let i = 0; i < 1800; i++) {
            x.fillStyle = pick3(["rgba(140,140,140,.35)", "rgba(90,110,150,.3)", "rgba(170,60,50,.25)"]);
            x.fillRect(R() * s, R() * s, rr(1, 2.5), rr(1, 2.5));
          }
          x.fillStyle = "rgba(0,0,0,.6)";
          x.fillRect(0, 0, s, 2);
          x.fillRect(0, 0, 2, s);
          x.fillRect(0, 128, s, 1);
          x.fillRect(128, 0, 1, s);
        }),
        // marmur: szachownica kremowa / czarna z zylkami
        marble: () => tex2("marble", 512, 512, (x, s) => {
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
            const dark = (i + j) % 2, X = i * 256, Y = j * 256;
            x.fillStyle = dark ? "#1b1a1c" : "#d9d2c6";
            x.fillRect(X, Y, 256, 256);
            const g = x.createRadialGradient(X + rr(50, 200), Y + rr(50, 200), 10, X + 128, Y + 128, 220);
            g.addColorStop(0, dark ? "rgba(60,55,58,.5)" : "rgba(255,250,240,.4)");
            g.addColorStop(1, "rgba(0,0,0,0)");
            x.fillStyle = g;
            x.fillRect(X, Y, 256, 256);
            x.save();
            x.beginPath();
            x.rect(X, Y, 256, 256);
            x.clip();
            for (let k = 0; k < 9; k++) {
              x.strokeStyle = dark ? `rgba(200,195,185,${rr(0.12, 0.35)})` : `rgba(110,100,95,${rr(0.12, 0.35)})`;
              x.lineWidth = rr(0.6, 2.4);
              x.beginPath();
              let px = X + rr(0, 256), py = Y + rr(0, 256);
              x.moveTo(px, py);
              for (let q = 0; q < 14; q++) {
                px += rr(-10, 30);
                py += rr(-25, 25);
                x.lineTo(px, py);
              }
              x.stroke();
            }
            x.restore();
            x.fillStyle = "rgba(0,0,0,.35)";
            x.fillRect(X, Y, 256, 1.5);
            x.fillRect(X, Y, 1.5, 256);
          }
        }),
        plaster: () => tex2("plaster", 256, 256, (x, s) => {
          x.fillStyle = "#dedad3";
          x.fillRect(0, 0, s, s);
          for (let k = 0; k < 40; k++) {
            x.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},.025)`;
            x.beginPath();
            x.arc(R() * s, R() * s, rr(10, 50), 0, 7);
            x.fill();
          }
          speck(x, s, s, 6e3, 0.035, 1.5);
        }),
        brick: () => tex2("brick", 512, 512, (x, s) => {
          x.fillStyle = "#8f8577";
          x.fillRect(0, 0, s, s);
          const bh = s / 24, bw = s / 8;
          for (let r = 0; r < 24; r++) for (let k = -1; k < 9; k++) {
            const X = k * bw + r % 2 * bw / 2, l = rr(26, 38), h = rr(8, 18);
            x.fillStyle = hsl(h, rr(32, 48), R() < 0.08 ? l - 10 : l);
            x.fillRect(X + 2, r * bh + 2, bw - 4, bh - 3);
            x.fillStyle = "rgba(255,220,190,.08)";
            x.fillRect(X + 2, r * bh + 2, bw - 4, 2);
            x.fillStyle = "rgba(0,0,0,.15)";
            x.fillRect(X + 2, r * bh + bh - 3, bw - 4, 2);
          }
          speck(x, s, s, 9e3, 0.06);
        }),
        // boazeria: rama + plycina z fazowaniem (1 m x 1 m)
        paneling: () => tex2("paneling", 256, 256, (x, s) => {
          x.fillStyle = hsl(26, 42, 40);
          x.fillRect(0, 0, s, s);
          grainLines(x, 0, 0, s, s, 26, 40, 40);
          const i = 30;
          x.fillStyle = "rgba(0,0,0,.12)";
          x.fillRect(i, i, s - 2 * i, s - 2 * i);
          grainLines(x, i, i, s - 2 * i, s - 2 * i, 26, 36, 18);
          x.strokeStyle = "rgba(255,225,190,.22)";
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(i, s - i);
          x.lineTo(i, i);
          x.lineTo(s - i, i);
          x.stroke();
          x.strokeStyle = "rgba(0,0,0,.45)";
          x.beginPath();
          x.moveTo(s - i, i);
          x.lineTo(s - i, s - i);
          x.lineTo(i, s - i);
          x.stroke();
          x.strokeStyle = "rgba(0,0,0,.35)";
          x.lineWidth = 2;
          x.strokeRect(1, 1, s - 2, s - 2);
        }),
        subway: () => tex2("subway", 256, 256, (x, s) => {
          x.fillStyle = "#9b968c";
          x.fillRect(0, 0, s, s);
          for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) {
            const X = k * 64 + r % 2 * 32, g = x.createLinearGradient(0, r * 32, 0, r * 32 + 32);
            g.addColorStop(0, "#efece4");
            g.addColorStop(1, "#d9d5cb");
            x.fillStyle = g;
            x.fillRect(X + 2, r * 32 + 2, 60, 28);
          }
          speck(x, s, s, 1500, 0.03);
        }),
        acoustic: () => tex2("acoustic", 256, 256, (x, s) => {
          x.fillStyle = "#d2cfc7";
          x.fillRect(0, 0, s, s);
          for (let i = 0; i < 2600; i++) {
            x.fillStyle = `rgba(60,55,50,${rr(0.08, 0.25)})`;
            x.fillRect(R() * s, R() * s, rr(1, 3), 1);
          }
          for (const p of [0, 128]) {
            x.fillStyle = "#ecebe6";
            x.fillRect(0, p, s, 4);
            x.fillRect(p, 0, 4, s);
            x.fillStyle = "rgba(0,0,0,.18)";
            x.fillRect(0, p + 4, s, 1);
            x.fillRect(p + 4, 0, 1, s);
          }
        }),
        // tloczona blacha sufitowa (typowa dla starych barow w NY)
        tin: () => tex2("tin", 256, 256, (x, s) => {
          x.fillStyle = "#a89a80";
          x.fillRect(0, 0, s, s);
          for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
            const X = i * 128 + 64, Y = j * 128 + 64;
            for (const [r, a] of [[60, 0.25], [46, -0.2], [30, 0.25], [14, -0.25]]) {
              x.strokeStyle = a > 0 ? `rgba(255,240,210,${a})` : `rgba(0,0,0,${-a})`;
              x.lineWidth = 3;
              x.strokeRect(X - r, Y - r, 2 * r, 2 * r);
            }
            x.fillStyle = "rgba(255,240,210,.25)";
            x.beginPath();
            x.arc(X, Y, 8, 0, 7);
            x.fill();
          }
          speck(x, s, s, 2500, 0.05);
        }),
        grain: () => tex2("grain", 256, 256, (x, s) => {
          x.fillStyle = hsl(30, 38, 55);
          x.fillRect(0, 0, s, s);
          grainLines(x, 0, 0, s, s, 28, 52, 70);
          speck(x, s, s, 1500, 0.03);
        }),
        fabric: () => tex2("fabric", 128, 128, (x, s) => {
          x.fillStyle = "#c9c9c9";
          x.fillRect(0, 0, s, s);
          for (let i = 0; i < s; i += 2) {
            x.fillStyle = "rgba(0,0,0,.05)";
            x.fillRect(0, i, s, 1);
            x.fillStyle = "rgba(255,255,255,.04)";
            x.fillRect(i, 0, 1, s);
          }
          speck(x, s, s, 2500, 0.06, 1);
        }),
        leather: () => tex2("leather", 128, 128, (x, s) => {
          x.fillStyle = "#bdbdbd";
          x.fillRect(0, 0, s, s);
          for (let k = 0; k < 120; k++) {
            x.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,255,255"},.05)`;
            x.beginPath();
            x.arc(R() * s, R() * s, rr(2, 8), 0, 7);
            x.fill();
          }
          speck(x, s, s, 2e3, 0.05, 1);
        }),
        rug: () => tex2("rug", 256, 256, (x, s) => {
          x.fillStyle = "#7a1e1e";
          x.fillRect(0, 0, s, s);
          x.strokeStyle = "#1f2a4a";
          x.lineWidth = 14;
          x.strokeRect(14, 14, s - 28, s - 28);
          x.strokeStyle = "#d9c9a0";
          x.lineWidth = 3;
          x.strokeRect(26, 26, s - 52, s - 52);
          x.strokeRect(6, 6, s - 12, s - 12);
          x.fillStyle = "#1f2a4a";
          x.beginPath();
          x.moveTo(s / 2, 50);
          x.lineTo(s - 60, s / 2);
          x.lineTo(s / 2, s - 50);
          x.lineTo(60, s / 2);
          x.closePath();
          x.fill();
          x.fillStyle = "#d9c9a0";
          x.beginPath();
          x.moveTo(s / 2, 80);
          x.lineTo(s - 90, s / 2);
          x.lineTo(s / 2, s - 80);
          x.lineTo(90, s / 2);
          x.closePath();
          x.fill();
          x.fillStyle = "#9a2a22";
          x.beginPath();
          x.arc(s / 2, s / 2, 22, 0, 7);
          x.fill();
          for (let i = 0; i < 40; i++) {
            x.fillStyle = "rgba(217,201,160,.5)";
            x.fillRect(rr(36, s - 36), rr(36, s - 36), 3, 3);
          }
          speck(x, s, s, 6e3, 0.08, 1.5);
        }),
        // atlas opakowan 8x8 (pierwsze komorki: napoje)
        goods: () => tex2("goods", 512, 512, (x) => {
          const base = ["#c8102e", "#d6d6d6", "#f28c1a", "#6cbf3a", "#2b78c5", "#161616", "#f2c318", "#7b2d8b", "#0f7a6a", "#d9c7a0", "#8b1a1a", "#1f3f7a", "#efe9dc", "#3a6b2a", "#e85d9c", "#5a3a22"];
          const L = "ABCDEFGHIKLMNOPRSTUWZ";
          for (let i = 0; i < 64; i++) {
            const X = i % 8 * 64, Y = Math.floor(i / 8) * 64, b = i < 16 ? base[i] : pick3(base), acc2 = pick3(["#ffffff", "#f2c318", "#c8102e", "#161616", "#2b78c5"]);
            x.fillStyle = b;
            x.fillRect(X, Y, 64, 64);
            x.fillStyle = acc2;
            x.fillRect(X, Y + rr(34, 46), 64, rr(4, 10));
            x.fillStyle = "rgba(255,255,255,.85)";
            x.beginPath();
            x.ellipse(X + 32, Y + 20, rr(12, 22), rr(7, 11), 0, 0, 7);
            x.fill();
            let w = "";
            for (let k = 0; k < ri(3, 6); k++) w += L[ri(0, L.length)];
            txt(x, w, "bold 11px sans-serif", b === "#efe9dc" || b === "#d6d6d6" ? "#222" : b, X + 32, Y + 20);
            x.fillStyle = "rgba(255,255,255,.55)";
            for (let k = 0; k < 3; k++) x.fillRect(X + 10, Y + 52 + k * 3, rr(20, 44), 1.5);
            if (i === 0) {
              x.fillStyle = "#fff";
              x.beginPath();
              x.moveTo(X, Y + 44);
              x.bezierCurveTo(X + 20, Y + 30, X + 40, Y + 58, X + 64, Y + 40);
              x.lineTo(X + 64, Y + 46);
              x.bezierCurveTo(X + 40, Y + 62, X + 20, Y + 36, X, Y + 50);
              x.fill();
              txt(x, "COLA", "italic bold 15px serif", "#c8102e", X + 32, Y + 20);
            }
            const g = x.createLinearGradient(X, 0, X + 64, 0);
            g.addColorStop(0, "rgba(0,0,0,.28)");
            g.addColorStop(0.35, "rgba(255,255,255,.12)");
            g.addColorStop(1, "rgba(0,0,0,.32)");
            x.fillStyle = g;
            x.fillRect(X, Y, 64, 64);
          }
        }, false),
        // plakaty 4 x (256x512)
        posters: () => tex2("posters", 1024, 512, (x) => {
          let g = x.createLinearGradient(0, 0, 0, 512);
          g.addColorStop(0, "#d0101e");
          g.addColorStop(1, "#6a0610");
          x.fillStyle = g;
          x.fillRect(0, 0, 256, 512);
          x.fillStyle = "#f2f2f2";
          x.beginPath();
          x.ellipse(128, 300, 62, 14, 0, 0, 7);
          x.fill();
          x.fillStyle = "#c8102e";
          x.fillRect(66, 170, 124, 130);
          x.fillStyle = "#e8e8e8";
          x.fillRect(66, 160, 124, 14);
          x.beginPath();
          x.ellipse(128, 160, 62, 12, 0, 0, 7);
          x.fill();
          x.fillStyle = "#fff";
          x.fillRect(66, 225, 124, 12);
          txt(x, "COLA", "italic bold 40px serif", "#fff", 128, 205);
          txt(x, "ZIMNA", "bold 52px sans-serif", "#fff", 128, 60);
          txt(x, "COLA", "bold 52px sans-serif", "#ffd23a", 128, 112);
          txt(x, "TYLKO 1$", "bold 34px sans-serif", "#fff", 128, 400);
          txt(x, "ORZE\u0179WIA MIASTO", "bold 16px sans-serif", "rgba(255,255,255,.8)", 128, 450);
          g = x.createLinearGradient(0, 0, 0, 512);
          g.addColorStop(0, "#2a2f5a");
          g.addColorStop(0.55, "#e0805a");
          g.addColorStop(0.8, "#f4c27a");
          x.fillStyle = g;
          x.fillRect(256, 0, 256, 512);
          x.fillStyle = "#ffd9a0";
          x.beginPath();
          x.arc(384, 340, 40, 0, 7);
          x.fill();
          for (let k = 0; k < 22; k++) {
            const w = rr(10, 26), h = rr(60, 260), X = 256 + rr(0, 240);
            x.fillStyle = "#1a1d30";
            x.fillRect(X, 420 - h, w, h + 100);
          }
          x.fillStyle = "#1a1d30";
          x.fillRect(256, 420, 256, 92);
          txt(x, "NEW YORK", "bold 46px sans-serif", "#fff", 384, 70);
          txt(x, "CITY THAT NEVER SLEEPS", "bold 14px sans-serif", "rgba(255,255,255,.8)", 384, 110);
          x.fillStyle = "#14264a";
          x.fillRect(512, 0, 256, 512);
          x.fillStyle = "#f2b318";
          x.beginPath();
          x.arc(640, 210, 90, 0, 7);
          x.fill();
          x.fillStyle = "#c8302a";
          x.save();
          x.translate(640, 260);
          x.rotate(-0.5);
          x.fillRect(-200, -12, 400, 24);
          x.fillRect(-200, 30, 400, 10);
          x.restore();
          txt(x, "JAZZ", "bold 70px serif", "#fff", 640, 390);
          txt(x, "NOC", "bold 40px serif", "#f2b318", 640, 440);
          txt(x, "PI\u0104TEK 21:00", "bold 18px sans-serif", "#fff", 640, 480);
          x.fillStyle = "#111";
          x.fillRect(768, 0, 256, 512);
          x.fillStyle = "#f2c318";
          for (let k = -4; k < 10; k++) {
            x.save();
            x.translate(768 + k * 40, 0);
            x.transform(1, 0, -0.5, 1, 0, 0);
            x.fillRect(0, 440, 18, 80);
            x.restore();
          }
          txt(x, "TRENUJ", "bold 50px sans-serif", "#fff", 896, 120);
          txt(x, "MOCNIEJ", "bold 50px sans-serif", "#f2c318", 896, 180);
          txt(x, "BEZ WYM\xD3WEK", "bold 20px sans-serif", "#ccc", 896, 240);
          x.fillStyle = "#f2c318";
          x.fillRect(826, 300, 140, 16);
          x.fillRect(806, 280, 22, 56);
          x.fillRect(964, 280, 22, 56);
          speck(x, 1024, 512, 6e3, 0.04);
        }, false),
        // obrazy 2x2
        art: () => tex2("art", 512, 512, (x) => {
          x.fillStyle = "#d9cbb0";
          x.fillRect(0, 0, 256, 256);
          for (const [y, h, c] of [[20, 90, "#c8562a"], [118, 30, "#7a1e1e"], [156, 80, "#d9a03a"]]) {
            x.fillStyle = c;
            x.shadowColor = c;
            x.shadowBlur = 12;
            x.fillRect(24, y, 208, h);
          }
          x.shadowBlur = 0;
          let g = x.createLinearGradient(0, 0, 0, 140);
          g.addColorStop(0, "#8fb0d0");
          g.addColorStop(1, "#f2d0a0");
          x.fillStyle = g;
          x.fillRect(256, 0, 256, 140);
          x.fillStyle = "#f7e0a0";
          x.beginPath();
          x.arc(420, 110, 22, 0, 7);
          x.fill();
          g = x.createLinearGradient(0, 140, 0, 256);
          g.addColorStop(0, "#3a6a8a");
          g.addColorStop(1, "#1a3048");
          x.fillStyle = g;
          x.fillRect(256, 140, 256, 116);
          for (let k = 0; k < 40; k++) {
            x.fillStyle = "rgba(255,255,255,.25)";
            x.fillRect(256 + rr(0, 256), rr(150, 250), rr(6, 20), 1.5);
          }
          x.fillStyle = "#e6dcc6";
          x.fillRect(0, 256, 256, 256);
          x.strokeStyle = "#5a4630";
          x.lineWidth = 3;
          for (const X of [70, 186]) {
            x.strokeRect(X - 14, 300, 28, 160);
            x.beginPath();
            x.arc(X, 340, 8, Math.PI, 0);
            x.stroke();
          }
          x.lineWidth = 1.2;
          for (let k = 0; k < 14; k++) {
            x.beginPath();
            x.moveTo(70, 300);
            x.lineTo(10 + k * 17, 420);
            x.stroke();
            x.beginPath();
            x.moveTo(186, 300);
            x.lineTo(10 + k * 17, 420);
            x.stroke();
          }
          x.lineWidth = 4;
          x.beginPath();
          x.moveTo(0, 420);
          x.lineTo(256, 420);
          x.stroke();
          g = x.createLinearGradient(0, 256, 0, 512);
          g.addColorStop(0, "#bdbdbd");
          g.addColorStop(1, "#4a4a4a");
          x.fillStyle = g;
          x.fillRect(256, 256, 256, 256);
          for (let k = 0; k < 16; k++) {
            const w = rr(14, 30), h = rr(50, 200), X = 256 + rr(0, 236);
            x.fillStyle = `rgb(${ri(30, 70)},${ri(30, 70)},${ri(30, 70)})`;
            x.fillRect(X, 512 - h, w, h);
            for (let q = 0; q < 12; q++) {
              x.fillStyle = "rgba(220,220,220,.35)";
              x.fillRect(X + rr(2, w - 4), 512 - rr(4, h), 2, 2);
            }
          }
          speck(x, 512, 512, 5e3, 0.05);
        }, false),
        menu: () => tex2("menu", 512, 256, (x, w, h) => {
          x.fillStyle = "#1f2622";
          x.fillRect(0, 0, w, h);
          speck(x, w, h, 5e3, 0.05);
          for (let k = 0; k < 30; k++) {
            x.fillStyle = "rgba(255,255,255,.03)";
            x.beginPath();
            x.ellipse(R() * w, R() * h, rr(20, 60), rr(5, 15), rr(0, 3), 0, 7);
            x.fill();
          }
          txt(x, "~ MENU ~", "bold 34px serif", "rgba(245,240,225,.9)", w / 2, 32);
          const items = [["ESPRESSO", "2,50"], ["AMERICANO", "3,00"], ["CAPPUCCINO", "3,80"], ["LATTE", "4,20"], ["HERBATA", "2,50"], ["SERNIK", "4,50"], ["BAJGIEL", "3,50"], ["MUFFIN", "2,90"]];
          items.forEach(([n, p], i) => {
            const X = i < 4 ? 30 : 270, Y = 82 + i % 4 * 42;
            txt(x, n, "bold 20px sans-serif", "rgba(240,236,220,.85)", X, Y, "left");
            txt(x, p + " $", "bold 20px sans-serif", "rgba(250,215,120,.9)", X + 210, Y, "right");
          });
        }, false),
        whiteboard: () => tex2("whiteboard", 512, 256, (x, w, h) => {
          x.fillStyle = "#eef0ee";
          x.fillRect(0, 0, w, h);
          txt(x, "PLAN Q3", "bold 28px sans-serif", "#1f4ab0", 90, 34);
          x.strokeStyle = "#1f4ab0";
          x.lineWidth = 3;
          for (let k = 0; k < 5; k++) {
            x.beginPath();
            x.moveTo(30, 75 + k * 28);
            for (let q = 30; q < 210; q += 10) x.lineTo(q, 75 + k * 28 + rr(-2, 2));
            x.stroke();
          }
          x.strokeStyle = "#222";
          x.beginPath();
          x.moveTo(270, 40);
          x.lineTo(270, 220);
          x.lineTo(480, 220);
          x.stroke();
          [60, 100, 80, 140, 170].forEach((v, i) => {
            x.fillStyle = i === 4 ? "#c8302a" : "#2a8a4a";
            x.fillRect(290 + i * 38, 220 - v, 24, v);
          });
          x.strokeStyle = "#c8302a";
          x.lineWidth = 3;
          x.beginPath();
          x.moveTo(300, 150);
          x.lineTo(470, 50);
          x.stroke();
          x.beginPath();
          x.moveTo(470, 50);
          x.lineTo(450, 52);
          x.moveTo(470, 50);
          x.lineTo(462, 68);
          x.stroke();
          x.fillStyle = "rgba(0,0,0,.05)";
          for (let k = 0; k < 10; k++) x.fillRect(rr(0, w), rr(0, h), rr(40, 120), rr(6, 20));
        }, false),
        neon: () => tex2("neon", 512, 256, (x, w, h) => {
          x.fillStyle = "#000";
          x.fillRect(0, 0, w, h);
          x.font = "italic bold 130px serif";
          x.textAlign = "center";
          x.textBaseline = "middle";
          for (const [b, c] of [[40, "#ff2aa0"], [20, "#ff4ab8"], [6, "#ffc0e8"]]) {
            x.shadowColor = c;
            x.shadowBlur = b;
            x.fillStyle = c;
            x.fillText("Bar", w / 2, 110);
          }
          x.font = "bold 40px sans-serif";
          for (const [b, c] of [[24, "#30b0ff"], [4, "#c0e8ff"]]) {
            x.shadowColor = c;
            x.shadowBlur = b;
            x.fillStyle = c;
            x.fillText("O P E N", w / 2, 210);
          }
        }, false),
        // widok z okna: miasto o zachodzie
        view: () => tex2("view", 512, 512, (x, w, h) => {
          const g = x.createLinearGradient(0, 0, 0, h);
          g.addColorStop(0, "#34406a");
          g.addColorStop(0.45, "#b8705a");
          g.addColorStop(0.7, "#f0a868");
          g.addColorStop(1, "#f6c886");
          x.fillStyle = g;
          x.fillRect(0, 0, w, h);
          for (const [n, hmin, hmax, col, lit] of [[30, 80, 260, "#5a4a5e", 0.15], [22, 120, 380, "#2a2638", 0.35]]) for (let k = 0; k < n; k++) {
            const bw = rr(18, 60), bh = rr(hmin, hmax), X = rr(-20, w), Y = h - bh;
            x.fillStyle = col;
            x.fillRect(X, Y, bw, bh);
            if (R() < 0.3) x.fillRect(X + bw * 0.4, Y - 30, bw * 0.2, 30);
            for (let yy = Y + 8; yy < h - 6; yy += 10) for (let xx = X + 4; xx < X + bw - 4; xx += 8) if (R() < lit) {
              x.fillStyle = `rgba(255,${ri(190, 230)},${ri(120, 170)},.85)`;
              x.fillRect(xx, yy, 4, 5);
              x.fillStyle = col;
            }
          }
        }, false),
        screens: () => tex2("screens", 256, 256, (x) => {
          x.fillStyle = "#dfe6ee";
          x.fillRect(0, 0, 128, 128);
          x.fillStyle = "#2a5ab0";
          x.fillRect(0, 0, 128, 14);
          x.strokeStyle = "rgba(0,0,0,.2)";
          for (let k = 0; k < 9; k++) {
            x.beginPath();
            x.moveTo(0, 22 + k * 11);
            x.lineTo(128, 22 + k * 11);
            x.stroke();
          }
          for (let k = 1; k < 5; k++) {
            x.beginPath();
            x.moveTo(k * 26, 14);
            x.lineTo(k * 26, 128);
            x.stroke();
          }
          x.fillStyle = "#1e1f26";
          x.fillRect(128, 0, 128, 128);
          for (let k = 0; k < 14; k++) {
            x.fillStyle = pick3(["#7fd0ff", "#ffb070", "#b0e080", "#e0e0e0", "#d090ff"]);
            x.fillRect(136 + ri(0, 4) * 6, 8 + k * 8, rr(20, 90), 3);
          }
          let g = x.createLinearGradient(0, 128, 0, 256);
          g.addColorStop(0, "#1a3a7a");
          g.addColorStop(1, "#0a1a3a");
          x.fillStyle = g;
          x.fillRect(0, 128, 128, 128);
          x.fillStyle = "#c9a080";
          x.beginPath();
          x.arc(64, 180, 16, 0, 7);
          x.fill();
          x.fillStyle = "#2a2a3a";
          x.fillRect(40, 196, 48, 40);
          x.fillStyle = "#c8202a";
          x.fillRect(0, 226, 128, 18);
          txt(x, "WIADOMO\u015ACI", "bold 10px sans-serif", "#fff", 64, 235);
          x.fillStyle = "#0c0e10";
          x.fillRect(128, 128, 128, 128);
          txt(x, "8.5", "bold 34px monospace", "#ffa030", 192, 172);
          txt(x, "KM/H", "bold 12px sans-serif", "#80ff80", 192, 200);
          x.fillStyle = "#30d060";
          for (let k = 0; k < 10; k++) x.fillRect(140 + k * 10, 240 - k * 3, 7, k * 3 + 4);
        }, false),
        panelL: () => tex2("panelL", 64, 64, (x, s) => {
          const g = x.createRadialGradient(32, 32, 4, 32, 32, 44);
          g.addColorStop(0, "#ffffff");
          g.addColorStop(0.7, "#f2f0ea");
          g.addColorStop(1, "#a8a6a0");
          x.fillStyle = g;
          x.fillRect(0, 0, s, s);
          x.fillStyle = "rgba(0,0,0,.08)";
          for (let k = 1; k < 4; k++) {
            x.fillRect(k * 16, 0, 1, s);
            x.fillRect(0, k * 16, s, 1);
          }
        }, false),
        pool: () => tex2("pool", 128, 128, (x, s) => {
          const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
          g.addColorStop(0, "#fff");
          g.addColorStop(0.35, "#9a9a9a");
          g.addColorStop(0.7, "#2a2a2a");
          g.addColorStop(1, "#000");
          x.fillStyle = g;
          x.fillRect(0, 0, s, s);
        }, false),
        blob: () => tex2("blob", 128, 128, (x, s) => {
          const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
          g.addColorStop(0, "rgba(0,0,0,.72)");
          g.addColorStop(0.55, "rgba(0,0,0,.42)");
          g.addColorStop(1, "rgba(0,0,0,0)");
          x.fillStyle = g;
          x.fillRect(0, 0, s, s);
        }, false)
      };
      ENVK = {
        bright: { wall: [0.42, 0.38, 0.32], floor: [0.3, 0.27, 0.22], ceil: [0.4, 0.37, 0.32], lamp: [7, 6.3, 5.2], n: 6, i: 1.9 },
        cool: { wall: [0.36, 0.37, 0.39], floor: [0.26, 0.27, 0.29], ceil: [0.36, 0.36, 0.35], lamp: [6.4, 6.4, 6.2], n: 6, i: 1.8 },
        warm: { wall: [0.45, 0.31, 0.19], floor: [0.3, 0.2, 0.12], ceil: [0.36, 0.27, 0.19], lamp: [9, 6.2, 3.4], n: 4, i: 2.2 },
        dark: { wall: [0.26, 0.14, 0.09], floor: [0.2, 0.11, 0.07], ceil: [0.2, 0.14, 0.09], lamp: [9, 5.2, 2.4], n: 3, i: 2.3, neon: [4, 0.5, 2.2] },
        lux: { wall: [0.3, 0.2, 0.12], floor: [0.28, 0.23, 0.18], ceil: [0.26, 0.19, 0.12], lamp: [9, 6.8, 4.2], n: 6, i: 2 }
      };
      ENV_OF = { shop: "bright", cafe: "warm", bar: "dark", apt: "warm", office: "cool", gym: "cool", fisk: "lux" };
      ENVT = {};
      AO_GLSL = "float wAo = mix(0.58, 1.0, smoothstep(0.0, 1.3, vWY - 0.15)); reflectedLight.indirectDiffuse *= wAo; reflectedLight.indirectSpecular *= mix(wAo, 1.0, 0.5);";
      LIGHTS_INT = null;
      MDEF = {
        tile: { t: "tile", ts: 1.2, r: 0.3 },
        wood: { t: "wood", ts: 2, r: 0.38 },
        carpet: { t: "carpet", ts: 1, r: 0.95 },
        rubber: { t: "rubber", ts: 1, r: 0.8 },
        marble: { t: "marble", ts: 2.4, r: 0.1 },
        plaster: { t: "plaster", ts: 2, r: 0.92 },
        brick: { t: "brick", ts: 2, r: 0.9 },
        panel: { t: "paneling", ts: 1, r: 0.42 },
        subway: { t: "subway", ts: 0.6, r: 0.2 },
        acoustic: { t: "acoustic", ts: 1.2, r: 0.95 },
        tin: { t: "tin", ts: 0.6, r: 0.35, m: 0.55 },
        grain: { t: "grain", ts: 1, r: 0.55 },
        grainG: { t: "grain", ts: 1, r: 0.25 },
        fabric: { t: "fabric", ts: 0.5, r: 0.95 },
        leather: { t: "leather", ts: 0.5, r: 0.4 },
        rug: { t: "rug", r: 0.95 },
        matte: { r: 0.88 },
        paint: { r: 0.6 },
        gloss: { r: 0.2 },
        chrome: { r: 0.14, m: 1 },
        steel: { r: 0.4, m: 0.85 },
        brass: { r: 0.28, m: 1 },
        glass: { r: 0.03, glass: 0.16 },
        bottle: { r: 0.06 },
        mirror: { r: 0.12, m: 0.9 },
        goods: { t: "goods", r: 0.45 },
        poster: { t: "posters", r: 0.55 },
        art: { t: "art", r: 0.5 },
        menu: { t: "menu", r: 0.9 },
        white: { t: "whiteboard", r: 0.2 },
        lamp: { basic: 1 },
        panelL: { basic: 1, t: "panelL" },
        screen: { basic: 1, t: "screens" },
        view: { basic: 1, t: "view" },
        neon: { basic: 1, t: "neon", add: 1 },
        pool: { basic: 1, t: "pool", add: 1 },
        blob: { blob: 1 }
      };
      mats = {};
      BASE = {};
      cellUV = (i, nx, ny) => {
        const x0 = i % nx / nx, row = Math.floor(i / nx);
        return [x0, 1 - (row + 1) / ny, x0 + 1 / nx, 1 - row / ny];
      };
      _m4 = new THREE.Matrix4();
      _q2 = new THREE.Quaternion();
      _e = new THREE.Euler();
      _p2 = new V3();
      _sc = new V3();
      _n3 = new THREE.Matrix3();
      _v2 = new V3();
      _col = new THREE.Color();
      civ = () => Object.assign(randomOutfit("thug"), { mask: false, hat: R() < 0.75 ? "none" : "cap", top: R() < 0.6 ? "tshirt" : "hoodie", topCol: pick3(["#c9c2b3", "#3a3a3a", "#6b1a1a", "#1d3050", "#5b5f66", "#2d4a3a", "#8a6a3a"]) });
      GOODS = { box: [0.17, 0.25, 0.22, 0.32], bag: [0.18, 0.24, 0.2, 0.3], can: [0.066, 0.066, 0.12, 0.12], bottle: [0.07, 0.09, 0.24, 0.32], jar: [0.09, 0.1, 0.11, 0.15], carton: [0.08, 0.09, 0.18, 0.22] };
      BUILD = {
        shop(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["tile"], wall: ["plaster", "#b3ab9a"], ceil: ["acoustic", "#c9c4ba"], base: "#2e2d2b", band: "#8e2a22", bandY: ch - 0.7 });
          for (const u of [-hw * 0.55, 0, hw * 0.55]) for (const v of [cd * 0.22, cd * 0.52, cd * 0.82]) lampPanel(c, u, v, 1.2, 0.3, 2.3, "#fff3e0", 0.9);
          const f0 = 1.4, f1 = cd - 1, fd = 0.85, R_ = L.right, nU = Math.max(2, Math.round((f1 - f0) / 1.25)), uw = (f1 - f0) / nU;
          c.LB(R_, f0, f1, 0, fd, 0, 0.18, "paint", "#1c1d1f");
          c.LB(R_, f0, f1, 0, fd, 2.12, 2.25, "paint", "#e6e6e2");
          c.LB(R_, f0, f1, 0, 0.04, 0.18, 2.12, "lamp", "#dfeeff", { k: 0.85 });
          c.LB(R_, f0, f1, fd - 0.02, fd, 2.25, 2.55, "lamp", "#d81a28", { k: 1.4 });
          c.LB(R_, f0 - 0.02, f1 + 0.02, 0, fd + 0.02, 2.55, 2.6, "paint", "#202022");
          for (let i = 0; i <= nU; i++) {
            const a = f0 + i * uw;
            c.LB(R_, a - 0.035, a + 0.035, 0, fd, 0.18, 2.12, "paint", "#e6e6e2");
          }
          for (let i = 0; i < nU; i++) {
            const a0 = f0 + i * uw + 0.035, a1 = f0 + (i + 1) * uw - 0.035;
            for (const y of [0.55, 0.98, 1.41, 1.84]) {
              c.LB(R_, a0, a1, 0.04, fd - 0.1, y - 0.015, y, "steel", "#bfc4c8");
              goodsRow(c, R_, a0, a1, fd - 0.12, y, 0.3, i % 2 ? ["bottle", "can"] : ["can", "can", "bottle"], true);
            }
            goodsRow(c, R_, a0, a1, fd - 0.12, 0.18, 0.32, ["can", "bottle"], true);
            c.LB(R_, a0, a1, fd - 0.03, fd - 0.01, 0.2, 2.1, "glass", "#d8e8f0");
            c.LB(R_, a0, a1, fd - 0.035, fd, 0.18, 0.24, "paint", "#1c1d1f");
            c.LB(R_, a0, a1, fd - 0.035, fd, 2.06, 2.12, "paint", "#1c1d1f");
            c.LB(R_, a1 - 0.08, a1 - 0.06, fd, fd + 0.05, 0.8, 1.6, "chrome", "#d0d0d0");
          }
          {
            const [p, q] = c.at(R_, f0, 0), [p2, q2] = c.at(R_, f1, fd);
            c.solid(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0, 2.6);
          }
          c.pool(hw - 1.6, (f0 + f1) / 2, 1.8, f1 - f0, "#cfe6ff", 0.1);
          c.rm.cola = c.world(hw - 2.1, (1.5 + cd - 2) / 2);
          c.rm.colaT = 0;
          shelving(c, L.back, -hw + 0.62, hw - 0.1, 0.5, 2.2, [0.12, 0.55, 0.95, 1.35, 1.75], ["box", "box", "bag", "jar", "carton", "bottle"]);
          shelving(c, L.left, 3.4, cd - 0.6, 0.5, 2.2, [0.12, 0.55, 0.95, 1.35, 1.75], ["box", "bag", "can", "jar"]);
          const gv0 = 3.3, gv1 = cd - 1.6, rC = hw - 3.4, lC = rC - 3;
          for (const gc of lC - 0.45 > -hw + 2.2 ? [rC, lC] : [rC]) {
            for (const dir of [1, -1]) shelving(c, { ax: "v", b: gc, dir }, gv0, gv1, 0.44, 1.62, [0.12, 0.5, 0.88, 1.26], ["box", "bag", "jar", "bottle", "can", "carton"], { col: false, backCol: "#8a8d90", frame: "#9a9da0" });
            c.solid(gc - 0.45, gc + 0.45, gv0, gv1, 0, 1.62);
            c.B(gc - 0.45, gc + 0.45, gv0 - 0.02, gv0, 1.62, 1.9, "paint", "#c8102e");
            c.B(gc - 0.4, gc + 0.4, gv0 - 0.03, gv0 - 0.02, 1.66, 1.86, "goods", "#ffffff", { cell: cellUV(0, 8, 8) });
            for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) c.B(gc - 0.4 + j * 0.27 + i * 0.13, gc - 0.15 + j * 0.27 + i * 0.13, gv0 - 0.45, gv0 - 0.05, i * 0.26, i * 0.26 + 0.25, "goods", "#ffffff", { cell: cellUV(ri(8, 64), 8, 8) });
          }
          const cu0 = -hw + 0.1, cu1 = Math.min(-hw + 3.4, du - 1.4), cv0 = 1.5, cv1 = 2.1;
          if (cu1 - cu0 > 1.2) {
            B(cu0, cu1, cv0, cv1, 0, 1, "grain", "#5a3a24", true);
            B(cu0, cu1, cv0 - 0.01, cv0, 0.08, 0.95, "panel", "#6a4a30");
            B(cu0, cu1, cv0 + 0.04, cv1, 0, 0.08, "matte", "#1a1816");
            B(cu0 - 0.02, cu1 + 0.04, cv0 - 0.06, cv1 + 0.02, 1, 1.05, "gloss", "#cfc6b4");
            const ku = cu1 - 0.6;
            B(ku - 0.2, ku + 0.2, cv0 + 0.15, cv0 + 0.5, 1.05, 1.15, "gloss", "#202224");
            B(ku - 0.17, ku + 0.17, cv0 + 0.42, cv0 + 0.46, 1.15, 1.42, "gloss", "#151618");
            c.Pl(ku, cv0 + 0.415, 1.285, 0.3, 0.22, "-v", "screen", "#ffffff", { cell: cellUV(0, 2, 2) });
            B(ku + 0.3, ku + 0.42, cv0 + 0.1, cv0 + 0.25, 1.05, 1.12, "gloss", "#2a2a2a");
            for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) B(cu0 + 0.3 + i * 0.18, cu0 + 0.44 + i * 0.18, cv0 + 0.1 + j * 0.17, cv0 + 0.24 + j * 0.17, 1.05, 1.13, "goods", "#ffffff", { cell: cellUV(ri(8, 64), 8, 8) });
            c.LB(L.left, 2.2, 3.3, 0, 0.35, 0, 0.9, "grain", "#4a3020");
            c.LB(L.left, 2.2, 3.3, 0, 0.3, 1.25, 2.3, "paint", "#2a2b2d");
            for (const y of [1.3, 1.65, 2]) for (let a = 2.25; a < 3.25; a += 0.08) c.LB(L.left, a, a + 0.065, 0.2, 0.29, y, y + 0.28, "goods", "#ffffff", { cell: cellUV(ri(8, 64), 8, 8) });
            c.npc((cu0 + cu1) / 2, 2.75);
          }
          const zu0 = du + 1.35, zu1 = hw - 0.15;
          if (zu1 - zu0 > 1.2) {
            B(zu0, zu1, 0.1, 0.85, 0, 0.82, "gloss", "#e8e8e4", true);
            B(zu0 + 0.05, zu1 - 0.05, 0.15, 0.8, 0.82, 0.84, "glass", "#cfe6ff");
            for (let a = zu0 + 0.1; a < zu1 - 0.2; a += 0.17) B(a, a + 0.15, 0.2, 0.75, 0.62, 0.74, "goods", "#ffffff", { cell: cellUV(ri(8, 64), 8, 8) });
            B(zu0, zu1, 0.08, 0.1, 0.4, 0.75, "goods", "#ffffff", { cell: cellUV(14, 8, 8) });
          }
          B(du - 0.9, du + 0.9, 0.06, 1.25, 4e-3, 0.016, "carpet", "#3a3a3a");
          picture(c, L.left, 0.9, 1.9, 0.5, 1, "poster", cellUV(0, 4, 1), "#111111", 0);
          c.Sp(hw - 0.4, ch - 0.25, 0.4, 0.16, 0.12, 0.16, "mirror", "#9aa0a8");
          c.npc(rC - 1.5, cd * 0.55, 1, 0);
        },
        cafe(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["wood"], wall: ["plaster", "#b9a07c"], back: ["brick"], ceil: ["plaster", "#b8ab98"], wains: ["panel", "#8a6a4a", 1], base: "#2a1c12", crown: "#cfc4b0" });
          for (let v = 1.4; v < cd - 0.5; v += 1.9) B(-hw, hw, v - 0.09, v + 0.09, ch - 0.28, ch - 0.05, "grain", "#4a3222");
          const v0 = cd - 2.5, v1 = cd - 1.85, u0 = -hw + 1.2, u1 = hw - 1.6;
          B(u0, u1, v0, v1, 0, 1, "grain", "#4a3020", true);
          B(u0, u1, v0 + 0.04, v1, 0, 0.08, "matte", "#141210");
          for (let u = u0 + 0.06; u < u1 - 0.05; u += 0.12) B(u - 0.045, u + 0.045, v0 - 0.02, v0, 0.08, 0.98, "grain", "#6a4529");
          B(u0 - 0.05, u1 + 0.05, v0 - 0.08, v1 + 0.02, 1, 1.05, "gloss", "#d6cfc2");
          const gu0 = u0 + 0.2, gu1 = Math.min(u0 + 1.9, u1 - 1.2);
          B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.05, 1.5, "glass", "#e8f0f0");
          B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.5, 1.53, "steel", "#c8c8c8");
          B(gu0, gu1, v0 + 0.06, v1 - 0.06, 1.25, 1.26, "glass", "#e8f0f0");
          for (let u = gu0 + 0.2; u < gu1 - 0.15; u += 0.32) {
            c.Cy(u, (v0 + v1) / 2, 1.06, 1.16, 0.12, "matte", pick3(["#5a3018", "#e8d0b0", "#c86070", "#f0e8d8"]), { seg: 14 });
            c.Sp(u, 1.31, (v0 + v1) / 2, 0.09, 0.04, 0.05, "matte", "#c88a40", { seg: 8 });
          }
          c.B(gu0, gu1, v0 + 0.05, v1 - 0.05, 1.05, 1.06, "lamp", "#ffe0b0", { k: 0.5 });
          const ku = u1 - 0.7;
          B(ku - 0.18, ku + 0.18, v0 + 0.2, v0 + 0.5, 1.05, 1.14, "gloss", "#202224");
          B(ku - 0.15, ku + 0.15, v0 + 0.42, v0 + 0.46, 1.14, 1.36, "gloss", "#151618");
          c.Pl(ku, v0 + 0.415, 1.25, 0.26, 0.18, "-v", "screen", "#ffffff", { cell: cellUV(1, 2, 2) });
          c.Cy(ku - 0.5, v0 + 0.2, 1.05, 1.22, 0.06, "glass", "#e0f0e8");
          for (const u of [u0 + 0.15, (u0 + u1) / 2, u1 - 0.15]) pendant(c, u, v0 + 0.25, 1.15, "#b88a3e", 0.17, 3, "#ffcf90", 0.8, "brass");
          if (u1 - u0 > 3) pendant(c, (u0 * 3 + u1) / 4 + 0.6, v0 + 0.25, 1.15, "#b88a3e", 0.17, 3, "#ffcf90", 0.8, "brass");
          const K2 = L.back;
          c.LB(K2, -hw + 0.4, hw - 0.4, 0, 0.6, 0, 0.9, "grain", "#4a3020", true);
          c.LB(K2, -hw + 0.38, hw - 0.38, 0, 0.62, 0.9, 0.94, "gloss", "#2a2725");
          c.LB(K2, -hw + 0.4, hw - 0.4, 0, 0.012, 0.94, 1.5, "subway", "#ffffff");
          const eu = -0.4;
          c.LB(K2, eu - 0.6, eu + 0.6, 0.12, 0.58, 0.94, 1.45, "chrome", "#d6d6d6");
          c.LB(K2, eu - 0.58, eu + 0.58, 0.58, 0.6, 1, 1.38, "gloss", "#8a1a14");
          for (const a of [eu - 0.3, eu + 0.3]) {
            c.LC(K2, a, 0.66, 1.16, 1.24, 0.05, "chrome", "#d6d6d6");
            c.LB(K2, a - 0.02, a + 0.02, 0.66, 0.84, 1.14, 1.18, "gloss", "#111111");
          }
          c.LB(K2, eu - 0.5, eu + 0.5, 0.58, 0.72, 0.94, 0.98, "chrome", "#c8c8c8");
          c.LD(K2, eu + 0.5, 0.58, 0.72, 1.15, 8e-3, "chrome", "#d6d6d6");
          for (let i = 0; i < 6; i++) c.LC(K2, eu - 0.45 + i * 0.18, 0.3, 1.45, 1.53, 0.04, "gloss", "#f0ece4", { seg: 10 });
          c.LB(K2, 0.6, 0.85, 0.15, 0.4, 0.94, 1.25, "gloss", "#1a1a1a");
          c.LC(K2, 0.725, 0.28, 1.25, 1.5, 0.11, "bottle", "#3a2216", { rt: 1.35, seg: 12 });
          picture(c, K2, 0, 2.4, 3.2, 1, "menu", null, "#2a1a10", 0);
          for (const s of [-1, 1]) {
            const a0 = s < 0 ? -hw + 0.5 : 2, a1 = s < 0 ? -2 : hw - 0.5;
            if (a1 - a0 < 0.6) continue;
            for (const y of [1.85, 2.35]) {
              c.LB(K2, a0, a1, 0, 0.26, y - 0.03, y, "grainG", "#4a3020");
              for (let a = a0 + 0.1; a < a1 - 0.1; a += rr(0.14, 0.24)) R() < 0.6 ? c.LC(K2, a, 0.13, y, y + rr(0.08, 0.2), rr(0.04, 0.06), pick3(["gloss", "bottle"]), pick3(["#f0ece4", "#3a2216", "#c8a060", "#2a5a2a"]), { seg: 10 }) : c.LC(K2, a, 0.13, y, y + 0.1, 0.045, "gloss", "#ffffff", { seg: 10 });
            }
          }
          const tc = ["#5a3b25", "#3a2a1e"];
          for (const v of [2, 4.3, v0 - 1.6]) for (const u of [-hw + 2, -hw + 4.6, hw - 4.6, hw - 2]) {
            if (v < 3.4 && Math.abs(u - du) < 1.7) continue;
            if (v > v0 - 1) continue;
            const round = (Math.round(u + v * 3) & 1) === 0;
            table(c, u, v, round ? "round" : "rect", "#6a4a30", round ? 0.76 : 0.75, 0.75);
            chair(c, u - 0.62, v, 1, 0, pick3(tc), round ? "bistro" : "wood");
            chair(c, u + 0.62, v, -1, 0, pick3(tc), round ? "bistro" : "wood");
            c.Cy(u + 0.12, v + 0.05, 0.75, 0.83, 0.04, "gloss", "#f0ece4", { seg: 10 });
            if (R() < 0.5) c.Cy(u - 0.15, v - 0.1, 0.75, 0.76, 0.09, "gloss", "#f0ece4", { seg: 12 });
            pendant(c, u, v, 1.45, "#1f1f1f", 0.14, 2.6, "#ffc880", 0.65);
          }
          plant(c, -hw + 0.55, 0.6, 1.3, "#cfc6b4");
          plant(c, hw - 0.55, 0.6, 1.2, "#3a3a3a", "snake");
          picture(c, L.left, cd * 0.35, 1.85, 0.8, 0.6, "art", cellUV(1, 2, 2));
          picture(c, L.left, cd * 0.62, 1.85, 0.7, 0.7, "art", cellUV(2, 2, 2));
          picture(c, L.right, cd * 0.45, 1.95, 0.5, 1, "poster", cellUV(2, 4, 1), "#111111", 0);
          c.npc(0, cd - 1.25);
          c.npc(1, v0 - 0.7, 0, 1);
          c.npc(-hw + 2.6, 4.3, -1, 0);
        },
        bar(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["wood", "#8a6a52"], wall: ["plaster", "#5e2c25"], ceil: ["tin", "#8a7a5e"], wains: ["panel", "#6a4a34", 1.15], base: "#1c120c", crown: "#3a2416" });
          const v0 = cd * 0.6 - 0.35, v1 = cd * 0.6 + 0.35, u0 = -hw + 1.4, u1 = hw - 1.4;
          B(u0, u1, v0, v1, 0, 1.05, "panel", "#6a4630", true);
          B(u0, u1, v0 + 0.05, v1, 0, 0.1, "matte", "#100c0a");
          B(u0 - 0.05, u1 + 0.05, v0 - 0.12, v1 + 0.04, 1.05, 1.11, "grainG", "#3a2214");
          c.Ch(u0 - 0.05, u1 + 0.05, v0 - 0.1, 1.09, 0.05, "grainG", "#2e1a10");
          c.Ch(u0 + 0.2, u1 - 0.2, v0 - 0.3, 0.22, 0.025, "brass", "#d9b060");
          for (let u = u0 + 0.3; u < u1 - 0.2; u += 1.4) c.Cv(u, v0 - 0.3, v0, 0.22, 0.015, "brass", "#d9b060");
          for (let u = u0 + 0.5; u < u1 - 0.3; u += 1) {
            const sv = v0 - 0.72;
            c.Cy(u, sv, 0.72, 0.8, 0.2, "leather", "#6b1a1a", { seg: 14 });
            c.Cy(u, sv, 0.05, 0.72, 0.028, "chrome", "#d0d0d0", { seg: 8 });
            c.Cy(u, sv, 0, 0.04, 0.2, "chrome", "#bcbcbc", { seg: 14 });
            c.T(u, 0.3, sv, 0.17, "chrome", "#d0d0d0");
            c.blob(u - 0.2, u + 0.2, sv - 0.2, sv + 0.2, 8e-3, 0.1);
          }
          const tu = 0.4;
          c.B(tu - 0.3, tu + 0.3, v0 + 0.2, v0 + 0.32, 1.11, 1.55, "chrome", "#d0d0d0");
          for (let i = 0; i < 4; i++) {
            const u = tu - 0.22 + i * 0.147;
            c.Cv(u, v0 + 0.08, v0 + 0.2, 1.42, 0.014, "chrome", "#d0d0d0");
            c.B(u - 0.02, u + 0.02, v0 + 0.06, v0 + 0.1, 1.42, 1.62, "gloss", pick3(["#1a1a1a", "#c8a040", "#8a1a14", "#1a3a6a"]));
          }
          for (const u of [u0 + 1.2, -0.6, u1 - 0.9]) {
            c.Cy(u, v0 + 0.1, 1.11, 1.26, 0.04, "glass", "#f0e0b0", { seg: 10 });
            c.Cy(u, v0 + 0.1, 1.11, 1.22, 0.035, "bottle", "#c88a20", { seg: 10 });
          }
          const K2 = L.back;
          c.LB(K2, -hw + 0.6, hw - 0.6, 0, 0.55, 0, 0.95, "panel", "#5a3a26", true);
          c.LB(K2, -hw + 0.58, hw - 0.58, 0, 0.58, 0.95, 1, "grainG", "#2a1810");
          c.LB(K2, -hw + 0.6, hw - 0.6, 0, 0.015, 1, 2.62, "mirror", "#8a8478");
          c.LB(K2, -hw + 0.55, hw - 0.55, 0, 0.04, 2.62, 2.7, "grainG", "#2a1810");
          for (const y of [1.35, 1.82, 2.29]) {
            c.LB(K2, -hw + 0.65, hw - 0.65, 0.015, 0.3, y - 0.012, y, "glass", "#f0f0e0");
            c.LB(K2, -hw + 0.65, hw - 0.65, 0.2, 0.29, y - 0.03, y - 0.012, "lamp", "#ffb050", { k: 1.6 });
            for (let a = -hw + 0.75; a < hw - 0.8; a += rr(0.09, 0.14)) {
              const t = ri(0, 3), gc = pick3(["#2a4a1a", "#6a3008", "#a85a10", "#d8e0e0", "#1a1a3a", "#5a0a10"]), h = t === 0 ? rr(0.28, 0.34) : rr(0.22, 0.27), lab = cellUV(ri(0, 64), 8, 8);
              if (t === 1) {
                c.LB(K2, a - 0.04, a + 0.04, 0.1, 0.18, y, y + h * 0.7, "bottle", gc);
                c.LB(K2, a - 0.041, a + 0.041, 0.099, 0.181, y + h * 0.2, y + h * 0.45, "goods", "#ffffff", { cell: lab });
              } else {
                c.LC(K2, a, 0.14, y, y + h * 0.65, 0.038, "bottle", gc, { seg: 8 });
                c.LC(K2, a, 0.14, y + h * 0.25, y + h * 0.5, 0.039, "goods", "#ffffff", { cell: lab, seg: 8 });
                c.LC(K2, a, 0.14, y + h * 0.65, y + h * 0.75, 0.038, "bottle", gc, { rt: 0.35, seg: 8 });
              }
              c.LC(K2, a, 0.14, y + h * 0.7, y + h, 0.012, "bottle", gc, { seg: 6 });
            }
          }
          c.LP(K2, 0, 0.05, 3.1, 2, 1, "neon", "#ffffff", { k: 1.4 });
          c.pool(0, cd - 1, 4, 2, "#ff60c0", 0.12);
          for (const u of [u0 + 0.4, 0, u1 - 0.4]) pendant(c, u, (v0 + v1) / 2, 1.25, "#7a3a10", 0.14, 3.2, "#ffb060", 0.9, "brass");
          for (let a = 1.5; a + 1.9 < v0 - 0.6; a += 2.4) {
            const Lf = L.left;
            for (const [b0, b1, bb0, bb1] of [[a - 0.8, a - 0.35, a - 0.8, a - 0.68], [a + 0.35, a + 0.8, a + 0.68, a + 0.8]]) {
              c.LB(Lf, b0, b1, 0, 1.1, 0, 0.46, "leather", "#5a1414", true);
              c.LB(Lf, bb0, bb1, 0, 1.1, 0.46, 1.25, "leather", "#4a1010");
            }
            c.LB(Lf, a - 0.33, a + 0.33, 0.05, 0.95, 0.72, 0.76, "grainG", "#3a2214", true);
            c.LC(Lf, a, 0.6, 0, 0.72, 0.04, "steel", "#222222");
            c.LB(Lf, a - 0.1, a + 0.1, 0, 0.12, 1.65, 1.95, "brass", "#c9a25a");
            c.LB(Lf, a - 0.08, a + 0.08, 0.12, 0.14, 1.68, 1.9, "lamp", "#ffc070", { k: 2 });
            const [pu2, pv2] = c.at(Lf, a, 0.6);
            c.pool(pu2, pv2, 1.6, 1.6, "#ffb060", 0.14);
            picture(c, Lf, a, 2.4, 0.6, 0.45, "art", cellUV(3, 2, 2), "#1a1008");
          }
          const pu = hw - 2.5, pv = 2.6;
          if (pu - 0.7 > du + 1 && v0 > pv + 1.6) {
            B(pu - 0.7, pu + 0.7, pv - 1.2, pv + 1.2, 0.66, 0.8, "grainG", "#3a2012", true);
            B(pu - 0.6, pu + 0.6, pv - 1.1, pv + 1.1, 0.8, 0.81, "fabric", "#1f6a3a");
            for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
              B(pu + a * 0.55 - 0.07, pu + a * 0.55 + 0.07, pv + b * 1.05 - 0.07, pv + b * 1.05 + 0.07, 0, 0.66, "grainG", "#2a160c");
              c.Cy(pu + a * 0.6, pv + b * 1.1, 0.79, 0.812, 0.05, "matte", "#050505");
            }
            for (let i = 0; i < 9; i++) c.Sp(pu + rr(-0.45, 0.45), 0.838, pv + rr(-0.9, 0.9), 0.028, 0.028, 0.028, "gloss", pick3(["#f0f0e8", "#c8202a", "#f2c318", "#1a3a8a", "#1a1a1a", "#2a7a3a"]), { seg: 8 });
            c.Ch(pu - 0.3, pu + 0.5, pv + 0.4, 0.84, 0.01, "grainG", "#c8a070");
            B(pu - 0.25, pu + 0.25, pv - 0.8, pv + 0.8, ch - 1.45, ch - 1.3, "gloss", "#1f4a2a");
            B(pu - 0.22, pu + 0.22, pv - 0.77, pv + 0.77, ch - 1.46, ch - 1.45, "lamp", "#fff0c8", { k: 2.4 });
            for (const v of [pv - 0.7, pv + 0.7]) c.Cy(pu, v, ch - 1.3, ch, 5e-3, "matte", "#111111", { seg: 4 });
            c.pool(pu, pv, 2, 3.2, "#fff0c8", 0.22, 0.815);
            c.pool(pu, pv, 3.4, 4.4, "#ffd8a0", 0.08);
            c.npc(pu - 1.2, pv - 0.6, 1, 0);
          }
          const dv = Math.min(v0 - 0.8, 4.4);
          c.Ch(hw - 0.09, hw - 0.05, dv, 1.75, 0.23, "matte", "#141414", { seg: 20 });
          c.Ch(hw - 0.1, hw - 0.09, dv, 1.75, 0.18, "matte", "#d8c9a0", { seg: 20 });
          c.Ch(hw - 0.11, hw - 0.1, dv, 1.75, 0.08, "matte", "#a01818", { seg: 16 });
          c.Ch(hw - 0.12, hw - 0.11, dv, 1.75, 0.02, "matte", "#1a6a2a", { seg: 8 });
          picture(c, L.right, cd - 1.2, 2, 0.5, 1, "poster", cellUV(2, 4, 1), "#111111", 0);
          c.npc(0, v1 + 0.6);
          c.npc(u0 + 1.5, v0 - 0.75, 0, 1);
        },
        apt(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["wood", "#c49870"], wall: ["plaster", "#a8977e"], back: ["plaster", "#4c6461"], ceil: ["plaster", "#cfc8bd"], base: "#e2dccf", crown: "#e2dccf" });
          c.Cy(0, cd * 0.5, ch - 0.55, ch - 0.05, 6e-3, "matte", "#111111", { seg: 4 });
          c.Cy(0, cd * 0.5, ch - 0.82, ch - 0.55, 0.32, "lamp", "#e8c890", { seg: 20, k: 0.75 });
          c.Cy(0, cd * 0.5, ch - 0.825, ch - 0.82, 0.3, "lamp", "#fff0d0", { seg: 20, k: 2.2 });
          c.pool(0, cd * 0.5, 4, 4, "#ffd8a0", 0.14);
          const W = L.left;
          for (const a of [cd * 0.3, cd * 0.7]) {
            const w = 1.15, y0 = 0.9, y1 = 2.45;
            c.LP(W, a, 8e-3, (y0 + y1) / 2, w, y1 - y0, "view", "#e8e0d8", { cell: [a / cd * 0.6, 0.15, a / cd * 0.6 + 0.35, 0.75] });
            for (const [b02, b12] of [[a - w / 2 - 0.07, a - w / 2], [a + w / 2, a + w / 2 + 0.07], [a - 0.025, a + 0.025]]) c.LB(W, b02, b12, 0, 0.09, y0, y1, "gloss", "#e8e2d6");
            for (const [z0, z1] of [[y1, y1 + 0.07], [(y0 + y1) / 2 - 0.025, (y0 + y1) / 2 + 0.025]]) c.LB(W, a - w / 2, a + w / 2, 0, 0.09, z0, z1, "gloss", "#e8e2d6");
            c.LB(W, a - w / 2 - 0.12, a + w / 2 + 0.12, 0, 0.2, y0 - 0.06, y0, "gloss", "#e8e2d6");
            c.LH(W, a - w / 2 - 0.5, a + w / 2 + 0.5, 0.16, y1 + 0.28, 0.015, "brass", "#b89050");
            for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
              const ac = a + s * (w / 2 + 0.06 + i * 0.065);
              c.LC(W, ac, 0.13 + i % 2 * 0.04, 0.03, y1 + 0.26, 0.042, "fabric", "#8a3a2c", { seg: 8 });
            }
            const [pu, pv] = c.at(W, a, 1.2);
            c.pool(pu, pv, 1.8, 1.6, "#ffc890", 0.1);
          }
          const la = -hw + 1.7;
          B(la - 1.4, la + 1.4, cd - 3.3, cd - 0.5, 4e-3, 0.016, "rug", "#ffffff");
          sofa(c, L.back, la, 2.2, "#5f6f78");
          picture(c, L.back, la, 1.75, 1.1, 0.75, "art", cellUV(0, 2, 2), "#c9a25a");
          const tv = cd - 1.95;
          B(la - 0.55, la + 0.55, tv - 0.28, tv + 0.28, 0.38, 0.42, "grainG", "#4a2e1c", true);
          for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.Cy(la + a * 0.48, tv + b * 0.22, 0, 0.38, 0.02, "grainG", "#2a1a10", { seg: 6 });
          c.B(la - 0.25, la + 0.05, tv - 0.15, tv + 0.1, 0.42, 0.46, "goods", "#ffffff", { cell: cellUV(20, 8, 8) });
          c.Cy(la + 0.3, tv, 0.42, 0.52, 0.04, "gloss", "#c8402a", { seg: 10 });
          c.blob(la - 0.55, la + 0.55, tv - 0.28, tv + 0.28, 0.018, 0.2);
          const t0 = -hw + 0.6, t1 = Math.min(-hw + 2.6, du - 1.2);
          if (t1 - t0 > 1) {
            c.LB(L.front, t0, t1, 0, 0.42, 0, 0.5, "grainG", "#3a2a20", true);
            c.LB(L.front, (t0 + t1) / 2 - 0.08, (t0 + t1) / 2 + 0.08, 0.15, 0.3, 0.5, 0.58, "gloss", "#111111");
            c.LB(L.front, (t0 + t1) / 2 - 0.65, (t0 + t1) / 2 + 0.65, 0.18, 0.23, 0.6, 1.36, "gloss", "#101012");
            c.LP(L.front, (t0 + t1) / 2, 0.232, 0.98, 1.22, 0.69, "screen", "#ffffff", { cell: cellUV(2, 2, 2), k: 0.9 });
          }
          const K2 = L.right, k0 = Math.max(1.6, cd - 3.4), k1 = cd - 0.05;
          c.LB(K2, k0, k1, 0, 0.6, 0.1, 0.88, "paint", "#e2ddd2", true);
          c.LB(K2, k0, k1, 0.04, 0.56, 0, 0.1, "matte", "#1a1816");
          for (let a = k0; a < k1 - 0.1; a += 0.6) {
            c.LB(K2, a + 5e-3, a + 0.01, 0.6, 0.605, 0.12, 0.86, "matte", "#6a665e");
            c.LB(K2, a + 0.25, a + 0.35, 0.6, 0.625, 0.78, 0.8, "chrome", "#c8c8c8");
          }
          c.LB(K2, k0, k1, 0, 0.63, 0.88, 0.92, "gloss", "#2b2b2b");
          c.LB(K2, k0, k1, 0, 0.012, 0.92, 1.45, "subway", "#ffffff");
          c.LB(K2, k0, k1, 0, 0.35, 1.45, 2.25, "paint", "#e2ddd2");
          for (let a = k0; a < k1 - 0.1; a += 0.5) c.LB(K2, a + 5e-3, a + 0.01, 0.35, 0.355, 1.47, 2.23, "matte", "#6a665e");
          c.LB(K2, k0, k1, 0.3, 0.34, 1.44, 1.45, "lamp", "#fff0d0", { k: 2 });
          {
            const [pu, pv] = c.at(K2, (k0 + k1) / 2, 0.4);
            c.pool(pu, pv, 1.4, k1 - k0, "#ffe0b0", 0.08, 0.93);
          }
          const sa = k0 + 0.9;
          c.LB(K2, sa - 0.3, sa + 0.3, 0.1, 0.5, 0.86, 0.925, "steel", "#bfc2c4");
          c.LC(K2, sa, 0.08, 0.92, 1.2, 0.015, "chrome", "#d0d0d0");
          c.LD(K2, sa, 0.08, 0.28, 1.2, 0.013, "chrome", "#d0d0d0");
          const so = k0 + 2.1;
          if (so + 0.35 < k1) {
            c.LB(K2, so - 0.32, so + 0.32, 0.03, 0.6, 0.921, 0.93, "gloss", "#0e0e0e");
            for (const [x, y] of [[-0.15, 0.2], [0.15, 0.2], [-0.15, 0.45], [0.15, 0.45]]) {
              const [pu, pv] = c.at(K2, so + x, y);
              c.T(pu, 0.932, pv, 0.08, "steel", "#3a3a3a");
            }
            c.LB(K2, so - 0.33, so + 0.33, 0, 0.45, 2, 2.25, "steel", "#c0c2c4");
          }
          {
            const a0 = k0 - 0.75, a1 = k0 - 0.04;
            if (a0 > 1.4) {
              c.LB(K2, a0, a1, 0, 0.68, 0, 1.95, "gloss", "#cfd0cc", true);
              c.LB(K2, a0, a1, 0.68, 0.69, 1.25, 1.27, "matte", "#555555");
              c.LB(K2, a0 + 0.05, a0 + 0.08, 0.69, 0.73, 1.35, 1.75, "chrome", "#d0d0d0");
            }
          }
          const b0 = la + 1.4, b1 = Math.min(hw - 0.75, b0 + 2.4);
          if (b1 - b0 > 0.8) {
            c.LB(L.back, b0, b1, 0, 0.32, 0, 2, "paint", "#e8e2d6", true);
            for (const y of [0.1, 0.5, 0.9, 1.3, 1.7]) {
              c.LB(L.back, b0 + 0.03, b1 - 0.03, 0.02, 0.3, y - 0.03, y, "paint", "#ece6da");
              c.LB(L.back, b0 + 0.03, b1 - 0.03, 0.02, 0.025, y, y + 0.36, "matte", "#2a2622");
              for (let a = b0 + 0.05; a < b1 - 0.08; ) {
                if (R() < 0.08) {
                  c.LC(L.back, a + 0.06, 0.15, y, y + 0.2, 0.05, "gloss", pick3(["#2a5a6a", "#c8a060", "#e8e2d6"]), { seg: 10 });
                  a += 0.14;
                  continue;
                }
                const w = rr(0.025, 0.05), h = rr(0.2, 0.32);
                c.LB(L.back, a, a + w, 0.05, 0.27, y, y + h, "matte", pick3(["#7a1e1e", "#1f3f5a", "#2f4a2a", "#c8a060", "#e8e2d6", "#3a2a20", "#5a3a6a", "#a85a20"]));
                a += w + 3e-3;
              }
            }
          }
          const fu = -hw + 0.45, fv = cd - 0.45;
          c.Cy(fu, fv, 0, 0.03, 0.16, "steel", "#222222");
          c.Cy(fu, fv, 0.03, 1.45, 0.012, "brass", "#b89050", { seg: 6 });
          c.Cy(fu, fv, 1.45, 1.75, 0.2, "lamp", "#f2d8a8", { rt: 0.7, seg: 16, k: 1 });
          c.pool(fu + 0.4, fv - 0.4, 2, 2, "#ffd090", 0.14);
          const au = -hw + 0.85, av = cd * 0.5;
          c.O(au, av, 1, 0, -0.42, 0.42, -0.4, 0.4, 0.1, 0.44, "fabric", "#8a6a3a", true);
          c.O(au, av, 1, 0, -0.42, 0.42, -0.42, -0.24, 0.44, 0.95, "fabric", "#8a6a3a");
          c.O(au, av, 1, 0, -0.42, -0.3, -0.4, 0.4, 0.44, 0.65, "fabric", "#8a6a3a");
          c.O(au, av, 1, 0, 0.3, 0.42, -0.4, 0.4, 0.44, 0.65, "fabric", "#8a6a3a");
          c.blob(au - 0.4, au + 0.4, av - 0.42, av + 0.42, 8e-3, 0.15);
          if (hw - 1.9 > du + 1.4) {
            table(c, hw - 1.9, 1.7, "round", "#6a4a30", 0.8);
            chair(c, hw - 1.9, 1.08, 0, 1, "#4a3222");
            chair(c, hw - 1.9, 2.32, 0, -1, "#4a3222");
            c.Sp(hw - 1.9, 0.82, 1.7, 0.1, 0.06, 0.1, "gloss", "#c8a040");
          }
          plant(c, -hw + 0.45, cd * 0.5 + 0.75, 1.1, "#c86a3a");
          plant(c, la + 1.25, cd - 0.45, 0.8, "#e8e2d6", "snake");
          c.npc(hw - 1.5, cd - 1.7, 1, 0);
        },
        office(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["carpet", "#8a929c"], wall: ["plaster", "#a9adae"], back: ["plaster", "#3c5266"], ceil: ["acoustic", "#cfccc6"], base: "#2f3236" });
          for (const u of [-hw * 0.6, 0, hw * 0.6]) for (const v of [cd * 0.2, cd * 0.5, cd * 0.8]) lampPanel(c, u, v, 1.2, 0.6, 2, "#f6f6f2", 0.85);
          const desk = (u, vb, fv) => {
            const vf = vb + fv * 0.75, va = Math.min(vb, vf), vz = Math.max(vb, vf);
            B(u - 0.72, u + 0.72, va, vz, 0.72, 0.75, "grainG", "#c9b79a");
            for (const s of [-1, 1]) B(u + s * 0.68 - 0.02, u + s * 0.68 + 0.02, va + 0.03, vz - 0.03, 0, 0.72, "steel", "#3a3d40");
            c.solid(u - 0.72, u + 0.72, va, vz, 0, 0.75);
            c.blob(u - 0.72, u + 0.72, va, vz, 0.012, 0.15);
            const mv = vb + fv * 0.18;
            c.Cy(u, mv, 0.75, 0.76, 0.1, "steel", "#222222");
            c.B(u - 0.02, u + 0.02, mv - 0.02, mv + 0.02, 0.76, 0.98, "steel", "#222222");
            c.B(u - 0.3, u + 0.3, mv - 0.012, mv + 0.012, 0.92, 1.27, "gloss", "#141518");
            c.Pl(u, mv + fv * 0.013, 1.095, 0.56, 0.32, fv > 0 ? "+v" : "-v", "screen", "#ffffff", { cell: cellUV(R() < 0.5 ? 0 : 1, 2, 2), k: 0.85 });
            const kv = vb + fv * 0.45;
            c.B(u - 0.22, u + 0.22, kv - 0.07, kv + 0.07, 0.75, 0.77, "gloss", "#1e1f22");
            c.B(u + 0.3, u + 0.36, kv - 0.04, kv + 0.04, 0.75, 0.77, "gloss", "#1e1f22");
            if (R() < 0.6) c.Cy(u - 0.5, vb + fv * 0.35, 0.75, 0.85, 0.04, "gloss", pick3(["#f0ece4", "#c8402a", "#2a5a8a"]), { seg: 10 });
            if (R() < 0.7) c.B(u + 0.4, u + 0.62, vb + fv * 0.2, vb + fv * 0.5, 0.75, 0.78, "matte", "#e8e6e0");
            const cv_ = vb + fv * 1.05;
            c.B(u - 0.3, u + 0.3, cv_ - 0.03, cv_ + 0.03, 0.04, 0.07, "steel", "#1a1a1a");
            c.B(u - 0.03, u + 0.03, cv_ - 0.3, cv_ + 0.3, 0.04, 0.07, "steel", "#1a1a1a");
            c.Cy(u, cv_, 0.07, 0.42, 0.025, "chrome", "#a0a0a0", { seg: 8 });
            c.B(u - 0.24, u + 0.24, cv_ - 0.24, cv_ + 0.24, 0.42, 0.5, "fabric", "#2a2d31");
            const bv = cv_ + fv * 0.24;
            c.B(u - 0.22, u + 0.22, bv - 0.03, bv + 0.03, 0.56, 1.05, "fabric", "#2a2d31");
            for (const s of [-1, 1]) c.B(u + s * 0.25 - 0.02, u + s * 0.25 + 0.02, cv_ - 0.15, cv_ + 0.12, 0.6, 0.63, "gloss", "#1a1a1a");
            c.blob(u - 0.3, u + 0.3, cv_ - 0.3, cv_ + 0.3, 0.012, 0.1);
          };
          for (const vc of [3.6, 6.9]) for (const u of [-hw * 0.62, 0, hw * 0.62]) {
            if (vc + 1.8 > cd - 0.6) continue;
            desk(u, vc - 0.02, -1);
            desk(u, vc + 0.02, 1);
            c.B(u - 0.74, u + 0.74, vc - 0.02, vc + 0.02, 0.75, 1.25, "fabric", "#5c6b78");
            c.B(u - 0.75, u + 0.75, vc - 0.025, vc + 0.025, 1.25, 1.27, "steel", "#9aa0a4");
          }
          const wb = Math.min(4, c.r.cw - 4);
          picture(c, L.back, 0, 1.65, wb, 1.15, "white", null, "#b8bcc0", 0);
          c.LB(L.back, -wb / 2, wb / 2, 0.03, 0.09, 1.02, 1.05, "steel", "#9aa0a4");
          c.LD(L.back, wb / 2 + 0.6, 0, 0.04, 2.75, 0.2, "gloss", "#1a1a1a", { seg: 20 });
          c.LD(L.back, wb / 2 + 0.6, 0.04, 0.05, 2.75, 0.18, "gloss", "#f2f2ee", { seg: 20 });
          {
            const [pu, pv] = c.at(L.back, wb / 2 + 0.6, 0.055);
            c.B(pu - 6e-3, pu + 6e-3, pv - 4e-3, pv + 4e-3, 2.75, 2.88, "matte", "#111111");
            c.B(pu, pu + 0.1, pv - 4e-3, pv + 4e-3, 2.745, 2.755, "matte", "#111111");
          }
          for (let a = cd - 3.2; a < cd - 0.6; a += 0.52) {
            c.LB(L.right, a, a + 0.5, 0, 0.62, 0, 1.32, "paint", "#8e9498", true);
            for (const y of [0.33, 0.66, 0.99]) {
              c.LB(L.right, a + 0.02, a + 0.48, 0.62, 0.625, y - 5e-3, y, "matte", "#3a3d40");
              c.LB(L.right, a + 0.18, a + 0.32, 0.62, 0.645, y + 0.2, y + 0.23, "chrome", "#d0d0d0");
            }
          }
          {
            const [p, q] = c.at(L.right, cd - 3.2, 0), [p2, q2] = c.at(L.right, cd - 0.6, 0.62);
            c.blob(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0.012, 0.2);
          }
          c.LB(L.left, 1.4, 2.4, 0, 0.7, 0, 1, "gloss", "#d0d2cc", true);
          c.LB(L.left, 1.4, 2.4, 0, 0.7, 1, 1.06, "gloss", "#3a3d40");
          c.LB(L.left, 2, 2.3, 0.5, 0.65, 1.06, 1.1, "lamp", "#80c0ff", { k: 0.8 });
          c.LB(L.left, 2.9, 3.25, 0.05, 0.4, 0, 0.95, "gloss", "#e8e8e4", true);
          c.LC(L.left, 3.075, 0.22, 0.95, 1.38, 0.14, "glass", "#a0d0ff", { seg: 14 });
          c.LC(L.left, 3.075, 0.22, 0.95, 1.3, 0.12, "bottle", "#7ab8e8", { seg: 14 });
          plant(c, -hw + 0.55, cd - 0.55, 1.3, "#3a3d40", "snake");
          plant(c, hw - 0.55, 0.7, 1.2, "#e8e8e4");
          picture(c, L.left, cd * 0.5, 1.8, 1, 0.8, "art", cellUV(3, 2, 2), "#111111");
          picture(c, L.left, cd * 0.75, 1.8, 0.9, 0.9, "art", cellUV(0, 2, 2), "#111111");
          c.npc(-hw * 0.62, 1.9, 0, 1);
          c.npc(hw * 0.62 + 0.95, 8.3, -1, 0);
          c.npc(0, 5.25, 1, 0);
        },
        gym(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["rubber", "#b0b4ba"], wall: ["plaster", "#8a8e96"], back: ["plaster", "#7a7e86"], ceil: ["plaster", "#5a5d62"], base: "#161616", band: "#b3261e", bandY: 2.7 });
          c.Cv(-hw * 0.35, 0.2, cd - 0.2, ch - 0.45, 0.28, "steel", "#a9acb0", { seg: 16 });
          for (let v = 1; v < cd - 0.5; v += 2.2) c.Cy(-hw * 0.35, v, ch - 0.2, ch, 0.02, "steel", "#333333");
          c.Cv(hw * 0.42, 0.2, cd - 0.2, ch - 0.3, 0.07, "paint", "#8a1f1a");
          for (const u of [-hw * 0.62, 0, hw * 0.62]) for (const v of [cd * 0.28, cd * 0.7]) {
            B(u - 0.09, u + 0.09, v - 1.2, v + 1.2, ch - 0.68, ch - 0.6, "steel", "#222222");
            B(u - 0.07, u + 0.07, v - 1.18, v + 1.18, ch - 0.69, ch - 0.68, "lamp", "#f2f6ff", { k: 3 });
            for (const s of [-1, 1]) c.Cy(u, v + s * 1, ch - 0.6, ch, 4e-3, "matte", "#111111", { seg: 4 });
            c.pool(u, v, 3.2, 4.2, "#eef2ff", 0.12);
          }
          c.LB(L.back, -hw + 0.55, hw - 0.55, 0, 0.012, 0.3, 2.55, "mirror", "#8a9098");
          c.LB(L.back, -hw + 0.5, hw - 0.5, 0, 0.03, 2.55, 2.6, "steel", "#2a2a2a");
          c.LB(L.back, -hw + 0.5, hw - 0.5, 0, 0.03, 0.25, 0.3, "steel", "#2a2a2a");
          const n = Math.max(2, Math.min(4, Math.floor((c.r.cw - 3) / 2.2))), tv = cd - 3.4;
          for (let i = 0; i < n; i++) {
            const u = (i - (n - 1) / 2) * 2.2;
            B(u - 0.42, u + 0.42, tv, tv + 1.85, 0.06, 0.22, "gloss", "#1d1f22", true);
            B(u - 0.27, u + 0.27, tv + 0.06, tv + 1.62, 0.22, 0.235, "rubber", "#777777");
            B(u - 0.42, u + 0.42, tv - 0.02, tv + 0.12, 0, 0.12, "steel", "#2a2c30");
            for (const s of [-1, 1]) {
              B(u + s * 0.37 - 0.04, u + s * 0.37 + 0.04, tv + 1.62, tv + 1.72, 0.22, 1.2, "steel", "#2a2c30");
              c.Cv(u + s * 0.33, tv + 1.15, tv + 1.68, 1.05, 0.018, "chrome", "#bcbcbc");
            }
            B(u - 0.4, u + 0.4, tv + 1.58, tv + 1.78, 1.18, 1.44, "gloss", "#202226");
            c.Pl(u, tv + 1.578, 1.31, 0.42, 0.2, "-v", "screen", "#ffffff", { cell: cellUV(3, 2, 2) });
            c.blob(u - 0.42, u + 0.42, tv, tv + 1.85, 8e-3, 0.2);
          }
          const D = L.left, r02 = 1.5, r1 = Math.min(cd - 3.8, r02 + 3.6);
          if (r1 - r02 > 1) {
            for (const [y, d0, d1] of [[0.45, 0.1, 0.6], [0.85, 0.08, 0.45]]) c.LB(D, r02, r1, d0, d1, y - 0.04, y, "steel", "#1c1c1e");
            for (const a of [r02 + 0.05, (r02 + r1) / 2, r1 - 0.05]) c.LB(D, a - 0.04, a + 0.04, 0.1, 0.55, 0, 0.85, "steel", "#1c1c1e");
            {
              const [p, q] = c.at(D, r02, 0), [p2, q2] = c.at(D, r1, 0.62);
              c.solid(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 0, 0.9);
              c.blob(Math.min(p, p2), Math.max(p, p2), Math.min(q, q2), Math.max(q, q2), 8e-3, 0.2);
            }
            let i = 0;
            for (let a = r02 + 0.25; a < r1 - 0.2; a += 0.36, i++) for (const [y, dd] of [[0.45, 0.35], [0.85, 0.27]]) {
              const hr = 0.05 + i % 6 * 8e-3 + (y > 0.6 ? -0.01 : 0.01);
              c.LD(D, a, dd - 0.18, dd + 0.18, y + hr, 0.014, "chrome", "#c0c0c0", { seg: 6 });
              for (const s of [-1, 1]) c.LD(D, a, dd + s * 0.1 - 0.05, dd + s * 0.1 + 0.05, y + hr, hr, "gloss", "#202022", { seg: 6 });
            }
          }
          const bu = hw - 2.3, bv = Math.min(4.2, tv - 1.6);
          B(bu - 0.16, bu + 0.16, bv - 0.62, bv + 0.62, 0.38, 0.48, "leather", "#1c1c1e", true);
          B(bu - 0.05, bu + 0.05, bv - 0.55, bv + 0.55, 0, 0.38, "steel", "#2a2a2a");
          for (const s of [-1, 1]) {
            B(bu + s * 0.55 - 0.03, bu + s * 0.55 + 0.03, bv - 0.62, bv - 0.56, 0, 1.12, "steel", "#2a2a2a");
            B(bu + s * 0.55 - 0.2, bu + s * 0.55 + 0.2, bv - 0.64, bv - 0.54, 0, 0.04, "steel", "#2a2a2a");
          }
          c.Ch(bu - 1.1, bu + 1.1, bv - 0.59, 1.12, 0.014, "chrome", "#d0d0d0");
          for (const s of [-1, 1]) for (const [o, r, col] of [[0.78, 0.225, "#b3261e"], [0.84, 0.2, "#1f4a8a"]]) c.Ch(bu + s * o - 0.025, bu + s * o + 0.025, bv - 0.59, 1.12, r, "matte", col, { seg: 18 });
          c.blob(bu - 0.6, bu + 0.6, bv - 0.7, bv + 0.62, 8e-3, 0.2);
          const pu = Math.max(2.5, du + 1.6), pv = 2.45;
          c.Cy(pu, pv, 0.55, 1.75, 0.18, "leather", "#7a1a1a", { seg: 14 });
          c.Cy(pu, pv, 1.75, 1.82, 0.15, "matte", "#1a1a1a", { seg: 14 });
          c.Cy(pu, pv, 1.82, ch, 8e-3, "chrome", "#909090", { seg: 4 });
          c.blob(pu - 0.2, pu + 0.2, pv - 0.2, pv + 0.2, 8e-3, 0.2);
          for (let i = 0; i < 6; i++) {
            const u = -hw + 0.5 + i * 0.32;
            if (u > du - 1.1) break;
            c.Sp(u, 0.11, 0.35, 0.1, 0.1, 0.1, "matte", ["#1a1a1a", "#b3261e", "#1f4a8a", "#2a7a3a", "#c8a020", "#1a1a1a"][i], { seg: 10 });
            c.T(u, 0.24, 0.35, 0.06, "matte", "#1a1a1a", { th: 1 });
          }
          for (let i = 0; i < 4; i++) c.Ch(-hw + 0.15, -hw + 0.75, cd - 0.5 - i * 0.16, 0.08, 0.075, "fabric", pick3(["#5a2a6a", "#2a6a7a", "#7a3a2a"]));
          picture(c, L.right, 1.6, 1.7, 0.6, 1.2, "poster", cellUV(3, 4, 1), "#111111", 0);
          picture(c, L.left, cd - 1.6, 1.8, 0.5, 1, "poster", cellUV(3, 4, 1), "#111111", 0);
          c.npc(Math.min(2, pu - 0.8), 4, 0, -1);
        },
        fisk(c) {
          const { B, hw, cd, ch, du, L } = c;
          shell(c, { floor: ["marble"], wall: ["plaster", "#3a2a22"], back: ["plaster", "#2a1e18"], ceil: ["plaster", "#2a221d"], wains: ["panel", "#7a4a2c", 3.2], base: "#1a120c", crown: "#c9a25a" });
          for (let u = -hw + 3.6; u < hw - 1; u += 3.6) B(u - 0.15, u + 0.15, 0, cd, ch - 0.5, ch - 0.05, "grainG", "#3a2416");
          for (let v = 3.6; v < cd - 1; v += 3.6) B(-hw, hw, v - 0.15, v + 0.15, ch - 0.5, ch - 0.05, "grainG", "#3a2416");
          for (let u = -hw + 1.8; u < hw; u += 3.6) for (let v = 1.8; v < cd; v += 3.6) {
            B(u - 0.7, u + 0.7, v - 0.7, v + 0.7, ch - 0.07, ch - 0.05, "panelL", "#ffe2b0", { k: 1.5 });
            c.pool(u, v, 4.5, 4.5, "#ffd8a0", 0.07);
          }
          for (const [u, v] of [[-hw + 2.5, cd * 0.3], [hw - 2.5, cd * 0.3], [-hw + 2.5, cd * 0.62], [hw - 2.5, cd * 0.62]]) {
            B(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 0, 0.4, "marble", "#ffffff");
            c.Cy(u, v, 0.4, ch - 0.6, 0.48, "marble", "#d8d0c4", { seg: 20 });
            c.Cy(u, v, 0.4, 0.5, 0.52, "brass", "#c9a25a", { seg: 20 });
            c.Cy(u, v, ch - 0.7, ch - 0.6, 0.52, "brass", "#c9a25a", { seg: 20 });
            B(u - 0.65, u + 0.65, v - 0.65, v + 0.65, ch - 0.6, ch - 0.05, "grainG", "#3a2416");
            c.solid(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 0, ch);
            c.blob(u - 0.65, u + 0.65, v - 0.65, v + 0.65, 8e-3, 0.4);
          }
          const pw = c.r.cw - 4;
          c.LP(L.back, 0, 0.03, 4, pw, 5.4, "view", "#d8d0c8");
          for (let a = -pw / 2; a <= pw / 2 + 0.01; a += pw / Math.round(pw / 2.4)) c.LB(L.back, a - 0.06, a + 0.06, 0, 0.12, 1.3, 6.7, "steel", "#141414");
          for (const y of [1.3, 3.9, 6.7]) c.LB(L.back, -pw / 2 - 0.06, pw / 2 + 0.06, 0, 0.12, y - 0.06, y + 0.06, "steel", "#141414");
          c.pool(0, cd - 2.5, pw, 5, "#ffb070", 0.08);
          B(-2.4, 2.4, cd - 3.6, cd - 2.6, 0, 0.78, "panel", "#5a3420", true);
          B(-2.5, 2.5, cd - 3.7, cd - 2.5, 0.78, 0.84, "grainG", "#2a160c");
          B(-1.6, 1.6, cd - 3.4, cd - 2.7, 0.84, 0.845, "leather", "#1f3a2a");
          c.Ch(-2.5, 2.5, cd - 3.7, 0.81, 0.02, "brass", "#c9a25a");
          c.Cy(1.6, cd - 2.85, 0.84, 0.86, 0.1, "brass", "#c9a25a");
          c.Cy(1.6, cd - 2.85, 0.86, 1.2, 0.012, "brass", "#c9a25a");
          c.Ch(1.35, 1.85, cd - 2.95, 1.22, 0.07, "gloss", "#1f6a3a", { seg: 12 });
          c.Ch(1.37, 1.83, cd - 2.95, 1.19, 0.05, "lamp", "#ffe8b0", { k: 1.5 });
          c.pool(1.6, cd - 3.05, 1.6, 1, "#ffe0a0", 0.25, 0.85);
          c.B(-1.3, -0.9, cd - 3.2, cd - 2.9, 0.845, 0.88, "matte", "#e8e2d4");
          c.B(-0.5, -0.2, cd - 3, cd - 2.8, 0.845, 0.9, "gloss", "#111111");
          c.Cy(-1.8, cd - 2.9, 0.845, 0.98, 0.04, "brass", "#c9a25a");
          c.B(-0.4, 0.4, cd - 2.05, cd - 1.35, 0, 0.52, "leather", "#1a1414", true);
          c.B(-0.42, 0.42, cd - 1.4, cd - 1.25, 0.52, 1.75, "leather", "#1a1414");
          for (const s of [-1, 1]) c.B(s * 0.44 - 0.07, s * 0.44 + 0.07, cd - 2.05, cd - 1.35, 0.52, 0.78, "leather", "#1a1414");
          B(du - 1.6, du + 1.6, 0.4, cd - 4, 4e-3, 0.02, "fabric", "#7a1616");
          for (const s of [-1, 1]) B(du + s * 1.6 - 0.08, du + s * 1.6 + 0.08, 0.4, cd - 4, 4e-3, 0.021, "fabric", "#c9a25a");
          for (const v of [cd * 0.32, cd * 0.62]) {
            c.Cy(0, v, ch - 1.6, ch - 0.05, 0.015, "brass", "#c9a25a", { seg: 6 });
            c.T(0, ch - 2.2, v, 0.9, "brass", "#c9a25a");
            c.T(0, ch - 1.9, v, 0.55, "brass", "#c9a25a");
            c.Sp(0, ch - 2, v, 0.22, 0.32, 0.22, "lamp", "#ffe0a8", { k: 1.8 });
            for (let i = 0; i < 10; i++) {
              const a = i / 10 * 6.28;
              c.Sp(Math.cos(a) * 0.9, ch - 2.13, v + Math.sin(a) * 0.9, 0.06, 0.09, 0.06, "lamp", "#ffe8c0", { k: 2.2, seg: 6 });
              c.Sp(Math.cos(a) * 0.9, ch - 2.32, v + Math.sin(a) * 0.9, 0.035, 0.07, 0.035, "glass", "#ffffff", { seg: 6 });
            }
            c.pool(0, v, 7, 7, "#ffd8a0", 0.12);
          }
          for (const s of [-1, 1]) {
            const gu = s * (hw - 5.2), gv = cd * 0.46;
            sofa(c, { ax: "u", b: gv - 1.5, dir: 1 }, gu, 2.4, "#1a1414");
            sofa(c, { ax: "u", b: gv + 1.5, dir: -1 }, gu, 2.4, "#1a1414");
            B(gu - 0.7, gu + 0.7, gv - 0.4, gv + 0.4, 0.38, 0.42, "marble", "#ffffff", true);
            for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) c.Cy(gu + a * 0.62, gv + b * 0.32, 0, 0.38, 0.02, "brass", "#c9a25a", { seg: 6 });
            c.Cy(gu, gv, 0.42, 0.62, 0.08, "gloss", "#e8e2d4", { rt: 0.6 });
            c.blob(gu - 0.7, gu + 0.7, gv - 0.4, gv + 0.4, 0.01, 0.2);
            B(gu - 1.6, gu + 1.6, gv - 1, gv + 1, 4e-3, 0.012, "rug", "#ffffff");
            const W = s < 0 ? L.left : L.right;
            for (const [a0, a1] of [[cd * 0.66, cd - 1.6]]) {
              c.LB(W, a0, a1, 0, 0.42, 0, 3.4, "grainG", "#3a2214", true);
              for (let y = 0.1; y < 3.2; y += 0.55) {
                c.LB(W, a0 + 0.04, a1 - 0.04, 0.02, 0.4, y - 0.03, y, "grainG", "#3a2214");
                c.LB(W, a0 + 0.04, a1 - 0.04, 0.02, 0.025, y, y + 0.52, "matte", "#1a120c");
                for (let a = a0 + 0.06; a < a1 - 0.1; ) {
                  const w = rr(0.03, 0.06), h = rr(0.28, 0.45);
                  c.LB(W, a, a + w, 0.08, 0.36, y, y + h, "leather", pick3(["#5a1414", "#1a2a3a", "#2a3a1a", "#4a3a20", "#3a1a2a", "#6a5030"]));
                  a += w + 4e-3;
                }
              }
            }
            picture(c, W, cd * 0.42, 4.7, 2.4, 1.8, "art", cellUV(s < 0 ? 0 : 1, 2, 2), "#c9a25a", 0.08);
            plant(c, s * (hw - 1), cd - 1, 1.4, "#2a2a2a", "palm");
            const su = du + s * 3.2;
            B(su - 0.3, su + 0.3, 1.4, 2, 0, 1.1, "marble", "#ffffff", true);
            c.Sp(su, 1.42, 1.7, 0.18, 0.26, 0.16, "brass", "#b8954a", { seg: 14 });
            c.B(su - 0.15, su + 0.15, 1.55, 1.85, 1.1, 1.18, "brass", "#b8954a");
          }
        }
      };
      playerInRoom = (d, m = 0) => {
        const r = d.room;
        return P.pos.x > r.bx0 - m && P.pos.x < r.bx1 + m && P.pos.z > r.bz0 - m && P.pos.z < r.bz1 + m && P.pos.y > -1 && P.pos.y < SW + r.ch + 0.6;
      };
      acc = 0;
      wasInFisk = false;
      canMesh = null;
      canT = 0;
      enterDoor = () => {
      };
      leaveInterior = () => {
      };
    }
  });

  // js/gracz.js
  function mkLine(mat) {
    const m = new THREE.Mesh(webGeo, mat || webLineMat);
    m.visible = false;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  }
  function setLine(m, a, b) {
    _t3.subVectors(b, a);
    const L = _t3.length();
    if (L < 1e-4) {
      m.visible = false;
      return;
    }
    m.position.copy(a);
    m.quaternion.setFromUnitVectors(UP, _t3.divideScalar(L));
    m.scale.set(1, L, 1);
    m.visible = true;
  }
  function initPlayer() {
    P.pc = newPose();
    P.pt = newPose();
    lineMain = mkLine();
    lineZ1 = mkLine();
    lineZ2 = mkLine();
    setSuit(save.suit);
    placeAtStart();
    P.hp = maxHp();
  }
  function setSuit(id) {
    let s = suitById(id) || SUITS[0];
    if (s.lvl > save.lvl) s = SUITS[0];
    let q = null;
    if (P.H) {
      q = P.H.root.quaternion.clone();
      scene.remove(P.H.root);
    }
    P.H = buildSpider(s);
    P.suit = s;
    if (q) P.H.root.quaternion.copy(q);
    P.H.root.position.copy(P.pos);
    scene.add(P.H.root);
    save.suit = s.id;
    doSave();
  }
  function placeAtStart() {
    P.pos.copy(START);
    P.vel.set(0, 0, 0);
    P.state = "ground";
    P.heading = START_H;
    P.perch = true;
    P.H.root.position.copy(P.pos);
    basisQ(P.H.root.quaternion, UP, _f2.set(Math.sin(P.heading), 0, Math.cos(P.heading)));
  }
  function addFocus(v) {
    P.focus = Math.min(3, P.focus + v * (has("focus") ? 1.5 : 1));
  }
  function collide() {
    const r = 0.35, p = P.pos;
    _res.top = null;
    _res.wall = null;
    boxesNear(p.x, p.z, 3, _cl);
    for (const b of _cl) {
      if (p.x > b.x0 - r && p.x < b.x1 + r && p.z > b.z0 - r && p.z < b.z1 + r && p.y < b.y1 && p.y + 1.7 > b.y0) {
        if (P.prev.y >= b.y1 - 0.3) {
          p.y = b.y1;
          if (P.vel.y < 0) P.vel.y = 0;
          _res.top = b;
        } else if (P.prev.y + 1.7 <= b.y0 + 0.3) {
          p.y = b.y0 - 1.7;
          if (P.vel.y > 0) P.vel.y = 0;
        } else {
          const a = p.x - (b.x0 - r), c = b.x1 + r - p.x, d = p.z - (b.z0 - r), e = b.z1 + r - p.z, m = Math.min(a, c, d, e);
          const n = new V3();
          if (m === a) {
            p.x = b.x0 - r;
            n.set(-1, 0, 0);
          } else if (m === c) {
            p.x = b.x1 + r;
            n.set(1, 0, 0);
          } else if (m === d) {
            p.z = b.z0 - r;
            n.set(0, 0, -1);
          } else {
            p.z = b.z1 + r;
            n.set(0, 0, 1);
          }
          const vn = P.vel.dot(n);
          if (vn < 0) P.vel.addScaledVector(n, -vn);
          _res.wall = { b, n };
        }
      }
    }
    if (p.y <= 0) {
      p.y = 0;
      if (P.vel.y < 0) P.vel.y = 0;
      _res.top = _res.top || GROUND;
    }
    if (p.x < LAND.x0 + 1 || p.x > LAND.x1 - 1) {
      p.x = clamp(p.x, LAND.x0 + 1, LAND.x1 - 1);
      P.vel.x *= -0.2;
    }
    if (p.z < LAND.z0 + 1 || p.z > LAND.z1 - 1) {
      p.z = clamp(p.z, LAND.z0 + 1, LAND.z1 - 1);
      P.vel.z *= -0.2;
    }
    return _res;
  }
  function findPerch() {
    const R2 = perchRange();
    camera.getWorldDirection(_cf2);
    let best = null, bs = -1e9;
    for (const p of perches) {
      const dx = p.x - P.pos.x, dz = p.z - P.pos.z;
      if (Math.abs(dx) > R2 || Math.abs(dz) > R2) continue;
      const dy = p.y - P.pos.y;
      if (dy < -20) continue;
      const d = Math.hypot(dx, dy, dz);
      if (d < 12 || d > R2) continue;
      _t3.set(p.x - camera.position.x, p.y - camera.position.y, p.z - camera.position.z);
      const dot = _t3.dot(_cf2) / _t3.length();
      if (dot < 0.93) continue;
      const sc = dot * 4 - d / R2 + clamp(dy / 30, -0.5, 0.5);
      if (sc > bs) {
        bs = sc;
        best = p;
      }
    }
    if (best) {
      _h2.set(P.pos.x, P.pos.y + 1.5, P.pos.z);
      _t3.set(best.x, best.y + 0.8, best.z).sub(_h2);
      const L = _t3.length();
      _t3.divideScalar(L);
      if (raycastCity(_h2, _t3, L) < L - 1.5) best = null;
    }
    return best;
  }
  function nearestEnemy(r) {
    let best = null, bd = r;
    for (const e of enemies) {
      if (e.dead || e.gone) continue;
      const d = e.pos.distanceTo(P.pos);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }
  function updatePlayer(dt, I) {
    P.invT -= dt;
    P.hurtT = Math.max(0, P.hurtT - dt);
    P.atkCD -= dt;
    P.comboT -= dt;
    P.dodgeCD -= dt;
    P.swingCD -= dt;
    P.webCD -= dt;
    P.webT -= dt;
    P.zipT -= dt;
    P.landT = Math.max(0, P.landT - dt);
    P.bufPunch -= dt;
    P.perchT -= dt;
    P.trickCD -= dt;
    if (P.trickT > 0) P.trickT -= dt;
    if (P.comboT <= 0) {
      P.combo = 0;
      P.step = 0;
    }
    if (P.dodgeT > 0) P.dodgeT -= dt;
    if (P.flipT >= 0) {
      P.flipT += dt;
      if (P.flipT >= P.flipDur) {
        P.flipT = -1;
        P.pc.bp = 0;
      }
    }
    const mh = maxHp();
    P.regenT -= dt;
    if (P.regenT <= 0 && P.hp < mh) P.hp = Math.min(mh, P.hp + (has("regen") ? 28 : 14) * dt);
    if (P.dead) {
      P.deadT -= dt;
      if (P.deadT <= 0) respawn();
      return;
    }
    const sy = Math.sin(cam.yaw), cy2 = Math.cos(cam.yaw);
    let wx = -sy * -I.my + cy2 * I.mx, wz = -cy2 * -I.my - sy * I.mx;
    let wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
      wl = 1;
    }
    if (P.state === "ground" && wl > 0.1 && !P.atk && !P.lunge && !P.fin) P.heading = angLerp(P.heading, Math.atan2(wx, wz), damp(12, dt));
    if (P.fin) {
      stepFinisher(dt);
      return;
    }
    const foe = nearestEnemy(5);
    P.finReady = !!(foe && P.focus >= 1);
    P.doorNear = null;
    P.exitNear = false;
    P.perchPt = P.state !== "car" && P.state !== "pz" && !P.finReady && !P.doorNear && !P.colaNear && !G.interior ? findPerch() : null;
    if (I.specialP) {
      if (P.doorNear) enterDoor(P.doorNear);
      else if (P.exitNear && !P.finReady) leaveInterior();
      else if (P.colaNear && !P.finReady) takeCola();
      else if (P.finReady) startFinisher(foe);
      else if (P.perchPt) startPerchZip(P.perchPt);
    }
    if (I.dodgeP) startDodge(wx, wz, wl);
    if (I.punch) P.punchHold += dt;
    else {
      P.punchHold = 0;
      P.upDone = false;
    }
    if (P.punchHold > 0.32 && !P.upDone && P.state === "ground") tryUppercut();
    if (I.punchP || P.bufPunch > 0 && P.atkCD <= 0) startPunch(wx, wz, wl);
    if (I.webP && P.webCD <= 0 && P.state !== "pz") {
      P.webCD = 0.2;
      shootWeb();
    }
    if (I.jumpP) doJump(wx, wz, wl);
    if (P.state === "air" && I.swing && P.swingCD <= 0 && P.airT > 0.15 && P.vel.y < 5 && !P.lunge && !(P.atk && nearestEnemy(9))) tryAttach(wx, wz, wl);
    else if (P.state === "swing") {
      P.swingT += dt;
      if (!I.swing) release(false);
      else {
        const hx = P.vel.x, hz = P.vel.z, hs = Math.hypot(hx, hz);
        if (hs > 6) {
          const along = ((P.anchor.x - P.pos.x) * hx + (P.anchor.z - P.pos.z) * hz) / hs;
          if (along < -P.rope * 0.55 && P.vel.y < 6) release(false);
        }
        if (P.state === "swing" && P.swingT > 4) release(false);
      }
    }
    if (P.atk && !P.lunge) {
      const a = P.atk;
      a.t += dt;
      if (!a.hit && a.t >= a.dur * 0.42) {
        a.hit = true;
        landHit(a);
      }
      if (a.t >= a.dur) P.atk = null;
    }
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let k = 0; k < n; k++) step(h, I, wx, wz, wl);
    if (P.state !== "ground") P.sprint = false;
    if (P.pos.y < -5) respawn();
  }
  function step(h, I, wx, wz, wl) {
    P.prev.copy(P.pos);
    if (P.state === "car") {
      const c = P.car;
      if (!c || c.done) {
        P.state = "air";
        P.airT = 0.2;
        P.car = null;
        return;
      }
      P.pos.set(c.mesh.position.x, 1.55, c.mesh.position.z);
      P.vel.copy(c.vel);
      P.heading = c.yaw;
      return;
    }
    if (P.state === "pz") {
      const z = P.pz;
      _t3.subVectors(z.to, P.pos);
      const d = _t3.length(), st = 52 * h;
      if (d <= st + 0.2) {
        P.pos.copy(z.to);
        P.vel.set(0, 0, 0);
        if (P.launchBuf > 0 || I.jump) pointLaunch(z.dir);
        else {
          P.state = "ground";
          P.perchT = 0.45;
          P.landT = 0.3;
          P.landHard = false;
          P.zips = zipMax();
        }
      } else {
        P.vel.copy(_t3).multiplyScalar(52 / d);
        P.pos.addScaledVector(P.vel, h);
      }
      return;
    }
    if (P.lunge) {
      const L = P.lunge, e = L.e;
      L.t += h;
      _t3.set(e.pos.x - P.pos.x, e.pos.y - P.pos.y, e.pos.z - P.pos.z);
      const d = _t3.length();
      if (d < 1.35 * (e.scale || 1) || L.t > 0.45 || e.dead) {
        P.lunge = null;
        P.vel.multiplyScalar(0.15);
        if (P.state !== "ground") {
          P.state = "air";
          P.airT = 0.2;
        }
      } else {
        P.vel.copy(_t3).multiplyScalar(26 / d);
        if (P.vel.y > 1 && P.state === "ground") {
          P.state = "air";
          P.airT = 0.2;
        }
      }
      P.pos.addScaledVector(P.vel, h);
      const c = collide();
      if (c.top && P.vel.y <= 0.1) P.state = "ground";
      else if (P.state === "ground" && supportAt(P.pos.x, P.pos.z, P.pos.y + 0.4) < P.pos.y - 0.05) {
        P.state = "air";
        P.airT = 0.2;
      }
      return;
    }
    if (P.state === "ground") {
      P.sprint = I.swing;
      const spd = P.sprint ? 17 : 9;
      let tx = wx * spd, tz = wz * spd;
      if (P.dodgeT > 0) {
        tx = P.dodgeDir.x * 15;
        tz = P.dodgeDir.z * 15;
      } else if (P.atk) {
        tx *= 0.1;
        tz *= 0.1;
      } else if (P.landT > 0 && P.landHard) {
        tx = 0;
        tz = 0;
      }
      const k = damp(wl > 0.1 ? 9 : 14, h);
      P.vel.x += (tx - P.vel.x) * k;
      P.vel.z += (tz - P.vel.z) * k;
      P.vel.y = 0;
      P.pos.x += P.vel.x * h;
      P.pos.z += P.vel.z * h;
      const c = collide();
      const sup = supportAt(P.pos.x, P.pos.z, P.pos.y + 0.4);
      if (sup < P.pos.y - 0.05) {
        P.state = "air";
        P.airT = 0;
      } else P.pos.y = sup;
      if (c.wall && P.sprint && wl > 0.3 && (wx * c.wall.n.x + wz * c.wall.n.z) / wl < -0.5) enterWall(c.wall.b, c.wall.n);
      return;
    }
    if (P.state === "air") {
      P.airT += h;
      P.vel.y -= GRAV * h;
      if (P.atk && P.vel.y < -1.5) P.vel.y = -1.5;
      if (P.dodgeT > 0) {
        P.vel.x = P.dodgeDir.x * 14;
        P.vel.z = P.dodgeDir.z * 14;
      } else {
        P.vel.x += wx * 14 * h;
        P.vel.z += wz * 14 * h;
      }
      const hs = Math.hypot(P.vel.x, P.vel.z), cap = 55 * swingMul();
      if (hs > 14) {
        const dr = 1 - 0.1 * h;
        P.vel.x *= dr;
        P.vel.z *= dr;
      }
      if (hs > cap) {
        P.vel.x *= cap / hs;
        P.vel.z *= cap / hs;
      }
      if (P.vel.y < -75) P.vel.y = -75;
      const vy = P.vel.y;
      P.pos.addScaledVector(P.vel, h);
      const c = collide();
      if (c.top) land(-vy);
      else if (c.wall) wallContact(c.wall);
      return;
    }
    if (P.state === "swing") {
      const sm2 = swingMul();
      P.vel.y -= 32 * h;
      P.vel.x += wx * 9 * h;
      P.vel.z += wz * 9 * h;
      const sp = P.vel.length();
      if (sp > 1 && sp < 38 * sm2 && P.vel.y < 0) P.vel.multiplyScalar(1 + 0.3 * sm2 * h);
      if (P.rope > P.ropeT) P.rope = Math.max(P.ropeT, P.rope - 14 * h);
      P.pos.addScaledVector(P.vel, h);
      _t3.subVectors(P.pos, P.anchor);
      const L = _t3.length();
      if (L > P.rope) {
        _t3.divideScalar(L);
        P.pos.copy(P.anchor).addScaledVector(_t3, P.rope);
        const vn = P.vel.dot(_t3);
        if (vn > 0) P.vel.addScaledVector(_t3, -vn);
      }
      if (sp > 65 * sm2) P.vel.multiplyScalar(65 * sm2 / sp);
      const vy = P.vel.y;
      const c = collide();
      if (c.top) {
        P.state = "air";
        land(-vy);
      } else if (c.wall) {
        P.state = "air";
        wallContact(c.wall);
      }
      return;
    }
    if (P.state === "wall") {
      const n = P.wallN, b = P.wallBox;
      const up = -I.my;
      let side = I.mx;
      if (-Math.sin(cam.yaw) * -n.x + -Math.cos(cam.yaw) * -n.z < -0.2) side = -side;
      P.climbSide = side;
      const spd = I.swing ? 16 : 7, tvy = up * spd;
      P.wallVy += (tvy - P.wallVy) * damp(Math.abs(tvy) > Math.abs(P.wallVy) ? 6 : 3, h);
      P.pos.y += P.wallVy * h;
      const rx = n.z, rz = -n.x;
      P.pos.x += rx * side * spd * 0.7 * h;
      P.pos.z += rz * side * spd * 0.7 * h;
      if (n.x > 0.5) P.pos.x = b.x1 + 0.3;
      else if (n.x < -0.5) P.pos.x = b.x0 - 0.3;
      else if (n.z > 0.5) P.pos.z = b.z1 + 0.3;
      else P.pos.z = b.z0 - 0.3;
      if (Math.abs(n.x) > 0.5) P.pos.z = clamp(P.pos.z, b.z0 + 0.2, b.z1 - 0.2);
      else P.pos.x = clamp(P.pos.x, b.x0 + 0.2, b.x1 - 0.2);
      P.vel.set(0, P.wallVy, 0);
      if (P.pos.y >= b.y1 - 0.1) {
        P.pos.y = b.y1 + 0.05;
        P.pos.addScaledVector(n, -0.9);
        P.state = "air";
        P.airT = 0;
        P.vel.set(-n.x * 5, 7, -n.z * 5);
        P.heading = Math.atan2(-n.x, -n.z);
        if (P.wallVy > 10) {
          P.flipT = 0;
          P.flipDur = 0.5;
          P.flipBack = false;
        }
      } else if (P.pos.y <= 0) {
        P.pos.y = 0;
        P.state = "ground";
      }
    }
  }
  function land(imp) {
    P.state = "ground";
    P.zips = zipMax();
    P.flipT = -1;
    P.pc.bp = 0;
    P.trickT = 0;
    if (imp > 32) {
      P.landT = 0.45;
      P.landHard = true;
      G.shake = Math.max(G.shake, 0.45);
      rumble(0.25, 0.8, 0.5);
      sfx("land");
      burst(P.pos.x, P.pos.y + 0.1, P.pos.z, 26, 13616824, 6);
    } else if (imp > 12) {
      P.landT = 0.22;
      P.landHard = false;
      sfx("land", 0.35);
    }
  }
  function wallContact(w) {
    const b = w.b;
    if (b.y1 - P.pos.y < 1.6) {
      P.pos.y = b.y1 + 0.02;
      P.pos.addScaledVector(w.n, -0.7);
      P.state = "ground";
      P.vel.y = 0;
      P.vel.multiplyScalar(0.5);
      return;
    }
    enterWall(b, w.n);
  }
  function enterWall(b, n) {
    const hs = Math.hypot(P.vel.x, P.vel.z);
    P.state = "wall";
    P.wallBox = b;
    P.wallN.copy(n);
    P.wallVy = clamp(Math.max(P.vel.y, 0) + hs * 0.5, 0, 22);
    P.vel.set(0, 0, 0);
    P.zips = zipMax();
    P.flipT = -1;
    P.pc.bp = 0;
    P.lunge = null;
    P.trickT = 0;
    sfx("land", 0.2);
  }
  function doJump(wx, wz, wl) {
    if (P.state === "car") {
      carLeave();
      P.state = "air";
      P.airT = 0;
      P.vel.y += 11;
      P.car = null;
      P.flipT = 0;
      P.flipDur = 0.6;
      P.flipBack = true;
      return;
    }
    if (P.state === "pz") {
      P.launchBuf = 0.5;
      return;
    }
    if (P.state === "ground") {
      if (P.perchT > 0 && P.pz) {
        pointLaunch(P.pz.dir);
        return;
      }
      if (P.atk) return;
      P.state = "air";
      P.airT = 0;
      P.landT = 0;
      P.vel.y = P.sprint ? 15 : 12.5;
      if (P.sprint) {
        P.vel.x *= 1.1;
        P.vel.z *= 1.1;
      }
    } else if (P.state === "swing") release(true);
    else if (P.state === "wall") {
      const n = P.wallN;
      P.state = "air";
      P.airT = 0;
      P.vel.set(n.x * 11, 12, n.z * 11);
      P.heading = Math.atan2(n.x, n.z);
      P.flipT = 0;
      P.flipDur = 0.55;
      P.flipBack = true;
      P.swingCD = 0.25;
      sfx("whoosh");
    } else if (P.state === "air" && P.zips > 0) {
      P.zips--;
      const hs = Math.hypot(P.vel.x, P.vel.z);
      let dx, dz;
      if (wl > 0.2) {
        dx = wx / wl;
        dz = wz / wl;
      } else if (hs > 3) {
        dx = P.vel.x / hs;
        dz = P.vel.z / hs;
      } else {
        dx = Math.sin(P.heading);
        dz = Math.cos(P.heading);
      }
      const sp = Math.max(hs, 22);
      P.vel.x = dx * sp;
      P.vel.z = dz * sp;
      P.vel.y = Math.max(P.vel.y, 0) + 9;
      P.zipT = 0.28;
      P.zipPt.set(P.pos.x + dx * 16, P.pos.y + 5, P.pos.z + dz * 16);
      P.heading = Math.atan2(dx, dz);
      sfx("thwip");
    }
  }
  function startPerchZip(p) {
    if (P.state === "swing") release(false);
    const to = new V3(p.x, p.y + 0.05, p.z), dir = new V3().subVectors(to, P.pos);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    dir.normalize();
    P.pz = { to, dir };
    P.state = "pz";
    P.launchBuf = 0;
    P.atk = null;
    P.lunge = null;
    P.flipT = -1;
    P.pc.bp = 0;
    P.heading = Math.atan2(dir.x, dir.z);
    sfx("thwip");
    sfx("whoosh", 0.6);
    rumble(0.08, 0.2, 0.4);
  }
  function pointLaunch(dir) {
    P.state = "air";
    P.airT = 0.2;
    P.perchT = 0;
    P.launchBuf = 0;
    const up = has("swing2") ? 17 : 15;
    P.vel.set(dir.x * 24, up, dir.z * 24);
    P.flipT = 0;
    P.flipDur = 0.6;
    P.flipBack = false;
    P.zips = zipMax();
    sfx("whoosh");
    addXP(3);
    popText("WYBICIE!");
  }
  function tryUppercut() {
    const e = nearestEnemy(2.8);
    if (!e || e.type === "boss") return;
    P.upDone = true;
    P.atk = { type: 4, t: 0, dur: 0.38, target: e, hit: false };
    P.atkCD = 0.4;
    P.heading = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
  }
  function startPunch(wx, wz, wl) {
    if (P.state === "car") {
      carPunch();
      P.atk = { type: P.step++ % 2, t: 0, dur: 0.25, target: null, hit: true };
      return;
    }
    if (P.atkCD > 0 || P.state === "wall" || P.state === "pz" || P.dodgeT > 0) {
      P.bufPunch = 0.25;
      return;
    }
    P.bufPunch = 0;
    let best = null, bs = 1e9;
    for (const e of enemies) {
      if (e.dead || e.gone) continue;
      _t3.subVectors(e.pos, P.pos);
      const d = _t3.length();
      if (d > 9 + (e.scale || 1)) continue;
      let sc = d;
      if (wl > 0.2) sc -= (_t3.x * wx + _t3.z * wz) / (d || 1) * 3;
      if (sc < bs) {
        bs = sc;
        best = e;
      }
    }
    if (!best && P.state !== "ground") {
      startTrick();
      return;
    }
    const type = P.step % 4;
    P.step++;
    P.atk = { type, t: 0, dur: type === 3 ? 0.42 : 0.3, target: best, hit: false };
    P.atkCD = type === 3 ? 0.4 : 0.24;
    if (best) {
      P.heading = Math.atan2(best.pos.x - P.pos.x, best.pos.z - P.pos.z);
      if (P.pos.distanceTo(best.pos) > 1.6 * (best.scale || 1)) {
        if (P.state === "swing") release(false);
        P.lunge = { e: best, t: 0 };
      }
    }
    sfx("whoosh", 0.35);
  }
  function startTrick() {
    if (P.trickCD > 0) return;
    P.trickT = 0.55;
    P.trickType = Math.floor(Math.random() * 3);
    P.trickCD = 0.6;
    addXP(5);
    addFocus(0.05);
    popText(["TRIK!", "SALTO!", "SZPAGAT!"][P.trickType]);
    sfx("whoosh", 0.5);
  }
  function landHit(a) {
    const e = a.target;
    if (!e || e.dead) return;
    if (P.pos.distanceTo(e.pos) > 2.6 * (e.scale || 1)) return;
    _t3.subVectors(e.pos, P.pos);
    _t3.y = 0;
    _t3.normalize();
    const fin = a.type === 3, up = a.type === 4;
    const r = hitEnemy(e, fin ? 2 : 1, _t3.x * (fin ? 14 : 3), up ? 13 : fin ? 7 : 0, _t3.z * (fin ? 14 : 3), up ? "up" : fin, P.state !== "ground");
    if (r === "block") {
      P.vel.x -= _t3.x * 5;
      P.vel.z -= _t3.z * 5;
      P.combo = 0;
      return;
    }
    P.combo++;
    P.comboT = 2.5;
    addFocus(0.12);
    if (up) {
      P.vel.y = 0;
    }
  }
  function startFinisher(e) {
    P.focus -= 1;
    if (P.state === "swing") release(false);
    const dir = new V3().subVectors(e.pos, P.pos);
    dir.y = 0;
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const to = e.pos.clone().addScaledVector(dir, 1.5 * (e.scale || 1));
    to.y = supportAt(to.x, to.z, e.pos.y + 0.5);
    if (Math.abs(to.y - e.pos.y) > 0.5) to.copy(P.pos);
    P.fin = { e, t: 0, dur: 0.8, from: P.pos.clone(), to, done: false };
    P.atk = null;
    P.lunge = null;
    P.state = "ground";
    P.heading = Math.atan2(dir.x, dir.z);
    G.slowT = 0.9;
    sfx("fin");
    rumble(0.3, 0.5, 0.8);
  }
  function stepFinisher(dt) {
    const F2 = P.fin;
    F2.t += dt;
    const k = clamp(F2.t / F2.dur, 0, 1);
    P.pos.lerpVectors(F2.from, F2.to, k);
    P.pos.y += Math.sin(k * Math.PI) * 2.8;
    P.vel.set(0, 0, 0);
    if (k > 0.55 && !F2.done) {
      F2.done = true;
      finishEnemy(F2.e);
      if (has("fin")) {
        let b = null, bd = 9;
        for (const e of enemies) {
          if (e === F2.e || e.dead || e.gone || e.type === "boss") continue;
          const d = e.pos.distanceTo(F2.e.pos);
          if (d < bd) {
            bd = d;
            b = e;
          }
        }
        if (b) finishEnemy(b);
      }
      G.shake = 0.5;
    }
    if (k >= 1) {
      P.fin = null;
      P.state = supportAt(P.pos.x, P.pos.z, P.pos.y + 0.5) >= P.pos.y - 0.3 ? "ground" : "air";
      P.pc.bp = 0;
      P.heading += Math.PI;
    }
  }
  function startDodge(wx, wz, wl) {
    if (P.dodgeCD > 0 || P.state === "pz") return;
    if (P.state === "car") {
      carLeave();
      P.state = "air";
      P.airT = 0;
      P.vel.y += 6;
      P.car = null;
      return;
    }
    if (P.state === "wall") {
      P.state = "air";
      P.airT = 0;
      P.vel.set(P.wallN.x * 5, 2, P.wallN.z * 5);
      P.dodgeCD = 0.4;
      return;
    }
    if (P.state === "swing") release(false);
    if (wl > 0.2) P.dodgeDir.set(wx / wl, 0, wz / wl);
    else P.dodgeDir.set(-Math.sin(P.heading), 0, -Math.cos(P.heading));
    P.dodgeSide = P.dodgeDir.x * Math.cos(P.heading) - P.dodgeDir.z * Math.sin(P.heading) > 0 ? -1 : 1;
    P.dodgeT = 0.32;
    P.invT = Math.max(P.invT, 0.45);
    P.dodgeCD = 0.5;
    P.atk = null;
    P.lunge = null;
    for (const e of enemies)
      if (!e.dead && (e.state === "windup" || e.state === "aim") && e.pos.distanceTo(P.pos) < (e.state === "aim" ? 70 : 5 * (e.scale || 1))) {
        G.slowT = has("sense") ? 1.2 : 0.6;
        addFocus(0.3);
        popText("IDEALNY UNIK!");
        break;
      }
    sfx("whoosh");
    if (P.state === "air") P.vel.y = Math.max(P.vel.y, 4);
  }
  function tryAttach(wx, wz, wl) {
    const hs = Math.hypot(P.vel.x, P.vel.z);
    let dx, dz;
    if (wl > 0.3) {
      dx = wx / wl;
      dz = wz / wl;
    } else if (hs > 4) {
      dx = P.vel.x / hs;
      dz = P.vel.z / hs;
    } else {
      dx = -Math.sin(cam.yaw);
      dz = -Math.cos(cam.yaw);
    }
    P.swingSide = -P.swingSide;
    const o = _h2.set(P.pos.x, P.pos.y + 1.5, P.pos.z), base = Math.atan2(dx, dz);
    let best = null, bs = -1e9;
    for (const el2 of [0.95, 0.8, 1.1, 0.65, 1.25]) for (const az of [0, 0.3, -0.3, 0.6, -0.6]) {
      const a = base - az * P.swingSide;
      const d = _t3.set(Math.sin(a) * Math.cos(el2), Math.sin(el2), Math.cos(a) * Math.cos(el2));
      const t = raycastCity(o, d, 80);
      if (t < 80 && t > 9) {
        const y = o.y + d.y * t;
        if (y < P.pos.y + 5) continue;
        const sc = -Math.abs(t - 34) - Math.abs(el2 - 0.9) * 25 - Math.abs(az) * 12;
        if (sc > bs) {
          bs = sc;
          best = (best || new V3()).copy(o).addScaledVector(d, t);
        }
      }
    }
    if (!best) {
      if (P.pos.y > 75) return;
      best = new V3(o.x + Math.sin(base) * Math.cos(0.9) * 34, Math.min(o.y + Math.sin(0.9) * 34, 95), o.z + Math.cos(base) * Math.cos(0.9) * 34);
    }
    P.anchor.copy(best);
    P.state = "swing";
    P.swingT = 0;
    P.rope = P.pos.distanceTo(best);
    P.ropeT = clamp(Math.min(P.rope, best.y - 2.5), 6, 90);
    if (hs < 18) {
      P.vel.x += dx * 8;
      P.vel.z += dz * 8;
    }
    P.zips = zipMax();
    P.flipT = -1;
    P.pc.bp = 0;
    P.trickT = 0;
    sfx("thwip");
    rumble(0.05, 0, 0.25);
  }
  function release(jump) {
    P.state = "air";
    P.airT = 0.2;
    P.swingCD = 0.12;
    const hs = Math.hypot(P.vel.x, P.vel.z);
    if (jump) {
      P.vel.y = Math.max(P.vel.y, 0) + (has("swing2") ? 15 : 12);
      if (hs > 1) {
        P.vel.x += P.vel.x / hs * 5;
        P.vel.z += P.vel.z / hs * 5;
      }
      P.flipT = 0;
      P.flipDur = 0.6;
      P.flipBack = false;
      sfx("whoosh");
    } else if (P.vel.y > 0) {
      P.vel.y += 1.5;
      if (hs > 1) {
        P.vel.x += P.vel.x / hs * 2;
        P.vel.z += P.vel.z / hs * 2;
      }
      if (hs > 22 && Math.random() < 0.35) {
        P.flipT = 0;
        P.flipDur = 0.6;
        P.flipBack = false;
      }
    }
  }
  function hurtPlayer(dmg, from, knock = 6) {
    if (P.invT > 0 || P.dead || P.dodgeT > 0 || P.fin || G.state !== "play") return false;
    P.hp -= dmg;
    P.invT = 0.6;
    P.hurtT = 0.3;
    P.regenT = 4;
    P.combo = 0;
    P.atk = null;
    P.lunge = null;
    flashDamage();
    rumble(0.25, 0.7, 0.5);
    sfx("hurt");
    G.shake = Math.max(G.shake, 0.25 + knock / 60);
    if (P.state === "car") {
      carLeave();
      P.state = "air";
      P.car = null;
    }
    if (from) {
      _t3.subVectors(P.pos, from.pos);
      _t3.y = 0;
      _t3.normalize();
      P.vel.x += _t3.x * knock;
      P.vel.z += _t3.z * knock;
      if (knock > 10) {
        P.state = "air";
        P.airT = 0.2;
        P.vel.y = 8;
        P.flipT = 0;
        P.flipDur = 0.6;
        P.flipBack = true;
      }
    }
    if (P.hp <= 0) {
      P.hp = 0;
      P.dead = true;
      P.deadT = 2.6;
      if (P.state !== "ground") P.state = "air";
      showMsg("SPIDER-MAN POKONANY", "Za chwil\u0119 wracasz do gry...", 2.4);
    }
    return true;
  }
  function respawn() {
    if (G.interior) leaveInterior(true);
    let best = null, bd = 1e9;
    for (const r of roofs) {
      if (r.y1 < 25 || r.y1 > 120) continue;
      const d = Math.hypot((r.x0 + r.x1) / 2 - P.pos.x, (r.z0 + r.z1) / 2 - P.pos.z);
      if (d < bd) {
        bd = d;
        best = r;
      }
    }
    if (best) P.pos.set((best.x0 + best.x1) / 2, best.y1, (best.z0 + best.z1) / 2);
    else P.pos.copy(START);
    P.vel.set(0, 0, 0);
    P.state = "ground";
    P.hp = maxHp();
    P.dead = false;
    P.invT = 2;
    P.atk = null;
    P.lunge = null;
    P.flipT = -1;
    P.fin = null;
    P.car = null;
    P.focus = 0;
    P.pc.bp = 0;
    P.pc.br = 0;
    P.pc.bw = 0;
    cam.tgt.copy(P.pos);
  }
  function buildPose(t, dt, hs) {
    if (P.perch && (G.state !== "play" || G.cine)) {
      crouchPose(t);
      return;
    }
    if (P.dead) {
      t.sLz = 1.3;
      t.sRz = -1.3;
      t.hLz = 0.2;
      t.hRz = -0.2;
      t.bp = -0.4;
      return;
    }
    if (P.fin) {
      tuckPose(t);
      t.sRx = -2.6;
      t.sLx = -2.6;
      t.eL = -0.2;
      t.eR = -0.2;
      return;
    }
    switch (P.state) {
      case "car":
        t.by = -0.45;
        t.hLx = -1.6;
        t.kL = 2.2;
        t.hRx = -0.4;
        t.kR = 1.8;
        t.hLz = 0.35;
        t.hRz = -0.4;
        t.bp = 0.5;
        t.sLz = 0.8;
        t.sRx = -1;
        t.eR = -0.4;
        t.hx = -0.5;
        break;
      case "pz":
        t.hLx = -1.2;
        t.kL = 1.8;
        t.hRx = -1;
        t.kR = 1.6;
        t.bp = 0.3;
        t.hx = -0.3;
        break;
      case "ground":
        if (P.perchT > 0) crouchPose(t);
        else if (P.landT > 0) {
          if (P.landHard) {
            t.by = -0.42;
            t.hLx = -1.5;
            t.kL = 2.1;
            t.hRx = 0.3;
            t.kR = 1.9;
            t.bp = 0.55;
            t.sRx = -1;
            t.sRz = -0.2;
            t.sLz = 0.9;
            t.sLx = 0.3;
            t.hx = -0.5;
          } else {
            t.by = -0.2;
            t.hLx = -0.7;
            t.kL = 1.2;
            t.hRx = -0.5;
            t.kR = 1;
            t.bp = 0.25;
            t.sLz = 0.4;
            t.sRz = -0.4;
          }
        } else if (hs > 0.6) {
          P.runPh += dt * (hs * 1.05 + 1.5);
          runPose(t, P.runPh, Math.min(1, hs / 9), P.sprint && hs > 11);
        } else idlePose(t, G.time);
        break;
      case "air":
        if (P.vel.y > 2) {
          t.hLx = -1.3;
          t.kL = 1.9;
          t.hRx = 0.35;
          t.kR = 0.7;
          t.sLz = 1.1;
          t.sRz = -1.1;
          t.sLx = -0.4;
          t.sRx = 0.3;
          t.eL = -0.6;
          t.eR = -0.6;
          t.bp = 0.15;
        } else {
          const dive = clamp(-P.vel.y / 45, 0, 1);
          const f = Math.sin(G.time * 9) * (0.05 + dive * 0.08), g = Math.sin(G.time * 6.3 + 1) * (0.04 + dive * 0.06);
          t.sLz = 0.75 + f;
          t.sRz = -0.95 - g;
          t.sLx = 0.55 + dive * 0.35;
          t.sRx = 0.75 + dive * 0.3;
          t.eL = -0.85;
          t.eR = -0.45;
          t.hLz = 0.18;
          t.hRz = -0.12;
          t.hLx = -0.75 + dive * 0.25;
          t.kL = 1.45 - dive * 0.4;
          t.hRx = 0.3;
          t.kR = 0.35 + g;
          t.bp = 0.25 + dive * 0.85;
          t.hx = -0.25 - dive * 0.55;
          t.spy = 0.12;
        }
        if (P.trickT > 0 && P.trickType === 2) {
          t.hLz = 1.4;
          t.hRz = -1.4;
          t.kL = 0;
          t.kR = 0;
          t.hLx = 0;
          t.hRx = 0;
          t.sLz = 2.6;
          t.sRz = -2.6;
          t.bp = 0;
        }
        break;
      case "swing":
        t.hLx = -0.75;
        t.kL = 1.1;
        t.hRx = -0.45;
        t.kR = 0.8;
        t.hLz = 0.06;
        t.hRz = -0.06;
        t.hx = -0.25;
        if (P.vel.y > 4) {
          t.hLx = -0.2;
          t.kL = 0.3;
          t.hRx = -0.1;
          t.kR = 0.2;
        }
        if (P.swingSide > 0) {
          t.sLz = 1;
          t.sLx = 0.6;
          t.eL = -0.5;
        } else {
          t.sRz = -1;
          t.sRx = 0.6;
          t.eR = -0.5;
        }
        break;
      case "wall": {
        const v = Math.abs(P.wallVy);
        if (v > 9) {
          P.runPh += dt * v * 1.1;
          runPose(t, P.runPh, 1, false);
          t.bp = 0.1;
        } else {
          P.climbPh += dt * (v * 1.5 + Math.abs(P.climbSide) * 6);
          const s = Math.sin(P.climbPh);
          t.by = -0.45;
          t.hLz = 0.9;
          t.hRz = -0.9;
          t.hLx = 0.3 + s * 0.35;
          t.hRx = 0.3 - s * 0.35;
          t.kL = 0.9;
          t.kR = 0.9;
          t.sLx = -1.1 + s * 0.4;
          t.sRx = -1.1 - s * 0.4;
          t.sLz = 0.5;
          t.sRz = -0.5;
          t.eL = -0.6;
          t.eR = -0.6;
          t.hx = -0.7;
        }
        break;
      }
    }
    if (P.flipT >= 0 || P.dodgeT > 0 || P.trickT > 0 && P.trickType < 2) tuckPose(t);
    if (P.atk) attackPose(t, P.atk);
    if (P.lunge) {
      t.sRx = -1.4;
      t.sLx = 0.6;
      t.bp = 0.35;
      t.hLx = -0.9;
      t.kL = 1.2;
      t.hRx = 0.4;
      t.kR = 0.6;
    }
    if (P.hurtT > 0) {
      t.bp -= 0.35;
      t.hx += 0.25;
    }
  }
  function attackPose(t, a) {
    const k = Math.sin(clamp(a.t / a.dur, 0, 1) * Math.PI);
    switch (a.type) {
      case 0:
        t.sLx = lerp(-0.6, -1.65, k);
        t.eL = lerp(-1.8, -0.05, k);
        t.sLz = 0.1;
        t.sRx = -0.7;
        t.eR = -1.9;
        t.spy = -0.4 * k;
        t.hLx = -0.4;
        t.kL = 0.4;
        t.hRx = 0.35;
        t.kR = 0.3;
        t.by = -0.08;
        break;
      case 1:
        t.sRx = lerp(-0.6, -1.65, k);
        t.eR = lerp(-1.8, -0.05, k);
        t.sRz = -0.1;
        t.sLx = -0.7;
        t.eL = -1.9;
        t.spy = 0.4 * k;
        t.hRx = -0.4;
        t.kR = 0.4;
        t.hLx = 0.35;
        t.kL = 0.3;
        t.by = -0.08;
        break;
      case 2:
        t.hRx = lerp(0, -1.7, k);
        t.kR = lerp(1, 0.05, k);
        t.bp = -0.3 * k;
        t.sLz = 0.8;
        t.sRz = -0.8;
        t.spy = 0.3 * k;
        t.kL = 0.25;
        break;
      case 3:
        t.hRz = -1.3 * k;
        t.hRx = -0.3;
        t.kR = 0.2;
        t.sLz = 1.2;
        t.sRz = -1.2;
        t.by = 0.15 * k;
        t.kL = 0.5;
        t.hLx = -0.4;
        break;
      case 4:
        t.sRx = lerp(0.4, -2.9, k);
        t.eR = lerp(-2, -0.1, k);
        t.by = lerp(-0.35, 0.1, k);
        t.hLx = -0.8 * (1 - k);
        t.kL = 1.2 * (1 - k);
        t.bp = -0.2 * k;
        t.sLz = 0.6;
        break;
    }
  }
  function updatePlayerVisual(dt) {
    const H = P.H;
    H.root.position.copy(P.pos);
    const hs = Math.hypot(P.vel.x, P.vel.z);
    const up = _u2.set(0, 1, 0), fw = _f2.set(Math.sin(P.heading), 0, Math.cos(P.heading));
    if (P.state === "swing") {
      up.subVectors(P.anchor, P.pos).normalize().lerp(UP, 0.2).normalize();
      if (P.vel.lengthSq() > 4) fw.copy(P.vel).normalize();
    } else if (P.state === "wall") {
      up.copy(P.wallN);
      fw.set(0, 1, 0);
    } else if (P.state === "air" && hs > 3 && !P.lunge && !P.atk) {
      fw.set(P.vel.x, 0, P.vel.z).normalize();
      P.heading = Math.atan2(fw.x, fw.z);
    }
    basisQ(_q3, up, fw);
    H.root.quaternion.slerp(_q3, damp(P.state === "swing" ? 9 : 14, dt));
    const t = P.pt;
    zeroPose(t);
    buildPose(t, dt, hs);
    blendPose(P.pc, t, damp(P.atk ? 26 : 14, dt));
    if (P.fin) P.pc.bp = clamp(P.fin.t / P.fin.dur, 0, 1) * Math.PI * 2;
    else if (P.flipT >= 0) P.pc.bp = clamp(P.flipT / P.flipDur, 0, 1) * Math.PI * 2 * (P.flipBack ? -1 : 1);
    else if (P.trickT > 0 && P.trickType === 1) P.pc.bp = (1 - P.trickT / 0.55) * Math.PI * 2;
    if (P.dodgeT > 0) {
      P.pc.br = P.dodgeSide * (1 - P.dodgeT / 0.32) * Math.PI * 2;
      P.rolling = true;
    } else if (P.rolling) {
      P.rolling = false;
      P.pc.br = 0;
    }
    if (P.atk && P.atk.type === 3) {
      P.pc.bw = clamp(P.atk.t / P.atk.dur, 0, 1) * Math.PI * 2;
      P.spinning = true;
    } else if (P.trickT > 0 && P.trickType === 0) {
      P.pc.bw = (1 - P.trickT / 0.55) * Math.PI * 4;
      P.spinning = true;
    } else if (P.spinning) {
      P.spinning = false;
      P.pc.bw = 0;
    }
    if (!P.fin && P.flipT < 0 && !(P.trickT > 0 && P.trickType === 1) && Math.abs(P.pc.bp) > 3) P.pc.bp = 0;
    applyPose(H, P.pc);
    const fight = P.atk || P.lunge || P.fin || P.state === "car" || P.punchHold > 0;
    const webR = P.webT > 0 || P.zipT > 0 || P.state === "pz" || P.state === "swing" && P.swingSide > 0;
    const webL = P.zipT > 0 || P.state === "pz" || P.state === "swing" && P.swingSide < 0;
    H.setHands(fight ? "fist" : webL ? "thwip" : "open", fight ? "fist" : webR ? "thwip" : "open");
    H.root.updateMatrixWorld(true);
    if (P.state === "swing") aimArm(H, P.swingSide > 0 ? "R" : "L", P.anchor, 1);
    if (P.webT > 0) aimArm(H, "R", P.webAim, 1);
    if (P.zipT > 0) {
      aimArm(H, "R", P.zipPt, 1);
      aimArm(H, "L", P.zipPt, 1);
    }
    if (P.state === "pz") {
      aimArm(H, "R", P.pz.to, 1);
      aimArm(H, "L", P.pz.to, 1);
    }
    H.root.updateMatrixWorld(true);
    if (P.state === "swing") {
      (P.swingSide > 0 ? H.handR : H.handL).getWorldPosition(_h2);
      setLine(lineMain, _h2, P.anchor);
    } else lineMain.visible = false;
    const two = P.zipT > 0 ? P.zipPt : P.state === "pz" ? P.pz.to : null;
    if (two) {
      H.handR.getWorldPosition(_h2);
      setLine(lineZ1, _h2, two);
      H.handL.getWorldPosition(_h2);
      setLine(lineZ2, _h2, two);
    } else lineZ1.visible = lineZ2.visible = false;
    H.root.visible = !(P.hurtT > 0 && Math.floor(P.hurtT * 30) % 2 === 0);
  }
  var GRAV, _t3, _h2, _f2, _u2, _q3, _cf2, GROUND, webGeo, webLineMat, lineMain, lineZ1, lineZ2, _cl, _res;
  var init_gracz = __esm({
    "js/gracz.js"() {
      init_util();
      init_stan();
      init_miasto();
      init_wnetrza();
      init_postac();
      init_wrogowie();
      init_misje();
      init_umiejetnosci();
      init_dzwiek();
      init_wejscie();
      init_ui();
      GRAV = 27;
      _t3 = new V3();
      _h2 = new V3();
      _f2 = new V3();
      _u2 = new V3();
      _q3 = new THREE.Quaternion();
      _cf2 = new V3();
      GROUND = { y1: 0, street: true };
      webGeo = new THREE.CylinderGeometry(0.024, 0.024, 1, 5, 1, true);
      webGeo.translate(0, 0.5, 0);
      webLineMat = new THREE.MeshBasicMaterial({ color: 16185078 });
      _cl = [];
      _res = { top: null, wall: null };
    }
  });

  // js/main.js
  init_util();
  init_stan();
  init_miasto();
  init_gracz();
  init_wrogowie();
  init_misje();
  init_scenki();
  init_ui();
  init_wejscie();
  init_dzwiek();
  init_wnetrza();
  try {
    buildCity();
    setTOD(save.tod);
    initFX();
    initPlayer();
    initBags();
    initMissions();
    initUI();
    for (let i = 0; i < 5; i++) spawnCrime(true);
  } catch (e) {
    zglosBlad(e);
    throw e;
  }
  var _a3;
  (_a3 = document.getElementById("ladowanie")) == null ? void 0 : _a3.remove();
  setMusic(save.music);
  var composer = null;
  var bloom = null;
  function setupComposer() {
    composer = null;
    bloom = null;
    setFogEncoded(true);
    if (save.gfx !== "high" || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    try {
      composer = new THREE.EffectComposer(renderer);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.addPass(new THREE.RenderPass(scene, camera));
      bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 0.85);
      composer.addPass(bloom);
      if (THREE.GammaCorrectionShader) composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
      tuneBloom();
    } catch (e) {
      composer = null;
    }
    setFogEncoded(!composer);
  }
  function tuneBloom() {
    if (!bloom) return;
    const n = save.tod === "night";
    const ss = save.tod === "sunset";
    bloom.strength = n ? 0.5 : ss ? 0.42 : 0.22;
    bloom.threshold = n ? 0.85 : ss ? 0.78 : 0.9;
    bloom.radius = ss ? 0.6 : 0.45;
  }
  setupComposer();
  var beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 600, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: 4187135, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })
  );
  beacon.visible = false;
  scene.add(beacon);
  hooks.start = (mode2) => {
    G.mode = mode2;
    initAudio();
    showHUD(true);
    G.state = "play";
    if (!G.started && save.pos && save.hasGame) {
      G.started = true;
      P.perch = false;
      P.pos.set(save.pos[0], save.pos[1] + 0.2, save.pos[2]);
      P.vel.set(0, 0, 0);
      P.state = "air";
      P.airT = 0.2;
      P.heading = save.hd || 0;
      cam.yaw = P.heading + Math.PI;
      cam.pitch = -0.25;
      cam.dist = 6;
      cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0));
      showMsg("WITAJ Z POWROTEM", `Poziom ${save.lvl} \xB7 wczytano zapis`, 3.5);
    } else if (!G.started) {
      G.started = true;
      P.perch = false;
      save.hasGame = true;
      doSave();
      cam.yaw = P.heading + Math.PI - 0.6;
      cam.pitch = -0.3;
      cam.dist = 6;
      cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0));
      P.perch = true;
      playCine("intro", { onEnd: () => {
        P.perch = false;
        cam.tgt.copy(P.pos).add(new V3(0, 1.4, 0));
        showMsg("NOWY JORK", `Zeskocz z wie\u017Cowca i przytrzymaj ${key("swing")} w powietrzu, \u017Ceby si\u0119 buja\u0107`, 6);
      } });
    }
    if (!G.cine) P.perch = false;
    if (mode2 === "kb") lockMouse();
    else if (!pad.connected) showMsg("NIE WYKRYTO PADA", "Pod\u0142\u0105cz pada i naci\u015Bnij na nim dowolny przycisk", 4);
  };
  function savePos() {
    save.pos = [P.pos.x, P.pos.y, P.pos.z];
    save.hd = P.heading;
    save.hasGame = true;
    save.savedAt = Date.now();
    doSave();
  }
  hooks.save = () => {
    savePos();
    sfx("win");
    showMsg("GRA ZAPISANA", "Post\u0119p i miejsce zosta\u0142y zapami\u0119tane", 2.5);
  };
  hooks.newGame = () => {
    resetProgress();
    location.reload();
  };
  var posT = 0;
  hooks.toMenu = () => {
    G.state = "menu";
    showHUD(false);
    if (document.pointerLockElement) document.exitPointerLock();
  };
  hooks.gfx = () => {
    save.gfx = save.gfx === "high" ? "low" : "high";
    doSave();
    resScale = 1;
    renderer.setPixelRatio(pixelRatio());
    renderer.shadowMap.enabled = save.gfx === "high";
    scene.traverse((o) => {
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.needsUpdate = true);
    });
    setupComposer();
  };
  hooks.tod = () => {
    const order = ["sunset", "night", "day"];
    save.tod = order[(order.indexOf(save.tod) + 1) % order.length];
    doSave();
    setTOD(save.tod);
    setupComposer();
  };
  hooks.music = () => {
    save.music = !save.music;
    doSave();
    setMusic(save.music);
  };
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== canvas && G.state === "play" && G.mode === "kb") openPause("game", false);
  });
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    if (composer) composer.setSize(innerWidth, innerHeight);
  });
  var _f3 = new V3();
  var _b2 = new V3();
  var _v3 = new V3();
  function camLook(dt, I) {
    const lx = I.plx * 2.7 * dt + I.mdx * 24e-4, ly = I.ply * 1.9 * dt + I.mdy * 24e-4;
    cam.yaw -= lx;
    cam.pitch = clamp(cam.pitch - ly, -1.3, 0.9);
    if (Math.abs(lx) + Math.abs(ly) > 1e-4) cam.idle = 0;
    else cam.idle += dt;
  }
  function camFollow(dt) {
    const hs = Math.hypot(P.vel.x, P.vel.z), sp = P.vel.length();
    if (cam.idle > 0.7 && hs > 7 && P.state !== "wall" && !P.lunge && !P.fin) {
      cam.yaw = angLerp(cam.yaw, Math.atan2(-P.vel.x, -P.vel.z), damp(1.4, dt));
      cam.pitch = lerp(cam.pitch, P.state === "swing" ? -0.12 : -0.2, damp(1, dt));
    }
    _v3.set(P.pos.x, P.pos.y + 1.4, P.pos.z);
    cam.tgt.lerp(_v3, damp(20, dt));
    const boss2 = G.boss && G.boss.pos.distanceTo(P.pos) < 40;
    const want = 5.5 + clamp(sp / 55, 0, 1) * 3.5 + (P.state === "wall" ? 1 : 0) + (boss2 ? 4 : 0) + (P.fin ? 1.5 : 0);
    cam.dist = lerp(cam.dist, want, damp(3, dt));
    const cp = Math.cos(cam.pitch);
    _f3.set(-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), -Math.cos(cam.yaw) * cp);
    _b2.copy(_f3).negate();
    let d = cam.dist;
    const t = raycastCity(cam.tgt, _b2, d + 0.3);
    if (t < d + 0.3) d = Math.max(0.8, t - 0.4);
    camera.position.copy(cam.tgt).addScaledVector(_b2, d);
    if (camera.position.y < 0.4) camera.position.y = 0.4;
    camera.lookAt(cam.tgt);
    if (G.shake > 0) {
      G.shake = Math.max(0, G.shake - dt * 1.8);
      const s = G.shake * 0.35;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      camera.position.z += (Math.random() - 0.5) * s;
    }
    const fov = 68 + clamp(sp / 60, 0, 1) * 16;
    if (Math.abs(fov - camera.fov) > 0.05) {
      camera.fov = lerp(camera.fov, fov, damp(3, dt));
      camera.updateProjectionMatrix();
    }
  }
  function menuCam(dt) {
    const h = P.heading, a = Math.sin(G.time * 0.15) * 0.7, r = P.perch ? 4.2 : 6;
    camera.position.set(P.pos.x - Math.sin(h + a) * r, P.pos.y + 1.5, P.pos.z - Math.cos(h + a) * r);
    camera.lookAt(P.pos.x + Math.sin(h) * 12, P.pos.y + (P.perch ? -1.5 : 1), P.pos.z + Math.cos(h) * 12);
    if (camera.fov !== 60) {
      camera.fov = 60;
      camera.updateProjectionMatrix();
    }
  }
  var resScale = 1;
  var spT = 0;
  var spN = 0;
  var lowWarn = 0;
  function applyRes() {
    renderer.setPixelRatio(pixelRatio() * resScale);
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(innerWidth, innerHeight);
    }
  }
  function checkSpeed(rdt) {
    if (document.hidden) return;
    spT += rdt;
    spN++;
    if (spT < 2) return;
    const fps = spN / spT;
    spT = 0;
    spN = 0;
    if (dbg("fixres")) return;
    if (fps < 34 && resScale > 0.8) {
      resScale = Math.max(0.8, resScale - 0.05);
      applyRes();
    } else if (fps > 50 && resScale < 1) {
      resScale = Math.min(1, resScale + 0.05);
      applyRes();
    } else if (fps < 24 && resScale <= 0.8 && save.gfx === "high" && ++lowWarn >= 2) {
      hooks.gfx();
      showMsg("GRAFIKA: NISKA", "Prze\u0142\u0105czy\u0142em, \u017Ceby gra dzia\u0142a\u0142a p\u0142ynniej (zmienisz w Pauza \u2192 Gra)", 4);
    }
  }
  var last = performance.now();
  function step2(now) {
    const rdt = Math.min(0.05, Math.max(0, (now - last) / 1e3));
    last = now;
    pollPads();
    let dt = rdt;
    if (G.slowT > 0) {
      G.slowT -= rdt;
      dt = rdt * 0.35;
    }
    G.time += dt;
    if (G.state === "play" && G.cine) {
      updateCine(rdt);
    } else if (G.state === "play") {
      const I = gameInput();
      if (I.pauseP) openPause("game", false);
      else if (I.mapP) openPause("map", false);
      else {
        camLook(rdt, I);
        updatePlayer(dt, I);
        updateEnemies(dt);
        updateCrimes(dt);
        updateShots(dt);
        updateBags(dt);
        updateMissions(dt);
        camFollow(rdt);
        updateHUD(rdt);
        setWind(P.vel.length());
        cityAmbience(rdt, P.pos.y < 30);
        posT += rdt;
        if (posT > 8 && !P.dead && P.pos.y > 0 && P.pos.y < 400) {
          posT = 0;
          savePos();
        }
        checkSpeed(rdt);
      }
    } else if (G.state === "menu") {
      if (G.splash) {
        if (Object.keys(KP).length || Object.keys(MP).length || pad.b.some((b, i) => b && !pad.prev[i])) hideSplash();
      } else updateMenu(rdt);
      menuCam(rdt);
      setWind(0);
    } else if (G.state === "pause") {
      updatePause(rdt);
      setWind(0);
    }
    if (G.state === "play") updateRooms(dt);
    if (G.state !== "pause") {
      updateTraffic(dt);
      updateFX(dt);
      updatePlayerVisual(dt);
    }
    if (G.wp) {
      beacon.visible = true;
      beacon.position.set(G.wp.x, 300, G.wp.z);
    } else beacon.visible = false;
    updateEnv();
    if (composer) composer.render();
    else renderer.render(scene, camera);
    endFrame();
  }
  var zepsute = false;
  function loop(now) {
    requestAnimationFrame(loop);
    if (zepsute) return;
    try {
      step2(now);
    } catch (e) {
      zepsute = true;
      zglosBlad(e);
    }
  }
  requestAnimationFrame(loop);
  window.SPIDER = { G, P, cam, hooks, res: () => resScale, info: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), tick: (n, ms = 1e3 / 60) => {
    for (let i = 0; i < n; i++) step2(last + ms);
  } };
  try {
    const lm = sessionStorage.getItem("sp_load");
    if (lm) {
      sessionStorage.removeItem("sp_load");
      hooks.start(lm);
    }
  } catch (e) {
  }
})();
