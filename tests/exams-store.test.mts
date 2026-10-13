// KT-02 + KT-01 (phần lưu): bản nháp và lịch sử trên bộ nhớ giả. Ca lỗi đọc, đầy bộ nhớ,
// bị chặn ghi, đọc lại khác, thẻ khác ghi chen, giới hạn lịch sử; và lịch sử mẫu định dạng V67
// (tests/fixtures/lich-su-v67.json) phải đọc và chấm lại được. Dữ liệu tổng hợp, không có dữ liệu học sinh.
import assert from 'node:assert/strict';
import {
  createDraft, saveDraft, readDraft, submitDraft, validateDraft, archiveSubmitted, retakeDraft, readArchive, readHistory,
  matchingStorageEvent, draftKey, HISTORY_KEY, HISTORY_LIMIT, STORAGE_PREFIX, type Draft, type Response,
} from '../src/native/exams/store';
import {PRACTICE_EXAMS, type PracticeExam} from '../src/native/exams/data';
import {resultFor} from '../src/native/exams/result';
import {historySummary} from '../src/native/exams/history-summary';
import {mistakeSummary} from '../src/native/exams/mistake-summary';
import {historyVersions} from '../src/native/exams/practice-errata';
import exactTests from '../src/native/chapters/exact-tests.json';
import practiceTests from '../src/native/chapters/practice-tests.json';
import archivedTests from '../src/native/chapters/archived-tests.json';
import fixture from './fixtures/lich-su-v67.json';
import {syntheticExam} from './fixtures/de-tong-hop.mts';
import {suite, FakeStore} from './exams-harness.mts';

const {test, finish} = suite('L');
const T0 = Date.UTC(2026, 9, 14, 1, 0, 0);
const exam: PracticeExam = (exactTests as unknown as {exam: PracticeExam}[]).find(p => p.exam.id === 'mtm-drive-g12-c3-t04-mtm-errata-v64')!.exam;
const must = <T,>(r: {ok: true; value: T} | {ok: false; message: string}): T => { if (!r.ok) throw new Error(r.message); return r.value; };
const edit = (d: Draft, id: string, answer: Response, at: number) => must(validateDraft({...d, answers: {...d.answers, [id]: answer}, updatedAt: at, revision: d.revision + 1}, exam));
function started(store: FakeStore, attemptId = 'a1') { return must(saveDraft(store, exam, must(createDraft(exam, attemptId, T0)), null)); }
const q0 = exam.questions[0].id, q1 = exam.questions[1].id;

// ---------- Khoá lưu không đổi ----------
test('Khoá lưu giữ nguyên định dạng mtm:exam:v1:<id> và mtm:exam:v1:history', () => {
  assert.equal(STORAGE_PREFIX, 'mtm:exam:v1:');
  assert.equal(draftKey(exam.id), 'mtm:exam:v1:' + exam.id);
  assert.equal(draftKey('a b/c'), 'mtm:exam:v1:a%20b%2Fc');
  assert.equal(HISTORY_KEY, 'mtm:exam:v1:history');
  assert.equal(HISTORY_LIMIT, 100);
});

// ---------- Đọc ----------
test('Đọc: không có bộ nhớ, lỗi đọc, JSON hỏng, sai cấu trúc, sai phiên bản đều báo lỗi và không ghi gì', () => {
  assert.equal((readDraft(null, exam) as {code: string}).code, 'unavailable');
  const s = new FakeStore(); s.failGet = true;
  assert.equal((readDraft(s, exam) as {code: string}).code, 'read');
  const bad = (raw: string) => { const st = new FakeStore({[draftKey(exam.id)]: raw}); const r = readDraft(st, exam); assert.equal(st.sets, 0); return r.ok ? 'ok' : r.code; };
  assert.equal(bad('{không phải json'), 'json');
  const good = must(createDraft(exam, 'a1', T0));
  assert.equal(bad(JSON.stringify({...good, extra: 1})), 'shape');
  assert.equal(bad(JSON.stringify({...good, version: 2})), 'version');
  assert.equal(bad(JSON.stringify({...good, examVersionHash: '0'.repeat(64)})), 'version');
  assert.equal(bad(JSON.stringify({...good, deadline: good.deadline + 1})), 'time');
  assert.equal(bad(JSON.stringify({...good, answers: {'cau-la': 'A'}})), 'unknown-answer');
  assert.equal(bad(JSON.stringify({...good, answers: {[q0]: 'E'}})), 'answers');
  assert.equal(bad(JSON.stringify(good)), 'ok');
});

