/* 콩팥 해부 탐구 — 평면 그림 3장 (배설 기관 · 콩팥 단면 · 네프론)
   - 혈관은 모두 같은 색이고, 흐르는 방향의 화살표로 동맥과 정맥을 구분해요.
   - 오줌은 노란 알갱이가 흐르는 모습으로 보여 줘요.
   각 장면: { viewBox, svg(그림), anchors(빈칸이 가리키는 점), slots(빈칸 자리), pad(양옆 빈칸 자리 너비) } */

const VES = '#e8798a', VES_D = '#b8505f', VES_H = '#ffc9cf';   // 혈관 (동맥·정맥 같은 색)
const URI = '#f1c879', URI_D = '#c99a45', URI_H = '#fff0c8';   // 오줌이 지나는 길
const KID_D = '#b85d4f';

/* ---------- 도구 ---------- */
let uid = 0;
/* 흐름 표시: 경로를 따라 움직이는 화살표 · 알갱이 */
function flow(d, { n = 3, dur = 3, kind = 'arrow' } = {}) {
  const id = 'fp' + (uid++);
  const mark = kind === 'arrow'
    ? '<path d="M-6,-5 L7,0 L-6,5 Z" fill="#fff" stroke="rgba(80,20,30,.35)" stroke-width="1"/>'
    : '<circle r="4" fill="#fff6b8" stroke="#d9a030" stroke-width="1.2"/>';
  let s = `<path id="${id}" d="${d}" fill="none" stroke="none"/>`;
  for (let i = 0; i < n; i++) s += `<g>${mark}<animateMotion dur="${dur}s" begin="${(-dur * i / n).toFixed(2)}s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}"/></animateMotion></g>`;
  return s;
}
/* 둥근 관: 테두리 · 바탕 · 윗쪽 빛 (입체감) */
function tube(d, w, [c, cd, ch], extra = '') {
  const o = (w * 0.18).toFixed(1);
  return `<g ${extra}><path d="${d}" fill="none" stroke="${cd}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${ch}" stroke-width="${(w * 0.28).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".6" transform="translate(-${o} -${o})"/></g>`;
}
const VESSEL = [VES, VES_D, VES_H], URINE = [URI, URI_D, URI_H];

/* 점들을 부드러운 곡선으로 (Catmull-Rom) */
function smooth(pts, step = 3) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const toD = pts => 'M' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L');
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* 콩팥 모양 (콩팥 문이 왼쪽, 가운데가 0,0, 높이 190) */
const BEAN = 'M12,-95 C64,-97 78,-42 75,4 C72,56 54,95 6,95 C-34,95 -56,66 -50,42 C-46,26 -24,22 -22,2 C-20,-18 -44,-24 -50,-42 C-57,-66 -36,-93 12,-95 Z';

