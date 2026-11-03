/* 입 모양 + 어깨 신호 합치기 (입 모양이 우선)
   A. 두 신호가 같음(입 다묾+어깨 올라감 / 입 벌림+어깨 내려감) → 높은 신뢰도
   B. 서로 다름 → 입 모양을 따름
   C. 얼굴을 일정 시간 못 찾음 → 어깨만으로
   D. 어깨를 못 찾음 → 입 모양만으로
   E. 둘 다 없음 → 호흡 상태를 바꾸지 않음(target = null) + 안내
   반환: { target: 1(들숨) | 0(날숨) | null(그대로), method, agree, confidence } — out 객체를 재사용 */

export const METHOD = { BOTH: '입 + 어깨', MOUTH: '입 단독', SHOULDER: '어깨 단독', HOLD: '잠시 유지', NONE: '인식 안 됨' };

export function fuse(mouth, shoulder, now, out = {}) {
  const mOk = mouth.available(now);
  const sOk = shoulder.available(now);
  const sWant = shoulder.signal === 'up' ? 1 : shoulder.signal === 'down' ? 0 : null;
  out.agree = false;
  if (mOk) {
    out.target = mouth.state === 'closed' ? 1 : 0;           // 입 다묾 → 들숨(1), 입 벌림 → 날숨(0)
    out.method = sOk ? METHOD.BOTH : METHOD.MOUTH;
    out.agree = sOk && sWant === out.target;
    out.confidence = out.agree ? 1 : sOk && sWant !== null ? 0.7 : 0.8;
    if (mouth.talking) out.confidence = 0.4;
  } else if (mouth.holding(now) && (!sOk || now - mouth.lastGood < 2 * mouth.lostMs)) {
    // 얼굴은 보이지만 잠깐 불안정 (옆으로 돌림, 너무 작음 등) → 잠시 상태를 바꾸지 않고 기다림
    // (불안정이 길어지면 아래 '어깨 단독'으로 넘어가요)
    out.target = null; out.method = METHOD.HOLD; out.confidence = 0.3;
  } else if (sOk && shoulder.lastSeen > mouth.lastSeen) {
    // 얼굴이 사라진 '뒤에도' 어깨가 새로 인식됐을 때만 어깨로 판단 (화면이 통째로 가려진 순간의 옛 어깨 값은 쓰지 않음)
    out.target = sWant;                                      // neutral이면 null → 그대로 유지
    out.method = METHOD.SHOULDER; out.confidence = sWant === null ? 0.4 : 0.6;
  } else if (sOk) {
    out.target = null; out.method = METHOD.HOLD; out.confidence = 0.2;
  } else {
    out.target = null; out.method = METHOD.NONE; out.confidence = 0;
  }
  return out;
}

/* 입 추적기에 넘길 '어깨가 바라는 입 상태' (같은 방향이면 더 빨리 확정) */
export function shoulderSupport(shoulder, now) {
  if (!shoulder.available(now)) return null;
  return shoulder.signal === 'up' ? 'closed' : shoulder.signal === 'down' ? 'open' : null;
}
