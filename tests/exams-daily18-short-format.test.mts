// Dữ liệu tổng hợp và kiểm RAM. Không hồ sơ hoặc đề thật, không mạng.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {MTM_SCORING_VERSION,normalizeMtmShort,type MtmShortRule} from '../src/native/exams/mtm-scoring';
import {validatePracticeExam,validateQuestionOnlyPracticeExam,type PracticeExam} from '../src/native/exams/data';
import {shortAnswerStatus,shortInterpretationMessage,shortHelpMessage,shortFormatMessage,shortHasAmbiguousSeparator,answerState,pendingQuestions} from '../src/native/exams/attempt-ui';
import {questionShortFormat,validPublicShortFormat,publicShortFormatFromRule} from '../src/native/exams/short-format';
import {concealMonthlySolutions} from '../server/btvn/monthly-policy';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import type {LessonMaterial} from '../src/native/homework/btvn-contract';
import {pipelineFixture} from './btvn-pipeline-fixture';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('DAILY18-SHORT-FORMAT-');
const T0=Date.UTC(2026,9,16,6),closesAt=T0+60000;
const decimalRule:MtmShortRule={verified:true,evidence:'PRIVATE_RULE_EVIDENCE',mode:'decimal',unit:'cm',decimalPlaces:2};
function fixture(rule:MtmShortRule=decimalRule,answer='2,50 cm'):PracticeExam {
  const base=pipelineFixture().exam;
  return {...base,id:'mtm-short-format-fixture',rubricVersion:MTM_SCORING_VERSION,answerKeyVersion:'fixture-key-v1',sourceComplete:true,
    questionCount:1,sections:[{label:'Trả lời ngắn tổng hợp',kind:'short',count:1}],questions:[{id:'q-1',kind:'short',prompt:'Câu tổng hợp để kiểm yêu cầu nhập',sourceRef:'Nguồn tổng hợp, câu 1',
      mode:rule.mode==='decimal'?'numeric':rule.mode,acceptedAnswers:[answer],shortRule:structuredClone(rule),maxMillipoints:10000,maxPoints:{numerator:'10',denominator:'1'}}]};
}
function assertPublic(exam:PracticeExam){
  assert.equal(validateQuestionOnlyPracticeExam(exam).valid,true);
  const q=exam.questions[0],serialized=JSON.stringify(q);
  for(const key of ['answer','acceptedAnswers','shortRule','solution'])assert.ok(!Object.hasOwn(q,key),key);
  assert.ok(!serialized.includes('PRIVATE_RULE_EVIDENCE'));
  assert.deepEqual(q.shortFormat,{mode:'decimal',unit:'cm',decimalPlaces:2});
  assert.deepEqual(Object.keys(q.shortFormat!).sort(),['decimalPlaces','mode','unit']);
}

test('Projection chỉ dựng yêu cầu nhập từ rule, bỏ shortFormat sẵn có và không sửa nguồn',()=>{
  const exam=fixture();(exam.questions[0] as any).shortFormat={mode:'exact',verified:true,evidence:'PUBLIC_INJECTION',answer:'LEAK',acceptedAnswers:['LEAK']};
  const before=JSON.stringify(exam),publicExam=concealMonthlySolutions(exam);assertPublic(publicExam);
  assert.ok(!JSON.stringify(publicExam).includes('PUBLIC_INJECTION'));
  assert.equal(JSON.stringify(exam),before);
});

