/* 배설계의 구조 — 교과서 그림 3장 (배설 기관 · 콩팥 단면 · 네프론)
   그림 위에 빈칸이 가리킬 점(anchors)만 얹어요. 좌표는 각 그림의 픽셀 기준이에요.
   각 장면: { viewBox, svg, anchors, slots(빈칸 자리), pad(양옆 빈칸 자리 너비) } */

/* 흰 바탕 카드 위에 그림 (그림의 흰 부분이 어두운 배경에서 튀지 않게) */
const M = 18;
const img = (src, w, h, H = h) => `<rect x="${-M}" y="${-M}" width="${w + 2 * M}" height="${H + 2 * M}" rx="22" fill="#fff"/>
  <image href="kidney/img/${src}" x="0" y="0" width="${w}" height="${h}"/>`;
const vb = (w, h) => `${-M} ${-M} ${w + 2 * M} ${h + 2 * M}`;

export const SCENES = [
  { // 1단계: 배설 기관
    viewBox: vb(249, 479), pad: [250, 250],
    svg: img('organs.png', 249, 479),
    anchors: { kidney: [26, 112], ureter: [166, 250], bladder: [150, 410], urethra: [127, 456] },
    slots: { kidney: ['left', 0.22], ureter: ['right', 0.5], bladder: ['right', 0.8], urethra: ['left', 0.92] },
  },
  { // 2단계: 콩팥 단면 (노란 고리 = 네프론이 있는 곳)
    viewBox: vb(570, 817), pad: [250, 250],
    svg: img('section.webp', 570, 817) + `
      <circle cx="486" cy="318" r="14" fill="none" stroke="#ffd43b" stroke-width="5"><animate attributeName="r" values="12;16;12" dur="1.4s" repeatCount="indefinite"/></circle>`,
    anchors: { artery: [24, 320], vein: [18, 372], ureter2: [62, 680], nephron: [486, 318] },
    slots: { artery: ['left', 0.36], vein: ['left', 0.52], ureter2: ['left', 0.84], nephron: ['right', 0.3] },
  },
  { // 3단계: 네프론
    viewBox: vb(1155, 1090), pad: [270, 10],
    svg: img('nephron.webp', 1155, 1090) + `
      <g transform="translate(935 1040)"><rect x="-80" y="0" width="160" height="34" rx="10" fill="rgba(8,18,30,.8)"/>
        <text x="0" y="24" text-anchor="middle" font-size="22" font-weight="700" fill="#ffe8a3" font-family="Noto Sans KR, sans-serif">오줌관으로</text></g>`,
    anchors: { tori: [330, 318], bowman: [300, 394], tubule: [607, 660], capillary: [513, 900] },
    slots: { tori: ['left', 0.24], bowman: ['left', 0.42], tubule: ['left', 0.66], capillary: ['left', 0.86] },
  },
];
