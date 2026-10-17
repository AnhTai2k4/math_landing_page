import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {STUDY_GAME_GRADE_KEY,STUDY_GAME_QUESTIONS,STUDY_GAME_TOPICS,readStudyGameGrade,saveStudyGameGrade,studyGameQuestions,studyGameTopics,type StudyGrade} from '../src/native/playground/study-game-bank';
import {beginRiver,freshRiver,readRiverRecord,RIVER_CURRICULUM_VERSION,RIVER_QUESTIONS,saveRiverRecord,tickRiver,type Lane,type RiverState} from '../src/native/playground/riverCore';
import {all,mount,root,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('D1714-RIVER-V3-');
const file='src/native/playground/RiverRace.tsx';
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];

test('24 câu THPT tách tuyệt đối theo khối/chương, metadata đủ và mức 2 đến 4 tăng dần',()=>{
  assert.equal(RIVER_CURRICULUM_VERSION,'v3');assert.equal(STUDY_GAME_QUESTIONS.length,24);assert.equal(new Set(STUDY_GAME_QUESTIONS.map(q=>q.id)).size,24);
  for(const grade of [10,11,12] as const){
    const topics=studyGameTopics(grade);assert.equal(topics.length,1);
    const bank=studyGameQuestions(grade,topics[0].id);assert.equal(bank.length,8);let level=2;
    for(const q of bank){assert.equal(q.grade,grade);assert.equal(q.chapter,topics[0].chapter);assert.ok(q.lesson&&q.type&&q.explanation&&q.tip);assert.ok(q.level>=level&&q.level>=2);level=q.level;assert.equal(new Set(q.answers).size,3);assert.ok(q.answers[q.correct]);assert.ok(!q.id.startsWith('r'));}
    for(const other of STUDY_GAME_TOPICS.filter(t=>t.grade!==grade))assert.deepEqual(studyGameQuestions(grade,other.id),[]);
    assert.deepEqual(studyGameQuestions(grade,'chuong-chua-hoc'),[]);
  }
});

test('Oracle Toán riêng khối 10: tập hợp, phủ định, đếm phần tử và kéo theo',()=>{
  const bank=studyGameQuestions(10,'g10-sets');assert.deepEqual(bank.map(q=>q.answers[q.correct]),['(1; 3)','[−2; 5]','(−1; 2)','12','∃x ∈ ℝ: x² ≤ 0','{3}','7','3']);
  const samples=Array.from({length:29},(_,i)=>-2+i/4),A=(x:number)=>x>=-2&&x<3,B=(x:number)=>x>1&&x<=5;
  for(const x of samples){assert.equal(A(x)&&B(x),x>1&&x<3);assert.equal(A(x)||(x>=1&&x<=5),x>=-2&&x<=5);assert.equal(!(x<=-1||x>=2),x>-1&&x<2);}
  assert.equal(26+20-34,12);assert.equal(0**2<=0,true);
  const integers=Array.from({length:7},(_,i)=>i-3);assert.deepEqual(integers.filter(x=>x>-3&&x<=3&&!(x*x<=4)),[3]);
  assert.equal(32-(18+15-8),7);assert.deepEqual(integers.filter(x=>x*x<=4&&!(x<0)),[0,1,2]);
});

test('Oracle Toán riêng khối 11: dấu góc phần tư, đồng nhất thức và đếm nghiệm trên chu kỳ',()=>{
  const bank=studyGameQuestions(11,'g11-trig');assert.deepEqual(bank.map(q=>q.answers[q.correct]),['−4/5','5/12','−3/4','−3/5','2','4','π/4 + 2kπ','4']);
  assert.ok(Math.abs(Math.cos(Math.PI-Math.asin(3/5))+4/5)<1e-12);
  const alpha=Math.PI+Math.acos(12/13);assert.ok(Math.abs(Math.tan(alpha)-5/12)<1e-12);
  assert.equal((.5**2)-1,-.75);assert.equal((1-2**2)/(1+2**2),-.6);
  // Đếm nghiệm bằng đơn vị π/12, độc lập với công thức giải trong module.
  const grid=Array.from({length:24},(_,i)=>i*Math.PI/12),near=(x:number)=>Math.abs(x)<1e-9;
  assert.equal(grid.filter(x=>near(Math.sin(x)-Math.sqrt(3)/2)).length,2);
  assert.equal(grid.filter(x=>near(Math.cos(2*x))).length,4);
  assert.deepEqual(grid.filter(x=>near(Math.sin(x)+Math.cos(x)-Math.sqrt(2))).map(x=>Math.round(x/Math.PI*12)),[3]);
  assert.equal(grid.filter(x=>near(Math.sin(2*x)-Math.cos(x))).length,4);
});

