# BTVN MTM và mã học sinh — v41

Ngày kiểm: 10/10/2026. Owner: Codex root. Reviewer độc lập: ChatGPT, không phải Claude. Thành đã cho phép áp dụng BTVN lên Supabase MTM và phát hành frontend sau nghiệm thu. Cloud đã áp dụng migration 003+004, kho PDF riêng và Edge gateway; QA chỉ dùng hồ sơ, lớp và đề giả. Trạng thái commit/push/deploy thực tế đọc trong HANDOFF_RECEIPT và POST_RELEASE_READBACK; tệp này không thay bằng chứng deploy.

## Cách dùng

1. Đăng nhập /quan-tri/de-thi, mở Quản trị BTVN và mã học sinh. Tạo lớp MTM, hồ sơ gồm họ tên, trường, lớp tại trường. Cấp mã và chuyển riêng cho đúng học sinh. DB chỉ lưu HMAC. Cấp lại hoặc thu hồi đóng mã/phiên cũ, giữ lịch sử.
2. Tạo đề BTVN riêng: chọn cấu trúc, tự chia tổng 10 hoặc nhập điểm từng câu. 50 câu trắc nghiệm ×0,2 =10. Nhập khóa từng câu hoặc CSV/TXT theo mẫu và đối chiếu. PDF câu hỏi và PDF lời giải là hai tệp riêng. Có PDF lời giải đầy đủ thì có thể để trống lời giải từng câu.
3. Lưu, đọc PDF và kiểm bản xem thử, chọn lớp/thời gian mở/hạn/trọng số rồi giao. Học sinh đã thuộc lớp trước thời gian mở bài mới được so hạng cùng tập bài. BTVN không xuất hiện trong danh mục đề tự luyện công khai.
4. Học sinh mở /btvn, nhập mã → đọc bốn thông tin hồ sơ → xác nhận → làm bài của lớp. Máy chủ giữ đáp án, thời gian, điểm, số lượt và lịch sử. Sau nộp xem điểm từng phần, câu đúng/sai/bỏ trống và toàn bộ PDF lời giải.
5. Bảng tháng ở đầu trang BTVN chỉ hiển thị mã bảng, nhóm, hạng, điểm %, số bài, lượt và thời gian của lượt tính hạng. Không hiện tên/trường/mã đăng nhập của bạn khác. Chỉ lượt 1 nộp đúng hạn và đủ điều kiện tính điểm thưởng; bài thiếu tính 0. Luyện lại giữ lịch sử và tăng số lượt, không tăng điểm thưởng. Cùng điểm cùng hạng. Giáo viên xét thưởng cuối tháng; không tự thanh toán hay chốt tháng nền.

## Cloud và bảo vệ dữ liệu

Đích: Supabase egljwujhgdapaxyrjskj, gói hiện có. Migration 202610100003_mtm_homework.sql và 202610100004_valid_code_rate.sql đã áp dụng; không chạy lại 003. Schema mtm_hw_private có 11 bảng RLS, không cho anon/authenticated đọc trực tiếp. Quản trị qua allowlist và owner; RPC học sinh chỉ dành cho server role. Bucket mtm-homework private, học sinh không được đọc Storage trực tiếp.

Edge mtm-homework-access là tuyến mới dành cho mã riêng, verify_jwt=false và tự xác minh mã/challenge/phiên ở từng thao tác. Không thay Auth/JWT của tuyến khác. Service credential chỉ ở server. Browser build chỉ đọc VITE_MTM_SUPABASE_URL và VITE_MTM_SUPABASE_PUBLISHABLE_KEY; không đưa service key/secret vào Git/frontend.

Production CORS chỉ https://www.minhthanhmath.vn và https://minhthanhmath.vn. MTM_HOMEWORK_LOCAL_QA=1 chỉ cho kiểm 5528/5529, trả về 0 trước phát hành. Mã/phiên không vào URL/log/ảnh/Notion/Git. Challenge 5 phút, phiên 8 giờ, giữ RAM tab. Reload cần nhập lại mã; lịch sử máy chủ vẫn còn.

Gateway có allowlist operation, giới hạn body, khóa mạng 120/min và khóa cho mã hợp lệ 10/min. Năm phép thử x-forwarded-for giả trên cùng mạng nhận một scope, tăng 5 hit. Header CF+kèm real-IP bị nền tảng chặn trước function: chưa kết luận chung cho mọi cấu hình proxy/DDoS. Migration 004 không tạo counter theo mã sai tùy ý. Không log raw IP.

PDF theo immutable version: kiểm magic/size/SHA256 rồi trả bytes, không trả signed URL học sinh. Lời giải chỉ sau own submit. Máy chủ xác định deadline, chấm theo khóa phiên bản, CAS/revision và khóa dòng; không nhận điểm/identity/đường dẫn PDF từ client.

## Bằng chứng và giới hạn

QA cloud: admin tải hai PDF/50 khóa, giao lớp; mã → đúng profile → xác nhận; autosave; nộp muộn chấm bản đã lưu (1 đúng,1 sai,48 bỏ trống =0,2/10); lượt đầu đúng hạn 0,2/10 tạo điểm bảng 2%; luyện lại 0/10 tăng lượt nhưng giữ 2%; tải lại/cấp lại mã giữ ba lượt; hồ sơ B có 0 lịch sử và chỉ thấy alias bảng của A; thu hồi A xóa phiên/profile ở UI. Public deny QA kiểm private schema, 7 RPC học sinh, metadata bucket và Edge sai key/origin/method/operation. Giao diện mobile, typecheck/build và kiểm transaction/CAS, readback công khai được ghi riêng theo receipt cuối; không cộng rerun thành ca/vòng mới.

Đóng tab không tự nộp. Hết giờ khóa đáp án; nộp muộn chấm bản máy chủ đã lưu và không tính hạng. Mất mạng: đáp án chưa lưu chỉ nằm trong tab. CAS báo phiên khác sửa thì tải lại, nhập mã và tiếp tục bản máy chủ; không tự ghi đè. UI lịch sử/admin hiển thị 100 mục, DB giữ toàn bộ. Chưa nhập roster hàng loạt, chỉnh hồ sơ bằng UI, chốt tháng/xuất sổ thưởng hoặc thi giám sát. Học sinh vẫn có thể chia sẻ mã/đáp án; chấm server không chứng minh chống gian lận.

Lịch sử tự luyện công khai vẫn lưu trong trình duyệt, không tự chuyển sang hồ sơ mã. HSA/TSA là mẫu luyện phần Toán MTM thang 10, chưa toàn bài/IRT/TSA nhiều đáp án hoặc kéo thả. Ký hiệu đối chiếu sách Toán Kết nối tri thức 10–12 và renderer KaTeX an toàn; giữ PDF/khóa/lịch sử gốc. Claude trước đây bị chặn, không gọi lại hoặc ghi reviewer ChatGPT thành Claude.
