# BTVN tự đăng trên Javis VPS, đợt 17

## Bổ sung đợt 24

Luật mở chuẩn nằm trong `server/btvn/class-rules.json`, dùng chung với web. Chép tệp này vào `<brain>/Javis/btvn/class-rules.json` và đặt `BTVN_CLASS_RULES` bằng đường dẫn tuyệt đối tương ứng. Thiếu tệp thì worker giữ bài, không tự mở theo lịch cũ. Ngày ngoài buổi khớp của lớp có luật dùng 21:30 như web; lớp ngoài luật vẫn dùng lịch dự phòng cũ. Cặp 2K9 8+/9+ mở sau buổi 9+ đầu cặp; 2K10 9+ buổi Chủ nhật mở sau buổi thứ Sáu.

`.qa-temp/dot-24/config.vps.json` là bản đề xuất để merge, không ghi đè cấu hình VPS. Giữ `allowed_hosts`, `attendance_map`, bí mật và receipt hiện hành. Bản mẫu thiếu `attendance_map`, host Edge còn placeholder. Bộ model được đề xuất theo phiếu, chưa xác minh quyền/hạn mức thực tế. Kỳ được duyệt kết thúc 15/06/2027; buổi sau đó bị chặn cho đến khi bổ sung kỳ hợp lệ. Đóng gói lại attendance bundle từ mã hiện hành sau khi cập nhật luật; Edge tự gắn luật chuẩn khi nhận `sync_due`, worker không gửi luật do client quyết định.

## Bổ sung đợt 18

Worker nhận cả buổi tương lai đã có lịch xác nhận. Record được ghi sẵn cho buổi tương lai vẫn nhận; quyền làm bài do máy chủ khóa theo `classOpensAt`. Mỗi lớp lấy ngày riêng trong `class_dates`, ISO có múi giờ `+07:00`. Từ đợt 24 dùng luật mở ở mục trên; lịch dự phòng `class-schedule.json` và 21:30 chỉ dành cho nhãn ngoài luật chuẩn.

Khi triển khai VPS, chép `server/btvn/class-schedule.json` vào vùng cấu hình và đặt `BTVN_CLASS_SCHEDULE` trỏ đường dẫn tuyệt đối của tệp đã chép. Giữ nguyên `receipts.sqlite`: worker dùng receipt cũ để tìm đúng khóa bài đợt 17, vốn chứa hash metadata. Khi chỉ thêm video/tài liệu, worker gọi `update_material`, không chạy AI hoặc đăng lại đề. Nếu mất receipt và metadata đã thay đổi, chưa thể tự nhận lại khóa phiên bản cũ bằng chỉ một dòng Sheet; phải khôi phục receipt trước khi chạy.

Metadata đã đồng bộ lưu trong bảng SQLite `material_sync`; chỉ cập nhật giá trị mới không trống, không xóa video/tài liệu vì ô Sheet rỗng. Lỗi cập nhật giữ nguyên receipt đã đăng để thử lại lượt sau. Thông báo tổng hợp ghi rõ `Đã cập nhật video bài ...` hoặc `Đã cập nhật thông tin bài ...`. Đáp án trùng ID file HS hoặc tên chip/URL chứa `_HS` bị giữ trước tải PDF và trước đăng.

Chỉ là bộ mã và hướng dẫn bàn giao. Đợt này không kết nối mạng thật, không tạo lịch, không chạy AI trả phí, không đăng bài. Claude là chủ triển khai. Không dùng `service_role`, không đọc danh sách học sinh.

## Các tệp và đường dẫn

- `btvn-tu-dang.py`: launcher được Javis gọi mỗi giờ. Chạy nhanh, kiểm giờ Việt Nam, ngày kết thúc, cấu hình, khóa. Worker con giữ FD khóa trên Linux ngay từ lúc spawn, không có khoảng hở giữa hai tiến trình. Khóa kernel tự nhả nếu tiến trình chết.
- `worker.py`, `runtime.py`: worker, Google SA, Anthropic Messages, cấu hình bí mật, nhận xét độc lập, thông báo và receipt.
- `requirements.txt`: cài thư viện vào `$JAVIS_STATE_DIR/btvn/lib`, mặc định `/data/state/btvn/lib`. Không cần apt-get hay Poppler, không sửa `/app`.
- `config.example.json`: phạm vi hai Sheet, chín tab, mười lớp cấp 3. Chỉ là mẫu, còn phải xác minh cột, phạm vi, lịch, kỳ, model và máy chủ đăng bài.
- `bundle-validator.mjs`: đóng gói validator PracticeExam hiện hành trên PC thành một tệp Node độc lập. VPS không cần mã web hay esbuild. Cần đóng gói lại khi validator web đổi.
- `offline.py`, `tests/test_javis.py`: smoke và kiểm thử giả, cần cây repo trên PC. Không cần chép các tệp này lên VPS chạy thật.

