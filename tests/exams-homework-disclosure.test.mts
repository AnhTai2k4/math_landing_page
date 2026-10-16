import assert from 'node:assert/strict';
import {pipelineFixture,digest} from './btvn-pipeline-fixture';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import {SupabaseHomeworkRepository,type DurableSnapshot} from '../server/btvn/supabase-repository';
import {createDurableHomeworkHandler} from '../server/btvn/durable-http';
import {hydratePrivateAssets,type PrivateAsset} from '../server/btvn/private-assets';
import {concealMonthlySolutions} from '../server/btvn/monthly-policy';
import type {HomeworkState,LessonMaterial} from '../src/native/homework/btvn-contract';

const opened=Date.parse('2026-10-15T22:00:00+07:00');
function fixture(){
 const base=pipelineFixture(),exam=base.exam;
 const segment=(path:string)=>({path,sha256:digest(path),width:100,height:100,sourcePage:1,privateUrl:'https://stale.invalid/'+path});
 exam.questions.forEach((q,i)=>{q.solution='LỜI GIẢI BÍ MẬT '+i;q.correctionNote='GHI CHÚ ĐÁP ÁN BÍ MẬT';q.sourceContent={questions:[segment('fake/question-'+i+'.png')],solutions:[segment('fake/solution-'+i+'.png')]};});
 exam.sourceInstructions=[segment('fake/questions-instructions.png')];exam.solutionInstructions=[segment('fake/solutions-instructions.png')];exam.answerVerificationNote='KHÓA ĐÁP ÁN BÍ MẬT';
 exam.mtmDocuments={questions:{url:exam.sourcePdf!.url,sha256:exam.sourcePdf!.sha256},solutions:{url:'/exam-assets/'+ 'e'.repeat(64)+'.pdf',sha256:'e'.repeat(64)}};
 const refs=[...exam.questions.flatMap(q=>[...q.sourceContent!.questions,...q.sourceContent!.solutions]),...exam.sourceInstructions,...exam.solutionInstructions,{path:exam.sourcePdf!.url.slice(1),sha256:exam.sourcePdf!.sha256},{path:exam.mtmDocuments.solutions.url.slice(1),sha256:exam.mtmDocuments.solutions.sha256}];
 const assets:PrivateAsset[]=refs.map(ref=>({path:ref.path,sha256:ref.sha256,storage_path:'btvn/fake/'+ref.sha256+'/'+ref.path.split('/').at(-1),content_type:ref.path.endsWith('.pdf')?'application/pdf':'image/png',bytes:100}));
 const material:LessonMaterial={...base.material,classOpensAt:{[base.material.classNames[0]]:new Date(opened-60000).toISOString()}};
 return {exam,material,assets};
}
function durable(monthly=false){
 const f=fixture();let now=opened;
 if(monthly)Object.assign(f.material,{kind:'kiem-tra-thang',opensAt:opened-60000,closesAt:opened+120000});
 let snapshot:DurableSnapshot={revision:0,exam:f.exam,material:f.material,lessons:[f.material],work:{student:{studentCode:'FAKE-ONLY',fullName:'Người học giả',phone:'',className:f.material.classNames[0]},drafts:[],receipts:[]}};
 const signed:string[]=[],failed=new Set<string>();let commits=0;
 const repo=new SupabaseHomeworkRepository({async rpc(name,args){
  if(name==='mtm_btvn_read')return {data:structuredClone(snapshot),error:null};
  if(name==='mtm_btvn_assets')return {data:structuredClone(f.assets),error:null};
  if(name==='mtm_btvn_commit'){commits++;snapshot={...snapshot,revision:snapshot.revision+1,work:{...snapshot.work,drafts:args.p_drafts as any,receipts:args.p_receipts as any}};return {data:{ok:true},error:null};}
  throw Error('RPC giả không hỗ trợ: '+name);
 }},async()=>({ok:true,session:'a'.repeat(64)}),()=>now,async path=>{signed.push(path);if(failed.has(path))throw Error('Lỗi ký giả');return 'https://signed.invalid/'+path;});
 return {...f,repo,signed,failed,read:()=>snapshot,commits:()=>commits,clock:(value:number)=>{now=value;}};
}
function questionsOnly(state:HomeworkState){
 assert.ok(state.exam);assert.equal(state.exam.responseMode,'questions-only');assert.equal(state.solutionsAvailable,false);
 for(const q of state.exam.questions){for(const field of ['answer','acceptedAnswers','solution','correctionNote'])assert.ok(!(field in q),field+' không được trả trước nộp');assert.ok(!('solutions' in q.sourceContent!));}
 assert.ok(!state.exam.solutionInstructions);assert.ok(!state.exam.mtmDocuments?.solutions);assert.ok(!state.exam.answerVerificationNote);
 assert.ok(!JSON.stringify(state.exam).includes('BÍ MẬT'));assert.ok(!JSON.stringify(state.exam).includes('fake/solution'));assert.ok(!JSON.stringify(state.exam).includes('stale.invalid'));
}

