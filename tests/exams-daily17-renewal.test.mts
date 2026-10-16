// Dữ liệu người học, buổi và transport tổng hợp; không gọi mạng hoặc đọc dữ liệu riêng.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import demoExam from '../server/btvn/demo-exam.json';
import type {PracticeExam} from '../src/native/exams/data';
import type {HomeworkState,LessonMaterial} from '../src/native/homework/btvn-contract';
import {mergeHomeworkRenewal} from '../src/native/homework/asset-renewal';
import {createHomeworkResultSummary} from '../src/native/homework/result-summary';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('DAILY17-RENEWAL');
const T0=Date.UTC(2026,9,16,1),closesAt=T0+10000;
const clone=<T,>(value:T):T=>structuredClone(value);
function fixture(){
  let now=T0+1000;
  const exam=clone(demoExam) as unknown as PracticeExam;
  const student={studentCode:'FAKE-RENEWAL-ONLY',fullName:'Người học tổng hợp',phone:'0000000000',className:'Lớp tổng hợp'};
  const material:LessonMaterial={kind:'kiem-tra-thang',lessonCode:'buoi-renewal-gia',classNames:[student.className],date:'2026-10-16',title:'Bài kiểm tra tổng hợp',opensAt:T0,closesAt,videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null};
  const repo=new MemoryHomeworkRepository([student]);
  const service=new HomeworkService(repo,exam,T0+86400000,'lop-gia',material.lessonCode,()=>now,[material]);
  const token=service.login({studentCode:student.studentCode},'ip-gia');
  const started=service.start(token);
  const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='short'?q.acceptedAnswers[0]:q.kind==='self'?'':q.answer]));
  now=T0+2000;
  const hidden=service.submit(token,started.draft!.attemptId,answers);
  now=closesAt;
  const published=service.state(token);
  return {exam,service,token,started,hidden,published,clock:(time:number)=>{now=time;}};
}

test('Gia hạn sau giờ đóng nhận cùng receipt, điểm, draft và đồng hồ từ service thật',()=>{
  const {hidden,published}=fixture();
  assert.equal(hidden.solutionsAvailable,false);assert.equal(hidden.receipts[0].score,null);
  assert.equal(createHomeworkResultSummary(hidden),null);
  assert.equal(published.solutionsAvailable,true);assert.equal(published.receipts[0].score,10);
  const merged=mergeHomeworkRenewal(hidden,{...published,clientReceivedAt:closesAt+25});
  assert.equal(merged.receipts,published.receipts);assert.equal(merged.bestScore,10);
  assert.equal(merged.draft,published.draft);assert.equal(merged.serverNow,closesAt);
  assert.equal(merged.clientReceivedAt,closesAt+25);assert.equal(merged.exam,published.exam);
  assert.equal(merged.solutionsAvailable,true);
  assert.match(createHomeworkResultSummary(merged)!,/Điểm: 10\/10/);
  assert.equal(hidden.receipts[0].score,null,'Không sửa snapshot trước giờ đóng');
});

test('Gia hạn ảnh giữ nguyên bản đang làm, kể cả máy chủ đã nộp do hết giờ',()=>{
  const {started,published}=fixture(),draft=started.draft!;
  const typing:HomeworkState={...started,draft:{...draft,answers:{[started.exam!.questions[0].id]:'D'},revision:draft.revision+2,updatedAt:T0+2500}};
  const merged=mergeHomeworkRenewal(typing,{...published,assetsExpiresAt:T0+900000,clientReceivedAt:closesAt+20});
  assert.equal(merged.draft,typing.draft);assert.deepEqual(merged.draft!.answers,typing.draft!.answers);
  assert.equal(merged.draft!.submittedAt,null,'Sự xác nhận bản máy chủ đã chấm vẫn qua saver, không tự bỏ phần đang gõ');
  assert.equal(merged.assetsExpiresAt,T0+900000);assert.equal(merged.receipts,typing.receipts);
  assert.equal(merged.bestScore,typing.bestScore);assert.equal(merged.solutionsAvailable,typing.solutionsAvailable);
  assert.equal(merged.exam!.responseMode,'questions-only');
  for(const question of merged.exam!.questions)for(const field of ['answer','acceptedAnswers','shortRule','solution'])assert.ok(!Object.hasOwn(question,field),field);
  assert.equal(merged.serverNow,closesAt);
});

