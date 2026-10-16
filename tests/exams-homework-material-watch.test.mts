import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,rmSync,existsSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {detectHomework,type MaterialConfig,type SeenHomeworkSource} from '../server/btvn/material-watch';
import {readLessonMaterials,readLessonSources,type LessonSourceConfig} from '../server/btvn/lesson-materials';
import type {MaterialCell} from '../server/btvn/material-cells';

// Dữ liệu tổng hợp, không đọc Sheet, hồ sơ, token hoặc nhật ký thật.
const headers=['Ngày','BTVN','Đáp án','Tài liệu'];
const config:MaterialConfig={sheetId:'FAKE-SHEET',tab:'FAKE-TAB',programKey:'fake',columns:{date:'Ngày',homework:'BTVN',answer:'Đáp án',material:'Tài liệu'}};
const now=Date.parse('2026-10-16T00:00:00Z');
const base='https://example.invalid/base.pdf',answer='https://example.invalid/answer.pdf';
const a='https://example.invalid/part-a.pdf',b='https://example.invalid/part-b.pdf',c='https://example.invalid/extra.pdf';
const row=(date:string,links=[base],key=answer):MaterialCell[]=>[date,{text:'PDF GIẢ',links},key,''];
const run=(rows:MaterialCell[][],seen:string[]=[],cfg=config,sources:SeenHomeworkSource[]=[])=>detectHomework(headers,rows,cfg,seen,now,sources);
const note='Phần trắc nghiệm trong phiếu';
const noteRow=(date:string,text=note):MaterialCell[]=>[date,text,answer,base];

for(const date of ['2026-02-30T21:00:00+07:00','2026-04-31T21:00:00+07:00','2025-02-29T21:00:00+07:00','2026-10-14T24:00:00+07:00','2026-10-14T21:60:00+07:00','2026-10-14T21:00:60+07:00','2026-10-14T21:00:00+07:60','2026-10-14T21:00:00-23:00','2026-10-14T21:00:00+23:00','2026-10-14T21:00:00-12:01','2026-10-14T21:00:00+14:01','2026-10-14T21:00:00-13:00','2026-10-14T21:00:00+15:00','2026-10-14T21:00:00','14/10','2026-10-17T21:00:00+07:00']){
  const result=run([row(date)]);
  assert.equal(result.jobs.length,0,date);
  assert.deepEqual(result.pending,[{row:2,reason:'Cần giờ kết thúc ca đã xác minh'}],date);
}
for(const offset of ['-12:00','-11:59','+13:59','+14:00'])assert.equal(run([row('2026-10-14T21:00:00'+offset)]).jobs.length,1,`Nhận offset hợp lệ ${offset}`);
assert.equal(run([row('2024-02-29T21:00:00+07:00')]).jobs[0].lessonCode,'fake-2024-02-28','Ngày nhuận thật vẫn hợp lệ');
assert.equal(run([row('2026-10-13T23:30:00Z')]).jobs[0].lessonCode,'fake-2026-10-14','Chuyển sang ngày Việt Nam trước ghép ca');
const local=run([row('2026-10-14T21:00:00+07:00')]),utc=run([row('2026-10-14T14:00:00Z')]);
assert.equal(local.jobs[0].id,utc.jobs[0].id,'Hai múi giờ cùng thời điểm giữ một khóa nguồn');
assert.equal(run([row('14/10')],[],{...config,confirmedSessions:{'14/10':'2026-02-30T21:00:00+07:00'}}).pending.length,1,'Ngày sai trong cấu hình xác nhận cũng bị giữ');