Đích triển khai:

```text
<brain>/Javis/scripts/btvn-tu-dang.py
<brain>/Javis/scripts/runtime.py
<brain>/Javis/scripts/worker.py
<brain>/Javis/scripts/requirements.txt
<brain>/Javis/btvn-pipeline/pipeline.py
<brain>/Javis/btvn/config.json
<brain>/Javis/btvn/validator.bundle.mjs
/data/state/btvn/publish.env
```

`runtime.pipeline_dir()` tự tìm thư mục `Javis/btvn-pipeline` là anh em với `Javis/scripts`. Có thể đặt `BTVN_PIPELINE_DIR`, `BTVN_CONFIG` để đổi. State theo `JAVIS_STATE_DIR`, brain theo `JAVIS_BRAIN_ROOT` mà reminders truyền vào. Mỗi bộ này chỉ phục vụ một brain/chủ nhận tin trong một state; không triển khai hai chủ cùng state.

## 1. Chuẩn bị trên PC, Claude kiểm và chép

Không ghi Git trong đợt Codex này. Claude xem diff và biên bản trước khi commit.

```powershell
node tools/btvn-javis/bundle-validator.mjs .qa-temp/dot-17/validator.bundle.mjs
```

Giữ cả receipt SHA-256 cạnh bundle, đối chiếu readback sau chép. Tệp bundle là nguồn thật từ `src/native/exams/data.ts`, không phải validator viết lại hay bỏ điều kiện.

Đọc mã Javis đã xác minh `/files/write` nhận **form** `brain`, `path`, `content`, không phải JSON. Claude dùng kênh đã đăng nhập, từng tệp văn bản và đọc lại/hash. Ví dụ lệnh trên VPS sau khi có tệp văn bản trong vùng tạm được phép:

```sh
curl --fail -sS -X POST "http://127.0.0.1:${JAVIS_PORT:-7777}/files/write" \
  --data-urlencode 'brain=brain' \
  --data-urlencode 'path=Javis/scripts/worker.py' \
  --data-urlencode 'content@worker.py'
```

Lặp với các đích ở trên. `brain=brain` chỉ là mã mẫu Brain Default; kiểm đúng brain thật, không dùng đường dẫn PC làm mã brain. Không chép cả repo, dữ liệu học sinh hoặc nguồn nặng. Không gửi secret qua log/lệnh có giá trị rõ; Claude đặt tệp riêng tư `publish.env` bằng đường được phép.

## 2. Điền cấu hình thật, không đoán

- Hai workbook mặc định `material_only_workbook:false`. Chỉ đổi thành true sau khi xác minh **toàn workbook** không có dữ liệu học sinh, vì Drive export tải cả workbook dù bộ đọc chỉ chiếu vùng A:K. Nếu không bảo đảm, dùng `format:grid`, URL Sheets API gồm `includeGridData=true` và một `ranges` tab đã duyệt. Pipeline giữ `chipRuns`, hyperlink và textFormatRuns. Worker tự gắn bearer SA cho duy nhất `www.googleapis.com`.
- Tab `2K11` có tên cột HS khác, mẫu đã đặt override. Những tab chưa đọc trực tiếp phải kiểm header/range trước. Không nới A:K sang các cột bảng điểm. Mẫu không xác nhận HSA/HSA .2 có cùng header; có thể chuyển chúng ra khỏi tabs trước vận hành nếu chưa được kiểm. Chỉ các lớp `enabled` được nhận bài.
- Alias `Thầy Tài` chỉ ở tab `2k10 T6`. Alias khác phải thêm theo nguồn thật; không tự suy giáo viên thành lớp.
- `classes`: nhãn chính xác trên web, `enabled`, `dates` ISO và/hoặc `weekdays` (0 thứ Hai, 6 Chủ nhật). Lịch động 2K9/2K11/XPT hiện để trống, buổi chưa khớp sẽ bị giữ. Không gán mặc định lịch 8+/9+.
- `shared_lessons` ghi cặp bài có ngày thật, ví dụ cấu trúc:

