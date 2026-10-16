import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {notebookRhythm} from '../src/migration/notebook-rhythm';
import {NOTEBOOK_KEY,type Store} from '../src/migration/notebook-store';
import {BEFORE_NAVIGATION_EVENT} from '../src/migration/navigation';
import {all,mount,text,root} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('D23-RHYTHM-'),file='src/migration/NotebookRhythm.tsx';
const tasks=(done=true)=>[{id:'fake-task',text:'Việc GIẢ',minutes:30,done}];
const marked=(keys:string[]):Store['days']=>Object.fromEntries(keys.map(key=>[key,tasks()]));
const props=(days:Store['days']={},onSelectDay=(_key:string)=>true)=>({days,today:'2026-10-16',selectedDate:'2026-10-16',onSelectDay});
const localKey=(date:Date)=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');

test('Rỗng: đúng 7 ngày gồm hôm nay, không đếm kế hoạch hoặc phút là hoàn thành',()=>{
 const days={'2026-10-16':tasks(false),'2026-10-15':[]},before=JSON.stringify(days),result=notebookRhythm(days,'2026-10-16');
 assert.deepEqual({current:result.current,best:result.best,total:result.total,weekCount:result.weekCount},{current:0,best:0,total:0,weekCount:0});
 assert.deepEqual(result.week.map(day=>day.key),['2026-10-10','2026-10-11','2026-10-12','2026-10-13','2026-10-14','2026-10-15','2026-10-16']);
 assert.equal(JSON.stringify(days),before);
});

test('Mỗi ngày một lần, bỏ tương lai và khóa ngày sai, tính best qua khoảng nghỉ',()=>{
 const days={...marked(['2026-10-01','2026-10-02','2026-10-03','2026-10-10','2026-10-15','2026-10-16','2026-10-17','2026-10-18','2026-02-30']),bad:tasks()};
 days['2026-10-16']=[...tasks(),{...tasks()[0],id:'fake-task-2'}];
 const result=notebookRhythm(days,'2026-10-16');
 assert.equal(result.current,2);assert.equal(result.best,3);assert.equal(result.total,6);assert.equal(result.weekCount,3);
 assert.ok(!result.week.some(day=>day.key>'2026-10-16'));
});

test('Chuỗi hiện tại có thể kết thúc hôm qua, hết chuỗi khi bỏ cả hôm qua lẫn hôm nay',()=>{
 const days=marked(['2026-10-12','2026-10-13','2026-10-14','2026-10-15']);
 assert.equal(notebookRhythm(days,'2026-10-16').current,4);
 assert.equal(notebookRhythm(days,'2026-10-17').current,0);
 assert.equal(notebookRhythm(days,'2026-10-17').best,4);
});

test('Lịch qua tháng, năm nhuận, năm thường và ranh giới năm không mất ngày',()=>{
 for(const [keys,today] of [
  [['2024-02-28','2024-02-29','2024-03-01'],'2024-03-01'],
  [['2000-02-28','2000-02-29','2000-03-01'],'2000-03-01'],
  [['1900-02-28','1900-03-01','1900-03-02'],'1900-03-02'],
  [['2025-12-31','2026-01-01','2026-01-02'],'2026-01-02'],
  [['2026-03-07','2026-03-08','2026-03-09'],'2026-03-09'],
 ] as const){const result=notebookRhythm(marked([...keys]),today);assert.equal(result.current,3);assert.equal(result.best,3);assert.equal(result.week.length,7);assert.equal(result.week.at(-1)?.key,today);}
 assert.equal(notebookRhythm(marked(['1900-02-29','1900-03-01']),'1900-03-01').current,1);
 assert.throws(()=>notebookRhythm({},'2026-02-30'),/không hợp lệ/);
});

