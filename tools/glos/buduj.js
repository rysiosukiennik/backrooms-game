'use strict';
// Potok nagran: katalogi linii -> SAPI (synteza.ps1) -> DSP (dsp.js) -> paczki base64 w spiderman/glos/.
// Uzycie: node buduj.js [--peter=A|B|C|D] [--format=pcm22|pcm16|mulaw16|mulaw12] [--force] [--no-probki] [--only-probki] [--limit=N]
// Cache (tools/glos/cache) po hashu tekstu+presetu: przebudowywane sa tylko zmienione linie.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), cp = require('child_process');
const D = require('./dsp.js');

const ROOT = path.resolve(__dirname, '..', '..');
const JS = path.join(ROOT, 'spiderman', 'js'), OUT = path.join(ROOT, 'spiderman', 'glos');
const CACHE = path.join(__dirname, 'cache'), RAW = path.join(CACHE, 'raw'), PROC = path.join(CACHE, 'proc');
const args = process.argv.slice(2), flag = n => args.includes('--' + n), opt = n => { const a = args.find(s => s.startsWith('--' + n + '=')); return a ? a.split('=')[1] : null; };
const RATE = 22050, PACK_MAX = 1.9e6, TOTAL_MAX = 24.5e6;
const FORMATS = { pcm22: { rate: 22050, bps: 44100, ulaw: false }, pcm16: { rate: 16000, bps: 32000, ulaw: false }, mulaw16: { rate: 16000, bps: 16000, ulaw: true }, mulaw12: { rate: 12000, bps: 12000, ulaw: true } };
for (const d of [RAW, PROC, OUT]) fs.mkdirSync(d, { recursive: true });

const sha = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 14);
function sapiText(t) { return t.replace(/[—–]/g, ', ').replace(/…/g, '...').replace(/\s+/g, ' ').trim(); }

async function loadCat(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  return m.LINIE;
}
async function gather() {
  let lines = [];
  for (const f of ['docinki_teksty.js', 'docinki_dialogi.js', 'rozmowy_teksty.js']) {
    const p = path.join(JS, f); if (fs.existsSync(p)) lines = lines.concat(await loadCat(p));
  }
  if (!lines.length) { // awaryjnie: kwestie Q z docinki.js
    const s = fs.readFileSync(path.join(JS, 'docinki.js'), 'utf8').replace(/\r/g, ''), a = s.indexOf('const Q = '), b = s.indexOf('\n};', a);
    const Q = new Function('return ' + s.slice(a + 10, b + 2))();
    for (const k in Q) Q[k].l.forEach((t, i) => lines.push({ id: k + '_' + String(i + 1).padStart(2, '0'), kind: k, text: t, voice: 'peter', mood: 'normal' }));
  }
  const seen = new Set(), res = [];
  for (const l of lines) {
    if (!l.id || !l.text) continue; if (seen.has(l.id)) { console.warn('powtorzone id', l.id); continue; } seen.add(l.id);
    res.push({ id: l.id, text: l.text, voice: l.voice || 'peter', mood: l.mood || 'normal' });
  }
  return res;
}

function presetFor(voice, mood, id, peterOver) {
  if (!D.PRESETS[voice]) { console.warn('nieznany glos', voice, '-> peter'); voice = 'peter'; }
  return D.resolvePreset(voice, mood, id, voice === 'peter' ? peterOver : null);
}

function synth(jobs) {
  if (!jobs.length) return;
  const jf = path.join(CACHE, 'jobs.json'); fs.writeFileSync(jf, JSON.stringify(jobs), 'utf8');
  console.log('SAPI: synteza', jobs.length, 'linii...');
  const r = cp.spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'synteza.ps1'), '-Jobs', jf, '-OutDir', RAW], { encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) { console.error(r.stdout, r.stderr); throw new Error('synteza.ps1 zawiodla'); }
  const tail = r.stdout.trim().split('\n').pop(); console.log(tail);
}

