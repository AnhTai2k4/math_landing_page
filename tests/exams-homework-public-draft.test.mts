// BTVN chỉ gửi câu hỏi trước khi nộp. Dùng đề demo và fixture tổng hợp, không có dữ liệu học sinh.
import assert from 'node:assert/strict';
import {validatePracticeExam,validateQuestionOnlyPracticeExam,type PracticeExam} from '../src/native/exams/data';
import {scorePracticeAssessment} from '../src/native/exams/flexible-profile';
import {createDraft,readDraft,saveDraft,submitDraft,validateDraft,draftKey,type Draft} from '../src/native/exams/store';
import {suite,FakeStore} from './exams-harness.mts';
import demoExam from '../server/btvn/demo-exam.json';
import {pipelineFixture} from './btvn-pipeline-fixture';

const {test,finish}=suite('BTVN-PUBLIC');
const T0=Date.UTC(2026,9,16,1),options={allowQuestionOnly:true};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const must=<T,>(result:{ok:true;value:T}|{ok:false;message:string}):T=>{if(!result.ok)throw new Error(result.message);return result.value;};
const segment=(part:string)=>({path:`fixture/${part}.png`,sha256:(part==='questions'?'c':'d').repeat(64),sourcePage:1,width:100,height:100});
function fullExam():PracticeExam {
  return {
    id:'mtm-practice-homework-public-fixture',title:'Bài tập giả kiểm thử',grade:10,period:'GK1',durationMinutes:30,
    sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),sourceRef:'Nguồn giả kiểm thử',questionCount:4,
    answerKeyVerified:true,rubricVerified:true,rubricVersion:'MTM-BTVN-10-v1',publicationVerified:true,questionDisplayVerified:true,
    sourceUrl:'https://www.minhthanhmath.vn/luyen-tap',sourceMaterial:{title:'Nguồn giả',publisher:'MTM test',version:'fixture v1',locator:'Kiểm thử'},
    sourceInstructions:[segment('questions')],solutionInstructions:[segment('solutions')],
    mtmDocuments:{questions:{url:`/qa-exam-assets/${'e'.repeat(64)}.pdf`,sha256:'e'.repeat(64)},solutions:{url:`/qa-exam-assets/${'f'.repeat(64)}.pdf`,sha256:'f'.repeat(64)}},
    sections:[{label:'Trắc nghiệm',kind:'mc',count:1},{label:'Đúng sai',kind:'tf',count:1},{label:'Trả lời ngắn',kind:'short',count:1},{label:'Tự đối chiếu',kind:'self',count:1}],
    questions:[
      {id:'mc-1',kind:'mc',sourceRef:'Nguồn giả 1',maxMillipoints:1000,prompt:'Chọn đáp án cho câu giả.',choices:['Một','Hai','Ba','Bốn'],answer:'A',solution:'Lời giải giả.'},
      {id:'tf-1',kind:'tf',sourceRef:'Nguồn giả 2',maxMillipoints:1000,prompt:'Câu đúng sai giả.',statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,100,250,500,1000]},
      {id:'short-1',kind:'short',sourceRef:'Nguồn giả 3',maxMillipoints:1000,prompt:'Câu trả lời ngắn giả.',mode:'numeric',acceptedAnswers:['2'],sourceContent:{questions:[segment('questions')],solutions:[segment('solutions')]}},
      {id:'self-1',kind:'self',sourceRef:'Nguồn giả 4',maxMillipoints:0,prompt:'Câu tự đối chiếu giả.',solution:'Lời giải giả.'},
    ],
  };
}
function conceal(source:PracticeExam):PracticeExam {
  const exam=clone(source) as unknown as Record<string,any>;
  exam.responseMode='questions-only';delete exam.solutionInstructions;if(exam.mtmDocuments)delete exam.mtmDocuments.solutions;
  for(const q of exam.questions){delete q.answer;delete q.acceptedAnswers;delete q.solution;if(q.sourceContent)delete q.sourceContent.solutions;}
  return exam as PracticeExam;
}
function publicExam():PracticeExam {return conceal(fullExam());}
const candidate=(exam:PracticeExam):Draft=>({version:1,examId:exam.id,examVersionHash:exam.versionHash,rubricVersion:exam.rubricVersion,attemptId:'fixture-attempt',startedAt:T0,deadline:T0+exam.durationMinutes*60000,updatedAt:T0,answers:{},submittedAt:null,revision:0});

test('Đề đầy đủ vẫn qua bộ kiểm nghiêm, bản chỉ có câu hỏi không được chấm cục bộ',()=>{
  assert.equal(validatePracticeExam(fullExam()).valid,true);
  const exam=publicExam();assert.equal(validateQuestionOnlyPracticeExam(exam).valid,true);
  assert.equal(validatePracticeExam(exam).valid,false);
  assert.equal(scorePracticeAssessment(exam,{}).ok,false);
  assert.equal(validateQuestionOnlyPracticeExam(fullExam()).valid,false);
  assert.equal(validatePracticeExam({...fullExam(),responseMode:'questions-only'}).valid,false);
});

