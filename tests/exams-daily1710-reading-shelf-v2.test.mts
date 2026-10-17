import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {collectReading,sortReadingItems} from '../src/native/reading-shelf';
import {positionKey,type PositionStorage} from '../src/native/reader-position';
import {type ReaderFile} from '../src/native/reader-policy';
import {suite} from './exams-harness.mts';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1710-SHELF-'),file='src/native/ReadingShelf.tsx';
const files:ReaderFile[]=['Bài 10','Bài 2','Ánh xạ'].map((title,index)=>({id:String(index+1).repeat(24),sha256:String(index+1).repeat(64),path:'/learning-documents/'+String(index+1).repeat(64)+'.pdf',pages:[20,10,15][index],bytes:100,observedContents:title,sourceGrouping:1,sourceMetadataNeedsReview:index===2}));
const now=Date.now()-1000;
function storage(){
 const data=new Map<string,string>();let reads=0,writes=0;
 const store:PositionStorage={getItem(key){reads++;return data.get(key)??null;},setItem(){writes++;throw Error('Không cho ghi');},removeItem(){writes++;throw Error('Không cho xóa');}};
 const put=(index:number,page:number,at=now)=>data.set(positionKey(files[index]),JSON.stringify({v:1,hash:files[index].sha256,page,zoom:125,at}));
 return {store,data,put,get reads(){return reads;},get writes(){return writes;}};
}

test('Ba thứ tự có ý nghĩa, ổn định khi trùng khóa và không mutate đầu vào hoặc link',()=>{
 const s=storage();s.put(0,19,now-2);s.put(1,1,now);s.put(2,15,now-1);
 const items=collectReading(s.store,files,'?muc=grade-12&q=Đạo%20hàm',now).items,before=JSON.stringify(items),ids=(list:typeof items)=>list.map(x=>x.file.id);
 assert.deepEqual(ids(sortReadingItems(items,'recent')),[files[1].id,files[2].id,files[0].id]);
 assert.deepEqual(ids(sortReadingItems(items,'title')),[files[2].id,files[1].id,files[0].id]);
 assert.deepEqual(ids(sortReadingItems(items,'remaining')),[files[2].id,files[0].id,files[1].id]);
 for(const order of ['recent','title','remaining'] as const){const sorted=sortReadingItems(items,order);assert.notEqual(sorted,items);assert.ok(sorted.every(item=>items.includes(item)));for(const item of sorted){const url=new URL(item.href,'https://fixture.invalid');assert.equal(url.pathname,'/tai-lieu/'+item.file.id);assert.equal(url.searchParams.get('trang'),String(item.position.page));assert.equal(url.searchParams.get('zoom'),'125');assert.equal(url.searchParams.get('q'),'Đạo hàm');assert.equal(url.searchParams.get('muc'),'grade-12');}}
 assert.equal(JSON.stringify(items),before);assert.equal(s.writes,0);
 const tied=items.map(item=>({...item,position:{...item.position,at:now}}));assert.deepEqual(sortReadingItems(tied,'recent'),tied);
 assert.deepEqual(sortReadingItems(tied,'unexpected' as any),tied);
});

test('Đọc collection v2 giữ dedup, chọn link đầu trong scope, cảnh báo invalid/unavailable và không ghi',()=>{
 const s=storage();s.put(0,4);s.put(1,3);s.data.set(positionKey(files[2]),'{khong-hop-le');
 const alias={...files[0],id:'a'.repeat(24)},rows=[alias,...files],collection=collectReading(s.store,rows,'?muc=grade-11&q=Ví%20dụ',now);
 assert.equal(collection.items.length,2);assert.equal(collection.invalid,1);assert.equal(collection.items.find(x=>x.file.sha256===files[0].sha256)!.file.id,alias.id);
 assert.match(collection.items.find(x=>x.file.sha256===files[0].sha256)!.href,new RegExp('/tai-lieu/'+alias.id+'\\?'));
 assert.equal(collectReading(null,rows,'',now).unavailable,true);
 const broken={...s.store,getItem(){throw Error('Chặn đọc');}};assert.equal(collectReading(broken,rows,'',now).unavailable,true);
 s.put(1,3,now+1);assert.equal(collectReading(s.store,rows,'',now).invalid,2);assert.equal(s.writes,0);
});

function withWindow(fn:(s:ReturnType<typeof storage>,handlers:Map<string,Function>)=>void,unavailable=false){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),s=storage(),handlers=new Map<string,Function>();
 const fake={get localStorage(){if(unavailable)throw Error('Chặn localStorage');return s.store;},addEventListener:(name:string,fn:Function)=>handlers.set(name,fn),removeEventListener:(name:string,fn:Function)=>{if(handlers.get(name)===fn)handlers.delete(name);}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:fake});
 try{fn(s,handlers);}finally{if(previous)Object.defineProperty(globalThis,'window',previous);else delete (globalThis as any).window;}
}
const listTitles=(m:any)=>all(m.tree,n=>n.type==='h3').map(text);

