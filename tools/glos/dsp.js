'use strict';
// DSP do przerabiania glosu SAPI (Paulina, ok. 190-220 Hz) na postacie gry. Bez zaleznosci.
// Elementy: WAV I/O, filtry biquad, estymacja F0 (autokorelacja), resampling (sinc) do przesuwania formantow,
// TD-PSOLA do zmiany wysokosci/tempa, efekty (kompresor, pogłos, znieksztalcenia, radio), analiza jakosci.

const DSP_VERSION = 3;

// ---------------------------------------------------------------- WAV
function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('to nie WAV');
  let p = 12, fmt = null, data = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4); const sz = buf.readUInt32LE(p + 4); const body = p + 8;
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(body), ch: buf.readUInt16LE(body + 2), rate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    else if (id === 'data') { data = buf.subarray(body, Math.min(body + sz, buf.length)); }
    p = body + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('brak fmt/data');
  if (fmt.bits !== 16 || fmt.tag !== 1) throw new Error('obslugiwany tylko PCM 16 bit');
  const n = Math.floor(data.length / 2 / fmt.ch);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2);
    x[i] = s / fmt.ch / 32768;
  }
  return { rate: fmt.rate, data: x };
}

function wavHeader(fmtTag, rate, bits, dataLen, withFact, nSamples) {
  const fmtLen = fmtTag === 1 ? 16 : 18;
  const factLen = withFact ? 12 : 0;
  const h = Buffer.alloc(12 + 8 + fmtLen + factLen + 8);
  let o = 0;
  h.write('RIFF', o); o += 4; h.writeUInt32LE(h.length - 8 + dataLen, o); o += 4; h.write('WAVE', o); o += 4;
  h.write('fmt ', o); o += 4; h.writeUInt32LE(fmtLen, o); o += 4;
  const bytes = bits / 8;
  h.writeUInt16LE(fmtTag, o); o += 2; h.writeUInt16LE(1, o); o += 2; h.writeUInt32LE(rate, o); o += 4;
  h.writeUInt32LE(rate * bytes, o); o += 4; h.writeUInt16LE(bytes, o); o += 2; h.writeUInt16LE(bits, o); o += 2;
  if (fmtLen === 18) { h.writeUInt16LE(0, o); o += 2; }
  if (withFact) { h.write('fact', o); o += 4; h.writeUInt32LE(4, o); o += 4; h.writeUInt32LE(nSamples, o); o += 4; }
  h.write('data', o); o += 4; h.writeUInt32LE(dataLen, o);
  return h;
}
function toInt16(x) {
  const b = Buffer.alloc(x.length * 2);
  for (let i = 0; i < x.length; i++) { let v = Math.round(x[i] * 32767); if (v > 32767) v = 32767; else if (v < -32768) v = -32768; b.writeInt16LE(v, i * 2); }
  return b;
}
function wavPcm16(x, rate) { const d = toInt16(x); return Buffer.concat([wavHeader(1, rate, 16, d.length, false, 0), d]); }
function lin2ulaw(s) {
  const BIAS = 0x84, CLIP = 32635;
  const sign = (s >> 8) & 0x80; if (sign) s = -s; if (s > CLIP) s = CLIP; s += BIAS;
  let exp = 7; for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1);
  const man = (s >> (exp + 3)) & 0x0F;
  return (~(sign | (exp << 4) | man)) & 0xFF;
}
function wavMuLaw(x, rate) {
  const d = Buffer.alloc(x.length);
  for (let i = 0; i < x.length; i++) { let v = Math.round(x[i] * 32767); if (v > 32767) v = 32767; if (v < -32767) v = -32767; d[i] = lin2ulaw(v); }
  return Buffer.concat([wavHeader(7, rate, 8, d.length, true, x.length), d]);
}

// ---------------------------------------------------------------- narzedzia
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashInt(str) { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const dB2lin = d => Math.pow(10, d / 20);
function median(a) { if (!a.length) return 0; const s = Array.from(a).sort((p, q) => p - q); const m = s.length >> 1; return s.length & 1 ? s[m] : (s[m - 1] + s[m]) / 2; }
function peakOf(x) { let p = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > p) p = v; } return p; }
function rmsOf(x, a = 0, b = x.length) { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); }

