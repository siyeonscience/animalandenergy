/* 카메라 연동 모드 전체 흐름 (입 모양은 쓰지 않아요)
   시작 버튼 → 전면 카메라 → 인식 모델 → 어깨 기준 위치 2초 측정 → 인식 시작
   1순위 어깨: 올라감 → 들숨, 내려감 → 날숨
   2순위 손: 상체 옆으로 손을 올리면 손으로 전환 — 주먹 → 가로막 내려감(들숨), 손바닥 → 가로막 올라감(날숨),
             브이 등 손바닥이 가려진 모양 → "인식할 수 없습니다."
   인식 결과는 modes.camera(CameraMode)의 목표값으로만 넘기고, 실제 움직임은 기존 breathPhase·applyBreath가 그대로 해요.
   카메라 분석(이 파일)과 3D 렌더링(main.js)은 따로 돌아가요. */
import { CAMERA_CONFIG as CFG } from './config.js';
import { openFrontCamera, closeCamera, cameraErrorMessage } from './stream.js';
import { loadVision } from './mediapipe.js';
import { ShoulderTracker } from './shoulders.js';
import { HandTracker } from './hand.js';
import { fuse, METHOD } from './fusion.js';
import { createAligner } from './align.js';

const STATUS_KEY = 'breath.camStatus';
const SHAPE_TEXT = { fist: '주먹 → 가로막 내려감', open: '손바닥 → 가로막 올라감', unknown: '인식할 수 없음', none: '-' };

