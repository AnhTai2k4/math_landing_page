// Chỉ dùng dữ liệu tổng hợp. SSR và hook giả không thay thế QA trình duyệt thật.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file:string,extra='',hooks?:any){
  const code=buildSync({stdin:{contents:readFileSync(join(root,file),'utf8')+extra,sourcefile:file,resolveDir:join(root,file,'..'),loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
  const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id==='react'&&hooks?{...React,...hooks}:id.endsWith('.css')?{}:require(id),mod,mod.exports);return mod.exports;
}
const render=(component:any,props:any)=>renderToStaticMarkup(React.createElement(component,props));
const retry=load('src/native/homework/HomeworkRetry.tsx','\nexport {RetryExercise};');
const Overview=load('src/native/homework/HomeworkOverview.tsx').default;
const q:any={id:'cau-gia',kind:'short',mode:'numeric',sourceRef:'Nguồn GIẢ',prompt:'Độ dài GIẢ.',acceptedAnswers:['2.50 cm'],solution:'Lời giải GIẢ.',shortRule:{verified:true,evidence:'Nguồn GIẢ đã kiểm',mode:'decimal',unit:'cm',decimalPlaces:2}};
const exam:any={id:'de-gia',title:'Đề GIẢ',grade:12,period:'GK1',durationMinutes:10,versionHash:'a'.repeat(64),rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'khoa-gia',questionCount:1,questions:[q]};
const exercise=(question:any,answer:string,rubricVersion=MTM_SCORING_VERSION)=>render(retry.RetryExercise,{exam:{...exam,rubricVersion,questions:[question]},item:{question,index:0},submittedAnswer:'',onCorrect(){},onNext(){},hasNext:false,complete:false,corrected:false,focusTitle:false,canAttemptAgain:true,savedDraft:{answer,verdict:null,hints:0,solution:false,solutionViewed:false,hintsViewed:false,needsRecheck:false}});
for(const [places,answer,display] of [[0,'2 cm','2 cm'],[2,'2.50 cm','2,50 cm'],[3,'2,500 cm','2,500 cm']] as const){
  const question={...q,shortRule:{...q.shortRule,decimalPlaces:places}},html=exercise(question,answer);
  assert.ok(html.includes('Máy đang hiểu là '+display+'.'));
  assert.doesNotMatch(html,/Máy đang hiểu là [^<]*\//);
  assert.ok(!html.includes('is-ambiguous'));
  const live=[...html.matchAll(/<p\b[^>]*aria-live="polite"[^>]*>([\s\S]*?)<\/p>/g)].map(match=>match[1]);
  assert.deepEqual(live,['Máy đang hiểu là '+display+'.'],'Vùng live chỉ đọc phần diễn giải đổi theo câu trả lời');
  assert.ok(html.includes('Ghi đơn vị cm ở cuối.'));
  if(places===0){assert.ok(html.includes('Nhập số nguyên, không có chữ số thập phân.'));assert.ok(!html.includes('Nhập số nguyên hoặc số thập phân'));}
  else assert.ok(html.includes('Nhập đúng '+places+' chữ số sau dấu thập phân.'));
}
const free={...q,shortRule:{...q.shortRule,decimalPlaces:undefined}};
assert.match(exercise(free,'2,500 cm'),/is-ambiguous/);
const rational={...q,mode:'rational',shortRule:{...q.shortRule,mode:'rational',decimalPlaces:undefined}};
assert.match(exercise(rational,'2,50 cm'),/Máy đang hiểu là 5\/2 cm/);
const invalid=exercise(q,'2,5 cm');assert.ok(!invalid.includes('Máy đang hiểu là'));
const metres={...q,shortRule:{...q.shortRule,unit:'m',decimalPlaces:0},acceptedAnswers:['12 m']};
for(const answer of ['12 cm','12m','12']){
  assert.equal(retry.checkRetryAnswer(metres,answer,MTM_SCORING_VERSION),'invalid');
  const html=exercise(metres,answer);assert.match(html,/Đơn vị chưa đúng\. Ghi đơn vị m ở cuối, cách số bằng một khoảng trắng\./);assert.ok(!html.includes('Máy đang hiểu là'));
}
assert.match(exercise(metres,'12 m'),/Máy đang hiểu là 12 m/);
const legacy={...q,shortRule:undefined};
assert.match(exercise(legacy,'1.000','legacy'),/Máy đang hiểu là 1\./);
assert.equal(retry.checkRetryAnswer(q,'2,50 cm','legacy'),'invalid');

const state:any={exam,fullName:'Người GIẢ',className:'Lớp GIẢ',lessonCode:'buoi-gia',dueAt:null,maxAttempts:1,attemptsUsed:1,bestScore:7.25,demo:true,kind:'kiem-tra-thang',solutionsAvailable:false,draft:{version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:'legacy',attemptId:'luot-gia',startedAt:1000,deadline:10000,updatedAt:2000,submittedAt:2000,revision:1,answers:{}},receipts:[{attemptId:'luot-gia',attemptNumber:1,score:7.25,submittedAt:2000,elapsedSeconds:1,late:true,timedOut:true}]};
const before=JSON.stringify(state),hidden=render(Overview,{state,busy:false,onStart(){}});
assert.match(hidden,/Đã nộp, điểm công bố sau giờ đóng/);
for(const text of ['Nộp muộn','Đúng hạn','Hết giờ','7,25'])assert.ok(!hidden.includes(text),text);
assert.equal(JSON.stringify(state),before);
const published=render(Overview,{state:{...state,solutionsAvailable:true},busy:false,onStart(){}});
assert.match(published,/Nộp muộn/);assert.match(published,/Hết giờ/);assert.match(published,/7,25/);

let slots:any[]=[],cursor=0;
const hooks={useState:(initial:any)=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],(next:any)=>slots[i]=typeof next==='function'?next(slots[i]):next];},useEffect(){}};
const Cards=load('src/native/homework/LessonCards.tsx','',hooks).default;
const text=(tree:any):string=>tree==null||typeof tree==='boolean'?'':Array.isArray(tree)?tree.map(text).join(''):typeof tree==='object'?text(tree.props?.children):String(tree);
const all=(tree:any,predicate:(node:any)=>boolean):any[]=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(node=>all(node,predicate)):[...(predicate(tree)?[tree]:[]),...all(tree.props?.children,predicate)];
const lesson:any={lessonCode:'buoi-gia',date:'2026-10-16',title:'Buổi GIẢ',classNames:['Lớp GIẢ'],kind:'kiem-tra-thang',videoId:'video-gia',videoEmbeddable:false,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:10000,bestScore:null,late:true,submittedAt:2000,available:true};
const lessonBefore=JSON.stringify(lesson),visited:string[]=[];
const draw=(item=lesson)=>{cursor=0;return Cards({lessons:[item],busy:false,onHomework:(code:string)=>visited.push(code),demo:true});};
let tree=draw();
assert.equal(all(tree,node=>node.type==='b'&&node.props.className==='late').length,0);
assert.ok(!text(tree).includes('Nộp muộn'));
all(tree,node=>node.type==='button'&&text(node)==='▶ Xem video')[0].props.onClick();tree=draw();
const reviewButtons=all(tree,node=>node.type==='button'&&text(node)==='Xem bài đã nộp');
assert.equal(reviewButtons.length,2,'Nút chính và nút sau video thống nhất bài đã nộp');
assert.equal(all(tree,node=>node.type==='button'&&text(node)==='Làm BTVN buổi này').length,0);
assert.ok(!text(tree).includes('Em có thể làm BTVN của buổi này ngay.'));
for(const button of reviewButtons){const described=all(tree,node=>node.props?.id===button.props['aria-describedby']);assert.equal(described.length,1);assert.equal(text(described[0]),'Điểm công bố sau giờ đóng.');button.props.onClick();}
assert.deepEqual(visited,['buoi-gia','buoi-gia']);
all(tree,node=>node.type==='button'&&text(node)==='Đóng video')[0].props.onClick();tree=draw();
assert.equal(all(tree,node=>node.type==='button'&&text(node)==='Xem bài đã nộp').length,2,'Lời nhắc sau khi đóng video giữ đúng trạng thái đã nộp');
assert.equal(JSON.stringify(lesson),lessonBefore);
slots=[];tree=draw({...lesson,bestScore:7.25});
assert.equal(all(tree,node=>node.type==='b'&&node.props.className==='late').length,1);
assert.ok(text(tree).includes('Xem kết quả'));
console.log('Đạt hậu phản biện UI: giấu hạn/hết giờ, hai CTA và mô tả, decimal 0/2/3, rational, live động và legacy bằng dữ liệu GIẢ.');
