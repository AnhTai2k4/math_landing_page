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

// URL chính có ý nghĩa riêng; thứ tự các tệp phụ vẫn không đổi danh tính nguồn.
const primaryRows=[row('2026-10-14T21:00:00+07:00',[base,a,b])],primaryRowsBefore=JSON.stringify(primaryRows);
const primarySource=run(primaryRows),primarySourceBefore=JSON.stringify(primarySource);
assert.equal(primarySource.seenSources[0].fingerprintVersion,3);
assert.equal(primarySource.seenSources[0].primaryHomeworkUrl,base);
const switchedPrimary=run([row('2026-10-14T21:00:00+07:00',[a,base,b])],primarySource.seen,config,primarySource.seenSources);
assert.deepEqual(switchedPrimary.jobs,[],'Đổi URL chính trên cùng tập PDF không tự dựng bài thay thế');
assert.equal(switchedPrimary.pending[0]?.code,'source_changed');
assert.match(switchedPrimary.pending[0].reason,/URL chính/,'Lý do chờ phải bao gồm đổi URL chính dù tập PDF không đổi');
assert.deepEqual(switchedPrimary.pending[0].fields,['primaryHomeworkUrl'],'Chỉ rõ trường metadata đổi, không gán thay đổi cho tập URL vẫn giữ nguyên');
assert.deepEqual(switchedPrimary.pending[0]?.previousIds,primarySource.seen);
assert.deepEqual(switchedPrimary.seen,primarySource.seen,'Không nuốt đổi URL chính vào seen');
assert.deepEqual(switchedPrimary.seenSources,primarySource.seenSources);
for(const metadata of [primarySource.seenSources,[]]){
 const repeat=run([row('2026-10-14T21:00:00+07:00',[base,b,a])],primarySource.seen,config,metadata);
 assert.deepEqual(repeat.jobs,[]);assert.deepEqual(repeat.pending,[],'Đảo tệp phụ giữ nguyên URL chính vẫn idempotent, kể cả chỉ còn SHA v3');
 assert.deepEqual(repeat.seenSources,primarySource.seenSources,'SHA v3 khớp phục hồi được metadata có vai trò URL chính');
}
assert.equal(JSON.stringify(primaryRows),primaryRowsBefore);assert.equal(JSON.stringify(primarySource),primarySourceBefore,'Không sửa dữ liệu/receipt gốc khi đối soát URL chính');

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
const sourceChangeLabels:Record<string,string>={primaryHomeworkUrl:'URL chính',homeworkUrls:'tập URL',answer:'đáp án',homeworkNoteKey:'phạm vi'};
for(const [current,fields] of [
 [['2026-10-14T21:00:00+07:00',note,answer,{text:'PDF GIẢ',links:[a,base,b]}],['primaryHomeworkUrl','homeworkNoteKey']],
 [['2026-10-14T21:00:00+07:00',note,c,{text:'PDF GIẢ',links:[a,base,c]}],['primaryHomeworkUrl','homeworkUrls','answer','homeworkNoteKey']],
] as [MaterialCell[],string[]][]){
 const held=run([current],primarySource.seen,config,primarySource.seenSources);
 assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0].code,'scope_changed');
 assert.deepEqual(held.pending[0].fields,fields,'v3 ghi đủ từng trường thay đổi khi phạm vi và nguồn cùng đổi');
 assert.equal(held.pending[0].requiresScopeReview,true);
 for(const label of fields.map(field=>sourceChangeLabels[field]))assert.ok(held.pending[0].reason.includes(label),label);
 assert.deepEqual(held.pending[0].previousIds,primarySource.seen);
 assert.deepEqual(held.seen,primarySource.seen);assert.deepEqual(held.seenSources,primarySource.seenSources,'Không nhận đồng thời nhiều thay đổi thành checkpoint đã xử lý');
}

