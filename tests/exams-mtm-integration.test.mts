// Kiểm thử nối luồng BTVN bằng dữ liệu tổng hợp, không gọi mạng hay dữ liệu học sinh thật.
import assert from 'node:assert/strict';
import {scoreAssessment} from '../src/native/exams/assessment';
import {validatePracticeExam,validateQuestionOnlyPracticeExam,type PracticeExam} from '../src/native/exams/data';
import {scorePracticeAssessment} from '../src/native/exams/flexible-profile';
import {MTM_SCORING_VERSION,type MtmScore} from '../src/native/exams/mtm-scoring';
import {resultFor} from '../src/native/exams/result';
import {archiveSubmitted,createDraft,readHistory,submitDraft,validateDraft,type Answers,type Draft} from '../src/native/exams/store';
import {HomeworkError,HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository,scoresCsv} from '../server/btvn/repository';
import {concealMonthlySolutions} from '../server/btvn/monthly-policy';
import {SupabaseHomeworkRepository,type DurableSnapshot} from '../server/btvn/supabase-repository';
import legacyJson from '../server/btvn/demo-exam.json';
import {FakeStore,suite} from './exams-harness.mts';

const {test,finish}=suite('MTM-NOI-THAT');
const T0=Date.UTC(2026,9,16,1);
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
const must=<T,>(result:{ok:true;value:T}|{ok:false;message:string}):T=>{if(!result.ok)throw new Error(result.message);return result.value;};
const fraction=(numerator:string,denominator='1')=>({numerator,denominator});
const maxPoints=(count:number)=>{let a=10,b=count;while(b){const next=a%b;a=b;b=next;}return fraction(String(10/a),String(count/a));};
type Kind='mc'|'tf'|'short';
function mtmExam(kinds:Kind[]=Array.from({length:45},()=> 'mc')):PracticeExam {
  const count=kinds.length,p=10000/count;
  const sections:{label:string;kind:Kind;count:number}[]=[];
  for(const kind of kinds){const last=sections.at(-1);if(last?.kind===kind)last.count++;else sections.push({label:kind==='mc'?'Trắc nghiệm':kind==='tf'?'Đúng sai':'Trả lời ngắn',kind,count:1});}
  return {
    id:'mtm-practice-integration-fixture',title:'Bộ dữ liệu giả kiểm thử nối thang MTM',grade:12,period:'GK1',durationMinutes:120,
    sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),sourceRef:'Nguồn tổng hợp dùng riêng cho kiểm thử',sourceUrl:'https://example.invalid/de-kiem-thu',
    sourceMaterial:{title:'Đề tổng hợp giả',publisher:'MTM test',version:'fixture-v1',locator:'Câu hỏi tổng hợp trong test'},
    questionCount:count,answerKeyVerified:true,rubricVerified:true,rubricVersion:MTM_SCORING_VERSION,
    answerKeyVersion:'fixture-key-v1',sourceComplete:true,publicationVerified:true,questionDisplayVerified:true,sections,
    questions:kinds.map((kind,index)=>{
      const base={id:'q-'+(index+1),sourceRef:'Câu tổng hợp '+(index+1),prompt:'Câu hỏi tổng hợp kiểm thử '+(index+1)+'.',maxPoints:maxPoints(count),maxMillipoints:p};
      if(kind==='mc')return {...base,kind,choices:['Một','Hai','Ba','Bốn'],answer:'A'};
      if(kind==='tf')return {...base,kind,statements:['Mệnh đề a','Mệnh đề b','Mệnh đề c','Mệnh đề d'],answer:[true,false,true,false],pointsByCorrectCount:[0,p/10,p/4,p/2,p]};
      return {...base,kind,mode:'rational',acceptedAnswers:['1/2'],shortRule:{verified:true,evidence:'Quy tắc giả đã xác minh trong fixture',mode:'rational'}};
    }),
  } as PracticeExam;
}
function completeDraft(exam:PracticeExam,answers:Answers,id='fixture-attempt'):Draft {
  const started=must(createDraft(exam,id,T0));
  return must(submitDraft(exam,{...started,answers},T0+1000));
}
const allCorrect=(exam:PracticeExam):Answers=>Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='mc'?q.answer:q.kind==='tf'?q.answer:q.kind==='short'?q.acceptedAnswers[0]:'']));
const scored=(exam:PracticeExam,answers:Answers)=>{
  const result=resultFor(exam,completeDraft(exam,answers));assert.ok(result?.score.ok);assert.ok(result.mtm);return result;
};
const rowByType=(score:MtmScore,type:string)=>score.rows.find(row=>row.type===type)!;
function server(exam:PracticeExam) {
  const student={studentCode:'FIXTURE-NOT-A-STUDENT',fullName:'Người dùng kiểm thử tổng hợp',phone:'0000000000',className:'Lớp kiểm thử tổng hợp'};
  const repo=new MemoryHomeworkRepository([student]);
  const service=new HomeworkService(repo,exam,T0+86400000,'fixture-class','fixture-lesson',()=>T0);
  const token=service.login({studentCode:student.studentCode},'fixture-ip');
  return {service,repo,token,student};
}

