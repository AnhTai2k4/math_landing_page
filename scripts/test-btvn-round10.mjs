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
 await check('7 migration nguyên văn, scope giả và 2 fixture bảo vệ',async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const f of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
  for(const f of ['202610150005_btvn.sql','202610150006_btvn_pipeline.sql','202610150007_btvn_roster_sync.sql'])await db.exec(readFileSync('supabase/migrations-pending/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);await db.query('insert into public.mtm_exam_admins(user_id) values($1)',[owner]);
  const cls=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'Lớp fixture giữ nguyên',12) returning id",[owner]);
  for(const [i,id] of protectedIds.entries())await db.query("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,$3,'GIẢ cũ','GIẢ','GIẢ',$4)",[id,owner,cls,'MTM-'+String(i+1).padStart(12,'0')]);
  await db.query('insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,$2,$3)',[owner,bundle.sheetId,protectedIds]);
 });
 const before=await scalar('select jsonb_agg(to_jsonb(s) order by id) from mtm_hw_private.students s');
 await check('Dry-run không lưu lớp, HS, membership, mã và không trả dữ liệu riêng',async()=>{
  const dry=await rpc('mtm_btvn_sync_roster',payload);assert.deepEqual(Object.keys(dry),['summary']);assert.equal(dry.summary.added,2);assert.equal(dry.summary.codesAdded,2);assert.equal(dry.summary.excluded,3);
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(s) order by id) from mtm_hw_private.students s'),before);
  assert.equal(await scalar('select count(*)::int from mtm_hw_private.codes'),0);assert.equal(await scalar('select count(*)::int from mtm_hw_private.classes'),1);
 });
 let first;
 await check('Live GIẢ cấp mã/ghép membership, retry không cấp lại và CSV đúng mã',async()=>{
  first=await rpc('mtm_btvn_sync_roster',payload,true);assert.equal(first.summary.added,2);assert.equal(first.summary.codesAdded,2);assert.equal(first.students[0].code,bundle.students[0].studentCode.toUpperCase());
  const retry=await rpc('mtm_btvn_sync_roster',payload,true);assert.equal(retry.summary.added,0);assert.equal(retry.summary.updated,0);assert.equal(retry.summary.codesAdded,0);assert.equal(await scalar('select count(*)::int from mtm_hw_private.codes'),2);assert.equal(await scalar('select count(*)::int from mtm_hw_private.memberships'),2);
  assert.ok(codeCsv(retry.students).includes(first.students[0].code));
 });
 await check('Mã đã thu hồi/hết hạn giữ nguyên; đổi SĐT/chuyển lớp giữ UUID và history',async()=>{
  const id=first.students[0].studentId;
  await db.query("update mtm_hw_private.codes set revoked_at=clock_timestamp(),expires_at=clock_timestamp()-interval '1 day' where student_id=$1",[id]);
  const codes=await scalar('select jsonb_agg(to_jsonb(c) order by id) from mtm_hw_private.codes c');
  const moved=structuredClone(bundle);moved.students[0].className='2K9 8+';moved.students[0].phone='0912345678';
  const result=await rpc('mtm_btvn_sync_roster',makeSyncPayload(moved,config),true);
  assert.equal(result.summary.updated,1);assert.equal(result.students[0].studentId,id);assert.equal(result.summary.codesAdded,0);
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(c) order by id) from mtm_hw_private.codes c'),codes);
  assert.equal(await scalar('select count(*)::int from mtm_hw_private.memberships where student_id=$1 and left_at is not null',[id]),1);
  assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(s) order by id) from mtm_hw_private.students s where id=any($1::uuid[])',[protectedIds]),before);
 });
 await check('Một dòng lỗi rollback cả batch; fixture/identity trùng/nguồn sai/quyền bị chặn',async()=>{
  for(const mutate of [p=>p.students[1].phone='sai',p=>p.students[1].sourceIdentity=p.students[0].sourceIdentity,p=>p.students[0].studentId=protectedIds[0],p=>p.sheetId='khác']){
   const p=structuredClone(payload);p.students[0].fullName='Đổi tạm GIẢ';mutate(p);
   const snapshot=await scalar('select jsonb_agg(to_jsonb(s) order by id) from mtm_hw_private.students s');await assert.rejects(rpc('mtm_btvn_sync_roster',p,true));assert.deepEqual(await scalar('select jsonb_agg(to_jsonb(s) order by id) from mtm_hw_private.students s'),snapshot);
  }
  for(const role of ['anon','authenticated','mtm_btvn_publisher'])await assert.rejects(rpc('mtm_btvn_sync_roster',payload,true,role),e=>e.code==='42501');
 });
 await check('Legacy mapping giữ UUID và mã cũ không khôi phục thô; vắng khỏi bundle chỉ bỏ qua',async()=>{
  const cid=first.classes[0].id;
  const sid=await scalar("insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,'Legacy GIẢ','GIẢ','GIẢ','MTM-ABCDEF123456') returning id",[owner,cid]);
  await db.query("insert into mtm_hw_private.codes(student_id,digest,issued_by,expires_at) values($1,mtm_hw_private.token_digest('code',$2),$3,clock_timestamp()+interval '1 day')",[sid,'f'.repeat(32),owner]);
  const b={...bundle,students:[fake(3)],registry:{fake3:fake(3).studentCode}};const p=makeSyncPayload(b,{...config,legacyMappings:{[fake(3).studentCode]:sid}});
  const result=await rpc('mtm_btvn_sync_roster',p,true);assert.equal(result.summary.added,0);assert.equal(result.students[0].studentId,sid);assert.equal(result.students[0].code,null);assert.equal(result.summary.codesAdded,0);assert.equal(result.summary.skipped,2);assert.equal(result.summary.removed,0);
 });
 await check('Scope chỉ 2 lớp, dry-run không ghi; thiếu/trùng/ngoài phạm vi bị chặn',async()=>{
  // Batch legacy trước chỉ có 9+; scope phải từ chối lớp chưa thuộc batch mới.
  const labels=['2K9 9+','2K9 8+'];await assert.rejects(rpc('mtm_btvn_configure_publish_scope',labels));
  await rpc('mtm_btvn_sync_roster',payload,true);
  assert.equal((await rpc('mtm_btvn_configure_publish_scope',labels)).classes,2);assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_publish_scope'),0);
  assert.equal((await rpc('mtm_btvn_configure_publish_scope',labels,true)).applied,true);await assert.rejects(rpc('mtm_btvn_configure_publish_scope',['Lớp khác','2K9 8+'],true));
 });
 await check('Port Edge dùng transaction đúng role trước SQL tham số, rollback không rò role',async()=>{
  const tagged=tx=>async(strings,...args)=>{
   const query=strings.map((s,i)=>s+(i<args.length?'$'+(i+1):'')).join('');
   return (await tx.query(query,args)).rows;
  };
  const sql={begin:fn=>db.transaction(tx=>fn(tagged(tx)))};
  const port=createPublishPort(sql,{from(){throw Error('Không Storage trong DB test');}});
  assert.equal((await port.rpc('lookup',{lesson_key:'fake-round10'})).status,null);
  await assert.rejects(port.rpc('publish',{lesson_key:'fake-round10'}));
  assert.equal(await scalar('select current_user'),'postgres');
  await db.transaction(async tx=>{await tx.exec('set local role mtm_btvn_publisher');await assert.rejects(tx.query('select * from mtm_hw_private.students'),e=>e.code==='42501');});
 });
 await check('Storage chỉ bucket/path/hash hợp lệ, upsert=false, collision/retry không ghi đè',async()=>{
  const bytes=new TextEncoder().encode('%PDF-FAKE-ROUND10'),hash=digest(bytes),path='btvn/fake-round10/'+'a'.repeat(64)+'/exam-assets/a.pdf';let uploads=0,downloads=0,error=null,stored=bytes;
  const storage={from(bucket){assert.equal(bucket,'mtm-btvn');return {async upload(p,b,opts){assert.equal(p,path);assert.equal(opts.upsert,false);uploads++;return {error};},async download(p){assert.equal(p,path);downloads++;return {data:new Blob([stored])};}};}};
  const port=createPublishPort({},storage);
  await port.upload(path,bytes,'application/pdf',hash);error={statusCode:409};await port.upload(path,bytes,'application/pdf',hash);assert.equal(downloads,1);
  stored=new Uint8Array(8);await assert.rejects(port.upload(path,bytes,'application/pdf',hash));
  const before=uploads;for(const bad of ['../a.pdf',path.replace('btvn/','other/'),path.replace('/a.pdf','//a.pdf')])await assert.rejects(port.upload(bad,bytes,'application/pdf',hash));await assert.rejects(port.upload(path,bytes,'application/pdf','0'.repeat(64)));assert.equal(uploads,before);
  error={statusCode:400,message:'Bad request'};const d=downloads;await assert.rejects(port.upload(path,bytes,'application/pdf',hash));assert.equal(downloads,d);
 });
 await check('CLI dry-run thật với transport giả: không mạng, không xuất PII, mặc định p_apply=false',async()=>{
  const out='.qa-temp/round10/cli-fake';mkdirSync(out,{recursive:true});
  writeFileSync(join(out,'bundle.json'),JSON.stringify(bundle));writeFileSync(join(out,'COMPLETE.json'),JSON.stringify({students:2}));writeFileSync(join(out,'config.json'),JSON.stringify(config));
  writeFileSync(join(out,'mock-fetch.mjs'),`globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(body.p_apply!==false)throw Error('Live forbidden in CLI test');return {ok:true,json:async()=>({summary:{applied:false,classes:2,classesAdded:2,added:2,updated:0,unchanged:0,skipped:0,excluded:3,codesAdded:2,removed:0},students:[{fullName:'KHONG_IN_TEN',phone:'0987654321'}]})};};`);
  const result=spawnSync(process.execPath,['--import',pathToFileURL(join(process.cwd(),out,'mock-fetch.mjs')).href,'scripts/sync-btvn-roster.mjs',join(out,'bundle.json'),'--config',join(out,'config.json')],{encoding:'utf8',env:{...process.env,SUPABASE_URL:'https://fake.invalid',SUPABASE_SERVICE_ROLE_KEY:'FAKE_ONLY_NO_REAL_KEY'}});
  assert.equal(result.status,0,result.stderr);const counts=JSON.parse(result.stdout);assert.equal(counts.live,false);assert.equal(counts.added,2);assert.ok(!/KHONG_IN_TEN|0987654321|HS-|fullName|phone/.test(result.stdout+result.stderr));
 });
 await check('Login không quản trị SET role chỉ khi có membership; transaction phục hồi login',async()=>{
  // PGlite single-user không mô phỏng RESET SESSION AUTHORIZATION như pool cloud.
  // Test không đủ quyền trên một DB RAM riêng, đóng ngay; DB chính đổi auth ở cuối.
  const denied=new PGlite();try{
   await denied.exec('create role mtm_btvn_publisher nologin;create role btvn_denied login noinherit;set session authorization btvn_denied');
   await assert.rejects(denied.transaction(async tx=>tx.exec('set local role mtm_btvn_publisher')),e=>e.code==='42501');
  }finally{await denied.close();}
  await db.exec('create role btvn_fake_connector login noinherit;grant mtm_btvn_publisher to btvn_fake_connector;set session authorization btvn_fake_connector');
  const sql={begin:fn=>db.transaction(tx=>fn(async(strings,...args)=>(await tx.query(strings.map((s,i)=>s+(i<args.length?'$'+(i+1):'')).join(''),args)).rows))};
  const port=createPublishPort(sql,{});assert.equal((await port.rpc('lookup',{lesson_key:'fake-round10'})).status,null);assert.equal(await scalar('select current_user'),'btvn_fake_connector');
  await assert.rejects(port.rpc('publish',{lesson_key:'fake-round10'}));assert.equal(await scalar('select current_user'),'btvn_fake_connector');
 });
 mkdirSync('.qa-temp/round10',{recursive:true});writeFileSync('.qa-temp/round10/receipt.json',JSON.stringify({passed:true,checks,live:false,realStudentDataRead:false},null,2));
}finally{await db.close();}