const rows=[row('2026-10-12T21:00:00+07:00',[base,a]),row('',[c],''),row('2026-10-13T21:00:00+07:00',[base,b,a]),row('',[c],'')];
const before=JSON.stringify(rows),seen:string[]=[];
const combined=run(rows,seen);
assert.equal(combined.jobs.length,1);
assert.deepEqual(combined.jobs[0].homeworkUrls,[base,a,c,b],'Giữ đủ tệp phụ ở cả hai ca và dòng nối, đúng thứ tự gặp, không lặp URL');
assert.equal(combined.pending.length,0);
assert.equal(run(rows,combined.seen).jobs.length,0,'Chạy lại cùng nguồn không tạo việc trùng');
assert.equal(JSON.stringify(rows),before);assert.deepEqual(seen,[],'Không sửa đầu vào hoặc sổ seen của bên gọi');

const pairA=row('2026-10-12T21:00:00+07:00',[base,a]),pairB=row('2026-10-13T21:00:00+07:00',[base,b]);
const ordered=run([pairA,pairB]),reordered=run([pairB,pairA]);
assert.equal(ordered.jobs[0].id,reordered.jobs[0].id,'Đảo thứ tự ca giữ một khóa từ tập URL');
assert.deepEqual(ordered.jobs[0].homeworkUrls,[base,a,b]);
assert.deepEqual(reordered.jobs[0].homeworkUrls,[base,b,a],'Hiển thị vẫn giữ thứ tự gặp');
assert.equal(run([pairB,pairA],ordered.seen,config,ordered.seenSources).jobs.length,0);
assert.equal(run([pairB,pairA],ordered.seen).jobs.length,0,'Bên gọi cũ vẫn nhận ra khóa mới khi nguồn không đổi');

const digest=(source:string|string[])=>createHash('sha256').update(JSON.stringify(['fake-2026-10-14',source,answer])).digest('hex');
for(const legacySource of [base,[base,a]]){
 const oldSeen=[digest(legacySource)],result=run([row('2026-10-14T21:00:00+07:00',Array.isArray(legacySource)?legacySource:[legacySource])],oldSeen);
 assert.equal(result.jobs.length,0,'Không dựng trùng nguồn có SHA cũ');
 assert.equal(result.pending[0].code,'legacy_scope_unknown');
 assert.equal(result.pending[0].requiresScopeReview,true);
 assert.deepEqual(result.seen,oldSeen,'Chưa đối soát thì chưa ghi khóa mới như đã xử lý');
 assert.deepEqual(result.seenSources,[],'Không suy phạm vi cũ từ SHA');
}
const legacyReorder=run([row('2026-10-14T21:00:00+07:00',[base,a,b,c])],[digest([base,b,c,a])]);
assert.equal(legacyReorder.jobs.length,0,'Không dựng trùng khi thứ tự SHA cũ không thể hoàn nguyên');
assert.equal(legacyReorder.pending[0].code,'legacy_checkpoint_unknown');
const legacyExtra=run([row('2026-10-14T21:00:00+07:00',[base,a,b])],[digest([base,a])]);
assert.equal(legacyExtra.jobs.length,0,'Không phát job im lặng khi seen cũ chỉ có PDF của ca đầu');
assert.equal(legacyExtra.pending[0].code,'legacy_checkpoint_unknown');
assert.equal(run([noteRow('2026-10-14T21:00:00+07:00')],[digest(base)]).pending[0].code,'legacy_scope_unknown','Đổi phạm vi trên SHA cũ luôn yêu cầu đối soát');

