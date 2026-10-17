import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readAttendance,nextActualClass,attendanceIdentityKey,type AttendanceConfig} from '../server/btvn/attendance-reader';
import {SupabaseHomeworkRepository,type DurableSnapshot} from '../server/btvn/supabase-repository';
import {createDurableHomeworkHandler} from '../server/btvn/durable-http';
import {createHomeworkHandler} from '../supabase/functions/mtm-homework-access/handler';
import {homeworkTitle,displayClassName,isDemoVideo} from '../src/native/homework/presentation';
import examJson from '../server/btvn/demo-exam.json';
import type {PracticeExam} from '../src/native/exams/data';
import {HomeworkService} from '../server/btvn/service';
import {MemoryHomeworkRepository} from '../server/btvn/repository';
const exam=examJson as PracticeExam;
const config:AttendanceConfig={tab:'Thứ 2 giả',blocks:[{key:'ca-1730',firstRow:1,lastRow:4,startsAt:'17:30',nameColumn:0,phoneColumn:1,identityColumn:2,dateColumns:[{column:3,date:'2026-10-12'},{column:4,date:'2026-10-19'}]}]};
const rows=[['Họ tên','SĐT','Nguồn','12/10','19/10'],['Giả Một','0900000001','fake-1','C',''],['Giả Hai','0900000002','fake-2','NGHỈ HẲN',''],['Giả Ba','0900000003','fake-3','ĐỔI LỊCH HỌC SANG 235 TỪ 7/9',''],['Giả Bốn','0900000004','','C','']];
const read=readAttendance(rows,config);
assert.equal(read.slots.length,2);assert.equal(read.pending.length,4);
assert.equal(nextActualClass(read.slots,'fake-1',Date.parse('2026-10-14T00:00:00+07:00'))?.startsAt,Date.parse('2026-10-19T17:30:00+07:00'));
assert.equal(nextActualClass(read.slots,'other',0),null);
const plain=readAttendance([['Tên','SĐT','19/10'],['Giả Một','0900000001','']],{tab:'Thứ 2 giả',identityMap:{[attendanceIdentityKey('Giả Một','0900000001')]:'fake-1'},blocks:[{key:'ca',firstRow:1,lastRow:1,startsAt:'17:30',nameColumn:0,phoneColumn:1,dateColumns:[{column:2,date:'2026-10-19'}]}]});
assert.equal(plain.slots[0].sourceIdentity,'fake-1');
// Cùng lớp nhưng hai ca kế tiếp khác nhau: không dùng hạn của lớp.
const now=Date.parse('2026-10-15T18:00:00+07:00');
const memory=new MemoryHomeworkRepository([{studentCode:'fake-A',fullName:'Giả A',phone:'0900000001',className:'Cùng lớp',nextActualClassAt:now-1000},{studentCode:'fake-B',fullName:'Giả B',phone:'0900000002',className:'Cùng lớp',nextActualClassAt:now+1000}]);
const svc=new HomeworkService(memory,exam,0,'class','lesson',()=>now);
for(const [code,late] of [['fake-A',true],['fake-B',false]] as const){const token=svc.login({studentCode:code},code);const started=svc.start(token);const sent=svc.submit(token,started.draft!.attemptId,{});assert.equal(sent.receipts[0].late,late);}
assert.throws(()=>readAttendance(rows,{...config,blocks:[{...config.blocks[0],dateColumns:[{column:3,date:'2026-02-30'}]}]}));
const material={lessonCode:'buoi-gia',date:'2026-10-14',title:'Hàm số và đồ thị',classNames:['Lớp giả'],videoId:'abcdefghijk',materialUrl:null,handoutUrl:null,homeworkUrl:null};
let snapshot:DurableSnapshot={revision:0,work:{student:{studentCode:'',fullName:'Giả Một',phone:'',className:'Lớp giả',nextActualClassAt:Date.parse('2026-10-16T17:30:00+07:00')},drafts:[],receipts:[]},exam,material,lessons:[{...material,dueAt:null,bestScore:null,late:null,submittedAt:null,available:true} as any]};
const session='a'.repeat(64),calls:string[]=[];let conflicts=1,commits=0;
const repo=new SupabaseHomeworkRepository({async rpc(name,args){
  calls.push(name);
  if(name==='mtm_btvn_read')return {data:structuredClone(snapshot),error:null};
  if(name==='mtm_btvn_commit'){
    if(conflicts-->0)return {data:{ok:false},error:null};
    if(args.p_revision!==snapshot.revision)return {data:{ok:false},error:null};
    snapshot={...snapshot,revision:snapshot.revision+1,work:{...snapshot.work,drafts:args.p_drafts as any,receipts:args.p_receipts as any}};commits++;return {data:{ok:true},error:null};
  }
  return {data:{ok:true},error:null};
}},async body=>{calls.push(String(body.operation));return body.operation==='resolve'?{ok:true,challenge:'b'.repeat(64)}:{ok:true,session};},()=>Date.parse('2026-10-15T10:00:00+07:00'));
assert.equal(await repo.login({studentCode:'HS-'+'c'.repeat(32)}),session);assert.deepEqual(calls.slice(0,2),['resolve','confirm']);
assert.equal(await repo.login({fullName:'Giả Một',phone:'0900000001',className:'Lớp giả'}),session);assert.ok(calls.includes('forgot'));
await assert.rejects(()=>repo.login({studentCode:'bad',phone:'0900000001'} as any));
const state=await repo.call(session,'start','buoi-gia');assert.equal(state.demo,false);assert.equal(state.attemptsUsed,1);assert.equal(commits,1);assert.equal(snapshot.work.drafts.length,1);
const again=await repo.call(session,'start','buoi-gia');assert.equal(again.draft?.attemptId,state.draft?.attemptId);assert.equal(snapshot.work.drafts.length,1);
assert.ok(state.exam);assert.equal(homeworkTitle(state),state.exam.title);assert.ok(isDemoVideo('abcdefghijk'));assert.ok(!isDemoVideo('real-video1'));
assert.equal(displayClassName({...state,demo:true,className:'LOP-TEST-12'}),'Lớp học thử');
const http=createDurableHomeworkHandler(repo);
assert.equal((await http({method:'POST',host:'test.invalid',origin:'https://evil.invalid',secure:true,body:{action:'state'}})).status,403);
assert.equal((await http({method:'POST',host:'test.invalid',origin:'https://test.invalid',secure:true,cookie:'mtm_btvn_demo='+session,body:{action:'start',lessonCode:'buoi-gia',score:10}})).status,400);
assert.equal((await http({method:'POST',host:'test.invalid',origin:'https://test.invalid',secure:true,cookie:'mtm_btvn_demo='+session,body:{action:'state'}})).status,200);
// Edge thật (mã nguồn) + transport giả: limiter dùng chung cả payload sai.
let hits=0;const routes:string[]=[];
const edge=createHomeworkHandler({publishableKey:'fake-key',origins:['https://test.invalid'],networkKey:async()=> 'd'.repeat(64),rpc:async(name)=>{routes.push(name);return {data:name==='mtm_btvn_gateway_rate'?{ok:++hits<=5}:{ok:true,session},error:null};},download:async()=>new Blob()});
const request=(body:unknown)=>edge(new Request('https://edge.invalid',{method:'POST',headers:{Origin:'https://test.invalid',apikey:'fake-key','Content-Type':'application/json'},body:JSON.stringify(body)}));
for(let i=0;i<5;i++)assert.equal((await request(i%2?{operation:'forgot',fullName:'Giả',phone:'0900000001',className:'Giả'}:{operation:'resolve',code:'not-code'})).status,i%2?200:400);
assert.equal((await request({operation:'forgot',fullName:'Giả',phone:'0900000001',className:'Giả'})).status,429);
assert.equal(routes.filter(x=>x==='mtm_btvn_gateway_rate').length,6);
const root=process.env.MTM_ROOT??process.cwd();
const sql=readFileSync(root+'/supabase/migrations-pending/202610150005_btvn.sql','utf8');assert.match(sql,/for update/);assert.match(sql,/revision=p_revision/);assert.ok(!sql.includes('create or replace function public.mtm_hw_resolve_code'));
console.log('Đạt đợt 5: ca theo người/ghi chú cần xác minh, CAS xung đột/lượt dở, hai cổng + limiter chung, cookie/origin/payload, tiêu đề không mã. SQL chưa chạy.');
