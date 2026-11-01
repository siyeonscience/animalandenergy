/* 배송 사고 조사반 — 게임 진행 로직
   문제 내용은 missions.js(BD_MISSIONS, BD_FINAL, BD_GRADES, BD_CONFIG)에 있어요. */
(function(){
'use strict';
const M=window.BD_MISSIONS, F=window.BD_FINAL, GRADES=window.BD_GRADES, CFG=window.BD_CONFIG||{};
const MAX=M.length*3+F.errors.length*2+1;          // 만점: 기본 미션 단계 3개씩 + 최종(오류 찾기·고치기 + 특징)
const KEY='blood-delivery-progress-v1';
const STEP_NAMES=['사고 발견','기록 수정','사고 원인 확인'];
const app=document.getElementById('app');
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const KLABEL='①②③④⑤⑥⑦⑧⑨';

/* ================= 상태 ================= */
// screen: start | guide | mission | final | result | review
// step: 지금 풀고 있는 단계(0~2), answered: 그 단계를 맞혔는지, solved: 미션을 해결했는지
function fresh(){return {screen:'start',mi:0,step:0,answered:false,solved:false,score:0,awarded:{},tried:{},
  fin:{phase:'find',found:[],miss:false,fix:0,done:false}};}
let S=load()||fresh();
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));return s&&s.screen?s:null;}catch(e){return null;}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function reset(){S=fresh();try{localStorage.removeItem(KEY);}catch(e){}}

// 점수: 한 단계에서 한 번만. scoreOnlyFirstTry면 처음 고른 답이 정답일 때만
function award(key){
  if(S.awarded[key])return;
  if(CFG.scoreOnlyFirstTry&&S.tried[key])return;
  S.awarded[key]=true;S.score++;
}
function missed(key){S.tried[key]=true;}

/* 선택지 순서 섞기: 데이터는 원래 순서 그대로 두고 화면에서만 섞음.
   한 판 안에서 정답 위치가 ①②③에 고르게 나뉘도록 정하고, 정한 순서는 저장해서 새로고침해도 같음 */
function shuffled(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;}
function order(key,q){
  S.perm=S.perm||{};
  if(!S.perm[key]){
    const n=q.options.length;
    if(!S.pool||!S.pool.length)S.pool=shuffled([0,1,2,0,1,2]).filter(p=>p<n);
    const at=Math.min(S.pool.shift(),n-1);
    const rest=shuffled([...Array(n).keys()].filter(i=>i!==q.answer));
    rest.splice(at,0,q.answer);
    S.perm[key]=rest;save();
  }
  return S.perm[key];
}
// 섞인 순서대로 선택지 버튼 (data-i는 원래 번호)
function optsHTML(key,q,answered){
  return order(key,q).map((i,k)=>`<button class="opt${answered&&i===q.answer?' yes':''}" data-i="${i}" type="button"${answered?' disabled':''}><span class="k">${KLABEL[k]}</span><span>${esc(q.options[i])}</span></button>`).join('');
}

/* ================= 공통 화면 조각 ================= */
let toastT;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),2200);}
function progressPct(){
  const total=M.length+1;
  let done=S.screen==='final'?M.length+(S.fin.done?1:0):S.mi+(S.solved?1:0);
  if(S.screen==='result'||S.screen==='review')done=total;
  return Math.round(done/total*100);
}
let shownPct=0;
function topbar(label){
  return `<header class="topbar">
    <div class="mno">${label}</div>
    <div class="score">현재 점수: <b id="scoreN">${S.score}</b>점 <small>/ ${MAX}</small></div>
    <div class="prog">진행률 <span class="bar"><i id="progBar" style="width:${shownPct}%"></i></span> <span id="progN">${shownPct}%</span></div>
    <button class="restart" id="restartBtn" type="button">↺ 처음부터</button>
  </header>`;
}
function bumpProgress(){
  const p=progressPct();shownPct=p;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{const b=$('#progBar');if(b)b.style.width=p+'%';const n=$('#progN');if(n)n.textContent=p+'%';}));
}
function setScore(){const n=$('#scoreN');if(n)n.textContent=S.score;}
function wireTop(){
  const r=$('#restartBtn');if(r)r.onclick=()=>{if(confirm('처음부터 다시 조사할까요?\n점수와 진행 기록이 모두 지워져요.')){reset();go();}};
}
const courier=(cls='courier')=>`<svg class="${cls}" viewBox="0 0 200 200" aria-hidden="true"><use href="#courier"/></svg>`;
function stampHTML(text='해결'){return `<div class="stamp" aria-label="사고 해결">${text}<small>감사 완료</small></div>`;}

