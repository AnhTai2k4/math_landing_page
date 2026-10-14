# Publisher BTVN — đợt 10, chưa deploy

Không cần `MTM_BTVN_PUBLISH_ROLE_JWT`, không ký JWT hoặc lấy JWT secret. VPS chỉ giữ `BTVN_PUBLISH_SECRET` để gửi header `X-MTM-Publish-Secret`.

DB dùng `SUPABASE_DB_URL` trong Edge, Postgres.js `prepare:false`, pool 1 kết nối. Mỗi RPC mở transaction, `SET LOCAL ROLE mtm_btvn_publisher` rồi gọi duy nhất `public.mtm_btvn_pipeline` bằng tham số. Không fallback sang RPC service_role khi SET ROLE thất bại. Role hẹp không được đọc roster hoặc ghi điểm.

Storage dùng **chỉ** `.storage` của client có `SUPABASE_SERVICE_ROLE_KEY` tự cấp trong Edge. Port chỉ cho bucket private `mtm-btvn`, đường `btvn/<lesson-key>/<source-hash>/<asset>.png|pdf`, kiểm hash/MIME/size và `upsert:false`. Handler kiểm secret, proof và toàn bộ hash trước upload. Chỉ download đúng đường khi upload báo trùng để so hash; không list/remove/update bucket. Service role có quyền rộng ở cấp credential: giới hạn Storage ở đây do mã port/handler cưỡng chế, không được mô tả là key có quyền bucket hẹp.

## Operator triển khai, không phải lệnh Codex đã chạy

1. Đối soát migration 005/006 theo receipt cloud, backup và owner; phiếu đợt10 nói 006 đã áp, **không chạy lại**. Review/áp riêng migration pending 007 để có sync/scope và quyền SET role cho DB principal mặc định `postgres`. Nếu principal thật khác, operator kiểm membership/SET option của principal đó trước; không đổi quyền rộng để né lỗi.
2. Dựng `node scripts/build-btvn-publish.mjs` và kiểm hash nguồn/handler; deploy riêng function:

```powershell
supabase functions deploy mtm-btvn-publish --project-ref PROJECT_REF --no-verify-jwt
```

Thay `PROJECT_REF` bằng dự án đã xác minh. Tắt gateway JWT chỉ function này vì handler dùng shared secret; không đổi cấu hình toàn project.

3. Trong Supabase dashboard, đặt/luân chuyển `MTM_BTVN_PUBLISH_SECRET` riêng (32–1024 ký tự). Các tên `SUPABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_SERVICE_ROLE_KEY` là built-in Edge; chỉ kiểm tồn tại, không tải/in giá trị. Không cần `MTM_HOMEWORK_PUBLISHABLE_KEY` cho publisher (API web vẫn dùng theo cấu hình riêng). Không gửi DB URL/service key sang VPS.
4. Kiểm cloud riêng bằng fixture giả trên scope thử được duyệt: secret sai không RPC/upload; SET role thành công; role không SELECT students; lỗi transaction không giữ role; storage private; hash sai không upload; publish/retry không sửa dữ liệu. Lỗi SET ROLE phải dừng publish, không bỏ dòng SET.
5. Đồng bộ roster và scope bằng README của scripts, rồi publish buổi đã kiểm và thử Preview theo biên bản đợt10. Production vẫn đóng đến nghiệm thu riêng.

## Khả thi và giới hạn bằng chứng

Supabase hướng dẫn kết nối Postgres từ Edge bằng `SUPABASE_DB_URL` và `prepare:false`: [Connect to Postgres](https://supabase.com/docs/guides/functions/connect-to-postgres). PostgreSQL hỗ trợ `SET LOCAL ROLE` trong transaction, session user cần quyền SET role: [SET ROLE](https://www.postgresql.org/docs/current/sql-set-role.html). Đã kiểm transaction/role trên PGlite và port thật, chưa kiểm DB URL/principal/TLS/network/runtime Deno của dự án cloud. Vì vậy chưa khẳng định đường live đã hoạt động.

Nếu cloud không cho principal built-in SET role, phương án hẹp tiếp theo là operator cấp **một login DB chỉ được SET sang role publisher**, đặt URL riêng trong Edge qua cơ chế dự án cho phép; hoặc một RPC SECURITY DEFINER được xác thực riêng, chỉ wrap pipeline đúng scope. Chưa triển khai phương án thay thế; không đưa service_role vào DB publish RPC hoặc dùng JWT secret trái quyền.
