export const STUDY_DAYS_KEY='mtm-self-study-days-v1';
export type StudyStore={getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void;removeItem:(key:string)=>void};
export type StudyDays={days:string[];status:'ready'|'invalid'|'unavailable'};
const DAY=86400000,MAX_DAYS=5000;
function validDays(input:unknown,today:string):input is string[]{
  const limit=studyDayNumber(today);
  return Number.isFinite(limit)&&Array.isArray(input)&&input.length<=MAX_DAYS&&input.every(day=>typeof day==='string'&&Number.isFinite(studyDayNumber(day))&&studyDayNumber(day)<=limit);
}

/** Ngày theo đồng hồ thiết bị; số ngày UTC chỉ dùng để đếm qua tháng và DST. */
export function localStudyDay(date=new Date()):string{
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function studyDayNumber(day:string):number{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||Number(day.slice(0,4))<2000)return NaN;
  const time=Date.parse(day+'T00:00:00Z');
  return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===day?time/DAY:NaN;
}
export function studyDayOffset(day:string,offset:number):string{
  return new Date((studyDayNumber(day)+offset)*DAY).toISOString().slice(0,10);
}
export function readStudyDays(store:StudyStore|undefined,today=localStudyDay()):StudyDays{
  let raw:string|null;
  try{if(!store)return {days:[],status:'unavailable'};raw=store.getItem(STUDY_DAYS_KEY);}
  catch{return {days:[],status:'unavailable'};}
  try{
    if(raw===null)return {days:[],status:'ready'};
    if(raw.length>65001)return {days:[],status:'invalid'};
    const input:unknown=JSON.parse(raw);
    if(!validDays(input,today))return {days:[],status:'invalid'};
    return {days:[...new Set(input)].sort(),status:'ready'};
  }catch{return {days:[],status:'invalid'};}
}
export function saveStudyDays(days:string[],store:StudyStore|undefined):StudyDays{
  if(!validDays(days,localStudyDay()))return {days:[],status:'invalid'};
  const next=[...new Set(days)].sort();
  try{
    if(!store||next.length>MAX_DAYS)throw Error('Không lưu được');
    store.setItem(STUDY_DAYS_KEY,JSON.stringify(next));return {days:next,status:'ready'};
  }catch{return {days:next,status:'unavailable'};}
}
export function clearStudyDays(store:StudyStore|undefined):StudyDays{
  try{if(!store)throw Error('Không mở được');store.removeItem(STUDY_DAYS_KEY);return {days:[],status:'ready'};}
  catch{return {days:[],status:'unavailable'};}
}
export function studyDayStats(days:string[],today:string){
  const valid=[...new Set(days.filter(day=>Number.isFinite(studyDayNumber(day))&&day<=today))].sort(),seen=new Set(valid);
  let longest=0,run=0,previous=-Infinity;
  for(const day of valid){const n=studyDayNumber(day);run=n===previous+1?run+1:1;longest=Math.max(longest,run);previous=n;}
  let cursor=seen.has(today)?today:studyDayOffset(today,-1),current=0;
  while(seen.has(cursor)){current++;cursor=studyDayOffset(cursor,-1);}
  return {total:valid.length,current,longest,marked:seen.has(today),badges:[3,7,30].filter(milestone=>longest>=milestone)};
}
