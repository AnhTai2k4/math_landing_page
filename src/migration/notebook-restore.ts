import {parseNotebook,saveNotebook,type Store,type Task} from './notebook-store';
export type ImportConflict={kind:'task'|'goal';key:string};
export type NotebookImportPlan={next:Store|null;conflicts:ImportConflict[];addedTasks:number;addedGoals:number;duplicates:number};
const sameTask=(a:Task,b:Task)=>a.id===b.id&&a.text===b.text&&a.minutes===b.minutes&&a.done===b.done;
/** Validate the whole file first, then merge additions only. Existing records are never replaced. */
export function planNotebookImport(current:Store,raw:string):NotebookImportPlan{
 const existing=parseNotebook(JSON.stringify(current)),incoming=parseNotebook(raw);
 const next=parseNotebook(JSON.stringify(existing)),conflicts:ImportConflict[]=[];
 let addedTasks=0,addedGoals=0,duplicates=0;
 for(const [day,tasks] of Object.entries(incoming.days)){
  const merged=[...(next.days[day]??[])],byId=new Map(merged.map(t=>[t.id,t]));
  for(const task of tasks){
   const previous=byId.get(task.id);
   if(previous){if(sameTask(previous,task))duplicates++;else conflicts.push({kind:'task',key:day+'/'+task.id});continue;}
   merged.push({...task});byId.set(task.id,task);addedTasks++;
  }
  if(merged.length>30)throw new Error('Ghép tệp sẽ vượt 30 việc trong ngày '+day+'. Chưa có dữ liệu nào được ghi.');
  if(merged.length)next.days[day]=merged;
 }
 for(const [month,goal] of Object.entries(incoming.goals)){
  if(Object.hasOwn(next.goals,month)){
   if(next.goals[month]!==goal)conflicts.push({kind:'goal',key:month});else duplicates++;
  }else{next.goals[month]=goal;addedGoals++;}
 }
 if(conflicts.length)return{next:null,conflicts,addedTasks,addedGoals,duplicates};
 parseNotebook(JSON.stringify(next));
 return{next,conflicts,addedTasks,addedGoals,duplicates};
}
/** expectedRaw is captured when the preview opens, not refreshed just before saving. */
export function applyNotebookImport(storage:Pick<Storage,'getItem'|'setItem'>,expectedRaw:string|null,plan:NotebookImportPlan):string{
 if(!plan.next||plan.conflicts.length)throw new Error('Tệp có mục trùng nhưng khác nội dung. Không ghi đè sổ tay hiện tại.');
 return saveNotebook(storage,expectedRaw,plan.next);
}
