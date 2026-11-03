/* 카메라 연동 모드 전체 흐름
   시작 버튼 → 전면 카메라 → 인식 모델 → 보정(어깨 기준 2초 → 입 다물기 1초 → 입 벌리기 1초) → 인식 시작
   인식 결과는 modes.camera(CameraMode)의 목표값으로만 넘기고, 실제 움직임은 기존 breathPhase·applyBreath가 그대로 해요.
   카메라 분석(이 파일)과 3D 렌더링(main.js)은 따로 돌아가요. */
import { CAMERA_CONFIG as CFG } from './config.js';
import { openFrontCamera, closeCamera, cameraErrorMessage } from './stream.js';
import { loadVision } from './mediapipe.js';
import { MouthTracker, computeCalibration } from './mouth.js';
import { ShoulderTracker } from './shoulders.js';
import { fuse, shoulderSupport, METHOD } from './fusion.js';
import { createAligner } from './align.js';

const STATUS_KEY = 'breath.camStatus';

export function createCameraController({ view, root, camera, controls, home, mode, breath, onFallback, toast }) {
  const $ = s => document.querySelector(s);
  const video = $('#camVideo'), panel = $('#cameraPanel'), guide = $('#camGuide'), statusEl = $('#camStatus');
  const mouth = new MouthTracker(CFG.mouth);
  const shoulder = new ShoulderTracker({ ...CFG.shoulder, baselineMs: CFG.baselineMs });
  const aligner = createAligner(root, CFG.align);
  const fused = { target: null, method: METHOD.NONE, agree: false, confidence: 0 };
  mode.inhaleSec = CFG.inhaleSec; mode.exhaleSec = CFG.exhaleSec;

  let stream = null, vision = null, token = 0, phase = 'idle', loopId = 0;
  let camState = '꺼짐', errorMsg = '';
  let lastFace = 0, lastPose = 0, lastTs = 0, cost = 0, faceEvery = 1000 / CFG.faceHz, poseEvery = 1000 / CFG.poseHz;
  let stepStart = 0, samples = [], closedSamples = [], noneSince = -1, lastStatus = 0, failCount = 0, faceSeenInCalib = 0;
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
  const fallbackButtons = [['⟳ 자동 호흡으로', () => onFallback('auto')], ['✋ 수동 호흡으로', () => onFallback('manual')]];

  function fail(msg) {
    errorMsg = msg; phase = 'error';
    stopStream();
    camState = '꺼짐';
    aligner.reset(); frontView(false);          // 모형·시점을 원래대로
    showGuide('카메라 연동을 쓸 수 없어요', msg, { buttons: [['다시 시도', () => start()], ...fallbackButtons] });
    setPanel(); updateStatus(true);
  }

  /* ---------- 시작 / 종료 ---------- */
  async function start() {
    const my = ++token;
    phase = 'loading'; errorMsg = ''; camState = '연결 중'; setPanel(); updateStatus(true);
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
    beginCalibration();
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
    mouth.reset(); shoulder.reset(); aligner.reset();
    frontView(false); hideGuide();
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

  /* ---------- 보정 ---------- */
  function beginCalibration() {
    mouth.reset(); shoulder.reset(); shoulder.startBaseline();
    phase = 'calib-base'; stepStart = performance.now(); faceSeenInCalib = 0;
    setPanel();
  }
  function calibStep(now, r) {
    const el = now - stepStart;
    if (phase === 'calib-base') {
      const prog = shoulder.baseStart > 0 ? Math.min(1, (now - shoulder.baseStart) / CFG.baselineMs) : 0;
      showGuide('정면을 보고 편하게 서 주세요', shoulder.seen ? '어깨 기준 위치를 재고 있어요…' : '어깨가 화면에 보이게 조금 뒤로 서 주세요', { progress: prog });
      if (shoulder.baseReady || el > CFG.baselineMs + 3000) { phase = 'calib-closed'; stepStart = now; samples = []; }
      return;
    }
    const closing = phase === 'calib-closed';
    if (r && r.ok) { faceSeenInCalib = now; mouth.lastSeen = now; }
    // 기기가 느려 1초에 샘플이 모자라면 최대 4초 더 모아요
    const enough = samples.length >= CFG.calibMinSamples;
    if (el > 400 && (el <= 400 + CFG.calibStepMs || !enough) && r && goodFace(r)) samples.push({ jaw: r.jaw, ratio: r.ratio });
    const prog = Math.min(1, Math.max(0, (el - 400) / CFG.calibStepMs));
    showGuide(closing ? '입을 다물어 주세요' : '입을 벌려 주세요', closing ? '입술을 편하게 붙이고 그대로 있어요' : '"아" 하듯이 크게 벌리고 그대로 있어요', { progress: prog });
    if (now - faceSeenInCalib > 5000 && el > 5000) {
      showGuide('얼굴을 찾지 못했어요', '얼굴이 화면 가운데에 보이게 해 주세요. 어깨만으로 시작할 수도 있어요.',
        { buttons: [['어깨만으로 시작', () => { phase = 'running'; hideGuide(); setPanel(); }], ...fallbackButtons] });
      return;
    }
    if (el < 400 + CFG.calibStepMs) return;
    if (samples.length < CFG.calibMinSamples) {
      if (el < 400 + CFG.calibStepMs + 4000) return;
      stepStart = now; samples = []; toast('얼굴이 잘 보이게 정면을 봐 주세요. 다시 잴게요.'); return;
    }
    if (closing) { closedSamples = samples; samples = []; phase = 'calib-open'; stepStart = now; return; }
    const res = computeCalibration(closedSamples, samples, CFG);
    if (!res.ok) {
      toast(res.reason === 'diff' ? '다물 때와 벌릴 때 차이가 작아요. 입을 더 크게 벌려서 다시 해 볼게요.' : '얼굴이 잘 보이게 해 주세요. 다시 잴게요.');
      phase = 'calib-closed'; stepStart = now + 900; samples = []; return;
    }
    mouth.calib = res.calib;
    phase = 'running'; hideGuide(); setPanel();
    toast('보정 완료! 입을 다물면 들숨, 입을 벌리면 날숨이에요.');
  }
  function goodFace(r) {
    const C = CFG.mouth;
    return r.ok && Math.abs(r.yaw) <= C.maxYaw && r.size >= C.minFace && r.size <= C.maxFace;
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
    // 보정 중에는 지금 재는 것만: 어깨 기준(자세 모델만) / 입 다물기·벌리기(얼굴 모델만)
    const onlyPose = phase === 'calib-base', onlyFace = phase === 'calib-closed' || phase === 'calib-open';
    const faceDue = !onlyPose && now - lastFace >= faceEvery, poseDue = !onlyFace && now - lastPose >= poseEvery;
    if (!faceDue && !poseDue) return;
    // 둘 다 할 때가 되면 더 오래 기다린 쪽부터 — 한 프레임에 하나만 해서 부담을 나눠요
    const doFace = faceDue && (!poseDue || (now - lastFace) / faceEvery >= (now - lastPose) / poseEvery);
    const ts = lastTs = Math.max(lastTs + 1, Math.round(now));
    const t0 = performance.now();
    let r = null;
    if (doFace) {
      const dt = Math.min(1.5, (now - (lastFace || now)) / 1000); lastFace = now;
      r = mouth.measure(vision.face.detectForVideo(video, ts), aspect);
      if (phase === 'running') mouth.update(r, now, dt, shoulderSupport(shoulder, now));
    } else {
      const dt = Math.min(1.5, (now - (lastPose || now)) / 1000); lastPose = now;
      shoulder.update(vision.pose.detectForVideo(video, ts), now, dt, aspect);
    }
    // 처리 시간이 길면 인식 빈도를 낮춰서 3D 애니메이션을 지켜요
    cost += (performance.now() - t0 - cost) * 0.1;
    const slow = cost > 30 ? cost / 30 : 1;
    faceEvery = 1000 / CFG.faceHz * slow; poseEvery = 1000 / CFG.poseHz * slow;
    // 인식 간격이 길어지면 '놓쳤다'고 보는 시간도 같이 늘려요 (정상 갱신 사이에 '못 찾음'으로 보이지 않게)
    mouth.lostMs = Math.max(CFG.mouth.lostMs, 2.5 * faceEvery); shoulder.lostMs = Math.max(CFG.shoulder.lostMs, 2.5 * poseEvery);

    if (phase.startsWith('calib')) { if (doFace || phase === 'calib-base') calibStep(now, r); return; }
    if (phase !== 'running') return;
    fuse(mouth, shoulder, now, fused);
    if (fused.target !== null) mode.setGoal(fused.target);
    // 상황 E: 둘 다 안 보이면 상태는 그대로 두고 안내
    if (fused.method === METHOD.NONE) {
      if (noneSince < 0) noneSince = now;
      if (now - noneSince > CFG.bothLostMs) showGuide('얼굴과 어깨가 보이지 않아요', '카메라 앞에 서서 얼굴과 어깨가 화면에 나오게 해 주세요. 아니면 다른 모드로 바꿀 수 있어요.', { buttons: fallbackButtons });
    } else if (noneSince >= 0) { noneSince = -1; hideGuide(); }
  }

  /* ---------- 상태 표시 ---------- */
  function txt(id, v) { const el = statusEl.querySelector(id); if (el.textContent !== v) el.textContent = v; }
  function updateStatus(force = false) {
    const now = performance.now();
    if (!statusOn || (!force && now - lastStatus < 200)) return;
    lastStatus = now;
    txt('#cs-cam', camState);
    const faceOk = mouth.available(now), faceSeen = now - mouth.lastSeen <= mouth.lostMs;
    txt('#cs-face', !stream ? '-' : faceOk ? '인식 중' : faceSeen ? (mouth.note || '불안정') : '찾는 중… (어깨만 사용)');
    const lv = { closed: '입 다묾', slight: '조금 벌림', wide: '크게 벌림' }[mouth.level] || '-';
    txt('#cs-mouth', !faceOk ? '-' : lv + (mouth.talking ? ' (말하는 중)' : '') + ' → ' + (mouth.state === 'closed' ? '들숨' : '날숨'));
    txt('#cs-sh', !stream ? '-' : !shoulder.tracking(now) ? '찾는 중…' : !shoulder.baseReady ? '기준 재는 중' : { up: '올라감', down: '내려감', neutral: '기준 높이' }[shoulder.signal]);
    txt('#cs-breath', breath.direction === 'inhale' ? '들숨' : '날숨');
    txt('#cs-method', phase === 'running' ? fused.method : phase.startsWith('calib') ? '보정 중' : '-');
    const dbg = statusEl.querySelector('.cs-debug'); dbg.hidden = !CFG.showDebugNumbers;
    if (CFG.showDebugNumbers) {
      txt('#cs-jaw', mouth.raw.ok ? mouth.raw.jaw.toFixed(2) + ' (비율 ' + mouth.raw.ratio.toFixed(2) + ', 보정값 ' + mouth.open.toFixed(2) + ')' : '-');
      txt('#cs-dy', shoulder.baseReady ? (shoulder.dy >= 0 ? '+' : '') + (shoulder.dy * 100).toFixed(1) + '% (어깨 너비 대비)' : '-');
      txt('#cs-cost', cost ? cost.toFixed(0) + 'ms · 얼굴 ' + (1000 / faceEvery).toFixed(0) + '회/초 · 어깨 ' + (1000 / poseEvery).toFixed(0) + '회/초' : '-');
    }
  }
  function loadStatusPref() { try { const v = localStorage.getItem(STATUS_KEY); return v === null ? CFG.showStatusPanel : v === '1'; } catch { return CFG.showStatusPanel; } }

  /* ---------- 버튼 ---------- */
  $('#camStartBtn').addEventListener('click', () => start());
  $('#camStopBtn').addEventListener('click', () => { stop(); toast('카메라를 껐어요.'); });
  $('#camRecalBtn').addEventListener('click', () => { if (phase === 'running') beginCalibration(); });
  $('#camStatusBtn').addEventListener('click', () => {
    statusOn = !statusOn; try { localStorage.setItem(STATUS_KEY, statusOn ? '1' : '0'); } catch {}
    setPanel(); updateStatus(true);
  });

  return {
    /* 카메라 모드를 고르면: 조작판만 보여 주고 시작 버튼을 기다려요 */
    activate() { panel.hidden = false; phase = phase === 'error' ? 'idle' : phase; setPanel(); updateStatus(true); if (!stream) showGuide('카메라 연동 호흡', '‘카메라 시작’을 누르면 전면 카메라로 입 모양과 어깨를 인식해요. 영상은 이 기기 안에서만 처리되고 저장·전송되지 않아요.', { buttons: [['📷 카메라 시작', () => start()]] }); },
    /* 다른 모드로 바꾸면 카메라를 완전히 꺼요 */
    deactivate() { stop(); panel.hidden = true; statusEl.hidden = true; },
    /* 매 렌더 프레임 (main.js): 모형 위치 맞추기 + 상태 표시 */
    frame(dt) {
      if (stream && phase !== 'idle') aligner.update(shoulder, video, view.clientWidth, view.clientHeight, camera, dt, true);
      updateStatus();
    },
    get phase() { return phase; },
    get stream() { return stream; },
    debug: { mouth, shoulder, fused, video },
  };
}