const scoped=run([noteRow('2026-10-14T21:00:00+07:00')]);
assert.notEqual(scoped.jobs[0].id,local.jobs[0].id,'Phạm vi tham gia fingerprint');
for(const [current,previous] of [[noteRow('2026-10-14T21:00:00+07:00'),local],[row('2026-10-14T21:00:00+07:00'),scoped]] as const){
 const stateBefore=JSON.stringify(previous),changed=run([current],previous.seen,config,previous.seenSources);
 assert.equal(changed.jobs.length,0,'Đổi phạm vi không tự tạo bài thay thế');
 assert.equal(changed.pending[0].code,'scope_changed');
 assert.equal(changed.pending[0].requiresScopeReview,true);
 assert.deepEqual(changed.pending[0].previousIds,[previous.jobs[0].id]);
 assert.deepEqual(changed.seen,previous.seen,'Không nuốt thay đổi phạm vi vào seen');
 assert.equal(JSON.stringify(previous),stateBefore,'Không sửa checkpoint đầu vào');
}
for(const current of [row('2026-10-14T21:00:00+07:00',[base,a]),row('2026-10-14T21:00:00+07:00',[base],b)]){
 const changed=run([current],local.seen,config,local.seenSources);
 assert.equal(changed.jobs.length,0,'Thêm PDF hoặc đổi đáp án cần đối soát bài đã tồn tại');
 assert.equal(changed.pending[0].code,'source_changed');
 assert.deepEqual(changed.seen,local.seen);
}
const newerLesson=row('2026-10-12T21:00:00+07:00');
assert.equal(run([newerLesson],local.seen,config,local.seenSources).jobs.length,1,'Metadata đã xác minh không chặn một buổi mới độc lập');
assert.equal(run([newerLesson,...[row('2026-10-14T21:00:00+07:00')]],local.seen).jobs.length,1,'Phục hồi metadata khóa mới không phụ thuộc thứ tự duyệt buổi');

for(const conflict of [row('2026-10-13T21:00:00+07:00',[a]),row('2026-10-13T21:00:00+07:00',[base],b),noteRow('2026-10-13T21:00:00+07:00')]){
 const result=run([row('2026-10-05T21:00:00+07:00'),row('2026-10-12T21:00:00+07:00'),conflict,row('2026-10-12T21:00:00+07:00')]);
 assert.equal(result.jobs.length,1,'Một bài xung đột không làm rơi bài hợp lệ hoặc sống lại ở dòng sau');
 assert.equal(result.jobs[0].lessonCode,'fake-2026-10-05');
 assert.equal(result.pending[0].code,'source_conflict');
 assert.equal(result.pending[0].lessonCode,'fake-2026-10-12');
 assert.match(result.pending[0].reason,/xung đột/);
}
const punctuated=[noteRow('2026-10-12T21:00:00+07:00'),noteRow('2026-10-13T21:00:00+07:00',note+'.')];
assert.equal(run(punctuated).pending[0].code,'source_conflict','So note trim giống reader, không âm thầm gộp câu chữ khác nhau');
const lessonHeaders=['Lớp','Ngày','Tên','Tài liệu','Phiếu','BTVN'];
const lessonConfig:LessonSourceConfig={sheetId:'FAKE-SHEET',tab:'FAKE-TAB',programKey:'fake',paired:true,classNames:['FAKE-A','FAKE-B'],columns:{className:'Lớp',date:'Ngày',title:'Tên',material:'Tài liệu',handout:'Phiếu',homework:'BTVN'}};
const lessonRows:MaterialCell[][]=[['FAKE-A','2026-10-12','Buổi GIẢ',base,'',note],['FAKE-B','2026-10-13','Buổi GIẢ',base,'',note+'.']];
const conflictingLesson=readLessonMaterials(lessonHeaders,lessonRows,lessonConfig);
assert.equal(conflictingLesson.lessons.length,0,'Reader cô lập cùng cặp note khác câu chữ');
assert.equal(conflictingLesson.pending[0].code,'source_conflict');
assert.deepEqual(conflictingLesson.pending[0].fields,['homeworkNote']);
assert.deepEqual(conflictingLesson.pending[0].sourceRows,[2,3]);
assert.equal(run([noteRow('2026-10-12T21:00:00+07:00',' '+note+' '),noteRow('2026-10-13T21:00:00+07:00')]).jobs.length,1,'Hai đường đọc đều trim ghi chú trước khi so');

