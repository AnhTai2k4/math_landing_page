import assert from 'node:assert/strict';
import {HomeworkService,HomeworkError} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import {pipelineFixture} from './btvn-pipeline-fixture';

// Hai loại bài cùng service, hai token chọn bài riêng, chỉ dữ liệu GIẢ trong RAM.
for(const defaultMonthly of [false,true]){
  const fixture=pipelineFixture(),opensAt=Date.parse('2026-10-16T10:00:00+07:00');
  let now=opensAt-1;
  const ordinary={...fixture.material,lessonCode:'btvn-gia',date:'2026-10-15'};
  const monthly={...fixture.material,lessonCode:'thang-gia',date:'2026-10-16',kind:'kiem-tra-thang' as const,opensAt,closesAt:opensAt+600000};
  const primary=defaultMonthly?monthly:ordinary,secondary=defaultMonthly?ordinary:monthly;
  const repo=new MemoryHomeworkRepository([{studentCode:'GIẢ-ATTEMPTS',fullName:'Học sinh GIẢ',phone:'0900000000',className:ordinary.classNames[0]}]);
  const service=new HomeworkService(repo,fixture.exam,0,'gia',primary.lessonCode,()=>now,[ordinary,monthly],{[secondary.lessonCode]:{...fixture.exam,id:fixture.exam.id+'-other'}});
  const token=service.login({studentCode:'GIẢ-ATTEMPTS'},'ip-gia');
  const otherToken=service.login({studentCode:'GIẢ-ATTEMPTS'},'ip-gia');
  service.select(otherToken,ordinary.lessonCode);
  const locked=service.select(token,monthly.lessonCode);
  assert.equal(locked.maxAttempts,1,'Bài tháng chưa mở vẫn báo đúng một lượt');
  assert.equal(locked.canStart,false);
  assert.equal(service.state(otherToken).maxAttempts,5,'Token khác giữ bài BTVN đang chọn');
  now=opensAt;
  const started=service.start(token);
  assert.equal(started.maxAttempts,1);
  now+=1000;
  const submitted=service.submit(token,started.draft!.attemptId,{});
  assert.equal(submitted.attemptsUsed,1);
  assert.throws(()=>service.start(token),(error:unknown)=>error instanceof HomeworkError&&error.status===409&&error.message.includes('hết lượt'));
  assert.equal(service.select(token,ordinary.lessonCode).maxAttempts,5);
  for(let attempt=1;attempt<=5;attempt++){
    const next=service.start(token);
    assert.equal(next.maxAttempts,5);
    assert.equal(next.attemptsUsed,attempt);
    now+=1000;
    service.submit(token,next.draft!.attemptId,{});
  }
  assert.throws(()=>service.start(token),(error:unknown)=>error instanceof HomeworkError&&error.status===409);
  const selectedAgain=service.select(token,monthly.lessonCode);
  assert.equal(selectedAgain.maxAttempts,1);
  assert.equal(selectedAgain.attemptsUsed,1,'Đổi bài không tạo lại lượt tháng');
  assert.throws(()=>service.start(token),(error:unknown)=>error instanceof HomeworkError&&error.status===409);
}
console.log('Đạt giới hạn lượt: bài mặc định BTVN hoặc tháng, chọn bài theo token, bài chưa mở, chặn lượt tháng thứ hai và BTVN thứ sáu.');