// ---------------------------------------------------------------- biquad (RBJ)
function bq(type, fs, f, Q, dB) {
  f = Math.min(f, fs * 0.45);
  const A = Math.pow(10, (dB || 0) / 40), w = 2 * Math.PI * f / fs, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * (Q || 0.707));
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case 'lp': b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'hp': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'bp': b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case 'peak': b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case 'ls': { const be = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) - (A - 1) * cw + be); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - be); a0 = (A + 1) + (A - 1) * cw + be; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - be; break; }
    case 'hs': { const be = 2 * Math.sqrt(A) * al; b0 = A * ((A + 1) + (A - 1) * cw + be); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - be); a0 = (A + 1) - (A - 1) * cw + be; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - be; break; }
    default: throw new Error('biquad ' + type);
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function filt(x, c) {
  const y = new Float32Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; const o = c.b0 * v + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = o; y[i] = o; }
  return y;
}
function filtfilt(x, c) { let y = filt(x, c); y.reverse(); y = filt(y, c); y.reverse(); return y; }

// ---------------------------------------------------------------- resampling (sinc okienkowany)
// out[k] = x(k * ratio): ratio < 1 -> wolniej/nizej (obnizenie wysokosci i formantow), ratio > 1 -> szybciej/wyzej.
function resample(x, ratio, hw = 14) {
  const n = x.length, outN = Math.max(1, Math.floor((n - 1) / ratio) + 1), y = new Float32Array(outN);
  const fc = Math.min(1, 1 / ratio) * 0.96, hwe = Math.ceil(hw / fc);
  for (let k = 0; k < outN; k++) {
    const pos = k * ratio, i0 = Math.floor(pos); let s = 0;
    for (let j = i0 - hwe + 1; j <= i0 + hwe; j++) {
      if (j < 0 || j >= n) continue;
      const t = pos - j, a = t * fc, px = Math.PI * a;
      const sinc = Math.abs(a) < 1e-9 ? 1 : Math.sin(px) / px;
      const u = t / hwe; if (u <= -1 || u >= 1) continue;
      const win = 0.42 + 0.5 * Math.cos(Math.PI * u) + 0.08 * Math.cos(2 * Math.PI * u); // Blackman
      s += x[j] * fc * sinc * win;
    }
    y[k] = s;
  }
  return y;
}

// ---------------------------------------------------------------- FFT (radix-2)
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

// ---------------------------------------------------------------- F0 (autokorelacja znormalizowana)
function f0Track(x, rate, o = {}) {
  const fmin = o.fmin || 60, fmax = o.fmax || 420, hopMs = o.hopMs || 10;
  const dec = rate > 16000 ? 2 : 1;
  let lo = filtfilt(x, bq('lp', rate, 1400, 0.707));
  let xd = lo;
  if (dec > 1) { xd = new Float32Array(Math.floor(lo.length / dec)); for (let i = 0; i < xd.length; i++) xd[i] = lo[i * dec]; }
  const r = rate / dec, hop = Math.round(hopMs * rate / 1000), hopD = Math.round(hop / dec);
  const W = Math.round(0.034 * r), lagMin = Math.max(2, Math.floor(r / fmax)), lagMax = Math.ceil(r / fmin);
  const nF = Math.floor(xd.length / hopD) + 1;
  const cum = new Float64Array(xd.length + 1); for (let i = 0; i < xd.length; i++) cum[i + 1] = cum[i] + xd[i] * xd[i];
  const f0 = new Float32Array(nF), harm = new Float32Array(nF), en = new Float32Array(nF);
  const R = new Float64Array(lagMax + 2); let maxEn = 0;
  const get = i => (i >= 0 && i < xd.length) ? xd[i] : 0;
  for (let k = 0; k < nF; k++) {
    const s = k * hopD - (W >> 1);
    const a = clamp(s, 0, xd.length), b = clamp(s + W, 0, xd.length);
    en[k] = Math.sqrt((cum[b] - cum[a]) / W); if (en[k] > maxEn) maxEn = en[k];
  }
  for (let k = 0; k < nF; k++) {
    if (en[k] < 0.04 * maxEn) continue;
    const s = k * hopD - (W >> 1);
    const e0 = cum[clamp(s + W, 0, xd.length)] - cum[clamp(s, 0, xd.length)];
    let best = 0, bl = 0;
    for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
      let num = 0; for (let i = 0; i < W; i++) num += get(s + i) * get(s + i + lag);
      const e1 = cum[clamp(s + W + lag, 0, xd.length)] - cum[clamp(s + lag, 0, xd.length)];
      R[lag] = num / Math.sqrt(e0 * e1 + 1e-12);
      if (lag >= lagMin && lag <= lagMax && R[lag] > best) { best = R[lag]; bl = lag; }
    }
    if (best < 0.5 || !bl) continue;
    let pick = bl;
    for (let lag = lagMin; lag <= lagMax; lag++) { if (R[lag] >= 0.88 * best && R[lag] >= R[lag - 1] && R[lag] >= R[lag + 1]) { pick = lag; break; } }
    const y0 = R[pick - 1], y1 = R[pick], y2 = R[pick + 1], den = y0 - 2 * y1 + y2;
    const off = den !== 0 ? 0.5 * (y0 - y2) / den : 0;
    f0[k] = r / (pick + clamp(off, -1, 1)); harm[k] = R[pick];
  }
  // wygladzanie: usuniecie krotkich wysp, korekta oktaw, mediana 5
  const out = Float32Array.from(f0);
  for (let k = 0; k < nF;) { if (!out[k]) { k++; continue; } let e = k; while (e < nF && out[e]) e++; if (e - k < 3) for (let j = k; j < e; j++) out[j] = 0; k = e; }
  for (let k = 0; k < nF; k++) {
    if (!out[k]) continue; const nb = []; for (let j = -4; j <= 4; j++) if (j && out[k + j] > 0) nb.push(out[k + j]);
    if (nb.length < 3) continue; const m = median(nb), q = out[k] / m;
    if (q > 1.8 && q < 2.25) out[k] /= 2; else if (q > 0.44 && q < 0.56) out[k] *= 2;
  }
  const sm = Float32Array.from(out);
  for (let k = 2; k < nF - 2; k++) { if (!out[k]) continue; const w = []; for (let j = -2; j <= 2; j++) if (out[k + j] > 0) w.push(out[k + j]); if (w.length >= 3) sm[k] = median(w); }
  return { f0: sm, harm, en, hop, n: nF, rate };
}
function voicedList(tr) { const v = []; for (let i = 0; i < tr.n; i++) if (tr.f0[i] > 0) v.push(tr.f0[i]); return v; }

