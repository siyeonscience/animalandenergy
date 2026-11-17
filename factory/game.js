/* 네프론 필터 공장 — 게임 진행
   첫 화면 → 공장장 → 오늘의 근무 안내서 → (안내서가 보고서 아이콘으로 쏙) → 하이라이트 튜토리얼 3단계
   → 1단계 여과 → 2단계 재흡수 → 3단계 분비 → 오줌 성분표 */
import { SUBS, WAVES, POINT, PENALTY, canFilter, canReabsorb, canSecrete, urineTable, bossComment } from './logic.js';

const $ = s => document.querySelector(s);
const stageEl = $('#stage');

/* ================= 화면 크기 맞추기 (1280×800 기준) ================= */
let scale = 1;
function fitStage() { scale = Math.min(innerWidth / 1280, innerHeight / 800); stageEl.style.transform = `translate(-50%, -50%) scale(${scale})`; }
addEventListener('resize', fitStage); fitStage();
const toStage = e => { const r = stageEl.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
const show = id => document.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s.id === id));

/* ================= 공장 바닥 그리기 ================= */
const SPEED = 80, BELT = { top: 210, cap: 520, blood: 200 };
const COLORS = { blood: ['#ffd3da', '#e07a8c', '#f2a3b0'], tubule: ['#ffe8b0', '#d9a441', '#f2d38a'] };
function beltSvg(id, y, kind) {
  const [fill, stroke, slat] = COLORS[kind];
  let lines = ''; for (let x = -60; x <= 1260; x += 70) lines += `<path d="M${x} ${y - 44} V${y + 44}"/>`;
  return `<clipPath id="clip-${id}"><rect x="63" y="${y - 47}" width="1154" height="94" rx="47"/></clipPath>
    <rect x="60" y="${y - 50}" width="1160" height="100" rx="50" fill="${fill}" stroke="${stroke}" stroke-width="6"/>
    <g clip-path="url(#clip-${id})"><g class="slats" stroke="${slat}" stroke-width="5">${lines}</g></g>
    <circle cx="110" cy="${y}" r="24" fill="${stroke}"/><circle cx="1170" cy="${y}" r="24" fill="${stroke}"/>
    <circle cx="110" cy="${y}" r="9" fill="${fill}"/><circle cx="1170" cy="${y}" r="9" fill="${fill}"/>`;
}
const GRATE = `<rect x="400" y="300" width="480" height="44" rx="14" fill="#a7b8cc" stroke="#7b8fa8" stroke-width="5"/>
  <g fill="#e6f4ff">${Array.from({ length: 11 }, (_, i) => `<circle cx="${440 + i * 40}" cy="322" r="7"/>`).join('')}</g>`;
const HOPPER = `<path d="M300 400 H980 L900 630 H380Z" fill="#ffe8b0" stroke="#d9a441" stroke-width="6" stroke-linejoin="round"/>
  <path d="M330 470 H950 M350 540 H930" stroke="#f2d38a" stroke-width="4"/>`;
const ARM = `<rect x="300" y="352" width="120" height="30" rx="10" fill="#a7b8cc"/>
  <g class="spin" style="transform-origin:360px 330px"><circle cx="360" cy="330" r="44" fill="#ffd966"/>
  <path d="M360 280 v-8 M360 380 v8 M310 330 h-8 M410 330 h8 M325 295 l-6 -6 M395 365 l6 6 M395 295 l6 -6 M325 365 l-6 6" stroke="#ffd966" stroke-width="12" stroke-linecap="round"/></g>
  <circle cx="360" cy="330" r="18" fill="#e6f4ff"/>
  <path id="armPath" d="M380 312 L560 300 L640 330" stroke="#c9d1db" stroke-width="22" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="560" cy="300" r="16" fill="#a7b8cc"/>`;
function drawFloor(s) {
  let svg = '', signs = '';
  if (s === 0) {
    svg = beltSvg('blood', BELT.blood, 'blood') + GRATE + HOPPER;
    signs = `<span class="sign" style="left:60px;top:96px">토리</span><span class="sign" style="left:900px;top:300px">거름망</span><span class="sign" style="left:990px;top:420px">보먼주머니</span>`;
  } else {
    svg = beltSvg('top', BELT.top, 'tubule') + beltSvg('cap', BELT.cap, 'blood') + (s === 1 ? ARM : '');
    signs = `<span class="sign" style="left:60px;top:104px">세뇨관</span><span class="sign" style="left:60px;top:588px">모세혈관</span>`;
  }
  $('#floorSvg').innerHTML = svg; $('#signs').innerHTML = signs;
  document.querySelectorAll('.chip').forEach(c => { const k = +c.dataset.s; c.classList.toggle('on', k === s); c.classList.toggle('done', k < s); c.textContent = `${k + 1} ${['여과', '재흡수', '분비'][k]}${k < s ? ' ✓' : ''}`; });
}

