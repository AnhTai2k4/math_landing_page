// Chỉ dữ liệu tổng hợp, không gọi mạng, không đọc bài làm hoặc danh tính thật.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkReceipt,HomeworkState} from '../src/native/homework/btvn-contract';
import {MTM_SCORING_VERSION,type MtmScore} from '../src/native/exams/mtm-scoring';
import {createDraft,submitDraft} from '../src/native/exams/store';
import {resultFor} from '../src/native/exams/result';
import {acknowledgedHomeworkReceipt,createHomeworkResultSummary,homeworkReceiptScore} from '../src/native/homework/result-summary';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('MTM-RESULT-UI');
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file:string){
 const code=buildSync({entryPoints:[join(root,file)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
 const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);return mod.exports.default;
}
const Breakdown=load('src/native/exams/MtmScoreBreakdown.tsx'),Overview=load('src/native/homework/HomeworkOverview.tsx'),Summary=load('src/native/exams/ResultSummary.tsx'),Review=load('src/native/exams/ExamReview.tsx');
const render=(component:any,props:any)=>renderToStaticMarkup(React.createElement(component,props));
const f=(numerator:string,denominator='1')=>({numerator,denominator});
function fixture(pending=false){
 const p=10000/3,exam={
  id:'mtm-ui-synthetic',title:'Đề tổng hợp kiểm thử giao diện',grade:12,period:'GK1',durationMinutes:120,
  sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),sourceRef:'Nguồn tổng hợp',sourceUrl:'https://example.invalid/nguon',
  sourceMaterial:{title:'Nguồn tổng hợp',publisher:'Kiểm thử cục bộ',version:'fake-v1',locator:'3 câu giả'},
  questionCount:3,answerKeyVerified:true,rubricVerified:true,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fake-key-v1',sourceComplete:true,publicationVerified:true,questionDisplayVerified:true,
  sections:[{label:'TN',kind:'mc',count:1},{label:'ĐS',kind:'tf',count:1},{label:'TLN',kind:'short',count:1}],
  questions:[
   {id:'q-tn',sourceRef:'Câu giả 1',prompt:'Câu TN tổng hợp.',kind:'mc',choices:['Một','Hai','Ba','Bốn'],answer:'A',maxPoints:f('10','3'),maxMillipoints:p},
   {id:'q-ds',sourceRef:'Câu giả 2',prompt:'Xét bốn mệnh đề tổng hợp.',kind:'tf',statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,p/10,p/4,p/2,p],maxPoints:f('10','3'),maxMillipoints:p},
   {id:'q-tln',sourceRef:'Câu giả 3',prompt:'Trả lời ngắn tổng hợp.',kind:'short',mode:'rational',acceptedAnswers:['1/2'],shortRule:{verified:!pending,evidence:'Quy tắc tổng hợp đã kiểm',mode:'rational'},maxPoints:f('10','3'),maxMillipoints:p},
  ],
 } as PracticeExam;
 const started=createDraft(exam,'synthetic-ui-attempt',1000);assert.ok(started.ok,started.ok?'':started.message);
 const submitted=submitDraft(exam,{...started.value,answers:{'q-tn':'A','q-ds':[true,true,false,true],'q-tln':'1'}},2000);assert.ok(submitted.ok);
 const draft=submitted.value,score=resultFor(exam,draft)?.mtm;assert.ok(score);
 assert.deepEqual(score.rawTotal,f('11','3'));
 const receipt:HomeworkReceipt={attemptId:draft.attemptId,attemptNumber:2,submittedAt:2000,elapsedSeconds:1,score:pending?null:3.67,rubricVersion:MTM_SCORING_VERSION,mtm:score,late:false,timedOut:false};
 const state:HomeworkState={exam,draft,fullName:'Người dùng kiểm thử tổng hợp',className:'Lớp giả',lessonCode:'buoi-tong-hop',dueAt:null,maxAttempts:5,attemptsUsed:2,bestScore:null,demo:true,solutionsAvailable:false,receipts:[{attemptId:'synthetic-legacy-attempt',attemptNumber:1,submittedAt:1000,elapsedSeconds:1,score:7.125,late:false,timedOut:false},receipt]};
 return {exam,draft,score,receipt,state};
}

test('Bảng từng phần giữ phân số gốc và tổng làm tròn 3,67 từ 11/3',()=>{
 const {score}=fixture(),html=render(Breakdown,{score});
 for(const text of ['<table>','Trắc nghiệm','Đúng/Sai','Trả lời ngắn','Điểm gốc','Điểm hiển thị','10/3','1/3','11/3','3,67','ROUND_HALF_UP','Không cộng các điểm từng phần đã làm tròn'])assert.ok(html.includes(text),text);
 assert.match(html,/aria-label="Bảng điểm từng phần, có thể cuộn ngang" tabindex="0"/);
 assert.match(html,/<tfoot>.*<strong>3,67<\/strong>/);
 assert.ok(html.includes('3,33')&&html.includes('0,33'),'Hai phần hiển thị cộng ra 3,66 nhưng tổng chính xác là 3,67');
});

