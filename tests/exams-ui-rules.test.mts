// Đợt 2 (claude/sua-loi-luyen-thi): test các quy tắc hiển thị thuần của màn luyện tập/thi thử.
// Chỉ dữ liệu đề có sẵn và câu trả lời tổng hợp; không dữ liệu học sinh, không đổi luật chấm.
import assert from 'node:assert/strict';
import {PRACTICE_EXAMS, type PracticeExam, type PracticeQuestion} from '../src/native/exams/data';
import {resultFor} from '../src/native/exams/result';
import {createDraft, submitDraft, validateDraft, isAnswered, type Answers, type Draft} from '../src/native/exams/store';
import {answerState, shortAnswerStatus, shortFormatMessage} from '../src/native/exams/attempt-ui';
import {suite} from './exams-harness.mts';

const {test, finish} = suite('U');
const T0 = Date.UTC(2026, 9, 14, 1, 0, 0);
const exam1201 = PRACTICE_EXAMS.find(e => e.id === 'mtm-g12-gk1-2025-2026-code1201')!;
const firstShort = (exam: PracticeExam, mode: string) => exam.questions.find(q => q.kind === 'short' && q.mode === mode) as Extract<PracticeQuestion, {kind: 'short'}>;
function submitted(exam: PracticeExam, answers: Answers): Draft {
  const made = createDraft(exam, 'synthetic-ui-1', T0);
  assert.ok(made.ok);
  const next = validateDraft({...made.value, answers, updatedAt: T0 + 1000, revision: 1}, exam);
  assert.ok(next.ok);
  const done = submitDraft(exam, next.value, T0 + 60000);
  assert.ok(done.ok);
  return done.value;
}

// ---------- LT-02: báo định dạng ngay, tách "đã nhập" và "hợp lệ" ----------
test('LT-02: câu numeric nhận số thập phân phẩy/chấm, báo sai với 1/2, abc, 1e3, biểu thức', () => {
  for (const ok of ['0,5', '0.5', '-2,75', '17', '+3', '4,0']) assert.equal(shortAnswerStatus('numeric', ok), 'valid', ok);
  for (const bad of ['1/2', 'abc', '1e3', '2+3', '1,000.5', '0,5 cm', '½']) assert.equal(shortAnswerStatus('numeric', bad), 'invalid', bad);
  for (const empty of ['', '   ', undefined, null, ['x']]) assert.equal(shortAnswerStatus('numeric', empty), 'empty');
});
test('LT-02: câu rational vẫn nhận -3/4 và số thập phân; exact có chữ là hợp lệ', () => {
  for (const ok of ['-3/4', '3/-4', '0,75', '2']) assert.equal(shortAnswerStatus('rational', ok), 'valid', ok);
  for (const bad of ['3/0', 'a/b', '1/2/3']) assert.equal(shortAnswerStatus('rational', bad), 'invalid', bad);
  assert.equal(shortAnswerStatus('exact', 'ABC'), 'valid');
  assert.equal(shortAnswerStatus('exact', ' '), 'empty');
});
test('LT-02: "sai định dạng" ở giao diện khớp đúng câu resultFor chấm 0 điểm vì định dạng', () => {
  const shorts = exam1201.questions.filter(q => q.kind === 'short');
  const values = ['1/2', '0,41', 'abc', '1e3', '', '4,5'];
  const answers: Answers = Object.fromEntries(shorts.map((q, i) => [q.id, values[i]]));
  const result = resultFor(exam1201, submitted(exam1201, answers))!;
  const invalidUi = shorts.filter(q => answerState(exam1201, q, answers) === 'invalid').map(q => q.id);
  assert.deepEqual(invalidUi, result.invalidNumeric);
  assert.equal(invalidUi.length, 3);
});
test('LT-02: ô số câu không còn tô "đã trả lời" khi nhập 1/2 (luật lưu cũ isAnswered vẫn giữ nguyên)', () => {
  const q = firstShort(exam1201, 'numeric');
  const answers: Answers = {[q.id]: '1/2'};
  assert.equal(isAnswered(exam1201, q.id, answers), true, 'store.isAnswered không đổi');
  assert.equal(answerState(exam1201, q, answers), 'invalid');
  assert.equal(answerState(exam1201, q, {[q.id]: '0,5'}), 'answered');
  assert.equal(answerState(exam1201, q, {}), 'blank');
});
test('LT-02: Đ/S và trắc nghiệm giữ đúng quy tắc cũ (Đ/S đủ 4 ý mới là đã trả lời)', () => {
  const tf = exam1201.questions.find(q => q.kind === 'tf')!, mc = exam1201.questions.find(q => q.kind === 'mc')!;
  assert.equal(answerState(exam1201, tf, {[tf.id]: [true, false, null, true]}), 'blank');
  assert.equal(answerState(exam1201, tf, {[tf.id]: [true, false, false, true]}), 'answered');
  assert.equal(answerState(exam1201, mc, {[mc.id]: 'C'}), 'answered');
  assert.equal(answerState(exam1201, mc, {[mc.id]: null}), 'blank');
});
test('LT-02: lời báo nêu rõ quy tắc và hậu quả, không chứa đáp án', () => {
  const q = firstShort(exam1201, 'numeric');
  const message = shortFormatMessage('numeric');
  assert.match(message, /1\/2/);
  assert.match(message, /0 điểm/);
  for (const accepted of q.acceptedAnswers) assert.ok(!message.includes(accepted) || /^\d$/.test(accepted), 'lộ đáp án ' + accepted);
  assert.match(shortFormatMessage('rational'), /-3\/4/);
});

finish();
