/** Standalone import/scoring gate. Verification flags require independent source review;
 * this module cannot establish that a PDF or its answer key is authentic. */
export type Choice = 'A' | 'B' | 'C' | 'D';
type Base = { id: string; sourceRef: string; maxMillipoints: number };
export type Question =
  | (Base & { kind: 'mc'; choices: [string, string, string, string]; answer: Choice })
  | (Base & { kind: 'tf'; answer: [boolean, boolean, boolean, boolean]; pointsByCorrectCount: [number, number, number, number, number] })
  | (Base & { kind: 'short'; mode: 'numeric' | 'exact'; acceptedAnswers: string[] })
  | (Base & { kind: 'essay' });
export type Assessment = { id: string; sourceHash: string; sourceRef: string; questionCount: number;
  answerKeyVerified: true; rubricVerified: true; questions: Question[] };
export type Validation = { valid: boolean; errors: string[] };
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const units = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= 10000;
const choices = ['A', 'B', 'C', 'D'];

/** Decimal-only, arbitrary precision string comparison. No expression evaluation,
 * exponent, thousands separator, fraction, tolerance or implicit rounding. */
export function canonicalNumeric(value: string): string | null {
  const raw = value.trim();
  if (!/^[+-]?\d+(?:[.,]\d+)?$/.test(raw)) return null;
  const sign = raw.startsWith('-') ? '-' : '';
  const [whole, fraction = ''] = raw.replace(/^[+-]/, '').replace(',', '.').split('.');
  const integer = whole.replace(/^0+(?=\d)/, '');
  const decimal = fraction.replace(/0+$/, '');
  return (integer === '0' && !decimal ? '' : sign) + integer + (decimal ? '.' + decimal : '');
}

export function validateAssessment(input: unknown): Validation {
  const errors: string[] = [];
  if (!record(input)) return { valid: false, errors: ['exam: object required'] };
  if (!text(input.id)) errors.push('exam: id required');
  if (!text(input.sourceRef)) errors.push('exam: sourceRef required');
  if (typeof input.sourceHash !== 'string' || !/^[a-fA-F0-9]{64}$/.test(input.sourceHash)) errors.push('exam: SHA256 required');
  if (input.answerKeyVerified !== true) errors.push('exam: verified answer key required');
  if (input.rubricVerified !== true) errors.push('exam: verified rubric required');
  if (!Array.isArray(input.questions) || !input.questions.length) return { valid: false, errors: [...errors, 'exam: complete questions required'] };
  if (!Number.isSafeInteger(input.questionCount) || input.questionCount !== input.questions.length) errors.push('exam: verified source questionCount must match imported questions');
  const ids = new Set<string>(); let total = 0;
  Array.from(input.questions).forEach((q: unknown, index: number) => {
    const prefix = 'question ' + (index + 1) + ': ';
    if (!record(q)) { errors.push(prefix + 'object required'); return; }
    if (!text(q.id) || q.id !== q.id.trim()) errors.push(prefix + 'nonblank unpadded id required');
    else if (ids.has(q.id)) errors.push(prefix + 'duplicate id'); else ids.add(q.id);
    if (!text(q.sourceRef)) errors.push(prefix + 'sourceRef required');
    if (!units(q.maxMillipoints) || q.maxMillipoints === 0) errors.push(prefix + 'positive integer millipoints required');
    else total += q.maxMillipoints;
    switch (q.kind) {
      case 'mc':
        if (!Array.isArray(q.choices) || q.choices.length !== 4 || !Array.from(q.choices).every(text) || new Set(q.choices).size !== 4) errors.push(prefix + 'four distinct choices required');
        if (!choices.includes(q.answer as string)) errors.push(prefix + 'A-D answer required');
        break;
      case 'tf': {
        if (!Array.isArray(q.answer) || q.answer.length !== 4 || !Array.from(q.answer).every(x => typeof x === 'boolean')) errors.push(prefix + 'four boolean key entries required');
        const schedule = q.pointsByCorrectCount;
        if (!Array.isArray(schedule) || schedule.length !== 5 || !Array.from(schedule).every(units) || schedule[0] !== 0 || schedule[4] !== q.maxMillipoints || schedule.some((n, i) => i > 0 && n < schedule[i - 1])) errors.push(prefix + 'explicit monotonic 0..max schedule of five integers required');
        break;
      }
      case 'short': {
        if (q.mode !== 'numeric' && q.mode !== 'exact') errors.push(prefix + 'explicit short answer mode required');
        if (!Array.isArray(q.acceptedAnswers) || !q.acceptedAnswers.length || !Array.from(q.acceptedAnswers).every(text)) errors.push(prefix + 'nonblank accepted answers required');
        else {
          const normalized = q.acceptedAnswers.map(s => q.mode === 'numeric' ? canonicalNumeric(s) : s.trim());
          if (normalized.includes(null) || new Set(normalized).size !== normalized.length) errors.push(prefix + 'malformed or duplicate accepted answers');
        }
        break;
      }
      case 'essay': break;
      default: errors.push(prefix + 'unsupported question kind');
    }
  });
  if (total !== 10000) errors.push('exam: total must equal 10000 millipoints');
  return { valid: !errors.length, errors };
}

