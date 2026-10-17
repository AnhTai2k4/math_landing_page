import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {digMiner,freshMiner,minerChapter,minerRecordKey,MINER_RECORD_KEY,MINER_VERSION,moveMiner,nextMiner,readMinerRecord,resolveMinerDig,saveMinerRecord,startMiner,type MinerLane,type MinerState} from '../src/native/chapters/MinerGameCore';
import {all,load,mount,root,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('D1715-MINER-V2-'),file='src/native/chapters/MinerGame.tsx';
const answer=(state:MinerState,lane:MinerLane)=>{while(state.lane!==lane)state=moveMiner(state,state.lane<lane?1:-1,true);return resolveMinerDig(digMiner(state));};
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
const checkbox=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[0];
function browser(reduced=true){
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame'] as const,prior=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const store=new FakeStore(),frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let sequence=0,time=0;
  const doc={hidden:false,addEventListener:(key:string,fn:()=>void)=>listeners.set(key,fn),removeEventListener:(key:string)=>listeners.delete(key)};
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:store,matchMedia:()=>({matches:reduced})}});Object.defineProperty(globalThis,'document',{configurable:true,value:doc});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(n:number)=>void)=>{frames.set(++sequence,fn);return sequence;}});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(key:number)=>frames.delete(key)});
  return {store,frames,listeners,doc,step(m:any){const batch=[...frames.values()];frames.clear();time+=60;batch.forEach(fn=>fn(time));m.draw();},restore(){for(const key of keys){if(prior[key])Object.defineProperty(globalThis,key,prior[key]!);else delete(globalThis as any)[key];}}};
}
function confirm(m:any){checkbox(m).props.onChange({target:{checked:true}});m.draw();}
const end=(m:any)=>{m.click('Tạm dừng đào mỏ');m.click('Kết thúc và xem lời giải');m.draw();};

test('V2 dùng đúng 24 câu THPT theo khối/chương, không đưa bộ nền THCS vào route và không bù chương thiếu',()=>{
  assert.equal(MINER_VERSION,'2.0');
  for(const track of ['10','11','12']){
    const scope=minerChapter(track,'1')!;assert.equal(scope.questions.length,8);assert.equal(scope.grade,Number(track));let level=2;
    for(const q of scope.questions){assert.equal(q.grade,scope.grade);assert.equal(q.chapter,scope.chapter);assert.ok(q.lesson&&q.type&&q.tip&&q.steps.length);assert.ok(q.level!>=level);level=q.level!;assert.ok(q.level!>=2);assert.ok(!q.id.startsWith('miner-'));}
    assert.equal(minerChapter(track,'2'),null);assert.equal(minerChapter(track,'999'),null);
  }
  for(const track of ['9','13','HSA','TSA',''])assert.equal(minerChapter(track,'1'),null);
  const launcher=readFileSync(join(root,'src/native/chapters/PracticeLibrary.tsx'),'utf8');assert.match(launcher,/<MinerGame track=\{selected.id\} chapter=\{chapter.id\}/);
});

test('Tập đào sai cả 8 tầng vẫn giữ tim và hữu hạn; Tiêu chuẩn giữ luật dừng sau 3 sai; đúng vẫn có combo',()=>{
  for(const track of ['10','11','12']){
    const scope=minerChapter(track,'1')!;
    for(const mode of ['standard','practice'] as const){
      let state=startMiner(freshMiner(undefined,mode,scope.questions,scope.id),true);
      for(let i=0;i<8&&state.phase!=='finished';i++){state=answer(state,((scope.questions[state.queue[state.cursor]].correct+1)%3)as MinerLane);assert.equal(state.results.length,i+1);assert.equal(resolveMinerDig(state),state);state=nextMiner(state);}
      assert.equal(state.phase,'finished');assert.equal(state.results.length,mode==='practice'?8:3);assert.equal(state.hearts,mode==='practice'?3:0);assert.equal(state.score,0);assert.equal(nextMiner(state),state);
    }
    let perfect=startMiner(freshMiner(undefined,'practice',scope.questions,scope.id),true);
    for(const q of scope.questions)perfect=nextMiner(answer(perfect,q.correct));
    assert.equal(perfect.score,1240);assert.equal(perfect.bestCombo,8);assert.equal(perfect.hearts,3);assert.equal(perfect.phase,'finished');
  }
});