// ---------- Ghi bản nháp ----------
test('Ghi bình thường: lưu, đọc lại khớp, ghi lặp y hệt không ghi thêm', () => {
  const s = new FakeStore(), d0 = started(s), d1 = must(saveDraft(s, exam, edit(d0, q0, 'C', T0 + 1000), d0));
  assert.deepEqual(must(readDraft(s, exam)), d1);
  const before = s.sets;
  assert.ok(saveDraft(s, exam, d1, d0).ok);
  assert.equal(s.sets, before, 'ghi lặp không được ghi thêm');
});
test('Đầy bộ nhớ (QuotaExceeded) khi lưu câu: báo lỗi "write", bản đã lưu trước đó còn nguyên', () => {
  const s = new FakeStore(), d0 = started(s), snap = s.snapshot();
  s.failSet = 'quota';
  const r = saveDraft(s, exam, edit(d0, q0, 'C', T0 + 1000), d0);
  assert.equal(r.ok, false); assert.equal((r as {code: string}).code, 'write');
  assert.equal(s.snapshot(), snap);
  s.failSet = 'none';
  assert.ok(saveDraft(s, exam, edit(d0, q0, 'C', T0 + 2000), d0).ok, 'hết đầy thì lưu tiếp được');
});
test('Bị chặn ghi (chế độ riêng tư / quyền lưu): báo lỗi "write"', () => {
  const s = new FakeStore(); s.failSet = 'denied';
  const r = saveDraft(s, exam, must(createDraft(exam, 'a1', T0)), null);
  assert.equal((r as {code: string}).code, 'write'); assert.equal(s.data.size, 0);
});
test('Đọc lại sau khi ghi khác bản vừa ghi: báo "conflict", không coi là đã lưu', () => {
  const s = new FakeStore(), d0 = started(s), other = JSON.stringify(edit(d0, q1, 'D', T0 + 500));
  s.getHook = (key, value) => key === draftKey(exam.id) && s.sets >= 2 ? other : value;
  const r = saveDraft(s, exam, edit(d0, q0, 'C', T0 + 1000), d0);
  assert.equal(r.ok, false); assert.equal((r as {code: string}).code, 'conflict');
});
test('Thẻ khác đã ghi bản mới hơn: không ghi đè, báo "conflict"', () => {
  const s = new FakeStore(), d0 = started(s);
  const otherTab = must(saveDraft(s, exam, edit(d0, q1, 'D', T0 + 500), d0));
  const snap = s.snapshot();
  const r = saveDraft(s, exam, edit(d0, q0, 'C', T0 + 1000), d0);
  assert.equal((r as {code: string}).code, 'conflict');
  assert.equal(s.snapshot(), snap);
  assert.deepEqual(must(readDraft(s, exam)), otherTab);
});
test('Không ghi đè: số lần lưu lùi, bài đã nộp, lượt làm khác', () => {
  const s = new FakeStore(), d0 = started(s), d1 = must(saveDraft(s, exam, edit(d0, q0, 'C', T0 + 1000), d0));
  assert.ok(saveDraft(s, exam, d1, d1).ok, 'ghi lại đúng bản đang có là hợp lệ');
  assert.equal(saveDraft(s, exam, {...edit(d1, q1, 'A', T0 + 2000), revision: d1.revision}, d1).ok, false);
  const sub = must(saveDraft(s, exam, must(submitDraft(exam, d1, T0 + 3000)), d1));
  assert.equal(saveDraft(s, exam, must(validateDraft({...sub, submittedAt: null, revision: sub.revision + 1, updatedAt: T0 + 4000}, exam)), sub).ok, false);
  const s2 = new FakeStore(), e0 = started(s2, 'luot-1');
  assert.equal(saveDraft(s2, exam, must(createDraft(exam, 'luot-2', T0)), e0).ok, false);
});