// ---------------------------------------------------------------- TD-PSOLA
// o: { f0:Hz | f0r:ratio wzgledem mediany zrodla, contour, timeScale (wyjscie/wejscie), tremor:[glebokosc,Hz], rng }
function psola(x, rate, tr, o) {
  const n = x.length, hop = tr.hop, f0 = tr.f0;
  const voiced = voicedList(tr), srcMed = median(voiced) || 150;
  const base = o.f0 || srcMed * (o.f0r || 1), contour = o.contour == null ? 1 : o.contour, ts = o.timeScale || 1;
  const f0At = t => {
    const p = t / hop, i = Math.floor(p), fr = p - i; const a = f0[clamp(i, 0, tr.n - 1)], b = f0[clamp(i + 1, 0, tr.n - 1)];
    if (a > 0 && b > 0) return a + (b - a) * fr; return fr < 0.5 ? a : b;
  };
  // znaczniki wysokosci (epoki) na sygnale dolnoprzepustowym
  const xl = filtfilt(x, bq('lp', rate, 800, 0.707));
  let mx = 0, mn = 0; for (let i = 0; i < n; i++) { if (xl[i] > mx) mx = xl[i]; if (xl[i] < mn) mn = xl[i]; }
  const pol = mx >= -mn ? 1 : -1;
  const argmax = (a, b) => { a = clamp(Math.round(a), 0, n - 1); b = clamp(Math.round(b), 0, n - 1); let bi = a, bv = -1e9; for (let i = a; i <= b; i++) { const v = pol * xl[i]; if (v > bv) { bv = v; bi = i; } } return bi; };
  const marks = []; const U = Math.round(0.007 * rate); let pos = 0, prevV = false, last = -1e9;
  while (pos < n) {
    const f = f0At(pos);
    if (f > 0) {
      const T = rate / f; let m;
      if (!prevV) m = argmax(pos, pos + T);
      else { const c = last + T, w = 0.3 * T; m = argmax(c - w, c + w); if (m <= last + 0.5 * T) m = Math.round(last + T); }
      if (m >= n) break;
      marks.push({ m, P: T, v: true }); last = m; pos = m; prevV = true;
    } else { marks.push({ m: pos, P: U, v: false }); pos += U; prevV = false; }
  }
  if (!marks.length) return x;
  const outLen = Math.ceil(n * ts) + Math.round(0.05 * rate), pad = Math.round(0.06 * rate);
  const acc = new Float64Array(outLen + 2 * pad), wt = new Float64Array(outLen + 2 * pad);
  let t = 0, i = 0; const [tdep, thz] = o.tremor || [0, 5];
  const ph = o.rng ? o.rng() * 6.28 : 0;
  while (t < n * ts) {
    const ta = t / ts;
    while (i + 1 < marks.length && Math.abs(marks[i + 1].m - ta) <= Math.abs(marks[i].m - ta)) i++;
    const mk = marks[i]; let Tn, L;
    if (mk.v) {
      const srcF = rate / mk.P; let tgt = base * Math.pow(srcF / srcMed, contour);
      if (tdep) tgt *= 1 + tdep * Math.sin(2 * Math.PI * thz * t / rate + ph);
      const ratio = clamp(tgt / srcF, 0.42, 1.8); Tn = mk.P / ratio; L = Math.round(Math.max(2 * mk.P, 1.4 * Tn));
    } else { Tn = mk.P; L = Math.round(2 * mk.P); }
    const half = L >> 1, c = Math.round(t);
    for (let j = 0; j < L; j++) {
      const s = mk.m - half + j, d = c - half + j; if (s < 0 || s >= n || d < -pad || d >= outLen + pad) continue;
      const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * j / L);
      acc[d + pad] += x[s] * w; wt[d + pad] += w;
    }
    t += Tn;
  }
  const y = new Float32Array(Math.ceil(n * ts));
  for (let k = 0; k < y.length; k++) y[k] = acc[k + pad] / Math.max(wt[k + pad], 0.35);
  return y;
}

