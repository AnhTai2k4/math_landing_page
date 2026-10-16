import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import type {Draft} from '../src/native/exams/store';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let values:any[]=[],cursor=0;
const hooks={useId:()=>':retry-test:',useState:(initial:any)=>{const i=cursor++,slots=values;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];}};
const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkRetry.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};
new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,...hooks}:id.endsWith('.css')?{}:require(id),mod,mod.exports);
const {default:Retry,homeworkRetryQuestions,checkRetryAnswer,sourceRetrySteps}=mod.exports;

// Toàn bộ đề, nguồn và lượt làm dưới đây là dữ liệu GIẢ, không đọc hồ sơ học sinh.
const exam:PracticeExam={id:'mtm-preview-retry-fake',title:'Đề GIẢ kiểm ôn câu sai',grade:10,period:'GK1',durationMinutes:10,rubricVersion:'MTM-BTVN-10-v1',versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Bộ đề GIẢ để kiểm thử',sourceUrl:'https://example.invalid/de-gia',sourceMaterial:{title:'Đề GIẢ',publisher:'Kiểm thử cục bộ',version:'fake-v1',locator:'3 câu giả'},publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,questionCount:3,sections:[{label:'I · Trắc nghiệm',kind:'mc',count:1},{label:'II · Đúng sai',kind:'tf',count:1},{label:'III · Trả lời ngắn',kind:'short',count:1}],questions:[
  {id:'fake-mc',sourceRef:'Đề GIẢ, câu 1',kind:'mc',maxMillipoints:4000,prompt:'Giải phương trình $2x+1=5$ trên tập số thực.',choices:['-2','0','2','4'],answer:'C',solution:'Bước 1: Trừ 1 ở hai vế, được $2x=4$.\nBước 2: Chia hai vế cho 2, được $x=2$. Kiểm tra: $2\\cdot2+1=5$.'},
  {id:'fake-tf',sourceRef:'Đề GIẢ, câu 2',kind:'tf',maxMillipoints:4000,prompt:'Cho $x=2$. Xét đúng sai.',statements:['$x>0$','$x^2=4$','$x+1=2$','$x$ là số chẵn'],answer:[true,true,false,true],pointsByCorrectCount:[0,1000,2000,3000,4000],solution:'Thay $x=2$: các ý a, b, d đúng; ý c sai vì $2+1=3$.'},
  {id:'fake-short',sourceRef:'Đề GIẢ, câu 3',kind:'short',mode:'rational',maxMillipoints:2000,prompt:'Giải phương trình $2x=1$ trên tập số thực.',acceptedAnswers:['1/2'],solution:'Bước 1: Chia hai vế cho 2.\nBước 2: $x=1/2$. Thay lại: $2\\cdot(1/2)=1$.'},
]};
const draft:Draft={version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:exam.rubricVersion,attemptId:'fake-attempt',startedAt:1000,deadline:601000,updatedAt:2000,submittedAt:2000,revision:1,answers:{'fake-mc':'A','fake-tf':[true,false,false,true],'fake-short':'0,5'}};
const state:HomeworkState={exam,draft,fullName:'Học sinh GIẢ',className:'Lớp GIẢ',lessonCode:'buoi-gia',dueAt:null,maxAttempts:5,attemptsUsed:1,bestScore:5,demo:true,receipts:[{attemptId:'fake-attempt',attemptNumber:1,score:5,submittedAt:2000,elapsedSeconds:1,late:false,timedOut:false}]};

// Kiểm Toán độc lập từ phương trình, trước khi gọi bộ so đáp án của component.
assert.deepEqual(exam.questions[0].choices.map((v:string)=>2*Number(v)+1===5),[false,false,true,false]);
const x=2;assert.deepEqual([x>0,x*x===4,x+1===2,x%2===0],[true,true,false,true]);
assert.equal(2*(1/2),1);assert.notEqual(2*(1/3),1); // Hệ số 2 khác 0, mỗi phương trình có đúng một nghiệm thực.

