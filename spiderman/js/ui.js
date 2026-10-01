// Interfejs: menu glowne, HUD, minimapa, pauza z zakladkami (mapa, umiejetnosci, misje, stroje, ruchy, gra).
import { $, clamp, save, doSave, cv, V3, linearize } from './util.js';
import { G, P, cam, camera, canvas, crimes, enemies, hooks } from './stan.js';
import { LAND, PK, POND, DIST, districtAt, footprints, TOD_NAMES, ARENA, sunDir, raycastCity } from './miasto.js';
import { SUITS, suitThumb, buildSpider, newPose, applyPose } from './postac.js';
import { setSuit } from './gracz.js';
import { need, bags, BAGS_N, webTarget } from './wrogowie.js';
import { missionList, fmtTime } from './misje.js';
import { ROOMS } from './wnetrza.js';
import { SKILLS, COLS, has, canBuy, buy, skillPoints, maxHp } from './umiejetnosci.js';
import { pad, navInput, lockMouse, KP, K, mouse, stick, pp } from './wejscie.js';
import { sfx, audioOK } from './dzwiek.js';

const CSS = `
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

const HTML = `
<div id="hud" class="hidden">
  <div id="hpWrap"><div id="hpBar"><div id="hpFill"></div></div><div id="focus"><div><i></i></div><div><i></i></div><div><i></i></div></div><div id="hpLbl">ZDROWIE · SKUPIENIE</div></div>
  <div id="combo"></div>
  <div id="lvlBox"><div class="lvN"><small>POZIOM</small><b id="lvlNum">1</b></div><div class="lvX"><div id="xpTxt"></div><div id="xpBar"><div id="xpFill"></div></div></div></div>
  <div id="skp"></div>
  <div id="bossBar" class="hidden"><b>NOSOROŻEC</b><div class="bb"><i></i></div><small></small></div>
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
  <div id="lockHint" class="hidden">Kliknij, aby sterować myszą</div>
</div>
<div id="menu">
  <div id="logo"><div class="t1">SPIDER<span>-</span>MAN</div><div class="t2">NOWY JORK</div></div>
  <div id="menuList"></div>
  <div id="menuFoot"></div>
</div>
<div id="pause" class="hidden">
  <div id="tabs"></div>
  <div class="page" id="pg-map"><canvas id="mapc"></canvas><div id="mapDist"></div><div id="mapProg"></div>
    <div id="mapLeg"><div><i style="background:#fff"></i>Spider-Man</div><div><i style="background:#e3242b"></i>Przestępstwo</div><div><i style="background:#8a1be0"></i>Nosorożec</div><div><i style="background:#fff"></i>Kingpin</div><div><i style="background:#ffc93c"></i>Wyzwanie</div><div><i style="background:#ff8a1e"></i>Pościg</div><div><i style="background:#f5d76e;border-radius:50%"></i>Plecak</div><div><i style="background:#3fe3ff"></i>Twój znacznik</div></div></div>
  <div class="page" id="pg-skills"><div id="skPanel"></div><div id="skBottom"><div id="skName"></div><div id="skInfo"></div></div></div>
  <div class="page" id="pg-miss"><div id="miList"></div><div id="miRight"><div id="miName"></div><div id="miInfo"></div></div></div>
  <div class="page" id="pg-suits"><div id="suitPanel"><div class="sh"><span>STRÓJ</span><span id="suitPct"></span></div><div id="suitGrid"></div></div>
    <div id="suitRight"><canvas id="suitView"></canvas><div id="suitName"></div><div id="suitInfo"></div></div></div>
  <div class="page" id="pg-moves"><table id="movesT"></table></div>
  <div class="page" id="pg-game"><div id="gameList"></div><div id="gameStats"></div></div>
  <div id="pauseFoot"></div>