// Phạm vi phải được so cả giữa các nguồn, không phụ thuộc thứ tự config.
const otherConfig={...lessonConfig,sheetId:'FAKE-OTHER-SHEET',tab:'FAKE-OTHER-TAB'};
const sourceRows=new Map<string,MaterialCell[][]>([
 [lessonConfig.sheetId,[lessonHeaders,['FAKE-A','2026-10-12','Buổi GIẢ',base,'',note]]],
 [otherConfig.sheetId,[lessonHeaders,['FAKE-B','2026-10-13','Buổi GIẢ',base,'',base]]],
]);
const readFake=async(sheet:string)=>sourceRows.get(sheet)!;
for(const configs of [[lessonConfig,otherConfig],[otherConfig,lessonConfig]]){
 const conflict=await readLessonSources(configs,readFake);
 assert.equal(conflict.lessons.length,0,'Không gộp cả phiếu với phần trắc nghiệm từ hai nguồn');
 assert.equal(conflict.pending[0].lessonCode,'fake-2026-10-12');
 assert.equal(conflict.pending[0].code,'source_conflict');
 assert.deepEqual(conflict.pending[0].fields,['homeworkNote']);
 assert.deepEqual(conflict.pending[0].sheetIds,configs.map(config=>config.sheetId));
 assert.deepEqual(conflict.pending[0].sources?.map(source=>source.row),[2,2]);
}
sourceRows.set(otherConfig.sheetId,[lessonHeaders,['FAKE-B','2026-10-13','Buổi GIẢ',base,'',' '+note+' ']]);
const sameScope=await readLessonSources([lessonConfig,otherConfig],readFake);
assert.equal(sameScope.lessons.length,1);
assert.equal(sameScope.lessons[0].homeworkNote,note);
assert.deepEqual(Object.keys(sameScope.lessons[0].classDates!).sort(),['FAKE-A','FAKE-B']);

// Dòng nối URL thường kế thừa phạm vi. Ghi chú phạm vi tường minh trái nguồn cha phải giữ cả nhóm.
for(const continuation of [['',note,'',base],['',note+'.',answer,base],['2026-10-12T21:00:00+07:00',note,'',base],['2026-10-12T14:00:00Z',note,'',base],['2026-10-13T21:00:00+07:00',note,'',base],['',note,'',''],['',note,'',{text:'Chưa có URL GIẢ',links:[]}]] as MaterialCell[][]){
 const result=run([row('2026-10-05T21:00:00+07:00'),row('2026-10-12T21:00:00+07:00'),continuation,row('2026-10-13T21:00:00+07:00')]);
 assert.deepEqual(result.jobs.map(job=>job.lessonCode),['fake-2026-10-05']);
 assert.equal(result.pending[0].code,'source_conflict');
 assert.equal(result.pending[0].requiresScopeReview,true);
 assert.deepEqual(result.pending[0].fields,['homeworkNote']);
 assert.deepEqual(result.pending[0].sourceRows,[3,4]);
 assert.equal(result.seenSources.some(source=>source.lessonCode==='fake-2026-10-12'),false,'Không đánh dấu đã xử lý nhóm phạm vi xung đột');
 assert.match(result.pending[0].reason,/dòng 3 và 4/);
}
const inherited=run([noteRow('2026-10-12T21:00:00+07:00'),row('',[a],'')]);
assert.deepEqual(inherited.jobs[0].homeworkUrls,[base,a]);
assert.equal(inherited.jobs[0].homeworkNote,note,'Dòng PDF thường kế thừa phạm vi thay vì bị coi là giao cả phiếu');
assert.equal(inherited.pending.length,0);
const repeatedNote=run([noteRow('2026-10-12T21:00:00+07:00'),['',' '+note+' ','',a]]);
assert.equal(repeatedNote.jobs.length,1);
assert.deepEqual(repeatedNote.jobs[0].homeworkUrls,[base,a]);
const conflictingNote=run([noteRow('2026-10-12T21:00:00+07:00'),['',note+'.','',base]]);
assert.equal(conflictingNote.jobs.length,0,'Note tường minh khác câu chữ vẫn cần đối soát');
assert.equal(conflictingNote.pending[0].code,'source_conflict');

