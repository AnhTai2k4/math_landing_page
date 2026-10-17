import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {STUDY_GAME_TOPICS,studyGameQuestions} from '../src/native/playground/study-game-bank';
import {bossDeck,canGuardBoss,finishBoss,freshBoss,guardBoss,moveBoss,nextBoss,pauseBoss,resolveBossGuard,resumeBoss,skipBossIntro,startBoss,tickBoss,type BossState} from '../src/native/Boss-core';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1715-BOSS-'),file='src/native/BossLibraryGame.tsx',deck=bossDeck(12,'g12-derivatives');
function until(state:BossState,predicate:(s:BossState)=>boolean,limit=1500){for(let i=0;i<limit;i++){if(predicate(state))return state;state=tickBoss(state,.06);}throw Error('Không tới trạng thái Boss dự kiến');}
function answer(state:BossState,lane:number){while(state.lane!==lane)state=moveBoss(state,state.lane<lane?1:-1,true);return nextBoss(resolveBossGuard(guardBoss(state)));}

test('Đúng khối/chương, câu đã kiểm, mức tăng, lọc trùng và bộ lẫn khối, không nhận nội dung sửa theo ID',()=>{
 for(const topic of STUDY_GAME_TOPICS){
  const questions=bossDeck(topic.grade,topic.id);assert.equal(questions.length,8);assert.ok(questions.every(q=>q.grade===topic.grade&&q.chapter===topic.chapter&&q.level>=2&&q.lesson&&q.type));assert.ok(questions.every((q,i)=>!i||q.level>=questions[i-1].level));
  assert.deepEqual(freshBoss([...questions,...questions]).questions,questions);for(const other of STUDY_GAME_TOPICS)if(other.grade!==topic.grade)assert.deepEqual(bossDeck(other.grade,topic.id),[]);
 }
 const mixed=freshBoss([deck[0],...bossDeck(10,'g10-sets'),...deck]);assert.deepEqual(mixed.questions,deck);
 assert.equal(freshBoss([{...deck[0],prompt:'Nội dung sửa tùy ý',correct:2}]).questions[0],deck[0]);assert.equal(startBoss(freshBoss()).phase,'finished');
});

test('Oracle Toán kiểm các đáp án được tái dùng, không sinh khóa chấm hay câu hỏi mới',()=>{
 const ten=studyGameQuestions(10,'g10-sets'),eleven=studyGameQuestions(11,'g11-trig'),twelve=deck;
 assert.equal(26+20-34,Number(ten[3].answers[ten[3].correct]));assert.equal(32-(18+15-8),Number(ten[6].answers[ten[6].correct]));assert.equal([-3,-2,-1,0,1,2,3].filter(x=>x*x<=4&&x>=0).length,Number(ten[7].answers[ten[7].correct]));
 assert.equal(-(Math.sqrt(1-(3/5)**2)),-4/5);assert.equal(eleven[0].answers[eleven[0].correct],'−4/5');assert.equal((.5**2-1),-.75);assert.equal(eleven[2].answers[eleven[2].correct],'−3/4');
 assert.equal(Math.min(...[0,1,2].map(x=>x**3-3*x)),Number(twelve[3].answers[twelve[3].correct].replace('−','-')));assert.equal(Math.min(...[1,2,4].map(x=>x+4/x)),Number(twelve[6].answers[twelve[6].correct]));
 for(const questions of [ten,eleven,twelve])assert.deepEqual(questions.map(q=>q.correct),[0,1,2,0,1,2,0,1]);
});

test('Di chuyển liên tục, khiên phải tới làn mới dựng được, va chạm mới ghi điểm một lần',()=>{
 let state=skipBossIntro(startBoss(freshBoss(deck)));state=moveBoss(state,1);assert.equal(state.x,1);assert.equal(state.lane,2);assert.equal(canGuardBoss(state),false);assert.equal(guardBoss(state),state);
 state=tickBoss(state,.06);assert.ok(state.x>1&&state.x<2);state=until(state,s=>s.x===2);state=guardBoss(state);assert.equal(state.guarding,true);assert.equal(state.results.length,0);assert.equal(moveBoss(state,-1),state);assert.equal(guardBoss(state),state);
 state=until(state,s=>s.phase==='feedback');assert.equal(state.results.length,1);assert.equal(state.results[0].chosen,2);assert.equal(state.hearts,2);assert.equal(state.health,10);assert.equal(resolveBossGuard(state),state);assert.equal(tickBoss(state,10),state);
});

