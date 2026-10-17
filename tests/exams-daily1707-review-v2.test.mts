import assert from 'node:assert/strict';
import {exam,draft} from './daily1707-fixture.mts';
import {all,mount,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1707-REVIEW-'),file='src/native/exams/ExamReview.tsx';
const ids=(tree:any)=>all(tree,n=>n.type==='section'&&n.props.className==='ep-question ep-card').map(n=>n.key);
test('Bản cũ giữ ba bộ lọc; v2 có trạng thái và phần, phối hợp đúng',()=>{
 const old=mount(file,{exam,draft,showSummary:false});assert.equal(all(old.tree,n=>n.type==='select').length,0);assert.equal(all(old.tree,n=>n.props['aria-pressed']!==undefined).length,3);old.unmount();
 const m=mount(file,{exam,draft,showSummary:false,advancedFilters:true}),before=JSON.stringify({exam,draft});
 assert.deepEqual(ids(m.tree),exam.questions.map(q=>q.id));m.click('Đúng một phần (1)');assert.deepEqual(ids(m.tree),['fake-partial']);
 const select=(value:string)=>{all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value}});m.draw();};
 select('0');assert.deepEqual(ids(m.tree),[]);assert.match(text(m.tree),/Không có câu trong mục này/);
 select('2');assert.deepEqual(ids(m.tree),['fake-partial']);m.click('Chưa đúng (1)');assert.deepEqual(ids(m.tree),[]);
 select('all');assert.deepEqual(ids(m.tree),['fake-wrong']);m.click('Câu bỏ trống (1)');assert.deepEqual(ids(m.tree),['fake-blank']);
 m.click('Đúng toàn bộ (1)');assert.deepEqual(ids(m.tree),['fake-correct']);m.click('Chưa tính được điểm (0)');assert.deepEqual(ids(m.tree),[]);m.click('Tự làm, xem lời giải, không tính điểm (0)');assert.deepEqual(ids(m.tree),[]);
 m.click('Câu sai / chưa đủ điểm (3)');assert.deepEqual(ids(m.tree),['fake-wrong','fake-partial','fake-blank']);assert.equal(JSON.stringify({exam,draft}),before);m.unmount();
});
test('Nav tổng quan bỏ cả hai bộ lọc, lời giải chỉ mở trên câu đang xem',()=>{
 const prior=(globalThis as any).document,targets:any[]=[];(globalThis as any).document={getElementById:(id:string)=>({focus(){targets.push(id)},scrollIntoView(){}})};
 const m=mount(file,{exam,draft,showSummary:false,advancedFilters:true});
 try{m.click('Đúng một phần (1)');m.click('Mở lời giải các câu đang xem');assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,1);m.click('Thu gọn lời giải');assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,0);
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'2'}});m.draw();const nav=all(m.tree,n=>n.type==='nav')[0],button=all(nav,n=>n.type==='button')[1];button.props.onClick();m.draw();assert.deepEqual(ids(m.tree),exam.questions.map(q=>q.id));assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'all');assert.ok(targets.some(id=>id.endsWith('-card-1')));
 }finally{m.unmount();(globalThis as any).document=prior;}
});
test('Chưa nộp không hiển thị; câu khởi tạo mở đúng lời giải và focus',()=>{
 const empty=mount(file,{exam,draft:{...draft,submittedAt:null},advancedFilters:true});assert.equal(empty.tree,null);empty.unmount();
 const prior=(globalThis as any).document,targets:string[]=[];(globalThis as any).document={getElementById:(id:string)=>({focus(){targets.push(id)},scrollIntoView(){}})};
 const m=mount(file,{exam,draft,showSummary:false,advancedFilters:true,initialQuestionId:'fake-wrong'});try{assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,1);assert.ok(targets[0].endsWith('-card-1'));}finally{m.unmount();(globalThis as any).document=prior;}
});
test('Yêu cầu từ phiếu tự sửa mở và focus cùng câu nhiều lần, giữ công cụ ôn và lời giải đang mở',()=>{
 const prior=(globalThis as any).document,targets:string[]=[],scrolled:string[]=[];
 let m:any;
 (globalThis as any).document={getElementById:(id:string)=>all(m.tree,n=>n.props.id===id).length?{focus(){targets.push(id)},scrollIntoView(){scrolled.push(id)}}:null};
 const base={exam,draft,showSummary:false,advancedFilters:true},spaced=()=>all(m.tree,n=>n.type?.name==='ResultSpacedReviewTool')[0];
 m=mount(file,base);
 try{
  const tool=spaced(),correct=all(m.tree,n=>n.type==='details'&&text(n).includes('Câu 1'))[0];correct.props.onToggle({currentTarget:{open:true}});m.draw();
  const hideTarget=()=>{m.click('Đúng một phần (1)');all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'2'}});m.draw();};
  for(const revision of [1,2]){
   hideTarget();assert.deepEqual(ids(m.tree),['fake-partial']);
   const next={...base,initialQuestionId:'fake-wrong',reviewRequestRevision:revision};m.draw(next);m.draw(next);m.draw(next);
   assert.deepEqual(ids(m.tree),exam.questions.map(q=>q.id));assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,'all');
   assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,2);assert.equal(targets.length,revision);assert.ok(targets.at(-1)?.endsWith('-card-1'));assert.equal(scrolled.length,revision);
   assert.equal(spaced().key,tool.key);assert.equal(spaced().type,tool.type);
   const target=all(m.tree,n=>n.type==='section'&&n.key==='fake-wrong')[0];all(target,n=>n.type==='details')[0].props.onToggle({currentTarget:{open:false}});m.draw(next);
  }
 }finally{m.unmount();(globalThis as any).document=prior;}
});
test('Bỏ yêu cầu đối chiếu câu không có hoặc lượt chưa nộp, sai phiên bản và sai thời điểm',()=>{
 const prior=(globalThis as any).document,targets:string[]=[];(globalThis as any).document={getElementById:(id:string)=>({focus(){targets.push(id)},scrollIntoView(){}})};
 try{
  for(const value of [{...draft,submittedAt:null},{...draft,examVersionHash:'c'.repeat(64)},{...draft,submittedAt:draft.updatedAt+1}]){
   const m=mount(file,{exam,draft:value,initialQuestionId:'fake-wrong',reviewRequestRevision:1});m.draw();assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,0);m.unmount();
  }
  const base={exam,draft,showSummary:false,advancedFilters:true},m=mount(file,base);m.click('Đúng một phần (1)');const next={...base,initialQuestionId:'khong-co',reviewRequestRevision:1};m.draw(next);m.draw(next);assert.deepEqual(ids(m.tree),['fake-partial']);assert.equal(all(m.tree,n=>n.type==='details'&&n.props.open).length,0);m.unmount();assert.deepEqual(targets,[]);
 }finally{(globalThis as any).document=prior;}
});
finish();
