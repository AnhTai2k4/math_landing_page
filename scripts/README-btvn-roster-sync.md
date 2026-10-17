# Đồng bộ roster BTVN — operator-only, đợt 10

`sync-btvn-roster.mjs` chỉ nhận bundle đã có COMPLETE từ importer; không tự đọc Sheet trong đợt10. Codex chỉ chạy dữ liệu giả. CLI dùng `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` từ process env do Claude/operator nạp; không đọc hoặc lưu file credential. Chỉ gọi RPC sync (migration007); schema private không cần expose qua PostgREST.

Bổ sung hồ sơ công khai ngày 17/10/2026: sau khi operator kiểm và áp migration `202610170025_btvn_public_profile.sql`, importer nhận cột trường tùy chọn qua `columns.school`, ví dụ `"school":"Trường"`. Tên cột phải khớp nguồn đã xác minh. Bundle giữ trường để sync; CSV mã không thêm trường. Đồng bộ chỉ bổ sung `students.school` đang trống hoặc `Chưa cập nhật`, không ghi đè trường gốc đã có hoặc trường học sinh tự nhập trong hồ sơ. Cả `Chua cap nhat` không dấu và biến thể chữ hoa đều được coi là chưa cập nhật.

Nguồn điểm danh tự nhận tiêu đề `Trường`, `Trường học` hoặc `Trường đang học`. Khi nhiều bản ghi cùng tên, điện thoại và lớp cho các trường khác nhau, giữ trường chờ đối soát. Không chạy importer vào nguồn thật chỉ để thử cột mới.

## Chuẩn bị riêng tư

Review/áp riêng 007 sau 005/006, backup theo quy trình hiện hành. Cấu hình SQL quản trị **không dò roster**:

```sql
insert into mtm_hw_private.btvn_roster_scope
(singleton,owner_id,sheet_id,protected_student_ids)
values(true,'OWNER_UUID','SHEET_ID',array['FIXTURE_1_UUID','FIXTURE_2_UUID']::uuid[]);
```

Thay placeholders bằng owner admin, nguồn Sheet và đúng **hai UUID thử cũ** từ receipt được phép của operator. Cấu hình không đủ thì RPC từ chối. Không cấp bảng private cho service_role/anon/authenticated. Migration mở grade 6–12 để nhận THCS; grade từng lớp phải xác minh, không suy từ cohort.

Tệp sync-config riêng trong `T:/Claude/SanPham/btvn-web-diem-danh/rieng-tu/` (không có secret):

```json
{
  "legacyReconciled": true,
  "classGrades": {"2K9 9+":12,"2K9 8+":12},
  "legacyMappings": {"HS_MA_TRONG_BUNDLE":"STUDENT_UUID_DA_DOI_SOAT"}
}
```

Mẫu grade chỉ minh họa hai lớp khối12; thêm **mọi** lớp trong bundle theo grade đã kiểm. `legacyMappings` dùng studentCode đúng như bundle để ghép UUID cũ. Không tìm người bằng tên/SĐT/STT. `legacyReconciled=true` chỉ sau đối soát tất cả hồ sơ cũ liên quan (trừ hai fixture bảo vệ), alias chuyển lớp/đổi tên và 15/16 tab. Không có mapping cần thiết thì chưa chạy live, tránh tạo trùng hồ sơ. Registry phải giữ ổn định; không tạo bundle mới mất registry.

## Chạy

```powershell
node scripts/sync-btvn-roster.mjs BUNDLE_PATH --config SYNC_CONFIG_PATH
node scripts/sync-btvn-roster.mjs BUNDLE_PATH --config SYNC_CONFIG_PATH --live
node scripts/configure-btvn-publish-scope.mjs
node scripts/configure-btvn-publish-scope.mjs --live
```

Thay path bằng lượt có COMPLETE thật đã kiểm. Mặc định dry-run cần operator env và RPC; transaction rollback mọi thay đổi, chỉ trả thống kê. Codex không chạy dry-run vào DB thật. CLI không in tên/SĐT/mã; added/updated/unchanged/skipped/excluded là các nhóm khác nhau; `removed=0` vì không xóa/cho nghỉ người vắng khỏi bundle. `excluded` do importer lọc, `skipped` là hồ sơ nguồn đã đồng bộ trước mà lượt này không có, giữ nguyên để quản lý đối soát.

Live atomically upsert lớp/hồ sơ/membership và chỉ cấp mã khi chưa từng có mã. Cấp bằng helper private `btvn_issue_import_code` giữ nguyên điều kiện của issuer đợt5 (khóa dòng, admin, active, không thay mã hết hạn/thu hồi), nhận mã128bit từ importer để phục hồi sau timeout. Không gọi issuer cũ thu hồi hàng loạt. `source_identity` là hash nguồn + hash mã registry, nên thay lớp/SĐT không đổi identity. Ghép legacy giữ UUID/trường/alias/mã/điểm/phiên; membership cũ đóng rồi tạo membership mới khi chuyển lớp. Hai fixture và lớp chứa fixture không được sửa. Scope publisher chỉ nhận 2K9 9+/8+ từ **batch live mới nhất**, chỉ đọc lớp và danh sách class_ids đã sync, không SELECT roster.

CLI live tạo thư mục `rieng-tu/sync-<time>-<pid>`: INTENT trước RPC, result/CSV/COMPLETE sau xác nhận. Mã CSV đối chiếu digest DB; mã cũ không có bản thô thì để trống và ghi `giu_ma_cu_thieu_ban_tho`, không cấp lại. Mã hết hạn/thu hồi vẫn được giữ và đối chiếu, CSV không chứng minh mã đang dùng được. Kiểm ACL Windows của thư mục riêng tư trước chạy; mode0600 không chứng minh ACL. Không đưa bundle/INTENT/result/CSV vào Git, web, Notion, cầu nối hoặc gửi HS.

Timeout hoặc lỗi lưu sau live: không chạy lại bằng registry mới. Đối soát INTENT với DB bằng operator, dùng **cùng bundle/mã**; retry idempotent trả lại mã đã khớp digest, không cấp lần2. COMPLETE chỉ chứng minh lượt đã ghi/xuất, không chứng minh nghiệm thu web hoặc đã gửi mã.

Test offline: `node scripts/test-btvn-round10.mjs` (PGlite RAM + synthetic fixtures, không env thật/mạng). Runtime Deno, PostgREST cloud, ACL và người vận hành vẫn cần kiểm riêng.
