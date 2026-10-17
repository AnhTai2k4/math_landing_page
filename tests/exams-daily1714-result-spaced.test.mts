import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {exam,draft} from './daily1707-fixture.mts';
import {createSpacedReviewPlan,spacedReviewDates,spacedReviewItems,spacedReviewToday} from '../src/native/exams/result-spaced-review';
import {all,mount,load,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1714-SPACED-'),file='src/native/exams/ResultSpacedReview.tsx';
const change=(m:any,predicate:(node:any)=>boolean,value:any)=>{const node=all(m.tree,predicate)[0];assert.ok(node);node.props.onChange({target:typeof value==='boolean'?{checked:value}:{value}});m.draw();};
const selectQuestion=(m:any,index=0)=>{all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox')[index].props.onChange({target:{checked:true}});m.draw();};
const submit=(m:any)=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
test('Gom đúng lượt đã nộp và câu đã chấm chưa đủ điểm; bỏ câu đúng, tự chấm và phiên bản lệch',()=>{
 const before=JSON.stringify({exam,draft});
 assert.deepEqual(spacedReviewItems(exam,draft).map(row=>[row.q.id,row.status]),[['fake-wrong','wrong'],['fake-partial','partial'],['fake-blank','unanswered']]);
 for(const other of [{...draft,submittedAt:null},{...draft,examVersionHash:'c'.repeat(64)},{...draft,examId:'khac'}])assert.deepEqual(spacedReviewItems(exam,other),[]);
 assert.equal(createSpacedReviewPlan(exam,draft,'2026-10-17',['fake-correct']),null);
 for(const ids of [[],['fake-wrong','fake-wrong'],['khong-co'],Array(6).fill('fake-wrong')])assert.equal(createSpacedReviewPlan(exam,draft,'2026-10-17',ids),null);
 const plan=createSpacedReviewPlan(exam,draft,'2026-10-17',['fake-blank','fake-partial']);assert.deepEqual(plan?.items.map(row=>row.q.id),['fake-partial','fake-blank']);assert.equal(JSON.stringify({exam,draft}),before);
});
test('Mốc 1, 3, 7 tính từ ngày gốc, qua tháng/năm/năm nhuận, không nhận ngày sai',()=>{
 assert.deepEqual(spacedReviewDates('2028-02-28')?.map(row=>row.date),['2028-02-29','2028-03-02','2028-03-06']);
 assert.deepEqual(spacedReviewDates('2026-12-30')?.map(row=>row.date),['2026-12-31','2027-01-02','2027-01-06']);
 assert.deepEqual(spacedReviewDates('2099-12-24')?.map(row=>row.date),['2099-12-25','2099-12-27','2099-12-31']);
 for(const value of ['2026-02-29','2026-04-31','2026-13-01','','2000-1-1','1999-12-31','2099-12-25','2026-10-17T00:00:00'])assert.equal(spacedReviewDates(value),null,value);
 assert.equal(spacedReviewToday(new Date(2026,9,17,0,10)),'2026-10-17');
});
test('Lập phiếu, xác nhận tự giải mới được đối chiếu và tự đánh giá riêng cho từng câu/mốc',()=>{
 const reviewed:string[]=[],before=JSON.stringify({exam,draft}),m=mount(file,{exam,draft,onReview:(id:string)=>reviewed.push(id)});
 submit(m);assert.equal(m.focused.type,'fieldset');assert.match(text(m.tree),/Em chọn từ 1 đến 5 câu/);
 selectQuestion(m,0);selectQuestion(m,1);
 change(m,n=>n.type==='input'&&n.props.type==='date','2026-02-29');submit(m);assert.equal(m.focused.type,'input');assert.equal(all(m.tree,n=>n.props['aria-label']==='Lịch tự ôn câu sai').length,0);
 change(m,n=>n.type==='input'&&n.props.type==='date','2026-10-17');submit(m);assert.equal(m.focused.type,'div');assert.equal(all(m.tree,n=>n.type==='time').length,3);assert.deepEqual(all(m.tree,n=>n.type==='time').map(text),['18/10/2026','20/10/2026','24/10/2026']);
 const rows=()=>all(m.tree,n=>n.props.className==='ep-spaced-question'),row=()=>rows()[0],inputs=(r:any)=>all(r,n=>n.type==='input'),buttons=(r:any)=>all(r,n=>n.type==='button'),select=(r:any)=>all(r,n=>n.type==='select')[0];
 assert.equal(buttons(row())[0].props.disabled,true);buttons(row())[0].props.onClick();m.draw();assert.deepEqual(reviewed,[]);
 inputs(row())[0].props.onChange({target:{checked:true}});m.draw();assert.equal(buttons(row())[0].props.disabled,false);assert.equal(select(row()).props.disabled,true);
 select(row()).props.onChange({target:{value:'can-explain'}});m.draw();assert.equal(select(row()).props.value,'');
 buttons(row())[0].props.onClick();m.draw();assert.deepEqual(reviewed,['fake-wrong']);select(row()).props.onChange({target:{value:'can-explain'}});m.draw();assert.match(text(m.tree),/Đã tự đánh giá 1\/6/);assert.equal(select(rows()[1]).props.value,'');assert.equal(select(rows()[2]).props.value,'');submit(m);assert.equal(select(row()).props.value,'can-explain');assert.match(text(m.tree),/Đã tự đánh giá 1\/6/);
 const staleAssessment=select(row()).props.onChange,staleReview=buttons(row())[0].props.onClick;
 inputs(row())[0].props.onChange({target:{checked:false}});m.draw();staleAssessment({target:{value:'can-explain'}});staleReview();m.draw();assert.deepEqual(reviewed,['fake-wrong']);assert.equal(select(row()).props.value,'');assert.equal(select(row()).props.disabled,true);assert.match(text(m.tree),/Đã tự đánh giá 0\/6/);
 assert.equal(JSON.stringify({exam,draft}),before);m.unmount();
});
test('Đổi cấu hình bỏ lịch cũ, callback cũ không sửa lịch mới; không nhận đánh giá tùy ý',()=>{
 const m=mount(file,{exam,draft,onReview(){}});selectQuestion(m);submit(m);
 const first=all(m.tree,n=>n.props.className==='ep-spaced-question')[0],stale=all(first,n=>n.type==='input')[0].props.onChange;
 change(m,n=>n.type==='input'&&n.props.type==='date','2026-12-30');assert.equal(all(m.tree,n=>n.type==='time').length,0);submit(m);stale({target:{checked:true}});m.draw();
 const row=()=>all(m.tree,n=>n.props.className==='ep-spaced-question')[0],checkbox=()=>all(row(),n=>n.type==='input')[0],select=()=>all(row(),n=>n.type==='select')[0];assert.equal(checkbox().props.checked,false);
 checkbox().props.onChange({target:{checked:true}});m.draw();all(row(),n=>n.type==='button')[0].props.onClick();m.draw();select().props.onChange({target:{value:'untrusted'}});m.draw();assert.equal(select().props.value,'');
 m.unmount();const fresh=mount(file,{exam,draft,onReview(){}});assert.match(text(fresh.tree),/Đã chọn 0\/5/);assert.equal(all(fresh.tree,n=>n.type==='time').length,0);fresh.unmount();
});
test('Cấu hình giới hạn 5 câu và thông báo trống không phát sinh lịch',()=>{
 const six={...exam,questionCount:7,sections:[{label:'I',kind:'mc',count:7}],questions:Array.from({length:7},(_,i)=>({...exam.questions[1],id:'fake-'+i,maxMillipoints:i===6?4000:1000}))} as typeof exam;
 const sixDraft={...draft,answers:Object.fromEntries(six.questions.map(q=>[q.id,'A']))};
 const m=mount(file,{exam:six,draft:sixDraft,onReview(){}});for(let i=0;i<5;i++)selectQuestion(m,i);assert.equal(all(m.tree,n=>n.type==='input'&&n.props.type==='checkbox').filter(n=>n.props.disabled).length,2);m.unmount();
 const empty=mount(file,{exam,draft:{...draft,submittedAt:null},onReview(){}});assert.match(text(empty.tree),/Chưa có câu đã chấm/);assert.equal(all(empty.tree,n=>n.type==='form').length,0);empty.unmount();
});
test('Lazy chỉ khi mở, lỗi tải thử lại bằng module mới; tích hợp đúng trang kết quả',()=>{
 const toolFile='src/native/exams/ResultSpacedReviewTool.tsx',m=mount(toolFile,{exam,draft,onReview(){}});assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);m.click('Lập phiếu ôn cách ngày');const initial=all(m.tree,n=>n.type===React.Suspense)[0].props.children;all(m.tree,n=>n.type?.name==='SpacedReviewBoundary')[0].props.onRetry();m.draw();const retried=all(m.tree,n=>n.type===React.Suspense)[0].props.children;assert.notEqual(initial.type,retried.type);assert.equal(retried.props.focusOnMount,true);m.click('Đóng phiếu ôn cách ngày');assert.equal(all(m.tree,n=>n.type===React.Suspense).length,0);m.unmount();
 const {SpacedReviewBoundary}=load(toolFile);let retries=0;const b=new SpacedReviewBoundary({onRetry:()=>retries++});b.state=SpacedReviewBoundary.getDerivedStateFromError();assert.match(text(b.render()),/Phần đối chiếu bài bên dưới vẫn dùng được/);all(b.render(),n=>n.type==='button')[0].props.onClick();assert.equal(retries,1);
 for(const advancedFilters of [false,true]){const review=mount('src/native/exams/ExamReview.tsx',{exam,draft,showSummary:false,advancedFilters});assert.equal(all(review.tree,n=>n.type?.name==='ResultSpacedReviewTool').length,advancedFilters?1:0);review.unmount();}
});
test('SSR và ràng buộc riêng tư, không thêm API, storage, timer hoặc dữ liệu thật',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),View=load(file).default;const html=renderToStaticMarkup(React.createElement(View,{exam,draft,onReview(){}}));assert.match(html,/Chọn tối đa 5 câu/);assert.match(html,/Web không lưu lịch, gửi nhắc nhở hay đổi điểm/);
 for(const name of [file,'src/native/exams/ResultSpacedReviewTool.tsx','src/native/exams/result-spaced-review.ts'])assert.doesNotMatch(readFileSync(join(root,name),'utf8'),/localStorage|sessionStorage|fetch\(|setInterval|setTimeout|\u2014/);
 const css=readFileSync(join(root,'src/native/exams/result-spaced-review.css'),'utf8');assert.match(css,/min-height:48px/);assert.match(css,/:focus-visible/);assert.match(css,/@media\(max-width:1000px\)/);
});
finish();
