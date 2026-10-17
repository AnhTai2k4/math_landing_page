import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {createLeaderboardRefreshHub,invalidateLeaderboardRequests,LEADERBOARD_POLL_MS,LEADERBOARD_REFRESH_KEY,requestLeaderboard} from '../src/native/homework/leaderboard-refresh';

// Timer 45 giây dùng chung; không để timer polling tồn tại khi tab ẩn.
const win=Object.assign(new EventTarget(),{localStorage:{setItem:(key:string,value:string)=>writes.push({key,value})}});
const doc=Object.assign(new EventTarget(),{visibilityState:'visible'}),writes:{key:string;value:string}[]=[],timers=new Map<number,()=>void>();
let nextTimer=0;
const hub=createLeaderboardRefreshHub({window:win as any,document:doc as any,setTimer:(fn,delay)=>{assert.equal(delay,LEADERBOARD_POLL_MS);timers.set(++nextTimer,fn);return nextTimer;},clearTimer:id=>{timers.delete(id as number);},nonce:()=> 'nonce-khong-chua-du-lieu'});
const events:string[]=[],other:string[]=[];
const remove=hub.subscribe(event=>events.push(event.reason)),removeOther=hub.subscribe(event=>other.push(event.reason));
assert.equal(timers.size,1,'Các bảng trong cùng tab dùng một timer.');
const fire=()=>{const [id,fn]=[...timers][0];timers.delete(id);fn();};
fire();assert.deepEqual(events,['poll']);assert.deepEqual(other,['poll']);assert.equal(timers.size,1);
doc.visibilityState='hidden';fire();assert.deepEqual(events,['poll'],'Timer đã xếp hàng vẫn kiểm tra trạng thái tab trước khi polling.');assert.equal(timers.size,0);
doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,1);
doc.visibilityState='hidden';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
hub.submitted();assert.equal(events.at(-1),'submitted','Nộp xong được làm mới ngay, cả khi có tín hiệu rõ ràng lúc tab ẩn.');
assert.deepEqual(JSON.parse(writes[0].value),{kind:'submitted',nonce:'nonce-khong-chua-du-lieu'});assert.equal(writes[0].key,LEADERBOARD_REFRESH_KEY);
const storage=new Event('storage');Object.assign(storage,{key:LEADERBOARD_REFRESH_KEY,newValue:JSON.stringify({kind:'submitted',nonce:'tu-tab-khac'})});win.dispatchEvent(storage);
assert.equal(events.at(-1),'submitted');assert.equal(timers.size,0,'Tín hiệu nộp bài không bật polling trong tab ẩn.');
doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));assert.equal(events.at(-1),'visible');assert.equal(timers.size,1);
remove();assert.equal(timers.size,1);removeOther();assert.equal(timers.size,0);
const afterStop=events.length;win.dispatchEvent(storage);doc.dispatchEvent(new Event('visibilitychange'));assert.equal(events.length,afterStop);

// Chỉ gộp request đang chạy, luôn no-store; đổi phiên/lượt nộp không tái dùng response cũ.
const savedFetch=globalThis.fetch;
let calls=0;const releases:((value:any)=>void)[]=[];
globalThis.fetch=async(_url,init)=>{calls++;assert.equal(init?.cache,'no-store');assert.ok(init?.signal);return await new Promise(resolve=>releases.push(resolve)) as Response;};
const response=(value:number)=>({ok:true,status:200,json:async()=>({value})});
try{
  const a=requestLeaderboard<{value:number}>('/api/xep-hang?khoi=2K9'),b=requestLeaderboard<{value:number}>('/api/xep-hang?khoi=2K9');
  assert.equal(calls,1);releases.shift()!(response(1));assert.equal((await a).data?.value,1);assert.equal((await b).data?.value,1);
  const c=requestLeaderboard<{value:number}>('/api/xep-hang?khoi=2K9');assert.equal(calls,2,'Không cache dữ liệu sau khi request xong.');
  invalidateLeaderboardRequests();const d=requestLeaderboard<{value:number}>('/api/xep-hang?khoi=2K9');assert.equal(calls,3,'Lượt nộp mới không nhận request cũ.');
  releases.shift()!(response(2));releases.shift()!(response(3));assert.equal((await c).data?.value,2);assert.equal((await d).data?.value,3);
}finally{globalThis.fetch=savedFetch;}

