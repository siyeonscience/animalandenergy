/* 콩팥 3D 해부 탐구 — 화면 연결
   1단계 배설 기관 전체(실제 해부 모형) → 2단계 콩팥 단면(같은 모형을 잘라서) → 3단계 네프론(직접 만든 3D 모형)
   빈칸 채점 규칙은 quiz.js */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { STAGES, freshBlank, grade, showHint, hintText, isDone, stageDone } from './quiz.js';
import { createNephron } from './nephron.js';
import { createFlow, centerline } from './flow.js';

const $ = s => document.querySelector(s);
const KEY = 'kidney-explorer-v1';
const view = $('#view'), stageEl = $('#stageEl'), overlay = $('#overlay'), leaders = $('#leaders');

/* ================= 3D 장면 ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));
renderer.localClippingEnabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
view.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a1c22, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(4, 8, 10); scene.add(key);
const rim = new THREE.DirectionalLight(0x9ccfff, 0.6); rim.position.set(-6, 3, -6); scene.add(rim);
const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false; controls.enableDamping = true;

const COL = { kidney: 0xb5524a, cortex: 0xc9675d, pyramid: 0x8f3a35, pelvis: 0xefcf8a, ureter: 0xe0b072, bladder: 0xe8a07a, vessel: 0xd68a8f };
const mat = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, ...o });

let geo;
try {
  const gltf = await new GLTFLoader().loadAsync('kidney/models/urinary.glb');
  geo = {}; gltf.scene.traverse(o => { if (o.isMesh) { o.geometry.computeVertexNormals(); geo[o.name] = o.geometry; } });
} catch (e) { $('#loading').textContent = '3D 모형을 불러오지 못했어요. 새로고침해 주세요.'; throw e; }
$('#loading').hidden = true;

/* ---------- 1단계: 배설 기관 전체 ---------- */
const organs = new THREE.Group();
const add = (g, name, color, o) => { const m = new THREE.Mesh(geo[name], mat(color, o)); m.name = name; g.add(m); return m; };
['capsule_L', 'capsule_R'].forEach(n => add(organs, n, COL.kidney));
['ureter_L', 'ureter_R'].forEach(n => add(organs, n, COL.ureter));
add(organs, 'bladder', COL.bladder); add(organs, 'urethra', COL.bladder);
['aorta', 'ivc', 'artery_L', 'artery_R', 'vein_L', 'vein_R'].forEach(n => add(organs, n, COL.vessel));
const ARROW = { size: 0.011, count: 4, speed: 0.3 }, URINE = { shape: 'dot', color: 0xfff3bf, size: 0.006, count: 6, speed: 0.25 };
const flows1 = [
  createFlow(centerline(geo.aorta, 'y', 10, { reverse: true }), ARROW),
  createFlow(centerline(geo.ivc, 'y', 10), ARROW),
  createFlow(centerline(geo.artery_L, 'x', 6, { filter: v => v.x > 0.012 && v.x < 0.046 }), { ...ARROW, count: 2 }),
  createFlow(centerline(geo.artery_R, 'x', 6, { filter: v => v.x < -0.012 && v.x > -0.042, reverse: true }), { ...ARROW, count: 2 }),
  createFlow(centerline(geo.vein_L, 'x', 6, { filter: v => v.x > 0.002 && v.x < 0.046, reverse: true }), { ...ARROW, count: 2 }),
  createFlow(centerline(geo.vein_R, 'x', 6, { filter: v => v.x < -0.012 && v.x > -0.042 }), { ...ARROW, count: 2 }),
  createFlow(centerline(geo.ureter_L, 'y', 12, { reverse: true }), URINE),
  createFlow(centerline(geo.ureter_R, 'y', 12, { reverse: true }), URINE),
];
flows1.forEach(f => organs.add(f.group));
const S1 = 10;
organs.scale.setScalar(S1); organs.position.set(0, -0.985 * S1, -0.05 * S1);
const ureterMid = centerline(geo.ureter_L, 'y', 12)[5];
const anchors1 = {
  kidney: new THREE.Vector3(-0.082, 1.10, 0.045),
  ureter: ureterMid.clone().add(new THREE.Vector3(0, 0, 0.004)),
  bladder: new THREE.Vector3(0.018, 0.862, 0.09),
  urethra: new THREE.Vector3(0, 0.79, 0.12),
};

