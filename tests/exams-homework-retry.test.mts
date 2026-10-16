import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import type {Draft} from '../src/native/exams/store';
import {validatePracticeExam} from '../src/native/exams/data';
import {hasReadableTfStatements} from '../src/native/exams/question-statements';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
let values:any[]=[],cursor=0;
const hooks={useId:()=>':retry-test:',useRef:(initial:any)=>{const i=cursor++;if(!(i in values))values[i]={current:initial};return values[i];},useState:(initial:any)=>{const i=cursor++,slots=values;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],(next:any)=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];}};
const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkRetry.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};
new Function('require','module','exports',code)((id:string)=>id==='react'?{...React,...hooks}:id.endsWith('.css')?{}:require(id),mod,mod.exports);
const {default:Retry,homeworkRetryQuestions,checkRetryAnswer,retryMismatchStatements,sourceRetrySteps,sourceRetryStepInfo}=mod.exports;

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
// PDF đề đầy đủ ở màn kết quả không có nghĩa phần ôn nhúng được các mệnh đề.
for(const statements of [undefined,[],['','','',''],['Ý a','Ý b','Ý c'],['Ý a','Ý b','Ý c',' \t '],new Array(4)]){
  const pdfOnly={...exam,sourcePdf:{url:'https://example.invalid/fake.pdf',verified:true,sha256:'e'.repeat(64),bytes:100,totalPages:1,questionPages:[1]},questions:exam.questions.map(q=>q.kind==='tf'?{...q,statements}:q)};
  if(statements===undefined)assert.equal(validatePracticeExam(pdfOnly).valid,true,'Đề PDF đầy đủ hợp lệ nhưng phần ôn phải kiểm riêng nội dung hiển thị');
  const available=homeworkRetryQuestions({...state,exam:pdfOnly}).map((r:any)=>r.question.id);
  assert.ok(!available.includes('fake-tf'),'Không mời ôn Đ/S khi chỉ có stem và không hiển thị được bốn mệnh đề');
  if(statements===undefined)assert.deepEqual(available,['fake-mc'],'Giữ câu trắc nghiệm hợp lệ trong cùng đề PDF');
}
const cropTf={...exam,questions:exam.questions.map(q=>q.kind==='tf'?{...q,statements:undefined,sourceContent:{questions:[{path:'fake-tf.png',sha256:'f'.repeat(64),sourcePage:1,width:600,height:400}],solutions:[{path:'fake-solution.png',sha256:'e'.repeat(64),sourcePage:2,width:600,height:400}]}}:q)};
assert.equal(validatePracticeExam(cropTf).valid,true);
assert.deepEqual(homeworkRetryQuestions({...state,exam:cropTf}).map((r:any)=>r.question.id),['fake-mc'],'Ảnh nguồn không thay thế văn bản của bốn mệnh đề để ôn');
const unreadableCropStates=[undefined,['','','',''],['Ý a','Ý b','Ý c',' \t ']].flatMap(statements=>[false,true].map(privateUnavailable=>({...state,exam:{...cropTf,questions:cropTf.questions.map(q=>q.kind==='tf'?{...q,statements,sourceContent:{...q.sourceContent!,questions:q.sourceContent!.questions.map(segment=>({...segment,privateUnavailable}))}}:q)}})));
for(const input of unreadableCropStates){
  const tf=input.exam.questions[1];
  assert.equal(hasReadableTfStatements(tf),false,'Ảnh có hoặc không tải được đều không thay mệnh đề thiếu/rỗng');
  const available=homeworkRetryQuestions(input).map((r:any)=>r.question.id);
  assert.ok(!available.includes('fake-tf'),'Không mời ôn khi thiếu văn bản, kể cả ảnh nguồn hợp lệ');
  if(tf.statements===undefined)assert.deepEqual(available,['fake-mc'],'Giữ câu MC khi các câu còn lại qua validator');
}
assert.deepEqual(homeworkRetryQuestions({...state,exam:{...cropTf,questions:cropTf.questions.map(q=>q.kind==='tf'?{...q,statements:exam.questions[1].kind==='tf'?exam.questions[1].statements:undefined}:q)}}).map((r:any)=>r.question.id),['fake-mc','fake-tf'],'Giữ câu có đủ bốn văn bản ngay cả khi kèm ảnh minh họa');
const malformedSource={...state,exam:{...exam,questions:exam.questions.map(q=>({...q,prompt:undefined,text:undefined,sourceContent:{} as any}))}};
assert.doesNotThrow(()=>homeworkRetryQuestions(malformedSource),'sourceContent thiếu questions không làm đổ màn điểm');
assert.deepEqual(homeworkRetryQuestions(malformedSource),[],'Bỏ câu thiếu cả văn bản lẫn mảng ảnh nguồn');
assert.equal(sourceRetrySteps('Chỉ có đáp án C.').length,0);
assert.equal(sourceRetrySteps('Bước 1: Chỉ một bước.').length,0);
assert.deepEqual(sourceRetrySteps(exam.questions[0].solution),exam.questions[0].solution!.split('\n'));
for(const preamble of ['Điều kiện: $x>0$.','Giả sử $a>0$.','Đặt $t=x+1$.','Miền xác định: $x\\ne0$.','Đáp án: C. Điều kiện: $x>0$.'])assert.deepEqual(sourceRetrySteps(preamble+'\nBước 1: Đọc điều kiện.\nBước 2: Đối chiếu nghiệm.'),[],'Không bỏ mất mở đầu của nguồn để tạo gợi ý rời điều kiện');
assert.deepEqual(sourceRetrySteps('Đáp án: C.\nBước 1: Trừ 1 ở hai vế.\nBước 2: Chia hai vế cho 2.'),['Bước 1: Trừ 1 ở hai vế.','Bước 2: Chia hai vế cho 2.'],'Không lộ đáp án đứng trước bước đầu trong gợi ý');
assert.deepEqual(sourceRetrySteps('Đáp án: C\nBước 1: A.\nĐáp án: D\nBước 2: B.'),['Bước 1: A.','Bước 2: B.'],'Bỏ dòng đáp án thuần ở mọi vị trí, không ghép vào gợi ý');
assert.deepEqual(sourceRetrySteps('Lời giải\nBước 1: A.\nBước 2: B.'),['Bước 1: A.','Bước 2: B.'],'Nhãn lời giải thuần không làm mất gợi ý hợp lệ');
assert.equal(sourceRetryStepInfo('Lời giải:\n'+exam.questions[0].solution).reason,'available');
assert.equal(sourceRetryStepInfo('Điều kiện: $x>0$.\n'+exam.questions[0].solution).reason,'preamble');
assert.equal(sourceRetryStepInfo(exam.questions[1].solution).reason,'none','Đoạn lời giải không có bước dùng nhắc nhở chung');
assert.deepEqual(sourceRetrySteps('Bước 2: Thiếu bước đầu.\nBước 3: Kết luận.'),[]);
assert.deepEqual(sourceRetrySteps('\nBước 1: Xét điều kiện.\nĐiều kiện: $x>0$.\nBước 2: Đối chiếu nghiệm.'),['Bước 1: Xét điều kiện.\nĐiều kiện: $x>0$.','Bước 2: Đối chiếu nghiệm.'],'Điều kiện bên trong bước vẫn giữ nguyên văn');