test('Tám câu đúng hóa giải Boss, combo ba đòn tăng sát thương; ba sai hết tim, quá giờ không chấm câu chưa gặp',()=>{
 let state=startBoss(freshBoss(deck),true);for(const q of deck)state=answer(state,q.correct);
 assert.equal(state.phase,'finished');assert.equal(state.health,0);assert.equal(state.hearts,3);assert.equal(state.score,1240);assert.equal(state.bestCombo,8);assert.deepEqual(state.results.map(hit=>hit.damage),[1,1,2,1,1,2,1,1]);assert.equal(state.results.length,8);
 state=startBoss(freshBoss(deck),true);for(let i=0;i<3;i++)state=answer(state,(deck[i].correct+1)%3);assert.equal(state.phase,'finished');assert.equal(state.hearts,0);assert.equal(state.results.length,3);
 state=until(startBoss(freshBoss(deck)),s=>s.phase==='feedback');assert.equal(state.results[0].chosen,null);assert.equal(state.hearts,2);assert.equal(state.results.length,1);assert.equal(nextBoss(state).cursor,1);
 const review=startBoss(freshBoss([deck[0],deck[2]]),true);assert.equal(review.maxHealth,2);assert.equal(review.questions.length,2);
});

test('Pause đóng băng đạn, khiên, intro và đồng hồ; giảm chuyển động không kẹt; delta xấu không nhảy câu',()=>{
 const intro=startBoss(freshBoss(deck)),pausedIntro=pauseBoss(intro);assert.equal(tickBoss(pausedIntro,100),pausedIntro);assert.equal(resumeBoss(pausedIntro).phase,'intro');assert.equal(resumeBoss(pausedIntro,true).phase,'running');
 const running=guardBoss(skipBossIntro(intro)),paused=pauseBoss(running);assert.equal(tickBoss(paused,.06),paused);assert.equal(resumeBoss(paused).guarding,true);assert.equal(resumeBoss(paused,true).phase,'feedback');assert.equal(resumeBoss(paused,true).results.length,1);assert.equal(finishBoss(paused).results.length,0);assert.equal(finishBoss(running),running);
 for(const delta of [NaN,Infinity,0,-1])assert.equal(tickBoss(running,delta),running);assert.deepEqual(tickBoss(running,9999),tickBoss(running,.06));assert.equal(moveBoss(running,9 as any),running);
});

function browser(reduced=false){
 const names=['window','document','requestAnimationFrame','cancelAnimationFrame','AudioContext'] as const,previous=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let id=0,time=0;
 const doc={hidden:false,addEventListener:(key:string,fn:()=>void)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{matchMedia:()=>({matches:reduced})}});Object.defineProperty(globalThis,'document',{configurable:true,value:doc});Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(value:number)=>frames.delete(value)});
 return {doc,frames,listeners,step(m:any){const callbacks=[...frames.values()];frames.clear();time+=60;callbacks.forEach(fn=>fn(time));m.draw();},restore(){for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]!);else delete(globalThis as any)[name];}}};
}
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
function selectGrade(m:any,grade='12'){all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:grade}});m.draw();}
function confirm(m:any){all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();}
function key(m:any,value:string,tagName='DIV'){m.tree.props.onKeyDown({key:value,target:{tagName},preventDefault(){}});m.draw();}

test('Bắt buộc chọn/xác nhận chương, đổi khối xóa xác nhận, callback cũ không mở bộ khối trước',()=>{
 const env=browser(true),m=mount(file);try{
  assert.equal(button(m,'Vào bảo vệ thư viện').props.disabled,true);selectGrade(m);confirm(m);const oldBegin=button(m,'Vào bảo vệ thư viện').props.onClick,oldConfirm=all(m.tree,n=>n.type==='input')[0].props.onChange;
  selectGrade(m,'10');oldBegin();oldConfirm({target:{checked:true}});m.draw();assert.equal(button(m,'Vào bảo vệ thư viện').props.disabled,true);assert.match(text(m.tree),/Mệnh đề và tập hợp/);confirm(m);m.click('Vào bảo vệ thư viện');assert.match(text(m.tree),/KHỐI 10/);assert.match(text(m.tree),/A = \[−2; 3\)/);assert.doesNotMatch(text(m.tree),/x³ − 3x²/);
 }finally{m.unmount();env.restore();}
});