/* ================= 화면 전환 ================= */
function go(){
  save();
  document.querySelectorAll('.confetti').forEach(c=>c.remove());
  ({start:renderStart,guide:renderGuide,mission:renderMission,final:renderFinal,result:renderResult,review:renderReview}[S.screen]||renderStart)();
  window.scrollTo(0,0);
}

/* ---- 시작 ---- */
function renderStart(){
  app.innerHTML=`<section class="screen start"><div class="start-in">
    ${courier()}
    <div><span class="tape">실험 06 · 긴급 감사 미션</span></div>
    <h1>배송 사고 조사반</h1>
    <div class="sub">감사팀이 오기 전에 잘못된 배송 기록을 찾아라!</div>
    <p class="desc">레이스를 마친 배송기사님, 이제는 <b>배송 감사관</b>이 될 차례예요! 혈액 택배회사의 배송 기록에 오류가 있을 수 있습니다. 본사 감사팀이 도착하기 전에 사고 보고서를 확인하고 잘못된 배송을 바로잡아 주세요!</p>
    <button class="btn orange" id="startBtn" type="button">조사 시작하기</button>
  </div></section>`;
  $('#startBtn').onclick=()=>{S.screen='guide';go();};
}

/* ---- 게임 방법 ---- */
function renderGuide(){
  app.innerHTML=`<section class="screen guide"><div class="card">
    <h2><svg viewBox="0 0 40 40" aria-hidden="true"><use href="#lens"/></svg>감사관의 임무</h2>
    <ol class="duties">
      <li><b>1</b>사고 보고서를 꼼꼼하게 읽는다.</li>
      <li><b>2</b>잘못 기록된 배송 내용을 찾는다.</li>
      <li><b>3</b>올바른 내용으로 수정한다.</li>
      <li><b>4</b>오류가 발생한 이유를 확인한다.</li>
    </ol>
    <p class="note">미션을 해결할 때마다 감사 점수를 획득합니다. 단계마다 <b>처음 고른 답이 정답</b>이면 1점! 틀려도 감점은 없고, 힌트를 보고 다시 고를 수 있어요. 시간 제한은 없어요.</p>
    <div class="center"><button class="btn" id="goBtn" type="button">본격적인 조사 시작</button></div>
  </div></section>`;
  $('#goBtn').onclick=()=>{S.screen='mission';S.mi=0;S.step=0;S.answered=false;S.solved=false;go();};
}

/* ================= 기록 그리기 =================
   picking: 고를 수 있는지, bad: 오류로 표시할 칸, fixed: 고친 모습, anim: 고치는 애니메이션 */
