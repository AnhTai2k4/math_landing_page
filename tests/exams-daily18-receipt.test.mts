// Toàn bộ đề và người dùng là fixture tổng hợp, không I/O mạng hoặc dữ liệu thật.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
import {createDraft,submitDraft} from '../src/native/exams/store';
import {resultFor} from '../src/native/exams/result';
import {acknowledgedHomeworkReceipt,acknowledgedHomeworkSubmission,createHomeworkResultSummary,homeworkReceiptScore,pendingHomeworkReceipt} from '../src/native/homework/result-summary';
import {createHomeworkSaver} from '../src/native/homework/remote-save';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('DAILY18-RECEIPT');
const copy=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const T0=Date.UTC(2026,9,16,1),p=10000/3,f=(numerator:string,denominator='1')=>({numerator,denominator});
function fixture(pending=false):HomeworkState{
 const exam={id:'daily18-fake-exam',title:'Đề tổng hợp kiểm biên nhận',grade:12,period:'GK1',durationMinutes:120,
  sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),sourceRef:'Nguồn giả',sourceUrl:'https://example.invalid/nguon-gia',
  sourceMaterial:{title:'Nguồn tổng hợp',publisher:'Kiểm thử local',version:'fake-v1',locator:'Ba câu tổng hợp'},
  questionCount:3,answerKeyVerified:true,rubricVerified:true,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'daily18-fake-key-v1',sourceComplete:true,publicationVerified:true,questionDisplayVerified:true,
  sections:[{label:'TN',kind:'mc',count:1},{label:'DS',kind:'tf',count:1},{label:'TLN',kind:'short',count:1}],questions:[
   {id:'fake-tn',sourceRef:'Câu tổng hợp 1',prompt:'Chọn số hai.',kind:'mc',choices:['Một','Hai','Ba','Bốn'],answer:'B',maxPoints:f('10','3'),maxMillipoints:p},
   {id:'fake-ds',sourceRef:'Câu tổng hợp 2',prompt:'Xét bốn ý tổng hợp.',kind:'tf',statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,p/10,p/4,p/2,p],maxPoints:f('10','3'),maxMillipoints:p},
   {id:'fake-tln',sourceRef:'Câu tổng hợp 3',prompt:'Viết một nửa.',kind:'short',mode:'rational',acceptedAnswers:['1/2'],shortRule:{verified:!pending,evidence:'Quy tắc tổng hợp đã kiểm',mode:'rational'},maxPoints:f('10','3'),maxMillipoints:p},
  ]} as PracticeExam;
 const made=createDraft(exam,'daily18-fake-attempt',T0);assert.ok(made.ok);
 const done=submitDraft(exam,{...made.value,answers:{'fake-tn':'B','fake-ds':[true,true,false,true],'fake-tln':'1'}},T0+1000);assert.ok(done.ok);
 const mtm=resultFor(exam,done.value)?.mtm;assert.ok(mtm);
 const receipt={attemptId:done.value.attemptId,attemptNumber:1,submittedAt:T0+1000,elapsedSeconds:1,score:pending?null:3.67,rubricVersion:MTM_SCORING_VERSION,mtm,late:false,timedOut:false};
 return {exam,draft:done.value,receipts:[receipt],fullName:'Người dùng GIẢ',className:'Lớp GIẢ',lessonCode:'daily18-fake-lesson',dueAt:null,maxAttempts:5,attemptsUsed:1,bestScore:pending?null:3.67,demo:true,solutionsAvailable:true};
}
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const compiled=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkOverview.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};new Function('require','module','exports',compiled)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);
const render=(state:HomeworkState)=>renderToStaticMarkup(React.createElement(mod.exports.default,{state,busy:false,onStart(){}}));

test('Snapshot thật của engine giữ phân số 11/3, hai chữ số, phiếu và bảng phần',()=>{
 const state=fixture(),before=JSON.stringify(state),receipt=state.receipts[0];
 assert.equal(homeworkReceiptScore(receipt),'3,67');assert.equal(acknowledgedHomeworkReceipt(state),receipt);assert.equal(acknowledgedHomeworkSubmission(state),receipt);
 assert.match(createHomeworkResultSummary(state)!,/Điểm: 3,67\/10/);
 const html=render(state);assert.match(html,/Bảng điểm từng phần/);assert.match(html,/11\/3/);assert.match(html,/3,67/);
 assert.equal(JSON.stringify(state),before,'Không ghi ngược hoặc chấm lại snapshot nguồn');
});

