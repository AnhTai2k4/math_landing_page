import type {LessonMaterial} from '../../src/native/homework/btvn-contract';
import {pairedLessonCode} from './lesson-policy';
import {cellText,cellLinks,headerKey,materialDate,normalizeMaterialClass,type MaterialCell} from './material-cells';
export type LessonSourceConfig={sheetId:string;tab:string;programKey:string;paired:boolean;classNames:string[];columns:Record<'className'|'date'|'title'|'material'|'handout'|'homework',string>&{video?:string;answer?:string};confirmedDates?:Record<string,string>;schoolYear?:{startYear:number;startMonth:number};classAliases?:Record<string,string>};
export function safeMaterialUrl(value:string):string|null {return cellLinks(value)[0]??null;}
export function youtubeVideoId(value:string):string|null {
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const host=u.hostname.toLowerCase();let id='';
 if(host==='youtu.be')id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v')??'':/^\/(?:embed|shorts|live)\/([^/]+)$/.exec(u.pathname)?.[1]??'';
 return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;}catch{return null;}
}
export function readLessonMaterials(headers:string[],rows:MaterialCell[][],config:LessonSourceConfig){
 const indexes=new Map<string,number>();for(const [key,name] of Object.entries(config.columns)){if(!name)continue;const hits=headers.map((h,i)=>headerKey(h)===headerKey(name)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error('Thiếu/trùng cột buổi học');indexes.set(key,hits[0]);}
 const lessons:LessonMaterial[]=[],pending:{row:number;reason:string}[]=[];let parent:LessonMaterial|undefined,parentSourceDate:string|null=null;
 const klass=(s:string)=>normalizeMaterialClass(config.classAliases?.[s.trim()]??s);
 for(const [index,row] of rows.entries()){
  const cell=(key:string)=>row[indexes.get(key)??-1],get=(key:string)=>cellText(cell(key)).trim();
  const date=materialDate(config.confirmedDates?.[get('date')]??get('date'),config.schoolYear);
  if(!get('className')&&!get('title')&&get('homework')&&parent&&(!get('date')||date===parentSourceDate)){
   const links=cellLinks(cell('homework'));if(!links.length){pending.push({row:index+2,reason:'Tệp phụ chưa có liên kết'});continue;}
   parent.homeworkUrls=[...new Set([...(parent.homeworkUrls??[]),...links])];continue;
  }
  parent=undefined;
  if(!config.classNames.map(klass).includes(klass(get('className'))))continue;
  if(!date){if(get('date')&&!/^\\+$/.test(get('date')))pending.push({row:index+2,reason:'Cần xác minh ngày và năm'});continue;}
  const urls=(key:string)=>cellLinks(cell(key)),video=urls('video')[0]??'',videoId=youtubeVideoId(video);
  if(video&&!videoId&&!/(^|\.)zoom\.us$/.test(new URL(video).hostname)){pending.push({row:index+2,reason:'Video không phải YouTube hoặc Zoom record hợp lệ'});continue;}
  if(get('video')&&!video){pending.push({row:index+2,reason:'Record chưa có liên kết'});continue;}
  const note=headerKey(get('homework'))===headerKey('Phần trắc nghiệm trong phiếu')?get('homework'):undefined;
  let invalid=false;for(const key of ['material','handout','homework'] as const)if(get(key)&&!urls(key).length&&!(key==='homework'&&note)){pending.push({row:index+2,reason:'Liên kết học liệu không hợp lệ'});invalid=true;break;}if(invalid)continue;
  if(note&&!urls('material').length){pending.push({row:index+2,reason:'Thiếu phiếu HS cho phần trắc nghiệm'});continue;}
  let lessonCode:string;try{lessonCode=config.paired?pairedLessonCode(config.programKey,date):config.programKey+'-'+date;}catch{pending.push({row:index+2,reason:'Cần cấu hình bài riêng'});continue;}
  const homeworkUrls=note?urls('material'):urls('homework');
  const lesson:LessonMaterial={lessonCode,classNames:config.paired?config.classNames.map(klass):[klass(get('className'))],classDates:{[klass(get('className'))]:date},date,title:get('title')||'Buổi học',videoId,...(video&&!videoId?{videoUrl:video}:{}),materialUrl:urls('material')[0]??null,handoutUrl:urls('handout')[0]??null,homeworkUrl:homeworkUrls[0]??null,homeworkUrls,homeworkNote:note};
  const previous=lessons.find(l=>l.lessonCode===lessonCode);if(previous){if(['title','videoId','videoUrl','materialUrl','handoutUrl','homeworkUrl','homeworkNote'].some(k=>previous[k as keyof LessonMaterial]!==lesson[k as keyof LessonMaterial]))throw Error('Hai ca cùng bài có học liệu khác nhau; cần đối soát');previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};previous.homeworkUrls=[...new Set([...(previous.homeworkUrls??[]),...(lesson.homeworkUrls??[])])];parent=previous;}else{lessons.push(lesson);parent=lesson;}parentSourceDate=date;
 }
 return {lessons:lessons.sort((a,b)=>b.date.localeCompare(a.date)),pending};
}
export async function readLessonSources(configs:LessonSourceConfig[],reader:(sheetId:string,tab:string)=>Promise<MaterialCell[][]>){
 const results=[];for(const config of configs){const [header,...rows]=await reader(config.sheetId,config.tab);results.push(readLessonMaterials((header??[]).map(cellText),rows,config));}
 const combined=new Map<string,LessonMaterial>();for(const result of results)for(const lesson of result.lessons){const previous=combined.get(lesson.lessonCode);if(previous){if(['title','videoId','videoUrl','materialUrl','handoutUrl','homeworkUrl'].some(k=>previous[k as keyof LessonMaterial]!==lesson[k as keyof LessonMaterial]))throw Error('Hai nguồn cùng bài có học liệu khác nhau; cần đối soát');previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};previous.homeworkUrls=[...new Set([...(previous.homeworkUrls??[]),...(lesson.homeworkUrls??[])])];}else combined.set(lesson.lessonCode,{...lesson,classNames:[...lesson.classNames]});}
 return {lessons:[...combined.values()].sort((a,b)=>b.date.localeCompare(a.date)),sources:results,pending:results.flatMap((result,i)=>result.pending.map(p=>({...p,sheetId:configs[i].sheetId,tab:configs[i].tab})))};
}
