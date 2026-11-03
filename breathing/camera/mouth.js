/* 입 모양 인식 (Face Landmarker 결과 사용)
   규칙: 입을 다물면 → 들숨,  입을 벌리면 → 날숨
   - jawOpen 점수(Blendshapes)를 우선, 입술 위아래 간격 ÷ 입 너비(입 벌림 비율)를 보조로 사용
   - 개인별 보정값으로 0(다문 입) ~ 1(벌린 입) 사이 값으로 바꾼 뒤
   - 시간 기반 지수 이동 평균 → 히스테리시스(위·아래 경계가 다름) → 일정 시간 유지되어야 상태 변경
   - 말하거나 웃을 때, 얼굴이 돌아가거나 너무 작거나 가까울 때는 상태를 바꾸지 않아요. */

const LIP_UP = 13, LIP_LOW = 14, MOUTH_L = 61, MOUTH_R = 291, EYE_L = 33, EYE_R = 263, NOSE = 1;

export class MouthTracker {
  constructor(cfg) {
    this.cfg = cfg;
    this.lostMs = cfg.lostMs;   // 느린 기기에서는 controller가 인식 간격에 맞춰 늘려요
    this.calib = null;
    // 매 프레임 새 객체를 만들지 않도록 한 번 만든 객체를 계속 씀
    this.raw = { ok: false, jaw: 0, ratio: 0, smile: 0, yaw: 0, size: 0, reason: '' };
    this.reset();
  }
  reset() {
    this.open = 0;             // 부드럽게 만든 입 벌림 정도 (보정 후)
    this.level = 'unknown';    // closed | slight | wide | unknown
    this.state = 'unknown';    // 확정된 상태: closed | open | unknown
    this.pending = null; this.pendingMs = 0;
    this.lastSeen = -Infinity; this.lastGood = -Infinity;
    this.flips = []; this.lastDesire = null;
    this.talking = false;
    this.quality = 0;          // 0~1 인식 신뢰도
    this.note = '';
    this.idx = null;           // blendshape 이름 → 번호 (처음 한 번만 찾음)
  }

  /* MediaPipe 결과에서 필요한 숫자만 꺼내기. aspect = 영상 가로/세로 */
  measure(result, aspect) {
    const r = this.raw;
    const lm = result?.faceLandmarks?.[0];
    if (!lm) { r.ok = false; r.reason = 'noface'; return r; }
    const bs = result.faceBlendshapes?.[0]?.categories;
    if (bs) {
      if (!this.idx) { this.idx = {}; bs.forEach((c, i) => { this.idx[c.categoryName] = i; }); }
      r.jaw = bs[this.idx.jawOpen]?.score ?? 0;
      r.smile = ((bs[this.idx.mouthSmileLeft]?.score ?? 0) + (bs[this.idx.mouthSmileRight]?.score ?? 0)) / 2;
    } else { r.jaw = NaN; r.smile = 0; }
    const dx = (a, b) => (lm[a].x - lm[b].x) * aspect, dy = (a, b) => lm[a].y - lm[b].y;
    const dist = (a, b) => Math.hypot(dx(a, b), dy(a, b));
    const width = dist(MOUTH_L, MOUTH_R);
    r.ratio = width > 1e-4 ? dist(LIP_UP, LIP_LOW) / width : 0;
    const eyes = dist(EYE_L, EYE_R);                       // 눈 사이 거리 (화면 높이 기준)
    r.size = eyes;
    // 얼굴이 옆으로 돌아간 정도: 코끝이 두 눈 가운데에서 얼마나 벗어났는지
    r.yaw = eyes > 1e-4 ? ((lm[NOSE].x - (lm[EYE_L].x + lm[EYE_R].x) / 2) * aspect) / eyes : 0;
    r.ok = true; r.reason = '';
    return r;
  }

  /* 보정값으로 0(다문 입)~1(벌린 입)로 바꾸기 */
  normalize(r) {
    const c = this.calib || { jawClosed: 0.03, jawOpen: 0.45, ratioClosed: 0.02, ratioOpen: 0.35 };
    const nj = (r.jaw - c.jawClosed) / Math.max(0.05, c.jawOpen - c.jawClosed);
    const nr = (r.ratio - c.ratioClosed) / Math.max(0.03, c.ratioOpen - c.ratioClosed);
    let w = this.cfg.jawWeight;
    if (Number.isNaN(r.jaw) || c.jawUsable === false) w = 0; // jawOpen이 없거나 보정 때 차이가 작았으면 입술 비율만
    else if (r.smile > this.cfg.smileIgnoreRatio || c.ratioUsable === false) w = 1; // 웃을 때는 이가 보여도 입술 비율은 무시
    const v = w * (Number.isNaN(nj) ? 0 : nj) + (1 - w) * nr;
    return Math.min(1.5, Math.max(-0.3, v));
  }