// Chạy component thật qua runtime hook: bảng công khai và Hạng của em cùng đổi ngay sau nộp.
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
// Dashboard phải đọc điểm chấm tay ở response, kể cả điểm chính thức bằng 0.
const dashboardCode=buildSync({entryPoints:[join(root,'src/native/homework/R104Dashboard.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const dashboardModule={exports:{} as any};new Function('require','module','exports',dashboardCode)(require,dashboardModule,dashboardModule.exports);
const dashboardState={fullName:'Học sinh thử điểm chính thức',className:'2K9 9+',lessonCode:'fixture',exam:null,dueAt:null,maxAttempts:3,attemptsUsed:3,draft:null,bestScore:8,demo:true,lessons:[{lessonCode:'fixture',date:'2020-01-01',classNames:['2K9 9+'],title:'Buổi thử',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:null,bestScore:null,pendingGrading:true,submittedAt:1,late:false,available:true}],receipts:[{attemptId:'a',attemptNumber:1,submittedAt:1,elapsedSeconds:1,score:5,officialScore:8,gradingPending:false,late:false,timedOut:false},{attemptId:'b',attemptNumber:2,submittedAt:2,elapsedSeconds:1,score:5,officialScore:0,gradingPending:false,late:false,timedOut:false},{attemptId:'c',attemptNumber:3,submittedAt:3,elapsedSeconds:1,score:null,gradingPending:true,late:false,timedOut:false}]};
const dashboardHtml=renderToStaticMarkup(React.createElement(dashboardModule.exports.default,{state:dashboardState,busy:false,onSelect:()=>{}}));
const receiptHtml=dashboardHtml.slice(dashboardHtml.indexOf('class="r104-hw-receipts"'));
assert.match(receiptHtml,/<strong>8<\/strong>/);assert.match(receiptHtml,/<strong>0<\/strong>/);assert.doesNotMatch(receiptHtml,/<strong>5<\/strong>/);
assert.match(receiptHtml,/Tạm tính · chờ chấm/);assert.match(dashboardHtml,/r104-hw-history-score"><small>Tạm tính · chờ chấm/);
const code=buildSync({stdin:{contents:"export {default as Board} from './src/native/homework/HomeLeaderboard'; export {notifyLeaderboardSubmitted as submitted} from './src/native/homework/leaderboard-refresh';",resolveDir:root,sourcefile:'live-refresh-fixture.ts'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
let currentRuntime:Runtime;
class Runtime{
  slots:any[]=[];index=0;changed=false;effects:Function[]=[];tree:any;disposed=false;updatesAfterDispose=0;
  constructor(readonly props:Record<string,unknown>={}){}
  state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return [this.slots[i].value,(next:any)=>{if(this.disposed)this.updatesAfterDispose++;const value=typeof next==='function'?next(this.slots[i].value):next;if(!Object.is(value,this.slots[i].value)){this.slots[i].value=value;this.changed=true;}}];}
  ref(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={current:initial};return this.slots[i];}
  effect(fn:Function,deps:any[]){const i=this.index++,old=this.slots[i];if(!old||deps.some((value,j)=>!Object.is(value,old.deps[j]))){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
  renderOnly(){currentRuntime=this;this.index=0;this.changed=false;return this.tree=Board(this.props);}
  flush(){for(let i=0;i<20;i++){this.renderOnly();this.effects.splice(0).forEach(fn=>fn());if(!this.changed)return;}throw Error('Hook không ổn định');}
  html(){return renderToStaticMarkup(this.tree);}
  dispose(){this.disposed=true;this.slots.forEach(slot=>slot?.cleanup?.());}
}
const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,useState:(initial:any)=>currentRuntime.state(initial),useRef:(initial:any)=>currentRuntime.ref(initial),useEffect:(fn:Function,deps:any[])=>currentRuntime.effect(fn,deps)}:require(id),mod,mod.exports);
const {Board,submitted}=mod.exports;
const previousWindow=(globalThis as any).window,previousDocument=(globalThis as any).document;
const browser=new EventTarget(),page=Object.assign(new EventTarget(),{visibilityState:'hidden'});
Object.assign(globalThis,{window:browser,document:page});
const requests:{url:string;init:any}[]=[],held:{release:(value:any)=>void;value:any}[]=[];
let current={rank:4,fullName:'Học sinh thử tự cập nhật',className:'Lớp thử',score:7,submitted:1,total:2},hold=false;
globalThis.fetch=async(url:any,init:any)=>{
  requests.push({url:String(url),init});
  const value={ok:true,status:200,json:async()=>String(url)==='/api/xep-hang-cua-em'?{enabled:true,row:{...current}}:{enabled:true,rows:[{...current}]}};
  // Snapshot phải thuộc thời điểm request để phát hiện response cũ quay về muộn.
  const data=await value.json(),snapshot={...value,json:async()=>data};
  if(hold)return await new Promise(resolve=>held.push({release:resolve,value:snapshot})) as any;
  return snapshot as any;
};
const full=new Runtime(),compact=new Runtime({compact:true}),turn=async()=>{await new Promise(resolve=>setTimeout(resolve,0));full.flush();compact.flush();};
try{
  full.flush();compact.flush();await turn();
  assert.equal(requests.length,2,'Hai bảng cùng bộ lọc chỉ tải một request công khai và một request hạng cá nhân.');
  assert.match(full.html(),/Hạng 4/);assert.match(compact.html(),/Hạng 4/);
  current={...current,rank:2,score:9,submitted:2};submitted();full.flush();compact.flush();await turn();
  assert.equal(requests.length,4);assert.match(full.html(),/Hạng 2/);assert.match(compact.html(),/Hạng 2/);
  assert.match(full.html(),/mtm-rank-refresh-(?:odd|even)/);assert.match(full.html(),/chưa tính vào hạng/);
  hold=true;current={...current,rank:8,score:1};submitted();full.flush();compact.flush();
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(held.length,2);
  current={...current,rank:1,score:10};submitted();hold=false;
  held.splice(0).forEach(item=>item.release(item.value));await new Promise(resolve=>setTimeout(resolve,0));
  full.renderOnly();compact.renderOnly();assert.doesNotMatch(full.html(),/Hạng 8/,'Response trước lượt nộp mới bị loại ngay trước effect cleanup.');
  full.flush();compact.flush();await turn();assert.match(full.html(),/Hạng 1/);assert.match(compact.html(),/Hạng 1/);
  hold=true;submitted();full.flush();compact.flush();await new Promise(resolve=>setTimeout(resolve,0));full.dispose();compact.dispose();
  held.splice(0).forEach(item=>item.release(item.value));await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(full.updatesAfterDispose,0);assert.equal(compact.updatesAfterDispose,0);
  assert.ok(requests.every(request=>request.init.cache==='no-store'));
}finally{
  full.dispose();compact.dispose();globalThis.fetch=savedFetch;
  if(previousWindow===undefined)delete (globalThis as any).window;else (globalThis as any).window=previousWindow;
  if(previousDocument===undefined)delete (globalThis as any).document;else (globalThis as any).document=previousDocument;
}
console.log('Đạt tự cập nhật bảng hạng: poll 45 giây, ẩn dừng timer, nộp xong đổi cùng tab/cross-tab, dedup, chặn response cũ và cập nhật sau unmount.');
