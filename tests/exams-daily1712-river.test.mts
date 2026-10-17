import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {beginRiver,freshRiver,moveRiver,pauseRiver,readRiverRecord,resumeRiver,riverRockLane,riverSpeed,RIVER_QUESTIONS,RIVER_RECORD_KEY,saveRiverRecord,tickRiver,type RiverState} from '../src/native/playground/riverCore';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';
const {test,finish}=suite('D1712-RIVER-');
const file='src/native/playground/RiverRace.tsx';
function until(state: RiverState, check: (state: RiverState)=>boolean, steer?: (state: RiverState)=>RiverState) {for(let n=0;n<10000;n++){if(check(state))return state;state=tickRiver(steer ? steer(state) : state,0.1);}throw Error('Vượt số tick dự kiến');}
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];

test('Oracle Toán riêng: nghiệm, điều kiện và đáp án duy nhất của cả 8 câu',()=>{
  const expected=['6','4','1','3','7','5','4','3'];
  assert.equal(RIVER_QUESTIONS.length,8);
  for(const [index,q] of RIVER_QUESTIONS.entries()){assert.equal(q.answers[q.correct],expected[index]);assert.equal(new Set(q.answers).size,3);assert.match(q.explanation,/[=⇔]/);assert.ok(q.tip);}
  const solutions=[6,4,-2,3,7,5,4,3];
  assert.equal(3*(solutions[0]-2)+4,16);
  assert.equal((solutions[1]+3)**2-solutions[1]**2,33);
  assert.equal((solutions[2]**2-9)/(solutions[2]-3),1);assert.notEqual(solutions[2],3);
  assert.equal((solutions[3]-2)*(solutions[3]+2),solutions[3]**2-3*solutions[3]+5);
  assert.deepEqual([-1,7].filter(x=>(x-3)**2===16),[-1,7]);
  assert.equal((solutions[5]**2-4)/(solutions[5]-2),7);assert.notEqual(solutions[5],2);
  assert.equal((solutions[6]+1)*(solutions[6]-1)-solutions[6]*(solutions[6]-3),11);
  assert.equal((solutions[7]-2)**2+(solutions[7]+2)**2,26);assert.ok(solutions[7]>0);
});
test('Va chạm chỉ xảy ra ở vạch, sai mất đúng 1 tim, feedback khóa lái',()=>{
  const ready=freshRiver();assert.equal(moveRiver(ready,-1),ready);
  let state=until(beginRiver(ready),s=>s.phase==='running');
  state={...state,lane:1,progress:0.999};state=tickRiver(state,0.1);
  assert.equal(state.wave,'feedback');assert.equal(state.hearts,2);assert.equal(state.results.length,1);assert.equal(state.results[0].correct,false);
  const locked=moveRiver(state,-1);assert.equal(locked,state);
  for(let n=0;n<5;n++)state=tickRiver(state,0.1);
  assert.equal(state.results.length,1);assert.equal(state.hearts,2);
  state=until(state,s=>s.wave==='rock');state={...state,lane:riverRockLane(state),progress:0.999};state=tickRiver(state,0.1);
  assert.equal(state.hearts,1);assert.equal(state.crashes,1);assert.equal(state.wave,'answer');assert.equal(state.cursor,1);
});
test('Chèo đúng đủ 8 cổng về bến hữu hạn, điểm/combo/tăng tốc đúng và né đá không mất tim',()=>{
  let state=until(beginRiver(freshRiver()),s=>s.phase==='running');
  state=until(state,s=>s.phase==='finished',s=>s.wave==='answer'?{...s,lane:RIVER_QUESTIONS[s.cursor].correct}:s.wave==='rock'?{...s,lane:((riverRockLane(s)+1)%3)as 0|1|2}:s);
  assert.equal(state.results.length,8);assert.ok(state.results.every(r=>r.correct));assert.equal(state.score,1240);assert.equal(state.bestCombo,8);assert.equal(state.hearts,3);assert.equal(state.crashes,0);assert.equal(riverSpeed(state),1.45);assert.ok(state.elapsed>100&&state.elapsed<190);
  assert.equal(tickRiver(state,100),state);assert.equal(moveRiver(state,1),state);
});
test('Pause, resume, giới hạn dt và hết tim không tạo câu trả lời hay điểm thừa',()=>{
  const intro=beginRiver(freshRiver());let paused=pauseRiver(intro);assert.equal(tickRiver(paused,1),paused);assert.equal(resumeRiver(paused).phase,'intro');
  let state=until(intro,s=>s.phase==='running');const pausedRun=pauseRiver(state);assert.equal(tickRiver(pausedRun,100),pausedRun);assert.equal(resumeRiver(pausedRun).phase,'running');
  assert.equal(tickRiver(state,Infinity),state);assert.equal(tickRiver(state,-1),state);assert.equal(tickRiver(state,100).elapsed,0.1);
  state=until(state,s=>s.phase==='finished',s=>s.wave==='answer'?{...s,lane:((RIVER_QUESTIONS[s.cursor].correct+1)%3)as 0|1|2}:s.wave==='rock'?{...s,lane:((riverRockLane(s)+1)%3)as 0|1|2}:s);
  assert.equal(state.hearts,0);assert.equal(state.results.length,3);assert.equal(state.score,0);assert.equal(state.bestCombo,0);
});
test('Kỷ lục local chỉ một số nguyên nhỏ; dữ liệu hỏng, storage bị chặn và quota không làm game lỗi',()=>{
  const store=new FakeStore();assert.equal(readRiverRecord(store),0);assert.equal(saveRiverRecord(store,1240),true);assert.equal(store.getItem(RIVER_RECORD_KEY),'1240');assert.equal(saveRiverRecord(store,100),true);assert.equal(readRiverRecord(store),1240);assert.equal(store.data.size,1);
  for(const value of ['{}','NaN','Infinity','-1','1.5','999999','1241','1281','"120"']){store.data.set(RIVER_RECORD_KEY,value);assert.equal(readRiverRecord(store),0,value);}
  for(const value of [-1,1.5,Infinity,NaN,1241,1281])assert.equal(saveRiverRecord(store,value),false);
  store.failGet=true;assert.equal(readRiverRecord(store),0);store.failSet='quota';assert.equal(saveRiverRecord(store,100),false);assert.equal(saveRiverRecord(undefined,100),false);
});

