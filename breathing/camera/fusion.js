/* 호흡 판단 (입 모양은 쓰지 않아요)
   1순위: 어깨 — 기준보다 올라가면 들숨(1), 내려가면 날숨(0), 기준 높이면 그대로
   2순위: 손 — 상체 옆으로 손을 올리면 손으로 넘어가요
          주먹 → 가로막 내려감(들숨 1) / 손바닥 펴기 → 가로막 올라감(날숨 0) / 그 밖의 모양 → "인식할 수 없습니다."(그대로)
   둘 다 없으면 호흡 상태를 바꾸지 않고 안내
   반환: { target: 1 | 0 | null(그대로), method, unknownHand } — out 객체를 재사용 */

export const METHOD = { SHOULDER: '어깨 (1순위)', HAND: '손 (2순위)', NONE: '인식 안 됨' };

export function fuse(shoulder, hand, now, out = {}) {
  out.unknownHand = false;
  if (hand.active) {
    out.method = METHOD.HAND;
    out.target = hand.shape === 'fist' ? 1 : hand.shape === 'open' ? 0 : null;
    out.unknownHand = hand.shape === 'unknown';
  } else if (shoulder.available(now)) {
    out.method = METHOD.SHOULDER;
    out.target = shoulder.signal === 'up' ? 1 : shoulder.signal === 'down' ? 0 : null;
  } else {
    out.method = METHOD.NONE; out.target = null;
  }
  return out;
}
