import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {Draft} from '../src/native/exams/store';
import {PRACTICE_EXAMS,readyExams,validatePracticeExam} from '../src/native/exams/data';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
import {resultRecallItems,recallPdfPage} from '../src/native/exams/result-recall';
import {practiceVersion,PRACTICE_ERRATA} from '../src/native/exams/practice-errata';
import {all,load,mount,React,require,root,text} from './daily19-ui-harness.mts';
import {suite} from './exams-harness.mts';
const {test,finish}=suite('D23-RECALL-'),file='src/native/exams/ResultRecall.tsx';
// Toàn bộ đề, nguồn và lượt nộp sau là GIẢ, chỉ giữ ở RAM của test.
const exam:PracticeExam={id:'mtm-preview-recall-fake',title:'Đề GIẢ cho thẻ tự ôn',grade:10,period:'GK1',durationMinutes:10,rubricVersion:'MTM-FLEX-10-v1',versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Đề GIẢ kiểm thử local',sourceUrl:'https://example.invalid/de-gia',sourceMaterial:{title:'Đề GIẢ',publisher:'Kiểm thử cục bộ',version:'fake-v1',locator:'4 câu giả'},publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,questionCount:4,sections:[{label:'I · Trắc nghiệm',kind:'mc',count:2},{label:'II · Đúng sai',kind:'tf',count:1},{label:'III · Trả lời ngắn',kind:'short',count:1}],questions:[
  {id:'fake-correct',sourceRef:'Đề GIẢ, câu 1',kind:'mc',maxMillipoints:2000,prompt:'Tính $1+1$.',choices:['1','2','3','4'],answer:'B',solution:'$1+1=2$.'},
  {id:'fake-wrong',sourceRef:'Đề GIẢ, câu 2',kind:'mc',maxMillipoints:2000,prompt:'Giải $2x+1=5$.',choices:['-2','0','2','4'],answer:'C',solution:'Trừ 1 ở hai vế được $2x=4$, chia cho 2 được $x=2$.'},
  {id:'fake-partial',sourceRef:'Đề GIẢ, câu 3',kind:'tf',maxMillipoints:4000,prompt:'Cho $x=2$, xét đúng sai.',statements:['$x>0$','$x^2=4$','$x+1=2$','$x$ chẵn'],answer:[true,true,false,true],pointsByCorrectCount:[0,1000,2000,3000,4000],solution:'Thay $x=2$: a, b, d đúng, c sai vì $2+1=3$.'},
  {id:'fake-blank',sourceRef:'Đề GIẢ, câu 4',kind:'short',mode:'rational',maxMillipoints:2000,prompt:'Giải $2x=1$.',acceptedAnswers:['1/2'],solution:'Chia hai vế cho 2 được $x=1/2$.'},
]};
const draft:Draft={version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:exam.rubricVersion,attemptId:'luot-gia-recall',startedAt:1000,deadline:601000,updatedAt:2000,submittedAt:2000,revision:1,answers:{'fake-correct':'B','fake-wrong':'A','fake-partial':[true,false,false,true],'fake-blank':''}};
const props=()=>({exam,draft,items:resultRecallItems(exam,draft)});
const blankDraft=(value:PracticeExam):Draft=>({version:1,examId:value.id,examVersionHash:value.versionHash,rubricVersion:value.rubricVersion,...(value.rubricVersion===MTM_SCORING_VERSION?{answerKeyVersion:value.answerKeyVersion}:{}),attemptId:'fake-catalog-probe',startedAt:1000,deadline:1000+value.durationMinutes*60000,updatedAt:2000,submittedAt:2000,revision:1,answers:Object.fromEntries(value.questions.map(q=>[q.id,q.kind==='tf'?[null,null,null,null]:q.kind==='mc'?null:'']))});

test('Chọn đúng câu sai, một phần, bỏ trống; đối chiếu Toán độc lập, giữ nguyên dữ liệu',()=>{
  assert.equal(validatePracticeExam(exam).valid,true);
  assert.equal(1+1,2);assert.deepEqual([-2,0,2,4].map(x=>2*x+1===5),[false,false,true,false]);
  const x=2;assert.deepEqual([x>0,x*x===4,x+1===2,x%2===0],[true,true,false,true]);assert.equal(2*(1/2),1);
  const before=JSON.stringify({exam,draft}),items=resultRecallItems(exam,draft);
  assert.deepEqual(items.map(item=>[item.q.id,item.status,item.index]),[['fake-wrong','wrong',1],['fake-partial','partial',2],['fake-blank','unanswered',3]]);
  assert.equal(JSON.stringify({exam,draft}),before);
});

