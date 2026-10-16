import type {LessonMaterial} from '../../src/native/homework/btvn-contract';
import {pairedLessonCode} from './lesson-policy';
import {cellText,cellLinks,headerKey,materialDate,normalizeMaterialClass,type MaterialCell} from './material-cells';
import {comparableHomeworkNote,materialConflict} from './material-conflict';
export type LessonSourceConfig={sheetId:string;tab:string;programKey:string;paired:boolean;classNames:string[];columns:Record<'className'|'date'|'title'|'material'|'handout'|'homework',string>&{video?:string;answer?:string};confirmedDates?:Record<string,string>;schoolYear?:{startYear:number;startMonth:number};classAliases?:Record<string,string>};
type LessonPending={row:number;reason:string;lessonCode?:string;code?:'source_conflict';sourceRows?:[number,number];fields?:string[];requiresScopeReview?:boolean};
const comparisonFields=['title','videoId','videoUrl','materialUrl','handoutUrl','homeworkUrl','homeworkNote'] as const;
const lessonDifferences=(a:LessonMaterial,b:LessonMaterial)=>comparisonFields.filter(key=>key==='homeworkNote'
 ?comparableHomeworkNote(a.homeworkNote)!==comparableHomeworkNote(b.homeworkNote):a[key]!==b[key]);
