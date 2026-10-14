# Đường ghi riêng BTVN — chưa triển khai

`index.ts` chỉ dùng `MTM_BTVN_PUBLISH_ROLE_JWT` với claim `role=mtm_btvn_publisher` còn hạn, tuyệt đối không dùng service_role. JWT này ở Edge server; VPS chỉ có secret `X-MTM-Publish-Secret`. Migration pending 006 chỉ cấp RPC xuất bản và INSERT/SELECT storage bucket `mtm-btvn`; không cấp bảng học sinh, bài làm, UPDATE/DELETE storage.

1. Claude/operator kiểm và áp 006 sau 005, theo quy trình backup và migration hiện hành; đợt này chưa chạy cloud.
2. Operator điền scope bằng SQL quản trị: `insert into mtm_hw_private.btvn_publish_scope(singleton,owner_id,class_ids) values(true,'OWNER_UUID',array['CLASS_UUID']::uuid[]);` — thay placeholder bằng owner/lớp thật đã duyệt, không truy vấn roster.
3. Thành/operator tự cấp và nhập JWT role riêng qua cơ chế ký JWT được dự án hỗ trợ; nếu dự án không hỗ trợ custom role JWT thì dừng triển khai adapter này, không thay bằng service_role.
4. Đặt Edge env `SUPABASE_URL`, `MTM_HOMEWORK_PUBLISHABLE_KEY`, `MTM_BTVN_PUBLISH_ROLE_JWT`, `MTM_BTVN_PUBLISH_SECRET`; không đưa giá trị vào repo/log/VPS worker trừ secret publish riêng.
5. Từ repo chạy `node scripts/build-btvn-publish.mjs`; generated JS phải dựng lại cùng handler/validator mỗi lần đổi nguồn.
6. Operator deploy Edge `mtm-btvn-publish` với gateway JWT verification tắt riêng function này, vì request dùng secret riêng thay JWT người dùng; handler bắt buộc kiểm secret trước RPC/upload, không bật public CORS.
7. Kiểm staging với dữ liệu giả: secret sai không gọi DB; role không đọc HS; bucket private; hash/proof sai không đăng; bài đạt đăng một lần; chạy lại không sửa; không kết luận từ PGlite rằng cloud đã đạt.
8. Luân chuyển JWT/secret bằng operator, đặt thời hạn và cảnh báo vận hành; worker không tự tạo/cấp lại khóa.

Kho chứa riêng, upload `upsert=false`; nếu tải lại tệp đã có từ lượt dở thì đối chiếu SHA-256. Công bố DB là transaction có advisory lock trên mã buổi, `active` khớp `publish_status`. Các lỗi giữ `loi`, inactive; `cho_duyet` giữ cho bản chuẩn bị/chờ kiểm. Cả hai không mở cho học sinh. `already_published` không thay exam/material/điểm cũ. Tài sản dở chưa liên kết có thể còn trong bucket; operator dọn sau đối soát, publisher không có quyền xóa.

Web `/api/btvn` mặc định đóng; operator chỉ bật `MTM_BTVN_ENABLED=1` sau nghiệm thu. Web server tái dùng credential server hiện có để resolve/chấm và ký tài sản 300 giây; credential này không nằm trong bộ dựng/VPS. Cần `MTM_BTVN_NETWORK_SECRET` riêng tối thiểu 32 ký tự và kiểm Vercel ghi đè `x-vercel-forwarded-for` trước bật. Đăng buổi mới sau lần triển khai ban đầu chỉ thay dữ liệu, không build/push/deploy web.