// Chạy đúng handler login rồi cùng repository state/select/start, không HTTP thật.
const regular=durable(),original=JSON.stringify(regular.exam),handler=createDurableHomeworkHandler(regular.repo);
const login=await handler({method:'POST',host:'fake.local',origin:'https://fake.local',secure:true,body:{action:'login',gate:{fullName:'Người học giả',phone:'0900000000',className:'Lớp giả pipeline'}}});
assert.equal(login.status,200);questionsOnly(login.body as HomeworkState);
for(const action of ['state','select','start'] as const){const state=await regular.repo.call('fake',action,regular.material.lessonCode);questionsOnly(state);assert.equal(state.serverNow,opened);}
assert.ok(regular.signed.length>0);assert.ok(regular.signed.every(path=>!path.includes('solution')&&!path.endsWith('/'+'e'.repeat(64)+'.pdf')));
assert.equal(JSON.stringify(regular.exam),original,'Lọc và ký không được thay khóa gốc');
const started=regular.read().work.drafts.at(-1)!;
const graded=await regular.repo.call('fake','submit',regular.material.lessonCode,started.attemptId,{'mc-1':'D'});
assert.equal(graded.receipts[0].score,3,'Máy chủ chấm khóa thật D');assert.equal(graded.solutionsAvailable,true);assert.equal(graded.exam!.questions[0].kind==='mc'&&graded.exam!.questions[0].answer,'D');assert.ok(JSON.stringify(graded.exam).includes('LỜI GIẢI BÍ MẬT'));assert.ok(graded.exam!.mtmDocuments!.solutions.url.startsWith('https://signed.invalid/'));
questionsOnly(await regular.repo.call('fake','start',regular.material.lessonCode));
assert.equal(regular.read().work.receipts.length,1,'Receipt lượt cũ không mở lời giải cho lượt mới');

const monthly=durable(true),monthStart=await monthly.repo.call('fake','start',monthly.material.lessonCode);
questionsOnly(await monthly.repo.call('fake','submit',monthly.material.lessonCode,monthStart.draft!.attemptId,{'mc-1':'D'}));
monthly.clock(monthly.material.closesAt!);const monthReview=await monthly.repo.call('fake','state');assert.equal(monthReview.solutionsAvailable,true);assert.ok(JSON.stringify(monthReview.exam).includes('BÍ MẬT'));
const unsubmitted=durable(true);await unsubmitted.repo.call('fake','start');unsubmitted.clock(unsubmitted.material.closesAt!);questionsOnly(await unsubmitted.repo.call('fake','state'));
// Một submittedAt không có receipt cùng lượt chưa phải bằng chứng chấm xong.
const noReceipt=durable();await noReceipt.repo.call('fake','start');noReceipt.read().work.drafts[0].submittedAt=opened;questionsOnly(await noReceipt.repo.call('fake','state'));
const ungradedPdf=noReceipt.assets.findIndex(asset=>asset.path===noReceipt.exam.sourcePdf!.url.slice(1));noReceipt.assets.splice(ungradedPdf,1);
await assert.rejects(noReceipt.repo.call('fake','state'),/Chưa tải đủ đề/,'submittedAt không receipt không được nới điều kiện PDF');
// Đồng hồ server lùi giữa lưu và nộp: biên nhận vẫn cùng mốc chuẩn hóa với draft.
const clockRollback=durable(),rollbackStart=await clockRollback.repo.call('fake','start');
clockRollback.clock(opened+5000);await clockRollback.repo.call('fake','save',clockRollback.material.lessonCode,rollbackStart.draft!.attemptId,{'mc-1':'D'});
clockRollback.clock(opened+1000);const rollbackSubmitted=await clockRollback.repo.call('fake','submit',clockRollback.material.lessonCode,rollbackStart.draft!.attemptId,{'mc-1':'D'});
assert.equal(rollbackSubmitted.draft!.submittedAt,opened+5000);assert.equal(rollbackSubmitted.receipts[0].submittedAt,rollbackSubmitted.draft!.submittedAt);assert.equal(rollbackSubmitted.receipts[0].score,3);
const rollbackRepeated=await clockRollback.repo.call('fake','submit',clockRollback.material.lessonCode,rollbackStart.draft!.attemptId,{'mc-1':'A'});assert.equal(rollbackRepeated.receipts.length,1);assert.equal(rollbackRepeated.receipts[0].submittedAt,opened+5000);assert.equal(rollbackRepeated.receipts[0].score,3);