const confirmedConflict=run([row('12/10'),['2026-10-12T14:00:00Z',note,'',base]],[],{...config,confirmedSessions:{'12/10':'2026-10-12T21:00:00+07:00'}});
assert.equal(confirmedConflict.jobs.length,0,'Ngày rút gọn đã xác minh dùng cùng thời điểm với dòng ISO');
assert.equal(confirmedConflict.pending[0].code,'source_conflict');
assert.deepEqual(confirmedConflict.seen,[]);
const futureScope=detectHomework(headers,[row('2026-10-12T21:00:00+07:00'),['2026-10-13T21:00:00+07:00',note,'',base]],config,[],Date.parse('2026-10-13T00:00:00Z'));
assert.equal(futureScope.jobs.length,0,'Ca tương lai đã xác minh cùng bài có note khác vẫn chặn phạm vi, chưa dựng ca đó');
assert.equal(futureScope.pending[0].code,'source_conflict');
for(const date of ['2026-10-12T14:00:00Z','2026-10-13T21:00:00+07:00']){
 const sameNoteWithoutAnswer=run([noteRow('2026-10-12T21:00:00+07:00'),[date,note,'',base]]);
 assert.equal(sameNoteWithoutAnswer.jobs.length,1,'Ghi chú trùng ở cùng thời điểm hoặc cùng cặp ca không xóa bài hợp lệ');
 assert.equal(sameNoteWithoutAnswer.pending.some(p=>p.code==='source_conflict'),false);
}
const missingNoteLink=run([noteRow('2026-10-12T21:00:00+07:00'),['',' '+note+' ','',''],row('',[a],'')]);
assert.deepEqual(missingNoteLink.jobs[0].homeworkUrls,[base,a],'Ghi chú trùng chưa có URL vẫn giữ cha cho tệp phụ kế tiếp');
assert.equal(missingNoteLink.jobs[0].homeworkNote,note);
assert.deepEqual(missingNoteLink.pending,[{row:3,reason:'Chờ URL thật của học liệu'}]);

// Hai đường đọc dùng cùng chuẩn NFC, hoa thường và trim, vẫn giữ dấu câu/dấu tiếng Việt.
for(const equivalent of [note.toUpperCase(),note.normalize('NFD'),' '+note+' ']){
 const equivalentWatch=run([noteRow('2026-10-12T21:00:00+07:00'),['',equivalent,'',a]]);
 assert.equal(equivalentWatch.jobs.length,1);
 assert.deepEqual(equivalentWatch.jobs[0].homeworkUrls,[base,a]);
 const equivalentRead=readLessonMaterials(lessonHeaders,[lessonRows[0],['FAKE-B','2026-10-13','Buổi GIẢ',base,'',equivalent]],lessonConfig);
 assert.equal(equivalentRead.lessons.length,1);
 assert.equal(equivalentRead.pending.length,0);
}
const unaccented=run([noteRow('2026-10-12T21:00:00+07:00'),['','PHAN TRAC NGHIEM TRONG PHIEU','',a]]);
assert.equal(unaccented.jobs.length,0,'Không tự suy tương đương khi khác dấu tiếng Việt');
assert.equal(unaccented.pending[0].code,'source_conflict');

