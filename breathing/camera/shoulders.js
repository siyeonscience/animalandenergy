/* 어깨 인식 (Pose Landmarker 결과 중 양쪽 어깨만 사용: 11 = 왼쪽 어깨, 12 = 오른쪽 어깨)
   골반·허리·다리 랜드마크는 쓰지 않아요.
   - 처음 약 2초 동안 서 있는 어깨 위치를 재서 기준점으로 삼고
   - 기준보다 위 → 들숨 신호(up), 아래 → 날숨 신호(down)  (어깨 너비 대비 비율이라 거리와 상관없음)
   - 지수 이동 평균 + 임계값 + 히스테리시스 + 유지 시간으로 작은 흔들림은 무시
   - 3D 모형의 위치·크기를 정하는 데도 사용 (center, width) */

const L_SHOULDER = 11, R_SHOULDER = 12;

export class ShoulderTracker {
  constructor(cfg) {
    this.cfg = cfg;
    this.lostMs = cfg.lostMs;   // 느린 기기에서는 controller가 인식 간격에 맞춰 늘려요
    // 화면에 쓸 값 (영상 기준 0~1 좌표). 매 프레임 새로 만들지 않음
    this.left = { x: 0, y: 0 }; this.right = { x: 0, y: 0 };
    this.reset();
  }
  reset() {
    this.seen = false; this.lastSeen = -Infinity;
    this.cx = 0; this.cy = 0; this.width = 0;        // 부드럽게 만든 어깨 중심·너비 (가로는 aspect를 곱한 값)
    this.baseY = 0; this.baseW = 0; this.baseN = 0; this.baseStart = -1; this.baseReady = false;
    this.dy = 0;                                       // 기준 대비 위로 움직인 양 (어깨 너비 비율, +가 위)
    this.signal = 'neutral';                           // up | down | neutral
    this.pending = null; this.pendingMs = 0;
  }
  /* 기준점 다시 재기 */
  startBaseline() { this.baseY = 0; this.baseW = 0; this.baseN = 0; this.baseStart = -1; this.baseReady = false; this.signal = 'neutral'; }

  update(result, now, dt, aspect) {
    const C = this.cfg;
    const lm = result?.landmarks?.[0];
    const a = lm?.[L_SHOULDER], b = lm?.[R_SHOULDER];
    // visibility(보임)와 presence(실제로 있음)를 함께 확인: 몸이 가려지면 모델이 어깨를 '짐작'해서 그리는데, 이때 presence가 낮아요
    const ok = a && b && (a.visibility ?? 1) >= C.minVisibility && (b.visibility ?? 1) >= C.minVisibility
      && (a.presence ?? 1) >= C.minPresence && (b.presence ?? 1) >= C.minPresence
      && a.x > 0 && a.x < 1 && b.x > 0 && b.x < 1 && a.y > 0 && a.y < 1 && b.y > 0 && b.y < 1;
    if (!ok) { if (now - this.lastSeen > this.lostMs) this.signal = 'neutral'; return; }
    this.lastSeen = now;
    this.left.x = a.x; this.left.y = a.y; this.right.x = b.x; this.right.y = b.y;
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, w = Math.hypot((a.x - b.x) * aspect, a.y - b.y);
    if (!this.seen) { this.cx = cx; this.cy = cy; this.width = w; this.seen = true; }
    const k = 1 - Math.exp(-dt / C.smoothSec);
    this.cx += (cx - this.cx) * k; this.cy += (cy - this.cy) * k; this.width += (w - this.width) * k;

    // 기준점 측정 (처음 baselineMs 동안의 평균)
    if (!this.baseReady) {
      if (this.baseStart < 0) this.baseStart = now;
      this.baseY += this.cy; this.baseW += this.width; this.baseN++;
      if (now - this.baseStart >= this.baselineMs) { this.baseY /= this.baseN; this.baseW /= this.baseN; this.baseReady = true; }
      return;
    }
    // 카메라에 다가가거나 멀어져 어깨 너비가 크게 바뀌면 예전 기준점은 의미가 없어요 → 신호를 끄고 기준을 다시 재요
    if (Math.abs(this.width / Math.max(0.02, this.baseW) - 1) > C.rescaleRatio) { this.startBaseline(); this.dy = 0; return; }
    this.dy = (this.baseY - this.cy) / Math.max(0.02, this.baseW);

    // 히스테리시스: 켜지는 경계와 꺼지는 경계가 달라요
    let want = this.signal;
    if (this.signal === 'up') { if (this.dy < C.upOff) want = this.dy < C.downOn ? 'down' : 'neutral'; }
    else if (this.signal === 'down') { if (this.dy > C.downOff) want = this.dy > C.upOn ? 'up' : 'neutral'; }
    else { if (this.dy > C.upOn) want = 'up'; else if (this.dy < C.downOn) want = 'down'; }
    if (want !== this.signal) {
      if (this.pending !== want) { this.pending = want; this.pendingMs = 0; }
      this.pendingMs += dt * 1000;
      if (this.pendingMs >= C.holdMs) { this.signal = want; this.pending = null; }
    } else this.pending = null;

    // 가만히 있을 때는 기준점이 천천히 따라와요 (자세가 조금씩 바뀌어도 괜찮게)
    if (this.signal === 'neutral') {
      const r = 1 - Math.exp(-dt / C.baselineAdaptSec);
      this.baseY += (this.cy - this.baseY) * r; this.baseW += (this.width - this.baseW) * r;
    }
  }
  get baselineMs() { return this.cfg.baselineMs ?? 2000; }
  tracking(now) { return this.seen && now - this.lastSeen <= this.lostMs; }
  available(now) { return this.tracking(now) && this.baseReady; }
}