// Thiếu một mảnh đề là lỗi riêng câu đó; không được trả URL public/stale để fallback.
const missing=durable(),missingPath=missing.exam.questions[0].sourceContent!.questions[0].path;
missing.assets.splice(missing.assets.findIndex(a=>a.path===missingPath),1);
const missingStart=await missing.repo.call('fake','start');assert.equal(missing.commits(),1);assert.ok(missingStart.draft);
assert.equal(missingStart.exam!.questions[0].sourceContent!.questions[0].privateUnavailable,true);assert.ok(!missingStart.exam!.questions[0].sourceContent!.questions[0].privateUrl);assert.ok(missingStart.exam!.questions[1].sourceContent!.questions[0].privateUrl);
const replacement=fixture().assets.find(a=>a.path===missingPath)!;missing.assets.push(replacement);
const recovered=await missing.repo.call('fake','state');assert.ok(recovered.exam!.questions[0].sourceContent!.questions[0].privateUrl);assert.ok(!recovered.exam!.questions[0].sourceContent!.questions[0].privateUnavailable);
const failedImage=durable(),badImage=failedImage.assets.find(a=>a.path===missingPath)!;failedImage.failed.add(badImage.storage_path);const soft=await failedImage.repo.call('fake','start');assert.equal(soft.exam!.questions[0].sourceContent!.questions[0].privateUnavailable,true);assert.equal(failedImage.commits(),1);

// PDF câu hỏi là điều kiện mở lượt: thiếu manifest/ký lỗi không được commit đồng hồ.
for(const mode of ['missing','signing'] as const){
 const broken=durable(),pdfPath=broken.exam.sourcePdf!.url.slice(1),asset=broken.assets.find(a=>a.path===pdfPath)!;
 if(mode==='missing')broken.assets.splice(broken.assets.indexOf(asset),1);else broken.failed.add(asset.storage_path);
 const response=await createDurableHomeworkHandler(broken.repo)({method:'POST',host:'fake.local',origin:'https://fake.local',secure:true,cookie:'mtm_btvn_demo='+'a'.repeat(64),body:{action:'start',lessonCode:broken.material.lessonCode}});
 assert.equal(response.status,503);assert.deepEqual(response.body,{message:'Chưa tải đủ đề. Đồng hồ chưa chạy. Em thử lại sau.'});assert.equal(broken.commits(),0);assert.equal(broken.read().work.drafts.length,0);
 // Start khôi phục lượt cũ không được nói rằng đồng hồ chưa chạy hoặc tạo thêm lượt.
 const resumed=durable(),active=await resumed.repo.call('fake','start'),activePdf=resumed.exam.sourcePdf!.url.slice(1),activeAsset=resumed.assets.find(a=>a.path===activePdf)!;
 if(mode==='missing')resumed.assets.splice(resumed.assets.indexOf(activeAsset),1);else resumed.failed.add(activeAsset.storage_path);
 const resumeResponse=await createDurableHomeworkHandler(resumed.repo)({method:'POST',host:'fake.local',origin:'https://fake.local',secure:true,cookie:'mtm_btvn_demo='+'a'.repeat(64),body:{action:'start',lessonCode:resumed.material.lessonCode}});
 assert.equal(resumeResponse.status,503);assert.deepEqual(resumeResponse.body,{message:'Chưa tải đủ đề. Lượt đang làm vẫn được giữ. Em thử tải lại.'});assert.equal(resumed.commits(),1);assert.equal(resumed.read().work.drafts.length,1);assert.equal(resumed.read().work.drafts[0].attemptId,active.draft!.attemptId);
}
// Kết quả đã chấm phải ACK được dù PDF đề/lời giải hỏng sau lúc mở lượt.
for(const role of ['questions','solutions'] as const)for(const mode of ['missing','signing'] as const){
 const completed=durable(),start=await completed.repo.call('fake','start');
 const pdf=role==='questions'?completed.exam.sourcePdf!:completed.exam.mtmDocuments!.solutions!,asset=completed.assets.find(a=>a.path===pdf.url.slice(1))!;
 if(mode==='missing')completed.assets.splice(completed.assets.indexOf(asset),1);else completed.failed.add(asset.storage_path);
 const submitted=await completed.repo.call('fake','submit',completed.material.lessonCode,start.draft!.attemptId,{'mc-1':'D'});
 assert.equal(submitted.draft!.submittedAt,opened);assert.equal(submitted.receipts.length,1);assert.equal(submitted.receipts[0].score,3);assert.equal(submitted.solutionsAvailable,true);assert.ok(submitted.exam);assert.ok(submitted.assetWarnings?.length);assert.deepEqual(submitted.assetWarnings,submitted.exam.assetWarnings);
 if(role==='questions'){assert.equal(submitted.exam.sourcePdf,undefined);assert.equal(submitted.exam.mtmDocuments?.questions,undefined);assert.ok(submitted.exam.mtmDocuments?.solutions?.url.startsWith('https://signed.invalid/'),'PDF đề hỏng không được xóa PDF lời giải đã ký');}else assert.equal(submitted.exam.mtmDocuments?.solutions,undefined);
 const readback=await completed.repo.call('fake','state');assert.equal(readback.receipts[0].score,3);assert.ok(readback.assetWarnings?.length);assert.equal(completed.read().work.receipts.length,1);if(role==='questions')assert.ok(readback.exam?.mtmDocuments?.solutions?.url.startsWith('https://signed.invalid/'));
}
const closedReview=durable(true),closedStart=await closedReview.repo.call('fake','start');
closedReview.assets.splice(closedReview.assets.findIndex(asset=>asset.path===closedReview.exam.sourcePdf!.url.slice(1)),1);
const waitingReview=await closedReview.repo.call('fake','submit',closedReview.material.lessonCode,closedStart.draft!.attemptId,{'mc-1':'D'});
questionsOnly(waitingReview);assert.equal(waitingReview.receipts[0].score,3);assert.ok(waitingReview.assetWarnings?.length,'Đã chấm trước giờ đóng vẫn ACK được khi PDF đề hỏng, tiếp tục giấu lời giải');
// Save tới sau deadline tự chấm bản đã lưu, phải trả đề/kết quả đầy đủ thay saveOnly.
const timeout=durable(),timedStart=await timeout.repo.call('fake','start');
await timeout.repo.call('fake','save',timeout.material.lessonCode,timedStart.draft!.attemptId,{'mc-1':'D'});
timeout.assets.splice(0,timeout.assets.length);timeout.clock(timedStart.draft!.deadline);
const timedAck=await timeout.repo.call('fake','save',timeout.material.lessonCode,timedStart.draft!.attemptId,{'mc-1':'A'});
assert.equal(timedAck.saveOnly,undefined);assert.ok(timedAck.exam);assert.equal(timedAck.solutionsAvailable,true);assert.equal(timedAck.receipts[0].score,3);assert.equal(timedAck.receipts[0].timedOut,true);assert.equal(timedAck.draft!.answers['mc-1'],'D');assert.equal(timedAck.exam.sourcePdf,undefined);assert.equal(timedAck.exam.mtmDocuments,undefined);assert.ok(timedAck.assetWarnings?.length);
const partial=fixture(),redacted=concealMonthlySolutions(partial.exam);
const publicOnly=await hydratePrivateAssets(redacted,partial.assets,async path=>'https://signed.invalid/'+path);
assert.ok(publicOnly.mtmDocuments?.questions.url);assert.ok(!publicOnly.mtmDocuments?.solutions);

