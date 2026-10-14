import type {LessonMaterial} from '../../src/native/homework/btvn-contract';
import {pairedLessonCode} from './lesson-policy';
export type LessonSourceConfig={sheetId:string;tab:string;programKey:string;paired:boolean;classNames:string[];columns:Record<'className'|'date'|'title'|'material'|'handout'|'video'|'homework',string>;confirmedDates?:Record<string,string>};
export function safeMaterialUrl(value:string):string|null {
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function youtubeVideoId(value:string):string|null {
  try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;
    const host=u.hostname.toLowerCase();let id='';
    if(host==='youtu.be')id=u.pathname.slice(1);
    else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v')??'':/^\/(?:embed|shorts)\/([^/]+)$/.exec(u.pathname)?.[1]??'';
    return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;
  }catch{return null;}
}
/** Nguồn học liệu được tiêm từ cấu hình; không tự đọc roster hoặc mạng. */
export function readLessonMaterials(headers:string[],rows:string[][],config:LessonSourceConfig){
  for(const name of Object.values(config.columns))if(headers.filter(h=>h===name).length!==1)throw new Error('Thiếu/trùng cột buổi học');
  const lessons:LessonMaterial[]=[],pending:{row:number;reason:string}[]=[];
  rows.forEach((row,index)=>{const get=(key:keyof LessonSourceConfig['columns'])=>String(row[headers.indexOf(config.columns[key])]??'').trim();
    if(!config.classNames.includes(get('className')))return;
    const date=config.confirmedDates?.[get('date')]??get('date');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date){pending.push({row:index+2,reason:'Cần xác minh ngày và năm'});return;}
    const video=get('video'),videoId=youtubeVideoId(video);
    if(video&&!videoId){pending.push({row:index+2,reason:'Video không phải URL YouTube hợp lệ'});return;}
    for(const key of ['material','handout','homework'] as const)if(get(key)&&!safeMaterialUrl(get(key))){pending.push({row:index+2,reason:'Liên kết học liệu không hợp lệ'});return;}
    let lessonCode:string;try{lessonCode=config.paired?pairedLessonCode(config.programKey,date):config.programKey+'-'+date;}catch{pending.push({row:index+2,reason:'Cần cấu hình bài riêng'});return;}
    const lesson:LessonMaterial={lessonCode,classNames:config.paired?[...config.classNames]:[get('className')],classDates:{[get('className')]:date},date,title:get('title')||'Buổi học',videoId,materialUrl:safeMaterialUrl(get('material')),handoutUrl:safeMaterialUrl(get('handout')),homeworkUrl:safeMaterialUrl(get('homework'))};
    const previous=lessons.find(l=>l.lessonCode===lessonCode);
    if(previous){if(['title','videoId','materialUrl','handoutUrl','homeworkUrl'].some(k=>previous[k as keyof LessonMaterial]!==lesson[k as keyof LessonMaterial]))throw new Error('Hai ca cùng bài có học liệu khác nhau; cần đối soát');previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};}
    else lessons.push(lesson);
  });return {lessons:lessons.sort((a,b)=>b.date.localeCompare(a.date)),pending};
}
export async function readLessonSources(configs:LessonSourceConfig[],reader:(sheetId:string,tab:string)=>Promise<string[][]>){
  const results=[];for(const config of configs){const [headers,...rows]=await reader(config.sheetId,config.tab);results.push(readLessonMaterials(headers??[],rows,config));}
  const combined=new Map<string,LessonMaterial>();
  for(const result of results)for(const lesson of result.lessons){const previous=combined.get(lesson.lessonCode);
    if(previous){if(['title','videoId','materialUrl','handoutUrl','homeworkUrl'].some(k=>previous[k as keyof LessonMaterial]!==lesson[k as keyof LessonMaterial]))throw new Error('Hai nguồn cùng bài có học liệu khác nhau; cần đối soát');previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};}
    else combined.set(lesson.lessonCode,{...lesson,classNames:[...lesson.classNames]});
  }
  return {lessons:[...combined.values()].sort((a,b)=>b.date.localeCompare(a.date)),sources:results,pending:results.flatMap((result,i)=>result.pending.map(p=>({...p,sheetId:configs[i].sheetId,tab:configs[i].tab})))};
}
