// TẤT CẢ dữ liệu do test sinh. DB RAM, không mạng/credential/roster thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {makeSyncPayload,digest,codeCsv} from './btvn-roster-sync-core.mjs';
import {createPublishPort} from '../supabase/functions/mtm-btvn-publish/port.mjs';
const {PGlite}=await import(pathToFileURL(join(process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules','@electric-sql/pglite/dist/index.js')).href);
const db=new PGlite(),checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const owner='11111111-1111-4111-8111-111111111111',protectedIds=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const rpc=async(name,payload,apply=false,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query(`select public.${name}($1,$2) result`,[JSON.stringify(payload),apply])).rows[0].result;});
const fake=(n,cls='2K9 9+')=>({studentCode:'HS-'+String(n).padStart(32,'0'),fullName:'Danh tính GIẢ '+n,phone:'090000000'+n,parentPhone:'',cohort:'2K9',className:cls});
const bundle={sheetId:'fake-sheet-round10',registry:{fake1:fake(1).studentCode,fake2:fake(2).studentCode},students:[fake(1),fake(2,'2K9 8+')],excluded:3};
const config={legacyReconciled:true,classGrades:{'2K9 9+':12,'2K9 8+':12}};
const payload=makeSyncPayload(bundle,config);
try{
 await check('Migration nguyên văn, hotfix hiện hành, scope giả và 2 fixture bảo vệ',async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
  for(const f of ['202610150005_btvn.sql','202610150006_btvn_pipeline.sql','202610150007_btvn_roster_sync.sql','202610150008_btvn_homework_title.sql','202610150009_btvn_classes_with_lessons.sql','202610150009_1_btvn_gateway_rate_hotfix.sql','202610150010_btvn_entry.sql','202610150011_btvn_due_scorebook.sql'])await db.exec(readFileSync('supabase/migrations-pending/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into public.mtm_exam_admins(user_id) values($1)',[owner]);
  const cls=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'Lớp fixture giữ nguyên',12) returning id",[owner]);
  for(const [i,id] of protectedIds.entries())await db.query("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,$3,'GIẢ cũ','GIẢ','GIẢ',$4)",[id,owner,cls,'MTM-'+String(i+1).padStart(12,'0')]);
  await db.query('insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,$2,$3)',[owner,bundle.sheetId,protectedIds]);
 });
 const result=await rpc('mtm_btvn_sync_roster',payload,true);
 const sid=result.students[0].studentId,cls=result.classes.find(c=>c.label==='2K9 9+').id;
 await db.query("update mtm_hw_private.students set parent_phone='0980000001' where id=$1",[sid]);
 await db.query(`insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values('due-test',$1,$2,$3,$4,true,'da_dang')`,[owner,[cls],JSON.stringify({date:'2026-10-14',classDates:{'2K9 9+':'2026-10-15'}}),JSON.stringify({title:'Bài GIẢ'})]);
 await db.query("insert into mtm_hw_private.btvn_work(student_id,lesson_code,receipts) values($1,'due-test',$2)",[sid,JSON.stringify([{score:7.5,submittedAt:Date.parse('2026-10-16T18:00:00+07:00'),late:null}])]);
 const session=(label,date,status,phone='0980000001',name='Tên viết khác')=>({classKey:label,label,startsAt:date+'T17:30:00+07:00',sourceIdentity:'diem-danh:'+date+':'+label,attendees:[{name,phone,status}]});
 const p={sessions:[session('2K9 9+','2026-10-16','L'),session('2K9 8+','2026-10-17','ON')]};
 const readWork=()=>scalar("select to_jsonb(w) from mtm_hw_private.btvn_work w where student_id=$1 and lesson_code='due-test'",[sid]);
 await check('Dry-run rollback hoàn toàn, gồm revision/receipts/hạn',async()=>{
  const before=await readWork();const r=await rpc('mtm_btvn_sync_due',p);assert.equal(r.actualDues,1);assert.deepEqual(await readWork(),before);
 });
 await check('Khớp SĐT PH, xen lịch 8+/9+, vắng chuyển hạn, tính lại muộn',async()=>{
  const r=await rpc('mtm_btvn_sync_due',p,true);assert.equal(r.matchedStudents,1);assert.equal(r.receiptsChanged,1);
  const w=await readWork();assert.equal(Date.parse(w.next_actual_class_at),Date.parse('2026-10-17T17:30:00+07:00'));assert.equal(w.receipts[0].late,false);assert.match(w.due_source_identity,/2026-10-17/);
 });
 await check('SĐT HS và C/M, ngày theo lớp loại buổi cùng ngày',async()=>{
  const r=await rpc('mtm_btvn_sync_due',{sessions:[session('2K9 9+','2026-10-15','C',bundle.students[0].phone),session('2K9 9+','2026-10-16','M',bundle.students[0].phone)]},true);
  assert.equal(r.actualDues,1);const w=await readWork();assert.equal(w.receipts[0].late,true);assert.equal(Date.parse(w.next_actual_class_at),Date.parse('2026-10-16T17:30:00+07:00'));
 });
 await check('Hạn dự kiến tương lai, không coi ô trống hoặc L/K là thực học',async()=>{
  await rpc('mtm_btvn_sync_due',{sessions:[session('2K9 9+','2026-10-16','K'),session('2K9 8+','2099-10-17','')]},true);
  const w=await readWork();assert.equal(w.next_actual_class_at,null);assert.equal(w.receipts[0].late,null);assert.equal(Date.parse(w.expected_due_at),Date.parse('2099-10-17T17:30:00+07:00'));
 });
 await check('Mơ hồ bỏ qua, tên chuẩn hóa chỉ phân xử khi trùng SĐT',async()=>{
  await db.query("update mtm_hw_private.students set parent_phone='0980000001' where id=$1",[result.students[1].studentId]);
  let r=await rpc('mtm_btvn_sync_due',p);assert.equal(r.unmatched,2);assert.equal(r.matchedStudents,0);
  r=await rpc('mtm_btvn_sync_due',{sessions:[session('2K9 9+','2026-10-16','C','0980000001',bundle.students[0].fullName.toUpperCase())]});assert.equal(r.matchedStudents,1);assert.equal(r.unmatched,0);
 });
 await check('Chỉ service_role, security definer, search_path đóng',async()=>{
  for(const role of ['anon','authenticated','mtm_btvn_publisher']){
   await assert.rejects(rpc('mtm_btvn_sync_due',p,false,role),e=>e.code==='42501');
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query("select public.mtm_btvn_scorebook('2026-10-15',false)");}),e=>e.code==='42501');
  }
  assert.equal(await scalar("select prosecdef from pg_proc where proname='mtm_btvn_sync_due'"),true);
 });
 await check('RPC học sinh trả expectedDueAt, đồng bộ lặp không tăng revision',async()=>{
  const pp={sessions:[session('2K9 8+','2099-10-17','',bundle.students[0].phone)]};
  await rpc('mtm_btvn_sync_due',pp,true);const before=await readWork();await rpc('mtm_btvn_sync_due',pp,true);assert.deepEqual(await readWork(),before);
  const login=await scalar('select public.mtm_btvn_forgot($1,$2,$3)',[bundle.students[0].fullName,bundle.students[0].phone,'2K9 9+']);
  const state=await scalar('select public.mtm_btvn_read($1)',[login.session]);assert.equal(state.lessons[0].expectedDueAt,Date.parse('2099-10-17T17:30:00+07:00'));
 });
 await check('Lớp XPT không lấy hạn lớp 8+/9+ cùng khóa',async()=>{
  const xpt=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 XPT',12) returning id",[owner]);
  await db.query('update mtm_hw_private.students set class_id=$1 where id=$2',[xpt,sid]);
  await db.query("update mtm_hw_private.btvn_lessons set class_ids=$1,material='{\"date\":\"2026-10-15\"}' where code='due-test'",[[xpt]]);
  await rpc('mtm_btvn_sync_due',{sessions:[session('2K9 8+','2026-10-16','C',bundle.students[0].phone),session('2K9 XPT','2026-10-18','C',bundle.students[0].phone)]},true);
  assert.equal(Date.parse((await readWork()).next_actual_class_at),Date.parse('2026-10-18T17:30:00+07:00'));
  await db.query('update mtm_hw_private.students set class_id=$1 where id=$2',[cls,sid]);
  await db.query("update mtm_hw_private.btvn_lessons set class_ids=$1 where code='due-test'",[[cls]]);
 });
 await check('Sổ điểm loại qa: và trước 15/10, giữ cả HS chưa tạo work',async()=>{
  await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values('old',$1,$2,'{\"date\":\"2026-10-14\"}','{}',true,'da_dang')",[owner,[cls]]);
  await db.query("update mtm_hw_private.btvn_lessons set class_ids=$1 where code='due-test'",[result.classes.map(c=>c.id)]);
  const rows=await scalar("select public.mtm_btvn_scorebook('2020-01-01',false)");assert.equal(rows.length,2);assert.ok(rows.every(r=>r.lessonCode==='due-test'));assert.ok(rows.some(r=>r.fullName===bundle.students[0].fullName));
  assert.deepEqual(rows.find(r=>r.studentId===result.students[1].studentId).receipts,[]);
  assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_work where student_id=$1',[result.students[1].studentId]),0);
  await db.query("update mtm_hw_private.students set source_identity='qa:fixture' where id=$1",[sid]);
  const remaining=await scalar("select public.mtm_btvn_scorebook('2026-10-15',false)");assert.equal(remaining.length,1);assert.equal(remaining[0].studentId,result.students[1].studentId);
 });
 writeFileSync('.qa-temp/dot-13/sql-results.json',JSON.stringify({passed:checks.length,checks,realData:false,network:false},null,2));
}finally{await db.close();}