test('Không ôn trước nộp, lệch đề/phiên bản/thang chấm, snapshot hỏng hoặc thiếu lời giải',()=>{
  for(const change of [{submittedAt:null},{examId:'de-khac'},{examVersionHash:'c'.repeat(64)},{rubricVersion:'khac'},{answers:null},{answers:[]},{answers:{'khong-thuoc-de':'A'}}])assert.deepEqual(resultRecallItems(exam,{...draft,...change} as any),[]);
  assert.deepEqual(resultRecallItems({...exam,responseMode:'questions-only'},draft),[]);
  const noSolution={...exam,questions:exam.questions.map(q=>({...q,solution:undefined}))};assert.deepEqual(resultRecallItems(noSolution,draft),[]);
  const noStatements={...exam,questions:exam.questions.map(q=>q.kind==='tf'?{...q,statements:undefined,sourceContent:{questions:[{path:'fake/statement.png',sha256:'d'.repeat(64),width:100,height:100,sourcePage:1}],solutions:[{path:'fake/solution.png',sha256:'e'.repeat(64),width:100,height:100,sourcePage:2}]}}:q)};
  assert.equal(validatePracticeExam(noStatements).valid,true);
  assert.deepEqual(resultRecallItems(noStatements,draft).map(item=>item.q.id),['fake-wrong','fake-blank']);
  const correct={...draft,answers:{'fake-correct':'B','fake-wrong':'C','fake-partial':[true,true,false,true],'fake-blank':'1/2'}} as Draft;
  assert.deepEqual(resultRecallItems(exam,correct),[]);
});

test('Tự giải trước khi lật thẻ, ghi nhớ/ôn lại, tổng kết và ôn đúng thẻ đã chọn',()=>{
  const before=JSON.stringify({exam,draft}),m=mount(file,props(),'RecallSession');try{
    assert.match(text(m.tree),/không chấm lại hoặc đổi điểm/);m.click('Bắt đầu ôn 3 thẻ');assert.equal(m.focused.type,'h3');
    assert.equal(all(m.tree,n=>n.type==='h4').length,0);assert.equal(all(m.tree,n=>n.type==='button'&&text(n).startsWith('Đã hiểu')).length,0);
    const reveal=all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.onClick;
    m.click('Em đã thử, xem đáp án và lời giải');assert.equal(m.focused.type,'div');assert.match(text(m.tree),/Đáp án: C/);
    const mark=all(m.tree,n=>n.type==='button'&&text(n)==='Cần ôn lại, sang thẻ tiếp')[0].props.onClick;
    m.click('Cần ôn lại, sang thẻ tiếp');mark();reveal();m.draw();assert.match(text(m.tree),/Thẻ 2\/3/);assert.equal(all(m.tree,n=>n.type==='h4').length,0);
    m.click('Em đã thử, xem đáp án và lời giải');assert.match(text(m.tree),/a\) Đúng; b\) Đúng; c\) Sai; d\) Đúng/);m.click('Đã hiểu, sang thẻ tiếp');
    m.click('Em đã thử, xem đáp án và lời giải');m.click('Đã hiểu, sang thẻ tiếp');assert.match(text(m.tree),/Tự đánh dấu đã hiểu: 2/);assert.match(text(m.tree),/Cần ôn lại: 1/);assert.equal(m.focused.type,'div');
    const list=all(m.tree,n=>n.type==='li');assert.equal(list.length,1);assert.match(text(list[0]),/Câu 2/);
    m.click('Ôn lại 1 thẻ đã chọn');assert.match(text(m.tree),/Thẻ 1\/1/);assert.match(text(m.tree),/Câu 2/);
    m.click('Em đã thử, xem đáp án và lời giải');m.click('Đã hiểu, sang thẻ tiếp');assert.match(text(m.tree),/Cần ôn lại: 0/);
    m.click('Kết thúc phiên ôn');assert.equal(m.focused.type,'h2');assert.match(text(m.tree),/Bắt đầu ôn 3 thẻ/);assert.equal(JSON.stringify({exam,draft}),before);
  }finally{m.unmount();}
});

