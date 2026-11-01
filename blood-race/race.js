/* 혈액 택배 레이스 — 게임 엔진
   코스·문제·점수는 course.js(BR_STAGES, BR_CONFIG), 해금·최고 점수는 progress.js(EXP06)에 있어요.
   그리기: 캔버스 2.5D 원근 투영(3D 엔진 없음). 깊이 d만큼 앞에 있는 물체는 p=F/(d+F)배로 작게 그려요. */
(function(){
'use strict';
const C=window.BR_CONFIG, STAGES=window.BR_STAGES;
const $=s=>document.querySelector(s);
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ================= 화면 전환 ================= */
function show(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===id));
  if(id!=='play')stop();
}

/* ================= 첫 화면(실험 06 선택 화면) ================= */
function renderLobby(){
  const m=EXP06.get();
  $('#raceBestTxt').textContent=m.raceDone?`최고 점수 ${m.raceBest}점 · 다시 달려 기록에 도전!`:'좌심실에서 출발해 한 바퀴를 달려요';
  const a=$('#goAudit');
  a.classList.toggle('locked',!m.auditUnlocked);
  a.setAttribute('aria-disabled',String(!m.auditUnlocked));
  $('#auditTxt').textContent=!m.auditUnlocked?'혈액 택배 레이스를 완주하면 열려요':
    m.auditDone?`감사 최고 점수 ${m.auditBest}점 · 언제든 다시 도전!`:'감사팀이 오기 전에 잘못된 배송 기록을 찾아라!';
  show('lobby');
}
$('#goRace').onclick=()=>show('howto');
$('#goAudit').onclick=()=>{
  const a=$('#goAudit');
  if(!EXP06.get().auditUnlocked){a.classList.remove('shake');void a.offsetWidth;a.classList.add('shake');return;}
  location.href='blood-delivery.html';
};
$('#resetAll').onclick=()=>{
  if(confirm('실험 06의 모든 기록을 지울까요?\n레이스 완주 기록, 배송 사고 조사반 해금, 최고 점수가 모두 사라져요.')){EXP06.resetAll();renderLobby();}
};
$('#howBack').onclick=renderLobby;
$('#startRace').onclick=()=>{show('play');newRace();};

/* ================= 캔버스 ================= */
const cv=$('#road'), ctx=cv.getContext('2d');
let W=0,H=0,DPR=1,hy=0,cx=0,RW=0;
const F=14, VIEW=150;                       // 원근 상수, 보이는 거리
function resize(){
  DPR=Math.min(2,devicePixelRatio||1);W=innerWidth;H=innerHeight;
  cv.width=W*DPR;cv.height=H*DPR;ctx.setTransform(DPR,0,0,DPR,0,0);
  hy=H*0.36;cx=W/2;RW=Math.min(W*0.44,H*0.95);
}
addEventListener('resize',resize);resize();
const P=d=>F/(Math.max(d,-F*0.6)+F);
const yAt=d=>hy+(H-hy)*P(d);
const halfW=d=>RW*P(d);
const laneX=(lane,d)=>cx+lane*(2/3)*halfW(d);

/* 색 테마 (조금씩 섞이며 바뀜) */
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const THEMES={
  artery:{sky:'#2a0509',far:'#7a1020',wallA:'#a4161a',wallB:'#8d0f14',roadA:'#e8a0a3',roadB:'#dc8a8e',ring:'#ffb3b3',cell:'#d62828'},
  cells: {sky:'#3a1720',far:'#b5838d',wallA:'#f2c9bd',wallB:'#e9b7a9',roadA:'#f6d5cb',roadB:'#efc3b6',ring:'#ffffff',cell:'#d62828'},
  vein:  {sky:'#06112b',far:'#1e3a8a',wallA:'#22408f',wallB:'#1b347a',roadA:'#9dbbe8',roadB:'#88a9de',ring:'#a5c8ff',cell:'#4f6fbf'},
  lung:  {sky:'#4a1a2c',far:'#d77a93',wallA:'#f4a6b8',wallB:'#ec93a8',roadA:'#ffd3dd',roadB:'#fbc0ce',ring:'#ffffff',cell:'#e5383b'},
  heart: {sky:'#1a0204',far:'#5c0a0f',wallA:'#7f1d1d',wallB:'#6a1515',roadA:'#c45c66',roadB:'#b54b56',ring:'#ff8787',cell:'#a4161a'},
};
const PAL={};
function setPalette(name,instant){const t=THEMES[name];for(const k in t){const c=hex(t[k]);if(instant||!PAL[k])PAL[k]=c.slice();PAL['_'+k]=c;}}
function stepPalette(dt){for(const k in THEMES.artery){const a=PAL[k],b=PAL['_'+k];for(let i=0;i<3;i++)a[i]+=(b[i]-a[i])*Math.min(1,dt*1.6);}}
const col=(k,a=1)=>`rgba(${PAL[k][0]|0},${PAL[k][1]|0},${PAL[k][2]|0},${a})`;

/* ================= 게임 상태 ================= */
let G=null, raf=0, last=0;
const TOTAL_EVENTS=STAGES.reduce((n,s)=>n+s.events.length,0);
function newRace(){
  G={si:0,ei:-1,pos:0,v:0,lane:0,tx:0,hearts:C.hearts,score:0,cargo:{...C.start},objs:[],ev:null,hold:false,
    paused:false,over:false,theme:'artery',baseTheme:'artery',roomUntil:-1,done:0,fx:[],anim:null,tunnel:0,
    stats:{forkFirst:0,forks:0,items:0,wrongs:0},cp:null,log:[],pend:{o2:0,co2:0},squash:0,landT:0,timeScale:G0.timeScale};
  setPalette('artery',true);
  hud();start();startStage(0);
}
const G0={timeScale:1};   // 시험·점검용 배속