test('Validator nhận đề 45 câu với 10/N vô hạn tuần hoàn và không giới hạn 22 câu',()=>{
  const exam=mtmExam();assert.equal(validatePracticeExam(exam).valid,true,validatePracticeExam(exam).errors.join('; '));
  assert.equal(exam.questionCount,45);assert.deepEqual(exam.questions[0].maxPoints,fraction('2','9'));
  assert.equal(Number.isInteger(exam.questions[0].maxMillipoints),false);
});

test('Điểm chính xác 10/N là bắt buộc và không nhận điểm thập phân thay phân số',()=>{
  for(const mutate of [(e:any)=>{e.questions[0].maxPoints=fraction('1','5');},(e:any)=>{e.questions[0].maxPoints=10/45;},(e:any)=>{delete e.questions[0].maxPoints;}]){
    const exam=mtmExam();mutate(exam);assert.equal(validatePracticeExam(exam).valid,false);
  }
});

test('scoreAssessment và profile cùng nối engine MTM, giữ phân số gốc 2/9',()=>{
  const exam=mtmExam(),answers={'q-1':'A'};
  for(const score of [scoreAssessment(exam,answers),scorePracticeAssessment(exam,answers)]){
    assert.ok(score.ok);assert.ok(score.mtm);assert.deepEqual(score.mtm.rawTotal,fraction('2','9'));assert.equal(score.mtm.officialDisplayTotal,'0.22');
  }
});

test('Bản câu hỏi thật do server giấu khóa nhận draft 45 câu, không được chấm phía khách',()=>{
  const full=mtmExam(['mc','tf','short',...Array.from({length:42},()=> 'mc' as const)]),exam=concealMonthlySolutions(full);
  assert.equal(validateQuestionOnlyPracticeExam(exam).valid,true,validateQuestionOnlyPracticeExam(exam).errors.join('; '));
  assert.equal(validatePracticeExam(exam).valid,false);assert.equal(scorePracticeAssessment(exam,{}).ok,false);assert.equal(scoreAssessment(exam,{}).ok,false);
  for(const q of exam.questions){assert.ok(!('answer' in q));assert.ok(!('acceptedAnswers' in q));assert.ok(!('shortRule' in q));}
  const draft=must(createDraft(exam,'question-only-attempt',T0,{allowQuestionOnly:true}));
  assert.equal(draft.rubricVersion,MTM_SCORING_VERSION);assert.equal(draft.answerKeyVersion,'fixture-key-v1');
  assert.equal(validateDraft({...draft,answers:{'q-1':'A','q-2':[true,null,null,null],'q-3':'1/2'}},exam,{allowQuestionOnly:true}).ok,true);
  assert.equal(validateDraft(draft,full).ok,true);
});

