import schedule from './class-schedule.json';

/** weekday: 1 = thứ Hai, 7 = Chủ nhật. Ngày học và giờ luôn ở Việt Nam. */
export function classOpeningTimes(material:{classNames:string[];classDates?:Record<string,string>;date:string}){
 const result:Record<string,string>={};
 for(const name of material.classNames){
  const date=material.classDates?.[name]??material.date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_CLASS_DATE');
  const weekday=new Date(date+'T00:00:00Z').getUTCDay()||7;
  const sessions=(schedule as Record<string,{weekday:number;start:string;end:string}[]>)[name]?.filter(s=>s.weekday===weekday)??[];
  // Nếu có nhiều ca cùng ngày, chỉ mở sau ca cuối. Lớp/ngày chưa có lịch dùng 21:30.
  const end=sessions.map(s=>s.end).sort().at(-1)??'21:30';
  result[name]=date+'T'+end+':00+07:00';
 }
 return result;
}