</div>
<div id="vig"></div><div id="flare"></div>
<div id="tytul"><img src="tytul.jpg" alt="" onerror="this.style.display='none'"><div class="tt"><b>SPIDER<i>-</i>MAN</b><span>NOWY JORK</span></div><div class="tp">NACIŚNIJ DOWOLNY PRZYCISK</div></div>
<div id="fade"></div>`;

// ---------------------------------------------------------------- przyciski
const GLY = {
  xbox: { jump: 'A', dodge: 'B', punch: 'X', web: 'RB', swing: 'RT', special: 'Y', map: 'VIEW', pause: 'MENU', ok: 'A', back: 'B', y: 'Y', lb: 'LB', rb: 'RB', lt: 'LT', rt: 'RT' },
  ps: { jump: '✕', dodge: '○', punch: '□', web: 'R1', swing: 'R2', special: '△', map: 'SHARE', pause: 'OPTIONS', ok: '✕', back: '○', y: '△', lb: 'L1', rb: 'R1', lt: 'L2', rt: 'R2' },
  kb: { jump: 'SPACJA', dodge: 'C', punch: 'LPM', web: 'PPM', swing: 'SHIFT', special: 'E', map: 'M', pause: 'ESC', ok: 'ENTER', back: 'ESC', y: 'X', lb: 'Q', rb: 'E', lt: '−', rt: '+' },
};
const kk = t => `<span class="key">${t}</span>`;
export function key(a, dev) {
  const g = (dev || G.lastDev) === 'pad' ? GLY[pad.type] : (dev && dev !== 'kb' ? GLY[dev] : GLY.kb);
  return kk(g[a]);
}

// ---------------------------------------------------------------- komunikaty
let msgT = 0, dmgT = 0, distT = 0, distChk = 0, promptT = 0, lastPrompt = '', lastDist = '', popT = 0, hintT = 0;
export function showMsg(t, s, dur = 2.5) {
  $('msgT').textContent = t; $('msgS').innerHTML = s || '';
  $('msg').style.opacity = 1; msgT = dur;
}
export function flashDamage() { dmgT = 0.25; }
export function popText(t) { const p = $('pop'); p.textContent = t; p.style.opacity = 1; p.style.transform = 'translate(-50%,-50%) scale(1.1)'; popT = 0.9; }
const hintsShown = new Set();
export function hint(id, text) { if (hintsShown.has(id)) return; hintsShown.add(id); $('hint').innerHTML = text; $('hint').style.opacity = 1; hintT = 6; }

// ---------------------------------------------------------------- rysowanie mapy
function drawCity(x, hl) {
  x.fillStyle = '#3d0e16'; x.fillRect(-6000, -6000, 12000, 12000);
  x.fillStyle = '#1a1d22';
  const W0 = LAND.x0 - 270, E0 = LAND.x1 + 230, N0 = LAND.z0 - 90;
  x.fillRect(-6000, -6000, W0 + 6000, 12000); x.fillRect(E0, -6000, 6000, 12000); x.fillRect(W0, -6000, E0 - W0, N0 + 6000);
  x.fillStyle = '#0f171d'; x.fillRect(LAND.x0, LAND.z0, LAND.x1 - LAND.x0, LAND.z1 - LAND.z0);
  x.fillStyle = '#123222'; x.fillRect(PK.x0, PK.z0, PK.x1 - PK.x0, PK.z1 - PK.z0);
  x.fillStyle = '#3d0e16'; x.beginPath(); x.ellipse(POND.x, POND.z, POND.rx, POND.rz, 0, 0, 7); x.fill();
  for (const f of footprints) {
    const k = Math.min(f.h, 220) / 220;
    x.fillStyle = hl && f.dk === hl ? `hsl(193,85%,${46 + k * 30}%)` : `hsl(205,12%,${24 + k * 40}%)`;
    x.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
  }
}
function icoDiamond(x, sx, sy, s, col, txt) {
  x.save(); x.translate(sx, sy); x.rotate(Math.PI / 4); x.fillStyle = col; x.strokeStyle = '#fff'; x.lineWidth = 2;
  x.fillRect(-s / 2, -s / 2, s, s); x.strokeRect(-s / 2, -s / 2, s, s); x.restore();
  if (txt) { x.fillStyle = '#fff'; x.font = `bold ${s * 0.85}px Rajdhani`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, sx, sy + 1); }
}
const icoCrime = (x, a, b, s) => icoDiamond(x, a, b, s, '#e3242b', '!');
function icoBag(x, sx, sy, s) { x.fillStyle = '#f5d76e'; x.strokeStyle = '#3a2a00'; x.lineWidth = 1.5; x.beginPath(); x.arc(sx, sy, s / 2, 0, 7); x.fill(); x.stroke(); }
const icoWP = (x, a, b, s) => icoDiamond(x, a, b, s, '#3fe3ff');
function icoPlayer(x, sx, sy, rot, s) {
  x.save(); x.translate(sx, sy); x.rotate(rot); x.fillStyle = '#fff'; x.strokeStyle = '#0a2230'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.72, s * 0.8); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.72, s * 0.8); x.closePath(); x.fill(); x.stroke(); x.restore();
}
function missionIcons(x, S, s) {
  for (const m of missionList()) {
    if (m.x == null) continue;
    const [a, b] = S(m.x, m.z);
    if (m.icon === 'boss') icoDiamond(x, a, b, s * 1.2, '#8a1be0', '☠');
    else if (m.icon === 'race') icoDiamond(x, a, b, s, '#ffc93c', '⚑');
    else if (m.icon === 'fisk') icoDiamond(x, a, b, s * 1.15, '#ffffff', '♛');
    else icoDiamond(x, a, b, s, '#ff8a1e', '▶');
  }
}
export const progress = () => Math.round(save.bags.length / BAGS_N * 35 + Math.min(save.crimes, 30) / 30 * 35 + Math.min(save.bossWins, 1) * 10 + Object.keys(save.races).length / 3 * 10 + Math.min(save.chases, 5) / 5 * 10);

let miniBase = null; const MM = { x0: LAND.x0 - 320, z0: LAND.z0 - 320 };
function buildMiniBase() {
  const c = cv(LAND.x1 - LAND.x0 + 640, LAND.z1 - LAND.z0 + 640), x = c.getContext('2d');
  x.translate(-MM.x0, -MM.z0); drawCity(x, null); miniBase = c;
}
function drawMini() {
  const c = $('mini'), x = c.getContext('2d'), R = c.width / 2, Z = 0.75;
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
  if (G.interior) { x.fillStyle = 'rgba(8,16,24,.92)'; x.beginPath(); x.arc(R, R, R, 0, 7); x.fill(); x.fillStyle = '#3fe3ff'; x.font = 'bold 22px Rajdhani'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('WNĘTRZE', R, R - 8); icoPlayer(x, R, R + 22, cam.yaw + Math.PI - P.heading, 9); return; }
  x.save(); x.beginPath(); x.arc(R, R, R, 0, 7); x.clip();
  x.translate(R, R); x.rotate(cam.yaw); x.scale(Z, Z); x.translate(-P.pos.x, -P.pos.z);
  x.drawImage(miniBase, MM.x0, MM.z0);
  x.fillStyle = '#ff3b3b';
  for (const e of enemies) if (!e.dead && !e.gone) { x.beginPath(); x.arc(e.pos.x, e.pos.z, (e.type === 'boss' ? 7 : 3.5) / Z, 0, 7); x.fill(); }
  for (const b of bags) if (!b.got && Math.abs(b.g.position.x - P.pos.x) < 200 && Math.abs(b.g.position.z - P.pos.z) < 200) icoBag(x, b.g.position.x, b.g.position.z, 9 / Z);
  x.restore();
  const cs = Math.cos(cam.yaw), sn = Math.sin(cam.yaw);
  const toMini = (wx, wz) => {
    let dx = (wx - P.pos.x) * Z, dz = (wz - P.pos.z) * Z;
    let rx = dx * cs - dz * sn, ry = dx * sn + dz * cs; const d = Math.hypot(rx, ry);
    if (d > R - 12) { rx *= (R - 12) / d; ry *= (R - 12) / d; }
    return [R + rx, R + ry];
  };
  for (const cr of crimes) if (cr.active) { const [a, b] = toMini(cr.x, cr.z); icoCrime(x, a, b, 13); }
  missionIcons(x, toMini, 13);
  if (G.wp) { const [a, b] = toMini(G.wp.x, G.wp.z); icoWP(x, a, b, 12); }
  icoPlayer(x, R, R, cam.yaw + Math.PI - P.heading, 10);
  const [nx, ny] = toMini(P.pos.x, P.pos.z - 5000);
  x.fillStyle = '#3fe3ff'; x.font = 'bold 15px Rajdhani'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('N', nx, ny);
}

// linie predkosci
const LN = Array.from({ length: 40 }, () => ({ a: Math.random() * 6.283, r: Math.random(), l: 0.1 + Math.random() * 0.2 }));
function drawLines(k, dt) {
  const c = $('lines');
  if (k <= 0.01) { c.style.opacity = 0; return; }
  if (c.width !== innerWidth >> 1) { c.width = innerWidth >> 1; c.height = innerHeight >> 1; }
  const x = c.getContext('2d'), W = c.width, H = c.height, R = Math.hypot(W, H) / 2;
  x.clearRect(0, 0, W, H); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 1.5;
  for (const L of LN) {
    L.r += dt * (1.5 + k * 3); if (L.r > 1) { L.r = 0.35 + Math.random() * 0.2; L.a = Math.random() * 6.283; }
    const r0 = R * L.r, r1 = r0 + R * L.l;
    x.beginPath(); x.moveTo(W / 2 + Math.cos(L.a) * r0, H / 2 + Math.sin(L.a) * r0); x.lineTo(W / 2 + Math.cos(L.a) * r1, H / 2 + Math.sin(L.a) * r1); x.stroke();
  }
  c.style.opacity = k;
}

// ---------------------------------------------------------------- HUD
const _p = new V3();
function placeMarker(elm, x, y, z, txt) {
  _p.set(x, y, z).project(camera);
  let sx = _p.x, sy = _p.y; const behind = _p.z > 1;
  if (behind) { sx = -sx; sy = -sy; }
  const m = 0.88;
  if (behind || Math.abs(sx) > m || Math.abs(sy) > m) { const s = m / Math.max(Math.abs(sx), Math.abs(sy), 1e-3); sx *= s; sy *= s; }
  elm.style.transform = `translate(${(sx * 0.5 + 0.5) * innerWidth}px,${(-sy * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%)`;
  elm.querySelector('.l').textContent = txt; elm.style.display = 'block';
}
function toScreen(x, y, z) { _p.set(x, y, z).project(camera); return _p.z < 1 ? [(_p.x * 0.5 + 0.5) * innerWidth, (-_p.y * 0.5 + 0.5) * innerHeight] : null; }
const set = (id, prop, v) => { const e = $(id); if (e.style[prop] !== v) e.style[prop] = v; };

export function updateHUD(dt) {
  set('hpFill', 'width', (P.hp / maxHp() * 100) + '%');
  const fs = $('focus').querySelectorAll('i'); fs.forEach((f, i) => { f.style.width = clamp(P.focus - i, 0, 1) * 100 + '%'; });
  $('lvlNum').textContent = save.lvl;
  $('xpTxt').textContent = `${Math.floor(save.xp)} / ${need(save.lvl)} PD`;
  $('xpFill').style.width = (save.xp / need(save.lvl) * 100) + '%';
  const sp = skillPoints(); $('skp').textContent = sp ? `★ ${sp} punkt${sp === 1 ? '' : sp < 5 ? 'y' : 'ów'} umiejętności` : '';
  const cb = $('combo'); if (P.combo >= 2) { cb.textContent = 'x' + P.combo + ' KOMBO'; cb.style.opacity = 1; } else cb.style.opacity = 0;
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) $('msg').style.opacity = 0; }
  if (popT > 0) { popT -= dt; if (popT <= 0.5) { $('pop').style.opacity = 0; $('pop').style.transform = 'translate(-50%,-50%) scale(1)'; } }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').style.opacity = 0; }
  dmgT -= dt; $('dmg').style.opacity = dmgT > 0 ? 1 : P.hp < maxHp() * 0.3 ? 0.55 : 0;
  $('fade').style.opacity = P.dead && P.deadT < 1.3 ? 1 : 0;
  const speed = P.vel.length();
  $('speedfx').style.opacity = clamp((speed - 25) / 35, 0, 0.85);
  drawLines(clamp((speed - 30) / 30, 0, 0.8), dt);
  // podpowiedz, gdy okno gry nie odbiera klawiszy (kliknieto gdzie indziej) albo mysz nie jest przechwycona
  const noFocus = !document.hasFocus(), noLock = G.mode === 'kb' && document.pointerLockElement !== canvas;
  const lh = $('lockHint'); lh.classList.toggle('hidden', !(noFocus || noLock));
  const lt = noFocus ? 'Kliknij w grę, żeby sterować' : 'Kliknij, aby sterować myszą'; if (lh.textContent !== lt) lh.textContent = lt;

  // boss / wyscig
  const bb = $('bossBar');
  if (G.boss) {
    bb.classList.remove('hidden'); bb.querySelector('b').textContent = G.boss.name || 'NOSOROŻEC'; bb.querySelector('i').style.width = (G.boss.hp / G.boss.max * 100) + '%';
    bb.querySelector('small').textContent = G.boss.st === 'tired' || G.boss.st === 'stun' ? 'BEZBRONNY — BIJ!' : G.boss.st === 'chargeW' ? 'SZARŻA — UNIK!' : '';
  } else bb.classList.add('hidden');
  const rp = $('racePan');
  if (G.race) { rp.classList.remove('hidden'); rp.querySelector('b').textContent = fmtTime(G.race.t); rp.querySelector('small').textContent = `${G.race.name} · PIERŚCIEŃ ${G.race.idx} / ${G.race.n} · ZŁOTO ${fmtTime(G.race.par)}`; }
  else rp.classList.add('hidden');

  distChk -= dt;
  if (distChk <= 0) {
    distChk = 0.4; const d = G.interior ? lastDist : districtAt(P.pos.x, P.pos.z);
    if (d !== lastDist) { lastDist = d; $('distName').textContent = DIST[d].name; $('district').style.opacity = 1; distT = 3; }
  }
  if (distT > 0) { distT -= dt; if (distT <= 0) $('district').style.opacity = 0; }

  promptT -= dt;
  if (promptT <= 0) {
    promptT = 0.2;
    const arr = [];
    const near = enemies.some(e => !e.dead && e.pos.distanceTo(P.pos) < 14);
    if (P.doorNear) arr.push(['special', `<b style="color:#ffc93c">Wejdź: ${P.doorNear.name}</b>`]);
    else if (P.exitNear) arr.push(['special', '<b style="color:#39ff6a">Wyjdź</b>']);
    if (P.finReady) arr.push(['special', '<b style="color:#3fe3ff">WYKOŃCZENIE</b>']);
    if (P.state === 'car') arr.push(['punch', 'Bij w dach'], ['jump', 'Zeskocz']);
    else if (P.state === 'ground') { if (P.perchT > 0) arr.push(['jump', '<b style="color:#3fe3ff">WYBICIE</b>']); arr.push(['swing', 'Parkour (przytrzymaj)'], ['jump', 'Skok']); }
    else if (P.state === 'air') { arr.push(['swing', 'Bujanie (przytrzymaj)']); if (P.zips > 0) arr.push(['jump', 'Zip siecią']); if (!near) arr.push(['punch', 'Trik']); }
    else if (P.state === 'swing') arr.push(['jump', 'Skok z sieci']);
    else if (P.state === 'wall') arr.push(['jump', 'Odbicie od ściany'], ['swing', 'Bieg po ścianie']);
    else if (P.state === 'pz') arr.push(['jump', 'Wybicie z zaczepu']);
    if (near && P.state !== 'car') arr.push(['punch', 'Cios (przytrzymaj = wybicie)'], ['web', 'Strzał siecią'], ['dodge', 'Unik']);
    arr.push(['map', 'Mapa']);
    const h = arr.map(([a, t]) => `<div>${t}${key(a)}</div>`).join('');
    if (h !== lastPrompt) { lastPrompt = h; $('prompts').innerHTML = h; }
  }

  // znaczniki: przestepstwo, poscig, boss, wlasny
  let best = null, bd = 1e9;
  for (const cr of crimes) if (cr.active) { const d = Math.hypot(cr.x - P.pos.x, cr.z - P.pos.z); if (d < bd) { bd = d; best = cr; } }
  if (best && bd > 25 && !G.race && !G.interior) placeMarker($('crimeMk'), best.x, best.y + 4, best.z, 'PRZESTĘPSTWO ' + Math.round(bd) + ' m'); else $('crimeMk').style.display = 'none';
  if (G.chase && P.state !== 'car') placeMarker($('chaseMk'), G.chase.pos.x, 3, G.chase.pos.z, `POŚCIG ${Math.round(Math.hypot(G.chase.pos.x - P.pos.x, G.chase.pos.z - P.pos.z))} m · ${Math.max(0, 80 - G.chase.t | 0)} s`);
  else $('chaseMk').style.display = 'none';
  if (G.boss) { const d = Math.hypot(G.boss.pos.x - P.pos.x, G.boss.pos.z - P.pos.z); if (d > 20) placeMarker($('bossMk'), G.boss.pos.x, 6, G.boss.pos.z, (G.boss.name || 'NOSOROŻEC') + ' ' + Math.round(d) + ' m'); else $('bossMk').style.display = 'none'; }
  else $('bossMk').style.display = 'none';
  if (G.wp) {
    const d = Math.hypot(G.wp.x - P.pos.x, G.wp.z - P.pos.z);
    if (d < 20) { G.wp = null; $('wpMk').style.display = 'none'; sfx('ui'); }
    else placeMarker($('wpMk'), G.wp.x, P.pos.y + 3, G.wp.z, Math.round(d) + ' m');
  } else $('wpMk').style.display = 'none';

  const pe = $('perch'), pp2 = P.perchPt && toScreen(P.perchPt.x, P.perchPt.y + 0.6, P.perchPt.z);
  if (pp2) { pe.style.display = 'block'; pe.style.transform = `translate(${pp2[0] - 17}px,${pp2[1] - 17}px)`; const k = key('special'); if (pe.firstChild.outerHTML !== k) pe.innerHTML = k; }
  else pe.style.display = 'none';

  const tg = webTarget(), ret = $('reticle');
  const sp2 = tg && toScreen(tg.pos.x, tg.pos.y + 1.1 * (tg.scale || 1), tg.pos.z);
  if (sp2) { ret.style.opacity = 1; ret.style.transform = `translate(${sp2[0] - 15}px,${sp2[1] - 15}px) rotate(45deg)`; } else ret.style.opacity = 0;
  const sn = $('sense'), hp = G.sense && toScreen(P.pos.x, P.pos.y + 2.1, P.pos.z);
  if (hp) { sn.style.opacity = 1; sn.style.transform = `translate(${hp[0] - 55}px,${hp[1] - 60}px)`; } else sn.style.opacity = 0;

  drawMini();
  updateFlare();
}
// odblask slonca w obiektywie: widoczny tylko, gdy slonce jest w kadrze i nie zaslaniaja go budynki
const _sf = new V3(), _so = new V3();
let flareK = 0;
function updateFlare() {
  const el = $('flare'); if (!el) return;
  let want = 0;
  if (G.state === 'play' && !G.cine && !G.interior && save.tod !== 'night') {
    _sf.copy(camera.position).addScaledVector(sunDir, 1500).project(camera);
    if (_sf.z < 1 && Math.abs(_sf.x) < 1.15 && Math.abs(_sf.y) < 1.15) {
      _so.copy(sunDir); const blocked = raycastCity(camera.position, _so, 700) < 699;
      if (!blocked) { want = Math.max(0, 1 - Math.hypot(_sf.x, _sf.y) * 0.55) * (save.tod === 'day' ? 0.55 : 1); el.style.transform = `translate(${(_sf.x * 0.5 + 0.5) * innerWidth}px,${(-_sf.y * 0.5 + 0.5) * innerHeight}px)`; }
    }
  }
  flareK += (want - flareK) * 0.12; el.style.opacity = flareK.toFixed(3);
}

// ---------------------------------------------------------------- menu glowne
const gfxLabel = () => 'GRAFIKA: ' + (save.gfx === 'high' ? 'WYSOKA' : 'NISKA');
const todLabel = () => 'PORA DNIA: ' + TOD_NAMES[save.tod];
const musLabel = () => 'MUZYKA: ' + (save.music ? 'WŁĄCZONA' : 'WYŁĄCZONA');
function menuItems() {
  return [
    ['pad', 'GRAJ NA PADZIE'],
    ['kb', 'GRAJ NA KOMPUTERZE <small>klawiatura + mysz</small>'],
    ...SLOTS.map(n => ['ld' + n, slotLabel(n, 'WCZYTAJ ZAPIS')]),
    ['new', newLabel()],
    ['suits', 'STROJE'], ['skills', 'UMIEJĘTNOŚCI'], ['moves', 'STEROWANIE'],
    ['tod', todLabel()], ['music', musLabel()], ['gfx', gfxLabel()],
  ];
}
// elementy tworzymy raz, a przy najechaniu tylko zmieniamy podswietlenie —
// przebudowa listy pod kursorem gubila klikniecia
function renderMenu() {
  const L = $('menuList'), items = menuItems();
  if (L.children.length !== items.length) {
    L.innerHTML = items.map(() => '<div class="mi"></div>').join('');
    [...L.children].forEach((d, i) => {
      d.onmouseenter = () => { G.menuIdx = i; renderMenu(); };
      d.onclick = () => menuAct(menuItems()[i][0]);
    });
  }
  [...L.children].forEach((d, i) => {
    const [a, t] = items[i];
    const h = (a === 'pad' || a === 'kb') ? t.replace('GRAJ', G.started ? 'WRÓĆ DO GRY' : save.hasGame ? 'KONTYNUUJ' : 'GRAJ') : t;
    if (d.innerHTML !== h) d.innerHTML = h;
    d.classList.toggle('f', i === G.menuIdx);
  });
}
// trzy sloty zapisu: kazdy trzyma pelny postep + miejsce na mapie
const SLOTS = [1, 2, 3], slotKey = n => 'spiderman_nyc_slot' + n;
function slotRead(n) { try { return JSON.parse(localStorage.getItem(slotKey(n)) || 'null'); } catch (e) { return null; } }
const fmtT = ts => new Date(ts).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
function slotLabel(n, verb) {
  const s = slotRead(n);
  return s ? `${verb} ${n} <small>poz. ${s.lvl} · ${s.pct}% · ${fmtT(s.savedAt)}</small>` : `${verb} ${n} <small>pusty</small>`;
}
function slotSave(n) {
  hooks.save();
  try { localStorage.setItem(slotKey(n), JSON.stringify({ ...save, pct: progress() })); showMsg('ZAPIS ' + n, 'Gra zapisana w slocie ' + n, 2.5); }
  catch (e) { showMsg('BŁĄD ZAPISU', 'Przeglądarka nie pozwala zapisywać (tryb prywatny?)', 3.5); }
}
function slotLoad(n) {
  const sl = slotRead(n); if (!sl) return;
  const keep = { gfx: save.gfx, tod: save.tod, music: save.music };
  delete sl.pct; Object.assign(save, sl, keep, { hasGame: true }); doSave();
  try { sessionStorage.setItem('sp_skip', '1'); } catch (e) {}
  location.reload();
}
// nowa gra kasuje postep, wiec wymaga drugiego potwierdzenia w ciagu 4 sekund
let askNew = -9999;
const newLabel = () => performance.now() - askNew < 4000 ? 'NA PEWNO? POSTĘP ZNIKNIE' : (G.started || save.hasGame ? 'NOWA GRA <small>kasuje postęp</small>' : 'NOWA GRA');
function confirmNew(refresh) {
  if (performance.now() - askNew < 4000) { hooks.newGame(); return; }
  askNew = performance.now(); refresh(); setTimeout(refresh, 4100);
}
export function hideSplash() { const t = $('tytul'); if (!t || !G.splash) return; G.splash = false; t.classList.add('off'); setTimeout(() => t.remove(), 1000); }
function menuAct(a) {
  sfx('ui');
  if (a === 'new') { confirmNew(renderMenu); return; }
  if (a[0] === 'l' && a[1] === 'd') { slotLoad(+a[2]); return; }
  if (a === 'pad' || a === 'kb') hooks.start(a);
  else if (a === 'suits') openPause('suits', true);
  else if (a === 'skills') openPause('skills', true);
  else if (a === 'moves') openPause('moves', true);
  else if (a === 'gfx') { hooks.gfx(); renderMenu(); }
  else if (a === 'tod') { hooks.tod(); renderMenu(); }
  else if (a === 'music') { hooks.music(); renderMenu(); }
}
let footTxt = '';
export function updateMenu(dt) {
  const N = navInput(dt), n = menuItems().length;
  if (N.up) { G.menuIdx = (G.menuIdx + n - 1) % n; renderMenu(); sfx('ui'); }
  if (N.down) { G.menuIdx = (G.menuIdx + 1) % n; renderMenu(); sfx('ui'); }
  if (N.ok) menuAct(menuItems()[G.menuIdx][0]);
  const f = (pad.connected ? `🎮 Wykryto pada: <b>${pad.type === 'ps' ? 'PlayStation' : 'Xbox / inny'}</b>` : '🎮 Pad niepodłączony — podłącz i naciśnij dowolny przycisk')
    + `<br>${audioOK() ? '🔊 Dźwięk włączony' : '🔈 Kliknij lub naciśnij klawisz, żeby włączyć dźwięk'}`
    + `<br>Poziom ${save.lvl} · Plecaki ${save.bags.length}/${BAGS_N} · Postępy ${progress()}%` + (save.savedAt ? ` · Zapis: ${new Date(save.savedAt).toLocaleString('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '');
  if (f !== footTxt) { footTxt = f; $('menuFoot').innerHTML = f; }
}

// ---------------------------------------------------------------- pauza
const TABS = [['map', 'MAPA'], ['skills', 'UMIEJĘTNOŚCI'], ['miss', 'MISJE'], ['suits', 'STROJE'], ['moves', 'LISTA RUCHÓW'], ['game', 'GRA']];
export function openPause(tab, fromMenu) {
  G.pauseFrom = fromMenu ? 'menu' : 'play'; G.state = 'pause'; G.pauseTab = tab;
  $('pause').classList.remove('hidden'); $('menu').classList.add('hidden'); $('hud').classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
  G.suitIdx = Math.max(0, SUITS.findIndex(s => s.id === save.suit));
  G.gameIdx = 0;
  showTab(true);
}
export function closePause() {
  $('pause').classList.add('hidden');
  if (G.pauseFrom === 'menu') { G.state = 'menu'; $('menu').classList.remove('hidden'); renderMenu(); }
  else { G.state = 'play'; $('hud').classList.remove('hidden'); if (G.mode === 'kb') lockMouse(); }
}
function switchTab(d) {
  const i = TABS.findIndex(t => t[0] === G.pauseTab);
  G.pauseTab = TABS[(i + d + TABS.length) % TABS.length][0]; sfx('ui'); showTab(true);
}
function showTab(recenter) {
  const sp = skillPoints();
  $('tabs').innerHTML = key('lb') + TABS.map(([id, t]) => `<div class="tab${id === G.pauseTab ? ' on' : ''}" data-t="${id}">${t}${id === 'skills' && sp ? `<sup> ${sp}</sup>` : ''}</div>`).join('') + key('rb')
    + `<div id="pLvl"><span>POZIOM</span><b>${save.lvl}</b><span>${Math.floor(save.xp)} / ${need(save.lvl)} PD</span></div>`;
  [...$('tabs').querySelectorAll('.tab')].forEach(d => d.onclick = () => { G.pauseTab = d.dataset.t; sfx('ui'); showTab(true); });
  for (const [id] of TABS) $('pg-' + id).classList.toggle('hidden', id !== G.pauseTab);
  const T = G.pauseTab;
  if (T === 'map' && recenter) {
    const c = $('mapc'); c.width = c.clientWidth; c.height = c.clientHeight;
    mapV.cx = P.pos.x; mapV.cz = P.pos.z; mapV.zoom = c.height / (LAND.z1 - LAND.z0) * 1.4;
  }
  if (T === 'suits') renderSuits();
  if (T === 'skills') renderSkills();
  if (T === 'miss') renderMiss();
  if (T === 'moves') renderMoves();
  if (T === 'game') renderGame();
  const close = G.pauseFrom === 'menu' ? 'WRÓĆ' : 'ZAMKNIJ';
  $('pauseFoot').innerHTML = {
    map: `<span>${key('lt')}${key('rt')} PRZYBLIŻ</span><span>${key('ok')} WŁASNY ZNACZNIK</span><span>${key('y')} USUŃ ZNACZNIK</span><span>${key('back')} ${close}</span>`,
    skills: `<span>${key('ok')} ODBLOKUJ</span><span>${key('back')} ${close}</span>`,
    miss: `<span>${key('ok')} USTAW ZNACZNIK</span><span>${key('back')} ${close}</span>`,
    suits: `<span>${key('ok')} ZAŁÓŻ STRÓJ</span><span>${key('back')} ${close}</span>`,
    moves: `<span>${key('back')} ${close}</span>`,
    game: `<span>${key('ok')} WYBIERZ</span><span>${key('back')} ${close}</span>`,
  }[T];
}
export function updatePause(dt) {
  const N = navInput(dt);
  if (N.tl) switchTab(-1); else if (N.tr) switchTab(1);
  const T = G.pauseTab;
  if (N.back || (T === 'map' && (KP.KeyM || KP.Tab || pp(8)))) { sfx('ui'); closePause(); return; }
  if (T === 'map') updateMap(dt, N);
  else if (T === 'suits') updateSuits(dt, N);
  else if (T === 'skills') updateSkills(N);
  else if (T === 'miss') updateMiss(N);
  else if (T === 'game') updateGame(N);
}

// ---- mapa
const mapV = { cx: 0, cz: 0, zoom: 1 };
function setWP(x, z) { G.wp = { x: clamp(x, LAND.x0, LAND.x1), z: clamp(z, LAND.z0, LAND.z1) }; sfx('ui'); }
function updateMap(dt, N) {
  const c = $('mapc');
  if (c.width !== c.clientWidth || c.height !== c.clientHeight) { c.width = c.clientWidth; c.height = c.clientHeight; }
  let [px, py] = stick(pad.a[0], pad.a[1]);
  if (K.KeyW || K.ArrowUp) py -= 1; if (K.KeyS || K.ArrowDown) py += 1; if (K.KeyA || K.ArrowLeft) px -= 1; if (K.KeyD || K.ArrowRight) px += 1;
  const sp = 520 / mapV.zoom * dt; mapV.cx += px * sp; mapV.cz += py * sp;
  let z = 0; if (pad.b[7] || K.Equal || K.NumpadAdd) z += 1; if (pad.b[6] || K.Minus || K.NumpadSubtract) z -= 1;
  mapV.zoom *= Math.exp(z * dt * 1.6); if (mouse.wheel) mapV.zoom *= Math.exp(-mouse.wheel * 0.0015);
  mapV.zoom = clamp(mapV.zoom, 0.25, 5);
  mapV.cx = clamp(mapV.cx, LAND.x0 - 150, LAND.x1 + 150); mapV.cz = clamp(mapV.cz, LAND.z0 - 150, LAND.z1 + 150);
  if (N.ok) setWP(mapV.cx, mapV.cz);
  if (N.y) { G.wp = null; sfx('ui'); }
  drawMap();
}
function drawMap() {
  const c = $('mapc'), x = c.getContext('2d'), W = c.width, H = c.height, z = mapV.zoom;
  const dk = districtAt(mapV.cx, mapV.cz);
  x.setTransform(z, 0, 0, z, W / 2 - mapV.cx * z, H / 2 - mapV.cz * z); drawCity(x, dk);
  x.setTransform(1, 0, 0, 1, 0, 0);
  const S = (wx, wz) => [W / 2 + (wx - mapV.cx) * z, H / 2 + (wz - mapV.cz) * z];
  for (const b of bags) if (!b.got) { const [a, q] = S(b.g.position.x, b.g.position.z); icoBag(x, a, q, 11); }
  for (const cr of crimes) if (cr.active) { const [a, q] = S(cr.x, cr.z); icoCrime(x, a, q, 16); }
  missionIcons(x, S, 18);
  if (G.wp) { const [a, q] = S(G.wp.x, G.wp.z); icoWP(x, a, q, 15); }
  const [px, py] = S(P.pos.x, P.pos.z); icoPlayer(x, px, py, Math.PI - P.heading, 14);
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2;
  x.beginPath(); x.arc(W / 2, H / 2, 11, 0, 7); x.moveTo(W / 2 - 20, H / 2); x.lineTo(W / 2 - 6, H / 2); x.moveTo(W / 2 + 6, H / 2); x.lineTo(W / 2 + 20, H / 2);
  x.moveTo(W / 2, H / 2 - 20); x.lineTo(W / 2, H / 2 - 6); x.moveTo(W / 2, H / 2 + 6); x.lineTo(W / 2, H / 2 + 20); x.stroke();
  $('mapDist').textContent = '📍 ' + DIST[dk].name;
  $('mapProg').innerHTML = `<span>OGÓLNE POSTĘPY</span><b>${progress()}%</b>`;
}

// ---- umiejetnosci
function renderSkills() {
  const P2 = $('skPanel');
  if (!P2.children.length) {
    P2.innerHTML = COLS.map((c, ci) => `<div class="skc"><h4>${c}</h4>${SKILLS.map((s, i) => s.col === ci ? `<div class="sk" data-i="${i}"></div>` : '').join('')}</div>`).join('');
    P2.querySelectorAll('.sk').forEach(d => {
      const i = +d.dataset.i;
      d.onmouseenter = () => { G.skillIdx = i; refreshSkills(); };
      d.onclick = () => { G.skillIdx = i; buySkill(); };
    });
  }
  refreshSkills();
}
function refreshSkills() {
  $('skPanel').querySelectorAll('.sk').forEach(d => {
    const s = SKILLS[+d.dataset.i], own = has(s.id), can = canBuy(s);
    d.className = 'sk' + (own ? ' own' : can ? ' can' : (!s.req || has(s.req)) ? '' : ' no') + (+d.dataset.i === G.skillIdx ? ' f' : '');
    d.innerHTML = `${own ? '✔ ' : ''}${s.name}<small>${s.desc}</small>`;
  });
  const s = SKILLS[G.skillIdx], sp = skillPoints();
  $('skName').textContent = s.name;
  $('skInfo').innerHTML = `${s.desc}<br>` + (has(s.id) ? '<b style="color:#3fe3ff">Odblokowane</b>'
    : s.req && !has(s.req) ? `<b style="color:#ff6b6b">Najpierw odblokuj: ${SKILLS.find(q => q.id === s.req).name}</b>`
      : sp ? `<b style="color:#ffc93c">Koszt: 1 punkt · masz ${sp}</b>` : '<b style="color:#ff6b6b">Brak punktów — zdobądź kolejny poziom</b>');
}
function buySkill() {
  const s = SKILLS[G.skillIdx];
  if (buy(s)) { sfx('level'); if (s.id.startsWith('hp')) P.hp = maxHp(); showTab(false); } else sfx('hurt', 0.3);
  refreshSkills();
}
function updateSkills(N) {
  const cur = SKILLS[G.skillIdx];
  const col = SKILLS.filter(s => s.col === cur.col), ri = col.indexOf(cur);
  let t = null;
  if (N.up && ri > 0) t = col[ri - 1];
  if (N.down && ri < col.length - 1) t = col[ri + 1];
  if (N.left || N.right) {
    const nc = clamp(cur.col + (N.left ? -1 : 1), 0, COLS.length - 1), c2 = SKILLS.filter(s => s.col === nc);
    t = c2[Math.min(ri, c2.length - 1)];
  }
  if (t) { G.skillIdx = SKILLS.indexOf(t); refreshSkills(); sfx('ui'); }
  if (N.ok) buySkill();
}

// ---- misje
function renderMiss() {
  const L = missionList(); G.missIdx = clamp(G.missIdx, 0, L.length - 1);
  $('miList').innerHTML = L.map((m, i) => `<div class="mis${i === G.missIdx ? ' f' : ''}" data-i="${i}"><b>${m.name}</b><small>${m.status}</small></div>`).join('');
  $('miList').querySelectorAll('.mis').forEach(d => {
    const i = +d.dataset.i;
    d.onclick = () => { G.missIdx = i; missWP(); renderMiss(); };
  });
  const m = L[G.missIdx];
  $('miName').textContent = m.name;
  $('miInfo').innerHTML = `${m.desc}<br><br><b style="color:#ffc93c">${m.status}</b>` + (m.x != null ? `<br><br>${key('ok')} ustaw znacznik na mapie` : '');
}
function missWP() { const m = missionList()[G.missIdx]; if (m && m.x != null) { setWP(m.x, m.z); showTabHint(); } }
function showTabHint() { $('miInfo').innerHTML += '<br><b style="color:#3fe3ff">Znacznik ustawiony!</b>'; }
function updateMiss(N) {
  const n = missionList().length;
  if (N.up) { G.missIdx = (G.missIdx + n - 1) % n; renderMiss(); sfx('ui'); }
  if (N.down) { G.missIdx = (G.missIdx + 1) % n; renderMiss(); sfx('ui'); }
  if (N.ok) missWP();
}

// ---- stroje
function renderSuits() {
  const g = $('suitGrid');
  if (!g.children.length) SUITS.forEach((s, i) => {
    const d = document.createElement('div'); d.className = 'card';
    d.innerHTML = `<img src="${suitThumb(s)}"><div class="lk"></div><div class="eq">✔</div>`;
    d.onclick = () => { G.suitIdx = i; equip(i); };
    d.onmouseenter = () => { G.suitIdx = i; refreshSuits(); };
    g.appendChild(d);
  });
  refreshSuits();
}
function refreshSuits() {
  const un = SUITS.filter(s => s.lvl <= save.lvl).length;
  $('suitPct').textContent = Math.round(un / SUITS.length * 100) + '% ODBLOKOWANE';
  [...$('suitGrid').children].forEach((d, i) => {
    const s = SUITS[i], lock = s.lvl > save.lvl;
    d.classList.toggle('f', i === G.suitIdx); d.classList.toggle('lock', lock);
    d.querySelector('.lk').innerHTML = lock ? '🔒<br>POZIOM ' + s.lvl : '';
    d.querySelector('.eq').style.display = s.id === save.suit ? 'block' : 'none';
    if (i === G.suitIdx) d.scrollIntoView({ block: 'nearest' });
  });
  const s = SUITS[G.suitIdx];
  $('suitName').textContent = s.name;
  $('suitInfo').innerHTML = (s.lvl > save.lvl ? `<b style="color:#ff6b6b">Odblokujesz na poziomie ${s.lvl}</b><br>` : s.id === save.suit ? '<b style="color:#3fe3ff">Założony</b><br>' : '') + s.desc;
}
function equip(i) {
  const s = SUITS[i];
  if (s.lvl > save.lvl) { sfx('hurt', 0.3); refreshSuits(); return; }
  setSuit(s.id); sfx('ui'); refreshSuits();
}
function updateSuits(dt, N) {
  let i = G.suitIdx;
  if (N.left) i--; if (N.right) i++; if (N.up) i -= 5; if (N.down) i += 5;
  i = clamp(i, 0, SUITS.length - 1);
  if (i !== G.suitIdx) { G.suitIdx = i; refreshSuits(); sfx('ui'); }
  if (N.ok) equip(G.suitIdx);
  suitView(dt);
}
let SV = null;
function suitView(dt) {
  const c = $('suitView');
  if (!SV) {
    const r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true }); r.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene();
    sc.add(new THREE.HemisphereLight(0xdff4ff, 0x203040, 0.9));
    const d1 = new THREE.DirectionalLight(0xffffff, 1.1); d1.position.set(2, 3, 4); sc.add(d1);
    const d2 = new THREE.DirectionalLight(0x3fe3ff, 0.7); d2.position.set(-3, 2, -3); sc.add(d2);
    const ca = new THREE.PerspectiveCamera(26, 1, 0.1, 50); ca.position.set(0, 1.0, 4.8); ca.lookAt(0, 0.92, 0);
    SV = { r, sc, ca, model: null, id: null, rot: 0, w: 0, h: 0 };
  }
  const w = c.clientWidth, h = c.clientHeight;
  if (w && h && (w !== SV.w || h !== SV.h)) { SV.w = w; SV.h = h; SV.r.setSize(w, h, false); SV.ca.aspect = w / h; SV.ca.updateProjectionMatrix(); }
  const s = SUITS[G.suitIdx];
  if (SV.id !== s.id) {
    if (SV.model) SV.sc.remove(SV.model.root);
    SV.model = buildSpider(s); linearize(SV.model.root);
    const p = newPose(); p.sLz = 0.3; p.sRz = -0.3; p.eL = -0.15; p.eR = -0.15; p.hLz = 0.07; p.hRz = -0.07;
    applyPose(SV.model, p); SV.sc.add(SV.model.root); SV.id = s.id;
  }
  SV.rot += dt * 0.7; SV.model.root.rotation.y = Math.sin(SV.rot) * 0.9;
  SV.r.render(SV.sc, SV.ca);
}

// ---- lista ruchow
function renderMoves() {
  const ps = pad.type === 'ps' ? 'ps' : 'xbox';
  const R = [
    ['Chodzenie i bieg', kk('L-GAŁKA'), kk('W') + kk('A') + kk('S') + kk('D')],
    ['Kamera', kk('P-GAŁKA'), kk('MYSZ')],
    ['Skok', key('jump', ps), kk('SPACJA')],
    ['Bujanie na sieci — przytrzymaj w powietrzu', key('swing', ps), kk('SHIFT')],
    ['Bieg parkour — przytrzymaj na ziemi', key('swing', ps), kk('SHIFT')],
    ['Bieg po ścianie — wbiegnij w ścianę trzymając', key('swing', ps), kk('SHIFT')],
    ['Zaczep — lot na krawędź dachu (celuj kamerą w kółko)', key('special', ps), kk('E')],
    ['Wybicie z zaczepu — skok w chwili dolotu', key('jump', ps), kk('SPACJA')],
    ['Skok z sieci / odbicie od ściany / zip w powietrzu', key('jump', ps), kk('SPACJA')],
    ['Cios — naciskaj szybko, 4. cios to kopnięcie z obrotu', key('punch', ps), kk('LPM') + kk('F')],
    ['Wybicie bandyty w górę — przytrzymaj cios, potem skocz i bij w powietrzu', key('punch', ps), kk('LPM') + kk('F')],
    ['Trik w powietrzu (gdy nikogo nie ma obok)', key('punch', ps), kk('LPM') + kk('F')],
    ['Wykończenie — gdy pasek skupienia jest pełny', key('special', ps), kk('E')],
    ['Strzał siecią — zawija bandytów, ogłusza osiłki i Nosorożca', key('web', ps), kk('PPM') + kk('R')],
    ['Unik — gdy nad głową błyśnie zmysł pająka', key('dodge', ps), kk('C') + kk('CTRL')],
    ['Mapa', key('map', ps), kk('M') + kk('TAB')],
    ['Pauza', key('pause', ps), kk('ESC')],
  ];
  $('movesT').innerHTML = `<tr><th>RUCH</th><th>PAD</th><th>KLAWIATURA + MYSZ</th></tr>` + R.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('');
}

// ---- gra
function gameItems() {
  const base = [['tod', todLabel()], ['music', musLabel()], ['gfx', gfxLabel()]];
  return G.pauseFrom === 'menu' ? [['back', 'WRÓĆ'], ...base] : [['resume', 'WZNÓW GRĘ'], ...SLOTS.map(n => ['sv' + n, slotLabel(n, 'ZAPISZ W SLOCIE')]), ...base, ['new', newLabel()], ['menu', 'MENU GŁÓWNE']];
}
function renderGame() {
  const it = gameItems(), L = $('gameList'); G.gameIdx = clamp(G.gameIdx, 0, it.length - 1);
  if (L.children.length !== it.length) {
    L.innerHTML = it.map(() => '<div class="mi"></div>').join('');
    [...L.children].forEach((d, i) => {
      d.onmouseenter = () => { G.gameIdx = i; renderGame(); };
      d.onclick = () => gameAct(gameItems()[i][0]);
    });
  }
  [...L.children].forEach((d, i) => { if (d.innerHTML !== it[i][1]) d.innerHTML = it[i][1]; d.classList.toggle('f', i === G.gameIdx); });
  $('gameStats').innerHTML = `Poziom: <b>${save.lvl}</b><br>Udaremnione przestępstwa: <b>${save.crimes}</b><br>Znalezione plecaki: <b>${save.bags.length} / ${BAGS_N}</b><br>Pokonany Nosorożec: <b>${save.bossWins}×</b><br>Zatrzymane auta: <b>${save.chases}</b><br>Ogólne postępy: <b>${progress()}%</b>`;
}
function gameAct(a) {
  sfx('ui');
  if (a[0] === 's' && a[1] === 'v') { slotSave(+a[2]); renderGame(); return; }
  if (a === 'new') { confirmNew(renderGame); return; }
  if (a === 'resume' || a === 'back') closePause();
  else if (a === 'gfx') { hooks.gfx(); renderGame(); }
  else if (a === 'tod') { hooks.tod(); renderGame(); }
  else if (a === 'music') { hooks.music(); renderGame(); }
  else if (a === 'menu') { $('pause').classList.add('hidden'); hooks.toMenu(); }
}
function updateGame(N) {
  const n = gameItems().length;
  if (N.up) { G.gameIdx = (G.gameIdx + n - 1) % n; renderGame(); }
  if (N.down) { G.gameIdx = (G.gameIdx + 1) % n; renderGame(); }
  if (N.ok) gameAct(gameItems()[G.gameIdx][0]);
}

// ---------------------------------------------------------------- start interfejsu
export function initUI() {
  G.splash = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const wrap = document.createElement('div'); wrap.innerHTML = HTML; while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
  try { if (sessionStorage.getItem('sp_skip')) { sessionStorage.removeItem('sp_skip'); G.splash = false; const t = $('tytul'); if (t) t.remove(); } } catch (e) {}
  buildMiniBase();
  renderMenu();
  const mc = $('mapc'); let drag = null;
  mc.addEventListener('mousedown', e => { if (e.button === 0) drag = { x: e.clientX, y: e.clientY, m: false }; });
  addEventListener('mousemove', e => {
    if (!drag) return;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.m = true;
    if (drag.m) { mapV.cx -= e.movementX / mapV.zoom; mapV.cz -= e.movementY / mapV.zoom; }
  });
  addEventListener('mouseup', e => {
    if (drag && !drag.m && G.state === 'pause' && G.pauseTab === 'map') {
      const r = mc.getBoundingClientRect();
      setWP(mapV.cx + (e.clientX - r.left - mc.width / 2) / mapV.zoom, mapV.cz + (e.clientY - r.top - mc.height / 2) / mapV.zoom);
    }
    drag = null;
  });
  canvas.addEventListener('click', () => { if (G.state === 'play' && G.mode === 'kb' && document.pointerLockElement !== canvas) lockMouse(); });
}
export function showHUD(on) { $('hud').classList.toggle('hidden', !on); $('menu').classList.toggle('hidden', on); if (!on) renderMenu(); }
