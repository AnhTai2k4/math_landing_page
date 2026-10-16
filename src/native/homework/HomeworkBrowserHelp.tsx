/** Chỉ hướng dẫn, không đọc URL phiên, không tự điều hướng hoặc sao chép dữ liệu. */
export default function HomeworkBrowserHelp(){
  return <details className="btvn-entry-help">
    <summary>Gặp lỗi khi làm bài trong Zalo?</summary>
    <p>Em xem trạng thái lưu bài trước khi chuyển trình duyệt. Phần chưa được máy chủ nhận sẽ không theo sang trình duyệt khác. Đừng đóng trang khi bài còn báo chưa lưu.</p>
    <p>Trong menu Zalo, chọn mở bằng trình duyệt nếu có. Nếu không thấy, tự mở Chrome hoặc Safari rồi nhập <strong>minhthanhmath.vn/btvn</strong>.</p>
    <p>Đăng nhập lại bằng cách cũ, chọn đúng buổi học và kiểm tra phần bài đã lưu trước khi làm tiếp. Phiên đăng nhập có thể khác giữa các trình duyệt. Không gửi đường dẫn riêng, mã học sinh hoặc thông tin đăng nhập vào nhóm.</p>
  </details>;
}
