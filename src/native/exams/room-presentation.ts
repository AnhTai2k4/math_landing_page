import type {PracticeExam,PracticeQuestion} from './data';

/** Chỉ mở trang có ánh xạ của chính câu đang đọc, không đoán trang đầu phiếu. */
export function sourceQuestionPage(exam:Pick<PracticeExam,'sourcePdf'>,question:PracticeQuestion):number|undefined {
  const page=question.sourcePdfPage??question.sourceContent?.questions[0]?.sourcePage??Number(question.sourceRef.match(/(?:trang|tr\.)\s*(\d+)/i)?.[1]);
  return Number.isSafeInteger(page)&&exam.sourcePdf?.questionPages.includes(page)?page:undefined;
}

export function roomSectionLabel(name:string,index:number):string {
  return /^Phần\s/i.test(name)?name:`Phần ${index+1} · ${name}`;
}
