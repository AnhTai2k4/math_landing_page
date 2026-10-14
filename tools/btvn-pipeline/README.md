# Bộ dựng BTVN đợt 9 (bản local, chưa triển khai)

## Đường XLSX qua Drive (đợt 9)

`config.xlsx.example.json` là mẫu **giả**. Cài `openpyxl` theo requirements vào venv VPS; không cài thêm trong runtime hệ thống. `format:"xlsx"` gọi `GET https://www.googleapis.com/drive/v3/files/{id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` bằng token chỉ đọc học liệu. Giới hạn export 10 MB; không ghi XLSX xuống đĩa. Mỗi workbook tải một lần/lượt, giữ hyperlink (kể cả tên chip có hyperlink trong bản export), text và ngày; chỉ chiếu tab/range hữu hạn đã cấu hình trong A:K, tối đa 100000 ô. Công thức bị chặn; chip không có hyperlink giữ lỗi, không đoán URL.

**Export là toàn workbook, không lọc tab/range ở API.** Operator chỉ đặt `material_only_workbook:true` sau khi xác nhận toàn workbook không có dữ liệu học sinh. Nếu workbook lẫn roster/bảng điểm/link nộp thì không dùng XLSX; giữ `grid` theo vùng học liệu được phép hoặc nguồn học liệu riêng. Không tự sao chép/chia sẻ nguồn thật. Mẫu chưa xác minh Sheet/Drive thật; test tạo XLSX giả bằng openpyxl.

## Nạp một buổi thủ công (đợt 9)

Từ root repo: `node scripts/publish-btvn-lesson.mjs <LESSON_BTVN.json>` mặc định dry-run: chạy handler/validator production và kiểm proof/từng slot/hash/chữ ký tệp, không env bí mật, không request mạng/upload/RPC thật. JSON cùng contract `publish` bên dưới, bắt buộc `action:"publish"`; `assets[].data_base64` chứa ảnh/PDF, không chỉ đường dẫn PC. Không giả bằng chứng phản biện để vượt bộ kiểm.

Chỉ operator chạy `--live` sau khi đối soát 006/007, đồng bộ và cấu hình scope/role riêng, deploy Edge đã nghiệm thu. Đợt10 không cần JWT ký tay: DB Edge dùng transaction `SET LOCAL ROLE mtm_btvn_publisher`, service_role built-in Edge chỉ dùng Storage; xem `supabase/functions/mtm-btvn-publish/README.md`. Env VPS: `BTVN_PUBLISH_URL=https://<project-ref>.supabase.co/functions/v1/mtm-btvn-publish` và `BTVN_PUBLISH_SECRET` (32–1024 ký tự). Script không lấy service_role, không đọc roster, không ghi bảng trực tiếp; chỉ gọi Edge, không theo redirect. Chỉ nhận `da_dang`/`already_published` là xác nhận thành công; lỗi giữ chưa xác nhận, không tự thử lại. Buổi đã đăng không sửa. Chưa đủ migration/scope/Edge thì dừng ở dry-run, không dùng credential toàn quyền làm đường dự phòng.

