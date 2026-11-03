/* MediaPipe Tasks Vision 불러오기 (프로젝트 안 vendor/mediapipe 파일만 사용)
   - 얼굴: Face Landmarker (얼굴 랜드마크 + Blendshapes의 jawOpen)
   - 몸: Pose Landmarker lite (이 앱은 양쪽 어깨만 사용)
   카메라 모드를 처음 고를 때만 불러와서, 다른 모드의 시작 속도에는 영향이 없어요. */

import { CAMERA_CONFIG } from './config.js';

const BASE = new URL('../../vendor/mediapipe/', import.meta.url).href;
const TELEMETRY = 'odml.pa.googleapis.com';

/* 라이브러리 안의 사용 통계 전송을 막아요: 영상·인식 결과는 물론 어떤 기록도 밖으로 나가지 않게 */
function blockTelemetry() {
  if (window.__mpFetchGuard) return;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.includes(TELEMETRY)) return Promise.reject(new TypeError('blocked: telemetry disabled'));
    return orig(input, init);
  };
  window.__mpFetchGuard = true;
}

let loading = null;
export function loadVision(onProgress = () => {}) {
  loading ??= (async () => {
    blockTelemetry();
    onProgress('인식 엔진 불러오는 중…');
    const vision = await import(BASE + 'vision_bundle.mjs');
    const { FilesetResolver, FaceLandmarker, PoseLandmarker } = vision;
    if (!(await FilesetResolver.isSimdSupported())) {
      const e = new Error('이 브라우저는 인식 엔진(WebAssembly SIMD)을 지원하지 않아요. 최신 Chrome이나 Safari로 열어 주세요.'); e.name = 'NoSimd'; throw e;
    }
    const fileset = await FilesetResolver.forVisionTasks(BASE + 'wasm');
    // 설정한 장치(기본 GPU)로 먼저 시도하고, 안 되면 다른 장치로
    const first = CAMERA_CONFIG.delegate === 'CPU' ? 'CPU' : 'GPU', second = first === 'GPU' ? 'CPU' : 'GPU';
    async function create(Cls, opts) {
      try { return await Cls.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: first } }); }
      catch (e) { console.warn(first + ' 사용 불가, ' + second + '로 전환', e); return Cls.createFromOptions(fileset, { ...opts, baseOptions: { ...opts.baseOptions, delegate: second } }); }
    }
    onProgress('얼굴 인식 모델 불러오는 중…');
    const face = await create(FaceLandmarker, {
      baseOptions: { modelAssetPath: BASE + 'models/face_landmarker.task' },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    onProgress('어깨 인식 모델 불러오는 중…');
    const pose = await create(PoseLandmarker, {
      baseOptions: { modelAssetPath: BASE + 'models/pose_landmarker_lite.task' },
      runningMode: 'VIDEO', numPoses: 1,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    return { face, pose };
  })().catch(e => { loading = null; throw e; });
  return loading;
}
