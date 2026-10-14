// Chạy với Vite demo đang mở ở localhost; không tương tác tài khoản thật.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base='http://127.0.0.1:3019',route={classKey:'lop-test-12',lessonCode:'buoi-mau-01'};
const exam=JSON.parse(readFileSync('server/btvn/demo-exam.json','utf8'));
const gate={fullName:'Học sinh thử Một',phone:'0900000001',className:'LOP-TEST-12'};
let cookie='';const checks=[];
async function call(action,rest={}){
  const response=await fetch(base+'/api/btvn',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify({...route,action,...rest})});
  return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie'),cache:response.headers.get('cache-control')};
}
assert.equal((await call('state')).status,401);checks.push('Chưa vào cổng: không đọc đề qua API.');
for(const key of ['fullName','phone','className']){const r=await call('login',{gate:{...gate,[key]:'sai'}});assert.equal(r.status,401);assert.equal(r.data.message,'Không thể vào bài. Hãy kiểm tra thông tin hoặc thử lại sau.');}
checks.push('Sai từng trường trong 3 trường: cùng lỗi chung.');
const logged=await call('login',{gate});assert.equal(logged.status,200);cookie=logged.cookie.split(';')[0];assert.match(logged.cookie,/HttpOnly/);assert.match(logged.cache,/no-store/);
assert.ok(!JSON.stringify(logged.data).includes(gate.phone));assert.ok(!JSON.stringify(logged.data).includes('HS-TEST-02'));checks.push('Đúng 3 trường: mở đề, cookie HttpOnly, không trả danh sách/SĐT.');
const answers=Object.fromEntries(exam.questions.map(q=>[q.id,q.kind==='mc'?q.answer:q.kind==='tf'?q.answer:q.acceptedAnswers[0]]));
for(let i=1;i<=5;i++){
  const started=await call('start');assert.equal(started.status,200);assert.equal(started.data.attemptsUsed,i);
  assert.equal(started.data.draft.deadline-started.data.draft.startedAt,7200000);
  const sent=await call('submit',{attemptId:started.data.draft.attemptId,answers:i===1?answers:{}});assert.equal(sent.status,200);assert.equal(sent.data.receipts.length,i);
  assert.equal(sent.data.bestScore,10);
  const repeat=await call('submit',{attemptId:started.data.draft.attemptId,answers:{}});assert.equal(repeat.data.receipts.length,i);
}
assert.equal((await call('start')).status,409);checks.push('5 lượt ×120 phút; điểm cao nhất 10/10; gửi lặp không tăng lượt; lượt 6 bị chặn.');
const csv=readFileSync('T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/ket-qua-gia-dot-2-http.csv','utf8');assert.match(csv,/HS-TEST-01/);assert.ok(!csv.includes(gate.phone));assert.equal(csv.split('\r\n').filter(Boolean).length,6);checks.push('Đọc lại CSV trên ổ T: header + 5 lượt đúng; không có SĐT.');
for(const url of ['/server/btvn/demo-students.ts','/server/btvn/demo-exam.json','/@fs/T:/Work/MTM/Website-Native/work/claude-v65/wt-btvn/server/btvn/demo-students.ts','/api/btvn.ts','/scripts/check-btvn-http.mjs','/build/btvn-demo-results.csv','/tests/exams-btvn.test.mts','/@fs/T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/ket-qua-gia-dot-2-http.csv']){
  assert.equal((await fetch(base+url)).status,404);
}
checks.push('Vite không phục vụ tệp roster/đề JSON/mã API qua URL trực tiếp hoặc /@fs.');
await call('logout');assert.equal((await call('state')).status,401);checks.push('Thoát phiên: cookie cũ không còn mở đề.');
const report={at:new Date().toISOString(),mode:'HTTP thực trên Vite loopback, không phải browser QA',checks,passed:true,browserVerified:false};
writeFileSync('T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/HTTP-QA-DOT-2.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
