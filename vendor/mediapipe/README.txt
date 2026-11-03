MediaPipe Tasks Vision (@mediapipe/tasks-vision 1.2.0) — Apache License 2.0 (LICENSE)
https://github.com/google-ai-edge/mediapipe

이 폴더의 파일은 수정하지 않고 그대로 복사했어요.
- vision_bundle.mjs                 : 자바스크립트 라이브러리
- wasm/vision_wasm_internal.js/.wasm : 브라우저에서 돌아가는 인식 엔진 (SIMD 지원 브라우저용)
- models/face_landmarker.task        : 얼굴 랜드마크 + Blendshapes(jawOpen 등) 모델
- models/pose_landmarker_lite.task   : 자세 랜드마크(가벼운 버전) 모델 — 이 앱은 양쪽 어깨(11, 12번)만 사용
  모델 출처: https://storage.googleapis.com/mediapipe-models/ (MediaPipe 공식 배포, Apache 2.0)

개인정보: 카메라 영상과 인식 결과는 브라우저 안에서만 처리해요.
라이브러리에 들어 있는 사용 통계 전송(odml.pa.googleapis.com)은 breathing/camera/mediapipe.js 에서 막아 두었어요.