function recordHTML(rec,{picking=false,bad=[],fixed=false,anim=false}={}){
  const isBad=i=>bad.includes(i)?' bad':'';
  let h=`<div class="rec-cap">${esc(rec.caption)}</div>`;
  const wrap=s=>`<div class="rec${picking?' picking':''}${fixed&&!anim?' no-anim':''}">${s}</div>`;
  if(rec.type==='route'){
    h+=`<div class="route">${rec.nodes.map((n,i)=>{
      const arrow=i?'<span class="arrow" aria-hidden="true">→</span>':'';
      if(fixed&&i===rec.wrong)
        return `${arrow}<span class="node fixed" aria-label="${esc(n)}을(를) ${esc(rec.fixTo)}(으)로 수정"><span class="old">${esc(n)}</span><span class="x" aria-hidden="true">✕</span><span class="new">${esc(rec.fixTo)}</span></span>`;
      return `${arrow}<button type="button" class="node pickable${isBad(i)}" data-i="${i}" ${picking?'':'tabindex="-1"'}>${esc(n)}</button>`;
    }).join('')}</div>`;
    return wrap(h);
  }
  if(rec.type==='goods'){
    h+=`<div class="invoice">${rec.rows.map((r,i)=>{
      const v=fixed&&r.fix?`<span class="val-old">${esc(r.value)}</span> → <span class="val-new">${esc(r.fix)}</span>`:esc(r.value);
      return `<button type="button" class="inv-row pickable${isBad(i)}" data-i="${i}" ${picking?'':'tabindex="-1"'}><span class="k">${esc(r.label)}</span><span class="v">${v}</span></button>`;
    }).join('')}</div>
    <div class="boxes">${rec.rows.filter(r=>r.box).map(r=>{
      const amt=fixed&&r.fix?r.fix:r.value, n=amt==='많음'?5:2;
      return `<div class="gbox ${r.box}"><span class="amt">${esc(r.label)} 상자: ${esc(amt)}</span><span class="crates">${'<i></i>'.repeat(n)}</span></div>`;
    }).join('')}</div>`;
    return wrap(h);
  }
  // exchange
  const lines=fixed?rec.fixed:rec.lines;
  h+=`<div class="lines">${lines.map((l,i)=>`<button type="button" class="line pickable${isBad(i)}${fixed?' fixed':''}" data-i="${i}" ${picking?'':'tabindex="-1"'}><span class="n">${i+1}</span>${esc(l)}</button>`).join('')}</div>`;
  const rightCls=rec.right==='허파'?'lung':'cell';
  h+=`<div class="xchg" aria-label="물질 이동 방향">
    <div class="side blood">${esc(rec.left)}<small>${esc(rec.where)}</small></div>
    <div class="arrows">${rec.arrows.map(a=>{
      const dir=fixed?a.right:a.wrong, to=dir==='R'?rec.right:rec.left, from=dir==='R'?rec.left:rec.right;
      return `<div class="arr ${dir==='L'?'toL':''} ${fixed?'right':'wrong'}"><span class="lab">${esc(a.name)}</span>
        <svg viewBox="0 0 200 26" preserveAspectRatio="none" aria-label="${esc(a.name)}: ${esc(from)} → ${esc(to)}"><path d="M4 13 H180" stroke-width="5" fill="none"/><polygon points="178,3 198,13 178,23"/></svg></div>`;
    }).join('')}</div>
    <div class="side ${rightCls}">${esc(rec.right)}</div></div>`;
  return wrap(h);
}

/* ================= 기본 미션 ================= */
function renderMission(){
  const m=M[S.mi];
  app.innerHTML=`<section class="screen">${topbar(`MISSION ${m.no} / ${pad(M.length)}`)}
    <main class="mission">
      <article class="card report arrive" id="report">
        <div class="rhead"><span class="rno">${esc(m.report)}</span><span class="lvl">난이도: ${esc(m.level)}</span></div>
        <h2>MISSION ${m.no}. ${esc(m.title)}</h2>
        <p class="situ">${esc(m.situation)}</p>
        <div id="record"></div>
        <div id="stampSlot">${S.solved?stampHTML():''}</div>
      </article>
      <section class="card stepcard" id="stepcard"></section>
    </main></section>`;
  wireTop();bumpProgress();
  drawRecord(false);
  S.solved?drawSolved():drawStep();
}
function recordState(anim){
  const m=M[S.mi], st=S.solved?3:S.step+(S.answered?1:0);   // 몇 단계까지 맞혔는지
  return {picking:!S.solved&&S.step===0&&!S.answered,bad:st>=1?m.steps[0].pick:[],fixed:st>=2,anim};
}
function drawRecord(anim){
  const rec=M[S.mi].record;
  $('#record').innerHTML=recordHTML(rec,recordState(anim));wirePick();
  // 물질 이동 화살표: 잘못된 방향에서 올바른 방향으로 뒤집히는 모습
  if(anim&&rec.type==='exchange'){
    const els=$$('#record .arr');
    els.forEach((el,i)=>{el.className=`arr ${rec.arrows[i].wrong==='L'?'toL':''} wrong`;});
    setTimeout(()=>els.forEach((el,i)=>{el.className=`arr ${rec.arrows[i].right==='L'?'toL':''} right`;}),450);
  }
}

