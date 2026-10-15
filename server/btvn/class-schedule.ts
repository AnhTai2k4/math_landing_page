import {opensAt} from './class-rules';

/** weekday: 1 = thứ Hai, 7 = Chủ nhật. Ngày học và giờ luôn ở Việt Nam. */
export function classOpeningTimes(material:{classNames:string[];classDates?:Record<string,string>;date:string}){
 const result:Record<string,string>={};
 for(const name of material.classNames){
  const date=material.classDates?.[name]??material.date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('INVALID_CLASS_DATE');
  result[name]=opensAt(name,date);
 }
 return result;
}