// ---------------------------------------------------------------- obrobka
function trimSilence(x, rate, o = {}) {
  const thr = dB2lin(o.thrDb == null ? -42 : o.thrDb), lead = Math.round((o.lead == null ? 0.03 : o.lead) * rate), tail = Math.round((o.tail == null ? 0.10 : o.tail) * rate);
  const w = Math.round(0.005 * rate), nW = Math.floor(x.length / w); const e = new Float32Array(nW); let mx = 0;
  for (let k = 0; k < nW; k++) { e[k] = rmsOf(x, k * w, (k + 1) * w); if (e[k] > mx) mx = e[k]; }
  let a = 0, b = nW - 1; while (a < nW && e[a] < thr * mx) a++; while (b > a && e[b] < thr * mx) b--;
  const s = Math.max(0, a * w - lead), t = Math.min(x.length, (b + 1) * w + tail);
  return x.slice(s, Math.max(s + 1, t));
}
function fades(x, rate, inMs = 6, outMs = 45) {
  const a = Math.round(inMs * rate / 1000), b = Math.round(outMs * rate / 1000);
  for (let i = 0; i < a && i < x.length; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a);
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / b);
  return x;
}
function envelope(x, rate, atkMs = 3, relMs = 40) {
  const a = Math.exp(-1 / (atkMs * rate / 1000)), r = Math.exp(-1 / (relMs * rate / 1000)), e = new Float32Array(x.length); let v = 0;
  for (let i = 0; i < x.length; i++) { const m = Math.abs(x[i]); v = m > v ? a * v + (1 - a) * m : r * v + (1 - r) * m; e[i] = v; }
  return e;
}
function compress(x, rate, o = {}) {
  const thr = dB2lin(o.thrDb == null ? -22 : o.thrDb), ratio = o.ratio || 2.5, makeup = dB2lin(o.makeupDb == null ? 0 : o.makeupDb);
  const e = envelope(x, rate, o.atk || 4, o.rel || 90), y = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) { let g = 1; if (e[i] > thr) g = Math.pow(e[i] / thr, 1 / ratio - 1); y[i] = x[i] * g * makeup; }
  return y;
}
function makeIR(rate, rng, o) { // maly pogłos: wczesne odbicia + zanikajacy szum
  const len = Math.round((o.tail || 0.06) * rate), ir = new Float32Array(len);
  const rt = o.rt || o.tail || 0.06;
  for (let i = 0; i < len; i++) ir[i] = (rng() * 2 - 1) * Math.exp(-6.9 * i / (rt * rate)) * 0.5;
  for (let k = 0; k < 7; k++) { const p = Math.round((0.003 + rng() * 0.02) * rate); if (p < len) ir[p] += (rng() < 0.5 ? -1 : 1) * (0.5 - k * 0.05); }
  const f = filt(ir, bq('lp', rate, o.damp || 3500, 0.707)); return f;
}
function reverb(x, rate, rng, o) {
  const ir = makeIR(rate, rng, o), wet = o.wet, y = new Float32Array(x.length + ir.length);
  for (let i = 0; i < x.length; i++) y[i] += x[i];
  let en = 0; for (let j = 0; j < ir.length; j++) en += ir[j] * ir[j]; const norm = wet / Math.sqrt(en + 1e-9) * 0.35;
  for (let i = 0; i < x.length; i += 1) { const v = x[i] * norm; if (!v) continue; for (let j = 0; j < ir.length; j++) y[i + j] += v * ir[j]; }
  return y;
}
function noise(n, rng) { const y = new Float32Array(n); for (let i = 0; i < n; i++) y[i] = rng() * 2 - 1; return y; }
function softLimit(x, ceil = 0.93, knee = 0.7) {
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > knee) x[i] = Math.sign(x[i]) * (knee + (ceil - knee) * Math.tanh((a - knee) / (ceil - knee))); }
  return x;
}
function finalize(x, levelDb = -17, ceil = 0.93) {
  // poziom RMS po aktywnej czesci, potem miekki limiter (nigdy > ceil < 0,95)
  const w = Math.round(0.02 * 22050); let acc = 0, cnt = 0, mx = 0; const rm = [];
  for (let k = 0; k + w <= x.length; k += w) { const r = rmsOf(x, k, k + w); rm.push(r); if (r > mx) mx = r; }
  for (const r of rm) if (r > 0.1 * mx) { acc += r * r; cnt++; }
  const rms = Math.sqrt(acc / Math.max(1, cnt)) || 1e-6;
  const g = dB2lin(levelDb) / rms; for (let i = 0; i < x.length; i++) x[i] *= g;
  return softLimit(x, ceil, 0.7);
}