```json
{"source_class":"2K9 9+","source_date":"2026-10-19","classDates":{"2K9 9+":"2026-10-19","2K9 8+":"2026-10-20"}}
```

Đây là ví dụ cấu trúc, chưa phải xác nhận lịch. Nếu Sheet có hai dòng cùng bài, khai cùng `classDates` cho hai dòng để gộp. Chỉ gộp khi cùng nguồn BTVN/đáp án và bản đồ ngày. Chỉ định nguồn/ngày tường minh để không gộp nhầm hai lần dùng cùng phiếu. Riêng bài thứ Ba của 2K10 9+ tự nhận thêm lớp `2K10 Thứ 3, 6` cùng ngày; bài thứ Sáu từ tab `2k10 T6` qua alias theo mục 25. Lớp THCS mới thêm bằng `classes`, alias/tab nếu cần, không sửa mã worker.
- `periods` phải phủ các ngày buổi theo mốc nhà trường thực tế, không chồng nhau; mỗi phần tử `{start,end,period}` với `period` thuộc GK1/CK1/GK2/CK2. Mẫu để trống, không gán GK1 suốt một năm.
- Chọn model vision API thật cho `extractor.model`, `reviewer.model`. Không suy khả năng/hạn mức từ tên. Endpoint cố định OpenAI Chat Completions và Anthropic Messages; không gửi khóa sang proxy.
- Thêm hostname Edge chính xác vào `allowed_hosts`, thay `CHON_HOST_EDGE`. PDF WPS/host khác chỉ thêm khi nguồn được duyệt và trả PDF HTTPS trực tiếp; không có chuyển hướng tự động. Chỉ bearer Google đi đến API Google.

Secret ưu tiên `/data/state/btvn/publish.env`, nếu không có mới lấy `<brain>/Javis/btvn/.publish.env`:

```text
BTVN_PUBLISH_URL=https://HOST_DA_XAC_MINH/functions/v1/mtm-btvn-publish
BTVN_PUBLISH_SECRET=GIA_TRI_RIENG_TU_TOI_THIEU_32_KY_TU
```

Tệp ưu tiên có mặt nhưng hỏng thì dừng, không lấy bản khóa cũ. Không có bí mật thật trong mẫu. Key AI đọc qua `/app/server/config.read_settings()` để giải mã; không đọc/in settings thô. SA lấy `MTM_GOOGLE_SA_PATH`, hoặc duy nhất một `*service_account.json` trong `connector-files`. Nhiều tệp thì yêu cầu chọn rõ, không đoán tài khoản.

## 3. Cài lần đầu và kiểm thật trước khi bật lịch

Chạy trong container dưới user Javis. Bước này là hướng dẫn cho Claude, chưa thực hiện trong đợt offline:

```sh
python -m pip install --disable-pip-version-check --no-input \
  --target "${JAVIS_STATE_DIR:-/data/state}/btvn/lib" \
  -r '<brain>/Javis/scripts/requirements.txt'
```

Worker cũng tự cài khi thiếu import, tối đa 600 giây, chỉ worker chờ cài; launcher không đợi pip/AI. Cần xác minh VPS có pip, quyền ghi state, wheel tương thích và mạng PyPI. Không in đầu ra có credential. Sau khi đóng gói, dùng validator độc lập bằng Node 22 và đối chiếu cùng fixture với validator web.

Chạy một lượt thật, chưa tạo cron:

```sh
JAVIS_BRAIN_ROOT='<brain>' python '<brain>/Javis/scripts/worker.py' --live
```

Lệnh này **có thể tốn tiền API và tự đăng bài đạt** theo quyền trong phiếu, chỉ Claude triển khai sau khi đã kiểm cấu hình thật. Giờ phải 7 đến hết 23 theo UTC+7 và ngày không quá 15/10/2027. Đọc receipt, trạng thái Edge, lớp/classDates, bài/crop, video và không ghi đè bài cũ; nghe/nhìn AI thật khi có. Chạy lại phải không tạo bài trùng. Không lấy dry-run làm bằng chứng đã đăng.

## 4. Tạo đúng một lịch sau kiểm thật

Đọc danh sách `/reminders` của brain trước, nếu đã có lịch BTVN thì cập nhật/chỉnh lịch đó, không tạo song song. Javis cron dùng múi giờ cấu hình server: kiểm đang là Việt Nam. Launcher còn kiểm UTC+7 độc lập.

