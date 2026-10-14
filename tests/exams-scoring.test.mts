// KT-01: test hồi quy chấm điểm (Đ/S, số sai định dạng, phân số, hết giờ, phiên bản cũ) và
// chấm lại 2 bài khảo sát Vòng 1 (01-khao-sat.md): 5,6 và 4,6 điểm.
// Bài làm là dữ liệu TỔNG HỢP dựng theo đúng số câu đúng/sai/trống và các đáp án ngắn đã ghi
// trong biên bản khảo sát; không phải dữ liệu học sinh.
import assert from 'node:assert/strict';
import {canonicalNumeric, canonicalRational, normalizedShort, scoreAssessment} from '../src/native/exams/assessment';
import {scorePracticeAssessment, examSections} from '../src/native/exams/flexible-profile';
import {PRACTICE_EXAMS, type PracticeExam} from '../src/native/exams/data';
import {createDraft, submitDraft, remainingMs, isAnswered, validateDraft, type Draft, type Response} from '../src/native/exams/store';
import {resultFor} from '../src/native/exams/result';
import {reviewRows, formatPoints} from '../src/native/exams/review';
import {practiceVersion, PRACTICE_ERRATA} from '../src/native/exams/practice-errata';
import exactTests from '../src/native/chapters/exact-tests.json';
import practiceTests from '../src/native/chapters/practice-tests.json';
import archivedTests from '../src/native/chapters/archived-tests.json';
import {suite} from './exams-harness.mts';

const {test, finish} = suite('S');
const T0 = Date.UTC(2026, 9, 14, 1, 0, 0);
const exact = (id: string) => (exactTests as unknown as {exam: PracticeExam}[]).find(p => p.exam.id === id)!.exam;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Đi đúng đường của giao diện: tạo lượt, ghi từng câu (revision tăng), nộp, chấm qua resultFor. */
function attempt(exam: PracticeExam, answers: Record<string, Response>, submitAt = T0 + 30 * 60000) {
  const made = createDraft(exam, 'synthetic-attempt-1', T0);
  assert.ok(made.ok, 'không tạo được lượt');
  let draft: Draft = made.value, clock = T0;
  for (const [id, answer] of Object.entries(answers)) {
    clock += 1000;
    const next = validateDraft({...draft, answers: {...draft.answers, [id]: answer}, updatedAt: clock, revision: draft.revision + 1}, exam);
    assert.ok(next.ok, 'ghi câu ' + id + ' thất bại: ' + (!next.ok && next.message));
    draft = next.value;
  }
  const submitted = submitDraft(exam, draft, submitAt);
  assert.ok(submitted.ok);
  const result = resultFor(exam, submitted.value);
  assert.ok(result && result.score.ok, 'không chấm được');
  return {draft: submitted.value, result: result!, score: result!.score as Extract<typeof result.score, {ok: true}>};
}
function partTotals(exam: PracticeExam, rows: {earnedMillipoints: number | null}[]) {
  return examSections(exam).map(p => rows.slice(p.from, p.to).reduce((s, r) => s + (r.earnedMillipoints ?? 0), 0));
}
const wrongChoice = (c: string) => (c === 'A' ? 'B' : 'A') as Response;

