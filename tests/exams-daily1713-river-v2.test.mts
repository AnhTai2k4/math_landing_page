import assert from 'node:assert/strict';
import {beginRiver,freshRiver,pauseRiver,readRiverRecord,resumeRiver,riverSpeed,riverWaveDuration,RIVER_PRACTICE_RECORD_KEY,RIVER_RECORD_KEY,RIVER_QUESTIONS,RIVER_VERSION,saveRiverRecord,tickRiver,type Lane,type RiverState} from '../src/native/playground/riverCore';
import {all,mount,text} from './daily19-ui-harness.mts';
import {FakeStore,suite} from './exams-harness.mts';

const {test,finish}=suite('D1713-RIVER-V2-');
const file='src/native/playground/RiverRace.tsx';
const button=(m:any,label:string)=>all(m.tree,n=>n.type==='button'&&text(n)===label)[0];
const advance=(initial:RiverState,ticks:number)=>{let state=initial;for(let n=0;n<ticks;n++)state=tickRiver(state,0.1);return state;};
const running=(mode:'standard'|'practice')=>({...freshRiver(mode),phase:'running' as const,introTime:3});

test('Oracle thời gian: chuẩn giữ 18 giây, tập chèo 360/13 giây mỗi câu và không tăng theo điểm',()=>{
  assert.equal(RIVER_VERSION,'v2');
  const standard=running('standard'),practice=running('practice');
  assert.equal(riverSpeed(standard),1);assert.equal(riverSpeed({...standard,score:1240}),1.45);
  assert.equal(riverSpeed(practice),0.65);assert.equal(riverSpeed({...practice,score:1240}),0.65);
  assert.equal(riverWaveDuration(standard),18);assert.ok(Math.abs(riverWaveDuration(practice)-360/13)<1e-12);
  assert.ok(Math.abs(advance(standard,100).progress-5/9)<1e-12);
  assert.ok(Math.abs(advance(practice,100).progress-13/36)<1e-12);
  assert.equal(advance(practice,276).results.length,0);
  const passed=advance({...practice,lane:0},277);assert.equal(passed.results.length,1);assert.equal(passed.score,100);assert.equal(passed.hearts,3);assert.equal(passed.wave,'feedback');
  assert.match(passed.feedback,/Giữ nhịp chậm/);
});

test('Né đá cũng chậm hơn, feedback giữ nguyên và tạm dừng không trôi tiến trình',()=>{
  const rock={...running('practice'),wave:'rock' as const};
  assert.ok(Math.abs(riverWaveDuration(rock)-72/13)<1e-12);
  assert.ok(Math.abs(advance(rock,30).progress-13/24)<1e-12);
  assert.equal(advance(rock,55).wave,'rock');assert.equal(advance(rock,56).wave,'answer');
  assert.equal(riverWaveDuration({...rock,mode:'standard'}),3.6);
  assert.equal(riverWaveDuration({...rock,wave:'feedback'}),1.3);
  const paused=pauseRiver(advance(rock,20));assert.equal(tickRiver(paused,20),paused);assert.equal(resumeRiver(paused).mode,'practice');assert.equal(resumeRiver(paused).progress,paused.progress);
  const intro=beginRiver(freshRiver('practice'));assert.equal(resumeRiver(pauseRiver(intro)).phase,'intro');assert.equal(advance(intro,31).phase,'running');
});

test('Một lượt tập chèo đủ 8 câu kết thúc hữu hạn, cùng quy tắc điểm và không tăng tốc',()=>{
  let state:RiverState=running('practice');
  for(let n=0;n<4000&&state.phase!=='finished';n++){
    if(state.wave==='answer')state={...state,lane:RIVER_QUESTIONS[state.cursor].correct};
    // Đá lần lượt ở làn 1, 2, 0; chọn làn kế tiếp để né, độc lập với helper của game.
    if(state.wave==='rock')state={...state,lane:((state.cursor+2)%3) as Lane};
    state=tickRiver(state,0.1);
  }
  assert.equal(state.phase,'finished');assert.equal(state.results.length,8);assert.equal(state.score,1240);assert.equal(state.bestCombo,8);assert.equal(state.hearts,3);assert.equal(state.crashes,0);assert.equal(riverSpeed(state),0.65);assert.ok(state.elapsed>270&&state.elapsed<274);
});

