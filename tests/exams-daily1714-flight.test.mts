import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {studyGameQuestions,type StudyGrade} from '../src/native/playground/study-game-bank';
import {canFireFlight,finishFlight,fireFlight,FLIGHT_RECORD_KEY,freshFlight,moveFlight,nextFlight,pauseFlight,readFlightRecord,resolveFlightShot,resumeFlight,saveFlightRecord,skipFlightIntro,startFlight,tickFlight,type FlightState} from '../src/migration/flight-game-core';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('D1714-FLIGHT-'),file='src/migration/NotebookFlightGame.tsx';
const deck=studyGameQuestions(12,'g12-derivatives');
function until(state:FlightState,predicate:(s:FlightState)=>boolean,limit=1000){for(let i=0;i<limit;i++){if(predicate(state))return state;state=tickFlight(state,.06);}throw Error('Không tới trạng thái dự kiến');}
test('Chỉ lấy đúng khối và chương; 8 mục tiêu tăng mức, không câu THCS hoặc khối khác',()=>{
 for(const [grade,topic]of [[10,'g10-sets'],[11,'g11-trig'],[12,'g12-derivatives']] as const){const questions=studyGameQuestions(grade,topic);assert.equal(questions.length,8);assert.ok(questions.every(q=>q.grade===grade&&q.level>=2&&q.chapter));assert.ok(questions.every((q,i)=>i===0||q.level>=questions[i-1].level));assert.equal(freshFlight([...questions,...questions]).questions.length,8);for(const other of [10,11,12] as StudyGrade[])if(other!==grade)assert.deepEqual(studyGameQuestions(other,topic),[]);}
 assert.equal(startFlight(freshFlight()).phase,'finished');
});
test('Tàu di chuyển liên tục rồi mới bắn, tia chạm đúng thiên thạch mới chấm và chỉ mất một tim',()=>{
 let state=skipFlightIntro(startFlight(freshFlight(deck)));assert.equal(state.phase,'running');state=moveFlight(state,1);assert.equal(state.lane,2);assert.equal(state.x,1);assert.equal(canFireFlight(state),false);assert.equal(fireFlight(state),state);
 state=tickFlight(state,.06);assert.ok(state.x>1&&state.x<2);state=until(state,s=>s.x===2);state=fireFlight(state);assert.ok(state.bullet);assert.equal(state.results.length,0);assert.equal(moveFlight(state,-1),state);assert.equal(fireFlight(state),state);
 state=until(state,s=>s.phase==='feedback');assert.equal(state.results.length,1);assert.equal(state.results[0].chosen,2);assert.equal(state.hearts,2);assert.equal(state.score,0);assert.equal(tickFlight(state,20),state);assert.equal(resolveFlightShot(state),state);assert.equal(fireFlight(state),state);
});
test('Lượt hữu hạn: 8 câu đúng đạt 1240; ba lần sai hết tim; quá giờ là chưa bắn, không chấm câu chưa gặp',()=>{
 let state=startFlight(freshFlight(deck),true);for(const q of deck){while(state.lane!==q.correct)state=moveFlight(state,state.lane<q.correct?1:-1,true);state=nextFlight(resolveFlightShot(fireFlight(state)));}
 assert.equal(state.phase,'finished');assert.equal(state.results.length,8);assert.equal(state.score,1240);assert.equal(state.bestCombo,8);assert.equal(state.hearts,3);assert.equal(nextFlight(state),state);assert.equal(tickFlight(state,.06),state);
 state=startFlight(freshFlight(deck),true);for(let i=0;i<3;i++){const wrong=(deck[i].correct+1)%3;while(state.lane!==wrong)state=moveFlight(state,state.lane<wrong?1:-1,true);state=nextFlight(resolveFlightShot(fireFlight(state)));}assert.equal(state.phase,'finished');assert.equal(state.hearts,0);assert.equal(state.results.length,3);
 state=until(startFlight(freshFlight(deck),true),s=>s.phase==='feedback');assert.equal(state.results[0].chosen,null);assert.equal(state.hearts,2);assert.equal(state.results.length,1);
});
test('Pause đóng băng intro/tia bắn/đồng hồ; delta bất thường không làm nhảy câu; đổi giảm chuyển động khi pause không kẹt',()=>{
 let state=startFlight(freshFlight(deck));const intro=pauseFlight(state);assert.equal(tickFlight(intro,100),intro);assert.equal(resumeFlight(intro).phase,'intro');assert.equal(resumeFlight(intro,true).phase,'running');
 state=fireFlight(skipFlightIntro(state));const paused=pauseFlight(state);assert.equal(tickFlight(paused,100),paused);assert.deepEqual(resumeFlight(paused).bullet,state.bullet);assert.equal(resumeFlight(paused,true).phase,'feedback');assert.equal(resumeFlight(paused,true).results.length,1);
 for(const delta of [NaN,Infinity,0,-1])assert.equal(tickFlight(state,delta),state);assert.deepEqual(tickFlight(state,10000),tickFlight(state,.06));assert.equal(finishFlight(state),state);assert.equal(finishFlight(paused).results.length,0);
});
test('Kỷ lục cục bộ tách khối, chỉ lưu điểm hợp lệ; dữ liệu hỏng/quota không làm lỗi',()=>{
 const store=new FakeStore();const state={...freshFlight(deck),phase:'finished' as const,score:100};assert.equal(saveFlightRecord(store,12,state),true);assert.equal(readFlightRecord(store,12),100);assert.equal(readFlightRecord(store,10),0);assert.equal(saveFlightRecord(store,12,{...state,score:0}),true);assert.equal(readFlightRecord(store,12),100);assert.equal(store.data.size,1);
 for(const bad of ['-1','1.5','1241','{}','null','NaN']){store.data.set(`${FLIGHT_RECORD_KEY}:12`,bad);assert.equal(readFlightRecord(store,12),0);}store.failGet=true;assert.equal(readFlightRecord(store,12),0);store.failSet='quota';assert.equal(saveFlightRecord(store,12,state),false);assert.equal(saveFlightRecord(undefined,12,state),false);assert.equal(saveFlightRecord(store,12,freshFlight(deck)),false);
});
function browser(reduced=false){
 const names=['window','document','requestAnimationFrame','cancelAnimationFrame','AudioContext'] as const,previous=Object.fromEntries(names.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>(),store=new FakeStore();let id=0,time=0;const doc={hidden:false,addEventListener:(key:string,fn:()=>void)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:store,matchMedia:()=>({matches:reduced})}});Object.defineProperty(globalThis,'document',{configurable:true,value:doc});Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(value:number)=>frames.delete(value)});
 return {doc,store,frames,listeners,step(m:any){const callbacks=[...frames.values()];frames.clear();time+=60;callbacks.forEach(fn=>fn(time));m.draw();},restore(){for(const name of names){if(previous[name])Object.defineProperty(globalThis,name,previous[name]!);else delete(globalThis as any)[name];}}};
}
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
function selectGrade(m:any,grade='12'){const select=all(m.tree,n=>n.type==='select')[0];select.props.onChange({target:{value:grade}});m.draw();}
function confirm(m:any){all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();}
function key(m:any,value:string,tagName='DIV'){m.tree.props.onKeyDown({key:value,target:{tagName},preventDefault(){}});m.draw();}
test('Đổi khối vô hiệu callback Cất cánh và xác nhận cũ, không thể chơi deck của khối trước',()=>{
 const env=browser(true),m=mount(file);try{
  selectGrade(m,'12');confirm(m);const oldBegin=button(m,'Cất cánh').props.onClick,oldConfirm=all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0].props.onChange;
  selectGrade(m,'10');oldConfirm({target:{checked:true}});oldBegin();m.draw();assert.ok(button(m,'Cất cánh'));assert.equal(button(m,'Cất cánh').props.disabled,true);assert.match(text(m.tree),/Mệnh đề và tập hợp/);assert.doesNotMatch(text(m.tree),/Đạo hàm: đơn điệu/);
  confirm(m);m.click('Cất cánh');assert.match(text(m.tree),/A = \[−2; 3\)/);assert.doesNotMatch(text(m.tree),/x³ − 3x²/);assert.match(text(m.tree),/KHỐI 10/);
 }finally{m.unmount();env.restore();}
});
test('Hook: chọn khối/xác nhận bắt buộc, phím và chạm, chặn callback cũ, tổng kết lời giải và focus sau replay',()=>{
 const env=browser(true),m=mount(file);try{
  assert.equal(button(m,'Cất cánh').props.disabled,true);assert.equal(env.frames.size,0);selectGrade(m);assert.match(text(m.tree),/Đạo hàm/);assert.equal(button(m,'Cất cánh').props.disabled,true);confirm(m);const staleStart=button(m,'Cất cánh').props.onClick;m.click('Cất cánh');assert.equal(m.focused?.type,'div');assert.equal(env.frames.size,0);
  key(m,'ArrowLeft');assert.match(text(m.tree),/Tàu ở làn 1\/3/);key(m,' ');assert.match(text(m.tree),/Trúng mục tiêu!/);assert.equal(m.focused?.type,'h4');const staleNext=button(m,'Thiên thạch tiếp theo').props.onClick;staleNext();staleNext();m.draw();assert.match(text(m.tree),/Giá trị cực đại|Giá trị cực đại|Giá trị cực|cực đại bằng/);assert.equal(text(all(m.tree,n=>n.props.className==='flight-hud')[0]).includes('CÂU2/8'),true);
  staleStart();m.draw();assert.equal(text(all(m.tree,n=>n.props.className==='flight-hud')[0]).includes('CÂU2/8'),true);key(m,'ArrowRight','SELECT');assert.match(text(m.tree),/Tàu ở làn 1\/3/);m.click('Phải →');m.click('Bắn mục tiêu');assert.match(text(m.tree),/Trúng mục tiêu!/);m.click('Thiên thạch tiếp theo');key(m,'p');assert.match(text(m.tree),/Phi thuyền đang neo an toàn/);m.click('Kết thúc và xem lời giải');assert.match(text(m.tree),/Đúng 2\/2 câu đã gặp/);assert.match(text(m.tree),/Lời giải các câu đã gặp/);assert.match(text(m.tree),/f′\(x\)/);assert.equal(m.focused?.type,'h4');
  const oldReplay=button(m,'Bay lại 8 thiên thạch').props.onClick;m.click('Bay lại 8 thiên thạch');assert.equal(m.focused?.type,'div');key(m,' ');assert.match(text(m.tree),/Cùng gỡ thiên thạch này/);oldReplay();staleNext();m.draw();assert.match(text(m.tree),/Cùng gỡ thiên thạch này/);assert.equal(text(all(m.tree,n=>n.props.className==='flight-hud')[0]).includes('CÂU1/8'),true);
 }finally{m.unmount();assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);env.restore();}
});
test('Phím tắt trình duyệt và IME không lái tàu, bắn, tạm dừng hoặc bị chặn mặc định',()=>{
 const env=browser(true),m=mount(file);try{
  selectGrade(m);confirm(m);m.click('Cất cánh');const before=text(m.tree);
  for(const event of [{key:'a',ctrlKey:true},{key:'d',ctrlKey:true},{key:'ArrowLeft',altKey:true},{key:'ArrowRight',metaKey:true},{key:' ',ctrlKey:true},{key:'p',altKey:true},...['a','d',' ','p'].map(key=>({key,nativeEvent:{isComposing:true}}))]){
   let prevented=0;m.tree.props.onKeyDown({...event,target:{tagName:'DIV'},preventDefault(){prevented++;}});m.draw();assert.equal(prevented,0,`Không chặn phím ${JSON.stringify(event)}`);assert.equal(text(m.tree),before,`Không điều khiển game bằng ${JSON.stringify(event)}`);
  }
  key(m,'ArrowLeft');assert.match(text(m.tree),/Tàu ở làn 1\/3/);key(m,' ');assert.match(text(m.tree),/Trúng mục tiêu!/);
 }finally{m.unmount();env.restore();}
});
test('RAF thật: chuyển làn/tia bắn, ẩn tab tự pause, tiếp tục không nhảy giờ và hủy frame sau unmount',()=>{
 const env=browser(),m=mount(file);try{
  selectGrade(m);confirm(m);m.click('Cất cánh');assert.equal(env.frames.size,1);m.click('Bỏ qua mở đầu');assert.equal(m.focused?.type,'div');key(m,'ArrowLeft');assert.equal(button(m,'Bắn mục tiêu').props.disabled,true);for(let i=0;i<5;i++)env.step(m);assert.equal(button(m,'Bắn mục tiêu').props.disabled,false);m.click('Bắn mục tiêu');assert.ok(all(m.tree,n=>n.props.className==='flight-laser').length);const before=text(all(m.tree,n=>n.props.className==='flight-question')[0]);
  env.doc.hidden=true;env.listeners.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Phi thuyền đang neo an toàn/);assert.equal(env.frames.size,0);const staleResume=button(m,'Tiếp tục bay').props.onClick;staleResume();m.draw();assert.match(text(m.tree),/Phi thuyền đang neo an toàn/);env.doc.hidden=false;m.click('Tiếp tục bay');assert.equal(text(all(m.tree,n=>n.props.className==='flight-question')[0]),before);for(let i=0;i<12;i++)env.step(m);assert.match(text(m.tree),/Trúng mục tiêu!/);assert.equal(env.frames.size,0);assert.equal(text(all(m.tree,n=>n.props.className==='flight-hud')[0]).includes('TIM♥♥♥'),true);
  m.click('Thiên thạch tiếp theo');const stale=[...env.frames.values()][0];m.unmount();assert.equal(env.frames.size,0);stale(999999);assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);
 }finally{m.unmount();env.restore();}
});
test('Bật giảm chuyển động khi pause intro/tia bắn không kẹt, resume chốt đúng một lần',()=>{
 const env=browser(),m=mount(file);try{selectGrade(m);confirm(m);m.click('Cất cánh');m.click('Tạm dừng phi thuyền');m.click('Giảm chuyển động: tắt');m.click('Tiếp tục bay');assert.equal(env.frames.size,0);assert.equal(button(m,'Bỏ qua mở đầu'),undefined);m.click('Giảm chuyển động: bật');m.click('Bắn mục tiêu');m.click('Tạm dừng phi thuyền');m.click('Giảm chuyển động: tắt');const resume=button(m,'Tiếp tục bay').props.onClick;resume();resume();m.draw();assert.match(text(m.tree),/Cùng gỡ thiên thạch này/);assert.equal(env.frames.size,0);assert.equal(text(all(m.tree,n=>n.props.className==='flight-hud')[0]).includes('TIM♥♥'),true);}finally{m.unmount();env.restore();}
});
test('SSR/lazy contract: không thư viện mới/mạng/dữ liệu HS, navy vàng, nút44px và giảm chuyển động',()=>{
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/Chọn đúng khối/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/Âm thanh: tắt/);assert.doesNotMatch(html,/<main/);
 const launcher=readFileSync(join(root,'src/migration/NotebookFlightLauncher.tsx'),'utf8');assert.match(launcher,/lazy\(\(\)=>import\('\.\/NotebookFlightGame'\)\)/);assert.match(readFileSync(join(root,'src/migration/Notebook.tsx'),'utf8'),/<NotebookFlightLauncher\/>/);
 const source=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/migration/flight-game-core.ts'),'utf8');assert.doesNotMatch(source,/fetch\(|supabase|sendBeacon|setInterval|\u2014/);assert.match(source,/visibilitychange/);assert.match(source,/cancelAnimationFrame/);const css=readFileSync(join(root,'src/migration/notebook-flight.css'),'utf8');for(const value of ['#213269','#FFCF24','min-height:44px',':focus-visible','prefers-reduced-motion'])assert.ok(css.includes(value));
});
finish({note:'Core và hook/SSR local; không thay thế trình duyệt thật hoặc nghiệm thu thẩm mỹ.'});
