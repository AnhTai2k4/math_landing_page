import {normalizedShort} from './assessment';
import {scorePracticeAssessment} from './flexible-profile';
import type {PracticeExam} from './data';
import {validateDraft, type Draft} from './store';

/** Preserve original answers for review/export. A non-decimal response to a
 * numeric question earns zero, instead of preventing the entire submission.
 * No eval, tolerance, score rescaling or changes to the supplied engine. */
export function resultFor(exam: PracticeExam, draft: Draft) {
  const validated = validateDraft(draft, exam);
  if (!validated.ok || draft.submittedAt === null) return null;
  const answers: Record<string, unknown> = {...draft.answers};
  const invalidNumeric: string[] = [];
  for (const q of exam.questions) {
    const value = answers[q.id];
    if (q.kind === 'short' && q.mode !== 'exact' && typeof value === 'string' && value.trim() && normalizedShort(q.mode,value) === null) {
      invalidNumeric.push(q.id);
      answers[q.id] = '';
    }
  }
  return {score: scorePracticeAssessment(exam, answers), invalidNumeric};
}