API web cần `MTM_BTVN_ENABLED=1`, `VERCEL=1`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MTM_HOMEWORK_PUBLISHABLE_KEY`, `MTM_BTVN_NETWORK_SECRET` tối thiểu 32 ký tự; thiếu cấu hình trả 503. Danh sách lớp qua `mtm_btvn_classes`. Preview chỉ nhận Origin/Host khớp chính `VERCEL_URL` khi `VERCEL_ENV=preview`; không cho mọi `*.vercel.app`. Khóa server không đặt tên `VITE_*`. Lệnh deploy/nghiệm thu chỉ nằm trong biên bản để Claude/operator thực hiện, chưa chạy ở đợt local này.

Python 3.12+, Pillow, pypdf, Poppler (`pdftotext`, `pdftoppm`), Node 20+ và dependencies repo (`esbuild`). Chạy Linux; mặc định **offline**, cần cả `--live` và `BTVN_ALLOW_NETWORK=1` mới cho mạng. Đợt này chỉ chạy dữ liệu giả; không gọi Sheet/Supabase/AI/Telegram thật, không bật timer.

Luồng: đọc đúng 2 Sheet học liệu, CSV hoặc grid API theo vùng/tab đã cấu hình → khóa buổi ổn định từ chương trình/lớp/ngày → lookup máy chủ → tải 2 PDF riêng → text và ảnh Poppler → AI A trích cấu trúc/crop/thang điểm nguồn → crop nguyên điểm ảnh → AI B giải độc lập chỉ từ HS (không có đáp án/lời giải) và kiểm crop thực tế → giữ receipt giải độc lập → đối chiếu riêng mọi short/self với lời giải GV gốc, giữ receipt kiểm chuyển → so từng slot kể cả 4 mệnh đề TF → chạy **validator PracticeExam production** qua Node/esbuild → gửi publish riêng → chỉ ghi receipt `da_dang` khi máy chủ xác nhận. Không dùng service_role. Buổi đã đăng bất biến, đổi title/Sheet/URL không tạo khóa mới để ghi đè. Cùng lớp/ngày trên 2 Sheet và cùng URL đề/đáp án được gộp; nguồn xung đột chặn trước publish. `program_key` optional trên cấu hình Sheet phải giống nhau cho cùng chương trình. SQLite receipt + `flock` ngăn chạy trùng cục bộ; server vẫn phải giữ atomic uniqueness giữa VPS.

PDF scan/không có nhãn Câu, crop mơ hồ, thiếu khóa/câu hoặc trọng số chưa rõ, AI chưa chắc, bất đồng 1 slot, validator hỏng đều fail closed. Không sáng tác câu/lời giải. BTVN dùng trọng số nguồn; phiếu không ghi điểm có thể dùng chính sách bằng nhau cho câu tính điểm, phải ghi rõ trong đầu ra AI và được reviewer đối chiếu. Không áp chính sách BTVN cho đề luyện tập/thi thử. `loi` giữ ngoài luồng học sinh, gửi webhook tối thiểu nếu cấu hình. PDF không đồng nghĩa hoàn tất kiểm Toán. Review AI chỉ là bằng chứng theo receipt; không đảm bảo mọi dạng PDF đều được tự động nhận.

Reuse từ `claude-pkgs-tools/extract_pair.py`: cặp HS/GV, marker câu, render và crop nguyên điểm ảnh, SHA-256/sourcePage; đường Windows được thay bằng Poppler PATH Linux. Không mang masking/tô lại watermark hay override không có bằng chứng sang worker. API adapters là OpenAI-compatible vision, provider/model do Thành/operator chọn; không nhận tên chọn model là đầu ra đã kiểm. Nhà cung cấp primary/reviewer phải khác nhau.

## Test offline

`python -m unittest discover -s tools/btvn-pipeline/tests -v`

Cài `requirements-test.txt` nếu môi trường test chưa có pypdf/Pillow. Không cài vào runtime hệ thống hay chạy mạng trong đợt local này.

Poppler smoke test dùng PDF đề có sẵn trong `public/exam-assets`, đọc bằng thư viện PDF, render 1 trang và crop đối chiếu pixel; không có dữ liệu học sinh. Có thể đặt `BTVN_PDFTOTEXT`, `BTVN_PDFTOPPM`, `BTVN_NODE` thành đường công cụ trên Windows. Fixture Worker thay transport/AI/publisher; validator vẫn chạy thật, crop ảnh thật. Không biến mock review thành xác minh nguồn thật.

## Cài VPS — từng bước, chưa thực hiện

1. Operator cài Python 3.12+, `poppler-utils`, Node 20+, tạo user hệ thống `btvn-worker` không có quyền PC hay bảng học sinh.
2. Operator đưa bản repo đã duyệt lên `/opt/mtm-web`, cài dependencies Node từ lockfile bằng `npm ci`.
3. Operator tạo `/opt/mtm-btvn-venv`, cài `requirements.txt`, chạy test offline trước.
4. Operator tạo `/var/lib/mtm-btvn` thuộc user worker mode 0700, `/etc/mtm-btvn/worker.env` mode 0600 (root đọc; systemd cấp env).
5. **Thành nhập bí mật** vào env: `BTVN_EXTRACTOR_API_KEY`, `BTVN_REVIEWER_API_KEY`, `BTVN_PUBLISH_SECRET`; optional `BTVN_SHEET_READ_TOKEN`, `BTVN_NOTIFY_URL`, `BTVN_NOTIFY_SECRET`. Worker không đọc token Javis/credential học sinh và không dùng service_role.
6. Operator sao chép `config.example.json` thành config riêng: đúng 2 nguồn CSV học liệu; chỉ vùng/cột học liệu, không roster, link nộp hay bảng điểm. Đặt URL download PDF trực tiếp và hostname allowlist. CSV OAuth token chỉ cấp đọc học liệu. Share-link HTML/redirect không được đoán thành PDF; operator cấu hình endpoint PDF trực tiếp đã cấp quyền. Không lưu secrets trong config/git.
7. Operator deploy đường publish riêng và mapping tên lớp → UUID lớp được phép (server); private bucket storage, policy chặn public; pipeline không đọc roster để dò UUID.
8. Operator kiểm provider/model vision và quyền/chi phí có thật bằng lượt nghiệm thu đã cho phép; nếu API không tương thích JSON/vision thì chưa triển khai adapter này.
9. Operator chạy 1 buổi mẫu không có học sinh thật trên staging, kiểm đủ trang/crop/khóa/thang điểm/đọc web, chạy lại chứng minh không trùng/ghi đè.
10. **Thành/operator quyết định bật** `BTVN_ALLOW_NETWORK=1` và chạy lệnh worker trên VPS khi nghiệm thu đạt; đây chưa được bật tại PC.
11. Sau khi được phép bật lịch, operator mới copy service/timer `.example`, sửa giờ sau ca học, thêm `[Install] WantedBy=timers.target`, rồi enable timer. Không tự tạo scheduler khác; mẫu hiện không có Install target.

## Contract publish

Header `X-MTM-Publish-Secret` riêng. POST JSON `action:lookup` + `lesson_key` → `status:null|cho_duyet|loi|da_dang`; `publish` → `da_dang|already_published`; `error` → `loi|already_published`. lesson_key `[a-z0-9-]{1,160}`, luôn bằng `material.lessonCode`. Material đúng web `LessonMaterial`: lessonCode,classNames,date,title,videoId,materialUrl,handoutUrl,homeworkUrl. Assets chứa path/sha256/content_type/data_base64, PDF `exam-assets/<hash>.pdf`, PNG `btvn/<source_version>/qN-K.png` và `sN-K.png`. Máy chủ kiểm manifest/hash, ghi private storage và hydration signed URL; không ghi secret vào exam.

Proof `verification`: validator/independent true, receipt_hash, provider/model của reviewer, extractor_provider, slots. MC slot answer expected/actual A–D; TF slots a/b/c/d expected/actual boolean; short slot answer expected acceptedAnswers[] và actual chuỗi độc lập. So short bằng numeric/rational canonical tương đương validator, tuyệt đối không đổi actual thành bản sao khóa. Receipt đầy đủ (reasoning của từng câu + source_version + provider/model) nằm trong SQLite private; hash chỉ định danh receipt, không thay proof. Error có error_code/ reason nội bộ giới hạn; không gửi raw lỗi HTTP hay URL có query secret.

Giới hạn: API có giới hạn ảnh/token riêng; quá giới hạn phải giữ lỗi. DNS/URL allowlist HTTPS chặn mạng nội bộ và redirect; deployment nên thêm egress firewall. Chưa bật OCR cho scan vì chưa có QA riêng. Trọng số mơ hồ hoặc không phù hợp chính sách BTVN cần kiểm thủ công. ClassNames theo đúng lớp trong Sheet; không tự suy lịch hoặc cặp buổi từ dữ liệu học sinh.

## Nhiều tab học liệu và PDF Drive

Mỗi phần tử `sheets[]` có thể giữ `url` CSV như cũ, hoặc thêm `tabs:[{name:"Lớp mẫu",url:"https://sheets.example.invalid/tab.csv",columns:{title:"Tên bài"}}]`. Khi có tabs, worker đọc đúng tất cả tab được khai báo, không đọc thêm URL parent; tab kế thừa id/program_key/bearer_env và ánh xạ 8 cột, được override tên cột, format, năm học, alias và range của đúng tab học liệu. Không tự tìm/enumerate tab, không dùng roster; tên tab trùng trong một Sheet bị chặn. Ví dụ tab chỉ chứa 8 cột học liệu được chiếu riêng. Khóa lớp/ngày nhất quán giữa các tab/Sheet; nguồn xung đột bị chặn.

PDF trực tiếp vẫn là mặc định. Nếu nguồn là `https://drive.google.com/file/d/<id>/view` hoặc `/open?id=<id>`/`/uc?id=<id>`, operator có thể đặt `source.pdf_download_url_template="https://www.googleapis.com/drive/v3/files/{id}?alt=media"` sau khi xác minh endpoint/quyền. Thêm `www.googleapis.com` vào allowed_hosts. Worker chỉ chuyển link file trên đúng host Drive, reject folder/id mơ hồ/thiếu template; không tự theo redirect hay tải HTML như PDF. URL nguồn trong material giữ nguyên link học liệu, endpoint tải không đưa vào bundle.

