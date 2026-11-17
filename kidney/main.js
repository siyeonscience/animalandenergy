/* 배설계의 구조 — 화면 연결
   1단계 배설 기관 → 2단계 콩팥 단면 → 3단계 네프론 (모두 평면 그림: scenes.js)
   빈칸 채점 규칙은 quiz.js */
import { STAGES, freshBlank, grade, showHint, isDone, stageDone } from './quiz.js';
import { SCENES } from './scenes.js';

const $ = s => document.querySelector(s);
const KEY = 'kidney-explorer-v1';
const art = $('#art'), stageEl = $('#stageEl'), overlay = $('#overlay'), leaders = $('#leaders');

/* ================= 상태 · 저장 ================= */
let state = load() || fresh();
function fresh() {
  const blanks = {};
  STAGES.forEach(s => s.blanks.forEach(b => { blanks[b.id] = freshBlank(); }));
  return { stage: 0, unlocked: 0, blanks };
}
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.blanks ? s : null; } catch { return null; } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }

/* ================= 화면 ================= */
let cur = -1, pins = {}, markers = {}, lines = {};
/* 그림 자리: 넓은 화면에서는 양옆에 이름 칸 자리를 비워 둬요 */
function layout() {
  if (cur < 0) return;
  const W = stageEl.clientWidth, [l, r] = SCENES[cur].pad, narrow = W < 700;
  const L = narrow ? 0 : l, R = narrow ? 0 : r;
  art.style.left = L + 'px'; art.style.width = Math.max(200, W - L - R) + 'px';
  place();
}
new ResizeObserver(layout).observe(stageEl);

function buildTabs() {
  $('#tabs').innerHTML = '';
  STAGES.forEach((s, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.textContent = `${i + 1} ${s.tab}${stageDone(s, state.blanks) ? ' ✓' : ''}`;
    b.classList.toggle('on', i === cur); b.disabled = i > state.unlocked;
    b.onclick = () => showStage(i);
    $('#tabs').appendChild(b);
  });
}

function showStage(i) {
  cur = i; state.stage = i; save();
  const sc = SCENES[i];
  art.setAttribute('viewBox', sc.viewBox); art.innerHTML = sc.svg;
  const st = STAGES[i];
  $('#stageTitle').textContent = st.title;
  overlay.innerHTML = ''; leaders.innerHTML = ''; pins = {}; markers = {}; lines = {};
  st.blanks.forEach((b, k) => {
    const [side, top] = sc.slots[b.id];
    const pin = document.createElement('div');
    pin.className = 'pin ' + side;
    pin.style[side] = '16px'; pin.style.top = `calc(${top * 100}% - 23px)`;
    pin.innerHTML = `<span class="num">${k + 1}</span><input aria-label="${k + 1}번 이름" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <span class="tries"><i></i><i></i><i></i></span><div class="bubble" hidden></div>`;
    const input = pin.querySelector('input');
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check([b.id]); } });
    input.addEventListener('input', () => { state.blanks[b.id].draft = input.value; });
    overlay.appendChild(pin); pins[b.id] = pin;
    const m = document.createElement('div'); m.className = 'marker'; m.textContent = k + 1; overlay.appendChild(m); markers[b.id] = m;
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('stroke', '#9fd3ff'); l.setAttribute('stroke-width', '2'); l.setAttribute('stroke-dasharray', '5 5');
    leaders.appendChild(l); lines[b.id] = l;
    paint(b.id, false);
  });
  buildTabs(); updateNext(); layout();
}

function paint(id, animate) {
  const st = STAGES[cur], def = st.blanks.find(b => b.id === id), s = state.blanks[id], pin = pins[id];
  if (!pin) return;
  const input = pin.querySelector('input'), bubble = pin.querySelector('.bubble');
  pin.classList.remove('ok', 'wrong', 'out');
  if (s.status !== 'open') pin.classList.add(s.status);
  markers[id].className = 'marker' + (s.status === 'ok' ? ' ok' : s.status === 'out' ? ' out' : '');
  if (s.status === 'ok' || s.status === 'out') { input.value = def.answer; input.readOnly = true; }
  else { input.value = s.draft ?? (s.status === 'wrong' ? s.value : ''); input.readOnly = false; }
  pin.querySelectorAll('.tries i').forEach((d, k) => d.classList.toggle('used', k < s.tries));
  if (showHint(s)) { bubble.hidden = false; bubble.className = 'bubble'; bubble.innerHTML = `첫 글자 힌트: <b>${def.answer[0]}</b>${'□'.repeat(def.answer.length - 1)}`; }
  else if (s.status === 'out' && animate) { bubble.hidden = false; bubble.className = 'bubble reveal'; bubble.textContent = '정답을 보여 줄게요'; setTimeout(() => { bubble.hidden = true; }, 2600); }
  else bubble.hidden = true;
  if (animate && s.status === 'wrong') { pin.classList.remove('shake'); void pin.offsetWidth; pin.classList.add('shake'); input.select(); }
}