function startStage(si,restore){
  const st=STAGES[si];
  G.si=si;G.ei=-1;G.objs=[];G.ev=null;G.hold=false;G.anim=null;
  if(!restore)G.cp={score:G.score,cargo:{...G.cargo},done:G.done,stats:{...G.stats}};
  G.baseTheme=st.theme;G.theme=st.theme;setPalette(st.theme);
  G.where=st.where;G.dest=st.dest;
  xpanel(si===1?'body':null);
  banner(`STAGE ${st.no}`,st.title);
  hud();
  G.wait=G.pos+40;   // 배너를 보여 주는 동안 조금 달린 뒤 첫 이벤트
  setQ(st.intro);
}
function nextEvent(){
  const st=STAGES[G.si];
  G.ei++;G.ev=null;
  if(G.ei>=st.events.length)return stageClear();
  const e=st.events[G.ei], at=G.pos+C.gap;
  G.ev={...e,at,state:'run'};
  if(e.type==='fork'){
    const right=Math.random()<.5;   // 정답 터널이 오른쪽인지
    G.ev.left=right?e.options[1]:e.options[0];G.ev.right=right?e.options[0]:e.options[1];G.ev.correct=right?1:-1;G.ev.first=true;
    G.objs.push({kind:'fork',at,ev:G.ev});
    setQ(e.q,[`◀ ${G.ev.left}`,`${G.ev.right} ▶`]);
  }else if(e.type==='collect'){
    G.ev.got=0;spawnItems(G.ev);setQ(e.q);
  }else if(e.type==='deliver'||e.type==='return'){
    G.objs.push({kind:'station',at,ev:G.ev});setQ(e.q);
    if(e.type==='return')xpanel('lung');
  }else if(e.type==='room'){
    G.objs.push({kind:'room',at,ev:G.ev});setQ(`${e.name}(${e.sub})으로 들어가요.`);
  }else if(e.type==='sign'){
    G.objs.push({kind:'sign',at:G.pos+C.gap*.6,ev:G.ev});
  }
}
function eventDone(){G.done++;hud();G.ev=null;G.wait=G.pos+12;}
function stageClear(){
  const st=STAGES[G.si];
  addScore(C.score.stage,'구역 완주');
  if(G.si===STAGES.length-1)return finishRace();
  banner(`STAGE ${st.no} 완주!`,`구역 완주 보너스 +${C.score.stage}`);
  G.next=G.pos+60;G.ev={type:'gap',state:'run'};
}

/* 상자 늘어놓기: 맞는 상자와 엉뚱한 상자를 섞음 */
function spawnItems(ev){
  const n=8, gap=17, start=G.pos+C.gap, wrong=ev.item==='co2'?'o2':'co2';
  const needLeft=ev.need-ev.got;
  const kinds=Array.from({length:n},(_,i)=>i<Math.max(needLeft+1,5)?ev.item:wrong).sort(()=>Math.random()-.5);
  let prev=0;
  kinds.forEach((k,i)=>{let lane;do{lane=(Math.random()*3|0)-1;}while(i&&lane===prev&&Math.random()<.5);prev=lane;
    G.objs.push({kind:'item',item:k,lane,at:start+i*gap,ev});});
  ev.lastAt=start+(n-1)*gap;
}

/* ================= 매 프레임 ================= */
function start(){stop();last=performance.now();raf=requestAnimationFrame(loop);addEventListener('keydown',onKey,{passive:false});
  document.addEventListener('visibilitychange',onVis);}
