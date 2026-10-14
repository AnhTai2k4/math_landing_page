// KT-05: ngân sách gói sau khi build. Chặn gói phình bất thường; không thay cấu hình build.
// Dùng: node scripts/check-bundle-budget.mjs [thư-mục-build]   (mặc định: build)
// Mốc đo trước Đợt 1 (origin/main 2e88f47, vite 6.4.4): JS vào trang 402.098 B, CSS vào trang 111.208 B,
// PracticeLibrary 3.256.490 B (chứa ngân hàng đề), chunk khác lớn nhất MathText 534.652 B, tổng JS 6.277.455 B.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const BUDGET = {
  entryJs: 430_000,          // JS tải ngay khi mở trang (index.html + import tĩnh)
  entryJsGzip: 135_000,
  entryCss: 125_000,
  practiceLibrary: 1_700_000, // khung, bộ nạp và dữ liệu chương lớn nhất; đo KT06: 1.666,9 kB
  chapterBank: 1_500_000,     // cộng mọi chunk đề của một chương, không chỉ một tệp
  practiceShell: 100_000,     // KT-06: khung trang /luyen-tap (gồm mã ChapterPractice, khoảng 78 kB) không được kéo ngân hàng đề vào lại
  otherChunk: 600_000,       // mọi chunk JS khác
  totalJs: 13_000_000,        // tổng mọi chunk JS trên site (không phải lượng tải mỗi lần mở trang: từ V79 mỗi chương chỉ nạp phần của mình). Nâng 12.000 lên 13.000 kB ở V80 (+24 đề lớp 11)
};
const dir = resolve(process.argv[2] ?? 'build');
const assets = join(dir, 'assets');
const html = readFileSync(join(dir, 'index.html'), 'utf8');
const files = readdirSync(assets).filter(f => /\.(js|css)$/.test(f)).map(f => ({f, bytes: statSync(join(assets, f)).size}));
const fromHtml = (ext) => [...new Set([...html.matchAll(new RegExp(`assets/([^"']+\\.${ext})`, 'g'))].map(m => m[1]))];
const missing = new Set();
const size = (f) => { const hit = files.find(x => x.f === f); if (!hit) missing.add(f); return hit?.bytes ?? 0; };
const kb = (n) => (n / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 1}) + ' kB';
const problems = [], rows = [];
const check = (label, value, limit) => { rows.push(`${value <= limit ? 'ok  ' : 'VƯỢT'} ${label}: ${kb(value)} / ngân sách ${kb(limit)}`); if (value > limit) problems.push(label); };

/** JS tải ngay = tệp trong index.html (script, modulepreload) + mọi tệp nhập TĨNH từ đó (đệ quy, mỗi tệp
 * tính một lần). import("./x.js") động không tính. Tệp được tham chiếu mà không có trên đĩa thì báo lỗi. */
function initialJs(start) {
  const seen = new Set(), queue = [...start];
  while (queue.length) {
    const f = queue.shift();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!existsSync(join(assets, f))) { missing.add(f); continue; }
    const code = readFileSync(join(assets, f), 'utf8');
    for (const m of code.matchAll(/(?:^|[;}\n])\s*(?:import|export)\s*(?:[\w$*{},\s]+?\s*from\s*)?["']\.\/([^"']+\.js)["']/g)) queue.push(m[1]);
  }
  return [...seen].filter(f => !missing.has(f));
}

const entryJs = initialJs(fromHtml('js')), entryCss = fromHtml('css');
if (!entryJs.length) problems.push('không tìm thấy JS vào trang trong index.html');
if (!entryCss.length) problems.push('không tìm thấy CSS vào trang trong index.html');
check('JS vào trang ' + entryJs.join(', '), entryJs.reduce((s, f) => s + size(f), 0), BUDGET.entryJs);
check('JS vào trang (gzip)', entryJs.reduce((s, f) => s + gzipSync(readFileSync(join(assets, f))).length, 0), BUDGET.entryJsGzip);
check('CSS vào trang ' + entryCss.join(', '), entryCss.reduce((s, f) => s + size(f), 0), BUDGET.entryCss);
const js = files.filter(x => x.f.endsWith('.js'));
// KT06 bước 2: cộng toàn bộ chunk đề của chương; manifest phải chứa đủ tệp đã sinh.
const root=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(readFileSync(join(dir,'.vite/manifest.json'),'utf8'));
for(const f of readdirSync(join(root,'src/native/chapters/generated-bank')).filter(f=>/^exam-\d+\.json$/.test(f))) {
  if(!manifest['src/native/chapters/generated-bank/'+f])problems.push('thiếu đề trong manifest '+f);
}
const chapterFiles=new Map(), bankFiles=new Set();
for(const [source,chunk] of Object.entries(manifest)) {
  if(!source.includes('/generated-bank/exam-'))continue;
  const item=JSON.parse(readFileSync(join(root,source),'utf8'));
  const key=item.track+':'+item.chapter;
  if(!chapterFiles.has(key))chapterFiles.set(key,new Set());
  for(const f of initialJs([chunk.file.replace(/^assets\//,'')])){chapterFiles.get(key).add(f);bankFiles.add(f);}
}
if(!chapterFiles.size)problems.push('không tìm thấy ngân hàng chương tách trong manifest');
const chapterSizes=[...chapterFiles].map(([key,fs])=>({key,bytes:[...fs].reduce((n,f)=>n+size(f),0)})).sort((a,b)=>b.bytes-a.bytes);
const largest=chapterSizes[0]??{key:'thiếu',bytes:0};
check('ngân hàng 1 chương lớn nhất '+largest.key,largest.bytes,BUDGET.chapterBank);
const isBank=f=>f.startsWith('PracticeLibrary-')||f.startsWith('PracticeShelf-')||bankFiles.has(f);
const lib=js.filter(x=>x.f.startsWith('PracticeLibrary-')||x.f.startsWith('PracticeShelf-'));
check('Luyện tập: khung + ngân hàng chương lớn nhất',lib.reduce((s,x)=>s+x.bytes,0)+largest.bytes,BUDGET.practiceLibrary);
check('khung trang Luyện tập PracticeLibrary',js.filter(x=>x.f.startsWith('PracticeLibrary-')).reduce((s,x)=>s+x.bytes,0),BUDGET.practiceShell);
const others=js.filter(x=>!entryJs.includes(x.f)&&!isBank(x.f)).sort((a,b)=>b.bytes-a.bytes);
if(others[0])check('chunk khác lớn nhất '+others[0].f,others[0].bytes,BUDGET.otherChunk);
check('tổng JS ('+js.length+' tệp)',js.reduce((s,x)=>s+x.bytes,0),BUDGET.totalJs);
for(const f of missing)problems.push('thiếu tệp '+f+' (import tĩnh hoặc index.html)');
console.log(rows.join('\n'));
for(const p of problems.filter(p=>p.startsWith('thiếu')||p.startsWith('không tìm')))console.log('LỖI '+p);
console.log(problems.length?`Ngân sách gói: KHÔNG ĐẠT ở ${problems.length} mục.`:'Ngân sách gói: đạt.');
process.exit(problems.length?1:0);