test('State BTVN thường và bài tháng đều mang shortFormat trước và trong lượt, không lộ rule',()=>{
  for(const monthly of [false,true]){
    const exam=fixture(),student={studentCode:'SYNTHETIC-SHORT-FORMAT',fullName:'Người dùng tổng hợp',phone:'0000000000',className:'Lớp tổng hợp'};
    const material:LessonMaterial={lessonCode:'fixture-short-format',classNames:[student.className],date:'2026-10-16',title:'Buổi tổng hợp',
      kind:monthly?'kiem-tra-thang':'btvn',classOpensAt:{[student.className]:new Date(T0).toISOString()},...(monthly?{opensAt:T0,closesAt}:{})};
    let now=T0;const repo=new MemoryHomeworkRepository([student]),service=new HomeworkService(repo,exam,0,'fixture',material.lessonCode,()=>now,[material]);
    const token=service.login({studentCode:student.studentCode},'fixture-ip');assertPublic(service.state(token).exam!);
    const started=service.start(token);assertPublic(started.exam!);
    assertPublic(service.save(token,started.draft!.attemptId,{'q-1':'2,50 cm'}).exam!);
    now++;const submitted=service.submit(token,started.draft!.attemptId,{'q-1':'2,50 cm'});
    if(monthly){assertPublic(submitted.exam!);assert.equal(submitted.receipts[0].score,null);now=closesAt;}
    const opened=service.state(token);assert.equal(opened.solutionsAvailable,true);assert.equal(opened.receipts[0].score,10);
    assert.deepEqual(opened.exam!.questions[0],exam.questions[0]);
  }
});

test('Validator công khai chặn metadata, khóa, unknown field và sai kind hoặc mode trong shortFormat',()=>{
  const clean=concealMonthlySolutions(fixture());
  for(const value of [null,[],{mode:'decimal',verified:true},{mode:'decimal',evidence:'PRIVATE'},
    {mode:'decimal',answer:'2.50'},{mode:'decimal',acceptedAnswers:['2.50']},{mode:'decimal',tolerance:0.01},
    {mode:'exact'},{mode:'numeric'},{mode:'decimal',unit:' cm'},{mode:'decimal',unit:''},
    {mode:'decimal',whitespace:'remove'},{mode:'decimal',decimalPlaces:-1},{mode:'decimal',decimalPlaces:101},
    {mode:'decimal',decimalPlaces:1.5},{mode:'rational',decimalPlaces:2}]){
    const exam=structuredClone(clean);(exam.questions[0] as any).shortFormat=value;
    assert.equal(validateQuestionOnlyPracticeExam(exam).valid,false,JSON.stringify(value));
  }
  const mc=structuredClone(clean);Object.assign(mc.questions[0],{kind:'mc',choices:['a','b','c','d']});
  assert.equal(validateQuestionOnlyPracticeExam(mc).valid,false);
});

test('Transport MTM thiếu yêu cầu nhập bị chặn, đề riêng có rule vẫn được nhận',()=>{
  for(const mode of ['decimal','rational','exact'] as const){
    const exam=fixture({...decimalRule,mode,...(mode==='decimal'?{}:{decimalPlaces:undefined})},mode==='decimal'?'2,50 cm':mode==='rational'?'5/2 cm':'A cm');
    const original=JSON.stringify(exam),publicExam=concealMonthlySolutions(exam);
    assert.equal(validatePracticeExam(exam).valid,true);
    assert.equal(validateQuestionOnlyPracticeExam(publicExam).valid,true);
    delete publicExam.questions[0].shortFormat;
    const result=validateQuestionOnlyPracticeExam(publicExam);
    assert.equal(result.valid,false,mode);assert.ok(result.errors.includes('Invalid public short input format'));
    assert.equal(JSON.stringify(exam),original);
  }
});

test('Định dạng số thập phân hai chữ số và đơn vị khớp engine, không tự làm tròn hoặc nối đơn vị',()=>{
  const exam=concealMonthlySolutions(fixture()),format=questionShortFormat(exam,exam.questions[0])!;
  for(const [input,valid] of [['2,50 cm',true],['  +002.50  cm  ',true],['2,5 cm',false],['2,500 cm',false],['2.50cm',false],
    ['2.50 m',false],['2.50',false],['5/2 cm',false],['2+0.50 cm',false],['2e0 cm',false],['2,50 cm x',false]] as const){
    assert.equal(shortAnswerStatus('numeric',input,format),valid?'valid':'invalid',input);
    assert.equal(normalizeMtmShort(input,decimalRule)!==null,valid,input);
    assert.equal(answerState(exam,exam.questions[0],{'q-1':input}),valid?'answered':'invalid',input);
  }
  assert.equal(shortAnswerStatus('numeric','   ',format),'empty');
  assert.equal(pendingQuestions(exam,{'q-1':'2,5 cm'})[0].state,'invalid');
});

