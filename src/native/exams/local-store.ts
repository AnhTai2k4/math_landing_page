// KT-06 (Đợt 3): tách khỏi PracticeAttempt.tsx để trang danh sách Luyện tập đọc bản nháp/lịch sử
// mà không phải nạp cả phòng làm bài. PracticeAttempt.tsx xuất lại hàm này nên chỗ nhập cũ không đổi.
import type {Store} from './store';

export function localStore(): Store | null {
  try { return window.localStorage; } catch { return null; }
}
