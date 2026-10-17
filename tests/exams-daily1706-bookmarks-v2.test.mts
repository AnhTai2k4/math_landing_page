import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {bookmarkKey,readBookmarks} from '../src/native/reader-bookmarks';
import type {ReaderFile} from '../src/native/reader-policy';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1706-BOOKMARK-V2-'),component='src/native/ReaderBookmarks.tsx';
const file:ReaderFile={id:'a'.repeat(24),sha256:'a'.repeat(64),path:'/learning-documents/'+'a'.repeat(64)+'.pdf',bytes:100,pages:60,observedContents:'Tài liệu giả để thử',sourceGrouping:1,sourceMetadataNeedsReview:false};
const encoded=(pages:number[],source=file)=>JSON.stringify({v:1,hash:source.sha256,pages});
function fixture(pages:number[]=[2,5,9]){
 const original=Object.getOwnPropertyDescriptor(globalThis,'window'),oldFetch=globalThis.fetch,values=new Map<string,string>([[bookmarkKey(file),encoded(pages)]]),listeners=new Set<(event:any)=>void>();
 let blocked=false,writes=0,network=0;
 const storage={getItem(key:string){if(blocked)throw Error('Bộ nhớ bị khóa giả');return values.get(key)??null;},setItem(key:string,value:string){writes++;if(blocked)throw Error('Bộ nhớ bị khóa giả');values.set(key,value);}};
 const windowStub={get localStorage(){if(blocked)throw Error('Không có quyền đọc giả');return storage;},addEventListener(name:string,fn:any){if(name==='storage')listeners.add(fn);},removeEventListener(name:string,fn:any){if(name==='storage')listeners.delete(fn);}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:windowStub});
 globalThis.fetch=(()=>{network++;throw Error('Không gọi mạng trong dấu trang');}) as any;
 const calls:number[]=[],props=(page=4,patch:any={})=>({file,page,shown:page,busy:false,onPage:(target:number)=>calls.push(target),...patch});
 return {values,storage,calls,props,get writes(){return writes;},get network(){return network;},block(value:boolean){blocked=value;},event(key:string|null=bookmarkKey(file),area:any=storage){listeners.forEach(fn=>fn({key,storageArea:area}));},restore(){globalThis.fetch=oldFetch;if(original)Object.defineProperty(globalThis,'window',original);else delete (globalThis as any).window;}};
}
const button=(tree:any,label:string)=>{const found=all(tree,n=>n.type==='button'&&text(n)===label);assert.equal(found.length,1,'Đúng một nút '+label);return found[0];};
const navButtons=(tree:any)=>all(tree,n=>n.type==='div'&&n.props.className==='reader-bookmarks-navigation').flatMap(group=>all(group,n=>n.type==='button'));

test('Trước, giữa, sau và đúng dấu: chọn dấu gần nhất, hiện trang đích, không vòng về đầu',()=>{
 for(const [page,previous,next] of [[1,null,2],[3,2,5],[10,9,null],[5,2,9],[2,null,5],[9,5,null]] as const){
  const f=fixture(),m=mount(component,f.props(page));try{
   const buttons=navButtons(m.tree);assert.equal(buttons.length,2);
   assert.equal(text(buttons[0]),'Dấu trang trước'+(previous===null?'':': trang '+previous));
   assert.equal(text(buttons[1]),'Dấu trang sau'+(next===null?'':': trang '+next));
   assert.equal(buttons[0].props.disabled,previous===null);assert.equal(buttons[1].props.disabled,next===null);
   buttons[0].props.onClick();m.draw();navButtons(m.tree)[1].props.onClick();
   assert.deepEqual(f.calls,[previous,next].filter(value=>value!==null));assert.equal(f.writes,0);assert.equal(f.network,0);
  }finally{m.unmount();f.restore();}
 }
});

