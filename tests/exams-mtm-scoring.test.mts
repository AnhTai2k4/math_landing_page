// Dữ liệu tổng hợp trên worktree nháp. Không kết nối hệ thống hoặc đọc bài làm thật.
import assert from 'node:assert/strict';
import {
  MTM_SCORING_VERSION, MtmScoringCatalog, lockMtmAttempt, scoreMtmAttempt,
  roundMtmTotal, restoreMtmAttempt,
} from '../src/native/exams/mtm-scoring';
import {suite} from './exams-harness.mts';

const {test, finish} = suite('MTM');
type Fraction = {numerator: string; denominator: string};
type Question = Record<string, unknown>;
type Snapshot = ReturnType<MtmScoringCatalog['prepare']>;
type Submission = Record<string, unknown>;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

// Oracle độc lập: tính trọng số nguyên trên mẫu 2N, không gọi hàm số học của module.
function fraction(numerator: number | bigint, denominator: number | bigint = 1): Fraction {
  let n = BigInt(numerator), d = BigInt(denominator);
  assert.notEqual(d, 0n);
  if (d < 0n) { n = -n; d = -d; }
  let a = n < 0n ? -n : n, b = d;
  while (b !== 0n) { const remainder = a % b; a = b; b = remainder; }
  return {numerator: String(n / a), denominator: String(d / a)};
}
function oracle(full: number, dsCounts: number[], totalQuestions: number): Fraction {
  const weights = [0, 2, 5, 10, 20];
  return fraction(20 * full + dsCounts.reduce((sum, k) => sum + weights[k], 0), 2 * totalQuestions);
}
function oracleDisplay(value: Fraction): string {
  const numerator = BigInt(value.numerator) * 100n, denominator = BigInt(value.denominator);
  const cents = numerator / denominator + (2n * (numerator % denominator) >= denominator ? 1n : 0n);
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}
const tn = (number = 1): Question => ({number, section: 'TN', prompt: `Câu tổng hợp ${number}`, choices: ['Một', 'Hai', 'Ba', 'Bốn'], answer: 'A'});
const ds = (number = 1): Question => ({number, section: 'DS', prompt: `Câu đúng sai tổng hợp ${number}`, statements: ['Ý a', 'Ý b', 'Ý c', 'Ý d'], answer: [true, false, true, false]});
const tln = (number = 1): Question => ({number, section: 'TLN', prompt: `Trả lời ngắn ${number}`, responseFormat: 'short', acceptedAnswers: ['0.5'], shortRule: {verified: true, evidence: 'Quy tắc và khóa tổng hợp đã đối chiếu', mode: 'decimal'}});
function source(questions: Question[], suffix = '1') {
  return {examId: `de-tong-hop-${suffix}`, examVersion: 'de-v1', answerKeyVersion: 'dap-an-v1', sourceRef: 'fixture:mtm-scoring', sourceComplete: true, answerKeyVerified: true, questions};
}
function prepare(questions: Question[], suffix = '1') { return new MtmScoringCatalog().prepare(source(questions, suffix)); }
function score(exam: Snapshot, answers: Submission = {}) { return scoreMtmAttempt(lockMtmAttempt(exam, 'luot-tong-hop'), answers); }
function correctAnswers(exam: Snapshot): Submission {
  return Object.fromEntries(exam.questions.map(q => [q.id, q.type === 'TN' ? 'A' : q.type === 'DS' ? [true, false, true, false] : '0,5']));
}
function wrongAnswers(exam: Snapshot): Submission {
  return Object.fromEntries(exam.questions.map(q => [q.id, q.type === 'TN' ? 'B' : q.type === 'DS' ? [false, true, false, true] : '0.6']));
}
function assertOfficial(result: ReturnType<typeof score>, expected: Fraction) {
  assert.deepEqual(result.rawTotal, expected);
  assert.deepEqual(result.officialTotal, expected);
  assert.equal(result.displayTotal, oracleDisplay(expected));
  assert.equal(result.officialDisplayTotal, oracleDisplay(expected));
  assert.deepEqual(result.pending, []);
}
function assertPending(result: ReturnType<typeof score>) {
  assert.equal(result.officialTotal, null);
  assert.equal(result.officialDisplayTotal, null);
  assert.ok(result.pending.length > 0, 'Phải có lý do chưa chấm được');
}