assert.equal(checkRetryAnswer(exam.questions[0],'C'),'correct');assert.equal(checkRetryAnswer(exam.questions[0],'A'),'wrong');
assert.equal(checkRetryAnswer(exam.questions[0],null),'incomplete');assert.equal(checkRetryAnswer(exam.questions[0],'E'),'invalid');
assert.equal(checkRetryAnswer(exam.questions[1],[true,true,false,true]),'correct');assert.equal(checkRetryAnswer(exam.questions[1],[true,false,false,true]),'wrong');assert.equal(checkRetryAnswer(exam.questions[1],[true,null,false,true]),'incomplete');
for(const answer of [undefined,null,'ĐĐSĐ',[],[true,true,false],[true,true,false,true,false],[true,true,null,true],new Array(4)])assert.equal(checkRetryAnswer({...exam.questions[1],answer},[true,true,false,true]),'invalid','Khóa đáp án Đ/S thiếu hoặc hỏng không làm trang đổ');
assert.equal(checkRetryAnswer(exam.questions[1],new Array(4)),'incomplete');
assert.equal(checkRetryAnswer(exam.questions[2],'2/4'),'correct');assert.equal(checkRetryAnswer(exam.questions[2],'0,5'),'correct');assert.equal(checkRetryAnswer(exam.questions[2],'1/3'),'wrong');assert.equal(checkRetryAnswer(exam.questions[2],'1/0'),'invalid');
assert.equal(checkRetryAnswer({...exam.questions[2],mode:'numeric',acceptedAnswers:['0.5']},'1/2'),'invalid');
assert.equal(checkRetryAnswer({...exam.questions[2],mode:'exact',acceptedAnswers:['AB']},'ab'),'wrong');
assert.deepEqual(retryMismatchStatements(exam.questions[1],[true,false,false,true]),['b']);
assert.deepEqual(retryMismatchStatements(exam.questions[1],[false,false,true,true]),['a','b','c']);
assert.deepEqual(retryMismatchStatements(exam.questions[1],[true,true,false,true]),[]);
for(const incomplete of [null,[true,null,false,true],new Array(4)])assert.deepEqual(retryMismatchStatements(exam.questions[1],incomplete),[],'Chưa chọn đủ không so khớp từng ý');
assert.deepEqual(retryMismatchStatements({...exam.questions[1],answer:undefined},[true,true,false,true]),[],'Khóa hỏng không đưa phản hồi ý sai');

