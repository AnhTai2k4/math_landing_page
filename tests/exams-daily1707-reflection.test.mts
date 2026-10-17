import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {exam,draft} from './daily1707-fixture.mts';
import {reflectionItems,reflectionCause,REFLECTION_CAUSES} from '../src/native/exams/result-reflection';
import {all,mount,load,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D1707-REFLECT-'),file='src/native/exams/ResultReflection.tsx';
test('Chỉ câu sai, một phần, bỏ trống trong đúng lượt đã nộp; không sửa đề hoặc điểm',()=>{
 const before=JSON.stringify({exam,draft});
 assert.deepEqual(reflectionItems(exam,draft).map(r=>[r.q.id,r.status]),[['fake-wrong','wrong'],['fake-partial','partial'],['fake-blank','unanswered']]);
 assert.deepEqual(reflectionItems(exam,{...draft,submittedAt:null}),[]);
 assert.deepEqual(reflectionItems(exam,{...draft,examVersionHash:'c'.repeat(64)}),[]);
 assert.deepEqual(reflectionItems(exam,{...draft,examId:'khac'}),[]);
 assert.equal(JSON.stringify({exam,draft}),before);
 assert.equal(new Set(REFLECTION_CAUSES.map(c=>c.id)).size,5);assert.equal(reflectionCause('ngoai-danh-sach'),undefined);
 for(const cause of REFLECTION_CAUSES){assert.equal(cause.steps.length,3);assert.ok(cause.steps.every(s=>s.trim().length>20));}
});
test('Submit lỗi focus đúng ô; chọn câu/nguyên nhân, kế hoạch 3 bước và ghi chú escaped',()=>{
 const visited:string[]=[],m=mount(file,{exam,draft,onReview:(id:string)=>visited.push(id)});
 const submit=()=>{all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();};
 const select=(index:number,value:string)=>{all(m.tree,n=>n.type==='select')[index].props.onChange({target:{value}});m.draw();};
 submit();assert.equal(m.focused.type,'select');assert.equal(all(m.tree,n=>n.props.role==='alert').length,1);
 select(0,'fake-wrong');submit();assert.equal(m.focused.id,all(m.tree,n=>n.type==='select')[1].props.id);
 for(const cause of REFLECTION_CAUSES){select(1,cause.id);submit();assert.equal(all(m.tree,n=>n.type==='li').length,3);assert.match(text(m.tree),new RegExp(cause.label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));assert.equal(m.focused.props,undefined);assert.equal(m.focused.type,'div');}
 const note='<script>window.secret=1</script>';all(m.tree,n=>n.type==='textarea')[0].props.onChange({target:{value:note}});m.draw();assert.equal(all(m.tree,n=>n.props['aria-label']==='Kế hoạch tự sửa câu đã chọn').length,0);submit();assert.ok(text(m.tree).includes(note));
 m.click('Xem đối chiếu câu đã chọn');assert.deepEqual(visited,['fake-wrong']);
 select(0,'fake-partial');assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value,'');assert.match(text(m.tree),/đối chiếu riêng từng ý/);
 select(0,'fake-wrong');assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value,note);assert.equal(all(m.tree,n=>n.type==='li').length,3);
 all(m.tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'x'.repeat(800)}});m.draw();assert.equal(all(m.tree,n=>n.type==='textarea')[0].props.value.length,600);
 select(0,'ngoai-danh-sach');submit();assert.match(text(m.tree),/Em chọn một câu trước/);m.unmount();
});
test('Mọi câu/nguyên nhân tạo đúng phiếu riêng; thay nguyên nhân bỏ kết quả cũ',()=>{
 const m=mount(file,{exam,draft});
 for(const id of ['fake-wrong','fake-partial','fake-blank'])for(const cause of REFLECTION_CAUSES){
  all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:id}});m.draw();all(m.tree,n=>n.type==='select')[1].props.onChange({target:{value:cause.id}});m.draw();assert.equal(all(m.tree,n=>n.type==='li').length,0);
  all(m.tree,n=>n.type==='form')[0].props.onSubmit({preventDefault(){}});m.draw();assert.deepEqual(all(m.tree,n=>n.type==='li').map(text),[...cause.steps]);
 }
 m.unmount();const fresh=mount(file,{exam,draft});assert.equal(all(fresh.tree,n=>n.type==='select')[0].props.value,'');fresh.unmount();
});
test('SSR, nhãn, không storage/mạng, lazy mở đóng và boundary khôi phục',()=>{
 const {renderToStaticMarkup}=require('react-dom/server'),View=load(file).default,html=renderToStaticMarkup(React.createElement(View,{exam,draft}));assert.match(html,/Câu em muốn gỡ/);assert.match(html,/không tự kết luận nguyên nhân/);
 const src=readFileSync(join(root,file),'utf8')+readFileSync(join(root,'src/native/exams/result-reflection.ts'),'utf8');assert.doesNotMatch(src,/localStorage|sessionStorage|fetch\(|setInterval|setTimeout|\u2014/);
 const tool=mount('src/native/exams/ResultReflectionTool.tsx',{exam,draft});assert.equal(all(tool.tree,n=>n.type===React.Suspense).length,0);tool.click('Mở phiếu tự sửa');assert.equal(all(tool.tree,n=>n.type===React.Suspense).length,1);
 const first=all(tool.tree,n=>n.type===React.Suspense)[0].props.children;all(tool.tree,n=>typeof n.type==='function'&&n.type.name==='ReflectionBoundary')[0].props.onRetry();tool.draw();const retried=all(tool.tree,n=>n.type===React.Suspense)[0].props.children;assert.notEqual(retried.type,first.type);assert.equal(retried.props.focusOnMount,true);
 tool.click('Đóng phiếu tự sửa');assert.equal(all(tool.tree,n=>n.type===React.Suspense).length,0);tool.unmount();const focused=mount(file,{exam,draft,focusOnMount:true});assert.equal(focused.focused.type,'h2');focused.unmount();
 const {ReflectionBoundary}=load('src/native/exams/ResultReflectionTool.tsx');let retry=0;const boundary=new ReflectionBoundary({onRetry:()=>retry++});boundary.state=ReflectionBoundary.getDerivedStateFromError();const tree=boundary.render();assert.match(text(tree),/Kết quả và phần đối chiếu/);all(tree,n=>n.type==='button')[0].props.onClick();assert.equal(retry,1);
});
test('Tích hợp chỉ kết quả Thi thử, có key lượt/phiên bản và nhảy đúng câu',()=>{
 const source=readFileSync(join(root,'src/native/exams/AttemptResult.tsx'),'utf8');assert.match(source,/kind==='exam'&&!props.isHomework&&draft.submittedAt!==null&&<ResultReflectionTool/);assert.match(source,/initialQuestionId=\{reviewTarget.id\|\|undefined\}/);assert.match(source,/revision:value.revision\+1/);
});
test('Tích hợp thực chỉ bật đúng route; xem lại cùng câu tăng yêu cầu nhưng giữ vùng đối chiếu',()=>{
 const state={draft,resultHeading:{current:null},score:{ok:true},unsaved:false,conflict:{current:false},pdfReady:true,retake(){}};
 for(const [kind,isHomework,submitted,expected] of [['exam',false,true,1],['practice',false,true,0],['exam',true,true,0],['exam',false,false,0]] as const){
  const m=mount('src/native/exams/AttemptResult.tsx',{props:{exam,catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:{...draft,submittedAt:submitted?draft.submittedAt:null}}});
  try{const tools=all(m.tree,n=>n.type?.name==='ResultReflectionTool');assert.equal(tools.length,expected);const review=()=>all(m.tree,n=>n.type?.name==='ExamReview')[0];assert.equal(review().props.advancedFilters,kind==='exam'&&!isHomework);
   if(expected){const key=review().key;assert.equal(review().props.reviewRequestRevision,0);tools[0].props.onReview('fake-wrong');m.draw();assert.equal(review().props.initialQuestionId,'fake-wrong');assert.equal(review().key,key);assert.equal(review().props.reviewRequestRevision,1);all(m.tree,n=>n.type?.name==='ResultReflectionTool')[0].props.onReview('fake-wrong');m.draw();assert.equal(review().key,key);assert.equal(review().props.reviewRequestRevision,2);
    const nextDraft={...draft,attemptId:'luot-gia-khac'};m.draw({props:{exam,catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:nextDraft}});assert.notEqual(review().key,key);const nextKey=review().key;m.draw({props:{exam:{...exam,versionHash:'c'.repeat(64)},catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:nextDraft}});assert.notEqual(review().key,nextKey);const versionKey=review().key;m.draw({props:{exam:{...exam,versionHash:'c'.repeat(64),answerKeyVersion:'v2'},catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:nextDraft}});assert.notEqual(review().key,versionKey);}
  }finally{m.unmount();}
 }
});
finish();
