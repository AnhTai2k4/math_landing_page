import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import {createHomeworkResultSummary} from '../src/native/homework/result-summary';

// Chỉ dùng biên nhận GIẢ. Không đọc storage hoặc gọi mạng để thử clipboard.
const startedAt=Date.parse('2026-10-16T07:00:00Z'),submittedAt=startedAt+60000;
const state:HomeworkState={exam:null,fullName:'TEN-GIA',className:'LOP-GIA',lessonCode:'BUOI-GIA',dueAt:null,maxAttempts:5,attemptsUsed:1,bestScore:8,demo:true,draft:{version:1,examId:'DE-GIA',examVersionHash:'a'.repeat(64),rubricVersion:'RUBRIC-GIA',attemptId:'LUOT-GIA',startedAt,deadline:startedAt+600000,updatedAt:submittedAt,submittedAt,revision:1,answers:{}},receipts:[{attemptId:'LUOT-GIA',attemptNumber:1,score:8,submittedAt,elapsedSeconds:60,late:false,timedOut:false}]};
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react');
const sameDeps=(a:unknown[]|undefined,b:unknown[]|undefined)=>!!a&&!!b&&a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));
class Runtime{
  slots:any[]=[];cursor=0;effects:(()=>void)[]=[];writes=0;
  hooks={
    useId:()=>':summary-clipboard-test:',
    useRef:(initial:any)=>{const i=this.cursor++;if(!(i in this.slots))this.slots[i]={current:initial};return this.slots[i];},
    useState:(initial:any)=>{const i=this.cursor++;if(!(i in this.slots))this.slots[i]=typeof initial==='function'?initial():initial;return [this.slots[i],(next:any)=>{this.writes++;this.slots[i]=typeof next==='function'?next(this.slots[i]):next;}];},
    useEffect:(effect:()=>void|(()=>void),deps?:unknown[])=>{const i=this.cursor++,previous=this.slots[i];if(!previous||!sameDeps(previous.deps,deps)){const slot={deps,cleanup:undefined as undefined|(()=>void)};this.slots[i]=slot;this.effects.push(()=>{previous?.cleanup?.();slot.cleanup=effect()||undefined;});}},
  };
  draw(component:any,input:HomeworkState=state){this.cursor=0;const tree=component({state:input});this.effects.splice(0).forEach(fn=>fn());return tree;}
  unmount(){this.slots.forEach(value=>value?.cleanup?.());}
}
function compile(runtime:Runtime){
  const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkResultSummary.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',logLevel:'silent'}).outputFiles[0].text,mod={exports:{} as any};
  new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,...runtime.hooks}:require(id),mod,mod.exports);
  return mod.exports.default;
}
class FakeClock{
  now=0;serial=0;pending=new Map<number,{at:number;run:()=>void}>();
  originalSet=globalThis.setTimeout;originalClear=globalThis.clearTimeout;
  install(){
    globalThis.setTimeout=((run:()=>void,delay=0)=>{const id=++this.serial;this.pending.set(id,{at:this.now+delay,run});return id;}) as any;
    globalThis.clearTimeout=((id:number)=>{this.pending.delete(id);}) as any;
  }
  tick(ms:number){
    const target=this.now+ms;
    while(true){const next=[...this.pending].sort((a,b)=>a[1].at-b[1].at).find(([,item])=>item.at<=target);if(!next)break;this.now=next[1].at;this.pending.delete(next[0]);next[1].run();}
    this.now=target;
  }
  restore(){globalThis.setTimeout=this.originalSet;globalThis.clearTimeout=this.originalClear;this.pending.clear();}
}
const text=(tree:any):string=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const find=(tree:any,predicate:(node:any)=>boolean):any=>!tree||typeof tree!=='object'?null:Array.isArray(tree)?tree.map(node=>find(node,predicate)).find(Boolean)??null:predicate(tree)?tree:find(tree.props?.children,predicate);
const button=(tree:any)=>find(tree,node=>node.type==='button');
const details=(tree:any)=>find(tree,node=>node.type==='details');
const statusNode=(tree:any)=>find(tree,node=>node.props?.role==='status');
const status=(tree:any)=>text(statusNode(tree));
const settle=async()=>{await Promise.resolve();await Promise.resolve();await Promise.resolve();};
const deferred=()=>{let resolve!:()=>void,reject!:(error:Error)=>void;const promise=new Promise<void>((done,fail)=>{resolve=done;reject=fail;});return {promise,resolve,reject};};
const setNavigator=(value:any)=>Object.defineProperty(globalThis,'navigator',{configurable:true,value});
const globals={navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'),storage:Object.getOwnPropertyDescriptor(globalThis,'localStorage'),fetch:globalThis.fetch};
let count=0;
const test=async(name:string,fn:()=>unknown)=>{await fn();console.log('ĐẠT '+(++count)+' '+name);};
try{
  globalThis.fetch=()=>{throw Error('Không được gọi mạng');};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('Không được đọc storage');}});
  await test('Clipboard treo được thoát sau 4 giây, mở ô thủ công và bỏ qua cả kết quả thành công muộn',async()=>{
    const first=deferred(),second=deferred(),requests:string[]=[];
    setNavigator({clipboard:{writeText(value:string){requests.push(value);return requests.length===1?first.promise:second.promise;}}});
    const runtime=new Runtime(),Summary=compile(runtime),clock=new FakeClock(),draw=()=>runtime.draw(Summary);
    clock.install();
    try{
      let tree=draw();button(tree).props.onClick();tree=draw();
      assert.equal(button(tree).props.disabled,true);assert.equal(button(tree).props['aria-busy'],true);assert.equal(clock.pending.size,1);
      clock.tick(3999);tree=draw();assert.equal(button(tree).props.disabled,true);assert.equal(details(tree).props.open,false);
      clock.tick(1);tree=draw();assert.equal(button(tree).props.disabled,false);assert.equal(button(tree).props['aria-busy'],false);assert.equal(details(tree).props.open,true);assert.match(status(tree),/mất nhiều thời gian/);assert.equal(clock.pending.size,0);
      button(tree).props.onClick();tree=draw();assert.equal(details(tree).props.open,true);assert.equal(button(tree).props.disabled,true);
      const before=runtime.writes;first.resolve();await settle();assert.equal(runtime.writes,before);assert.match(status(draw()),/^Đang sao chép/);
      second.resolve();await settle();tree=draw();assert.match(status(tree),/^Đã sao chép/);assert.equal(button(tree).props.disabled,false);assert.equal(details(tree).props.open,false);assert.equal(clock.pending.size,0);assert.deepEqual(requests,[createHomeworkResultSummary(state),createHomeworkResultSummary(state)]);
      runtime.unmount();
    }finally{clock.restore();}
  });

  await test('Thử sao chép lại giữ ô thủ công tới thành công và người học vẫn mở, đóng details được',async()=>{
    const retry=deferred();let calls=0;
    setNavigator({clipboard:{writeText(){return ++calls===1?Promise.reject(Error('Từ chối GIẢ')):retry.promise;}}});
    const runtime=new Runtime(),Summary=compile(runtime),clock=new FakeClock(),draw=()=>runtime.draw(Summary);
    clock.install();
    try{
      let tree=draw(),focused=0,selected=0;
      find(tree,node=>node.type==='textarea').ref.current={focus(){focused++;},select(){selected++;}};
      button(tree).props.onClick();await settle();tree=draw();assert.equal(details(tree).props.open,true);assert.equal(focused,1);assert.equal(selected,1);assert.equal(clock.pending.size,0);
      button(tree).props.onClick();tree=draw();assert.equal(details(tree).props.open,true);assert.match(status(tree),/^Đang sao chép/);assert.equal(find(tree,node=>node.type==='textarea').props.value,createHomeworkResultSummary(state));
      details(tree).props.onToggle({currentTarget:{open:false}});tree=draw();assert.equal(details(tree).props.open,false);assert.equal(button(tree).props.disabled,true);
      details(tree).props.onToggle({currentTarget:{open:true}});tree=draw();assert.equal(details(tree).props.open,true);assert.equal(focused,2);
      retry.resolve();await settle();tree=draw();assert.match(status(tree),/^Đã sao chép/);assert.equal(details(tree).props.open,false);assert.equal(clock.pending.size,0);runtime.unmount();
    }finally{clock.restore();}
  });

  await test('Tiêu đề tự gửi, trạng thái có liên kết mô tả, details luôn nhận boolean',async()=>{
    setNavigator({});const runtime=new Runtime(),Summary=compile(runtime),clock=new FakeClock(),draw=()=>runtime.draw(Summary);
    clock.install();
    try{
      let tree=draw();assert.equal(text(find(tree,node=>node.type==='h3')),'Phiếu kết quả để tự gửi');assert.equal(details(tree).props.open,false);assert.equal(button(tree).props['aria-describedby'],statusNode(tree).props.id);assert.equal(button(tree).props['aria-busy'],false);
      details(tree).props.onToggle({currentTarget:{open:true}});tree=draw();assert.equal(details(tree).props.open,true);
      details(tree).props.onToggle({currentTarget:{open:false}});tree=draw();assert.equal(details(tree).props.open,false);
      button(tree).props.onClick();await settle();tree=draw();assert.equal(details(tree).props.open,true);assert.equal(typeof details(tree).props.open,'boolean');assert.match(status(tree),/^Chưa sao chép tự động được/);assert.equal(button(tree).props['aria-describedby'],statusNode(tree).props.id);assert.equal(statusNode(tree).props['aria-live'],'polite');assert.equal(statusNode(tree).props['aria-atomic'],'true');assert.equal(find(tree,node=>node.type==='textarea').props.readOnly,true);assert.equal(clock.pending.size,0);runtime.unmount();
    }finally{clock.restore();}
  });

  await test('Đổi receipt, mất ACK hoặc tháo component xóa timer và không nhận kết quả clipboard muộn',async()=>{
    for(const next of [{...state,receipts:[{...state.receipts[0],score:9}]},{...state,receipts:[]},null]){
      const pending=deferred();setNavigator({clipboard:{writeText(){return pending.promise;}}});
      const runtime=new Runtime(),Summary=compile(runtime),clock=new FakeClock();clock.install();
      try{
        button(runtime.draw(Summary)).props.onClick();runtime.draw(Summary);assert.equal(clock.pending.size,1);
        if(next){const tree=runtime.draw(Summary,next);assert.equal(status(tree),'');if(tree)assert.equal(details(tree).props.open,false);}else runtime.unmount();
        assert.equal(clock.pending.size,0);const before=runtime.writes;clock.tick(10000);pending.reject(Error('Lỗi muộn GIẢ'));await settle();assert.equal(runtime.writes,before);runtime.unmount();
      }finally{clock.restore();}
    }
  });
}finally{
  if(globals.navigator)Object.defineProperty(globalThis,'navigator',globals.navigator);else delete (globalThis as any).navigator;
  if(globals.storage)Object.defineProperty(globalThis,'localStorage',globals.storage);else delete (globalThis as any).localStorage;
  globalThis.fetch=globals.fetch;
}
console.log(`${count}/${count} ca clipboard đạt với hook tổng hợp và đồng hồ giả. Chưa kiểm quyền clipboard hoặc trình đọc màn hình thật.`);
