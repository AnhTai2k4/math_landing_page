// Các lượt, đề và người học đều tổng hợp. Không gọi mạng hoặc storage thật.
import assert from 'node:assert/strict';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import demoExam from '../server/btvn/demo-exam.json';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkState,LessonMaterial} from '../src/native/homework/btvn-contract';
import {createHomeworkSaver,type RemoteSaveStatus} from '../src/native/homework/remote-save';
import {acknowledgedHomeworkSubmission,acknowledgedHomeworkReceipt,createHomeworkResultSummary} from '../src/native/homework/result-summary';
import {mergeHomeworkRenewal,homeworkServerNow,createAssetRenewal} from '../src/native/homework/asset-renewal';
const T0=Date.UTC(2026,9,16,1),closesAt=T0+10000;
let count=0;
async function test(name:string,fn:()=>unknown){await fn();console.log('ĐẠT '+(++count)+' '+name);}
function fixture(monthlyClose=closesAt){
 let now=T0;
 const exam=structuredClone(demoExam) as unknown as PracticeExam;
 const student={studentCode:'SYNTHETIC-ROOT-ONLY',fullName:'Người học tổng hợp',phone:'0000000000',className:'Lớp tổng hợp'};
 const material:LessonMaterial={kind:'kiem-tra-thang',lessonCode:'buoi-gia',classNames:[student.className],date:'2026-10-16',title:'Bài tổng hợp',opensAt:T0,closesAt:monthlyClose,videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null};
 const repo=new MemoryHomeworkRepository([student]),service=new HomeworkService(repo,exam,T0+86400000,'lop-gia',material.lessonCode,()=>now,[material]);
 const token=service.login({studentCode:student.studentCode},'ip-gia'),started=service.start(token);
 const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='short'?q.acceptedAnswers[0]:q.kind==='self'?'':q.answer]));
 return {started,service,token,answers,clock:(time:number)=>{now=time;}};
}
await test('Nộp tháng trước đóng nhận ACK, hết pending, phiếu và điểm tiếp tục bị giấu',async()=>{
 const f=fixture(),draft={...f.started.draft!,answers:f.answers,submittedAt:T0+1000,updatedAt:T0+1000};f.clock(T0+1000);
 const statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
 const saver=createHomeworkSaver({send:d=>Promise.resolve(f.service.submit(f.token,d.attemptId,d.answers)),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
 saver.update(draft);assert.equal(await saver.flush(),true);assert.equal(saver.pending(),false);assert.equal(statuses.at(-1)?.failed,false);assert.equal(saved.length,1);
 const next=saved[0];assert.ok(acknowledgedHomeworkSubmission(next));assert.equal(acknowledgedHomeworkReceipt(next),null);assert.equal(createHomeworkResultSummary(next),null);assert.equal(next.receipts[0].score,null);assert.equal(next.bestScore,null);saver.dispose();
});
await test('Biên nhận ẩn thiếu, sai lượt hoặc trùng không ACK',async()=>{
 const f=fixture();f.clock(T0+1000);const next=f.service.submit(f.token,f.started.draft!.attemptId,f.answers);
 for(const receipts of [[],[{...next.receipts[0],attemptId:'luot-gia-khac'}],next.receipts.concat(next.receipts)]){
  const statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
  const saver=createHomeworkSaver({send:()=>Promise.resolve({...next,receipts}),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
  saver.update(next.draft!);assert.equal(await saver.flush(),false);assert.equal(saver.pending(),true);assert.equal(saver.closed(),false);assert.equal(saved.length,0);assert.equal(statuses.at(-1)?.failed,true);saver.dispose({flushPending:false});
 }
});
await test('Biên nhận tháng cùng lượt lệch mốc nộp vẫn ACK và tiếp tục giấu điểm, phiếu',async()=>{
 const f=fixture();f.clock(T0+1000);const next=f.service.submit(f.token,f.started.draft!.attemptId,f.answers);
 const received={...next,receipts:[{...next.receipts[0],submittedAt:T0+999}]};
 const statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
 const saver=createHomeworkSaver({send:()=>Promise.resolve(received),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
 saver.update(next.draft!);assert.equal(await saver.flush(),true);assert.equal(saver.pending(),false);assert.equal(saver.closed(),false);assert.equal(saved.length,1);assert.equal(statuses.at(-1)?.failed,false);
 assert.equal(acknowledgedHomeworkSubmission(received),received.receipts[0]);assert.equal(acknowledgedHomeworkReceipt(received),null);assert.equal(createHomeworkResultSummary(received),null);assert.equal(received.bestScore,null);assert.equal(received.receipts[0].score,null);
 saver.dispose({flushPending:false});
});
await test('Autosave hết giờ nhận được lựa chọn bản máy chủ đã chấm dù điểm còn ẩn',async()=>{
 const f=fixture(T0+3*60*60*1000);f.clock(T0+1000);const savedState=f.service.save(f.token,f.started.draft!.attemptId,f.answers);
 // Hết 120 phút của lượt, bài tháng vẫn còn một giờ trước mốc công bố.
 const local={...savedState.draft!,answers:{...f.answers,[f.started.exam!.questions[0].id]:'D'}};
 f.clock(local.deadline);let server:HomeworkState;
 const statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
 const saver=createHomeworkSaver({delay:60000,send:d=>Promise.resolve(server=f.service.save(f.token,d.attemptId,d.answers)),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
 saver.update(local);assert.equal(await saver.flush(),false);assert.equal(saver.closed(),true);assert.equal(server!.receipts[0].timedOut,true);assert.equal(server!.solutionsAvailable,false);assert.equal(saved.length,0);assert.equal(statuses.at(-1)?.failed,true);
 saver.acceptClosed();assert.equal(await saver.flush(),true);assert.equal(saver.pending(),false);assert.equal(saved[0],server);assert.equal(createHomeworkResultSummary(saved[0]),null);saver.dispose();
});
await test('Saver không ACK biên nhận ẩn từ phiên bản khóa khác',async()=>{
 const f=fixture();f.clock(T0+1000);const next=f.service.submit(f.token,f.started.draft!.attemptId,f.answers);
 for(const [sentKey,receivedKey] of [['key-a','key-b'],['key-a',undefined],[undefined,'key-b']]){
  const sent={...next.draft!,answerKeyVersion:sentKey},bad={...next,draft:{...next.draft!,answerKeyVersion:receivedKey}};
  const statuses:RemoteSaveStatus[]=[],saved:HomeworkState[]=[];
  const saver=createHomeworkSaver({send:()=>Promise.resolve(bad),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
  saver.update(sent);assert.equal(await saver.flush(),false);assert.equal(saved.length,0);assert.equal(statuses.at(-1)?.failed,true);assert.equal(saver.pending(),true);saver.dispose({flushPending:false});
 }
});
await test('Gia hạn chỉ đổi chữ ký cùng tài sản, không nhập khóa hoặc điểm vào bản đang gõ',()=>{
 const f=fixture(),before=structuredClone(f.started);const hash='a'.repeat(64);
 const segment={path:'gia/q.png',sha256:hash,width:100,height:100,sourcePage:1,privateUrl:'https://example.invalid/old',privateUnavailable:true};
 before.exam!.sourceInstructions=[segment];before.exam!.questions[0].sourceContent={questions:[segment]};
 before.exam!.sourcePdf={url:'/old.pdf',verified:true,sha256:hash,bytes:100,totalPages:1,questionPages:[1]};
 f.clock(closesAt);const published=f.service.submit(f.token,before.draft!.attemptId,f.answers);
 published.exam!.sourceInstructions=[{...segment,privateUrl:'https://example.invalid/new',privateUnavailable:undefined}];published.exam!.questions[0].sourceContent={questions:[{...segment,privateUrl:'https://example.invalid/new',privateUnavailable:undefined}],solutions:[segment]};
 published.exam!.sourcePdf={...before.exam!.sourcePdf,url:'/new.pdf'};published.exam!.questions[0].solution='Lời giải không được nhập';
 const snapshot=JSON.stringify(before),merged=mergeHomeworkRenewal(before,{...published,assetsExpiresAt:closesAt+900000,clientReceivedAt:closesAt+20});
 assert.equal(merged.draft,before.draft);assert.equal(merged.receipts,before.receipts);assert.equal(merged.bestScore,before.bestScore);assert.equal(merged.solutionsAvailable,false);assert.equal(merged.lessons,before.lessons);
 assert.equal(merged.exam!.questions[0].sourceContent!.questions[0].privateUrl,'https://example.invalid/new');assert.equal(merged.exam!.sourceInstructions![0].privateUnavailable,undefined);assert.equal(merged.exam!.sourcePdf!.url,'/new.pdf');
 assert.equal(merged.exam!.responseMode,'questions-only');for(const question of merged.exam!.questions)for(const field of ['answer','acceptedAnswers','shortRule','solution'])assert.ok(!Object.hasOwn(question,field),field);
 assert.equal(merged.exam!.questions[0].sourceContent!.solutions,undefined);assert.equal(JSON.stringify(before),snapshot);
 const changed=structuredClone(published);changed.exam!.questions[0].sourceContent!.questions[0].sha256='b'.repeat(64);
 assert.equal(mergeHomeworkRenewal(before,changed).exam!.questions[0].sourceContent!.questions[0].privateUrl,segment.privateUrl);
});
await test('Đồng hồ máy nhanh hoặc chậm đều kiểm giờ server và cửa sổ gia hạn đúng',async()=>{
 for(const skew of [-86400000,86400000]){
  const received=T0+skew,state={serverNow:T0,clientReceivedAt:received};
  assert.equal(homeworkServerNow(state,received),T0);assert.equal(homeworkServerNow(state,received+5000),T0+5000);
  let calls=0;const renew=createAssetRenewal(async()=>{calls++;},()=>homeworkServerNow(state,received+5000));
  await renew(T0+3600000);assert.equal(calls,0);await renew(T0+600000);assert.equal(calls,1);
 }
});
console.log(count+' ca ACK, tài sản và đồng hồ ngoại tuyến đạt.');