test('Phím và chạm chơi thật, callback cũ không nhảy lượt, summary lời giải và ôn riêng câu sai',()=>{
 const env=browser(true),m=mount(file);try{
  selectGrade(m);confirm(m);m.click('Vào bảo vệ thư viện');assert.equal(m.focused?.type,'div');assert.equal(env.frames.size,0);key(m,'ArrowLeft');key(m,' ');assert.match(text(m.tree),/Đỡ chuẩn/);assert.equal(m.focused?.type,'h4');const oldNext=button(m,'Đòn tiếp theo').props.onClick;oldNext();oldNext();m.draw();assert.match(text(m.tree),/cực đại bằng/);assert.match(text(m.tree),/CÂU2\/8/);
  m.click('Dựng khiên');assert.match(text(m.tree),/Mất 1 tim/);m.click('Đòn tiếp theo');key(m,'p');assert.equal(m.focused?.type,'h4');m.click('Kết thúc và xem lời giải');assert.match(text(m.tree),/Đúng 1\/2 câu đã gặp/);assert.match(text(m.tree),/Lời giải các đòn đã gặp/);assert.match(text(m.tree),/f′\(x\)/);assert.equal(m.focused?.type,'h4');
  const oldRestart=button(m,'Chơi lại 8 đòn').props.onClick;m.click('Ôn lại 1 đòn chưa đúng');assert.match(text(m.tree),/CÂU1\/1/);assert.match(text(m.tree),/cực đại bằng/);oldRestart();oldNext();m.draw();assert.match(text(m.tree),/CÂU1\/1/);key(m,'ArrowLeft','SELECT');assert.match(text(m.tree),/Khiên ở làn 2\/3/);m.click('Dựng khiên');m.click('Xem tổng kết bảo vệ');assert.match(text(m.tree),/Đúng 1\/1/);assert.match(text(m.tree),/Đây là lượt ôn riêng/);
 }finally{m.unmount();assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);env.restore();}
});

test('RAF va chạm thật, ẩn tab tự pause, resume không nhảy giờ và cleanup cả callback frame đã hủy',()=>{
 const env=browser(),m=mount(file);try{
  selectGrade(m);confirm(m);m.click('Vào bảo vệ thư viện');assert.equal(env.frames.size,1);m.click('Bỏ qua mở đầu');key(m,'ArrowLeft');assert.equal(button(m,'Dựng khiên').props.disabled,true);for(let i=0;i<5;i++)env.step(m);assert.equal(button(m,'Dựng khiên').props.disabled,false);m.click('Dựng khiên');assert.match(text(m.tree),/Đã khóa làn/);
  const before=text(all(m.tree,n=>n.props.className==='boss-question')[0]);env.doc.hidden=true;env.listeners.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Khiên đã neo/);assert.equal(env.frames.size,0);m.click('Tiếp tục bảo vệ');assert.match(text(m.tree),/Khiên đã neo/);env.doc.hidden=false;m.click('Tiếp tục bảo vệ');assert.equal(text(all(m.tree,n=>n.props.className==='boss-question')[0]),before);for(let i=0;i<12;i++)env.step(m);assert.match(text(m.tree),/Đỡ chuẩn/);assert.equal(env.frames.size,0);
  m.click('Đòn tiếp theo');const stale=[...env.frames.values()][0];m.unmount();assert.equal(env.frames.size,0);stale(999999);assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);
 }finally{m.unmount();env.restore();}
});