// ---------------------------------------------------------------- presety
// f0: docelowa mediana F0 (Hz); formant: mnoznik formantow; tempo: >1 szybciej; contour: >1 bardziej "zywa" intonacja.
// sapiRate: Rate SAPI (-10..10). eq: [typ, f, Q, dB]. level: RMS w dBFS.
const PRESETS = {
  peter: { sapiRate: 1, f0: 122, formant: 0.87, tempo: 1.05, contour: 1.12, hp: 75,
    eq: [['ls', 190, 0.8, 2.5], ['peak', 420, 0.9, 1.2], ['peak', 1500, 0.9, 3.0], ['peak', 2400, 1.0, 1.2], ['hs', 5200, 0.7, -5.5]],
    reverb: { wet: 0.06, tail: 0.045, rt: 0.05, damp: 3000 }, comp: { thrDb: -23, ratio: 2.4 }, level: -17 },
  may: { sapiRate: -1, f0: 172, formant: 0.97, tempo: 0.95, contour: 1.0, tremor: [0.012, 5.4], hp: 90,
    eq: [['ls', 250, 0.8, 2.0], ['peak', 900, 0.9, 1.0], ['hs', 4200, 0.7, -3.5]],
    reverb: { wet: 0.07, tail: 0.06, rt: 0.07, damp: 3200 }, comp: { thrDb: -24, ratio: 2.0 }, level: -17 },
  mj: { sapiRate: 1, f0r: 1.04, formant: 1.02, tempo: 1.05, contour: 1.1, hp: 100,
    eq: [['peak', 3000, 0.9, 1.5], ['hs', 6500, 0.7, 1.5]],
    reverb: { wet: 0.04, tail: 0.04, rt: 0.04 }, comp: { thrDb: -23, ratio: 2.2 }, level: -17 },
  yuri: { sapiRate: 0, f0: 178, formant: 0.98, tempo: 1.0, contour: 0.65, hp: 130,
    eq: [['ls', 220, 0.8, -2.5], ['peak', 2800, 1.0, 2.5], ['hs', 7000, 0.7, -1.5]],
    reverb: { wet: 0.03, tail: 0.04, rt: 0.04 }, comp: { thrDb: -22, ratio: 3.0 }, level: -17 },
  fisk: { sapiRate: -2, f0: 74, formant: 0.76, tempo: 0.88, contour: 0.85, hp: 45,
    eq: [['ls', 140, 0.8, 4.5], ['peak', 800, 0.9, 1.5], ['peak', 3000, 1.0, -1.5], ['hs', 5000, 0.7, -5]],
    reverb: { wet: 0.09, tail: 0.14, rt: 0.16, damp: 2600 }, comp: { thrDb: -24, ratio: 2.4 }, level: -16 },
  rhino: { sapiRate: -1, f0: 66, formant: 0.72, tempo: 0.93, contour: 0.8, hp: 40,
    eq: [['ls', 120, 0.8, 5.0], ['peak', 700, 0.9, 2.0], ['hs', 4500, 0.7, -6]],
    growl: { hz: 29, depth: 0.32 }, drive: { amount: 3.2, mix: 0.55 }, rough: { noise: 0.04 },
    reverb: { wet: 0.05, tail: 0.06, rt: 0.07 }, comp: { thrDb: -24, ratio: 2.8 }, level: -15 },
  thug: { sapiRate: 0, f0: 100, f0spread: 13, formant: 0.81, formantSpread: 0.03, tempo: 1.03, contour: 1.0, hp: 80,
    eq: [['ls', 200, 0.8, 2.0], ['peak', 1800, 1.0, 2.0], ['hs', 5000, 0.7, -4]],
    growl: { hz: 72, depth: 0.12 }, drive: { amount: 1.8, mix: 0.3 }, rough: { noise: 0.07 },
    reverb: { wet: 0.04, tail: 0.04, rt: 0.04 }, comp: { thrDb: -23, ratio: 2.6 }, level: -16 },
  radio: { sapiRate: 1, f0: 132, formant: 0.9, tempo: 1.06, contour: 0.7, hp: 300,
    eq: [['peak', 1100, 1.0, 3.0]], radio: true, drive: { amount: 2.4, mix: 0.6 },
    comp: { thrDb: -26, ratio: 4.0 }, level: -14 },
};
// warianty glosu Petera do porownania na stronie odsluchu
const PETER_WARIANTY = {
  A: { opis: 'Zbalansowany: F0 ok. 122 Hz, formanty x0,87', over: {} },
  B: { opis: 'Glebszy i ciezszy: F0 ok. 108 Hz, formanty x0,82', over: { f0: 108, formant: 0.82, contour: 1.08 } },
  C: { opis: 'Mlodszy i jasniejszy: F0 ok. 135 Hz, formanty x0,92', over: { f0: 135, formant: 0.92, tempo: 1.08, contour: 1.18 } },
  D: { opis: 'Blisko oryginalu: F0 ok. 126 Hz, formanty x0,97 (lzejszy, "chlopiecy")', over: { f0: 126, formant: 0.97, contour: 1.15 } },
};
const MOODS = {
  normal: {},
  strained: { f0m: 1.07, contourM: 1.2, tempoM: 0.97, sapiRateD: 0, tremor: [0.01, 6.2] },
  excited: { f0m: 1.06, contourM: 1.3, tempoM: 1.05, sapiRateD: 1 },
  dry: { f0m: 0.97, contourM: 0.78, tempoM: 0.96, sapiRateD: -1 },
};
function resolvePreset(voice, mood, seedStr, over) {
  const base = PRESETS[voice] || PRESETS.peter;
  const p = JSON.parse(JSON.stringify(Object.assign({}, base, over || {}))); const m = MOODS[mood] || MOODS.normal;
  const rng = mulberry32(hashInt(seedStr || voice));
  if (p.f0spread) { p.f0 += (rng() * 2 - 1) * p.f0spread; }
  if (p.formantSpread) { p.formant += (rng() * 2 - 1) * p.formantSpread; }
  if (m.f0m) { if (p.f0) p.f0 *= m.f0m; if (p.f0r) p.f0r *= m.f0m; }
  if (m.contourM) p.contour *= m.contourM;
  if (m.tempoM) p.tempo *= m.tempoM;
  if (m.sapiRateD) p.sapiRate += m.sapiRateD;
  if (m.tremor && !p.tremor) p.tremor = m.tremor;
  p.voice = voice; p.mood = mood || 'normal';
  if (p.f0) p.f0 = Math.round(p.f0 * 10) / 10; if (p.formant) p.formant = Math.round(p.formant * 1000) / 1000;
  return p;
}

