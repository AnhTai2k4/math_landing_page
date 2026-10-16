// Fixture tổng hợp và port giả. Không truy cập mạng hoặc dữ liệu học sinh.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MTM_SCORING_VERSION,mtmFraction} from '../src/native/exams/mtm-scoring';
import {mtmPracticeGradingReadiness,scoreMtmEqualAssessment} from '../src/native/exams/mtm-assessment';
import {validatePracticeExam,type PracticeExam} from '../src/native/exams/data';
import {createBtvnPublishHandler,expectedSlots,type PublishAsset} from '../server/btvn/publish-handler';
import legacyJson from '../server/btvn/demo-exam.json';

const results:{name:string;pass:boolean;error?:string}[]=[];
async function test(name:string,fn:()=>unknown){try{await fn();results.push({name,pass:true});}catch(error){results.push({name,pass:false,error:String(error)});}}
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const clone=<T,>(value:T):T=>structuredClone(value);
const png=Uint8Array.from([137,80,78,71,13,10,26,10]);
const asset=(path:string,bytes=png,type='image/png'):PublishAsset=>({path,sha256:sha(bytes),content_type:type,data_base64:Buffer.from(bytes).toString('base64')});
type Kind='mc'|'tf'|'short';
function examFor(kind:Kind='mc'):PracticeExam {
 const base={id:'q-1',sourceRef:'Nguồn tổng hợp, câu 1',prompt:'Câu hỏi tổng hợp để kiểm thử',maxPoints:mtmFraction(10n),maxMillipoints:10000};
 const question=kind==='mc'?{...base,kind,choices:['Một','Hai','Ba','Bốn'],answer:'A'}:
  kind==='tf'?{...base,kind,statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,1000,2500,5000,10000]}:
  {...base,kind,mode:'numeric',acceptedAnswers:['2,50 cm'],shortRule:{verified:true,evidence:'Quy tắc tổng hợp đã kiểm',mode:'decimal',unit:'cm',decimalPlaces:2}};
 return {id:'mtm-readiness-fixture',title:'Đề tổng hợp kiểm readiness',grade:12,period:'GK1',durationMinutes:120,
  sourceRef:'Nguồn tổng hợp kiểm thử',sourceHash:'a'.repeat(64),versionHash:'b'.repeat(64),rubricVersion:MTM_SCORING_VERSION,
  answerKeyVersion:'fixture-key-v1',sourceComplete:true,questionCount:1,answerKeyVerified:true,rubricVerified:true,
  publicationVerified:true,questionDisplayVerified:true,sourceUrl:'https://example.invalid/fixture',
  sourceMaterial:{title:'Nguồn tổng hợp',publisher:'Fixture',version:'fixture-v1',locator:'Câu tổng hợp 1'},questions:[question]} as unknown as PracticeExam;
}
async function publish(exam:PracticeExam,assets:PublishAsset[]=[asset('fixture.png')],actual?:unknown,previous='chua_dang'){
 const calls:{action:string;payload?:unknown}[]=[];
 const handler=createBtvnPublishHandler({rpc:async(action,payload)=>{calls.push({action,payload});return action==='lookup'?{status:previous}:{status:'published'};},upload:async()=>{calls.push({action:'upload'});}},'fixture-secret-000000000000000000000000');
 const slots=expectedSlots(exam).map(slot=>{const question=exam.questions.find(q=>q.id===slot.question_id)!;return {...slot,actual:slot.slot==='answer'?(actual??(question.kind==='short'?question.acceptedAnswers[0]:slot.expected)):slot.expected,conversion_verified:true};});
 const body={action:'publish',lesson_key:'fixture-daily17',source_version:'c'.repeat(64),material:{lessonCode:'fixture-daily17',classNames:['Lớp tổng hợp'],date:'2026-10-16',title:'Buổi tổng hợp'},exam,
  verification:{validator:true,independent:true,receipt_hash:'d'.repeat(64),provider:'review-fixture',extractor_provider:'extract-fixture',model:'fixture',slots},assets};
 const response=await handler(new Request('https://example.invalid/publish',{method:'POST',headers:{'X-MTM-Publish-Secret':'fixture-secret-000000000000000000000000'},body:JSON.stringify(body)}));
 return {status:response.status,body:await response.json(),calls};
}
function score(exam:PracticeExam,answer:unknown){const scored=scoreMtmEqualAssessment(exam,{'q-1':answer});assert.ok(scored.ok);assert.ok(scored.mtm);return scored.mtm;}
function pdfExam(){const exam=examFor('tf'),bytes=new TextEncoder().encode('%PDF-1.4\nfixture'),pdf=asset('exam-assets/'+sha(bytes)+'.pdf',bytes,'application/pdf');delete exam.questions[0].prompt;delete exam.questions[0].statements;
 exam.questions[0].sourcePdfPage=1;
 exam.sourcePdf={url:'/'+pdf.path,verified:true,sha256:pdf.sha256,bytes:bytes.length,totalPages:1,questionPages:[1]};return {exam,assets:[pdf]};}

