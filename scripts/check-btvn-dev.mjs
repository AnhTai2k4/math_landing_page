// Hồi quy lỗi trang trắng: chạy Vite thật, tải HTML/module/deps và kiểm chặn tệp riêng.
// Chỉ dùng loopback và dữ liệu giả; không ghi đè CSV của các đợt nghiệm thu trước.
import assert from 'node:assert/strict';
import {mkdirSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createServer} from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
mkdirSync(join(root, '.qa-temp'), {recursive: true});
mkdirSync(join(root, 'build'), {recursive: true});
const temporary = mkdtempSync(join(root, '.qa-temp/btvn-dev-'));
const original = {demo: process.env.MTM_BTVN_DEMO, csv: process.env.MTM_BTVN_CSV};
process.env.MTM_BTVN_DEMO = '1';
process.env.MTM_BTVN_CSV = join(temporary, 'results.csv');
const checks = [];
let server;
try {
  // Tạo CSV giả có thật: 404 phải đến từ lớp chặn, không phải do tệp không tồn tại.
  const privateCsv = join(root, 'build', `btvn-private-${Date.now()}.csv`);
  writeFileSync(privateCsv, 'PRIVATE_DEMO_SENTINEL\n');
  try {
    server = await createServer({root, server: {host: '127.0.0.1', port: 0, open: false}, logLevel: 'error'});
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    async function get(path, status, type) {
      const response = await fetch(base + path, {signal: AbortSignal.timeout(30000)});
      assert.equal(response.status, status, `${path}: HTTP ${response.status}, cần ${status}`);
      if (type) assert.match(response.headers.get('content-type') ?? '', type, path);
      const body = await response.text();
      if (status === 404) assert.ok(!body.includes('PRIVATE_DEMO_SENTINEL'), path);
      checks.push({path, status: response.status});
      console.log(`ĐẠT ${status} ${path}`);
      return body;
    }
    const html = await get('/btvn', 200, /text\/html/);
    assert.match(html, /id="root"/);
    const entry = html.match(/<script\b[^>]*type="module"[^>]*src="([^"]*\/src\/[^"?]+(?:\?[^\"]*)?)"/);
    assert.ok(entry, 'HTML phải tham chiếu module đầu vào');
    const main = await get(entry[1], 200, /javascript/);
    assert.match(main, /createRoot/);
    const app = await get('/src/App.tsx', 200, /javascript/);
    // Dùng URL deps thật do Vite sinh, gồm query version; không đoán tên cache.
    const dependencies = [...(main + '\n' + app).matchAll(/["']([^"']*\/deps\/react(?:_jsx-dev-runtime|-dom_client)\.js(?:\?[^"']*)?)["']/g)];
    const urls = [...new Set(dependencies.map(match => match[1]))];
    assert.ok(urls.some(url => url.includes('react_jsx-dev-runtime.js')), 'Thiếu JSX runtime');
    assert.ok(urls.some(url => url.includes('react-dom_client.js')), 'Thiếu React DOM client');
    for (const url of urls) {
      const js = await get(url, 200, /javascript/);
      assert.ok(js.length > 100, 'Deps phải có nội dung JavaScript');
    }
    for (const path of [
      '/server/btvn/demo-students.ts', '/server/btvn/demo-exam.json',
      `/@fs/${join(root, 'server/btvn/demo-students.ts').replace(/\\/g, '/')}`,
      '/server%2fbtvn%2fdemo-students.ts', '/api/btvn.ts',
      '/scripts/check-btvn-dev.mjs', '/tests/exams-btvn.test.mts',
      `/build/${privateCsv.split(/[\\/]/).pop()}`, '/build/btvn-demo-results.csv',
      '/@fs/T:/Claude/SanPham/btvn-web-diem-danh/phieu-a/ket-qua-gia-dot-2-http.csv',
    ]) await get(path, 404);
    console.log(JSON.stringify({at: new Date().toISOString(), passed: true, checks,
      mode: 'Vite demo thật + HTTP fetch', browserVerified: false}, null, 2));
  } finally {
    await server?.close();
    rmSync(privateCsv, {force: true});
  }
} finally {
  for (const [key, value] of [['MTM_BTVN_DEMO', original.demo], ['MTM_BTVN_CSV', original.csv]]) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  rmSync(temporary, {recursive: true, force: true});
}
