import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createReadingReviewPlan,FIRST_REVIEW_DATE,LAST_REVIEW_DATE,latestReviewDate,localReviewToday,reviewDateLabel} from '../src/native/reading-review-plan';
import {suite} from './exams-harness.mts';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
const {test,finish}=suite('D1710-PLAN-'),file='src/native/ReadingReviewPlan.tsx';
const dateField=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='date')[0];
const checks=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
const setDate=(m:any,value:string)=>{dateField(m).props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};

test('Đối chiếu độc lập mọi ngày trong 100 năm bằng lịch UTC tham chiếu, gồm năm nhuận và đổi năm',()=>{
 let days=0;
 for(let year=2000;year<2100;year++)for(let month=0;month<12;month++){
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  for(let day=1;day<=count;day++){
   const date=[year,String(month+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');
   if(date>LAST_REVIEW_DATE)continue;
   const plan=createReadingReviewPlan(date,LAST_REVIEW_DATE)!;assert.equal(plan.length,3);
   for(const [i,offset] of [1,3,7].entries())assert.equal(plan[i].date,new Date(Date.UTC(year,month,day+offset)).toISOString().slice(0,10),date);
   days++;
  }
 }
 assert.equal(days,36518);assert.equal(createReadingReviewPlan('2024-02-28','2026-10-17')![0].date,'2024-02-29');
 assert.equal(createReadingReviewPlan('2025-12-31','2026-10-17')![2].date,'2026-01-07');
});

test('Từ chối ngày mơ hồ, không tồn tại, ngoài miền và tương lai; không tràn mốc cuối',()=>{
 for(const value of ['', '2024-2-03','2024-02-3',' 2024-02-03','2024-02-03 ','2025-02-29','2024-02-30','2024-00-01','2024-13-01','2024-01-00','2024-01-32','1900-02-29','1999-12-31','2099-12-25','2100-01-01','0000-01-01','2026-10-18','2026-10-17T00:00:00Z'])assert.equal(createReadingReviewPlan(value,'2026-10-17'),null,value);
 assert.equal(createReadingReviewPlan('2026-10-17','invalid'),null);
 assert.deepEqual(createReadingReviewPlan(LAST_REVIEW_DATE,LAST_REVIEW_DATE)!.map(x=>x.date),['2099-12-25','2099-12-27','2099-12-31']);
 assert.equal(latestReviewDate('2100-01-01'),LAST_REVIEW_DATE);assert.equal(latestReviewDate('2026-10-17'),'2026-10-17');
 assert.equal(latestReviewDate('invalid'),FIRST_REVIEW_DATE);assert.equal(reviewDateLabel('2026-01-03'),'03/01/2026');
 const local=new Date(2026,9,17,23,59);assert.equal(localReviewToday(local),'2026-10-17');
});

test('Tạo ba mốc, focus kết quả, tự đánh dấu và bỏ dấu không chấm thành điểm',()=>{
 const m=mount(file);try{
  assert.equal(checks(m).length,0);setDate(m,'2024-02-28');submit(m);
  assert.equal(m.focused.type,'div');assert.equal(checks(m).length,3);assert.match(text(m.tree),/29\/02\/2024/);assert.match(text(m.tree),/06\/03\/2024/);
  const checkbox=checks(m)[1];checkbox.props.onChange({target:{checked:true}});m.draw();assert.match(text(m.tree),/1\/3 mốc ôn/);
  checks(m)[1].props.onChange({target:{checked:false}});m.draw();assert.match(text(m.tree),/0\/3 mốc ôn/);
  assert.doesNotMatch(text(m.tree),/đã hoàn thành PDF|đúng 3|đạt điểm/);
  for(const field of [dateField(m),...checks(m)])assert.equal(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===field.props.id).length,1);
 }finally{m.unmount();}
});

test('Đổi ngày xóa ngay kế hoạch cũ, ngày sai báo lỗi nối mô tả rồi focus input',()=>{
 const m=mount(file);try{
  setDate(m,'2024-02-28');submit(m);checks(m)[0].props.onChange({target:{checked:true}});m.draw();
  setDate(m,'2025-02-29');assert.equal(checks(m).length,0);assert.doesNotMatch(text(m.tree),/29\/02\/2024/);submit(m);
  const error=all(m.tree,n=>n.props?.role==='alert')[0];assert.ok(error);assert.equal(dateField(m).props['aria-invalid'],true);
  assert.ok(dateField(m).props['aria-describedby'].split(' ').includes(error.props.id));assert.equal(m.focused.id,dateField(m).props.id);
  setDate(m,'2024-02-29');assert.equal(all(m.tree,n=>n.props?.role==='alert').length,0);submit(m);assert.ok(checks(m).every(n=>!n.props.checked));assert.match(text(m.tree),/01\/03\/2024/);
 }finally{m.unmount();}
});

test('Các callback cũ không tạo hoặc sửa kế hoạch mới sau đổi ngày, tạo lại hay xóa',()=>{
 const m=mount(file);try{
  setDate(m,'2024-01-31');submit(m);
  const oldCheck=checks(m)[0].props.onChange,oldSubmit=all(m.tree,n=>n.type==='form')[0].props.onSubmit,oldDate=dateField(m).props.onChange;
  setDate(m,'2024-02-29');oldSubmit({preventDefault(){}});oldDate({target:{value:'2024-01-31'}});oldCheck({target:{checked:true}});m.draw();
  assert.equal(checks(m).length,0);assert.equal(dateField(m).props.value,'2024-02-29');submit(m);
  oldCheck({target:{checked:true}});m.draw();assert.ok(checks(m).every(n=>!n.props.checked));
  const beforeReset=checks(m)[1].props.onChange,reset=all(m.tree,n=>n.type==='button'&&text(n)==='Xóa kế hoạch tự ôn')[0].props.onClick;
  m.click('Xóa kế hoạch tự ôn');beforeReset({target:{checked:true}});oldSubmit({preventDefault(){}});m.draw();assert.equal(checks(m).length,0);
  setDate(m,'2024-12-31');submit(m);reset();m.draw();assert.equal(checks(m).length,3);assert.match(text(m.tree),/07\/01\/2025/);
 }finally{m.unmount();}
});

test('Xóa hoặc remount không giữ dấu tự ôn; mốc cũ không làm đổi lượt tạo mới cùng ngày',()=>{
 const m=mount(file);try{
  setDate(m,'2024-10-17');submit(m);const old=checks(m)[2].props.onChange;
  checks(m)[2].props.onChange({target:{checked:true}});m.draw();submit(m);old({target:{checked:true}});m.draw();assert.ok(checks(m).every(n=>!n.props.checked));
  m.click('Xóa kế hoạch tự ôn');assert.equal(checks(m).length,0);assert.equal(m.focused.id,dateField(m).props.id);
 }finally{m.unmount();}
 const fresh=mount(file);try{assert.equal(checks(fresh).length,0);}finally{fresh.unmount();}
});

test('Launcher tải lười chỉ sau mở, đóng mở giữ cùng phiên và boundary báo lỗi riêng',()=>{
 const tool='src/native/ReadingReviewTool.tsx',m=mount(tool);try{
  assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
  const toggle=all(m.tree,n=>n.type==='details')[0].props.onToggle;
  toggle({currentTarget:{open:false}});m.draw();assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);
  toggle({currentTarget:{open:true}});m.draw();assert.equal(all(m.tree,n=>n.type===React.Suspense).length,1);
  toggle({currentTarget:{open:false}});m.draw();assert.equal(all(m.tree,n=>n.type===React.Suspense).length,1);
 }finally{m.unmount();}
 const Boundary=load(tool).ReadingReviewBoundary,boundary=new Boundary({children:'Nội dung giả'});assert.equal(boundary.render(),'Nội dung giả');boundary.state=Boundary.getDerivedStateFromError();assert.match(text(boundary.render()),/vẫn có thể tìm và đọc tài liệu/);
 let imports=0;const Component=load(tool,{lazy:(factory:any)=>React.lazy(()=>{imports++;return factory();})}).default;
 require('react-dom/server').renderToStaticMarkup(React.createElement(Component));assert.equal(imports,0);
});