test('Bộ kiểm nghiêm vẫn bắt buộc đáp án, tài liệu lời giải và lời giải câu tự đối chiếu',()=>{
  for(const mutate of [
    (e:any)=>{delete e.questions[0].answer;},(e:any)=>{delete e.questions[2].acceptedAnswers;},
    (e:any)=>{delete e.questions[2].sourceContent.solutions;},(e:any)=>{delete e.mtmDocuments.solutions;},
    (e:any)=>{delete e.questions[3].solution;},
  ]){const exam=fullExam();mutate(exam);assert.equal(validatePracticeExam(exam).valid,false);}
});

test('Đề demo profile cố định và fixture FLEX tiếp tục lưu nháp sau khi máy chủ giấu đáp án',()=>{
  const sources=[demoExam as unknown as PracticeExam,pipelineFixture().exam];
  for(const source of sources){
    assert.equal(validatePracticeExam(source).valid,true,source.id);
    const exam=conceal(source),storage=new FakeStore();
    assert.equal(validateQuestionOnlyPracticeExam(exam).valid,true,source.id);
    assert.equal(validatePracticeExam(exam).valid,false);assert.equal(createDraft(exam,'demo-fixture',T0).ok,false);
    const draft=must(createDraft(exam,'demo-fixture',T0,options));
    must(saveDraft(storage,exam,draft,null,options));assert.deepEqual(must(readDraft(storage,exam,options)),draft);
    const submitted=must(submitDraft(exam,draft,T0+1000,options));assert.equal(submitted.submittedAt,T0+1000);
    assert.equal(scorePracticeAssessment(exam,{}).ok,false);
  }
  const fixed=conceal(sources[0]);delete fixed.sections;
  assert.equal(validateQuestionOnlyPracticeExam(fixed).valid,true,'Profile 12/4/6 cố định không bắt buộc sections');
  assert.equal(validateDraft(candidate(fixed),fixed,options).ok,true);
});

test('Profile cố định không dùng prefix custom nhưng phải đủ 12/4/6 theo nguồn và tổng 10000 điểm',()=>{
  for(const mutate of [
    (e:any)=>{e.questions.pop();e.questionCount--;delete e.sections;},
    (e:any)=>{[e.questions[0],e.questions[12]]=[e.questions[12],e.questions[0]];delete e.sections;},
    (e:any)=>{e.questions[0].maxMillipoints++;},
    (e:any)=>{e.sections[0].count=11;},
    (e:any)=>{e.sections=[];},
    (e:any)=>{e.sections[0].kind='self';},
    (e:any)=>{e.questions[0]={...e.questions[0],kind:'self',maxMillipoints:0};},
  ]){const exam=conceal(demoExam as unknown as PracticeExam);mutate(exam);assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false);assert.equal(validateDraft(candidate(exam),exam,options).ok,false);}
});

test('Profile FLEX giữ yêu cầu prefix custom, sections và tổng 10000, không cho câu tự đối chiếu',()=>{
  for(const mutate of [
    (e:any)=>{e.id='mtm-btvn-not-custom';},(e:any)=>{delete e.sections;},
    (e:any)=>{e.questions[0].maxMillipoints++;},(e:any)=>{e.sections[0].count=2;},
    (e:any)=>{e.questions[0].kind='self';e.questions[0].maxMillipoints=0;e.sections[0].kind='self';e.questions[2].maxMillipoints=6000;},
    (e:any)=>{e.rubricVersion='MTM-22-12MC-4TF-6SA-3-4-3-v1';},
  ]){const exam=conceal(pipelineFixture().exam);mutate(exam);assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false);assert.equal(validateDraft(candidate(exam),exam,options).ok,false);}
});

test('Tạo, đọc, kiểm, lưu và nộp mặc định từ chối bản chỉ có câu hỏi',()=>{
  const exam=publicExam(),draft=candidate(exam),storage=new FakeStore({[draftKey(exam.id)]:JSON.stringify(draft)});
  for(const result of [createDraft(exam,'fixture-attempt',T0),validateDraft(draft,exam),readDraft(storage,exam),saveDraft(storage,exam,draft,draft),submitDraft(exam,draft,T0+1),validateDraft(draft,exam,{allowQuestionOnly:false})]){
    assert.equal(result.ok,false);assert.equal(!result.ok&&result.code,'exam');
  }
  assert.equal(storage.gets,0);assert.equal(storage.sets,0);
});

