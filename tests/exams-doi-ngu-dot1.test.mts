import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {createHomeworkSaver,type RemoteSaveStatus} from '../src/native/homework/remote-save';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import type {Draft} from '../src/native/exams/store';
import {routeMetadata} from '../src/migration/route-policy';
import {displayTitle} from '../src/components/display-text';
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json')),{buildSync}=require('esbuild');
let count=0;
async function test(name:string,fn:()=>unknown){await fn();console.log('ĐẠT '+(++count)+' '+name);}
const draft=(answer='A',submittedAt:number|null=null)=>({attemptId:'synthetic-attempt',answers:{q:answer},submittedAt} as unknown as Draft);
const response=(value:Draft)=>({draft:value,receipts:value.submittedAt===null?[]:[{attemptId:value.attemptId,submittedAt:value.submittedAt,score:0}]} as HomeworkState);
function remote(){
 const calls:{draft:Draft;resolve:(v:HomeworkState)=>void;reject:(e:Error)=>void}[]=[],statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
 const saver=createHomeworkSaver({delay:60000,send:d=>new Promise((resolve,reject)=>calls.push({draft:d,resolve,reject})),onStatus:s=>statuses.push(s),onSaved:s=>saved.push(s)});
 return {saver,calls,statuses,saved,last:()=>statuses.at(-1)!};
}
await test('BTVN chặn rời ngay khi còn debounce, chỉ sạch sau ACK mới nhất',async()=>{
 const r=remote();r.saver.update(draft());assert.equal(r.saver.pending(),true);assert.equal(r.calls.length,0);
 r.saver.retry();await Promise.resolve();assert.equal(r.calls.length,1);assert.equal(r.last().pending,true);
 r.calls[0].resolve(response(r.calls[0].draft));await r.saver.settled();assert.equal(r.saver.pending(),false);assert.equal(r.saved.length,1);assert.match(r.last().message,/Đã lưu bài trên máy chủ/);r.saver.dispose();
});
await test('ACK cũ không xóa pending hay thay đáp án mới; yêu cầu gửi tuần tự',async()=>{
 const r=remote();r.saver.update(draft('A'));r.saver.retry();await Promise.resolve();const first=r.saver.settled();
 r.saver.update(draft('B'));r.saver.retry();assert.equal(r.calls.length,1);
 r.calls[0].resolve(response(r.calls[0].draft));await first;await Promise.resolve();assert.equal(r.calls.length,2);
 assert.equal(r.saver.pending(),true);assert.equal(r.saved.length,0);assert.equal(r.last().pending,true);
 r.calls[1].resolve(response(r.calls[1].draft));await r.saver.settled();assert.equal(r.saved[0].draft!.answers.q,'B');assert.equal(r.saver.pending(),false);r.saver.dispose();
});
await test('Mất mạng giữ pending, gửi lại không tạo bản xác nhận giả',async()=>{
 const r=remote();r.saver.update(draft());r.saver.retry();await Promise.resolve();r.calls[0].reject(Error('Mạng thử bị ngắt'));await r.saver.settled();
 assert.equal(r.last().failed,true);assert.equal(r.saver.pending(),true);assert.equal(r.saved.length,0);
 r.saver.retry();await Promise.resolve();r.calls[1].resolve(response(r.calls[1].draft));await r.saver.settled();assert.equal(r.last().failed,false);assert.equal(r.saver.pending(),false);r.saver.dispose();
});
await test('ACK khác lượt bị từ chối; nộp/hết giờ từ máy chủ có hiệu lực cuối cùng',async()=>{
 const bad=remote();bad.saver.update(draft());bad.saver.retry();await Promise.resolve();bad.calls[0].resolve(response({...draft(),attemptId:'other'}));await bad.saver.settled();assert.equal(bad.saver.pending(),true);assert.equal(bad.last().failed,true);bad.saver.dispose();
 const r=remote();r.saver.update(draft());r.saver.retry();await Promise.resolve();const first=r.saver.settled();r.saver.update(draft('B'));r.saver.retry();
 r.calls[0].resolve(response(draft('A',123)));await first;await Promise.resolve();assert.equal(r.calls.length,2);assert.equal(r.saver.pending(),true);assert.equal(r.saved.length,0);
 r.calls[1].resolve(response(draft('A',123)));await r.saver.settled();assert.equal(r.saver.pending(),true);assert.equal(r.last().failed,true);assert.match(r.last().message,/Câu sửa sau đó không tính/);assert.equal(r.saved.length,0);r.saver.dispose();
});
await test('Nộp không đợi debounce; tháo component cố gửi RAM nhưng không gọi UI đã tháo',async()=>{
 const r=remote();r.saver.update(draft('A',123));await Promise.resolve();assert.equal(r.calls.length,1);r.calls[0].resolve(response(r.calls[0].draft));await r.saver.settled();r.saver.dispose();
 const leaving=remote();leaving.saver.update(draft());const before=leaving.statuses.length;leaving.saver.dispose();await Promise.resolve();assert.equal(leaving.calls.length,1);leaving.calls[0].resolve(response(leaving.calls[0].draft));await leaving.saver.settled();assert.equal(leaving.saved.length,0);assert.equal(leaving.statuses.length,before);
});
await test('Nộp cần biên nhận đúng lượt; flush bản đã ACK không gửi dư',async()=>{
 const r=remote();r.saver.update(draft('A',123));await Promise.resolve();
 r.calls[0].resolve({draft:draft('A',null),receipts:[]} as unknown as HomeworkState);await r.saver.settled();assert.equal(r.saver.pending(),true);assert.equal(r.last().failed,true);
 r.saver.retry();await Promise.resolve();r.calls[1].resolve({draft:draft('A',123),receipts:[]} as unknown as HomeworkState);await r.saver.settled();assert.equal(r.saver.pending(),true);assert.match(r.last().message,/biên nhận/);
 r.saver.retry();await Promise.resolve();r.calls[2].resolve(response(draft('A',123)));await r.saver.settled();assert.equal(r.saver.pending(),false);assert.equal(await r.saver.flush(),true);assert.equal(r.calls.length,3);r.saver.dispose();
});
await test('Máy chủ đóng bản cũ: giữ lỗi và RAM đến khi người học chọn bản đã chấm',async()=>{
 const r=remote();r.saver.update(draft('B',200));await Promise.resolve();r.calls[0].resolve(response(draft('A',123)));await r.saver.settled();
 assert.equal(r.saver.pending(),true);assert.equal(r.last().closed,true);assert.equal(r.saved.length,0);assert.match(r.last().message,/chưa được nhận/);
 assert.equal(r.saver.closed(),true);assert.equal(await r.saver.flush(),false);r.saver.retry();await r.saver.settled();assert.equal(r.calls.length,1,'Không gửi lại lượt đã đóng');assert.equal(r.saver.pending(),true);
 const closedMessage=r.last().message;r.saver.update(draft('C',201));assert.equal(r.last().closed,true);assert.equal(r.last().failed,true);assert.equal(r.last().saving,false);assert.equal(r.last().message,closedMessage,'Gõ thêm không làm mất thông báo máy chủ đã chấm');
 r.saver.acceptClosed();assert.equal(r.saver.pending(),false);assert.equal(r.saved[0].draft!.answers.q,'A');assert.match(r.last().message,/Phần sửa chưa được nhận không tính điểm/);r.saver.dispose();
});
await test('Phản hồi đóng của bản cũ vẫn báo lỗi và không gửi bản mới đang xếp hàng',async()=>{
 const r=remote();r.saver.update(draft('A'));r.saver.retry();await Promise.resolve();
 r.saver.update(draft('B'));r.saver.retry();r.calls[0].resolve(response(draft('C',123)));await r.saver.flush();
 assert.equal(r.calls.length,1);assert.equal(r.last().closed,true);assert.equal(r.last().failed,true);assert.equal(r.saver.pending(),true);assert.equal(r.saved.length,0);
 r.saver.acceptClosed();assert.equal(r.saver.pending(),false);assert.equal(r.saved[0].draft!.answers.q,'C');r.saver.dispose();
});
await test('Biên nhận lệch thời gian vẫn xác nhận đúng lượt có điểm hữu hạn',async()=>{
 const r=remote();r.saver.update(draft('A',105000));await Promise.resolve();
 r.calls[0].resolve({...response(draft('A',105000)),receipts:[{attemptId:'synthetic-attempt',submittedAt:100000,score:0}]} as HomeworkState);
 await r.saver.settled();assert.equal(r.saver.pending(),false);assert.equal(r.saved.length,1);assert.equal(r.last().failed,false);r.saver.dispose();
});
for(const score of [NaN,Infinity,undefined])await test('Biên nhận không có điểm hữu hạn vẫn giữ bản chưa xác nhận: '+String(score),async()=>{
 const r=remote();r.saver.update(draft('A',123));await Promise.resolve();
 r.calls[0].resolve({...response(draft('A',123)),receipts:[{attemptId:'synthetic-attempt',submittedAt:123,score}]} as HomeworkState);
 await r.saver.settled();assert.equal(r.saver.pending(),true);assert.equal(r.saved.length,0);assert.match(r.last().message,/biên nhận/);r.saver.dispose();
});

