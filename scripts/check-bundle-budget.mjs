// KT-05: ngân sách gói sau khi build. Chặn gói phình bất thường; không thay cấu hình build.
// Dùng: node scripts/check-bundle-budget.mjs [thư-mục-build]   (mặc định: build)
// Mốc đo trước Đợt 1 (origin/main 2e88f47, vite 6.4.4): JS vào trang 402.098 B, CSS vào trang 111.208 B,
// PracticeLibrary 3.256.490 B (chứa ngân hàng đề), chunk khác lớn nhất MathText 534.652 B, tổng JS 6.277.455 B.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {gzipSync} from 'node:zlib';

const BUDGET = {
  entryJs: 430_000,          // JS tải ngay khi mở trang (index-*.js)
  entryJsGzip: 135_000,
  entryCss: 125_000,
  practiceLibrary: 4_500_000, // ngân hàng đề còn nhập thêm; Đợt 3 (KT-06) sẽ tách nạp sau
  otherChunk: 600_000,       // mọi chunk JS khác
  totalJs: 7_500_000,
};
const dir = resolve(process.argv[2] ?? 'build');
const assets = join(dir, 'assets');
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const files = readdirSync(assets).filter(f => /\.(js|css)$/.test(f)).map(f => ({f, bytes: statSync(join(assets, f)).size}));
const entry = (ext) => [...html.matchAll(new RegExp(`assets/([^"']+\\.${ext})`, 'g'))].map(m => m[1]);
const size = (f) => files.find(x => x.f === f)?.bytes ?? 0;
const kb = (n) => (n / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 1}) + ' kB';
const problems = [], rows = [];
const check = (label, value, limit) => { rows.push(`${value <= limit ? 'ok  ' : 'VƯỢT'} ${label}: ${kb(value)} / ngân sách ${kb(limit)}`); if (value > limit) problems.push(label); };

const entryJs = entry('js'), entryCss = entry('css');
if (!entryJs.length) problems.push('không tìm thấy JS vào trang trong index.html');
check('JS vào trang ' + entryJs.join(', '), entryJs.reduce((s, f) => s + size(f), 0), BUDGET.entryJs);
check('JS vào trang (gzip)', entryJs.reduce((s, f) => s + gzipSync(readFileSync(join(assets, f))).length, 0), BUDGET.entryJsGzip);
check('CSS vào trang ' + entryCss.join(', '), entryCss.reduce((s, f) => s + size(f), 0), BUDGET.entryCss);
const js = files.filter(x => x.f.endsWith('.js'));
const lib = js.filter(x => x.f.startsWith('PracticeLibrary-'));
check('PracticeLibrary (ngân hàng đề)', lib.reduce((s, x) => s + x.bytes, 0), BUDGET.practiceLibrary);
const others = js.filter(x => !entryJs.includes(x.f) && !x.f.startsWith('PracticeLibrary-')).sort((a, b) => b.bytes - a.bytes);
if (others[0]) check('chunk khác lớn nhất ' + others[0].f, others[0].bytes, BUDGET.otherChunk);
check('tổng JS (' + js.length + ' tệp)', js.reduce((s, x) => s + x.bytes, 0), BUDGET.totalJs);

console.log(rows.join('\n'));
console.log(problems.length ? `Ngân sách gói: VƯỢT ở ${problems.length} mục.` : 'Ngân sách gói: đạt.');
process.exit(problems.length ? 1 : 0);