function stop(){if(raf)cancelAnimationFrame(raf);raf=0;removeEventListener('keydown',onKey);document.removeEventListener('visibilitychange',onVis);}
function onVis(){if(document.hidden&&G&&!G.over)pause(true);}
function loop(now){
  const dt=Math.min(.05,(now-last)/1000)*(G?G.timeScale:1);last=now;
  if(G&&!G.paused)update(dt);
  draw(dt);
  raf=requestAnimationFrame(loop);
}
function update(dt){
  stepPalette(dt);
  // 트럭 좌우 이동(부드럽게)
  G.tx+=(G.lane-G.tx)*Math.min(1,dt*10);
  const target=G.hold||G.anim?0:C.speed;
  G.v+=(target-G.v)*Math.min(1,dt*(target?1.6:5));
  let np=G.pos+G.v*dt;
  // 반드시 멈춰야 하는 곳을 넘지 않게
  const ev=G.ev;
  if(ev&&ev.type==='fork'&&G.lane===0)np=Math.min(np,ev.at-3);
  if(ev&&(ev.type==='deliver'||ev.type==='return')&&ev.state!=='done')np=Math.min(np,ev.at-4);
  G.pos=np;
  if(G.tunnel>0)G.tunnel-=dt;
  if(G.squash>0)G.squash-=dt;if(G.landT>0)G.landT-=dt;

  if(!G.ev){if(G.pos>=G.wait)nextEvent();}
  else if(G.ev.type==='gap'){if(G.pos>=G.next){G.ev=null;startStage(G.si+1);}}
  else runEvent(G.ev,dt);

  // 아이템 충돌
  for(const o of G.objs){
    if(o.kind!=='item'||o.hit)continue;
    const d=o.at-G.pos;
    if(d<=1.6&&d>-1.2&&Math.abs(G.tx-o.lane)<.55){o.hit=true;pickItem(o);}
  }
  G.objs=G.objs.filter(o=>o.at-G.pos>-6&&!o.gone);
  // 심장의 방을 지나면 원래 배경으로
  if(G.roomUntil>0&&G.pos>G.roomUntil){G.roomUntil=-1;G.theme=G.baseTheme;setPalette(G.baseTheme);}
  if(G.anim)runAnim(dt);
}
function runEvent(ev,dt){
  const d=ev.at-G.pos;
  if(ev.type==='fork'){
    G.hold=G.lane===0&&d<16;
    if(G.hold&&!ev.told){ev.told=true;toast('가운데 길은 막혀 있어요. 좌우로 움직여 터널을 고르세요!','bad');}
    if(d<=1.6&&G.lane!==0)resolveFork(ev);
  }else if(ev.type==='collect'){
    if(G.pos>ev.lastAt+4&&ev.got<ev.need)spawnItems(ev);
  }else if(ev.type==='deliver'||ev.type==='return'){
    if(d<=6&&ev.state==='run'){ev.state='anim';startAnim(ev);}
  }else if(ev.type==='room'){
    if(d<=0){
      G.where=ev.name;G.roomUntil=G.pos+38;G.theme='heart';setPalette('heart');
      banner(ev.name,ev.sub);hud();
      if(STAGES[G.si].events.length-1===G.ei&&G.si===STAGES.length-1){eventDone();return stageClear();}
      eventDone();
    }
  }else if(ev.type==='sign'){
    if(d<-1)eventDone();
  }
}
function resolveFork(ev){
  const side=G.lane<0?-1:1, ok=side===ev.correct;
  G.objs.forEach(o=>{if(o.ev===ev)o.gone=true;});
  G.tunnel=.7;G.hold=false;
  if(ok){
    G.stats.forks++;if(ev.first)G.stats.forkFirst++;
    addScore(C.score.fork,'정답 터널');flash('good');toast(ev.ok);
    G.where=ev.where;
    if(ev.toTheme){G.baseTheme=ev.toTheme;G.theme=ev.toTheme;setPalette(ev.toTheme);}
    eventDone();
  }else{
    G.stats.wrongs++;
    flash('bad');toast(`앗, ${side<0?ev.left:ev.right} 터널이 아니에요! ${ev.hint}`,'bad');
    if(loseHeart('fork:'+(side<0?ev.left:ev.right)))return;
    // 같은 갈림길이 다시 나타남(터널 위치는 다시 섞음)
    const at=G.pos+C.gap*.9, right=Math.random()<.5, e=STAGES[G.si].events[G.ei];
    Object.assign(ev,{at,first:false,told:false,left:right?e.options[1]:e.options[0],right:right?e.options[0]:e.options[1],correct:right?1:-1});
    G.objs.push({kind:'fork',at,ev});setQ(e.q,[`◀ ${ev.left}`,`${ev.right} ▶`]);
  }
}
function pickItem(o){
  const ev=o.ev, ok=o.item===ev.item&&G.ev===ev;
  o.gone=true;
  const sx=laneX(o.lane,1),sy=yAt(1);
  if(ok){
    G.cargo[o.item]++;ev.got++;G.stats.items++;bumpCargo(o.item);
    loadBox(o.item,laneX(o.lane,1.2),yAt(1.2)-(2/3)*halfW(1.2)*.3);
    addScore(C.score.item,null,sx,sy);
    if(ev.got>=ev.need){
      G.objs.forEach(x=>{if(x.ev===ev&&x.kind==='item'&&!x.hit)x.gone=true;});
      addScore(C.score.mission,'임무 완료');
      toast(ev.item==='co2'?'이산화 탄소 수거 완료! 세포에서 생긴 이산화 탄소를 실었어요.':'산소 수령 완료! 새 산소를 가득 실었어요.');
      if(ev.item==='o2')xpanel(null);
      eventDone();
    }
  }else{
    G.stats.wrongs++;flash('bad');
    fxText('✕',sx,sy,'#ff6b6b');
    toast(ev.item==='co2'?'여기서는 산소를 받지 않아요! 온몸 모세혈관에서는 세포가 만든 이산화 탄소(CO₂)를 수거해요.':
      '여기서는 이산화 탄소를 싣지 않아요! 허파에서는 이산화 탄소를 내보내고 산소(O₂)를 받아요.','bad');
    loseHeart('item:'+o.item);
  }
}
function loseHeart(why){
  G.hearts--;G.log.push(why);hud();
  if(G.hearts>0)return false;
  G.paused=true;
  $('#failTxt').textContent=`STAGE ${STAGES[G.si].no} 「${STAGES[G.si].title}」 시작 지점에서 다시 도전해요.`;
  $('#failOv').classList.add('on');
  return true;
}
$('#retryStage').onclick=()=>{
  $('#failOv').classList.remove('on');
  const cp=G.cp;Object.assign(G,{score:cp.score,cargo:{...cp.cargo},done:cp.done,stats:{...cp.stats},hearts:C.hearts,lane:0,tx:0,v:0,paused:false,roomUntil:-1});
  G.fx=[];G.pend={o2:0,co2:0};startStage(G.si,true);
};

