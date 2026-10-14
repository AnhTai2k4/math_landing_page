// TẤT CẢ dữ liệu do test sinh. DB RAM, không mạng/credential/roster thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {makeSyncPayload,digest,codeCsv} from './btvn-roster-sync-core.mjs';
import {createPublishPort} from '../supabase/functions/mtm-btvn-publish/port.mjs';
const {PGlite}=await import(pathToFileURL('T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),checks=[];
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const owner='11111111-1111-4111-8111-111111111111',protectedIds=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const rpc=async(name,payload,apply=false,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query(`select public.${name}($1,$2) result`,[name==='mtm_btvn_sync_roster'?JSON.stringify(payload):payload,apply])).rows[0].result;});
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
  for(const f of ['202610150005_btvn.sql','202610150006_btvn_pipeline.sql','202610150007_btvn_roster_sync.sql','202610150008_btvn_homework_title.sql','202610150009_btvn_classes_with_lessons.sql','202610150009_1_btvn_gateway_rate_hotfix.sql','202610150010_btvn_entry.sql'])await db.exec(readFileSync('supabase/migrations-pending/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into public.mtm_exam_admins(user_id) values($1)',[owner]);
  const cls=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'Lớp fixture giữ nguyên',12) returning id",[owner]);
  for(const [i,id] of protectedIds.entries())await db.query("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,$3,'GIẢ cũ','GIẢ','GIẢ',$4)",[id,owner,cls,'MTM-'+String(i+1).padStart(12,'0')]);
  await db.query('insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,$2,$3)',[owner,bundle.sheetId,protectedIds]);
 });

 bundle.students[0].parentName='Phụ huynh GIẢ A';bundle.students[1].parentName='Phụ huynh GIẢ B';
 let result;
 await check('Đồng bộ tên PH, dry-run rollback và nạp lại giữ mã/UUID',async()=>{
  const p=makeSyncPayload(bundle,config);assert.equal(p.students[0].parentName,bundle.students[0].parentName);
  const dry=await rpc('mtm_btvn_sync_roster',p);assert.equal(dry.summary.added,2);assert.equal(await scalar('select count(*)::int from mtm_hw_private.students'),2);
  result=await rpc('mtm_btvn_sync_roster',p,true);const codes=await scalar('select jsonb_agg(to_jsonb(c) order by id) from mtm_hw_private.codes c');
  bundle.students[0].parentName='Phụ huynh GIẢ đổi';const again=await rpc('mtm_btvn_sync_roster',makeSyncPayload(bundle,config),true);
  assert.equal(again.summary.updated,1);assert.equal(again.summary.codesAdded,0);assert.equal(again.students[0].studentId,result.students[0].studentId);
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(c) order by id) from mtm_hw_private.codes c'),codes);
  assert.equal(await scalar('select parent_name from mtm_hw_private.students where id=$1',[result.students[0].studentId]),bundle.students[0].parentName);
  assert.ok(!codeCsv(again.students).includes('parentName'));
 });
 const forgot=(name,phone,cls)=>scalar('select public.mtm_btvn_forgot($1,$2,$3)',[name,phone,cls]);
 let session;
 await check('Tên HS + SĐT HS, tên PH + SĐT PH, tên PH + SĐT HS',async()=>{
  await db.query('update mtm_hw_private.students set parent_phone=$1 where id=$2',['0980000001',result.students[0].studentId]);
  for(const [name,phone] of [[bundle.students[0].fullName,bundle.students[0].phone],[bundle.students[0].parentName,'0980000001'],[bundle.students[0].parentName,bundle.students[0].phone]]){
   const r=await forgot(name,phone,'2K9 9+');assert.equal(r.ok,true);assert.equal(r.classMismatch,false);session=r.session;
  }
 });
 await check('Sai lớp nhưng duy nhất, chuẩn hoá tên và cờ đúng',async()=>{
  const r=await forgot('  PHỤ HUYNH   GIẢ ĐỔI  ','+84 980000001','2K9 8+');assert.equal(r.ok,true);assert.equal(r.classMismatch,true);
  assert.equal(await scalar('select mtm_hw_private.btvn_student($1)',[r.session]),result.students[0].studentId);
 });
 await check('Hai con cùng PH cùng lớp bị từ chối; tên con xác định đúng con',async()=>{
  await db.query('update mtm_hw_private.students set class_id=$1,parent_name=$2,parent_phone=$3 where id=$4',[result.classes.find(c=>c.label==='2K9 9+').id,bundle.students[0].parentName,'0980000001',result.students[1].studentId]);
  assert.deepEqual(await forgot(bundle.students[0].parentName,'0980000001','2K9 9+'),{ok:false});
  assert.deepEqual(await forgot(bundle.students[0].parentName,'0980000001','Lớp khác GIẢ'),{ok:false});
  const r=await forgot(bundle.students[1].fullName,'0980000001','2K9 9+');assert.equal(r.ok,true);assert.equal(await scalar('select mtm_hw_private.btvn_student($1)',[r.session]),result.students[1].studentId);
 });
 await check('SĐT sai, học sinh inactive, lớp inactive không tiết lộ dữ liệu',async()=>{
  assert.deepEqual(await forgot(bundle.students[0].fullName,'0990000099','2K9 9+'),{ok:false});
  await db.query('update mtm_hw_private.students set active=false where id=$1',[result.students[0].studentId]);
  assert.deepEqual(await forgot(bundle.students[0].fullName,bundle.students[0].phone,'2K9 9+'),{ok:false});
  await db.query('update mtm_hw_private.students set active=true where id=$1',[result.students[0].studentId]);
  await db.query('update mtm_hw_private.classes set active=false where label=$1',['2K9 9+']);
  assert.deepEqual(await forgot(bundle.students[0].fullName,bundle.students[0].phone,'2K9 9+'),{ok:false});
  await db.query('update mtm_hw_private.classes set active=true where label=$1',['2K9 9+']);
 });
 await check('Lớp chưa có bài trả snapshot rỗng, không tạo work',async()=>{
  const r=await scalar('select public.mtm_btvn_read($1)',[session]);assert.deepEqual(r.lessons,[]);assert.equal(r.exam,undefined);assert.equal(r.material,undefined);assert.equal(r.work.student.className,'2K9 9+');
  assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_work'),0);
 });
 await check('Danh sách đầy đủ lớp active dù chưa có bài',async()=>{
  await db.query("insert into mtm_hw_private.classes(owner_id,label,grade,active) values($1,'Lớp tắt GIẢ',12,false)",[owner]);
  const r=await scalar('select public.mtm_btvn_classes()');assert.deepEqual(r.sort(),['2K9 8+','2K9 9+','Lớp fixture giữ nguyên'].sort());
 });
 await check('Không được đọc buổi lớp khác; phiên sai bị chặn',async()=>{
  await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values('buoi-khac',$1,$2,'{}','{}',true,'da_dang')",[owner,[result.classes.find(c=>c.label==='2K9 8+').id]]);
  await assert.rejects(scalar("select public.mtm_btvn_read($1,'buoi-khac')",[session]),e=>e.code==='42501');
  await assert.rejects(scalar('select public.mtm_btvn_read($1)',['0'.repeat(64)]),e=>e.code==='42501');
 });
 await check('Một ứng viên ở lớp đã chọn được ưu tiên khi tổng có hai',async()=>{
  await db.query('update mtm_hw_private.students set class_id=$1 where id=$2',[result.classes.find(c=>c.label==='2K9 8+').id,result.students[1].studentId]);
  const r=await forgot(bundle.students[0].parentName,'0980000001','2K9 9+');assert.equal(r.ok,true);assert.equal(r.classMismatch,false);assert.equal(await scalar('select mtm_hw_private.btvn_student($1)',[r.session]),result.students[0].studentId);
  assert.deepEqual(await forgot(bundle.students[0].parentName,'0980000001','Lớp khác GIẢ'),{ok:false});
 });
 await check('Có bài vẫn giữ tên đề, ngày theo lớp, phạm vi và điểm của hàm 008',async()=>{
  await db.query("update mtm_hw_private.btvn_lessons set class_ids=$1,material=$2,exam=$3 where code='buoi-khac'",[[result.classes.find(c=>c.label==='2K9 9+').id],JSON.stringify({lessonCode:'buoi-khac',date:'2026-10-14',classDates:{'2K9 9+':'2026-10-15'}}),JSON.stringify({title:'Đề GIẢ'})]);
  const r=await scalar('select public.mtm_btvn_read($1)',[session]);assert.equal(r.exam.title,'Đề GIẢ');assert.equal(r.material.date,'2026-10-15');assert.equal(r.lessons[0].homeworkTitle,'Đề GIẢ');assert.equal(r.lessons[0].bestScore,null);assert.equal(r.work.student.className,'2K9 9+');assert.equal(r.work.student.phone,'');
 });
 await check('Anon, authenticated, publisher không đọc cột parent_name',async()=>{
  for(const role of ['anon','authenticated','mtm_btvn_publisher']){
   assert.equal(await scalar("select has_column_privilege($1,'mtm_hw_private.students','parent_name','select')",[role]),false);
   await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role '+role);await tx.query('select parent_name from mtm_hw_private.students');}),e=>e.code==='42501');
  }
 });
 await check('Migration 010 giữ nguyên hotfix 120 lượt/15 phút theo mạng',async()=>{
  for(let i=0;i<122;i++)assert.equal((await scalar('select public.mtm_btvn_gateway_rate($1)',['b'.repeat(64)])).ok,i<120);
 });
 mkdirSync('.qa-temp/dot-12',{recursive:true});writeFileSync('.qa-temp/dot-12/sql-results.json',JSON.stringify({passed:checks.length,checks,realData:false,network:false},null,2));
}finally{await db.close();}