test('Mục tiêu 3, 5, 7 ngày dùng RAM; chọn ngày chuyển callback, không tự sửa dữ liệu',()=>{
 const days=marked(['2026-10-14','2026-10-15','2026-10-16']),before=JSON.stringify(days),selected:string[]=[];
 const config=props(days,key=>{selected.push(key);return false;}),m=mount(file,config);
 try{
  assert.match(text(m.tree),/Đã đánh dấu 3\/3 ngày/);assert.match(text(m.tree),/không lưu vào trình duyệt/);
  m.click('5 ngày');assert.match(text(m.tree),/Đã đánh dấu 3\/5 ngày/);
  assert.equal(all(m.tree,node=>node.type==='button'&&node.props['aria-pressed']&&text(node)==='5 ngày').length,1);
  m.click('7 ngày');assert.match(text(m.tree),/Đã đánh dấu 3\/7 ngày/);
  const day=all(m.tree,node=>node.type==='button'&&node.props['aria-label']?.startsWith('Mở kế hoạch ngày 15/10/2026'))[0];day.props.onClick();m.draw();
  assert.deepEqual(selected,['2026-10-15']);assert.equal(JSON.stringify(days),before);
  assert.equal(all(m.tree,node=>node.type==='button'&&node.props['aria-label']?.startsWith('Mở kế hoạch ngày')).length,7);
  m.draw({...config,days:{...days,'2026-10-16':tasks(false)}});assert.match(text(m.tree),/Đã đánh dấu 2\/7 ngày/);
 }finally{m.unmount();}
 const reopened=mount(file,config);try{assert.match(text(reopened.tree),/Đã đánh dấu 3\/3 ngày/);}finally{reopened.unmount();}
});

test('Huy hiệu theo best thật của dữ liệu tự đánh dấu, tương lai không mở mốc 30',()=>{
 const keys=Array.from({length:30},(_,i)=>new Date(Date.UTC(2026,8,17+i)).toISOString().slice(0,10));
 const m=mount(file,props(marked(keys)));try{
  assert.equal(all(m.tree,node=>node.type==='li'&&node.props.className==='is-reached').length,3);
  assert.match(text(m.tree),/chưa xác minh việc học hay thời gian học thực tế/);
  m.draw(props(marked([...keys.slice(1), '2026-10-17'])));
  assert.equal(all(m.tree,node=>node.type==='li'&&node.props.className==='is-reached').length,2);
  assert.match(text(m.tree),/Mốc 30 ngày: để khám phá/);
 }finally{m.unmount();}
});

test('Bản lưu lỗi có thông báo chưa tính được, không dựng số 0 hay nút ngày',()=>{
 const m=mount(file,{...props(),unavailable:true});try{
  assert.match(text(m.tree),/Chưa tính được nhịp học vì bản lưu sổ tay đang lỗi/);
  assert.equal(all(m.tree,node=>node.type==='button').length,0);
  assert.equal(all(m.tree,node=>node.type==='dd').length,0);
 }finally{m.unmount();}
});

test('Notebook dùng callback gốc: từ chối giữ nháp, đồng ý mới chuyển ngày và bỏ nháp',()=>{
 withNotebookFixture(({setConfirm,getConfirmCalls,primary,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const today=localKey(new Date()),previous=new Date();previous.setDate(previous.getDate()-1);const yesterday=localKey(previous);
   const title=()=>all(m.tree,node=>node.type==='input'&&node.props.required)[0];
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   title().props.onChange({target:{value:'Việc GIẢ đang gõ'}});m.draw();setConfirm(false);
   assert.equal(rhythm().props.onSelectDay(yesterday),false);m.draw();
   assert.equal(rhythm().props.selectedDate,today);assert.equal(title().props.value,'Việc GIẢ đang gõ');assert.equal(getConfirmCalls(),1);
   setConfirm(true);assert.equal(rhythm().props.onSelectDay(yesterday),true);m.draw();
   assert.equal(rhythm().props.selectedDate,yesterday);assert.equal(title().props.value,'');assert.equal(getConfirmCalls(),2);
   assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
  }finally{m.unmount();}
 });
});

test('Notebook cập nhật nhịp ngay khi đánh dấu hoặc bỏ đánh dấu việc, không schema mới',()=>{
 withNotebookFixture(({primary})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   const checkbox=()=>all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0];
   assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,0);
   checkbox().props.onChange({target:{checked:true}});m.draw();assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,1);
   checkbox().props.onChange({target:{checked:false}});m.draw();assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,0);
   assert.deepEqual(Object.keys(JSON.parse(primary.getItem(NOTEBOOK_KEY)!)).sort(),['days','goals','version']);
  }finally{m.unmount();}
 });
});