test('Nhảy trực tiếp còn hoạt động, giữ danh sách và schema; focus nhóm sau khi chọn, thông báo có trang',()=>{
 const f=fixture(),raw=f.values.get(bookmarkKey(file)),m=mount(component,f.props(5));try{
  assert.equal(all(m.tree,n=>n.type==='button'&&n.props['aria-current']==='page').length,1);
  assert.equal(button(m.tree,'Trang 5').props['aria-label'],'Mở trang 5 đã đánh dấu');
  m.click('Trang 9');assert.deepEqual(f.calls,[9]);assert.equal(m.focused.type,'div');
  assert.match(text(m.tree),/Đã chọn trang 9 đã đánh dấu/);assert.match(text(m.tree),/không quay vòng/);
  assert.equal(f.values.get(bookmarkKey(file)),raw);assert.equal(f.writes,0);assert.equal(f.network,0);
  assert.deepEqual(readBookmarks(f.storage,file),{state:'ready',pages:[2,5,9],raw});
  const group=all(m.tree,n=>n.props?.className==='reader-bookmarks-navigation')[0];assert.equal(group.props.role,'group');assert.equal(group.props.tabIndex,-1);
  assert.ok(all(m.tree,n=>n.props?.role==='status'&&n.props['aria-live']==='polite').length);
 }finally{m.unmount();f.restore();}
});

test('PDF đang dựng hoặc shown chưa khớp: cả điều hướng nhanh, nhảy trực tiếp và toggle đều khóa',()=>{
 for(const patch of [{busy:true},{shown:3},{page:0,shown:0},{page:1.5,shown:1.5},{page:61,shown:61}]){
  const f=fixture(),m=mount(component,f.props(4,patch));try{
   const buttons=all(m.tree,n=>n.type==='button');assert.ok(buttons.length>=6);assert.ok(buttons.every(n=>n.props.disabled===true));
   for(const b of buttons)b.props.onClick?.();assert.deepEqual(f.calls,[]);assert.equal(f.writes,0);assert.equal(f.network,0);
   assert.match(text(m.tree),/Chờ trang .* hiển thị xong/);
  }finally{m.unmount();f.restore();}
 }
});

test('Danh sách rỗng, dữ liệu sai hoặc storage không truy cập: không suy ra đích, không sửa dữ liệu',()=>{
 const bad=['{broken',encoded([5,2]),encoded([0]),encoded([61]),encoded([2],{...file,sha256:'b'.repeat(64)}),JSON.stringify({v:2,hash:file.sha256,pages:[2]})];
 for(const raw of [encoded([]),...bad,null]){
  const f=fixture();if(raw===null)f.block(true);else f.values.set(bookmarkKey(file),raw);
  const m=mount(component,f.props());try{
   assert.ok(navButtons(m.tree).every(n=>n.props.disabled===true));navButtons(m.tree).forEach(n=>n.props.onClick());
   assert.deepEqual(f.calls,[]);assert.equal(f.writes,0);assert.equal(f.network,0);
   const state=all(m.tree,n=>n.type==='section')[0].props['data-bookmark-state'];assert.equal(state,raw===null?'unavailable':raw===encoded([])?'ready':'invalid');
   if(raw!==null)assert.equal(f.values.get(bookmarkKey(file)),raw);
  }finally{m.unmount();f.restore();}
 }
});

test('Storage đổi trước khi event tới: click đọc lại, giữ trang; danh sách mới cần bấm lại',()=>{
 const f=fixture(),m=mount(component,f.props(4));try{
  f.values.set(bookmarkKey(file),encoded([2,8]));m.click('Dấu trang sau: trang 5');
  assert.deepEqual(f.calls,[]);assert.match(text(m.tree),/chưa chuyển trang/);assert.ok(button(m.tree,'Dấu trang sau: trang 8'));
  m.click('Dấu trang sau: trang 8');assert.deepEqual(f.calls,[8]);assert.equal(f.writes,0);assert.equal(f.network,0);
  f.block(true);m.click('Dấu trang trước: trang 2');assert.deepEqual(f.calls,[8]);assert.ok(navButtons(m.tree).every(n=>n.props.disabled));
  f.block(false);m.click('Đọc lại dấu trang');m.click('Dấu trang trước: trang 2');assert.deepEqual(f.calls,[8,2]);assert.equal(f.writes,0);
 }finally{m.unmount();f.restore();}
});

test('Cross-tab đúng key/storage cập nhật dấu, clear làm rỗng, không đổi trang hoặc ghi storage',()=>{
 const f=fixture(),m=mount(component,f.props(4));try{
  f.values.set(bookmarkKey(file),encoded([1,7]));f.event('khóa-khác');m.draw();assert.ok(button(m.tree,'Dấu trang sau: trang 5'));
  f.event(bookmarkKey(file),{});m.draw();assert.ok(button(m.tree,'Dấu trang sau: trang 5'));
  f.event();m.draw();assert.ok(button(m.tree,'Dấu trang trước: trang 1'));assert.ok(button(m.tree,'Dấu trang sau: trang 7'));
  assert.match(text(m.tree),/trang đang xem được giữ nguyên/);assert.deepEqual(f.calls,[]);
  f.values.clear();f.event(null);m.draw();assert.match(text(m.tree),/Chưa có trang nào/);assert.ok(navButtons(m.tree).every(n=>n.props.disabled));
  assert.equal(f.writes,0);assert.equal(f.network,0);
 }finally{m.unmount();f.restore();}
});