test('Caller BTVN bật rõ quyền: tạo, trả lời, lưu đọc lại và đánh dấu nộp được, không có điểm cục bộ',()=>{
  const exam=publicExam(),storage=new FakeStore(),d0=must(createDraft(exam,'fixture-attempt',T0,options));
  assert.equal(must(readDraft(storage,exam,options)),null);
  const saved0=must(saveDraft(storage,exam,d0,null,options));
  const d1=must(validateDraft({...saved0,answers:{'mc-1':'B','tf-1':[true,null,false,null],'short-1':'2','self-1':'Đã tự làm'},updatedAt:T0+1000,revision:1},exam,options));
  const saved1=must(saveDraft(storage,exam,d1,saved0,options));
  assert.deepEqual(must(readDraft(storage,exam,options)),d1);
  const submitted=must(submitDraft(exam,saved1,T0+2000,options));
  assert.equal(submitted.submittedAt,T0+2000);
  must(saveDraft(storage,exam,submitted,saved1,options));
  assert.deepEqual(must(readDraft(storage,exam,options)),submitted);
  assert.equal(scorePracticeAssessment(exam,submitted.answers).ok,false);
  const before=storage.sets;must(saveDraft(storage,exam,submitted,submitted,options));assert.equal(storage.sets,before);
  assert.deepEqual(must(submitDraft(exam,submitted,T0+3000,options)),submitted);
});

test('Cờ cho phép không bỏ qua cấu trúc và kiểu câu trả lời',()=>{
  const exam=publicExam(),d=candidate(exam);
  for(const answers of [{'khong-co':'A'},{'mc-1':'E'},{'tf-1':[true,false]},{'tf-1':[true,false,0,null]},{'short-1':'x'.repeat(501)},{'self-1':false}]){
    assert.equal(validateDraft({...d,answers},exam,options).ok,false);
  }
  assert.equal(validateDraft({...d,answers:{'mc-1':null,'tf-1':[null,null,null,null],'short-1':''}},exam,options).ok,true);
  assert.equal(validateDraft({...d,deadline:d.deadline+1},exam,options).ok,false);
});

test('Bản chỉ có câu hỏi vẫn giữ kiểm xung đột và không ghi đè bản đã nộp',()=>{
  const exam=publicExam(),storage=new FakeStore(),d0=must(saveDraft(storage,exam,must(createDraft(exam,'fixture-attempt',T0,options)),null,options));
  const d1={...d0,answers:{'mc-1':'A' as const},updatedAt:T0+1000,revision:1};
  const saved=must(saveDraft(storage,exam,d1,d0,options)),snapshot=storage.snapshot();
  assert.equal(saveDraft(storage,exam,{...d1,answers:{'mc-1':'C'},revision:2},d0,options).ok,false);
  assert.equal(storage.snapshot(),snapshot);
  const submitted=must(saveDraft(storage,exam,must(submitDraft(exam,saved,T0+2000,options)),saved,options));
  assert.equal(saveDraft(storage,exam,{...submitted,submittedAt:null,updatedAt:T0+3000,revision:submitted.revision+1},submitted,options).ok,false);
});

test('Mọi vị trí đáp án và lời giải phải thực sự bị gỡ khỏi transport',()=>{
  const mutators=[
    (e:any)=>{e.questions[0].answer='A';},(e:any)=>{e.questions[2].acceptedAnswers=['2'];},
    (e:any)=>{e.questions[0].solution='Đáp án giả';},(e:any)=>{e.questions[2].sourceContent.solutions=[segment('solutions')];},
    (e:any)=>{e.mtmDocuments.solutions=fullExam().mtmDocuments!.solutions;},(e:any)=>{e.solutionInstructions=[segment('solutions')];},
  ];
  for(const mutate of mutators){const exam=publicExam();mutate(exam);assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false);assert.equal(validateDraft(candidate(exam),exam,options).ok,false);}
});

test('Bản lỗi bị từ chối dù caller đã bật quyền cho BTVN',()=>{
  const mutators=[
    (e:any)=>{delete e.responseMode;},(e:any)=>{e.responseMode='other';},(e:any)=>{e.rubricVersion='MTM-FLEX-10-v1';},
    (e:any)=>{e.sourceHash='no';},(e:any)=>{e.questionCount=3;},(e:any)=>{e.questions[1].id=e.questions[0].id;},
    (e:any)=>{e.questions[0].choices=['Một','Một','Ba','Bốn'];},(e:any)=>{e.questions[1].pointsByCorrectCount=[0,200,100,500,1000];},
    (e:any)=>{e.questions[2].mode='expression';},(e:any)=>{e.questions[3].maxMillipoints=10;},
    (e:any)=>{e.sections[0].count=2;},(e:any)=>{e.questions[0]=null;},(e:any)=>{e.questions=[];},
    (e:any)=>{e.questions[2].sourceContent.questions[0].path='../bad.png';},(e:any)=>{e.mtmDocuments.questions.sha256='bad';},
    (e:any)=>{delete e.title;},(e:any)=>{delete e.questions[1].statements;},(e:any)=>{e.questions[0].id='__proto__';},
  ];
  for(const mutate of mutators){const exam=publicExam();mutate(exam);assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false);assert.equal(validateDraft(candidate(exam),exam,options).ok,false);}
});

finish();
