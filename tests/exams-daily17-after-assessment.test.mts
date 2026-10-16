// Fixture tổng hợp, không gọi mạng hoặc đọc dữ liệu riêng tư.
import assert from 'node:assert/strict';
import {mtmPracticeGradingReadiness,scoreMtmEqualAssessment} from '../src/native/exams/mtm-assessment';
import {MTM_SCORING_VERSION,mtmFraction,normalizeMtmShort,type MtmShortRule} from '../src/native/exams/mtm-scoring';
import {suite} from './exams-harness.mts';

const {test,finish}=suite('DAILY17-SAU-PHAN-BIEN-ASSESSMENT');
const hash='a'.repeat(64);
function examFor(kind:'mc'|'tf'='tf'):any {
  const base={id:'q-1',sourceRef:'Nguồn tổng hợp, câu 1',prompt:'Câu hỏi tổng hợp.',maxPoints:mtmFraction(10n),maxMillipoints:10000};
  return {id:'assessment-after-fixture',rubricVersion:MTM_SCORING_VERSION,sourceHash:hash,versionHash:'b'.repeat(64),sourceRef:'Nguồn tổng hợp',
    answerKeyVersion:'fixture-key-v1',sourceComplete:true,questionCount:1,answerKeyVerified:true,rubricVerified:true,
    questions:[kind==='mc'?{...base,kind,choices:['Một','Hai','Ba','Bốn'],answer:'A'}:
      {...base,kind,statements:['Ý a','Ý b','Ý c','Ý d'],answer:[true,false,true,false],pointsByCorrectCount:[0,1000,2500,5000,10000]}]};
}
function scored(exam:any){const result=scoreMtmEqualAssessment(exam,Object.fromEntries(exam.questions.map((q:any)=>[q.id,q.answer])));
  assert.ok(result.ok);assert.ok(result.mtm);return result.mtm;}
function pdfExam(){const exam=examFor();delete exam.questions[0].statements;delete exam.questions[0].prompt;exam.questions[0].sourcePdfPage=1;
  exam.sourcePdf={url:'/exam-assets/'+hash+'.pdf',verified:true,sha256:hash,bytes:128,totalPages:3,questionPages:[1,2]};return exam;}
function expectStructureConflict(exam:any){assert.equal(mtmPracticeGradingReadiness(exam).valid,false);const result=scored(exam);
  assert.equal(result.officialTotal,null);assert.equal(result.rows[0].earned,null);
  assert.ok(result.rows[0].issues.some(issue=>issue.code==='SOURCE_STRUCTURE_CONFLICT'));return result;}

