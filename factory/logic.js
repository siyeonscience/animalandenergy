/* 네프론 필터 공장 — 물질 정보와 채점·결과 규칙 (화면과 분리해서 시험할 수 있게) */

export const SUBS = {
  water:   { name: '물',     small: true,  need: true  },
  glucose: { name: '포도당', small: true,  need: true  },
  amino:   { name: '아미노산', small: true, need: true  },
  urea:    { name: '요소',   small: true,  need: false },
  protein: { name: '단백질', small: false, need: true  },
  rbc:     { name: '혈구',   small: false, need: true  },
};
export const ORDER = ['water', 'glucose', 'amino', 'urea', 'protein', 'rbc'];

/* 정상 오줌에 들어 있는 물질 (교과서: 단백질은 여과 안 됨, 포도당·아미노산은 모두 재흡수, 요소·물은 일부만 재흡수) */
export const NORMAL_URINE = { water: true, glucose: false, amino: false, urea: true, protein: false, rbc: false };

export const WAVES = {
  filter:  ['rbc', 'water', 'glucose', 'protein', 'urea', 'amino', 'water', 'rbc', 'glucose', 'urea', 'water', 'protein',
            'amino', 'water', 'urea', 'rbc', 'water', 'glucose', 'protein', 'amino', 'urea'],
  secrete: ['rbc', 'urea', 'glucose', 'protein', 'urea', 'amino', 'water', 'urea', 'rbc', 'urea', 'glucose', 'urea'],
};

/* 속도 단계: 단계 안에서 물질이 1/3, 2/3 지나갈 때마다 벨트가 빨라져요 */
export const LEVELS = [
  { speed: 80, gap: 1.3 },
  { speed: 105, gap: 1.05 },
  { speed: 130, gap: 0.85 },
];
export const levelAt = progress => (progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2);

/* 콤보: 연속으로 맞히면 점수가 2배, 3배 */
export const comboMult = combo => (combo >= 8 ? 3 : combo >= 4 ? 2 : 1);

/* 긴급 주문 (2단계 재흡수의 물)
   drink: 물을 많이 마셨대요 → 물을 재흡수하지 않고 오줌으로 보내야 정답
   sweat: 땀을 많이 흘렸대요 → 물을 꼭 재흡수해야 정답 */
export const ORDERS = {
  drink: { title: '긴급 주문! 물을 많이 마셨대요', text: '표시된 물은 재흡수하지 말고 오줌으로 보내 주세요.' },
  sweat: { title: '긴급 주문! 땀을 많이 흘렸대요', text: '표시된 물은 놓치지 말고 꼭 재흡수해 주세요.' },
};
/* 2단계 대기열: 걸러진 물질 + (물이 모자라면 채워서) 물 5개 이상, 2~3번째 물은 drink, 4~5번째 물은 sweat */
export function reabsorbQueue(filtrate) {
  const q = filtrate.map(t => ({ t, o: null }));
  let waters = q.filter(x => x.t === 'water').length;
  for (let k = 0; waters < 5; k++, waters++) q.splice(Math.min(q.length, 1 + k * 3), 0, { t: 'water', o: null });
  let n = 0;
  for (const x of q) if (x.t === 'water') { n++; if (n === 2 || n === 3) x.o = 'drink'; if (n === 4 || n === 5) x.o = 'sweat'; }
  return q;
}

/* 별 평가와 칭호: 정확도(맞힘 ÷ 전체 판단)로 별을 주고, 오줌 성분이 틀리면 별은 최대 2개 */
export const TITLES = ['', '견습생', '숙련공', '명예 공장장'];
export function rating({ good, bad, miss }, rows) {
  const total = good + bad + miss, acc = total ? good / total : 0;
  let stars = acc >= 0.9 ? 3 : acc >= 0.7 ? 2 : 1;
  if (rows.some(r => r.wrong)) stars = Math.min(stars, 2);
  return { stars, acc, title: TITLES[stars] };
}

export const POINT = 10, PENALTY = 5;

/* 1단계 여과: 거름망에 올렸을 때 */
export const canFilter = type => SUBS[type].small;
/* 2단계 재흡수: 눌렀을 때 다시 흡수해도 되는 물질 */
export const canReabsorb = type => type === 'glucose' || type === 'amino' || type === 'water';
/* 3단계 분비: 세뇨관으로 보내도 되는 물질 */
export const canSecrete = type => type === 'urea';

/* 결과표: 기록(record)으로 줄마다 ○/× 계산
   record = { filtered: {type: 개수}, urine: {type: 개수} } */
export function urineTable(record) {
  return ORDER.map(type => {
    const mine = (record.urine[type] || 0) > 0;
    return {
      type, name: SUBS[type].name,
      blood: true,
      bowman: (record.filtered[type] || 0) > 0,
      mine, normal: NORMAL_URINE[type],
      wrong: mine !== NORMAL_URINE[type],
    };
  });
}

/* 공장장의 한마디: 가장 중요한 실수부터 */
export function bossComment(rows) {
  const r = Object.fromEntries(rows.map(x => [x.type, x]));
  if (r.glucose.mine) return '오줌에 포도당이 섞였어요! 재흡수 때 포도당을 놓쳤나 봐요.';
  if (r.amino.mine) return '오줌에 아미노산이 섞였어요! 재흡수 때 아미노산을 놓쳤나 봐요.';
  if (!r.urea.mine) return '오줌에 요소가 없어요! 여과와 분비 때 요소를 오줌으로 보내야 해요.';
  if (!r.water.mine) return '오줌에 물이 하나도 없어요. 물은 대부분만 재흡수돼요.';
  return '완벽해요! 정상 오줌과 똑같아요. 최고의 작업자예요!';
}