// STEP 1: 보고서의 기록을 직접 고르기
let picked=new Set();
function wirePick(){
  const m=M[S.mi];if(S.solved||S.step!==0||S.answered)return;
  const ans=m.steps[0].pick, multi=ans.length>1;
  picked=new Set();
  $$('#record .pickable').forEach(b=>b.onclick=()=>{
    const i=+b.dataset.i;
    if(multi){b.classList.toggle('sel');b.classList.contains('sel')?picked.add(i):picked.delete(i);hideFb();return;}
    checkPick([i],b);
  });
}
function checkPick(sel,el){
  const m=M[S.mi], ans=m.steps[0].pick, key=`M${S.mi}-0`;
  const ok=sel.length===ans.length&&sel.every(i=>ans.includes(i));
  if(!ok){
    missed(key);save();
    (el?[el]:$$('#record .pickable.sel')).forEach(b=>{b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');});
    showFb('hint',sel.length?m.steps[0].hint:'잘못된 기록을 먼저 골라 주세요.');
    return;
  }
  award(key);answered();
}
function answered(){
  S.answered=true;save();setScore();
  const m=M[S.mi], st=m.steps[S.step];
  if(S.step===0)drawRecord(false);              // 오류 표시
  if(S.step===1)drawRecord(true);               // 기록 고치는 애니메이션
  drawStep();
}
function drawStep(){
  const m=M[S.mi], st=m.steps[S.step], k=S.step, card=$('#stepcard');
  const bar=`<div class="stepbar">${STEP_NAMES.map((n,i)=>`<span class="${i<k||(i===k&&S.answered)?'done':i===k?'cur':''}"><b>STEP ${i+1}</b>${n}</span>`).join('')}</div>`;
  let body;
  if(k===0){
    const multi=st.pick.length>1;
    body=`<p class="howto">👈 왼쪽 사고 보고서에서 ${multi?'잘못된 기록을 <b>모두</b> 눌러 고른 뒤 확인을 누르세요.':'잘못된 기록을 직접 눌러 고르세요.'}</p>
      ${multi&&!S.answered?'<div class="actions" style="justify-content:flex-start"><button class="btn ghost" id="confirmPick" type="button">확인</button></div>':''}`;
  }else{
    body=`<div class="opts">${optsHTML(`M${S.mi}-${k}`,st,S.answered)}</div>`;
  }
  card.innerHTML=`${bar}<h3>STEP ${k+1}. ${esc(st.q)}</h3>${body}<div class="fb" id="fb"></div>
    <div class="actions" id="next"></div>`;
  if(k>0)$$('.opt',card).forEach(b=>b.onclick=()=>chooseOpt(b,+b.dataset.i));
  if($('#confirmPick'))$('#confirmPick').onclick=()=>checkPick([...picked]);
  if(S.answered){
    showFb('good',st.explain);
    const last=k===2;
    $('#next').innerHTML=`<button class="btn ${last?'green':''}" id="nextBtn" type="button">${last?'사고 해결 ✔':'다음 단계 ▶'}</button>`;
    $('#nextBtn').onclick=()=>{
      if(last){S.solved=true;save();drawSolved(true);return;}
      S.step++;S.answered=false;save();drawRecord(false);drawStep();
    };
    $('#nextBtn').focus({preventScroll:true});
  }
}
function chooseOpt(b,i){
  const st=M[S.mi].steps[S.step], key=`M${S.mi}-${S.step}`;
  if(S.answered)return;
  if(i!==st.answer){missed(key);save();b.classList.remove('no');void b.offsetWidth;b.classList.add('no');showFb('hint',st.hint);return;}
  award(key);answered();
}
function showFb(kind,text){
  const fb=$('#fb');fb.className='fb on '+kind;
  fb.innerHTML=`<b>${kind==='hint'?'🔎 다시 살펴볼까요?':'✅ 정답이에요!'}</b>${esc(text)}`;
}
function hideFb(){const fb=$('#fb');if(fb)fb.className='fb';}
function drawSolved(fresh){
  const m=M[S.mi], last=S.mi===M.length-1;
  $('#report').classList.add('done');
  if(fresh){$('#stampSlot').innerHTML=stampHTML();bumpProgress();}
  $('#stepcard').innerHTML=`<div class="solved">
    ${courier()}
    <h3>✔ 사고 해결!</h3>
    <div class="exp">${esc(m.summary)}</div>
    ${m.note?`<div class="note"><b>추가 개념</b> ${esc(m.note)}</div>`:''}
    <div class="actions"><button class="btn ${last?'orange':''}" id="nextMission" type="button">${last?'최종 미션 시작 ▶':'다음 사고 보고서 ▶'}</button></div></div>`;
  $('#nextMission').onclick=()=>{
    if(last){S.screen='final';S.fin={phase:'find',found:[],miss:false,fix:0,done:false};}
    else{S.mi++;S.step=0;S.answered=false;S.solved=false;}
    go();
  };
}

/* ================= 최종 미션 ================= */
function renderFinal(){
  app.innerHTML=`<section class="screen">${topbar('FINAL MISSION')}
    <main class="mission final">
      <article class="card report arrive" id="report">
        <div class="rhead"><span class="rno">${esc(F.report)}</span><span class="lvl">난이도: 종합</span></div>
        <h2>${esc(F.title)}</h2>
        <p class="situ">${esc(F.situation)}</p>
        <div id="record"></div>
        <div id="stampSlot">${S.fin.done?stampHTML('복구'):''}</div>
      </article>
      <section class="card stepcard" id="stepcard"></section>
    </main></section>`;
  wireTop();bumpProgress();
  if(S.fin.done)$('#report').classList.add('done');
  drawFinalRecord(null);drawFinalStep();
}
const fixedText=i=>{const fx=F.fixes[i];return fx.options[fx.answer];};
// 그 오류 문장을 이미 고쳤는지 (오류가 아닌 문장은 항상 false)
function fixedDone(i){const k=F.errors.indexOf(i);return k>=0&&S.fin.phase!=='find'&&k<(S.fin.phase==='fix'?S.fin.fix:F.errors.length);}
function drawFinalRecord(animIdx){
  const f=S.fin, picking=f.phase==='find';
  $('#record').innerHTML=`<div class="rec-cap">전체 배송 기록</div><div class="rec${picking?' picking':''}"><div class="lines">${F.lines.map((l,i)=>{
    const done=fixedDone(i), bad=f.found.includes(i)&&!done;
    const txt=done?(i===animIdx?`<span><span class="val-old">${esc(l)}</span><br><span class="val-new">${esc(fixedText(i))}</span></span>`:esc(fixedText(i))):esc(l);
    return `<button type="button" class="line pickable${bad?' bad':''}${done?' fixed':''}" data-i="${i}" ${picking?'':'tabindex="-1"'}><span class="n">${i+1}</span>${txt}</button>`;
  }).join('')}</div></div>`;
  if(picking)$$('#record .pickable').forEach(b=>b.onclick=()=>findError(+b.dataset.i,b));
}
function findError(i,b){
  const f=S.fin;if(f.phase!=='find'||f.found.includes(i))return;
  if(!F.errors.includes(i)){
    f.miss=true;missed('F-find');save();
    b.classList.remove('nope');void b.offsetWidth;b.classList.add('nope');
    showFb('hint',F.findHint);return;
  }
  // 오류 하나 찾을 때마다 1점(그 사이에 잘못 누른 적이 없을 때)
  if(!(CFG.scoreOnlyFirstTry&&f.miss)&&!S.awarded['F-find-'+i]){S.awarded['F-find-'+i]=true;S.score++;}
  f.miss=false;f.found.push(i);setScore();
  if(f.found.length===F.errors.length){f.phase='fix';f.fix=0;}
  save();drawFinalRecord(null);drawFinalStep(true);
}
function finalQuestion(){const f=S.fin;return f.phase==='fix'?{key:'F-fix-'+F.errors[f.fix],...F.fixes[F.errors[f.fix]]}:{key:'F-feature',...F.feature};}
function drawFinalStep(justFound){
  const f=S.fin, card=$('#stepcard');delete card.dataset.answered;
  const names=['오류 찾기','기록 수정','전체 특징'], cur=f.done?3:f.phase==='find'?0:f.phase==='fix'?1:2;
  const bar=`<div class="stepbar">${names.map((n,i)=>`<span class="${i<cur?'done':i===cur?'cur':''}"><b>${i+1}</b>${n}</span>`).join('')}</div>`;
  if(f.done){
    card.innerHTML=`${bar}<div class="solved">${courier()}<h3>✔ 전체 배송 시스템 복구!</h3>
      <div class="exp">${esc(F.feature.explain)}</div>
      <div class="actions"><button class="btn orange" id="toResult" type="button">감사 결과 보기 ▶</button></div></div>`;
    $('#toResult').onclick=()=>{S.screen='result';go();};return;
  }
  if(f.phase==='find'){
    card.innerHTML=`${bar}<h3>${esc(F.findQ)}</h3><p class="howto">👈 왼쪽 전체 배송 기록에서 잘못된 문장을 눌러 보세요. (찾은 오류 <b>${f.found.length}</b> / ${F.errors.length})</p><div class="fb" id="fb"></div>`;
    if(justFound&&f.found.length)showFb('good',`${f.found[f.found.length-1]+1}번 문장에서 오류를 찾았어요! 나머지 오류도 찾아보세요.`);
    return;
  }
  const q=finalQuestion();
  card.innerHTML=`${bar}<h3>${esc(q.q)}</h3>
    ${f.phase==='fix'?`<p class="howto">잘못된 기록: “${esc(F.lines[F.errors[f.fix]])}”</p>`:''}
    <div class="opts">${optsHTML(q.key,q,false)}</div>
    <div class="fb" id="fb"></div><div class="actions" id="next"></div>`;
  if(justFound&&f.phase==='fix'&&f.fix===0)showFb('good','오류 2개를 모두 찾았어요! 이제 하나씩 올바르게 고쳐 볼까요?');
  $$('.opt',card).forEach(b=>b.onclick=()=>{
    if(card.dataset.answered)return;
    const i=+b.dataset.i;
    if(i!==q.answer){missed(q.key);save();b.classList.remove('no');void b.offsetWidth;b.classList.add('no');showFb('hint',q.hint);return;}
    card.dataset.answered='1';award(q.key);setScore();
    $$('.opt',card).forEach(x=>x.disabled=true);b.classList.add('yes');
    showFb('good',q.explain);
    let animIdx=null;
    if(f.phase==='fix'){animIdx=F.errors[f.fix];f.fix++;if(f.fix>=F.errors.length)f.phase='feature';}
    else{f.done=true;}
    save();
    if(animIdx!==null)drawFinalRecord(animIdx);
    if(f.done){$('#report').classList.add('done');$('#stampSlot').innerHTML=stampHTML('복구');bumpProgress();}
    $('#next').innerHTML=`<button class="btn ${f.done?'green':''}" id="nextBtn" type="button">${f.done?'시스템 복구 완료 ✔':'다음 ▶'}</button>`;
    $('#nextBtn').onclick=()=>drawFinalStep();
    $('#nextBtn').focus({preventScroll:true});
  });
}

/* ================= 결과 ================= */
function gradeOf(score){
  // 등급 기준은 20점 만점 기준 → 만점이 바뀌면 같은 비율로 맞춤
  const s=score*20/MAX;
  return GRADES.find(g=>s>=g.min)||GRADES[GRADES.length-1];
}
const BADGES={
  gold:`<svg class="badge gold" viewBox="0 0 200 200" aria-hidden="true"><path d="M70 120 L50 190 L80 172 L96 196 L106 128Z" fill="#d62828"/><path d="M130 120 L150 190 L120 172 L104 196 L94 128Z" fill="#1d3557"/>
    <circle cx="100" cy="88" r="70" fill="#ffd43b" stroke="#c08a00" stroke-width="8"/><circle cx="100" cy="88" r="54" fill="#ffe066"/>
    <path d="M100 118 C72 100 64 84 72 72 C80 60 94 64 100 74 C106 64 120 60 128 72 C136 84 128 100 100 118Z" fill="#d62828"/>
    <path d="M70 46 L82 30 L100 42 L118 30 L130 46 Z" fill="#c08a00"/></svg>`,
  silver:`<svg class="badge silver" viewBox="0 0 200 200" aria-hidden="true"><path d="M70 120 L50 190 L80 172 L96 196 L106 128Z" fill="#2f6fde"/><path d="M130 120 L150 190 L120 172 L104 196 L94 128Z" fill="#1d3557"/>
    <circle cx="100" cy="88" r="70" fill="#dee2e6" stroke="#868e96" stroke-width="8"/><circle cx="100" cy="88" r="54" fill="#f1f3f5"/>
    <circle cx="92" cy="80" r="24" fill="#e7f5ff" stroke="#1d3557" stroke-width="8"/><path d="M110 98 L130 118" stroke="#1d3557" stroke-width="10" stroke-linecap="round"/></svg>`,
  bronze:`<svg class="badge bronze" viewBox="0 0 200 200" aria-hidden="true"><path d="M70 120 L50 190 L80 172 L96 196 L106 128Z" fill="#f76707"/><path d="M130 120 L150 190 L120 172 L104 196 L94 128Z" fill="#1d3557"/>
    <circle cx="100" cy="88" r="70" fill="#e8a87c" stroke="#a0522d" stroke-width="8"/><circle cx="100" cy="88" r="54" fill="#f2c4a0"/>
    <rect x="72" y="66" width="56" height="46" rx="5" fill="#d9a066" stroke="#9c6b3c" stroke-width="5"/><path d="M72 80 H128 M100 66 V112" stroke="#9c6b3c" stroke-width="5"/></svg>`,
};
function wrongList(){
  // 처음에 오답을 골랐던 단계만 모음
  const out=[];
  M.forEach((m,mi)=>{
    const steps=m.steps.map((st,k)=>({st,k})).filter(({k})=>S.tried[`M${mi}-${k}`]);
    if(!steps.length)return;
    out.push({title:`MISSION ${m.no}. ${m.title}`,items:steps.map(({st,k})=>({
      q:`STEP ${k+1}. ${st.q.replace(/ 잘못된 (줄|기록)을 모두 고른 뒤 확인을 누르세요\./,'')}`,
      a:k===0?pickAnswerText(m):st.options[st.answer],e:st.explain})),summary:m.summary});
  });
  const fin=[];
  if(S.tried['F-find'])fin.push({q:F.findQ,a:F.errors.map(i=>`${i+1}번: ${F.lines[i]}`).join(' / '),e:'두 문장 모두 물질의 이동 방향이 반대로 기록되어 있어요.'});
  F.errors.forEach(i=>{if(S.tried['F-fix-'+i]){const fx=F.fixes[i];fin.push({q:fx.q,a:fx.options[fx.answer],e:fx.explain});}});
  if(S.tried['F-feature'])fin.push({q:F.feature.q,a:F.feature.options[F.feature.answer],e:F.feature.explain});
  if(fin.length)out.push({title:F.title,items:fin});
  return out;
}
function pickAnswerText(m){
  const r=m.record, idx=m.steps[0].pick;
  if(r.type==='route')return idx.map(i=>`‘${r.nodes[i]}’ (→ ${r.fixTo})`).join(', ');
  if(r.type==='goods')return '‘'+idx.map(i=>`${r.rows[i].label}: ${r.rows[i].value}`).join(', ')+'’이라는 기록';
  return idx.map(i=>`‘${r.lines[i]}’`).join(', ');
}
function renderResult(){
  const g=gradeOf(S.score), wrongs=wrongList();
  if(!S.recorded){S.recorded=true;window.EXP06&&EXP06.auditFinished(S.score);save();}   // 실험 06 기록(최고 점수·완료)
  const meta=window.EXP06?EXP06.get():{raceBest:0};
  const master=g.badge==='gold';
  app.innerHTML=`<section class="screen result"><div class="card">
    <h1>혈액 택배 시스템 감사 완료!</h1>
    <p class="desc">모든 배송 사고를 해결했습니다. 혈액 택배 시스템이 정상적으로 복구되었습니다!</p>
    ${BADGES[g.badge]}
    ${master?'<div class="cert master">🏅 <b>순환 시스템 마스터</b> 인증</div>':''}
    <div class="grade ${g.badge}">${esc(g.name)}</div>
    <div class="stats">
      <div>레이스 최고 점수<b>${meta.raceBest}점</b></div>
      <div>감사 미션 점수<b>${S.score} / ${MAX}점</b></div>
      <div>해결한 사고 건수<b>${M.length+1}건</b></div>
      <div>최종 감사 등급<b>${esc(g.name)}</b></div>
    </div>
    <p class="desc">${esc(g.msg)}${master?'':' 17점 이상이면 ‘순환 시스템 마스터’ 인증을 받아요!'}</p>
    <div class="row">
      <button class="btn orange" id="retry" type="button">배송 사고 조사반 다시 도전</button>
      <a class="btn" href="blood-race.html?play=1">혈액 택배 레이스 다시 도전</a>
    </div>
    <div class="row">
      <button class="btn ghost" id="toReview" type="button"${wrongs.length?'':' disabled style="opacity:.5"'}>${wrongs.length?'내가 틀린 문제 확인하기':'틀린 문제가 없어요!'}</button>
      <a class="btn ghost" href="index.html#list">실험 선택 화면으로 돌아가기</a>
    </div>
  </div></section>`;
  $('#retry').onclick=()=>{reset();S.screen='guide';go();};
  if(wrongs.length)$('#toReview').onclick=()=>{S.screen='review';go();};
  celebrate(g.badge);
}
function celebrate(kind){
  const n={gold:90,silver:45,bronze:18}[kind]||20;
  const cols=kind==='gold'?['#ffd43b','#d62828','#2f6fde','#40c057','#fab005']:kind==='silver'?['#adb5bd','#4dabf7','#1d3557','#ffffff']:['#e8a87c','#f76707','#ffd8a8'];
  for(let k=0;k<n;k++){
    const d=document.createElement('div');d.className='confetti';
    Object.assign(d.style,{left:Math.random()*100+'vw',background:cols[k%cols.length],animationDuration:(2.4+Math.random()*2.2)+'s',
      animationDelay:Math.random()*.9+'s',borderRadius:k%3?'2px':'50%'});
    document.body.appendChild(d);setTimeout(()=>d.remove(),6000);
  }
}
function renderReview(){
  const list=wrongList();
  app.innerHTML=`<section class="screen review">
    <h1>🔎 내가 틀린 문제 다시 보기</h1>
    ${list.map(g=>`<article class="card rv"><h2>${esc(g.title)}</h2>
      ${g.items.map(it=>`<p class="q">${esc(it.q)}</p><p class="a">${esc(it.a)}</p><p class="e">${esc(it.e)}</p>`).join('')}
      ${g.summary?`<p class="e" style="margin-top:8px"><b>사고 해설</b> ${esc(g.summary)}</p>`:''}</article>`).join('')}
    <div class="center"><button class="btn" id="back" type="button">결과 화면으로</button></div>
  </section>`;
  $('#back').onclick=()=>{S.screen='result';go();};
}

/* 시작: 저장된 진행이 있으면 그 화면에서 이어서 */
shownPct=progressPct();
// 레이스를 완주하기 전에는 잠겨 있음
if(window.EXP06&&!EXP06.get().auditUnlocked){
  app.innerHTML=`<section class="screen guide"><div class="card center">
    <h2 style="justify-content:center">🔒 아직 잠겨 있어요</h2>
    <p class="note" style="margin:16px 0">배송 사고 조사반은 <b>혈액 택배 레이스</b>를 한 번 완주하면 열리는 후속 미션이에요.</p>
    <a class="btn orange" href="blood-race.html?play=1">혈액 택배 레이스 하러 가기</a></div></section>`;
  return;
}
go();
if(S.screen==='mission'||S.screen==='final')toast('지난번에 하던 조사부터 이어서 해요. (새로 하려면 ‘처음부터’)');
// 테스트·점검용
window.BD_DEBUG={get state(){return S;},MAX};
})();
