// Dữ liệu tổng hợp, PostgreSQL trong RAM, không mạng hoặc danh sách học sinh thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {PGlite}=await import(pathToFileURL('T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules/@electric-sql/pglite/dist/index.js').href);
const db=new PGlite(),checks=[];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const rpc=(name,args,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args.map(a=>a&&typeof a==='object'?JSON.stringify(a):a))).rows[0].result;});
const rank=(kind='btvn-tuan',period='2026-10-12')=>rpc('mtm_btvn_leaderboard',['2K9',kind,period]);
const owner='11111111-1111-4111-8111-111111111111';let cls,cls2;const students=[];
const rec=(score,at='2026-10-15T18:00:00+07:00')=>({score,submittedAt:Date.parse(at),late:true});
const work=(i,lesson,receipts)=>db.query('insert into mtm_hw_private.btvn_work(student_id,lesson_code,receipts) values($1,$2,$3) on conflict(student_id,lesson_code) do update set receipts=excluded.receipts',[students[i],lesson,JSON.stringify(receipts)]);
const lesson=(code,date,extra={},kind='btvn')=>db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,kind,opens_at,closes_at) values($1,$2,$3,$4,'{}',true,'da_dang',$5,case when $5='kiem-tra-thang' then clock_timestamp()-interval '1 hour' end,case when $5='kiem-tra-thang' then clock_timestamp()+interval '1 hour' end)",[code,owner,[cls],JSON.stringify({lessonCode:code,date,...extra}),kind]);
try{
 await check('Migration nguyên văn gồm hotfix, quyền và bảng riêng tư',async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const dir of ['supabase/migrations','supabase/migrations-pending'])for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort((a,b)=>{const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));}))await db.exec(readFileSync(dir+'/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);
  cls=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 9+',12) returning id",[owner]);
  cls2=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 8+',12) returning id",[owner]);
  await db.query("insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,'fixture',array[gen_random_uuid(),gen_random_uuid()])",[owner]);
  for(let i=0;i<14;i++)students.push(await scalar("insert into mtm_hw_private.students(id,owner_id,class_id,full_name,school,school_class,public_alias,student_phone,cohort,source_identity) values($7,$1,$2,$3,'GIẢ','GIẢ',$4,$5,'2K9',$6) returning id",[owner,cls,'Học sinh GIẢ '+i,'MTM-'+String(i).padStart(12,'0'),'09000000'+String(i).padStart(2,'0'),'fixture:'+i,'22222222-2222-4222-8222-'+String(i).padStart(12,'0')]));
 });
 await lesson('a','2026-10-14',{classDates:{'2K9 9+':'2026-10-15'}});await lesson('b','2026-10-18');await lesson('old','2026-10-14');await lesson('next','2026-10-19');
 await work(0,'a',[rec(8),rec(10,'2026-10-16T20:00:00+07:00')]);await work(0,'old',[rec(10)]);await work(0,'next',[rec(10)]);
 await check('Trung bình mọi bài, bỏ bài bằng 0, nộp muộn vẫn tính, classDates thay ngày gốc',async()=>{const rows=await rank();assert.equal(rows[0].score,5);assert.equal(rows[0].total,2);assert.equal(rows[0].submitted,1);assert.equal(rows[0].fullName,'Học sinh GIẢ 0');});
 await check('Mốc 15/10 giờ VN loại lượt nộp trước 00:00 và bài cũ',async()=>{await work(1,'a',[rec(10,'2026-10-14T23:59:59+07:00')]);assert.equal((await rank()).find(r=>r.fullName==='Học sinh GIẢ 1'),undefined,'chỉ xếp em đã nộp từ 15/10 (013_1)');});
 await check('Loại qa:, inactive và lớp ngừng học; top 10, không UUID/SĐT/mã',async()=>{
  await db.query("update mtm_hw_private.students set source_identity='qa:test' where id=$1",[students[12]]);await db.query('update mtm_hw_private.students set active=false where id=$1',[students[13]]);
  // 013_1: chỉ xếp em đã nộp; cho 14 em có lượt hợp lệ để kiểm giới hạn top 10.
  for(let i=0;i<14;i++)await work(i,'a',[rec(5+i/10)]);
  const rows=await rank();assert.equal(rows.length,10);assert.deepEqual(Object.keys(rows[0]).sort(),['rank','fullName','className','score','submitted','total'].sort());assert.ok(!JSON.stringify(rows).includes('090000'));
  await db.query('update mtm_hw_private.classes set active=false where id=$1',[cls]);assert.deepEqual(await rank(),[]);await db.query('update mtm_hw_private.classes set active=true where id=$1',[cls]);
  for(let i=0;i<14;i++)await work(i,'a',[]);
 });
 await check('Danh sách loại trừ bỏ điểm thử, vẫn giữ bài trong mẫu số',async()=>{await work(0,'b',[rec(2)]);await db.query("insert into mtm_hw_private.btvn_rank_exclusions values($1,'a','Lượt thử GIẢ')",[students[0]]);assert.equal((await rank()).find(r=>r.fullName==='Học sinh GIẢ 0').score,1);await db.query('delete from mtm_hw_private.btvn_rank_exclusions');await work(0,'b',[]);});
 await check('Hòa điểm: số bài nộp rồi thời điểm hoàn tất các lượt cao nhất sớm hơn',async()=>{
  await work(2,'a',[rec(5)]);await work(2,'b',[rec(5)]);await work(3,'a',[rec(10,'2026-10-16T19:00:00+07:00')]);
  const rows=await rank();assert.deepEqual(rows.slice(0,2).map(r=>r.fullName),['Học sinh GIẢ 2','Học sinh GIẢ 3']);assert.equal(rows.find(r=>r.fullName==='Học sinh GIẢ 0'),undefined,'013_1: chưa nộp thì không lên bảng');
 });
 await check('Tuần thứ Hai đến Chủ nhật, tháng dương lịch, độc lập múi giờ DB',async()=>{
  assert.equal((await rank('btvn-tuan','2026-10-19'))[0].total,1);assert.equal((await rank('btvn-thang','2026-10'))[0].total,3);
  await db.exec("set timezone='America/Los_Angeles'");assert.equal((await rank())[0].total,2);
  await assert.rejects(rank('btvn-tuan','2026-10-18'));assert.deepEqual(await rank('btvn-thang','2026-09'),[]);
 });
 const row=(i,score=7)=>({className:'2K9 8+',fullName:'Học sinh GIẢ '+i,phone:'09000000'+String(i).padStart(2,'0'),month:'10/2026',score});
 await check('Nạp Sheet SĐT HS/PH cùng khóa, dry-run rollback, thống kê không PII',async()=>{
  await db.query("update mtm_hw_private.students set parent_phone='0980000000' where id=$1",[students[0]]);
  const payload={rows:[{...row(0),phone:'0980000000'},row(1)]};const r=await rpc('mtm_btvn_sync_monthly',[payload,false]);assert.equal(r.matched,2);assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_monthly_scores'),0);
  assert.deepEqual(Object.keys(r).sort(),['applied','matched','unmatched','webOverrides'].sort());
  await rpc('mtm_btvn_sync_monthly',[payload,true]);assert.equal(await scalar('select count(*)::int from mtm_hw_private.btvn_monthly_scores'),2);
 });
 await check('SĐT trùng cần tên phân xử; mơ hồ không ghi; trùng học sinh/tháng rollback cả đợt',async()=>{
  await db.query("update mtm_hw_private.students set parent_phone='0980000000' where id=$1",[students[1]]);
  let r=await rpc('mtm_btvn_sync_monthly',[{rows:[{...row(0),phone:'0980000000',fullName:'Không khớp'}]},true]);assert.equal(r.unmatched,1);
  r=await rpc('mtm_btvn_sync_monthly',[{rows:[{...row(0),phone:'0980000000'}]},false]);assert.equal(r.matched,1);
  await assert.rejects(rpc('mtm_btvn_sync_monthly',[{rows:[row(0,1),row(0,2)]},true]));assert.equal(await scalar('select score::float8 from mtm_hw_private.btvn_monthly_scores where student_id=$1',[students[0]]),7);
 });
 await check('Khớp như sync_due hotfix: ưu tiên đúng lớp khi một em có hai hồ sơ',async()=>{
  await db.query('update mtm_hw_private.students set class_id=$1 where id=$2',[cls2,students[1]]);
  const r=await rpc('mtm_btvn_sync_monthly',[{rows:[{...row(0,6),className:'2K9 8+',phone:'0980000000',fullName:'Không dùng để phân xử'}]},true]);assert.equal(r.matched,1);
  assert.equal(await scalar('select score::float8 from mtm_hw_private.btvn_monthly_scores where student_id=$1',[students[1]]),6);
  await db.query('update mtm_hw_private.students set class_id=$1 where id=$2',[cls,students[1]]);
 });
 await lesson('monthly','2026-10-31',{},'kiem-tra-thang');await work(0,'monthly',[rec(9)]);
 await check('Ưu tiên điểm web và cảnh báo khi cả hai nguồn, bài thi không vào BTVN',async()=>{
  const r=await rpc('mtm_btvn_sync_monthly',[{rows:[row(0,7)]},true]);assert.equal(r.webOverrides,1);
  assert.equal((await rank('kiem-tra-thang','2026-10'))[0].score,9);assert.equal((await rank('btvn-thang','2026-10'))[0].total,3);
 });
 await check('Web một lượt, có giờ mở/đóng, read trả metadata; bản gốc bị khóa',async()=>{
  const login=await rpc('mtm_btvn_forgot',['Học sinh GIẢ 0','0900000000','2K9 9+']);
  assert.equal(login.ok,true);const read=await rpc('mtm_btvn_read',[login.session,'monthly']);assert.equal(read.material.kind,'kiem-tra-thang');assert.ok(read.material.closesAt>read.material.opensAt);
  await assert.rejects(rpc('mtm_btvn_commit',[login.session,'monthly',0,[{},{}],[]]),e=>e.code==='42501');
  await assert.rejects(rpc('mtm_btvn_commit',[login.session,'monthly',0,[],[]]),e=>e.code==='42501');
  await db.query("update mtm_hw_private.btvn_lessons set opens_at=clock_timestamp()+interval '1 hour',closes_at=clock_timestamp()+interval '2 hours' where code='monthly'");
  await assert.rejects(rpc('mtm_btvn_commit',[login.session,'monthly',0,[{}],[]]),e=>e.code==='42501');
 });
 await check('Quyền anon/authenticated/publisher, service_role chỉ RPC',async()=>{
  for(const role of ['anon','authenticated','mtm_btvn_publisher'])for(const [name,args] of [['mtm_btvn_leaderboard',['2K9','btvn-thang','2026-10']],['mtm_btvn_sync_monthly',[{rows:[]},false]]])await assert.rejects(rpc(name,args,role),e=>e.code==='42501');
  for(const [name,args] of [['mtm_btvn_read_before_rank',['a',null]],['mtm_btvn_pipeline_before_rank',['lookup',{}]],['mtm_btvn_commit_before_rank',['a','b',0,[],[]]]])await assert.rejects(rpc(name,args),e=>e.code==='42501');
  assert.equal(await scalar("select has_table_privilege('service_role','mtm_hw_private.btvn_monthly_scores','select')"),false);
  assert.equal(await scalar("select count(*)::int from pg_proc where proname in ('mtm_btvn_leaderboard','mtm_btvn_sync_monthly') and prosecdef and proconfig @> array['search_path=\"\"']"),2);
 });
 await check('Đăng kiểm tra qua pipeline cũ, giữ kind/cửa sổ và policy storage trỏ wrapper mới',async()=>{
  await db.query('insert into mtm_hw_private.btvn_publish_scope values(true,$1,$2)',[owner,[cls]]);
  const payload={kind:'kiem-tra-thang',lesson_key:'monthly-publish',source_version:'a'.repeat(64),opensAt:'2026-10-30T17:00:00+07:00',closesAt:'2026-10-30T19:00:00+07:00',material:{lessonCode:'monthly-publish',classNames:['2K9 9+'],date:'2026-10-30'},exam:{durationMinutes:120,questions:[{}]},assets:[{storage_path:'btvn/monthly-publish/'+'a'.repeat(64)+'/test.png',sha256:'b'.repeat(64)}],verification:{validator:true,independent:true}};
  const storagePath='btvn/other-fixture/'+'a'.repeat(64)+'/test.png';
  await db.transaction(async tx=>{await tx.exec('set local role mtm_btvn_publisher');await tx.query("insert into storage.objects(bucket_id,name) values('mtm-btvn',$1)",[storagePath]);});
  await assert.rejects(rpc('mtm_btvn_pipeline',['publish',{...payload,closesAt:null}],'mtm_btvn_publisher'));
  assert.equal((await rpc('mtm_btvn_pipeline',['publish',payload],'mtm_btvn_publisher')).status,'da_dang');
  assert.equal(await scalar("select kind from mtm_hw_private.btvn_lessons where code='monthly-publish'"),'kiem-tra-thang');
  assert.equal((await rpc('mtm_btvn_pipeline',['publish',{...payload,kind:'btvn'}],'mtm_btvn_publisher')).status,'already_published');
  assert.equal(await scalar("select kind from mtm_hw_private.btvn_lessons where code='monthly-publish'"),'kiem-tra-thang');
 });
 writeFileSync('.qa-temp/dot-15/sql-results.json',JSON.stringify({passed:checks.length,checks,realData:false,network:false},null,2));
}finally{await db.close();}