```sh
curl --fail -sS -X POST "http://127.0.0.1:${JAVIS_PORT:-7777}/reminders" \
  -H 'Content-Type: application/json' \
  -d '{"mode":"script","script":"btvn-tu-dang.py","cron":"0 7-23 * * *","brain":"brain","label":"BTVN tự đăng đến 15/10/2027"}'
```

Kiểm JSON `ok:true`, lưu id, đọc lại lịch và đúng brain. Javis mặc định **7777**, đã đọc `main.py`, không dùng mặc định 8000. Lịch reminders không có ngày kết thúc; launcher và worker/publisher tự chặn sau 15/10/2027. Sau hạn, lịch còn tồn tại nhưng trả `[SILENT]`, không gọi AI hoặc đăng.

Tắt lịch bằng id đã lưu, form đúng mã Javis:

```sh
curl --fail -sS -X POST "http://127.0.0.1:${JAVIS_PORT:-7777}/reminders/cancel" \
  --data-urlencode 'brain=brain' --data-urlencode 'id=ID_LICH_DA_LUU'
```

Đọc lại trạng thái. Cancel chỉ ngăn lượt sau; nếu cần ngừng lượt đang chạy, Claude tìm đúng PID worker và kết thúc có kiểm chứng. Không xóa khóa đang có owner, không bật lịch mới để thay khóa.

## Dữ liệu, kiểm và thông báo

- PDFium render 200 dpi, giữ tọa độ marker Câu N bằng PDFium text search. PDF scan không có marker đọc được giữ chờ, không tự nhận đã OCR.
- OpenAI được HS/GV để trích. Anthropic lần giải đầu chỉ nhận HS và bản trích whitelist không khóa. Lần kiểm chuyển dạng sau đó mới được GV, giữ receipt riêng. Thiếu bất kỳ slot, reasoning, conversion_verified, khác khóa hoặc validator không đạt đều chặn.
- Đề ba phần giữ; worksheet tối đa 22 câu có xác nhận khó dần; đáp số gọn chuyển short. Crop PNG không resize, kiểm pixel. Tên nguồn/SĐT chỉ xóa vùng 12% đầu/chân trang do extractor xác nhận; nếu chạm câu thì chặn. Bản PDF gửi web được dựng lại từ trang đã xóa vùng; crop PNG mới là bằng chứng pixel nguyên. Publisher chỉ ghi `MTM sưu tầm và biên soạn`. Không tải PDF nguyên có tên/SĐT lên web.
- Khóa bài dựa lịch lớp và dấu vân tay bytes HS/GV cùng metadata. Mỗi giờ tải lại để nhận sửa ngay cả cùng URL Drive; lookup theo phiên bản **trước gọi AI**. Nội dung đổi tạo bài mới; không cập nhật bài đã có lượt HS. Đây là cùng pipeline/owner, không tạo một publisher nền thứ hai.
- `receipts.sqlite` giữ phản hồi, lời giải độc lập, slot và provider/model thật. `receipts/*.json` ghi từng lượt, phiên bản/lớp/trạng thái và mục hạn còn chờ. Logs chỉ thông tin an toàn, không URL/token/khóa.
- Lỗi lớp/buổi/lý do gửi ngay qua loopback `/reminders` notify, có `ok` mới ghi đã nhận. Cùng lỗi/ngày không gửi lại; lỗi gửi thất bại nằm outbox, thử lại lượt sau. Không bypass kênh Telegram thiếu bằng `allow_no_channel`.
- Thành công xếp hàng, gom một tin ở lượt 23h; không có bài mới thì không gửi. Tin dài giữ phần dư cho lần tổng hợp sau, không bỏ mất dòng. Không có bảo đảm exactly-once Telegram nếu tiến trình chết giữa gửi và ghi receipt, vì reminders không có idempotency key.
- Đợt 21 đã nối mã đồng bộ sổ/hạn qua Edge dùng secret publish hiện hành. Triển khai và nghiệm thu VPS thật còn do Claude thực hiện theo phần dưới; không cấp service_role cho VPS.

## Kiểm offline trên PC

```powershell
# Dùng Python runtime đã có pypdfium2/Pillow/pypdf/openpyxl, không tải gói từ mạng.
python -m unittest discover -s tools/btvn-javis/tests -v
python -m unittest discover -s tools/btvn-pipeline/tests -v
python tools/btvn-javis/btvn-tu-dang.py --dry-run
```

