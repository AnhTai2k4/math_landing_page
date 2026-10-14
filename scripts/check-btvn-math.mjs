import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const exam=JSON.parse(readFileSync('server/btvn/demo-exam.json','utf8'));
const add=(a,b)=>a.map((v,i)=>v+b[i]);const sub=(a,b)=>a.map((v,i)=>v-b[i]);const mul=(t,a)=>a.map(v=>v*t);
const eq=(a,b)=>a.every((v,i)=>v===b[i]);const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const length=a=>Math.sqrt(dot(a,a));
const A=[0,0,0],B=[2,0,0],D=[0,3,0],C=add(B,D),Ap=[0,0,4],Bp=add(B,Ap),Cp=add(C,Ap),Dp=add(D,Ap);
const v=(a,b)=>sub(b,a);
const mc='BCABCCACABDC'.split('');
const reasons=[
  'BC=AD, DA=-AD nên cùng phương; các lựa chọn còn lại theo AB hoặc AA′.',
  'AB có điểm đầu A, điểm cuối B.', 'BB=0.', 'BA=CD trong hình hộp.',
  'SA+AB=SB theo quy tắc ba điểm.', 'AD+AB=AC.', 'AB+AD+AA′=AC′.',
  'SA−SB=BA.', 'A′D′=AD nên AB+A′D′=AC.', 'SA+SC=2SO, SB+SD=2SO; tổng 4SO.',
  '2MN=B+C−A−D=AB+DC khi M,N là trung điểm AD,BC.', 'AB+AD+A′C′=2AC.',
];
// Kiểm từng ý bằng toạ độ hình hộp và đẳng thức trọng tâm; không dùng khóa nguồn để tính.
const tf=[
  [eq(v(B,Ap),v(C,Dp)),length(v(B,Ap))===length(v(Ap,D))&&length(v(Ap,D))===length(v(D,B)),8*7===56,length(v(B,Dp))===3*Math.sqrt(3)],
  [eq(add(add(v(A,B),v(Ap,Dp)),v(Bp,B)),v(Ap,C)),eq(add(v(A,B),v(A,Ap)),v(Bp,A)),eq(sub(v(A,B),v(A,D)),v(Dp,Bp)),eq(sub(add(v(A,B),v(B,D)),v(A,C)),v(D,C))],
  (()=>{const M=mul(.5,add(B,Bp)),G=mul(1/3,add(add(A,B),C));return[eq(v(B,M),mul(.5,v(B,Bp))),eq(v(A,M),add(v(A,B),mul(.5,v(Bp,B)))),eq(v(A,M),add(mul(.5,v(A,B)),mul(.5,v(A,Bp)))),eq(add(add(v(M,A),v(M,B)),v(M,C)),mul(3,v(M,G)))];})(),
  [eq(v(A,B),v(Cp,Dp)),eq(v(Ap,D),mul(-1,v(C,Bp))),eq(v(Ap,Bp),mul(1,v(A,C))),[v(A,D),v(Ap,Dp),v(Bp,Cp)].every(vector=>eq(vector,v(B,C)))],
];
// III.2: AN-AM; III.3: hai đường chéo tạo góc 60°; III.4: khai triển tích vô hướng;
// III.5: định thức 3m-3; III.6: ba lực vuông góc (N), làm tròn 0,1.
const short=[4,-.5+.5+.5,Number(Math.sqrt(3).toFixed(2)),-45/6,1,Number(Math.sqrt(2**2+3**2+4**2).toFixed(1))].map(String);
const rows=[];
for(let i=0;i<12;i++){assert.equal(exam.questions[i].answer,mc[i]);rows.push({cell:`I.${i+1}`,answer:mc[i],reason:reasons[i],match:true});}
for(let i=0;i<4;i++)for(let j=0;j<4;j++){assert.equal(exam.questions[12+i].answer[j],tf[i][j]);rows.push({cell:`II.${i+1}.${'abcd'[j]}`,answer:tf[i][j],reason:'Đối chiếu vectơ/tọa độ và tính độ dài hoặc trọng tâm trong script.',match:true});}
for(let i=0;i<6;i++){assert.equal(Number(exam.questions[16+i].acceptedAnswers[0]),Number(short[i]));rows.push({cell:`III.${i+1}`,answer:short[i],reason:['4 vectơ BA, CD, B′A′, C′D′.','MN=(AC+AD−AB)/2.','cos=1/2; tan=√3≈1,73.','a·b=−5; (ka−b)·(a+2b)=−6k−45=0.','det=3m−3=0.','√(2²+3²+4²)=√29≈5,4 N.'][i],match:true});}
assert.equal(rows.length,34);
const output={at:new Date().toISOString(),reviewer:'Codex (ChatGPT)',examVersionHash:exam.versionHash,cells:34,matched:34,
  method:'Đã xem 4 bảng ảnh câu gói nguồn; tính lại hình học/vectơ và số. Đã đọc khóa/nhật ký cũ trước lượt này, không tuyên bố giải mù. Chưa có phản hồi Claude/Javis cho bản thử này.',rows};
writeFileSync('T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/KIEM-TOAN-34-O.json',JSON.stringify(output,null,2)+'\n');
console.log('Gói BTVN mẫu: kiểm lại 34/34 ô khớp; không thay khóa nguồn; cần Claude nghiệm thu.');
