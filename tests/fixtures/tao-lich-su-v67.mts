// Tạo MỘT LẦN tệp tests/fixtures/lich-su-v67.json bằng chính mã lưu bài của bản đang chạy
// (origin/main 2e88f47, định dạng V67/V68: mtm:exam:v1:<id> và mtm:exam:v1:history).
// Tệp kết quả được commit và giữ nguyên: test sau này đọc lại để chắc lịch sử cũ vẫn mở được.
// Toàn bộ bài làm là dữ liệu tổng hợp, mốc giờ cố định; không có dữ liệu học sinh.
// Chạy lại (chỉ khi cố ý tạo mẫu mới): node scripts/run-tests.mjs tests/fixtures/tao-lich-su-v67.mts
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createDraft, saveDraft, submitDraft, archiveSubmitted, retakeDraft, validateDraft, type Draft, type Response} from '../../src/native/exams/store';
import {PRACTICE_EXAMS, type PracticeExam} from '../../src/native/exams/data';
import {practiceVersion} from '../../src/native/exams/practice-errata';
import exactTests from '../../src/native/chapters/exact-tests.json';
import {FakeStore} from '../exams-harness.mts';
import {syntheticExam} from './de-tong-hop.mts';

const T0 = Date.UTC(2026, 9, 10, 1, 0, 0); // 10/10/2026, trước V67
const exact = (id: string) => (exactTests as unknown as {exam: PracticeExam}[]).find(p => p.exam.id === id)!.exam;
const must = <T,>(r: {ok: true; value: T} | {ok: false; message: string}): T => { if (!r.ok) throw new Error(r.message); return r.value; };
const store = new FakeStore();

/** Làm bài qua đúng các hàm giao diện dùng: tạo, lưu từng câu, nộp, lưu. */
function run(exam: PracticeExam, attemptId: string, start: number, answers: Record<string, Response>, submit: boolean): Draft {
  let saved = must(saveDraft(store, exam, must(createDraft(exam, attemptId, start)), null)), clock = start;
  for (const [id, answer] of Object.entries(answers)) {
    clock += 20000;
    const next = must(validateDraft({...saved, answers: {...saved.answers, [id]: answer}, updatedAt: clock, revision: saved.revision + 1}, exam));
    saved = must(saveDraft(store, exam, next, saved));
  }
  if (submit) saved = must(saveDraft(store, exam, must(submitDraft(exam, saved, clock + 60000)), saved));
  return saved;
}
const key = (exam: PracticeExam, i: number) => (exam.questions[i] as {answer: Response}).answer;

// 1) Đề tổng hợp: làm đúng hết (10 điểm), rồi "làm lại" để lượt cũ vào kho lịch sử.
const synth = syntheticExam();
const synthAll: Record<string, Response> = {};
for (const [i, q] of synth.questions.entries()) synthAll[q.id] = q.kind === 'short' ? q.acceptedAnswers[0] : key(synth, i);
const s1 = run(synth, 'fixture-synth-1', T0, synthAll, true);
must(retakeDraft(store, synth, s1, 'fixture-synth-2', T0 + 3600000)); // lượt 2 mới tạo, chưa làm

// 2) Đề V53 Toán 10 C1 Bài 2: 4 câu TN đầu đúng + II.1 đúng cả 4 ý = 2 điểm; nộp và chép vào kho lịch sử.
const g10 = exact('mtm-drive-g10-c1-t02-mtm-errata-v1');
const g10a: Record<string, Response> = {};
for (let i = 0; i < 4; i++) g10a[g10.questions[i].id] = key(g10, i);
g10a[g10.questions[12].id] = key(g10, 12);
const g10d = run(g10, 'fixture-g10-t02-1', T0 + 86400000, g10a, true);
must(archiveSubmitted(store, g10, g10d));

// 3) Đề V53 Toán 11 C1 Bài 1: nộp, nằm ở khoá nháp (chưa làm lại): III.1 đúng + 1 câu "1/2" sai định dạng = 0,5 điểm.
const g11 = exact('mtm-drive-g11-c1-t01-mtm-errata-v1');
const g11short = g11.questions[16] as {id: string; acceptedAnswers: string[]};
run(g11, 'fixture-g11-t01-1', T0 + 2 * 86400000, {[g11short.id]: g11short.acceptedAnswers[0], [g11.questions[17].id]: '1/2'}, true);

// 4) Đề V53 Toán 12 C1 Bài 1: đang làm dở (chưa nộp), 2 câu.
const g12 = exact('mtm-drive-g12-c1-t01-mtm-errata-v1');
run(g12, 'fixture-g12-t01-1', T0 + 3 * 86400000, {[g12.questions[0].id]: key(g12, 0), [g12.questions[12].id]: [true, null, false, null]}, false);

// 5) Thi thử bản gốc của đề có đính chính v37 (lượt cũ dùng khoá gốc): II-2 đúng 4 ý = 1 điểm.
const base = PRACTICE_EXAMS.find(e => e.id === 'mtm-tm-modern-supplement-11-GK1-47-code157')!;
if (practiceVersion(base) === base) throw new Error('đề không còn bản đính chính');
const tf = base.questions.findIndex(q => q.id === 'II-2');
const baseDraft = run(base, 'fixture-thi-thu-157-goc', T0 + 4 * 86400000, {'II-2': key(base, tf)}, true);
must(archiveSubmitted(store, base, baseDraft));

const localStorage = Object.fromEntries([...store.data.entries()].sort());
const out = {
  note: 'Mẫu localStorage tổng hợp theo định dạng lưu bài V67/V68 (mtm:exam:v1:*). Tạo bằng tests/fixtures/tao-lich-su-v67.mts trên mã 2e88f47. KHÔNG sửa tay; không chứa dữ liệu học sinh.',
  createdFromCommit: '2e88f47',
  expected: {
    historyAttempts: ['fixture-synth-1', 'fixture-g10-t02-1', 'fixture-g11-t01-1', 'fixture-thi-thu-157-goc'],
    scores: {'fixture-synth-1': 10000, 'fixture-g10-t02-1': 2000, 'fixture-g11-t01-1': 500, 'fixture-thi-thu-157-goc': 1000},
    inProgress: {'mtm-drive-g12-c1-t01-mtm-errata-v1': 'fixture-g12-t01-1', [synth.id]: 'fixture-synth-2'},
  },
  localStorage,
};
const root = process.env.MTM_ROOT ?? process.cwd();
writeFileSync(join(root, 'tests/fixtures/lich-su-v67.json'), JSON.stringify(out, null, 1) + '\n');
console.log('Đã ghi tests/fixtures/lich-su-v67.json với', Object.keys(localStorage).length, 'khoá');