test('Tổng hiển thị lệch điểm gốc bị che nhưng ACK nộp và lượt tiếp vẫn giữ',()=>{
 const state=copy(fixture());state.receipts[0].mtm!.officialDisplayTotal='9.99';
 assert.equal(homeworkReceiptScore(state.receipts[0]),null);assert.equal(acknowledgedHomeworkReceipt(state),null);
 assert.equal(acknowledgedHomeworkSubmission(state),state.receipts[0]);assert.equal(createHomeworkResultSummary(state),null);
 const html=render(state);assert.match(html,/Bài đã nộp/);assert.match(html,/đối soát/);assert.doesNotMatch(html,/9,99|3,67|Bảng điểm từng phần|Sao chép phiếu kết quả|Đang xác nhận lượt vừa nộp/);
 assert.match(html,/<button class="btvn-btn"[^>]*>Làm lượt tiếp<\/button>/);assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>Làm lượt tiếp/);
});

test('Snapshot lệch hàng, phần, phân số hoặc điểm số không được công bố và không gây throw',()=>{
 const mutations:((state:any)=>void)[]=[
  s=>{s.receipts[0].score=9.99;},s=>{s.receipts[0].mtm.rawTotal=f('4');},s=>{s.receipts[0].mtm.officialTotal=f('4');},s=>{s.receipts[0].mtm.displayTotal='4.00';},
  s=>{s.receipts[0].mtm.rows[0].earned=f('4');},s=>{s.receipts[0].mtm.rows[0].maxScore=f('4');},s=>{s.receipts[0].mtm.rows[1].correctCount=3;},
  s=>{s.receipts[0].mtm.rows[1].earned=f('1','2');},s=>{s.receipts[0].mtm.rows[0].id=s.receipts[0].mtm.rows[1].id;},
  s=>{s.receipts[0].mtm.rows[0].type='SOMETHING';},s=>{s.receipts[0].mtm.rows[0].status='ungradable';},
  s=>{s.receipts[0].mtm.sections[0].rawTotal=f('1','0');},s=>{s.receipts[0].mtm.sections[0].rawTotal=f('4');},s=>{s.receipts[0].mtm.sections[0].maxScore=f('4');},
  s=>{s.receipts[0].mtm.sections.push(s.receipts[0].mtm.sections[0]);},s=>{s.receipts[0].mtm.sections=[];},s=>{s.receipts[0].mtm.sections=null;},
  s=>{s.receipts[0].mtm.rows=null;},s=>{s.receipts[0].mtm.pending=null;},s=>{s.receipts[0].mtm.rawTotal=f('NaN');},
  s=>{s.receipts[0].mtm.rows[0].earned=f('1'.repeat(10000));},s=>{s.receipts[0].mtm.rows[0].issues=[{}];},
  s=>{s.receipts[0].mtm.officialDisplayTotal='3,67';},s=>{s.receipts[0].mtm.officialDisplayTotal='3.670';},
 ];
 for(const mutate of mutations){const state=copy(fixture());mutate(state);assert.equal(homeworkReceiptScore(state.receipts[0]),null,mutate.toString());assert.equal(acknowledgedHomeworkReceipt(state),null);assert.equal(createHomeworkResultSummary(state),null);assert.doesNotThrow(()=>render(state),mutate.toString());assert.doesNotMatch(render(state),/Bảng điểm từng phần/);}
});

test('Pending hợp lệ còn ACK và bảng phần an toàn, không công bố tổng tạm',()=>{
 const state=fixture(true),receipt=state.receipts[0];assert.equal(pendingHomeworkReceipt(receipt),true);assert.equal(homeworkReceiptScore(receipt),null);assert.equal(acknowledgedHomeworkReceipt(state),receipt);
 assert.match(createHomeworkResultSummary(state)!,/Điểm: Chưa công bố tổng điểm/);
 const html=render(state);assert.match(html,/Bảng điểm từng phần/);assert.match(html,/Chờ chấm/);assert.doesNotMatch(html,/11\/3|3,67/);
});