test('Oracle Toán riêng khối 12: sai phân kiểm dấu, cực trị, tối ưu và biên tham số',()=>{
  const bank=studyGameQuestions(12,'g12-derivatives');assert.deepEqual(bank.map(q=>q.answers[q.correct]),['(0; 2)','3','Nghịch biến trên (1; +∞)','−2','3','m ≤ 0','4','m < 3']);
  const diff=(f:(x:number)=>number,x:number)=>(f(x+1e-5)-f(x-1e-5))/2e-5;
  assert.ok(diff(x=>x**3-3*x*x+2,1)<0);assert.ok(diff(x=>x**3-3*x*x+2,-1)>0);assert.ok(diff(x=>x**3-3*x*x+2,3)>0);
  const f=(x:number)=>x**3-3*x+1;assert.equal(f(-1),3);assert.ok(f(-1)>f(-1.01)&&f(-1)>f(-.99));assert.ok(diff(x=>(2*x+1)/(x-1),2)<0);
  const xs=Array.from({length:2001},(_,i)=>i/1000);assert.equal(Math.min(...xs.map(x=>x**3-3*x)),-2);
  const quartic=(x:number)=>x**4-2*x*x;for(const x of [-1,0,1])assert.ok((quartic(x)-quartic(x-.01))*(quartic(x+.01)-quartic(x))<0);
  for(const m of [-1,0,1])assert.equal(diff(x=>x**3-3*m*x,0)>=0,m<=0);
  assert.equal(Math.min(...Array.from({length:3001},(_,i)=>{const x=1+i/1000;return x+4/x;})),4);
  for(const m of [2,3,4]){const d=36-12*m;assert.equal(d>0,m<3);}assert.equal(diff(x=>x**3-3*x*x+3*x,.9)>0,true);assert.equal(diff(x=>x**3-3*x*x+3*x,1.1)>0,true);
});

test('Engine v3 chạy đúng ngân hàng được chọn, kết thúc đủ 8 câu và giữ API/ngân hàng legacy',()=>{
  assert.equal(RIVER_QUESTIONS.length,8);assert.equal(RIVER_QUESTIONS[0].answers[RIVER_QUESTIONS[0].correct],'6');assert.equal(beginRiver(freshRiver('standard',[])).phase,'ready');
  for(const grade of [10,11,12] as const){const bank=studyGameQuestions(grade,studyGameTopics(grade)[0].id);let state:RiverState=beginRiver(freshRiver('practice',bank));
    for(let n=0;n<4000&&state.phase!=='finished';n++){if(state.wave==='answer')state={...state,lane:bank[state.cursor].correct};if(state.wave==='rock')state={...state,lane:((state.cursor+2)%3)as Lane};state=tickRiver(state,.1);}
    assert.equal(state.phase,'finished');assert.equal(state.score,1240);assert.equal(state.hearts,3);assert.deepEqual(state.results.map(r=>r.questionId),bank.map(q=>q.id));
  }
});

test('Chỉ nhớ khối, không nhớ xác nhận chương; kỷ lục tách theo chương và chế độ, chịu quota/deny',()=>{
  const store=new FakeStore();assert.equal(readStudyGameGrade(store),null);assert.ok(saveStudyGameGrade(store,12));assert.equal(store.getItem(STUDY_GAME_GRADE_KEY),'12');assert.equal(readStudyGameGrade(store),12);store.data.set(STUDY_GAME_GRADE_KEY,'9');assert.equal(readStudyGameGrade(store),null);
  for(const bad of [9,13,NaN])assert.equal(saveStudyGameGrade(store,bad as StudyGrade),false);
  assert.ok(saveRiverRecord(store,100,'standard','g12-derivatives'));assert.equal(readRiverRecord(store,'standard','g12-derivatives'),100);assert.equal(readRiverRecord(store,'standard','g10-sets'),0);assert.equal(readRiverRecord(store,'practice','g12-derivatives'),0);assert.equal(readRiverRecord(store),0);
  assert.equal(saveRiverRecord(store,100,'standard','bad/key'),false);store.failSet='quota';assert.equal(saveStudyGameGrade(store,11),false);assert.equal(saveRiverRecord(store,200,'standard','g12-derivatives'),false);assert.equal(readStudyGameGrade({getItem(){throw Error('deny');}}),null);
});

