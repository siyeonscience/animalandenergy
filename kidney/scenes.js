/* 배설계의 구조 — 교과서 그림을 참고한 평면 그림 3장 (배설 기관 · 콩팥 단면 · 네프론)
   - 혈관은 모두 같은 색이고, 흐르는 방향의 화살표로 동맥과 정맥을 구분해요.
   - 오줌은 노란 알갱이가 흐르는 모습으로 보여 줘요.
   각 장면: { viewBox, svg(그림), anchors(빈칸이 가리키는 점), slots(빈칸 자리), pad(양옆 빈칸 자리 너비) } */

const VES = '#e26a62', VES_D = '#b2453f', VES_H = '#ffb9b0';   // 혈관 (동맥·정맥 같은 색)
const URE = '#efdcae', URE_D = '#c9ae78', URE_H = '#fff6dc';   // 오줌관 (연한 살구색)
const TUB = '#f3cf72', TUB_D = '#d2a743', TUB_H = '#fff0bf';   // 세뇨관 (노란색)
const VESSEL = [VES, VES_D, VES_H], URETER = [URE, URE_D, URE_H], TUBULE = [TUB, TUB_D, TUB_H];

/* ---------- 도구 ---------- */
let uid = 0;
function flow(d, { n = 3, dur = 3, kind = 'arrow', s = 1 } = {}) {
  const id = 'fp' + (uid++);
  const mark = kind === 'arrow'
    ? `<path d="M-6,-5 L7,0 L-6,5 Z" fill="#fff" stroke="rgba(90,20,20,.4)" stroke-width="1" transform="scale(${s})"/>`
    : `<circle r="${(4 * s).toFixed(1)}" fill="#fff6b8" stroke="#d9a030" stroke-width="${(1.2 * s).toFixed(2)}"/>`;
  let out = `<path id="${id}" d="${d}" fill="none" stroke="none"/>`;
  for (let i = 0; i < n; i++) out += `<g>${mark}<animateMotion dur="${dur}s" begin="${(-dur * i / n).toFixed(2)}s" repeatCount="indefinite" rotate="auto"><mpath href="#${id}"/></animateMotion></g>`;
  return out;
}
/* 둥근 관: 테두리 · 바탕 · 윗쪽 빛 */
function tube(d, w, [c, cd, ch]) {
  const o = (w * 0.17).toFixed(1);
  return `<g><path d="${d}" fill="none" stroke="${cd}" stroke-width="${(w + Math.max(1.6, w * 0.16)).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${d}" fill="none" stroke="${ch}" stroke-width="${(w * 0.26).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".65" transform="translate(-${o} -${o})"/></g>`;
}
/* 잘린 관 끝 (구멍이 보이게) */
const cutEnd = (x, y, rx, ry, [c, cd]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" stroke="${cd}" stroke-width="1.2"/>
  <ellipse cx="${x}" cy="${y}" rx="${(rx * .6).toFixed(1)}" ry="${(ry * .6).toFixed(1)}" fill="${cd}" opacity=".75"/>`;
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
const sm = (pts, step) => toD(smooth(pts, step));
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* 콩팥 모양 (콩팥 문이 왼쪽, 가운데가 0,0, 높이 190) */
const BEAN = 'M12,-95 C64,-97 78,-42 75,4 C72,56 54,95 6,95 C-34,95 -56,66 -50,42 C-46,26 -24,22 -22,2 C-20,-18 -44,-24 -50,-42 C-57,-66 -36,-93 12,-95 Z';

/* ================= 1단계: 배설 기관 ================= */
function organs() {
  const defs = `
    <radialGradient id="kidG" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#e3a07c"/><stop offset=".6" stop-color="#c97c58"/><stop offset="1" stop-color="#a85f40"/></radialGradient>
    <radialGradient id="bladG" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="#f6c3b6"/><stop offset=".65" stop-color="#e49b8c"/><stop offset="1" stop-color="#c97566"/></radialGradient>
    <linearGradient id="fadeG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".06" stop-color="#fff"/><stop offset=".94" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <mask id="vmask" maskUnits="userSpaceOnUse" x="-20" y="-10" width="300" height="530"><rect x="-20" y="-6" width="300" height="512" fill="url(#fadeG)"/></mask>`;
  const kidney = (cx, cy, flip) => `<g transform="translate(${cx} ${cy}) scale(${flip ? -0.5 : 0.5} 0.5)">
      <path d="${BEAN}" fill="url(#kidG)" stroke="#94513a" stroke-width="2.4"/>
      <path d="M44,-72 C62,-52 66,-20 64,6" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".3"/></g>`;
  // 아래대정맥(왼쪽)과 대동맥(오른쪽): 아래에서 두 갈래로 나뉘어요
  const ivc = ['M110,-4 V258 C110,300 50,330 34,505', 'M110,258 C112,300 200,330 226,505'];
  const ao = ['M140,-4 V262 C140,300 80,330 66,505', 'M140,262 C142,300 180,330 196,505'];
  const lV = 'M110,104 C96,104 86,104 76,104', rV = 'M110,100 C140,92 160,96 176,100';
  const lA = 'M140,112 C116,118 96,114 78,112', rA = 'M140,108 C152,108 164,108 176,110';
  const lU = 'M78,118 C80,170 84,240 92,300 C98,350 104,400 112,446';
  const rU = 'M175,118 C172,170 168,240 164,300 C160,350 156,400 150,446';
  const svg = `<defs>${defs}</defs>
    <g mask="url(#vmask)">
      ${tube(ivc[1], 15, VESSEL)}${tube(ivc[0], 15, VESSEL)}${tube(rA, 6, VESSEL)}
      ${tube(ao[1], 13, VESSEL)}${tube(ao[0], 13, VESSEL)}
      ${tube(lV, 7, VESSEL)}${tube(rV, 7, VESSEL)}${tube(lA, 6, VESSEL)}
    </g>
    ${kidney(52, 108, true)}${kidney(200, 108, false)}
    ${tube(lU, 5, URETER)}${tube(rU, 5, URETER)}
    <path d="M131,440 C162,440 176,456 175,472 C174,489 156,498 138,500 C135,500 133,502 131,502 C129,502 127,500 124,500 C106,498 88,489 87,472 C86,456 100,440 131,440 Z" fill="url(#bladG)" stroke="#b5675a" stroke-width="1.6"/>
    <path d="M100,458 C106,451 114,448 122,447" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".45"/>
    ${tube('M131,501 V518', 4, URETER)}
    ${flow('M140,10 V250', { n: 3, dur: 4, s: .6 })}
    ${flow('M110,250 V10', { n: 3, dur: 4, s: .6 })}
    ${flow(lA, { n: 1, dur: 1.6, s: .5 })}${flow(rA, { n: 1, dur: 1.6, s: .5 })}
    ${flow('M76,104 C86,104 96,104 110,104', { n: 1, dur: 1.6, s: .5 })}
    ${flow('M176,100 C160,96 140,92 110,100', { n: 1, dur: 1.6, s: .5 })}
    ${flow(lU, { n: 5, dur: 4, kind: 'dot', s: .55 })}${flow(rU, { n: 5, dur: 4, kind: 'dot', s: .55 })}
    ${flow('M131,501 V512', { n: 1, dur: 1.2, kind: 'dot', s: .55 })}`;
  return {
    viewBox: '0 0 252 516', svg, pad: [250, 250],
    anchors: { kidney: [38, 96], ureter: [166, 300], bladder: [150, 470], urethra: [131, 508] },
    slots: { kidney: ['left', 0.2], ureter: ['right', 0.5], bladder: ['right', 0.8], urethra: ['left', 0.9] },
  };
}

