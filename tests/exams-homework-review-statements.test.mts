import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import type {PracticeExam} from '../src/native/exams/data';
import type {Draft} from '../src/native/exams/store';
import type {HomeworkState} from '../src/native/homework/btvn-contract';

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const code=buildSync({entryPoints:[join(root,'src/native/exams/ExamReview.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};
new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);
const Review=mod.exports.default;
const overviewCode=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkOverview.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const overviewMod={exports:{} as any};
new Function('require','module','exports',overviewCode)((id:string)=>id.endsWith('.css')?{}:require(id),overviewMod,overviewMod.exports);
const Overview=overviewMod.exports.default;

// Dữ liệu GIẢ: cùng khóa chấm và bài nộp, chỉ thay nội dung mệnh đề có thể đọc.
const exam:PracticeExam={id:'mtm-preview-statements-fake',title:'Đề GIẢ đối chiếu Đúng/Sai',grade:10,period:'GK1',durationMinutes:10,rubricVersion:'MTM-BTVN-10-v1',versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Nguồn GIẢ kiểm thử',sourceUrl:'https://example.invalid/de-gia',sourceMaterial:{title:'Đề GIẢ',publisher:'Kiểm thử cục bộ',version:'fake-v1',locator:'1 câu giả'},publicationVerified:true,questionDisplayVerified:true,answerKeyVerified:true,rubricVerified:true,questionCount:1,sections:[{label:'I · Đúng/Sai',kind:'tf',count:1}],sourcePdf:{url:'https://example.invalid/de-gia.pdf',verified:true,sha256:'c'.repeat(64),bytes:100,totalPages:1,questionPages:[1]},questions:[{id:'fake-tf',sourceRef:'Đề GIẢ, câu 1',kind:'tf',maxMillipoints:10000,prompt:'Cho x = 2. Xét đúng sai.',answer:[true,true,false,true],pointsByCorrectCount:[0,1000,2500,5000,10000]}]};
const draft:Draft={version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:exam.rubricVersion,attemptId:'fake-attempt',startedAt:1000,deadline:601000,updatedAt:2000,submittedAt:2000,revision:1,answers:{'fake-tf':[true,false,false,true]}};
const original=JSON.stringify({exam,draft}),originalFetch=globalThis.fetch;
globalThis.fetch=()=>{throw Error('Kiểm lời giải tĩnh không được gọi mạng');};
try {
  for(const statements of [undefined,[],['','','',''],['x > 0','x² = 4','  ','x chẵn']]) {
    const candidate={...exam,questions:exam.questions.map(q=>({...q,statements}))};
    const html=renderToStaticMarkup(React.createElement(Review,{exam:candidate,draft,showSummary:false}));
    assert.match(html,/Các mệnh đề nằm trong PDF đề/);
    assert.match(html,/Màn này không mở PDF/);
    assert.ok(!html.includes('ep-statement-review'),'Không liệt kê ý đúng/sai không có văn bản');
    assert.ok(!html.includes('<strong>Ý a:</strong>'));
    assert.match(html,/Bài làm:/);assert.match(html,/Đáp án:/);assert.match(html,/Điểm câu này:/);
    if(statements===undefined)assert.match(html,/Điểm câu này:<\/strong> 5 \/ 10/,'Giữ điểm bản nộp khi PDF không có mệnh đề văn bản');
  }
  const readable={...exam,questions:exam.questions.map(q=>({...q,statements:['x > 0','x² = 4','x + 1 = 2','x chẵn']}))};
  const html=renderToStaticMarkup(React.createElement(Review,{exam:readable,draft,showSummary:false}));
  assert.match(html,/ep-statement-review/);assert.match(html,/<strong>Ý b:<\/strong> Chưa khớp đáp án/);
  assert.match(html,/x² = 4/);assert.match(html,/Điểm câu này:<\/strong> 5 \/ 10/);
  assert.ok(!html.includes('ep-statement-unavailable'));
  const noPdf=renderToStaticMarkup(React.createElement(Review,{exam:{...exam,sourcePdf:undefined},draft,showSummary:false}));
  assert.match(noPdf,/chưa có đủ văn bản bốn mệnh đề/);
  assert.ok(!noPdf.includes('nằm trong PDF'),'Không suy ra PDF khi nguồn chưa xác minh là PDF');
  assert.equal(renderToStaticMarkup(React.createElement(Review,{exam,draft:{...draft,submittedAt:null}})),'');
  const state:HomeworkState={exam,draft,fullName:'Học sinh GIẢ',className:'Lớp GIẢ',lessonCode:'buoi-gia',dueAt:null,maxAttempts:5,attemptsUsed:1,bestScore:5,demo:true,receipts:[{attemptId:'fake-attempt',attemptNumber:1,score:5,submittedAt:2000,elapsedSeconds:1,late:false,timedOut:false}]};
  const overview=(input:HomeworkState)=>renderToStaticMarkup(React.createElement(Overview,{state:input,busy:false,onStart:()=>{throw Error('Không mở lượt làm khi render');}}));
  assert.match(overview(state),/chưa đưa vào phần ôn vì màn này thiếu văn bản/,'Giải thích câu sai bị loại kể cả khi không còn câu ôn');
  for(const input of [{...state,exam:readable},{...state,solutionsAvailable:false},{...state,receipts:[]},{...state,draft:{...draft,examVersionHash:'d'.repeat(64)}},{...state,draft:{...draft,submittedAt:null}}])assert.ok(!overview(input).includes('chưa đưa vào phần ôn vì màn này thiếu văn bản'));
  assert.equal(JSON.stringify({exam,draft}),original,'Không đổi bản nộp hoặc đề gốc');
} finally { globalThis.fetch=originalFetch; }
console.log('Đạt đối chiếu Đúng/Sai đủ/thiếu mệnh đề, thông báo đúng nguồn và giữ điểm bản nộp.');