/* 배송·반납 정류장: 상자가 하나씩 트럭에서 내려감 */
function startAnim(ev){
  const k=Object.keys(ev.give)[0], n=-ev.give[k];
  G.anim={ev,k,n,t:0,i:0};
  toast(ev.type==='deliver'?'세포 고객에게 산소와 영양소를 배송하는 중…':'허파 센터에 이산화 탄소를 반납하는 중…');
}
function runAnim(dt){
  const A=G.anim;A.t+=dt;
  const step=.42;
  while(A.i<A.n&&A.t>=A.i*step+.3){
    A.i++;G.cargo[A.k]--;bumpCargo(A.k);
    const s=stationScreen(A.ev), tr=truckScreen();
    const from=slotPos(A.k,Math.min(4,G.cargo[A.k]));
    G.fx.push({kind:'box',item:A.k,x0:from.x,y0:from.y,x1:s.x,y1:s.y,t:0,dur:.6});
    if(A.ev.type==='deliver')G.fx.push({kind:'box',item:'food',x0:from.x,y0:from.y,x1:s.x,y1:s.y+10,t:-.15,dur:.6});
  }
  if(A.i>=A.n&&A.t>=A.n*step+1){
    const ev=A.ev;G.anim=null;ev.state='done';
    addScore(C.score.mission,'임무 완료');
    toast(ev.type==='deliver'?'산소 배송 완료! 세포가 산소와 영양소를 받았어요.':'반납 완료! 이산화 탄소를 허파에 내보냈어요.');
    eventDone();
  }
}
function stationScreen(ev){const d=Math.max(ev.at-G.pos,2),s=Math.min(halfW(d)*.75,H*.26);return {x:Math.min(cx+halfW(d)*1.45,W-s*.8),y:yAt(d)-s*.9};}