/* ================= 1단계: 배설 기관 ================= */
function organs() {
  const defs = `
    <radialGradient id="kidG" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#f5ab97"/><stop offset=".6" stop-color="#df8270"/><stop offset="1" stop-color="#c4685a"/></radialGradient>
    <radialGradient id="bladG" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#fde6b5"/><stop offset=".65" stop-color="#f1c47a"/><stop offset="1" stop-color="#d9a24f"/></radialGradient>
    <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".1" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="vmask" maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="700"><rect x="200" y="14" width="200" height="460" fill="url(#fadeG)"/><rect x="0" y="150" width="600" height="160" fill="#fff"/></mask>`;
  const kidney = (cx, cy, flip) => `<g transform="translate(${cx} ${cy}) scale(${flip ? -0.9 : 0.9} 0.9)">
      <path d="${BEAN}" fill="url(#kidG)" stroke="${KID_D}" stroke-width="3"/>
      <path d="M44,-72 C62,-52 66,-20 64,6" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".28"/>
      <path d="M-20,-12 C-14,-4 -14,10 -20,18 L-30,22 C-34,8 -34,-4 -30,-16 Z" fill="${URI}" opacity=".9"/></g>`;
  const rA = 'M297,232 C340,236 380,240 424,246', lA = 'M279,230 C250,232 215,236 186,240';
  const lV = 'M311,214 C270,212 225,218 186,226', rV = 'M333,220 C365,224 395,228 424,232';
  const lU = 'M190,252 C200,300 215,350 236,410 C248,446 256,474 266,494';
  const rU = 'M420,262 C410,310 392,360 368,410 C354,442 343,472 334,494';
  const svg = `<defs>${defs}</defs>
    <g mask="url(#vmask)">
      ${tube(rA, 8, VESSEL)}
      ${tube('M288,20 V470', 20, VESSEL)}
      ${tube(lA, 8, VESSEL)}
      ${tube('M322,20 V470', 22, VESSEL)}
      ${tube(lV, 9, VESSEL)}${tube(rV, 9, VESSEL)}
    </g>
    ${kidney(160, 236, true)}${kidney(446, 246, false)}
    ${tube(lU, 7, URINE)}${tube(rU, 7, URINE)}
    <path d="M300,466 C354,464 388,492 386,530 C384,568 348,594 320,602 C311,605 306,608 300,608 C294,608 289,605 280,602 C252,594 216,568 214,530 C212,492 246,464 300,466 Z" fill="url(#bladG)" stroke="${URI_D}" stroke-width="3"/>
    <path d="M246,500 C256,486 272,478 290,476" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".45"/>
    ${tube('M300,606 C300,622 300,636 300,652', 8, URINE)}
    ${flow('M288,30 V460', { n: 4, dur: 4.5 })}
    ${flow('M322,460 V30', { n: 4, dur: 4.5 })}
    ${flow(lA, { n: 2, dur: 2 })}${flow(rA, { n: 2, dur: 2 })}
    ${flow('M186,226 C225,218 270,212 311,214', { n: 2, dur: 2 })}
    ${flow('M424,232 C395,228 365,224 333,220', { n: 2, dur: 2 })}
    ${flow(lU, { n: 5, dur: 4, kind: 'dot' })}${flow(rU, { n: 5, dur: 4, kind: 'dot' })}
    ${flow('M300,606 C300,622 300,636 300,652', { n: 2, dur: 1.4, kind: 'dot' })}`;
  return {
    viewBox: '40 10 520 650', svg, pad: [250, 250],
    anchors: { kidney: [132, 212], ureter: [391, 352], bladder: [342, 540], urethra: [300, 638] },
    slots: { kidney: ['left', 0.24], ureter: ['right', 0.42], bladder: ['right', 0.68], urethra: ['left', 0.86] },
  };
}

