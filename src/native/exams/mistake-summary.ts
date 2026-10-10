import type {PracticeExam} from './data';
import {validatePracticeExam} from './data';
import {validateDraft,type Draft, type readHistory} from './store';
import {reviewRows} from './review';
import {examSections} from './flexible-profile';

export type ReviewHistory=ReturnType<typeof readHistory>;
export type MistakeStatus='wrong'|'partial'|'unanswered';
export type MistakeItem={key:string;exam:PracticeExam;draft:Draft;questionId:string;index:number;part:string;questionNumber:number;status:MistakeStatus;attemptCount:number;occurrences:Record<MistakeStatus,number>};
const identity=(exam:PracticeExam)=>JSON.stringify([exam.id,exam.versionHash,exam.rubricVersion]);
const later=(a:Draft,b:Draft)=>a.submittedAt!-b.submittedAt!||a.updatedAt-b.updatedAt||(a.attemptId>b.attemptId?1:a.attemptId<b.attemptId?-1:0);

/** Pure projection of retained submissions. No storage access or writes; old
 * editions are always scored against the exam snapshot that accompanied them. */
export function mistakeSummary(history:ReviewHistory) {
  const groups=new Map<string,{exam:PracticeExam;draft:Draft}[]>();
  const seen=new Set<string>();let excluded=0,attempts=0;
  for(const item of history.items){
    if(!validatePracticeExam(item.exam).valid||!validateDraft(item.draft,item.exam).ok||item.draft.submittedAt===null){excluded++;continue;}
    const id=identity(item.exam),attemptKey=JSON.stringify([id,item.draft.attemptId]);
    if(seen.has(attemptKey))continue;
    const rows=reviewRows(item.exam,item.draft);
    if(rows.some(row=>row.status==='unscored')){excluded++;continue;}
    seen.add(attemptKey);attempts++;
    const group=groups.get(id)??[];group.push(item);groups.set(id,group);
  }
  const items:MistakeItem[]=[];
  for(const [id,group]of groups){
    group.sort((a,b)=>later(b.draft,a.draft));
    const latest=group[0],counts=new Map<string,Record<MistakeStatus,number>>();
    for(const item of group)for(const row of reviewRows(item.exam,item.draft)){
      const count=counts.get(row.q.id)??{wrong:0,partial:0,unanswered:0};
      if(row.status==='wrong'||row.status==='partial'||row.status==='unanswered')count[row.status]++;
      counts.set(row.q.id,count);
    }
    const parts=examSections(latest.exam);
    for(const row of reviewRows(latest.exam,latest.draft))if(row.status==='wrong'||row.status==='partial'||row.status==='unanswered'){
      const part=parts.find(part=>row.index>=part.from&&row.index<part.to);
      items.push({key:JSON.stringify([id,row.q.id]),...latest,questionId:row.q.id,index:row.index,part:part?.label??'',questionNumber:row.index-(part?.from??0)+1,status:row.status,attemptCount:group.length,occurrences:counts.get(row.q.id)!});
    }
  }
  items.sort((a,b)=>later(b.draft,a.draft)||(identity(a.exam)<identity(b.exam)?-1:identity(a.exam)>identity(b.exam)?1:0)||a.index-b.index);
  return {items,attempts,excluded};
}