test('Nguồn lỗi ở thẻ khác ẩn nhịp, chặn ghi và nhập; bản hợp lệ khôi phục rồi mới ghi',()=>{
 withNotebookFixture(({primary,emitStorage})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   const importer=()=>all(m.tree,node=>node.type?.name==='NotebookImport')[0];
   const checkbox=()=>all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0];
   emitStorage('{JSON GIẢ bị lỗi');m.draw();
   assert.equal(rhythm().props.unavailable,true);assert.equal(importer().props.blocked,true);
   const hidden=mount(file,rhythm().props);try{assert.equal(all(hidden.tree,node=>node.type==='dd').length,0);assert.match(text(hidden.tree),/Chưa tính được nhịp học/);}finally{hidden.unmount();}
   checkbox().props.onChange({target:{checked:true}});m.draw();
   assert.equal(primary.getItem(NOTEBOOK_KEY),'{JSON GIẢ bị lỗi');assert.equal(primary.getWrites(),0);
   const restored=JSON.stringify({version:1,days:marked([localKey(new Date())]),goals:{}});
   emitStorage(restored);m.draw();
   assert.equal(rhythm().props.unavailable,false);assert.equal(importer().props.blocked,false);assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,1);
   checkbox().props.onChange({target:{checked:false}});m.draw();
   assert.equal(primary.getWrites(),1);assert.equal(JSON.parse(primary.getItem(NOTEBOOK_KEY)).days[localKey(new Date())][0].done,false);
  }finally{m.unmount();}
 });
});

test('Lỗi nguồn lúc mở trang được xóa khi nhận bản hợp lệ, không khóa vĩnh viễn bằng initial.error',()=>{
 withNotebookFixture(({primary,emitStorage,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   assert.equal(rhythm().props.unavailable,true);
   emitStorage(savedRaw);m.draw();assert.equal(rhythm().props.unavailable,false);
   all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
   assert.equal(primary.getWrites(),1);assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,1);
  }finally{m.unmount();}
 },'{JSON GIẢ lỗi ban đầu');
});

test('Đang gõ giữ nguyên nháp khi nguồn lỗi rồi đổi hợp lệ; không gắn số liệu RAM cũ thành hiện hành',()=>{
 withNotebookFixture(({primary,emitStorage,savedRaw,session})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   const title=()=>all(m.tree,node=>node.type==='input'&&node.props.required)[0];
   const checkbox=()=>all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0];
   title().props.onChange({target:{value:'Nháp GIẢ đang gõ'}});m.draw();
   const draftRaw=session.getItem('mtm:guest-notebook:draft:v1');
   emitStorage('{JSON GIẢ lỗi');m.draw();assert.equal(rhythm().props.unavailable,true);assert.equal(title().props.value,'Nháp GIẢ đang gõ');
   const changed=JSON.stringify({version:1,days:marked([localKey(new Date())]),goals:{}});
   emitStorage(changed);m.draw();
   assert.equal(rhythm().props.unavailable,true);assert.match(rhythm().props.unavailableMessage,/thẻ khác/);assert.equal(title().props.value,'Nháp GIẢ đang gõ');assert.equal(session.getItem('mtm:guest-notebook:draft:v1'),draftRaw);
   assert.equal(notebookRhythm(rhythm().props.days,rhythm().props.today).current,0);
   const hidden=mount(file,rhythm().props);try{assert.equal(all(hidden.tree,node=>node.type==='dd').length,0);assert.match(text(hidden.tree),/Nhịp học đang chờ đối chiếu/);assert.doesNotMatch(text(hidden.tree),/bản lưu sổ tay đang lỗi/);}finally{hidden.unmount();}
   checkbox().props.onChange({target:{checked:true}});m.draw();assert.equal(primary.getItem(NOTEBOOK_KEY),changed);assert.equal(primary.getWrites(),0);
   emitStorage(savedRaw);m.draw();assert.equal(rhythm().props.unavailable,false);assert.equal(title().props.value,'Nháp GIẢ đang gõ');
  }finally{m.unmount();}
 });
});

test('storage.clear nhận lại nguồn thực; khi có nháp không ghi phục sinh dữ liệu cũ',()=>{
 withNotebookFixture(({primary,emitStorage,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   emitStorage(null,null);m.draw();assert.equal(rhythm().props.unavailable,false);assert.deepEqual(rhythm().props.days,{});
   emitStorage(savedRaw);m.draw();
   const title=()=>all(m.tree,node=>node.type==='input'&&node.props.required)[0];
   title().props.onChange({target:{value:'Nháp GIẢ cần giữ'}});m.draw();
   emitStorage(null,null);m.draw();assert.equal(rhythm().props.unavailable,true);assert.equal(title().props.value,'Nháp GIẢ cần giữ');
   all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
   assert.equal(primary.getItem(NOTEBOOK_KEY),null);assert.equal(primary.getWrites(),0);
  }finally{m.unmount();}
 });
});

