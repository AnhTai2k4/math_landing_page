/** Bộ chấm xác định theo QUY-TAC-CHAM-DIEM-MTM.md ngày 16/10/2026.
 * Chế độ MTM chia đều theo câu lớn, không phải thang điểm thi chính thức.
 * Luồng BTVN chọn qua rubricVersion; không I/O, không gọi mô hình hay mạng. */
export const MTM_SCORING_VERSION = 'MTM-EQUAL-QUESTION-10-20261016-v1';
export type MtmType = 'TN' | 'DS' | 'TLN' | 'UNKNOWN';
export type Fraction = Readonly<{numerator: string; denominator: string}>;
export type MtmIssue = Readonly<{code: string; message: string; questionId?: string}>;
type Json = null | boolean | number | string | Json[] | {[key: string]: Json};
type JsonObject = {[key: string]: Json};
export type MtmVersions = Readonly<{
  examId: string; examVersion: string; answerKeyVersion: string; rubricVersion: string;
}>;
export type MtmShortRule = Readonly<{
  verified: true; evidence: string; mode: 'exact' | 'decimal' | 'rational';
  whitespace?: 'trim' | 'collapse'; unit?: string; decimalPlaces?: number;
}>;
export type MtmQuestion = Readonly<{
  id: string; type: MtmType; source: Readonly<JsonObject> | Json;
  sourceRef: string; maxScore: Fraction; rule: string;
  issues: readonly MtmIssue[]; choices: readonly string[]; statements: readonly string[];
}>;
export type MtmExamSnapshot = Readonly<{
  versions: MtmVersions; source: Readonly<JsonObject>;
  counts: Readonly<Record<MtmType, number>>; N: number;
  structure: string | null; allocationProvisional: boolean;
  pointsPerQuestion: Fraction | null; maxTotal: Fraction;
  sections: readonly Readonly<{type: MtmType; count: number; maxScore: Fraction}>[];
  questions: readonly MtmQuestion[]; dsTable: readonly Fraction[];
  issues: readonly MtmIssue[];
}>;
export type MtmAttempt = Readonly<{attemptId: string; exam: MtmExamSnapshot}>;
export type MtmScoreRow = Readonly<{
  id: string; type: MtmType; status: 'graded' | 'ungradable';
  earned: Fraction | null; maxScore: Fraction; correctCount: number | null;
  issues: readonly MtmIssue[];
}>;
export type MtmScore = Readonly<{
  attemptId: string; versions: MtmVersions; rows: readonly MtmScoreRow[];
  rawTotal: Fraction; displayTotal: string;
  officialTotal: Fraction | null; officialDisplayTotal: string | null;
  pending: readonly MtmIssue[];
  sections: readonly Readonly<{type: MtmType; rawTotal: Fraction; maxScore: Fraction}>[];
}>;

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && !!v.trim();
const own = (v: object, key: string) => Object.hasOwn(v, key);
const TYPES: readonly MtmType[] = ['TN', 'DS', 'TLN', 'UNKNOWN'];
const lockedAttempts = new WeakSet<MtmAttempt>();
const DS_WEIGHTS = [[0n, 1n], [1n, 10n], [1n, 4n], [1n, 2n], [1n, 1n]] as const;
const issue = (code: string, message: string, questionId?: string): MtmIssue =>
  questionId === undefined ? {code, message} : {code, message, questionId};

/** Dữ liệu lưu được bằng JSON. Không giữ tham chiếu tới bản đề đang biên tập. */
function copyJson(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Array.from(value, x => x === undefined ? null : copyJson(x));
  if (record(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return Object.fromEntries(Object.entries(value).filter(([, x]) => x !== undefined)
      .map(([key, x]) => [key, copyJson(x)]));
  }
  throw new TypeError('Đầu vào phải là dữ liệu JSON hữu hạn, không chứa hàm hoặc đối tượng đặc biệt.');
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort()
    .map(k => JSON.stringify(k) + ':' + canonical(value[k] as Json)).join(',') + '}';
  return JSON.stringify(value);
}
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  while (b) [a, b] = [b, a % b];
  return a;
}
export function mtmFraction(n: bigint, d = 1n): Fraction {
  if (d === 0n) throw new RangeError('Mẫu số phải khác 0.');
  if (d < 0n) { n = -n; d = -d; }
  const g = gcd(n, d);
  return Object.freeze({numerator: String(n / g), denominator: String(d / g)});
}
const ZERO = mtmFraction(0n), TEN = mtmFraction(10n);
const add = (a: Fraction, b: Fraction) => mtmFraction(
  BigInt(a.numerator) * BigInt(b.denominator) + BigInt(b.numerator) * BigInt(a.denominator),
  BigInt(a.denominator) * BigInt(b.denominator));