/* ================= 그리기 ================= */
function draw(dt){
  if(!G)return;
  ctx.clearRect(0,0,W,H);
  // 혈관 안쪽 먼 곳
  const g=ctx.createRadialGradient(cx,hy,4,cx,hy,Math.max(W,H)*.7);
  g.addColorStop(0,col('far'));g.addColorStop(.35,col('sky'));g.addColorStop(1,'#000');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  // 도로와 벽 (먼 곳부터)
  const N=70;
  for(let k=N;k>=1;k--){
    const d0=VIEW*Math.pow(k/N,1.8), d1=VIEW*Math.pow((k-1)/N,1.8);
    const y0=yAt(d0),y1=yAt(d1),w0=halfW(d0),w1=halfW(d1);
    const band=Math.floor((G.pos+d0)/7)%2===0;
    ctx.fillStyle=band?col('wallA'):col('wallB');
    ctx.beginPath();ctx.moveTo(0,y0);ctx.lineTo(cx-w0,y0);ctx.lineTo(cx-w1,y1);ctx.lineTo(0,y1);ctx.fill();
    ctx.beginPath();ctx.moveTo(W,y0);ctx.lineTo(cx+w0,y0);ctx.lineTo(cx+w1,y1);ctx.lineTo(W,y1);ctx.fill();
    ctx.fillStyle=band?col('roadA'):col('roadB');
    ctx.beginPath();ctx.moveTo(cx-w0,y0);ctx.lineTo(cx+w0,y0);ctx.lineTo(cx+w1,y1);ctx.lineTo(cx-w1,y1);ctx.fill();
    // 차선
    if(band){ctx.fillStyle='rgba(255,255,255,.85)';
      for(const s of [-1/3,1/3]){const a=cx+s*w0*2,b=cx+s*w1*2,lw0=Math.max(1,w0*.018),lw1=Math.max(1,w1*.018);
        ctx.beginPath();ctx.moveTo(a-lw0,y0);ctx.lineTo(a+lw0,y0);ctx.lineTo(b+lw1,y1);ctx.lineTo(b-lw1,y1);ctx.fill();}}
    ctx.fillStyle='rgba(255,255,255,.6)';
    for(const s of [-1,1]){ctx.beginPath();ctx.moveTo(cx+s*w0,y0);ctx.lineTo(cx+s*w0*.985,y0);ctx.lineTo(cx+s*w1*.985,y1);ctx.lineTo(cx+s*w1,y1);ctx.fill();}
  }
  // 혈관 고리(관 모양 느낌)
  for(let z=Math.ceil(G.pos/20)*20;z<G.pos+VIEW;z+=20){
    const d=z-G.pos;if(d<1)continue;const p=P(d), y=yAt(d);
    ctx.strokeStyle=col('ring',.22*Math.min(1,p*3));ctx.lineWidth=Math.max(1,10*p);
    ctx.beginPath();ctx.ellipse(cx,y,halfW(d)*1.55,(y-hy)*1.25+halfW(d)*.25,0,Math.PI,Math.PI*2);ctx.stroke();
  }
  // 길가 장식 + 물체 (먼 것부터)
  const list=[];
  for(let z=Math.ceil(G.pos/24)*24;z<G.pos+VIEW;z+=24){const d=z-G.pos;if(d>-3)list.push({deco:true,d,side:((z/24)|0)%2?-1:1,seed:z});}
  for(const o of G.objs){const d=o.at-G.pos;if(d<VIEW&&d>-4)list.push({o,d});}
  list.sort((a,b)=>b.d-a.d);
  for(const it of list){
    if(it.deco)drawDeco(it);
    else ({item:drawItem,fork:drawFork,station:drawStation,room:drawRoom,sign:drawSign}[it.o.kind])(it.o,it.d);
  }
  if(G.tunnel>0){ctx.fillStyle=`rgba(0,0,0,${Math.min(.75,G.tunnel)})`;ctx.fillRect(0,0,W,H);}
  drawTruck();
  drawFx(dt);
}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function label(text,x,y,size,bg,fg,pad=.35){
  ctx.font=`${size}px Jua, 'Malgun Gothic', sans-serif`;const tw=ctx.measureText(text).width;
  const w=tw+size*pad*2*1.4, h=size*1.45;
  ctx.fillStyle=bg;rr(x-w/2,y-h/2,w,h,h*.3);ctx.fill();
  ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+size*.05);
  return w;
}
function drawDeco({d,side,seed}){
  const p=P(d),x=cx+side*halfW(d)*1.6,y=yAt(d),s=halfW(d)*.42;
  if(s<2)return;
  const t=G.theme;
  if(t==='cells'){   // 세포 마을의 세포 집
    ctx.fillStyle='#f8e1d8';ctx.strokeStyle='#c98b7c';ctx.lineWidth=Math.max(1,s*.06);
    ctx.beginPath();ctx.ellipse(x,y-s*.7,s*.9,s*.7,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#b5838d';ctx.beginPath();ctx.arc(x+s*.2,y-s*.75,s*.25,0,Math.PI*2);ctx.fill();
    if(s>14&&seed%48===0){label('세포',x,y-s*1.55,Math.max(10,s*.32),'rgba(255,255,255,.9)','#7a3b47');}
  }else if(t==='lung'){
    ctx.fillStyle='rgba(255,240,244,.75)';
    for(const [a,b,r] of [[0,0,.5],[.45,-.3,.38],[-.4,-.35,.35],[.1,-.7,.32]]){ctx.beginPath();ctx.arc(x+a*s,y-s*.6+b*s,r*s,0,Math.PI*2);ctx.fill();}
  }else{   // 혈관 속을 떠다니는 혈구
    const fy=y-s*(1.4+((seed*7)%10)/10);
    ctx.fillStyle=col('cell',.85);ctx.beginPath();ctx.ellipse(x,fy,s*.42,s*.28,(seed%3)*.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.ellipse(x,fy,s*.2,s*.12,(seed%3)*.5,0,Math.PI*2);ctx.fill();
  }
}
function drawBox(x,y,s,item){
  const red=item==='o2', food=item==='food';
  ctx.fillStyle=food?'#ffd43b':red?'#d62828':'#2f6fde';ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=Math.max(1,s*.06);
  rr(x-s/2,y-s,s,s*.86,s*.12);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.25)';ctx.fillRect(x-s/2+s*.08,y-s+s*.1,s*.84,s*.12);
  ctx.fillStyle='#fff';ctx.font=`${Math.max(8,s*.36)}px Jua, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(food?'영양소':red?'O₂':'CO₂',x,y-s*.5);
}
function drawItem(o,d){
  const p=P(d),s=(2/3)*halfW(d)*.55,x=laneX(o.lane,d),y=yAt(d)-Math.abs(Math.sin((G.pos+o.at)*.15))*s*.15;
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.beginPath();ctx.ellipse(x,yAt(d),s*.55,s*.14,0,0,Math.PI*2);ctx.fill();
  drawBox(x,y,s,o.item);
}
function drawFork(o,d){
  const ev=o.ev,y=yAt(d),w=halfW(d),lw=(2/3)*w,ah=lw*1.25,top=y-ah*1.45;
  // 벽
  ctx.fillStyle=col('wallB');rr(cx-w*1.08,top,w*2.16,y-top,lw*.08);ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,.35)';ctx.lineWidth=Math.max(1,lw*.03);ctx.stroke();
  for(const [side,name] of [[-1,ev.left],[1,ev.right]]){
    const x=cx+side*lw, aw=lw*1.15;
    const gr=ctx.createLinearGradient(0,y-ah,0,y);gr.addColorStop(0,'#000');gr.addColorStop(1,'#2b2b2b');
    ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(x-aw/2,y);ctx.lineTo(x-aw/2,y-ah*.55);
    ctx.ellipse(x,y-ah*.55,aw/2,ah*.45,0,Math.PI,Math.PI*2);ctx.lineTo(x+aw/2,y);ctx.fill();
    ctx.strokeStyle='#ffd43b';ctx.lineWidth=Math.max(1,lw*.05);ctx.stroke();
    label(name,x,top+(y-top)*.12+lw*.12,Math.max(11,lw*.3),'#fffdf7','#14213d');
  }
  // 가운데 막힘
  ctx.fillStyle='#ffd43b';const bw=lw*.32;rr(cx-bw/2,y-ah*.8,bw,ah*.8,bw*.2);ctx.fill();
  ctx.fillStyle='#14213d';ctx.font=`${Math.max(9,bw*.6)}px Jua, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('?',cx,y-ah*.45);
  if(d<40){ctx.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<4;i++){ctx.fillRect(cx-bw/2,y-ah*.8+i*ah*.2,bw,ah*.08);}}
}
function drawStation(o,d){
  const ev=o.ev, s=Math.min(halfW(Math.max(d,0))*.75,H*.26), x=Math.min(cx+halfW(Math.max(d,0))*1.45,W-s*.8), y=yAt(Math.max(d,0));
  if(s<3)return;
  const lung=ev.type==='return';
  ctx.fillStyle=lung?'#fbe3ea':'#f8e1d8';ctx.strokeStyle=lung?'#d77a93':'#c98b7c';ctx.lineWidth=Math.max(1,s*.04);
  rr(x-s*.75,y-s*1.4,s*1.5,s*1.4,s*.2);ctx.fill();ctx.stroke();
  ctx.fillStyle=lung?'#e599a8':'#b5838d';ctx.beginPath();ctx.arc(x,y-s*.9,s*.3,0,Math.PI*2);ctx.fill();
  label(lung?'허파 반납·수령 센터':'세포 마을 배송 정류장',Math.min(x,W-s*1.1),y-s*1.6,Math.max(10,Math.min(22,s*.2)),'#14213d','#fff');
}
function drawRoom(o,d){
  const ev=o.ev,y=yAt(d),w=halfW(d),h=w*1.35;
  ctx.strokeStyle='#5c0a0f';ctx.lineWidth=Math.max(2,w*.12);
  ctx.beginPath();ctx.moveTo(cx-w*1.02,y);ctx.lineTo(cx-w*1.02,y-h*.6);ctx.ellipse(cx,y-h*.6,w*1.02,h*.42,0,Math.PI,Math.PI*2);ctx.lineTo(cx+w*1.02,y);ctx.stroke();
  ctx.strokeStyle='#ff8787';ctx.lineWidth=Math.max(1,w*.03);ctx.stroke();
  label(`${ev.name} · ${ev.sub}`,cx,y-h*1.08,Math.max(11,w*.14),'#fffdf7','#7f1d1d');
}
function drawSign(o,d){
  const w=halfW(d),x=cx-w*1.35,y=yAt(d),s=w*.5;if(s<3)return;
  ctx.fillStyle='#5c4033';ctx.fillRect(x-s*.04,y-s*1.2,s*.08,s*1.2);
  label(o.ev.text,x,y-s*1.3,Math.max(10,s*.28),'#ffd43b','#14213d');
}
/* 플레이어 차량 이미지 (원본 파일 그대로, 투명 여백만 빼고 그림)
   SRC: 원본 1536×1024 안에서 차량이 있는 영역, BED: 그 안에서 짐칸(상자가 놓이는 곳)의 위치 비율 */
