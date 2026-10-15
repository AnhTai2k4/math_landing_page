import type {LessonMaterial} from '../../src/native/homework/btvn-contract';

/** Bản cũ chưa có lịch được khóa đến 21:30 ngày học, theo giờ Việt Nam. */
export function lessonOpensAt(material:LessonMaterial,className:string):number {
  if(material.kind==='kiem-tra-thang')return material.opensAt??Infinity;
  const explicit=material.classOpensAt?.[className];
  if(explicit!==undefined){const parsed=Date.parse(explicit);return Number.isFinite(parsed)?parsed:Infinity;}
  const date=material.classDates?.[className]??material.date;
  const parsed=Date.parse(date+'T21:30:00+07:00');return Number.isFinite(parsed)?parsed:Infinity;
}
export function visibleLesson<T extends LessonMaterial>(material:T,className:string,now:number):T & {opensAt:number;locked:boolean} {
  const opensAt=lessonOpensAt(material,className),locked=now<opensAt;
  const result={...material,date:material.classDates?.[className]??material.date,opensAt,locked};
  return locked?{...result,materialUrl:null,handoutUrl:null,homeworkUrl:null,homeworkUrls:[]}:result;
}
