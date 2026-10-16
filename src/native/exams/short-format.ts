/** Yêu cầu nhập công khai, không phải bằng chứng kiểm khóa hay đáp án chấp nhận. */
import {MTM_SCORING_VERSION, type MtmShortRule} from './mtm-scoring';

export type PublicShortFormat = Pick<MtmShortRule, 'mode' | 'whitespace' | 'unit' | 'decimalPlaces'>;
const fields = ['mode', 'whitespace', 'unit', 'decimalPlaces'];
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const engineMode = (mode: string) => mode === 'numeric' ? 'decimal' : mode;

/** Không nhận trường mở rộng, kể cả verified, evidence, answer, acceptedAnswers. */
export function validPublicShortFormat(value: unknown, questionMode: string): value is PublicShortFormat {
  if (!record(value) || Object.keys(value).some(key => !fields.includes(key)) ||
      !Object.hasOwn(value, 'mode') || !['exact', 'decimal', 'rational'].includes(String(value.mode)) ||
      value.mode !== engineMode(questionMode)) return false;
  if (value.whitespace !== undefined && (typeof value.whitespace !== 'string' || !['trim', 'collapse'].includes(value.whitespace))) return false;
  if (value.unit !== undefined && (typeof value.unit !== 'string' || !value.unit.trim() || value.unit !== value.unit.trim())) return false;
  return value.decimalPlaces === undefined || value.mode === 'decimal' && Number.isSafeInteger(value.decimalPlaces) &&
    (value.decimalPlaces as number) >= 0 && (value.decimalPlaces as number) <= 100;
}

/** Dựng đối tượng mới chỉ từ bốn trường nhập, không lan truyền metadata của rule. */
export function publicShortFormatFromRule(value: unknown, questionMode: string): PublicShortFormat | undefined {
  if (!record(value)) return undefined;
  const format: Record<string, unknown> = {mode: value.mode};
  for (const key of fields.slice(1)) if (Object.hasOwn(value, key) && value[key] !== undefined) format[key] = value[key];
  return validPublicShortFormat(format, questionMode) ? format : undefined;
}

/** Bài cũ giữ parser cũ. Bài MTM đủ khóa dùng cùng định dạng khi làm và khi ôn. */
export function questionShortFormat(exam: {rubricVersion: string}, question: {
  kind: string; mode?: string; shortRule?: unknown; shortFormat?: unknown;
}): PublicShortFormat | undefined {
  if (exam.rubricVersion !== MTM_SCORING_VERSION || question.kind !== 'short' || !question.mode) return undefined;
  if (question.shortRule !== undefined) return publicShortFormatFromRule(question.shortRule, question.mode);
  return validPublicShortFormat(question.shortFormat, question.mode) ? question.shortFormat : undefined;
}