// przygotuj nagranie: zwraca {x, stats}; cache w PROC
function ensure(items, peterOver, tag) {
  const need = [];
  for (const it of items) {
    it.p = presetFor(it.voice, it.mood, it.id, peterOver);
    it.rawKey = sha(sapiText(it.text) + '|' + it.p.sapiRate); it.rawFile = path.join(RAW, it.rawKey + '.wav');
    it.key = sha(it.rawKey + JSON.stringify(it.p) + '|v' + D.DSP_VERSION + (tag || '')); it.procFile = path.join(PROC, it.key + '.wav'); it.statFile = path.join(PROC, it.key + '.json');
    if ((flag('force') || !fs.existsSync(it.procFile)) && !fs.existsSync(it.rawFile) && !need.find(j => j.out === it.rawKey + '.wav'))
      need.push({ out: it.rawKey + '.wav', text: sapiText(it.text), rate: it.p.sapiRate, volume: 100 });
  }
  for (let i = 0; i < need.length; i += 150) synth(need.slice(i, i + 150));
  let done = 0;
  for (const it of items) {
    if (!flag('force') && fs.existsSync(it.procFile) && fs.existsSync(it.statFile)) { it.stats = JSON.parse(fs.readFileSync(it.statFile, 'utf8')); continue; }
    const w = D.parseWav(fs.readFileSync(it.rawFile));
    const y = D.render(w.data, w.rate, it.p, it.id + '|' + it.key);
    it.stats = D.analyze(y, w.rate); it.stats.f0src = D.analyze(w.data, w.rate).f0med; it.stats.target = it.p.f0 || null;
    fs.writeFileSync(it.procFile, D.wavPcm16(y, w.rate)); fs.writeFileSync(it.statFile, JSON.stringify(it.stats));
    if (++done % 50 === 0) console.log('DSP:', done);
  }
  if (done) console.log('DSP: przetworzono', done);
}
const loadProc = it => D.parseWav(fs.readFileSync(it.procFile));

function encode(x, fmt) {
  const y = fmt.rate === RATE ? x : D.resample(x, RATE / fmt.rate);
  return fmt.ulaw ? D.wavMuLaw(y, fmt.rate) : D.wavPcm16(y, fmt.rate);
}