const combinations = [
  {TN: 2, DS: 0, TLN: 0, structure: 'TN'},
  {TN: 0, DS: 3, TLN: 0, structure: 'DS'},
  {TN: 0, DS: 0, TLN: 7, structure: 'TLN'},
  {TN: 2, DS: 1, TLN: 0, structure: 'TN+DS'},
  {TN: 1, DS: 0, TLN: 5, structure: 'TN+TLN'},
  {TN: 0, DS: 2, TLN: 5, structure: 'DS+TLN'},
  {TN: 12, DS: 4, TLN: 6, structure: 'TN+DS+TLN'},
];
for (const counts of combinations) {
  test(`Cấu trúc ${counts.structure}, N=${counts.TN + counts.DS + counts.TLN}: phân bổ, đúng hết, sai hết, bỏ trống`, () => {
    const questions = [...Array.from({length: counts.TN}, (_, i) => tn(i + 1)), ...Array.from({length: counts.DS}, (_, i) => ds(i + 1)), ...Array.from({length: counts.TLN}, (_, i) => tln(i + 1))];
    const exam = prepare(questions, counts.structure), N = questions.length;
    assert.deepEqual(exam.counts, {TN: counts.TN, DS: counts.DS, TLN: counts.TLN, UNKNOWN: 0});
    assert.equal(exam.N, N); assert.equal(exam.structure, counts.structure);
    assert.deepEqual(exam.pointsPerQuestion, fraction(10, N));
    assert.deepEqual(exam.sections.map(s => [s.type, s.count, s.maxScore]), ['TN', 'DS', 'TLN'].filter(type => counts[type as 'TN' | 'DS' | 'TLN'] > 0).map(type => [type, counts[type as 'TN' | 'DS' | 'TLN'], fraction(10 * counts[type as 'TN' | 'DS' | 'TLN'], N)]));
    assert.ok(exam.questions.every(q => JSON.stringify(q.maxScore) === JSON.stringify(fraction(10, N))));
    assertOfficial(score(exam, correctAnswers(exam)), fraction(10));
    assertOfficial(score(exam, wrongAnswers(exam)), fraction(0));
    assertOfficial(score(exam), fraction(0));
  });
}

for (const [name, question, correct] of [['TN', tn(), 'A'], ['DS', ds(), [true, false, true, false]], ['TLN', tln(), '0,5']] as const) {
  test(`Một câu duy nhất ${name} có p=10`, () => {
    const exam = prepare([question], `mot-${name}`);
    assert.equal(exam.N, 1); assert.deepEqual(exam.pointsPerQuestion, fraction(10));
    assertOfficial(score(exam, {[exam.questions[0].id]: correct}), fraction(10));
  });
}

for (const N of [3, 6, 7]) {
  test(`N=${N}: điểm tuần hoàn giữ phân số gốc và chỉ làm tròn tổng`, () => {
    const exam = prepare(Array.from({length: N}, (_, i) => tn(i + 1)), `lap-${N}`);
    assert.deepEqual(exam.pointsPerQuestion, fraction(10, N));
    for (let correct = 0; correct <= N; correct++) {
      const answers = Object.fromEntries(exam.questions.map((q, i) => [q.id, i < correct ? 'A' : 'B']));
      assertOfficial(score(exam, answers), oracle(correct, [], N));
    }
  });
}