// v2 đã sắp xếp tập URL nên không thể suy lại URL chính từ phần tử đầu tiên.
const asV2=(current:SeenHomeworkSource):SeenHomeworkSource=>{
 const source={fingerprintVersion:2 as const,lessonCode:current.lessonCode,homeworkUrls:[...current.homeworkUrls],homeworkNoteKey:current.homeworkNoteKey,answer:current.answer};
 return {...source,id:createHash('sha256').update(JSON.stringify(['homework-source-v2',source.lessonCode,source.homeworkUrls,source.answer,source.homeworkNoteKey])).digest('hex')};
};
const primaryV2=asV2(primarySource.seenSources[0]),primaryV2Before=JSON.stringify(primaryV2);
for(const [current,code,fields] of [
 [row('2026-10-14T21:00:00+07:00',[base,a,b]),'legacy_primary_unknown',['primaryHomeworkUrl']],
 [row('2026-10-14T21:00:00+07:00',[a,base,b]),'legacy_primary_unknown',['primaryHomeworkUrl']],
 [row('2026-10-14T21:00:00+07:00',[base,a,b,c]),'source_changed',['primaryHomeworkUrl','homeworkUrls']],
 [row('2026-10-14T21:00:00+07:00',[base,a,b],c),'source_changed',['primaryHomeworkUrl','answer']],
 [noteRow('2026-10-14T21:00:00+07:00'),'scope_changed',['primaryHomeworkUrl','homeworkUrls','homeworkNoteKey']],
 [['2026-10-14T21:00:00+07:00',note,c,{text:'PDF GIẢ',links:[base,a,b]}],'scope_changed',['primaryHomeworkUrl','answer','homeworkNoteKey']],
 [row('2026-10-14T21:00:00+07:00',[base,a,b,c],c),'source_changed',['primaryHomeworkUrl','homeworkUrls','answer']],
] as [MaterialCell[],string,string[]][]){
 const held=run([current],[primaryV2.id],config,[primaryV2]);
 assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0]?.code,code);
 assert.deepEqual(held.pending[0].fields,fields,'v2 chỉ rõ các trường đã đổi cùng URL chính còn chưa chứng minh được');
 assert.match(held.pending[0].reason,/phiên bản 2 chưa lưu URL chính/);
 assert.match(held.pending[0].reason,/đề đứng đầu có thể đã đổi/);
 for(const label of fields.slice(1).map(field=>sourceChangeLabels[field]))assert.ok(held.pending[0].reason.includes(label),label);
 assert.deepEqual(held.pending[0].previousIds,[primaryV2.id]);
 assert.deepEqual(held.seen,[primaryV2.id]);assert.deepEqual(held.seenSources,[primaryV2],'Không tự nâng v2 thành metadata có URL chính đã xác minh');
 assert.equal(held.pending[0].requiresScopeReview,true,'Nguồn v2 thay đổi vẫn phải đối soát phạm vi vì chưa biết vai trò URL chính');
}
const unknownPrimary=(links:string[])=>run([row('2026-10-14T21:00:00+07:00',links)],[primaryV2.id],config,[primaryV2]).pending;
assert.deepEqual(unknownPrimary([base,a,b]),unknownPrimary([a,base,b]),'Không bịa khác biệt lý do: hai đầu vào cùng tập tệp đều chưa biết URL chính cũ sau khi v2 đã mất vai trò');
assert.match(unknownPrimary([a,base,b])[0].reason,/Tập tệp, đáp án và phạm vi BTVN khớp/);
assert.equal(JSON.stringify(primaryV2),primaryV2Before);
for(const previous of [[primaryV2,...primarySource.seenSources],[...primarySource.seenSources,primaryV2]]){
 const saved=JSON.stringify(previous),seen=[primaryV2.id,...primarySource.seen];
 const held=run([row('2026-10-14T21:00:00+07:00',[a,base,b])],seen,config,previous);
 assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0]?.code,'source_changed','Metadata v2 không che đổi URL chính đã đối soát được bằng v3');
 assert.deepEqual(held.pending[0].previousIds,primarySource.seen);assert.deepEqual(held.seen,seen);
 assert.equal(JSON.stringify(previous),saved);
}
for(const previous of [[asV2(scoped.seenSources[0]),...scoped.seenSources],[...scoped.seenSources,asV2(scoped.seenSources[0])]]){
 const held=run([noteRow('2026-10-14T21:00:00+07:00',note+'.')],previous.map(source=>source.id),config,previous);
 assert.equal(held.pending[0]?.code,'scope_changed');assert.deepEqual(held.pending[0].previousIds,scoped.seen,'Đối soát phạm vi dùng v3 khi hỗn hợp v2/v3');
}
for(const changedNote of [note+'.','PHAN TRAC NGHIEM TRONG PHIEU']){
 const changed=run([noteRow('2026-10-14T21:00:00+07:00',changedNote)],scoped.seen,config,scoped.seenSources);
 assert.equal(changed.jobs.length,0);
 assert.equal(changed.pending[0]?.code,'scope_changed','Checkpoint phải giữ dấu tiếng Việt và dấu câu như đối soát cùng lượt đọc');
 assert.deepEqual(changed.seen,scoped.seen);
}
for(const equivalent of [note.toUpperCase(),note.normalize('NFD'),' '+note+' ']){
 const repeat=run([noteRow('2026-10-14T21:00:00+07:00',equivalent)],scoped.seen,config,scoped.seenSources);
 assert.deepEqual(repeat.jobs,[]);assert.deepEqual(repeat.pending,[]);
}
// Metadata trước v2 đã mất dấu và dấu câu. Không tự nhận thành phạm vi đã xác minh.
const legacyNoteKey='phantracnghiemtrongphieu';
const legacyId=createHash('sha256').update(JSON.stringify(['fake-2026-10-14',[base],answer,legacyNoteKey])).digest('hex');
const legacyMetadata:SeenHomeworkSource={id:legacyId,lessonCode:'fake-2026-10-14',homeworkUrls:[base],homeworkNoteKey:legacyNoteKey,answer};
for(const changedNote of [note,note+'.','PHAN TRAC NGHIEM TRONG PHIEU']){
 const previous=JSON.stringify(legacyMetadata);
 const held=run([noteRow('2026-10-14T21:00:00+07:00',changedNote)],[legacyId],config,[legacyMetadata]);
 assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0]?.code,'legacy_scope_unknown');
 assert.equal(held.pending[0]?.requiresScopeReview,true);assert.deepEqual(held.seen,[legacyId]);
 assert.equal(JSON.stringify(legacyMetadata),previous,'Không sửa metadata cũ để tự nâng phiên bản');
 assert.deepEqual(held.seenSources,[legacyMetadata],'Giữ metadata cũ để đối soát receipt');
}
const mixedLegacy=run([row('2026-10-12T21:00:00+07:00'),noteRow('2026-10-14T21:00:00+07:00')],[legacyId],config,[legacyMetadata]);
assert.deepEqual(mixedLegacy.jobs.map(job=>job.lessonCode),['fake-2026-10-12'],'Metadata cũ biết mã bài chỉ giữ đúng bài cần đối soát');
const emptyLegacyId=createHash('sha256').update(JSON.stringify(['fake-2026-10-14',[base],answer,''])).digest('hex');
const emptyLegacy:SeenHomeworkSource={id:emptyLegacyId,lessonCode:'fake-2026-10-14',homeworkUrls:[base],homeworkNoteKey:'',answer};
const emptyLegacyBefore=JSON.stringify(emptyLegacy);
for(const current of [row('2026-10-14T21:00:00+07:00'),noteRow('2026-10-14T21:00:00+07:00')]){
 const held=run([current],[emptyLegacyId],config,[emptyLegacy]);
 assert.deepEqual(held.jobs,[]);assert.deepEqual(held.seen,[emptyLegacyId]);assert.deepEqual(held.seenSources,[emptyLegacy]);
 assert.equal(held.pending[0]?.code,'legacy_scope_unknown');assert.equal(held.pending[0]?.requiresScopeReview,true);
 assert.match(held.pending[0].reason,/Checkpoint chưa mang phiên bản 2/);
 assert.match(held.pending[0].reason,/receipt trước khi đổi id/);
 assert.doesNotMatch(held.pending[0].reason,/đã bỏ dấu/,'Ghi chú cũ trống không chứng minh đã mất dấu');
}
assert.match(run([row('2026-10-14T21:00:00+07:00')],[emptyLegacyId],config,[emptyLegacy]).pending[0].reason,/cũ và hiện tại đều trống/);
assert.equal(JSON.stringify(emptyLegacy),emptyLegacyBefore);
for(const [current,versioned,code] of [
 [noteRow('2026-10-14T21:00:00+07:00',note+'.'),scoped,'scope_changed'],
 [row('2026-10-14T21:00:00+07:00',[base,a]),local,'source_changed'],
 [row('2026-10-14T21:00:00+07:00',[base],b),local,'source_changed'],
] as const)for(const previous of [[emptyLegacy,...versioned.seenSources],[...versioned.seenSources,emptyLegacy]]){
 const saved=JSON.stringify(previous),seen=[emptyLegacyId,...versioned.seen];
 const held=run([current],seen,config,previous);
 assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0]?.code,code,'Metadata v1 không che thay đổi đã đối soát được bằng v3');
 assert.deepEqual(held.pending[0]?.previousIds,versioned.seen);
 assert.deepEqual(held.seen,seen);assert.equal(JSON.stringify(previous),saved,'Không nâng metadata hoặc sửa checkpoint đầu vào');
 assert.equal(held.seenSources.some(source=>source.id===emptyLegacyId&&source.fingerprintVersion===undefined),true);
}
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
for(const date of ['', '2026-10-12T14:00:00Z'])for(const links of [[a],[]]){
 const result=run([row('2026-10-05T21:00:00+07:00'),row('2026-10-12T21:00:00+07:00'),row(date,links,b),row('2026-10-13T21:00:00+07:00')]);
 assert.deepEqual(result.jobs.map(job=>job.lessonCode),['fake-2026-10-05']);
 assert.equal(result.pending[0]?.code,'source_conflict','Đáp án dòng nối phải đối soát trước URL hoặc giờ');
 assert.deepEqual(result.pending[0]?.fields,links.length?['answer','homeworkUrl']:['answer']);assert.deepEqual(result.pending[0]?.sourceRows,[3,4]);
 assert.equal(result.seenSources.some(source=>source.lessonCode==='fake-2026-10-12'),false);
}
for(const date of ['', '2026-10-12T14:00:00Z']){
 const result=run([row('2026-10-12T21:00:00+07:00'),row(date,[base,a],answer),row('',[b],'')]);
 assert.deepEqual(result.jobs[0].homeworkUrls,[base,a,b],'Đáp án trùng ở dòng nối không cắt cha hoặc bỏ PDF tiếp theo');
 assert.deepEqual(result.pending,[]);
}
const copiedAnswerWithoutDate=run([row('2026-10-12T21:00:00+07:00'),row('',[a],answer),row('',[b],''),row('2026-10-13T21:00:00+07:00')]);
assert.deepEqual(copiedAnswerWithoutDate.jobs,[],'Không gắn PDF lạ có đáp án sao chép vào bài cha, không cho nhóm xung đột sống lại');
assert.equal(copiedAnswerWithoutDate.pending[0]?.code,'source_conflict');
assert.deepEqual(copiedAnswerWithoutDate.pending[0]?.fields,['homeworkUrl']);
assert.deepEqual(copiedAnswerWithoutDate.pending[0]?.sourceRows,[2,3]);
assert.deepEqual(copiedAnswerWithoutDate.seen,[]);assert.deepEqual(copiedAnswerWithoutDate.seenSources,[]);
const futurePairedAnswer=detectHomework(headers,[row('2026-10-12T21:00:00+07:00'),row('2026-10-13T21:00:00+07:00',[base],b)],config,[],Date.parse('2026-10-13T00:00:00Z'));
assert.deepEqual(futurePairedAnswer.jobs.map(job=>job.lessonCode),['fake-2026-10-12'],'Ca chưa kết thúc không xóa job của ca đã đủ điều kiện');
assert.deepEqual(futurePairedAnswer.pending,[{row:3,reason:'Cần giờ kết thúc ca đã xác minh'}]);
const missingPairedUrl=run([row('2026-10-12T21:00:00+07:00'),row('2026-10-13T21:00:00+07:00',[],b)]);
assert.deepEqual(missingPairedUrl.jobs.map(job=>job.lessonCode),['fake-2026-10-12'],'Ca thiếu URL không xóa job của ca đã đủ điều kiện');
assert.deepEqual(missingPairedUrl.pending,[{row:3,reason:'Chờ URL thật của học liệu'}]);
for(const date of ['2026-10-12T21:00:00+07:00','2026-10-12T14:00:00Z']){
 const result=run([row('2026-10-12T21:00:00+07:00'),row(date,[a],answer)]);
 assert.deepEqual(result.jobs,[]);assert.equal(result.pending[0]?.code,'source_conflict');
 assert.deepEqual(result.pending[0]?.fields,['homeworkUrl'],'Dòng có ngày và đáp án phải đối soát URL chính như trước');
 const supplementary=run([row('2026-10-12T21:00:00+07:00'),row(date,[a],'')]);
 assert.deepEqual(supplementary.jobs[0].homeworkUrls,[base,a]);assert.deepEqual(supplementary.pending,[]);
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
 assert.equal(first.seenSources[0].fingerprintVersion,3,'CLI lưu phiên bản fingerprint để lần đọc sau đối soát đúng chuẩn');
 assert.equal(first.seenSources[0].primaryHomeworkUrl,base,'CLI lưu riêng URL chính');
 const v2Source=asV2(first.seenSources[0]),v2Checkpoint=join(fixtureDir,'checkpoint-v2.json'),v2Receipt=join(fixtureDir,'receipt-v2.json');
 writeFileSync(v2Checkpoint,JSON.stringify({seen:[v2Source.id],seenSources:[v2Source]}),'utf8');
 const v2Before=readFileSync(v2Checkpoint,'utf8');
 const v2Run=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),input,v2Checkpoint,v2Receipt],{cwd:root,encoding:'utf8'});
 assert.equal(v2Run.status,0,v2Run.stderr||v2Run.stdout);
 const v2Held=JSON.parse(readFileSync(v2Receipt,'utf8')),v2After=JSON.parse(readFileSync(v2Checkpoint,'utf8'));
 assert.deepEqual(v2Held.jobs,[]);assert.equal(v2Held.pending[0]?.code,'legacy_primary_unknown');
 assert.deepEqual(v2Held.pending[0].fields,['primaryHomeworkUrl']);assert.equal(v2Held.pending[0].requiresScopeReview,true);
 assert.match(v2Held.pending[0].reason,/đề đứng đầu có thể đã đổi/);
 assert.deepEqual(v2After.seen,JSON.parse(v2Before).seen);assert.deepEqual(v2After.seenSources,JSON.parse(v2Before).seenSources,'CLI giữ checkpoint v2, không suy URL chính từ tập URL cũ');
 for(const [index,current,code,fields] of [
  [1,['2024-02-28T21:00:00+07:00',note,c,base],'scope_changed',['primaryHomeworkUrl','answer','homeworkNoteKey']],
  [2,row('2024-02-28T21:00:00+07:00',[base,a],c),'source_changed',['primaryHomeworkUrl','homeworkUrls','answer']],
 ] as [number,MaterialCell[],string,string[]][]){
  const receipt=join(fixtureDir,`receipt-v2-changed-${index}.json`);
  writeFileSync(input,JSON.stringify({config,values:[headers,current]}),'utf8');
  const result=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),input,v2Checkpoint,receipt],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  const held=JSON.parse(readFileSync(receipt,'utf8'));
  assert.deepEqual(held.jobs,[]);assert.equal(held.pending[0].code,code);assert.deepEqual(held.pending[0].fields,fields);
  assert.equal(held.pending[0].requiresScopeReview,true,'CLI giữ cờ đối soát cho mọi thay đổi nguồn v2');
  for(const label of fields.slice(1).map(field=>sourceChangeLabels[field]))assert.ok(held.pending[0].reason.includes(label),label);
  const saved=JSON.parse(readFileSync(v2Checkpoint,'utf8'));
  assert.deepEqual(saved.seen,JSON.parse(v2Before).seen);assert.deepEqual(saved.seenSources,JSON.parse(v2Before).seenSources,'CLI không nâng v2 sau khi ghi nhận nhiều loại thay đổi');
 }
 const primaryCliCheckpoint=join(fixtureDir,'checkpoint-primary.json');
 const primaryCli=(index:number,links:string[])=>{
  const receipt=join(fixtureDir,`receipt-primary-${index}.json`);
  writeFileSync(input,JSON.stringify({config,values:[headers,row('2024-02-28T21:00:00+07:00',links)]}),'utf8');
  const result=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),input,primaryCliCheckpoint,receipt],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(readFileSync(receipt,'utf8'));
 };
 const primaryCliFirst=primaryCli(1,[base,a,b]);
 const primaryCliRepeat=primaryCli(2,[base,b,a]);
 assert.deepEqual(primaryCliRepeat.jobs,[]);assert.deepEqual(primaryCliRepeat.pending,[],'CLI không lặp khi đảo tệp phụ');
 const primaryCliChanged=primaryCli(3,[a,base,b]);
 assert.deepEqual(primaryCliChanged.jobs,[]);assert.equal(primaryCliChanged.pending[0]?.code,'source_changed');
 assert.deepEqual(primaryCliChanged.seen,primaryCliFirst.seen);assert.deepEqual(primaryCliChanged.seenSources,primaryCliFirst.seenSources,'CLI không nuốt đổi URL chính vào checkpoint');
 writeFileSync(input,JSON.stringify({config,values:[headers,row('2024-02-28T21:00:00+07:00')]}),'utf8');
 const oldSource:SeenHomeworkSource={lessonCode:first.seenSources[0].lessonCode,homeworkUrls:[base],homeworkNoteKey:'',answer,id:''};
 oldSource.id=createHash('sha256').update(JSON.stringify([oldSource.lessonCode,oldSource.homeworkUrls,answer,''])).digest('hex');
 const oldCheckpoint=join(fixtureDir,'checkpoint-v1.json'),oldReceipt=join(fixtureDir,'receipt-v1.json');
 writeFileSync(oldCheckpoint,JSON.stringify({seen:[oldSource.id],seenSources:[oldSource]}),'utf8');
 const oldRun=spawnSync(process.execPath,[join(root,'scripts','watch-btvn-materials.mjs'),input,oldCheckpoint,oldReceipt],{cwd:root,encoding:'utf8'});
 assert.equal(oldRun.status,0,oldRun.stderr||oldRun.stdout);
 const heldReceipt=JSON.parse(readFileSync(oldReceipt,'utf8')),heldCheckpoint=JSON.parse(readFileSync(oldCheckpoint,'utf8'));
 assert.deepEqual(heldReceipt.jobs,[]);assert.equal(heldReceipt.pending[0]?.code,'legacy_scope_unknown');
 assert.deepEqual(heldCheckpoint.seen,[oldSource.id]);assert.deepEqual(heldCheckpoint.seenSources,[oldSource],'CLI không nâng metadata v1 hoặc tự nhận nguồn đã đối soát');
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
