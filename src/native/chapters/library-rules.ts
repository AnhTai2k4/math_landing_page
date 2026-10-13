// Quy tắc thuần cho kệ Luyện tập (không React, không đọc/ghi bộ nhớ) để test được.
// Không sửa dữ liệu đề: chỉ đọc các trường đã có trong practice-tests.json.

/** DL-06: bài HSA/TSA ngắn (vài câu, thang luyện tập riêng) là bài làm quen, chưa phải đề thi. */
export const WARMUP_LABEL = 'Bài làm quen, chưa phải đề thi';
export function isWarmup(item: {track?: string; exam: {questions: readonly unknown[]}}): boolean {
  return (item.track === 'HSA' || item.track === 'TSA') && item.exam.questions.length < 22;
}