// ---------- Chấm lại bài khảo sát 1: Luyện tập Toán 12 C3 Bài 4 (T04) = 5,6 ----------
test('Khảo sát T04 (mtm-drive-g12-c3-t04-mtm-errata-v64): chấm lại ra 5,6 (2 / 1,6 / 2)', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64');
  const q = exam.questions, a: Record<string, Response> = {};
  // Trắc nghiệm: 8 đúng (câu 1-8), 2 sai (câu 9-10), 2 trống (câu 11-12).
  for (let i = 0; i < 8; i++) a[q[i].id] = (q[i] as {answer: string}).answer as Response;
  for (let i = 8; i < 10; i++) a[q[i].id] = wrongChoice((q[i] as {answer: string}).answer);
  // Đúng/sai: II.1 đúng 4 ý, II.2 đúng 3 ý, II.3 trống, II.4 đúng 1 ý.
  const key = (i: number) => (q[i] as {answer: boolean[]}).answer;
  a[q[12].id] = [...key(12)];
  a[q[13].id] = key(13).map((v, j) => j === 3 ? !v : v);
  a[q[14].id] = [null, null, null, null];
  a[q[15].id] = key(15).map((v, j) => j === 0 ? v : !v);
  // Trả lời ngắn đúng như biên bản: 17, 0,2 (khoá 0.20), 0,05, 0.18 (khoá 0.17), trống, 590.
  Object.assign(a, {[q[16].id]: '17', [q[17].id]: '0,2', [q[18].id]: '0,05', [q[19].id]: '0.18', [q[20].id]: '', [q[21].id]: '590'});
  const {score, result} = attempt(exam, a);
  assert.equal(score.earnedMillipoints, 5600);
  assert.equal(score.finalMillipoints, 5600);
  assert.deepEqual(partTotals(exam, score.rows), [2000, 1600, 2000]);
  assert.deepEqual(result.invalidNumeric, []);
  assert.equal(formatPoints(score.earnedMillipoints), '5,6');
});

// ---------- Chấm lại bài khảo sát 2: Thi thử Toán 12 GK1 mã 1201 = 4,6 ----------
test('Khảo sát Thi thử mtm-g12-gk1-2025-2026-code1201: chấm lại ra 4,6 (1,5 / 1,6 / 1,5); 1/2 bị 0 điểm', () => {
  const exam = PRACTICE_EXAMS.find(e => e.id === 'mtm-g12-gk1-2025-2026-code1201')!;
  const q = exam.questions, a: Record<string, Response> = {};
  // Trắc nghiệm: 6 đúng (câu 1-6), 2 sai (câu 7-8), 4 trống (câu 9-12).
  for (let i = 0; i < 6; i++) a[q[i].id] = (q[i] as {answer: string}).answer as Response;
  for (let i = 6; i < 8; i++) a[q[i].id] = wrongChoice((q[i] as {answer: string}).answer);
  // Đúng/sai: Q13 đúng 4 ý, Q14 đúng 1 ý, Q15 trống, Q16 đúng 3 ý.
  const key = (i: number) => (q[i] as {answer: boolean[]}).answer;
  a[q[12].id] = [...key(12)];
  a[q[13].id] = key(13).map((v, j) => j === 0 ? v : !v);
  a[q[15].id] = key(15).map((v, j) => j === 3 ? !v : v);
  // Trả lời ngắn: 1012, 0,41, 1/2 (khoá 0.5), 4,0 (khoá 4), 4,5 (khoá 4.47), trống.
  Object.assign(a, {[q[16].id]: '1012', [q[17].id]: '0,41', [q[18].id]: '1/2', [q[19].id]: '4,0', [q[20].id]: '4,5'});
  const {score, result, draft} = attempt(exam, a);
  assert.equal(score.earnedMillipoints, 4600);
  assert.deepEqual(partTotals(exam, score.rows), [1500, 1600, 1500]);
  assert.deepEqual(result.invalidNumeric, ['III-3']);
  // Bài làm gốc vẫn giữ nguyên "1/2" để xem lại/xuất; chỉ phần chấm coi là trống.
  assert.equal(draft.answers['III-3'], '1/2');
  const row = reviewRows(exam, draft).find(r => r.q.id === 'III-3')!;
  assert.equal(row.invalidNumeric, true); assert.equal(row.earned, 0); assert.equal(row.status, 'wrong');
  // Hiện trạng giao diện (ghi lại, Đợt 2 sẽ sửa phần hiển thị): ô "1/2" vẫn tính là "đã trả lời".
  assert.equal(isAnswered(exam, 'III-3', draft.answers), true);
  assert.equal(formatPoints(score.earnedMillipoints), '4,6');
});

