import assert from 'node:assert/strict';
import {mount as mountSession,state,all,text,f} from './daily20-session-harness.mts';
import {createDraft} from '../src/native/exams/store';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import {load,React,require} from './daily19-ui-harness.mts';
const Overview=load('src/native/homework/HomeworkOverview.tsx').default;
const T0=Date.now(),made=createDraft(f.exam,'fake-day20-attempt',T0-2000);assert.ok(made.ok);
const initial=():HomeworkState=>({...state(),draft:{...made.value,submittedAt:T0-1000},attemptsUsed:1,serverNow:T0,assetsExpiresAt:T0+3600000});
const overview=(r:any)=>all(r.runtime.value,(n:any)=>typeof n.type==='function'&&typeof n.props?.onRefreshReceipt==='function')[0];
async function mount(initial:HomeworkState){
  const r=await mountSession(initial);
  if(r.cards()){
    r.cards().props.onHomework(initial.lessonCode);await r.settle();
    assert.equal(r.requests.at(-1)!.body.action,'select');r.requests.at(-1)!.reply(200,initial);await r.settle();
  }
  return r;
}
let count=0;async function test(name:string,fn:()=>Promise<void>){await fn();console.log('ĐẠT '+(++count)+' '+name);}
await test('Chỉ gọi state, chặn bấm lặp ngay cả callback cũ và nhận ACK mà không start/save',async()=>{
  const r=await mount(initial());try{
    const props=overview(r).props;props.onRefreshReceipt();props.onRefreshReceipt();await r.settle();
    assert.equal(r.requests.length,3);assert.deepEqual(r.requests.at(-1)!.body,{action:'state',lessonCode:'buoi-gia'});assert.equal(overview(r).props.busy,true);
    const receipt={attemptId:made.value.attemptId,attemptNumber:1,submittedAt:T0-1000,elapsedSeconds:1,score:8,late:false,timedOut:false};
    r.requests.at(-1)!.reply(200,{...initial(),serverNow:T0+1,receipts:[receipt],bestScore:8});await r.settle();
    assert.equal(overview(r).props.state.receipts[0].score,8);assert.equal(overview(r).props.busy,false);
    assert.ok(r.requests.slice(2).every(req=>req.body.action==='state'));
  }finally{r.dispose();}
});
for(const failure of ['503','network','json'])await test('Lỗi '+failure+' giữ bản đã nộp và cho kiểm tra lại',async()=>{
  const r=await mount(initial());try{
    overview(r).props.onRefreshReceipt();await r.settle();const request=r.requests.at(-1)!;
    if(failure==='network')request.fail();else request.reply(failure==='503'?503:200,{message:'Lỗi GIẢ'},failure==='json'?'{':undefined);
    await r.settle();assert.equal(overview(r).props.state.draft.attemptId,made.value.attemptId);assert.equal(overview(r).props.busy,false);assert.ok(all(r.runtime.value,n=>n.props?.role==='alert').length);
    overview(r).props.onRefreshReceipt();await r.settle();assert.equal(r.requests.length,4);r.requests.at(-1)!.reply(200,initial());await r.settle();
  }finally{r.dispose();}
});
for(const status of [401,403])await test('Thu hồi '+status+' HTML rồi phản hồi cũ không khôi phục phiên',async()=>{
  const r=await mount(initial());try{
    overview(r).props.onRefreshReceipt();await r.settle();const old=r.requests.at(-1)!;
    const denial=await r.renew();denial.reply(status,undefined,'Từ chối GIẢ');await r.settle();assert.ok(r.gate());
    old.reply(200,{...initial(),fullName:'Nội dung GIẢ cũ'});await r.settle();assert.ok(r.gate());assert.equal(overview(r),undefined);assert.doesNotMatch(text(r.runtime.value),/Nội dung GIẢ cũ/);
  }finally{r.dispose();}
});
await test('Đăng xuất trong refresh đang chờ không bị response cũ mở lại',async()=>{
  const r=await mount(initial());try{
    overview(r).props.onRefreshReceipt();await r.settle();const old=r.requests.at(-1)!;
    all(r.runtime.value,n=>n.type==='button'&&text(n)==='Thoát')[0].props.onClick();await r.settle();assert.equal(r.requests.at(-1)!.body.action,'logout');
    r.requests.at(-1)!.reply(200,{loggedOut:true});await r.settle();assert.ok(r.gate());old.reply(200,initial());await r.settle();assert.ok(r.gate());
  }finally{r.dispose();}
});
await test('Snapshot khác lượt hoặc lùi giờ không thay bản đã nộp, active draft không có nút refresh',async()=>{
  const r=await mount(initial());try{
    for(const next of [{...initial(),serverNow:T0-1},{...initial(),draft:{...initial().draft!,attemptId:'khac'}}]){
      overview(r).props.onRefreshReceipt();await r.settle();r.requests.at(-1)!.reply(200,next);await r.settle();assert.equal(overview(r).props.state.draft.attemptId,made.value.attemptId);assert.equal(overview(r).props.state.serverNow,T0);
    }
  }finally{r.dispose();}
  const active=await mount({...initial(),draft:made.value});try{assert.equal(overview(active),undefined);}finally{active.dispose();}
});
await test('UI nút chờ ACK/busy, kết quả tháng vẫn ẩn dù đồng hồ máy đã qua giờ đóng',async()=>{
  const render=(s:HomeworkState,busy=false)=>require('react-dom/server').renderToStaticMarkup(React.createElement(Overview,{state:s,busy,onStart(){},onRefreshReceipt(){}}));
  assert.match(render(initial()),/Kiểm tra lại biên nhận/);assert.match(render(initial(),true),/<button type="button" class="btvn-btn" disabled="">Kiểm tra lại biên nhận/);
  const hidden={...initial(),kind:'kiem-tra-thang' as const,solutionsAvailable:false,closesAt:T0-1000,receipts:[{attemptId:made.value.attemptId,attemptNumber:1,submittedAt:T0-1000,elapsedSeconds:1,score:9.75,late:false,timedOut:false}],bestScore:9.75};
  assert.doesNotMatch(render(hidden),/9,75|Sao chép phiếu|Xem lời giải|Kiểm tra lại biên nhận/);assert.match(render(hidden),/điểm công bố sau giờ đóng/);
});
console.log(count+'/'+count+' nhóm kiểm refresh đạt. Runtime hook/SSR, transport GIẢ trong RAM, không trình duyệt hoặc API thật.');