test('Pending giả hoặc hàng thiếu issue không qua cổng bảng phần',()=>{
 for(const mutate of [s=>{s.receipts[0].mtm.pending=[];},s=>{s.receipts[0].mtm.rows[2].issues=[];},s=>{s.receipts[0].mtm.pending[0].message='';},s=>{s.receipts[0].mtm.sections[0].rawTotal=f('1','0');},s=>{s.receipts[0].score=3.67;}]){
  const state:any=copy(fixture(true));mutate(state);assert.equal(pendingHomeworkReceipt(state.receipts[0]),false);assert.equal(acknowledgedHomeworkReceipt(state),null);assert.doesNotThrow(()=>render(state));assert.doesNotMatch(render(state),/Bảng điểm từng phần/);
 }
});

test('Thiếu hoặc trùng biên nhận đúng lượt vẫn chờ ACK và khóa lượt tiếp',()=>{
 for(const mutate of [(s:any)=>{s.receipts=[];},(s:any)=>{s.receipts[0].attemptId='wrong';},(s:any)=>{s.receipts.push(copy(s.receipts[0]));}]){
  const state=copy(fixture());mutate(state);assert.equal(acknowledgedHomeworkSubmission(state),null);assert.equal(acknowledgedHomeworkReceipt(state),null);assert.equal(createHomeworkResultSummary(state),null);
  const html=render(state);assert.match(html,/Đang xác nhận lượt vừa nộp/);assert.match(html,/<button[^>]*disabled[^>]*>Làm lượt tiếp/);assert.doesNotMatch(html,/3,67|Bảng điểm từng phần|Sao chép phiếu kết quả/);
 }
});

test('Đúng một receipt cùng lượt vẫn ACK khi thiếu snapshot, sai phiên bản hoặc lệch giờ nộp',()=>{
 const mutations:((state:any)=>void)[]=[
  s=>{delete s.receipts[0].mtm;},s=>{delete s.receipts[0].rubricVersion;delete s.receipts[0].mtm;},
  s=>{s.receipts[0].submittedAt++;},s=>{s.receipts[0].mtm.versions.answerKeyVersion='wrong';},s=>{s.receipts[0].mtm.versions.examVersion='wrong';},
  s=>{s.receipts[0].mtm.versions.examId='wrong';},s=>{s.receipts[0].mtm.versions.rubricVersion='wrong';},s=>{s.receipts[0].mtm.attemptId='wrong';},
 ];
 for(const mutate of mutations){
  const state=copy(fixture()),before=JSON.stringify(state);mutate(state);const mutated=JSON.stringify(state);
  assert.equal(acknowledgedHomeworkSubmission(state),state.receipts[0]);assert.equal(acknowledgedHomeworkReceipt(state),null);assert.equal(createHomeworkResultSummary(state),null);
  const html=render(state);assert.match(html,/Bài đã nộp. Điểm đang được đối soát/);assert.match(html,/<button class="btvn-btn"[^>]*>Làm lượt tiếp<\/button>/);
  assert.doesNotMatch(html,/<button[^>]*disabled[^>]*>Làm lượt tiếp|Đang xác nhận lượt vừa nộp|ĐANG CHỜ BIÊN NHẬN|3,67|Bảng điểm từng phần|Sao chép phiếu kết quả/);
  assert.notEqual(mutated,before);assert.equal(JSON.stringify(state),mutated,'Không sửa ngược bản nộp hoặc biên nhận');
 }
});

test('Tháng đang ẩn ACK theo đúng lượt kể cả lệch metadata nhưng luôn giấu điểm và phiếu',()=>{
 for(const mutate of [(s:any)=>{s.receipts[0].submittedAt++;},(s:any)=>{delete s.receipts[0].mtm;},(s:any)=>{s.receipts[0].mtm.versions.examVersion='wrong';}]){
  const state=copy(fixture());state.kind='kiem-tra-thang';state.solutionsAvailable=false;mutate(state);
  assert.equal(acknowledgedHomeworkSubmission(state),state.receipts[0]);assert.equal(acknowledgedHomeworkReceipt(state),null);assert.equal(createHomeworkResultSummary(state),null);
  const html=render(state);assert.match(html,/Em đã nộp bài kiểm tra tháng/);assert.doesNotMatch(html,/Đang xác nhận lượt vừa nộp|3,67|Bảng điểm từng phần|Sao chép phiếu kết quả/);
 }
 for(const receipts of [[],[...fixture().receipts,...fixture().receipts]]){
  const state={...fixture(),kind:'kiem-tra-thang' as const,solutionsAvailable:false,receipts};
  assert.equal(acknowledgedHomeworkSubmission(state),null);const html=render(state);assert.match(html,/Đang xác nhận lượt vừa nộp/);assert.doesNotMatch(html,/Em đã nộp bài kiểm tra tháng|3,67|Bảng điểm từng phần/);
 }
});

