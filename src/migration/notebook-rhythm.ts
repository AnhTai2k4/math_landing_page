import type {Store} from './notebook-store';

const DAY=86400000;
const dayNumber=(key:string):number|null=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const time=Date.parse(key+'T12:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===key?Math.floor(time/DAY):null;
};
const dayKey=(day:number)=>new Date(day*DAY).toISOString().slice(0,10);

/** Counts self-marked days only. UTC arithmetic keeps calendar gaps independent of DST. */
export function notebookRhythm(days:Store['days'],todayKey:string){
 const today=dayNumber(todayKey);
 if(today===null)throw new RangeError('Ngày hiện tại không hợp lệ.');
 const marked=new Set<number>();
 for(const [key,tasks] of Object.entries(days)){
  const day=dayNumber(key);
  if(day!==null&&day<=today&&tasks.some(task=>task.done===true))marked.add(day);
 }
 const ordered=[...marked].sort((a,b)=>a-b);
 let best=0,run=0,previous:number|undefined;
 for(const day of ordered){run=previous===day-1?run+1:1;best=Math.max(best,run);previous=day;}
 let current=0,cursor=marked.has(today)?today:today-1;
 while(marked.has(cursor)){current++;cursor--;}
 const week=Array.from({length:7},(_,i)=>{const day=today-6+i;return{key:dayKey(day),marked:marked.has(day)};});
 return{current,best,total:marked.size,week,weekCount:week.filter(day=>day.marked).length};
}