// Reader phải đọc ghi chú dòng nối trước khi xét liên kết và cô lập đúng bài.
const independentLesson:MaterialCell[]=['FAKE-A','2026-10-05','Buổi GIẢ',base,'',base];
for(const continuation of [['','','','','',note],['','','',a,'',{text:note+'.',links:[a]}]] as MaterialCell[][]){
 const parent=continuation[5]===note?['FAKE-A','2026-10-12','Buổi GIẢ',base,'',base]:lessonRows[0];
 const result=readLessonMaterials(lessonHeaders,[independentLesson,parent,continuation,['FAKE-B','2026-10-13','Buổi GIẢ',base,'',base]],lessonConfig);
 assert.deepEqual(result.lessons.map(lesson=>lesson.lessonCode),['fake-2026-10-05']);
 assert.equal(result.pending[0].code,'source_conflict');
 assert.equal(result.pending[0].requiresScopeReview,true);
 assert.deepEqual(result.pending[0].sourceRows,[3,4]);
 assert.deepEqual(result.pending[0].fields,['homeworkNote']);
}
const readerMissingNoteLink=readLessonMaterials(lessonHeaders,[lessonRows[0],['','','','','',' '+note+' '],['','','','','',a]],lessonConfig);
assert.deepEqual(readerMissingNoteLink.lessons[0].homeworkUrls,[base,a]);
assert.deepEqual(readerMissingNoteLink.pending,[{row:3,reason:'Tệp phụ chưa có liên kết'}]);
const localIsolation=readLessonMaterials(lessonHeaders,[independentLesson,...lessonRows],lessonConfig);
assert.deepEqual(localIsolation.lessons.map(lesson=>lesson.lessonCode),['fake-2026-10-05']);

const isolatedSources=new Map<string,MaterialCell[][]>([
 [lessonConfig.sheetId,[lessonHeaders,independentLesson,lessonRows[0]]],
 [otherConfig.sheetId,[lessonHeaders,['FAKE-B','2026-10-06','Buổi GIẢ',base,'',base],lessonRows[1]]],
]);
for(const configs of [[lessonConfig,otherConfig],[otherConfig,lessonConfig]]){
 const isolated=await readLessonSources(configs,async id=>isolatedSources.get(id)!);
 assert.deepEqual(isolated.lessons.map(lesson=>lesson.lessonCode),['fake-2026-10-05'],'Một bài lệch nguồn không làm rơi bài độc lập');
 assert.equal(isolated.pending[0].lessonCode,'fake-2026-10-12');
 assert.deepEqual(isolated.pending[0].fields,['homeworkNote']);
 assert.deepEqual(isolated.pending[0].sourceRows,[3,3]);
 assert.deepEqual(isolated.pending[0].sheetIds,configs.map(config=>config.sheetId));
 assert.match(isolated.pending[0].reason,/fake-2026-10-12.*homeworkNote.*dòng 3 và 3/);
}
isolatedSources.set(lessonConfig.sheetId,[lessonHeaders,independentLesson,...lessonRows]);
const localConflictNotRevived=await readLessonSources([otherConfig,lessonConfig],async id=>isolatedSources.get(id)!);
assert.deepEqual(localConflictNotRevived.lessons.map(lesson=>lesson.lessonCode),['fake-2026-10-05'],'Xung đột nội bộ một nguồn cũng chặn bài đó từ nguồn khác');
assert.throws(()=>detectHomework(headers.slice(0,3),[],config),/Thiếu\/trùng cột/,'Thiếu cột vẫn chặn toàn bộ dữ liệu không đủ cấu trúc');

