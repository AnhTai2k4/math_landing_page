import type {PracticeExam} from './data';
import type {Draft} from './store';
import {validateDraft} from './store';
import {reviewRows} from './review';

export const REFLECTION_CAUSES = [
  {id:'knowledge',label:'Chưa nhớ kiến thức hoặc cách bắt đầu',steps:['Tìm lại định nghĩa hoặc công thức liên quan trong vở, ghi đủ điều kiện áp dụng.','Đọc lời giải của đúng câu này và chỉ ra bước dùng kiến thức đó.','Gấp lời giải, tự viết lại cách bắt đầu rồi giải lại ra giấy.']},
  {id:'condition',label:'Bỏ sót điều kiện, dấu hoặc đơn vị',steps:['Đọc lại yêu cầu, khoanh điều kiện xác định và đơn vị nếu có.','Đối chiếu từng phép biến đổi với điều kiện; kiểm dấu và nghiệm ngoại lai nếu có.','Tự giải lại, ghi điều kiện trước phép tính và kiểm kết quả với đề gốc.']},
  {id:'calculation',label:'Nhầm phép tính hoặc thao tác',steps:['So từng dòng nháp với lời giải để tìm phép tính đầu tiên bị lệch.','Tính lại phép đó bằng một cách khác nếu làm được, rồi kiểm các bước sau.','Gấp lời giải và làm lại câu, soát dấu ngoặc và số đã nhập.']},
  {id:'reading',label:'Đọc nhầm yêu cầu hoặc nhập nhầm đáp án',steps:['Viết lại ngắn gọn đề cho gì và hỏi gì, kèm đơn vị nếu có.','Đối chiếu câu trả lời đã nhập với nháp và đúng ô của câu này.','Tự làm lại theo yêu cầu vừa viết; kiểm cách ghi đáp án trước khi kết luận.']},
  {id:'time',label:'Chưa kịp làm hoặc chưa xác định nguyên nhân',steps:['Dành một lượt không bấm giờ để thử lại câu trên giấy.','Nếu vẫn vướng, đọc lời giải và đánh dấu bước đầu tiên chưa hiểu.','Ghi một câu hỏi cụ thể để hỏi thầy; sau khi được giải thích hãy tự thử lại.']},
] as const;
export type ReflectionCause=typeof REFLECTION_CAUSES[number]['id'];

/** Chỉ lấy trạng thái đã chấm từ đúng lượt đã nộp, không suy đoán nguyên nhân. */
export function reflectionItems(exam:PracticeExam,draft:Draft){
  const checked=validateDraft(draft,exam);
  if(!checked.ok||checked.value.submittedAt===null)return [];
  return reviewRows(exam,checked.value).filter(row=>['wrong','partial','unanswered'].includes(row.status));
}
export function reflectionCause(value:string){return REFLECTION_CAUSES.find(cause=>cause.id===value);}