// ---------- Luật câu trả lời ngắn hiện tại ----------
test('LUẬT HIỆN TẠI: câu numeric không nhận phân số; 1/2 = 0 điểm (anh quyết giữ luật, 14/10/2026)', () => {
  assert.equal(canonicalNumeric('1/2'), null);
  assert.equal(normalizedShort('numeric', '1/2'), null);
  const exam = PRACTICE_EXAMS.find(e => e.id === 'mtm-g12-gk1-2025-2026-code1201')!;
  // Lõi chấm từ chối cả bài nếu có câu numeric sai định dạng...
  const raw = scoreAssessment(exam, {'III-3': '1/2'});
  assert.equal(raw.ok, false);
  // ...nên resultFor đổi riêng câu đó thành trống (0 điểm) để vẫn chấm được cả bài.
  const {score, result} = attempt(exam, {'III-3': '1/2'});
  assert.equal(score.earnedMillipoints, 0);
  assert.deepEqual(result.invalidNumeric, ['III-3']);
  const right = attempt(exam, {'III-3': '0,5'});
  assert.equal(right.score.earnedMillipoints, 500);
});
test('Số thập phân: dấu phẩy, dấu chấm, số 0 thừa, dấu cộng đều tương đương', () => {
  for (const [input, canon] of [['0,2', '0.2'], ['0.20', '0.2'], ['4,0', '4'], ['004', '4'], ['+4', '4'], ['-0,50', '-0.5'], ['-0', '0'], ['  17 ', '17']] as const)
    assert.equal(canonicalNumeric(input), canon, input);
});
test('Số không hợp lệ ở câu numeric: chữ, số mũ, dấu cách nghìn, phân số, phần trăm', () => {
  for (const input of ['abc', '1e3', '1 000', '1.000,5', '2,', ',5', '1/2', '0x10', '∞', '4,47%'])
    assert.equal(canonicalNumeric(input), null, input);
});
test('Câu rational vẫn nhận -3/4 và tương đương 0,75 âm; mẫu 0 bị từ chối', () => {
  assert.equal(canonicalRational('-3/4'), '-3/4');
  assert.equal(canonicalRational('-0,75'), '-3/4');
  assert.equal(canonicalRational('6/-8'), '-3/4');
  assert.equal(canonicalRational('1/0'), null);
  assert.equal(normalizedShort('rational', '3/4'), normalizedShort('rational', '0.75'));
});
test('Thang Đ/S 0 / 0,1 / 0,25 / 0,5 / 1 theo số ý đúng; ý chưa chọn tính là sai', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64'), q = exam.questions[12] as {id: string; answer: boolean[]};
  const expected = [0, 100, 250, 500, 1000];
  for (let correct = 0; correct <= 4; correct++) {
    const answer = q.answer.map((v, j) => j < correct ? v : !v);
    const r = scorePracticeAssessment(exam, {[q.id]: answer});
    assert.ok(r.ok); assert.equal(r.ok && r.rows[12].earnedMillipoints, expected[correct], correct + ' ý đúng');
  }
  const partial = scorePracticeAssessment(exam, {[q.id]: [q.answer[0], null, null, null]});
  assert.ok(partial.ok && partial.rows[12].earnedMillipoints === 100);
});
test('Trắc nghiệm: đúng 0,25; sai và trống 0; đáp án ngoài A-D làm lõi chấm từ chối', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64'), q = exam.questions[0] as {id: string; answer: string};
  const r1 = scorePracticeAssessment(exam, {[q.id]: q.answer}), r2 = scorePracticeAssessment(exam, {[q.id]: wrongChoice(q.answer)}), r3 = scorePracticeAssessment(exam, {});
  assert.ok(r1.ok && r1.earnedMillipoints === 250); assert.ok(r2.ok && r2.earnedMillipoints === 0); assert.ok(r3.ok && r3.earnedMillipoints === 0);
  assert.equal(scorePracticeAssessment(exam, {[q.id]: 'E'}).ok, false);
  assert.equal(scorePracticeAssessment(exam, {'cau-khong-co': 'A'}).ok, false);
});
test('Làm đúng hết = 10 điểm cho mọi đề Thi thử, đề nguồn Drive và ngân hàng cũ (đáp án khoá tự nhất quán)', () => {
  const all = [...PRACTICE_EXAMS, ...[...exactTests, ...practiceTests, ...archivedTests].map(p => (p as unknown as {exam: PracticeExam}).exam)];
  const bad: string[] = [];
  for (const exam of all) {
    const answers: Record<string, unknown> = {};
    for (const q of exam.questions) answers[q.id] = q.kind === 'short' ? q.acceptedAnswers[0] : q.answer;
    const r = scorePracticeAssessment(exam, answers);
    if (!r.ok || r.earnedMillipoints !== 10000) bad.push(exam.id);
  }
  assert.deepEqual(bad, []);
});