test('Hook UI thật: phím/chạm, auto pause khi ẩn tab, RAF dừng pause, stale start và ôn sai có guard',()=>{
  const old={window:(globalThis as any).window,document:(globalThis as any).document,raf:(globalThis as any).requestAnimationFrame,caf:(globalThis as any).cancelAnimationFrame};
  const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let id=0,time=0;
  (globalThis as any).window={localStorage:new FakeStore(),matchMedia:()=>({matches:false})};
  (globalThis as any).document={hidden:false,addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
  (globalThis as any).requestAnimationFrame=(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;};(globalThis as any).cancelAnimationFrame=(key:number)=>frames.delete(key);
  const m=mount(file,{onExit(){}});
  const step=()=>{const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();};
  const key=(key:string)=>{m.tree.props.onKeyDown({key,preventDefault(){}});m.draw();};
  try{
    assert.equal(frames.size,0);assert.equal(button(m,'♪ Âm thanh: tắt').props['aria-pressed'],false);
    const oldStart=button(m,'Bắt đầu đua thuyền').props.onClick;m.click('Bắt đầu đua thuyền');
    for(let n=0;n<33;n++)step();assert.match(text(m.tree),/Thuyền ở làn 2\/3/);
    key('ArrowLeft');assert.match(text(m.tree),/Thuyền ở làn 1\/3/);key('d');assert.match(text(m.tree),/Thuyền ở làn 2\/3/);
    const stage=all(m.tree,n=>n.props.className?.startsWith('river-stage'))[0],pointer={pointerId:1,button:0,isPrimary:true,target:{closest:()=>null},currentTarget:{setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}}};stage.props.onPointerDown({...pointer,clientX:100});stage.props.onPointerUp({...pointer,clientX:50});m.draw();assert.match(text(m.tree),/Thuyền ở làn 1\/3/);
    key('ArrowRight');oldStart();m.draw();assert.doesNotMatch(text(m.tree),/Nhìn câu hỏi, chọn làn, giữ tay lái!/);
    (globalThis as any).document.hidden=true;listeners.get('visibilitychange')!();m.draw();assert.match(text(m.tree),/Thuyền đang neo an toàn/);assert.equal(frames.size,0);m.click('Tiếp tục chèo');assert.equal(frames.size,1);
    // Sai câu 1 ở làn giữa, sai câu 2 ở làn trái, né đá ở làn trái, rồi dừng xem tổng kết.
    for(let n=0;n<190;n++)step();
    for(let n=0;n<40;n++){key('ArrowLeft');step();}
    for(let n=0;n<190;n++)step();
    key('p');if(button(m,'Kết thúc và xem lời giải'))m.click('Kết thúc và xem lời giải');
    assert.match(text(m.tree),/Cùng gỡ câu sai/);assert.ok(button(m,'Ôn câu 1'));assert.ok(button(m,'Ôn câu 2'));
    m.click('Ôn câu 1');const oldChoice=button(m,'6').props.onClick;m.click('Ôn câu 2');oldChoice();m.draw();assert.equal(button(m,'4').props.disabled,false);m.click('4');assert.match(text(m.tree),/Đúng rồi, em đã gỡ được câu này/);
    m.click('Chèo một lượt mới');oldStart();oldChoice();m.draw();assert.match(text(m.tree),/Nhìn câu hỏi, chọn làn, giữ tay lái!/);assert.doesNotMatch(text(m.tree),/Cùng gỡ câu sai/);
  }finally{m.unmount();assert.equal(frames.size,0);assert.equal(listeners.size,0);for(const [key,value]of Object.entries(old)){const target={window:'window',document:'document',raf:'requestAnimationFrame',caf:'cancelAnimationFrame'}[key]!;if(value===undefined)delete(globalThis as any)[target];else(globalThis as any)[target]=value;}}
});
test('Vuốt chỉ theo một con trỏ chính, không kéo nhầm qua ngón khác hoặc lần tạm dừng',()=>{
  const old={window:(globalThis as any).window,document:(globalThis as any).document,raf:(globalThis as any).requestAnimationFrame,caf:(globalThis as any).cancelAnimationFrame};
  const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let id=0,time=0;
  (globalThis as any).window={localStorage:new FakeStore(),matchMedia:()=>({matches:false})};
  (globalThis as any).document={hidden:false,addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
  (globalThis as any).requestAnimationFrame=(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;};(globalThis as any).cancelAnimationFrame=(key:number)=>frames.delete(key);
  const captured=new Set<number>(),released:number[]=[];
  const target={setPointerCapture:(pointerId:number)=>captured.add(pointerId),hasPointerCapture:(pointerId:number)=>captured.has(pointerId),releasePointerCapture:(pointerId:number)=>{captured.delete(pointerId);released.push(pointerId);}};
  const event=(pointerId:number,clientX:number,extra:any={})=>({pointerId,clientX,button:0,isPrimary:true,currentTarget:target,target:{closest:()=>null},...extra});
  const m=mount(file,{onExit(){}}),stage=()=>all(m.tree,n=>n.props.className?.startsWith('river-stage'))[0];
  const step=()=>{const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();};
  const lane=(n:number)=>assert.match(text(m.tree),new RegExp(`Thuyền ở làn ${n}/3`));
  try{
    m.click('Bắt đầu đua thuyền');for(let n=0;n<33;n++)step();lane(2);
    stage().props.onPointerDown(event(1,100));stage().props.onPointerDown(event(2,300,{isPrimary:false}));stage().props.onPointerUp(event(2,500,{isPrimary:false}));m.draw();lane(2);
    stage().props.onPointerUp(event(1,150));m.draw();lane(3);assert.ok(released.includes(1));
    stage().props.onPointerDown(event(3,300,{button:2}));stage().props.onPointerUp(event(3,100,{button:2}));m.draw();lane(3);
    stage().props.onPointerDown(event(4,300,{target:{closest:()=>({})}}));stage().props.onPointerUp(event(4,100));m.draw();lane(3);
    stage().props.onPointerDown(event(5,300));m.click('Ⅱ Tạm dừng');assert.ok(released.includes(5));m.click('Tiếp tục chèo');stage().props.onPointerUp(event(5,100));m.draw();lane(3);
    stage().props.onPointerDown(event(6,300));(globalThis as any).document.hidden=true;listeners.get('visibilitychange')!();m.draw();assert.ok(released.includes(6));(globalThis as any).document.hidden=false;m.click('Tiếp tục chèo');stage().props.onPointerUp(event(6,100));m.draw();lane(3);
    stage().props.onPointerDown(event(7,300));stage().props.onLostPointerCapture(event(7,300));stage().props.onPointerUp(event(7,100));m.draw();lane(3);
    stage().props.onPointerDown(event(8,300));stage().props.onPointerCancel(event(8,300));stage().props.onPointerUp(event(8,100));m.draw();lane(3);
    stage().props.onPointerDown(event(9,300));captured.delete(9);stage().props.onPointerLeave(event(9,300));stage().props.onPointerUp(event(9,100));m.draw();lane(3);
    stage().props.onPointerDown(event(10,300));m.click('Ⅱ Tạm dừng');m.click('Kết thúc và xem lời giải');m.click('Chèo một lượt mới');for(let n=0;n<33;n++)step();stage().props.onPointerUp(event(10,100));m.draw();lane(2);
    stage().props.onPointerDown(event(11,100));m.unmount();assert.equal(captured.size,0);
  }finally{m.unmount();for(const [key,value]of Object.entries(old)){const name={window:'window',document:'document',raf:'requestAnimationFrame',caf:'cancelAnimationFrame'}[key]!;if(value===undefined)delete(globalThis as any)[name];else(globalThis as any)[name]=value;}}
});
test('SSR, lazy chunk riêng, thương hiệu, giảm chuyển động, không mạng hoặc lộ dữ liệu',()=>{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default,{onExit(){}}));assert.match(html,/Đua thuyền Toán/);assert.match(html,/Âm thanh: tắt/);assert.match(html,/MTM sưu tầm và biên soạn/);assert.match(html,/Bắt đầu đua thuyền/);assert.doesNotMatch(html,/<main/);
  const launcher=readFileSync(join(root,'src/native/playground/Playground.tsx'),'utf8');assert.match(launcher,/lazy\(\(\) => import\('\.\/RiverRace'\)\)/);assert.doesNotMatch(launcher,/<main/);
  const source=[file,'src/native/playground/Playground.tsx','src/native/playground/riverCore.ts'].map(f=>readFileSync(join(root,f),'utf8')).join('\n');assert.doesNotMatch(source,/fetch\(|supabase|sendBeacon|\u2014|setInterval/);assert.match(source,/visibilitychange/);assert.match(source,/requestAnimationFrame/);assert.match(source,/cancelAnimationFrame/);
  const css=readFileSync(join(root,'src/native/playground/playground.css'),'utf8');assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/min-height:44px/);
});
test('Lỗi tải chunk có fallback riêng và retry tạo lazy identity mới thật',()=>{
  const m=mount('src/native/playground/Playground.tsx');try{
    m.click('Xuống sông chơi thử →');const prior=all(m.tree,n=>n.type?.name==='RiverBoundary')[0],priorView=prior.props.children.props.children.type;
    const boundary=new prior.type(prior.props);boundary.state=prior.type.getDerivedStateFromError();const failed=boundary.render();assert.equal(failed.props.role,'alert');assert.match(text(failed),/Game chưa tải được/);all(failed,n=>n.type==='button')[0].props.onClick();m.draw();
    const next=all(m.tree,n=>n.type?.name==='RiverBoundary')[0];assert.notEqual(next.key,prior.key);assert.notEqual(next.props.children.props.children.type,priorView);assert.doesNotMatch(text(m.tree),/GAME MỚI/);
  }finally{m.unmount();}
});
let lateSound={created:0,closed:0,tones:0};
{
  const previous={window:(globalThis as any).window,document:(globalThis as any).document,audio:(globalThis as any).AudioContext};let resolveResume:()=>void=()=>{};
  (globalThis as any).window={localStorage:new FakeStore(),matchMedia:()=>({matches:false})};(globalThis as any).document={hidden:false,addEventListener(){},removeEventListener(){}};
  (globalThis as any).AudioContext=class{state='suspended';constructor(){lateSound.created++;}resume(){return new Promise<void>(resolve=>{resolveResume=()=>{this.state='running';resolve();};});}close(){this.state='closed';lateSound.closed++;return Promise.resolve();}createOscillator(){lateSound.tones++;throw Error('Không được phát sau unmount');}};
  const m=mount(file,{onExit(){}});button(m,'♪ Âm thanh: tắt').props.onClick();m.unmount();resolveResume();await Promise.resolve();await Promise.resolve();
  for(const [key,value]of Object.entries(previous)){const target={window:'window',document:'document',audio:'AudioContext'}[key]!;if(value===undefined)delete(globalThis as any)[target];else(globalThis as any)[target]=value;}
}
test('Âm thanh chỉ tạo sau thao tác, resume trả muộn sau unmount không phát âm và context đã đóng',()=>{assert.deepEqual(lateSound,{created:1,closed:1,tones:0});});
finish({note:'10 nhóm ca: oracle Toán độc lập, core va chạm/lượt hữu hạn, lưu local lỗi, hook điều khiển/ẩn tab/RAF/stale, con trỏ chính và hủy vuốt, retry chunk, âm thanh async và SSR. Hook không thay QA trình duyệt.'});
