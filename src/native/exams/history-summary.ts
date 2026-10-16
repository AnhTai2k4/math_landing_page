import type {PracticeExam} from './data';
import {readDraft,readHistory,type Store} from './store';
import {resultFor} from './result';
import {historyVersions,originalExamId,practiceVersion} from './practice-errata';
export function historySummary(storage:Store|null,catalog:readonly PracticeExam[]) {
 const history=readHistory(storage,historyVersions(catalog));
 const exams=catalog.map(exam=>{
  const attempts=history.items.filter(item=>originalExamId(item.exam.id)===exam.id);
  const scores=attempts.map(item=>resultFor(item.exam,item.draft)?.score).filter(score=>score?.ok);
  const latest=attempts[0],latestResult=latest?resultFor(latest.exam,latest.draft)?.score:undefined;
  const current=readDraft(storage,practiceVersion(exam));
  const official=(score:typeof latestResult)=>score?.ok?(score.mtm?score.finalMillipoints:score.earnedMillipoints):null;
  const totals=scores.map(official).filter((score):score is number=>score!==null);
  return {examId:exam.id,count:attempts.length,best:totals.length?Math.max(...totals):null,latestScore:official(latestResult),lastSubmitted:latest?.draft.submittedAt??null,inProgress:current.ok&&!!current.value&&current.value.submittedAt===null};
 });
 return {history,exams,totalAttempts:history.items.length,completedExams:exams.filter(exam=>exam.count>0).length};
}
