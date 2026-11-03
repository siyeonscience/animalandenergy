# 카메라 연동 호흡 (breathing/camera)

전면 카메라로 **입 모양**(핵심)과 **양쪽 어깨**(보조)를 인식해서, 기존 3D 호흡 모형을 움직여요.

- 입을 다물면 → **들숨** (breathPhase 목표 1)
- 입을 벌리면 → **날숨** (breathPhase 목표 0)
- 어깨가 기준보다 올라가면 들숨, 내려가면 날숨 (보조 신호)

영상과 인식 결과는 브라우저 안에서만 처리하고, 저장하거나 밖으로 보내지 않아요.
MediaPipe 라이브러리 안의 사용 통계 전송도 `mediapipe.js`에서 막아 두었어요.

## 파일
| 파일 | 하는 일 |
|---|---|
| `config.js` | 모든 기준값(임계값, 유지 시간, 처리 빈도)과 **인식 상태 표시 켜기/끄기** |
| `stream.js` | 전면 카메라 열기/닫기, 카메라 오류 안내 문구 |
| `mediapipe.js` | Face Landmarker·Pose Landmarker 불러오기 (`vendor/mediapipe`, GPU → CPU 자동 전환) |
| `mouth.js` | jawOpen(우선) + 입술 간격/입 너비(보조), 개인 보정, 히스테리시스, 유지 시간, 말하기·웃음·옆얼굴 처리 |
| `shoulders.js` | 어깨 11·12번만 사용, 2초 기준점, 지수 이동 평균, 히스테리시스, 거리 변화 시 기준 다시 재기 |
| `fusion.js` | 입 + 어깨 결합 규칙 (상황 A~E) |
| `align.js` | 어깨 위치·너비로 3D 모형 위치·크기 맞추기 (거울 방향 일치) |
| `controller.js` | 시작/종료 버튼, 보정 순서, 분석 반복, 상태 표시, 오류 처리 |
| `camera.css` | 카메라 화면, 상태 표시, 안내 상자 |

기존 3D 모형·애니메이션(`anatomy.js`, `respiration.js`의 `applyBreath`, 자동·수동 모드)은 그대로 쓰고,
카메라는 `modes.js`의 `CameraMode` 목표값만 바꿔요.

## 인식 상태 표시 숨기기
- 화면: 카메라 조작판의 **‘인식 정보 숨기기’** 버튼 (이 기기에 기억돼요)
- 처음부터 숨기려면: `config.js`에서 `showStatusPanel: false`
- 숫자(jawOpen, 어깨 이동량)만 숨기려면: `showDebugNumbers: false`

## 태블릿에서 실행
카메라는 보안 주소(https)에서만 켜져요.
1. GitHub Pages 주소로 열기: `https://siyeonscience.github.io/animalandenergy/breathing.html`
2. **📷 카메라 연동** → **카메라 시작** → 카메라 권한 **허용**
3. 정면을 보고 상체가 화면에 나오게 서서 보정 (어깨 2초 → 입 다물기 1초 → 입 벌리기 1초)
4. 입을 다물고/벌리며 3D 모형이 들숨/날숨으로 바뀌는지 확인

처음 한 번은 인식 엔진과 모델(약 24MB)을 받느라 시간이 걸려요. 같은 Wi-Fi에서 `http://컴퓨터IP:8000`처럼
http 주소로 열면 브라우저가 카메라를 막아요.
