import assert from 'node:assert/strict';
import {sourceQuestionPage,roomSectionLabel} from '../src/native/exams/room-presentation';
import type {PracticeExam,PracticeQuestion} from '../src/native/exams/data';

// Các ca vị trí trang kiểm dữ liệu ánh xạ độc lập với renderer PDF.
const file={url:'/qa-exam-assets/'+ 'a'.repeat(64)+'.pdf',verified:true as const,sha256:'a'.repeat(64),bytes:500,totalPages:7,questionPages:[2,3,5]};
const exam:Pick<PracticeExam,'sourcePdf'>={sourcePdf:file};
const question=(fields:Partial<PracticeQuestion>={})=>({id:'qa',kind:'mc',sourceRef:'Phiếu nguồn',maxMillipoints:250,choices:['A','B','C','D'],answer:'A',...fields}) as PracticeQuestion;
const crop={path:'qa/cau.png',sourcePage:2,width:800,height:400,sha256:'b'.repeat(64)};

assert.equal(sourceQuestionPage(exam,question({sourcePdfPage:5,sourceContent:{questions:[crop]},sourceRef:'trang 3'})),5,'Trang PDF được chỉ định ưu tiên hơn trang crop và chuỗi nguồn');
assert.equal(sourceQuestionPage(exam,question({sourceContent:{questions:[crop]},sourceRef:'trang 3'})),2,'Trang crop hợp lệ dùng được khi chưa có sourcePdfPage');
assert.equal(sourceQuestionPage(exam,question({sourceRef:'Phiếu · trang 3 · Câu 7'})),3,'Trích đúng trang từ nguồn có vị trí');
assert.equal(sourceQuestionPage(exam,question({sourceRef:'Phiếu · tr. 5'})),5,'Nhận cách viết trang rút gọn');
for(const invalid of [0,-1,1,4,7,8,99,2.5,NaN,Infinity]){
 assert.equal(sourceQuestionPage(exam,question({sourcePdfPage:invalid,sourceContent:{questions:[crop]},sourceRef:'trang 3'})),undefined,`Không đoán trang khác khi sourcePdfPage không hợp lệ: ${invalid}`);
}
assert.equal(sourceQuestionPage(exam,question()),undefined,'Thiếu ánh xạ thì không mặc định trang 1');
assert.equal(sourceQuestionPage(exam,question({sourceRef:'trang 1'})),undefined,'Trang không thuộc tập trang câu hỏi không được mở');
assert.equal(sourceQuestionPage({},question({sourcePdfPage:3})),undefined,'Thiếu PDF thì không có trang phiếu gốc');
assert.equal(roomSectionLabel('Phần I · Trắc nghiệm',2),'Phần I · Trắc nghiệm','Giữ tên phần rõ ràng sẵn có');
assert.equal(roomSectionLabel('Bài tập tự luận',0),'Phần 1 · Bài tập tự luận','Nhóm tự luận có tên phần thay cho số đơn lẻ');
assert.equal(roomSectionLabel('Ví dụ',1),'Phần 2 · Ví dụ','Nhóm phụ không trông giống nút câu hỏi');
console.log('Đạt hồi quy phòng BTVN: ưu tiên đúng trang câu, không đoán trang đầu, nhãn nhóm rõ.');