const multiply = (a: Fraction, n: bigint, d = 1n) =>
  mtmFraction(BigInt(a.numerator) * n, BigInt(a.denominator) * d);

/** ROUND_HALF_UP, kể cả điểm đúng giữa hai mức. Không đổi qua Number. */
export function roundMtmTotal(value: Fraction): string {
  const n = BigInt(value.numerator), d = BigInt(value.denominator);
  if (d <= 0n) throw new RangeError('Mẫu số phải dương.');
  const absolute = n < 0n ? -n : n;
  const cents = (absolute * 200n + d) / (2n * d);
  return (n < 0n && cents ? '-' : '') + String(cents / 100n) + '.' + String(cents % 100n).padStart(2, '0');
}

function decimal(value: string): Fraction | null {
  if (value.length > 1024 || !/^[+-]?\d+(?:[.,]\d+)?$/.test(value)) return null;
  const [whole, part = ''] = value.replace(/^[+-]/, '').replace(',', '.').split('.');
  return mtmFraction(BigInt(whole + part) * (value.startsWith('-') ? -1n : 1n), 10n ** BigInt(part.length));
}
function normalizedShort(value: unknown, rule: MtmShortRule): string | null {
  if (typeof value !== 'string' || value.length > 1024) return null;
  let raw = value.trim();
  if (rule.whitespace === 'collapse') raw = raw.replace(/\s+/gu, ' ');
  if (rule.unit !== undefined) {
    if (!raw.endsWith(rule.unit)) return null;
    raw = raw.slice(0, -rule.unit.length).trim();
  }
  if (!raw) return null;
  if (rule.decimalPlaces !== undefined) {
    const places = rule.decimalPlaces;
    if (!(places === 0 ? /^[+-]?\d+$/ : new RegExp('^[+-]?\\d+[.,]\\d{' + places + '}$')).test(raw)) return null;
  }
  if (rule.mode === 'exact') return raw;
  let number: Fraction | null;
  if (rule.mode === 'rational' && /^[+-]?\d+\/[+-]?\d+$/.test(raw)) {
    const [n, d] = raw.split('/').map(BigInt);
    number = d === 0n ? null : mtmFraction(n, d);
  } else number = decimal(raw);
  return number === null ? null : number.numerator + '/' + number.denominator;
}