/* ================= 물질 ================= */
const G = { s: 0, score: 0, items: [], queue: [], decor: [], spawnT: 0, decorT: 0, running: false, paused: false,
  filtrate: [], record: { filtered: {}, urine: {} } };
function makeItem(type, x, y, { belt = null, decor = false } = {}) {
  const el = document.createElement('div');
  el.className = 'item' + (decor ? ' small' : '');
  el.innerHTML = `<svg viewBox="0 0 40 40" role="img" aria-label="${SUBS[type].name}"><use href="#s-${type}"/></svg>`;
  $('#items').appendChild(el);
  const it = { type, el, x, y, belt, decor, state: belt ? 'belt' : 'still' };
  place(it); G.items.push(it);
  if (!decor) el.addEventListener('pointerdown', e => onDown(e, it));
  return it;
}
const place = it => { it.el.style.transform = `translate(${it.x}px, ${it.y}px)`; };
function removeItem(it) { it.el.remove(); G.items = G.items.filter(x => x !== it); }
function clearItems() { G.items.forEach(it => it.el.remove()); G.items = []; }
function animateTo(it, tx, ty, ms, done) {
  const sx = it.x, sy = it.y, t0 = performance.now(); it.state = 'anim';
  (function step(now) {
    const k = Math.min(1, (now - t0) / ms), e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    it.x = sx + (tx - sx) * e; it.y = sy + (ty - sy) * e; place(it);
    if (k < 1) requestAnimationFrame(step); else done && done();
  })(t0);
}
const addScore = d => { G.score = Math.max(0, G.score + d); $('#score').textContent = G.score; };
const count = (obj, type) => { obj[type] = (obj[type] || 0) + 1; };

/* ================= 공장장 말풍선 ================= */
let sayT;
function say(text, kind = '', ms = 2800) {
  const box = $('#bossMini'), p = $('#bossMsg');
  box.hidden = false; box.classList.toggle('right', G.s > 0);
  p.textContent = text; p.className = kind;
  clearTimeout(sayT); sayT = setTimeout(() => { box.hidden = true; }, ms);
}
const NAME = t => SUBS[t].name;
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1) - 0xac00; return (c >= 0 && c % 28) ? a : b; };

/* ================= 끌기 · 누르기 ================= */
let drag = null;
function onDown(e, it) {
  if (!G.running || G.paused || it.state !== 'belt') return;
  e.preventDefault();
  if (G.s === 1) { if (it.belt === 'top') tapReabsorb(it); return; }
  const source = G.s === 0 ? 'blood' : 'cap';
  if (it.belt !== source) return;
  drag = { it, id: e.pointerId }; it.state = 'drag'; it.el.classList.add('drag');
  it.el.setPointerCapture(e.pointerId);
  it.el.onpointermove = ev => { const p = toStage(ev); it.x = p.x; it.y = p.y; place(it); };
  it.el.onpointerup = it.el.onpointercancel = () => drop(it);
}
function drop(it) {
  it.el.onpointermove = it.el.onpointerup = it.el.onpointercancel = null;
  it.el.classList.remove('drag'); drag = null;
  if (G.s === 0) dropFilter(it); else dropSecrete(it);
}
function backToBelt(it, beltY, bad) {
  if (bad) { it.el.classList.remove('no'); void it.el.offsetWidth; it.el.classList.add('no'); }
  animateTo(it, it.x, beltY, 350, () => { it.state = 'belt'; });
}

