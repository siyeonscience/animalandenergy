/* 호흡운동의 원리 — 화면 연결
   anatomy.js(3D 기관) + respiration.js(호흡 상태, 공통 애니메이션) + modes.js(모드) + airflow.js + labels.js */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAnatomy } from './anatomy.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyBreath, BreathState } from './respiration.js';
import { AutoMode, ManualMode, CameraMode, BalloonMode } from './modes.js';
import { createBalloonModel } from './balloon/model.js';
import { createAirflow } from './airflow.js';
import { createLabels } from './labels.js';
import { createCameraController } from './camera/controller.js';

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
// 풍선 모형 (풍선 모형 보기 모드에서만 보여요)
const balloon = createBalloonModel();
balloon.group.visible = false;
scene.add(balloon.group);

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
// 이름표 위치는 모형 전체의 이동·크기(카메라 모드에서 사람 몸에 맞출 때)도 따라가요. 평소에는 변화 없음
const onRoot = fn => p => fn(p).applyMatrix4(root.matrixWorld);
const labels = createLabels($('#labels'), [
  { text: '기관', sub: '공기가 지나는 길', anchor: onRoot(organs.airway.anchor), side: 'right' },
  { text: '오른쪽 폐', sub: '몸의 오른쪽', anchor: onRoot(organs.lungRight.anchor), side: 'left' },
  { text: '왼쪽 폐', sub: '몸의 왼쪽', anchor: onRoot(organs.lungLeft.anchor), side: 'right' },
  { text: '갈비뼈', sub: '흉곽', anchor: onRoot(organs.ribcage.anchor), side: 'left' },
  { text: '가로막', sub: '횡격막 · 근육', anchor: onRoot(organs.diaphragm.anchor), side: 'right' },
]);
// 풍선 모형 이름표: 모형의 각 부분이 우리 몸의 무엇에 해당하는지
const bLabels = createLabels($('#labels'), [
  { text: 'Y자 유리관', sub: '= 기관 · 기관지', anchor: balloon.anchors.tube, side: 'right' },
  { text: '고무풍선', sub: '= 폐', anchor: balloon.anchors.balloon, side: 'left' },
  { text: '병 속 공간', sub: '= 흉강', anchor: balloon.anchors.jar, side: 'right' },
  { text: '고무막', sub: '= 가로막', anchor: balloon.anchors.membrane, side: 'right' },
]);
bLabels.setVisible(false);
let labelsOn = true;