test('Biên nhận MTM khác hợp lệ giữ điểm cao nhất khi lượt hiện tại cần đối soát',()=>{
 const state=copy(fixture()),history=copy(state.receipts[0]);history.attemptId='daily18-fake-history';history.mtm!.attemptId=history.attemptId;
 state.receipts[0].attemptNumber=2;state.receipts[0].mtm!.officialDisplayTotal='9.99';state.receipts.push(history);state.attemptsUsed=2;
 assert.equal(acknowledgedHomeworkReceipt(state),null);
 const html=render(state);assert.match(html,/Bài đã nộp. Điểm đang được đối soát/);assert.match(html,/<strong class="btvn-chip success">Điểm cao nhất: 3,67\/10<\/strong>/);
 const unmatched=render({...state,bestScore:9});assert.match(unmatched,/Điểm cao nhất: Chưa hiện được điểm/);assert.doesNotMatch(unmatched,/<strong class="btvn-chip success">Điểm cao nhất/);
 const legacy=copy(history);delete legacy.rubricVersion;delete legacy.mtm;
 const noValidated=render({...state,receipts:[state.receipts[0],legacy]});assert.match(noValidated,/Điểm cao nhất: Chưa hiện được điểm/);assert.doesNotMatch(noValidated,/<strong class="btvn-chip success">Điểm cao nhất/);
});

test('Chip điểm cao nhất chưa có số không mang trạng thái thành công',()=>{
 for(const state of [fixture(true),{...fixture(),bestScore:NaN}]){
  const html=render(state);assert.match(html,/<strong class="btvn-chip">Điểm cao nhất: (?:Chưa có|Chưa hiện được điểm)<\/strong>/);assert.doesNotMatch(html,/<strong class="btvn-chip success">Điểm cao nhất/);
 }
});

test('Điểm và ACK rubric cũ không phụ thuộc cấu trúc mới',()=>{
 const state:any=copy(fixture());state.draft.rubricVersion='MTM-BTVN-10-v1';delete state.draft.answerKeyVersion;delete state.receipts[0].rubricVersion;delete state.receipts[0].mtm;state.receipts[0].score=7.125;state.receipts[0].submittedAt++;
 assert.equal(homeworkReceiptScore(state.receipts[0]),'7,125');assert.equal(acknowledgedHomeworkReceipt(state),state.receipts[0]);assert.equal(acknowledgedHomeworkSubmission(state),state.receipts[0]);assert.match(createHomeworkResultSummary(state)!,/Điểm: 7,125\/10/);
 for(const mtm of [{},{versions:{rubricVersion:'legacy'},pending:null},{versions:{rubricVersion:'legacy'},pending:[]}]){
  const extra=copy(state);extra.exam=null;extra.receipts[0].mtm=mtm;
  assert.equal(homeworkReceiptScore(extra.receipts[0]),'7,125');assert.doesNotThrow(()=>render(extra));assert.doesNotMatch(render(extra),/Bảng điểm từng phần/);assert.match(render(extra),/7,125/);
 }
});

const ackMutations:[string,(state:HomeworkState)=>void][]=[
 ['bảng điểm hỏng',state=>{state.receipts[0].mtm!.officialDisplayTotal='9.99';}],
 ['thiếu snapshot MTM',state=>{delete state.receipts[0].mtm;}],
 ['phiên bản khóa lệch',state=>{state.receipts[0].mtm!.versions.answerKeyVersion='wrong';}],
 ['mốc nộp lệch',state=>{state.receipts[0].submittedAt++;}],
];
for(const [label,mutate] of ackMutations){
 const broken=copy(fixture());mutate(broken);let saved=0,lastStatus:any;
 const saver=createHomeworkSaver({send:async()=>broken,onSaved(){saved++;},onStatus(status){lastStatus=status;}});
 saver.update(broken.draft!);await saver.settled();
 test('Saver hoàn tất ACK khi '+label+', không lặp gửi hoặc khóa rời bài',()=>{assert.equal(saved,1);assert.equal(saver.pending(),false);assert.equal(lastStatus.failed,false);assert.match(lastStatus.message,/đã nhận bài/);});
 saver.dispose({flushPending:false});
}
finish();