assert.deepEqual(homeworkRetryQuestions(state).map((r:any)=>r.question.id),['fake-mc','fake-tf']);
for(const changed of [
  {...state,receipts:[]},
  {...state,receipts:[{...state.receipts[0],attemptId:'another-fake-attempt'}]},
  {...state,draft:{...draft,submittedAt:null}},
  {...state,draft:{...draft,examVersionHash:'c'.repeat(64)}},
  {...state,solutionsAvailable:false},
])assert.deepEqual(homeworkRetryQuestions(changed),[],'Không mở khi chưa ACK đúng bản nộp, khác phiên bản hoặc lời giải còn khóa');
assert.deepEqual(homeworkRetryQuestions({...state,receipts:[{...state.receipts[0],submittedAt:2001}]}).map((r:any)=>r.question.id),['fake-mc','fake-tf'],'Biên nhận cùng lượt không bị khóa chỉ vì thời điểm máy chủ lệch draft');
assert.deepEqual(homeworkRetryQuestions({...state,exam:{...exam,questions:exam.questions.map(q=>({...q,solution:undefined}))}}),[]);
assert.deepEqual(homeworkRetryQuestions({...state,draft:{...draft,answers:{'fake-mc':'C','fake-tf':[true,true,false,true],'fake-short':'1/2'}}}),[]);
assert.deepEqual(homeworkRetryQuestions({...state,draft:{...draft,answers:{}}}),[],'Không coi bỏ trống là một câu đã làm sai');
assert.equal(sourceRetrySteps('Chỉ có đáp án C.').length,0);
assert.equal(sourceRetrySteps('Bước 1: Chỉ một bước.').length,0);
assert.deepEqual(sourceRetrySteps(exam.questions[0].solution),exam.questions[0].solution!.split('\n'));
assert.deepEqual(sourceRetrySteps('Điều kiện: $x>0$.\nBước 1: Đọc điều kiện.\nBước 2: Đối chiếu nghiệm.'),['Bước 1: Đọc điều kiện.','Bước 2: Đối chiếu nghiệm.']);
assert.deepEqual(sourceRetrySteps('Đáp án: C.\nBước 1: Trừ 1 ở hai vế.\nBước 2: Chia hai vế cho 2.'),['Bước 1: Trừ 1 ở hai vế.','Bước 2: Chia hai vế cho 2.'],'Không lộ đáp án đứng trước bước đầu trong gợi ý');
assert.deepEqual(sourceRetrySteps('Bước 2: Thiếu bước đầu.\nBước 3: Kết luận.'),[]);

assert.equal(checkRetryAnswer(exam.questions[0],'C'),'correct');assert.equal(checkRetryAnswer(exam.questions[0],'A'),'wrong');
assert.equal(checkRetryAnswer(exam.questions[0],null),'incomplete');assert.equal(checkRetryAnswer(exam.questions[0],'E'),'invalid');
assert.equal(checkRetryAnswer(exam.questions[1],[true,true,false,true]),'correct');assert.equal(checkRetryAnswer(exam.questions[1],[true,false,false,true]),'wrong');assert.equal(checkRetryAnswer(exam.questions[1],[true,null,false,true]),'incomplete');
for(const answer of [undefined,null,'ĐĐSĐ',[],[true,true,false],[true,true,false,true,false],[true,true,null,true],new Array(4)])assert.equal(checkRetryAnswer({...exam.questions[1],answer},[true,true,false,true]),'invalid','Khóa đáp án Đ/S thiếu hoặc hỏng không làm trang đổ');
assert.equal(checkRetryAnswer(exam.questions[1],new Array(4)),'incomplete');
assert.equal(checkRetryAnswer(exam.questions[2],'2/4'),'correct');assert.equal(checkRetryAnswer(exam.questions[2],'0,5'),'correct');assert.equal(checkRetryAnswer(exam.questions[2],'1/3'),'wrong');assert.equal(checkRetryAnswer(exam.questions[2],'1/0'),'invalid');
assert.equal(checkRetryAnswer({...exam.questions[2],mode:'numeric',acceptedAnswers:['0.5']},'1/2'),'invalid');
assert.equal(checkRetryAnswer({...exam.questions[2],mode:'exact',acceptedAnswers:['AB']},'ab'),'wrong');