  /* 매 인식마다 호출. support: 어깨 신호가 바라는 상태('closed'|'open'|null) → 같으면 더 빨리 확정 */
  update(r, now, dt, support = null) {
    const C = this.cfg;
    if (!r.ok) {
      this.quality = Math.max(0, this.quality - dt * 2);
      this.note = '얼굴이 보이지 않아요';
      if (now - this.lastSeen > this.lostMs) { this.state = 'unknown'; this.level = 'unknown'; }
      return;
    }
    this.lastSeen = now;
    // 인식 신뢰도: 얼굴 방향·크기
    const turned = Math.abs(r.yaw) > C.maxYaw, small = r.size < C.minFace, close = r.size > C.maxFace;
    this.quality = turned || small || close ? 0.3 : 1 - Math.min(0.5, Math.abs(r.yaw));
    if (turned || small || close) {
      this.note = turned ? '얼굴을 정면으로 향해 주세요' : small ? '조금 더 가까이 와 주세요' : '조금 뒤로 물러나 주세요';
      this.pending = null; this.pendingMs = 0;           // 불안정할 때는 상태를 바꾸지 않음
      return;
    }
    this.lastGood = now;
    this.note = '';
    // 시간 기반 지수 이동 평균
    const v = this.normalize(r);
    const a = 1 - Math.exp(-dt / C.smoothSec);
    this.open += (v - this.open) * a;

    // 히스테리시스: 다문 입 → 벌림은 openAbove를 넘어야, 벌림 → 다문 입은 closeBelow 아래로 내려가야
    const o = this.open;
    if (this.level === 'unknown') this.level = o < (C.closeBelow + C.openAbove) / 2 ? 'closed' : 'slight';
    else if (this.level === 'closed') { if (o > C.openAbove) this.level = o > C.wideAbove ? 'wide' : 'slight'; }
    else if (o < C.closeBelow) this.level = 'closed';
    else this.level = o > C.wideAbove ? 'wide' : 'slight';

    const desire = this.level === 'closed' ? 'closed' : 'open';
    // 말하는 중 판단: 짧은 시간 안에 열림/닫힘이 여러 번 바뀌면
    if (this.lastDesire && desire !== this.lastDesire) this.flips.push(now);
    this.lastDesire = desire;
    while (this.flips.length && now - this.flips[0] > C.talkWindowMs) this.flips.shift();
    this.talking = this.flips.length >= C.talkFlips;
    if (this.talking) { this.note = '말하는 중으로 보여요 — 잠시 그대로 둘게요'; this.pending = null; this.pendingMs = 0; return; }

    if (this.state === 'unknown') { this.state = desire; return; }
    if (desire === this.state) { this.pending = null; this.pendingMs = 0; return; }
    // 일정 시간 같은 상태가 이어져야 바꿈 (어깨도 같은 방향이면 더 빨리)
    if (this.pending !== desire) { this.pending = desire; this.pendingMs = 0; }
    this.pendingMs += dt * 1000;
    let need = desire === 'open' ? C.holdOpenMs : C.holdCloseMs;
    if (support === desire) need *= C.agreeFactor;
    if (this.pendingMs >= need) { this.state = desire; this.pending = null; this.pendingMs = 0; }
  }

  /* 입 모양을 지금 믿을 수 있는지 */
  available(now) { return this.state !== 'unknown' && now - this.lastGood <= this.lostMs; }
  /* 얼굴이 보이지만 잠깐 불안정한 중인지 (이때는 상태를 그대로 유지) */
  holding(now) { return now - this.lastSeen <= this.lostMs && !this.available(now); }
}

/* 보정 결과 계산: 다문 입·벌린 입 샘플로 개인 기준값 만들기. 차이가 작으면 null */
export function computeCalibration(closed, opened, cfg) {
  const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  if (closed.length < cfg.calibMinSamples || opened.length < cfg.calibMinSamples) return { ok: false, reason: 'samples' };
  const jc = med(closed.map(s => s.jaw)), jo = med(opened.map(s => s.jaw));
  const rc = med(closed.map(s => s.ratio)), ro = med(opened.map(s => s.ratio));
  const jawDiff = jo - jc, ratioDiff = ro - rc;
  if (!(jawDiff >= cfg.calibMinJawDiff || ratioDiff >= cfg.calibMinRatioDiff)) return { ok: false, reason: 'diff', jawDiff, ratioDiff };
  return { ok: true, calib: { jawUsable: jawDiff >= cfg.calibMinJawDiff, ratioUsable: ratioDiff >= cfg.calibMinRatioDiff, jawClosed: jc, jawOpen: Math.max(jo, jc + 0.05), ratioClosed: rc, ratioOpen: Math.max(ro, rc + 0.03) }, jawDiff, ratioDiff };
}