test('Kỷ lục Tập chèo tách hẳn kho chuẩn v1, giữ số cũ và xử lý dữ liệu hỏng/quota',()=>{
  const store=new FakeStore({[RIVER_RECORD_KEY]:'180'});
  assert.equal(readRiverRecord(store),180);assert.equal(readRiverRecord(store,'practice'),0);
  assert.equal(saveRiverRecord(store,1240,'practice'),true);assert.equal(store.getItem(RIVER_RECORD_KEY),'180');assert.equal(store.getItem(RIVER_PRACTICE_RECORD_KEY),'1240');
  assert.equal(saveRiverRecord(store,100,'practice'),true);assert.equal(readRiverRecord(store,'practice'),1240);
  assert.equal(saveRiverRecord(store,200),true);assert.equal(readRiverRecord(store),200);assert.equal(readRiverRecord(store,'practice'),1240);
  store.data.set(RIVER_PRACTICE_RECORD_KEY,'1241');assert.equal(readRiverRecord(store,'practice'),0);
  store.failSet='quota';assert.equal(saveRiverRecord(store,1200,'practice'),false);assert.equal(readRiverRecord(store),200);
  assert.equal(saveRiverRecord(undefined,100,'practice'),false);assert.equal(saveRiverRecord(store,1.5,'practice'),false);
});

test('UI thật: chọn trước lượt, HUD/đếm giây, giảm chuyển động, ẩn tab, lưu đúng chế độ và chặn callback cũ',()=>{
  const old={window:(globalThis as any).window,document:(globalThis as any).document,raf:(globalThis as any).requestAnimationFrame,caf:(globalThis as any).cancelAnimationFrame};
  const store=new FakeStore({[RIVER_RECORD_KEY]:'180'}),frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let id=0,time=0;
  (globalThis as any).window={localStorage:store,matchMedia:()=>({matches:false})};
  (globalThis as any).document={hidden:false,addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)};
  (globalThis as any).requestAnimationFrame=(fn:(time:number)=>void)=>{frames.set(++id,fn);return id;};(globalThis as any).cancelAnimationFrame=(key:number)=>frames.delete(key);
  const m=mount(file,{onExit(){}});
  const step=()=>{const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();};
  const key=(key:string)=>{m.tree.props.onKeyDown({key,preventDefault(){}});m.draw();};
  try{
    assert.equal(button(m,'Tiêu chuẩn').props['aria-pressed'],true);assert.match(text(m.tree),/Kỷ lục Tiêu chuẩn trên máy: 180 điểm/);
    const staleStandard=button(m,'Tiêu chuẩn').props.onClick;
    m.click('Tập chèo chậm');assert.equal(button(m,'Tập chèo chậm').props['aria-pressed'],true);assert.match(text(m.tree),/khoảng 28 giây mỗi câu/);assert.match(text(m.tree),/Kỷ lục Tập chèo trên máy: 0 điểm/);
    m.click('Giảm chuyển động: tắt');assert.match(m.tree.props.className,/river-reduced/);
    m.click('Bắt đầu đua thuyền');for(let n=0;n<33;n++)step();
    staleStandard();m.draw();assert.equal(all(m.tree,n=>n.type==='fieldset').length,0);assert.match(text(m.tree),/TỐC ĐỘ0.65×/);assert.match(text(m.tree),/CHẾ ĐỘTập chèo/);assert.match(text(m.tree),/Còn khoảng 28 giây/);
    const staleFrame=[...frames.values()][0];(globalThis as any).document.hidden=true;listeners.get('visibilitychange')!();m.draw();assert.equal(frames.size,0);const paused=text(m.tree);staleFrame(time+10000);m.draw();assert.equal(text(m.tree),paused);
    (globalThis as any).document.hidden=false;m.click('Tiếp tục chèo');key('ArrowLeft');for(let n=0;n<280;n++)step();
    m.click('Ⅱ Tạm dừng');const staleFinish=button(m,'Kết thúc và xem lời giải').props.onClick;const staleResume=button(m,'Tiếp tục chèo').props.onClick;m.click('Kết thúc và xem lời giải');m.draw();
    assert.match(text(m.tree),/Chế độ: Tập chèo/);assert.match(text(m.tree),/100 điểm/);assert.match(text(m.tree),/Kỷ lục Tập chèo trên máy: 100 điểm/);assert.equal(store.getItem(RIVER_RECORD_KEY),'180');assert.equal(store.getItem(RIVER_PRACTICE_RECORD_KEY),'100');
    const staleReplay=button(m,'Chèo một lượt mới').props.onClick;m.click('Đổi chế độ');assert.equal(m.focused?.id,'river-game-heading');staleStandard();m.draw();assert.equal(button(m,'Tập chèo chậm').props['aria-pressed'],true);
    m.click('Tiêu chuẩn');assert.match(text(m.tree),/Kỷ lục Tiêu chuẩn trên máy: 180 điểm/);m.click('Bắt đầu đua thuyền');for(let n=0;n<33;n++)step();
    staleFinish();staleReplay();staleResume();m.draw();assert.match(text(m.tree),/CHẾ ĐỘTiêu chuẩn/);assert.match(text(m.tree),/TỐC ĐỘ1.00×/);assert.doesNotMatch(text(m.tree),/Cùng gỡ câu sai|Thuyền đang neo an toàn/);
  }finally{m.unmount();assert.equal(frames.size,0);assert.equal(listeners.size,0);for(const [name,value]of Object.entries(old)){const target={window:'window',document:'document',raf:'requestAnimationFrame',caf:'cancelAnimationFrame'}[name]!;if(value===undefined)delete(globalThis as any)[target];else(globalThis as any)[target]=value;}}
});