/* 1단계 여과 */
function dropFilter(it) {
  const inZone = it.x > 380 && it.x < 900 && it.y > 255 && it.y < 480;
  if (!inZone) return backToBelt(it, BELT.blood, false);
  if (canFilter(it.type)) {
    addScore(POINT); count(G.record.filtered, it.type); G.filtrate.push(it.type);
    say(`${NAME(it.type)}${josa(NAME(it.type), '은', '는')} 크기가 작아서 거름망을 통과해요!`, 'good');
    const tx = 430 + Math.random() * 420, ty = 470 + Math.random() * 110;
    animateTo(it, Math.min(Math.max(it.x, 440), 840), 360, 200, () => animateTo(it, tx, ty, 450, () => { it.state = 'hopper'; it.belt = 'hopper'; }));
  } else {
    addScore(-PENALTY);
    say(`${NAME(it.type)}${josa(NAME(it.type), '은', '는')} 너무 커서 거름망을 통과하지 못해요!`, 'bad');
    backToBelt(it, BELT.blood, true);
  }
}
/* 2단계 재흡수 */
function tapReabsorb(it) {
  if (canReabsorb(it.type)) {
    addScore(POINT);
    if (it.type === 'water') { count(G.record.urine, 'water'); say('물 재흡수 성공! 물은 대부분 재흡수되고 일부만 오줌으로 나가요.', 'good'); }
    else say(`${NAME(it.type)} 재흡수 성공! 몸에 필요한 물질이에요.`, 'good');
    it.belt = 'cap';
    animateTo(it, it.x + 30, BELT.cap, 650, () => { it.state = 'belt'; });
  } else {
    addScore(-PENALTY);
    say('요소는 노폐물이라 오줌으로 보내야 해요!', 'bad');
    it.el.classList.remove('no'); void it.el.offsetWidth; it.el.classList.add('no');
  }
}
/* 3단계 분비 */
function dropSecrete(it) {
  const inZone = it.y > 130 && it.y < 310;
  if (!inZone) return backToBelt(it, BELT.cap, false);
  if (canSecrete(it.type)) {
    addScore(POINT); count(G.record.urine, it.type);
    say('요소를 세뇨관으로 보냈어요! 이제 오줌으로 나가요.', 'good');
    it.belt = 'top'; animateTo(it, it.x, BELT.top, 300, () => { it.state = 'belt'; });
  } else {
    addScore(-PENALTY);
    say(`${NAME(it.type)}${josa(NAME(it.type), '은', '는')} 몸에 필요한 물질이에요! 혈액에 남겨 두세요.`, 'bad');
    backToBelt(it, BELT.cap, true);
  }
}

/* 벨트 끝에 닿았을 때 */
function reachEnd(it) {
  removeItem(it);
  if (it.decor) return;
  const t = it.type;
  if (G.s === 0 && it.belt === 'blood' && canFilter(t)) say(`${NAME(t)}${josa(NAME(t), '을', '를')} 놓쳤어요! 작은 물질은 토리에서 보먼주머니로 걸러져요.`, 'bad');
  if (G.s === 1 && it.belt === 'top') {
    count(G.record.urine, t);
    if (t === 'glucose' || t === 'amino') say(`${NAME(t)}${josa(NAME(t), '이', '가')} 오줌으로 나가 버렸어요!`, 'bad');
  }
  if (G.s === 2 && it.belt === 'cap' && t === 'urea') say('요소를 놓쳤어요! 혈액에 노폐물이 남았어요.', 'bad');
}

/* ================= 단계 진행 ================= */
const SOURCE = ['blood', 'top', 'cap'];
const INTRO = ['', '필요한 물질을 눌러서 모세혈관으로 돌려보내요!', '모세혈관에 남은 노폐물을 끌어서 세뇨관으로 보내요!'];
function setupStage(s) {
  G.s = s; clearItems(); drawFloor(s);
  G.queue = s === 0 ? [...WAVES.filter] : s === 1 ? [...G.filtrate] : [...WAVES.secrete];
  G.decor = s === 1 ? ['rbc', 'protein', 'rbc'] : s === 2 ? ['water', 'urea', 'water'] : [];
  G.spawnT = 1.2; G.decorT = 0.4;
}
function startStage(s) {
  setupStage(s); G.running = true; G.paused = false;
  stageEl.classList.remove('paused');
  if (INTRO[s]) say(INTRO[s], '', 3600);
}
function stageFinished() {
  return G.queue.length === 0 && !G.items.some(it => !it.decor && (it.state === 'drag' || it.state === 'anim' || (it.state === 'belt' && it.belt === SOURCE[G.s])));
}
function endStage() {
  G.running = false;
  const names = ['1단계 여과', '2단계 재흡수', '3단계 분비'];
  $('#clearTitle').textContent = `${names[G.s]} 완료!`;
  $('#clearScore').textContent = G.score;
  $('#clearBtn').textContent = G.s < 2 ? `다음 단계: ${['재흡수', '분비'][G.s]}` : '오줌 성분표 보기';
  setTimeout(() => { $('#clear').hidden = false; }, 700);
}
$('#clearBtn').addEventListener('click', () => {
  $('#clear').hidden = true;
  if (G.s < 2) startStage(G.s + 1); else showResult();
});

