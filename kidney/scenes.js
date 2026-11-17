/* 콩팥 해부 탐구 — 평면 그림 3장 (배설 기관 · 콩팥 단면 · 네프론)
   - 혈관은 모두 같은 색이고, 흐르는 방향의 화살표로 동맥과 정맥을 구분해요.
   - 오줌은 노란 알갱이가 흐르는 모습으로 보여 줘요.
   각 장면: { viewBox, svg(그림), anchors(빈칸이 가리키는 점), slots(빈칸 자리), pad(양옆 빈칸 자리 너비) } */

const VES = '#ef7f8c', VES_D = '#c4566a';          // 혈관 (동맥·정맥 같은 색)
const URI = '#f7cf6e', URI_D = '#d9a63d';          // 오줌이 지나는 길
const KID = '#e98e7c', KID_D = '#c4665a';          // 콩팥 겉
const MED = '#cf6b66';                             // 속질(콩팥 피라미드)

/* 흐름 표시: 경로를 따라 움직이는 화살표 · 알갱이 */
let uid = 0;
function flow(d, { n = 3, dur = 3, kind = 'arrow', show = false } = {}) {
  const id = 'fp' + (uid++);
  const mark = kind === 'arrow'
    ? '<path d="M-7,-6 L8,0 L-7,6 Z" fill="#fff" stroke="rgba(0,0,0,.25)" stroke-width="1"/>'
    : '<circle r="4.5" fill="#fff3a6" stroke="#e0a930" stroke-width="1.2"/>';
  let s = `<path id="${id}" d="${d}" fill="none" ${show ? '' : 'stroke="none"'}/>`;
  for (let i = 0; i < n; i++) {
    s += `<g>${mark}<animateMotion dur="${dur}s" begin="${(-dur * i / n).toFixed(2)}s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}"/></animateMotion></g>`;
  }
  return s;
}
const tube = (d, w, c, cd) => `<path d="${d}" fill="none" stroke="${cd}" stroke-width="${w + 5}" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

/* 콩팥 모양 (콩팥 문이 왼쪽, 가운데가 0,0, 높이 190) */
const BEAN = 'M10,-95 C62,-98 77,-40 74,5 C71,56 52,95 5,95 C-36,95 -58,62 -50,38 C-44,22 -20,20 -20,0 C-20,-20 -44,-22 -50,-40 C-58,-64 -36,-93 10,-95 Z';

/* ================= 1단계: 배설 기관 ================= */
function organs() {
  const fade = `<linearGradient id="vfade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${VES}" stop-opacity="0"/><stop offset=".08" stop-color="${VES}"/><stop offset=".9" stop-color="${VES}"/><stop offset="1" stop-color="${VES}" stop-opacity="0"/></linearGradient>`;
  const kidney = (cx, cy, flip) => `<g transform="translate(${cx} ${cy}) scale(${flip ? -0.86 : 0.86} 0.86)">
      <path d="${BEAN}" fill="${KID}" stroke="${KID_D}" stroke-width="5"/>
      <path d="M40,-70 C58,-50 62,-20 60,5" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".35"/></g>`;
  const svg = `<defs>${fade}</defs>
    <rect x="273" y="20" width="24" height="470" rx="12" fill="url(#vfade)"/>
    <rect x="309" y="20" width="26" height="470" rx="13" fill="url(#vfade)"/>
    ${tube('M297,218 C320,222 400,226 432,230', 9, VES, VES_D)}
    ${kidney(160, 230, true)}${kidney(450, 240, false)}
    ${tube('M273,214 C250,216 205,222 178,226', 9, VES, VES_D)}
    ${tube('M309,200 C280,200 230,206 182,214', 10, VES, VES_D)}
    ${tube('M335,204 C360,210 400,220 434,228', 10, VES, VES_D)}
    ${tube('M178,246 C200,300 245,380 268,488', 10, URI, URI_D)}
    ${tube('M432,258 C410,310 360,390 334,488', 10, URI, URI_D)}
    <path d="M300,470 C365,470 382,505 380,540 C378,580 345,600 300,600 C255,600 222,580 220,540 C218,505 235,470 300,470 Z" fill="${URI}" stroke="${URI_D}" stroke-width="5"/>
    <path d="M250,500 C258,488 272,482 286,480" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".5"/>
    ${tube('M300,600 V650', 12, URI, URI_D)}
    ${flow('M285,40 V480', { n: 4, dur: 4 })}
    ${flow('M322,480 V40', { n: 4, dur: 4 })}
    ${flow('M273,214 C250,216 205,222 178,226', { n: 2, dur: 2 })}
    ${flow('M335,204 C360,210 400,220 434,228', { n: 2, dur: 2 })}
    ${flow('M182,214 C230,206 280,200 309,200', { n: 2, dur: 2 })}
    ${flow('M432,230 C400,226 340,222 309,219', { n: 2, dur: 2 })}
    ${flow('M178,246 C200,300 245,380 268,488', { n: 5, dur: 4, kind: 'dot' })}
    ${flow('M432,258 C410,310 360,390 334,488', { n: 5, dur: 4, kind: 'dot' })}
    ${flow('M300,600 V650', { n: 2, dur: 1.6, kind: 'dot' })}`;
  return {
    viewBox: '40 10 520 650', svg, pad: [250, 250],
    anchors: { kidney: [132, 205], ureter: [392, 340], bladder: [345, 548], urethra: [300, 632] },
    slots: { kidney: ['left', 0.24], ureter: ['right', 0.42], bladder: ['right', 0.68], urethra: ['left', 0.86] },
  };
}

/* ================= 2단계: 콩팥 단면 ================= */
function section() {
  const DEG = Math.PI / 180, S = [-6, 0];
  const at = (a, r) => [S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r];
  const rr = a => 0.97 / Math.sqrt((Math.cos(a) / 76) ** 2 + (Math.sin(a) / 93) ** 2);
  const P = [-118, -76, -36, 4, 44, 84, 120].map(d => ({ a: d * DEG, r1: 30, r2: rr(d * DEG) * 0.74, h: 15 * DEG }));
  const f = p => p.map(v => v.toFixed(1)).join(',');
  let pyr = '', calyx = '', ves = '';
  for (const p of P) {
    const m = (p.r1 + p.r2) / 2;
    pyr += `<path d="M${f(at(p.a - p.h * .45, p.r1 + 5))} Q${f(at(p.a, p.r1 - 6))} ${f(at(p.a + p.h * .45, p.r1 + 5))}
      Q${f(at(p.a + p.h * 1.15, m))} ${f(at(p.a + p.h * 1.1, p.r2))} Q${f(at(p.a, p.r2 + 9))} ${f(at(p.a - p.h * 1.1, p.r2))}
      Q${f(at(p.a - p.h * 1.15, m))} ${f(at(p.a - p.h * .45, p.r1 + 5))} Z" fill="${MED}" stroke="#b55556" stroke-width="1.6"/>`;
    calyx += `<path d="M-14,4 Q${f(at(p.a, 14))} ${f(at(p.a, p.r1 - 4))}" fill="none" stroke="${URI}" stroke-width="6" stroke-linecap="round"/>
      <circle cx="${at(p.a, p.r1 - 3)[0].toFixed(1)}" cy="${at(p.a, p.r1 - 3)[1].toFixed(1)}" r="5.5" fill="${URI}"/>`;
  }
  P.forEach((p, i) => {
    const q = P[i + 1]; if (!q) return;
    const g = (p.a + q.a) / 2, r2 = Math.min(p.r2, q.r2);
    ves += `<path d="M-16,-6 Q${f(at(g, 16))} ${f(at(g, 32))} L${f(at(g, r2 + 2))}" fill="none" stroke="${VES}" stroke-width="2.6" stroke-linecap="round"/>`;
    const arc = [];
    for (let t = -1; t <= 1.001; t += 0.25) arc.push(f(at(g + t * 17 * DEG, r2 + 5)));
    ves += `<path d="M${arc.join(' L')}" fill="none" stroke="${VES}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const NS = at(-40 * DEG, rr(-40 * DEG) * 0.86);
  const K = 2.25, T = [330, 300];
  const L = ([x, y]) => [T[0] + x * K, T[1] + y * K];            // 콩팥 안 좌표 → 그림 좌표
  const svg = `
    ${tube(`M70,${L([0, -10])[1]} C150,${L([0, -12])[1]} 220,${L([0, -10])[1]} ${L([-24, -9]).join(',')}`, 18, VES, VES_D)}
    ${tube(`M70,${L([0, 12])[1]} C150,${L([0, 12])[1]} 220,${L([0, 10])[1]} ${L([-24, 9]).join(',')}`, 14, VES, VES_D)}
    ${tube(`M${L([-26, 26]).join(',')} C${L([-48, 50]).join(' ')} ${L([-60, 80]).join(' ')} ${L([-60, 140]).join(',')}`, 22, URI, URI_D)}
    <g transform="translate(${T[0]} ${T[1]}) scale(${K})">
      <path d="${BEAN}" fill="${KID}" stroke="${KID_D}" stroke-width="2.6"/>
      <path d="${BEAN}" fill="none" stroke="#f6b3a3" stroke-width="1.2" transform="scale(.94)" opacity=".7"/>
      ${ves}${pyr}${calyx}
      <ellipse cx="-16" cy="8" rx="11" ry="24" fill="${URI}"/>
      <path d="M-22,24 C-24,26 -26,28 -27,30" stroke="${URI}" stroke-width="12" stroke-linecap="round"/>
      <circle cx="${NS[0].toFixed(1)}" cy="${NS[1].toFixed(1)}" r="7" fill="none" stroke="#ffd43b" stroke-width="2.6"><animate attributeName="r" values="6;8;6" dur="1.4s" repeatCount="indefinite"/></circle>
    </g>
    ${flow(`M70,${L([0, 12])[1]} C150,${L([0, 12])[1]} 220,${L([0, 10])[1]} ${L([-24, 9]).join(',')}`, { n: 3, dur: 2.4 })}
    ${flow(`M${L([-24, -9]).join(',')} C220,${L([0, -10])[1]} 150,${L([0, -12])[1]} 70,${L([0, -10])[1]}`, { n: 3, dur: 2.4 })}
    ${flow(`M${L([-26, 26]).join(',')} C${L([-48, 50]).join(' ')} ${L([-60, 80]).join(' ')} ${L([-60, 140]).join(',')}`, { n: 5, dur: 3, kind: 'dot' })}`;
  return {
    viewBox: '50 70 470 480', svg, pad: [250, 250],
    anchors: { vein: [120, L([0, -10])[1]], artery: [120, L([0, 12])[1]], ureter2: L([-60, 110]), nephron: L(NS) },
    slots: { vein: ['left', 0.30], artery: ['left', 0.47], ureter2: ['left', 0.80], nephron: ['right', 0.22] },
  };
}

/* ================= 3단계: 네프론 ================= */
function nephron() {
  const tubule = 'M232,214 C270,240 300,190 330,215 C360,240 330,280 360,300 L362,470 C362,505 412,505 412,470 L412,320 C412,280 450,270 470,240 C490,210 530,200 560,210 L560,560';
  const capIn = 'M20,110 C70,110 110,130 152,150';
  const capNet = 'M150,196 C120,250 150,300 335,300 C330,360 340,420 338,480 C338,530 436,535 436,480 L436,330 C440,300 470,300 490,268 C510,240 540,236 585,240';
  const veinOut = 'M585,240 C610,260 612,560 600,580';
  const glom = [[-16, -12, 17], [10, -20, 16], [22, 4, 17], [4, 22, 16], [-20, 12, 15], [0, 0, 15]]
    .map(([x, y, r]) => `<circle cx="${188 + x}" cy="${172 + y}" r="${r}" fill="none" stroke="${VES}" stroke-width="7"/>`).join('');
  const rungs = [[350, 330], [350, 380], [350, 430], [424, 360], [424, 410], [424, 450]]
    .map(([x, y]) => `<path d="M${x - 14},${y} H${x + 14}" stroke="${VES}" stroke-width="5" stroke-linecap="round"/>`).join('');
  const svg = `
    ${tube(tubule, 18, URI, URI_D)}
    <circle cx="190" cy="172" r="68" fill="#fff4d2"/>
    <path d="M131.1,138 A68,68 0 1 1 131.1,206" fill="none" stroke="${URI_D}" stroke-width="5" stroke-linecap="round"/>
    <path d="M141.5,144 A56,56 0 1 1 141.5,200" fill="none" stroke="${URI_D}" stroke-width="2" opacity=".55"/>
    ${tube(capIn, 9, VES, VES_D)}
    ${tube(capNet, 7, VES, VES_D)}
    ${tube(veinOut, 9, VES, VES_D)}
    ${glom}${rungs}
    ${flow(capIn, { n: 2, dur: 1.8 })}
    ${flow(capNet, { n: 6, dur: 7 })}
    ${flow(veinOut, { n: 2, dur: 2.2 })}
    ${flow(tubule, { n: 9, dur: 9, kind: 'dot' })}
    <g transform="translate(560 600)"><rect x="-62" y="-6" width="124" height="34" rx="10" fill="rgba(8,18,30,.8)"/>
      <text x="0" y="17" text-anchor="middle" font-size="17" font-weight="700" fill="#ffe8a3" font-family="Noto Sans KR, sans-serif">오줌관으로 ↓</text></g>`;
  return {
    viewBox: '0 80 650 560', svg, pad: [270, 10],
    anchors: { tori: [188, 172], bowman: [252, 196], capillary: [333, 360], tubule: [362, 470] },
    slots: { tori: ['left', 0.18], bowman: ['left', 0.38], capillary: ['left', 0.62], tubule: ['left', 0.84] },
  };
}

export const SCENES = [organs(), section(), nephron()];
