// Dữ liệu tổng hợp, chỉ RAM và RPC giả. Không gọi mạng hoặc hồ sơ học sinh.
import assert from 'node:assert/strict';
import {HomeworkService,HomeworkError} from '../server/btvn/service';
import {MemoryHomeworkRepository,type StudentWork} from '../server/btvn/repository';
import {SupabaseHomeworkRepository,type DurableSnapshot} from '../server/btvn/supabase-repository';
import type {HomeworkState,HomeworkReceipt,LessonMaterial} from '../src/native/homework/btvn-contract';
import type {PracticeExam} from '../src/native/exams/data';
import {MTM_SCORING_VERSION} from '../src/native/exams/mtm-scoring';
import {pipelineFixture} from './btvn-pipeline-fixture';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('DAILY17-DISCLOSURE-');
const T0=Date.UTC(2026,9,16,3),closesAt=T0+60000;
const clone=<T,>(value:T):T=>structuredClone(value);
function fixture(mtm=true){
  const f=pipelineFixture();
  const exam:PracticeExam=mtm?{...f.exam,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fixture-key-v1',sourceComplete:true,questionCount:1,
    sections:[{label:'Trắc nghiệm tổng hợp',kind:'mc',count:1}],questions:[{id:'fixture-question',kind:'mc',sourceRef:'Câu tổng hợp',prompt:'1 + 1 = ?',choices:['2','3','4','5'],answer:'A',maxMillipoints:10000,maxPoints:{numerator:'10',denominator:'1'}}]}:f.exam;
  const material:LessonMaterial={...f.material,date:'2026-10-16',kind:'kiem-tra-thang',opensAt:T0,closesAt};
  const other:LessonMaterial={...f.material,lessonCode:'fixture-regular',date:'2026-10-15',kind:'btvn'};
  const student={studentCode:'SYNTHETIC-NOT-A-STUDENT',fullName:'Người dùng tổng hợp',phone:'0000000000',className:material.classNames[0]};
  return {exam,material,other,student,answers:mtm?{'fixture-question':'A'}:{'mc-1':'D'}};
}
function hidden(state:HomeworkState,expectedId:string){
  assert.equal(state.bestScore,null);
  assert.equal(state.solutionsAvailable,false);
  const receipt=state.receipts.find(r=>r.attemptId===expectedId)!;
  assert.ok(receipt,'Vẫn xác nhận đúng lượt đã nộp');
  assert.deepEqual(Object.keys(receipt).sort(),['attemptId','attemptNumber','submittedAt','elapsedSeconds','late','timedOut','score'].sort());
  assert.equal(receipt.score,null);
  assert.equal(state.lessons?.find(l=>l.kind==='kiem-tra-thang')?.bestScore,null);
  assert.ok(state.lessons?.find(l=>l.kind==='kiem-tra-thang')?.submittedAt!=null);
}

for(const mtm of [true,false])test(`Service giấu điểm ${mtm?'MTM':'rubric cũ'} qua state/select/save/submit lặp, mở đúng closesAt`,()=>{
  const f=fixture(mtm);let now=T0;
  const repo=new MemoryHomeworkRepository([f.student]);
  const service=new HomeworkService(repo,f.exam,0,'fixture',f.material.lessonCode,()=>now,[f.material,f.other],{[f.other.lessonCode]:f.exam});
  const token=service.login({studentCode:f.student.studentCode},'fixture-ip');
  const started=service.start(token),id=started.draft!.attemptId;
  service.save(token,id,f.answers);now++;
  hidden(service.submit(token,id,f.answers),id);
  const stored=repo.get(f.student.studentCode)!.receipts[0];
  assert.equal(stored.score,mtm?10:3);
  if(mtm){assert.equal(stored.mtm!.officialDisplayTotal,'10.00');assert.ok(stored.mtm!.rows.length);}
  for(const state of [service.state(token),service.select(token,f.material.lessonCode),service.save(token,id,{}),service.submit(token,id,{})])hidden(state,id);
  assert.deepEqual(repo.get(f.student.studentCode)!.receipts,[stored],'Redaction không ghi đè biên nhận gốc hoặc chấm lại lượt cũ');
  const regular=service.select(token,f.other.lessonCode);
  assert.equal(regular.lessons!.find(l=>l.lessonCode===f.material.lessonCode)!.bestScore,null,'Đổi buổi không lộ điểm bài tháng');
  now=closesAt-1;hidden(service.select(token,f.material.lessonCode),id);
  now=closesAt;const opened=service.state(token);
  assert.equal(opened.solutionsAvailable,true);assert.equal(opened.bestScore,stored.score);
  assert.deepEqual(opened.receipts,[stored]);assert.equal(opened.lessons![0].bestScore,stored.score);
  assert.deepEqual(service.submit(token,id,{}).receipts,[stored]);
  assert.equal(repo.get(f.student.studentCode)!.drafts.length,1);
});

test('BTVN thường vẫn công bố điểm ngay sau nộp',()=>{
  const f=fixture();const material={...f.other,lessonCode:f.material.lessonCode};
  const repo=new MemoryHomeworkRepository([f.student]),service=new HomeworkService(repo,f.exam,0,'fixture',material.lessonCode,()=>T0,[material]);
  const token=service.login({studentCode:f.student.studentCode},'fixture-ip'),started=service.start(token);
  const state=service.submit(token,started.draft!.attemptId,f.answers);
  assert.equal(state.bestScore,10);assert.equal(state.receipts[0].score,10);assert.ok(state.receipts[0].mtm);
  assert.equal(state.lessons![0].bestScore,10);
});