test('Giới hạn 5 thẻ, dừng bỏ dấu RAM, nguồn và lời giải chưa mở không xuất hiện',()=>{
  const m=mount(file,props(),'RecallSession');try{
    const select=all(m.tree,n=>n.type==='select')[0];select.props.onChange({target:{value:'5'}});m.draw();assert.equal(all(m.tree,n=>n.type==='select')[0].props.value,5);
    m.click('Bắt đầu ôn 3 thẻ');assert.match(text(m.tree),/MTM sưu tầm và biên soạn/);assert.match(text(m.tree),/Đề GIẢ, câu 2/);
    assert.equal(all(m.tree,n=>n.props?.fallback===exam.questions[1].solution).length,0);
    m.click('Dừng phiên ôn');m.click('Bắt đầu ôn 3 thẻ');assert.match(text(m.tree),/Thẻ 1\/3/);assert.equal(all(m.tree,n=>n.type==='h4').length,0);
  }finally{m.unmount();}
});

test('Đúng khóa đáp án MTM mới được mở thẻ, không nhận khóa thiếu hoặc khác bản',()=>{
  const locked={...exam,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fake-key-v1',sourceComplete:true,questionCount:1,sections:[{label:'I · Trắc nghiệm',kind:'mc',count:1}],questions:[{...exam.questions[1],maxMillipoints:10000,maxPoints:{numerator:'10',denominator:'1'}}]} as PracticeExam;
  const submitted={...draft,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fake-key-v1',answers:{'fake-wrong':'A'}} as Draft;
  assert.equal(validatePracticeExam(locked).valid,true);assert.equal(resultRecallItems(locked,submitted).length,1);
  assert.deepEqual(resultRecallItems(locked,{...submitted,answerKeyVersion:'fake-key-v2'}),[]);
  const missing={...submitted};delete missing.answerKeyVersion;assert.deepEqual(resultRecallItems(locked,missing),[]);
});

test('Callback bắt đầu/dừng cũ không can thiệp phiên mới; 5 thẻ là trần thật',()=>{
  const source=props(),items=Array.from({length:8},(_,i)=>({...source.items[i%3],q:{...source.items[i%3].q,id:'fake-card-'+i}}));
  const m=mount(file,{...source,items},'RecallSession');try{
    const oldStart=all(m.tree,n=>n.type==='button'&&text(n)==='Bắt đầu ôn 3 thẻ')[0].props.onClick;
    all(m.tree,n=>n.type==='select')[0].props.onChange({target:{value:'5'}});m.draw();m.click('Bắt đầu ôn 5 thẻ');
    const oldStop=all(m.tree,n=>n.type==='button'&&text(n)==='Dừng phiên ôn')[0].props.onClick;
    m.click('Em đã thử, xem đáp án và lời giải');m.click('Đã hiểu, sang thẻ tiếp');oldStart();oldStop();m.draw();
    assert.match(text(m.tree),/Thẻ 2\/5/);m.click('Dừng phiên ôn');assert.equal(m.focused.type,'h2');
  }finally{m.unmount();}
});

test('Danh mục đề hiện có tạo được thẻ với lượt GIẢ đã nộp, không cần dữ liệu học sinh',()=>{
  const available=readyExams(PRACTICE_EXAMS).filter(value=>{
    const version=practiceVersion(value);return resultRecallItems(version,blankDraft(version)).length>0;
  });
  assert.ok(available.length>0,'Phải dùng được ít nhất một đề hiện hành, không chỉ fixture.');
  console.log('D23 đường xem local: /thi-thu/'+available[0].id+' sau khi nộp; '+available.length+' đề có thể tạo thẻ từ lượt GIẢ trống.');
});

test('PDF đúng nguồn/trang: chờ tải, bỏ callback cũ, giữ đề TF đủ bốn ý và lời giải cùng bản',()=>{
  const current=practiceVersion(readyExams(PRACTICE_EXAMS)[0]),submitted=blankDraft(current),items=resultRecallItems(current,submitted),before=JSON.stringify({current,submitted});
  assert.ok(items.length>=3);assert.equal(recallPdfPage(current,items[0].q),1);
  assert.equal(recallPdfPage(current,{...items[0].q,sourcePdfPage:999}),undefined);
  const m=mount(file,{exam:current,draft:submitted,items},'RecallSession');try{
    m.click('Bắt đầu ôn 3 thẻ');let reader=all(m.tree,n=>n.props.file===current.sourcePdf)[0];assert.equal(reader.props.targetPage,1);assert.equal(reader.props.allowFullscreen,false);
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,true);
    m.click('Em đã thử, xem đáp án và lời giải');assert.equal(all(m.tree,n=>n.type==='h4').length,0);
    const oldReady=reader.props.onReady;oldReady(true);m.draw();m.click('Em đã thử, xem đáp án và lời giải');
    const detailed=all(m.tree,n=>n.props.questionId===items[0].q.id&&n.props.fallback===items[0].q.solution)[0];assert.equal(detailed.props.examId,current.id);assert.equal(detailed.props.versionHash,current.versionHash);
    m.click('Đã hiểu, sang thẻ tiếp');oldReady(true);m.draw();assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,true);
    reader=all(m.tree,n=>n.props.file===current.sourcePdf)[0];reader.props.onReady(true);m.draw();
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,false);
    oldReady(true);oldReady(false);m.draw();
    assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,false);
    m.click('Dừng phiên ôn');m.click('Bắt đầu ôn 3 thẻ');oldReady(true);m.draw();assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,true);
    reader=all(m.tree,n=>n.props.file===current.sourcePdf)[0];reader.props.onReady(true);m.draw();assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,false);
    oldReady(true);oldReady(false);m.draw();assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,false);
    reader.props.onReady(false);m.draw();assert.equal(all(m.tree,n=>n.type==='button'&&text(n)==='Em đã thử, xem đáp án và lời giải')[0].props.disabled,true);
    assert.equal(JSON.stringify({current,submitted}),before);
  }finally{m.unmount();}
  const tf=items.find(item=>item.q.kind==='tf')!;assert.ok(tf);const tfView=mount(file,{exam:current,draft:submitted,items:[tf]},'RecallSession');try{tfView.click('Bắt đầu ôn 1 thẻ');assert.match(text(tfView.tree),/đọc đủ bốn mệnh đề/);}finally{tfView.unmount();}
});

