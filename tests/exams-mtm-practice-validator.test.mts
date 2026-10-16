// Dữ liệu hoàn toàn giả để kiểm cổng đề BTVN, không dùng bài làm học sinh.
import assert from 'node:assert/strict';
import {validatePracticeExam,validateQuestionOnlyPracticeExam,readyExams,type PracticeExam} from '../src/native/exams/data';
import {validateAssessment} from '../src/native/exams/assessment';
import {examSections} from '../src/native/exams/flexible-profile';
import {MTM_SCORING_VERSION,mtmFraction} from '../src/native/exams/mtm-scoring';
import demoExam from '../server/btvn/demo-exam.json';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('MTM-REAL-VALIDATOR');
type Kind='mc'|'tf'|'short';
function examFor(kinds:Kind[]):PracticeExam {
  const maxMillipoints=10000/kinds.length,maxPoints=mtmFraction(10n,BigInt(kinds.length));
  const questions=kinds.map((kind,i)=>{
    const base={id:`question-${i+1}`,sourceRef:`Nguồn giả, câu ${i+1}`,prompt:`Nội dung kiểm thử ${i+1}`,kind,maxMillipoints,maxPoints};
    if(kind==='mc')return {...base,kind,choices:['Một','Hai','Ba','Bốn'],answer:'A'};
    if(kind==='tf')return {...base,kind,statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,maxMillipoints/10,maxMillipoints/4,maxMillipoints/2,maxMillipoints]};
    return {...base,kind,mode:'numeric',acceptedAnswers:['2.5'],shortRule:{verified:true,evidence:'Khóa giả đã kiểm để chạy test.',mode:'decimal'}};
  });
  return {
    id:'mtm-real-validator-fixture',title:'Đề giả kiểm bộ MTM mới',grade:12,period:'GK1',durationMinutes:45,
    versionHash:'a'.repeat(64),sourceHash:'b'.repeat(64),sourceRef:'Nguồn giả kiểm thử',sourceUrl:'https://source.invalid/fixture',
    questionCount:kinds.length,rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fixture-key-v1',sourceComplete:true,
    answerKeyVerified:true,rubricVerified:true,publicationVerified:true,questionDisplayVerified:true,
    sourceMaterial:{title:'Nguồn giả',publisher:'MTM kiểm thử',version:'fixture v1',locator:'Tất cả câu giả'},questions,
  } as unknown as PracticeExam;
}
function conceal(exam:PracticeExam):PracticeExam {
  const result=structuredClone(exam) as unknown as Record<string,any>;
  result.responseMode='questions-only';
  delete result.solutionInstructions;if(result.mtmDocuments)delete result.mtmDocuments.solutions;
  for(const q of result.questions){delete q.answer;delete q.acceptedAnswers;delete q.shortRule;delete q.solution;if(q.sourceContent)delete q.sourceContent.solutions;}
  return result as PracticeExam;
}
const check=(exam:PracticeExam)=>assert.equal(validatePracticeExam(exam).valid,true,validatePracticeExam(exam).errors.join('; '));

test('Đề 45 câu nhận p = 2/9 điểm, không cần điểm thập phân hữu hạn hoặc cấu trúc 22 câu',()=>{
  const exam=examFor(Array.from({length:45},()=> 'mc'));
  check(exam);assert.equal(validateAssessment(exam).valid,true);
  assert.deepEqual(exam.questions[0].maxPoints,{numerator:'2',denominator:'9'});
  assert.equal(exam.questions[0].maxMillipoints,10000/45);
  assert.equal(readyExams([exam]).length,1);
  assert.deepEqual(examSections(exam).map(s=>({kind:s.kind,from:s.from,to:s.to})),[{kind:'mc',from:0,to:45}]);
  assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,true);
});

test('Nhận cả bảy tổ hợp, thứ tự theo nguồn và phân số tuần hoàn 10/7',()=>{
  const combinations:Kind[][]=[['mc'],['tf'],['short'],['mc','tf'],['mc','short'],['tf','short'],['mc','tf','short']];
  for(const kinds of combinations){const exam=examFor(kinds);check(exam);assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,true,kinds.join('+'));}
  const exam=examFor(['short','tf','mc','short','mc','tf','short']);check(exam);
  assert.deepEqual(exam.questions[0].maxPoints,{numerator:'10',denominator:'7'});
  assert.deepEqual(examSections(exam).map(s=>s.kind),['short','tf','mc','short','mc','tf','short']);
});

