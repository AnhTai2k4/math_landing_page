// Chỉ DB trong bộ nhớ và fixture tổng hợp; không đọc env/roster, không mạng.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,join,isAbsolute} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const pkg=process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules/@electric-sql/pglite';
assert.ok(isAbsolute(pkg),'MTM_PGLITE_DIR phải là đường dẫn tuyệt đối');
const {PGlite}=await import(pathToFileURL(join(pkg,...(pkg.replaceAll('\\','/').endsWith('/node_modules')?['@electric-sql/pglite']:[]),'dist/index.js')).href);
const db=new PGlite(); // Không dataDir: DB bị huỷ khi đóng.
const out=join(root,'.qa-temp/dot-16/sql');mkdirSync(out,{recursive:true});
const results=[],migrations=[];let currentCheck='Khởi tạo';
const hash=s=>createHash('sha256').update(s).digest('hex');
const query=(sql,args=[])=>db.query(sql,args);
const scalar=async(sql,args=[])=>Object.values((await query(sql,args)).rows[0])[0];
async function check(name,fn){currentCheck=name;await fn();results.push({name,status:'PASS'});console.log('ĐẠT: '+name);}
async function rejected(fn,code){await assert.rejects(fn,e=>!code||e.code===code);}
// Named RPC dispatch is SQL, not a mock result. Role/uid set inside the same transaction.
async function rpc(name,args={},role='service_role',uid=''){
  assert.match(name,/^mtm_[a-z0-9_]+$/);assert.ok(['service_role','authenticated','anon'].includes(role));
  const keys=Object.keys(args);keys.forEach(k=>assert.match(k,/^p_[a-z0-9_]+$/));
  return db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[uid]);
    const values=keys.map(k=>args[k]!==null&&typeof args[k]==='object'?JSON.stringify(args[k]):args[k]);
    const sql=`select public.${name}(${keys.map((k,i)=>k+' => $'+(i+1)).join(',')}) as data`;
    return (await tx.query(sql,values)).rows[0].data;
  });
}
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const admin=(name,args)=>rpc(name,args,'authenticated',owner);
let cid,sids=[],oldCodes=[],session;
try{
  await check('Supabase giả tối thiểu và 17 migration nguyên văn, đúng thứ tự',async()=>{
    await db.exec(`create role anon;create role authenticated;create role service_role;create role authenticator;
      create schema auth;create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated,service_role;
      grant execute on function auth.uid() to anon,authenticated,service_role;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,metadata jsonb);
      alter table storage.objects enable row level security;`);
    const files=readdirSync(join(root,'supabase/migrations')).filter(x=>x.endsWith('.sql')).sort().map(x=>'supabase/migrations/'+x);
    assert.equal(files.length,4);files.push(...readdirSync(join(root,'supabase/migrations-pending')).filter(f=>f.endsWith('.sql')).sort((a,b)=>{const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));}).map(f=>'supabase/migrations-pending/'+f));
    for(const file of files){const sql=readFileSync(join(root,file),'utf8').replace(/^\uFEFF/,'');await db.exec(sql);migrations.push({file,sha256:hash(sql)});}
    console.log('DB: '+await scalar('select version()'));
  });
  // Tất cả tên/SĐT/UUID bên dưới là dữ liệu giả được tạo ngay trong DB mới.
  await query('insert into auth.users values($1),($2)',[owner,other]);
  await query('insert into public.mtm_exam_admins(user_id) values($1),($2)',[owner,other]);
  cid=await admin('mtm_hw_admin_class',{p_label:'Lớp giả SQL',p_grade:12});
  for(let i=0;i<7;i++){
    const s=await admin('mtm_hw_admin_student',{p_id:null,p_class_id:cid,p_name:'Học sinh giả '+i,p_school:'Trường giả',p_school_class:'12 giả'});
    sids.push(s.id);
    await query('update mtm_hw_private.students set student_phone=$1,parent_phone=$2,source_identity=$3 where id=$4',['090000000'+i,'091000000'+i,'sql-fake-'+i,s.id]);
  }
  for(let i=0;i<3;i++)oldCodes.push(await admin('mtm_hw_admin_issue_code',{p_student_id:sids[i],p_days:90}));
  await query("update mtm_hw_private.codes set expires_at=clock_timestamp()-interval '1 second' where id=$1",[oldCodes[1].codeId]);
  await admin('mtm_hw_admin_revoke_code',{p_code_id:oldCodes[2].codeId});
  await check('Resolve mã cũ active / expired / revoked và confirm',async()=>{
    const good=await rpc('mtm_hw_resolve_code',{p_code:oldCodes[0].code});assert.equal(good.ok,true);
    const confirmed=await rpc('mtm_hw_confirm',{p_challenge:good.challenge,p_confirm:true});assert.equal(confirmed.ok,true);session=confirmed.session;
    assert.equal((await rpc('mtm_hw_confirm',{p_challenge:good.challenge,p_confirm:true})).ok,false);
    for(const c of oldCodes.slice(1))assert.equal((await rpc('mtm_hw_resolve_code',{p_code:c.code})).ok,false);
    assert.equal((await rpc('mtm_hw_resolve_code',{p_code:'bad'})).ok,false);
  });
  const identity={p_full_name:'  HỌC   SINH GIẢ 0 ',p_phone:'+84 900 000 000',p_class_name:' LỚP GIẢ SQL '};
  let identitySession;
  await check('Tên + SĐT + lớp: chuẩn hoá, SĐT phụ huynh, sai/trùng/inactive',async()=>{
    const mismatch=await rpc('mtm_btvn_forgot',{...identity,p_class_name:'Sai'});assert.equal(mismatch.ok,true);assert.equal(mismatch.classMismatch,true);
    const good=await rpc('mtm_btvn_forgot',identity);assert.equal(good.ok,true);identitySession=good.session;
    assert.equal((await rpc('mtm_btvn_forgot',{...identity,p_phone:'0910000000'})).ok,true);
    for(const change of [{p_full_name:'Sai'},{p_phone:'0909999999'},{p_phone:'x'}])assert.deepEqual(await rpc('mtm_btvn_forgot',{...identity,...change}),{ok:false});
    await query('update mtm_hw_private.students set full_name=$1,student_phone=$2 where id=$3',['Học sinh giả 0','0900000000',sids[6]]);
    assert.deepEqual(await rpc('mtm_btvn_forgot',identity),{ok:false});
    await query('update mtm_hw_private.students set active=false where id=$1',[sids[6]]);
    assert.equal((await rpc('mtm_btvn_forgot',identity)).ok,true);
    await query('update mtm_hw_private.classes set active=false where id=$1',[cid]);assert.deepEqual(await rpc('mtm_btvn_forgot',identity),{ok:false});
    await query('update mtm_hw_private.classes set active=true where id=$1',[cid]);
  });
  await check('Danh sách lớp và quyền RPC/bảng riêng',async()=>{
    assert.deepEqual(await rpc('mtm_btvn_classes'),['Lớp giả SQL']);
    for(const role of ['anon','authenticated'])await rejected(()=>rpc('mtm_btvn_classes',{},role),'42501');
    await rejected(()=>rpc('mtm_btvn_issue_missing_code',{p_student_id:sids[3],p_days:90}),'42501');
    await rejected(()=>rpc('mtm_btvn_issue_missing_code',{p_student_id:sids[3],p_days:90},'authenticated',other),'42501');
    await rejected(()=>db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query('select * from mtm_hw_private.students');}),'42501');
  });
  await check('Limiter SQL 120/15 phút và reset cửa sổ',async()=>{
    const key='a'.repeat(64);
    for(let i=1;i<=122;i++)assert.equal((await rpc('mtm_btvn_gateway_rate',{p_network_key:key})).ok,i<=120);
    assert.equal(await scalar('select hits from mtm_hw_private.btvn_limits where network_key=$1',[key]),122);
    assert.deepEqual(await rpc('mtm_btvn_gateway_rate',{p_network_key:'bad'}),{ok:false});
    await query("update mtm_hw_private.btvn_limits set until_at=clock_timestamp()-interval '1 second' where network_key=$1",[key]);
    assert.equal((await rpc('mtm_btvn_gateway_rate',{p_network_key:key})).ok,true);
    assert.equal(await scalar('select hits from mtm_hw_private.btvn_limits where network_key=$1',[key]),1);
  });
  await check('Cấp mã thiếu, giữ active/expired/revoked, hai lệnh liên tiếp',async()=>{
    for(const sid of sids.slice(0,3))assert.deepEqual(await admin('mtm_btvn_issue_missing_code',{p_student_id:sid,p_days:90}),{ok:true,preserved:true});
    const first=await admin('mtm_btvn_issue_missing_code',{p_student_id:sids[3],p_days:90});assert.equal(first.preserved,false);assert.match(first.code,/^HS-[0-9A-F]{32}$/);
    assert.deepEqual(await admin('mtm_btvn_issue_missing_code',{p_student_id:sids[3],p_days:90}),{ok:true,preserved:true});
    const second=await admin('mtm_btvn_issue_missing_code',{p_student_id:sids[4],p_days:90});assert.notEqual(first.code,second.code);
    assert.equal(await scalar('select count(*)::int from mtm_hw_private.codes where student_id=$1',[sids[3]]),1);
    assert.equal((await rpc('mtm_hw_resolve_code',{p_code:first.code.slice(3)})).ok,true);
    await rejected(()=>admin('mtm_btvn_issue_missing_code',{p_student_id:sids[5],p_days:0}));
    assert.equal(await scalar('select count(*)::int from mtm_hw_private.codes where student_id=$1',[sids[5]]),0);
  });
  // Bundle các lớp thật bằng esbuild đã có; không cài gói, không sửa node_modules.
  const require=createRequire(join(root,'package.json'));const {build}=require('esbuild');
  const bundle=await build({stdin:{contents:"export {SupabaseHomeworkRepository} from './server/btvn/supabase-repository';export {createHomeworkHandler} from './supabase/functions/mtm-homework-access/handler';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
  const bundlePath=join(out,'adapter.mjs');writeFileSync(bundlePath,bundle.outputFiles[0].text);
  const {SupabaseHomeworkRepository,createHomeworkHandler}=await import(pathToFileURL(bundlePath).href);
  const transport={async rpc(name,args){try{return {data:await rpc(name,args),error:null};}catch(e){console.error('SQL RPC '+name+': '+e.message+' ('+e.code+') '+(e.where??'')+' '+(e.internalPosition??''));return {data:null,error:{code:e.code}};}}};
  const makeEdge=key=>createHomeworkHandler({publishableKey:'fake-key',origins:['https://sql.invalid'],networkKey:async()=>key,rpc:transport.rpc,download:async()=>{throw new Error('Không tải file/mạng trong bộ SQL');}});
  const edgeRequest=async(edge,body)=>{const r=await edge(new Request('https://sql.invalid',{method:'POST',headers:{Origin:'https://sql.invalid',apikey:'fake-key','Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:r.status,body:await r.json()};};
  await check('Edge thật → limiter SQL chung resolve/forgot',async()=>{
    const edge=makeEdge('b'.repeat(64));
    for(let i=0;i<120;i++){const r=await edgeRequest(edge,i%2?{operation:'forgot',fullName:'Học sinh giả 0',phone:'0900000000',className:'Lớp giả SQL'}:{operation:'resolve',code:'bad'});assert.equal(r.status,i%2?200:400);}
    assert.equal((await edgeRequest(edge,{operation:'forgot',fullName:'Học sinh giả 0',phone:'0900000000',className:'Lớp giả SQL'})).status,429);
    assert.equal(await scalar('select hits from mtm_hw_private.btvn_limits where network_key=$1',['b'.repeat(64)]),121);
  });
  const exam=JSON.parse(readFileSync(join(root,'server/btvn/demo-exam.json'),'utf8'));
  const material={lessonCode:'buoi-gia-sql',date:'2026-10-14',classDates:{'Lớp giả SQL':'2026-10-15'},title:'Buổi giả SQL',classNames:['Lớp giả SQL'],videoId:'abcdefghijk',materialUrl:null,handoutUrl:null,homeworkUrl:null};
  await query('insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values($1,$2,ARRAY[$3::uuid],$4,$5,true,\'da_dang\')',[material.lessonCode,owner,cid,JSON.stringify(material),JSON.stringify(exam)]);
  const edge=makeEdge('c'.repeat(64));let now=Date.parse('2026-10-15T10:00:00+07:00');
  const repo=new SupabaseHomeworkRepository(transport,async body=>{const r=await edgeRequest(edge,body);assert.equal(r.status,200);return r.body;},()=>now);
  const adminRepo=new SupabaseHomeworkRepository({async rpc(name,args){try{return {data:await admin(name,args),error:null};}catch(e){return {data:null,error:{code:e.code}};}}},async()=>{throw new Error('Admin không login Edge');});
  await check('Adapter thật → SQL: lượt, lưu/mở lại, điểm, 120 phút, giới hạn 5',async()=>{
    session=await repo.login({studentCode:'HS-'+oldCodes[0].code});
    let state=await repo.call(session,'state',material.lessonCode);assert.equal(state.attemptsUsed,0);assert.equal(state.dueAt,null);assert.equal(state.lessons[0].date,'2026-10-15');
    state=await repo.call(session,'start',material.lessonCode);const id=state.draft.attemptId;assert.equal(state.draft.deadline-state.draft.startedAt,120*60000);
    assert.equal((await repo.call(session,'start',material.lessonCode)).draft.attemptId,id);
    const q=exam.questions.find(q=>q.kind==='mc');assert.ok(q);const answers={[q.id]:q.answer};
    state=await repo.call(session,'save',material.lessonCode,id,answers);
    const reopened=new SupabaseHomeworkRepository(transport,async()=>{throw new Error('Không cần login lại');},()=>now);
    assert.deepEqual((await reopened.call(session,'state',material.lessonCode)).draft.answers,answers);
    now+=1000;state=await repo.call(session,'submit',material.lessonCode,id,answers);assert.equal(state.receipts.length,1);assert.equal(state.receipts[0].score,0.25);assert.equal(state.receipts[0].late,null);
    assert.equal((await repo.call(session,'submit',material.lessonCode,id,answers)).receipts.length,1);
    state=await repo.call(session,'start',material.lessonCode);now=state.draft.deadline;state=await repo.call(session,'submit',material.lessonCode,state.draft.attemptId,answers);assert.equal(state.receipts[1].timedOut,true);assert.equal(state.receipts[1].score,0);
    for(let i=3;i<=5;i++){state=await repo.call(session,'start',material.lessonCode);now+=1000;state=await repo.call(session,'submit',material.lessonCode,state.draft.attemptId,{});}
    assert.equal(state.attemptsUsed,5);await assert.rejects(()=>repo.call(session,'start',material.lessonCode),e=>e.status===409);
    assert.equal((await scalar('select jsonb_array_length(drafts) from mtm_hw_private.btvn_work where student_id=$1',[sids[0]])),5);
  });
  await check('Hạn theo người, điểm cao nhất/thẻ và CSV thật từ SQL',async()=>{
    const state=await repo.call(session,'state',material.lessonCode),due=state.receipts[0].submittedAt;
    await adminRepo.reconcileDue(material.lessonCode,sids[0],due,'sql-fake-attendance');
    const next=await repo.call(session,'state',material.lessonCode);assert.equal(next.dueAt,due);assert.equal(next.receipts[0].late,true);assert.equal(next.bestScore,0.25);assert.equal(next.lessons[0].bestScore,0.25);assert.equal(next.lessons[0].late,true);
    await adminRepo.reconcileDue(material.lessonCode,sids[0],now+60000,'sql-fake-attendance-2');assert.ok((await repo.call(session,'state',material.lessonCode)).receipts.every(r=>r.late===false));
    const student2=await repo.login({fullName:'Học sinh giả 3',phone:'0900000003',className:'Lớp giả SQL'});assert.equal((await repo.call(student2,'state',material.lessonCode)).dueAt,null);
    await rejected(()=>admin('mtm_btvn_set_due',{p_student_id:sids[0],p_lesson:material.lessonCode,p_starts_at:new Date(now).toISOString(),p_source_identity:''}),'42501');
    const csv=await adminRepo.scoresFile(material.lessonCode);assert.ok(csv.startsWith('\uFEFF'));assert.equal(csv.trim().split('\r\n').length,6);assert.ok(csv.includes('"0.25"'));assert.ok(csv.includes('"dung_han"'));assert.ok(csv.includes(new Date(now+60000).toISOString()));
    writeFileSync(join(out,'diem-gia.csv'),csv);
  });
  await check('CAS stale và rollback transaction sau lỗi SQL thật',async()=>{
    const snapshot=await rpc('mtm_btvn_read',{p_session:session,p_lesson:material.lessonCode});
    assert.deepEqual(await rpc('mtm_btvn_commit',{p_session:session,p_lesson:material.lessonCode,p_revision:snapshot.revision-1,p_drafts:[],p_receipts:[]}),{ok:false});
    const before=await scalar('select count(*)::int from mtm_hw_private.codes');
    await rejected(()=>db.transaction(async tx=>{
      await tx.exec('set local role authenticated');await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[owner]);
      await tx.query('select public.mtm_btvn_issue_missing_code($1,90)',[sids[5]]);
      await tx.query('select 1/0');
    }),'22012');
    assert.equal(await scalar('select count(*)::int from mtm_hw_private.codes'),before);
    assert.deepEqual(await rpc('mtm_btvn_read',{p_session:session,p_lesson:material.lessonCode}),snapshot);
    await rejected(()=>db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      const committed=(await tx.query('select public.mtm_btvn_commit($1,$2,$3,$4,$5) as data',[session,material.lessonCode,snapshot.revision,'[]','[]'])).rows[0].data;
      assert.equal(committed.ok,true);await tx.query('select 1/0');
    }),'22012');
    assert.deepEqual(await rpc('mtm_btvn_read',{p_session:session,p_lesson:material.lessonCode}),snapshot);
    await rejected(()=>rpc('mtm_btvn_commit',{p_session:session,p_lesson:material.lessonCode,p_revision:snapshot.revision,p_drafts:Array(6).fill({}),p_receipts:[]}));
    assert.deepEqual(await rpc('mtm_btvn_read',{p_session:session,p_lesson:material.lessonCode}),snapshot);
  });
  await check('Logout mã cũ/identity và session hết hạn/thu hồi',async()=>{
    await rpc('mtm_btvn_logout',{p_session:session});await rejected(()=>rpc('mtm_btvn_read',{p_session:session,p_lesson:material.lessonCode}),'42501');
    await rpc('mtm_btvn_logout',{p_session:identitySession});await rejected(()=>rpc('mtm_btvn_read',{p_session:identitySession,p_lesson:material.lessonCode}),'42501');
    const fresh=await rpc('mtm_btvn_forgot',identity);await query("update mtm_hw_private.btvn_identity_sessions set expires_at=clock_timestamp()-interval '1 second' where digest=mtm_hw_private.token_digest('btvn-identity',$1)",[fresh.session]);
    await rejected(()=>rpc('mtm_btvn_read',{p_session:fresh.session,p_lesson:material.lessonCode}),'42501');
  });
  writeFileSync(join(out,'receipt.json'),JSON.stringify({at:new Date().toISOString(),database:'PGlite in-memory',migrations,results,cloud:false,realStudentData:false},null,2)+'\n');
  console.log(`ĐẠT ${results.length}/${results.length} nhóm; receipt: ${join(out,'receipt.json')}`);
}catch(error){
  results.push({name:currentCheck,status:'FAIL'});
  writeFileSync(join(out,'receipt.json'),JSON.stringify({at:new Date().toISOString(),migrations,results,error:{message:error.message,code:error.code},cloud:false},null,2)+'\n');
  console.error('LỖI:',error.message,error.code??'');process.exitCode=1;
}finally{await db.close();}