test('resultFor không cộng các số làm tròn: đúng 45/45 được chính xác 10',()=>{
  const exam=mtmExam(),result=scored(exam,allCorrect(exam));
  assert.deepEqual(result.mtm!.rawTotal,fraction('10'));assert.equal(result.mtm!.officialDisplayTotal,'10.00');
  assert.equal(result.score.earnedMillipoints,10000);assert.equal(result.score.finalMillipoints,10000);
});

test('Đề hỗn hợp có bảng điểm từng phần từ điểm gốc, không cộng điểm hiển thị',()=>{
  const result=scored(mtmExam(['mc','tf','short']),{'q-1':'A','q-2':[true,false,true,true],'q-3':'0,500'}),score=result.mtm!;
  assert.deepEqual(score.rawTotal,fraction('25','3'));assert.equal(score.officialDisplayTotal,'8.33');
  assert.equal(rowByType(score,'DS').correctCount,3);assert.deepEqual(rowByType(score,'DS').earned,fraction('5','3'));
  assert.deepEqual(score.sections.map(s=>({type:s.type,rawTotal:s.rawTotal,maxScore:s.maxScore})),[
    {type:'TN',rawTotal:fraction('10','3'),maxScore:fraction('10','3')},
    {type:'DS',rawTotal:fraction('5','3'),maxScore:fraction('10','3')},
    {type:'TLN',rawTotal:fraction('10','3'),maxScore:fraction('10','3')},
  ]);
});

test('DS bốn ý chấm đúng bảng lũy tiến k=0..4 qua resultFor',()=>{
  const exam=mtmExam(['tf']),expected=['0.00','1.00','2.50','5.00','10.00'];
  for(let k=0;k<=4;k++){
    const key=[true,false,true,false],answers=key.map((value,index)=>index<k?value:!value),score=scored(exam,{'q-1':answers}).mtm!;
    assert.equal(score.rows[0].correctCount,k);assert.equal(score.officialDisplayTotal,expected[k]);
  }
  const blanks=scored(exam,{'q-1':[true,null,null,null]}).mtm!;assert.equal(blanks.rows[0].correctCount,1);assert.equal(blanks.officialDisplayTotal,'1.00');
});

test('ROUND_HALF_UP đúng tại điểm giữa 0.125 thành 0.13, chỉ làm tròn tổng',()=>{
  const exam=mtmExam(['tf',...Array.from({length:7},()=> 'mc' as const)]),score=scored(exam,{'q-1':[true,null,null,null]}).mtm!;
  assert.deepEqual(score.rawTotal,fraction('1','8'));assert.equal(score.displayTotal,'0.13');assert.equal(score.officialDisplayTotal,'0.13');
});

test('Phần chưa chấm được giữ subtotal nhưng không công bố tổng chính thức',()=>{
  const exam=mtmExam(['mc','mc','mc']);exam.sourceComplete=false;
  const result=scored(exam,{'q-1':'A'});
  assert.deepEqual(result.mtm!.rawTotal,fraction('10','3'));assert.equal(result.mtm!.officialTotal,null);assert.equal(result.mtm!.officialDisplayTotal,null);
  assert.ok(result.mtm!.pending.length>0);assert.equal(result.score.finalMillipoints,null);
});

test('Thiếu khóa và DS thiếu ý giữ nguyên N, phân biệt chưa chấm được với trả lời sai',()=>{
  const exam=mtmExam(['mc','tf','short']);
  delete (exam.questions[0] as any).answer;
  (exam.questions[1] as any).statements=['Mệnh đề a','Mệnh đề b','Mệnh đề c'];
  delete (exam.questions[2] as any).shortRule;
  const score=scored(exam,{'q-1':'B','q-2':[true,false,true,false],'q-3':'1/2'}).mtm!;
  assert.equal(score.officialTotal,null);assert.equal(score.officialDisplayTotal,null);assert.equal(score.rows.length,3);
  assert.ok(score.rows.every(row=>row.status==='ungradable'&&row.earned===null));
  assert.ok(score.rows.every(row=>JSON.stringify(row.maxScore)===JSON.stringify(fraction('10','3'))));
});

