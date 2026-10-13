// KT-05 (cổng kiểm cấu trúc đề, phần tệp): mọi mảnh ảnh đề/lời giải và PDF nội bộ mà dữ liệu đề
// trỏ tới phải có trong public/ và đúng SHA-256 ghi trong dữ liệu. PDF ở máy chủ ngoài chỉ được liệt kê.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PRACTICE_EXAMS, type PracticeExam} from '../src/native/exams/data';
import type {SourceSegment} from '../src/native/exams/MtmSourceContent';
import exactTests from '../src/native/chapters/exact-tests.json';
import practiceTests from '../src/native/chapters/practice-tests.json';
import archivedTests from '../src/native/chapters/archived-tests.json';
import {suite} from './exams-harness.mts';

const {test, finish} = suite('A');
const root = process.env.MTM_ROOT ?? process.cwd();
const exams: PracticeExam[] = [...PRACTICE_EXAMS, ...[...exactTests, ...practiceTests, ...archivedTests].map(p => (p as unknown as {exam: PracticeExam}).exam)];
const cache = new Map<string, string | null>();
const sha = (file: string) => {
  if (!cache.has(file)) cache.set(file, existsSync(file) ? createHash('sha256').update(readFileSync(file)).digest('hex') : null);
  return cache.get(file)!;
};
const segments: {exam: string; seg: SourceSegment}[] = [];
const pdfs: {exam: string; url: string; sha256: string}[] = [];
for (const e of exams) {
  for (const seg of [...(e.sourceInstructions ?? []), ...(e.solutionInstructions ?? [])]) segments.push({exam: e.id, seg});
  for (const q of e.questions) for (const seg of [...(q.sourceContent?.questions ?? []), ...(q.sourceContent?.solutions ?? [])]) segments.push({exam: e.id, seg});
  if (e.sourcePdf) pdfs.push({exam: e.id, url: e.sourcePdf.url, sha256: e.sourcePdf.sha256});
  if (e.mtmDocuments) for (const d of [e.mtmDocuments.questions, e.mtmDocuments.solutions]) pdfs.push({exam: e.id, url: d.url, sha256: d.sha256});
}
const external = [...new Set(pdfs.filter(p => !p.url.startsWith('/')).map(p => `${p.exam} -> ${new URL(p.url).host}`))];

test('Mảnh ảnh đề/lời giải: có tệp trong public/practice-media/source-crops và đúng SHA-256', () => {
  const bad = segments.filter(({seg}) => sha(join(root, 'public/practice-media/source-crops', seg.path)) !== seg.sha256.toLowerCase())
    .map(({exam, seg}) => `${exam}: ${seg.path}`);
  assert.ok(segments.length > 0);
  assert.deepEqual([...new Set(bad)].slice(0, 20), []);
});
test('PDF nội bộ /exam-assets và /qa-exam-assets: có tệp và đúng SHA-256 (tên tệp là hash)', () => {
  const bad = pdfs.filter(p => p.url.startsWith('/')).filter(p => sha(join(root, 'public', p.url)) !== p.sha256.toLowerCase()).map(p => `${p.exam}: ${p.url}`);
  assert.deepEqual([...new Set(bad)], []);
});
test('PDF ở máy chủ ngoài chỉ được dùng https (danh sách ghi vào báo cáo, DL-12 sẽ chép về)', () => {
  assert.ok(pdfs.filter(p => !p.url.startsWith('/')).every(p => p.url.startsWith('https://')));
});
test('DL-12: không còn đề nào tải PDF từ kho GitHub cũ; 2 đề Thi thử dùng /exam-assets đúng SHA-256', () => {
  assert.deepEqual(pdfs.filter(p => p.url.includes('githubusercontent.com')).map(p => p.exam), []);
  for (const id of ['mtm-g11-gk1-2024-2025-code101', 'mtm-g12-gk1-2025-2026-code1201']) {
    const pdf = pdfs.find(p => p.exam === id)!;
    assert.equal(pdf.url, `/exam-assets/${pdf.sha256}.pdf`);
    assert.equal(sha(join(root, 'public', pdf.url)), pdf.sha256);
  }
});

finish({segments: segments.length, uniqueFiles: cache.size, localPdfs: pdfs.filter(p => p.url.startsWith('/')).length, externalPdfs: external});