test('Callback cũ sau đổi trang, busy, hash, file hoặc callback cha không nhảy nhầm và không toggle',()=>{
 const other={...file,id:'b'.repeat(24),sha256:'b'.repeat(64),path:'/learning-documents/'+'b'.repeat(64)+'.pdf'};
 for(const patch of [{page:6,shown:6},{busy:true},{shown:0},{file:other},{file:{...file,id:'b'.repeat(24)}},{onPage:()=>{throw Error('Callback cha mới không bị callback cũ gọi');}}]){
  const f=fixture(),m=mount(component,f.props(4));try{
   f.values.set(bookmarkKey(other),encoded([3,7],other));
   const old=[button(m.tree,'Dấu trang sau: trang 5'),button(m.tree,'Trang 2'),button(m.tree,'Đánh dấu trang 4')].map(n=>n.props.onClick);
   m.draw(f.props(4,patch));old.forEach(fn=>fn());assert.deepEqual(f.calls,[]);assert.equal(f.writes,0);assert.equal(f.network,0);
  }finally{m.unmount();f.restore();}
 }
 const f=fixture(),m=mount(component,f.props());const old=button(m.tree,'Dấu trang sau: trang 5').props.onClick;m.unmount();old();assert.deepEqual(f.calls,[]);assert.equal(f.writes,0);f.restore();
});

test('Toggle v1 giữ khóa hash, xung đột, giới hạn 50 và không làm mất dấu cũ',()=>{
 const f=fixture(),m=mount(component,f.props(4));try{
  m.click('Đánh dấu trang 4');assert.deepEqual(JSON.parse(f.values.get(bookmarkKey(file))!),{v:1,hash:file.sha256,pages:[2,4,5,9]});
  m.click('Bỏ đánh dấu trang 4');assert.deepEqual(JSON.parse(f.values.get(bookmarkKey(file))!).pages,[2,5,9]);
  f.values.set(bookmarkKey(file),encoded([1,7]));m.click('Đánh dấu trang 4');assert.equal(f.writes,2);assert.deepEqual(JSON.parse(f.values.get(bookmarkKey(file))!).pages,[1,7]);assert.match(text(m.tree),/chưa lưu thao tác này/);
 }finally{m.unmount();f.restore();}
 const g=fixture(Array.from({length:50},(_,i)=>i+1)),n=mount(component,g.props(51));try{
  n.click('Đánh dấu trang 51');assert.equal(g.writes,0);assert.match(text(n.tree),/Đã đủ 50 dấu trang/);assert.equal(JSON.parse(g.values.get(bookmarkKey(file))!).pages.length,50);
  n.click('Dấu trang trước: trang 50');assert.deepEqual(g.calls,[50]);assert.equal(g.writes,0);
 }finally{n.unmount();g.restore();}
});

test('SSR an toàn, CSS riêng navy/vàng có focus và mobile; không thêm mạng, dependency hoặc em dash',()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'window');delete (globalThis as any).window;
 try{
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(component).default,{file,page:4,shown:4,busy:false,onPage(){throw Error('SSR không được điều hướng');}}));
  assert.match(html,/Dấu trang trước/);assert.match(html,/Dấu trang sau/);assert.match(html,/data-bookmark-version="2"/);assert.match(html,/Không truy cập/);
 }finally{if(original)Object.defineProperty(globalThis,'window',original);}
 const code=readFileSync(join(root,component),'utf8');assert.doesNotMatch(code,/fetch\(|sessionStorage|setInterval|setTimeout|dangerouslySetInnerHTML|\u2014/);
 const css=readFileSync(join(root,'src/native/reader-bookmarks-v2.css'),'utf8');assert.match(css,/min-height:44px/);assert.match(css,/font-size:14px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/width:100%/);
 require('postcss').parse(css).walkRules((rule:any)=>assert.ok(rule.selector.startsWith('.native-ui .reader-bookmarks')));
});
finish({note:'9 nhóm kiểm hook/SSR/storage giả, không mạng hoặc dữ liệu học sinh thật; QA trực quan trình duyệt do root kiểm.'});