test('TLN qua resultFor giữ đúng đơn vị và số chữ số, không bị bộ chuẩn hóa cũ thay câu trả lời',()=>{
  const exam=mtmExam(['short']),question=exam.questions[0];assert.equal(question.kind,'short');
  Object.assign(question,{mode:'numeric',acceptedAnswers:['2,00 cm'],shortRule:{verified:true,evidence:'Quy tắc tổng hợp đơn vị và định dạng',mode:'decimal',unit:'cm',decimalPlaces:2}});
  assert.equal(scored(exam,{'q-1':'2.00 cm'}).mtm!.officialDisplayTotal,'10.00');
  assert.equal(scored(exam,{'q-1':'2 cm'}).mtm!.officialDisplayTotal,'0.00');
  assert.equal(scored(exam,{'q-1':'2.00'}).mtm!.officialDisplayTotal,'0.00');
});

test('JSON lỗi issues cùng shortRule mâu thuẫn không làm sập bộ chấm hoặc công bố tổng',()=>{
  const exam=mtmExam(['short']);Object.assign(exam.questions[0],{issues:{code:'Không phải danh sách'},shortRule:{verified:true,evidence:'Quy tắc giả',mode:'decimal'}});
  const result=scoreAssessment(exam,{'q-1':'1/2'});assert.ok(result.ok);assert.ok(result.mtm);
  assert.equal(result.mtm.officialTotal,null);assert.equal(result.mtm.officialDisplayTotal,null);assert.equal(result.mtm.rows[0].earned,null);
  assert.ok(result.mtm.pending.length>0);
});

test('Máy chủ nộp bài thật lưu đúng điểm hiển thị và điểm gốc phân số',()=>{
  const fixture=server(mtmExam()),started=fixture.service.start(fixture.token),state=fixture.service.submit(fixture.token,started.draft!.attemptId,{'q-1':'A'});
  const receipt=state.receipts[0];assert.equal(receipt.score,0.22);assert.equal(state.bestScore,0.22);assert.equal(receipt.rubricVersion,MTM_SCORING_VERSION);
  assert.deepEqual(receipt.mtm!.rawTotal,fraction('2','9'));assert.equal(receipt.mtm!.officialDisplayTotal,'0.22');
  assert.deepEqual(fixture.repo.get(fixture.student.studentCode)!.receipts[0],receipt);
  const repeated=fixture.service.submit(fixture.token,started.draft!.attemptId,allCorrect(mtmExam()));
  assert.equal(repeated.receipts.length,1);assert.deepEqual(repeated.receipts[0],receipt);
});

test('Máy chủ chặn nguồn chưa sẵn sàng trước mở lượt, không tạo subtotal công khai',()=>{
  const exam=mtmExam(['mc','mc','mc']);exam.sourceComplete=false;
  const fixture=server(exam);
  assert.ok(fixture.service.state(fixture.token));
  assert.throws(()=>fixture.service.start(fixture.token),error=>error instanceof HomeworkError&&error.status===409);
  assert.equal(fixture.repo.get(fixture.student.studentCode)!.drafts.length,0);
  const result=scored(exam,{'q-1':'A'});
  assert.equal(result.mtm!.officialDisplayTotal,null);
  assert.deepEqual(result.mtm!.rawTotal,fraction('10','3'));
});

test('Draft khóa phiên bản đề và rubric, từ chối dùng lượt cũ với đề mới',()=>{
  const exam=mtmExam(),draft=must(createDraft(exam,'version-locked',T0));
  for(const changed of [{...exam,versionHash:'c'.repeat(64)},{...exam,rubricVersion:'MTM-FLEX-10-v1'}]){
    const checked=validateDraft(draft,changed);assert.equal(checked.ok,false);
    assert.equal(resultFor(changed,{...draft,submittedAt:T0}),null);
  }
  const fixture=server(exam),started=fixture.service.start(fixture.token),work=fixture.repo.get(fixture.student.studentCode)!;
  work.drafts[0]={...work.drafts[0],examVersionHash:'d'.repeat(64)};fixture.repo.put(work);
  assert.throws(()=>fixture.service.submit(fixture.token,started.draft!.attemptId,{'q-1':'A'}),error=>error instanceof HomeworkError&&error.status===400);
  assert.equal(fixture.repo.get(fixture.student.studentCode)!.receipts.length,0);
});