/* ================= 2단계: 콩팥 단면 ================= */
function section() {
  seed = 11;
  const DEG = Math.PI / 180, S = [-6, 0];
  const at = (a, r) => [S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r];
  const rr = a => 0.97 / Math.sqrt((Math.cos(a) / 76) ** 2 + (Math.sin(a) / 93) ** 2);
  const P = [-118, -78, -38, 2, 42, 82, 120].map(d => ({ a: d * DEG, r1: 30, r2: rr(d * DEG) * 0.72, h: 15 * DEG }));
  const f = p => p.map(v => v.toFixed(1)).join(',');
  let pyr = '', calyx = '', calyxD = '', ves = '';
  for (const p of P) {
    const m = (p.r1 + p.r2) / 2;
    const d = `M${f(at(p.a - p.h * .42, p.r1 + 4))} Q${f(at(p.a, p.r1 - 5))} ${f(at(p.a + p.h * .42, p.r1 + 4))}
      Q${f(at(p.a + p.h * 1.12, m))} ${f(at(p.a + p.h * 1.05, p.r2))} Q${f(at(p.a, p.r2 + 8))} ${f(at(p.a - p.h * 1.05, p.r2))}
      Q${f(at(p.a - p.h * 1.12, m))} ${f(at(p.a - p.h * .42, p.r1 + 4))} Z`;
    let lines = '';
    for (let k = -5; k <= 5; k++) lines += `<path d="M${f(at(p.a, p.r1))} L${f(at(p.a + k / 5 * p.h * 1.1, p.r2 + 6))}" />`;
    const cid = 'pc' + (uid++);
    pyr += `<clipPath id="${cid}"><path d="${d}"/></clipPath><path d="${d}" fill="url(#medG)"/><g stroke="#e7928a" stroke-width=".5" opacity=".55" clip-path="url(#${cid})">${lines}</g>`;
    const cup = at(p.a, p.r1 - 3), mid = at(p.a, 15);
    calyx += `<path d="M-12,4 Q${f(mid)} ${f(cup)}" stroke-width="6"/><circle cx="${cup[0].toFixed(1)}" cy="${cup[1].toFixed(1)}" r="7.5"/>`;
    calyxD += `<path d="M-12,4 Q${f(mid)} ${f(cup)}" stroke-width="8"/><circle cx="${cup[0].toFixed(1)}" cy="${cup[1].toFixed(1)}" r="8.6"/>`;
  }
  P.forEach((p, i) => {
    const q = P[i + 1]; if (!q) return;
    const g = (p.a + q.a) / 2, r2 = Math.min(p.r2, q.r2);
    ves += `<path d="M-16,${(-4 + i * 1.2).toFixed(1)} Q${f(at(g, 14))} ${f(at(g, 30))} L${f(at(g, r2 + 2))}"/>`;
    const arc = [];
    for (let t = -1; t <= 1.001; t += 0.25) arc.push(at(g + t * 18 * DEG, r2 + 5));
    ves += `<path d="${toD(smooth(arc, 1))}"/>`;
    for (const t of [-0.6, 0.6]) {
      const a = g + t * 18 * DEG;
      ves += `<path d="M${f(at(a, r2 + 5))} L${f(at(a + (rnd() - 0.5) * 0.06, rr(a) * 0.9))}" stroke-width=".9"/>`;
    }
  });
  const hull = [[-24, -18], ...P.map(p => at(p.a, 19)), [-26, 24]];
  const pelvis = (extra) => `<ellipse cx="-11" cy="5" rx="${16 + extra}" ry="${25 + extra}"/>
      <path d="${toD(hull)} Z" stroke-width="${2 + extra * 2}" stroke-linejoin="round"/>
      <path d="M-20,20 C-34,34 -48,52 -54,84 C-57,104 -57,124 -57,150" fill="none" stroke-width="${10 + extra * 2}" stroke-linecap="round"/>`;
  const NS = at(-40 * DEG, rr(-40 * DEG) * 0.86);
  const K = 2.25, T = [330, 300];
  const L = ([x, y]) => [T[0] + x * K, T[1] + y * K];
  const vein = `M70,${L([0, -11])[1]} C150,${L([0, -12])[1]} 220,${L([0, -10])[1]} ${L([-22, -8]).join(',')}`;
  const artery = `M70,${L([0, 12])[1]} C150,${L([0, 12])[1]} 220,${L([0, 9])[1]} ${L([-22, 8]).join(',')}`;
  const ureterScene = `M${L([-20, 20]).join(',')} C${L([-34, 34]).join(' ')} ${L([-48, 52]).join(' ')} ${L([-54, 84]).join(',')} C${L([-57, 104]).join(' ')} ${L([-57, 124]).join(' ')} ${L([-57, 150]).join(',')}`;
  const svg = `<defs>
      <radialGradient id="corG" cx=".55" cy=".45" r=".6"><stop offset="0" stop-color="#f3b2a0"/><stop offset=".8" stop-color="#e99682"/><stop offset="1" stop-color="#d97c69"/></radialGradient>
      <radialGradient id="medG" gradientUnits="userSpaceOnUse" cx="-6" cy="0" r="80"><stop offset=".3" stop-color="#b9504f"/><stop offset="1" stop-color="#d0706a"/></radialGradient>
      <filter id="goo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/></filter>
    </defs>
    ${tube(vein, 18, VESSEL)}${tube(artery, 14, VESSEL)}
    <g transform="translate(${T[0]} ${T[1]}) scale(${K})">
      <path d="${BEAN}" fill="url(#corG)" stroke="${KID_D}" stroke-width="1.6"/>
      <path d="${BEAN}" fill="none" stroke="#f8c8ba" stroke-width=".8" transform="scale(.955)" opacity=".8"/>
      <g fill="none" stroke="${VES}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ves}</g>
      ${pyr}
      <g filter="url(#goo)" fill="${URI_D}" stroke="${URI_D}" stroke-linecap="round">${calyxD}${pelvis(1.2)}</g>
      <g filter="url(#goo)" fill="${URI}" stroke="${URI}" stroke-linecap="round">${calyx}${pelvis(0)}</g>
      <path d="M-22,-8 C-18,0 -18,10 -22,16" fill="none" stroke="${URI_H}" stroke-width="2" stroke-linecap="round" opacity=".6"/>
      <circle cx="${NS[0].toFixed(1)}" cy="${NS[1].toFixed(1)}" r="7" fill="none" stroke="#ffd43b" stroke-width="2.4"><animate attributeName="r" values="6;8;6" dur="1.4s" repeatCount="indefinite"/></circle>
    </g>
    ${flow(artery, { n: 3, dur: 2.4 })}
    ${flow(`M${L([-22, -8]).join(',')} C220,${L([0, -10])[1]} 150,${L([0, -12])[1]} 70,${L([0, -11])[1]}`, { n: 3, dur: 2.4 })}
    ${flow(ureterScene, { n: 5, dur: 3, kind: 'dot' })}`;
  return {
    viewBox: '50 70 470 480', svg, pad: [250, 250],
    anchors: { vein: [120, L([0, -11])[1]], artery: [120, L([0, 12])[1]], ureter2: L([-57, 120]), nephron: L(NS) },
    slots: { vein: ['left', 0.30], artery: ['left', 0.47], ureter2: ['left', 0.80], nephron: ['right', 0.22] },
  };
}