test('Kỷ lục Tập đào tách Tiêu chuẩn, từng chương và legacy; từ chối scope sai, quota hoặc storage deny',()=>{
  const store=new FakeStore(),scope=minerChapter('10','1')!;
  store.setItem(MINER_RECORD_KEY,JSON.stringify({best:900,completed:8}));
  let practice=startMiner(freshMiner(undefined,'practice',scope.questions,scope.id),true);practice=nextMiner(answer(practice,scope.questions[0].correct));practice={...practice,phase:'finished'};
  assert.equal(saveMinerRecord(store,practice),true);assert.deepEqual(readMinerRecord(store,'practice',scope.id),{best:100,completed:1});assert.deepEqual(readMinerRecord(store,'standard',scope.id),{best:0,completed:0});assert.deepEqual(readMinerRecord(store),{best:900,completed:8});assert.deepEqual(readMinerRecord(store,'practice','g11-trig'),{best:0,completed:0});
  const record=JSON.parse(store.getItem(minerRecordKey('practice',scope.id)!)!);assert.deepEqual(Object.keys(record),['best','completed']);assert.equal(store.data.size,2);
  assert.equal(minerRecordKey('practice','../wrong'),null);assert.equal(saveMinerRecord(store,{...practice,scope:'not-a-chapter'}),false);assert.deepEqual(readMinerRecord(store,'practice','not-a-chapter'),{best:0,completed:0});
  store.setItem(minerRecordKey('practice',scope.id)!,'{"best":99999,"completed":80}');assert.deepEqual(readMinerRecord(store,'practice',scope.id),{best:0,completed:0});store.failSet='quota';assert.equal(saveMinerRecord(store,practice),false);store.failGet=true;assert.deepEqual(readMinerRecord(store,'practice',scope.id),{best:0,completed:0});assert.equal(saveMinerRecord(undefined,practice),false);
});

test('UI chọn mode và xác nhận bài đã học; callback cũ không bỏ khóa, reset hay đổi mode giữa lượt',()=>{
  const env=browser(),m=mount(file,{track:'10',chapter:'1'});try{
    assert.equal(m.tree.props['data-version'],'2.0');assert.equal(button(m,'Vào hầm mỏ').props.disabled,true);m.click('Vào hầm mỏ');assert.match(text(m.tree),/Xác nhận bài đã học/);
    const staleConfirm=checkbox(m).props.onChange,staleStart=button(m,'Vào hầm mỏ').props.onClick;
    m.click('Tập đào · không mất tim');staleConfirm({target:{checked:true}});staleStart();m.draw();assert.equal(checkbox(m).props.checked,false);assert.equal(button(m,'Vào hầm mỏ').props.disabled,true);
    confirm(m);const staleStandard=button(m,'Tiêu chuẩn · 3 tim').props.onClick;m.click('Vào hầm mỏ');assert.equal(m.focused?.type,'div');staleStandard();m.draw();assert.match(text(m.tree),/TẬP ĐÀO∞/);
    m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Cùng gỡ tầng này/);assert.match(text(m.tree),/Tập đào giữ nguyên tim/);assert.doesNotMatch(text(m.tree),/−1 ♥/);assert.equal(m.focused?.type,'div');
    const oldNext=button(m,'Xuống tầng tiếp theo').props.onClick;oldNext();oldNext();m.draw();assert.match(text(m.tree),/NHIỆM VỤ TẦNG 2/);assert.equal(all(m.tree,n=>n.props.className==='miner-feedback').length,0);assert.equal(env.frames.size,0);
  }finally{m.unmount();assert.equal(env.listeners.size,0);env.restore();}
});

