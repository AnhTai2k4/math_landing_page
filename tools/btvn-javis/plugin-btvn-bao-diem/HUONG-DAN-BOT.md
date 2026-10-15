# Báo điểm và điểm danh sau ca học

Plugin `btvn-bao-diem` chỉ lấy dữ liệu khi gọi, không xuất tệp theo giờ, không tạo lịch, không gửi Zalo. Giữ `enabled: false` cho đến khi Claude kiểm triển khai và bật đúng brain. Quyền gửi tin là bước riêng của bot hiện hành.

1. Sau ca học đã kết thúc, xác định đúng nhãn lớp vừa học trên web MTM, đúng nhóm PH của lớp và quyền gửi hiện hành.
2. Gọi `btvn_bao_diem_lop(lop="2K9 8+", so_buoi=1)`. `so_buoi` mặc định 1, nhận số nguyên 1 đến 20; chỉ tăng khi cần báo nhiều buổi đã học. Không suy tên lớp hoặc tự đổi `2K9` sang lớp khác.
3. Kết quả gồm (a) tin báo PH theo `buildClassReport`, (b) bảng điểm để đối soát, (c) điểm danh buổi gần nhất đã kết thúc. Chỉ gửi phần (a) và (c) cho PH đúng lớp, giữ nguyên thông tin hạn đang chờ xác minh. Không gửi bảng (b) mặc định. Không trộn kết quả hai lần gọi/hai lớp.
4. Nếu tool trả lỗi kết nối/quyền, danh sách lớp hợp lệ, hoặc điểm danh chưa đủ trạng thái thì đối soát trước; không gửi như báo cáo hoàn chỉnh và không tự lấy dữ liệu từ lớp khác. Tool không thử gửi tin hay đổi quyền để khắc phục.
5. Không gửi SĐT, token hoặc dữ liệu định danh ngoài họ tên cần cho thông báo lớp. Không lưu toàn bộ kết quả vào nhật ký bot hay sổ Notion. Chỉ ghi nhãn lớp, thời điểm, thành công/thất bại nếu quy trình hiện hành cần log.

Điểm là điểm cao nhất theo đúng hàm chung, chỉ tính lượt nộp từ 15/10/2026; bài từ 01/10/2026. Nhãn muộn theo lượt đạt điểm cao nhất. Hạn chưa xác minh được giữ nguyên trong phần (a). Ô điểm danh trống không được tự suy ra là vắng; plugin trả yêu cầu đối soát. `C/M` là có mặt, `L/P/PH P` là vắng có phép, `K` là vắng, `ON` là online (theo mã đã chuẩn hóa từ parser hiện hành).

Các buổi BTVN chỉ được báo sau giờ kết thúc theo lịch lớp trên web, dự phòng 21:30 nếu thiếu lịch như quy tắc mở bài hiện hành. Điểm danh đối chiếu giờ bắt đầu với lịch lớp; chưa khớp thì chỉ xem là đã kết thúc từ 23:59 ngày đó để tránh báo sớm. Điểm danh chỉ lấy buổi mới nhất, dù `so_buoi` lớn hơn 1; ngày giờ của từng phần được ghi riêng và không khẳng định chúng là cùng buổi.

Nếu sổ có ghi chú mơ hồ, khối lẫn khóa hoặc cấu hình chưa được đối soát, tool trả một câu lỗi tiếng Việt. Không coi dữ liệu một phần là đã xác minh.