test('Tích hợp đúng danh sách Tài liệu, đổi bộ lọc cùng scope và không hiện ở chi tiết hoặc Thi thử',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'location');Object.defineProperty(globalThis,'location',{configurable:true,value:{hash:''}});
 const id=JSON.parse(readFileSync(join(root,'src/native/reader-files.json'),'utf8')).files[0].id;
 try{
  for(const [kind,pathname,count] of [['documents','/tai-lieu',1],['documents','/tai-lieu/'+id,0],['exams','/thi-thu',0]] as const){
   const m=mount('src/native/NativeResources.tsx',{kind,pathname,search:''});try{
    const tools=all(m.tree,n=>n.type?.name==='ReadingReviewTool');assert.equal(tools.length,count);
    if(count){const prior=tools[0];m.draw({kind,pathname,search:'?muc=grade-12&q=khong-khop'});const current=all(m.tree,n=>n.type?.name==='ReadingReviewTool')[0];assert.equal(current.type,prior.type);assert.equal(current.key,prior.key);}
   }finally{m.unmount();}
  }
 }finally{if(previous)Object.defineProperty(globalThis,'location',previous);else delete (globalThis as any).location;}
});

test('SSR và CSS có phạm vi, nút lớn, navy vàng; không mạng, storage, lịch nền hoặc em dash',()=>{
 const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default));assert.match(html,/không gửi nhắc nhở/);assert.match(html,/Rời trang hoặc tải lại sẽ xóa/);assert.doesNotMatch(html,/type="checkbox"/);
 for(const name of [file,'src/native/reading-review-plan.ts','src/native/ReadingReviewTool.tsx'])assert.doesNotMatch(readFileSync(join(root,name),'utf8'),/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|dangerouslySetInnerHTML|\u2014/);
 const css=readFileSync(join(root,'src/native/reading-review-plan.css'),'utf8');assert.match(css,/min-height:48px/);assert.match(css,/#213269/);assert.match(css,/#FFCF24/);assert.match(css,/:focus-visible/);
 require('postcss').parse(css).walkRules((rule:any)=>assert.ok(rule.selector.startsWith('.native-ui .reading-review-plan')));
 const launcher=readFileSync(join(root,'src/native/reading-review-tool.css'),'utf8');assert.match(launcher,/min-height:48px/);
});
finish({note:'9 nhóm kiểm lịch, hook và SSR; dữ liệu giả, không thay QA trình duyệt thật.'});
