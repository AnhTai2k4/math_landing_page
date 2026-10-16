// Dữ liệu tổng hợp kiểm điểm đang chờ chấm, không gửi báo cáo hoặc dùng học sinh thật.
import assert from 'node:assert/strict';
import {bestReceipt,buildScorebook,buildClassReport,type ScoreRow} from '../server/btvn/scorebook';
import {scoresCsv,type StudentWork} from '../server/btvn/repository';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('MTM-PENDING-EXPORTS');
const submittedAt=Date.parse('2026-10-16T12:00:00+07:00'),now=submittedAt+1000;
const row=(score:number|null,extra:Partial<ScoreRow>={}):ScoreRow=>({
  studentId:'fixture-1',fullName:'Người dùng tổng hợp A',className:'Lớp tổng hợp',lessonCode:'fixture-pending',
  title:'Bài kiểm thử',date:'2026-10-16',dueAt:submittedAt,receipts:[{score,submittedAt,late:false}],...extra,
});

test('Điểm pending không biến thành 0 hoặc Chưa nộp trong sổ điểm và TB tháng',()=>{
  const source=row(null),book=buildScorebook([source],now);
  assert.equal(bestReceipt(source),undefined);
  assert.deepEqual(book[0].values[1],['Người dùng tổng hợp A','Chờ chấm','Chờ chấm']);
});

test('Một lượt đã chấm không cho phép công bố tổng buổi và TB tháng khi vẫn có lượt pending',()=>{
  const source=row(8);source.receipts.push({score:null,submittedAt:submittedAt+500,late:true});
  assert.equal(bestReceipt(source)?.score,8);
  const another=row(10,{lessonCode:'fixture-graded',date:'2026-10-15'}),book=buildScorebook([source,another],now);
  assert.deepEqual(book[0].values[1],['Người dùng tổng hợp A','10','Chờ chấm','Chờ chấm']);
});

test('Báo cáo phân biệt đã nộp chờ chấm với chưa nộp và giữ tổng số đã nộp',()=>{
  const waiting=row(null),missing=row(0,{studentId:'fixture-2',fullName:'Người dùng tổng hợp B',receipts:[]});
  const report=buildClassReport([waiting,missing],'fixture-pending','Lớp tổng hợp',now);
  assert.match(report,/Chờ chấm: Người dùng tổng hợp A/);
  assert.match(report,/Chưa nộp: Người dùng tổng hợp B/);
  assert.doesNotMatch(report,/Chưa nộp: Người dùng tổng hợp A/);
  assert.match(report,/Đã nộp 1\/2 con\. Điểm cao nhất lớp: Chờ chấm\./);
  assert.doesNotMatch(report,/0\/10/);
});

test('Không có pending thì giữ nguyên điểm, cách tính TB và báo cáo cũ',()=>{
  const source=row(7.5,{lessonCode:'fixture-graded',date:'2026-10-15',receipts:[{score:7.5,submittedAt,late:true}]}),missing=row(0,{receipts:[]});
  const book=buildScorebook([source,missing],now);
  assert.deepEqual(book[0].values[1],['Người dùng tổng hợp A','7,5 (muộn)','Chưa nộp','3,75']);
  const report=buildClassReport([source],'fixture-graded','Lớp tổng hợp',now);
  assert.match(report,/Nộp muộn: Người dùng tổng hợp A - 7,5\/10/);
  assert.match(report,/Điểm cao nhất lớp: 7,5\/10/);
  assert.doesNotMatch(report,/Chờ chấm/);
});

test('Pending trước mốc lịch sử vẫn bị loại theo quy tắc cũ, không chặn TB hiện hành',()=>{
  const source=row(9);source.receipts.push({score:null,submittedAt:Date.parse('2026-10-14T12:00:00+07:00'),late:false});
  assert.deepEqual(buildScorebook([source],now)[0].values[1],['Người dùng tổng hợp A','9','9']);
});

test('CSV buổi pending không lấy nhầm điểm cao nhất của buổi gốc',()=>{
  const receipt=(score:number|null,attemptId:string)=>({score,attemptId,attemptNumber:1,submittedAt,elapsedSeconds:1,late:false,timedOut:false});
  const source:StudentWork={student:{studentCode:'SYNTHETIC',fullName:'Người dùng tổng hợp',phone:'',className:'Lớp tổng hợp'},drafts:[],receipts:[receipt(8,'root-attempt')],lessons:{pending:{drafts:[],receipts:[receipt(null,'pending-attempt')]}}};
  const csv=scoresCsv([source],'root'),line=csv.split('\r\n').find(line=>line.includes('"pending-attempt"'))!;
  const cells=line.split(',').map(value=>value.replace(/^"|"$/g,''));
  assert.equal(cells[3],'pending');assert.equal(cells[4],'');assert.equal(cells[11],'');
});

finish();
