/* 호흡 모드: 각 모드는 매 프레임 목표 호흡 상태(target, 0~1)만 정해요.
   실제 움직임은 respiration.js의 applyBreath 하나로 같아요. */

const ease = x => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, x)))) / 2;

/* 자동 호흡: 들숨 40%, 날숨 60% (날숨이 조금 더 김) */
export class AutoMode {
  constructor() { this.period = 4.5; this.t = 0; this.paused = false; this.follow = 14; }
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

/* 카메라 연동: 입 모양·어깨 인식 결과(camera/controller.js)가 setGoal(1=들숨, 0=날숨)로 목표만 정해요.
   목표가 바뀌면 순간이동하지 않고 일정한 빠르기(들숨 inhaleSec, 날숨 exhaleSec)로 숨을 쉬듯 이동해요.
   인식이 안 되면 목표를 바꾸지 않으므로 지금 상태를 그대로 유지해요. */
export class CameraMode {
  constructor() { this.value = 0; this.goal = 0; this.follow = 10; this.inhaleSec = 1.6; this.exhaleSec = 2; }
  start(current = 0) { this.value = this.goal = current; }
  setGoal(g) { this.goal = Math.min(1, Math.max(0, g)); }
  update(dt) {
    const d = this.goal - this.value;
    const step = dt / (d > 0 ? this.inhaleSec : this.exhaleSec);
    this.value += Math.max(-step, Math.min(step, d));
    return this.value;
  }
}