Trong phiên này `python` không nằm PATH, lệnh thực tế dùng `C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`; tệp tạm/checkpoint đều trên T. Dry-run dùng transport/AI/publisher giả và fixture PDF cục bộ có sẵn, chặn urllib/socket, gọi validator PracticeExam thật. Chưa chứng minh chạy Linux, khóa FD kế thừa thật, API/hạn mức, SA/Drive, Telegram, cron hoặc đã đăng.

## Đợt 21: sổ điểm danh, hạn nộp và báo cáo hỗ trợ

Phần này là hướng dẫn triển khai cho Claude, Codex chỉ sửa và kiểm offline. Không tạo thêm lịch. Worker giữ nguyên khóa và lịch 7-23h hiện có. Cuối mỗi lượt, kể cả lượt lỗi nguồn bài, worker đọc sổ và đồng bộ rồi lấy báo cáo một giờ gần nhất. Chạy sau bước xử lý bài để tính hạn cả bài vừa đăng.

### Edge, Claude chạy

```powershell
node scripts/build-btvn-publish.mjs
node tools/btvn-javis/bundle-attendance.mjs .qa-temp/dot-21/attendance.bundle.mjs
supabase functions deploy mtm-btvn-publish --project-ref <PROJECT_REF_DA_XAC_MINH> --no-verify-jwt
```

Đối chiếu project thật trước lệnh deploy, không dùng chuỗi mẫu. Giữ secret `MTM_BTVN_PUBLISH_SECRET` hiện hành, `SUPABASE_DB_URL`, `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` chỉ ở Edge. Không in/chuyển giá trị bí mật. Migrations 015-017 theo phiếu đã áp, không chạy lại từ đợt này. DB phải cho kết nối Edge `SET LOCAL ROLE service_role` và gọi ba RPC đã có. Pipeline cũ vẫn dùng `mtm_btvn_publisher` trong transaction riêng. Không cần cấp thêm quyền DB cho worker.

Ba action POST, cùng header `X-MTM-Publish-Secret`:

- `sync_attendance`: `{action, rows:[{label,fullName,phone,source}], apply:false}` gọi `mtm_btvn_sync_attendance_roster`. Mặc định dry-run, cờ apply phải boolean. Tối đa 10.000 dòng, không cho danh sách rỗng để tránh xóa toàn sổ.
- `sync_due`: `{action, sessions:[{classKey,label,startsAt,sourceIdentity,attendees:[{name,phone,status}]}], apply:false}` gọi `mtm_btvn_sync_due`. Tối đa 2.000 buổi, 1.000 em/buổi, tổng 20.000 lượt. Payload đồng bộ tối đa 10 MiB. Nhãn đúng dạng MTM; DB kiểm lại lớp active.
- `support_report`: `{action, since:"2026-10-15T00:00:00+07:00"}` gọi `mtm_btvn_support_report`. Response RPC có dữ liệu riêng tư, không in response thô hay lưu vào receipt. Worker chỉ xuất số lần thất bại theo nhãn lớp đã kiểm, nhãn tự do thành `Lớp chưa xác định`.

### Cấu hình VPS

1. Chép `worker.py`, `attendance.py` vào `<brain>/Javis/scripts/`; chép bundle và receipt SHA-256 vào `<brain>/Javis/btvn/`. Dùng cùng bundle đã kiểm; đọc lại hash trên VPS. Node 22 chạy bundle từ stdin, không cần repo, esbuild hoặc service role. Snapshot và payload chỉ ở RAM/pipe, không ghi file danh sách học sinh.
2. Chia sẻ quyền xem sổ `Điểm danh 2026-2027`, ID `1vgkRI7re62pROu3uWog6OXBp5bViBSqbjLdytBfqXT4`, cho đúng SA hiện có. Worker dùng Sheets API readonly, `www.googleapis.com` phải ở allowlist. Không thay tài khoản hoặc nới quyền Drive. Chỉ tải bảy tab Thứ 2 đến Thứ 7 và Chủ nhật, vùng A1:ZZ2000. Chạm trần dòng/cột, tab thiếu/trống hoặc sai kiểu đều chặn đồng bộ.
3. Đặt `BTVN_ATTENDANCE_MAP` trỏ file map riêng tư tuyệt đối trên VPS, hoặc thêm `attendance_map` vào config worker. Có thể đặt `BTVN_ATTENDANCE_BUNDLE` nếu bundle ở nơi khác. Không đưa map có SĐT hay snapshot thật vào Git/log. Mẫu cấu trúc không phải xác nhận toàn bộ lớp hiện hành:

