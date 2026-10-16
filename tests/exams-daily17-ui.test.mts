// Mọi nguồn, đề, người học và lượt làm trong tệp này đều tổng hợp.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
import {acknowledgedHomeworkReceipt,createHomeworkResultSummary} from '../src/native/homework/result-summary';
import type {HomeworkState} from '../src/native/homework/btvn-contract';
import type {PracticeExam} from '../src/native/exams/data';
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file:string,extra=''){
 const code=buildSync({stdin:{contents:readFileSync(join(root,file),'utf8')+extra,sourcefile:file,resolveDir:join(root,file,'..'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
 const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);return mod.exports;
}
const retry=load('src/native/homework/HomeworkRetry.tsx','\nexport {RetryExercise};');
const Overview=load('src/native/homework/HomeworkOverview.tsx').default,Cards=load('src/native/homework/LessonCards.tsx').default;
const render=(component:any,props:any)=>renderToStaticMarkup(React.createElement(component,props));
const rule={verified:true,evidence:'Nguồn GIẢ đã kiểm',mode:'decimal',unit:'cm',decimalPlaces:2} as const;
const q:any={id:'q-gia',kind:'short',mode:'numeric',sourceRef:'Câu GIẢ',prompt:'Nhập độ dài GIẢ.',maxMillipoints:10000,maxPoints:{numerator:'10',denominator:'1'},shortRule:rule,acceptedAnswers:['2.50 cm'],solution:'Nguồn GIẢ có lời giải.'};
for(const answer of ['2,50 cm','2.50 cm',' 2,50 cm '])assert.equal(retry.checkRetryAnswer(q,answer,MTM_SCORING_VERSION),'correct');
for(const answer of ['2,5 cm','2,50','2,50 m','1/0 cm'])assert.equal(retry.checkRetryAnswer(q,answer,MTM_SCORING_VERSION),'invalid');
assert.equal(retry.checkRetryAnswer(q,'2,51 cm',MTM_SCORING_VERSION),'wrong');
assert.equal(retry.checkRetryAnswer(q,'2,50 cm','legacy'),'invalid','Nhánh cũ giữ parser không đơn vị');
const exact={...q,mode:'exact',acceptedAnswers:['A B'],shortRule:{...rule,mode:'exact',unit:undefined,decimalPlaces:undefined,whitespace:'collapse'}};
assert.equal(retry.checkRetryAnswer(exact,'A   B',MTM_SCORING_VERSION),'correct');
assert.equal(retry.checkRetryAnswer(exact,'a B',MTM_SCORING_VERSION),'wrong');
const exam={id:'de-gia',title:'Đề GIẢ',grade:12,period:'GK1',durationMinutes:10,versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'key-gia',questionCount:1,questions:[q]} as PracticeExam;
const exercise=render(retry.RetryExercise,{exam,item:{question:q,index:0},submittedAnswer:'2,5 cm',onCorrect(){},onNext(){},hasNext:false,complete:false,corrected:false,focusTitle:false,canAttemptAgain:true,savedDraft:{answer:'2,50 cm',verdict:'correct',hints:0,solution:false,solutionViewed:false,hintsViewed:false,needsRecheck:false}});
assert.match(exercise,/Ghi đơn vị cm ở cuối/);assert.match(exercise,/đúng 2 chữ số/);assert.match(exercise,/Máy đang hiểu là 2,50 cm/);assert.ok(!exercise.includes('5/2')&&!exercise.includes('không nhập đơn vị hay biểu thức'));
// Kiểm phòng thủ UI: ngay cả payload cũ còn điểm, trạng thái đóng kết quả vẫn che toàn bộ.
const state:HomeworkState={exam,fullName:'Người GIẢ',className:'Lớp GIẢ',lessonCode:'buoi-gia',dueAt:null,maxAttempts:1,attemptsUsed:1,bestScore:7.25,demo:true,kind:'kiem-tra-thang',solutionsAvailable:false,opensAt:1000,closesAt:10000,draft:{version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:'legacy',attemptId:'luot-gia',startedAt:1000,deadline:10000,updatedAt:2000,submittedAt:2000,revision:1,answers:{}},receipts:[{attemptId:'luot-gia',attemptNumber:1,score:7.25,submittedAt:2000,elapsedSeconds:1,late:false,timedOut:false}]};
const before=JSON.stringify(state);
assert.equal(acknowledgedHomeworkReceipt(state),null);assert.equal(createHomeworkResultSummary(state),null);
const hidden=render(Overview,{state,busy:false,onStart(){}});
assert.match(hidden,/Đã nộp, điểm công bố sau giờ đóng/);
for(const text of ['7,25','Bảng điểm từng phần','Sao chép phiếu kết quả','Ôn một câu','Đang xác nhận lượt vừa nộp','Xem lời giải','Nộp muộn','Đúng hạn','Hết giờ'])assert.ok(!hidden.includes(text),text);
assert.equal(JSON.stringify(state),before);
const visible=render(Overview,{state:{...state,solutionsAvailable:true},busy:false,onStart(){}});assert.match(visible,/7,25/);
const lesson:any={lessonCode:'buoi-gia',classNames:['Lớp GIẢ'],date:'2026-10-16',title:'Buổi GIẢ',kind:'kiem-tra-thang',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:10000,bestScore:null,late:false,submittedAt:2000,available:true};
const cards=render(Cards,{lessons:[lesson],busy:false,onHomework(){},demo:true});
assert.match(cards,/Đã nộp · Chờ công bố điểm/);assert.match(cards,/Em còn 0 buổi/);assert.ok(!cards.includes('Chưa làm BTVN')&&!cards.includes('Quá hạn · Chưa nộp'));assert.match(cards,/Xem bài đã nộp/);assert.ok(!cards.includes('Xem kết quả'));
console.log('Đạt TLN đúng đơn vị/chữ số/khoảng trắng, legacy và SSR giấu kết quả tháng/phiếu/thẻ đã nộp bằng dữ liệu GIẢ.');