/* ================= 3단계: 네프론 ================= */
function nephron() {
  seed = 5;
  const G = [188, 172], RO = 64, RI = 50;
  const pol = (r, deg) => [G[0] + r * Math.cos(deg * Math.PI / 180), G[1] + r * Math.sin(deg * Math.PI / 180)];
  const f = p => p.map(v => v.toFixed(1)).join(',');

  // 세뇨관: 보먼주머니 → 구불구불 → 아래로 내려갔다 올라오는 고리 → 구불구불 → 오줌관 쪽으로
  const tub = smooth([pol(RO, 22), [276, 214], [298, 192], [322, 210], [316, 238], [342, 250], [362, 280], [362, 340], [362, 430], [364, 470],
    [387, 494], [409, 470], [410, 420], [410, 330], [418, 298], [446, 302], [462, 274], [490, 284], [506, 252], [534, 244], [556, 226],
    [561, 262], [561, 400], [561, 560]], 2);
  const len = [0];
  for (let i = 1; i < tub.length; i++) len.push(len[i - 1] + Math.hypot(tub[i][0] - tub[i - 1][0], tub[i][1] - tub[i - 1][1]));
  // 모세혈관: 세뇨관을 감싸며 물결치듯 따라가요
  const wrap = [];
  for (let i = 1; i < tub.length - 1; i++) {
    const s = len[i];
    if (s < 60 || tub[i][1] < 200 && tub[i][0] > 540) continue;
    if (tub[i][0] > 548 && tub[i][1] > 230) break;
    const dx = tub[i + 1][0] - tub[i - 1][0], dy = tub[i + 1][1] - tub[i - 1][1], n = Math.hypot(dx, dy);
    const A = 15 + 3 * Math.sin(s / 60 * Math.PI * 2);
    wrap.push([tub[i][0] - dy / n * A, tub[i][1] + dx / n * A]);
  }
  // 좁게 꺾이는 곳이 엉키지 않도록 고르게 펴 줘요
  for (let pass = 0; pass < 3; pass++) {
    const c = wrap.map(p => p.slice());
    for (let i = 4; i < wrap.length - 4; i++) for (const j of [0, 1]) { let t = 0; for (let k = -4; k <= 4; k++) t += c[i + k][j]; wrap[i][j] = t / 9; }
  }
  const efferent = smooth([pol(RI - 6, 196), pol(RO + 6, 196), [138, 236], [172, 258], [214, 254], wrap[0]], 3);
  const venule = smooth([wrap[wrap.length - 1], [590, 236], [606, 300], [608, 450], [604, 600]], 3);
  const capPts = [...efferent, ...wrap.slice(1), ...venule.slice(1)];
  const capD = toD(capPts);
  const afferent = `M14,112 C70,110 112,128 ${f(pol(RO + 4, 168))} L${f(pol(RI - 8, 172))}`;

  // 토리: 모세혈관이 실타래처럼 뭉친 모양
  const tangle = [];
  for (let i = 0; i < 30; i++) { const a = i * 2.39996, r = 38 * Math.sqrt(0.15 + 0.85 * rnd()); tangle.push([G[0] + 2 + r * Math.cos(a), G[1] + r * Math.sin(a)]); }
  const tangleD = toD(smooth([pol(RI - 8, 172), ...tangle, pol(RI - 6, 196)], 2));

  // 보먼주머니: 두 겹 컵 (왼쪽이 혈관이 드나드는 입구)
  const cup = `M${f(pol(RO, 206))} A${RO},${RO} 0 1 1 ${f(pol(RO, 154))} L${f(pol(RI, 154))} A${RI},${RI} 0 1 0 ${f(pol(RI, 206))} Z`;
  const svg = `<defs>
      <radialGradient id="capsG" cx=".5" cy=".5" r=".5"><stop offset=".7" stop-color="#fff6dc"/><stop offset="1" stop-color="#fbe5a8"/></radialGradient>
    </defs>
    ${tube(capD, 5, VESSEL)}
    ${tube(toD(tub), 16, URINE)}
    <circle cx="${G[0]}" cy="${G[1]}" r="${RO}" fill="url(#capsG)"/>
    <path d="${cup}" fill="#f6d68e" stroke="${URI_D}" stroke-width="2.5" stroke-linejoin="round"/>
    ${tube(afferent, 9, VESSEL)}
    ${tube(tangleD, 4.5, VESSEL)}
    ${tube(toD(efferent), 6, VESSEL)}
    ${flow(afferent, { n: 2, dur: 1.8 })}
    ${flow(capD, { n: 10, dur: 12 })}
    ${flow(toD(tub), { n: 10, dur: 11, kind: 'dot' })}
    <g transform="translate(561 600)"><rect x="-62" y="-6" width="124" height="34" rx="10" fill="rgba(8,18,30,.8)"/>
      <text x="0" y="17" text-anchor="middle" font-size="17" font-weight="700" fill="#ffe8a3" font-family="Noto Sans KR, sans-serif">오줌관으로 ↓</text></g>`;
  const near = (pts, test) => pts.reduce((b, p) => (test(p) < test(b) ? p : b));
  return {
    viewBox: '0 80 650 560', svg, pad: [270, 10],
    anchors: {
      tori: [G[0] + 2, G[1]],
      bowman: pol(RO - 2, 95),
      capillary: near(wrap, p => (p[0] < 385 ? Math.abs(p[1] - 370) : 999) + Math.abs(p[0] - 348) * 0.3),
      tubule: [364, 462],
    },
    slots: { tori: ['left', 0.18], bowman: ['left', 0.38], capillary: ['left', 0.62], tubule: ['left', 0.84] },
  };
}

export const SCENES = [organs(), section(), nephron()];