test('Lỗi nhập phút hoặc quota không biến nhịp từ bản hợp lệ thành không khả dụng',()=>{
 withNotebookFixture(({primary,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   const title=()=>all(m.tree,node=>node.type==='input'&&node.props.required)[0];
   const minutes=()=>all(m.tree,node=>node.type==='input'&&node.props.inputMode==='decimal')[0];
   const submit=()=>{all(m.tree,node=>node.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
   title().props.onChange({target:{value:'Việc GIẢ mới'}});minutes().props.onChange({target:{value:'-1'}});m.draw();submit();
   assert.match(text(m.tree),/Số phút phải là số nguyên/);assert.equal(rhythm().props.unavailable,false);
   minutes().props.onChange({target:{value:'30'}});m.draw();primary.failWrites('Dung lượng GIẢ đã đầy');submit();
   assert.match(text(m.tree),/Dung lượng GIẢ đã đầy/);assert.equal(rhythm().props.unavailable,false);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);assert.equal(primary.getWrites(),0);
  }finally{m.unmount();}
 });
});

test('Trước khi ghi vẫn kiểm nguồn hỏng hoặc không đọc được nếu storage event chưa tới',()=>{
 withNotebookFixture(({primary,emitStorage,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   primary.setRaw(NOTEBOOK_KEY,'{JSON GIẢ thay đổi chưa phát event');
   all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
   assert.equal(all(m.tree,node=>node.type?.name==='NotebookRhythm')[0].props.unavailable,true);assert.equal(primary.getWrites(),0);assert.equal(primary.getItem(NOTEBOOK_KEY),'{JSON GIẢ thay đổi chưa phát event');
   emitStorage(savedRaw);m.draw();primary.failReads('Không đọc được bộ nhớ GIẢ');
   all(m.tree,node=>node.type==='input'&&node.props.type==='checkbox')[0].props.onChange({target:{checked:true}});m.draw();
   assert.equal(all(m.tree,node=>node.type?.name==='NotebookRhythm')[0].props.unavailable,true);assert.match(text(m.tree),/Không đọc được bộ nhớ GIẢ/);assert.equal(primary.getWrites(),0);
   primary.failReads('');assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
  }finally{m.unmount();}
 });
});

test('Getter localStorage lỗi trong listener được báo và ẩn nhịp, không ném ra ngoài',()=>{
 withNotebookFixture(({primary,emitStorage,savedRaw})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Quyền đọc bộ nhớ GIẢ bị chặn');}});
   assert.doesNotThrow(()=>emitStorage(savedRaw));m.draw();
   assert.equal(all(m.tree,node=>node.type?.name==='NotebookRhythm')[0].props.unavailable,true);assert.match(text(m.tree),/Quyền đọc bộ nhớ GIẢ bị chặn/);assert.equal(primary.getWrites(),0);assert.equal(primary.getItem(NOTEBOOK_KEY),savedRaw);
  }finally{m.unmount();}
 });
});

test('Nháp chỉ có bản sửa mồ côi vẫn giữ chữ và phút khi nguồn lỗi, rỗng hoặc việc đã bị xóa',()=>{
 const date=localKey(new Date()),draft={version:1,date,title:'',minutes:'30',goalMonth:date.slice(0,7),goalText:null,edit:{date,id:'fake-task',text:'Bản sửa GIẢ cần giữ',minutes:'-'}};
 const deleted=JSON.stringify({version:1,days:{[date]:[]},goals:{}});
 for(const raw of ['{Nguồn GIẢ hỏng',null,deleted])withNotebookFixture(({primary,session,emitWindow,setConfirm,getConfirmCalls})=>{
  const m=mount('src/migration/Notebook.tsx');try{
   const rhythm=()=>all(m.tree,node=>node.type?.name==='NotebookRhythm')[0];
   const orphan=()=>all(m.tree,node=>node.type==='textarea'&&node.props['aria-label']==='Nội dung bản sửa chưa ghép')[0];
   assert.equal(orphan().props.value,'Bản sửa GIẢ cần giữ');assert.equal(orphan().props.readOnly,true);assert.match(text(m.tree),/Chưa lưu và chưa ghép phần sửa này vào việc nào/);assert.match(text(m.tree),/Số phút đang nhập: -/);
   assert.deepEqual(JSON.parse(session.getItem('mtm:guest-notebook:draft:v1')).edit,draft.edit);assert.equal(primary.getItem(NOTEBOOK_KEY),raw);assert.equal(primary.getWrites(),0);
   let prevented=false;emitWindow('beforeunload',{preventDefault(){prevented=true;},returnValue:undefined});assert.equal(prevented,true);
   setConfirm(false);prevented=false;emitWindow(BEFORE_NAVIGATION_EVENT,{preventDefault(){prevented=true;}});assert.equal(prevented,true);assert.equal(getConfirmCalls(),1);
   const previous=new Date();previous.setDate(previous.getDate()-1);
   assert.equal(rhythm().props.onSelectDay(localKey(previous)),false);m.draw();assert.equal(getConfirmCalls(),2);assert.equal(orphan().props.value,'Bản sửa GIẢ cần giữ');assert.deepEqual(JSON.parse(session.getItem('mtm:guest-notebook:draft:v1')).edit,draft.edit);
   setConfirm(true);assert.equal(rhythm().props.onSelectDay(localKey(previous)),true);m.draw();assert.equal(getConfirmCalls(),3);assert.equal(orphan(),undefined);assert.equal(session.getItem('mtm:guest-notebook:draft:v1'),null);assert.equal(primary.getItem(NOTEBOOK_KEY),raw);
  }finally{m.unmount();}
 },raw,draft);
});

