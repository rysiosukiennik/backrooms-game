// NIEBO: kopula nieba (gradient, chmury w kilku warstwach, gwiazdy, Ksiezyc, tarcza slonca), smugi swiatla (god rays),
// ptaki w oddali i samolot z kondensacyjna smuga. Wszystko tanio: jedna kopula z shaderem + 3 male obiekty (bez przebiegow pelnoekranowych).
import { V3 } from './util.js';

// ---------------------------------------------------------------- tekstura szumu (chmury, smugi cirrus, plamy Ksiezyca)
// Kanaly: R = chmury kopiaste (fbm), G = cirrus (wydluzony szum), B = fbm do plam na Ksiezycu. Kafelkowana, liczona raz.
function makeNoiseTex() {
  const N = 512, data = new Uint8Array(N * N * 4);
  const lat = (fx, fy, seed) => { const a = new Float32Array(fx * fy); let s = seed >>> 0; for (let i = 0; i < a.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = s / 4294967296; } return a; };
  const sm = (a, fx, fy, x, y) => {
    const X = x * fx, Y = y * fy, x0 = Math.floor(X), y0 = Math.floor(Y);
    let tx = X - x0, ty = Y - y0; tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
    const xa = x0 % fx, xb = (x0 + 1) % fx, ya = y0 % fy, yb = (y0 + 1) % fy;
    const a0 = a[ya * fx + xa], a1 = a[ya * fx + xb], b0 = a[yb * fx + xa], b1 = a[yb * fx + xb];
    return (a0 + (a1 - a0) * tx) + ((b0 + (b1 - b0) * tx) - (a0 + (a1 - a0) * tx)) * ty;
  };
  const oct = (bx, by, n, seed) => { const L = []; for (let k = 0; k < n; k++) L.push([lat(bx << k, by << k, seed + k * 977), bx << k, by << k, Math.pow(0.5, k)]); return L; };
  const run = (L, x, y) => { let v = 0, t = 0; for (const [a, fx, fy, w] of L) { v += sm(a, fx, fy, x, y) * w; t += w; } return v / t; };
  const R = oct(5, 5, 5, 11), G = oct(4, 9, 5, 53), B = oct(2, 2, 5, 97);
  const ct = (v, k) => Math.max(0, Math.min(1, (v - 0.5) * k + 0.5));
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = i / N, y = j / N, o = (j * N + i) * 4;
    data[o] = ct(run(R, x, y), 2.3) * 255;
    data[o + 1] = ct(run(G, x, y), 1.7) * 255;
    data[o + 2] = ct(run(B, x, y), 2.4) * 255;
    data[o + 3] = 255;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.anisotropy = 4; t.needsUpdate = true; return t;
}

// ---------------------------------------------------------------- parametry nieba na pore dnia (kolory "jak na ekranie", sRGB)
export const SKY_TOD = {
  sunset: { cover: 0.72, cK: 1.6, cLit: [1.0, 0.82, 0.6], cShade: [0.8, 0.54, 0.52], cirr: 0.85, cirrCol: [1.0, 0.8, 0.66], nightK: 0, starK: 0, belt: 0.16, cityG: 0, rays: 0.45, birds: 1, birdCol: [0.1, 0.07, 0.07], plane: [1.0, 0.82, 0.62], planeA: 0.75 },
  day: { cover: 0.8, cK: 1.05, cLit: [1.0, 1.0, 1.0], cShade: [0.58, 0.66, 0.82], cirr: 0.7, cirrCol: [1.0, 1.0, 1.0], nightK: 0, starK: 0, belt: 0, cityG: 0, rays: 0.12, birds: 1, birdCol: [0.08, 0.09, 0.1], plane: [1.0, 1.0, 1.0], planeA: 0.9 },
  night: { cover: 0.42, cK: 0.7, cLit: [0.38, 0.45, 0.68], cShade: [0.07, 0.09, 0.17], cirr: 0.4, cirrCol: [0.42, 0.5, 0.75], nightK: 1, starK: 1, belt: 0, cityG: 1, rays: 0, birds: 0, birdCol: [0.02, 0.02, 0.03], plane: [0.3, 0.35, 0.5], planeA: 0 },
};
const lin = a => a.map(v => Math.pow(v, 2.2));

