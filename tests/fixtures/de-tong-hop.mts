// Đề TỔNG HỢP 22 câu (12 TN + 4 Đ/S + 6 trả lời ngắn) chỉ dùng cho test. Nội dung câu là chữ giả,
// đáp án tự đặt; không phải đề thật, không xuất hiện trên web.
import type {PracticeExam, PracticeQuestion} from '../../src/native/exams/data';

const hex = (seed: string) => (seed.repeat(64)).slice(0, 64);
export function syntheticExam(): PracticeExam {
  const id = 'mtm-practice-fixture-tong-hop-v1';
  const questions: PracticeQuestion[] = [];
  const mcKey = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'] as const;
  mcKey.forEach((answer, i) => questions.push({id: `${id}-I${i + 1}`, sourceRef: `Đề tổng hợp · Câu ${i + 1}`, maxMillipoints: 250, kind: 'mc',
    choices: ['Phương án một', 'Phương án hai', 'Phương án ba', 'Phương án bốn'], answer, prompt: `Câu tổng hợp ${i + 1}: chọn phương án đúng.`}));
  const tfKeys: [boolean, boolean, boolean, boolean][] = [[true, false, true, false], [true, true, false, false], [false, false, false, true], [true, true, true, true]];
  tfKeys.forEach((answer, i) => questions.push({id: `${id}-II${i + 1}`, sourceRef: `Đề tổng hợp · Phần II · Câu ${i + 1}`, maxMillipoints: 1000, kind: 'tf', answer,
    pointsByCorrectCount: [0, 100, 250, 500, 1000], prompt: `Câu đúng/sai tổng hợp ${i + 1}.`, statements: ['Ý a tổng hợp.', 'Ý b tổng hợp.', 'Ý c tổng hợp.', 'Ý d tổng hợp.']}));
  ['12', '0.5', '3.14', '-2', '100', '7'].forEach((value, i) => questions.push({id: `${id}-III${i + 1}`, sourceRef: `Đề tổng hợp · Phần III · Câu ${i + 1}`, maxMillipoints: 500, kind: 'short',
    mode: 'numeric', acceptedAnswers: [value], prompt: `Câu trả lời ngắn tổng hợp ${i + 1}.`}));
  return {
    id, title: 'Đề tổng hợp kiểm thử (không phải đề thật)', grade: 10, period: 'GK1', durationMinutes: 45,
    sourceHash: hex('a1'), versionHash: hex('b2'), sourceRef: 'Đề tổng hợp kiểm thử', questionCount: 22,
    answerKeyVerified: true, rubricVerified: true, rubricVersion: 'MTM-FIXTURE-22-12MC-4TF-6SA-v1',
    sourceUrl: 'https://www.minhthanhmath.vn/luyen-tap', publicationVerified: true, questionDisplayVerified: true,
    sourceMaterial: {title: 'Đề tổng hợp kiểm thử', publisher: 'MTM (test)', version: 'fixture v1', locator: 'tests/fixtures/de-tong-hop.mts'},
    questions,
  };
}
