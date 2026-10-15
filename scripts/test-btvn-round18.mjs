// Dữ liệu tổng hợp, PGlite trong RAM. Không mạng, không dữ liệu học sinh thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL(join(process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules','@electric-sql/pglite/dist/index.js')).href);
const db=new PGlite(),checks=[];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const rpc=(name,args,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(a=>a&&typeof a==='object'?JSON.stringify(a):a))).rows[0].result;});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const owner='11111111-1111-4111-8111-111111111111';let a,b,s1,s2,session1,session2;
const pipeline=p=>rpc('mtm_btvn_pipeline',['update_material',p],'mtm_btvn_publisher');
try{
 await check('Áp dụng nguyên văn toàn bộ migration đến 014',async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const dir of ['supabase/migrations','supabase/migrations-pending'])for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort((a,b)=>{const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));}))await db.exec(readFileSync(dir+'/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);
  a=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 9+',12) returning id",[owner]);
  b=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 8+',12) returning id",[owner]);
  for(const [i,cls] of [a,b].entries()){
   const sid=await scalar("insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone,source_identity) values($1,$2,$3,'GIẢ','GIẢ',$4,$5,$6) returning id",[owner,cls,'Học sinh GIẢ '+i,'MTM-'+String(i).padStart(12,'0'),'090000000'+i,'fixture:'+i]);
   const login=await rpc('mtm_btvn_forgot',['Học sinh GIẢ '+i,'090000000'+i,i===0?'2K9 9+':'2K9 8+']);assert.equal(login.ok,true);if(i===0){s1=sid;session1=login.session;}else{s2=sid;session2=login.session;}
  }
  await db.query('insert into mtm_hw_private.btvn_publish_scope values(true,$1,$2)',[owner,[a,b]]);
  await db.query("insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,'fixture',array[gen_random_uuid(),gen_random_uuid()])",[owner]);
  await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,assets) values('shared',$1,$2,$3,$4,true,'da_dang',$5)",[owner,[a,b],JSON.stringify({lessonCode:'shared',date:'2026-10-15',classDates:{'2K9 9+':'2026-10-15','2K9 8+':'2026-10-16'},classOpensAt:{'2K9 9+':'2099-10-15T19:30:00+07:00','2K9 8+':'2000-10-16T19:30:00+07:00'},classNames:['2K9 9+','2K9 8+'],videoId:'abcdefghijk',videoUrl:'https://youtu.be/abcdefghijk',materialUrl:'https://example.org/exam.pdf',handoutUrl:'https://example.org/handout.pdf',questionImage:'SECRET-IMAGE'}),JSON.stringify({title:'Đề GIẢ',durationMinutes:120,questions:[{prompt:'SECRET-EXAM'}]}),JSON.stringify([{storage_path:'SECRET-ASSET'}])]);
 });
 await check('Trước giờ mở: chỉ thẻ và video, không đề/ảnh/tài liệu/đáp án, assets bị chặn',async()=>{
  const r=await rpc('mtm_btvn_read',[session1,'shared']);assert.equal(r.exam,undefined);assert.equal(r.material.available,false);assert.equal(r.material.videoId,'abcdefghijk');assert.equal(r.material.materialUrl,undefined);assert.equal(r.material.handoutUrl,undefined);assert.equal(r.lessons[0].available,false);assert.ok(!JSON.stringify(r).includes('SECRET'));assert.deepEqual(r.work.drafts,[]);assert.deepEqual(r.work.receipts,[]);
  await denied(()=>rpc('mtm_btvn_assets',[session1,'shared']));
 });
 await check('Start/save/submit đều bị chặn trước giờ mở',async()=>{
  for(const [drafts,receipts] of [[[{}],[]],[[{answers:{a:'A'}}],[]],[[],[{score:10}]]])await denied(()=>rpc('mtm_btvn_commit',[session1,'shared',0,drafts,receipts]));
  assert.equal(await scalar('select revision from mtm_hw_private.btvn_work where student_id=$1 and lesson_code=\'shared\'',[s1]),0);
 });
 await check('Cùng bài, lớp có ngày/giờ mở riêng: lớp đã mở đọc và ghi như wrapper cũ',async()=>{
  const r=await rpc('mtm_btvn_read',[session2,'shared']);assert.equal(r.exam.questions[0].prompt,'SECRET-EXAM');assert.equal(r.material.date,'2026-10-16');assert.equal((await rpc('mtm_btvn_assets',[session2,'shared']))[0].storage_path,'SECRET-ASSET');
  await rpc('mtm_btvn_commit',[session2,'shared',0,[{id:'fake'}],[]]);await rpc('mtm_btvn_commit',[session2,'shared',1,[{id:'fake',answers:{a:'A'}}],[]]);await rpc('mtm_btvn_commit',[session2,'shared',2,[],[{score:8,submittedAt:Date.parse('2026-10-16T20:00:00+07:00')}]]);
 });
 await check('Thiếu lịch/giờ mở: fallback 21:30 ngày lớp theo múi giờ VN',async()=>{
  assert.equal(Date.parse(await scalar("select mtm_hw_private.btvn_opens_at($1,'2K9 9+')",[JSON.stringify({date:'2026-10-15',classDates:{'2K9 9+':'2026-10-16'}})])),Date.parse('2026-10-16T21:30:00+07:00'));
 });
 await check('update_material giữ nguyên exam/assets/lớp/kind/khóa, ghi lịch sử và không ghi lại khi không đổi',async()=>{
  const before=await scalar("select to_jsonb(l)-'material'-'updated_at' from mtm_hw_private.btvn_lessons l where code='shared'");
  const patch={lesson_key:'shared',material:{videoId:'zyxwvutsrqp',videoUrl:'https://youtu.be/zyxwvutsrqp',title:'Buổi học GIẢ',handoutUrl:'https://example.org/new.pdf',homeworkNote:'Thông tin mới',classOpensAt:{'2K9 9+':'2000-10-15T19:30:00+07:00'}}};
  const r=await pipeline(patch);assert.equal(r.status,'updated');assert.equal(r.changed,true);assert.equal(r.material.classOpensAt['2K9 8+'],'2000-10-16T19:30:00+07:00');assert.deepEqual(await scalar("select to_jsonb(l)-'material'-'updated_at' from mtm_hw_private.btvn_lessons l where code='shared'"),before);assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_material_history'),1);assert.equal((await pipeline(patch)).changed,false);assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_material_history'),1);
  const r1=await rpc('mtm_btvn_read',[session1,'shared']);assert.ok(r1.exam);await rpc('mtm_btvn_commit',[session1,'shared',0,[],[]]);
 });
 await check('RPC từ chối trường ngoài danh sách, URL/YouTube/ngày không hợp lệ, lớp lạ và bài không tồn tại',async()=>{
  for(const material of [{exam:{}},{classNames:[]},{assets:[]},{videoId:'bad'},{videoUrl:'http://bad.test/x'},{handoutUrl:'javascript:alert(1)'},{classOpensAt:{'2K9 9+':'tomorrow'}},{classOpensAt:{'Lớp lạ':'2026-10-15T19:30:00+07:00'}},{classOpensAt:{'2K9 9+':'2026-99-15T19:30:00+07:00'}}])await assert.rejects(pipeline({lesson_key:'shared',material}));
  await assert.rejects(pipeline({lesson_key:'missing',material:{title:'X'}}));await assert.rejects(pipeline({lesson_key:'shared',exam:{},material:{title:'X'}}));
  for(const material of [{videoUrl:'https://user:pass@example.org/video'},{videoUrl:'https://example.org/'+ 'a'.repeat(4096)},{title:'a'.repeat(301)}])await assert.rejects(pipeline({lesson_key:'shared',material}));
 });
 await check('Đổi YouTube sang link video khác, xóa video cũ bằng null và ghi chú rỗng',async()=>{
  let r=await pipeline({lesson_key:'shared',material:{videoId:null,videoUrl:'https://zoom.us/rec/share/fake',materialUrl:null,handoutUrl:null,homeworkNote:''}});assert.equal(r.material.videoId,null);assert.equal(r.material.videoUrl,'https://zoom.us/rec/share/fake');assert.equal(r.material.homeworkNote,'');
  r=await pipeline({lesson_key:'shared',material:{videoId:'abcdefghijk',videoUrl:null}});assert.equal(r.material.videoId,'abcdefghijk');assert.equal(r.material.videoUrl,null);
 });
 await check('Phạm vi publisher phải bao trọn lớp bài, không sửa bài ngoài owner',async()=>{
  await db.query('update mtm_hw_private.btvn_publish_scope set class_ids=$1',[[a]]);await denied(()=>pipeline({lesson_key:'shared',material:{title:'X'}}));await db.query('update mtm_hw_private.btvn_publish_scope set class_ids=$1',[[a,b]]);
  await db.query("insert into auth.users values('99999999-9999-4999-8999-999999999999')");await db.exec("update mtm_hw_private.btvn_lessons set owner_id='99999999-9999-4999-8999-999999999999' where code='shared'");await denied(()=>pipeline({lesson_key:'shared',material:{title:'X'}}));await db.query("update mtm_hw_private.btvn_lessons set owner_id=$1 where code='shared'",[owner]);
 });
 await check('Xếp hạng bỏ bài chưa mở khỏi mẫu số, giữ hotfix tên và chỉ em đã nộp',async()=>{
  await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values('future',$1,$2,$3,'{}',true,'da_dang')",[owner,[b],JSON.stringify({lessonCode:'future',date:'2026-10-17',classOpensAt:{'2K9 8+':'2099-10-17T19:30:00+07:00'}})]);
  await db.query("update mtm_hw_private.students set full_name='Học sinh GIẢ 1 (Ghi chú)' where id=$1",[s2]);
  const rows=await rpc('mtm_btvn_leaderboard',['2K9','btvn-tuan','2026-10-12']);assert.equal(rows.length,1);assert.equal(rows[0].score,8);assert.equal(rows[0].total,1);assert.equal(rows[0].fullName,'Học sinh GIẢ 1');
 });
 await check('Giữ wrapper 013 kiểm tra tháng; khóa các bản gốc và quyền RPC/table',async()=>{
  await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,kind,opens_at,closes_at) values('monthly',$1,$2,$3,'{}',true,'da_dang','kiem-tra-thang',clock_timestamp()+interval '1 hour',clock_timestamp()+interval '2 hours')",[owner,[a],JSON.stringify({lessonCode:'monthly',date:'2026-10-31'})]);
  const r=await rpc('mtm_btvn_read',[session1,'monthly']);assert.equal(r.material.kind,'kiem-tra-thang');assert.ok(r.material.closesAt>r.material.opensAt);await denied(()=>rpc('mtm_btvn_commit',[session1,'monthly',0,[{}],[]]));
  for(const role of ['anon','authenticated','service_role'])await denied(()=>rpc('mtm_btvn_pipeline',['update_material',{lesson_key:'shared',material:{title:'X'}}],role));
  for(const [name,args] of [['mtm_btvn_read_before_class_open',[session1,'shared']],['mtm_btvn_commit_before_class_open',[session1,'shared',0,[],[]]],['mtm_btvn_pipeline_before_class_open',['lookup',{lesson_key:'shared'}]]])await denied(()=>rpc(name,args));
  for(const role of ['anon','authenticated','service_role','mtm_btvn_publisher'])assert.equal(await scalar("select has_table_privilege($1,'mtm_hw_private.btvn_material_history','select')",[role]),false);
  for(const role of ['anon','authenticated','mtm_btvn_publisher'])await denied(()=>rpc('mtm_btvn_read',[session1,'shared'],role));
 });
 mkdirSync('.qa-temp/dot-18',{recursive:true});writeFileSync('.qa-temp/dot-18/sql-results.json',JSON.stringify({passed:checks.length,checks,realData:false,network:false},null,2));
}finally{await db.close();}