// ---------------------------------------------------------------- kopula nieba
export function skyUniforms(sunDir) {
  return {
    sunDir: { value: sunDir }, top: { value: new V3() }, mid: { value: new V3() }, hor: { value: new V3() }, glowC: { value: new V3() }, disk: { value: 2.5 },
    tCloud: { value: null }, wind: { value: new THREE.Vector2() }, tm: { value: 0 },
    cover: { value: 0.5 }, cK: { value: 1 }, cirr: { value: 0.5 }, nightK: { value: 0 }, starK: { value: 0 }, belt: { value: 0 }, cityG: { value: 0 },
    cLit: { value: new V3(1, 1, 1) }, cShade: { value: new V3(0.5, 0.5, 0.6) }, cirrCol: { value: new V3(1, 1, 1) },
  };
}
export function skyMaterial(U) {
  U.tCloud.value = makeNoiseTex();
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: U,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform vec3 sunDir, top, mid, hor, glowC, cLit, cShade, cirrCol; uniform float disk, cover, cK, cirr, nightK, starK, belt, cityG, tm;
      uniform sampler2D tCloud; uniform vec2 wind; varying vec3 vP;
      float h13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
      // gestosc chmury kopiastej: duzy ksztalt + erozja drobnym szumem
      float cumD(vec2 uv, float th){
        float b = texture2D(tCloud, uv).r, e = texture2D(tCloud, uv*3.3+vec2(.37,.11)).r;
        return smoothstep(th, th+.2, b + .3*(e-.5));
      }
      void main(){
        vec3 d = normalize(vP); float h = d.y;
        float s = max(dot(d, sunDir), 0.);
        vec2 sdir = normalize(sunDir.xz + vec2(1e-4));
        vec2 ddir = normalize(d.xz + vec2(1e-4));
        vec3 c = mix(hor, mid, smoothstep(0.,.2,h)); c = mix(c, top, smoothstep(.14,.72,h));
        if(h<0.) c = mix(hor, hor*.7, smoothstep(0.,-.3,h));
        // rozpraszanie: ciepla poswiata przy slonca i rozowy pas Wenus po przeciwnej stronie
        c += glowC*pow(s,5.)*.7 + glowC*(pow(s,200.)*.8 + pow(s,40.)*.3);
        c += glowC*pow(max(dot(ddir,sdir),0.),4.)*exp(-h*7.)*.22*(1.-nightK);
        c += vec3(.85,.42,.5)*pow(max(dot(ddir,-sdir),0.),2.)*exp(-h*9.)*belt;
        // poswiata miasta na horyzoncie w nocy
        float az = texture2D(tCloud, vec2(atan(d.z,d.x)*.3183, .5)).g;
        c += vec3(.9,.45,.2)*exp(-max(h,0.)*10.)*cityG*(.05+.1*az);
        vec3 fogC = hor*.97 + glowC*pow(s,4.)*.45; // przy horyzoncie niebo przechodzi w mgle (bez ostrego pasa)
        // gwiazdy (w shaderze, wiec chmury je zaslaniaja)
        if(starK > .01){
          float sv = 0.;
          for(int i=0;i<2;i++){
            float sc = i==0 ? 170. : 95.; vec3 p = d*sc, id = floor(p), f = p-id;
            float r = h13(id+float(i)*7.3);
            vec3 cp = vec3(h13(id+1.7), h13(id+9.1), h13(id+4.3))*.6+.2;
            float thr = i==0 ? .94 : .975;
            sv += step(thr, r)*smoothstep(.3,.0,length(f-cp))*(.25+(r-thr)/(1.-thr)*1.6)*(.7+.3*sin(tm*2.3+r*80.));
          }
          vec3 sc3 = mix(vec3(.75,.82,1.), vec3(1.,.9,.8), h13(floor(d*40.)));
          c += sc3*sv*starK*smoothstep(.03,.3,h);
          // slaba Droga Mleczna
          float mw = exp(-pow(dot(d, normalize(vec3(.35,.75,.55)))*5.,2.))*texture2D(tCloud, d.xz*1.3+.2).b;
          c += vec3(.5,.55,.8)*mw*.07*starK*smoothstep(.05,.3,h);
        }
        // Ksiezyc (w nocy sunDir to kierunek Ksiezyca): tarcza z plamami, faza i poswiata
        if(nightK > .01 && s > .9){
          vec3 tx = normalize(cross(vec3(0.,1.,0.), sunDir)), ty = cross(sunDir, tx);
          vec2 q = vec2(dot(d,tx), dot(d,ty))/.034; float r2 = dot(q,q);
          if(r2 < 1.2){
            vec3 nrm = vec3(q, sqrt(max(1.-r2,0.)));
            float ph = clamp(dot(nrm, normalize(vec3(.62,.28,.74)))*3.2+.3, .05, 1.);
            float alb = .62 + .75*(texture2D(tCloud, q*.3+.5).b-.5);
            vec3 mc = vec3(1.,.96,.86)*alb*ph*1.9;
            c = mix(c, mc, 1.-smoothstep(.9,1.,r2));
          }
          c += vec3(.4,.48,.8)*(pow(s,180.)*.55 + pow(s,30.)*.12 + pow(s,6.)*.03)*nightK;
        }
        // tarcza slonca: ostry rdzen z miekkim brzegiem
        float sd = 1. - s;
        float sundisk = smoothstep(3.4e-4, 1.8e-4, sd)*(1.-nightK);
        float cloudA = 0., cloudAny = 0.;
        // --- chmury: cirrus (najwyzej), altocumulus (srodek), cumulus (najnizej, najblizej)
        float fadeH = smoothstep(0., .13, h);
        if(h > 0.){
          vec2 uvC = vec2(d.x*.8 - d.z*.6, d.x*.6 + d.z*.8)/(h+.2)*vec2(.4,.9);
          float ci = texture2D(tCloud, uvC + wind*1.8).g*.65 + texture2D(tCloud, uvC*vec2(2.3,5.1) + wind*2.4 + .3).g*.35;
          float aC = smoothstep(.42,1.05,ci)*cirr*smoothstep(.01,.22,h)*.42;
          c = mix(c, cirrCol*cK*(.8+.5*pow(s,6.)), aC);
          cloudAny = aC*.5;

          vec2 uvB = d.xz/(h+.24)*.6 + wind*1.5 + .31;
          float thB = mix(.8,.5,cover) + (1.-smoothstep(0.,.3,h))*.1;
          float dB = cumD(uvB, thB), lB = cumD(uvB+sdir*.03, thB);
          vec3 colB = mix(cShade*1.15, cLit, exp(-2.2*(lB+.3*dB)));
          colB += cLit*pow(s,8.)*(1.-dB)*dB*2.2*(1.-.5*nightK);
          float aB = dB*.75*fadeH;
          c = mix(c, colB*cK, aB); cloudAny = max(cloudAny, aB);

          vec2 uvA = d.xz/(h+.1)*.34 + wind;
          float thA = mix(.72,.4,cover) + (1.-smoothstep(0.,.3,h))*.08;
          float dA = cumD(uvA, thA);
          float lA = .5*(cumD(uvA+sdir*.016,thA) + cumD(uvA+sdir*.042,thA));
          float TA = exp(-1.7*(lA + .35*dA));
          vec3 colA = mix(cShade, cLit, TA);
          colA += cLit*pow(s,9.)*(1.-dA)*dA*3.2*(1.-.5*nightK);          // podswietlony brzeg
          colA *= 1. - .3*smoothstep(.3,1.,dA)*(1.-TA);                    // ciemniejsze spody
          cloudA = dA*.96*fadeH;
          c = mix(c, colA*cK, cloudA); cloudAny = max(cloudAny, cloudA);
          // swiatlo slonca przebijajace przez cienkie chmury
          c += glowC*(pow(s,40.)*.5 + pow(s,12.)*.1)*cloudAny*(1.-nightK);
        }
        // tarcza slonca (przysloniete chmura) i jej poswiata
        c += vec3(1.,.95,.85)*(sundisk + pow(s,900.)*.12*(1.-nightK))*disk*(1.-cloudA*.9);
        c = mix(fogC, c, smoothstep(-.01,.12,h));
        gl_FragColor = vec4(c,1.);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
}
export function setSkyTOD(U, name) {
  const T = SKY_TOD[name] || SKY_TOD.sunset;
  U.cover.value = T.cover; U.cK.value = T.cK; U.cirr.value = T.cirr; U.nightK.value = T.nightK; U.starK.value = T.starK; U.belt.value = T.belt; U.cityG.value = T.cityG;
  U.cLit.value.set(...lin(T.cLit)); U.cShade.value.set(...lin(T.cShade)); U.cirrCol.value.set(...lin(T.cirrCol));
}
// chmury plyna wolno; kazda warstwa ma swoja predkosc (mnozniki w shaderze)
export function updateSky(U, time) { U.tm.value = time; U.wind.value.set(time * 0.0034, time * 0.0013); }

// ---------------------------------------------------------------- dodatki: smugi swiatla, ptaki, samolot
const common = '\n#include <tonemapping_fragment>\n#include <encodings_fragment>';
export let fx = null;
export function createSkyFX(scene) {
  const out = new THREE.Group(); out.frustumCulled = false; scene.add(out);

  // --- smugi swiatla (crepuscular rays): wstegi wzdluz kierunku slonca, zakotwiczone w swiecie, rozjasniaja sie patrzac w slonce
  const NR = 22, pos = [], uvs = [], par = [], bas = [], idx = [];
  for (let i = 0; i < NR; i++) {
    const w = 7 + Math.random() * 26, len = 600 + Math.random() * 300, seed = Math.random();
    const bu = Math.random() * 600, bv = Math.random() * 600;
    for (const [ux, uy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) { pos.push(0, 0, 0); uvs.push(ux, uy); par.push(w, len, seed); bas.push(bu, bv); }
    const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); rg.setAttribute('aUV', new THREE.Float32BufferAttribute(uvs, 2));
  rg.setAttribute('aP', new THREE.Float32BufferAttribute(par, 3)); rg.setAttribute('aB', new THREE.Float32BufferAttribute(bas, 2)); rg.setIndex(idx);
  const RU = { uSun: { value: new V3() }, uCam: { value: new V3() }, uK: { value: 0 }, uCol: { value: new V3(1, .8, .55) }, uTime: { value: 0 } };
  const rays = new THREE.Mesh(rg, new THREE.ShaderMaterial({
    uniforms: RU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `attribute vec2 aUV, aB; attribute vec3 aP; uniform vec3 uSun, uCam; varying vec2 vUV; varying vec3 vWP; varying float vS, vE;
      void main(){
        const float R = 300.;
        vec3 U = normalize(cross(uSun, vec3(0.,1.,0.))), V = cross(U, uSun);
        vec2 q = mod(aB - vec2(dot(uCam,U), dot(uCam,V)) + R, 2.*R) - R;
        vec3 ctr = uCam + U*q.x + V*q.y;
        vec3 p0 = ctr + uSun*(aUV.y-.5)*aP.y;
        vec3 rt = normalize(cross(uSun, uCam - p0));
        vec3 wp = p0 + rt*aUV.x*aP.x;
        vUV = aUV; vWP = wp; vS = aP.z; vE = 1. - smoothstep(.7*R, R, max(abs(q.x), abs(q.y)));
        gl_Position = projectionMatrix*viewMatrix*vec4(wp,1.);
      }`,
    fragmentShader: `uniform vec3 uSun, uCam, uCol; uniform float uK, uTime; varying vec2 vUV; varying vec3 vWP; varying float vS, vE;
      void main(){
        float across = 1. - abs(vUV.x), prof = across*across*(3.-2.*across);
        float along = smoothstep(0.,.2,vUV.y)*smoothstep(1.,.55,vUV.y);
        vec3 vd = normalize(vWP - uCam); float dd = length(vWP - uCam);
        float ph = pow(max(dot(vd,uSun),0.), 3.)*.9 + .08;
        float fade = smoothstep(18.,110.,dd)*smoothstep(1100.,350.,dd)*smoothstep(1.,22.,vWP.y)*vE;
        float sh = .65 + .35*sin(uTime*.3 + vS*40. + vUV.y*3.);
        float a = prof*along*ph*fade*sh*uK;
        gl_FragColor = vec4(uCol, a);
        ${common}
      }`,
  }));
  rays.frustumCulled = false; rays.renderOrder = 4; out.add(rays);

  // --- ptaki: 3 stada kraza nad miastem; skrzydla (szewron) machaja w shaderze
  const NB = 42, bp = new Float32Array(NB * 3), bph = new Float32Array(NB), flocks = [];
  for (let f = 0; f < 3; f++) flocks.push({ cx: (Math.random() - .5) * 700, cz: (Math.random() - .5) * 700, cy: 140 + Math.random() * 160, R: 120 + Math.random() * 160, w: (0.06 + Math.random() * 0.05) * (Math.random() < .5 ? -1 : 1), ph: Math.random() * 6.28 });
  const bo = [];
  for (let i = 0; i < NB; i++) { bo.push([(Math.random() - .5) * 46, (Math.random() - .5) * 18, (Math.random() - .5) * 46, Math.random() * 6.28]); bph[i] = Math.random() * 6.28; }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3)); bg.setAttribute('aPh', new THREE.BufferAttribute(bph, 1));
  const BU = { uT: { value: 0 }, uCol: { value: new V3(.1, .08, .08) }, uVis: { value: 1 }, uSz: { value: 520 } };
  const birds = new THREE.Points(bg, new THREE.ShaderMaterial({
    uniforms: BU, transparent: true, depthWrite: false, fog: false,
    vertexShader: `attribute float aPh; uniform float uT, uSz; varying float vF;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vF = sin(uT*8. + aPh*3.);
        gl_PointSize = clamp(uSz/max(-mv.z,1.), 2.5, 12.); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uVis; varying float vF;
      void main(){ vec2 p = gl_PointCoord*2.-1.; float x = abs(p.x); float yl = -p.y - (x*vF*.8 - .1);
        float a = smoothstep(.32,.12,abs(yl))*step(x,.95); if(a < .05) discard;
        gl_FragColor = vec4(uCol, a*uVis); ${common} }`,
  }));
  birds.frustumCulled = false; out.add(birds);

  // --- samolot z kondensacyjna smuga: raz na jakis czas wysoko przelatuje przez niebo
  const PP = new Float32Array(3), pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(PP, 3));
  const pm = new THREE.PointsMaterial({ color: 0xffffff, size: 2.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  const planeDot = new THREE.Points(pg, pm); planeDot.frustumCulled = false; planeDot.visible = false; out.add(planeDot);
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.Float32BufferAttribute(new Array(12).fill(0), 3));
  cg.setAttribute('aT', new THREE.Float32BufferAttribute([0, 0, 1, 1], 1)); cg.setAttribute('aS', new THREE.Float32BufferAttribute([-1, 1, -1, 1], 1)); cg.setIndex([0, 1, 2, 1, 3, 2]);
  const CU = { uHead: { value: new V3() }, uTail: { value: new V3() }, uCam: { value: new V3() }, uCol: { value: new V3(1, 1, 1) }, uA: { value: 0 } };
  const trail = new THREE.Mesh(cg, new THREE.ShaderMaterial({
    uniforms: CU, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    vertexShader: `attribute float aT, aS; uniform vec3 uHead, uTail, uCam; varying float vT; varying float vS;
      void main(){ vec3 p = mix(uTail, uHead, aT); vec3 ax = normalize(uHead-uTail); vec3 rt = normalize(cross(ax, uCam-p));
        float wd = 9. + 22.*(1.-aT); vT = aT; vS = aS;
        gl_Position = projectionMatrix*viewMatrix*vec4(p + rt*aS*wd, 1.); }`,
    fragmentShader: `uniform vec3 uCol; uniform float uA; varying float vT; varying float vS;
      void main(){ float across = 1. - abs(vS); float lump = .75 + .25*sin(vT*140.) * sin(vT*53.+1.);
        float a = pow(vT, 1.6)*across*lump*uA; gl_FragColor = vec4(uCol, a); ${common} }`,
  }));
  trail.frustumCulled = false; trail.visible = false; trail.renderOrder = 3; out.add(trail);
  const pl = { on: false, t: 0, next: 12 + Math.random() * 30, o: new V3(), dir: new V3(), speed: 110, T: 0 };
  function spawnPlane(t0 = 0, thF = null) {
    const th = thF ?? Math.random() * 6.283, off = (900 + Math.random() * 500) * (thF == null && Math.random() < .5 ? -1 : 1), alt = 1300 + Math.random() * 400;
    pl.dir.set(Math.cos(th), 0, Math.sin(th));
    pl.o.set(-Math.sin(th) * off, alt, Math.cos(th) * off).addScaledVector(pl.dir, -1900);
    pl.on = true; pl.t = t0; pl.T = (3800 + 1800) / pl.speed;
  }

  const hp = new V3(), tp = new V3();
  let curName = 'sunset', curSky = SKY_TOD.sunset;
  return fx = {
    spawnPlane,
    setTOD(name) {
      curName = name; curSky = SKY_TOD[name] || SKY_TOD.sunset;
      RU.uK.value = curSky.rays; rays.visible = curSky.rays > 0;
      birds.visible = curSky.birds > 0; BU.uCol.value.set(...lin(curSky.birdCol));
      CU.uCol.value.set(...lin(curSky.plane)); CU.uA.value = curSky.planeA;
      pm.color.setRGB(...lin(name === 'night' ? [1, 0.3, 0.25] : curSky.plane).map(v => v * (name === 'night' ? 1 : 1.2)));
    },
    update(cam, sunDir, time, dt, inside) {
      out.visible = !inside;
      if (inside) return;
      RU.uSun.value.copy(sunDir); RU.uCam.value.copy(cam.position); RU.uTime.value = time;
      if (birds.visible) {
        BU.uT.value = time;
        for (let i = 0; i < NB; i++) {
          const f = flocks[i % 3], o = bo[i], a = f.ph + f.w * time;
          bp[i * 3] = f.cx + Math.cos(a) * f.R + o[0] + Math.sin(time * .5 + o[3]) * 3;
          bp[i * 3 + 1] = f.cy + o[1] + Math.sin(time * .3 + o[3]) * 4;
          bp[i * 3 + 2] = f.cz + Math.sin(a) * f.R + o[2] + Math.cos(time * .5 + o[3]) * 3;
        }
        bg.attributes.position.needsUpdate = true;
      }
      if (!pl.on) { pl.next -= dt; if (pl.next <= 0) { spawnPlane(); pl.next = 70 + Math.random() * 80; } }
      if (pl.on) {
        pl.t += dt; const trav = pl.t * pl.speed, tl = Math.min(trav, 1800);
        hp.copy(pl.o).addScaledVector(pl.dir, trav); tp.copy(pl.o).addScaledVector(pl.dir, trav - tl);
        const vis = curName !== 'night';
        trail.visible = vis && trav > 60;
        CU.uHead.value.copy(hp); CU.uTail.value.copy(tp); CU.uCam.value.copy(cam.position);
        // po przelocie smuga rozplywa sie
        CU.uA.value = curSky.planeA * Math.min(1, Math.max(0, (pl.T - pl.t) / 12));
        PP[0] = hp.x; PP[1] = hp.y; PP[2] = hp.z; pg.attributes.position.needsUpdate = true;
        const blink = curName === 'night' ? (Math.sin(time * 6) > .3 ? 1 : 0.15) : 1;
        planeDot.visible = trav < 3800; pm.opacity = blink;
        if (pl.t > pl.T) { pl.on = false; trail.visible = false; planeDot.visible = false; }
      } else { trail.visible = false; planeDot.visible = false; }
    },
  };
}
