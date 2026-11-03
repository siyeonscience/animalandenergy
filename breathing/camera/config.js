/* 카메라 연동 설정값 — 수업 환경에 맞게 여기 숫자만 바꾸면 돼요. */
export const CAMERA_CONFIG = {
  /* 인식 상태 표시 영역(개발·수업용). false로 바꾸면 처음부터 숨겨져요. 화면의 '인식 정보' 버튼으로도 켜고 끌 수 있어요. */
  showStatusPanel: true,
  showDebugNumbers: true,          // jawOpen 점수, 어깨 이동량 숫자 표시

  /* 인식 계산 장치: 'GPU'(대부분의 태블릿에서 빠름) 또는 'CPU'. 먼저 이것으로 시도하고 실패하면 다른 쪽으로 바꿔요 */
  delegate: 'GPU',

  /* 처리 빈도: 한 번에 하나의 모델만 돌려서 3D 애니메이션이 느려지지 않게 */
  faceHz: 15,                      // 얼굴(입) 인식 초당 횟수
  poseHz: 8,                       // 어깨 인식 초당 횟수

  /* 보정 */
  baselineMs: 2000,                // 처음 서 있는 어깨 위치 측정 시간
  calibStepMs: 1000,               // 입 다물기 / 벌리기 측정 시간
  calibMinSamples: 4,
  calibMinJawDiff: 0.12,           // 다물 때와 벌릴 때 jawOpen 차이가 이보다 작으면 다시 측정
  calibMinRatioDiff: 0.06,         // 입 벌림 비율 차이 (jawOpen 차이가 부족할 때 대신 인정)

  /* 입 모양 판정 (보정 후 0 = 다문 입, 1 = 벌린 입 으로 바꾼 값 기준) */
  mouth: {
    jawWeight: 0.7,                // jawOpen 우선, 입술 비율은 보조
    smoothSec: 0.12,               // 시간 기반 지수 이동 평균
    closeBelow: 0.3,               // 이보다 작으면 '입 다묾' (히스테리시스 아래 경계)
    openAbove: 0.45,               // 이보다 크면 '입 벌림' (히스테리시스 위 경계)
    wideAbove: 0.8,                // 이보다 크면 '크게 벌림'
    holdOpenMs: 350,               // 벌린 상태가 이만큼 이어져야 날숨으로 바꿈
    holdCloseMs: 400,              // 다문 상태가 이만큼 이어져야 들숨으로 바꿈
    agreeFactor: 0.5,              // 어깨 신호가 같은 방향이면 위 시간을 이만큼으로 줄임(높은 신뢰도)
    talkWindowMs: 2000,            // 이 시간 안에
    talkFlips: 4,                  // 입이 이만큼 이상 열렸다 닫혔다 하면 '말하는 중'으로 보고 상태를 바꾸지 않음
    smileIgnoreRatio: 0.5,         // 웃는 표정 점수가 이보다 크면 입술 비율은 무시(이가 보여도 다문 입일 수 있음)
    maxYaw: 0.35,                  // 얼굴이 옆으로 돌아간 정도(코 위치 비대칭) 한계
    minFace: 0.06,                 // 얼굴이 너무 작음(눈 사이 거리 / 화면 높이)
    maxFace: 0.42,                 // 카메라와 너무 가까움
    lostMs: 1000,                  // 얼굴이 이 시간 넘게 안 보이면 '얼굴 인식 실패' → 어깨만 사용
  },

  /* 어깨 판정 (어깨 너비에 대한 비율로 계산해서 거리와 상관없게) */
  shoulder: {
    minVisibility: 0.5,
    minPresence: 0.93,             // 몸이 가려져 어깨를 '짐작'만 할 때(실험값 0.3~0.9)는 쓰지 않음, 실제 어깨는 0.99 이상
    smoothSec: 0.15,
    upOn: 0.04, upOff: 0.02,       // 기준보다 위로 4% → '올라감', 2% 아래로 내려오면 해제
    downOn: -0.03, downOff: -0.015,// 기준보다 아래로 3% → '내려감'
    holdMs: 250,
    baselineAdaptSec: 25,          // 가만히 있을 때 기준점을 천천히 따라감(자세가 조금씩 바뀌는 것 보정)
    lostMs: 700,
    rescaleRatio: 0.25,            // 어깨 너비가 기준보다 25% 넘게 바뀌면(앞뒤로 이동) 기준점을 다시 잼
  },

  /* 3D 모형 맞추기 (어깨만 사용) */
  align: {
    smoothSec: 0.2,
    widthFactor: 0.9,              // 인식된 어깨 사이 거리 대비 모형 빗장뼈 폭
    chestDrop: 0.5,                // 어깨 중심에서 아래로 (어깨 너비 × 이 값) 내려간 곳을 흉곽 중심으로
  },

  bothLostMs: 1500,                // 얼굴·어깨 모두 이만큼 안 보이면 안내 표시
  /* 카메라 모드에서 호흡 상태(breathPhase)가 목표까지 가는 시간 */
  inhaleSec: 1.6,
  exhaleSec: 2.0,
};