export type AnswerMap = Record<string, unknown>;
export type ScoreResult = { ok: false; errors: string[] } | { ok: true;
  earnedMillipoints: number; maxMillipoints: 10000; finalMillipoints: number | null;
  manualPending: string[]; rows: { id: string; earnedMillipoints: number | null; maxMillipoints: number }[] };
const blank = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim());

export function scoreAssessment(input: unknown, submitted: unknown): ScoreResult {
  const gate = validateAssessment(input);
  if (!gate.valid) return { ok: false, errors: gate.errors };
  if (!record(submitted)) return { ok: false, errors: ['answers: object required'] };
  const exam = input as Assessment, known = new Set(exam.questions.map(q => q.id));
  const errors = Object.keys(submitted).filter(id => !known.has(id)).map(id => 'answers: unknown question ' + id);
  const rows: { id: string; earnedMillipoints: number | null; maxMillipoints: number }[] = [];
  const manualPending: string[] = [];
  for (const q of exam.questions) {
    const a = Object.hasOwn(submitted, q.id) ? submitted[q.id] : undefined;
    let earned: number | null = 0;
    if (q.kind === 'essay') {
      if (!blank(a) && typeof a !== 'string') errors.push(q.id + ': essay answer must be text');
      if (!blank(a)) { manualPending.push(q.id); earned = null; }
    } else if (!blank(a)) {
      if (q.kind === 'mc') {
        if (typeof a !== 'string' || !choices.includes(a)) errors.push(q.id + ': invalid A-D answer');
        else earned = a === q.answer ? q.maxMillipoints : 0;
      } else if (q.kind === 'tf') {
        if (!Array.isArray(a) || a.length !== 4 || !Array.from(a).every(x => x === null || typeof x === 'boolean')) errors.push(q.id + ': four boolean/null answers required');
        else earned = q.pointsByCorrectCount[a.reduce((count, x, i) => count + (x === q.answer[i] ? 1 : 0), 0)];
      } else {
        if (typeof a !== 'string') errors.push(q.id + ': short answer must be text');
        else {
          const normalized = q.mode === 'numeric' ? canonicalNumeric(a) : a.trim();
          if (normalized === null) errors.push(q.id + ': malformed numeric answer');
          else earned = q.acceptedAnswers.some(s => (q.mode === 'numeric' ? canonicalNumeric(s) : s.trim()) === normalized) ? q.maxMillipoints : 0;
        }
      }
    }
    rows.push({ id: q.id, earnedMillipoints: earned, maxMillipoints: q.maxMillipoints });
  }
  if (errors.length) return { ok: false, errors };
  const earnedMillipoints = rows.reduce((sum, row) => sum + (row.earnedMillipoints ?? 0), 0);
  return { ok: true, earnedMillipoints, maxMillipoints: 10000,
    finalMillipoints: manualPending.length ? null : earnedMillipoints, manualPending, rows };
}
