// Đợt 4 (claude/doc-de-mobile): test quy tắc thuần của công cụ đọc đề trên điện thoại.
// TH-02 mức phóng khi mở ảnh câu; TH-05 xoay bảng biến thiên giữ nguyên dữ liệu; nhãn thẻ đề giữ như V67 (anh chốt).
// Chỉ dùng dữ liệu đề có sẵn trong kho mã nguồn; không dữ liệu học sinh, không ghi bộ nhớ.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {IMAGE_ZOOM_LEVELS, READABLE_SCALE, canTranspose, initialZoomLevel, transposeTable} from '../src/native/exams/reading-tools';
import {testLabel} from '../src/native/chapters/practice-shared';
import practiceTests from '../src/native/chapters/practice-tests.json';
import detailed from '../src/native/exams/detailed-solutions.json';
import {suite} from './exams-harness.mts';

const {test, finish} = suite('R');

test('Ảnh đề 1562 px trên màn 375 px mở sẵn ở mức đọc được (x3, từ 55% cỡ gốc)', () => {
  const level = initialZoomLevel(375, 1562);
  assert.equal(IMAGE_ZOOM_LEVELS[level], 3);
  assert.ok(375 * IMAGE_ZOOM_LEVELS[level] / 1562 >= READABLE_SCALE);
  assert.ok(375 * IMAGE_ZOOM_LEVELS[level - 1] / 1562 < READABLE_SCALE, 'không phóng quá mức cần');
});
test('Màn rộng hoặc ảnh hình nhỏ giữ "vừa màn"; không biết cỡ gốc cũng giữ vừa màn', () => {
  assert.equal(initialZoomLevel(1366, 1562), 0);
  assert.equal(initialZoomLevel(375, 600), 0);
  assert.equal(initialZoomLevel(375, undefined), 0);
  assert.equal(initialZoomLevel(0, 1562), 0);
});
test('Ảnh cực rộng dừng ở mức lớn nhất, không vượt danh sách mức', () => {
  assert.equal(initialZoomLevel(200, 5000), IMAGE_ZOOM_LEVELS.length - 1);
});

const sample = {caption: 'BBT', headers: ['x', '-∞', '-1', '0', '+∞'], rows: [["f'(x)", '+', '0', '-', '-'], ['f(x)', '↗', '2', '↘', '↘']]};
test('Xoay bảng biến thiên: cột thành hàng, giữ thứ tự khoảng/điểm, dấu và mũi tên', () => {
  const turned = transposeTable(sample);
  assert.deepEqual(turned.headers, ['x', "f'(x)", 'f(x)']);
  assert.deepEqual(turned.rows, [['-∞', '+', '↗'], ['-1', '0', '2'], ['0', '-', '↘'], ['+∞', '-', '↘']]);
});
test('Xoay hai lần trả về đúng bảng gốc (không mất, không thêm ô)', () => {
  const back = transposeTable({caption: sample.caption, ...transposeTable(sample)});
  assert.deepEqual(back, {headers: sample.headers, rows: sample.rows});
});
test('Mọi bảng trong ngân hàng luyện tập và lời giải chi tiết: xoay được thì xoay hai lần giữ nguyên dữ liệu', () => {
  type T = {caption?: string; headers: string[]; rows: string[][]};
  const tables: T[] = [];
  for (const item of practiceTests as {exam: {questions: {questionTables?: T[]; solutionTables?: T[]}[]}}[])
    for (const q of item.exam.questions) tables.push(...(q.questionTables ?? []), ...(q.solutionTables ?? []));
  for (const exam of detailed as unknown as {questions: {blocks: ({type: string} & Partial<T>)[]}[]}[])
    for (const q of exam.questions) for (const b of q.blocks) if (b.type === 'table') tables.push(b as T);
  assert.ok(tables.length >= 100, `có ${tables.length} bảng`);
  let turned = 0;
  for (const t of tables) {
    if (!canTranspose(t)) continue;
    turned++;
    const once = transposeTable(t);
    assert.equal(once.rows.length, t.headers.length - 1);
    assert.ok(once.rows.every(row => row.length === t.rows.length + 1));
    assert.deepEqual(transposeTable({...once}), {headers: t.headers, rows: t.rows});
  }
  assert.ok(turned >= 100, `xoay được ${turned} bảng`);
});
test('Bảng 2 cột hoặc hàng thiếu ô không xoay (giữ cách hiện cũ)', () => {
  assert.equal(canTranspose({headers: ['Câu', 'Đáp án'], rows: [['1', 'A']]}), false);
  assert.equal(canTranspose({headers: ['x', '1', '2'], rows: [['y', '3']]}), false);
  assert.equal(canTranspose({headers: ['x', '1', '2'], rows: []}), false);
});
test('Nhãn đề theo tài liệu giữ như V67: "Đề test số 0n" (anh chốt đánh số liên tục Bài 1, Bài 2...)', () => {
  assert.equal(testLabel('ĐỀ TEST SỐ 02'), 'Đề test số 02');
  assert.equal(testLabel('1'), 'Đề test số 01');
  assert.equal(testLabel('Đề ôn tập'), 'Đề ôn tập');
});
test('Thẻ đề theo tài liệu vẫn ghi "Bài n · Đề test số 0x" và nút "Làm bài n" (không đổi sang "Đề thứ n trong chương")', () => {
  const shelf = readFileSync(join(process.env.MTM_ROOT ?? process.cwd(), 'src/native/chapters/PracticeShelf.tsx'), 'utf8');
  assert.ok(shelf.includes('<span className="cp-test-index">Bài {p.sourceSequence?.sequence??p.order}{p.sourceSequence?.test?<> · {testLabel(p.sourceSequence.test)}</>:null}</span>'));
  assert.ok(shelf.includes("'Làm'} bài ${p.sourceSequence?.sequence??p.order}"));
  assert.ok(!shelf.includes('trong chương</span>'));
});

finish();
