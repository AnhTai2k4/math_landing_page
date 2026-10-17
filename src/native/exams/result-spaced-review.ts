import type {PracticeExam} from './data';
import type {Draft} from './store';
import {reflectionItems} from './result-reflection';

export const SPACED_REVIEW_OFFSETS=[1,3,7] as const;
export const FIRST_SPACED_DATE='2000-01-01',LAST_SPACED_DATE='2099-12-24';
export function spacedReviewToday(now=new Date()){
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}
export function spacedReviewDates(start:string){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||start<FIRST_SPACED_DATE||start>LAST_SPACED_DATE)return null;
  const parsed=new Date(start+'T12:00:00.000Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==start)return null;
  return SPACED_REVIEW_OFFSETS.map(offset=>{const date=new Date(parsed);date.setUTCDate(date.getUTCDate()+offset);return{offset,date:date.toISOString().slice(0,10)};});
}
export function spacedDateLabel(date:string){return date.split('-').reverse().join('/');}

/** Chỉ gom từ đúng lượt đã nộp và trạng thái đã chấm; không nhận câu đúng, tự luận tự kiểm hay chưa chấm. */
export function spacedReviewItems(exam:PracticeExam,draft:Draft){return reflectionItems(exam,draft);}
export type SpacedReviewItem=ReturnType<typeof spacedReviewItems>[number];
export function createSpacedReviewPlan(exam:PracticeExam,draft:Draft,start:string,ids:string[]){
  const dates=spacedReviewDates(start),items=spacedReviewItems(exam,draft);
  if(!dates||ids.length<1||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!items.some(item=>item.q.id===id)))return null;
  return{start,dates,items:items.filter(item=>ids.includes(item.q.id))};
}
