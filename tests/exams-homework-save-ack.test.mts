import assert from 'node:assert/strict';
import {createHomeworkSaver,type RemoteSaveStatus} from '../src/native/homework/remote-save';
import {acknowledgedHomeworkReceipt} from '../src/native/homework/result-summary';
import type {HomeworkState,HomeworkReceipt} from '../src/native/homework/btvn-contract';
import type {Draft} from '../src/native/exams/store';

const draft=(submittedAt:number|null=2000):Draft=>({version:1,examId:'fake-exam',examVersionHash:'fake-version',rubricVersion:'fake-rubric',attemptId:'fake-attempt',startedAt:1000,deadline:61000,updatedAt:2000,revision:1,submittedAt,answers:{'fake-q':'A'}});
const receipt=(score=8):HomeworkReceipt=>({attemptId:'fake-attempt',attemptNumber:1,submittedAt:2000,elapsedSeconds:1,score,late:false,timedOut:false});
const state=(patch:Partial<HomeworkState>={}):HomeworkState=>({exam:null,fullName:'GIẢ',className:'LOP-TEST-GIA',lessonCode:'fake-lesson',dueAt:null,maxAttempts:5,attemptsUsed:1,draft:draft(),receipts:[receipt()],bestScore:8,demo:true,...patch});
let count=0;
async function test(name:string,run:()=>Promise<void>){await run();console.log('ĐẠT '+(++count)+' '+name);}
function harness(){
  const calls:{draft:Draft;resolve:(s:HomeworkState)=>void}[]=[],saved:HomeworkState[]=[],statuses:RemoteSaveStatus[]=[];
  const saver=createHomeworkSaver({delay:60000,send:d=>new Promise(resolve=>calls.push({draft:d,resolve})),onSaved:s=>saved.push(s),onStatus:s=>statuses.push(s)});
  return {calls,saved,statuses,saver};
}
async function rejectsThenRecovers(bad:HomeworkState,sent=draft()){
  const h=harness();h.saver.update(sent);if(sent.submittedAt===null)h.saver.retry();await Promise.resolve();
  h.calls[0].resolve(bad);await h.saver.settled();
  assert.equal(h.saver.pending(),true,'Phản hồi sai không được giải phóng RAM');assert.equal(h.saved.length,0);assert.equal(h.statuses.at(-1)?.failed,true);assert.equal(h.saver.closed(),false);
  h.saver.retry();await Promise.resolve();assert.equal(h.calls.length,2,'Không terminal sau ACK sai');
  h.calls[1].resolve(state({draft:sent,receipts:sent.submittedAt===null?[]:[receipt()]}));await h.saver.settled();
  assert.equal(h.saver.pending(),false);assert.equal(h.saved.length,1);assert.equal(await h.saver.flush(),true);h.saver.dispose();
}

for(const score of [-1,10.01,NaN,Infinity])await test('Điểm biên nhận sai bị giữ, retry được: '+String(score),()=>rejectsThenRecovers(state({receipts:[receipt(score)]})));
await test('Hai receipt cùng attempt không được nhận là đã nộp',()=>rejectsThenRecovers(state({receipts:[receipt(),receipt()]})));
for(const bad of [null,{},'fake'])await test('receipts sai kiểu không trở thành ACK: '+String(bad),()=>rejectsThenRecovers(state({receipts:bad as any})));
for(const field of ['examId','examVersionHash','rubricVersion'] as const){
  await test('Không ACK nhầm '+field+' khi save hoặc submit',async()=>{
    for(const submittedAt of [null,2000]){const sent=draft(submittedAt);await rejectsThenRecovers(state({draft:{...sent,[field]:'other'},receipts:submittedAt===null?[]:[receipt()]}),sent);}
  });
}
for(const answers of [null,[],['A'],'A'])await test('Đáp án sai kiểu giữ RAM thay vì ACK: '+JSON.stringify(answers),()=>rejectsThenRecovers(state({draft:{...draft(),answers:answers as any}})));
await test('Bản máy chủ đóng khác đáp án chỉ được chọn khi receipt hợp lệ',async()=>{
  const h=harness();h.saver.update(draft());await Promise.resolve();h.calls[0].resolve(state({draft:{...draft(),answers:{'fake-q':'B'}},receipts:[receipt(-1)]}));await h.saver.settled();
  assert.equal(h.saver.closed(),false);h.saver.acceptClosed();assert.equal(h.saved.length,0);assert.equal(h.saver.pending(),true);
  h.saver.retry();await Promise.resolve();h.calls[1].resolve(state({draft:{...draft(),answers:{'fake-q':'B'}}}));await h.saver.settled();assert.equal(h.saver.closed(),true);assert.equal(h.saver.pending(),true);
  h.saver.acceptClosed();assert.equal(h.saved[0].draft!.answers['fake-q'],'B');assert.equal(h.saver.pending(),false);h.saver.dispose();
});
await test('Metadata thời gian phiếu sai vẫn ACK điểm đúng như Overview',async()=>{
  const h=harness(),next=state({receipts:[{...receipt(0),elapsedSeconds:-1}]});h.saver.update(draft());await Promise.resolve();h.calls[0].resolve(next);await h.saver.settled();
  assert.ok(acknowledgedHomeworkReceipt(next));assert.equal(h.saver.pending(),false);assert.equal(h.saved.length,1);assert.equal(h.statuses.at(-1)?.failed,false);h.saver.dispose();
});
await test('Receipt lịch sử khác lượt không gây trùng, điểm biên 0 và 10 đều nhận',async()=>{
  for(const score of [0,10]){const h=harness(),next=state({receipts:[{...receipt(),attemptId:'fake-history'},receipt(score)]});h.saver.update(draft());await Promise.resolve();h.calls[0].resolve(next);await h.saver.settled();assert.equal(h.saver.pending(),false);assert.ok(acknowledgedHomeworkReceipt(next));h.saver.dispose();}
});
console.log(count+' ca ACK ngoại tuyến đạt; không fetch, storage hoặc dữ liệu thật.');