/* ================= 모드 ================= */
const breath = new BreathState();
const modes = { auto: new AutoMode(), manual: new ManualMode(), camera: new CameraMode(), balloon: new BalloonMode() };
let modeName = 'auto';
let cam = null;   // 카메라 연동 (아래에서 만듦)
const BALLOON_VIEW = { pos: new THREE.Vector3(3.2, -2.4, 20), target: new THREE.Vector3(0, -0.6, 0) };   // 살짝 아래에서: 당겨진 고무막이 보이게
/* 풍선 모형 ↔ 인체 모형 바꾸기 */
function showBalloon(on) {
  if (balloon.group.visible === on) return;
  balloon.group.visible = on;
  root.visible = !on; airflow.group.visible = !on;
  labels.setVisible(labelsOn && !on); bLabels.setVisible(labelsOn && on);
  $('#boneBtn').hidden = on;
  $('#volLabel').textContent = on ? '병 속 부피' : '흉강 부피';
  const v = on ? BALLOON_VIEW : HOME;
  camera.position.copy(v.pos); controls.target.copy(v.target);
  if (on && camera.aspect < 0.9) camera.position.sub(v.target).multiplyScalar(1.4).add(v.target);   // 세로 화면: 조금 더 멀리서
  controls.update();
  shownDir = null;                                   // 아래 설명을 모형에 맞게 다시 쓰기
  if (!on) lastApplied = -1;                         // 인체 모형을 지금 호흡 상태로 다시 맞추기
}
function setMode(name) {
  if (modeName === 'camera' && name !== 'camera') cam?.deactivate();   // 카메라 모드를 나가면 카메라를 완전히 끔
  if (name !== 'balloon') showBalloon(false);
  modeName = name;
  modes[name].start(breath.value);
  document.querySelectorAll('.mode').forEach(b => { const on = b.dataset.mode === name; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  $('#autoPanel').hidden = name !== 'auto';
  $('#manualPanel').hidden = name !== 'manual';
  $('#balloonPanel').hidden = name !== 'balloon';
  if (name === 'manual') setSlider(breath.value);
  if (name === 'camera') cam?.activate();
  if (name === 'balloon') { showBalloon(true); setBSlider(breath.value); toast('🎈 고무막을 아래로 잡아당기면 고무풍선이 부풀어요. 위로 밀어 올리면 줄어들어요.'); }
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

// 풍선 모형: 고무막 슬라이더 (아래로 끌수록 잡아당김 = 들숨)
const bSlider = $('#bSlider'), bTrack = bSlider.querySelector('.track');
function setBSlider(v) {
  modes.balloon.set(v);
  showBSlider(modes.balloon.value);
}
function showBSlider(v) {
  const pct = Math.round(v * 100);
  $('#bSliderKnob').style.top = pct + '%'; $('#bSliderFill').style.height = pct + '%';
  bSlider.setAttribute('aria-valuenow', pct);
}
function stopBAuto() { if (modes.balloon.auto) { modes.balloon.auto = false; $('#bAutoBtn').setAttribute('aria-pressed', false); $('#bAutoBtn').textContent = '▶ 자동으로 움직이기'; } }
function bSliderFrom(e) { const r = bTrack.getBoundingClientRect(); stopBAuto(); setBSlider((e.clientY - r.top) / r.height); }
bTrack.addEventListener('pointerdown', e => { e.preventDefault(); bTrack.setPointerCapture(e.pointerId); bSliderFrom(e); bTrack.onpointermove = bSliderFrom; });
bTrack.addEventListener('pointerup', () => { bTrack.onpointermove = null; });
bTrack.addEventListener('pointercancel', () => { bTrack.onpointermove = null; });
bSlider.addEventListener('keydown', e => {
  const d = { ArrowDown: .05, ArrowUp: -.05, PageDown: .2, PageUp: -.2 }[e.key];
  if (d) { e.preventDefault(); stopBAuto(); setBSlider(modes.balloon.value + d); }
});
$('#bAutoBtn').addEventListener('click', () => {
  const b = modes.balloon; b.auto = !b.auto;
  if (b.auto) b.t = b.value >= 0.5 ? 0.45 : 0;        // 지금 위치에서 자연스럽게 이어서
  $('#bAutoBtn').setAttribute('aria-pressed', b.auto);
  $('#bAutoBtn').textContent = b.auto ? '❚❚ 자동 멈추기' : '▶ 자동으로 움직이기';
});

// 3D 화면의 가로막을 직접 위아래로 끌기 → 수동 호흡으로 바뀜
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
/* 손가락 아래에서 '가장 앞에 보이는 것'이 가로막일 때만 끌 수 있어요.
   폐·심장, 그리고 불투명한 뼈가 앞에 있으면 그 뒤의 가로막은 잡히지 않아요. (뼈 투명 모드에서는 뼈를 통과) */
let seeThrough = false;
const BONE = /^(rib|cart|manub|stern|xiph|spine|clav)/;
const pickables = [];
root.traverse(o => { if (o.isMesh && !o.name.endsWith('_depth')) pickables.push(o); });
/* 풍선 모형에서는 고무막(또는 손잡이)을 잡아요. 유리병은 투명해서 통과 */
function membraneUnder(e) {
  if (!balloon.group.visible) return false;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  balloon.group.updateMatrixWorld();
  return ray.intersectObjects([balloon.membrane, balloon.knob, balloon.grab], true).length > 0;
}
function diaphragmUnder(e) {
  if (balloon.group.visible) return false;
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickables.filter(o => !(seeThrough && BONE.test(o.name))), false)[0];
  return hit && hit.object === organs.diaphragm.mesh;
}
// 가로막 위에 올리면 손 모양 + 살짝 빛나서 '잡을 수 있다'는 걸 알려줘요
let hoverT = 0;
renderer.domElement.addEventListener('pointermove', e => {
  if (drag || e.pointerType === 'touch' || performance.now() - hoverT < 60) return;
  hoverT = performance.now();
  if (balloon.group.visible) { const onM = membraneUnder(e); renderer.domElement.style.cursor = onM ? 'grab' : ''; balloon.membrane.material.emissive.setHex(onM ? 0x331018 : 0); return; }
  const on = diaphragmUnder(e);
  renderer.domElement.style.cursor = on ? 'grab' : '';
  organs.diaphragm.mesh.material.emissive.setHex(on ? 0x331010 : 0x000000);
});
let drag = null;
renderer.domElement.addEventListener('pointerdown', e => {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  if (membraneUnder(e)) {                                // 풍선 모형: 고무막 끌기
    stopBAuto();
    drag = { y: e.clientY, v: modes.balloon.value, h: r.height, balloon: true };
    controls.enabled = false; renderer.domElement.setPointerCapture(e.pointerId); return;
  }
  if (!diaphragmUnder(e)) return;
  if (modeName !== 'manual') { setMode('manual'); toast('✋ 수동 호흡: 가로막을 아래로 끌면 들숨, 위로 올리면 날숨이에요.'); }
  drag = { y: e.clientY, v: modes.manual.value, h: r.height };
  controls.enabled = false;
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => { if (!drag) return; const v = drag.v + (e.clientY - drag.y) / (drag.h * 0.35); drag.balloon ? setBSlider(v) : setSlider(v); });
const endDrag = () => { if (drag) { drag = null; controls.enabled = true; } };
renderer.domElement.addEventListener('pointerup', endDrag);
renderer.domElement.addEventListener('pointercancel', endDrag);
controls.addEventListener('start', () => { $('#hint').style.opacity = 0; });

/* ================= 이름표·초기화 ================= */
$('#labelsBtn').addEventListener('click', () => {
  labelsOn = !labelsOn;
  labels.setVisible(labelsOn && !balloon.group.visible); bLabels.setVisible(labelsOn && balloon.group.visible);
  $('#labelsBtn').setAttribute('aria-pressed', labelsOn);
  $('#labelsBtn').textContent = labelsOn ? '이름표 켜짐' : '이름표 꺼짐';
});
$('#boneBtn').addEventListener('click', () => {
  seeThrough = !seeThrough; anatomy.setBonesSeeThrough(seeThrough);
  $('#boneBtn').setAttribute('aria-pressed', seeThrough);
  $('#boneBtn').textContent = seeThrough ? '뼈 투명 켜짐' : '뼈 투명하게';
});
$('#resetBtn').addEventListener('click', () => {
  camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update();
  breath.reset(); modes.auto.t = 0; modes.auto.paused = false; $('#pauseBtn').textContent = '❚❚ 멈추기';
  setSlider(0); setBSlider(0); stopBAuto(); setMode('auto');
  toast('처음 상태로 돌아왔어요.');
});

/* ================= 아래쪽 상태 표시 ================= */
const FACTS = {
  inhale: [['가로막', '수축 → 아래로 내려가며 평평해져요'], ['갈비뼈', '위쪽·바깥쪽으로 올라가요'],
           ['흉강 · 폐', '흉강 부피가 커지고 폐가 부풀어요'], ['공기', '몸 밖 → 폐 안으로 들어와요']],
  exhale: [['가로막', '이완 → 위로 올라가 둥근 지붕 모양이 돼요'], ['갈비뼈', '아래쪽·안쪽으로 돌아와요'],
           ['흉강 · 폐', '흉강 부피가 작아지고 폐가 줄어들어요'], ['공기', '폐 안 → 몸 밖으로 나가요']],
};
// 풍선 모형일 때의 설명 (모형의 각 부분 = 우리 몸의 무엇)
const BFACTS = {
  inhale: [['고무막 (가로막)', '아래로 잡아당겨져요'], ['병 속 공간 (흉강)', '부피가 커지고 압력이 낮아져요'],
           ['고무풍선 (폐)', '부풀어요'], ['공기', '바깥 → 유리관 → 고무풍선 안으로']],
  exhale: [['고무막 (가로막)', '위로 올라가요'], ['병 속 공간 (흉강)', '부피가 작아지고 압력이 높아져요'],
           ['고무풍선 (폐)', '줄어들어요'], ['공기', '고무풍선 안 → 유리관 → 바깥으로']],
};
var shownDir = null;
function updateStatus() {
  const dir = breath.direction, moving = Math.abs(breath.velocity) > 0.04;
  if (dir !== shownDir) {
    shownDir = dir;
    const st = $('#state');
    st.className = 'state ' + dir;
    st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop');   // 바뀌는 순간 한 번만 톡
    $('#stateName').textContent = dir === 'inhale' ? '들숨' : '날숨';
    $('#facts').innerHTML = (balloon.group.visible ? BFACTS : FACTS)[dir].map(([k, v]) => `<li><b>${k}</b>${v}</li>`).join('');
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
  if (balloon.group.visible) {                       // 풍선 모형: 인체 모형은 쉬고 풍선 모형만 움직여요
    balloon.setBreath(p); balloon.update(dt, breath.velocity);
    if (modes.balloon.auto) showBSlider(modes.balloon.value);
  } else {
    if (Math.abs(p - lastApplied) > 1e-4) { applyBreath(organs, p); lastApplied = p; }
    airflow.update(dt, breath.velocity);
  }
  if (modeName === 'camera') cam.frame(dt);
  controls.update();
  renderer.render(scene, camera);
  labels.update(camera, p, view.clientWidth, view.clientHeight);
  bLabels.update(camera, p, view.clientWidth, view.clientHeight);
  updateStatus();
  requestAnimationFrame(frame);
}
applyBreath(organs, 0); lastApplied = 0;
cam = createCameraController({ view, root, camera, controls, home: HOME, mode: modes.camera, breath,
  onFallback: name => setMode(name), toast });
setMode('auto');
requestAnimationFrame(frame);

// 점검·테스트용
window.BREATH = { get cam() { return cam; }, balloon, setBSlider, membraneUnder, breath, organs, diaphragmUnder, ribMesh: root.getObjectByName('rib_R_6'), modes, setMode, setSlider, camera, controls, get mode() { return modeName; } };
