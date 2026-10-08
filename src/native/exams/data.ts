import verifiedCatalog from './catalog.json';
import type {Assessment, Question, Validation} from './assessment';
import {validateMtmAssessment} from './mtm-profile';

export const GRADES = [10, 11, 12] as const;
export const PERIODS = ['GK1', 'CK1', 'GK2', 'CK2'] as const;
export type Grade = typeof GRADES[number];
export type Period = typeof PERIODS[number];
export const PERIOD_LABELS: Record<Period, string> = {
  GK1: 'Giữa kỳ I', CK1: 'Cuối kỳ I', GK2: 'Giữa kỳ II', CK2: 'Cuối kỳ II',
};
export type PracticeQuestion = Exclude<Question, {kind: 'essay'}> & {
  prompt?: string;
  text?: string;
  /** Optional verbatim statement texts; otherwise sourceRef + a/b/c/d locates them. */
  statements?: [string, string, string, string];
};
export interface PracticeExam extends Assessment {
  grade: Grade;
  period: Period;
  title: string;
  durationMinutes: number;
  versionHash: string;
  rubricVersion: string;
  sourceUrl: string;
  publicationVerified: true;
  questionDisplayVerified: true;
  sourceMaterial: {title: string; publisher: string; version: string; locator: string};
  /** Only expose a PDF before submission when it is separately verified to
   * contain questions only, without an answer key or solutions. */
  sourcePdf?: {url: string; verified: true; sha256: string; bytes: number; totalPages: number; questionPages: number[]};
  questions: PracticeQuestion[];
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
export const boundedText = (value: unknown, max = 500): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
export const isSha256 = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-fA-F0-9]{64}$/.test(value);
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096 || value !== value.trim()) return false;
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}
export function validPdfUrl(value: unknown, sha256: unknown): value is string {
  if(typeof value!=='string'||!isSha256(sha256))return false;
  if(value.startsWith('/'))return sha256===sha256.toLowerCase()&&(value===`/exam-assets/${sha256}.pdf`||value===`/qa-exam-assets/${sha256}.pdf`);
  return isHttpsUrl(value);
}
export function validSourcePdf(value:unknown):boolean {
  if(!isRecord(value)||value.verified!==true||!validPdfUrl(value.url,value.sha256)||!Number.isSafeInteger(value.bytes)||(value.bytes as number)<8||(value.bytes as number)>15*1024*1024||!Number.isSafeInteger(value.totalPages)||(value.totalPages as number)<1||(value.totalPages as number)>200)return false;
  return Array.isArray(value.questionPages)&&value.questionPages.length>0&&new Set(value.questionPages).size===value.questionPages.length&&Array.from(value.questionPages).every(p=>Number.isSafeInteger(p)&&p>=1&&p<=(value.totalPages as number));
}
export function validatePracticeExam(input: unknown): Validation {
  const gate = validateMtmAssessment(input);
  if (!gate.valid || !isRecord(input)) return gate;
  const errors: string[] = [];
  if (!boundedText(input.id, 120) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(input.id)||input.id==='history') errors.push('Invalid or reserved route id');
  if (!GRADES.includes(input.grade as Grade) || !PERIODS.includes(input.period as Period)) errors.push('Invalid grade or period');
  if (!boundedText(input.title, 300)) errors.push('Missing title');
  if (!Number.isSafeInteger(input.durationMinutes) || (input.durationMinutes as number) < 1 || (input.durationMinutes as number) > 1440) errors.push('Invalid duration');
  if (!isSha256(input.versionHash) || !boundedText(input.rubricVersion, 120)) errors.push('Invalid exam/rubric version');
  if (!isHttpsUrl(input.sourceUrl) || input.publicationVerified !== true || input.questionDisplayVerified!==true) errors.push('Publication/question display not verified');
  const material = input.sourceMaterial;
  if (!isRecord(material) || !['title', 'publisher', 'version', 'locator'].every(key => boundedText(material[key], 1000))) errors.push('Incomplete source material');
  if (input.sourcePdf !== undefined && !validSourcePdf(input.sourcePdf)) errors.push('PDF question-page asset not verified');
  for (const q of (input as unknown as PracticeExam).questions) {
    if (!boundedText(q.id, 120) || ['__proto__', 'constructor', 'prototype'].includes(q.id)) errors.push('Unsafe question id');
    if (!boundedText(q.prompt ?? q.text ?? q.sourceRef, 20000)) errors.push('Missing question text or source locator');
    if (q.prompt !== undefined && !boundedText(q.prompt, 20000)) errors.push('Invalid prompt');
    if (q.text !== undefined && !boundedText(q.text, 20000)) errors.push('Invalid text');
    if (q.kind === 'short' && !q.acceptedAnswers.every(answer => boundedText(answer, 500))) errors.push('Short answer exceeds input limit');
    if (q.statements !== undefined && (q.kind !== 'tf' || !Array.isArray(q.statements) || q.statements.length !== 4 || !Array.from(q.statements).every(s => boundedText(s, 10000)))) errors.push('Invalid statement texts');
    if(input.sourcePdf===undefined&&(!boundedText(q.prompt??q.text,20000)||(q.kind==='tf'&&!q.statements)))errors.push('Question content is missing; a source locator is insufficient');
  }
  return {valid: errors.length === 0, errors};
}

/** Real source packs admitted after independent source, key, rubric and PDF review.
 * QA may pass an external module's fixtures as NativeExams.catalog; no globals,
 * query switches, fetches or fixture imports in the production entry point. */
export const PRACTICE_EXAMS: readonly PracticeExam[] = Object.freeze(verifiedCatalog as unknown as PracticeExam[]);
export function readyExams(catalog: readonly unknown[]): PracticeExam[] {
  const valid = catalog.filter((exam): exam is PracticeExam => validatePracticeExam(exam).valid);
  return valid.filter(exam => valid.filter(other => other.id === exam.id).length === 1);
}

export type Filters = {lop: 'all' | '10' | '11' | '12'; ky: 'all' | Period; q: string};
export function readFilters(search: string): Filters {
  const params = new URLSearchParams(search);
  const grade = params.get('lop'), period = params.get('ky');
  return {
    lop: grade === '10' || grade === '11' || grade === '12' ? grade : 'all',
    ky: PERIODS.includes(period as Period) ? period as Period : 'all',
    q: (params.get('q') ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').slice(0, 120),
  };
}
export function filterSearch(filters: Filters): string {
  return '?' + new URLSearchParams({lop: filters.lop, ky: filters.ky, q: filters.q}).toString();
}
export const titleTerm = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLocaleLowerCase('vi').trim();