function labelledLines(prompt: string, alphabet: string): {values: string[]; validLabels: boolean} {
  const matches = [...prompt.matchAll(new RegExp('(?:^|\\n)\\s*([' + alphabet + '])[).:]\\s+([^\\n]+)', 'g'))];
  // Giữ cả trường hợp DS ba/năm ý để đánh dấu đúng loại, không bỏ câu khỏi N.
  return {values: matches.map(m => m[2]), validLabels: matches.map(m => m[1]).join('') === alphabet.slice(0, matches.length)};
}
function contentType(q: Record<string, unknown>): {type: MtmType; choices: string[]; statements: string[]; conflict: boolean} {
  const contents = [q.prompt, q.text].filter((value): value is string => typeof value === 'string');
  const parsedChoices = contents.map(value => labelledLines(value, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'));
  const parsedStatements = contents.map(value => labelledLines(value, 'abcdefghijklmnopqrstuvwxyz'));
  const inlineChoices = parsedChoices.find(part => part.values.length) ?? {values: [], validLabels: true};
  const inlineStatements = parsedStatements.find(part => part.values.length) ?? {values: [], validLabels: true};
  const choices = Array.isArray(q.choices) ? q.choices : inlineChoices.values;
  const statements = Array.isArray(q.statements) ? q.statements : inlineStatements.values;
  // Sự hiện diện của trường cấu trúc, kể cả cấu trúc lỗi, giữ nguyên câu trong N.
  const tn = own(q, 'choices') || inlineChoices.values.length > 0;
  const ds = own(q, 'statements') || inlineStatements.values.length > 0;
  const tln = own(q, 'shortRule') || q.responseFormat === 'short' ||
    contents.some(value => /(?:^|[^\p{L}\p{N}_])(?:trả lời ngắn|điền (?:đáp án|kết quả))(?![\p{L}\p{N}_])/iu.test(value));
  const candidates = [tn ? 'TN' : '', ds ? 'DS' : '', tln ? 'TLN' : ''].filter(Boolean);
  const conflict = parsedChoices.some(part => !part.validLabels || part.values.length > 0 && part.values.length !== choices.length) ||
    parsedStatements.some(part => !part.validLabels || part.values.length > 0 && part.values.length !== statements.length);
  return {type: candidates.length === 1 ? candidates[0] as MtmType : 'UNKNOWN', conflict,
    choices: choices as string[], statements: statements as string[]};
}
const ruleDescriptions: Record<MtmType, string> = {
  TN: 'Một đáp án khớp khóa: p; sai, trống hoặc nhiều lựa chọn: 0.',
  DS: 'k là số ý khớp khóa; hệ số k=0..4: 0; 1/10; 1/4; 1/2; 1. Ý trống không khớp.',
  TLN: 'Khớp danh sách theo shortRule đã xác minh: p; sai hoặc trống: 0. Không dung sai tự đặt.',
  UNKNOWN: 'Chưa xác định được loại câu từ cấu trúc và nội dung; cần kiểm.',
};

function compile(source: JsonObject): MtmExamSnapshot {
  for (const key of ['examId', 'examVersion', 'answerKeyVersion', 'sourceRef']) {
    if (!text(source[key])) throw new TypeError('Thiếu định danh bắt buộc: ' + key);
  }
  if (!Array.isArray(source.questions)) throw new TypeError('questions phải là danh sách câu lớn.');
  if (source.rubricVersion !== undefined && source.rubricVersion !== MTM_SCORING_VERSION)
    throw new TypeError('Không hỗ trợ phiên bản thang chấm này.');
  const versions: MtmVersions = {examId: source.examId as string, examVersion: source.examVersion as string,
    answerKeyVersion: source.answerKeyVersion as string, rubricVersion: MTM_SCORING_VERSION};
  const issues: MtmIssue[] = [];
  if (source.sourceComplete !== true) issues.push(issue('SOURCE_INCOMPLETE', 'Chưa xác minh đủ trang và đủ câu nguồn.'));
  if (source.answerKeyVerified !== true) issues.push(issue('KEY_UNVERIFIED', 'Khóa đáp án chưa được xác minh.'));
  if (source.issues !== undefined) {
    if (!Array.isArray(source.issues) || !source.issues.every(text)) issues.push(issue('INVALID_ISSUES', 'Danh sách lỗi nguồn không hợp lệ.'));
    else source.issues.forEach(reason => issues.push(issue('SOURCE_REVIEW', reason as string)));
  }
  const N = source.questions.length, p = N ? mtmFraction(10n, BigInt(N)) : null;
  if (!N) issues.push(issue('EMPTY_EXAM', 'Đề rỗng, chưa có câu để phân bổ điểm.'));
  const counts: Record<MtmType, number> = {TN: 0, DS: 0, TLN: 0, UNKNOWN: 0};
  const questions = Array.from(source.questions, (raw, index): MtmQuestion => {
    const id = 'mtm:' + encodeURIComponent(versions.examId) + ':' + encodeURIComponent(versions.examVersion) + ':' + (index + 1);
    const q = record(raw) ? raw : {};
    const found = contentType(q), errors: MtmIssue[] = [];
    const fail = (code: string, message: string) => errors.push(issue(code, message, id));
    counts[found.type]++;
    if (found.type === 'UNKNOWN') fail('AMBIGUOUS_TYPE', 'Nội dung/cấu trúc thiếu bằng chứng hoặc chứa nhiều loại câu mâu thuẫn.');
    if (found.conflict) fail('SOURCE_STRUCTURE_CONFLICT', 'Số ý/phương án hoặc thứ tự nhãn trong nội dung không khớp dữ liệu câu.');
    const hinted = ({mc: 'TN', tf: 'DS', short: 'TLN', TN: 'TN', DS: 'DS', TLN: 'TLN'} as Record<string, string>)[String(q.kind)];
    if (q.kind !== undefined && (hinted === undefined || hinted !== found.type))
      fail('TYPE_CONFLICT', 'Nhãn loại câu không khớp cấu trúc nhận diện, cần kiểm nguồn.');
    const content = q.sourceContent;
    const hasSourceContent = record(content) && Array.isArray(content.questions) && content.questions.length > 0 &&
      Array.from(content.questions).every(segment => record(segment) && (text(segment.path) || text(segment.text)));
    if (!text(q.prompt) && !text(q.text) && !hasSourceContent)
      fail('CONTENT_MISSING', 'Thiếu nội dung câu hoặc tham chiếu các mảnh nội dung nguồn.');
    if (q.answerConflict === true) fail('KEY_CONFLICT', 'Đáp án được đánh dấu mâu thuẫn.');
    if (q.answerVerified === false || source.answerKeyVerified !== true)
      fail('KEY_UNVERIFIED', 'Đáp án câu chưa được xác minh.');
    if (q.issues !== undefined) {
      if (!Array.isArray(q.issues) || !q.issues.every(text)) fail('INVALID_ISSUES', 'Danh sách lỗi câu không hợp lệ.');
      else q.issues.forEach(reason => fail('QUESTION_REVIEW', reason as string));
    }
    if (found.type === 'TN') {
      if ((own(q, 'choices') && !Array.isArray(q.choices)) || found.choices.length < 2 || found.choices.length > 26 || !Array.from(found.choices).every(text) ||
          new Set(found.choices).size !== found.choices.length)
        fail('TN_CHOICES', 'TN cần các phương án phân biệt, không rỗng, từ 2 đến 26 phương án.');
      if (typeof q.answer !== 'string' || !/^[A-Z]$/.test(q.answer) || q.answer.charCodeAt(0) - 65 >= found.choices.length)
        fail('TN_KEY', 'Thiếu hoặc sai khóa một đáp án TN.');
      if (own(q, 'acceptedAnswers')) fail('KEY_CONFLICT', 'TN chứa thêm khóa trả lời ngắn.');
    } else if (found.type === 'DS') {
      if ((own(q, 'statements') && !Array.isArray(q.statements)) || found.statements.length !== 4 || !Array.from(found.statements).every(text))
        fail('DS_STATEMENTS', 'DS phải có đúng bốn ý a, b, c, d có nội dung.');
      if (!Array.isArray(q.answer) || q.answer.length !== 4 || !Array.from(q.answer).every(v => typeof v === 'boolean'))
        fail('DS_KEY', 'DS cần đúng bốn đáp án boolean đã xác minh.');
      if (own(q, 'acceptedAnswers')) fail('KEY_CONFLICT', 'DS chứa thêm khóa trả lời ngắn.');
    } else if (found.type === 'TLN') {
      const r = q.shortRule;
      if (!record(r) || Object.keys(r).some(key => !['verified', 'evidence', 'mode', 'whitespace', 'unit', 'decimalPlaces'].includes(key)) ||
          r.verified !== true || !text(r.evidence) || !['exact', 'decimal', 'rational'].includes(String(r.mode)) ||
          (r.whitespace !== undefined && !['trim', 'collapse'].includes(String(r.whitespace))) ||
          (r.unit !== undefined && (!text(r.unit) || r.unit !== r.unit.trim())) ||
          (r.decimalPlaces !== undefined && (r.mode !== 'decimal' || !Number.isSafeInteger(r.decimalPlaces) ||
            (r.decimalPlaces as number) < 0 || (r.decimalPlaces as number) > 100))) {
        fail('TLN_RULE', 'Thiếu quy tắc chấp nhận TLN đã xác minh hoặc quy tắc định dạng không hợp lệ.');
      } else if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length ||
          !Array.from(q.acceptedAnswers).every(a => text(a) && normalizedShort(a, r as MtmShortRule) !== null)) {
        fail('TLN_KEY', 'Thiếu đáp án TLN hoặc đáp án vi phạm quy tắc đơn vị/định dạng đã chốt.');
      }
      if (own(q, 'answer')) fail('KEY_CONFLICT', 'TLN có khóa answer riêng ngoài acceptedAnswers, cần đối chiếu.');
    }
    return {id, type: found.type, source: raw, sourceRef: text(q.sourceRef) ? q.sourceRef : source.sourceRef as string,
      maxScore: p!, rule: ruleDescriptions[found.type], issues: errors, choices: found.choices, statements: found.statements};
  });
  return freeze({versions, source, counts, N,
    structure: N && !counts.UNKNOWN ? TYPES.filter(t => t !== 'UNKNOWN' && counts[t]).join('+') : null,
    allocationProvisional: source.sourceComplete !== true || counts.UNKNOWN > 0,
    pointsPerQuestion: p, maxTotal: N ? TEN : ZERO,
    sections: TYPES.filter(type => counts[type]).map(type => ({type, count: counts[type], maxScore: multiply(p!, BigInt(counts[type]))})),
    questions, dsTable: p ? DS_WEIGHTS.map(([n, d]) => multiply(p, n, d)) : [], issues});
}

/** Sổ phiên bản chỉ trong bộ nhớ bản thử. Khi nối thật phải lưu sổ và snapshot
 * bất biến ở server trong cùng giao dịch tạo lượt. Không thay thế khóa DB. */
export class MtmScoringCatalog {
  private readonly exams = new Map<string, string>();
  private readonly keys = new Map<string, string>();
  prepare(input: unknown): MtmExamSnapshot {
    const source = copyJson(input);
    if (!record(source)) throw new TypeError('Đề phải là đối tượng JSON.');
    const snapshot = compile(source as JsonObject);
    const examKey = JSON.stringify([snapshot.versions.examId, snapshot.versions.examVersion]);
    const answerKey = JSON.stringify([snapshot.versions.examId, snapshot.versions.answerKeyVersion]);
    const answerFields = new Set(['answer', 'acceptedAnswers', 'shortRule', 'answerVerified', 'answerConflict']);
    const examContent = Object.fromEntries(Object.entries(source).filter(([k]) =>
      !['answerKeyVersion', 'answerKeyVerified', 'rubricVersion', 'questions'].includes(k)));
    examContent.questions = (source.questions as Json[]).map(q => record(q)
      ? Object.fromEntries(Object.entries(q).filter(([k]) => !answerFields.has(k))) : q);
    const keyContent: Json = {answerKeyVerified: source.answerKeyVerified ?? null,
      questions: (source.questions as Json[]).map(q => record(q)
        ? Object.fromEntries(Object.entries(q).filter(([k]) => answerFields.has(k))) : null)};
    const examLock = canonical(examContent as Json), keyLock = canonical(keyContent);
    if (this.exams.has(examKey) && this.exams.get(examKey) !== examLock)
      throw new Error('Nội dung hoặc số câu đã đổi, phải tạo examVersion mới.');
    if (this.keys.has(answerKey) && this.keys.get(answerKey) !== keyLock)
      throw new Error('Đáp án hoặc quy tắc chấp nhận đã đổi, phải tạo answerKeyVersion mới.');
    this.exams.set(examKey, examLock); this.keys.set(answerKey, keyLock);
    return snapshot;
  }
}

export function lockMtmAttempt(exam: MtmExamSnapshot, attemptId: string): MtmAttempt {
  if (!text(attemptId)) throw new TypeError('Thiếu mã lượt làm bài.');
  // Biên dịch lại từ nguồn khóa, không tin điểm/metadata dẫn xuất do caller đưa vào.
  const locked = new MtmScoringCatalog().prepare(exam.source);
  if (canonical(copyJson(locked)) !== canonical(copyJson(exam))) throw new Error('Snapshot đề không nhất quán.');
  const attempt = freeze({attemptId, exam: locked});
  lockedAttempts.add(attempt);
  return attempt;
}

/** Khôi phục JSON đáng tin cậy đã lưu; kiểm lại toàn bộ dữ liệu dẫn xuất.
 * Xác thực quyền ghi/chống sửa snapshot tại kho lưu là việc tích hợp server. */
export function restoreMtmAttempt(input: unknown): MtmAttempt {
  if (!record(input) || !record(input.exam)) throw new TypeError('Snapshot lượt không hợp lệ.');
  return lockMtmAttempt(input.exam as MtmExamSnapshot, input.attemptId as string);
}

export function scoreMtmAttempt(attempt: MtmAttempt, answers: unknown): MtmScore {
  if (!lockedAttempts.has(attempt)) throw new TypeError('Cần khóa hoặc khôi phục lượt hợp lệ trước khi chấm.');
  const exam = attempt.exam;
  const pending: MtmIssue[] = [...exam.issues];
  let submitted: Record<string, unknown> = {};
  const invalidSubmission = !record(answers);
  if (invalidSubmission) pending.push(issue('SUBMISSION_FORMAT', 'Bài làm phải là bảng đáp án theo ID câu.'));
  else submitted = answers;
  const known = new Set(exam.questions.map(q => q.id));
  for (const id of Object.keys(submitted)) if (!known.has(id)) pending.push(issue('UNKNOWN_RESPONSE', 'Bài làm có ID không thuộc phiên bản đề đã khóa.', id));
  const rows = exam.questions.map((q): MtmScoreRow => {
    const errors = [...q.issues];
    const fail = (code: string, message: string) => errors.push(issue(code, message, q.id));
    if (invalidSubmission) fail('SUBMISSION_FORMAT', 'Chưa đọc được bảng bài làm, không thể coi câu này là sai hoặc bỏ trống.');
    const answer = own(submitted, q.id) ? submitted[q.id] : undefined;
    const blank = answer === undefined || answer === null || typeof answer === 'string' && !answer.trim();
    let earned = ZERO, correctCount: number | null = null;
    if (!errors.length && !blank) {
      const source = q.source as JsonObject;
      if (q.type === 'TN') {
        // Chọn nhiều đáp án ở TN là 0 theo quy tắc, không biến thành lỗi của đề.
        const choice = Array.isArray(answer) && answer.length === 1 ? answer[0] : answer;
        earned = typeof choice === 'string' && choice === source.answer ? q.maxScore : ZERO;
      } else if (q.type === 'DS') {
        if (!Array.isArray(answer) || answer.length > 4 || !Array.from(answer).every(x => x === null || x === undefined || typeof x === 'boolean'))
          fail('DS_RESPONSE', 'Bài làm DS phải có tối đa bốn giá trị boolean hoặc ý bỏ trống.');
        else {
          const key = source.answer as boolean[];
          correctCount = Array.from({length: 4}, (_, i) => typeof answer[i] === 'boolean' && answer[i] === key[i]).filter(Boolean).length;
          earned = exam.dsTable[correctCount];
        }
      } else if (q.type === 'TLN') {
        if (typeof answer !== 'string') fail('TLN_RESPONSE', 'Bài làm TLN phải là văn bản.');
        else {
          const rule = source.shortRule as unknown as MtmShortRule;
          const normalized = normalizedShort(answer, rule);
          earned = normalized !== null && (source.acceptedAnswers as string[]).some(a => normalizedShort(a, rule) === normalized) ? q.maxScore : ZERO;
        }
      }
    } else if (!errors.length && q.type === 'DS') correctCount = 0;
    pending.push(...errors);
    return {id: q.id, type: q.type, status: errors.length ? 'ungradable' : 'graded',
      earned: errors.length ? null : earned, maxScore: q.maxScore, correctCount, issues: errors};
  });
  const rawTotal = rows.reduce((sum, row) => add(sum, row.earned ?? ZERO), ZERO);
  return freeze({attemptId: attempt.attemptId, versions: exam.versions, rows, rawTotal,
    displayTotal: roundMtmTotal(rawTotal), officialTotal: pending.length ? null : rawTotal,
    officialDisplayTotal: pending.length ? null : roundMtmTotal(rawTotal), pending,
    sections: exam.sections.map(s => ({type: s.type, maxScore: s.maxScore,
      rawTotal: rows.filter(r => r.type === s.type).reduce((sum, row) => add(sum, row.earned ?? ZERO), ZERO)}))});
}