export function safeMaterialUrl(value:string):string|null {return cellLinks(value)[0]??null;}
export function youtubeVideoId(value:string):string|null {
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)return null;const host=u.hostname.toLowerCase();let id='';
 if(host==='youtu.be')id=u.pathname.slice(1);else if(['youtube.com','www.youtube.com','m.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host))id=u.pathname==='/watch'?u.searchParams.get('v')??'':/^\/(?:embed|shorts|live)\/([^/]+)$/.exec(u.pathname)?.[1]??'';
 return /^[a-zA-Z0-9_-]{11}$/.test(id)?id:null;}catch{return null;}
}
function parseLessonMaterials(headers:string[],rows:MaterialCell[][],config:LessonSourceConfig){
 const indexes=new Map<string,number>();for(const [key,name] of Object.entries(config.columns)){if(!name)continue;const hits=headers.map((h,i)=>headerKey(h)===headerKey(name)?i:-1).filter(i=>i>=0);if(hits.length!==1)throw Error('Thiếu/trùng cột buổi học');indexes.set(key,hits[0]);}
 const lessons=new Map<string,LessonMaterial>(),lessonRows=new Map<string,number>(),conflicted=new Set<string>(),pending:LessonPending[]=[];let parent:LessonMaterial|undefined,parentSourceDate:string|null=null;
 const klass=(s:string)=>normalizeMaterialClass(config.classAliases?.[s.trim()]??s);
 for(const [index,row] of rows.entries()){
  const cell=(key:string)=>row[indexes.get(key)??-1],get=(key:string)=>cellText(cell(key)).trim();
  const date=materialDate(config.confirmedDates?.[get('date')]??get('date'),config.schoolYear);
  const note=headerKey(get('homework'))===headerKey('Phần trắc nghiệm trong phiếu')?get('homework'):undefined;
  const isolate=(previous:LessonMaterial,fields:string[])=>{
   pending.push(materialConflict(previous.lessonCode,[lessonRows.get(previous.lessonCode)!,index+2],fields));
   lessons.delete(previous.lessonCode);conflicted.add(previous.lessonCode);parent=undefined;
  };
  if(!get('className')&&!get('title')&&get('homework')&&parent&&(!get('date')||date===parentSourceDate)){
   // Ghi chú không có link vẫn có hiệu lực, không được kế thừa nhầm cả phiếu.
   if(note&&comparableHomeworkNote(note)!==comparableHomeworkNote(parent.homeworkNote)){isolate(parent,['homeworkNote']);continue;}
   const links=note?[...new Set([...cellLinks(cell('material')),...cellLinks(cell('homework'))])]:cellLinks(cell('homework'));
   if(!links.length){pending.push({row:index+2,reason:'Tệp phụ chưa có liên kết'});continue;}
   parent.homeworkUrls=[...new Set([...(parent.homeworkUrls??[]),...links])];continue;
  }
  parent=undefined;
  if(!config.classNames.map(klass).includes(klass(get('className'))))continue;
  if(!date){if(get('date')&&!/^\\+$/.test(get('date')))pending.push({row:index+2,reason:'Cần xác minh ngày và năm'});continue;}
  let lessonCode:string;try{lessonCode=config.paired?pairedLessonCode(config.programKey,date):config.programKey+'-'+date;}catch{pending.push({row:index+2,reason:'Cần cấu hình bài riêng'});continue;}
  if(conflicted.has(lessonCode))continue;
  const previous=lessons.get(lessonCode);
  if(note&&previous&&comparableHomeworkNote(note)!==comparableHomeworkNote(previous.homeworkNote)){isolate(previous,['homeworkNote']);continue;}
  const urls=(key:string)=>cellLinks(cell(key)),video=urls('video')[0]??'',videoId=youtubeVideoId(video);
  if(video&&!videoId&&!/(^|\.)zoom\.us$/.test(new URL(video).hostname)){pending.push({row:index+2,reason:'Video không phải YouTube hoặc Zoom record hợp lệ'});continue;}
  if(get('video')&&!video){pending.push({row:index+2,reason:'Record chưa có liên kết'});continue;}
  let invalid=false;for(const key of ['material','handout','homework'] as const)if(get(key)&&!urls(key).length&&!(key==='homework'&&note)){pending.push({row:index+2,reason:'Liên kết học liệu không hợp lệ'});invalid=true;break;}if(invalid)continue;
  if(note&&!urls('material').length){pending.push({row:index+2,reason:'Thiếu phiếu HS cho phần trắc nghiệm'});continue;}
  const homeworkUrls=note?urls('material'):urls('homework');
  const lesson:LessonMaterial={lessonCode,classNames:config.paired?config.classNames.map(klass):[klass(get('className'))],classDates:{[klass(get('className'))]:date},date,title:get('title')||'Buổi học',videoId,...(video&&!videoId?{videoUrl:video}:{}),materialUrl:urls('material')[0]??null,handoutUrl:urls('handout')[0]??null,homeworkUrl:homeworkUrls[0]??null,homeworkUrls,homeworkNote:note};
  if(previous){const differences=lessonDifferences(previous,lesson);if(differences.length){isolate(previous,differences);continue;}previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};previous.homeworkUrls=[...new Set([...(previous.homeworkUrls??[]),...(lesson.homeworkUrls??[])])];parent=previous;}else{lessons.set(lessonCode,lesson);lessonRows.set(lessonCode,index+2);parent=lesson;}parentSourceDate=date;
 }
 return {lessons:[...lessons.values()].sort((a,b)=>b.date.localeCompare(a.date)),pending,lessonRows};
}
export function readLessonMaterials(headers:string[],rows:MaterialCell[][],config:LessonSourceConfig){
 const result=parseLessonMaterials(headers,rows,config);return {lessons:result.lessons,pending:result.pending};
}
export async function readLessonSources(configs:LessonSourceConfig[],reader:(sheetId:string,tab:string)=>Promise<MaterialCell[][]>){
 const parsed=[];for(const config of configs){const [header,...rows]=await reader(config.sheetId,config.tab);parsed.push(parseLessonMaterials((header??[]).map(cellText),rows,config));}
 const results=parsed.map(result=>({lessons:result.lessons,pending:result.pending}));
 type Origin={sheetId:string;tab:string;row:number};
 type SourcePending=LessonPending&{sheetId?:string;tab?:string;sheetIds?:string[];sources?:Origin[]};
 const pending:SourcePending[]=results.flatMap((result,i)=>result.pending.map(p=>({...p,sheetId:configs[i].sheetId,tab:configs[i].tab})));
 // Một nguồn đã cô lập bài thì nguồn sau không được làm bài đó sống lại.
 const conflicted=new Set(pending.filter(p=>p.code==='source_conflict').map(p=>p.lessonCode!));
 const combined=new Map<string,LessonMaterial>(),origins=new Map<string,Origin>();
 for(const [i,result] of parsed.entries())for(const lesson of result.lessons){
  if(conflicted.has(lesson.lessonCode))continue;
  const origin={sheetId:configs[i].sheetId,tab:configs[i].tab,row:result.lessonRows.get(lesson.lessonCode)!},previous=combined.get(lesson.lessonCode);
  if(previous){
   const differences=lessonDifferences(previous,lesson);
   if(differences.length){
    const first=origins.get(lesson.lessonCode)!;
    pending.push({...materialConflict(lesson.lessonCode,[first.row,origin.row],differences),sheetIds:[first.sheetId,origin.sheetId],sources:[first,origin]});
    combined.delete(lesson.lessonCode);conflicted.add(lesson.lessonCode);continue;
   }
   previous.classNames=[...new Set([...previous.classNames,...lesson.classNames])];previous.classDates={...previous.classDates,...lesson.classDates};previous.homeworkUrls=[...new Set([...(previous.homeworkUrls??[]),...(lesson.homeworkUrls??[])])];
  }else{combined.set(lesson.lessonCode,{...lesson,classNames:[...lesson.classNames],classDates:{...lesson.classDates},homeworkUrls:[...(lesson.homeworkUrls??[])]});origins.set(lesson.lessonCode,origin);}
 }
 return {lessons:[...combined.values()].sort((a,b)=>b.date.localeCompare(a.date)),sources:results,pending};
}