test('Draft khóa phiên bản đáp án riêng và MTM result dùng đúng attemptId',()=>{
  const exam=mtmExam(['mc']),draft=must(createDraft(exam,'answer-key-locked',T0));assert.equal(draft.answerKeyVersion,exam.answerKeyVersion);
  const changed={...exam,answerKeyVersion:'fixture-key-v2'};assert.equal(validateDraft(draft,changed).ok,false);
  assert.equal(resultFor(changed,{...draft,submittedAt:T0}),null);
  const result=scored(exam,{'q-1':'A'});assert.equal(result.mtm!.attemptId,'fixture-attempt');assert.equal(result.mtm!.versions.answerKeyVersion,'fixture-key-v1');
});

test('Máy chủ chụp bản đề đã xác minh, sửa object biên tập sau mở lượt không đổi khóa',()=>{
  const exam=mtmExam(['mc']),fixture=server(exam),started=fixture.service.start(fixture.token);
  exam.answerKeyVersion='fixture-key-v2';exam.versionHash='d'.repeat(64);if(exam.questions[0].kind==='mc')exam.questions[0].answer='B';
  const state=fixture.service.submit(fixture.token,started.draft!.attemptId,{'q-1':'A'});
  assert.equal(state.receipts[0].score,10);assert.equal(state.receipts[0].mtm!.versions.examVersion,'b'.repeat(64));
  assert.equal(state.receipts[0].mtm!.versions.answerKeyVersion,'fixture-key-v1');
});

test('Đề rubric cũ giữ nguyên điểm 0.25, DS cũ và tổng qua engine cũ',()=>{
  const exam=clone(legacyJson) as unknown as PracticeExam,first=exam.questions[0],tf=exam.questions.find(q=>q.kind==='tf')!;
  assert.equal(first.kind,'mc');assert.equal(tf.kind,'tf');
  const answers={[first.id]:first.answer,[tf.id]:[tf.answer[0],null,null,null]};
  const score=scorePracticeAssessment(exam,answers);assert.ok(score.ok);assert.equal(score.earnedMillipoints,350);assert.equal(score.mtm,undefined);
  const result=resultFor(exam,completeDraft(exam,{[first.id]:first.answer}));assert.ok(result?.score.ok);assert.equal(result.score.earnedMillipoints,250);assert.equal(result.mtm,undefined);
  const fixture=server(exam),started=fixture.service.start(fixture.token),state=fixture.service.submit(fixture.token,started.draft!.attemptId,{[first.id]:first.answer});
  assert.equal(state.receipts[0].score,0.25);assert.equal(state.bestScore,0.25);
});

test('History giữ snapshot đề, khóa đáp án và điểm cũ sau khi có rubric mới',()=>{
  const storage=new FakeStore(),old=clone(legacyJson) as unknown as PracticeExam,first=old.questions[0];assert.equal(first.kind,'mc');
  const draft=completeDraft(old,{[first.id]:first.answer},'legacy-history');must(archiveSubmitted(storage,old,draft));
  const newer=mtmExam();newer.id=old.id;newer.versionHash='c'.repeat(64);
  old.questions[0].answer=first.answer==='A'?'B':'A';
  const history=readHistory(storage,[newer]);assert.equal(history.items.length,1);const entry=history.items[0];
  assert.equal(entry.exam.rubricVersion,legacyJson.rubricVersion);assert.equal(entry.exam.versionHash,legacyJson.versionHash);assert.equal(entry.draft.rubricVersion,legacyJson.rubricVersion);
  const result=resultFor(entry.exam,entry.draft);assert.ok(result?.score.ok);assert.equal(result.score.earnedMillipoints,250);assert.equal(result.mtm,undefined);
});

