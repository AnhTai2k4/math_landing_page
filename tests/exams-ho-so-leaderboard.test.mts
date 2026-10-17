import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeLeaderboard.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const render=(node:any)=>renderToStaticMarkup(node);
const row={rank:1,fullName:'Học sinh thử hồ sơ',className:'Lớp thử',school:'Trường thử ban đầu',avatar:'prism',photo:'',score:8.5,submitted:2,total:3,phone:'KHÔNG ĐƯỢC HIỆN',studentId:'MÃ KHÔNG ĐƯỢC HIỆN'};
const photo='data:image/jpeg;base64,/9j/2Q==';

let runtime:Runtime;
class Runtime{
 slots:any[]=[];index=0;changed=false;effects:Function[]=[];tree:any;
 state(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={value:typeof initial==='function'?initial():initial};return [this.slots[i].value,(next:any)=>{const value=typeof next==='function'?next(this.slots[i].value):next;if(!Object.is(value,this.slots[i].value)){this.slots[i].value=value;this.changed=true;}}];}
 ref(initial:any){const i=this.index++;if(!this.slots[i])this.slots[i]={current:initial};return this.slots[i];}
 effect(fn:Function,deps:any[]){const i=this.index++,old=this.slots[i];if(!old||deps.some((value,j)=>!Object.is(value,old.deps[j]))){this.slots[i]={deps,cleanup:old?.cleanup};this.effects.push(()=>{old?.cleanup?.();this.slots[i].cleanup=fn();});}}
 renderOnly(){runtime=this;this.index=0;this.changed=false;return this.tree=Board({});}
 flush(){for(let n=0;n<20;n++){runtime=this;this.index=0;this.changed=false;this.tree=Board({});this.effects.splice(0).forEach(fn=>fn());if(!this.changed)return this.tree;}throw Error('Hook không ổn định');}
 dispose(){this.slots.forEach(slot=>slot?.cleanup?.());}
}
const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,useState:(initial:any)=>runtime.state(initial),useRef:(initial:any)=>runtime.ref(initial),useEffect:(fn:Function,deps:any[])=>runtime.effect(fn,deps)}:require(id),mod,mod.exports);
const {default:Board,RankContent}=mod.exports;
let html=render(React.createElement(RankContent,{rows:[row],status:'ready'}));
for(const text of [row.fullName,row.className,row.school,'r104-avatar-prism'])assert.ok(html.includes(text));
assert.doesNotMatch(html,/KHÔNG ĐƯỢC HIỆN/);
html=render(React.createElement(RankContent,{rows:[{...row,photo}],status:'ready',own:true}));
assert.ok(html.includes('src="'+photo+'"'));assert.ok(html.includes(row.school));
html=render(React.createElement(RankContent,{rows:[{...row,avatar:null,photo:null,school:null}],status:'ready'}));
assert.match(html,/r104-avatar-orbit/);assert.ok(!html.includes('<img'));

const previousWindow=(globalThis as any).window,previousDocument=(globalThis as any).document,previousFetch=globalThis.fetch;
const win=new EventTarget(),doc=Object.assign(new EventTarget(),{visibilityState:'hidden'}),requests:{url:string;init:any}[]=[];
Object.assign(globalThis,{window:win,document:doc});
let current={...row},loggedIn=true,queuedOwn:Promise<any>|null=null;
globalThis.fetch=async(url:any,init:any)=>{requests.push({url:String(url),init});if(String(url)==='/api/xep-hang-cua-em'&&queuedOwn){const response=queuedOwn;queuedOwn=null;return response;}return String(url)==='/api/xep-hang-cua-em'?{ok:loggedIn,status:loggedIn?200:401,json:async()=>({row:current})}:{ok:true,json:async()=>({enabled:true,rows:[current,{...current,rank:2},{...current,rank:3}]})} as any;};
const turn=async()=>{await new Promise(resolve=>setTimeout(resolve,0));return render(runtime.flush());};
try{
 runtime=new Runtime();runtime.flush();html=await turn();
 assert.equal(requests.length,2);assert.ok(requests.every(request=>request.init.cache==='no-store'));
 assert.equal((html.match(/r104-avatar-prism/g)||[]).length,7,'Ba ảnh podium, ba ảnh top 10 và ảnh hạng cá nhân dùng dữ liệu cùng hàng.');
 assert.ok(html.includes(row.school));
 current={...current,school:'Trường thử đã lưu',avatar:'spark',photo};
 win.dispatchEvent(new Event('mtm:student-appearance'));runtime.flush();html=await turn();
 assert.equal(requests.length,4);assert.ok(html.includes(current.school));assert.ok(!html.includes(row.school));assert.ok(html.includes('src="'+photo+'"'));
 const storage=new Event('storage');Object.assign(storage,{key:'mtm:appearance:refresh:v2',newValue:JSON.stringify({kind:'profile',nonce:'fixture'})});
 win.dispatchEvent(storage);runtime.flush();await turn();assert.equal(requests.length,6);
 win.dispatchEvent(new Event('focus'));runtime.flush();await turn();assert.equal(requests.length,8);
 doc.dispatchEvent(new Event('visibilitychange'));runtime.flush();await turn();assert.equal(requests.length,8,'Tab đang ẩn không tải lại.');
 doc.visibilityState='visible';doc.dispatchEvent(new Event('visibilitychange'));runtime.flush();await turn();assert.equal(requests.length,10);
 loggedIn=false;win.dispatchEvent(new Event('mtm:student-session'));runtime.flush();html=await turn();
 assert.equal(requests.length,12);assert.ok(html.includes('Vào BTVN để xem điểm và hạng của em.'));
 // Response của phiên cũ về sau event logout nhưng trước effect cleanup cũng phải bị loại.
 let releaseOld!:(response:any)=>void;queuedOwn=new Promise(resolve=>releaseOld=resolve);loggedIn=true;
 win.dispatchEvent(new Event('mtm:student-appearance'));runtime.flush();assert.equal(requests.length,14);
 loggedIn=false;win.dispatchEvent(new Event('mtm:student-session'));
 releaseOld({ok:true,status:200,json:async()=>({row:{...current,fullName:'Tên thử từ phiên cũ'}})});
 await new Promise(resolve=>setTimeout(resolve,0));html=render(runtime.renderOnly());
 assert.ok(html.includes('Vào BTVN để xem điểm và hạng của em.'));assert.ok(!html.includes('Tên thử từ phiên cũ'));
 runtime.flush();await turn();assert.equal(requests.length,16);
 const beforeDispose=requests.length;runtime.dispose();win.dispatchEvent(new Event('mtm:student-appearance'));win.dispatchEvent(new Event('focus'));doc.dispatchEvent(new Event('visibilitychange'));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(requests.length,beforeDispose);
}finally{runtime?.dispose();globalThis.fetch=previousFetch;if(previousWindow===undefined)delete (globalThis as any).window;else (globalThis as any).window=previousWindow;if(previousDocument===undefined)delete (globalThis as any).document;else (globalThis as any).document=previousDocument;}
console.log('Đạt hồ sơ bảng xếp hạng: ảnh, avatar, trường trên podium/top 10/hạng cá nhân; lưu và đổi phiên cập nhật cùng tab/cross-tab; no-store; không render số điện thoại hoặc mã.');
