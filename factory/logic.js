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
  filter:  ['rbc', 'water', 'glucose', 'protein', 'urea', 'amino', 'water', 'rbc', 'glucose', 'urea', 'protein', 'amino', 'water', 'urea', 'rbc'],
  secrete: ['rbc', 'urea', 'glucose', 'protein', 'urea', 'amino', 'water', 'urea', 'rbc'],
};

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