test('Không nhận phản hồi của buổi, lượt, bản đề hoặc khóa đáp án khác',()=>{
  const {published}=fixture();
  const invalid:HomeworkState[]=[
    {...published,lessonCode:'buoi-gia-khac'},
    {...published,draft:null},
    {...published,draft:{...published.draft!,attemptId:'luot-khac'}},
    {...published,draft:{...published.draft!,examId:'de-khac'}},
    {...published,draft:{...published.draft!,examVersionHash:'c'.repeat(64)}},
    {...published,draft:{...published.draft!,rubricVersion:'rubric-khac'}},
    {...published,draft:{...published.draft!,answerKeyVersion:'khoa-khac'}},
    {...published,draft:{...published.draft!,startedAt:T0+2}},
    {...published,draft:{...published.draft!,deadline:T0+3}},
    {...published,exam:null},
    {...published,exam:{...published.exam!,versionHash:'d'.repeat(64)}},
    {...published,exam:{...published.exam!,sourceHash:'e'.repeat(64)}},
    {...published,exam:{...published.exam!,answerKeyVersion:'khoa-de-khac'}},
    {...published,saveOnly:true},
  ];
  const before=JSON.stringify(published);
  for(const next of invalid)assert.equal(mergeHomeworkRenewal(published,next),published);
  assert.equal(JSON.stringify(published),before,'Không sửa nguồn khi từ chối phản hồi');
});

test('Response cũ không làm lùi biên nhận đã nộp hoặc kết quả đã công bố',()=>{
  const {started,hidden,published}=fixture();
  const base={...published,revision:8,clientReceivedAt:closesAt+30};
  for(const next of [
    {...published,serverNow:closesAt-1,assetsExpiresAt:T0+999999},
    {...published,revision:7},
    {...started,serverNow:closesAt+100,revision:8},
    {...hidden,serverNow:closesAt+100,revision:8},
    {...published,draft:{...published.draft!,revision:published.draft!.revision-1},revision:8},
    {...published,draft:{...published.draft!,updatedAt:published.draft!.updatedAt-1},revision:8},
  ])assert.equal(mergeHomeworkRenewal(base,next),base);
  const noClock={...published,serverNow:undefined,solutionsAvailable:undefined};
  for(const next of [{...noClock,receipts:[]},{...noClock,receipts:noClock.receipts.map(r=>({...r,score:null}))}])
    assert.equal(mergeHomeworkRenewal(noClock,next),noClock,'Thiếu clock vẫn không làm mất điểm đã công bố');
});

test('Giữ cổng mở bài không có draft và không nhận lượt được mở ở nơi khác',()=>{
  const {started}=fixture();
  const waiting:HomeworkState={...started,exam:null,draft:null,attemptsUsed:0,serverNow:T0-1,solutionsAvailable:false};
  const opened:HomeworkState={...started,draft:null,attemptsUsed:0,serverNow:T0};
  const merged=mergeHomeworkRenewal(waiting,opened);
  assert.equal(merged.exam,opened.exam);assert.equal(merged.draft,null);assert.equal(merged.canStart,opened.canStart);
  assert.equal(mergeHomeworkRenewal(opened,started),opened);
});

test('Màn BTVN dùng merge đã kiểm tại phản hồi gia hạn',()=>{
  const source=readFileSync(join(process.env.MTM_ROOT??process.cwd(),'src/native/homework/HomeworkSession.tsx'),'utf8');
  assert.ok(source.includes('mergeHomeworkRenewal(previous,next)'));
});
finish();
