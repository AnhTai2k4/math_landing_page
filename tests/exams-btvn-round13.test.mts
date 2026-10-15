import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseAttendanceSheet} from '../server/btvn/attendance-sheet';
import {createVideoEmbedChecker} from '../server/btvn/video-embed';
import {buildScorebook,buildClassReport,type ScoreRow} from '../server/btvn/scorebook';
import {writeScorebookSheets} from '../server/btvn/sheets-writer';
import LessonCards,{LessonVideo} from '../src/native/homework/LessonCards';
const config=JSON.parse(readFileSync('server/btvn/attendance-map.example.json','utf8'));
// Dữ liệu giả tự chứa, không phụ thuộc artifact cục bộ của đợt 13.
const fixture={'Thứ 2':[['','TÊN LỚP','16/10','06/01'],...Array.from({length:11},(_,i)=>[
 ['Lớp ('+Object.keys(config.classes)[i%Object.keys(config.classes).length]+')',i%2?'19h30-21h30':'13h30-15h30'],
 ['Học sinh GIẢ '+i,'0900000001','C','On']
]).flat()]};
const parsed=parseAttendanceSheet(fixture,config);
assert.equal(parsed.blocks,Object.values(fixture).flat().filter((r:any)=>/^Lớp \(/.test(r[0]??'')).length);
assert.ok(parsed.sessions.length>0);assert.ok(parsed.sessions.some(s=>s.startsAt.includes('2027-01')));
assert.equal(parsed.blocks,11);assert.equal(parsed.pending.length,0);
assert.ok(parsed.sessions.some(s=>s.startsAt.includes('T19:30:00')));
assert.ok(parsed.sessions.some(s=>s.startsAt.includes('T13:30:00')));
assert.ok(parsed.sessions.some(s=>s.attendees.some(a=>a.status==='ON')));
assert.ok(parsed.sessions.every(s=>s.startsAt.endsWith('+07:00')));
const synthetic={'Thứ 2':[['','TÊN LỚP','16/10','06/01'],['Lớp (2k9, 9+)','8-10h'],['Tên GIẢ','0900000001','C','On'],['Ghi chú','không phải SĐT']]};
const syn=parseAttendanceSheet(synthetic,config);assert.equal(syn.sessions.length,2);assert.equal(syn.sessions[0].startsAt,'2026-10-16T08:00:00+07:00');assert.equal(syn.sessions[1].startsAt,'2027-01-06T08:00:00+07:00');
assert.equal(parseAttendanceSheet(synthetic,{...config,classes:{}}).pending.length,1);
for(const [status,want] of [[200,true],[401,false],[403,false],[404,false],[500,null]] as const){
 let calls=0,now=0;const check=createVideoEmbedChecker((async()=>{calls++;return new Response('{}',{status});}) as typeof fetch,()=>now);
 assert.equal(await check('abcdefghijk'),want);assert.equal(await check('abcdefghijk'),want);assert.equal(calls,1);now=3600001;await check('abcdefghijk');assert.equal(calls,2);
}
assert.equal(await createVideoEmbedChecker((async()=>{throw Error('offline');}) as typeof fetch)('abcdefghijk'),null);
for(const value of [true,false,null]){
 const html=renderToStaticMarkup(React.createElement(LessonVideo,{demo:false,lesson:{videoId:'abcdefghijk',lessonCode:'fake',date:'2026-10-15',title:'GIẢ',videoEmbeddable:value} as any}));
 assert.equal(html.includes('<iframe'),value===true);if(value!==true){assert.ok(html.includes('Xem video bài giảng trên YouTube'));assert.ok(html.includes('hqdefault.jpg'));assert.ok(html.includes('target="_blank"'));}
}
const zoom=renderToStaticMarkup(React.createElement(LessonVideo,{demo:false,lesson:{videoId:null,videoUrl:'https://example.zoom.us/rec/a',lessonCode:'fake'} as any}));assert.ok(zoom.includes('Xem record Zoom'));
const row:ScoreRow={studentId:'a',fullName:'Học sinh GIẢ',className:'2K9 9+',lessonCode:'a',title:'Đề giả',date:'2026-10-15',dueAt:Date.parse('2026-10-16T17:30:00+07:00'),receipts:[{score:7.5,late:true,submittedAt:Date.parse('2026-10-17T00:00:00+07:00')}]};
const rows=[row,{...row,lessonCode:'b',receipts:[]},{...row,studentId:'qa',sourceIdentity:'qa:x'},{...row,studentId:'old',date:'2026-10-14'}];
const book=buildScorebook(rows,Date.parse('2026-10-18'));assert.equal(book.length,1);assert.equal(book[0].values.length,2);assert.deepEqual(book[0].values[1],['Học sinh GIẢ','7,5 (muộn)','Chưa nộp','3,75']);
assert.equal(buildScorebook([{...row,receipts:[]}],0)[0].values[1][1],'');
const cards=renderToStaticMarkup(React.createElement(LessonCards,{busy:false,onHomework:()=>{},lessons:[{lessonCode:'fake',classNames:['2K9 9+'],date:'2026-10-15',title:'Giả',videoId:null,materialUrl:null,handoutUrl:null,homeworkUrl:null,dueAt:null,expectedDueAt:row.dueAt,bestScore:null,late:null,submittedAt:null,available:true}]}));
assert.ok(cards.includes('Hạn dự kiến: trước'));assert.ok(cards.includes('giờ vào buổi học tới'));
const report=buildClassReport(rows,'a','2K9 9+');assert.ok(report.includes('quý phụ huynh và các con'));assert.ok(report.includes('Nộp muộn: Học sinh GIẢ - 7,5/10'));assert.ok(report.includes('1/1'));assert.ok(!report.includes('—'));
let request:any;await writeScorebookSheets('fake-id','fake-token',book,async(url,init)=>{request={url,...init};return {ok:true};});
assert.ok(request.url.endsWith('/values:batchUpdate'));assert.equal(JSON.parse(request.body).valueInputOption,'RAW');assert.equal(JSON.parse(request.body).data[0].range,"'2K9 9+'!A1");
await assert.rejects(writeScorebookSheets('fake-id','fake-token',book,async()=>({ok:false})));
console.log('ĐẠT đợt 13: snapshot, video ba trạng thái, sổ điểm, tin nhóm và Sheets transport giả.');
