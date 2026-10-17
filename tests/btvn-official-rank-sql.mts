// PostgreSQL WASM thật trong RAM; toàn bộ danh tính và bài nộp là tổng hợp.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {MTM_SCORING_VERSION,MtmScoringCatalog,lockMtmAttempt,scoreMtmAttempt} from '../src/native/exams/mtm-scoring';
const root=process.env.MTM_ROOT??process.cwd();
const toolsDir=process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules';
const {PGlite}=await import(pathToFileURL(join(toolsDir,'@electric-sql/pglite/dist/index.js')).href);
const {fuzzystrmatch}=await import(pathToFileURL(join(toolsDir,'@electric-sql/pglite/dist/contrib/fuzzystrmatch.js')).href);
const db=new PGlite({extensions:{fuzzystrmatch}}),checks:string[]=[];
const owner='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999';
const scalar=async(sql:string,args:unknown[]=[])=>Object.values((await db.query(sql,args)).rows[0])[0] as any;
const rpc=(name:string,args:unknown[],role='service_role',principal:string|null=null)=>db.transaction(async(tx:any)=>{
 await tx.exec('set local role '+role);if(principal)await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[principal]);
 return (await tx.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) result`,args)).rows[0].result;
});
const check=async(name:string,fn:()=>Promise<void>)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const denied=(fn:()=>Promise<unknown>)=>assert.rejects(fn,(e:any)=>e.code==='42501');
const at=Date.parse('2026-10-16T20:00:00+07:00');let cid:string,sid:string,peer:string,session:string;
const receipt=(id:string,score:number|null)=>({attemptId:id,attemptNumber:1,score,submittedAt:at,elapsedSeconds:60,late:false,timedOut:false});
const work=(student:string,lesson:string,receipts:unknown[])=>db.query('insert into mtm_hw_private.btvn_work(student_id,lesson_code,receipts) values($1,$2,$3) on conflict(student_id,lesson_code) do update set receipts=excluded.receipts',[student,lesson,JSON.stringify(receipts)]);
const rank=()=>rpc('mtm_btvn_leaderboard',['2K9','btvn-tuan','2026-10-12']);
const grade=(lesson:string,id:string,score:number,student=sid)=>rpc('mtm_btvn_grade_attempt',[student,lesson,id,score,true],'authenticated',owner);
const lesson=async(code:string,exam:unknown={},note='',kind='btvn')=>db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,kind,opens_at,closes_at) values($1,$2,$3,$4,$5,true,'da_dang',$6,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '1 hour')",[code,owner,[cid],JSON.stringify({lessonCode:code,date:'2026-10-16',classOpensAt:{'2K9 9+':'2000-01-01T00:00:00Z'},homeworkNote:note}),JSON.stringify(exam),kind]);
const mtmReceipt=(id:string,count=3)=>{
 const exam=new MtmScoringCatalog().prepare({examId:'fixture-mtm',examVersion:'1',answerKeyVersion:'1',sourceRef:'Tổng hợp',sourceComplete:true,answerKeyVerified:true,
  questions:Array.from({length:count},(_,i)=>({number:i+1,section:'TN',prompt:'Câu tổng hợp '+i,choices:['A','B','C','D'],answer:'A'}))});
 const mtm=scoreMtmAttempt(lockMtmAttempt(exam,id),Object.fromEntries(exam.questions.map((q,i)=>[q.id,i===0?'A':'B'])));
 return {...receipt(id,Number(mtm.officialDisplayTotal)),rubricVersion:MTM_SCORING_VERSION,mtm};
};
try{
 await check('Áp toàn bộ migration theo thứ tự, gồm 024, 025 và 026 trong RAM',async()=>{
  await db.exec(`create schema extensions;create role anon;create role authenticated;create role service_role;create role authenticator;
   create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;`);
  for(const dir of ['supabase/migrations','supabase/migrations-pending']){
   const key=(f:string)=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');
   for(const file of readdirSync(join(root,dir)).filter(f=>f.endsWith('.sql')).sort((a,b)=>key(a).localeCompare(key(b))))await db.exec(readFileSync(join(root,dir,file),'utf8').replace(/^\uFEFF/,''));
  }
  await db.query('insert into auth.users values($1),($2)',[owner,other]);await db.query('insert into public.mtm_exam_admins(user_id) values($1),($2)',[owner,other]);
  cid=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K9 9+',12) returning id",[owner]);
  for(const i of [0,1]){
   const id=await scalar("insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone,source_identity) values($1,$2,$3,'Trường tổng hợp','Tổng hợp',$4,$5,$6) returning id",[owner,cid,'Học sinh tổng hợp '+i,'MTM-'+String(i).padStart(12,'0'),'090000000'+i,'fixture:official:'+i]);
   if(i===0)sid=id;else peer=id;
  }
  await db.query("insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,'fixture',array[gen_random_uuid(),gen_random_uuid()])",[owner]);
  const login=await rpc('mtm_btvn_forgot',['Học sinh tổng hợp 0','0900000000','2K9 9+']);assert.equal(login.ok,true);session=login.session;
 });
 await check('Giữ 024: chưa nộp, chưa hạn không vào mẫu số; đã nộp cập nhật hạng ngay',async()=>{
  await lesson('auto');await lesson('not-due');await work(sid,'auto',[receipt('auto-1',8)]);await work(peer,'auto',[receipt('peer-1',9)]);
  await db.exec("update mtm_hw_private.btvn_work set expected_due_at=clock_timestamp()+interval '1 day'");
  // Chưa có work cũng dùng luật hạn lớp; đặt rõ cho cả hai học sinh.
  await work(sid,'not-due',[]);await work(peer,'not-due',[]);await db.exec("update mtm_hw_private.btvn_work set expected_due_at=clock_timestamp()+interval '1 day' where lesson_code='not-due'");
  let rows=await rank();assert.equal(rows.find((r:any)=>r.fullName==='Học sinh tổng hợp 0').total,1);
  await work(sid,'not-due',[receipt('auto-2',10)]);rows=await rank();const own=rows.find((r:any)=>r.fullName==='Học sinh tổng hợp 0');assert.equal(own.score,9);assert.equal(own.total,2);
  await db.exec("update mtm_hw_private.btvn_work set expected_due_at=clock_timestamp()-interval '1 hour' where lesson_code='not-due' and student_id='"+peer+"'");
  assert.equal((await rank()).find((r:any)=>r.fullName==='Học sinh tổng hợp 1').score,4.5);
 });
 await check('Tự luận, tự kiểm và nộp vở chưa chấm bị loại khỏi cả tổng điểm và mẫu số chính thức',async()=>{
  for(const [code,exam,note] of [['self',{questions:[{id:'q',kind:'self'}]},''],['essay',{questions:[{id:'q',kind:'essay'}]},''],['notebook',{},'Nộp vở bài tập'],['note-ascii',{},'tu luan, nop vo']] as const){
   await lesson(code,exam,note);await work(sid,code,[receipt(code+'-1',10)]);
  }
  const own=(await rank()).find((r:any)=>r.fullName==='Học sinh tổng hợp 0');assert.equal(own.score,9);assert.equal(own.total,2);
  const snapshot=await rpc('mtm_btvn_read',[session,'self']);assert.equal(snapshot.material.pendingGrading,true);assert.equal(snapshot.lessons.find((l:any)=>l.lessonCode==='self').pendingGrading,true);assert.equal(snapshot.lessons.find((l:any)=>l.lessonCode==='self').bestScore,null);assert.deepEqual(snapshot.officialGrades,{});
  await work(peer,'auto',[]);await work(peer,'not-due',[]);await work(peer,'self',[receipt('peer-self',10)]);
  assert.equal((await rank()).some((r:any)=>r.fullName==='Học sinh tổng hợp 1'),false,'Chỉ có điểm tạm thì chưa có hạng');
 });
 await check('Owner chấm tổng chính thức khác điểm máy, gồm điểm 0; biên nhận gốc giữ nguyên',async()=>{
  const before=await scalar("select receipts from mtm_hw_private.btvn_work where student_id=$1 and lesson_code='self'",[sid]);
  await grade('self','self-1',6);await grade('notebook','notebook-1',0);
  let rows=await rank(),own=rows.find((r:any)=>r.fullName==='Học sinh tổng hợp 0');assert.equal(own.score,6);assert.equal(own.total,4);assert.equal(own.submitted,4);
  const snapshot=await rpc('mtm_btvn_read',[session,'notebook']);assert.deepEqual(snapshot.officialGrades,{'notebook-1':0});assert.equal(snapshot.material.pendingGrading,false);assert.equal(snapshot.lessons.find((l:any)=>l.lessonCode==='notebook').bestScore,0);
  assert.deepEqual(await scalar("select receipts from mtm_hw_private.btvn_work where student_id=$1 and lesson_code='self'",[sid]),before);
  await grade('self','self-1',10);rows=await rank();assert.equal(rows.find((r:any)=>r.fullName==='Học sinh tổng hợp 0').score,7);
 });
 await check('Đối soát late không mất grade; thay nguồn biên nhận hoặc đề thì grade cũ hết hiệu lực',async()=>{
  await db.query("update mtm_hw_private.btvn_work set receipts=jsonb_set(receipts,'{0,late}','true') where student_id=$1 and lesson_code='self'",[sid]);
  assert.deepEqual((await rpc('mtm_btvn_read',[session,'self'])).officialGrades,{'self-1':10});
  await db.query("update mtm_hw_private.btvn_work set receipts=jsonb_set(receipts,'{0,elapsedSeconds}','61') where student_id=$1 and lesson_code='self'",[sid]);
  assert.deepEqual((await rpc('mtm_btvn_read',[session,'self'])).officialGrades,{});await grade('self','self-1',10);
  await db.exec("update mtm_hw_private.btvn_lessons set exam=exam||'{\"versionHash\":\"v2\"}' where code='self'");
  assert.deepEqual((await rpc('mtm_btvn_read',[session,'self'])).officialGrades,{});
 });
 await check('MTM hợp lệ dùng tổng chính thức, kể cả phân số 10/3; snapshot pending và mâu thuẫn không xếp hạng',async()=>{
  await lesson('mtm',{rubricVersion:MTM_SCORING_VERSION});const valid=mtmReceipt('mtm-1');await work(sid,'mtm',[valid]);
  assert.equal(Number(await scalar('select mtm_hw_private.btvn_receipt_official_score($1,$2,$3)',[JSON.stringify(valid),JSON.stringify({rubricVersion:MTM_SCORING_VERSION}),'{}'])),3.33);
  for(const mutate of [
   (r:any)=>{r.mtm.pending=[{code:'WAIT',message:'Chờ chấm'}];},
   (r:any)=>{r.mtm.officialTotal=null;},(r:any)=>{r.mtm.rows[0].status='ungradable';},
   (r:any)=>{r.mtm.officialDisplayTotal='9.00';r.score=9;},(r:any)=>{r.mtm.rawTotal={numerator:'10',denominator:'1'};},
   (r:any)=>{r.mtm.rows[0].earned={numerator:'0',denominator:'1'};},(r:any)=>{r.mtm.attemptId='another';},
   (r:any)=>{delete r.mtm.rows[0].type;},(r:any)=>{r.mtm.sections[0].rawTotal={numerator:'10',denominator:'1'};},
   (r:any)=>{delete r.mtm.rows[0].correctCount;},
  ]){const bad=structuredClone(valid);mutate(bad);assert.equal(await scalar('select mtm_hw_private.btvn_receipt_official_score($1,$2,$3)',[JSON.stringify(bad),JSON.stringify({rubricVersion:MTM_SCORING_VERSION}),'{}']),null);}
  const pending:any=structuredClone(valid);pending.mtm.pending=[{code:'WAIT',message:'Chờ chấm'}];pending.mtm.officialTotal=null;pending.mtm.officialDisplayTotal=null;pending.score=null;
  await work(peer,'mtm',[pending]);assert.equal((await rank()).some((r:any)=>r.fullName==='Học sinh tổng hợp 1'),false);
  await grade('mtm','mtm-1',4,peer);assert.equal((await rank()).some((r:any)=>r.fullName==='Học sinh tổng hợp 1'),true);
 });
 await check('Lượt pending mới không thay điểm chính thức cũ và không bị ORDER BY NULL chọn nhầm',async()=>{
  const valid=mtmReceipt('mtm-old'),pending:any=structuredClone(valid);pending.attemptId='mtm-new';pending.score=null;pending.mtm.attemptId='mtm-new';pending.mtm.pending=[{code:'WAIT',message:'Chờ'}];pending.mtm.officialTotal=null;pending.mtm.officialDisplayTotal=null;
  await work(sid,'mtm',[valid,pending]);const score=await scalar("select max(score) from mtm_hw_private.btvn_official_receipts($1,'mtm')",[sid]);assert.equal(Number(score),3.33);
 });
 await check('Giữ metadata hồ sơ 025, ẩn ảnh và loại dữ liệu nội bộ khỏi hàng công khai',async()=>{
  await db.query("insert into mtm_hw_private.student_appearance(student_id,avatar,school,photo_hidden) values($1,'spark','Trường tự nhập',true)",[sid]);
  const own=(await rank()).find((r:any)=>r.fullName==='Học sinh tổng hợp 0');assert.equal(own.school,'Trường tự nhập');assert.equal(own.avatar,'spark');assert.equal(own.photo,null);
  for(const field of ['id','studentId','phone','attemptId','receipt_hash','officialGrades'])assert.equal(field in own,false);
 });
 await check('Điểm tháng manual trước giờ đóng không lộ trong snapshot, sau đóng đọc được',async()=>{
  await lesson('monthly',{questions:[{kind:'self'}]},'','kiem-tra-thang');await work(sid,'monthly',[receipt('monthly-1',10)]);await grade('monthly','monthly-1',7);
  let snapshot=await rpc('mtm_btvn_read',[session,'monthly']);assert.deepEqual(snapshot.officialGrades,{});assert.equal(snapshot.lessons.find((l:any)=>l.lessonCode==='monthly').bestScore,null);
  assert.deepEqual(await rpc('mtm_btvn_leaderboard',['2K9','kiem-tra-thang','2026-10']),[],'Điểm web chưa đóng không lộ qua hạng');
  await db.exec("update mtm_hw_private.btvn_lessons set opens_at=clock_timestamp()-interval '2 hours',closes_at=clock_timestamp()-interval '1 hour' where code='monthly'");
  snapshot=await rpc('mtm_btvn_read',[session,'monthly']);assert.deepEqual(snapshot.officialGrades,{'monthly-1':7});
  assert.equal((await rpc('mtm_btvn_leaderboard',['2K9','kiem-tra-thang','2026-10']))[0].score,7);
 });
 await check('Metadata grade theo đúng material predecessor chọn; lớp chưa có bài giữ material null',async()=>{
  await lesson('selection-a',{questions:[{kind:'self'}]});await lesson('selection-b',{questions:[{kind:'self'}]});
  await db.exec("update mtm_hw_private.btvn_lessons set material=material||'{\"date\":\"2026-12-01\",\"classDates\":{\"2K9 9+\":\"2026-10-16\"}}' where code='selection-a'");
  await db.exec("update mtm_hw_private.btvn_lessons set material=material||'{\"date\":\"2026-11-01\",\"classDates\":{\"2K9 9+\":\"2026-12-16\"}}' where code='selection-b'");
  await work(sid,'selection-a',[receipt('selected-a',1)]);await work(sid,'selection-b',[receipt('selected-b',2)]);
  await grade('selection-a','selected-a',3);await grade('selection-b','selected-b',4);
  for(const requested of [null,'selection-b']){
   const snapshot=await rpc('mtm_btvn_read',[session,requested]);const code=snapshot.material.lessonCode;
   assert.deepEqual(snapshot.officialGrades,code==='selection-a'?{'selected-a':3}:{'selected-b':4});
  }
  const emptyClass=await scalar("insert into mtm_hw_private.classes(owner_id,label,grade) values($1,'2K10 9+',11) returning id",[owner]);
  await db.query("insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone) values($1,$2,'Học sinh chưa có bài','Tổng hợp','Tổng hợp','MTM-999999999999','0900000099')",[owner,emptyClass]);
  const login=await rpc('mtm_btvn_forgot',['Học sinh chưa có bài','0900000099','2K10 9+']);const snapshot=await rpc('mtm_btvn_read',[login.session,null]);
  assert.equal(snapshot.material,undefined);assert.equal(snapshot.exam,undefined);assert.deepEqual(snapshot.officialGrades,{});assert.deepEqual(snapshot.lessons,[]);
  // Predecessor hiện tại bỏ field khi lớp chưa có bài. Mô phỏng cả phiên bản
  // trả JSON null để bảo đảm wrapper không biến null thành object pending.
  const predecessor=await scalar("select pg_get_functiondef('public.mtm_btvn_read_before_official_rank(text,text)'::regprocedure)");
  try{
   await db.exec(`create or replace function public.mtm_btvn_read_before_official_rank(p_session text,p_lesson text default null) returns jsonb language sql security definer set search_path='' as $$select '{"material":null,"exam":null,"lessons":[]}'::jsonb$$`);
   const nullable=await rpc('mtm_btvn_read',[login.session,null]);assert.equal(nullable.material,null);assert.equal(nullable.exam,null);assert.deepEqual(nullable.officialGrades,{});
  }finally{await db.exec(predecessor);}
 });
 await check('RPC chấm bị khóa cho service_role, publisher, anon; owner khác và lượt không duy nhất bị từ chối',async()=>{
  for(const role of ['anon','service_role','mtm_btvn_publisher'])await denied(()=>rpc('mtm_btvn_grade_attempt',[sid,'self','self-1',5,true],role));
  await denied(()=>rpc('mtm_btvn_grade_attempt',[sid,'self','self-1',5,true],'authenticated',other));
  await denied(()=>rpc('mtm_btvn_grade_attempt',[sid,'self','self-1',5,true],'authenticated'));
  for(const args of [[sid,'self','self-1',5,false],[sid,'self','self-1',11,true],[sid,'self','missing',5,true]])await assert.rejects(()=>rpc('mtm_btvn_grade_attempt',args,'authenticated',owner),(e:any)=>e.code==='22023');
  await work(sid,'essay',[receipt('duplicate',1),receipt('duplicate',2)]);await assert.rejects(()=>grade('essay','duplicate',8),(e:any)=>e.code==='22023');
  for(const role of ['anon','authenticated','service_role','mtm_btvn_publisher']){
   assert.equal(await scalar("select has_table_privilege($1,'mtm_hw_private.btvn_manual_grades','select')",[role]),false);
   assert.equal(await scalar("select has_function_privilege($1,'mtm_hw_private.btvn_official_receipts(uuid,text)','execute')",[role]),false);
   assert.equal(await scalar("select has_function_privilege($1,'public.mtm_btvn_read_before_official_rank(text,text)','execute')",[role]),false);
  }
 });
 mkdirSync(join(root,'.qa-temp/ho-so'),{recursive:true});writeFileSync(join(root,'.qa-temp/ho-so/official-rank-sql-results.json'),JSON.stringify({passed:checks.length,checks,database:'PGlite PostgreSQL WASM trong RAM',realData:false,network:false,migrationAppliedToCloud:false},null,2)+'\n');
}finally{await db.close();}
