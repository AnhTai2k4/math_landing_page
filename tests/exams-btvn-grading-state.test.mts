import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pipelineFixture} from './btvn-pipeline-fixture';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
import {SupabaseHomeworkRepository} from '../server/btvn/supabase-repository';
import {requiresManualHomeworkGrade} from '../src/native/homework/grading-policy';
import {pendingHomeworkReceipt,homeworkReceiptScore,createHomeworkResultSummary} from '../src/native/homework/result-summary';

// Nguồn tổng hợp, không dùng phiên hoặc cơ sở dữ liệu học sinh thật.
const fixture=pipelineFixture(),exam=fixture.exam;
const material={...fixture.material,homeworkNote:'Hoàn thành phần tự luận, nộp vở ở buổi sau.'};
assert.equal(requiresManualHomeworkGrade(exam,material),true);
assert.equal(requiresManualHomeworkGrade(exam,{homeworkNote:'Nộp vở'.normalize('NFD')}),true);
assert.equal(requiresManualHomeworkGrade(exam,{homeworkNote:'Xem lại bài giảng'}),false);
assert.equal(requiresManualHomeworkGrade({...exam,questions:[{kind:'self'} as any]}),true);
assert.equal(requiresManualHomeworkGrade({...exam,questions:[{kind:'short',convertedFrom:'essay'} as any]}),false);
let now=Date.parse('2026-10-17T16:00:00+07:00');
const repo=new MemoryHomeworkRepository([{studentCode:'FAKE-GRADE',fullName:'Học sinh thử chấm',phone:'0900000000',className:material.classNames[0]}]);
const service=new HomeworkService(repo,exam,0,'fake',material.lessonCode,()=>now,[material]);
const token=service.login({studentCode:'FAKE-GRADE'},'fake');
let state=service.start(token);now+=1000;
state=service.submit(token,state.draft!.attemptId,{'mc-1':'D','tf-1':[true,false,true,false],'sa-1':'2.5'});
assert.equal(state.receipts[0].score,10);
assert.equal(pendingHomeworkReceipt(state.receipts[0]),true);
assert.equal(state.lessons![0].pendingGrading,true);
assert.equal(repo.get('FAKE-GRADE')!.receipts[0].gradingPending,undefined,'Metadata hiển thị không sửa biên nhận gốc.');
assert.match(createHomeworkResultSummary(state)!,/Tạm tính/);
assert.match(createHomeworkResultSummary(state)!,/chưa được tính vào hạng chính thức/);

const root=process.env.MTM_ROOT!,require=createRequire(join(root,'package.json'));
const {buildSync}=require('esbuild'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const code=buildSync({entryPoints:[join(root,'src/native/homework/HomeworkOverview.tsx')],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',packages:'external',loader:{'.css':'empty'},logLevel:'silent'}).outputFiles[0].text;
const mod={exports:{} as any};new Function('require','module','exports',code)((id:string)=>id.endsWith('.css')?{}:require(id),mod,mod.exports);
const html=renderToStaticMarkup(React.createElement(mod.exports.default,{state,busy:false,onStart(){}}));
assert.match(html,/Tạm tính/);assert.match(html,/chưa tính vào hạng chính thức/);

const raw=repo.get('FAKE-GRADE')!,rawBefore=JSON.stringify(raw);
let officialGrades:Record<string,number>={[state.receipts[0].attemptId]:7.25},monthly=false,commits:any[]=[];
const durable=new SupabaseHomeworkRepository({async rpc(name,args){
 if(name==='mtm_btvn_read')return {data:{revision:0,work:raw,exam,material:monthly?{...material,kind:'kiem-tra-thang',opensAt:now-1000,closesAt:now+60000}:material,lessons:[material],officialGrades},error:null};
 if(name==='mtm_btvn_commit'){commits.push(args);return {data:{ok:true},error:null};}
 throw Error(name);
}},async()=>({}),()=>now);
state=await durable.call('fake','state');
assert.equal(state.receipts[0].score,10,'Giữ điểm tự chấm nguồn.');
assert.equal(state.receipts[0].officialScore,7.25);
assert.equal(state.bestScore,7.25);
assert.equal(pendingHomeworkReceipt(state.receipts[0]),false);
assert.equal(homeworkReceiptScore(state.receipts[0]),'7,25');
assert.ok(!createHomeworkResultSummary(state)!.includes('Tạm tính'));
await durable.call('fake','submit',material.lessonCode,state.draft!.attemptId,{});
assert.ok(commits.every(args=>args.p_receipts.every((r:any)=>r.officialScore===undefined&&r.gradingPending===undefined)));
assert.equal(JSON.stringify(raw),rawBefore);
officialGrades={[state.receipts[0].attemptId]:0};state=await durable.call('fake','state');
assert.equal(state.bestScore,0);assert.equal(homeworkReceiptScore(state.receipts[0]),'0');
monthly=true;state=await durable.call('fake','state');
assert.equal(state.receipts[0].score,null);assert.equal(state.receipts[0].officialScore,undefined);assert.equal(state.bestScore,null);
console.log('Đạt điểm tạm và điểm chính thức: nhãn, phiếu, chấm 0, chỉ ghép response, không sửa nguồn và giữ kín điểm tháng trước đóng.');