/* ================= 2단계: 콩팥 단면 ================= */
function section() {
  seed = 11;
  const DEG = Math.PI / 180, S = [-4, 0];
  const at = (a, r) => [S[0] + Math.cos(a) * r, S[1] + Math.sin(a) * r];
  const rr = a => 0.97 / Math.sqrt((Math.cos(a) / 74) ** 2 + (Math.sin(a) / 92) ** 2);
  const P = [-112, -72, -32, 8, 48, 88, 124].map(d => ({ a: d * DEG, r1: 31, r2: rr(d * DEG) * 0.76, h: 15.5 * DEG }));
  const f = p => p.map(v => v.toFixed(1)).join(',');
  let pyr = '', cups = '', cupsD = '', ves = '', hair = '';
  for (const p of P) {
    const m = (p.r1 + p.r2) / 2;
    const d = `M${f(at(p.a - p.h * .45, p.r1 + 5))} Q${f(at(p.a, p.r1 - 6))} ${f(at(p.a + p.h * .45, p.r1 + 5))}
      Q${f(at(p.a + p.h * 1.15, m))} ${f(at(p.a + p.h * 1.08, p.r2))} Q${f(at(p.a, p.r2 + 10))} ${f(at(p.a - p.h * 1.08, p.r2))}
      Q${f(at(p.a - p.h * 1.15, m))} ${f(at(p.a - p.h * .45, p.r1 + 5))} Z`;
    let lines = '';
    for (let k = -6; k <= 6; k++) lines += `<path d="M${f(at(p.a, p.r1))} L${f(at(p.a + k / 6 * p.h * 1.15, p.r2 + 8))}"/>`;
    const cid = 'pc' + (uid++);
    pyr += `<clipPath id="${cid}"><path d="${d}"/></clipPath><path d="${d}" fill="url(#medG)" stroke="#c97a62" stroke-width=".6"/>
      <g stroke="#f2b9a2" stroke-width=".7" opacity=".6" clip-path="url(#${cid})">${lines}</g>`;
    const cup = at(p.a, p.r1 - 2), mid = at(p.a, 16);
    cups += `<path d="M-14,4 Q${f(mid)} ${f(cup)}" stroke-width="7"/><circle cx="${cup[0].toFixed(1)}" cy="${cup[1].toFixed(1)}" r="8.5"/>`;
    cupsD += `<path d="M-14,4 Q${f(mid)} ${f(cup)}" stroke-width="9"/><circle cx="${cup[0].toFixed(1)}" cy="${cup[1].toFixed(1)}" r="9.6"/>`;
    // 피라미드 둘레를 감싸는 혈관 (양옆 + 바닥)
    for (const [side, off] of [[-1, 0], [1, 1.6]]) {
      const pts = [];
      pts.push(at(p.a + side * p.h * 0.6, p.r1 - 4 + off));
      pts.push(at(p.a + side * p.h * 1.32, m));
      pts.push(at(p.a + side * p.h * 1.2, p.r2 + 4 + off));
      pts.push(at(p.a + side * p.h * 0.5, p.r2 + 13 + off));
      pts.push(at(p.a, p.r2 + 14 + off));
      ves += `<path d="${sm(pts, 1)}"/>`;
    }
    for (let k = -4; k <= 4; k++) {
      const a = p.a + k / 4 * p.h * 1.1, r0 = p.r2 + 13 - Math.abs(k) * 1.2;
      hair += `<path d="M${f(at(a, r0))} l${f([Math.cos(a + (rnd() - .5) * .5) * (4 + rnd() * 4), Math.sin(a + (rnd() - .5) * .5) * (4 + rnd() * 4)])}"/>`;
    }
  }
  const hull = [[-24, -18], ...P.map(p => at(p.a, 20)), [-26, 24]];
  const pelvis = extra => `<ellipse cx="-12" cy="6" rx="${15 + extra}" ry="${25 + extra}"/><ellipse cx="2" cy="1" rx="${26 + extra}" ry="${36 + extra}"/>
      <path d="${toD(hull)} Z" stroke-width="${2 + extra * 2}" stroke-linejoin="round"/>`;
  const NS = at(-42 * DEG, rr(-42 * DEG) * 0.88);
  const K = 2.25, T = [330, 300];
  const L = ([x, y]) => [T[0] + x * K, T[1] + y * K];
  const yA = L([0, -12])[1], yV = L([0, 4])[1];
  const artery = `M84,${yA} C150,${yA} 220,${yA + 2} ${L([-24, -8]).join(',')}`;
  const vein = `${L([-24, 6]).join(',')} C220,${yV} 150,${yV} 84,${yV}`;
  const ureter = `M${L([-18, 18]).join(',')} C${L([-36, 36]).join(' ')} ${L([-48, 56]).join(' ')} ${L([-52, 90]).join(',')} C${L([-55, 112]).join(' ')} ${L([-56, 130]).join(' ')} ${L([-56, 152]).join(',')}`;
  const svg = `<defs>
      <radialGradient id="corG" cx=".5" cy=".45" r=".62"><stop offset="0" stop-color="#f4bba3"/><stop offset=".85" stop-color="#eba087"/><stop offset="1" stop-color="#df8c72"/></radialGradient>
      <linearGradient id="sideG" x1="0" y1="0" x2="1" y2="0"><stop offset=".5" stop-color="#b8735a"/><stop offset="1" stop-color="#7f4634"/></linearGradient>
      <radialGradient id="medG" gradientUnits="userSpaceOnUse" cx="-4" cy="0" r="80"><stop offset=".35" stop-color="#cf7a63"/><stop offset="1" stop-color="#e2967e"/></radialGradient>
      <filter id="goo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/><feColorMatrix values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"/></filter>
    </defs>
    <g transform="translate(${T[0]} ${T[1]}) scale(${K})">
      <path d="${BEAN}" fill="url(#sideG)" transform="translate(9 3)"/>
      <path d="${BEAN}" fill="url(#corG)" stroke="#c9775f" stroke-width="1"/>
      <path d="${BEAN}" fill="none" stroke="#f9d6c6" stroke-width="1.4" transform="scale(.955)"/>
      <g filter="url(#goo)" fill="#ad9566" stroke="#ad9566" stroke-linecap="round">${cupsD}${pelvis(1.2)}</g>
      <g filter="url(#goo)" fill="#d8c493" stroke="#d8c493" stroke-linecap="round">${cups}${pelvis(0)}</g>
      <path d="M-20,-10 C-14,0 -14,12 -20,20" fill="none" stroke="#fff3d2" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
      ${pyr}
      <g fill="none" stroke="${VES}" stroke-linecap="round" stroke-linejoin="round">
        <g stroke-width="1.5">${ves}</g><g stroke-width=".7">${hair}</g>
        <path d="M-24,-8 C-12,-10 -4,-12 ${f(at(P[2].a - P[2].h * .9, 32))} M-24,-6 C-12,-4 -6,6 ${f(at(P[4].a - P[4].h * .9, 32))} M-24,-7 C-14,-16 -12,-22 ${f(at(P[0].a + P[0].h * .9, 32))} M-24,-6 C-14,8 -12,18 ${f(at(P[6].a - P[6].h * .9, 32))}" stroke-width="1.6"/>
      </g>
      <circle cx="${NS[0].toFixed(1)}" cy="${NS[1].toFixed(1)}" r="7" fill="none" stroke="#ffd43b" stroke-width="2.4"><animate attributeName="r" values="6;8;6" dur="1.4s" repeatCount="indefinite"/></circle>
    </g>
    ${tube(ureter, 24, URETER)}
    ${tube(artery, 13, VESSEL)}${tube('M' + vein, 16, VESSEL)}
    ${cutEnd(84, yA, 4, 6.5, VESSEL)}${cutEnd(84, yV, 5, 8, VESSEL)}
    ${flow(artery, { n: 3, dur: 2.4 })}
    ${flow('M' + vein, { n: 3, dur: 2.4 })}
    ${flow(ureter, { n: 5, dur: 3, kind: 'dot' })}`;
  return {
    viewBox: '60 70 460 480', svg, pad: [250, 250],
    anchors: { artery: [130, yA], vein: [130, yV], ureter2: L([-56, 122]), nephron: L(NS) },
    slots: { artery: ['left', 0.32], vein: ['left', 0.5], ureter2: ['left', 0.82], nephron: ['right', 0.22] },
  };
}