test('Có câu chưa chấm được thì bảng ẩn tổng gốc và tổng tạm',()=>{
 const {score}=fixture(true),html=render(Breakdown,{score});
 assert.equal(score.officialDisplayTotal,null);assert.equal(score.displayTotal,'3.67');
 assert.match(html,/Chưa công bố tổng điểm/);assert.match(html,/Có phần chưa chấm được/);
 assert.ok(!html.includes('11/3')&&!html.includes('3,67'),'Không lộ tổng tạm dù engine giữ để đối soát');
 assert.match(html,/<th scope="row">Trả lời ngắn.*?<td>Chờ chấm<\/td>/);
});

test('ResultSummary nối engine thật để hiển thị đúng 2 số và bảng điểm',()=>{
 const {exam,draft}=fixture(),html=render(Summary,{exam,draft});
 assert.match(html,/class="ep-summary-score" aria-hidden="true">3,67<\/span>/);
 assert.match(html,/Bảng điểm từng phần/);assert.match(html,/Tổng tính từ điểm gốc/);
 const pending=fixture(true),waiting=render(Summary,{exam:pending.exam,draft:pending.draft});
 assert.match(waiting,/Chưa chấm/);assert.ok(!waiting.includes('3,67'));
});

test('BTVN dùng snapshot receipt cho bảng điểm, giữ điểm lịch sử cũ',()=>{
 const {state,receipt}=fixture(),html=render(Overview,{state,busy:false,onStart(){}});
 assert.match(html,/<strong>3,67<small>\/10<\/small><\/strong>/);assert.match(html,/Bảng điểm từng phần/);
 assert.match(html,/7,125\/10/);assert.equal(homeworkReceiptScore(state.receipts[0]),'7,125');
 const noLocalExam=render(Overview,{state:{...state,exam:null},busy:false,onStart(){}});
 assert.match(noLocalExam,/11\/3/,'Snapshot receipt vẫn hiển thị khi không có khóa đề cục bộ');
 assert.equal(acknowledgedHomeworkReceipt(state),receipt);
});

test('BTVN nhận receipt pending, không công bố tổng hoặc làm mất biên nhận',()=>{
 const {state,receipt}=fixture(true),html=render(Overview,{state,busy:false,onStart(){}});
 assert.equal(acknowledgedHomeworkReceipt(state),receipt);assert.equal(homeworkReceiptScore(receipt),null);
 assert.match(html,/Em đã nộp lượt 2/);assert.match(html,/Chưa công bố tổng điểm/);
 assert.ok(!html.includes('Đang xác nhận lượt vừa nộp')&&!html.includes('3,67')&&!html.includes('11/3'));
 const text=createHomeworkResultSummary(state)!;assert.match(text,/Điểm: Chưa công bố tổng điểm/);assert.ok(!text.includes('3,67')&&!text.includes('null'));
});

test('Receipt pending phải có snapshot MTM đúng rubric và đúng lượt, không nhận nhãn đơn thuần',()=>{
 const {state,receipt}=fixture(true);
 for(const broken of [
  {...receipt,mtm:undefined},
  {...receipt,mtm:{...receipt.mtm!,attemptId:'synthetic-other-attempt'}},
  {...receipt,rubricVersion:'MTM-BTVN-10-v1'},
  {...receipt,mtm:{...receipt.mtm!,versions:{...receipt.mtm!.versions,rubricVersion:'MTM-BTVN-10-v1'}}},
  {...receipt,mtm:{...receipt.mtm!,pending:[]}},
  {...receipt,mtm:{...receipt.mtm!,officialTotal:f('11','3'),officialDisplayTotal:'3.67'}},
 ]){
  const input={...state,receipts:[broken]};assert.equal(acknowledgedHomeworkReceipt(input),null);assert.equal(createHomeworkResultSummary(input),null);
 }
 assert.equal(acknowledgedHomeworkReceipt(state),receipt);
});

test('Điểm MTM tròn vẫn hiện đủ 2 số, điểm cũ giữ nguyên định dạng',()=>{
 const {receipt}=fixture();const full:MtmScore={...receipt.mtm!,officialTotal:f('10'),officialDisplayTotal:'10.00',displayTotal:'10.00',rawTotal:f('10')};
 assert.equal(homeworkReceiptScore({...receipt,score:10,mtm:full}),'10,00');
 assert.equal(homeworkReceiptScore({...receipt,score:7.5,rubricVersion:undefined,mtm:undefined}),'7,5');
});

test('Đối chiếu MTM có khóa thiếu hoặc sai định dạng không đổ UI, không công bố khóa và điểm 0',()=>{
 for(const mutate of [
  (exam:any)=>{delete exam.questions[1].answer;},
  (exam:any)=>{exam.questions[1].answer=[true,false];},
  (exam:any)=>{exam.questions[1].answer=[true,false,null,false];},
  (exam:any)=>{delete exam.questions[2].acceptedAnswers;},
  (exam:any)=>{exam.questions[2].acceptedAnswers=[{bad:'fake-key'}];},
 ]){
  const {exam,draft}=fixture();mutate(exam);const html=render(Review,{exam,draft,showSummary:false});
  assert.match(html,/Chưa có đáp án đã xác minh/);assert.match(html,/Điểm câu này:<\/strong> Chưa tính được/);
  assert.ok(!html.includes('fake-key')&&!html.includes('[object Object]'));
 }
});
finish();