// ---------- Lịch sử ----------
function submitted(attemptId: string, at: number, store = new FakeStore()) {
  const d0 = started(store, attemptId);
  return {store, draft: must(saveDraft(store, exam, must(submitDraft(exam, edit(d0, q0, 'C', at), at + 1)), d0))};
}
test('Lưu lịch sử: đầy bộ nhớ thì báo lỗi, lịch sử cũ không đổi', () => {
  const {store, draft} = submitted('h1', T0 + 1000);
  must(archiveSubmitted(store, exam, draft));
  const snap = store.data.get(HISTORY_KEY);
  const second = submitted('h2', T0 + 2000);
  const s = new FakeStore({[HISTORY_KEY]: snap!}); s.failSet = 'quota';
  const r = archiveSubmitted(s, exam, second.draft);
  assert.equal((r as {code: string}).code, 'write');
  assert.equal(s.data.get(HISTORY_KEY), snap);
});
test('Lưu lịch sử: thẻ khác đổi lịch sử giữa lúc đọc và ghi thì không ghi đè', () => {
  const {draft} = submitted('h1', T0 + 1000);
  const s = new FakeStore(); let calls = 0;
  s.getHook = (key, value) => { if (key !== HISTORY_KEY) return value; calls++; return calls === 2 ? '{"version":1,"entries":[]} ' : value; };
  const r = archiveSubmitted(s, exam, draft);
  assert.equal((r as {code: string}).code, 'conflict'); assert.equal(s.data.has(HISTORY_KEY), false);
});
test('Lưu lịch sử: đủ 100 lượt thì dừng, không xoá lượt cũ', () => {
  const synth = syntheticExam(), entries = [];
  for (let i = 0; i < HISTORY_LIMIT; i++) {
    const d = must(createDraft(synth, 'x' + i, T0 + i));
    entries.push({exam: synth, draft: must(submitDraft(synth, d, T0 + i + 1))});
  }
  const raw = JSON.stringify({version: 1, entries}), s = new FakeStore({[HISTORY_KEY]: raw});
  assert.equal(must(readArchive(s)).entries.length, 100);
  const {draft} = submitted('h-moi', T0 + 1000);
  assert.equal((archiveSubmitted(s, exam, draft) as {code: string}).code, 'history-limit');
  assert.equal(s.data.get(HISTORY_KEY), raw);
});
test('Lịch sử hỏng hoặc vượt 1 MB: báo lỗi, giữ nguyên bản cũ, bản nháp vẫn đọc được', () => {
  const {store, draft} = submitted('h1', T0 + 1000);
  store.data.set(HISTORY_KEY, '{hỏng');
  const h = readHistory(store, [exam]);
  assert.equal(h.items.length, 1); assert.equal(h.items[0].draft.attemptId, draft.attemptId);
  assert.ok(h.messages.length === 1);
  assert.equal(store.data.get(HISTORY_KEY), '{hỏng');
  store.data.set(HISTORY_KEY, 'x'.repeat(1024 * 1024 + 1));
  assert.equal((readArchive(store) as {code: string}).code, 'history-limit');
});
test('Làm lại: lượt cũ vào lịch sử trước; đầy bộ nhớ khi ghi lượt mới thì bài đã nộp và lịch sử vẫn giữ', () => {
  const {store, draft} = submitted('r1', T0 + 1000);
  const ok = must(retakeDraft(store, exam, draft, 'r2', T0 + 5000));
  assert.equal(ok.attemptId, 'r2'); assert.equal(ok.submittedAt, null);
  assert.deepEqual(must(readArchive(store)).entries.map(e => e.draft.attemptId), ['r1']);
  const second = submitted('k1', T0 + 1000);
  second.store.setsBeforeFail = second.store.sets + 1; // lịch sử ghi được, lượt mới thì đầy
  const r = retakeDraft(second.store, exam, second.draft, 'k2', T0 + 5000);
  assert.equal((r as {code: string}).code, 'write');
  assert.deepEqual(must(readDraft(second.store, exam)), second.draft);
  assert.deepEqual(must(readArchive(second.store)).entries.map(e => e.draft.attemptId), ['k1']);
});
test('Sự kiện storage chỉ khớp đúng khoá đề đang làm hoặc khoá lịch sử', () => {
  const s = new FakeStore();
  assert.equal(matchingStorageEvent({key: draftKey(exam.id), storageArea: s}, s, exam.id), true);
  assert.equal(matchingStorageEvent({key: HISTORY_KEY, storageArea: s}, s, exam.id), true);
  assert.equal(matchingStorageEvent({key: null, storageArea: s}, s, exam.id), true);
  assert.equal(matchingStorageEvent({key: 'mtm:guest-notebook:v1', storageArea: s}, s, exam.id), false);
  assert.equal(matchingStorageEvent({key: draftKey(exam.id), storageArea: {}}, s, exam.id), false);
});

