// Dữ liệu giả, PGlite RAM, không mạng và không đọc dữ liệu học sinh thật.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
const {PGlite}=await import(pathToFileURL(join(process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules','@electric-sql/pglite/dist/index.js')).href);
const {fuzzystrmatch}=await import(pathToFileURL(join(process.env.MTM_PGLITE_DIR??'T:/Claude/SanPham/btvn-web-diem-danh/tools-sql/node_modules','@electric-sql/pglite/dist/contrib/fuzzystrmatch.js')).href);
const db=new PGlite({extensions:{fuzzystrmatch}}),checks=[];
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0];
const rpc=(payload,apply=true,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query('select public.mtm_btvn_sync_due($1,$2) result',[JSON.stringify(payload),apply])).rows[0].result;});
const check=async(name,fn)=>{await fn();checks.push(name);console.log('ĐẠT: '+name);};
const owner='11111111-1111-4111-8111-111111111111';
const config=JSON.parse(readFileSync('server/btvn/class-rules.json','utf8'));
const fixtures={};
const session=(label,day,status='C',extra={})=>({label,startsAt:day,sourceIdentity:`fixture:${label}:${day}`,attendees:status===null?[]:[{name:'Học sinh GIẢ',phone:fixtures[label].phone,status}],...extra});
const work=label=>db.query('select * from mtm_hw_private.btvn_work where student_id=$1 and lesson_code=$2',[fixtures[label].sid,fixtures[label].code]).then(r=>r.rows[0]);
const sameTime=(value,expected)=>assert.equal(value==null?null:Date.parse(value),expected==null?null:Date.parse(expected));
try{
 await check('Áp dụng mọi migration nguyên văn trong PGlite RAM',async()=>{
  const original=readFileSync('scripts/test-btvn-round18.mjs','utf8');
  const bootstrap=original.match(/await db.exec\(`(create role anon;[\s\S]+?)`\);/)[1];await db.exec(bootstrap);await db.exec('create schema extensions');
  for(const dir of ['supabase/migrations','supabase/migrations-pending'])for(const f of readdirSync(dir).filter(f=>f.endsWith('.sql')).sort((a,b)=>{const key=f=>f.replace(/^(\d+)_([0-9]+)_/,'$1~$2_').replace(/^(\d+)_/,'$1!_');return key(a).localeCompare(key(b));}))await db.exec(readFileSync(dir+'/'+f,'utf8').replace(/^\uFEFF/,''));
  await db.query('insert into auth.users values($1)',[owner]);
  await db.query("insert into mtm_hw_private.btvn_roster_scope(singleton,owner_id,sheet_id,protected_student_ids) values(true,$1,'fixture',array[gen_random_uuid(),gen_random_uuid()])",[owner]);
  for(const [i,label] of ['2K9 9+','2K9 8+','2K10 9+','2K10 8+'].entries()){
   const cls=await scalar('insert into mtm_hw_private.classes(owner_id,label,grade) values($1,$2,12) returning id',[owner,label]),phone='090000000'+i;
   const sid=await scalar("insert into mtm_hw_private.students(owner_id,class_id,full_name,school,school_class,public_alias,student_phone,source_identity) values($1,$2,'Học sinh GIẢ','GIẢ','GIẢ',$3,$4,$5) returning id",[owner,cls,'MTM-'+String(i).padStart(12,'0'),phone,'fixture:'+i]);
   const code='due-'+i;fixtures[label]={cls,sid,phone,code};
   await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status) values($1,$2,$3,$4,'{}',true,'da_dang')",[code,owner,[cls],JSON.stringify({lessonCode:code,date:label.startsWith('2K9')?'2026-10-12':'2026-10-16'})]);
   await db.query('insert into mtm_hw_private.btvn_work(student_id,lesson_code,receipts) values($1,$2,$3)',[sid,code,JSON.stringify([{score:8,submittedAt:Date.parse('2026-10-14T17:30:00+07:00')}])]);
  }
 });
 await check('SQL khớp hàm TS cho mọi lớp, mọi ngày qua tuần/tháng/năm và ca T6/CN',async()=>{
  const built=await build({entryPoints:['server/btvn/class-rules.ts'],bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  const {plannedDueAt}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
  let count=0;for(const label of Object.keys(config.classes))for(const start of ['2026-10-12','2026-10-26','2026-12-28'])for(let i=0;i<7;i++)for(const slot of [null,5,7]){
   const day=new Date(Date.parse(start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
   const expected=plannedDueAt(label,day,slot??undefined);
   sameTime(await scalar('select mtm_hw_private.btvn_planned_due($1,$2,$3,$4)',[label,day,slot,config]),expected);
   sameTime(await scalar('select mtm_hw_private.btvn_planned_due($1,$2,$3)',[label,day,slot]),expected);count++;
  }
  assert.equal(count,Object.keys(config.classes).length*63);
  sameTime(await scalar("select mtm_hw_private.btvn_planned_due('2K9 9+','2026-10-12')"),'2026-10-14T17:30:00+07:00');
 });
 await check('Hạn cặp không lấy buổi ngày kế; hạn thật chỉ đúng lớp/khung C/M/ON',async()=>{
  await rpc({sessions:[session('2K9 9+','2026-10-12T17:30:00+07:00'),session('2K9 9+','2026-10-13T17:30:00+07:00'),session('2K9 9+','2026-10-14T19:30:00+07:00'),session('2K9 9+','2026-10-14T17:30:00+07:00')]});
  const w=await work('2K9 9+');sameTime(w.expected_due_at,'2026-10-14T17:30:00+07:00');sameTime(w.next_actual_class_at,'2026-10-14T17:30:00+07:00');assert.equal(w.receipts[0].late,true);
 });
 await check('Snapshot cũ thiếu ngày hạn giữ actual/source/late đã đối soát',async()=>{
  const before=await work('2K9 9+');await rpc({sessions:[session('2K9 9+','2026-10-12T17:30:00+07:00')]});assert.deepEqual(await work('2K9 9+'),before);
 });
 await check('Dry run rollback đầy đủ; apply lặp không tăng revision',async()=>{
  const before=await work('2K9 9+'),payload={sessions:[session('2K9 9+','2026-10-14T17:30:00+07:00','L')]};
  assert.equal((await rpc(payload,false)).applied,false);assert.deepEqual(await work('2K9 9+'),before);
  await rpc(payload);const once=await work('2K9 9+');await rpc(payload);assert.deepEqual(await work('2K9 9+'),once);sameTime(once.expected_due_at,'2026-10-14T17:30:00+07:00');assert.equal(once.next_actual_class_at,null);assert.equal(once.receipts[0].late,null);
 });
 await check('Vắng L/K không dời hạn sang buổi khác; snapshot rỗng giữ nguyên',async()=>{
  await rpc({sessions:[session('2K9 9+','2026-10-14T17:30:00+07:00','K'),session('2K9 9+','2026-10-16T17:30:00+07:00')]});
  const before=await work('2K9 9+');sameTime(before.expected_due_at,'2026-10-14T17:30:00+07:00');assert.equal(before.next_actual_class_at,null);await rpc({sessions:[]});assert.deepEqual(await work('2K9 9+'),before);
 });
 await check('Nghỉ rõ ràng dời cùng thứ/giờ, bỏ buổi khác và ca giờ khác',async()=>{
  await rpc({sessions:[session('2K9 9+','2026-10-14T17:30:00+07:00',null,{cancelled:true}),session('2K9 9+','2026-10-16T17:30:00+07:00'),session('2K9 9+','2026-10-21T19:30:00+07:00'),session('2K9 9+','2026-10-21T17:30:00+07:00','ON')]});
  const w=await work('2K9 9+');sameTime(w.expected_due_at,'2026-10-21T17:30:00+07:00');sameTime(w.next_actual_class_at,'2026-10-21T17:30:00+07:00');assert.equal(w.receipts[0].late,false);
 });
 await check('Chuyển buổi explicit replacesAt có thể chuyển trước hạn kế hoạch',async()=>{
  await rpc({sessions:[session('2K9 9+','2026-10-13T18:00:00+07:00','M',{replacesAt:'2026-10-14T17:30:00+07:00'})]});
  const w=await work('2K9 9+');sameTime(w.expected_due_at,'2026-10-13T18:00:00+07:00');sameTime(w.next_actual_class_at,'2026-10-13T18:00:00+07:00');
 });
 await check('2K10 buổi 2 chọn ca tuần bài; không đoán từ tuần trước/sau hay hai ca',async()=>{
  for(const [source,target] of [['2026-10-16T19:30:00+07:00','2026-10-23T19:30:00+07:00'],['2026-10-18T08:00:00+07:00','2026-10-25T08:00:00+07:00']]){
   await rpc({sessions:[session('2K10 9+',source),session('2K10 9+',target)]});const w=await work('2K10 9+');sameTime(w.expected_due_at,target);sameTime(w.next_actual_class_at,target);
  }
  for(const sessions of [[session('2K10 9+','2026-10-09T19:30:00+07:00'),session('2K10 9+','2026-10-23T19:30:00+07:00')],[session('2K10 9+','2026-10-16T19:30:00+07:00'),session('2K10 9+','2026-10-18T08:00:00+07:00')],[session('2K10 9+','2026-10-16T08:00:00+07:00')],[session('2K10 9+','2026-10-16T19:30:00+07:00','L')]]){
   await rpc({sessions});const w=await work('2K10 9+');assert.equal(w.expected_due_at,null);assert.equal(w.next_actual_class_at,null);
  }
 });
 await check('Hai hồ sơ cùng SĐT: ưu tiên lớp đúng, không mượn actual lớp khác',async()=>{
  await db.query('update mtm_hw_private.students set student_phone=$1 where id=$2',[fixtures['2K9 9+'].phone,fixtures['2K9 8+'].sid]);
  const before=await work('2K9 8+');
  await rpc({sessions:[session('2K9 9+','2026-10-14T17:30:00+07:00')]});
  assert.deepEqual(await work('2K9 8+'),before);
  await db.query('update mtm_hw_private.students set student_phone=$1 where id=$2',[fixtures['2K9 8+'].phone,fixtures['2K9 8+'].sid]);
  await rpc({sessions:[session('2K9 8+','2026-10-15T17:30:00+07:00')]});
  const w=await work('2K9 8+');sameTime(w.expected_due_at,'2026-10-15T17:30:00+07:00');sameTime(w.next_actual_class_at,'2026-10-15T17:30:00+07:00');
 });
 await check('Payload cấu hình là nguồn chuẩn; SQL client cũ có snapshot; validates và quyền',async()=>{
  const altered=structuredClone(config);altered.classes['2K9 9+'].due={type:'same_weekday_next_week'};
  await rpc({classRules:altered,sessions:[session('2K9 9+','2026-10-12T17:30:00+07:00')]});sameTime((await work('2K9 9+')).expected_due_at,'2026-10-19T17:30:00+07:00');
  for(const role of ['anon','authenticated','mtm_btvn_publisher'])await assert.rejects(()=>rpc({sessions:[]},true,role),e=>e.code==='42501');
  for(const extra of [{cancelled:'yes'},{replacesAt:'tomorrow'}])await assert.rejects(()=>rpc({sessions:[session('2K9 9+','2026-10-12T17:30:00+07:00','C',extra)]}));
  await assert.rejects(()=>rpc({classRules:[],sessions:[]}));
  const before=await work('2K9 9+');await db.exec(readFileSync('supabase/migrations-pending/202610150020_btvn_class_due_rules.sql','utf8'));assert.deepEqual(await work('2K9 9+'),before);
 });
 await check('RPC opening_materials chỉ trả metadata đúng owner/phạm vi, loại bài ngoài quyền',async()=>{
  const call=(code=null,role='service_role')=>db.transaction(async tx=>{await tx.exec('set local role '+role);return (await tx.query('select public.mtm_btvn_opening_materials($1) result',[code])).rows[0].result;});
  await db.query('insert into mtm_hw_private.btvn_publish_scope values(true,$1,$2)',[owner,[fixtures['2K9 9+'].cls]]);
  await db.query("update mtm_hw_private.btvn_lessons set material=material||$1::jsonb,exam=$2 where code=$3",[JSON.stringify({classNames:['2K9 9+'],classDates:{'2K9 9+':'2026-10-12'},SECRET:'PRIVATE-MATERIAL',questionImage:'PRIVATE-IMAGE'}),JSON.stringify({questions:[{prompt:'PRIVATE-EXAM'}]}),fixtures['2K9 9+'].code]);
  const other='99999999-9999-4999-8999-999999999999';await db.query('insert into auth.users values($1)',[other]);
  for(const [code,customOwner,ids,active,publish,kind] of [
   ['excluded-foreign',other,[fixtures['2K9 9+'].cls],true,'da_dang','btvn'],
   ['excluded-extra',owner,[fixtures['2K9 9+'].cls,fixtures['2K9 8+'].cls],true,'da_dang','btvn'],
   ['excluded-inactive',owner,[fixtures['2K9 9+'].cls],false,'loi','btvn'],
   ['excluded-unpublished',owner,[fixtures['2K9 9+'].cls],false,'cho_duyet','btvn'],
   ['excluded-monthly',owner,[fixtures['2K9 9+'].cls],true,'da_dang','kiem-tra-thang'],
  ])await db.query("insert into mtm_hw_private.btvn_lessons(code,owner_id,class_ids,material,exam,active,publish_status,kind,opens_at,closes_at) values($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp(),clock_timestamp()+interval '1 hour')",[code,customOwner,ids,JSON.stringify({date:'2026-10-12',SECRET:'PRIVATE'}),JSON.stringify({questions:[{prompt:'PRIVATE'}]}),active,publish,kind]);
  const rows=await call();assert.equal(rows.length,1);assert.equal(rows[0].lessonCode,fixtures['2K9 9+'].code);assert.deepEqual(Object.keys(rows[0]).sort(),['classDates','classNames','date','lessonCode']);
  assert.equal(JSON.stringify(rows).includes('PRIVATE'),false);assert.equal(JSON.stringify(rows).includes('Học sinh'),false);assert.deepEqual(await call(fixtures['2K9 9+'].code),rows);assert.deepEqual(await call('excluded-extra'),[]);
  for(const role of ['anon','authenticated','mtm_btvn_publisher'])await assert.rejects(()=>call(null,role),e=>e.code==='42501');
  for(const code of ['../secret','BAD CODE','x'.repeat(161),"x');drop table x;"])await assert.rejects(()=>call(code));
 });
 mkdirSync('.qa-temp/dot-24',{recursive:true});writeFileSync('.qa-temp/dot-24/due-sql-results.json',JSON.stringify({passed:checks.length,checks,realData:false,network:false},null,2));
}finally{await db.close();}