const TRUCK_IMG=new Image();
TRUCK_IMG.src='blood-race/assets/blood-express-truck.png';
const SRC={x:300,y:73,w:935,h:903};
const BED={top:(424-73)/903, left:(450-300)/935, right:(1090-300)/935};
function truckScreen(){
  const d=1.2,lw=(2/3)*halfW(d), narrow=W<700, tw=narrow?Math.min(W*.44,H*.3*SRC.w/SRC.h):Math.min(lw*1.12,W*.32,H*.42*SRC.w/SRC.h);
  return {x:cx+G.tx*lw*(narrow?.85:1),y:H-(narrow?60:6),w:tw,h:tw*SRC.h/SRC.w};   // 원본 비율 그대로 (좁은 화면은 버튼 위로)
}
// 짐칸 안 상자 자리(화면 좌표). O₂는 아랫줄, CO₂는 그 위 줄
function slotPos(k,i){
  const T=truckScreen(), bs=T.w*.12, l=-T.w/2+T.w*BED.left, span=T.w*(BED.right-BED.left);
  return {x:T.x+l+span*(i+.5)/5, y:T.y-T.h+T.h*BED.top-(k==='co2'?bs*.92:0), s:bs};
}
function drawTruck(){
  if(!(TRUCK_IMG.complete&&TRUCK_IMG.naturalWidth))return drawTruckFallback();
  const T=truckScreen(),{x,y,w,h}=T, tilt=(G.lane-G.tx)*.05, bob=Math.sin(G.pos*.9)*Math.min(2,G.v*.05);
  const sq=G.squash>0?Math.sin(G.squash/.25*Math.PI)*.035:0;   // 상자가 실릴 때 살짝 눌림
  ctx.save();ctx.translate(x,y+bob);ctx.rotate(tilt);ctx.scale(1+sq*.5,1-sq);
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(0,-h*.02,w*.5,h*.05,0,0,Math.PI*2);ctx.fill();
  ctx.drawImage(TRUCK_IMG,SRC.x,SRC.y,SRC.w,SRC.h,-w/2,-h,w,h);
  // 짐칸에 실린 상자 (날아오는 중인 상자는 도착한 뒤에 보임)
  const bs=w*.12, l=-w/2+w*BED.left, span=w*(BED.right-BED.left), base=-h+h*BED.top;
  [['o2',0],['co2',1]].forEach(([k,r])=>{
    const n=Math.min(5,G.cargo[k]-(G.pend[k]||0));
    for(let i=0;i<n;i++){
      const land=G.landed&&G.landed[k]===i?Math.max(0,G.landT):0;
      drawBox(l+span*(i+.5)/5,base-r*bs*.92-Math.sin(land/.3*Math.PI)*bs*.25,bs*.95,k);
    }
  });
  ctx.restore();
}
function drawTruckFallback(){
  const T=truckScreen(),{x,y,w,h}=T, tilt=(G.lane-G.tx)*.06, bob=Math.sin(G.pos*.9)*Math.min(2,G.v*.05);
  ctx.save();ctx.translate(x,y+bob);ctx.rotate(tilt);
  ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(0,0,w*.56,h*.06,0,0,Math.PI*2);ctx.fill();
  // 운전석(뒤쪽 창)
  ctx.fillStyle='#2f6fde';rr(-w*.36,-h*.98,w*.72,h*.42,w*.08);ctx.fill();
  ctx.fillStyle='#d0ebff';rr(-w*.27,-h*.92,w*.54,h*.24,w*.05);ctx.fill();
  ctx.fillStyle='#e5383b';ctx.beginPath();ctx.ellipse(-w*.05,-h*.74,w*.11,h*.08,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#1d3557';ctx.beginPath();ctx.ellipse(-w*.05,-h*.82,w*.12,h*.04,0,Math.PI,Math.PI*2);ctx.fill();
  // 짐칸과 상자 (적재량이 그대로 보임)
  ctx.fillStyle='#fffdf7';ctx.strokeStyle='#1d3557';ctx.lineWidth=Math.max(2,w*.025);
  rr(-w*.5,-h*.6,w,h*.12,w*.03);ctx.fill();ctx.stroke();
  const bs=w*.17;
  const rows=[['o2',G.cargo.o2],['co2',G.cargo.co2]];
  rows.forEach(([k,n],r)=>{for(let i=0;i<Math.min(5,n);i++){drawBox(-w*.4+bs*.5+i*bs*1.08,-h*.6-r*bs*.9+ (r?0:0),bs*.95,k);}});
  // 뒷문
  ctx.fillStyle='#fffdf7';rr(-w*.5,-h*.5,w,h*.36,w*.04);ctx.fill();ctx.stroke();
  ctx.fillStyle='#d62828';ctx.fillRect(-w*.5,-h*.5,w,h*.07);
  ctx.fillStyle='#1d3557';ctx.font=`${Math.max(10,w*.11)}px Jua, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('혈액 택배',0,-h*.3);
  ctx.fillStyle='#ffd43b';ctx.fillRect(-w*.49,-h*.2,w*.1,h*.06);ctx.fillRect(w*.39,-h*.2,w*.1,h*.06);
  ctx.fillStyle='#ff6b6b';ctx.fillRect(-w*.49,-h*.27,w*.1,h*.06);ctx.fillRect(w*.39,-h*.27,w*.1,h*.06);
  // 바퀴
  ctx.fillStyle='#1b1b1b';rr(-w*.5,-h*.15,w*.2,h*.16,w*.04);ctx.fill();rr(w*.3,-h*.15,w*.2,h*.16,w*.04);ctx.fill();
  ctx.fillStyle='#555';ctx.fillRect(-w*.3,-h*.12,w*.6,h*.05);
  ctx.restore();
}
function loadBox(k,x0,y0){
  G.pend[k]=(G.pend[k]||0)+1;
  G.fx.push({kind:'load',item:k,x0,y0,idx:Math.min(4,G.cargo[k]-1),t:0,dur:.55});
}
function fxText(s,x,y,color){G.fx.push({kind:'text',s,x,y,color,t:0,dur:1});}
function drawFx(dt){
  for(const f of G.fx){
    f.t+=dt;const q=Math.max(0,Math.min(1,f.t/f.dur));
    if(f.t<0)continue;
    if(f.kind==='load'){
      const to=slotPos(f.item,f.idx), x=f.x0+(to.x-f.x0)*q, y=f.y0+(to.y-f.y0)*q-Math.sin(Math.PI*q)*90;
      ctx.globalAlpha=.35;drawBox(x,y+to.s*.15,to.s*(1.9-.95*q)*1.08,f.item);ctx.globalAlpha=1;   // 잔상
      drawBox(x,y,to.s*(1.9-.95*q),f.item);
      if(f.t+dt>=f.dur&&!f.done){f.done=true;G.pend[f.item]=Math.max(0,G.pend[f.item]-1);G.squash=.25;G.landed={[f.item]:f.idx};G.landT=.3;}
    }
    else if(f.kind==='box'){const x=f.x0+(f.x1-f.x0)*q,y=f.y0+(f.y1-f.y0)*q-Math.sin(Math.PI*q)*80;drawBox(x,y,34,f.item);}
    else{ctx.globalAlpha=1-q;ctx.font='32px Jua, sans-serif';ctx.textAlign='center';ctx.lineWidth=6;ctx.strokeStyle='rgba(0,0,0,.6)';
      ctx.strokeText(f.s,f.x,f.y-q*60);ctx.fillStyle=f.color;ctx.fillText(f.s,f.x,f.y-q*60);ctx.globalAlpha=1;}
  }
  G.fx=G.fx.filter(f=>f.t<f.dur);
}

/* ================= HUD ================= */
function hud(){
  const st=STAGES[G.si];
  $('#hudStage').textContent=`STAGE ${st.no} / ${STAGES.length}`;
  $('#hudWhere').textContent=G.where||st.where;$('#hudDest').textContent=G.dest||st.dest;
  $('#hudScore').textContent=G.score;
  $('#hudHearts').innerHTML=Array.from({length:C.hearts},(_,i)=>`<span class="${i<G.hearts?'':'lost'}">❤️</span>`).join('');
  $('#hudHearts').setAttribute('aria-label',`배송 안정도 ${G.hearts} / ${C.hearts}`);
  const pct=Math.round(G.done/TOTAL_EVENTS*100);$('#hudBar').style.width=pct+'%';$('#hudPct').textContent=pct+'%';
  $('#cO2').textContent=G.cargo.o2;$('#cCO2').textContent=G.cargo.co2;
}
function setQ(q,opts){$('#hudQ').textContent=q||'';$('#hudOpts').innerHTML=(opts||[]).map(o=>`<span>${esc(o)}</span>`).join('');}
function addScore(n,why,x,y){G.score+=n;hud();fxText(`+${n}`,x??cx,y??H*.55,'#ffe066');}
function bumpCargo(k){hud();const el=$(k==='o2'?'#cO2':'#cCO2').parentNode;el.classList.remove('bump');void el.offsetWidth;el.classList.add('bump');}
let toastT;
function toast(msg,kind){const t=$('#toast');t.textContent=msg;t.className='toast on'+(kind==='bad'?' bad':'');clearTimeout(toastT);toastT=setTimeout(()=>t.className='toast',kind==='bad'?3600:2400);}
function banner(b,s){const el=$('#banner');el.innerHTML=`<b>${esc(b)}</b><span>${esc(s)}</span>`;el.classList.remove('on');void el.offsetWidth;el.classList.add('on');}
function flash(k){const f=$('#flash');f.className=k;requestAnimationFrame(()=>requestAnimationFrame(()=>f.className=''));}
function xpanel(kind){
  const el=$('#xpanel');
  if(!kind){el.classList.remove('on');return;}
  el.innerHTML=kind==='body'?`<h4>온몸 모세혈관에서</h4>
      <div class="xr"><span class="who b">혈액</span><span class="ar">→ 산소·영양소 →</span><span class="who c">조직 세포</span></div>
      <div class="xr"><span class="who c">조직 세포</span><span class="ar">→ 이산화 탄소 →</span><span class="who b">혈액</span></div>`:
    `<h4>허파에서</h4>
      <div class="xr"><span class="who b">혈액</span><span class="ar">→ 이산화 탄소 →</span><span class="who l">허파</span></div>
      <div class="xr"><span class="who l">허파</span><span class="ar">→ 산소 →</span><span class="who b">혈액</span></div>`;
  el.classList.add('on');
}

/* ================= 조작 ================= */
function move(dir){if(!G||G.paused||G.over)return;G.lane=Math.max(-1,Math.min(1,G.lane+dir));}
function onKey(e){
  const k=e.key;
  if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(k)||/^[aAdD]$/.test(k))e.preventDefault();   // 화면이 스크롤되지 않게
  if(e.repeat)return;
  if(k==='ArrowLeft'||k==='a'||k==='A')move(-1);
  else if(k==='ArrowRight'||k==='d'||k==='D')move(1);
  else if(k==='Escape'||k==='p'||k==='P')pause(!G.paused);
}
for(const [id,dir] of [['#btnL',-1],['#btnR',1]])$(id).addEventListener('pointerdown',e=>{e.preventDefault();move(dir);});
let sw=null;
$('#play').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sw={x:e.clientX,y:e.clientY};});
$('#play').addEventListener('pointerup',e=>{if(!sw)return;const dx=e.clientX-sw.x;if(Math.abs(dx)>36&&Math.abs(dx)>Math.abs(e.clientY-sw.y))move(dx<0?-1:1);sw=null;});
function pause(on){
  if(!G||G.over||$('#failOv').classList.contains('on'))return;
  G.paused=on;$('#pauseOv').classList.toggle('on',on);
}
$('#btnPause').onclick=()=>pause(true);
$('#resume').onclick=()=>pause(false);
$('#quit').onclick=()=>{$('#pauseOv').classList.remove('on');G.over=true;renderLobby();};

/* ================= 완주 → 긴급 이벤트 ================= */
let finT;
function finishRace(){
  G.over=true;G.ev={type:'end'};setQ('');xpanel(null);
  EXP06.raceFinished(G.score);
  setTimeout(()=>{
    show('finish');
    const s=G.stats;
    $('#finStats').innerHTML=`<div>최종 점수<b>${G.score}</b></div><div>한 번에 맞힌 갈림길<b>${s.forkFirst} / ${s.forks}</b></div>
      <div>수집한 상자<b>${s.items}개</b></div><div>남은 배송 안정도<b>${'❤️'.repeat(Math.max(0,G.hearts))}</b></div>`;
    // 결과를 보여 준 뒤 본사 연락으로 자연스럽게 넘어감
    const bar=$('#finBar');bar.style.transition='none';bar.style.width='0';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{bar.style.transition='width 9s linear';bar.style.width='100%';}));
    clearTimeout(finT);finT=setTimeout(toAlert,9200);
  },1200);
}
function toAlert(){clearTimeout(finT);show('alert');}
$('#finNext').onclick=toAlert;
$('#toAudit').onclick=()=>{EXP06.resetAuditPlay();location.href='blood-delivery.html?from=race';};
$('#later').onclick=renderLobby;

/* ================= 시작 ================= */
const params=new URLSearchParams(location.search);
if(params.get('play')==='1')show('howto');else renderLobby();
// 점검용: BR_DEBUG.state로 상태 보기, BR_DEBUG.speed(배속)
window.BR_DEBUG={get state(){return G;},speed(m){G0.timeScale=m;if(G)G.timeScale=m;},move,finish:()=>finishRace()};
})();
