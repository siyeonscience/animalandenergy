/* 호흡 역학 탐구 — 화면 연결
   anatomy.js(3D 기관) + respiration.js(호흡 상태, 공통 애니메이션) + modes.js(모드) + airflow.js + labels.js */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAnatomy } from './anatomy.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyBreath, BreathState } from './respiration.js';
import { AutoMode, ManualMode, CameraMode } from './modes.js';
import { createAirflow } from './airflow.js';
import { createLabels } from './labels.js';

const $ = s => document.querySelector(s);
const view = $('#view');

/* ================= 3D 장면 ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1));   // 태블릿에서 부드럽게
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
const HOME = { pos: new THREE.Vector3(4.2, 1.2, 14.5), target: new THREE.Vector3(0, 0.1, 0) };
camera.position.copy(HOME.pos);

// 실제 조직처럼 보이도록 주변 반사광(환경광) + 조명
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.HemisphereLight(0xdfefff, 0x2a1c22, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(5, 8, 9); scene.add(key);
const rim = new THREE.DirectionalLight(0x9ccfff, 0.7); rim.position.set(-6, 3, -6); scene.add(rim);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(HOME.target);
controls.enablePan = false;
controls.enableDamping = true;
controls.minDistance = 8; controls.maxDistance = 24;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 2.3;
controls.update();

$('#loading').hidden = false;
let anatomy;
try { anatomy = await loadAnatomy('breathing/models/thorax.glb'); }
catch (e) { $('#loading').textContent = '3D 모형을 불러오지 못했어요. 새로고침해 주세요.'; throw e; }
$('#loading').hidden = true;
const { root, organs } = anatomy;
scene.add(root);
const airflow = createAirflow(anatomy.airwayPaths, anatomy.airflowArrowAt);
scene.add(airflow.group);

function fit() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // 세로로 긴 화면에서는 조금 멀리서 봐서 기관이 잘리지 않게
  camera.fov = w / h < 0.9 ? 44 : 32;
  camera.updateProjectionMatrix();
}
new ResizeObserver(fit).observe(view);
fit();

/* ================= 이름표 ================= */
const labels = createLabels($('#labels'), [
  { text: '기관', sub: '공기가 지나는 길', anchor: organs.airway.anchor, side: 'right' },
  { text: '오른쪽 폐', sub: '몸의 오른쪽', anchor: organs.lungRight.anchor, side: 'left' },
  { text: '왼쪽 폐', sub: '몸의 왼쪽', anchor: organs.lungLeft.anchor, side: 'right' },
  { text: '갈비뼈', sub: '흉곽', anchor: organs.ribcage.anchor, side: 'left' },
  { text: '가로막', sub: '횡격막 · 근육', anchor: organs.diaphragm.anchor, side: 'right' },
]);

