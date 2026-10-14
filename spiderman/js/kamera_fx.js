// Efekty kamery: rozmycie radialne przy szybkim bujaniu, plytka glebia ostrosci (scenki i postoj), aberracja chromatyczna
// przy uderzeniach, linie predkosci, winieta dopasowana do pory dnia. Przebieg pelnoekranowy jest wlaczany tylko wtedy,
// gdy efekt jest widoczny (8 probek); na niskiej grafice zostaja linie predkosci i winieta (CSS/canvas 2D).
import { clamp, lerp, damp } from './util.js';
import { G, P, cam } from './stan.js';
import { todName } from './miasto.js';
import { wetU } from './pogoda.js';

export function makeFxPass() {
  return new THREE.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uZoom: { value: 0 }, uBlur: { value: 0 }, uCA: { value: 0 }, uTex: { value: new THREE.Vector2(1 / 1600, 1 / 900) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uZoom, uBlur, uCA; uniform vec2 uTex; varying vec2 vUv;
      void main(){
        vec2 c = vUv - .5; float w = smoothstep(.22, .95, length(c)*1.55);
        vec4 col = vec4(0.);
        for (int i = 0; i < 8; i++) {
          float fi = float(i), k = fi/7., a = fi*2.39996;
          vec2 d = vec2(cos(a), sin(a))*sqrt((fi+.5)/8.)*uBlur*w*3.*uTex;
          col += texture2D(tDiffuse, vUv - c*uZoom*w*k + d);
        }
        col /= 8.;
        if (uCA > 0.) { vec2 o = c*uCA*w; col.r = texture2D(tDiffuse, vUv - o).r; col.b = texture2D(tDiffuse, vUv + o).b; }
        gl_FragColor = col;
      }`,
  });
}

let spd = null, sx = null, vig = null, zoom = 0, blur = 0, idleT = 0, spdK = 0, spdT = 0, vigKey = '';
const SW = 320, SH = 180;
const VIG = {
  sunset: 'radial-gradient(ellipse at center,rgba(0,0,0,0) 52%,rgba(48,20,12,.5) 100%)',
  day: 'radial-gradient(ellipse at center,rgba(0,0,0,0) 58%,rgba(10,18,36,.3) 100%)',
  night: 'radial-gradient(ellipse at center,rgba(0,0,0,0) 48%,rgba(2,4,14,.66) 100%)',
};
function build() {
  spd = document.createElement('canvas'); spd.width = SW; spd.height = SH;
  spd.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;display:none';
  document.body.appendChild(spd); sx = spd.getContext('2d'); vig = document.getElementById('vig');
}
// pass: przebieg FX z kompozera (albo null na niskiej grafice)
export const fxBoost = { zoom: 0, ca: 0 }; // chwilowe impulsy (wykonczenie)
export function updateCameraFX(rdt, pass) {
  if (!spd) build();
  const play = G.state === 'play', sp = play && !G.cine ? P.vel.length() : 0;
  const kS = (P.state === 'swing' || P.state === 'air') ? clamp((sp - 28) / 36, 0, 1) : 0;
  zoom = lerp(zoom, kS * 0.07 + fxBoost.zoom, damp(fxBoost.zoom > 0 ? 14 : 4, rdt)); spdK = lerp(spdK, kS, damp(3, rdt));
  // glebia ostrosci: w scenkach mocna, gdy gracz stoi — lekka
  idleT = play && !G.cine && P.state === 'ground' && sp < 1.2 && cam.idle > 0.5 ? idleT + rdt : 0;
  const bT = G.cine ? 1.3 : clamp((idleT - 1.5) / 1.5, 0, 1) * 0.6;
  blur = lerp(blur, bT, damp(2.5, rdt));
  const ca = clamp((G.shake || 0) * 0.016, 0, 0.011) + (G.slowT > 0 ? 0.003 : 0) + fxBoost.ca;
  if (pass) {
    const on = zoom > 0.003 || blur > 0.03 || ca > 0.0004;
    pass.enabled = on;
    if (on) { const u = pass.uniforms; u.uZoom.value = zoom; u.uBlur.value = blur; u.uCA.value = ca; u.uTex.value.set(1 / innerWidth, 1 / innerHeight); }
  }
  // linie predkosci (30 kl./s, tylko gdy widoczne)
  if (spdK > 0.04 && play) {
    spd.style.display = 'block'; spdT += rdt;
    if (spdT > 1 / 30) {
      spdT = 0; sx.clearRect(0, 0, SW, SH); sx.lineCap = 'round';
      const n = 14 + (spdK * 22 | 0);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, r0 = 0.52 + Math.random() * 0.3, r1 = r0 + 0.12 + Math.random() * 0.3 * spdK, ca2 = Math.cos(a), sa = Math.sin(a);
        sx.strokeStyle = `rgba(255,255,255,${(0.04 + Math.random() * 0.13) * spdK})`; sx.lineWidth = 0.6 + Math.random() * 1.2;
        sx.beginPath(); sx.moveTo(SW / 2 + ca2 * r0 * SW * 0.62, SH / 2 + sa * r0 * SH * 0.8); sx.lineTo(SW / 2 + ca2 * r1 * SW * 0.62, SH / 2 + sa * r1 * SH * 0.8); sx.stroke();
      }
    }
  } else if (spd.style.display !== 'none') { spd.style.display = 'none'; sx.clearRect(0, 0, SW, SH); }
  // winieta: pora dnia, w deszczu nieco mocniejsza
  const key = todName + (wetU.uRain.value > 0.5 ? 'r' : '');
  if (vig && key !== vigKey) { vigKey = key; vig.style.background = VIG[todName] || VIG.sunset; vig.style.opacity = wetU.uRain.value > 0.5 ? '1' : '0.9'; }
}