```json
{
  "schoolYear": 2026,
  "fromDate": "2026-10-15",
  "classes": {
    "2k9 9+": "2K9 9+",
    "hsa thứ 5": "2K9 HSA (THỨ 5)",
    "hsa chủ nhật": "2K9 HSA (CN)"
  }
}
```

Map phải phủ các khối thực tế. Parser dùng ngày trường, múi giờ +07:00, tính cả buổi tương lai (ô trống dùng cho hạn dự kiến), từ 15/10/2026 nếu không khai `fromDate`. Operator đặt `toDate` theo phạm vi sổ đã đối soát để tránh payload cả năm vượt giới hạn. Có `pending` thì giữ cả hai bước sync, báo tổng quát. HSA thứ Năm/Chủ nhật dùng hai nhãn riêng. Có thể thêm `knownPhonesByCohort` dạng `{ "2K9": ["SO_GIA_HOAC_DU_LIEU_DA_DUYET"] }` vào map riêng tư: module bỏ khối khi có ít nhất ba dòng đã biết và dưới 50% đúng khóa. Không có tham số này thì bỏ kiểm lẫn khóa theo phiếu, không tự đọc DB.

4. Claude kiểm trên VPS: Edge dry-run với dữ liệu giả được cấp phép, xác nhận `applied:false`; kiểm SA đọc đủ tab, map không có pending, rồi một lượt worker theo lịch/quyền hiện hành và readback tổng rows/sessions/applied, receipt không có tên/SĐT. Worker tự chạy roster dry-run và yêu cầu `invalid:0` trước apply để tránh thay toàn sổ bằng nhãn không active. `sync_attendance` thay toàn roster nên không được áp dụng dữ liệu giả trên DB thật. Không in báo cáo thô. Test `sync_due` apply phải dùng đúng sổ đã đối soát, không dùng fixture giả trên DB thật.
5. Báo cáo một giờ gần nhất: chỉ khi có `dang_nhap_that_bai` mới in một dòng lớp/số lần để Javis tiếp nhận báo Telegram. Code này không tự gửi Telegram trực tiếp cho báo cáo hỗ trợ; cần nghiệm thu đường đọc stdout/log của Javis đang chạy. Lỗi tải sổ chỉ in một dòng mỗi ngày VN, lưu mã/ngày trong state. Báo cáo vẫn được thử khi tải sổ lỗi. Lỗi đồng bộ không chặn xử lý bài độc lập; receipt ghi trạng thái từng bước. Cửa sổ báo cáo có thể trùng nếu chạy lại trong giờ, hoặc thiếu nếu lịch bỏ lượt, không tuyên bố exactly-once.

Kiểm offline sau đóng gói: `node scripts/run-tests.mjs`, `python -m unittest discover -s tools/btvn-javis/tests -v`, `npm run build`. Test Python đợt 21 gọi bundle thật bằng sổ giả nên cần tạo bundle trước. Không chạy `--live` trong phiên Codex này.

## Đợt 22: plugin báo điểm/điểm danh khi cần (15/10/2026)

Theo chốt 18:20 của Thành, không xuất điểm mỗi giờ. Plugin chỉ đọc theo lời gọi, không gắn vào launcher/cron và không thay lịch worker đang chạy. Mã nguồn ở `plugin-btvn-bao-diem/`, mặc định `enabled: false`, `min_mode: readonly`, không hook. Cấu trúc register/schema đối chiếu trực tiếp với `D:/Javis os/system/plugins/datetime-vn` và `server/plugins_host.py`; đường dẫn skill `D:/Javis os/skills/javis-builder` không tồn tại ở PC này.

### Đóng gói trên PC

```sh
node scripts/build-btvn-publish.mjs
node tools/btvn-javis/bundle-attendance.mjs .qa-temp/dot-21/attendance.bundle.mjs
node tools/btvn-javis/bundle-report.mjs .qa-temp/dot-22/report.bundle.mjs
node scripts/run-tests.mjs
python -m unittest discover -s tools/btvn-javis/tests -v
npm run build -- --outDir .qa-build/dot-22
node scripts/check-bundle-budget.mjs .qa-build/dot-22
```