Nếu PDF riêng tư, **Thành nhập** token chỉ đọc vào `BTVN_PDF_READ_TOKEN`, đặt `source.pdf_bearer_env="BTVN_PDF_READ_TOKEN"`, `source.pdf_auth_hosts=["www.googleapis.com"]`. Token chỉ gắn trên hai request tải PDF tới host auth đã chốt, không gửi sang PDF host khác/AI/publish/notify. Không dùng token quyền rộng; không đọc credential có sẵn trên PC. Live bắt buộc `BTVN_NOTIFY_URL` HTTPS thuộc allowed_hosts để không bỏ lặng lỗi; `BTVN_NOTIFY_SECRET` riêng nếu webhook yêu cầu. Đợt này cả download mapping/auth/đa tab đều kiểm bằng adapter giả, chưa xác minh API Drive thật.


## Đợt 8: cấu trúc Sheet và câu tự luận (15/10/2026)

- Dùng `config.grid.example.json` cho grid API; mẫu CSV cũ giữ tương thích. `format:"grid"`, URL `spreadsheets.get?includeGridData=true&ranges=<một tab!A:K>&fields=<grid học liệu>`; không lấy cả workbook. Trong mẫu dùng host `.invalid`, không phải nguồn thật. Operator xác minh range từng tab để bỏ các cột link nộp/bảng điểm và mọi vùng học sinh. Token không nằm trong config. `tabs[]` được override `format`, `school_year`, `class_aliases`, `range`, `columns`; URL mỗi tab phải chiếu đúng tab đó.
- Chuẩn hóa tên tiêu đề (hoa/thường, dấu, khoảng trắng/ngoặc), không dùng số cột. `document` luôn trỏ cột HS; `answers` trỏ Đáp án BTVN hoặc GV đã đối soát. 2K11 đảo HS/GV không làm đổi ánh xạ. Tab không Record đặt `video:null`.
- Ô grid giữ `formattedValue` cùng `hyperlink`, `chipRuns[].chip.richLinkProperties.uri`, `textFormatRuns[].format.link.uri`; chip có tên nhưng thiếu URL giữ chờ, không dựng URL từ tên tệp. Web dùng `readMaterialGrid`/`decodeMaterialGrid`, không dùng values API cho học liệu.
- Ngày d/m thiếu năm chỉ suy khi có `school_year:{start_year,start_month}` (web `schoolYear:{startYear,startMonth}`). Mẫu tháng 7 chỉ là dữ liệu giả, không xác nhận niên khóa nguồn thật. Ngày rác dấu backslash bỏ qua; ngày không hợp lệ không đăng.
- Dòng phụ không có lớp/tên bài, có BTVN và ngày trống hoặc trùng buổi ngay trên: gộp vào `homework_urls`, giữ tên tệp/trang cắt ở `homework_labels`. Worker gộp PDF thật bằng pypdf theo thứ tự trước trích/crop; giới hạn 8 tệp, 40 trang, 15MB tổng. Không suy số trang trong tên tệp thành trang vật lý của PDF đã cắt.
- “Phần trắc nghiệm trong phiếu” dùng PDF HS buổi đó, giữ `homework_note` để cả extractor và reviewer chỉ kiểm phần được giao. Đáp án GV có thể là toàn phiếu; crop lời giải phải đúng câu đã chọn.
- YouTube watch/live/shorts/embed nhận ID trên đúng host. Zoom record dùng `videoUrl`, hiện liên kết ngoài, không iframe. Lớp tự do được dọn khoảng trắng và 2013→2K13; alias giáo viên như “Thầy Thành” phải có mapping `class_aliases` operator đã xác minh, không suy giáo viên thành lớp.
- Extractor đổi tự luận có đáp số gọn thành `short`, ghi `convertedFrom:"essay"`; tự luận chỉ có lời giải dài thành `self`, 0 điểm, không khóa chấm. Giữ TN/ĐS và đầy đủ lời giải/crop. Profile `MTM-BTVN-10-v1`: cộng điểm các câu tính điểm rồi quy 10; không đổi các profile cũ. Bài chỉ có self giữ chờ vì không có mẫu số để quy điểm, không tự ghi 0/10 hoặc 10/10.
- Reviewer giải từ HS trước thấy lời giải. Sau đó đối chiếu mọi short/self với GV gốc, trả `conversion_checks` và lý do cụ thể. Thiếu/false/bất đồng giữ lỗi. Slot proof có `conversion_verified:true`; handler kiểm lại cho BTVN short/self trước upload. Hai receipt giải độc lập/kiểm chuyển được lưu riêng; lượt này toàn bộ adapter AI/service là giả.
- Test đợt 8: `node scripts/run-tests.mjs tests/exams-btvn-round8.test.mts`; Python discover gồm test grid, lớp/ngày, gộp PDF thật giả, proof chuyển và hai receipt. `node scripts/check-btvn-round8-ui.mjs` render component phòng làm bài thật bằng dữ liệu giả; chỉ SSR, không phải browser.
