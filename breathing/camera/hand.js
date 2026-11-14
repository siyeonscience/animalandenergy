/* 손 인식 (2순위) — MediaPipe Gesture Recognizer 결과 사용
   상체 옆으로 손을 올리면 손 모드로 넘어가요.
   - 주먹(손바닥이 안 보임)                → 'fist' : 가로막이 내려간 상태(들숨)
   - 손가락을 펴서 손바닥이 카메라를 향함  → 'open' : 가로막이 올라간 상태(날숨)
   - 브이·검지 등 손바닥이 일부 가려짐, 손등이 보임 → 'unknown' : "인식할 수 없습니다." */

const WRIST = 0, INDEX_MCP = 5, MIDDLE_MCP = 9, PINKY_MCP = 17;
const FINGERS = [[8, 6], [12, 10], [16, 14], [20, 18]];   // [손끝, 둘째 마디]
const UNSURE = new Set(['Victory', 'Pointing_Up', 'Thumb_Up', 'Thumb_Down', 'ILoveYou']);

export class HandTracker {
  constructor(cfg) {
    this.cfg = cfg;
    this.lostMs = cfg.lostMs;
    this.raw = { ok: false, gesture: '', score: 0, palm: 0, extended: 0, x: 0, y: 0, shape: 'none' };
    this.reset();
  }
  reset() {
    this.active = false;            // 손 모드(2순위) 사용 중
    this.raisedMs = 0;              // 상체 옆에 손이 올라와 있던 시간
    this.lastRaised = -Infinity;
    this.shape = 'none';            // 확정된 손 모양: fist | open | unknown | none
    this.pending = null; this.pendingMs = 0;
  }

  /* 손 하나 분석: 제스처 이름 + 손바닥 방향 + 펼친 손가락 수 → 모양 */
  analyze(result, i, aspect, out) {
    const lm = result.landmarks[i];
    const top = result.gestures?.[i]?.[0];
    out.gesture = top?.categoryName || 'None'; out.score = top?.score || 0;
    // 손바닥 방향: (손목→가운뎃손가락 뿌리) × (검지 뿌리→새끼 뿌리), 왼손/오른손에 따라 부호가 반대
    const ux = (lm[MIDDLE_MCP].x - lm[WRIST].x) * aspect, uy = lm[MIDDLE_MCP].y - lm[WRIST].y;
    const lx = (lm[PINKY_MCP].x - lm[INDEX_MCP].x) * aspect, ly = lm[PINKY_MCP].y - lm[INDEX_MCP].y;
    const s = (ux * ly - uy * lx) / (Math.hypot(ux, uy) * Math.hypot(lx, ly) + 1e-9);   // -1~1
    const right = result.handedness?.[i]?.[0]?.categoryName === 'Right';
    out.palm = right ? -s : s;          // + : 손바닥이 카메라를 향함, - : 손등 (실험으로 확인한 방향)
    // 펼친 손가락 수 (손끝이 둘째 마디보다 손목에서 멀면 펼친 것)
    const d = k => Math.hypot((lm[k].x - lm[WRIST].x) * aspect, lm[k].y - lm[WRIST].y);
    out.extended = FINGERS.reduce((n, [tip, pip]) => n + (d(tip) > d(pip) * 1.1 ? 1 : 0), 0);
    out.x = lm[MIDDLE_MCP].x; out.y = lm[MIDDLE_MCP].y;
    const C = this.cfg;
    if (out.gesture === 'Closed_Fist' && out.score >= C.minScore) out.shape = 'fist';
    else if (out.gesture === 'Open_Palm' && out.score >= C.minScore) out.shape = out.palm > C.minPalm ? 'open' : 'unknown';
    else if (UNSURE.has(out.gesture) && out.score >= C.minScore) out.shape = 'unknown';
    else if (out.extended === 0) out.shape = 'fist';                                     // 제스처 이름이 없으면 손가락 수로
    else if (out.extended === 4 && out.palm > C.minPalm) out.shape = 'open';
    else out.shape = 'unknown';
    return out;
  }

  /* 상체 옆으로 올린 손인지: 어깨 밖(옆)에 있고, 가슴보다 위 */
  beside(x, y, shoulder, aspect, useShoulder) {
    if (!useShoulder) return true;                       // 어깨를 모르면 보이는 손은 모두 사용
    const C = this.cfg;
    const half = shoulder.width / 2 / aspect;              // 어깨 너비의 절반(가로 좌표)
    const outside = Math.abs(x - shoulder.cx) > half * C.besideRatio;
    const raised = y < shoulder.cy + shoulder.width * C.belowShoulder;
    return outside && raised;
  }

  update(result, now, dt, shoulder, aspect) {
    const C = this.cfg, r = this.raw;
    r.ok = false;
    const n = result?.landmarks?.length || 0;
    // 상체 옆으로 올린 손 중 점수가 가장 높은 손
    let best = -1, bestScore = -1;
    const useShoulder = shoulder.tracking(now);
    for (let i = 0; i < n; i++) {
      const lm = result.landmarks[i][MIDDLE_MCP];
      if (!this.beside(lm.x, lm.y, shoulder, aspect, useShoulder)) continue;
      const sc = result.handedness?.[i]?.[0]?.score ?? 0.5;
      if (sc > bestScore) { bestScore = sc; best = i; }
    }
    if (best >= 0) { this.analyze(result, best, aspect, r); r.ok = true; }

    // 손 모드 들어가기/나오기 (잠깐 스친 손은 무시)
    if (r.ok) { this.lastRaised = now; this.raisedMs += dt * 1000; if (this.raisedMs >= C.enterMs) this.active = true; }
    else { this.raisedMs = 0; if (now - this.lastRaised > this.lostMs) { this.active = false; this.shape = 'none'; this.pending = null; } }
    if (!r.ok || !this.active) return;

    // 같은 모양이 잠시 이어져야 확정
    if (r.shape === this.shape) { this.pending = null; this.pendingMs = 0; return; }
    if (this.pending !== r.shape) { this.pending = r.shape; this.pendingMs = 0; }
    this.pendingMs += dt * 1000;
    if (this.pendingMs >= (r.shape === 'unknown' ? C.holdUnknownMs : C.holdMs) || this.shape === 'none') { this.shape = r.shape; this.pending = null; }
  }
}