function find(tree:any,predicate:(node:any)=>boolean):any{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(n=>find(n,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:find(tree.props?.children,predicate);
}
const button=(tree:any,label:string)=>find(tree,n=>n.type==='button'&&n.props.children===label);
const original=JSON.stringify(state),originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('Phần ôn cục bộ không được gửi yêu cầu mạng');};
try{
  const parentValues:any[]=[];
  function drawParent(input=state){values=parentValues;cursor=0;return Retry({state:input});}
  let tree=drawParent();
  const closedHtml=renderToStaticMarkup(tree);assert.match(closedHtml,/không tính điểm và không dùng thêm lượt/);assert.ok(!closedHtml.includes('fake-mc'));
  button(tree,'Ôn một câu của lượt này').props.onClick();tree=drawParent();
  const exerciseNode=find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');assert.ok(exerciseNode);
  const exerciseValues:any[]=[];
  const draw=()=>{values=exerciseValues;cursor=0;return exerciseNode.type(exerciseNode.props);};
  let exercise=draw();
  assert.equal(find(exercise,n=>n.props?.role==='status'),null,'Không để thông báo kết quả rỗng khi chưa kiểm tra');
  const support=find(exercise,n=>n.props?.className==='btvn-retry-support');assert.ok(button(support,'Xem gợi ý bước 1'));assert.ok(button(support,'Xem lời giải đầy đủ của câu ôn'),'Gợi ý và lời giải cùng một nhóm hỗ trợ');
  find(exercise,n=>n.type==='input'&&n.props.value==='A').props.onChange();exercise=draw();
  find(exercise,n=>n.type==='form').props.onSubmit({preventDefault(){}});exercise=draw();assert.match(renderToStaticMarkup(exercise),/Chưa khớp đáp án/);
  find(exercise,n=>n.type==='input'&&n.props.value==='C').props.onChange();exercise=draw();assert.ok(!renderToStaticMarkup(exercise).includes('Chưa khớp đáp án'));
  find(exercise,n=>n.type==='form').props.onSubmit({preventDefault(){}});exercise=draw();assert.match(renderToStaticMarkup(exercise),/Em đã sửa được lỗi này/);assert.match(find(exercise,n=>n.props?.role==='status').props.className,/btvn-retry-success/);
  assert.ok(find(drawParent(),n=>n.type==='button'&&n.props['aria-label']?.includes('Đã sửa đúng trong phiên ôn')),'Pill ghi nhận đã sửa đúng mà không ghi điểm/lượt');
  button(exercise,'Xem gợi ý bước 1').props.onClick();exercise=draw();let html=renderToStaticMarkup(exercise);assert.match(html,/Trừ 1 ở hai vế/);assert.ok(!html.includes('Chia hai vế cho 2'));
  button(exercise,'Xem gợi ý bước 2').props.onClick();exercise=draw();html=renderToStaticMarkup(exercise);assert.match(html,/Chia hai vế cho 2/);assert.equal(button(exercise,'Đã mở hết các bước nguồn').props.disabled,true);
  button(exercise,'Xem lời giải đầy đủ của câu ôn').props.onClick();exercise=draw();assert.equal(button(exercise,'Đóng lời giải câu ôn').props['aria-expanded'],true);
  const full=find(exercise,n=>n.props?.fallback===exam.questions[0].solution);assert.ok(full,'Đưa đúng lời giải gốc, đúng exam/version/question vào renderer');assert.equal(full.props.examId,exam.id);assert.equal(full.props.questionId,'fake-mc');assert.equal(full.props.versionHash,exam.versionHash);
  button(exercise,'Thử lại từ đầu').props.onClick();exercise=draw();assert.ok(!renderToStaticMarkup(exercise).includes('Em đã sửa được lỗi này'));assert.equal(find(exercise,n=>n.type==='input'&&n.props.value==='C').props.checked,false);assert.ok(button(exercise,'Xem gợi ý bước 1'));
  tree=drawParent();assert.equal(find(tree,n=>n.type==='select'),null);const tfPill=find(tree,n=>n.type==='button'&&n.props.className?.includes('btvn-retry-pill')&&!n.props.className.includes('is-correct'));assert.equal(tfPill.props['aria-pressed'],false);tfPill.props.onClick();tree=drawParent();const selected=find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');assert.equal(selected.props.item.question.id,'fake-tf');assert.notEqual(selected.key,exerciseNode.key,'Đổi câu phải tạo state ôn riêng');assert.equal(find(tree,n=>n.type==='button'&&n.props.className?.includes('btvn-retry-pill')&&!n.props.className.includes('is-correct')).props['aria-pressed'],true);
  const tfValues:any[]=[];
  const drawTf=()=>{values=tfValues;cursor=0;return selected.type(selected.props);};
  let tfTree=drawTf();find(tfTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawTf()),/Em trả lời đủ câu/);
  for(const [i,value] of [true,true,false,true].entries()){
    tfTree=drawTf(); // Tìm theo tên input để không phụ thuộc vị trí các fieldset.
    const all:any[]=[];const collect=(node:any)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return;}if(node.type==='input'&&node.props.name===`:retry-test:-tf-${i}`)all.push(node);collect(node.props?.children);};collect(tfTree);
    all[value?0:1].props.onChange();
  }
  tfTree=drawTf();find(tfTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawTf()),/Em đã sửa được lỗi này/);
  values=[];cursor=0;const malformedTf=selected.type({...selected.props,item:{question:{...exam.questions[1],answer:undefined},index:1}});assert.doesNotThrow(()=>renderToStaticMarkup(malformedTf),'Màn Đ/S không gọi map trên khóa đáp án thiếu');
  const shortValues:any[]=[];
  const drawShort=()=>{values=shortValues;cursor=0;return selected.type({...selected.props,exam,item:{question:exam.questions[2],index:2}});};
  let shortTree=drawShort();find(shortTree,n=>n.type==='input'&&n.props.type==='text').props.onChange({target:{value:'1/0'}});shortTree=drawShort();find(shortTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(find(drawShort(),n=>n.type==='input').props['aria-invalid'],true);
  find(drawShort(),n=>n.type==='input').props.onChange({target:{value:'2/4'}});shortTree=drawShort();find(shortTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawShort()),/Em đã sửa được lỗi này/);
  tree=drawParent();
  button(tree,'Đóng phần ôn').props.onClick();assert.ok(button(drawParent(),'Ôn một câu của lượt này'));
  const nextAttempt={...state,draft:{...draft,attemptId:'fake-attempt-next'},receipts:[{...state.receipts[0],attemptId:'fake-attempt-next'}]};
  tree=drawParent(nextAttempt);assert.ok(button(tree,'Ôn một câu của lượt này'));button(tree,'Ôn một câu của lượt này').props.onClick();tree=drawParent(nextAttempt);assert.equal(find(tree,n=>n.type==='button'&&n.props.className?.includes('is-correct')),null,'Lượt mới không giữ dấu đã sửa đúng của lượt trước');assert.equal(find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise').props.item.question.id,'fake-mc','Lượt mới chọn lại câu đầu');
  const nextVersion={...nextAttempt,exam:{...exam,versionHash:'d'.repeat(64)},draft:{...nextAttempt.draft,examVersionHash:'d'.repeat(64)}};assert.ok(button(drawParent(nextVersion),'Ôn một câu của lượt này'),'Đổi phiên bản cũng đóng phần ôn cũ');
  assert.equal(JSON.stringify(state),original,'Câu trả lời ôn không sửa bản nộp, receipt, điểm hay số lượt gốc');
}finally{globalThis.fetch=originalFetch;}
console.log('Đạt ôn một lỗi BTVN: ACK đúng lượt và khóa lời giải; câu sai có nguồn; Toán kiểm độc lập; thử đáp án, gợi ý nguyên văn, lời giải, reset và đổi câu; giữ nguyên điểm/lượt và không gọi mạng.');