Report bundle dùng chính `buildClassReport` và `bestReceipt` từ `server/btvn/scorebook.ts`, lịch lớp hiện hành từ JSON web. VPS cần Node 22. Python dùng các dependency hiện hành của worker; riêng đọc sổ cần google-auth và requests. Không cần OpenAI/Anthropic để chạy plugin báo cáo.

### Edge, bước do Claude triển khai sau nghiệm thu

```sh
supabase functions deploy mtm-btvn-publish --project-ref <PROJECT_REF_DA_DOI_CHIEU> --no-verify-jwt
```

Lệnh chỉ là hướng dẫn, chưa chạy trong đợt Codex. Giữ cùng secret và quyền hiện hành. Kiểm DB đã có RPC migration 019 và `mtm_btvn_classes`; không tự chạy lại migrations đã áp. Edge whitelist hai action đọc, dùng cùng `X-MTM-Publish-Secret`:

- `{ "action": "scorebook", "from": "2026-10-01" }`: gọi `mtm_btvn_scorebook(p_from, false)`, trả array rows. `from` bỏ trống mặc định 01/10, phải là ngày lịch hợp lệ từ 01/10/2026; cấm `apply`, `p_apply`, tên RPC tùy ý và mọi trường dư. Port cố định `false` trong câu SQL. Đầu ra chỉ giữ trường ScoreRow và ba trường receipt, không giữ phone/parentPhone hay trường bổ sung từ DB.
- `{ "action": "classes" }`: gọi chính `mtm_btvn_classes()` như web, qua cùng `publicClassNames`, trả `{classNames:[...]}`. Action này cần để kiểm nhãn đúng cả khi lớp chưa có điểm. Không dùng lớp từ config mẫu, lịch tĩnh hoặc suy từ các dòng điểm làm danh sách lớp hợp lệ.

Hai RPC chỉ đọc dùng `SET LOCAL ROLE service_role` trong transaction riêng như các action điểm danh; pipeline cũ vẫn dùng role riêng. Response không cache. Không in rows thật ra log/receipt.

### Cài vào VPS, chưa bật ở bản bàn giao

1. Chọn đúng brain của bot Zalo hiện hành. Chép `plugin.yaml`, `plugin.py`, `HUONG-DAN-BOT.md` vào `<brain>/plugins/btvn-bao-diem/` (hoặc `<brain>/Javis/plugins/` nếu host đang dùng đường cũ). Không sửa `system/plugins` của Javis. Giữ plugin tắt cho đến khi Claude nghiệm thu, bật trong giao diện quản lý plugin của đúng brain. Không tự mở quyền chạy user plugin toàn hệ thống.
2. Dùng helper worker hiện hành `runtime.py`, `attendance.py` đã cập nhật trong đợt này. Nếu helper ở `<brain>/Javis/scripts/` như hướng dẫn đợt 21, đặt `BTVN_JAVIS_DIR` đúng thư mục đó; nếu không khai báo thì mặc định `<brain>/Javis/btvn/`. Giữ `btvn-pipeline` ở vị trí tương đối worker hiện hành hoặc đặt `BTVN_PIPELINE_DIR` rõ ràng. Helper được import bằng namespace riêng để tránh trùng module `runtime` của server. Không sửa repo Javis để cài plugin.
3. Chép `attendance.bundle.mjs`, `report.bundle.mjs` và receipts vào `<brain>/Javis/btvn/`, đối chiếu SHA-256 sau chép. `BTVN_REPORT_BUNDLE`, `BTVN_ATTENDANCE_BUNDLE` có thể chỉ đường tuyệt đối nếu đặt nơi khác. Không cần chép repo/esbuild sang VPS.
4. Plugin mặc định dùng `ctx.vault_root` làm brain, ưu tiên `JAVIS_BRAIN_ROOT` khi đã cấu hình. Dùng config worker hiện hành ở `<brain>/Javis/btvn/config.json` hoặc `BTVN_CONFIG`. `attendance_map` (hoặc `BTVN_ATTENDANCE_MAP`) phải trỏ map đã đối soát; đường tương đối tính từ thư mục config. Không đưa map có SĐT lên repo.
5. Secret chỉ đọc từ `/data/state/btvn/publish.env` (hoặc `JAVIS_STATE_DIR/btvn/publish.env`) rồi `<brain>/Javis/btvn/.publish.env`, theo worker; tệp ưu tiên có mà sai thì dừng. URL phải HTTPS và đúng đường `/functions/v1/mtm-btvn-publish`. Không in secret hoặc đặt lại secret toàn tiến trình. SA theo `MTM_GOOGLE_SA_PATH` hoặc connector-files như worker, scope chỉ `spreadsheets.readonly`. Giữ `BTVN_ALLOW_NETWORK=1` theo cổng mạng worker khi triển khai đã được duyệt; không bật trong kiểm offline.
6. Kiểm plugin xuất hiện đúng tool `btvn_bao_diem_lop`, thử với fixture đã duyệt trước. Sau khi có quyền kiểm dữ liệu thật, kiểm đúng lớp, giờ kết thúc, trạng thái điểm danh và không có SĐT. Không ghi dữ liệu thật vào log. Chỉ sau readback Claude mới bật cho bot dùng. Không dùng kiểm offline để khẳng định đã chạy VPS/SA/Edge thật.