/* 조건에 맞는 삼각형만 남긴 새 형상 (오줌관 윗부분만 쓰기 등) */
function subset(g, keep) {
  const pos = g.attributes.position, idx = g.index.array, v = new THREE.Vector3(), ok = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) ok[i] = keep(v.fromBufferAttribute(pos, i)) ? 1 : 0;
  const out = [];
  for (let t = 0; t < idx.length; t += 3) if (ok[idx[t]] && ok[idx[t + 1]] && ok[idx[t + 2]]) out.push(idx[t], idx[t + 1], idx[t + 2]);
  // 쓰는 꼭짓점만 남겨서 새로 만들어요 (경계 상자가 잘린 모양에 맞도록)
  const map = new Map(), P = [];
  const idx2 = out.map(i => { if (!map.has(i)) { map.set(i, P.length / 3); P.push(pos.getX(i), pos.getY(i), pos.getZ(i)); } return map.get(i); });
  const n = new THREE.BufferGeometry();
  n.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); n.setIndex(idx2); n.computeVertexNormals();
  return n;
}
geo.ureterTop_L = subset(geo.ureter_L, v => v.y > 1.035);

/* ---------- 2단계: 콩팥 단면 (몸의 왼쪽 콩팥을 앞뒤로 잘라서) ---------- */
const section = new THREE.Group();
const S2 = 34, C2 = new THREE.Vector3(0.042, 1.112, 0.03);
section.scale.setScalar(S2); section.position.copy(C2).multiplyScalar(-S2);
const ZCUT = 0.026, XHILUM = 0.048;
const w = v => v.clone().sub(C2).multiplyScalar(S2);           // 모형 좌표 → 장면 좌표
const cutFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), w(new THREE.Vector3(0, 0, ZCUT)).z);
const cutLateral = new THREE.Plane(new THREE.Vector3(-1, 0, 0), w(new THREE.Vector3(XHILUM, 0, 0)).x);
function addCut(name, color, cutColor, { inter = false } = {}) {
  const planes = inter ? [cutFront, cutLateral] : [cutFront];
  const front = new THREE.Mesh(geo[name], mat(color, { clippingPlanes: planes, clipIntersection: inter, clipShadows: true }));
  const back = new THREE.Mesh(geo[name], new THREE.MeshBasicMaterial({ color: cutColor, side: THREE.BackSide, clippingPlanes: planes, clipIntersection: inter }));
  section.add(front, back);
}
addCut('cortex_L', COL.cortex, 0xb5574e);
addCut('pyramids_L', COL.pyramid, 0x7e2e2c);
addCut('pelvis_L', COL.pelvis, 0xe2bd72);
addCut('artery_L', COL.vessel, 0xc87a80, { inter: true });
addCut('vein_L', COL.vessel, 0xc87a80, { inter: true });
addCut('ureterTop_L', COL.ureter, 0xd2a25e, { inter: true });
const nephronSpot = new THREE.Vector3(0.087, 1.132, ZCUT + 0.0005);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.0042, 0.0056, 40), new THREE.MeshBasicMaterial({ color: 0xffd43b, side: THREE.DoubleSide }));
ring.position.copy(nephronSpot); section.add(ring);
const arteryLine = centerline(geo.artery_L, 'x', 6, { filter: v => v.x > 0.012 && v.x < XHILUM });
const veinLine = centerline(geo.vein_L, 'x', 6, { filter: v => v.x > 0.002 && v.x < XHILUM, reverse: true });
const ureterLine = centerline(geo.ureter_L, 'y', 8, { reverse: true, filter: v => v.y > 1.035 });
const flows2 = [
  createFlow(arteryLine, { size: 0.005, count: 3, speed: 0.3 }),
  createFlow(veinLine, { size: 0.005, count: 3, speed: 0.3 }),
  createFlow(ureterLine, { shape: 'dot', color: 0xfff3bf, size: 0.004, count: 6, speed: 0.2 }),
];
flows2.forEach(f => section.add(f.group));
const anchors2 = {
  artery: arteryLine[Math.floor(arteryLine.length * 0.75)].clone(),
  vein: veinLine[Math.floor(veinLine.length * 0.8)].clone(),
  ureter2: ureterLine[Math.min(ureterLine.length - 1, 5)].clone(),
  nephron: nephronSpot.clone(),
};

/* ---------- 3단계: 네프론 ---------- */
const nephron = createNephron();
const anchors3 = Object.fromEntries(Object.entries(nephron.anchors).map(([k, f]) => [k, f()]));
const tags3 = nephron.labels.map(l => ({ text: l.text, at: l.at() }));

[organs, section, nephron.group].forEach(g => scene.add(g));
const SCENES = [
  { group: organs, anchors: anchors1, toWorld: v => organs.localToWorld(v.clone()), flows: flows1, view: { elev: 0.05, left: 250, right: 250, fill: 0.92 },
    slots: { kidney: ['left', 0.24], ureter: ['right', 0.40], bladder: ['right', 0.66], urethra: ['left', 0.78] } },
  { group: section, anchors: anchors2, toWorld: v => section.localToWorld(v.clone()), flows: flows2, view: { elev: 0.02, left: 250, right: 250, fill: 0.9 },
    slots: { artery: ['right', 0.22], vein: ['right', 0.42], ureter2: ['right', 0.74], nephron: ['left', 0.24] } },
  { group: nephron.group, anchors: anchors3, tags: tags3, toWorld: v => nephron.group.localToWorld(v.clone()), flows: [nephron], view: { elev: 0.0, left: 270, right: 10, fill: 0.95 },
    slots: { tori: ['left', 0.14], capillary: ['left', 0.36], bowman: ['left', 0.60], tubule: ['left', 0.86] } },
];

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
let cur = -1, pins = {}, markers = {}, lines = {}, tags = [];
function fit() {
  const W = view.clientWidth, H = view.clientHeight;
  renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
}
new ResizeObserver(() => { fit(); if (cur >= 0) homeCamera(); }).observe(view);
fit();

