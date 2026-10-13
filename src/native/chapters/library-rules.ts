// Quy tắc thuần cho kệ Luyện tập (không React, không đọc/ghi bộ nhớ) để test được.
// Không sửa dữ liệu đề: chỉ đọc các trường đã có trong practice-tests.json.

/** DL-06: bài HSA/TSA ngắn (vài câu, thang luyện tập riêng) là bài làm quen, chưa phải đề thi. */
export const WARMUP_LABEL = 'Bài làm quen, chưa phải đề thi';
export function isWarmup(item: {track?: string; exam: {questions: readonly unknown[]}}): boolean {
  return (item.track === 'HSA' || item.track === 'TSA') && item.exam.questions.length < 22;
}

/** DL-01 (anh duyệt 14/10/2026, phương án b): bài trong ngân hàng cũ ghi "chờ phản biện độc lập"
 * (reviewStatus kết thúc bằng _INDEPENDENT_REVIEW_PENDING) không mở lượt MỚI. Bài đang làm dở vẫn
 * làm tiếp được, lượt đã nộp vẫn xem lại được. Lọc trong mã, không sửa practice-tests.json. */
export function awaitingReview(item: {reviewStatus?: unknown}): boolean {
  return typeof item.reviewStatus === 'string' && item.reviewStatus.endsWith('_INDEPENDENT_REVIEW_PENDING');
}
export const AWAITING_REVIEW_NOTICE = 'Bài này đang chờ phản biện độc lập nên tạm chưa mở lượt mới. Bài đang làm dở vẫn làm tiếp được; lượt đã nộp vẫn xem lại được trong lịch sử.';
/** Trên kệ: bài mở bình thường luôn hiện; bài chờ phản biện chỉ hiện với học sinh đã có bài dở
 * hoặc lượt đã nộp ở bài đó (để vào làm tiếp/xem lại), không hiện như bài mới. */
export function shelfVisible(item: {reviewStatus?: unknown}, hasAttempt: boolean): boolean {
  return !awaitingReview(item) || hasAttempt;
}
