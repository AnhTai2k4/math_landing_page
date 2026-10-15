import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {buildAttendanceRoster} from '../server/btvn/attendance-roster';
import {parseAttendanceSheet} from '../server/btvn/attendance-sheet';
import {createBtvnPublishHandler} from '../server/btvn/publish-handler';
const map={schoolYear:2026,classes:{'2k11 xpt':'2K11 XPT','2k9 9+':'2K9 9+','hsa thứ 5':'2K9 HSA (THỨ 5)','hsa chủ nhật':'2K9 HSA (CN)'}};
const tabs={
 'Thứ 5':[['','TÊN LỚP','15/10'],['Lớp (2K11 XPT)','17h30 - 19h30'],['Em Giả Một','0900000001','C'],['Em Giả Hai','0900000002','M'],['Em Giả Ba','0900000003','L'],['HSA','17h30 - 19h30'],['Em Giả Bốn (online)','0900000004','ON'],['Em Giả Bốn','0900000004',''],['Em Giả Nghỉ (tạm nghỉ)','0900000005','C']],
 'Chủ nhật':[['','TÊN LỚP','18/10'],['Lớp HSA (2K9)','8h - 10h'],['Em Giả Sáu','0900000006','C']],
};
const noKnown=buildAttendanceRoster(tabs,map);assert.equal(noKnown.rows.length,5);assert.equal(noKnown.skippedMixedBlocks,0);
assert.equal(buildAttendanceRoster({'Thứ 5':[['HSA'],['Em Giả Chín','900000009']]},map).rows[0].phone,'0900000009');
const roster=buildAttendanceRoster(tabs,map,{'2K10':['0900000001','0900000002','0900000003']});
assert.equal(roster.skippedMixedBlocks,1);assert.deepEqual(roster.rows.map(r=>r.label),['2K9 HSA (THỨ 5)','2K9 HSA (CN)']);assert.equal(roster.rows[1].phone,'0900000006');
assert.equal(buildAttendanceRoster(tabs,map,{'2K11':['0900000001','0900000002'],'2K10':['0900000003']}).skippedMixedBlocks,0);
assert.equal(buildAttendanceRoster(tabs,map,{'2K10':['0900000001','0900000002']}).skippedMixedBlocks,0);
const due=parseAttendanceSheet(tabs,map);assert.equal(due.pending.length,0);assert(due.sessions.some(s=>s.label==='2K9 HSA (CN)'));
let calls:any[]=[];const secret='local-fake-secret-'.repeat(3);
const handler=createBtvnPublishHandler({async rpc(action,payload){calls.push({action,payload});return {ok:true,applied:true};},async upload(){assert.fail('Không upload');}},secret);
const req=(body:any,key=secret)=>handler(new Request('https://fake.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':key},body:JSON.stringify(body)}));
assert.equal((await req({action:'sync_attendance',rows:roster.rows})).status,200);
assert.deepEqual(calls.pop(),{action:'sync_attendance',payload:{p_payload:{rows:roster.rows},p_apply:false}});
assert.equal((await req({action:'sync_due',sessions:due.sessions,apply:true})).status,200);assert.equal(calls.pop().payload.p_apply,true);
assert.equal((await req({action:'support_report',since:'2026-10-15T00:00:00Z'})).status,200);assert.equal(calls.pop().payload.p_since,'2026-10-15T00:00:00Z');
for(const bad of [
 {action:'sync_attendance',rows:[]},{action:'sync_attendance',rows:Array(10001).fill(roster.rows[0])},
 ...[{label:'Tên riêng 0900000000'},{phone:900000000},{fullName:null},{source:'\nsecret'},{extra:1}].map(x=>({action:'sync_attendance',rows:[{...roster.rows[0],...x}]})),
 {action:'sync_attendance',rows:roster.rows,apply:'true'},
 {action:'sync_due',sessions:Array(2001).fill(due.sessions[0])},
 {action:'sync_due',sessions:[due.sessions[0],due.sessions[0]]},
 ...[{label:'bad'},{startsAt:'2026-02-30T17:30:00+07:00'},{attendees:[{name:'Giả',phone:'0900000001',status:'bad'}]},{attendees:Array(1001).fill(due.sessions[0].attendees[0])}].map(x=>({action:'sync_due',sessions:[{...due.sessions[0],...x}]})),
 {action:'support_report',since:'yesterday'},{action:'support_report',since:'2026-02-30T00:00:00Z'},
 {action:'support_report',since:'2026-10-15T24:00:00Z'},
 {action:'support_report',since:'2026-10-15T00:00:00Z',sql:'bad'},
]){assert.equal((await req(bad)).status,422);assert.equal(calls.length,0);}
assert.equal((await req({action:'sync_attendance',rows:roster.rows},'wrong')).status,401);assert.equal(calls.length,0);
const throwing=createBtvnPublishHandler({async rpc(){throw Error('PRIVATE_NAME 0900000000');},async upload(){}},secret);
const rejected=await throwing(new Request('https://fake.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify({action:'support_report',since:'2026-10-15T00:00:00Z'})}));assert.equal(await rejected.text(),'{"error_code":"PUBLISH_REJECTED"}');
// Port SQL giả: kiểm SET LOCAL ROLE và JSON object, không kết nối DB.
const {createPublishPort}=await import(pathToFileURL(join(process.env.MTM_ROOT!,'supabase/functions/mtm-btvn-publish/port.mjs')).href);
let statements:any[]=[];const sql:any={json:(v:any)=>({json:v}),begin:async(fn:any)=>fn(async(parts:any,...values:any[])=>{statements.push({query:parts.join('?'),values});return [{result:{ok:true}}];})};
const port=createPublishPort(sql,{});
for(const [action,fn,payload] of [
 ['sync_attendance','mtm_btvn_sync_attendance_roster',{p_payload:{rows:roster.rows},p_apply:true}],
 ['sync_due','mtm_btvn_sync_due',{p_payload:{sessions:[]},p_apply:false}],
 ['support_report','mtm_btvn_support_report',{p_since:'2026-10-15T00:00:00Z'}],
] as const){statements=[];await port.rpc(action,payload);assert.equal(statements[0].query,'SET LOCAL ROLE service_role');assert(statements[1].query.includes(fn));if(action!=='support_report')assert.deepEqual(statements[1].values[0],{json:payload.p_payload});}
statements=[];await port.rpc('lookup',{lesson_key:'fake'});assert.equal(statements[0].query,'SET LOCAL ROLE mtm_btvn_publisher');await assert.rejects(port.rpc('arbitrary',{}));
console.log('ĐẠT đợt 21: roster, HSA, lẫn khoá, Edge actions/validation/auth, port SQL giả.');