test('Giao diện đổi sort, hiển thị đúng pages trừ page, giữ cảnh báo nguồn và link nguyên trạng',()=>withWindow(s=>{
 s.put(0,19,now-2);s.put(1,1,now);s.put(2,15,now-1);
 const m=mount(file,{files,search:'?muc=grade-12&q=Ví%20dụ'},'ReadingShelfContents','export {ReadingShelfContents};');try{
  m.draw();assert.deepEqual(listTitles(m),['Bài 2','Ánh xạ','Bài 10']);assert.match(text(m.tree),/0 trang phía sau vị trí đang lưu/);assert.match(text(m.tree),/1 trang phía sau vị trí đang lưu/);assert.match(text(m.tree),/9 trang phía sau vị trí đang lưu/);
  assert.match(text(m.tree),/không xác nhận em đã đọc xong/);assert.match(text(m.tree),/Nhãn\/lớp theo nguồn đang chờ đối chiếu/);
  const control=all(m.tree,n=>n.type==='select')[0];assert.equal(control.props.value,'recent');assert.equal(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===control.props.id).length,1);
  control.props.onChange({target:{value:'remaining'}});m.draw();assert.deepEqual(listTitles(m),['Ánh xạ','Bài 10','Bài 2']);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'title'}});m.draw();assert.deepEqual(listTitles(m),['Ánh xạ','Bài 2','Bài 10']);
  for(const link of all(m.tree,n=>n.props?.href)){const url=new URL(link.props.href,'https://fixture.invalid');assert.equal(url.searchParams.get('q'),'Ví dụ');assert.equal(url.searchParams.get('muc'),'grade-12');assert.equal(url.searchParams.get('zoom'),'125');}
  assert.equal(s.writes,0);
 }finally{m.unmount();}
}));

test('Storage event đúng scope refresh mà giữ sort, event khác không đọc lại, unmount gỡ listener',()=>withWindow((s,handlers)=>{
 s.put(0,2);s.put(1,1);const m=mount(file,{files,search:''},'ReadingShelfContents','export {ReadingShelfContents};');
 try{
  m.draw();const handler=handlers.get('storage')!;assert.ok(handler);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'remaining'}});m.draw();const reads=s.reads;
  handler({storageArea:{},key:positionKey(files[0])});handler({storageArea:s.store,key:'unrelated'});assert.equal(s.reads,reads);
  s.put(0,20);handler({storageArea:s.store,key:positionKey(files[0])});m.draw();assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'remaining');assert.equal(listTitles(m)[0],'Bài 10');assert.match(text(m.tree),/0 trang phía sau/);
  s.data.clear();handler({storageArea:s.store,key:null});m.draw();assert.equal(all(m.tree,n=>n.type==='select').length,0);assert.match(text(m.tree),/Chưa có vị trí đọc/);assert.equal(s.writes,0);
 }finally{m.unmount();}assert.equal(handlers.size,0);
}));

test('Empty, invalid và storage bị chặn luôn có thông báo, control không che trạng thái',()=>{
 withWindow(s=>{const m=mount(file,{files,search:''},'ReadingShelfContents','export {ReadingShelfContents};');try{m.draw();assert.match(text(m.tree),/Chưa có vị trí đọc/);assert.equal(all(m.tree,n=>n.type==='select').length,0);}finally{m.unmount();}});
 withWindow(s=>{s.data.set(positionKey(files[0]),'invalid');s.put(1,3);const m=mount(file,{files,search:''},'ReadingShelfContents','export {ReadingShelfContents};');try{m.draw();assert.match(text(m.tree),/Có 1 vị trí đọc không hợp lệ/);assert.equal(all(m.tree,n=>n.type==='select').length,1);}finally{m.unmount();}});
 withWindow(s=>{const m=mount(file,{files,search:''},'ReadingShelfContents','export {ReadingShelfContents};');try{m.draw();assert.match(text(m.tree),/Không truy cập được một phần hoặc toàn bộ/);assert.equal(all(m.tree,n=>n.type==='select').length,0);}finally{m.unmount();}},true);
});

test('SSR không đọc browser storage, scope đổi filter remount hợp lý, CSS 48px thắng native.css',()=>{
 const Component=load(file).default,html=require('react-dom/server').renderToStaticMarkup(React.createElement(Component,{files,search:''}));assert.match(html,/Đang đọc vị trí đã lưu/);assert.doesNotMatch(html,/<select/);
 const first=Component({files,search:''}),same=Component({files:[...files],search:''}),other=Component({files,search:'?q=khac'});assert.equal(first.key,same.key);assert.notEqual(first.key,other.key);
 const css=readFileSync(join(root,'src/native/reading-shelf-v2.css'),'utf8');assert.match(css,/min-height:48px/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/:focus-visible/);
 require('postcss').parse(css).walkRules((rule:any)=>assert.ok(rule.selector.startsWith('.native-ui .ne-reading-shelf')));
 for(const name of [file,'src/native/reading-shelf.ts'])assert.doesNotMatch(readFileSync(join(root,name),'utf8'),/\.setItem\(|\.removeItem\(|fetch\(|\u2014/);
});
finish({note:'6 nhóm kiểm dùng vị trí và browser storage giả; bảo toàn dữ liệu nguồn, không thay QA trình duyệt thật.'});