test('Service dừng đề MTM chưa sẵn sàng chấm ở đề chính và mọi buổi trước khi tạo lượt',()=>{
  for(const incompleteSource of [true,false]){
    const f=fixture(),invalid=clone(f.exam);
    if(incompleteSource)invalid.sourceComplete=false;
    else delete (invalid.questions[0] as {answer?:string}).answer;
    const repo=new MemoryHomeworkRepository([f.student]);
    const service=new HomeworkService(repo,invalid,0,'fixture',f.material.lessonCode,()=>T0,[f.material]);
    const token=service.login({studentCode:f.student.studentCode},'fixture-ip');
    assert.ok(service.state(token));
    assert.throws(()=>service.start(token),(error:unknown)=>error instanceof HomeworkError&&error.status===409&&/chưa sẵn sàng chấm/.test(error.message));
    const otherService=new HomeworkService(repo,f.exam,0,'fixture',f.material.lessonCode,()=>T0,[f.material,f.other],{[f.other.lessonCode]:invalid});
    const otherToken=otherService.login({studentCode:f.student.studentCode},'fixture-ip');
    otherService.select(otherToken,f.other.lessonCode);
    assert.throws(()=>otherService.start(otherToken),(error:unknown)=>error instanceof HomeworkError&&error.status===409&&/chưa sẵn sàng chấm/.test(error.message));
    assert.equal(repo.get(f.student.studentCode)!.drafts.length,0);
  }
});

const durableError=await(async()=>{
  const f=fixture();let now=T0;
  let snapshot:DurableSnapshot={revision:0,exam:f.exam,material:f.material,lessons:[f.material],work:{student:f.student,drafts:[],receipts:[]}};
  const commits:HomeworkReceipt[][]=[];
  const durable=new SupabaseHomeworkRepository({async rpc(name,args){
    if(name==='mtm_btvn_read'){
      const row=clone(snapshot);
      row.lessons=[{...f.material,bestScore:9.5,submittedAt:T0+1,late:false,available:true} as LessonMaterial];
      return {data:row,error:null};
    }
    if(name==='mtm_btvn_commit'){
      assert.equal(args.p_revision,snapshot.revision);commits.push(clone(args.p_receipts as HomeworkReceipt[]));
      snapshot={...snapshot,revision:snapshot.revision+1,work:{...snapshot.work,drafts:clone(args.p_drafts as StudentWork['drafts']),receipts:clone(args.p_receipts as HomeworkReceipt[])}};
      return {data:{ok:true},error:null};
    }
    throw Error('RPC ngoài phạm vi fixture: '+name);
  }},async()=>{throw Error('Không gọi Edge trong fixture');},()=>now);
  const started=await durable.call('fixture-session','start'),id=started.draft!.attemptId;
  const saved=await durable.call('fixture-session','save',f.material.lessonCode,id,f.answers);
  assert.equal(saved.saveOnly,true);now++;
  hidden(await durable.call('fixture-session','submit',f.material.lessonCode,id,f.answers),id);
  const stored=clone(snapshot.work.receipts[0]);assert.equal(stored.score,10);assert.equal(stored.mtm!.officialDisplayTotal,'10.00');
  assert.deepEqual(commits.at(-1)![0],stored,'Commit chỉ dùng biên nhận đủ điểm trong RAM, không dùng response đã che');
  for(const action of ['state','select','save','submit'] as const)hidden(await durable.call('fixture-session',action,f.material.lessonCode,id,{}),id);
  assert.deepEqual(snapshot.work.receipts,[stored]);assert.equal(snapshot.work.receipts.length,1);
  now=closesAt-1;hidden(await durable.call('fixture-session','state'),id);
  now=closesAt;const opened=await durable.call('fixture-session','state');
  assert.equal(opened.bestScore,10);assert.deepEqual(opened.receipts,[stored]);assert.equal(opened.lessons![0].bestScore,9.5,'Sau đóng nhận đúng điểm thẻ từ snapshot DB');
  assert.equal(opened.solutionsAvailable,true);assert.deepEqual(snapshot.work.receipts,[stored]);
  // Một thẻ tháng khác còn mở vẫn giấu điểm khi buổi được chọn là BTVN thường.
  snapshot={...snapshot,material:f.other,lessons:[f.other,f.material]};now=T0+2;
  const regular=await durable.call('fixture-session','state',f.other.lessonCode);
  assert.equal(regular.lessons!.find(l=>l.lessonCode===f.material.lessonCode)!.bestScore,null);
})().then(()=>null,error=>error);
test('Durable che biên nhận và bestScore của thẻ DB, giữ kho đầy đủ và mở đúng mốc',()=>{if(durableError)throw durableError;});

const pendingError=await(async()=>{
  const f=fixture();f.exam.sourceComplete=false;let commits=0;
  const snapshot:DurableSnapshot={revision:0,exam:f.exam,material:f.material,lessons:[f.material],work:{student:f.student,drafts:[],receipts:[]}};
  const durable=new SupabaseHomeworkRepository({async rpc(name){
    if(name==='mtm_btvn_read')return {data:clone(snapshot),error:null};
    if(name==='mtm_btvn_commit'){commits++;return {data:{ok:true},error:null};}
    throw Error('RPC ngoài phạm vi fixture: '+name);
  }},async()=>{throw Error('Không gọi Edge trong fixture');},()=>T0);
  await assert.rejects(durable.call('fixture-session','start'),/chưa sẵn sàng chấm/);
  assert.equal(commits,0);assert.equal(snapshot.work.drafts.length,0);
})().then(()=>null,error=>error);
test('Durable không commit hoặc làm chạy đồng hồ cho đề MTM pending',()=>{if(pendingError)throw pendingError;});

finish();