await test('MC có nhãn a), b) trong đề giữ kind đã khóa và chấm đủ 10',()=>{
 const exam=examFor();exam.questions[0].prompt='Xét cách giải:\na) Biến đổi phương trình.\nb) Chọn kết quả.';
 assert.equal(validatePracticeExam(exam).valid,true);assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(score(exam,'A').officialDisplayTotal,'10.00');
});
await test('DS nguồn PDF đã kiểm không cần chép lại statements hoặc prompt',()=>{
 const {exam}=pdfExam();assert.equal(validatePracticeExam(exam).valid,true);assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(score(exam,[true,false,true,false]).officialDisplayTotal,'10.00');
});
await test('DS nguồn ảnh hợp lệ không cần chép lại statements',()=>{
 const exam=examFor('tf');delete exam.questions[0].statements;delete exam.questions[0].prompt;
 const question=asset('images/question.png'),solution=asset('images/solution.png',Uint8Array.from([...png,1]));
 exam.questions[0].sourceContent={questions:[{path:question.path,sha256:question.sha256,sourcePage:1,width:800,height:600}],solutions:[{path:solution.path,sha256:solution.sha256,sourcePage:2,width:800,height:600}]};
 assert.equal(validatePracticeExam(exam).valid,true);assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(score(exam,[true,false,true,false]).officialDisplayTotal,'10.00');
});
await test('DS có statements được cung cấp thiếu hoặc thừa ý vẫn pending dù có PDF',()=>{
 for(const count of [0,3,5]){const {exam}=pdfExam();(exam.questions[0] as any).statements=Array.from({length:count},(_,i)=>'Ý '+i);
  assert.equal(mtmPracticeGradingReadiness(exam).valid,false);const result=score(exam,[true,false,true,false]);assert.equal(result.officialTotal,null);assert.equal(result.rows.length,1);}
});
await test('Locator đơn lẻ và nguồn PDF chưa được xác minh không thay nội dung DS',()=>{
 const {exam}=pdfExam();(exam.sourcePdf as any).verified=false;assert.equal(mtmPracticeGradingReadiness(exam).valid,false);
 delete exam.sourcePdf;assert.equal(mtmPracticeGradingReadiness(exam).valid,false);
});
await test('Không bỏ qua trường cấu trúc mâu thuẫn chỉ vì kind hợp lệ',()=>{
 const exam=examFor();(exam.questions[0] as any).statements=['a','b','c','d'];assert.equal(mtmPracticeGradingReadiness(exam).valid,false);
});
await test('Readiness chặn nguồn thiếu, khóa thiếu, lỗi nguồn và TLN thiếu quy tắc',()=>{
 const changes=[(e:any)=>{e.sourceComplete=false;},(e:any)=>{delete e.sourceComplete;},(e:any)=>{delete e.questions[0].answer;},(e:any)=>{e.questions[0].answerConflict=true;},(e:any)=>{e.issues=['Nguồn cần đối chiếu'];},(e:any)=>{e.questions[0].issues=['Câu cần kiểm'];}];
 for(const change of changes){const exam=examFor();change(exam);assert.equal(mtmPracticeGradingReadiness(exam).valid,false);}
 const short=examFor('short');delete (short.questions[0] as any).shortRule;assert.equal(mtmPracticeGradingReadiness(short).valid,false);
});
await test('Chấm TLN giữ đơn vị và số chữ số, không chấp nhận định dạng rút gọn',()=>{
 const exam=examFor('short');assert.equal(score(exam,'2.50 cm').officialDisplayTotal,'10.00');
 for(const value of ['2.5 cm','2.50','2,500 cm'])assert.equal(score(exam,value).officialDisplayTotal,'0.00');
});
await test('Publisher chặn pending trước upload và RPC publish',async()=>{
 for(const change of [(e:any)=>{e.sourceComplete=false;},(e:any)=>{e.questions[0].answerConflict=true;},(e:any)=>{delete e.questions[0].answer;},(e:any)=>{e.issues=['Lỗi nguồn tổng hợp'];}]){
  const exam=examFor();change(exam);const result=await publish(exam);assert.equal(result.status,422);assert.deepEqual(result.calls.map(call=>call.action),['lookup']);
 }
});
await test('Publisher chặn DS thiếu ý trước mọi ghi',async()=>{
 const exam=examFor('tf');exam.questions[0].statements!.pop();const result=await publish(exam);assert.equal(result.status,422);assert.deepEqual(result.calls.map(call=>call.action),['lookup']);
});
await test('Publisher nhận proof TLN có đơn vị và định dạng đã khóa bằng engine MTM',async()=>{
 const result=await publish(examFor('short'),undefined,'2.50 cm');assert.equal(result.status,200);assert.deepEqual(result.calls.map(call=>call.action),['lookup','upload','publish']);
});
await test('Publisher từ chối proof TLN sai đơn vị hoặc số chữ số trước upload',async()=>{
 for(const actual of ['2.5 cm','2.50','2.50 m']){const result=await publish(examFor('short'),undefined,actual);assert.equal(result.status,422);assert.deepEqual(result.calls.map(call=>call.action),['lookup']);}
});
await test('Publisher nhận DS nguồn PDF và giữ bốn slot proof',async()=>{
 const {exam,assets}=pdfExam();const result=await publish(exam,assets);assert.equal(result.status,200);assert.deepEqual(result.calls.map(call=>call.action),['lookup','upload','publish']);
});
await test('Bài đã đăng giữ tính lặp an toàn và không đi qua gate thang mới',async()=>{
 const exam=examFor();exam.sourceComplete=false;const result=await publish(exam,undefined,undefined,'da_dang');assert.equal(result.status,200);assert.equal(result.body.status,'already_published');assert.deepEqual(result.calls.map(call=>call.action),['lookup']);
});
await test('Publisher giữ nguyên nhánh đề rubric cũ',async()=>{
 const legacy=clone(legacyJson) as unknown as PracticeExam;legacy.durationMinutes=120;
 delete legacy.sourceInstructions;delete legacy.solutionInstructions;delete legacy.sourcePdf;delete legacy.mtmDocuments;
 for(const question of legacy.questions){delete question.sourceContent;question.prompt='Câu tổng hợp kiểm hồi quy thang cũ.';question.solution='Lời giải tổng hợp kiểm hồi quy.';if(question.kind==='tf')question.statements=['Ý a','Ý b','Ý c','Ý d'];}
 const result=await publish(legacy);assert.equal(result.status,200);assert.equal(result.calls.at(-1)?.action,'publish');
});

for(const result of results)console.log((result.pass?'ĐẠT ':'LỖI ')+result.name+(result.error?'\n'+result.error:''));
const failed=results.filter(result=>!result.pass).length;
console.log(JSON.stringify({suite:'DAILY17-READINESS',total:results.length,passed:results.length-failed,failed,fixture:'Dữ liệu tổng hợp; RPC/upload giả'}));
process.exitCode=failed?1:0;