for (let k = 0; k <= 4; k++) {
  test(`DS k=${k}: khớp khóa có cả Đúng và Sai, bảng lũy tiến chính xác`, () => {
    const exam = prepare([ds()], `ds-${k}`), key = [true, false, true, false];
    const result = score(exam, {[exam.questions[0].id]: key.map((value, index) => index < k ? value : !value)});
    assertOfficial(result, oracle(0, [k], 1));
    assert.equal(result.rows[0].correctCount, k);
    assert.deepEqual(result.rows[0].earned, oracle(0, [k], 1));
    assert.deepEqual(exam.dsTable, [0, 2, 5, 10, 20].map(weight => fraction(weight, 2)));
  });
}
test('DS thiếu câu trả lời hoặc ý bỏ trống được 0 cho riêng ý, không được coi là đáp án Sai', () => {
  const exam = prepare([ds()]), id = exam.questions[0].id;
  for (const answer of [[null, null, null, null], []]) assertOfficial(score(exam, {[id]: answer}), fraction(0));
  const partial = score(exam, {[id]: [true, false]});
  assertOfficial(partial, fraction(5, 2)); assert.equal(partial.rows[0].correctCount, 2);
  assertOfficial(score(exam, {[id]: [null, false, null, false]}), fraction(5, 2));
});
test('Bài hỗn hợp đối chiếu oracle số nguyên độc lập cho tất cả k DS và N=3/6/7', () => {
  for (const N of [3, 6, 7]) {
    const exam = prepare([ds(), ...Array.from({length: N - 1}, (_, i) => i % 2 ? tln(i + 1) : tn(i + 1))]);
    for (let k = 0; k <= 4; k++) {
      const answers = correctAnswers(exam);
      answers[exam.questions[0].id] = [true, false, true, false].map((value, i) => i < k ? value : !value);
      const expected = oracle(N - 1, [k], N), result = score(exam, answers);
      assertOfficial(result, expected);
      assert.equal(result.displayTotal, oracleDisplay(expected));
    }
  }
});
test('ROUND_HALF_UP tại điểm giữa, hai phía điểm giữa và phân số lớn', () => {
  for (const [value, expected] of [[fraction(1, 200), '0.01'], [fraction(201, 200), '1.01'], [fraction(1999, 200), '10.00'], [fraction(100499, 100000), '1.00'], [fraction(100501, 100000), '1.01'], [fraction(1n, 300000000000000000000n), '0.00']] as const) {
    assert.equal(roundMtmTotal(value), expected);
    assert.equal(roundMtmTotal(value), oracleDisplay(value));
  }
});
test('TN chọn nhiều đáp án là sai 0, câu khác vẫn được chấm', () => {
  const exam = prepare([tn(), tln()]), answers = correctAnswers(exam);
  answers[exam.questions[0].id] = ['A', 'B'];
  const result = score(exam, answers);
  assertOfficial(result, fraction(5)); assert.equal(result.rows[0].status, 'graded');
});
test('Số câu thay đổi không khóa cứng trọng số hoặc chia đều theo số phần', () => {
  const a = prepare([tn(), ds(), tln()]), b = prepare([tn(), ds(), tln(), tln(2)]);
  assert.deepEqual(a.pointsPerQuestion, fraction(10, 3)); assert.deepEqual(b.pointsPerQuestion, fraction(5, 2));
  assert.deepEqual(b.sections.find(s => s.type === 'TLN')?.maxScore, fraction(5));
  assertOfficial(score(a, correctAnswers(a)), fraction(10)); assertOfficial(score(b, correctAnswers(b)), fraction(10));
});

test('Nhận diện nội dung và cấu trúc khi không có kind, section không quyết định loại câu', () => {
  const questions = [tn(), ds(), tln()].map(q => ({...q, section: 'Tên phần không quyết định loại'}));
  const exam = prepare(questions);
  assert.deepEqual(exam.questions.map(q => q.type), ['TN', 'DS', 'TLN']);
  assertOfficial(score(exam, correctAnswers(exam)), fraction(10));
});
test('Nhận diện từ lựa chọn A-D, ý a-d từng dòng và cụm trả lời ngắn trong nội dung', () => {
  const exam = prepare([
    {prompt: 'Chọn một đáp án\nA. Một\nB. Hai\nC. Ba\nD. Bốn', answer: 'A'},
    {prompt: 'Xét các ý\na) Ý thứ nhất\nb) Ý thứ hai\nc) Ý thứ ba\nd) Ý thứ tư', answer: [true, false, true, false]},
    {prompt: 'Câu trả lời ngắn: tính giá trị.', acceptedAnswers: ['0.5'], shortRule: {verified: true, evidence: 'Quy tắc tổng hợp', mode: 'decimal'}},
  ]);
  assert.deepEqual(exam.questions.map(q => q.type), ['TN', 'DS', 'TLN']);
  assertOfficial(score(exam, correctAnswers(exam)), fraction(10));
});
test('Giữ nguyên đề, công thức, hình, nguồn, thứ tự và thang gốc trong hồ sơ', () => {
  const input = source([{...tln(), prompt: 'Tính $\\frac{1}{2}$, giữ nguyên dấu và hình.', image: 'fixture:hinh.png', sourceRef: 'fixture:trang-3-cau-2'}]);
  const withScale = {...input, sourceOriginalScale: {label: 'Thang nguồn tổng hợp', max: 20}}, before = clone(withScale);
  const exam = new MtmScoringCatalog().prepare(withScale);
  assert.deepEqual(withScale, before);
  assert.deepEqual(exam.questions[0].source, before.questions[0]);
  assert.deepEqual(exam.source.sourceOriginalScale, before.sourceOriginalScale);
});
test('Trùng số câu giữa các phần hoặc cùng phần vẫn có ID riêng và chấm riêng', () => {
  const exam = prepare([tn(1), ds(1), tln(1), tn(1)]);
  assert.equal(new Set(exam.questions.map(q => q.id)).size, 4);
  const answers = correctAnswers(exam); answers[exam.questions[3].id] = 'B';
  assertOfficial(score(exam, answers), fraction(15, 2));
});