/* 채점: ids가 없으면 이 단계에서 글자를 쓴 모든 칸 */
function check(ids) {
  const st = STAGES[cur];
  const targets = ids || st.blanks.map(b => b.id);
  let graded = 0, ok = 0;
  for (const id of targets) {
    const def = st.blanks.find(b => b.id === id), input = pins[id].querySelector('input');
    const before = state.blanks[id];
    if (isDone(before) || !input.value.trim()) continue;
    const after = grade(before, def.answer, input.value);
    after.draft = after.status === 'wrong' ? input.value : undefined;
    state.blanks[id] = after; graded++; if (after.status === 'ok') ok++;
    paint(id, true);
  }
  if (!graded) { toast(ids ? '이름을 먼저 써 보세요.' : '빈칸에 이름을 먼저 써 보세요.'); return; }
  if (!ids) toast(ok === graded ? `${graded}칸 모두 정답!` : `${graded}칸 중 ${ok}칸 정답`);
  if (stageDone(st, state.blanks) && state.unlocked === cur && cur < STAGES.length - 1) state.unlocked = cur + 1;
  save(); buildTabs(); updateNext();
}

function updateNext() {
  const done = stageDone(STAGES[cur], state.blanks), btn = $('#nextBtn');
  btn.disabled = !done;
  btn.textContent = cur < STAGES.length - 1 ? `다음 단계: ${STAGES[cur + 1].tab} →` : '탐구 마치기';
}

$('#checkBtn').addEventListener('click', () => check(null));
$('#nextBtn').addEventListener('click', () => {
  if (cur < STAGES.length - 1) showStage(cur + 1);
  else {
    const all = STAGES.flatMap(s => s.blanks.map(b => state.blanks[b.id]));
    $('#doneScore').textContent = all.filter(b => b.status === 'ok').length;
    $('#done').hidden = false;
  }
});
$('#againBtn').addEventListener('click', () => { state = fresh(); save(); $('#done').hidden = true; showStage(0); });

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

/* 시작 화면 */
const hasProgress = Object.values(state.blanks).some(b => b.tries > 0 || b.status !== 'open');
$('#resumeBtn').hidden = !hasProgress;
$('#startBtn').addEventListener('click', () => { if (hasProgress) state = fresh(); save(); $('#gate').hidden = true; showStage(0); });
$('#resumeBtn').addEventListener('click', () => { $('#gate').hidden = true; showStage(Math.min(state.stage, state.unlocked)); });
showStage(0);

/* ================= 빈칸 점 · 점선 위치 ================= */
function place() {
  const sc = SCENES[cur], m = art.getScreenCTM(), sr = stageEl.getBoundingClientRect();
  if (!m) return;
  const pt = art.createSVGPoint();
  for (const id in pins) {
    pt.x = sc.anchors[id][0]; pt.y = sc.anchors[id][1];
    const q = pt.matrixTransform(m), x = q.x - sr.left, y = q.y - sr.top;
    markers[id].style.transform = `translate(${x}px, ${y}px)`;
    const r = pins[id].getBoundingClientRect(), right = pins[id].classList.contains('right');
    const px = (right ? r.left : r.right) - sr.left, py = r.top + r.height / 2 - sr.top;
    const l = lines[id];
    l.setAttribute('x1', px); l.setAttribute('y1', py); l.setAttribute('x2', x); l.setAttribute('y2', y);
  }
}
addEventListener('resize', place);

// 점검·테스트용
window.KIDNEY = { get state() { return state; }, showStage, check, SCENES };
document.fonts && document.fonts.ready.then(() => place());