/* ================= 반복 ================= */
let last = performance.now();
function tick(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  if (G.running && !G.paused) {
    G.spawnT -= dt;
    if (G.spawnT <= 0 && G.queue.length) { makeItem(G.queue.shift(), 70, BELT[SOURCE[G.s]], { belt: SOURCE[G.s] }); G.spawnT = 1.25; }
    G.decorT -= dt;
    if (G.decorT <= 0 && G.decor.length && G.queue.length) {
      const belt = G.s === 1 ? 'cap' : 'top', t = G.decor.shift(); G.decor.push(t);
      makeItem(t, 70, BELT[belt] + 4, { belt, decor: true }); G.decorT = 2.6;
    }
    for (const it of [...G.items]) {
      if (it.state !== 'belt') continue;
      it.x += SPEED * dt; place(it);
      if (it.x > 1205) reachEnd(it);
    }
    if (stageFinished()) { G.items.filter(it => it.decor).forEach(removeItem); endStage(); }
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
function pause(on) { G.paused = on; stageEl.classList.toggle('paused', on); }

/* ================= 안내서 · 튜토리얼 ================= */
let guideFirst = true;
function openGuide(first) {
  guideFirst = first; pause(true);
  $('#guideCard').classList.remove('suck'); $('#guide').hidden = false;
}
$('#guideOk').addEventListener('click', () => {
  if (!guideFirst) { $('#guide').hidden = true; pause(false); return; }
  $('#guideCard').classList.add('suck');
  setTimeout(() => {
    $('#guide').hidden = true; $('#guideCard').classList.remove('suck');
    const r = $('#reportBtn'); r.classList.remove('pulse'); void r.offsetWidth; r.classList.add('pulse');
    startTutorial();
  }, 720);
});
$('#reportBtn').addEventListener('click', () => { if (!$('#tut').hidden) return; if (G.running) openGuide(false); });

const TUT = [
  { spot: [1186, 15, 76, 70, 22], tip: { right: 30, top: 120, width: 470 }, text: '언제든지 눌러서 근무 안내서를 확인할 수 있어요.', btn: '다음 (1/3)' },
  { spot: [50, 140, 1180, 120, 60], tip: { left: 360, top: 340, width: 560 }, text: '토리 벨트를 따라 혈액 속 물질이 흘러와요.', btn: '다음 (2/3)' },
  { spot: [380, 160, 520, 300, 40], tip: { left: 60, top: 520, width: 640 }, text: '작은 물질을 끌어서 거름망에 올려 보세요. 통과한 물질은 보먼주머니로 떨어져요.', btn: '근무 시작! (3/3)' },
];
let tutStep = 0;
function startTutorial() {
  setupStage(0);
  ['rbc', 'protein', 'glucose', 'water', 'urea', 'amino'].forEach((t, i) => makeItem(t, 170 + i * 160, BELT.blood));
  tutStep = 0; $('#tut').hidden = false; showTut();
}
function showTut() {
  const t = TUT[tutStep], [x, y, w, h, r] = t.spot, spot = $('#spot'), tip = $('#tip');
  Object.assign(spot.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px', borderRadius: r + 'px' });
  tip.style.left = tip.style.right = tip.style.top = '';
  for (const [k, v] of Object.entries(t.tip)) tip.style[k] = v + 'px';
  $('#tipText').textContent = t.text; $('#tipBtn').textContent = t.btn;
}
$('#tipBtn').addEventListener('click', () => {
  tutStep++;
  if (tutStep < TUT.length) return showTut();
  $('#tut').hidden = true; startStage(0);
  say('근무 시작! 작은 물질을 끌어서 거름망에 올려요.', '', 3000);
});

/* ================= 결과 ================= */
function showResult() {
  const rows = urineTable(G.record);
  $('#resBody').innerHTML = rows.map(r => {
    const mark = (v, cls = '') => `<td class="${v ? 'yes' : 'no'} ${cls}">${v ? '○' : '×'}</td>`;
    return `<tr class="${r.wrong ? 'wrong' : ''}"><td><span class="nm"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><use href="#s-${r.type}"/></svg>${r.name}</span></td>
      ${mark(r.blood)}${mark(r.bowman)}${mark(r.mine, 'mine')}${mark(r.normal)}</tr>`;
  }).join('');
  $('#resScore').textContent = G.score;
  $('#resComment').textContent = bossComment(rows);
  $('#bossMini').hidden = true;
  show('scrResult');
}

/* ================= 시작 · 다시 ================= */
function resetGame() {
  Object.assign(G, { s: 0, score: 0, queue: [], decor: [], filtrate: [], record: { filtered: {}, urine: {} }, running: false, paused: false });
  clearItems(); $('#score').textContent = 0;
}
$('#startBtn').addEventListener('click', () => show('scrBoss'));
$('#okBossBtn').addEventListener('click', () => { resetGame(); show('scrPlay'); setupStage(0); openGuide(true); });
$('#againBtn').addEventListener('click', () => { resetGame(); show('scrPlay'); startStage(0); say('다시 근무 시작! 작은 물질을 끌어서 거름망에 올려요.', '', 3000); });

// 점검·테스트용
window.FACTORY = { G, startStage, showResult, setupStage, dropFilter, tapReabsorb, dropSecrete };