// Cùng chính sách cho service demo: chỉ đề trước nộp, khóa thật vẫn chấm phía server.
const fake=fixture(),memory=new MemoryHomeworkRepository([{studentCode:'FAKE-DEMO',fullName:'Người học giả',phone:'',className:fake.material.classNames[0]},{studentCode:'FAKE-DEMO-OTHER',fullName:'Người học giả khác',phone:'',className:fake.material.classNames[0]}]);
const service=new HomeworkService(memory,fake.exam,0,'fake',fake.material.lessonCode,()=>opened,[fake.material]),token=service.login({studentCode:'FAKE-DEMO'},'fake');
const demoStart=service.start(token);assert.equal(demoStart.exam!.responseMode,'questions-only');assert.ok(!('answer' in demoStart.exam!.questions[0]));assert.equal(service.submit(token,demoStart.draft!.attemptId,{'mc-1':'D'}).receipts[0].score,3);
const other=service.login({studentCode:'FAKE-DEMO-OTHER'},'fake-other');assert.equal(service.state(other).solutionsAvailable,false);assert.ok(!('answer' in service.state(other).exam!.questions[0]),'Lượt đã chấm của người khác không mở lời giải');
console.log('Đạt chống lộ lời giải: login/state/select/start chỉ đề; receipt đúng lượt, giờ đóng và mốc server; chỉ ký tài sản tham chiếu; thiếu/lỗi ảnh phục hồi; PDF lỗi chặn start mới, thông báo đúng khi khôi phục; giữ PDF lời giải và ACK sau chấm; timeout-save trả kết quả đầy đủ. Dữ liệu giả và transport nội bộ.');