// ---------------------------------------------------------------- render: surowy SAPI -> postac
function render(raw, rate, p, seedStr) {
  const rng = mulberry32(hashInt('r:' + seedStr));
  let x = trimSilence(raw, rate, { thrDb: -40, lead: 0.02, tail: 0.08 });
  // 1) formanty: resampling (zmienia tez wysokosc i dlugosc)
  if (p.formant && Math.abs(p.formant - 1) > 1e-3) x = resample(x, p.formant);
  // 2) wysokosc, kontur i tempo: PSOLA
  const tr = f0Track(x, rate);
  const timeScale = (p.formant || 1) / (p.tempo || 1) * (p.formant && Math.abs(p.formant - 1) > 1e-3 ? 1 : 1);
  // po resamplingu dlugosc = n/formant; chcemy n/tempo => skala = formant/tempo
  const needPsola = p.f0 || p.f0r || Math.abs(timeScale - 1) > 0.01 || (p.contour != null && Math.abs(p.contour - 1) > 0.02) || p.tremor;
  if (needPsola) {
    const med = median(voicedList(tr)) || 150, ratio = p.f0 ? p.f0 / med : (p.f0r || 1);
    if (ratio < 0.64) { // gleboki glos: dwa etapy (pojedynczy PSOLA ponizej ~0,6 daje podwojone impulsy)
      const c = Math.sqrt(p.contour == null ? 1 : p.contour), mid = med * Math.sqrt(ratio);
      x = psola(x, rate, tr, { f0: mid, contour: c, timeScale, rng });
      x = psola(x, rate, f0Track(x, rate), { f0: p.f0 || med * ratio, contour: c, timeScale: 1, tremor: p.tremor, rng });
    } else x = psola(x, rate, tr, { f0: p.f0, f0r: p.f0r, contour: p.contour, timeScale, tremor: p.tremor, rng });
  }
  // 3) barwa / maska
  if (p.hp) x = filt(filt(x, bq('hp', rate, p.hp, 0.707)), bq('hp', rate, p.hp, 0.707));
  for (const [t, f, q, g] of (p.eq || [])) x = filt(x, bq(t, rate, f, q, g));
  // 4) charakter
  if (p.rough) { const env = envelope(x, rate, 2, 25), nz = filt(noise(x.length, rng), bq('hp', rate, 1800, 0.707)); for (let i = 0; i < x.length; i++) x[i] += nz[i] * env[i] * p.rough.noise * 4; }
  if (p.growl) { const ph = rng() * 6.28; for (let i = 0; i < x.length; i++) x[i] *= 1 - p.growl.depth + p.growl.depth * (0.5 + 0.5 * Math.sin(2 * Math.PI * p.growl.hz * i / rate + ph + 0.8 * Math.sin(2 * Math.PI * 3.1 * i / rate))); }
  if (p.drive) { const a = p.drive.amount, mx = p.drive.mix, nrm = Math.tanh(a); const pk = peakOf(x) || 1; for (let i = 0; i < x.length; i++) { const v = x[i] / pk; x[i] = (v * (1 - mx) + Math.tanh(v * a) / nrm * mx) * pk; } }
  if (p.reverb) x = reverb(x, rate, rng, p.reverb);
  if (p.comp) x = compress(x, rate, p.comp);
  if (p.radio) x = radioFx(x, rate, rng);
  x = trimSilence(x, rate, { thrDb: -46, lead: p.radio ? 0.0 : 0.02, tail: p.radio ? 0.02 : 0.12 });
  fades(x, rate, 6, p.radio ? 4 : 50);
  finalize(x, p.level == null ? -17 : p.level);
  return x;
}
function radioFx(x, rate, rng) {
  // pasmo 300-3000 Hz, szum zalezny od mowy, trzaski, "pssht" na poczatku i koncu
  for (let k = 0; k < 2; k++) { x = filt(x, bq('hp', rate, 320, 0.707)); x = filt(x, bq('lp', rate, 2900, 0.707)); }
  const lead = Math.round(0.11 * rate), tail = Math.round(0.14 * rate), n = lead + x.length + tail, y = new Float32Array(n);
  const peak = peakOf(x) || 1; for (let i = 0; i < x.length; i++) y[lead + i] = x[i];
  const env = envelope(y, rate, 3, 120);
  let nz = noise(n, rng); nz = filt(filt(nz, bq('hp', rate, 500, 0.707)), bq('lp', rate, 3600, 0.707));
  for (let i = 0; i < n; i++) y[i] += nz[i] * (0.012 * peak + 0.10 * env[i]);
  // squelch
  const burst = (a, len, amp) => { const nb = filt(filt(noise(len, rng), bq('hp', rate, 700, 0.707)), bq('lp', rate, 3400, 0.707)); for (let i = 0; i < len; i++) { const e = Math.sin(Math.PI * i / len); if (a + i < n) y[a + i] += nb[i] * amp * peak * e * e; } };
  burst(0, Math.round(0.07 * rate), 1.2); burst(lead + x.length + Math.round(0.02 * rate), Math.round(0.09 * rate), 1.4);
  // trzaski
  const cnt = Math.round(n / rate * 7);
  for (let k = 0; k < cnt; k++) { const a = Math.floor(rng() * (n - 200)), amp = (0.05 + rng() * 0.2) * peak * (rng() < 0.5 ? -1 : 1), L = 30 + Math.floor(rng() * 90); for (let i = 0; i < L; i++) y[a + i] += amp * Math.exp(-i / (L / 4)) * (i % 2 ? -1 : 1) * 0.8; }
  // delikatne ograniczenie pasma po szumie
  return filt(y, bq('lp', rate, 3600, 0.707));
}

