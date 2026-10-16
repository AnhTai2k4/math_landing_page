import type {PracticeExam,PracticeQuestion} from './data';
import type {Draft} from './store';
import {validateDraft} from './store';
import {reviewRows} from './review';
import {hasReadableTfStatements} from './question-statements';

/** Chỉ dùng câu có đề và lời giải của đúng bản đã nộp. Không tạo hoặc chấm lượt mới. */
export function resultRecallItems(exam:PracticeExam,draft:Draft){
  const checked=validateDraft(draft,exam);
  if(!checked.ok||checked.value.submittedAt===null)return [];
  return reviewRows(exam,checked.value).filter(({q,status})=>
    ['wrong','partial','unanswered'].includes(status)&&
    !!(q.prompt?.trim()||q.text?.trim()||q.sourceContent?.questions?.length||exam.sourcePdf)&&
    (q.kind!=='tf'||hasReadableTfStatements(q)||!!exam.sourcePdf&&!q.sourceContent)&&
    !!(q.solution?.trim()||q.sourceContent?.solutions?.length)
  );
}
export type RecallItem=ReturnType<typeof resultRecallItems>[number];

/** Chỉ nhận vị trí có trong danh sách trang đề đã kiểm, không đoán trang theo số câu. */
export function recallPdfPage(exam:PracticeExam,question:PracticeQuestion){
  const page=question.sourcePdfPage??Number(/trang\s+(\d+)/i.exec(question.sourceRef)?.[1]);
  return exam.sourcePdf?.questionPages.includes(page)?page:undefined;
}
