// PostgreSQL WASM trong RAM, dữ liệu tổng hợp; không mạng, credential hoặc DB thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {makeSyncPayload} from './btvn-roster-sync-core.mjs';
const toolsDir=process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules';
const {PGlite}=await import(pathToFileURL(join(toolsDir,'@electric-sql/pglite/dist/index.js')).href);
const {fuzzystrmatch}=await import(pathToFileURL(join(toolsDir,'@electric-sql/pglite/dist/contrib/fuzzystrmatch.js')).href);
const db=new PGlite({extensions:{fuzzystrmatch}}),checks=[];
const out='.qa-temp/ho-so',migration='202610170025_btvn_public_profile.sql';
mkdirSync(out,{recursive:true});
const owner='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999';
const protectedIds=['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333'];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const rpc=(name,args,role='service_role',principal=null)=>db.transaction(async tx=>{
 await tx.exec('set local role '+role);
 if(principal)await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[principal]);
 return (await tx.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(x=>name==='mtm_btvn_photo_status'?x:x&&typeof x==='object'?JSON.stringify(x):x))).rows[0].result;
});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const fake=n=>({studentCode:'HS-'+n.toString(16).padStart(32,'0'),fullName:'Học sinh tổng hợp '+n,phone:'090000'+String(n).padStart(4,'0'),parentPhone:'',cohort:'2K9',className:'2K9 9+',school:'Trường đồng bộ '+n});
const students=Array.from({length:15},(_,i)=>fake(i+1));
const bundle={sheetId:'fixture-public-profile',students,registry:Object.fromEntries(students.map(s=>[s.fullName,s.studentCode]))};
const config={legacyReconciled:true,classGrades:{'2K9 9+':12}};
const payload=makeSyncPayload(bundle,config);
const jpeg=(w=192,h=192)=>Buffer.from([255,216,255,192,0,17,8,h>>8,h&255,w>>8,w&255,3,1,34,0,2,17,1,3,17,1,255,218,0,12,3,1,0,2,17,3,17,0,63,0,18,52,255,217]);
const photo=bytes=>'data:image/jpeg;base64,'+bytes.toString('base64');
const PHOTO=photo(jpeg());
let ids,cid,session;
try{
 await check('Áp toàn bộ nguồn SQL cũ, giữ ảnh legacy, rồi áp migration mới trong RAM',async()=>{
  await db.exec(`create schema extensions;create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const dir of ['supabase/migrations','supabase/migrations-pending']){
   const files=readdirSync(dir).filter(f=>f.endsWith('.sql')&&f!==migration).sort((a,b)=>{
    const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));
   });
   for(const file of files)await db.exec(readFileSync(dir+'/'+file,'utf8').replace(/^\uFEFF/,''));
  }
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.query('insert into public.mtm_exam_admins(user_id) values($1),($2)',[owner,other]);
  const fixtureClass=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'Lớp bảo vệ tổng hợp',12) returning id",[owner]);
  for(const [i,id] of protectedIds.entries())await db.query("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,$3,'Hồ sơ bảo vệ','Trường tổng hợp','Tổng hợp',$4)",[id,owner,fixtureClass,'MTM-'+String(i+1).padStart(12,'0')]);
  await db.query('insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,$2,$3)',[owner,bundle.sheetId,protectedIds]);
  const seeded=await rpc('mtm_btvn_sync_roster',[payload,true]);
  ids=seeded.students.map(s=>s.studentId);cid=seeded.classes[0].id;
  await db.query('update mtm_hw_private.students set school=$1 where id=$2',['Trường lưu gốc',ids[1]]);
  await db.query("insert into mtm_hw_private.student_appearance(student_id,avatar,photo) values($1,'spark',$2)",[ids[0],'data:image/jpeg;base64,/9j/'+'A'.repeat(48000)]);
  await db.query("insert into mtm_hw_private.student_appearance(student_id,school,avatar) values($1,'Trường tự nhập','prism')",[ids[2]]);
  await db.exec(readFileSync('supabase/migrations-pending/'+migration,'utf8'));
 });
 await check('Import chỉ bổ sung trường trống, bảo vệ trường gốc và trường học sinh tự nhập',async()=>{
  for(const placeholder of ['Chưa cập nhật','Chua cap nhat','CHƯA CẬP NHẬT','  CHUA   CAP NHAT  '])assert.equal(await scalar('select mtm_hw_private.public_school($1)',[placeholder]),null);
  const synced=await rpc('mtm_btvn_sync_roster',[payload,true]);assert.equal(synced.summary.updated,13);
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[0]]),'Trường đồng bộ 1');
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[1]]),'Trường lưu gốc');
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[2]]),'Chưa cập nhật');
  assert.equal(await scalar('select school from mtm_hw_private.student_appearance where student_id=$1',[ids[2]]),'Trường tự nhập');
  assert.equal((await rpc('mtm_btvn_sync_roster',[payload,true])).summary.updated,0);
  await db.query("update mtm_hw_private.students set school='Chưa cập nhật' where id=$1",[ids[5]]);
  const before=await scalar('select school from mtm_hw_private.students where id=$1',[ids[5]]);
  const dry=await rpc('mtm_btvn_sync_roster',[payload,false]);assert.equal(dry.summary.updated,1);
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[5]]),before);
  const placeholders=structuredClone(payload);placeholders.students[5].school='CHUA CAP NHAT';
  assert.equal((await rpc('mtm_btvn_sync_roster',[placeholders,true])).summary.updated,0);
  const bad=structuredClone(payload);bad.students[0].school=123;await assert.rejects(rpc('mtm_btvn_sync_roster',[bad,true]));
 });
 await check('Đăng nhập chỉ tên, SĐT, lớp; hồ sơ điền sẵn trường và loại ảnh legacy quá lớn',async()=>{
  const login=await rpc('mtm_btvn_forgot',[students[0].fullName,students[0].phone,students[0].className]);assert.equal(login.ok,true);session=login.session;
  const appearance=await rpc('mtm_btvn_appearance_read',[session]);assert.equal(appearance.school,'Trường đồng bộ 1');assert.equal(appearance.appearance.avatar,'spark');assert.equal(appearance.appearance.photo,'');assert.equal(appearance.photoHidden,false);
  const original=await scalar('select photo from mtm_hw_private.student_appearance where student_id=$1',[ids[0]]);
  await rpc('mtm_btvn_photo_moderate',[ids[0],true],'authenticated',owner);
  assert.equal((await rpc('mtm_btvn_appearance_read',[session])).photoHidden,true);
  assert.equal(await scalar('select photo from mtm_hw_private.student_appearance where student_id=$1',[ids[0]]),original,'Ẩn legacy giữ nguyên nguồn ảnh');
  await assert.rejects(rpc('mtm_btvn_photo_moderate',[ids[0],false],'authenticated',owner),e=>e.code==='22023');
  const hiddenProfile=await rpc('mtm_btvn_appearance_read',[session]);
  await rpc('mtm_btvn_appearance_save',[session,hiddenProfile.revision,'spark','','Trường đồng bộ 1',hiddenProfile.profileKey]);
  assert.equal(await scalar('select photo from mtm_hw_private.student_appearance where student_id=$1',[ids[0]]),original,'Sửa trường khi legacy bị ẩn giữ nguyên nguồn ảnh');
  assert.equal(await scalar("select pronargs from pg_proc where oid='public.mtm_btvn_forgot(text,text,text)'::regprocedure"),3);
 });
 await check('SQL kiểm JPEG đúng kích thước, base64 chuẩn, trần 40000 và lưu ảnh hợp lệ',async()=>{
  assert.equal(await scalar('select mtm_hw_private.valid_public_photo($1)',[PHOTO]),true);
  for(const bad of [photo(jpeg(191,192)),photo(jpeg().subarray(0,20)),PHOTO+' ',PHOTO.replace('image/jpeg','image/png'),'https://example.invalid/image.jpg','data:image/jpeg;base64,/9j/'+'A'.repeat(40000)])assert.equal(await scalar('select mtm_hw_private.valid_public_photo($1)',[bad]),false);
  let appearance=await rpc('mtm_btvn_appearance_read',[session]);
  const args=[session,appearance.revision,'wave',PHOTO,'Trường em chọn',appearance.profileKey];
  appearance=await rpc('mtm_btvn_appearance_save',args);assert.equal(appearance.school,'Trường em chọn');assert.equal(appearance.photoHidden,true);assert.equal(appearance.appearance.photo,'');
  await rpc('mtm_btvn_photo_moderate',[ids[0],false],'authenticated',owner);
  appearance=await rpc('mtm_btvn_appearance_read',[session]);assert.equal(appearance.appearance.photo,PHOTO);
  await assert.rejects(rpc('mtm_btvn_appearance_save',[session,appearance.revision,'wave',photo(jpeg(191,192)),'X',appearance.profileKey]),e=>e.code==='22023');
 });
 await check('Sổ điểm danh truyền trường, không ghi đè; trường mâu thuẫn giữ chờ đối soát',async()=>{
  await db.query("update mtm_hw_private.students set school='Chưa cập nhật' where id=any($1::uuid[])",[[ids[3],ids[4]]]);
  const row=(i,school)=>({label:students[i].className,fullName:students[i].fullName,phone:students[i].phone,source:'fixture',school});
  const rows=[row(1,'Trường điểm danh khác'),row(2,'Trường điểm danh khác'),row(3,'Trường điểm danh'),row(4,'Trường A'),row(4,'Trường B'),row(5,'Chua cap nhat'),{label:'2K9 9+',fullName:'Học sinh tổng hợp mới',phone:'0900000099',school:'Trường bổ sung',source:'fixture'}];
  assert.equal((await rpc('mtm_btvn_sync_attendance_roster',[{rows},false])).applied,false);
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[3]]),'Chưa cập nhật');
  assert.equal((await rpc('mtm_btvn_sync_attendance_roster',[{rows},true])).invalid,0);
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[3]]),'Trường điểm danh');
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[4]]),'Chưa cập nhật');
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[5]]),'Chưa cập nhật');
  await db.query("update mtm_hw_private.students set school='Chua cap nhat' where id=$1",[ids[4]]);
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[1]]),'Trường lưu gốc');
  assert.equal(await scalar('select school from mtm_hw_private.students where id=$1',[ids[2]]),'Chưa cập nhật');
  const added=await rpc('mtm_btvn_forgot',['Học sinh tổng hợp mới','0900000099','2K9 9+']);assert.equal(added.ok,true);
  assert.equal((await rpc('mtm_btvn_appearance_read',[added.session])).school,'Trường bổ sung');
 });
 await check('Rank giữ 024: bài đã nộp luôn tính, bài chưa nộp chỉ tính khi quá hạn',async()=>{
  const day=await scalar("select (current_timestamp at time zone 'Asia/Ho_Chi_Minh')::date::text");
  for(const code of ['ho-so-done','ho-so-future','ho-so-overdue'])await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values($1,$2,$3,$4,'{}',true,'da_dang')",[code,owner,[cid],JSON.stringify({date:day,classNames:['2K9 9+'],classOpensAt:{'2K9 9+':'2000-01-01T00:00:00+07:00'}})]);
  for(const [i,id] of ids.entries())for(const code of ['ho-so-done','ho-so-future','ho-so-overdue'])await db.query("insert into mtm_hw_private.btvn_work(student_id,lesson_code,receipts,expected_due_at) values($1,$2,$3,current_timestamp+($4::text)::interval)",[id,code,JSON.stringify(code==='ho-so-done'?[{score:10-i/10,submittedAt:Date.now()}]:[]),code==='ho-so-overdue'?'-1 hour':'2 days']);
  const rows=await rpc('mtm_btvn_leaderboard_class',['2K9','btvn-thang',null]);assert.equal(rows.length,10);
  assert.equal(rows[0].score,5);assert.equal(rows[0].submitted,1);assert.equal(rows[0].total,2);
  assert.equal(rows[0].school,'Trường em chọn');assert.equal(rows[0].avatar,'wave');assert.equal(rows[0].photo,PHOTO);
  assert.equal(rows[1].school,'Trường lưu gốc');assert.equal(rows[2].school,'Trường tự nhập');
  assert.equal(rows[4].school,null);assert.equal(rows[4].avatar,'orbit');assert.equal(rows[4].photo,null);
  assert.ok(rows.every(r=>Object.keys(r).sort().join(',')==='avatar,className,fullName,photo,rank,school,score,submitted,total'));
  const own=await rpc('mtm_btvn_my_rank',[session,'2K9','btvn-thang',null]);assert.deepEqual(own,rows[0]);
  const last=await rpc('mtm_btvn_forgot',[students[14].fullName,students[14].phone,'2K9 9+']);
  const outside=await rpc('mtm_btvn_my_rank',[last.session,'2K9','btvn-thang',null]);assert.equal(outside.rank,15);assert.equal(outside.school,'Trường đồng bộ 15');assert.equal(outside.avatar,'orbit');
 });
 await check('Giáo vụ ẩn ảnh: owner thật, CAS revision, học sinh lưu vẫn giữ cờ',async()=>{
  const before=await rpc('mtm_btvn_appearance_read',[session]);
  for(const [role,principal] of [['service_role',null],['anon',null],['mtm_btvn_publisher',null],['authenticated',other],['authenticated',null]])await denied(()=>rpc('mtm_btvn_photo_moderate',[ids[0],true],role,principal));
  const hidden=await rpc('mtm_btvn_photo_moderate',[ids[0],true],'authenticated',owner);assert.equal(hidden.photoHidden,true);
  assert.deepEqual(await rpc('mtm_btvn_photo_status',[[ids[0],ids[1]]],'authenticated',owner),{items:[{studentId:ids[0],photoHidden:true},{studentId:ids[1],photoHidden:false}]});
  assert.deepEqual(await rpc('mtm_btvn_photo_status',[[]],'authenticated',owner),{items:[]});
  for(const [role,principal] of [['service_role',null],['anon',null],['mtm_btvn_publisher',null],['authenticated',other]])await denied(()=>rpc('mtm_btvn_photo_status',[[ids[0]]],role,principal));
  await denied(()=>rpc('mtm_btvn_photo_status',[[ids[0],'88888888-8888-4888-8888-888888888888']],'authenticated',owner));
  for(const list of [null,[ids[0],ids[0]],Array(101).fill(ids[0]),[null]])await assert.rejects(rpc('mtm_btvn_photo_status',[list],'authenticated',owner),e=>e.code==='22023');
  let profile=await rpc('mtm_btvn_appearance_read',[session]);assert.equal(profile.photoHidden,true);assert.equal(profile.appearance.photo,'');
  await assert.rejects(rpc('mtm_btvn_appearance_save',[session,before.revision,'wave',PHOTO,'Trường em chọn',before.profileKey]),e=>e.code==='40001');
  profile=await rpc('mtm_btvn_appearance_save',[session,profile.revision,'wave','','Trường em chọn',profile.profileKey]);
  assert.equal(profile.photoHidden,true);assert.equal(profile.appearance.photo,'');
  assert.equal(await scalar('select photo from mtm_hw_private.student_appearance where student_id=$1',[ids[0]]),PHOTO,'Sửa trường không xóa ảnh bị ẩn');
  profile=await rpc('mtm_btvn_appearance_save',[session,profile.revision,'spark',PHOTO,'Trường em chọn',profile.profileKey]);assert.equal(profile.photoHidden,true);assert.equal(profile.appearance.photo,'');
  assert.equal((await rpc('mtm_btvn_my_rank',[session,'2K9','btvn-thang',null])).photo,null);
  assert.equal((await rpc('mtm_btvn_leaderboard_class',['2K9','btvn-thang',null]))[0].photo,null);
  await rpc('mtm_btvn_photo_moderate',[ids[0],false],'authenticated',owner);
  assert.equal((await rpc('mtm_btvn_appearance_read',[session])).appearance.photo,PHOTO);
 });
 await check('Giữ quyền rank/import/attendance, không rò điện thoại hoặc mã học sinh',async()=>{
  for(const role of ['anon','authenticated','service_role','mtm_btvn_publisher'])assert.equal(await scalar("select has_function_privilege($1,'mtm_hw_private.btvn_rank_rows(text,text,text,text,uuid)','execute')",[role]),false);
  for(const role of ['anon','authenticated','mtm_btvn_publisher']){
   await denied(()=>rpc('mtm_btvn_sync_roster',[payload,true],role));
   await denied(()=>rpc('mtm_btvn_sync_attendance_roster',[{rows:[]},false],role));
   await denied(()=>rpc('mtm_btvn_appearance_read',[session],role));
  }
  const ranks=JSON.stringify(await rpc('mtm_btvn_leaderboard_class',['2K9','btvn-thang',null]));
  for(const s of students){assert.ok(!ranks.includes(s.phone));assert.ok(!ranks.includes(s.studentCode));}
 });
 writeFileSync(join(out,'sql-results.json'),JSON.stringify({passed:checks.length,checks,database:'PGlite in-memory',realData:false,network:false,migrationAppliedToCloud:false},null,2)+'\n');
}catch(error){
 writeFileSync(join(out,'sql-results.json'),JSON.stringify({passed:checks.length,checks,error:{message:error.message,code:error.code},database:'PGlite in-memory',realData:false,network:false,migrationAppliedToCloud:false},null,2)+'\n');
 console.error('LỖI SQL hồ sơ:',error.message,error.code??'');process.exitCode=1;
}finally{await db.close();}