test('Phạm vi UI riêng, không thêm storage/mạng, focus visible, kích thước chạm và giữ màu MTM',()=>{
 const code=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/migration/notebook-rhythm.ts'),'utf8'),css=readFileSync(join(root,'src/migration/notebook-rhythm.css'),'utf8');
 assert.doesNotMatch(code,/localStorage|sessionStorage|setItem|removeItem|fetch\(|\u2014/);
 assert.match(css,/min-height:44px/);assert.match(css,/:focus-visible/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/@media\(max-width:680px\)/);
});

function withNotebookFixture(run:(context:any)=>void,initialRaw?:string|null,initialDraft?:unknown){
 const storage=(initial:Record<string,string>={})=>{const values=new Map(Object.entries(initial));let writes=0,readError='',writeError='';return{getItem:(key:string)=>{if(readError)throw new Error(readError);return values.get(key)??null;},setItem:(key:string,value:string)=>{if(writeError)throw new Error(writeError);writes++;values.set(key,String(value));},removeItem:(key:string)=>values.delete(key),setRaw:(key:string,value:string|null)=>value===null?values.delete(key):values.set(key,value),getWrites:()=>writes,failReads:(message:string)=>readError=message,failWrites:(message:string)=>writeError=message};};
 const savedRaw=JSON.stringify({version:1,days:{[localKey(new Date())]:tasks(false)},goals:{}}),startRaw=initialRaw===undefined?savedRaw:initialRaw,primary=storage(startRaw===null?{}:{[NOTEBOOK_KEY]:startRaw}),session=storage(initialDraft===undefined?{}:{'mtm:guest-notebook:draft:v1':JSON.stringify(initialDraft)});
 const globals=globalThis as any,names=['localStorage','sessionStorage','window','confirm'],previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globals,name)] as const);
 let allow=true,calls=0;const listeners=new Map<string,Set<(event:any)=>void>>();
 const fakeWindow={addEventListener(name:string,listener:(event:any)=>void){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name)!.add(listener);},removeEventListener(name:string,listener:(event:any)=>void){listeners.get(name)?.delete(listener);}};
 Object.defineProperties(globals,{localStorage:{configurable:true,value:primary},sessionStorage:{configurable:true,value:session},window:{configurable:true,value:fakeWindow},confirm:{configurable:true,value:()=>{calls++;return allow;}}});
 const emitWindow=(name:string,event:any)=>{for(const listener of [...listeners.get(name)??[]])listener(event);};
 const emitStorage=(raw:string|null,key:string|null=NOTEBOOK_KEY)=>{primary.setRaw(NOTEBOOK_KEY,raw);emitWindow('storage',{key,newValue:key===null?null:raw,storageArea:primary});};
 try{run({primary,session,savedRaw,emitStorage,emitWindow,setConfirm:(next:boolean)=>allow=next,getConfirmCalls:()=>calls});}
 finally{for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globals,name,descriptor);else delete globals[name];}}
}

finish({note:'18 ca dùng dữ liệu GIẢ và harness hook; chưa thay thế ảnh hoặc tương tác trình duyệt thật.'});