test('Giảm chuyển động khi pause intro/đang dựng khiên không kẹt, phím tắt và IME không điều khiển',()=>{
 const env=browser(),m=mount(file);try{
  selectGrade(m);confirm(m);m.click('Vào bảo vệ thư viện');m.click('Tạm dừng Boss');m.click('Giảm chuyển động: tắt');m.click('Tiếp tục bảo vệ');assert.equal(env.frames.size,0);assert.equal(button(m,'Bỏ qua mở đầu'),undefined);const before=text(m.tree);
  for(const event of [{key:'a',ctrlKey:true},{key:'d',metaKey:true},{key:'ArrowLeft',altKey:true},{key:' ',nativeEvent:{isComposing:true}},{key:'p',ctrlKey:true},...[' ','p','ArrowLeft'].map(key=>({key,target:{tagName:'SUMMARY'}})),{key:' ',target:{tagName:'SPAN',closest:()=>({tagName:'SUMMARY'})}},{key:'a',target:{tagName:'DIV',isContentEditable:true}}]){let blocked=0;m.tree.props.onKeyDown({target:{tagName:'DIV'},...event,preventDefault(){blocked++;}});m.draw();assert.equal(blocked,0);assert.equal(text(m.tree),before);}
  m.click('Giảm chuyển động: bật');m.click('Dựng khiên');m.click('Tạm dừng Boss');m.click('Giảm chuyển động: tắt');m.click('Tiếp tục bảo vệ');assert.match(text(m.tree),/Mất 1 tim/);assert.equal(env.frames.size,0);
 }finally{m.unmount();env.restore();}
});

test('Đáp án có bản chữ theo làn, nối với sân và cập nhật vị trí khiên khi chơi bằng phím',()=>{
 const env=browser(true),m=mount(file);try{
  selectGrade(m,'11');confirm(m);m.click('Vào bảo vệ thư viện');
  const guide=()=>all(m.tree,n=>n.props.className==='boss-answer-guide')[0],lanes=()=>all(guide(),n=>n.type==='li');
  const stage=all(m.tree,n=>String(n.props.className).startsWith('boss-stage'))[0];
  assert.equal(stage.props['aria-describedby'],guide().props.id);assert.equal(lanes().length,3);
  assert.deepEqual(lanes().map(n=>text(all(n,q=>q.type==='strong')[0])),bossDeck(11,'g11-trig')[0].answers);
  assert.equal(lanes()[1].props['aria-current'],'true');assert.equal(all(guide(),n=>n.type==='button'||n.props.onClick).length,0);
  key(m,'ArrowLeft');assert.equal(lanes()[0].props['aria-current'],'true');assert.equal(lanes()[1].props['aria-current'],undefined);
  key(m,' ');assert.match(text(m.tree),/Đỡ chuẩn/);
  const css=readFileSync(join(root,'src/native/boss.css'),'utf8');assert.match(css,/\.boss-answer-guide strong\{font-size:16px/);assert.match(css,/@media\(max-width:520px\)\{\.boss-answer-guide\{grid-template-columns:1fr/);
 }finally{m.unmount();env.restore();}
});

test('Lazy thực, tải lại module khi lỗi, SSR và tích hợp chỉ ở danh sách Tài liệu',()=>{
 const tool='src/native/BossLibraryTool.tsx',m=mount(tool);assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);m.click('Mở Boss thư viện');const first=all(m.tree,n=>n.type===React.Suspense)[0].props.children;all(m.tree,n=>n.type?.name==='BossLibraryBoundary')[0].props.onRetry();m.draw();assert.notEqual(all(m.tree,n=>n.type===React.Suspense)[0].props.children.type,first.type);m.click('Đóng Boss thư viện');assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);m.unmount();
 const {BossLibraryBoundary}=load(tool);let retries=0;const boundary=new BossLibraryBoundary({onRetry:()=>retries++});boundary.state=BossLibraryBoundary.getDerivedStateFromError();assert.match(text(boundary.render()),/Em vẫn tìm và đọc tài liệu/);all(boundary.render(),n=>n.type==='button')[0].props.onClick();assert.equal(retries,1);
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/Âm thanh: tắt/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/Chọn phạm vi/);assert.doesNotMatch(html,/<main/);
 const source=readFileSync(join(root,'src/native/NativeResources.tsx'),'utf8');assert.match(source,/\{!exam&&<><BossLibraryTool\/><ReadingReviewTool/);
 for(const name of [file,tool,'src/native/Boss-core.ts'])assert.doesNotMatch(readFileSync(join(root,name),'utf8'),/fetch\(|sendBeacon|supabase|localStorage|sessionStorage|setInterval|\u2014/);
 const css=readFileSync(join(root,'src/native/boss.css'),'utf8');for(const value of ['#213269','#FFCF24','min-height:48px',':focus-visible','prefers-reduced-motion'])assert.ok(css.includes(value));
});
finish({note:'Test core/hook/SSR local; ngân hàng tái dùng 24 câu đã kiểm. Chưa có video/GIF xuất riêng, Gemini hoặc nghiệm thu trực quan.'});
