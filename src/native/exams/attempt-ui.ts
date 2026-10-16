// Quy tắc hiển thị thuần cho màn làm bài (không React, không đọc/ghi bộ nhớ) để test được.
// Giữ parser cũ; định dạng MTM mới dùng trực tiếp normalizeMtmShort của bộ chấm.
import {normalizedShort} from './assessment';
import {isAnswered, type Answers} from './store';
import type {PracticeExam, PracticeQuestion} from './data';
import {examSections} from './flexible-profile';
import {normalizeMtmShort} from './mtm-scoring';
import {questionShortFormat,validPublicShortFormat,type PublicShortFormat} from './short-format';

export type ShortStatus = 'empty' | 'valid' | 'invalid';

/** Trạng thái định dạng, không kiểm đúng/sai đáp án. MTM dùng đúng parser của engine;
 * mode exact cũ giữ cách hiểu có chữ là hợp lệ. */
export function shortAnswerStatus(mode: string, value: unknown, format?: PublicShortFormat): ShortStatus {
  if (typeof value !== 'string' || !value.trim()) return 'empty';
  if (validPublicShortFormat(format, mode)) return normalizeMtmShort(value, format) === null ? 'invalid' : 'valid';
  if (mode === 'exact') return 'valid';
  return normalizedShort(mode, value) === null ? 'invalid' : 'valid';
}

/** Lời báo ngay dưới ô khi nhập sai định dạng; không lộ đáp án, không sửa hộ bài làm. */
export function shortFormatMessage(mode: string, format?: PublicShortFormat): string {
  if (validPublicShortFormat(format, mode)) return 'Chưa đúng định dạng. ' + shortHelpMessage(mode, format) + ' Câu trả lời vẫn được giữ để em sửa. Nếu nộp nguyên câu trả lời này, câu này được 0 điểm.';
  return mode === 'rational'
    ? 'Chưa đúng định dạng: chỉ nhận số nguyên, số thập phân hoặc phân số dạng a/b (ví dụ -3/4). Nếu nộp như vậy, câu này được 0 điểm.'
    : 'Chưa đúng định dạng: câu này chỉ nhận số thập phân, ví dụ 0,5 hoặc -2,75 (không nhận phân số như 1/2 hay biểu thức). Nếu nộp như vậy, câu này được 0 điểm.';
}

/** Yêu cầu nhập không chứa một giá trị đáp án cụ thể. */
export function shortHelpMessage(mode: string, format?: PublicShortFormat): string {
  if (validPublicShortFormat(format, mode)) return [
    format.mode === 'exact' ? 'Nhập chính xác theo đề, có phân biệt chữ hoa và chữ thường.' :
      format.mode === 'rational' ? 'Nhập số nguyên, số thập phân hoặc phân số dạng a/b.' :
      format.decimalPlaces === 0 ? 'Nhập số nguyên, không có chữ số thập phân.' :
      format.decimalPlaces !== undefined ? 'Nhập đúng ' + format.decimalPlaces + ' chữ số sau dấu thập phân, dùng dấu phẩy hoặc dấu chấm.' :
      'Nhập số nguyên hoặc số thập phân bằng dấu phẩy hoặc dấu chấm.',
    format.unit === undefined ? (format.mode === 'exact' ? '' : 'Không nhập đơn vị.') : 'Ghi đơn vị ' + format.unit + ' ở cuối, cách số hoặc nội dung bằng một khoảng trắng.',
    format.whitespace === 'collapse' ? 'Các khoảng trắng liên tiếp được hiểu là một khoảng trắng.' : 'Khoảng trắng ở đầu và cuối được bỏ qua.',
  ].filter(Boolean).join(' ');
  return mode === 'numeric' ? 'Nhập số thập phân bằng dấu phẩy hoặc dấu chấm; không nhập biểu thức hoặc phân số.' :
    mode === 'rational' ? 'Nhập số nguyên, số thập phân hoặc phân số, ví dụ -3/4; không nhập đơn vị hay biểu thức.' :
    'Nhập câu trả lời chính xác theo yêu cầu đề (phân biệt chữ hoa/thường).';
}

/** Một dấu với đúng ba chữ số phía sau có thể bị nhầm với cách tách hàng nghìn. */
export function shortHasAmbiguousSeparator(mode:string,value:unknown,format?:PublicShortFormat):boolean {
  if((mode!=='numeric'&&mode!=='rational')||typeof value!=='string')return false;
  let raw=value.trim();
  if(validPublicShortFormat(format,mode)&&format.unit!==undefined&&raw.endsWith(format.unit))raw=raw.slice(0,-format.unit.length).trim();
  return /^[+-]?\d+[.,]\d{3}$/.test(raw);
}

/** Explain the existing numeric parser without rewriting the response or key.
 * Keep decimal digits as text so long answers never pass through Number. */