test('Không nuốt m ở cuối cm; exact có /1 và whitespace được hiểu đúng, không sửa bài làm',()=>{
  const unitRule={...decimalRule,unit:'m'},unitFormat=publicShortFormatFromRule(unitRule,'numeric')!;
  assert.equal(shortAnswerStatus('numeric','2,50 cm',unitFormat),'invalid');
  assert.equal(shortInterpretationMessage('numeric','2,50 cm',unitFormat),'');
  const rule:MtmShortRule={verified:true,evidence:'PRIVATE_RULE_EVIDENCE',mode:'exact',whitespace:'collapse',unit:'đv'};
  const format=publicShortFormatFromRule(rule,'exact')!,input='  A/1   +   B   đv  ';
  assert.equal(normalizeMtmShort(input,rule),'A/1 + B');
  assert.equal(shortAnswerStatus('exact',input,format),'valid');
  assert.equal(shortInterpretationMessage('exact',input,format),'Máy đang hiểu là A/1 + B đv.');
  assert.equal(input,'  A/1   +   B   đv  ');
  assert.match(shortHelpMessage('exact',format),/khoảng trắng liên tiếp/);
  assert.equal(shortAnswerStatus('exact','đv',format),'invalid');
});

test('Rational và số thập phân dài dùng phân số chính xác, không đổi qua Number',()=>{
  const rational=publicShortFormatFromRule({mode:'rational',unit:'m'},'rational')!;
  assert.equal(shortInterpretationMessage('rational','-6/-8 m',rational),'Máy đang hiểu là 3/4 m.');
  assert.equal(shortAnswerStatus('rational','3/0 m',rational),'invalid');
  const decimal=publicShortFormatFromRule({mode:'decimal'},'numeric')!;
  assert.match(shortInterpretationMessage('numeric','000900719925474099312345.123400',decimal),/900719925474099312345,1234/);
  assert.match(shortInterpretationMessage('numeric','1,234',decimal),/không tách hàng nghìn/);
  assert.equal(shortInterpretationMessage('numeric','2,50 cm',questionShortFormat(fixture(),fixture().questions[0])),'Máy đang hiểu là 2,50 cm.');
});

test('Ba chữ số sau dấu luôn giải thích dấu thập phân, giữ số 0 rule và giá trị không nhầm hàng nghìn',()=>{
  for(const separator of [',','.']){
    const input='2'+separator+'500 cm',format={mode:'decimal' as const,unit:'cm',decimalPlaces:3};
    assert.equal(shortAnswerStatus('numeric',input,format),'valid');
    const message=shortInterpretationMessage('numeric',input,format);
    assert.match(message,/Máy đang hiểu là 2,500 cm, tức 2,5 cm\./);
    assert.match(message,/không tách hàng nghìn/);
    assert.equal(shortHasAmbiguousSeparator('numeric',input,format),true);
    assert.equal(input,'2'+separator+'500 cm');
    assert.match(shortInterpretationMessage('numeric','2'+separator+'025',{mode:'decimal',decimalPlaces:3}),/không tách hàng nghìn/);
  }
  const integer=shortInterpretationMessage('numeric','1000.000',{mode:'decimal',decimalPlaces:3});
  assert.match(integer,/1000,000, tức 1000\./);assert.match(integer,/không tách hàng nghìn/);
  assert.equal(shortHasAmbiguousSeparator('exact','A.500',{mode:'exact'}),false);
  assert.equal(shortHasAmbiguousSeparator('numeric','2,50 cm',{mode:'decimal',unit:'cm',decimalPlaces:2}),false);
});

