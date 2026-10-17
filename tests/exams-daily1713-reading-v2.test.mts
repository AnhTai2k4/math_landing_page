import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {createReadingReviewPlan,latestReviewDate,READING_REVIEW_RHYTHMS,readingReviewStatus} from '../src/native/reading-review-plan';
import {suite} from './exams-harness.mts';
import {all,mount,root,text,require} from './daily19-ui-harness.mts';

const {test,finish}=suite('D1713-READING-'),file='src/native/ReadingReviewPlan.tsx';
const dates=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='date');
const checks=(m:any)=>all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox');
const rhythm=(m:any)=>all(m.tree,n=>n.type==='select')[0];
const setDate=(m:any,value:string)=>{dates(m)[0].props.onChange({target:{value}});m.draw();};
const select=(m:any,value:string)=>{rhythm(m).props.onChange({target:{value}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};

test('Hai nhịp có ba mốc đúng theo lịch UTC độc lập trong cả thế kỷ, mặc định giữ 1/3/7',()=>{
 let compared=0;
 for(let year=2000;year<=2099;year++)for(let month=0;month<12;month++){
  const count=new Date(Date.UTC(year,month+1,0)).getUTCDate();
  for(let day=1;day<=count;day++)for(const [id,offsets,last] of [['1-3-7',[1,3,7],'2099-12-24'],['2-5-10',[2,5,10],'2099-12-21']] as const){
   const date=[year,String(month+1).padStart(2,'0'),String(day).padStart(2,'0')].join('-');if(date>last)continue;
   const plan=createReadingReviewPlan(date,'2099-12-31',id)!;
   assert.deepEqual(plan.map(item=>item.days),offsets);
   for(const [index,offset] of offsets.entries())assert.equal(plan[index].date,new Date(Date.UTC(year,month,day+offset)).toISOString().slice(0,10),date+' '+id);
   compared++;
  }
 }
 assert.equal(compared,73033);
 assert.deepEqual(createReadingReviewPlan('2024-02-28','2026-10-17'),createReadingReviewPlan('2024-02-28','2026-10-17','1-3-7'));
 assert.deepEqual(createReadingReviewPlan('2099-12-21','2099-12-31','2-5-10')!.map(item=>item.date),['2099-12-23','2099-12-26','2099-12-31']);
});

test('Từ chối nhịp lạ, ngày sai và ngày vượt giới hạn của riêng từng nhịp',()=>{
 for(const item of READING_REVIEW_RHYTHMS){
  for(const date of ['', '2024-2-03','2025-02-29','2024-13-01','1999-12-31','2100-01-01','2026-10-18'])assert.equal(createReadingReviewPlan(date,'2026-10-17',item.id),null);
 }
 assert.equal(createReadingReviewPlan('2099-12-22','2099-12-31','2-5-10'),null);
 assert.ok(createReadingReviewPlan('2099-12-22','2099-12-31','1-3-7'));
 assert.equal(createReadingReviewPlan('2026-10-17','invalid','2-5-10'),null);
 assert.equal(createReadingReviewPlan('2026-10-17','2026-10-17','unknown' as any),null);
 assert.equal(latestReviewDate('2100-01-01','2-5-10'),'2099-12-21');
 assert.equal(latestReviewDate('invalid','2-5-10'),'2000-01-01');
});

test('Trạng thái phân biệt hôm nay, mốc đã tới, mốc sắp tới và tự đánh dấu, không tự xác nhận hoàn thành',()=>{
 assert.equal(readingReviewStatus('2026-10-17',false,'2026-10-17'),'today');
 assert.equal(readingReviewStatus('2026-10-16',false,'2026-10-17'),'available');
 assert.equal(readingReviewStatus('2026-10-18',false,'2026-10-17'),'upcoming');
 for(const date of ['2026-10-16','2026-10-17','2026-10-18'])assert.equal(readingReviewStatus(date,true,'2026-10-17'),'checked');
 assert.equal(readingReviewStatus('2025-02-29',true,'2026-10-17'),'invalid');
 assert.equal(readingReviewStatus('2026-10-17',false,'invalid'),'invalid');
});

test('Đổi nhịp tạo được 2/5/10, xóa lượt trước với hướng dẫn rõ và từ chối callback lượt cũ',()=>{
 const m=mount(file);try{
  assert.equal(rhythm(m).props.value,'1-3-7');assert.equal(all(m.tree,n=>n.type==='label'&&n.props.htmlFor===rhythm(m).props.id).length,1);
  setDate(m,'2024-02-28');submit(m);checks(m)[0].props.onChange({target:{checked:true}});m.draw();
  const oldSubmit=all(m.tree,n=>n.type==='form')[0].props.onSubmit,oldCheck=checks(m)[0].props.onChange,oldSelect=rhythm(m).props.onChange;
  select(m,'2-5-10');assert.equal(checks(m).length,0);assert.match(text(m.tree),/Đổi nhịp sẽ xóa các mốc và dấu tự ôn/);
  oldSubmit({preventDefault(){}});oldCheck({target:{checked:true}});oldSelect({target:{value:'1-3-7'}});m.draw();
  assert.equal(checks(m).length,0);assert.equal(rhythm(m).props.value,'2-5-10');submit(m);
  assert.equal(checks(m).length,3);assert.match(text(m.tree),/01\/03\/2024/);assert.match(text(m.tree),/04\/03\/2024/);assert.match(text(m.tree),/09\/03\/2024/);
  assert.ok(checks(m).every(node=>!node.props.checked));assert.equal(m.focused.type,'div');
  const before=text(m.tree);select(m,'bogus');assert.equal(text(m.tree),before);
 }finally{m.unmount();}
});

test('Lỗi ngày nối đúng input và giới hạn cập nhật theo nhịp; reset giữ nhịp đang chọn',()=>{
 const m=mount(file);try{
  select(m,'2-5-10');setDate(m,'2025-02-29');submit(m);
  const error=all(m.tree,n=>n.props?.role==='alert')[0];assert.ok(error);assert.equal(dates(m)[0].props['aria-invalid'],true);
  assert.ok(dates(m)[0].props['aria-describedby'].split(' ').includes(error.props.id));assert.equal(m.focused.id,dates(m)[0].props.id);
  setDate(m,'2024-02-29');submit(m);m.click('Xóa kế hoạch tự ôn');assert.equal(checks(m).length,0);assert.equal(rhythm(m).props.value,'2-5-10');assert.equal(m.focused.id,dates(m)[0].props.id);
  submit(m);assert.ok(checks(m).every(node=>!node.props.checked));
 }finally{m.unmount();}
});

test('Cập nhật ngày bằng thao tác đổi trạng thái mốc, giữ dấu tự ôn và loại callback trước cập nhật',()=>{
 const OriginalDate=Date;let today='2026-10-17';
 class TestDate extends OriginalDate{constructor(value?:string|number){super(arguments.length?value!:today+'T12:00:00');}}
 (globalThis as any).Date=TestDate;
 try{
  const m=mount(file);try{
   setDate(m,'2026-10-16');submit(m);assert.match(text(m.tree),/Hôm nay là mốc gợi ý/);assert.match(text(m.tree),/Mốc sắp tới/);
   checks(m)[0].props.onChange({target:{checked:true}});m.draw();
   const oldRefresh=all(m.tree,n=>n.type==='button'&&text(n)==='Cập nhật ngày đối chiếu')[0].props.onClick,oldCheck=checks(m)[1].props.onChange;
   today='2026-10-20';m.click('Cập nhật ngày đối chiếu');assert.ok(checks(m)[0].props.checked);assert.match(text(m.tree),/20\/10\/2026/);assert.match(text(m.tree),/Đã tới mốc gợi ý/);assert.match(text(m.tree),/1 mốc đã tới ngày gợi ý/);
   today='2026-10-24';oldRefresh();oldCheck({target:{checked:true}});m.draw();assert.match(text(m.tree),/Ngày đối chiếu: 20\/10\/2026/);assert.equal(checks(m)[1].props.checked,false);
   m.click('Cập nhật ngày đối chiếu');assert.match(text(m.tree),/Ngày đối chiếu: 24\/10\/2026/);assert.match(text(m.tree),/2 mốc đã tới ngày gợi ý/);
   const refresh=all(m.tree,n=>n.type==='button'&&text(n)==='Cập nhật ngày đối chiếu')[0].props.onClick;
   checks(m)[1].props.onChange({target:{checked:true}});refresh();m.draw();assert.equal(checks(m)[1].props.checked,true);
  }finally{m.unmount();}
 }finally{globalThis.Date=OriginalDate;}
});

test('UX có ngày tham chiếu, trạng thái bằng chữ, vùng chạm và focus; không thêm nhắc nền hay lưu dữ liệu',()=>{
 const source=readFileSync(join(root,file),'utf8'),css=readFileSync(join(root,'src/native/reading-review-plan.css'),'utf8');
 assert.match(source,/data-version="2"/);assert.match(source,/Ngày đối chiếu trên thiết bị/);assert.match(source,/không cần làm bù cả ba mốc cùng lúc/);
 assert.match(css,/select\{[^}]*min-height:48px/);assert.match(css,/li:focus-within/);assert.match(css,/select:focus-visible/);assert.match(css,/box-sizing:border-box/);
 require('postcss').parse(css).walkRules((rule:any)=>assert.ok(rule.selector.startsWith('.native-ui .reading-review-plan')));
 for(const name of [file,'src/native/reading-review-plan.ts','src/native/reading-review-plan.css'])assert.doesNotMatch(readFileSync(join(root,name),'utf8'),/fetch\(|localStorage|sessionStorage|setInterval|setTimeout|dangerouslySetInnerHTML|\u2014/);
});

test('Nhãn mở công cụ phù hợp cả hai nhịp tự ôn',()=>{
 const m=mount('src/native/ReadingReviewTool.tsx');
 try{assert.equal(text(all(m.tree,node=>node.type==='summary')[0]),'Mốc ôn sau đọc');}
 finally{m.unmount();}
});

finish({note:'8 nhóm kiểm độc lập lịch và tương tác v2, không thay QA trình duyệt thật.'});