test('Ôn tầng sai tự chuyển Tập đào, giữ đúng câu sai đã gặp, không đưa tầng chưa gặp và không sửa record Tiêu chuẩn',()=>{
  const env=browser(),m=mount(file,{track:'10',chapter:'1'});try{
    confirm(m);m.click('Vào hầm mỏ');m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Cùng gỡ tầng này/);m.click('Xuống tầng tiếp theo');m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Đúng rồi!/);m.click('Xuống tầng tiếp theo');end(m);
    assert.match(text(m.tree),/Đúng 1\/2 tầng đã gặp/);assert.deepEqual(readMinerRecord(env.store,'standard','g10-sets'),{best:100,completed:2});
    const staleReplay=button(m,'Đào lại 8 tầng').props.onClick;m.click('Đào lại các tầng cần ôn');staleReplay();m.draw();assert.match(text(m.tree),/TẬP ĐÀO∞/);assert.match(text(m.tree),/NHIỆM VỤ TẦNG 1/);assert.match(text(m.tree),/TẦNG1\/1/);assert.doesNotMatch(text(m.tree),/NHIỆM VỤ TẦNG 3/);
    m.click('⛏ Đào khối đá');assert.match(text(m.tree),/Tập đào giữ nguyên tim/);m.click('Xem tổng kết mỏ vàng');m.draw();assert.match(text(m.tree),/Đúng 0\/1 tầng đã gặp/);assert.deepEqual(readMinerRecord(env.store,'standard','g10-sets'),{best:100,completed:2});assert.deepEqual(readMinerRecord(env.store,'practice','g10-sets'),{best:0,completed:1});
  }finally{m.unmount();env.restore();}
});