function main(lines, peterOver) {
  ensure(lines, peterOver);
  const totalS = lines.reduce((a, l) => a + l.stats.ms, 0) / 1000;
  let fname = opt('format');
  if (!fname) { fname = Object.keys(FORMATS).find(k => totalS * FORMATS[k].bps * 4 / 3 * 1.02 <= TOTAL_MAX) || 'mulaw12'; }
  const fmt = FORMATS[fname];
  console.log('Lacznie', lines.length, 'linii,', totalS.toFixed(0), 's; format', fname);
  for (const f of fs.readdirSync(OUT)) if (/^p\d+\.js$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const man = {}; let packs = [], cur = null, total = 0;
  const flush = () => { if (!cur) return; const fn = cur.name + '.js'; const body = 'window.GLOS_PACKS = window.GLOS_PACKS || {};\nwindow.GLOS_PACKS.' + cur.name + ' = {\n' + cur.rows.join(',\n') + '\n};\n'; fs.writeFileSync(path.join(OUT, fn), body); packs.push({ name: cur.name, bytes: body.length, n: cur.rows.length }); total += body.length; cur = null; };
  for (const l of lines) {
    const w = loadProc(l), wav = encode(w.data, fmt), b64 = wav.toString('base64'), row = '"' + l.id + '":"data:audio/wav;base64,' + b64 + '"';
    if (cur && cur.size + row.length > PACK_MAX) flush();
    if (!cur) cur = { name: 'p' + String(packs.length + 1).padStart(2, '0'), rows: [], size: 0 };
    cur.rows.push(row); cur.size += row.length + 2; man[l.id] = { pack: cur.name, ms: l.stats.ms, voice: l.voice };
  }
  flush();
  const mt = 'window.GLOS_MANIFEST = {\n' + Object.keys(man).map(k => JSON.stringify(k) + ': ' + JSON.stringify(man[k])).join(',\n') + '\n};\n';
  fs.writeFileSync(path.join(OUT, 'manifest.js'), mt);
  // raport
  const per = {};
  for (const l of lines) { const e = per[l.voice] || (per[l.voice] = { linie: 0, s: 0, f0: [], std: [], jit: [], peak: 0, rms: [], centroid: [], hf5k: [], harm: [] }); e.linie++; e.s += l.stats.ms / 1000; if (l.stats.f0med) { e.f0.push(l.stats.f0med); e.std.push(l.stats.f0std_st); e.jit.push(l.stats.jitter_st); } e.peak = Math.max(e.peak, l.stats.peak); e.rms.push(l.stats.rms_db); e.centroid.push(l.stats.centroid); e.hf5k.push(l.stats.hf5k); e.harm.push(l.stats.harm); }
  const avg = a => a.length ? +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(2) : null;
  const rep = { format: fname, linii: lines.length, sekundy: +totalS.toFixed(1), paczki: packs, bajty_total: total + mt.length, presety: {} };
  for (const v in per) { const e = per[v]; rep.presety[v] = { linie: e.linie, sekundy: +e.s.toFixed(1), F0_srednie_Hz: avg(e.f0), F0_std_polton: avg(e.std), skok_F0_polton_10ms: avg(e.jit), peak_max: e.peak, rms_db: avg(e.rms), centroid_Hz: avg(e.centroid), udzial_energii_ponad_5k: avg(e.hf5k), harmonicznosc: avg(e.harm) }; }
  fs.writeFileSync(path.join(__dirname, 'raport.json'), JSON.stringify(rep, null, 1));
  console.log(JSON.stringify(rep, null, 1));
  if (rep.bajty_total > 26e6) console.warn('UWAGA: przekroczony budzet ~25 MB');
  if (Object.values(rep.presety).some(p => p.peak_max >= 0.95)) console.warn('UWAGA: peak >= 0,95');
}

// ------------------------------------------------ probki do odsluchu
function probki() {
  const LIN = [
    ['Zostaw to, wyglądasz na zmęczonego.', 'normal'], ['I po zawodach!', 'excited'], ['Uwielbiam to bujanie!', 'excited'],
    ['Ej! Mam kruchy kręgosłup... teoretycznie.', 'strained'], ['Złota godzina nad Nowym Jorkiem. Można się zakochać.', 'dry'],
    ['Dasz radę wstać? Bo zaraz powtórka.', 'normal'], ['Dzięki, że się zatrzymałeś! Zazwyczaj tylko mnie trąbią.', 'dry'],
    ['Panie Fisk, ładna wieża. Szkoda byłoby jej nie zburzyć.', 'normal'],
  ];
  const POST = [['may', 'Peter, kochanie, kolacja stygnie. Wróć do domu.'], ['mj', 'Tygrysie, znowu się spóźniasz.'], ['yuri', 'Wszystkie jednostki, podejrzany w rejonie Piątej Alei.'],
    ['fisk', 'Nowy Jork należy do mnie, a ty jesteś tylko pyłem na moim bucie.'], ['rhino', 'Zmiażdżę cię, pająku!'], ['thug', 'Hej, pająku! Oddaj mi to miasto!'], ['radio', 'Centrala do wszystkich jednostek, napad na bank przy Broadwayu.']];
  const V = D.PETER_WARIANTY, items = [];
  const mk = (id, voice, mood, text, over, tag) => { const it = { id, voice, mood, text, over, tag }; items.push(it); return it; };
  const rows = LIN.map(([t, m], i) => ({ t, m, orig: mk('o' + i, 'orig', m, t), vars: Object.keys(V).map(k => [k, mk('v' + k + i, 'peter', m, t, V[k].over, '|' + k)]) }));
  const post = POST.map(([v, t], i) => ({ v, t, it: mk('c' + i, v, 'normal', t) }));
  // oryginal = Paulina bez zmian (tylko normalizacja)
  for (const it of items) { if (it.voice === 'orig') { it.p = { sapiRate: 0 }; it.tmp = true; } }
  const real = items.filter(i => i.voice !== 'orig');
  for (const it of real) { const base = D.PRESETS[it.voice] || D.PRESETS.peter; it.p = D.resolvePreset(it.voice, it.mood, it.id, it.over); }
  // wlasny przebieg przez ensure (kazdy ma unikatowy key przez przeslonienia)
  const ensureItems = real.map(it => { it.voiceOrig = it.voice; return it; });
  ensureWithOver(ensureItems);
  for (const it of items.filter(i => i.voice === 'orig')) {
    const rk = sha(sapiText(it.text) + '|0'), rf = path.join(RAW, rk + '.wav'); if (!fs.existsSync(rf)) synth([{ out: rk + '.wav', text: sapiText(it.text), rate: 0, volume: 100 }]);
    const w = D.parseWav(fs.readFileSync(rf)); let y = D.trimSilence(w.data, w.rate, { thrDb: -40, lead: 0.02, tail: 0.08 });
    const pk = D.peakOf(y) || 1; for (let i = 0; i < y.length; i++) y[i] *= 0.8 / pk; it.stats = D.analyze(y, w.rate); it.wavBuf = D.wavPcm16(y, w.rate);
  }
  const clip = it => ({ wav: 'data:audio/wav;base64,' + (it.wavBuf || fs.readFileSync(it.procFile)).toString('base64'), ms: it.stats.ms, f0: it.stats.f0med });
  const data = { wygenerowano: new Date().toISOString().slice(0, 10), warianty: Object.keys(V).map(k => ({ id: k, opis: V[k].opis })),
    linie: rows.map(r => ({ tekst: r.t, mood: r.m, orig: clip(r.orig), warianty: r.vars.map(([k, it]) => Object.assign({ id: k }, clip(it))) })),
    postacie: post.map(p => Object.assign({ voice: p.v, tekst: p.t }, clip(p.it))) };
  fs.writeFileSync(path.join(OUT, 'probki.js'), 'window.GLOS_PROBKI = ' + JSON.stringify(data) + ';\n');
  console.log('probki.js:', (fs.statSync(path.join(OUT, 'probki.js')).size / 1e6).toFixed(1), 'MB');
}
// jak ensure, ale z presetem juz rozwiazanym w it.p (z przeslonieniami)
function ensureWithOver(items) {
  const need = [];
  for (const it of items) {
    it.rawKey = sha(sapiText(it.text) + '|' + it.p.sapiRate); it.rawFile = path.join(RAW, it.rawKey + '.wav');
    it.key = sha(it.rawKey + JSON.stringify(it.p) + '|v' + D.DSP_VERSION); it.procFile = path.join(PROC, it.key + '.wav'); it.statFile = path.join(PROC, it.key + '.json');
    if (!fs.existsSync(it.procFile) && !fs.existsSync(it.rawFile) && !need.find(j => j.out === it.rawKey + '.wav')) need.push({ out: it.rawKey + '.wav', text: sapiText(it.text), rate: it.p.sapiRate, volume: 100 });
  }
  synth(need);
  for (const it of items) {
    if (fs.existsSync(it.procFile) && fs.existsSync(it.statFile)) { it.stats = JSON.parse(fs.readFileSync(it.statFile, 'utf8')); continue; }
    const w = D.parseWav(fs.readFileSync(it.rawFile)); const y = D.render(w.data, w.rate, it.p, it.id + '|' + it.key);
    it.stats = D.analyze(y, w.rate); fs.writeFileSync(it.procFile, D.wavPcm16(y, w.rate)); fs.writeFileSync(it.statFile, JSON.stringify(it.stats));
  }
}

(async () => {
  const pv = opt('peter'); const peterOver = pv && D.PETER_WARIANTY[pv] ? D.PETER_WARIANTY[pv].over : null;
  if (!flag('only-probki')) {
    let lines = await gather(); const lim = opt('limit'); if (lim) lines = lines.slice(0, +lim);
    main(lines, peterOver);
  }
  if (!flag('no-probki')) probki();
})().catch(e => { console.error(e); process.exit(1); });