{
  const keys=['window','document','requestAnimationFrame','cancelAnimationFrame','AudioContext'] as const,previous=Object.fromEntries(keys.map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const frames=new Map<number,(time:number)=>void>(),listeners=new Map<string,()=>void>();let id=0,time=0,tones=0;
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:new FakeStore(),matchMedia:()=>({matches:false})}});
  Object.defineProperty(globalThis,'document',{configurable:true,value:{hidden:false,addEventListener:(name:string,fn:()=>void)=>listeners.set(name,fn),removeEventListener:(name:string)=>listeners.delete(name)}});
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:(fn:(n:number)=>void)=>{frames.set(++id,fn);return id;}});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:(key:number)=>frames.delete(key)});
  const parameter={setValueAtTime(){},exponentialRampToValueAtTime(){}};
  Object.defineProperty(globalThis,'AudioContext',{configurable:true,value:class{
    state='running';currentTime=0;destination={};resume(){return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
    createOscillator(){if(++tones>1)throw Error('Giả lập Web Audio không tạo được oscillator khi qua cổng');return {frequency:parameter,connect(){},start(){},stop(){}};}
    createGain(){return {gain:parameter,connect(){}};}
  }});
  const m=mount(file,{onExit(){}}),step=()=>{const batch=[...frames.values()];frames.clear();time+=100;batch.forEach(fn=>fn(time));m.draw();};
  try{
    button(m,'♪ Âm thanh: tắt').props.onClick();await Promise.resolve();await Promise.resolve();m.draw();
    test('Lỗi Web Audio khi qua cổng tự tắt tiếng, giữ RAF và tiếp tục điểm/làn/câu sau',()=>{
      assert.equal(button(m,'♪ Âm thanh: bật').props['aria-pressed'],true);assert.equal(tones,1);
      m.click('Bắt đầu đua thuyền');for(let n=0;n<33;n++)step();m.click('← Trái');for(let n=0;n<185;n++)step();
      assert.equal(tones,2);assert.equal(button(m,'♪ Âm thanh: tắt').props['aria-pressed'],false);assert.equal(frames.size,1);
      assert.match(text(all(m.tree,n=>n.props.className==='river-hud')[0]),/ĐIỂM100/);assert.match(text(m.tree),/Đúng phao rồi!/);
      for(let n=0;n<60;n++)step();assert.equal(frames.size,1);assert.equal(tones,2);assert.match(text(m.tree),/CỔNG 2\/8/);assert.match(text(m.tree),/Thuyền ở làn 1\/3/);
      assert.match(text(all(m.tree,n=>n.props.className==='river-hud')[0]),/TỐC ĐỘ1.20×/);
    });
  }finally{m.unmount();assert.equal(frames.size,0);assert.equal(listeners.size,0);for(const key of keys){if(previous[key])Object.defineProperty(globalThis,key,previous[key]!);else delete(globalThis as any)[key];}}
}

finish({note:'6 nhóm ca có oracle độc lập cho tốc độ/tiến trình/lượt hoàn chỉnh, kho kỷ lục riêng, thao tác component thật và tiêm lỗi Web Audio để kiểm vòng RAF vẫn chạy. Chưa thay thế QA trình duyệt hoặc đo tần suất lỗi âm thanh trên trình duyệt thật.'});
