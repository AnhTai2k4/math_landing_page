# Quản trị đề thi MTM — v41

Ngày kiểm: 10/10/2026. Đã kiểm tải PDF/khóa, lưu/readback, xem thử, đăng/ẩn đề kỹ thuật trên Supabase MTM thật `egljwujhgdapaxyrjskj`. Migration quản trị, chia điểm linh hoạt và BTVN đã áp dụng. V41 bảo vệ bản nháp khi đổi tài khoản, ghim request vào chủ tài khoản, giới hạn biến môi trường frontend và bổ sung tuyến BTVN. Trạng thái commit/push/deploy thực tế nằm trong HANDOFF_RECEIPT và POST_RELEASE_READBACK; không suy ra đã phát hành từ hướng dẫn này. Xem HOMEWORK_SETUP.md cho lịch sử theo mã và bảng tháng.

## Cấu hình một lần

1. Dự án riêng MTM đã có trên gói Free; không mua/nâng gói. Trước release kiểm lại đúng project, checkpoint/lease/base và hashes.
2. Migration `202610100001_mtm_exam_admin.sql` và `202610100002_mtm_flexible_exams.sql` đã apply; không chạy lại câu lệnh tạo bảng hoặc đổi RLS để vượt lỗi. Bản cập nhật hàm flexible đã readback nhóm URL/type/grants/admin trên cloud.
3. Tài khoản quản trị đã được Thành tự tạo/đăng nhập và cấp allowlist. Đăng ký công khai/anonymous Auth không được bật; không gửi/lưu mật khẩu trong mã/log, không email/SMS. Không dùng user_metadata để cấp admin.
4. Thêm hai biến build trên Vercel project `minhthanhmath`: `VITE_MTM_SUPABASE_URL` (URL HTTPS của dự án), `VITE_MTM_SUPABASE_PUBLISHABLE_KEY` (publishable key hoặc anon key). Không đưa secret/service_role key vào biến `VITE_`, frontend hoặc Git. Thiếu cấu hình thì trang quản trị đóng chức năng ghi.
5. Chạy typecheck/build, phát hành đúng diff đã xét và kiểm live: người chưa đăng nhập và người không phải admin bị chặn; Thành tải PDF, lưu/đọc lại nháp, nhập khóa, xem thử, đăng/ẩn; trình duyệt học sinh mở đề mới, nộp/chấm/xem PDF lời giải, lịch sử vẫn giữ sau sửa/ẩn. Chỉ sau readback này mới báo hoàn thành quản trị trên web thật.

```sql
-- Thành/owner thao tác trong SQL Editor của đúng dự án, dùng UUID thật từ Auth.
insert into public.mtm_exam_admins(user_id)
values ('UUID-TÀI-KHOẢN-QUẢN-TRỊ-THỰC-TẾ');
```

## Cách dùng

Mở `/quan-tri/de-thi`, đăng nhập, tạo đề. Chọn mẫu 50 câu A/B/C/D × 0,2; THPT Toán 12+4+6 (3/4/3 điểm, 90 phút); chọn + Đ/S, chọn + ngắn, Đ/S + ngắn; hoặc tự chọn 1–12 phần/tối đa 300 câu. Tự chia tổng 10 theo đơn vị 0,001 (phần dư hiển thị theo thứ tự), hoặc nhập điểm mỗi câu, bắt buộc điểm dương/tổng 10 trước đăng. Đ/S hỗ trợ lịch THPT 0/0,1/0,25/0,5/1, chia đều theo ý, hoặc chỉ đủ 4 ý mới có điểm. Chọn đúng lớp/kỳ/thời gian/nguồn/mã đề. PDF đề phải là tệp riêng chỉ có câu hỏi, không chỉ ẩn trang đáp án.

HSA: mẫu phần Toán 35 chọn + 15 điền số nguyên/phân số, 75 phút. TSA: mẫu phần Toán 40 câu/60 phút, tự đổi dạng theo đúng PDF. Đây là luyện MTM thang 10, chưa toàn bài HSA/TSA, chưa TSA nhiều đáp án/kéo thả hoặc điểm IRT. Nguồn chính thức được liên kết ngay trong mẫu.

Đổi cấu trúc cần xác nhận; khóa/lời giải cũ bị xóa để tránh gán nhầm câu, PDF/lịch sử được giữ. Hủy giữ nguyên cấu trúc/khóa. Điểm thủ công không tự co giãn; thay đổi giữa chừng hoặc tổng thiếu/thừa được hiển thị trước lưu/đăng.

Nhập khóa từng ô, dán ba dòng hoặc tải CSV/TXT theo mẫu. PDF lời giải có lớp chữ được đọc thử khi tải; nhận diện chưa chắc/khác mã đề/mâu thuẫn để trống. Kiểm bảng nhận diện rồi bấm áp dụng. Quản trị vẫn phải đối chiếu từng khóa với nguồn; máy nhận diện định dạng không chứng minh đáp án đúng Toán. PDF quét ảnh chưa có OCR trong bản này.

Lời giải có hai cách: nhập đủ từng câu (hỗ trợ công thức `$LaTeX$`), hoặc tải một PDF lời giải đầy đủ riêng. Học sinh xem phần này trong giao diện sau khi nộp. Có PDF lời giải thì các ô lời giải có thể để trống, nhưng khóa chấm theo cấu trúc đã chọn vẫn phải đầy đủ. Guide kí hiệu Kết nối tri thức 10–12 và KaTeX an toàn có trong quản trị.

Lưu nháp trên máy chủ, kiểm và xem thử trước khi đăng. Bản xem thử dùng bộ nhớ riêng, không tăng lịch sử học sinh. Sửa đề tạo bản có ID/hash mới; phiên bản cũ và điểm cũ giữ nguyên. Ẩn đề gỡ khỏi danh sách lượt mới; các bản từng công khai vẫn được giữ để đọc lại lịch sử. Tệp/bản đã tải về không thể thu hồi bằng thao tác ẩn.

Đây là hệ thống tự luyện với khóa chấm ở client như v37, không phải thi chống gian lận. Lịch sử học sinh vẫn lưu trên trình duyệt; phần quản trị này không bổ sung tài khoản học sinh/đồng bộ lịch sử.

## Bằng chứng và giới hạn

Model, PostgreSQL/PGlite role/RLS/RPC, typecheck/build và reviewer ChatGPT có receipt riêng. Fixture không thay cloud; rerun không cộng ca/vòng. Luồng admin thật nhập khóa 34/34 và 50/50, upload PDF, save/readback, xem thử, publish/hide. Luồng tự luyện 50 câu: một câu đúng +49 trống đạt 0,2/10, hiện điểm phần/50 trạng thái; PDF lời giải 4 trang và PDF đề 5 trang của phiên bản đã ẩn vẫn mở. BTVN theo mã cũng đã kiểm trên cloud bằng hồ sơ giả. Không dùng hồ sơ học sinh thật. Bằng chứng công khai sau phát hành được lưu riêng.

Claude cũ bị chặn, không gọi lại. Codex root là owner; reviewer độc lập là ChatGPT, không gọi là Claude. Không có dữ liệu học sinh thật trong QA. Không đổi homepage/logo/PDF/key v37/notebook-model.ts, DNS, gói trả phí hoặc tác vụ nền.
