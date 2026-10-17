import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {canDigMiner,digMiner,freshMiner,MINER_QUESTIONS,MINER_RECORD_KEY,moveMiner,nextMiner,pauseMiner,readMinerRecord,resolveMinerDig,resumeMiner,saveMinerRecord,startMiner,tickMiner,type MinerState} from '../src/native/chapters/MinerGameCore';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('D1713-MINER-'),file='src/native/chapters/MinerGame.tsx';
function until(state:MinerState,predicate:(s:MinerState)=>boolean){for(let i=0;i<200;i++){if(predicate(state))return state;state=tickMiner(state,.06);}throw Error('Không tới trạng thái dự kiến');}
const answerNumber=(answer:string)=>Number(answer.replace('−','-'));
test('Oracle độc lập của tám câu: thử nghiệm và tất cả lựa chọn, loại mẫu bằng không và nghiệm ngoại lai',()=>{
  const expected=[5,5,6,4,4,2,-2,4];
  const check=[(x:number)=>4*(x-1)-3===13,(x:number)=>(x+2)**2-x*x===24,(x:number)=>x!==4&&(x*x-16)/(x-4)===10,(x:number)=>(x-2)*(x+2)===x*x-5*x+16,(x:number)=>x>1&&2*(x-1)**2===18,(x:number)=>x>1&&Math.abs(1/(x-1)-1/(x+1)-2/3)<1e-12,(x:number)=>x<0&&Math.abs(2*x-3)===7,(x:number)=>2*x+1>=0&&Math.sqrt(2*x+1)===x-1];
  assert.equal(MINER_QUESTIONS.length,8);
  for(const [i,q]of MINER_QUESTIONS.entries()){
    assert.equal(answerNumber(q.answers[q.correct]),expected[i]);assert.equal(new Set(q.answers).size,3);
    assert.deepEqual(q.answers.map(answerNumber).filter(check[i]),[expected[i]]);assert.ok(q.steps.length>=3);assert.match(q.steps.at(-1)!,/Thử lại/);assert.ok(q.tip);
    // Phân tích thêm toàn miền nguyên nhỏ, không chỉ ba lựa chọn đã cho.
    assert.deepEqual(Array.from({length:41},(_,j)=>j-20).filter(check[i]),[expected[i]]);
  }
  assert.equal(check[2](4),false);assert.equal(check[5](1),false);assert.equal(check[7](0),false);
});
test('Nhân vật chuyển vị trí hữu hạn; chưa tới mỏ không đào được, va sai mất đúng một tim',()=>{
  const ready=freshMiner();assert.equal(moveMiner(ready,1),ready);assert.equal(digMiner(ready),ready);
  let s=until(startMiner(ready),s=>s.phase==='playing');assert.equal(s.intro>=3,true);
  s=moveMiner(s,-1);assert.equal(s.lane,0);assert.equal(s.x,.5);assert.equal(canDigMiner(s),false);assert.equal(digMiner(s),s);
  const moved=tickMiner(s,.06);assert.ok(moved.x<s.x&&moved.x>0);
  s=until(s,s=>s.x===0);assert.equal(canDigMiner(s),true);s=digMiner(s);assert.equal(moveMiner(s,1),s);
  s=until(s,s=>s.phase==='feedback');assert.equal(s.hearts,2);assert.equal(s.results.length,1);assert.equal(s.results[0].chosen,0);assert.equal(s.score,0);assert.equal(s.combo,0);
  assert.equal(tickMiner(s,20),s);assert.equal(resolveMinerDig(s),s);assert.equal(digMiner(s),s);
});
test('Tám tầng đúng kết thúc, combo/điểm/cuốc vàng đúng; ôn sai có hàng đợi hữu hạn',()=>{
  let s=startMiner(freshMiner(),true);
  for(const q of MINER_QUESTIONS){while(s.lane!==q.correct)s=moveMiner(s,s.lane<q.correct?1:-1,true);s=resolveMinerDig(digMiner(s));assert.equal(s.phase,'feedback');s=nextMiner(s);}
  assert.equal(s.phase,'finished');assert.equal(s.results.length,8);assert.ok(s.results.every(r=>r.correct));assert.equal(s.score,1240);assert.equal(s.hearts,3);assert.equal(s.combo,8);assert.equal(s.bestCombo,8);assert.equal(nextMiner(s),s);assert.equal(tickMiner(s,1),s);
  const queue=startMiner(freshMiner([2,2,-1,9,7]),true);assert.deepEqual(queue.queue,[2,7]);
  let wrong=startMiner(freshMiner(),true);for(let i=0;i<3;i++){const target=(MINER_QUESTIONS[i].correct+1)%3;while(wrong.lane!==target)wrong=moveMiner(wrong,wrong.lane<target?1:-1,true);wrong=nextMiner(resolveMinerDig(digMiner(wrong)));}
  assert.equal(wrong.phase,'finished');assert.equal(wrong.hearts,0);assert.equal(wrong.results.length,3);assert.equal(wrong.score,0);assert.equal(startMiner(freshMiner([])).phase,'finished');
});
test('Pause đóng băng intro/đào, delta lớn bị chặn và số không hữu hạn không làm nhảy tầng',()=>{
  let s=startMiner(freshMiner());const introPause=pauseMiner(s);assert.equal(tickMiner(introPause,100),introPause);assert.equal(resumeMiner(introPause).phase,'intro');
  s=startMiner(freshMiner(),true);s=digMiner(s);const paused=pauseMiner(s);assert.equal(tickMiner(paused,100),paused);assert.equal(resumeMiner(paused).dig,s.dig);
  for(const value of [Infinity,NaN,0,-1])assert.equal(tickMiner(s,value),s);
  assert.deepEqual(tickMiner(s,50000),tickMiner(s,.06));assert.equal(tickMiner(s,50000).results.length,0);
});
test('Lưu cục bộ chỉ kỷ lục và số tầng, dữ liệu hỏng/quota/storage bị chặn không làm lỗi',()=>{
  const store=new FakeStore(),state={...freshMiner(),phase:'finished' as const,score:100,results:[{question:0,chosen:1 as const,correct:true}]};
  assert.deepEqual(readMinerRecord(store),{best:0,completed:0});assert.equal(saveMinerRecord(store,state),true);assert.deepEqual(JSON.parse(store.getItem(MINER_RECORD_KEY)!),{best:100,completed:1});
  assert.equal(saveMinerRecord(store,{...state,score:0,results:[]}),true);assert.deepEqual(readMinerRecord(store),{best:100,completed:1});assert.equal(store.data.size,1);
  for(const bad of ['null','{}','[]','{"best":2000,"completed":9}','{"best":1.5,"completed":1}','{"best":100,"completed":-1}','not-json']){store.data.set(MINER_RECORD_KEY,bad);assert.deepEqual(readMinerRecord(store),{best:0,completed:0});}
  store.failGet=true;assert.deepEqual(readMinerRecord(store),{best:0,completed:0});store.failSet='quota';assert.equal(saveMinerRecord(store,state),false);assert.equal(saveMinerRecord(undefined,state),false);assert.equal(saveMinerRecord(store,freshMiner()),false);
});
function browser(reduced=false){
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame','AudioContext'] as const,previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>(),store=new FakeStore();let id=0,time=0;
  const doc={hidden:false,addEventListener:(key:string,fn:()=>void)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)};
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:store,matchMedia:()=>({matches:reduced})}});Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(n:number)=>void)=>{frames.set(++id,fn);return id;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(key:number)=>frames.delete(key)});
  return {doc,frames,listeners,store,step(m:any){const batch=[...frames.values()];frames.clear();time+=60;batch.forEach(fn=>fn(time));m.draw();},restore(){for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else delete(globalThis as any)[key];}}};
}
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
const key=(m:any,value:string)=>{m.tree.props.onKeyDown({key:value,preventDefault(){}});m.draw();};
test('Hook giảm chuyển động: phím/chạm, chống bấm đúp/callback cũ, lời giải, tổng kết và ôn riêng sai',()=>{
  const env=browser(true),m=mount(file);try{
    assert.equal(env.frames.size,0);assert.equal(button(m,'Âm thanh: tắt').props['aria-pressed'],false);const staleStart=button(m,'Vào hầm mỏ').props.onClick;
    m.click('Vào hầm mỏ');assert.equal(env.frames.size,0);key(m,'ArrowLeft');assert.match(text(m.tree),/Thợ mỏ ở mỏ 1\/3/);key(m,' ');assert.match(text(m.tree),/Cùng gỡ tầng này/);assert.match(text(m.tree),/4x = 20/);assert.equal(m.focused?.type,'div');
    const staleMine=button(m,'⛏ Đào khối đá').props.onClick,oldNext=button(m,'Xuống tầng tiếp theo').props.onClick;oldNext();oldNext();m.draw();assert.match(text(m.tree),/NHIỆM VỤ TẦNG 2/);staleMine();m.draw();assert.doesNotMatch(text(m.tree),/Cùng gỡ tầng này/);
    // Lấy vàng tầng 2 bằng điều khiển chạm, đúng mỏ bên phải.
    m.click('Phải →');m.click('Phải →');m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Đúng rồi!/);m.click('Xuống tầng tiếp theo');
    m.click('Tạm dừng đào mỏ');m.click('Kết thúc và xem lời giải');assert.match(text(m.tree),/Đúng 1\/2 tầng đã gặp/);assert.match(text(m.tree),/Các tầng chưa gặp không tính là sai/);
    m.click('Đào lại các tầng cần ôn');staleStart();m.draw();assert.match(text(m.tree),/NHIỆM VỤ TẦNG 1/);assert.doesNotMatch(text(m.tree),/NHIỆM VỤ TẦNG 2/);key(m,' ');assert.match(text(m.tree),/Đúng rồi!/);m.click('Xem tổng kết mỏ vàng');assert.match(text(m.tree),/Đúng 1\/1 tầng đã gặp/);
    assert.deepEqual(readMinerRecord(env.store),{best:100,completed:2});assert.equal(env.frames.size,0);
  }finally{m.unmount();assert.equal(env.listeners.size,0);env.restore();}
});
test('RAF chuyển động và đào thật, mất tim chỉ một lần, ẩn tab tự dừng và hủy callback sau unmount',()=>{
  const env=browser(),m=mount(file);try{
    m.click('Vào hầm mỏ');const introFrame=[...env.frames.values()][0];m.click('Bỏ qua mở đầu');introFrame(100000);m.draw();
    key(m,'ArrowLeft');assert.equal(button(m,'⛏ Đào khối đá').props.disabled,true);for(let i=0;i<8;i++)env.step(m);assert.equal(button(m,'⛏ Đào khối đá').props.disabled,false);
    m.click('⛏ Đào khối đá');assert.equal(button(m,'Phải →').props.disabled,true);for(let i=0;i<17;i++)env.step(m);assert.match(text(m.tree),/Cùng gỡ tầng này/);assert.match(text(m.tree),/−1 ♥/);assert.equal(env.frames.size,0);
    m.click('Xuống tầng tiếp theo');m.click('Phải →');env.step(m);env.doc.hidden=true;env.listeners.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Thợ mỏ đang nghỉ tay/);assert.equal(env.frames.size,0);
    env.doc.hidden=false;m.click('Tiếp tục đào mỏ');assert.equal(env.frames.size,1);const stale=[...env.frames.values()][0];m.unmount();assert.equal(env.frames.size,0);stale(100001);assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);
  }finally{m.unmount();env.restore();}
});
test('Bật giảm chuyển động khi đang pause intro: tiếp tục bỏ intro, không chờ RAF và đào được',()=>{
  const env=browser(),m=mount(file);try{
    m.click('Vào hầm mỏ');m.click('Tạm dừng đào mỏ');m.click('Giảm chuyển động: tắt');assert.match(text(m.tree),/Thợ mỏ đang nghỉ tay/);assert.equal(env.frames.size,0);
    m.click('Tiếp tục đào mỏ');assert.doesNotMatch(text(m.tree),/Bỏ qua mở đầu/);assert.equal(env.frames.size,0);assert.equal(button(m,'⛏ Đào khối đá').props.disabled,false);m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Đúng rồi!/);
  }finally{m.unmount();env.restore();}
});
test('Bật giảm chuyển động khi pause giữa nhát đào: resume chốt đúng một lần, không kẹt controls',()=>{
  const env=browser(),m=mount(file);try{
    m.click('Vào hầm mỏ');m.click('Bỏ qua mở đầu');m.click('⛏ Đào khối đá');assert.equal(button(m,'Phải →').props.disabled,true);m.click('Tạm dừng đào mỏ');m.click('Giảm chuyển động: tắt');
    const oldResume=button(m,'Tiếp tục đào mỏ').props.onClick;oldResume();oldResume();m.draw();assert.match(text(m.tree),/Đúng rồi!/);assert.equal(env.frames.size,0);assert.equal(all(m.tree,n=>n.props.className==='miner-feedback').length,1);
    assert.match(text(all(m.tree,n=>n.props.className==='miner-hud')[0]),/VÀNG100COMBO×1/);m.click('Xuống tầng tiếp theo');assert.equal(button(m,'Phải →').props.disabled,false);oldResume();m.draw();assert.match(text(m.tree),/NHIỆM VỤ TẦNG 2/);assert.doesNotMatch(text(m.tree),/Đúng rồi!/);
    key(m,'p');key(m,'p');assert.equal(button(m,'⛏ Đào khối đá').props.disabled,false);
  }finally{m.unmount();env.restore();}
});
test('Chơi lại từ tổng kết focus stage sau mount; callback cũ không lấy lại focus hoặc reset lượt',()=>{
  const env=browser(true),m=mount(file);try{
    m.click('Vào hầm mỏ');const stageNode=all(m.tree,n=>n.props.className?.startsWith?.('miner-stage'))[0],stageRef=Object.getOwnPropertyDescriptor(stageNode.props,'ref')?.value??stageNode.ref;
    m.click('Tạm dừng đào mỏ');m.click('Kết thúc và xem lời giải');assert.equal(m.focused?.type,'h3');stageRef.current=null;
    const oldRestart=button(m,'Đào lại 8 tầng').props.onClick;m.click('Đào lại 8 tầng');assert.equal(m.focused?.type,'div');assert.match(m.focused?.text??'',/MỎ 1/);
    m.click('⛏ Đào khối đá');assert.match(m.focused?.text??'',/Đúng rồi!/);const focused=m.focused;oldRestart();m.draw();assert.equal(m.focused,focused);assert.match(text(m.tree),/Đúng rồi!/);
  }finally{m.unmount();env.restore();}
});
test('Bỏ qua mở đầu trả focus về hầm mỏ sau khi nút biến mất; callback cũ không đổi lượt mới',()=>{
  const env=browser(),m=mount(file);try{
    m.click('Vào hầm mỏ');const skip=button(m,'Bỏ qua mở đầu').props.onClick,priorFocus=m.focused;
    m.click('Bỏ qua mở đầu');assert.equal(m.focused?.type,'div');assert.notEqual(m.focused,priorFocus);assert.match(m.focused?.text??'',/MỎ 1/);assert.equal(button(m,'Bỏ qua mở đầu'),undefined);
    const focused=m.focused;skip();m.draw();assert.equal(m.focused,focused);key(m,'ArrowLeft');assert.match(text(m.tree),/Thợ mỏ ở mỏ 1\/3/);
    m.click('Tạm dừng đào mỏ');m.click('Kết thúc và xem lời giải');m.click('Đào lại 8 tầng');const replayFocus=m.focused;
    skip();m.draw();assert.ok(button(m,'Bỏ qua mở đầu'));assert.equal(m.focused,replayFocus);
    m.click('Bỏ qua mở đầu');assert.equal(m.focused?.type,'div');assert.notEqual(m.focused,replayFocus);
  }finally{m.unmount();assert.equal(env.frames.size,0);env.restore();}
});
test('SSR tải lười, thương hiệu/không mạng/không dữ liệu HS, controls 44 px và giảm chuyển động',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/Thợ mỏ Toán/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/Vào hầm mỏ/);assert.match(html,/Âm thanh: tắt/);assert.doesNotMatch(html,/<main/);
  const launcher=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');assert.match(launcher,/lazy\(\(\)=>import\('\.\/MinerGame'\)\)/);assert.match(launcher,/<PracticeTool[^>]*label="Thợ mỏ Toán/);
  const source=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/native/chapters/MinerGameCore.ts'),'utf8');assert.doesNotMatch(source,/fetch\(|supabase|sendBeacon|setInterval|\u2014/);assert.match(source,/visibilitychange/);assert.match(source,/requestAnimationFrame/);assert.match(source,/cancelAnimationFrame/);
  const css=readFileSync(join(root,'src/native/chapters/MinerGame.css'),'utf8');assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);
});
let lateSound={created:0,closed:0,tones:0};
{
  const env=browser(true);let resolveResume:()=>void=()=>{};
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:class{state='suspended';constructor(){lateSound.created++;}resume(){return new Promise<void>(resolve=>{resolveResume=()=>{this.state='running';resolve();};});}close(){this.state='closed';lateSound.closed++;return Promise.resolve();}createOscillator(){lateSound.tones++;throw Error('Không phát sau unmount');}}});
  const m=mount(file);button(m,'Âm thanh: tắt').props.onClick();m.unmount();resolveResume();await Promise.resolve();await Promise.resolve();env.restore();
}
test('Âm thanh mặc định tắt; chỉ tạo sau thao tác, resume muộn không phát sau unmount',()=>assert.deepEqual(lateSound,{created:1,closed:1,tones:0}));
finish({note:'13 nhóm ca: oracle Toán độc lập, chuyển động/đào/va chạm, tim/điểm/combo/hữu hạn, pause/delta, lưu local lỗi, hook phím/chạm/review/stale, RAF/hide/unmount, chuyển reduced giữa pause intro/đào, focus restart và bỏ qua intro sau mount, SSR/lazy/accessibility và âm thanh async. Không thay QA trình duyệt.'});
