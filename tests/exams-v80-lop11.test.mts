// V80: nguồn đối chiếu lấy từ ORDER_G11/gói đã kiểm, không suy lại từ lộ trình web.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import exact from '../src/native/chapters/exact-tests.json';
import practice from '../src/native/chapters/practice-tests.json';
import sequence from '../src/native/chapters/chapter-sequence.json';
import fixture from './fixtures/v80-lop11.json';
import {suite,FakeStore} from './exams-harness.mts';
import {createDraft,saveDraft,readDraft} from '../src/native/exams/store';
import type {PracticeExam} from '../src/native/exams/data';
const {test,finish}=suite('V80');
const by=new Map([...exact,...practice].map(e=>[e.exam.id,e]));
const old=(file:string)=>JSON.parse(execFileSync('git',['show',fixture.base+':src/native/chapters/'+file],{cwd:process.env.MTM_ROOT,encoding:'utf8',maxBuffer:32*1024*1024}));
const prior=[...old('exact-tests.json'),...old('practice-tests.json')];
const projection=(exam:any)=>{const e=JSON.parse(JSON.stringify(exam));for(const k of ['mtmDocuments','sourceInstructions','solutionInstructions','versionHash'])delete e[k];for(const q of e.questions){delete q.sourceContent;delete q.correctionNote;}return e;};
test('317 đề đã đăng giữ id/versionHash và toàn bộ trường nội dung chấm',()=>{
  assert.equal(prior.length,317);
  for(const p of prior){const e=by.get(p.exam.id)!.exam;assert.equal(e.versionHash,p.exam.versionHash,p.exam.id);assert.deepEqual(projection(e),projection(p.exam),p.exam.id);}
});
test('chỉ thêm đúng 24 ID gói k trong phiếu',()=>{
  const before=new Set(prior.map((p:any)=>p.exam.id));assert.deepEqual([...by.keys()].filter(id=>!before.has(id)).sort(),[...fixture.newIds].sort());
});
test('27 gói có câu hỏi/khóa/điểm/lời giải và ghi chú đúng bản nguồn đã kiểm',()=>{
  for(const [id,questions] of Object.entries(fixture.questionsFromPackages))assert.deepEqual(by.get(id)!.exam.questions.map(q=>{const {sourceContent,...rest}=q as any;return rest;}),questions,id);
});
for(const [ch,items] of Object.entries(fixture.routes))test('11:'+ch+' đúng thứ tự nguồn, liên tục, Bài 1 lý thuyết, khó dần trong nhóm',()=>{
  const route=(sequence as any)['11:'+ch],ids=route.groups.flatMap((g:any)=>g.items.map((i:any)=>i.id));
  assert.deepEqual(ids,items.map(i=>i.examId));assert.equal(ids.length,new Set(ids).size);assert.equal(by.get(ids[0])!.isFoundation,true);
  assert.deepEqual(items.map(i=>i.bai),items.map((_,i)=>i+1));
  for(const g of route.groups){const scores=g.items.map((i:any)=>items.find(x=>x.examId===i.id)!.score).filter((s:any)=>s!==null);assert.deepEqual(scores,[...scores].sort((a:number,b:number)=>a-b));}
});
for(const id of ['mtm-drive-g11-c4-t06-mtm-errata-v1','mtm-luyen-g11-c3-n04-mtm-errata-v1','mtm-luyen-g11-c3-n05-mtm-errata-v1'])test('nháp trước V80 vẫn mở được sau cập nhật ảnh: '+id,()=>{
  const oldExam=prior.find((p:any)=>p.exam.id===id).exam as PracticeExam,newExam=by.get(id)!.exam as unknown as PracticeExam,storage=new FakeStore();
  const made=createDraft(oldExam,'before-v80',1000000);assert.ok(made.ok);assert.ok(saveDraft(storage,oldExam,made.value,null).ok);
  const snapshot=storage.snapshot();const loaded=readDraft(storage,newExam);assert.ok(loaded.ok);assert.deepEqual(loaded.value,made.value);assert.equal(storage.snapshot(),snapshot);
});
finish();
