// Quy tắc hiển thị thuần cho màn làm bài (không React, không đọc/ghi bộ nhớ) để test được.
// Không đổi luật chấm: dùng lại normalizedShort của assessment.ts đúng như resultFor.
import {normalizedShort} from './assessment';
import {isAnswered, type Answers} from './store';
import type {PracticeExam, PracticeQuestion} from './data';

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

export type AnswerState = 'answered' | 'blank' | 'invalid';

/** "Đã trả lời đầy đủ" khi có câu trả lời VÀ hợp lệ định dạng; câu ngắn sai định dạng tách riêng. */
export function answerState(exam: PracticeExam, q: PracticeQuestion, answers: Answers): AnswerState {
  if (q.kind === 'short') {
    const status = shortAnswerStatus(q.mode, answers[q.id]);
    return status === 'valid' ? 'answered' : status === 'invalid' ? 'invalid' : 'blank';
  }
  return isAnswered(exam, q.id, answers) ? 'answered' : 'blank';
}
