/* 호흡 상태(breathPhase) 관리 — 모든 모드가 이 하나의 함수로 기관을 움직여요.
   breathPhase: 0 = 날숨이 끝난 상태, 1 = 들숨 최대 상태 */

/* 모든 기관에 같은 호흡 상태를 적용 */
export function applyBreath(organs, phase) {
  for (const o of Object.values(organs)) o.setBreath(phase);
}

/* 목표값을 부드럽게 따라가는 호흡 상태 (갑자기 튀지 않도록 보간)
   - target: 모드가 정하는 목표 호흡 상태
   - value: 실제로 화면에 쓰는 값
   - velocity: 1초당 변화량(+면 들숨, -면 날숨) */
export class BreathState {
  constructor() { this.value = 0; this.target = 0; this.velocity = 0; this.direction = 'exhale'; }
  update(dt, follow = 8) {
    const prev = this.value;
    this.value += (this.target - this.value) * (1 - Math.exp(-follow * dt));
    this.value = Math.min(1, Math.max(0, this.value));
    const v = dt > 0 ? (this.value - prev) / dt : 0;
    this.velocity += (v - this.velocity) * Math.min(1, dt * 10);
    // 움직이는 방향으로 들숨/날숨을 정함 (거의 멈추면 마지막 상태 유지)
    if (this.velocity > 0.04) this.direction = 'inhale';
    else if (this.velocity < -0.04) this.direction = 'exhale';
    return this.value;
  }
  reset() { this.value = this.target = this.velocity = 0; this.direction = 'exhale'; }
}