// Kiểm đường CLI bằng snapshot giả và checkpoint riêng, không bật --sheet.
const root=process.env.MTM_ROOT??process.cwd(),fixtureRoot=resolve(root,'.qa-temp','hang-ngay','20261016-09');
mkdirSync(fixtureRoot,{recursive:true});
const fixtureDir=mkdtempSync(join(fixtureRoot,'watcher-synthetic-'));
try{
 const input=join(fixtureDir,'input.json'),checkpoint=join(fixtureDir,'checkpoint.json');
 const cli=(index:number,sourceRows:MaterialCell[][])=>{
  const output=join(fixtureDir,`output-${index}.json`);
  writeFileSync(input,JSON.stringify({config,values:[headers,...sourceRows]}),'utf8');
  const result=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),input,checkpoint,output],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(readFileSync(output,'utf8'));
 };
 const first=cli(1,[row('2024-02-28T21:00:00+07:00')]);
 assert.equal(first.jobs.length,1);
 assert.deepEqual(JSON.parse(readFileSync(checkpoint,'utf8')).seenSources,first.seenSources,'CLI ghi metadata cùng receipt');
 const repeat=cli(2,[row('2024-02-28T21:00:00+07:00')]);
 assert.equal(repeat.jobs.length,0,'CLI đọc lại metadata và không dựng trùng');
 const scopeChange=cli(3,[noteRow('2024-02-28T21:00:00+07:00')]);
 assert.equal(scopeChange.jobs.length,0);
 assert.equal(scopeChange.pending[0].code,'scope_changed','CLI giữ metadata qua checkpoint để phát hiện đổi phạm vi');
 assert.deepEqual(JSON.parse(readFileSync(checkpoint,'utf8')).seen,first.seen,'CLI không tự nhận thay đổi chưa đối soát');
 const rejectCli=(source:string,output:string,reason:RegExp)=>{
  const oldSource=readFileSync(source,'utf8'),oldCheckpoint=readFileSync(checkpoint,'utf8');
  const result=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),source,checkpoint,output],{cwd:root,encoding:'utf8'});
  assert.notEqual(result.status,0,'Đường CLI phải chặn trước khi ghi');
  assert.match(result.stderr,reason);
  assert.equal(readFileSync(source,'utf8'),oldSource,'Giữ nguyên snapshot khi chặn');
  assert.equal(readFileSync(checkpoint,'utf8'),oldCheckpoint,'Giữ nguyên checkpoint khi chặn');
 };
 const temporaryCheckpoint=checkpoint+'.tmp';
 rejectCli(input,temporaryCheckpoint,/phải khác nhau/);
 assert.equal(existsSync(temporaryCheckpoint),false,'Output trùng tmp phải bị chặn trước lần ghi đầu');
 if(process.platform==='win32')rejectCli(input,temporaryCheckpoint.toUpperCase(),/phải khác nhau/);
 writeFileSync(temporaryCheckpoint,'SNAPSHOT GIẢ CẦN GIỮ','utf8');
 const aliasOutput=join(fixtureDir,'alias-output.json');
 rejectCli(temporaryCheckpoint,aliasOutput,/phải khác nhau/);
 assert.equal(existsSync(aliasOutput),false,'Source trùng tmp không được tạo output');
 const blockedOutput=join(fixtureDir,'blocked-output.json');
 rejectCli(input,blockedOutput,/Tệp tạm checkpoint đã tồn tại/);
 assert.equal(readFileSync(temporaryCheckpoint,'utf8'),'SNAPSHOT GIẢ CẦN GIỮ','Không xóa hoặc ghi đè tệp tmp chưa rõ nguồn');
 assert.equal(existsSync(blockedOutput),false,'Tmp cũ chặn trước khi ghi receipt mới');
 const oldOutput=join(fixtureDir,'old-output.json');
 writeFileSync(oldOutput,'RECEIPT GIẢ CẦN GIỮ','utf8');
 rejectCli(input,oldOutput,/Output đã tồn tại/);
 assert.equal(readFileSync(oldOutput,'utf8'),'RECEIPT GIẢ CẦN GIỮ','Không ghi đè receipt có sẵn dù đồng thời còn tmp cũ');
}finally{
 assert.ok(resolve(fixtureDir).startsWith(fixtureRoot+sep),'Chỉ dọn thư mục fixture đã tạo trong vùng QA');
 rmSync(fixtureDir,{recursive:true,force:true});
}
console.log('ĐẠT watcher học liệu: ngày thật, biên múi giờ, PDF hai ca, identity ổn định, scope/nguồn đổi, seen cũ an toàn và cô lập xung đột.');
