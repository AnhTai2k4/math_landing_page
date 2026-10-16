import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pipelineFixture} from './btvn-pipeline-fixture';
import {createDraft,draftKey,type Draft} from '../src/native/exams/store';
import type {HomeworkState} from '../src/native/homework/btvn-contract';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json')),{buildSync}=require('esbuild');
const fixture=join(root,'tests/fixtures/doi-ngu-react.mts');
const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkSession.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture,'react-dom':fixture},loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const module={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),module,module.exports);
const Session=module.exports.default;

class Runtime{
 slots:any[]=[];index=0;changed=false;effects:(()=>void)[]=[];value:any;disposed=false;
 constructor(public fn:()=>any){}
 same(a:any,b:any){return a&&b&&a.length===b.length&&a.every((v:any,i:number)=>Object.is(v,b[i]));}
 state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return[this.slots[i].value,(v:any)=>{const next=typeof v==='function'?v(this.slots[i].value):v;if(!Object.is(next,this.slots[i].value)){this.slots[i].value=next;this.changed=true;}}];}
 ref(value:any){const i=this.index++;return this.slots[i]??(this.slots[i]={current:value});}
 memo(fn:()=>any,deps:any){const i=this.index++;if(!this.slots[i]||!this.same(this.slots[i].deps,deps))this.slots[i]={value:fn(),deps};return this.slots[i].value;}
 effect(fn:any,deps:any){const i=this.index++,old=this.slots[i];if(!old||!this.same(old.deps,deps)){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
 flush(){assert.equal(this.disposed,false);for(let n=0;n<30;n++){(globalThis as any).__doiNguRuntime=this;this.index=0;this.changed=false;this.value=this.fn();this.effects.splice(0).forEach(f=>f());if(!this.changed)return this.value;}throw Error('Runtime hook không ổn định');}
 dispose(){if(this.disposed)return;this.disposed=true;this.slots.forEach(s=>s?.cleanup?.());}
}
const all=(t:any,p:(node:any)=>boolean):any[]=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(n=>all(n,p)):[...(p(t)?[t]:[]),...all(t.props?.children,p)];
const find=(t:any,p:(node:any)=>boolean)=>all(t,p)[0];
const text=(t:any):string=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(''):typeof t==='object'?text(t.props?.children):String(t);
const microtasks=async()=>{for(let n=0;n<30;n++)await Promise.resolve();};
class Events extends EventTarget{removeEventListener(type:string,listener:any,options?:any){super.removeEventListener(type,listener,typeof options==='boolean'?{capture:options}:options);}}
const windowEvents=new Events(),documentEvents=new Events(),url=new URL('https://fake.local/btvn');
Object.assign(globalThis,{window:windowEvents,document:Object.assign(documentEvents,{visibilityState:'visible',querySelector:()=>null,getElementById:()=>null}),location:url,history:{pushState(_state:any,_title:any,next:string){url.href=new URL(next,url.href).href;}},requestAnimationFrame:(fn:()=>void)=>fn()});

type SaveRequest={body:{answers:Draft['answers']};respond:(status:number,body:unknown)=>void};
async function mount(){
 const f=pipelineFixture(),now=Date.now(),made=createDraft(f.exam,'fake-exit-attempt',now);assert.ok(made.ok);
 let current:HomeworkState={exam:f.exam,fullName:'Người học giả',className:f.material.classNames[0],lessonCode:f.material.lessonCode,dueAt:null,maxAttempts:5,attemptsUsed:1,draft:made.value,receipts:[],bestScore:null,demo:false,lessons:[],serverNow:now};
 const requests:SaveRequest[]=[],actions:string[]=[];
 (globalThis as any).fetch=(path:string,init:any)=>{
  assert.equal(path,'/api/btvn','Test chỉ gọi transport giả, không ra mạng');
  const body=JSON.parse(init.body);actions.push(body.action);
  if(body.action==='classes')return Promise.resolve(new Response(JSON.stringify({classNames:[f.material.classNames[0]]})));
  if(body.action==='state')return Promise.resolve(new Response(JSON.stringify(current)));
  if(body.action==='save')return new Promise<Response>(resolve=>requests.push({body,respond:(status,data)=>resolve(new Response(JSON.stringify(data),{status}))}));
  if(body.action==='logout')return Promise.resolve(new Response(JSON.stringify({loggedOut:true})));
  throw Error('Test không hỗ trợ action '+body.action);
 };
 const parent=new Runtime(()=>Session({pathname:'/btvn'}));let managed:any,child:Runtime|null=null,unmounts=0;
 const sync=()=>{
  parent.flush();managed=find(parent.value,n=>typeof n.type==='function'&&n.props?.saverRef&&n.props?.gateway);
  if(managed){child??=new Runtime(()=>managed.type(managed.props));child.flush();}
  else if(child){child.dispose();child=null;unmounts++;}
 };
 const settle=async()=>{await microtasks();sync();};
 sync();await settle();assert.ok(child,'Đã mount ManagedAttempt từ cây HomeworkSession thật');
 const practice=()=>find(child!.value,n=>typeof n.type==='function'&&n.props?.isHomework&&n.props?.storeOverride);
 const write=(answer:string)=>{const props=practice().props,store=props.storeOverride,draft=JSON.parse(store.getItem(draftKey(f.exam.id))) as Draft;store.setItem(draftKey(f.exam.id),JSON.stringify({...draft,answers:{'mc-1':answer},revision:draft.revision+1,updatedAt:Math.max(Date.now(),draft.updatedAt)}));sync();};
 const press=(label:string)=>{const button=find(parent.value,n=>n.type==='button'&&text(n)===label);assert.ok(button,'Có nút '+label);assert.notEqual(button.props.disabled,true);button.props.onClick();sync();};
 const ack=async(index:number)=>{const request=requests[index];assert.ok(request,'Có bản gửi '+index);current={...current,draft:{...current.draft!,answers:request.body.answers,revision:current.draft!.revision+1},serverNow:Date.now()};request.respond(200,{...current,exam:null,lessons:undefined,saveOnly:true,revision:index+1});await settle();};
 const fail=async(index:number)=>{assert.ok(requests[index]);requests[index].respond(503,{message:'Lỗi lưu giả để kiểm gửi lại'});await settle();};
 const close=async(index:number)=>{assert.ok(requests[index]);const submittedAt=Date.now();current={...current,draft:{...current.draft!,answers:{'mc-1':'A'},submittedAt},receipts:[{attemptId:current.draft!.attemptId,submittedAt,score:0}] as HomeworkState['receipts']};requests[index].respond(200,current);await settle();};
 return {parent,requests,actions,write,press,ack,fail,close,sync,settle,practice,get child(){return child;},get unmounts(){return unmounts;},retry(){const button=find(child!.value,n=>n.type==='button'&&text(n)==='Gửi lại bài đang giữ');assert.ok(button,'Lỗi còn nút gửi lại');assert.equal(button.props.disabled,false);button.props.onClick();sync();},dispose(){child?.dispose();parent.dispose();}};
}

let count=0;
async function test(name:string,run:()=>Promise<void>){await run();console.log('ĐẠT '+(++count)+' '+name);}

await test('Thoát chờ cả bản mới xuất hiện trong lúc đang gửi, không logout sau ACK cũ',async()=>{
 const r=await mount();try{
  r.write('A');r.press('Thoát');await r.settle();assert.equal(r.requests.length,1);assert.equal(r.actions.includes('logout'),false);assert.ok(r.child);assert.equal(r.unmounts,0);
  r.write('B');await r.ack(0);assert.equal(r.requests.length,2);assert.equal(r.actions.includes('logout'),false);assert.ok(r.child);assert.equal(r.unmounts,0);
  await r.ack(1);assert.equal(r.actions.filter(a=>a==='logout').length,1);assert.equal(r.child,null);assert.equal(r.unmounts,1);
 }finally{r.dispose();}
});
await test('Các buổi học giữ phòng khi pending và chỉ về danh sách sau ACK',async()=>{
 const r=await mount();try{
  r.write('C');r.press('← Các buổi học');await r.settle();assert.equal(r.requests.length,1);assert.ok(r.child);assert.equal(r.unmounts,0);assert.equal(r.actions.includes('logout'),false);
  await r.ack(0);assert.equal(r.child,null);assert.equal(r.unmounts,1);assert.equal(r.actions.includes('logout'),false);assert.ok(find(r.parent.value,n=>typeof n.type==='function'&&n.props?.onHomework),'Danh sách buổi đã xuất hiện');
 }finally{r.dispose();}
});
for(const label of ['Thoát','← Các buổi học'])await test(label+' gặp lỗi lưu vẫn giữ đáp án, hiện gửi lại và rời được sau ACK',async()=>{
 const r=await mount();try{
  r.write('D');r.press(label);await r.settle();await r.fail(0);
  assert.ok(r.child);assert.equal(r.unmounts,0);assert.equal(r.actions.includes('logout'),false);assert.match(text(r.parent.value),/Chưa rời bài/);
  assert.equal(JSON.parse(r.practice().props.storeOverride.getItem(draftKey(pipelineFixture().exam.id))).answers['mc-1'],'D');
  assert.equal(typeof r.practice().props.onRetrySave,'function');r.retry();await r.settle();assert.equal(r.requests.length,2);assert.ok(r.child);
  await r.ack(1);assert.ok(r.child,'Gửi lại không tự kích hoạt thao tác rời đã thất bại');r.press(label);await r.settle();
  assert.equal(r.requests.length,2,'Bản đã ACK không bị gửi dư khi bấm rời lại');assert.equal(r.child,null);assert.equal(r.unmounts,1);assert.equal(r.actions.filter(a=>a==='logout').length,label==='Thoát'?1:0);
 }finally{r.dispose();}
});
for(const label of ['Thoát','← Các buổi học'])await test(label+' khi máy chủ đã chấm bản cũ hướng dẫn nhận bản đó và không lặp gửi lại',async()=>{
 const r=await mount();try{
  r.write('D');r.press(label);await r.settle();await r.close(0);
  assert.ok(r.child);assert.equal(r.actions.includes('logout'),false);assert.match(text(r.parent.value),/Bấm Chấp nhận bản máy chủ đã chấm rồi mới rời bài/);
  assert.doesNotMatch(text(r.parent.value),/bấm Gửi lại bài đang giữ/);assert.equal(r.practice().props.onRetrySave,undefined);assert.equal(typeof r.practice().props.onAcceptClosed,'function');
  assert.equal(JSON.parse(r.practice().props.storeOverride.getItem(draftKey(pipelineFixture().exam.id))).answers['mc-1'],'D','Giữ RAM đến khi người học đồng ý');
  r.press(label);await r.settle();assert.equal(r.requests.length,1,'Lượt đã đóng không bị gửi lại');assert.ok(r.child);
  r.press('Chấp nhận bản máy chủ đã chấm');await r.settle();assert.equal(r.child,null);assert.equal(r.actions.includes('logout'),false,'Nhận bản không tự đăng xuất');
  r.press(label==='Thoát'?'Thoát':'← Các buổi học');await r.settle();assert.equal(r.requests.length,1);assert.equal(r.actions.filter(a=>a==='logout').length,label==='Thoát'?1:0);
 }finally{r.dispose();}
});
console.log(`${count}/${count} ca rời BTVN đạt. Mount hook cha/con thật với fetch giả; không phải kiểm trình duyệt hay dữ liệu thật.`);