test('Quy tắc không chữ số thập phân, 100 chữ số và unit phân biệt hoa thường khớp engine',()=>{
  for(const [rule,valid,invalid] of [
    [{mode:'decimal',decimalPlaces:0},'5','5,0'],
    [{mode:'decimal',decimalPlaces:100},'0,'+'1'.repeat(100),'0,'+'1'.repeat(99)],
    [{mode:'decimal',unit:'cm'},'2,5 cm','2,5 CM'],
  ] as const){
    const format=publicShortFormatFromRule(rule,'numeric')!;
    assert.equal(shortAnswerStatus('numeric',valid,format),'valid');assert.equal(shortAnswerStatus('numeric',invalid,format),'invalid');
  }
  assert.match(shortHelpMessage('numeric',{mode:'decimal',decimalPlaces:0}),/Nhập số nguyên/);
});

test('Dùng rule riêng trong đề đầy đủ, không cho shortFormat cũ ghi đè quy tắc thật',()=>{
  const exam=fixture();exam.questions[0].shortFormat={mode:'decimal'};
  assert.equal(validatePracticeExam(exam).valid,true);
  assert.deepEqual(questionShortFormat(exam,exam.questions[0]),{mode:'decimal',unit:'cm',decimalPlaces:2});
  assert.equal(answerState(exam,exam.questions[0],{'q-1':'2,5'}),'invalid');
});

test('Legacy giữ định dạng và parser cũ, không cho shortFormat hoặc shortRule lọt public',()=>{
  const legacy=pipelineFixture().exam,q=legacy.questions.find(q=>q.kind==='short')!;
  (q as any).shortRule=decimalRule;(q as any).shortFormat={mode:'decimal',verified:true,evidence:'LEGACY_INJECTION'};
  assert.equal(questionShortFormat(legacy,q),undefined);
  assert.equal(shortAnswerStatus('numeric','2,5'),'valid');assert.equal(shortAnswerStatus('numeric','2,5 cm'),'invalid');
  const publicExam=concealMonthlySolutions(legacy);assert.equal(validateQuestionOnlyPracticeExam(publicExam).valid,true);
  assert.ok(publicExam.questions.every(q=>!Object.hasOwn(q,'shortFormat')&&!Object.hasOwn(q,'shortRule')));
  const invalid=structuredClone(publicExam);invalid.questions[2].shortFormat={mode:'decimal'};
  assert.equal(validateQuestionOnlyPracticeExam(invalid).valid,false);
  assert.match(shortFormatMessage('numeric'),/0 điểm/);
});

test('Lời hướng dẫn và lỗi chỉ chứa yêu cầu nhập, không khóa hoặc evidence',()=>{
  const exam=concealMonthlySolutions(fixture()),format=questionShortFormat(exam,exam.questions[0]);
  const help=shortHelpMessage('numeric',format),message=shortFormatMessage('numeric',format);
  assert.match(help,/đúng 2 chữ số/);assert.match(help,/đơn vị cm/);assert.match(message,/Chưa đúng định dạng/);assert.match(message,/Nếu nộp nguyên câu trả lời này, câu này được 0 điểm/);
  for(const secret of ['2,50','2.50','PRIVATE_RULE_EVIDENCE','acceptedAnswers','verified']){
    assert.ok(!help.includes(secret));assert.ok(!message.includes(secret));
  }
});