export function shortInterpretationMessage(mode:string,value:unknown,format?:PublicShortFormat):string {
  if(validPublicShortFormat(format,mode)){
    const normalized=normalizeMtmShort(value,format);
    if(normalized===null||typeof value!=='string')return '';
    let raw=value.trim();
    if(format.whitespace==='collapse')raw=raw.replace(/\s+/gu,' ');
    if(format.unit!==undefined)raw=raw.slice(0,-format.unit.length).trim();
    let interpreted=format.mode==='rational'?normalized.replace(/\/1$/,''):normalized,clarification='';
    if(format.mode==='decimal'){
      const [whole,part='']=normalizedShort('numeric',raw)!.split('.');
      const digits=format.decimalPlaces===undefined?part:part.padEnd(format.decimalPlaces,'0');
      interpreted=whole+(digits?','+digits:'');
      const canonical=whole+(part?','+part:'');
      if(shortHasAmbiguousSeparator(mode,value,format)&&canonical!==interpreted)clarification=', tức '+canonical+(format.unit===undefined?'':' '+format.unit);
    }
    const separatorNote=format.mode!=='exact'&&(format.decimalPlaces===undefined||shortHasAmbiguousSeparator(mode,value,format))&&/[.,]/.test(raw)?' Dấu chấm và dấu phẩy là dấu thập phân, không tách hàng nghìn.':'';
    return `Máy đang hiểu là ${interpreted}${format.unit===undefined?'':' '+format.unit}${clarification}.${separatorNote}`;
  }
  if((mode!=='numeric'&&mode!=='rational')||typeof value!=='string'||!value.trim())return '';
  const normalized=normalizedShort(mode,value);
  if(normalized===null)return '';
  const interpreted=mode==='rational'?normalized.replace(/\/1$/,''):normalized.replace('.',',');
  if(interpreted===value.trim())return '';
  const decimal=mode==='rational'?normalizedShort('numeric',value):normalized;
  const decimalNote=decimal?.includes('.')?(mode==='rational'?` (số thập phân ${decimal.replace('.',',')})`:' (số thập phân)'):'';
  const separatorNote=/[.,]/.test(value)?' Dấu chấm và dấu phẩy là dấu thập phân, không tách hàng nghìn.':'';
  return `Máy đang hiểu là ${interpreted}${decimalNote}.${separatorNote}`;
}

export type AnswerState = 'answered' | 'blank' | 'partial' | 'invalid' | 'self';

/** "Đã trả lời đầy đủ" khi có câu trả lời VÀ hợp lệ định dạng; câu ngắn sai định dạng tách riêng;
 * câu Đ/S mới chọn một phần các ý là "partial". */
export function answerState(exam: PracticeExam, q: PracticeQuestion, answers: Answers): AnswerState {
  if (q.kind === 'self') return 'self';
  if (q.kind === 'short') {
    const status = shortAnswerStatus(q.mode, answers[q.id], questionShortFormat(exam,q));
    return status === 'valid' ? 'answered' : status === 'invalid' ? 'invalid' : 'blank';
  }
  if (isAnswered(exam, q.id, answers)) return 'answered';
  const value = answers[q.id];
  // Đ/S đã chọn một vài ý: chưa đủ nhưng không phải "trống" (review Codex đợt 2).
  return q.kind === 'tf' && Array.isArray(value) && value.some(v => typeof v === 'boolean') ? 'partial' : 'blank';
}

/** Nhãn câu theo phần, cùng một kiểu ở phiếu trả lời, hộp nộp và màn xem lại: "II · Đúng/sai · Câu 1". */
export function questionLabel(exam: Pick<PracticeExam, 'questions' | 'sections'>, index: number): {part: string; number: number; full: string} {
  const section = examSections(exam).find(s => index >= s.from && index < s.to);
  if (!section) return {part: '', number: index + 1, full: `Câu ${index + 1}`};
  const number = index - section.from + 1;
  return {part: section.name, number, full: `${section.name} · Câu ${number}`};
}

/** Danh sách câu chưa trả lời đầy đủ cho hộp xác nhận nộp bài (TT-01): trống hoặc sai định dạng. */
export function pendingQuestions(exam: PracticeExam, answers: Answers): {index: number; id: string; label: string; state: Exclude<AnswerState, 'answered'|'self'>}[] {
  return exam.questions.flatMap((q, index) => {
    if(q.kind==='self')return [];
    const state = answerState(exam, q, answers);
    return state === 'answered'||state === 'self' ? [] : [{index, id: q.id, label: questionLabel(exam, index).full, state}];
  });
}

/** TT-12: ô "Lớp x · kỳ" chỉ hiện khi có đề; ô đang chọn (từ URL cũ như ?lop=12&ky=CK1) vẫn hiện để
 * học sinh thấy mình đang lọc gì. Bộ lọc kỳ và URL ?ky= không đổi. */
export function visibleBuckets<G, P>(exams: readonly {grade: G; period: P}[], grades: readonly G[], periods: readonly P[], selected: {grade: G | 'all'; period: P | 'all'}): {grade: G; period: P; count: number}[] {
  return grades.flatMap(grade => periods.map(period => ({grade, period, count: exams.filter(e => e.grade === grade && e.period === period).length})))
    .filter(b => b.count > 0 || (b.grade === selected.grade && b.period === selected.period));
}

/** TH-07: số thập phân trong đáp án hiện bằng dấu phẩy như cách học sinh viết ("0.5" -> "0,5").
 * Chỉ đổi chữ hiển thị; khoá chấm trong dữ liệu đề giữ nguyên. Mode exact giữ nguyên văn. */
export function displayKeyAnswer(mode: string, value: string): string {
  return mode !== 'exact' && /^[+-]?\d+\.\d+$/.test(value.trim()) ? value.trim().replace('.', ',') : value;
}

/** DL-08: nội dung và tên tệp "Tải bản lưu bài làm" giữ y hệt nút "Xuất bài làm JSON" cũ
 * (JSON.stringify(draft, null, 2), tên bai-lam-<examId>-<startedAt>.json) để khôi phục được. */
export function draftExportFile(draft: {examId: string; startedAt: number}): {name: string; text: string} {
  return {name: `bai-lam-${draft.examId}-${draft.startedAt}.json`, text: JSON.stringify(draft, null, 2)};
}

export const scoredQuestionCount=(exam:Pick<PracticeExam,'questions'>)=>exam.questions.filter(q=>q.kind!=='self').length;