test('Đổi khối/chương bỏ xác nhận và câu cũ; callbacks của khối cũ không mở lượt hoặc đổi xác nhận khối mới',()=>{
  const env=browser(),m=mount(file,{track:'10',chapter:'1'});try{
    confirm(m);const oldConfirm=checkbox(m).props.onChange,oldStart=button(m,'Vào hầm mỏ').props.onClick;
    m.draw({track:'12',chapter:'1'});m.draw();assert.match(text(m.tree),/TOÁN 12/);assert.match(text(m.tree),/x³ − 3x²/);assert.doesNotMatch(text(m.tree),/A = \[−2/);assert.equal(checkbox(m).props.checked,false);oldConfirm({target:{checked:true}});oldStart();m.draw();assert.equal(checkbox(m).props.checked,false);assert.equal(button(m,'Vào hầm mỏ').props.disabled,true);
    m.draw({track:'12',chapter:'2'});m.draw();assert.match(text(m.tree),/Chương đang chọn chưa có bộ câu/);assert.equal(all(m.tree,n=>n.type==='button').length,0);assert.doesNotMatch(text(m.tree),/x³|LỚP 9|4\(x/);
  }finally{m.unmount();env.restore();}
});

test('Phím chơi giữ hành vi mặc định của control và IME; hướng dẫn luôn hiện, stage liên kết và focus trả đúng chỗ',()=>{
  const env=browser(),m=mount(file,{track:'11',chapter:'1'});try{
    const hint=all(m.tree,n=>n.props.className==='miner-keyboard-hint')[0],guide=all(m.tree,n=>n.props.className==='miner-answer-guide')[0],stage=all(m.tree,n=>String(n.props.className).startsWith('miner-stage'))[0];assert.ok(hint.props.id);assert.equal(stage.props['aria-describedby'],hint.props.id+' '+guide.props.id);assert.match(text(hint),/P tạm dừng/);assert.equal(all(guide,n=>n.type==='li').length,3);assert.equal(all(guide,n=>n.type==='button'||n.props.onClick).length,0);assert.match(text(guide),/−4\/5/);
    confirm(m);m.click('Vào hầm mỏ');const before=text(m.tree);
    for(const target of ['INPUT','SELECT','BUTTON','TEXTAREA','A','SUMMARY'])for(const key of ['ArrowLeft','ArrowRight',' ','p']){let prevented=false;m.tree.props.onKeyDown({key,target:{tagName:target},preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,false);assert.equal(text(m.tree),before);}
    let prevented=false;m.tree.props.onKeyDown({key:'a',nativeEvent:{isComposing:true},preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,false);assert.equal(text(m.tree),before);
    for(const target of [{tagName:'SPAN',closest:()=>({tagName:'SUMMARY'})},{tagName:'DIV',isContentEditable:true}]){m.tree.props.onKeyDown({key:' ',target,preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,false);assert.equal(text(m.tree),before);}
    m.tree.props.onKeyDown({key:'ArrowLeft',preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,true);assert.match(text(m.tree),/Thợ mỏ ở mỏ 1\/3/);m.click('⛏ Đào khối đá');assert.match(m.focused?.text??'',/Đúng rồi!/);m.click('Xuống tầng tiếp theo');assert.equal(m.focused?.type,'div');assert.match(m.focused?.text??'',/MỎ 1/);
  }finally{m.unmount();env.restore();}
});

test('Giữ phím chơi trên stage chặn cuộn trang nhưng không lặp thao tác hoặc chiếm phím của control',()=>{
  const env=browser(),m=mount(file,{track:'11',chapter:'1'});try{
    confirm(m);m.click('Vào hầm mỏ');const before=text(m.tree);
    for(const key of ['ArrowLeft','ArrowRight','ArrowDown','a','d',' ','p']){
      let prevented=false;m.tree.props.onKeyDown({key,repeat:true,target:{tagName:'DIV'},preventDefault(){prevented=true;}});m.draw();
      assert.equal(prevented,true,'Giữ phím '+JSON.stringify(key)+' phải chặn hành vi mặc định');assert.equal(text(m.tree),before,'Phím lặp không được đổi lượt');
    }
    for(const target of [{tagName:'BUTTON'},{tagName:'SPAN',closest:()=>({tagName:'SUMMARY'})},{tagName:'DIV',isContentEditable:true}]){
      let prevented=false;m.tree.props.onKeyDown({key:' ',repeat:true,target,preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,false);assert.equal(text(m.tree),before);
    }
    for(const event of [{key:'Tab',repeat:true},{key:'ArrowDown',repeat:true,nativeEvent:{isComposing:true}},{key:'ArrowDown',repeat:true,ctrlKey:true}]){
      let prevented=false;m.tree.props.onKeyDown({...event,target:{tagName:'DIV'},preventDefault(){prevented=true;}});m.draw();assert.equal(prevented,false);assert.equal(text(m.tree),before);
    }
  }finally{m.unmount();env.restore();}
});

test('RAF Tập đào giải sai một lần vẫn giữ tim, ẩn tab dừng và callback sau unmount không chạy lại',()=>{
  const env=browser(false),m=mount(file,{track:'10',chapter:'1'});try{
    m.click('Tập đào · không mất tim');confirm(m);m.click('Vào hầm mỏ');m.click('Bỏ qua mở đầu');m.click('⛏ Đào khối đá');for(let i=0;i<19;i++)env.step(m);
    assert.match(text(m.tree),/GIỮ TIM · CÙNG GỠ NHÉ/);assert.match(text(m.tree),/TẬP ĐÀO∞/);assert.equal(env.frames.size,0);m.click('Xuống tầng tiếp theo');env.doc.hidden=true;env.listeners.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Thợ mỏ đang nghỉ tay/);assert.equal(env.frames.size,0);m.click('Tiếp tục đào mỏ');const stale=[...env.frames.values()][0];m.unmount();stale(500000);assert.equal(env.frames.size,0);assert.equal(env.listeners.size,0);
  }finally{m.unmount();env.restore();}
});

test('Đáp án dài xuống dòng trong khối đá; giữ CSS navy/vàng, 44 px, giảm chuyển động, không mạng/dependency mới',()=>{
  const {minerAnswerLines}=load(file);
  for(const grade of ['10','11','12'])for(const q of minerChapter(grade,'1')!.questions)for(const answer of q.answers){const lines=minerAnswerLines(answer);assert.equal(lines.join(' '),answer);assert.ok(lines.length<=3);assert.ok(lines.every((line:string)=>line.length<=14));}
  const source=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/native/chapters/MinerGameCore.ts'),'utf8');assert.doesNotMatch(source,/fetch\(|sendBeacon|supabase|\u2014/);assert.match(source,/aria-pressed=\{practice\}/);assert.match(source,/aria-describedby/);
  const css=readFileSync(join(root,'src/native/chapters/MinerGame.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.miner-answer-guide strong\{font-size:16px/);assert.match(css,/@media\(max-width:500px\)\{\.miner-answer-guide\{grid-template-columns:1fr/);
});
finish({note:'10 nhóm ca engine/hook UI: đúng khối/chương, mode/record tách, stale callbacks, ôn sai hữu hạn, confirm reset, phím/IME/focus, giữ phím không cuộn trang, RAF/pause/unmount và đáp án trong khối đá. Bộ 24 câu tái dùng oracle độc lập của daily1714-river-v3; chưa thay QA trình duyệt.'});