test('Whitelist nhận đầy đủ format hợp lệ, không nhận kiểu gần giống',()=>{
  assert.equal(validPublicShortFormat({mode:'decimal',whitespace:'trim',unit:'cm',decimalPlaces:2},'numeric'),true);
  assert.equal(validPublicShortFormat({mode:'decimal',whitespace:['trim']},'numeric'),false);
  assert.equal(validPublicShortFormat({mode:'decimal',decimalPlaces:'2'},'numeric'),false);
});

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
function load(file:string){
  const code=buildSync({stdin:{contents:readFileSync(join(root,file),'utf8'),sourcefile:file,resolveDir:join(root,file,'..'),loader:'tsx'},
    bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
  const mod={exports:{} as any};
  new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:id==='react-dom'?{...require(id),createPortal:(children:any)=>children}:require(id),mod,mod.exports);
  return mod.exports.default;
}
const Sheet=load('src/native/exams/AttemptAnswerSheet.tsx'),Room=load('src/native/exams/FocusRoom.tsx');
test('SSR cả hai ô dùng định dạng và diễn giải đúng, aria-invalid và nhập được đơn vị',()=>{
  const render=(Component:any,exam:PracticeExam,answer:string)=>{
    const previousDocument=globalThis.document;(globalThis as any).document={body:{}};
    try{return renderToStaticMarkup(React.createElement(Component,{
      props:{exam,catalogUrl:'/btvn',storeOverride:{getItem:()=>null,setItem(){},removeItem(){}}},compact:true,onExit(){},state:{
        draft:{attemptId:'fixture-ssr',answers:{'q-1':answer}},sections:[{name:'TLN',from:0,to:1}],
        states:[answerState(exam,exam.questions[0],{'q-1':answer})],activeQuestion:0,pdfReady:true,seconds:600,answered:0,
        changeAnswer(){},finish(){},setActiveQuestion(){},setQuestionFocus(){},setPdfReady(){}} as any,
    }));}finally{if(previousDocument===undefined)delete (globalThis as any).document;else globalThis.document=previousDocument;}
  };
  for(const Component of [Sheet,Room])for(const [places,answer,wrong,display] of [[0,'2 cm','2,0 cm','2 cm'],[2,'2,50 cm','2,5 cm','2,50 cm'],[3,'2.500 cm','2,50 cm','2,500 cm']] as const){
    const exam=concealMonthlySolutions(fixture({...decimalRule,decimalPlaces:places},answer));delete exam.sourcePdf;
    const valid=render(Component,exam,answer),invalid=render(Component,exam,wrong);
    assert.match(valid,/inputMode="text"/);assert.match(valid,/đơn vị cm/);
    if(places===0)assert.match(valid,/Nhập số nguyên, không có chữ số thập phân/);else assert.ok(valid.includes('đúng '+places+' chữ số'));
    assert.ok(valid.includes('Máy đang hiểu là '+display+(places===3?', tức 2,5 cm.':'.')));assert.ok(!valid.includes('aria-invalid="true"'));
    assert.equal(valid.includes('is-ambiguous'),places===3);
    if(places===3)assert.match(valid,/không tách hàng nghìn/);assert.doesNotMatch(valid,/Máy đang hiểu là [^<]*\//);
    assert.match(invalid,/aria-invalid="true"/);assert.match(invalid,/Chưa đúng định dạng/);assert.ok(!invalid.includes('Máy đang hiểu là'));
    for(const secret of ['PRIVATE_RULE_EVIDENCE','acceptedAnswers','verified'])assert.ok(!valid.includes(secret));
    assert.match(valid,/aria-describedby="[^\"]*format[^\"]*interpretation[^\"]*help/);
    assert.doesNotMatch(valid,/aria-atomic/);assert.doesNotMatch(valid,/class="ep-short-feedback" aria-live/);
    assert.match(valid,/class="ep-format-error" aria-live="polite"/);
    assert.equal((valid.match(/class="ep-format-error" aria-live="polite"/g)??[]).length,1);
  }
  for(const Component of [Sheet,Room])for(const [rule,answer] of [
    [{mode:'decimal'},'-2,5'],[{mode:'rational'},'-3/4'],[{mode:'exact'},'A/1'],
  ] as const){
    const exam=concealMonthlySolutions(fixture({verified:true,evidence:'PRIVATE_RULE_EVIDENCE',...rule},answer));delete exam.sourcePdf;
    const markup=render(Component,exam,answer);
    assert.match(markup,/inputMode="text"/);assert.doesNotMatch(markup,/inputMode="decimal"/);
    assert.ok(!markup.includes('aria-invalid="true"'));assert.ok(markup.includes('value="'+answer+'"'));
  }
});

finish();