// ---------- Hết giờ và nộp bài ----------
test('Hết giờ: đồng hồ về 0 đúng hạn, không âm; hạn = thời lượng đề', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64'), d = createDraft(exam, 'a1', T0);
  assert.ok(d.ok);
  assert.equal(d.value.deadline - d.value.startedAt, 90 * 60000);
  assert.equal(remainingMs(d.value, T0), 90 * 60000);
  assert.equal(remainingMs(d.value, d.value.deadline - 1), 1);
  assert.equal(remainingMs(d.value, d.value.deadline), 0);
  assert.equal(remainingMs(d.value, d.value.deadline + 3600000), 0);
  assert.throws(() => remainingMs(d.value, Number.NaN));
});
test('Nộp sau hạn (tự nộp khi máy ngủ dậy) vẫn chấm được; nộp lần hai không đổi gì', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64');
  const late = attempt(exam, {[exam.questions[0].id]: (exam.questions[0] as {answer: string}).answer as Response}, T0 + 3 * 3600000);
  assert.equal(late.score.earnedMillipoints, 250);
  assert.ok(late.draft.submittedAt! > late.draft.deadline);
  const again = submitDraft(exam, late.draft, T0 + 5 * 3600000);
  assert.ok(again.ok); assert.deepEqual(again.value, late.draft);
});
test('Bài chưa nộp không có kết quả (resultFor trả null)', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64'), d = createDraft(exam, 'a1', T0);
  assert.ok(d.ok); assert.equal(resultFor(exam, d.value), null);
});
test('Bản nháp của đề khác phiên bản (versionHash khác) không được chấm theo khoá mới', () => {
  const exam = exact('mtm-drive-g12-c3-t04-mtm-errata-v64'), d = attempt(exam, {}).draft;
  const changed = clone(exam); changed.versionHash = 'f'.repeat(64);
  assert.equal(resultFor(changed, d), null);
  assert.equal(validateDraft(d, changed).ok, false);
});

// ---------- Phiên bản cũ: đính chính v37 ----------
test('Đính chính v37: lượt cũ chấm theo bản gốc, lượt mới theo bản đính chính, hai khoá riêng', () => {
  for (const e of PRACTICE_ERRATA) {
    const base = PRACTICE_EXAMS.find(x => x.id === e.baseId)!, revised = practiceVersion(base);
    const oldRun = attempt(base, {}), newRun = attempt(revised, {});
    assert.ok(oldRun.score.ok && newRun.score.ok);
    assert.equal(resultFor(revised, oldRun.draft), null, 'lượt cũ không được chấm bằng bản đính chính');
    assert.equal(resultFor(base, newRun.draft), null, 'lượt mới không được chấm bằng bản gốc');
  }
});

finish();