test('Biên nhận đã lưu giữ nguyên khi bản đề hiện hành chuyển sang thang MTM mới',()=>{
  const exam=clone(legacyJson) as unknown as PracticeExam,first=exam.questions[0];assert.equal(first.kind,'mc');
  const fixture=server(exam),started=fixture.service.start(fixture.token),before=fixture.service.submit(fixture.token,started.draft!.attemptId,{[first.id]:first.answer}).receipts[0];
  Object.assign(exam,mtmExam());
  const state=fixture.service.state(fixture.token);assert.deepEqual(state.receipts[0],before);assert.equal(state.bestScore,0.25);
});

// Hàm suite dùng callback đồng bộ. Chờ luồng RPC xong rồi đưa lỗi thật vào ca test.
const durableError=await (async()=>{
  for(const complete of [true,false]){
    const exam=mtmExam();exam.sourceComplete=complete;
    const material={lessonCode:'durable-fixture-lesson',classNames:['Lớp tổng hợp RPC'],date:'2026-10-15',title:'Bài kiểm thử RPC',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null};
    let snapshot:DurableSnapshot={revision:0,exam,material,lessons:[material],work:{student:{studentCode:'PRIVATE-FIXTURE',fullName:'Người dùng tổng hợp RPC',phone:'0000000000',className:'Lớp tổng hợp RPC'},drafts:[],receipts:[]}};
    const commits:Record<string,unknown>[]=[];
    const durable=new SupabaseHomeworkRepository({async rpc(name,args){
      if(name==='mtm_btvn_read')return {data:clone(snapshot),error:null};
      if(name==='mtm_btvn_commit'){
        assert.equal(args.p_revision,snapshot.revision);assert.equal(args.p_lesson,material.lessonCode);
        commits.push(clone(args));snapshot={...snapshot,revision:snapshot.revision+1,work:{...snapshot.work,drafts:clone(args.p_drafts as Draft[]),receipts:clone(args.p_receipts as DurableSnapshot['work']['receipts'])}};
        return {data:{ok:true},error:null};
      }
      throw new Error('RPC ngoài phạm vi test: '+name);
    }},async()=>{throw new Error('Không gọi Edge trong kiểm thử chấm bài');},()=>T0);
    if(!complete){
      await assert.rejects(durable.call('fixture-session','start',material.lessonCode),/chấm|khóa|nguồn|hợp lệ/i);
      assert.equal(commits.length,0);assert.equal(snapshot.work.drafts.length,0);continue;
    }
    const started=await durable.call('fixture-session','start',material.lessonCode),id=started.draft!.attemptId;
    const saved=await durable.call('fixture-session','save',material.lessonCode,id,{'q-1':'A'});assert.equal(saved.saveOnly,true);
    const state=await durable.call('fixture-session','submit',material.lessonCode,id,{'q-1':'A'});
    assert.equal(commits.length,3);assert.equal(state.demo,false);assert.equal(state.receipts.length,1);
    const persisted=(commits[2].p_receipts as DurableSnapshot['work']['receipts'])[0];assert.deepEqual(persisted,state.receipts[0]);
    assert.equal(persisted.score,complete?0.22:null);assert.equal(state.bestScore,complete?0.22:null);
    assert.deepEqual(persisted.mtm!.rawTotal,fraction('2','9'));assert.equal(persisted.mtm!.officialDisplayTotal,complete?'0.22':null);
    assert.equal(persisted.mtm!.attemptId,id);assert.equal(persisted.rubricVersion,MTM_SCORING_VERSION);
    assert.equal((commits[2].p_drafts as Draft[])[0].answerKeyVersion,'fixture-key-v1');
  }
})().then(()=>null,error=>error);
test('Luồng durable lưu phân số cho đề sẵn sàng, nguồn thiếu không tạo commit',()=>{if(durableError)throw durableError;});

finish();
