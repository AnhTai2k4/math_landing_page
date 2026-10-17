export const FIRST_REVIEW_DATE='2000-01-01';
// Leave room for the final seven-day milestone inside the supported year range.
export const LAST_REVIEW_DATE='2099-12-24';
export const REVIEW_OFFSETS=[1,3,7] as const;
export const READING_REVIEW_RHYTHMS=[
 {id:'1-3-7',label:'Ôn gần: sau 1, 3, 7 ngày',offsets:REVIEW_OFFSETS,lastReadOn:LAST_REVIEW_DATE},
 {id:'2-5-10',label:'Giãn nhịp: sau 2, 5, 10 ngày',offsets:[2,5,10],lastReadOn:'2099-12-21'},
] as const;
export type ReadingReviewRhythm=typeof READING_REVIEW_RHYTHMS[number]['id'];
export type ReadingReviewMilestone={days:1|2|3|5|7|10;date:string;prompt:string};
export type ReadingReviewStatus='checked'|'today'|'available'|'upcoming'|'invalid';

function calendarDate(value:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
}

export function localReviewToday(now=new Date()):string{
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}

export function latestReviewDate(today=localReviewToday(),rhythm:ReadingReviewRhythm='1-3-7'):string{
 const last=READING_REVIEW_RHYTHMS.find(item=>item.id===rhythm)?.lastReadOn;
 return last&&calendarDate(today)&&today>=FIRST_REVIEW_DATE?today<last?today:last:FIRST_REVIEW_DATE;
}

export function createReadingReviewPlan(readOn:string,today=localReviewToday(),rhythm:ReadingReviewRhythm='1-3-7'):ReadingReviewMilestone[]|null{
 const date=calendarDate(readOn),selected=READING_REVIEW_RHYTHMS.find(item=>item.id===rhythm);
 if(!selected||!date||!calendarDate(today)||readOn<FIRST_REVIEW_DATE||readOn>selected.lastReadOn||readOn>today)return null;
 const prompts=['Gấp tài liệu, kể lại ý chính rồi mở ra đối chiếu.','Tự làm lại một ví dụ, kiểm điều kiện và các bước.','Thử một bài tương tự, ghi lại chỗ còn vướng để hỏi thầy.'];
 return selected.offsets.map((days,index)=>{
  const next=new Date(date.getTime());next.setUTCDate(next.getUTCDate()+days);
  return {days,date:next.toISOString().slice(0,10),prompt:prompts[index]};
 });
}

export function readingReviewStatus(date:string,checked:boolean,today=localReviewToday()):ReadingReviewStatus{
 if(!calendarDate(date)||!calendarDate(today))return 'invalid';
 return checked?'checked':date===today?'today':date<today?'available':'upcoming';
}

export const reviewDateLabel=(date:string)=>date.split('-').reverse().join('/');
