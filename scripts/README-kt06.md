# KT06 bước 2 — tái sinh ngân hàng Luyện tập

Nguồn nhập đề vẫn là `src/native/chapters/practice-tests.json`, `exact-tests.json`, `archived-tests.json`; lộ trình vẫn là `chapter-sequence.json`.

- `npm.cmd run build -- --outDir .qa-build/kt06/build`: cấu hình Vite tự sinh ngân hàng trước build.
- `npm.cmd run dev`: sinh trước khi khởi động Vite.
- `npm.cmd test`: sinh trước khi đóng gói test.
- `node scripts/generate-practice-bank.mjs`: sinh lại riêng sau khi công cụ nhập đề thay JSON nguồn. Với dev đang mở, chạy lệnh này hoặc khởi động lại dev để nhận dữ liệu mới.
- `npm.cmd run check:bundle -- .qa-build/kt06/build`: đo ngân sách từ manifest build.

`src/native/chapters/generated-bank/` là dữ liệu sinh lại, được gitignore; không sửa tay hoặc commit. Một tệp JSON cho mỗi đề; index chỉ chứa ID, nhóm, chương, cờ lưu trữ và các hàm import động. Chương tải các ID thuộc chương; URL `?id=` chỉ tải đề được chọn. URL `?luot=` tra kho lịch sử v1 hoặc các khóa nháp MTM đã biết, rồi tải một đề; `readHistory`/`validateDraft` vẫn kiểm bản lưu, dùng snapshot đáp án cũ khi xem lịch sử.

`practice-bank.ts` giữ nguyên để các phép đối chiếu cũ và công cụ nội bộ còn dùng; giao diện không nhập module nguyên khối này.

Bẫy cần giữ: ngân sách một chương phải cộng **tất cả** chunk đề thuộc chương đó, kể cả đề lưu trữ và import tĩnh, thay vì chỉ lấy tệp lớn nhất. Hiện chương 12:1 có 63 tệp đề, tổng 1.453.784 byte. Ngân sách `chapterBank` = 1.500.000 byte; `practiceLibrary` = 1.700.000 byte cho khung/bộ nạp cộng chương lớn nhất. Tổng JS toàn site vẫn giới hạn 12.000.000 byte.

Không thay URL, nội dung đề, ID, versionHash, schema storage, CSS, JSX thẻ bài, số Bài hay lộ trình. Test `exams-kt06-shards.test.mts` dùng `git show 0ed6dd3` làm đối chiếu V78 cho mọi chương.