Tool tải mới sổ đúng lúc gọi, giữ snapshot trong RAM/pipe. Chỉ chuyển họ tên/trạng thái lớp được hỏi vào report bundle. Không lưu file điểm/điểm danh, không gọi sync/apply, không gửi Zalo. Điểm danh không rõ hoặc khối lẫn khóa trả lỗi một câu; ô trống không tự suy là vắng. Dùng `HUONG-DAN-BOT.md` để bot lấy phần (a)+(c), giữ phần (b) đối soát nội bộ và tránh trộn lớp. Lỗi mạng/quyền/cấu hình chỉ trả một câu tiếng Việt, không tiết lộ exception gốc.
## Đợt 25: tên buổi học khi Sheet chưa ghi chủ đề

`VersionWorker` dùng bộ đặt tên chung trong `tools/btvn-pipeline/pipeline.py`, giữ khóa phiên bản đã đăng khi chỉ đổi tên/video/handout. Sheet có tên chủ đề thì giữ nguyên, không gọi AI đặt tên. Tên trống/chung chung dùng chữ PDF BTVN HS, PDF tài liệu/handout và tiêu đề video, trả tên tiếng Việt 3-10 chữ cùng confidence/nguồn. AI lỗi hoặc thiếu căn cứ thì dùng tên đề, sau đó ngày học. Không dùng đáp án để đặt tên.

`material.titleSource` là `sheet` hoặc `auto`; thẻ web không thêm nhãn tự đặt. Quyết định auto được cache theo nội dung nguồn trong SQLite, PDF đổi tại cùng URL và video/handout đến sau được xét lại. Cập nhật metadata qua `update_material`, không thay đề hay assets và không đăng lại bài. GoogleTransport hiện có cấp SA cho GET tên file Drive; YouTube oEmbed chỉ cần host `www.youtube.com` trong allowlist, không nhận bearer. Chi tiết giới hạn, fallback, cache và kiểm thử: `../btvn-pipeline/README.md`, mục đợt 25.

Trước triển khai VPS, operator cần áp dụng migration chờ `202610150023_btvn_auto_title.sql`, cập nhật Edge handler, mã pipeline/worker và thêm `www.youtube.com` vào cấu hình thật đang dùng, giữ nguyên các host đã duyệt. Phiên Codex đợt 25 chỉ sửa/kiểm cục bộ, chưa chạy API, chưa áp dụng SQL, chưa ghi mạng. Biên bản: `.qa-temp/dot-25/BIEN-BAN-DOT-25.md`. Không build vào `build/` cho đợt này.
# Phạm vi BTVN từ Sheet (đợt 26)
Thêm cột `Phạm vi BTVN`; worker dùng chung bộ chọn của `tools/btvn-pipeline`, không cần đổi giao diện web.
Ví dụ: `Câu 15-35`, `câu 15 đến 35`, `Từ câu 15`, `15-35`, `Câu 1-10, 21-30`.
Cũng nhận `Ghi chú BTVN`, `BTVN từ câu`, `Phạm vi`; chọn mục bằng `Phần III`, `Bài tập về nhà`, hoặc `Trang 5-7`.
Ô trống: AI xác nhận vùng từ chữ/vị trí PDF, confidence dưới 0.8 hoặc không có mục ghi `whole_file`; chú thích sai thì giữ bài.
Receipt lưu `scope_source`; material lưu `homeworkScope`/`homeworkScopeSource`; lệch câu GV hoặc đổi phạm vi bài đã đăng thì giữ bài, không đăng lại.