/* ================= 3단계: 네프론 ================= */
function nephron() {
  // 보먼주머니 (오른쪽 위로 세뇨관이 이어지는 둥근 주머니)
  const B = [300, 236], BR = 58;
  const capsule = `M${B[0] - 50},${B[1] + 28} C${B[0] - 66},${B[1] - 20} ${B[0] - 30},${B[1] - 60} ${B[0] + 14},${B[1] - 58}
    C${B[0] + 36},${B[1] - 57} ${B[0] + 46},${B[1] - 66} ${B[0] + 56},${B[1] - 76} L${B[0] + 74},${B[1] - 58}
    C${B[0] + 62},${B[1] - 44} ${B[0] + 60},${B[1] - 30} ${B[0] + 60},${B[1]}
    C${B[0] + 60},${B[1] + 36} ${B[0] + 30},${B[1] + 60} ${B[0]},${B[1] + 60} C${B[0] - 24},${B[1] + 60} ${B[0] - 42},${B[1] + 48} ${B[0] - 50},${B[1] + 28} Z`;
  // 토리: 들어온 혈관이 여러 고리로 갈라졌다가 다시 모여 나가요
  const pole = [B[0] - 46, B[1] + 6];
  let loops = '';
  [-50, -30, -12, 6, 24, 42].forEach((deg, i) => {
    const a = deg * Math.PI / 180, r = 46 - Math.abs(i - 2.5) * 3;
    const tip = [pole[0] + Math.cos(a) * r * 1.9, pole[1] + Math.sin(a) * r * 1.25];
    const c1 = [pole[0] + Math.cos(a - .32) * r * 1.5, pole[1] + Math.sin(a - .32) * r * 1.4];
    const c2 = [pole[0] + Math.cos(a + .32) * r * 1.5, pole[1] + Math.sin(a + .32) * r * 1.4];
    loops += `M${pole[0]},${pole[1] - 2} Q${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${tip[0].toFixed(1)},${tip[1].toFixed(1)} Q${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${pole[0]},${pole[1] + 2} `;
  });

  // 동맥 · 정맥 줄기 (왼쪽)
  const artery = 'M92,130 V420', vein = 'M140,250 V520';
  const afferent = `M92,330 C120,330 150,322 180,300 C205,282 222,262 ${pole[0]},${pole[1]}`;
  const efferent = `M${pole[0]},${pole[1] - 4} C222,232 196,214 184,186 C170,150 196,108 260,104 C320,100 360,112 400,104`;
  // 세뇨관
  const PCT = sm([[B[0] + 66, B[1] - 66], [392, 140], [418, 104], [450, 112], [458, 152], [430, 180], [404, 214], [420, 250], [456, 246], [476, 214], [494, 232], [490, 290]], 2);
  const DESC = sm([[490, 288], [490, 380], [490, 470]], 3);
  const THIN = 'M490,466 C490,520 492,560 512,566 C532,572 544,556 546,520 L546,470';
  const ASC = sm([[546, 474], [546, 380], [548, 300], [556, 250]], 3);
  const DCT = sm([[556, 252], [576, 214], [612, 228], [624, 190], [596, 160], [600, 124], [640, 110], [676, 128], [688, 160], [700, 168], [732, 170]], 2);
  const DUCT = 'M746,40 V588';
  // 모세혈관 그물 (세뇨관을 감싸요)
  const net = [
    'M400,104 C470,96 540,110 600,96 C650,84 690,80 716,100',
    'M410,104 C400,160 380,214 420,272 C440,300 470,306 520,300 C560,296 600,304 640,290',
    'M480,100 C470,150 520,190 500,240',
    'M560,104 C560,150 540,200 570,240 C590,270 620,262 640,290',
    'M640,90 C650,140 640,190 690,210 C710,220 716,250 700,290 C690,320 660,330 640,320',
    'M420,190 C460,186 520,200 560,180 C600,166 630,180 680,170',
    'M640,290 C620,360 604,420 606,500 C606,540 590,590 548,596 C510,600 470,592 466,540 C462,470 470,380 468,300',
  ].join(' ');
  const rungs = [330, 372, 414, 456, 498, 540].map(y => `M468,${y} C500,${y - 8} 560,${y + 8} 606,${y}`).join(' ');
  const venous = 'M468,300 C420,300 360,330 300,370 C240,408 190,414 140,420';
  const svg = `<defs>
      <radialGradient id="bowG" cx=".45" cy=".5" r=".6"><stop offset="0" stop-color="#f7e2b6"/><stop offset=".85" stop-color="#ecc985"/><stop offset="1" stop-color="#d9ad5c"/></radialGradient>
    </defs>
    ${tube(DUCT, 30, TUBULE)}
    <path d="M746,300 l-26,-34 M746,470 l26,-34" stroke="${TUB_D}" stroke-width="12" stroke-linecap="round"/><path d="M746,300 l-26,-34 M746,470 l26,-34" stroke="${TUB}" stroke-width="9" stroke-linecap="round"/>
    <g fill="none" stroke="${VES_D}" stroke-width="7" stroke-linecap="round"><path d="${net} ${rungs} ${venous}"/></g>
    <g fill="none" stroke="${VES}" stroke-width="5" stroke-linecap="round"><path d="${net} ${rungs} ${venous}"/></g>
    ${tube(PCT, 22, TUBULE)}${tube(DESC, 18, TUBULE)}${tube(THIN, 9, TUBULE)}${tube(ASC, 17, TUBULE)}${tube(DCT, 21, TUBULE)}
    <g fill="none" stroke="${VES}" stroke-width="5" stroke-linecap="round" opacity=".95"><path d="M440,140 C452,170 470,180 480,200 M600,140 C612,170 630,176 650,170 M520,250 C528,276 540,282 552,290 M484,330 C496,326 504,334 512,330"/></g>
    ${tube(artery, 20, VESSEL)}${tube(vein, 20, VESSEL)}
    ${cutEnd(92, 130, 10, 5, VESSEL)}${cutEnd(140, 250, 10, 5, VESSEL)}
    <path d="M92,420 l-24,22 M140,520 l-24,22" stroke="${VES_D}" stroke-width="13" stroke-linecap="round"/><path d="M92,420 l-24,22 M140,520 l-24,22" stroke="${VES}" stroke-width="10" stroke-linecap="round"/>
    ${tube(afferent, 10, VESSEL)}${tube(efferent, 8, VESSEL)}
    <path d="${capsule}" fill="url(#bowG)" stroke="${TUB_D}" stroke-width="2.5"/>
    <ellipse cx="${B[0] + 2}" cy="${B[1] + 2}" rx="${BR - 12}" ry="${BR - 14}" fill="#fbecc8" opacity=".75"/>
    <path d="${loops}" fill="none" stroke="${VES_D}" stroke-width="5.5" stroke-linejoin="round"/>
    <path d="${loops}" fill="none" stroke="${VES}" stroke-width="3.6" stroke-linejoin="round"/>
    ${flow(afferent, { n: 2, dur: 1.8 })}
    ${flow(efferent, { n: 2, dur: 2.2 })}
    ${flow('M410,104 C400,160 380,214 420,272 C440,300 470,306 520,300 C560,296 600,304 640,290', { n: 2, dur: 3 })}
    ${flow('M640,290 C620,360 604,420 606,500 C606,540 590,590 548,596 C510,600 470,592 466,540 C462,470 470,380 468,300', { n: 3, dur: 4 })}
    ${flow(venous, { n: 2, dur: 3 })}
    ${flow('M92,400 V340', { n: 1, dur: 1.4 })}${flow('M140,430 V510', { n: 1, dur: 1.4 })}
    ${flow(PCT, { n: 4, dur: 4, kind: 'dot' })}${flow(DESC, { n: 2, dur: 2, kind: 'dot' })}${flow(THIN, { n: 2, dur: 2, kind: 'dot' })}
    ${flow(ASC, { n: 2, dur: 2, kind: 'dot' })}${flow(DCT, { n: 4, dur: 4, kind: 'dot' })}${flow('M746,180 V590', { n: 4, dur: 4, kind: 'dot' })}
    <g transform="translate(746 620)"><rect x="-62" y="-6" width="124" height="34" rx="10" fill="rgba(8,18,30,.8)"/>
      <text x="0" y="17" text-anchor="middle" font-size="17" font-weight="700" fill="#ffe8a3" font-family="Noto Sans KR, sans-serif">오줌관으로 ↓</text></g>`;
  return {
    viewBox: '40 30 780 630', svg, pad: [270, 10],
    anchors: { tori: [pole[0] + 50, pole[1] - 4], bowman: [B[0] + 10, B[1] + 58], capillary: [548, 596], tubule: [490, 420] },
    slots: { tori: ['left', 0.28], bowman: ['left', 0.48], tubule: ['left', 0.66], capillary: ['left', 0.86] },
  };
}

export const SCENES = [organs(), section(), nephron()];