// ---------- Lịch sử mẫu định dạng V67 ----------
const bank = [
  ...[...practiceTests, ...exactTests].map(p => (p as unknown as {exam: PracticeExam}).exam),
  ...(archivedTests as unknown as {exam: PracticeExam}[]).map(p => p.exam).filter(e => !practiceTests.some(p => (p as {exam: {id: string}}).exam.id === e.id)),
];
const fx = fixture as unknown as {localStorage: Record<string, string>; expected: {historyAttempts: string[]; scores: Record<string, number>; inProgress: Record<string, string>}};
test('Lịch sử mẫu V67: Luyện tập đọc đủ lượt đã nộp, chấm lại đúng điểm, không ghi gì', () => {
  const s = new FakeStore(fx.localStorage), snap = s.snapshot();
  const h = readHistory(s, bank);
  assert.deepEqual(h.messages, []);
  const ids = h.items.map(i => i.draft.attemptId).sort();
  assert.deepEqual(ids, [...fx.expected.historyAttempts].sort());
  for (const item of h.items) {
    const r = resultFor(item.exam, item.draft);
    assert.ok(r && r.score.ok, 'không chấm được ' + item.draft.attemptId);
    assert.equal(r!.score.ok && r!.score.earnedMillipoints, fx.expected.scores[item.draft.attemptId], item.draft.attemptId);
  }
  assert.equal(s.snapshot(), snap); assert.equal(s.sets, 0);
});
test('Lịch sử mẫu V67: Thi thử (historySummary) thấy lượt bản gốc của đề có đính chính, điểm 1', () => {
  const s = new FakeStore(fx.localStorage);
  const sum = historySummary(s, PRACTICE_EXAMS);
  const row = sum.exams.find(e => e.examId === 'mtm-tm-modern-supplement-11-GK1-47-code157')!;
  assert.equal(row.count, 1); assert.equal(row.latestScore, 1000);
  assert.ok(readHistory(s, historyVersions(PRACTICE_EXAMS)).messages.length === 0);
});
test('Lịch sử mẫu V67: bài đang làm dở mở tiếp được và lưu tiếp được', () => {
  const s = new FakeStore(fx.localStorage);
  const g12 = bank.find(e => e.id === 'mtm-drive-g12-c1-t01-mtm-errata-v1')!;
  const d = must(readDraft(s, g12));
  assert.ok(d); assert.equal(d!.attemptId, fx.expected.inProgress[g12.id]); assert.equal(d!.submittedAt, null);
  const next = must(validateDraft({...d!, answers: {...d!.answers, [g12.questions[1].id]: 'B'}, updatedAt: d!.updatedAt + 1000, revision: d!.revision + 1}, g12));
  assert.ok(saveDraft(s, g12, next, d!).ok);
});
test('Lịch sử mẫu V67: thêm lượt mới vào lịch sử giữ nguyên từng lượt cũ', () => {
  const s = new FakeStore(fx.localStorage), before = JSON.parse(fx.localStorage[HISTORY_KEY]).entries;
  const {draft} = submitted('them-moi', T0 + 1000, s);
  must(archiveSubmitted(s, exam, draft));
  const after = JSON.parse(s.data.get(HISTORY_KEY)!).entries;
  assert.equal(after.length, before.length + 1);
  assert.deepEqual(after.slice(0, before.length), before);
});
test('Lịch sử mẫu V67: sổ câu sai đọc được, không lẫn lượt đang làm', () => {
  const s = new FakeStore(fx.localStorage), m = mistakeSummary(readHistory(s, bank));
  assert.equal(m.excluded, 0); assert.equal(m.attempts, fx.expected.historyAttempts.length);
  assert.ok(m.items.every(i => i.draft.submittedAt !== null));
});

finish();