test('Đề rỗng không chia cho 0, không công bố điểm tổng chính thức', () => {
  const exam = prepare([]), result = score(exam);
  assert.equal(exam.N, 0); assert.equal(exam.pointsPerQuestion, null); assert.equal(exam.structure, null);
  assert.deepEqual(exam.sections, []); assertPending(result);
});
test('Thiếu đáp án chỉ chặn câu đó, giữ N và phần đủ dữ liệu', () => {
  const missing = tn(2); delete missing.answer;
  const exam = prepare([tn(), missing, tln()]), result = score(exam, correctAnswers(exam));
  assert.equal(exam.N, 3); assert.deepEqual(exam.pointsPerQuestion, fraction(10, 3));
  assertPending(result); assert.deepEqual(result.rawTotal, fraction(20, 3));
  assert.equal(result.rows[1].status, 'ungradable'); assert.equal(result.rows[1].earned, null);
  assert.equal(result.rows[0].status, 'graded'); assert.equal(result.rows[2].status, 'graded');
});
for (const count of [3, 5]) {
  test(`DS có ${count} ý nguồn không được áp bảng bốn ý, không chia lại điểm`, () => {
    const malformed = {...ds(), statements: Array.from({length: count}, (_, i) => `Ý ${i + 1}`), answer: Array.from({length: count}, (_, i) => i % 2 === 0)};
    const exam = prepare([malformed, tn()]), result = score(exam, correctAnswers(exam));
    assert.equal(exam.counts.DS, 1); assert.equal(exam.N, 2); assert.deepEqual(exam.pointsPerQuestion, fraction(5));
    assertPending(result); assert.equal(result.rows[0].earned, null); assert.equal(result.rows[0].status, 'ungradable');
    assert.deepEqual(result.rawTotal, fraction(5));
  });
}
test('Đáp án DS thiếu, thừa ý hoặc không phải boolean cần kiểm thay vì cho 0 điểm', () => {
  for (const answer of [[true, false, true], [true, false, true, false, true], [true, 'Sai', true, false]]) {
    const exam = prepare([{...ds(), answer}, tn()]), result = score(exam, correctAnswers(exam));
    assertPending(result); assert.equal(result.rows[0].status, 'ungradable'); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('Đề thiếu trang hoặc chưa xác minh khóa chặn điểm chính thức, giữ phần độc lập', () => {
  for (const [changes, expected] of [[{sourceComplete: false}, fraction(10)], [{answerKeyVerified: false}, fraction(0)]] as const) {
    const exam = new MtmScoringCatalog().prepare({...source([tn(), tln()]), ...changes});
    const result = score(exam, correctAnswers(exam)); assertPending(result);
    assert.deepEqual(result.rawTotal, expected);
    assert.ok(result.rows.every(row => row.status === ('sourceComplete' in changes ? 'graded' : 'ungradable')));
  }
});
test('Câu mơ hồ, mâu thuẫn loại hoặc đáp án mâu thuẫn được đánh dấu đúng câu', () => {
  for (const question of [{...tn(), kind: 'tf'}, {...tn(), answerConflict: true}, {...tn(), issues: ['Dữ kiện nguồn cần đối chiếu']}]) {
    const exam = prepare([question, tln()]), result = score(exam, correctAnswers(exam));
    assertPending(result); assert.equal(result.rows[0].status, 'ungradable'); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('Không nhận diện được câu vẫn giữ vị trí và phần điểm, không chia lại cho câu đã biết', () => {
  const exam = prepare([{number: 1, prompt: 'Nội dung chưa đủ để xác định cấu trúc'}, tn(2)]);
  assert.equal(exam.N, 2); assert.equal(exam.counts.UNKNOWN, 1); assert.equal(exam.questions[0].type, 'UNKNOWN');
  assert.deepEqual(exam.pointsPerQuestion, fraction(5));
  const result = score(exam, {[exam.questions[1].id]: 'A'});
  assertPending(result); assert.deepEqual(result.rawTotal, fraction(5)); assert.equal(result.rows[0].earned, null);
});
test('TLN chưa có quy tắc chấp nhận đã xác minh không bị coi là học sinh làm sai', () => {
  for (const changes of [{shortRule: undefined}, {shortRule: {verified: false, evidence: '', mode: 'decimal'}}]) {
    const question = {...tln(), ...changes};
    const exam = prepare([question, tn()]), result = score(exam, correctAnswers(exam));
    assertPending(result); assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('ID câu lạ và payload bài làm sai kiểu không bị âm thầm bỏ qua', () => {
  const exam = prepare([tn()]), attempt = lockMtmAttempt(exam, 'luot-payload');
  assertPending(scoreMtmAttempt(attempt, {...correctAnswers(exam), 'id-khong-co': 'A'}));
  for (const answers of [null, [], 'A', 42]) {
    const result = scoreMtmAttempt(attempt, answers); assertPending(result);
    assert.equal(result.rows[0].status, 'ungradable'); assert.equal(result.rows[0].earned, null);
    assert.ok(result.rows[0].issues.some(issue => issue.code === 'SUBMISSION_FORMAT'));
  }
});
test('Bài làm DS thừa ý hoặc giá trị hỏng phải chờ kiểm câu đó', () => {
  const exam = prepare([ds(), tn()]);
  for (const value of [[true, false, true, false, true], [true, false, 'Sai', false], 'Đúng']) {
    const answers = correctAnswers(exam); answers[exam.questions[0].id] = value;
    const result = score(exam, answers); assertPending(result); assert.equal(result.rows[0].status, 'ungradable');
    assert.deepEqual(result.rawTotal, fraction(5));
  }
});

test('TLN decimal chuẩn hóa dấu phẩy/chấm và số tương đương, không tự thêm dung sai', () => {
  const exam = prepare([tln()]), id = exam.questions[0].id;
  for (const answer of ['0,5', '0.50', '+00.500', ' 0.5 ']) assertOfficial(score(exam, {[id]: answer}), fraction(10));
  for (const answer of ['1/2', '0.5000001', '50%', '']) assertOfficial(score(exam, {[id]: answer}), fraction(0));
});
test('TLN rational chỉ nhận dạng số tương đương khi quy tắc có căn cứ', () => {
  const exam = prepare([{...tln(), acceptedAnswers: ['1/2'], shortRule: {verified: true, evidence: 'Khóa tổng hợp cho phép phân số tương đương', mode: 'rational'}}]), id = exam.questions[0].id;
  for (const answer of ['1/2', '2/4', '-1/-2', '0,5']) assertOfficial(score(exam, {[id]: answer}), fraction(10));
  for (const answer of ['1/0', '0.50001', '2/3']) assertOfficial(score(exam, {[id]: answer}), fraction(0));
});
test('TLN exact chỉ thu gọn khoảng trắng khi quy tắc khai báo rõ', () => {
  const base = {...tln(), acceptedAnswers: ['a b'], shortRule: {verified: true, evidence: 'Đáp án văn bản tổng hợp', mode: 'exact'}};
  const exact = prepare([base]), collapse = prepare([{...base, shortRule: {...base.shortRule, whitespace: 'collapse'}}]);
  assertOfficial(score(exact, {[exact.questions[0].id]: '  a b  '}), fraction(10));
  assertOfficial(score(exact, {[exact.questions[0].id]: 'a  b'}), fraction(0));
  assertOfficial(score(collapse, {[collapse.questions[0].id]: ' a  b '}), fraction(10));
});
test('TLN ràng buộc đơn vị, không tự bỏ hoặc chuyển đơn vị trong bài nộp', () => {
  const exam = prepare([{...tln(), acceptedAnswers: ['2 cm'], shortRule: {verified: true, evidence: 'Đáp án tổng hợp yêu cầu cm', mode: 'decimal', unit: 'cm'}}]), id = exam.questions[0].id;
  for (const answer of ['2 cm', '2,0 cm']) assertOfficial(score(exam, {[id]: answer}), fraction(10));
  for (const answer of ['2', '2 mm', '0.02 m']) assertOfficial(score(exam, {[id]: answer}), fraction(0));
  const ambiguous = prepare([{...tln(), acceptedAnswers: ['2'], shortRule: {verified: true, evidence: 'Khóa tổng hợp thiếu đơn vị', mode: 'decimal', unit: 'cm'}}]);
  assertPending(score(ambiguous, {[ambiguous.questions[0].id]: '2 cm'}));
});
test('TLN yêu cầu hai chữ số thập phân: không tự làm tròn hay bỏ điều kiện định dạng', () => {
  const exam = prepare([{...tln(), acceptedAnswers: ['2.50'], shortRule: {verified: true, evidence: 'Đáp án tổng hợp yêu cầu đúng hai chữ số thập phân', mode: 'decimal', decimalPlaces: 2}}]), id = exam.questions[0].id;
  for (const answer of ['2.50', '2,50']) assertOfficial(score(exam, {[id]: answer}), fraction(10));
  for (const answer of ['2.5', '2.500', '2.499', '2.504']) assertOfficial(score(exam, {[id]: answer}), fraction(0));
});

test('Snapshot và lượt làm bài được khóa sâu, kết quả giữ phiên bản thang chấm', () => {
  const input = source([tn(), ds(), tln()]), exam = new MtmScoringCatalog().prepare(input), attempt = lockMtmAttempt(exam, 'luot-khoa');
  const answers = correctAnswers(exam), before = scoreMtmAttempt(attempt, answers);
  assert.ok(Object.isFrozen(exam)); assert.ok(Object.isFrozen(exam.questions));
  assert.ok(Object.isFrozen(exam.questions[0].source)); assert.ok(Object.isFrozen(attempt));
  assert.throws(() => { (exam.questions[0].source as Record<string, unknown>).answer = 'B'; });
  input.questions[0].answer = 'B'; input.questions.push(tn(4));
  assert.deepEqual(scoreMtmAttempt(attempt, answers), before);
  assert.ok(JSON.stringify(before.versions).includes(MTM_SCORING_VERSION));
  assert.ok(JSON.stringify(before.versions).includes('de-v1')); assert.ok(JSON.stringify(before.versions).includes('dap-an-v1'));
});
test('Phiên bản đề mới đổi số câu không đổi điểm lịch sử hoặc snapshot cũ', () => {
  const catalog = new MtmScoringCatalog(), oldInput = source([tn(), tn(2), tn(3)]), oldExam = catalog.prepare(oldInput);
  const oldAttempt = lockMtmAttempt(oldExam, 'luot-cu'), oldAnswers = {[oldExam.questions[0].id]: 'A'}, before = scoreMtmAttempt(oldAttempt, oldAnswers);
  const newExam = catalog.prepare({...clone(oldInput), examVersion: 'de-v2', answerKeyVersion: 'dap-an-v2', questions: [tn(), tn(2), tn(3), tn(4)]});
  assert.deepEqual(newExam.pointsPerQuestion, fraction(5, 2)); assert.deepEqual(oldExam.pointsPerQuestion, fraction(10, 3));
  assert.deepEqual(scoreMtmAttempt(oldAttempt, oldAnswers), before); assertOfficial(before, fraction(10, 3));
});
test('Đổi đáp án tạo khóa mới, lượt cũ vẫn chấm theo khóa đã khóa', () => {
  const catalog = new MtmScoringCatalog(), input = source([tn()]), oldExam = catalog.prepare(input), oldAttempt = lockMtmAttempt(oldExam, 'luot-key-cu');
  const oldAnswer = {[oldExam.questions[0].id]: 'A'}, before = scoreMtmAttempt(oldAttempt, oldAnswer);
  const newExam = catalog.prepare({...clone(input), answerKeyVersion: 'dap-an-v2', questions: [{...tn(), answer: 'B'}]});
  assertOfficial(scoreMtmAttempt(oldAttempt, oldAnswer), fraction(10));
  assertOfficial(score(newExam, {[newExam.questions[0].id]: 'A'}), fraction(0));
  assert.deepEqual(scoreMtmAttempt(oldAttempt, oldAnswer), before);
});
test('Catalog từ chối tái dùng phiên bản đề cho nội dung hoặc số câu khác', () => {
  const catalog = new MtmScoringCatalog(), input = source([tn()]); catalog.prepare(input);
  assert.throws(() => catalog.prepare({...clone(input), questions: [tn(), tn(2)]}));
  assert.throws(() => catalog.prepare({...clone(input), questions: [{...tn(), prompt: 'Nội dung đã thay đổi'}]}));
  assert.doesNotThrow(() => catalog.prepare(clone(input)));
});
test('Catalog từ chối tái dùng phiên bản đáp án cho khóa hoặc quy tắc khác', () => {
  const catalog = new MtmScoringCatalog(), input = source([tln()]); catalog.prepare(input);
  assert.throws(() => catalog.prepare({...clone(input), questions: [{...tln(), acceptedAnswers: ['0.6']}]}));
  assert.throws(() => catalog.prepare({...clone(input), questions: [{...tln(), shortRule: {verified: true, evidence: 'Đã đổi quy tắc', mode: 'rational'}}]}));
});
test('Lượt khóa đi qua JSON và khôi phục vẫn giữ nguyên đề, khóa, thang và điểm lịch sử', () => {
  const exam = prepare([tn(), ds(), tln()]), attempt = lockMtmAttempt(exam, 'luot-json');
  const answers = correctAnswers(exam), before = scoreMtmAttempt(attempt, answers);
  const serialized = JSON.stringify(attempt), restored = restoreMtmAttempt(JSON.parse(serialized));
  assert.deepEqual(restored, attempt); assert.ok(Object.isFrozen(restored)); assert.ok(Object.isFrozen(restored.exam.questions[0]));
  assert.deepEqual(scoreMtmAttempt(restored, answers), before);
  assert.equal(JSON.stringify(restored), serialized);
});
test('Khôi phục từ chối sửa metadata dẫn xuất hoặc thang chấm trong snapshot', () => {
  const attempt = lockMtmAttempt(prepare([tn(), ds(), tln()]), 'luot-khong-sua');
  for (const mutate of [
    (copy: Record<string, any>) => { copy.exam.N = 1; },
    (copy: Record<string, any>) => { copy.exam.questions[0].maxScore = fraction(10); },
    (copy: Record<string, any>) => { copy.exam.dsTable[1] = fraction(9); },
    (copy: Record<string, any>) => { copy.exam.counts.TN = 100; },
    (copy: Record<string, any>) => { copy.exam.versions.rubricVersion = 'thang-la'; },
  ]) {
    const tampered = clone(attempt) as unknown as Record<string, any>; mutate(tampered);
    assert.throws(() => restoreMtmAttempt(tampered));
  }
});
test('Điểm từng câu và tổng không âm, không vượt tối đa trong tổ hợp bài làm tổng hợp', () => {
  const exam = prepare([tn(), ds(), tln(), ds(2), tn(2), tln(2)]);
  for (let mask = 0; mask < 64; mask++) {
    const correct = correctAnswers(exam), wrong = wrongAnswers(exam);
    const result = score(exam, Object.fromEntries(exam.questions.map((q, i) => [q.id, mask & (1 << i) ? correct[q.id] : wrong[q.id]])));
    assert.equal(result.pending.length, 0);
    for (const row of result.rows) {
      assert.ok(row.earned); assert.ok(BigInt(row.earned.numerator) >= 0n);
      assert.ok(BigInt(row.earned.numerator) * BigInt(row.maxScore.denominator) <= BigInt(row.maxScore.numerator) * BigInt(row.earned.denominator));
    }
    assert.ok(BigInt(result.rawTotal.numerator) >= 0n);
    assert.ok(BigInt(result.rawTotal.numerator) <= 10n * BigInt(result.rawTotal.denominator));
  }
});
test('Cụm điền đáp án hoặc điền kết quả có dấu tiếng Việt nhận TLN rồi báo thiếu quy tắc', () => {
  for (const prompt of ['Điền đáp án vào ô trống.', 'điền kết quả tính được vào ô trả lời.']) {
    const exam = prepare([{prompt, acceptedAnswers: ['0.5']}, tn()]);
    assert.equal(exam.questions[0].type, 'TLN'); assert.equal(exam.counts.UNKNOWN, 0);
    const result = score(exam, correctAnswers(exam)); assertPending(result);
    assert.ok(result.rows[0].issues.some(issue => issue.code === 'TLN_RULE'));
    assert.equal(result.rows[0].status, 'ungradable'); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('sourceContent rỗng không được dùng thay nội dung đề và không tạo điểm đúng giả', () => {
  for (const sourceContent of [{}, {questions: []}]) {
    const question = {...tn(), sourceContent}; delete question.prompt;
    const exam = prepare([question, tln()]), result = score(exam, correctAnswers(exam));
    assertPending(result); assert.equal(result.rows[0].status, 'ungradable');
    assert.ok(result.rows[0].issues.some(issue => issue.code === 'CONTENT_MISSING'));
    assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('Đóng băng đối tượng giả không thay thế việc khóa lượt và không cho chèn 1000 điểm', () => {
  const exam = prepare([tn()]);
  const forged = Object.freeze({attemptId: 'luot-gia', exam: Object.freeze({...exam, questions: [{...exam.questions[0], maxScore: {numerator: '1000', denominator: '1'}}]})});
  assert.throws(() => scoreMtmAttempt(forged, correctAnswers(exam)));
  assertOfficial(score(exam, correctAnswers(exam)), fraction(10));
});
test('TLN có tolerance hoặc trường quy tắc lạ phải chờ kiểm, không âm thầm nới đáp án', () => {
  for (const extra of [{tolerance: 0.1}, {acceptAnything: true}]) {
    const exam = prepare([{...tln(), shortRule: {verified: true, evidence: 'Quy tắc tổng hợp cần kiểm', mode: 'decimal', ...extra}}, tn()]);
    const result = score(exam, correctAnswers(exam)); assertPending(result);
    assert.ok(result.rows[0].issues.some(issue => issue.code === 'TLN_RULE'));
    assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('DS ba hoặc năm ý ghi trực tiếp trong prompt vẫn nhận DS và chờ kiểm đúng câu', () => {
  for (const labels of ['abc', 'abcde']) {
    const prompt = 'Xét các khẳng định tổng hợp:\n' + [...labels].map(label => `${label}) Nội dung ý ${label}`).join('\n');
    const exam = prepare([{prompt, answer: [true, false, true, false]}, tn()]);
    assert.equal(exam.questions[0].type, 'DS'); assert.equal(exam.counts.DS, 1); assert.equal(exam.counts.UNKNOWN, 0);
    assert.equal(exam.N, 2); assert.deepEqual(exam.pointsPerQuestion, fraction(5));
    const result = score(exam, correctAnswers(exam)); assertPending(result);
    assert.ok(result.rows[0].issues.some(issue => issue.code === 'DS_STATEMENTS'));
    assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
  }
});
test('DS prompt năm ý nhưng trường statements bốn ý phải báo mâu thuẫn cấu trúc nguồn', () => {
  const prompt = 'Xét các ý tổng hợp:\n' + [...'abcde'].map(label => `${label}) Nội dung ý ${label}`).join('\n');
  const exam = prepare([{...ds(), prompt}, tn()]), result = score(exam, correctAnswers(exam));
  assert.equal(exam.questions[0].type, 'DS'); assertPending(result);
  assert.ok(result.rows[0].issues.some(issue => issue.code === 'SOURCE_STRUCTURE_CONFLICT'));
  assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
});
test('TN prompt năm phương án nhưng trường choices bốn phương án phải báo mâu thuẫn nguồn', () => {
  const prompt = 'Chọn một đáp án tổng hợp:\n' + [...'ABCDE'].map(label => `${label}. Phương án ${label}`).join('\n');
  const exam = prepare([{...tn(), prompt}, tln()]), result = score(exam, correctAnswers(exam));
  assert.equal(exam.questions[0].type, 'TN'); assertPending(result);
  assert.ok(result.rows[0].issues.some(issue => issue.code === 'SOURCE_STRUCTURE_CONFLICT'));
  assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
});
test('DS bốn ý mang nhãn a,c,d,e không được coi là đủ bốn ý a,b,c,d', () => {
  const prompt = 'Xét các ý tổng hợp:\n' + [...'acde'].map(label => `${label}) Nội dung ý ${label}`).join('\n');
  const exam = prepare([{prompt, answer: [true, false, true, false]}, tn()]);
  const result = score(exam, correctAnswers(exam)); assertPending(result);
  assert.equal(exam.questions[0].type, 'DS');
  assert.ok(result.rows[0].issues.some(issue => issue.code === 'SOURCE_STRUCTURE_CONFLICT'));
  assert.equal(result.rows[0].earned, null); assert.deepEqual(result.rawTotal, fraction(5));
});

test('Không bỏ qua text khi có prompt, cùng nội dung ở cả hai trường không tạo xung đột giả', () => {
  const text = 'Xét các ý:\n' + [...'abcde'].map(label => `${label}) Nội dung ${label}`).join('\n');
  const exam = prepare([{...ds(), text}, tn()]), result = score(exam, correctAnswers(exam));
  assertPending(result); assert.deepEqual(result.rawTotal, fraction(5));
  assert.ok(result.rows[0].issues.some(error => error.code === 'SOURCE_STRUCTURE_CONFLICT'));
  const prompt = 'Chọn đáp án:\nA. Một\nB. Hai\nC. Ba\nD. Bốn';
  const repeated = prepare([{prompt, text: prompt, answer: 'A'}]);
  assertOfficial(score(repeated, correctAnswers(repeated)), fraction(10));
  const fallback = prepare([{prompt: '', text: prompt, answer: 'A'}]);
  assertOfficial(score(fallback, correctAnswers(fallback)), fraction(10));
});

finish({fixture: 'Dữ liệu tổng hợp, không có dữ liệu học sinh', oracle: 'Trọng số nguyên độc lập chia 2N, làm tròn số nguyên'});