function homeCamera() {
  const sc = SCENES[cur];
  // 왼쪽·오른쪽 이름 칸 자리를 비우고 가운데에 모형이 꽉 차도록
  const rot = sc.group.rotation.y; sc.group.rotation.y = 0; sc.group.updateMatrixWorld(true);
  const box = new THREE.Box3();
  sc.group.children.forEach(c => { if (c.name !== 'flow') box.expandByObject(c); });
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  sc.group.rotation.y = rot;
  const W = view.clientWidth || 800, H = view.clientHeight || 600, vw = sc.view;
  const narrow = W < 700, padL = narrow ? 0 : vw.left, padR = narrow ? 0 : vw.right, usable = Math.max(200, W - padL - padR);
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const distH = size.y / 2 / tanV / vw.fill, distW = size.x / 2 / (tanV * usable / H) / vw.fill;
  const dist = Math.max(distH, distW) + size.z / 2;
  const perPx = 2 * dist * tanV / H, shift = (padL - padR) / 2 * perPx;
  controls.target.copy(center).add(new THREE.Vector3(-shift, 0, 0));
  camera.position.copy(controls.target).add(new THREE.Vector3(0, dist * vw.elev, dist));
  controls.minDistance = dist * 0.35; controls.maxDistance = dist * 2;
  controls.update();
}

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
  SCENES.forEach((s, k) => { s.group.visible = k === i; });
  const st = STAGES[i];
  $('#stageTitle').textContent = st.title;
  overlay.innerHTML = ''; leaders.innerHTML = ''; pins = {}; markers = {}; lines = {}; tags = [];
  (SCENES[i].tags || []).forEach(t => { const el = document.createElement('span'); el.className = 'tag3d'; el.textContent = t.text; overlay.appendChild(el); tags.push({ el, at: t.at }); });
  st.blanks.forEach((b, k) => {
    const [side, top] = SCENES[i].slots[b.id];
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
  buildTabs(); updateNext(); homeCamera();
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
$('#homeBtn').addEventListener('click', homeCamera);
$('#againBtn').addEventListener('click', () => { state = fresh(); save(); $('#done').hidden = true; showStage(0); });

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

/* 시작 화면 */
const hasProgress = Object.values(state.blanks).some(b => b.tries > 0 || b.status !== 'open');
$('#resumeBtn').hidden = !hasProgress;
$('#startBtn').addEventListener('click', () => { if (hasProgress) state = fresh(); save(); $('#gate').hidden = true; showStage(0); });
$('#resumeBtn').addEventListener('click', () => { $('#gate').hidden = true; showStage(Math.min(state.stage, state.unlocked)); });
showStage(0);

/* ================= 반복 ================= */
const v = new THREE.Vector3();
let last = performance.now();
function frame(now) {
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;
  const sc = SCENES[cur];
  sc.flows.forEach(f => f.update(dt));
  ring.scale.setScalar(1 + 0.15 * Math.sin(now / 300));
  if ($('#gate').hidden === false) { sc.group.rotation.y += dt * 0.25; } else sc.group.rotation.y *= 0.9;
  controls.update();
  renderer.render(scene, camera);
  // 번호 표시와 점선 위치
  const W = view.clientWidth, H = view.clientHeight, sr = stageEl.getBoundingClientRect();
  for (const id in pins) {
    v.copy(sc.toWorld(sc.anchors[id])).project(camera);
    const x = (v.x + 1) / 2 * W, y = (1 - v.y) / 2 * H;
    markers[id].style.transform = `translate(${x}px, ${y}px)`;
    const r = pins[id].getBoundingClientRect(), right = pins[id].classList.contains('right');
    const px = (right ? r.left : r.right) - sr.left, py = r.top + r.height / 2 - sr.top;
    const l = lines[id];
    l.setAttribute('x1', px); l.setAttribute('y1', py); l.setAttribute('x2', x); l.setAttribute('y2', y);
  }
  for (const t of tags) { v.copy(sc.toWorld(t.at)).project(camera); t.el.style.transform = `translate(${(v.x + 1) / 2 * W - 18}px, ${(1 - v.y) / 2 * H - 14}px) translateX(-100%)`; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 점검·테스트용
window.KIDNEY = { get state() { return state; }, showStage, check, camera, controls, SCENES };