/* ================= 모드 ================= */
const breath = new BreathState();
const modes = { auto: new AutoMode(), manual: new ManualMode(), camera: new CameraMode() };
let modeName = 'auto';
function setMode(name) {
  if (name === 'camera') { toast('📷 카메라 연동 모드는 다음 단계에서 추가될 예정이에요. 지금은 자동·수동 호흡으로 살펴보세요!'); return; }
  modeName = name;
  modes[name].start(breath.value);
  document.querySelectorAll('.mode').forEach(b => { const on = b.dataset.mode === name; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#autoPanel').hidden = name !== 'auto';
  $('#manualPanel').hidden = name !== 'manual';
  if (name === 'manual') setSlider(breath.value);
}
document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

// 자동 호흡: 빠르기, 멈추기
document.querySelectorAll('#autoPanel [data-period]').forEach(b => b.addEventListener('click', () => {
  const a = modes.auto, keep = a.t;
  a.period = +b.dataset.period; a.t = keep;
  $('#rateTxt').textContent = b.dataset.rate;
  document.querySelectorAll('#autoPanel [data-period]').forEach(x => x.classList.toggle('on', x === b));
}));
$('#pauseBtn').addEventListener('click', () => {
  const a = modes.auto; a.paused = !a.paused;
  $('#pauseBtn').textContent = a.paused ? '▶ 다시 숨쉬기' : '❚❚ 멈추기';
});

// 수동 호흡: 세로 슬라이더 (아래로 끌수록 들숨)
const slider = $('#slider'), track = slider.querySelector('.track');
function setSlider(v) {
  modes.manual.set(v);
  const pct = Math.round(modes.manual.value * 100);
  $('#sliderKnob').style.top = pct + '%';
  $('#sliderFill').style.height = pct + '%';
  slider.setAttribute('aria-valuenow', pct);
}
function sliderFrom(e) { const r = track.getBoundingClientRect(); setSlider((e.clientY - r.top) / r.height); }
track.addEventListener('pointerdown', e => { e.preventDefault(); track.setPointerCapture(e.pointerId); sliderFrom(e); track.onpointermove = sliderFrom; });
track.addEventListener('pointerup', () => { track.onpointermove = null; });
track.addEventListener('pointercancel', () => { track.onpointermove = null; });
slider.addEventListener('keydown', e => {
  const d = { ArrowDown: .05, ArrowUp: -.05, PageDown: .2, PageUp: -.2 }[e.key];
  if (d) { e.preventDefault(); setSlider(modes.manual.value + d); }
});

// 3D 화면의 가로막을 직접 위아래로 끌기 → 수동 호흡으로 바뀜
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  if (!ray.intersectObject(organs.diaphragm.mesh).length) return;
  if (modeName !== 'manual') { setMode('manual'); toast('✋ 수동 호흡: 가로막을 아래로 끌면 들숨, 위로 올리면 날숨이에요.'); }
  drag = { y: e.clientY, v: modes.manual.value, h: r.height };
  controls.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => { if (drag) setSlider(drag.v + (e.clientY - drag.y) / (drag.h * 0.35)); });
const endDrag = () => { if (drag) { drag = null; controls.enabled = true; } };
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
controls.addEventListener('start', () => { $('#hint').style.opacity = 0; });

/* ================= 이름표·초기화 ================= */
$('#labelsBtn').addEventListener('click', () => {
  labels.setVisible(!labels.visible);
  $('#labelsBtn').setAttribute('aria-pressed', labels.visible);
  $('#labelsBtn').textContent = labels.visible ? '이름표 켜짐' : '이름표 꺼짐';
});
let seeThrough = false;
$('#boneBtn').addEventListener('click', () => {
  seeThrough = !seeThrough; anatomy.setBonesSeeThrough(seeThrough);
  $('#boneBtn').setAttribute('aria-pressed', seeThrough);
  $('#boneBtn').textContent = seeThrough ? '뼈 투명 켜짐' : '뼈 투명하게';
});
$('#resetBtn').addEventListener('click', () => {
  camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update();
  breath.reset(); modes.auto.t = 0; modes.auto.paused = false; $('#pauseBtn').textContent = '❚❚ 멈추기';
  setSlider(0); setMode('auto');
  toast('처음 상태로 돌아왔어요.');
});

/* ================= 아래쪽 상태 표시 ================= */
const FACTS = {
  inhale: [['가로막', '수축 → 아래로 내려가며 평평해져요'], ['갈비뼈', '위쪽·바깥쪽으로 올라가요'],
           ['흉강 · 폐', '흉강 부피가 커지고 폐가 부풀어요'], ['공기', '몸 밖 → 폐 안으로 들어와요']],
  exhale: [['가로막', '이완 → 위로 올라가 둥근 지붕 모양이 돼요'], ['갈비뼈', '아래쪽·안쪽으로 돌아와요'],
           ['흉강 · 폐', '흉강 부피가 작아지고 폐가 줄어들어요'], ['공기', '폐 안 → 몸 밖으로 나가요']],
};
let shownDir = null;
function updateStatus() {
  const dir = breath.direction, moving = Math.abs(breath.velocity) > 0.04;
  if (dir !== shownDir) {
    shownDir = dir;
    const st = $('#state');
    st.className = 'state ' + dir;
    st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop');   // 바뀌는 순간 한 번만 톡
    $('#stateName').textContent = dir === 'inhale' ? '들숨' : '날숨';
    $('#facts').innerHTML = FACTS[dir].map(([k, v]) => `<li><b>${k}</b>${v}</li>`).join('');
  }
  $('#stateSub').textContent = moving ? (dir === 'inhale' ? '숨을 들이마시는 중' : '숨을 내쉬는 중') : '멈춤';
  $('#volBar').style.width = (45 + 55 * breath.value) + '%';
  $('#volTxt').textContent = breath.value > 0.66 ? '큼' : breath.value > 0.33 ? '중간' : '작음';
}

let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2800); }

/* ================= 반복 ================= */
let last = performance.now(), lastApplied = -1;
function frame(now) {
  // 실제 흐른 시간을 써요: 화면이 느리게 그려지는 기기에서도 호흡 빠르기가 그대로 유지되도록
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  const m = modes[modeName];
  breath.target = m.update(dt);
  const p = breath.update(dt, m.follow);
  if (Math.abs(p - lastApplied) > 1e-4) { applyBreath(organs, p); lastApplied = p; }
  airflow.update(dt, breath.velocity);
  controls.update();
  renderer.render(scene, camera);
  labels.update(camera, p, view.clientWidth, view.clientHeight);
  updateStatus();
  requestAnimationFrame(frame);
}
applyBreath(organs, 0); lastApplied = 0;
setMode('auto');
requestAnimationFrame(frame);

// 점검·테스트용
window.BREATH = { breath, organs, ribMesh: root.getObjectByName('rib_R_6'), modes, setMode, setSlider, camera, controls, get mode() { return modeName; } };
