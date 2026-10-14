// Quy tắc hiển thị thuần cho màn làm bài (không React, không đọc/ghi bộ nhớ) để test được.
// Không đổi luật chấm: dùng lại normalizedShort của assessment.ts đúng như resultFor.
import {normalizedShort} from './assessment';
import {isAnswered, type Answers} from './store';
import type {PracticeExam, PracticeQuestion} from './data';
import {examSections} from './flexible-profile';

export type ShortStatus = 'empty' | 'valid' | 'invalid';

/** Trạng thái ô trả lời ngắn. "invalid" khớp đúng trường hợp resultFor chấm 0 điểm
 * (mode numeric/rational mà normalizedShort trả null). Mode exact: có chữ là hợp lệ. */
export function shortAnswerStatus(mode: string, value: unknown): ShortStatus {
  if (typeof value !== 'string' || !value.trim()) return 'empty';
  if (mode === 'exact') return 'valid';
  return normalizedShort(mode, value) === null ? 'invalid' : 'valid';
}

/** Lời báo ngay dưới ô khi nhập sai định dạng; không lộ đáp án, không sửa hộ bài làm. */
export function shortFormatMessage(mode: string): string {
  return mode === 'rational'
    ? 'Chưa đúng định dạng: chỉ nhận số nguyên, số thập phân hoặc phân số dạng a/b (ví dụ -3/4). Nếu nộp như vậy, câu này được 0 điểm.'
    : 'Chưa đúng định dạng: câu này chỉ nhận số thập phân, ví dụ 0,5 hoặc -2,75 (không nhận phân số như 1/2 hay biểu thức). Nếu nộp như vậy, câu này được 0 điểm.';
}

export type AnswerState = 'answered' | 'blank' | 'partial' | 'invalid' | 'self';

/** "Đã trả lời đầy đủ" khi có câu trả lời VÀ hợp lệ định dạng; câu ngắn sai định dạng tách riêng;
 * câu Đ/S mới chọn một phần các ý là "partial". */
export function answerState(exam: PracticeExam, q: PracticeQuestion, answers: Answers): AnswerState {
  if (q.kind === 'self') return 'self';
  if (q.kind === 'short') {
    const status = shortAnswerStatus(q.mode, answers[q.id]);
    return status === 'valid' ? 'answered' : status === 'invalid' ? 'invalid' : 'blank';
  }
  if (isAnswered(exam, q.id, answers)) return 'answered';
  const value = answers[q.id];
  // Đ/S đã chọn một vài ý: chưa đủ nhưng không phải "trống" (review Codex đợt 2).
  return q.kind === 'tf' && Array.isArray(value) && value.some(v => typeof v === 'boolean') ? 'partial' : 'blank';
}

/** Nhãn câu theo phần, cùng một kiểu ở phiếu trả lời, hộp nộp và màn xem lại: "II · Đúng/sai · Câu 1". */
export function questionLabel(exam: Pick<PracticeExam, 'questions' | 'sections'>, index: number): {part: string; number: number; full: string} {
  const section = examSections(exam).find(s => index >= s.from && index < s.to);
  if (!section) return {part: '', number: index + 1, full: `Câu ${index + 1}`};
  const number = index - section.from + 1;
  return {part: section.name, number, full: `${section.name} · Câu ${number}`};
}

/** Danh sách câu chưa trả lời đầy đủ cho hộp xác nhận nộp bài (TT-01): trống hoặc sai định dạng. */
export function pendingQuestions(exam: PracticeExam, answers: Answers): {index: number; id: string; label: string; state: Exclude<AnswerState, 'answered'|'self'>}[] {
  return exam.questions.flatMap((q, index) => {
    if(q.kind==='self')return [];
    const state = answerState(exam, q, answers);
    return state === 'answered'||state === 'self' ? [] : [{index, id: q.id, label: questionLabel(exam, index).full, state}];
  });
}

/** TT-12: ô "Lớp x · kỳ" chỉ hiện khi có đề; ô đang chọn (từ URL cũ như ?lop=12&ky=CK1) vẫn hiện để
 * học sinh thấy mình đang lọc gì. Bộ lọc kỳ và URL ?ky= không đổi. */
export function visibleBuckets<G, P>(exams: readonly {grade: G; period: P}[], grades: readonly G[], periods: readonly P[], selected: {grade: G | 'all'; period: P | 'all'}): {grade: G; period: P; count: number}[] {
  return grades.flatMap(grade => periods.map(period => ({grade, period, count: exams.filter(e => e.grade === grade && e.period === period).length})))
    .filter(b => b.count > 0 || (b.grade === selected.grade && b.period === selected.period));
}

/** TH-07: số thập phân trong đáp án hiện bằng dấu phẩy như cách học sinh viết ("0.5" -> "0,5").
 * Chỉ đổi chữ hiển thị; khoá chấm trong dữ liệu đề giữ nguyên. Mode exact giữ nguyên văn. */
export function displayKeyAnswer(mode: string, value: string): string {
  return mode !== 'exact' && /^[+-]?\d+\.\d+$/.test(value.trim()) ? value.trim().replace('.', ',') : value;
}

/** DL-08: nội dung và tên tệp "Tải bản lưu bài làm" giữ y hệt nút "Xuất bài làm JSON" cũ
 * (JSON.stringify(draft, null, 2), tên bai-lam-<examId>-<startedAt>.json) để khôi phục được. */
export function draftExportFile(draft: {examId: string; startedAt: number}): {name: string; text: string} {
  return {name: `bai-lam-${draft.examId}-${draft.startedAt}.json`, text: JSON.stringify(draft, null, 2)};
}

export const scoredQuestionCount=(exam:Pick<PracticeExam,'questions'>)=>exam.questions.filter(q=>q.kind!=='self').length;
