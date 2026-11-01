/* 실험 06 공통 진행 상태 (혈액 택배 레이스 + 배송 사고 조사반)
   이 브라우저의 localStorage에 저장되어 새로고침·재접속 뒤에도 유지돼요.
   - raceDone      : 레이스를 한 번이라도 완주했는지
   - auditUnlocked : 배송 사고 조사반이 해금되었는지
   - auditDone     : 배송 사고 조사반을 끝까지 마쳤는지
   - raceBest      : 레이스 최고 점수
   - auditBest     : 감사 미션 최고 점수
   - tutorialDone  : 연습 주행을 해 봤는지 */
window.EXP06 = (function(){
  const KEY = 'exp06-progress-v1';
  const AUDIT_PLAY_KEY = 'blood-delivery-progress-v1';   // 감사 미션 진행 중 데이터
  const blank = () => ({ raceDone:false, auditUnlocked:false, auditDone:false, raceBest:0, auditBest:0, tutorialDone:false });
  function get(){
    try{ return Object.assign(blank(), JSON.parse(localStorage.getItem(KEY)) || {}); }
    catch(e){ return blank(); }
  }
  function set(patch){
    const s = Object.assign(get(), patch);
    try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(e){}
    return s;
  }
  return {
    get, set,
    raceFinished(score){ const s = get(); return set({ raceDone:true, auditUnlocked:true, raceBest:Math.max(s.raceBest, score) }); },
    auditFinished(score){ const s = get(); return set({ auditDone:true, auditBest:Math.max(s.auditBest, score) }); },
    resetAuditPlay(){ try{ localStorage.removeItem(AUDIT_PLAY_KEY); }catch(e){} },
    // 전체 초기화: 해금 상태와 최고 점수까지 모두 지움
    resetAll(){ try{ localStorage.removeItem(KEY); localStorage.removeItem(AUDIT_PLAY_KEY); }catch(e){} },
  };
})();
