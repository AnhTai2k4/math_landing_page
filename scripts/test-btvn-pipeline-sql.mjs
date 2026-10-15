// PostgreSQL giả trong RAM, không env bí mật, không mạng, không dữ liệu học sinh thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const root=process.cwd(),out=join(root,'.qa-temp/dot-16/pipeline-sql');mkdirSync(out,{recursive:true});
const pkg=process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules/@electric-sql/pglite';
const {PGlite}=await import(pathToFileURL(join(pkg,...(pkg.replaceAll('\\','/').endsWith('/node_modules')?['@electric-sql/pglite']:[]),'dist/index.js')).href);const db=new PGlite();
await build({entryPoints:['tests/btvn-pipeline-fixture.ts','server/btvn/publish-handler.ts','server/btvn/supabase-repository.ts','server/btvn/private-assets.ts'],bundle:true,platform:'node',format:'esm',outdir:out,outExtension:{'.js':'.mjs'},logLevel:'error'});
const {pipelineFixture}=await import(pathToFileURL(join(out,'tests/btvn-pipeline-fixture.mjs')).href);
const {createBtvnPublishHandler}=await import(pathToFileURL(join(out,'server/btvn/publish-handler.mjs')).href);
const {SupabaseHomeworkRepository}=await import(pathToFileURL(join(out,'server/btvn/supabase-repository.mjs')).href);
const {SIGNED_ASSET_SECONDS}=await import(pathToFileURL(join(out,'server/btvn/private-assets.mjs')).href);
const checks=[];async function check(name,fn){await fn();checks.push(name);console.log('ĐẠT: '+name);}
const owner='11111111-1111-4111-8111-111111111111',cid='22222222-2222-4222-8222-222222222222';
async function rpc(action,payload,role='mtm_btvn_publisher'){return db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query('select public.mtm_btvn_pipeline($1,$2::jsonb) result',[action,JSON.stringify(payload)])).rows[0].result;});}
const fixture=pipelineFixture();
try{
 await check('17 migration nguyên văn trên PGlite, scope/bucket riêng',async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const file of readdirSync('supabase/migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8').replace(/^\uFEFF/,''));
  for(const file of readdirSync('supabase/migrations-pending').filter(f=>f.endsWith('.sql')).sort((a,b)=>{const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));}))await db.exec(readFileSync('supabase/migrations-pending/'+file,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);
  await db.query('insert into mtm_hw_private.classes(id,owner_id,label,grade) values($1,$2,$3,12)',[cid,owner,fixture.material.classNames[0]]);
  await db.query('insert into mtm_hw_private.btvn_publish_scope values(true,$1,array[$2::uuid])',[owner,cid]);
  assert.equal((await db.query("select public from storage.buckets where id='mtm-btvn'")).rows[0].public,false);
 });
 await check('Publisher không đọc bảng HS/buổi, không gọi RPC HS hoặc service role',async()=>{
  for(const sql of ['select * from mtm_hw_private.students','select * from mtm_hw_private.btvn_lessons',"select public.mtm_btvn_classes()",'delete from storage.objects'])await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role mtm_btvn_publisher');await tx.exec(sql);}),e=>e.code==='42501');
  for(const role of ['anon','authenticated','service_role'])await assert.rejects(rpc('lookup',{lesson_key:fixture.lesson_key},role),e=>e.code==='42501');
 });
 await check('Scope lớp/owner và proof thiếu bị chặn',async()=>{
  await assert.rejects(rpc('publish',{...fixture,material:{...fixture.material,classNames:['Ngoài scope']}}),e=>e.code==='42501');
  await assert.rejects(rpc('publish',{...fixture,verification:{validator:true}}));
  assert.equal((await rpc('lookup',{lesson_key:fixture.lesson_key})).status,null);
 });
 const stored=new Map();const secret='FAKE-SECRET-'.repeat(5);
 const handler=createBtvnPublishHandler({rpc,async upload(path,bytes){
  await db.transaction(async tx=>{await tx.exec('set local role mtm_btvn_publisher');await tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',['mtm-btvn',path]);});stored.set(path,bytes);
 }},secret);
 const send=body=>handler(new Request('https://fake.invalid',{method:'POST',headers:{'X-MTM-Publish-Secret':secret},body:JSON.stringify(body)}));
 await check('Handler thật → RPC thật → RLS storage → da_dang, retry bất biến',async()=>{
  const response=await send(fixture);assert.equal(response.status,200);assert.equal((await response.json()).status,'da_dang');
  assert.equal((await (await send(fixture)).json()).status,'already_published');
  const changed={...fixture,exam:{...fixture.exam,title:'Đổi title trái phép'}};assert.equal((await rpc('publish',changed)).status,'already_published');
  assert.equal((await rpc('error',{...fixture,error_code:'ERROR'})).status,'already_published');
  assert.equal((await db.query('select exam->>\'title\' title from mtm_hw_private.btvn_lessons')).rows[0].title,fixture.exam.title);
  assert.equal(stored.size,1);
 });
 await check('Storage không ghi bucket khác, không thêm tài sản vào bài đã đăng',async()=>{
  for(const [bucket,path] of [['mtm-homework','btvn/fake/a.pdf'],['mtm-btvn',`btvn/${fixture.lesson_key}/${fixture.source_version}/extra.png`]])await assert.rejects(db.transaction(async tx=>{await tx.exec('set local role mtm_btvn_publisher');await tx.query('insert into storage.objects(bucket_id,name) values($1,$2)',[bucket,path]);}),e=>e.code==='42501');
 });
 await check('Lỗi giữ inactive; retry hợp lệ chuyển da_dang',async()=>{
  const f=pipelineFixture();f.lesson_key='fake-retry';f.material.lessonCode=f.lesson_key;
  assert.equal((await rpc('error',{...f,error_code:'MATH_MISMATCH'})).status,'loi');
  assert.equal((await db.query('select active from mtm_hw_private.btvn_lessons where code=$1',[f.lesson_key])).rows[0].active,false);
  assert.equal((await (await send(f)).json()).status,'da_dang');
 });
 await check('Web nhận buổi mới bằng RPC không build; session/lớp chặn; ký PDF theo SIGNED_ASSET_SECONDS',async()=>{
  const sid='33333333-3333-4333-8333-333333333333',token='e'.repeat(64);
  await db.query("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias) values($1,$2,$3,'Học sinh giả local','Trường giả','12 giả','MTM-000000000001')",[sid,owner,cid]);
  await db.query("insert into mtm_hw_private.btvn_identity_sessions values(mtm_hw_private.token_digest('btvn-identity',$1),$2,clock_timestamp()+interval '1 hour',null)",[token,sid]);
  const transport={async rpc(name,args){try{const keys=Object.keys(args);const result=await db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query(`select public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) result`,Object.values(args))).rows[0].result;});return {data:result,error:null};}catch(e){return {data:null,error:{code:e.code}};}}};
  let signed=0;const repo=new SupabaseHomeworkRepository(transport,async()=>({}),Date.now,async(path,seconds)=>{assert.equal(seconds,SIGNED_ASSET_SECONDS);assert.ok(stored.has(path));signed++;return 'https://storage.invalid/'+path+'?token=fake';});
  const state=await repo.call(token,'state',fixture.lesson_key);assert.equal(state.lessons.length,2);assert.match(state.exam.sourcePdf.url,/token=fake/);assert.equal(signed,1);
  await assert.rejects(repo.call('0'.repeat(64),'state',fixture.lesson_key));
  const started=await repo.call(token,'start',fixture.lesson_key);const submitted=await repo.call(token,'submit',fixture.lesson_key,started.draft.attemptId,{'mc-1':'D','tf-1':[true,false,true,false],'sa-1':'2,5'});assert.equal(submitted.bestScore,10);
 });
 writeFileSync(join(out,'receipt.json'),JSON.stringify({at:new Date().toISOString(),passed:true,checks,live:false},null,2));
}finally{await db.close();}
