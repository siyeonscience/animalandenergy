/* 호흡 모드: 각 모드는 매 프레임 목표 호흡 상태(target, 0~1)만 정해요.
   실제 움직임은 respiration.js의 applyBreath 하나로 같아요. */

const ease = x => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2;

/* 자동 호흡: 들숨 40%, 날숨 60% (날숨이 조금 더 김) */
export class AutoMode {
  constructor() { this.period = 4; this.t = 0; this.paused = false; this.follow = 14; }
  start() { this.t = 0; }
  update(dt) {
    if (!this.paused) this.t = (this.t + dt / this.period) % 1;
    const t = this.t;
    return t < 0.4 ? ease(t / 0.4) : 1 - ease((t - 0.4) / 0.6);
  }
}

/* 수동 호흡: 슬라이더나 가로막을 직접 끌어서 정한 값 */
export class ManualMode {
  constructor() { this.value = 0; this.follow = 7; }
  start(current) { this.value = current; }
  set(v) { this.value = Math.min(1, Math.max(0, v)); }
  update() { return this.value; }
}

/* 카메라 연동: 3단계에서 MediaPipe로 어깨 높이를 읽어 value를 넣을 예정 */
export class CameraMode {
  constructor() { this.value = 0; this.follow = 6; this.ready = false; }
  start() {}
  update() { return this.value; }
}
