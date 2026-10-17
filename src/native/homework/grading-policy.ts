import type {PracticeExam} from '../exams/data';
import type {LessonMaterial} from './btvn-contract';

/** Cùng điều kiện với migration 026. Câu đã chuyển sang trả lời ngắn được
 * chấm tự động; chỉ phần còn phải chấm tay mới giữ điểm ở trạng thái tạm. */
export function requiresManualHomeworkGrade(exam:Pick<PracticeExam,'questions'>,material?:Pick<LessonMaterial,'homeworkNote'>){
  return exam.questions.some(question=>question.kind==='self'||String(question.kind)==='essay')||
    /nộp\s+vở|nop\s+vo|tự\s+luận|tu\s+luan/i.test((material?.homeworkNote??'').normalize('NFC'));
}

export const validOfficialHomeworkScore=(value:unknown):value is number=>
  typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=10;
