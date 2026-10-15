# BTVN tự đăng trên Javis VPS, đợt 17

## Bổ sung đợt 18

Worker nhận cả buổi tương lai đã có lịch xác nhận. Record được ghi sẵn cho buổi tương lai vẫn nhận; quyền làm bài do máy chủ khóa theo `classOpensAt`. Mỗi lớp lấy ngày riêng trong `class_dates`, giờ kết thúc buổi từ `server/btvn/class-schedule.json`, ISO có múi giờ `+07:00`. Không có buổi khớp thì dùng 21:30 ngày học.

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
- **Đồng bộ hạn từ sổ điểm danh chưa nối trên VPS**. Receipt ghi chờ Claude; không dùng service_role để lách. Bài đạt vẫn theo quy tắc hạn đang chờ của web; Claude phải nối bước được cấp quyền và nghiệm thu riêng.

## Kiểm offline trên PC

```powershell
# Dùng Python runtime đã có pypdfium2/Pillow/pypdf/openpyxl, không tải gói từ mạng.
python -m unittest discover -s tools/btvn-javis/tests -v
python -m unittest discover -s tools/btvn-pipeline/tests -v
python tools/btvn-javis/btvn-tu-dang.py --dry-run
```

Trong phiên này `python` không nằm PATH, lệnh thực tế dùng `C:/Users/Admin/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe`; tệp tạm/checkpoint đều trên T. Dry-run dùng transport/AI/publisher giả và fixture PDF cục bộ có sẵn, chặn urllib/socket, gọi validator PracticeExam thật. Chưa chứng minh chạy Linux, khóa FD kế thừa thật, API/hạn mức, SA/Drive, Telegram, cron hoặc đã đăng.
