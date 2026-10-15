import type {PracticeExam} from '../../src/native/exams/data';
/** Giữ hình dạng đề cho bộ lưu/chấm phía trình duyệt; đáp án thật chỉ được chấm trên server.
 * Khóa dưới đây là giá trị giữ chỗ, tuyệt đối không dùng chấm điểm kiểm tra tháng. */
export function concealMonthlySolutions(exam:PracticeExam):PracticeExam {
 const copy=structuredClone(exam);
 delete copy.solutionInstructions;delete copy.mtmDocuments;delete copy.answerVerificationNote;
 copy.sourceUrl='https://minhthanhmath.vn';
 for(const q of copy.questions){
  delete q.solution;delete q.correctionNote;
  if(q.sourceContent)q.sourceContent.solutions=[];
  if(q.kind==='mc')q.answer='A';
  if(q.kind==='tf')q.answer=[false,false,false,false];
  if(q.kind==='short')q.acceptedAnswers=['0'];
 }
 return copy;
}
