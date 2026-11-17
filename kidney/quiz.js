/* 배설계의 구조 — 빈칸 채점 규칙 (화면과 분리해서 시험할 수 있게)
   - 빈칸마다 기회 3번
   - 두 번째로 틀리면 첫 글자 힌트(말풍선)
   - 세 번째로 틀리면 정답을 보여 주고 그 칸은 끝
   - 띄어쓰기는 무시하고 비교 */

export const STAGES = [
  { id: 'organs', title: '1단계 · 배설 기관', tab: '전체 모습',
    blanks: [
      { id: 'kidney', answer: '콩팥' },
      { id: 'ureter', answer: '오줌관' },
      { id: 'bladder', answer: '방광' },
      { id: 'urethra', answer: '요도' },
    ] },
  { id: 'section', title: '2단계 · 콩팥 단면', tab: '콩팥 단면',
    blanks: [
      { id: 'artery', answer: '콩팥동맥' },
      { id: 'vein', answer: '콩팥정맥' },
      { id: 'ureter2', answer: '오줌관' },
      { id: 'nephron', answer: '네프론' },
    ] },
  { id: 'nephron', title: '3단계 · 네프론', tab: '네프론',
    blanks: [
      { id: 'tori', answer: '토리' },
      { id: 'bowman', answer: '보먼주머니' },
      { id: 'tubule', answer: '세뇨관' },
      { id: 'capillary', answer: '모세혈관' },
    ] },
];

export const MAX_TRIES = 3;
export const norm = s => String(s ?? '').replace(/\s+/g, '').trim();

/* 빈칸 하나의 처음 상태 */
export const freshBlank = () => ({ value: '', tries: 0, status: 'open' });   // open | wrong | ok | out

/* 채점: 입력이 비어 있으면 아무 일도 없음. 결과로 바뀐 상태를 돌려줌 */
export function grade(blank, answer, text) {
  const v = norm(text);
  if (!v || blank.status === 'ok' || blank.status === 'out') return blank;
  if (v === norm(answer)) return { value: answer, tries: blank.tries, status: 'ok' };
  const tries = blank.tries + 1;
  if (tries >= MAX_TRIES) return { value: answer, tries, status: 'out' };
  return { value: text, tries, status: 'wrong' };
}

/* 두 번 틀린 칸에만 첫 글자 힌트 */
export const showHint = blank => blank.status === 'wrong' && blank.tries >= 2;
export const hintText = answer => answer[0] + '□'.repeat(answer.length - 1);
export const triesLeft = blank => blank.status === 'ok' ? 0 : MAX_TRIES - blank.tries;
export const isDone = blank => blank.status === 'ok' || blank.status === 'out';
export const stageDone = (stage, blanks) => stage.blanks.every(b => isDone(blanks[b.id]));