export function createCameraController({ view, root, camera, controls, home, mode, breath, onFallback, toast }) {
  const $ = s => document.querySelector(s);
  const video = $('#camVideo'), panel = $('#cameraPanel'), guide = $('#camGuide'), statusEl = $('#camStatus'), notice = $('#camNotice');
  const shoulder = new ShoulderTracker({ ...CFG.shoulder, baselineMs: CFG.baselineMs });
  const hand = new HandTracker(CFG.hand);
  const aligner = createAligner(root, CFG.align);
  const fused = { target: null, method: METHOD.NONE, unknownHand: false };
  mode.inhaleSec = CFG.inhaleSec; mode.exhaleSec = CFG.exhaleSec;

  let stream = null, vision = null, token = 0, phase = 'idle', loopId = 0;
  let camState = '꺼짐';
  let lastPose = 0, lastHand = 0, lastTs = 0, cost = 0, poseEvery = 1000 / CFG.poseHz, handEvery = 1000 / CFG.handHz;
  let noneSince = -1, lastStatus = 0, failCount = 0, lastMethod = '';
  let statusOn = loadStatusPref();

  /* ---------- 화면 ---------- */
  function setPanel() {
    const on = phase !== 'idle' && phase !== 'error';
    $('#camStartBtn').hidden = on;
    $('#camStopBtn').hidden = !on;
    $('#camRecalBtn').hidden = phase !== 'running';
    $('#camStatusBtn').setAttribute('aria-pressed', statusOn);
    $('#camStatusBtn').textContent = statusOn ? '인식 정보 숨기기' : '인식 정보 보기';
    statusEl.hidden = !statusOn;
    document.body.classList.toggle('cam-on', !!stream);
  }
  function showGuide(title, sub = '', { progress = null, buttons = [] } = {}) {
    guide.hidden = false;
    guide.querySelector('.g-title').textContent = title;
    guide.querySelector('.g-sub').textContent = sub;
    const bar = guide.querySelector('.g-bar');
    bar.hidden = progress === null;
    if (progress !== null) bar.firstElementChild.style.width = Math.round(progress * 100) + '%';
    const box = guide.querySelector('.g-btns');
    const key = buttons.map(b => b[0]).join('|');
    if (box.dataset.key !== key) {
      box.dataset.key = key; box.innerHTML = '';
      for (const [label, fn] of buttons) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; box.appendChild(b); }
    }
  }
  function hideGuide() { guide.hidden = true; }
  function setNotice(on) { if (notice.hidden === on) notice.hidden = !on; }
  const fallbackButtons = [['⟳ 자동 호흡으로', () => onFallback('auto')], ['✋ 수동 호흡으로', () => onFallback('manual')]];

  function fail(msg) {
    phase = 'error';
    stopStream();
    camState = '꺼짐';
    aligner.reset(); frontView(false);          // 모형·시점을 원래대로
    setNotice(false);
    showGuide('카메라 연동을 쓸 수 없어요', msg, { buttons: [['다시 시도', () => start()], ...fallbackButtons] });
    setPanel(); updateStatus(true);
  }

  /* ---------- 시작 / 종료 ---------- */
  async function start() {
    const my = ++token;
    phase = 'loading'; camState = '연결 중'; setPanel(); updateStatus(true);
    showGuide('카메라를 켜는 중…', '카메라 사용을 묻는 창이 나오면 "허용"을 눌러 주세요.');
    try { stream = await openFrontCamera(video); }
    catch (e) { if (my === token) fail(cameraErrorMessage(e)); return; }
    if (my !== token) { closeCamera(stream, video); stream = null; return; }
    camState = '연결됨';
    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => { if (my === token) fail('카메라 연결이 끊겼어요. 다시 시도하거나 다른 모드를 써 주세요.'); });
    setPanel(); frontView(true);
    try { vision = await loadVision(msg => my === token && showGuide(msg, '처음 한 번은 조금 걸릴 수 있어요.')); }
    catch (e) { console.error(e); if (my === token) fail('인식 모델을 불러오지 못했어요. ' + (e.name === 'NoSimd' ? e.message : '인터넷 연결을 확인하고 다시 시도해 주세요.')); return; }
    if (my !== token) return;
    beginBaseline();
    loop(my);
  }

  function stopStream() {
    loopId++;
    if (stream) closeCamera(stream, video);
    stream = null;
    document.body.classList.remove('cam-on');
  }

  function stop() {
    token++;
    stopStream();
    phase = 'idle'; camState = '꺼짐';
    shoulder.reset(); hand.reset(); aligner.reset();
    frontView(false); hideGuide(); setNotice(false);
    setPanel(); updateStatus(true);
  }

  /* 카메라 모드에서는 정면에서 보는 고정 시점(영상과 겹치도록), 끝나면 원래 시점 */
  function frontView(on) {
    if (on) {
      controls.enabled = false;
      camera.position.set(0, 0, 15); controls.target.set(0, 0, 0); camera.lookAt(0, 0, 0);
    } else {
      controls.enabled = true;
      camera.position.copy(home.pos); controls.target.copy(home.target); controls.update();
    }
    swapLabelSides(on);
  }
  // 모형을 거울처럼 뒤집으면 이름표의 글자 방향도 바꿔 줘요
  let swapped = false;
  function swapLabelSides(on) {
    if (on === swapped) return; swapped = on;
    document.querySelectorAll('#labels .olabel').forEach(el => {
      const l = el.classList.contains('left');
      el.classList.toggle('left', !l); el.classList.toggle('right', l);
    });
  }

  /* ---------- 어깨 기준 위치 측정 (2초) ---------- */
  let baseStart = 0;
  function beginBaseline() {
    shoulder.reset(); shoulder.startBaseline(); hand.reset();
    phase = 'baseline'; baseStart = performance.now(); setNotice(false);
    setPanel();
  }
  function baselineStep(now) {
    const prog = shoulder.baseStart > 0 ? Math.min(1, (now - shoulder.baseStart) / CFG.baselineMs) : 0;
    showGuide('정면을 보고 편하게 서 주세요', shoulder.seen ? '어깨 기준 위치를 재고 있어요… 움직이지 말고 그대로 있어요' : '어깨가 화면에 보이게 조금 뒤로 서 주세요', { progress: prog });
    if (shoulder.baseReady) {
      phase = 'running'; hideGuide(); setPanel();
      toast('준비 완료! 어깨를 올리면 들숨, 내리면 날숨이에요. 손을 옆으로 올리면 손으로 바뀌어요.');
    } else if (now - baseStart > CFG.baselineMs + 6000) {
      // 어깨를 못 찾아도 손(2순위)으로는 쓸 수 있게 시작
      phase = 'running'; hideGuide(); setPanel();
      toast('어깨를 찾지 못했어요. 상체가 보이게 서거나, 손을 옆으로 올려 손으로 조작해 보세요.');
    }
  }

  /* ---------- 분석 반복 (영상 새 프레임마다 모델 하나만) ---------- */
  function loop(my) {
    const id = ++loopId;
    const useVFC = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
    const next = () => { if (id !== loopId || my !== token) return; useVFC ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick); };
    function tick() {
      if (id !== loopId || my !== token) return;
      try { analyze(performance.now()); failCount = 0; }
      catch (e) {
        console.error(e);
        if (++failCount > 10) { fail('인식 중 오류가 계속 생겨요. 다시 시도하거나 다른 모드를 써 주세요.'); return; }
      }
      next();
    }
    next();
  }

  function analyze(now) {
    if (!vision || !stream || video.readyState < 2 || !video.videoWidth) return;
    const aspect = video.videoWidth / video.videoHeight;
    const onlyPose = phase === 'baseline';                  // 기준 잴 때는 어깨만
    const poseDue = now - lastPose >= poseEvery, handDue = !onlyPose && now - lastHand >= handEvery;
    if (!poseDue && !handDue) return;
    // 둘 다 할 때가 되면 더 오래 기다린 쪽부터 — 한 프레임에 하나만 해서 부담을 나눠요
    const doPose = poseDue && (!handDue || (now - lastPose) / poseEvery >= (now - lastHand) / handEvery);
    const ts = lastTs = Math.max(lastTs + 1, Math.round(now));
    const t0 = performance.now();
    if (doPose) {
      const dt = Math.min(1.5, (now - (lastPose || now)) / 1000); lastPose = now;
      shoulder.update(vision.pose.detectForVideo(video, ts), now, dt, aspect);
    } else {
      const dt = Math.min(1.5, (now - (lastHand || now)) / 1000); lastHand = now;
      hand.update(vision.hand.recognizeForVideo(video, ts), now, dt, shoulder, aspect);
    }
    // 처리 시간이 길면 인식 빈도를 낮춰서 3D 애니메이션을 지켜요
    cost += (performance.now() - t0 - cost) * 0.1;
    const slow = cost > 30 ? cost / 30 : 1;
    poseEvery = 1000 / CFG.poseHz * slow; handEvery = 1000 / CFG.handHz * slow;
    // 인식 간격이 길어지면 '놓쳤다'고 보는 시간도 같이 늘려요
    shoulder.lostMs = Math.max(CFG.shoulder.lostMs, 2.5 * poseEvery); hand.lostMs = Math.max(CFG.hand.lostMs, 2.5 * handEvery);

    if (phase === 'baseline') { baselineStep(now); return; }
    if (phase !== 'running') return;
    fuse(shoulder, hand, now, fused);
    if (fused.target !== null) mode.setGoal(fused.target);
    setNotice(fused.unknownHand);                           // 브이 등 → "인식할 수 없습니다."
    if (fused.method !== lastMethod) {
      if (lastMethod && fused.method === METHOD.HAND) toast('✋ 손 인식으로 바꿨어요: 주먹 → 가로막 내려감, 손바닥 → 가로막 올라감');
      else if (lastMethod === METHOD.HAND && fused.method === METHOD.SHOULDER) toast('어깨 인식으로 돌아왔어요.');
      lastMethod = fused.method;
    }
    // 어깨도 손도 안 보이면 상태는 그대로 두고 안내
    if (fused.method === METHOD.NONE) {
      if (noneSince < 0) noneSince = now;
      if (now - noneSince > CFG.bothLostMs) showGuide('어깨와 손이 보이지 않아요', '카메라 앞에 서서 상체가 화면에 나오게 해 주세요. 아니면 다른 모드로 바꿀 수 있어요.', { buttons: fallbackButtons });
    } else if (noneSince >= 0) { noneSince = -1; hideGuide(); }
  }

  /* ---------- 상태 표시 ---------- */
  function txt(id, v) { const el = statusEl.querySelector(id); if (el.textContent !== v) el.textContent = v; }
  function updateStatus(force = false) {
    const now = performance.now();
    if (!statusOn || (!force && now - lastStatus < 200)) return;
    lastStatus = now;
    txt('#cs-cam', camState);
    txt('#cs-sh', !stream ? '-' : !shoulder.tracking(now) ? '찾는 중…' : !shoulder.baseReady ? '기준 재는 중' : { up: '올라감 → 들숨', down: '내려감 → 날숨', neutral: '기준 높이' }[shoulder.signal]);
    txt('#cs-hand', !stream || phase !== 'running' ? '-' : hand.active ? SHAPE_TEXT[hand.shape] : hand.raw.ok ? '올리는 중…' : '내림');
    txt('#cs-breath', breath.direction === 'inhale' ? '들숨' : '날숨');
    txt('#cs-method', phase === 'running' ? fused.method : phase === 'baseline' ? '기준 재는 중' : '-');
    const dbg = statusEl.querySelector('.cs-debug'); dbg.hidden = !CFG.showDebugNumbers;
    if (CFG.showDebugNumbers) {
      txt('#cs-dy', shoulder.baseReady ? (shoulder.dy >= 0 ? '+' : '') + (shoulder.dy * 100).toFixed(1) + '% (어깨 너비 대비)' : '-');
      const r = hand.raw;
      txt('#cs-gesture', r.ok ? `${r.gesture} ${r.score.toFixed(2)} · 손바닥 ${r.palm >= 0 ? '+' : ''}${r.palm.toFixed(2)} · 손가락 ${r.extended}` : '-');
      txt('#cs-cost', cost ? cost.toFixed(0) + 'ms · 어깨 ' + (1000 / poseEvery).toFixed(0) + '회/초 · 손 ' + (1000 / handEvery).toFixed(0) + '회/초' : '-');
    }
  }
  function loadStatusPref() { try { const v = localStorage.getItem(STATUS_KEY); return v === null ? CFG.showStatusPanel : v === '1'; } catch { return CFG.showStatusPanel; } }

  /* ---------- 버튼 ---------- */
  $('#camStartBtn').addEventListener('click', () => start());
  $('#camStopBtn').addEventListener('click', () => { stop(); toast('카메라를 껐어요.'); });
  $('#camRecalBtn').addEventListener('click', () => { if (phase === 'running') beginBaseline(); });
  $('#camStatusBtn').addEventListener('click', () => {
    statusOn = !statusOn; try { localStorage.setItem(STATUS_KEY, statusOn ? '1' : '0'); } catch {}
    setPanel(); updateStatus(true);
  });

  return {
    /* 카메라 모드를 고르면: 조작판만 보여 주고 시작 버튼을 기다려요 */
    activate() {
      panel.hidden = false; if (phase === 'error') phase = 'idle'; setPanel(); updateStatus(true);
      if (!stream) showGuide('카메라 연동 호흡', '‘카메라 시작’을 누르면 전면 카메라로 어깨와 손을 인식해요. 영상은 이 기기 안에서만 처리되고 저장·전송되지 않아요.', { buttons: [['📷 카메라 시작', () => start()]] });
    },
    /* 다른 모드로 바꾸면 카메라를 완전히 꺼요 */
    deactivate() { stop(); panel.hidden = true; statusEl.hidden = true; },
    /* 매 렌더 프레임 (main.js): 모형 위치 맞추기 + 상태 표시 */
    frame(dt) {
      if (stream && phase !== 'idle') aligner.update(shoulder, video, view.clientWidth, view.clientHeight, camera, dt, true);
      updateStatus();
    },
    get phase() { return phase; },
    get stream() { return stream; },
    debug: { shoulder, hand, fused, video },
  };
}