test('Hai bản MTM đính chính hiện điều kiện trong thẻ, không đổi id/hash của lời giải',()=>{
  for(const erratum of PRACTICE_ERRATA){
    const current=practiceVersion(PRACTICE_EXAMS.find(value=>value.id===erratum.baseId)!),submitted=blankDraft(current);
    assert.equal(current.id,erratum.id);const m=mount(file,{exam:current,draft:submitted,items:resultRecallItems(current,submitted)},'RecallSession');
    try{assert.ok(text(m.tree).includes(erratum.condition));assert.match(text(m.tree),/PDF gốc giữ nguyên/);}finally{m.unmount();}
  }
});

test('Chỉ gắn vào kết quả thi thử, cô lập lỗi tải, SSR và CSS riêng đáp ứng',()=>{
  const state={draft,resultHeading:{current:null},score:{ok:true},unsaved:false,conflict:{current:false},pdfReady:true,retake(){}};
  for(const [kind,isHomework,submittedAt,expected]of [['exam',false,2000,1],['practice',false,2000,0],['exam',true,2000,0],['exam',false,null,0]]as const){
    const m=mount('src/native/exams/AttemptResult.tsx',{props:{exam,catalogUrl:'/thi-thu',kind,isHomework},state:{...state,draft:{...draft,submittedAt}}});
    try{assert.equal(all(m.tree,n=>n.type?.name==='ResultRecallTool').length,expected);}finally{m.unmount();}
  }
  const html=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default,{exam,draft}));assert.match(html,/Thẻ tự ôn 5 phút/);assert.match(html,/Bắt đầu ôn 3 thẻ/);
  const empty=require('react-dom/server').renderToStaticMarkup(React.createElement(load(file).default,{exam,draft:{...draft,submittedAt:null}}));assert.match(empty,/Chưa có câu phù hợp/);
  const {RecallBoundary}=load('src/native/exams/ResultRecallTool.tsx');const boundary=new RecallBoundary({children:null});boundary.state=RecallBoundary.getDerivedStateFromError();assert.match(text(boundary.render()),/vẫn xem được kết quả/);
  const code=readFileSync(join(root,file),'utf8');assert.doesNotMatch(code,/fetch\(|localStorage|sessionStorage|setInterval|saveDraft|submitDraft/);
  assert.match(readFileSync(join(root,'src/native/exams/ResultRecallTool.tsx'),'utf8'),/lazy\(\(\)=>import\('\.\/ResultRecall'\)\)/);
  const css=readFileSync(join(root,'src/native/exams/result-recall.css'),'utf8');assert.match(css,/min-height:48px/);assert.match(css,/:focus-visible/);assert.match(css,/@media\(max-width:600px\)/);
});
test('Lỗi tải thẻ có thể thử lại bằng lazy mới và ranh lỗi mới, giữ nguyên bài thi',()=>{
  const before=JSON.stringify({exam,draft}),m=mount('src/native/exams/ResultRecallTool.tsx',{exam,draft});
  const {RecallBoundary}=load('src/native/exams/ResultRecallTool.tsx');
  try{
    const first=m.tree,firstView=first.props.children.props.children.type;
    const boundary=new RecallBoundary(first.props);boundary.state=RecallBoundary.getDerivedStateFromError();
    const retry=all(boundary.render(),n=>n.type==='button'&&text(n)==='Thử mở lại thẻ ôn')[0];assert.ok(retry);
    retry.props.onClick();m.draw();
    assert.notEqual(m.tree.key,first.key);assert.notEqual(m.tree.props.children.props.children.type,firstView);
    assert.equal(m.tree.props.children.props.children.props.exam,exam);assert.equal(m.tree.props.children.props.children.props.draft,draft);
    assert.equal(m.tree.props.children.props.children.props.focusOnMount,true);
    const fresh=new RecallBoundary(m.tree.props);assert.equal(fresh.state.failed,false);
    assert.equal(JSON.stringify({exam,draft}),before);
    const oldKey=m.tree.key;m.draw({exam,draft:{...draft,attemptId:'fake-another-attempt'}});assert.notEqual(m.tree.key,oldKey);
  }finally{m.unmount();}
});
test('Khôi phục phiên tạo lazy PDF và lời giải mới, giữ ổn định khi đổi thẻ và trả focus về tiêu đề',()=>{
  const current=practiceVersion(readyExams(PRACTICE_EXAMS)[0]),submitted=blankDraft(current),items=resultRecallItems(current,submitted);
  const first=mount(file,{exam:current,draft:submitted,items},'RecallSession');
  let pdfType:any,solutionType:any;
  try{
    first.click('Bắt đầu ôn 3 thẻ');let reader=all(first.tree,n=>n.props.file===current.sourcePdf)[0];pdfType=reader.type;
    reader.props.onReady(true);first.draw();first.click('Em đã thử, xem đáp án và lời giải');
    solutionType=all(first.tree,n=>n.props.questionId===items[0].q.id&&n.props.fallback===items[0].q.solution)[0].type;
    first.click('Đã hiểu, sang thẻ tiếp');reader=all(first.tree,n=>n.props.file===current.sourcePdf)[0];assert.equal(reader.type,pdfType);
  }finally{first.unmount();}
  const restored=mount(file,{exam:current,draft:submitted,items,focusOnMount:true},'RecallSession');
  try{
    assert.equal(restored.focused.type,'h2');restored.click('Bắt đầu ôn 3 thẻ');const reader=all(restored.tree,n=>n.props.file===current.sourcePdf)[0];
    assert.notEqual(reader.type,pdfType);reader.props.onReady(true);restored.draw();restored.click('Em đã thử, xem đáp án và lời giải');
    assert.notEqual(all(restored.tree,n=>n.props.questionId===items[0].q.id&&n.props.fallback===items[0].q.solution)[0].type,solutionType);
  }finally{restored.unmount();}
  // Cùng một module, tránh việc harness tải module mới che mất cache lazy cấp module.
  const created:any[]=[];
  const shared=load(file,{lazy:(factory:any)=>{const view=React.lazy(factory);created.push(view);return view;}});
  assert.equal(created.length,0);
  const render=require('react-dom/server').renderToStaticMarkup;
  render(React.createElement(shared.RecallSession,{exam:current,draft:submitted,items}));assert.equal(created.length,2);
  render(React.createElement(shared.RecallSession,{exam:current,draft:submitted,items}));assert.equal(created.length,4);
  assert.equal(new Set(created).size,4);
});
finish({note:'Đề và lượt nộp GIẢ; hook/SSR không thay trình duyệt thật. Tự đánh giá không chấm lại.'});