class Runtime{
 slots:any[]=[];index=0;changed=false;effects:(()=>void)[]=[];value:any;
 constructor(public fn:()=>any){}
 same(a:any,b:any){return a&&b&&a.length===b.length&&a.every((v:any,i:number)=>Object.is(v,b[i]));}
 state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return[this.slots[i].value,(v:any)=>{const next=typeof v==='function'?v(this.slots[i].value):v;if(!Object.is(next,this.slots[i].value)){this.slots[i].value=next;this.changed=true;}}];}
 ref(value:any){const i=this.index++;return this.slots[i]??(this.slots[i]={current:value});}
 memo(fn:()=>any,deps:any){const i=this.index++;if(!this.slots[i]||!this.same(this.slots[i].deps,deps))this.slots[i]={value:fn(),deps};return this.slots[i].value;}
 effect(fn:any,deps:any){const i=this.index++,old=this.slots[i];if(!old||!this.same(old.deps,deps)){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
 flush(){for(let n=0;n<30;n++){(globalThis as any).__doiNguRuntime=this;this.index=0;this.changed=false;this.value=this.fn();this.effects.splice(0).forEach(f=>f());if(!this.changed)return this.value;}throw Error('Hook không ổn định');}
 dispose(){this.slots.forEach(s=>s?.cleanup?.());}
}
function load(file:string){
 const fixture=join(root,'tests/fixtures/doi-ngu-react.mts');
 const code=buildSync({entryPoints:[join(root,file)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',alias:{react:fixture,'react/jsx-runtime':fixture,'react-dom':fixture},external:['../components/MtmReferenceLibrary','./NativePdfReader','./NativeCourses'],loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
 const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id==='./NativeCourses'?{Pending:'pending'}:require(id),mod,mod.exports);return mod.exports;
}
const all=(t:any,p:(n:any)=>boolean):any[]=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(n=>all(n,p)):[...(p(t)?[t]:[]),...all(t.props?.children,p)];
const find=(t:any,p:(n:any)=>boolean)=>all(t,p)[0];
const text=(t:any):string=>t==null||typeof t==='boolean'?'':Array.isArray(t)?t.map(text).join(''):typeof t==='object'?text(t.props?.children):String(t);
class Events extends EventTarget{removeEventListener(t:string,l:any,o?:any){super.removeEventListener(t,l,typeof o==='boolean'?{capture:o}:o);}}
const win=new Events(),doc=new Events(),local=new Map<string,string>(),session=new Map<string,string>();
const storage=(map:Map<string,string>)=>({getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>map.set(k,v),removeItem:(k:string)=>map.delete(k)});
const location=new URL('https://local.test/so-tay');let confirmCount=0,approve=false,focused='';
const history={pushState(_s:any,_t:any,url:string){location.href=new URL(url,location.href).href;},replaceState(_s:any,_t:any,url:string){location.href=new URL(url,location.href).href;}};
Object.assign(globalThis,{window:win,document:Object.assign(doc,{body:{},querySelector:()=>null,getElementById:(id:string)=>({focus(){focused=id;}})}),location,history,localStorage:storage(local),sessionStorage:storage(session),confirm:()=>{confirmCount++;return approve;},requestAnimationFrame:(fn:()=>void)=>fn(),addEventListener:win.addEventListener.bind(win),removeEventListener:win.removeEventListener.bind(win)});
const {default:Notebook}=load('src/migration/Notebook.tsx');
const selectedDate=(tree:any)=>find(tree,n=>n.type==='button'&&n.props['aria-pressed']===true).props['aria-label'].slice(0,10);
await test('Sổ tay giữ mục tiêu khi đổi ngày cùng tháng, hỏi và cho hủy khi đổi tháng',()=>{
 local.clear();session.clear();confirmCount=0;approve=false;const r=new Runtime(Notebook);r.flush();const date=selectedDate(r.value);
 find(r.value,n=>n.type==='textarea').props.onChange({target:{value:'Mục tiêu thử chưa lưu'}});r.flush();
 const days=()=>all(r.value,n=>n.type==='button'&&/^\d{4}-\d{2}-\d{2}/.test(n.props['aria-label']??''));
 days().find(n=>n.props['aria-label'].startsWith(date.slice(0,7))&&!n.props['aria-pressed'])!.props.onClick();r.flush();assert.equal(find(r.value,n=>n.type==='textarea').props.value,'Mục tiêu thử chưa lưu');assert.equal(confirmCount,0);
 const outside=days().find(n=>!n.props['aria-label'].startsWith(date.slice(0,7)))!;outside.props.onClick();r.flush();assert.equal(confirmCount,1);assert.equal(find(r.value,n=>n.type==='textarea').props.value,'Mục tiêu thử chưa lưu');
 approve=true;outside.props.onClick();r.flush();assert.equal(find(r.value,n=>n.type==='textarea').props.value,'');assert.equal(confirmCount,2);r.dispose();
});
await test('Sổ tay không bỏ phần sửa việc A khi hủy chọn sửa việc B',()=>{
 local.clear();session.clear();const d=new Date(),date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
 local.set('mtm:guest-notebook:v1',JSON.stringify({version:1,days:{[date]:[{id:'a',text:'Việc A',minutes:30,done:false},{id:'b',text:'Việc B',minutes:20,done:false}]},goals:{}}));
 const r=new Runtime(Notebook);r.flush();find(r.value,n=>n.props?.['aria-label']==='Sửa việc Việc A').props.onClick();r.flush();
 find(r.value,n=>n.type==='input'&&n.props.autoFocus).props.onChange({target:{value:'A đang sửa'}});r.flush();approve=false;find(r.value,n=>n.props?.['aria-label']==='Sửa việc Việc B').props.onClick();r.flush();assert.equal(find(r.value,n=>n.type==='input'&&n.props.autoFocus).props.value,'A đang sửa');
 approve=true;find(r.value,n=>n.props?.['aria-label']==='Sửa việc Việc B').props.onClick();r.flush();assert.equal(find(r.value,n=>n.type==='input'&&n.props.autoFocus).props.value,'Việc B');r.dispose();
});
await test('Tab Hướng dẫn có một điểm Tab và hỗ trợ mũi tên/Home/End',()=>{
 location.href='https://local.test/huong-dan';const {default:Guide}=load('src/migration/Guide.tsx'),r=new Runtime(Guide);r.flush();
 const tabs=()=>all(r.value,n=>n.props?.role==='tab');const key=(k:string)=>{let prevented=false;tabs().find(n=>n.props.tabIndex===0).props.onKeyDown({key:k,preventDefault(){prevented=true;}});r.flush();assert.equal(prevented,true);};
 assert.equal(tabs().filter(n=>n.props.tabIndex===0).length,1);key('ArrowRight');assert.equal(focused,'mg-tab-ph');assert.equal(location.search,'?cho=phu-huynh');key('Home');assert.equal(focused,'mg-tab-hs');key('End');assert.equal(focused,'mg-tab-ph');key('ArrowLeft');assert.equal(focused,'mg-tab-hs');assert.equal(find(r.value,n=>n.props?.role==='tabpanel').props.tabIndex,0);r.dispose();
});
await test('Guard nhận đổi bài và rời danh mục cùng /luyen-tap, giữ query/hash an toàn',()=>{
 location.href='https://local.test/luyen-tap?nhom=10&id=de-a';let dirty=true;const {useUnsavedGuard}=load('src/native/exams/navigation-guard.ts'),{navigate}=load('src/migration/navigation.tsx');
 const r=new Runtime(()=>useUnsavedGuard(()=>dirty));r.flush();const before=location.href;
 navigate('/luyen-tap?nhom=10&id=de-b');r.flush();assert.equal(location.href,before);assert.ok(r.value);r.value.props.onCancel();r.flush();
 navigate('/luyen-tap?nhom=10');r.flush();assert.equal(location.href,before);assert.ok(r.value);r.value.props.onCancel();r.flush();
 navigate('/luyen-tap?nhom=11&id=de-a#cau-2');r.flush();assert.equal(r.value,null);assert.match(location.href,/nhom=11/);
 const unload=new Event('beforeunload',{cancelable:true});win.dispatchEvent(unload);assert.equal(unload.defaultPrevented,true);
 dirty=false;navigate('/luyen-tap?luot=lich-su');r.flush();assert.equal(r.value,null);assert.match(location.href,/luot=lich-su/);r.dispose();
});
await test('BTVN chỉ gắn guard máy chủ, Back hai lần không làm lệch URL bài đang giữ',()=>{
 location.href='https://local.test/btvn';const {useUnsavedGuard}=load('src/native/exams/navigation-guard.ts');
 const localGuard=new Runtime(()=>useUnsavedGuard(()=>false,undefined,false));localGuard.flush();
 const remoteGuard=new Runtime(()=>useUnsavedGuard(()=>true));remoteGuard.flush();
 location.href='https://local.test/';win.dispatchEvent(new Event('popstate'));localGuard.flush();remoteGuard.flush();assert.equal(location.pathname,'/btvn');assert.ok(remoteGuard.value);
 (doc as any).querySelector=()=>({});location.href='https://local.test/';win.dispatchEvent(new Event('popstate'));remoteGuard.flush();assert.equal(location.pathname,'/btvn');assert.equal(localGuard.value,null);
 (doc as any).querySelector=()=>null;remoteGuard.value.props.onCancel();remoteGuard.flush();assert.equal(remoteGuard.value,null);assert.equal(location.pathname,'/btvn');localGuard.dispose();remoteGuard.dispose();
});
await test('Kho tham khảo chỉ mount sau mở, đóng/mở giữ bộ lọc; hash mở trực tiếp',()=>{
 const {default:Resources}=load('src/native/NativeResources.tsx');location.href='https://local.test/tai-lieu';
 const render=()=>Resources({kind:'documents',pathname:'/tai-lieu',search:''}),r=new Runtime(render);r.flush();
 const details=()=>find(r.value,n=>n.type==='details');assert.equal(all(details(),n=>n.type?.lazy).length,0);
 details().props.onToggle({currentTarget:{open:true}});r.flush();assert.equal(all(details(),n=>n.type?.lazy).length,1);
 details().props.onToggle({currentTarget:{open:false}});r.flush();assert.equal(all(details(),n=>n.type?.lazy).length,1);r.dispose();
 location.hash='#tai-lieu-tham-khao';const direct=new Runtime(render);direct.flush();assert.equal(all(direct.value,n=>n.type?.lazy).length,1);direct.dispose();
});
await test('Metadata mô tả đúng lưu trình duyệt và tài liệu công khai, giữ noindex local',()=>{
 assert.match(routeMetadata('/thi-thu','localhost').description,/trình duyệt/);assert.match(routeMetadata('/tai-lieu','localhost').description,/công khai/);assert.equal(routeMetadata('/btvn','localhost').robots,'noindex, nofollow');assert.equal(routeMetadata('/thi-thu','localhost').robots,'noindex, follow');
});
await test('Tiêu đề UI không có dấu gạch dài, đối tượng đề nguồn được giữ nguyên',()=>{
 const source={title:'Toán 11 \u2014 Giữa kỳ I \u2014 mã 101',versionHash:'original'};
 const before=JSON.stringify(source);assert.equal(displayTitle(source.title),'Toán 11 · Giữa kỳ I · mã 101');assert.equal(JSON.stringify(source),before);
 const {default:Header}=load('src/native/exams/AttemptHeader.tsx');const tree=Header({exam:{...source,grade:11,period:'GK1',questions:[],durationMinutes:90},catalogUrl:'/thi-thu'});
 assert.ok(text(tree).includes('Toán 11 · Giữa kỳ I · mã 101'));assert.ok(!text(tree).includes('\u2014'));
});
console.log(`${count}/${count} ca đợt 1 đạt. Runtime hook và transport tổng hợp, không phải trình duyệt.`);
