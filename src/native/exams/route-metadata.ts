import {PERIOD_LABELS,type PracticeExam} from './data';
const ORIGIN='https://www.minhthanhmath.vn';
/** Metadata follows the same ready exam selected by NativeExams, including an
 * external QA catalog. Avoid an eager import of question/key packs into App. */
export function examRouteMetadata(exam:PracticeExam|undefined,detail:boolean) {
  const title=exam?.title??(detail?'Chưa mở được đề':'Thi thử Toán');
  const description=exam?`Lớp ${exam.grade} · ${PERIOD_LABELS[exam.period]}. ${exam.title}: ${exam.questionCount??22} câu, ${exam.durationMinutes} phút; làm bài và xem kết quả luyện tập trên trình duyệt.`:detail?'Đề trong đường dẫn chưa có trong danh sách đã kiểm tra. Chọn đề từ mục Thi thử của Minh Thành Math.':'Đề luyện tập Toán lớp 10, 11, 12 theo giữa kỳ và cuối kỳ. Các đề được kiểm tra nguồn, câu hỏi và đáp án trước khi mở làm bài.';
  return {title:title+' | Minh Thành Math',description,url:ORIGIN+'/thi-thu'+(exam?'/'+encodeURIComponent(exam.id):''),ogImage:ORIGIN+'/mtm-original-logo.png',robots:'noindex, follow'};
}