test('Component route v3 khóa bắt đầu, đổi khối loại câu cũ và callback cũ, không đọc mạng/HS',()=>{
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame'] as const,old=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));const store=new FakeStore(),frames=new Map<number,any>();let id=0,time=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:store,matchMedia:()=>({matches:false})}});Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,addEventListener(){},removeEventListener(){}}});Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:any)=>{frames.set(++id,fn);return id;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(key:number)=>frames.delete(key)});
  const m=mount(file,{onExit(){},studyScopeRequired:true});const select=()=>all(m.tree,n=>n.type==='select')[0],checkbox=()=>all(m.tree,n=>n.type==='input')[0];
  try{
    assert.equal(m.tree.props['data-version'],'v3');assert.equal(button(m,'Bắt đầu đua thuyền').props.disabled,true);m.click('Bắt đầu đua thuyền');assert.equal(frames.size,0);assert.doesNotMatch(text(m.tree),/THCS|3\(x/);
    m.click('Khối 10');select().props.onChange({target:{value:'g10-sets'}});m.draw();const staleTopic=select().props.onChange;checkbox().props.onChange({target:{checked:true}});m.draw();const staleStart=button(m,'Bắt đầu đua thuyền').props.onClick;assert.equal(button(m,'Bắt đầu đua thuyền').props.disabled,false);
    m.click('Khối 12');staleTopic({target:{value:'g10-sets'}});staleStart();m.draw();assert.equal(select().props.value,'');assert.equal(button(m,'Bắt đầu đua thuyền').props.disabled,true);assert.equal(frames.size,0);
    select().props.onChange({target:{value:'g12-derivatives'}});m.draw();assert.match(text(m.tree),/x³ − 3x²/);assert.doesNotMatch(text(m.tree),/A = \[−2|ĐẠI SỐ THCS/);assert.equal(button(m,'Bắt đầu đua thuyền').props.disabled,true);checkbox().props.onChange({target:{checked:true}});m.draw();m.click('Bắt đầu đua thuyền');assert.equal(all(m.tree,n=>n.props.className==='river-scope').length,0);
    for(let n=0;n<33;n++){const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();}m.click('← Trái');for(let n=0;n<185;n++){const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();}m.click('Ⅱ Tạm dừng');m.click('Kết thúc và xem lời giải');assert.match(text(m.tree),/100 điểm/);assert.match(text(m.tree),/x³ − 3x²/);assert.equal(store.getItem('mtm-river-v3-g12-derivatives-standard'),'100');
    m.click('Đổi chế độ');m.click('Khối 11');assert.equal(button(m,'Bắt đầu đua thuyền').props.disabled,true);
  }finally{m.unmount();for(const key of keys){if(old[key])Object.defineProperty(globalThis,key,old[key]!);else delete(globalThis as any)[key];}}
  const launcher=readFileSync(join(root,'src/native/playground/Playground.tsx'),'utf8');assert.match(launcher,/<RiverRace onExit=\{close\} studyScopeRequired/);
  const source=[file,'src/native/playground/study-game-bank.ts','src/native/playground/riverCore.ts'].map(path=>readFileSync(join(root,path),'utf8')).join('\n');assert.doesNotMatch(source,/fetch\(|sendBeacon|supabase|\u2014/);assert.match(source,/Chưa đối chiếu được tiến độ lớp từ BTVN/);
});
finish({note:'7 nhóm ca, 24 câu có oracle Toán riêng. Chỉ xác nhận chọn khối/chương thủ công, chưa chứng minh đồng bộ tiến độ BTVN. Hook UI không thay QA trình duyệt.'});