function find(tree:any,predicate:(node:any)=>boolean):any{
  if(!tree||typeof tree!=='object')return null;
  if(Array.isArray(tree))return tree.map(n=>find(n,predicate)).find(Boolean)??null;
  return predicate(tree)?tree:find(tree.props?.children,predicate);
}
const button=(tree:any,label:string)=>find(tree,n=>n.type==='button'&&n.props.children===label);
const statementGroup=(tree:any,index:number)=>find(tree,n=>n.type==='fieldset'&&find(n,c=>c.props?.id===`:retry-test:-statement-${index}`));
const exerciseIn=(tree:any)=>find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');
const nextButton=(tree:any)=>{const node=exerciseIn(tree),previousValues=values,previousCursor=cursor;values=[];cursor=0;const next=button(node.type(node.props),'Ôn câu chưa đúng tiếp theo');values=previousValues;cursor=previousCursor;return next;};
const original=JSON.stringify(state),originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('Phần ôn cục bộ không được gửi yêu cầu mạng');};
try{
  for(const input of unreadableCropStates){
    values=[{key:input.draft!.attemptId+':'+input.exam!.versionHash,selected:'fake-tf',open:true,correct:[]}];cursor=0;
    const html=renderToStaticMarkup(Retry({state:input}));
    assert.ok(!html.includes('II · Đúng sai · Câu 1'),'Pill câu TF không đọc được phải biến mất khỏi bản dựng');
    assert.ok(!html.includes('trong đề ở trên'),'Không hướng dẫn đọc PDF không được nhúng trong phần ôn');
    if(input.exam.questions[1].statements===undefined)assert.match(html,/I · Trắc nghiệm · Câu 1/,'Giữ câu MC hợp lệ khi câu TF bị bỏ qua');
  }
  values=[{key:state.draft!.attemptId+':'+exam.versionHash,selected:'fake-mc',open:true,correct:[]}];cursor=0;
  assert.doesNotThrow(()=>renderToStaticMarkup(Retry({state:{...state,exam:{...exam,questions:exam.questions.map(q=>({...q,sourceContent:{} as any}))}}})), 'Nguồn lệch dạng không làm đổ bản dựng khi câu còn đủ văn bản');
  const parentValues:any[]=[];
  function drawParent(input=state){values=parentValues;cursor=0;return Retry({state:input});}
  let tree=drawParent();
  const closedHtml=renderToStaticMarkup(tree);assert.match(closedHtml,/không tính điểm và không dùng thêm lượt/);assert.ok(!closedHtml.includes('fake-mc'));
  button(tree,'Ôn một câu của lượt này').props.onClick();tree=drawParent();
  const progress=()=>renderToStaticMarkup(find(drawParent(),n=>n.props?.className==='btvn-retry-status'));
  assert.match(progress(),/Đã sửa đúng 0\/2 câu/);
  const exerciseNode=find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');assert.ok(exerciseNode);
  const exerciseValues:any[]=[];
  const draw=()=>{values=exerciseValues;cursor=0;return exerciseNode.type(exerciseNode.props);};
  let exercise=draw();
  assert.equal(exerciseNode.props.submittedAnswer,'A','Lấy đúng câu trả lời MC từ bản nộp đã xác nhận');
  const originalDetails=find(exercise,n=>n.type==='details'&&find(n,c=>c.type==='summary'&&c.props.children==='Xem câu trả lời đã nộp của I · Trắc nghiệm · Câu 1'));
  assert.ok(originalDetails);assert.equal(originalDetails.props.open,undefined,'Đối chiếu bản nộp thu gọn mặc định');
  assert.equal(originalDetails.props.className,'btvn-retry-submitted','Khối đối chiếu có kiểu riêng, không dùng kiểu chữ chú thích');
  assert.match(renderToStaticMarkup(originalDetails),/Câu trả lời đã nộp: A/);
  assert.equal(find(exercise,n=>n.type==='input'&&n.props.value==='A').props.checked,false,'Không điền sẵn đáp án cũ vào ô ôn');
  for(const [submittedAnswer,expected] of [['<img src=x onerror=alert(1)>',/&lt;img/],['1/3',/1\/3/],[[true,null,false,true],/a\) Đúng; b\) Chưa chọn; c\) Sai; d\) Đúng/]] as const){
    values=[];cursor=0;
    const withOriginal=exerciseNode.type({...exerciseNode.props,submittedAnswer});
    const details=find(withOriginal,n=>n.type==='details');
    const html=renderToStaticMarkup(details);assert.match(html,expected);assert.ok(!html.includes('<img'),'Câu trả lời cũ luôn là văn bản, không parse HTML');
  }
  values=[];cursor=0;
  const malformedSourceExercise=exerciseNode.type({...exerciseNode.props,item:{question:{...exam.questions[0],sourceContent:{}},index:0}});
  assert.doesNotThrow(()=>renderToStaticMarkup(malformedSourceExercise),'Không render MtmSourceContent với mảng questions bị thiếu');
  exercise=draw();
  const prefacedSolution='Điều kiện: $x>0$.\n'+exam.questions[0].solution;
  values=[];cursor=0;
  const prefacedNode=exerciseNode.type({...exerciseNode.props,item:{question:{...exam.questions[0],solution:prefacedSolution},index:0}});
  assert.equal(button(prefacedNode,'Xem gợi ý bước 1'),null,'Nguồn có mở đầu quan trọng chỉ xem bản đầy đủ');
  button(prefacedNode,'Xem lời giải đầy đủ của câu ôn').props.onClick();cursor=0;
  const prefacedOpen=exerciseNode.type({...exerciseNode.props,item:{question:{...exam.questions[0],solution:prefacedSolution},index:0}});
  assert.ok(find(prefacedOpen,n=>n.props?.fallback===prefacedSolution),'Bản đầy đủ vẫn giữ nguyên điều kiện và các bước nguồn');
  values=[];cursor=0;
  const prefacedCropProps={...exerciseNode.props,item:{question:{...exam.questions[0],solution:prefacedSolution,sourceContent:{questions:[],solutions:[{path:'fake-unavailable.png',sha256:'f'.repeat(64),sourcePage:1,width:600,height:400,privateUnavailable:true}]}},index:0}};
  const prefacedCrop=exerciseNode.type(prefacedCropProps);
  button(prefacedCrop,'Xem lời giải đầy đủ của câu ôn').props.onClick();cursor=0;
  const prefacedCropOpen=exerciseNode.type(prefacedCropProps),cropSource=find(prefacedCropOpen,n=>n.props?.kind==='solution');
  assert.equal(cropSource.props.context,'review','Ảnh lời giải được mở trong ngữ cảnh ôn');
  assert.equal(find(cropSource.props.errorFallback,n=>n.props?.text===prefacedSolution)?.props.text,prefacedSolution,'Ảnh lỗi vẫn có bản chữ nguyên vẹn của đúng câu');
  const prefacedCropHtml=renderToStaticMarkup(prefacedCropOpen);
  assert.match(prefacedCropHtml,/Điều kiện/,'Ảnh privateUnavailable vẫn dựng điều kiện ở bản chữ');
  assert.ok(!prefacedCropHtml.includes('nộp phần đã làm'),'Lời giải trong phần ôn không nhắc nộp bài');
  values=[];cursor=0;
  const noSteps=exerciseNode.type({...exerciseNode.props,item:{question:{...exam.questions[0],solution:'Thay số và đối chiếu kết quả.'},index:0}});
  assert.ok(!renderToStaticMarkup(noSteps).includes('điều kiện'),'Lời giải không có bước không bị nhắc điều kiện không tồn tại');
  exercise=draw();
  const initialStatus=find(exercise,n=>n.props?.role==='status');
  assert.equal(initialStatus.props.id,':retry-test:-feedback','Vùng live có id cố định ngay khi mở phần ôn');
  assert.equal(initialStatus.props.className,undefined,'Chưa kiểm tra thì vùng live không dựng khung kết quả rỗng');
  assert.equal(renderToStaticMarkup(initialStatus).replace(/<[^>]*>/g,''),'','Chưa có kết quả thì vùng live chưa đọc nội dung');
  const support=find(exercise,n=>n.props?.className==='btvn-retry-support');assert.ok(button(support,'Xem gợi ý bước 1'));assert.ok(button(support,'Xem lời giải đầy đủ của câu ôn'),'Gợi ý và lời giải cùng một nhóm hỗ trợ');
  find(exercise,n=>n.type==='input'&&n.props.value==='A').props.onChange();exercise=draw();
  find(exercise,n=>n.type==='form').props.onSubmit({preventDefault(){}});exercise=draw();assert.match(renderToStaticMarkup(exercise),/Chưa khớp đáp án/);
  find(exercise,n=>n.type==='input'&&n.props.value==='C').props.onChange();exercise=draw();assert.ok(!renderToStaticMarkup(exercise).includes('Chưa khớp đáp án'));
  find(exercise,n=>n.type==='form').props.onSubmit({preventDefault(){}});exercise=draw();assert.match(renderToStaticMarkup(exercise),/Em đã sửa được lỗi này/);assert.match(find(exercise,n=>n.props?.role==='status').props.className,/btvn-retry-success/);
  assert.equal((renderToStaticMarkup(exercise).match(/role="status"/g)??[]).length,1,'Chấm đúng chỉ có một vùng trạng thái kết quả');
  const progressNode=find(drawParent(),n=>n.props?.className==='btvn-retry-status');
  assert.equal(progressNode.props['aria-live'],undefined,'Không đọc lại toàn bộ tiến độ khi số câu đúng tăng');
  assert.equal(progressNode.props.children[0].props['aria-live'],undefined,'Bộ đếm câu không có live region');
  assert.match(renderToStaticMarkup(find(progressNode,n=>n.props?.['aria-live']==='polite')),/Đang ôn/,'Chỉ nhãn câu đang ôn được đọc khi đổi câu');
  assert.match(nextButton(drawParent()).props.className,/btvn-retry-start/,'Sau sửa đúng, nút chuyển câu được nhấn màu vàng');
  assert.match(progress(),/Đã sửa đúng 1\/2 câu/);
  find(exercise,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.match(progress(),/Đã sửa đúng 1\/2 câu/,'Kiểm lại cùng câu đúng không tăng bộ đếm');
  const correctedPill=find(drawParent(),n=>n.type==='button'&&n.props['aria-label']?.includes('Đã sửa đúng trong phiên ôn'));
  assert.ok(correctedPill,'Pill ghi nhận đã sửa đúng mà không ghi điểm/lượt');
  assert.equal(correctedPill.props['aria-label'],'I · Trắc nghiệm · Câu 1 · Đã sửa đúng trong phiên ôn','Nhãn trợ năng giữ tên phần và trạng thái đầy đủ');
  assert.equal(find(correctedPill,n=>n.props?.className==='btvn-retry-pill-compact').props.children,'I · Câu 1','Nhãn mobile gọn nhưng không lẫn Câu 1 ở hai phần');
  button(exercise,'Xem gợi ý bước 1').props.onClick();exercise=draw();let html=renderToStaticMarkup(exercise);assert.match(html,/Trừ 1 ở hai vế/);assert.ok(!html.includes('Chia hai vế cho 2'));assert.ok(find(exercise,n=>n.props?.className==='btvn-retry-hints'),'Gợi ý có khung riêng để phân biệt với đề bài');
  button(exercise,'Xem gợi ý bước 2').props.onClick();exercise=draw();html=renderToStaticMarkup(exercise);assert.match(html,/Chia hai vế cho 2/);assert.equal(button(exercise,'Đã mở hết các bước nguồn').props.disabled,true);
  button(exercise,'Xem lời giải đầy đủ của câu ôn').props.onClick();exercise=draw();assert.equal(button(exercise,'Đóng lời giải câu ôn').props['aria-expanded'],true);
  const full=find(exercise,n=>n.props?.fallback===exam.questions[0].solution);assert.ok(full,'Đưa đúng lời giải gốc, đúng exam/version/question vào renderer');assert.equal(full.props.examId,exam.id);assert.equal(full.props.questionId,'fake-mc');assert.equal(full.props.versionHash,exam.versionHash);
  button(exercise,'Thử lại từ đầu').props.onClick();exercise=draw();assert.ok(!renderToStaticMarkup(exercise).includes('Em đã sửa được lỗi này'));assert.equal(find(exercise,n=>n.type==='input'&&n.props.value==='C').props.checked,false);assert.ok(button(exercise,'Xem gợi ý bước 1'));
  tree=drawParent();assert.equal(find(tree,n=>n.type==='select'),null);const tfPill=find(tree,n=>n.type==='button'&&n.props.className?.includes('btvn-retry-pill')&&!n.props.className.includes('is-correct'));assert.equal(tfPill.props['aria-pressed'],false);nextButton(tree).props.onClick();tree=drawParent();const selected=find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise');assert.equal(selected.props.item.question.id,'fake-tf');assert.notEqual(selected.key,exerciseNode.key,'Đổi câu phải tạo state ôn riêng');assert.equal(find(tree,n=>n.type==='button'&&n.props.className?.includes('btvn-retry-pill')&&!n.props.className.includes('is-correct')).props['aria-pressed'],true);
  assert.match(progress(),/Đang ôn II · Đúng sai · Câu 1/,'Thông báo câu đang ôn khi chuyển bằng bàn phím');
  const tfValues:any[]=[];
  const drawTf=()=>{values=tfValues;cursor=0;return selected.type(selected.props);};
  let tfTree=drawTf();
  assert.deepEqual(selected.props.submittedAnswer,draft.answers['fake-tf'],'Đổi câu lấy đúng đáp án Đ/S trong bản nộp');
  assert.ok(!renderToStaticMarkup(tfTree).includes('Các ý chưa khớp:'),'Không lộ so khớp trước khi kiểm tra');
  let titleFocusCount=0;
  const tfTitle=find(tfTree,n=>n.type==='h3');
  assert.equal(tfTitle.props.tabIndex,-1,'Tiêu đề nhận focus sau khi đổi câu, không thêm điểm Tab thường');
  tfTitle.ref({focus(){titleFocusCount++;}});
  find(drawTf(),n=>n.type==='h3').ref({focus(){titleFocusCount++;}});
  assert.equal(titleFocusCount,1,'Chuyển focus một lần, không giật focus sau cập nhật câu trả lời');
  for(let i=0;i<4;i++){
    const group=find(tfTree,n=>n.type==='fieldset'&&n.props['aria-describedby']===`:retry-test:-statement-${i}`);
    assert.ok(group,'Nhóm Đúng/Sai liên kết với văn bản mệnh đề');
    assert.equal(find(group,n=>n.type==='legend').props.children.join(''),'Ý '+String.fromCharCode(97+i),'Legend ngắn, không nhét công thức dài');
    assert.equal(find(group,n=>n.props?.id===`:retry-test:-statement-${i}`).props.children.props.text,exam.questions[1].kind==='tf'?exam.questions[1].statements![i]:undefined);
  }
  assert.ok(!renderToStaticMarkup(tfTree).includes('trong đề ở trên'));
  find(tfTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawTf()),/Em trả lời đủ câu/);
  for(const [i,value] of [true,true,false,true].entries()){
    tfTree=drawTf(); // Tìm theo tên input để không phụ thuộc vị trí các fieldset.
    const all:any[]=[];const collect=(node:any)=>{if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(collect);return;}if(node.type==='input'&&node.props.name===`:retry-test:-tf-${i}`)all.push(node);collect(node.props?.children);};collect(tfTree);
    all[value?0:1].props.onChange();
  }
  // Còn lượt tính điểm và chưa mở lời giải: không suy ra ý sai qua chữ hoặc thuộc tính.
  tfTree=drawTf();
  find(tfTree,n=>n.type==='input'&&n.props.name===':retry-test:-tf-1'&&n.props.checked===false).props.onChange();
  tfTree=drawTf();find(tfTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  const mismatchStatus=find(drawTf(),n=>n.props?.role==='status');
  assert.equal(selected.props.canAttemptAgain,true,'Parent giữ trạng thái còn lượt tính điểm');
  assert.match(renderToStaticMarkup(mismatchStatus),/Có ý chưa khớp\. Em đọc lại từng mệnh đề hoặc mở lời giải\./);
  assert.ok(!renderToStaticMarkup(mismatchStatus).includes('Các ý chưa khớp:'),'Không liệt kê chữ cái khi chưa mở lời giải');
  assert.ok(!renderToStaticMarkup(mismatchStatus).includes('b) Đúng'),'Phản hồi không đưa khóa đáp án');
  for(let i=0;i<4;i++){
    const group=statementGroup(drawTf(),i);
    assert.equal(group.props.className,undefined,'Chưa mở lời giải thì không đánh dấu trực quan ý lệch');
    assert.equal(group.props['aria-invalid'],undefined,'Chưa mở lời giải thì aria không tiết lộ ý lệch');
    assert.equal(group.props['aria-describedby'],`:retry-test:-statement-${i}`,'Chỉ liên kết văn bản mệnh đề, không chỉ riêng ý lệch');
  }
  // Chỉ sau khi mở lời giải mới liệt kê và liên kết lỗi với mệnh đề tương ứng.
  tfTree=drawTf();button(tfTree,'Xem lời giải đầy đủ của câu ôn').props.onClick();tfTree=drawTf();
  assert.match(renderToStaticMarkup(find(tfTree,n=>n.props?.role==='status')),/Các ý chưa khớp: Ý b\./);
  assert.equal(statementGroup(tfTree,1).props.className,'is-mismatch');
  assert.equal(statementGroup(tfTree,1).props['aria-invalid'],true);
  assert.equal(statementGroup(tfTree,1).props['aria-describedby'],':retry-test:-statement-1 :retry-test:-feedback','Ý lệch liên kết cùng thông báo live');
  assert.equal(statementGroup(tfTree,0).props['aria-invalid'],undefined,'Không đánh dấu ý đang khớp');
  button(tfTree,'Đóng lời giải câu ôn').props.onClick();tfTree=drawTf();
  assert.ok(!renderToStaticMarkup(find(tfTree,n=>n.props?.role==='status')).includes('Các ý chưa khớp:'),'Đóng lời giải khi còn lượt thì trở lại phản hồi chung');
  assert.equal(statementGroup(tfTree,1).props['aria-invalid'],undefined,'Đóng lời giải cũng bỏ dấu riêng từng ý');
  button(tfTree,'Xem lời giải đầy đủ của câu ôn').props.onClick();
  tfTree=drawTf();find(tfTree,n=>n.type==='input'&&n.props.name===':retry-test:-tf-1'&&n.props.checked===false).props.onChange();
  tfTree=drawTf();
  const changedStatus=find(tfTree,n=>n.props?.role==='status');
  assert.equal(changedStatus.props.id,mismatchStatus.props.id,'Đổi lựa chọn giữ cùng vùng live');
  assert.match(renderToStaticMarkup(changedStatus),/Em đã đổi lựa chọn\. Bấm Kiểm tra lại để chấm lại câu này\./);
  assert.ok(!renderToStaticMarkup(changedStatus).includes('chưa khớp'),'Đổi lựa chọn xóa phản hồi so khớp cũ');
  for(let i=0;i<4;i++){
    assert.equal(statementGroup(tfTree,i).props.className,undefined,'Đổi lựa chọn xóa đánh dấu ý lệch');
    assert.equal(statementGroup(tfTree,i).props['aria-invalid'],undefined,'Đổi lựa chọn xóa aria-invalid cũ');
    assert.equal(statementGroup(tfTree,i).props['aria-describedby'],`:retry-test:-statement-${i}`,'Đổi lựa chọn xóa liên kết lỗi cũ');
  }
  tfTree=drawTf();find(tfTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawTf()),/Em đã sửa được lỗi này/);
  assert.match(progress(),/Đã sửa đúng 2\/2 câu/);
  assert.equal(nextButton(drawParent()).props.disabled,true,'Hết câu chưa đúng thì không ép luyện thêm');
  const completeNode=exerciseIn(drawParent());values=tfValues;cursor=0;
  const completed=completeNode.type(completeNode.props),completedStatus=find(completed,n=>n.props?.role==='status');
  assert.match(completedStatus.props.className,/btvn-retry-feedback btvn-retry-success/,'Hoàn tất dùng chung hộp phản hồi có khung');
  const completedHtml=renderToStaticMarkup(completed);
  assert.match(completedHtml,/Em đã sửa đúng các câu trong phiên ôn này/);
  assert.equal((completedHtml.match(/role="status"/g)??[]).length,1,'Thông báo hoàn tất nằm trong cùng một vùng kết quả');
  // Tiến độ ghi nhận đã từng sửa đúng, nhưng hộp kết quả luôn theo lần thử hiện tại.
  find(completed,n=>n.type==='input'&&n.props.name===':retry-test:-tf-1'&&n.props.checked===false).props.onChange();
  values=tfValues;cursor=0;const completedChanged=completeNode.type(completeNode.props);
  assert.ok(!renderToStaticMarkup(find(completedChanged,n=>n.props?.role==='status')).includes('Em đã sửa đúng các câu'),'Đang chờ chấm lại thì không lặp lời chúc hoàn tất');
  find(completedChanged,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  values=tfValues;cursor=0;const completedWrong=completeNode.type(completeNode.props),completedWrongStatus=find(completedWrong,n=>n.props?.role==='status');
  assert.match(completedWrongStatus.props.className,/btvn-retry-error/);
  assert.match(renderToStaticMarkup(completedWrongStatus),/Chưa khớp đáp án/);
  assert.ok(!renderToStaticMarkup(completedWrongStatus).includes('Em đã sửa đúng các câu'),'Không đặt lời chúc hoàn tất trong hộp lỗi sau khi đã hoàn thành rồi thử sai');
  assert.ok(completedHtml.indexOf('Ôn câu chưa đúng tiếp theo')<completedHtml.indexOf('btvn-retry-support'),'Nút chuyển câu nằm cạnh kết quả, trước gợi ý và lời giải dài');
  // Hết lượt tính điểm: phản hồi từng ý được mở dù lời giải còn đóng.
  const exhaustedState={...state,attemptsUsed:state.maxAttempts};
  values=[{key:draft.attemptId+':'+exam.versionHash,selected:'fake-tf',open:true,correct:[]}];cursor=0;
  const exhaustedNode=exerciseIn(Retry({state:exhaustedState}));
  assert.equal(exhaustedNode.props.canAttemptAgain,false,'Parent truyền đúng trạng thái hết lượt');
  const exhaustedValues:any[]=[];
  const drawExhausted=()=>{values=exhaustedValues;cursor=0;return exhaustedNode.type(exhaustedNode.props);};
  for(const [i,value] of [true,false,false,true].entries()){
    const group=statementGroup(drawExhausted(),i);
    const choice=find(group,n=>n.type==='label'&&n.props.children[1].props.children===(value?'Đúng':'Sai'));
    find(choice,n=>n.type==='input').props.onChange();
  }
  const exhaustedTree=drawExhausted();
  find(exhaustedTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  const exhaustedWrong=drawExhausted();
  assert.equal(button(exhaustedWrong,'Xem lời giải đầy đủ của câu ôn').props['aria-expanded'],false);
  assert.match(renderToStaticMarkup(find(exhaustedWrong,n=>n.props?.role==='status')),/Các ý chưa khớp: Ý b\./);
  assert.equal(statementGroup(exhaustedWrong,1).props['aria-invalid'],true);
  assert.equal(statementGroup(exhaustedWrong,1).props.className,'is-mismatch');
  values=[];cursor=0;const malformedTf=selected.type({...selected.props,item:{question:{...exam.questions[1],answer:undefined},index:1}});assert.doesNotThrow(()=>renderToStaticMarkup(malformedTf),'Màn Đ/S không gọi map trên khóa đáp án thiếu');
  const shortValues:any[]=[];
  const drawShort=()=>{values=shortValues;cursor=0;return selected.type({...selected.props,exam,item:{question:exam.questions[2],index:2}});};
  let shortTree=drawShort();find(shortTree,n=>n.type==='input'&&n.props.type==='text').props.onChange({target:{value:'1/0'}});shortTree=drawShort();find(shortTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(find(drawShort(),n=>n.type==='input').props['aria-invalid'],true);
  find(drawShort(),n=>n.type==='input').props.onChange({target:{value:'2/4'}});shortTree=drawShort();find(shortTree,n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.match(renderToStaticMarkup(drawShort()),/Em đã sửa được lỗi này/);
  tree=drawParent();
  button(tree,'Đóng phần ôn').props.onClick();assert.ok(button(drawParent(),'Ôn một câu của lượt này'));
  button(drawParent(),'Ôn một câu của lượt này').props.onClick();assert.match(progress(),/Đã sửa đúng 2\/2 câu/,'Đóng/mở cùng phiên giữ tiến độ ôn');
  const nextAttempt={...state,draft:{...draft,attemptId:'fake-attempt-next'},receipts:[{...state.receipts[0],attemptId:'fake-attempt-next'}]};
  tree=drawParent(nextAttempt);assert.ok(button(tree,'Ôn một câu của lượt này'));button(tree,'Ôn một câu của lượt này').props.onClick();tree=drawParent(nextAttempt);assert.equal(find(tree,n=>n.type==='button'&&n.props.className?.includes('is-correct')),null,'Lượt mới không giữ dấu đã sửa đúng của lượt trước');assert.equal(find(tree,n=>typeof n.type==='function'&&n.type.name==='RetryExercise').props.item.question.id,'fake-mc','Lượt mới chọn lại câu đầu');
  assert.match(renderToStaticMarkup(find(tree,n=>n.props?.className==='btvn-retry-status')),/Đã sửa đúng 0\/2 câu/);
  const nextVersion={...nextAttempt,exam:{...exam,versionHash:'d'.repeat(64)},draft:{...nextAttempt.draft,examVersionHash:'d'.repeat(64)}};assert.ok(button(drawParent(nextVersion),'Ôn một câu của lượt này'),'Đổi phiên bản cũng đóng phần ôn cũ');
  button(drawParent(nextVersion),'Ôn một câu của lượt này').props.onClick();assert.match(renderToStaticMarkup(find(drawParent(nextVersion),n=>n.props?.className==='btvn-retry-status')),/Đã sửa đúng 0\/2 câu/);
  values=[{key:draft.attemptId+':'+exam.versionHash,selected:'fake-tf',open:true,correct:['fake-tf']}];cursor=0;
  const wrapped=Retry({state});nextButton(wrapped).props.onClick();cursor=0;
  assert.equal(find(Retry({state}),n=>typeof n.type==='function'&&n.type.name==='RetryExercise').props.item.question.id,'fake-mc','Chuyển từ câu cuối về câu chưa đúng đầu, bỏ qua câu đã sửa');
  values=[{key:draft.attemptId+':'+exam.versionHash,selected:'fake-mc',open:true,correct:['fake-tf']}];cursor=0;
  const lastRemaining=exerciseIn(Retry({state}));values=[];cursor=0;
  const lastRemainingTree=lastRemaining.type(lastRemaining.props),lastButton=button(lastRemainingTree,'Ôn câu chưa đúng tiếp theo');
  assert.equal(lastButton.props.disabled,true);
  assert.equal(lastButton.props['aria-describedby'],':retry-test:-remaining');
  assert.match(renderToStaticMarkup(lastRemainingTree),/Em đang ở câu chưa đúng còn lại/,'Nút tắt được giải thích khi chỉ còn chính câu đang ôn');
  assert.ok(!renderToStaticMarkup(lastRemainingTree).includes('Em đã sửa đúng các câu trong phiên ôn này'),'Không chúc mừng toàn bộ khi còn một câu chưa đúng');
  const wrongShortState={...state,draft:{...draft,answers:{...draft.answers,'fake-short':'1/3'}}};
  values=[];cursor=0;let shortParent=Retry({state:wrongShortState});
  button(shortParent,'Ôn một câu của lượt này').props.onClick();cursor=0;
  shortParent=Retry({state:wrongShortState});
  find(shortParent,n=>n.type==='button'&&n.props['aria-label']==='III · Trả lời ngắn · Câu 1').props.onClick();cursor=0;
  const shortFromParent=exerciseIn(Retry({state:wrongShortState}));
  assert.equal(shortFromParent.props.submittedAnswer,'1/3','Parent chuyển đúng đáp án ngắn đã nộp của câu vừa chọn');
  assert.equal(shortFromParent.props.item.question.id,'fake-short');
  values=[];cursor=0;const emptyShortRetry=shortFromParent.type(shortFromParent.props);
  assert.match(renderToStaticMarkup(find(emptyShortRetry,n=>n.type==='details')),/Câu trả lời đã nộp: 1\/3/);
  assert.equal(find(emptyShortRetry,n=>n.type==='input'&&n.props.type==='text').props.value,'','Ô ôn ngắn rỗng dù bản nộp có câu trả lời');
  assert.equal(wrongShortState.draft.answers['fake-short'],'1/3');
  assert.equal(JSON.stringify(state),original,'Câu trả lời ôn không sửa bản nộp, receipt, điểm hay số lượt gốc');
}finally{globalThis.fetch=originalFetch;}
console.log('Đạt ôn một lỗi BTVN: ACK đúng lượt và khóa lời giải; câu sai có nguồn; Toán kiểm độc lập; thử đáp án, gợi ý nguyên văn, lời giải, reset và đổi câu; giữ nguyên điểm/lượt và không gọi mạng.');