test('Rubric mới không áp trần 300 câu hoặc 12 đoạn phần của rubric cũ',()=>{
  const kinds=Array.from({length:301},(_,i):Kind=>i%2?'tf':'mc'),exam=examFor(kinds);
  exam.sections=kinds.map(kind=>({label:kind==='mc'?'Trắc nghiệm':'Đúng sai',kind,count:1}));
  check(exam);assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,true);
  assert.equal(examSections(exam).at(-1)?.to,301);
});

test('Khóa 10/N chính xác, số câu và phiên bản khóa phải đúng',()=>{
  const mutators=[
    (e:any)=>{e.questions[0].maxPoints={numerator:'0',denominator:'9'};},
    (e:any)=>{e.questions[0].maxPoints={numerator:'0.222',denominator:'1'};},
    (e:any)=>{delete e.questions[0].maxPoints;},
    (e:any)=>{e.questionCount--;},
    (e:any)=>{delete e.answerKeyVersion;},
    (e:any)=>{e.questions[1].id=e.questions[0].id;},
  ];
  for(const mutate of mutators){
    const exam=examFor(Array.from({length:45},()=> 'mc'));mutate(exam);
    assert.equal(validatePracticeExam(exam).valid,false);
    assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,false);
  }
});

test('Phần khai báo phải khớp đúng câu, không âm thầm bỏ hoặc đổi thứ tự câu',()=>{
  const exam=examFor(['tf','mc','short']);
  exam.sections=[{label:'Đúng sai',kind:'tf',count:1},{label:'Trắc nghiệm',kind:'mc',count:1},{label:'Trả lời ngắn',kind:'short',count:1}];
  check(exam);assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,true);
  exam.sections[0].count=2;
  assert.equal(validatePracticeExam(exam).valid,false);assert.equal(validateQuestionOnlyPracticeExam(conceal(exam)).valid,false);
});

test('Câu thiếu khóa hoặc DS thiếu ý vẫn giữ trong N để engine đánh dấu chưa chấm được',()=>{
  const exam=examFor(['mc','tf','short']) as unknown as Record<string,any>;
  delete exam.questions[0].answer;delete exam.questions[2].acceptedAnswers;delete exam.questions[2].shortRule;
  exam.questions[1].statements.pop();
  check(exam as PracticeExam);assert.equal(validateQuestionOnlyPracticeExam(conceal(exam as PracticeExam)).valid,true);
  assert.equal(exam.questions.length,3);assert.equal(exam.questionCount,3);
  assert.deepEqual(exam.questions[0].maxPoints,{numerator:'10',denominator:'3'});
});

test('Transport câu hỏi không nhận khóa, quy tắc TLN riêng hay rubric gần giống',()=>{
  const exam=examFor(['mc','tf','short']),publicExam=conceal(exam);
  assert.equal(validatePracticeExam(publicExam).valid,false);
  assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false);
  for(const field of ['answer','acceptedAnswers','shortRule','solution']){
    const exposed=structuredClone(publicExam) as unknown as Record<string,any>;exposed.questions[0][field]='Không được công khai';
    assert.equal(validateQuestionOnlyPracticeExam(exposed).valid,false,field);
  }
  const other=examFor(Array.from({length:45},()=> 'mc'));other.rubricVersion=MTM_SCORING_VERSION+'-other';
  assert.equal(validatePracticeExam(other).valid,false);assert.equal(validateQuestionOnlyPracticeExam(conceal(other)).valid,false);
});

test('Đề và transport rubric cũ vẫn qua nguyên bộ kiểm cũ, không nhận phân số mới',()=>{
  const original=JSON.stringify(demoExam),legacy=structuredClone(demoExam) as unknown as PracticeExam;
  check(legacy);assert.equal(validateQuestionOnlyPracticeExam(conceal(legacy)).valid,true);
  assert.equal(JSON.stringify(demoExam),original);
  const converted=examFor(Array.from({length:45},()=> 'mc'));converted.rubricVersion='MTM-BTVN-10-v1';
  converted.sections=[{label:'Trắc nghiệm',kind:'mc',count:45}];
  assert.equal(validatePracticeExam(converted).valid,false);
  assert.equal(validateQuestionOnlyPracticeExam(conceal(converted)).valid,false);
});

finish();