// ---------------------------------------------------------------- analiza jakosci
function analyze(x, rate) {
  const tr = f0Track(x, rate), v = voicedList(tr), med = median(v);
  const st = v.map(f => 12 * Math.log2(f / (med || 1)));
  const mean = st.reduce((a, b) => a + b, 0) / Math.max(1, st.length);
  const std = Math.sqrt(st.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, st.length));
  const jit = []; for (let i = 1; i < tr.n; i++) if (tr.f0[i] > 0 && tr.f0[i - 1] > 0) jit.push(Math.abs(12 * Math.log2(tr.f0[i] / tr.f0[i - 1])));
  let hs = 0, hc = 0; for (let i = 0; i < tr.n; i++) if (tr.f0[i] > 0) { hs += tr.harm[i]; hc++; }
  // widmo Welcha
  const N = 1024, re = new Float64Array(N), im = new Float64Array(N), P = new Float64Array(N / 2); let frames = 0, mx = 0; const en = [];
  for (let s = 0; s + N <= x.length; s += N / 2) { const r = rmsOf(x, s, s + N); en.push([s, r]); if (r > mx) mx = r; }
  for (const [s, r] of en) {
    if (r < 0.1 * mx) continue; for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
    fft(re, im); for (let k = 0; k < N / 2; k++) P[k] += re[k] * re[k] + im[k] * im[k]; frames++;
  }
  let tot = 0, cen = 0, lo = 0, hi5 = 0, hi8 = 0; const bin = rate / N;
  for (let k = 1; k < N / 2; k++) { tot += P[k]; cen += P[k] * k * bin; if (k * bin < 300) lo += P[k]; if (k * bin > 5000) hi5 += P[k]; if (k * bin > 8000) hi8 += P[k]; }
  const active = []; for (const [, r] of en) if (r > 0.1 * mx) active.push(r * r);
  const rms = Math.sqrt(active.reduce((a, b) => a + b, 0) / Math.max(1, active.length));
  let clip = 0; for (let i = 0; i < x.length; i++) if (Math.abs(x[i]) > 0.98) clip++;
  return { ms: Math.round(x.length / rate * 1000), f0med: +med.toFixed(1), f0std_st: +std.toFixed(2), jitter_st: +median(jit).toFixed(2), voiced: +(v.length / Math.max(1, tr.n)).toFixed(2),
    harm: +(hs / Math.max(1, hc)).toFixed(2), peak: +peakOf(x).toFixed(3), rms_db: +(20 * Math.log10(rms + 1e-9)).toFixed(1), centroid: Math.round(cen / (tot || 1)),
    low300: +(lo / (tot || 1)).toFixed(3), hf5k: +(hi5 / (tot || 1)).toFixed(4), hf8k: +(hi8 / (tot || 1)).toFixed(5), clip };
}

module.exports = { DSP_VERSION, parseWav, wavPcm16, wavMuLaw, resample, f0Track, psola, render, analyze, resolvePreset, PRESETS, PETER_WARIANTY, MOODS, mulberry32, hashInt, bq, filt, trimSilence, median, peakOf };

// Uzycie z linii polecen: node dsp.js wejscie.wav wyjscie.wav [preset] [mood]
if (require.main === module) {
  const fs = require('fs'); const [, , inp, out, voice = 'peter', mood = 'normal'] = process.argv;
  if (!inp || !out) { console.log('uzycie: node dsp.js wejscie.wav wyjscie.wav [preset] [mood]'); process.exit(1); }
  const w = parseWav(fs.readFileSync(inp)); const p = resolvePreset(voice, mood, inp);
  const y = render(w.data, w.rate, p, inp); fs.writeFileSync(out, wavPcm16(y, w.rate));
  console.log(JSON.stringify({ zrodlo: analyze(w.data, w.rate), wynik: analyze(y, w.rate) }, null, 1));
}
