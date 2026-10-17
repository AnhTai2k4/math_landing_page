export const FIRST_REVIEW_DATE='2000-01-01';
// Leave room for the final seven-day milestone inside the supported year range.
export const LAST_REVIEW_DATE='2099-12-24';
export const REVIEW_OFFSETS=[1,3,7] as const;
export type ReadingReviewMilestone={days:typeof REVIEW_OFFSETS[number];date:string;prompt:string};

function calendarDate(value:string):Date|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [year,month,day]=value.split('-').map(Number);
 const date=new Date(Date.UTC(year,month-1,day));
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date:null;
}

export function localReviewToday(now=new Date()):string{
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}

export function latestReviewDate(today=localReviewToday()):string{
 return calendarDate(today)&&today>=FIRST_REVIEW_DATE?today<LAST_REVIEW_DATE?today:LAST_REVIEW_DATE:FIRST_REVIEW_DATE;
}

export function createReadingReviewPlan(readOn:string,today=localReviewToday()):ReadingReviewMilestone[]|null{
 const date=calendarDate(readOn);
 if(!date||!calendarDate(today)||readOn<FIRST_REVIEW_DATE||readOn>LAST_REVIEW_DATE||readOn>today)return null;
 const prompts=['Gấp tài liệu, kể lại ý chính rồi mở ra đối chiếu.','Tự làm lại một ví dụ, kiểm điều kiện và các bước.','Thử một bài tương tự, ghi lại chỗ còn vướng để hỏi thầy.'];
 return REVIEW_OFFSETS.map((days,index)=>{
  const next=new Date(date.getTime());next.setUTCDate(next.getUTCDate()+days);
  return {days,date:next.toISOString().slice(0,10),prompt:prompts[index]};
 });
}

export const reviewDateLabel=(date:string)=>date.split('-').reverse().join('/');