test('DS prompt ba hoặc năm ý so với bốn statements giữ nguyên N và pending',()=>{
  for(const labels of ['abc','abcde']){const exam=examFor();exam.questions[0].prompt='Xét các ý:\n'+[...labels].map(label=>label+') Ý '+label).join('\n');
    const result=expectStructureConflict(exam);assert.equal(result.rows.length,1);assert.deepEqual(result.rows[0].maxScore,mtmFraction(10n));}
});
test('DS đủ bốn ý nhưng nội dung hoặc thứ tự nhãn khác cũng pending',()=>{
  for(const content of ['a) Ý a\nb) Nội dung khác\nc) Ý c\nd) Ý d','a) Ý a\nc) Ý b\nd) Ý c\ne) Ý d']){
    const exam=examFor();exam.questions[0].prompt='Xét các ý:\n'+content;expectStructureConflict(exam);}
});
test('DS có nhãn không cách vẫn kiểm ba/năm ý và nhận đúng bốn ý khớp',()=>{
  for(const labels of ['abc','abcde']){const exam=examFor();exam.questions[0].prompt='Xét các ý:\n'+[...labels].map(label=>label+')Ý '+label).join('\n');expectStructureConflict(exam);}
  const exam=examFor();exam.questions[0].prompt='Xét các ý:\n'+[...'abcd'].map(label=>label+')Ý '+label).join('\n');
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).officialDisplayTotal,'10.00');
});
test('DS nhiều ý trên cùng dòng phân tách dấu chấm phẩy không lọt gate cấu trúc',()=>{
  for(const labels of ['abc','abcde']){const exam=examFor();exam.questions[0].prompt='Xét các ý: '+[...labels].map(label=>label+') Ý '+label).join('; ');expectStructureConflict(exam);}
  const exam=examFor();exam.questions[0].prompt='Xét các ý: '+[...'abcd'].map(label=>label+') Ý '+label).join('; ');
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).officialDisplayTotal,'10.00');
});
test('Cả prompt và text đều được kiểm trước adapter; khoảng trắng tương đương không tạo lỗi',()=>{
  const exam=examFor();exam.questions[0].prompt='Xét các ý:\na) Ý a\nb) Ý b\nc) Ý c\nd) Ý d';
  exam.questions[0].text='Xét các ý:\na) Ý  a\nb) Ý b\nc) Ý c\nd) Ý d';
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).officialDisplayTotal,'10.00');
  exam.questions[0].text='Xét các ý:\na) Ý a\nb) Ý b\nc) Ý c';expectStructureConflict(exam);
});
test('MC có a), b) trong thân đề vẫn là TN; phương án A-D chép đúng được nhận',()=>{
  const exam=examFor('mc');exam.questions[0].prompt='Xét cách giải:\na) Biến đổi.\nb) Kiểm tra.';
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).rows[0].type,'TN');assert.equal(scored(exam).officialDisplayTotal,'10.00');
  exam.questions[0].prompt+='\nA. Một\nB. Hai\nC. Ba\nD. Bốn';assert.equal(mtmPracticeGradingReadiness(exam).valid,true);
});
test('Nội dung ý nhiều dòng được so toàn bộ và không phát sinh lỗi do xuống dòng',()=>{
  const exam=examFor();exam.questions[0].statements[1]='Ý b có hai dòng\nvà giữ điều kiện.';
  exam.questions[0].prompt='Xét các ý:\na) Ý a\nb) Ý b có hai dòng\n  và giữ điều kiện.\nc) Ý c\nd) Ý d';
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);
  exam.questions[0].prompt=exam.questions[0].prompt.replace('giữ điều kiện','đổi điều kiện');expectStructureConflict(exam);
});
test('MC chép khác nội dung hoặc thừa phương án A-E bị chặn mà vẫn giữ loại TN',()=>{
  for(const prompt of ['A. Một\nB. Khác\nC. Ba\nD. Bốn','A. Một\nB. Hai\nC. Ba\nD. Bốn\nE. Năm']){
    const exam=examFor('mc');exam.questions[0].prompt=prompt;assert.equal(expectStructureConflict(exam).rows[0].type,'TN');}
});
test('PDF nội bộ gắn hash lowercase và locator của đúng câu được chấm',()=>{
  for(const dir of ['exam-assets','qa-exam-assets']){const exam=pdfExam();exam.sourcePdf.url='/'+dir+'/'+hash+'.pdf';
    assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).officialDisplayTotal,'10.00');}
});
test('Không dùng URL https bất kỳ, hash viết hoa hoặc URL không khớp hash làm nguồn thay DS',()=>{
  for(const change of [(e:any)=>{e.sourcePdf.url='https://example.invalid/de.pdf';},
    (e:any)=>{e.sourcePdf.sha256=hash.toUpperCase();e.sourcePdf.url='/exam-assets/'+hash.toUpperCase()+'.pdf';},
    (e:any)=>{e.sourcePdf.url='/exam-assets/'+ 'c'.repeat(64)+'.pdf';},
    (e:any)=>{e.sourcePdf.url+='?version=1';}]){const exam=pdfExam();change(exam);assert.equal(mtmPracticeGradingReadiness(exam).valid,false);assert.equal(scored(exam).officialTotal,null);}
});
test('PDF toàn đề không tự cung cấp locator trang cho từng câu thiếu statements',()=>{
  for(const page of [undefined,0,3,'1',1.5]){const exam=pdfExam();if(page===undefined)delete exam.questions[0].sourcePdfPage;else exam.questions[0].sourcePdfPage=page;
    assert.equal(mtmPracticeGradingReadiness(exam).valid,false);assert.equal(scored(exam).officialTotal,null);}
});
test('Hai câu cùng trang PDF vẫn hợp lệ nếu từng câu có locator rõ',()=>{
  const exam=pdfExam();exam.questions.push({...exam.questions[0],id:'q-2',sourceRef:'Nguồn tổng hợp, câu 2'});exam.questionCount=2;
  exam.sourcePdf.questionPages=[1];for(const q of exam.questions){q.maxPoints=mtmFraction(5n);q.maxMillipoints=5000;}
  assert.equal(mtmPracticeGradingReadiness(exam).valid,true);assert.equal(scored(exam).officialDisplayTotal,'10.00');
  delete exam.questions[1].sourcePdfPage;assert.equal(mtmPracticeGradingReadiness(exam).valid,false);
  const result=scored(exam);assert.equal(result.rows[0].status,'graded');assert.equal(result.rows[1].status,'ungradable');assert.deepEqual(result.rawTotal,mtmFraction(5n));
});
test('Nguồn ảnh gắn riêng câu và DS văn bản đầy đủ không bị ép có locator PDF',()=>{
  const image=pdfExam();delete image.sourcePdf;delete image.questions[0].sourcePdfPage;
  image.questions[0].sourceContent={questions:[{path:'fixture/question.png',sha256:hash,sourcePage:1,width:800,height:600}]};
  assert.equal(mtmPracticeGradingReadiness(image).valid,true);
  const text=examFor();text.sourcePdf={url:'https://example.invalid/unused.pdf'};assert.equal(mtmPracticeGradingReadiness(text).valid,true);
});
test('TF thiếu statements vẫn phát hiện ba nhãn trong prompt dù PDF và locator đủ',()=>{
  const exam=pdfExam();exam.questions[0].prompt='Xét các ý:\na) Ý a\nb) Ý b\nc) Ý c';expectStructureConflict(exam);
});
test('TLN chỉ cắt đúng token đơn vị, không coi cm là hậu tố m',()=>{
  const rule:MtmShortRule={verified:true,evidence:'Quy tắc tổng hợp',mode:'decimal',unit:'m'};
  assert.equal(normalizeMtmShort('12 m',rule),'12/1');assert.equal(normalizeMtmShort('12\tm',rule),'12/1');
  for(const input of ['12 cm','12cm','12m','m'])assert.equal(normalizeMtmShort(input,rule),null);
  assert.equal(normalizeMtmShort('12 cm',{...rule,unit:'cm'}),'12/1');
});

finish({fixture:'Dữ liệu tổng hợp, không mạng hoặc dữ liệu riêng tư'});
